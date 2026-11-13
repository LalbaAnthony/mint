# ADR 0007 · CSRF par double soumission signée

Statut : acceptée · 13 novembre 2026 · Exigences : NF-SEC-03

## Contexte

NF-SEC-03 impose une protection CSRF sur toutes les requêtes modifiantes, en plus de SameSite=Lax, y compris avant authentification (connexion, acceptation d'invitation, réinitialisation). Un jeton synchronisé en session obligerait à enregistrer des sessions anonymes.

## Décision

- `GET /api/v1/csrf` pose un cookie aléatoire de 256 bits (`__Host-mint-csrf` en HTTPS, `mint-csrf` en HTTP), HttpOnly, SameSite=Strict, et renvoie le jeton `HMAC-SHA256(SESSION_SECRET, "csrf:" + cookie + "." + liaison)`.
- La liaison vaut l'identifiant de session une fois connecté, une chaîne vide sinon : un jeton obtenu avant la connexion n'est plus valable après.
- Toute requête POST, PATCH, PUT ou DELETE doit porter l'en-tête `X-CSRF-Token` ; il est comparé en temps constant au jeton recalculé. Échec : 403 `csrf_invalid`.
- Le client du front met le jeton en cache, l'oublie à chaque changement d'état d'authentification et, sur `csrf_invalid`, en redemande un et rejoue la requête une seule fois.
- Implémentation avec `node:crypto`, sans dépendance.

## Écarté

- Jeton synchronisé en session : sessions anonymes en base, purge supplémentaire.
- Contrôle d'`Origin` et de `Sec-Fetch-Site` seul : moins conforme à la lettre de NF-SEC-03.

## Conséquences

- Aucune donnée CSRF stockée côté serveur.
- Un aller-retour supplémentaire au premier envoi et après chaque connexion ou déconnexion.
