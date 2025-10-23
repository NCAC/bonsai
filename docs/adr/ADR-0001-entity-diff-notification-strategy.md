# ADR-0001 : Entity Mutation & Notification Strategy

| Champ | Valeur |
|-------|--------|
| **Statut** | 🟢 Accepted |
| **Date** | 2026-03-18 |
| **Décideurs** | @ncac |
| **RFC liée** | RFC-0002-entity |

---

## Contexte

L'Entity est le **cœur de la gestion d'état** dans Bonsai. Chaque Feature possède une Entity unique qui :

1. Stocke le state (`TEntityStructure extends TJsonSerializable`)
2. Notifie sa Feature des mutations via des handlers (`on<Key>EntityUpdated`, `onAnyEntityUpdated`)
3. Supporte snapshot/restauration (`toJSON`, `fromJSON`)

### Problème fondamental

**Comment muter et notifier les changements de manière performante, ergonomique et traçable ?**

### Enjeux identifiés (audit)

> *"Le principal risque est de loin le **coût et la complexité de la mécanique de notification**. Le document décrit un modèle avec snapshots avant/après, diff, changedKeys, handlers per-key, catch-all, ré-entrance, file FIFO, profondeur maximale. C'est conceptuellement très fort, mais c'est aussi un des coins les plus compliqués du runtime."*

### Exigences architecte

1. **API unique** : une seule méthode pour toutes les mutations (simples et profondes)
2. **Event Sourcing ready** : architecture compatible avec Event Sourcing futur
3. **Pas de magie** : explicite, pas de Proxy invisible ou dirty-tracking
4. **Pattern Immer** : élégant et naturel pour les mutations

---

## Contraintes

### Architecturales (RFC-0001, RFC-0002)

- **TJsonSerializable obligatoire** : le state doit être sérialisable
- **Immutabilité structurelle** : le state est conceptuellement immutable
- **Handlers auto-découverts** : `on<Key>EntityUpdated(prev, next, patches)` pattern
- **Entity privée** : jamais accessible hors de la Feature propriétaire
- **Traçabilité** : les mutations doivent capturer l'intention métier

### Performance

- UI hautement interactive (forms, drag-drop, real-time)
- Mutations potentiellement fréquentes
- State potentiellement large (listes de milliers d'items)

### DX

- Ergonomie de mutation naturelle
- Debugging facile (voir les diffs, time-travel)
- Undo/redo possible

---

## Décision

### API : `mutate(intent, params, recipe)`

> **Style guide** : Le premier argument est le **discriminant** (ici l'intent),
> suivi d'un objet de paramètres optionnel, puis de la recipe.
> Pattern : `method("NAME", { options }, callback)`

```typescript
class Entity<T extends TJsonSerializable> {
  /**
   * Mutate state via Immer draft.
   * 
   * @param intent - Intention métier (discriminant, ex: "cart:addItem")
   * @param params - Payload et metas pour traçabilité (optionnel)
   * @param recipe - Fonction de mutation sur le draft
   * @returns TEntityEvent avec patches pour Event Sourcing
   */
  mutate(
    intent: string,
    params: TMutationParams | null,
    recipe: (draft: Draft<T>) => void
  ): TEntityEvent;
  
  // Overload sans params (intent + recipe uniquement)
  mutate(
    intent: string,
    recipe: (draft: Draft<T>) => void
  ): TEntityEvent;
}

/**
 * Paramètres de mutation — payload et metas pour traçabilité.
 */
type TMutationParams = {
  /** Payload associé pour traçabilité (optionnel) */
  payload?: unknown;
  
  /** Metas pour traçabilité (correlationId, etc.) */
  metas?: TMessageMetas;
}

type TEntityEvent = {
  /** Intention métier (discriminant) */
  intent: string;
  
  /** Payload capturé */
  payload?: unknown;
  
  /** Metas pour traçabilité (correlationId, etc.) */
  metas?: TMessageMetas;
  
  /** Patches Immer (granulaires) */
  patches: Patch[];
  
  /** Patches inverses pour undo */
  inversePatches: Patch[];
  
  /** Timestamp de la mutation */
  timestamp: number;
  
  /** Clés de premier niveau affectées */
  changedKeys: string[];
}
```

### Usage canonique

```typescript
// Dans un handler de Feature
onAddToCart({ productId, quantity }: AddToCartPayload, metas: TMessageMetas) {
  // Pattern complet avec payload et metas
  const event = this.entity.mutate(
    "cart:addItem",
    { payload: { productId, quantity }, metas },
    draft => {
      draft.items.push({
        productId,
        quantity,
        addedAt: Date.now()
      });
      draft.itemCount = draft.items.length;
    }
  );
  
  // event.intent === "cart:addItem"
  // event.patches === [{ op: "add", path: ["items", 2], value: {...} }, ...]
  // event.changedKeys === ["items", "itemCount"]
}

// Forme simplifiée sans params
onClearCart() {
  this.entity.mutate("cart:clear", draft => {
    draft.items = [];
    draft.itemCount = 0;
  });
}
```

### Implémentation

```typescript
import { produceWithPatches, enablePatches, Patch, Draft } from 'immer';

enablePatches();

class Entity<T extends TJsonSerializable> {
  private _state: T;
  private _history: TEntityEvent[] = [];
  
  constructor(initialState: T) {
    this._state = initialState;
  }
  
  get state(): Readonly<T> {
    return this._state;
  }
  
  // Overload signatures
  mutate(
    intent: string,
    params: TMutationParams | null,
    recipe: (draft: Draft<T>) => void
  ): TEntityEvent;
  mutate(
    intent: string,
    recipe: (draft: Draft<T>) => void
  ): TEntityEvent;
  
  // Implementation
  mutate(
    intent: string,
    paramsOrRecipe: TMutationParams | null | ((draft: Draft<T>) => void),
    maybeRecipe?: (draft: Draft<T>) => void
  ): TEntityEvent {
    // Résoudre les arguments (overload)
    const params = typeof paramsOrRecipe === 'function' ? null : paramsOrRecipe;
    const recipe = typeof paramsOrRecipe === 'function' ? paramsOrRecipe : maybeRecipe!;
    
    const payload = params?.payload;
    const metas = params?.metas;
    
    const [nextState, patches, inversePatches] = produceWithPatches(
      this._state,
      recipe
    );
    
    // Extraire les clés de premier niveau affectées
    const changedKeys = [...new Set(patches.map(p => String(p.path[0])))];
    
    const event: TEntityEvent = {
      intent,
      payload,
      metas,
      patches,
      inversePatches,
      timestamp: Date.now(),
      changedKeys
    };
    
    // Mettre à jour le state
    this._state = nextState;
    
    // Historique pour undo/replay
    this._history.push(event);
    
    // Notifier les handlers
    this._notifyHandlers(event);
    
    return event;
  }
  
  private _notifyHandlers(event: TEntityEvent): void {
    // Handlers per-key : on<Key>EntityUpdated
    for (const key of event.changedKeys) {
      const handlerName = `on${capitalize(key)}EntityUpdated`;
      // Appel via le système de Feature (détail d'implémentation)
    }
    
    // Handler catch-all : onAnyEntityUpdated
    // Appelé après les handlers per-key
  }
  
  // Undo via inversePatches
  undo(): TEntityEvent | null {
    const lastEvent = this._history.pop();
    if (!lastEvent) return null;
    
    this._state = applyPatches(this._state, lastEvent.inversePatches);
    return lastEvent;
  }
}
```

---

## Handlers de notification

### Pattern per-key (recommandé)

```typescript
// Dans la Feature
type TCartState = {
  items: CartItem[];
  itemCount: number;
  total: number;
}

class CartFeature extends Feature<TCartState> {
  // Appelé quand 'items' change
  onItemsEntityUpdated(
    prev: CartItem[],
    next: CartItem[],
    patches: Patch[]
  ) {
    // Recalculer le total
    const total = next.reduce((sum, item) => sum + item.price * item.quantity, 0);
    this.entity.mutate("cart:recalculateTotal", draft => {
      draft.total = total;
    });
  }
  
  // Appelé pour toute mutation
  onAnyEntityUpdated(event: TEntityEvent) {
    // Broadcaster aux Views
    this.channel.emit("cart:updated", { state: this.entity.state });
  }
}
```

### Ordre d'appel

1. `on<Key>EntityUpdated` pour chaque clé affectée (ordre alphabétique)
2. `onAnyEntityUpdated` (catch-all)

---

## Event Sourcing Compatibility

L'architecture permet une évolution progressive vers Event Sourcing :

### Niveau 0 — État actuel (base)

```typescript
// Mutations trackées mais pas persistées
this.entity.mutate("cart:addItem", { payload }, draft => {...});
```

### Niveau 1 — Event Log (DevTools, debugging)

```typescript
// Les events sont loggés
class Entity {
  private _history: TEntityEvent[] = [];
  
  get eventLog(): readonly TEntityEvent[] {
    return this._history;
  }
}
```

### Niveau 2 — Replay (undo/redo, time-travel)

```typescript
// Replay via patches
entity.undo();
entity.redo();
entity.replayTo(timestamp);
```

### Niveau 3 — Event Sourcing complet (futur)

```typescript
// Persistence et reconstruction depuis events
await eventStore.persist(entity.eventLog);
const state = await eventStore.replay("cart-123");
```

### Structure de l'event (Event Sourcing ready)

```typescript
{
  // Niveau SÉMANTIQUE (pour Event Sourcing, logs, analytics)
  intent: "cart:addItem",
  payload: { productId: "abc", quantity: 2 },
  timestamp: 1710765432000,
  
  // Niveau TECHNIQUE (pour undo, DevTools, time-travel local)
  patches: [{ op: "add", path: ["items", 2], value: {...} }],
  inversePatches: [{ op: "remove", path: ["items", 2] }],
  changedKeys: ["items", "itemCount"]
}
```

---

## Pourquoi Immer ?

| Critère | Sans Immer | Avec Immer |
|---------|-----------|------------|
| **Mutations profondes** | Spread hell `{ ...state, items: [...state.items, newItem] }` | `draft.items.push(newItem)` |
| **Patches automatiques** | Implémentation manuelle complexe | Natif |
| **Structural sharing** | Manuel et error-prone | Automatique |
| **Undo/redo** | Snapshots complets (mémoire) | inversePatches (compact) |
| **Maturité** | — | 5+ ans, 25k+ stars, Redux Toolkit |

### Coût accepté

- **Dépendance** : ~12KB gzip — accepté pour la valeur apportée
- **Overhead** : ~microseconds par mutation — négligeable vs complexité évitée

---

## Anti-patterns

### ❌ Mutation sans intent clair

```typescript
// ❌ MAUVAIS — intent générique, pas de traçabilité
this.entity.mutate("update", draft => {
  draft.count++;
});

// ✅ BON — intent explicite et métier
this.entity.mutate("counter:increment", draft => {
  draft.count++;
});
```

### ❌ Muter les données pour filtrer/trier

Voir [ADR-0008 Anti-patterns](ADR-0008-collection-patterns.md#anti-patterns).

```typescript
// ❌ MAUVAIS — mute les items pour trier
this.entity.mutate("products:sort", draft => {
  draft.items.sort((a, b) => b.popularity - a.popularity);
});
// → ~300 patches !

// ✅ BON — mute les critères
this.entity.mutate("products:setSortCriteria", draft => {
  draft.sortCriteria = { field: "popularity", order: "desc" };
});
// → 1 patch
```

---

## Alternatives rejetées

### Option A — Snapshot + Deep Diff

```typescript
const prevSnapshot = structuredClone(this.state);
this.state[key] = value;
const diff = deepDiff(prevSnapshot, this.state);
```

**Rejeté** : Coût mémoire/CPU inacceptable (clone complet à chaque mutation).

### Option B — Proxy ES6 + Dirty Tracking

```typescript
this.state = new Proxy(state, {
  set: (target, prop, value) => {
    this.dirty.add(prop);
    // ...
  }
});
```

**Rejeté** : 
- Magie exposée (debugging difficile)
- Pas de patches sérialisables
- Pas de prev/next snapshot pour handlers

### Option D — Explicit Mutations + Dirty Flags

```typescript
this.set('quantity', 5);
this.update({ quantity: 5, price: 10 });
```

**Rejeté** : 
- Mutations profondes impossibles sans helper complexes
- Pas d'API unique

### Option E — Hybrid (set + mutate)

```typescript
this.entity.set('quantity', 5);           // Simple
this.entity.mutate(draft => {...});       // Complexe
```

**Rejeté** : 
- Deux APIs à connaître
- Incohérence potentielle
- Préférence architecte pour API unique

---

## Conséquences

### Positives

- ✅ **API unique** : `mutate(intent, params?, recipe)` pour tout
- ✅ **Event Sourcing ready** : intent + payload + patches
- ✅ **Undo/redo natif** : via inversePatches
- ✅ **Pas de magie exposée** : Immer est interne au draft scopé
- ✅ **DevTools riches** : visualisation des patches et intent
- ✅ **Traçabilité** : chaque mutation a une intention métier

### Négatives (acceptées)

- ⚠️ **Dépendance Immer** (~12KB gzip) — valeur > coût
- ⚠️ **Verbosité intent + params** — rigueur > concision

---

## Actions de suivi

- [x] Documenter anti-patterns filter/sort (ADR-0008)
- [ ] Implémenter `Entity.mutate()` avec Immer
- [ ] Implémenter handlers per-key auto-discovery
- [ ] Benchmark sur state réaliste (1000+ items)
- [ ] Intégration DevTools (visualisation events)
- [ ] Mettre à jour RFC-0002-entity

---

## Références

- [ADR-0008 Collection Patterns — Anti-patterns](ADR-0008-collection-patterns.md#anti-patterns)
- [ADR-0011 Event Sourcing Support](ADR-0011-event-sourcing-support.md)
- [RFC-0002-entity](../rfc/3-couche-abstraite/entity.md)
- [Immer documentation](https://immerjs.github.io/immer/)
- [Redux Toolkit — Immer integration](https://redux-toolkit.js.org/usage/immer-reducers)

---

## Historique

| Date | Changement |
|------|------------|
| 2026-03-17 | Création (Proposed) — 5 options documentées |
| 2026-03-18 | **Accepted** — API unique `mutate(intent, params?, recipe)` avec Immer |
