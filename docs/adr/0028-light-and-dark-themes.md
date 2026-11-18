# ADR 0028 · Thèmes clair et sombre

Statut : acceptée, amendée le 18 novembre 2026 (manifeste sans `theme_color`) · 16 novembre 2026 · Exigences : NF-UX-02, NF-PWA-03, CHG-07, CHG-71, CHG-83, CHG-84, CHG-90 à CHG-92, CHG-103, CA-12 · Remplace l'ADR 0002, amende la section 5.1 du cahier des charges

## Contexte

NF-UX-02 demande des thèmes clair et sombre « suivant le réglage du système par défaut », ce qui suppose un choix possible ; CHG-92 et l'ADR 0002 ne parlaient que de suivre le système. Les jetons sombres existent depuis le lot 1 (CHG-90), les écrans de démarrage sombres étaient générés mais non liés, et `ui.colorMode` était désactivé (ADR 0002). Restaient ouverts le droit de forcer un thème, l'endroit où ce choix est enregistré et le thème des pages publiques. Les arbitrages ci-dessous sont ceux du porteur du projet.

## Décision

- `ui.colorMode: true` : @nuxtjs/color-mode pose la classe `dark` sur `<html>`. Son script en ligne, exécuté avant l'application pour éviter un flash, est couvert par une empreinte de la CSP calculée au build comme celui de Nuxt (CHG-103, CA-12) : deux empreintes au lieu d'une.
- Choix du thème dans le profil, section Préférences : Système (par défaut), Clair, Sombre. Il est enregistré en base (`users.theme`, migration 0027, `CHECK` sur `system`, `light`, `dark`, `system` par défaut), exposé par la session et le profil, modifié par `PATCH /profile` (400 `invalid_theme`) et inclus dans le profil de l'export (AUTH-08). Il suit l'utilisateur sur tous ses appareils.
- Un plugin applique le thème du profil dès que l'état de la session est connu. Hors session (connexion, invitation, mot de passe oublié) et après une déconnexion, l'application suit le système : un autre utilisateur de l'appareil n'hérite pas du choix précédent (NF-PWA-03). @nuxtjs/color-mode garde le dernier thème appliqué dans le stockage local de l'appareil (`nuxt-color-mode`), ce qui évite un flash au rechargement.
- Méta `theme-color` (CHG-84) : la méta sombre `media="(prefers-color-scheme: dark)"` #1D1D16 précède la méta claire #FFFFFF, le navigateur retenant la première qui correspond. Avec un thème forcé, les deux prennent la couleur du thème choisi.
- Écrans de démarrage iOS (CHG-83) : les liens sombres, `media` avec `(prefers-color-scheme: dark)`, suivent les liens clairs, comme dans le balisage du générateur. iOS les choisit selon le réglage du système, pas selon le profil.
- Les graphiques relisent leurs jetons au changement de la classe de `<html>` (CHG-71) ; le picto reste identique (CHG-07).
- Manifeste (CHG-84, amendement du 18 novembre 2026) : un manifeste ne pouvant pas dépendre du thème, il garde `background_color` #FBFBF9 et ne déclare pas de `theme_color`. Chrome colore la barre de navigation du système d'une PWA installée sur Android avec le `theme_color` du manifeste : à #FFFFFF, elle restait blanche sous la barre basse sombre. Sans `theme_color`, elle suit le réglage clair ou sombre du système, pas un thème forcé dans le profil. Dans `nuxt.config.ts`, la clé reste déclarée à `undefined` : absente, @vite-pwa/nuxt la remplit avec sa valeur par défaut #42b883.

## Conséquences

- CA-11 (aucune classe `dark` aux lots 1 à 3) ne s'applique plus ; un test vérifie que le thème du profil est appliqué, avec les métas correspondantes, puis que la déconnexion revient au système.
- La recette des contrastes en sombre (CA-02) est faite par la revue d'accessibilité du lot 4 (ADR 0029).
- Les composants de bascule de thème de Nuxt UI sont disponibles mais inutilisés : le choix passe par le profil.
- Un test vérifie que `theme_color` est déclaré à `undefined` dans les options du manifeste. Une PWA déjà installée sur Android ne prend le manifeste modifié qu'à sa prochaine mise à jour par Chrome ou à sa réinstallation.
