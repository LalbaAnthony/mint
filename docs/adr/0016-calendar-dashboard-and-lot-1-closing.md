# ADR 0016 · Calendrier, courbe du tableau de bord et clôture du lot 1

Statut : acceptée · 15 novembre 2026 · Exigences : CAL-01 à CAL-06, DSH-01, PRV-05 à PRV-09, ECH-09, NF-PWA-01, NF-OPS-02, CHG-62, CHG-63, CHG-73, CHG-80 à CHG-84, section 7.3 · Complète les ADR 0013 et 0014

## Contexte

L'ADR 0014 laissait au lot 1 la vue Abonnements, le calendrier et la courbe du tableau de bord. L'audit du lot 1 a relevé trois autres écarts : la purge de 03:00 de la section 7.3 absente du worker, l'application non installable (NF-PWA-01, CHG-80 à CHG-84) et les indicateurs de PRV-07 calculés mais jamais affichés. Le cahier des charges laisse ouverts le traitement d'aujourd'hui dans le calendrier, la place des transferts internes et des parts d'enveloppe en vue agrégée, la borne basse de navigation, l'exposition de l'horizon ponctuel (PRV-06) et le point minimal de la courbe. Les arbitrages ci-dessous sont ceux du porteur du projet.

## Décision

API :

- Deux routes calculées à la demande (PRV-08) : `GET /calendar/:month` (mois au format `AAAA-MM-01`) et `GET /forecast/curve`. Les deux acceptent `accountId` (un compte actif, sinon la vue agrégée des comptes actifs) et `horizonMonths` (1 à 12, défaut : préférence du profil). Un compte inconnu répond 404, un compte archivé 409 `account_archived`, un mois hors de la navigation 400 avec le motif `month_out_of_range`.
- Les flux d'occurrence du moteur de prévision portent désormais le montant non signé de l'occurrence et l'indicateur de surcharge, pour que le calendrier ouvre le formulaire d'exception d'ECH-07 sans autre appel.

Calendrier :

- Navigation du mois du solde initial le plus ancien des comptes actifs (vue agrégée) ou de celui du compte (vue par compte) jusqu'au mois de la fin de l'horizon. Avant le solde initial, un jour n'a pas de solde ; en vue agrégée, un jour additionne les comptes qui ont déjà un solde. Les jours du dernier mois au-delà de la fin de l'horizon sont sans contenu.
- Jour passé : opérations réelles (nombre, total) et solde calculé de fin de journée (PRV-09). Aujourd'hui : opérations réelles du jour comme un jour passé, occurrences encore dues et solde prévisionnel de fin de journée, part d'enveloppe du jour déduite. Jour futur : occurrences et solde prévisionnel.
- Vue agrégée : un mouvement de transfert est masqué quand sa contrepartie est aussi un compte actif, puisqu'il y est neutre (PRV-05) ; les occurrences de transfert sont masquées. Un mouvement vers un compte archivé reste visible : il modifie le total.
- La case montre les occurrences et le solde ; le détail du jour liste en plus les opérations déjà saisies d'un jour futur et les parts d'enveloppe. Au plus trois occurrences par case, puis « +n autres ».
- La mise en évidence sous le seuil ou en négatif (CHG-62) s'applique aux jours passés comme aux jours futurs. Le seuil n'existe qu'en vue par compte.
- Le détail d'un jour passé liste ses opérations ; un clic ouvre le formulaire d'opération. Un clic sur une occurrence ouvre un menu : la modifier, la sauter, la rétablir si elle est surchargée (seulement si sa date effective est après aujourd'hui, ADR 0014), ou ouvrir son échéance.
- Grille complète à partir de 768 px, grille compacte à points en dessous (CAL-06) ; le détail du jour est sous la grille, à côté à partir de 1280 px.

Courbe du tableau de bord (DSH-01) :

- Les 30 jours précédant aujourd'hui en solde réel, puis d'aujourd'hui à la fin de l'horizon en solde prévisionnel ; la ligne prévue part du dernier jour réel pour que la courbe soit continue.
- Le point annoté est le minimum de l'horizon (PRV-07), première date en cas d'égalité ; les 30 jours réels n'y entrent pas. Le seuil et sa ligne n'apparaissent qu'avec un compte sélectionné.
- Au-dessus de la courbe, le minimum, le premier jour sous le seuil et le premier jour négatif de l'horizon (PRV-07).

Horizon (PRV-06) : un sélecteur de 1 à 12 mois, partagé par le calendrier et le tableau de bord, part de la préférence du profil et n'est jamais enregistré. Il revient à la préférence à chaque changement d'utilisateur.

Abonnements (ECH-09) : `GET /subscriptions` liste les échéances de dépense marquées abonnement, actives et non terminées, triées par prochaine occurrence. Les totaux mensuel et annuel portent sur celles qui ont une prochaine occurrence, comme les totaux d'ECH-10 ; le total annuel additionne les montants annualisés exacts et arrondit une fois (ADR 0013).

Purge (section 7.3) : tâche node-cron de 03:00 (Europe/Paris) dans le worker, sous son propre verrou consultatif. Elle supprime les sessions expirées et les jetons de réinitialisation et de changement d'email expirés ou utilisés. Les invitations sont conservées : la console en affiche l'historique (ADM-02). Supervision par la variable et le secret facultatifs `HEALTHCHECK_PURGE_URL`, distincts de ceux de l'exécution, avec les mêmes signaux. Les lignes d'import en transit s'ajouteront au lot 2.

PWA (NF-PWA-01) :

- `@vite-pwa/nuxt` en `registerType: 'prompt'` : le service worker précache les fichiers statiques du build (scripts, styles, HTML, SVG, icônes, polices), hors écrans de démarrage, et sert `200.html` à toute navigation hors `/api/`. Sans l'invite de NF-PWA-04 (lot 3), une nouvelle version s'active à la fermeture de tous les onglets.
- Manifeste de CHG-84, langue `fr`, lié statiquement dans le HTML. Ressources générées par le script `pwa:assets` du paquet `front` et versionnées (CHG-80, CHG-81) ; liens des écrans de démarrage clairs construits par `front/pwa/splash-screens.ts`.
- Le module est désactivé sous Vitest : ses modules virtuels n'existent pas dans l'environnement de test Nuxt.

## Conséquences

- La CSP est inchangée : `manifest-src 'self'` et `worker-src 'self'` étaient déjà posés, l'enregistrement du service worker passe par le bundle, sans script en ligne.
- `deploy.inc.yml`, `release.flow.yml`, `rollback.flow.yml` et `docker-compose.yml` portent le secret `HEALTHCHECK_PURGE_URL`.
- Le scénario Playwright du calendrier et de la courbe complète NF-QUA-04.
- Les notifications de 08:00 et l'invite de mise à jour restent au lot 3, les écrans de démarrage sombres au lot 4.
