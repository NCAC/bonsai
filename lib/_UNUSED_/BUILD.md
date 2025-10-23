# Système de Build Bonsai - Documentation Technique

## Table des matières

1. [Introduction](#introduction)
2. [Architecture du système de build](#architecture-du-système-de-build)
3. [Flux de travail détaillé](#flux-de-travail-détaillé)
4. [Configuration et personnalisation](#configuration-et-personnalisation)
5. [Traitement spécial des DTS](#traitement-spécial-des-dts)
6. [Commandes de build](#commandes-de-build)
7. [Options de build](#options-de-build)
8. [Résolution de problèmes](#résolution-de-problèmes)
9. [Suggestions d'amélioration](#suggestions-damélioration)
10. [Conclusion](#conclusion)

## Introduction

Le système de build de Bonsai est un pipeline de compilation modulaire et extensible, conçu spécifiquement pour gérer la nature multi-package du framework tout en maintenant une cohérence stricte des types TypeScript. Ce système est au cœur du projet, permettant de transformer le code source en packages distribués optimisés pour différents environnements.

**Objectifs clés du système :**

- Assurer la cohérence des types à travers tous les packages
- Optimiser les bundles pour différentes cibles (ESM, CJS)
- Gérer les interdépendances complexes entre packages
- Fournir une expérience de développement fluide avec hot-reloading

## Architecture du système de build

### Structure des fichiers

```
/lib/build/
├── index.ts                # Point d'entrée et orchestrateur principal
├── getFrameworkPackages.ts # Chargement et configuration des packages
├── BuildStoreConfig.ts     # Configuration centralisée du build
├── BuildEventManager.ts    # Système d'événements pour le pipeline
├── types.ts                # Types partagés pour le système de build
├── bundle.ts               # Logique de bundling (Rollup, etc.)
└── README.md               # Documentation interne
```

### Composants principaux

1. **BuildEventManager**

   Implémente un système d'événements Pub/Sub permettant une communication découplée entre les différentes étapes et tâches du build.

2. **BuildStoreConfig**

   Store centralisé pour la configuration du build, incluant les paramètres par défaut et les overrides spécifiques aux packages.

3. **Catégories de Packages**

   Le système organise les packages en deux catégories principales:

   - **Libraries**: Packages externes adaptés pour le framework, pouvant être construits en parallèle
   - **Packages**: Composants maison du framework avec leurs propres interdépendances

### Système d'événements

Le build utilise un système d'événements pour permettre une exécution modulaire et extensible. Les événements clés incluent :

- `build:start` - Déclenché au démarrage du build
- `category:start` - Déclenché au début de chaque catégorie de packages
- `category:end` - Déclenché à la fin de chaque catégorie de packages
- `build:complete` - Déclenché à la fin du build complet

## Flux de travail détaillé

Le processus de build suit les étapes suivantes :

1. **Initialisation**

   - Chargement de la configuration (bonsai-components.yaml)
   - Résolution des dépendances inter-packages
   - Préparation des répertoires de sortie

2. **Compilation TypeScript**

   - Compilation de chaque package avec tsc
   - Génération des fichiers JS et déclarations TS (.d.ts)
   - Application des transformations spécifiques aux plugins

3. **Bundling**

   - Traitement avec Rollup pour les différents formats
   - Application des optimisations (tree-shaking, etc.)
   - Génération des sourcemaps

4. **Post-processing**

   - Traitement spécial des fichiers DTS
   - Optimisation des imports/exports
   - Correction des références de types

5. **Publication**
   - Copie des fichiers auxiliaires (README, LICENSE)
   - Génération des métadonnées de package
   - Vérification de l'intégrité du build

### Diagramme de flux

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Initialisation │────▶│  Compilation   │────▶│     Bundling    │
└─────────────────┘     │   TypeScript    │     │     (Rollup)    │
                        └─────────────────┘     └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐     ┌─────────────────┐
│   Publication    │◀───│ Post-processing │
│   et validation  │    │   (DTS, etc.)   │
└─────────────────┘     └─────────────────┘
```

## Configuration et personnalisation

Le système de build est hautement configurable via plusieurs mécanismes :

### Configuration centralisée

La configuration est centralisée dans `BuildStoreConfig.ts` qui définit :

- Les cibles de build (packages, formats de sortie)
- Les options de compilation TypeScript
- Les configurations de bundling par package
- Les optimisations spécifiques aux packages

### Configuration des packages

Les packages sont configurés dans le fichier `bonsai-components.yaml` qui définit deux catégories principales:

```yaml
# Libraries: Packages externes pouvant être buildés en parallèle
libraries:
  - "@bonsai/rxjs"
  # - "@bonsai/remeda"
  # - "@bonsai/zod"

# Packages: Nos packages maison avec possibles interdépendances
packages:
  - "@bonsai/types"
  # - "@bonsai/event"
  # Autres packages...
```

Exemple de configuration typique dans le code :

```typescript
// Exemple simplifié de configuration
const buildConfig = {
  packages: ["core", "event", "types", "rxjs", "zod", "remeda"],
  formats: ["esm", "cjs"],
  typescript: {
    strict: true,
    declaration: true
    // autres options tsconfig
  },
  bundleOptions: {
    rxjs: {
      external: ["rxjs", "rxjs/operators"],
      dtsSpecialProcessing: true
    }
    // autres options spécifiques par package
  }
};
```

## Traitement spécial des DTS

Une partie critique du système est le traitement des fichiers de déclaration TypeScript, en particulier pour l'intégration RxJS. Le fichier `bundle.ts` contient la fonction `processDtsWithRollup` qui :

1. Collecte les fichiers DTS générés
2. Utilise Rollup pour les bundler
3. Applique des transformations spécifiques pour RxJS
4. Génère un fichier DTS unique et optimisé

### Problématique

Les fichiers DTS générés par TypeScript ont plusieurs limitations :

- Ils ne sont pas optimisés pour les consommateurs de packages
- Les références entre packages peuvent être cassées
- L'intégration avec des bibliothèques externes comme RxJS peut poser problème

### Exemple de traitement

```typescript
// Extrait simplifié de processDtsWithRollup
async function processDtsWithRollup(packageName, options) {
  const inputOptions = {
    input: `./dist/${packageName}/dts/index.d.ts`,
    plugins: [
      dtsPlugin() // Plugin personnalisé pour les transformations DTS
      // Autres plugins si nécessaire
    ],
    external: options.external || []
  };

  const outputOptions = {
    file: `./dist/${packageName}/index.d.ts`,
    format: "es"
  };

  const bundle = await rollup(inputOptions);
  await bundle.write(outputOptions);
  await bundle.close();
}
```

## Commandes de build

Les commandes de build principales sont définies dans le package.json racine :

```bash
# Build complet de tous les packages (avec mode watch activé par défaut)
pnpm build

# Build sans mode de surveillance (se termine après la compilation)
pnpm build:no-watch

# Build avec nettoyage des dossiers dist avant la compilation
pnpm build:clean

# Build avec nettoyage et sans mode de surveillance
pnpm build:clean-no-watch

# Build en mode watch pour le développement
pnpm build:watch

# Build d'un package spécifique
pnpm build --package=core

# Build sans optimisation parallèle
pnpm build:no-optimize

# Build optimisé avec script shell dédié
pnpm build:optimized

# Build uniquement des fichiers DTS
pnpm build:dts-only

# Build uniquement des fichiers JS
pnpm build:js-only

# Nettoyage des dossiers dist uniquement
pnpm clean

# Nettoyage suivi d'un build complet
pnpm clean:build
```

## Options de build

Le système de build de Bonsai offre plusieurs options de personnalisation qui peuvent être passées en ligne de commande:

| Option            | Description                                                                           |
| ----------------- | ------------------------------------------------------------------------------------- |
| `--js-only`       | Compile uniquement les fichiers JavaScript, pas les fichiers de définition TypeScript |
| `--dts-only`      | Compile uniquement les fichiers de définition TypeScript, pas les fichiers JavaScript |
| `--package=<nom>` | Compile uniquement le package spécifié                                                |
| `--no-optimize`   | Désactive la parallélisation et l'optimisation du build                               |
| `--clean`         | Nettoie les dossiers dist avant la compilation                                        |
| `--no-watch`      | Désactive le mode de surveillance des fichiers après la compilation                   |

### Mode de surveillance (Watch Mode)

Par défaut, après la compilation, le système de build reste actif et surveille les modifications des fichiers sources pour reconstruire automatiquement les packages concernés. Ce comportement peut être désactivé avec l'option `--no-watch` pour que le script se termine immédiatement après la compilation.

Exemple d'utilisation:

```bash
# Build sans mode de surveillance
pnpm build --no-watch

# Ou en utilisant le script dédié
pnpm build:no-watch
```

### Optimisation parallèle

Le système de build utilise par défaut une compilation parallèle optimisée qui analyse les dépendances entre packages et compile en parallèle ceux qui n'ont pas de dépendances entre eux. Cette optimisation peut être désactivée avec l'option `--no-optimize`.

## Résolution de problèmes

### Problèmes de références circulaires

Les références circulaires entre packages peuvent causer des problèmes de build. Solution :

1. Exécuter `pnpm build:analyze` pour détecter les références circulaires
2. Refactoriser le code pour éliminer ces références
3. Utiliser l'option `--ignore-circular` pour ignorer temporairement

### Erreurs de types TypeScript

Pour résoudre les erreurs de types persistantes :

1. Vérifier les versions de TypeScript utilisées
2. Exécuter `pnpm clean` suivi de `pnpm build`
3. Vérifier les fichiers `.d.ts` générés dans le dossier dist

## Suggestions d'amélioration

### 1. Parallélisation accrue

**Problème** : Certaines étapes de build pourraient être exécutées en parallèle pour améliorer les performances.

**Solution** : Implémenter un système de dépendances entre tâches qui permettrait une meilleure parallélisation tout en respectant les dépendances entre packages.

```typescript
// Exemple d'implémentation de parallélisation améliorée
class BuildScheduler {
  private dependencyGraph: Map<string, string[]> = new Map();

  constructor(packages: Package[]) {
    // Construire le graphe de dépendances
    for (const pkg of packages) {
      this.dependencyGraph.set(pkg.name, pkg.dependencies);
    }
  }

  async buildInOptimalOrder() {
    const buildOrder = this.topologicalSort();
    const buildLevels = this.groupByLevel(buildOrder);

    // Construire niveau par niveau, avec parallélisation au sein de chaque niveau
    for (const level of buildLevels) {
      await Promise.all(level.map((pkg) => this.buildPackage(pkg)));
    }
  }

  // Autres méthodes...
}
```

### 2. Cache intelligent

**Problème** : Le build complet est relativement lent, surtout pour les modifications mineures.

**Solution** : Implémenter un système de cache qui détecte quels fichiers ont changé et ne rebuild que les packages affectés.

```typescript
// Système de cache conceptuel
class BuildCache {
  private cacheDir = "./.build-cache";
  private hashMap = new Map<string, string>();

  async hasFileChanged(filePath: string): Promise<boolean> {
    const currentHash = await this.hashFile(filePath);
    const previousHash = this.hashMap.get(filePath);

    if (!previousHash || previousHash !== currentHash) {
      this.hashMap.set(filePath, currentHash);
      return true;
    }

    return false;
  }

  // Autres méthodes...
}
```

### 3. Amélioration du traitement DTS

**Problème** : Le traitement des fichiers DTS est complexe et pourrait être plus robuste.

**Solution** : Utiliser des outils dédiés comme `api-extractor` de Microsoft pour une meilleure gestion des déclarations de types publiques.

### 4. Feedback visuel

**Problème** : Le processus de build manque de feedback visuel clair.

**Solution** : Intégrer une bibliothèque comme `ora` ou `listr` pour afficher une progression visuelle du build avec des indicateurs de statut clairs.

```typescript
// Amélioration du reporting
import ora from "ora";
import chalk from "chalk";

class BuildReporter {
  private spinner: ora.Ora | null = null;

  startCategory(categoryName: string) {
    this.spinner = ora(
      `Traitement de la catégorie ${chalk.blue(categoryName)}...`
    ).start();
  }

  completeCategory(categoryName: string, timeMs: number) {
    this.spinner?.succeed(
      `Catégorie ${chalk.blue(categoryName)} terminée en ${chalk.green(
        timeMs + "ms"
      )}`
    );
  }

  // Autres méthodes...
}
```

### 5. Tests d'intégration du build

**Problème** : Le système de build lui-même n'est pas suffisamment testé.

**Solution** : Ajouter des tests d'intégration qui vérifient que le système de build produit les artefacts attendus dans différents scénarios.

```typescript
// Tests d'intégration pour le système de build
describe("Système de build", () => {
  beforeEach(async () => {
    // Nettoyer les artefacts précédents
    await exec("pnpm clean");
  });

  it("devrait construire tous les packages avec succès", async () => {
    const result = await exec("pnpm build");
    expect(result.exitCode).toBe(0);

    // Vérifier que tous les artefacts attendus existent
    for (const pkg of EXPECTED_PACKAGES) {
      for (const format of ["esm", "cjs"]) {
        expect(fs.existsSync(`./dist/${pkg}/${format}/index.js`)).toBe(true);
      }
      expect(fs.existsSync(`./dist/${pkg}/index.d.ts`)).toBe(true);
    }
  });

  // Autres tests...
});
```

## Conclusion

Le système de build de Bonsai est bien structuré mais pourrait bénéficier d'optimisations de performance et d'une meilleure testabilité. Les suggestions ci-dessus permettraient d'améliorer l'expérience des développeurs et la robustesse du processus de build.

Pour une analyse plus approfondie ou des modifications spécifiques, n'hésitez pas à ouvrir des discussions dans les issues du projet.

---

**Note** : Cette documentation est un document vivant qui devrait être mis à jour au fur et à mesure de l'évolution du système de build.
