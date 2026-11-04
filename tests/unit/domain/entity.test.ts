/**
 * Tests — Entity state owned by the kernel (lot M6.1)
 *
 * Invariants proved:
 *   I6   — the state is reachable only inside a handler of the owning Feature
 *   I46  — the state is JSON-serialisable (compile-time, see tests/types)
 *   I51  — catch-all notification `onAnyEntityUpdated`
 *   I96  — per-key handlers in alphabetical order, then the catch-all
 *   I53  — unknown key in on<Key>EntityUpdated → startup error (sub-case of I96)
 *   I97  — patches, inverse patches and changedKeys derive from the recipe
 *   A4.a — business invariants checked at the end of the unit, not before
 *   G5   — a notification is a deferred message, delivered after the unit
 *   G7   — a failed unit leaves the state exactly as it was
 *   D9   — a notification loop is bounded by the causal bound
 *   I98  — a mutation notifies through the kernel's deferred queue (the FIFO
 *          re-entrance queue of the Entity is gone): ordered, bounded by D9
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { Feature, type TFeatureContext, type TFeatureQueryContext } from "@bonsai/feature";
import { Entity, bindEntityState, type TEntityEvent } from "@bonsai/entity";
import type { TChannelToken } from "@bonsai/kernel";
import { drive } from "../../helpers/drive";

// ─── Fixtures ──────────────────────────────────────────────────────────────

type TState = { count: number; label: string; tags: string[] };

class CounterEntity extends Entity<TState> {
  protected defineInitialState(): TState {
    return { count: 0, label: "start", tags: [] };
  }
  override get invariants() {
    return [
      { name: "count-never-negative", check: (s: TState) => s.count >= 0 },
      { name: "label-not-empty", check: (s: TState) => s.label !== "" }
    ];
  }
}

type TDef = {
  commands: {
    inc: { by: number };
    setLabel: { label: string };
    noop: null;
    noopWithPayload: null;
    tagTwice: null;
    explode: null;
    breakAndRepair: null;
    breakCount: null;
    withMetas: { payload: unknown };
    loop: null;
    setBoth: null;
    emitThenFail: null;
  };
  events: { changed: { count: number } };
  queries: { state: { params: null; result: TState }; notifications: { params: null; result: string[] } };
};

/** Observations made by handlers, outside the Feature (no mutable field in a component, A0.c). */
const log: string[] = [];
const events: TEntityEvent<TState>[] = [];
let handlerBehaviour: "ok" | "throw" | "loop" = "ok";

type TCtx = TFeatureContext<TDef, CounterEntity>;

class CounterFeature extends Feature<CounterEntity, TDef, "counter"> {
  static readonly channel: TChannelToken<TDef, "counter"> = { namespace: "counter", events: ["changed"] };
  get listens() { return [] as const; }
  get queries() { return [] as const; }
  protected get Entity() { return CounterEntity; }

  onIncCommand(p: { by: number }, ctx: TCtx): void {
    const event = ctx.mutate("inc", (d) => { d.count += p.by; });
    if (event !== null) events.push(event);
  }
  onSetLabelCommand(p: { label: string }, ctx: TCtx): void {
    events.push(ctx.mutate("setLabel", (d) => { d.label = p.label; })!);
  }
  onNoopCommand(_p: null, ctx: TCtx): void {
    log.push(`noop returned ${String(ctx.mutate("noop", (d) => { d.label = d.label; }))}`);
  }
  onNoopWithPayloadCommand(_p: null, ctx: TCtx): void {
    ctx.mutate("noop", { payload: 1 }, () => undefined);
  }
  onTagTwiceCommand(_p: null, ctx: TCtx): void {
    ctx.mutate("tag", (d) => { d.tags.push("a"); });
    ctx.mutate("tag", (d) => { d.tags.push("b"); });
  }
  onExplodeCommand(_p: null, ctx: TCtx): void {
    ctx.mutate("explode", (d) => { d.count = 99; throw new Error("recipe failed"); });
  }
  onBreakAndRepairCommand(_p: null, ctx: TCtx): void {
    // Intermediate violation, repaired before the end of the unit (A4.a).
    ctx.mutate("break", (d) => { d.count = -5; });
    ctx.mutate("repair", (d) => { d.count = 5; });
  }
  onBreakCountCommand(_p: null, ctx: TCtx): void {
    ctx.mutate("break", (d) => { d.count = -1; });
  }
  onWithMetasCommand(p: { payload: unknown }, ctx: TCtx): void {
    events.push(ctx.mutate("withMetas", { payload: p.payload, metas: { source: "test" } }, (d) => { d.count += 1; })!);
  }
  onSetBothCommand(_p: null, ctx: TCtx): void {
    // label is written before count: changedKeys follow the patches, handlers follow the alphabet.
    ctx.mutate("both", (d) => { d.label = "both"; d.count = 9; });
  }
  onLoopCommand(_p: null, ctx: TCtx): void {
    handlerBehaviour = "loop";
    ctx.mutate("loop", (d) => { d.count += 1; });
  }
  onEmitThenFailCommand(_p: null, ctx: TCtx): void {
    ctx.mutate("x", (d) => { d.count = 7; });
    ctx.emit("changed", { count: 7 });
    throw new Error("late failure");
  }

  // I96 — notifications
  onCountEntityUpdated(prev: number, next: number, patches: unknown[], _ctx: TCtx): void {
    log.push(`count ${prev}->${next} patches=${patches.length}`);
    if (handlerBehaviour === "throw") throw new Error("handler failed");
  }
  onLabelEntityUpdated(prev: string, next: string): void { log.push(`label ${prev}->${next}`); }
  onTagsEntityUpdated(prev: string[], next: string[]): void { log.push(`tags ${prev.length}->${next.length}`); }
  onAnyEntityUpdated(event: TEntityEvent<TState>, ctx: TCtx): void {
    log.push(`any ${event.intent} [${event.changedKeys.join(",")}]`);
    if (handlerBehaviour === "loop") ctx.mutate("loop", (d) => { d.count += 1; });
  }

  onStateQuery(_p: null, _c: TFeatureQueryContext): TState { return this.entity.state; }
  onNotificationsQuery(): string[] { return [...log]; }
}

const features = { counter: CounterFeature };

beforeEach(() => {
  log.length = 0;
  events.length = 0;
  handlerBehaviour = "ok";
});

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("Entity on the kernel — lot M6.1", () => {
  describe("initial state and ownership (I6)", () => {
    it("the kernel creates the state from defineInitialState", () => {
      const d = drive(features);
      expect(d.ask<TState>("counter", "state", null)).toEqual({ count: 0, label: "start", tags: [] });
    });

    it("the Entity exposes the initial state, unchanged by mutations", () => {
      const entity = new CounterEntity();
      const d = drive(features);
      d.send("counter", "inc", { by: 3 });
      expect(entity.initialState).toEqual({ count: 0, label: "start", tags: [] });
    });

    it("state bindings nest: restoring the inner one brings back the outer one, then none", () => {
      const entity = new CounterEntity();
      const restoreOuter = bindEntityState(entity, () => ({ count: 1, label: "outer", tags: [] }));
      const restoreInner = bindEntityState(entity, () => ({ count: 2, label: "inner", tags: [] }));
      expect(entity.state.label).toBe("inner");
      restoreInner();
      expect(entity.state.label).toBe("outer");
      restoreOuter();
      expect(() => entity.state).toThrow(/readable only inside a handler/);
    });
  });

  describe("ctx.mutate — immutable update (ADR-10)", () => {
    it("applies the recipe and returns the notification event", () => {
      const d = drive(features);
      d.send("counter", "inc", { by: 2 });
      expect(d.ask<TState>("counter", "state", null).count).toBe(2);
      expect(events[0]!.intent).toBe("inc");
    });

    it("produces a new state reference and keeps the previous one intact", () => {
      const d = drive(features);
      d.send("counter", "inc", { by: 1 });
      const [event] = events;
      expect(event!.nextState).not.toBe(event!.previousState);
      expect(event!.previousState.count).toBe(0);
      expect(event!.nextState.count).toBe(1);
      expect(Object.isFrozen(event!.nextState)).toBe(true);
    });

    it("a recipe without effect returns null and notifies nobody", () => {
      const d = drive(features);
      d.send("counter", "noop", null);
      expect(log).toEqual(["noop returned null"]);
    });

    it("a no-op carrying a payload is still a no-op", () => {
      const d = drive(features);
      d.send("counter", "noopWithPayload", null);
      expect(log).toEqual([]);
    });
  });

  describe("I97 — patches and changedKeys", () => {
    it("the event carries patches, inverse patches and the changed keys", () => {
      const d = drive(features);
      d.send("counter", "inc", { by: 4 });
      const [event] = events;
      expect(event!.patches).toEqual([{ op: "replace", path: ["count"], value: 4 }]);
      expect(event!.inversePatches).toEqual([{ op: "replace", path: ["count"], value: 0 }]);
      expect(event!.changedKeys).toEqual(["count"]);
    });

    it("payload and metas are flattened onto the event", () => {
      const d = drive(features);
      d.send("counter", "withMetas", { payload: { id: 1 } });
      expect(events[0]!.payload).toEqual({ id: 1 });
      expect(events[0]!.metas).toEqual({ source: "test" });
    });
  });

  describe("I96 / I51 — notifications are deferred messages (G5)", () => {
    it("arrive after the unit, per key in alphabetical order, then the catch-all", () => {
      const d = drive(features);
      d.send("counter", "tagTwice", null);
      // Two mutations of the same key in one unit → two notifications, in order of the mutations.
      expect(log).toEqual(["tags 0->1", "any tag [tags]", "tags 1->2", "any tag [tags]"]);
      expect(d.failures()).toEqual([]);
    });

    it("a single mutation notifies its keys alphabetically, then the catch-all", () => {
      const d = drive(features);
      d.send("counter", "inc", { by: 1 });
      d.send("counter", "setLabel", { label: "x" });
      expect(log).toEqual(["count 0->1 patches=1", "any inc [count]", "label start->x", "any setLabel [label]"]);
    });

    it("several keys changed by one mutation: per-key handlers in alphabetical order, whatever the patch order", () => {
      const d = drive(features);
      d.send("counter", "setBoth", null);
      expect(log).toEqual(["count 0->9 patches=1", "label start->both", "any both [label,count]"]);
    });

    it("a throwing notification handler fails its own unit; the mutation stays", () => {
      const d = drive(features);
      handlerBehaviour = "throw";
      d.send("counter", "inc", { by: 2 });
      expect(d.failures()).toHaveLength(1);
      expect(d.ask<TState>("counter", "state", null).count).toBe(2);
    });

    it("an unknown key in on<Key>EntityUpdated is refused before any unit runs (I53, I96)", () => {
      class Bad extends CounterFeature {
        onNothingEntityUpdated(): void { /* no such key */ }
      }
      expect(() => drive({ counter: Bad })).toThrow(/I96.*unknown key "nothing"/);
    });
  });

  describe("G7 — a failed unit leaves the state exactly as it was", () => {
    it("a recipe that throws rolls back the unit", () => {
      const d = drive(features);
      d.send("counter", "inc", { by: 1 });
      d.send("counter", "explode", null);
      expect(d.failures()).toHaveLength(1);
      expect(d.ask<TState>("counter", "state", null).count).toBe(1);
    });

    it("an Event emitted in a failed unit is never delivered", () => {
      const d = drive(features, { listen: [{ namespace: "counter", event: "changed" }] });
      d.send("counter", "emitThenFail", null);
      expect(d.received).toEqual([]);
      expect(d.ask<TState>("counter", "state", null).count).toBe(0);
    });
  });

  describe("A4.a — invariants at the end of the unit", () => {
    it("an invariant violated at the end fails the unit and restores the state", () => {
      const d = drive(features);
      d.send("counter", "breakCount", null);
      expect(d.failures()).toHaveLength(1);
      expect(String(d.failures()[0]!.error)).toMatch(/count-never-negative/);
      expect(d.ask<TState>("counter", "state", null).count).toBe(0);
    });

    it("a violation repaired before the end of the unit is accepted", () => {
      const d = drive(features);
      d.send("counter", "breakAndRepair", null);
      expect(d.failures()).toEqual([]);
      expect(d.ask<TState>("counter", "state", null).count).toBe(5);
    });
  });

  describe("D9, I98 — a notification loop is bounded", () => {
    it("a handler that mutates on every notification stops at the causal bound", () => {
      const d = drive(features, { causalBound: 5 });
      d.send("counter", "loop", null);
      // The chain is cut by a single failed unit; everything before it stays applied.
      expect(d.failures().map((f) => String(f.error))).toEqual([expect.stringMatching(/CAUSAL_BOUND.*exceeds bound 5/)]);
      expect(d.ask<TState>("counter", "state", null).count).toBe(4);
    });
  });
});
