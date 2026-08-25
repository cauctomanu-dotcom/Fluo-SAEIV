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
La vitesse route affichée est issue du profil OSM/OSRM disponible. Elle est informative et n'est pas présentée comme une limitation réglementaire certifiée. Si la donnée n'est pas exploitable, l'application affiche « — » au lieu d'inventer une valeur.

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
