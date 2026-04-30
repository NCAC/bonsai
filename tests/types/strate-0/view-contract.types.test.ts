/**
 * Tests de type — Verrou compile-time du contrat View (ADR-0040 + ADR-0041)
 *
 * Ces tests ne s'exécutent **pas** au runtime — ils vérifient que TypeScript
 * rejette correctement tout usage de View qui sort du contrat déclaré dans
 * les deux étapes du pattern consommateur. Si un `@ts-expect-error` ne déclenche
 * plus d'erreur (parce que le typage a été relâché), le compilateur lève
 * « Unused '@ts-expect-error' directive » → la régression est détectée immédiatement.
 *
 * Couvre :
 *   - trigger("ns:cmd", payload) : clé namespacée doit être dans contract.triggers ;
 *     payload typé depuis TDeps.triggers[i].channel.events.
 *   - request("ns:req", params) : clé namespacée doit être dans contract.requests ;
 *     params + result typés depuis TDeps.
 *   - implements TListenCallbacks<TDeps, TContract> : handler manquant ou
 *     payload mal typé → erreur compile.
 *   - I80 : Channel privé — aucun TChannelToken dans la surface consommateur.
 *
 * @jest-environment node
 */

import { describe, it } from "@jest/globals";
import { type TChannelToken, type TChannelDefinition } from "@bonsai/event";
import { type TListenCallbacks } from "@bonsai/feature";
import { View, type TViewContract } from "@bonsai/view";

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

type TCartOnlyDeps = {
  readonly listens:  [typeof CartFeature];
  readonly triggers: [typeof CartFeature];
  readonly requests: [typeof CartFeature];
};

const cartOnlyContract = {
  uiElements: { count: "[data-ui='count']" },
  listens:  ["cart:itemAdded"] as const,
  triggers: ["cart:addItem"]   as const,
  requests: ["cart:getCount"]  as const
} satisfies TViewContract<TCartOnlyDeps>;

type TCartOnlyContract = typeof cartOnlyContract;

class CartOnlyView
  extends View<TCartOnlyDeps, TCartOnlyContract>
  implements TListenCallbacks<TCartOnlyDeps, TCartOnlyContract>
{
  get contract() {
    return cartOnlyContract;
  }

  // ── trigger() — clé namespacée déclarée, payload bien typé ─────────────
  callOK_trigger(): void {
    this.callTrigger("cart:addItem", { productId: "abc", qty: 1 }); // ✅
  }

  callKO_triggerUnknownNamespace(): void {
    // @ts-expect-error — "user:signIn" n'est pas dans contract.triggers.
    this.callTrigger("user:signIn", { email: "x@y" });
  }

  callKO_triggerUnknownCommand(): void {
    // @ts-expect-error — "cart:noSuchCommand" n'existe pas dans contract.triggers.
    this.callTrigger("cart:noSuchCommand", { productId: "x", qty: 1 });
  }

  callKO_triggerWrongPayload(): void {
    // @ts-expect-error — qty doit être un number.
    this.callTrigger("cart:addItem", { productId: "x", qty: "1" });
  }

  // ── request() — clé namespacée déclarée, params + result typés ─────────
  callOK_request(): number | null {
    return this.request("cart:getCount", undefined); // ✅
  }

  callKO_requestUnknownNamespace(): void {
    // @ts-expect-error — "user:getProfile" n'est pas dans contract.requests.
    this.request("user:getProfile", undefined);
  }

  callKO_requestUnknownName(): void {
    // @ts-expect-error — "cart:nope" n'est pas dans contract.requests.
    this.request("cart:nope", undefined);
  }

  // ── handler listen — payload inféré depuis TCartChannelDef.events.itemAdded ─
  onCartItemAddedEvent(payload: { productId: string }): void {
    this.getUI("count").text(payload.productId);
  }
}

// ─── View qui ne déclare que listens — trigger et request vides ────────────

type TListenOnlyDeps = {
  readonly listens:  [typeof CartFeature];
  readonly triggers: readonly [];
  readonly requests: readonly [];
};

const listenOnlyContract = {
  uiElements: {},
  listens:  ["cart:itemAdded"] as const,
  triggers: [] as const,
  requests: [] as const
} satisfies TViewContract<TListenOnlyDeps>;

type TListenOnlyContract = typeof listenOnlyContract;

class ListenOnlyView
  extends View<TListenOnlyDeps, TListenOnlyContract>
  implements TListenCallbacks<TListenOnlyDeps, TListenOnlyContract>
{
  get contract() {
    return listenOnlyContract;
  }

  callKO_anyTrigger(): void {
    // @ts-expect-error — contract.triggers est vide, aucune clé n'est valide.
    this.callTrigger("cart:addItem", { productId: "x", qty: 1 });
  }

  onCartItemAddedEvent(_payload: { productId: string }): void {}
}

// ─── Handler payload mismatch détecté par implements TListenCallbacks ─────

type THandlerDeps = {
  readonly listens:  [typeof CartFeature];
  readonly triggers: readonly [];
  readonly requests: readonly [];
};

const handlerContract = {
  uiElements: {},
  listens:  ["cart:itemAdded"] as const,
  triggers: [] as const,
  requests: [] as const
} satisfies TViewContract<THandlerDeps>;

type THandlerContract = typeof handlerContract;

// DOIT compiler — payload typé par implements.
class CartHandlerOK
  extends View<THandlerDeps, THandlerContract>
  implements TListenCallbacks<THandlerDeps, THandlerContract>
{
  get contract() {
    return handlerContract;
  }

  onCartItemAddedEvent(payload: { productId: string }): void {
    void payload.productId;
  }
}

// Régression : payload mal typé → l'implements rejette la signature.
class CartHandlerKO
  extends View<THandlerDeps, THandlerContract>
  implements TListenCallbacks<THandlerDeps, THandlerContract>
{
  get contract() {
    return handlerContract;
  }

  // @ts-expect-error — { wrong: number } n'est pas { productId: string }.
  onCartItemAddedEvent(payload: { wrong: number }): void {
    void payload.wrong;
  }
}

// Régression : handler manquant pour clé déclarée → l'implements rejette la classe.
// @ts-expect-error — onCartItemAddedEvent absent alors qu'il est requis par TListenCallbacks.
class CartHandlerMissing
  extends View<THandlerDeps, THandlerContract>
  implements TListenCallbacks<THandlerDeps, THandlerContract>
{
  get contract() {
    return handlerContract;
  }
  // onCartItemAddedEvent intentionnellement absent
}

// ─── Tests Jest factices — la vraie preuve est compile-time ─────────────────

describe("View contract — compile-time enforcement (ADR-0040 + ADR-0041)", () => {
  it("trigger/request/listen contracts hold at the type level", () => {
    // Si ce fichier compile, toutes les contraintes ci-dessus sont satisfaites.
    // Les @ts-expect-error attestent les rejets côté TypeScript.
    void CartOnlyView;
    void ListenOnlyView;
    void CartHandlerOK;
    void CartHandlerKO;
    void CartHandlerMissing;
  });
});

// Empêche TS d'enlever les déclarations inutilisées dans certains réglages stricts.
export type _Pin =
  | typeof CartOnlyView
  | typeof ListenOnlyView
  | typeof CartHandlerOK
  | typeof CartHandlerKO
  | typeof CartHandlerMissing
  | TChannelDefinition
  | typeof UserFeature;
