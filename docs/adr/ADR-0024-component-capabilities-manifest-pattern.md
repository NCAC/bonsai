# ADR-0024 : Déclaration des capacités composants — Pattern Manifeste value-first (`as const satisfies` + `abstract get`)

| Champ | Valeur |
|-------|--------|
| **Statut** | 🟢 Accepted |
| **Date** | 2026-04-03 |
| **Amendé le** | 2026-04-07 |
| **Décideurs** | @ncac |
| **RFC liée** | Couche concrète (composer, view, behavior, foundation), Feature |
| **ADRs liées** | ADR-0026 (rootElement hors TViewParams), ADR-0027 (resolve(event)) |

---

## Contexte

### Le problème

Chaque composant de la couche concrète (View, Composer, Behavior, Foundation)
déclare ses **capacités Channel** — les Channels qu'il écoute (`listen`),
ceux qu'il déclenche (`trigger`) et ceux qu'il interroge (`request`).

La documentation actuelle utilise **`static readonly`** pour ces déclarations :

```typescript
// Actuel — static readonly dans la classe abstraite
abstract class Composer {
  static readonly listen: readonly TChannelDefinition[];
  static readonly request: readonly TChannelDefinition[];
}
```

Ce pattern présente **trois défauts majeurs** identifiés lors de l'audit :

1. **`abstract static` n'existe pas en TypeScript** — on ne peut pas forcer
   une sous-classe à redéclarer une propriété statique. Si le développeur oublie
   `listen`, aucune erreur compile-time.

2. **Héritage silencieux** — les propriétés `static` sont héritées via la chaîne
   de prototypes en JavaScript. Un Composer qui oublie de déclarer `listen`
   hérite silencieusement celui de son parent — un bug muet de câblage Channel.

3. **Incohérence inter-composants** — View et Behavior utilisent un generic
   `TChannels` dans la signature de classe (`View<TChannels, TUI, TParams>`),
   mais ce generic n'est relié à aucune propriété dans le corps de la classe
   abstraite. C'est un « phantom type » sans enforcement.

### Le précédent marionext

Le prototype précédent **marionext** (version exploratoire de Bonsai, non déployée
en production à cette échelle) a expérimenté un pattern de typage :

- Un **type Params consolidé** (`TViewParams<Self, Config, Model>`) qui regroupe
  toutes les capacités du composant en un seul type structuré
- Le pattern **CRTP (F-bounded polymorphism)** — `View<PageView, TPageViewParams>`
  — pour que la classe abstraite connaisse le type concret
- Des **getters** (`get Element()`, `get UIElements()`, `get Behaviors()`)
  retournant `as const` pour satisfaire le contrat typé

Ce prototype a mis en évidence une DX en deux temps :
1. **Formalisation** — le développeur écrit un type manifeste décrivant les capacités
2. **Écriture guidée** — les getters sont autocomplétés et validés par l'IDE

Bien que non éprouvé en production, ce retour d'expérience exploratoire
informe la réflexion sur le pattern Manifeste.

---

## Contraintes

- **C1** : TypeScript strict (`strict: true`, `noImplicitAny`, `strictNullChecks`)
- **C2** : `abstract static` est impossible en TypeScript — pas de contournement propre
- **C3** : Le framework câble les handlers Channel **après** instanciation (séquence d'attachement §4.1) — l'introspection pré-instance n'est pas requise
- **C4** : La View a 6+ dimensions de paramétrage (listen, trigger, request, ui, behaviors, options) — la solution doit scaler
- **C5** : Le pattern doit s'appliquer uniformément aux 4 composants concrets + Feature
- **C6** : Le `as const` est nécessaire pour le narrowing tuple et l'immutabilité du contenu (`.push()` interdit)
- **C7** : Philosophie Bonsai — « Le type EST la documentation » (§3.8 Philosophie)

---

## Options considérées

### Option A — `static readonly` (statu quo)

**Description** : Conserver les déclarations `static readonly` sur la classe abstraite.
Les sous-classes redéclarent par convention.

```typescript
abstract class Composer {
  static readonly listen: readonly TChannelDefinition[];
  static readonly request: readonly TChannelDefinition[];
  abstract resolve(): TResolveResult | TResolveResult[] | null;
}

class MainComposer extends Composer {
  static readonly listen = [Router.channel] as const;
  static readonly request = [] as const;

  resolve() { /* ... */ }
}

// ❌ FooterComposer oublie listen → hérite silencieusement de Composer
// Aucune erreur compile-time ni runtime
class FooterComposer extends Composer {
  resolve() { return { view: FooterView, rootElement: '.Footer-root' }; }
}
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Introspection class-level (`MyComposer.listen` sans instance) | - **Aucun enforcement compile-time** (`abstract static` impossible) |
| + Syntaxe familière | - **Héritage silencieux** → bug muet de câblage |
| + Métadonnée sémantiquement class-level | - Incohérent avec le generic `TChannels` de View/Behavior |
|  | - Le framework n'a pas besoin d'introspection pré-instance (C3) |

---

### Option B — `abstract readonly` (fields d'instance séparés)

**Description** : Remplacer `static readonly` par `abstract readonly` sur la classe
abstraite. Chaque sous-classe est forcée de déclarer les fields.

```typescript
abstract class Composer {
  abstract readonly listen: readonly TChannelDefinition[];
  abstract readonly request: readonly TChannelDefinition[];
  abstract resolve(): TResolveResult | TResolveResult[] | null;
}

class MainComposer extends Composer {
  readonly listen = [Router.channel] as const;
  readonly request = [] as const;

  resolve() { /* ... */ }
}

// ✅ FooterComposer qui oublie listen → erreur compile-time immédiate
// TS2515: Non-abstract class 'FooterComposer' does not implement
//         inherited abstract member 'listen' from class 'Composer'.
class FooterComposer extends Composer {
  resolve() { return { view: FooterView, rootElement: '.Footer-root' }; }
}
```

Le framework peut accéder au type concret via `this['listen']` dans les méthodes héritées :

```typescript
abstract class Composer {
  abstract readonly listen: readonly TChannelDefinition[];

  // Le type se résout au type CONCRET du field de la sous-classe
  protected getListenedChannels(): this['listen'] {
    return this.listen;
  }
}
```

| Avantages | Inconvénients |
|-----------|---------------|
| + **Enforcement compile-time** (erreur si non implémenté) | - Perd l'introspection class-level (C3 : non requis) |
| + **Interdit le setter** (`readonly` verrouille la mutation) | - Fields dispersés (6+ pour View) |
| + `this['listen']` donne accès au type concret | - Pas de regroupement sémantique |
| + DX minimale (`readonly x = [...] as const`) | - Le generic `TChannels` reste un phantom type |
| + Évalué une fois au constructeur (performance) | |

---

### Option C — Pattern Manifeste value-first (`as const satisfies` + `abstract get`) ⭐

**Description** : la **valeur concrète** est écrite une seule fois dans un `const`,
validée par `satisfies` (conformité sans élargir les types), narrowée par `as const`
(préservation des tuples et littéraux). Le **type dérivé** est extrait automatiquement
via `typeof`. La classe abstraite déclare un `abstract get params()`.

Le pattern élimine la double saisie (type Config + getter) de la version initiale
et résout la clé `ui` fantôme (qui n'avait pas de valeur runtime).

#### Principe : deux niveaux de type, un seul objet

| Type | Rôle | Contenu | Quand |
|------|------|---------|-------|
| `TComposerParams` / `TViewParams<TUI, TOptions>` | **Contrainte de validation** — la forme que l'objet doit respecter | Clés larges (`readonly TChannelDefinition[]`) | `satisfies` sur le const |
| `TComposerCapabilities<typeof p>` / `TViewCapabilities<TUI, typeof p>` | **Type dérivé complet** — fusionne les types narrow de la valeur et les types purement type-level (TUI) | Tuples étroits (`readonly [typeof Router.channel]`) | Generic de la classe |

> **Pourquoi deux types ?** `satisfies` vérifie la conformité **sans élargir** les types.
> Le type de contrainte (`TViewParams`) est large (accepte tout tableau de `TChannelDefinition`).
> Le type dérivé (`TViewCapabilities`) capture les types **exacts** de la valeur (tuples, littéraux).
> C'est cette exactitude qui permet à `TComposerEvent` (ADR-0027) de dériver les noms d'Events
> et au compilateur de narrower les payloads dans un `switch`.

#### Types de contrainte (validation)

```typescript
/**
 * TComposerParams — contrainte de validation pour l'objet params Composer.
 * Utilisé avec `satisfies` pour vérifier la forme sans élargir les types.
 */
type TComposerParams = {
  readonly listen:  readonly TChannelDefinition[];
  readonly request: readonly TChannelDefinition[];
};

/**
 * TViewParams — contrainte de validation pour l'objet params View.
 *
 * @template TUI — type-level uniquement : types d'éléments HTML + événements DOM.
 *   N'est PAS une clé de l'objet params. Contraint les clés de `uiElements`.
 * @template TOptions — type des options custom de la View (primitives).
 *   Absent → Record<string, never>.
 *
 * Pas de rootElement — fourni par le Composer via TResolveResult (ADR-0026).
 */
type TViewParams<
  TUI extends TUIMap<any>,
  TOptions extends Record<string, unknown> = Record<string, never>
> = {
  readonly listen:     readonly TChannelDefinition[];
  readonly trigger:    readonly TChannelDefinition[];
  readonly request:    readonly TChannelDefinition[];
  readonly uiElements: { readonly [K in keyof TUI]: string };
  readonly behaviors:  readonly (typeof Behavior)[];
  readonly options:    TOptions;
};
```

> **Pas de clé `ui` dans l'objet runtime** — `TUI` est un paramètre de type
> qui contraint les clés autorisées dans `uiElements` et type les éléments HTML
> dans `getUI()`. L'information « `addToCartButton` est un `HTMLButtonElement` »
> n'a pas de valeur runtime — c'est une pure annotation compile-time.

#### Types dérivés (capacités complètes)

```typescript
/**
 * TComposerCapabilities — type dérivé complet d'un Composer.
 * Extrait les types narrow (tuples) depuis typeof params.
 */
type TComposerCapabilities<TParams extends TComposerParams> = {
  readonly listen:  TParams['listen'];   // ← narrow tuple
  readonly request: TParams['request'];  // ← narrow tuple
};

/**
 * TViewCapabilities — type dérivé complet d'une View.
 * Fusionne les types narrow de la valeur (typeof params) et le type
 * purement type-level (TUI) qui n'est pas dans l'objet runtime.
 */
type TViewCapabilities<
  TUI extends TUIMap<any>,
  TParams extends TViewParams<TUI, any>
> = {
  readonly listen:     TParams['listen'];      // ← narrow tuple
  readonly trigger:    TParams['trigger'];     // ← narrow tuple
  readonly request:    TParams['request'];     // ← narrow tuple
  readonly ui:         TUI;                    // ← type-level uniquement
  readonly uiElements: TParams['uiElements'];  // ← narrow record
  readonly behaviors:  TParams['behaviors'];   // ← narrow tuple
  readonly options:    TParams['options'];      // ← type élargi via TOptions
};
```

#### Classe abstraite

```typescript
abstract class Composer<TCapabilities extends TComposerCapabilities<TComposerParams>> {
  protected readonly slot: HTMLElement;

  /** Le manifeste — contrat déclaratif du Composer concret */
  abstract get params(): TCapabilities;

  /** Unique point d'entrée — ADR-0027 */
  abstract resolve(
    event: TComposerEvent<TCapabilities['listen']> | null
  ): TResolveResult | TResolveResult[] | null;

  protected readonly currentView: View<any> | null;
}
```

#### Mécanique de consommation unique

Le getter `params` est un **artifact de construction** — il n'est évalué
**qu'une seule fois** par le framework, dans le constructeur/bootstrap.
Le framework destructure le manifeste et peuple des champs privés :

```typescript
// Pseudo-code framework (interne, invisible au développeur)
constructor() {
  const manifest = this.params;  // ← seul appel au getter, jamais rappelé
  this._listen   = manifest.listen;
  this._request  = manifest.request;
  // manifest est GC'd — plus jamais lu
}
```

Le développeur interagit ensuite avec des **méthodes publiques typées**
qui lisent les champs privés, jamais le getter :

```typescript
// API runtime — les seuls points d'accès du développeur
this.getUI('addToCart');              // → lit _uiElements
this.trigger(Cart, 'addItem', item); // → vérifie _trigger
this.getOptions();                   // → expose _options
// this.params n'est JAMAIS rappelé après construction
```

Ce mécanisme résout simultanément :
- **Performance** — pas de réévaluation du getter, une seule lecture
- **Prévention de `set()`** — même si un développeur ajoutait un setter
  sur `params`, cela ne muterait rien : les `_private` sont déjà remplis
  et figés par le framework
- **Encapsulation** — les champs privés sont contrôlés par le framework,
  le développeur n'y accède que via l'API publique typée

#### DX développeur — pattern value-first (Composer)

```typescript
// ═══════════════════════════════════════════════════
// ÉTAPE 1 — La valeur concrète (écrite UNE SEULE FOIS)
// ═══════════════════════════════════════════════════

const mainComposerParams = {
  listen:  [Router.channel, Auth.channel],
  request: [Router.channel, Auth.channel],
} as const satisfies TComposerParams;
// ✅ `satisfies` vérifie la conformité SANS élargir les types
// ✅ `as const` préserve les tuples : readonly [typeof Router.channel, typeof Auth.channel]

// ═══════════════════════════════════════════════════
// ÉTAPE 2 — Le type dérivé (ZÉRO répétition)
// ═══════════════════════════════════════════════════

type TMainComposerCapabilities = TComposerCapabilities<typeof mainComposerParams>;
// → {
//     listen:  readonly [typeof Router.channel, typeof Auth.channel];
//     request: readonly [typeof Router.channel, typeof Auth.channel];
//   }

// ═══════════════════════════════════════════════════
// ÉTAPE 3 — La classe (getter trivial)
// ═══════════════════════════════════════════════════

class MainContentComposer extends Composer<TMainComposerCapabilities> {
  get params() { return mainComposerParams; }  // ← pas de type annotation, inféré

  resolve(event: TComposerEvent<TMainComposerCapabilities['listen']> | null) {
    // narrowing parfait dans le switch (ADR-0027)
  }
}

// ❌ Oubli de params → erreur compile-time immédiate
class FooterComposer extends Composer<TComposerCapabilities<TComposerParams>> {
  resolve(event: null) { return { view: FooterView, rootElement: 'footer.Footer' }; }
  // TS2515: Non-abstract class 'FooterComposer' does not implement
  //         inherited abstract member 'params'
}
```

> **Zéro double saisie** : `listen: [Router.channel, Auth.channel]` est écrit
> **une seule fois** dans le `const`. Le type est dérivé, le getter renvoie le const.

#### DX pour la View — value-first (manifeste riche)

```typescript
// ═══════════════════════════════════════════════════
// ÉTAPE 1 — Types purement type-level (info non-inférable des valeurs)
// ═══════════════════════════════════════════════════

/** Carte UI — types d'éléments HTML et événements DOM.
 *  Cette info ne peut PAS être inférée des sélecteurs CSS (strings). */
type TProductViewUI = TUIMap<{
  addToCartButton: { el: HTMLButtonElement; event: ['click'] };
  priceDisplay:    { el: HTMLSpanElement;   event: [] };
  reviewsSection:  { el: HTMLDivElement;    event: ['scroll'] };
}>;

/** Options custom — type des valeurs attendues par le Composer via resolve().options */
type TProductViewOptions = { showReviews: boolean; maxRelated: number };

// ═══════════════════════════════════════════════════
// ÉTAPE 2 — La valeur concrète (écrite UNE SEULE FOIS)
// ═══════════════════════════════════════════════════

const productViewParams = {
  listen:     [Product.channel, Inventory.channel],
  trigger:    [Cart.channel],
  request:    [Pricing.channel],
  uiElements: {
    addToCartButton: '.ProductView-addToCart',
    priceDisplay:    '.ProductView-price',
    reviewsSection:  '.ProductView-reviews',
  },
  behaviors:  [TooltipBehavior, LazyLoadBehavior],
  options:    { showReviews: true, maxRelated: 5 },
} as const satisfies TViewParams<TProductViewUI, TProductViewOptions>;

// ═══════════════════════════════════════════════════
// ÉTAPE 3 — Le type dérivé (ZÉRO répétition)
// ═══════════════════════════════════════════════════

type TProductViewCapabilities = TViewCapabilities<TProductViewUI, typeof productViewParams>;
// Le manifeste EST la documentation :
// En lisant TProductViewCapabilities, on sait TOUT sur cette View.

// ═══════════════════════════════════════════════════
// ÉTAPE 4 — La classe (getter trivial)
// ═══════════════════════════════════════════════════

class ProductView extends View<TProductViewCapabilities> {
  get params() { return productViewParams; }  // ← inféré, pas de type annotation
}
```

> **Pas de clé `ui` dans l'objet** — `TProductViewUI` est un type parameter
> de `TViewParams` (il contraint `uiElements`), puis fusionné dans `TViewCapabilities`
> comme `ui: TProductViewUI`. Il n'existe que dans le type dérivé, pas dans la valeur.

| Avantages | Inconvénients |
|-----------|---------------|
| + **Enforcement compile-time** (`abstract get`) | - Deux types utilitaires (contrainte + dérivé) au lieu d'un |
| + **ZÉRO double saisie** — valeur écrite une fois, type dérivé | - `as const satisfies` est un pattern TypeScript 4.9+ avancé |
| + **Pas de clé `ui` fantôme** dans l'objet runtime | - Le `typeof` d'un const est moins lisible qu'un type déclaré |
| + **Autocomplete IDE complet** dans le const | |
| + **Le type dérivé EST la documentation** — lisible en un coup d'œil | |
| + **Scalable** — 6 dimensions View dans un seul const | |
| + **Consommation unique** — getter lu une fois, peuple des private fields | |
| + **Narrowing maximal** — `satisfies` ne widene pas, `as const` préserve les tuples | |
| + **Élimine le phantom type** `TChannels` | |
| + **`set()` inoffensif** — les private fields sont la vraie source | |

---

## Analyse comparative

| Critère | Option A (static) | Option B (abstract readonly) | Option C (value-first) |
|---------|-------------------|------------------------------|------------------------|
| Enforcement compile-time | ❌ | ⭐⭐⭐ | ⭐⭐⭐ |
| Protection contre l'héritage silencieux | ❌ | ⭐⭐⭐ | ⭐⭐⭐ |
| DX autocomplete IDE | ⭐ | ⭐⭐ | ⭐⭐⭐ |
| Regroupement sémantique | ❌ | ❌ | ⭐⭐⭐ |
| Scalabilité (View 6+ dimensions) | ⭐ | ⭐ | ⭐⭐⭐ |
| Lisibilité du contrat (humain) | ⭐ | ⭐⭐ | ⭐⭐⭐ |
| Prévention de mutation (set) | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ (consommation unique) |
| Complexité framework (types internes) | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| Zéro double saisie | ❌ | ❌ | ⭐⭐⭐ |
| Narrowing type (tuples preservés) | ⭐ | ⭐⭐ | ⭐⭐⭐ |
| Pas de valeur fantôme runtime | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| Performance (évaluation) | ⭐⭐⭐ (class-level) | ⭐⭐⭐ (constructor) | ⭐⭐⭐ (constructor via consommation unique) |
| Cohérence inter-composants | ❌ | ⭐⭐ | ⭐⭐⭐ |

---

## Décision

Nous choisissons **Option C — Pattern Manifeste value-first** parce que :

1. **Enforcement compile-time** — `abstract get params()` force chaque classe concrète
   à déclarer ses capacités. Un oubli est une erreur de compilation immédiate.

2. **ZÉRO double saisie** — la valeur est écrite **une seule fois** dans un `const`.
   Le type est dérivé via `typeof`. Le getter renvoie le `const`. Rien n'est répété.
   C'est une amélioration fondamentale par rapport au pattern initial « type d'abord,
   implémentation ensuite » qui forçait à écrire les mêmes channels deux fois.

3. **Pas de clé `ui` fantôme** — la carte UI (`TUIMap`) est un type parameter,
   pas une clé de l'objet runtime. Elle contraint `uiElements` à la compilation
   et n'apparaît que dans le type dérivé `TViewCapabilities`. L'objet `params`
   ne contient que des valeurs avec une sémantique runtime réelle.

4. **Narrowing maximal** — `as const` préserve les tuples littéraux et `satisfies`
   vérifie la conformité sans élargir les types. Combinés, ils permettent à
   `TComposerEvent<TListen>` (ADR-0027) de dériver des unions discriminées exactes
   et au compilateur de narrower les payloads dans un `switch`.

5. **Le manifeste est de la documentation** — en lisant `TProductViewCapabilities`,
   un architecte ou un développeur connaît **tout** le contrat de la View sans lire
   une seule ligne d'implémentation. C'est l'incarnation structurelle de « Le type
   EST la documentation ».

6. **Consommation unique** — le getter est évalué une seule fois au constructeur.
   Le framework destructure le manifeste en champs privés (`_listen`, `_uiElements`, etc.)
   et expose des méthodes publiques typées (`getUI()`, `trigger()`, `getOptions()`).
   Ce mécanisme résout les préoccupations de performance ET de mutation accidentelle.

### Amendement 2026-04-07 : passage du pattern « type d'abord » au pattern « value-first »

Le pattern initial (v1) utilisait un type `TViewCapabilities<TConfig>` que le développeur
déclarait d'abord, puis implémentait dans le getter. Trois problèmes identifiés :

- **Double saisie** — `listen: readonly [typeof Router.channel]` dans le type ET
  `listen: [Router.channel]` dans la valeur du getter. Même information, deux endroits.
- **Clé `ui` fantôme** — l'objet retourné par le getter contenait `ui: /* autocomplete */`
  qui n'avait aucune valeur runtime. Une clé sans sémantique dans un objet concret.
- **rootElement dans TViewParams** — résolu séparément par ADR-0026 (rootElement vient
  du Composer via TResolveResult, pas de la View).

Le pattern value-first (`as const satisfies`) résout les trois problèmes en inversant
le flux : la **valeur** est la source, le **type** en est dérivé.

### Pourquoi pas Option A (static readonly)

Rejetée — défaut fondamental. `abstract static` n'existe pas en TypeScript,
l'héritage est silencieux, et aucun enforcement compile-time n'est possible.
C'est un piège qui produit des bugs muets de câblage Channel.

### Pourquoi pas Option B (abstract readonly)

Non retenue malgré ses qualités. Option B est **correcte** sur l'enforcement
(erreur compile-time si field manquant) et **supérieure** sur la prévention
de `set()`. Mais elle souffre de :
- **Dispersion** — 6 fields séparés pour la View, pas de vision consolidée
- **Pas de manifeste** — le contrat n'est pas lisible en un coup d'œil
- **Phantom type non résolu** — le generic `TChannels` reste déconnecté

Option B reste un **bon fallback** si Option C s'avère trop complexe à implémenter
côté framework. Elle pourrait être utilisée pour le Composer (2 dimensions seulement)
si le pattern Manifeste est jugé surdimensionné pour les composants simples.

---

## Points de vigilance

### ✅ V1 — Prévention de `set()` sur le getter (RÉSOLU)

`abstract get params()` n'interdit pas structurellement qu'une sous-classe
ajoute un setter. Cependant, ce risque est **neutralisé par le mécanisme
de consommation unique** :

- Le getter n'est appelé **qu'une seule fois** au constructeur
- Le framework destructure la valeur en champs privés (`_listen`, `_ui`, etc.)
- Les méthodes publiques (`getUI()`, `trigger()`, etc.) lisent ces champs privés
- Un setter ajouté par un développeur serait **sans effet** : il muterait
  une valeur que plus personne ne lit

Ce mécanisme rend la prévention structurelle (`readonly` de l'Option B)
**inutile** — la vraie source de vérité runtime sont les champs privés
du framework, pas le getter.

### ⏳ Q8 — CRTP (F-bounded polymorphism) : nécessaire ou superflu ?

Le prototype marionext utilisait le CRTP :

```typescript
class PageView extends View<PageView, TPageViewParams> { }
//                          ^^^^^^^^ — la classe se passe elle-même
```

Ce self-type permet à la classe abstraite de connaître le type concret
dans ses signatures (callbacks, event maps, constructeur). La question
pour Bonsai :

- **Bonsai a-t-il besoin du CRTP ?** — les callbacks et event maps
  de Bonsai passent par les Channels (pas par des méthodes de View).
  Le CRTP pourrait être superflu.
- **`this` polymorphique suffit-il ?** — TypeScript infère `this` comme
  le type de la sous-classe dans les méthodes d'instance. `this['params']`
  se résout au type concret sans CRTP.

**Décision reportée** — Q8 reste ouverte. Si le CRTP n'apporte rien
de plus que `this` polymorphique, Bonsai utilise un seul generic
(`View<TParams>` au lieu de `View<Self, TParams>`).

---

## Conséquences

### Positives

- ✅ **Enforcement compile-time uniforme** — les 5 composants (Foundation, Composer, View, Behavior, Feature) utilisent le même pattern
- ✅ **ZÉRO double saisie** — valeur → type dérivé → getter trivial. Rien n'est écrit deux fois
- ✅ **Pas de valeur fantôme** — l'objet `params` ne contient que des clés avec sémantique runtime
- ✅ **Le manifeste est documentaire** — le type capabilities d'un composant résume son contrat complet
- ✅ **DX IDE optimale** — autocomplete, erreurs en temps réel, navigation par type
- ✅ **Élimine le phantom type `TChannels`** — un seul generic `TCapabilities` relié au getter
- ✅ **Élimine l'héritage silencieux des static** — `abstract get` force la redéclaration
- ✅ **Narrowing maximal** — `as const` + `satisfies` préservent les tuples pour union discriminée

### Négatives (acceptées)

- ⚠️ Types utilitaires dédoublés (contrainte + dérivé) — accepté car le développeur n'utilise que le dérivé
- ⚠️ `as const satisfies` requiert TypeScript 4.9+ — accepté car Bonsai cible TS 5.x+

### Risques identifiés

- 🔶 Complexité des types `TViewCapabilities<TUI, TParams>` — mitigation : tests de type exhaustifs, exemples dans la RFC
- 🔶 Messages d'erreur TypeScript potentiellement obscurs sur `satisfies` — mitigation : documentation des erreurs courantes
- 🔶 CRTP non tranché (Q8) — mitigation : le pattern fonctionne avec ou sans CRTP, décision indépendante
- ~~🔶 Getter réévalué à chaque appel~~ — RÉSOLU : consommation unique au constructeur
- ~~🔶 Clé `ui` fantôme~~ — RÉSOLU : `TUI` est type parameter, pas clé runtime
- ~~🔶 Double saisie type/valeur~~ — RÉSOLU : value-first avec `typeof`
- ~~🔶 Setter non interdit structurellement~~ — RÉSOLU : les private fields sont la vraie source runtime

---

## Actions de suivi

- [x] ~~**Résoudre V1**~~ — résolu par le mécanisme de consommation unique (getter lu une fois, private fields figés)
- [ ] **Résoudre Q8** — CRTP nécessaire ou `this` polymorphique suffit ?
- [ ] **Enrichir 1-philosophie.md** — ajouter §3.10 « Pattern Manifeste — le type comme formulaire » (principe fondateur)
- [ ] **Mettre à jour composer.md** — remplacer `static readonly` par le pattern retenu
- [ ] **Mettre à jour view.md** — remplacer `static readonly` + phantom `TChannels` par `TViewCapabilities`
- [ ] **Mettre à jour behavior.md** — idem
- [ ] **Mettre à jour foundation.md** — idem
- [ ] **Mettre à jour feature.md** — appliquer le pattern aux 5 capacités Feature
- [ ] **Mettre à jour conventions-typage.md** — documenter les types utilitaires TXxxCapabilities
- [ ] **Créer des types de test** — `type-tests/` vérifiant les erreurs attendues
- [ ] **Ajouter nouvel invariant** — I68 : « Tout composant concret déclare ses capacités via un manifeste params typé »

---

## Références

- [Couche concrète — Composer](../rfc/4-couche-concrete/composer.md)
- [Couche concrète — View](../rfc/4-couche-concrete/view.md)
- [Couche concrète — Behavior](../rfc/4-couche-concrete/behavior.md)
- [Couche concrète — Foundation](../rfc/4-couche-concrete/foundation.md)
- [Couche abstraite — Feature](../rfc/3-couche-abstraite/feature.md)
- [Conventions de typage](../rfc/6-transversal/conventions-typage.md)
- [Philosophie](../rfc/1-philosophie.md)
- marionext-legacy : [Page.view.ts](../../marionext-legacy/tests/marionext-view/src/Page/Page.view.ts) — prototype exploratoire du pattern CRTP + Params consolidé

---

## Historique

| Date | Changement |
|------|------------|
| 2026-04-03 | Création (Proposed) — suite à l'audit des déclarations `static readonly` |
| 2026-04-03 | V1 résolu (consommation unique) — marionext recadré comme prototype |
