# ADR 0004 · Déploiement piloté par GitHub Actions et secrets de dépôt

Statut : acceptée · 12 novembre 2026 · Exigences : NF-SEC-07, NF-OPS-01, NF-OPS-03, NF-QUA-05, sections 7.2 et 7.6

## Contexte

Le cahier des charges impose des images publiques sur Docker Hub sans secret embarqué, un déploiement SSH à chaque push sur `main` après contrôles et tests, des migrations Umzug dans un conteneur éphémère avant le redémarrage, une vérification de l'endpoint de santé et un retour arrière manuel par SHA. Le VPS OVH héberge d'autres services.

## Décision

- Toutes les valeurs de déploiement et d'exécution sont des secrets GitHub de dépôt. Le `.env` du VPS est régénéré à chaque déploiement depuis ces secrets ; le `docker-compose.yml` déployé est celui du commit déployé. Le VPS ne porte aucune configuration maintenue à la main.
- SSH par le client OpenSSH du runner, sans action tierce. La clé d'hôte est épinglée par son empreinte SHA256 : seules les clés servies par `ssh-keyscan` dont l'empreinte correspond au secret entrent dans `known_hosts`, et `StrictHostKeyChecking yes` est imposé.
- Le script exécuté sur le VPS (`.github/deploy/remote.sh`) vient de la branche qui exécute le workflow, pas du commit déployé : un retour arrière vers un ancien commit utilise la logique de déploiement actuelle. Il est transmis sur l'entrée standard de `bash` avec ses variables ; les secrets ne passent jamais en argument de processus.
- Les nouveaux fichiers sont d'abord écrits en `.next`, les images tirées et les migrations exécutées avec eux ; la bascule des fichiers et `docker compose up --wait` n'ont lieu qu'après des migrations réussies.
- Santé : `up --wait` attend les healthchecks de `db`, `api` (`/api/v1/health`) et `web` (`/healthz`), puis `curl` interroge l'API et le `web` sur `127.0.0.1`. La chaîne Apache et TLS n'est pas vérifiée par le déploiement.
- Tags d'images : `latest` et SHA complet ; les déploiements référencent toujours le SHA complet. Seule l'architecture `linux/amd64` est publiée.
- Concurrence : un seul run de release à la fois, les runs en attente remplacés par le plus récent ; groupe `deploy-production` commun à la release et au retour arrière.
- Après un déploiement réussi, les tags locaux de `mint-api` et `mint-web` autres que le SHA déployé sont supprimés, sans `docker image prune -a` qui toucherait les autres services.
- `web` tourne en utilisateur non root (nginx sur le port 8080). Ses journaux d'accès sont en JSON sur la sortie standard, sans adresse IP ni chaîne de requête (NF-OPS-03).

## Écarté

- Action SSH tierce : la clé privée transiterait par du code externe.
- Ligne `known_hosts` en secret à la place de l'empreinte : la spec désigne une empreinte.
- `.env` et compose maintenus à la main sur le VPS : risque de dérive avec le dépôt.
- Environnement GitHub `production` : écarté au profit de secrets de dépôt, plus simples ; toute branche du dépôt dont un workflow est modifié peut lire ces secrets.

## Conséquences

- Ajouter un secret d'exécution impose de modifier `deploy.inc.yml`, les deux flux et `docker-compose.yml`.
- Changer le mot de passe PostgreSQL impose un `ALTER USER` préalable (docs/deployment.md, section 8).
- Aucun déploiement sans interruption : `docker compose up` recrée les conteneurs `api` et `web`.
- Un retour arrière ne recharge pas les anciens secrets et n'annule aucune migration.
