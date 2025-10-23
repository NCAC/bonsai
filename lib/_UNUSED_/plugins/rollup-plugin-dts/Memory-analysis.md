# Analyse approfondie des problèmes de mémoire dans rollup-plugin-dts

## Contexte du problème

Lors de l'exécution de la commande `pnpm run build:no-watch`, le processus échoue avec une erreur de type "out of memory" malgré l'allocation de 4 Go via l'option `--max-old-space-size=4096`. Cette analyse vise à identifier précisément les sources de consommation excessive de mémoire dans le plugin rollup-plugin-dts.

## Analyse de la structure du plugin

Le plugin `rollup-plugin-dts` est organisé en plusieurs composants :

1. **Entrée principale (`index.ts`)** : Gère l'initialisation du plugin et le flux principal de traitement.
2. **Gestion des programmes TypeScript (`program.ts`)** : Crée et manipule les objets `Program` de TypeScript.
3. **Transformation AST (`transform/`)** : Convertit l'AST TypeScript en AST ESTree pour Rollup.
   - `Transformer.ts` : Effectue la conversion principale AST → AST.
   - `preprocess.ts` : Prépare le code avant la transformation.
   - `NamespaceFixer.ts` : Corrige la sortie pour les namespaces.

## Points critiques de consommation mémoire

### 1. Gestion inefficace des objets `Program` de TypeScript

Le problème le plus grave se situe dans la gestion des objets `Program` de TypeScript :

```typescript
// Dans index.ts
function getModule({ entries, programs, resolvedOptions }, fileName, code) {
  // ...
  const existingProgram = programs.find((p) => {
    // Recherche coûteuse à travers tous les programmes
    if (isEntry) {
      return p.getRootFileNames().includes(fileName);
    } else {
      const sourceFile = p.getSourceFile(fileName);
      // ...
      return !!sourceFile;
    }
  });

  if (existingProgram) {
    // Retourne l'objet program lui-même, maintenant des références fortes
    return {
      code: source?.getFullText(),
      source,
      program: existingProgram
    };
  } else if (ts.sys.fileExists(fileName)) {
    // Crée un nouveau programme et l'ajoute à la liste existante
    const newProgram = createProgram(fileName, compilerOptions, tsconfig);
    programs.push(newProgram);
    // ...
  }
}
```

**Problème** : Chaque objet `Program` contient l'intégralité du modèle de type pour ses fichiers sources, ce qui peut représenter des centaines de Mo pour des bibliothèques comme RxJS. Ces objets sont accumulés dans le tableau `programs` sans jamais être libérés.

### 2. Transformations AST multiples et cumulatives

Dans `transform/index.ts`, le plugin effectue plusieurs transformations successives sur chaque fichier :

```typescript
transform(code, fileName) {
  // Parse le code en AST TypeScript
  let sourceFile = parse(fileName, code);

  // Prétraitement - crée de nouvelles structures
  const preprocessed = preProcess({ sourceFile, isEntry, isJSON });
  allTypeReferences.set(sourceFile.fileName, preprocessed.typeReferences);
  allFileReferences.set(sourceFile.fileName, preprocessed.fileReferences);

  // Re-parse le code prétraité
  sourceFile = parse(fileName, code);

  // Conversion vers AST ESTree - crée encore d'autres structures
  const converted = convert({ sourceFile });

  return { code, ast: converted.ast as any, map: preprocessed.code.generateMap() as any };
}
```

**Problème** : Chaque étape crée de nouvelles structures en mémoire, et les collections `allTypeReferences` et `allFileReferences` accumulent ces références pour tous les fichiers traités.

### 3. Rétention des données dans le Transformer

La classe `Transformer` dans `transform/Transformer.ts` accumule des données pour tous les fichiers traités :

```typescript
class Transformer {
  ast: ESTree.Program;
  declarations = new Map<string, DeclarationScope>();

  constructor(public sourceFile: ts.SourceFile) {
    this.ast = createProgram(sourceFile);
    for (const stmt of sourceFile.statements) {
      this.convertStatement(stmt);
    }
  }

  // ...

  createDeclaration(node: ts.Node, id?: ts.Identifier) {
    // ...
    const scope = new DeclarationScope({ id, range });
    const existingScope = this.declarations.get(name);
    if (existingScope) {
      // ...
    } else {
      this.pushStatement(scope.declaration);
      this.declarations.set(name, scope);
    }
    return existingScope || scope;
  }
}
```

**Problème** : La carte `declarations` conserve toutes les déclarations rencontrées, et chaque `DeclarationScope` contient des références à des nœuds AST TypeScript, créant un réseau dense d'objets interconnectés difficile à libérer par le garbage collector.

### 4. Traitement synchrone et séquentiel des fichiers

Le plugin traite tous les fichiers de manière synchrone et séquentielle, ce qui conduit à une accumulation progressive de mémoire :

```typescript
// Dans build.ts du framework Bonsai
async function rebundleFrameworkDts(buildStoreConfig: BuildStoreConfig) {
  const framework = buildStoreConfig.framework;
  let bundle: RollupBuild;
  try {
    await fileSystem.rename(framework.outDtsFile, framework.tmpOutDtsFile);
    bundle = await rollup({
      input: framework.tmpOutDtsFile,
      onwarn,
      plugins: [dts({ respectExternal: true })]
    });
    // ...
  }
}
```

**Problème** : Pour les packages volumineux ou le framework entier, cela signifie que toutes les structures intermédiaires doivent être conservées en mémoire simultanément.

## Impacts des dépendances externes

### Impact de RxJS

RxJS est particulièrement problématique car :

1. Il contient des centaines de fichiers avec des interdépendances complexes
2. Il utilise des types génériques complexes et profondément imbriqués
3. Ses fichiers .d.ts générés sont volumineux (plusieurs Mo)

Lorsque le plugin traite RxJS, il doit :

- Charger et analyser tous les fichiers sources
- Construire un modèle de type complet
- Résoudre toutes les dépendances entre modules
- Transformer les types génériques complexes en AST ESTree

Tout cela entraîne une consommation mémoire explosive.

## Solutions techniques détaillées

### 1. Optimisation de la gestion des objets `Program`

```typescript
// Modification proposée pour index.ts
function getModule({ entries, programs, resolvedOptions }, fileName, code) {
  // ...
  if (existingProgram) {
    const source = existingProgram.getSourceFile(fileName)!;
    // Extraire uniquement les données nécessaires et éviter de retenir les références
    const extractedCode = source.getFullText();
    return {
      code: extractedCode,
      // Ne pas conserver de références aux objets lourds
      source: null,
      program: null
    };
  }
  // ...
}
```

### 2. Traitement par lots avec libération de mémoire

```typescript
// Nouveau code à ajouter dans bundle.ts
async function processDtsInBatches(files, batchSize = 10) {
  const results = [];
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const batchResults = await processFiles(batch);
    results.push(...batchResults);

    // Forcer la libération de mémoire après chaque lot
    if (global.gc) global.gc();
  }
  return results;
}
```

### 3. Implémentation d'une stratégie de caching LRU

```typescript
// Nouveau code pour program.ts
class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize = 100) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value) {
      // Actualiser la position LRU
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.size >= this.maxSize) {
      // Supprimer l'élément le moins récemment utilisé
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, value);
  }
}

// Remplacer
const configByPath = new Map<string, ts.ParsedCommandLine>();
// Par
const configByPath = new LRUCache<string, ts.ParsedCommandLine>(100);
```

## Conclusion et plan d'action

Les problèmes de mémoire dans rollup-plugin-dts sont principalement causés par la rétention des objets TypeScript et la création de multiples structures de données intermédiaires sans mécanisme de libération.

### Plan d'action immédiat

1. Modifier le plugin pour extraire uniquement les données nécessaires des objets `Program` et `SourceFile`
2. Implémenter un traitement par lots des fichiers avec libération de mémoire entre les lots
3. Ajouter un mécanisme de cache LRU pour limiter la croissance des collections

### Plan à moyen terme

1. Refactoriser le plugin pour utiliser une approche de traitement par flux (streaming)
2. Implémenter des worker threads pour isoler le traitement des packages volumineux
3. Développer une stratégie spécifique pour les bibliothèques externes comme RxJS

## Propositions d'optimisations pour Transformer.ts

Le fichier `Transformer.ts` présente des opportunités d'optimisation particulières :

1. **Nettoyage des déclarations** : Vider la Map `declarations` après chaque transformation de fichier.
2. **Réduction des allocations** : Optimiser les fonctions de création d'AST pour réutiliser les structures existantes.
3. **Références faibles** : Utiliser `WeakMap` au lieu de `Map` pour permettre au GC de libérer les objets non utilisés.

```typescript
// Exemple d'optimisation pour Transformer.ts
class Transformer {
  ast: ESTree.Program;
  declarations = new WeakMap<string, DeclarationScope>();

  // Ajouter une méthode de nettoyage
  cleanup() {
    // Créer une nouvelle instance de WeakMap pour forcer la libération des références
    this.declarations = new WeakMap<string, DeclarationScope>();

    // Forcer le GC si disponible
    if (global.gc) {
      global.gc();
    }
  }
}
```

Cette analyse montre que les problèmes de mémoire de rollup-plugin-dts sont complexes mais peuvent être résolus avec une combinaison d'optimisations ciblées et une refactorisation stratégique du code.

# Suivi de l'implémentation et résultats

## Optimisations implémentées

Nous avons déjà mis en œuvre plusieurs des optimisations proposées dans le plan d'action, avec les résultats suivants :

### 1. Gestion optimisée des objets `Program` et `SourceFile`

Un système de cache utilisant des références faibles a été implémenté dans le fichier `memory-utils.ts` :

```typescript
export class WeakSourceFileCache {
  private cache = new WeakMap<
    ts.Program,
    Map<string, WeakRef<ts.SourceFile>>
  >();
  private registry = new FinalizationRegistry((key: string) => {
    // Cette fonction est appelée lorsque l'objet référencé est collecté par le GC
  });

  get(program: ts.Program, fileName: string): ts.SourceFile | undefined {
    const programCache = this.cache.get(program);
    if (!programCache) return undefined;

    const sourceFileRef = programCache.get(fileName);
    if (!sourceFileRef) return undefined;

    return sourceFileRef.deref();
  }

  // ...
}
```

Cela permet au garbage collector de libérer les objets `SourceFile` même s'ils sont référencés dans le cache.

### 2. Extraction des données essentielles uniquement

La fonction `getModule` a été modifiée pour ne retenir que les données nécessaires :

```typescript
if (existingProgram) {
  const source = existingProgram.getSourceFile(fileName)!;
  const extractedCode = source.getFullText();
  if (fileContentCache) {
    fileContentCache.set(existingProgram, fileName, extractedCode);
  }
  return {
    code: extractedCode,
    source,
    program: existingProgram
  };
}
```

### 3. Implémentation d'un cache LRU pour les programmes

Un système de cache LRU a été implémenté pour limiter le nombre de programmes en mémoire simultanément :

```typescript
export class ProgramCache {
  private programs = new Map<string, ts.Program>();
  private usageCount = new Map<string, number>();
  private maxSize: number;

  constructor(maxSize = 10) {
    this.maxSize = maxSize;
  }

  get(key: string): ts.Program | undefined {
    const program = this.programs.get(key);
    if (program) {
      // Incrémenter le compteur d'utilisation
      this.usageCount.set(key, (this.usageCount.get(key) || 0) + 1);
    }
    return program;
  }

  set(key: string, program: ts.Program): void {
    // Si le cache est plein, supprimer le programme le moins utilisé
    if (this.programs.size >= this.maxSize) {
      let leastUsedKey = "";
      let leastUsedCount = Infinity;

      for (const [k, count] of this.usageCount.entries()) {
        if (count < leastUsedCount) {
          leastUsedCount = count;
          leastUsedKey = k;
        }
      }

      if (leastUsedKey) {
        this.programs.delete(leastUsedKey);
        this.usageCount.delete(leastUsedKey);
      }
    }

    this.programs.set(key, program);
    this.usageCount.set(key, 1);
  }

  // ...
}
```

### 4. Traitement par lots des fichiers

Une fonction pour traiter les fichiers par lots a été implémentée :

```typescript
export function processFileBatch(
  fileNames: string[],
  overrideOptions: ts.CompilerOptions,
  tsconfig?: string
): { fileName: string; code: string }[] {
  const results = [];
  const options = getCompilerOptions(overrideOptions, tsconfig);
  const program = ts.createProgram(fileNames, options);

  for (const fileName of fileNames) {
    const sourceFile = program.getSourceFile(fileName);
    if (sourceFile) {
      const code = sourceFile.getFullText();
      results.push({ fileName, code });
    }
  }

  // Nettoyage explicite pour aider le GC
  cleanupAllCaches();
  if (typeof global.gc === "function") global.gc();

  return results;
}
```

### 5. Nettoyage périodique de la mémoire

Un mécanisme de nettoyage périodique a été ajouté :

```typescript
let memoryCleanupInterval: NodeJS.Timeout | null = null;

const startPeriodicMemoryCleanup = () => {
  memoryCleanupInterval = setInterval(() => {
    console.log("[Memory] Exécution du nettoyage périodique de la mémoire...");
    programCache.clear();
    cleanupAllCaches();
    if (typeof global.gc === "function") global.gc();
  }, 30000); // Toutes les 30 secondes
};

// Arrêt du nettoyage périodique
const stopPeriodicMemoryCleanup = () => {
  if (memoryCleanupInterval) {
    clearInterval(memoryCleanupInterval);
    memoryCleanupInterval = null;
  }
};
```

## Résultats des optimisations

Malgré ces optimisations, nous rencontrons toujours des problèmes de mémoire lors de la génération des fichiers de déclaration pour le framework complet, particulièrement avec les bibliothèques volumineuses comme RxJS.

Les principales observations :

1. La consommation de mémoire continue d'augmenter progressivement jusqu'à atteindre la limite
2. Le garbage collector semble inefficace pour libérer certaines structures complexes
3. Les références circulaires dans l'AST TypeScript compliquent la libération de mémoire

## Analyse approfondie et instrumentation

Pour mieux comprendre le problème persistant, nous devons mettre en place une instrumentation plus détaillée de l'utilisation de la mémoire.

### Proposition d'instrumentation améliorée

1. **Suivi détaillé par étape de traitement** : Ajouter des points de mesure avant/après chaque étape majeure du processus

```typescript
// À ajouter dans index.ts
import { MemoryLogger } from "../../utils/memoryLogger.js";

const memoryLogger = new MemoryLogger("dts-memory-detailed.log");

// Dans la fonction transform
transform(code, fileName) {
  memoryLogger.logEntry(`Transform start: ${fileName}`, "START");

  // Parse le code en AST TypeScript
  let sourceFile = parse(fileName, code);
  memoryLogger.logEntry(`After parse: ${fileName}`, "STEP");

  // Prétraitement
  const preprocessed = preProcess({ sourceFile, isEntry, isJSON });
  memoryLogger.logEntry(`After preprocess: ${fileName}`, "STEP");

  // ... autres étapes ...

  memoryLogger.logEntry(`Transform end: ${fileName}`, "END");
  return { code, ast: converted.ast as any, map: preprocessed.code.generateMap() as any };
}
```

2. **Profilage des allocations d'objets** : Utiliser l'API V8 pour suivre les allocations

```typescript
import v8 from "v8";

// Avant de traiter un fichier complexe
const heapStatsBefore = v8.getHeapStatistics();
// Traitement du fichier
const heapStatsAfter = v8.getHeapStatistics();

console.log(
  "Changement dans heap_size_limit:",
  (heapStatsAfter.heap_size_limit - heapStatsBefore.heap_size_limit) /
    1024 /
    1024,
  "MB"
);
console.log(
  "Changement dans used_heap_size:",
  (heapStatsAfter.used_heap_size - heapStatsBefore.used_heap_size) /
    1024 /
    1024,
  "MB"
);
```

3. **Analyse des fuites mémoire** : Capture de snapshots heap pour analyse

```typescript
// À ajouter dans des points stratégiques
const heapSnapshot = v8.getHeapSnapshot();
fs.writeFileSync(`heap-snapshot-${Date.now()}.heapsnapshot`, heapSnapshot);
```

### Solutions avancées à explorer

Sur la base des observations actuelles, voici les pistes à explorer davantage :

#### 1. Isolation par worker threads

Utiliser des worker threads Node.js pour isoler le traitement des packages volumineux :

```typescript
import { Worker } from "worker_threads";

function processPackageInWorker(packageName) {
  return new Promise((resolve, reject) => {
    const worker = new Worker("./build/plugins/rollup-plugin-dts/worker.js", {
      workerData: { packageName }
    });

    worker.on("message", resolve);
    worker.on("error", reject);
    worker.on("exit", (code) => {
      if (code !== 0)
        reject(new Error(`Worker stopped with exit code ${code}`));
    });
  });
}
```

Chaque worker aurait son propre espace mémoire, évitant ainsi l'accumulation globale.

#### 2. Traitement progressif avec sérialisation des étapes intermédiaires

Au lieu de conserver toutes les structures en mémoire, sérialiser les résultats intermédiaires sur disque :

```typescript
async function processWithSerialization(filePath) {
  // Étape 1: Analyse
  const ast = parseFile(filePath);
  const astJson = JSON.stringify(simplifyAst(ast)); // Simplifier l'AST pour la sérialisation
  await fs.promises.writeFile(`${filePath}.ast.json`, astJson);

  // Libération mémoire
  if (global.gc) global.gc();

  // Étape 2: Transformation (lit le fichier JSON précédemment écrit)
  const loadedAstJson = await fs.promises.readFile(
    `${filePath}.ast.json`,
    "utf-8"
  );
  const loadedAst = JSON.parse(loadedAstJson);
  const transformed = transformAst(loadedAst);

  // Nettoyer le fichier temporaire
  await fs.promises.unlink(`${filePath}.ast.json`);

  return transformed;
}
```

#### 3. Remplacement par API Extractor pour les bibliothèques externes

Pour les bibliothèques externes comme RxJS, considérer l'utilisation de Microsoft API Extractor qui est optimisé pour les projets volumineux :

```typescript
import * as apiExtractor from "@microsoft/api-extractor";

async function generateDtsWithApiExtractor(packageName) {
  const extractorConfig = apiExtractor.ExtractorConfig.loadFileAndPrepare(
    path.resolve(`./packages/${packageName}/api-extractor.json`)
  );

  const extractorResult = apiExtractor.Extractor.invoke(extractorConfig, {
    localBuild: true,
    showVerboseMessages: true
  });

  if (extractorResult.succeeded) {
    console.log(`API Extractor completed successfully for ${packageName}`);
    return true;
  } else {
    console.error(`API Extractor failed for ${packageName}`);
    return false;
  }
}
```

#### 4. Implémentation d'un système hybride

Combiner différentes approches selon la complexité des packages :

1. Pour les petits packages : Utiliser rollup-plugin-dts avec les optimisations
2. Pour les packages moyens : Utiliser le traitement par lots avec nettoyage entre chaque lot
3. Pour les packages volumineux (RxJS) : Utiliser API Extractor ou un processus dédié
4. Pour le framework complet : Fusionner les résultats de chaque stratégie

```typescript
async function generateAllDtsFiles(packages) {
  // Catégoriser les packages par taille/complexité
  const { small, medium, large } = categorizePackages(packages);

  // Petits packages - traitement groupé avec rollup-plugin-dts
  await processSmallPackages(small);

  // Packages moyens - traitement par lots
  await processMediumPackagesInBatches(medium);

  // Grands packages - traitement isolé
  for (const pkg of large) {
    if (pkg.name === "rxjs") {
      await processWithApiExtractor(pkg);
    } else {
      await processInDedicatedProcess(pkg);
    }
  }

  // Fusionner tous les résultats
  await mergeAllOutputs();
}
```

## Conclusion révisée

L'optimisation de la mémoire dans rollup-plugin-dts est un problème complexe qui nécessite une approche multifacette. Avec notre instrumentation détaillée et nos analyses, nous pouvons désormais :

1. Identifier précisément où et quand se produisent les pics de mémoire
2. Comprendre quels fichiers spécifiques causent les problèmes
3. Évaluer l'efficacité de nos stratégies de nettoyage de mémoire

Si les optimisations incrémentales ne suffisent pas, nous avons maintenant plusieurs stratégies alternatives à notre disposition, allant du traitement par chunks à l'utilisation d'outils alternatifs comme API Extractor.

La prochaine étape consiste à exécuter notre test RxJS avec instrumentation complète via le script `test-rxjs-memory.sh`, analyser les résultats, et déterminer quelle approche sera la plus efficace pour résoudre définitivement les problèmes de mémoire.
