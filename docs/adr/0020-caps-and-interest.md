# ADR 0020 · Plafonds et intérêts des livrets

Statut : acceptée · 15 novembre 2026 · Exigences : LIV-01 à LIV-05, DSH-04, PRV-03, EXE-01, RAP-03, CHG-61, CHG-65, US-15 · Amende les sections 5.1, 5.2 et 5.5 du cahier des charges, complète les ADR 0013 et 0017

## Contexte

LIV-01 à LIV-05 laissent ouverts la gestion des plafonds de référence, la part d'intérêts du solde initial, le montant d'un dépassement quand plusieurs versements prévus excèdent le plafond, les bornes de la méthode des quinzaines, la base de la méthode journalière, l'arrondi, la forme de l'échéance système de LIV-05, la période des intérêts acquis et projetés, l'endroit où s'affichent ces informations et le moment de l'alerte à l'enregistrement. Le centre de notifications (NOTIF-04) n'existe pas encore. Les arbitrages ci-dessous sont ceux du porteur du projet.

## Décision

Plafonds (LIV-01, LIV-02) :

- `regulated_caps` est amorcée par la migration avec Livret A 22 950 €, LDDS 12 000 €, LEP 10 000 €, PEL 61 200 €, CEL 15 300 €, valeurs à vérifier au déploiement. Une carte « Plafonds réglementaires » de la console d'administration les modifie ; c'est une donnée globale, sans donnée utilisateur (ADM-06), et chaque modification écrit l'événement d'audit `regulated_cap_updated`. Tout utilisateur les lit (`GET /regulated-caps`) pour préremplir son formulaire.
- Le plafond est copié sur le compte au choix du produit (création, ou changement de produit sans plafond fourni), puis modifiable ; un changement de référence ne touche pas les comptes existants. Un plafond vide désactive le contrôle.
- Nouveau champ `capitalized_interest_cents` (« dont intérêts capitalisés », 0 par défaut) : la part du solde initial venant d'intérêts. Solde hors intérêts capitalisés = solde − ce champ − opérations de la catégorie Intérêts.
- Dépassement d'une occurrence de versement : la part de son montant au-dessus du plafond, `min(montant, solde hors intérêts en fin de journée − plafond)` ; toutes les occurrences créditrices de l'horizon de l'utilisateur sont évaluées. US-15 : 50 € pour le premier versement de 100 €, 100 € pour le suivant.
- Signaux de ce lot : badge CHG-61 sur l'échéance (première occurrence en dépassement de l'horizon), dans le calendrier et sur la ligne du compte (dépassement d'aujourd'hui) ; avertissement non bloquant à l'enregistrement d'un crédit (opération ou mouvement entrant d'un transfert) quand le solde hors intérêts dépasse le plafond en fin de la date de l'opération, réelle ou projetée ; alertes actives du bandeau (DSH-04, CHG-65) pour les comptes au-dessus du plafond aujourd'hui ou à une date de l'horizon. Les entrées `deposit_cap` du centre de notifications arrivent avec le sous-lot des notifications, sur le même calcul.

Intérêts (LIV-03 à LIV-05) :

- Livrets réglementés et épargne logement uniquement ; méthode des quinzaines et capitalisation au 31 décembre par défaut, modifiables ; date anniversaire obligatoire pour la capitalisation anniversaire (le 29 février donne le 28 les années non bissextiles). Taux annuels en pour cent, quatre décimales au plus, historisés par date d'effet. Sans taux, aucun intérêt n'est estimé.
- Quinzaines : un versement du jour J est productif à partir du premier 1er ou 16 strictement postérieur à J ; un retrait du jour J cesse de produire dès le début de la quinzaine de J. Intérêts d'une quinzaine = solde retenu × taux en vigueur à son début / 24.
- Méthode journalière : solde de fin de journée × taux du jour / 365, chaque année.
- Les intérêts d'une période s'accumulent sans arrondi et sont arrondis une fois au centime, demi vers le haut, à l'affichage et à la capitalisation. La période d'une capitalisation court du lendemain de la précédente au jour de capitalisation, l'opération d'intérêts de ce jour exclue de son propre calcul ; elle commence au plus tôt à la date du solde initial.
- Une capitalisation du jour même est réputée passée : la période en cours mène à la prochaine capitalisation strictement future. Intérêts acquis : quinzaines terminées ou jours écoulés de la période, sur les soldes réels. Montant projeté : toute la période, sur les soldes réels puis prévisionnels (occurrences et opérations datées), quel que soit l'horizon.
- LIV-05 : chaque compte concerné a une échéance système de revenus (`is_system`), catégorie Intérêts, automatique, annuelle au jour de capitalisation, créée et tenue à jour par l'API à chaque création ou modification du compte, supprimée avec la nature. Elle stocke un montant nul : la prévision calcule le montant au jour de capitalisation (I_c(J)) et la tâche de 00:05 calcule celui de l'opération générée sur les soldes réels ; une estimation nulle saute l'occurrence. Elle n'apparaît ni dans les échéances ni dans les abonnements, refuse toute modification (409 `system_schedule`) et s'affiche dans le calendrier sans menu. Sa tolérance de rapprochement est de 100 % pour que la ligne bancaire réelle soit proposée (RAP-03).
- Interface : champs d'épargne dans le formulaire du compte ; entrée « Taux et intérêts » du menu du compte (historique des taux, intérêts acquis, montant et date de la prochaine capitalisation) ; ligne « Intérêts estimés » sur le compte.

## Conséquences

- Migration 0022 : table `regulated_caps` amorcée, colonnes `deposit_cap_cents`, `capitalized_interest_cents`, `interest_method`, `capitalization`, `anniversary_date` de `accounts` (renseignées pour les comptes d'épargne existants), table `interest_rates`, colonne `schedules.is_system` avec un montant nul admis pour elle seule, et une échéance d'intérêts pour chaque compte d'épargne existant.
- Moteur `shared/engines/interest.ts` ; la prévision crédite les intérêts et calcule les dépassements (`capExcessCents` des jours et des occurrences). US-15 est transcrite dans `user-stories.test.ts`.
- Routes `GET /accounts/:id/interest`, `POST /accounts/:id/interest-rates`, `DELETE /interest-rates/:id`, `GET /regulated-caps`, `PATCH /admin/regulated-caps/:product` ; le compte expose ses champs d'épargne, `interest` et `depositCapExcessCents` ; l'échéance expose `capExcess`, l'occurrence de calendrier `system` et `capExcessCents`, le bandeau `capAlerts`, l'enregistrement d'une opération ou d'un transfert `capWarnings`.
- Les échéances système ne comptent pas dans l'usage d'un compte ; la suppression d'un compte sans opération les supprime.
