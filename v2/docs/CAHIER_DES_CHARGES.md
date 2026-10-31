# Mon SAEIV 2.0 — Cahier des charges initial (31 octobre 2026)

> **Nouvelle application, pas une migration visuelle de V1.** Ce document est le point de départ de conception. Il ne déclenche aucun déploiement ni changement de la radio, de GitHub Pages V1 ou de Supabase.

## Vision et principes

Une plateforme SaaS auto-hébergée dans laquelle **chaque entreprise de transport crée son propre espace**, invite et gère elle-même ses collaborateurs, définit ses réseaux, dépôts, lignes, règles et identité visuelle. Le conducteur dispose d'un cockpit SAEIV fiable ; l'exploitation dispose d'un planning **simple, guidé, déterministe et explicable**.

- Interface claire, blanc dominant, lisible, ergonomique sur téléphone/tablette/ordinateur, gros boutons, clavier et lecteur d'écran.
- **Toutes les fonctions métier de l'ancienne version doivent être inventoriées puis reprises**, sans recopier les problèmes d'ergonomie.
- Une action importante ne doit jamais exiger un second choix réseau/département ni réinitialiser le formulaire.
- Même moteur de voix sur Android/iPhone depuis le serveur : génération dynamique d'annonces et cache audio, repli local hors connexion.
- La radio continue à fonctionner indépendamment de Mon SAEIV 2.0.

## Comptes et entreprises

### Création initiale

1. Page « Créer mon entreprise » indépendante du mode conducteur.
2. Société : nom, pays, réseau(x), dépôts, marque/logo/couleur, paramètres, fuseau horaire et règles métier. Pour l'immatriculation (SIRET, RCS, Luxembourg), prévoir champs adaptés selon pays, sans imposer un seul système.
3. Vérification de l'adresse de l'administrateur et protections contre inscriptions abusives.
4. Création de l'administrateur d'entreprise, qui peut gérer **uniquement sa société**.
5. L'administrateur ajoute conducteurs (matricule, nom, réseau, dépôt, qualifications, statut), agents de planning, autres administrateurs, puis leur envoie une invitation. **Aucun conducteur ne s'auto-inscrit dans une entreprise sans invitation.**
6. Le service conserve historique de modification et invitations désactivables/expirables.

### Rôles distincts
| Rôle | Accès principal |
| --- | --- |
| Administrateur entreprise | Entreprise, identité, dépôts/réseaux, comptes, permissions, règles, audits |
| Agent de planning / exploitation | Calendrier, services, affectations, conducteurs, alertes, publication, messages, impressions |
| Conducteur | SAEIV, service et horaires publiés, messages, disponibilité, journal, caisse, annonces |
| Administrateur plateforme (interne) | Gestion technique et statut des sociétés ; pas d'accès libre aux données sensibles |

**Sécurité impérative** : contrôle des droits **côté serveur**, données isolées par identifiant d'entreprise `company_id` partout (requêtes, fichiers, journaux, WebSocket), mots de passe hachés, cookies/sessions protégées, audit des actions et limitation du taux de tentatives.

## Navigation recommandée

### Entreprise / exploitation
- **Aujourd'hui** : tâches, départs, anomalies, messages.
- **Planning** : vue Aujourd'hui / Jour / Semaine / Conducteur ; services affectés/non affectés.
- **Équipe** : conducteurs, qualifications, affectations, absences, repos.
- **Lignes & services** : GTFS, parcours, services types, courses, secteurs TAD, HLP, coupures.
- **Communication** : messages, incidents, accusés de lecture, demandes de modification.
- **Billetterie & journaux** : caisse, titres collectifs, montées/descentes, exports.
- **Paramètres entreprise** : réseau, dépôt, charte graphique, modèles d'annonces, règles, comptes.

### Conducteur
- **Mon service** (feuille de service, enchaînement de courses, coupures, HLP).
- **SAEIV** (GPS, régulation, arrêt précédent/suivant, annonces, arrêt demandé, recalage, fin de service, carte).
- **Voyageurs** (TAD, comptage montée/descente, caisse/titres).
- **Messages & incidents**.
- **Mes documents/journaux**.

## Planning 2.0 — refonte complète

### Objectif UX
**Importer / Créer → Affecter → Vérifier → Publier.**

- Un tableau de bord indique en un coup d'œil : services à affecter, chevauchements, absences, services publiés, problèmes bloquants.
- La grille évite les colonnes denses : privilégier cartes de services avec début, fin, dépôt, lignes, HLP, coupures, conducteur.
- Affichage jour/semaine et filtre dépôt, réseau, ligne, conducteur ; recherche rapide.
- Colonne « Services non affectés », avec sélection guidée des conducteurs autorisés/disponibles.
- Affectation par clic **et** glisser-déposer, avec fonctionnement clavier/tactile.
- Modèle de service réutilisable ; copie journée/semaine, modifications par lot et annulation/retour arrière.
- Import GTFS et horaires ; possibilité de fabriquer des services en reliant des courses et trajets HLP.
- Calcul **explicite** du temps de conduite, temps de travail, coupures, amplitude, repos, prises et fins de service.
- Contrôle : chevauchements, indisponibilités, compétences ligne/dépôt/véhicule, repos quotidien, pauses, limites réglementaires/configurables. Les limites exactes doivent être établies pour chaque contexte de transport avant de bloquer la publication.
- Les outils d'aide peuvent **proposer** une affectation ; aucune IA ne publie, invente ou modifie les services toute seule.
- Publication en version datée, notification conducteur, impression/PDF, journal des changements, possibilité de corriger/réaffecter proprement après publication.
- Gestion des congés, maladies, imprévus, remplacement des conducteurs, changements de service et communication exploitation.

## Reprise fonctionnelle de V1 — inventaire à vérifier fichier par fichier

| Domaine | Fonctions à conserver |
| --- | --- |
| Navigation / SAEIV | GTFS 54/57/67/68 et réseaux supplémentaires, choix course exacte, GPS, map matching, régulation, avance/retard, horaires, carte, formation, simulation |
| Arrêts & annonces | Prochain arrêt, arrêt, terminus, rappel ligne/destination, annonces de sécurité, phonétique, chime, commandes, Bluetooth, voix unifiée |
| Conducteur | Prise/fin de service, feuille de route, HLP, coupures, compte conducteur, historique, application PWA, mode hors-ligne |
| Voyageurs | TAD, sélection arrêts à desservir, demandes d'arrêt, montée/descente, comptage, historique |
| Caisse | Titres, tarifs propres à chaque société, billetterie, titres collectifs, bilan et impressions |
| Exploitation | Planning et moteur de génération, affectations, horaires, dépôts, véhicules, qualifications, repos, absences, remplacements, modifications |
| Communication | Messages exploitation, incidents, accusés, notifications, demandes conducteur |
| Administration | Entreprise, comptes, rôles, droits, profils, audits, exports |
| Technique | Synchronisation multi-appareils, sauvegardes, récupération, journaux, offline, audio, sécurité, hébergement autonome |

Les modules anciens à auditer comprennent notamment `login-gateway.js`, `v156-supabase-sync.js`, `v162-full-account-sync.js`, `v163-exploitation-planner.js`, `v180-dispatch-messages.js`, `v186-enterprise-admin.js` à `v203-exploitation-print.js`, `v204-unified-speech.js`, `index.html`, et les fichiers de données GTFS.

## Architecture proposée (à valider après pré-vol serveur)

- Frontend **PWA autonome**, interface React/TypeScript ou équivalent modulaire, composants réutilisables, pas un fichier HTML massif.
- Backend d'API indépendant de Supabase, avec validation serveur et permissions multi-entreprises systématiques.
- Base : **SQLite WAL possible uniquement pour le pilote et faible concurrence**, avec sauvegardes cohérentes ; prévoir PostgreSQL pour un usage multi-entreprises ou concurrent plus large. Choix final après test des besoins et ressources.
- WebSocket/SSE pour les publications, messages, notifications, ou synchronisation par intervalle avec file d'attente hors-ligne.
- Stockage privé pour exports et fichiers par société, journaux de sécurité, sauvegarde automatique et procédure de restauration documentée.
- Service isolé de la radio ; aucun changement de `/manustream`, Icecast, Caddy ou URL radio sans lecture de configuration et test préalable.
- **Attention VM actuelle : 1 vCPU / 1 Go de RAM**, hébergeant la radio. Dimensionnement ou séparation des services avant hébergement multi-entreprises.

## Plan de livraison par phases

1. **Conception** : parcours entreprise + rôles + maquette responsive + validation UX du planning.
2. **Socle** : API, base, inscription société, authentification, invitations, dépôts/réseaux, sécurité.
3. **Planning pilote** : services et affectations manuelles, contrôles, publication conducteur.
4. **Cockpit conducteur** : GTFS, GPS, TAD, annonces, caisse, service, mode hors ligne.
5. **Compléments V1** : toutes les fonctions de gestion, journaux, statistiques, impression, secours, voix serveur.
6. **Migration contrôlée** : exporter et restaurer les seules données SAEIV utiles ; Supabase original ne sera pas supprimé tant que sa partie radio en dépend.
7. **Recette** : PC/Android/iOS, permissions entre entreprises, volume de données, charge serveur et contrôle radio 5G.

**Objectif de lundi 2 novembre : une base technique et un pilote testable si les ressources serveur et le temps le permettent. L'application complète ne peut pas être promise sans tests et développement significatif.**

## État actuel
Cahier des charges initial et prototype de navigation local, **sans backend, sans connexion réelle, sans déploiement**. Les contenus et noms d'entreprises de la maquette sont fictifs. La version 1.0 de production n'est pas modifiée.
