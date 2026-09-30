# Entity

> **Structure de données encapsulée : `TStructure`, mutations, query, notifications**

[← Retour à la couche abstraite](README.md) · [Feature](feature.md) · [Application](application.md)

---

| Champ | Valeur |
| --- | --- |
| **Chapitre** | 3 — Couche abstraite |
| **Composant** | Entity |
| **Couche** | Abstraite (persistante) |
| **Statut** | 🟢 Stable |
| **ADR** | [ADR-10](../../adr/ADR-10-entity-mutation.md) (mutation), [ADR-11](../../adr/ADR-11-entity-schema-valibot.md) (schema), [ADR-12](../../adr/ADR-12-entity-intent-typing.md) (typage de l'intent, 🟡), [ADR-04](../../adr/ADR-04-metas-explicites.md) (metas), [ADR-24](../../adr/ADR-24-hydratation-ssr.md) (SSR) |

> ## Statut normatif
>
> Ce document fait foi pour le **contrat Entity** : `Entity<TStructure>`, `mutate()`, query, notifications, sérialisation.

---

> ## ⏳ Périmètre d'implémentation
>
> | Élément | État | Sections |
> | --- | --- | --- |
> | `Entity<TStructure>`, `TEntityState<E>`, `mutate()` (patches Immer), query (convention `get query()`), notifications par clé et catch-all (dispatch par la Feature), ré-entrance FIFO | ✅ strate 0 + 1a | §1–§6 |
> | Schema Valibot (`get schema()`, ADR-11) | ⏳ strate 1 | — |
> | `toJSON()`, `fromJSON()`, `populateFromServer()` (ADR-24 H5) | ⏳ strate 2 (ADR-10, ADR-24) — absents de `Entity` | §1, §7 |
> | `eventLog` (historique des `TEntityEvent`) | ⏳ non planifié — n'existe pas | §7, §8 |
> | `undo()`, historique, event sourcing niveaux 1–3 | hors v1 ([roadmap](../../ROADMAP.md)) | §8 |
>
> **Détail du livré** : classe abstraite `Entity<TStructure extends TJsonSerializable>` (le générique s'appelle `TStructure` ; **il n'existe pas de type `TEntityStructure`**) dont la sous-classe implémente `protected defineInitialState()` ; getters publics `state` et `initialState` ; `mutate(intent, recipe)` et `mutate(intent, { payload?, metas? }, recipe)` via `Immer.produceWithPatches` ; `changedKeys` dérivées des patches ; `TEntityEvent` avec `patches`, `inversePatches`, `previousState`, `nextState`, `timestamp` ; mutation sans effet → aucune notification et `mutate()` retourne **`null`** ; recipe qui lève → `MutationError`, state intact (I97) ; ré-entrance mise en file FIFO (retour `null`), bornée par `maxEntityNotificationDepth` (défaut 3) → `EntityReentrancyError` (I98) ; abonnement catch-all `onAnyEntityUpdated(listener)`, dispatch per-key assuré par la Feature (I96).

## 📋 Table des matières

1. [Structure du state et classe abstraite Entity](#1-structure-du-state-et-classe-abstraite-entity)
2. [Contrainte jsonifiable](#2-contrainte-jsonifiable)
3. [Stockage de l'état](#3-stockage-de-létat)
4. [API de mutation : `mutate(intent, params?, recipe)`](#4-api-de-mutation--mutateintent-params-recipe)
5. [Méthodes de requête (query)](#5-méthodes-de-requête-query)
6. [Notifications Entity → Feature](#6-notifications-entity--feature)
7. [Sérialisation et snapshot](#7-sérialisation-et-snapshot)
8. [Event Sourcing Compatibility](#8-event-sourcing-compatibility)

---

## 1. Structure du state et classe abstraite Entity

### Le générique `TStructure`

La **structure de données** d'une Entity est le paramètre de type `TStructure` de
`Entity<TStructure extends TJsonSerializable>` : un plain object jsonifiable (ADR-10)
qui formalise la forme du state géré par la Feature. Il n'existe **pas** de type
public `TEntityStructure` : on écrit directement le type du state (`TCartState`) et on
le passe en générique.

La `Feature` n'est pas paramétrée par `TStructure` mais par sa CLASSE Entity
(`Feature<CartEntity, TCartDef, "cart">`, [ADR-09](../../adr/ADR-09-feature-contract.md)) ;
la structure d'état se retrouve par `TEntityState<CartEntity>`.

### Type utilitaire `TEntityState<E>`

Introduit par [ADR-09](../../adr/ADR-09-feature-contract.md).
Permet de dériver la structure d'état (`TStructure`) à partir d'une classe Entity concrète,
sans la redéclarer manuellement.

```typescript
/**
 * Extrait la structure d'état (TStructure) d'une classe Entity concrète.
 *
 * Utile pour typer des helpers, des sélecteurs ou des sérialiseurs qui
 * opèrent sur le state sans connaître a priori la forme.
 *
 * @example
 *   type TCartState = TEntityState<CartEntity>;  // = la forme du state de CartEntity
 */
export type TEntityState<E extends Entity<TJsonSerializable>> =
  E extends Entity<infer S> ? S : never;
```

> Exporté depuis `@bonsai/entity`. Permet d'écrire des utilitaires génériques
> sur n'importe quelle Entity sans dépendre de son type concret. `@bonsai/entity`
> exporte aussi `TJsonSerializable`, `TMutationParams`, `TEntityEvent` et
> `TEntityUpdateListener` ; `@bonsai/core` ne ré-exporte **pas** ce package
> ([ADR-28](../../adr/ADR-28-monorepo-packages.md)).

### Exemple concret

```typescript
/**
 * TCartState — structure du state du panier.
 *
 * Plain object jsonifiable : pas de Date, pas de Map,
 * pas de méthodes, pas de cycles. Co-localisé dans `cart.feature.ts`
 * (ADR-09) — pas de wrapper `namespace` TS (ADR-14).
 */
type TCartState = {
  items: Array<{ productId: string; qty: number }>;
  total: number;
  lastUpdated: number; // timestamp, pas Date
};

class CartEntity extends Entity<TCartState> {
  protected defineInitialState(): TCartState {
    return { items: [], total: 0, lastUpdated: 0 };
  }
}
```

### Classe abstraite Entity

```typescript
// Signatures livrées — packages/entity/src/bonsai-entity.ts
/**
 * Entity — structure de données encapsulée, typée et observable.
 *
 * L'Entity est le dépôt exclusif du state d'une Feature (I6, I22).
 * Elle est paramétrée par TStructure, contraint à TJsonSerializable (ADR-10).
 *
 * L'Entity a deux catégories de méthodes :
 * - `mutate()` — méthode unique de mutation, héritée (§4)
 * - Méthodes de requête (`query`) : lisent this.state, retournent des données dérivées (§5)
 *
 * L'Entity n'a JAMAIS accès aux Channels, ne peut jamais emit/trigger/listen.
 * Sa seule relation est avec sa Feature propriétaire (1:1:1, I22).
 */
abstract class Entity<TStructure extends TJsonSerializable> {
  /**
   * Le state courant — seule source de vérité.
   *
   * Getter public en **lecture seule** : la Feature propriétaire le lit
   * directement (`this.entity.state`). Toute écriture passe exclusivement
   * par `mutate()` (ADR-10, I6). L'Entity elle-même n'est accessible
   * qu'à sa Feature (`Feature.entity` est `protected` — I6).
   */
  get state(): TStructure;

  /**
   * État initial — méthode abstraite obligatoire (ADR-10, amendée strate 1a :
   * `defineInitialState()` remplace l'ancien getter `initialState`).
   *
   * Chaque Entity concrète DOIT l'implémenter pour fournir les valeurs
   * de départ. Dans la majorité des cas, ce sont des valeurs « zéro »
   * (null, [], 0, false, '') reflétant l'absence de toute commande reçue.
   */
  protected abstract defineInitialState(): TStructure;

  /**
   * État initial — valeur déjà calculée par le constructeur, exposée en
   * lecture pour comparaison/reset (ADR-10).
   */
  get initialState(): TStructure;

  /**
   * Profondeur maximale de ré-entrance (I98, défaut 3). Overridable par une
   * sous-classe (`protected get`) — voir §6.
   */
  protected get maxEntityNotificationDepth(): number;

  /**
   * Constructeur — appelle `defineInitialState()` par une initialisation
   * paresseuse interne (`#ensureInitialized()`), car les initialiseurs de
   * propriétés de la classe fille s'exécutent APRÈS `super()`.
   *
   * L'Entity est instanciée par sa Feature propriétaire, **jamais** dans
   * le constructeur de celle-ci (I94, ctor inerte) mais dans sa méthode
   * `bootstrap()` (Phase 3 — voir [feature.md §6](feature.md#6-accès-à-lentity)).
   * Le développeur n'appelle jamais ce constructeur directement.
   */
  constructor();

  // ── Méthode de mutation — héritée, unique (§4) ──
  // mutate(intent, recipe) / mutate(intent, { payload?, metas? }, recipe)

  /**
   * Souscription catch-all (I51). Sert à la Feature pour son dispatch (I96) ;
   * l'exception d'un listener n'est pas isolée ici (§6).
   */
  onAnyEntityUpdated(listener: TEntityUpdateListener<TStructure>): void;

  // ── Méthodes de requête (query) (à définir par la sous-classe) ──
  // Voir §5 — convention `get query()` qui regroupe les lectures dérivées.
  // Le framework n'en fournit aucune : `query` n'existe pas sur la classe de base.
}
```

> ⏳ **Non livrés** (aucune trace dans `Entity`) : `toJSON()`, `fromJSON(snapshot)`
> (restauration, DevTools — strate 2), `populateFromServer(state)` (pré-peuplement SSR
> silencieux, [ADR-24](../../adr/ADR-24-hydratation-ssr.md) H5, appelé par le framework
> entre les phases 1 et 3 de `start({ serverState })`), `eventLog`. Leur contrat cible est
> décrit en §7.

> **Invariants respectés** : I6 (seule la Feature modifie via `mutate()`),
> I22 (1:1:1 namespace ↔ Feature ↔ Entity), I46 (TStructure jsonifiable).

---

## 2. Contrainte jsonifiable

> **Décision ADR-10** : `TStructure` est **jsonifiable obligatoire**.
> Pas de classes imbriquées, pas de fonctions, pas de cycles, pas de `undefined`.

```typescript
/**
 * Contrainte de type : valeurs sérialisables en JSON.
 * Permet : string, number, boolean, null, arrays, plain objects.
 * Interdit : classes, fonctions, undefined, symbols, Date, Map, Set, cycles.
 */
type TJsonSerializable =
  | string
  | number
  | boolean
  | null
  | TJsonSerializable[]
  | { [key: string]: TJsonSerializable };
```

<!--
  Avantages de la contrainte jsonifiable :
  - Snapshot trivial (JSON.stringify)
  - Persistance (localStorage, sessionStorage, serveur)
  - Time-travel / undo-redo (hors v1, [roadmap](../../ROADMAP.md))
  - Sérialisation pour les Web Workers
  - Deep equality par JSON comparison (pour le diff)
  - Pas de surprises (pas de méthodes cachées, pas de prototypes)

  La contrainte porte sur TStructure (le state), pas sur l'Entity
  elle-même. L'Entity peut avoir des méthodes (mutation, query) —
  c'est le *state* qui est jsonifiable, pas la *classe*.
-->

### 2.1 Schema de validation

> ⏳ Strate 1 (ADR-11).
>
> Décision : [ADR-11](../../adr/ADR-11-entity-schema-valibot.md).

La forme jsonifiable ne dit rien des **règles métier** (quantité ≥ 0, email
valide). Chaque Entity concrète déclare donc un schema **Valibot** ; l'oubli ne
compile pas.

```typescript
const cartSchema = v.object({
  items: v.array(itemSchema),
  total: v.pipe(v.number(), v.minValue(0)),
});
type TCartState = v.InferOutput<typeof cartSchema>;

class CartEntity extends Entity<TCartState> {
  protected get schema(): TEntitySchema<TCartState> | null {
    return cartSchema;            // null réservé aux Entities triviales
  }
}
```

| Point d'entrée | Validation |
| --- | --- |
| `defineInitialState()` au bootstrap | toujours, échec immédiat |
| `fromJSON()`, `populateFromServer()` | toujours, production incluse |
| après chaque `mutate()` | en développement (`__DEV__`) seulement |

- Échec : `EntityValidationError`.
- **Le schema valide, il ne transforme jamais** (I63) : pas de `v.transform()`, pas de valeur par défaut dans `v.optional()`, pas de coercion. La normalisation (trim, minuscules) se fait dans le handler Command, avant `mutate()`.
- Le framework ne connaît que l'interface interne `TEntitySchema<T>` (`safeParse()`).

---

## 3. Stockage de l'état

L'Entity expose son état via un getter unique `state` en **lecture seule** ; seul `mutate()` le modifie.

### Principes de stockage

| Aspect | Règle |
| --- | --- |
| **Source unique** | `this.state` est la seule source de vérité du state de la Feature |
| **Lecture seule** | Getter public `state` — lisible par la Feature propriétaire ; l'Entity elle-même n'est accessible qu'à sa Feature (I6) |
| **Initialisé** | Via `protected abstract defineInitialState()` (ADR-10) — assigné dans le constructeur de la base class. Pas de state `undefined` possible |
| **Jsonifiable** | Toujours un plain object conforme à `TJsonSerializable` (ADR-10) |
| **Écriture contrôlée** | Seul `mutate()` produit un nouveau state (Immer) — aucune affectation directe |

### Accès au state depuis la Feature

La Feature interagit avec son Entity de deux manières :

- **Lecture** : via `this.entity.state`, ou via des méthodes de l'Entity quand la lecture encapsule une logique de données (calcul, filtrage — §5)
- **Écriture** : via **`this.entity.mutate()`** exclusivement (ADR-10)

```typescript
// ✅ Bonsai — query via l'objet query(), mutation via mutate()
class CartFeature extends Feature<CartEntity, TCartDef, "cart"> {
  onItemsRequest(_params: void): CartItem[] | null {
    return this.entity.query.getItems(); // lecture dérivée ✅ — voir §5
  }

  onAddItemCommand(payload: { productId: string; qty: number }): void {
    this.entity.mutate(
      // mutation via mutate() ✅
      "cart:addItem",
      { payload },
      (draft) => {
        draft.items.push({ productId: payload.productId, qty: payload.qty });
        draft.total += payload.qty;
      }
    );
    this.emit("itemAdded", payload);
  }
}

// ❌ Anti-pattern — écriture directe dans le state
class CartFeature extends Feature<CartEntity, TCartDef, "cart"> {
  onClearCommand(): void {
    this.entity.state.items.length = 0; // NON — contourne mutate() : pas de patches, pas de notification
  }
}
```

> **Règle** : la **lecture** du state est libre pour la Feature propriétaire
> (`this.entity.state`) ; dès qu'une lecture porte une logique de données
> (calcul, tri, agrégation), elle est encapsulée dans une méthode de l'Entity (§5).
> Les **écritures** passent exclusivement par `mutate()` (ADR-10).

<!--
  Implémentation interne (framework) :

  Le framework pourrait utiliser un BehaviorSubject<TStructure> (rxjs)
  en interne pour stocker le state et notifier les changements.
  Mais c'est un détail d'implémentation — le contrat est :
  - this.state est un TStructure
  - les méthodes de mutation modifient this.state
  - les méthodes query lisent this.state
  - les notifications sont émises automatiquement

  Options de stockage interne :
  - Plain object (this.state = { ... }) — simple, performant
  - Immer-like avec patches — pour le diff granulaire ([5-rendu](../5-rendu.md))
  - structuredClone avant mutation — pour l'historique ([devtools](../devtools.md))

  La spec ne contraint pas l'implémentation du stockage.
-->

---

## 4. API de mutation : `mutate(intent, params?, recipe)`

> **Décision ADR-10** : l'Entity expose une **méthode unique `mutate()`**
> qui utilise le pattern Immer pour les mutations et capture l'intention métier.
> Le premier argument est le **discriminant** (intent), suivi d'un objet params optionnel.
> Voir [ADR-10](../../adr/ADR-10-entity-mutation.md) pour le détail des alternatives évaluées.

### Signature

```typescript
abstract class Entity<TStructure extends TJsonSerializable> {
  /**
   * Mutate state via Immer produceWithPatches (ADR-31 strate 1a).
   *
   * @param intent - Intention métier (discriminant, ex: "cart:addItem")
   * @param recipe - Fonction de mutation sur le draft
   * @returns TEntityEvent, ou `null` si la mutation est un no-op
   *          (aucun patch produit) ou mise en file (ré-entrance, I98)
   */
  mutate(
    intent: string,
    recipe: (draft: Draft<TStructure>) => void
  ): TEntityEvent<TStructure> | null;

  // Overload avec params
  mutate(
    intent: string,
    params: TMutationParams,
    recipe: (draft: Draft<TStructure>) => void
  ): TEntityEvent<TStructure> | null;
}

/**
 * Paramètres de mutation — payload et metas pour traçabilité (strate 1a).
 * `metas` n'est encore qu'un `Record<string, unknown>` recopié tel quel
 * dans le `TEntityEvent` — le type `TMessageMetas` (ADR-04)
 * est cible strate 1b, cf. [metas.md](../2-architecture/metas.md).
 */
type TMutationParams = {
  /** Payload associé (optionnel) */
  payload?: unknown;
  /** Metas — opaques pour l'Entity, propagées telles quelles */
  metas?: Record<string, unknown>;
};

/**
 * TEntityEvent — voir §6 pour la définition canonique unique.
 * Source of truth : §6 Notifications Entity → Feature.
 */
```

### Usage canonique

```typescript
class CartEntity extends Entity<TCartState> {
  protected defineInitialState(): TCartState {
    return { items: [], total: 0, lastUpdated: 0 };
  }

  // Pas de méthodes de mutation individuelles.
  // Toute mutation passe par mutate() depuis la Feature.
}

// Dans la Feature — signature strate 0 : les handlers ne reçoivent que le payload.
// ⏳ Le 2ᵉ paramètre `metas: TMessageMetas` est une cible strate 1b (ADR-04) ;
// `mutate()` accepte déjà `{ payload, metas }` avec `metas: Record<string, unknown>`.
class CartFeature extends Feature<CartEntity, TCartDef, "cart"> {
  onAddItemCommand({ productId, qty }: AddItemPayload): void {
    this.entity.mutate(
      "cart:addItem",
      { payload: { productId, qty } },
      (draft) => {
        draft.items.push({ productId, qty });
        draft.total += qty;
        draft.lastUpdated = Date.now();
      }
    );
  }

  onRemoveItemCommand({ productId }: { productId: string }): void {
    this.entity.mutate(
      "cart:removeItem",
      { payload: { productId } },
      (draft) => {
        const index = draft.items.findIndex((i) => i.productId === productId);
        if (index >= 0) {
          draft.total -= draft.items[index].qty;
          draft.items.splice(index, 1);
          draft.lastUpdated = Date.now();
        }
      }
    );
  }

  onClearCartCommand(_payload: void): void {
    // Forme simplifiée sans params
    this.entity.mutate("cart:clear", (draft) => {
      draft.items = [];
      draft.total = 0;
      draft.lastUpdated = Date.now();
    });
  }
}
```

### Pourquoi Immer ?

| Critère | Sans Immer | Avec Immer |
| --- | --- | --- |
| **Mutations profondes** | Spread hell `{ ...state, items: [...] }` | `draft.items.push(item)` |
| **Patches automatiques** | Implémentation manuelle complexe | Natif |
| **Structural sharing** | Manuel et error-prone | Automatique |
| **Undo/redo** | Snapshots complets (mémoire) | inversePatches (compact) |
| **Maturité** | — | 5+ ans, 25k+ stars, Redux Toolkit |

> **Coût accepté** : Immer ajoute ~12KB gzip. La valeur (patches, undo, ergonomie)
> justifie ce coût. Voir ADR-10 Immer.

### Implémentation interne

Algorithme livré (`packages/entity/src/bonsai-entity.ts`, `Entity#mutate` et `#runCycle`) :

```typescript
// Pseudo-code fidèle au code livré (les champs `#` sont des hard privates ES2022)
mutate(intent, paramsOrRecipe, maybeRecipe?) {
  // 1. Résolution de l'overload → params (ou null) + recipe

  // 2. Ré-entrance (I98) : un cycle est déjà en cours → mise en file FIFO
  if (this.#draining) {
    if (this.#cycleDepth + this.#queue.length + 1 > this.maxEntityNotificationDepth)
      throw new EntityReentrancyError(/* … */);
    this.#queue.push({ intent, params, recipe });
    return null;                       // l'event n'existe pas encore
  }

  // 3. Appel externe : ce mutate() pilote le cycle initial puis la file
  this.#draining = true; this.#cycleDepth = 1;
  try {
    const first = this.#runCycle(intent, params, recipe);
    while (this.#queue.length > 0) {
      this.#cycleDepth += 1;
      const next = this.#queue.shift()!;
      this.#runCycle(next.intent, next.params, next.recipe);
    }
    return first;
  } finally { /* #draining = false ; #cycleDepth = 0 ; #queue vidée */ }
}

#runCycle(intent, params, recipe) {
  // Immer.produceWithPatches ; une exception de la recipe → MutationError
  const [nextState, patches, inversePatches] = Immer.produceWithPatches(this.#state, recipe);
  if (patches.length === 0) return null;                       // no-op : pas de notification
  const changedKeys = [...new Set(patches.map((p) => String(p.path[0])))];
  this.#state = nextState;
  const event = { intent, payload: params?.payload, metas: params?.metas,
                  changedKeys, patches, inversePatches,
                  previousState, nextState, timestamp: Date.now() };
  for (const listener of this.#listeners) listener(event);   // aucun try/catch ici
  return event;
}
```

> Ni historique (`_history`, `eventLog`), ni `undo()` : ces éléments relèvent de
> l'event sourcing hors v1 (§8, [roadmap](../../ROADMAP.md)). Les `inversePatches` sont
> calculés et exposés dans le `TEntityEvent`, mais rien ne les consomme aujourd'hui.

### Anti-patterns

#### ❌ Mutation sans intent clair

```typescript
// ❌ MAUVAIS — intent générique
this.entity.mutate("update", (draft) => {
  draft.count++;
});

// ✅ BON — intent explicite et métier
this.entity.mutate("counter:increment", (draft) => {
  draft.count++;
});
```

#### ❌ Muter les données pour filtrer/trier

Voir [ADR-23 Anti-patterns](../../adr/ADR-23-listes.md).

```typescript
// ❌ MAUVAIS — mute les items pour trier → ~300 patches !
this.entity.mutate("products:sort", (draft) => {
  draft.items.sort((a, b) => b.popularity - a.popularity);
});

// ✅ BON — mute les critères → 1 patch
this.entity.mutate("products:setSortCriteria", (draft) => {
  draft.sortCriteria = { field: "popularity", order: "desc" };
});
// La View applique le tri lors du rendu
```

### Sémantique des mutations sans effet (no-op)

Si la `recipe` passée à `mutate()` ne modifie pas le draft (Immer détecte zéro patch) :

| Aspect | Comportement |
| --- | --- |
| **State** | Inchangé |
| **Notifications** | **Non émises** — aucun handler per-key ni `onAnyEntityUpdated` n'est appelé |
| **Valeur retournée** | `mutate()` retourne **`null`** — pas de `TEntityEvent` (I97) |
| **Events Channel** | Dépend entièrement du code du command handler — si `this.emit()` est appelé explicitement après `mutate()`, l'Event est émis même si la mutation est un no-op |

> **Conséquence architecturale** : un command handler qui émet systématiquement un Event
> sans vérifier le résultat de la mutation peut émettre un Event pour une opération
> sans effet réel (ex: `clear` sur un panier déjà vide). Il est recommandé de vérifier
> que `mutate()` n'a **pas** retourné `null` avant d'émettre si l'Event doit refléter
> un changement réel :
>
> ```typescript
> onClearCartCommand(): void {
>   const event = this.entity.mutate("cart:clear", draft => {
>     draft.items = [];
>   });
>   // N'émet que si quelque chose a vraiment changé (mutate() a retourné un event)
>   if (event !== null) {
>     this.emit('cleared', undefined);
>   }
> }
> ```

---

## 5. Méthodes de requête (query)

L'Entity peut contenir de la **logique de données** — des méthodes
qui dérivent, filtrent, trient, agrègent ou transforment le state
pour répondre aux besoins de la Feature.

> **Distinction clé** :
>
> - **Logique métier** (Feature) : orchestration, décisions, réactions aux commands/events
> - **Logique de données** (Entity) : calcul, filtrage, tri, agrégation sur le state
>
> La Feature reçoit une demande métier (request) et la **traduit** en
> interrogation du state. L'Entity **répond** avec les données,
> potentiellement calculées. L'Entity ne sait pas _pourquoi_ on lui
> demande — elle sait _comment_ répondre à partir de son state.
>
> **Règle** : les méthodes query **ne modifient jamais** `this.state`.
> Elles sont pures : même entrée → même sortie.

Ces méthodes servent principalement aux **request handlers** de la Feature :
la Feature reçoit un request et délègue la lecture à son Entity.

> **Convention `query`** : les lectures dérivées sont regroupées dans un
> getter unique `get query()` retournant un objet de méthodes — plutôt que
> des méthodes nommées directement sur l'Entity. C'est le pattern du gate
> E2E (`tests/fixtures/cart-feature.fixture.ts`) : il distingue visuellement
> les lectures dérivées de `state` (accès direct, §3) et évite de polluer
> la surface publique de la classe Entity avec des dizaines de méthodes.

```typescript
type TInventoryState = {
  products: Array<{ id: string; stock: number }>;
};

class InventoryEntity extends Entity<TInventoryState> {
  protected defineInitialState(): TInventoryState {
    return { products: [] };
  }

  // ── Lectures dérivées — regroupées dans `query` ──
  get query() {
    return {
      /** Retourne les produits dont le stock est > 0 */
      getAvailableProducts: (): Product[] =>
        this.state.products.filter((p) => p.stock > 0),

      /** Retourne le stock d'un produit spécifique */
      getStockLevel: (productId: string): number =>
        this.state.products.find((p) => p.id === productId)?.stock ?? 0,

      /** Retourne le nombre total de références en stock */
      getAvailableCount: (): number =>
        this.state.products.filter((p) => p.stock > 0).length
    };
  }
}
```

### Utilisation dans les request handlers de Feature

La Feature **délègue** la logique de lecture à son Entity :

```typescript
class InventoryFeature
  extends Feature<InventoryEntity, TInventoryDef, "inventory">
  implements TFeatureCallbacks<TInventoryDef, readonly []>
{
  // La Feature reçoit le request, l'Entity fournit la réponse via `query`

  onAvailableProductsRequest(_params: void): Product[] | null {
    return this.entity.query.getAvailableProducts();
  }

  onStockLevelRequest(params: { productId: string }): number | null {
    return this.entity.query.getStockLevel(params.productId);
  }
}
```

> **Séparation des responsabilités** :
>
> - **Feature** : reçoit les requests métier (via Channel), traduit en interrogation du state, orchestre, émet les events
> - **Entity** : encapsule le state, fournit les données (query, potentiellement calculées) et les mutations
>
> La Feature ne contient pas de logique de calcul/filtrage/tri du state.
> L'Entity ne connaît pas les Channels et ne prend aucune décision métier.
> Chacun dans son rôle.

### Typage des méthodes query

Les méthodes query ne sont **pas contraintes par un type générique**
au niveau de la classe abstraite `Entity`. Elles sont libres dans
la sous-classe concrète. Cependant, le type de retour d'une méthode
query DOIT être `TJsonSerializable` (puisqu'il transite via un Channel
en `T | null` synchrone pour les requests — ADR-02).

```typescript
/**
 * Contrainte implicite sur les retours de méthodes query :
 * tout ce qui est retourné via un request handler transite
 * en T | null (synchrone) où T est déclaré dans TChannelDefinition.requests.
 * T est donc contraint à TJsonSerializable par construction.
 */
```

<!--
  Distinction mutation vs query — conventions de nommage :

  | Catégorie | Convention | Retour | Side-effect |
  |---|---|---|---|
  | Mutation  | verbe d'action : add, remove, update, set, clear, mark... | void | Oui (modifie state) |
  | Query     | get, find, has, is, count, compute... | T (jsonifiable) | Non (lecture seule) |

  Le framework pourrait vérifier que les méthodes préfixées par 'get'
  ne modifient pas this.state (en mode debug, via Proxy). À évaluer.
-->

---

## 6. Notifications Entity → Feature

Quand le state d'une Entity change (via `mutate()`), la Feature
propriétaire doit en être informée. Ce mécanisme est un
**protocole framework interne** (L1) — pas un Channel.

> **Inspiration** : le pattern est directement inspiré du Model de
> **Marionette.js / Backbone.js**, qui émet des événements `change:key`
> (pour une propriété spécifique) et `change` (pour tout changement).
> Bonsai adapte ce pattern à la convention `onXXX` auto-découverte (ADR-09).

### Deux types de handlers Entity

Le framework fournit **deux granularités** de notification, toutes deux
optionnelles et auto-découvertes par la convention `onXXX` :

| Type | Pattern | Paramètres | Quand déclenché |
| --- | --- | --- | --- |
| **Per-key** | `on<Key>EntityUpdated` | `prev: T, next: T, patches: Patch[]` | Quand la propriété `key` de `TStructure` change |
| **Catch-all** | `onAnyEntityUpdated` | `event: TEntityEvent` | Quand n'importe quelle propriété change |

> **Pourquoi `any` plutôt que `all`** : `onAllEntityUpdated` est ambigu —
> on pourrait lire « quand TOUTES les clés changent simultanément ».
> `onAnyEntityUpdated` est sans ambiguïté : « quand N'IMPORTE QUELLE clé change ».

### TEntityEvent — type canonique

```typescript
/**
 * TEntityEvent — notification de mutation de state (ADR-31 strate 1a).
 *
 * Retourné par mutate() après une mutation non no-op (sinon `null` — §4).
 * Contient l'intention métier ET les patches techniques.
 * Voir ADR-10 pour les détails.
 */
type TEntityEvent<TStructure extends TJsonSerializable = TJsonSerializable> = {
  /** Intention métier (ex: "cart:addItem") */
  readonly intent: string;

  /** Payload capturé pour traçabilité (optionnel — cf. overload sans params) */
  readonly payload?: unknown;

  /** Metas propagées telles quelles depuis TMutationParams — opaques pour l'Entity */
  readonly metas?: Record<string, unknown>;

  /** Clés de premier niveau affectées (dérivées du 1er segment de path des patches) */
  readonly changedKeys: string[];

  /** Patches Immer (granulaires, JSON-compatible) */
  readonly patches: Patch[];

  /** Patches inverses pour undo (post-v1) */
  readonly inversePatches: Patch[];

  /** State avant la mutation */
  readonly previousState: TStructure;

  /** State après la mutation */
  readonly nextState: TStructure;

  /** Timestamp de la mutation */
  readonly timestamp: number;
};
```

### Template literal types — génération des noms de handlers Entity

> ⚠️ **Illustratif, non exporté** : `ExtractEntityKeyHandlerName` et `TEntityKeyHandlers`
> n'existent dans aucun package. Il n'y a **aucune imposition compile-time** des handlers
> Entity (pas de `implements`) : seule la détection runtime d'une clé inconnue au
> bootstrap est livrée (I96). Les types ci-dessous décrivent la convention.

```typescript
/**
 * Génère le nom de handler per-key depuis une clé de TStructure.
 * "items" → "onItemsEntityUpdated"
 * "total" → "onTotalEntityUpdated"
 */
type ExtractEntityKeyHandlerName<TKey extends string> =
  `on${Capitalize<TKey>}EntityUpdated`;

/**
 * Mapped type — signatures optionnelles des handlers Entity per-key.
 */
type TEntityKeyHandlers<TStructure extends TJsonSerializable> = Partial<{
  [K in keyof TStructure as ExtractEntityKeyHandlerName<K & string>]: (
    prev: TStructure[K],
    next: TStructure[K],
    patches: Patch[]
  ) => void;
}>;
```

### Flux de notification

```text
Feature                              Entity
───────                              ──────
this.entity.mutate(                  │
  "cart:addItem",                    │
  { payload: {...} },                │
  draft => {                         │
  draft.items.push(item);            │
  draft.total += item.qty;           │
});                                  │
                                     ├─ 1. produceWithPatches() — Immer
                                     │     → génère patches + inversePatches
                                     ├─ 2. changedKeys = ['items', 'total']
                                     ├─ 3. crée TEntityEvent
                                     └─ 4. notifications :
← onItemsEntityUpdated(prev, next, patches)   a) per-key 'items'
← onTotalEntityUpdated(prev, next, patches)   b) per-key 'total'
← onAnyEntityUpdated(event)                   c) catch-all
```

> **Ordre de notification** : per-key d'abord (ordre alphabétique de `changedKeys`),
> puis catch-all. Le catch-all reçoit l'`TEntityEvent` complet avec intent et patches.

### Ré-entrance, cascades et déduplication

#### Ré-entrance — mutation pendant un cycle de notification

Si un entity handler (per-key ou catch-all) **re-mute l'Entity**
pendant le cycle de notification, la mutation est **mise en file**
(queued). Elle n'est pas appliquée immédiatement — elle sera
exécutée **après** la fin du cycle courant, déclenchant un
nouveau cycle.

Un compteur de **profondeur de cycle** protège contre les boucles :
si la profondeur dépasse un seuil configurable (`maxEntityNotificationDepth`,
défaut : 3), le framework rejette la mutation avec une erreur explicite.

```text
Cycle 1 : mutate("cart:addItem", ...) → Immer → onItemsEntityUpdated()
                                                   └─ this.entity.mutate("cart:recalculate", ...)  ← MIS EN FILE
          onAnyEntityUpdated()
Cycle 2 : mutate("cart:recalculate", ...) → Immer → onTotalEntityUpdated()
          onAnyEntityUpdated()
(fin — pas de nouvelle mutation en file)
```

> **Règle** : les mutations en file sont appliquées dans l'ordre
> FIFO. Chaque mutation produit son propre cycle complet.
> Le state évolue de façon prévisible, sans récursion incontrôlée.
> `mutate()` retourne `null` pour une mutation mise en file.
>
> ⚠️ **Débordement de profondeur** : `mutate()` lève `EntityReentrancyError`. Depuis un
> handler de Feature (`on<Key>EntityUpdated`, `onAnyEntityUpdated`), cette exception est
> attrapée par le dispatch de la Feature (I96) et journalisée en `BroadcastError` : elle
> n'atteint pas l'appelant externe. Elle ne se propage qu'à travers un listener brut
> enregistré via `entity.onAnyEntityUpdated()`.

#### Cascades via Channel — couvertes par I9

Un entity handler peut émettre un Event (`this.emit(...)`).
Cet Event traverse les Channels et peut déclencher des réactions
dans d'autres Features, qui peuvent elles-mêmes muter leurs Entities,
émettre d'autres Events, etc.

Ce scénario est **couvert par I9** (anti-boucle `hop > maxHops`) — ⏳ strate 1b,
aucune notion de `hop` n'existe aujourd'hui. Chaque `emit()` incrémenterait le `hop`
dans les metas (I7), et le framework rejetterait le message si la profondeur maximale
est atteinte. Aucun mécanisme supplémentaire n'est prévu.

#### Déduplication — responsabilité du développeur

Le framework **ne déduplique pas** les Events émis par les handlers.
Si un per-key handler ET le catch-all émettent le même Event,
ce sont deux Events distincts (avec des metas distinctes).

> **Guidance** : pour une réaction donnée, choisir **une seule approche**
> (voir tableau ci-dessous). Ne pas émettre le même Event depuis
> un per-key ET un catch-all — c'est un anti-pattern qui produit
> des notifications redondantes.

#### Per-key handlers — réagir à une propriété spécifique

```typescript
class CartFeature extends Feature<CartEntity, TCartDef, "cart"> {
  protected get Entity() {
    return CartEntity;
  }

  // ── Per-key : réagir quand 'items' change ──

  onItemsEntityUpdated(
    prev: Array<{ productId: string; qty: number }>,
    next: Array<{ productId: string; qty: number }>,
    patches: Patch[]
  ): void {
    // Émettre un Event avec le delta
    // Note : les entity handlers n'ont pas de paramètre metas — elles sont
    // portées par le TEntityEvent (catch-all). `emit()` n'accepte pas de metas
    // aujourd'hui (⏳ strate 1b, ADR-04).
    // Préférer l'émission depuis le command handler (voir tableau ci-dessous).
    const added = next.filter(
      (item) => !prev.some((p) => p.productId === item.productId)
    );
    if (added.length > 0) {
      this.emit("itemAdded", added[0]);
    }
  }

  // ── Per-key : réagir quand 'total' change ──

  onTotalEntityUpdated(prev: number, next: number): void {
    this.emit("totalUpdated", { total: next, previous: prev });
  }
}
```

#### Catch-all handler — réagir à tout changement

```typescript
class UserFeature extends Feature<UserEntity, TUserDef, "user"> {
  protected get Entity() {
    return UserEntity;
  }

  /**
   * Déclenché pour TOUT changement de state.
   * Reçoit l'TEntityEvent complet avec intent, payload et patches.
   * Utile pour : logging, analytics, persistance, broadcast.
   */
  onAnyEntityUpdated(event: TEntityEvent): void {
    // Logging : quelle intention et quelles clés ?
    console.debug("[User]", event.intent, event.changedKeys);

    // Persistance automatique après toute mutation
    localStorage.setItem("user", JSON.stringify(this.entity.state));

    // Broadcaster aux Views — `event.metas` est disponible, mais `emit()` ne
    // sait pas encore le propager (⏳ strate 1b : `emit(name, payload, { metas })`)
    this.emit("profileUpdated", { state: this.entity.state });
  }
}
```

#### Combinaison : command handler + entity handler

```typescript
class InventoryFeature extends Feature<InventoryEntity, TInventoryDef, "inventory"> {
  protected get Entity() {
    return InventoryEntity;
  }

  // ── Command handler : traite l'intention ──

  onReserveStockCommand(
    payload: { productId: string; qty: number }
  ): void {
    // La Feature mute l'Entity via mutate().
    // Les handlers per-key se déclenchent ensuite.
    this.entity.mutate(
      "inventory:reserveStock",
      { payload },
      (draft) => {
        const product = draft.products.find((p) => p.id === payload.productId);
        if (product) {
          product.stock -= payload.qty;
        }
      }
    );
    // Pas de this.emit() ici — c'est le handler per-key qui s'en charge.
  }

  // ── Entity per-key handler : réagit au changement ──

  onProductsEntityUpdated(
    prev: Product[],
    next: Product[],
    patches: Patch[]
  ): void {
    // Un produit est passé en rupture de stock ?
    const nowOutOfStock = next.filter(
      (p) => p.stock === 0 && prev.find((pp) => pp.id === p.id)?.stock !== 0
    );
    for (const product of nowOutOfStock) {
      this.emit("stockDepleted", { productId: product.id });
    }
  }
}
```

> **Philosophie : séparation intention / réaction** :
>
> - Le **command handler** (`onReserveStockCommand`) traite l'intention et mute l'Entity
> - Le **entity handler** (`onProductsEntityUpdated`) réagit au changement de state et émet les Events
>
> Cette séparation évite la duplication : si 3 commands différents modifient `products`,
> le handler `onProductsEntityUpdated` centralise la logique de réaction.

### Relation avec les command handlers — quand utiliser quoi ?

| Approche | Quand l'utiliser | Avantage | Exemple |
| --- | --- | --- | ---- |
| **Emit dans le command handler** | Relation 1:1 entre un command et un event | Explicite, linéaire | `onAddItemCommand(payload) { ... this.emit('itemAdded', payload) }` |
| **Entity per-key handler** | Plusieurs commands modifient la même propriété | Centralise la réaction | `onProductsEntityUpdated() { ... }` |
| **Entity catch-all** | Réaction transversale (logging, persistance) | Un seul point | `onAnyEntityUpdated() { ... }` |

> Les trois approches sont **compatibles** et peuvent coexister dans la même Feature.
> L'emit dans le command handler s'exécute **avant** les entity handlers
> (puisqu'il est appelé explicitement dans le corps du command handler,
> tandis que les entity handlers sont déclenchés après la mutation).

### Auto-découverte — cohérence avec ADR-09

Les entity handlers suivent exactement le même mécanisme d'auto-découverte
que les Channel handlers (ADR-09) :

```text
Suffixe                  Mécanisme          Source de vérité
─────────────────────    ─────────────────   ─────────────────────────
onXxxCommand             Channel handler     TChannel['commands']
onXxxEvent               Channel handler     listen[].TChannel['events']
onXxxRequest             Channel handler     TChannel['requests']
on<Key>EntityUpdated     Entity handler      keyof TStructure
onAnyEntityUpdated       Entity handler      (catch-all, pas de source)
```

Au bootstrap, le framework :

1. Introspecte les méthodes de la Feature
2. Les méthodes terminant par `EntityUpdated` sont identifiées comme entity handlers
3. Pour les per-key : le framework vérifie que `<Key>` (première lettre en minuscule) correspond à une clé du **state initial à l'exécution** (`Object.keys(entity.state)`) — pas au type `TStructure` : une clé optionnelle absente du state initial est rejetée ; `<Key>` ne contient que des lettres, et `Any` est réservé au catch-all
4. Pour le catch-all : `onAnyEntityUpdated` est câblé sans vérification de clé
5. Si un handler `on<Key>EntityUpdated` référence une clé inexistante → erreur bootstrap

<!--
  Implémentation interne des notifications :

  Le framework utilise rxjs en interne (voir communication.md, note rxjs) :
  - Un Subject par Entity pour les notifications de changement
  - Le framework wrap les méthodes de mutation de l'Entity
    (via Proxy sur this.state ou wrapping explicite au bootstrap)
  - Après chaque mutation, le framework :
    a) Calcule le diff (changedKeys)
    b) Pour chaque changedKey, appelle le handler per-key s'il existe
    c) Appelle le handler catch-all s'il existe
  - Les souscriptions sont gérées par le framework (subscribe au
    bootstrap, unsubscribe au shutdown)

  Ré-entrance :
  - Les mutations déclenchées pendant un cycle de notification sont
    mises en file (queue FIFO), pas exécutées immédiatement.
  - Après le cycle courant (tous les per-key + catch-all appelés),
    le framework dépile la file et exécute chaque mutation en
    déclenchant un nouveau cycle complet.
  - Un compteur de profondeur (maxEntityNotificationDepth, défaut 3)
    protège contre les boucles infinies.
  - Ce mécanisme est transparent pour le développeur — il appelle
    this.entity.mutate() normalement, le framework gère la file.

  Cascades inter-Features :
  - Couvertes par I9 (hop > maxHops). Pas de mécanisme supplémentaire.

  Déduplication :
  - Le framework ne déduplique PAS les Events émis.
  - Si le développeur émet le même Event dans un per-key ET un
    catch-all, ce sont deux Events distincts avec metas distinctes.
  - Déduplication automatique = magie imprévisible, rejetée.

  Le catch-all `onAnyEntityUpdated` est inspiré du `change` de
  Backbone/Marionette, renommé `any` pour éviter l'ambiguïté de `all`.
  Les per-key sont inspirés de `change:attribute`.

  ⚠️ Tout ce mécanisme est de la mécanique interne.
  Le contrat de typage est :
  - Per-key : on<Key>EntityUpdated(prev, next, patches)
  - Catch-all : onAnyEntityUpdated(TEntityEvent)
  L'implémentation (Immer, rxjs, callback) est interne.
-->

---

## 7. Sérialisation et snapshot

> ⏳ **Cible, non livré** — `Entity` n'expose ni `toJSON()`, ni `fromJSON()`, ni
> `populateFromServer()`, ni `eventLog` (voir le bandeau de périmètre en tête de document
> et [ADR-10](../../adr/ADR-10-entity-mutation.md), strate 2). Le contrat ci-dessous est
> celui visé : `toJSON()`/`fromJSON()` pour le snapshot DevTools et la persistance,
> `populateFromServer()` pour le pré-peuplement SSR ([ADR-24](../../adr/ADR-24-hydratation-ssr.md) H5,
> usage interne framework uniquement).

```typescript
// ⏳ Cible — n'existe pas dans le code livré
abstract class Entity<TStructure extends TJsonSerializable> {
  /** Retourne une copie profonde du state courant */
  toJSON(): TStructure {
    return structuredClone(this.state);
  }

  /** Restaure le state depuis un snapshot — peut déclencher des notifications */
  fromJSON(snapshot: TStructure): void;

  /**
   * Pré-peuple silencieusement le state depuis un état sérialisé serveur.
   *
   * Appelé uniquement par le framework, entre les phases 1 et 3 du bootstrap,
   * si `start({ serverState })` contient une entrée pour ce namespace
   * ([application.md §3.1](application.md#31-cible)).
   *
   * **Silencieux** : aucun Event, aucune notification, aucun `any`.
   * Conçu pour le SSR où le DOM reflète déjà ces données (ADR-24 H4/H5).
   *
   * @param state — le state sérialisé côté serveur
   * @internal — framework only
   */
  populateFromServer(state: TStructure): void;
}
```

<!--
  toJSON() retournera une copie profonde pour garantir l'encapsulation (I6) :
  le consommateur ne pourra pas muter le state en modifiant le résultat.

  fromJSON() permettra la restauration d'un snapshot (DevTools, persistance).

  Ces méthodes sont la base du time-travel (hors v1).
-->

---

## 8. Event Sourcing Compatibility

> ⏳ **Post-v1** : cette section documente la compatibilité de l'architecture
> avec Event Sourcing. Seul le niveau 0 (mutations tracées par le `TEntityEvent`) est
> livré ; `eventLog` (niveau 1), undo/redo et persistence (niveaux 2 et 3) sont des
> extensions hors v1. Les exemples ci-dessous sont **illustratifs** : `eventLog`,
> `undo()` et `fromJSON()` n'existent pas.
>
> Voir [ADR-10](../../adr/ADR-10-entity-mutation.md) et
> la [roadmap](../../ROADMAP.md) pour la piste event sourcing.

L'architecture de mutation permet une évolution progressive vers Event Sourcing :

### Niveaux de support

| Niveau | Nom | Description | Bonsai v1 |
| --- | --- | --- | --- |
| **0** | Base | Mutations tracées par le `TEntityEvent` (intent, payload, patches, `inversePatches`), non persistées ni conservées | ✅ Livré |
| **1** | EventLog | Events accessibles via `entity.eventLog` | ⏳ Non livré — `eventLog` n'existe pas |
| **2** | Replay | Undo/redo via `inversePatches` | ⏳ Extension |
| **3** | Persistence | Stockage et reconstruction depuis events | ⏳ Extension |

### Structure du TEntityEvent (Event Sourcing ready)

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

### Exemple : replay depuis eventLog

```typescript
// Time-travel : rejouer l'état à un moment donné
function replayTo(entity: Entity, timestamp: number): void {
  const events = entity.eventLog.filter((e) => e.timestamp <= timestamp);
  entity.fromJSON(entity.initialState);
  for (const event of events) {
    applyPatches(entity.state, event.patches);
  }
}

// Undo : annuler la dernière mutation
const undoneEvent = entity.undo();
// → applique inversePatches, retire l'event de l'historique
```

### Interopérabilité avec CQRS/Event Sourcing

Pour un système Event Sourcing complet, l'`intent` + `payload` constituent
l'**événement métier** tandis que les `patches` sont l'**état dérivé**.

```typescript
// Event Store — stocke uniquement intent + payload
eventStore.append({
  aggregateId: "cart-123",
  eventType: event.intent, // "cart:addItem"
  payload: event.payload, // { productId, qty }
  timestamp: event.timestamp
});

// Reconstruction — rejoue les events pour reconstruire l'état
const events = await eventStore.getEvents("cart-123");
const state = events.reduce((state, event) => {
  return applyBusinessEvent(state, event);
}, initialState);
```

<!--
  toJSON() retourne une copie profonde pour garantir l'encapsulation (I6) :
  le consommateur ne peut pas muter le state en modifiant le résultat.

  fromJSON() permet la restauration d'un snapshot (DevTools, persistance).

  Ces deux méthodes sont la base du time-travel (hors v1).
-->
