# Index des types

> **Index des types TypeScript notables du framework Bonsai — pas un export
> complet automatisé.** Ne pas présumer l'absence d'un type qui ne figure pas
> ici ; vérifier par `grep` dans `packages/*/src` avant de conclure.

[← Retour à l'index](../README.md)

---

> **Regle de gouvernance** : les types definis dans cet index sont des **resumes avec renvoi**
> vers le document source of truth. En cas de divergence, le document dedie prevaut
> (cf. [README de la spec](../README.md#règles)).
>
> **Colonne État** : ✅ exporté et livré / ⏳ cible, non exporté aujourd'hui.
> Elle ne remplace pas une vérification `grep` avant usage.

## Types fondamentaux

| Type | Definition | État | Source |
| --- | --- | --- | --- |
| `TJsonSerializable` | Contrainte de type : valeurs serialisables en JSON (ADR-10) | ✅ | [entity.md](../3-couche-abstraite/entity.md) |
| `TEntityStructure` | Type decrivant la structure de donnees d'une Entity — alias formel de `TStructure`, contraint a `TJsonSerializable` (ADR-10) | ⏳ alias non exporté — `TStructure` est un paramètre de type, pas un alias public | [entity.md](../3-couche-abstraite/entity.md) |
| `TChannelDefinition` | Type tri-lane : Commands, Events, Requests d'un Channel | ✅ | [communication.md](../2-architecture/communication.md) |
| `TMessageMetas` | Type des metadonnees causales attachees a chaque message (ADR-04). Handlers les reçoivent en parametre `(payload, metas)` | ⏳ cible strate 1b — n'existe pas dans le code livré | [metas.md](../2-architecture/metas.md) |
| `TApplicationConfig` | Configuration globale de l'application | ⏳ cible — point d'entrée non tranché (application.md §5) | [application.md](../3-couche-abstraite/application.md) |
| `TMutationParams` | Paramètres de `mutate()` : `{ payload?: unknown; metas?: Record<string, unknown> }` | ✅ livré (strate 1a) | [entity.md](../3-couche-abstraite/entity.md) |
| `RESERVED_NAMESPACES` | Constante `["local", "router"] as const` — absente de cet index jusqu'à cette correction | ✅ livré | [reference/invariants.md](invariants.md) |

## Types bootstrap

| Type | Definition | État | Source |
| --- | --- | --- | --- |
| `TBootstrapOptions` | Options optionnelles de `start()` : `{ serverState?: Record<string, TJsonSerializable> }`. Si `serverState` fourni, le framework pre-peuple les Entities silencieusement en phase 3 (ADR-24 H5) | ⏳ cible — `start()` livré n'accepte aucune option | [application.md](../3-couche-abstraite/application.md) |
| Phase 0a / 0b / 0c | Sous-phases de la séquence **strate 0 réellement implémentée** (ADR-09), distinctes du `PhaseKey` cible ci-dessus : 0a = validation format namespace + `channel` (I70/I71/I73) ; 0b = instanciation pure de chaque Feature (`new FeatureClass(ns)`, ctor inerte I94) ; 0c = lecture `instance.listens`/`instance.queries` + validation croisée (I70 amendé). Précèdent la création des Channels | ✅ livré | [application.md](../3-couche-abstraite/application.md) |
| `TApplicationOptions` | Options du constructeur `Application` : `{ foundation, features }` | ✅ livré | [application.md](../3-couche-abstraite/application.md) |

## Types Entity

| Type | Definition | État | Source |
| --- | --- | --- | --- |
| `TEntityEvent` | Retourné par `mutate()` après une mutation non no-op (`null` sinon). Contient `intent`, `payload?`, `metas?`, `changedKeys`, `patches`, `inversePatches`, `previousState`, `nextState`, `timestamp` — tous `readonly`. Consommé par le handler catch-all `onAnyEntityUpdated` | ✅ | [entity.md](../3-couche-abstraite/entity.md) |

## Types Channel et handlers

| Type | Definition | État | Source |
| --- | --- | --- | --- |
| `Channel<TDef>` | Classe runtime **interne** au framework (ADR-14 — typée par `TChannelDefinition`) — registres de handlers, dispatch, garde-fous. Créée à la **Phase 1 du bootstrap** depuis le manifest applicatif (ADR-08 — ADR-14). Exportée par `@bonsai/event` pour l'usage inter-packages, **non** exportée par `@bonsai/core` (I80) | ✅ | [communication.md](../2-architecture/communication.md) |
| `TChannelToken<TDef, NS>` | Token discriminant `{ namespace: NS }` typé par `TDef`. Exposé par `Feature.channel` static (ADR-14). C'est l'unique pont entre la classe Feature et son contrat de communication | ✅ | [feature.md](../3-couche-abstraite/feature.md), [communication.md](../2-architecture/communication.md) |
| `TCommandCallbacks<TDef>` / `TRequestCallbacks<TDef>` / `TListenCallbacks<TListens>` | Composants de `TFeatureCallbacks` (ADR-09) — absents de cet index jusqu'à cette correction | ✅ | [feature.md](../3-couche-abstraite/feature.md) |
| `TFeatureCallbacks<TDef, TListens>` | Clause `implements` unique d'une Feature (ADR-09, I92) : `TCommandCallbacks<TDef> & TRequestCallbacks<TDef> & TListenCallbacks<TListens>`. Handler manquant → `TS2515` ; signature fautive → `TS2416` | ✅ | [feature.md](../3-couche-abstraite/feature.md) |
| `TStrictFeatureClass<NS, TDef>` | Contrainte compile-time appliquée par `StrictManifest<M>` à chaque entrée du manifest (ADR-09, I95) : constructeur `(namespace: NS) => Feature<…, TDef, NS>` + `static channel: TChannelToken<TDef, NS>` aligné (`channel.namespace === NS`) | ✅ | [feature.md](../3-couche-abstraite/feature.md) |
| `TChannelHandlerName<NS, E>` / `TAnyEventPayload` / `TTokenDef<T>` | Absents de cet index jusqu'à cette correction | ✅ | [feature.md](../3-couche-abstraite/feature.md), [communication.md](../2-architecture/communication.md) |

## Types View et UI (ADR-14 — pattern modulaire)

> Le pattern décompose le contrat en **trois modules** indépendants composés par `TViewContract<F, U>`.

### Module Features — TFeatureContract

| Type | Definition | État | Source |
| --- | --- | --- | --- |
| `TFeatureContract` | Map `{ namespace → { feature, listens, triggers, requests } }` (ADR-14). La clé d'objet ≡ le namespace (I87) ; `feature` est `TFeatureRefForNS<NS>` ; les trois lanes sont des `readonly string[]` | ✅ | [feature.md](../3-couche-abstraite/feature.md), [view.md](../4-couche-concrete/view.md) |
| `TFeatureRef<TDef, NS>` | Référence Feature : tout objet exposant `channel: TChannelToken<TDef, NS>` (ADR-14) | ✅ | [feature.md](../3-couche-abstraite/feature.md) |
| `TFeatureRefForNS<NS>` | Référence Feature dont le namespace est imposé par la clé du contrat (I87 — vérifié compile-time) | ✅ | [feature.md](../3-couche-abstraite/feature.md) |
| `TFlatListens<F>` / `TFlatTriggers<F>` / `TFlatRequests<F>` | Aplatissent `TFeatureContract` en **union** de clés `"ns:event"` / `"ns:cmd"` / `"ns:req"` (pas une map). Alimentent les signatures de `trigger` / `request` et la génération des handlers | ✅ | [feature.md](../3-couche-abstraite/feature.md) |
| `TCommandPayloadFor<F, K>` / `TEventPayloadFor<F, K>` / `TRequestParamsFor<F, K>` / `TRequestResultFor<F, K>` | Extracteurs de payload typé pour une clé `"ns:name"` du contrat | ✅ | [feature.md](../3-couche-abstraite/feature.md) |
| `TChannelCallbacks<F>` | Mapped type : signature des handlers `on{NS}{Event}Event` requise par `implements`. Symétrie avec `F.{ns}.listens` (I48 channel) | ✅ | [feature.md](../3-couche-abstraite/feature.md) |

### Module UI — TUIContract et TUIElements

| Type | Definition | État | Source |
| --- | --- | ---- | --- |
| `TUIEntry<TEl, TEvts>` | Entrée UI typée : `{ events: TEvts; _el?: TEl }`. Phantom `_el?` encode `TEl` sans allocation runtime (I85). `events: []` = non-interactif explicite (I86) | ✅ | [view.md](../4-couche-concrete/view.md) |
| `ui<TEl>()(events)` | Helper curryfié — unique mécanisme de construction d'une `TUIEntry` (I85). La forme curryfiée préserve l'inférence littérale de `events` quand `TEl` est explicité | ✅ | [view.md](../4-couche-concrete/view.md) |
| `TUIContract` | `Readonly<Record<string, TUIEntry>>` — module contractuel UI composé par `TViewContract.ui` | ✅ | [view.md](../4-couche-concrete/view.md) |
| `TUIElements<TUI>` | Mapped type sur `TUI` : table sélecteurs CSS clé → string. Toute clé orpheline ou manquante → erreur compile (ADR-21) | ✅ | [view.md](../4-couche-concrete/view.md) |
| `ExtractEl<TEntry>` | Extrait `TEl` d'une `TUIEntry` via le phantom — utilisé par `getUI(key)` pour préserver le sous-type DOM | ✅ | [view.md](../4-couche-concrete/view.md) |
| `TDOMEventFor<S>` | Mappe un nom d'event DOM (`"click"`) vers son type natif (`MouseEvent`) via `HTMLElementEventMap` | ✅ | [view.md](../4-couche-concrete/view.md) |
| `TEventsFor<TEl>` | Mapping sémantique sous-type `HTMLElement` → events DOM autorisés (ADR-15) — plus strict que `lib.dom.d.ts` pour les éléments connus, sous-type de `keyof HTMLElementEventMap` (I89). Contraint `events` dans `ui<TEl>()(events)` | ✅ | [view.md](../4-couche-concrete/view.md) |
| `TUIEntryHandlers<TKey, TEntry>` / `TUICallbacks<U>` | Génèrent les signatures `on{Key}{Event}` requises par `implements` à partir de `TUIContract`. Symétrie Contract/Callbacks (I88, I48 UI) | ✅ | [view.md](../4-couche-concrete/view.md) |

### Composition View

| Type | Definition | État | Source |
| --- | --- | --- | --- |
| `TViewContract<F, U>` | Composition `{ features: F; ui: U }` (ADR-14). Un seul générique sur la classe : `View<TVC>` | ✅ livré (2 champs) — un 3ᵉ champ `local` est une extension cible strate 2a (view.md §7.2) | [view.md](../4-couche-concrete/view.md) |
| `TViewCallbacks<TVC>` | Clause `implements` unique : `TChannelCallbacks<F> & TUICallbacks<U>` (I88). Couple imposé : `extends View<TVC>` + `implements TViewCallbacks<TVC>` | ✅ | [view.md](../4-couche-concrete/view.md) |
| `TViewClass` | `abstract new (...args: any[]) => View<any>` — surface structurelle d'une classe View concrète, indépendante de son contrat. Utilisée par le Composer (variance) | ✅ | [view.md](../4-couche-concrete/view.md) |

## Types Projection DOM Reactive

| Type | Definition | État | Source |
| --- | --- | --- | --- |
| `TProjectionRead` | Type de lecture seule sur un @ui DOM : `value()`, `checked()`, `getAttr()`, `getText()`, `hasClass()`. Retourne par `getUI(key)` pour les @ui couverts par un template (N2/N3, ADR-16) | ⏳ cible strate 1c — n'existe pas ; `getUI()` retourne toujours `TProjectionNode` | [view.md](../4-couche-concrete/view.md) |
| `TProjectionNode<TEl>` | Type de lecture + mutation N1 sur un @ui DOM. Primitives livrées : `text(value: string)`, `attr(name, value: string)`, `toggleClass()`, `visible(show: boolean)`, `style()`, `element(): TEl` — **toutes retournent `void`** (pas de chaînage `this`), aucune n'accepte `null`. N'expose pas de `.node` (I39) | ✅ livré, mais **n'étend pas** `TProjectionRead` (n'existe pas) et n'est pas chaînable (contrairement à des versions antérieures de cet index) | [view.md](../4-couche-concrete/view.md) |
| `TProjectionList` | Gestionnaire de reconciliation par clé pour listes dynamiques. Algorithme O(n) : `reconcile({ items, key, create, update, remove })`. Utilise en interne par les templates N2 (Mode C, ADR-22) | ⏳ cible strate 1c | [5-rendu.md](../5-rendu.md) |
| `TViewTemplateBinding<TData>` | Contrat d'une entree de `get templates()` : `{ template: TProjectionTemplate<any, TData>; select?: (data) => TData \| undefined }`. `select` active l'auto-reactivite | ⏳ cible strate 1c | [view.md](../4-couche-concrete/view.md) |
| `TViewTemplates<TUI>` | Union des trois modes de rendu : `null` (Mode A), `{ root: TViewTemplateBinding }` (Mode B), `{ [K in keyof TUI]?: TViewTemplateBinding }` (Mode C). Modes mutuellement exclusifs (ADR-22) | ⏳ cible strate 1c | [view.md](../4-couche-concrete/view.md) |
| `TProjectionTemplate` | Type d'un template compile — objet `{ setup, project, create }` généré par le compilateur PugJS -> PDR | ⏳ cible strate 1c — seul un prototype existe (`tools/pug-to-ts-template`) | [5-rendu.md](../5-rendu.md) |
| `TViewNodes<TUI>` | Objet peuple automatiquement par le framework dans `onAttach()`. Chaque clé correspond a une clé de `get templates()` | ⏳ cible strate 1c | [view.md](../4-couche-concrete/view.md) |

## Types Behavior (ADR-14 — pattern modulaire)

> Le pattern actuel est identique à celui de View (I83) : `TFeatureContract` + `TUIContract` + `TUIElements`.
> La classe Behavior (Strate 2) est paramétrée par un seul générique de type `TBehaviorContract` analogue à `TViewContract`. Elle réutilise `TChannelCallbacks` + `TUICallbacks` pour son `implements`.

## Types Composer

| Type | Definition | État | Source |
| --- | --- | --- | --- |
| `TResolveResult` | Retour de `Composer.resolve(event)` : `{ view: TViewClass; rootElement: string; options? }`. `rootElement` est toujours un sélecteur (ADR-19) ; `options` (surcharges de la View, ADR-21) ⏳ strate 2. `null` vide le slot | ✅ sans `options` | [composer.md](../4-couche-concrete/composer.md) |
| `TComposerEvent<TCC>` | Union discriminée par `key` (`"ns:event"`) des Events reçus par `resolve()`, dérivée des `listens` du contrat (`TFlatListens`, `TEventPayloadFor`) | ⏳ strate 1d | [composer.md](../4-couche-concrete/composer.md) |
| `TComposerContract<F>` | Contrat d'un Composer : `{ features: F }`, sans module UI (I35) | ⏳ strate 1d | [composer.md](../4-couche-concrete/composer.md) |
| `TComposerOptions` | Options du constructeur `Composer` réel : `{ rootElement: string }` | ✅ | [composer.md](../4-couche-concrete/composer.md) |

## Types localState

> ⏳ **Strate 2a, non livré** (view.md §7). Le state local est porté par le
> troisième champ `local` de `TViewContract` : `View` garde un seul générique.

| Type | Definition | État | Source |
| --- | --- | --- | --- |
| `TLocalUpdate<T>` | Payload des callbacks N1 localState : `{ actual: T; previous: T }`. Signature objet nomme (ADR-17) | ⏳ cible strate 2a | [view.md](../4-couche-concrete/view.md) |
| `TLocalKeyHandlerName<TKey>` | Template literal type : `'isOpen'` -> `'onLocalIsOpenUpdated'`. Génère les noms de callbacks N1 localState per-key (ADR-17) | ⏳ cible strate 2a | [view.md](../4-couche-concrete/view.md) |
| `TLocalKeyHandlers<TLocal>` | Mapped type **optionnel** : pour chaque clé K du localState, génère `onLocal${Capitalize<K>}Updated(update: TLocalUpdate<TLocal[K]>)`. Auto-découvert par le framework (ADR-09, ADR-17) | ⏳ cible strate 2a | [view.md](../4-couche-concrete/view.md) |

## Types handlers Entity

| Type | Definition | État | Source |
| --- | --- | --- | --- |
| `on<Key>EntityUpdated` | Handler Entity per-key optionnel sur Feature — appele quand la propriété `<Key>` de TStructure change. Reçoit `(prev: T, next: T, patches: Patch[])`. Inspire de Marionette `change:key` | ✅ livré (I96) | [entity.md](../3-couche-abstraite/entity.md) |
| `onAnyEntityUpdated` | Handler Entity catch-all optionnel sur Feature — appele pour tout changement de state. Reçoit `TEntityEvent`. Inspire de Marionette `change` | ✅ livré (I96) | [entity.md](../3-couche-abstraite/entity.md) |
| `populateFromServer(state)` | Méthode **interne framework** sur Entity. Pre-peuple silencieusement le state (aucun Event, aucune notification). Appele en phase 3 si `serverState` fourni (ADR-24 H5) | ⏳ cible — n'existe pas sur `Entity` (`packages/entity/src/bonsai-entity.ts`) | [entity.md](../3-couche-abstraite/entity.md) |

## Autres types framework

| Type / valeur | Definition | État | Source |
| --- | --- | --- | --- |
| `Application` | Classe orchestrant le bootstrap — `new Application({ foundation, features })` | ✅ | [application.md](../3-couche-abstraite/application.md) |
| `Foundation` | Classe abstraite, point d'ancrage unique sur `<body>` | ✅ | [foundation.md](../4-couche-concrete/foundation.md) |
| `Radio` | Singleton interne de câblage des Channels — exporté par `@bonsai/event`, **non** par `@bonsai/core` (I15, I80) | ✅ | [communication.md](../2-architecture/communication.md) |
| `BonsaiError` et sa hiérarchie (`MutationError`, `EntityReentrancyError`, `CommandError`, `RequestError`, `BroadcastError`, `ListenerError`, `NoHandlerError`, `DuplicateHandlerError`, `RenderError`, `BehaviorError`) | Classe de base concrète (pas abstraite) : `(message, invariantId, component?, suggestion?)`. 10 sous-classes — certaines jamais levées (`CommandError`, `RequestError`, `RenderError`, `BehaviorError`), cf. [feature.md §8.4](../3-couche-abstraite/feature.md#84-modèle-derreurs--hiérarchie-bonsaierror) pour le détail | ✅ (type) — usage réel variable par sous-classe | `@bonsai/error` |
| `invariant` / `hardInvariant` / `warning` | Fonctions de validation runtime — `(condition, message, invariantId?, component?)` pour les deux premières, `(condition, message)` pour `warning` | ✅ | `@bonsai/error` |
| `BonsaiNamespaceError` / `TBonsaiNamespaceErrorCode` | Erreur de bootstrap à code stable (`NAMESPACE_INVALID_FORMAT`, `NAMESPACE_RESERVED`, `NAMESPACE_UNKNOWN_REFERENCE`, `FEATURE_MISSING_CHANNEL`, `FEATURE_CHANNEL_NAMESPACE_MISMATCH` ; `NAMESPACE_DUPLICATE` déclaré mais jamais levé). Étend `Error`, **pas** `BonsaiError` | ✅ | [reference/invariants.md](invariants.md) |
| `isCamelCaseNamespace` / `isReservedNamespace` / `assertValidNamespace` | Filets runtime de validation de namespace | ✅ | `@bonsai/feature` |
| `CamelCase<S>` / `UnionToIntersection<U>` | Utilitaires type-level exportés par `@bonsai/types`, sans préfixe `T` (plomberie interne, cf. conventions-typage.md §2) | ✅ | `@bonsai/types` |
| `HasNoDuplicates<T>` / `ExtractEl<TEntry>` | Utilitaires type-level exportés par `@bonsai/view`, sans préfixe `T` | ✅ | `@bonsai/view` |
| `StrictManifest<M>` / `ValidatedManifest<M>` / `CamelCaseNamespace<S>` / `ReservedNamespace` | Types du manifest applicatif (ADR-08) | ✅ | `@bonsai/feature` |
| `TFeatureClass<TEntity, TDef, TNS>` / `TFeaturesManifest` | Constructeur générique d'une Feature ; forme lâche du manifest acceptée par `Application` (le contrôle strict est `StrictManifest`) | ✅ | `@bonsai/feature`, `@bonsai/application` |
| `TEntityState<E>` / `TEntityUpdateListener<S>` | Structure d'état d'une classe Entity ; signature d'un listener catch-all | ✅ | `@bonsai/entity` |
| `TUIPointerEvents`, `TUIFocusEvents`, `TUIKeyboardEvents`, `TUIClipboardEvents`, `TUIDragEvents`, `TUIAnimationEvents`, `TUIBaseEvents`, `TUIFormValueEvents`, `TUIFormContainerEvents`, `TUIScrollEvents`, `TUIMediaEvents`, `TUIToggleEvents` | Catégories d'événements DOM composant `TEventsFor<TEl>` (ADR-15) | ✅ | `@bonsai/view` |

---

## Lecture suivante

→ [Invariants](invariants.md) — les I1-I58 regles non-negociables
