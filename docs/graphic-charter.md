# Charte graphique · Mint

Complément au cahier des charges Mint v1.1 · Version 1.1 · 11 novembre 2026

## 1. Objet et portée

Ce document fixe l'identité visuelle de Mint et sa traduction en jetons, composants et règles d'interface dans la stack imposée (CDC, section 7.1). Il précise, sans les contredire, NF-UX-01, NF-UX-02, NF-ACC-01, NF-I18N-02, NF-PWA-01, NF-SEC-02, CODE-11 et CODE-13.

- Exigences identifiées `CHG-NN`, rattachées aux lots du CDC en section 13.1.
- Emplacement dans le dépôt : `docs/graphic-charter.md` (CODE-10). Texte conforme à CODE-06 et CODE-07.
- Versions minimales : Tailwind CSS 4.2 (palettes `olive` et `mist`), Nuxt UI 4.5 (neutre `olive`).
- Chaque arbitrage du porteur est tracé dans le registre des décisions (section 13.3).

## 2. Logo

### 2.1 Fichier source fourni

Le fichier transmis est une vectorisation automatique d'une image matricielle : canevas 2400 x 1260 non carré, rectangle de fond #F8F8F8 percé, contours irréguliers, styles d'éditeur résiduels. Il est remplacé par le redessin géométrique ci-dessous. Seules ses couleurs sont conservées.

| Zone            | Hex     | Statut                                 |
| --------------- | ------- | -------------------------------------- |
| Carré arrondi   | #E7FDE6 | conservée : `mint-50`                  |
| Zone haute      | #8CC42D | conservée : `mint-400`                 |
| Zone centrale   | #66A435 | conservée : `mint-500`                 |
| Zone basse      | #3D853C | conservée : `mint-600`                 |
| Fond du canevas | #F8F8F8 | abandonnée (artefact de vectorisation) |

### 2.2 Construction

Le pictogramme se lit comme un cœur couché ou une feuille à base cordée pointant vers la droite. Deux bras (haut lime, bas vert foncé) encadrent une zone centrale vert moyen formée d'une lentille, d'un chevron et d'un losange de pointe.

Repère : unité `u`, origine au milieu du segment joignant les centres des deux lobes, axe x vers la pointe, axe y vers le bas (convention SVG).

| Élément                    | Définition                                                                                                           |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Lobe haut                  | cercle de rayon 21, centre (0, -11)                                                                                  |
| Lobe bas                   | cercle de rayon 21, centre (0, 11)                                                                                   |
| Points                     | T (0, -32), B (0, 32), R (32, 0), K (-√320 ≈ -17,889 ; 0), P (0, -10), Q (0, 10), C (10, 0), A (21, -11), D (21, 11) |
| Silhouette                 | arêtes T-R et R-B à 45°, moitiés gauches des deux lobes, creux en K                                                  |
| Zone haute (`mint-400`)    | polygone T, A, C, P, puis arc du lobe bas de P à K, puis arc du lobe haut de K à T                                   |
| Zone centrale (`mint-500`) | lentille commune aux deux lobes (x ≤ 0), triangle P, C, Q, losange C, A, R, D                                        |
| Zone basse (`mint-600`)    | symétrique de la zone haute par rapport à l'axe x                                                                    |
| Encombrement               | 53 x 64 u, centre (5,5 ; 0)                                                                                          |
| Carré d'icône (`mint-50`)  | côté 86 u, rayon d'angle 19 u, centré sur (5,5 ; 0) ; le picto occupe 74 % de sa hauteur                             |

Superposé à l'original, l'écart maximal admis est de 1 u.

### 2.3 Fichiers maîtres

Rendu en couches : silhouette complète en `mint-500`, zones haute et basse posées dessus. Aucun liseré d'anticrénelage n'apparaît entre les zones.

`front/public/logo.svg` : picto seul, fond transparent, carré.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-26.5 -32 64 64">
  <path fill="#66A435" d="M0 -32L32 0L0 32A21 21 0 0 1 -17.889 0A21 21 0 0 1 0 -32Z"/>
  <path fill="#8CC42D" d="M0 -32L21 -11L10 0L0 -10A21 21 0 0 0 -17.889 0A21 21 0 0 1 0 -32Z"/>
  <path fill="#3D853C" d="M0 32L21 11L10 0L0 10A21 21 0 0 1 -17.889 0A21 21 0 0 0 0 32Z"/>
</svg>
```

`front/public/icon.svg` : icône d'application, source des PNG (section 10).

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-37.5 -43 86 86">
  <rect x="-37.5" y="-43" width="86" height="86" rx="19" fill="#E7FDE6"/>
  <path fill="#66A435" d="M0 -32L32 0L0 32A21 21 0 0 1 -17.889 0A21 21 0 0 1 0 -32Z"/>
  <path fill="#8CC42D" d="M0 -32L21 -11L10 0L0 -10A21 21 0 0 0 -17.889 0A21 21 0 0 1 0 -32Z"/>
  <path fill="#3D853C" d="M0 32L21 11L10 0L0 10A21 21 0 0 1 -17.889 0A21 21 0 0 0 0 32Z"/>
</svg>
```

`front/public/badge.svg` : silhouette blanche monochrome, badge des notifications Android.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-26.5 -32 64 64">
  <path fill="#FFFFFF" d="M0 -32L32 0L0 32A21 21 0 0 1 -17.889 0A21 21 0 0 1 0 -32Z"/>
</svg>
```

### 2.4 Règles d'usage

| ID     | Règle                                                                                                                                                                                                                              |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CHG-01 | Les trois fichiers de la section 2.3 sont les seules sources du logo. Ce sont des assets statiques : CODE-11 vise les éléments `<svg>` écrits dans les templates Vue et le TypeScript, pas les fichiers `.svg` de `front/public/`. |
| CHG-02 | Dans l'interface, le logo est affiché par `<img src="/logo.svg">`, jamais incorporé en ligne.                                                                                                                                      |
| CHG-03 | Le carré menthe (`icon.svg`) est réservé aux icônes d'application et aux ressources PWA générées. L'interface n'affiche que le picto.                                                                                              |
| CHG-04 | Mot-symbole : texte HTML réel « Mint », Manrope 700, `tracking-tight`, couleur `text-highlighted`. Valeur issue de la clé i18n `app.name`, identique en français et en anglais (NF-I18N-01).                                       |
| CHG-05 | Couple picto et mot-symbole : picto à gauche, espacement 8 px. Barre latérale : picto 28 px, texte `text-lg`. Connexion : picto 48 px, texte `text-3xl`. En-tête mobile : picto seul 24 px.                                        |
| CHG-06 | Zone de protection : un quart de la hauteur du picto sur chaque côté. Taille minimale : 20 px dans l'interface, 16 px en favicon.                                                                                                  |
| CHG-07 | Mode sombre : picto identique. La zone basse garde au moins 3:1 sur `olive-900` et `olive-950`.                                                                                                                                    |
| CHG-08 | Interdits : déformation, rotation, recoloration, ombre, contour, dégradé, inversion des zones, picto posé sur un fond primaire, corail ou photographique.                                                                          |
| CHG-09 | Accessibilité : `alt=""` quand le mot-symbole est visible à côté ; le lien du logo vers l'accueil porte le nom accessible « Mint, accueil » (clé i18n).                                                                            |

## 3. Couleurs

### 3.1 Gamme primaire `mint`

Gamme à teinte glissante : jaune-vert dans les clairs, vert franc dans les foncés, comme les trois zones du logo.

| Nuance | Hex     | Origine | Emplois                                         |
| ------ | ------- | ------- | ----------------------------------------------- |
| 50     | #E7FDE6 | logo    | fond d'icône d'application                      |
| 100    | #D5F2C1 | dérivée |                                                 |
| 200    | #BEE393 | dérivée |                                                 |
| 300    | #A7D565 | dérivée | survol du bouton primaire en sombre             |
| 400    | #8CC42D | logo    | primaire en sombre, séries de données en sombre |
| 500    | #66A435 | logo    | zone centrale du picto                          |
| 600    | #3D853C | logo    | séries de données en clair                      |
| 700    | #2E6A30 | dérivée | primaire en clair : texte, boutons, focus       |
| 800    | #245325 | dérivée | survol du bouton primaire en clair              |
| 900    | #1C401D | dérivée |                                                 |
| 950    | #0F2511 | dérivée |                                                 |

### 3.2 Gamme d'accent `coral`

| Nuance | Hex     | Emplois                                                 |
| ------ | ------- | ------------------------------------------------------- |
| 50     | #FEF3F0 |                                                         |
| 100    | #FDE4DD | tuiles d'icône d'accent en clair                        |
| 200    | #FBC8BA | icônes de tuile en sombre                               |
| 300    | #F8A690 |                                                         |
| 400    | #F58468 | aplats : badges, compteurs, marqueurs (clair et sombre) |
| 500    | #F2704F | teinte de référence                                     |
| 600    | #DE5333 | séries de données en clair, icônes de tuile en clair    |
| 700    | #B94027 |                                                         |
| 800    | #953523 |                                                         |
| 900    | #7A2F21 | tuiles d'icône d'accent en sombre                       |
| 950    | #42150D | texte sur aplat corail                                  |

### 3.3 Neutre

`olive` (Tailwind 4.2) : gris teinté jaune-vert, utilisé pour tous les textes, bordures, surfaces et le chrome de l'interface. Équivalents sRGB des valeurs OKLCH de Tailwind, utilisés hors CSS (manifeste, écrans de démarrage, méta `theme-color`) : `olive-50` ≈ #FBFBF9, `olive-900` ≈ #1D1D16, `olive-950` ≈ #0C0C09.

### 3.4 Rôles sémantiques (CHG-10)

| Rôle      | Palette | Nuance en clair                   | Nuance en sombre | Emplois                                                                    |
| --------- | ------- | --------------------------------- | ---------------- | -------------------------------------------------------------------------- |
| primary   | mint    | 700                               | 400              | bouton principal, liens, éléments actifs, anneau de focus                  |
| secondary | coral   | 400                               | 400              | aplats d'accent uniquement (section 3.6)                                   |
| success   | emerald | 700                               | 400              | crédits, confirmations                                                     |
| info      | sky     | 700                               | 400              | messages informatifs, hors ligne, nouvelle version                         |
| warning   | amber   | 700                               | 400              | seuil d'alerte, enveloppe au-delà de 80 %, plafond, écart de rapprochement |
| error     | red     | 600                               | 400              | solde négatif, enveloppe au-delà de 100 %, erreurs, actions destructrices  |
| neutral   | olive   | défauts Nuxt UI, `text-muted` 600 | défauts Nuxt UI  | textes, bordures, surfaces ; `text-muted` relevé en clair (ADR 0029)       |

### 3.5 Surfaces (CHG-11)

| Surface                                                          | Clair          | Sombre         | Classe           |
| ---------------------------------------------------------------- | -------------- | -------------- | ---------------- |
| Fond de page (canevas)                                           | olive-50       | olive-950      | `bg-canvas`      |
| Cartes, tableaux, panneaux, barres de navigation, modales, menus | blanc          | olive-900      | `bg-default`     |
| Survol, lignes alternées                                         | défaut Nuxt UI | défaut Nuxt UI | `bg-muted`       |
| Bordures                                                         | défaut Nuxt UI | défaut Nuxt UI | `border-default` |

- Tout contenu interactif repose sur une surface `bg-default` : aucune liste ni aucun tableau directement sur le canevas, où le survol `bg-muted` serait invisible.
- Cartes : bordure 1 px, sans ombre. `shadow-lg` réservée aux éléments superposés : modales, menus, tiroirs, bouton flottant.

### 3.6 Règles d'emploi (CHG-12)

- Composants : classes sémantiques uniquement (`text-primary`, `bg-muted`, `text-success`, `bg-accent-fill`, `bg-data-needs`...). Les classes de palette brutes sont interdites hors `main.css` (contrôle automatique CHG-104).
- Un seul bouton plein (`solid`) primaire dans le contenu de chaque vue. Le bouton « Ajouter » de la barre latérale desktop (CHG-55) n'entre pas dans ce décompte. Actions secondaires en `outline` ou `ghost` neutre. Actions destructrices en `error` `soft` ou `outline`, `solid` seulement pour confirmer dans une modale.
- Liens dans le texte : `text-primary`, soulignés.
- Bouton primaire plein : survol et appui en `mint-800` (clair) et `mint-300` (sombre), à la place de l'opacité 75 % par défaut de Nuxt UI, pour conserver le contraste du libellé.
- Le corail n'est jamais une couleur de texte ni de bouton. Trois formes seulement : aplat (`bg-accent-fill` + `text-accent-on-fill`), tuile d'icône (`bg-accent-tile` + `text-accent-tile-icon`), série de données. Rôles : marqueurs du calendrier, badges et compteurs, mises en avant éditoriales (tuiles d'icône des indicateurs du tableau de bord, états vides).

### 3.7 Contrastes de référence

| Paire                             | Ratio        | Exigence couverte                                       |
| --------------------------------- | ------------ | ------------------------------------------------------- |
| mint-700 sur blanc                | 6,5:1        | texte AA                                                |
| mint-700 sur olive-50             | 6,3:1        | texte AA                                                |
| blanc sur mint-700, sur mint-800  | 6,5:1, 9,0:1 | libellé de bouton AA, au repos et au survol             |
| mint-400 sur olive-900            | 8,1:1        | texte AA en sombre                                      |
| coral-950 sur coral-400           | 6,2:1        | texte de badge AA                                       |
| coral-600 sur coral-100           | 3,2:1        | icône de tuile, élément graphique ≥ 3:1                 |
| mint-600 sur blanc                | 4,55:1       | série de données ≥ 3:1                                  |
| coral-600 sur blanc               | 3,9:1        | série de données ≥ 3:1                                  |
| mint-600 sur olive-900            | 3,7:1        | picto en sombre ≥ 3:1                                   |
| olive-600 sur blanc, sur olive-50 | 6,9:1, 6,7:1 | `text-muted` en clair AA (ADR 0029)                     |
| olive-400 sur olive-900           | 7,3:1        | `text-muted` en sombre AA                               |
| olive-500 sur blanc               | 4,3:1        | motif du relèvement de `text-muted` en clair            |
| #3D853C sur olive-50              | 4,4:1        | motif du rejet de la nuance 600 comme primaire en clair |

Les paires impliquant les palettes Tailwind (emerald-700, sky-700, amber-700, red-600 sur blanc et sur olive-50) sont vérifiées en recette (CA-02).

## 4. Couleurs de données

### 4.1 Montants (CHG-20)

| Élément                                                        | Couleur            | Signe et marqueur           |
| -------------------------------------------------------------- | ------------------ | --------------------------- |
| Flux crédit (opération, occurrence, revenu, transfert entrant) | `text-success`     | « + » toujours affiché      |
| Flux débit                                                     | `text-default`     | « − »                       |
| Solde au-dessus du seuil (ou sans seuil) et positif            | `text-highlighted` | aucun                       |
| Solde sous le seuil d'alerte et positif                        | `text-warning`     | icône `triangle-alert`      |
| Solde négatif                                                  | `text-error`       | « − », icône `circle-alert` |
| Ajustement (CPT-05)                                            | `text-muted`       | icône `scale`               |
| Écart de rapprochement non nul                                 | `text-warning`     | signe                       |
| Plus-value latente (CPT-06)                                    | `text-success`     | « + »                       |
| Moins-value latente                                            | `text-default`     | « − »                       |

- Chiffres tabulaires, alignés à droite dans les colonnes.
- Formatage par `Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' })` ; `signDisplay: 'exceptZero'` pour les flux, `'auto'` pour les soldes.
- Le caractère du signe et les espaces (insécables) sont ceux que produit `Intl.NumberFormat` pour la locale. Les signes « + » et « − » de cette section désignent le sens du montant, pas un caractère imposé. Les tests comparent à la sortie d'`Intl`, jamais à une chaîne saisie.
- Centimes affichés partout (listes, détails, soldes, totaux, cases du calendrier, indicateurs) sauf dans les graphiques : axes, étiquettes et infobulles arrondis à l'euro (`maximumFractionDigits: 0`).
- Pourcentages (répartition, plus-value latente, taux) : `Intl.NumberFormat(locale, { style: 'percent' })`, jamais un `%` ajouté à la main ; `signDisplay: 'exceptZero'` pour les écarts ; une décimale dans l'anneau de répartition et son tableau (CHG-74, ADR 0032).
- La couleur ne porte jamais seule l'information : signe, icône ou libellé l'accompagne.

### 4.2 Groupes et usages (CHG-21)

| Jeton                     | Sujet                 | Palette | Nuance clair / sombre | Icône                 |
| ------------------------- | --------------------- | ------- | --------------------- | --------------------- |
| `--data-group-needs`      | Needs (Besoins)       | blue    | 600 / 400             | `lucide:house`        |
| `--data-group-wants`      | Wants (Envies)        | coral   | 600 / 400             | `lucide:sparkles`     |
| `--data-group-save`       | Save (Épargne)        | mint    | 600 / 400             | `lucide:piggy-bank`   |
| `--data-usage-current`    | Courant               | mist    | 600 / 400             | `lucide:credit-card`  |
| `--data-usage-emergency`  | Épargne de précaution | teal    | 600 / 400             | `lucide:shield-check` |
| `--data-usage-savings`    | Épargne               | mint    | 600 / 400             | `lucide:piggy-bank`   |
| `--data-usage-investment` | Investissement        | violet  | 600 / 400             | `lucide:trending-up`  |

- Dans l'interface (vue « Où est mon argent », légendes, listes) : pastille ronde de 10 px dans la couleur du jeton, libellé en `text-default`.
- Save et Épargne partagent volontairement `mint` : le groupe Save mesure les flux vers les comptes d'épargne (CAT-03).

### 4.3 Catégories (CHG-22)

Dans le détail d'un groupe (DSH-02), chaque catégorie prend une nuance de la palette de son groupe, attribuée dans l'ordre d'affichage (`sort_order`).

| Mode   | Ordre des nuances                      |
| ------ | -------------------------------------- |
| Clair  | 600, 400, 800, 300, 700, 500, 900, 200 |
| Sombre | 400, 600, 300, 700, 200, 500, 800, 100 |

Au-delà de 8 catégories, la séquence reprend avec un motif hachuré. Chaque segment porte une étiquette (nom, pourcentage).

Exception assumée au seuil de 3:1 de la section 3.7 : plusieurs nuances de la séquence restent sous 3:1 sur la surface (en clair, les nuances 200 à 400 et `coral-500` ; en sombre, les nuances 700 et 800). L'information ne repose jamais sur la seule couleur : chaque segment porte son étiquette et le tableau équivalent de CHG-77 reste disponible.

### 4.4 Flux et soldes (CHG-23)

| Jeton              | Sujet                 | Palette | Nuance clair / sombre |
| ------------------ | --------------------- | ------- | --------------------- |
| `--data-income`    | revenus               | emerald | 600 / 400             |
| `--data-expense`   | dépenses              | olive   | 500 / 400             |
| `--data-net`       | solde mensuel (ligne) | olive   | 800 / 200             |
| `--data-balance`   | courbe de solde       | mint    | 600 / 400             |
| `--data-threshold` | seuil d'alerte        | amber   | 600 / 400             |
| `--data-negative`  | zone négative         | red     | 600 / 400             |

### 4.5 Réel et prévisionnel (CHG-24)

| Forme              | Réel                                            | Prévisionnel                           |
| ------------------ | ----------------------------------------------- | -------------------------------------- |
| Ligne              | pleine, 2 px                                    | pointillée (6, 4), 2 px                |
| Aire sous la ligne | opacité 12 %                                    | opacité 6 %                            |
| Barre              | pleine                                          | hachures diagonales de la même couleur |
| Séparation         | trait vertical neutre pointillé « Aujourd'hui » |                                        |
| Légende            | entrée « Réel »                                 | entrée « Prévu »                       |

### 4.6 Répartition des teintes

| Famille | Rôles                                                         |
| ------- | ------------------------------------------------------------- |
| mint    | marque, primaire, groupe Save, usage Épargne, courbe de solde |
| emerald | succès, crédits, revenus                                      |
| teal    | usage Épargne de précaution                                   |
| sky     | info                                                          |
| blue    | groupe Needs                                                  |
| mist    | usage Courant                                                 |
| violet  | usage Investissement                                          |
| coral   | accent, groupe Wants                                          |
| amber   | warning, seuil                                                |
| red     | error, négatif                                                |
| olive   | neutre, dépenses                                              |

## 5. Typographie (CHG-30)

- Police unique : Manrope (variable), auto-hébergée par @nuxt/fonts, déclarée dans `--font-sans`. Graisses 400, 500, 600, 700, 800 ; sous-ensemble latin ; pile de secours `ui-sans-serif, system-ui, sans-serif`.
- Chiffres tabulaires (`tabular-nums`) sur tout montant, solde, pourcentage, date en colonne et numéro de jour du calendrier. Recette : le fichier de police servi conserve la fonctionnalité `tnum` ; à défaut, Manrope passe par le fournisseur `fontsource` de @nuxt/fonts.
- Taille minimale : 12 px. Casse de phrase pour titres, boutons et menus ; capitales réservées aux sigles (PEA, LEP, CSV).

| Rôle                                                             | Classe      | Graisse |
| ---------------------------------------------------------------- | ----------- | ------- |
| Mot-symbole (barre latérale)                                     | `text-lg`   | 700     |
| Mot-symbole (connexion)                                          | `text-3xl`  | 700     |
| Titre de vue (barre supérieure)                                  | `text-lg`   | 600     |
| Titre de carte ou de section                                     | `text-base` | 600     |
| Corps, cellules, champs                                          | `text-sm`   | 400     |
| Libellés de champ, légendes                                      | `text-sm`   | 500     |
| Aides, métadonnées, cases du calendrier, libellés de barre basse | `text-xs`   | 500     |
| Indicateur principal (patrimoine, solde)                         | `text-3xl`  | 700     |
| Indicateur secondaire                                            | `text-xl`   | 600     |

## 6. Formes, densité, icônes, mouvement

| ID     | Règle                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CHG-40 | `--ui-radius: 0.5rem`, rayons des composants dérivés par Nuxt UI. Bouton flottant, compteurs et pastilles : `rounded-full`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| CHG-41 | Taille par défaut des composants : `md`, identique sur mobile et desktop. Cibles tactiles d'au moins 44 x 44 px dans la barre basse et pour les boutons d'icône sur mobile ; bouton flottant de 56 px.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| CHG-42 | Icônes : collection Lucide (`@iconify-json/lucide`, dépendance de développement), embarquées dans le bundle client, aucune requête réseau (section 12.3). Tailles : 16 px en ligne (`size-4`), 20 px dans la barre latérale et les boutons (`size-5`), 24 px dans la barre basse (`size-6`), 32 px dans les états vides (`size-8`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| CHG-43 | Mouvement : transitions de couleur Nuxt UI par défaut ; aucune animation décorative, aucun compteur animé. `prefers-reduced-motion: reduce` désactive l'animation des graphiques.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| CHG-44 | Correspondance des icônes métier (tableau ci-dessous), centralisée dans un module unique de constantes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| CHG-45 | Mode masqué (DSH-05, ADR 0031). Bouton : icône seule `ghost` neutre dans l'en-tête de toutes les vues (CHG-51, CHG-56), entre les actions de vue et la cloche de notifications, cible tactile de 44 px sur mobile (CHG-41) ; icône `eye` quand les montants sont visibles, `eye-off` quand ils sont masqués ; nom accessible fixe « Masquer les montants », état porté par `aria-pressed`, infobulle. Montant masqué : `****` de longueur fixe, sans symbole €, précédé du signe de CHG-20 ; couleur et icône d'état conservées ; restitué aux lecteurs d'écran par « montant masqué ». Graphiques : forme visible ; graduations de l'axe des montants, infobulles, annotation du minimum et total de l'anneau en `****` ; description ARIA générée remplacée par « Graphique dont les montants sont masqués. » ; tableau équivalent (CHG-77) masqué. Pourcentages et remplissage des barres d'enveloppe restent visibles. |

| Sujet            | Icône              | Sujet                       | Icône              |
| ---------------- | ------------------ | --------------------------- | ------------------ |
| Accueil          | `layout-dashboard` | Dépense                     | `arrow-up-right`   |
| Comptes          | `wallet`           | Revenu                      | `arrow-down-left`  |
| Calendrier       | `calendar-days`    | Transfert                   | `arrow-left-right` |
| Opérations       | `receipt`          | Mode Manuel                 | `hand`             |
| Plus             | `ellipsis`         | Abonnement                  | `repeat`           |
| Échéances        | `calendar-clock`   | Sous le seuil               | `triangle-alert`   |
| Abonnements      | `repeat`           | Négatif                     | `circle-alert`     |
| Enveloppes       | `mail`             | Non confirmée par la banque | `circle-dashed`    |
| Import           | `file-up`          | Rapprochée                  | `link`             |
| Règles           | `wand-sparkles`    | À catégoriser               | `tag`              |
| Notifications    | `bell`             | Origine manuelle            | `pencil`           |
| Profil           | `circle-user`      | Ajustement                  | `scale`            |
| Administration   | `shield`           | Hors ligne                  | `wifi-off`         |
| Ajouter          | `plus`             | Recharger                   | `refresh-cw`       |
| Passkey          | `key-round`        | Afficher les données        | `table`            |
| Déconnexion      | `log-out`          | Montants visibles           | `eye`              |
| Montants masqués | `eye-off`          | Rechercher                  | `search`           |

## 7. Mise en page et navigation

| ID     | Règle                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CHG-50 | Bascule à 1024 px (`lg`). En dessous : en-tête, barre basse, bouton flottant. Au-dessus : barre latérale.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| CHG-51 | En-tête mobile : 56 px, `bg-default`, bordure basse. Picto 24 px (lien vers l'accueil), titre de vue ; à droite, actions de vue et cloche de notifications avec compteur corail (NOTIF-04).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| CHG-52 | Barre basse : 64 px + `env(safe-area-inset-bottom)`, `bg-default`, bordure haute. Entrées : Accueil, Comptes, Calendrier, Opérations, Plus. Icône 24 px et libellé `text-xs` toujours visibles. Entrée active : icône et libellé `text-primary`, pastille `bg-primary/10` derrière l'icône. Inactive : `text-muted`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| CHG-53 | « Plus » ouvre un tiroir bas (`UDrawer`) : Échéances, Abonnements, Enveloppes, Import, Règles, Profil et préférences, Administration (administrateur seulement), Déconnexion.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| CHG-54 | Bouton flottant mobile : 56 px, `rounded-full`, `bg-primary`, icône `plus` en `text-inverted`, `shadow-lg`, à 16 px du bord droit, `bottom: calc(64px + 16px + env(safe-area-inset-bottom))`. Ouvre un tiroir : Dépense, Revenu, Transfert. Masqué sur les formulaires plein écran, désactivé hors ligne. Seul bouton plein primaire de la vue sur mobile. Recherche globale (RCH-01, ADR 0034) : bouton de 56 px, `rounded-full`, `soft` neutre, icône `search`, `shadow-lg`, à 16 px du bord droit et 16 px au-dessus du bouton flottant, `bottom: calc(64px + 16px + 56px + 16px + env(safe-area-inset-bottom))` ; ouvre la modale de recherche ; masqué comme le bouton flottant et sur la page de résultats, désactivé hors ligne.                                                                                                                                                         |
| CHG-55 | Desktop : `UDashboardGroup` et `UDashboardSidebar` repliable (256 px dépliée, icônes seules repliée). En tête : picto 28 px et « Mint », puis déclencheur de la recherche globale (RCH-01, ADR 0034), groupe accolé pleine largeur d'un bouton `outline` neutre en forme de champ (« Rechercher… » en `text-muted`) et d'un bouton `soft` neutre à l'icône `search`, qui ouvrent la modale de recherche (repliée : bouton d'icône `soft` neutre seul, avec infobulle ; désactivé hors ligne), puis bouton plein primaire « Ajouter » pleine largeur avec menu Dépense, Revenu, Transfert. Navigation : Accueil, Comptes, Calendrier, Opérations ; séparateur ; Échéances, Abonnements, Enveloppes ; séparateur ; Import, Règles. Pied : Profil, qui ouvre un menu (`UDropdownMenu`) « Profil et préférences » et « Déconnexion » (icône `log-out`) ; Administration (administrateur seulement). |
| CHG-56 | Contenu desktop : `UDashboardPanel` et `UDashboardNavbar` (titre de vue à gauche ; actions et cloche de notifications à droite). Sur toutes les tailles, les actions de vue sont en `soft` primaire ; le plein est réservé au bouton d'ajout et à la validation des formulaires et modales.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| CHG-57 | Grilles : indicateurs du tableau de bord sur 1 colonne sous 768 px, 2 à partir de 768 px, 4 à partir de 1280 px. Formulaires limités à `max-w-2xl`. Opérations : `UTable` à partir de 1024 px ; en dessous, liste en lignes (libellé et catégorie à gauche, montant à droite).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| CHG-58 | Toasts : en haut au centre sous 1024 px (le bas est occupé par la barre basse et le bouton flottant), en bas à droite au-dessus.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| CHG-59 | Écran de connexion : canevas, carte centrée `max-w-sm`, picto 48 px et « Mint » `text-3xl` au-dessus de la carte. Bouton « Se connecter avec une passkey » en `outline` neutre avec icône `key-round` ; validation du mot de passe en plein primaire.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

## 8. Composants métier

| ID     | Règle                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CHG-60 | Composant unique `MoneyAmount` pour tout affichage de montant : formatage, couleur, signe, `tabular-nums` et icône d'état selon CHG-20. Types de ses props dans `front/types/` (CODE-08).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| CHG-61 | Badges et statuts : tableau ci-dessous.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| CHG-62 | Calendrier, grille complète (768 px et plus) : numéro du jour `text-xs` 500 en haut à gauche, en `text-muted` les samedis, dimanches et jours fériés (ECH-06, ADR 0029) ; occurrences (libellé tronqué, montant signé selon CHG-20, marqueurs corail Manuel et abonnement) ; solde de fin de journée en bas à droite, `text-xs` 600 tabulaire. Jour passé : « n opérations » et total en `text-muted`, solde réel. Sous le seuil : fond `bg-warning/10`, solde `text-warning`, icône `triangle-alert`. Négatif : fond `bg-error/10`, solde `text-error`, icône `circle-alert` ; le négatif prime. Aujourd'hui : numéro dans une pastille `bg-primary text-inverted`. Jour sélectionné : `ring-2 ring-primary`. Jours hors du mois : numéro `text-muted`, sans contenu ; un clic affiche leur mois et y sélectionne le jour, sauf pour un mois hors de la navigation (CAL-01), dont les jours ne sont pas cliquables. Sur écran tactile, quelle que soit la largeur, un balayage horizontal de la carte du mois (en-tête et grille) passe au mois suivant vers la gauche, au précédent vers la droite, sans animation (CHG-43) ; un balayage vertical, interrompu ou au-delà de la navigation est sans effet.                                                                                                                                                                                                                                                                                                                                                                                                         |
| CHG-63 | Calendrier compact (moins de 768 px, CAL-06) : numéro du jour et jusqu'à 3 points de 6 px : `success` (crédit), neutre (débit), corail (paiement manuel à déclencher). Teintes d'alerte de case, jours hors du mois et balayage identiques à CHG-62. Détail du jour sélectionné sous la grille.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| CHG-64 | Enveloppes (ENV-06) : `UProgress` de 8 px, `primary` jusqu'à 80 % inclus, `warning` au-delà de 80 %, `error` au-delà de 100 % (barre plafonnée à 100 %, dépassement chiffré en `text-error`). Lignes : consommé sur budget, disponible (règles de solde de CHG-20), disponible par jour restant.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| CHG-65 | Bandeau du tableau de bord (DSH-04) : quatre cartes. Patrimoine total (`text-3xl`, tuile d'icône d'accent avec `wallet`) ; alertes actives (icône `triangle-alert` en `text-warning` ; lot 2 : comptes dont le solde prévisionnel passe sous le seuil dans les 7 prochains jours, PRV-07 ; lot 3 : s'y ajoutent les dépassements de plafond, LIV-02) ; opérations à catégoriser et propositions de rapprochement (compteurs corail).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| CHG-66 | États vides : tuile ronde de 64 px `bg-accent-tile`, icône Lucide de 32 px `text-accent-tile-icon`, titre `text-base` 600, phrase `text-sm text-muted`, bouton `soft` primaire. Aucune illustration.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| CHG-67 | Centre de notifications (NOTIF-04) : `low_balance` et `deposit_cap` avec icône `triangle-alert` en `text-warning` ; `manual_reminder` avec pastille corail `hand`. Non lue : point corail de 8 px et titre en 600. Lue : titre en 400, `text-toned`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| CHG-68 | Hors ligne (NF-PWA-02) : `UAlert` `info` `soft` fixé sous l'en-tête, icône `wifi-off`, texte « Hors ligne : données du » suivi de la date et de l'heure ; actions d'écriture `disabled` avec infobulle. Nouvelle version (NF-PWA-04) : toast `info` persistant, action « Recharger » avec icône `refresh-cw`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| CHG-69 | Formulaires : libellés toujours visibles au-dessus des champs ; erreurs en `text-error` sous le champ, avec icône. Champs de montant et de taux par les composants uniques `AmountInput` et `RateInput` (ADR 0032, types de leurs props dans `front/types/`, CODE-08) : pleine largeur, `inputmode="decimal"`, texte aligné à gauche comme les autres champs, chiffres tabulaires sur l'élément `<input>`, suffixe `€` ou `%` au bord droit ; placeholder des montants formaté par `Intl.NumberFormat` (`1 234,56` en français) ; saisie lue selon la langue, séparateur décimal de l'autre convention toléré, réécrite par `Intl.NumberFormat` à la sortie du champ. L'anneau de focus de Nuxt UI n'est jamais supprimé. Focus initial : à l'apparition d'un formulaire (ouverture d'une modale, affichage d'une page ou d'une étape), le premier champ sans valeur dans l'ordre du document reçoit le focus, en création comme en édition et sur toutes les tailles d'écran. Un champ est sans valeur quand sa valeur dans l'état du formulaire est une chaîne vide, `null`, `undefined` ou une liste vide ; les champs pré-remplis, selects compris, et les champs désactivés sont passés. Dans les Préférences du profil, l'entrée « Aucun » du compte par défaut est une valeur choisie : ce champ est passé (ADR 0033). Les valeurs par défaut posées après un chargement sont attendues avant le choix. Sans champ vide, le focus reste celui de Nuxt UI. Un champ apparu après le formulaire ne prend pas le focus. Composant `AppForm` autour de `UForm`, types de ses props dans `front/types/` (CODE-08). |

| Statut                                   | Rendu                                                                                       |
| ---------------------------------------- | ------------------------------------------------------------------------------------------- |
| À catégoriser (OPE-04)                   | badge plein `secondary` (aplat corail), icône `tag`                                         |
| Compteurs (en-tête, navigation, bandeau) | pastille pleine `secondary`, `rounded-full`, `text-xs` 600                                  |
| Non confirmée par la banque (EXE-05)     | badge `outline` neutre, icône `circle-dashed`                                               |
| Rapprochée                               | icône `link` en `text-muted`, infobulle                                                     |
| Origine (OPE-03)                         | icône `text-muted` : `pencil` (manuelle), `file-up` (import), `calendar-clock` (échéance)   |
| Ajustement                               | badge `soft` neutre, icône `scale`                                                          |
| Dépasse le plafond (LIV-02)              | badge `soft` `warning`, icône `triangle-alert`, texte « dépasse le plafond de 50 € »        |
| Archivé                                  | badge `soft` neutre                                                                         |
| Mode Manuel, abonnement                  | pastille corail de 20 px, icône `hand` ou `repeat` en `text-accent-on-fill`, nom accessible |

## 9. Graphiques ECharts

| ID     | Règle                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CHG-70 | Rendu SVG : `SVGRenderer` importé à la carte, `init-options` `{ renderer: 'svg' }`. Texte net, mémoire réduite sur mobile, chiffres tabulaires hérités du CSS. Les `<svg>` produits à l'exécution ne relèvent pas de CODE-11, qui vise le code source.                                                                                                                                                                                         |
| CHG-71 | Thème construit à l'exécution par un module unique (`front/app/charts/theme.ts`, types dans `front/types/`) : lecture des jetons `--data-*`, `--ui-text-muted`, `--ui-border-muted`, `--ui-border`, `--ui-bg`, `--ui-text` ; conversion en hex sRGB par un canevas 1 x 1 hors écran (les calculs de couleur d'ECharts ne gèrent pas OKLCH) ; police Manrope 12 px. Reconstruit au changement de mode de couleur.                               |
| CHG-72 | Axes : libellés `--ui-text-muted` 12 px, lignes de grille `--ui-border-muted`, pas de cadre. Infobulle : fond `--ui-bg`, bordure `--ui-border`, texte `--ui-text`, montants arrondis à l'euro. Légende en bas, marqueurs ronds.                                                                                                                                                                                                                |
| CHG-73 | DSH-01 : courbe `--data-balance` ; 30 jours réels en trait plein, horizon en pointillé (CHG-24). `visualMap` par morceaux : sous 0 en `--data-negative`, entre 0 et le seuil en `--data-threshold`, au-dessus en `--data-balance`. Seuil et ligne de seuil pointillée affichés seulement quand un compte est sélectionné (le seuil est propre au compte). Point minimal annoté (date, montant). Hauteur 240 px sous 1024 px, 320 px au-dessus. |
| CHG-74 | DSH-02 : anneau des groupes (`--data-group-*`), total au centre ; tableau voisin : part réelle, part cible (CAT-06), écart. Écart défavorable (Needs ou Wants au-dessus de la cible, Save en dessous) en `text-warning`. Clic sur Needs ou Wants : anneau des catégories (CHG-22).                                                                                                                                                             |
| CHG-75 | DSH-03 : barres groupées revenus et dépenses (`--data-income`, `--data-expense`), ligne de solde mensuel `--data-net`. Mois prévus hachurés, séparés des mois réels par le trait « Aujourd'hui ».                                                                                                                                                                                                                                              |
| CHG-76 | CPT-06 : courbe des valorisations en `--data-usage-investment`, points de valorisation marqués.                                                                                                                                                                                                                                                                                                                                                |
| CHG-77 | Accessibilité : `aria.enabled: true` (description générée) ; `aria.decal.show: true`, `decal: 'none'` sur les séries réelles, hachure explicite sur les séries ou données prévues. Bouton « Afficher les données » (icône `table`) révélant un tableau équivalent sous chaque graphique (NF-ACC-01). Animation de 300 ms, nulle avec `prefers-reduced-motion`.                                                                                 |

## 10. PWA

| ID     | Règle                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CHG-80 | Ressources générées par le CLI de `@vite-pwa/assets-generator` (dépendance de développement du paquet `front`), PNG versionnés, régénérés à la main quand le logo change.                                                                                                                                                                                                                                                                                                 |
| CHG-81 | Trois configurations exécutées dans l'ordre suivant ; les fichiers homonymes sont écrasés par la dernière exécution : écrans de démarrage depuis `logo.svg`, badge depuis `badge.svg`, icônes depuis `icon.svg`.                                                                                                                                                                                                                                                          |
| CHG-82 | Icônes : `favicon.ico` 48 px ; `pwa-64x64`, `pwa-192x192`, `pwa-512x512` (carré menthe visible) ; `maskable-icon-512x512` (fond plein `mint-50`, picto dans la zone sûre) ; `apple-touch-icon-180x180` (fond plein `mint-50`). Favicon vectoriel : `logo.svg`.                                                                                                                                                                                                            |
| CHG-83 | Écrans de démarrage iOS : picto centré, environ 30 % de la plus petite dimension (padding 0,7, ajusté au contrôle visuel), fond #FBFBF9 (olive-50) en clair et #0C0C09 (olive-950) en sombre, portrait et paysage, tous appareils. Liens `apple-touch-startup-image` clairs au lot 1, sombres au lot 4.                                                                                                                                                                   |
| CHG-84 | Manifeste : `name` et `short_name` « Mint », `display: standalone`, `background_color` #FBFBF9 (fond de page), aucun `theme_color`, pour que la barre de navigation Android d'une PWA installée suive le système (ADR 0028). Méta `theme-color` #FFFFFF ; au lot 4, ajout d'une méta `media="(prefers-color-scheme: dark)"` à #1D1D16 (olive-900), placée avant la méta claire ; avec un thème forcé dans le profil, les deux prennent la couleur de ce thème (ADR 0028). |
| CHG-85 | Notifications push (NOTIF-07) : `icon` = `pwa-192x192.png`, `badge` = `badge-96x96.png`.                                                                                                                                                                                                                                                                                                                                                                                  |

Script dans `front/package.json` :

```json
{
  "scripts": {
    "pwa:assets": "pwa-assets-generator -c pwa-assets.splash.config.ts && pwa-assets-generator -c pwa-assets.badge.config.ts && pwa-assets-generator -c pwa-assets.icons.config.ts"
  }
}
```

`front/pwa-assets.splash.config.ts` :

```ts
import {
  createAppleSplashScreens,
  defineConfig,
} from '@vite-pwa/assets-generator/config'

export default defineConfig({
  preset: {
    transparent: { sizes: [] },
    maskable: { sizes: [] },
    apple: { sizes: [] },
    appleSplashScreens: createAppleSplashScreens({
      padding: 0.7,
      resizeOptions: { background: '#FBFBF9', fit: 'contain' },
      darkResizeOptions: { background: '#0C0C09', fit: 'contain' },
      linkMediaOptions: {
        log: true,
        addMediaScreen: true,
        basePath: '/',
        xhtml: false,
      },
    }),
  },
  images: ['public/logo.svg'],
})
```

`front/pwa-assets.badge.config.ts` :

```ts
import { defineConfig } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  preset: {
    transparent: { sizes: [96], padding: 0 },
    maskable: { sizes: [] },
    apple: { sizes: [] },
    assetName: (_type, size) => `badge-${size.width}x${size.height}.png`,
  },
  images: ['public/badge.svg'],
})
```

`front/pwa-assets.icons.config.ts` :

```ts
import {
  defineConfig,
  minimal2023Preset,
} from '@vite-pwa/assets-generator/config'

export default defineConfig({
  headLinkOptions: {
    preset: '2023',
    resolveSvgName: () => 'logo.svg',
  },
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    maskable: {
      ...minimal2023Preset.maskable,
      resizeOptions: { background: '#E7FDE6' },
    },
    apple: {
      ...minimal2023Preset.apple,
      resizeOptions: { background: '#E7FDE6' },
    },
  },
  images: ['public/icon.svg'],
})
```

## 11. Mode sombre

| ID     | Règle                                                                                                                                                                                                                                                          |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CHG-90 | Jetons sombres définis dès le lot 1 (sections 3, 4 et 12.1).                                                                                                                                                                                                   |
| CHG-91 | Jusqu'au lot 4 : `ui.colorMode: false`. L'application reste en clair quel que soit le réglage du système.                                                                                                                                                      |
| CHG-92 | Lot 4 : `ui.colorMode` réactivé (suit le système par défaut, NF-UX-02 ; thème Système, Clair ou Sombre choisi dans le profil, ADR 0028), liens des écrans de démarrage sombres et méta `theme-color` sombre ajoutés, recette des contrastes refaite en sombre. |

## 12. Implémentation

### 12.1 `front/app/assets/css/main.css` (CHG-100)

```css
@import 'tailwindcss';
@import '@nuxt/ui';

@theme static {
  --font-sans: 'Manrope', ui-sans-serif, system-ui, sans-serif;

  --color-mint-50: #e7fde6;
  --color-mint-100: #d5f2c1;
  --color-mint-200: #bee393;
  --color-mint-300: #a7d565;
  --color-mint-400: #8cc42d;
  --color-mint-500: #66a435;
  --color-mint-600: #3d853c;
  --color-mint-700: #2e6a30;
  --color-mint-800: #245325;
  --color-mint-900: #1c401d;
  --color-mint-950: #0f2511;

  --color-coral-50: #fef3f0;
  --color-coral-100: #fde4dd;
  --color-coral-200: #fbc8ba;
  --color-coral-300: #f8a690;
  --color-coral-400: #f58468;
  --color-coral-500: #f2704f;
  --color-coral-600: #de5333;
  --color-coral-700: #b94027;
  --color-coral-800: #953523;
  --color-coral-900: #7a2f21;
  --color-coral-950: #42150d;
}

@theme inline {
  --color-canvas: var(--app-canvas);
  --color-accent-fill: var(--app-accent-fill);
  --color-accent-on-fill: var(--app-accent-on-fill);
  --color-accent-tile: var(--app-accent-tile);
  --color-accent-tile-icon: var(--app-accent-tile-icon);
  --color-data-needs: var(--data-group-needs);
  --color-data-wants: var(--data-group-wants);
  --color-data-save: var(--data-group-save);
  --color-data-current: var(--data-usage-current);
  --color-data-emergency: var(--data-usage-emergency);
  --color-data-savings: var(--data-usage-savings);
  --color-data-investment: var(--data-usage-investment);
  --color-data-income: var(--data-income);
  --color-data-expense: var(--data-expense);
}

:root {
  --ui-radius: 0.5rem;
  --ui-primary: var(--ui-color-primary-700);
  --ui-secondary: var(--ui-color-secondary-400);
  --ui-success: var(--ui-color-success-700);
  --ui-info: var(--ui-color-info-700);
  --ui-warning: var(--ui-color-warning-700);
  --ui-error: var(--ui-color-error-600);
  --ui-text-muted: var(--ui-color-neutral-600);

  --app-canvas: var(--ui-color-neutral-50);
  --app-primary-hover: var(--ui-color-primary-800);
  --app-accent-fill: var(--ui-color-secondary-400);
  --app-accent-on-fill: var(--ui-color-secondary-950);
  --app-accent-tile: var(--ui-color-secondary-100);
  --app-accent-tile-icon: var(--ui-color-secondary-600);

  --data-group-needs: var(--color-blue-600);
  --data-group-wants: var(--ui-color-secondary-600);
  --data-group-save: var(--ui-color-primary-600);
  --data-usage-current: var(--color-mist-600);
  --data-usage-emergency: var(--color-teal-600);
  --data-usage-savings: var(--ui-color-primary-600);
  --data-usage-investment: var(--color-violet-600);
  --data-income: var(--color-emerald-600);
  --data-expense: var(--ui-color-neutral-500);
  --data-net: var(--ui-color-neutral-800);
  --data-balance: var(--ui-color-primary-600);
  --data-threshold: var(--color-amber-600);
  --data-negative: var(--color-red-600);

  --data-needs-1: var(--color-blue-600);
  --data-needs-2: var(--color-blue-400);
  --data-needs-3: var(--color-blue-800);
  --data-needs-4: var(--color-blue-300);
  --data-needs-5: var(--color-blue-700);
  --data-needs-6: var(--color-blue-500);
  --data-needs-7: var(--color-blue-900);
  --data-needs-8: var(--color-blue-200);
  --data-wants-1: var(--ui-color-secondary-600);
  --data-wants-2: var(--ui-color-secondary-400);
  --data-wants-3: var(--ui-color-secondary-800);
  --data-wants-4: var(--ui-color-secondary-300);
  --data-wants-5: var(--ui-color-secondary-700);
  --data-wants-6: var(--ui-color-secondary-500);
  --data-wants-7: var(--ui-color-secondary-900);
  --data-wants-8: var(--ui-color-secondary-200);
}

.dark {
  --ui-primary: var(--ui-color-primary-400);
  --ui-secondary: var(--ui-color-secondary-400);
  --ui-success: var(--ui-color-success-400);
  --ui-info: var(--ui-color-info-400);
  --ui-warning: var(--ui-color-warning-400);
  --ui-error: var(--ui-color-error-400);
  --ui-text-muted: var(--ui-color-neutral-400);

  --app-canvas: var(--ui-color-neutral-950);
  --app-primary-hover: var(--ui-color-primary-300);
  --app-accent-tile: var(--ui-color-secondary-900);
  --app-accent-tile-icon: var(--ui-color-secondary-200);

  --data-group-needs: var(--color-blue-400);
  --data-group-wants: var(--ui-color-secondary-400);
  --data-group-save: var(--ui-color-primary-400);
  --data-usage-current: var(--color-mist-400);
  --data-usage-emergency: var(--color-teal-400);
  --data-usage-savings: var(--ui-color-primary-400);
  --data-usage-investment: var(--color-violet-400);
  --data-income: var(--color-emerald-400);
  --data-expense: var(--ui-color-neutral-400);
  --data-net: var(--ui-color-neutral-200);
  --data-balance: var(--ui-color-primary-400);
  --data-threshold: var(--color-amber-400);
  --data-negative: var(--color-red-400);

  --data-needs-1: var(--color-blue-400);
  --data-needs-2: var(--color-blue-600);
  --data-needs-3: var(--color-blue-300);
  --data-needs-4: var(--color-blue-700);
  --data-needs-5: var(--color-blue-200);
  --data-needs-6: var(--color-blue-500);
  --data-needs-7: var(--color-blue-800);
  --data-needs-8: var(--color-blue-100);
  --data-wants-1: var(--ui-color-secondary-400);
  --data-wants-2: var(--ui-color-secondary-600);
  --data-wants-3: var(--ui-color-secondary-300);
  --data-wants-4: var(--ui-color-secondary-700);
  --data-wants-5: var(--ui-color-secondary-200);
  --data-wants-6: var(--ui-color-secondary-500);
  --data-wants-7: var(--ui-color-secondary-800);
  --data-wants-8: var(--ui-color-secondary-100);
}

@layer base {
  body {
    background-color: var(--app-canvas);
  }

  button:not(:disabled),
  [role='button']:not(:disabled) {
    cursor: pointer;
  }
}
```

### 12.2 `front/app/app.config.ts` (CHG-101)

```ts
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'mint',
      secondary: 'coral',
      success: 'emerald',
      info: 'sky',
      warning: 'amber',
      error: 'red',
      neutral: 'olive',
    },
    button: {
      compoundVariants: [
        {
          color: 'primary',
          variant: 'solid',
          class:
            'hover:bg-(--app-primary-hover) active:bg-(--app-primary-hover)',
        },
      ],
    },
    badge: {
      compoundVariants: [
        {
          color: 'secondary',
          variant: 'solid',
          class: 'text-(--app-accent-on-fill)',
        },
      ],
    },
  },
})
```

### 12.3 `front/nuxt.config.ts`, extraits (CHG-102)

```ts
export default defineNuxtConfig({
  ssr: false,
  experimental: {
    entryImportMap: false,
  },
  css: ['~/assets/css/main.css'],
  ui: {
    colorMode: true,
  },
  icon: {
    provider: 'none',
    clientBundle: {
      scan: true,
      icons: [
        'lucide:layout-dashboard',
        'lucide:wallet',
        'lucide:calendar-days',
        'lucide:receipt',
        'lucide:ellipsis',
        'lucide:calendar-clock',
        'lucide:repeat',
        'lucide:mail',
        'lucide:file-up',
        'lucide:wand-sparkles',
        'lucide:bell',
        'lucide:circle-user',
        'lucide:shield',
        'lucide:plus',
        'lucide:arrow-up-right',
        'lucide:arrow-down-left',
        'lucide:arrow-left-right',
        'lucide:hand',
        'lucide:triangle-alert',
        'lucide:circle-alert',
        'lucide:circle-dashed',
        'lucide:link',
        'lucide:tag',
        'lucide:pencil',
        'lucide:scale',
        'lucide:wifi-off',
        'lucide:refresh-cw',
        'lucide:key-round',
        'lucide:table',
        'lucide:log-out',
        'lucide:house',
        'lucide:sparkles',
        'lucide:piggy-bank',
        'lucide:credit-card',
        'lucide:shield-check',
        'lucide:trending-up',
        'lucide:eye',
        'lucide:eye-off',
        'lucide:search',
      ],
    },
  },
  fonts: {
    defaults: {
      weights: [400, 500, 600, 700, 800],
      styles: ['normal'],
      subsets: ['latin'],
    },
  },
  app: {
    head: {
      meta: [
        {
          key: 'theme-color-dark',
          name: 'theme-color',
          media: '(prefers-color-scheme: dark)',
          content: '#1D1D16',
        },
        { key: 'theme-color', name: 'theme-color', content: '#FFFFFF' },
      ],
      link: [
        { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
        { rel: 'icon', href: '/logo.svg', sizes: 'any', type: 'image/svg+xml' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon-180x180.png' },
      ],
    },
  },
  pwa: {
    manifest: {
      name: 'Mint',
      short_name: 'Mint',
      display: 'standalone',
      theme_color: undefined,
      background_color: '#FBFBF9',
      icons: [
        { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
        { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        {
          src: 'maskable-icon-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
  },
})
```

La liste `clientBundle.icons` est complétée par les icônes internes de Nuxt UI (valeurs de `ui.icons`, collection Lucide), que le balayage automatique ne détecte pas. Un test unitaire vérifie que chaque valeur de `ui.icons` et de la table métier (CHG-44) y figure (CA-08). Les liens `apple-touch-startup-image` journalisés par le script de splash s'ajoutent à `app.head.link`, les sombres après les clairs (lot 4). `app.vue` met à jour les deux métas `theme-color` selon le thème du profil (ADR 0028).

### 12.4 CSP (CHG-103)

En-tête servi par nginx dans le conteneur `web` (CDC, section 7.2). Apache le relaie sans poser de CSP. Directives touchées par la charte :

| Directive     | Valeur                   | Motif                                                                                                      |
| ------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `script-src`  | `'self' 'sha256-...'`    | aucun `'unsafe-inline'` (NF-SEC-02) ; empreinte du seul script inline exécutable, calculée au build        |
| `style-src`   | `'self' 'unsafe-inline'` | élément `<style>` des variables de couleurs injecté par Nuxt UI, styles des icônes injectés par @nuxt/icon |
| `img-src`     | `'self' data:`           | masques CSS des icônes en `data:`                                                                          |
| `font-src`    | `'self'`                 | Manrope auto-hébergée                                                                                      |
| `connect-src` | `'self'`                 | aucune origine tierce (ni Iconify, ni Google Fonts)                                                        |

Constat sur un build Nuxt 4.6.4 en `ssr: false` : le HTML généré contient un script inline `window.__NUXT__.config` (avec un `buildId` aléatoire, donc une empreinte différente à chaque build), une import map inline et un script `application/json` de données. L'import map est supprimée par `experimental.entryImportMap: false` (section 12.3). Le script JSON n'est pas exécuté et ne relève pas de `script-src`.

Après `nuxt generate`, un script du paquet `front` calcule l'empreinte sha256 de chaque script inline exécutable de `index.html` et `200.html`, puis écrit l'en-tête complet dans la configuration nginx de l'image. Le build échoue si un script inline exécutable n'est pas couvert (CA-12).

### 12.5 Contrôle automatique des classes de palette (CHG-104)

Le script de scan de CODE-13 est étendu : dans `front/app/**/*.{vue,ts}`, toute classe Tailwind de palette brute (préfixe de couleur suivi d'un nom de palette et d'une nuance, par exemple `text-blue-600` ou `bg-coral-400`) bloque le hook pre-commit et la CI. Seul `main.css` référence les palettes.

### 12.6 ADR à rédiger (CHG-105)

Un fichier par décision dans `docs/` (CODE-10) : CSP (empreinte du script inline Nuxt calculée au build, en-tête servi par nginx, `style-src 'unsafe-inline'`, `img-src data:`) ; icônes embarquées sans fournisseur réseau ; rendu SVG d'ECharts ; mode de couleur désactivé jusqu'au lot 4.

## 13. Lots, recette, décisions

### 13.1 Rattachement aux lots

| Lot | Exigences                                                                                                                                                                                                                                                                                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | CHG-01 à CHG-12, CHG-20, CHG-21, CHG-23, CHG-24, CHG-30, CHG-40 à CHG-44, CHG-50 à CHG-59 (sans la cloche de notifications), CHG-60, CHG-61 (archivé, origine, Manuel, abonnement), CHG-62 à CHG-64, CHG-66, CHG-69, CHG-70 à CHG-73, CHG-77, CHG-80 à CHG-84 (écrans de démarrage clairs), CHG-90, CHG-91, CHG-100 à CHG-105 |
| 2   | CHG-22, CHG-61 (à catégoriser, rapprochée, non confirmée, ajustement), CHG-65, CHG-74, CHG-75                                                                                                                                                                                                                                 |
| 3   | CHG-51 et CHG-56 (cloche de notifications), CHG-61 (plafond), CHG-65 (plafonds dans les alertes actives), CHG-67, CHG-68, CHG-76, CHG-85                                                                                                                                                                                      |
| 4   | CHG-45, CHG-54 et CHG-55 (recherche globale), CHG-92                                                                                                                                                                                                                                                                          |

### 13.2 Critères d'acceptation

| ID    | Critère                                                                                                                                                                                                                                                                                                                                                                                           |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CA-01 | `logo.svg`, `icon.svg`, `badge.svg` : `viewBox` carré, aucun attribut `style` ni `transform`, couleurs strictement conformes à la section 2.3. Superposés à l'original, écart maximal de 1 u.                                                                                                                                                                                                     |
| CA-02 | Audit Lighthouse Accessibilité (outil déjà retenu par NF-PERF-04) sur connexion, accueil, comptes, calendrier, opérations et enveloppes : aucune erreur de contraste en clair, puis en sombre au lot 4, par le scénario axe de l'ADR 0029.                                                                                                                                                        |
| CA-03 | Tests Playwright en ligne puis hors ligne : aucune requête vers un domaine tiers ; icônes et police rendues hors ligne.                                                                                                                                                                                                                                                                           |
| CA-04 | Aucune violation CSP dans la console sur l'ensemble des tests de bout en bout.                                                                                                                                                                                                                                                                                                                    |
| CA-05 | `MoneyAmount` a pour style calculé `font-variant-numeric: tabular-nums`. Données de US-12 : la case du 20 affiche le débit de 50 € en couleur de texte standard et un solde de 950 € ; celle du 28 affiche le crédit de 1 500 € en `text-success` et un solde de 2 450 €. Les chaînes attendues sont produites par `Intl.NumberFormat` pour la locale du test (CHG-20), jamais saisies à la main. |
| CA-06 | Enveloppe de 300 € : 240,00 € consommés donnent `primary`, 240,01 € `warning`, 300,00 € `warning`, 300,01 € `error`.                                                                                                                                                                                                                                                                              |
| CA-07 | Calendrier, seuil de 200 € : un jour à 150 € prévus présente fond `warning` teinté, solde `text-warning` et icône ; un jour à −10,00 € présente fond `error` teinté.                                                                                                                                                                                                                              |
| CA-08 | Test unitaire : chaque valeur de `ui.icons` et de la table CHG-44 figure dans `icon.clientBundle.icons`.                                                                                                                                                                                                                                                                                          |
| CA-09 | Manifeste sans erreur dans l'onglet Application des outils de développement de Chrome ; icône maskable entièrement visible sous un masque circulaire.                                                                                                                                                                                                                                             |
| CA-10 | Un commit contenant `text-blue-600` dans un fichier `.vue` ou `.ts` de `front/app/` est rejeté par le hook pre-commit et par la CI.                                                                                                                                                                                                                                                               |
| CA-11 | Lots 1 à 3, système réglé en sombre : aucune classe `dark` sur `<html>`.                                                                                                                                                                                                                                                                                                                          |
| CA-12 | Un script inline exécutable présent dans `index.html` ou `200.html` sans empreinte dans la CSP fait échouer le build du conteneur `web`.                                                                                                                                                                                                                                                          |
| CA-13 | Tests unitaires : les exemples de lecture de l'ADR 0032 donnent le résultat indiqué en français et en anglais ; chaque montant et chaque taux formatés pour une langue sont relus à l'identique dans cette langue. Les chaînes attendues sont produites par `Intl.NumberFormat`, jamais saisies à la main (CHG-20).                                                                               |

### 13.3 Registre des décisions

| Sujet                           | Retenu                                                                                                                       | Écarté                                                                                      |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Source du logo                  | redessin géométrique                                                                                                         | nettoyage minimal, redessin externe                                                         |
| Fichiers `.svg`                 | assets autorisés, affichés par `<img>`                                                                                       | collection d'icônes, raster seul                                                            |
| Logo dans l'interface           | picto seul + mot-symbole, carré réservé aux icônes                                                                           | carré partout, picto sans texte                                                             |
| Casse                           | Mint                                                                                                                         | mint, MINT                                                                                  |
| Primaire en clair               | mint-700 dérivé                                                                                                              | mint-600 exact, Tailwind green                                                              |
| Neutre                          | olive                                                                                                                        | neutral, zinc, stone                                                                        |
| Fond clair                      | canevas olive-50, surfaces blanches                                                                                          | blanc partout, menthe pâle                                                                  |
| Accent                          | corail                                                                                                                       | aucun accent, bleu, orange, pêche, terracotta                                               |
| Rôles de l'accent               | marqueurs du calendrier, badges et compteurs, mises en avant éditoriales                                                     | boutons secondaires                                                                         |
| Success                         | emerald                                                                                                                      | gamme mint                                                                                  |
| Montants                        | crédits verts, débits neutres, rouge pour les soldes négatifs                                                                | débits rouges, tout neutre                                                                  |
| Warning, error                  | amber, red (600 en clair)                                                                                                    | yellow et red, amber et rose                                                                |
| Groupes                         | Needs bleu, Wants corail, Save mint                                                                                          | trois verts du logo, olive/corail/mint                                                      |
| Usages                          | Courant mist, Précaution teal, Épargne mint, Investissement violet                                                           | aucune couleur, dégradé de verts                                                            |
| Info                            | sky                                                                                                                          | blue, neutre                                                                                |
| Revenus, dépenses               | emerald, olive                                                                                                               | emerald et corail, emerald et rouge                                                         |
| Catégories                      | nuances du groupe                                                                                                            | palette fixe, couleur choisie par l'utilisateur                                             |
| Réel, prévu                     | plein, pointillé et hachuré                                                                                                  | opacité, couleur différente                                                                 |
| Police                          | Manrope                                                                                                                      | Inter, Plus Jakarta Sans, Geist                                                             |
| Mot-symbole                     | texte HTML, Manrope 700, `text-highlighted`                                                                                  | police display, lettrage vectorisé, vert primaire                                           |
| Rayon                           | 0,5rem                                                                                                                       | 0,25rem, 0,375rem, 0,75rem                                                                  |
| Densité                         | `md` partout                                                                                                                 | `sm` sur desktop, `lg` partout                                                              |
| Ajout rapide                    | bouton flottant (mobile), bouton « Ajouter » en tête de barre latérale (desktop)                                             | bouton central de barre, barre supérieure                                                   |
| Barre basse                     | Accueil, Comptes, Calendrier, Opérations, Plus                                                                               | variantes Enveloppes, Échéances                                                             |
| Bascule                         | 1024 px                                                                                                                      | 768 px                                                                                      |
| Barre d'état                    | fond de l'en-tête                                                                                                            | vert primaire, menthe pâle                                                                  |
| Barre de navigation Android     | suit le système, manifeste sans `theme_color` (ADR 0028)                                                                     | blanc fixe, olive-900 fixe, plein écran                                                     |
| Icônes                          | Lucide                                                                                                                       | Phosphor, Tabler                                                                            |
| Centimes                        | partout sauf graphiques                                                                                                      | partout, masqués dans les synthèses                                                         |
| États vides                     | icône, texte, action                                                                                                         | illustrations, picto Mint                                                                   |
| Ressources PWA                  | CLI, PNG versionnés                                                                                                          | intégration au build, PNG externes                                                          |
| Calendrier en alerte            | fond teinté, solde coloré, icône                                                                                             | solde seul, bordure                                                                         |
| Mode sombre                     | spécifié, forcé en clair jusqu'au lot 4                                                                                      | actif dès le lot 1, hors charte                                                             |
| Badges corail                   | aplat, texte coral-950                                                                                                       | texte corail, pastille et texte neutre                                                      |
| Écrans de démarrage iOS         | clair et sombre                                                                                                              | clair seul, aucun                                                                           |
| Picto en sombre                 | identique                                                                                                                    | variante éclaircie                                                                          |
| CSP des styles                  | `style-src 'unsafe-inline'`                                                                                                  | empreintes au build, styles extraits                                                        |
| CSP des scripts                 | empreinte sha256 calculée au build, en-tête servi par nginx                                                                  | `'unsafe-inline'`, empreinte mise à jour dans Apache, `buildId` fixe                        |
| Bouton plein sur desktop        | barre latérale hors du décompte de CHG-12                                                                                    | « Ajouter » en `soft`                                                                       |
| Déconnexion sur desktop         | menu de l'entrée Profil                                                                                                      | entrée dédiée en pied de barre, page Profil seule                                           |
| Alertes actives au lot 2        | calculées depuis la prévision (PRV-07)                                                                                       | carte reportée au lot 3                                                                     |
| Thème au lot 4                  | suit le système par défaut, choix Système, Clair ou Sombre enregistré dans le profil                                         | système seul, choix mémorisé sur l'appareil                                                 |
| Texte atténué en clair          | `text-muted` en olive-600                                                                                                    | olive-500 par défaut de Nuxt UI (4,3:1), teinte intermédiaire hors palette                  |
| Jours non ouvrés du calendrier  | `text-muted`                                                                                                                 | `text-dimmed` relevé, fond de case teinté                                                   |
| Mode masqué : rendu             | `****` avec signe, couleur et icône d'état                                                                                   | `****` neutre, `**** €` neutre                                                              |
| Mode masqué : graphiques        | forme visible, valeurs en `****`                                                                                             | axe des montants retiré, graphique remplacé par un encart                                   |
| Mode masqué : pourcentages      | visibles                                                                                                                     | masqués                                                                                     |
| Mode masqué : bouton            | avant la cloche, nom fixe et `aria-pressed`                                                                                  | après la cloche, icône inversée, nom variable                                               |
| Mode masqué : mémorisation      | par appareil, effacée à la déconnexion                                                                                       | profil serveur, onglet seulement                                                            |
| Saisie : séparateur décimal     | celui de la langue, l'autre toléré s'il est suivi de 1 ou 2 chiffres (ADR 0032)                                              | celui de la langue seul                                                                     |
| Saisie : séparateur de milliers | ajouté à la sortie du champ                                                                                                  | pendant la frappe, jamais dans les champs                                                   |
| Saisie : tolérances             | espaces partout, point des milliers en français, symbole € ignoré                                                            | espaces entre groupes de 3 seulement, point des milliers et symbole refusés                 |
| Saisie : composant              | `AmountInput` et `RateInput` sur `UInput`                                                                                    | `UInputNumber`                                                                              |
| Saisie : placeholder            | `1 234,56` formaté pour la langue                                                                                            | `0,00`, aucun                                                                               |
| Saisie : alignement             | à gauche, comme les autres champs, montants et taux ; suffixe au bord droit (ADR 0032)                                       | à droite ; suffixe avant le montant, sans suffixe                                           |
| Saisie du taux                  | 2 à 4 décimales, suffixe `%`                                                                                                 | décimales significatives seules, sans suffixe                                               |
| Pourcentages de l'anneau        | une décimale, comme le tableau                                                                                               | aucune, deux                                                                                |
| Focus initial des formulaires   | premier champ sans valeur, à l'apparition, création et édition, toutes tailles d'écran ; aucun focus sans champ vide         | premier champ, création seulement, desktop seulement, repli sur le premier champ            |
| Focus initial : détection       | état du formulaire, valeurs par défaut asynchrones attendues ; une entrée « Aucune » de select (catégorie) compte comme vide | DOM des composants Nuxt UI, suivi de l'état après le focus, ouverture différée de la modale |
| Focus initial : validation      | validation au blur inchangée, l'erreur s'affiche si le champ focalisé est quitté sans saisie                                 | blur ignoré tant que le champ n'est pas modifié                                             |
| Focus initial : « Aucun »       | « Aucun » compte par défaut compté comme une valeur (Préférences du profil), sans focus (ADR 0033)                           | « Aucun » compté comme vide, comme l'entrée « Aucune » de la catégorie                      |
| Recherche : barre latérale      | champ factice accolé à une loupe `soft` neutre, au-dessus d'« Ajouter », qui ouvre la modale (ADR 0034)                      | saisie dans la barre latérale, champ gris et bouton séparés, loupe intégrée au champ        |
| Recherche : mobile              | bouton rond de 56 px `soft` neutre au-dessus du bouton flottant                                                              | en-tête, tiroir « Plus », 48 px `outline`, pilule, desktop seulement                        |
| Recherche : résultats           | modale vide à aperçu en direct, puis page de résultats en lignes modifiable en direct                                        | modale seule, menu déroulant, tableaux à partir de 1024 px                                  |
| Recherche : résultat ouvert     | défilement et anneau intérieur `ring-2 ring-inset ring-primary` dans sa vue                                                  | focus seul, fond teinté, modale d'édition sur la page de résultats                          |
