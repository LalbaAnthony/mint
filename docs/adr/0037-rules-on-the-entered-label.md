# ADR 0037 · Règles lues sur le libellé saisi et appliquées à la saisie manuelle

Statut : acceptée · 25 novembre 2026 · Exigences : REG-01 à REG-05, OPE-01, OPE-07, CAT-09, LIV-02 · Amende les ADR 0017 et 0027 et le cahier des charges (REG-01, REG-03, REG-05)

## Contexte

Une règle ne lisait que le libellé bancaire, que seul l'import renseigne. Une opération saisie à la main n'en a pas : aucune règle ne la classait à la saisie, « Réappliquer les règles » l'ignorait (motif `no_bank_label`, ADR 0027) et la création rapide d'une règle (REG-03) lui était refusée. Constat du porteur du projet : une règle « contient SNCF » vers Transports laissait « à catégoriser » une dépense « SNCF » saisie à la main, même après réapplication. Les arbitrages ci-dessous sont les siens.

## Décision

Libellé lu par une règle (REG-01) :

- Le libellé bancaire de l'opération ; à défaut, son libellé. Une opération importée reste évaluée sur son libellé bancaire, même si son libellé a été modifié.
- Le champ « Libellé bancaire » du formulaire de règle devient « Libellé ».

Saisie manuelle d'une dépense ou d'un revenu (`POST /operations`, REG-05) :

- À la création seulement ; modifier une opération n'applique jamais les règles.
- Seule la première règle active satisfaite par le libellé saisi compte (REG-02).
- Deux volets indépendants. Classement : la catégorie de la règle, ou sa conversion en transfert, seulement si aucune catégorie n'est saisie. Tags : les tags de la règle seulement si aucun tag n'est saisi. Catégorie saisie sans tag : catégorie gardée, tags de la règle posés. Tags saisis sans catégorie : catégorie de la règle, tags saisis gardés tels quels. Les deux saisis : rien ne change.
- Règle de transfert : conversion comme OPE-07, liaison à l'opération opposée du compte de contrepartie à ±3 jours, sinon contrepartie créée. Tags du transfert : tags saisis et tags de l'opération liée (ADR 0018), plus ceux de la règle quand aucun tag n'est saisi. La réponse signale les plafonds dépassés par la contrepartie (LIV-02).
- Classement impossible, par analogie avec les motifs de l'ADR 0027 : catégorie de la règle archivée ; compte de contrepartie archivé ou identique à celui de l'opération ; date antérieure à son solde initial sans opération à lier ; tags du transfert au-delà de 20. L'opération est alors créée « à catégoriser » et le volet tags s'applique quand même.
- Aucun retour particulier dans l'interface : toast habituel, la catégorie apparaît dans la liste.
- Les opérations générées par une échéance (EXE-01) n'appliquent toujours aucune règle.

Réapplication (ADR 0027) : comportement inchangé, le libellé remplaçant le libellé bancaire absent. Une opération manuelle est reclassée comme une importée : la catégorie de la règle remplace la sienne, tags en union, avec aperçu. Une opération générée ou un transfert ne reçoivent que les tags de la règle. Tout libellé étant non vide, le motif `no_bank_label` disparaît.

Import (ADR 0017) : inchangé. Une ligne arrive sans catégorie ni tag, la règle donne les deux.

Création rapide (REG-03) : « Créer une règle depuis ce libellé » s'affiche sur toute opération. Le motif est pré-rempli avec le libellé bancaire normalisé, à défaut le libellé normalisé (chiffres et dates retirés). L'erreur `operation_without_bank_label` disparaît.

## Conséquences

- Moteur partagé : le sujet d'une règle porte un `label`, le libellé bancaire ou à défaut le libellé (`ruleLabelOf` dans l'API).
- `POST /operations` évalue les règles dans sa transaction (`api/rules/manual.ts`).
- Codes retirés : motif `no_bank_label`, erreur `operation_without_bank_label` ; spécification OpenAPI régénérée.
- Une règle écrite pour des libellés bancaires (« PRLV SEPA ... », expression régulière) peut désormais satisfaire un libellé saisi : l'ordre de priorité des règles vaut aussi pour la saisie.
- État vide de la vue Règles : « Classez automatiquement vos opérations à l'import et à la saisie. »
