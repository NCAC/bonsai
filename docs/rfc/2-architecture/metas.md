# Traçabilité et metadonnees causales

> **Metas, ULID, correlationId, propagation explicite, garde-fous anti-boucle**

[← Retour à l'architecture](README.md) · [← Cycle de vie](lifecycle.md)

---

> **ADR-0005 (Accepted)** : toutes les decisions ci-dessous sont normatives.
> **ADR-0016 (Accepted)** : signature des handlers `(payload, metas)`.

> ### ⏳ Périmètre d'implémentation (ADR-0028)
>
> Ce document décrit le **contrat cible** des metas. **Aucun élément n'est encore implémenté** :
>
> | Élément                                                                     | Strate cible | Sections concernées |
> | --------------------------------------------------------------------------- | ------------ | ------------------- |
> | Type `TMessageMetas`, génération ULID, préfixes `usr-`/`sys-`               | Strate 1b    | §1, §2, §3          |
> | Handlers `(payload, metas)` et propagation explicite à `emit()`/`request()` | Strate 1b    | §4                  |
> | Création au point d'entrée, dérivation des metas enfant                     | Strate 1b    | §5, §7              |
> | Garde-fous (anti-boucle `hop > maxHops`, corrélation immuable)              | Strate 1b    | §6                  |
>
> **Périmètre effectif livré** : aucun type `TMessageMetas` n'est exporté ; les handlers `on*Command`/`on*Event`/`on*Request` reçoivent **uniquement** le payload ; `emit()`, `request()` et `View.trigger()` n'acceptent pas de metas. Seul `Entity.mutate(intent, { payload?, metas? }, recipe)` (strate 1a) accepte un champ `metas?: Record<string, unknown>`, recopié tel quel dans le `TEntityEvent`.

## 1. Structure des metas

Chaque message (Command, Event **et** Request) porte des **metadonnees causales complètes** (I7) :

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

## 2. Génération des IDs — ULID

Tous les identifiants (`messageId`, `correlationId` sans préfixe) sont des **ULID** (Universally Unique Lexicographically Sortable Identifier).

| Propriété              | UUID v4 | Nanoid | **ULID** |
| ---------------------- | ------- | ------ | -------- |
| Triable temporellement | Non     | Non    | Oui      |
| Unique garanti         | Oui     | Oui    | Oui      |
| Longueur               | 36      | 21     | 26       |
| Ideal pour event log   | Non     | Non    | Oui      |

**Justification** : le tri temporel natif est essentiel pour le Event Ledger ([devtools](../devtools.md)) et l'Event Sourcing (ADR-0011).

---

## 3. Préfixes `correlationId` — `usr-` et `sys-`

| Préfixe | Initiateur                            | Exemple                          |
| ------- | ------------------------------------- | -------------------------------- |
| `usr-`  | UI (View, Behavior, Foundation)       | `usr-01ARZ3NDEKTSV4RRFFQ69G5FAV` |
| `sys-`  | Système (timer, scheduled task, init) | `sys-01ARZ4ABCDEFGHIJKLMNOPQRS`  |

> **I8 amende** : le `correlationId` est créé par l'UI **ou** par le framework pour les actions système.
> Le préfixe `usr-`/`sys-` permet de distinguer l'origine dans les DevTools.

> Les Requests portent également des metas pour que la chaine causale
> soit complète : un request declenche depuis un command handler fait
> partie de la même transaction (`correlationId`), et le `hop` doit
> s'incrementer pour que l'anti-boucle (I9) puisse detecter les cycles.

> **Regle d'or** : les metas decrivent la **causalité** du flux.
> Elles n'influencent **jamais** la logique metier — aucune Feature
> ne doit prendre une decision basee sur `correlationId` ou `hop`.

---

## 4. Propagation explicite des metas

> **ADR-0005 — Principe fondamental** : pas de magie. Les metas sont passees explicitement.

### Signature des handlers : `(payload, metas)`

Tous les handlers (Command, Event, Request) reçoivent **toujours** deux parametres :

```typescript
// ⏳ Cible strate 1b — metas non livrées. Signature strate 0 réelle :
// onAddItemCommand(payload) (1 paramètre), emit(name, payload) (2 arguments,
// clé nue sur le Channel propre — pas "cart:itemAdded"), request(token, name,
// params) (token typé, synchrone, pas de string libre ni de metas).
class CartFeature
  extends Feature<CartEntity, TCartDef, "cart">
  implements TFeatureCallbacks<TCartDef, typeof cartListens>
{
  // Command handler — recevrait payload + metas (cible)
  onAddItemCommand(payload: AddItemPayload, metas: TMessageMetas) {
    // metas disponible directement en parametre
    this.entity.mutate("cart:addItem", { payload, metas }, (draft) => {
      draft.items.push(payload.item);
    });

    // Propagation explicite aux emissions — clé nue sur le Channel propre (I1, I12)
    this.emit("itemAdded", { item: payload.item }, { metas });
  }

  // request() est SYNCHRONE (ADR-0023, I29) — pas d'async/await, même cible.
  // Le token remplace la string libre "pricing:calculate" (ADR-0040).
  onCheckoutCommand(payload: CheckoutPayload, metas: TMessageMetas) {
    const price = this.request(
      PricingFeature.channel,
      "calculate",
      { items: payload.items },
      { metas }
    );
    // metas toujours disponible grace au closure
    this.emit("checkedOut", { total: price }, { metas });
  }
}
```

### Decisions rejetees

| Alternative                             | Raison du rejet                                 |
| --------------------------------------- | ----------------------------------------------- |
| Context implicite (`AsyncLocalStorage`) | Magie, Node-only, debugging complexe            |
| Getter `this.currentMetas`              | Implicite, risque hors handler, problemes async |
| Wrapper `withMetas(fn)`                 | Ajoute de la magie inutile                      |

### Création de nouvelle correlation (cas système)

```typescript
class SyncFeature extends Feature<SyncEntity, TSyncDef, "sync"> {
  // Hook illustratif — pas une convention onXxxCommand/Event/Request réelle ;
  // représente un timer interne déclenchant une émission côté framework.
  onTimerTick() {
    // Pas de metas en entree (event systeme)
    // Le framework cree une nouvelle correlation sys-
    this.emit("started", {});
    // → correlationId = 'sys-01ARZ3...'
  }
}
```

---

## 5. Cycle de vie des metas

Les metas suivent un cycle de vie previsible qui assure la traçabilité complète :

### A la racine (UI trigger)

| Champ           | Valeur                                  |
| --------------- | --------------------------------------- |
| `messageId`     | Nouvelle valeur unique                  |
| `correlationId` | Nouvelle valeur unique (créée par l'UI) |
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
> jusqu'au dernier Event emis par la dernière Feature reactive.
> C'est la clé de voute du debug et des DevTools (Event Ledger).

---

## 6. Garde-fous mecaniques

Le framework implemente des garde-fous pour prevenir les boucles et garantir l'integrite causale :

| Garde-fou                 | Mecanisme                                                                             | Invariant |
| ------------------------- | ------------------------------------------------------------------------------------- | --------- |
| **Anti-boucle**           | Si `hop > MAX_HOPS` → le message est **rejete** avec une erreur explicite             | I9        |
| **Correlation immuable**  | Le `correlationId` est vérifié comme jamais modifié dans la chaine                    | I8        |
| **Causalité obligatoire** | Tout message sauf le trigger initial **doit** avoir un `causationId` non-null         | I7        |
| **Origine vérifiée**      | Le `origin.kind` est assigne automatiquement par le framework, pas par le developpeur | I7        |

> **`MAX_HOPS`** serait configurable via `maxHops` dans `TApplicationConfig` —
> mais **le point d'injection de cette configuration n'est pas tranché**
> (trois formes hypothétiques coexistent dans la documentation, aucune
> livrée — cf. [application.md §4](3-couche-abstraite/application.md) et
> [communication.md §9.5](communication.md)).
> Une valeur typique serait 10–20 — au-dela, il s'agirait très probablement
> d'une boucle evenementielle non intentionnelle.

---

## 7. API d'implementation

### 7.1 Création au point d'entree

Quand une View ou un Behavior appelle `trigger()`, le framework crée
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

> **I54 (amende par ADR-0016)** : le framework **crée** les metas au point d'entree.
> Le developpeur ne forge JAMAIS de metas manuellement.
> Le `trigger()` de la View prend une **clé namespacée** `"ns:cmd"` et le
> payload (ADR-0042, I80 — pas de token Channel exposé côté consommateur) :
>
> ```typescript
> this.trigger("cart:addItem", payload);
> // Pas de parametre metas -- le framework les cree a la racine
> ```

### 7.2 Dérivation des metas enfant

Le framework crée de nouvelles metas dérivées a chaque propagation
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

| #       | Invariant                                                                                                                                                                                                          | Principe                                          |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| **I54** | Le framework **crée** les metas au point d'entree. Le developpeur les **reçoit** en parametre `(payload, metas)` et les **propage** explicitement a `emit()`, `request()` et `mutate()`. (D43 amende par ADR-0016) | -> [metas §4](#4-propagation-explicite-des-metas) |
| **I7**  | Tout message porte des metadonnees causales complètes                                                                                                                                                              | -> [metas §1](#1-structure-des-metas)             |
| **I8**  | Le `correlationId` est immuable dans une chaine                                                                                                                                                                    | -> [metas §5](#5-cycle-de-vie-des-metas)          |
| **I9**  | `hop > maxHops` -> message rejete                                                                                                                                                                                  | -> [metas §6](#6-garde-fous-mecaniques)           |

---

## Lecture suivante

-> [Distribution](distribution.md) -- modes de distribution ESM/IIFE, BonsaiRegistry (cible)
