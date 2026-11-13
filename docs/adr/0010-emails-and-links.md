# ADR 0010 · Emails transactionnels et liens à jeton

Statut : acceptée · 13 novembre 2026 · Exigences : AUTH-01, AUTH-04, AUTH-07, ADM-01, ADM-02, ADM-05, section 5.1

## Contexte

Invitation (7 jours), réinitialisation (1 heure) et changement d'email reposent sur des liens à usage unique. La langue de l'invité n'est connue qu'à l'acceptation. Le changement d'email « confirmé sur la nouvelle adresse » n'a ni table ni durée dans le cahier des charges.

## Décision

- Jetons de 256 bits en base64url ; seule leur empreinte SHA-256 est stockée.
- Le jeton voyage dans le fragment de l'URL (`/invitation#token=...`, `/reset-password#token=...`, `/confirm-email#token=...`) : il n'apparaît dans aucune requête HTTP ni aucun journal d'Apache ou de nginx. Le front le lit et l'envoie dans le corps d'un POST.
- Invitation : email bilingue, français puis anglais, décision du porteur. Un renvoi remplace l'empreinte et l'échéance ; l'ancien lien cesse de fonctionner. Renvoi et révocation possibles pour une invitation en attente ou expirée seulement.
- Réinitialisation : réponse 202 identique que l'adresse existe ou non, envoi hors du temps de réponse. Une nouvelle demande supprime les liens non utilisés. Rien n'est envoyé à un compte désactivé.
- Changement d'email, décision du porteur : table `email_change_tokens` (`user_id`, `new_email`, `token_hash`, `expires_at`, `used_at`), validité 1 heure, demande confirmée par le mot de passe actuel, email de confirmation envoyé à la nouvelle adresse dans la langue de l'utilisateur.
- Emails en texte brut, envoyés par nodemailer en SMTP. `SMTP_TLS_MODE` vaut `tls` (TLS implicite), `starttls` (STARTTLS obligatoire) ou `none` (Mailpit en développement).
- Un échec d'envoi annule la création ou le renouvellement d'invitation et l'émission du jeton de changement d'email (502 `mail_delivery_failed`).

## Conséquences

- Le modèle de données compte 30 tables (section 5.1 du cahier des charges).
- Les jetons expirés restent en base jusqu'à la purge de 03:00 (section 7.3).
