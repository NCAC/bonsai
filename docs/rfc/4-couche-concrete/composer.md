# Composer -- Décideur de composition

> **resolve(event) determine quelle(s) View(s) instancier, 0/N Views heterogenes, scope DOM fixe**

[<- Retour couche concrete](README.md) | [<- Foundation](foundation.md) | [-> View](view.md)

---

| Champ          | Valeur                                                                                                                                                                                                                              |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Composant**  | Composer                                                                                                                                                                                                                            |
| **Couche**     | Concrete (ephemere)                                                                                                                                                                                                                 |
| **Source**     | Historique : RFC-0002-api-contrats-typage §12                                                                                                                                                                                       |
| **Statut**     | Stable                                                                                                                                                                                                                              |
| **ADRs liées** | ADR-0020 (N-instances, scope immutable), ADR-0024 (pattern manifeste value-first), ADR-0025 (pas de hooks lifecycle), ADR-0026 (rootElement string-only CSS), ADR-0027 (resolve(event) argument unique), ADR-0028 (phasage strates) |

---

> ### ⏳ Périmètre d'implémentation (ADR-0028)
>
> Ce document décrit le **contrat cible complet** du Composer. Pour s'aligner
> sur la stratégie de phasage kernel-first, certaines capacités sont **différées
> en strate 1 ou 2** et ne sont **pas implémentées en strate 0** :
>
> | Élément                                                            | Strate cible | Sections concernées     |
> | ------------------------------------------------------------------ | ------------ | ----------------------- |
> | `get params()` avec `listen` / `request` (ADR-0024)                | Strate 1     | §1.1, §1.2, §2.2, §2.3  |
> | Type `TComposerEvent<TListen>` (union discriminée typée)           | Strate 1     | §1.1, §1.2, §3          |
> | Generic de classe `Composer<TCapabilities>`                        | Strate 1     | §1.2                    |
> | `protected request()` (request/reply synchrone)                    | Strate 1     | §1.2, §2.2, §2.3        |
> | Auto-discovery handlers Channel                                    | Strate 1     | §3                      |
> | Retour `TResolveResult[]` (N-instances hétérogènes, ADR-0020 §6.3) | Strate 2     | §3.2                    |
> | Champ `options` dans `TResolveResult` (D34 merge)                  | Strate 2     | §1.1, §4.1 (étapes 3-4) |
> | Composers enfants, `get templates()`, `view.onDetach()`, désinscription Channel/DOM au détachement, cascade de destruction par scan de projection | Strate 1/2 | §4.1 (étapes 5-12), §4.2, §5 |
> | Machine à états `idle/resolving/active(Views)/detaching/[destroyed]` | Strate 1 | §6 |
>
> **Strate 0 — périmètre effectif** : `Composer` non-générique, `resolve(event: unknown \| null) → TResolveResult \| null`, slot DOM immutable (ADR-0026), création D30, diff §3.1 des 5 transitions Same/New/null. Pas de `params()`, pas de `listen`, pas de `request()`, pas de retour tableau. Surface publique réelle non documentée dans le §1.1 (qui décrit la cible, générique) : `constructor(options: TComposerOptions)`, `get rootElement(): string`, `get slot(): HTMLElement | null`, `get currentView(): View | null`, `attach(parentElement: HTMLElement): void` (résout/crée le slot puis fait le premier `resolve(null)`), `abstract resolve(event: unknown | null): TResolveResult | null` — tous **publics**, pas `protected`.
>
> **Séquence réellement livrée (attach/detach)** — ⚠️ diverge de §4.1/§4.2 ci-dessous
> sur deux points précis, décrits ici sans ambiguïté :
> `Composer.attach(parentElement)` résout `parentElement.querySelector(rootElement)` ;
> si absent, **crée** l'élément (D30) et l'ajoute — jamais d'erreur. Puis appelle
> `#performResolve(null)` qui instancie la View via `view.mount(result.rootElement)` —
> **`View.mount()` résout son propre `rootElement` par un `document.querySelector()`
> GLOBAL, indépendant du slot du Composer** (pas « dans le slot » comme l'écrit §4.1
> étape 4a — la View peut se monter n'importe où dans le document). Au détachement,
> `#detachCurrent()` se contente de mettre `#currentView`/`#currentResult` à `null` —
> **aucune désinscription de Channel ni de listener DOM n'est effectuée** ; c'est un
> choix documenté et assumé pour la strate 0 (ADR-0025 : « le Composer n'a pas de
> subscription propre à libérer, il n'a ni state ni cleanup à faire »), pas un
> oubli — mais cela signifie concrètement que les listeners de la View détachée
> restent actifs tant que l'objet `View` n'est pas garbage-collecté. `onDetach()`
> et la désinscription systématique sont des cibles strate 1/2 (cf. tableau ci-dessus).
>
> Voir aussi : [ADR-0028](../../adr/ADR-0028-implementation-phasing-strategy.md) — phasage kernel-first en 3 strates.
>
> **⚠ `get params()` / `TComposerParams` (ADR-0024) est une forme cible
> intermédiaire, supersédée par le pattern modulaire ADR-0042 avant même
> sa livraison strate 1** — [I83](../reference/invariants.md) est explicite :
> « Composer compose seulement `TFeatureContract` (I35 — pas d'UI) ».
> ADR-0042 spécifie déjà `TComposerContract<F> = { features: F }` et
> `TComposerCallbacks<TCC>` (non livrés — Composer reste en périmètre
> strate 0/1 minimal, cf. tableau ci-dessus). Le pattern à adopter au moment
> de l'implémentation strate 1 est donc `const features satisfies
> TFeatureContract` + `class extends Composer<TComposerContract<typeof
> features>>`, **pas** `TComposerParams`/`get params()`. Les exemples des §1–4
> ci-dessous, écrits avant cette clarification, restent en forme ADR-0024 et
> seront réécrits à l'implémentation strate 1 (cf. [ADR-0042 §Actions de
> suivi](../../adr/ADR-0042-view-contract-unified-ui-deps-single-generic.md)).

---

## Table des matieres

1. [Classe abstraite Composer](#1-classe-abstraite-composer)
2. [Exemples de Composers](#2-exemples-de-composers)
3. [Méthode resolve()](#3-methode-resolve)
4. [Cycle de vie et attachement](#4-cycle-de-vie-et-attachement)
5. [Cascade de destruction](#5-cascade-de-destruction)
6. [Cycle de vie -- machine a états](#6-cycle-de-vie----machine-a-etats)

---

## 1. Classe abstraite Composer

Le Composer est un **décideur de composition pur** : il est attache a un scope DOM,
il décide quelle(s) View(s) instancier, et il gère le lifecycle de **0/N Views
heterogenes** dans son scope fixe (ADR-0020, I37 revise).
Il n'a **aucune écriture DOM** -- lecture du scope autorisée (I35 nuance).

**Le Composer n'a ni hooks lifecycle, ni handlers d'Events, ni state local.**
Son unique point d'entree est `resolve(event)` (ADR-0025, ADR-0027).

### 1.1 Types

> ⚠️ **Cible antérieure à ADR-0040/ADR-0042, non mise à jour** : les types
> ci-dessous utilisent `TChannelDefinition["namespace"]` — mais `namespace`
> ne vit **pas** sur `TChannelDefinition` depuis ADR-0040, il vit sur
> `TChannelToken<TDef, NS>` (paramètre de type `NS`, cf.
> [communication.md §5](../2-architecture/communication.md)). De même,
> `TComposerParams.listen`/`request: readonly TChannelDefinition[]` devrait
> être un tuple de `TChannelToken<…>[]`, et `View.params.options` n'existe
> plus (`View` n'a pas de `params`, ADR-0042). Ce bloc décrit une proposition
> antérieure à ces deux ADR, jamais réharmonisée — à retravailler avant
> toute implémentation strate 1, pas à prendre comme référence figée.

```typescript
/**
 * TComposerEvent -- union discriminee des Events recus par un Composer.
 *
 * Derivee automatiquement depuis le tuple `listen` du manifeste.
 * Chaque variante porte le namespace, le nom d'Event et le payload type.
 *
 * Discriminant : `${namespace}:${eventName}` — permet le narrowing
 * dans un switch/case avec inference complete du payload.
 *
 * @template TListen — tuple narrow des TChannelDefinition ecoutes
 *   (ex: readonly [typeof Router.channel, typeof Auth.channel])
 */
type TComposerEvent<TListen extends readonly TChannelDefinition[]> = {
  readonly discriminant: `${TListen[number]["namespace"]}:${string & keyof TListen[number]["events"]}`;
  readonly namespace: TListen[number]["namespace"];
  readonly eventName: string & keyof TListen[number]["events"];
  readonly payload: TListen[number]["events"][keyof TListen[number]["events"]];
};
// Note : la definition complete avec distribution par variante est dans ADR-0027 §3.

/**
 * TComposerParams -- contrainte de validation (ADR-0024 value-first).
 * Utilise avec `satisfies` pour verifier la forme sans elargir les types.
 */
type TComposerParams = {
  readonly listen: readonly TChannelDefinition[];
  readonly request: readonly TChannelDefinition[];
};

/**
 * TComposerCapabilities -- type derive complet (ADR-0024 value-first).
 * Extrait les types narrow (tuples) depuis typeof params.
 */
type TComposerCapabilities<TParams extends TComposerParams> = {
  readonly listen: TParams["listen"];
  readonly request: TParams["request"];
};

/**
 * TResolveResult -- retour de resolve() (ADR-0020 §6.2, ADR-0026).
 *
 * rootElement est TOUJOURS un string — selecteur CSS (ADR-0026).
 * Si l'element n'existe pas dans le slot, le framework parse le selecteur
 * et cree l'element (D30, ADR-0026 §3 syntaxe CSS).
 *
 * options est un Partial du type options de la View cible.
 * Le framework merge : View.params.options (defauts) <- options (surcharges) (D34).
 */
type TResolveResult<V extends typeof View = typeof View> = {
  readonly view: V;
  readonly rootElement: string;
  readonly options?: Partial<ExtractViewOptions<V>>;
};

/**
 * TComposerOptions -- argument du constructeur (framework-internal).
 *
 * Le Composer est instancie par le framework, jamais par le developpeur.
 * Le framework fournit le selecteur du scope DOM via cet objet.
 * Le scope est immutable une fois assigne (ADR-0020).
 *
 * NB : le developpeur n'ecrit pas `new MyComposer({...})` ; il declare la
 * classe dans `Foundation.composers` ou `View.composers` et le framework
 * orchestre l'instanciation.
 */
type TComposerOptions = {
  readonly rootElement: string;
};
```

### 1.2 Classe

```typescript
/**
 * Composer -- decideur de composition attache a un scope DOM.
 *
 * Capacites :
 * - Decide quelle(s) View(s) instancier via resolve(event) (D21, ADR-0027)
 * - Capacites Channel : listen (Events recus), request (request/reply)
 * - Gere 0/N Views heterogenes dans son scope fixe (ADR-0020, I37 revise)
 * - Aucune ecriture DOM -- lecture du scope autorisee (D23, I35 nuance)
 *
 * **Pas de hooks lifecycle** (ADR-0025) : ni onMount(), ni onUnmount(), ni onAttach().
 * **Pas de handlers d'Events** (ADR-0027) : pas de onXxxEvent(). L'Event est recu
 * en argument de resolve().
 * **Pas de state local** (ADR-0027) : pas d'information decisionnelle stockee.
 * resolve(event) est une fonction pure du point de vue du Composer.
 *
 * Le Composer est instancie par le framework, pas par le developpeur.
 * Le framework lui fournit le scope (element DOM) en contexte.
 *
 * Invariant de scope immutable (ADR-0020) :
 * Le scope est assigne une fois et ne migre jamais.
 */
abstract class Composer<
  TCapabilities extends TComposerCapabilities<TComposerParams>
> {
  /**
   * Reference au scope DOM -- fourni par le framework, jamais mute par le Composer.
   * ⚠️ Cible incohérente avec le livré : `Composer.slot` (strate 0) est un
   * **getter public** (`get slot(): HTMLElement | null`), pas `protected readonly`.
   */
  protected readonly slot: HTMLElement;

  /** Le manifeste -- contrat declaratif du Composer concret (ADR-0024) */
  abstract get params(): TCapabilities;

  /**
   * Unique point d'entree -- decide quelle(s) View(s) instancier (ADR-0027).
   *
   * @param event — l'Event declencheur (null au premier montage ou reapparition scope).
   *   Le type est une union discriminee derivee du tuple `listen` du manifeste.
   *   Narrowing dans un switch sur event.discriminant.
   *
   * Retourne (ADR-0020 §6.3) :
   * - TResolveResult     -> Composer classique (1 View)
   * - TResolveResult[]   -> Composer dynamique (N Views heterogenes)
   * - null               -> le framework detache les Views courantes (scope vide)
   */
  abstract resolve(
    event: TComposerEvent<TCapabilities["listen"]> | null
  ): TResolveResult | TResolveResult[] | null;

  /**
   * La View actuellement montee (null si vide) -- pour resolve() classique (0/1).
   * ⚠️ Idem `slot` : livré aujourd'hui comme `get currentView(): View | null`
   * **public**, pas `protected readonly`.
   */
  protected readonly currentView: View<any> | null;

  /**
   * Effectue un request/reply synchrone (ADR-0023).
   * Disponible dans resolve() pour obtenir de l'information du Feature.
   */
  protected request<T>(
    channel: TChannelDefinition,
    requestName: string
  ): T | null;
}
```

> **D21** : le Composer décide, la View parente ne compose jamais.
> **D23, I35 (nuance ADR-0020)** : aucune écriture DOM. Lecture du scope autorisée.
> **I37 (revise ADR-0020)** : 0/N Views heterogenes dans un scope fixe via `resolve()` etendu.
> **ADR-0025** : pas de `onMount()`/`onUnmount()`. Le Composer n'a aucun hook lifecycle.
> **ADR-0026** : `rootElement` est toujours un `string`, jamais un `Element`.
> **ADR-0027** : `resolve(event)` est l'unique méthode abstraite. Pas de `onXxxEvent()`, pas de state local.

---

## 2. Exemples de Composers

### 2.1 Composer statique — aucun Channel

```typescript
// FooterComposer : toujours la meme View, pas de listen, pas de request.
// resolve(event) recoit toujours null (aucun Event ecoute).

const footerComposerParams = {
  listen: [],
  request: []
} as const satisfies TComposerParams;

type TFooterComposerCapabilities = TComposerCapabilities<
  typeof footerComposerParams
>;

class FooterComposer extends Composer<TFooterComposerCapabilities> {
  get params() {
    return footerComposerParams;
  }

  resolve(event: null): TResolveResult {
    // Toujours la meme View — le footer ne change jamais
    return { view: FooterView, rootElement: "footer.Footer" };
  }
}
```

### 2.2 Composer conditionnel — un Channel

```typescript
// SidebarComposer : affiche LoginView ou ProfileView selon l'etat Auth.
// resolve(event) recoit l'Event Auth OU null au premier montage.
// Au premier montage, le Composer fait un request() pour obtenir l'etat initial.

const sidebarComposerParams = {
  listen: [Auth.channel],
  request: [Auth.channel]
} as const satisfies TComposerParams;

type TSidebarComposerCapabilities = TComposerCapabilities<
  typeof sidebarComposerParams
>;

class SidebarComposer extends Composer<TSidebarComposerCapabilities> {
  get params() {
    return sidebarComposerParams;
  }

  resolve(
    event: TComposerEvent<TSidebarComposerCapabilities["listen"]> | null
  ): TResolveResult {
    // Premier montage : request() pour obtenir l'etat initial
    // Appels suivants : l'Event porte directement le payload
    const isAuthenticated =
      event !== null
        ? event.payload.isAuthenticated // ← Event Auth recu
        : this.request<boolean>(Auth.channel, "isAuthenticated"); // ← premier montage

    return {
      view: isAuthenticated ? ProfileView : LoginView,
      rootElement: ".Sidebar-content"
    };
  }
}
```

> **Pas de state local** — `isAuthenticated` n'est pas stocke.
> Chaque appel a `resolve(event)` recalcule la decision a partir de l'Event
> ou du request(). C'est une **fonction pure du point de vue du Composer** (ADR-0027).

### 2.3 Composer multi-Channel — routeur + auth

```typescript
// MainContentComposer : ecoute Router ET Auth.
// resolve(event) recoit l'Event qui a declenche le recalcul.
// Le Composer utilise request() pour obtenir l'etat complet quand necessaire.

const mainComposerParams = {
  listen: [Router.channel, Auth.channel],
  request: [Router.channel, Auth.channel]
} as const satisfies TComposerParams;

type TMainComposerCapabilities = TComposerCapabilities<
  typeof mainComposerParams
>;

class MainContentComposer extends Composer<TMainComposerCapabilities> {
  get params() {
    return mainComposerParams;
  }

  resolve(
    event: TComposerEvent<TMainComposerCapabilities["listen"]> | null
  ): TResolveResult | null {
    // Obtenir l'etat courant (request synchrone, ADR-0023)
    const route = this.request<TCurrentRoute>(Router.channel, "currentRoute");
    const isAuth = this.request<boolean>(Auth.channel, "isAuthenticated");

    // Pages protegees : redirect si non authentifie
    if (!isAuth && route.requiresAuth) {
      return { view: LoginView, rootElement: ".MainContent-root" };
    }

    // Routing standard
    switch (route.page) {
      case "home":
        return { view: HomeView, rootElement: ".MainContent-root" };
      case "product":
        return { view: ProductView, rootElement: ".MainContent-root" };
      case "cart":
        return { view: CartView, rootElement: ".MainContent-root" };
      default:
        return { view: NotFoundView, rootElement: ".MainContent-root" };
    }
  }
}
```

> **Pattern `request()` dans `resolve()`** — le Composer peut interroger n'importe quel
> Channel déclaré dans `request` pour obtenir l'état courant du Feature.
> C'est le pattern recommande pour les decisions multi-dimensionnelles (ADR-0027 §4.3).
> L'argument `event` indique **quel Channel a change**, mais le Composer
> peut toujours requeter l'état complet via `request()`.

> **Pas de `onXxxEvent` handlers** (ADR-0027) — le Composer n'a pas de méthodes
> `onRouterRouteChangedEvent()` ni `onAuthStateChangedEvent()`. L'Event est reçu
> en argument de `resolve()`. Pas de stockage intermediaire, pas de pseudo-state.

---

## 3. Méthode resolve()

`resolve(event)` est l'unique méthode abstraite du Composer (ADR-0027).
Le framework l'appelle avec l'Event declencheur en argument :

| Quand                     | Argument `event`                                                                                                            |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Premier montage**       | `null` — le scope existe pour la première fois (bootstrap ou apparition dynamique)                                          |
| **Après un Event**        | `TComposerEvent` — l'Event écoute (listen) qui a declenche le recalcul. Discriminant, namespace, eventName et payload types |
| **Reapparition du scope** | `null` — le scope avait disparu puis reapparait (ex: projection de la View parente)                                         |

> **ADR-0027** : l'Event est passe **en argument**, pas via un handler `onXxxEvent()`.
> Le Composer n'a pas de state local ou le stocker — il recalcule sa decision a chaque appel.
> Si le Composer a besoin d'information au-dela de l'Event courant, il utilise `request()`.

> **ADR-0020 §6.3** : `resolve()` retourne `TResolveResult | TResolveResult[] | null`.
> Le framework traite les deux formes uniformement via un algorithme de diff.

### 3.1 Diff pour le retour simple (`TResolveResult | null`)

| `resolve()` retourne | View montee         | Action framework                         |
| -------------------- | ------------------- | ---------------------------------------- |
| `SameView`, même `rootElement` | `SameView` instance | **No-op** (instance conservee, aucun remount) |
| `SameView`, `rootElement` **different** | `SameView` instance | **Detach** -> **Attach** (traite comme un changement de View, pas comme un no-op) |
| `NewView`            | `OldView` instance  | **Detach** OldView -> **Attach** NewView |
| `NewView`            | null                | **Attach** NewView                       |
| null                 | `OldView` instance  | **Detach** OldView                       |
| null                 | null                | **No-op**                                |

### 3.2 Diff pour le retour tableau (`TResolveResult[]`) -- ADR-0020

> ⏳ **Strate 2 (ADR-0028)** — le retour tableau (N-instances hétérogènes) est
> différé en strate 2. En strate 0, `resolve()` retourne strictement
> `TResolveResult | null` (cf. §3.1 et l'encadré périmètre en tête).

```
resolve() retourne R' (nouveau)           Etat precedent R (ancien)
  -----------------------------------------------------------------
  Pour chaque resultat r dans R' :
    Si r.rootElement est dans R (meme element, meme viewClass) -> no-op (View conservee)
    Si r.rootElement est dans R (meme element, viewClass differente) -> detach + attach nouvelle
    Si r.rootElement n'est pas dans R (nouvel element) -> instanciation + attach
  Pour chaque r dans R \ R' :
    Si rootElement disparu du DOM -> cleanup
    Si rootElement toujours dans le DOM -> detach + destroy
```

---

## 4. Cycle de vie et attachement

> ⏳ **§4, §5, §6 décrivent le contrat cible** (options merge D34, uiElements/templates,
> Composers enfants, `onDetach()`, désinscription Channel/DOM, cascade de destruction,
> machine à états) — cf. le tableau de périmètre en tête de document pour la séquence
> réellement livrée en strate 0.

### 4.1 Sequence d'attachement (normative)

```
1. Composer.resolve(event) -> { view: ViewClass, rootElement, options? } (D34, ADR-0020, ADR-0027)
   --- le framework prend le relais ---
2. view = new ViewClass()
3. Framework merge les options : resolvedOptions = { ...view.params.options, ...options }
   (shallow merge -- les cles de options ecrasent celles de params.options)
4. Framework resout rootElement (ADR-0026) :
   rootElement est TOUJOURS un string (selecteur CSS).
   4a. Framework cherche slot.querySelector(rootElement)
   4b. SI trouve (SSR, H1)           -> el = element existant -- mode hydratation
   4c. SI non trouve                  -> Framework PARSE le selecteur CSS (ADR-0026 §3) :
       - 'div.MyView'                -> createElement('div'), addClass('MyView')
       - 'section#main.Layout-body'  -> createElement('section'), id='main', addClass('Layout-body')
       Framework insere l'element cree dans le slot (D30)
5. view.el = el
6. Framework resout view.params.uiElements -> cache @ui
   6a. Scope = rootElement, en EXCLUANT les sous-arbres des slots (I40)
   6b. Si un selecteur resout dans un slot -> ERREUR (mode debug)
7. Framework resout get templates() -> peuple nodes
8. Framework resout get composers() -> instancie les Composers enfants
   8a. Pour chaque cle dans composers : querySelectorAll(uiElements[cle])
   8b. N elements matches -> N instances de Composer (ADR-0020 §6.1)
9. Framework branche uiEvents par delegation (meme exclusion de scope)
10. Framework cable les handlers Channel de la View
11. view.onAttach()
12. Pour chaque Composer enfant : resolution recursive (retour a l'etape 1)
```

### 4.2 Sequence de detachement (normative)

```
1. Composer decide de detacher (resolve(event) -> null ou autre ViewClass)
   --- le framework prend le relais ---
2. Pour chaque Composer enfant de la View :
   a. Detachement recursif (child Composers d'abord, puis child Views)
3. view.onDetach()                    <- hook developpeur (View uniquement)
4. Unsubscribe Channels View + Behaviors
5. Unbind DOM event delegation
6. Liberer references (nodes, uiCache, el)
7. Si rootElement cree par le framework (SPA, ADR-0026) -> retirer l'element du DOM
8. Composer.currentView = null
```

> **ADR-0025** : pas de `composer.onUnmount()` dans la sequence de detachement.
> Le Composer n'a aucun cleanup a effectuer — il n'a ni state, ni subscriptions propres.
> Le framework gère la desinscription des Events `listen` en interne.

---

## 5. Cascade de destruction

Quand un slot disparait du DOM (suite a une projection de la View parente) :

```
View parente : projection (PDR)
  |  project() ou reconcile() supprime/modifie le DOM
  |
  +-- [framework] Apres projection : scanner les slots declares (get composers())
       |
       +-- Slot '@ui.sidebar' existe toujours -> rien
       |
       +-- Slot '@ui.details' a disparu -> declencher detach
            |
            +-- Framework desinscrit DetailsComposer des Events listen
            |
            +-- DetailsView detachement recursif :
                 +-- Ses propres Composers d'abord (recursion)
                 +-- detailsView.onDetach()
                 +-- Unsubscribe Channels
                 +-- Unbind delegation
                 +-- Liberer references
```

> **ADR-0025** : pas de `composer.onUnmount()` dans la cascade.
> Le framework se charge de desinscrire le Composer des Events — c'est une operation
> interne, pas un hook developpeur.

> **Detection sans MutationObserver** : le framework instrumente `project()` et
> `reconcile()` pour savoir quels noeuds DOM ont ete affectes. Après chaque
> projection, il vérifie si les slots déclarés dans `get composers()` de la View
> sont toujours presents dans le DOM. C'est la **projection** qui est la source
> de verite, pas le DOM lui-même.

---

## 6. Cycle de vie -- machine a états

> ⚠️ **Cible strate 1, non livree** : `Composer` a reellement un champ prive
> `#state: "idle" | "active"` — deux états, pas cinq. Pas de `resolving`
> (le calcul de `resolve()` est synchrone, sans état intermediaire observable),
> pas de `detaching` (le detachement est synchrone dans `#detachCurrent()`),
> pas de `destroyed` (aucune notion de destruction n'est livree). `#state`
> passe a `"active"` dans `#attachNew()` et a `"idle"` dans `#detachCurrent()`.

```
idle -> resolving -> active(Views) -> detaching -> idle
                   ^                |
                   +-- re-resolve --+  (diff Views)
                                   | [destroyed] (si View parente detruite)
```

| État            | Description                                                  | Transitions                                                                       |
| --------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `idle`          | Scope present, aucune View montee                            | -> `resolving` si condition remplie                                               |
| `resolving`     | `resolve()` appele, Views determinees                        | -> `active(Views)` si resultat non-null, -> `idle` si null                        |
| `active(Views)` | 1/N Views montees dans le scope                              | -> `resolving` si `resolve()` recalcule (diff), -> `detaching` si scope disparait |
| `detaching`     | Detachement recursif des Views et de leurs Composers enfants | -> `idle` (scope toujours la) ou `destroyed` (scope disparu)                      |
| `destroyed`     | Scope definitivement disparu (View parente detruite)         | -- (terminal)                                                                     |

> **Invariants de transition** :
>
> - Un Composer en `active(Views)` recalcule l'ensemble via `resolve(event)` ; le framework diff et applique les changements (attach/detach) -- pas de montage imperatif individuel (I37, ADR-0020)
> - La transition `active -> detaching` declenche la cascade de destruction (§5)
> - Un Composer `destroyed` n'est jamais reutilise -- la View parente est elle-même detruite
> - Le scope DOM d'un Composer est immutable -- assigne une fois, jamais migre (I58, ADR-0020)
> - **Aucun hook lifecycle** sur les transitions (ADR-0025) -- le framework gère les subscriptions en interne

---

## Lecture suivante

-> [view.md](view.md) -- le composant de rendu et d'interaction
-> [2-architecture/lifecycle.md](../2-architecture/lifecycle.md) -- cycle de vie persistants vs volatils
