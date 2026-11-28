# ADR 0038 · Profil dans la navigation latérale, déconnexion sur la vue Profil

Statut : acceptée · 28 novembre 2026 · Exigences : AUTH-05, RAC-07, NF-ACC-01, NF-PWA-02, CHG-41, CHG-45, CHG-46, CHG-53, CHG-55 · Amende l'ADR 0035 (ouverture de la modale d'aide), RAC-07 du cahier des charges, ainsi que CHG-45, CHG-46, CHG-53, CHG-55 et le registre des décisions de la charte graphique

## Contexte

Dans le pied de la barre latérale desktop, Profil était un bouton qui ouvrait un menu (« Profil et préférences », « Raccourcis clavier », « Déconnexion »), alors qu'Administration, juste en dessous, était une entrée de navigation : deux logiques et deux rendus pour deux entrées voisines, et une étape intermédiaire pour atteindre la vue Profil. Le tiroir « Plus » mobile proposait aussi « Déconnexion ». La vue Profil n'offrait que « Se déconnecter partout », qui ferme toutes les sessions (AUTH-05). Les arbitrages ci-dessous sont ceux du porteur du projet.

## Décision

- Barre latérale desktop (CHG-55) : Profil et Administration (administrateur seulement) sont des entrées de navigation comme les autres, réunies dans une `UNavigationMenu` du pied dont le nom accessible est « Navigation secondaire ». Un clic sur Profil ouvre directement la vue Profil et préférences. Rendu et états identiques aux autres entrées : `text-muted` au repos, `text-primary` sur leur vue, infobulle quand la barre est repliée. Libellé « Profil », icône `circle-user`.
- Déconnexion : un seul point d'entrée sur toutes les tailles, le bouton « Déconnexion » (icône `log-out`, `outline` neutre) de l'en-tête de la carte Sessions actives de la vue Profil, avant « Se déconnecter partout ». Il ferme la session courante seule, sans confirmation, et ramène à l'écran de connexion ; hors ligne, il est désactivé avec infobulle (NF-PWA-02). L'entrée « Déconnexion » disparaît du pied de la barre latérale et du tiroir « Plus » mobile (CHG-53).
- Modale d'aide des raccourcis (CHG-46, RAC-07) : ouverte par Ctrl+/ ou par un bouton « Raccourcis clavier » de l'en-tête des vues, entre le bouton du mode masqué et la cloche : icône `keyboard` seule, `ghost` neutre, nom accessible « Raccourcis clavier », infobulle avec Ctrl+/ et `aria-keyshortcuts`, cible tactile de 44 px sous 1024 px comme ses voisins (CHG-41). Il suit la règle d'appareil de l'ADR 0035 : rendu seulement avec un pointeur précis, quelle que soit la largeur.
- Ctrl+, (Profil et préférences) est inchangé. Comme pour les autres entrées de la navigation latérale (ADR 0035), ses pastilles n'y sont pas affichées ; il reste listé dans la modale d'aide.

## Écarté

- Menu déroulant de l'entrée Profil (« Profil et préférences », « Raccourcis clavier », « Déconnexion »), rendu antérieur.
- Profil et Administration non grisés au repos, seuls de la barre latérale.
- Deux landmarks séparés « Profil » et « Administration », chacun avec un seul lien du même nom ; landmark nommé « Compte ».
- « Se déconnecter partout » comme seule sortie ; « Déconnexion » conservée dans le tiroir « Plus » mobile.
- Bouton d'aide avant le bouton du mode masqué ; bouton d'aide réservé à la mise en page desktop (1024 px et plus).

## Conséquences

- Sur toutes les tailles, se déconnecter passe par la vue Profil et préférences.
- Sans pointeur précis, la modale d'aide reste sans point d'entrée, comme avant : aucun raccourci n'y est actif.
- Sur un ordinateur avec souris en fenêtre de moins de 1024 px, l'en-tête mobile affiche le bouton d'aide.
