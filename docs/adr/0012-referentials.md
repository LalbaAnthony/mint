# ADR 0012 · Comptes, moyens de paiement et catégories

Statut : acceptée · 14 novembre 2026 · Exigences : CPT-01 à CPT-04, CPT-07, CPT-08, PAY-01 à PAY-05, CAT-01 à CAT-08, US-04

## Contexte

Le lot 1 livre les référentiels (comptes, moyens de paiement, catégories) et la vue « Où est mon argent ». Le cahier des charges laisse plusieurs points ouverts : le produit réglementé dont LIV-01 a besoin pour préremplir un plafond, la catégorie système Ajustement qui n'est ni une dépense ni un revenu, la réversibilité de l'archivage et ses effets en cascade, la place de ces écrans dans une navigation qui ne les prévoit pas, le réglage de l'ordre d'affichage. Les tables d'opérations, d'échéances, d'enveloppes et de règles n'existent pas encore. Les arbitrages ci-dessous sont ceux du porteur du projet.

## Décision

Modèle de données (section 5 du cahier des charges, amendée) :

- `accounts.regulated_product` (livret_a, ldds, lep pour la nature Livret réglementé ; pel, cel pour Épargne logement) est obligatoire pour ces deux natures et absent pour les autres. Les colonnes de plafond et d'intérêts du lot 3 seront ajoutées par une migration du lot 3.
- `categories.kind` accepte `adjustment`, réservé à la catégorie système Ajustement. Intérêts est la catégorie système de revenus. Chaque utilisateur en a une de chaque, au premier niveau, créées à l'inscription et, pour les utilisateurs existants, par la migration 0008. L'interface affiche leur nom traduit, déduit du kind ; elles ne peuvent être ni renommées, ni déplacées, ni archivées, ni supprimées.
- Les références d'un moyen de paiement vers son compte et d'une sous-catégorie vers son parent sont des clés étrangères composées `(id, user_id)` : la base refuse une référence vers les données d'un autre utilisateur.

Règles de gestion :

- Solde actuel au lot 1 : le solde initial, faute d'opérations. La date du solde initial ne peut pas être postérieure à aujourd'hui (Europe/Paris). L'indicateur d'écart de rapprochement de CPT-08 arrive avec CPT-05 (lot 2), la valorisation des placements avec CPT-06 (lot 3).
- L'archivage est réversible partout (action « Restaurer »). Un élément archivé n'est plus modifiable : il se restaure ou se supprime.
- Archiver un compte archive ses moyens de paiement actifs ; le restaurer ne les réactive pas. Un moyen de paiement ne se crée, ne se rattache et ne se restaure que sur un compte actif.
- Un compte sans opération (tous, au lot 1) se supprime avec ses moyens de paiement. Un moyen de paiement que rien ne référence se supprime, en plus de l'archivage de PAY-01.
- Catégories : renommage ; changement de groupe d'une catégorie de dépenses de premier niveau, rétroactif sur les répartitions ; déplacement d'une sous-catégorie vers un autre parent actif du même type. Ni changement de niveau, ni changement de type. Archiver ou supprimer un parent archive ou supprime ses sous-catégories ; le restaurer ne restaure que lui, et une sous-catégorie ne se restaure que sous un parent actif.
- La réaffectation de CAT-07 sera branchée par chaque lot qui ajoute une table référençant les catégories ; d'ici là, la suppression est libre hors catégories système.
- Ordre d'affichage : comptes à l'intérieur de leur usage ; catégories de premier niveau à l'intérieur de leur groupe (dépenses) ou de leur type (revenus) ; sous-catégories à l'intérieur de leur parent. Un élément créé, restauré, ou qui change d'usage, de groupe ou de parent, se place en dernier. Une réorganisation envoie la liste complète des éléments frères, sinon l'API répond 409 `order_mismatch`.

Interface :

- La vue Comptes est la vue « Où est mon argent ». `GET /api/v1/accounts/overview` calcule côté serveur les soldes, les sous-totaux par usage et le total. Les usages sans compte actif sont masqués (US-04) ; les comptes archivés sont dans une section repliée en bas de la vue.
- Les moyens de paiement se gèrent dans la vue Comptes, sous leur compte dépliable ; les catégories dans « Profil et préférences ». La navigation de la charte (CHG-52, CHG-53, CHG-55) reste inchangée.
- Formulaires en modale, en plein écran sous 1024 px pour le compte.
- Un mode « Réorganiser » affiche les poignées de glisser-déposer (`@vueuse/integrations` et `sortablejs`) et des boutons monter et descendre utilisables au clavier ; hors de ce mode, chaque ligne n'a qu'un menu d'actions.

## Conséquences

- Trois dépendances du paquet `front` : `@vueuse/integrations`, `sortablejs` et `@types/sortablejs`.
- Les tests qui comptaient les 18 catégories par défaut en comptent 20.
- Les lots suivants devront compléter la suppression d'un compte (refus s'il a des opérations, CPT-07), celle d'un moyen de paiement (refus s'il est référencé) et celle d'une catégorie (réaffectation, CAT-07).
