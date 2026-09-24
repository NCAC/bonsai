/**
 * Tests Strate 1a — Feature entity handlers dispatch [I96]
 *
 * Prouve : auto-discovery des méthodes `on<Key>EntityUpdated`/
 * `onAnyEntityUpdated` sur Feature, dispatch ordonné (alphabétique puis
 * catch-all) via une souscription unique à `entity.onAnyEntityUpdated()`,
 * validation bootstrap de la clé, isolation d'erreur (BroadcastError).
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { Feature, type TFeatureCallbacks } from "@bonsai/feature";
import { Entity } from "@bonsai/entity";
import type { TEntityEvent } from "@bonsai/entity";
import { Radio, type TChannelToken } from "@bonsai/event";
import { entityOf } from "../../helpers/entity-of";

type TCartState = {
  items: Array<{ productId: string; qty: number }>;
  total: number;
};

class CartEntity extends Entity<TCartState> {
  protected defineInitialState(): TCartState {
    return { items: [], total: 0 };
  }
}

type TCartChannelDef = {
  commands: Record<never, never>;
  events: Record<never, never>;
  requests: Record<never, never>;
};

const cartListens = [] as const;

describe("Feature entity handlers dispatch — Strate 1a [I96]", () => {
  beforeEach(() => {
    Radio.reset();
  });

  it("dispatches per-key handlers in alphabetical order, then catch-all", () => {
    const callOrder: string[] = [];

    class CartFeature
      extends Feature<CartEntity, TCartChannelDef, "cart">
      implements TFeatureCallbacks<TCartChannelDef, typeof cartListens>
    {
      static readonly channel: TChannelToken<TCartChannelDef, "cart"> = {
        namespace: "cart"
      };
      get listens() {
        return cartListens;
      }
      get queries() {
        return [] as const;
      }
      protected get Entity() {
        return CartEntity;
      }

      onItemsEntityUpdated(
        prev: TCartState["items"],
        next: TCartState["items"]
      ) {
        callOrder.push("items");
        expect(prev).toEqual([]);
        expect(next).toHaveLength(1);
      }

      onTotalEntityUpdated(prev: number, next: number) {
        callOrder.push("total");
        expect(prev).toBe(0);
        expect(next).toBe(20);
      }

      onAnyEntityUpdated(event: TEntityEvent) {
        callOrder.push("any");
        expect(event.intent).toBe("addItem");
      }
    }

    const feature = new CartFeature("cart");
    feature.bootstrap();

    entityOf(feature).mutate("addItem", (draft) => {
      draft.items.push({ productId: "1", qty: 1 });
      draft.total = 20;
    });

    // "items" < "total" alphabétiquement, catch-all en dernier
    expect(callOrder).toEqual(["items", "total", "any"]);
  });

  it("filters patches passed to a per-key handler to that key's own patches", () => {
    let receivedPatches: readonly unknown[] | undefined;

    class CartFeature
      extends Feature<CartEntity, TCartChannelDef, "cart">
      implements TFeatureCallbacks<TCartChannelDef, typeof cartListens>
    {
      static readonly channel: TChannelToken<TCartChannelDef, "cart"> = {
        namespace: "cart"
      };
      get listens() {
        return cartListens;
      }
      get queries() {
        return [] as const;
      }
      protected get Entity() {
        return CartEntity;
      }

      onTotalEntityUpdated(
        _prev: number,
        _next: number,
        patches: readonly unknown[]
      ) {
        receivedPatches = patches;
      }
    }

    const feature = new CartFeature("cart");
    feature.bootstrap();

    entityOf(feature).mutate("addItem", (draft) => {
      draft.items.push({ productId: "1", qty: 1 });
      draft.total = 20;
    });

    expect(receivedPatches).toHaveLength(1);
    expect(
      (receivedPatches![0] as { path: unknown[] }).path[0]
    ).toBe("total");
  });

  it("bootstrap throws when a per-key handler references an unknown state key", () => {
    class BrokenFeature
      extends Feature<CartEntity, TCartChannelDef, "cart">
      implements TFeatureCallbacks<TCartChannelDef, typeof cartListens>
    {
      static readonly channel: TChannelToken<TCartChannelDef, "cart"> = {
        namespace: "cart"
      };
      get listens() {
        return cartListens;
      }
      get queries() {
        return [] as const;
      }
      protected get Entity() {
        return CartEntity;
      }

      // "foos" n'existe pas sur TCartState
      onFoosEntityUpdated() {
        /* noop */
      }
    }

    const feature = new BrokenFeature("cart");
    expect(() => feature.bootstrap()).toThrow(/unknown key "foos"/);
  });

  it("isolates a per-key handler that throws — logs BroadcastError, other handlers still run", () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    class FlakyFeature
      extends Feature<CartEntity, TCartChannelDef, "cart">
      implements TFeatureCallbacks<TCartChannelDef, typeof cartListens>
    {
      static readonly channel: TChannelToken<TCartChannelDef, "cart"> = {
        namespace: "cart"
      };
      get listens() {
        return cartListens;
      }
      get queries() {
        return [] as const;
      }
      protected get Entity() {
        return CartEntity;
      }

      onItemsEntityUpdated(): void {
        throw new Error("boom");
      }

      onAnyEntityUpdated(event: TEntityEvent): void {
        catchAllCalls.push(event.intent);
      }
    }

    const catchAllCalls: string[] = [];
    const feature = new FlakyFeature("cart");
    feature.bootstrap();

    expect(() =>
      entityOf(feature).mutate("addItem", (draft) => {
        draft.items.push({ productId: "1", qty: 1 });
      })
    ).not.toThrow();

    expect(catchAllCalls).toEqual(["addItem"]);
    expect(consoleErrorSpy).toHaveBeenCalled();

    // La notification suivante n'est pas affectée par l'erreur précédente
    entityOf(feature).mutate("addItem", (draft) => {
      draft.items.push({ productId: "2", qty: 1 });
    });
    expect(catchAllCalls).toEqual(["addItem", "addItem"]);

    consoleErrorSpy.mockRestore();
  });
});
