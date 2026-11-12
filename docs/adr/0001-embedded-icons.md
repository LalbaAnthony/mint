# ADR 0001 · Icônes embarquées sans fournisseur réseau

Statut : acceptée · 12 novembre 2026 · Exigences : CHG-42, CHG-44, CHG-102, CHG-103, CA-03, CA-08

## Contexte

Par défaut, @nuxt/icon charge à l'exécution les icônes absentes du bundle client depuis l'API Iconify. Cette requête vers une origine tierce est incompatible avec la CSP de la charte (`connect-src 'self'`, CHG-103) et avec la consultation hors connexion (NF-PWA-02, CA-03).

## Décision

- `icon.provider: 'none'` dans `front/nuxt.config.ts` : aucune requête réseau, le chargement à l'exécution est neutralisé.
- Collection Lucide installée localement (`@iconify-json/lucide`, dépendance de développement du paquet `front`) et embarquée dans le bundle client.
- `icon.clientBundle.scan: true` pour les icônes écrites dans les templates Vue, complété par la liste explicite `icon.clientBundle.icons` : table métier CHG-44, icônes des groupes et usages CHG-21, icônes internes de Nuxt UI (`ui.icons`).
- La table métier vit dans un module unique de constantes, `front/app/utils/icons.ts`.
- Un test (`front/test/nuxt/icons.test.ts`, CA-08) vérifie que chaque valeur de `ui.icons` résolue à l'exécution et de `front/app/utils/icons.ts` figure dans `icon.clientBundle.icons`, et que la liste ne contient que des icônes Lucide.

## Conséquences

- Aucune requête vers Iconify, en ligne comme hors ligne.
- Le balayage ne lit pas les fichiers `.ts` : une icône référencée seulement en TypeScript doit être ajoutée à `front/app/utils/icons.ts` et à `icon.clientBundle.icons`, sinon elle ne s'affiche pas. Le test CA-08 détecte l'oubli.
- Depuis Nuxt UI 4.12, le module ajoute lui-même au bundle les valeurs de `ui.icons` connues au build. La liste explicite reste exigée : elle couvre aussi les surcharges de `ui.icons` faites dans `app.config.ts`, que ce mécanisme ne voit pas.
- Taille au setup : 74 icônes, environ 21 Ko non compressés, sous la limite de 256 Ko imposée par @nuxt/icon.
