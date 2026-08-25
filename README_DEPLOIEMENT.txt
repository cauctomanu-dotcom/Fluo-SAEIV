FLUO SAEIV V26 — MES TAD + ANNONCES VOCALES

Version cumulative basée sur la V25. Conserve la V25 sur ton ordinateur comme retour arrière.

À remplacer à la racine du dépôt GitHub (main) :
- index.html
- app.js
- sw.js
- manifest.webmanifest
- build_gtfs.py

La V26 contient aussi les fonctions V24/V25, donc build_gtfs.py reste nécessaire pour le catalogue des arrêts des lignes personnalisées.

NOUVEAUTÉS V26
1) TAD préparés à l'avance
- Préparer le TAD normalement : date, course, arrêt de départ, arrêts à desservir.
- Bouton « Enregistrer ce TAD » dans le panneau TAD.
- Bouton « Mes TAD » à côté des journaux/fiches/création de ligne, et directement dans le panneau TAD.
- Chaque TAD est lié à une date précise et conserve département, ligne, trip_id, départ et stop_id des arrêts retenus.
- « Charger ce TAD » restaure la course et relance le recalcul du tracé TAD dynamique.
- Suppression individuelle et nettoyage des TAD passés.

2) Annonces vocales manuelles
- Bouton « Annonces vocales » dans le cockpit portrait.
- En paysage : bouton sous les boutons conducteur de la colonne de droite.
- Bibliothèque : déviation, fin de déviation, arrêt non desservi, terminus, changement de destination, retard, régulation, changement conducteur, répartition voyageurs, fauteuil roulant, portes/sécurité, interruption de service, arrivée terminus.
- Texte modifiable avant validation, donc une annonce personnalisée peut aussi être saisie.
- Priorité 80 : les annonces automatiques de prochain arrêt/arrivée restent prioritaires.

Après le commit, attendre Build + Deploy puis fermer complètement la PWA et la rouvrir. Le bandeau doit afficher V26.

ATTENTION
- Les TAD restent stockés localement sur le smartphone tant que le backend serveur n'est pas mis en place.
- Le chargement d'un TAD dépend encore de la présence de la course dans le GTFS de la date concernée ; un fallback horaire est prévu si le trip_id change.
- Les annonces utilisent la synthèse vocale web : les limites iOS concernant le routage Bluetooth et le ducking restent les mêmes qu'avant.
