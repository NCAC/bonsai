# rollup-plugin-dts

Ce dossier contient une version adaptée du plugin [rollup-plugin-dts](https://github.com/Swatinem/rollup-plugin-dts) qui permet de bundler des fichiers de définition TypeScript (`.d.ts`). Cette documentation explique son fonctionnement interne et son utilisation dans le framework Bonsai.

## Objectif

L'objectif principal de ce plugin est de générer des fichiers de définition TypeScript (`.d.ts`) pour les bibliothèques externes intégrées dans Bonsai (comme RxJS, Remeda, Zod), tout en respectant les contraintes spécifiques du framework :

1. Le bundle JavaScript doit exporter un objet global avec toutes les fonctionnalités comme membres (ex: `RXJS`)
2. Le fichier `.d.ts` doit refléter cette structure en encapsulant tous les types sous un namespace global sans références directes au package original

## Architecture interne

Le plugin est organisé en plusieurs fichiers clés :

### 1. `index.ts`

C'est le point d'entrée principal du plugin qui :

- Gère l'initialisation et la configuration
- Définit les hooks Rollup (`options`, `transform`, `resolveId`)
- Coordonne le traitement des fichiers `.d.ts` à travers différentes étapes

### 2. `options.ts`

Définit l'interface d'options du plugin avec les paramètres suivants :

- `respectExternal` : contrôle si les dépendances externes sont automatiquement marquées comme externes
- `includeExternal` : liste des modules externes dont les types doivent être inclus
- `compilerOptions` : options du compilateur TypeScript
- `tsconfig` : chemin vers un fichier tsconfig.json

### 3. `program.ts`

Gère la création et la configuration des instances de `ts.Program` :

- Définit les options par défaut du compilateur TypeScript
- Localise et charge les fichiers tsconfig.json
- Crée des programmes TypeScript pour les fichiers d'entrée

### 4. `helpers.ts`

Fournit des fonctions utilitaires comme :

- Gestion des extensions de fichiers
- Conversion de chemins
- Parsing des fichiers source TypeScript

### 5. `transform/`

Ce dossier contient les transformateurs qui convertissent les ASTs TypeScript en ASTs compatibles avec Rollup :

#### `index.ts`

- Coordonne le processus de transformation en plusieurs étapes
- Configure les options de sortie de Rollup
- Gère les références de types entre les fichiers

#### `preprocess.ts`

- Effectue des transformations préliminaires sur l'AST TypeScript
- Nettoie et prépare le code pour les étapes suivantes

#### `Transformer.ts`

- Convertit l'AST TypeScript en AST de type ESTree pour Rollup

#### `NamespaceFixer.ts`

- Post-traite le code généré par Rollup
- Convertit le JavaScript de sortie en déclarations TypeScript valides
- Gère correctement les namespaces TypeScript

#### `TypeOnlyFixer.ts`

- Effectue des corrections finales sur les types

## Flux de traitement

1. **Initialisation** : Le plugin collecte les fichiers d'entrée et crée des programmes TypeScript.
2. **Prétraitement** : Les fichiers `.d.ts` sont prétraités pour simplifier leur structure.
3. **Transformation** : Les ASTs TypeScript sont convertis en ASTs Rollup.
4. **Bundling** : Rollup effectue le bundling standard.
5. **Post-traitement** : Le code généré est corrigé pour produire des déclarations TypeScript valides.

## Adaptation pour Bonsai

Pour répondre aux exigences spécifiques de Bonsai, le plugin a été adapté pour :

1. Gérer correctement les namespaces globaux
2. Éliminer les références aux packages d'origine
3. Encapsuler tous les types sous un namespace global correspondant à l'objet exporté

## Utilisation dans le système de build

Le plugin est utilisé dans le processus de build de Bonsai pour générer les fichiers `.d.ts` des bibliothèques externes. Son intégration se fait dans le fichier `/bonsai/lib/build/bundle.ts`, où il est configuré pour traiter les fichiers source et générer les définitions appropriées.

## Limitations et solutions

1. **Références externes** : Par défaut, le plugin marque les dépendances externes comme `external`, ce qui peut poser problème pour nos bibliothèques encapsulées. Utilisez l'option `includeExternal` pour inclure des types spécifiques.

2. **Conflits de noms** : Les namespaces peuvent parfois entrer en conflit. Une post-transformation peut être nécessaire pour résoudre ces conflits.

3. **Imports/Exports complexes** : Certaines structures d'import/export peuvent nécessiter une attention particulière pour être correctement traduites en namespaces.

## Modifications spécifiques à Bonsai

Pour adapter ce plugin aux besoins de Bonsai, les modifications suivantes ont été apportées au code d'origine :

1. Ajustement du comportement de résolution des modules externes
2. Adaptation du post-traitement pour générer des namespaces globaux
3. Configuration spécifique pour les bibliothèques RxJS, Remeda et Zod
