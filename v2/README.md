# Mon SAEIV 2.0 — Prototype 0.1

**Statut : maquette fonctionnelle locale, non prête pour un service commercial.**

Cette version vit dans le répertoire v2/ de la branche \`saeiv-2-0-prototype\` et ne remplace ni Mon SAEIV 1.x ni la page de secours.

## Lancement
- Pour une prévisualisation locale, ouvrir \`v2/index.html\` dans un navigateur moderne.
- Aucune dépendance à installer : HTML/CSS/JavaScript natifs.
- Les données de démonstration sont fictives ; les modifications ne sont enregistrées que dans le stockage local de ce navigateur.
- Le bouton Conducteur / Exploitation change seulement l'interface : **ce n'est pas un mécanisme d'authentification**.

## Déjà implémenté en 0.1
1. Présentation responsive (PC, iPhone, Android), menu conducteur et exploitation.
2. Espace conducteur : parcours simulés, arrêt précédent/suivant, recalage, annonce sous forme de texte à générer côté serveur, thermomètre des arrêts et horaires.
3. Caisse de démonstration : montées, descentes, compteur à bord et saisie fictive d'une vente. Aucun billet réel, paiement ni encaissement.
4. TAD : sélection locale des demandes de desserte pour une course fictive.
5. Incidents : notes locales sans transmission à l'exploitation.
6. Exploitation : vue **tous conducteurs / une journée**, activités multiples par conducteur (courses de plusieurs lignes, HLP, coupures, autres services), ajout au brouillon, CSV et impression navigateur.
7. Semainier : affichage conducteur par conducteur des sept jours de la semaine courante (données fictives).
8. Premiers avertissements sur chevauchements et amplitudes ; **ne vaut pas contrôle RSE**.
9. Emplacement pour gestion des véhicules, comptes et paramètres.

## Ce qui N'EST PAS implémenté
- Authentification, rôles réellement protégés, API, base de données et synchronisation multi-appareils.
- GPS, carte, map-matching, horaires GTFS exacts, annonces automatiques, restitution audio serveur.
- Paiements, émission de titres, TAD opérationnel, transmission d'incidents.
- Vérification complète du temps de travail, amplitudes réglementaires, repos, délais, pauses, coupures, roulements sur plusieurs jours et services franchissant minuit.
- Publication opérationnelle des plannings et notifications conducteurs.

**Ne pas saisir de données personnelles ou sensibles dans cette maquette :** elle est destinée uniquement aux essais visuels et fonctionnels. **Ne pas utiliser l'interface en conduisant.**

## Architecture cible (à construire et valider)
- **Frontend PWA** conducteur et exploitation : GitHub sert de dépôt source, une publication peut être assurée par un hébergeur statique HTTPS.
- **Serveur autonome Ubuntu** : API sécurisée, contrôles d'accès, gestion des sessions, base de données PostgreSQL ou équivalent, sauvegardes automatiques et journaux. Aucune dépendance obligatoire à Supabase.
- **Données transport** : ingestion et versionnement GTFS officiels 54/57 ; courses exactes \`trip_id\`, arrêt, variante, tracés et exceptions calendaires. Vérifier les conditions de licence et la fraîcheur.
- **SAEIV conducteur** : synchronisation service, cache hors ligne, GPS/map-matching, régulation, billet collectif et titres, gestion TAD et remontées d'incidents.
- **Voix unique** : synthèse des annonces **sur le serveur**, cache des fichiers audio, identiques sur Android et iOS, diffusion côté client.
- **Exploitation** : périodes et segments d'activités, affectations conducteur/véhicule, journées multi-lignes, HLP, pauses, coupures, absences, semainier et planning global.
- **Moteur RSE configurable** : isoler règles, sources, durées de repos et exceptions par activité, convention et régime applicable. Les journées de 14 h évoquées dans le cahier des charges doivent être **vérifiées au regard des textes applicables**, pas autorisées systématiquement.
- **Publication** : statuts brouillon → contrôle → validation → publication avec historique, auteurs, dates et diffusions.

## Prochain incrément
1. Définir le modèle de données \`Driver\`, \`Vehicle\`, \`Duty\`, \`Activity\`, \`Trip\`, \`Stop\`, \`StopRequest\`, \`Ticket\`, \`Incident\`, \`Publication\`.
2. Concevoir un vrai planning par segments (y compris minuit) et un moteur de validations testable séparément.
3. Installer une API de test isolée, **sans modifier la VM radio en production**, et intégrer un véritable mécanisme d'authentification.
4. Préparer l'import GTFS et la génération d'annonces audio serveur.
5. Tester l'affichage et les parcours sur PC, Android et iPhone avec des jeux de données fictifs.

### Règles de sécurité et de déploiement
- Branche distincte ; pas de changement de \`main\` sans validation.
- Ne pas remplacer ou casser \`index.html\`, \`secours.html\`, les workflows actuels ou la radio.
- N'exposer aucun secret, jeton, mot de passe, coordonnées GPS privées ou fichier de données personnelles dans le dépôt public.
- Publication et migration serveur uniquement après essais et accord explicite.
