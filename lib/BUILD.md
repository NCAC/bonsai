# Système de Build Bonsai

Ce document décrit l'architecture et le fonctionnement du système de build du framework Bonsai.

## Vue d'ensemble

Le système de build Bonsai est conçu pour gérer de manière automatique et intelligente deux types de packages :

1. **Packages réguliers** : Contiennent du code JavaScript/TypeScript exécutable
2. **Packages types-only** : Contiennent uniquement des définitions de types TypeScript (fichiers `.d.ts`)

### Architecture

```
lib/build/
├── core/                    # Classes centrales du système
│   ├── path-manager.class.ts    # Gestion des chemins
│   └── main.ts                  # Point d'entrée principal
├── initializing/            # Phase d'initialisation
│   └── components-registry.ts   # Analyse et détection des packages
├── building/                # Phase de compilation
│   └── builder.class.ts         # Logique de build par package
├── bundling/                # Phase de bundling
│   └── generate-flat-framework-dts.ts  # Génération du bundle de types
└── monitoring/              # Outils de monitoring
    └── logger.class.ts          # Système de logs
```

## Configuration

Le fichier `bonsai-components.yaml` définit les packages à builder :

```yaml
# Bibliothèques externes (buildées en parallèle)
libraries:
  - "@bonsai/rxjs"

# Packages internes (avec dépendances possibles)
packages:
  - "@bonsai/types"
  - "@bonsai/event"
```

## Détection automatique des packages types-only

Le système détecte automatiquement si un package contient uniquement des types grâce à plusieurs critères :

### 1. Analyse du `package.json`

```json
{
  "name": "@bonsai/types",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts"
    }
  },
  "types": "./dist/index.d.ts"
}
```

**Critères de détection :**

- Le champ `exports` ne contient que `"types"` (pas de `"import"` ou `"require"`)
- Le champ `main` est absent ou pointe vers un fichier `.d.ts`
- Le champ `types` est présent

### 2. Analyse du contenu source

Le système examine le dossier `src/` :

- Présence uniquement de fichiers `.d.ts`
- Ou fichiers `.ts` ne contenant que des exports de types/interfaces

```typescript
// ✅ Types-only - Uniquement des exports de types
export type MyType = string;
export interface MyInterface {}

// ❌ Pas types-only - Contient du code exécutable
export const myVariable = "value";
export function myFunction() {}
```

## Processus de build

### 1. Phase d'initialisation (`ComponentsRegistry`)

```typescript
const components = await collectComponents();
// Résultat :
{
  framework: TFramework,
  libraries: TPackage[],
  packages: TPackage[],
  allPackages: Set<TPackage>
}
```

### 2. Phase de compilation (`Builder`)

Pour chaque package, le builder détermine la stratégie appropriée :

```typescript
async buildPackage(package: TPackage): Promise<void> {
  if (package.isTypesOnly) {
    await this.buildTypesOnlyPackage(package);
  } else {
    await this.buildRegularPackage(package);
  }
}
```

#### Build régulier (avec Rollup)

- Compilation TypeScript → JavaScript
- Bundling avec Rollup
- Génération des fichiers `.js` et `.d.ts`

#### Build types-only (copie directe)

- Copie des fichiers `.d.ts` depuis `src/` vers `dist/`
- Pas de compilation JavaScript
- Beaucoup plus rapide

### 3. Phase de bundling

Génération du bundle framework final (`core/dist/bonsai.d.ts`) avec :

- **Extraction AST** : Utilisation de `ts-morph` pour analyser les types
- **Déduplication** : Évite les conflits de noms de types
- **Export plat** : Tous les types disponibles au niveau framework

```typescript
// Au lieu de :
import { MyType } from "@bonsai/types";

// Directement :
import { MyType } from "bonsai";
```

## Avantages du système

### Performance

- **Build incrémental** : Seuls les packages modifiés sont rebuildés
- **Parallélisation** : Les bibliothèques sont buildées en parallèle
- **Types-only optimisé** : Pas de compilation inutile pour les types purs

### Maintenabilité

- **Détection automatique** : Pas besoin de configuration manuelle
- **Logs détaillés** : Suivi précis du processus de build
- **Gestion d'erreurs** : Remontée claire des problèmes

### Flexibilité

- **Stratégies multiples** : Adaptation automatique selon le type de package
- **Configuration YAML** : Gestion simple des dépendances
- **Extensibilité** : Architecture modulaire pour ajouts futurs

## Logs de build

Le système fournit des logs détaillés :

```
📝 Package @bonsai/types detected as types-only
🔨 Building types-only package: @bonsai/types
✅ Types-only package @bonsai/types built successfully
🎯 Generating flat framework .d.ts bundle...
```

## Dépannage

### Package non détecté comme types-only

Vérifiez :

1. La structure du `package.json`
2. Le contenu du dossier `src/`
3. Les logs de détection

### Erreurs de compilation

Les erreurs TypeScript sont remontées avec :

- Fichier concerné
- Ligne et colonne
- Message d'erreur détaillé

### Conflits de types

Le système de déduplication évite automatiquement les conflits, mais en cas de problème :

1. Vérifiez les noms de types uniques
2. Consultez les logs de bundling
3. Examinez le fichier généré `core/dist/bonsai.d.ts`

## Extension du système

Pour ajouter un nouveau type de package :

1. Étendre le type `TPackage` dans `build.type.ts`
2. Ajouter la logique de détection dans `ComponentsRegistry`
3. Implémenter la stratégie de build dans `Builder`
4. Mettre à jour la phase de bundling si nécessaire

---

> 💡 **Note** : Ce système est optimisé pour les besoins spécifiques du framework Bonsai. Il privilégie la simplicité et l'automatisation pour une expérience développeur optimale.
