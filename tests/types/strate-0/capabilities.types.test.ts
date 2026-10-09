/**
 * Type tests — capabilities of each role on the Channel (compile-time).
 *
 * These tests do not assert anything at runtime: each `@ts-expect-error`
 * locks a rejection. If the typing is loosened, the compiler reports
 * "Unused '@ts-expect-error' directive" and the regression is caught.
 *
 * Covers:
 *   I1  — a Feature emits only on its own Channel, and `emit()` is protected.
 *   I4  — a View has no `emit()` (the declared-Channels part is I77,
 *         view-contract.types.test.ts).
 *   I23 — Application exposes no Channel capability (dormant at runtime).
 *   I25 — only Views (and Behaviors, ⏳) have `trigger()`: not Feature,
 *         Composer nor Foundation.
 *   I46 — an Entity state must be `TJsonSerializable`.
 *   I79 — `Feature.request()` takes a typed `TChannelToken`, never a string.
 *
 * @jest-environment node
 */

import { describe, it } from "@jest/globals";
import type { Application } from "@bonsai/application";
import type { Composer } from "@bonsai/composer";
import { Entity } from "@bonsai/entity";
import { type TChannelToken } from "@bonsai/event";
import { Feature } from "@bonsai/feature";
import type { Foundation } from "@bonsai/foundation";
import type { View } from "@bonsai/view";

// ─── Fixtures ────────────────────────────────────────────────────────────────

type TCounterState = { count: number };

class CounterEntity extends Entity<TCounterState> {
  protected defineInitialState(): TCounterState {
    return { count: 0 };
  }
}

type TPricingDef = {
  readonly commands: Record<string, never>;
  readonly events: { priceChanged: { id: string } };
  readonly requests: { price: { params: { id: string }; result: number } };
};

type TCartDef = {
  readonly commands: { addItem: { id: string } };
  readonly events: { itemAdded: { id: string } };
  readonly requests: Record<string, never>;
};

class PricingFeature extends Feature<CounterEntity, TPricingDef, "pricing"> {
  static readonly channel: TChannelToken<TPricingDef, "pricing"> = {
    namespace: "pricing"
  };
  get listens() {
    return [] as const;
  }
  get queries() {
    return [] as const;
  }
  protected get Entity() {
    return CounterEntity;
  }
}

class CartFeature extends Feature<CounterEntity, TCartDef, "cart"> {
  static readonly channel: TChannelToken<TCartDef, "cart"> = {
    namespace: "cart"
  };
  get listens() {
    return [] as const;
  }
  get queries() {
    return [PricingFeature.channel] as const;
  }
  protected get Entity() {
    return CounterEntity;
  }

  emitOwnEvent(): void {
    this.emit("itemAdded", { id: "a" });
  }

  emitForeignEvent(): void {
    // @ts-expect-error — `priceChanged` belongs to another Channel (I1)
    this.emit("priceChanged", { id: "a" });
  }

  requestWithToken(): void {
    this.request(PricingFeature.channel, "price", { id: "a" });
  }

  requestWithString(): void {
    // @ts-expect-error — a namespace string is not a TChannelToken (I79)
    this.request("pricing", "price", { id: "a" });
  }

  sendCommand(): void {
    // @ts-expect-error — a Feature has no `trigger()` (I25)
    this.trigger("pricing:refresh", {});
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Feature capabilities [I1, I25, I79]", () => {
  it("I1 — `emit()` is not callable from outside the Feature", () => {
    const cart = new CartFeature("cart");
    // @ts-expect-error — `emit` is protected (I1)
    void cart.emit;
  });
});

describe("Concrete layer capabilities [I4, I25]", () => {
  it("I4 — a View has no `emit()`", () => {
    const view = null as unknown as View<never>;
    // @ts-expect-error — `emit` does not exist on View (I4)
    void view?.emit;
  });

  it("I25 — neither Composer nor Foundation has `trigger()`", () => {
    const composer = null as unknown as Composer;
    const foundation = null as unknown as Foundation;
    // @ts-expect-error — `trigger` does not exist on Composer (I25)
    void composer?.trigger;
    // @ts-expect-error — `trigger` does not exist on Foundation (I25)
    void foundation?.trigger;
  });
});

describe("Application is dormant [I23]", () => {
  it("I23 — Application exposes no Channel capability", () => {
    const app = null as unknown as Application<never>;
    // @ts-expect-error — no `emit` on Application (I23)
    void app?.emit;
    // @ts-expect-error — no `trigger` on Application (I23)
    void app?.trigger;
    // @ts-expect-error — no `request` on Application (I23)
    void app?.request;
    // @ts-expect-error — no `listen` on Application (I23)
    void app?.listen;
    // @ts-expect-error — no `handle` on Application (I23)
    void app?.handle;
  });
});

describe("Entity state is JSON-serializable [I46]", () => {
  it("I46 — a plain `type` alias is accepted", () => {
    type TOk = { items: string[]; total: number; meta: null };
    class OkEntity extends Entity<TOk> {
      protected defineInitialState(): TOk {
        return { items: [], total: 0, meta: null };
      }
    }
    void OkEntity;
  });

  it("I46 — Date, Map, function and bigint are rejected", () => {
    // @ts-expect-error — Date is not TJsonSerializable (I46)
    type TDate = Entity<{ at: Date }>;
    // @ts-expect-error — Map is not TJsonSerializable (I46)
    type TMap = Entity<{ byId: Map<string, number> }>;
    // @ts-expect-error — a function is not TJsonSerializable (I46)
    type TFn = Entity<{ compute: () => number }>;
    // @ts-expect-error — bigint is not TJsonSerializable (I46)
    type TBig = Entity<{ n: bigint }>;
    const rejected: [TDate?, TMap?, TFn?, TBig?] = [];
    void rejected;
  });
});
