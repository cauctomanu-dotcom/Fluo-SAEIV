FLUO SAEIV V21 — DING-DONG + ÉCRAN ACTIF + PRONONCIATION

Corrections par rapport à V20 :
- le ding-dong retentit exactement au moment où ARRÊT DEMANDÉ devient visible ;
- suppression de l’ancien second ding-dong retardé de V15 ;
- Screen Wake Lock renforcé pendant toute la prise de service/simulation, avec reprise automatique après rotation/retour au premier plan ;
- prononciation des lignes : 57R026 -> « 57 R 26 », R033 -> « R 33 », R361 -> « R 361 ».

Les tracés exacts V20 sont conservés sans modification.

À remplacer à la racine GitHub :
- index.html
- app.js
- sw.js
- manifest.webmanifest

build_gtfs.py est inclus dans le ZIP pour avoir une version complète, mais il est identique à V20 et n’a pas besoin d’être remplacé si V20 est déjà installée.

Limite iOS : le verrou d’écran fonctionne tant que la PWA reste au premier plan. iOS peut toujours suspendre une PWA passée en arrière-plan ou dans certaines situations système.
