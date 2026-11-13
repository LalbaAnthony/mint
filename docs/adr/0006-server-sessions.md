# ADR 0006 · Sessions serveur en base et révocation

Statut : acceptée · 13 novembre 2026 · Exigences : AUTH-05, ADM-04, NF-SEC-07, section 5.1

## Contexte

AUTH-05 impose des sessions serveur (express-session, store PostgreSQL), un cookie HttpOnly, Secure, SameSite=Lax à expiration glissante de 30 jours, la liste des sessions actives, la déconnexion globale et la révocation de toutes les sessions au changement de mot de passe. La table `sessions` du modèle porte `user_id`, ce que les stores existants (`connect-pg-simple`) ne gèrent pas.

## Décision

- Store express-session écrit pour Mint (`api/auth/session-store.ts`) sur la table `sessions` : identifiant technique UUID exposé par l'API, `sid` jamais exposé, `user_id` en cascade depuis `users`, `user_agent` et `ip` relevés à la connexion.
- Seules les sessions authentifiées sont enregistrées (`saveUninitialized: false`) ; le store refuse une session sans utilisateur.
- `rolling: true` avec une durée de 30 jours ; l'expiration en base est glissée au plus une fois par minute pour limiter les écritures.
- Cookie `__Host-mint-session` (HttpOnly, Secure, SameSite=Lax, `Path=/`) quand `APP_ORIGIN` est en HTTPS, `mint-session` sans `Secure` en développement HTTP. `trust proxy` vaut 1 : Apache est le seul saut.
- À chaque requête authentifiée, l'utilisateur est relu ; un compte supprimé ou désactivé détruit la session.
- Révocation, décision du porteur : le changement de mot de passe (profil ou lien de réinitialisation) et la déconnexion globale révoquent toutes les sessions, celle en cours comprise. La désactivation par l'administrateur révoque toutes les sessions de l'utilisateur visé.
- Connexion automatique après l'acceptation d'une invitation (US-01).

## Conséquences

- Une requête SQL de plus par requête authentifiée (lecture de session et de l'utilisateur).
- Les sessions expirées restent en base jusqu'à la tâche de purge de 03:00 (section 7.3), à livrer avec le worker.
- Après un changement de mot de passe, l'utilisateur se reconnecte aussi sur l'appareil courant.
