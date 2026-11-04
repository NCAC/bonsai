# PugX — brief de besoins pour un agent LLM

> **Destinataire** : un agent LLM qui assistera le mainteneur dans un **nouveau projet** (dépôt séparé)
> visant à livrer **PugX** : un langage de templates typé + son compilateur + une intégration IDE par **LSP**.
> **Origine** : Bonsai (framework TypeScript, dépôt `NCAC/bonsai`), premier et principal consommateur.
> **Rédigé le** 2026-09-25 à partir de l'état réel du dépôt Bonsai (branche `feature/documentation-big-bang`).
> **Statut** : cahier des besoins. Les décisions marquées 🧭 sont **ouvertes** : l'agent doit les proposer
> avec alternatives et laisser le mainteneur trancher, sans les présumer.

---

## 0. Comment travailler avec le mainteneur

- Le mainteneur est **seul**, concepteur du langage. Il pense en français ; le projet suit les conventions de Bonsai :
  **documentation et messages de commit en français** (Conventional Commits : `feat(lsp): …`), **code, JSDoc et commentaires en anglais**.
- Avant d'écrire du code : proposer un **plan par phases** (§9), puis avancer phase par phase, **un commit par étape validée**.
- **Tests d'abord** (TDD) ; chaque fonctionnalité cite la règle/le besoin qu'elle prouve (identifiants `B-…` de ce brief).
- **Ne rien présumer** sur les 🧭 : lister les options, recommander, attendre l'arbitrage.
- **Ne pas se fier aux plans existants** : `docs/pugx/development-plan.md` coche 7 étapes « ✅ » alors qu'**aucun code** correspondant n'existe
  (vérifié : `docs/pugx/` ne contient que trois fichiers Markdown). Le lexer/parser hérités sont un *fork* de Pug, pas un lexer/parser PugX (§2).
- Rapporter honnêtement ce qui est vérifié (tests verts) et ce qui ne l'est pas.

---

## 1. Pourquoi PugX

### 1.1 Le besoin de Bonsai

Bonsai fait du rendu par **Projection DOM Réactive (PDR)** : **pas de VDOM**. Le DOM préexiste (SSR, CMS, HTML statique) ;
les données sont appliquées par **mutations ciblées**. Les templates sont écrits en syntaxe Pug et **compilés au build** en code TypeScript
qui localise les nœuds dynamiques et les met à jour ; **rien n'est parsé au runtime**.

Le contrat que le compilateur doit produire, par template :

```ts
type TProjectionTemplate<TNodes, TData> = {
  /** Localise les nœuds dynamiques dans un DOM EXISTANT (SSR/îlots). C'est l'hydratation. */
  setup(container: HTMLElement): TNodes;
  /** Applique les données : mutations DOM ciblées, gardées (n'écrit que si la valeur change). */
  project(nodes: TNodes, data: TData): void;
  /** Crée le DOM complet quand il n'existe pas (SPA). */
  create(data: TData): HTMLElement;
};
```

La View Bonsai déclare la réactivité en TypeScript (`get templates()` avec un `select(data) → TData`) ; le template Pug ne porte **que la structure**.
Trois modes, exclusifs par View : **A** aucun template ; **B** template racine (tout le `rootElement`) ; **C** îlots (un template par clé UI `@ui`).

### 1.2 Pourquoi un langage à part (« PugX ») et pas Pug standard

Trois exigences que Pug standard ne couvre pas :

1. **Typage de bout en bout** : les données d'un template ont un **type TypeScript réel** ; les expressions du template sont vérifiées contre lui (build **et** éditeur).
2. **Sémantique de projection** : `each` = réconciliation **par clé**, conditions/expressions = dépendances analysables statiquement (pour émettre des guards par nœud).
3. **Outillage** : diagnostics, complétion, navigation, renommage — par LSP, sur des fichiers qui mélangent un langage de balisage et des expressions TypeScript.

### 1.3 Ce que PugX n'est **pas** (non-objectifs)

- ❌ Un moteur de rendu VDOM (le prototype existant en était un : à ne pas reproduire).
- ❌ Un interpréteur de Pug au runtime.
- ❌ Un moteur SSR Node.js complet (hors v1 de Bonsai) — mais voir 🧭 B-OUT-6 (rendu HTML string optionnel).
- ❌ Un système de styles (CSS/SCSS) ou de routage.
- ❌ Un runtime lourd : le code généré ne dépend que d'un **contrat runtime minimal** (§4.6).

---

## 2. Existant à connaître (et à ne pas surestimer)

### 2.1 Documents PugX du dépôt Bonsai (`docs/pugx/`)

| Fichier | Contenu | Valeur |
| --- | --- | --- |
| `syntaxe-spec.md` | Syntaxe brouillon : `@e(expr)` (échappé), `@r(expr)` (brut), `@code`, `@mixin`, `@function`, `+mixin(args)`, `@if/@unless/@elseif/@else`, `@each Type in coll:Type`, `@[tag.class @e(x)]`, `@use "f.pugx"`, `@include "f.pugx"`, commentaires `@— … —@` | Point de départ **non éprouvé** ; à réviser (§3) |
| `spec-2.md` | Ancienne spec « templates typés PugJS → snabbdom » (`.bsn.template`, LSP, preview, doc auto) | **Obsolète** sur la cible (snabbdom/VDOM) ; utile pour la liste de fonctionnalités IDE |
| `development-plan.md` | Découpage en `pugx-core` (lexer, parser, ast, resolver), `pugx-lsp`, `pugx-vscode` | Bon découpage de départ ; **statut « ✅ » faux** |

### 2.2 Prototype `tools/pug-to-ts-template` (`@bonsai/pug-ts`)

~4 600 lignes, jamais évoluées depuis la baseline `v0.1.0`, hors workspace, sans test.

- **Réutilisable comme référence d'architecture** : pipeline `source → lexer → parser → AST → compiler visiteur → writer → Prettier`
  (`lexer.ts` ~1 600 l., `parser.ts` ~1 400 l., `token-stream.ts`, `walk.ts`, `template-compiler.class.ts`, `writer.class.ts`, `mixin-compiler.class.ts`, `load.ts` pour `include`).
  Il gère tags, attributs, interpolation, `if/else`, `case/when`, `mixin`, `include`, code inline (`- var x = …`).
- **À jeter** : la génération VDOM (`VDom.h`, `VNodeData`, hooks), le couplage à l'ancienne View (`view.elementSelector`, `regionElements`, `uiEventBindings`),
  le DSL de types maison (`_data` + `DataTypes.String()`), les imports `from "bonsai"`.
- **Limites techniques à corriger dès le départ** : le parseur hérité de `pug-parser` **lève une exception à la première erreur** (inutilisable pour un LSP, §5.2) ;
  les expressions sont analysées avec Babel/`is-expression` sans types ; une écriture de fichier de debug (`ast.json`) est codée en dur dans le générateur.
- Exemple d'entrée : `tools/pug-to-ts-template/Page/PageView.template.pug` (tag, `if/else`, `case/when`, mixins, `include`, interpolation) et sa sortie VDOM `pageView.template.ts`.

### 2.3 Spécification cible côté Bonsai (à copier dans le nouveau dépôt en référence)

| Source (dépôt Bonsai) | À en retenir |
| --- | --- |
| `docs/spec/5-rendu.md` | Principes du compilateur (§4), IR (§5.2), génération `setup/project/create` (§5.3), API `ProjectionList` (§6), syntaxe et `@ui` (§8), erreurs (§10) |
| `docs/adr/ADR-22-pdr.md` | Décision PDR, 3 modes de template, `setup()`/`create()`, guards, animations |
| `docs/adr/ADR-23-listes.md` | `ProjectionList.reconcile`, adoption SSR par `keyAttr`, délégation d'événements |
| `docs/adr/ADR-24-hydratation-ssr.md` | Règles H1–H5 (hydratation structurelle) |
| `docs/adr/ADR-26-souscription-view.md` | 🟡 **Question ouverte** : comment les données arrivent au `select()` (n'affecte pas la sortie du compilateur : `project(nodes, data)`) |
| `docs/spec/4-couche-concrete/view.md` §4–§4.8 | Modes A/B/C, `get templates()`, îlots `@ui.xxx` |

> ⚠️ **Rien de tout cela n'est implémenté dans Bonsai** (ni `ProjectionList`, ni `get templates()`, ni runtime PDR ; seuls les projections N1 `getUI().text()…` existent).
> Le nouveau projet **définit** donc le contrat de sortie ; Bonsai l'implémentera en face (strate 1c). Prévoir un contrat runtime minimal et versionné (§4.6).

---

## 3. Le langage PugX

### 3.1 Principes

- **Superset lisible de Pug** : un développeur Pug doit lire un fichier PugX sans effort. Les extensions sont préfixées `@` (l'indentation reste la structure).
- **Le type TypeScript est la source de vérité** : pas de DSL de types propre. Un template déclare la forme de ses données en **important un type TypeScript**.
- **Analysable statiquement** : toute construction doit permettre de déterminer *quelles données influencent quel nœud* (nécessaire aux guards).
- **Tolérant à l'édition** : un fichier en cours de frappe reste analysable (arbre partiel + diagnostics, cf. §5.2).

### 3.2 Constructions attendues (à spécifier précisément par l'agent — grammaire BNF/PEG + exemples)

| # | Besoin | Détail / question |
| --- | --- | --- |
| B-LANG-1 | Balisage Pug : tags, `.classe`, `#id`, attributs (`a(b="c" d=expr)`), texte, indentation, commentaires | Reprendre la sémantique Pug connue ; lister les écarts volontaires |
| B-LANG-2 | Déclaration des données typées | 🧭 forme exacte, ex. `@data import type { TCartItemsData as Data } from "./cart.types"` **ou** bloc d'en-tête. Le type doit venir de TypeScript (fichier `.ts` réel), résolu par le compilateur TS |
| B-LANG-3 | Expressions | `@e(expr)` (texte échappé → `textContent`), `@r(expr)` (HTML brut → `innerHTML`, à signaler comme risqué), interpolation `#{}` dans le texte et les attributs. `expr` = **expression TypeScript** complète, typée |
| B-LANG-4 | Conditions | `@if / @elseif / @else / @unless` — 🧭 **sémantique de projection** (voir B-PDR-3) |
| B-LANG-5 | Boucles | `@each item in items` (+ index) ; **clé obligatoire** (B-PDR-4). La syntaxe `@each Type in coll:Type` du brouillon est à revoir : le type de `item` doit être **inféré** depuis `items` |
| B-LANG-6 | Mixins et fonctions | `@mixin nom(params typés)`, appel `+nom(args)`, `@function` pur ; **inlinés au build**. Paramètres typés en TypeScript |
| B-LANG-7 | Composition de fichiers | `@use` (importer mixins/helpers, y compris depuis `.ts`) et `@include` (insérer un fragment) ; résolution relative + alias ; détection des cycles |
| B-LANG-8 | Références UI Bonsai | Attribut `@ui="clé"` (nom de nœud référencé par la View) et fragments d'îlots `@ui.clé` (un fichier → plusieurs templates, un par îlot). 🧭 syntaxe exacte : `5-rendu.md` §8.2 utilise `(@ui="items")` (attribut) ; `view.md` §4.7 utilise `@ui.loginContainer` (bloc) |
| B-LANG-9 | Balise inline | `@[span.highlight @e(msg)]` (brouillon) — 🧭 à conserver ou supprimer |
| B-LANG-10 | Commentaires | Ignorés à la compilation ; 🧭 forme (`//-` Pug vs `@— … —@`) |
| B-LANG-11 | Code d'instruction | `@code` / `- var x = …` : 🧭 **à restreindre** (pas d'effets de bord : le template est une fonction pure des données) |
| B-LANG-12 | Échappement et sécurité | Aucune expression non échappée par défaut ; `@r` explicite ; refuser les attributs `on*` dynamiques (les événements sont déclarés côté View, jamais dans le template) |

> 🧭 **Tension à arbitrer** : `5-rendu.md` §8 affirme « Pug 100 % standard, aucune extension », tandis que PugX est explicitement une extension
> (et `@ui="…"` n'est pas du Pug standard). Recommandation à discuter : PugX = superset assumé ; `5-rendu.md` sera amendé pour référencer PugX.

### 3.3 Exemple cible (illustratif — non normatif)

Entrée `cart-items.pugx` :

```pug
@data import type { TCartItemsData as Data } from "./cart.types"

ul.Cart-items(@ui="items")
  @each item in data.items
    li.Cart-item(data-item-id=item.id)
      span.CartItem-name @e(item.name)
      span.CartItem-qty @e(item.quantity)
```

Sortie attendue (forme, pas texte exact) : un module TypeScript exportant un `TProjectionTemplate<Nodes, Data>` dont
`setup()` indexe les items existants par `data-item-id` et localise `.CartItem-name`/`.CartItem-qty` ; `project()` appelle `list.reconcile(data.items, …)` avec des **guards**
(`if (n.name.textContent !== v) n.name.textContent = v`) ; `create()` construit `<ul class="Cart-items">` et ses items.
Le type `Data` est celui du fichier TypeScript ; `item` est inféré `TCartItem`.

---

## 4. Le compilateur

### 4.1 Pipeline

`source .pugx → lexer → parser (tolérant) → AST → analyse sémantique (résolution TS, dépendances, clés, @ui) → IR → générateur TypeScript (+ sourcemap) → formatage`

Le **même front-end** (lexer, parser, analyse) sert le compilateur **et** le LSP (B-ARCH-1).

### 4.2 Analyse statique (B-ANALYSIS)

| # | Besoin |
| --- | --- |
| B-ANALYSIS-1 | Distinguer nœuds **statiques** (présents tels quels dans le DOM serveur, ignorés par `project`) et **dynamiques** |
| B-ANALYSIS-2 | Pour chaque nœud dynamique : l'ensemble des **chemins de données** lus (`data.user.name`, `item.price`) → base des guards et de la localisation dans `setup()` |
| B-ANALYSIS-3 | Vérification de types de **toutes** les expressions via le compilateur TypeScript (API `Program`/`LanguageService`), avec les vrais types du projet |
| B-ANALYSIS-4 | Inférence du type de `item` dans `@each`, des paramètres de mixins, des valeurs de branche |
| B-ANALYSIS-5 | Validation croisée **template ↔ View** (adaptateur Bonsai, §4.5) : chaque clé `@ui` du template est déclarée dans le contrat UI de la View et inversement |

### 4.3 Sémantique PDR (B-PDR) — le cœur

| # | Besoin |
| --- | --- |
| B-PDR-1 | Trois formes de sortie selon le mode : template **racine** (B), **îlot** par clé `@ui` (C) ; un fichier peut produire **plusieurs** exports |
| B-PDR-2 | **`setup` = hydratation** : aucune branche « SSR vs SPA » dans le code applicatif ; `setup()` ne crée aucun nœud, il localise (règle H2) |
| B-PDR-3 | 🧭 **Conditions (`@if`)** : le DOM serveur contient une seule branche. Comment `project()` passe d'une branche à l'autre ? Options : (a) insérer/supprimer les nœuds via `create` du sous-arbre ; (b) garder les deux branches et basculer `hidden` ; (c) interdire les changements de branche hors îlot dédié. **À trancher avec le mainteneur** (impact fort sur la sortie et l'hydratation) |
| B-PDR-4 | **`each` keyed obligatoire** : clé inférée d'un attribut de l'élément racine de la boucle, par priorité `data-item-id`, `data-key`, `id` ; sinon **erreur de compilation** (« List requires a key ») ; clés dupliquées détectées au runtime (avertissement) |
| B-PDR-5 | **Guards par nœud** systématiques : jamais d'écriture DOM si la valeur est inchangée (`textContent`, attributs, classes) — c'est la responsabilité du code **généré**, pas du développeur |
| B-PDR-6 | Classes conditionnelles, attributs booléens (`disabled`, `hidden`) et `style` dynamique : sémantique précise (`classList.toggle`, `toggleAttribute`, `style.setProperty`) |
| B-PDR-7 | `each` imbriqués supportés nativement ; adoption des items serveur par `keyAttr` (H3) |
| B-PDR-8 | **Équivalence create/setup** : le DOM produit par `create(data)` doit être structurellement identique à ce que `setup()` s'attend à trouver dans du HTML serveur produit depuis le même template (test de propriété, §8) |
| B-PDR-9 | Aucune gestion d'événements dans le template ; les événements DOM vivent dans la View (délégation) |
| B-PDR-10 | Callbacks d'animation de liste (`onBeforeEnter`, `onAfterEnter`, `onBeforeLeave`, `onAfterLeave`) : le générateur les relaie à `ProjectionList` (options) — détail à définir avec Bonsai |

### 4.4 Sorties et build (B-OUT)

| # | Besoin |
| --- | --- |
| B-OUT-1 | Module **TypeScript** par template (ou par îlot), lisible, formaté, avec en-tête « généré, ne pas éditer » ; **sourcemaps** vers le `.pugx` |
| B-OUT-2 | **Déterminisme** : mêmes entrées → même sortie octet pour octet (snapshots stables) |
| B-OUT-3 | **Déclarations de types** pour `import tpl from "./x.pugx"` (fichier `.pugx.d.ts` généré ou plugin TypeScript) afin que l'éditeur et `tsc` connaissent le type exporté |
| B-OUT-4 | CLI `pugx build [glob]`, `pugx check` (diagnostics seuls, code de sortie ≠ 0 en erreur, pour la CI), `--watch` |
| B-OUT-5 | Plugins **Vite/Rollup** et **esbuild** (transformation à l'import) ; compatibilité Node ≥ 20, ESM |
| B-OUT-6 | 🧭 Cible optionnelle `render(data): string` (HTML serveur) — utile pour tester B-PDR-8 et pour un futur SSR ; hors périmètre v1 de Bonsai |
| B-OUT-7 | Erreurs de compilation **structurées** : code stable (`PUGX0001`…), message, plage source, suggestion (cf. §4.7) |

### 4.5 Séparation cœur / adaptateur de framework (B-ARCH)

| # | Besoin |
| --- | --- |
| B-ARCH-1 | Front-end unique (`pugx-core`) partagé compilateur/LSP, **sans dépendance à Node** (utilisable en navigateur/worker) |
| B-ARCH-2 | `pugx-core` et le générateur sont **neutres vis-à-vis de Bonsai** ; tout ce qui est spécifique passe par un **adaptateur** (`pugx-bonsai`) : règles d'inférence de clé, sémantique de `@ui`, chemin d'import du runtime, validation template ↔ View, forme du contrat de sortie |
| B-ARCH-3 | Un second adaptateur « minimal » (DOM pur, sans framework) sert de banc d'essai pour éviter un couplage involontaire — 🧭 à décider (peut rester un fixture de test) |

### 4.6 Contrat runtime minimal (B-RT)

Le code généré n'importe **qu'une** petite surface, fournie par le framework (Bonsai) — à versionner (`runtimeContractVersion`) :

- `ProjectionList` (`reconcile`, `getItemNodes`, `dispose`, option `keyAttr`, `itemSetup`, `itemCreate`) — spécifié dans `5-rendu.md` §6 ;
- `escapeHtml` (uniquement pour `@r`/`create` par chaîne HTML, si ce chemin existe) ;
- éventuellement `shallowEqual` reste **côté View** (le compilateur ne l'émet pas : il porte sur la sortie du `select`).

B-RT-1 : le compilateur doit pouvoir cibler une **implémentation de référence** fournie dans le nouveau dépôt (pour tester sans Bonsai), puis celle de Bonsai.
B-RT-2 : aucune autre dépendance runtime (pas de lodash, pas de bibliothèque de templates).

### 4.7 Diagnostics de compilation (référence minimale — étendre)

| Cas | Gravité | Message de base (Bonsai `5-rendu.md` §10) |
| --- | --- | --- |
| `each` sans clé | erreur | « List requires a key. Add `data-item-id` or `data-key`. » |
| `@ui` dans le template sans clé UI côté View | erreur | « @ui 'foo' in template but not declared in uiElements » |
| clé UI côté View sans `@ui` dans le template | erreur | « uiElement 'bar' requires @ui="bar" in template » |
| Syntaxe invalide | erreur | position ligne/colonne + attendu/trouvé |
| Expression non typable / propriété inconnue | erreur | diagnostic TypeScript **remappé** sur la plage PugX |
| `@r` (HTML brut) | avertissement | « raw HTML — XSS risk » |
| Mixin/fichier inconnu, import cyclique | erreur | avec chemin |

---

## 5. Intégration IDE par LSP

### 5.1 Fonctionnalités (B-LSP)

| # | Fonctionnalité | Exigence |
| --- | --- | --- |
| B-LSP-1 | **Diagnostics** en continu | Syntaxe, types (via TypeScript), clés manquantes, `@ui` incohérents (template ↔ View), imports, mixins. Mise à jour à la frappe (debounce), résolution < 300 ms sur un template de 500 lignes (cible à valider) |
| B-LSP-2 | **Complétion** | Propriétés de `data` (typées), variables de boucle, mixins/fonctions importés, tags/attributs HTML, directives `@…`, clés `@ui` déclarées côté View, chemins de `@use/@include` |
| B-LSP-3 | **Hover** | Type TypeScript de l'expression, signature d'un mixin, doc JSDoc de la propriété |
| B-LSP-4 | **Go to definition / declaration** | Mixin → sa définition ; `@include/@use` → fichier ; propriété de `data` → déclaration dans le `.ts` ; `@ui="x"` → entrée `x` du contrat UI de la View |
| B-LSP-5 | **Find references / rename** | Mixins, paramètres, clés `@ui` (**renommage synchronisé** template ↔ View TypeScript) |
| B-LSP-6 | **Document symbols / outline**, **folding**, **selection range** | Mixins, `@each`, `@if`, îlots `@ui.x` |
| B-LSP-7 | **Semantic tokens** | Distinguer directives, expressions TS, attributs, mixins |
| B-LSP-8 | **Formatage** | Indentation Pug stable, idempotent ; formatage des expressions TS embarquées optionnel |
| B-LSP-9 | **Code actions** | « Ajouter `data-item-id` », « Créer l'entrée `uiElements` manquante », « Extraire en mixin », « Importer le type » |
| B-LSP-10 | **Signature help** | Paramètres de mixin à l'appel `+nom(` |
| B-LSP-11 | **Workspace** | Indexation multi-fichiers, invalidation incrémentale, prise en compte des changements des fichiers `.ts` liés (types, View) |

### 5.2 Exigences d'architecture LSP (B-LSPARCH)

- **B-LSPARCH-1 — Parseur tolérant** : sur du texte incomplet ou invalide, produire un AST partiel + diagnostics, **sans lever d'exception**
  (récupération d'erreur au niveau ligne/bloc ; les nœuds en erreur restent navigables). Sans cela, aucune complétion en cours de frappe. **Critère bloquant** ; à concevoir en phase 1.
- **B-LSPARCH-2 — Document TypeScript virtuel** : approche recommandée (celle de Volar/Vue) — générer, pour chaque `.pugx`, un **module TypeScript virtuel**
  où chaque expression est placée avec ses types de contexte (`data`, variables de boucle, paramètres de mixin), avec une **table de correspondance de positions**
  (source PugX ↔ code virtuel). Déléguer au **TypeScript `LanguageService`** : diagnostics, complétion, hover, definition, rename ; **remapper** les positions au retour.
  🧭 Évaluer : construire sur **Volar** (`@volar/language-server`, langages virtuels, service-scripts) **vs** serveur `vscode-languageserver` écrit à la main + virtual files.
  L'agent doit présenter le comparatif (effort, couplage, éditeurs supportés) avant de choisir.
- **B-LSPARCH-3 — Éditeur-agnostique** : transport stdio (+ IPC/socket optionnel), aucun appel spécifique VS Code dans le serveur ; testé au minimum avec VS Code et Neovim (`vim.lsp`).
- **B-LSPARCH-4 — Incrémental** : re-analyse du seul document modifié ; cache du graphe d'imports ; pas de `Program` TypeScript recréé à chaque frappe.
- **B-LSPARCH-5 — Performance et robustesse** : le serveur ne plante jamais sur une entrée invalide (fuzz), annule les requêtes obsolètes, borne la mémoire.
- **B-LSPARCH-6 — Couplage à `.ts`** : le serveur lit la configuration TypeScript du projet (`tsconfig`), résout les alias, et réagit aux changements de fichiers (`workspace/didChangeWatchedFiles`).
- **B-LSPARCH-7 — Adaptateur Bonsai côté LSP** : la validation template ↔ View (B-ANALYSIS-5) et la complétion des clés `@ui` passent par la même interface d'adaptateur que le compilateur.

### 5.3 Extensions d'éditeur (B-EXT)

| # | Besoin |
| --- | --- |
| B-EXT-1 | **Extension VS Code** `pugx-vscode` : déclare le langage (`.pugx`), lance le serveur, expose les réglages (chemin du serveur, adaptateur, niveau de log) |
| B-EXT-2 | **Grammaire TextMate** (`pugx.tmLanguage.json`) avec **injection TypeScript** dans les expressions (`@e(…)`, `@if(…)`, attributs dynamiques) pour une coloration correcte avant même le LSP |
| B-EXT-3 | `language-configuration.json` (commentaires, indentation, auto-fermeture), **snippets** (`@each`, `@if`, `@mixin`, îlot `@ui`) |
| B-EXT-4 | Commande « Compiler ce template » / « Afficher le TypeScript généré » (utile au débogage du générateur) |
| B-EXT-5 | Packaging `.vsix` reproductible ; 🧭 publication Marketplace/Open VSX hors périmètre initial |
| B-EXT-6 | Fichier de configuration projet `pugx.config.*` (adaptateur, alias, dossiers de templates), lu par le CLI, les plugins **et** le LSP |

---

## 6. Structure de dépôt proposée (🧭 à valider)

Monorepo pnpm, TypeScript ESM strict (`strict: true` **activé dès le début** — contrairement à Bonsai, où il ne l'est pas), Node ≥ 20 :

```text
pugx/
├── packages/
│   ├── core/          # lexer, parser tolérant, AST, analyse, IR  (sans Node)
│   ├── compiler/      # générateur TypeScript + sourcemaps + diagnostics
│   ├── adapter-bonsai/# règles Bonsai (clés, @ui, runtime, validation View)
│   ├── lsp/           # serveur LSP (+ document TS virtuel, mappings)
│   ├── cli/           # pugx build|check|watch
│   ├── vite-plugin/   # (+ rollup/esbuild)
│   ├── vscode/        # extension VS Code
│   └── runtime-ref/   # implémentation de référence du contrat runtime (tests)
├── fixtures/          # templates .pugx + sorties attendues + DOM serveur
└── docs/              # spec du langage (BNF), décisions (ADR courts), guide d'intégration
```

Outillage : **Vitest** (unitaires, snapshots), **jsdom** (comportement du code généré), `@vscode/test-electron` (extension), tests LSP en processus (client/serveur en mémoire).
Documentation : décisions courtes et « vivantes » (une décision par fichier, 30–80 lignes : contexte, décision, alternatives rejetées, conséquences) — format de Bonsai.

---

## 7. Qualité et tests (B-TEST)

| # | Besoin |
| --- | --- |
| B-TEST-1 | **Lexer/parser** : tests de table par construction ; **round-trip** source → AST → source pour le formateur ; **fuzz** (aucune exception, aucune boucle infinie) |
| B-TEST-2 | **Parseur tolérant** : jeux d'entrées tronquées à chaque position ; l'AST partiel doit rester valide et les diagnostics stables |
| B-TEST-3 | **Générateur** : *golden files* (`.pugx` → `.ts`) déterministes ; typecheck (`tsc`) des sorties ; sourcemaps vérifiées |
| B-TEST-4 | **Comportement** (jsdom) : pour chaque fixture, `create(d)` ≡ DOM serveur de référence ; `setup(serveur)` puis `project(d)` ne mute **aucun** nœud si les données sont identiques (règle H4) ; mutations minimales sur changement ciblé (compter les écritures DOM) ; listes : ajout/suppression/tri, clés dupliquées |
| B-TEST-5 | **Équivalence** création/hydratation (propriété) : pour des données générées aléatoirement, `create(d)` puis `project(d')` ≡ `create(d')` |
| B-TEST-6 | **LSP** : chaque fonctionnalité B-LSP-x a un test bout en bout (document ouvert → requête → réponse attendue), y compris sur documents invalides |
| B-TEST-7 | **Types** : tests de type (`@ts-expect-error`) vérifiés par `tsc` **dans la CI** (leçon Bonsai : Jest/Vitest en transpile-only ne les vérifient pas) |
| B-TEST-8 | **Sécurité** : `@e` n'injecte jamais de HTML ; jeux d'attaques XSS sur attributs et texte |
| B-TEST-9 | **Perf** : repères mesurés (parse/compile/diagnostics) sur templates de 100/500/2000 lignes, suivis dans la CI |

---

## 8. Leçons de Bonsai à appliquer

1. **Le code fait foi.** Ne pas écrire de documentation qui décrit du code inexistant sans encadré « ⏳ non livré ». Chaque document indique ce qui est livré.
2. **Vérifier ce que la CI vérifie réellement.** Dans Bonsai, `tsc --noEmit` ne couvrait que `lib/` et Jest ne type-check pas : les tests de type ne tournaient nulle part.
   Ici : `strict` activé, `tsc --noEmit` couvre **tout** (sources + tests), exécuté en pre-commit et en CI.
3. **Les contrats se testent bout en bout.** Bonsai a un test « gate » sans mock par étape ; prévoir une **gate PugX** : `.pugx` → build → DOM jsdom → interaction → mutation minimale.
4. **Ne pas coupler le cœur à un consommateur** (§4.5) ; sinon le langage suivra les erreurs du framework.
5. **Un parseur qui lève à la première erreur est incompatible avec un LSP** (le prototype hérité en est la preuve) : traiter la tolérance comme une exigence de conception, pas comme un correctif ultérieur.
6. **Les contrats à moitié spécifiés coûtent cher** : les sujets 🧭 B-PDR-3 (branches conditionnelles) et ADR-26 (arrivée des données) doivent être **tranchés avant** d'écrire le générateur correspondant.

---

## 9. Plan par phases proposé (à affiner avec le mainteneur)

| Phase | Livrable | Critère d'acceptation |
| --- | --- | --- |
| **0 — Cadrage** | Spécification du langage (grammaire, exemples, décisions 🧭 tranchées), structure du dépôt, CI (`tsc` strict + tests) | Le mainteneur valide le document ; la CI est verte sur un dépôt vide |
| **1 — Front-end** | Lexer + parseur **tolérant** + AST + formateur, avec tests de table, round-trip, fuzz | B-TEST-1/2 verts ; aucune exception sur les entrées tronquées |
| **2 — Analyse** | Résolution TS, types des expressions, inférence `each`/mixins, dépendances par nœud, clés, diagnostics | Erreurs de type remappées sur les bonnes plages ; `pugx check` opérationnel |
| **3 — Générateur** | `setup/project/create` pour les cas simples (texte, attributs, classes) puis `each` keyed puis conditions (après arbitrage B-PDR-3) ; runtime de référence | B-TEST-3/4/5 verts ; gate de bout en bout |
| **4 — Intégration build** | CLI, plugin Vite/Rollup/esbuild, déclarations `.pugx.d.ts` | Un projet d'exemple compile et s'exécute |
| **5 — LSP** | Diagnostics → hover → complétion → definition → rename → code actions, sur le document TS virtuel | B-TEST-6 ; démo VS Code + Neovim |
| **6 — Extension VS Code** | Grammaire TextMate + injection TS, snippets, configuration, `.vsix` | Installation locale ; coloration + LSP fonctionnels |
| **7 — Adaptateur Bonsai** | Validation template ↔ View, clés `@ui`, contrat runtime versionné | Un template réel de Bonsai (panier : `cart-items`) compile et passe la gate en face du runtime Bonsai |

> Les phases 1–3 sont indépendantes du LSP mais **doivent** exposer les API que le LSP consommera (positions, plages, AST partiel, mappings). Concevoir ces API en phase 1.

---

## 10. Questions ouvertes à soumettre au mainteneur (🧭)

1. **Syntaxe** : superset `@…` (brouillon) ou variantes ? Forme de la déclaration de données (B-LANG-2) ; attribut `@ui="x"` ou bloc `@ui.x` (B-LANG-8) ; sort des balises inline (B-LANG-9) et de `@code` (B-LANG-11) ?
2. **Conditions** dans une projection sans VDOM (B-PDR-3) : insertion/suppression, bascule `hidden`, ou interdiction hors îlot ?
3. **Volar ou LSP manuel** (B-LSPARCH-2) ?
4. **Neutralité** : un second adaptateur « DOM pur » (B-ARCH-3) ? Bonsai est-il le seul consommateur visé à moyen terme ?
5. **Rendu HTML serveur** (`render(data): string`, B-OUT-6) : dans le périmètre ou plus tard ?
6. **Nom de fichier** : `.pugx`, `.pug.template`, autre ? Interaction avec les outils existants (colorations Pug déjà installées).
7. **Distribution** : dépôt public/npm ? licence ? Publication de l'extension (Marketplace / Open VSX) ?
8. **Arrivée des données** (ADR-26 🟡) : sans effet sur `project(nodes, data)`, mais l'adaptateur Bonsai en dépend pour typer `select()`.
9. **Cibles de performance** (B-LSP-1, B-TEST-9) : les valeurs de ce brief sont des hypothèses à confirmer.

---

## 11. Références (à copier dans `docs/reference/` du nouveau dépôt)

- `docs/spec/5-rendu.md` — rendu PDR, compilateur, `ProjectionList`, syntaxe, erreurs
- `docs/spec/4-couche-concrete/view.md` §4 — modes A/B/C, `get templates()`, îlots
- `docs/adr/ADR-22-pdr.md`, `ADR-23-listes.md`, `ADR-24-hydratation-ssr.md`, `ADR-26-souscription-view.md`
- `docs/pugx/syntaxe-spec.md`, `spec-2.md`, `development-plan.md`
- `tools/pug-to-ts-template/` — prototype (lexer, parser, compilateur VDOM ; exemple `Page/`), **à consulter, pas à porter tel quel**

> **Précaution** : ces documents de Bonsai décrivent en grande partie une **cible** (strate 1c) ; seule la ligne « Livré » des ADR dit ce qui existe.
