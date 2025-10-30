# Bonsai Build System - Developer Guide

This practical guide explains how to use, extend, and troubleshoot the Bonsai build system.

## Quick Start

### Basic Commands

```bash
# Complete framework build
pnpm run build

# Build without watch mode
pnpm run build:no-watch

# Build with prior cleanup
pnpm run build:clean

# Build with detailed logs
DEBUG=bonsai:build pnpm run build
```

### Package Structure

#### Regular Package

```
packages/my-package/
├── package.json          # Package configuration
├── src/
│   └── my-package.ts     # TypeScript source code
└── dist/                 # Generated files (auto)
    ├── my-package.js
    └── my-package.d.ts
```

#### Types-only Package

```
packages/types/
├── package.json          # With exports.types only
├── src/
│   ├── index.d.ts       # Type definitions
│   ├── utils.d.ts
│   └── class.d.ts
└── dist/                # Copy of .d.ts files (auto)
    └── index.d.ts
```

## Package Configuration

### Package.json for Regular Package

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

### Package.json for Types-only Package

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

**Key points for types-only detection:**

- ✅ Only `"types"` field in exports
- ✅ No `"import"` or `"require"` fields
- ✅ No `"main"` field or main pointing to `.d.ts`

### bonsai-components.yaml Configuration

```yaml
# External libraries (parallel build)
libraries:
  - "@bonsai/rxjs" # RxJS wrapper
  - "@bonsai/zod" # Zod wrapper

# Internal packages (sequential build)
packages:
  - "@bonsai/types" # Utility types
  - "@bonsai/event" # Event system
```

**Order matters:** Packages are built in declaration order.

## Creating a New Package

### 1. Regular Package

```bash
# Create structure
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

# Source code
cat > packages/my-new-package/src/my-new-package.ts << 'EOF'
export function hello(name: string): string {
  return `Hello, ${name}!`;
}
EOF
```

### 2. Types-only Package

```bash
# Create structure
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

# Type definitions
cat > packages/my-types/src/index.d.ts << 'EOF'
export type MyUtilityType<T> = T & { timestamp: number };
export interface MyInterface {
  id: string;
  data: unknown;
}
EOF
```

### 3. Add to Configuration

```yaml
# bonsai-components.yaml
packages:
  - "@bonsai/types"
  - "@bonsai/my-types" # New types package
  - "@bonsai/event"
  - "@bonsai/my-new-package" # New regular package
```

## Debugging and Troubleshooting

### Enable Detailed Logs

```bash
# Complete logs
DEBUG=bonsai:* pnpm run build

# Build-specific logs
DEBUG=bonsai:build pnpm run build

# Very verbose logs
DEBUG=bonsai:build:verbose pnpm run build
```

### Common Issues

#### Package Not Detected as Types-only

**Symptoms:**

```
🔨 Building regular package: @bonsai/types
# Instead of:
📝 Package @bonsai/types detected as types-only
```

**Solutions:**

1. **Check package.json:**

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts"
      // ❌ No "import" or "require"
    }
  }
}
```

2. **Check source files:**

```bash
# Should contain only .d.ts files
ls packages/types/src/
# index.d.ts  utils.d.ts  class.d.ts
```

3. **Check .ts content:**

```typescript
// ✅ OK - Only types
export type MyType = string;
export interface MyInterface {}

// ❌ Problem - Contains code
export const myVar = "value";
```

#### TypeScript Compilation Errors

**Diagnosis:**

```bash
# Manually compile
npx tsc --noEmit packages/my-package/src/my-package.ts
```

**Common solutions:**

- Check missing imports
- Fix syntax errors
- Update types

#### Corrupted Cache

**Symptoms:**

- Build not picking up modifications
- Unexplained errors

**Solution:**

```bash
# Clean completely
pnpm run build:clean
rm -rf .bonsai-cache/
pnpm run build
```

### Diagnostic Tools

#### Validate Configuration

```bash
# Validate YAML
cat bonsai-components.yaml | node -e "console.log(JSON.stringify(require('js-yaml').load(require('fs').readFileSync(0, 'utf8')), null, 2))"
```

#### Test Isolated Package

```bash
# Build single package (if tool available)
node lib/build.ts --package "@bonsai/types"
```

#### Analyze Dependencies

```bash
# See package dependencies
cat packages/my-package/package.json | jq '.dependencies'
```

## Advanced Workflows

### Build in Watch Mode

```bash
# Watch mode for development
pnpm run build:watch

# Watch specific package
pnpm run build:watch --package my-package
```

### Conditional Build

```bash
# Build only if modifications detected
pnpm run build:incremental

# Force rebuild of a package
pnpm run build:force --package my-package
```

### CI/CD Integration

```bash
# Production-optimized build
NODE_ENV=production pnpm run build:no-watch

# Build with strict validation
STRICT_BUILD=true pnpm run build
```

## Performance and Optimization

### Build Metrics

The system automatically displays:

```
🔍 Analyzing packages...
📝 Package @bonsai/types detected as types-only
⚡ Package @bonsai/rxjs is up to date (cache hit)
🔨 Building package: @bonsai/event
✅ Built @bonsai/event in 234ms
🎯 Generating flat framework .d.ts bundle...
🏁 Framework built successfully in 1.2s
```

### Optimize Build Times

1. **Use types-only** for definition packages
2. **Avoid unnecessary rebuilds** with cache
3. **Organize dependencies** for parallelization

### Cache Strategy

```bash
# See cache status
ls -la .bonsai-cache/

# Cache statistics
cat .bonsai-cache/stats.json
```

## Testing and Validation

### Test Build

```bash
# Complete test
npm test

# Test build system specifically
npm run test:build

# Test a package
npm run test packages/my-package
```

### Post-build Validation

```bash
# Check generated files
ls -la core/dist/
ls -la packages/*/dist/

# Check types bundle
head -20 core/dist/bonsai.d.ts
```

## Best Practices

### Package Naming

- **Convention:** `@bonsai/package-name`
- **Types:** Always plural (`@bonsai/types`)
- **Features:** Descriptive name (`@bonsai/event`)

### File Structure

```
packages/package-name/
├── README.md             # Package documentation
├── package.json          # Configuration
├── tsconfig.json         # TypeScript config (optional)
└── src/
    └── package-name.ts   # Entry point
```

### Version Management

- **Semantic versioning** for all packages
- **Synchronization** of versions between related packages
- **Changelog** for important modifications

---

> 💡 **Tip:** Start with existing package examples (`@bonsai/types`, `@bonsai/event`) to understand established patterns.
