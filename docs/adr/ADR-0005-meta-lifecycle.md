# ADR-0005 : Meta Lifecycle

| Champ | Valeur |
|-------|--------|
| **Statut** | 🟢 Accepted |
| **Date** | 2026-03-18 |
| **Décideurs** | @ncac |
| **RFC liée** | [RFC-0001 §10](../rfc/1-philosophie.md), [RFC-0002-api-contrats-typage §13](../rfc/6-transversal/conventions-typage.md) |

---

## Contexte

RFC-0001 §10 définit les **métadonnées causales** (metas) attachées à chaque message :

```typescript
type TMessageMetas = {
  messageId: string;      // ID unique du message
  correlationId: string;  // Transaction logique (créé par l'UI)
  causationId: string | null; // Message parent (null si racine)
  hop: number;            // Profondeur dans la chaîne causale
  timestamp: number;      // Horodatage
  origin: {
    kind: 'view' | 'feature' | 'behavior' | 'composer' | 'foundation';
    name: string;
  };
}
```

### Questions non résolues

| Question | Impact |
|----------|--------|
| **Qui crée le correlationId ?** | UI uniquement ? Features aussi ? |
| **Propagation dans async** | `await` perd le contexte ? |
| **Accès aux metas** | Comment un handler accède aux metas du message courant ? |
| **Metas dans requests** | Les requests portent-ils des metas ? |
| **Génération messageId** | UUID ? Nanoid ? Séquentiel ? |

---

## Contraintes

### Architecturales (RFC)

- **I7** : Tout message porte des metas complètes
- **I8** : correlationId créé par l'UI, jamais modifié
- **I9** : hop incrémenté à chaque réaction, max limit

### Techniques

- **Performance** : génération d'IDs rapide
- **Async** : préserver le contexte causal dans les Promises
- **Debugging** : metas visibles dans DevTools/logs
- **Testing** : metas mockables/injectables

---

## Options par question

### Question 1 : Création du correlationId

#### Option 1A — UI uniquement (strict I8)

```typescript
// SEULS View/Behavior/Foundation créent un correlationId
class CartView extends View {
  onAddClick() {
    // Nouveau correlationId car c'est l'UI qui initie
    this.trigger('cart:addItem', { productId: '123' });
  }
}

// Feature reçoit et propage, ne crée jamais
class CartFeature extends Feature {
  onAddItem(payload, metas) {
    // metas.correlationId vient de la View
    this.emit('cart:itemAdded', { item }, metas);
  }
}
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Conforme I8 | - Quid des timers/scheduled tasks ? |
| + Traçabilité claire | - Quid des events système ? |

#### Option 1B — UI + "System" correlations

```typescript
// UI crée correlationId avec prefix 'usr-'
this.trigger(...); // correlationId = 'usr-abc123'

// Feature peut créer pour actions système avec prefix 'sys-'
class SyncFeature extends Feature {
  onTimerTick() {
    // Nouveau correlationId car pas d'UI à l'origine
    this.emit('sync:started', {}, { newCorrelation: true });
    // correlationId = 'sys-xyz789'
  }
}
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Couvre les cas système | - Deux types de correlations |
| + Traçabilité préservée | - Plus complexe |

**Recommandation** : **1B** — distinguer `usr-` (UI) et `sys-` (système).

**✅ Décision validée** : Préfixes `usr-` et `sys-` pour le correlationId.

---

### Question 2 : Propagation async

#### Option 2A — Propagation explicite via paramètre (✅ Retenue)

```typescript
class CartFeature extends Feature {
  async onAddItem(payload: AddItemPayload, metas: TMessageMetas) {
    // Propagation explicite — le closure capture metas
    const price = await this.request('pricing:getPrice', { id: payload.id }, { metas });
    
    this.emit('cart:itemAdded', { item, price }, { metas });
  }
}
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Explicite, **pas de magie** | - Quelques caractères de plus |
| + Context jamais perdu (closure) | |
| + Async-safe (pas de global state) | |
| + Testable, prévisible | |

#### Option 2B — Context implicite (AsyncLocalStorage-like) (❌ Rejetée)

```typescript
// Rejeté : magie implicite, problèmes potentiels avec async
class CartFeature extends Feature {
  async onAddItem(payload) {
    const price = await this.request('pricing:getPrice', { id: payload.id });
    // Metas propagées "automatiquement" — mais comment ?
  }
}
```

| Raisons du rejet |
|-----------------|
| - Magie (implicite) contraire au principe Bonsai |
| - AsyncLocalStorage = Node only (pas browser natif) |
| - Debugging complexe (où vient le context ?) |
| - Risque de context perdu dans certains patterns async |

#### Option 2C — Hybrid (withMetas helper) (❌ Rejetée)

Rejetée : ajoute un wrapper magique. Le pattern explicite est plus simple.

**✅ Décision** : **2A (explicite via paramètre)**. 
Le handler reçoit `metas` en paramètre, le closure le capture naturellement.
Pas de getter implicite, pas de `withMetas()`, pas de magie.

---

### Question 3 : Accès aux metas dans le handler

#### Option 3A — Paramètre explicite (✅ Retenue)

```typescript
class CartFeature extends Feature {
  onAddItem(payload: AddItemPayload, metas: TMessageMetas) {
    console.log('correlationId:', metas.correlationId);
    // Le closure capture metas naturellement pour les callbacks
  }
}
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Explicite, **pas de magie** | - Signature plus longue |
| + Type-safe | |
| + Async-safe (closure) | |

#### Option 3B — Getter this.currentMetas (❌ Rejetée)

Rejetée : accès implicite = magie, risque hors handler, problèmes async.

#### Option 3C — Les deux (paramètre + getter) (❌ Rejetée)

Rejetée : le getter ajoute de la magie inutile.

**✅ Décision** : **3A (paramètre uniquement)**.
Tous les handlers reçoivent `(payload, metas)`. Pas de getter implicite.

---

### Question 4 : Metas dans requests

#### Option 4A — Oui, mêmes metas

```typescript
// Request porte les metas comme Command/Event
const price = await this.request('pricing:getPrice', payload, metas);
// Le replier reçoit les metas
onGetPrice(payload, metas) { }
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Chaîne causale complète | - Overhead |
| + Debugging unifié | |

#### Option 4B — Non, requests sont "purs"

```typescript
// Request sans metas
const price = await this.request('pricing:getPrice', payload);
// Le replier ne reçoit pas de metas
onGetPrice(payload) { }
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Plus simple | - Chaîne causale incomplète |
| + Request = query pure | - Debugging difficile |

**Recommandation** : **4A** — metas partout pour traçabilité complète (I7).

**✅ Décision validée** : Les requests portent des metas comme les Commands/Events.

---

### Question 5 : Génération des IDs

#### Option 5A — UUID v4

```typescript
import { v4 as uuid } from 'uuid';
const messageId = uuid(); // 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Standard | - 36 chars, verbose |
| + Unique garanti | - Pas de tri temporel |

#### Option 5B — Nanoid

```typescript
import { nanoid } from 'nanoid';
const messageId = nanoid(); // 'V1StGXR8_Z5jdHi6B-myT'
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Court (21 chars) | - Dépendance externe |
| + URL-safe | - Pas de tri temporel |
| + Plus rapide que UUID | |

#### Option 5C — ULID (Universally Unique Lexicographically Sortable Identifier)

```typescript
import { ulid } from 'ulid';
const messageId = ulid(); // '01ARZ3NDEKTSV4RRFFQ69G5FAV'
```

| Avantages | Inconvénients |
|-----------|---------------|
| + **Triable temporellement** | - Dépendance externe |
| + Unique | - 26 chars |
| + Idéal pour event log | |

**Recommandation** : **5C (ULID)** — triable temporellement = parfait pour Event Sourcing (ADR-0011).

**✅ Décision validée** : ULID pour tous les IDs (messageId, correlationId sans préfixe).

---

## Synthèse des décisions

| Question | Décision | Statut |
|----------|----------|--------|
| Création correlationId | UI (`usr-`) + système (`sys-`) | ✅ |
| Propagation async | **Explicite via paramètre** (closure capture) | ✅ |
| Accès metas handler | **Paramètre uniquement** (pas de getter) | ✅ |
| Metas dans requests | Oui, chaîne causale complète | ✅ |
| Génération IDs | **ULID** (triable temporellement) | ✅ |

---

## Décision

**🟢 Accepté**

### Principes fondamentaux

1. **Pas de magie** : les metas sont passées explicitement en paramètre
2. **Async-safe** : le closure capture les metas, pas de global state
3. **Traçabilité complète** : tous les messages (y compris requests) portent des metas
4. **Event Sourcing ready** : ULID pour tri temporel natif

### Structure finale des metas

```typescript
type TMessageMetas = {
  // Identité
  messageId: string;        // ULID, généré par le framework
  
  // Causalité
  correlationId: string;    // ULID, préfixé 'usr-' ou 'sys-'
  causationId: string | null; // messageId du parent, null si racine
  hop: number;              // 0 = racine, +1 à chaque réaction
  
  // Temporalité
  timestamp: number;        // Date.now()
  
  // Origine
  origin: {
    kind: 'view' | 'feature' | 'behavior' | 'composer' | 'foundation';
    name: string;           // Nom du composant (ex: 'CartView')
    namespace?: string;     // Namespace si Feature
  };
}
```

### API finale

```typescript
// =====================================
// PATTERN : Explicite, pas de magie
// =====================================

// Les handlers reçoivent TOUJOURS (payload, metas)
class CartFeature extends Feature {
  onAddItemCommand(payload: AddItemPayload, metas: TMessageMetas) {
    // metas disponible directement en paramètre
    
    // Propager aux méthodes internes
    this.entity.mutate("cart:addItem", { payload, metas }, draft => {
      draft.items.push(payload.item);
    });
    
    // Propager aux émissions
    this.emit('cart:itemAdded', { item: payload.item }, { metas });
  }
  
  async onCheckoutCommand(payload: CheckoutPayload, metas: TMessageMetas) {
    // Dans async, le closure capture metas naturellement
    const price = await this.request('pricing:calculate', { items: payload.items }, { metas });
    
    // metas toujours disponible grâce au closure
    this.emit('cart:checkedOut', { total: price }, { metas });
  }
}

// =====================================
// CRÉATION DE NOUVELLE CORRELATION (rare)
// =====================================

class SyncFeature extends Feature {
  onTimerTick() {
    // Pas de metas en entrée (event système)
    // Le framework crée une nouvelle correlation sys-
    this.emit('sync:started', {});
    // correlationId = 'sys-01ARZ3...'
  }
}

// =====================================
// TESTING : Metas injectables
// =====================================

it('should propagate metas', () => {
  const testMetas: TMessageMetas = {
    messageId: 'test-001',
    correlationId: 'usr-test-corr',
    causationId: null,
    hop: 0,
    timestamp: Date.now(),
    origin: { kind: 'view', name: 'TestView' }
  };
  
  feature.onAddItemCommand({ item: 'abc' }, testMetas);
  expect(emittedEvent.metas.correlationId).toBe('usr-test-corr');
});
```

### Flux typique

```
1. View.trigger('cart:addItem')
   → messageId: '01ARZ3...'
   → correlationId: 'usr-01ARZ3...'
   → causationId: null
   → hop: 0
   → origin: { kind: 'view', name: 'CartView' }

2. CartFeature.onAddItem() → emit('cart:itemAdded')
   → messageId: '01ARZ4...'
   → correlationId: 'usr-01ARZ3...'  (même!)
   → causationId: '01ARZ3...'        (le trigger)
   → hop: 1
   → origin: { kind: 'feature', name: 'CartFeature', namespace: 'cart' }

3. InventoryFeature.onCartItemAdded() → emit('inventory:updated')
   → messageId: '01ARZ5...'
   → correlationId: 'usr-01ARZ3...'  (même!)
   → causationId: '01ARZ4...'        (le itemAdded)
   → hop: 2
   → origin: { kind: 'feature', name: 'InventoryFeature', namespace: 'inventory' }
```

---

## Conséquences

### Positives

- ✅ Chaîne causale complète et traçable
- ✅ Event Sourcing ready (ADR-0011)
- ✅ DevTools : graphe causal, timeline
- ✅ Debugging production : correlationId dans les logs

### Négatives (acceptées)

- ⚠️ Overhead des metas à chaque message — acceptable (quelques bytes)
- ⚠️ ULID = dépendance — petite, bien maintenue

---

## Relation avec autres ADRs

| ADR | Relation |
|-----|----------|
| ADR-0002 (Errors) | Erreurs portent les metas du message qui a failed |
| ADR-0003 (Channel) | Metas propagées dans tout le tri-lane |
| ADR-0011 (Event Sourcing) | Metas = métadonnées des events stockés |

---

## Actions de suivi

- [x] Décider pattern propagation (explicite via paramètre)
- [x] Décider format IDs (ULID)
- [x] Décider préfixes correlationId (usr-/sys-)
- [ ] Intégrer ULID pour génération IDs
- [ ] Implémenter signature handlers `(payload, metas)`
- [ ] Documenter patterns de propagation explicite
- [ ] Tests : vérifier chaîne causale sur cascade d'events

---

## Références

- [ULID spec](https://github.com/ulid/spec)
- [AsyncLocalStorage](https://nodejs.org/api/async_context.html#class-asynclocalstorage)
- [Correlation ID pattern](https://www.enterpriseintegrationpatterns.com/patterns/messaging/CorrelationIdentifier.html)
- [Zone.js (Angular)](https://github.com/angular/angular/tree/main/packages/zone.js)

---

## Historique

| Date | Changement |
|------|------------|
| 2026-03-17 | Création (Proposed) — 5 questions documentées |
| 2026-03-18 | **Accepted** — Décisions finales : explicite via paramètre, ULID, usr-/sys- |
