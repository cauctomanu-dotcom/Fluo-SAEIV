FLUO SAEIV V17 — CROSSWAY FLUO RÉEL

NOUVEAUTÉ V17
- Le marqueur véhicule utilise directement l'image Iveco Crossway Fluo Grand Est fournie par l'utilisateur.
- Aucun redessin : l'image est uniquement recadrée, tournée et réduite pour rester fluide sur smartphone.
- L'avant de l'image originale est à gauche ; l'asset intégré est tourné pour que l'avant pointe vers le haut à cap 0°.
- Le bus conserve ses vraies proportions : plus long et fin que l'ancien pictogramme.
- En vue NORD, il pivote avec le cap du véhicule. En vues 3D et SENS, la caméra tourne avec le véhicule et le bus reste orienté vers le haut de l'écran.
- Toutes les fonctions de V16 sont conservées. Aucun serveur/Supabase n'est ajouté.

INSTALLATION GITHUB
Remplacer à la racine du dépôt : index.html, sw.js, manifest.webmanifest.
Commit changes sur main, attendre build + deploy en vert, puis fermer complètement la PWA et la rouvrir.

NOTE TECHNIQUE
L'image du bus est intégrée directement dans index.html sous forme d'image PNG optimisée (data URI). Il n'y a donc aucun fichier image supplémentaire à publier et le workflow GitHub actuel n'a pas besoin d'être modifié.
