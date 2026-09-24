# Foundation -- Point d'ancrage unique sur body

> **Singleton persistant, écoute DOM globale, Composers racines, alteration N1 sur html/body**

[<- Retour couche concrete](README.md) | [<- Behavior](behavior.md) | [-> Composer](composer.md)

---

| Champ | Valeur |
| --- | --- |
| **Composant** | Foundation |
| **Couche** | Concrete (persistant -- exception) |
| **Statut** | Stable |
| **ADR** | [ADR-20](../../adr/ADR-20-foundation.md) (`<body>`, `Record` stable, N1), [ADR-07](../../adr/ADR-07-application-bootstrap.md) (phase 4) ; extensions : [roadmap](../../ROADMAP.md) |

---

> ## ⏳ Périmètre d'implémentation
>
> | Élément | État |
> | --- | --- |
> | `Foundation` sur `<body>`, `get composers()` (`Record` stable, ordre d'insertion), `attach()`, `protected html`/`body`, hooks `onAttach()`/`onDetach()` | ✅ strate 0 |
> | Appel de `onDetach()` au shutdown | ⏳ avec `Application.stop()` |
> | Capacités Channel (écouter, déclencher, interroger) | ⏳ strate 1 — **forme non tranchée** |
> | Restriction N1 sur `<html>`/`<body>` imposée par le type | ⏳ — aujourd'hui `html` et `body` sont des `HTMLElement` bruts (ADR-20) |
>
> Extensions envisagées (événements globaux déclarés, `readServerData`, `setTitle`…) : [roadmap](../../ROADMAP.md).

---

## Table des matieres

1. [Classe Foundation](#1-classe-foundation)
2. [Droits d'altération DOM (N1)](#2-droits-daltération-dom-n1)
3. [Composers racines](#3-composers-racines)
   3.bis [Pattern délégation pour composition dynamique](#3bis-pattern-délégation-pour-composition-dynamique-adr-20)
4. [Relation avec Application](#4-relation-avec-application)

---

## 1. Classe Foundation

La Foundation est le point d'ancrage **unique** de l'application dans le
document (I33). Elle cible `<body>` et couvre ce qu'aucune View ne peut viser :
`<html>` et `<body>` eux-mêmes (le `rootElement` d'une View est toujours un
descendant de `<body>`, I34). Elle est créée par `Application.start()` en phase 4.

```typescript
abstract class Foundation {
  /** <body> — altération N1 uniquement (ADR-20). */
  protected get body(): HTMLElement;
  /** <html> — altération N1 uniquement (ADR-20). */
  protected get html(): HTMLElement;

  /**
   * Composers racines : clé = sélecteur CSS dans <body>, valeur = classe Composer.
   * Évalué une seule fois, attaché dans l'ordre d'insertion des clés (I67).
   */
  abstract get composers(): Readonly<Record<string, typeof Composer>>;

  /** Instances créées par attach(). */
  get composerInstances(): readonly Composer[];

  /** Appelé par Application.start() — une seule fois (sinon erreur, I33). */
  attach(): void;

  /** Après l'attachement des Composers racines : écouteurs globaux, etc. */
  onAttach(): void;
  /** Au shutdown, symétrique de onAttach() — ⏳ jamais appelé aujourd'hui. */
  onDetach(): void;
}
```

Ni PDR, ni template, ni projection : la Foundation ne rend rien.

> **Principe directeur (ADR-20)** : la Foundation est **stable et persistante**
> (I67) ; elle délègue le dynamisme aux Views. Sa mise en page tient en 3 à 5
> zones (`#header-slot`, `#main-slot`, `#footer-slot`…). Pour une composition
> dynamique, déclarer une seule zone confiée à une View qui compose elle-même
> (§3.bis).

### 1.1 Capacités Channel

> ⏳ Non tranchées.

La Foundation devra pouvoir réagir à des Events (thème, viewport) et en
déclencher. La forme du contrat n'est pas décidée : probablement un module
`TFeatureContract` comme pour View et Composer (ADR-14, I83), mais rien
n'est acté. En attendant, aucune capacité Channel n'est disponible.

---

## 2. Droits d'altération DOM (N1)

La Foundation altère `<html>` et `<body>` en **N1 seulement** : attributs,
classes de rôle, `data-*` d'état. Elle y accède directement par `this.html` et
`this.body`, exception assumée à I39 (aucune View n'a ces éléments dans son
scope).

```typescript
class AppFoundation extends Foundation {
  get composers() {
    return {
      "#header-slot": HeaderComposer,
      "#main-slot": MainContentComposer,
      "#footer-slot": FooterComposer,
    } as const;
  }

  // Références stables pour add/removeEventListener.
  #handleResize = (): void => {
    const w = window.innerWidth;
    // État dynamique en data-*, jamais en classe CSS (« is-mobile » interdit).
    this.body.dataset.breakpoint = w < 768 ? "mobile" : w < 1024 ? "tablet" : "desktop";
  };

  onAttach(): void {
    window.addEventListener("resize", this.#handleResize);
    this.#handleResize();
  }

  onDetach(): void {
    window.removeEventListener("resize", this.#handleResize);
  }
}
```

---

## 3. Composers racines

Les clés de `get composers()` dans Foundation sont des **selecteurs CSS dans `<body>`** (ADR-20).
Le framework résout chaque selecteur via `document.body.querySelector()` au bootstrap,
dans **l'ordre d'insertion des clés** (garanti par ECMAScript 2015+ §9.1.12).

> **Note sur le typage (ADR-20)** : les clés sont des strings CSS non vérifiées au compile-time.
> C'est un choix pragmatique -- les selecteurs CSS ne sont pas types par TypeScript.
> Le type concret est `Readonly<Record<string, typeof Composer>>`. L'unicite des clés
> est garantie compile-time (TS1117 sur object literal). La validation de résolution DOM
> est **runtime** — mais pas par une vérification dédiée : `Composer.attach()` ne
> lève **jamais** d'erreur si le sélecteur ne résout à aucun élément de `<body>` ;
> il **crée** l'élément manquant et l'ajoute au DOM (ADR-19). Ce mécanisme ne vaut que
> pour le **slot** : le `rootElement` d'une View, lui, n'est pas créé s'il manque
> (voir [composer.md](composer.md) et [ADR-19](../../adr/ADR-19-root-element.md)).

```typescript
/** Type des composers racines de Foundation -- cles = selecteurs CSS (ADR-20) */
type TFoundationComposers = Readonly<Record<string, typeof Composer>>;
```

```text
Foundation(<body>)
  +-- '#header-slot'  -> HeaderComposer    -> HeaderView (#header-view)
  +-- '#main-slot'    -> MainContentComposer -> HomeView | ProductView | ...
  +-- '#footer-slot'  -> FooterComposer   -> FooterView (#footer-view)
```

> Si un sélecteur ne correspond à aucun élément de `<body>`, le framework
> **crée** l'élément (`Composer#createElementFromSelector`, ADR-19) et l'insère ;
> il n'y a ni erreur ni avertissement.
---

## 3.bis Pattern délégation pour composition dynamique (ADR-20)

Quand l'application a besoin de composition dynamique macro (ex: changement de page,
swap de layout selon le role utilisateur), Foundation **n'evolue pas**. On utilise
le pattern de delegation :

```typescript
// Foundation minimale et stable : une seule zone
class AppFoundation extends Foundation {
  get composers() {
    return { "#page-slot": PageComposer } as const;
  }
}

// PageComposer choisit la page selon la route (composer.md §2.3)
class PageComposer extends Composer<TPageContract> {
  get features() { return pageFeatures; }  // router: listens routeChanged, requests currentRoute

  resolve(event: TComposerEvent<TPageContract> | null): TResolveResult | null {
    const route = this.request("router:currentRoute", undefined);
    const root = ".PageView-root";
    switch (route?.page) {
      case "home":    return { view: HomePageView, rootElement: root };
      case "product": return { view: ProductPageView, rootElement: root };
      default:        return { view: NotFoundView, rootElement: root };
    }
  }
}

// La page gère sa composition interne par ses propres Composers ⏳ (View.composers)
class HomePageView extends View<THomePageContract> implements TViewCallbacks<THomePageContract> {
  get features()   { return homePageFeatures; }
  get uiEvents()   { return homePageUiEvents; }    // heroSlot, productList : ui<HTMLElement>()([])
  get uiElements() { return homePageUiElements; }
  get composers()  { return { heroSlot: HeroComposer, productList: ProductListComposer }; }
}
```

> Le routage de page (Router), `View.composers`, `Composer<TCC>`, `get features()`,
> `request()` et `TComposerEvent` sont des cibles (strates 1d et 2) : l'exemple illustre
> le **principe** de délégation. Aujourd'hui `Composer` n'est pas générique et son
> `resolve(event: unknown | null)` ne reçoit aucun Event.

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

Séquence réellement livrée (`Foundation.attach()`) :

```text
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
       |      +-- Resout ou cree le slot (ADR-19) dans body
       |      +-- resolve(null) -> ViewClass (ou null) -- bootstrap initial
       |      +-- Si ViewClass -> view.mount(result.rootElement)
       |           ⚠️ résolution par document.querySelector global, pas dans le slot (ADR-19)
       |  foundation.onAttach()   <- apres tous les Composers racines
       |
       +-- Application dormante (I23)
```

---

## Lecture suivante

-> [composer.md](composer.md) -- le décideur de composition
-> [2-architecture/lifecycle.md](../2-architecture/lifecycle.md) -- cycle de vie persistants vs volatils
