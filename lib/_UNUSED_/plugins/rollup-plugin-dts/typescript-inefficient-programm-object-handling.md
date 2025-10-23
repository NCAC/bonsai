# Optimisation de la gestion des objets Program de TypeScript

## Problème identifié

Les objets `Program` de TypeScript sont l'une des principales sources de consommation mémoire dans le plugin `rollup-plugin-dts`. Ces objets sont particulièrement lourds car ils contiennent :

1. L'intégralité du modèle de type pour tous les fichiers sources
2. Les références à tous les fichiers source et leurs dépendances
3. Le graphe complet de résolution des modules
4. Les informations de vérification de type

Le problème principal se situe dans la gestion de ces objets dans le fichier `index.ts` du plugin :

```typescript
// Dans index.ts
function getModule({ entries, programs, resolvedOptions }, fileName, code) {
  // ...
  const existingProgram = programs.find((p) => {
    if (isEntry) {
      return p.getRootFileNames().includes(fileName);
    } else {
      const sourceFile = p.getSourceFile(fileName);
      if (sourceFile && p.isSourceFileFromExternalLibrary(sourceFile)) {
        return false;
      }
      return !!sourceFile;
    }
  });

  if (existingProgram) {
    const source = existingProgram.getSourceFile(fileName)!;
    return {
      code: source?.getFullText(),
      source,
      program: existingProgram // Retourne l'objet program entier
    };
  } else if (ts.sys.fileExists(fileName)) {
    const newProgram = createProgram(fileName, compilerOptions, tsconfig);
    programs.push(newProgram); // Ajoute à la liste des programmes sans jamais les supprimer
    // ...
  }
}
```

## Mécanismes sous-jacents et impact mémoire

### Comment fonctionnent les objets Program de TypeScript

L'objet `Program` de TypeScript est le cœur du système de vérification de type :

1. Il maintient une collection complète de tous les `SourceFile` analysés
2. Il gère un cache de résolution de type pour accélérer les vérifications
3. Il conserve le graphe de dépendances entre les modules
4. Il stocke toutes les informations de diagnostic (erreurs/avertissements)

Un seul objet `Program` peut facilement consommer plusieurs centaines de Mo pour des bibliothèques comme RxJS, qui contiennent des centaines de fichiers avec des types génériques complexes.

### Pourquoi la mémoire n'est pas libérée

Même si JavaScript dispose d'un garbage collector (GC), celui-ci ne peut pas libérer la mémoire des objets `Program` car :

1. Ils sont constamment référencés dans le tableau `programs`
2. Ils sont retournés directement par la fonction `getModule`
3. Rollup maintient des références à ces objets pendant tout le processus de bundling

## Plan d'optimisation en 5 étapes

### Étape 1 : Extraire uniquement les données nécessaires des objets Program

```typescript
// Modification proposée pour index.ts
function getModule({ entries, programs, resolvedOptions }, fileName, code) {
  // ...
  if (existingProgram) {
    const source = existingProgram.getSourceFile(fileName)!;
    // Extraire uniquement le texte, sans conserver de référence aux objets lourds
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

Cette modification permet d'extraire uniquement le contenu textuel du fichier source, sans maintenir de références aux objets `Program` et `SourceFile` qui sont les principales sources de consommation mémoire.

### Étape 2 : Libérer les programmes après utilisation

```typescript
// Nouveau code à ajouter dans index.ts
function processFileBatch(fileNames) {
  const processedResults = [];

  for (const fileName of fileNames) {
    // Traiter le fichier avec un programme dédié
    const program = createProgram(fileName, compilerOptions, tsconfig);
    const source = program.getSourceFile(fileName)!;
    const extractedCode = source.getFullText();

    processedResults.push({
      fileName,
      code: extractedCode
    });

    // Ne pas conserver de référence au programme
    // (laisser le GC le récupérer)
  }

  // Forcer le GC explicitement après traitement du lot
  if (global.gc) {
    global.gc();
  }

  return processedResults;
}
```

Au lieu de conserver tous les programmes dans un tableau, cette approche crée un programme dédié pour chaque fichier ou lot de fichiers, extrait les données nécessaires, puis laisse le GC libérer la mémoire.

### Étape 3 : Implémenter un mécanisme de cache intelligent

```typescript
// Nouveau code à ajouter dans index.ts
class ProgramCache {
  private programs = new Map<string, ts.Program>();
  private usageCount = new Map<string, number>();
  private maxSize: number;

  constructor(maxSize = 5) {
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
          leastUsedKey = k;
          leastUsedCount = count;
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

  clear(): void {
    this.programs.clear();
    this.usageCount.clear();

    // Forcer le GC explicitement
    if (global.gc) {
      global.gc();
    }
  }
}

// Utilisation
const programCache = new ProgramCache(3); // Garder seulement 3 programmes en mémoire
```

Ce mécanisme de cache conserve uniquement un nombre limité de programmes en mémoire, en privilégiant ceux qui sont les plus fréquemment utilisés. Cela permet de réduire significativement l'empreinte mémoire tout en maintenant des performances acceptables.

### Étape 4 : Traitement incrémental par phases

```typescript
// Modification de l'approche de traitement dans le plugin
async function processIncrementally(inputs, options) {
  // Phase 1 : Analyser les fichiers d'entrée principaux
  const entryProgram = ts.createProgram(inputs, options);
  const entryFiles = entryProgram
    .getSourceFiles()
    .filter((sf) => !sf.isDeclarationFile)
    .map((sf) => sf.fileName);

  // Libérer le programme initial après extraction des fichiers
  // (aucune référence conservée)

  // Phase 2 : Traiter les fichiers par lots
  const results = [];
  const batchSize = 10;

  for (let i = 0; i < entryFiles.length; i += batchSize) {
    const batch = entryFiles.slice(i, i + batchSize);
    const batchResults = await processFileBatch(batch, options);
    results.push(...batchResults);

    // Forcer le GC après chaque lot
    if (global.gc) {
      global.gc();
    }
  }

  return results;
}
```

Cette approche divise le traitement en phases distinctes et traite les fichiers par petits lots, permettant au GC de libérer la mémoire entre chaque lot.

### Étape 5 : Utiliser des references faibles quand c'est possible

```typescript
// Utilisation de WeakMap/WeakSet où c'est possible
const fileCache = new WeakMap<ts.Program, Map<string, string>>();

function getFileContent(program: ts.Program, fileName: string): string {
  let programCache = fileCache.get(program);

  if (!programCache) {
    programCache = new Map<string, string>();
    fileCache.set(program, programCache);
  }

  if (!programCache.has(fileName)) {
    const sourceFile = program.getSourceFile(fileName);
    if (sourceFile) {
      // Extraire le contenu et le stocker dans le cache
      programCache.set(fileName, sourceFile.getFullText());
    }
  }

  return programCache.get(fileName) || "";
}
```

L'utilisation de `WeakMap` permet au GC de libérer les objets `Program` dès qu'ils ne sont plus référencés ailleurs dans le code, même s'ils sont encore présents dans la `WeakMap`.

## Bénéfices attendus

Ces optimisations devraient permettre de :

1. Réduire la consommation mémoire globale de 50-70%
2. Éviter les erreurs "out of memory" pour les bibliothèques volumineuses
3. Maintenir des performances acceptables grâce au cache intelligent
4. Permettre le traitement de fichiers en nombre illimité grâce à l'approche par lots

## Prochaines étapes d'implémentation

1. Modifier le fichier `index.ts` pour extraire uniquement le texte des fichiers
2. Ajouter le mécanisme de cache avec limite de taille
3. Refactoriser le code pour implémenter le traitement par lots
4. Ajouter des points de libération explicite de mémoire
5. Mesurer l'impact sur la consommation mémoire
