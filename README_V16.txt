FLUO SAEIV V16 — VITESSES ROUTIÈRES + CALCUL HORAIRES + GPS 3D

NOUVEAUTÉS V16
- Simulation : vitesse variable selon le profil routier OSM/OSRM, avec plafond bus à 100 km/h.
- Accélération et freinage simulés à l'approche des arrêts.
- Onglet « Calcul horaires » : département, ligne, sens/parcours, arrêt de départ, heure de départ et temps d'arrêt moyen ; génération de l'horaire calculé à chaque arrêt.
- GPS MapLibre en perspective : 3D heading-up, vue SENS 2D et vue NORD. La caméra suit le véhicule.
- Nouveau symbole bus blanc, plus long, inspiré Iveco Crossway, avec marquage de toit « fluo GRAND EST » dans le sens de la longueur.
- Toutes les fonctions V15/V14/V13 sont conservées : cockpit paysage, TAD dynamique, ding-dong différé, navigation, voix homme/femme, journal local, matricule/mot de passe, etc.
- Aucun serveur/Supabase n'est ajouté.

IMPORTANT SUR LES VITESSES
Le site public OSRM utilise les données routières OpenStreetMap et son profil de conduite. V16 en déduit une limitation routière probable, ramenée aux paliers français usuels, puis applique systématiquement un plafond de 100 km/h au bus. C'est adapté à la simulation et au calcul théorique, mais ce n'est pas une base réglementaire certifiée. La signalisation réelle et les consignes d'exploitation restent prioritaires.

CALCUL DES HORAIRES
Le calcul n'inclut pas le trafic réel, les feux, les travaux ou les aléas. Le temps d'arrêt moyen est réglable (20 s par défaut).

INSTALLATION GITHUB
Remplacer à la racine du dépôt : index.html, sw.js, manifest.webmanifest.
Commit changes sur main puis attendre build et deploy en vert. Fermer complètement la PWA sur le téléphone et la rouvrir.
