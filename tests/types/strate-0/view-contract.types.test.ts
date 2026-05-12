/**
 * Tests de type — Verrou compile-time du contrat View (ADR-0040 + ADR-0042 + ADR-0044 + ADR-0045)
 *
 * Ces tests ne s'exécutent **pas** au runtime — ils vérifient que TypeScript
 * rejette correctement tout usage de View qui sort du contrat modulaire
 * déclaré dans le pattern ADR-0042. Si un `@ts-expect-error` ne déclenche
 * plus d'erreur (parce que le typage a été relâché), le compilateur lève
 * « Unused '@ts-expect-error' directive » → la régression est détectée immédiatement.
 *
 * Couvre :
 *   - trigger("ns:cmd", payload) : clé namespacée doit être dans
 *     TFlatTriggers<features> ; payload typé via TCommandPayloadFor.
 *   - request("ns:req", params) : clé namespacée doit être dans
 *     TFlatRequests<features> ; params + result typés.
 *   - implements TViewCallbacks<TVC> : handler manquant ou payload mal typé
 *     → erreur compile (channel handlers ET DOM handlers — symétrie I88).
 *   - I80 : Channel privé — aucun TChannelToken dans la surface consommateur.
 *   - I84 : events: ["click"] sur un élément impose onXxxClick.
 *   - I87 : clé d'objet ≡ namespace de la Feature référencée.
 *   - I90 (ADR-0044) : doublons dans events[] → HasNoDuplicates retourne never.
 *   - I89/I91 (ADR-0045) : TEventsFor<TEl> — events incohérents avec le
 *     sous-type d'élément → erreur compile ; fallback HTMLElement permissif.
 *
 * @jest-environment node
 */

import { describe, it } from "@jest/globals";
import { type TChannelToken, type TChannelDefinition } from "@bonsai/event";
import type { TFeatureContract } from "@bonsai/feature";
import {
  View, ui,
  type TViewContract,
  type TViewCallbacks,
  type TUIContract,
  type TUIElements
} from "@bonsai/view";

// ─── Fixtures : deux Features factices avec leurs TChannelDef ───────────────

type TCartChannelDef = {
  readonly commands: { addItem: { productId: string; qty: number } };
  readonly events:   { itemAdded: { productId: string } };
  readonly requests: { getCount: { params: void; result: number } };
};

type TUserChannelDef = {
  readonly commands: { signIn: { email: string } };
  readonly events:   { signedIn: { userId: string } };
  readonly requests: { getProfile: { params: void; result: { name: string } } };
};

class CartFeature {
  static readonly channel: TChannelToken<TCartChannelDef, "cart"> = { namespace: "cart" };
}

class UserFeature {
  static readonly channel: TChannelToken<TUserChannelDef, "user"> = { namespace: "user" };
}

// ─── View qui déclare cart pour les trois lanes ─────────────────────────────

const cartOnlyFeatures = {
  cart: {
    feature:  CartFeature,
    listens:  ["itemAdded"] as const,
    triggers: ["addItem"]   as const,
    requests: ["getCount"]  as const
  }
} satisfies TFeatureContract;

const cartOnlyUiEvents = {
  count: ui<HTMLElement>()([])
} satisfies TUIContract;

const cartOnlyUiElements = {
  count: "[data-ui='count']"
} satisfies TUIElements<typeof cartOnlyUiEvents>;

type TCartOnlyContract = TViewContract<
  typeof cartOnlyFeatures,
  typeof cartOnlyUiEvents
>;

class CartOnlyView
  extends View<TCartOnlyContract>
  implements TViewCallbacks<TCartOnlyContract>
{
  get features()   { return cartOnlyFeatures; }
  get uiEvents()   { return cartOnlyUiEvents; }
  get uiElements() { return cartOnlyUiElements; }

  // ── trigger() — clé namespacée déclarée, payload bien typé ─────────────
  callOK_trigger(): void {
    this.callTrigger("cart:addItem", { productId: "abc", qty: 1 }); // ✅
  }

  callKO_triggerUnknownNamespace(): void {
    // @ts-expect-error — "user:signIn" n'est pas dans features.user (user absent).
    this.callTrigger("user:signIn", { email: "x@y" });
  }

  callKO_triggerUnknownCommand(): void {
    // @ts-expect-error — "cart:noSuchCommand" n'existe pas dans cart.triggers.
    this.callTrigger("cart:noSuchCommand", { productId: "x", qty: 1 });
  }

  callKO_triggerWrongPayload(): void {
    // @ts-expect-error — qty doit être un number.
    this.callTrigger("cart:addItem", { productId: "x", qty: "1" });
  }

  callKO_triggerListenAsTrigger(): void {
    // @ts-expect-error — "cart:itemAdded" est dans listens, pas triggers.
    this.callTrigger("cart:itemAdded", { productId: "x" });
  }

  // ── request() — clé namespacée déclarée, params + result typés ─────────
  callOK_request(): number | null {
    return this.request("cart:getCount", undefined); // ✅
  }

  callKO_requestUnknownNamespace(): void {
    // @ts-expect-error — "user:getProfile" n'est pas déclaré dans cart.requests.
    this.request("user:getProfile", undefined);
  }

  callKO_requestUnknownName(): void {
    // @ts-expect-error — "cart:nope" n'est pas dans cart.requests.
    this.request("cart:nope", undefined);
  }

  // ── handler channel — payload inféré depuis TCartChannelDef.events.itemAdded ─
  onCartItemAddedEvent(payload: { productId: string }): void {
    this.getUI("count").text(payload.productId);
  }
}

// ─── View qui ne déclare que listens — trigger et request vides ────────────

const listenOnlyFeatures = {
  cart: {
    feature:  CartFeature,
    listens:  ["itemAdded"] as const,
    triggers: []            as const,
    requests: []            as const
  }
} satisfies TFeatureContract;

const listenOnlyUiEvents = {} as const satisfies TUIContract;
const listenOnlyUiElements = {} as const satisfies TUIElements<typeof listenOnlyUiEvents>;

type TListenOnlyContract = TViewContract<
  typeof listenOnlyFeatures,
  typeof listenOnlyUiEvents
>;

class ListenOnlyView
  extends View<TListenOnlyContract>
  implements TViewCallbacks<TListenOnlyContract>
{
  get features()   { return listenOnlyFeatures; }
  get uiEvents()   { return listenOnlyUiEvents; }
  get uiElements() { return listenOnlyUiElements; }

  callKO_anyTrigger(): void {
    // @ts-expect-error — features.cart.triggers est vide, aucune clé valide.
    this.callTrigger("cart:addItem", { productId: "x", qty: 1 });
  }

  onCartItemAddedEvent(_payload: { productId: string }): void {}
}

// ─── Handler payload mismatch détecté par implements TViewCallbacks ───────

const handlerFeatures = {
  cart: {
    feature:  CartFeature,
    listens:  ["itemAdded"] as const,
    triggers: []            as const,
    requests: []            as const
  }
} satisfies TFeatureContract;

const handlerUiEvents = {} as const satisfies TUIContract;
const handlerUiElements = {} as const satisfies TUIElements<typeof handlerUiEvents>;

type THandlerContract = TViewContract<
  typeof handlerFeatures,
  typeof handlerUiEvents
>;

// DOIT compiler — payload typé par implements.
class CartHandlerOK
  extends View<THandlerContract>
  implements TViewCallbacks<THandlerContract>
{
  get features()   { return handlerFeatures; }
  get uiEvents()   { return handlerUiEvents; }
  get uiElements() { return handlerUiElements; }

  onCartItemAddedEvent(payload: { productId: string }): void {
    void payload.productId;
  }
}

// Régression : payload mal typé → l'implements rejette la signature.
class CartHandlerKO
  extends View<THandlerContract>
  implements TViewCallbacks<THandlerContract>
{
  get features()   { return handlerFeatures; }
  get uiEvents()   { return handlerUiEvents; }
  get uiElements() { return handlerUiElements; }

  // @ts-expect-error — { wrong: number } n'est pas { productId: string }.
  onCartItemAddedEvent(payload: { wrong: number }): void {
    void payload.wrong;
  }
}

// Régression : handler manquant pour clé déclarée → l'implements rejette la classe.
// @ts-expect-error — onCartItemAddedEvent absent alors qu'il est requis par TViewCallbacks.
class CartHandlerMissing
  extends View<THandlerContract>
  implements TViewCallbacks<THandlerContract>
{
  get features()   { return handlerFeatures; }
  get uiEvents()   { return handlerUiEvents; }
  get uiElements() { return handlerUiElements; }
  // onCartItemAddedEvent intentionnellement absent
}

// ─── I84 / I88 — DOM handlers requis si events: [...] non-vide ──────────────

const uiHandlerFeatures = {} as const satisfies TFeatureContract;
const uiHandlerUiEvents = {
  saveBtn: ui<HTMLButtonElement>()(["click"])
} satisfies TUIContract;
const uiHandlerUiElements = {
  saveBtn: "#save"
} satisfies TUIElements<typeof uiHandlerUiEvents>;

type TUIHandlerContract = TViewContract<
  typeof uiHandlerFeatures,
  typeof uiHandlerUiEvents
>;

// DOIT compiler — handler DOM présent.
class UIHandlerOK
  extends View<TUIHandlerContract>
  implements TViewCallbacks<TUIHandlerContract>
{
  get features()   { return uiHandlerFeatures; }
  get uiEvents()   { return uiHandlerUiEvents; }
  get uiElements() { return uiHandlerUiElements; }

  onSaveBtnClick(_e: MouseEvent): void {}
}

// Régression : handler DOM manquant alors que events: ["click"] déclaré → rejet compile (I84/I88).
// @ts-expect-error — onSaveBtnClick absent alors qu'il est requis par TUICallbacks (events: ["click"]).
class UIHandlerMissing
  extends View<TUIHandlerContract>
  implements TViewCallbacks<TUIHandlerContract>
{
  get features()   { return uiHandlerFeatures; }
  get uiEvents()   { return uiHandlerUiEvents; }
  get uiElements() { return uiHandlerUiElements; }
  // onSaveBtnClick intentionnellement absent
}

// ─── I87 — Validation stricte clé/namespace au site d'usage ─────────────────
//
// Note : `[NS in string]: TFeatureContractEntry<NS>` ne déclenche pas la
// validation per-key au `satisfies` (TypeScript ne distribue pas le mapped
// type sur les clés littérales pour les contraintes index-signature).
// L'enforcement de I87 se fait au site d'**usage** : si la clé d'objet ne
// correspond pas au namespace de la Feature référencée, les helpers
// `TCommandPayloadFor` / `TFlatTriggers` / `TEventPayloadFor` retournent
// `never` lors de l'extraction, ce qui rejette l'appel `this.trigger(...)`
// au compile-time.
//
// Le test `callKO_triggerListenAsTrigger` ci-dessus illustre ce mécanisme :
// "cart:itemAdded" est dans listens (pas triggers) → never → erreur compile.

const _key_ns_loose = {
  cart: {
    feature:  CartFeature,
    listens:  []   as const,
    triggers: []   as const,
    requests: []   as const
  }
} satisfies TFeatureContract;

// ─── ADR-0044 — HasNoDuplicates : doublons dans events[] → never ────────────

// ❌ Doublon → HasNoDuplicates<TEvts> extends false → paramètre de type never (I90).
// @ts-expect-error — "submit" apparaît deux fois → never.
const _duplicates_ko = ui<HTMLFormElement>()(["submit", "submit"]);

// ✅ Pas de doublon → compilation normale.
const _duplicates_ok = ui<HTMLFormElement>()(["submit", "reset"]);

// ─── ADR-0045 — TEventsFor<TEl> : restriction sémantique par sous-type ──────

// ✅ Cas positifs — events cohérents avec le sous-type déclaré.
// La vérification est que ces lignes compilent sans erreur.
const _semantic_btn_ok    = ui<HTMLButtonElement>()(["click", "mouseenter", "keydown"]);  // TUIBaseEvents ✅
const _semantic_input_ok  = ui<HTMLInputElement>()(["change", "input", "focus"]);         // TUIFormValueEvents ✅
const _semantic_video_ok  = ui<HTMLVideoElement>()(["play", "pause", "ended"]);           // TUIMediaEvents ✅
const _semantic_div_ok    = ui<HTMLDivElement>()(["scroll", "click"]);                    // TUIScrollEvents ✅
const _semantic_generic_ok = ui<HTMLElement>()(["scroll", "click", "keydown"]); // TUIBaseEvents | TUIScrollEvents ✅

// ❌ Cas négatifs — events sémantiquement incohérents avec le sous-type.
// @ts-expect-error — "change" n'est pas dans TUIBaseEvents (HTMLButtonElement ne porte pas de valeur — I89/I91).
const _semantic_ko_1 = ui<HTMLButtonElement>()(["change"]);

// @ts-expect-error — "scroll" n'est pas dans TUIBaseEvents | TUIFormValueEvents (HTMLInputElement — I91).
const _semantic_ko_2 = ui<HTMLInputElement>()(["scroll"]);

// @ts-expect-error — "play" n'est pas dans TUIBaseEvents (HTMLButtonElement — I91).
const _semantic_ko_3 = ui<HTMLButtonElement>()(["play"]);

// ─── Tests Jest factices — la vraie preuve est compile-time ─────────────────

describe("View contract — compile-time enforcement (ADR-0040 + ADR-0042)", () => {
  it("trigger/request/listen + DOM contracts hold at the type level", () => {
    // Si ce fichier compile, toutes les contraintes ci-dessus sont satisfaites.
    // Les @ts-expect-error attestent les rejets côté TypeScript.
    void CartOnlyView;
    void ListenOnlyView;
    void CartHandlerOK;
    void CartHandlerKO;
    void CartHandlerMissing;
    void UIHandlerOK;
    void UIHandlerMissing;
    void _key_ns_loose;
  });

  it("ADR-0044 : HasNoDuplicates — doublons dans events[] → erreur compile (I90)", () => {
    void _duplicates_ko;
    void _duplicates_ok;
  });

  it("ADR-0045 : TEventsFor<TEl> — restriction sémantique par sous-type (I89/I91)", () => {
    void _semantic_btn_ok;
    void _semantic_input_ok;
    void _semantic_video_ok;
    void _semantic_div_ok;
    void _semantic_generic_ok;
    void _semantic_ko_1;
    void _semantic_ko_2;
    void _semantic_ko_3;
  });
});

// Empêche TS d'enlever les déclarations inutilisées dans certains réglages stricts.
export type _Pin =
  | typeof CartOnlyView
  | typeof ListenOnlyView
  | typeof CartHandlerOK
  | typeof CartHandlerKO
  | typeof CartHandlerMissing
  | typeof UIHandlerOK
  | typeof UIHandlerMissing
  | typeof _duplicates_ko
  | typeof _duplicates_ok
  | typeof _semantic_btn_ok
  | typeof _semantic_input_ok
  | typeof _semantic_video_ok
  | typeof _semantic_div_ok
  | typeof _semantic_generic_ok
  | typeof _semantic_ko_1
  | typeof _semantic_ko_2
  | typeof _semantic_ko_3
  | TChannelDefinition
  | typeof UserFeature;
