# ADR 0022 · Passkeys, export et suppression de compte

Statut : acceptée · 15 novembre 2026 · Exigences : AUTH-03, AUTH-06, AUTH-08, AUTH-09, NF-RGPD-01, NF-SEC-05, NF-SEC-06, CHG-41, CHG-59, US-03, US-19 · Amende la section 5.1 du cahier des charges, complète les ADR 0006, 0008 et 0009

## Contexte

AUTH-03 laisse ouverts le parcours de connexion par passkey, la reconfirmation avant un ajout, le stockage du challenge, la gestion des passkeys et la limitation des échecs. AUTH-08 ne fixe ni la bibliothèque ZIP, ni le contenu du JSON « intégral », ni le format des CSV, ni la reconfirmation. AUTH-09 ne dit rien des invitations adressées à l'utilisateur, du décompte du dernier administrateur ni de l'après-suppression côté navigateur. Les sessions existantes exigent un utilisateur : aucune session anonyme ne peut porter un challenge de connexion. Les arbitrages ci-dessous sont ceux du porteur du projet.

## Décision

Passkeys (AUTH-03, US-03) :

- `@simplewebauthn/server` 14.0.x (14.1.0 n'avait que 9 jours) et `@simplewebauthn/browser` 14 côté front. Partie de confiance : identifiant = nom d'hôte de `APP_ORIGIN`, origine attendue = `APP_ORIGIN`, nom « Mint ».
- Passkeys découvrables (`residentKey: 'required'`) et vérification de l'utilisateur exigée (`userVerification: 'required'`), attestation `none`. Le bouton « Se connecter avec une passkey » ouvre le sélecteur du système sans saisie d'email ; il n'apparaît que si le navigateur gère WebAuthn. L'identifiant d'utilisateur transmis à l'authentificateur est l'UUID du compte, jamais l'email ; il est comparé au `userHandle` de l'assertion.
- Challenge en mémoire de l'API, sous une clé aléatoire posée dans un cookie `HttpOnly` `SameSite=Strict` (`__Host-mint-webauthn` en HTTPS), à usage unique, valable 5 minutes, lié à la cérémonie (connexion, ajout, suppression) et à l'utilisateur pour l'ajout et la suppression. Au plus 10 000 challenges en attente, les plus anciens évincés. Un redémarrage de l'API fait recommencer la cérémonie (une seule instance, comme l'ADR 0008).
- Ajout depuis le profil après le mot de passe actuel, qui compte pour le verrou du compte (AUTH-06). Nom de 1 à 60 caractères, prérempli d'après l'appareil, renommable ; 10 passkeys au plus par utilisateur ; suppression après une simple confirmation. Une passkey supprimée est inconnue : toute assertion avec elle est refusée (401 `passkey_invalid`).
- Les échecs de connexion par passkey (inconnue, signature invalide, challenge absent, expiré ou rejoué) comptent dans le limiteur par adresse IP ; le verrou par compte reste réservé au mot de passe. Un compte désactivé est refusé (403) après vérification. Le compteur de signature et la dernière utilisation sont mis à jour à chaque connexion.
- Événements d'audit ajoutés : `passkey_registered`, `passkey_renamed`, `passkey_deleted`, `data_exported`, `account_deleted` ; `login_succeeded` et `login_failed` portent `method: 'passkey'` pour ce parcours.

Export (AUTH-08, US-19) :

- `POST /profile/export` après le mot de passe actuel, réponse `application/zip` en flux, produite par `yazl`, nommée `mint-export-AAAA-MM-JJ.zip` (date de Paris), `Cache-Control: no-store`.
- `mint-export.json` (format `mint-export`, version 1) : profil sans hash de mot de passe, comptes, moyens de paiement, catégories, tags, opérations avec leurs tags, échéances avec leurs tags (échéances système comprises) et leurs exceptions d'occurrence, enveloppes avec leurs catégories, règles, mappings et historique d'import sans fichier brut, relevés, valorisations, taux d'intérêt, notifications et préférences, passkeys et appareils push sans clé ni endpoint. Ni sessions, ni jetons, ni données de travail (empreintes de doublon, instantanés d'annulation d'import, lignes d'import en transit, épisodes d'alerte).
- Neuf CSV, nommés et titrés dans la langue du profil : comptes, opérations, échéances (hors échéances système, masquées des vues), enveloppes, catégories, tags, règles, relevés, valorisations. Format Excel français : UTF-8 avec BOM, point-virgule, fins de ligne CRLF, montants en euros à virgule décimale sans séparateur de milliers, dates AAAA-MM-JJ, booléens « oui » et « non ». Les références sont des noms (compte, catégorie sous la forme « Parent > Sous-catégorie », tags séparés par des virgules) ; les valeurs énumérées gardent leur code technique. Une cellule de texte commençant par `=`, `+`, `-`, `@`, tabulation ou retour chariot est préfixée d'une apostrophe, contre l'injection de formules.

Suppression (AUTH-09, US-19) :

- `POST /profile/delete` avec l'email du compte (comparé sans casse) et soit le mot de passe, soit une assertion d'une passkey de l'utilisateur, obtenue par `POST /profile/delete/options` (passkeys de l'utilisateur seulement, 409 `no_passkey` sans passkey). Ordre des contrôles : email (400 `email_mismatch`), dernier administrateur, preuve d'identité.
- Refus (409 `last_admin`) quand l'utilisateur est administrateur et qu'aucun autre administrateur actif n'existe.
- Dans une transaction : suppression des invitations adressées à son email, puis de l'utilisateur, dont toutes les données suivent par cascade (sessions comprises) ; puis fin de la session courante. Les invitations qu'il a envoyées et les plafonds qu'il a modifiés gardent leur ligne, référence mise à nul. L'adresse peut être réinvitée aussitôt.
- Navigateur : désabonnement push de cet appareil (un échec est signalé, sans conséquence puisque l'abonnement n'existe plus côté serveur), remise à zéro de la session, retour à l'écran de connexion avec un message de confirmation.

Interface :

- Carte « Passkeys » après la carte « Compte » du profil ; carte « Mes données » en bas de page, avec « Exporter mes données » en `soft` primaire et « Supprimer mon compte » en `outline` error ; confirmation de suppression en `solid` error, alternative passkey en `outline` neutre (CHG-12, CHG-59).
- Les routes de passkeys et de données personnelles ne déclenchent pas de réévaluation des alertes (ADR 0021).

## Conséquences

- Migration 0024 : table `webauthn_credentials` (identifiant de credential unique, clé publique, compteur `bigint`, transports, nom de 1 à 60 caractères, dernière utilisation), suppression en cascade depuis `users`.
- Routes `POST /auth/passkey/options`, `POST /auth/passkey/login`, `GET /profile/passkeys`, `POST /profile/passkeys/options`, `POST /profile/passkeys`, `PATCH` et `DELETE /profile/passkeys/:id`, `POST /profile/export`, `POST /profile/delete/options`, `POST /profile/delete`. Les routes acceptent désormais une réponse binaire (`mediaType`), décrite comme telle dans l'OpenAPI.
- Les passkeys sont liées au domaine : changer `APP_ORIGIN` de domaine rend toutes les passkeys inutilisables, le mot de passe reste le recours.
- Les tests de l'API utilisent un authentificateur logiciel (clé P-256, attestation `none`) et vérifient qu'après une suppression aucune table portant `user_id` ne contient de ligne de l'utilisateur.
- Le graphique des valorisations est chargé en différé, comme ceux du tableau de bord (ADR 0015).
