FLUO SAEIV V28 — BASE STABLE CONDUCTEUR

Cette version repart de la V26 stable, et NON de la V27 expérimentale.
La V27 de navigation adaptative n'est pas empilée ici afin d'éviter de reproduire ses régressions.

NOUVEAUTÉS / CORRECTIONS V28
- Ding-dong ARRÊT DEMANDÉ fiabilisé : élément audio média local + secours Web Audio.
- Bouton « Recaler poteau » disponible dans le cockpit paysage.
- Bouton « Arrêts / destination ON/OFF » en portrait ET paysage.
  Il coupe seulement les annonces voyageurs automatiques :
  * départ / ligne-destination ;
  * rappel ligne-destination à mi-parcours ;
  * prochain arrêt ;
  * arrivée à l'arrêt / terminus.
  Les annonces manuelles et outils conducteur restent disponibles.
- Prochain arrêt terminus : message automatique enrichi avant l'arrivée :
  « Prochain arrêt, [nom], terminus de la ligne. Avant de descendre, pensez à vérifier que vous n'avez rien oublié à bord. Merci d'avoir voyagé avec nous et à bientôt. »
- Bibliothèque d'annonces : toucher une annonce lance immédiatement la diffusion.
- Mes annonces personnalisées : titre + texte, sauvegarde locale persistante, diffusion par simple toucher, suppression individuelle.

CONSERVÉ DE V26 ET VERSIONS PRÉCÉDENTES
- Mes TAD préparés par date.
- Journaux.
- Fiches horaires.
- Création de lignes personnalisées / exceptionnelles.
- Navigation existante stable, GPS, simulation, TAD dynamique, annonces, demandes clients.

NON RÉINTÉGRÉ VOLONTAIREMENT DE V27
- recalcul automatique d'itinéraire hors tracé ;
- auto-détection agressive d'arrêt raté ;
- animation GPS expérimentale ;
- double tracé journal prévu/réel de V27 ;
- aperçu cartographique expérimental de V27.
Ces fonctions devront être reprises séparément et testées sans casser la base.

FICHIERS À REMPLACER DANS GITHUB
- index.html
- app.js
- sw.js
- manifest.webmanifest
- build_gtfs.py (inchangé fonctionnellement depuis V26 mais fourni pour garder un paquet cohérent)

Garder la V26 et la V27 sur l'ordinateur comme versions de secours.
