/**
 * Tests Strate 1a — Entity re-entrance FIFO [I98]
 *
 * Prouve : Hotspot A (ADR-0028) — une mutation déclenchée pendant un cycle
 * de notification est mise en file FIFO (pas LIFO, pas immédiate), et
 * `maxEntityNotificationDepth` protège contre la boucle infinie.
 *
 * Spec de test pré-écrite par ADR-0030 §Niveau 2 (ligne 289) — reproduite
 * ici avec les fixtures du repo (pas de helper `createTestEntity` générique).
 */

import { describe, it, expect } from "@jest/globals";
import { Entity } from "@bonsai/entity";

type TCounterState = {
  a: number;
  b: number;
  c: number;
  label: string;
};

class CounterEntity extends Entity<TCounterState> {
  protected defineInitialState(): TCounterState {
    return { a: 0, b: 0, c: 0, label: "" };
  }
}

describe("Entity re-entrance FIFO — Strate 1a [I98]", () => {
  it("queues mutation triggered during notification cycle — runs after the current cycle completes", () => {
    const entity = new CounterEntity();
    const callOrder: string[] = [];

    entity.onAnyEntityUpdated((event) => {
      callOrder.push(`any:${event.intent}`);
      if (event.intent === "first") {
        entity.mutate("second", (draft) => {
          draft.label = "mutated";
        });
      }
    });

    entity.mutate("first", (draft) => {
      draft.a = 1;
    });

    expect(callOrder).toEqual(["any:first", "any:second"]);
  });

  it("throws EntityReentrancyError when maxEntityNotificationDepth is exceeded", () => {
    const entity = new CounterEntity();

    entity.onAnyEntityUpdated(() => {
      // Mutation récursive infinie — chaque notification en déclenche une autre
      entity.mutate("recursive", (draft) => {
        draft.a += 1;
      });
    });

    expect(() =>
      entity.mutate("initial", (draft) => {
        draft.a = 1;
      })
    ).toThrow("maxEntityNotificationDepth");
  });

  it("processes queued mutations FIFO — not LIFO", () => {
    const entity = new CounterEntity();
    const order: string[] = [];

    entity.onAnyEntityUpdated((event) => {
      order.push(event.intent);
      if (event.intent === "first") {
        entity.mutate("second", (draft) => {
          draft.b = 1;
        });
        entity.mutate("third", (draft) => {
          draft.c = 1;
        });
      }
    });

    entity.mutate("first", (draft) => {
      draft.a = 1;
    });

    expect(order).toEqual(["first", "second", "third"]);
  });

  it("queued mutate() call returns null synchronously (event fires later)", () => {
    const entity = new CounterEntity();
    let queuedReturn: unknown = "not-set";

    entity.onAnyEntityUpdated((event) => {
      if (event.intent === "first") {
        queuedReturn = entity.mutate("second", (draft) => {
          draft.b = 1;
        });
      }
    });

    entity.mutate("first", (draft) => {
      draft.a = 1;
    });

    expect(queuedReturn).toBeNull();
  });
});
