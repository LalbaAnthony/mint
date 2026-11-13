# ADR 0005 · Paquet @mint/shared consommé depuis ses sources

Statut : acceptée · 13 novembre 2026 · Exigences : CODE-08, CODE-09, NF-SEC-04, section 7.1

## Contexte

Les règles de validation (mot de passe de 12 caractères, email, horizon de 1 à 12 mois, cibles dont la somme vaut 100) et les types des réponses servent à la fois à l'API et aux formulaires du front. L'API est compilée par `tsc` avec `rootDir` limité à `api/` : elle ne peut pas inclure `shared/` dans sa compilation sans déplacer `dist/server.js` et `dist/db/migrate.js`, chemins utilisés par `remote.sh`, y compris lors d'un retour arrière vers une image antérieure.

## Décision

- `shared/schemas/` porte les schémas zod communs, `shared/types/` les types dérivés par `z.infer` (CODE-09). Les messages d'erreur des schémas sont des codes (`password_too_short`, `targets_sum_not_100`...) traduits par le front.
- `@mint/shared` est une dépendance de `@mint/api` et de `@mint/front`. Ses `exports` déclarent trois conditions : `source` et `types` vers les fichiers `.ts`, `default` vers `dist/`, produit par `npm run build --workspace @mint/shared`.
- Typecheck (`tsc`, `vue-tsc`) : condition `types`, donc les sources, sans build préalable. Les fichiers résolus par `node_modules` ne sont ni émis ni soumis au `rootDir` de l'API.
- Vite (front, Vitest) : alias `@mint/shared` vers `shared/`. tsx (développement, migrations, CLI, génération OpenAPI) : option `--conditions=source`.
- Production : l'image `mint-api` compile `shared/` puis l'API, et embarque `shared/dist` à côté de `api/dist`. L'image `mint-web` reçoit les sources de `shared/` pour `nuxt generate`.
- Les schémas portent leur identifiant OpenAPI par `.meta({ id })` de zod : `shared/` ne dépend pas de zod-to-openapi.

## Conséquences

- Une seule source de vérité pour les règles de validation et les types d'échange.
- `api/tsconfig.build.json` exclut `tests/`, `scripts/`, `types/tests.ts` et `types/vitest.d.ts` : ces fichiers tirent des dépendances de développement absentes de l'image.
- Le conteneur `api-dev` monte `./shared` en plus de `./api`.
