FLUO SAEIV V20 — TRACÉS EXACTS

Cette version réécrit le moteur de géométrie de la carte.

À remplacer à la racine du dépôt GitHub :
- index.html
- app.js
- build_gtfs.py
- sw.js
- manifest.webmanifest

Pourquoi app.js et build_gtfs.py cette fois ?
V20 ne pose pas un correctif d'affichage : elle remplace la logique qui construit et exploite les tracés.
Le générateur conserve désormais TOUS les points officiels de shapes.txt (7 décimales) et ne fabrique plus de shape à partir des seuls arrêts. Si Fluo ne fournit pas de shape pour une course, le navigateur reconstruit un trajet routier OSM/OSRM et bloque le démarrage si cette reconstruction échoue.

Après Commit changes, attendre build + deploy verts. Le workflow quotidien continuera ensuite à télécharger les GTFS Fluo à jour.
