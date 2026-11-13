# ADR 0009 · Journal d'audit dans les journaux structurés

Statut : acceptée · 13 novembre 2026 · Exigences : NF-SEC-06, NF-OPS-03

## Contexte

NF-SEC-06 exige un journal d'audit des connexions et des actions d'administration, sans en préciser le support. Les journaux de l'API sont déjà des lignes JSON sur la sortie standard, avec rotation par Docker.

## Décision

- Les événements d'audit sont des lignes du journal structuré, marquées `"audit": true`, d'événement préfixé `audit_` : `login_succeeded`, `login_failed`, `login_blocked`, `login_refused_disabled`, `logout`, `sessions_revoked`, `password_changed`, `password_reset_requested`, `password_reset_completed`, `email_change_requested`, `email_changed`, `invitation_created`, `invitation_resent`, `invitation_revoked`, `invitation_accepted`, `user_disabled`, `user_enabled`, `user_password_reset_sent`, `admin_created`, `admin_promoted`.
- Champs : identifiants d'utilisateur, d'administrateur ou d'invitation, adresse IP, email tenté pour un échec de connexion. Jamais de mot de passe, de jeton ni de donnée financière.
- La CLI d'administration écrit les mêmes événements.

## Conséquences

- Aucun changement de schéma.
- Rétention limitée à la rotation Docker (5 fichiers de 10 Mo) ; un historique long demande une collecte externe des journaux.
- Recherche : `docker compose logs api | grep '"audit":true'`.
