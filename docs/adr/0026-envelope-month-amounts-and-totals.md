# ADR 0026 · Montant d'un mois et totaux des enveloppes

Statut : acceptée · 16 novembre 2026 · Exigences : ENV-04, ENV-05, ENV-07, ENV-08, PRV-04, AUTH-08, CHG-61, CHG-64 · Amende la section 5.5 du cahier des charges, complète les ADR 0013, 0014 et 0022

## Contexte

Le lot 4 demande un montant spécifique pour un mois donné, sans changer le montant mensuel de référence (ENV-07), et une vue des enveloppes du mois avec une ligne par enveloppe et les totaux budget, consommé et disponible (ENV-08). Le moteur des enveloppes acceptait déjà des exceptions mensuelles en entrée (ADR 0013) ; la table `envelope_month_overrides` restait à créer. Restaient ouverts l'endroit de la saisie, les mois permis, la valeur nulle, la présentation de la vue, la définition des totaux et la place de ces montants dans l'export. Les arbitrages ci-dessous sont ceux du porteur du projet.

## Décision

Montant d'un mois (ENV-07) :

- Table `envelope_month_overrides` (migration 0026) : `envelope_id` (suppression en cascade avec l'enveloppe), `month` (premier jour du mois, contrainte `CHECK`), `amount_cents` positif ou nul, unique `(envelope_id, month)`. L'utilisateur est porté par l'enveloppe, comme pour `schedule_occurrences`.
- Tout mois est permis, passé, en cours ou futur. Un montant nul suspend l'enveloppe un mois sans la désactiver.
- `POST /envelopes/:id/months/:month` enregistre ou remplace le montant du mois ; `DELETE /envelopes/:id/months/:month` rend le mois au montant mensuel (204, même sans exception). Un mois qui n'est pas un premier jour répond 404, comme tout paramètre de chemin invalide ; un montant négatif répond 400 `amount_out_of_range`.
- Le montant du mois remplace le montant mensuel partout où le moteur lit `budget(M)` : vue du mois, chaîne du report (une exception passée modifie le report des mois suivants) et lissage de la prévision des mois futurs (PRV-04), donc calendrier, courbe, revenus et dépenses prévus et alertes.
- Saisie depuis le menu d'actions de l'enveloppe dans la vue du mois : « Montant pour ce mois » (icône `calendar-cog`) ouvre une modale préremplie avec le budget du mois, qui rappelle le montant mensuel de référence et propose « Revenir au montant mensuel » quand une exception existe.
- Le budget d'un mois qui a une exception porte un badge `soft` neutre « Exception » (CHG-61), avec une infobulle et un texte réservé aux lecteurs d'écran « Montant mensuel : X ».

Vue du mois (ENV-08) :

- `GET /envelopes` renvoie pour chaque ligne l'indicateur `overridden` et, pour la vue, les totaux des enveloppes actives : budget du mois (exceptions comprises), report, consommé et disponible, de sorte que budget + report - consommé = disponible.
- Les cartes sont remplacées par un tableau à partir de 1024 px (enveloppe et compte débité, budget, report, consommé avec la barre de CHG-64, disponible, disponible par jour restant pour le mois en cours, actions) suivi d'une ligne de totaux, et par une liste en lignes en dessous, suivie d'un bloc de totaux.
- La barre compare toujours le consommé au budget augmenté du report (ADR 0014).

Export (AUTH-08) : `mint-export.json` contient les exceptions dans un tableau `envelopeMonthOverrides`, comme les exceptions d'occurrence des échéances (`scheduleOccurrences`) ; les neuf CSV sont inchangés.

## Conséquences

- La suppression d'une enveloppe supprime ses exceptions ; une enveloppe inactive les garde.
- Le composant `EnvelopeCard` disparaît au profit de `EnvelopeRow`, `EnvelopeConsumption` et `EnvelopeBudget`.
- Les routes ont leurs scénarios d'accès croisé (NF-SEC-05) ; le scénario Playwright des enveloppes vérifie la ligne du tableau et le total du disponible.
