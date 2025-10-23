# Guide de test — `@bonsai/testing`

> ⚠️ **Package non implémenté** — `@bonsai/testing` est spécifié dans ce guide
> mais n'existe pas encore en tant que package publiable. Les API décrites ci-dessous
> sont le **contrat cible** ; l'implémentation suivra avec le framework core.

> **Absorbé depuis** : [ADR-0006](../adr/ADR-0006-testing-strategy.md) (Accepted).
> Ce document fait foi pour la stratégie de test officielle de Bonsai.

---

| Champ | Valeur |
|-------|--------|
| **Statut** | 🟢 Normatif |
| **Créé le** | 2026-03-26 |
| **ADR source** | [ADR-0006](../adr/ADR-0006-testing-strategy.md) |

---

## 📋 Table des matières

1. [Principes de test](#1-principes-de-test)
2. [Package `@bonsai/testing`](#2-package-bonsaitesting)
3. [Test d'une Entity (unitaire)](#3-test-dune-entity-unitaire)
4. [Test d'une Feature (unitaire avec mocks)](#4-test-dune-feature-unitaire-avec-mocks)
5. [Test d'une View (unitaire avec DOM simulé)](#5-test-dune-view-unitaire-avec-dom-simulé)
6. [Tests d'intégration (multi-Features)](#6-tests-dintégration-multi-features)
7. [Contract Testing (optionnel)](#7-contract-testing-optionnel)
8. [Conventions et bonnes pratiques](#8-conventions-et-bonnes-pratiques)

---

## 1. Principes de test

### Testabilité par design

Chaque composant Bonsai est **testable en isolation** grâce à l'architecture déclarative :

| Composant | Dépendances | Difficulté | Stratégie |
|-----------|-------------|------------|-----------|
| **Entity** | Aucune (ou Immer) | Basse | Test unitaire direct |
| **Feature** | Entity, Channel (`listen`, `request`) | Moyenne | `createTestFeature()` avec channels mockés |
| **Channel** | Radio (interne) | Basse | Rarement testé directement |
| **View** | DOM, Channels | Élevée | `createTestView()` avec DOM simulé |
| **Behavior** | DOM, View hôte, Channels | Élevée | `createTestView()` du View hôte |
| **Composer** | Channels, Views | Moyenne | Test d'intégration |
| **Intégration** | Tout | Élevée | `createTestApp()` |

### Écosystème

- **Test runner** : [Vitest](https://vitest.dev/) (recommandé) ou [Jest](https://jestjs.io/)
- **DOM** : [jsdom](https://github.com/jsdom/jsdom) ou [happy-dom](https://github.com/nicedayfor/happy-dom) pour CI
- **Patterns** : inspirés de [Testing Library](https://testing-library.com/) (accessibilité, user-centric)

### Objectifs de performance

| Type de test | Temps max | Quantité type |
|-------------|-----------|---------------|
| Unitaire (Entity) | < 10 ms | Nombreux |
| Unitaire (Feature) | < 50 ms | Nombreux |
| Unitaire (View) | < 100 ms | Moyen |
| Intégration | < 500 ms | Peu |

---

## 2. Package `@bonsai/testing`

Le framework fournit un **package dédié** avec des helpers officiels :

```
packages/
├── bonsai/                 # Core framework
└── bonsai-testing/         # Test utilities
    ├── src/
    │   ├── feature.ts      # createTestFeature()
    │   ├── view.ts         # createTestView()
    │   ├── channel.ts      # MockChannel, createMockChannel()
    │   ├── app.ts          # createTestApp()
    │   ├── contracts.ts    # contractTest()
    │   └── index.ts
    └── package.json
```

### Imports

```typescript
import {
  createTestFeature,
  createTestView,
  createTestApp,
  MockChannel,
  contractTest,
  userEvent,
} from '@bonsai/testing';
```

---

## 3. Test d'une Entity (unitaire)

Les Entities sont des structures de données encapsulées. On teste leurs **queries** (lecture)
et leurs **mutations** via `mutate()` (ADR-0001 — unique API de mutation) :

```typescript
import { createTestFeature } from '@bonsai/testing';

describe('CartEntity', () => {
  it('should add item via mutate()', () => {
    // L'Entity se teste via la Feature qui l'encapsule (I5, I6)
    const { feature } = createTestFeature(CartFeature, {
      initialState: { items: [] },
    });

    feature.entity.mutate('cart:addItem', { id: '1', name: 'Product' }, (draft) => {
      draft.items.push({ id: '1', name: 'Product', price: 0 });
    });

    expect(feature.entity.query((s) => s.items)).toHaveLength(1);
  });

  it('should calculate total via query', () => {
    const { feature } = createTestFeature(CartFeature, {
      initialState: {
        items: [{ price: 10 }, { price: 20 }],
      },
    });

    expect(feature.entity.query((s) =>
      s.items.reduce((sum, item) => sum + item.price, 0)
    )).toBe(30);
  });
});
```

> **⚠️ Anti-pattern** : Ne jamais appeler de méthodes de mutation nommées directement sur
> l'Entity (`entity.addItem()`). Seule `mutate(intent, params?, recipe)` est autorisée (ADR-0001).

---

## 4. Test d'une Feature (unitaire avec mocks)

`createTestFeature()` crée une instance isolée avec channels mockés automatiquement :

```typescript
import { createTestFeature } from '@bonsai/testing';

describe('CartFeature', () => {
  it('should emit itemAdded on addItem command', async () => {
    const { feature, emitted } = createTestFeature(CartFeature);

    await feature.handle('cart:addItem', { productId: '1' });

    expect(emitted('cart:itemAdded')).toHaveBeenCalledOnce();
  });

  it('should request price from pricing channel', async () => {
    const { feature, channels } = createTestFeature(CartFeature);
    channels.pricing.mockReply('pricing:getPrice', 99);

    await feature.handle('cart:addItem', { productId: '1' });

    expect(channels.pricing.requested('pricing:getPrice')).toHaveBeenCalled();
    expect(feature.state.items[0].price).toBe(99);
  });

  it('should handle addItem with initial state', async () => {
    const { feature, emitted } = createTestFeature(CartFeature, {
      initialState: { items: [{ productId: '0', qty: 1, price: 10 }] }
    });

    await feature.handle('cart:addItem', { productId: '1', qty: 2 });

    expect(feature.state.items).toHaveLength(2);
    expect(emitted('cart:itemAdded')).toHaveBeenCalledWith(
      expect.objectContaining({ productId: '1' })
    );
  });
});
```

### API `createTestFeature()`

```typescript
function createTestFeature<TFeature extends Feature>(
  FeatureClass: new (...args: any[]) => TFeature,
  options?: {
    /** État initial de l'Entity (optionnel) */
    initialState?: Partial<TFeature['entity']['state']>;
    /** Mock automatique des channels déclarés (défaut: true) */
    mockChannels?: boolean;
  }
): {
  /** Instance de la Feature */
  feature: TFeature;
  /** Channels mockés, indexés par namespace */
  channels: Record<string, MockChannel>;
  /** Assertion helper : vérifie qu'un Event a été émis */
  emitted(eventName: string): ReturnType<typeof vi.fn>;
};
```

### API `MockChannel`

```typescript
class MockChannel<TDef extends TChannelDefinition> {
  /** Configure une réponse mockée pour un Request */
  mockReply<K extends keyof TDef['requests']>(
    name: K,
    response: TDef['requests'][K]['response']
  ): void;

  /** Assertion : vérifie qu'un Request a été envoyé */
  requested(name: string): ReturnType<typeof vi.fn>;

  /** Simule l'émission d'un Event (pour tester les listeners) */
  simulateEvent(name: string, payload: unknown): Promise<void>;
}
```

---

## 5. Test d'une View (unitaire avec DOM simulé)

`createTestView()` crée un DOM simulé et câble les channels :

```typescript
import { createTestView, userEvent } from '@bonsai/testing';

describe('CartView', () => {
  it('should trigger addItem on button click', async () => {
    const { element, triggered } = createTestView(CartView, {
      html: '<div id="cart"><button data-ui="addBtn">Add</button></div>',
      mockChannels: true
    });

    await userEvent.click(element.querySelector('[data-ui="addBtn"]'));

    expect(triggered('cart:addItem')).toHaveBeenCalled();
  });

  it('should update on itemAdded event', async () => {
    const { element, simulateEvent } = createTestView(CartView);

    await simulateEvent('cart:itemAdded', { item: { name: 'Product' } });

    expect(element.querySelector('.item')).toHaveTextContent('Product');
  });

  it('should trigger removeItem on click', async () => {
    const { element, triggered, simulateEvent } = createTestView(CartView);
    await simulateEvent('cart:itemAdded', { item: { id: '1', name: 'Product' } });

    await userEvent.click(element.querySelector('.remove-btn'));

    expect(triggered('cart:removeItem')).toHaveBeenCalledWith({ itemId: '1' });
  });
});
```

---

## 6. Tests d'intégration (multi-Features)

`createTestApp()` crée une application complète pour tester la chorégraphie :

```typescript
import { createTestApp } from '@bonsai/testing';

describe('Cart + Pricing integration', () => {
  it('should update total when item added', async () => {
    const { features, views } = createTestApp({
      features: [CartFeature, PricingFeature],
      views: [CartView]
    });

    await features.cart.handle('cart:addItem', { productId: '1' });

    // La chorégraphie complète s'exécute
    expect(features.cart.state.total).toBe(99);
    expect(views.cart.element).toHaveTextContent('Total: 99');
  });
});
```

> **Attention** : les tests d'intégration sont plus lents et plus fragiles.
> Préférer les tests unitaires Feature pour la logique métier.

---

## 7. Contract Testing (optionnel)

`contractTest()` génère automatiquement des tests à partir d'un contrat déclaratif :

```typescript
import { contractTest } from '@bonsai/testing';

describe('CartFeature contracts', () => {
  contractTest(CartFeature, {
    commands: {
      'cart:addItem': {
        input: { productId: '123', qty: 1 },
        expectedEvents: ['cart:itemAdded'],
        expectedState: (state) => state.items.length === 1
      },
      'cart:removeItem': {
        input: { itemId: '456' },
        expectedEvents: ['cart:itemRemoved'],
        precondition: (feature) => {
          feature.entity.mutate('test:setup', undefined, draft => {
            draft.items.push({ id: '456', name: 'Test', qty: 1 });
          });
        }
      }
    },
    requests: {
      'cart:getTotal': {
        precondition: (feature) => {
          feature.entity.mutate('test:setup', undefined, draft => {
            draft.items.push({ price: 10 });
          });
        },
        expectedReply: 10
      }
    }
  });
});
```

> Le contract testing est **complémentaire** aux tests unitaires — pas un remplacement.
> Idéal pour documenter le contrat public d'une Feature et détecter les régressions.

---

## 8. Conventions et bonnes pratiques

### Organisation des fichiers de test

```
tests/
├── unit/
│   ├── entities/
│   │   └── cart.entity.test.ts
│   ├── features/
│   │   └── cart.feature.test.ts
│   └── views/
│       └── cart.view.test.ts
├── integration/
│   └── cart-pricing.integration.test.ts
└── fixtures/
    └── cart.fixtures.ts
```

### Patterns à suivre

| Pattern | Raison |
|---------|--------|
| ✅ Un `describe` par composant | Lisibilité |
| ✅ Tester les Events émis, pas les internals | Stabilité |
| ✅ `mockReply()` pour les requests cross-Feature | Isolation |
| ✅ `feature.state` pour vérifier les mutations | API publique |
| ✅ Fixtures partagées pour les états initiaux | DRY |

### Anti-patterns

| Anti-pattern | Pourquoi | Alternative |
|-------------|----------|-------------|
| ❌ Accéder à `_internal` ou propriétés privées | Couplage aux internals | Tester via l'API publique (`handle()`, `state`, `emitted()`) |
| ❌ Mocker Radio directement | Dépendance sur l'implémentation interne | Utiliser `MockChannel` |
| ❌ Tests de View sans DOM | Les Views sont intrinsèquement liées au DOM | Utiliser `createTestView()` avec jsdom |
| ❌ Tests d'intégration pour la logique métier | Trop lents, trop fragiles | Tests unitaires Feature + tests d'intégration pour la chorégraphie |

---

## Références

- [ADR-0006 — Testing Strategy](../adr/ADR-0006-testing-strategy.md) (décision architecturale source)
- [Vitest](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Jest](https://jestjs.io/)
- [RFC-0002-feature §7.4](../rfc/3-couche-abstraite/feature.md) (modèle d'erreurs pour les tests)
