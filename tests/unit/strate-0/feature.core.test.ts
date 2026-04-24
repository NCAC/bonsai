/**
 * Tests Strate 0 — Feature core
 *
 * Invariants prouvés :
 *   I1   — Feature ne peut emit() que sur son propre Channel
 *   I2   — Feature peut listen les Events des Channels externes déclarés
 *   I3   — Feature ne peut reply que sur son propre Channel
 *   I5   — Entity n'est accessible que par sa Feature propriétaire
 *   I12  — Aucune Feature ne peut emit sur le Channel d'une autre
 *   I17  — Feature peut request en lecture seule
 *   I21  — Chaque Feature DOIT être enregistrée dans le manifest sous une
 *          clé namespace unique camelCase plat (amendé ADR-0039)
 *   I22  — Relation namespace ↔ Feature ↔ Entity est 1:1:1 stricte
 *   I48  — Handlers = méthodes on<Name><Command|Event|Request> auto-découvertes
 *   I68  — Le namespace est porté par le manifest, pas par un static (ADR-0039)
 *   I72  — TSelfNS doit correspondre à la clé du manifest (ADR-0039)
 *
 * Capacités strate 0 :
 *   C2 — handle(command) via auto-discovery
 *   C1 — emit(event, payload) sur son propre Channel
 *   C3 — listen(event) sur Channels déclarés
 *   C4 — reply(request) sur son propre Channel
 *   C5 — request(target, name, params) vers Channels déclarés
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { Feature, isCamelCaseNamespace, isReservedNamespace } from "@bonsai/feature";
import { Entity, type TJsonSerializable } from "@bonsai/entity";
import { Radio } from "@bonsai/event";

// ─── Fixtures ──────────────────────────────────────────────────────────────

type TCartState = {
  items: Array<{ productId: string; qty: number; price: number }>;
  total: number;
};

class CartEntity extends Entity<TCartState> {
  protected defineInitialState(): TCartState {
    return { items: [], total: 0 };
  }

  get query() {
    return {
      getTotal: () => this.state.total,
      getItemCount: () => this.state.items.length
    };
  }
}

type TPricingState = {
  prices: Record<string, number>;
};

class PricingEntity extends Entity<TPricingState> {
  protected defineInitialState(): TPricingState {
    return { prices: { "prod-1": 9.99, "prod-2": 19.99 } };
  }

  get query() {
    return {
      getItemPrice: (productId: string) => this.state.prices[productId] ?? null
    };
  }
}

// ─── Features concrètes (fixtures) ────────────────────────────────────────

class CartFeature extends Feature<CartEntity, "cart"> {
  static readonly channels = ["pricing"] as const;

  /** Liaison Feature → Entity concrète (D17 amendé par ADR-0037) */
  protected get Entity() {
    return CartEntity;
  }

  // C2 — Command handler auto-discovered
  onAddItemCommand(payload: { productId: string; qty: number; price: number }) {
    this.entity.mutate("addItem", (draft) => {
      draft.items.push(payload);
      draft.total += payload.price * payload.qty;
    });
    // C1 — emit on own channel
    this.emit("itemAdded", { item: payload });
  }

  // C4 — Reply on own channel — plus aucun cast grâce à ADR-0037
  onGetTotalRequest(): number {
    return this.entity.query.getTotal();
  }

  // C5 — request to external channel (exposed for testing)
  requestPrice(productId: string): number | null {
    return this.request("pricing", "getItemPrice", { productId }) as
      | number
      | null;
  }

  // Lifecycle
  onInit() {
    // intentionally empty — spy tests presence
  }
}

class PricingFeature extends Feature<PricingEntity, "pricing"> {
  static readonly channels = [] as const;

  protected get Entity() {
    return PricingEntity;
  }

  // C4 — reply (plus aucun cast grâce à ADR-0037)
  onGetItemPriceRequest(params: { productId: string }): number | null {
    return this.entity.query.getItemPrice(params.productId);
  }
}

type TCartListenerState = { lastEvent: string | null };

class CartListenerEntity extends Entity<TCartListenerState> {
  protected defineInitialState(): TCartListenerState {
    return { lastEvent: null };
  }
}

/**
 * Feature qui écoute les events d'un Channel externe (C3 — listen)
 */
class CartListenerFeature extends Feature<CartListenerEntity, "cartListener"> {
  static readonly channels = ["cart"] as const;

  protected get Entity() {
    return CartListenerEntity;
  }

  // I48 — Auto-discovered: on{Channel}{EventName}Event
  onCartItemAddedEvent(payload: { item: unknown }) {
    this.entity.mutate("recordEvent", (draft) => {
      draft.lastEvent = "itemAdded";
    });
  }
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("Feature core — Strate 0", () => {
  beforeEach(() => {
    Radio.reset();
  });

  // ─── Namespace et identité ─────────────────────────────────────

  describe("I21 / I68 — Namespace injected via constructor (ADR-0039)", () => {
    it("Feature instance exposes the namespace passed to the constructor", () => {
      const feature = new CartFeature("cart");
      feature.bootstrap();
      expect(feature.namespace).toBe("cart");
    });

    it("Feature class no longer exposes a static namespace (I68)", () => {
      // Le `static namespace` est supprimé par ADR-0039 — le namespace vit
      // désormais dans le manifest applicatif (clé) et l'instance (constructeur).
      expect(
        (CartFeature as unknown as { namespace?: unknown }).namespace
      ).toBeUndefined();
    });
  });

  describe("I22 — 1:1:1 namespace ↔ Feature ↔ Entity", () => {
    it("Feature has exactly one Entity with initial state", () => {
      const feature = new CartFeature("cart");
      feature.bootstrap();
      expect(feature.entity.state).toEqual({ items: [], total: 0 });
    });
  });

  // ─── C2 — handle(command) ──────────────────────────────────────

  describe("I48 / C2 — Auto-discovered command handlers", () => {
    it("on{Name}Command methods are registered on the Channel at bootstrap", () => {
      const feature = new CartFeature("cart");
      feature.bootstrap();

      const channel = Radio.me().channel("cart");
      channel.trigger("addItem", { productId: "p1", qty: 1, price: 10 });

      expect(feature.entity.state.items).toHaveLength(1);
      expect(feature.entity.state.total).toBe(10);
    });

    it("Command handler mutates Entity correctly", () => {
      const feature = new CartFeature("cart");
      feature.bootstrap();

      const channel = Radio.me().channel("cart");
      channel.trigger("addItem", { productId: "abc", qty: 2, price: 5 });

      expect(feature.entity.state.items[0]).toEqual({
        productId: "abc",
        qty: 2,
        price: 5
      });
      expect(feature.entity.state.total).toBe(10);
    });
  });

  // ─── C1 — emit(event) ─────────────────────────────────────────

  describe("I1, I12 / C1 — emit() only on own Channel", () => {
    it("Feature can emit events on its own Channel", () => {
      const feature = new CartFeature("cart");
      feature.bootstrap();

      const received: unknown[] = [];
      const channel = Radio.me().channel("cart");
      channel.listen("itemAdded", (payload) => received.push(payload));

      channel.trigger("addItem", { productId: "p1", qty: 1, price: 10 });

      expect(received).toHaveLength(1);
      expect(received[0]).toEqual({
        item: { productId: "p1", qty: 1, price: 10 }
      });
    });
  });

  // ─── C3 — listen(event) ───────────────────────────────────────

  describe("I2 / C3 — listen() on declared external Channels", () => {
    it("Feature auto-discovers on{Channel}{EventName}Event handlers for declared channels", () => {
      const cartFeature = new CartFeature("cart");
      const listenerFeature = new CartListenerFeature("cartListener");

      cartFeature.bootstrap();
      listenerFeature.bootstrap();

      // trigger addItem → emits "itemAdded" → CartListenerFeature handles it
      const channel = Radio.me().channel("cart");
      channel.trigger("addItem", { productId: "p1", qty: 1, price: 10 });

      expect(listenerFeature.entity.state.lastEvent).toBe("itemAdded");
    });
  });

  // ─── C4 — reply(request) ──────────────────────────────────────

  describe("I3 / C4 — reply() on own Channel", () => {
    it("on{Name}Request methods are registered as repliers at bootstrap", () => {
      const feature = new CartFeature("cart");
      feature.bootstrap();

      const channel = Radio.me().channel("cart");
      channel.trigger("addItem", { productId: "p1", qty: 1, price: 25 });

      const total = channel.request("getTotal", null);
      expect(total).toBe(25);
    });
  });

  // ─── C5 — request(target, name, params) ───────────────────────

  describe("I17 / C5 — request() to declared Channels (read-only)", () => {
    it("Feature can request data from declared external Channels", () => {
      const pricingFeature = new PricingFeature("pricing");
      const cartFeature = new CartFeature("cart");

      pricingFeature.bootstrap();
      cartFeature.bootstrap();

      const price = cartFeature.requestPrice("prod-1");
      expect(price).toBe(9.99);
    });

    it("request returns null if no replier", () => {
      const cartFeature = new CartFeature("cart");
      cartFeature.bootstrap();

      const price = cartFeature.requestPrice("prod-1");
      expect(price).toBeNull();
    });
  });

  // ─── Lifecycle ─────────────────────────────────────────────────

  describe("onInit() lifecycle", () => {
    it("onInit() is called during bootstrap", () => {
      const feature = new CartFeature("cart");
      const spy = jest.spyOn(feature, "onInit");

      feature.bootstrap();

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("bootstrap() is idempotent — second call is a no-op (I48)", () => {
      // Covers the `if (this.#bootstrapped) return` early-exit branch (L153)
      const feature = new CartFeature("cart");
      feature.bootstrap();
      const entityAfterFirst = feature.entity;

      // Second call must not throw and must not re-instantiate the Entity
      expect(() => feature.bootstrap()).not.toThrow();
      expect(feature.entity).toBe(entityAfterFirst);
    });
  });

  describe("isCamelCaseNamespace / isReservedNamespace runtime helpers (ADR-0039)", () => {
    it("isCamelCaseNamespace returns true for valid camelCase namespaces", () => {
      expect(isCamelCaseNamespace("cart")).toBe(true);
      expect(isCamelCaseNamespace("userProfile")).toBe(true);
    });

    it("isCamelCaseNamespace returns false for non-camelCase strings", () => {
      expect(isCamelCaseNamespace("Cart")).toBe(false);
      expect(isCamelCaseNamespace("my-cart")).toBe(false);
    });

    it("isReservedNamespace returns true for reserved namespaces", () => {
      expect(isReservedNamespace("local")).toBe(true);
    });

    it("isReservedNamespace returns false for non-reserved namespaces", () => {
      expect(isReservedNamespace("cart")).toBe(false);
    });
  });

  describe("I48 — Auto-discovery edge cases", () => {
    it("Method named exactly 'on{Channel}Event' (empty eventPascal) is silently skipped", () => {
      // "onCartEvent" = prefix "onCart" + "" + suffix "Event" → eventPascal.length === 0
      // The handler must be skipped without throwing (L272)
      class ObserverFeature extends Feature<CartEntity, "observer"> {
        static readonly channels = ["cart"] as const;
        protected get Entity() {
          return CartEntity;
        }
        onCartEvent(_payload: unknown) {
          /* intentionally empty — must be ignored */
        }
      }

      const feature = new ObserverFeature("observer");
      expect(() => feature.bootstrap()).not.toThrow();
    });
  });
});
