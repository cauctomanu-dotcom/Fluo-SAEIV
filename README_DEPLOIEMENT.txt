FLUO SAEIV V31.6 — ÉDITION GITHUB MONOBLOC · PLANNING CONDUCTEUR
============================================================================

Base : V29, elle-même basée sur la V28.1 stable.

Fichiers à remplacer dans GitHub :
- index.html
- app.js
- sw.js
- manifest.webmanifest
- dossier data complet (obligatoire : lignes, arrêts, horaires et tracés officiels)
- build_gtfs.py (outil de régénération des données)

Le dossier tests est inclus pour vérification, mais il n'est pas nécessaire au fonctionnement
du site. Le plus simple est de déposer tout le contenu décompressé de l'archive dans GitHub.

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
- Profil de vitesse local sans API : 35–50 km/h en desserte rapprochée et 70–80 km/h sur les liaisons interurbaines.
- Le même profil local alimente l'ETA et la simulation sans ralentir le GPS ni l'interface.
- La vitesse route courante est également mémorisée avec les échantillons GPS du journal quand disponible.

IMPORTANT
---------
La V30.8 ne télécharge et n'affiche plus aucune limitation de vitesse OSM. Les anciens modules
V30.5 sont neutralisés ; les valeurs visibles en simulation correspondent uniquement au modèle local.

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


V30.5 — LIMITATIONS ROUTIÈRES (HISTORIQUE, DÉSACTIVÉ EN V30.8)
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

V30.7 — SIMULATION NON BLOQUANTE + GPS FLUIDE
------------------------------------------------
- Le lancement d'une simulation n'attend plus les services OSM/Overpass : la course part
  immédiatement avec la vitesse de secours, puis adopte le profil routier en arrière-plan.
- Une panne ou une forte latence du profil routier ne peut plus laisser le bouton bloqué
  sur « Profil routier » avec un sablier.
- En GPS réel, le navigateur demande toujours la position la plus fraîche (maximumAge 0).
- Le pictogramme et la caméra sont animés entre les fixes GPS. Cette interpolation reste
  strictement visuelle : annonces, arrêts, TAD et journaux utilisent le GPS réel uniquement.

V30.8 — SANS LIMITATIONS OSM + HORAIRES FLUO ACTUALISÉS
----------------------------------------------------------
- Suppression complète du chargement des limitations OSM/Overpass pendant la sélection,
  le GPS réel et la simulation.
- Retour à un profil local stable : 35–50 km/h en desserte rapprochée et 70–80 km/h
  pour les liaisons interurbaines de type départementale/nationale.
- Une limitation absente ne peut plus être convertie en 0 km/h.
- Données GTFS officielles Fluo régénérées le 25/08/2026 depuis les ressources
  courantes data.gouv/transport.data.gouv.fr publiées par Fluo Grand Est.
- Moselle : 423 lignes, horaires valables du 21/08/2026 au 15/08/2027.
- Meurthe-et-Moselle : 223 lignes, horaires valables du 21/08/2026 au 31/12/2026.
- Les flux couvrent les lignes régulières, scolaires et le transport à la demande.
- La création de lignes et les billets collectifs ne sont pas modifiés par cette mise à jour.

V30.9 — FICHE HORAIRE DIRECTEMENT DEPUIS LA LIGNE
---------------------------------------------------
- Après la sélection d'une ligne officielle 54 ou 57, un bouton « Voir la fiche horaire
  de la ligne » apparaît sous les informations de course.
- La fiche utilise les données GTFS officielles déjà embarquées : aucun site externe
  ni nouveau téléchargement n'est nécessaire.
- Choix de la date, du sens et du départ, puis affichage de tous les arrêts avec les
  heures d'arrivée et de départ.
- Mise en page imprimable depuis l'application.
- Les lignes personnalisées et les billets collectifs restent volontairement exclus,
  car ils ne possèdent pas de fiche officielle Fluo.
- « Tout sélectionner », « Supprimer la sélection » et « Effacer les journaux terminés » sont de nouveau opérationnels.
- Le service actuellement ouvert reste protégé contre la suppression.
- Suppression simultanée de la session et de tous ses événements IndexedDB associés.

V31.0 — LIMITATIONS OSM ET ÉCRAN PAYSAGE
-----------------------------------------
- Les limitations maxspeed OpenStreetMap, y compris les valeurs directionnelles et les
  valeurs spécifiques aux bus lorsqu'elles existent, sont chargées après la course.
- Le chargement ne bloque jamais le GPS ni le démarrage d'une simulation. Les profils sont
  conservés 7 jours sur l'appareil ; en cas de donnée absente ou de réseau indisponible,
  l'ancien modèle local 35–50–70–80 km/h reste immédiatement actif.
- Le car reste plafonné à 100 km/h, même si la limitation routière est supérieure.
- En paysage, les commandes principales sont regroupées sur une ligne en bas de la carte.
  Les commandes supplémentaires restent dans la colonne de droite.
- Le nom complet de la ligne, la destination physique et le prochain arrêt ne sont plus
  tronqués dans la colonne conducteur.

V31.1 — ARCHIVE PLATE POUR GITHUB
---------------------------------
- Tous les fichiers à publier se trouvent directement à la racine de l'archive : aucun dossier.
- Les 646 fichiers de lignes GTFS ont été regroupés en paquets JSON plus gros, sans supprimer
  de lignes, de parcours, d'arrêts, de services ni d'horaires.
- Les paquets sont chargés à la demande et conservés en mémoire afin de ne pas ralentir le
  lancement d'une course, la simulation ou le suivi GPS.
- L'archive finale contient moins de 100 fichiers et ne nécessite aucun fichier de test.

V31.2 — DONNÉES COMPRESSÉES POUR LE TÉLÉVERSEMENT WEB GITHUB
--------------------------------------------------------------
- Les paquets horaires restent compressés après extraction du ZIP : l'ensemble des fichiers
  à envoyer sur GitHub pèse désormais nettement moins de 25 Mio.
- L'application décompresse automatiquement le paquet nécessaire lors du choix d'une ligne.
- La compression est sans perte : les 646 lignes, 3313 parcours, arrêts, services et horaires
  officiels sont strictement identiques à la V31.1.

V31.3 — INTERFACE MONOBLOC ANTI-DÉPLOIEMENT PARTIEL
---------------------------------------------------
- Le design complet et toute la logique de l'application sont désormais intégrés directement
  dans index.html : aucun fichier JavaScript séparé ne peut manquer ou arriver en retard.
- Le cache PWA porte une nouvelle identité et récupère automatiquement cette version complète.
- Les profils conducteur, TAD, billets et journaux déjà enregistrés sur le téléphone restent
  conservés, car cette mise à jour ne touche pas aux données locales de l'utilisateur.


V31.4 — PAYSAGE CONDUCTEUR ÉPURÉ
- Bloc ponctualité réduit en carré : état au-dessus, avance/retard en dessous.
- Ligne et destination fusionnées dans un seul rectangle.
- Suppression du bloc vitesse de simulation dans la colonne droite.
- Bouton Suivre replacé directement sur la carte GPS.
- Suppression des boutons Suivre et GPS vocal de la barre de commandes basse.
- Prochain arrêt conservé comme information principale sous la rangée supérieure.


V31.5 — COCKPIT PAYSAGE VALIDÉ
--------------------------------
- Barre inférieure sur toute la largeur : arrêt précédent, Annoncer, arrêt suivant, Mode déviation,
  Demandes, Incident, Recaler poteau et Fin.
- Arrêt précédent/suivant resserrés pour intégrer Mode déviation sans défilement.
- Bouton 3D sur la carte à côté de la vitesse ; Fusion et Reprendre le suivi compactés.
- Colonne droite : ponctualité, numéro de ligne, origine-destination compacte, prochain arrêt.
- ARRÊT DEMANDÉ est intégré au prochain arrêt et utilise le ding-dong conducteur existant ;
  aucune phrase vocale n'est diffusée pour signaler la demande.
- Interrupteurs paysage : annonces vocales voyageurs et annonce destination.
- Commandes de simulation secondaires, visibles uniquement en simulation.
- GPS, TAD, journaux, déviation, incident, recalage et horaires restent basés sur les fonctions existantes.


V31.6 — MENU CONDUCTEUR + MON PLANNING + MA JOURNÉE
------------------------------------------------------
- Menu hamburger : Journaux, création de fiche horaire, fiches horaires enregistrées,
  création de ligne, Mes TAD, Mes billets, Mon planning et Admin.
- « Ma journée » ajouté aux choix de service, facultatif et automatiquement calé sur la date du jour.
- Planning hebdomadaire local : courses régulières, TAD, billets/services collectifs, haut-le-pied,
  prises/fins de service, travaux annexes, mise à disposition, pauses et coupures.
- Possibilité de lier une course exacte déjà sélectionnée dans le SAEIV : département, ligne, trip_id,
  arrêt de prise de service et sélection TAD sont mémorisés puis restaurés depuis « Ma journée ».
- Haut-le-pied : départ/destination libres ; vers une prochaine course liée, le module HLP existant
  du SAEIV peut être préparé automatiquement vers l'arrêt de prise de service.
- Totaux journée et semaine : amplitude, temps de travail, conduite, haut-le-pied, coupures/pauses.
- Contrôle RSE indicatif : travail quotidien, amplitude, repos quotidien, conduite UE 561/2006,
  pause après 4 h 30, limites hebdomadaires et cumul deux semaines lorsque les données existent.
- Distinction automatique possible entre service régulier <= 50 km et règlement UE selon la longueur
  renseignée/capturée ; un régime inconnu est signalé au conducteur au lieu d'être supposé.
- Le contrôle RSE reste une aide de planification : accords d'entreprise, dérogations et tachygraphe
  restent prioritaires.


=== V31.7 — PLANNING INTUITIF ===
- Course régulière : sélection guidée Département > Ligne > Sens.
- À partir de l'heure de début du planning, la course GTFS active la plus proche dans le sens choisi est liée automatiquement au SAEIV.
- Le départ, la destination, les horaires, la longueur de ligne et le régime RSE sont repris depuis la course liée.
- Haut-le-pied : le départ et la destination peuvent chacun être un arrêt Fluo 54/57 ou une adresse libre.
- Recherche d'arrêt dans la base locale Fluo avec conservation des coordonnées GPS exactes.
- Les adresses sont vérifiées et géocodées (Nominatim avec repli Photon) avant enregistrement.
- Ma journée lance un haut-le-pied vers la destination réellement enregistrée ; un accès séparé reste disponible vers la prochaine course liée.
- Le cockpit paysage V31.6.1 validé est conservé.
