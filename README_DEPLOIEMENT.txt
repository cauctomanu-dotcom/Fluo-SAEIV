FLUO SAEIV V29 — EXPLOITATION + JOURNAL INTÉGRAL
=================================================

Base : V28.1 stable.

Fichiers à remplacer dans GitHub :
- index.html
- app.js
- sw.js
- manifest.webmanifest
- build_gtfs.py (inchangé fonctionnellement, inclus pour garder le paquet complet)

Nouveautés V29 :
- Journal intégral depuis PRISE DE SERVICE jusqu'à FIN DE SERVICE.
- Trace prévue (jaune) + trace GPS brute réellement effectuée (bleu) sur la carte et dans le rapport HTML.
- Échantillonnage journal ciblé à ~6 m en mouvement, avec point de contrôle temporel à l'arrêt. La fréquence réelle reste limitée par les positions que le téléphone fournit ; aucune position GPS fictive n'est créée.
- Chronologie des événements : arrêts, demandes voyageurs, annonces, activation/désactivation des annonces, recalages, déviations, incidents, actions conducteur importantes, arrière-plan/fermeture, fin de service.
- Convention : toute nouvelle fonction métier ajoutée après V29 doit écrire ses événements via window.FluoJournalCore.log().
- Mode déviation manuel : sortie volontaire du parcours officiel, puis rattrapage vers un point logique situé plus loin sur la ligne.
- Mode administrateur protégé : zones/rues locales à éviter, utilisées pour les rattrapages et mises en place lorsque le routeur public propose une alternative compatible.
- Aucun bannissement automatique de toutes les routes >3,5 t : les dérogations cars sont trop dépendantes du terrain.
- Aperçu cartographique de la course avant prise de service.
- Mise en place / haut-le-pied depuis la position actuelle vers l'arrêt de prise de service.
- ETA prochain arrêt + ETA terminus.
- Rapport d'incident en service, automatiquement horodaté et géolocalisé dans le journal.

IMPORTANT
---------
Les routes à éviter sont des zones locales de contournement enregistrées sur cet appareil. Le routeur public OSRM ne connaît pas les dérogations propres à l'entreprise et ne permet pas d'exprimer toutes les restrictions véhicules lourds/bus. Le conducteur reste la référence terrain.

Manipuler l'interface uniquement véhicule immobilisé.
