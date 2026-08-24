FLUO SAEIV V19 — SMARTPHONE + NOUVEAU CROSSWAY + TRI LIGNES + AUDIO

NOUVEAUTÉS
- Utilise directement le nouveau Crossway Fluo Grand Est fourni (avant de l’image source à gauche, automatiquement orienté vers le nord pour le GPS).
- Marqueur encore réduit : environ 14 x 40 px en cockpit paysage et 16 x 46 px dans les autres vues.
- Moselle 57 : les lignes 57R… sont classées régulières ; codes multi-lettres/S… classés scolaires.
- Meurthe-et-Moselle 54 : R… / numéros usuels classés réguliers ; S… et codes scolaires classés scolaires.
- « Toutes les lignes » conserve l’accès aux codes atypiques/non classés.
- Même logique dans Calcul horaires.
- Correction smartphone portrait/paysage : largeur verrouillée au viewport, contrôles >=16 px pour éviter le zoom iOS, recalage des cartes après rotation et changements du visual viewport.
- Amorçage Web Audio sur la sortie média active pour améliorer le comportement avec un haut-parleur Bluetooth.

LIMITE iPHONE IMPORTANTE
Une PWA Safari ne peut pas forcer AVAudioSession, choisir arbitrairement la sortie Bluetooth ni imposer le ducking de Spotify/Apple Music comme une app iOS native. Les annonces restent à volume maximal dans la PWA et V19 amorce la sortie média active, mais iOS garde la décision finale de routage/mixage.

INSTALLATION GITHUB
Remplacer à la racine : index.html, sw.js, manifest.webmanifest.
Commit changes sur main, attendre build + deploy en vert, fermer complètement la PWA puis la rouvrir.
