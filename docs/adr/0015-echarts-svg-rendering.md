# ADR 0015 · Rendu SVG d'ECharts

Statut : acceptée · 15 novembre 2026 · Exigences : CHG-70 à CHG-73, CHG-77, CHG-105, CODE-11, NF-ACC-01, NF-PERF-04

## Contexte

Les graphiques du tableau de bord (DSH-01 à DSH-03) passent par ECharts via vue-echarts (section 7.1 du cahier des charges). ECharts dessine par défaut dans un canevas : texte flou au zoom, chiffres tabulaires de Manrope non hérités, mémoire plus élevée sur mobile. La charte impose le rendu SVG (CHG-70), un thème lu depuis les jetons CSS (CHG-71) et une alternative textuelle (CHG-77). CODE-11 interdit d'écrire des éléments `<svg>` dans le code source.

## Décision

- Import à la carte : `echarts/core`, le moteur `SVGRenderer`, `LineChart` et les seuls composants utilisés (grille, infobulle, légende, lignes et points de marquage, `visualMap` par morceaux, ARIA), enregistrés dans le composant qui les emploie. `init-options` vaut `{ renderer: 'svg' }`.
- Les `<svg>` sont produits à l'exécution par ECharts : ils ne relèvent pas de CODE-11, qui vise le code source.
- Thème : `front/app/charts/theme.ts` lit les jetons `--data-*`, `--ui-text-muted`, `--ui-border-muted`, `--ui-border`, `--ui-bg`, `--ui-text` sur `<html>` et les convertit en hex sRGB par un canevas 1 x 1 hors écran, car les calculs de couleur d'ECharts ne gèrent pas OKLCH. Le composable `useChartTheme` le reconstruit quand la classe de `<html>` change (bascule claire ou sombre du lot 4) et coupe l'animation sous `prefers-reduced-motion: reduce`.
- Les options sont construites par des fonctions pures (`front/app/charts/balance-curve.ts`), testées sans rendu.
- Accessibilité : `aria.enabled` et `aria.decal.show` ; la série réelle porte une hachure vide (`{ symbol: 'none' }`), la série prévue une hachure diagonale. La valeur `'none'` documentée pour `decal` fait échouer le rendu d'une série de lignes d'ECharts 6 : un motif vide la remplace. Un bouton « Afficher les données » révèle le tableau équivalent.
- Le composant du graphique est chargé en différé (`LazyBalanceCurveChart`) : le code d'ECharts, environ 590 Ko minifiés, n'entre pas dans le chargement initial de l'application.

## Conséquences

- Dépendances du paquet `front` : `echarts` et `vue-echarts`.
- Les tests de page remplacent le composant ECharts par un bouchon (`stubs: { Echarts: true }`) : sous happy-dom, le conteneur n'a pas de taille et ECharts 6 échoue dans le calcul du dégradé du `visualMap`. Le rendu réel est couvert par le scénario Playwright du calendrier et de la courbe.
- NF-PERF-04 (Lighthouse mobile au moins 85 sur le tableau de bord) reste à mesurer en recette, avec le graphique chargé.
