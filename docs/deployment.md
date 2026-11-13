# Déploiement

Exploitation de la chaîne de livraison décrite dans le cahier des charges (sections 7.2 et 7.6) : publication des images, déploiement sur le VPS, retour arrière. Les choix sont motivés dans l'ADR 0004 (déploiement) et l'ADR 0003 (CSP du conteneur `web`).

## 1. Workflows

| Fichier             | Déclencheur                         | Rôle                                                                                                                       |
| ------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `release.flow.yml`  | push sur `main`                     | `checks.inc.yml`, puis `tests.inc.yml`, puis `build.inc.yml`, puis `deploy.inc.yml` avec le SHA du commit poussé           |
| `rollback.flow.yml` | déclenchement manuel, SHA en entrée | `deploy.inc.yml` avec le SHA fourni                                                                                        |
| `build.inc.yml`     | appelé par `release.flow.yml`       | construction `linux/amd64` et publication sur Docker Hub de `mint-api` et `mint-web`, tags `latest` et SHA complet         |
| `deploy.inc.yml`    | appelé par les deux flux            | validation des secrets, SSH vers le VPS avec empreinte d'hôte épinglée, exécution de `.github/deploy/remote.sh` sur le VPS |

Un seul run de `release.flow.yml` s'exécute à la fois : un push arrivé pendant un run attend, et un push plus récent remplace celui qui attend. Le job de déploiement partage le groupe de concurrence `deploy-production` avec `rollback.flow.yml` : deux déploiements ne se chevauchent jamais.

## 2. Images

| Image      | Dockerfile              | Contenu                                                                                                                                   |
| ---------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `mint-api` | `api/Dockerfile.prod`   | API Express compilée, utilisateur `node`, sert aussi les migrations (`node dist/db/migrate.js up`) et la CLI d'administration (section 9) |
| `mint-web` | `front/Dockerfile.prod` | build statique Nuxt servi par nginx:alpine, utilisateur `nginx`, port 8080, en-têtes de sécurité et CSP (ADR 0003)                        |

Les deux images sont publiées dans les dépôts Docker Hub `<DOCKERHUB_USERNAME>/mint-api` et `<DOCKERHUB_USERNAME>/mint-web`. Créer ces dépôts en public avant la première release : un push vers un dépôt inexistant le crée avec la visibilité par défaut du compte. Le VPS tire les images sans authentification. Le tag `latest` n'est utilisé par aucun déploiement, qui référence toujours le SHA complet.

Le contexte de build de `mint-web` utilise `front/Dockerfile.prod.dockerignore`, celui de `mint-api` le `.dockerignore` racine.

## 3. Secrets GitHub

Tous au niveau du dépôt (Settings, Secrets and variables, Actions). Aucune valeur de déploiement n'est versionnée ni stockée en variable. Hors clé privée, aucune valeur ne doit contenir d'apostrophe droite ni de saut de ligne : le job `deploy` le vérifie avant toute connexion.

| Secret                     | Usage                                                                                                                                  |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `DOCKERHUB_USERNAME`       | compte Docker Hub, espace de noms des images                                                                                           |
| `DOCKERHUB_TOKEN`          | jeton d'accès Docker Hub en lecture et écriture, utilisé seulement par `build.inc.yml`                                                 |
| `VPS_SSH_HOST`             | nom d'hôte ou adresse IP du VPS                                                                                                        |
| `VPS_SSH_PORT`             | port SSH du VPS                                                                                                                        |
| `VPS_SSH_USER`             | utilisateur SSH dédié au déploiement                                                                                                   |
| `VPS_SSH_PRIVATE_KEY`      | clé privée de cet utilisateur, format OpenSSH, sans phrase de passe                                                                    |
| `VPS_SSH_HOST_FINGERPRINT` | empreinte SHA256 de la clé d'hôte du VPS, au format `SHA256:` suivi de 43 caractères base64                                            |
| `VPS_DEPLOY_PATH`          | dossier de déploiement sur le VPS, chemin absolu                                                                                       |
| `POSTGRES_DB`              | nom de la base de production                                                                                                           |
| `POSTGRES_USER`            | utilisateur PostgreSQL de production                                                                                                   |
| `POSTGRES_PASSWORD`        | mot de passe PostgreSQL de production (voir section 7 avant de le changer)                                                             |
| `API_HOST_PORT`            | port de l'API sur `127.0.0.1` du VPS, cible d'Apache pour `/api/` : `4568` (`apache.conf`)                                             |
| `WEB_HOST_PORT`            | port du conteneur `web` sur `127.0.0.1` du VPS, cible d'Apache pour `/` : `4569` (`apache.conf`)                                       |
| `SESSION_SECRET`           | secret de signature des cookies de session et des jetons CSRF, 32 caractères minimum (ADR 0006, ADR 0007)                              |
| `SMTP_HOST`                | serveur SMTP d'envoi des invitations et des liens de réinitialisation                                                                  |
| `SMTP_PORT`                | port de ce serveur                                                                                                                     |
| `SMTP_TLS_MODE`            | `tls` (TLS implicite, port 465 en général), `starttls` (STARTTLS obligatoire, port 587) ou `none` (sans TLS, réservé au développement) |
| `SMTP_USER`                | identifiant SMTP                                                                                                                       |
| `SMTP_PASSWORD`            | mot de passe SMTP                                                                                                                      |
| `MAIL_FROM`                | expéditeur des emails, par exemple `Mint <no-reply@dev-it.app>`                                                                        |

À chaque déploiement, le fichier `.env` du VPS est régénéré depuis ces secrets, avec `COMPOSE_PROFILES='prod'` et les références d'images `docker.io/<DOCKERHUB_USERNAME>/mint-api:<SHA>` et `mint-web:<SHA>`. Toute modification manuelle de ce fichier est écrasée au déploiement suivant. Un nouveau secret d'exécution (session, VAPID, SMTP) s'ajoute à la fois dans les secrets GitHub, dans `deploy.inc.yml` (déclaration, validation, écriture du `.env`), dans les deux flux et dans `docker-compose.yml`.

## 4. Préparation du VPS

1. Installer Docker Engine avec le plugin Docker Compose v2, `bash`, `curl` et `base64`.
2. Créer un utilisateur dédié, membre du groupe `docker`. Ce groupe donne un accès équivalent à root sur l'hôte : l'utilisateur ne sert qu'au déploiement.
3. Générer une paire de clés dédiée (`ssh-keygen -t ed25519 -N '' -f mint-deploy`), ajouter la clé publique à `~/.ssh/authorized_keys` de cet utilisateur et enregistrer la clé privée dans `VPS_SSH_PRIVATE_KEY`.
4. Relever l'empreinte de la clé d'hôte sur le VPS : `ssh-keygen -l -E sha256 -f /etc/ssh/ssh_host_ed25519_key.pub`, puis enregistrer la valeur `SHA256:...` dans `VPS_SSH_HOST_FINGERPRINT`. Le job lit les clés servies par `ssh-keyscan` et n'accepte que celle dont l'empreinte est identique.
5. Choisir `VPS_DEPLOY_PATH` (par exemple `/srv/mint`), accessible en écriture par l'utilisateur : le dossier est créé s'il n'existe pas. Il contient seulement `docker-compose.yml` et `.env`, mode 600.
6. Réserver `API_HOST_PORT` et `WEB_HOST_PORT`, exposés seulement sur `127.0.0.1`.

## 5. Apache

Domaine de production : `mint.dev-it.app`. Le vhost de référence est `apache.conf` à la racine du dépôt. Il n'est ni généré ni déployé par la CI : le fichier du serveur (par exemple `/etc/apache2/sites-available/mint.conf`) doit rester identique, et toute modification passe par le dépôt.

| Élément            | Valeur                                                                                                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modules            | `a2enmod http2 ssl rewrite proxy proxy_http headers` ; HTTP/2 exige un MPM `event` ou `worker`                                                                       |
| Port 80            | sert `/.well-known/acme-challenge/` depuis `/var/www/certbot`, redirige tout le reste en 301 vers HTTPS                                                              |
| Routage 443        | `/api/` vers `127.0.0.1:4568` (`API_HOST_PORT`), le reste vers `127.0.0.1:4569` (`WEB_HOST_PORT`) ; les deux ports doivent correspondre aux secrets GitHub           |
| En-têtes           | HSTS `max-age=63072000` sur tout le vhost (NF-SEC-01) ; `X-Content-Type-Options` et `Referrer-Policy` sur `/api/` seulement ; aucune CSP (NF-SEC-02, celle de `web`) |
| En-tête vers l'API | `X-Forwarded-Proto: https`, pour les cookies de session `secure` derrière le proxy (avec `trust proxy` côté Express)                                                 |
| TLS                | TLS 1.2 et plus, HTTP/2 par ALPN, même liste de chiffrements que les autres vhosts du serveur                                                                        |
| Journaux           | `mint-prod_access.log` au format `combined` sans chaîne de requête (`%U`), qui peut porter des données saisies (NF-SEC-06) ; `mint-prod_error.log`                   |

Les pages ont déjà `X-Content-Type-Options` et `Referrer-Policy` posés par nginx : les poser aussi dans Apache sur `/` dupliquerait ces en-têtes. Si l'API pose un jour ces en-têtes elle-même, les retirer du bloc `<Location /api/>`.

Première mise en service : le vhost 443 référence un certificat qui n'existe pas encore, et `apachectl configtest` échouerait. Activer d'abord une version du fichier réduite au vhost 80, obtenir le certificat (`certbot certonly --webroot -w /var/www/certbot -d mint.dev-it.app`), puis installer le fichier complet, `apachectl configtest` et `systemctl reload apache2`.

## 6. Déroulé d'un déploiement

1. Validation du SHA (40 caractères hexadécimaux) et des secrets.
2. Lecture de `docker-compose.yml` dans le commit déployé ; génération du `.env` de production sur le runner.
3. Connexion SSH avec la clé d'hôte épinglée. Le script `.github/deploy/remote.sh` de la branche qui exécute le workflow est envoyé sur l'entrée standard de `bash`, précédé des variables du déploiement ; le `.env` et le fichier compose y voyagent encodés en base64, jamais en argument de commande.
4. Sur le VPS, écriture de `.env.next` et `docker-compose.next.yml`, puis `docker compose pull api web`.
5. Migrations Umzug dans un conteneur éphémère : `docker compose run --rm api node dist/db/migrate.js up`, qui démarre `db` au besoin.
6. Seulement si les migrations réussissent : `.env.next` et `docker-compose.next.yml` remplacent `.env` et `docker-compose.yml`, puis `docker compose up --detach --no-build --wait` attend que `db`, `api` et `web` soient sains.
7. Vérification par `curl` de `http://127.0.0.1:<API_HOST_PORT>/api/v1/health` et de `http://127.0.0.1:<WEB_HOST_PORT>/`.
8. Suppression des tags locaux de `mint-api` et `mint-web` autres que le SHA déployé. Les images des autres services du VPS ne sont jamais touchées.

Si une étape échoue avant le point 6, les conteneurs en place continuent de tourner sans changement et les fichiers `.next` sont supprimés. Si `up --wait` ou la vérification échoue, les nouveaux conteneurs restent en place : lancer un retour arrière.

## 7. Retour arrière

Actions, workflow `rollback`, Run workflow, puis saisir le SHA complet d'un commit de `main` déjà publié par une release. Le workflow redéploie ses images avec le `docker-compose.yml` de ce commit et les secrets actuels.

- Les migrations déjà appliquées ne sont pas annulées : l'ancienne version doit tolérer le schéma courant.
- Un SHA jamais publié échoue au pull, sans rien modifier sur le VPS.
- Un retour arrière lancé pendant qu'une release est en cours de contrôles ou de tests est écrasé par cette release quand elle arrive au déploiement.

## 8. Points d'attention

- Changer `POSTGRES_PASSWORD` : PostgreSQL ne relit cette variable qu'à l'initialisation du volume. Modifier d'abord le mot de passe dans la base (`ALTER USER`), puis le secret. Sinon le déploiement suivant échoue à l'étape des migrations, sans interruption de la version en place.
- Toute modification de la définition du service `db` dans `docker-compose.yml` (image, environnement) recrée le conteneur `db` dès l'étape des migrations, avant la bascule de l'API.
- Docker Compose signale `The "DB_HOST_PORT" variable is not set` à chaque commande sur le VPS : la variable ne sert qu'au service `db-dev` du profil `dev`. Avertissement sans effet.
- Le service `worker` (section 7.2) n'existe pas encore ; il sera ajouté à `docker-compose.yml` et à `remote.sh` (pull) avec les tâches planifiées.

## 9. Administrateurs

Le premier administrateur et toute promotion passent par la CLI de l'image `mint-api` (ADM-07), exécutée sur le VPS dans le dossier de déploiement. La commande demande le mot de passe deux fois, sans écho : elle exige un terminal interactif (`docker compose run` en alloue un par défaut).

```sh
docker compose run --rm api node dist/cli/admin.js create-admin --email owner@example.org --locale fr
docker compose run --rm api node dist/cli/admin.js promote --email member@example.org
```

`create-admin` crée le compte, son jeu de catégories par défaut (CAT-05) et refuse une adresse déjà utilisée. `promote` donne le rôle administrateur à un compte existant. Les deux écrivent un événement d'audit (ADR 0009). Les autres comptes se créent uniquement par invitation depuis la console d'administration.

Les secrets `SESSION_SECRET` et `SMTP_*` doivent exister avant le premier déploiement qui embarque l'authentification : sans eux, le job `deploy` échoue à la validation, avant toute connexion au VPS. Changer `SESSION_SECRET` déconnecte tous les utilisateurs.
