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
| `Channel<TDef>` | Classe runtime **interne** au framework — registres de handlers, dispatch, garde-fous. Creee au `register()`, jamais exposee (D15) | [communication.md](../2-architecture/communication.md) |
| TS `namespace` | Construct TypeScript regroupant Channel, State et token sous un nom unique (D14) | [feature.md](../3-couche-abstraite/feature.md) |

## Types View et UI

| Type | Definition | Source |
|------|------------|--------|
| `TUIMap<T>` | Contrat de type UI : table de tous les elements DOM avec type d'element HTML (`el`) et evenements autorises (`event`). La cle `root` est **interdite**. Le selecteur CSS n'est pas dans TUIMap (D35) | [view.md](../4-couche-concrete/view.md) |
| `TUIElements<TUI>` | Table de correspondance nom logique -> selecteur CSS (string libre). Vit dans `params.uiElements`, overridable par le Composer (D34) | [view.md](../4-couche-concrete/view.md) |
| `TUIEventFor<TUI, K, E>` | Helper type — resout le type d'evenement DOM + `currentTarget` type par l'element HTML declare dans TUIMap (D35) | [view.md](../4-couche-concrete/view.md) |
| `TViewParams<TUI, TOptions>` | Contrainte de validation pour l'objet params View (ADR-0024). `{ listen, trigger, request, uiElements, behaviors, options }`. `rootElement` n'est **PAS** dans TViewParams (ADR-0026 : fourni par le Composer). Utilisé avec `as const satisfies` pour valider la forme sans élargir les types | [view.md](../4-couche-concrete/view.md) |
| `TViewCapabilities<TUI, TParams>` | Type dérivé complet d'une View (ADR-0024 value-first). Fusionne les types narrow de la valeur (`typeof params`) et le type purement type-level (`TUI`). Generic de la classe `View<TCapabilities>` | [view.md](../4-couche-concrete/view.md) |
| `TAutoUIEventHandlers<TUI>` | D48 — Mapped type qui genere automatiquement les signatures de handlers UI depuis TUIMap. Chaque combinaison (cle x event) produit un handler optionnel `on${Capitalize<Key>}${Capitalize<Event>}`. Remplace l'ancien `TUIEvents` | [view.md](../4-couche-concrete/view.md) |
| `TViewTriggerCapability<TChannels>` | Contraint les appels `trigger()` d'une View aux Commands des Channels declares en `trigger` | [view.md](../4-couche-concrete/view.md) |
| `TViewRequestCapability<TChannels>` | Contraint les appels `request()` d'une View aux Requests des Channels declares en `request` | [view.md](../4-couche-concrete/view.md) |
| `TViewEventHandlers<TChannels>` | Alias de `TEventHandlers<TChannels>` — handlers Event optionnels pour les Views | [view.md](../4-couche-concrete/view.md) |

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

## Types Behavior

| Type | Definition | Source |
|------|------------|--------|
| `TBehaviorParams<TUI>` | Type de base des params de tout Behavior : `{ uiElements: TUIElements<TUI> }`. Pas de `rootElement`. Extensible avec des params custom primitifs (D36) | [behavior.md](../4-couche-concrete/behavior.md) |
| `TBehaviorTemplates<TUI>` | Templates du Behavior — `null` ou `{ [K in keyof TUI]?: TViewTemplateBinding }`. Mode C uniquement (ilots sur ses propres cles ui). Mode B (template root) interdit (D36) | [behavior.md](../4-couche-concrete/behavior.md) |

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
