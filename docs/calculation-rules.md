# Règles de calcul

Les moteurs de calcul vivent dans `shared/engines/`. Ce sont des fonctions pures : aucune entrée-sortie, aucune horloge, la date du jour (Europe/Paris) est toujours un paramètre. Leurs entrées et sorties sont typées dans `shared/types/`, indépendamment des modèles Sequelize : l'API construit ces entrées depuis la base. Les décisions qui fondent ces règles sont motivées dans l'ADR 0013.

| Module              | Rôle                                                                 | Exigences                      |
| ------------------- | -------------------------------------------------------------------- | ------------------------------ |
| `dates.ts`          | dates civiles ISO `AAAA-MM-JJ`, mois, jours de semaine               | toutes                         |
| `holidays.ts`       | date de Pâques, jours fériés de France métropolitaine                | ECH-06                         |
| `business-days.ts`  | jours ouvrés, règle de jours non ouvrés                              | ECH-06                         |
| `recurrence.ts`     | dates d'origine, occurrences, prochaine occurrence, exceptions       | ECH-04, ECH-07, ECH-08, ECH-11 |
| `equivalents.ts`    | équivalent mensuel et totaux                                         | ECH-05, ECH-09, ECH-10         |
| `postings.ts`       | mouvements d'une occurrence sur les comptes                          | ECH-03, PAY-04                 |
| `execution.ts`      | occurrences à exécuter par la tâche planifiée                        | EXE-01 à EXE-04                |
| `balances.ts`       | solde calculé, solde de référence, soldes de fin de journée          | CPT-04, CPT-06, PRV-09         |
| `investments.ts`    | total versé, plus ou moins-value latente des placements              | CPT-06                         |
| `envelopes.ts`      | catégories d'une enveloppe, consommé, disponible, report, lissage    | ENV-01 à ENV-05, PRV-04        |
| `forecast.ts`       | solde prévisionnel par compte et agrégé, indicateurs                 | PRV-01 à PRV-08                |
| `reports.ts`        | répartition Needs / Wants / Save, revenus et dépenses par mois       | CAT-03, DSH-02, DSH-03         |
| `amounts.ts`        | divisions arrondies, répartition au centime                          | ECH-05, PRV-04                 |
| `labels.ts`         | normalisation des libellés bancaires, similarité des libellés        | IMP-05, REG-01, REG-03, RAP-02 |
| `csv-lines.ts`      | dates, montants et lignes d'un CSV, clés de doublon                  | IMP-02, IMP-04, IMP-05         |
| `rules.ts`          | règle satisfaite par une ligne                                       | REG-01, REG-02                 |
| `reconciliation.ts` | occurrences candidates et score                                      | RAP-01, RAP-02                 |
| `interest.ts`       | capitalisations, intérêts estimés, solde hors intérêts capitalisés   | LIV-02 à LIV-05                |
| `notifications.ts`  | fenêtre de solde bas, épisodes, rappels dus, liens des notifications | NOTIF-01, NOTIF-02, NOTIF-04   |

Tous les montants sont des entiers en centimes. Un débit est négatif, un crédit positif.

## 1. Dates et jours ouvrés

Une date est une chaîne ISO `AAAA-MM-JJ` sans fuseau, interprétée en Europe/Paris ; l'arithmétique des dates est interne, sans bibliothèque. Ajouter N mois garde le quantième, ramené au dernier jour du mois s'il n'existe pas (31 janvier + 1 mois = 28 ou 29 février).

Jours non ouvrés : samedi, dimanche et les onze jours fériés nationaux (Code du travail, article L3133-1) : 1er janvier, lundi de Pâques, 1er mai, 8 mai, Ascension (Pâques + 39 jours), lundi de Pentecôte (Pâques + 50 jours), 14 juillet, 15 août, 1er novembre, 11 novembre, 25 décembre. Pâques est calculé par l'algorithme grégorien anonyme (Meeus, Jones, Butcher). Les jours propres à l'Alsace-Moselle (Vendredi saint, 26 décembre) ne sont pas fériés pour l'application.

Règle de jours non ouvrés d'une échéance : date exacte (défaut), jour ouvré précédent, jour ouvré suivant. Le décalage s'applique à la date d'origine, jamais à une date surchargée par l'utilisateur.

## 2. Récurrences et occurrences

Une échéance produit une suite de dates d'origine ancrées sur sa date de début :

- ponctuelle : la date de début seule ;
- toutes les N semaines : date de début + 7 × N × k jours ;
- tous les N mois : jour du mois de la date de début, dans le mois de début + N × k ; un quantième absent du mois (29, 30, 31) donne le dernier jour du mois, sans dériver pour les mois suivants ;
- tous les N ans : jour et mois de la date de début, l'année de début + N × k ; le 29 février donne le 28 février les années non bissextiles ;
- option « dernier jour du mois » (mensuel et annuel uniquement) : le dernier jour de chaque mois concerné, dès le mois de début.

La fin par date compare la date d'origine : une occurrence du 31 décalée au lundi suivant reste dans l'échéance. La fin par nombre d'occurrences compte les dates d'origine générées, sautées comprises : sauter une occurrence ne prolonge pas l'échéance.

Une occurrence se résout à partir de sa date d'origine et de son éventuelle ligne `schedule_occurrences` :

| Ligne        | Date effective                             | Montant                            | Statut   |
| ------------ | ------------------------------------------ | ---------------------------------- | -------- |
| aucune       | date d'origine après la règle ECH-06       | montant de référence               | à venir  |
| `overridden` | date surchargée telle quelle, sinon ECH-06 | montant surchargé, sinon référence | à venir  |
| `skipped`    | sans objet                                 | sans objet                         | sautée   |
| `executed`   | date de l'opération générée                | montant de l'opération             | exécutée |

Une exception dont la date d'origine n'appartient plus à la récurrence est ignorée par les calculs ; `orphanedExceptions` liste celles à supprimer et signaler après une modification de l'échéance (ECH-08). Les lignes exécutées ne sont jamais orphelines : elles portent l'historique.

Prochaine occurrence (ECH-09, ECH-10) : la première occurrence à venir dont la date effective est aujourd'hui ou après, exceptions de date comprises. Une échéance inactive ne produit ni occurrence ni projection (ECH-11) ; ce filtre est appliqué par l'exécution et la prévision.

## 3. Équivalent mensuel

| Récurrence            | Équivalent mensuel      | Montant annualisé |
| --------------------- | ----------------------- | ----------------- |
| ponctuelle            | non compté              | 0                 |
| toutes les N semaines | montant × 52 / (12 × N) | montant × 52 / N  |
| tous les N mois       | montant / N             | montant × 12 / N  |
| tous les N ans        | montant / (12 × N)      | montant / N       |

L'équivalent mensuel est arrondi au centime le plus proche, demi vers le haut, par échéance : 44,16 € par an donne 3,68 €/mois, 120 € tous les 2 ans donne 5,00 €/mois, 10 € par semaine donne 43,33 €/mois. Le total mensuel d'une vue additionne ces valeurs arrondies. Le total annuel additionne les montants annualisés exacts et n'arrondit qu'une fois : 10 € par semaine compte pour 520,00 € par an, pas 12 × 43,33 €.

## 4. Exécution des occurrences

La tâche planifiée de 00:05 appelle `planExecutions` avec la date du jour, les échéances et les comptes actifs. Une occurrence est à exécuter quand :

- son échéance est active et tous les comptes qu'elle touche sont actifs ;
- sa date effective est comprise entre sa borne basse et aujourd'hui, bornes incluses ; la borne basse est la plus tardive entre la date de création de l'échéance (Europe/Paris) et les dates de solde initial des comptes qu'elle touche ;
- elle n'a pas de ligne `skipped` ni `executed`.

Avec cette borne, une échéance ressaisie avec une date de début passée (reprise Notion) n'exécute pas son historique, le rattrapage du worker ne couvre que les jours manqués depuis la création, et aucune opération générée ne précède le solde initial de son compte (ADR 0014). Chaque occurrence à exécuter donne ses mouvements : une dépense débite son compte, un revenu crédite le sien, avec le moyen de paiement et la catégorie de l'échéance ; un transfert débite la source et crédite la cible, sans catégorie. Le libellé de l'opération est celui de l'échéance, son origine « échéance », ses tags ceux de l'échéance (ADR 0018).

Le worker (`api/execution/`, ADR 0014) enregistre, dans une même transaction par occurrence, la ligne `executed` (date effective et montant de l'opération) et les opérations liées par `occurrence_id`, les deux mouvements d'un transfert partageant un `transfer_group_id`. L'idempotence (EXE-03) repose sur les contraintes uniques `(schedule_id, original_date)` et `(occurrence_id, account_id)`. La liste est triée par date effective, puis échéance, puis date d'origine.

Compte archivé (CPT-07) : aucune occurrence n'est exécutée sur lui ; un transfert dont un des deux comptes est archivé n'est pas exécuté du tout. Un moyen de paiement archivé (PAY-05) est sans effet : son compte reste impacté.

## 5. Soldes réels

Solde calculé d'un compte en fin de journée J (CPT-04) : solde initial, réputé en début de journée de sa date, plus les opérations datées de cette date jusqu'à J incluse. Les opérations antérieures à la date du solde initial sont ignorées. Avant la date du solde initial, le compte n'a pas de solde (`null`). Pour un jour passé, la prévision affiche ce solde réel (PRV-09, `endOfDayBalances`).

Placements (CPT-06, natures Assurance-vie, PEA ou compte-titres, Portefeuille crypto ; ADR 0019) : une valorisation est la valeur de fin de journée de sa date, comprise entre la date du solde initial et aujourd'hui. Le solde de référence en fin de journée J est la dernière valorisation datée de J ou avant, plus les opérations datées après elle jusqu'à J ; sans valorisation, c'est le solde calculé. Ce solde sert pour les jours passés (`endOfDayBalances`), le point de départ de la prévision, la vue « Où est mon argent » et le patrimoine ; l'écart des relevés (section 11) reste calculé sur le solde calculé. Total versé à une date : solde initial plus les mouvements de transfert du compte, entrants moins sortants, datés de la date du solde initial à cette date. Plus ou moins-value latente : solde de référence d'aujourd'hui moins total versé d'aujourd'hui, en euros et en pourcentage du total versé ; aucune avant la première valorisation. US-16 : 1 000 € de solde initial, 1 200 € de transferts entrants et une valorisation de 2 530 € donnent 2 200 € versés et +330 € (+15,0 %).

## 6. Enveloppes

Catégories d'une enveloppe : ses catégories et leurs sous-catégories. Si une sous-catégorie est explicitement dans une autre enveloppe que son parent, la plus spécifique gagne. Seules les enveloppes actives comptent.

Pour un mois civil M :

- budget(M) = exception mensuelle de M si elle existe (ENV-07), sinon montant mensuel ;
- consommé(M) = débits moins crédits des opérations datées de M sur les catégories de l'enveloppe, tous comptes et toutes origines confondus, transferts exclus ;
- report(M) = 0 en remise à zéro ; en mode report, disponible(M - 1), positif ou négatif, la chaîne démarrant à 0 au mois de création de l'enveloppe (Europe/Paris) avec le montant mensuel actuel ;
- disponible(M) = budget(M) + report(M) - consommé(M).

Lissage dans la prévision (PRV-04), débité sur le compte par défaut de l'enveloppe (compte du moyen de paiement ou compte direct) :

- mois en cours : reste = max(0, disponible - occurrences à venir du mois sur les catégories de l'enveloppe), réparti sur les jours d'aujourd'hui à la fin du mois ;
- mois futurs : reste = max(0, budget - opérations déjà saisies datées de ce mois - occurrences du mois sur les catégories de l'enveloppe), réparti sur tous les jours du mois ; le report n'est pas projeté.

Les occurrences retenues sont celles que la prévision projette, comptées dans le mois de leur date effective. La répartition se fait au centime inférieur, le reste d'arrondi porté sur le dernier jour du mois : 300 € en décembre donnent 9,67 € du 1er au 30 et 9,90 € le 31. Une enveloppe inactive ou dont le compte par défaut est archivé n'est pas projetée.

## 7. Prévision

Horizon : d'aujourd'hui à aujourd'hui + N mois (N de 1 à 12), quantième ramené au dernier jour du mois si absent, bornes incluses. Pour chaque compte actif et chaque jour J de l'horizon :

```math
S_c(J) = S_c(J-1) + \sum_{f \in F_c(J)} m(f) - L_c(J) + I_c(J)
```

- point de départ : solde calculé en fin d'aujourd'hui (opérations datées d'aujourd'hui ou avant), ou solde de référence pour un placement (section 5), auquel s'appliquent les flux d'aujourd'hui ;
- flux d'occurrence : occurrences à venir des échéances actives dont tous les comptes sont actifs, à leur date effective ; une occurrence due (date effective entre la borne basse de la section 4 et aujourd'hui) que le worker n'a pas encore exécutée est projetée aujourd'hui, pour que la prévision ne change pas au passage du worker ;
- flux d'opération : opérations des comptes actifs datées après aujourd'hui et dans l'horizon ;
- part d'enveloppes L : section 6 ;
- intérêts I : montant de l'échéance système d'intérêts au jour de capitalisation, calculé sur les soldes réels puis prévisionnels (section 12) ; une estimation nulle n'est pas projetée.

Chaque jour porte son solde de fin de journée et ses flux (occurrence avec libellé, montant signé, montant de l'occurrence, surcharge, mode de déclenchement et marqueur abonnement ; opération ; part d'enveloppe), base du calendrier (CAL-02).

Vue agrégée (PRV-05) : somme des comptes actifs jour par jour, avec sous-totaux par usage. Les transferts internes y sont neutres ; un transfert vers ou depuis un compte archivé n'est pas projeté, ce qui préserve cette neutralité.

Indicateurs (PRV-07), par compte et pour la vue agrégée : solde minimal sur l'horizon et sa première date en cas d'égalité, premier jour strictement sous le seuil d'alerte (aucun sans seuil, toujours aucun pour la vue agrégée), premier jour strictement négatif.

Calendrier et courbe (CAL-01 à CAL-05, DSH-01, ADR 0016), assemblés par `api/forecast/views.ts` :

- solde d'un jour passé : solde calculé de fin de journée (section 5) ; en vue agrégée, somme des comptes actifs qui ont déjà un solde ce jour-là (`aggregateEndOfDayBalances`), aucun solde si aucun n'en a ;
- solde d'aujourd'hui et d'un jour futur : solde prévisionnel ci-dessus ;
- en vue agrégée, un mouvement de transfert dont la contrepartie est un compte actif et une occurrence de transfert sont neutres et ne sont pas listés ;
- courbe : les 30 jours précédant aujourd'hui en solde réel, puis l'horizon en solde prévisionnel ; point annoté = minimum de l'horizon.

## 8. Répartition et revenus/dépenses

Ces deux agrégats portent sur les opérations réelles. Les opérations de catégorie Ajustement sont exclues partout.

Répartition d'une période (DSH-02, `spendingBreakdown`) :

- Needs et Wants : débits moins crédits des opérations sur les catégories de dépenses, regroupés par catégorie de premier niveau, le groupe étant celui du premier niveau ; un crédit sur une catégorie de dépenses est un remboursement ;
- Save (CAT-03) : montant des transferts d'un compte d'usage Courant vers un compte d'usage Épargne de précaution, Épargne ou Investissement, datés par leur mouvement de débit ; les retraits vers le compte courant ne sont pas déduits ;
- à catégoriser : total à part des débits sans catégorie hors transfert.

Les deux mouvements de chaque transfert doivent figurer dans les opérations fournies ; un transfert incomplet est une erreur.

Revenus et dépenses par mois (DSH-03, partie réelle, `monthlyIncomeExpenses`) : transferts internes exclus ; une opération catégorisée compte selon le type de sa catégorie, signée (un crédit sur une catégorie de dépenses diminue les dépenses) ; une opération à catégoriser compte en dépense si c'est un débit, en revenu si c'est un crédit. Solde mensuel = revenus - dépenses.

Partie prévisionnelle (`forecastMonthlyIncomeExpenses`, ADR 0017) : les flux de la prévision de la section 7 regroupés par mois, d'aujourd'hui à la fin de l'horizon : occurrences de dépense et de revenu (transferts exclus), parts d'enveloppe comptées en dépenses, opérations futures déjà saisies selon les mêmes règles que la partie réelle. Le mois en cours additionne sa partie réelle à date et sa partie prévue.

## 9. Lecture des CSV et doublons

Le fichier est décodé selon l'encodage choisi (marque d'ordre des octets retirée), découpé par csv-parse, puis chaque ligne de données (hors lignes ignorées en début et en fin, hors en-tête, hors lignes vides) est interprétée :

- date selon le format choisi, refusée si elle n'existe pas (JJ/MM/AA est lu en 20AA) ;
- montant : espaces, espaces insécables et symbole € ignorés, signe moins final accepté, séparateur de milliers retiré selon le séparateur décimal, deux décimales au plus ; en colonnes débit et crédit, le débit est négatif, le crédit positif, et une ligne qui remplit les deux ou aucun est en erreur ;
- libellé bancaire : espaces réduits, vide refusé.

Motifs d'erreur : colonne absente, date illisible, montant illisible, montant nul, débit et crédit renseignés, libellé vide, date antérieure au solde initial du compte.

Clé de doublon (IMP-05) : date, montant, rang parmi les lignes identiques du même jour dans le fichier, libellé normalisé (majuscules, sans accents, espaces réduits). Une ligne dont la clé existe déjà sur une opération du compte est un doublon strict.

## 10. Règles et rapprochement

Règles (REG-01, REG-02) : la première règle active satisfaite, dans l'ordre de priorité, s'applique ; elle donne sa catégorie ou son compte de transfert, et ses éventuels tags (ADR 0018). Une règle est satisfaite si son compte (facultatif) est celui de la ligne, son sens convient, la valeur absolue du montant est dans la plage, et le libellé bancaire contient le motif ou commence par lui (casse et accents ignorés), ou correspond à l'expression régulière (accents retirés, casse ignorée, moteur RE2).

Occurrences candidates d'une ligne ou d'une opération (RAP-01) : même compte, même sens, date effective à ±5 jours, écart de montant au plus égal à la tolérance de l'échéance (pourcentage du montant de l'occurrence, arrondi au centime inférieur), occurrence ni sautée ni déjà rapprochée d'une ligne bancaire, postérieure à la borne basse de la section 4. Score (RAP-02) :

```math
score = 0{,}4 \times \left(1 - \frac{|\Delta j|}{5}\right) + 0{,}4 \times \left(1 - \frac{|\Delta m|}{tolérance}\right) + 0{,}2 \times similarité
```

La similarité est le coefficient de Dice entre les mots normalisés du libellé bancaire et ceux du libellé de l'échéance ou de chacun de ses motifs appris, le plus élevé. Avec une tolérance nulle, le terme de montant vaut 1 pour un montant exact, 0 sinon. Classement par score décroissant, puis écart de jours croissant, puis date effective ; dans un lot, les occurrences sont attribuées aux lignes par score décroissant, une occurrence au plus par ligne.

## 11. Relevés

Écart d'un relevé (CPT-05) = solde relevé − solde calculé en fin de sa date (section 5), recalculé à chaque lecture : une opération ajoutée ou modifiée à une date antérieure change l'écart. Corriger l'écart crée une opération de la catégorie Ajustement égale à l'écart, à la date du relevé ; elle est exclue des agrégats de la section 8.

## 12. Plafonds et intérêts

Livrets réglementés et épargne logement uniquement (ADR 0020). Solde hors intérêts capitalisés : solde − intérêts capitalisés déclarés dans le solde initial − opérations de la catégorie Intérêts. Dans la prévision, il suit les flux du jour hors intérêts. Dépassement d'un jour : solde hors intérêts de fin de journée − plafond, s'il est positif. Dépassement d'une occurrence créditrice : min(montant, dépassement du jour). US-15 : un LEP plafonné à 10 000 €, à 9 950 €, reçoit 100 € le 6 décembre (dépassement de 50 €) puis 100 € le 6 janvier (100 €).

Capitalisation au 31 décembre ou à la date anniversaire (jour et mois de la date, le 29 février donnant le 28). La période d'une capitalisation C court du lendemain de la capitalisation précédente à C, et au plus tôt de la date du solde initial. Taux en vigueur : le dernier dont la date d'effet est antérieure ou égale ; aucun avant le premier.

- Quinzaines (1er au 15, 16 à la fin du mois) : une quinzaine appartient à la période qui contient son début. Solde retenu = solde de fin de la veille de son début (solde initial si elle commence à sa date) + retraits datés de la quinzaine, jusqu'à C au plus ; intérêts = solde retenu positif × taux à son début / 24. Un versement produit à partir de la quinzaine suivante, un retrait cesse de produire dès sa propre quinzaine.
- Journalière : pour chaque jour de la période, solde de fin de journée positif × taux du jour / 365, le jour C sans l'opération d'intérêts qu'il porte.

La somme est exacte, arrondie une fois au centime, demi vers le haut. Exemples : 10 000 € à 2,4 % sur une année donnent 240,00 € ; un versement de 2 400 € le 10 mars et un retrait de 1 000 € le 20 juin y ajoutent 19 quinzaines de 2,40 € et retirent 13 quinzaines de 1,00 €, soit 272,60 € ; à 2,4 % puis 1,7 % à partir du 1er août, 140,00 € + 10 × 7,0833 € = 210,83 €.

Intérêts acquis : quinzaines terminées ou jours écoulés de la période en cours, sur les soldes réels ; une capitalisation du jour ouvre déjà la période suivante. Montant projeté : intérêts de la période entière, calculés par la prévision sur 12 mois. Le 31 décembre, la tâche de 00:05 calcule les intérêts de l'année sur les soldes réels et génère l'opération ; une estimation nulle marque l'occurrence comme sautée.

## 13. Alertes

Évaluées par la tâche de 08:00, au démarrage du worker et après chaque écriture d'un utilisateur, rappels exceptés (ADR 0021). Une clé de déduplication par utilisateur garantit une seule notification par événement.

- Solde bas (NOTIF-01) : pour un compte actif avec un seuil, minimum du solde prévisionnel de fin de journée d'aujourd'hui à J+7 inclus, à sa première date. Minimum sous le seuil sans épisode ouvert : ouverture et notification. Épisode ouvert : le minimum et sa date sont mis à jour, et une nouvelle notification part seulement si le minimum est inférieur au dernier notifié. Minimum au seuil ou au-dessus, seuil retiré ou compte archivé : l'épisode se ferme ; le suivant notifiera de nouveau. US-13 : seuil de 200 € et minimum prévu de 150 € dans 4 jours, une alerte ; le lendemain sans changement, aucune ; minimum descendu à 100 €, une seconde.
- Rappel (NOTIF-02) : pour une échéance active en mode Manuel, avec N = délai de rappel (0 à 30, 2 par défaut), rappel le jour J − N si l'occurrence de date effective J est en attente et N > 0, puis le jour J quel que soit son état. Une occurrence sautée ou rapprochée d'une opération réelle n'en reçoit aucun. US-14 : paiement manuel le 10 décembre, rappels le 8 et le 10.
- Plafond (LIV-02) : une notification par occurrence prévue dont le dépassement (section 12) est positif dans l'horizon, et une par jour où le solde réel hors intérêts capitalisés dépasse le plafond.

## 14. Tests

Les tests des moteurs tournent dans le projet Vitest `shared`, sans base de données. `shared/engines/user-stories.test.ts` transcrit US-06, US-07, US-08, US-10, US-11 et US-12 avec leurs valeurs chiffrées ; chaque module a ses tests unitaires. `npm run test:coverage` échoue sous 90 % de couverture (instructions, branches, fonctions, lignes) sur `shared/engines/` (NF-QUA-02). Sur un jeu de 20 comptes, 200 échéances, 10 enveloppes et 10 000 opérations, la prévision sur 12 mois prend environ 75 ms sur un poste de développement (NF-PERF-02 : 500 ms).
