# ADR 0017 · Import bancaire, règles, rapprochement et tableau de bord du lot 2

Statut : acceptée · 15 novembre 2026 · Exigences : IMP-01 à IMP-08, REG-01 à REG-04, RAP-01 à RAP-08, CPT-05, CPT-08, EXE-05, OPE-05, OPE-07, CAT-07, DSH-02 à DSH-04, NF-PERF-03, NF-SEC-04, NF-QUA-04, US-05, US-09, US-17, US-18 · Amende la section 5.4 du cahier des charges

## Contexte

Le lot 2 branche les données bancaires réelles. Le cahier des charges laisse ouverts la conservation du fichier pendant l'assistant de réglages, les formats de date, le moteur des expressions régulières, la formule du score de rapprochement, le rapprochement d'une opération saisie à la main, le stockage des états « rapprochée » et « non confirmée », la portée de l'annulation d'un import, le traitement du mois en cours dans DSH-03 et ce que compte le bandeau. Il contient aussi une contradiction : REG-01 (lot 2) prévoit une action « tags » alors que les tags (CAT-09) arrivent au lot 3. Les arbitrages ci-dessous sont ceux du porteur du projet.

## Décision

Import CSV :

- Le fichier est envoyé brut (`POST /accounts/:id/imports`, corps `text/csv` jusqu'à 5 Mo) et conservé dans le lot en attente (`import_batches.raw_file`), relu par l'API à chaque aperçu avec csv-parse et iconv-lite, puis effacé à la validation ; la purge de 03:00 supprime les lots restés en attente plus de 24 heures, avec leurs lignes en transit.
- Réglages : séparateur (point-virgule, virgule, tabulation), encodage (UTF-8, Windows-1252), ligne d'en-tête, lignes ignorées en début et en fin, six formats de date (JJ/MM/AAAA, JJ/MM/AA lu 20AA, JJ-MM-AAAA, JJ.MM.AAAA, AAAA-MM-JJ, MM/JJ/AAAA), séparateur décimal, colonnes date, libellé et montant (signé, ou débit et crédit). Sans réglage mémorisé, l'API devine l'encodage (UTF-8 valide ou Windows-1252) et le séparateur.
- L'aperçu enregistre les lignes interprétées dans `import_rows`, avec le motif des lignes en erreur, les doublons stricts, la règle satisfaite et les occurrences candidates ; la validation applique exactement cet aperçu. Les réglages sont mémorisés pour le compte à la validation (IMP-03) ; à l'import suivant, ils sont appliqués sans passer par l'assistant.
- Un doublon strict est exclu par défaut et peut être réintégré ligne par ligne ; une ligne sans catégorie peut être validée et reste « à catégoriser » ; une ligne antérieure au solde initial du compte est en erreur.
- Tout lot validé peut être annulé : ses opérations créées sont supprimées même si elles ont été modifiées depuis (un transfert issu d'une de ses lignes perd ses deux mouvements), les opérations fusionnées reprennent leurs valeurs, une occurrence exécutée par une ligne arrivée en avance redevient à venir ; les motifs appris restent.
- La validation d'un lot accepte un corps JSON jusqu'à 4 Mo : chaque route déclare désormais le format et la limite de son corps, 16 Ko en JSON par défaut, toujours lu avant la session et le contrôle CSRF.

Règles :

- Expressions régulières exécutées par re2js (portage JavaScript de RE2, temps linéaire, motif de 200 caractères au plus) ; une expression invalide ou non supportée par RE2 est refusée à l'enregistrement. Les conditions « contient » et « commence par » ignorent la casse et les accents.
- Au lot 2, une règle classe dans une catégorie ou convertit en transfert ; l'action « tags » arrive au lot 3 avec la table des tags.
- Création rapide (REG-03) : depuis une opération qui porte un libellé bancaire, la vue Règles s'ouvre sur une règle « contient » préremplie avec ce libellé sans chiffres ni dates, son sens et sa catégorie.
- Une catégorie supprimée transmet ses règles à sa catégorie de remplacement (CAT-07) ; un compte référencé par une règle ne peut pas être supprimé.

Rapprochement :

- Score = 0,4 × (1 − écart de jours / 5) + 0,4 × (1 − écart de montant / tolérance) + 0,2 × similarité du libellé (coefficient de Dice sur les mots normalisés, le meilleur entre le libellé de l'échéance et ses motifs). Le meilleur score est présélectionné, l'égalité départagée par la date la plus proche ; dans un lot, une occurrence n'est proposée qu'à une ligne.
- Une occurrence candidate n'est pas encore rapprochée d'une ligne bancaire : à venir, due, ou exécutée avec une opération générée ou saisie. La validation fusionne la ligne dans cette opération (RAP-03, y compris pour une opération saisie à la main) ou marque l'occurrence exécutée et crée l'opération (RAP-04) ; pour un transfert arrivé en avance, la contrepartie générée est créée sur l'autre compte.
- Opération saisie à la main (RAP-01) : si des occurrences candidates existent après l'enregistrement, une modale propose la meilleure ; rien n'est rapproché sans confirmation (RAP-07). Le rapprochement manuel (RAP-05) remplace l'opération générée d'une occurrence exécutée ; il ne concerne pas les transferts, qui se rapprochent par l'import mouvement par mouvement (RAP-08).
- « Rapprochée » et « non confirmée par la banque » sont déduites, pas stockées : rapprochée = liée à une occurrence avec une origine manuelle ou import ; non confirmée = origine « échéance » sur un compte ayant reçu au moins un import validé. La colonne `bank_confirmed` de la section 5.4 n'est pas créée.
- Conversion en transfert (OPE-07) : l'opération est liée à une opération opposée du compte de contrepartie, ni transfert ni rapprochée, à ±3 jours, la plus proche ; à défaut, la contrepartie est créée.

Relevés (CPT-05, CPT-08) : un relevé par compte et par date, daté au plus aujourd'hui et pas avant le solde initial ; l'écart est recalculé à chaque lecture ; « Corriger l'écart » crée une opération de la catégorie Ajustement à la date du relevé. L'écart non résolu de la vue Comptes est celui du relevé le plus récent. Les relevés se gèrent depuis le menu du compte.

Tableau de bord :

- DSH-02 : période du mois (navigation de mois en mois) ou personnalisée ; groupes puis catégories de premier niveau au clic, nuances de la palette du groupe dans l'ordre d'affichage, hachure au-delà de huit catégories ; écart défavorable (Needs ou Wants au-dessus de la cible, Save en dessous) en `text-warning`.
- DSH-03 : les 11 mois précédents en réel, le mois en cours en réel à date complété par son reste prévu (occurrences, parts d'enveloppe et opérations futures déjà saisies), puis les mois de l'horizon en prévu ; la part prévue est hachurée et empilée sur la part réelle.
- DSH-04 : patrimoine des comptes actifs, comptes dont le solde prévisionnel passe sous le seuil dans les 7 prochains jours, opérations à catégoriser (lien vers la liste filtrée) et propositions de rapprochement des lots d'import en attente (lien vers le dernier lot).

## Conséquences

- Migrations 0016 à 0019 : tables `import_mappings`, `import_batches` (avec `raw_file`), `import_rows` (avec `error`, `duplicate`, `proposed_rule_id`, `proposed_transfer_account_id` et `candidates`), colonnes bancaires de `transactions` et de `schedules`, `categorization_rules` sans `action_tag_ids`, `account_statements`.
- Dépendances de l'API : csv-parse, iconv-lite et re2js.
- Un import de 2 000 lignes (lecture, règles, rapprochement, validation) est mesuré par un test sous 5 secondes (NF-PERF-03).
- Un scénario Playwright couvre l'import d'une ligne et la confirmation de sa proposition de rapprochement (NF-QUA-04).
