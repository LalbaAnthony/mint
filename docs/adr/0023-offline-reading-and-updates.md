# ADR 0023 · Consultation hors ligne et nouvelles versions

Statut : acceptée · 16 novembre 2026 · Exigences : NF-PWA-02, NF-PWA-03, NF-PWA-04, CHG-54, CHG-68, US-20 · Complète les ADR 0021 et 0022

## Contexte

Le service worker précache déjà l'application (ADR 0021) : elle s'ouvre sans réseau, mais sans données. NF-PWA-02 demande les dernières réponses du tableau de bord, des comptes, du calendrier (mois en cours et suivant), des échéances et des 90 derniers jours d'opérations, un bandeau horodaté et des écritures désactivées ; NF-PWA-03 un cache vidé à la déconnexion et à la suppression du compte ; NF-PWA-04 une nouvelle version signalée et appliquée à la demande. Restaient ouverts le mécanisme de cache, la façon d'obtenir le mois suivant et les 90 jours, l'étendue de la désactivation des écritures et la fréquence de recherche des mises à jour. Les arbitrages ci-dessous sont ceux du porteur du projet.

## Décision

Copies hors ligne (NF-PWA-02, US-20) :

- Cache côté page, dans le Cache API du navigateur (`mint-offline-data`), tenu par le client API du front, pas par le service worker : testable dans Vitest et actif en développement. Chaque réponse GET réussie des vues concernées est copiée avec son heure : session, comptes, moyens de paiement, catégories, tags, indicateurs, courbe, répartition et revenus et dépenses du tableau de bord, mois du calendrier, échéances, opérations. Les autres vues ne sont pas copiées.
- En cas d'échec réseau, ou d'emblée si le navigateur se sait hors ligne, la copie de la même URL est servie et l'application passe en mode hors ligne ; sans copie, l'erreur `offline_unavailable` est affichée. Toute réponse réseau réussie rétablit le mode en ligne. La session elle-même est servie depuis sa copie, ce qui permet d'ouvrir l'application hors ligne. Cette copie est aussi écrite à la connexion (mot de passe ou passkey) depuis le profil renvoyé, pour que l'application s'ouvre hors ligne dès la connexion, sans réouverture en ligne préalable.
- Préchargement en tâche de fond, deux secondes après l'affichage de l'application et à chaque retour du réseau : les vues ci-dessus avec leurs réglages par défaut (dont le mois suivant du calendrier), puis les opérations des 90 derniers jours par pages de 100 (20 pages au plus), réunies en une copie dédiée. Hors ligne, la vue Opérations montre cette copie, recherche, tri, filtres et pagination désactivés.
- Bandeau `UAlert` `info` `soft` sous l'en-tête de chaque vue, icône `wifi-off` : « Hors ligne : données du » suivi de la date et de l'heure de la copie la plus ancienne servie dans la vue, ou l'absence de données.

Écritures (CHG-54, CHG-68) :

- Hors ligne, chaque point d'écriture est désactivé : bouton flottant, « Ajouter » de la barre latérale, boutons d'ajout et d'action des vues, éléments d'écriture des menus d'actions, validations des formulaires et des confirmations, actions du centre de notifications, déconnexion. Un composant `OfflineGuard` ajoute l'infobulle « Indisponible hors ligne » ; en ligne il ne rend que le bouton, sans élément ni comportement supplémentaire.
- Le client API refuse en plus toute écriture, tout envoi de fichier et tout téléchargement d'export hors ligne (erreur `offline`), sans requête.
- L'état en ligne ou hors ligne vit dans un store unique, qui suit les événements `online` et `offline` du navigateur et le résultat des requêtes.

Oubli des données (NF-PWA-03) : la copie est supprimée à chaque remise à zéro de la session (déconnexion, déconnexion de toutes les sessions, changement de mot de passe, session expirée, suppression du compte) et avant l'installation d'une nouvelle session (connexion par mot de passe ou passkey), pour qu'un autre utilisateur du même appareil ne voie jamais les données du précédent. Un échec de suppression est signalé à l'utilisateur. La déconnexion étant une écriture, elle est indisponible hors ligne.

Nouvelle version (NF-PWA-04, CHG-68) : recherche d'une version du service worker au chargement, toutes les heures (`periodicSyncForUpdates: 3600` de `@vite-pwa/nuxt`) et au retour sur l'onglet. Une version en attente affiche un toast `info` persistant « Nouvelle version disponible », action « Recharger » (`refresh-cw`), qui active la version (`SKIP_WAITING`) et recharge la page.

## Conséquences

- Aucune donnée hors ligne ne transite par le service worker ; il ne précache que l'application. Les copies vivent dans le stockage du site du navigateur, sur l'appareil, jusqu'à la déconnexion.
- Le préchargement ajoute une douzaine de requêtes au démarrage, plus les pages d'opérations des 90 derniers jours.
- Une session expirée pendant que l'appareil est hors ligne reste lisible jusqu'au retour du réseau ; la connexion suivante efface la copie.
- La consultation hors ligne de l'application complète ne s'essaie qu'avec le build de production (service worker) ; les copies et le mode hors ligne s'essaient aussi sous `nuxt dev`.
