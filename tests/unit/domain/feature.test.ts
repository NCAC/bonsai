/**
 * Tests — Feature on the kernel (lot M6.1)
 *
 * Invariants proved:
 *   I1   — a Feature emits only on its own Channel (declared Events, D16)
 *   I2   — a Feature listens to the Events of declared external Channels
 *   I3   — a Feature replies only on its own Channel
 *   I6   — the Entity is reachable only from its owning Feature
 *   I17  — a Feature queries declared Channels, read-only
 *   I22  — namespace ↔ Feature ↔ Entity is a strict 1:1:1 relation
 *   I48  — handlers are auto-discovered by naming convention
 *   I68  — the namespace is carried by the manifest, not by a static
 *   I94  — the constructor is inert
 *   D17  — a Feature never addresses a Command
 *   C.1  — a Feature starts after the Features it queries
 */

import { describe, it, expect } from "@jest/globals";
import {
  Feature,
  BonsaiNamespaceError,
  isCamelCaseNamespace,
  isReservedNamespace,
  type TFeatureCallbacks,
  type TFeatureContext,
  type TFeatureQueryContext
} from "@bonsai/feature";
import { Entity } from "@bonsai/entity";
import type { TChannelDefinition, TChannelToken } from "@bonsai/event";
import { drive } from "../../helpers/drive";

// ─── Fixtures ──────────────────────────────────────────────────────────────

type TItem = { productId: string; qty: number; price: number };
type TCartState = { items: TItem[]; total: number };

class CartEntity extends Entity<TCartState> {
  protected defineInitialState(): TCartState {
    return { items: [], total: 0 };
  }
  get query() {
    return {
      getTotal: () => this.state.total,
      getItems: () => this.state.items
    };
  }
}

type TPricingState = { prices: Record<string, number> };

class PricingEntity extends Entity<TPricingState> {
  protected defineInitialState(): TPricingState {
    return { prices: { "prod-1": 9.99, "prod-2": 19.99 } };
  }
  get query() {
    return { getItemPrice: (id: string) => this.state.prices[id] ?? null };
  }
}

type TCartDef = {
  commands: {
    addItem: TItem;
    emitUndeclared: null;
    askPricingOnCommand: { productId: string };
  };
  events: { itemAdded: { item: TItem }; priced: { price: number | null } };
  queries: {
    getTotal: { params: null; result: number };
    getItems: { params: null; result: TItem[] };
  };
};

type TPricingDef = {
  commands: Record<never, never>;
  events: Record<never, never>;
  queries: { getItemPrice: { params: { productId: string }; result: number | null } };
};

const PRICING: TChannelToken<TPricingDef, "pricing"> = { namespace: "pricing" };
const noListens = [] as const;

class PricingFeature
  extends Feature<PricingEntity, TPricingDef, "pricing">
  implements TFeatureCallbacks<TPricingDef, typeof noListens, PricingEntity>
{
  static readonly channel: TChannelToken<TPricingDef, "pricing"> = { namespace: "pricing" };
  get listens() { return noListens; }
  get queries() { return [] as const; }
  protected get Entity() { return PricingEntity; }
  onInit(): void { PricingFeature.started.push("pricing"); }
  static started: string[] = [];

  onGetItemPriceQuery(params: { productId: string }, _ctx: TFeatureQueryContext): number | null {
    return this.entity.query.getItemPrice(params.productId);
  }
}

class CartFeature
  extends Feature<CartEntity, TCartDef, "cart">
  implements TFeatureCallbacks<TCartDef, typeof noListens, CartEntity>
{
  static readonly channel: TChannelToken<TCartDef, "cart"> = {
    namespace: "cart",
    events: ["itemAdded", "priced"]
  };
  get listens() { return noListens; }
  get queries() { return [PRICING] as const; }
  get dependsOn(): readonly TChannelToken<TPricingDef, "pricing">[] { return [PRICING]; }
  protected get Entity() { return CartEntity; }

  onInit(ctx: TFeatureContext<TCartDef, CartEntity>): void {
    // C.1 — the Feature queried at initialisation is already ready.
    PricingFeature.started.push(`cart saw ${String(ctx.query(PRICING, "getItemPrice", { productId: "prod-1" }))}`);
  }

  onAddItemCommand(payload: TItem, ctx: TFeatureContext<TCartDef, CartEntity>): void {
    ctx.mutate("addItem", (draft) => {
      draft.items.push(payload);
      draft.total += payload.price * payload.qty;
    });
    ctx.emit("itemAdded", { item: payload });
  }

  onEmitUndeclaredCommand(_payload: null, ctx: TFeatureContext<TCartDef, CartEntity>): void {
    // "priced" is declared by the token; this one is not.
    (ctx as unknown as { emit(e: string, p: unknown): void }).emit("secret", {});
  }

  onAskPricingOnCommandCommand(payload: { productId: string }, ctx: TFeatureContext<TCartDef, CartEntity>): void {
    ctx.emit("priced", { price: ctx.query(PRICING, "getItemPrice", payload) });
  }

  onGetTotalQuery(_p: null, _ctx: TFeatureQueryContext): number { return this.entity.query.getTotal(); }
  onGetItemsQuery(_p: null, _ctx: TFeatureQueryContext): TItem[] { return this.entity.query.getItems(); }
}

type TListenerDef = { commands: Record<never, never>; events: Record<never, never>; queries: { lastEvent: { params: null; result: string | null } } };
type TListenerState = { lastEvent: string | null };

class ListenerEntity extends Entity<TListenerState> {
  protected defineInitialState(): TListenerState { return { lastEvent: null }; }
}

const listenerListens = [CartFeature.channel] as const;

class ListenerFeature extends Feature<ListenerEntity, TListenerDef, "listener"> {
  static readonly channel: TChannelToken<TListenerDef, "listener"> = { namespace: "listener" };
  get listens() { return listenerListens; }
  get queries() { return [] as const; }
  protected get Entity() { return ListenerEntity; }

  // I48 — on{Channel}{EventName}Event
  onCartItemAddedEvent(_payload: { item: unknown }, ctx: TFeatureContext<TListenerDef, ListenerEntity>): void {
    ctx.mutate("recordEvent", (draft) => { draft.lastEvent = "itemAdded"; });
  }
  onLastEventQuery(): string | null { return this.entity.state.lastEvent; }
}

const features = { pricing: PricingFeature, cart: CartFeature, listener: ListenerFeature };
const item = (n: number): TItem => ({ productId: `p${n}`, qty: 1, price: 10 * n });

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("Feature on the kernel — lot M6.1", () => {
  describe("I21 / I68 / I94 — namespace and inert constructor", () => {
    it("exposes the namespace passed to the constructor", () => {
      expect(new CartFeature("cart").namespace).toBe("cart");
    });

    it("has no static namespace (I68)", () => {
      expect((CartFeature as unknown as { namespace?: unknown }).namespace).toBeUndefined();
    });

    it("the constructor creates no Entity: it exists only once the Feature is started (I94)", () => {
      const feature = new CartFeature("cart");
      expect(() => (feature as unknown as { entity: unknown }).entity).toThrow(/only once the Feature is started/);
    });

    it("an invalid or reserved namespace is refused at construction", () => {
      expect(() => new CartFeature("Cart" as "cart")).toThrow(BonsaiNamespaceError);
      expect(() => new CartFeature("router" as "cart")).toThrow(BonsaiNamespaceError);
    });
  });

  describe("I6 / I22 — the Entity", () => {
    it("holds its state in the kernel: the Entity is readable only inside a handler (I6)", () => {
      const d = drive(features);
      d.send("cart", "addItem", item(2));
      expect(d.ask<number>("cart", "getTotal", null)).toBe(20);
    });

    it("the Entity's state outside a handler is refused", () => {
      const feature = new CartFeature("cart");
      // Created by the Application when started; here we only check the guard on the Entity itself.
      const entity = new CartEntity();
      expect(() => entity.state).toThrow(/readable only inside a handler/);
      expect(entity.initialState).toEqual({ items: [], total: 0 });
      expect(feature.namespace).toBe("cart");
    });
  });

  describe("I48 / C2 — Command handlers", () => {
    it("on{Name}Command receives the payload and a context, and mutates the Entity", () => {
      const d = drive(features);
      d.send("cart", "addItem", { productId: "abc", qty: 2, price: 5 });
      expect(d.ask<TItem[]>("cart", "getItems", null)).toEqual([{ productId: "abc", qty: 2, price: 5 }]);
      expect(d.ask<number>("cart", "getTotal", null)).toBe(10);
    });
  });

  describe("I1 / C1 — emit on the Feature's own Channel", () => {
    it("an Event is delivered after the unit that emitted it", () => {
      const d = drive(features, { listen: [{ namespace: "cart", event: "itemAdded" }] });
      d.send("cart", "addItem", item(1));
      expect(d.received).toEqual([{ namespace: "cart", event: "itemAdded", payload: { item: item(1) } }]);
    });

    it("an Event the token does not declare is refused and the unit rolled back (D16, G7)", () => {
      const d = drive(features);
      d.send("cart", "emitUndeclared", null);
      expect(d.failures()).toHaveLength(1);
      expect(String(d.failures()[0]!.error)).toMatch(/UNDECLARED_MESSAGE/);
    });
  });

  describe("I2 / C3 — listen on declared external Channels", () => {
    it("on{Channel}{EventName}Event is discovered and called", () => {
      const d = drive(features);
      d.send("cart", "addItem", item(1));
      expect(d.ask<string | null>("listener", "lastEvent", null)).toBe("itemAdded");
    });

    it("a method named exactly on{Channel}Event (empty event name) is ignored", () => {
      class Observer extends Feature<ListenerEntity, TChannelDefinition, "observer"> {
        static readonly channel: TChannelToken<TChannelDefinition, "observer"> = { namespace: "observer" };
        get listens() { return [CartFeature.channel] as const; }
        get queries() { return [] as const; }
        protected get Entity() { return ListenerEntity; }
        onCartEvent(): void { throw new Error("must be ignored"); }
      }
      const d = drive({ pricing: PricingFeature, cart: CartFeature, observer: Observer });
      d.send("cart", "addItem", item(1));
      expect(d.failures()).toEqual([]);
    });
  });

  describe("I48 — handlers inherited from an ancestor class", () => {
    it("a subclass overriding one handler keeps the handlers it inherits", () => {
      class Derived extends CartFeature {
        override onGetTotalQuery(): number { return -1; }   // most derived wins
      }
      const d = drive({ pricing: PricingFeature, cart: Derived });
      d.send("cart", "addItem", item(2));                     // inherited Command
      expect(d.ask<TItem[]>("cart", "getItems", null)).toHaveLength(1);  // inherited Query
      expect(d.ask<number>("cart", "getTotal", null)).toBe(-1);          // overridden Query
    });
  });

  describe("I3 / C4 — reply to a Query on the Feature's own Channel", () => {
    it("on{Name}Request answers a Query", () => {
      const d = drive(features);
      d.send("cart", "addItem", item(3));
      expect(d.ask<number>("cart", "getTotal", null)).toBe(30);
    });

    it("an undeclared Query is refused", () => {
      const d = drive(features);
      expect(() => d.ask("cart", "nothing", null)).toThrow(/UNDECLARED_MESSAGE/);
    });
  });

  describe("I17 / C5 — ctx.query to a declared Channel (read-only)", () => {
    it("a handler obtains the typed answer of another Feature", () => {
      const d = drive(features, { listen: [{ namespace: "cart", event: "priced" }] });
      d.send("cart", "askPricingOnCommand", { productId: "prod-2" });
      expect(d.received.map((r) => r.payload)).toEqual([{ price: 19.99 }]);
    });

    it("a Query to an unknown product answers null (the domain's answer)", () => {
      const d = drive(features, { listen: [{ namespace: "cart", event: "priced" }] });
      d.send("cart", "askPricingOnCommand", { productId: "nope" });
      expect(d.received.map((r) => r.payload)).toEqual([{ price: null }]);
    });
  });

  describe("D17 — a Feature never addresses a Command", () => {
    it("its context offers no trigger at runtime", () => {
      let seen: Record<string, unknown> | null = null;
      class Spy extends CartFeature {
        override onAddItemCommand(_p: TItem, ctx: TFeatureContext<TCartDef, CartEntity>): void {
          seen = ctx as unknown as Record<string, unknown>;
        }
      }
      // Registered under the same namespace: Spy overrides the handler of CartFeature.
      const d = drive({ pricing: PricingFeature, cart: Spy });
      d.send("cart", "addItem", item(1));
      expect(seen).not.toBeNull();
      expect("trigger" in seen!).toBe(false);
    });
  });

  describe("onInit() and C.1 — start order by initial dependencies (`dependsOn`)", () => {
    it("a Feature that queries during onInit without declaring the dependency fails at startup", () => {
      class CartWithoutDependency extends CartFeature {
        get dependsOn(): readonly TChannelToken<TPricingDef, "pricing">[] { return []; }
      }
      PricingFeature.started = [];
      // `queries` alone is a permission: cart starts first, and pricing is not ready (C.1).
      expect(() => drive({ cart: CartWithoutDependency, pricing: PricingFeature })).toThrow();
    });

    it("a Feature runs onInit after the Features it queries, even when declared first", () => {
      PricingFeature.started = [];
      // cart is declared before pricing, yet queries it in onInit.
      drive({ cart: CartFeature, pricing: PricingFeature });
      expect(PricingFeature.started).toEqual(["pricing", "cart saw 9.99"]);
    });
  });

  describe("runtime helpers (ADR-08)", () => {
    it("isCamelCaseNamespace", () => {
      expect(isCamelCaseNamespace("userProfile")).toBe(true);
      expect(isCamelCaseNamespace("my-cart")).toBe(false);
    });
    it("isReservedNamespace", () => {
      expect(isReservedNamespace("local")).toBe(true);
      expect(isReservedNamespace("cart")).toBe(false);
    });
  });
});
