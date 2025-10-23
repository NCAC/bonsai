# Guide du Développeur - Système de Build Bonsai

Ce guide pratique explique comment utiliser, étendre et dépanner le système de build Bonsai.

## Démarrage rapide

### Commands de base

```bash
# Build complet du framework
pnpm run build

# Build sans watch mode
pnpm run build:no-watch

# Build avec nettoyage préalable
pnpm run build:clean

# Build avec logs détaillés
DEBUG=bonsai:build pnpm run build
```

### Structure d'un package

#### Package régulier

```
packages/my-package/
├── package.json          # Configuration du package
├── src/
│   └── my-package.ts     # Code source TypeScript
└── dist/                 # Fichiers générés (auto)
    ├── my-package.js
    └── my-package.d.ts
```

#### Package types-only

```
packages/types/
├── package.json          # Avec exports.types uniquement
├── src/
│   ├── index.d.ts       # Définitions de types
│   ├── utils.d.ts
│   └── class.d.ts
└── dist/                # Copie des .d.ts (auto)
    └── index.d.ts
```

## Configuration des packages

### Package.json pour package régulier

```json
{
  "name": "@bonsai/my-package",
  "version": "1.0.0",
  "main": "./dist/my-package.js",
  "types": "./dist/my-package.d.ts",
  "exports": {
    ".": {
      "import": "./dist/my-package.js",
      "require": "./dist/my-package.js",
      "types": "./dist/my-package.d.ts"
    }
  }
}
```

### Package.json pour package types-only

```json
{
  "name": "@bonsai/types",
  "version": "1.0.0",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts"
    }
  }
}
```

**Points clés pour détection types-only :**

- ✅ Uniquement le champ `"types"` dans exports
- ✅ Pas de champ `"import"` ou `"require"`
- ✅ Pas de champ `"main"` ou main pointant vers `.d.ts`

### Configuration bonsai-components.yaml

```yaml
# Bibliothèques externes (build parallèle)
libraries:
  - "@bonsai/rxjs" # Wrapper RxJS
  - "@bonsai/zod" # Wrapper Zod

# Packages internes (build séquentiel)
packages:
  - "@bonsai/types" # Types utilitaires
  - "@bonsai/event" # Système d'événements
```

**Ordre important :** Les packages sont buildés dans l'ordre de déclaration.

## Créer un nouveau package

### 1. Package régulier

```bash
# Créer la structure
mkdir -p packages/my-new-package/src

# package.json
cat > packages/my-new-package/package.json << 'EOF'
{
  "name": "@bonsai/my-new-package",
  "version": "1.0.0",
  "main": "./dist/my-new-package.js",
  "types": "./dist/my-new-package.d.ts",
  "exports": {
    ".": {
      "import": "./dist/my-new-package.js",
      "require": "./dist/my-new-package.js",
      "types": "./dist/my-new-package.d.ts"
    }
  }
}
EOF

# Code source
cat > packages/my-new-package/src/my-new-package.ts << 'EOF'
export function hello(name: string): string {
  return `Hello, ${name}!`;
}
EOF
```

### 2. Package types-only

```bash
# Créer la structure
mkdir -p packages/my-types/src

# package.json
cat > packages/my-types/package.json << 'EOF'
{
  "name": "@bonsai/my-types",
  "version": "1.0.0",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts"
    }
  }
}
EOF

# Définitions de types
cat > packages/my-types/src/index.d.ts << 'EOF'
export type MyUtilityType<T> = T & { timestamp: number };
export interface MyInterface {
  id: string;
  data: unknown;
}
EOF
```

### 3. Ajouter à la configuration

```yaml
# bonsai-components.yaml
packages:
  - "@bonsai/types"
  - "@bonsai/my-types" # Nouveau package types
  - "@bonsai/event"
  - "@bonsai/my-new-package" # Nouveau package régulier
```

## Debugging et dépannage

### Activer les logs détaillés

```bash
# Logs complets
DEBUG=bonsai:* pnpm run build

# Logs spécifiques au build
DEBUG=bonsai:build pnpm run build

# Logs très verbeux
DEBUG=bonsai:build:verbose pnpm run build
```

### Problèmes courants

#### Package non détecté comme types-only

**Symptômes :**

```
🔨 Building regular package: @bonsai/types
# Au lieu de :
📝 Package @bonsai/types detected as types-only
```

**Solutions :**

1. **Vérifier package.json :**

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts"
      // ❌ Pas de "import" ou "require"
    }
  }
}
```

2. **Vérifier les fichiers source :**

```bash
# Doit contenir uniquement des .d.ts
ls packages/types/src/
# index.d.ts  utils.d.ts  class.d.ts
```

3. **Vérifier le contenu des .ts :**

```typescript
// ✅ OK - Uniquement des types
export type MyType = string;
export interface MyInterface {}

// ❌ Problème - Contient du code
export const myVar = "value";
```

#### Erreurs de compilation TypeScript

**Diagnostic :**

```bash
# Compiler manuellement
npx tsc --noEmit packages/my-package/src/my-package.ts
```

**Solutions courantes :**

- Vérifier les imports manquants
- Corriger les erreurs de syntaxe
- Mettre à jour les types

#### Cache corrompu

**Symptômes :**

- Build qui ne prend pas en compte les modifications
- Erreurs inexpliquées

**Solution :**

```bash
# Nettoyer complètement
pnpm run build:clean
rm -rf .bonsai-cache/
pnpm run build
```

### Outils de diagnostic

#### Vérifier la configuration

```bash
# Valider le YAML
cat bonsai-components.yaml | node -e "console.log(JSON.stringify(require('js-yaml').load(require('fs').readFileSync(0, 'utf8')), null, 2))"
```

#### Tester un package isolé

```bash
# Builder un seul package (si outil disponible)
node lib/build.ts --package "@bonsai/types"
```

#### Analyser les dépendances

```bash
# Voir les dépendances d'un package
cat packages/my-package/package.json | jq '.dependencies'
```

## Workflows avancés

### Build en mode watch

```bash
# Watch mode pour développement
pnpm run build:watch

# Watch d'un package spécifique
pnpm run build:watch --package my-package
```

### Build conditionnel

```bash
# Build seulement si modifications détectées
pnpm run build:incremental

# Force rebuild d'un package
pnpm run build:force --package my-package
```

### Intégration CI/CD

```bash
# Build optimisé pour production
NODE_ENV=production pnpm run build:no-watch

# Build avec validation stricte
STRICT_BUILD=true pnpm run build
```

## Performance et optimisation

### Métriques de build

Le système affiche automatiquement :

```
🔍 Analyzing packages...
📝 Package @bonsai/types detected as types-only
⚡ Package @bonsai/rxjs is up to date (cache hit)
🔨 Building package: @bonsai/event
✅ Built @bonsai/event in 234ms
🎯 Generating flat framework .d.ts bundle...
🏁 Framework built successfully in 1.2s
```

### Optimiser les temps de build

1. **Utiliser types-only** pour les packages de définitions
2. **Éviter les rebuild inutiles** avec le cache
3. **Organiser les dépendances** pour parallélisation

### Cache strategy

```bash
# Voir l'état du cache
ls -la .bonsai-cache/

# Statistiques du cache
cat .bonsai-cache/stats.json
```

## Tests et validation

### Tester le build

```bash
# Test complet
npm test

# Test du système de build spécifiquement
npm run test:build

# Test d'un package
npm run test packages/my-package
```

### Validation post-build

```bash
# Vérifier les fichiers générés
ls -la core/dist/
ls -la packages/*/dist/

# Vérifier le bundle de types
head -20 core/dist/bonsai.d.ts
```

## Bonnes pratiques

### Nommage des packages

- **Convention :** `@bonsai/nom-package`
- **Types :** Toujours au pluriel (`@bonsai/types`)
- **Fonctionnalités :** Nom descriptif (`@bonsai/event`)

### Structure des fichiers

```
packages/nom-package/
├── README.md             # Documentation du package
├── package.json          # Configuration
├── tsconfig.json         # Config TypeScript (optionnel)
└── src/
    └── nom-package.ts    # Point d'entrée
```

### Gestion des versions

- **Semantic versioning** pour tous les packages
- **Synchronisation** des versions entre packages liés
- **Changelog** pour les modifications importantes

---

> 💡 **Conseil** : Commencez par les exemples de packages existants (`@bonsai/types`, `@bonsai/event`) pour comprendre les patterns établis.
