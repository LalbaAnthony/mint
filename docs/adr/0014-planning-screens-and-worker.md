# ADR 0014 · Écrans de planification, worker d'exécution et suppressions

Statut : acceptée · 14 novembre 2026 · Exigences : OPE-01 à OPE-06, OPE-08, ECH-01 à ECH-11, EXE-01 à EXE-04, ENV-01 à ENV-06, CPT-04, CPT-07, PAY-04, PAY-05, CAT-07, NF-OPS-02, NF-QUA-04, NF-SEC-05, section 7.3 · Complète l'ADR 0013

## Contexte

Les moteurs de calcul et les tables de planification existent (ADR 0013). Il reste à les rendre utilisables : écrans des opérations, des échéances et des enveloppes, tâche planifiée qui exécute les occurrences, et deux points laissés ouverts par l'ADR 0013 : les suppressions de comptes, moyens de paiement et catégories qui ignoraient les nouvelles tables, et les contrôles de cohérence que la base ne porte pas (type de catégorie, moyen de paiement du compte de l'opération). Les arbitrages ci-dessous sont ceux du porteur du projet.

## Décision

Périmètre :

- Vues livrées : Opérations, Échéances (avec le détail d'une échéance et ses occurrences), Enveloppes, et le solde calculé de la vue Comptes (CPT-04), désormais nourri par les opérations. Les vues Abonnements, Calendrier et la courbe du tableau de bord restent à faire.
- L'ajout rapide (bouton flottant, bouton « Ajouter » de la barre latérale) ouvre le formulaire d'opération en modale globale, depuis n'importe quelle vue ; les vues qui affichent des opérations ou des soldes se rechargent après l'enregistrement.
- Les exceptions d'occurrence (ECH-07) se gèrent depuis le détail de l'échéance, qui liste les occurrences de l'horizon de l'utilisateur, sautées comprises. Le calendrier réutilisera la même API.

Opérations :

- Le sens est libre : débit ou crédit sur toute catégorie de dépenses ou de revenus (un crédit en dépenses est un remboursement, ENV-03 ; un débit en revenus, une annulation). La catégorie Ajustement est refusée à la saisie (400 `adjustment_not_allowed`), elle reste réservée à CPT-05.
- Une opération ne peut pas être datée avant le solde initial de son compte (400 `date_before_initial_balance`), pour les deux mouvements d'un transfert. Reculer la date du solde initial d'un compte reste libre ; l'avancer après une opération existante est refusé (409 `operations_before_initial_balance`).
- Le moyen de paiement d'une opération doit appartenir à son compte quand le couple change (400 `payment_method_mismatch`) : un moyen de paiement rattaché depuis à un autre compte ne bloque pas l'édition d'une opération ancienne.
- Un transfert se crée par `POST /transfers` et se modifie par `PATCH /transfers/:id`, l'identifiant étant le groupe de transfert ; `PATCH /operations/:id` refuse un mouvement de transfert (409 `operation_is_transfer`) ; `DELETE /operations/:id` supprime les deux mouvements. Supprimer une opération générée marque son occurrence comme sautée (EXE-04) ; modifier une opération générée met à jour la date et le montant de sa ligne `executed`.
- Liste (OPE-05) : pagination de 25, 50 ou 100 lignes, tri par date ou par montant absolu, recherche insensible à la casse sur le libellé et la note, filtres combinables par période, comptes, groupes, catégories (sous-catégories incluses), montant minimal et maximal en valeur absolue, sens, origines et statut. Le groupe Save sélectionne les deux mouvements des transferts d'un compte Courant vers un compte d'épargne (CAT-03). Les filtres par tags (lot 3) et par rapprochement (lot 2) arriveront avec leurs lots.

Références archivées (PAY-05, CPT-07, CAT) :

- Créer un élément, ou y placer une nouvelle référence, vers un compte, un moyen de paiement ou une catégorie archivés est refusé (409 `account_archived`, `payment_method_archived`, `category_archived`). Modifier un élément qui garde une référence déjà archivée reste possible : l'historique conserve sa carte expirée.
- Archiver une catégorie utilisée par une échéance ou une enveloppe actives est permis : l'archivage ne touche que la saisie, l'échéance continue de s'exécuter et l'enveloppe de compter la catégorie.

Échéances :

- Le type est choisi à la création et ne change plus ; un champ d'un autre type dans une modification est refusé (400 `not_allowed`).
- Catégorie du type de l'échéance : de dépenses pour une dépense, de revenus pour un revenu (400 `category_kind_mismatch`). Les catégories d'une enveloppe sont des catégories de dépenses.
- Le champ note d'ECH-02, absent du modèle, est ajouté (`schedules.note`, migration 0015). L'opération générée ne reprend pas la note.
- Exceptions : seulement sur une occurrence à venir dont la date effective est après aujourd'hui ; une date surchargée doit aussi être après aujourd'hui (400 `date_not_future`), pour que le worker ne l'exécute pas aussitôt. Une occurrence sautée ou modifiée peut être rétablie ; sinon 409 `occurrence_not_editable`. Dans le formulaire d'exception, un champ laissé vide garde la valeur de l'échéance.
- La vue liste les échéances actives et non terminées, filtrables par type, avec les totaux mensuels des dépenses, des revenus et des transferts d'épargne (Courant vers épargne, au sens de CAT-03). Les échéances inactives ou terminées sont dans une section repliée, hors totaux.

Enveloppes : vue du mois en cours par défaut, navigation vers les mois précédents et suivants. Le disponible par jour restant n'apparaît que pour le mois en cours (disponible divisé par les jours restants, aujourd'hui inclus, arrondi au centime inférieur, jamais négatif). Pour un mois futur, le report n'est pas affiché (cohérent avec PRV-04). La barre compare le consommé au budget augmenté du report. Les enveloppes inactives sont dans une section repliée. Les totaux de la vue (ENV-08) restent au lot 4.

Suppressions (CPT-07, PAY, CAT-07) :

- Compte : refus si des opérations l'utilisent (409 `account_has_operations`, il ne peut qu'être archivé), puis si des échéances ou des enveloppes le référencent directement ou par un de ses moyens de paiement (409 `account_in_use`).
- Moyen de paiement : refus s'il est référencé (409 `payment_method_in_use`), conformément à l'ADR 0012 ; l'archivage reste l'issue d'une carte expirée.
- Catégorie (CAT-07) : une catégorie utilisée (avec ses sous-catégories) exige une catégorie de remplacement du même type, active, non système, hors de la catégorie supprimée et de ses sous-catégories (`DELETE /categories/:id?replacementId=`, 409 `category_in_use` ou `invalid_replacement`). Opérations et échéances passent sur le remplacement. L'appartenance à une enveloppe est transférée au remplacement, sauf s'il appartient déjà à une enveloppe : il garde la sienne et l'appartenance supprimée disparaît.
- `GET /accounts/:id/usage`, `/payment-methods/:id/usage` et `/categories/:id/usage` dénombrent les usages ; les modales de suppression les affichent et désactivent la confirmation tant que la suppression est impossible ou qu'un remplacement manque.

Worker (EXE-01 à EXE-03, NF-OPS-02) :

- Processus `node dist/worker.js` dans l'image `mint-api` (service `worker`), tâche node-cron à 00:05 Europe/Paris, et une exécution au démarrage pour rattraper les jours manqués. Un verrou consultatif transactionnel (`pg_try_advisory_xact_lock`) empêche deux exécutions simultanées ; une exécution qui ne l'obtient pas s'arrête sans rien faire.
- Chaque occurrence est exécutée dans sa propre transaction : insertion ou passage de la ligne d'occurrence à `executed`, puis création des opérations d'origine « échéance », catégorisées. Les contraintes uniques garantissent qu'une occurrence ne produit jamais plus d'une opération par compte.
- Les utilisateurs désactivés ne sont pas traités ; à leur réactivation, le rattrapage exécute les occurrences dues depuis.
- La borne basse d'exécution et de projection devient la plus tardive entre la date de création de l'échéance et les dates de solde initial des comptes qu'elle touche (amendement de l'ADR 0013) : aucune opération générée ne précède le solde initial de son compte.
- Supervision : variable `HEALTHCHECK_EXECUTION_URL` (secret GitHub du même nom, facultatif). Le worker appelle `/start` au début, l'URL elle-même en cas de succès, `/fail` en cas d'échec ou si une occurrence a échoué. Sans URL, aucun ping. Un ping qui échoue est journalisé sans interrompre la tâche. Les journaux ne portent ni montant ni libellé (NF-SEC-06).
- Développement : service `worker-dev` du profil `dev` (`tsx watch`), et `npm run worker --workspace @mint/api`.

## Conséquences

- La purge de 03:00 et les notifications de 08:00 (section 7.3) ne sont pas encore dans le worker.
- `deploy.inc.yml`, `release.flow.yml`, `rollback.flow.yml`, `remote.sh` et `docker-compose.yml` portent le nouveau service et le nouveau secret ; un secret absent laisse la supervision désactivée.
- La route d'API accepte désormais un schéma de paramètres de requête (`query`), documenté dans l'OpenAPI.
- Le jeu de données de développement fixe les soldes initiaux au 1er du mois précédent et ajoute à `user@mint.localhost` les échéances d'US-06 à US-10, une enveloppe Courses et quelques opérations.
- Trois scénarios Playwright couvrent la création d'une échéance, l'ajout rapide d'une dépense et son effet sur le solde, la création d'une enveloppe et son consommé (NF-QUA-04).
