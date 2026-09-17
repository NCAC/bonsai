# Foundation -- Point d'ancrage unique sur body

> **Singleton persistant, écoute DOM globale, Composers racines, alteration N1 sur html/body**

[<- Retour couche concrete](README.md) | [<- Behavior](behavior.md) | [-> Composer](composer.md)

---

| Champ          | Valeur                                                                                                                                             |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Composant**  | Foundation                                                                                                                                         |
| **Couche**     | Concrete (persistant -- exception)                                                                                                                 |
| **Source**     | Historique : RFC-0002-api-contrats-typage §11, ADR-0018                                                                                            |
| **Statut**     | Stable                                                                                                                                             |
| **ADRs liées** | ADR-0010 (bootstrap order), ADR-0018 (Foundation contract), ADR-0028 (phasage strates), **ADR-0038 (Foundation.composers Record + I67 stabilite)** |

---

> ### ⏳ Périmètre d'implémentation (ADR-0028)
>
> Ce document décrit le **contrat cible complet** de Foundation. Conformément
> au phasage kernel-first, certaines capacités sont **différées** :
>
> | Élément                                                         | Strate cible | Sections concernées |
> | --------------------------------------------------------------- | ------------ | ------------------- |
> | `get params()` avec `listen` / `trigger` / `request` (ADR-0024) | Strate 1     | §1, §2              |
> | Generic de classe `Foundation<TCapabilities>`                   | Strate 1     | §1                  |
> | Auto-discovery handlers Channel (`onXxxYyyEvent`)               | Strate 1     | §2                  |
> | `protected this.html` / `this.body` exposés au développeur      | Strate 1     | §2                  |
> | Hooks `onAttach()` / `onDetach()` côté Foundation               | Strate 1     | §1, §2              |
>
> **Strate 0 — périmètre effectif** : `Foundation` non-générique, abstract `get composers(): Readonly<Record<string, typeof Composer>>` (ADR-0038), `attach()` orchestre la résolution + instanciation des Composers racines, garantie I33 (singleton), I34 (rootElement enfant de `<body>`), I67 (stabilité structurelle).
>
> Voir aussi : [ADR-0028](../../adr/ADR-0028-implementation-phasing-strategy.md), [ADR-0038](../../adr/ADR-0038-foundation-composers-record-stable-layout.md).
>
> **⚠ `get params()` / forme `TComposerParams`-like (ADR-0024) est une forme
> cible intermédiaire, supersédée par le pattern modulaire ADR-0042** —
> [I83](../reference/invariants.md) : « Foundation strate 0 = vide ». ADR-0042
> déclare déjà `TFoundationContract = {}` (vide en strate 0) et
> `TFoundationCallbacks<TFC>`, mais **reporte explicitement la forme peuplée
> de strate 1+** (`listen`/`trigger`/`request`) à une décision ultérieure —
> non tranchée, ne pas présumer qu'elle réutilisera `TFeatureContract` tel
> quel. Ce qui est acquis : ce **ne sera pas** `TComposerParams`/`get
> params()` (ADR-0024). Les exemples des §1–2 ci-dessous, écrits avant cette
> clarification, restent en forme ADR-0024 et seront réécrits à
> l'implémentation strate 1 (cf. [ADR-0042 §Actions de
> suivi](../../adr/ADR-0042-view-contract-unified-ui-deps-single-generic.md)).

---

## Table des matieres

1. [Classe Foundation](#1-classe-foundation)
2. [Droits d'alteration DOM (N1)](#2-droits-dalteration-dom-n1)
3. [Composers racines](#3-composers-racines)
   3.bis [Pattern delegation pour composition dynamique (ADR-0038)](#3bis-pattern-delegation-pour-composition-dynamique-adr-0038-63)
4. [Relation avec Application](#4-relation-avec-application)

---

## 1. Classe Foundation

La Foundation est le point d'ancrage **unique** de l'application dans le document DOM.
Elle cible `<body>` et couvre le trou de couverture DOM laisse par les Views
(dont le rootElement est forcement un enfant de `<body>`, jamais `<body>` lui-même).

> ⚠️ **`TChannelDefinition[]` incohérent avec ADR-0040** : comme pour
> `TComposerParams` ([composer.md §1.1](composer.md)), `namespace` ne vit pas
> sur `TChannelDefinition` — un tuple de dépendances déclarées devrait être
> `readonly TChannelToken<TDef, string>[]`. Par ailleurs `onAttach()` est
> livré **public** (pas `protected`), et `attach()`/`get composerInstances()`
> (surface framework réelle, publique) ne sont pas documentés dans ce bloc
> cible.

```typescript
/**
 * TFoundationParams -- contrainte de validation (ADR-0024 value-first).
 * Comme TComposerParams mais avec trigger en plus.
 */
type TFoundationParams = {
  readonly listen: readonly TChannelDefinition[];
  readonly trigger: readonly TChannelDefinition[];
  readonly request: readonly TChannelDefinition[];
};

/**
 * TFoundationCapabilities -- type derive complet (ADR-0024 value-first).
 * Extrait les types narrow (tuples) depuis typeof params.
 */
type TFoundationCapabilities<TParams extends TFoundationParams> = {
  readonly listen: TParams["listen"];
  readonly trigger: TParams["trigger"];
  readonly request: TParams["request"];
};

/**
 * Foundation -- point d'ancrage unique sur <body>.
 *
 * Composant persistant de la couche concrete. Cree au bootstrap (D6, etape 6).
 * Un seul par application (I33).
 *
 * Capacites :
 * - Ecoute DOM globale (resize, scroll, visibility, etc.) sur <html>/<body>
 * - Alteration N1 (classes, attributs) sur <html>/<body> uniquement (D27)
 * - Capacites Channel (listen, trigger, request) comme une View (D20)
 * - Declaration des Composers racines via get composers() (D29)
 *
 * Pas de PDR, pas de templates, pas de projection, pas de rendu.
 */
abstract class Foundation<
  TCapabilities extends TFoundationCapabilities<TFoundationParams>
> {
  /** Reference a <body> -- toujours document.body */
  protected readonly body: HTMLElement;

  /** Reference a <html> -- toujours document.documentElement */
  protected readonly html: HTMLElement;

  /** Manifeste des capacites Channel (ADR-0024 value-first) */
  abstract get params(): TCapabilities;

  /**
   * Composers racines -- cles = selecteurs CSS dans <body>.
   *
   * Contrat different de View.composers() : les cles ne sont pas des
   * entrees uiElements (la Foundation n'a pas de TUIContract) mais des
   * selecteurs CSS resolus via document.body.querySelector().
   */
  abstract get composers(): Record<string, typeof Composer>;

  /** Cycle de vie */
  protected onAttach(): void; // apres resolution des Composers racines
  protected onDetach(): void; // au shutdown
}
```

> **Invariant I33** : la Foundation est **unique** par application.
> **Invariant I34** : le rootElement d'une View est forcement un enfant de `<body>`.
> **Invariant I67 (ADR-0038)** : Foundation est **structurellement stable** — son `get composers()` est evalue une seule fois au bootstrap et ne change jamais. Toute composition dynamique est deleguee a une View dediee (cf. §3.bis).

> ### Principe directeur (ADR-0038)
>
> **Foundation est le premier composant concret, mais elle est stable et persistante.
> Elle delegue le dynamisme aux Views.**
>
> Foundation est essentiellement un **layout statique** : `#header`, `#main`, `#footer`,
> eventuellement `#aside` ou `#dialog-root`. Sa structure DOM ne change pas en cours de
> vie applicative. Quand un cas de composition dynamique apparait, le pattern recommande
> est la **delegation a une View dediee** (cf. §3.bis).

---

## 2. Droits d'alteration DOM (N1)

La Foundation peut alterer `<html>` et `<body>` en **N1 uniquement** (D27) :

> **Exception a I39** : la Foundation accede a `this.html` et `this.body` directement,
> sans passer par `getUI(key)`. Ces propriétés sont fournies par le framework
> (pas un accès DOM brut) et limitees aux alterations N1 (attributs, classes).
> Cette exception est justifiee par D27 : la Foundation est le seul composant
> qui couvre `<html>`/`<body>`, qui ne sont dans le scope d'aucune View (I33).

```typescript
// Exemple : Foundation qui gere les classes globales
const appFoundationParams = {
  listen: [Theme.channel, Viewport.channel],
  trigger: [Viewport.channel],
  request: []
} as const satisfies TFoundationParams;

type TAppFoundationCapabilities = TFoundationCapabilities<
  typeof appFoundationParams
>;

class AppFoundation extends Foundation<TAppFoundationCapabilities> {
  get params() {
    return appFoundationParams;
  }

  get composers() {
    return {
      "#header-slot": HeaderComposer,
      "#main-slot": MainContentComposer,
      "#footer-slot": FooterComposer
    };
  }

  onThemeThemeChangedEvent(payload: { theme: "light" | "dark" }): void {
    // N1 : alteration d'attributs sur <html> -- autorise. Un seul attribut
    // data-* porte l'etat (pas de classe CSS pour un etat dynamique,
    // cf. convention data-* du framework) -- pas de classList.toggle("dark", ...).
    this.html.setAttribute("data-theme", payload.theme);
  }

  onViewportResizedEvent(payload: { width: number }): void {
    // N1 : etat dynamique via data-* sur <body> -- pas de classe CSS
    // ("is-mobile"/"is-tablet" seraient des classes d'etat, interdites).
    const breakpoint =
      payload.width < 768 ? "mobile" : payload.width < 1024 ? "tablet" : "desktop";
    this.body.setAttribute("data-breakpoint", breakpoint);
  }

  // Les handlers d'ecoute DOM globale sont des methodes liees a l'instance
  // (arrow function ou #field) pour etre reference-egales entre add/remove.
  #handleResize = (): void => {
    /* ... */
  };
  #handleVisibility = (): void => {
    /* ... */
  };

  onAttach(): void {
    // Ecoute DOM globale -- autorise. Public (pas protected) : signature
    // reelle de Foundation.onAttach() (packages/foundation/src/bonsai-foundation.ts).
    window.addEventListener("resize", this.#handleResize);
    document.addEventListener("visibilitychange", this.#handleVisibility);
  }

  onDetach(): void {
    window.removeEventListener("resize", this.#handleResize);
    document.removeEventListener("visibilitychange", this.#handleVisibility);
  }
}
```

---

## 3. Composers racines

Les clés de `get composers()` dans Foundation sont des **selecteurs CSS dans `<body>`** (D29).
Le framework résout chaque selecteur via `document.body.querySelector()` au bootstrap,
dans **l'ordre d'insertion des clés** (garanti par ECMAScript 2015+ §9.1.12).

> **Note sur le typage (ADR-0038)** : les clés sont des strings CSS non vérifiées au compile-time.
> C'est un choix pragmatique -- les selecteurs CSS ne sont pas types par TypeScript.
> Le type concret est `Readonly<Record<string, typeof Composer>>`. L'unicite des clés
> est garantie compile-time (TS1117 sur object literal). La validation de résolution DOM
> est **runtime** — mais pas par une vérification dédiée : `Composer.attach()` ne
> lève **jamais** d'erreur si le sélecteur ne résout à aucun élément de `<body>` ;
> il **crée** l'élément manquant et l'ajoute au DOM (D30, même mécanisme que pour
> le `rootElement` d'une View — voir §3 note ci-dessous et [composer.md](composer.md)).

```typescript
/** Type des composers racines de Foundation -- cles = selecteurs CSS (ADR-0038) */
type TFoundationComposers = Readonly<Record<string, typeof Composer>>;
```

```
Foundation(<body>)
  +-- '#header-slot'  -> HeaderComposer    -> HeaderView (#header-view)
  +-- '#main-slot'    -> MainContentComposer -> HomeView | ProductView | ...
  +-- '#footer-slot'  -> FooterComposer   -> FooterView (#footer-view)
```

> ⚠️ **Contredit la note ci-dessus dans les versions antérieures de ce document** —
> corrigé : si un sélecteur ne correspond à aucun élément dans `<body>`, le
> framework **ne jette pas d'erreur** et ne produit pas de warning ; il **crée**
> l'élément (D30, `Composer#createElementFromSelector`) et l'insère dans `<body>`.
> Il n'existe aucune distinction « mode strict » / « mode debug » livrée pour ce
> mécanisme.

---

## 3.bis Pattern delegation pour composition dynamique (ADR-0038 §6.3)

Quand l'application a besoin de composition dynamique macro (ex: changement de page,
swap de layout selon le role utilisateur), Foundation **n'evolue pas**. On utilise
le pattern de delegation :

> ⚠️ **Hors du périmètre couvert par le bandeau de tête (limité à §1-2)** :
> l'exemple ci-dessous utilise aussi des formes pré-ADR-0024/0040/0042 non
> livrées — `Foundation<TCapabilities>`/`Composer<TCapabilities>` génériques
> avec `get params()`, `View<THomePageCapabilities>` à générique unique
> (au lieu de `View<TViewContract>` + `implements TViewCallbacks`), et
> `this.request<TCurrentRoute>(Router.channel, "currentRoute")` (signature
> `request()` réelle : `request(token, name, params)`, sans generic de
> retour explicite — le retour est inféré du token). Illustre le **principe**
> de délégation (Foundation stable, dynamisme local à une View), pas une
> API à copier telle quelle.

```typescript
// -- Foundation reste minimale et stable -----------------------------------
class AppFoundation extends Foundation<TAppFoundationCapabilities> {
  get params() {
    return appFoundationParams;
  }
  get composers() {
    return {
      "#page": PageComposer // une seule entree, stable
    };
  }
}

// -- PageComposer choisit la View dynamiquement ----------------------------
class PageComposer extends Composer<TPageComposerCapabilities> {
  get params() {
    return pageComposerParams;
  }

  resolve(
    event: TComposerEvent<TPageComposerCapabilities["listen"]> | null
  ): TResolveResult | null {
    const route = this.request<TCurrentRoute>(Router.channel, "currentRoute");
    switch (route.page) {
      case "home":
        return { view: HomePageView, rootElement: ".PageView-root" };
      case "product":
        return { view: ProductPageView, rootElement: ".PageView-root" };
      case "admin":
        return { view: AdminPageView, rootElement: ".PageView-root" };
      default:
        return { view: NotFoundView, rootElement: ".PageView-root" };
    }
  }
}

// -- PageView gere sa propre composition interne via View.composers + PDR --
class HomePageView extends View<THomePageCapabilities> {
  get params() {
    return homePageParams;
  }
  get composers() {
    return {
      heroSlot: HeroComposer, // dynamique : ADR-0020 querySelectorAll
      productList: ProductListComposer
    };
  }
}
```

**Benefices** :

- Foundation reste **lisible en un coup d'oeil** comme un layout statique (I67)
- Le **dynamisme est local** a la View concernee, encapsule dans un sous-arbre DOM
- La **destruction en cascade** d'une View dynamique nettoie ses Composers/Views enfants (composer.md §5)
- Foundation ne re-render **jamais** -- pas de risque d'invalider l'ancrage des composants persistants

**Anti-pattern** -- Foundation conditionnelle :

```typescript
// FORBIDDEN -- viole I67 (stabilite Foundation)
class BadFoundation extends Foundation {
  get composers() {
    if (isAdminMode()) {
      return { "#header": AdminHeaderComposer, "#main": AdminMainComposer };
    }
    return { "#header": HeaderComposer, "#main": MainComposer };
  }
}
```

> **Pourquoi c'est interdit** : (1) viole I67 (stabilite), (2) `composers` est evalue
> une seule fois au bootstrap -- le `if` n'aura jamais d'effet après, (3) crée une
> fausse impression d'adaptabilite qui sera source de bugs. Si la decision depend
> d'un état applicatif, **deleguer** a une View qui peut, elle, re-render.

---

## 4. Relation avec Application

> ⚠️ **Diagramme cible ci-dessous, non conforme à l'ordre réellement livré**
> (`packages/foundation/src/bonsai-foundation.ts` `attach()`) — corrections :
> `foundation.onAttach()` est appelé **après** la résolution de tous les
> Composers racines, pas avant ; il n'y a pas de « câblage Channels »
> Foundation/Composer en strate 0 (cible strate 1, cf. bandeau de périmètre) ;
> chaque Composer est instancié via `new ComposerClass({ rootElement: selecteur })`
> (le sélecteur string, pas un élément déjà résolu) puis `instance.attach(body)`
> résout ou crée le slot lui-même ; il n'existe pas de `framework.attachView(...)` —
> c'est `Composer#attachNew()` (privé) qui appelle `view.mount(result.rootElement)`,
> `mount()` résolvant lui-même le sélecteur via `document.querySelector()` **global**
> (pas scopé au slot du Composer).

```
Application (bootstrap)
  |
  +-- Phases 0a-4 (cf. application.md) : manifest, Features, Channels, Entities
  |
  +-- Phase 4 : Creation Foundation
       |  body = document.body
       |  html = document.documentElement
       |  Pour chaque cle de get composers() (ordre d'insertion) :
       |    composer = new ComposerClass({ rootElement: selecteur })
       |    composer.attach(body)
       |      +-- Resout ou cree le slot (D30) dans body
       |      +-- resolve(null) -> ViewClass (ou null) -- bootstrap initial
       |      +-- Si ViewClass -> view.mount(result.rootElement)
       |           (resolution GLOBALE document.querySelector, pas scopee au slot)
       |  foundation.onAttach()   <- apres tous les Composers racines
       |
       +-- Application dormante (I23)
```

---

## Lecture suivante

-> [composer.md](composer.md) -- le décideur de composition
-> [2-architecture/lifecycle.md](../2-architecture/lifecycle.md) -- cycle de vie persistants vs volatils
