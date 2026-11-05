# Framework Style Guide — Bonsai

> **Conventions d'usage, patterns recommandés et discipline HTML/DOM pour le code applicatif Bonsai**

> 🟢 **Aligné sur la théorie V0.9.5 et sur le code livré (4 novembre 2026).** Les exemples utilisent l'API du noyau : contextes de handler (`ctx.mutate`, `ctx.emit`, `ctx.query`, `ctx.trigger`), handlers `on{Nom}Query`, composition par `resolve(ctx)`. Les mécanismes non livrés sont marqués ⏳. En cas d'écart, la [théorie](../theorie.md) prévaut ([règle de confiance](../README.md#règle-de-confiance-et-dalignement)).

---

| Champ | Valeur |
| --- | --- |
| **Périmètre** | Code applicatif framework (Views, Features, Entities, Composers, Foundation, DOM) |
| **Ne couvre pas** | La pipeline de build (voir [BUILD-CODING-STYLE](BUILD-CODING-STYLE.md)) |
| **Statut** | 🟢 Active |
| **Créé le** | 2026-03-17 |
| **Mis à jour** | 2026-11-04 (API du noyau) |
| **Dépend de** | [spec](../spec/README.md), [ADR-04](../adr/ADR-04-metas-explicites.md), [ADR-08](../adr/ADR-08-namespace-manifest.md), [ADR-09](../adr/ADR-09-feature-contract.md), [ADR-10](../adr/ADR-10-entity-mutation.md), [ADR-14](../adr/ADR-14-contrats-types.md) |

> **Patterns courants, en un coup d'œil :**
>
> - **Feature** : `class extends Feature<E, TDef, "ns">` avec `static readonly channel: TChannelToken<TDef, "ns">` et `get listens()` / `get queries()` d'instance (ADR-09, I93). Pas de `static namespace` (I68).
> - **Manifest applicatif** : `new Application({ foundation, features, document }).start()` où `features satisfies StrictManifest<AppManifest>` (ADR-08).
> - **View** : `extends View<TViewContract<F, U>>` + `implements TViewCallbacks<TVC>` (I88). Trois getters : `features` / `uiEvents` / `uiElements` ; optionnels : `template`, `composers`.
> - **Helper UI** : `ui<TEl>()(events, options?)` curryfié (I85).
> - **Query côté Feature** : `ctx.query(OtherFeature.channel, "name", params)` — token typé explicite (ADR-14).
> - **Query côté View et Composer** : `ctx.query("ns:name", params)` — clé plate namespacée (I80).
> - **Une Query est synchrone** et rend une valeur, jamais une `Promise` ni un `null` de substitution ; son échec fait échouer l'unité de l'auteur (G5, G7).
> - **Command** : seul le handler d'un fait du DOM commande (`ctx.trigger("ns:cmd", payload)`, D18) ; une Feature ne commande jamais (D17).
>
> ## Périmètre
>
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
   - [3.5 Modules ESM Bonsai (ADR-27)](#35-modules-esm-bonsai--convention-de-déclaration-adr-27)
4. [Conventions de sélecteurs DOM](#4-conventions-de-sélecteurs-dom)

---

## 1. Principe directeur : Types d'abord, récompense ensuite

Bonsai repose sur un pattern universel, applicable à **chaque composant** du framework :

```text
┌──────────────────────────────────────────────────────────────────┐
│  1. DÉCLARER LES MODULES CONTRACTUELS (header du fichier)       │
│                                                                  │
│     Feature / Entity                                            │
│       → TChannelDefinition : Commands, Events, Queries typés    │
│       → Entity<TStructure> : état jsonifiable (ADR-10)             │
│                                                                  │
│     View / Behavior / Composer (consommateurs — ADR-14)       │
│       → TFeatureContract : Features consommées (Feature-groupé) │
│       → TUIContract      : nœuds DOM + events (View/Behavior)   │
│       → TUIElements<TUI> : sélecteurs CSS (overridable ADR-21)     │
│                                                                  │
│  2. COMPOSER LE CONTRAT DU COMPOSANT (un alias type)            │
│     View      → type TXxxContract = TViewContract<F, U>         │
│     Composer  → type TXxxContract = TComposerContract<F, Views> │
│     Behavior  → ⏳ TBehaviorContract<F, U> (strate 2)           │
│                                                                  │
│  3. IMPLÉMENTER LA CLASSE — un générique, un implements (C2/C3) │
│     class XxxView                                               │
│       extends View<TXxxContract>                                │
│       implements TViewCallbacks<TXxxContract>                   │
│                                                                  │
│  4. RÉCOMPENSE AUTOMATIQUE (le compilateur travaille pour vous) │
│     Feature → handlers onXxxCommand/Event/Query auto-typés      │
│     View   → onXxxClick/Input requis si events DOM déclarés     │
│           → onNsEventEvent requis si listens déclarées          │
│           → ctx.trigger / ctx.query : clés et payloads typés    │
│     Tous   → Refactoring : renommer un symbole = erreur partout │
│           → Zéro runtime surprise : tout vérifié au build       │
└──────────────────────────────────────────────────────────────────┘
```

> **Principe** : ce que l'on « perd » en verbosité initiale dans le header,
> on le **gagne** dans l'implémentation — autocomplétion IDE, handlers requis
> par `implements`, payloads et retours typés, refactoring sûr à l'échelle.

### Règle universelle : symétrie `Contract` / `Callbacks` (ADR-14, I88)

> **Règle absolue** : pour chaque composant Bonsai, le package qui l'expose
> DOIT fournir **deux types publics** :
>
> - `T{Component}Contract` — ce que le composant **déclare** (Features
>   consommées, UI manipulée, capacités).
> - `T{Component}Callbacks<TC>` — ce que le composant **doit implémenter**
>   (handlers `on*` dérivés du contrat, requis par `implements`).
>
> **« On respecte toujours un contrat signé. »** Une déclaration sans
> son contrat d'implémentation est interdite — elle exposerait des capacités
> non-honorées.

| Composant | Contract | Callbacks | État |
| --- | --- | --- | --- |
| **Feature** | `TChannelDefinition` + `listens`/`queries` | `TFeatureCallbacks<TDef, Listens, E>` | ✅ |
| **View** | `TViewContract<F, U, P?>` (P : paramètres de création, ADR-18) | `TViewCallbacks<TVC>` | ✅ |
| **Composer** | `TComposerContract<F, Views>` | — (un seul point de décision : `resolve(ctx)`, imposé par la classe abstraite) | ✅ |
| **Foundation** | — (`get composers()` seulement) | — | ✅ |
| **Behavior** | `TBehaviorContract<F, U>` | `TBehaviorCallbacks<TBC>` | ⏳ strate 2 |

La règle vaut là où le composant a des handlers dérivés de son contrat : Feature, View, et plus tard Behavior. Un Composer n'a qu'un point de décision et une Foundation aucun.

Le développeur applicatif écrit toujours la paire dans la signature de classe :

```ts
class XxxView
  extends View<TXxxContract>                     // ← contrat déclaré
  implements TViewCallbacks<TXxxContract>        // ← contrat implémenté
{
  // Le compilateur exige tous les handlers `on*` dérivés du contrat.
  // Un handler manquant → erreur compile (I88).
}
```

Les types intermédiaires (`TFeatureContract`, `TUIContract`, …) sont des
**modules contractuels** réutilisables entre composants. Le développeur
applicatif les compose dans le header, mais sa **surface d'API** reste la
paire `Contract` + `Callbacks` du composant qu'il écrit.

### Conséquence sur les conventions de ce guide

Les sections qui suivent sont ordonnées par **niveau d'abstraction décroissant** :
d'abord les conventions API et TypeScript (les modules contractuels, source de vérité),
puis les conventions de nommage (la cohérence), et enfin les conventions
DOM/CSS/HTML (le détail d'implémentation).

Les **sélecteurs CSS**, les `id`, les `data-*` sont des **détails d'implémentation**
qui vivent dans `get uiElements()` — overridables par le Composer (ADR-21, ADR-14).
Les modules contractuels (`TFeatureContract`, `TUIContract`, `TChannelDefinition`,
`TStructure` d'`Entity<TStructure>`) sont le contrat immuable.

---

## 2. Conventions API TypeScript

### 2.1 Principe fondamental : Pas de magie

> **Règle absolue** : toute donnée contextuelle (contexte causal, configuration, state)
> est passée **explicitement** en paramètre. Jamais de getter implicite,
> jamais de global state, jamais de "contexte magique".

**Justification** :

- **Borné à l'unité** : le contexte reçu par un handler n'est valide que pendant son unité de validation ; utilisé plus tard (dans un `.then()`), il est refusé (`NO_UNIT`, A5.a)
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
| --- | --- | --- | --- |
| **Lisibilité** | ⭐⭐⭐ Intention immédiate | ⭐⭐ Chercher la clé | ⭐⭐ Compter les args |
| **IDE completion** | ⭐⭐⭐ Suggestions par discriminant | ⭐⭐ Union type | ⭐ Aucune aide |
| **Évolutivité** | ⭐⭐⭐ Ajouter params sans casser | ⭐⭐⭐ Idem | ⭐ Ordre figé |
| **Destructuring** | ⭐⭐⭐ `{ payload }` | ⭐⭐⭐ Idem | ❌ Impossible |

#### Applications

```typescript
// ══════════════════════════════════════════════════════════════
// ctx.mutate() — ADR-10, dans un handler de la Feature
// L'intent est un string libre namespace:verbNoun
// ══════════════════════════════════════════════════════════════

// Forme complète
ctx.mutate("cart:addItem", { payload }, (draft) => {
  draft.items.push(payload.item);
});

// Forme simplifiée (sans params)
ctx.mutate("cart:clear", (draft) => {
  draft.items = [];
});

// ══════════════════════════════════════════════════════════════
// Feature — ctx.emit() et ctx.query() sortants
// Les noms sont des clés NUES de TChannelDefinition
// ══════════════════════════════════════════════════════════════

// emit() — émet un Event sur le Channel propre de la Feature, délivré après
// la validation de l'unité (G5). Signature : emit(eventName, payload) ; le
// contexte causal est rattaché par le noyau, jamais passé en argument (ADR-04).
ctx.emit("itemAdded", { productId: payload.productId, qty: payload.qty });

// query() — interroge un Channel déclaré dans `get queries()` (ADR-09, I93)
// Synchrone (G5) : query(token, name, params) → la valeur typée, jamais null de substitution.
const total = ctx.query(PricingFeature.channel, "total", { productId });

// ══════════════════════════════════════════════════════════════
// View — ctx.trigger() sortant, depuis le handler d'un fait du DOM
// Le contexte causal est créé par le noyau (G8) ; lisible par ctx.cause (ADR-04).
// ══════════════════════════════════════════════════════════════

// Clé namespacée plate (I80), validée compile-time contre TFlatTriggers<F>
// dérivé de get features().
ctx.trigger("cart:addItem", { productId, qty });

// ══════════════════════════════════════════════════════════════
// Handlers — (payload, ctx) ; ctx.cause : contexte causal en lecture seule
// ══════════════════════════════════════════════════════════════

onAddItemCommand(payload: TAddItemPayload, ctx: TFeatureContext<TCartDef, CartEntity>): void {
  // Handler de Command sur le Channel propre (C2)
}

// Listener cross-Channel : on{NS}{Event}Event — le préfixe NS désigne la
// Feature source. Une Feature ne s'écoute jamais elle-même (get listens()).
onCartItemAddedEvent(payload: TItemAddedPayload, ctx: TFeatureContext<TPromoDef, PromoEntity>): void {
  // Feature (listens) ou View (features[ns].listens, contexte sans trigger)
}
```

### 2.3 Contexte causal : lu par `ctx.cause`, jamais fourni

> **Règle** : le contexte causal arrive **explicitement** par le paramètre `ctx`
> du handler et se lit par `ctx.cause` (lecture seule, ADR-04). Tout ce qui est
> soumis par `ctx` lui est rattaché par le noyau ; aucune API n'accepte un
> contexte fourni par l'application. Pas de `this.currentMetas`, pas de
> `withMetas()`, pas de `emit(name, payload, { metas })`.

```typescript
// ✅ BON : tout passe par le contexte reçu en paramètre
onAddItemCommand(payload: TAddItemPayload, ctx: TFeatureContext<TCartDef, CartEntity>): void {
  // Propager aux mutations — intent "namespace:verbNoun" (ADR-10)
  ctx.mutate("cart:addItem", { payload }, (draft) => {
    draft.items.push(payload.item);
  });

  // Query synchrone (G5), sans await
  const total = ctx.query(PricingFeature.channel, "total", { id: payload.id });

  // Émission — clé nue (keyof TChannel['events']) + payload
  ctx.emit("itemAdded", { item: payload.item, total });
}

// ❌ MAUVAIS : getter implicite au lieu de ctx.cause
onAddItemCommand(payload: TAddItemPayload, ctx: TFeatureContext<TCartDef, CartEntity>): void {
  const metas = this.currentMetas; // NON — magie
}

// ❌ MAUVAIS : contexte conservé hors de son unité
onAddItemCommand(payload: TAddItemPayload, ctx: TFeatureContext<TCartDef, CartEntity>): void {
  fetch("/api").then(() => ctx.emit("itemAdded", payload)); // NON — refusé (NO_UNIT, A5.a)
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
// ✅ BON : types explicites dans l'API publique — forme réelle et complète
// (packages/entity/src/bonsai-entity.ts) ; `context` est posé par le noyau
// (ADR-04), jamais fourni à ctx.mutate().
type TEntityEvent<
  TStructure extends TJsonSerializable = TJsonSerializable
> = {
  readonly intent: string;
  readonly payload?: unknown;
  readonly context: TCausalContext;
  readonly changedKeys: string[];
  readonly patches: Patch[];
  readonly inversePatches: Patch[];
  readonly previousState: TStructure;
  readonly nextState: TStructure;
  readonly timestamp: number;
}

// ✅ BON : inférence dans l'implémentation
const changedKeys = [...new Set(patches.map(p => String(p.path[0])))];
// TypeScript infère string[]
```

### 2.6 Encapsulation : `#` hard private systématique (ES2022+)

> **Règle absolue** : toute propriété ou méthode qui ne fait pas partie de
> l'API **publique** ou **protected** utilise le **hard private ES natif** (`#field`),
> jamais le mot-clé `private` de TypeScript.

**Justification** :

- Le `private` TypeScript est un mensonge runtime — contournable via `(instance as any)._field`
- Le `#` ES natif est **enforcement runtime réel** — `TypeError` si accès externe
- Cohérent avec I6 (Entity accessible uniquement par sa Feature, état détenu par le noyau)
- Pas de faux sentiment de sécurité : si c'est privé, c'est _vraiment_ privé

**Prérequis** : `"target": "ES2022"` minimum dans `tsconfig.base.json`.

```typescript
// ✅ BON : hard private ES natif — Feature<TEntityClass, TChannelDef, TSelfNS>
// (3 génériques, ADR-09/ADR-14 — pas Feature<TCartState>, un seul
// générique appartient à l'ancien pattern, abandonné)
export class CartFeature extends Feature<CartEntity, TCartDef, "cart"> {
  #computeTotal(): number {
    return this.entity.state.items.reduce((sum, i) => sum + i.price * i.qty, 0);
  }

  onTotalQuery(_params: null, _ctx: TFeatureQueryContext): number {
    return this.#computeTotal();
  }
}

// ❌ MAUVAIS : private TypeScript (contournable, faux sentiment de sécurité)
export class CartFeature extends Feature<CartEntity, TCartDef, "cart"> {
  private _lastComputedTotal = 0;       // (instance as any)._lastComputedTotal → pas d'erreur
  private _computeTotal(): number { }   // (instance as any)._computeTotal() → pas d'erreur
}
```

| Contexte | Utiliser |
| --- | --- |
| Champ/méthode interne à la classe | `#field` |
| Propriété accessible aux sous-classes | `protected` |
| API publique du composant | `public` (implicite) |
| Constructeur singleton (empêcher `new`) | `private constructor()` (exception — ES n'a pas de `#constructor`) |

> **Exception unique** : le `private constructor()` reste en `private` TS car
> ES2022 ne supporte pas `#constructor`. C'est le seul cas où `private` est autorisé.

---

## 3. Conventions de nommage

### 3.1 Intents et noms de messages

| Pattern | Format | Exemples | Contexte |
| --- | --- | --- | --- |
| **Intent mutation** | `namespace:verbNoun` | `"cart:addItem"`, `"user:updateProfile"` | String libre dans `ctx.mutate()` |
| **Command name** (clé Channel) | `verbNoun` | `'addItem'`, `'submit'` | `keyof TChannel['commands']` |
| **Event name** (clé Channel) | `nounVerbed` | `'itemAdded'`, `'submitted'` | `keyof TChannel['events']` |
| **Query name** (clé Channel) | nominal, pas `getNoun` | `'total'`, `'profile'` | `keyof TChannel['queries']` |

> **Attention** : les intents de mutation sont des strings libres `namespace:verbNoun`
> (utilisés dans `ctx.mutate()` pour la traçabilité). Les noms de Commands/Events/Queries
> sont des **clés nues** du `TChannelDefinition` — sans préfixe namespace.
> Le namespace est porté par le **channel token**, pas par le nom du message.
> Côté View et Composer, la clé plate `"ns:name"` les réunit (I80).

### 3.2 Conventions TypeScript

| Élément | Convention | Exemples |
| --- | --- | --- |
| **Classe** | PascalCase | `CartFeature`, `ProductView` |
| **Type de la surface développeur** (écrit explicitement dans le code applicatif — structurel ou mapped/conditional : `implements TFeatureCallbacks<…>`, `TChannelDefinition`, payloads) | PascalCase, préfixe `T` | `TEntityEvent`, `TChannelDefinition`, `TFeatureCallbacks`, `TCommandCallbacks` |
| **Type de plomberie interne** (jamais écrit directement par le développeur, uniquement composé par d'autres types exportés) | PascalCase, **sans** préfixe | `StrictManifest`, `CamelCase`, `UnionToIntersection`, `HasNoDuplicates` |
| **Interface** (si utilisée exceptionnellement) | PascalCase, préfixe `I` | `IProject`, `IConfig` |
| **Méthode** | camelCase | `resolve()`, `getUI()` |
| **Handler** | `on` + nom en PascalCase + suffixe | `onAddItemCommand`, `onTotalQuery`, `onCartItemAddedEvent`, `onAddButtonClick` |
| **Constante** | SCREAMING_SNAKE | `MAX_HOPS`, `DEFAULT_TIMEOUT` |
| **Namespace** | camelCase | `cart`, `userProfile`, `pricing` |

### 3.3 Fichiers et dossiers

| Type | Convention | Exemples |
| --- | --- | --- |
| **Feature** | `namespace.feature.ts` | `cart.feature.ts` |
| **Entity** | `namespace.entity.ts` | `cart.entity.ts` |
| **View** | `namespace.view.ts` (aligné sur `namespace.feature.ts`/`namespace.entity.ts` du même domaine — décision M9, audit doc 2026-09-17) | `cart.view.ts` |
| **Behavior** | `namespace.behavior.ts` | `cart.behavior.ts` |
| **Tests** | `*.test.ts` | `cart.feature.test.ts` |

> **Note** : il n'y a **pas** de fichier `.channel.ts` séparé.
> Le Channel (`TChannelDefinition`) et le State sont **co-localisés**
> dans le fichier `.feature.ts` (ADR-09, ADR-14).
> Voir [RFC-0001 Glossaire §3](../spec/reference/glossaire.md#structure-des-fichiers-et-dossiers-angular-style-guide).

### 3.4 Architecture de dossiers — par domaine, pas par type

> **DEVRAIT** : le code applicatif **DEVRAIT** être organisé en **un dossier
> par domaine/fonctionnalité**, regroupant tous les fichiers du domaine
> (Feature, Entity, View, Behavior, Composer, styles, templates).
>
> **NE DEVRAIT PAS** : le code applicatif **NE DEVRAIT PAS** être organisé
> par type de composant (un dossier `views/`, un dossier `features/`, etc.).

**Justification** :

- **Cohésion métier** : tout ce qui concerne le panier est dans `Cart/`, pas éparpillé entre 5 dossiers
- **Navigation IDE** : ouvrir un dossier = voir tout le domaine
- **Refactoring** : supprimer un domaine = supprimer un dossier
- **Encapsulation** : le point d'entrée public est `namespace.feature.ts`, le reste est privé au domaine
- **Scalabilité** : chaque domaine est autonome, pas de dossier `views/` qui grossit avec chaque feature

#### ✅ Organisation par domaine (recommandée)

```text
src/
  Cart/
    cart.feature.ts         # Feature + contrat de Channel (ADR-09, ADR-14)
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
// Imports par alias de domaine (recommandé) — classes nommées, pas de
// wrapper `namespace Cart { … }` (abandonné, ADR-14)
import { CartFeature } from '@cart/cart.feature';
import { ProductFeature } from '@product/product.feature';

// Ou imports relatifs entre domaines
import { CartFeature } from '../Cart/cart.feature';
```

#### ❌ Organisation par type de composant (anti-pattern)

```text
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
> [RFC-0001 Glossaire §3](../spec/reference/glossaire.md#structure-des-fichiers-et-dossiers-angular-style-guide)
> et s'inspire de l'[Angular Style Guide](https://angular.dev/style-guide) (ADR-08).

### 3.5 Modules ESM Bonsai — convention de déclaration (ADR-27)

> ⏳ **Cible strate 2+, non livrée** : ni `BonsaiRegistry`, ni module `*.esm.js` par
> composant n'existent ([distribution.md](../spec/2-architecture/distribution.md) §3).
> Le mode livré est le bootstrap monolithique (`new Application({ … }).start()`).

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
// ❌ Anti-pattern — side-effect métier à l'import (interdit, ADR-27, ADR-02)
import { BonsaiRegistry } from '/bonsai/bonsai.esm.js';
import { CartFeature } from './cart.feature.js';

BonsaiRegistry.registerFeature(CartFeature);
const cart = new CartEntity();  // ❌ Side-effect métier
cart.init();                    // ❌ Logique exécutée à l'import
```

#### Convention de nommage des artefacts

| Type | Convention | Exemple |
| --- | --- | --- |
| Module ESM navigateur | `{nom}.esm.js` | `cart.feature.esm.js` |
| Déclaration TypeScript | `{nom}.d.ts` | `cart.feature.d.ts` |
| Source map JS | `{nom}.esm.js.map` | `cart.feature.esm.js.map` |
| ⏳ Runtime Bonsai ESM (cible ; livré : `core/dist/bonsai.js` et `bonsai.prod.js`) | `bonsai.esm.js` | — |
| ⏳ Runtime Bonsai IIFE (cible, non produit — `lib/build/building/builder.class.ts` ne génère que `format: "es"`) | `bonsai.iife.js` | — |
| ⏳ Bundle IIFE applicatif (cible, non produit) | `{app}.bundle.iife.js` | `app.bundle.iife.js` |

> **Règle** : distribuer un `*.esm.js` sans son `*.d.ts` est **interdit**
> (ADR-27 — le type EST la documentation).

---

## 4. Conventions de sélecteurs DOM

### 4.1 Principe de séparation des mécanismes

Chaque mécanisme HTML a un rôle **unique et non interchangeable** :

| Mécanisme | Rôle | Propriétaire | Mutable à l'exécution ? |
| --- | --- | --- | --- |
| **Classe CSS** | Exprime le **rôle/contexte sémantique** de l'élément | CSS (style) · JS (lecture seule) | **Non** — ne change jamais à l'exécution |
| **`id`** | **Ciblage JavaScript** — point d'ancrage unique, intention marquée | JS (exclusif) | **Non** — identifiant stable |
| **`data-*`** | **États/paramètres dynamiques** — zone de communication CSS↔JS | JS (écriture) · CSS (lecture via sélecteurs d'attribut) | **Oui** — valeur modifiée par JS |

> **Principe** : les classes disent _ce que c'est_ (rôle), les `id` disent _où
> accrocher le JS_ (ancrage), les `data-*` disent _dans quel état c'est_
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
  Les états dynamiques sont portés par des `data-*` (§4.4).
- Une classe CSS **NE DOIT PAS** être modifiée par le JavaScript applicatif.
  La Foundation n'a pas de projection : elle n'altère ni `<html>` ni `<body>`.
  > 🧭 **Tension non tranchée** : `TProjectionNode.toggleClass(className, force)`
  > est une primitive **livrée** (`packages/view/src/bonsai-view.ts`), et
  > [view.md](../spec/4-couche-concrete/view.md) §4 l'utilise pour un état
  > (`toggleClass("hidden", true)`). Soit `toggleClass()` est réservée à des
  > rôles statiques (et l'exemple doit passer à `data-*` ou à `visible()`),
  > soit cette règle admet une exception explicite. Non tranché ; les guides
  > emploient `attr("data-state", …)` en attendant.

### 4.3 Identifiants (`id`) — ciblage JavaScript pur

Les `id` sont réservés au ciblage JavaScript. Ils **NE DOIVENT PAS** être
utilisés dans les sélecteurs CSS.

#### 4.3.1 Slots de composition — `#name-slot`

Les éléments qui servent de **slots** aux Composers utilisent un `id` avec le
suffixe `-slot`. Le slot est un conteneur structurel pur : il n'a pas de rôle
visuel propre. Son sélecteur doit désigner **exactement un élément** du
contenant (l'ancre de la Foundation, ou le contenu produit par le `template`
de la View) ; sinon l'effet de matérialisation échoue et l'échec est consigné
dans la trace.

```html
<!-- Slots racines : dans l'ancre de la Foundation (<body> par défaut) -->
<div id="header-slot"></div>
<div id="main-slot"></div>
<div id="footer-slot"></div>
```

**Convention** : `#kebab-case-slot` — le suffixe `-slot` marque l'intention.
Un sélecteur d'attribut (`[data-slot='main']`) convient aussi ; il ne change jamais.

Usage dans la Foundation (clé = nom du slot, lu une fois au démarrage, I67) :

```typescript
class AppFoundation extends Foundation {
  get composers() {
    return {
      header: { slot: "#header-slot", composer: HeaderComposer },
      main:   { slot: "#main-slot",   composer: MainContentComposer },
      footer: { slot: "#footer-slot", composer: FooterComposer }
    } as const;
  }
}
```

Usage dans une View : le slot est un élément de son `template`, et sa clé est
**distincte** des clés d'interface (D13 ; une collision est refusée à la
création de la View) :

```typescript
get uiElements() {
  return { itemList: ".LayoutMain-itemList" };
}

get template() {
  return `<ul class="LayoutMain-itemList"></ul>
          <aside id="sidebar-slot"></aside>
          <section id="content-slot"></section>`;
}

get composers() {
  return {
    sidebar: { slot: "#sidebar-slot", composer: SidebarComposer },
    content: { slot: "#content-slot", composer: ContentComposer }
  } as const;
}
```

Le contenu d'un slot appartient au Composer qui le remplit, pas à la View :
la View ne doit pas y projeter (I40 ; ⚠️ le code ne l'empêche pas encore, voir
[view.md §9](../spec/4-couche-concrete/view.md#9-limites-connues)).

#### 4.3.2 La part d'une View

Une View n'a pas d'élément racine à désigner : le noyau crée sa **part**, un
élément `<div data-bonsai-part="{clé}">` inséré dans le slot de son Composer à
la position décidée par `resolve(ctx)`, puis y projette son `template`
(I31, I34). Il n'y a donc ni `rootElement`, ni convention `#name-view`.

```typescript
class HeaderComposer extends Composer<THeaderComposerContract> {
  get features() { return headerComposerFeatures; }
  get views() { return { header: HeaderView }; }

  // Le Composer décide quelles Views occupent son slot, par clé ; il ne
  // désigne aucun élément.
  resolve(_ctx: TComposeContext<THeaderComposerContract>): TComposition<THeaderComposerContract> {
    return [{ view: "header", key: "header" }];
  }
}
```

`data-bonsai-part` appartient au framework : ne pas l'écrire, ne pas le cibler
en CSS. Le style s'accroche aux classes du `template`.

#### 4.3.3 Récapitulatif `id`

| Suffixe | Usage | Exemple | Résolu par |
| --- | --- | --- | --- |
| `-slot` | Point d'ancrage d'un Composer | `#header-slot` | Le noyau, dans le contenant (ancre de la Foundation ou part de la View), exactement un élément |

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
| --- | --- | --- | --- | --- |
| **Foundation** | Ancre | `body` (option `anchor`) | — | Seul élément de l'hôte admis par la Foundation (D3) |
| **Foundation** | Slot racine | `#header-slot` | `id` | Ciblage JS pur — point d'ancrage d'un Composer |
| **View** | Part | `[data-bonsai-part]` | attribut du framework | Créée par le noyau, jamais ciblée par le code applicatif |
| **View** | uiElements (interaction) | `.ProductCard-addToBasket` | classe CSS | Rôle sémantique dans le contexte du bloc |
| **View** | Slot enfant | `#sidebar-slot` | `id` | Point d'ancrage d'un Composer enfant, clé hors `uiElements` (D13) |
| **View** | États dynamiques | `data-state="open"` | `data-*` | Piloté par projection, mutable à l'exécution |

### 4.6 Exemple complet HTML

Le document servi ne contient que l'ancre et ses slots ; les parts des Views
sont créées par le noyau et remplies par leur `template` :

```html
<!DOCTYPE html>
<html lang="fr">
<head>…</head>
<body>
  <!-- Foundation : slots racines (#name-slot) -->
  <div id="header-slot"></div>
  <div id="main-slot"></div>
  <div id="footer-slot"></div>
</body>
</html>
```

Après le démarrage :

```html
<body>
  <div id="header-slot">
    <div data-bonsai-part="header">           <!-- part de HeaderView -->
      <header class="AppHeader">
        <nav class="AppHeader-nav">…</nav>
        <div class="AppHeader-cartBadge" data-item-count="3">…</div>
      </header>
    </div>
  </div>

  <div id="main-slot">
    <div data-bonsai-part="products">         <!-- part de ProductListView -->
      <main class="ProductList">
        <ul class="ProductList-items">…</ul>
        <button class="ProductList-loadMore">Charger plus</button>
        <aside id="sidebar-slot">             <!-- slot de la View -->
          <div data-bonsai-part="filters">…</div>  <!-- part de FiltersView -->
        </aside>
      </main>
    </div>
  </div>

  <div id="footer-slot">…</div>
</body>
```

```text
Foundation(<body>)
  ├─ header : '#header-slot' → HeaderComposer      → HeaderView (clé "header")
  ├─ main   : '#main-slot'   → MainContentComposer → ProductListView (clé "products")
  │                                                    └─ sidebar : '#sidebar-slot' → SidebarComposer → FiltersView (clé "filters")
  └─ footer : '#footer-slot' → FooterComposer      → FooterView (clé "footer")
```

### 4.7 Pattern — Composition hétérogène par clé

Quand un conteneur accueille **N Views de types différents** (formulaire CMS
dont les champs dépendent du bundle, éditeur de blocs, tableau de bord
configurable), c'est **un seul slot** et **un seul Composer** : `resolve(ctx)`
rend une composition ordonnée de Views, chacune sous une clé stable, d'après
l'état du domaine. Le noyau ne recrée que ce qui a changé (I35).

```typescript
import {
  Composer,
  type TComposerContract, type TComposeContext, type TComposition
} from "@bonsai/core";
import { NodeEditFeature } from "../NodeEdit/nodeEdit.feature";

const fieldsComposerFeatures = {
  nodeEdit: {
    feature: NodeEditFeature,
    listens: ["fieldsChanged"] as const,   // recompose à chaque Event déclaré
    queries: ["fields"]        as const
  }
};

const fieldsComposerViews = {
  editorjs: EditorJsFieldView,
  media:    MediaFieldView,
  text:     TextFieldView
};

type TFieldsComposerContract = TComposerContract<
  typeof fieldsComposerFeatures,
  typeof fieldsComposerViews
>;

class FieldsComposer extends Composer<TFieldsComposerContract> {
  get features() { return fieldsComposerFeatures; }
  get views()    { return fieldsComposerViews; }

  resolve(ctx: TComposeContext<TFieldsComposerContract>): TComposition<TFieldsComposerContract> {
    // Le type de chaque champ vient du domaine, pas d'un attribut du DOM.
    return ctx.query("nodeEdit:fields", null).map((field) => ({
      view: field.type,                // "editorjs" | "media" | "text" : clé du catalogue views
      key: field.id,                   // clé stable : la View est gardée tant qu'elle ne change pas
      params: { fieldId: field.id }    // paramètres de création, capturés par copie (G2)
    }));
  }
}
```

La View qui contient le formulaire déclare ce slot unique :

```typescript
get template()  { return `<form class="NodeEditForm"><div id="fields-slot"></div>…</form>`; }
get composers() { return { fields: { slot: "#fields-slot", composer: FieldsComposer } } as const; }
```

#### Pourquoi la décision est dans le Composer

| Élément | Où | Vérifié |
| --- | --- | --- |
| Types de Views possibles | catalogue `get views()` | compile-time : une View hors catalogue est refusée par `TComposition` (I37) |
| Clé de chaque entrée | `resolve(ctx)` | compile-time (clé requise) ; runtime : une clé dupliquée fait échouer l'unité (G7) |
| Combien, dans quel ordre | l'état du domaine, par Query | à chaque résolution |

#### ❌ Anti-pattern — scanner le DOM

```typescript
// ❌ INTERDIT — une View ou un Composer ne lit jamais le DOM (I39), et un
// sélecteur de slot désigne exactement un élément : pas de querySelectorAll.
get composers() {
  return Object.fromEntries(
    [...document.querySelectorAll("[data-field-type]")]
      .map((el) => [el.id, { slot: `#${el.id}`, composer: resolveComposer(el.dataset.fieldType) }])
  );
}

// ✅ CORRECT — un slot, un Composer, une composition décidée par le domaine
get composers() {
  return { fields: { slot: "#fields-slot", composer: FieldsComposer } } as const;
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
ctx.mutate((draft) => { });

// NON — intent générique
ctx.mutate("update", (draft) => { });

// OUI — intent métier explicite
ctx.mutate("cart:addItem", (draft) => { });
```

### ❌ Opérations hors du contexte du handler

```typescript
// NON — API de la strate 0, retirée
this.entity.mutate("cart:addItem", recipe);
this.emit("itemAdded", payload);
this.trigger("cart:addItem", payload);
this.request(PricingFeature.channel, "total", params);

// OUI — le contexte de l'unité
ctx.mutate("cart:addItem", recipe);
ctx.emit("itemAdded", payload);
ctx.trigger("cart:addItem", payload);              // View, handler d'un fait seulement (D18)
ctx.query(PricingFeature.channel, "total", params); // Feature ; "pricing:total" côté View
```
