# 🤝 Guide de Contribution - Framework Bonsai

## Bienvenue !

Merci de votre intérêt pour contribuer au Framework Bonsai ! Ce guide vous explique comment participer efficacement au développement.

## 📋 Table des Matières

1. [Code de Conduite](#code-de-conduite)
2. [Types de Contributions](#types-de-contributions)
3. [Workflow de Développement](#workflow-de-développement)
4. [Standards de Code](#standards-de-code)
5. [Tests et Qualité](#tests-et-qualité)
6. [Documentation](#documentation)
7. [Review Process](#review-process)

---

## Code de Conduite

- **Respectueux** : Traiter tous les contributeurs avec respect
- **Constructif** : Fournir des critiques constructives
- **Collaboratif** : Favoriser la collaboration et l'entraide
- **Inclusif** : Accueillir tous les niveaux d'expérience

---

## Types de Contributions

### 🐛 Bug Reports
- Utiliser les templates d'issue GitHub
- Fournir des étapes de reproduction claires
- Inclure la version de Node.js/TypeScript/navigateur
- Joindre les logs d'erreur complets

### ✨ Feature Requests
- Expliquer le cas d'usage et la motivation
- Proposer une API ou interface
- Vérifier que cela s'aligne avec la philosophie Bonsai
- Discuter dans une issue avant l'implémentation

### 📖 Documentation
- Améliorer la clarté et les exemples
- Corriger les erreurs et typos
- Ajouter des cas d'usage pratiques
- Traduire en différentes langues

### 🔧 Code Contributions
- Nouvelles features
- Bug fixes
- Optimisations performance
- Refactoring et amélioration de l'architecture

---

## Workflow de Développement

### 1. Setup Initial

```bash
# Fork et clone
git clone https://github.com/VOTRE-USERNAME/bonsai.git
cd bonsai

# Configuration upstream
git remote add upstream https://github.com/NCAC/bonsai.git

# Installation
pnpm install

# Vérification de l'environnement
pnpm test
pnpm run build
```

### 2. Créer une Branche

```bash
# Synchroniser avec upstream
git checkout main
git pull upstream main

# Créer une branche feature
git checkout -b feature/ma-nouvelle-fonctionnalite

# Ou pour un bug fix
git checkout -b fix/correction-bug-123
```

### 3. Conventions de Nommage des Branches

| Type | Format | Exemple |
|------|--------|---------|
| Feature | `feature/description-courte` | `feature/entity-validation` |
| Bug Fix | `fix/description-courte` | `fix/channel-memory-leak` |
| Documentation | `docs/description-courte` | `docs/api-reference-update` |
| Refactoring | `refactor/description-courte` | `refactor/build-system-optimization` |
| Tests | `test/description-courte` | `test/feature-integration-tests` |

### 4. Développement TDD

**Suivre strictement l'approche Test-Driven Development** :

```bash
# 1. Écrire le test (qui échoue)
vim tests/unit/ma-feature.test.ts

# 2. Lancer les tests
pnpm run test:watch

# 3. Écrire le code minimum pour passer le test
vim packages/mon-package/src/ma-feature.ts

# 4. Refactoriser tout en gardant les tests verts
```

### 5. Commit Guidelines

#### Format des Commits (Convention Conventional Commits)

```
<type>(<scope>): <description>

<body optionnel>

<footer optionnel>
```

**Types autorisés** :
- `feat`: nouvelle fonctionnalité
- `fix`: correction de bug
- `docs`: documentation uniquement
- `style`: formatage, point-virgules manquants, etc.
- `refactor`: refactoring sans changement de comportement
- `test`: ajout ou modification de tests
- `chore`: maintenance, dépendances, build
- `perf`: amélioration de performance
- `ci`: configuration CI/CD

**Exemples** :
```bash
feat(event): add request timeout handling to Channel class

fix(build): resolve TypeScript compilation errors in framework bundling

docs(api): update Feature class documentation with examples

test(radio): add comprehensive tests for channel lifecycle management
```

### 6. Pull Request Process

#### Avant de Soumettre

```bash
# Vérifier que tout fonctionne
pnpm run build
pnpm run test
pnpm run test:coverage

# Linter et formatage
pnpm run lint:fix
pnpm run format

# Mise à jour avec upstream
git fetch upstream
git rebase upstream/main
```

#### Template de Pull Request

```markdown
## Description
Brève description des changements apportés.

## Type de changement
- [ ] Bug fix (changement non-breaking qui corrige un problème)
- [ ] Nouvelle fonctionnalité (changement non-breaking qui ajoute une fonctionnalité)
- [ ] Breaking change (correction ou fonctionnalité qui casserait la compatibilité)
- [ ] Documentation uniquement

## Tests
- [ ] Tests unitaires ajoutés/modifiés
- [ ] Tests d'intégration ajoutés/modifiés
- [ ] Couverture de code maintenue/améliorée
- [ ] Tous les tests passent

## Checklist
- [ ] Code suit les standards du projet
- [ ] Documentation mise à jour si nécessaire
- [ ] Changements testés localement
- [ ] Pas de conflits avec main
- [ ] Commits suivent les conventions
```

---

## Standards de Code

### TypeScript Configuration

**Utiliser la configuration stricte** définie dans `tsconfig.json` :

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### Style de Code

#### Classes et Interfaces

```typescript
// ✅ Bon
abstract class UserFeature extends Feature<UserEntity> {
  private readonly users = new Map<string, UserEntity>();
  
  constructor() {
    super('user');
  }
  
  protected setupEventHandlers(): void {
    this.channel.on('user:create', this.handleUserCreate.bind(this));
  }
  
  private handleUserCreate(data: CreateUserData): void {
    // Implementation
  }
}

// ❌ Mauvais
class userfeature {
  users: any;
  
  constructor() {
    // pas de typage, pas de structure claire
  }
}
```

#### Nommage

```typescript
// Classes : PascalCase
class UserEntity extends Entity { }
class TaskFeature extends Feature { }

// Interfaces : PascalCase avec 'I' optionnel
interface UserEvents { }
interface IEventHandler { } // acceptable aussi

// Variables et fonctions : camelCase
const userChannel = Radio.channel('user');
function handleUserLogin() { }

// Constants : SCREAMING_SNAKE_CASE
const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_TIMEOUT = 5000;

// Types : PascalCase
type EventHandler<T> = (data: T) => void;
```

#### Imports/Exports

```typescript
// ✅ Imports organisés
// 1. Node modules
import { Observable } from 'rxjs';
import { z } from 'zod';

// 2. Framework internal
import { Feature } from '@bonsai/core';
import { Channel, Radio } from '@bonsai/event';

// 3. Relatifs
import { UserEntity } from './user.entity';
import { UserEvents } from '../types';

// ✅ Exports explicites
export { UserFeature } from './user.feature';
export type { UserEvents, CreateUserData } from './types';

// ❌ Export default évité (sauf cas spéciaux)
export default UserFeature; // Éviter
```

### Documentation du Code

#### JSDoc pour l'API Publique

```typescript
/**
 * Feature responsible for user management and authentication.
 * 
 * Handles user lifecycle, authentication, and profile management
 * through a centralized event system.
 * 
 * @example
 * ```typescript
 * const userFeature = new UserFeature();
 * await userFeature.initialize();
 * 
 * // Create user through channel
 * const userChannel = Radio.channel<UserEvents>('user');
 * userChannel.trigger('user:create', {
 *   name: 'John Doe',
 *   email: 'john@example.com'
 * });
 * ```
 */
class UserFeature extends Feature<UserEntity> {
  /**
   * Creates a new user entity and manages its lifecycle.
   * 
   * @param userData - User creation data
   * @returns Promise resolving to the created user entity
   * @throws {ValidationError} When user data is invalid
   */
  async createUser(userData: CreateUserData): Promise<UserEntity> {
    // Implementation
  }
}
```

---

## Tests et Qualité

### Structure des Tests

```
/tests/
├── unit/                  # Tests unitaires (composants isolés)
│   ├── channel.test.ts
│   └── user.feature.test.ts
├── integration/           # Tests d'intégration (plusieurs composants)
│   ├── feature-channel.test.ts
│   └── application-flow.test.ts
├── e2e/                   # Tests end-to-end (workflow complet)
│   └── user-journey.test.ts
├── fixtures/              # Données de test réutilisables
│   └── user-data.ts
└── helpers/               # Utilitaires de test
    └── test-utils.ts
```

### Standards de Tests

#### Tests Unitaires

```typescript
describe('UserFeature', () => {
  let userFeature: UserFeature;
  let mockChannel: jest.Mocked<Channel<UserEvents>>;
  
  beforeEach(() => {
    // Setup propre pour chaque test
    Radio.destroy();
    userFeature = new UserFeature();
    mockChannel = Radio.channel('user') as jest.Mocked<Channel<UserEvents>>;
  });
  
  afterEach(() => {
    // Nettoyage après chaque test
    userFeature.destroy();
  });
  
  describe('createUser', () => {
    it('should create user with valid data', async () => {
      // Arrange
      const userData = {
        name: 'John Doe',
        email: 'john@example.com'
      };
      
      // Act
      const result = await userFeature.createUser(userData);
      
      // Assert
      expect(result).toBeInstanceOf(UserEntity);
      expect(result.name).toBe(userData.name);
      expect(result.email).toBe(userData.email);
      expect(mockChannel.trigger).toHaveBeenCalledWith(
        'user:created', 
        expect.any(UserEntity)
      );
    });
    
    it('should reject invalid email format', async () => {
      // Arrange
      const invalidData = {
        name: 'John Doe',
        email: 'invalid-email'
      };
      
      // Act & Assert
      await expect(userFeature.createUser(invalidData))
        .rejects
        .toThrow('Invalid email format');
    });
  });
});
```

### Couverture de Code

**Objectifs de couverture** :
- **Components Core** : 100%
- **Features** : 95%+
- **Utilities** : 90%+
- **Global** : 90%+

```bash
# Vérifier la couverture
pnpm run test:coverage

# Générer un rapport détaillé
pnpm run test:coverage -- --verbose
```

### Performance Testing

```typescript
describe('Channel Performance', () => {
  it('should handle 1000 events under 100ms', async () => {
    const channel = Radio.channel('perf-test');
    const events: any[] = [];
    
    channel.on('test-event', (data) => events.push(data));
    
    const start = performance.now();
    
    for (let i = 0; i < 1000; i++) {
      channel.trigger('test-event', { id: i });
    }
    
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(100);
    expect(events).toHaveLength(1000);
  });
});
```

---

## Documentation

### Types de Documentation

1. **API Reference** (`/docs/API-REFERENCE.md`)
2. **Architecture Guide** (`/docs/SUMMARY.md`)
3. **Developer Guide** (`/lib/DEVELOPER-GUIDE.md`)
4. **Quick Start** (`/QUICK-START.md`)
5. **Exemples pratiques** (`/examples/`)

### Standards de Documentation

#### Structure Markdown

```markdown
# Titre Principal (H1)

## Section Principale (H2)

### Sous-section (H3)

#### Détail (H4)

## Code Examples

```typescript
// Exemple avec commentaires explicatifs
const channel = Radio.channel<UserEvents>('user');

// S'abonner aux événements
channel.on('user:login', (data) => {
  console.log('User logged in:', data);
});
```

## Notes et Warnings

> ⚠️ **Important**: Cette API est expérimentale

> 💡 **Tip**: Utilisez les types pour une meilleure DX

> 📝 **Note**: Voir la documentation API pour plus de détails
```

---

## Review Process

### Critères de Review

#### Code Quality
- [ ] Code suit les standards TypeScript
- [ ] Nommage cohérent et expressif
- [ ] Pas de code dupliqué
- [ ] Architecture respectée (patterns Bonsai)
- [ ] Performance acceptable

#### Tests
- [ ] Tests TDD écrits en premier
- [ ] Couverture de code satisfaisante
- [ ] Tests unitaires ET d'intégration
- [ ] Edge cases couverts
- [ ] Tests de régression si bug fix

#### Documentation
- [ ] JSDoc pour API publique
- [ ] README mis à jour si nécessaire
- [ ] Exemples pratiques inclus
- [ ] Breaking changes documentés

#### Compatibility
- [ ] Pas de breaking changes non documentés
- [ ] Rétro-compatibilité préservée
- [ ] Migration guide si nécessaire

### Timeline de Review

- **Response initiale** : 24-48h
- **Review détaillée** : 3-5 jours ouvrés
- **Iterations** : 1-2 jours par round
- **Merge** : Après approbation de 2 reviewers

---

## Ressources Utiles

### Documentation
- 📖 [Architecture du Framework](/docs/SUMMARY.md)
- 🔧 [Guide du Build System](/lib/DEVELOPER-GUIDE.md)
- 🤖 [Agent de Développement](/.github/agents/dev-framework.agent.md)

### Outils
- **IDE**: VS Code avec Dev Container recommandé
- **Testing**: Jest avec couverture de code
- **Linting**: ESLint + Prettier
- **CI/CD**: GitHub Actions

### Communication
- **Issues**: Pour bugs et feature requests
- **Discussions**: Pour questions générales
- **PR Reviews**: Pour feedback sur le code

---

## Remerciements

Merci à tous les contributeurs qui font évoluer le Framework Bonsai ! Votre travail aide à créer un framework plus robuste et plus utile pour la communauté.

**Happy coding! 🌱**