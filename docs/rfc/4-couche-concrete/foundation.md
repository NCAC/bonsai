# Foundation -- Point d'ancrage unique sur body

> **Singleton persistant, ecoute DOM globale, Composers racines, alteration N1 sur html/body**

[<- Retour couche concrete](README.md) | [<- Behavior](behavior.md) | [-> Composer](composer.md)

---

| Champ | Valeur |
|-------|--------|
| **Composant** | Foundation |
| **Couche** | Concrete (persistant -- exception) |
| **Source**    | Historique : RFC-0002-api-contrats-typage §11, ADR-0018 |
| **Statut** | Stable |
| **ADRs liees** | ADR-0010 (bootstrap order), ADR-0018 (Foundation contract) |

---

## Table des matieres

1. [Classe Foundation](#1-classe-foundation)
2. [Droits d'alteration DOM (N1)](#2-droits-dalteration-dom-n1)
3. [Composers racines](#3-composers-racines)
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
  readonly listen:  readonly TChannelDefinition[];
  readonly trigger: readonly TChannelDefinition[];
  readonly request: readonly TChannelDefinition[];
};

/**
 * TFoundationCapabilities -- type derive complet (ADR-0024 value-first).
 * Extrait les types narrow (tuples) depuis typeof params.
 */
type TFoundationCapabilities<TParams extends TFoundationParams> = {
  readonly listen:  TParams['listen'];
  readonly trigger: TParams['trigger'];
  readonly request: TParams['request'];
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
abstract class Foundation<TCapabilities extends TFoundationCapabilities<TFoundationParams>> {
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
  protected onAttach(): void;    // apres resolution des Composers racines
  protected onDetach(): void;    // au shutdown
}
```

> **Invariant I33** : la Foundation est **unique** par application.
> **Invariant I34** : le rootElement d'une View est forcement un enfant de `<body>`.

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
  listen:  [Theme.channel, Viewport.channel],
  trigger: [Viewport.channel],
  request: [],
} as const satisfies TFoundationParams;

type TAppFoundationCapabilities = TFoundationCapabilities<typeof appFoundationParams>;

class AppFoundation extends Foundation<TAppFoundationCapabilities> {
  get params() { return appFoundationParams; }

  get composers() {
    return {
      '#header-slot': HeaderComposer,
      '#main-slot':   MainContentComposer,
      '#footer-slot': FooterComposer,
    };
  }

  onThemeThemeChangedEvent(payload: { theme: 'light' | 'dark' }): void {
    // N1 : alteration d'attributs sur <html> -- autorise
    this.html.setAttribute('data-theme', payload.theme);
    this.html.classList.toggle('dark', payload.theme === 'dark');
  }

  onViewportResizedEvent(payload: { width: number }): void {
    // N1 : classes CSS sur <body> -- autorise
    this.body.classList.toggle('is-mobile', payload.width < 768);
    this.body.classList.toggle('is-tablet', payload.width >= 768 && payload.width < 1024);
  }

  protected onAttach(): void {
    // Ecoute DOM globale -- autorise
    window.addEventListener('resize', this.handleResize);
    document.addEventListener('visibilitychange', this.handleVisibility);
  }

  protected onDetach(): void {
    window.removeEventListener('resize', this.handleResize);
    document.removeEventListener('visibilitychange', this.handleVisibility);
  }
}
```

---

## 3. Composers racines

Les cles de `get composers()` dans Foundation sont des **selecteurs CSS dans `<body>`** (D29).
Le framework resout chaque selecteur via `document.body.querySelector()` au bootstrap.

> **Note sur le typage** : les cles sont des strings CSS non verifies au compile-time.
> C'est un choix pragmatique -- les selecteurs CSS ne sont pas types par TypeScript.
> Le type concret est `Record<string, typeof Composer>`. La validation est **runtime**
> (au bootstrap, le framework verifie que chaque selecteur resout un element dans `<body>`).

```typescript
/** Type des composers racines de Foundation -- cles = selecteurs CSS */
type TFoundationComposers = Record<string, typeof Composer>;
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
