# Composer -- Décideur de composition

> **resolve(event) determine quelle(s) View(s) instancier, 0/N Views heterogenes, scope DOM fixe**

[<- Retour couche concrete](README.md) | [<- Foundation](foundation.md) | [-> View](view.md)

---

| Champ | Valeur |
| --- | --- |
| **Composant** | Composer |
| **Couche** | Concrete (ephemere) |
| **Statut** | Stable |
| **ADR** | [ADR-18](../../adr/ADR-18-composer.md) (décideur pur, `resolve(event)`, N instances), [ADR-19](../../adr/ADR-19-root-element.md) (`rootElement`), [ADR-14](../../adr/ADR-14-contrats-types.md) (contrat modulaire) |

---

> ## ⏳ Périmètre d'implémentation
>
> | Élément | État | Sections |
> | --- | --- | --- |
> | `Composer` non générique, `resolve(event: unknown \| null) → TResolveResult \| null`, slot immuable créé si absent, diff §3.1 | ✅ strate 0 | §1, §3.1 |
> | Contrat modulaire `get features()`, `TComposerEvent`, `request()`, re-resolve sur Event | ⏳ strate 1d | §1, §2, §3 |
> | Retour `TResolveResult[]` (N instances hétérogènes) | ⏳ strate 1d | §3.2 |
> | Surcharge des sélecteurs/options de la View par `resolve()` (ADR-21) | ⏳ strate 2 | §1.1 |
> | Composers enfants (`View.composers`), `onDetach()`, désinscriptions, cascade de destruction, machine à états | ⏳ strate 1d | §4–§6 |
>
> **Écarts du livré** ([ADR-18](../../adr/ADR-18-composer.md), [ADR-19](../../adr/ADR-19-root-element.md)) :
>
> - sans Channel, rien ne déclenche un re-resolve en application : `performResolve(event)` n'est appelé que par les tests ;
> - `View.mount()` résout son `rootElement` par un `document.querySelector()` **global**, pas dans le slot ; si l'élément manque, rien ne le crée ;
> - au détachement, `#detachCurrent()` oublie la référence sans démonter la View : ses listeners Channel et DOM restent actifs (fuite connue, ADR-03).

---

## Table des matieres

1. [Classe abstraite Composer](#1-classe-abstraite-composer)
2. [Exemples](#2-exemples)
3. [Méthode resolve()](#3-méthode-resolve)
4. [Cycle de vie et attachement](#4-cycle-de-vie-et-attachement)
5. [Cascade de destruction](#5-cascade-de-destruction)
6. [Cycle de vie -- machine a états](#6-cycle-de-vie----machine-a-états)

---

## 1. Classe abstraite Composer

Le Composer est un **décideur de composition pur** : attaché à un slot DOM
immuable, il décide quelle(s) View(s) y monter et gère 0/N Views hétérogènes
(I37). Il n'écrit **jamais** dans le DOM ; lire son scope pour choisir un
`rootElement` est autorisé (I35).

**Ni hook de cycle de vie, ni handler d'Event, ni state local** : son unique
point d'entrée est `resolve(event)` ([ADR-18](../../adr/ADR-18-composer.md)).

### 1.1 Types

> ⏳ Cible, non livré.

Le Composer suit le pattern modulaire des composants consommateurs
([ADR-14](../../adr/ADR-14-contrats-types.md), I83), réduit au module Feature :
pas de module UI, puisqu'il n'a pas de DOM.

```typescript
/** Contrat d'un Composer : Features consommées, sans UI (I35). */
type TComposerContract<F extends TFeatureContract = TFeatureContract> = {
  readonly features: F;
};

/**
 * Event reçu par resolve() — union discriminée par `key` ("ns:event"),
 * dérivée des `listens` du contrat. Narrowing complet dans un switch.
 */
type TComposerEvent<TCC extends TComposerContract> = {
  [K in TFlatListens<TCC["features"]>]: {
    readonly key: K;
    readonly payload: TEventPayloadFor<TCC["features"], K>;
  };
}[TFlatListens<TCC["features"]>];

/** Retour de resolve() — ADR-18, ADR-19. */
type TResolveResult = {
  readonly view: TViewClass;
  /** Sélecteur CSS, toujours une string, résolu dans le slot (ADR-19). */
  readonly rootElement: string;
  /** ⏳ strate 2 — surcharges de la View (sélecteurs `uiElements`, options), ADR-21 ; forme à définir. */
  readonly options?: TViewOverrides;
};
```

Dans un contrat de Composer, `triggers` est toujours vide : un Composer
**écoute** et **interroge**, il ne déclenche jamais de Command.

### 1.2 Classe

```typescript
abstract class Composer<TCC extends TComposerContract = TComposerContract> {
  /** Livré : options du constructeur, `{ rootElement }` (`TComposerOptions`), fournies par la Foundation. */
  constructor(options: TComposerOptions);

  /** Livré : sélecteur CSS du slot, immuable (ADR-19). */
  get rootElement(): string;

  /** Slot DOM — résolu par `attach()`, jamais muté par le Composer (livré). `null` avant `attach()`. */
  get slot(): HTMLElement | null;

  /** View montée actuellement, ou null (livré, retour simple). */
  get currentView(): View | null;

  /**
   * Livré, appelé par la Foundation : `parentElement.querySelector(rootElement)`, sinon le
   * slot est créé (ADR-19) ; puis `resolve(null)` et le diff §3.1.
   */
  attach(parentElement: HTMLElement): void;

  /**
   * Livré, public : relance `resolve(event)` et le diff. Rien ne l'appelle en application
   * (pas encore de `listen`) : seuls les tests le font.
   */
  performResolve(event: unknown | null): void;

  /** ⏳ Module Feature — lu une seule fois à l'attachement (I81). */
  abstract get features(): TCC["features"];

  /**
   * Unique méthode abstraite (livrée, avec `event: unknown`).
   * - `null` : premier montage, ou réapparition du slot ;
   * - sinon : l'Event écouté qui a déclenché le recalcul.
   * Retour : une View, ⏳ N Views, ou `null` pour vider le slot.
   */
  abstract resolve(
    event: TComposerEvent<TCC> | null
  ): TResolveResult | readonly TResolveResult[] | null;

  /** ⏳ Request synchrone typée vers une Feature déclarée (ADR-02). */
  protected request<K extends TFlatRequests<TCC["features"]>>(
    key: K,
    params: TRequestParamsFor<TCC["features"], K>
  ): TRequestResultFor<TCC["features"], K> | null;
}
```

- Le Composer est instancié par le framework (Foundation ou View parente), jamais par le développeur ; une sous-classe qui déclare un constructeur doit relayer `options` à `super(options)`.
- Le slot est assigné une fois et ne change jamais.
- Pas de `trigger()`, pas d'`emit()`, pas de `onXxxEvent()`, pas de `onMount()`/`onUnmount()`.

---

## 2. Exemples

> ⏳ Cible, non livré.

### 2.1 Composer statique — aucun Channel (forme livrée)

```typescript
class FooterComposer extends Composer {
  resolve(): TResolveResult {
    return { view: FooterView, rootElement: "footer.Footer" };
  }
}
```

### 2.2 Composer conditionnel — un Channel

```typescript
const sidebarFeatures = {
  auth: {
    feature: AuthFeature,
    listens: ["sessionChanged"] as const,
    triggers: [] as const,
    requests: ["isAuthenticated"] as const,
  },
} satisfies TFeatureContract;

type TSidebarContract = TComposerContract<typeof sidebarFeatures>;

class SidebarComposer extends Composer<TSidebarContract> {
  get features() { return sidebarFeatures; }

  resolve(event: TComposerEvent<TSidebarContract> | null): TResolveResult {
    // Premier montage : on interroge ; ensuite, l'Event porte l'information.
    const isAuthenticated = event
      ? event.payload.isAuthenticated
      : this.request("auth:isAuthenticated", undefined) ?? false;

    return {
      view: isAuthenticated ? ProfileView : LoginView,
      rootElement: ".Sidebar-content",
    };
  }
}
```

`isAuthenticated` n'est pas stocké : chaque appel recalcule la décision.

### 2.3 Composer multi-Channel — routeur et authentification

```typescript
const mainFeatures = {
  router: {
    feature: RouterFeature,
    listens: ["routeChanged"] as const,
    triggers: [] as const,
    requests: ["currentRoute"] as const,
  },
  auth: {
    feature: AuthFeature,
    listens: ["sessionChanged"] as const,
    triggers: [] as const,
    requests: ["isAuthenticated"] as const,
  },
} satisfies TFeatureContract;

type TMainContract = TComposerContract<typeof mainFeatures>;

class MainContentComposer extends Composer<TMainContract> {
  get features() { return mainFeatures; }

  resolve(event: TComposerEvent<TMainContract> | null): TResolveResult | null {
    // L'Event dit QUEL Channel a changé ; l'état complet se lit par request().
    const route = this.request("router:currentRoute", undefined);
    const isAuth = this.request("auth:isAuthenticated", undefined) ?? false;
    const root = ".MainContent-root";

    if (route === null) return null;
    if (route.requiresAuth && !isAuth) return { view: LoginView, rootElement: root };

    switch (route.page) {
      case "home":    return { view: HomeView, rootElement: root };
      case "product": return { view: ProductView, rootElement: root };
      case "cart":    return { view: CartView, rootElement: root };
      default:        return { view: NotFoundView, rootElement: root };
    }
  }
}
```

Pour une décision qui dépend de plusieurs dimensions, `resolve()` interroge
l'état courant par `request()` plutôt que de mémoriser les Events précédents.

---

## 3. Méthode resolve()

`resolve(event)` est l'unique méthode abstraite du Composer (ADR-18).
Le framework l'appelle avec l'Event declencheur en argument :

| Quand | Argument `event` |
| --- | --- |
| **Premier montage** | `null` — le scope existe pour la première fois (bootstrap ou apparition dynamique) |
| **Après un Event** ⏳ | `TComposerEvent` — l'Event écouté qui a déclenché le recalcul : `key` (`"ns:event"`) et `payload` typés |
| **Reapparition du scope** | `null` — le scope avait disparu puis reapparait (ex: projection de la View parente) |

> **ADR-18** : l'Event est passe **en argument**, pas via un handler `onXxxEvent()`.
> Le Composer n'a pas de state local ou le stocker — il recalcule sa decision a chaque appel.
> Si le Composer a besoin d'information au-dela de l'Event courant, il utilise `request()`.
>
> **ADR-18** : `resolve()` retourne `TResolveResult | TResolveResult[] | null`.
> Le framework traite les deux formes uniformement via un algorithme de diff.

### 3.1 Diff pour le retour simple (`TResolveResult | null`)

| `resolve()` retourne | View montee | Action framework |
| --- | --- | --- |
| `SameView`, même `rootElement` | `SameView` instance | **No-op** (instance conservee, aucun remount) |
| `SameView`, `rootElement` **different** | `SameView` instance | **Detach** -> **Attach** (traite comme un changement de View, pas comme un no-op) |
| `NewView` | `OldView` instance | **Detach** OldView -> **Attach** NewView |
| `NewView` | null | **Attach** NewView |
| null | `OldView` instance | **Detach** OldView |
| null | null | **No-op** |

### 3.2 Diff pour le retour tableau (`TResolveResult[]`)

> ⏳ Cible, non livré.
>
> ⏳ **Strate 1d** — aujourd'hui `resolve()` retourne strictement
> `TResolveResult | null` (§3.1).

```text
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

> ⏳ **§4, §5, §6 décrivent le contrat cible** (options merge ADR-21, uiElements/templates,
> Composers enfants, `onDetach()`, désinscription Channel/DOM, cascade de destruction,
> machine à états) — cf. le tableau de périmètre en tête de document pour la séquence
> réellement livrée en strate 0.

### 4.1 Sequence d'attachement (normative)

```text
1. Composer.resolve(event) -> { view: ViewClass, rootElement, options? } (ADR-21, ADR-18)
   --- le framework prend le relais ---
2. view = new ViewClass()
3. Framework applique les surcharges de options (ADR-21) : merge superficiel
   sur les sélecteurs uiElements et les options par défaut de la View
4. Framework resout rootElement (ADR-19) :
   rootElement est TOUJOURS un string (selecteur CSS).
   4a. Framework cherche slot.querySelector(rootElement)
   4b. SI trouve (SSR, H1)           -> el = element existant -- mode hydratation
   4c. SI non trouve                  -> Framework PARSE le selecteur CSS (ADR-19) :
       - 'div.MyView'                -> createElement('div'), addClass('MyView')
       - 'section#main.Layout-body'  -> createElement('section'), id='main', addClass('Layout-body')
       Framework insere l'element cree dans le slot (ADR-19)
5. view.el = el
6. Framework lit view.features, view.uiEvents, view.uiElements (une fois, I81)
   6a. Scope = rootElement, en EXCLUANT les sous-arbres des slots (I40)
   6b. Si un selecteur resout dans un slot -> ERREUR (mode debug)
7. Framework resout get templates() -> peuple nodes
8. Framework resout get composers() -> instancie les Composers enfants
   8a. Pour chaque cle dans composers : querySelectorAll(uiElements[cle])
   8b. N elements matches -> N instances de Composer (ADR-18)
9. Framework branche les handlers DOM on{Key}{Event} (meme exclusion de scope)
10. Framework cable les handlers Channel de la View
11. view.onAttach()
12. Pour chaque Composer enfant : resolution recursive (retour a l'etape 1)
```

### 4.2 Sequence de detachement (normative)

```text
1. Composer decide de detacher (resolve(event) -> null ou autre ViewClass)
   --- le framework prend le relais ---
2. Pour chaque Composer enfant de la View :
   a. Detachement recursif (child Composers d'abord, puis child Views)
3. view.onDetach()                    <- hook developpeur (View uniquement)
4. Unsubscribe Channels View + Behaviors
5. Unbind DOM event delegation
6. Liberer references (nodes, uiCache, el)
7. Si rootElement cree par le framework (SPA, ADR-19) -> retirer l'element du DOM
8. Composer.currentView = null
```

> **ADR-18** : pas de `composer.onUnmount()` dans la sequence de detachement.
> Le Composer n'a aucun cleanup a effectuer — il n'a ni state, ni subscriptions propres.
> Le framework gère la desinscription des Events `listen` en interne.

---

## 5. Cascade de destruction

Quand un slot disparait du DOM (suite a une projection de la View parente) :

```text
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

> **ADR-18** : pas de `composer.onUnmount()` dans la cascade.
> Le framework se charge de desinscrire le Composer des Events — c'est une operation
> interne, pas un hook developpeur.
>
> **Detection sans MutationObserver** : le framework instrumente `project()` et
> `reconcile()` pour savoir quels noeuds DOM ont ete affectes. Après chaque
> projection, il vérifie si les slots déclarés dans `get composers()` de la View
> sont toujours presents dans le DOM. C'est la **projection** qui est la source
> de verite, pas le DOM lui-même.

---

## 6. Cycle de vie -- machine a états

> ⏳ **Cible strate 1d** : `Composer` a aujourd'hui un champ privé
> `#state: "idle" | "active"` — deux états, pas cinq. Pas de `resolving`
> (le calcul de `resolve()` est synchrone, sans état intermediaire observable),
> pas de `detaching` (le detachement est synchrone dans `#detachCurrent()`),
> pas de `destroyed` (aucune notion de destruction n'est livree). `#state`
> passe a `"active"` dans `#attachNew()` et a `"idle"` dans `#detachCurrent()`.

```text
idle -> resolving -> active(Views) -> detaching -> idle
                   ^                |
                   +-- re-resolve --+  (diff Views)
                                   | [destroyed] (si View parente detruite)
```

| État | Description | Transitions |
| --- | --- | --- |
| `idle` | Scope present, aucune View montee | -> `resolving` si condition remplie |
| `resolving` | `resolve()` appele, Views determinees | -> `active(Views)` si resultat non-null, -> `idle` si null |
| `active(Views)` | 1/N Views montees dans le scope | -> `resolving` si `resolve()` recalcule (diff), -> `detaching` si scope disparait |
| `detaching` | Detachement recursif des Views et de leurs Composers enfants | -> `idle` (scope toujours la) ou `destroyed` (scope disparu) |
| `destroyed` | Scope definitivement disparu (View parente detruite) | -- (terminal) |

> **Invariants de transition** :
>
> - Un Composer en `active(Views)` recalcule l'ensemble via `resolve(event)` ; le framework diff et applique les changements (attach/detach) -- pas de montage imperatif individuel (I37, ADR-18)
> - La transition `active -> detaching` declenche la cascade de destruction (§5)
> - Un Composer `destroyed` n'est jamais reutilise -- la View parente est elle-même detruite
> - Le scope DOM d'un Composer est immutable -- assigne une fois, jamais migre (I58, ADR-18)
> - **Aucun hook lifecycle** sur les transitions (ADR-18) -- le framework gère les subscriptions en interne

---

## Lecture suivante

-> [view.md](view.md) -- le composant de rendu et d'interaction
-> [2-architecture/lifecycle.md](../2-architecture/lifecycle.md) -- cycle de vie persistants vs volatils
