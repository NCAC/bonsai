/**
 * Tests Strate 1a — Entity patches [I97]
 *
 * Prouve : `mutate()` via `Immer.produceWithPatches` — `TEntityEvent` porte
 * `patches`/`inversePatches`, `changedKeys` dérivées des patches, no-op
 * détecté par patches vides, `MutationError` sur recipe qui throw (state
 * conservé, rollback Immer automatique).
 */

import { describe, it, expect } from "@jest/globals";
import { Entity } from "@bonsai/entity";
import type { TEntityEvent } from "@bonsai/entity";
import { MutationError } from "@bonsai/error";

type TCartState = {
  items: Array<{ productId: string; qty: number }>;
  total: number;
  label: string;
};

class CartEntity extends Entity<TCartState> {
  protected defineInitialState(): TCartState {
    return { items: [], total: 0, label: "" };
  }
}

describe("Entity patches — Strate 1a [I97]", () => {
  it("mutate() returns a TEntityEvent with patches and inversePatches", () => {
    const entity = new CartEntity();

    const event = entity.mutate("addItem", (draft) => {
      draft.items.push({ productId: "1", qty: 2 });
      draft.total = 20;
    });

    expect(event).not.toBeNull();
    expect(event!.patches.length).toBeGreaterThan(0);
    expect(event!.inversePatches.length).toBe(event!.patches.length);
  });

  it("changedKeys are derived from the first path segment of the patches", () => {
    const entity = new CartEntity();

    const event = entity.mutate("addItem", (draft) => {
      draft.items.push({ productId: "1", qty: 2 });
      draft.total = 20;
    });

    expect(event!.changedKeys).toContain("items");
    expect(event!.changedKeys).toContain("total");
    expect(event!.changedKeys).not.toContain("label");
  });

  it("no-op recipe (no patches produced) returns null and does not notify", () => {
    const entity = new CartEntity();
    let called = false;
    entity.onAnyEntityUpdated(() => {
      called = true;
    });

    const event = entity.mutate("noop", () => {
      // intentionally empty
    });

    expect(event).toBeNull();
    expect(called).toBe(false);
  });

  it("mutate() flattens payload/metas onto the event (no nested params)", () => {
    const entity = new CartEntity();

    const event = entity.mutate(
      "addItem",
      { payload: { productId: "1" }, metas: { correlationId: "abc" } },
      (draft) => {
        draft.total = 5;
      }
    );

    expect(event!.payload).toEqual({ productId: "1" });
    expect(event!.metas).toEqual({ correlationId: "abc" });
    expect((event as unknown as { params?: unknown }).params).toBeUndefined();
  });

  it("recipe that throws raises MutationError and leaves state intact", () => {
    const entity = new CartEntity();
    const stateBefore = entity.state;

    expect(() =>
      entity.mutate("boom", (draft) => {
        draft.total = 999;
        throw new Error("recipe failure");
      })
    ).toThrow(MutationError);

    expect(entity.state).toBe(stateBefore);
    expect(entity.state.total).toBe(0);
  });

  it("recipe that throws a non-Error value still raises MutationError (String(error) fallback)", () => {
    const entity = new CartEntity();
    const stateBefore = entity.state;

    expect(() =>
      entity.mutate("boom", (draft) => {
        draft.total = 999;
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
        throw "recipe failure — not an Error instance";
      })
    ).toThrow(MutationError);

    expect(entity.state).toBe(stateBefore);
    expect(entity.state.total).toBe(0);
  });

  it("catch-all listener receives previousState/nextState alongside patches", () => {
    const entity = new CartEntity();
    let received: TEntityEvent<TCartState> | undefined;
    entity.onAnyEntityUpdated((event) => {
      received = event;
    });

    entity.mutate("setTotal", (draft) => {
      draft.total = 42;
    });

    expect(received!.previousState.total).toBe(0);
    expect(received!.nextState.total).toBe(42);
  });
});
