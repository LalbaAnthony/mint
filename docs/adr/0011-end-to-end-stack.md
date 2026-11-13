# ADR 0011 · Pile de bout en bout sur les images de production

Statut : acceptée · 13 novembre 2026 · Exigences : NF-QUA-04, CA-03, CA-04, section 7.6

## Contexte

Les tests Playwright (invitation, connexion) doivent contrôler l'absence de violation CSP sur l'image `web` réelle (CA-04) et l'absence de requête vers un domaine tiers (CA-03). La CSP vient de nginx, le routage `/api/` d'Apache, les liens d'invitation arrivent par email.

## Décision

- `e2e/compose.yml` (projet `mint-e2e`) construit `mint-api` et `mint-web` depuis leurs Dockerfiles de production et ajoute une base PostgreSQL éphémère (`tmpfs`), Mailpit et `httpd` configuré comme `apache.conf` (`e2e/httpd.conf`), en HTTP sur `localhost:8090`.
- L'API exécute ses migrations au démarrage du conteneur, puis écoute.
- `e2e/global-setup.ts` attend `/api/v1/health`, crée l'administrateur de test directement en base (la CLI exige un terminal) et vide la boîte Mailpit.
- Les scénarios lisent les liens dans Mailpit et vérifient sur chaque page qu'aucun message CSP ni aucune requête vers une autre origine n'apparaît.
- Chromium seul, un worker, aucune nouvelle tentative, `.only` interdit.
- Job `e2e` dans `tests.inc.yml`, en parallèle du job Vitest.

## Conséquences

- Les Dockerfiles de production sont construits à chaque pull request.
- Firefox et WebKit (NF-COMP-01) ne sont pas couverts par les tests de bout en bout.
