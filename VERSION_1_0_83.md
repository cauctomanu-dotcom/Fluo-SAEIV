# Mon SAEIV 1.0.83 — navigation, reprise de course et séparation voyageurs

Cette version corrective traite les retours terrain de la 1.0.82 sans retirer les fonctions HLP, voyageurs et supervision déjà en place.

## Navigation et recalcul

- la détection de sortie de parcours utilise désormais la position GPS brute au lieu d'une position déjà recollée au tracé ;
- une sortie persistante déclenche un vrai itinéraire routier vers un point de reprise situé plus loin sur la course ;
- pendant le recalcul, le véhicule n'est plus artificiellement collé au tracé officiel ;
- une nouvelle sortie du parcours recalculé provoque un nouveau calcul ;
- la reprise du tracé officiel est détectée automatiquement ;
- les consignes droite/gauche, ronds-points, bifurcations et bretelles sont issues des étapes routières ;
- la distance avant la manœuvre est calculée le long de l'itinéraire et non à vol d'oiseau ;
- les seuils d'annonce vocale s'adaptent à la vitesse ;
- l'ancien guidage vocal est maintenu silencieux afin d'éviter deux consignes contradictoires. Le bouton GPS vocal/GPS muet continue de commander le nouveau guidage.

## Annonces vocales

Le moteur vocal est réveillé lors des interactions, du retour au premier plan et des changements de voix disponibles. Un contrôle de santé relance une annonce locale restée bloquée et réinjecte les annonces encore valides dans la file.

## Reprise de la dernière course

Pendant une course GPS, Mon SAEIV sauvegarde régulièrement :

- la ligne et la course exacte ;
- la date de service ;
- l'arrêt courant et le prochain arrêt ;
- les arrêts demandés ;
- les arrêts TAD sélectionnés ;
- l'état de départ de la course.

Après une fermeture ou un redémarrage, le bouton **Reprendre la dernière course** reconstruit cette course et restaure les demandes encore à desservir.

## Exploitation

Pour un compte Exploitant ou Administrateur déjà identifié, l'interface conducteur est masquée avant affichage puis l'espace de gestion est ouvert directement. Le conducteur ne doit plus apparaître brièvement pendant le chargement.

## Supervision temps réel

La position partagée utilise la position visuelle recollée au tracé lorsqu'elle est fiable. La supervision affiche un petit **🚌** centré exactement sur cette coordonnée. En situation de déviation/recalcul, la position redevient libre afin de montrer où se trouve réellement le véhicule.

## Information voyageurs séparée

L'entrée voyageurs est retirée du sas Mon SAEIV et la page publique ne comporte plus de lien vers l'espace conducteur. Le déploiement crée une adresse publique dédiée sous `/voyageurs/`, tout en conservant les mêmes données horaires et temps réel côté serveur.
