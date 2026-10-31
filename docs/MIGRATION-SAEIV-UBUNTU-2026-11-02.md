# Préparation de migration MonSAEIV vers Ubuntu — 2 novembre 2026

**État : préparation uniquement. Aucune bascule ni suppression effectuée.**

## Objectif
Rendre MonSAEIV indépendant de Supabase, avec l'interface conducteur et exploitation utilisable sur les téléphones/ordinateurs, sans perturber Manu Stream Radio. L'interface statique peut rester sur GitHub Pages dans un premier temps ; la base de données, l'authentification, la synchronisation et les API passent sur Ubuntu.

## Sources vérifiées le 31 octobre
- Dépôt public : `cauctomanu-dotcom/Fluo-SAEIV`, branche de production `main`.
- Application actuelle : PWA en HTML/JavaScript avec Service Worker ; nombreux modules `vXXX-*.js`. Le Service Worker annonce `1.0.120`.
- Connexion : `login-gateway.js` avec authentification Supabase et fonction `login-driver` ; un mode local conducteur et export du profil existent déjà.
- Synchronisation : `v156-supabase-sync.js`, `v162-full-account-sync.js`, `v163-exploitation-planner.js`, `v180-dispatch-messages.js` notamment.
- Voix : `v204-unified-speech.js` dépend de `passenger-tts` sur Supabase, avec une solution de repli locale.
- Supabase contient notamment des profils, des journées de planning, des journaux, des messages et des données radio ; 10 fonctions Edge actives (dont 9 liées à SAEIV et `station-logo` liée à la radio, à confirmer une par une).
- Attention : `login-gateway.js` redirige vers `app.html`, mais `app.html` n'a pas été retrouvé par lecture directe à la racine de `main`. Vérifier le mode de génération/déploiement de cette page avant toute bascule.
- La VM Ubuntu Freebox est ARM64, initialement 1 vCPU / 1 Gio de RAM, IP LAN `192.168.1.11`. Icecast et la radio viennent d'être rétablis sur le disque de 2 To. Une vérification de capacité est indispensable avant d'installer un SGBD et une API.

## Interdictions avant bascule validée
1. **Ne pas arrêter ni modifier Icecast, Caddy, la VM ou le fichier RAW de la radio.**
2. Ne pas supprimer, mettre en pause ou nettoyer le projet Supabase complet : il est partagé avec la radio et conserve les comptes/données SAEIV.
3. Ne pas publier de mot de passe, secret, jeton, dump de base ou fichiers de profils dans ce dépôt **public**.
4. Ne pas modifier `main` ni les liens de radio et leurs QR codes. Utiliser la présente branche de préparation.
5. Ne pas envoyer des données privées de planning ou d'utilisateurs vers une interface publique sans authentification et contrôle de rôles.

## Ordre de reprise — pas à pas

### 1 — Contrôle non destructif du serveur (5–10 minutes)
Depuis Windows : `ssh manu@192.168.1.11`.
Sur Ubuntu : exécuter `bash scripts/saeiv-preflight.sh` après avoir récupéré ce script de la branche de préparation.
Vérifier RAM disponible, espace disque, architecture ARM64, services actifs et ports occupés. Confirmer Icecast par `curl -fsS http://127.0.0.1:8000/status-json.xsl` et écouter la radio hors Wi-Fi. N'effectuer **aucune** installation si mémoire trop faible.

### 2 — Sauvegardes de référence hors de GitHub
Créer un dump **complet et chiffré** des schémas nécessaires, de la configuration et des fonctions Edge avant modification (outil Supabase CLI ou `pg_dump` avec chaîne de connexion obtenue depuis le tableau de bord). Inclure `auth`, `public` et dépendances nécessaires, plus les objets Storage séparément. Conserver le fichier en lieu privé avec droits restreints ; vérifier qu'il est restaurable.
Le dépôt étant public, **ne jamais y déposer la sauvegarde ni des identifiants**.
Faire un relevé des données par table et des comptes, et séparer les ressources SAEIV de celles de la radio.

### 3 — Isoler la nouvelle application
Créer un service dédié `saeiv-api`, avec son propre utilisateur Linux, son dossier, ses permissions, sa base et ses journaux. Le service doit écouter uniquement `127.0.0.1` sur un port libre, et jamais sur 8000/80/443 (déjà utilisés pour la radio/proxy). Tester sur un environnement d'essai isolé. Si nécessaire augmenter les ressources de la VM **hors antenne**, après sauvegarde et préparation d'un retour arrière.
Ajouter un routage HTTPS dédié dans Caddy après lecture de sa configuration existante. Préserver explicitement tous les chemins radio. Contrôler CORS et accès depuis l'URL GitHub Pages de l'application.

### 4 — Remplacer les fonctions Supabase
À réaliser dans la branche de migration, pas sur `main` :
- Authentification : matricule/mot de passe, rôles conducteur/exploitant/admin, invitation, désactivation et récupération de compte. Mots de passe hachés par algorithme adapté ; sessions courtes ; pas de secret dans le navigateur.
- API métier : profils, plannings, jours publiés, compétences, dépôts, messages et accusés, tickets, réglages et synchronisation.
- Journaux : gros historique à migrer en lots avec pagination et transactions ; vérifier les volumes avant import.
- Reprendre et tester les fonctions Edge SAEIV (reconstruction journées, ajustement segments, compte/invitations, `passenger-tts`). La voix serveur unifiée sur Android/iPhone est une phase supplémentaire à tester ; préserver le repli vocal local pendant la transition.
- Refaire les appels `supabase-js` dans le frontal pour l'API maison ; ne pas détourner les anciennes URL pour un faux serveur Supabase incomplet.

### 5 — Recette obligatoire avant bascule
Tester au minimum :
- connexion / déconnexion de chacun des trois rôles, restrictions d'accès ;
- sélection d'une ligne 54/57 et course GTFS exacte, GPS, horaires, annonces, mode TAD, hors connexion ;
- création/modification/publication d'un planning exploitant puis réception conducteur ;
- synchronisation et données existantes sur deux appareils ;
- contrôle de charge : Icecast reçoit son flux pendant toutes les opérations et reste joignable depuis la 5G ;
- sauvegarde automatique, restauration et redémarrage du nouveau service ;
- vérification de l'URL HTTPS et du comportement des caches/PWA.

### 6 — Bascule et retour arrière
Après validation seulement, mettre à jour le frontal sur une version identifiée, purger les anciens caches PWA avec nouvelle version de Service Worker, confirmer les comptes et plannings, puis désactiver les *dépendances SAEIV* à Supabase. Garder le Supabase original en lecture seule / intact le temps de confirmer l'absence de dépendances de la radio. En cas d'échec, repointer le frontal vers le service actuel : ne jamais altérer la radio pour rétablir SAEIV.

## Priorité de livraison lundi 2 novembre
Le premier objectif réaliste est **une instance pilote indépendante pour le conducteur**, avec une petite base locale et les parcours indispensables, puis la migration exploitation et l'historique complet. Le passage intégral en production lundi **n'est pas garanti** avant inspection du serveur et tests. La bascule n'est déclarée réussie que si les fonctions utiles marchent sans connexion Supabase.

## État de cette branche
Elle contient une procédure et un script de contrôle **sans effet de bord**. Aucun backend n'a encore été installé ni testé sur la VM. Le code de production est inchangé.
