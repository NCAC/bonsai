/**
 * Discriminating tests of the kernel prototype, lot M2: Entity on the unit
 * journal, business invariants at the end of each validation unit, startup
 * from a Manifest with initial dependencies.
 */

import { describe, expect, it } from "@jest/globals";
import {
  InvariantError,
  ManifestError,
  Root,
  StartupError,
  TransportError,
  type TComponentHandle,
  type TEntityDefinition,
  type TManifestEntry
} from "../../../packages/kernel/src/kernel";

type TCart = { lines: number[]; total: number };

const cartEntity: TEntityDefinition<TCart> = {
  name: "cart",
  initial: { lines: [], total: 0 },
  invariants: [{ name: "total = somme des lignes", check: (s) => s.total === s.lines.reduce((a, b) => a + b, 0) }]
};

const click = { kind: "independent" } as const;

function failures(root: Root): unknown[] {
  return root.trace.filter((e) => e.type === "unit-failed").map((e) => (e as { error: unknown }).error);
}

/** A cart Feature whose commands exercise the Entity. */
function cartSpec(log: string[] = []): TManifestEntry {
  return {
    name: "cart",
    entity: cartEntity,
    channel: {
      namespace: "cart",
      events: ["changed"],
      queries: { total: (_p, c) => c.state<TCart>().total },
      commands: {
        // correct: keeps the invariant
        add: (p, c) => {
          c.mutate<TCart>((d) => { d.lines.push(p as number); d.total += p as number; });
          c.emit("changed");
        },
        // mutation then exception
        addThenCrash: (p, c) => {
          c.mutate<TCart>((d) => { d.lines.push(p as number); d.total += p as number; });
          c.emit("changed");
          throw new Error("crash after mutation");
        },
        // forgets to update the total: invariant violated at the end
        addBroken: (p, c) => {
          c.mutate<TCart>((d) => { d.lines.push(p as number); });
          c.emit("changed");
        },
        // breaks the invariant temporarily, consults another Feature, then restores it
        addInTwoSteps: (p, c) => {
          c.mutate<TCart>((d) => { d.lines.push(p as number); });
          const rate = c.query<number>("tax", "rate");
          log.push(`rate ${rate}`);
          c.mutate<TCart>((d) => { d.total += p as number; });
        },
        // writes the frozen state directly: refused (garde A0.c / G7)
        hack: (_p, c) => { (c.state<TCart>() as { total: number }).total = 99; }
      }
    }
  };
}

/** Starts tax, cart and a view; returns helpers to drive the view. */
function start(log: string[] = []) {
  const root = new Root({ causalBound: 20 });
  const seen: number[] = [];
  let view!: TComponentHandle;
  root.start((ctx) => {
    ctx.create({ name: "tax", channel: { namespace: "tax", queries: { rate: () => 20 } } });
    ctx.create(cartSpec(log));
    view = ctx.create({
      name: "cartView",
      listens: [{ namespace: "cart", event: "changed", handler: (_p, c) => { seen.push(c.query<number>("cart", "total")); } }],
      locals: {
        send: (p, c) => { const [cmd, value] = p as [string, number]; c.trigger("cart", cmd, value); },
        read: (_p, c) => { seen.push(c.query<number>("cart", "total")); }
      }
    });
  });
  const send = (cmd: string, value = 0) => root.admit(view, "send", [cmd, value], click);
  const read = () => root.admit(view, "read", {}, click);
  return { root, seen, send, read };
}


describe("M2 — Entity journaled in the validation unit (G7)", () => {
  it("restores the state when the unit fails after a successful mutation", () => {
    const { root, seen, send, read } = start();
    send("add", 10);
    send("addThenCrash", 5);
    read();
    expect(seen).toEqual([10, 10]);           // changed after add; then read: still 10
    expect((failures(root)[0] as Error).message).toBe("crash after mutation");
  });

  it("refuses a direct write to the frozen state", () => {
    const { root, seen, send, read } = start();
    send("hack");
    read();
    expect(seen).toEqual([0]);
    expect(failures(root)[0]).toBeInstanceOf(TypeError);
  });

  it("forbids mutating an Entity while answering a Query (A3.g)", () => {
    const root = new Root({ causalBound: 10 });
    let view!: TComponentHandle;
    root.start((ctx) => {
      ctx.create({
        name: "counter",
        entity: { name: "counter", initial: { n: 0 } },
        channel: { namespace: "counter", queries: { peek: (_p, c) => { (c as unknown as { mutate: (r: (d: { n: number }) => void) => void }).mutate((d) => { d.n++; }); return 0; } } }
      });
      view = ctx.create({ name: "v", locals: { go: (_p, c) => c.query("counter", "peek") } });
    });
    root.admit(view, "go", {}, click);
    expect((failures(root)[0] as TransportError).code).toBe("READ_ONLY");
  });
});

describe("M2 — business invariants at the end of each unit (A4.a)", () => {
  it("fails and rolls back a unit that leaves an invariant violated; its Event is dropped", () => {
    const { root, seen, send, read } = start();
    send("addBroken", 7);
    read();
    expect(seen).toEqual([0]);                // no "changed" delivered; state restored
    const error = failures(root)[0] as InvariantError;
    expect(error).toBeInstanceOf(InvariantError);
    expect(error.invariant).toBe("total = somme des lignes");
  });

  it("allows an intermediate state inside the unit: a nested Query does not validate its author", () => {
    const log: string[] = [];
    const { root, seen, send } = start(log);
    send("addInTwoSteps", 4);
    expect(log).toEqual(["rate 20"]);
    expect(failures(root)).toHaveLength(0);
    expect(seen).toEqual([]);                 // addInTwoSteps emits nothing
  });
});

describe("M2 — startup and publication (§2.5, C.1)", () => {
  it("abandons startup when an initial state violates an invariant", () => {
    const root = new Root({ causalBound: 10 });
    expect(() =>
      root.start((ctx) => {
        ctx.create({ name: "bad", entity: { ...cartEntity, initial: { lines: [1], total: 0 } } });
      })
    ).toThrow(StartupError);
  });

  it("publishes nothing when startup fails late, after other children were created", () => {
    const root = new Root({ causalBound: 10 });
    let first!: TComponentHandle;
    let delivered = false;
    expect(() =>
      root.start((ctx) => {
        first = ctx.create({ name: "first", locals: { ping: () => { delivered = true; } } });
        ctx.create({ name: "second", init: () => { throw new Error("late failure"); } });
      })
    ).toThrow(StartupError);
    root.admit(first, "ping", {}, click);
    expect(delivered).toBe(false);
    expect(root.trace.some((e) => e.type === "admission-abandoned")).toBe(true);
  });

  it("orders creation by declared initial dependencies, then by declaration", () => {
    const order: string[] = [];
    const root = new Root({ causalBound: 10 });
    root.startFromManifest([
      { name: "cart", dependsOn: ["catalog"], channel: { namespace: "cart" }, init: (c) => { order.push(`cart sees ${c.query<number>("catalog", "size")}`); } },
      { name: "analytics", channel: { namespace: "analytics" }, init: () => { order.push("analytics"); } },
      { name: "catalog", channel: { namespace: "catalog", queries: { size: () => 3 } }, init: () => { order.push("catalog"); } }
    ]);
    expect(order).toEqual(["analytics", "catalog", "cart sees 3"]);
  });

  it("refuses a cycle or an unknown dependency before starting", () => {
    expect(() =>
      new Root({ causalBound: 10 }).startFromManifest([
        { name: "a", dependsOn: ["b"], channel: { namespace: "a" } },
        { name: "b", dependsOn: ["a"], channel: { namespace: "b" } }
      ])
    ).toThrow(ManifestError);
    expect(() =>
      new Root({ causalBound: 10 }).startFromManifest([{ name: "a", dependsOn: ["ghost"], channel: { namespace: "a" } }])
    ).toThrow(ManifestError);
  });
});
