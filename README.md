# Mint

Application web progressive de gestion de finances personnelles : comptes et placements, échéances, enveloppes budgétaires, solde prévisionnel jour par jour, import bancaire et rapprochement. Front Nuxt, API Express, PostgreSQL, dans un seul dépôt en npm workspaces (`front/`, `api/`, `shared/`).

## Prérequis

- Node.js 22 ou plus et npm (les images Docker utilisent Node.js 24 LTS).
- Docker Engine avec le plugin Docker Compose v2.

## Installation

Depuis la racine du dépôt, en bash ou en PowerShell :

```sh
./script-setup.sh
```

```powershell
.\script-setup.ps1
```

Le script enchaîne les étapes ci-dessous. Il écrase un `.env` existant par `.env.example`, et le jeu de données supprime tous les utilisateurs de la base de développement avant de les recréer.

```sh
cp .env.example .env
npm install
docker compose --profile dev up -d --build --wait
docker compose --profile dev exec api-dev npm run migrate -- up
docker compose --profile dev exec api-dev npm run seed -- --wipe
```

`npm install` installe aussi les hooks Git (simple-git-hooks) et prépare Nuxt. L'application répond ensuite sur `http://localhost:8080` : `admin@mint.localhost` (administrateur) ou `user@mint.localhost` (utilisateur avec données), mot de passe `mint-dev-only-password`. Les emails envoyés en développement arrivent dans Mailpit, `http://127.0.0.1:8125`. Les ports se règlent dans `.env` ; les services, le jeu de données et les variables sont détaillés dans [docs/development.md](docs/development.md).

## Contrôles

| Commande               | Rôle                                                                     |
| ---------------------- | ------------------------------------------------------------------------ |
| `npm run lint`         | ESLint sur tout le dépôt, sans avertissement toléré                      |
| `npm run format:check` | Prettier en vérification                                                 |
| `npm run typecheck`    | `tsc` à la racine et dans chaque paquet, `vue-tsc` pour le front         |
| `npm run scan`         | caractères interdits (emoji, tiret cadratin) dans les fichiers suivis    |
| `npm test`             | Vitest : scripts, `shared`, API avec PostgreSQL (`db-dev`), front (Nuxt) |
| `npm run test:e2e`     | Playwright, sur la pile `e2e/compose.yml` démarrée au préalable          |

Les règles contrôlées sont celles de la section 7.5 du cahier des charges (CODE-01 à CODE-16) ; la mise en route des tests de bout en bout et la couverture sont décrites dans [docs/development.md](docs/development.md), section 2.

## Documentation

`docs/` est la référence du projet.

| Document                                               | Contenu                                                                      |
| ------------------------------------------------------ | ---------------------------------------------------------------------------- |
| [docs/specifications.md](docs/specifications.md)       | cahier des charges : exigences, user stories, modèle de données, lots        |
| [docs/graphic-charter.md](docs/graphic-charter.md)     | charte graphique et règles d'interface                                       |
| [docs/calculation-rules.md](docs/calculation-rules.md) | règles de calcul : prévision, exécution, rapprochement, enveloppes, intérêts |
| [docs/development.md](docs/development.md)             | environnement local, jeu de données, tests                                   |
| [docs/deployment.md](docs/deployment.md)               | CI/CD, secrets, VPS, Apache, déploiement, retour arrière, administrateurs    |
| [docs/adr/](docs/adr/)                                 | décisions d'architecture, une par fichier                                    |
| [docs/openapi.json](docs/openapi.json)                 | spécification OpenAPI 3 de l'API, générée depuis les schémas zod             |

## Production

Mint est servi sur `mint.dev-it.app` derrière Apache (vhost de référence : [apache.conf](apache.conf)). Chaque push sur `main` contrôle, teste, publie les images et déploie, comme le run planifié du 1er de chaque mois qui reconstruit les images sur leurs images de base corrigées ; le retour arrière est un workflow manuel. Voir [docs/deployment.md](docs/deployment.md).
