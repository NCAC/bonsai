# 🚀 Guide de Démarrage Rapide - Framework Bonsai

## Pré-requis

- **Node.js 23+**
- **pnpm** (gestionnaire de paquets recommandé)
- **VS Code** avec Dev Container (recommandé)

## Installation et Configuration

### Option 1: Avec Dev Container (Recommandé)

1. **Cloner le repository** :

```bash
git clone https://github.com/NCAC/bonsai.git
cd bonsai
```

2. **Ouvrir avec VS Code** :

```bash
code .
```

3. **Utiliser Dev Container** : VS Code vous proposera d'ouvrir dans un container, acceptez.

4. **Le container configure automatiquement** :
   - Node.js 23
   - pnpm dernière version
   - Extensions VS Code optimisées
   - Environnement de développement complet

### Option 2: Installation locale

1. **Installer les dépendances** :

```bash
pnpm install
```

2. **Build initial** :

```bash
pnpm run build:no-watch
```

## Structure du Projet

```
bonsai/
├── core/                   # Framework core (point d'entrée)
├── packages/               # Packages individuels
│   ├── entity/            # Entity abstraite (mutate, state)
│   ├── event/             # Système Channel tri-lane + Radio
│   ├── immer/             # Wrapper Immer (Tier 3 opaque)
│   ├── types/             # Types utilitaires
│   ├── rxjs/              # Intégration RxJS
│   ├── valibot/           # Validation Entity (ADR-0022)
│   ├── remeda/            # Utilities fonctionnelles
│   └── zod/               # Validation schémas
├── lib/                   # Système de build
├── tests/                 # Suites de tests
├── docs/                  # Documentation (FR — voir ADR-0036)
│   ├── rfc/              # Spécifications (le QUOI)
│   ├── adr/              # Décisions architecturales (le POURQUOI)
│   └── guides/           # Conventions (le COMMENT)
└── .github/agents/        # Agents conversationnels
```

## Commandes Principales

### Build et Développement

```bash
# Build avec watch mode (développement)
pnpm run build

# Build sans watch (CI/production)
pnpm run build:no-watch

# Build avec nettoyage préalable
pnpm run build:clean
```

### Tests

```bash
# Tous les tests
pnpm test

# Tests en mode watch
pnpm run test:watch

# Tests avec couverture
pnpm run test:coverage

# Tests par type
pnpm run test:unit
pnpm run test:integration
pnpm run test:e2e
```

## Workflow de Développement

### 1. Développement d'un nouveau package

1. **Créer la structure** :

```bash
mkdir -p packages/mon-package/src
cd packages/mon-package
```

2. **Créer package.json** :

```json
{
  "name": "@bonsai/mon-package",
  "version": "0.1.0",
  "main": "dist/mon-package.js",
  "types": "dist/mon-package.d.ts",
  "scripts": {
    "build": "echo 'Built by framework build system'"
  }
}
```

3. **Créer le code source** dans `src/mon-package.ts`

4. **Écrire les tests** dans `/tests/unit/mon-package.test.ts`

5. **Build** : Le système de build détecte automatiquement le nouveau package

### 2. TDD (Test-Driven Development)

1. **Écrire le test d'abord** :

```typescript
// tests/unit/ma-feature.test.ts
describe("MaFeature", () => {
  it("should do something", () => {
    // Test qui échoue initialement
    expect(new MaFeature().method()).toBe("expected");
  });
});
```

2. **Lancer le test** (il doit échouer) :

```bash
pnpm run test:watch
```

3. **Implémenter le code minimum** pour passer le test

4. **Refactoriser** tout en maintenant les tests verts

### 3. Debugging et Logs

- **Build logs détaillés** :

```bash
DEBUG=bonsai:build pnpm run build
```

- **Logs par composant** :

```bash
DEBUG=bonsai:cache pnpm run build  # Cache uniquement
DEBUG=bonsai:* pnpm run build      # Tous les logs
```

## Architecture et Patterns

### Communication via Channels

```typescript
import { Radio } from "@bonsai/event";

// Obtenir un channel
const userChannel = Radio.channel<UserEvents>("user");

// Publier un événement
userChannel.trigger("user:login", { userId: "123" });

// S'abonner à un événement
userChannel.on("user:login", (data) => {
  console.log("User logged in:", data.userId);
});

// Request/Reply pattern
const result = await userChannel.request("user:getData", { userId: "123" });
```

### Entities et State

```typescript
// Entity : structure de données pure
class UserEntity {
  constructor(
    public id: string,
    public name: string,
    public email: string
  ) {}
}

// Feature : logique métier et cycle de vie des entities
class UserFeature {
  private users = new Map<string, UserEntity>();

  createUser(data: CreateUserData): UserEntity {
    const user = new UserEntity(data.id, data.name, data.email);
    this.users.set(user.id, user);

    // Notifier via channel
    Radio.channel("user").trigger("user:created", user);

    return user;
  }
}
```

## Prochaines Étapes

1. **Finaliser les composants core** : Application, Feature, Entity classes abstraites
2. **Améliorer le build system** : buildFramework() complet
3. **Étendre la documentation** : API reference, exemples avancés
4. **Créer des exemples** : Applications de démonstration

## Ressources

- 📖 [Documentation complète](/docs/)
- 🏗️ [Guide du Build System](/lib/DEVELOPER-GUIDE.md)
- 🧪 [Guide des Tests](/tests/README.md)
- 🤖 [Agent de Développement](/.github/agents/dev-framework.agent.md)

---

_Pour obtenir de l'aide, utilisez l'agent conversationnel spécialisé ou consultez la documentation dans `/docs/`_
