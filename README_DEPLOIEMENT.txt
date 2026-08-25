FLUO SAEIV V30 — EXPLOITATION + BILLET COLLECTIF + JOURNAL ARRIVÉE/DÉPART
============================================================================

Base : V29, elle-même basée sur la V28.1 stable.

Fichiers à remplacer dans GitHub :
- index.html
- app.js
- sw.js
- manifest.webmanifest
- build_gtfs.py (inclus, pas de changement fonctionnel spécifique V30)

Nouveautés / corrections V30 :
- Journal : les annonces vocales et les bascules audio ne sont plus enregistrées.
- Journal arrêt par arrêt : heure d'arrivée réelle + prévue + écart, puis heure de départ réelle + prévue + écart.
- Départ réel détecté au redémarrage après le poteau ; le premier arrêt de prise de service a lui aussi son départ réel.
- La trace GPS réelle reste échantillonnée autour de 6 m en mouvement et est affichée face au tracé prévu.
- Rapport d'incident : type « Autre » personnalisable, photo facultative via appareil photo/fichier, photo conservée dans le journal et le rapport HTML.
- Zone Contacts exploitation prête pour de futurs numéros ; aucun numéro n'est inventé dans cette version.
- Correctif responsive après fermeture du rapport d'incident (portrait/paysage + redimensionnement des cartes).
- Correctif Création de ligne : les listes de résultats Départ/Terminus se ferment après sélection.
- Meurthe-et-Moselle : 54R + chiffres = ligne régulière ; toutes les autres lignes du 54 sont classées scolaires.
- Nouveau type de service « Billet collectif » : aucun département/type de ligne requis ; départ et destination par arrêt Fluo ou adresse ; étapes intermédiaires ajoutables ; calcul OSRM ; navigation GPS réelle ou simulation.
- Restauration de la vitesse route : profil estimé OSM/OSRM affiché dans le panneau carte et dans le cockpit paysage, car plafonné à 100 km/h.
- Le même profil routier alimente une ETA dynamique prochain arrêt / terminus et reste utilisé par la simulation.
- La vitesse route courante est également mémorisée avec les échantillons GPS du journal quand disponible.

IMPORTANT
---------
La limitation affichée provient désormais des attributs maxspeed publiés dans OpenStreetMap. Les vitesses moyennes de routage OSRM ne sont plus converties en panneaux. Si aucun maxspeed exploitable n'est disponible, l'application affiche « — ».

Les adresses du mode Billet collectif nécessitent une connexion Internet pour le géocodage et le routage.
Les contacts d'exploitation seront ajoutés lorsque les noms et numéros seront fournis.

Manipuler l'interface uniquement véhicule immobilisé.


V30.1 — ROUTES À ÉVITER + ARRÊT DEMANDÉ + RESPONSIVE
======================================================
- Le module Admin ne demande plus latitude/longitude.
- Route à éviter par saisie d’une rue/adresse complète : géocodage OSM puis récupération de la voirie nommée.
- Sélection sur carte : rue entière par un toucher, ou portion de route définie par deux points.
- Le tracé à éviter est prévisualisé en rouge avant enregistrement.
- Compatibilité conservée avec le moteur V29 : la rue est convertie en points de contrôle internes le long de sa géométrie, sans saisie manuelle de coordonnées.
- ARRÊT DEMANDÉ remplace temporairement le libellé « PROCHAIN ARRÊT » dans le même encadré ; aucun déplacement ni changement de hauteur du cockpit.
- L’ancien encadré ARRÊT DEMANDÉ est conservé techniquement hors écran pour le ding-dong, mais ne modifie plus la mise en page.
- Responsive renforcé : boutons de type de service, modales, safe areas, rotation et recalcul des cartes après fermeture/orientation.

La récupération d’une rue entière nécessite une connexion Internet (Nominatim/Overpass OpenStreetMap).
Le routage public OSRM choisit parmi ses alternatives et rejette celles qui touchent une route enregistrée ; si aucune alternative compatible n’est proposée, l’application signale que le calcul est impossible au lieu d’utiliser la rue interdite.


V30.2 — RECALAGE DES POTEAUX SUR LE TRACÉ
===========================================
- La coordonnée GTFS source de chaque arrêt est conservée pour traçabilité.
- Lorsqu'un poteau est légèrement décalé de la géométrie officielle de sa course, le SAEIV calcule sa projection perpendiculaire sur le tracé et utilise ce point opérationnel pour la carte, la détection d'arrivée, la simulation, le recalage et les futurs journaux.
- Recalage automatique volontairement limité à 75 m pour les arrêts ordinaires afin d'éviter de déplacer un poteau sur une rue parallèle.
- Correction terrain renforcée à Vic-sur-Seille (jusqu'à 180 m si nécessaire) :
  * VIC-SUR-SEILLE — École : rattachement au passage de la course sur la rue de Metz.
  * VIC-SUR-SEILLE — Cimetière : rattachement au passage de la course sur l'avenue/rue du Général-de-Gaulle.
- Le nom de l'arrêt et sa coordonnée GTFS d'origine ne sont pas perdus ; seul le point opérationnel utilisé par le SAEIV est recalé.


V30.3 — ROUTES A EVITER SUR LE TRACE PRINCIPAL
- Une route administrateur qui est réellement empruntée par la course déclenche un recalcul des inter-arrêts concernés avant la prise de service.
- Les simples croisements de rue ne sont pas considérés comme un emprunt de la voie.
- Les arrêts sont conservés ; seuls les tronçons entre deux arrêts concernés sont remplacés par un contournement OSRM compatible.
- Si aucune alternative ne peut être trouvée, le tracé officiel est conservé pour le tronçon et une alerte rouge l’indique au lieu d’inventer un parcours.
- Le service est bloqué pendant le recalcul afin d’éviter de démarrer avec une géométrie en cours de modification.


V30.4 — BILLETS COLLECTIFS PRÉPARÉS
=====================================
- Date de service dans Billet collectif.
- Enregistrement du billet après calcul : nom, date, heure, départ, destination, étapes, type arrêt/adresse, coordonnées, tracé, distance et durée.
- Bibliothèque « Mes billets collectifs » accessible depuis le module et la barre conducteur.
- Chargement le jour J avec champs, étapes, carte et tracé restaurés, prêt à lancer ou recalculer.
- Données séparées par matricule dans IndexedDB.
- Suppression individuelle et nettoyage des billets passés.


V30.5 — LIMITATIONS ROUTIÈRES
- Suppression de l'ancienne estimation des limitations à partir de la vitesse de routage OSRM.
- Lecture des valeurs maxspeed publiées dans OpenStreetMap autour du tracé réellement utilisé par le SAEIV.
- Prise en compte de maxspeed, maxspeed:forward/backward, maxspeed:bus et variantes directionnelles.
- Quelques conditions jour/heure simples de maxspeed:conditional peuvent être appliquées ; les conditions météo/école/poids non vérifiables ne sont pas inventées.
- La grande valeur affichée correspond à la limitation de route publiée. Si la limite applicable au car diffère (par exemple route 130 / car 100), la limite car est indiquée séparément.
- Si aucune limitation fiable n'est publiée pour la portion, l'interface affiche « — » au lieu d'inventer une valeur.
- Le profil de service tient compte du tracé courant, y compris les routes administrateur évitées/recalculées.
- Source en ligne : OpenStreetMap via Overpass. Une connexion est nécessaire pour charger les limitations non mises en cache pendant la session.

Google Maps Roads API propose également des limitations de vitesse, mais ce service n'est pas librement utilisable par une PWA publique et nécessite un accès Google Maps Platform adapté. La V30.5 n'embarque donc aucune clé Google dans le navigateur.


Note V30.5 : la grande valeur du panneau correspond à la limitation générale de la route lorsqu'elle est explicitement connue. Une éventuelle valeur maxspeed:bus est affichée séparément sous la forme « CAR xx ». Une limitation bus seule n'est jamais présentée comme la limitation générale de la route.

V30.5 — CORRECTION GESTION DES JOURNAUX
- Cases de sélection remises au premier plan et rendues cliquables.
- Un clic sur une case ne déclenche plus l'ouverture du journal.
- Suppression individuelle reprise par un gestionnaire V30.5 indépendant.
- « Tout sélectionner », « Supprimer la sélection » et « Effacer les journaux terminés » sont de nouveau opérationnels.
- Le service actuellement ouvert reste protégé contre la suppression.
- Suppression simultanée de la session et de tous ses événements IndexedDB associés.
