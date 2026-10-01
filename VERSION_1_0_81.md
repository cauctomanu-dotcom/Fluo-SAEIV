# Mon SAEIV 1.0.81 — HLP intégré et suivi voyageurs

Le démarrage GPS d’une course située à plus de 150 m du véhicule ouvre une mise en place depuis sa position réelle, puis lance la course au premier arrêt. Les HLP planifiés gardent leur enchaînement Ma journée. L’écran HLP calcule l’arrivée estimée et l’écart par rapport au départ voyageurs. Une arrivée précoce en mise en place n’est pas annoncée au public comme un départ anticipé.

`voyageurs.html` est accessible sans compte depuis le sas de connexion. Choix du département Fluo (54, 57, 67, 68), de la date, de la ligne, du parcours, de l’arrêt et de l’horaire exact. Carte du parcours, position réelle et passage estimé. Les correspondances utilisent département + date de service + route_id + trip_id, pas seulement le numéro de ligne. Les horaires tiennent compte des calendriers, exceptions et heures GTFS après minuit. Les arrêts sans montée autorisée et les arrêts TAD non sélectionnés ne reçoivent pas de faux passage annoncé.

Le conducteur connecté partage sa position toutes les 5 secondes ; la page voyageurs consulte le serveur toutes les 10 secondes. Une position datant de plus de 60 secondes est présentée comme ancienne et retirée de la carte. Le serveur ne permet plus la consultation publique après 10 minutes. La fin de course retire la position ; les simulations et formations ne sont jamais diffusées. Aucun nom, matricule, adresse de départ, planning ou journal n’est exposé par cette table. Une seule position courante est conservée par conducteur, sans historique public.

Les événements HLP et points GPS espacés d’au moins 6 m sont conservés localement puis rattachés au journal de la course correspondante. Un HLP interrompu reste dans la file locale en attendant cette course.

## Déploiement

Les deux migrations `supabase/migrations/*_live_passenger_*.sql` sont appliquées au projet Supabase existant. Le workflow Pages copie la page publique et charge `tracking-core.js` puis `v182-live-tracking.js` en fin d’application. Le cache PWA passe en 1.0.81.

## Validation

- Tests unitaires : heures de Paris été/hiver, passage après minuit, calendrier, avance en HLP, retard, GPS périmé.
- Tests DOM : sélection voyageurs, absence de suivi, TAD, GPS de départ réel, prévention du double lancement, arrivée HLP, publication, exclusion simulation et journal.
- Tests SQL transactionnels annulés : droits propriétaire, cloisonnement société, lecture publique limitée aux colonnes autorisées, identité inaccessible, écriture anonyme refusée, expiration.
- Assemblage du runtime et validation syntaxique des scripts ; génération des données des quatre départements.
- Le test visuel Playwright est fourni mais n’a pas pu s’exécuter ici : l’environnement bloque les sockets du navigateur. Un essai sur appareil réel reste nécessaire pour le GPS, le guidage et le passage en arrière-plan.

Tests : `npm ci --prefix tests && npm test --prefix tests`. Le test navigateur nécessite un site assemblé servi sur le port 8765 et Chromium (`CHROMIUM_PATH` facultatif).

## Limites de cette version

La page publique utilise les catalogues Fluo publiés : les réseaux externes et lignes personnalisées n’ont pas encore de catalogue voyageurs. Seuls les véhicules connectés et en course GPS fournissent une position. Le téléphone doit continuer à transmettre son GPS ; un navigateur suspendu ne peut pas garantir le suivi en arrière-plan. L’estimation HLP repose sur la durée routière restante, sans trafic en direct. En course, le dernier écart mesuré est reporté sur l’horaire des arrêts à venir : il s’agit d’une estimation, pas d’une garantie.
