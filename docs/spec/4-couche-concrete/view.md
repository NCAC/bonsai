# View — Composant de rendu et d'interaction UI

> **Projection DOM réactive (N1 livré), contrat modulaire `TUIContract`/`TUIElements` typé, localState (cible)**

[<- Retour couche concrète](README.md) | [-> Behavior](behavior.md) | [5-rendu.md (PDR complète)](../5-rendu.md)

---

| Champ | Valeur |
| --- | --- |
| **Composant** | View |
| **Couche** | Concrète (éphémère) |
| **Statut** | 🟢 Stable |
| **ADR** | [ADR-14](../../adr/ADR-14-contrats-types.md) (contrat modulaire), [ADR-15](../../adr/ADR-15-evenements-ui.md) (événements UI), [ADR-16](../../adr/ADR-16-view-scope-projection.md) (scope, `getUI`, N1/N2/N3), [ADR-17](../../adr/ADR-17-local-state.md) (localState), [ADR-19](../../adr/ADR-19-root-element.md) (`rootElement`), [ADR-22](../../adr/ADR-22-pdr.md) (PDR) |

> **Lot 3 — alignement documentaire V0.9.4.** Les corrections portent sur la structure, les attributions, le cycle de vie et l'imputation du code Behavior, selon la [théorie](../../theorie.md) §2.5, annexe C, D11–D13 et §16.5–§16.7. Les ADR Accepted restent inchangés. Cette révision **ne prétend pas auditer les autres contrats** de cette page (typage, rendu détaillé, état local et DevTools) ; leurs propositions historiques restent à lire avec leurs limites de livraison et sous les obligations transversales ci-dessous. Aucune nouvelle API n'est fixée ici.

---

> ## ⏳ Périmètre d'implémentation
>
> Ce document distingue le **contrat cible** de View de sa surface livrée. Les §1–3 décrivent principalement le pattern modulaire ADR-14 et les primitives N1 sont livrées ; cela ne signifie pas que les garanties structurelles V0.9.4 sont implémentées. Les éléments suivants ne sont **pas encore implémentés** :
>
> | Élément | Strate cible | Sections concernées |
> | --- | --- | --- |
> | Templates N2/N3 (`get templates()`, Modes A/B/C), `TProjectionRead`, cache de `getUI()` | Strate 1c | §4.4–4.8 |
> | Délégation d'événements sur `this.el` | Strate 1c | §4.3 |
> | Nettoyage instrumenté post-validation, occurrences et réservations ; anciens hooks cibles non garantis | À concevoir | §5 |
> | Résolution contrôlée des désignations et projection physique post-validation | À concevoir | §4.1, §4.8 |
> | Déclaration des Composers, cardinalité, soustraction du contenu des slots (I40) | À concevoir ; non livré | §4.2, §6 |
> | Surcharge de `uiElements` par le Composer (ADR-21) | Strate 2 | §1, §4.2 |
> | `localState` (`get localState()`, `updateLocal()`, `this.local`, callbacks N1) | Strate 2a | §7 |
>
> **Périmètre effectif livré (strate 0 + ADR-14, ADR-15)** : `View<TVC>` à un seul générique ; getters abstraits `features`, `uiEvents`, `uiElements` lus une fois au `mount()` ; `mount(rootSelector)` résout le `rootElement` via `document.querySelector` (global, sans création) et refuse `document.body` (I34) ; `getUI(key)` public retourne un `TProjectionNode<TEl>` (`text`, `attr`, `toggleClass`, `visible` via `style.display`, `style`, `element()`), sans cache ; `trigger()`/`request()` protégés par clé namespacée ; handlers DOM câblés par `addEventListener` direct sur le **premier** élément correspondant et handlers Channel câblés au `mount()`, avec filets runtime I82/I84 ; hook `onAttach()` (public).
>
> **Écarts du livré** :
>
> - `TProjectionNode.element()` et `protected get el()` exposent le nœud brut : I39 n'est tenu que par convention (ADR-16) ;
> - `rootElement` résolu dans tout le document, pas dans le slot ; absent → `el = null` puis `TypeError` (au `mount()` si une clé UI déclare des événements, sinon au premier `getUI()`), pas d'erreur framework (ADR-19) ;
> - une faute de frappe dans `features[ns].listens` compile et le handler n'est jamais appelé (ADR-14) ;
> - `TEventsFor<TEl>` : la branche de repli « union large » est inatteignable, `ui<HTMLElement>()(["input"])` est refusé ; et **`TUIContract` n'accepte que les événements de base et de défilement** : `ui<HTMLInputElement>()(["input"])`, `submit`, `toggle`, `play`… compilent seuls mais sont rejetés par `satisfies TUIContract` et `TViewContract` (ADR-15) ;
> - l'auto-discovery DOM ne lit que le prototype direct : un handler hérité d'une View parente est déclaré manquant (ADR-15) ;
> - pas de `onDetach()` : une View remplacée garde ses listeners (ADR-03).

## Table des matières

1. [Classe abstraite View](#1-classe-abstraite-view)
2. [Pattern modulaire ADR-14](#2-pattern-modulaire-adr-14)
   - [Contexte de handler ⏳ (D18)](#24-contexte-de-handler--d18)
3. [Types utilitaires du pattern modulaire](#3-types-utilitaires-du-pattern-modulaire)
4. [Contrat de rendu PDR](#4-contrat-de-rendu-pdr)
   - [Point d'ancrage DOM](#41-point-dancrage-dom)
   - [UIElements et UIEvents](#42-uielements-et-uievents-adr-14--pattern-modulaire)
   - [Délégation d'événements](#43-délégation-dévénements)
   - [getUI()](#44-getui--primitive-de-projection-typée)
   - [get templates()](#45-get-templates--trois-modes-de-rendu)
   - [TProjectionTemplate](#46-tprojectiontemplate)
   - [Templates partiels Mode C](#47-templates-partiels-mode-c--syntaxe-pugjs-uixxx)
   - [Flux d'exécution complet](#48-flux-dexécution-complet)
5. [Cycle de vie passif](#5-cycle-de-vie-passif)
6. [Déclaration des Composers](#6-déclaration-des-composers)
7. [API localState](#7-api-localstate)

---

## 1. Classe abstraite View

**Contrat structurel cible :** une View est enfant **exclusivement d'un Composer** ; Foundation et View ne sont parents que de Composers (D11). Elle possède la part attribuée par son Composer, hors contenu de ses propres slots attribué à ses Composers. Elle conserve l'élément de chacun de ces slots. Le code livré ne garantit pas encore ce partitionnement.

La View est paramétrée par **un seul générique** : son `TViewContract` (ADR-14). Ce contrat compose deux modules indépendants — `features` (canal) et `ui` (DOM) — et la classe l'utilise pour générer les exigences typage des handlers (`TViewCallbacks<TVC>`).

```typescript
import type { TFeatureContract, TFlatTriggers, TFlatRequests,
  TCommandPayloadFor, TRequestParamsFor, TRequestResultFor } from "@bonsai/feature";

/** Contrat View composé — `features` (channel) + `ui` (DOM). */
export type TViewContract<
  F extends TFeatureContract = TFeatureContract,
  U extends TUIContract = TUIContract
> = {
  readonly features: F;
  readonly ui: U;
};

/**
 * Clause `implements` unique — fusion des handlers channel et UI.
 * Symétrie Contract/Callbacks (I88) : `extends View<TVC>` + `implements TViewCallbacks<TVC>`.
 */
export type TViewCallbacks<TVC extends TViewContract> =
  TChannelCallbacks<TVC["features"]> & TUICallbacks<TVC["ui"]>;

/** Surface structurelle d'une classe View — utilisée par Composer (variance). */
export type TViewClass = abstract new (...args: any[]) => View<any>;

abstract class View<TVC extends TViewContract = TViewContract> {
  /**
   * Module Features (manifest applicatif des channels).
   * Évalué UNE SEULE FOIS au mount() — ADR-14 value-first.
   */
  abstract get features(): TVC["features"];

  /**
   * Module UI events — clés UI → entrées typées (`TUIEntry`).
   * Évalué UNE SEULE FOIS au mount(). Utilisé pour générer les handlers DOM requis.
   */
  abstract get uiEvents(): TVC["ui"];

  /**
   * Module UI elements — clés UI → sélecteurs CSS résolus dans `rootElement`.
   * ⏳ Cible non livrée : surchargeable par le Composer via
   * `resolve() → options.uiElements` (ADR-21) — `TResolveResult` livré est
   * `{ view, rootElement }`, sans champ `options`.
   * Toute clé manquante du module `uiEvents` → erreur compile (`TUIElements<TUI>`).
   */
  abstract get uiElements(): TUIElements<TVC["ui"]>;

  /** Sélecteur racine, injecté au mount par le Composer (I31, ADR-19). */
  get rootElement(): string | null;

  /** Élément DOM racine après mount (I34). Permet `el?.dataset` pour le contrat contextuel. */
  protected get el(): HTMLElement | null;

  /**
   * Monté par le Composer (I20). Idempotent — un second appel est un no-op.
   *
   * Séquence :
   *   1. Lecture unique de `features`, `uiEvents`, `uiElements` (ADR-14)
   *   2. Résolution `rootElement` dans le DOM
   *   3. Validation I34 (pas `document.body`)
   *   4. Auto-discovery UI handlers ADR-15 (on{UIKey}{DomEvent})
   *      → `Error` si selector absent d'`uiElements` ou handler DOM manquant (seulement pour
   *        les clés dont `events` est non vide ; élément introuvable → pas de listener, sans erreur)
   *   5. Auto-discovery channel listeners I48 (on{NS}{Event}Event)
   *      → `Error` si handler manquant pour une clé dans `features[NS].listens`
   *   6. onAttach() lifecycle hook
   */
  mount(rootSelector: string): void;

  /**
   * Accès DOM typé — résolution dans le scope `rootElement` (I40).
   * Clé invalide (hors `uiEvents`) → erreur compile-time.
   * Élément absent → throw runtime. Aucun querySelector direct (I39).
   * Le sous-type DOM (`TEl`) est préservé via `ExtractEl<TUIEntry>`.
   */
  getUI<K extends keyof TVC["ui"] & string>(
    key: K
  ): TProjectionNode<ExtractEl<TVC["ui"][K]>>;

  /**
   * Envoie un Command via Channel (I4 — View n'a jamais `emit()`).
   * Clé namespacée `"ns:cmd"` validée contre `TFlatTriggers<F>`. Payload inféré.
   * `protected` — appelée depuis les handlers UI de la sous-classe.
   */
  protected trigger<K extends TFlatTriggers<TVC["features"]> & string>(
    key: K,
    payload: TCommandPayloadFor<TVC["features"], K>
  ): void;

  /**
   * Effectue une Request synchrone (ADR-02, I29). Retour `T | null` si pas de replier.
   * `protected` — appelée depuis les handlers UI de la sous-classe.
   */
  protected request<K extends TFlatRequests<TVC["features"]> & string>(
    key: K,
    params: TRequestParamsFor<TVC["features"], K>
  ): TRequestResultFor<TVC["features"], K> | null;

  /** Hook appelé après le mount complet. Override dans les sous-classes. */
  onAttach(): void;
}
```

> **I4** : la View n'a **jamais** `emit()` — absent du type.
> **I30** : la View ne possède **aucun domain state** — projection pure.
> **I31** : `rootElement: string` CSS est le choix de représentation historique livré (ADR-19), compatible avec une désignation, pas une obligation théorique ; validité d'attribution et résolution contrôlée restent requises (§4.1).
> **I32** : la View peut modifier les attributs de sa racine et son contenu hors contenu des slots attribués, mais **jamais détruire ni remplacer sa racine**.
> **I34 — contrat partiel** : la racine appartient à la part attribuée par le Composer dans le contenu de son slot, sans se confondre avec l'élément du slot. Le refus de `document.body` dans le code livré ne prouve pas ce confinement ; voir §4.1.
> **I39** : accès DOM **exclusivement** via `getUI(key)` — aucun accès brut.
> **I40** : la part exclut le **contenu** des slots attribués, pas leurs éléments conservés par la View ; exclusion non livrée.
> **I80** : aucun `TChannelToken` dans la surface publique — Channel privé derrière Feature.
> **I81** : `features` / `uiEvents` / `uiElements` lus une seule fois au mount, sources de vérité runtime.
> **I82** : handler manquant pour une clé `features[NS].listens` → erreur compile (via `implements TViewCallbacks`) + throw runtime au mount (filet de sécurité).
> **I84** : `events: [...]` non-vide impose les handlers DOM correspondants (`on{Key}{Event}`) — symétrie compile via `TUICallbacks` + filet runtime.
> **I85** : `ui<TEl>()(events)` est l'unique helper pour construire une `TUIEntry`.
> **I86** : `events` est toujours présent dans une `TUIEntry` (jamais optionnel — `[]` = non-interactif explicite).
> **I87** : la clé d'objet dans `features` ≡ namespace de la Feature référencée.
> **I88** : symétrie Contract/Callbacks — toute clé du contrat impose son handler côté `implements`.
> **ADR-14** : pattern value-first (`as const satisfies`) pour la déclaration des trois modules.
> **ADR-19** : `rootElement` n'appartient à **aucun** des trois modules — il vient du Composer.
> **ADR-14** : pattern modulaire — `features` / `uiEvents` / `uiElements` sont composés dans `TViewContract`.

---

## 2. Pattern modulaire ADR-14

Le pattern s'applique à chaque View concrète. Sa réutilisation pour le code Behavior (I83) est une orientation historique, **pas une API Behavior livrée**. Un Behavior est une partie du code de la View, sans statut de composant, existence, identité, part ni Channel propres ; état et messages sont imputés à la View (§2.5, §16.7). Son code ne désigne ni celle-ci ni ses clés.

Les noms des clés de la View et de **tous** ses Behaviors sont disjoints, y compris entre Behaviors ; des noms différents peuvent viser **le même élément**. Une occurrence de fait y est admise une fois, par la View : ses réactions et celles des Behaviors s'exécutent dans l'ordre fixe de déclaration, dans le même traitement local, la même unité de validation et le même contexte causal qualifié. La propagation entre listeners ne crée pas de nouveaux faits. Ni le partage d'un élément ni un Behavior n'ajoutent de droit de Command. L'agrégation des contrats, le contrôle des noms, la capture unique et cet ordre ne sont pas livrés ; voir [Behavior](behavior.md).

### 2.1 Trois modules, un contrat

```text
Module 1 — TFeatureContract : map { namespace → { feature, listens, triggers, requests } }
Module 2 — TUIContract       : map { uiKey → ui<TEl>()(events) }  (TUIEntry)
Module 3 — TUIElements<TUI>  : map { uiKey → selector CSS }      (1:1 avec TUIContract)
Composé  — TViewContract<F,U> = { features: F; ui: U }
Classe   — class extends View<TVC> implements TViewCallbacks<TVC>
```

Chaque module est typé indépendamment et déclaré via `as const satisfies`. Le compilateur vérifie :

- les clés `features[NS].listens / triggers / requests` correspondent à des Events/Commands/Requests de la Feature référencée par `feature` (ADR-14 — `Channel<TDef>` est typé)
- les clés d'`uiElements` sont **exactement** celles d'`uiEvents` (mapped type contraint)
- chaque event DOM listé dans `events: [...]` impose un handler `on{Key}{Event}` sur la classe (ADR-14, I88)
- chaque clé `features[NS].listens` impose un handler `on{NS}{Event}Event` (ADR-09 channel)

### 2.2 Exemple complet — CartView

```typescript
import {
  View, ui,
  type TViewContract, type TViewCallbacks,
  type TUIContract, type TUIElements,
} from "@bonsai/view";
import type { TFeatureContract } from "@bonsai/feature";
import { CartFeature } from "../Cart/cart.feature";

// ─── Module 1 — TFeatureContract : Features groupées par namespace ──────────

const cartViewFeatures = {
  cart: {
    feature:  CartFeature,
    listens:  ["itemAdded"]  as const,
    triggers: ["addItem"]    as const,
    requests: ["total"]      as const,
  },
} satisfies TFeatureContract;

// ─── Module 2 — TUIContract : UI events typés ───────────────────────────────
// `ui<TEl>()(events)` est l'unique helper (I85). `events: []` = non-interactif (I86).

const cartViewUiEvents = {
  totalDisplay: ui<HTMLSpanElement>()([]),
  emptyMessage: ui<HTMLDivElement>()([]),
  addButton:    ui<HTMLButtonElement>()(["click"]),
} satisfies TUIContract;

// ─── Module 3 — TUIElements : sélecteurs CSS, 1:1 avec uiEvents ─────────────

const cartViewUiElements = {
  totalDisplay: "[data-ui='totalDisplay']",
  emptyMessage: "[data-ui='emptyMessage']",
  addButton:    "[data-ui='addButton']",
} satisfies TUIElements<typeof cartViewUiEvents>;

// ─── Composition — TViewContract dérivé par typeof ──────────────────────────

type TCartViewContract = TViewContract<
  typeof cartViewFeatures,
  typeof cartViewUiEvents
>;

// ─── Classe — un seul générique, un seul implements ─────────────────────────
// `implements TViewCallbacks<TCartViewContract>` impose à la fois :
//   • les handlers channel (ADR-09 channel) : `on{NS}{Event}Event`
//   • les handlers DOM     (I48 UI)      : `on{UIKey}{DomEvent}`
//
// Handler absent → erreur TS2420 immédiate. Symétrie Contract/Callbacks (I88).

class CartView
  extends View<TCartViewContract>
  implements TViewCallbacks<TCartViewContract>
{
  get features()   { return cartViewFeatures;   }
  get uiEvents()   { return cartViewUiEvents;   }
  get uiElements() { return cartViewUiElements; }

  // ── I48 UI — handler imposé par events: ["click"] sur addButton ─────────
  onAddButtonClick(_event: MouseEvent): void {
    // Clé namespacée vérifiée contre TFlatTriggers<typeof cartViewFeatures>.
    // Payload inféré depuis CartFeature.channel (TCartDef.commands.addItem).
    this.trigger("cart:addItem", { productId: "abc", qty: 1 });
  }

  // ── ADR-09 channel — handler imposé par cart.listens: ["itemAdded"] ─────────
  onCartItemAddedEvent(payload: { productId: string; qty: number }): void {
    this.getUI("totalDisplay").text(String(payload.qty));
  }

  onAttach(): void {
    // `el` permet de lire le contrat contextuel (data-* attributes) — ADR-14.
    const productId = this.el?.dataset.productId ?? "";
    this.getUI("emptyMessage").visible(productId === "");
  }
}
```

> **Enforcement compile-time** :
>
> - `extends View<TVC>` ET `implements TViewCallbacks<TVC>` : couple obligatoire (I88).
> - `satisfies TFeatureContract` : clé hors d'un Channel → erreur compile.
> - `satisfies TUIElements<typeof uiEvents>` : clé orpheline ou manquante → erreur compile.
> - `trigger("ns:cmd", payload)` : clé hors `TFlatTriggers<F>` → erreur compile.
> - `request("ns:req", params)` : clé hors `TFlatRequests<F>` → erreur compile.
> - `getUI("key")` : clé hors `TVC["ui"]` → erreur compile ; sous-type `TEl` préservé.

### 2.3 Principe : Channel privé derrière Feature (I80)

Le Channel n'est jamais manipulé directement par le consommateur. Le code applicatif ne voit que les **noms de Features** (`typeof CartFeature`, référencés dans `TFeatureContract.{ns}.feature`) et des **clés namespacées** (`"cart:addItem"`).

```typescript
// ✅ BON — surface consommateur : référence Feature + clé namespacée
const features = { cart: { feature: CartFeature, listens: [...], ... } };
this.trigger("cart:addItem", { productId, qty });

// ❌ INTERDIT — exposition directe du token (I80)
const token: TChannelToken<TCartDef, "cart"> = CartFeature.channel; // non
this.trigger(CartFeature.channel, "addItem", { productId, qty }); // non
```

### 2.4 Contexte de handler ⏳ (D18)

> ⏳ **Cible non livrée**, validée le 31 octobre 2026 (point S2 de la [relecture V0.9.4](../../rapports/relecture-V0.9.4-2026-10-30.md)). Le livré expose `this.trigger()` et `this.request()` (§1, §2.2) ; la cible les remplace par le contexte passé à chaque handler, et renomme la lane `requests` en `queries` (lexique de la théorie, §2.4).

Chaque handler reçoit, en second argument, un **contexte** dont le type dépend du déclencheur. C'est ce qui rend D18 vérifiable à la compilation : un traitement d'Event ne peut pas adresser de Command, faute de méthode pour le faire.

| Handler | Déclencheur | Contexte | Offre |
| --- | --- | --- | --- |
| `on{Clé}{ÉvénementDOM}(event, ctx)` | Fait de l'hôte admis par la View dans sa part | `TFactContext<TVC>` | `trigger`, `query` |
| `on{Ns}{Event}Event(payload, ctx)` | Event reçu d'une Feature ou d'un adaptateur | `TEventContext<TVC>` | `query` |

```typescript
class CartView extends View<TCartViewContract> implements TViewCallbacks<TCartViewContract> {
  get features()   { return cartViewFeatures;   }   // lane `queries: ["total"]`
  get uiEvents()   { return cartViewUiEvents;   }
  get uiElements() { return cartViewUiElements; }
  get behaviors()  { return [TrackingBehavior.with({ category: "cart" })] as const; }

  onAddButtonClick(_event: MouseEvent, ctx: TFactContext<TCartViewContract>): void {
    const total = ctx.query("cart:total", {});        // Query permise ; la permission est conservée
    ctx.trigger("cart:addItem", { productId: "abc", qty: 1 });
  }

  onCartItemAddedEvent(payload: { productId: string; qty: number }, ctx: TEventContext<TCartViewContract>): void {
    this.getUI("totalDisplay").text(String(payload.qty)); // projection et état local permis
    // ctx.trigger(...) : n'existe pas sur TEventContext — erreur de compilation (D18)
  }
}
```

Ce que le type ne peut pas trancher reste vérifié à l'exécution : qu'un fait de l'hôte soit bien indépendant selon le monde fermé, ou corrélé à une réaction autorisée (C.4), et qu'une Query ne vise pas une cible en cours de traitement (G5). Un fait d'antécédent inconnu reçoit un `TFactContext` dont `trigger` lève une erreur de transport (G7). Les Behaviors de la View reçoivent les mêmes contextes ([Behavior §2.0](behavior.md#20-api-cible-)).

**Initialisation.** L'initialisation d'une View continue l'unité de son créateur, avec son droit de commander. Une View créée par un Composer en réaction à un Event n'a donc aucun droit de Command pendant son initialisation : elle consulte le domaine (`query`) et projette, mais le chargement des données d'une page incombe à la Feature qui réagit à `router:routeChanged` (D17, D18 ; constat du prototype, lot M5).

---

## 3. Types utilitaires du pattern modulaire

Ces types sont exportés par `@bonsai/feature` et `@bonsai/view`. Le développeur les consomme directement (modules 1-3) ; le compilateur les utilise implicitement (résolution des handlers et des payloads).

### 3.1 Types du Module 1 — `TFeatureContract`

```typescript
/** Référence Feature : classe statique exposant un `channel` typé (ADR-14). */
type TFeatureRef<
  TDef extends TChannelDefinition = TChannelDefinition,
  TNS extends string = string
> = {
  readonly channel: TChannelToken<TDef, TNS>;
};

/** Référence Feature dont le namespace est imposé par la clé d'objet (I87). */
type TFeatureRefForNS<NS extends string> = TFeatureRef<TChannelDefinition, NS>;

/**
 * Contrat Feature-groupé : un seul objet par namespace, contenant
 * la classe Feature + les trois lanes (`listens`, `triggers`, `requests`).
 *
 * La clé du record est le namespace (I87) — vérifié contre
 * `TFeatureRefForNS<NS>` : la classe Feature doit avoir `channel.namespace === clé`.
 */
type TFeatureContract = {
  readonly [NS in string]: {
    readonly feature:  TFeatureRefForNS<NS>;
    readonly listens:  readonly string[];
    readonly triggers: readonly string[];
    readonly requests: readonly string[];
  };
};
```

### 3.2 Aplatisseurs et payloads dérivés

```typescript
/** Aplatissent le contrat en une UNION de clés `"ns:event"` / `"ns:cmd"` / `"ns:req"` (pas une map). */
type TFlatListens<F extends TFeatureContract>;
type TFlatTriggers<F extends TFeatureContract>;
type TFlatRequests<F extends TFeatureContract>;

/** Payload de Command pour une clé `"ns:cmd"` du contrat. */
type TCommandPayloadFor<F extends TFeatureContract, K extends string>;

/** Payload d'Event pour une clé `"ns:event"` du contrat. */
type TEventPayloadFor<F extends TFeatureContract, K extends string>;

/** Params / Result d'une Request pour une clé `"ns:req"` du contrat. */
type TRequestParamsFor<F extends TFeatureContract, K extends string>;
type TRequestResultFor<F extends TFeatureContract, K extends string>;
```

Ces aplatisseurs alimentent la signature des méthodes `trigger` / `request` côté View et la signature des handlers `on{NS}{Event}Event` côté `TChannelCallbacks`.

### 3.3 Types du Module 2 — `TUIContract` et `ui<TEl>()`

```typescript
/**
 * Entrée UI typée — phantom `_el?` encode `TEl`, `events` capturé runtime.
 * `events` est contraint à `TEventsFor<TEl>` (ADR-15).
 * AUCUN sélecteur ici (ADR-21 — il vit dans `uiElements`).
 */
type TUIEntry<
  TEl extends HTMLElement = HTMLElement,
  TEvts extends ReadonlyArray<TEventsFor<TEl>> = ReadonlyArray<TEventsFor<TEl>>
> = {
  readonly events: TEvts;
  readonly _el?: TEl;
};

/**
 * Helper de construction (I85 — unique mécanisme).
 *
 * Forme curryfiée pour préserver l'inférence littérale de `events` tout en
 * permettant la spécification explicite de `TEl` (limitation TypeScript :
 * `const T` sur un paramètre ne préserve pas le littéral si un autre
 * paramètre est passé explicitement avec un défaut).
 *
 * @example ui<HTMLButtonElement>()(["click"])           // interactif
 * @example ui<HTMLSpanElement>()([])                    // non-interactif (I86)
 * @example ui<HTMLInputElement>()(["input", "change"])  // 2 handlers requis
 */
function ui<TEl extends HTMLElement = HTMLElement>():
  <const TEvts extends ReadonlyArray<TEventsFor<TEl>>>(
    events: HasNoDuplicates<TEvts> extends true ? TEvts : never
  ) => TUIEntry<TEl, TEvts>;

/**
 * ⚠️ Écart livré (ADR-15) : `TUIEntry` sans argument vaut `TUIEntry<HTMLElement, …>`, donc
 * `events` n'y accepte que `TUIBaseEvents | TUIScrollEvents`. Une entrée `ui<HTMLInputElement>()(["input"])`
 * (ou `submit`, `toggle`, événements média) n'est pas assignable à `TUIContract`.
 */
type TUIContract = Readonly<Record<string, TUIEntry>>;

/** Extrait `TEl` d'une `TUIEntry` via le phantom — utilisé par `getUI()`. */
type ExtractEl<TEntry extends TUIEntry>;
```

### 3.4 Types du Module 3 — `TUIElements<TUI>`

```typescript
/**
 * Sélecteurs CSS — clés contraintes au mapped type sur `TUI` (ADR-21, I85).
 * Toute clé orpheline ou manquante → erreur compile.
 */
type TUIElements<TUI extends TUIContract> = {
  readonly [K in keyof TUI]: string;
};
```

### 3.5 Composition — `TViewContract` et `TViewCallbacks`

```typescript
type TViewContract<
  F extends TFeatureContract = TFeatureContract,
  U extends TUIContract = TUIContract
> = {
  readonly features: F;
  readonly ui: U;
};

/**
 * Handlers DOM générés par symétrie depuis `TUIContract` (I48 UI).
 * `events: ["click"]` sur `addBtn` → exige `onAddBtnClick(e: MouseEvent): void`.
 */
type TUICallbacks<U extends TUIContract>;

/**
 * Handlers channel générés par symétrie depuis `TFeatureContract` (ADR-09 channel).
 * `cart.listens: ["itemAdded"]` → exige `onCartItemAddedEvent(p): void`.
 */
type TChannelCallbacks<F extends TFeatureContract>;

/**
 * Clause `implements` unique pour une View (I88).
 * Fusion des handlers channel et UI.
 */
type TViewCallbacks<TVC extends TViewContract> =
  TChannelCallbacks<TVC["features"]> & TUICallbacks<TVC["ui"]>;
```

> **Garanties compile-time** :
>
> - `trigger("ns:cmd", payload)` : clé hors `TFlatTriggers<F>` → erreur compile.
> - `request("ns:req", params)` : clé hors `TFlatRequests<F>` → erreur compile.
> - Payload inféré exactement depuis le `Channel<TDef>` de la Feature référencée.
> - Handler manquant pour une clé `listens` → `TS2420` via `implements TViewCallbacks`.
> - Handler manquant pour un event DOM (`events: ["click"]`) → `TS2420` via `implements TViewCallbacks`.
> - `emit()` **jamais** disponible sur une View (I4) — absent du type.

---

## 4. Contrat de rendu PDR

> **Decision ADR-22** : Bonsai adopte la **Projection DOM Reactive** (PDR) comme
> strategie de rendu. La View ne "re-rend" pas -- elle **projette** des donnees
> sur un DOM existant via des mutations chirurgicales, sans VDOM, sans diff d'arbre.
>
> **Motivations** :
>
> - Le DOM preexiste dans 99% des cas (rendu serveur SSR, CMS, HTML statique)
> - Les notifications per-key (ADR-09) fournissent déjà l'information "quoi a change"
> - Zero allocation, zero diff runtime -- O(delta) mutations directes
> - Pas de double template (front + back)
> - Coherent avec I30 (View = projection pure) et I42 (local state reactif alimente les mêmes selectors)

### 4.1 Point d'ancrage DOM

**Contrat cible.** Le Composer fournit à la View, **à sa création**, une désignation de sa part, jamais un élément de l'hôte ni une identité. La View établit sa référence structurelle par résolution contrôlée : vérification de propriété et de validité de l'attribution, sans que la désignation confère elle-même un accès. Sa validité finit avec cette attribution ; **réattribuer le même emplacement ne réactive pas l'ancienne désignation**. Syntaxe, transport et typage de ce protocole restent à concevoir.

**I31 et choix de représentation.** La chaîne CSS `TResolveResult.rootElement` est un choix historique d'API (ADR-19), pas une nécessité de la théorie. Un sélecteur trouvé sous le bon ancêtre ne prouve ni la propriété ni la validité de l'attribution. Le choix de créer un élément absent en analysant un sélecteur ne doit pas être présenté comme une obligation théorique.

**I32 et autorité.** La View peut modifier les attributs de sa racine et tout son contenu **hors contenu de ses slots attribué aux Composers**. Elle ne détruit ni ne remplace sa propre racine. Elle conserve l'élément de chaque slot ; avant de le supprimer ou de le remplacer, elle détruit d'abord le Composer concerné et récupère son contenu. Les restitutions suivent une cascade logique de bas en haut, sans hook applicatif (§5–§6).

**Code réel.** `View.mount(rootSelector)` résout aujourd'hui la chaîne avec un **`document.querySelector()` global**, refuse `document.body`, mais ne contrôle aucune attribution et ne crée aucune racine absente. Une racine introuvable laisse `el = null` et peut conduire au `TypeError` décrit dans le bandeau. C'est `Composer.attach()` qui crée physiquement et immédiatement le **slot** absent, pas la racine de la View. Voir [Composer §1.2](composer.md#12-classe).

### 4.2 UIElements et UIEvents (ADR-14 — pattern modulaire)

La View **DOIT** déclarer ses nœuds d'interaction DOM et leurs événements.
ADR-14 introduit trois **modules contractuels** complémentaires :

| Module | Rôle | Mutable au runtime ? |
| --- | --- | --- |
| `TFeatureContract` | Interactions channel par Feature (listens / triggers / requests Feature-groupés) | Non — structurel |
| `TUIContract` | Nœuds DOM avec **type HTML** + **events DOM déclarés** (sans sélecteurs) | Non — structurel |
| `TUIElements<TUI>` | Map nom → **sélecteur CSS** (overridable par Composer ADR-21) | Oui — overridable au mount |

La séparation `TUIContract` ↔ `TUIElements` est essentielle :

- Les **events DOM** (`["click"]`) sont compile-time + runtime — ils pilotent `TViewCallbacks` (handlers requis) ET `addEventListener` au mount. Ils vivent dans le contrat type-level.
- Les **sélecteurs CSS** (`"#add-btn"`) sont uniquement runtime — un détail d'implémentation que le Composer peut surcharger via `resolve() → options.uiElements` (ADR-21, ADR-16). Ils vivent dans un getter concret séparé.

```typescript
// ── Module TUIContract — entrées UI typées (sans sélecteurs) ──────────────
//
// Chaque entrée porte :
//   - events : événements DOM déclarés (OBLIGATOIRE — `[]` = non-interactif)
//   - _el?   : phantom TEl (compile-time only) pour le typage de getUI(k).element() → TEl
//
// Helper `ui<TEl>()(events)` (forme curryfiée pour préserver l'inférence littérale) :

const cartViewUiEvents = {
  addButton:    ui<HTMLButtonElement>()(["click"]),                // interactif
  totalDisplay: ui<HTMLSpanElement>()([]),                          // non-interactif explicite
  searchInput:  ui<HTMLInputElement>()(["input", "change"]),        // 2 handlers requis
  itemList:     ui<HTMLUListElement>()([])
} satisfies TUIContract;

// ── Module TUIElements — sélecteurs CSS overridables (ADR-21) ────────────────
//
// Les clés sont contraintes à matcher TUIContract — aucun orphelin possible.

const cartViewUiElements = {
  addButton:    ".Cart-addButton",
  totalDisplay: ".Cart-totalDisplay",
  searchInput:  ".Cart-searchInput",
  itemList:     ".Cart-itemList"
} satisfies TUIElements<typeof cartViewUiEvents>;

// ── Auto-discovery I48 UI ──────────────────────────────────────────────────
//
// Le framework dérive les handlers DOM requis depuis `uiEvents[k].events` :
//   addButton + "click"  → onAddButtonClick(e: MouseEvent)
//   searchInput + "input" → onSearchInputInput(e: Event)
//
// Convention : on{UIKey}{DomEvent} (sans suffixe — un click reste un click).
// `events: []` ne génère aucun handler requis.
//
// Symétrie Contract/Callbacks (I84/I88) : déclarer `events: ["click"]` est un
// engagement compile-time — `implements TViewCallbacks<TVC>` impose la méthode.
```

**Sémantique réelle — `querySelector` (1 élément), pas `querySelectorAll`** :
le code livré résout chaque sélecteur de `uiElements` via
`querySelector()` sur le **`rootElement` monté** (`getUI()` et le câblage
des handlers DOM, `packages/view/src/bonsai-view.ts` ; c'est le `rootElement` lui-même
qui est trouvé par `document.querySelector()`) — **un seul** élément
par clé, jamais N, et **aucune délégation** d'événement vers plusieurs
éléments matchés. Le modèle historique « N éléments par clé + délégation + N
instances de Composer » est **non livré** ; la cardinalité des déclarations
et leur représentation restent à arbitrer (§6), sans se déduire d'une recherche DOM.

- ⏳ Cible : pour les **events DOM**, la délégation s'appliquerait à TOUS les éléments matchés. Un seul handler `onProductItemAddToBasketClick` couvrirait N éléments `.ProductItem-addToBasket`.
- Historique ADR-18 : N Composers par sélecteur est une proposition non livrée, distincte du nombre de Views gérées par un Composer (I37).

**Override par Composer (ADR-21)** — proposition historique non livrée : `TResolveResult` contient seulement `view` et `rootElement`, sans `options`. La forme de surcharge reste à arbitrer ; aucun snippet de résultat enrichi n'est un contrat compilable. Un paramétrage éventuel ne doit jamais transférer d'élément hôte ni contourner les attributions (voir [Composer](composer.md)).

Le développeur applicatif n'écrit **jamais** de cast manuel — le pattern modulaire garantit que :

1. `getUI("addButton").element() → HTMLButtonElement` (typage du sous-type via phantom)
2. `onAddButtonClick(e: MouseEvent)` est requis si `events: ["click"]`
3. ⏳ Cible : les sélecteurs seraient overridables sans toucher au contrat type-level (ADR-21, non livré — `TResolveResult` n'a pas de champ `options` aujourd'hui)

Pour le pattern complet (5 étapes : `features` + `uiEvents` + `uiElements` + alias `TVC` + classe), voir [ADR-14](../../adr/ADR-14-contrats-types.md) §Exemple applicatif complet.

> **Garanties compile-time du pattern modulaire** :
>
> - `TUIContract` (via `ui<TEl>()(events)`) contraint au type-level les events DOM autorisés (ADR-15 — `TEventsFor<TEl>` sans doublons).
> - `TUIElements<typeof uiEvents>` garantit la bijection clés DOM ↔ sélecteurs CSS — pas d'orphelin.
> - `getUI(key)` est typé via `ExtractEl<TUI[K]>` — `getUI("addButton").element() → HTMLButtonElement`.
> - `implements TViewCallbacks<TVC>` impose les handlers DOM (`on{Key}{DomEvent}`) requis par `events: [...]` non-vide (I84, I88).
> - ⏳ Cible, non livré : les sélecteurs CSS overridables par le Composer via `resolve() → options.uiElements` (ADR-21, ADR-16) — `TResolveResult` livré n'a pas de champ `options`.
>
> **Garanties bootstrap (filets runtime)** :
>
> - Chaque clé d'`uiEvents[k]` **dont `events` est non vide** doit avoir une entrée dans `uiElements` — sinon `Error` au mount (une clé `events: []` sans sélecteur ne lève qu'au premier `getUI()`).
> - Chaque event DOM déclaré (`events: [E, ...]`) doit avoir son handler implémenté sur le **prototype direct** de la classe (un handler hérité est vu comme manquant) — filet runtime même si `as any` contourne `TViewCallbacks`.
> - Si l'élément d'une clé interactive est introuvable, aucun listener n'est posé et aucune erreur n'est levée.

### 4.3 Délégation d'événements

> ⏳ Strate 1c.
>
> Aujourd'hui, un `addEventListener` direct est posé sur le premier élément
> correspondant à chaque clé UI.

Le framework utilise la **delegation d'événements** : un seul listener par type
d'événement est attache sur `this.el`. Quand un événement DOM bulle, le framework
teste `event.target.closest(selector)` contre chaque `@ui` déclaré.

```text
UN seul listener "click" attache sur this.el
         |
    +----+----------------------------+
    |      this.el (#cart)            |
    |                                 |
    |  +-- @ui.addButton --+          |
    |  |  <button>         |          |
    |  |  click ici ----+  |          |
    |  +----------------+  |          |
    |                       |          |
    +-----------------------+          |
                |
     bulle remonte -> intercepte par this.el
     -> closest('.Cart-addButton') match
     -> appelle onAddButtonClick(event)
```

Avantages :

- **Éléments créés dynamiquement** (fragments, `reconcile`) : les nouveaux enfants sont couverts automatiquement sans rebind
- **Performance** : 3 listeners (click, input, submit) au lieu de N x 3
- **Nettoyage cible** : retrait instrumenté des listeners après validation de la fin logique, pas hook applicatif pendant la cascade (§5). Le runtime actuel ne nettoie aucun listener.

> ⏳ Cible non livrée — **qualification des saisies (protocole du monde fermé, théorie C.4).**
>
> Les saisies dans la part (clic, appui sur une touche, saisie d'une valeur, soumission) relèvent du protocole du monde fermé. Leurs **opérations productrices** sont les simulations et envois d'événements de l'hôte : `click()`, `submit()`, `requestSubmit()`, `dispatchEvent()`, ainsi que `select()` et `execCommand()` pour la saisie. Le code applicatif n'y accède que par une interface Bonsai instrumentée ; un appel brut est refusé par une garde statique (G8). Une saisie qu'aucune opération instrumentée en cours de la même racine n'a pu produire est un **fait indépendant établi** : sa réaction peut adresser une Command déclarée (D18). Une saisie survenant pendant une telle opération, sans corrélation univoque, est d'antécédent inconnu et n'accorde aucune Command.
>
> `isTrusted` n'est pas la preuve. L'indépendance ne vaut que dans le périmètre observé : un script non coordonné de la page n'est pas distingué d'une action humaine (B.2). La forme de l'interface instrumentée reste à définir avec l'API cible de la View.

### 4.4 getUI() — Primitive de projection typée

> **Limite connue — écriture dans le contenu des slots.** L'élément qu'une projection reçoit est celui de la part entière de la View, y compris les éléments de slot dont le contenu est attribué à ses Composers et lui est donc soustrait (6.5). Rien n'empêche mécaniquement une projection d'écrire dans ce contenu, ce qui empiéterait sur la part d'un autre propriétaire (T7). La règle est : une projection n'agit que sur les clés UI déclarées par la View et ses Behaviors, résolues hors du contenu des slots ; elle relève de la revue ([gardes](../../gardes.md), parts non vérifiables automatiquement). Le contrôle par construction supposerait de ne confier à la View que la portion qui lui reste ; constat du prototype du noyau, lot M4.

> ⚠️ **§4.4–4.8 décrivent la cible strate 1c (cf. bandeau de périmètre)** —
> ce qui est **livré aujourd'hui** (`packages/view/src/bonsai-view.ts`) :
> `getUI(key): TProjectionNode<TEl>` **uniquement** (pas d'union avec
> `TProjectionRead`, ce type n'existe pas) ; **aucun cache** — chaque appel
> refait un `querySelector()` ; toutes les méthodes de `TProjectionNode`
> retournent `void` (**pas chaînables**, pas de `this`) : `text(value: string)`
> (pas `string | number`), `attr(name: string, value: string)` (pas de
> support `null`), `toggleClass(className, force)`, `visible(show: boolean)`
> (bascule `display: none`), `style(property, value)`, `element(): TEl`.

La View accede aux noeuds DOM **exclusivement** via `getUI(key)`, jamais via
`querySelector`, `getElementById` ou tout autre accès DOM brut (I39).

> **Scope DOM cible (I40)** : la résolution contrôlée doit exclure le **contenu attribué** des slots, y compris pour le code Behavior ; leurs éléments restent dans la part de la View. Le contrôle porte sur l'autorité, pas seulement la descendance DOM, et reste requis pendant l'exécution. Le runtime livré fait un simple `querySelector()` descendant et ne réalise pas cette exclusion.

```typescript
abstract class View<TVC extends TViewContract = TViewContract> {
  /**
   * Résout un @ui par son nom logique.
   * Résolution paresseuse + cache : querySelector une seule fois.
   * Si le nœud n'existe pas dans le DOM, jette une erreur.
   *
   * Le type de retour dépend de la couverture template :
   * - @ui SANS template -> TProjectionNode<TEl> (lecture + mutation N1)
   * - @ui AVEC template -> TProjectionRead (lecture seule)
   *
   * Source de mutation unique par @ui garantie par le type system (I41).
   *
   * Le framework dérive les overloads à partir des clés présentes
   * dans get templates(). `TVC["ui"]` (TUIContract) contraint les clés
   * autorisées et `ExtractEl<TVC["ui"][K]>` extrait le sous-type DOM
   * via le phantom `_el?` de l'entrée UI (I85).
   */
  getUI<K extends keyof TVC["ui"] & string>(
    key: K
  ): TProjectionNode<ExtractEl<TVC["ui"][K]>> | TProjectionRead;
}
```

**TProjectionRead** -- accès en lecture seule (disponible pour tous les @ui) :

```typescript
type TProjectionRead = {
  /** Lit la valeur d'un input/select/textarea */
  value(): string;

  /** Lit l'etat checked d'un checkbox/radio */
  checked(): boolean;

  /** Lit un attribut */
  getAttr(name: string): string | null;

  /** Lit le textContent */
  getText(): string;

  /** Teste la presence d'une classe CSS */
  hasClass(className: string): boolean;
}
```

**TProjectionNode** -- lecture + mutation N1 (uniquement pour les @ui **non** couverts par un template) :

```typescript
type TProjectionNode = TProjectionRead & {
  /** Met a jour le textContent (no-op si inchange) */
  text(value: string | number): this;

  /** Met a jour un attribut (data-*, aria-*, etc.) -- null = remove */
  attr(name: string, value: string | boolean | null): this;

  /** Toggle/ajoute/retire une classe CSS */
  toggleClass(className: string, force?: boolean): this;

  /** Show/hide via attribut hidden */
  visible(show: boolean): this;

  /** Met a jour une propriete CSS inline */
  style(prop: string, value: string): this;
}
```

> **Note** : `TProjectionNode` effectue un check d'identite avant chaque mutation
> (ex: `if (node.textContent !== str)`) pour eviter les ecritures DOM inutiles.
>
> **Invariant I41 (ADR-16)** : chaque @ui a une **source de mutation unique**.
> Si un @ui est couvert par un template, `getUI(key)` retourne `TProjectionRead` (lecture seule) --
> la mutation passe exclusivement par `template.project()`. Sinon, `getUI(key)` retourne `TProjectionNode`.
> Ceci est garanti par le type system (surcharges de `getUI()`).
>
> **Conséquence** : `TProjectionNode` n'expose pas de `.node` mutable. Sa méthode
> `element(): TEl` retourne l'élément natif typé (ADR-14) pour les API DOM non
> couvertes par les primitives N1 (focus, sélection, mesures…) : usage d'exception,
> à justifier, qui ne doit pas contourner N1 ni les templates (I39, I41).

Usage en Mode A (pas de template -- mutations N1 uniquement) :

```typescript
// Le developpeur utilise getUI() -> TProjectionNode dans ses handlers Event
onCartTotalUpdatedEvent(payload: { total: number }): void {
  this.getUI("totalDisplay").text(`${payload.total} EUR`);
}

onCartItemAddedEvent(payload: { count: number }): void {
  this.getUI("badgeCount").text(String(payload.count));
  // 🧭 toggleClass("has-items", …) pilote une classe CSS par un état
  // dynamique — tension non tranchée avec la convention data-* (cf. audit R24).
  this.getUI("badgeCount").toggleClass("has-items", payload.count > 0);
}

// trigger : cle namespacee compilee contre contract.triggers
onSubmitClick(): void {
  this.trigger("auth:login", { username: "...", remember: true });
}
```

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

### 4.8 Flux d'exécution complet

Le tableau distingue le **contrat cible** des appels immédiats du code livré. Il ne prescrit aucune pseudo-API de bootstrap ou de teardown.

| Phase cible | Structure et validation |
| --- | --- |
| Démarrage | La racine établit les Channels avant les consultations initiales. L'initialisation suit les dépendances déclarées ; une cible active ou non prête ne peut être interrogée. Le transport différé attend la réussite du démarrage ; aucune application partiellement démarrée n'est publiée |
| Création | Seul le Composer crée la View, lui attribue sa part et fournit sa désignation. L'initialisation de la View, exécutée sur ses propres ressources, entre dans l'unité de validation du créateur, sans transfert d'autorité |
| Préparation | Résoudre sous contrôle de propriété ; préparer déclarations, observations, état local et effets de projection dans l'unité autorisée. Les références structurelles n'exigent pas que le DOM soit déjà matérialisé |
| Traitement | Un fait admis par la View donne un seul traitement local ; les réactions View/Behaviors suivent l'ordre déclaré et le même contexte. Les messages différés sont réservés sans être délivrés pendant l'unité ; les Queries restent synchrones et en lecture seule |
| Validation ou échec | Les invariants d'état sont vérifiés à la frontière de l'unité, pas après chaque opération. Le rollback interne comprend existences, abonnements, attributions, restitutions et différés ; les créations abandonnées et leurs désignations ne sont pas publiées |
| Engagement post-validation | Engager les effets physiques préparés dans l'ordre, avant la prochaine délivrance différée, sans attendre leurs achèvements asynchrones. Au premier échec synchrone, les effets suivants sont non tentés ; les précédents ne sont pas annulés |
| Résultat | Admettre les résultats instrumentés déclarés par de nouveaux messages vers l'occurrence vivante concernée, sans réentrance. Distinguer intention, engagement, réussite observée, échec et non-tentative |
| Fin logique | Détruire les descendants et restituer leurs parts de bas en haut, sans hook applicatif ni message délivré pendant la cascade (§5–§6) |
| Nettoyage | Après validation, retirer les observations et appliquer les retraits physiques préparés. Les erreurs ne révoquent pas la fin logique ; les callbacks tardifs ne ressuscitent aucun destinataire |

**Limite hôte :** différer une projection ne rend pas sa série d'écritures atomique. Un échec extérieur ne restaure ni le DOM déjà changé ni la validation interne ; il est traité par une nouvelle admission si le destinataire vit encore. Une intention enregistrée n'est pas une réussite matérielle (§2.5, C.3).

**Code réel :** le Composer crée sans argument une View puis appelle `mount(rootSelector)`. Celui-ci lit les trois getters, cherche globalement la racine, câble directement les premiers éléments UI et les Channels puis appelle `onAttach()`. Les mutations N1 sont immédiates ; aucune unité de validation, préparation d'effets, capture unique Behavior, cascade ou désinscription n'est fournie par ces classes. Le [Composer](composer.md#31-diff-pour-le-retour-simple-tresolveresult--null) décrit le diff réellement livré.

---

## 5. Cycle de vie passif

La View ne décide ni de sa création ni de sa destruction : l'existence appartient à son **Composer parent**, jamais directement à une Foundation. Elle reste responsable de ses propres ressources pendant l'initialisation incluse dans l'unité du créateur.

| Nom / mécanisme | État et portée |
| --- | --- |
| `onAttach()` | Seul hook View livré, public, appelé directement à la fin de `mount()` ; pas un Event Channel. Ne prouve ni insertion préalable, ni résolution contrôlée, ni validation transactionnelle |
| `onDetach()`, `onRender()` | Anciennes propositions non livrées ; signatures et articulation future non arbitrées. Ne constituent pas des traitements arbitraires ajoutés au contrat |
| Cascade cible | Fin structurelle de bas en haut, restitutions aux propriétaires encore présents, **aucun hook ou traitement applicatif ni délivrance pendant la cascade** |
| Nettoyage cible | Instrumenté et physique après validation ; sa réussite n'est pas une condition de fin logique |

L'ancien scénario « hook `onDetach()` obligatoire avant toute destruction » est incompatible avec la cascade de §2.5 et n'est pas conservé comme contrat. Le fait que le runtime n'offre pas ce hook ne signifie pas qu'il nettoie déjà les ressources : **les listeners DOM et Channel ne sont jamais retirés par ces classes**, même quand le Composer oublie la View.

Le code Behavior n'a ni fin de composant, ni part à restituer, ni hook autonome. Son état est celui de la View et suit son rollback interne et sa fin ; la cascade n'appelle aucun nettoyage applicatif Behavior. Voir [Behavior §3](behavior.md#3-cycle-de-vie).

### 5.1 Machine à états

Ce titre conserve une ancre historique, pas la promesse de la machine `created → wired → attached → detached`. Le protocole cible distingue déclaré, en initialisation, prêt à consulter, publié et détruit (C.1), indépendamment de la présence physique DOM. Le code View n'a aujourd'hui qu'un booléen `#mounted`, positionné avant les validations du montage ; un second `mount()` est un no-op, y compris après un échec partiel.

Chaque création associe une **occurrence de vie non réutilisable**, distincte du type, du namespace ou de l'emplacement. Callbacks, opérations et messages locaux visent cette occurrence ; sa validité est contrôlée avant admission **et** avant délivrance. Une destruction validée retire ses délivrances en attente ; un callback tardif est écarté avant admission, sans transfert vers une nouvelle View au même emplacement (C.2).

Une destruction reste provisoire jusqu'à validation. Son annulation conserve la même occurrence, les propriétaires, parts, désignations, abonnements et réservations : ce n'est pas un remontage. Les notifications capturées entre-temps attendent l'issue de l'unité : abandon si la destruction est validée, admission après annulation sinon. Une destruction validée est terminale ; retrouver un élément dans le DOM ne réactive ni la View, ni son Composer, ni une ancienne désignation.

Les Events sont réservés aux **occurrences d'abonnement présentes à l'émission** et dans leur ordre (C.6). Avant délivrance, abonnement, propriétaire et Channel doivent encore être valides. Un abonnement créé ou recréé plus tard n'hérite d'aucune réservation antérieure ; leur abandon ne réordonne pas les autres. Le runtime de View ne garantit pas encore ce protocole de durée de vie ni le rollback structurel décrit ici.

---

## 6. Déclaration des Composers

> ⏳ **Cible non livrée.** `get composers()` n'est ni fourni ni consommé par la classe actuelle. Son API cible, commune à la View et à la Foundation, est fixée dans [Composer §1.3](composer.md#13-api-cible-) :

```typescript
// ─── View ou Foundation : déclaration des slots ──────────────────────────────
get composers() {
  return {
    main: { slot: "[data-slot='main']", composer: MainComposer },
    side: { slot: "[data-slot='side']", composer: CartPanelComposer },
  } as const;                      // clés de slot disjointes des clés UI
}
```

Les clés de slot sont disjointes des clés UI de la View et de ses Behaviors (contrôle statique, comme D13).

La View déclare les emplacements de composition ; elle ne décide pas quelles Views y créer. Elle crée des **Composers seulement** (D11), auxquels elle attribue le contenu des slots. Chaque Composer décide de l'existence et des parts de ses Views. La Foundation suit la même séparation : elle ne crée pas directement de View.

| Ressource / opération | Autorité cible |
| --- | --- |
| Racine de la View | Attribuée par son Composer ; attributs et contenu autorisé modifiables par la View, racine non destructible ni remplaçable par elle (I32) |
| Élément slot | Reste dans la part de la View ; son contenu attribué lui est soustrait |
| Contenu attribué au Composer | Composer propriétaire hors parts attribuées à ses Views ; aucune lecture du contenu confié aux enfants |
| Création d'un Composer enfant | Désignation du contenu fournie à la création, jamais élément hôte passé à l'enfant ; résolution contrôlée de propriété et validité de l'attribution |
| Retrait ou remplacement de l'élément slot | **Détruire d'abord le Composer**, récupérer le contenu, puis préparer le retrait physique |
| Fin d'une View parente | Cascade de ses descendants de bas en haut, sans hook applicatif ; restitutions imputées à chaque propriétaire encore présent |

Créations, initialisations, destructions, attributions, restitutions et abonnements appartiennent à l'unité de validation concernée. Leur annulation conserve intégralement la structure antérieure, occurrences et désignations comprises, sans transfert de propriété ni recréation. Le nettoyage physique irréversible vient seulement après validation et n'est pas atomique sur l'hôte.

Un template ou une projection ne doit donc pas retirer l'élément slot puis déduire du DOM disparu la destruction du Composer. La présence ou le retour du DOM ne prouve pas une existence et ne réactive jamais un Composer détruit. Réattribuer le même emplacement ne réactive pas non plus une ancienne désignation.

### Sémantique N-instances — composition typée par attribut (ADR-18)

Ancre et titre historiques conservés. Une répétition de champs peut motiver plusieurs attributions de contenu et plusieurs Composers, mais « un résultat de `querySelectorAll()` = une instance recevant un élément DOM » n'est ni un protocole théorique ni une capacité livrée. **Choix V1 (31 octobre 2026) :** une entrée de `composers` correspond à exactement un slot ; la sémantique « N-instances » d'ADR-18 n'est pas retenue. N zones composées passent par N Views, chacune avec son slot et donc son Composer ; une liste purement visuelle relève de la projection de la View.

**I37** désigne le choix d'un type unique de Composer pouvant gérer 0..N Views hétérogènes. Ce choix reste le contrat cible d'I37, non une nécessité théorique ; seuls le type unique et **0/1 View** sont livrés, sans retour tableau. Le nombre de Composers déclarés par une View et le nombre de Views d'un Composer sont deux questions distinctes. Voir [Composer §3.2](composer.md#32-diff-pour-le-retour-tableau-tresolveresult).

**I36** reste la séparation des responsabilités : la View déclare une composition par Composers et ne crée jamais directement d'autres Views. Un Behavior n'est pas une voie de composition parallèle : pas de composant, part ou existence propres, et aucun droit de lire ou produire dans le contenu attribué aux Composers. Les éléments peuvent être partagés entre clés de noms disjoints de la View et des Behaviors, jamais les autorités sur les parts.

---

## 7. API localState

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

## Lecture suivante

-> [behavior.md](behavior.md) -- plugins UI reutilisables
-> [5-rendu.md](../5-rendu.md) -- PDR complète, templates PugJS, ProjectionList
