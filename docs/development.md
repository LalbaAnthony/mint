# Développement

Mise en route locale et exécution des tests. Les décisions sont motivées dans les ADR 0005 (paquet partagé) et 0011 (pile de bout en bout).

## 1. Environnement

Copier `.env.example` en `.env` à la racine : Docker Compose et les tests de l'API le lisent. Les valeurs `SMTP_*` y restent vides, elles ne servent qu'au service `api` de production.

| Service (profil `dev`) | Rôle                                                               | Accès depuis l'hôte                          |
| ---------------------- | ------------------------------------------------------------------ | -------------------------------------------- |
| `db-dev`               | PostgreSQL de développement et des tests de l'API                  | `127.0.0.1:${DB_HOST_PORT}`                  |
| `api-dev`              | API en `tsx watch`, sources `api/` et `shared/` montées            | `127.0.0.1:${API_HOST_PORT}`                 |
| `mailpit`              | serveur SMTP de développement, reçoit tous les emails de `api-dev` | interface web `127.0.0.1:${MAILPIT_UI_PORT}` |

```sh
docker compose --profile dev up -d
npm run dev --workspace @mint/front
```

Le front de développement écoute sur `http://localhost:3001` (valeur d'`APP_ORIGIN` de `api-dev`, base des liens envoyés par email) et relaie `/api` vers `http://127.0.0.1:3000`. Si `API_HOST_PORT` diffère, exporter `MINT_DEV_API_ORIGIN` avant de lancer Nuxt.

Premier administrateur local :

```sh
docker compose --profile dev exec api-dev npm run admin -- create-admin --email admin@mint.localhost --locale fr
```

## 2. Tests

| Commande                                | Portée                                                                      |
| --------------------------------------- | --------------------------------------------------------------------------- |
| `npm test`                              | Vitest : scripts, `shared`, API (intégration avec PostgreSQL), front (Nuxt) |
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
