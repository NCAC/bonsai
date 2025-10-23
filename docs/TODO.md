## Créer un script TypeScript (ou ESLint custom) pour vérifier et corriger automatiquement les règles de style du projet définies dans CODING_STYLE.md :

- Ordre des imports (Node.js, externes, internes, relatifs)
- Interdiction des imports relatifs pour les modules internes, forcer l'utilisation des alias (`@build/...`)
- Utilisation obligatoire de `fs-extra` au lieu de `node:fs`
- (Optionnel) Vérification du nommage des fichiers, présence de JSDoc, etc.

Ce script doit pouvoir être exécuté en pre-commit via Husky ou manuellement.

**Objectif** : garantir une base de code toujours conforme et homogène.

## Ajouter des tests unitaires et d'intégration pour le process de build

Mettre en place une suite de tests (avec ts-jest) pour couvrir :

- Les modules de cache (`LibraryCache`, `PackageCache`, factory, etc.)
- Le workflow global du build (orchestrateur, builder, phases)
- Les cas limites (invalidation, force-rebuild, watch, etc.)

Les tests doivent être exécutables en CI et localement.

**Objectif** : garantir la robustesse, la non-régression et la maintenabilité du système de build Bonsai v2.
