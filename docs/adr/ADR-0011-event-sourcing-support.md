# ADR-0011 : Event Sourcing Support

| Champ | Valeur |
|-------|--------|
| **Statut** | 🟠 Suspended — post-v1, niveaux 0–1 déjà intégrés dans RFC-0002-entity §8 |
| **Date** | 2026-03-17 |
| **Décideurs** | @ncac |
| **RFC liée** | RFC-0002-entity, RFC-0002-channel, RFC-0001 §10 (metas) |

---

## Contexte

L'architecture Bonsai est naturellement alignée avec l'Event Sourcing :

| Concept Bonsai | Concept Event Sourcing |
|----------------|------------------------|
| Event (fait accompli) | Event immutable |
| Entity (state) | Aggregate |
| Metas (correlationId, causationId) | Event metadata |
| TJsonSerializable | Serializable events |
| emit() → listen() | Event store → Projections |

### Qu'est-ce que l'Event Sourcing ?

```
Traditional CRUD:
  State = Current snapshot
  History = Lost (or audit logs)

Event Sourcing:
  State = f(events) — reconstruit depuis les events
  History = Source of truth
```

### Pourquoi l'ouvrir dans Bonsai ?

1. **Time-travel debugging** : rejouer l'historique, voir l'état à n'importe quel moment
2. **Audit complet** : qui a fait quoi, quand, pourquoi (metas causales)
3. **Replay** : reconstruire l'état après un bug fix
4. **CQRS** : séparer les lectures (projections) des écritures (events)
5. **Undo/Redo** : natif via event replay
6. **Debugging prod** : capturer les events, rejouer localement

---

## Contraintes

### Architecturales

- **Entity = state courant** : l'Entity stocke le state, pas l'historique
- **Events = faits accomplis** : déjà immutables par design
- **Metas obligatoires** : chaque event a un contexte causal
- **TJsonSerializable** : events et state sérialisables

### Performance

- **Replay performance** : reconstruire l'état depuis N events peut être lent
- **Storage** : stocker tous les events peut être volumineux
- **Snapshots** : nécessaires pour éviter de tout rejouer

### Optionnel

- L'Event Sourcing ne doit **pas** être obligatoire
- Certaines Features peuvent l'activer, d'autres non
- Opt-in progressif

---

## Options considérées

### Option A — Event Sourcing natif dans Entity

**Description** : L'Entity devient un event store natif.

```typescript
class CartEntity extends EventSourcedEntity<TCartState, TCartEvent> {
  // State reconstruit automatiquement depuis les events
  
  // Au lieu de muter directement...
  addItem(item: Item) {
    // On enregistre un event
    this.recordEvent('ItemAdded', { item });
  }
  
  // Le state est calculé via un reducer
  protected reduce(state: TCartState, event: TCartEvent): TCartState {
    switch (event.type) {
      case 'ItemAdded':
        return { ...state, items: [...state.items, event.payload.item] };
      case 'ItemRemoved':
        return { ...state, items: state.items.filter(i => i.id !== event.payload.itemId) };
      default:
        return state;
    }
  }
  
  // Accès à l'historique
  getEventHistory(): TCartEvent[] { ... }
  
  // Replay jusqu'à un point
  replayTo(eventId: string): TCartState { ... }
}
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Intégré nativement | - **Breaking change** pour Entity |
| + DX cohérente | - Overhead pour cas simples |
| + Type-safe | - Complexité reducer |

---

### Option B — EventStore séparé (opt-in)

**Description** : Un EventStore optionnel capture les events Channel.

```typescript
// Configuration au niveau Application
const app = createApplication({
  eventSourcing: {
    enabled: true,
    store: new InMemoryEventStore(), // ou IndexedDBEventStore, etc.
    // Quels events capturer ?
    capture: {
      channels: ['cart', 'inventory'], // ou '*' pour tous
      filter: (event) => event.name !== 'cart:uiUpdated', // filtrer les events UI
    },
    // Snapshots
    snapshots: {
      enabled: true,
      every: 100, // snapshot tous les 100 events
    }
  }
});

// Accès à l'event store
const history = app.eventStore.getEvents('cart');
const stateAt = app.eventStore.getStateAt('cart', timestamp);

// Time-travel
app.eventStore.replayTo(eventId);

// Export pour debug
const dump = app.eventStore.export(); // JSON
```

```typescript
// Feature opt-in pour reconstruction
class CartFeature extends Feature {
  // Entity reconstruite depuis l'event store au bootstrap
  static eventSourced = true;
  
  // Ou reconstruction manuelle
  async reconstructFromEvents(events: TCartEvent[]) {
    this.entity.reset();
    for (const event of events) {
      this.entity.apply(event);
    }
  }
}
```

| Avantages | Inconvénients |
|-----------|---------------|
| + **Non-breaking** (opt-in) | - Deux sources de vérité potentielles |
| + Flexible (quels events) | - Synchronisation Entity/EventStore |
| + Storage interchangeable | - Plus de configuration |
| + DevTools séparé | |

---

### Option C — Hybrid : Entity events + projection

**Description** : L'Entity enregistre ses propres events internes, projetés vers le Channel.

```typescript
class CartEntity extends Entity<TCartState> {
  // Events internes à l'Entity
  private events: TEntityEvent[] = [];
  
  addItem(item: Item) {
    // 1. Enregistrer l'event interne
    const event = this.record('ItemAdded', { item });
    
    // 2. Appliquer la mutation
    this.state.items.push(item);
    
    // 3. Notifier la Feature (qui émettra sur le Channel)
    this.notify(event);
  }
  
  // Replay interne
  replay(events: TEntityEvent[]): TCartState {
    return events.reduce(this.reducer, this.initialState);
  }
}

// La Feature projette vers le Channel
class CartFeature extends Feature {
  onEntityEvent(event: TEntityEvent) {
    // Mapper event interne → event Channel
    if (event.type === 'ItemAdded') {
      this.emit('cart:itemAdded', event.payload);
    }
  }
}
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Events internes = granulaires | - Deux niveaux d'events |
| + Channel events = publics | - Mapping à maintenir |
| + Reconstruction locale | - Complexité |

---

### Option D — Event Log externe (middleware)

**Description** : Un middleware capture tous les events sans modifier Entity/Feature.

```typescript
// Middleware transparent
const eventLogMiddleware = createEventLogMiddleware({
  storage: indexedDB,
  serialize: JSON.stringify,
  filter: (event) => !event.name.includes(':ui'),
});

const app = createApplication({
  middleware: [eventLogMiddleware],
});

// Le middleware intercepte tous les emit()
// et les stocke avant dispatch

// API de lecture
const log = app.getMiddleware('eventLog');
log.getAll(); // tous les events
log.query({ channel: 'cart', since: timestamp });
log.export(); // pour debug
```

| Avantages | Inconvénients |
|-----------|---------------|
| + **Zero impact** sur le code existant | - Pas de reconstruction native |
| + Ajout/retrait facile | - Middleware = indirection |
| + Capture exhaustive | - Pas intégré à Entity |

---

### Option E — Event Sourcing à la carte (recommandé)

**Description** : Plusieurs niveaux d'Event Sourcing selon les besoins.

```typescript
// NIVEAU 0 : Aucun event sourcing (défaut)
class SimpleFeature extends Feature { }

// NIVEAU 1 : Event Log (capture pour debug/audit)
const app = createApplication({
  eventLog: {
    enabled: process.env.NODE_ENV === 'development',
    storage: new InMemoryEventLog(),
  }
});

// NIVEAU 2 : Entity avec historique interne
class CartEntity extends TrackedEntity<TCartState> {
  // Historique des mutations conservé
  // Undo/redo disponible
  // Snapshot automatique
}

// NIVEAU 3 : Full Event Sourcing
class OrderEntity extends EventSourcedEntity<TOrderState, TOrderEvent> {
  // State = f(events)
  // Pas de mutation directe
  // Reconstruction obligatoire
  
  protected apply(event: TOrderEvent): void {
    switch (event.type) {
      case 'OrderCreated':
        this.state = { ...event.payload, items: [] };
        break;
      case 'ItemAdded':
        this.state.items.push(event.payload.item);
        break;
    }
  }
}
```

| Niveau | Use case | Overhead |
|--------|----------|----------|
| **0** | State simple, pas besoin d'historique | Aucun |
| **1** | Debug, audit, DevTools | Faible (log only) |
| **2** | Undo/redo, time-travel local | Moyen |
| **3** | Audit légal, CQRS, reconstruction | Élevé |

| Avantages | Inconvénients |
|-----------|---------------|
| + **Progressif** — on choisit le niveau | - Plus de types d'Entity |
| + Pas de breaking change | - Documentation plus riche |
| + Adapté à chaque use case | |
| + DevTools au niveau 1 minimum | |

---

## Analyse comparative

| Critère | A (Natif) | B (Store séparé) | C (Hybrid) | D (Middleware) | E (À la carte) |
|---------|-----------|------------------|------------|----------------|----------------|
| **Non-breaking** | ❌ | ✅ | ⚠️ | ✅ | ✅ |
| **Opt-in** | ❌ | ✅ | ⚠️ | ✅ | ✅ |
| **DX** | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| **Flexibilité** | ⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| **DevTools** | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| **Complexité impl.** | ⭐ | ⭐⭐ | ⭐ | ⭐⭐⭐ | ⭐⭐ |

---

## Décision

**⏳ En attente de décision**

### Recommandation : Option E (À la carte)

Justification :

1. **Progressif** : on commence simple, on monte en puissance si besoin
2. **Non-breaking** : Entity classique reste disponible
3. **Adapté** : chaque Feature choisit son niveau
4. **DevTools-friendly** : même le niveau 1 permet time-travel

### Hiérarchie de types proposée

```typescript
// Niveau 0 — Standard (existant)
Entity<TStructure>

// Niveau 1 — Avec log (nouveau, opt-in)
TrackedEntity<TStructure> extends Entity<TStructure>
  // + getHistory(): Mutation[]
  // + undo(): void
  // + redo(): void

// Niveau 2 — Event Sourced (nouveau, opt-in)  
EventSourcedEntity<TStructure, TEvent> extends Entity<TStructure>
  // + record(event: TEvent): void
  // + replay(events: TEvent[]): TStructure
  // + getEvents(): TEvent[]
```

### Intégration avec les metas

```typescript
// Chaque event stocké porte ses metas
type TStoredEvent<T = unknown> = {
  id: string;
  timestamp: number;
  channel: string;
  name: string;
  payload: T;
  metas: {
    correlationId: string;
    causationId: string | null;
    hop: number;
    origin: { kind: string; name: string };
  };
}

// Reconstruction avec causalité
eventStore.getEventChain(correlationId); // Tous les events d'une transaction
eventStore.getCausalGraph(eventId); // Graphe des causes/effets
```

### DevTools integration

```typescript
// Event Ledger (RFC-0004 à venir)
type TEventLedger = {
  // Visualisation
  timeline(): TimelineView;
  causalGraph(): GraphView;
  
  // Navigation
  goTo(eventId: string): void;
  stepBack(): void;
  stepForward(): void;
  
  // Export
  export(format: 'json' | 'mermaid'): string;
  
  // Replay
  replay(from: string, to: string): void;
}
```

---

## Conséquences

### Positives

- ✅ Time-travel debugging natif (niveau 1+)
- ✅ Undo/redo facile (niveau 2+)
- ✅ Audit complet avec causalité (niveau 3)
- ✅ Reconstruction après bug fix
- ✅ Pas de breaking change

### Négatives (acceptées)

- ⚠️ Plusieurs types d'Entity à connaître — mitigé par defaults sensibles
- ⚠️ Storage des events — configurable (in-memory, IndexedDB, external)

---

## Cas d'usage illustrés

### Debug : rejouer un bug

```typescript
// 1. Capturer les events en prod (niveau 1)
const events = errorReport.eventLog;

// 2. Rejouer localement
devTools.importEvents(events);
devTools.replay();

// 3. Observer l'état à chaque étape
devTools.stepThrough((state, event) => {
  console.log('After', event.name, ':', state);
});
```

### Undo/Redo (niveau 2)

```typescript
class DocumentEntity extends TrackedEntity<TDocumentState> {
  updateTitle(title: string) {
    this.state.title = title; // Auto-tracked
  }
}

// Dans la View
onUndoClick() {
  this.trigger('document:undo');
}

// Dans la Feature
onUndo() {
  this.entity.undo(); // Revient à l'état précédent
  this.emit('document:stateRestored', this.entity.getState());
}
```

### Audit légal (niveau 3)

```typescript
class PaymentEntity extends EventSourcedEntity<TPaymentState, TPaymentEvent> {
  protected apply(event: TPaymentEvent) {
    switch (event.type) {
      case 'PaymentInitiated':
        this.state = { status: 'pending', amount: event.payload.amount };
        break;
      case 'PaymentAuthorized':
        this.state.status = 'authorized';
        this.state.authCode = event.payload.authCode;
        break;
      case 'PaymentCaptured':
        this.state.status = 'captured';
        break;
    }
  }
}

// Audit : reconstruction de l'historique complet
const history = paymentEntity.getEvents();
// → Immutable, timestamped, avec metas causales
```

---

## Questions ouvertes

1. **Storage backend** : in-memory, IndexedDB, external API ? Configurable ?
2. **Rétention** : combien de temps garder les events ? Configurable par niveau ?
3. **Snapshots** : tous les N events ? À la demande ? Automatique ?
4. **Synchronisation** : si event store et Entity divergent ? (niveau 2)
5. **Versioning** : comment gérer les migrations de structure d'events ?

---

## Relation avec autres ADRs

| ADR | Relation |
|-----|----------|
| ADR-0001 (Entity diff) | Option E (Immer) génère des patches = events |
| ADR-0002 (Errors) | Erreurs dans replay ? Ignore ou fail ? |
| ADR-0003 (Channel) | EventLog = interception des emit() |
| ADR-0005 (Metas) | Metas = métadonnées des events stockés |

---

## Actions de suivi

- [ ] Prototyper `TrackedEntity` (niveau 2)
- [ ] Prototyper `EventSourcedEntity` (niveau 3)
- [ ] Définir l'API EventLog pour DevTools
- [ ] Benchmark : overhead du tracking
- [ ] RFC-0004 : DevTools / Event Ledger

---

## Références

- [Event Sourcing — Martin Fowler](https://martinfowler.com/eaaDev/EventSourcing.html)
- [CQRS + Event Sourcing](https://docs.microsoft.com/en-us/azure/architecture/patterns/cqrs)
- [Redux DevTools Time-Travel](https://github.com/reduxjs/redux-devtools)
- [Immer Patches](https://immerjs.github.io/immer/patches)
- [EventStoreDB](https://www.eventstore.com/)

---

## Historique

| Date | Changement |
|------|------------|
| 2026-03-17 | Création (Proposed) — 5 options, 4 niveaux |
