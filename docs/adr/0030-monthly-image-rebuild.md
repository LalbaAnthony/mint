# ADR 0030 · Reconstruction mensuelle des images

Statut : acceptée · 18 novembre 2026 · Exigences : NF-QUA-05, NF-SEC-08, sections 7.2 et 7.6 · Amende les sections 7.2 et 7.6 du cahier des charges et l'ADR 0004

## Contexte

`mint-api` et `mint-web` reposent sur `node:24-alpine` et `nginx:alpine`, tags que Docker Hub republie à chaque correctif d'Alpine, de Node ou de nginx. Les images ne sont reconstruites qu'à un push sur `main` : sans push, les correctifs n'atteignent jamais la production. Le déploiement ne tirait pas non plus `postgres:18-alpine`, et le VPS gardait l'image du premier déploiement.

## Décision

- `release.flow.yml` reçoit un déclencheur `schedule` (`17 4 1 * *`) : le 1er de chaque mois à 04:17 UTC, la chaîne complète (contrôles, tests, build, déploiement) est rejouée sur le dernier commit de `main`, comme après un push. Même workflow, donc même enchaînement et même groupe de concurrence `release`.
- Horaire : 05:17 en hiver, 06:17 en été à Paris, entre la purge de 03:00 et les notifications de 08:00, en heure creuse. La minute est décalée parce que GitHub retarde souvent les runs planifiés à l'heure pile.
- `build.inc.yml` est inchangé : `setup-buildx-action` crée un builder neuf à chaque run, qui relit les tags `FROM` sur le registre. Une image de base republiée change de digest et invalide le cache GHA des couches suivantes.
- Le tag SHA du dernier commit de `main` et `latest` sont republiés avec un nouveau digest. `deploy.inc.yml` et `rollback.flow.yml` sont inchangés. Docker Compose détecte le nouveau digest sous le même tag et recrée `api`, `web` et `worker`.
- Le déploiement tire aussi `db` : `postgres:18-alpine` reçoit les correctifs de la version 18 à chaque déploiement, mensuel ou non.
- `remote.sh` relève, avant le pull, l'identifiant local de chaque image référencée par `db`, `api` et `web` dans le compose déployé. Après un déploiement réussi, il supprime par identifiant celles qui ont été remplacées sous la même référence. Un échec, image encore utilisée par un autre conteneur, n'est qu'un avertissement.

## Écarté

- Tag immuable `<sha>-<date>` : retour arrière exact vers une reconstruction donnée, mais nouvelle entrée pour `deploy.inc.yml`, retour arrière et nettoyage du VPS à revoir.
- Écraser le tag SHA sans nettoyage : une image orpheline de plus sur le VPS chaque mois, que le filtre `dangling=false` du nettoyage existant ne voit pas.
- Workflow planifié distinct : dupliquerait l'enchaînement et le groupe de concurrence de `release.flow.yml`.
- Mise à jour des dépendances npm : hors périmètre, le build suit `package-lock.json`.

## Conséquences

- Le tag SHA du dernier commit de `main` devient mutable : un retour arrière vers ce SHA redéploie sa reconstruction la plus récente, la précédente n'est plus disponible sur Docker Hub.
- Une interruption de quelques secondes chaque mois (recréation de `api` et `web`). Le redémarrage du `worker` relance son rattrapage (ADR 0014).
- Une vulnérabilité critique apparue dans `package-lock.json` bloque le run mensuel jusqu'à sa correction (NF-SEC-08).
- Le dépôt est public : GitHub désactive les workflows planifiés après 60 jours sans activité, les runs planifiés ne comptant pas comme activité. Il faut alors réactiver le workflow `release` dans l'onglet Actions. Accepté.
- Une nouvelle `postgres:18-alpine` recrée le conteneur `db` dès l'étape des migrations, donc redémarre PostgreSQL. Le tag est partagé par tous les projets Docker du VPS : un autre service qui l'utilise bascule sur la nouvelle image à sa prochaine recréation. Cela amende l'ADR 0004, selon laquelle le déploiement ne touche jamais les images des autres services.
