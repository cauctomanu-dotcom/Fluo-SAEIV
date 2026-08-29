# Mon SAEIV 1.0.28

Déploiement du 29 août 2026.

- Radio : tampon plus tolérant, priorité aux flux légers et protection contre les reconnexions en boucle.
- GPS : projection visuelle du pictogramme sur le tracé avec interpolation continue et retour au GPS brut en cas d'écart réel.
- Hors connexion : la course, le GPS, les arrêts et les annonces restent locaux ; sauvegarde régulière de la course active et proposition de reprise après rechargement de la PWA.
- PWA : cache 1.0.28 et conservation des ressources cartographiques déjà consultées lorsque possible.

Le service worker 1.0.28 applique ces correctifs aux installations existantes, y compris lorsqu'un ancien index.html 1.0.26 est encore présent dans le cache navigateur.
