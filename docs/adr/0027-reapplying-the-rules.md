# ADR 0027 · Réappliquer les règles à une sélection d'opérations

Statut : acceptée · 16 novembre 2026 · Exigences : REG-01, REG-02, REG-04, REG-05, OPE-07, CAT-09, RAP-03 · Complète les ADR 0017 et 0018

## Contexte

REG-05 demande une action « Réappliquer les règles » sur une sélection d'opérations existantes, avec aperçu des changements avant confirmation. La vue Opérations n'avait pas de sélection multiple. Restaient ouverts la manière de sélectionner, le sort des opérations sans libellé bancaire, des transferts, des opérations liées à une occurrence et de celles qu'aucune règle ne satisfait, la combinaison des tags, le plafond de 20 tags (ADR 0018) et la forme de l'aperçu. Les arbitrages ci-dessous sont ceux du porteur du projet.

## Décision

Sélection : une case par opération, dans le tableau comme dans la liste mobile, et une case « Sélectionner les opérations de la page » ; 50 opérations au plus par passage (la taille de page). Une barre d'action affiche le nombre d'opérations sélectionnées (annoncé aux lecteurs d'écran), « Réappliquer les règles » (`soft` primaire, icône `wand-sparkles`) et « Désélectionner ». La sélection se limite aux opérations affichées ; changer de page, de filtre ou de tri la réduit à celles qui restent visibles. Hors ligne, les cases sont désactivées et la barre masquée.

Évaluation, opération par opération, avec les règles actives dans l'ordre de priorité ; seule la première règle satisfaite compte (REG-02) :

- Sans libellé bancaire (opération saisie à la main) : ignorée, motif `no_bank_label`.
- Opération de la catégorie Ajustement : ignorée, motif `adjustment`.
- Aucune règle satisfaite : inchangée, motif `no_matching_rule` ; réappliquer ne défait jamais un classement.
- Transfert existant, ou opération liée à une occurrence d'échéance (rapprochée, fusionnée ou générée) : seuls les tags de la règle s'ajoutent, le classement est conservé, comme pour une ligne fusionnée à l'import (ADR 0017). Les tags d'un transfert vont sur ses deux mouvements (ADR 0018).
- Règle de catégorie sur une opération ordinaire : la catégorie de la règle, statut « catégorisée ». Catégorie archivée : motif `category_archived`.
- Règle de transfert sur une opération ordinaire : conversion en transfert comme OPE-07, liaison à l'opération opposée du compte de contrepartie à ±3 jours, sinon contrepartie créée. Compte de contrepartie archivé, identique au compte de l'opération, ou opération antérieure à son solde initial sans opération à lier : motifs `account_archived`, `same_account`, `before_initial_balance`. Une opération opposée n'est proposée qu'à une seule conversion de la sélection.
- Tags : union des tags de l'opération (et de la contrepartie liée) et de ceux de la règle. Au-delà de 20 tags, l'opération est ignorée, motif `too_many_tags`, ni sa catégorie ni ses tags ne changent.
- Rien ne change (même catégorie, aucun tag nouveau) : motif `unchanged`.

API :

- `POST /rules/reapply/preview` (`operationIds`, 1 à 50, sans doublon) renvoie les changements (l'opération telle qu'elle est et le classement proposé : règle, catégorie, compte de contrepartie, tags) et les opérations laissées telles quelles avec leur motif ; une opération inconnue répond 404.
- `POST /rules/reapply` reçoit les changements retenus, recalcule l'aperçu de ces opérations dans une transaction et applique tout ou rien ; si une règle, une opération ou un tag a changé depuis l'aperçu, la réponse est 409 `preview_outdated`.

Aperçu : modale listant chaque changement (libellé, montant, date, règle « motif », avant, après, tags ajoutés) avec une case cochée par défaut ; les opérations laissées telles quelles sont dénombrées par motif. « Appliquer à n opérations » (plein primaire) applique les lignes cochées ; sur 409, un toast `info` l'annonce et l'aperçu est recalculé.

## Conséquences

- La recherche de l'opération opposée de la conversion en transfert est extraite de `linkOrCreateCounterpart` (`findTransferCounterpart`) pour servir aussi à l'aperçu.
- Code d'erreur ajouté : `preview_outdated`.
- Les deux routes ont leurs scénarios d'accès croisé (NF-SEC-05).
