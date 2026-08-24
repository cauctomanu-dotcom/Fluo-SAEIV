FLUO SAEIV V22 — TAD + SUIVI STABLE

Nouveautés :
- TAD : l'arrêt choisi dans « Arrêt de prise de service » est le départ réel.
- Seuls les arrêts cochés après ce départ sont desservis.
- Le dernier arrêt coché devient automatiquement le terminus ; le tracé dynamique s'y arrête.
- Suivi réécrit : progression bornée le long du shape pour éviter les sauts à un carrefour/une branche voisine.
- Cap du Crossway calculé sur la tangente du tracé puis lissé ; le heading brut du téléphone n'est plus l'autorité.
- Position affichée recalculée sur le même « along » que le moteur de fusion.
- Caméra MapLibre : suppression des animations empilées ; en simulation, suivi image-par-image sans retard.
- Orientation cohérente en vues 3D, Sens et Nord.

Analyse vidéo du 24/08/2026 : les changements brusques observés venaient surtout du cap brut et de l'empilement des easeTo, ainsi que d'un possible choix de segment voisin aux carrefours. V22 traite les trois causes.

Mise à jour GitHub : remplacer index.html, app.js, sw.js, manifest.webmanifest. build_gtfs.py est inchangé par rapport à V21/V20.
