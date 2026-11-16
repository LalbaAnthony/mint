# ADR 0025 · Traduction anglaise complète

Statut : acceptée · 16 novembre 2026 · Exigences : NF-I18N-01, NF-I18N-02, CHG-77 · Complète les ADR 0015 et 0022

## Contexte

Le lot 3 demande une traduction anglaise complète (NF-I18N-01 : aucune chaîne en dur, langue réglée par profil ; NF-I18N-02 : formats selon la locale). L'audit a porté sur les fichiers de messages, les templates et le TypeScript du front, les textes produits par l'API et les bibliothèques d'interface.

## Constat

- Fichiers de messages : mêmes clés en français et en anglais, mêmes variables dans chaque message, aucun texte français resté dans l'anglais. Les valeurs identiques dans les deux langues sont voulues (« Date », « Tags », « Import », noms de produits, « Français »).
- Aucune chaîne d'interface en dur dans les templates ni dans les modules du front ; dates, nombres et montants passent par `Intl` avec la locale de l'interface.
- Textes produits par l'API dans la langue du profil : catégories par défaut et système, libellés d'ajustement et d'intérêts, notifications push, emails (invitation bilingue, ADR 0010), CSV de l'export (ADR 0022).
- Deux écarts corrigés : les composants internes de Nuxt UI (bouton de fermeture, pagination, sélecteurs) restaient en anglais, faute de locale passée à `UApp` ; les descriptions accessibles générées par ECharts (CHG-77) restaient en anglais, ECharts n'embarquant que l'anglais et le chinois.

## Décision

- `UApp` reçoit la locale Nuxt UI (`fr` ou `en`) de la langue de l'interface.
- Une locale ECharts française complète, rédigée pour Mint (« Graphique intitulé… »), est enregistrée par le module des graphiques, chargé en différé ; chaque graphique est initialisé avec `FR` ou `EN` selon la langue et se réinitialise au changement de langue.
- Un test vérifie la parité des clés, la parité des variables et l'absence d'accent français dans les messages anglais.
- Restent volontairement hors traduction : les codes techniques des valeurs énumérées dans les CSV de l'export (ADR 0022), la spécification OpenAPI, les messages des journaux, et le manifeste PWA (`lang: 'fr'`). Avant connexion, les pages publiques sont en français, sauf l'invitation, qui fait choisir la langue.

## Conséquences

- Toute nouvelle clé doit exister dans les deux fichiers, sous peine d'échec des tests.
- Les libellés de la locale ECharts française s'ajoutent au chunk des graphiques, pas au chargement initial.
