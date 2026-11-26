# ADR 0021 · Notifications et Web Push

Statut : acceptée · 15 novembre 2026 · Exigences : NOTIF-01 à NOTIF-09, LIV-02, ECH-02, AUTH-07, ADM-04, CHG-51, CHG-56, CHG-67, CHG-85, US-13, US-14, US-15 · Amende les sections 5.5, 5.6 et 7.3 du cahier des charges, complète les ADR 0014 et 0020

## Contexte

NOTIF-01 à NOTIF-09 laissent ouverts le moment de la réévaluation après une modification, le rattrapage d'une tâche de 08:00 manquée, les occurrences qui reçoivent un rappel, la granularité des alertes de plafond, la forme du centre de notifications et la cible de ses liens, la portée des préférences (NOTIF-05 parle de canal alors que le centre in-app est toujours actif, NOTIF-03), la configuration VAPID, la conservation des notifications, la mise à jour du compteur, la gestion des appareils et la production du service worker. Les arbitrages ci-dessous sont ceux du porteur du projet.

## Décision

Évaluation (NOTIF-06) :

- Tâche quotidienne à 08:00 (Europe/Paris) dans le worker, et une fois à son démarrage pour rattraper une exécution manquée, sous un verrou consultatif propre ; elle évalue tous les utilisateurs actifs, rappels compris. `HEALTHCHECK_NOTIFICATIONS_URL`, facultatif, reçoit les pings `/start`, succès et `/fail`.
- Réévaluation après la réponse de chaque requête d'écriture réussie d'un utilisateur, hors routes d'authentification, d'administration et de notifications : solde bas et plafonds seulement, les rappels restant à la tâche de 08:00. Les demandes d'un même utilisateur se regroupent : une évaluation à la fois, une seule relance si d'autres écritures arrivent pendant qu'elle tourne. Un utilisateur désactivé n'est jamais évalué (ADM-04).
- Chaque notification porte une clé de déduplication unique par utilisateur ; l'insertion ignore une clé déjà présente, ce qui rend le rattrapage et la réévaluation idempotents.

Solde bas (NOTIF-01, US-13) : pour chaque compte actif avec un seuil, minimum du solde prévisionnel de fin de journée d'aujourd'hui à J+7, à sa première date. Un minimum sous le seuil ouvre un épisode et notifie ; un nouveau minimum inférieur au dernier notifié le met à jour et notifie encore ; un minimum revenu au seuil ou au-dessus, un seuil retiré ou un compte archivé ferme l'épisode. Clé : `low_balance:<épisode>:<minimum>`.

Rappels (NOTIF-02, ECH-02, US-14) : échéances actives en mode Manuel, hors échéances système. Délai `reminder_days_before` par échéance, de 0 à 30 jours, 2 par défaut, saisi dans le formulaire quand le mode est Manuel. Rappel N jours avant la date effective si l'occurrence est encore en attente et N > 0, puis le jour même quel que soit son état (EXE-02 l'a déjà marquée exécutée à 00:05). Aucun rappel pour une occurrence sautée ou rapprochée d'une opération réelle, saisie ou importée. Clés : `manual_reminder:<échéance>:<date d'origine>:before` et `:day`.

Plafonds (LIV-02, US-15) : une notification par occurrence de versement prévue en dépassement dans l'horizon de l'utilisateur (`deposit_cap:occurrence:<échéance>:<date d'origine>`), et une par jour où le solde réel hors intérêts dépasse le plafond (`deposit_cap:account:<compte>:<jour>`). Centre in-app uniquement (NOTIF-03).

Web Push (NOTIF-03, NOTIF-07, NOTIF-08, CHG-85) :

- `web-push` avec trois secrets `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:` ou `https://`), tous ou aucun, obligatoires en production. Sans eux, le push est désactivé et le profil l'indique.
- Message : titre et corps dans la langue de l'utilisateur (compte ou échéance, date, montant), lien relatif vers l'objet, `tag` égal à la clé de déduplication, durée de vie de 24 heures. Un refus 404 ou 410 supprime l'abonnement ; un envoi réussi date `last_success_at`.
- Un abonnement est unique par endpoint : un appareil réabonné par un autre utilisateur lui est transféré.
- Préférences : un interrupteur push par type poussable (solde bas, rappels), actif par défaut ; pas de colonne `in_app`, le centre recevant toujours tout.
- Profil : activation et désactivation pour cet appareil, liste des appareils abonnés avec retrait. Sur iPhone et iPad hors application installée, la procédure d'ajout à l'écran d'accueil remplace le bouton (NOTIF-09).
- Service worker écrit en TypeScript (`front/service-worker/sw.ts`) et produit par la stratégie `buildSW` de `@vite-pwa/nuxt` avec `@vite-pwa/workbox-swkit` : `injectManifest` refuse une source TypeScript dans la version 2.0.1 du module. Le build Rolldown du service worker reçoit l'alias `@mint/shared` par un plugin déclaré dans `front/nuxt.config.ts` : `@vite-pwa/workbox-build` 8.0.15 ignore l'option `alias` transmise par le module, l'import resté externe rendait le script invalide et le service worker ne s'installait pas. Il garde le précache et la navigation de repli de la configuration précédente, affiche les messages push avec `pwa-192x192.png` et `badge-96x96.png`, ouvre ou focalise l'application au clic, sur l'origine de l'application seulement, et signale chaque push aux onglets ouverts.

Centre de notifications (NOTIF-04, CHG-51, CHG-56, CHG-67) :

- Cloche dans l'en-tête de chaque vue, compteur corail des non lues (99+ au-delà de 99) ; panneau latéral avec la liste chronologique, « Tout marquer comme lu » et la suppression par notification. Un clic marque la notification lue, ferme le panneau et ouvre l'objet : calendrier sur le compte et le jour (solde bas, rappel, dépassement du solde réel), échéance pour un dépassement prévu.
- Pas d'interrogation périodique : la liste se recharge à l'affichage de l'application, à chaque navigation, au retour sur l'onglet, trois secondes après une écriture et à la réception d'un push. Un échec de rechargement s'affiche une fois, jusqu'au succès suivant.
- Les notifications lues depuis plus de 90 jours sont supprimées par la purge de 03:00 ; les non lues sont conservées.

## Conséquences

- Migration 0023 : tables `notifications`, `alert_episodes` (avec `user_id` pour la référence composée vers le compte), `push_subscriptions`, `notification_preferences` (clé `user_id`, `type`, colonne `push`) et colonne `schedules.reminder_days_before` (0 à 30, 2 par défaut).
- Moteur `shared/engines/notifications.ts` (fenêtre de solde bas, décision d'épisode, rappels dus, liens) ; évaluation et envoi dans `api/notifications/`.
- Routes `GET /notifications`, `POST /notifications/:id/read`, `POST /notifications/read-all`, `DELETE /notifications/:id`, `GET` et `PATCH /notifications/preferences`, `GET /push/key`, `GET` et `POST /push/subscriptions`, `DELETE /push/subscriptions/:id`.
- Nouveaux secrets de déploiement `VAPID_*` et `HEALTHCHECK_NOTIFICATIONS_URL` ; le typecheck du front vérifie aussi le service worker.
- Un abonnement push survit à la déconnexion de l'appareil : il se retire depuis le profil.
