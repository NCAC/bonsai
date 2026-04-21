# ADR-0038 : Structure de `Foundation.composers` — `Readonly<Record<string, typeof Composer>>` et principe de stabilité de Foundation

| Champ                   | Valeur                                                                                                                                                                                                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Statut**              | 🟢 Accepted                                                                                                                                                                                                                                                       |
| **Date**                | 2026-04-21                                                                                                                                                                                                                                                        |
| **Décideurs**           | @ncac                                                                                                                                                                                                                                                             |
| **RFC liée**            | [foundation.md](../rfc/4-couche-concrete/foundation.md), [composer.md](../rfc/4-couche-concrete/composer.md), [view.md](../rfc/4-couche-concrete/view.md)                                                                                                         |
| **ADRs liées**          | [ADR-0020](ADR-0020-composers-n-instances-composition-heterogene.md) (N-instances View.composers), [ADR-0026](ADR-0026-root-element-css-selector-from-composer.md) (rootElement string), [ADR-0028](ADR-0028-strate-0-kernel-first-phasing.md) (phasage strate 0) |
| **Décisions impactées** | D29 (clarifié — clés CSS dans `<body>`)                                                                                                                                                                                                                           |
| **Invariants impactés** | **I67 (nouveau)** — Stabilité structurelle de Foundation                                                                                                                                                                                                          |

> ### Statut normatif
>
> Ce document est **normatif** pour la structure de `Foundation.composers`,
> et établit le **principe directeur de stabilité de Foundation**. Il complète
> [foundation.md](../rfc/4-couche-concrete/foundation.md) §3 sans le contredire :
> la RFC documentait déjà `Record<string, typeof Composer>`, cet ADR formalise
> le **pourquoi** (stabilité Foundation, délégation du dynamisme aux Views) et
> aligne le package strate 0 (qui utilisait provisoirement `Entry[]`).

---

## 📋 Table des matières

1. [Contexte](#contexte)
2. [Contraintes](#contraintes)
3. [Options considérées](#options-considérées)
   - [Option A — `Readonly<Record<string, typeof Composer>>`](#option-a--readonlyrecordstring-typeof-composer)
   - [Option B — `readonly TFoundationComposerEntry[]`](#option-b--readonly-tfoundationcomposerentry)
   - [Option C — `ReadonlyMap<string, typeof Composer>`](#option-c--readonlymapstring-typeof-composer)
4. [Analyse comparative](#analyse-comparative)
5. [Décision](#décision)
6. [Spécifications normatives](#spécifications-normatives)
   - [6.1 Signature TypeScript de `Foundation.composers`](#61-signature-typescript-de-foundationcomposers)
   - [6.2 Invariant I67 — Stabilité structurelle de Foundation](#62-invariant-i67--stabilité-structurelle-de-foundation)
   - [6.3 Pattern délégation pour composition dynamique](#63-pattern-délégation-pour-composition-dynamique)
   - [6.4 Foundation vs View.composers — divergence justifiée](#64-foundation-vs-viewcomposers--divergence-justifiée)
7. [Conséquences](#conséquences)
8. [Actions de suivi](#actions-de-suivi)
9. [Historique](#historique)

---

## Contexte

### La divergence détectée par l'audit 2026-04-21

L'audit Composer/Foundation pré-strate-0 a mis en évidence une **divergence de contrat** entre la RFC et le package :

| Source                                                                                                        | Type de `composers`                                                   |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| [foundation.md §1](../rfc/4-couche-concrete/foundation.md#L86-L94) (RFC)                                      | `Record<string, typeof Composer>`                                     |
| [foundation.md §3](../rfc/4-couche-concrete/foundation.md#L168) (RFC)                                         | `type TFoundationComposers = Record<string, typeof Composer>`         |
| [bonsai-foundation.ts](../../packages/foundation/src/bonsai-foundation.ts) (package strate 0, avant ADR-0038) | `readonly TFoundationComposerEntry[]` (`{ composer, rootElement }[]`) |

Le package avait été écrit avec une intention **prudente** (préserver l'ordre formellement, anticiper d'éventuels cas N-instances). Cette prudence s'est révélée **mal fondée** au regard du rôle réel de Foundation, ce que cet ADR formalise.

### Le rôle réel de Foundation (clarification 2026-04-21)

[Foundation](../rfc/4-couche-concrete/foundation.md) est :

- Le **premier composant concret** qu'un développeur Bonsai écrit
- **Singleton** par application (I33)
- Ancré sur `<body>` (I33)
- Le couvreur du **trou de couverture DOM** que les Views ne peuvent pas adresser (`<body>` lui-même n'est jamais le `rootElement` d'une View — I34)
- **Persistant** au sens fort : créé au bootstrap, vit jusqu'au shutdown applicatif
- **Sans PDR, sans projection, sans templates, sans rendu** ([foundation.md §1](../rfc/4-couche-concrete/foundation.md#L72))

Foundation est essentiellement un **layout statique** : `#header`, `#main`, `#footer`, éventuellement `#aside` ou `#dialog-root`. Sa structure DOM ne change pas en cours de vie applicative — elle est fixée par la décomposition macro de l'UI.

### La conséquence pratique

Dès lors qu'on accepte que Foundation soit stable, **les arguments « ordre formel garanti » et « N-instances même sélecteur » deviennent caducs** :

- L'ordre d'insertion des clés string d'un `Record` JavaScript est **garanti** par ECMAScript 2015+ (ES2015 §9.1.12 — `OrdinaryOwnPropertyKeys`). Pour 3 à 5 entrées de layout statique, le `Record` est strictement équivalent à un tableau ordonné en termes de comportement observable.
- Le besoin de **N-instances même sélecteur** (justification originale du tableau) n'a aucun cas d'usage légitime dans Foundation : on n'a jamais 2 `HeaderComposer` montés sur `#header`. Quand un cas de composition multiple ou hétérogène se présente, le pattern Bonsai recommandé est la **délégation à une View dédiée** (voir §6.3).

### Élément déclencheur

Lors de la phase d'audit pré-écriture Composer/Foundation, la question « pourquoi Foundation utilise `Entry[]` au lieu de `Record` ? » a fait remonter la confusion entre **contrat normatif** (RFC : Record, depuis l'origine) et **implémentation prudente** (package : Entry[], par anticipation infondée). Cet ADR ferme la divergence et formalise le principe sous-jacent.

---

## Contraintes

| #      | Contrainte                                                                                                       | Justification                                                                                  |
| ------ | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **C1** | I33 — Foundation singleton sur `<body>`                                                                          | Pilier non négociable                                                                          |
| **C2** | I34 — `rootElement` d'une View est un enfant de `<body>`, jamais `<body>`                                        | Foundation couvre le trou de couverture                                                        |
| **C3** | ADR-0028 — strate 0 kernel-first (pas de Channels Foundation, pas de capacités value-first)                      | Le contrat de `composers` doit fonctionner sans `params`/`listen`/`request`                    |
| **C4** | ADR-0026 — `rootElement` est un sélecteur CSS string                                                             | Le format des valeurs côté Foundation doit rester un string CSS                                |
| **C5** | ADR-0024 — alignement futur sur le pattern manifeste value-first                                                 | La structure choisie doit pouvoir cohabiter avec un `params` value-first ultérieur (strate 1+) |
| **C6** | Conformité avec [foundation.md](../rfc/4-couche-concrete/foundation.md) §3 (RFC normative actuelle)              | Si on diverge de la RFC, il faut une justification formelle (= cet ADR)                        |
| **C7** | Cohérence avec ADR-0020 — Foundation et View ont des contrats `composers` **distincts** (justifiable, voir §6.4) | Pas d'obligation d'homogénéité forcée si la sémantique diffère                                 |

---

## Options considérées

### Option A — `Readonly<Record<string, typeof Composer>>`

**Description** : un dictionnaire dont les clés sont des sélecteurs CSS et les valeurs des classes Composer. Conforme à la RFC actuelle.

```typescript
abstract class Foundation {
  abstract get composers(): Readonly<Record<string, typeof Composer>>;
}

class AppFoundation extends Foundation {
  get composers() {
    return {
      "#header": HeaderComposer,
      "#main": MainContentComposer,
      "#footer": FooterComposer
    };
  }
}
```

**Sémantique runtime** :

- Le framework itère sur `Object.entries(this.composers)` au bootstrap — ordre d'insertion garanti par ES2015+ pour les clés string non numériques.
- Pour chaque entrée, le framework instancie le Composer avec `new ComposerClass({ rootElement: key })`.
- L'unicité de la clé est garantie structurellement par le langage (un object literal ne peut pas avoir deux fois la même clé string littérale — TypeScript émet `TS1117`).

| Avantages                                                                                                                           | Inconvénients                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| + DX déclarative la plus naturelle pour un layout (3-5 entrées)                                                                     | - Ordre garanti uniquement par convention ECMAScript (pas par le système de types TS)   |
| + Unicité de sélecteur garantie au compile-time (TS1117 sur duplicata)                                                              | - Pas d'API pour itérer dans un ordre custom (mais n'est pas un besoin pour Foundation) |
| + Lecture immédiate : `clé = sélecteur, valeur = Composer`                                                                          |                                                                                         |
| + Conforme à la RFC actuelle ([foundation.md §1, §3](../rfc/4-couche-concrete/foundation.md#L86)) — pas de migration RFC nécessaire |                                                                                         |
| + Formalise la **stabilité** de Foundation au niveau du contrat de typage                                                           |                                                                                         |
| + Décourage structurellement les usages dynamiques (un Record statique se relit comme tel)                                          |                                                                                         |

---

### Option B — `readonly TFoundationComposerEntry[]`

**Description** : un tableau d'entrées explicites `{ composer, rootElement }`. C'est le choix actuel du package strate 0.

```typescript
type TFoundationComposerEntry = {
  readonly composer: typeof Composer;
  readonly rootElement: string;
};

abstract class Foundation {
  abstract get composers(): readonly TFoundationComposerEntry[];
}

class AppFoundation extends Foundation {
  get composers() {
    return [
      { composer: HeaderComposer, rootElement: "#header" },
      { composer: MainContentComposer, rootElement: "#main" },
      { composer: FooterComposer, rootElement: "#footer" }
    ] as const;
  }
}
```

| Avantages                                                                | Inconvénients                                                                                                                                              |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| + Ordre formellement garanti par le système de types (tuple ordonné)     | - Verbeux : 3 mots-clés (`{ composer:`, `rootElement: }`) pour ce qui est une simple paire clé/valeur                                                      |
| + Permet plusieurs Composers sur le même sélecteur (cas N-instances)     | - Permet aussi les **doublons silencieux** (deux entrées avec le même `rootElement`) — sans détection compile-time                                         |
| + Forme uniforme avec d'éventuels futurs champs (`options`, `params`...) | - **Ne correspond à aucun cas d'usage réel de Foundation** (qui est stable et statique)                                                                    |
| + Migration mineure depuis le package actuel                             | - Encourage à penser Foundation comme dynamique alors qu'elle ne l'est pas — **wrong mental model** induit par la structure                                |
|                                                                          | - Diverge de la RFC actuelle — exige une mise à jour RFC qui contredit la sémantique « layout stable »                                                     |
|                                                                          | - **N-instances dans Foundation** : aucun cas pratique recensé, et le pattern recommandé pour la composition dynamique est la délégation à une View (§6.3) |

---

### Option C — `ReadonlyMap<string, typeof Composer>`

**Description** : utiliser un `Map` ES6 — combine ordre garanti (par construction) et unicité de clé (par construction).

```typescript
abstract class Foundation {
  abstract get composers(): ReadonlyMap<string, typeof Composer>;
}

class AppFoundation extends Foundation {
  get composers() {
    return new Map<string, typeof Composer>([
      ["#header", HeaderComposer],
      ["#main", MainContentComposer],
      ["#footer", FooterComposer]
    ]);
  }
}
```

| Avantages                                                | Inconvénients                                                                             |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| + Ordre formellement garanti par construction (Map spec) | - Syntaxe `new Map([[...], [...]])` la moins déclarative des trois — bruit visuel maximal |
| + Unicité runtime garantie (Map déduplique sur `set`)    | - Itération via `for...of` ou `.entries()` — moins ergonomique que `Object.entries`       |
| + API d'introspection riche (`.has`, `.get`, `.size`)    | - Aucun bénéfice concret par rapport à Option A pour le cas d'usage Foundation            |
|                                                          | - Diverge de la RFC actuelle — migration RFC nécessaire pour un gain inexistant           |
|                                                          | - Pas de détection compile-time des doublons (la déduplication est runtime)               |

---

## Analyse comparative

| Critère                                                | A (Record)                          | B (Entry[])                        | C (Map)                          |
| ------------------------------------------------------ | ----------------------------------- | ---------------------------------- | -------------------------------- |
| **DX layout statique** (3-5 entrées)                   | ⭐⭐⭐ Naturel                      | ⭐ Verbeux                         | ⭐ Bruyant                       |
| **Ordre déterministe**                                 | ⭐⭐ De facto (ES2015+)             | ⭐⭐⭐ Formel (tuple)              | ⭐⭐⭐ Formel (spec Map)         |
| **Unicité sélecteur compile-time**                     | ⭐⭐⭐ TS1117                       | ❌ Non détecté                     | ❌ Runtime seulement             |
| **Adéquation au rôle de Foundation (stable)**          | ⭐⭐⭐ Renforce la sémantique       | ❌ Suggère du dynamisme inexistant | ⭐ Neutre                        |
| **Conformité RFC actuelle**                            | ⭐⭐⭐ Conforme                     | ❌ Diverge                         | ❌ Diverge                       |
| **Évolutivité strate 1+** (ajout `params` value-first) | ⭐⭐⭐ Orthogonal                   | ⭐⭐⭐ Orthogonal                  | ⭐⭐⭐ Orthogonal                |
| **Coût migration package**                             | ⭐⭐ Migration `Entry[]` → `Record` | ⭐⭐⭐ Aucune                      | ⭐⭐ Migration `Entry[]` → `Map` |
| **Force le bon mental model**                          | ⭐⭐⭐ Oui (statique = Record)      | ❌ Non (dynamique = Array)         | ⭐⭐ Neutre                      |

**Synthèse** : Option A domine sur les critères qui comptent (DX, conformité RFC, mental model, sécurité compile-time). Le seul critère où elle perd est l'ordre « formellement garanti par le type system » — mais ce critère est **non pertinent** pour 3-5 entrées de layout statique sous un moteur ECMAScript moderne.

---

## Décision

**Option A retenue : `Readonly<Record<string, typeof Composer>>`**.

### Justifications

1. **Conforme à la RFC normative actuelle** ([foundation.md §1, §3](../rfc/4-couche-concrete/foundation.md#L86-L168)) — aucune migration RFC, le contrat documenté depuis l'origine est maintenu.

2. **Renforce le principe directeur de Foundation** (formalisé en §6.2 et inscrit comme nouvel **invariant I67**) :

   > **Foundation est le premier composant concret, mais elle est stable et persistante. Elle délègue le dynamisme aux Views.**

3. **Décourage structurellement les usages dynamiques** : un `Record` se lit comme un dictionnaire statique ; un `Array` invite à penser ajout/suppression/réordonnancement. La forme du contrat **éduque** le développeur sur l'intention.

4. **Sécurité compile-time** sur l'unicité des sélecteurs (TypeScript émet `TS1117` sur deux clés string littérales identiques dans un object literal — détection sans coût).

5. **Pattern de délégation** documenté en §6.3 : quand un cas de composition dynamique apparaît, Foundation **n'évolue pas** ; on déclare une seule entrée pointant vers une View qui gère elle-même la composition (PDR, ProjectionList, View.composers avec N-instances ADR-0020).

### Rejet des alternatives

- **Option B (Entry[])** rejetée parce qu'elle :
  - induit le mauvais mental model (suggère du dynamisme là où il n'y en a pas)
  - permet des doublons de sélecteur sans détection compile-time
  - répond à un besoin (N-instances Foundation) qui n'a aucun cas d'usage légitime
  - exigerait de réécrire la RFC pour un gain technique nul

- **Option C (Map)** rejetée parce qu'elle :
  - apporte de la verbosité syntaxique sans bénéfice concret
  - exigerait de réécrire la RFC pour un gain technique nul
  - n'apporte aucune sécurité compile-time supplémentaire (déduplication runtime)

---

## Spécifications normatives

### 6.1 Signature TypeScript de `Foundation.composers`

```typescript
/**
 * Composers racines de Foundation — clés = sélecteurs CSS dans <body>.
 *
 * Layout stable et persistant — typiquement 3-5 entrées
 * (#header, #main, #footer, éventuellement #aside, #dialog-root...).
 *
 * **Ordre d'attachement** : le framework itère sur `Object.entries(this.composers)`
 * au bootstrap. L'ordre d'insertion des clés string non numériques est garanti
 * par ECMAScript 2015+ (§9.1.12 OrdinaryOwnPropertyKeys), donc l'ordre de
 * déclaration est préservé.
 *
 * **Unicité des clés** : garantie compile-time par TypeScript (TS1117 sur
 * un object literal avec deux clés littérales identiques).
 *
 * **Composition dynamique** : Foundation ne fait jamais de composition
 * dynamique. Pour ce cas, déclarer une seule entrée (ex: `'#page': PageComposer`)
 * et déléguer la composition à une View dédiée (PageView) qui utilise
 * View.composers + PDR. Voir §6.3.
 */
abstract get composers(): Readonly<Record<string, typeof Composer>>;
```

**Sémantique d'instanciation** (réf. [foundation.md §3](../rfc/4-couche-concrete/foundation.md#L143)) :

```
Pour chaque [selector, ComposerClass] dans Object.entries(this.composers) :
  1. instance = new ComposerClass({ rootElement: selector })
  2. instance.attach(this.body)
  3. ajouter instance à composerInstances
```

> **Pas de `querySelectorAll` côté Foundation** : chaque sélecteur résout un **unique** élément dans `<body>`. Si deux éléments matchent, c'est une **erreur de structure HTML** détectée au bootstrap (`document.body.querySelectorAll(selector).length > 1` → throw).

> **Si le sélecteur ne résout aucun élément** : le framework parse le sélecteur et crée l'élément (D30, ADR-0026 §6.4) — comportement identique à Composer. Foundation ne se distingue pas ici.

### 6.2 Invariant I67 — Stabilité structurelle de Foundation

> **I67** — Foundation est **structurellement stable** durant toute la vie de l'application. Sa déclaration `get composers()` est évaluée **une seule fois** au bootstrap (ADR-0010 étape 6), produit un `Readonly<Record<string, typeof Composer>>` figé, et ses entrées (sélecteurs et classes Composer) ne changent **jamais** par la suite. Aucun ajout, suppression, ou substitution de Composer racine n'est possible au runtime. Toute composition dynamique est **déléguée** à une View dédiée via le pattern §6.3 (ADR-0038). **Vérification** : compile-time (signature `Readonly<Record<...>>` empêche `composers['#new'] = NewComposer`), bootstrap (le framework gèle le record et ignore toute mutation ultérieure), runtime (aucune API de re-résolution de Foundation.composers exposée). **Garde-fou** : si un développeur tente de muter `composers` après bootstrap (ex: via cast `as any`), le framework détecte au prochain accès via `Object.isFrozen()` et throw en mode debug.

### 6.3 Pattern délégation pour composition dynamique

**Principe** : quand l'application a besoin de composition dynamique macro (ex: changement de page, swap de layout selon le rôle utilisateur), Foundation **n'évolue pas**. On utilise le pattern suivant :

```typescript
// ── Foundation reste minimale et stable ──────────────────────────────────
class AppFoundation extends Foundation {
  get composers() {
    return {
      "#page": PageComposer
    };
  }
}

// ── PageComposer choisit la View dynamiquement ───────────────────────────
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

// ── PageView gère sa propre composition interne via View.composers + PDR ─
class HomePageView extends View<THomePageCapabilities> {
  get params() {
    return homePageParams;
  }
  get composers() {
    return {
      heroSlot: HeroComposer, // dynamique : ADR-0020 querySelectorAll
      productList: ProductListComposer // composition spécifique à HomePage
    };
  }
}
```

**Bénéfices** :

- Foundation reste **lisible en un coup d'œil** comme un layout statique
- Le **dynamisme est local** à la View concernée, encapsulé dans un sous-arbre DOM
- La **destruction en cascade** d'une View dynamique nettoie automatiquement ses Composers/Views enfants (RFC composer.md §5)
- Foundation ne re-render **jamais** — pas de risque d'invalider l'ancrage des composants persistants (header, footer)

**Anti-pattern** :

```typescript
// ❌ NE JAMAIS FAIRE — Foundation dynamique
class BadFoundation extends Foundation {
  get composers() {
    if (isAdminMode()) {
      return { "#header": AdminHeaderComposer, "#main": AdminMainComposer };
    }
    return { "#header": HeaderComposer, "#main": MainComposer };
  }
}
```

> **Pourquoi c'est interdit** : (1) viole I67 (stabilité), (2) `composers` est évalué une seule fois au bootstrap — le `if` n'aura jamais d'effet après, (3) crée une fausse impression d'adaptabilité qui sera source de bugs.

### 6.4 Foundation vs View.composers — divergence justifiée

Les contrats `Foundation.composers` et `View.composers` **diffèrent par nature** — c'est intentionnel et justifié.

| Aspect             | `Foundation.composers`                        | `View.composers`                                                              |
| ------------------ | --------------------------------------------- | ----------------------------------------------------------------------------- |
| Signature          | `Readonly<Record<string, typeof Composer>>`   | `Record<keyof TUI, typeof Composer>`                                          |
| Type de clé        | `string` libre (sélecteur CSS brut)           | `keyof TUI` (typé compile-time, doit exister dans `uiElements`)               |
| Validation         | Runtime (au bootstrap : `body.querySelector`) | Compile-time (`keyof` du contrat TUIMap de la View)                           |
| Sémantique resolve | `body.querySelector(key)` (1 seul élément)    | `querySelectorAll(uiElements[key])` (1 ou N éléments → N Composers, ADR-0020) |
| Évaluation         | **Une fois** au bootstrap (I67)               | Re-évalué **à chaque attachement** de la View                                 |
| Cas d'usage        | Layout macro stable (header, main, footer)    | Slots typés dans le scope d'une View, possiblement N-instances                |
| N-instances        | **Interdit** (1 sélecteur = 1 Composer)       | **Autorisé** (ADR-0020 §6.1 querySelectorAll)                                 |

> **L'homogénéité aurait été artificielle** : Foundation et View opèrent à des échelles et avec des contraintes différentes. Forcer le même type aurait imposé soit de typer Foundation par `keyof TUI` (alors qu'il n'a pas de TUIMap — pas de templates, pas de PDR), soit de relâcher View vers `string` (perte de type-safety sur les clés).

---

## Conséquences

### Sur le package `@bonsai/foundation` (strate 0)

| Élément                              | Avant (Entry[])                       | Après (Record)                              |
| ------------------------------------ | ------------------------------------- | ------------------------------------------- |
| Type `TFoundationComposerEntry`      | Exporté                               | **Supprimé** (plus utilisé)                 |
| Signature `abstract get composers()` | `readonly TFoundationComposerEntry[]` | `Readonly<Record<string, typeof Composer>>` |
| Implémentation `attach()`            | Itère sur l'array via `for...of`      | Itère sur `Object.entries(this.composers)`  |

### Sur les RFC

- [foundation.md](../rfc/4-couche-concrete/foundation.md) — **inchangée sur le contrat** (déjà conforme depuis l'origine), mais ajout :
  - encadré « Stabilité de Foundation (I67, ADR-0038) » dans §1
  - section §3.bis « Pattern délégation pour composition dynamique » (reprise de §6.3 ci-dessus)

### Sur les invariants

- **Ajout I67** dans [invariants.md](../rfc/reference/invariants.md) — reprise textuelle de §6.2.
- **Aucun invariant existant impacté** (I33 reste valide et indépendant).

### Sur les tests

- [foundation.basic.test.ts](../../tests/unit/strate-0/foundation.basic.test.ts) — migration `Entry[]` → `Record` dans les fixtures (3 occurrences).
- [application.bootstrap.test.ts](../../tests/unit/strate-0/application.bootstrap.test.ts) — idem (3 occurrences).
- **Aucun test à supprimer**, aucun comportement observable changé.

### Sur les utilisateurs futurs

- DX simplifiée pour le cas commun (layout statique).
- Le contrat « Foundation = stable » est désormais **explicite et formalisé** — fin des hésitations « dois-je rendre Foundation conditionnelle ? ».
- Le pattern délégation (§6.3) devient le **canon documenté** pour la composition dynamique macro.

---

## Actions de suivi

- [ ] Migrer [bonsai-foundation.ts](../../packages/foundation/src/bonsai-foundation.ts) : signature `composers`, suppression `TFoundationComposerEntry`, itération `Object.entries`.
- [ ] Migrer [foundation.basic.test.ts](../../tests/unit/strate-0/foundation.basic.test.ts) et [application.bootstrap.test.ts](../../tests/unit/strate-0/application.bootstrap.test.ts).
- [ ] Ajouter I67 dans [invariants.md](../rfc/reference/invariants.md) (tableau principal + tableau « niveaux d'enforcement »).
- [ ] Ajouter encadré « Stabilité de Foundation » et section « Pattern délégation » dans [foundation.md](../rfc/4-couche-concrete/foundation.md).
- [ ] Mettre à jour [docs/adr/README.md](README.md) (entrée ADR-0038, ordre, statut).
- [ ] Vérifier qu'aucun autre document (RFC, guides) ne référence `TFoundationComposerEntry`.

---

## Historique

| Date       | Événement                                                                     |
| ---------- | ----------------------------------------------------------------------------- |
| 2026-04-21 | Création — Proposed → Accepted dans la même session après cadrage utilisateur |
| 2026-04-21 | Décision — Option A retenue (Record), formalisation I67                       |
