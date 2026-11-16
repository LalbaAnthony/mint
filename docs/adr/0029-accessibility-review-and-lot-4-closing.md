# ADR 0029 · Revue d'accessibilité et clôture du lot 4

Statut : acceptée · 16 novembre 2026 · Exigences : NF-ACC-01, NF-QUA-04, CA-02, CHG-12, CHG-62, CHG-69, CHG-77, section 8 (critère de sortie du lot 4) · Amende les sections 3.4, 3.7, 12.1 et CHG-62 de la charte graphique

## Contexte

Le lot 4 se clôt sur une « revue d'accessibilité sans anomalie bloquante » et étend NF-ACC-01 au-delà des contrastes et du clavier : libellés de formulaires et alternatives textuelles aux graphiques. CA-02 demande en outre la recette des contrastes en sombre. Les arbitrages ci-dessous sont ceux du porteur du projet.

## Décision

Méthode :

- Scénario Playwright `e2e/tests/views-accessibility.spec.ts` avec @axe-core/playwright (dépendance de développement ; axe-core est aussi le moteur de l'audit Accessibilité de Lighthouse) : pages publiques (connexion, mot de passe oublié), toutes les vues connectées (accueil, comptes, calendrier, opérations, échéances, abonnements, enveloppes, import, règles, profil, administration), formulaire d'ajout rapide et tiroir « Plus » sur mobile ; en clair puis en sombre, le thème Système suivant l'émulation du navigateur.
- Règles WCAG 2.0 et 2.1, niveaux A et AA. Une violation de gravité « serious » ou « critical » fait échouer le scénario, donc la CI (NF-QUA-04) ; chaque vue est rapportée (`expect.soft`). Lancé après les autres scénarios, il voit leurs données (comptes, opérations, enveloppes, calendrier rempli).
- Revue du code : libellés visibles des champs (CHG-69, `AppFormField`), noms accessibles des boutons d'icône et des cases à cocher, description générée et tableau équivalent des graphiques (CHG-77), composants ajoutés au lot 4.

Constat et corrections :

- En clair, `text-muted` valait la nuance 500 d'olive (#7C7C67) par défaut de Nuxt UI : 4,26:1 sur blanc et 4,12:1 sur le canevas, sous le seuil AA de 4,5:1, sur environ 170 éléments de toutes les vues (navigation, en-têtes de tableau, aides). Il passe à olive-600 (#5B5B4B) : 6,91:1 sur blanc, 6,68:1 sur le canevas. En sombre, il reste olive-400 (7,30:1 sur olive-900), redéclaré dans `.dark` pour que la valeur claire ne le remplace pas. En clair, `text-muted` et `text-toned` sont désormais identiques.
- Calendrier : les numéros des samedis, dimanches, jours fériés et jours hors du mois étaient en `text-dimmed` (2,32:1 en clair, 3,98:1 en sombre) ; ils passent en `text-muted` (CHG-62 amendé). `text-dimmed` n'est plus employé.
- Import : le champ de fichier natif n'était pas relié à son libellé ; il devient un `UInput` de type fichier, qui reçoit l'identifiant du libellé et la description de l'aide.
- Bonnes pratiques hors critères WCAG, corrigées aussi : noms accessibles distincts des navigations de la barre latérale (« Navigation principale », « Administration ») et barre latérale en repère `banner`, titre des états vides en `h2` (plus de saut de niveau sous le `h1` de la vue), en-têtes de colonne d'actions en texte réservé aux lecteurs d'écran, ligne de totaux des enveloppes dans le corps du tableau avec un en-tête de ligne.

Résultat : aucune violation, quelle que soit sa gravité et bonnes pratiques comprises, dans les deux thèmes ; le scénario garde le seuil « serious » et « critical » sur les règles WCAG.

Scénarios de bout en bout réparés en passant, faute de quoi la suite ne pouvait pas être verte :

- Depuis le bouton « Se connecter avec une passkey » (lot 3), la recherche du bouton « Se connecter » était ambiguë ; elle porte désormais sur le nom exact.
- Le setup global créait l'administrateur sans les catégories système (Intérêts, Ajustement) : la création d'un livret réglementé échouait depuis le lot 3, faute de catégorie d'intérêts pour son échéance système. Il les crée, et remet le thème du profil à Système.

## Conséquences

- CA-02 est couvert en clair et en sombre par un contrôle automatique rejoué à chaque CI, sur plus de vues que la liste de CA-02. L'audit Lighthouse lui-même n'a pas été lancé.
- Toute nouvelle vue s'ajoute à la liste du scénario.
- Les 14 scénarios Playwright passent sur les images de production de la pile `e2e/compose.yml`.
