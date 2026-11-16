# ADR 0024 · Date de création métier des échéances et des enveloppes

Statut : acceptée · 16 novembre 2026 · Exigences : EXE-01, ENV-04, NF-QUA-03 · Amende la section 5.5 du cahier des charges, complète les ADR 0013 et 0014

## Contexte

Deux règles de calcul dépendent du jour de création : la borne basse des occurrences exécutables d'une échéance (ADR 0014) et le début de la chaîne de report d'une enveloppe (ENV-04). Elles lisaient `created_at`, horodatage technique posé par Sequelize avec l'horloge réelle, alors que tout le reste du calcul suit l'horloge injectée de l'application. Les tests, qui figent cette horloge, dépendaient ainsi de la date réelle : deux tests d'import ont échoué dès que la date réelle a dépassé leur scénario. Poser `created_at` avec l'horloge injectée aurait donné le même horodatage à toutes les lignes créées dans un test et rendu aléatoire l'ordre des listes triées par date de création.

## Décision

- Nouvelle colonne `created_on` (date) sur `schedules` et `envelopes` : jour de création selon l'horloge de l'application (Europe/Paris), posé à la création d'une échéance, d'une enveloppe ou d'une échéance système d'intérêts. Les créations directes hors API (jeu de données, tests de base) prennent le jour courant.
- Les règles de calcul lisent `created_on` ; `created_at` reste l'horodatage technique qui ordonne les listes.

## Conséquences

- Migration 0025 : colonne ajoutée et initialisée depuis `created_at` (date de Paris) pour les lignes existantes, puis rendue obligatoire, avec le jour courant de Paris par défaut.
- Aucun changement d'API ni de résultat en production : les deux horloges y coïncident.
- Un test qui simulait une enveloppe plus ancienne en modifiant `created_at` modifie désormais `created_on`.
