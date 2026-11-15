# ADR 0019 · Placements et valorisations

Statut : acceptée · 15 novembre 2026 · Exigences : CPT-06, CPT-08, DSH-01, DSH-04, PRV-02, PRV-09, CAL-03, CHG-20, CHG-76, US-16 · Amende la section 5.2 du cahier des charges, complète l'ADR 0016

## Contexte

CPT-06 définit le total versé, la plus ou moins-value latente et le solde de référence d'un placement (dernière valorisation plus flux postérieurs), sans dire quels chiffres comparer quand des opérations suivent la dernière valorisation, quel solde affichent les jours passés et les relevés, où se saisissent les valorisations ni quelles dates elles acceptent. Il n'existe pas de page de détail de compte. Les arbitrages ci-dessous sont ceux du porteur du projet.

## Décision

- Natures concernées : Assurance-vie, PEA ou compte-titres, Portefeuille crypto. Les autres natures n'ont ni valorisation ni plus-value ; leurs routes de valorisation répondent 409 `account_not_investment`.
- Une valorisation est la valeur de fin de journée de sa date. Elle est datée de la date du solde initial à aujourd'hui, comme un relevé (ADR 0017), positive ou nulle, unique par compte et par date (409 `valuation_exists`), modifiable et supprimable ; un compte archivé refuse toute écriture.
- Solde de référence en fin de journée J : dernière valorisation datée de J ou avant, plus les opérations datées après elle jusqu'à J ; sans valorisation, le solde calculé. Il sert pour aujourd'hui (vue « Où est mon argent », patrimoine du bandeau, point de départ de la prévision) comme pour les jours passés (calendrier, 30 jours réels de la courbe) : le solde d'un jour de valorisation est cette valorisation. L'écart des relevés (CPT-05) reste mesuré sur le solde calculé.
- Total versé : solde initial plus mouvements de transfert, entrants moins sortants, jusqu'à aujourd'hui ; les autres opérations (frais, dividendes saisis en revenu) n'y entrent pas, conformément à CPT-06.
- Plus ou moins-value latente : solde de référence d'aujourd'hui moins total versé d'aujourd'hui, en euros et en pourcentage du total versé (une décimale) ; aucune avant la première valorisation, et pas de pourcentage quand le total versé est nul ou négatif. Un transfert postérieur à la valorisation s'annule ; des frais ou un dividende saisis après elle modifient la plus-value.
- Changer la nature d'un compte qui a des valorisations vers une nature hors placement est refusé (409 `account_has_valuations`) ; passer d'une nature de placement à une autre reste possible.
- Interface : la ligne du compte dans la vue Comptes montre le solde de référence et, dessous, la plus ou moins-value en euros et en pourcentage (CHG-20). L'entrée « Valorisations » du menu du compte ouvre une modale : total versé, dernière valorisation et sa date, plus ou moins-value, courbe des valorisations (CHG-76) avec son tableau équivalent (CHG-77), saisie, modification et suppression.

## Conséquences

- Migration 0021 : table `valuations` avec `user_id` et la clé étrangère composée `(account_id, user_id)` en cascade, comme `account_statements`.
- `AccountInput` porte les valorisations du compte ; `referenceBalanceCents` remplace le solde calculé au départ de la prévision et dans `endOfDayBalances`, sans effet sur les comptes sans valorisation. Module `shared/engines/investments.ts` (total versé, synthèse) ; US-16 est transcrite dans `user-stories.test.ts`.
- Routes `GET`, `POST /accounts/:id/valuations`, `PATCH`, `DELETE /valuations/:id`, chacune avec son scénario d'accès croisé (NF-SEC-05). Le compte expose `investment` (total versé, solde de référence, dernière valorisation, plus-value), nul hors placement, et `currentBalanceCents` y vaut le solde de référence.
- Le thème des graphiques lit `--data-usage-investment`.
