# ADR 0036 · Skeletons de chargement

Statut : acceptée · 22 novembre 2026 · Exigences : NF-UX-01, NF-ACC-01, NF-PWA-02, NF-PERF-04, CHG-11, CHG-30, CHG-41, CHG-43, CHG-44, CHG-45, CHG-47, CHG-48, CHG-49, CHG-57, CHG-66, CHG-73 à CHG-76 · Amende l'ADR 0015 (chargement différé des graphiques) et la charte graphique (CHG-43, CHG-44, nouvelles CHG-47 à CHG-49, rattachement aux lots, registre des décisions)

## Contexte

Les vues de Mint chargent leurs données après leur affichage (SPA, `ssr: false`). Quatre façons de faire coexistaient, sans aucun indicateur de chargement :

- Un drapeau `ready` posé après `Promise.all` (accueil, calendrier) : vue vide jusqu'à la réponse la plus lente.
- Un `v-if` sur la réponse autour de tout le contenu (comptes, enveloppes, échéances, abonnements, règles, liste des opérations) : vue vide, y compris les éléments qui ne dépendent pas des données, comme la navigation du mois des enveloppes.
- Des listes initialisées vides (administration, sessions et passkeys du profil, appareils de notification, catégories, tags, plafonds, historique d'import, modales des relevés, des valorisations, des intérêts et du détail d'échéance) : leur état vide (« Aucune invitation ») s'affichait avant les données.
- Des rechargements sur place (changement de mois, pagination, filtres, période, périmètre) : les anciennes données restaient affichées sans indicateur alors que l'en-tête annonçait déjà le nouveau contexte.

S'y ajoutaient le code d'ECharts chargé après les données, qui laissait la carte du graphique vide puis la faisait grandir de 240 ou 320 px, et l'échec d'un chargement, qui laissait la zone vide pour de bon après le toast. Le porteur du projet veut des skeletons dans toutes les vues, construits à partir de petits composants réutilisés partout, avec le moins d'écart possible entre le skeleton et le rendu final. Les arbitrages ci-dessous sont les siens.

## Décision

Rendu (CHG-47) :

- Le skeleton reproduit la mise en page du contenu qu'il remplace : mêmes cartes, grilles, lignes de liste et en-têtes de tableau, graphiques à leur hauteur.
- Barres `bg-elevated`, pulsation `animate-pulse` sous `motion-safe` seulement : seule exception à CHG-43, coupée par `prefers-reduced-motion: reduce`.
- Une ligne de texte prend la classe typographique du texte réel et une hauteur de `1lh` : sa boîte a la hauteur de ligne de la police réelle, sans valeur en pixels. La barre visible mesure 0,75em de haut, centrée. Les montants étant en chiffres tabulaires, leur largeur se prédit en `ch` : 10ch, 5ch en mode masqué pour un montant masquable. Les contrôles prennent la hauteur de leur taille Nuxt UI : 32 px en `md`, 28 px en `sm`, 44 px pour les boutons d'icône tactiles.
- Largeurs prises dans une liste fermée de classes Tailwind littérales, jamais calculées ni aléatoires : rendu stable d'un affichage à l'autre, tests stables, classes générées par Tailwind.
- Accessibilité : les barres sont `aria-hidden` ; chaque zone en chargement porte une seule région `role="status"` `aria-busy="true"` avec le texte « Chargement... » réservé aux lecteurs d'écran (clés i18n en français et en anglais).

Comportement (CHG-48) :

- Ce qui ne dépend pas des données (titres, en-têtes de carte, navigation de mois, filtres, en-têtes de tableau, grille du calendrier) s'affiche dès l'ouverture de la vue ; seul le reste passe en skeleton.
- Chaque section qui a son propre appel est remplacée dès sa réponse : sur l'accueil, le bandeau, la courbe, la répartition et le bilan mensuel n'attendent plus l'appel le plus lent.
- Le skeleton apparaît si le chargement dure plus de 150 ms et reste alors affiché au moins 300 ms. Avant 150 ms, au premier chargement, il est déjà en place mais invisible (`visibility: hidden`, ignoré des lecteurs d'écran) : il réserve la place du contenu et son apparition ne déplace rien ; ensuite, la zone garde son contenu précédent. Une réponse rapide ou une lecture du cache hors ligne (ADR 0023) ne fait rien clignoter.
- Il couvre le premier chargement et chaque changement de contexte : mois, compte ou périmètre, horizon, période, page, filtres, tri, texte recherché (après l'attente de frappe), passage en ligne ou hors ligne. Une actualisation en arrière-plan, après un enregistrement (`savedVersion`) ou dans le centre de notifications, garde le contenu affiché.
- Nombre de lignes fixe : 3 dans toutes les listes, 2 groupes de 3 comptes dans la vue Comptes.
- Un bouton d'en-tête qui dépend des données (« Réorganiser » des comptes et des règles) est affiché désactivé pendant le premier chargement, puis activé ou retiré.
- Périmètre : toutes les vues connectées, les cartes qui chargent leurs propres données (profil, administration), les modales et panneaux qui chargent des données. Les vues sans données (connexion, mot de passe oublié, réinitialisation) n'en ont pas.

Échec (CHG-49) :

- Toast `error` et, à la place de la zone, un état d'erreur au format des états vides (CHG-66) : tuile corail, icône `circle-alert`, titre « Chargement impossible », phrase, bouton `soft` primaire « Réessayer » (`refresh-cw`) qui relance le chargement de la zone. Hors ligne sans copie de la vue, même état.
- L'échec d'une actualisation en arrière-plan conserve le contenu affiché, toast seul. L'échec qui suit un changement de contexte affiche l'état d'erreur : le contenu précédent ne correspond plus à la demande.

### Mécanisme

- Primitives dans `front/app/components/skeleton/`, nommées par le préfixe de dossier de Nuxt : `SkeletonBlock` (rectangle de base, couleur, rayon, pulsation), `SkeletonText` (lignes de texte d'une classe typographique), `SkeletonAmount` (montant, suit le mode masqué), `SkeletonCircle` (pastille, icône, tuile), `SkeletonControl` (champ, bouton, bouton d'icône, case à cocher, badge) et `SkeletonZone` (région d'état accessible). Types de leurs props dans `front/types/skeleton.ts` (CODE-08). Largeurs et délais dans `front/app/utils/skeleton.ts`, hauteurs des graphiques dans `front/app/utils/layout.ts`, partagées par chaque graphique et son skeleton.
- Composants de mise en page communs, utilisés à la fois par le contenu réel et par son skeleton, pour que leurs marges, grilles et alignements ne puissent pas diverger : `StatGrid` (grilles d'indicateurs de CHG-57 en 2, 3 et 4 colonnes), `StatTile` (carte d'indicateur : libellé, valeur principale ou secondaire de CHG-30, tuile d'icône facultative), `ListRow` (ligne de liste : zone de tête, contenu, zone de fin, avec les espacements existants de chaque liste).
- Skeletons des composants complexes en composants séparés, rangés à côté de leur composant (`DashboardBannerSkeleton`, `BalanceCurveChartSkeleton`...), construits sur les mêmes composants communs.
- Composable `useLoadState` : phase affichée (`pending`, `skeleton`, `ready`, `error`), chargement en cours, `run(loader, mode)` avec `mode` `context` ou `background`, `retry()`. Il applique les délais de 150 et 300 ms, ignore une réponse dépassée par un appel plus récent et appelle le toast d'erreur de la vue. Il remplace les drapeaux `ready`, les `v-if` sur la réponse et les listes initialisées vides : « pas encore chargé » et « chargé et vide » sont distincts.
- Composant `LoadZone` : à partir de l'état d'un `useLoadState`, rend le skeleton dans une `SkeletonZone` (invisible pendant le délai d'apparition), l'état d'erreur (`LoadError`) ou le contenu. Une zone peut remplacer l'état d'erreur par le sien, ou n'en afficher aucun quand une autre zone de la même section le porte.
- Graphiques (amende l'ADR 0015) : chaque composant de graphique est déclaré par `lazyComponent` (`front/app/utils/lazy-component.ts`), autour de `defineAsyncComponent` avec son skeleton comme `loadingComponent`, sans délai. Le chargement de la section attend à la fois les données et le code du graphique, lancés en parallèle : le skeleton reste en place jusqu'à ce que les deux soient prêts, et un échec de l'un ou l'autre mène à l'état d'erreur. Un chargement du code qui échoue est oublié pour que « Réessayer » le relance.

## Écarté

- `USkeleton` de Nuxt UI : chaque barre porte `role="alert"` et `aria-live`, une liste de dix lignes produit une trentaine d'annonces.
- Barres statiques : conformes à CHG-43 sans exception, mais une vue lente paraît figée. Reflet défilant : plus décoratif, keyframe propre.
- Remplacement de toute la vue d'un bloc : on attend l'appel le plus lent.
- Skeleton au seul premier chargement : l'en-tête et les données restent en désaccord après un changement de mois. Skeleton à chaque rechargement : la vue clignote après chaque enregistrement.
- Apparition immédiate : flash de quelques millisecondes sur les réponses rapides. Délais de 100 et 250 ms ou de 200 et 400 ms.
- Zone vide pendant le délai d'apparition : le skeleton qui apparaît ensuite pousse les cartes suivantes. Sur l'accueil, le CLS mesuré atteignait 0,48 à 1280 px et 0,83 à 360 px avec la zone vide, contre 0,006 à 0,015 avec la place réservée.
- Nombre de lignes propre à chaque liste, ou dernier nombre connu mémorisé par vue.
- Prop `loading` sur les composants réels : aucun écart possible, mais chaque composant porte aussi son chargement. Carte de section commune : sans gain une fois les en-têtes affichés dès l'ouverture.
- Hauteur du graphique réservée à vide pendant le chargement de son code : pas de saut, mais une zone blanche entre le skeleton et le graphique.
- Skeleton de toute l'interface pendant le chargement de la session.
- État d'erreur en tuile rouge, en `UAlert` ou propre au hors ligne ; toast sans état d'erreur, qui laisse la zone vide.
- Contrôle des décalages par repères comparés ou par captures d'écran, plus fragiles ; seuils de CLS de 0,05 ou 0,01, qui exigeraient des données de test du nombre exact de lignes du skeleton.

## Conséquences

- Un scénario Playwright retarde les réponses de l'API et mesure le CLS (`layout-shift`) pendant le chargement de chaque vue, à 360, 768, 1024 et 1280 px de large : il doit rester sous 0,1, seuil « bon » des Web Vitals. Un écart de nombre de lignes entre le skeleton et les données reste toléré à ce seuil.
- Une liste plus longue ou plus courte que 3 lignes change de hauteur à l'arrivée des données ; le décalage reste sous le contenu déjà affiché.
- Une réponse arrivée juste après 150 ms retarde le contenu jusqu'à 300 ms.
- Les tests de composants simulent les minuteries pour vérifier l'apparition du skeleton ; les tests existants, dont les réponses simulées arrivent avant 150 ms, ne le voient pas.
- Tout nouveau composant qui charge des données passe par `useLoadState` et `LoadZone`, avec un skeleton construit sur les primitives et les composants de mise en page communs.
