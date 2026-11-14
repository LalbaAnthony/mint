# ADR 0013 · Moteurs de calcul et tables de planification

Statut : acceptée · 14 novembre 2026 · Exigences : ECH-01 à ECH-11, EXE-01 à EXE-04, ENV-01 à ENV-07, PRV-01 à PRV-09, CAT-03, DSH-02, DSH-03, NF-QUA-02, NF-PERF-02, US-06 à US-08, US-10 à US-12

## Contexte

Récurrences, jours fériés, exécution des échéances, enveloppes et prévision forment le cœur du lot 1 et sa partie la plus risquée. Ils doivent être éprouvés par les user stories chiffrées avant tout écran. Le cahier des charges laisse plusieurs points ouverts : la place des moteurs dans le dépôt, le sort des occurrences antérieures à la saisie d'une échéance, l'effet de l'archivage, le lissage des enveloppes des mois futurs, la fin d'une récurrence, l'arrondi de l'équivalent mensuel, le report des enveloppes et le découpage des tables par lot. Les arbitrages ci-dessous sont ceux du porteur du projet ; les règles de calcul qui en découlent sont détaillées dans `docs/calculation-rules.md`.

## Décision

Architecture :

- Les moteurs sont des fonctions pures dans `shared/engines/`, exportées par `@mint/shared/engines/*` (nouvelle entrée `exports` du paquet). Ils ne lisent ni la base ni l'horloge : la date du jour est un paramètre. Le front peut en réutiliser une partie (équivalent mensuel, jours fériés) ; la prévision reste calculée côté serveur à la demande (PRV-08).
- Leurs entrées (`ScheduleInput`, `OperationInput`, `EnvelopeInput`, `AccountInput`, `CategoryInput`) sont des types propres aux moteurs, déclarés dans `shared/types/` et découplés des modèles Sequelize. L'API les construit depuis la base ; le compte impacté par un moyen de paiement y est résolu à la lecture.
- Les dates sont des chaînes ISO `AAAA-MM-JJ`, avec une arithmétique interne sans bibliothèque.
- Les tests des moteurs tournent dans le projet Vitest `shared`, sans base. `vitest.config.ts` impose 90 % de couverture sur `shared/engines/` (NF-QUA-02) ; les fixtures de `shared/tests/` sont exclues de la couverture et du build, comme `api/tests/`.
- US-10 porte aussi sur DSH-02 et DSH-03 (lot 2) : les deux agrégats réels (répartition Needs / Wants / Save, revenus et dépenses par mois) sont livrés dès maintenant comme fonctions pures. Les graphiques et la partie prévisionnelle de DSH-03 restent au lot 2.

Modèle de données (section 5 du cahier des charges, amendée) :

- Tables créées : `schedules`, `schedule_occurrences`, `transactions`, `envelopes`, `envelope_categories`, avec les seules colonnes du lot 1. Chaque lot ajoutera les siennes par migration : `transactions.bank_label`, `import_batch_id`, `dedup_hash`, `bank_confirmed`, `pre_merge_snapshot` et `schedules.amount_tolerance_pct`, `bank_label_patterns` au lot 2 ; `schedules.reminder_days_before` et `is_system` au lot 3. Les tables `tags`, `transaction_tags` et `schedule_tags` arrivent au lot 3 (CAT-09), `envelope_month_overrides` au lot 4 (ENV-07) ; le moteur des enveloppes accepte déjà des exceptions mensuelles en entrée.
- Le motif d'ADR 0012 s'étend : toute référence croisée passe par une clé étrangère composée `(id, user_id)`. `envelope_categories` porte donc `user_id`, avec `UNIQUE (category_id)` (une catégorie dans une enveloppe au plus).
- PAY-04 : une échéance de dépense ou de revenu et une enveloppe référencent exactement un moyen de paiement ou un compte ; le compte impacté est résolu au calcul et suit un moyen de paiement rattaché à un autre compte. Une opération porte toujours `account_id`, figé à sa création, et un `payment_method_id` optionnel contraint par `(payment_method_id, user_id)` seulement : l'appartenance du moyen de paiement au compte de l'opération est vérifiée à l'écriture par l'application, pour que le rattachement d'un moyen de paiement à un autre compte (ADR 0012) reste possible sans déplacer l'historique.
- Contraintes : catégorie obligatoire pour une échéance de dépense ou de revenu (ECH-03) ; abonnement réservé aux dépenses ; transfert entre deux comptes distincts ; montants strictement positifs sur les échéances, les exceptions d'occurrence et les enveloppes, non nuls sur les opérations ; une opération est « à catégoriser » si et seulement si elle n'a ni catégorie ni transfert ; option « dernier jour du mois » réservée aux récurrences mensuelles et annuelles ; une échéance ponctuelle n'a ni intervalle ni fin ; une fin par date ou par nombre, pas les deux.
- Supprimer une échéance supprime ses lignes d'occurrence en cascade ; `transactions.occurrence_id` passe à `NULL` et les opérations restent.

Règles de calcul :

- Jours fériés : les onze jours nationaux, sans ceux de l'Alsace-Moselle.
- Fin d'échéance : la fin par date s'applique à la date d'origine ; la fin par nombre compte les dates d'origine, sautées comprises.
- Une date surchargée (ECH-07) est prise telle quelle, sans règle de jours non ouvrés.
- Équivalent mensuel arrondi au centime le plus proche, demi vers le haut ; les totaux mensuels additionnent les arrondis, le total annuel additionne les montants annualisés exacts et arrondit une fois.
- Exécution : seules les occurrences dont la date effective est postérieure ou égale à la date de création de l'échéance (Europe/Paris) sont exécutées ; une échéance ressaisie avec une date de début passée n'exécute pas son historique.
- Archivage : un compte archivé ne reçoit aucune occurrence exécutée ni projetée ; un transfert dont un côté est archivé n'est ni exécuté ni projeté ; une enveloppe dont le compte par défaut est archivé n'est pas projetée. Un moyen de paiement archivé est sans effet sur l'exécution et la prévision.
- Prévision : une occurrence due que le worker n'a pas encore exécutée est projetée aujourd'hui.
- Lissage des mois futurs (PRV-04, amendée) : le reste projeté retire, comme au mois en cours, les opérations déjà saisies du mois et les occurrences du mois sur les catégories de l'enveloppe, ce qui évite de compter deux fois une dépense planifiée dans une catégorie d'enveloppe.
- Report d'enveloppe : la chaîne démarre au mois de création de l'enveloppe avec un report nul, sur le montant mensuel actuel ; une enveloppe désactivée puis réactivée garde sa chaîne.
- Sous-catégorie explicitement placée dans une autre enveloppe que son parent : la plus spécifique gagne.
- Horizon : fin = aujourd'hui + N mois, quantième ramené au dernier jour du mois, incluse. Indicateurs : première date du minimum, seuil et zéro au sens strict. Un jour antérieur au solde initial n'a pas de solde.
- Agrégats réels : une opération à catégoriser compte par son sens dans les revenus et dépenses (DSH-03) et dans un total à part de la répartition (DSH-02).

## Conséquences

- Les routes de suppression d'un compte, d'un moyen de paiement et d'une catégorie ignorent encore ces tables : tant qu'aucune route ne les remplit, c'est sans effet, mais une ligne qui les référence ferait échouer la suppression sur une violation de clé étrangère (erreur 500). Le lot qui ajoutera la saisie des échéances, opérations et enveloppes branchera le refus 409 (compte avec opérations, CPT-07 ; moyen de paiement référencé) et la réaffectation de CAT-07.
- La base ne vérifie ni le type des catégories (catégorie de dépenses pour une échéance de dépense ou une enveloppe, de revenus pour un revenu) ni l'appartenance du moyen de paiement au compte d'une opération : les futures routes le valident.
- Le worker (EXE-03, section 7.3) consommera `planExecutions` et écrira, dans une transaction, la ligne `executed` et les opérations ; les contraintes uniques garantissent l'idempotence.
- Prévision mesurée à environ 75 ms pour 20 comptes, 200 échéances, 10 enveloppes, 10 000 opérations et 12 mois (NF-PERF-02 : 500 ms).
