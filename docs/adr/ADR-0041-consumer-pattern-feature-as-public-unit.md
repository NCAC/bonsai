# ADR-0041 : Feature comme référence publique inter-composants — pattern consommateur unifié

| Champ                   | Valeur                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Statut**              | 🔵 Tested                                                                                                                |
| **Date**                | 2026-04-30                                                                                                               |
| **Décideurs**           | @ncac                                                                                                                    |
| **RFC liées**           | [communication.md](../rfc/2-architecture/communication.md), [invariants.md](../rfc/reference/invariants.md)             |
| **ADR liées**           | [ADR-0024](ADR-0024-component-capabilities-manifest-pattern.md), [ADR-0040](ADR-0040-typescript-first-api-channel-definition-typed.md) |
| **Décisions amendées**  | ADR-0040 — le hors-scope « `TListenTokens` enforcement compile-time des handlers d'events » est levé et résolu ici ; ADR-0040 §Bloc 4 (`View<TListenTokens, TUI>`) est remplacé dans sa totalité |
| **Invariants impactés** | I48 (renforcé), I80–I83 (nouveaux)                                                                                      |

---

## Contexte

ADR-0040 a établi `TChannelToken` comme artefact de référence croisée et a laissé deux points hors-scope :

> *« L'enforcement complet nécessite un type utilitaire `ValidateViewHandlers<>` — laissé à strate 2. »*
> — ADR-0040, §Hors-scope

L'implémentation post-ADR-0040 a comblé ce manque par un **declaration merging** :

```ts
export interface View<TParams extends TViewParams = TViewParams>
  extends TListenHandlers<TParams> {}
```

Ce mécanisme présente trois défauts structurels.

### Défaut 1 — Channel n'est pas privé

`TViewParams.listen`, `TViewParams.trigger` et `TViewParams.request` acceptent des `TChannelToken` directement. Le développeur applicatif écrit :

```ts
const params = {
  listen:  [CartFeature.channel],   // TChannelToken exposé
  trigger: [CartFeature.channel],
  request: [CartFeature.channel],
} satisfies TViewParams;
```

`CartFeature.channel` est un artefact interne qui modélise une lane de communication. Le développeur est forcé de connaître et de manipuler ce niveau d'abstraction, alors que la Feature est la seule unité publique qu'il devrait avoir à référencer.

### Défaut 2 — Handlers optionnels, contrat invisible

`TListenHandlers<TParams>` génère des signatures optionnelles (`?`) couvrant **tous** les events du Channel. Un développeur qui déclare `listen: [CartFeature.channel]` alors que ce Channel publie cinq events n'est pas contraint d'en implémenter un seul. `params.listen` ne précise pas non plus *quels* events la View traite réellement.

Le declaration merging lui-même est opaque : il n'apparaît pas dans la signature de classe, n'est pas visible dans IntelliSense comme contrat à remplir, et ne peut pas être documenté par un `implements`.

### Défaut 3 — Absence de pattern unifié

`View`, `Composer`, `Behavior` sont tous des composants consommateurs de Features. Chacun a aujourd'hui sa propre mécanique ad hoc. Il n'existe pas de pattern déclaratif commun permettant de traiter ces trois composants de façon uniforme.

### Asymétrie des trois lanes

| Lane      | Déclaration actuelle dans `params` | Enforcement type | Mécanisme              |
| --------- | ---------------------------------- | ---------------- | ---------------------- |
| `trigger` | `TChannelToken[]`                  | ✅ token hors liste → erreur compile | Generic `View<TParams>` |
| `request` | `TChannelToken[]`                  | ✅ token hors liste → erreur compile | Generic `View<TParams>` |
| `listen`  | `TChannelToken[]`                  | ⚠️ partiel — payload typé si handler présent, mais handler non requis | Declaration merging avec `?` |

L'objectif de cet ADR est de résoudre ces trois défauts simultanément en posant un principe architectural et un pattern réutilisable.

---

## Contraintes

- **C1** — Channel est privé derrière sa Feature. Aucun composant consommateur ne référence `TChannelToken` directement dans ses déclarations publiques.
- **C2** — `params` / `contract` doit être la source de vérité complète et lisible d'un composant consommateur — un lecteur comprend le contrat sans lire le corps de la classe.
- **C3** — Le compilateur doit imposer l'implémentation des handlers déclarés (handlers manquants = erreur compile).
- **C4** — Les types de payload des handlers doivent être inférés depuis la Feature — sans cast ni annotation manuelle.
- **C5** — Le pattern doit être identique pour `View`, `Composer`, `Behavior` et tout futur composant consommateur.
- **C6** — Aucun declaration merging dans les surfaces publiques du framework.
- **C7** — Aucun `any` dans les surfaces publiques (I75). Les casts internes restent admis.
- **C8** — Rétrocompatibilité descendante : les composants strate 0 non paramétrés (`View` sans generic) continuent de compiler (migration progressive).

---

## Options considérées

### Option A — Statu quo amélioré : déclaration event-level via `TListenEntry` (rejetée)

Amender `params.listen` pour accepter `{ token: TChannelToken, events: string[] }` au lieu d'un token seul. Conserver le declaration merging mais le rendre opt-in via un `implements TListenHandlers<TParams>` explicite.

```ts
// @bonsai/view — TViewParams amendé
export type TListenEntry<
  TDef extends TChannelDefinition = TChannelDefinition,
  TNS extends string = string
> = {
  readonly token:  TChannelToken<TDef, TNS>;
  readonly events: readonly (keyof TDef["events"] & string)[];
};

export type TViewParams = {
  readonly uiElements: Readonly<Record<string, string>>;
  readonly listen:  readonly TListenEntry[];   // token + events exacts
  readonly trigger: readonly TChannelToken<TChannelDefinition, string>[];
  readonly request: readonly TChannelToken<TChannelDefinition, string>[];
};

// Côté applicatif
class CartView extends View<typeof params> implements TListenHandlers<typeof params> {
  get params() { return params; }
  onCartItemAddedEvent(payload: { productId: string }): void { ... }   // requis
  onCartItemRemovedEvent(payload: { productId: string }): void { ... } // requis
}
```

**Problèmes :**

- `trigger` et `request` continuent de référencer `TChannelToken` directement — la violation de C1 subsiste sur deux lanes.
- `TListenEntry` résout la granularité des events sur `listen` mais n'élimine pas le token de la surface.
- Le declaration merging reste présent en interne ; `implements` est opt-in, non imposable.
- Aucun pattern commun View / Composer / Behavior — chaque composant garde sa propre structure.

---

### Option B — Pattern consommateur unifié : `TConsumerDeps` + `TConsumerContract` + `TListenCallbacks` ✅

**Principe architectural** : la Feature est l'unité publique d'inter-communication. Le Channel est un détail d'implémentation privé à sa Feature. Tout composant consommateur déclare des dépendances vers des **Features**, jamais vers des Channels ou des Tokens.

Le pattern se décompose en deux étapes de déclaration et une classe.

#### Étape 1 — `TMyDeps` : type pur, zéro coût runtime

Le développeur déclare quelles Features participent à chaque lane. Cette déclaration est un **type TypeScript**, sans valeur runtime associée.

```ts
// Dans MyComponent.view.ts (ou .composer.ts, .behavior.ts)
type TMyComponentDeps = {
  readonly listens:  [typeof CartFeature, typeof UserFeature];
  readonly triggers: [typeof CartFeature];
  readonly requests: [typeof UserFeature];
};
```

La contrainte structurelle `TFeatureRef` (définie dans `@bonsai/feature/src/types.ts`) garantit que chaque entrée expose un `static readonly channel : TChannelToken<TDef, TNS>`. TypeScript extrait `TDef` et `TNS` par inférence.

#### Étape 2 — `myContract` : valeur namespacée, validée par `satisfies`

Le développeur déclare les events/commands/requests exacts qu'il utilise, sous forme de clés namespacées `"namespace:name"`.

```ts
const myComponentContract = {
  listens:  ["cart:itemAdded", "cart:itemRemoved", "user:profileUpdated"] as const,
  triggers: ["cart:addItem"] as const,
  requests: ["user:getProfile"] as const,
} satisfies TConsumerContract<TMyComponentDeps>;
//           ↑ "cart:unknownEvent" → erreur compile ici, à la déclaration
```

`TConsumerContract<TDeps>` contraint chaque clé à être une union valide des noms namespacés disponibles pour les Features déclarées dans `TDeps`. La clé `"cart:itemAdded"` n'est valide que si `CartFeature` est déclaré dans `TDeps.listens` **et** que `"itemAdded"` est un event de son `TChannelDef`.

#### Étape 3 — `TMyContract` : type dérivé pour la signature de classe

```ts
type TMyComponentContract = typeof myComponentContract;
```

`satisfies` valide sans élargir : `typeof myComponentContract` préserve les types littéraux des tuples (`readonly ["cart:itemAdded", "cart:itemRemoved"]`, non `readonly string[]`). Ces littéraux sont indispensables pour que `TListenCallbacks<>` puisse dériver les noms de handlers à la compilation. Nommer ce type évite de répéter `typeof myComponentContract` dans la signature de classe et fait apparaître un nom lisible dans les messages d'erreur TypeScript.

#### Étape 4 — la classe

```ts
class MyComponent
  extends View<TMyComponentDeps, TMyComponentContract>
  //     ↑ ou Composer<>, Behavior<> — même signature générique
  implements TListenCallbacks<TMyComponentDeps, TMyComponentContract>
{
  get contract() { return myComponentContract; }

  // ✅ Requis par implements — erreur compile si absent
  onCartItemAddedEvent(payload: { id: string; qty: number }): void {
    this.getUI("total").text(`+${payload.qty}`);
  }

  // ✅ Requis par implements
  onCartItemRemovedEvent(payload: { id: string }): void { ... }

  // ✅ Requis par implements
  onUserProfileUpdatedEvent(payload: { name: string }): void { ... }

  onAddButtonClick(): void {
    this.trigger("cart:addItem", { id: "p1", qty: 1 }); // ✅ payload inféré
    // this.trigger("cart:addItemm", ...);               // ❌ TS error
  }

  onGetCountButtonClick(): void {
    const count = this.request("user:getProfile", undefined); // ✅ retour typé
  }
}
```

`TListenCallbacks<TDeps, TContract>` dérive depuis `TContract["listens"]` les signatures **requises** (non optionnelles) des handlers. L'IDE génère les stubs corrects ; TypeScript signale tout handler manquant.

---

## Analyse comparative

| Critère                                                         | A — `TListenEntry` + merging | B — Pattern consommateur unifié |
| --------------------------------------------------------------- | ---------------------------- | ------------------------------- |
| Channel privé derrière Feature (`trigger`, `request`, `listen`) | ❌ Partiel — token encore visible sur `trigger`/`request` | ✅ Aucun token dans les déclarations publiques |
| `params`/`contract` source de vérité complète                   | ⭐⭐ Events listés mais tokens exposés | ✅ Features + events exacts — tout lisible |
| Handlers manquants → erreur compile                             | ⚠️ Opt-in via `implements` | ✅ `implements` obligatoire dans le pattern |
| Contrat visible pour le développeur                             | ⚠️ Merging opaque + `implements` opt-in | ✅ `implements` explicite dans la signature |
| Symétrie des trois lanes                                        | ❌ `listen` = `TListenEntry`, `trigger`/`request` = token | ✅ Toutes trois = Feature refs + clés namespacées |
| Pattern unifié View / Composer / Behavior                       | ❌ Non                       | ✅ `TConsumerDeps`, `TConsumerContract`, `TListenCallbacks` |
| IDE suggère les handlers à implémenter                          | ⚠️ Si `implements` écrit     | ✅ Toujours |
| Verbosité du manifeste                                          | ⭐⭐ (`{ token, events }`)    | ⭐⭐ (type + valeur séparés) |

---

## Décision

Nous choisissons **Option B**.

### Argument 1 — Feature est l'unité métier, pas Channel

Channel est un bus de messages, un artefact d'infrastructure. Feature est l'unité de logique métier que le développeur applicatif déclare, nomme et organise. Forcer les composants DOM à manipuler des tokens de Channel revient à faire fuiter un détail d'implémentation du framework dans le code applicatif. Le pattern consommateur unifié corrige cette fuite.

### Argument 2 — Symétrie totale des trois lanes

L'Option A laissait `trigger` et `request` avec des tokens — l'asymétrie avec `listen` subsistait. L'Option B aligne les trois lanes sur le même modèle : Features dans `TDeps`, clés namespacées dans `contract`. Un développeur qui comprend le pattern pour une lane le comprend pour les trois.

### Argument 3 — `implements` rend le contrat imposable et visible

Le declaration merging est un mécanisme TypeScript légitime mais opaque : peu de développeurs savent le chercher, il n'est pas documentable par `implements`, et les handlers qu'il génère sont optionnels. `class CartView extends View<TDeps, TContract> implements TListenCallbacks<TDeps, TContract>` est une déclaration conventionnelle, lisible, conforme au pattern déjà établi par `implements TCommandHandlers<TDef>` côté Feature (ADR-0040).

### Argument 4 — Réutilisabilité du pattern

`TConsumerDeps`, `TConsumerContract`, `TListenCallbacks` ne sont pas des types spécifiques à View. Tout composant qui consomme des Features (Composer, Behavior) peut utiliser exactement le même pattern en changeant uniquement le nom de la classe de base. Le framework n'a plus à dupliquer cette logique.

### Pourquoi rejeter A

L'Option A corrige `listen` mais laisse `trigger` et `request` avec des tokens, maintenant une asymétrie incohérente et ne résolvant pas C1. Elle n'établit pas non plus de pattern unifié (C5).

---

## Types utilitaires — signatures complètes

Ces types sont définis dans **`packages/feature/src/types.ts`** et exportés par **`packages/feature/src/bonsai-feature.ts`**. Ils dépendent de `TChannelDefinition` et `TChannelToken` (issus de `@bonsai/event`) mais non de la classe `Feature` elle-même — pas de dépendance circulaire.

```ts
// ─── Contrainte structurelle ──────────────────────────────────────────────────

/**
 * Contrainte minimale pour toute Feature référençable par un consommateur.
 * Structure publique : tout objet exposant un `channel` typé satisfait ce type.
 * En pratique : `typeof CartFeature` (constructeur avec static `channel`).
 */
export type TFeatureRef<
  TDef extends TChannelDefinition = TChannelDefinition,
  TNS extends string = string
> = { readonly channel: TChannelToken<TDef, TNS> };

// ─── TConsumerDeps ────────────────────────────────────────────────────────────

/**
 * Étape 1 du pattern consommateur — type pur, zéro coût runtime.
 * Déclare quelles Features participent à chaque lane.
 *
 * Usage : `type TMyViewDeps = { listens: [typeof CartFeature]; ... }`
 */
export type TConsumerDeps = {
  readonly listens:  readonly TFeatureRef[];
  readonly triggers: readonly TFeatureRef[];
  readonly requests: readonly TFeatureRef[];
};

// ─── Helpers d'extraction des clés namespacées ────────────────────────────────

/** Union des clés "namespace:eventName" disponibles depuis une Feature ref. */
export type TNSEventKeys<FC extends TFeatureRef> =
  FC["channel"] extends TChannelToken<infer D, infer NS>
    ? `${NS}:${keyof D["events"] & string}`
    : never;

/** Union des clés "namespace:commandName" disponibles depuis une Feature ref. */
export type TNSCommandKeys<FC extends TFeatureRef> =
  FC["channel"] extends TChannelToken<infer D, infer NS>
    ? `${NS}:${keyof D["commands"] & string}`
    : never;

/** Union des clés "namespace:requestName" disponibles depuis une Feature ref. */
export type TNSRequestKeys<FC extends TFeatureRef> =
  FC["channel"] extends TChannelToken<infer D, infer NS>
    ? `${NS}:${keyof D["requests"] & string}`
    : never;

// ─── TConsumerContract ────────────────────────────────────────────────────────

/**
 * Étape 2 du pattern consommateur — type du contrat namespacé.
 * Contraint chaque clé à être valide pour les Features déclarées dans TDeps.
 *
 * Usage : `const c = { listens: ["cart:itemAdded"] as const } satisfies TConsumerContract<TDeps>`
 */
export type TConsumerContract<TDeps extends TConsumerDeps> = {
  readonly listens:  readonly TNSEventKeys<TDeps["listens"][number]>[];
  readonly triggers: readonly TNSCommandKeys<TDeps["triggers"][number]>[];
  readonly requests: readonly TNSRequestKeys<TDeps["requests"][number]>[];
};

// ─── Helpers de lookup de types depuis une clé namespacée ────────────────────

/** Dérive le nom du handler depuis une clé namespacée : "cart:itemAdded" → "onCartItemAddedEvent". */
export type THandlerName<K extends string> =
  K extends `${infer NS}:${infer Ev}`
    ? `on${Capitalize<NS>}${Capitalize<Ev>}Event`
    : never;

/** Payload d'un event depuis une clé namespacée et les deps listen. */
export type TEventPayload<TDeps extends TConsumerDeps, K extends string> =
  K extends `${infer NS}:${infer Ev}`
    ? TDeps["listens"][number] extends infer FC
      ? FC extends TFeatureRef
        ? FC["channel"] extends TChannelToken<infer D, NS>
          ? Ev extends keyof D["events"] ? D["events"][Ev] : never
          : never
        : never
      : never
    : never;

/** Payload d'une command depuis une clé namespacée et les deps triggers. */
export type TCommandPayload<TDeps extends TConsumerDeps, K extends string> =
  K extends `${infer NS}:${infer Cmd}`
    ? TDeps["triggers"][number] extends infer FC
      ? FC extends TFeatureRef
        ? FC["channel"] extends TChannelToken<infer D, NS>
          ? Cmd extends keyof D["commands"] ? D["commands"][Cmd] : never
          : never
        : never
      : never
    : never;

/** Params d'une request depuis une clé namespacée et les deps requests. */
export type TRequestParams<TDeps extends TConsumerDeps, K extends string> =
  K extends `${infer NS}:${infer Req}`
    ? TDeps["requests"][number] extends infer FC
      ? FC extends TFeatureRef
        ? FC["channel"] extends TChannelToken<infer D, NS>
          ? Req extends keyof D["requests"] ? D["requests"][Req]["params"] : never
          : never
        : never
      : never
    : never;

/** Résultat d'une request depuis une clé namespacée et les deps requests. */
export type TRequestResult<TDeps extends TConsumerDeps, K extends string> =
  K extends `${infer NS}:${infer Req}`
    ? TDeps["requests"][number] extends infer FC
      ? FC extends TFeatureRef
        ? FC["channel"] extends TChannelToken<infer D, NS>
          ? Req extends keyof D["requests"] ? D["requests"][Req]["result"] : never
          : never
        : never
      : never
    : never;

// ─── TListenCallbacks ─────────────────────────────────────────────────────────

/**
 * Contrat `implements` pour les handlers d'écoute d'un composant consommateur.
 * Dérive depuis `TContract["listens"]` les signatures **requises** (non optionnelles).
 *
 * Usage : `class MyView extends View<TDeps, TContract> implements TListenCallbacks<TDeps, TContract>`
 */
export type TListenCallbacks<
  TDeps extends TConsumerDeps,
  TContract extends { readonly listens: readonly string[] }
> = {
  [K in TContract["listens"][number] as THandlerName<K>]:
    (payload: TEventPayload<TDeps, K>) => void;
};
```

---

## Exemple applicatif complet

```ts
// ── CartView.view.ts ──────────────────────────────────────────────────────────

// Étape 1 — dépendances par lane (type pur)
type TCartViewDeps = {
  readonly listens:  [typeof CartFeature, typeof UserFeature];
  readonly triggers: [typeof CartFeature];
  readonly requests: [typeof UserFeature];
};

// Étape 2 — contrat namespacé (valeur validée par satisfies)
const cartViewContract = {
  listens:  ["cart:itemAdded", "cart:itemRemoved", "user:profileUpdated"] as const,
  triggers: ["cart:addItem", "cart:clear"] as const,
  requests: ["user:getProfile"] as const,
  // "cart:unknownEvent" → ❌ erreur compile ici
} satisfies TConsumerContract<TCartViewDeps>;

// Étape 3 — type dérivé (préserve les littéraux ; simplifie la signature de classe)
type TCartViewContract = typeof cartViewContract;

// Étape 4 — classe
class CartView
  extends View<TCartViewDeps, TCartViewContract>
  implements TListenCallbacks<TCartViewDeps, TCartViewContract>
{
  get contract() { return cartViewContract; }

  // Requis par implements — IDE génère les stubs, payload inféré
  onCartItemAddedEvent(payload: { id: string; qty: number }): void {
    this.getUI("total").text(`+${payload.qty}`);
  }
  onCartItemRemovedEvent(payload: { id: string }): void { ... }
  onUserProfileUpdatedEvent(payload: { name: string }): void { ... }

  onAddButtonClick(): void {
    this.trigger("cart:addItem", { id: "p1", qty: 1 }); // ✅ payload inféré
    // this.trigger("cart:addItemm", ...);               // ❌ TS error : clé inexistante
  }

  onProfileBtnClick(): void {
    const profile = this.request("user:getProfile", undefined); // ✅ retour typé
  }
}
```

Le même pattern s'applique à `Composer` et `Behavior` sans modification — seul le nom de la classe de base change.

---

## Conséquences

### Positives

- ✅ **Channel privé** — aucun `TChannelToken` dans le code applicatif consommateur. Les développeurs référencent des Features, pas des artefacts d'infrastructure.
- ✅ **`contract` source de vérité complète** — Features par lane, events exacts déclarés. Un lecteur comprend le contrat sans lire le corps de la classe.
- ✅ **Handler manquant → erreur compile** — via `implements TListenCallbacks<TDeps, TContract>`.
- ✅ **Payloads inférés** — `TEventPayload<TDeps, K>`, `TCommandPayload<TDeps, K>`, `TRequestResult<TDeps, K>` résolvent les types depuis la Feature déclarée dans `TDeps`.
- ✅ **Symétrie totale des trois lanes** — `listens`, `triggers`, `requests` : même philosophie déclarative.
- ✅ **Pattern unifié** — `TConsumerDeps` / `TConsumerContract` / `TListenCallbacks` s'appliquent à `View`, `Composer`, `Behavior` et tout futur composant consommateur.
- ✅ **Declaration merging supprimé** — plus de `export interface View extends TListenHandlers`.
- ✅ **Types exportés par `@bonsai/feature`** — seul package à importer pour déclarer un composant consommateur.

### Négatives (acceptées)

- ⚠️ **Deux déclarations par composant** — `TMyDeps` (type) + `myContract` (valeur). Coût justifié : `TMyDeps` est un type pur (zéro runtime), `myContract` est le seul artefact runtime nécessaire.
- ⚠️ **`implements` non imposable** — TypeScript ne peut pas forcer l'écriture du `implements` dans la signature de classe. Mitigation : le verrou runtime au mount (handler orphelin → throw) reste présent. Convention documentée dans le Style Guide.
- ⚠️ **Performance du checker TS** — les lookups `TEventPayload` impliquent des conditionnels distribués sur les unions de Features. Mitigation : formes plates (`TChannelDefinition` sans récursivité), unions bornées par la taille réelle des manifestes applicatifs.
- ⚠️ **Migration** — breaking change sur tous les consommateurs qui utilisent `TChannelToken` dans leurs `params`. Volume limité (strate 0 fraîche).

### Nouveaux invariants

| Réf  | Contenu |
| ---- | ------- |
| I80  | Tout composant consommateur (View, Composer, Behavior) déclare ses dépendances vers des **Feature refs** (`TFeatureRef`) — jamais vers des `TChannelToken` directement. |
| I81  | `contract` (étape 2) est la source de vérité runtime du composant : il déclare les clés namespacées exactes utilisées pour chaque lane. |
| I82  | `TListenCallbacks<TDeps, TContract>` est le mécanisme d'enforcement compile-time des handlers d'écoute — un composant qui déclare un event dans `contract.listens` DOIT implémenter le handler correspondant. |
| I83  | Le pattern `TConsumerDeps` / `TConsumerContract<TDeps>` / `TListenCallbacks<TDeps, TContract>` s'applique uniformément à `View`, `Composer`, `Behavior` et tout futur composant consommateur de Features. |

### Invariant renforcé

| Réf  | Formulation précédente (ADR-0040)                                               | Formulation renforcée                                                                                                                                               |
| ---- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I48  | Handlers auto-découverts et vérifiés compile-time via `implements TCommandHandlers<TDef>` | Handlers déclarés dans `contract.listens`, câblés par convention au runtime, et vérifiés compile-time via `implements TListenCallbacks<TDeps, TContract>` — la convention est un mécanisme de câblage, non une déclaration |

### Impact sur le code existant

| Fichier | Changement requis |
| ------- | ----------------- |
| `packages/feature/src/types.ts` | Ajouter `TFeatureRef`, `TConsumerDeps`, `TConsumerContract<>`, `TNSEventKeys`, `TNSCommandKeys`, `TNSRequestKeys`, `THandlerName`, `TEventPayload`, `TCommandPayload`, `TRequestParams`, `TRequestResult`, `TListenCallbacks` |
| `packages/feature/src/bonsai-feature.ts` | Exporter tous les nouveaux types |
| `packages/view/src/bonsai-view.ts` | Supprimer `TViewParams` (token-based), `TListenHandlers`, le declaration merging `interface View extends TListenHandlers` ; réécrire `View<TDeps, TContract>` avec les nouveaux génériques ; typer `trigger()`, `request()`, `getUI()` via `TDeps`/`TContract` |
| `tests/fixtures/cart-feature.fixture.ts` | Migrer vers `TConsumerDeps` + `TConsumerContract` ; `implements TListenCallbacks<>` |
| `tests/unit/strate-0/view.basic.test.ts` | Même migration sur `TestView` et vues de test locales |
| `tests/unit/strate-0/foundation.basic.test.ts` | Idem |
| `tests/unit/strate-0/composer.basic.test.ts` | Idem |
| `tests/types/strate-0/view-contract.types.test.ts` | Adapter les fixtures ; ajouter `@ts-expect-error` sur clé inexistante, handler manquant avec `implements` |

---

## Actions de suivi

- [ ] Ajouter `TFeatureRef`, `TConsumerDeps`, `TConsumerContract<>` et tous les helpers dans `packages/feature/src/types.ts`
- [ ] Exporter les nouveaux types depuis `packages/feature/src/bonsai-feature.ts`
- [ ] Réécrire `packages/view/src/bonsai-view.ts` : supprimer token-based `TViewParams`, supprimer declaration merging, implémenter `View<TDeps, TContract>` avec `trigger()` / `request()` / `getUI()` typés
- [ ] Migrer les consommateurs : fixtures, tests unitaires strate 0 (view, foundation, composer)
- [ ] Mettre à jour `tests/types/strate-0/view-contract.types.test.ts`
- [ ] Mettre à jour [FRAMEWORK-STYLE-GUIDE](../guides/FRAMEWORK-STYLE-GUIDE.md) — pattern View avec `TConsumerDeps` / `TConsumerContract` / `TListenCallbacks`
- [ ] Mettre à jour [invariants.md](../rfc/reference/invariants.md) — I80–I83, I48 renforcé
- [ ] Valider `pnpm tsc:check` + `pnpm test:unit` + gate E2E après migration

---

## Hors-scope explicite

- **`static readonly listens` / `static readonly queries` sur Feature** — ces propriétés utilisent des `TChannelToken` dans un contexte framework interne (bootstrap par `Application.start()`). Leur migration vers `TFeatureRef` est un sujet distinct, traité en strate 1.
- **`Composer<TDeps, TContract>` et `Behavior<TDeps, TContract>`** — le pattern est défini ici ; l'implémentation concrète de ces classes est hors-scope de cet ADR.
- **`TUIMap` / `TProjectionNodeFor<TEl>`** — ADR-0040 §Bloc 4 est remplacé dans ses génériques (`TListenTokens`, `TUI`) mais les types DOM (`TProjectionNode`, `TUIEntry`) restent inchangés.

---

## Historique

| Date       | Changement                                                                                   |
| ---------- | -------------------------------------------------------------------------------------------- |
| 2026-04-29 | Création (Proposed) — ADR-0041 initial sur `TListenEntry` et declaration merging             |
| 2026-04-30 | Réécriture profonde — principe Feature-as-public-unit, pattern consommateur unifié, suppression declaration merging, types `TConsumerDeps`/`TConsumerContract`/`TListenCallbacks` |
| 2026-05-07 | 🟢 **Accepted** — code mergé sur `develop` (PR #15 et #16) |
| 2026-05-13 | 🔵 **Tested** — I48 cité dans `feature.basic.test.ts` ; I80 / I81 / I82 cités dans `tests/unit/strate-0/view.basic.test.ts` ; I83 cité dans `view.basic.test.ts` et `tests/e2e/strate-0.cart-round-trip.test.ts`. Critère C-Inv d'ADR-0043 satisfait. Note : les types `TConsumerDeps` / `TConsumerContract` / `TListenCallbacks` ont été supersédés par ADR-0042 (pattern modulaire) — l'ADR-0041 reste Tested pour ses principes structurants (Feature-as-public-unit, I80–I83). |
