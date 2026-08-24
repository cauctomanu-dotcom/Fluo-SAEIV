# Fluo SAEIV V11 — annonces départ / prochain arrêt / arrivée

Web-app iPhone/PWA pour les lignes Fluo Grand Est de Moselle (57) et Meurthe-et-Moselle (54).

La V11 conserve la course GTFS exacte, les variantes horaires, le GPS/map-matching, la régulation, la simulation, le TAD, les demandes clients et le mode Formation. Elle affine surtout la séquence d’annonces voyageurs/conducteur autour de chaque arrêt.

## Avance / à l'heure / retard

Le bandeau de régulation compare la progression réelle du véhicule à l'horaire de la **course exacte (`trip_id`)** sélectionnée. Entre deux arrêts, l'heure théorique est interpolée le long du tracé `shapes.txt`, entre l'heure de départ de l'arrêt précédent et l'heure d'arrivée du suivant. L'indicateur évolue donc en continu au lieu de changer uniquement aux poteaux.

Code couleur demandé :

- **rouge** : AVANCE (plus d'1 minute d'avance) ;
- **bleu** : À L'HEURE (tolérance par défaut de −1:00 à +1:00) ;
- **vert** : RETARD de +1:01 à +4:59 ;
- **jaune** : RETARD de +5:00 à +9:59 ;
- **orange** : RETARD à partir de +10:00. La valeur exacte continue d'être affichée au-delà de 15 minutes afin de ne pas réutiliser le rouge, réservé à l'avance.

Exemples : `AVANCE −2:14`, `À L'HEURE +0:22`, `RETARD +3:40`, `RETARD +7:05`, `RETARD +12:31`.

Avant le départ théorique, tant que le véhicule n'a pas quitté son point de départ, le bandeau affiche **PRÉ-DÉPART** plutôt que de qualifier le véhicule d'« en avance ».

## Simulation de régulation

Le simulateur permet de choisir un écart artificiel : avance 3 min, à l'heure, retard 3 min, 7 min, 12 min ou 20 min. Cela permet de valider tous les états et couleurs sans GPS réel.

## Ligne régulière et TAD

- **Ligne régulière** : tous les arrêts de la course restent desservis ; plusieurs demandes clients 🔔 peuvent être mémorisées et s'effacent après l'arrêt concerné.
- **TAD** : le conducteur choisit les arrêts opérationnels à desservir ; le GPS continue de suivre le tracé complet de la course et la régulation horaire reste basée sur les horaires GTFS de la course exacte.

## Publication GitHub Pages

1. Décompresser le ZIP.
2. Placer son contenu dans un dépôt GitHub sur la branche `main`.
3. GitHub → Settings → Pages → GitHub Actions.
4. Lancer **Build and deploy Fluo Annonceur** si nécessaire.
5. Ouvrir l'URL HTTPS sur l'iPhone.
6. Safari → Partager → **Sur l'écran d'accueil**.

Le workflow récupère les GTFS officiels 54/57 et reconstruit les courses à chaque publication/mise à jour.

> Outil d'aide personnel, non connecté au SAEIV officiel de l'exploitant. Manipuler l'interface uniquement véhicule immobilisé.

## Mode Formation V10

Le bouton **🎓 Formation** lance une ligne sans horaire de service. Le formateur choisit le département, la ligne, le sens/parcours et l’arrêt de départ. Aucun `trip_id` horaire n’est imposé et aucune régulation avance/retard n’est affichée.

Restent actifs : GPS et map-matching sur le tracé GTFS, carte, annonces automatiques des arrêts, rappel ligne/destination à mi-inter-arrêt, demandes clients, commandes précédent/suivant, recalage GPS et simulation. Les annonces T−5/T−1 et toutes les heures théoriques sont volontairement désactivées en Formation.


## Annonces d’arrêt V11

Pour chaque inter-arrêt opérationnel :

1. le véhicule quitte le poteau précédent ;
2. environ **15 secondes après le départ**, la voix annonce **« Prochain arrêt, [nom]. »** ;
3. le rappel **« Ligne [numéro], à destination de [destination]. »** reste actif au milieu de l’inter-arrêt ;
4. à l’entrée dans la zone GPS du poteau, la voix annonce **« Arrêt, [nom]. »** ;
5. au dernier arrêt, l’annonce devient **« Arrêt, [nom]. Terminus. »**.

La zone d’arrivée s’adapte à la précision GPS (environ 28 à 55 m) afin de limiter à la fois les annonces trop précoces et les arrêts manqués. Sur un inter-arrêt exceptionnellement court, si le véhicule atteint déjà le poteau avant les 15 secondes, l’annonce tardive « Prochain arrêt » est supprimée pour éviter de la prononcer après l’annonce d’arrivée.

En simulation, les 15 secondes suivent l’accélération du temps (x1/x5/x10/x20/x40) afin de tester la séquence sans devoir attendre 15 secondes réelles à chaque arrêt.
