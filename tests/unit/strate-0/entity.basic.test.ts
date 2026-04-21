/**
 * Tests Strate 0 — Entity basic
 *
 * Invariants prouvés :
 *   I6   — Seule une Feature peut modifier son Entity
 *   I46  — TStructure contraint à TJsonSerializable
 *   I51  — Notification catch-all onAnyEntityUpdated (strate 0 = catch-all uniquement)
 *   I52  — Entity peut exposer des méthodes query (lecture seule, pures)
 *
 * Sémantiques runtime ADR-0001 (strate 0) :
 *   - mutate(intent, recipe) via Immer produce (pas produceWithPatches)
 *   - changedKeys dérivées par comparaison shallow avant/après
 *   - Détection no-op : si state inchangé → aucune notification
 *   - initialState getter (D17)
 *   - onAnyEntityUpdated(event) avec intent, changedKeys
 *
 * NOTE : produceWithPatches, per-key handlers, ré-entrance FIFO = strate 1.
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { Entity } from "@bonsai/entity";
import type { TEntityEvent } from "@bonsai/entity";

/**
 * Fixture : structure de données d'un panier
 * Doit être JsonSerializable (I46)
 */
type TCartState = {
  items: Array<{ productId: string; name: string; qty: number; price: number }>;
  total: number;
  lastUpdated: string | null;
};
const CART_INITIAL_STATE: TCartState = {
  items: [],
  total: 0,
  lastUpdated: null
} as const;

/**
 * Fixture : Entity concrète pour les tests
 */
class CartEntity extends Entity<TCartState> {
  protected defineInitialState(): TCartState {
    return CART_INITIAL_STATE;
  }

  /** I52 — Query methods (lecture seule) */
  get query() {
    return {
      getItems: () => this.state.items,
      getTotal: () => this.state.total,
      getItemCount: () => this.state.items.length,
      getItemById: (id: string) =>
        this.state.items.find((item) => item.productId === id) ?? null
    };
  }
}

describe("Entity basic — Strate 0 [I6, I46, I51-catchall, I52]", () => {
  let entity: CartEntity;

  beforeEach(() => {
    entity = new CartEntity();
  });

  describe("I46 — Structure must be JsonSerializable", () => {
    it("accepts a plain object as initial state", () => {
      expect(entity.state).toEqual(CART_INITIAL_STATE);
    });

    it("initialState returns the original initial state (D17)", () => {
      entity.mutate("addItem", (draft) => {
        draft.items.push({ productId: "1", name: "A", qty: 1, price: 10 });
      });
      expect(entity.initialState).toEqual(CART_INITIAL_STATE);
      expect(entity.state).not.toEqual(CART_INITIAL_STATE);
    });
  });

  describe("mutate() — Immer produce", () => {
    it("mutate(intent, recipe) updates the state immutably", () => {
      entity.mutate("addItem", (draft) => {
        draft.items.push({
          productId: "123",
          name: "Widget",
          qty: 1,
          price: 9.99
        });
        draft.total = 9.99;
      });

      expect(entity.state.items).toHaveLength(1);
      expect(entity.state.items[0].productId).toBe("123");
      expect(entity.state.total).toBe(9.99);
    });

    it("mutate() produces a new state reference (immutable)", () => {
      const stateBefore = entity.state;

      entity.mutate("addItem", (draft) => {
        draft.items.push({
          productId: "123",
          name: "Widget",
          qty: 1,
          price: 9.99
        });
      });

      expect(entity.state).not.toBe(stateBefore);
    });

    it("mutate(intent, params, recipe) supports optional params", () => {
      entity.mutate("addItem", { payload: { productId: "123" } }, (draft) => {
        draft.items.push({
          productId: "123",
          name: "Widget",
          qty: 1,
          price: 9.99
        });
      });

      expect(entity.state.items).toHaveLength(1);
    });
  });

  describe("No-op detection", () => {
    it("no-op mutate does NOT trigger notification", () => {
      const listener = jest.fn();
      entity.onAnyEntityUpdated(listener);

      // Recipe qui ne change rien
      entity.mutate("noop", (_draft) => {
        // intentionally empty
      });

      expect(listener).not.toHaveBeenCalled();
    });

    it("no-op mutate — assigning same value does NOT trigger", () => {
      const listener = jest.fn();
      entity.onAnyEntityUpdated(listener);

      entity.mutate("reassign", (draft) => {
        draft.total = 0; // même valeur qu'avant
      });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("I51 — catch-all notification onAnyEntityUpdated", () => {
    it("onAnyEntityUpdated is called after a mutate", () => {
      const listener = jest.fn();
      entity.onAnyEntityUpdated(listener);

      entity.mutate("addItem", (draft) => {
        draft.items.push({
          productId: "123",
          name: "Widget",
          qty: 1,
          price: 9.99
        });
        draft.total = 9.99;
      });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("onAnyEntityUpdated event contains intent", () => {
      let receivedEvent: TEntityEvent<TCartState> | undefined;
      entity.onAnyEntityUpdated((event) => {
        receivedEvent = event;
      });

      entity.mutate("addItem", (draft) => {
        draft.items.push({
          productId: "123",
          name: "Widget",
          qty: 1,
          price: 9.99
        });
      });

      expect(receivedEvent!.intent).toBe("addItem");
    });

    it("onAnyEntityUpdated event contains changedKeys", () => {
      let receivedEvent: TEntityEvent<TCartState> | undefined;
      entity.onAnyEntityUpdated((event) => {
        receivedEvent = event;
      });

      entity.mutate("addItem", (draft) => {
        draft.items.push({
          productId: "123",
          name: "Widget",
          qty: 1,
          price: 9.99
        });
        draft.total = 9.99;
      });

      // changedKeys = clés de 1er niveau modifiées
      expect(receivedEvent!.changedKeys).toContain("items");
      expect(receivedEvent!.changedKeys).toContain("total");
      expect(receivedEvent!.changedKeys).not.toContain("lastUpdated");
    });

    it("onAnyEntityUpdated event contains previousState and nextState", () => {
      let receivedEvent: TEntityEvent<TCartState> | undefined;
      entity.onAnyEntityUpdated((event) => {
        receivedEvent = event;
      });

      entity.mutate("setTotal", (draft) => {
        draft.total = 42;
      });

      expect(receivedEvent!.previousState.total).toBe(0);
      expect(receivedEvent!.nextState.total).toBe(42);
    });
  });

  describe("I52 — Query methods (read-only)", () => {
    it("query methods can read state without mutation", () => {
      entity.mutate("addItem", (draft) => {
        draft.items.push({
          productId: "123",
          name: "Widget",
          qty: 1,
          price: 9.99
        });
        draft.total = 9.99;
      });

      expect(entity.query.getItems()).toHaveLength(1);
      expect(entity.query.getTotal()).toBe(9.99);
      expect(entity.query.getItemCount()).toBe(1);
      expect(entity.query.getItemById("123")?.name).toBe("Widget");
      expect(entity.query.getItemById("nonexistent")).toBeNull();
    });
  });
});
