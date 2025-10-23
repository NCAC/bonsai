# ADR-0006 : Testing Strategy

| Champ | Valeur |
|-------|--------|
| **Statut** | 🟢 Accepted |
| **Date** | 2026-03-18 |
| **Décideurs** | @ncac |
| **RFC liée** | — (transversal) |

---

## Contexte

Aucune stratégie de test n'est documentée dans les RFC. Pour qu'un framework soit adoptable, il **doit** fournir :

1. **Testabilité par design** : chaque composant doit être testable en isolation
2. **Helpers de test** : utilitaires fournis par le framework
3. **Patterns documentés** : exemples de tests pour chaque type de composant
4. **Fixtures** : données de test réutilisables

### Composants à tester

| Composant | Dépendances | Difficulté |
|-----------|-------------|------------|
| **Feature** | Entity, Channel (listen, request) | Moyenne |
| **Entity** | Aucune (ou Immer) | Basse |
| **Channel** | Radio (interne) | Basse |
| **View** | DOM, Channels | Élevée |
| **Behavior** | DOM, View hôte, Channels | Élevée |
| **Composer** | Channels, Views | Moyenne |
| **Foundation** | DOM, Channels, Composers | Moyenne |
| **Intégration** | Tout | Élevée |

### Questions clés

1. Comment mocker les Channels sans monter tout Radio ?
2. Comment tester une View sans DOM réel (jsdom ? happy-dom ?) ?
3. Comment tester la chorégraphie multi-Features ?
4. Comment tester le cycle de vie (bootstrap, destroy) ?

---

## Contraintes

### Architecturales

- **Dépendances déclaratives** : les Channels utilisés sont déclarés statiquement → mockables
- **Entity encapsulée** : non accessible hors Feature → testée via Feature ou exposée pour tests
- **Radio interne** : jamais exposé → les tests ne doivent pas en dépendre

### Écosystème

- **Vitest** ou **Jest** comme test runner (standard TS)
- **jsdom** ou **happy-dom** pour DOM (pas de browser réel en CI)
- **Testing Library** patterns (accessibilité, user-centric)

### DX

- Tests rapides (< 100ms par test unitaire)
- Assertions claires et explicites
- Pas de configuration complexe

---

## Options considérées

### Option A — Mocks manuels par composant

**Description** : Chaque type de composant a ses propres patterns de mock.

```typescript
// Test Feature — mock channels manually
describe('CartFeature', () => {
  let feature: CartFeature;
  let mockPricingChannel: MockChannel<PricingChannel>;
  
  beforeEach(() => {
    mockPricingChannel = createMockChannel<PricingChannel>();
    feature = new CartFeature({
      channels: {
        pricing: mockPricingChannel
      }
    });
  });
  
  it('should add item and emit event', async () => {
    await feature.handle('cart:addItem', { productId: '123', qty: 1 });
    
    expect(feature.entity.getItems()).toHaveLength(1);
    expect(mockEmit).toHaveBeenCalledWith('cart:itemAdded', expect.any(Object));
  });
});
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Contrôle total | - Beaucoup de boilerplate |
| + Pas de magie | - Chaque équipe réinvente |
| + Flexible | - Incohérence entre projets |

---

### Option B — Test Harness fourni par le framework

**Description** : Le framework fournit des classes/fonctions de test officielles.

```typescript
import { createTestFeature, createTestView, MockChannel } from '@bonsai/testing';

describe('CartFeature', () => {
  it('should handle addItem command', async () => {
    const { feature, channels, emitted } = createTestFeature(CartFeature, {
      // Déclare les channels mockés automatiquement depuis les déclarations
      mockChannels: true,
      // État initial optionnel
      initialState: { items: [] }
    });
    
    await feature.handle('cart:addItem', { productId: '123', qty: 1 });
    
    expect(feature.state.items).toHaveLength(1);
    expect(emitted('cart:itemAdded')).toHaveBeenCalledWith({
      item: expect.objectContaining({ productId: '123' })
    });
  });
  
  it('should request pricing on addItem', async () => {
    const { feature, channels } = createTestFeature(CartFeature);
    
    channels.pricing.mockReply('pricing:getPrice', { price: 99.99 });
    
    await feature.handle('cart:addItem', { productId: '123', qty: 1 });
    
    expect(channels.pricing.requested('pricing:getPrice')).toHaveBeenCalled();
  });
});
```

```typescript
// Test View
import { createTestView, userEvent } from '@bonsai/testing';

describe('CartView', () => {
  it('should trigger addItem on button click', async () => {
    const { view, element, triggered } = createTestView(CartView, {
      // DOM simulé avec le template
      html: '<div id="cart"><button data-ui="addBtn">Add</button></div>',
      // Channels mockés
      mockChannels: true
    });
    
    await userEvent.click(element.querySelector('[data-ui="addBtn"]'));
    
    expect(triggered('cart:addItem')).toHaveBeenCalled();
  });
  
  it('should update on itemAdded event', async () => {
    const { view, element, simulateEvent } = createTestView(CartView);
    
    await simulateEvent('cart:itemAdded', { item: { name: 'Product' } });
    
    expect(element.textContent).toContain('Product');
  });
});
```

| Avantages | Inconvénients |
|-----------|---------------|
| + DX excellente | - Plus de code framework à maintenir |
| + Patterns cohérents | - API à concevoir et documenter |
| + Mock auto depuis déclarations | - Risque d'abstraction fuyante |
| + Intégration IDE | |

---

### Option C — Testing Library adapter

**Description** : Adapter les patterns Testing Library au modèle Bonsai.

```typescript
import { render, screen, fireEvent } from '@bonsai/testing-library';

describe('CartView', () => {
  it('should add item to cart', async () => {
    const { emitted } = render(CartView, {
      channels: mockChannels()
    });
    
    await fireEvent.click(screen.getByRole('button', { name: /add to cart/i }));
    
    expect(emitted('cart:addItem')).toHaveBeenCalled();
  });
});
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Patterns familiers (Testing Library) | - Dépendance externe |
| + Accessibilité by default | - Adaptation peut être bancale |
| + Grande communauté | - Perte de contrôle sur l'API |

---

### Option D — Contract Testing (snapshot-based)

**Description** : Les tests vérifient les contrats (events émis, commands handled) via snapshots.

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
        precondition: (feature) => feature.entity.addItem({ id: '456' })
      }
    },
    requests: {
      'cart:getTotal': {
        precondition: (feature) => feature.entity.addItem({ price: 10 }),
        expectedReply: 10
      }
    }
  });
});
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Tests déclaratifs | - Moins flexible |
| + Contrats explicites | - Cas complexes difficiles |
| + Documentation vivante | - Nouveau pattern à apprendre |

---

## Analyse comparative

| Critère | A (Manual) | B (Harness) | C (TL Adapter) | D (Contracts) |
|---------|------------|-------------|----------------|---------------|
| **DX** | ⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| **Flexibilité** | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐ |
| **Cohérence** | ⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| **Maintenance** | ⭐⭐⭐ | ⭐⭐ | ⭐ | ⭐⭐ |
| **Adoption** | ⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| **Documentation** | — | Nécessaire | Existante | Nécessaire |

---

## Décision

**🟢 Accepté**

### Stratégie retenue : Option B (Test Harness) + éléments de D (Contracts)

Justification :

1. **`@bonsai/testing` package dédié** avec helpers officiels
2. **`createTestFeature()`** : mock auto des channels déclarés, accès à `feature.state`
3. **`createTestView()`** : DOM simulé, events, assertions sur triggers
4. **`contractTest()`** optionnel pour tests déclaratifs de contrats
5. **Compatible Vitest/Jest** : pas de runtime spécial

### Structure proposée

```
packages/
├── bonsai/                 # Core framework
└── bonsai-testing/         # Test utilities
    ├── src/
    │   ├── feature.ts      # createTestFeature()
    │   ├── view.ts         # createTestView()
    │   ├── channel.ts      # MockChannel, createMockChannel()
    │   ├── contracts.ts    # contractTest()
    │   └── index.ts
    └── package.json
```

---

## Conséquences

### Positives

- ✅ Tests rapides et isolés
- ✅ Patterns cohérents dans l'écosystème
- ✅ Mock automatique depuis déclarations statiques
- ✅ Documentation par l'exemple

### Négatives (acceptées)

- ⚠️ Package supplémentaire à maintenir
- ⚠️ API à concevoir soigneusement

### Risques identifiés

- 🔶 API testing trop couplée au runtime interne — mitigation : tester l'API publique, pas les internals
- 🔶 Trop de magie → tests fragiles — mitigation : garder les helpers simples et explicites

---

## Patterns de test par composant

### Entity (unitaire)

```typescript
describe('CartEntity', () => {
  it('should add item', () => {
    const entity = new CartEntity({ items: [] });
    entity.addItem({ id: '1', name: 'Product' });
    expect(entity.getItems()).toHaveLength(1);
  });
  
  it('should calculate total', () => {
    const entity = new CartEntity({ items: [{ price: 10 }, { price: 20 }] });
    expect(entity.getTotal()).toBe(30);
  });
});
```

### Feature (unitaire avec mocks)

```typescript
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
});
```

### View (unitaire avec DOM simulé)

```typescript
describe('CartView', () => {
  it('should render items', async () => {
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

### Intégration (multi-Features)

```typescript
describe('Cart + Pricing integration', () => {
  it('should update total when item added', async () => {
    const { app, features, views } = createTestApp({
      features: [CartFeature, PricingFeature],
      views: [CartView]
    });
    
    await features.cart.handle('cart:addItem', { productId: '1' });
    
    // La chorégraphie s'exécute
    expect(features.cart.state.total).toBe(99);
    expect(views.cart.element).toHaveTextContent('Total: 99');
  });
});
```

---

## Actions de suivi

- [ ] Créer `packages/bonsai-testing/` avec structure de base
- [ ] Implémenter `createTestFeature()` minimal
- [ ] Implémenter `MockChannel` avec API fluide
- [ ] Écrire tests du framework avec ces helpers (dog-fooding)
- [ ] Documenter patterns dans TESTING.md

---

## Références

- [Vitest](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Jest](https://jestjs.io/)
- [Angular Testing](https://angular.io/guide/testing)
- [Vue Test Utils](https://test-utils.vuejs.org/)

---

## Historique

| Date | Changement |
|------|------------|
| 2026-03-17 | Création (Proposed) — 4 options documentées |
| 2026-03-18 | **Accepted** — Test Harness `@bonsai/testing` |
