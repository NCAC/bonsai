# ADR-0026 : `rootElement` — sélecteur CSS unique, fourni exclusivement par le Composer, parseable en descripteur de création

> **Le `rootElement` est toujours un sélecteur CSS `string`, jamais un `Element`.
> Il est fourni par le Composer via `TResolveResult`, pas par la View via `params`.
> Si l'élément n'existe pas dans le slot, le framework le crée en parsant le sélecteur.**

| Champ | Valeur |
|-------|--------|
| **Statut** | 🟢 Accepted |
| **Date** | 2026-04-07 |
| **Décideurs** | @ncac |
| **RFC liée** | [composer.md](../rfc/4-couche-concrete/composer.md), [view.md](../rfc/4-couche-concrete/view.md), [foundation.md](../rfc/4-couche-concrete/foundation.md) |
| **Invariants impactés** | I31 (reformulé), I32 (inchangé), I34 (inchangé), I35 (simplifié) |
| **Décisions impactées** | D30 (reformulé), D34 (reformulé) |
| **ADRs liées** | [ADR-0014](ADR-0014-ssr-hydration-strategy.md) (SSR/hydratation), [ADR-0020](ADR-0020-composers-n-instances-composition-heterogene.md) (N-instances — §6.2 amendé) |
| **Amende** | ADR-0020 §6.2 (`rootElement: Element \| string` → `rootElement: string`) |

> ### Statut normatif
> Ce document est **normatif** pour le contrat du `rootElement` dans `TResolveResult` et `TViewParams`.
> Il amende ADR-0020 §6.2 sur le type de `rootElement`.
> En cas de divergence avec les documents antérieurs, **ce document prévaut**.

---

## 📋 Table des matières

1. [Contexte](#contexte)
2. [Contraintes](#contraintes)
3. [Options considérées](#options-considérées)
4. [Analyse comparative](#analyse-comparative)
5. [Décision](#décision)
6. [Spécifications normatives](#spécifications-normatives)
   - [6.1 Le sélecteur CSS comme descripteur de création](#61-le-sélecteur-css-comme-descripteur-de-création)
   - [6.2 `TResolveResult` révisé](#62-tresolveresult-révisé)
   - [6.3 `TViewParams` révisé — retrait de `rootElement`](#63-tviewparams-révisé--retrait-de-rootelement)
   - [6.4 Algorithme de résolution du rootElement par le framework](#64-algorithme-de-résolution-du-rootelement-par-le-framework)
   - [6.5 Grammaire des sélecteurs supportés](#65-grammaire-des-sélecteurs-supportés)
7. [Exemples normatifs](#exemples-normatifs)
8. [Impact sur les invariants et décisions](#impact-sur-les-invariants-et-décisions)
9. [Conséquences](#conséquences)
10. [Actions de suivi](#actions-de-suivi)
11. [Historique](#historique)

---

## Contexte

### Trois problèmes liés

#### Problème 1 — Le type `Element | string` de `rootElement` n'est plus justifié

L'ADR-0020 §6.2 a introduit `rootElement: Element | string` pour le cas du Composer dynamique
(N-instances, CDH) où le Composer résout lui-même l'élément via `this.slot.querySelector(...)` :

```typescript
// ADR-0020 — cas justifiant rootElement: Element
resolve(): TResolveResult[] {
  const editors = this.slot.querySelectorAll('[data-field-type="editorjs"]');
  return Array.from(editors).map(el => ({
    view: EditorJsView,
    rootElement: el,  // ← Element
  }));
}
```

Mais ce cas **n'existe plus** dans le modèle final N-instances (ADR-0020 §6.1) :
c'est la **View parente** qui déclare des slots multiples via `querySelectorAll` dans
`get composers()`, et le **framework** instancie N Composers — un par élément matché.
Chaque Composer reçoit un `slot` unique. Il n'a qu'à retourner un sélecteur CSS relatif.

Le cas `rootElement: Element` était un vestige d'un design intermédiaire.

#### Problème 2 — La dualité `rootElement` (params vs TResolveResult)

Le `rootElement` apparaît à deux endroits :

1. **`TResolveResult.rootElement`** — le Composer dit « monte la View ici »
2. **`view.params.rootElement`** — la View dit « je suis normalement montée ici »

Qui gagne ? La séquence d'attachement utilise `TResolveResult.rootElement`.
Le `params.rootElement` n'est jamais lu par le framework. Pourtant il est dans `TViewParams`,
et le développeur doit le déclarer dans `get params()`.

Or, une View n'est **jamais** instanciée « toute seule » — elle est toujours créée par un Composer (D21).
C'est le Composer qui décide **où** la View est montée. La View n'a pas à connaître son point de montage :

- La View connaît ses `uiElements` (ses nœuds internes) ✅
- La View connaît ses `templates` (comment projeter) ✅
- La View **ne sait pas** où elle sera montée ← c'est le rôle du Composer

Le `rootElement` dans `params` est un vestige de l'idée que la View « se connaît elle-même ».

#### Problème 3 — Le « descripteur objet » (D30) fantôme

La séquence d'attachement (`composer.md` §4.1, étape 4b-ii) mentionne un « descripteur objet »
pour créer des éléments en mode SPA. Mais aucun type `TElementDescriptor` n'a jamais été défini.
Le type `TResolveResult.rootElement` est `Element | string` — pas de troisième forme.

Le code illustratif dans ADR-0014 montre `isElementDescriptor(resolvedParams.rootElement)`,
mais ce type n'existe nulle part dans le corpus.

### La solution unifiée

Un **sélecteur CSS simple** est parseable de manière déterministe et peut servir **à la fois** de :
- **Requête de recherche** (`slot.querySelector(selector)`) en mode SSR/hydratation
- **Descripteur de création** (parser le sélecteur → `createElement` + classes/id/attributs) en mode SPA

Le sélecteur **est** le descripteur. Pas besoin de type supplémentaire.

---

## Contraintes

| # | Contrainte | Justification |
|---|-----------|---------------|
| **C1** | **D21** — Le Composer est le seul décideur d'instanciation | Il décide quelle View instancier **et où** |
| **C2** | **I35** — Le Composer ne crée pas d'éléments DOM | C'est le framework qui crée, pas le Composer |
| **C3** | **I36** — La View ne compose pas | La View ne connaît pas son point de montage, ne crée pas son rootElement |
| **C4** | **Pas de « SSR-first »** — Bonsai supporte SSR, SPA et hybride (îlots SPA dans page SSR) | Le mécanisme de rootElement doit couvrir tous les cas uniformément |
| **C5** | **I31** — Au `onAttach()`, la View DOIT avoir un `el` existant | Garanti par le framework qui résout ou crée l'élément |
| **C6** | **Sélecteurs simples uniquement** — Un rootElement est un seul nœud DOM | Les combinateurs CSS (` `, `>`, `+`, `~`) n'ont pas de sens pour créer un élément |

---

## Options considérées

### Option A — Garder `Element | string` et le « descripteur objet »

**Description** : conserver le type actuel. Définir un type `TElementDescriptor` pour le cas SPA.
Garder `rootElement` dans `TViewParams` comme défaut.

```typescript
type TElementDescriptor = {
  readonly tag: keyof HTMLElementTagNameMap;
  readonly className?: string;
  readonly id?: string;
  readonly attributes?: Record<string, string>;
};

type TResolveResult<V extends typeof View = typeof View> = {
  readonly view: V;
  readonly rootElement: Element | string | TElementDescriptor;
  readonly options?: Partial<ExtractViewParams<V>>;
};
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Maximum de flexibilité | - 3 types pour la même chose — complexité API |
| + Le Composer peut passer un Element résolu | - Le cas `Element` n'a plus de justification post-ADR-0020 §6.1 |
| | - `TElementDescriptor` est un nouveau type à apprendre |
| | - Dualité `params.rootElement` vs `TResolveResult.rootElement` non résolue |
| | - Le développeur doit déclarer `rootElement` dans `get params()` alors que le Composer le fournit |

---

### Option B — `string` uniquement, fourni par le Composer, avec parsing CSS

**Description** : `rootElement` est toujours un `string` (sélecteur CSS simple).
Il est fourni **exclusivement** dans `TResolveResult` par le Composer.
Il est retiré de `TViewParams`. Le framework le résout (querySelector) ou le crée
(parsing du sélecteur) automatiquement.

```typescript
type TResolveResult<V extends typeof View = typeof View> = {
  readonly view: V;
  readonly rootElement: string;    // sélecteur CSS simple — résolu ou créé par le framework
  readonly options?: Partial<ExtractViewParams<V>>;
};

type TViewParams<TUI extends TUIMap<any>> = {
  uiElements: TUIElements<TUI>;   // plus de rootElement ici
};
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Un seul type, un seul fournisseur — clarté maximale | - Perte du cas `Element` (le Composer ne peut plus passer un nœud résolu) |
| + Élimine la dualité params/TResolveResult | - Limite aux sélecteurs CSS simples (pas de combinateurs pour la création) |
| + Le sélecteur est le descripteur — pas de type supplémentaire | - La même View utilisée par 2 Composers → chacun doit spécifier le rootElement |
| + Cohérent avec D21 : le Composer décide de tout | |
| + `TViewParams` plus léger — la View ne connaît que ses nœuds internes | |
| + La même View peut être montée à des endroits différents sans hack | |
| + SSR, SPA et hybride couverts uniformément | |

---

### Option C — `string` uniquement, mais garder `rootElement` dans `params` comme défaut

**Description** : comme Option B pour le type (`string` only), mais garder
`rootElement` dans `TViewParams` comme valeur par défaut que le Composer peut overrider.

```typescript
type TResolveResult<V extends typeof View = typeof View> = {
  readonly view: V;
  readonly rootElement?: string;   // optionnel — fallback sur view.params.rootElement
  readonly options?: Partial<ExtractViewParams<V>>;
};
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Confort DX — le Composer peut omettre rootElement si la View a un défaut | - Maintient la dualité (qui gagne ?) |
| + Rétrocompatible avec le code existant | - `rootElement` reste dans `TViewParams` — la View « connaît » son point de montage |
| | - Incohérent avec D21 : si le Composer décide, pourquoi la View a-t-elle un défaut ? |
| | - Le framework doit gérer le fallback — complexité interne |

---

## Analyse comparative

| Critère | Option A (Element + descriptor) | Option B (string only, Composer) | Option C (string, défaut View) |
|---------|--------------------------------|----------------------------------|-------------------------------|
| **Simplicité API** | ⭐ | ⭐⭐⭐ | ⭐⭐ |
| **Cohérence avec D21** | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| **Pas de dualité** | ⭐ | ⭐⭐⭐ | ⭐ |
| **Couverture SSR/SPA/hybride** | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| **DX Composer** | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| **DX View** | ⭐⭐ | ⭐⭐⭐ (moins de boilerplate) | ⭐⭐ |
| **Prévention anti-patterns** | ⭐ | ⭐⭐⭐ | ⭐⭐ |
| **Type-safety** | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ |

---

## Décision

Nous choisissons **Option B — `string` uniquement, fourni exclusivement par le Composer, avec parsing CSS** parce que :

1. **Le Composer est l'unique décideur** (D21) — il décide quelle View instancier et **où**. Le « où » (`rootElement`) doit être dans `TResolveResult`, pas dans `TViewParams`.

2. **Le cas `Element` n'a plus de justification** — post-ADR-0020 §6.1 (N-instances via `querySelectorAll`), chaque Composer a un slot unique. Il n'a plus besoin de résoudre lui-même un élément DOM.

3. **Le sélecteur CSS est le descripteur de création** — un sélecteur simple est parseable de manière déterministe. `".Cart-root"` → `<div class="Cart-root">`, `"form#LoginForm"` → `<form id="LoginForm">`. Pas besoin d'un type `TElementDescriptor` séparé.

4. **Élimine la dualité** — plus de question « qui gagne entre `params.rootElement` et `TResolveResult.rootElement` ». Il n'y a qu'une source : le Composer.

5. **Bonsai n'est pas « SSR-first »** — il supporte SSR, SPA et hybride (îlots SPA dans page SSR). Le mécanisme de rootElement (querySelector → trouvé → réutiliser ; non trouvé → parser → créer) couvre les trois cas uniformément.

6. **La même View dans des contextes différents** — un `CartView` peut être monté dans `'.Cart-root'` (page panier), `'.CartMini-root'` (sidebar), ou `'aside.CartWidget[data-variant="compact"]'` (widget) par des Composers différents. Sans `rootElement` dans `params`, c'est naturel.

L'Option A est rejetée car elle maintient la complexité (`Element | string | descriptor`) sans bénéfice.

L'Option C est rejetée car le « défaut View » crée une fausse symétrie : si le Composer décide toujours, le défaut n'est jamais utilisé par le framework — c'est du code mort dans `params`.

---

## Spécifications normatives

### 6.1 Le sélecteur CSS comme descripteur de création

Un sélecteur CSS simple encode de manière lisible et déterministe **toutes les informations
nécessaires pour créer un élément DOM** :

| Sélecteur | Tag résolu | Classes | Id | Attributs | Élément créé |
|-----------|------------|---------|-----|-----------|-------------|
| `.Cart-root` | `div` (défaut) | `Cart-root` | — | — | `<div class="Cart-root">` |
| `section.HomePage-root` | `section` | `HomePage-root` | — | — | `<section class="HomePage-root">` |
| `form#LoginForm` | `form` | — | `LoginForm` | — | `<form id="LoginForm">` |
| `section.ProductPage.dark` | `section` | `ProductPage dark` | — | — | `<section class="ProductPage dark">` |
| `ul.ItemList[data-type="products"]` | `ul` | `ItemList` | — | `data-type="products"` | `<ul class="ItemList" data-type="products">` |
| `div#app[role="main"]` | `div` | — | `app` | `role="main"` | `<div id="app" role="main">` |
| `nav.MainNav[aria-label="Principal"]` | `nav` | `MainNav` | — | `aria-label="Principal"` | `<nav class="MainNav" aria-label="Principal">` |

**Règle de tag par défaut** : si le sélecteur ne commence pas par un nom de tag,
le framework utilise `div`. C'est le comportement le plus courant et le plus prévisible.

---

### 6.2 `TResolveResult` révisé

```typescript
/**
 * Résultat d'une résolution Composer (ADR-0026).
 *
 * rootElement est TOUJOURS un string (sélecteur CSS simple).
 * Le framework le résout dans le slot :
 * - querySelector(rootElement) trouvé → réutilise l'élément (SSR/hydratation)
 * - Non trouvé → parse le sélecteur et CRÉE l'élément (SPA, D30 révisé)
 *
 * Le rootElement est fourni EXCLUSIVEMENT par le Composer.
 * La View ne déclare plus de rootElement dans ses params.
 *
 * @param view        Constructeur de la View à instancier
 * @param rootElement Sélecteur CSS simple — résolu ou créé par le framework.
 *                    Sélecteurs simples uniquement (tag, .class, #id, [attr=val]).
 *                    Combinateurs (espace, >, +, ~) et pseudo-classes INTERDITS.
 * @param options     Override partiel des params de la View (D34 révisé)
 */
type TResolveResult<V extends typeof View = typeof View> = {
  readonly view: V;
  readonly rootElement: string;
  readonly options?: Partial<ExtractViewParams<V>>;
};
```

---

### 6.3 `TViewParams` révisé — retrait de `rootElement`

```typescript
/**
 * Params de base que TOUTE View doit déclarer dans get params() (ADR-0026).
 *
 * rootElement a été RETIRÉ — c'est le Composer qui le fournit.
 * La View ne connaît que ses nœuds internes (uiElements).
 *
 * TParams peut être étendu avec des params custom (primitives uniquement :
 * string, boolean, number) — le Composer peut les overrider via options (D34).
 */
type TViewParams<TUI extends TUIMap<any>> = {
  uiElements: TUIElements<TUI>;
};
```

La View ne déclare plus `rootElement` :

```typescript
// AVANT (pré-ADR-0026)
class CartView extends View<[Cart.Channel], TCartViewUI> {
  get params() {
    return {
      rootElement: '#cart-view',           // ← déclaré par la View
      uiElements: {
        addButton: '.Cart-addButton',
        totalDisplay: '.Cart-totalDisplay',
      },
    };
  }
}

// APRÈS (ADR-0026)
class CartView extends View<[Cart.Channel], TCartViewUI> {
  get params() {
    return {
      uiElements: {                        // ← seulement les nœuds internes
        addButton: '.Cart-addButton',
        totalDisplay: '.Cart-totalDisplay',
      },
    };
  }
}
```

---

### 6.4 Algorithme de résolution du rootElement par le framework

Le framework exécute la résolution **après** `Composer.resolve()`, dans la séquence d'attachement :

```typescript
// INTERNE FRAMEWORK — pseudo-code normatif
function resolveRootElement(
  slot: HTMLElement,
  rootElementSelector: string,
): HTMLElement {
  // 1. Tenter querySelector dans le slot
  const existing = slot.querySelector(rootElementSelector);

  if (existing) {
    // ── Mode SSR / hydratation : l'élément préexiste ──
    return existing as HTMLElement;
  }

  // 2. Parser le sélecteur et créer l'élément (D30 révisé)
  const descriptor = parseCSSSelector(rootElementSelector);

  if (descriptor === null) {
    // Sélecteur non parseable (combinateurs, pseudo-classes)
    throw new BonsaiError(
      `D30: rootElement "${rootElementSelector}" not found in slot and cannot be ` +
      `parsed as a simple CSS selector for element creation. ` +
      `Only simple selectors (tag, .class, #id, [attr=val]) are supported.`
    );
  }

  // ── Mode SPA : créer l'élément ──
  const el = document.createElement(descriptor.tag);

  for (const cls of descriptor.classes) {
    el.classList.add(cls);
  }

  if (descriptor.id) {
    el.id = descriptor.id;
  }

  for (const [name, value] of Object.entries(descriptor.attributes)) {
    el.setAttribute(name, value);
  }

  slot.appendChild(el);
  return el;
}
```

```typescript
// INTERNE FRAMEWORK — parser de sélecteur CSS simple
type TParsedSelector = {
  tag: string;                        // 'div' par défaut si absent
  classes: string[];                  // .foo.bar → ['foo', 'bar']
  id: string | null;                  // #baz → 'baz'
  attributes: Record<string, string>; // [data-x="y"] → { 'data-x': 'y' }
};

function parseCSSSelector(selector: string): TParsedSelector | null {
  // Rejeter les combinateurs et pseudo-classes
  if (/[\s>+~:]/.test(selector)) {
    return null;
  }

  // Parser tag, .class, #id, [attr=val]
  const tag = selector.match(/^([a-zA-Z][a-zA-Z0-9]*)/)?.[1] ?? 'div';
  const classes = [...selector.matchAll(/\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g)].map(m => m[1]);
  const id = selector.match(/#([a-zA-Z_-][a-zA-Z0-9_-]*)/)?.[1] ?? null;
  const attributes: Record<string, string> = {};
  for (const m of selector.matchAll(/\[([a-zA-Z_-][a-zA-Z0-9_-]*)="([^"]*)"\]/g)) {
    attributes[m[1]] = m[2];
  }

  return { tag, classes, id, attributes };
}
```

### Séquence d'attachement révisée (remplace `composer.md` §4.1, étapes 3–5)

```
1. Composer.resolve() → { view: ViewClass, rootElement: selectorString, options? }
   --- le framework prend le relais ---
2. view = new ViewClass()
3. Framework merge les params : resolvedParams = { ...view.params, ...options }
   (shallow merge — les clés de options écrasent celles de params)
   NOTE : rootElement N'EST PAS dans params. Il vient de TResolveResult.
4. Framework résout rootElement dans le slot :
   4a. slot.querySelector(rootElement) → TROUVÉ
       → el = élément existant (mode SSR/hydratation)
   4b. slot.querySelector(rootElement) → NON TROUVÉ
       → Framework parse le sélecteur CSS
       → Si parseable (simple) → crée l'élément, l'insère dans le slot (D30 révisé)
       → Si non parseable (combinateurs, pseudo-classes) → ERREUR
5. view.el = el
6. [suite inchangée — uiElements, templates, composers, uiEvents, handlers, onAttach]
```

---

### 6.5 Grammaire des sélecteurs supportés

```
rootElement := simpleSelector
simpleSelector := tag? ( classSelector | idSelector | attrSelector )*

tag           := [a-zA-Z][a-zA-Z0-9]*          ex: div, form, section, ul, nav
classSelector := '.' className                   ex: .Cart-root
idSelector    := '#' idName                      ex: #login-form
attrSelector  := '[' attrName '="' attrValue '"]'  ex: [data-type="products"]
className     := [a-zA-Z_-][a-zA-Z0-9_-]*
idName        := [a-zA-Z_-][a-zA-Z0-9_-]*
attrName      := [a-zA-Z_-][a-zA-Z0-9_-]*
attrValue     := [^"]*                           (tout sauf ")
```

**Interdit** (entraîne une erreur si non trouvé par querySelector) :
- Combinateur descendant : `div .child`
- Combinateur enfant direct : `div > .child`
- Combinateur de frère adjacent : `div + .sibling`
- Combinateur de frère général : `div ~ .sibling`
- Pseudo-classes : `:first-child`, `:not()`, `:nth-child()`
- Pseudo-éléments : `::before`, `::after`

> **Note** : ces sélecteurs complexes **fonctionnent** pour le querySelector (mode SSR),
> mais ne sont pas parseables pour la création. Le framework rejette la création uniquement —
> si l'élément est trouvé par querySelector, tout sélecteur est accepté.

---

## Exemples normatifs

### Exemple 1 — Routeur de page (hybride SSR + SPA)

```typescript
class MainContentComposer extends Composer {
  static readonly listen = [Router.channel] as const;

  private currentRoute: { page: string } | null = null;

  resolve(): TResolveResult | null {
    switch (this.currentRoute?.page) {
      // SSR : <section class="HomePage-root"> existe dans le HTML serveur → réutilisé
      case 'home':
        return { view: HomeView, rootElement: 'section.HomePage-root' };

      // SSR : <div class="ProductPage-root"> existe → réutilisé
      case 'product':
        return { view: ProductView, rootElement: 'div.ProductPage-root' };

      // SPA : <div class="CartPage-root"> N'EXISTE PAS dans le HTML serveur
      // → le framework parse le sélecteur et crée <div class="CartPage-root">
      case 'cart':
        return { view: CartView, rootElement: 'div.CartPage-root' };

      default:
        return null; // slot vide
    }
  }

  onRouterRouteChangedEvent(payload: { page: string }): void {
    this.currentRoute = payload;
  }
}
```

### Exemple 2 — Formulaire avec élément sémantique (SPA pur)

```typescript
class LoginComposer extends Composer {
  resolve(): TResolveResult {
    // Le framework crée : <form id="LoginForm" class="LoginForm">
    return {
      view: LoginFormView,
      rootElement: 'form#LoginForm.LoginForm',
    };
  }
}
```

### Exemple 3 — Widget avec attributs data (hybride)

```typescript
class WidgetComposer extends Composer {
  static readonly listen = [Dashboard.channel] as const;

  private widgetType: string = 'chart';

  resolve(): TResolveResult {
    // SSR : <div class="Widget-root" data-widget="chart"> peut exister
    // SPA : sinon, le framework crée <div class="Widget-root" data-widget="chart">
    return {
      view: WidgetView,
      rootElement: `div.Widget-root[data-widget="${this.widgetType}"]`,
    };
  }
}
```

### Exemple 4 — La même View dans des contextes différents

```typescript
// CartView ne déclare PLUS de rootElement — juste ses nœuds internes
class CartView extends View<[Cart.Channel], TCartViewUI> {
  get params() {
    return {
      uiElements: {
        addButton: '.Cart-addButton',
        totalDisplay: '.Cart-totalDisplay',
        itemList: '.Cart-itemList',
      },
    };
  }
}

// Composer 1 : CartView en pleine page
class CartPageComposer extends Composer {
  resolve() {
    return { view: CartView, rootElement: 'div.CartPage-root' };
  }
}

// Composer 2 : CartView en sidebar (même View, rootElement différent)
class CartSidebarComposer extends Composer {
  resolve() {
    return { view: CartView, rootElement: 'aside.CartSidebar-root' };
  }
}

// Composer 3 : CartView en widget compact avec attribut
class CartWidgetComposer extends Composer {
  resolve() {
    return {
      view: CartView,
      rootElement: 'div.CartWidget[data-variant="compact"]',
      options: { /* params custom overridés si besoin */ },
    };
  }
}
```

### Exemple 5 — Foundation (inchangée)

```typescript
// Foundation n'est pas impactée — ses clés de composers() sont des sélecteurs CSS
// qui servent de résolution de slot, pas de rootElement.
class AppFoundation extends Foundation {
  get composers() {
    return {
      '#header-slot':  HeaderComposer,
      '#main-slot':    MainContentComposer,
      '#footer-slot':  FooterComposer,
    };
  }
}
```

---

## Impact sur les invariants et décisions

| Élément | Avant | Après | Nature du changement |
|---------|-------|-------|---------------------|
| **I31** | « Le rootElement DOIT exister au onAttach(). Si absent et descripteur objet → création (D30) » | « Au onAttach(), la View DOIT avoir un `el` existant. L'élément est résolu (querySelector) ou créé (parsing du sélecteur CSS) par le framework à partir du rootElement fourni par le Composer » | Reformulé — le mécanisme change, la garantie reste |
| **I32** | Inchangé | Inchangé | — |
| **I34** | Inchangé | Inchangé | — |
| **I35** | « Lecture du scope autorisée pour résoudre le rootElement de la child View (ADR-0020) » | « Le Composer est un décideur pur avec capacité de lecture. Il ne résout plus le rootElement en Element — il fournit un sélecteur CSS et le framework résout. » | Simplifié — la lecture reste autorisée mais n'est plus nécessaire pour le rootElement |
| **D30** | « Si l'élément n'existe pas et qu'un descripteur objet est fourni, le framework crée l'élément » | « Si l'élément n'existe pas dans le slot, le framework parse le sélecteur CSS et crée l'élément correspondant. Seuls les sélecteurs simples sont supportés pour la création » | Reformulé — le sélecteur remplace le descripteur objet |
| **D34** | « La View déclare rootElement + uiElements dans params, le Composer override via options » | « La View déclare uiElements (+ params custom) dans params. Le Composer fournit le rootElement via TResolveResult et peut overrider les params via options » | Reformulé — rootElement sort de params |
| **ADR-0020 §6.2** | `rootElement: Element \| string` | `rootElement: string` | Amendé par ce document |
| **ADR-0014** | Pseudo-code avec `isElementDescriptor()` | Simplifié : querySelector → trouvé ? réutiliser : parser + créer | Impacté — le pseudo-code doit être mis à jour |

---

## Conséquences

### Positives

- ✅ **Un seul type, un seul fournisseur** — `rootElement: string`, fourni par le Composer. Zéro ambiguïté.
- ✅ **Élimine le « descripteur objet » fantôme** — le sélecteur CSS est le descripteur. Pas de nouveau type.
- ✅ **La même View dans N contextes** — naturel sans hack (Exemple 4).
- ✅ **SSR, SPA, hybride couverts uniformément** — querySelector trouvé → SSR ; non trouvé → créer.
- ✅ **Cohérent avec D21** — le Composer décide du « où », la View s'occupe du « quoi ».
- ✅ **`TViewParams` allégé** — la View ne déclare que ses nœuds internes.
- ✅ **DX IntelliSense** — `rootElement` est `string` dans `TResolveResult`, pas d'union complexe.
- ✅ **Sélecteurs expressifs** — `form#LoginForm.LoginForm`, `ul.ItemList[data-type="products"]`, etc.

### Négatives (acceptées)

- ⚠️ **Le Composer doit toujours spécifier rootElement** — plus de « défaut de la View ». Accepté car c'est son rôle (D21) et le rootElement est rarement omis en pratique.
- ⚠️ **Sélecteurs simples uniquement pour la création** — les combinateurs ne sont pas supportés. Accepté car un rootElement est un seul élément, pas un arbre.
- ⚠️ **Parsing CSS côté framework** — le framework doit implémenter un parser de sélecteurs simples. Accepté car c'est un parser trivial (~30 lignes, regex bien définie, §6.4).

### Risques identifiés

- 🔶 **Sélecteur ambigu** — `.Cart-root` matche le premier élément trouvé par querySelector. Si le slot contient plusieurs `.Cart-root`, le framework prend le premier. Mitigation : le slot est un scope contraint (pas tout le document), et I31 vérifie l'existence.
- 🔶 **Sélecteur invalide** — un développeur passe un sélecteur malformé. Mitigation : le framework valide au bootstrap et jette une erreur explicite.

---

## Actions de suivi

- [ ] Mettre à jour `composer.md` §1 — `TResolveResult.rootElement: string` (plus de `Element`)
- [ ] Mettre à jour `composer.md` §4.1 — séquence d'attachement révisée (§6.4 de ce document)
- [ ] Mettre à jour `view.md` §1 — retirer `rootElement` de `TViewParams`, retirer de `get params()`
- [ ] Mettre à jour `view.md` §4.1, §4.8 — aligner le flux avec la nouvelle séquence
- [ ] Mettre à jour `types-index.md` — `TViewParams` (sans rootElement), `TResolveResult` (string only)
- [ ] Mettre à jour `invariants.md` — I31 reformulé, I35 simplifié, D30 reformulé, D34 reformulé
- [ ] Mettre à jour `reference/decisions.md` — D30 et D34
- [ ] Vérifier ADR-0014 — retirer le pseudo-code `isElementDescriptor()`, aligner avec le nouvel algorithme
- [ ] Vérifier ADR-0020 §6.2 — noter « amendé par ADR-0026 » sur le type rootElement
- [ ] Grep global « descripteur objet » — retirer toute occurrence résiduelle
- [ ] Grep global `rootElement: Element` — retirer toute occurrence
- [ ] Mettre à jour tous les exemples de `get params()` qui déclarent `rootElement`
- [ ] Mettre à jour `PLAN-CORRECTIONS-2026-04-07.md` — marquer C2 et C3 résolus

---

## Références

- [composer.md](../rfc/4-couche-concrete/composer.md) — contrat du Composer
- [view.md](../rfc/4-couche-concrete/view.md) — contrat de la View
- [ADR-0020](ADR-0020-composers-n-instances-composition-heterogene.md) — N-instances, `TResolveResult` original
- [ADR-0014](ADR-0014-ssr-hydration-strategy.md) — SSR/hydratation, détection SSR vs SPA
- [foundation.md](../rfc/4-couche-concrete/foundation.md) — Foundation non impactée
- [invariants.md](../rfc/reference/invariants.md) — I31, I32, I34, I35

---

## Historique

| Date | Changement |
|------|------------|
| 2026-04-07 | Création (Proposed) — suite à l'audit de cohérence documentaire et retour de lecture par un pair |
