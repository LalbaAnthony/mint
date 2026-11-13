# ADR 0008 · Limitation des tentatives en mémoire

Statut : acceptée · 13 novembre 2026 · Exigences : AUTH-04, AUTH-06

## Contexte

AUTH-06 bloque un compte 15 minutes après 5 échecs en 15 minutes et demande une limitation complémentaire par adresse IP, sans seuil. Le modèle de données ne prévoit aucun stockage pour ces compteurs. Un seul conteneur `api` tourne (section 7.2).

## Décision

- Compteurs dans la mémoire du processus `api` (`api/auth/attempt-limiter.ts`), fenêtre glissante, horloge injectée.
- Compte : clé = email en minuscules, qu'il existe ou non ; 5 échecs en 15 minutes bloquent 15 minutes. Le cinquième échec répond déjà 429 `account_locked` avec `Retry-After`. Une connexion réussie remet le compteur à zéro. Un mauvais mot de passe actuel saisi depuis le profil compte comme un échec.
- Adresse IP, seuil retenu par le porteur : 20 échecs en 15 minutes bloquent 15 minutes toutes les routes anonymes (connexion, vérification et acceptation d'invitation, demande et confirmation de réinitialisation, confirmation de changement d'email). Sont des échecs : identifiants refusés, lien inconnu, utilisé ou expiré, et chaque demande de réinitialisation, qui envoie un email.
- Un email inconnu reçoit la même réponse qu'un mot de passe faux, après une vérification Argon2 factice pour égaliser le temps de réponse.

## Conséquences

- Aucun changement de schéma ; compteurs perdus au redémarrage de l'API, donc à chaque déploiement.
- À revoir si plusieurs instances de l'API sont un jour déployées.
