# ADR-0030 : Tests comme preuve d'architecture — Spécification exécutable par strate

| Champ | Valeur |
|-------|--------|
| **Statut** | 🟢 Accepted |
| **Date** | 2026-04-10 |
| **Décideurs** | @ncac |
| **RFC liées** | Toutes |
| **ADR liées** | ADR-0006 (testing strategy — DX helpers), ADR-0028 (phasage), ADR-0029 (périmètre gelé v1) |
| **Déclencheur** | Revue architecturale 2026-04-10 — les invariants documentés doivent devenir des assertions exécutables |

---

## Contexte

### Le problème

Le corpus Bonsai documente **63 invariants** (I1–I58, I63), **~30 sémantiques runtime** (ADR-0001/0003/0015), **4 scénarios E2E** (ADR-0028) et **7 anti-patterns mécaniquement détectables**. C'est une spécification riche et précise.

Mais cette spécification est écrite en prose. Pour l'instant :

- **2 fichiers de test** existent (`radio.singleton.test.ts`, `channel.class.test.ts`)
- **0 fichier** dans `integration/`, `e2e/`, `fixtures/`, `helpers/`
- Les tests existants testent l'implémentation legacy (`packages/event/src/`) et **ne prouvent aucun invariant Bonsai**
- Le test Channel utilise `await channel.request(...)` — **non conforme** à ADR-0023 (sync)

La robustesse du framework ne dépend plus de nouveaux documents mais de la **traduction immédiate** de la spécification en tests exécutables.

### Distinction avec ADR-0006

L'ADR-0006 (Testing Strategy) définit les **helpers publics** que Bonsai fournira aux développeurs d'applications (`createTestFeature()`, `mockChannel()`…). C'est la DX de test — reportée hors v1 par ADR-0029.

Le présent ADR définit les **tests internes du framework lui-même** — la preuve que l'implémentation respecte les invariants documentés. Ce sont deux préoccupations orthogonales :

| ADR-0006 | ADR-0030 |
|----------|----------|
| Tests écrits par les **utilisateurs** du framework | Tests écrits par les **développeurs** du framework |
| Helpers publics, patterns documentés | Assertions d'invariants, sémantiques runtime, E2E |
| DX — reportée en v1.1 | Preuve d'architecture — **v1 bloquant** |

---

## Contraintes

| # | Contrainte | Source |
|---|-----------|--------|
| C1 | Chaque strate DOIT avoir une suite de tests verte **avant** de passer à la suivante | ADR-0028 C1 |
| C2 | Les tests DOIVENT prouver les invariants — pas simplement tester des méthodes | Principe Bonsai |
| C3 | Un invariant compile-time est prouvé par un test `@ts-expect-error` ou `tsd` — pas par un test runtime | Compile-time > Runtime |
| C4 | Les tests E2E d'ADR-0028 sont des **critères de gate** : la strate N n'est pas livrée tant que son E2E ne passe pas | ADR-0028 |
| C5 | L'environnement de test DOM est `happy-dom` (rapide, suffisant pour PDR) ou `jsdom` si nécessaire | Performance |
| C6 | Chaque test DOIT documenter l'invariant ou la sémantique qu'il prouve (commentaire ou nom de describe) | Traçabilité |

---

## Options considérées

### Option A — Tests par composant (structure classique)

```
tests/
  unit/
    radio.test.ts
    channel.test.ts
    entity.test.ts
    feature.test.ts
    view.test.ts
    ...
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Structure simple et familière | - Aucune traçabilité vers les invariants |
| + Facile à naviguer par composant | - Impossible de savoir quels invariants sont couverts |
| | - Les invariants cross-composant (I7, I8, I31) tombent entre les chaises |

### Option B — Tests par invariant (structure par spécification)

```
tests/
  invariants/
    I01-feature-emit-own-channel.test.ts
    I10-single-command-handler.test.ts
    I29-request-returns-sync.test.ts
    ...
  semantics/
    entity-notification-ordering.test.ts
    channel-error-isolation.test.ts
    ...
  e2e/
    strate-0-cart-round-trip.test.ts
    strate-1-multi-feature-metas.test.ts
    ...
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Traçabilité parfaite : 1 fichier = 1 invariant prouvé | - Explosion du nombre de fichiers |
| + Facile de vérifier la couverture (ls = % d'invariants testés) | - Certains invariants sont triviaux (1 assert) → fichiers trop petits |
| + Tests cross-composant naturels | - Pas de vue d'ensemble par composant |

### Option C — Structure hybride : composant × strate avec traçabilité par annotation

```
tests/
  unit/
    strate-0/
      radio.singleton.test.ts          # I15
      channel.basic.test.ts            # I10, I11, I25, I26, I27, I29, I55
      entity.basic.test.ts             # I6, I46, I51-catchall, I52
      feature.core.test.ts             # I1, I2, I3, I12, I17, I21, I22, I48
      view.basic.test.ts               # I4, I5, I13, I18, I30, I31, I39
      application.bootstrap.test.ts    # I23, I24, I56
      foundation.basic.test.ts         # I33
      composer.basic.test.ts           # I20, I35, I37, I40
    strate-1/
      entity.patches.test.ts           # I51-perkey, I53
      entity.reentrance.test.ts        # Hotspot A — FIFO, maxDepth
      metas.propagation.test.ts        # I7, I8, I54
      channel.anti-loop.test.ts        # I9
      channel.error-isolation.test.ts  # ADR-0002
      view.templates.test.ts           # I38, I41
      composer.n-instances.test.ts     # I37-N, I58
      composer.cascade.test.ts         # Hotspot C — cascade destruction
      validation.entity-schema.test.ts # I63
    strate-2/
      localstate.timing.test.ts        # I42, I57 — Hotspot B
      localstate.edge-cases.test.ts    # ré-entrance, detach, double effet
      behavior.isolation.test.ts       # I4-behavior, I43, I44, I45
      ssr.hydration.test.ts            # ADR-0014
      devtools.hooks.test.ts           # Event Ledger, snapshot/restore
  compile-time/
    type-safety.test.ts                # I1–I5, I12, I15, I17, I25, I26, I30, I39, I46, I50
  integration/
    strate-0/
      trigger-handle-mutate-emit.test.ts     # Round-trip minimal
    strate-1/
      multi-feature-metas-chain.test.ts      # Chorégraphie cross-domain
      composer-resolve-diff.test.ts          # Diff N-instances
    strate-2/
      localstate-behavior-projection.test.ts # Dual N1/N2-N3 + Behavior
  e2e/
    strate-0.cart-round-trip.test.ts         # Critère gate ADR-0028 strate 0
    strate-1.multi-feature-metas.test.ts     # Critère gate ADR-0028 strate 1
    strate-1.composer-cascade.test.ts        # Critère gate ADR-0028 strate 1
    strate-2.localstate-behavior.test.ts     # Critère gate ADR-0028 strate 2
  fixtures/
    cart-feature.fixture.ts
    pricing-feature.fixture.ts
    product-view.fixture.ts
  helpers/
    dom-setup.ts
    create-test-app.ts
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Navigation par composant ET par strate | - Structure plus profonde |
| + Traçabilité par annotation dans chaque fichier (`# I10, I55`) | - Annotation manuelle (pas automatique) |
| + Les hotspots ont des fichiers dédiés (testables en isolation) | |
| + Les tests compile-time sont séparés des tests runtime | |
| + Les critères gate E2E sont des fichiers nommés explicitement | |
| + Chaque strate peut être exécutée indépendamment (`jest strate-0`) | |

---

## Analyse comparative

| Critère | Option A (par composant) | Option B (par invariant) | Option C (hybride) |
|---------|------------------------|-------------------------|-------------------|
| Traçabilité invariants → tests | ❌ | ⭐⭐⭐ | ⭐⭐⭐ |
| Navigabilité par composant | ⭐⭐⭐ | ❌ | ⭐⭐⭐ |
| Exécution par strate | ❌ | ⭐⭐ | ⭐⭐⭐ |
| Hotspots isolés et testables | ⭐ | ⭐⭐ | ⭐⭐⭐ |
| Simplicité de structure | ⭐⭐⭐ | ⭐ | ⭐⭐ |
| Tests compile-time distincts | ❌ | ⭐⭐ | ⭐⭐⭐ |

---

## Décision

🟢 **Option C retenue** — Structure hybride composant × strate avec traçabilité par annotation.

### Justification

1. **Exécution par strate** : `jest --testPathPattern=strate-0` permet de valider une strate sans exécuter les suivantes — aligné avec ADR-0028 C1
2. **Hotspots isolés** : `entity.reentrance.test.ts`, `localstate.edge-cases.test.ts`, `composer.cascade.test.ts` — chaque hotspot a son propre fichier de tests
3. **Traçabilité** : chaque fichier documente les invariants qu'il prouve dans son en-tête
4. **Compile-time séparé** : les tests `@ts-expect-error` ne nécessitent pas d'exécution runtime — ils sont dans leur propre répertoire

### Rejet des autres options

- **Option A** rejetée : aucune traçabilité vers les invariants, impossible de savoir ce qui est prouvé
- **Option B** rejetée : trop de fichiers triviaux, pas de vue par composant

---

## Spécification des 4 niveaux de test

### Niveau 1 — Tests compile-time (`compile-time/`)

Tests qui prouvent que le **système de types** empêche les violations d'invariants. Exécutés par `tsc` ou par des assertions `@ts-expect-error` dans Jest.

```typescript
// compile-time/type-safety.test.ts
// Prouve : I1, I4, I5, I12, I15, I25, I26, I30

describe('Type-level invariants', () => {
  
  it('I1 — Feature cannot emit on foreign Channel', () => {
    // @ts-expect-error — Feature.emit() type-constrained to own namespace
    cartFeature.emit('pricing:priceUpdated', {});
  });

  it('I4 — View cannot emit', () => {
    // @ts-expect-error — View type does not expose emit()
    cartView.emit('cart:itemAdded', {});
  });

  it('I5 — View cannot access Entity', () => {
    // @ts-expect-error — entity not in View type
    cartView.entity;
  });

  it('I15 — Radio not exported', () => {
    // @ts-expect-error — Radio is internal, not in public API
    import { Radio } from '@core/bonsai';
  });

  it('I29 — request() returns T | null, not Promise', () => {
    const result = cartView.request('pricing', 'getTotal', {});
    // Type-level: result is CartItem[] | null, NOT Promise<CartItem[] | null>
    const check: CartItem[] | null = result;
  });
});
```

**Couverture** : ~21 invariants compile-time.

### Niveau 2 — Tests unitaires (`unit/strate-N/`)

Tests qui prouvent le comportement d'**un composant isolé**. Les dépendances sont mockées ou stubées.

**Convention de nommage** : `{composant}.{aspect}.test.ts`

**Convention d'annotation** : chaque `describe()` de premier niveau porte les invariants qu'il prouve.

```typescript
// unit/strate-0/channel.basic.test.ts
// Prouve : I10, I11, I25, I26, I27, I29, I55

describe('Channel basic — Strate 0 [I10, I11, I29, I55]', () => {
  
  describe('I10 — Single command handler', () => {
    it('throws on duplicate command handler registration', () => {
      const channel = createChannel('cart');
      channel.handle('addItem', handler1);
      expect(() => channel.handle('addItem', handler2))
        .toThrow('Duplicate command handler');
    });
  });

  describe('I29/I55 — Request is synchronous, returns T | null', () => {
    it('returns T when replier is registered', () => {
      const channel = createChannel('pricing');
      channel.reply('getTotal', () => 42);
      const result = channel.request('getTotal', {});
      expect(result).toBe(42);
      // NOT a Promise — no await
    });

    it('returns null when no replier registered', () => {
      const channel = createChannel('pricing');
      const result = channel.request('getTotal', {});
      expect(result).toBeNull();
    });

    it('I55 — returns null when replier throws', () => {
      const channel = createChannel('pricing');
      channel.reply('getTotal', () => { throw new Error('boom'); });
      const result = channel.request('getTotal', {});
      expect(result).toBeNull();
    });
  });
});
```

```typescript
// unit/strate-1/entity.reentrance.test.ts
// Prouve : Hotspot A — ré-entrance FIFO, maxEntityNotificationDepth

describe('Entity re-entrance FIFO — Strate 1a [Hotspot A]', () => {

  it('queues mutation triggered during notification cycle', () => {
    const entity = createTestEntity({ count: 0, label: '' });
    const callOrder: string[] = [];

    entity.onAnyEntityUpdated((event) => {
      callOrder.push(`any:${event.intent}`);
      if (event.intent === 'first') {
        // Mutation pendant le cycle de notification → file d'attente
        entity.mutate('second', (draft) => { draft.label = 'mutated'; });
      }
    });

    entity.mutate('first', (draft) => { draft.count = 1; });

    // 'first' terminé complètement, PUIS 'second' exécuté
    expect(callOrder).toEqual(['any:first', 'any:second']);
  });

  it('throws when maxEntityNotificationDepth exceeded', () => {
    const entity = createTestEntity({ count: 0 }, { maxEntityNotificationDepth: 3 });

    entity.onAnyEntityUpdated(() => {
      // Mutation récursive infinie
      entity.mutate('recursive', (draft) => { draft.count += 1; });
    });

    expect(() => entity.mutate('initial', (draft) => { draft.count = 1; }))
      .toThrow('maxEntityNotificationDepth');
  });

  it('processes FIFO — not LIFO', () => {
    const entity = createTestEntity({ a: 0, b: 0, c: 0 });
    const order: string[] = [];

    entity.onAnyEntityUpdated((event) => {
      order.push(event.intent);
      if (event.intent === 'first') {
        entity.mutate('second', (draft) => { draft.b = 1; });
        entity.mutate('third', (draft) => { draft.c = 1; });
      }
    });

    entity.mutate('first', (draft) => { draft.a = 1; });
    expect(order).toEqual(['first', 'second', 'third']); // FIFO, pas LIFO
  });
});
```

```typescript
// unit/strate-2/localstate.edge-cases.test.ts
// Prouve : Hotspot B — ré-entrance, detach timing, double effet

describe('localState edge cases — Strate 2a [Hotspot B]', () => {

  it('N1 callback executes BEFORE N2 microtask', async () => {
    const view = createTestView({ localState: { step: 1 } });
    const order: string[] = [];

    view.onLocalStepUpdated = () => { order.push('N1-callback'); };
    // Le template observe data.local.step → re-projection en microtask
    view.setTemplate({ selector: (data) => data.local?.step });

    view.updateLocal((draft) => { draft.step = 2; });
    order.push('after-updateLocal');

    // N1 est synchrone → déjà exécuté
    expect(order).toEqual(['N1-callback', 'after-updateLocal']);

    // Attendre la microtask pour N2
    await Promise.resolve();
    // Template re-projeté
    expect(view.getProjectedValue('step')).toBe(2);
  });

  it('detach between N1 callback and N2 microtask does not crash', async () => {
    const view = createTestView({ localState: { step: 1 } });
    
    view.onLocalStepUpdated = () => {
      // Pendant le callback N1, quelqu'un détache la View
      view.simulateDetach();
    };

    // Ne doit pas throw
    view.updateLocal((draft) => { draft.step = 2; });

    await Promise.resolve();
    // La microtask N2 ne doit pas projeter dans un DOM fantôme
    expect(view.isAttached()).toBe(false);
    // Pas de throw, pas de DOM orphelin
  });

  it('re-entrant updateLocal in N1 callback queues correctly', () => {
    const view = createTestView({ localState: { step: 1, errors: [] } });
    const steps: number[] = [];

    view.onLocalStepUpdated = (update) => {
      steps.push(update.next.step);
      if (update.next.step === 2) {
        // Ré-entrance : updateLocal dans un callback N1
        view.updateLocal((draft) => { draft.step = 3; });
      }
    };

    view.updateLocal((draft) => { draft.step = 2; });
    expect(steps).toEqual([2, 3]); // Les deux callbacks exécutés
  });
});
```

### Niveau 3 — Tests d'intégration (`integration/strate-N/`)

Tests qui prouvent l'**interaction entre 2+ composants** sans monter l'application complète.

```typescript
// integration/strate-0/trigger-handle-mutate-emit.test.ts
// Prouve : flux unidirectionnel View → Feature → Entity → Event → View

describe('Trigger → Handle → Mutate → Emit — Strate 0', () => {

  it('command flows from View trigger to Feature handler', () => {
    const { app, cartView, cartFeature } = createMinimalApp();
    
    cartView.simulateTrigger('cart:addItem', { productId: '123', qty: 1 });
    
    expect(cartFeature.entity.query.getItems()).toHaveLength(1);
  });

  it('entity mutation emits event received by listening View', () => {
    const { app, cartView, cartFeature } = createMinimalApp();
    const received: any[] = [];
    
    // CartView écoute cart:itemAdded
    cartView.onItemAddedEvent = (payload) => { received.push(payload); };
    
    cartView.simulateTrigger('cart:addItem', { productId: '123', qty: 1 });
    
    expect(received).toHaveLength(1);
    expect(received[0].item.productId).toBe('123');
  });
});
```

### Niveau 4 — Tests E2E / critères gate (`e2e/`)

Tests qui prouvent un **round-trip complet** avec DOM. Ce sont les critères de validation d'ADR-0028 — la strate N n'est pas livrée tant que son E2E ne passe pas.

```typescript
// e2e/strate-0.cart-round-trip.test.ts
// Critère gate ADR-0028 strate 0
// Prouve : le round-trip complet trigger→handle→mutate→emit→N1-projection

describe('Strate 0 Gate — Cart round-trip E2E', () => {

  it('click → trigger → handle → mutate → emit → N1 projection → DOM updated', () => {
    // 1. Bootstrap
    const app = new Application();
    app.register(CartFeature);
    app.start();

    // 2. Vérifier que la View est montée
    const addButton = document.querySelector('[data-ui="addButton"]');
    expect(addButton).not.toBeNull();

    // 3. Simuler click
    addButton!.click();

    // 4. Vérifier la projection N1 dans le DOM
    const itemCount = document.querySelector('[data-ui="itemCount"]');
    expect(itemCount!.textContent).toBe('1');

    app.stop?.();
  });
});
```

---

## Matrice de couverture — invariants × fichiers de test

### Strate 0

| Fichier de test | Invariants prouvés | Niveau |
|----------------|-------------------|--------|
| `compile-time/type-safety.test.ts` | I1, I2, I3, I4, I5, I12, I15, I17, I25, I26, I29p, I30, I35, I39, I44, I46, I47, I49, I50, I52 | Compile |
| `unit/strate-0/radio.singleton.test.ts` | I15 (runtime) | Unit |
| `unit/strate-0/channel.basic.test.ts` | I10, I11, I25r, I26r, I27, I29, I55 | Unit |
| `unit/strate-0/entity.basic.test.ts` | I6r, I46r, I51-catchall, I52r | Unit |
| `unit/strate-0/feature.core.test.ts` | I1r, I2r, I3r, I12r, I17r, I21, I22, I48 | Unit |
| `unit/strate-0/view.basic.test.ts` | I4r, I5r, I13r, I18, I19, I30r, I31, I32, I34, I36, I39r | Unit |
| `unit/strate-0/application.bootstrap.test.ts` | I23, I24, I56 | Unit |
| `unit/strate-0/foundation.basic.test.ts` | I33 | Unit |
| `unit/strate-0/composer.basic.test.ts` | I20, I35r, I37-basic, I40 | Unit |
| `integration/strate-0/trigger-handle-mutate-emit.test.ts` | I1+I10+I11+I22+I48 (cross) | Integration |
| `e2e/strate-0.cart-round-trip.test.ts` | **Gate** — round-trip complet | E2E |

### Strate 1

| Fichier de test | Invariants / Sémantiques prouvés | Niveau |
|----------------|--------------------------------|--------|
| `unit/strate-1/entity.patches.test.ts` | I51-perkey, I53, no-op par patches, changedKeys, TEntityEvent | Unit |
| `unit/strate-1/entity.reentrance.test.ts` | **Hotspot A** — FIFO, maxDepth, ordre | Unit |
| `unit/strate-1/metas.propagation.test.ts` | I7, I8, I54 | Unit |
| `unit/strate-1/channel.anti-loop.test.ts` | I9 | Unit |
| `unit/strate-1/channel.error-isolation.test.ts` | ADR-0002 — listener A throw, B/C continuent | Unit |
| `unit/strate-1/view.templates.test.ts` | I38, I41, event `any` | Unit |
| `unit/strate-1/composer.n-instances.test.ts` | I37-N, diff rootElement+viewClass | Unit |
| `unit/strate-1/composer.cascade.test.ts` | **Hotspot C** — cascade, I58, 5 états | Unit |
| `unit/strate-1/validation.entity-schema.test.ts` | I63, ADR-0022 modale | Unit |
| `integration/strate-1/multi-feature-metas-chain.test.ts` | I7+I8+I9 cross-domain, correlationId 3 hops | Integration |
| `integration/strate-1/composer-resolve-diff.test.ts` | resolve → diff → destruction sélective | Integration |
| `e2e/strate-1.multi-feature-metas.test.ts` | **Gate** — chorégraphie multi-Feature | E2E |
| `e2e/strate-1.composer-cascade.test.ts` | **Gate** — N-instances + cascade | E2E |

### Strate 2

| Fichier de test | Invariants / Sémantiques prouvés | Niveau |
|----------------|--------------------------------|--------|
| `unit/strate-2/localstate.timing.test.ts` | I42, I57, dual N1/N2-N3, batch | Unit |
| `unit/strate-2/localstate.edge-cases.test.ts` | **Hotspot B** — ré-entrance, detach, double effet | Unit |
| `unit/strate-2/behavior.isolation.test.ts` | I4-behavior, I43, I44, I45 | Unit |
| `unit/strate-2/ssr.hydration.test.ts` | ADR-0014 — populateFromServer, mode détection | Unit |
| `unit/strate-2/devtools.hooks.test.ts` | Event Ledger, snapshot/restore | Unit |
| `integration/strate-2/localstate-behavior-projection.test.ts` | I42+I43+I44 — View+Behavior+localState+template | Integration |
| `e2e/strate-2.localstate-behavior.test.ts` | **Gate** — dual N1/N2-N3 + Behavior | E2E |

### Anti-patterns (tests "must fail")

| Fichier | Anti-patterns prouvés |
|---------|----------------------|
| `compile-time/type-safety.test.ts` | Cross-domain emit, Entity leaking, Radio access, View emit, View stateful |
| `unit/strate-0/channel.basic.test.ts` | Double handler (I10) |
| `unit/strate-0/application.bootstrap.test.ts` | Undeclared channel, namespace collision |
| `unit/strate-0/channel.basic.test.ts` | Async replier rejection (ADR-0023) |

---

## Comptage de couverture

| Catégorie | Total | Couverts par la matrice | Non-testables mécaniquement |
|-----------|-------|------------------------|---------------------------|
| Invariants (I1–I58, I63) | 57 v1 | **51** | 6 (I13, I18, I19, I23, I27, I36 — architecturaux/convention) |
| Sémantiques runtime (ADR-0001/0003/0015) | ~30 | **~28** | 2 (ordre async non garanti — illustratif) |
| Critères gate E2E (ADR-0028) | 4 | **4** | 0 |
| Anti-patterns mécaniques | 7 | **7** | 0 |
| **Total** | **~98 scénarios** | **~90 testés** | **~8 convention/review** |

---

## Règle d'exécution par strate

```bash
# Gate strate 0 — doit passer AVANT de commencer strate 1
pnpm test -- --testPathPattern="strate-0|compile-time" --bail

# Gate strate 1 — doit passer AVANT de commencer strate 2
pnpm test -- --testPathPattern="strate-[01]|compile-time" --bail

# Gate strate 2 — doit passer pour livrer v1
pnpm test -- --bail

# Hotspot ciblé (debugging)
pnpm test -- --testPathPattern="entity.reentrance"
pnpm test -- --testPathPattern="localstate.edge-cases"
pnpm test -- --testPathPattern="composer.cascade"
```

---

## Conséquences

### Positives

- ✅ **Spécification exécutable** : 51 invariants deviennent des assertions, pas de la prose. Si un invariant est violé, un test casse.
- ✅ **Gate par strate** : impossible de passer à la strate N+1 sans suite verte — aligné avec ADR-0028
- ✅ **Hotspots isolés** : chaque hotspot (A/B/C) a son propre fichier de test avec les edge cases documentés — debug ciblé
- ✅ **Traçabilité** : chaque test porte le numéro d'invariant qu'il prouve — auditabilité complète
- ✅ **Compile-time séparé** : les 21 invariants type-level sont prouvés par `@ts-expect-error`, pas par de l'overhead runtime

### Négatives (acceptées)

- ⚠️ **Structure plus profonde** que `tests/unit/*.test.ts` — 3 niveaux de répertoire. Accepté : la navigabilité par strate et par hotspot compense.
- ⚠️ **~35 fichiers de test** pour v1 complet. Accepté : c'est proportionnel à 57 invariants + 30 sémantiques + 4 E2E.
- ⚠️ **Annotation manuelle** des invariants par fichier. Accepté : un script de vérification de couverture peut être ajouté post-v1.

### Risques

- 🔶 **Fixtures couplées** : les fixtures (`cart-feature.fixture.ts`) doivent évoluer avec l'API. Mitigation : elles sont dans `fixtures/` et réutilisées — un seul point de maintenance.
- 🔶 **happy-dom vs jsdom** : certains tests PDR pourraient nécessiter jsdom pour le rendu CSS. Mitigation : configurable par fichier via docblock `@jest-environment`.

---

## Actions de suivi

- [ ] Migrer `tests/unit/channel.class.test.ts` — corriger `await channel.request()` → sync (ADR-0023)
- [ ] Créer la structure de répertoires `strate-0/`, `strate-1/`, `strate-2/`, `compile-time/`
- [ ] Écrire les tests strate 0 **en parallèle** de l'implémentation strate 0 (TDD)
- [ ] Configurer Jest pour les projets par strate (`projects` dans `jest.config.ts`)
- [ ] Après strate 0 verte : écrire les tests strate 1 puis implémenter

---

## Références

- [ADR-0006 — Testing strategy (DX helpers)](ADR-0006-testing-strategy.md) — reportée v1.1 (ADR-0029)
- [ADR-0028 — Phasage d'implémentation](ADR-0028-implementation-phasing-strategy.md) — critères gate E2E
- [ADR-0029 — Périmètre gelé v1](ADR-0029-v1-scope-freeze.md) — ce qui est IN/OUT
- [Invariants I1–I58, I63](../rfc/reference/invariants.md) — source de vérité des invariants
- [ADR-0001 — Entity mutation](ADR-0001-entity-diff-notification-strategy.md) — sémantiques notification
- [ADR-0003 — Channel runtime](ADR-0003-channel-runtime-semantics.md) — sémantiques Channel
- [ADR-0015 — localState mechanism](ADR-0015-local-state-mechanism.md) — sémantiques dual N1/N2-N3
- [ADR-0023 — Request/Reply sync](ADR-0023-request-reply-sync-vs-async.md) — request() synchrone

---

## Historique

| Date | Changement |
|------|------------|
| 2026-04-10 | Création — tests comme preuve d'architecture, structure hybride composant × strate |
| 2026-04-10 | 🟢 **Accepted** — Option C (hybride). Matrice de couverture : 51 invariants, ~28 sémantiques, 4 E2E, 7 anti-patterns. ~35 fichiers de test pour v1. |
