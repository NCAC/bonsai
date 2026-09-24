# Bonsai Build System

This document describes the architecture and operation of the Bonsai framework build system.

## Overview

The Bonsai build system is designed to automatically and intelligently handle two types of packages:

1. **Regular packages**: Contain executable JavaScript/TypeScript code
2. **Types-only packages**: Contain only TypeScript type definitions (`.d.ts` files)

### Architecture

```
lib/build/
├── core/                    # Core classes
│   ├── path-manager.class.ts    # Path management
│   └── build-cache.class.ts
├── initializing/            # Initialization phase
│   ├── build-options.class.ts
│   └── components-registry.ts   # Package analysis and detection
├── building/                # Compilation phase
│   ├── build-orchestrator.class.ts  # Scheduling (topological sort, parallelism)
│   ├── builder.class.ts         # Per-package build: JS pass then DTS pass
│   └── dts-config.ts            # rollup-plugin-dts config + post-processing
├── cache/                   # PackageCache, LibraryCache
├── plugins/                 # rollup-plugin-postprocess
├── utils/
├── monitoring/              # Monitoring tools
│   └── logger.class.ts          # Logging system
└── __poc__/                 # ADR-29 PoC (historical, no longer passes)
```

## Configuration

The `bonsai-components.yaml` file defines packages to build:

```yaml
# External libraries (built in parallel)
libraries:
  - "@bonsai/rxjs"

# Internal packages (with possible dependencies)
packages:
  - "@bonsai/types"
  - "@bonsai/event"
```

## Automatic types-only package detection

The system automatically detects if a package contains only types through several criteria:

### 1. `package.json` analysis

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

**Detection criteria:**

- The `exports` field only contains `"types"` (no `"import"` or `"require"`)
- The `main` field is absent or points to a `.d.ts` file
- The `types` field is present

### 2. Source content analysis

The system examines the `src/` folder:

- Only `.d.ts` files present
- Or `.ts` files containing only type/interface exports

```typescript
// ✅ Types-only - Only type exports
export type MyType = string;
export interface MyInterface {}

// ❌ Not types-only - Contains executable code
export const myVariable = "value";
export function myFunction() {}
```

## Build process

### 1. Initialization phase (`ComponentsRegistry`)

```typescript
const components = await collectComponents();
// Result:
{
  framework: TFramework,
  libraries: TPackage[],
  packages: TPackage[],
  allPackages: Set<TPackage>
}
```

### 2. Compilation phase (`Builder`)

For each package, the builder determines the appropriate strategy:

```typescript
async buildPackage(package: TPackage): Promise<void> {
  if (package.isTypesOnly) {
    await this.buildTypesOnlyPackage(package);
  } else {
    await this.buildRegularPackage(package);
  }
}
```

#### Regular build (with Rollup)

- TypeScript → JavaScript compilation
- Bundling with Rollup
- Generation of `.js` and `.d.ts` files

#### Types-only build (direct copy)

- Copy `.d.ts` files from `src/` to `dist/`
- No JavaScript compilation
- Much faster

### 3. Bundling phase

Generation of the final framework bundle (`core/dist/bonsai.d.ts`) with:

- **`tsc --emitDeclarationOnly`**: one `.d.ts` per source file, in `.dts-temp/`
- **`rollup` + `rollup-plugin-dts`**: a single flat `bonsai.d.ts`, `external: []` — everything inlined, no transitive dependency (ADR-29)
- **Post-processing**: triple-slash directives removed, third-party namespaces renamed (`Valibot`…)

```typescript
// Instead of:
import { MyType } from "@bonsai/types";

// Directly:
import { MyType } from "bonsai";
```

## System advantages

### Performance

- **Incremental build**: Only modified packages are rebuilt
- **Parallelization**: Libraries are built in parallel
- **Types-only optimization**: No unnecessary compilation for pure types

### Maintainability

- **Automatic detection**: No manual configuration needed
- **Detailed logs**: Precise build process tracking
- **Error handling**: Clear problem reporting

### Flexibility

- **Multiple strategies**: Automatic adaptation based on package type
- **YAML configuration**: Simple dependency management
- **Extensibility**: Modular architecture for future additions

## Build logs

The system provides detailed logs:

```
📝 Package @bonsai/types detected as types-only
🔨 Building types-only package: @bonsai/types
✅ Types-only package @bonsai/types built successfully
🎯 Generating flat framework .d.ts bundle...
```

## Troubleshooting

### Package not detected as types-only

Check:

1. The `package.json` structure
2. The `src/` folder content
3. Detection logs

### Compilation errors

TypeScript errors are reported with:

- Affected file
- Line and column
- Detailed error message

### Type conflicts

The deduplication system automatically avoids conflicts, but in case of issues:

1. Check for unique type names
2. Review bundling logs
3. Examine the generated `core/dist/bonsai.d.ts` file

## Extending the system

To add a new package type:

1. Extend the `TPackage` type in `build.type.ts`
2. Add detection logic in `ComponentsRegistry`
3. Implement build strategy in `Builder`
4. Update bundling phase if necessary

---

> 💡 **Note**: This system is optimized for the specific needs of the Bonsai framework. It prioritizes simplicity and automation for an optimal developer experience.
