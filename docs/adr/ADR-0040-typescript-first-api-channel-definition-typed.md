# ADR-0040 : API TypeScript-First — `TChannelDefinition`, `ChannelToken` et projections UI typées

| Champ                   | Valeur                                                                                                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Statut**              | 🔵 Tested                                                                                                                                                                                                           |
| **Date**                | 2026-04-27                                                                                                                                                                                                          |
| **Décideurs**           | @ncac                                                                                                                                                                                                               |
| **RFC liées**           | [communication.md](../rfc/2-architecture/communication.md), [feature.md](../rfc/3-couche-abstraite/feature.md), [invariants.md](../rfc/reference/invariants.md)                                                     |
| **ADR liées**           | [ADR-0003](ADR-0003-channel-runtime-semantics.md), [ADR-0024](ADR-0024-component-capabilities-manifest-pattern.md), [ADR-0037](ADR-0037-feature-generic-entity-class.md), [ADR-0039](ADR-0039-namespace-authority-and-uniqueness.md) |
| **Décisions amendées**  | ADR-0037 (troisième paramètre `TChannel` désormais obligatoire), ADR-0024 (`TViewParams` → `TUIMap<T>` paramétré)                                                                                                   |
| **Invariants impactés** | I1, I2, I3, I4, I12 (formulation renforcée) — I73 à I79 (nouveaux)                                                                                                                                                 |

---

## Contexte

La strate 0 est livrée et son gate E2E est vert. Avant d'entamer la strate 1, un constat s'impose : l'API publique des composants repose partout sur `unknown` et `string` libres, ce qui viole le principe central de Bonsai **« Types d'abord, récompense ensuite »** ([FRAMEWORK-STYLE-GUIDE §1](../guides/FRAMEWORK-STYLE-GUIDE.md)).

### État actuel — les surfaces non typées

**`Channel` (`@bonsai/event`)** :
```ts
// Toutes les lanes utilisent unknown — aucun lien entre nom et type
handle(commandName: string, handler: (payload: unknown) => void): void
trigger(commandName: string, payload: unknown): void
listen(eventName: string, listener: (payload: unknown) => void): void
emit(eventName: string, payload: unknown): void
reply(requestName: string, replier: (params: unknown) => unknown): void
request(requestName: string, params: unknown): unknown | null
```

**`Feature` (`@bonsai/feature`)** :
```ts
protected emit(eventName: string, payload: unknown): void     // noms libres, payloads opaques
protected request(ns: string, name: string, params: unknown): unknown | null // cross-feature aveugle
// auto-discovery interne : (this as any)[method](payload)   // aucune vérification
```

**`View` (`@bonsai/view`)** :
```ts
getUI(key: string): TProjectionNode           // clé libre, retour non différencié
protected trigger(ns: string, cmd: string, payload: unknown): void  // tout libre
```

### Conséquences pratiques

| Symptôme | Source |
| -------- | ------ |
| Faute de frappe sur un nom de commande → silence au runtime | `string` libre partout |
| Payload d'un handler non typé → cast manuel systématique | `unknown` sur toutes les lanes |
| `getUI("submitButtom")` compile → crash au runtime | `string` libre sur `getUI()` |
| `request()` retourne `unknown` → cast obligatoire au call-site | absence de TDef sur Channel |
| Renommer un event → aucune cascade d'erreurs TS | aucun lien symbolique |

### Ce que le Style Guide promet déjà

Le [FRAMEWORK-STYLE-GUIDE §1](../guides/FRAMEWORK-STYLE-GUIDE.md) décrit explicitement la cible :

```
DÉCLARER   Feature → TChannelDefinition (Commands, Events, Requests typés)
           View    → TUIMap (nœuds DOM, type HTML, events autorisés)
IMPLÉMENTER Feature → extends Feature<TEntity, TChannel>
                   → implements TRequiredCommandHandlers<TChannel>
            View   → extends View<[Namespace.Channel, ...], TUIMap>
RÉCOMPENSE  handlers payloads typés, retours vérifiés compile-time
            getUI() → TProjectionNode<HTMLButtonElement>
            Refactoring : renommer un symbole = erreur partout
```

Aucun composant n'implémente ce contrat à ce jour. Ce document prend la décision architecturale qui permet de l'honorer.

### Pourquoi maintenant

La strate 0 est la dernière opportunité de corriger les signatures avant que l'écosystème de code applicatif ne se construise dessus. Toute migration post-strate-1 affecterait N Features, M Views, et leurs tests associés.

---

## Contraintes

- **C1** — Respecter ADR-0039 : `TSelfNS` reste le troisième paramètre de type de `Feature` ; `TChannel` s'insère en deuxième position (position prévue par ADR-0037 et ADR-0039 §Décision).
- **C2** — Conserver l'auto-discovery par convention de nommage (I48) : aucun décorateur, aucun enregistrement manuel.
- **C3** — Rétrocompatibilité descendante via valeurs par défaut des paramètres de type : `Feature<TEntity>` continue de compiler (régression zéro en strate 0 pure).
- **C4** — Aucun `any` dans les surfaces publiques de l'API framework. Les casts internes d'implémentation sont acceptés quand ils sont isolés et documentés.
- **C5** — TypeScript 5.x : template literal types, mapped types, conditional types, `satisfies`, `Capitalize<S>`.
- **C6** — Performances TS : éviter les types récursifs profonds. `CamelCase<S>` (ADR-0039) reste le pattern le plus complexe autorisé.
- **C7** — Pas de dépendance circulaire entre packages : un `TChannelToken` est défini dans `@bonsai/event`, consommé dans `@bonsai/feature` et `@bonsai/view`.

---

## Options considérées

### Option A — Typage paramétrique partiel (méthodes génériques libres)

**Description** : ajouter un paramètre de type `TPayload` à chaque méthode individuellement, sans structure globale liant les lanes. Chaque appel porte son annotation.

```ts
// @bonsai/event — Channel avec type params par méthode
export class Channel {
  handle<TPayload = unknown>(name: string, handler: (p: TPayload) => void): void;
  trigger<TPayload = unknown>(name: string, payload: TPayload): void;
  emit<TPayload = unknown>(name: string, payload: TPayload): void;
  listen<TPayload = unknown>(name: string, listener: (p: TPayload) => void): void;
  reply<TParams = unknown, TResult = unknown>(
    name: string, replier: (p: TParams) => TResult
  ): void;
  request<TParams = unknown, TResult = unknown>(name: string, params: TParams): TResult | null;
}

// Usage — chaque call-site doit annoter explicitement
channel.handle<{ id: string; qty: number }>("addItem", (payload) => {
  // payload est typé : { id: string; qty: number }
});

channel.trigger<{ id: string; qty: number }>("addItem", { id: "1", qty: 2 }); // OK
channel.trigger<{ id: string; qty: number }>("addItemm", { id: "1", qty: 2 }); // COMPILE — faute de frappe silencieuse
```

| Avantages | Inconvénients |
| --------- | ------------- |
| + Migration à coût minimal (surface publique quasi-inchangée) | - Aucun lien entre le **nom** du message et son type — fautes de frappe silencieuses |
| + Aucune nouvelle structure de type à déclarer | - Autocomplétion inexistante sur les noms de commandes/events |
| + Rétrocompatibilité totale | - `request()` retourne `TResult \| null` mais `TResult` est libre — cast encore nécessaire |
| + Simple à implémenter | - Répétition des annotations à chaque call-site |
| | - Violation directe du principe « Types d'abord » : la déclaration n'est pas séparée de l'implémentation |

---

### Option B — `Channel<TDef>` générique sans token cross-feature

**Description** : introduire `TChannelDefinition` comme type structuré et rendre `Channel` générique dessus. Chaque Feature connaît son propre `TChannelDef` et en bénéficie pour `emit()` et la réception de commandes. La communication cross-feature (`request()` sortant, `trigger()` depuis View) reste partiellement libre faute d'un mécanisme de référence typée.

```ts
// @bonsai/event — définition structurée
export type TChannelDefinition = {
  readonly commands: Record<string, unknown>;
  readonly events: Record<string, unknown>;
  readonly requests: Record<string, { params: unknown; result: unknown }>;
};

export class Channel<TDef extends TChannelDefinition = TChannelDefinition> {
  handle<K extends keyof TDef['commands'] & string>(
    name: K,
    handler: (payload: TDef['commands'][K]) => void
  ): void;

  trigger<K extends keyof TDef['commands'] & string>(
    name: K, payload: TDef['commands'][K]
  ): void;

  emit<K extends keyof TDef['events'] & string>(
    name: K, payload: TDef['events'][K]
  ): void;

  listen<K extends keyof TDef['events'] & string>(
    name: K, listener: (payload: TDef['events'][K]) => void
  ): void;

  reply<K extends keyof TDef['requests'] & string>(
    name: K,
    replier: (p: TDef['requests'][K]['params']) => TDef['requests'][K]['result']
  ): void;

  request<K extends keyof TDef['requests'] & string>(
    name: K, params: TDef['requests'][K]['params']
  ): TDef['requests'][K]['result'] | null;
}

// @bonsai/feature — emit typé, request vers l'extérieur encore opaque
export abstract class Feature<
  TEntity extends Entity<TJsonSerializable> = Entity<TJsonSerializable>,
  TChannelDef extends TChannelDefinition = TChannelDefinition,
  TSelfNS extends string = string
> {
  // ✅ emit typé — noms et payloads contraints
  protected emit<K extends keyof TChannelDef['events'] & string>(
    name: K, payload: TChannelDef['events'][K]
  ): void;

  // ❌ request cross-feature — toujours opaque, pas de TDef cible
  protected request(
    targetNs: string, name: string, params: unknown
  ): unknown | null;
}

// @bonsai/view — trigger toujours libre
export abstract class View {
  protected trigger(ns: string, cmd: string, payload: unknown): void;
  getUI(key: string): TProjectionNode; // clé libre
}
```

| Avantages | Inconvénients |
| --------- | ------------- |
| + `emit()` et handlers de commandes pleinement typés | - `request()` cross-feature reste `unknown | null` — cast au call-site |
| + Autocomplétion sur les noms de messages **du propre channel** | - `trigger()` depuis View reste une `string` libre |
| + `TChannelDefinition` est la fondation pour une évolution future | - `getUI(key)` non typé — clé libre, retour non différencié |
| + Migration progressive des Features existantes | - La moitié du problème est résolue, l'autre reste entière |

---

### Option C — Architecture complète : `TChannelDefinition` + `TChannelToken` + `TUIMap<T>` ✅

**Description** : compléter l'Option B avec un mécanisme de **token de canal** (`TChannelToken`) qui encode à la fois le namespace et la définition structurée d'un Channel. Ce token est exposé en `static readonly channel` sur chaque Feature et sert de clé typée pour toute référence croisée. La View devient générique sur ses tokens d'écoute et sa carte UI.

#### Bloc 1 — `TChannelDefinition` et `TChannelToken` (`@bonsai/event`)

```ts
// Contrat structurel d'un Channel — déclare toutes ses lanes
export type TChannelDefinition = {
  readonly commands: Record<string, unknown>;
  readonly events:   Record<string, unknown>;
  readonly requests: Record<string, { params: unknown; result: unknown }>;
};

// Token phantom — encode namespace (runtime) et définition (compile-time)
// _def est optionnel pour permettre { namespace } satisfies TChannelToken<TDef> côté applicatif
export type TChannelToken<
  TDef extends TChannelDefinition,
  TNS extends string = string
> = {
  readonly namespace: TNS;
  readonly _def?: TDef; // phantom — jamais assigné en runtime
};

// Extracteur utilitaire : TTokenDef<CartFeature['channel']> → TCartChannelDef
export type TTokenDef<T> =
  T extends TChannelToken<infer TDef, any> ? TDef : never;
```

#### Bloc 2 — `Channel<TDef>` générique (`@bonsai/event`)

```ts
export class Channel<TDef extends TChannelDefinition = TChannelDefinition> {
  constructor(public readonly name: string) {}

  // Lane 1 — Commands
  handle<K extends keyof TDef['commands'] & string>(
    name: K,
    handler: (payload: TDef['commands'][K]) => void
  ): void;

  trigger<K extends keyof TDef['commands'] & string>(
    name: K,
    payload: TDef['commands'][K]
  ): void;

  // Lane 2 — Events
  listen<K extends keyof TDef['events'] & string>(
    name: K,
    listener: (payload: TDef['events'][K]) => void
  ): void;

  emit<K extends keyof TDef['events'] & string>(
    name: K,
    payload: TDef['events'][K]
  ): void;

  // Lane 3 — Requests
  reply<K extends keyof TDef['requests'] & string>(
    name: K,
    replier: (p: TDef['requests'][K]['params']) => TDef['requests'][K]['result']
  ): void;

  request<K extends keyof TDef['requests'] & string>(
    name: K,
    params: TDef['requests'][K]['params']
  ): TDef['requests'][K]['result'] | null;
}
```

#### Bloc 3 — `Feature<TEntity, TChannelDef, TSelfNS>` (`@bonsai/feature`)

```ts
export abstract class Feature<
  TEntity extends Entity<TJsonSerializable> = Entity<TJsonSerializable>,
  TChannelDef extends TChannelDefinition = TChannelDefinition,
  TSelfNS extends string = string
> {
  // Token statique — exposé pour être consommé par View et autres Features
  // Les sous-classes le surchargent avec les types concrets
  static readonly channel: TChannelToken<TChannelDefinition, string>;

  // C1 — emit typé sur le propre Channel (I1, I12)
  protected emit<K extends keyof TChannelDef['events'] & string>(
    eventName: K,
    payload: TChannelDef['events'][K]
  ): void;

  // C5 — request typé via token cross-feature (I17)
  protected request<
    TDef extends TChannelDefinition,
    TNS extends string,
    K extends keyof TDef['requests'] & string
  >(
    token: TChannelToken<TDef, TNS>,
    requestName: K,
    params: TDef['requests'][K]['params']
  ): TDef['requests'][K]['result'] | null;
}

// ── Types utilitaires de dérivation des handlers ─────────────────────────────

// Dérive le contrat des handlers de commandes à partir de TChannelDef
// Utilisé avec `implements` pour la vérification compile-time (I48 renforcé)
export type TCommandHandlers<TDef extends TChannelDefinition> = {
  [K in keyof TDef['commands'] & string as `on${Capitalize<K>}Command`]:
    (payload: TDef['commands'][K]) => void;
};

// Dérive le contrat des handlers d'events entrants (Channel externe)
export type TExternalEventHandlers<
  TDef extends TChannelDefinition,
  TNS extends string
> = {
  [K in keyof TDef['events'] & string as `on${Capitalize<TNS>}${Capitalize<K>}Event`]:
    (payload: TDef['events'][K]) => void;
};
```

#### Bloc 4 — `TUIMap<T>` et `View<TTokens, TUI>` (`@bonsai/view`)

```ts
// Entrée de la carte UI — type de l'élément DOM et events DOM autorisés
export type TUIEntry = {
  readonly el: HTMLElement;
  readonly event: readonly string[];
};

// TUIMap<T> — alias documenté pour la déclaration declarative
export type TUIMap<T extends Record<string, TUIEntry>> = T;

// TProjectionNodeFor<TEl> — version typée retournée par getUI()
export type TProjectionNodeFor<TEl extends HTMLElement = HTMLElement> =
  Omit<TProjectionNode, 'element'> & { element(): TEl };

// View générique sur ses tokens d'écoute et sa carte UI
export abstract class View<
  TListenTokens extends readonly TChannelToken<TChannelDefinition, string>[] = [],
  TUI extends Record<string, TUIEntry> = Record<string, TUIEntry>
> {
  // getUI : clé contrainte aux keyof TUI, retour différencié par type HTML
  getUI<K extends keyof TUI & string>(key: K): TProjectionNodeFor<TUI[K]['el']>;

  // trigger : clé de commande contrainte au TDef du token cible (I4 — jamais emit)
  protected trigger<
    TDef extends TChannelDefinition,
    TNS extends string,
    K extends keyof TDef['commands'] & string
  >(
    token: TChannelToken<TDef, TNS>,
    commandName: K,
    payload: TDef['commands'][K]
  ): void;
}
```

#### Bloc 5 — Exemple applicatif complet (usage côté développeur)

```ts
// ── cart.feature.ts ──────────────────────────────────────────────────────────

// Étape 1 : Déclarer les types (le contrat)
export type TCartChannelDef = {
  readonly commands: {
    addItem:    { id: string; qty: number };
    removeItem: { id: string };
    clear:      void;
  };
  readonly events: {
    itemAdded:   { id: string; qty: number };
    itemRemoved: { id: string };
    cleared:     void;
  };
  readonly requests: {
    getTotal: { params: void; result: number };
    getCount: { params: void; result: number };
  };
};

// Étape 2 : Implémenter la classe
export class CartFeature
  extends Feature<CartEntity, TCartChannelDef, "cart">
  implements TCommandHandlers<TCartChannelDef>
{
  // Token statique — référence typée pour tout consommateur
  static readonly channel: TChannelToken<TCartChannelDef, "cart"> = {
    namespace: "cart",
  };

  protected get Entity() { return CartEntity; }

  // Étape 3 : Récompense — handlers inférés, payloads typés
  onAddItemCommand(payload: { id: string; qty: number }): void {
    // TS error si signature ne correspond pas à TCommandHandlers<TCartChannelDef>
    this.entity.mutate("cart:addItem", (draft) => {
      draft.items.push({ ...payload });
    });
    this.emit("itemAdded", { id: payload.id, qty: payload.qty }); // ✅ noms + payloads typés
  }

  onRemoveItemCommand(payload: { id: string }): void {
    this.entity.mutate("cart:removeItem", (draft) => {
      draft.items = draft.items.filter(i => i.id !== payload.id);
    });
    this.emit("itemRemoved", { id: payload.id });
  }

  onGetTotalRequest(_params: void): number {
    return this.entity.state.items.reduce((sum, i) => sum + i.price * i.qty, 0);
  }
}

// ── pricing.feature.ts ───────────────────────────────────────────────────────
// (une Feature qui interroge CartFeature)
export class PricingFeature extends Feature<PricingEntity, TPricingChannelDef, "pricing"> {
  static readonly channel: TChannelToken<TPricingChannelDef, "pricing"> = {
    namespace: "pricing",
  };
  static readonly channels = ["cart"] as const; // satisfies ExternalOf<"pricing">[]

  protected get Entity() { return PricingEntity; }

  onComputeDiscountCommand(payload: { threshold: number }): void {
    // ✅ request typé via token — total est number | null
    const total = this.request(CartFeature.channel, "getTotal", undefined);
    if (total !== null && total > payload.threshold) {
      this.emit("discountApplied", { amount: total * 0.1 });
    }
  }
}

// ── CartView.view.ts ─────────────────────────────────────────────────────────
// Étape 1 : Déclarer la carte UI
export type TCartViewUI = TUIMap<{
  addButton:  { el: HTMLButtonElement; event: ['click'] };
  totalLabel: { el: HTMLSpanElement;   event: [] };
  clearBtn:   { el: HTMLButtonElement; event: ['click'] };
}>;

// Étape 2 : Implémenter la View
export class CartView extends View<[typeof CartFeature.channel], TCartViewUI> {
  get params() {
    return {
      uiElements: {
        addButton:  ".CartView-addBtn",
        totalLabel: ".CartView-total",
        clearBtn:   ".CartView-clearBtn",
      },
      listen:  ["cart"],
      trigger: ["cart"],
    } as const;
  }

  // Étape 3 : Récompense
  onAddButtonClick(_e: MouseEvent): void {
    this.trigger(CartFeature.channel, "addItem", { id: "p1", qty: 1 }); // ✅ typé
    // this.trigger(CartFeature.channel, "addItemm", ...);  // ❌ TS error : clé inexistante
  }

  onCartItemAddedEvent(payload: TCartChannelDef['events']['itemAdded']): void {
    // ✅ payload est { id: string; qty: number }
    this.getUI("totalLabel").element().textContent = `+${payload.qty}`;
    // this.getUI("totalLabelX");  // ❌ TS error : clé inexistante dans TCartViewUI
  }
}
```

| Avantages | Inconvénients |
| --------- | ------------- |
| + Aucun `unknown` ni `string` libre dans les surfaces publiques | - Verbosité initiale : `TCartChannelDef` à déclarer avant la classe |
| + Autocomplétion sur tous les noms de messages (commandes, events, requests) | - `static readonly channel` à déclarer manuellement (statics non hérités des type params) |
| + `getUI()` typé par élément HTML → `HTMLButtonElement`, `HTMLInputElement`, etc. | - `TListenTokens` sur View : verbosité à la déclaration |
| + `request()` cross-feature retourne le bon type sans cast | - Propagation des generics : `Feature<E, TDef, NS>` partout dans les signatures de test |
| + Renommer un event = cascade d'erreurs TS à tous les consommateurs | |
| + `implements TCommandHandlers<TDef>` : l'IDE suggère les handlers attendus | |
| + Conforme au Style Guide §1 dans son intégralité | |

---

## Analyse comparative

| Critère | A — Partiel | B — Sans token | C — Complet |
| ------- | ----------- | -------------- | ----------- |
| Noms de messages typés (commandes propres) | ❌ | ⭐⭐⭐ | ⭐⭐⭐ |
| Noms de messages typés (cross-feature) | ❌ | ❌ | ⭐⭐⭐ |
| Payloads des handlers inférés | ⭐ (annotation manuelle) | ⭐⭐ (propre channel) | ⭐⭐⭐ |
| `request()` typé (retour concret) | ❌ | ❌ | ⭐⭐⭐ |
| `trigger()` typé depuis View | ❌ | ❌ | ⭐⭐⭐ |
| `getUI(key)` à clé contrainte + élément HTML | ❌ | ❌ | ⭐⭐⭐ |
| Refactoring sûr (renommage cascade) | ❌ | ⭐⭐ (partiel) | ⭐⭐⭐ |
| Conformité « Types d'abord, récompense ensuite » | ⭐ | ⭐⭐ | ⭐⭐⭐ |
| Coût de migration | ⭐⭐⭐ (nul) | ⭐⭐ | ⭐⭐ |
| Verbosité côté applicatif | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ (compensée par inférence) |
| Performance TypeScript (checker) | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ (à surveiller) |

---

## Décision

Nous choisissons **Option C — Architecture complète**, pour les raisons suivantes.

### 1. Le Style Guide décrète déjà la cible

Le [FRAMEWORK-STYLE-GUIDE §1](../guides/FRAMEWORK-STYLE-GUIDE.md) n'est pas une aspiration vague : il décrit précisément `TChannelDefinition`, `TUIMap`, `TRequiredCommandHandlers` et le pattern `extends Feature<TEntity, TChannel>`. L'Option C est la traduction directe de ce texte en code. Ne pas la retenir reviendrait à invalider le guide lui-même.

### 2. La DX à long terme justifie le coût initial

L'Option A n'apporte qu'une amélioration superficielle : les noms de messages restent des chaînes libres, les fautes de frappe sont silencieuses. L'Option B résout la moitié du problème (emit/handle) mais laisse `request()` cross-feature et `trigger()` View en dehors du système de types — précisément les appels les plus critiques car ils traversent des frontières de composants.

La verbosité de C est **concentrée en un seul endroit** (`TChannelDefinition`, déclaré une fois par Feature) et se dissipe à l'utilisation grâce à l'inférence. L'investissement initial est amorti dès le deuxième handler.

### 3. Le token résout le problème de la référence croisée sans couplage fort

Le `TChannelToken` est l'artefact minimal permettant de transporter une définition de type d'un composant à l'autre sans importer de classe concrète entière. Un View qui `import type { CartFeature }` pour accéder à `CartFeature.channel` n'importe que le token — la classe Feature n'est chargée qu'à l'exécution par le manifest.

### 4. `implements TCommandHandlers<TDef>` = contrat vérifiable

La troisième étape du pattern — la récompense — ne devient réelle qu'avec `implements`. Sans elle, le développeur peut écrire `onAddItemCommand(payload: any)` et tout compile. Avec `implements TCommandHandlers<TCartChannelDef>`, l'IDE génère le stub correct et TypeScript signale toute déviation. C'est l'application directe de l'invariant I48 au niveau du compilateur.

### Pourquoi pas A ni B

- **A** est rejetée : elle n'élimine pas les fautes de frappe silencieuses sur les noms de messages, qui sont la source la plus fréquente de bugs invisibles dans ce type d'architecture.
- **B** est rejetée : elle laisse `request()` cross-feature et `trigger()` depuis View sans typage — or ces deux appels sont les plus exposés aux régressions lors d'un refactoring.

### Invariants structurants

Le `TChannelDefinition` déclaré dans le fichier `.feature.ts` du domaine (co-localisé, ADR §3.3 du Style Guide) est **la source de vérité unique** de ce que le Channel de cette Feature accepte, émet, et expose. Tout consommateur — View, Feature externe — obtient ses types en référençant ce fichier. C'est la traduction exacte du principe « le type EST le contrat » dans le domaine de la communication inter-composants.

---

## Conséquences

### Positives

- ✅ **Zéro `unknown` dans les surfaces publiques** de `Channel`, `Feature` et `View`
- ✅ **Autocomplétion IDE complète** sur les noms de commandes, events et requests de tout Channel déclaré
- ✅ **Refactoring sûr** : renommer une clé de `TChannelDefinition` provoque une cascade d'erreurs TS sur tous les consommateurs
- ✅ **`request()` retourne le type concret** déclaré dans `TDef['requests'][K]['result']` — plus de cast au call-site
- ✅ **`getUI(key)` retourne `TProjectionNodeFor<TEl>`** — `element()` typé par l'élément HTML réel
- ✅ **Handlers vérifiés compile-time** via `implements TCommandHandlers<TDef>` — l'IDE génère les stubs corrects
- ✅ **Conformité totale au FRAMEWORK-STYLE-GUIDE §1** — le triptyque Déclarer / Implémenter / Récompenser devient effectif
- ✅ **`TChannelToken` sans couplage de classe** — un View importe uniquement le token, pas la Feature entière

### Négatives (acceptées)

- ⚠️ **`TChannelDefinition` à déclarer par Feature** — verbosité initiale inévitable. Compensée : elle remplace les commentaires et la documentation des payloads qui n'existaient pas.
- ⚠️ **`static readonly channel` à déclarer manuellement** — TypeScript ne peut pas dériver un champ statique depuis les paramètres de type d'une classe abstraite. Coût : une ligne par Feature.
- ⚠️ **Migration de la strate 0** — les fixtures, tests unitaires et code Feature/View existants doivent être mis à jour. Volume limité (strate 0 fraîche), mais breaking change documenté.
- ⚠️ **`TListenTokens` sur View** — le paramètre de type `TListenTokens` n'est utilisé que pour la vérification des handlers d'events entrants. En strate 1, son exploitation sera renforcée. Pour l'instant il est déclaré mais son enforcement compile-time sur les handlers est partiel.

### Risques identifiés

- 🔶 **Performance du checker TS sur les mapped types** — `TCommandHandlers<TDef>` génère des types indexés. Mitigation : les `TChannelDefinition` ont des formes plates (pas de récursivité), le checker reste rapide. À benchmarker sur un manifest de 20+ Features.
- 🔶 **`TProjectionNodeFor<TEl>` sur des sélecteurs qui matchent plusieurs types** — un sélecteur CSS comme `"button"` peut matcher `HTMLButtonElement` ou `HTMLInputElement[type=submit]`. Mitigation : la déclaration `TUI[K]['el']` est manuelle — le développeur déclare le type qu'il attend ; le framework ne peut pas vérifier la cohérence DOM/type.
- 🔶 **Compatibilité du token avec le Mode ESM Modulaire (ADR-0019)** — un module ESM qui déclare un token crée une dépendance à `@bonsai/event`. Ce package est déjà une dépendance transitive. Pas de risque de cycle.
- 🔶 **`implements TCommandHandlers` impose des méthodes publiques** — les handlers sont techniquement exposés dans l'interface publique de la classe. Par convention ils restent des méthodes de cycle de vie framework, non des API publiques. Une note dans le Style Guide précisera cette nuance.

### Nouveaux invariants

| Réf | Contenu |
| --- | ------- |
| I73 | Chaque Feature DOIT déclarer un `static readonly channel: TChannelToken<TChannelDef, TSelfNS>` exposant son contrat de communication. |
| I74 | Le `TChannelDefinition` d'une Feature est co-localisé dans le fichier `.feature.ts` du domaine — il n'existe pas de fichier `.channel.ts` séparé. |
| I75 | Aucun `any` ni `unknown` n'est autorisé dans les signatures publiques de `Channel`, `Feature` ou `View` — les casts sont isolés dans l'implémentation interne. |
| I76 | `Channel.trigger()`, `Channel.emit()`, `Channel.request()`, `Channel.handle()`, `Channel.listen()`, `Channel.reply()` sont strictement typés par `TDef` — le nom de message est une `keyof TDef['lane']`, jamais une `string` libre. |
| I77 | `View.trigger()` accepte uniquement un `TChannelToken` — jamais un namespace `string` libre. |
| I78 | `View.getUI(key)` accepte uniquement une clé déclarée dans `TUI` — jamais une `string` libre. |
| I79 | `Feature.request()` accepte uniquement un `TChannelToken` — jamais un namespace `string` libre. |

### Invariants renforcés

| Réf | Formulation précédente | Formulation renforcée |
| --- | ---------------------- | --------------------- |
| I1 | Feature ne peut emit() que sur son propre Channel | emit() est typé contre `TChannelDef['events']` — noms et payloads vérifiés compile-time |
| I4 | View n'a jamais emit() — absent du type | View.trigger() est typé via TChannelToken — la signature contractuelle exclut emit() |
| I48 | Handlers auto-découverts par convention de nommage | Handlers auto-découverts **et** vérifiés compile-time via `implements TCommandHandlers<TDef>` |

### Impact sur le code existant

| Fichier | Changement requis |
| ------- | ----------------- |
| `packages/event/src/channel.class.ts` | Rendre `Channel` générique sur `TDef extends TChannelDefinition` ; typer toutes les méthodes des 3 lanes |
| `packages/event/src/bonsai-event.ts` | Exporter `TChannelDefinition`, `TChannelToken`, `TTokenDef` |
| `packages/event/src/radio.class.ts` | Ajouter `channelFor<TDef>(token: TChannelToken<TDef>): Channel<TDef>` |
| `packages/feature/src/bonsai-feature.ts` | Insérer `TChannelDef` en 2e paramètre, typer `emit()` et `request()`, ajouter `static channel` abstrait |
| `packages/feature/src/bonsai-feature.ts` | Exporter `TCommandHandlers<TDef>`, `TExternalEventHandlers<TDef, TNS>` |
| `packages/view/src/bonsai-view.ts` | Paramétrer `View` sur `TListenTokens` et `TUI extends Record<string, TUIEntry>` ; typer `getUI()` et `trigger()` |
| `packages/view/src/bonsai-view.ts` | Exporter `TUIMap<T>`, `TUIEntry`, `TProjectionNodeFor<TEl>` |
| `tests/fixtures/cart-feature.fixture.ts` | Ajouter `TCartChannelDef`, `static channel`, `implements TCommandHandlers<TCartChannelDef>` |
| `tests/unit/strate-0/channel.basic.test.ts` | Adapter les appels de test aux nouvelles signatures génériques |
| `tests/unit/strate-0/feature.basic.test.ts` | Idem |
| `tests/unit/strate-0/view.basic.test.ts` | Idem |
| `tests/types/` | Ajouter tests compile-time : clé inexistante → `@ts-expect-error`, payload incorrect → `@ts-expect-error` |

---

## Actions de suivi

- [ ] Implémenter sur branche dédiée `feature/strate-1-typed-channel-api`
- [ ] `packages/event` : `Channel<TDef>`, `TChannelDefinition`, `TChannelToken`, `Radio.channelFor()`
- [ ] `packages/feature` : mise à jour signature + `emit()` + `request()` + types de dérivation handlers
- [ ] `packages/view` : `View<TTokens, TUI>` + `getUI()` typé + `trigger()` via token
- [ ] Mettre à jour `tests/fixtures/cart-feature.fixture.ts` avec `TCartChannelDef` et `static channel`
- [ ] Migrer les tests unitaires strate 0 (channel, feature, view) aux nouvelles signatures
- [ ] Ajouter tests de type (`tests/types/`) : `@ts-expect-error` sur clé inexistante, payload incorrect, `getUI` clé absente
- [ ] Mettre à jour [FRAMEWORK-STYLE-GUIDE §2](../guides/FRAMEWORK-STYLE-GUIDE.md) — ajouter note sur la visibilité `public` des handlers via `implements`
- [ ] Mettre à jour [RFC-0002 communication.md](../rfc/2-architecture/communication.md) — sections Channel et cross-feature
- [ ] Mettre à jour [invariants.md](../rfc/reference/invariants.md) — I73 à I79 et I1/I4/I48 renforcés
- [ ] Valider la suite complète (gate E2E + seuils de coverage) après migration

---

## Hors-scope explicite

- **Metas propagées** (`TMessageMetas`) — sujet strate 1, traité séparément. Les handlers de strate 0 ne reçoivent pas encore de metas en second paramètre.
- **`TUIEventFor<TUI, K, E>`** — type précis des événements DOM par élément (ex : `MouseEvent & { currentTarget: HTMLButtonElement }`). Déclaré dans le Style Guide, implémenté en strate 2+ quand les Behaviors sont introduits.
- **Entity intents typés** — `entity.mutate("cart:addItem")` reste une `string` libre. Les intents sont de la traçabilité, pas du routage ; leur typage serait un gain marginal au coût d'un type supplémentaire par Entity.
- **`TListenTokens` enforcement compile-time des handlers d'events** — la validité des méthodes `on{Channel}{Event}Event` par rapport aux tokens déclarés en `TListenTokens` est partiellement vérifiable (via `TExternalEventHandlers`). L'enforcement complet nécessite un type utilitaire `ValidateViewHandlers<>` — laissé à strate 2.

---

## Références

- [FRAMEWORK-STYLE-GUIDE §1](../guides/FRAMEWORK-STYLE-GUIDE.md) — Principe directeur, triptyque Déclarer / Implémenter / Récompenser
- [ADR-0003](ADR-0003-channel-runtime-semantics.md) — Sémantiques runtime Channel (préservées)
- [ADR-0024](ADR-0024-component-capabilities-manifest-pattern.md) — Pattern `as const satisfies` pour les manifestes de composants
- [ADR-0037](ADR-0037-feature-generic-entity-class.md) — Signature `Feature<TEntity, TChannel>` (étendue ici)
- [ADR-0039](ADR-0039-namespace-authority-and-uniqueness.md) — `TSelfNS`, manifest typé (contrainte C1)
- TypeScript Handbook — [Mapped Types](https://www.typescriptlang.org/docs/handbook/2/mapped-types.html)
- TypeScript Handbook — [Template Literal Types](https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html)
- TypeScript Handbook — [Conditional Types](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html)

---

## Historique

| Date       | Changement            |
| ---------- | --------------------- |
| 2026-04-27 | Création et acceptation (Proposed → Accepted) |
| 2026-05-13 | 🔵 **Tested** — I73 / I74 cités dans `tests/e2e/strate-0.cart-round-trip.test.ts` (CartFeature canonique avec `static readonly channel` + TDef co-localisé) ; I75 / I76 / I77 / I78 / I79 cités dans `tests/types/strate-0/view-contract.types.test.ts` et `tests/unit/strate-0/feature.basic.test.ts`. Critère C-Inv d'ADR-0043 satisfait. |
