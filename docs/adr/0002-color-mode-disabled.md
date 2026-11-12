# ADR 0002 · Mode de couleur désactivé jusqu'au lot 4

Statut : acceptée · 12 novembre 2026 · Exigences : NF-UX-02, CHG-90, CHG-91, CHG-92, CA-11

## Contexte

Le thème sombre suivant le réglage du système (NF-UX-02) est planifié au lot 4. Nuxt UI active par défaut @nuxtjs/color-mode, qui pose la classe `dark` sur `<html>` quand le système est réglé en sombre, ce qui rendrait les lots 1 à 3 en sombre sans recette des contrastes.

## Décision

- `ui.colorMode: false` dans `front/nuxt.config.ts` : @nuxtjs/color-mode n'est pas chargé et l'application reste en clair quel que soit le réglage du système.
- Les jetons sombres sont néanmoins définis dès le lot 1 dans `front/app/assets/css/main.css`, sous le sélecteur `.dark` (CHG-90).
- Une seule méta `theme-color`, à #FFFFFF.

## Conséquences

- Aucune classe `dark` sur `<html>` aux lots 1 à 3 (CA-11).
- Les composants de bascule de thème de Nuxt UI ne sont pas enregistrés.
- Lot 4 (CHG-92) : réactiver `ui.colorMode`, ajouter les liens des écrans de démarrage sombres et la seconde méta `theme-color` `media="(prefers-color-scheme: dark)"` à #1D1D16, refaire la recette des contrastes en sombre.
