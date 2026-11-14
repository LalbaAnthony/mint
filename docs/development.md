# Développement

Mise en route locale et exécution des tests. Les décisions sont motivées dans les ADR 0005 (paquet partagé) et 0011 (pile de bout en bout).

## 1. Environnement

Copier `.env.example` en `.env` à la racine : Docker Compose et les tests de l'API le lisent. Les valeurs `SMTP_*` y restent vides, elles ne servent qu'au service `api` de production.

| Service (profil `dev`) | Rôle                                                               | Accès depuis l'hôte                          |
| ---------------------- | ------------------------------------------------------------------ | -------------------------------------------- |
| `db-dev`               | PostgreSQL de développement et des tests de l'API                  | `127.0.0.1:${DB_HOST_PORT}`                  |
| `api-dev`              | API en `tsx watch`, sources `api/` et `shared/` montées            | `127.0.0.1:${API_HOST_PORT}`                 |
| `web-dev`              | front en `nuxt dev`, sources `front/` et `shared/` montées         | `http://localhost:${WEB_HOST_PORT}`          |
| `mailpit`              | serveur SMTP de développement, reçoit tous les emails de `api-dev` | interface web `127.0.0.1:${MAILPIT_UI_PORT}` |

```sh
docker compose --profile dev up -d
```

Le front de développement écoute sur `http://localhost:${WEB_HOST_PORT}` (8080 dans `.env.example`), valeur d'`APP_ORIGIN` de `api-dev` et donc base des liens envoyés par email. Il relaie `/api` vers `api-dev`. `WEB_HOST_PORT` sert aussi au conteneur `web` du profil `prod`, comme `API_HOST_PORT` pour `api` et `api-dev` : les deux profils ne tournent pas en même temps.

Dans `web-dev`, les sources sont surveillées par scrutation (`CHOKIDAR_USEPOLLING`), car les notifications du système de fichiers ne traversent pas un montage depuis Windows. `front/node_modules` et `front/.nuxt` restent propres au conteneur (volumes anonymes) : ceux de l'hôte gardent leurs binaires et leurs chemins pour l'éditeur et le typecheck. Une modification de `nuxt.config.ts` n'est pas détectée dans le conteneur et demande `docker compose --profile dev restart web-dev`.

Front lancé sur l'hôte, à la place de `web-dev` :

```sh
docker compose --profile dev up -d db-dev api-dev mailpit
npm run dev --workspace @mint/front
```

Nuxt écoute alors sur le port 8080 (`devServer.port`) et relaie `/api` vers `http://127.0.0.1:3000`. Si `WEB_HOST_PORT` diffère, exporter `NUXT_PORT` à la même valeur pour que les liens envoyés par email restent justes ; si `API_HOST_PORT` diffère, exporter `MINT_DEV_API_ORIGIN`.

Premier administrateur local :

```sh
docker compose --profile dev exec api-dev npm run admin -- create-admin --email admin@mint.localhost --locale fr
```

Jeu de données de développement, à la place du premier administrateur :

```sh
docker compose --profile dev exec api-dev npm run seed -- --wipe
```

`--wipe` est obligatoire, même sur une base vide : le script supprime tous les utilisateurs et toutes les invitations, donc par cascade les sessions, les jetons, les catégories, les comptes et les moyens de paiement, puis crée 34 utilisateurs au mot de passe `mint-dev-only-password`, chacun avec les catégories par défaut (CAT-05) et système (CAT-08) dans sa langue.

| Compte                                              | Rôle et particularités                                                                                                                                                                                                                                                                      |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `admin@mint.localhost`                              | administrateur, français                                                                                                                                                                                                                                                                    |
| `user@mint.localhost`                               | utilisateur, français ; catégories ajoutées au premier niveau, sous-catégories, une catégorie et une sous-catégorie archivées ; comptes d'US-04 (compte courant 2 000 €, LEP 5 000 €, Livret A 12 000 €), un PEA de 3 000 €, un compte archivé ; cinq moyens de paiement dont deux archivés |
| `user-en@mint.localhost`                            | utilisateur, anglais, jamais connecté                                                                                                                                                                                                                                                       |
| `disabled@mint.localhost`                           | utilisateur désactivé                                                                                                                                                                                                                                                                       |
| `user-01@mint.localhost` à `user-30@mint.localhost` | utilisateurs, langues alternées, pour les listes de la console d'administration                                                                                                                                                                                                             |

Une sous-catégorie de dépense a `expense_group` à `NULL` : son groupe se lit sur son parent. Le script vit dans `api/scripts/`, exclu du build de production : il n'existe pas dans l'image `mint-api`. Une table ajoutée sans suppression en cascade depuis `users` doit être ajoutée à la suppression du script.

## 2. Tests

| Commande                                | Portée                                                                      |
| --------------------------------------- | --------------------------------------------------------------------------- |
| `npm test`                              | Vitest : scripts, `shared`, API (intégration avec PostgreSQL), front (Nuxt) |
| `npm run test:coverage`                 | Vitest avec couverture ; échoue sous 90 % sur `shared/engines/`             |
| `npx vitest run --project shared`       | moteurs de calcul et schémas partagés, sans base de données                 |
| `npm run openapi --workspace @mint/api` | régénère `docs/openapi.json` ; un test échoue s'il n'est pas à jour         |
| `npm run test:e2e`                      | Playwright, sur la pile `e2e/compose.yml` déjà démarrée                     |

Les tests de l'API exigent `db-dev`. Le setup global crée une base modèle migrée ; chaque fichier de test travaille sur sa propre copie, supprimée à la fin.

Tests de bout en bout :

```sh
docker compose -f e2e/compose.yml up --build --detach --wait
npx playwright install chromium
npm run test:e2e
docker compose -f e2e/compose.yml down --volumes
```

La pile écoute sur `localhost:8090` (Apache simulé), PostgreSQL sur `127.0.0.1:5442` et Mailpit sur `127.0.0.1:8126` ; `E2E_HTTP_PORT`, `E2E_DB_PORT` et `E2E_MAILPIT_PORT` les déplacent.

## 3. Isolation des données

Chaque route de l'API est déclarée dans `api/routes/index.ts` avec son niveau d'accès (`definePublicRoute`, `defineUserRoute`, `defineAdminRoute`). Le test `api/routes/isolation.test.ts` échoue si une route n'a pas de scénario d'accès croisé entre deux utilisateurs (NF-SEC-05, US-02) : toute nouvelle route y ajoute le sien.
