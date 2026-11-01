# View — Composant de projection et d'interaction

> **Projette le domaine sur la part que son Composer lui a attribuée ; admet les faits de l'hôte dans cette part ; handlers à contexte**

> 🟠 **Aligné sur la théorie V0.9.5 et sur le code livré pour le cœur (lot M6.2, 1er novembre 2026).** Les annexes A et B (templates de rendu, `localState`) sont des conceptions **cibles non livrées**, conservées avec leur texte d'origine : leurs exemples utilisent l'ancienne forme d'API. En cas d'écart, la [théorie](../../theorie.md) prévaut ([règle de confiance](../../README.md#règle-de-confiance-et-dalignement)).

[<- Retour couche concrète](README.md) | [-> Behavior](behavior.md) | [5-rendu.md (PDR complète)](../5-rendu.md)

---

| Champ | Valeur |
| --- | --- |
| **Composant** | View |
| **Couche** | Concrète (éphémère : créée et détruite par un Composer, D11) |
| **Paquet** | `@bonsai/view` |
| **Décisions** | [ADR-14](../../adr/ADR-14-contrats-types.md) (contrats), [ADR-15](../../adr/ADR-15-evenements-ui.md) (événements), [ADR-16](../../adr/ADR-16-view-scope-projection.md) (projection), [ADR-21](../../adr/ADR-21-behavior-reutilisation.md) (sélecteurs surchargeables), [ADR-17](../../adr/ADR-17-local-state.md) (état local, cible) ; théorie 11.1, A3, A4.d, A5.d, C.3, D10, D11, D17, D18 |

## Table des matières

1. [Rôle](#1-rôle)
2. [Déclarations](#2-déclarations)
3. [Handlers et contextes](#3-handlers-et-contextes)
4. [Projection : `getUI`](#4-projection--getui)
5. [Faits de l'hôte](#5-faits-de-lhôte)
6. [Composition : slots et Composers](#6-composition--slots-et-composers)
7. [Contrats typés](#7-contrats-typés)
8. [Cycle de vie](#8-cycle-de-vie)
9. [Limites connues](#9-limites-connues)
10. [Annexes cibles](#annexe-a--templates-de-rendu-cible)

---

## 1. Rôle

Une View est un composant de l'**interface utilisateur** (11.1). Elle :

- occupe une **part** du document, attribuée par son Composer ; elle est **seule** à admettre les faits de l'hôte survenus dans cette part (A5.d, D10) ;
- **reçoit** les Events des Features qu'elle déclare et **projette** leur effet dans sa part ;
- **adresse des Commands** à ces Features en réaction à un fait de l'hôte (jamais en réaction à un Event, D18) ;
- ne **possède aucun état métier** et n'émet aucun Event (I4) : absent de son type.

Elle est enfant d'un **Composer**, jamais créée directement (D11, I36).

## 2. Déclarations

Lues **une fois**, quand la View est décrite au noyau (par le Composer qui la crée) :

```typescript
class CartView extends View<TCartViewContract> implements TViewCallbacks<TCartViewContract> {
  get features()   { return cartViewFeatures; }    // Features : Events écoutés, Queries, Commands adressées
  get uiEvents()   { return cartViewUiEvents; }    // clés UI, sous-type d'élément, événements hôtes
  get uiElements() { return cartViewUiElements; }  // sélecteur CSS de chaque clé, dans la part
  get template()   { return `<button data-ui="addButton">Add</button><span data-ui="itemCount"></span>`; }
  get composers()  { return {}; }                  // slots de la part et Composer de chacun (§6)
}
```

| Getter | Obligatoire | Rôle |
| --- | --- | --- |
| `features` | oui | Contrat vers les Features (I81) |
| `uiEvents` | oui | `TUIContract` : clé → `ui<TEl>()([événements])` (I85, I86) |
| `uiElements` | oui | `TUIElements` : clé → sélecteur (ADR-21) ; une clé de `uiEvents` à événements doit y figurer |
| `template` | non | HTML du contenu initial de la part, projeté à la création ; vide par défaut. Emplacement provisoire du rendu (annexe A) |
| `composers` | non | Slots de la part (§6) |

Les paramètres de création que le Composer a donnés sont lisibles dans un handler par le getter protégé `params` (copie gelée, A3.d).

## 3. Handlers et contextes

Les handlers sont **découverts par leur nom** (I48) et reçoivent un **contexte** (D18) :

| Déclencheur | Handler | Contexte | Offre |
| --- | --- | --- | --- |
| Fait de l'hôte dans la part | `on{Clé}{Événement}(fact, ctx)` | `TFactContext<TVC>` | `query`, `trigger` |
| Event d'une Feature | `on{Ns}{Event}Event(payload, ctx)` | `TEventContext<TVC>` | `query` |

```typescript
type TFact = { readonly type: string; readonly ui: string | null };   // donnée, jamais l'événement natif

onAddButtonClick(_fact: TFact, ctx: TFactContext<TCartViewContract>): void {
  ctx.trigger("cart:addItem", { productId: "p1", qty: 1, price: 10 });   // livré après validation (G5)
}

onCartItemAddedEvent(payload: { item: TCartItem }, ctx: TEventContext<TCartViewContract>): void {
  this.getUI("itemCount").text(String(ctx.query("cart:getItemCount", null)));
  // ctx.trigger : n'existe pas sur TEventContext — erreur de compilation (D18)
}
```

- **Droit de commander (D18).** Un Event, son relais local ou un effet corrélé à lui n'ouvre aucun droit ; un fait de l'hôte **indépendant** (monde fermé, C.4) ou une continuation d'une réaction qui avait le droit l'ouvre. Le type le garantit pour l'Event ; le noyau le vérifie à l'exécution pour le reste (`NOT_AUTHORIZED`).
- **Initialisation.** Elle continue l'unité du créateur. Une View créée par un Composer en réaction à un Event n'a donc aucun droit de Command à l'initialisation : charger les données d'une page vient d'une Feature qui réagit à `router:routeChanged` (D17), non de la View.
- **`ctx.query`** : synchrone, lecture seule ; l'échec d'une Query fait échouer l'unité (G7).
- Handlers manquants : erreur de compilation par `implements TViewCallbacks<TVC>` (I82, I84, I88) et, à la description, `Missing handler "…"`.
- Supprimés : `this.trigger`, `this.request`, `mount()`, `onAttach()`, `rootElement`, `TProjectionNode.element()`.

## 4. Projection : `getUI`

`getUI(clé)` rend une projection typée sur l'élément de la clé, dans la part de la View (I39) :

```typescript
this.getUI("itemCount").text("3");
this.getUI("total").attr("data-state", "ready");
this.getUI("emptyMessage").toggleClass("hidden", true);
this.getUI("emptyMessage").visible(false);
this.getUI("total").style("color", "red");
```

- Chaque appel **prépare un effet** lié à l'unité du handler en cours ; il est **engagé après la validation de l'unité** (C.3). Si l'unité échoue, rien n'est écrit (G7). La première erreur synchrone d'engagement arrête les effets suivants.
- `getUI` et `params` ne s'utilisent **que dans un handler** ; ailleurs ils lèvent.
- Une clé inconnue ou un sélecteur sans élément dans la part est une erreur.
- Une View ne lit **jamais** le document : elle écrit des effets préparés. L'élément brut n'est pas exposé.

## 5. Faits de l'hôte

La View déclare à la description chaque événement hôte de `uiEvents` avec les sélecteurs de ses clés. Le noyau pose l'observateur sur sa part, et **seule** la View dont la part est la plus interne admet un fait (A5.d). L'admission est une donnée `{ type, ui }`, où `ui` est la première clé, dans l'ordre de déclaration, dont le sélecteur correspond à la cible ou à un ancêtre dans la part.

- Un fait sur un élément sans clé, ou dont la clé ne déclare pas cet événement, est ignoré sans échec.
- Un fait survenu hors de la part de la View ne lui parvient pas.
- Le fait est **indépendant** (origine spontanée, droit de commander) s'il n'a pas été produit par une simulation instrumentée du modèle ; sinon il est corrélé et continue la réaction qui l'a simulé (C.4).
- Un raccourci de niveau document ou un clic hors View n'est admis par aucune View (18.30).

## 6. Composition : slots et Composers

Une View peut contenir des emplacements où d'autres Views seront composées. Elle déclare `get composers()` : clé de slot → `{ slot, composer }`.

```typescript
get composers() {
  return {
    main: { slot: "[data-slot='main']", composer: MainComposer },
    side: { slot: "[data-slot='side']", composer: CartPanelComposer }
  } as const;
}
```

- `slot` est un sélecteur qui doit correspondre à **exactement un** élément de la part de la View (celui que produit `template`) ; cet élément devient la part du Composer. Une clé de slot ne peut pas être une clé UI (D13).
- La View crée des **Composers seulement**, jamais d'autres Views (I36, D11). Le Composer décide quelles Views existent dans le slot ([composer.md](composer.md)).
- Créations, attributions et destructions appartiennent à l'unité qui les produit (G7). Détruire une View détruit ses descendants de bas en haut ; les contenus attribués reviennent au propriétaire du contenant (T3).
- Une projection de la View reçoit la part entière, contenu des slots compris : y écrire est interdit par revue, non par construction (§9).
- Un type unique de Composer par slot peut gérer 0..N Views hétérogènes (I37, ADR-18).

## 7. Contrats typés

Trois modules (ADR-14), puis leur composition :

```typescript
// Module 1 — Features (I81, I87 : clé d'objet = namespace)
const cartViewFeatures = {
  cart: { feature: CartFeature, listens: ["itemAdded"] as const, triggers: ["addItem"] as const, queries: ["getItemCount"] as const }
} satisfies TFeatureContract;

// Module 2 — UI : événements (ADR-15) et sous-type d'élément ; helper curryfié (I85), `events` toujours présent (I86)
const cartViewUiEvents = {
  itemCount: ui<HTMLElement>()([]),
  addButton: ui<HTMLButtonElement>()(["click"])
} satisfies TUIContract;

// Module 3 — sélecteurs (ADR-21)
const cartViewUiElements = {
  itemCount: "[data-ui='itemCount']",
  addButton: "[data-ui='addButton']"
} satisfies TUIElements<typeof cartViewUiEvents>;

type TCartViewContract = TViewContract<typeof cartViewFeatures, typeof cartViewUiEvents>;
```

- `TViewCallbacks<TVC>` = `TEventCallbacks<TVC>` & `TUICallbacks<TVC["ui"], TVC>` : les handlers requis, signatures comprises (I88). Un événement non listé dans `TEventsFor<TEl>` est rejeté (I89–I91).
- `ctx.trigger` et `ctx.query` sont typés par `TFlatTriggers`, `TFlatQueries`, `TCommandPayloadFor`, `TQueryParamsFor`, `TQueryResultFor` : une clé non déclarée, un mauvais payload ou un Event pris pour une Command sont des erreurs de compilation (I77).
- Le Channel n'est jamais manipulé par le consommateur : il nomme des **Features**, pas des jetons (I80).
- `TViewClass` est le type structurel d'une classe de View, utilisé par les Composers.
- `TUIContract` sans argument vaut `TUIEntry<HTMLElement, …>` : seuls les événements communs y sont assignables ; un sous-type d'élément porte ses propres événements via `ui<TEl>()`.

## 8. Cycle de vie

Passif : une View n'a ni `mount()` ni hook de cycle de vie. Elle naît quand son Composer la crée (sa description entre au noyau, son `template` est projeté, ses Composers sont créés dans l'unité du créateur) et meurt quand le Composer la détruit ou que son parent finit. Ses abonnements, ses observateurs d'hôte et sa part prennent fin avec elle ; sa part est restituée à son contenant.

## 9. Limites connues

- Une View dont l'élément n'a pas pu être créé n'est pas encore détruite logiquement ; l'échec figure dans la trace du noyau (C.3).
- Une projection peut écrire dans le contenu d'un slot (non vérifié par construction).
- `template` est provisoire en attendant le rendu (annexe A) ; pas de Behaviors (package absent), pas de `localState` (annexe B).

---

## Annexe A — Templates de rendu (cible)

> ⏳ **Conception cible, non livrée.** Texte d'origine ; voir aussi [5-rendu.md](../5-rendu.md). Les exemples utilisent l'ancienne forme d'API.

### 4.5 get templates() — Trois modes de rendu

La View déclare ses templates de projection via `get templates()`.
Trois modes **mutuellement exclusifs** :

```typescript
/**
 * Mode A : null — pas de template.
 *   La View utilise getUI() manuellement dans ses handlers.
 *
 * Mode B : { root: Binding } — template complet.
 *   La couverture de rendu reste limitée à la part de la View :
 *   contenu des slots attribués exclu, racine non remplaçable (I32).
 *   Aucune autre clé autorisée.
 *
 * Mode C : { [K in keyof TUI]?: Binding } — fragments (îlots).
 *   Chaque clé est un @ui déclaré dans `uiEvents` (TUIContract, ADR-14).
 *   Le template couvre le contenu INTÉRIEUR autorisé de l'élément @ui,
 *   hors contenu des slots attribués ; aucun transfert d'autorité.
 *   Le reste du DOM serveur est intouché.
 *   La clé `root` est interdite (réservée au Mode B).
 */
type TViewTemplateBinding<TData = unknown> = {
  template: TProjectionTemplate<any, TData>;
  /**
   * Selector optionnel : active l'auto-réactivité (5-rendu.md §2.3/§7.2).
   * Si absent, le template est statique (projection initiale seulement).
   */
  select?: (data: Record<string, any>) => TData | undefined;
};

type TViewTemplates<TUI extends TUIContract = TUIContract> =
  | null                                                 // Mode A
  | { root: TViewTemplateBinding }                       // Mode B
  | { [K in keyof TUI & string]?: TViewTemplateBinding }; // Mode C
```

> **Regle normative** : des qu'une zone est déclarée dans `get templates()`,
> le rendu de cette zone est delegue au framework via `template.project()`.
> Un handler View ne doit pas appeler `template.project()` manuellement pour
> cette même zone (coherence avec 5-rendu.md §2.2).

### 4.6 TProjectionTemplate

Un template compile (`TProjectionTemplate`) expose trois fonctions :

```typescript
type TProjectionTemplate<TNodes = any, TData = any> = {
  /** Localise les noeuds dynamiques dans le conteneur, retourne un objet de references */
  setup(container: HTMLElement): TNodes;

  /** Effectue les mutations DOM chirurgicales depuis les donnees */
  project(nodes: TNodes, data: TData): void;

  /** Factory DOM -- cree le fragment HTML complet (si pas de SSR) */
  create(data: TData): HTMLElement;
}
```

Le peuplement de références de projection est une **proposition non livrée**, pas un appel garanti dans `onAttach()`. L'ancien pseudo-code d'attachement (accès à `slot`, affectation de `el`, parseur CSS et méthodes internes non définies) n'est pas une API exécutable.

Dans la cible, la View résout sa désignation sous contrôle d'attribution ; ses références et intentions de projection sont établies dans l'initialisation autorisée, incluse dans l'unité de son Composer. Aucun template ne crée une autorité sur une part déjà attribuée. La matérialisation DOM est post-validation et peut échouer partiellement ; `setup()`, `project()` ou `create()` ne suffisent pas à établir ce protocole. La représentation des références et leur articulation avec ces opérations restent à concevoir.

### 4.7 Templates partiels Mode C — Syntaxe PugJS `@ui.xxx`

En Mode C, le developpeur ecrit un ou plusieurs **fragments PugJS** qui ciblent
chacun un `@ui` spécifique. Le reste du DOM serveur est intouche.

La syntaxe historique `@ui.xxx` dans le `.pug` délimite une couverture de rendu intérieur, pas un propriétaire distinct. La View reste propriétaire de sa part ; un fragment ne dispose jamais du contenu de slots attribué aux Composers. Avant tout retrait d'un élément slot, la View détruit le Composer concerné et récupère ce contenu (§6), puis prépare la projection physique post-validation.

```pug
_data
  isLogged Boolean
  username String
  itemCount Number

@ui.loginContainer
  if data.isLogged
    p.welcome Bonjour #{data.username}
    button.logout(type="button") Deconnexion
  else
    form.login-form
      input.login-input(type="text" placeholder="Identifiant")
      button.login-submit(type="button") Connexion

@ui.cartBadge
  span.count= data.itemCount
  if data.itemCount > 0
    span.badge-dot
```

Le compilateur génère un fichier `.template.ts` contenant un `TProjectionTemplate`
par `@ui` déclaré, avec l'analyse de dependance sur `data.*` :

- Noeuds **statiques** -> ignores (existent dans le DOM serveur)
- Noeuds **dynamiques** -> inclus dans `setup()` + `project()`
- Noeuds **conditionnels** (`if/else`) -> gestion de bascule de branche

Usage dans la View (pattern modulaire ADR-14) :

```typescript
import {
  View, ui,
  type TViewContract, type TViewCallbacks,
  type TUIContract, type TUIElements,
} from '@bonsai/view';
import type { TFeatureContract } from '@bonsai/feature';
import { AuthFeature } from '../Auth/auth.feature';
import { CartFeature } from '../Cart/cart.feature';
import {
  loginContainerTemplate,
  cartBadgeTemplate,
} from './AccountView.template';

// ═══ Étape 1 — Module Features (channel par Feature) ═══

const accountViewFeatures = {
  auth: {
    feature:  AuthFeature,
    listens:  ['stateChanged']  as const,
    triggers: ['login', 'logout'] as const,
    requests: []                 as const,
  },
  cart: {
    feature:  CartFeature,
    listens:  ['itemAdded', 'itemRemoved'] as const,
    triggers: []                            as const,
    requests: []                            as const,
  },
} satisfies TFeatureContract;

// ═══ Étape 2 — Module UI events (TUIContract typé via ui<TEl>()) ═══

const accountViewUiEvents = {
  loginContainer: ui<HTMLDivElement>()([]),                    // pas d'event direct — couvert par template
  loginInput:     ui<HTMLInputElement>()([]),                  // lecture only via getUI().value()
  loginButton:    ui<HTMLButtonElement>()(['click']),
  logoutButton:   ui<HTMLButtonElement>()(['click']),
  cartBadge:      ui<HTMLSpanElement>()([]),                   // couvert par template
  nav:            ui<HTMLElement>()(['click']),
} satisfies TUIContract;

// ═══ Étape 3 — Module sélecteurs CSS (overridable ADR-21) ═══

const accountViewUiElements = {
  loginContainer: '.AccountView-loginZone',
  loginInput:     '.AccountView-loginInput',
  loginButton:    '.AccountView-loginButton',
  logoutButton:   '.AccountView-logoutButton',
  cartBadge:      '.AccountView-cartBadge',
  nav:            '.AccountView-nav',
} satisfies TUIElements<typeof accountViewUiEvents>;

// ═══ Étape 4 — Type composé ═══

type TAccountViewContract = TViewContract<
  typeof accountViewFeatures,
  typeof accountViewUiEvents
>;

// ═══ Étape 5 — Classe (un générique, un implements) ═══

class AccountView
  extends View<TAccountViewContract>
  implements TViewCallbacks<TAccountViewContract>
{
  get features()   { return accountViewFeatures;   }
  get uiEvents()   { return accountViewUiEvents;   }
  get uiElements() { return accountViewUiElements; }

  // Mode C — seules les zones réactives ont un template
  get templates() {
    return {
      loginContainer: {
        template: loginContainerTemplate,
        select: (data) => data.auth
          ? { isLogged: data.auth.isLogged, username: data.auth.username }
          : undefined,
      },
      cartBadge: {
        template: cartBadgeTemplate,
        select: (data) => data.cart
          ? { itemCount: data.cart.itemCount }
          : undefined,
      },
      // pas de `nav` → la nav est SSR pur, aucune projection
    };
  }

  // ── Channel handlers (ADR-09 channel — imposés par TViewCallbacks) ─────────
  onAuthStateChangedEvent(_p: { isAuthenticated: boolean }): void { /* ... */ }
  onCartItemAddedEvent(_p: { id: string; qty: number }): void { /* ... */ }
  onCartItemRemovedEvent(_p: { id: string }): void { /* ... */ }

  // ── DOM handlers (I48 UI — imposés par TViewCallbacks) ──────────────────
  // loginInput n'a PAS de template → getUI retourne TProjectionNode<HTMLInputElement>
  onLoginButtonClick(_e: MouseEvent): void {
    const username = this.getUI('loginInput').value();
    this.trigger('auth:login', { username, password: '' });
  }

  onLogoutButtonClick(_e: MouseEvent): void {
    this.trigger('auth:logout', undefined);
  }

  onNavClick(_e: MouseEvent): void { /* ... */ }

  // loginContainer a un template → getUI retourne TProjectionRead
  // this.getUI('loginContainer').text('...') → ERREUR compile-time (I41)
  // (Property 'text' does not exist on type 'TProjectionRead')
}
```

> **Séparation des responsabilités** :
>
> ```text
> .view.ts      = QUOI    → modules `features` / `uiEvents` / `uiElements`, handlers, templates()
> .template.pug = COMMENT → logique de rendu (projections, conditions, boucles)
> ```
>
> En Mode C, le DOM serveur fournit le support initial de présentation ; il ne détermine ni les existences logiques ni la validité des attributions.
> Les fragments `.pug` ne décrivent que les **îlots réactifs**.
> Le reste du HTML (nav, footer, contenu statique) est 100% SSR, intouché.

---

## Annexe B — `localState` (cible)

> ⏳ **Conception cible, non livrée.** Texte d'origine.

### B.0 API localState

> ⏳ Cible, non livré.
>
> ⏳ **Strate 2a** — décision : [ADR-17](../../adr/ADR-17-local-state.md).
> Le localState est une « Entity sans Channel » : Immer produit un état
> immuable, et deux mécanismes complémentaires assurent la réactivité (N1 et
> N2/N3). `View<TVC>` garde **un seul générique** : le state local est porté
> par un troisième champ du contrat, `TVC["local"]`, à côté de `features` et `ui`.

**Lecture V0.9.4 limitée au cycle de vie et à l'imputation :** cette forme de contrat et les pipelines ci-dessous sont des propositions historiques non livrées, non un arbitrage nouveau de leur typage ou de leur ordonnancement détaillé. L'état local est initialisé dans l'unité autorisée de la View, éventuellement incluse dans celle du créateur, et prend fin avec son existence. L'état utilisé par un Behavior en fait partie, sans propriétaire ni cycle de vie distincts. Il peut changer pendant un traitement autorisé, y compris d'Event, sans créer de permission de Command. Toute projection physique reste post-validation ; callbacks et microtasks ne dispensent ni de ce préalable ni du contrôle d'occurrence (§4.8–§5).

### 7.0 Arbre de décision : localState vs domain state

```text
Q1. Ce state pourrait-il interesser un autre composant ?
    |   (autre View, Feature ; Behavior n'est pas un composant)
    |
    +-- OUI --> domain state (Feature + Entity + Channel)
    |           Justification : la View n'a pas emit() (I1, I4).
    |           Elle ne peut pas diffuser de changement observable.
    |           Le localState est encapsule (I42.3) et non-broadcastable (I42.4).
    |
    +-- NON --> Q2

Q2. Ce state doit-il survivre a la destruction de la View ?
    |   (navigation, remplacement par un Composer, re-montage)
    |
    +-- OUI --> domain state (Feature + Entity + Channel)
    |           Justification : le localState est lie a l'instance --
    |           detruit avec la View (I42.5), pas par hook de cascade.
    |
    +-- NON --> localState suffit
                Utiliser this.updateLocal(recipe) -- ADR-17.
                Ex : currentStep d'un wizard, isEditing d'un toggle,
                validationErrors d'un formulaire.
```

> **Critere de migration** (I42) : si un localState doit être observe par un autre
> composant, il **DOIT** être migre vers Feature + Entity. Le localState est
> strictement intra-View, y compris la portion utilisée par son code Behavior (règle d'imputation).

### 7.1 Types localState

```typescript
/**
 * Payload passe aux callbacks `onLocal{Key}Updated()` (mecanisme N1).
 */
type TLocalUpdate<T> = {
  /** Valeur apres mutation */
  readonly actual: T;
  /** Valeur avant mutation */
  readonly previous: T;
};

/**
 * Derive le nom du callback N1 pour une cle donnee du localState.
 * TLocalKeyHandlerName<'isOpen'>      -> 'onLocalIsOpenUpdated'
 * TLocalKeyHandlerName<'currentStep'> -> 'onLocalCurrentStepUpdated'
 */
type TLocalKeyHandlerName<TKey extends string> = `onLocal${Capitalize<TKey>}Updated`;

/**
 * Mappe chaque cle du localState vers son callback N1 optionnel.
 * Le framework auto-decouvre ces methodes (convention `onXXX`, ADR-09).
 * Optionnels (`?:`) -- pas de garantie compile-time d'implementation,
 * contrairement a `TViewCallbacks` (I88).
 */
type TLocalKeyHandlers<TLocal extends TJsonSerializable> = {
  [K in keyof TLocal & string as TLocalKeyHandlerName<K>]?: (
    update: TLocalUpdate<TLocal[K]>
  ) => void;
};
```

### 7.2 Classe View — API localState complète

Titre historique conservé ; **aucune API localState complète n'est livrée**. `TViewContract` possède aujourd'hui deux champs, `features` et `ui`, et `View<TVC>` un seul générique. L'ajout d'un champ `local` au contrat est la proposition historique d'ADR-17 ; son typage final et sa compatibilité ne sont pas validés par ce lot.

| Nom historique proposé | Portée cible, sans signature garantie |
| --- | --- |
| `localState` | Déclaration de l'état initial pendant l'initialisation autorisée, non lors d'une réapparition DOM |
| `updateLocal()` | Modification pendant le traitement de la View, soumise au rollback de **toute l'unité**, pas seulement à celui d'une recipe Immer |
| `local` | Lecture interne confinée de la View ; aucun accès d'un autre composant, aucune réponse consultable ni diffusion |
| `onLocal{Key}Updated()` | Réactions de projection proposées, imputées à la View ; ne sont ni admissions autonomes, ni hooks de cascade, ni autorisations d'écrire physiquement avant validation |

Une annulation de destruction conserve l'état antérieur et la même occurrence : elle ne rappelle pas un initialiseur comme pour une nouvelle View. Après destruction validée, il n'y a pas de `detached → attached` réactivant cette occurrence ; une nouvelle View possède un nouvel état. La fin physique des références intervient après validation, sans hook applicatif pendant la cascade.

### 7.3 Mécanisme dual N1/N2-N3

| Niveau | Mecanisme | Quand utiliser | Declenchement |
| --- | --- | --- | --- |
| **N1** | Callbacks `onLocal{Key}Updated(update: TLocalUpdate<T>)` proposés | Préparation de mutations de présentation | Ordre synchrone historiquement proposé ; écriture physique seulement post-validation |
| **N2/N3** | Selector `select: (data) => data.local?.xxx` proposé dans `get templates()` | Préparation de re-projection via pipeline PDR | Microtask historiquement proposée ; ne remplace ni la validation ni le contrôle d'occurrence |

Les deux mecanismes **ne s'excluent pas**. Un même `updateLocal()` peut declencher
un callback N1 **et** une re-projection N2/N3 si les clés concernent des zones differentes.

> **Namespace `local` reserve** (I57) : le data key `local` dans `NamespacedData` est
> reserve par le framework. Aucun Channel ne peut utiliser le namespace `local`.

### 7.4 Pipeline de mutation

Pipeline historique non livré : les flèches de projection ci-dessous désignent la **préparation**, pas l'application physique. Une exception annule l'unité interne complète, dont les éventuelles opérations structurelles ; aucune restauration des effets hôte déjà engagés n'en découle. L'ordonnancement final reste à concevoir sous §2.5 et §2.7.

```text
updateLocal(recipe)
  -> Immer produce(oldState, recipe)
  -> patches vides ?
    +-- OUI -> no-op (ni callback, ni re-projection)
    +-- NON -> changedKeys = extraire les cles des patches
              |
              +-- N1 path (synchrone) :
              |   pour chaque cle K dans changedKeys
              |     si this.onLocal{K}Updated existe
              |     -> appeler avec { actual: newState[K], previous: oldState[K] }
              |
              +-- N2/N3 path (microtask) :
                  injecter { local: changedPartial } dans le pipeline selector
                  -> chaque template avec select() filtre via data.local?.xxx
                  -> si donnees changees (shallow equal) -> template.project()
```

### 7.5 Cycle de vie du localState

| Phase | Comportement |
| --- | --- |
| Initialisation autorisée | État provisoire dans l'unité de la View et de son créateur ; aucune exigence de DOM déjà matérialisé |
| Publication | État disponible pour les traitements autorisés de cette View, y compris son code Behavior ; aucun propriétaire Behavior distinct |
| Échec de l'unité | Rollback interne commun ; une création abandonnée ne publie ni état ni désignation |
| Destruction provisoire annulée | État et occurrence antérieurs conservés, sans réinitialisation |
| Destruction validée | État prend fin avec la View ; aucun remontage de l'ancienne occurrence |
| Après validation | Nettoyage physique des références ; GC n'est pas la définition de la fin logique |

### 7.6 Observabilité (DevTools)

Le localState **N'EST PAS** dans `app.snapshot()` (état volatile, voir [devtools](../devtools.md)).
En mode `debug: true`, les mutations localState sont logguees dans la console
avec le nom de la View et les clés modifiees.

### 7.7 Exemple complet

```typescript
type TWizardLocalState = {
  currentStep: number;
  validationErrors: string[];
  isSubmitting: boolean;
};

// ═══ Pattern modulaire (ADR-14 value-first) ═══

const wizardViewFeatures = {
  wizard: {
    feature:  WizardFeature,
    listens:  []                         as const,
    triggers: ['submit']                 as const,
    requests: []                         as const,
  },
} satisfies TFeatureContract;

const wizardViewUiEvents = {
  stepIndicator: ui<HTMLDivElement>()([]),                    // mutation N1 directe
  progressBar:   ui<HTMLDivElement>()([]),                    // mutation N1 directe
  nextButton:    ui<HTMLButtonElement>()(['click']),
  prevButton:    ui<HTMLButtonElement>()(['click']),
  submitButton:  ui<HTMLButtonElement>()(['click']),
  stepContent:   ui<HTMLDivElement>()([]),                    // couvert par template N2
  errorList:     ui<HTMLUListElement>()([]),                  // couvert par template N2
} satisfies TUIContract;

const wizardViewUiElements = {
  stepIndicator: '.WizardView-stepIndicator',
  progressBar:   '.WizardView-progressBar',
  nextButton:    '.WizardView-next',
  prevButton:    '.WizardView-prev',
  submitButton:  '.WizardView-submit',
  stepContent:   '.WizardView-stepContent',
  errorList:     '.WizardView-errorList',
} satisfies TUIElements<typeof wizardViewUiEvents>;

type TWizardViewContract = TViewContract<
  typeof wizardViewFeatures,
  typeof wizardViewUiEvents,
  TWizardLocalState
>;

// Un seul générique -- local est porté par TWizardViewContract, pas par View<>.
class WizardView
  extends View<TWizardViewContract>
  implements TViewCallbacks<TWizardViewContract>
{
  get features()   { return wizardViewFeatures;   }
  get uiEvents()   { return wizardViewUiEvents;   }
  get uiElements() { return wizardViewUiElements; }

  protected get localState(): TWizardLocalState {
    return { currentStep: 0, validationErrors: [], isSubmitting: false };
  }

  // ── Callbacks N1 (optionnels — auto-découverts par le framework, ADR-09) ──

  onLocalCurrentStepUpdated({ actual, previous: _ }: TLocalUpdate<number>): void {
    this.getUI('stepIndicator').attr('data-step', String(actual));
    this.getUI('progressBar').style('width', `${(actual / 3) * 100}%`);
  }

  // ── Templates avec selectors N2/N3 (Mode C) ──

  get templates() {
    return {
      stepContent: {
        template: stepContentTemplate,
        select: (data: NamespacedData) => data.local?.currentStep,
      },
      errorList: {
        template: errorListTemplate,
        select: (data: NamespacedData) => data.local?.validationErrors,
      },
    };
  }

  // ── DOM handlers (I48 UI — imposés par TViewCallbacks) ──

  onNextButtonClick(_e: MouseEvent): void {
    this.updateLocal(draft => {
      draft.currentStep += 1;
      draft.validationErrors = [];
    });
  }

  onPrevButtonClick(_e: MouseEvent): void {
    this.updateLocal(draft => { draft.currentStep -= 1; });
  }

  onSubmitButtonClick(_e: MouseEvent): void {
    this.updateLocal(draft => { draft.isSubmitting = true; });
    this.trigger('wizard:submit', { step: this.local.currentStep });
  }
}
```

> Les mécanismes de cet exemple sont des propositions historiques non livrées ; ce lot n'en audite pas le typage détaillé. L'état utilisé par un Behavior appartient à la View, sans API ou cycle de vie Behavior autonome garanti. Voir [Behavior §2.5](behavior.md#25-localstate) pour l'imputation et le confinement, et §7.2 ci-dessus pour les limites de livraison.

---

---

## Lecture suivante

→ [Composer](composer.md) — qui crée et détruit les Views · [Foundation](foundation.md)
