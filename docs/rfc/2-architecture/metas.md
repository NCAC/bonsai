# Tracabilite et metadonnees causales

> **Metas, ULID, correlationId, propagation explicite, garde-fous anti-boucle**

[← Retour à l'architecture](README.md) · [← Cycle de vie](lifecycle.md)

---

> **ADR-0005 (Accepted)** : toutes les decisions ci-dessous sont normatives.
> **ADR-0016 (Accepted)** : signature des handlers `(payload, metas)`.

## 1. Structure des metas

Chaque message (Command, Event **et** Request) porte des **metadonnees causales completes** (I7) :

```typescript
type TMessageMetas = {
  // ── Identite ──
  /** Identifiant unique du message — ULID (triable temporellement) */
  messageId: string;

  // ── Causalite ──
  /**
   * Transaction logique — cree par l'UI ou le systeme, jamais modifie ensuite (I8).
   * Prefixe 'usr-' (initie par l'UI) ou 'sys-' (initie par le framework/timer).
   */
  correlationId: string;

  /** Message parent direct — null si racine (premier trigger) */
  causationId: string | null;

  /** Profondeur dans la chaine causale — 0 = racine, +1 a chaque reaction (I9) */
  hop: number;

  // ── Temporalite ──
  /** Horodatage de creation — Date.now() */
  timestamp: number;

  // ── Origine ──
  /** Origine du message */
  origin: {
    kind: "view" | "feature" | "behavior" | "composer" | "foundation";
    name: string;
    /** Namespace de la Feature, si applicable */
    namespace?: string;
  };
};
```

---

## 2. Generation des IDs — ULID

Tous les identifiants (`messageId`, `correlationId` sans prefixe) sont des **ULID** (Universally Unique Lexicographically Sortable Identifier).

| Propriete              | UUID v4 | Nanoid | **ULID** |
| ---------------------- | ------- | ------ | -------- |
| Triable temporellement | Non     | Non    | Oui      |
| Unique garanti         | Oui     | Oui    | Oui      |
| Longueur               | 36      | 21     | 26       |
| Ideal pour event log   | Non     | Non    | Oui      |

**Justification** : le tri temporel natif est essentiel pour le Event Ledger ([devtools](../devtools.md)) et l'Event Sourcing (ADR-0011).

---

## 3. Prefixes `correlationId` — `usr-` et `sys-`

| Prefixe | Initiateur                            | Exemple                          |
| ------- | ------------------------------------- | -------------------------------- |
| `usr-`  | UI (View, Behavior, Foundation)       | `usr-01ARZ3NDEKTSV4RRFFQ69G5FAV` |
| `sys-`  | Systeme (timer, scheduled task, init) | `sys-01ARZ4ABCDEFGHIJKLMNOPQRS`  |

> **I8 amende** : le `correlationId` est cree par l'UI **ou** par le framework pour les actions systeme.
> Le prefixe `usr-`/`sys-` permet de distinguer l'origine dans les DevTools.

> Les Requests portent egalement des metas pour que la chaine causale
> soit complete : un request declenche depuis un command handler fait
> partie de la meme transaction (`correlationId`), et le `hop` doit
> s'incrementer pour que l'anti-boucle (I9) puisse detecter les cycles.

> **Regle d'or** : les metas decrivent la **causalite** du flux.
> Elles n'influencent **jamais** la logique metier — aucune Feature
> ne doit prendre une decision basee sur `correlationId` ou `hop`.

---

## 4. Propagation explicite des metas

> **ADR-0005 — Principe fondamental** : pas de magie. Les metas sont passees explicitement.

### Signature des handlers : `(payload, metas)`

Tous les handlers (Command, Event, Request) recoivent **toujours** deux parametres :

```typescript
class CartFeature extends Feature<CartEntity, Cart.Channel> {
  // Command handler — recoit payload + metas
  onAddItemCommand(payload: AddItemPayload, metas: TMessageMetas) {
    // metas disponible directement en parametre
    this.entity.mutate("cart:addItem", { payload, metas }, (draft) => {
      draft.items.push(payload.item);
    });

    // Propagation explicite aux emissions
    this.emit("cart:itemAdded", { item: payload.item }, { metas });
  }

  // Async — le closure capture metas naturellement
  async onCheckoutCommand(payload: CheckoutPayload, metas: TMessageMetas) {
    const price = await this.request(
      "pricing:calculate",
      { items: payload.items },
      { metas }
    );
    // metas toujours disponible grace au closure
    this.emit("cart:checkedOut", { total: price }, { metas });
  }
}
```

### Decisions rejetees

| Alternative                             | Raison du rejet                                 |
| --------------------------------------- | ----------------------------------------------- |
| Context implicite (`AsyncLocalStorage`) | Magie, Node-only, debugging complexe            |
| Getter `this.currentMetas`              | Implicite, risque hors handler, problemes async |
| Wrapper `withMetas(fn)`                 | Ajoute de la magie inutile                      |

### Creation de nouvelle correlation (cas systeme)

```typescript
class SyncFeature extends Feature<SyncEntity, Sync.Channel> {
  onTimerTick() {
    // Pas de metas en entree (event systeme)
    // Le framework cree une nouvelle correlation sys-
    this.emit("sync:started", {});
    // → correlationId = 'sys-01ARZ3...'
  }
}
```

---

## 5. Cycle de vie des metas

Les metas suivent un cycle de vie previsible qui assure la tracabilite complete :

### A la racine (UI trigger)

| Champ           | Valeur                                  |
| --------------- | --------------------------------------- |
| `messageId`     | Nouvelle valeur unique                  |
| `correlationId` | Nouvelle valeur unique (creee par l'UI) |
| `causationId`   | `null` (pas de message parent)          |
| `hop`           | `0`                                     |

### Reaction d'une Feature (Command handler → emit Event)

| Champ           | Valeur                                 |
| --------------- | -------------------------------------- |
| `messageId`     | Nouvelle valeur unique                 |
| `correlationId` | `parent.correlationId` (inchange — I8) |
| `causationId`   | `parent.messageId`                     |
| `hop`           | `parent.hop + 1`                       |

### Reaction cross-feature (Feature B listen un Event de Feature A)

| Champ           | Valeur                                     |
| --------------- | ------------------------------------------ |
| `messageId`     | Nouvelle valeur unique                     |
| `correlationId` | `parent.correlationId` (toujours inchange) |
| `causationId`   | `parent.messageId` (l'Event de Feature A)  |
| `hop`           | `parent.hop + 1`                           |

> Le `correlationId` relie toute la chaine : du `trigger()` initial de la View
> jusqu'au dernier Event emis par la derniere Feature reactive.
> C'est la cle de voute du debug et des DevTools (Event Ledger).

---

## 6. Garde-fous mecaniques

Le framework implemente des garde-fous pour prevenir les boucles et garantir l'integrite causale :

| Garde-fou                 | Mecanisme                                                                             | Invariant |
| ------------------------- | ------------------------------------------------------------------------------------- | --------- |
| **Anti-boucle**           | Si `hop > MAX_HOPS` → le message est **rejete** avec une erreur explicite             | I9        |
| **Correlation immuable**  | Le `correlationId` est verifie comme jamais modifie dans la chaine                    | I8        |
| **Causalite obligatoire** | Tout message sauf le trigger initial **doit** avoir un `causationId` non-null         | I7        |
| **Origine verifiee**      | Le `origin.kind` est assigne automatiquement par le framework, pas par le developpeur | I7        |

> **`MAX_HOPS`** est configurable dans Application (`maxHops`).
> Une valeur typique est 10–20 — au-dela, il s'agit tres probablement
> d'une boucle evenementielle non intentionnelle.

---

## 7. API d'implementation

### 7.1 Creation au point d'entree

Quand une View ou un Behavior appelle `trigger()`, le framework cree
automatiquement les metas initiales d'une nouvelle chaine causale :

```typescript
// Cree par le framework -- JAMAIS par le developpeur
const metas: TMessageMetas = {
  messageId: ulid(),
  correlationId: `usr-${ulid()}`, // nouvelle transaction, prefixe 'usr-'
  causationId: null, // racine
  origin: { kind: "view", name: viewClass.name },
  hop: 0,
  timestamp: Date.now()
};
```

> **I54 (amende par ADR-0016)** : le framework **cree** les metas au point d'entree.
> Le developpeur ne forge JAMAIS de metas manuellement.
> Le `trigger()` de la View ne prend que le nom du Command et le payload :
>
> ```typescript
> this.trigger(channel, commandName, payload);
> // Pas de parametre metas -- le framework les cree a la racine
> ```

### 7.2 Derivation des metas enfant

Le framework cree de nouvelles metas derivees a chaque propagation
(nouveau `messageId`, `causationId` chaine, `hop` incremente) :

```typescript
// Framework interne -- derivation des metas enfant
function deriveChildMetas(
  parentMetas: TMessageMetas,
  origin: TMessageMetas["origin"]
): TMessageMetas {
  return {
    messageId: ulid(),
    correlationId: parentMetas.correlationId, // inchange (I8)
    causationId: parentMetas.messageId, // chainage causal
    origin,
    hop: parentMetas.hop + 1, // incremente
    timestamp: Date.now()
  };
}
```

### 7.3 Invariants API des metas

| #       | Invariant                                                                                                                                                                                                          | Principe                                           |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| **I54** | Le framework **cree** les metas au point d'entree. Le developpeur les **recoit** en parametre `(payload, metas)` et les **propage** explicitement a `emit()`, `request()` et `mutate()`. (D43 amende par ADR-0016) | -> [metas SS4](#4-propagation-explicite-des-metas) |
| **I7**  | Tout message porte des metadonnees causales completes                                                                                                                                                              | -> [metas SS1](#1-structure-des-metas)             |
| **I8**  | Le `correlationId` est immuable dans une chaine                                                                                                                                                                    | -> [metas SS5](#5-cycle-de-vie-des-metas)          |
| **I9**  | `hop > maxHops` -> message rejete                                                                                                                                                                                  | -> [metas SS6](#6-garde-fous-mecaniques)           |

---

## Lecture suivante

-> [Erreurs](erreurs.md) -- categories d'erreurs, propagation, diagnostics
