# Composer -- Decideur de composition

> **resolve(event) determine quelle(s) View(s) instancier, 0/N Views heterogenes, scope DOM fixe**

[<- Retour couche concrete](README.md) | [<- Foundation](foundation.md) | [-> View](view.md)

---

| Champ | Valeur |
|-------|--------|
| **Composant** | Composer |
| **Couche** | Concrete (ephemere) |
| **Source**    | Historique : RFC-0002-api-contrats-typage §12 |
| **Statut** | Stable |
| **ADRs liees** | ADR-0020 (N-instances, scope immutable), ADR-0024 (pattern manifeste value-first), ADR-0025 (pas de hooks lifecycle), ADR-0026 (rootElement string-only CSS), ADR-0027 (resolve(event) argument unique) |

---

## Table des matieres

1. [Classe abstraite Composer](#1-classe-abstraite-composer)
2. [Exemples de Composers](#2-exemples-de-composers)
3. [Methode resolve()](#3-methode-resolve)
4. [Cycle de vie et attachement](#4-cycle-de-vie-et-attachement)
5. [Cascade de destruction](#5-cascade-de-destruction)
6. [Cycle de vie -- machine a etats](#6-cycle-de-vie----machine-a-etats)

---

## 1. Classe abstraite Composer

Le Composer est un **decideur de composition pur** : il est attache a un scope DOM,
il decide quelle(s) View(s) instancier, et il gere le lifecycle de **0/N Views
heterogenes** dans son scope fixe (ADR-0020, I37 revise).
Il n'a **aucune ecriture DOM** -- lecture du scope autorisee (I35 nuance).

**Le Composer n'a ni hooks lifecycle, ni handlers d'Events, ni state local.**
Son unique point d'entree est `resolve(event)` (ADR-0025, ADR-0027).

### 1.1 Types

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
  readonly discriminant: `${TListen[number]['namespace']}:${string & keyof TListen[number]['events']}`;
  readonly namespace: TListen[number]['namespace'];
  readonly eventName: string & keyof TListen[number]['events'];
  readonly payload: TListen[number]['events'][keyof TListen[number]['events']];
};
// Note : la definition complete avec distribution par variante est dans ADR-0027 §3.

/**
 * TComposerParams -- contrainte de validation (ADR-0024 value-first).
 * Utilise avec `satisfies` pour verifier la forme sans elargir les types.
 */
type TComposerParams = {
  readonly listen:  readonly TChannelDefinition[];
  readonly request: readonly TChannelDefinition[];
};

/**
 * TComposerCapabilities -- type derive complet (ADR-0024 value-first).
 * Extrait les types narrow (tuples) depuis typeof params.
 */
type TComposerCapabilities<TParams extends TComposerParams> = {
  readonly listen:  TParams['listen'];
  readonly request: TParams['request'];
};

/**
 * TResolveResult -- retour de resolve() (ADR-0020 SS6.2, ADR-0026).
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
abstract class Composer<TCapabilities extends TComposerCapabilities<TComposerParams>> {
  /** Reference au scope DOM -- fourni par le framework, jamais mute par le Composer */
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
   * Retourne (ADR-0020 SS6.3) :
   * - TResolveResult     -> Composer classique (1 View)
   * - TResolveResult[]   -> Composer dynamique (N Views heterogenes)
   * - null               -> le framework detache les Views courantes (scope vide)
   */
  abstract resolve(
    event: TComposerEvent<TCapabilities['listen']> | null
  ): TResolveResult | TResolveResult[] | null;

  /** La View actuellement montee (null si vide) -- pour resolve() classique (0/1) */
  protected readonly currentView: View<any> | null;

  /**
   * Effectue un request/reply synchrone (ADR-0023).
   * Disponible dans resolve() pour obtenir de l'information du Feature.
   */
  protected request<T>(channel: TChannelDefinition, requestName: string): T | null;
}
```

> **D21** : le Composer decide, la View parente ne compose jamais.
> **D23, I35 (nuance ADR-0020)** : aucune ecriture DOM. Lecture du scope autorisee.
> **I37 (revise ADR-0020)** : 0/N Views heterogenes dans un scope fixe via `resolve()` etendu.
> **ADR-0025** : pas de `onMount()`/`onUnmount()`. Le Composer n'a aucun hook lifecycle.
> **ADR-0026** : `rootElement` est toujours un `string`, jamais un `Element`.
> **ADR-0027** : `resolve(event)` est l'unique methode abstraite. Pas de `onXxxEvent()`, pas de state local.

---

## 2. Exemples de Composers

### 2.1 Composer statique — aucun Channel

```typescript
// FooterComposer : toujours la meme View, pas de listen, pas de request.
// resolve(event) recoit toujours null (aucun Event ecoute).

const footerComposerParams = {
  listen:  [],
  request: [],
} as const satisfies TComposerParams;

type TFooterComposerCapabilities = TComposerCapabilities<typeof footerComposerParams>;

class FooterComposer extends Composer<TFooterComposerCapabilities> {
  get params() { return footerComposerParams; }

  resolve(event: null): TResolveResult {
    // Toujours la meme View — le footer ne change jamais
    return { view: FooterView, rootElement: 'footer.Footer' };
  }
}
```

### 2.2 Composer conditionnel — un Channel

```typescript
// SidebarComposer : affiche LoginView ou ProfileView selon l'etat Auth.
// resolve(event) recoit l'Event Auth OU null au premier montage.
// Au premier montage, le Composer fait un request() pour obtenir l'etat initial.

const sidebarComposerParams = {
  listen:  [Auth.channel],
  request: [Auth.channel],
} as const satisfies TComposerParams;

type TSidebarComposerCapabilities = TComposerCapabilities<typeof sidebarComposerParams>;

class SidebarComposer extends Composer<TSidebarComposerCapabilities> {
  get params() { return sidebarComposerParams; }

  resolve(event: TComposerEvent<TSidebarComposerCapabilities['listen']> | null): TResolveResult {
    // Premier montage : request() pour obtenir l'etat initial
    // Appels suivants : l'Event porte directement le payload
    const isAuthenticated = event !== null
      ? event.payload.isAuthenticated                     // ← Event Auth recu
      : this.request<boolean>(Auth.channel, 'isAuthenticated'); // ← premier montage

    return {
      view: isAuthenticated ? ProfileView : LoginView,
      rootElement: '.Sidebar-content',
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
  listen:  [Router.channel, Auth.channel],
  request: [Router.channel, Auth.channel],
} as const satisfies TComposerParams;

type TMainComposerCapabilities = TComposerCapabilities<typeof mainComposerParams>;

class MainContentComposer extends Composer<TMainComposerCapabilities> {
  get params() { return mainComposerParams; }

  resolve(event: TComposerEvent<TMainComposerCapabilities['listen']> | null): TResolveResult | null {
    // Obtenir l'etat courant (request synchrone, ADR-0023)
    const route = this.request<TCurrentRoute>(Router.channel, 'currentRoute');
    const isAuth = this.request<boolean>(Auth.channel, 'isAuthenticated');

    // Pages protegees : redirect si non authentifie
    if (!isAuth && route.requiresAuth) {
      return { view: LoginView, rootElement: '.MainContent-root' };
    }

    // Routing standard
    switch (route.page) {
      case 'home':    return { view: HomeView,     rootElement: '.MainContent-root' };
      case 'product': return { view: ProductView,  rootElement: '.MainContent-root' };
      case 'cart':    return { view: CartView,      rootElement: '.MainContent-root' };
      default:        return { view: NotFoundView,  rootElement: '.MainContent-root' };
    }
  }
}
```

> **Pattern `request()` dans `resolve()`** — le Composer peut interroger n'importe quel
> Channel declare dans `request` pour obtenir l'etat courant du Feature.
> C'est le pattern recommande pour les decisions multi-dimensionnelles (ADR-0027 §4.3).
> L'argument `event` indique **quel Channel a change**, mais le Composer
> peut toujours requeter l'etat complet via `request()`.

> **Pas de `onXxxEvent` handlers** (ADR-0027) — le Composer n'a pas de methodes
> `onRouterRouteChangedEvent()` ni `onAuthStateChangedEvent()`. L'Event est recu
> en argument de `resolve()`. Pas de stockage intermediaire, pas de pseudo-state.

---

## 3. Methode resolve()

`resolve(event)` est l'unique methode abstraite du Composer (ADR-0027).
Le framework l'appelle avec l'Event declencheur en argument :

| Quand | Argument `event` |
|-------|-----------------|
| **Premier montage** | `null` — le scope existe pour la premiere fois (bootstrap ou apparition dynamique) |
| **Apres un Event** | `TComposerEvent` — l'Event ecoute (listen) qui a declenche le recalcul. Discriminant, namespace, eventName et payload types |
| **Reapparition du scope** | `null` — le scope avait disparu puis reapparait (ex: projection de la View parente) |

> **ADR-0027** : l'Event est passe **en argument**, pas via un handler `onXxxEvent()`.
> Le Composer n'a pas de state local ou le stocker — il recalcule sa decision a chaque appel.
> Si le Composer a besoin d'information au-dela de l'Event courant, il utilise `request()`.

> **ADR-0020 SS6.3** : `resolve()` retourne `TResolveResult | TResolveResult[] | null`.
> Le framework traite les deux formes uniformement via un algorithme de diff.

### 3.1 Diff pour le retour simple (`TResolveResult | null`)

| `resolve()` retourne | View montee | Action framework |
|----------------------|-------------|-----------------|
| `SameView` | `SameView` instance | **No-op** |
| `NewView` | `OldView` instance | **Detach** OldView -> **Attach** NewView |
| `NewView` | null | **Attach** NewView |
| null | `OldView` instance | **Detach** OldView |
| null | null | **No-op** |

### 3.2 Diff pour le retour tableau (`TResolveResult[]`) -- ADR-0020

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
   8b. N elements matches -> N instances de Composer (ADR-0020 SS6.1)
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
> Le framework gere la desinscription des Events `listen` en interne.

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
> `reconcile()` pour savoir quels noeuds DOM ont ete affectes. Apres chaque
> projection, il verifie si les slots declares dans `get composers()` de la View
> sont toujours presents dans le DOM. C'est la **projection** qui est la source
> de verite, pas le DOM lui-meme.

---

## 6. Cycle de vie -- machine a etats

```
idle -> resolving -> active(Views) -> detaching -> idle
                   ^                |
                   +-- re-resolve --+  (diff Views)
                                   | [destroyed] (si View parente detruite)
```

| Etat | Description | Transitions |
|------|-------------|-------------|
| `idle` | Scope present, aucune View montee | -> `resolving` si condition remplie |
| `resolving` | `resolve()` appele, Views determinees | -> `active(Views)` si resultat non-null, -> `idle` si null |
| `active(Views)` | 1/N Views montees dans le scope | -> `resolving` si `resolve()` recalcule (diff), -> `detaching` si scope disparait |
| `detaching` | Detachement recursif des Views et de leurs Composers enfants | -> `idle` (scope toujours la) ou `destroyed` (scope disparu) |
| `destroyed` | Scope definitivement disparu (View parente detruite) | -- (terminal) |

> **Invariants de transition** :
> - Un Composer en `active(Views)` recalcule l'ensemble via `resolve(event)` ; le framework diff et applique les changements (attach/detach) -- pas de montage imperatif individuel (I37, ADR-0020)
> - La transition `active -> detaching` declenche la cascade de destruction (§5)
> - Un Composer `destroyed` n'est jamais reutilise -- la View parente est elle-meme detruite
> - Le scope DOM d'un Composer est immutable -- assigne une fois, jamais migre (I58, ADR-0020)
> - **Aucun hook lifecycle** sur les transitions (ADR-0025) -- le framework gere les subscriptions en interne

---

## Lecture suivante

-> [view.md](view.md) -- le composant de rendu et d'interaction
-> [2-architecture/lifecycle.md](../2-architecture/lifecycle.md) -- cycle de vie persistants vs volatils
