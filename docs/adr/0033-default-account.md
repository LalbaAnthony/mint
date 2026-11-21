# ADR 0033 · Compte par défaut

Statut : acceptée · 22 novembre 2026 · Exigences : AUTH-07, AUTH-08, OPE-01, OPE-02, ECH-03, ENV-01, DSH-01, CAL-04, CPT-07, NF-PWA-02, NF-SEC-05, CHG-69 · Amende AUTH-07, DSH-01, CAL-04 et la section 5.1 du cahier des charges, ainsi que CHG-69 et le registre des décisions de la charte graphique

## Contexte

En création, les formulaires d'opération (dépense, revenu, transfert), d'échéance et d'enveloppe présélectionnaient le premier compte actif dans l'ordre de la vue Comptes (usage, puis `sort_order`), et la cible d'un transfert le deuxième. Le calendrier et la courbe du tableau de bord s'ouvraient sur la vue agrégée (DSH-01). Le porteur du projet veut un compte par défaut unique pour toute l'application, qu'il règle lui-même. Restaient ouverts l'endroit où ce réglage est enregistré, les écrans où il s'applique, le comportement sans réglage et le sort du réglage quand son compte est archivé ou supprimé. Les arbitrages ci-dessous sont ceux du porteur du projet.

## Décision

- Enregistrement en base : colonne `users.default_account_id` (migration 0028), nullable. La clé étrangère composée `(default_account_id, id)` vers `accounts (id, user_id)` garantit que le compte appartient à l'utilisateur ; `ON DELETE SET NULL (default_account_id)` remet le réglage à vide quand le compte est supprimé (CPT-07). La migration laisse la colonne vide pour tous les utilisateurs existants.
- API : `defaultAccountId` est exposé par la session et le profil, et modifié par `PATCH /profile` : 400 `invalid` pour une valeur qui n'est pas un UUID, 404 `not_found` pour un compte inconnu ou d'un autre utilisateur (NF-SEC-05), 409 `account_archived` pour un compte archivé. La lecture du compte, verrouillée, et l'écriture du profil partagent une transaction : un archivage concurrent ne laisse pas un compte archivé en défaut. Le réglage figure dans le profil de l'export (AUTH-08).
- Valeur : un compte, jamais un moyen de paiement. Les champs « Moyen de paiement ou compte » présélectionnent le compte lui-même.
- Réglage : profil, section Préférences, liste « Compte par défaut » avec « Aucun » puis les comptes actifs dans l'ordre de la vue Comptes.
- Défaut automatique : la création d'un compte (`POST /accounts`) en fait le compte par défaut quand aucun n'est réglé, y compris après un choix « Aucun » dans le profil ou une remise à vide par archivage. L'écriture est conditionnelle (`WHERE default_account_id IS NULL`) et faite dans la transaction de la création. Un désarchivage ne change pas le réglage.
- Archivage : archiver le compte par défaut remet le réglage à vide, dans la transaction de l'archivage. Le désarchiver ne le restaure pas.
- Formulaires en création (opération, échéance, enveloppe) : le champ du compte prend le compte par défaut ; sans réglage, le compte actif s'il est seul ; sinon le champ reste vide et reçoit le focus initial quand il est le premier champ vide (CHG-69). Transfert, en opération comme en échéance : la source suit la même règle, la cible reste toujours vide. L'édition ne change pas. Côté front, la valeur vient de `prefilledAccountId` du store `referentials`, qui ignore un compte par défaut absent des comptes actifs (session en retard sur une action faite depuis un autre appareil).
- Calendrier et courbe du tableau de bord (CAL-04, DSH-01) : chaque vue s'ouvre sur le compte par défaut, sinon sur la vue agrégée ; la règle du compte unique ne s'y applique pas. Un choix fait dans le sélecteur d'une vue est gardé jusqu'à la déconnexion. Un changement du compte par défaut (profil, création, archivage, suppression) réaligne les deux vues. Un lien de notification vers un compte reste prioritaire, et un compte refusé par l'API (404, 409) ramène la vue agrégée, comme avant. Les copies hors ligne (NF-PWA-02) suivent la portée courante de chaque vue.
- Actualisation : la vue Comptes relit la session après la création, l'archivage ou la suppression d'un compte, ces actions pouvant changer le réglage côté serveur.
- Focus initial (CHG-69) : dans les Préférences, « Aucun » est une valeur choisie et non un champ à remplir. L'état du formulaire porte la valeur `none`, convertie en `null` à l'envoi : le champ ne prend pas le focus. L'entrée « Aucune » du select de catégorie reste un champ vide au sens de CHG-69.

## Écarté

- Attribut `accounts.is_default` avec index unique partiel : il aurait suivi naturellement l'archivage et la suppression, mais la préférence de l'utilisateur vit avec les autres préférences du profil (ADR 0028).
- Réglage par appareil dans le stockage local : il n'aurait plus été unique dès le deuxième appareil.
- Moyen de paiement comme défaut : deux colonnes exclusives, et l'archivage d'une carte à gérer en plus de celui du compte.
- Réglage depuis la vue Comptes (action « Définir par défaut » et badge), seul ou en plus du profil.
- Cible de transfert sur le premier autre compte, ou transferts laissés hors du réglage.
- Repli sur le premier compte actif sans réglage, comportement antérieur.
- Réglage conservé mais ignoré tant que son compte est archivé, puis restauré au désarchivage.
- Migration recopiant le premier compte actif de chaque utilisateur.
- Défaut automatique aussi au désarchivage.
- Application à l'import CSV (IMP-01), où un relevé importé par inattention dans le mauvais compte échapperait à la détection des doublons, faite par compte (IMP-05), et à la contrepartie d'une conversion en transfert (OPE-07).
- Portée des vues remise au compte par défaut à chaque visite, le choix manuel étant oublié en quittant la vue.

## Conséquences

- Après le déploiement, tant qu'aucun réglage n'est fait, les formulaires d'un utilisateur à plusieurs comptes ouvrent leur champ de compte vide ; la création du compte suivant le règle automatiquement.
- Un choix « Aucun » fait dans le profil est remplacé à la prochaine création de compte.
- L'import CSV garde sa règle propre : un compte n'y est présélectionné que s'il est le seul compte actif.
