# ADR 0031 · Mode masqué des montants

Statut : acceptée, amendée le 21 novembre 2026 (totaux des échéances et abonnements) · 21 novembre 2026 · Exigences : DSH-05, CHG-45, CHG-20, CHG-60, CHG-77, ECH-09, ECH-10, NF-ACC-01, NF-PWA-03

## Contexte

DSH-05 ajoute un mode masqué : consulter Mint devant un tiers sans exposer les sommes de synthèse, tout en laissant lisibles les opérations et les autres détails. Restaient ouverts l'endroit où l'état est enregistré, la façon de désigner dans le code les montants concernés, le rendu d'un montant masqué, le sort des graphiques et la restitution aux lecteurs d'écran. Les arbitrages ci-dessous sont ceux du porteur du projet.

## Décision

- État par appareil : le store Pinia `amount-mask` lit et écrit la clé `mint:masked-amounts` du stockage local du navigateur (`1` si masqué, clé absente sinon). L'état survit au rechargement et ne quitte jamais l'appareil : ni base, ni API, contrairement au thème du profil (ADR 0028). Au premier lancement, les montants sont affichés.
- Les onglets et fenêtres de Mint ouverts sur le même appareil suivent la bascule par l'événement `storage`.
- Effacement : `session.clear()` remet les montants affichés et retire la clé, à la déconnexion, à la suppression du compte et quand la session a expiré, comme le cache hors ligne (NF-PWA-03). Un autre utilisateur du même appareil n'hérite pas du mode.
- Stockage refusé (stockage bloqué, quota) : la bascule s'applique à la page en cours et un toast `error` prévient qu'elle ne survivra pas au rechargement. Une lecture impossible donne les montants affichés.
- Désignation des montants en opt-in : prop `concealable` de `MoneyAmount`, `InvestmentGain` et `CapExcessBadge` ; composable `useAmountMask()` pour les montants insérés dans un texte (`money` pour l'affichage, `spokenMoney` pour les noms accessibles) et pour les graphiques (`chartMoney`, `chartDescription`). Un montant reste en clair tant que son site d'appel ne le déclare pas masquable.
- Périmètre par surface (DSH-05) : un même composant peut être masqué sur une surface de synthèse et en clair sur une surface de détail. Le badge de dépassement de plafond est masqué sur le tableau de bord et la vue Comptes, en clair sur les occurrences du calendrier et dans les Échéances. Dans les modales de compte, seules les synthèses sont masquées ; les historiques de relevés et de valorisations et le graphique des valorisations restent en clair. Dans les vues Échéances et Abonnements, seules les cartes de totaux sont masquées ; les listes restent en clair, montants de référence et équivalents mensuels compris.
- Rendu : `****` de longueur fixe, pour ne pas trahir l'ordre de grandeur, sans symbole €, précédé du signe produit par `Intl.NumberFormat` pour la locale (CHG-20). Couleur et icône d'état sont conservées. Le texte `****` est `aria-hidden` et doublé d'un texte `sr-only` « montant masqué », précédé du même signe ; les noms accessibles (cases du calendrier, barre d'enveloppe) utilisent ce texte.
- Graphiques : la forme reste visible ; graduations de l'axe des montants, infobulles, annotation du minimum et total de l'anneau passent par `chartMoney`. La description ARIA générée par ECharts, qui énumère les valeurs brutes, est remplacée par « Graphique dont les montants sont masqués. » (`aria.label.description`). Le tableau équivalent de CHG-77 est masqué comme le reste de la surface.
- Bouton : nom accessible fixe « Masquer les montants », état porté par `aria-pressed`, selon le motif de bouton bascule de WAI-ARIA. L'infobulle est l'attribut `title`, comme pour les actions désactivées hors ligne : `UTooltip` exige un `TooltipProvider` absent des vues montées hors `UApp` dans les tests.

## Écarté

- Préférence du profil en base : elle suivrait l'utilisateur sur tous ses appareils, alors que le besoin (un écran vu par un tiers) est propre à l'appareil ; migration, route, schéma, OpenAPI et export AUTH-08 à étendre.
- `sessionStorage` : mode perdu à chaque fermeture de l'onglet ou de la PWA.
- Désignation en opt-out : masquage par défaut, avec le risque de masquer par oubli un champ de formulaire ou une liste de détail.
- `****` neutre, sans couleur ni icône d'état : aucune fuite, mais les alertes (solde négatif, sous le seuil) disparaissent.
- Graphique remplacé par un encart, ou axe des montants retiré.
- Nom du bouton variable avec `aria-pressed` : annonce contradictoire du type « Afficher les montants, enfoncé ».

## Conséquences

- La forme des graphiques, les pourcentages (répartition, plus-value latente, remplissage des barres d'enveloppe), la couleur et l'icône d'état laissent deviner des tendances, des proportions et les alertes. Accepté : le mode protège les sommes.
- Les notifications push (NOTIF-07) et le centre de notifications ne sont pas concernés.
- Toute nouvelle surface de synthèse doit déclarer ses montants masquables (`concealable`, `useAmountMask`) ; sans cela, ils restent en clair en mode masqué.
