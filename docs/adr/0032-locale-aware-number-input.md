# ADR 0032 · Saisie des nombres selon la langue

Statut : acceptée, amendée le 21 novembre 2026 (champs alignés à gauche) · 21 novembre 2026 · Exigences : NF-I18N-02, OPE-08, CHG-20, CHG-69, CHG-74 · Complète l'ADR 0025

## Contexte

NF-I18N-02 demande des formats de nombre et de montant selon la locale ; l'ADR 0025 l'a appliqué à l'affichage. La saisie n'était encadrée par aucune règle : CHG-69 ne fixait que l'alignement à droite, `inputmode="decimal"` et les chiffres tabulaires. L'audit de la saisie a relevé une virgule et un point acceptés tous deux comme séparateur décimal quelle que soit la langue ; aucun séparateur de milliers accepté hormis l'espace, si bien qu'en anglais `1,234.56`, le format affiché partout, était refusé ; des champs jamais reformatés, d'où des valeurs qui mêlent les deux conventions ; un parseur propre au taux, fondé sur `Number()`, qui acceptait `0x10` et `1e1` ; un montant illisible ignoré sans message dans les filtres d'opérations ; un alignement, un suffixe € et une largeur qui variaient d'un champ à l'autre. À l'affichage, les pourcentages de la répartition (CHG-74) étaient composés à la main : nombre brut d'ECharts dans l'anneau (`33.33 %` en français) et ` %` ajouté en dur dans le tableau (`33.3 %` en anglais). Contrainte relevée : sur iOS, la touche décimale du pavé ouvert par `inputmode="decimal"` dépend de la région de l'appareil, pas de la langue de Mint. Les arbitrages ci-dessous sont ceux du porteur du projet.

## Décision

- Un montant est lu dans la langue de l'interface. Le séparateur décimal `d` et le séparateur de milliers sont ceux que produit `Intl.NumberFormat` pour la locale ; `e` désigne l'autre caractère parmi la virgule et le point. Les espaces (normales, insécables, fines insécables) et le symbole € sont ignorés où qu'ils soient ; un signe `+`, `-` ou `−` est admis en tête. Ensuite :
  1. `d` présent : une seule fois, suivi de 1 ou 2 chiffres en fin de saisie ; avant lui, des chiffres seuls ou des groupes de 3 chiffres séparés par la virgule en anglais, par le point en français.
  2. Sinon, `e` présent une seule fois et suivi de 1 ou 2 chiffres en fin de saisie : il est lu comme séparateur décimal.
  3. Sinon, en anglais seulement, des virgules de milliers entre groupes de 3 chiffres, le premier groupe ne commençant pas par 0.
  4. Toute autre saisie est refusée.
- Exemples de lecture :

| Saisie       | Français             | Anglais  |
| ------------ | -------------------- | -------- |
| `1234,5`     | 1 234,50             | 1,234.50 |
| `1234.5`     | 1 234,50             | 1,234.50 |
| `1,234.56`   | refusé               | 1,234.56 |
| `1.234,56`   | 1 234,56             | refusé   |
| `1,234`      | refusé (3 décimales) | 1,234.00 |
| `1.234`      | refusé (ambigu)      | refusé   |
| `1 2 3`      | 123,00               | 123.00   |
| `1 234,56 €` | 1 234,56             | 1,234.56 |
| `€1,234.56`  | refusé               | 1,234.56 |
| `12.`, `.5`  | refusé               | refusé   |

- À la sortie du champ, une saisie lisible est réécrite par `Intl.NumberFormat` avec deux décimales et le séparateur de milliers (`1 234,56`, `1,234.56`). Une saisie illisible reste telle quelle et l'erreur s'affiche sous le champ. Le préremplissage en édition a le même format.
- Placeholder des champs de montant vides : 1 234,56 formaté par `Intl.NumberFormat` pour la locale. L'exception d'occurrence garde le montant courant de l'occurrence.
- Le taux annuel suit les mêmes règles sans séparateur de milliers : `d`, ou à défaut `e`, présent une seule fois, est le séparateur décimal, quel que soit le nombre de chiffres qui le suivent ; la précision reste contrôlée par le schéma (quatre décimales au plus, ADR 0020). À la sortie du champ, il est réécrit avec 2 à 4 décimales (`3,00`, `3,125`) ; le champ porte le suffixe `%`.
- Deux composants uniques, `AmountInput` et `RateInput` : `UInput` texte au modèle en chaîne, `inputmode="decimal"`, pleine largeur, `tabular-nums` posé sur l'élément `<input>`, suffixe `€` ou `%` au bord droit du champ. Les schémas de formulaire qui lisent un montant ou un taux reçoivent la langue de l'interface.
- Alignement (amendement du 21 novembre 2026) : le texte des champs de montant et de taux est aligné à gauche, comme celui des autres champs. Ces champs sont le plus souvent empilés ou alignés avec des champs texte, des dates et des sélecteurs, alignés à gauche ; aligné à droite, le montant était le seul à s'en écarter. Le suffixe reste au bord droit. L'alignement à droite des montants affichés en colonne (CHG-20) ne change pas.
- Filtres d'opérations : un montant minimal ou maximal illisible affiche l'erreur sous son champ ; le filtre ne s'applique pas tant qu'elle persiste.
- Pourcentages affichés : `Intl.NumberFormat` en style `percent`, jamais un `%` ajouté à la main ; `signDisplay: 'exceptZero'` pour les écarts. L'anneau de répartition et son tableau affichent une décimale.

## Écarté

- Séparateur décimal strictement celui de la langue : un iPhone réglé sur une autre région ne pourrait plus saisir de centimes.
- `UInputNumber` (Reka UI, `@internationalized/number`) pour les montants : parseur strict qui bloque la frappe du point en français, modèle en euros flottants à convertir en centimes, boutons d'incrément sans objet.
- Séparateur de milliers ajouté pendant la frappe : position du curseur, copier-coller et claviers Android à gérer, pour un gain limité au temps de la saisie.
- Champs normalisés sans séparateur de milliers : la saisie s'écarterait de l'affichage.
- Espaces admises seulement entre des groupes de 3 chiffres ; point des milliers refusé en français ; symbole € refusé.
- Placeholder `0,00`, ou aucun placeholder.
- Taux réécrit avec ses seules décimales significatives (`3`), ou sans suffixe.
- Anneau de répartition à zéro ou deux décimales.
- Champs de montant et de taux alignés à droite ; suffixe avant le montant ou supprimé ; taux resté aligné à droite.

## Conséquences

- En anglais, `1,234` et `1,234.56` sont désormais acceptés ; en français, `1.234,56` l'est aussi et `1.234` reste refusé.
- Un montant copié depuis l'affichage de Mint (`1 234,56 €`, `€1,234.56`) se colle dans un champ de la même langue.
- Une valeur saisie dans une langue n'est jamais relue dans l'autre : la langue se change sur la page Profil, qui n'a aucun champ de montant, et l'état des filtres est propre à la page Opérations.
- Les champs entiers (`UInputNumber` : intervalle, nombre d'occurrences, rappel, tolérance, cibles de répartition, lignes ignorées) gardent le parseur de Reka UI, qui suit déjà la langue ; leurs valeurs n'atteignent pas 1 000.
- L'export CSV garde son format français fixe (ADR 0022). Les compteurs insérés dans les messages (`{n}`) ne sont pas formatés.
