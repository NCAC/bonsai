/**
 * Test — cart journey, domain side (lot M6.1)
 *
 * The journey the View will complete in lot M6.2, here driven by a probe that
 * admits independent facts: add items, the Entity changes, the Event goes out,
 * a Query reads the result, a violated invariant cancels the whole unit.
 */

import { describe, it, expect } from "@jest/globals";
import { drive } from "../../helpers/drive";
import { CartFeature, type TCartItem } from "../../fixtures/cart-feature.fixture";

const item = (productId: string, qty: number, price: number): TCartItem => ({ productId, qty, price });

describe("Cart journey — domain on the kernel", () => {
  it("adds items: state updated, Events delivered in order, Query reads the result", () => {
    const d = drive({ cart: CartFeature }, { listen: [{ namespace: "cart", event: "itemAdded" }] });

    d.send("cart", "addItem", item("abc", 2, 5));
    d.send("cart", "addItem", item("def", 1, 7.5));

    expect(d.received.map((r) => r.payload)).toEqual([
      { item: item("abc", 2, 5) },
      { item: item("def", 1, 7.5) }
    ]);
    expect(d.ask<number>("cart", "getItemCount", null)).toBe(2);
    expect(d.failures()).toEqual([]);
  });

  it("the Command is delivered after the fact that provoked it is fully admitted, and the Event after the Command's unit (G5)", () => {
    const d = drive({ cart: CartFeature }, { listen: [{ namespace: "cart", event: "itemAdded" }] });
    d.send("cart", "addItem", item("abc", 1, 1));
    const delivered = d.root.trace
      .filter((e) => e.type === "delivered")
      .map((e) => (e.type === "delivered" ? `${e.kind}:${e.to}:${e.name}` : ""));
    // D8: deferred messages leave in the order they were produced — the Entity
    // notification (from mutate) before the Event (from emit).
    expect(delivered).toEqual(["local:probe:send", "command:cart:addItem", "local:cart:entityUpdated", "event:probe:itemAdded"]);
  });

  it("an unknown Command is refused without touching the state", () => {
    const d = drive({ cart: CartFeature });
    d.send("cart", "removeItem", {});
    expect(d.failures()).toHaveLength(1);
    expect(d.ask<number>("cart", "getItemCount", null)).toBe(0);
  });

  it("the state is a coherent whole: either the unit applied entirely or not at all", () => {
    class Strict extends CartFeature {
      override onAddItemCommand(payload: TCartItem, ctx: Parameters<CartFeature["onAddItemCommand"]>[1]): void {
        super.onAddItemCommand(payload, ctx);
        if (payload.qty < 0) throw new Error("negative quantity");
      }
    }
    const d = drive({ cart: Strict }, { listen: [{ namespace: "cart", event: "itemAdded" }] });
    d.send("cart", "addItem", item("abc", -1, 5));
    expect(d.failures()).toHaveLength(1);
    expect(d.received).toEqual([]);                       // no Event from a failed unit
    expect(d.ask<number>("cart", "getItemCount", null)).toBe(0);   // no trace of the mutation
    d.send("cart", "addItem", item("abc", 1, 5));
    expect(d.ask<number>("cart", "getItemCount", null)).toBe(1);   // the model keeps working
  });
});
