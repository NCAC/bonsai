# Index des types

> **Glossaire exhaustif de tous les types TypeScript du framework Bonsai**

[← Retour a la reference](../reference/)

---

> **Regle de gouvernance** : les types definis dans cet index sont des **resumes avec renvoi**
> vers le document source of truth. En cas de divergence, le document dedie prevaut
> (cf. matrice source de verite, README).

## Types fondamentaux

| Type | Definition | Source |
|------|------------|--------|
| `TJsonSerializable` | Contrainte de type : valeurs serialisables en JSON (D10) | [entity.md](../3-couche-abstraite/entity.md) |
| `TEntityStructure` | Type decrivant la structure de donnees d'une Entity — alias formel de `TStructure`, contraint a `TJsonSerializable` (D10) | [entity.md](../3-couche-abstraite/entity.md) |
| `TChannelDefinition` | Type tri-lane : Commands, Events, Requests d'un Channel | [communication.md](../2-architecture/communication.md) |
| `TMessageMetas` | Type des metadonnees causales attachees a chaque message (ADR-0005, ADR-0016). Handlers les recoivent en parametre `(payload, metas)` | [metas.md](../2-architecture/metas.md) |
| `TApplicationConfig` | Configuration globale de l'application | [application.md](../3-couche-abstraite/application.md) |

## Types bootstrap

| Type | Definition | Source |
|------|------------|--------|
| `PhaseKey` | Identifiant de phase bootstrap : `'config' \| 'channels' \| 'entities' \| 'features' \| 'views' \| 'start'`. 6 phases sequentielles (ADR-0010) | [application.md](../3-couche-abstraite/application.md) |
| `TAppContext` | Contexte applicatif construit progressivement durant le bootstrap : `{ config, radio, channels, entities, features, views }`. Disponible en totalite apres la phase `'start'` (ADR-0010) | [application.md](../3-couche-abstraite/application.md) |
| `BootstrapError` | Erreur de bootstrap localisee par phase : `{ phase: PhaseKey; cause: Error }`. Thrown par `start()` si une phase echoue (ADR-0010) | [application.md](../3-couche-abstraite/application.md) |
| `TBootstrapOptions` | Options optionnelles de `start()` : `{ serverState?: Record<string, TJsonSerializable> }`. Si `serverState` fourni, le framework pre-peuple les Entities silencieusement en phase 3 (ADR-0014 H5) | [application.md](../3-couche-abstraite/application.md) |

## Types Entity

| Type | Definition | Source |
|------|------------|--------|
| `TEntityEvent` | Notification de mutation de state emise par le framework apres chaque appel a `mutate()`. Contient `intent`, `payload`, `patches`, `inversePatches`, `timestamp`, `changedKeys` — tous `readonly`. Consomme par le handler catch-all `onAnyEntityUpdated` | [entity.md](../3-couche-abstraite/entity.md) |
| `ExtractEntityKeyHandlerName<TKey>` | Template literal type : `"items"` -> `"onItemsEntityUpdated"`. Genere les noms de handlers Entity per-key | [conventions-typage.md](../6-transversal/conventions-typage.md) |
| `TEntityKeyHandlers<TStructure>` | Mapped type **optionnel** : pour chaque cle K de TStructure, genere `on<K>EntityUpdated(prev, next, patches)`. Utilisable via `implements Partial<TEntityKeyHandlers<TStructure>>` | [conventions-typage.md](../6-transversal/conventions-typage.md) |

## Types Channel et handlers

| Type | Definition | Source |
|------|------------|--------|
| `ExtractHandlerName<TName, TSuffix>` | Template literal type : `"addItem"` + `"Command"` -> `"onAddItemCommand"` | [conventions-typage.md](../6-transversal/conventions-typage.md) |
| `ExtractCrossChannelHandlerName<TNs, TEvt>` | Template literal type pour Events cross-Channel : `"inventory"` + `"stockUpdated"` -> `"onInventoryStockUpdatedEvent"` | [conventions-typage.md](../6-transversal/conventions-typage.md) |
| `TRequiredCommandHandlers<TChannel>` | Mapped type : signatures handler obligatoires depuis les Commands du Channel | [conventions-typage.md](../6-transversal/conventions-typage.md) |
| `TRequiredRequestHandlers<TChannel>` | Mapped type : signatures handler obligatoires depuis les Requests du Channel | [conventions-typage.md](../6-transversal/conventions-typage.md) |
| `TEventHandlers<TChannels>` | Mapped type **optionnel** (`Partial<>`) : pour chaque Channel declare en `listen` et chaque Event, genere `on<Namespace><EventName>Event(payload, metas)`. Opere sur un tuple de Channels via `UnionToIntersection`. Metas explicites (ADR-0016). Pas de prefixe `Required` car les event handlers sont optionnels | [conventions-typage.md](../6-transversal/conventions-typage.md) |
| `CommandPayload<TChannel, TName>` | Extrait le type de payload d'un Command | [conventions-typage.md](../6-transversal/conventions-typage.md) |
| `RequestResult<TChannel, TName>` | Extrait le type de resultat d'un Request (via `infer`) | [conventions-typage.md](../6-transversal/conventions-typage.md) |
| `declareChannel<T>(ns)` | Utilitaire framework : cree un token leger (`{ namespace }`) type comme `T` | [feature.md](../3-couche-abstraite/feature.md) |
| `Channel<TDef>` | Classe runtime **interne** au framework (ADR-0040 — typée par `TChannelDefinition`) — registres de handlers, dispatch, garde-fous. Créée à la **Phase 1 du bootstrap** depuis le manifest applicatif (ADR-0039 — D15), jamais exposée (I80) | [communication.md](../2-architecture/communication.md) |
| `TChannelToken<TDef, NS>` | Token discriminant `{ namespace: NS }` typé par `TDef`. Exposé par `Feature.channel` static (ADR-0040). C'est l'unique pont entre la classe Feature et son contrat de communication | [feature.md](../3-couche-abstraite/feature.md), [communication.md](../2-architecture/communication.md) |

## Types View et UI (ADR-0042 — pattern modulaire)

> **Pré-ADR-0042 : `TUIMap`, `TUIEventFor`, `TViewParams`, `TViewCapabilities`, `TAutoUIEventHandlers`, `TViewTriggerCapability`, `TViewRequestCapability`, `TViewEventHandlers` ont été supprimés.**
> Le pattern actuel décompose le contrat en **trois modules** indépendants composés par `TViewContract<F, U>`.

### Module Features — TFeatureContract

| Type | Definition | Source |
|------|------------|--------|
| `TFeatureContract` | Map `{ namespace → { feature, listens, triggers, requests } }` (ADR-0042). La clé d'objet ≡ le namespace (I87) ; `feature` est `TFeatureRefForNS<NS>` ; les trois lanes sont des `readonly string[]` | [feature.md](../3-couche-abstraite/feature.md), [view.md](../4-couche-concrete/view.md) |
| `TFeatureRef<TDef, NS>` | Référence Feature : tout objet exposant `channel: TChannelToken<TDef, NS>` (ADR-0040) | [feature.md](../3-couche-abstraite/feature.md) |
| `TFeatureRefForNS<NS>` | Référence Feature dont le namespace est imposé par la clé du contrat (I87 — vérifié compile-time) | [feature.md](../3-couche-abstraite/feature.md) |
| `TFlatListens<F>` / `TFlatTriggers<F>` / `TFlatRequests<F>` | Mapped types : aplatissent `TFeatureContract` en map `"ns:event"` → payload. Alimentent les signatures de `callTrigger` / `callRequest` et la génération des handlers | [feature.md](../3-couche-abstraite/feature.md) |
| `TCommandPayloadFor<F, K>` / `TEventPayloadFor<F, K>` / `TRequestParamsFor<F, K>` / `TRequestResultFor<F, K>` | Extracteurs de payload typé pour une clé `"ns:name"` du contrat | [feature.md](../3-couche-abstraite/feature.md) |
| `TChannelCallbacks<F>` | Mapped type : signature des handlers `on{NS}{Event}Event` requise par `implements`. Symétrie avec `F.{ns}.listens` (D48 channel) | [feature.md](../3-couche-abstraite/feature.md) |

### Module UI — TUIContract et TUIElements

| Type | Definition | Source |
|------|------------|--------|
| `TUIEntry<TEl, TEvts>` | Entrée UI typée : `{ events: TEvts; _el?: TEl }`. Phantom `_el?` encode `TEl` sans allocation runtime (I85). `events: []` = non-interactif explicite (I86) | [view.md](../4-couche-concrete/view.md) |
| `ui<TEl>()(events)` | Helper curryfié — unique mécanisme de construction d'une `TUIEntry` (I85). La forme curryfiée préserve l'inférence littérale de `events` quand `TEl` est explicité | [view.md](../4-couche-concrete/view.md) |
| `TUIContract` | `Readonly<Record<string, TUIEntry>>` — module contractuel UI composé par `TViewContract.ui` | [view.md](../4-couche-concrete/view.md) |
| `TUIElements<TUI>` | Mapped type sur `TUI` : table sélecteurs CSS clé → string. Toute clé orpheline ou manquante → erreur compile (D34) | [view.md](../4-couche-concrete/view.md) |
| `ExtractEl<TEntry>` | Extrait `TEl` d'une `TUIEntry` via le phantom — utilisé par `getUI(key)` pour préserver le sous-type DOM | [view.md](../4-couche-concrete/view.md) |
| `TDOMEventFor<S>` | Mappe un nom d'event DOM (`"click"`) vers son type natif (`MouseEvent`) via `HTMLElementEventMap` | [view.md](../4-couche-concrete/view.md) |
| `TUIEntryHandlers<TKey, TEntry>` / `TUICallbacks<U>` | Génèrent les signatures `on{Key}{Event}` requises par `implements` à partir de `TUIContract`. Symétrie Contract/Callbacks (I88, D48 UI) | [view.md](../4-couche-concrete/view.md) |

### Composition View

| Type | Definition | Source |
|------|------------|--------|
| `TViewContract<F, U>` | Composition `{ features: F; ui: U }` (ADR-0042). Un seul générique sur la classe : `View<TVC>` | [view.md](../4-couche-concrete/view.md) |
| `TViewCallbacks<TVC>` | Clause `implements` unique : `TChannelCallbacks<F> & TUICallbacks<U>` (I88). Couple imposé : `extends View<TVC>` + `implements TViewCallbacks<TVC>` | [view.md](../4-couche-concrete/view.md) |
| `TViewClass` | `abstract new (...args: any[]) => View<any>` — surface structurelle d'une classe View concrète, indépendante de son contrat. Utilisée par le Composer (variance) | [view.md](../4-couche-concrete/view.md) |

## Types Projection DOM Reactive

| Type | Definition | Source |
|------|------------|--------|
| `TProjectionRead` | Type de lecture seule sur un @ui DOM : `value()`, `checked()`, `getAttr()`, `getText()`, `hasClass()`. Retourne par `getUI(key)` pour les @ui couverts par un template (N2/N3, D32) | [view.md](../4-couche-concrete/view.md) |
| `TProjectionNode` | Type de lecture + mutation N1 sur un @ui DOM, extends `TProjectionRead`. Primitives : `text()`, `attr()`, `toggleClass()`, `visible()`, `style()`. Retourne par `getUI(key)` pour les @ui **sans** template. N'expose **pas** `.node` (I39, D19, D32) | [view.md](../4-couche-concrete/view.md) |
| `TProjectionList` | Gestionnaire de reconciliation par cle pour listes dynamiques. Algorithme O(n) : `reconcile({ items, key, create, update, remove })`. Utilise en interne par les templates N2 (Mode C, D19) | [5-rendu.md](../5-rendu.md) |
| `TViewTemplateBinding<TData>` | Contrat d'une entree de `get templates()` : `{ template: TProjectionTemplate<any, TData>; select?: (data) => TData \| undefined }`. `select` active l'auto-reactivite | [view.md](../4-couche-concrete/view.md) |
| `TViewTemplates<TUI>` | Union des trois modes de rendu : `null` (Mode A), `{ root: TViewTemplateBinding }` (Mode B), `{ [K in keyof TUI]?: TViewTemplateBinding }` (Mode C). Modes mutuellement exclusifs (D19) | [view.md](../4-couche-concrete/view.md) |
| `TProjectionTemplate` | Type d'un template compile — objet `{ setup, project, create }` genere par le compilateur PugJS -> PDR | [5-rendu.md](../5-rendu.md) |
| `TViewNodes<TUI>` | Objet peuple automatiquement par le framework dans `onAttach()`. Chaque cle correspond a une cle de `get templates()` | [view.md](../4-couche-concrete/view.md) |

## Types Behavior (ADR-0042 — pattern modulaire)

> **Pré-ADR-0042 : `TBehaviorParams`, `TBehaviorTemplates` ont été supprimés.**
> Le pattern actuel est identique à celui de View (I83) : `TFeatureContract` + `TUIContract` + `TUIElements`.
> La classe Behavior (Strate 2) est paramétrée par un seul générique de type `TBehaviorContract` analogue à `TViewContract`. Elle réutilise `TChannelCallbacks` + `TUICallbacks` pour son `implements`.

## Types Composer

| Type | Definition | Source |
|------|------------|--------|
| `TResolveResult<V>` | Type de retour de `Composer.resolve(event)` : `{ view: V; rootElement: string; options?: Partial<ExtractViewOptions<V>> }`. `rootElement` est TOUJOURS un `string` (ADR-0026). `null` détache la View courante (slot vide). Le framework merge `params.options <- options` (D34) | [composer.md](../4-couche-concrete/composer.md) |
| `TComposerEvent<TListen>` | Union discriminée des Events reçus par un Composer (ADR-0027). Dérivée automatiquement depuis le tuple `listen`. Discriminant : `${namespace}:${eventName}`. Permet le narrowing dans un switch avec inférence complète du payload | [composer.md](../4-couche-concrete/composer.md) |
| `TComposerParams` | Contrainte de validation pour l'objet params Composer (ADR-0024) : `{ listen, request }`. Utilisé avec `as const satisfies` | [composer.md](../4-couche-concrete/composer.md) |
| `TComposerCapabilities<TParams>` | Type dérivé complet d'un Composer (ADR-0024 value-first). Extrait les types narrow depuis `typeof params`. Generic de la classe `Composer<TCapabilities>` | [composer.md](../4-couche-concrete/composer.md) |

## Types localState

| Type | Definition | Source |
|------|------------|--------|
| `TLocalUpdate<T>` | Payload des callbacks N1 localState : `{ actual: T; previous: T }`. Signature objet nomme (ADR-0015) | [view.md](../4-couche-concrete/view.md) |
| `TLocalKeyHandlerName<TKey>` | Template literal type : `'isOpen'` -> `'onLocalIsOpenUpdated'`. Genere les noms de callbacks N1 localState per-key (ADR-0015) | [view.md](../4-couche-concrete/view.md) |
| `TLocalKeyHandlers<TLocal>` | Mapped type **optionnel** : pour chaque cle K du localState, genere `onLocal${Capitalize<K>}Updated(update: TLocalUpdate<TLocal[K]>)`. Auto-decouvert par le framework (D12, ADR-0015) | [view.md](../4-couche-concrete/view.md) |

## Types handlers Entity

| Type | Definition | Source |
|------|------------|--------|
| `on<Key>EntityUpdated` | Handler Entity per-key optionnel sur Feature — appele quand la propriete `<Key>` de TStructure change. Recoit `(prev: T, next: T, patches: Patch[])`. Inspire de Marionette `change:key` | [entity.md](../3-couche-abstraite/entity.md) |
| `onAnyEntityUpdated` | Handler Entity catch-all optionnel sur Feature — appele pour tout changement de state. Recoit `TEntityEvent`. Inspire de Marionette `change` | [entity.md](../3-couche-abstraite/entity.md) |
| `populateFromServer(state)` | Methode **interne framework** sur Entity. Pre-peuple silencieusement le state (aucun Event, aucune notification). Appele en phase 3 si `serverState` fourni (ADR-0014 H5) | [entity.md](../3-couche-abstraite/entity.md) |

---

## Lecture suivante

→ [Invariants](invariants.md) — les I1-I58 regles non-negociables
