FLUO SAEIV V23.1 — CORRECTION DU DÉPLOIEMENT

Le dépôt GitHub vérifié le 25/08/2026 était encore en V22.
Remplacer EXACTEMENT ces 4 fichiers à la racine du dépôt, branche main :
- index.html
- app.js
- sw.js
- manifest.webmanifest

Ne pas toucher à build_gtfs.py : celui de V22 convient.

Cette V23.1 contient réellement :
- Calcul horaires réouvert/corrigé ;
- Journaux cliquables ;
- Carte du trajet et arrêts avec heures de passage ;
- Rapport HTML téléchargeable avec carte et tableau ;
- Suppression individuelle ;
- Multi-sélection + suppression ;
- Nettoyage des journaux terminés ;
- Service en cours protégé ;
- Service worker forcé à prendre la nouvelle version immédiatement.

Après commit, attendre Build + Deploy, puis fermer complètement la PWA et la rouvrir.
Le titre/build doit afficher V23.1.
