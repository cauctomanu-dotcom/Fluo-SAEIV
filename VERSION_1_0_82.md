# Mon SAEIV 1.0.82 — supervision exploitation temps réel

Cette version complète le suivi voyageurs de la 1.0.81 avec un écran de supervision réservé aux comptes Exploitant et Administrateur.

## Supervision réseau

Depuis l’espace exploitation, le bouton **Supervision temps réel** ouvre une grande carte plein écran. Tous les véhicules actifs de la société sont affichés à partir du même flux GPS que l’information voyageurs, sans seconde géolocalisation.

Chaque véhicule affiche sa ligne, sa destination, sa phase (haut-le-pied, attente au départ ou service), son avance/retard et l’ancienneté de sa position. Le haut-le-pied fait donc partie de la surveillance avant même le premier départ commercial.

L’écran comprend :

- carte de tous les véhicules actifs ;
- actualisation automatique toutes les 5 secondes ;
- compteurs véhicules / à l’heure / retard / avance / HLP / GPS ancien ;
- recherche conducteur, ligne ou destination ;
- filtres par ligne et par état ;
- liste triée pour faire remonter les anomalies ;
- clic sur un véhicule pour le centrer et afficher ses détails ;
- signalement explicite des positions anciennes au lieu de les présenter comme actuelles.

## Sécurité

La nouvelle politique RLS `management_org_live_read` autorise uniquement un compte actif Exploitant ou Administrateur à lire les positions de **sa propre organisation** via `private.is_exploitation_for(organization_id)`. Les règles d’écriture conducteur et l’accès public voyageurs ne sont pas élargis.

La table conserve toujours une seule position courante par conducteur et non un historique public.

## Déploiement

Le module `v183-live-supervision.js` est injecté dans l’application par le workflow Pages. Le cache et les ressources déployées sont estampillés `1.0.82`.
