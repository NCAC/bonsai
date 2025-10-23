# Framework Style Guide — Bonsai

> **Conventions d'usage, patterns recommandés et discipline HTML/DOM pour le code applicatif Bonsai**

---

| Champ             | Valeur                                           |
|-------------------|--------------------------------------------------|
| **Périmètre**     | Code applicatif framework (Views, Features, Entities, Channels, DOM) |
| **Ne couvre pas** | La pipeline de build (voir [BUILD-CODING-STYLE](BUILD-CODING-STYLE.md)) |
| **Statut**        | 🟢 Active                                        |
| **Créé le**       | 2026-03-17                                        |
| **Mis à jour**    | 2026-04-01                                        |
| **Dépend de**     | RFC-0001, RFC-0002, ADR-0001, ADR-0005            |

> ### Périmètre
> Ce guide s'applique au **code applicatif** écrit avec le framework Bonsai :
> Views, Features, Entities, Behaviors, Channels, conventions DOM/HTML/CSS,
> et les patterns d'API TypeScript publique.
>
> Pour les conventions internes du système de build (`lib/`, `tools/`),
> voir le [Build Coding Style](BUILD-CODING-STYLE.md).

---

## 📋 Table des matières

1. [Principe directeur : Types d'abord, récompense ensuite](#1-principe-directeur--types-dabord-récompense-ensuite)
2. [Conventions API TypeScript](#2-conventions-api-typescript)
3. [Conventions de nommage](#3-conventions-de-nommage)
   - [3.4 Architecture de dossiers — par domaine, pas par type](#34-architecture-de-dossiers--par-domaine-pas-par-type)
   - [3.5 Modules ESM Bonsai (ADR-0019)](#35-modules-esm-bonsai--convention-de-déclaration-adr-0019)
4. [Conventions de sélecteurs DOM](#4-conventions-de-sélecteurs-dom)

---

## 1. Principe directeur : Types d'abord, récompense ensuite

Bonsai repose sur un pattern universel, applicable à **chaque composant** du framework :

```
┌──────────────────────────────────────────────────────────────────┐
│  1. DÉCLARER LES TYPES (le contrat)                             │
│                                                                  │
│     Feature / Entity                                            │
│       → TChannelDefinition : Commands, Events, Requests typés   │
│       → TEntityStructure   : état jsonifiable (D10)             │
│                                                                  │
│     View / Behavior                                             │
│       → TUIMap : nœuds DOM, type HTML, events autorisés         │
│                                                                  │
│  2. IMPLÉMENTER LA CLASSE (en consommant ces types)             │
│     Feature → extends Feature<TEntityStructure, TChannel>       │
│            → implements TRequiredCommandHandlers<TChannel>       │
│     View   → extends View<[Namespace.Channel, ...], TUIMap>     │
│                                                                  │
│  3. RÉCOMPENSE AUTOMATIQUE (le compilateur travaille pour vous) │
│     Feature → handlers onXXXCommand/Event/Request auto-typés    │
│            → payloads typés, retours vérifiés compile-time      │
│     View   → handlers onXXXClick/Input auto-générés (D48)       │
│            → getUI() : TProjectionNode<HTMLButtonElement>       │
│     Tous   → Refactoring : renommer un symbole = erreur partout │
│            → Zéro runtime surprise : tout vérifié au build      │
└──────────────────────────────────────────────────────────────────┘
```

> **Principe** : ce que l'on « perd » en verbosité et en rigueur initiale,
> on le **gagne** dans l'implémentation — autocomplétion IDE, handlers
> auto-découverts, typage des paramètres et des valeurs de retour,
> refactoring sûr à l'échelle du projet.

### Conséquence sur les conventions de ce guide

Les sections qui suivent sont ordonnées par **niveau d'abstraction décroissant** :
d'abord les conventions API et TypeScript (le contrat, la source de vérité),
puis les conventions de nommage (la cohérence), et enfin les conventions
DOM/CSS/HTML (le détail d'implémentation).

Les sélecteurs CSS, les `id`, les `data-*` sont des **détails d'implémentation**
qui vivent dans `get params()` — overridables par le Composer (D34). Les types
(`TUIMap`, `TChannelDefinition`, `TEntityStructure`) sont le contrat immuable.

---

## 2. Conventions API TypeScript

### 2.1 Principe fondamental : Pas de magie

> **Règle absolue** : toute donnée contextuelle (metas, configuration, state)
> est passée **explicitement** en paramètre. Jamais de getter implicite,
> jamais de global state, jamais de "contexte magique".

**Justification** :
- **Async-safe** : le closure capture les valeurs, pas de problème avec les Promises
- **Testable** : les dépendances sont injectées, mockables
- **Debuggable** : le flux de données est visible
- **Prévisible** : pas de comportement qui dépend d'un état invisible

### 2.2 Pattern des signatures : Discriminant + Params

> **Règle** : quand une méthode a un **discriminant** (nom, intent, type),
> celui-ci est le **premier argument** (string), suivi d'un **objet de paramètres**.

```typescript
// ✅ PATTERN BONSAI : discriminant + params objet
method("DISCRIMINANT", { param1, param2, ... }, callback?);

// ❌ ANTI-PATTERN : tout dans un objet
method({ discriminant: "...", param1, param2, ... });

// ❌ ANTI-PATTERN : arguments positionnels multiples
method("DISCRIMINANT", param1, param2, param3);
```

#### Pourquoi ce pattern ?

| Critère | Discriminant 1er | Tout dans objet | Args positionnels |
|---------|-----------------|-----------------|-------------------|
| **Lisibilité** | ⭐⭐⭐ Intention immédiate | ⭐⭐ Chercher la clé | ⭐⭐ Compter les args |
| **IDE completion** | ⭐⭐⭐ Suggestions par discriminant | ⭐⭐ Union type | ⭐ Aucune aide |
| **Évolutivité** | ⭐⭐⭐ Ajouter params sans casser | ⭐⭐⭐ Idem | ⭐ Ordre figé |
| **Destructuring** | ⭐⭐⭐ `{ payload, metas }` | ⭐⭐⭐ Idem | ❌ Impossible |

#### Applications

```typescript
// ══════════════════════════════════════════════════════════════
// Entity.mutate() — ADR-0001
// L'intent est un string libre namespace:verbNoun
// ══════════════════════════════════════════════════════════════

// Forme complète (dans une Feature)
this.entity.mutate("cart:addItem", { payload, metas }, draft => {
  draft.items.push(payload.item);
});

// Forme simplifiée (sans params)
this.entity.mutate("cart:clear", draft => {
  draft.items = [];
});

// ══════════════════════════════════════════════════════════════
// Feature — emit() et request() sortants
// Les noms sont des clés NUES de TChannelDefinition (pas namespace-qualifiées)
// ══════════════════════════════════════════════════════════════

// emit() — émet un Event sur le Channel propre de la Feature
// Signature : emit(eventName, payload, { metas })
this.emit('itemAdded', { productId: payload.productId, qty: payload.qty }, { metas });

// request() — interroge un Channel externe déclaré en `static readonly request`
// Signature : request(channel, requestName, params, { metas })
const price = await this.request(Pricing.channel, 'getPrice', { productId }, { metas });

// ══════════════════════════════════════════════════════════════
// View / Behavior — trigger() sortant
// Les metas sont créées automatiquement (corrélation racine, ADR-0016, I54)
// ══════════════════════════════════════════════════════════════

// trigger() — envoie un Command vers la Feature propriétaire du Channel
// Signature : trigger(channel, commandName, payload) — PAS de metas
this.trigger(Cart.channel, 'addItem', { productId, qty });

// ══════════════════════════════════════════════════════════════
// Handlers — reçoivent (payload, metas) — ADR-0016
// ══════════════════════════════════════════════════════════════

onAddItemCommand(payload: AddItemPayload, metas: TMessageMetas) {
  // payload et metas explicites — Feature uniquement
}

onItemAddedEvent(payload: ItemAddedPayload, metas: TMessageMetas) {
  // payload et metas explicites — Feature (listen) ou View (listen)
}
```

### 2.3 Passage explicite des metas

> **Règle** : les `metas` sont **toujours** passées explicitement en paramètre.
> Pas de `this.currentMetas`, pas de `withMetas()`, pas de contexte implicite.

```typescript
// ✅ BON : metas explicites, closure les capture
async onAddItemCommand(payload: AddItemPayload, metas: TMessageMetas) {
  // Le handler reçoit metas en paramètre (ADR-0016)
  
  // Propager aux mutations — intent = string libre namespace:verbNoun
  this.entity.mutate("cart:addItem", { payload, metas }, draft => {
    draft.items.push(payload.item);
  });
  
  // Propager aux requests — channel token + clé nue + params + { metas }
  const price = await this.request(Pricing.channel, 'getPrice', { id: payload.id }, { metas });
  
  // Propager aux émissions — clé nue (keyof TChannel['events']) + payload + { metas }
  this.emit('itemAdded', { item: payload.item, price }, { metas });
}

// ❌ MAUVAIS : getter implicite
async onAddItemCommand(payload: AddItemPayload) {
  const metas = this.currentMetas; // NON — magie, problèmes async
}

// ❌ MAUVAIS : wrapper magique
async onAddItemCommand(payload: AddItemPayload) {
  await this.withMetas(async () => {
    // NON — magie, complexité inutile
  });
}
```

### 2.4 Objets vs arguments multiples

> **Règle** : au-delà de **2 arguments**, utiliser un **objet nommé**.
> Exception : le pattern discriminant + params est toujours OK.

```typescript
// ✅ BON : 2 arguments (ou discriminant + objet)
function createEntity(name: string, initialState: State) { }
function mutate(intent: string, recipe: Recipe) { }

// ✅ BON : objet pour 3+ paramètres logiques
function createFeature(config: {
  namespace: string;
  entity: EntityClass;
  channels: ChannelDeclaration;
  handlers?: HandlerMap;
}) { }

// ❌ MAUVAIS : arguments positionnels multiples
function createFeature(namespace, entity, channels, handlers) { }
```

### 2.5 Types : précision et inférence

> **Règle** : les types sont **explicites** dans les signatures publiques,
> **inférés** dans les implémentations internes.

```typescript
// ✅ BON : types explicites dans l'API publique
type TEntityEvent = {
  intent: string;
  payload?: unknown;
  metas?: TMessageMetas;
  patches: Patch[];
  inversePatches: Patch[];
  timestamp: number;
  changedKeys: string[];
}

// ✅ BON : inférence dans l'implémentation
const changedKeys = [...new Set(patches.map(p => String(p.path[0])))];
// TypeScript infère string[]
```

---

## 3. Conventions de nommage

### 3.1 Intents et noms de messages

| Pattern | Format | Exemples | Contexte |
|---------|--------|----------|----------|
| **Intent mutation** | `namespace:verbNoun` | `"cart:addItem"`, `"user:updateProfile"` | String libre dans `entity.mutate()` |
| **Command name** (clé Channel) | `verbNoun` | `'addItem'`, `'submit'` | `keyof TChannel['commands']` |
| **Event name** (clé Channel) | `nounVerbed` | `'itemAdded'`, `'submitted'` | `keyof TChannel['events']` |
| **Request name** (clé Channel) | `getNoun` | `'getPrice'`, `'getProfile'` | `keyof TChannel['requests']` |

> **Attention** : les intents de mutation sont des strings libres `namespace:verbNoun`
> (utilisés dans `entity.mutate()` pour la traçabilité). Les noms de Commands/Events/Requests
> sont des **clés nues** du `TChannelDefinition` — sans préfixe namespace.
> Le namespace est porté par le **channel token**, pas par le nom du message.

### 3.2 Conventions TypeScript

| Élément | Convention | Exemples |
|---------|------------|----------|
| **Classe** | PascalCase | `CartFeature`, `ProductView` |
| **Type structurel** (données, state, config, payload) | PascalCase, préfixe `T` | `TEntityStructure`, `TChannelDefinition`, `TMessageMetas` |
| **Type contractuel** (utilisé en `implements`, API surface) | PascalCase, préfixe `T` | `TRequiredCommandHandlers`, `TProjectionNode` |
| **Type utilitaire** (mapped, conditional, template literal) | PascalCase, **sans** préfixe | `ExtractHandlerName`, `UnionToIntersection` |
| **Type namespace-scoped** | Qualifié par namespace, **sans** préfixe | `Cart.Channel`, `Cart.State` |
| **Interface** (si utilisée exceptionnellement) | PascalCase, préfixe `I` | `IProject`, `IConfig` |
| **Méthode** | camelCase | `mutate()`, `emit()`, `onAddItem()` |
| **Handler** | `on` + EventName en PascalCase | `onAddItemCommand`, `onItemAddedEvent` |
| **Constante** | SCREAMING_SNAKE | `MAX_HOPS`, `DEFAULT_TIMEOUT` |
| **Namespace** | camelCase | `cart`, `userProfile`, `pricing` |

### 3.3 Fichiers et dossiers

| Type | Convention | Exemples |
|------|------------|----------|
| **Feature** | `namespace.feature.ts` | `cart.feature.ts` |
| **Entity** | `namespace.entity.ts` | `cart.entity.ts` |
| **View** | `ComponentName.view.ts` | `CartView.view.ts` |
| **Behavior** | `BehaviorName.behavior.ts` | `Tooltip.behavior.ts` |
| **Tests** | `*.test.ts` | `cart.feature.test.ts` |

> **Note** : il n'y a **pas** de fichier `.channel.ts` séparé.
> Le Channel (`TChannelDefinition`) et le State sont **co-localisés**
> dans le fichier `.feature.ts` (décisions D13/D14).
> Voir [RFC-0001 Glossaire §3](../rfc/reference/glossaire.md#structure-des-fichiers-et-dossiers-angular-style-guide).

### 3.4 Architecture de dossiers — par domaine, pas par type

> **DEVRAIT** : le code applicatif **DEVRAIT** être organisé en **un dossier
> par domaine/fonctionnalité**, regroupant tous les fichiers du domaine
> (Feature, Entity, View, Behavior, Composer, styles, templates).

> **NE DEVRAIT PAS** : le code applicatif **NE DEVRAIT PAS** être organisé
> par type de composant (un dossier `views/`, un dossier `features/`, etc.).

**Justification** :
- **Cohésion métier** : tout ce qui concerne le panier est dans `Cart/`, pas éparpillé entre 5 dossiers
- **Navigation IDE** : ouvrir un dossier = voir tout le domaine
- **Refactoring** : supprimer un domaine = supprimer un dossier
- **Encapsulation** : le point d'entrée public est `namespace.feature.ts`, le reste est privé au domaine
- **Scalabilité** : chaque domaine est autonome, pas de dossier `views/` qui grossit avec chaque feature

#### ✅ Organisation par domaine (recommandée)

```
src/
  Cart/
    cart.feature.ts         # Feature + Channel + State (D13/D14)
    cart.entity.ts          # Entity
    cart.view.ts            # View
    cart.behavior.ts        # Behavior(s) optionnel(s)
    cart.composer.ts        # Composer(s) optionnel(s)
    cart.template.pug       # Template
    cart.styles.scss        # Styles
    cart.feature.test.ts    # Tests
  Product/
    product.feature.ts
    product.entity.ts
    product.view.ts
    product.template.pug
    product.styles.scss
  Checkout/
    checkout.feature.ts
    checkout.entity.ts
    checkout.view.ts
    checkout.template.pug
```

```typescript
// Imports par alias de domaine (recommandé)
import { Cart } from '@cart/cart.feature';
import { Product } from '@product/product.feature';

// Ou imports relatifs entre domaines
import { Cart } from '../Cart/cart.feature';
```

#### ❌ Organisation par type de composant (anti-pattern)

```
src/
  features/
    cart.feature.ts
    product.feature.ts
    checkout.feature.ts
  views/
    cart.view.ts
    product.view.ts
    checkout.view.ts
  entities/
    cart.entity.ts
    product.entity.ts
    checkout.entity.ts
```

**Pourquoi c'est un anti-pattern** :
- Modifier le panier oblige à naviguer dans 3+ dossiers
- Aucune visibilité sur la cohésion d'un domaine
- La suppression d'une feature demande de toucher N dossiers
- Les imports croisés deviennent illisibles (`../../features/` vs `../../views/`)

> **Référence** : la convention de structure est définie dans
> [RFC-0001 Glossaire §3](../rfc/reference/glossaire.md#structure-des-fichiers-et-dossiers-angular-style-guide)
> et s'inspire de l'[Angular Style Guide](https://angular.dev/style-guide) (D5).

### 3.5 Modules ESM Bonsai — convention de déclaration (ADR-0019)

En **Mode ESM Modulaire**, chaque composant Bonsai est distribué sous forme
d'un module ES natif (`*.esm.js` + `*.d.ts`). Le module déclare ses composants
dans le `BonsaiRegistry` au top-level — sans side-effect métier.

#### Convention de déclaration

```typescript
// ✅ cart-feature.esm.ts — déclaration pure au top-level
import { BonsaiRegistry } from '/bonsai/bonsai.esm.js';
import { CartFeature } from './cart.feature.js';

BonsaiRegistry.registerFeature(CartFeature);
// C'est tout. Pas de logique métier, pas de démarrage d'application.
```

```typescript
// ❌ Anti-pattern — side-effect métier à l'import (interdit, ADR-0019 C3, D9)
import { BonsaiRegistry } from '/bonsai/bonsai.esm.js';
import { CartFeature } from './cart.feature.js';

BonsaiRegistry.registerFeature(CartFeature);
const cart = new CartEntity();  // ❌ Side-effect métier
cart.init();                    // ❌ Logique exécutée à l'import
```

#### Convention de nommage des artefacts

| Type | Convention | Exemple |
|------|-----------|---------|
| Module ESM navigateur | `{nom}.esm.js` | `cart.feature.esm.js` |
| Déclaration TypeScript | `{nom}.d.ts` | `cart.feature.d.ts` |
| Source map JS | `{nom}.esm.js.map` | `cart.feature.esm.js.map` |
| Runtime Bonsai ESM | `bonsai.esm.js` | — |
| Runtime Bonsai IIFE | `bonsai.iife.js` | — |
| Bundle IIFE applicatif | `{app}.bundle.iife.js` | `app.bundle.iife.js` |

> **Règle** : distribuer un `*.esm.js` sans son `*.d.ts` est **interdit**
> (ADR-0019 C7 — le type EST la documentation).

---

## 4. Conventions de sélecteurs DOM

### 4.1 Principe de séparation des mécanismes

Chaque mécanisme HTML a un rôle **unique et non interchangeable** :

| Mécanisme | Rôle | Propriétaire | Mutable à l'exécution ? |
|-----------|------|-------------|------------------------|
| **Classe CSS** | Exprime le **rôle/contexte sémantique** de l'élément | CSS (style) · JS (lecture seule) | **Non** — ne change jamais à l'exécution |
| **`id`** | **Ciblage JavaScript** — point d'ancrage unique, intention marquée | JS (exclusif) | **Non** — identifiant stable |
| **`data-*`** | **États/paramètres dynamiques** — zone de communication CSS↔JS | JS (écriture) · CSS (lecture via sélecteurs d'attribut) | **Oui** — valeur modifiée par JS |

> **Principe** : les classes disent *ce que c'est* (rôle), les `id` disent *où
> accrocher le JS* (ancrage), les `data-*` disent *dans quel état c'est*
> (dynamique).

### 4.2 Classes CSS — rôle et contexte sémantique

Les classes CSS expriment le rôle d'un élément dans le document. Elles **PEUVENT**
être utilisées comme sélecteurs dans les `uiElements` d'une View quand l'élément
a un rôle sémantique clair.

```typescript
// La classe CSS exprime le rôle → utilisable comme sélecteur uiElements
get uiElements() {
  return {
    addButton:    '.ProductCard-addToBasket',
    priceDisplay: '.ProductCard-price',
    gallery:      '.ProductCard-gallery',
  };
}
```

**Règles** :
- Une classe CSS **NE DOIT PAS** représenter un état (`is-open`, `is-active`).
  Les états dynamiques sont portés par des `data-*` (§1.4).
- Une classe CSS **NE DOIT PAS** être modifiée par le JavaScript applicatif
  (la Foundation peut altérer les classes de `<html>`/`<body>` en N1, mais c'est
  une exception contrôlée par le framework).

### 4.3 Identifiants (`id`) — ciblage JavaScript pur

Les `id` sont réservés au ciblage JavaScript. Ils **NE DOIVENT PAS** être
utilisés dans les sélecteurs CSS.

Dans Bonsai, les `id` servent à deux usages :

#### 4.3.1 Slots de composition — `#name-slot`

Les éléments qui servent de **slots** pour les Composers utilisent un `id`
avec le suffixe `-slot`. Le slot est un conteneur structurel pur — il n'a
pas de rôle visuel propre, il sert de point d'ancrage JS.

```html
<!-- Slots racines (Foundation) -->
<div id="header-slot"></div>
<div id="main-slot"></div>
<div id="footer-slot"></div>

<!-- Slots enfants (View) -->
<div id="sidebar-slot"></div>
<div id="content-slot"></div>
```

**Convention** : `#kebab-case-slot` — le suffixe `-slot` marque l'intention.

Usage dans la Foundation :

```typescript
get composers() {
  return {
    '#header-slot': HeaderComposer,
    '#main-slot':   MainContentComposer,
    '#footer-slot': FooterComposer,
  };
}
```

Usage dans une View (les clés de `get composers()` doivent correspondre
à des entrées dans `get uiElements()`) :

```typescript
get uiElements() {
  return {
    sidebarSlot: '#sidebar-slot',
    contentSlot: '#content-slot',
    itemList:    '.LayoutMain-itemList',
  };
}

get composers() {
  return {
    sidebarSlot: SidebarComposer,
    contentSlot: ContentComposer,
  };
}
```

#### 4.3.2 Point d'ancrage View — `#name-view`

Le `rootElement` d'une View utilise un `id` avec le suffixe `-view`.
Cela marque l'intention explicite : *cet élément est le point d'ancrage
JS d'une View spécifique*.

```html
<div id="header-slot">
  <header id="header-view" class="AppHeader">…</header>
</div>
<div id="main-slot">
  <main id="main-view" class="ProductList">…</main>
</div>
```

```typescript
get rootElement() { return '#header-view'; }
```

**Convention** : `#kebab-case-view` — le suffixe `-view` marque l'intention.

> **Note** : l'élément existe **avant** que la View ne s'y attache (SSR).
> Le suffixe `-view` indique l'intention d'ancrage framework, pas le statut
> courant de l'élément.

#### 4.3.3 Récapitulatif `id`

| Suffixe | Usage | Exemple | Résolu par |
|---------|-------|---------|-----------|
| `-slot` | Point d'ancrage d'un Composer | `#header-slot` | `querySelector()` (Foundation ou `@ui`) |
| `-view` | rootElement d'une View | `#header-view` | `slotElement.querySelector()` |

### 4.4 Attributs `data-*` — états dynamiques

Les `data-*` représentent des **états/paramètres qui changent à l'exécution**,
pilotés par JavaScript (projections PDR, Behaviors).

```html
<!-- État dynamique — piloté par JS -->
<nav class="MainNav" data-state="open">…</nav>
<div class="ProductGallery" data-gallery-active="0">…</div>
<body data-theme="dark" data-device-type="mobile">
```

```css
/* Les data-* PEUVENT être ciblés en CSS pour refléter les états */
.MainNav[data-state="open"] { transform: translateX(0); }
```

**Règles** :
- Un `data-*` **DOIT** pouvoir varier au cours du cycle de vie de la page
  et **DOIT** être effectivement modifié par JavaScript.
- Un `data-*` **NE DOIT PAS** représenter un variant sémantique statique
  (qui mériterait une classe CSS distincte).
- Nommage : **`kebab-case`** — `data-gallery-active`, `data-slide-index`.

### 4.5 Synthèse par composant Bonsai

| Composant | Élément DOM | Sélecteur | Mécanisme | Justification |
|-----------|-------------|-----------|-----------|---------------|
| **Foundation** | Slot racine | `#header-slot` | `id` | Ciblage JS pur — point d'ancrage Composer |
| **View** | rootElement | `#header-view` | `id` | Ciblage JS — ancrage de la View dans le slot |
| **View** | uiElements (interaction) | `.ProductCard-addToBasket` | classe CSS | Rôle sémantique dans le contexte du Bloc |
| **View** | uiElements (slot enfant) | `#sidebar-slot` | `id` | Ciblage JS pur — point d'ancrage Composer enfant |
| **View / Behavior** | États dynamiques | `data-state="open"` | `data-*` | Piloté par JS, mutable à l'exécution |
| **Foundation** | Altération N1 | `data-theme="dark"` | `data-*` | État global piloté par JS |

### 4.6 Exemple complet HTML

```html
<!DOCTYPE html>
<html lang="fr" data-theme="light">
<head>…</head>
<body>
  <!-- Foundation: slots racines (#name-slot) -->
  <div id="header-slot">
    <!-- View: rootElement (#name-view) + classe CSS (rôle) -->
    <header id="header-view" class="AppHeader">
      <nav class="AppHeader-nav">…</nav>
      <div class="AppHeader-cartBadge" data-item-count="3">…</div>
    </header>
  </div>

  <div id="main-slot">
    <main id="main-view" class="ProductList">
      <!-- uiElements → classes CSS (rôle sémantique) -->
      <ul class="ProductList-items">…</ul>
      <button class="ProductList-loadMore">Charger plus</button>

      <!-- Slots enfants pour Composers (#name-slot) -->
      <aside id="sidebar-slot">
        <div id="sidebar-view" class="ProductFilters">…</div>
      </aside>
    </main>
  </div>

  <div id="footer-slot">
    <footer id="footer-view" class="AppFooter">
      <p class="AppFooter-copyright">© 2026</p>
    </footer>
  </div>
</body>
</html>
```

```
Foundation(<body>)
  ├─ '#header-slot'  → HeaderComposer    → HeaderView (#header-view)
  ├─ '#main-slot'    → MainContentComposer → ProductListView (#main-view)
  │                                            └─ '#sidebar-slot' → SidebarComposer → FiltersView (#sidebar-view)
  └─ '#footer-slot'  → FooterComposer   → FooterView (#footer-view)
```

### 4.7 Pattern — Composition hétérogène typée par attribut

Quand un conteneur accueille **N slots de types différents encodés dans un attribut DOM**,
utilisez des sélecteurs d'attribut dans `uiElements` combinés à `get composers()`.
Le framework résout chaque sélecteur par `querySelectorAll` : **un Composer est instancié
pour chaque élément matché**.

**Cas typiques** : formulaires CMS (champs selon le bundle), éditeurs de blocs,
dashboards configurables, configurateurs produit.

#### HTML — le type est dans l'attribut

```html
<form id="node-edit-form-view">
  <input name="title" class="NodeEditForm-titleField" />
  <div data-field-type="editorjs" data-field-id="field_body"></div>
  <div data-field-type="media"    data-field-id="field_image"></div>
  <div data-field-type="editorjs" data-field-id="field_excerpt"></div>
  <button class="NodeEditForm-submit" type="submit">Enregistrer</button>
</form>
```

#### TypeScript — déclaratif, compile-time

```typescript
type TNodeEditFormViewUI = TUIMap<{
  editorJsSlot:   { el: HTMLDivElement;    event: [] };
  mediaFieldSlot: { el: HTMLDivElement;    event: [] };
  submitButton:   { el: HTMLButtonElement; event: ['click'] };
  titleField:     { el: HTMLInputElement;  event: ['input'] };
}>;

class NodeEditFormView extends View<[NodeEdit.Channel], TNodeEditFormViewUI> {
  get uiElements() {
    return {
      editorJsSlot:   '[data-field-type="editorjs"]', // querySelectorAll → 0, 1, ou N
      mediaFieldSlot: '[data-field-type="media"]',     // querySelectorAll → 0, 1, ou N
      submitButton:   '.NodeEditForm-submit',           // → 1 élément
      titleField:     '.NodeEditForm-titleField',       // → 1 élément
    };
  }

  get composers() {
    return {
      editorJsSlot:   EditorJsComposer,    // 1 instance par [data-field-type="editorjs"]
      mediaFieldSlot: MediaFieldComposer,  // 1 instance par [data-field-type="media"]
    };
  }

  onSubmitButtonClick(e: TUIEventFor<TNodeEditFormViewUI, 'submitButton', 'click'>) {
    // trigger() : channel token + clé nue (keyof commands) + payload — pas de metas (I54)
    this.trigger(NodeEdit.channel, 'submit', {});
  }

  onTitleFieldInput(e: TUIEventFor<TNodeEditFormViewUI, 'titleField', 'input'>) {
    this.trigger(NodeEdit.channel, 'titleChanged', {
      value: e.currentTarget.value,
    });
  }
}
```

> **Résultat sur le DOM ci-dessus** : 2 `EditorJsComposers` (body + excerpt) et
> 1 `MediaFieldComposer` (image). La View déclare **les types** — le framework
> décide **combien** d'après le DOM au runtime.

#### Pourquoi ce n'est pas de la composition cachée

| Élément | Visible | Vérifié |
|---------|---------|--------|
| Types de slots | `TUIMap` | compile-time — TypeScript |
| Sélecteurs CSS | `uiElements` | bootstrap — erreur si sélecteur invalide |
| Composer par type | `get composers()` | compile-time — clé doit exister dans `keyof TUI` |

La View sait **quels types** elle accepte (statique), pas **combien** d'instances
(déterminé par le DOM au runtime). C'est la séparation correcte des responsabilités.

#### ❌ Anti-pattern — logique dans `get composers()`

```typescript
// ❌ INTERDIT — get composers() est un getter déclaratif, jamais un scanner DOM
get composers() {
  // Non : get composers() est évalué au bootstrap, this.el n'est pas encore résolu
  return Object.fromEntries(
    [...this.el.querySelectorAll('[data-field-type]')]
      .map(el => [el.id, resolveComposer(el.dataset.fieldType)])
  );
}

// ✅ CORRECT — déclaratif, compile-time, le framework fait le reste
get composers() {
  return {
    editorJsSlot:   EditorJsComposer,
    mediaFieldSlot: MediaFieldComposer,
  };
}
```

---


## Annexe : Récapitulatif des anti-patterns

### ❌ Magie / Implicite

```typescript
// NON — getter magique
const metas = this.currentMetas;

// NON — contexte implicite
await this.withMetas(async () => { });

// NON — global state
MetaContext.current();
```

### ❌ Arguments positionnels excessifs

```typescript
// NON — 4+ arguments positionnels
createView(name, element, template, behaviors, options);

// OUI — objet de config
createView({ name, element, template, behaviors, options });
```

### ❌ Intent manquant ou générique

```typescript
// NON — pas d'intent
this.entity.mutate(draft => { });

// NON — intent générique
this.entity.mutate("update", draft => { });

// OUI — intent métier explicite
this.entity.mutate("cart:addItem", draft => { });
```
