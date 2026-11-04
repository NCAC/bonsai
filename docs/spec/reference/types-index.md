# Index des types

> 🟢 **Aligné sur le code livré (4 novembre 2026).** En cas d'écart, la [théorie](../../theorie.md) prévaut ([règle de confiance](../../README.md#règle-de-confiance-et-dalignement)).

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
| `TChannelDefinition` | Contrat à trois voies : `commands`, `events`, `queries` d'un Channel | ✅ | [communication.md](../2-architecture/communication.md) |
| `TCausalContext` | Contexte causal de chaque message, établi et gelé par le noyau (G8, ADR-04) : `id`, `parentId`, `originId`, `originKind`, `depth`. Lu par `ctx.cause` ; porté par `TEntityEvent.context` et le `context` des erreurs du noyau | ✅ | [metas.md](../2-architecture/metas.md) |
| `TApplicationConfig` | Configuration globale de l'application | ⏳ cible — point d'entrée non tranché (application.md §5) | [application.md](../3-couche-abstraite/application.md) |
| `TMutationParams` | Paramètres de `ctx.mutate()` : `{ payload?: unknown }` (le contexte causal est posé par le noyau, ADR-04) | ✅ | [entity.md](../3-couche-abstraite/entity.md) |
| `RESERVED_NAMESPACES` | Constante `["local", "router"] as const` | ✅ | [reference/invariants.md](invariants.md) |

## Types bootstrap

| Type | Definition | État | Source |
| --- | --- | --- | --- |
| `TBootstrapOptions` | Options optionnelles de `start()` : `{ serverState?: Record<string, TJsonSerializable> }`. Si `serverState` fourni, le framework pre-peuple les Entities silencieusement en phase 3 (ADR-24 H5) | ⏳ cible — `start()` livré n'accepte aucune option | [application.md](../3-couche-abstraite/application.md) |
| Phase 0a / 0b / 0c | Phases sans effet de bord (ADR-07, ADR-09) : 0a = format du namespace et `channel` (I70, I71, I73) ; 0b = instanciation pure (`new FeatureClass(ns)`, constructeur inerte, I94) ; 0c = `listens`/`queries`/`dependsOn` et validation croisée (I70). Précèdent le démarrage de la racine | ✅ | [application.md](../3-couche-abstraite/application.md) |
| `TApplicationOptions` | Options du constructeur `Application` : `features`, `foundation`, `document`, `anchor`, `router`, `adapters`, `adapterOptions`, `causalBound` (50 par défaut), `onTrace` | ✅ | [application.md](../3-couche-abstraite/application.md) |

## Types Entity

| Type | Definition | État | Source |
| --- | --- | --- | --- |
| `TEntityEvent` | Retourné par `ctx.mutate()` après une mutation non no-op (`null` sinon). Contient `intent`, `payload?`, `context` (contexte causal, ADR-04), `changedKeys`, `patches`, `inversePatches`, `previousState`, `nextState`, `timestamp` — tous `readonly`. Consommé par le handler catch-all `onAnyEntityUpdated` | ✅ | [entity.md](../3-couche-abstraite/entity.md) |

## Types Channel et handlers

| Type | Definition | État | Source |
| --- | --- | --- | --- |
| `TChannelToken<TDef, NS>` | Token `{ namespace: NS; events?: string[] }` typé par `TDef`, porté par `static readonly channel` (ADR-14). `events` déclare au noyau les Events que la Feature peut émettre (D16) | ✅ | [feature.md](../3-couche-abstraite/feature.md), [communication.md](../2-architecture/communication.md) |
| `TTokenDef<T>` / `TAnyEventPayload` | Extraction du `TChannelDefinition` d'un token ; payload d'Event quelconque (`packages/kernel/src/channel-types.ts`) | ✅ | [communication.md](../2-architecture/communication.md) |
| `TCommandCallbacks<TDef>` / `TQueryCallbacks<TDef>` / `TListenCallbacks<TListens>` | Composants de `TFeatureCallbacks` (ADR-09) : handlers `on{Cmd}Command`, `on{Name}Query`, `on{Ns}{Event}Event` | ✅ | [feature.md](../3-couche-abstraite/feature.md) |
| `TFeatureCallbacks<TDef, TListens, TEntity>` | Clause `implements` d'une Feature (ADR-09, I92). Handler manquant → `TS2420` ; signature fautive → `TS2416` | ✅ | [feature.md](../3-couche-abstraite/feature.md) |
| `TStrictFeatureClass<NS, TDef>` | Contrainte de `StrictManifest<M>` sur chaque entrée du manifest (ADR-09, I95) : constructeur `(namespace: NS) => Feature<…, TDef, NS>` + `static channel` aligné | ✅ | [feature.md](../3-couche-abstraite/feature.md) |
| `TChannelHandlerName<NS, E>` | Nom de handler `on{Ns}{Event}Event` dérivé d'un namespace et d'un Event | ✅ | [feature.md](../3-couche-abstraite/feature.md) |

## Contextes de handler

| Type | Definition | État | Source |
| --- | --- | --- | --- |
| `TFeatureContext<TDef, TEntity>` | Contexte d'un handler de Command, d'Event, de notification et d'`onInit` : `mutate`, `emit`, `query`. Pas de `trigger` (D17) | ✅ | [feature.md](../3-couche-abstraite/feature.md) |
| `TFeatureQueryContext` | Contexte d'un handler de Query, en lecture seule : `query` (A3.g) | ✅ | [feature.md](../3-couche-abstraite/feature.md) |
| `TFact` | Fait du DOM admis dans la part d'une View : `{ type, ui }` | ✅ | [view.md](../4-couche-concrete/view.md) |
| `TFactContext<TVC>` | Contexte du handler d'un fait : `trigger`, `query` (D18) | ✅ | [view.md](../4-couche-concrete/view.md) |
| `TEventContext<TVC>` / `TQueryContext<TVC>` | Contexte du handler d'un Event de View : `query` seulement | ✅ | [view.md](../4-couche-concrete/view.md) |
| `TComposeContext<TCC>` | Contexte de `resolve(ctx)` : `query` (D12) | ✅ | [composer.md](../4-couche-concrete/composer.md) |

## Types View et UI (ADR-14 — pattern modulaire)

> Le pattern décompose le contrat en **trois modules** indépendants composés par `TViewContract<F, U>`.

### Module Features — TFeatureContract

| Type | Definition | État | Source |
| --- | --- | --- | --- |
| `TFeatureContract` | Map `{ namespace → { feature, listens, triggers, queries } }` (ADR-14). La clé d'objet ≡ le namespace (I87) ; `feature` est `TFeatureRefForNS<NS>` ; les trois lanes sont des `readonly string[]` | ✅ | [feature.md](../3-couche-abstraite/feature.md), [view.md](../4-couche-concrete/view.md) |
| `TFeatureRef<TDef, NS>` | Référence Feature : tout objet exposant `channel: TChannelToken<TDef, NS>` (ADR-14) | ✅ | [feature.md](../3-couche-abstraite/feature.md) |
| `TFeatureRefForNS<NS>` | Référence Feature dont le namespace est imposé par la clé du contrat (I87 — vérifié compile-time) | ✅ | [feature.md](../3-couche-abstraite/feature.md) |
| `TFlatListens<F>` / `TFlatTriggers<F>` / `TFlatQueries<F>` | Aplatissent `TFeatureContract` en **union** de clés `"ns:event"` / `"ns:cmd"` / `"ns:query"`. Alimentent `ctx.trigger`, `ctx.query` et la génération des handlers | ✅ | [feature.md](../3-couche-abstraite/feature.md) |
| `TCommandPayloadFor<F, K>` / `TEventPayloadFor<F, K>` / `TQueryParamsFor<F, K>` / `TQueryResultFor<F, K>` | Extracteurs de payload typé pour une clé `"ns:name"` du contrat | ✅ | [feature.md](../3-couche-abstraite/feature.md) |
| `TChannelCallbacks<F>` | Mapped type : signature des handlers `on{NS}{Event}Event` requise par `implements`. Symétrie avec `F.{ns}.listens` (I48 channel) | ✅ | [feature.md](../3-couche-abstraite/feature.md) |

### Module UI — TUIContract et TUIElements

| Type | Definition | État | Source |
| --- | --- | ---- | --- |
| `TUIEntry<TEl, TEvts>` | Entrée UI typée : `{ events: TEvts; cancelDefault?: TEvts[number][]; _el?: TEl }` (`cancelDefault` : D20). Phantom `_el?` encode `TEl` sans allocation runtime (I85). `events: []` = non-interactif explicite (I86) | ✅ | [view.md](../4-couche-concrete/view.md) |
| `ui<TEl>()(events, options?)` | Helper curryfié — unique mécanisme de construction d'une `TUIEntry` (I85). La forme curryfiée préserve l'inférence littérale de `events` quand `TEl` est explicité | ✅ | [view.md](../4-couche-concrete/view.md) |
| `TUIContract` | `Readonly<Record<string, TUIEntry>>` — module contractuel UI composé par `TViewContract.ui` | ✅ | [view.md](../4-couche-concrete/view.md) |
| `TUIElements<TUI>` | Mapped type sur `TUI` : table sélecteurs CSS clé → string, résolus dans la part de la View. Toute clé orpheline ou manquante → erreur compile | ✅ | [view.md](../4-couche-concrete/view.md) |
| `ExtractEl<TEntry>` | Extrait `TEl` d'une `TUIEntry` via le phantom — utilisé par `getUI(key)` pour préserver le sous-type DOM | ✅ | [view.md](../4-couche-concrete/view.md) |
| `TDOMEventFor<S>` | Mappe un nom d'event DOM (`"click"`) vers son type natif (`MouseEvent`) via `HTMLElementEventMap` | ✅ | [view.md](../4-couche-concrete/view.md) |
| `TEventsFor<TEl>` | Mapping sémantique sous-type `HTMLElement` → events DOM autorisés (ADR-15) — plus strict que `lib.dom.d.ts` pour les éléments connus, sous-type de `keyof HTMLElementEventMap` (I89). Contraint `events` dans `ui<TEl>()(events)` | ✅ | [view.md](../4-couche-concrete/view.md) |
| `TUIEntryHandlers<TKey, TEntry>` / `TUICallbacks<U, TVC>` | Génèrent les signatures `on{Key}{Event}(fact, ctx)` requises par `implements` à partir de `TUIContract`. Symétrie Contract/Callbacks (I88, I48 UI) | ✅ | [view.md](../4-couche-concrete/view.md) |

### Composition View

| Type | Definition | État | Source |
| --- | --- | --- | --- |
| `TViewContract<F, U>` | Composition `{ features: F; ui: U }` (ADR-14). Un seul générique sur la classe : `View<TVC>` | ✅ livré (2 champs) — un 3ᵉ champ `local` est une extension cible strate 2a (view.md §7.2) | [view.md](../4-couche-concrete/view.md) |
| `TViewCallbacks<TVC>` | Clause `implements` unique : `TEventCallbacks<TVC> & TUICallbacks<TVC["ui"], TVC>` (I88). Couple imposé : `extends View<TVC>` + `implements TViewCallbacks<TVC>` | ✅ | [view.md](../4-couche-concrete/view.md) |
| `TViewClass` | `abstract new (...args: any[]) => View<any>` — surface structurelle d'une classe View concrète, indépendante de son contrat. Utilisée par le catalogue du Composer | ✅ | [view.md](../4-couche-concrete/view.md) |
| `TViewSlotDeclaration` | Entrée de `get composers()` d'une View ou d'une Foundation : `{ slot: string; composer: TComposerClass }` | ✅ | [view.md](../4-couche-concrete/view.md) |

## Types Projection DOM Reactive

| Type | Definition | État | Source |
| --- | --- | --- | --- |
| `TProjectionRead` | Type de lecture seule sur un @ui DOM : `value()`, `checked()`, `getAttr()`, `getText()`, `hasClass()`. Retourne par `getUI(key)` pour les @ui couverts par un template (N2/N3, ADR-16) | ⏳ cible strate 1c — n'existe pas ; `getUI()` retourne toujours `TProjectionNode` | [view.md](../4-couche-concrete/view.md) |
| `TProjectionNode<TEl>` | Projection N1 sur une clé d'interface : `text(value)`, `attr(name, value)`, `toggleClass(name, force)`, `visible(show)`, `style(prop, value)`. Chaque appel prépare un effet engagé après validation (C.3) ; tous retournent `void`. Ni `element()` ni `.node` (I39) | ✅ | [view.md](../4-couche-concrete/view.md) |
| `TProjectionList` | Gestionnaire de reconciliation par clé pour listes dynamiques. Algorithme O(n) : `reconcile({ items, key, create, update, remove })`. Utilise en interne par les templates N2 (Mode C, ADR-22) | ⏳ cible strate 1c | [5-rendu.md](../5-rendu.md) |
| `TViewTemplateBinding<TData>` | Contrat d'une entree de `get templates()` : `{ template: TProjectionTemplate<any, TData>; select?: (data) => TData \| undefined }`. `select` active l'auto-reactivite | ⏳ cible strate 1c | [view.md](../4-couche-concrete/view.md) |
| `TViewTemplates<TUI>` | Union des trois modes de rendu : `null` (Mode A), `{ root: TViewTemplateBinding }` (Mode B), `{ [K in keyof TUI]?: TViewTemplateBinding }` (Mode C). Modes mutuellement exclusifs (ADR-22) | ⏳ cible strate 1c | [view.md](../4-couche-concrete/view.md) |
| `TProjectionTemplate` | Type d'un template compile — objet `{ setup, project, create }` généré par le compilateur PugJS -> PDR | ⏳ cible strate 1c — seul un prototype existe (`tools/pug-to-ts-template`) | [5-rendu.md](../5-rendu.md) |
| `TViewNodes<TUI>` | Références de projection des clés de `get templates()` | ⏳ cible strate 1c, proposition non fixée | [view.md](../4-couche-concrete/view.md) |

## Types Behavior (ADR-14 — pattern modulaire)

> Le pattern actuel est identique à celui de View (I83) : `TFeatureContract` + `TUIContract` + `TUIElements`.
> La classe Behavior (Strate 2) est paramétrée par un seul générique de type `TBehaviorContract` analogue à `TViewContract`. Elle réutilise `TChannelCallbacks` + `TUICallbacks` pour son `implements`.

## Types Composer

| Type | Definition | État | Source |
| --- | --- | --- | --- |
| `TComposerContract<F, V>` | Contrat d'un Composer : `{ features: F; views: V }`, sans module UI (I35) ; `V` est le catalogue des Views (`Record<string, TViewClass>`) | ✅ | [composer.md](../4-couche-concrete/composer.md) |
| `TComposition<TCC>` | Retour de `resolve(ctx)` : `{ view: keyof V; key: string; params? }[]`, ordonné. Une View hors catalogue ou une entrée sans clé ne compile pas (I37) | ✅ | [composer.md](../4-couche-concrete/composer.md) |
| `TComposerClass` | Surface structurelle d'une classe Composer, pour `TViewSlotDeclaration` | ✅ | [composer.md](../4-couche-concrete/composer.md) |

## Types localState

> ⏳ **Strate 2a, non livré** ([ADR-17](../../adr/ADR-17-local-state.md)). La forme
> (troisième champ `local` de `TViewContract` ou second générique de `View`) est
> à fixer à la livraison.

| Type | Definition | État | Source |
| --- | --- | --- | --- |
| `TLocalUpdate<T>` | Payload des callbacks N1 localState : `{ actual: T; previous: T }`. Signature objet nomme (ADR-17) | ⏳ cible strate 2a | [view.md](../4-couche-concrete/view.md) |
| `TLocalKeyHandlerName<TKey>` | Template literal type : `'isOpen'` -> `'onLocalIsOpenUpdated'`. Génère les noms de callbacks N1 localState per-key (ADR-17) | ⏳ cible strate 2a | [view.md](../4-couche-concrete/view.md) |
| `TLocalKeyHandlers<TLocal>` | Mapped type **optionnel** : pour chaque clé K du localState, génère `onLocal${Capitalize<K>}Updated(update: TLocalUpdate<TLocal[K]>)`. Auto-découvert par le framework (ADR-09, ADR-17) | ⏳ cible strate 2a | [view.md](../4-couche-concrete/view.md) |

## Types handlers Entity

| Type | Definition | État | Source |
| --- | --- | --- | --- |
| `on<Key>EntityUpdated` | Handler Entity par clé, optionnel, sur la Feature : notification différée quand la propriété `<Key>` change. Reçoit `(prev, next, patches, ctx)` | ✅ (I96) | [entity.md](../3-couche-abstraite/entity.md) |
| `onAnyEntityUpdated` | Handler Entity catch-all, optionnel, sur la Feature : notification différée après les handlers par clé. Reçoit `(event: TEntityEvent, ctx)` | ✅ (I96) | [entity.md](../3-couche-abstraite/entity.md) |
| `populateFromServer(state)` | Méthode **interne framework** sur Entity. Pre-peuple silencieusement le state (aucun Event, aucune notification). Appele en phase 3 si `serverState` fourni (ADR-24 H5) | ⏳ cible — n'existe pas sur `Entity` (`packages/entity/src/bonsai-entity.ts`) | [entity.md](../3-couche-abstraite/entity.md) |

## Autres types framework

| Type / valeur | Definition | État | Source |
| --- | --- | --- | --- |
| `Application` | Racine du modèle — `new Application({ foundation, features, document }).start()` ; `app.root.trace` pour la trace | ✅ | [application.md](../3-couche-abstraite/application.md) |
| `Foundation` | Classe abstraite : admet son ancre (`<body>` par défaut, option `anchor`) et y déclare ses slots (`get composers()`) | ✅ | [foundation.md](../4-couche-concrete/foundation.md) |
| `Root` | Racine du noyau d'exécution, une par Application (`@bonsai/kernel`) : registre, unités, file différée, Queries, parts, effets, trace. Jamais exporté par `@bonsai/core` (I15) | ✅ |
| `TransportError` / `StartupError` / `InvariantError` / `ManifestError` | Erreurs du noyau : refus à code stable (`TTransportErrorCode`), échec du démarrage, invariant d'Entity violé, Manifest invalide (ADR-05). Exportées par `@bonsai/kernel`, pas par `@bonsai/core` | ✅ | [erreurs.md](../2-architecture/erreurs.md) |
| `TTraceEntry` | Entrée de la trace de la racine : `delivered`, `unit-failed`, `delivery-abandoned`, `admission-abandoned`, `effects` (option `onTrace`) | ✅ | [erreurs.md](../2-architecture/erreurs.md) | [communication.md](../2-architecture/communication.md) |
| `BonsaiError` et sa hiérarchie (`MutationError`, `EntityReentrancyError`, `CommandError`, `RequestError`, `BroadcastError`, `ListenerError`, `NoHandlerError`, `DuplicateHandlerError`, `RenderError`, `BehaviorError`) | Classe de base concrète (pas abstraite) : `(message, invariantId, component?, suggestion?)`. 10 sous-classes — certaines jamais levées (`CommandError`, `RequestError`, `RenderError`, `BehaviorError`), cf. [ADR-05](../../adr/ADR-05-propagation-erreurs.md) : seule `hardInvariant` lève une `BonsaiError` | ✅ (type) — sous-classes déclarées, non levées | `@bonsai/error` |
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

→ [Invariants](invariants.md) — les règles non négociables (I1–I103)
