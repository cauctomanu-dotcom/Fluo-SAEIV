FLUO SAEIV V23.2 — CORRECTION CALCUL HORAIRES

Correction ciblée : le bouton « Calcul horaires » ne doit plus bloquer l’application.

Cause corrigée : le mécanisme V23.1 ajoutait un second système d’ouverture + un MutationObserver sur la classe du panneau. Sur certains navigateurs mobiles (notamment Safari/iOS), le fond modal pouvait rester actif et intercepter tous les touchers.

V23.2 :
- un seul gestionnaire d’ouverture/fermeture du calculateur ;
- suppression complète du MutationObserver du calculateur ;
- fenêtre du calculateur au-dessus du cockpit avec mise en page stable ;
- fermeture par bouton, toucher sur le fond et Échap sur ordinateur ;
- aucun focus forcé sur iPhone/Android ;
- reprise automatique du département déjà choisi ;
- journaux V23.1 conservés sans modification ;
- GPS, TAD, suivi Crossway, annonces et ding-dong inchangés.

À remplacer dans GitHub : index.html, app.js, sw.js, manifest.webmanifest.
