FLUO SAEIV V28.1 — ERGONOMIE TACTILE

Base : V28 stable. Aucun changement du moteur métier.

Correctifs :
- suppression du petit son parasite (« tung ») produit par l’amorçage audio ;
- le ding-dong arrêt demandé reste armé au moment de la sélection d’une demande, mais l’amorçage est totalement muet ;
- retour haptique court sur les boutons quand le navigateur/téléphone le permet ;
- en paysage, les commandes conducteur sont regroupées dans un dock fixe qui reste visible même quand ARRÊT DEMANDÉ apparaît ;
- le bouton Recaler poteau reste donc toujours accessible.

NOTE HAPTIQUE : Chrome/Android prend en charge navigator.vibrate. Safari/iOS ne fournit pas officiellement cette API ; un secours WebKit best-effort est tenté, sans garantie sur iPhone.

Fichiers à remplacer dans GitHub :
- index.html
- app.js
- sw.js
- manifest.webmanifest

build_gtfs.py est inclus inchangé et n’a pas besoin d’être remplacé si la V28 est déjà installée.
