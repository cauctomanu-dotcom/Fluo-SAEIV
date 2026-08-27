MON SAEIV 1.0.1 — DÉPLOIEMENT
==============================

Identité publique : Mon SAEIV · version 1.0.1.
Les anciennes références de versions ci-dessous sont conservées uniquement comme historique technique de maintenance et ne sont plus affichées dans l’application.

FLUO SAEIV V31.15 — NOTE DE VERSION

- 54 : anciens numéros conservés pour les dates de service jusqu’au 31/08/2026.
- 54 : à partir du 01/09/2026, chargement du GTFS régional officiel (CG54) et nouvelle numérotation.
- Le basculement suit la DATE DE SERVICE sélectionnée, ce qui permet de préparer à l’avance un planning de septembre tout en conservant août dans l’ancien système.
- 67/68 : GTFS régional officiel conservé.
- Le cache PWA est versionné V31.15 afin de forcer le renouvellement après déploiement GitHub Pages.

FLUO SAEIV V31.14 — BAS-RHIN 67 + HAUT-RHIN 68
=================================================

- Ajout du Bas-Rhin (67) et du Haut-Rhin (68) dans le SAEIV, le planning, les fiches horaires et la recherche d’arrêts.
- Règle de classement demandée : 67R + chiffres et 68R + chiffres = lignes régulières ; toutes les autres lignes 67/68 = scolaires.
- Les données 67/68 sont synchronisées depuis les flux GTFS officiels lors de la première utilisation, puis mises en cache localement pendant 24 h afin de ne pas alourdir inutilement le dépôt GitHub.
- Les 54/57 restent embarqués dans l’archive comme auparavant.
- Une connexion Internet est donc nécessaire lors du premier chargement d’un département 67 ou 68 (et lors du rafraîchissement du cache).

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


=== V31.8 — PLANNING INTUITIF V2 ===
- Mon planning : filtre Ligne régulière / Ligne scolaire avant la liste des lignes.
- Classification Fluo : les lignes scolaires S/E sont séparées des lignes régulières.
- Après choix ligne + sens, l’application charge les heures de départ réellement disponibles pour la date du planning.
- Le choix d’une heure lie la course exacte et récupère automatiquement horaires, origine et terminus.
- Haut-le-pied : carnet d’adresses locales. Une adresse vérifiée peut être enregistrée sous un nom, rappelée en départ ou destination, modifiée ou supprimée.
- Le carnet d’adresses est stocké localement dans le navigateur et a été structuré pour pouvoir être réutilisé plus tard dans les billets collectifs.
- Cockpit paysage validé V31.6.1/V31.7 conservé.


=== V31.10 — CORRECTIF MENU / PLANNING ===
- Restauration du menu hamburger conducteur.
- Restauration de « Ma journée » et « Mon planning ».
- Restauration de « Créer une fiche horaire » dans le menu, ainsi que les fiches enregistrées.
- Conservation du planning intuitif : lignes régulières/scolaires, sens, départs disponibles, favoris d’adresses.
- Conservation du haut-le-pied avec départ repris automatiquement depuis l’arrivée de l’étape précédente lorsque possible.
- Conservation du cockpit paysage validé.


=== V31.11 — FIN DE COURSE INTELLIGENTE / TERMINUS ===
- Le bouton FIN du cockpit est désormais traité comme une fin de course et ferme toujours proprement le journal actif.
- Si FIN est utilisé avant d'avoir franchi l'avant-dernier arrêt opérationnel, le journal est classé INTERROMPU.
- À partir de l'avant-dernier arrêt franchi (prochain arrêt = terminus), FIN classe le journal TERMINÉ.
- La logique tient compte du terminus opérationnel TAD lorsque le service est en TAD.
- Au terminus, l'annonce d'arrivée contient désormais un message professionnel de rappel des effets personnels et de remerciement voyageurs.
- Le cache PWA passe en V31.11 pour éviter le rechargement d'une ancienne interface.

V31.14 — BAS-RHIN / HAUT-RHIN : SOURCE REGIONALE COMPLETE
- Les départements 67 et 68 utilisent désormais le GTFS régional unifié Fluo Grand Est (ressource 83635).
- Le 67 est isolé par les identifiants de réseau CG67: ; le 68 par CG68:.
- Cette méthode inclut les lignes scolaires qui peuvent manquer dans certains anciens exports départementaux.
- Classement planning : 67R+chiffres / 68R+chiffres = régulières ; autres lignes des départements = scolaires.
- Le ZIP régional est mis en cache 24 h et partagé entre 67 et 68 pour éviter un double téléchargement.


V31.14 — Classement 67/68 pendant la renumérotation 2026/2027
- anciennes références 67R/68R reconnues quand elles sont encore présentes dans les métadonnées ;
- nouvelle numérotation officielle : 3 chiffres = ligne régulière, 4 chiffres = ligne scolaire ;
- compatibilité avec la transition particulière du Bas-Rhin, dont les lignes régulières changent plus tard.

V31.16 — correctif opérationnel 57R026
- Course 07:56 au départ de BARONVILLE - Route Nationale : ajout de CHATEAU-SALINS - Ancienne Gare en terminus à 08:27, après Place Du Ruisseau Salé 08:25.
- Course 17:45 au départ de CHATEAU-SALINS - Place Du Ruisseau Salé : ajout de CHATEAU-SALINS - Ancienne Gare à 17:47 avant Centre Hospitalier 17:50.
- Les géométries des deux variantes ont été alignées sur les variantes GTFS déjà présentes qui desservent Ancienne Gare, afin que le guidage GPS passe réellement par le nouvel arrêt.


V31.17 — COCKPIT PAYSAGE / ANNONCES
- Le bouton jaune « Annoncer » du cockpit paysage ouvre désormais le menu complet des annonces vocales manuelles.
- Il ne répète plus l'annonce du prochain arrêt.
- Le bouton « Annonces vocales » est retiré de la colonne droite du cockpit paysage.
- Le bouton « Annonce destination » ON/OFF reste disponible.

V31.18 — CORRECTIF BOUTON ANNONCER PAYSAGE
- Le bouton jaune « Annoncer » du cockpit paysage n'utilise plus le bouton historique caché comme proxy.
- Il appelle directement l'ouverture de la bibliothèque d'annonces vocales manuelles.
- Le panneau d'annonces V26 expose désormais une fonction d'ouverture dédiée pour les interfaces récentes.
- Le toggle « Annonce destination » reste en colonne droite ; le toggle « Annonces vocales » reste retiré du cockpit paysage.


V31.19 — 57R027 / ARRÊTS À LA DEMANDE ET SERVICES SUR RÉSERVATION
- La 57R027 reste une ligne régulière : elle n'est pas transformée en mode TAD.
- Les arrêts identifiés « à la demande » par la fiche officielle 027 apparaissent comme tels dans le menu Demandes.
- Un arrêt conditionnel non activé est ignoré dans la progression ; l'activer signifie soit une descente demandée, soit une montée réservée.
- Le SAEIV recalcule le tracé routier de la 57R027 entre les arrêts réellement opérationnels ; une modification de demande entraîne un nouveau calcul.
- Si OSRM est indisponible, la course reste lançable avec le tracé officiel et un avertissement permet de relancer le calcul.
- Services entièrement sur réservation signalés au conducteur : Château-Salins → Metz 11:00 et 13:00 ; Metz → Château-Salins 09:15 et 13:45 (référence fiche officielle 027).
- Les arrêts réguliers classiques continuent d'être desservis normalement ; leur bouton Demandes conserve son rôle d'alerte de descente.

V31.20 — 57R027 / CONTRÔLE DES MONTÉES RÉSERVÉES AVANT DÉPART
- Aucune modification du cockpit paysage ni du graphisme existant.
- Pour une course régulière 57R027 comportant des arrêts à la demande, le SAEIV demande avant le départ si des montées ont été réservées.
- Réponse NON : aucun arrêt conditionnel n'est activé avant départ et leurs détours sont exclus du parcours.
- Réponse OUI : une liste limitée aux arrêts à la demande de la course s'ouvre ; le conducteur coche les montées réservées puis valide.
- Pendant la course, le menu Demandes continue de permettre d'activer un arrêt à la demande pour une descente voyageur.
- Un arrêt conditionnel non activé reste absent de la progression et le GPS recalcule le parcours sans son détour.
- Exemple vérifié sur le départ 18:25 de Metz : LIOCOURT - Fontaine et FRESNES-EN-SAULNOIS - Place Des Tilleuls sont conditionnels ; s'ils ne sont pas demandés/réservés, ils sont contournés.

V31.21 — 57R027 / SYMBOLES SUR LES FICHES HORAIRES
- Aucune modification du cockpit, du planning, de Ma journée ni des autres fonctions existantes.
- Dans la fiche horaire officielle intégrée de la 57R027, les arrêts conditionnels sont annotés course par course.
- ↑ = montée sur réservation préalable.
- ↓ = descente à la demande pendant la course.
- ↑↓ = arrêt desservi à la demande selon la règle officielle : une montée peut être réservée avant départ et une descente peut être demandée en ligne.
- Les symboles n'apparaissent que sur les courses où l'arrêt est réellement concerné, avec une légende visible et imprimable.


V31.22 — ANNONCE VOCALE / CEINTURE DE SÉCURITÉ
- Aucune modification du design, du cockpit, du planning, de Ma journée, des HLP, des fiches horaires ni des fonctions 57R027.
- Ajout dans la bibliothèque d’annonces vocales manuelles d’une entrée « Ceinture de sécurité ».
- Texte : « Pour votre sécurité, nous vous rappelons que le port de la ceinture de sécurité est obligatoire lorsque votre siège en est équipé. Merci de bien vouloir l’attacher et de la conserver attachée pendant toute la durée du trajet. »
- Le système de synthèse vocale et les priorités d’annonces existants sont inchangés.


V31.23 — BIBLIOTHÈQUE D’ANNONCES VOCALES PAR CATÉGORIES
- Remplacement des anciennes annonces prédéfinies par 22 nouvelles annonces validées.
- Catégories : Sécurité ; Vie à bord ; Conditions de circulation ; Déviations ; Conditions météorologiques ; Retards et régulation ; Immobilisation du véhicule.
- La création, l’enregistrement et la diffusion des annonces personnalisées V28 sont conservés.
- Aucun changement du cockpit, du planning, de Ma journée, des HLP, des fiches horaires ou des fonctions 57R027.


V31.24 — DESSERTES CONDITIONNELLES + ANNONCES PAR CATÉGORIES
- Lignes régulières classiques : aucun changement.
- Arrêts conditionnels : lecture des règles GTFS pickup_type/drop_off_type lorsque la source officielle les fournit.
- Montée sur réservation : contrôle conducteur avant départ, puis choix des arrêts concernés.
- Descente à la demande : l'arrêt reste hors parcours tant qu'il n'est pas demandé pendant la course.
- Courses intégralement sur réservation : conservées en mode TAD, pas en ligne régulière conditionnelle.
- 57R027 : règles embarquées conservées comme repli fiable.
- Annonces vocales : premier écran de catégories, puis annonces de la catégorie.
- Annonces personnalisées : catégorie obligatoire, existante ou nouvelle ; anciennes annonces sans catégorie migrées automatiquement.
- Design général, cockpit, planning, Ma journée, HLP, journaux et données embarquées conservés.


V31.25 — BIBLIOTHÈQUE DES FICHES HORAIRES DU RÉSEAU
- Nouvel onglet « 📚 Fiches horaires » dans le menu hamburger.
- Navigation : département 54/57/67/68 → lignes régulières ou scolaires → ligne → fiche horaire.
- Consultation indépendante : aucune modification de la course en préparation, du planning, de Ma journée ou du cockpit.
- Date de service, sens/destination, départs, horaires arrêt par arrêt et impression.
- Symboles ↑/↓ des dessertes conditionnelles conservés quand les données officielles les fournissent ; course intégralement sur réservation signalée TAD.
- Les fonctions V31.24 et antérieures sont conservées.


V31.26 — CORRECTIF MENU HAMBURGER / FICHES HORAIRES
- Le bouton « 📚 Fiches horaires » est désormais créé directement dans le constructeur du menu hamburger, au même niveau que Journaux, Créer une fiche horaire, Fiches horaires enregistrées, Création de ligne, Mes TAD, Mes billets, Mon planning et Admin.
- Le module V31.25 de consultation des horaires réutilise ce bouton natif au lieu de l’injecter tardivement.
- Correctif conçu pour éliminer le cas où l’onglet n’apparaissait pas selon l’ordre de chargement ou le cache PWA.
- Aucun changement du planning, de Ma journée, du cockpit, des HLP, des annonces, des dessertes conditionnelles ou des données embarquées.

V31.27 — INFORMATION D’UTILISATION
------------------------------------
- À chaque ouverture, une information rappelle que le SAEIV est un outil d’aide au conducteur et ne remplace pas les outils, procédures, documents ou consignes de l’entreprise.
- Le message précise que des erreurs ou décalages de mise à jour peuvent subsister et que les références de l’entreprise prévalent en cas de divergence.
- Les informations, historiques et journaux de l’application n’ont, à ce jour, pas valeur de justificatif officiel ou opposable.
- Les libellés visibles liés au GPS et à la voix utilisent désormais « Vérifier » et « Aperçu » plutôt qu’un vocabulaire de version de test.
- Toutes les fonctions V31.26 et antérieures sont conservées.


V31.28 — Correctif Fiches horaires : les données embarquées restent prioritaires. Si un paquet core local renvoie HTTP 404 depuis GitHub/PWA, la bibliothèque bascule automatiquement sur le GTFS officiel Fluo pour le département concerné. Aucun changement de design, planning, cockpit ou logique conducteur.


Mon SAEIV 1.0.2 — ADMINISTRATION + EXPORT PDF DES JOURNAUX
----------------------------------------------------------
- « Création de ligne » n’apparaît plus dans le menu hamburger conducteur.
- La création de ligne est désormais accessible depuis le module Admin.
- Les journaux disposent d’un bouton « Exporter PDF ».
- Si des journaux sont cochés, seuls ceux-ci sont exportés ; sans sélection, tous les journaux du conducteur sont regroupés dans le PDF.
- Le PDF contient les informations de service et les passages aux arrêts avec horaires réels/prévus, écarts et vitesses.
- Le PDF est généré localement, sans bibliothèque ni service externe.
- Planning, Ma journée, cockpit, fiches horaires, annonces, TAD, HLP et données réseau inchangés.


MON SAEIV 1.0.3 — FIABILISATION GPS
- Détection et réparation routière des ruptures de shape importantes.
- Aucun segment droit artificiel n’est affiché lorsqu’une rupture reste non réparée hors connexion.
- Recalcul automatique vers le parcours après sortie de route confirmée.
- Guidage tourner droite/gauche enrichi avec les étapes routières (rond-points, sorties, bretelles, embranchements, noms de voies) quand le réseau est disponible.
- Cas de contrôle : 57R028 13:50 Château-Salins → Dieuze, ruptures après Mulcey détectées.


MON SAEIV 1.0.4 — CORRECTION D’IDENTITÉ
- Correction du nom public : Mon SAEV devient Mon SAEIV.
- Version publique : 1.0.4.
- Aucun changement fonctionnel par rapport à la 1.0.3 : tous les correctifs GPS sont conservés.


MON SAEIV 1.0.5 — FLUIDITÉ GPS
- Le pictogramme est désormais animé en continu entre les rafraîchissements GPS natifs.
- Sur le parcours, l’animation suit la géométrie routière et utilise une prédiction très courte, plafonnée selon la vitesse et la précision GPS.
- Si aucune nouvelle position n’arrive, la prédiction est plafonnée puis le pictogramme s’immobilise au lieu de continuer artificiellement.
- Leaflet et la carte MapLibre utilisent la même position visuelle pour éviter les sauts à chaque nouveau point GPS.
- Les passages aux arrêts, journaux, calculs horaires et détection hors parcours restent basés uniquement sur les positions GPS natives.
- Tous les correctifs GPS de la 1.0.3/1.0.4 sont conservés.


MON SAEIV 1.0.6 — PRONONCIATION DES ARRÊTS
- Reprend intégralement la 1.0.5, y compris la fluidité GPS.
- Correction de synthèse vocale uniquement : « Place du Marche » est annoncé « Place du Marché » avec é final.
- « Ars-Laquenexy » force la prononciation du S final de Ars.
- « Cimetière » force une articulation nette du T.
- Les libellés affichés, les horaires et les 30 paquets de données restent inchangés.


MON SAEIV 1.0.7 — RADIO INTÉGRÉE
- Ajout de 📻 Radio dans le menu hamburger principal.
- Ajout d’un petit bouton ☰ sur la carte pendant la navigation pour accéder à la radio sans quitter la course.
- Menu conduite : Radio, Annoncer, Demandes clients et GPS vocal.
- Lecteur radio intégré avec Principales, Locales / Grand Est, Favoris et recherche.
- Catalogue Radio Browser utilisé à la volée ; les flux restent ceux des stations référencées.
- Le volume radio baisse automatiquement pendant les annonces voyageurs et les consignes GPS, puis remonte progressivement.
- Dernière station, volume et favoris conservés localement.
- Toutes les fonctions de Mon SAEIV 1.0.6, notamment la fluidité GPS 1.0.5 et les corrections de prononciation 1.0.6, sont conservées.


Mon SAEIV 1.0.8 — Ma caisse
- Ajout de Ma caisse dans le menu hamburger.
- Fonds de caisse 50 € par défaut, modifiable par conducteur.
- Saisie détaillée par titres/tarifs ou saisie d’un montant global.
- Récapitulatifs jour/semaine/mois/tout, quantité de titres et caisse théorique.
- Bouton Faire ma caisse dans Ma journée.
- Données de caisse conservées localement par matricule.


MON SAEIV 1.0.10 — CORRECTIFS MA JOURNÉE + RADIO
- Correction de la zone d’actions en bas de Ma journée sur mobile : boutons non compressés et empilés proprement sur petit écran.
- « Choix manuel » devient « Choisir une course manuellement » pour expliciter son rôle.
- Correction de la liste radio : noms de stations et informations de flux restent lisibles, y compris avec le clavier iOS ouvert et en paysage.
- Le catalogue radio privilégie désormais les flux HTTPS MP3/AAC de débit modéré, en particulier 48 à 160 kb/s, et dédoublonne les flux portant le même nom de station.
- En cas de buffering/saccades répétés, tentative automatique d’un autre flux disponible pour la même station.
- Les favoris et le volume radio existants sont conservés ; le cache du catalogue est renouvelé pour appliquer la nouvelle sélection de flux.
- Toutes les fonctions 1.0.8 et antérieures sont conservées.


Mon SAEIV 1.0.10
- Correctif tactile/iOS de la sélection des arrêts dans Admin > Création de ligne.
- Aucun changement des données réseau ni des autres fonctions.


MON SAEIV 1.0.13 — MULTIRÉSEAUX URBAINS PILOTES
- Prise de service : choix Interurbain / Urbain avant le réseau.
- Urbain pilote : LE MET’ (Metz) et TeMo’b (Thionville/Fensch), GTFS officiels chargés à la demande.
- Fiches horaires : LE MET’ et TeMo’b ajoutés à la bibliothèque réseau.
- Correspondances inter-réseaux : préparation en avance du prochain arrêt ; Fluo 57 + réseau urbain de la zone ; ligne conduite exclue.
- Filtre horaire correspondances : départs entre 10 min avant et 90 min après l’heure d’arrivée prévue.
- Voix : correspondances annoncées uniquement à l’arrivée à l’arrêt ; jamais dans « Prochain arrêt ».
- Affichage : correspondances visibles sous le prochain arrêt, regroupées par réseau.
- Option conducteur : correspondances vocales ON/OFF.
- Les réseaux Fluo, le planning, Ma journée, le TAD, la caisse, la radio et le GPS restent inchangés.

Mon SAEIV 1.0.13 — correctif LE MET’ PWA
- Le GTFS LE MET’ utilise désormais en priorité la ressource officielle data.gouv.fr référencée par le catalogue national.
- Les liens transport.data.gouv.fr, data.lemet.fr et une copie historisée officielle du PAN restent disponibles en secours.
- Le cache GTFS urbain est versionné 1.0.13 afin d’éviter de conserver un échec de chargement précédent.
- TeMo’b et toutes les fonctions existantes restent inchangés.


MON SAEIV 1.0.14 — RÉSEAUX URBAINS LUXEMBOURG
- Ajout AVL (Autobus de la Ville de Luxembourg), TICE (Esch / Sud Luxembourg) et Diffbus (Differdange) dans Urbain.
- GTFS national luxembourgeois partagé : un seul téléchargement, filtrage par réseau et cache local.
- Les nouveaux réseaux sont disponibles dans la prise de service et dans la bibliothèque Fiches horaires.
- Correspondances inter-réseaux étendues aux réseaux luxembourgeois à proximité.
- Diffbus : détection des lignes Diffbus/Differdange publiées dans le GTFS national ; le réseau officiel comporte 4 lignes depuis la refonte du 13 avril 2026.
- LE MET’, TeMo’b, Fluo et toutes les fonctions antérieures restent inchangés.
