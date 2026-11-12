# ADR 0003 · CSP calculée au build et servie par nginx

Statut : acceptée · 12 novembre 2026 · Exigences : NF-SEC-02, CHG-103, CHG-105, CA-04, CA-12

## Contexte

NF-SEC-02 interdit `'unsafe-inline'` pour les scripts. En `ssr: false`, `nuxt generate` écrit dans chaque fichier HTML un script inline `window.__NUXT__.config` dont le `buildId` est aléatoire : son empreinte change à chaque build. Le build produit aussi des coquilles HTML dans des sous-dossiers (`accounts/index.html`, `login/index.html`...), toutes porteuses du même script, et un script `application/json` de données qui n'est pas exécuté. Apache ne pose pas de CSP (section 7.2).

## Décision

- Après `nuxt generate`, `front/scripts/write-csp.ts` parcourt récursivement tous les fichiers `.html` de `.output/public`, extrait les scripts inline exécutables (sans `src`, type absent, vide, JavaScript, `module`, `importmap` ou `speculationrules`), calcule leur empreinte sha256 après normalisation des fins de ligne comme le fait le parseur HTML, puis écrit la directive nginx `add_header Content-Security-Policy` complète.
- Politique : `default-src 'self'; script-src 'self' 'sha256-...'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`.
- `style-src 'unsafe-inline'` : élément `<style>` des variables de couleurs de Nuxt UI et styles injectés par @nuxt/icon. `img-src data:` : masques CSS des icônes.
- En-têtes complémentaires : `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` (`front/nginx/security-headers.conf`).
- nginx n'hérite pas des `add_header` du niveau serveur dans un bloc `location` qui en déclare : chaque `location` inclut les deux fichiers d'en-têtes.
- Le build du conteneur `web` échoue (CA-12) si `index.html` ou `200.html` manque, si un élément `<script>` ne peut pas être analysé, ou si, à la relecture du fichier écrit, un script inline exécutable n'est pas couvert par `script-src`. `nginx -t` valide la configuration finale dans l'image.

## Conséquences

- Une seule empreinte par build en pratique ; aucune mise à jour manuelle de la CSP.
- Tout script inline présent dans le HTML généré est autorisé par construction : un script inline ajouté au build (module, configuration Nuxt) passe sans revue. La CSP protège contre l'injection à l'exécution, pas contre le contenu du build.
- Les attributs de gestionnaire d'événements (`onclick`...) et les URL `javascript:` ne sont pas couverts par une empreinte de script : ils restent bloqués.
- Les tests de bout en bout doivent contrôler l'absence de violation CSP (CA-04) sur l'image `web` réelle.
