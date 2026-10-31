# Mon SAEIV 2.0 — nouveau projet

**Nouveau départ : la version 2.0 ne réutilise pas l'architecture ni l'ergonomie de V1.**

- [Cahier des charges initial](docs/CAHIER_DES_CHARGES.md)
- Branche de conception : `design/mon-saeiv-2-0`.
- La branche `main` conserve la V1 sans modification.
- Mon SAEIV 2.0 doit être multi-entreprises, personnalisable et autonome de Supabase.
- Les entreprises créent leur espace et leurs collaborateurs ; **aucune auto-inscription de conducteur libre**.
- Le planning est reconçu autour de **Créer/Importer → Affecter → Vérifier → Publier**, sans génération opaque.
- Toutes les fonctions métier V1 (SAEIV GPS, GTFS, annonces, TAD, caisse, comptage, journaux, exploitation, incidents, communications, offline) doivent être reprises et validées.
- Les droits et la séparation entre entreprises doivent être exécutés et vérifiés **côté serveur**.

**État : spécification fonctionnelle en cours.** Un prototype local de navigation a été produit séparément pour discussion. Aucune application prête à la production, aucun déploiement ou transfert de données.

⚠️ **Ne pas déployer sur la VM radio ni supprimer Supabase à ce stade.** L'ancienne infrastructure radio vient d'être rétablie, et le projet Supabase actuel contient également des ressources radio.
