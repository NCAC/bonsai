# Guide de Style de Code - Bonsai Framework

## Table des matières

1. [Introduction](#introduction)
2. [TypeScript](#typescript)
3. [Structure du projet](#structure-du-projet)
4. [Nommage](#nommage)
5. [Formatage](#formatage)
6. [Verbosité du code](#verbosité-du-code)
7. [Documentation](#documentation)
8. [Tests](#tests)
9. [Gestion des erreurs](#gestion-des-erreurs)
10. [Performance](#performance)
11. [Ressources](#ressources)

## Introduction

Ce document définit les conventions de codage et les bonnes pratiques à suivre pour le développement du framework Bonsai. Ces conventions sont conçues pour assurer la cohérence, la lisibilité et la maintenabilité du code à travers l'ensemble du projet.

## TypeScript

### Configuration

- Utiliser la configuration TypeScript stricte (`strict: true`) dans tous les fichiers `tsconfig.json`
- Étendre `tsconfig.base.json` pour maintenir la cohérence entre les packages
- Spécifier explicitement les options TypeScript importantes:
  ```json
  {
    "compilerOptions": {
      "strict": true,
      "noImplicitAny": true,
      "strictNullChecks": true,
      "forceConsistentCasingInFileNames": true
    }
  }
  ```

### Types

- Préférer les types explicites aux types inférés pour les signatures de fonctions et les interfaces publiques
- Utiliser `type` pour les alias de types simples et `interface` pour les structures extensibles
- Éviter l'utilisation de `any`, préférer `unknown` si le type n'est pas connu à l'avance
- Utiliser les génériques pour créer des fonctions et des classes réutilisables avec différents types
- Préfixer les types avec `T` (ex: `TPackage`, `TFramework`)
- Préfixer les interface avec `I` (exemple `IProject`)
- **Emplacement des définitions** : À l'exception des types ambiants, définir et exporter les types/interfaces à côté de leur implémentation, et non dans des fichiers centralisés de types

### Imports

- Utiliser les imports nommés pour une meilleure visibilité des dépendances
- Ne pas inclure l'extension de fichier dans les imports (compatible avec `tsx`)
- Organiser les imports dans l'ordre suivant:
  1. Bibliothèques standard (Node.js)
  2. Dépendances externes
  3. Modules internes du framework
  4. Imports relatifs locaux
- Utiliser les chemins d'alias (`@build/...`) pour les imports entre packages

### Règles supplémentaires sur les imports

- Les imports de bibliothèques standards Node.js doivent obligatoirement utiliser la "version longue" (ex : `import { join } from "node:path";` et non `import path from "path";`).
- Il est interdit d'utiliser les imports par défaut pour les modules Node.js standards : toujours préférer l'import nommé (ex : `import { join, basename } from "node:path";` et non `import path from "node:path";`).
- Cette règle s'applique aussi pour les autres modules qui exposent des exports nommés.
- **Tous les imports doivent être statiques et placés en haut du fichier. Les imports dynamiques (`await import(...)`) sont interdits, sauf cas exceptionnel documenté.**

### Nommage des imports par défaut

- Quand vous importez le défaut d'une bibliothèque externe et que vous avez le choix du nom, **préférez systématiquement un nom explicite et verbeux**.
- Exemple recommandé :
  ```ts
  import fileSystem from "fs-extra";
  // et non : import fs from "fs-extra";
  ```
- Cela améliore la lisibilité et évite les confusions avec les modules natifs Node.js ou d'autres utilitaires.

## Modules et imports (ESM)

- Le projet utilise **exclusivement** les modules ECMAScript (full ESM).
- Tous les imports doivent être placés en haut de chaque fichier, avant tout code d'exécution.
- **L'import dynamique (`import()` dans le code)** est interdit, sauf cas très exceptionnel documenté (ex : lazy loading dans un navigateur).
- Utiliser les imports nommés et les chemins d'alias (`@build/...`) pour la clarté et la maintenabilité.
- Ne pas inclure l'extension de fichier dans les imports (compatible avec `tsx`).
- Organiser les imports dans l'ordre suivant :
  1. Bibliothèques standard (Node.js)
  2. Dépendances externes
  3. Modules internes du framework
  4. Imports relatifs locaux

## Imports internes et chemins d'alias

- **N'utilisez jamais d'import relatif pour les modules internes du framework.**
- Utilisez toujours les chemins d'alias (`@build/...`, `@lib/...`, etc.) définis dans `tsconfig.json` pour tous les imports internes.
- Exemple :
  ```ts
  import { Logger } from "@build/monitoring/logger.class";
  // et non : import { Logger } from "../monitoring/logger.class";
  ```
- Cette règle est obligatoire pour garantir la maintenabilité, la clarté et la robustesse des imports dans tout le projet.

## Structure du projet

### Organisation des fichiers

- Un module par fichier
- Nommer les fichiers en kebab-case (ex: `build-event-manager.ts`)
- Utiliser des suffixes pour indiquer le type de contenu:
  - `.class.ts` pour les classes
  - `.interface.ts` pour les interfaces
  - `.type.ts` pour les types complexes
  - `.enum.ts` pour les énumérations
  - `.utils.ts` pour les fonctions utilitaires

### Structure des répertoires

- `/core` - Framework principal
- `/packages` - Modules indépendants
- `/lib` - Outils de build et utilitaires
- `/tools` - Scripts et outils de développement
- `/docs` - Documentation technique

## Nommage

### Général

- Noms descriptifs et explicites
- Éviter les abréviations sauf si elles sont largement connues (ex: HTML, DOM)
- Acronymes en majuscules si moins de 3 lettres (ex: `ID`, `IO`), sinon en PascalCase (ex: `HttpRequest`)

### Conventions spécifiques

- **Classes**: PascalCase (ex: `EventManager`)
- **Interfaces**: PascalCase avec préfixe `I` (ex: `IPackageJson`)
- **Types**: PascalCase avec préfixe `T` (ex: `TStoredPackage`)
- **Fonctions**: camelCase (ex: `getFrameworkPackages`)
- **Variables**: camelCase (ex: `buildOptions`)
- **Constantes**: UPPER_SNAKE_CASE (ex: `DEFAULT_TIMEOUT`)
- **Fichiers**: kebab-case (ex: `build-store-config.ts`)
- **Dossiers**: kebab-case (ex: `rollup-plugin-dts`)

## Formatage

- Utiliser Prettier pour le formatage automatique
- Indentation de 2 espaces
- Longueur de ligne maximale de 80 caractères
- Utiliser des points-virgules (`;`) à la fin des instructions
- Utiliser des guillemets doubles (`"`) pour les chaînes de caractères
- Préférer les fonctions fléchées pour les fonctions anonymes
- Utiliser des accolades même pour les blocs à une seule instruction

## Verbosité du code

- Privilégier la clarté et la lisibilité à la concision
- Éviter les expressions trop complexes ou trop denses
- Décomposer les expressions complexes en variables intermédiaires explicites
- Utiliser des noms de variables descriptifs même pour les variables temporaires
- Ne pas hésiter à ajouter des commentaires explicatifs pour la logique métier
- Favoriser l'expressivité du code plutôt que l'optimisation prématurée

## Documentation

### JSDoc

- Documenter toutes les fonctions, classes et interfaces publiques avec JSDoc
- Inclure une description, les paramètres, le type de retour et les exceptions
- Exemple:
  ```typescript
  /**
   * Nettoie le dossier dist d'un package spécifique
   *
   * @param packagePath Chemin absolu vers le package
   * @returns Promise qui se résout quand le nettoyage est terminé
   * @throws Si le package n'existe pas ou si le nettoyage échoue
   */
  ```

### README

- Chaque package doit avoir son propre README.md
- Inclure une brève description, les fonctionnalités, l'installation et l'utilisation
- Fournir des exemples de code pour les API principales

### Commentaires

- Commenter le code complexe ou non évident
- Utiliser des commentaires en français
- Privilégier le code auto-documenté (noms descriptifs) aux commentaires excessifs
- Utiliser des commentaires en ligne (`// ...`) pour des explications brèves
- Utiliser des commentaires de bloc (`/* ... */`) pour la documentation plus longue

## Tests

- Écrire des tests unitaires pour toutes les fonctionnalités principales
- Utiliser Jest comme framework de test
- Suivre la convention de nommage: `[nom-du-fichier].test.ts`
- Organiser les tests en blocs `describe` et `it`
- Tester les cas nominaux et les cas d'erreur

## Gestion des erreurs

- Utiliser des types d'erreur spécifiques plutôt que l'`Error` générique
- Logger les erreurs avec des messages informatifs
- Capturer et gérer les erreurs au niveau approprié
- Éviter de supprimer silencieusement les erreurs

## Performance

- Éviter les calculs inutiles dans les boucles
- Minimiser les allocations de mémoire pour les opérations fréquentes
- Utiliser des structures de données appropriées pour chaque cas d'usage
- Optimiser la génération des fichiers de définition TypeScript (.d.ts)
- Surveiller l'utilisation de la mémoire pendant les builds

## Style de gestion des fichiers

- **Utilisez `fs-extra` au lieu de `node:fs`** :
  - Préférez toujours la librairie [`fs-extra`](https://github.com/jprichardson/node-fs-extra) pour toutes les opérations sur le système de fichiers.
  - `fs-extra` est plus moderne, propose une API compatible avec `fs` mais enrichie, et intègre nativement les promesses pour toutes ses méthodes.
  - Exemple :
    ```ts
    import fs from "fs-extra";
    // et non : import { promises as fs } from 'node:fs';
    ```
  - Cela simplifie le code, améliore la compatibilité et réduit les erreurs potentielles.

### Pattern Singleton pour les services

- Pour tout composant de type « service » (analogue aux services Drupal/Symfony), il est obligatoire d’utiliser le pattern singleton suivant :
  - Le constructeur doit être `private`.
  - Une méthode statique `me()` doit retourner l’unique instance du service.
  - Exemple :
    ```ts
    export class MyService {
      private static instance: MyService;
      private constructor(/* dépendances */) {
        /* ... */
      }
      static me(): MyService {
        if (!MyService.instance) {
          MyService.instance = new MyService(/* ... */);
        }
        return MyService.instance;
      }
    }
    ```
- Ce pattern permet d’injecter d’autres services dans le constructeur privé et garantit l’unicité de l’instance dans tout le projet.
- Voir les exemples dans `/bonsai/lib/build/initializing/build-options.class.ts` et `/bonsai/lib/build/initializing/components-registry.ts`.

## Ressources

- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Google JavaScript Style Guide](https://google.github.io/styleguide/jsguide.html)
- [Clean Code by Robert C. Martin](https://gist.github.com/wojteklu/73c6914cc446146b8b533c0988cf8d29)
