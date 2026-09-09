# Mon SAEIV — backend exploitation / multi-appareils

Ce dossier prépare l'évolution du SAEIV actuel vers une architecture partagée entre conducteurs et exploitation, sans casser le fonctionnement local/PWA existant.

## Objectif

Une seule plateforme, avec trois rôles :

- **Conducteur** : voit son compte, son propre planning et ses préférences.
- **Exploitation** (`dispatcher`) : voit **tous les conducteurs actifs de sa société**, peut rechercher par nom/matricule, construire et modifier leurs plannings et recalculer les HLP.
- **Administrateur** : mêmes droits que l'exploitation + gestion des comptes, rôles, dépôts et rattachements à la société.

Le cloisonnement est fait côté serveur par `organization_id`. Un exploitant d'une société A ne peut pas lire les conducteurs de la société B.

## Multi-appareils

Le serveur devient la source synchronisée des données partagées. Le SAEIV conducteur conservera néanmoins une copie locale pour continuer à fonctionner en cas de perte de réseau.

Flux prévu :

1. connexion du conducteur ;
2. récupération de son profil (`société`, `matricule`, `rôle`, `dépôt`) ;
3. récupération du planning du jour et des jours suivants ;
4. stockage local de secours ;
5. écoute Realtime des changements du planning ;
6. resynchronisation des modifications locales autorisées dès que la connexion revient.

Les versions (`revision`) et `updated_at` empêchent un ancien téléphone d'écraser silencieusement une modification plus récente.

## Planning exploitation

L'exploitation construit d'abord les activités réellement imposées : courses régulières/scolaires, TAD, prises/fin de service, coupures, annexes, etc.

Après toute modification d'une journée, l'interface exploitation appelle l'Edge Function :

`rebuild-driver-day`

Cette fonction :

- supprime uniquement les anciens HLP générés automatiquement ;
- trie les activités de la journée ;
- compare la destination de l'activité précédente avec le départ de la suivante ;
- si les lieux sont différents, calcule un itinéraire routier ;
- insère automatiquement le HLP ;
- **n'ajoute aucune marge** ;
- si le HLP ne rentre pas entre les deux activités, marque l'élément `conflict` et calcule les minutes manquantes.

Exemple :

- arrivée course A : 09:12 à Château-Salins ;
- départ course B : 10:05 à Morhange ;
- itinéraire HLP : 27 min ;
- HLP généré : 09:38 → 10:05.

Si la course A termine à 09:50, le HLP reste calculé 09:38 → 10:05 mais le planning remonte un conflit de **12 min**.

## Dernière position utilisée

Pour la préparation du planning par l'exploitation, la « dernière position » est d'abord la **destination planifiée de l'activité précédente**, et non le GPS réel du téléphone. C'est ce qui permet de préparer les services la veille ou plusieurs jours à l'avance.

Le GPS réel pourra plus tard servir uniquement à recalculer une mise en place imprévue pendant la journée.

## Authentification par société + matricule

L'écran conducteur pourra rester simple :

- code société ;
- matricule ;
- mot de passe.

Le rôle affiché dans l'application n'est jamais une autorisation locale : le serveur renvoie le rôle réel du compte et les politiques RLS contrôlent chaque requête.

Un compte `dispatcher` voit automatiquement tous les profils `driver` dont `organization_id` est identique au sien.

## Fichiers

- `supabase/001_schema.sql` : sociétés, dépôts, profils, rôles, préférences, plannings, politiques de sécurité RLS et Realtime.
- `supabase/functions/rebuild-driver-day/index.ts` : génération/recalcul automatique des HLP et détection de conflits.

## Étape d'activation

Ces fichiers sont volontairement inertes tant qu'un projet Supabase n'est pas connecté. Aucun secret, aucune clé serveur et aucun mot de passe ne doivent être ajoutés au dépôt GitHub public.

Lors de l'activation :

1. créer/connecter le projet Supabase ;
2. appliquer `001_schema.sql` ;
3. déployer `rebuild-driver-day` ;
4. configurer les variables serveur (`SUPABASE_URL`, clés Supabase et éventuellement `ROUTING_BASE_URL`) dans les secrets Supabase, jamais dans GitHub Pages ;
5. raccorder l'écran de connexion et le planning du SAEIV au client Supabase ;
6. ajouter l'espace Exploitation et l'espace Administration.
