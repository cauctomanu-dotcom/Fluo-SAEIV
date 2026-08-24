FLUO SAEIV V14 — TAD DYNAMIQUE + TRAÇABILITÉ LOCALE
=========================================================

Cette V14 reprend tout le contenu V13 :
- interface smartphone optimisée ;
- ding-dong d'arrêt demandé ;
- guidage visuel droite/gauche + distance, voix GPS désactivable ;
- icône bus orientée selon le déplacement ;
- choix voix voyageurs homme/femme ;
- profil conducteur local matricule + mot de passe (mot de passe non stocké en clair) ;
- connexion demandée à chaque nouvelle ouverture ;
- journal local des services : arrêts, horaires, avance/retard, positions et vitesses ;
- exports CSV et JSON.

NOUVEAUTÉ V14 — TAD
-------------------
En mode TAD, seuls les arrêts cochés sont des points de passage imposés.
Le SAEIV calcule automatiquement une route routière : arrêt de prise de service -> arrêts TAD sélectionnés dans l'ordre.
Les arrêts non cochés ne sont plus utilisés pour construire le tracé opérationnel et apparaissent très discrètement sur la carte.
La navigation, la fusion GPS, les distances, la simulation et l'interpolation avance/retard utilisent le nouveau tracé TAD.

Le calcul routier utilise le service public OSRM avec les coordonnées des arrêts Fluo. Il nécessite Internet lors d'un nouveau calcul. Les segments déjà calculés sont mis en cache localement sur le téléphone. Aucun compte conducteur ni journal de service n'est envoyé à OSRM.

IMPORTANT AUTOCAR
-----------------
Le profil de routage public utilisé est un profil routier standard et ne garantit pas les restrictions propres aux autocars/poids lourds (gabarit, tonnage, voies interdites). Le guidage doit rester une aide : le conducteur doit respecter la signalisation, les consignes d'exploitation et les itinéraires autorisés. Ne manipuler l'interface que véhicule immobilisé.

PAS DE SERVEUR DE DONNÉES
-------------------------
Conformément à la demande, cette V14 n'ajoute PAS Supabase ni de backend de comptes. Le profil et les journaux restent locaux sur l'appareil, comme en V13.

MISE À JOUR GITHUB
------------------
Remplacer uniquement ces 3 fichiers à la racine du dépôt Fluo-SAEIV :
- index.html
- sw.js
- manifest.webmanifest

Faire Commit changes sur main. GitHub Actions republiera automatiquement le site. Attendre build vert puis deploy vert.
Ensuite fermer complètement la PWA sur l'iPhone et la rouvrir. Si l'ancienne interface reste en cache, fermer à nouveau l'app puis la rouvrir après quelques secondes.
