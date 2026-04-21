# Foundation -- Point d'ancrage unique sur body

> **Singleton persistant, ecoute DOM globale, Composers racines, alteration N1 sur html/body**

[<- Retour couche concrete](README.md) | [<- Behavior](behavior.md) | [-> Composer](composer.md)

---

| Champ          | Valeur                                                                                                                                             |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Composant**  | Foundation                                                                                                                                         |
| **Couche**     | Concrete (persistant -- exception)                                                                                                                 |
| **Source**     | Historique : RFC-0002-api-contrats-typage §11, ADR-0018                                                                                            |
| **Statut**     | Stable                                                                                                                                             |
| **ADRs liees** | ADR-0010 (bootstrap order), ADR-0018 (Foundation contract), ADR-0028 (phasage strates), **ADR-0038 (Foundation.composers Record + I67 stabilite)** |

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
(dont le rootElement est forcement un enfant de `<body>`, jamais `<body>` lui-meme).

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
   * entrees TUIMap (la Foundation n'a pas de TUIMap) mais des
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
> sans passer par `getUI(key)`. Ces proprietes sont fournies par le framework
> (pas un acces DOM brut) et limitees aux alterations N1 (attributs, classes).
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
    // N1 : alteration d'attributs sur <html> -- autorise
    this.html.setAttribute("data-theme", payload.theme);
    this.html.classList.toggle("dark", payload.theme === "dark");
  }

  onViewportResizedEvent(payload: { width: number }): void {
    // N1 : classes CSS sur <body> -- autorise
    this.body.classList.toggle("is-mobile", payload.width < 768);
    this.body.classList.toggle(
      "is-tablet",
      payload.width >= 768 && payload.width < 1024
    );
  }

  protected onAttach(): void {
    // Ecoute DOM globale -- autorise
    window.addEventListener("resize", this.handleResize);
    document.addEventListener("visibilitychange", this.handleVisibility);
  }

  protected onDetach(): void {
    window.removeEventListener("resize", this.handleResize);
    document.removeEventListener("visibilitychange", this.handleVisibility);
  }
}
```

---

## 3. Composers racines

Les cles de `get composers()` dans Foundation sont des **selecteurs CSS dans `<body>`** (D29).
Le framework resout chaque selecteur via `document.body.querySelector()` au bootstrap,
dans **l'ordre d'insertion des cles** (garanti par ECMAScript 2015+ §9.1.12).

> **Note sur le typage (ADR-0038)** : les cles sont des strings CSS non verifies au compile-time.
> C'est un choix pragmatique -- les selecteurs CSS ne sont pas types par TypeScript.
> Le type concret est `Readonly<Record<string, typeof Composer>>`. L'unicite des cles
> est garantie compile-time (TS1117 sur object literal). La validation de resolution DOM
> est **runtime** (au bootstrap, le framework verifie que chaque selecteur resout un
> unique element dans `<body>` ; sinon, throw).

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

> Si un selecteur ne correspond a aucun element dans `<body>`, le framework
> jette une erreur au bootstrap (mode strict) ou un warning (mode debug).

---

## 3.bis Pattern delegation pour composition dynamique (ADR-0038 §6.3)

Quand l'application a besoin de composition dynamique macro (ex: changement de page,
swap de layout selon le role utilisateur), Foundation **n'evolue pas**. On utilise
le pattern de delegation :

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
- La **destruction en cascade** d'une View dynamique nettoie ses Composers/Views enfants (composer.md \u00a75)
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
> une seule fois au bootstrap -- le `if` n'aura jamais d'effet apres, (3) cree une
> fausse impression d'adaptabilite qui sera source de bugs. Si la decision depend
> d'un etat applicatif, **deleguer** a une View qui peut, elle, re-render.

---

## 4. Relation avec Application

```
Application (bootstrap)
  |
  +-- 1-5. Couche abstraite (Features, Channels, Entities, Router)
  |
  +-- 6. Creation Foundation
       |  body = document.body
       |  html = document.documentElement
       |  Cablage Channels Foundation
       |  Resolution composers racines
       |  foundation.onAttach()
       |
       +-- 7. Pour chaque Composer racine :
            |  slotEl = body.querySelector(selecteur)
            |  composer = new ComposerClass(slotEl)
            |  Cablage Channels Composer
            |  composer.resolve() -> ViewClass (ou null)
            |  Si ViewClass -> framework.attachView(ViewClass, slotEl)
            |     +-- Resolution recursive des Composers de la View
            |
       +-- 8. Application dormante
```

---

## Lecture suivante

-> [composer.md](composer.md) -- le decideur de composition
-> [2-architecture/lifecycle.md](../2-architecture/lifecycle.md) -- cycle de vie persistants vs volatils
