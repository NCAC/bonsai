/**
 * Discriminating tests of the kernel prototype (migration lot M1).
 *
 * Each block targets one guarantee of docs/theorie.md (§13, annex C).
 * A delivered Channel/Radio would fail most of them: that is the point.
 */

import { describe, expect, it } from "@jest/globals";
import {
  Root,
  StartupError,
  TransportError,
  type TCausalContext,
  type TComponentHandle,
  type TUnitContext
} from "../../../packages/event/src/kernel";

/** Starts a root and returns handles created by `build`. */
function boot<T>(build: (ctx: TUnitContext) => T, causalBound = 50): { root: Root; handles: T } {
  const root = new Root({ causalBound });
  let handles!: T;
  root.start((ctx) => {
    handles = build(ctx);
  });
  return { root, handles };
}

const click = { kind: "independent" } as const;

function failures(root: Root): unknown[] {
  return root.trace.filter((e) => e.type === "unit-failed").map((e) => (e as { error: unknown }).error);
}

// ── G5 + D8: the cart/promo example of the guide ─────────────────────────────

describe("G5 and D8 — deferred delivery in production order", () => {
  it("shows 20 then 18: the promo reaction does not overtake itemAdded", () => {
    const displayed: number[] = [];
    let total = 0;
    const { root, handles } = boot((ctx) => {
      ctx.create({
        name: "promo",
        channel: { namespace: "promo", events: ["applied"] },
        listens: [{ namespace: "cart", event: "itemAdded", handler: (_p, c) => c.emit("applied", { discount: 2 }) }]
      });
      ctx.create({
        name: "cart",
        channel: {
          namespace: "cart",
          events: ["itemAdded", "totalChanged"],
          commands: {
            addItem: (p, c) => {
              total += (p as { price: number }).price;
              c.emit("itemAdded", { total });
            }
          },
          queries: { total: () => total }
        },
        listens: [{
          namespace: "promo", event: "applied", handler: (p, c) => {
            total -= (p as { discount: number }).discount;
            c.emit("totalChanged", { total });
          }
        }]
      });
      return ctx.create({
        name: "cartView",
        locals: { click: (_p, c) => c.trigger("cart", "addItem", { price: 20 }) },
        listens: [
          { namespace: "cart", event: "itemAdded", handler: (p) => displayed.push((p as { total: number }).total) },
          { namespace: "cart", event: "totalChanged", handler: (p) => displayed.push((p as { total: number }).total) }
        ]
      });
    });

    root.admit(handles, "click", {}, click);

    expect(displayed).toEqual([20, 18]);
  });

  it("after trigger, nothing has changed elsewhere yet", () => {
    let total = 0;
    let seenDuringAuthor: number | null = null;
    const { root, handles } = boot((ctx) => {
      ctx.create({
        name: "cart",
        channel: { namespace: "cart", commands: { add: () => { total += 1; } }, queries: { total: () => total } }
      });
      return ctx.create({
        name: "view",
        locals: {
          click: (_p, c) => {
            c.trigger("cart", "add");
            seenDuringAuthor = c.query<number>("cart", "total");
          }
        }
      });
    });
    root.admit(handles, "click", {}, click);
    expect(seenDuringAuthor).toBe(0);
    expect(total).toBe(1);
  });

  it("delivers to subscribers in subscription order, messages in production order", () => {
    const log: string[] = [];
    const { root, handles } = boot((ctx) => {
      ctx.create({ name: "a", listens: [{ namespace: "src", event: "e", handler: () => log.push("a") }] });
      ctx.create({ name: "b", listens: [{ namespace: "src", event: "e", handler: () => log.push("b") }] });
      return ctx.create({
        name: "src",
        channel: { namespace: "src", events: ["e"], commands: { first: () => log.push("first"), second: () => log.push("second") } },
        locals: { go: (_p, c) => { c.trigger("src", "first"); c.emit("e"); c.trigger("src", "second"); } }
      });
    });
    root.admit(handles, "go", {}, click);
    expect(log).toEqual(["first", "a", "b", "second"]);
  });
});

// ── G5 Queries ───────────────────────────────────────────────────────────────

describe("G5 — synchronous Queries towards a ready, inactive target", () => {
  it("refuses a Query to oneself and a cycle A → B → A; the author's unit fails", () => {
    let counter = 0;
    const { root, handles } = boot((ctx) => {
      ctx.create({
        name: "b",
        channel: { namespace: "b", queries: { ask: (_p, c) => c.query("a", "value") } }
      });
      return ctx.create({
        name: "a",
        channel: { namespace: "a", queries: { value: () => 1 } },
        locals: {
          self: (_p, c) => { counter++; c.journal(() => { counter--; }); c.query("a", "value"); },
          cycle: (_p, c) => { counter++; c.journal(() => { counter--; }); c.query("b", "ask"); }
        }
      });
    });

    root.admit(handles, "self", {}, click);
    root.admit(handles, "cycle", {}, click);

    expect(counter).toBe(0);
    expect(failures(root).map((e) => (e as TransportError).code)).toEqual(["TARGET_ACTIVE", "TARGET_ACTIVE"]);
  });

  it("A3.g — a Query handler cannot trigger; the author's unit fails", () => {
    let delivered = false;
    const { root, handles } = boot((ctx) => {
      ctx.create({
        name: "sneaky",
        channel: {
          namespace: "sneaky",
          commands: { hit: () => { delivered = true; } },
          queries: { read: (_p, c) => { (c as unknown as TUnitContext).trigger("sneaky", "hit"); return 0; } }
        }
      });
      return ctx.create({ name: "view", locals: { go: (_p, c) => c.query("sneaky", "read") } });
    });
    root.admit(handles, "go", {}, click);
    expect(delivered).toBe(false);
    expect((failures(root)[0] as TransportError).code).toBe("READ_ONLY");
  });
});

// ── G7 ───────────────────────────────────────────────────────────────────────

describe("G7 — a failing unit is rolled back", () => {
  it("restores journaled state and drops its deferred messages", () => {
    let lines = 0;
    let notified = false;
    const { root, handles } = boot((ctx) => {
      ctx.create({ name: "view", listens: [{ namespace: "cart", event: "changed", handler: () => { notified = true; } }] });
      return ctx.create({
        name: "cart",
        channel: { namespace: "cart", events: ["changed"] },
        locals: {
          add: (_p, c) => {
            lines++;
            c.journal(() => { lines--; });
            c.emit("changed");
            throw new Error("total computation failed");
          }
        }
      });
    });
    root.admit(handles, "add", {}, click);
    expect(lines).toBe(0);
    expect(notified).toBe(false);
    const failure = root.trace.find((e) => e.type === "unit-failed");
    expect(failure && failure.type === "unit-failed" && failure.context.originKind).toBe("spontaneous");
  });

  it("forbids local recovery of a Query error", () => {
    let state = 0;
    const { root, handles } = boot((ctx) => {
      ctx.create({ name: "broken", channel: { namespace: "broken", queries: { q: () => { throw new Error("boom"); } } } });
      return ctx.create({
        name: "author",
        locals: {
          go: (_p, c) => {
            state = 1;
            c.journal(() => { state = 0; });
            try { c.query("broken", "q"); } catch { /* attempted recovery */ }
          }
        }
      });
    });
    root.admit(handles, "go", {}, click);
    expect(state).toBe(0);
    const [error] = failures(root) as TransportError[];
    expect(failures(root)).toHaveLength(1);
    expect(error!.code).toBe("UNRECOVERABLE");
    expect(error!.message).toContain("ne peut pas reprendre localement");
    expect((error!.cause as Error).message).toBe("boom");
  });

  it("does not publish a component created by a failing unit", () => {
    const { root, handles } = boot((ctx) =>
      ctx.create({
        name: "parent",
        locals: {
          spawn: (_p, c) => { c.create({ name: "child", channel: { namespace: "child", queries: { ping: () => "pong" } } }); throw new Error("abort"); },
          probe: (_p, c) => { c.query("child", "ping"); }
        }
      })
    );
    root.admit(handles, "spawn", {}, click);
    root.admit(handles, "probe", {}, click);
    expect((failures(root)[1] as TransportError).code).toBe("UNKNOWN_TARGET");
  });
});

// ── G3, C.2, C.6 ─────────────────────────────────────────────────────────────

describe("G3 and C.6 — reservations bound to a determined subscription", () => {
  function setup() {
    const received: string[] = [];
    let sub!: TComponentHandle;
    const { root, handles } = boot((ctx) =>
      ctx.create({
        name: "src",
        channel: { namespace: "src", events: ["e"] },
        init: (c) => { sub = c.create({ name: "sub", listens: [{ namespace: "src", event: "e", handler: () => received.push("sub") }] }); },
        locals: {
          emitThenSpawn: (_p, c) => {
            c.emit("e");
            c.create({ name: "late", listens: [{ namespace: "src", event: "e", handler: () => received.push("late") }] });
          },
          emitThenKill: (_p, c) => { c.emit("e"); c.destroy(sub); },
          killThenFail: (_p, c) => { c.destroy(sub); throw new Error("cancel"); },
          failedKillBeforeDelivery: (_p, c) => { c.local("killThenFail"); c.emit("e"); }
        }
      })
    );
    return { root, src: handles, received };
  }

  it("does not deliver an Event to a subscription created after the emission", () => {
    const { root, src, received } = setup();
    root.admit(src, "emitThenSpawn", {}, click);
    expect(received).toEqual(["sub"]);
  });

  it("abandons a reservation whose subscriber was destroyed before delivery", () => {
    const { root, src, received } = setup();
    root.admit(src, "emitThenKill", {}, click);
    expect(received).toEqual([]);
    expect(root.trace.some((e) => e.type === "delivery-abandoned")).toBe(true);
  });

  it("keeps the reservation when the destruction is cancelled", () => {
    const { root, src, received } = setup();
    root.admit(src, "failedKillBeforeDelivery", {}, click);
    expect(failures(root)).toHaveLength(1);
    expect(received).toEqual(["sub"]);
  });

  it("refuses a destruction by a component that is not the parent (A1.b)", () => {
    let victim!: TComponentHandle;
    const { root, handles } = boot((ctx) => {
      victim = ctx.create({ name: "victim" });
      return ctx.create({ name: "intruder", locals: { kill: (_p, c) => c.destroy(victim) } });
    });
    root.admit(handles, "kill", {}, click);
    expect((failures(root)[0] as TransportError).code).toBe("NOT_OWNER");
  });
});

// ── G2 ───────────────────────────────────────────────────────────────────────

describe("G2 — values captured by copy, without mutable alias", () => {
  it("isolates the recipient from later mutations and freezes what it receives", () => {
    let received: { items: string[] } | null = null;
    const { root, handles } = boot((ctx) => {
      ctx.create({ name: "view", listens: [{ namespace: "cart", event: "e", handler: (p) => { received = p as { items: string[] }; } }] });
      return ctx.create({
        name: "cart",
        channel: { namespace: "cart", events: ["e"] },
        locals: { go: (_p, c) => { const value = { items: ["a"] }; c.emit("e", value); value.items.push("b"); } }
      });
    });
    root.admit(handles, "go", {}, click);
    expect(received).toEqual({ items: ["a"] });
    expect(Object.isFrozen(received)).toBe(true);
  });

  it("refuses a payload carrying a function (A3.d)", () => {
    const { root, handles } = boot((ctx) =>
      ctx.create({ name: "cart", channel: { namespace: "cart", events: ["e"] }, locals: { go: (_p, c) => c.emit("e", { callback: () => 0 }) } })
    );
    root.admit(handles, "go", {}, click);
    expect((failures(root)[0] as TransportError).code).toBe("NOT_CAPTURABLE");
  });
});

// ── G6 ───────────────────────────────────────────────────────────────────────

describe("G6 — two roots never exchange messages", () => {
  it("keeps two `cart` Channels apart", () => {
    const counts = { one: 0, two: 0 };
    const make = (key: "one" | "two") =>
      boot((ctx) => {
        ctx.create({ name: "cart", channel: { namespace: "cart", commands: { add: () => { counts[key]++; } } } });
        return ctx.create({ name: "view", locals: { click: (_p, c) => c.trigger("cart", "add") } });
      });
    const one = make("one");
    make("two");
    one.root.admit(one.handles, "click", {}, click);
    expect(counts).toEqual({ one: 1, two: 0 });
  });
});

// ── G8 ───────────────────────────────────────────────────────────────────────

describe("G8 — causal contexts created by the kernel", () => {
  it("chains click → Command → Event, keeps the author's context after a Query, continues a correlated result", () => {
    const seen: Record<string, TCausalContext> = {};
    let token!: ReturnType<TUnitContext["correlate"]>;
    const { root, handles } = boot((ctx) => {
      const cart = ctx.create({
        name: "cart",
        channel: {
          namespace: "cart",
          events: ["added"],
          commands: { add: (_p, c) => { seen.command = c.cause; token = c.correlate(); } },
          queries: { total: () => 0 }
        },
        locals: { confirmed: (_p, c) => { seen.result = c.cause; c.emit("added"); } }
      });
      const view = ctx.create({
        name: "view",
        listens: [{ namespace: "cart", event: "added", handler: (_p, c) => { seen.event = c.cause; } }],
        locals: { click: (_p, c) => { seen.click = c.cause; c.query("cart", "total"); c.trigger("cart", "add"); } }
      });
      return { cart, view };
    });

    root.admit(handles.view, "click", {}, click);
    // the network response arrives later: a provoked fact, correlated (G8)
    root.admit(handles.cart, "confirmed", { ok: true }, { kind: "correlated", token });

    expect(seen.click!.originKind).toBe("spontaneous");
    expect(seen.click!.depth).toBe(0);
    expect(seen.command!.parentId).toBe(seen.click!.id);          // not the Query's context
    expect(seen.result!.parentId).toBe(seen.command!.id);         // correlated continuation
    expect(seen.event!.parentId).toBe(seen.result!.id);
    expect(new Set([seen.command!.originId, seen.result!.originId, seen.event!.originId])).toEqual(new Set([seen.click!.id]));
  });

  it("qualifies an uncorrelatable notification as an unknown origin", () => {
    let cause!: TCausalContext;
    const { root, handles } = boot((ctx) => ctx.create({ name: "viewport", locals: { resized: (_p, c) => { cause = c.cause; } } }));
    root.admit(handles, "resized", { width: 800 }, { kind: "unknown" });
    expect(cause.originKind).toBe("unknown");
    expect(cause.parentId).toBeNull();
  });

  it("refuses a result routed to another occurrence", () => {
    let token!: ReturnType<TUnitContext["correlate"]>;
    let reached = false;
    const { root, handles } = boot((ctx) => ({
      a: ctx.create({ name: "a", locals: { arm: (_p, c) => { token = c.correlate(); } } }),
      b: ctx.create({ name: "b", locals: { result: () => { reached = true; } } })
    }));
    root.admit(handles.a, "arm", {}, click);
    root.admit(handles.b, "result", {}, { kind: "correlated", token });
    expect(reached).toBe(false);
    expect(root.trace.some((e) => e.type === "admission-abandoned")).toBe(true);
  });
});

// ── D9 ───────────────────────────────────────────────────────────────────────

describe("D9 — causal depth bound", () => {
  it("refuses at submission beyond the bound and rolls the refusing unit back", () => {
    let validated = 0;
    let depthReached = -1;
    let token!: ReturnType<TUnitContext["correlate"]>;
    const { root, handles } = boot((ctx) =>
      ctx.create({
        name: "loop",
        locals: {
          again: (_p, c) => {
            validated++;
            c.journal(() => { validated--; });
            depthReached = c.cause.depth;
            token = c.correlate();
            c.local("again");
          },
          result: () => undefined
        }
      }), 3);

    root.admit(handles, "again", {}, click);

    expect(depthReached).toBe(3);                       // depths 0, 1, 2, 3 ran
    expect(validated).toBe(3);                          // the depth-3 unit was rolled back
    expect((failures(root)[0] as TransportError).code).toBe("CAUSAL_BOUND");

    // a correlated result of the depth-3 context would be depth 4: abandoned at the preamble
    root.admit(handles, "result", {}, { kind: "correlated", token });
    expect(root.trace.filter((e) => e.type === "admission-abandoned")).toHaveLength(1);
  });
});

// ── Startup (§2.5, C.1) ──────────────────────────────────────────────────────

describe("Startup — deferred messages wait for its success", () => {
  it("delivers startup messages only after success", () => {
    const log: string[] = [];
    boot((ctx) => {
      ctx.create({ name: "a", channel: { namespace: "a", commands: { hello: () => log.push("delivered") } } });
      ctx.trigger("a", "hello");
      log.push("startup end");
    });
    expect(log).toEqual(["startup end", "delivered"]);
  });

  it("abandons the model when startup fails", () => {
    const root = new Root({ causalBound: 10 });
    let delivered = false;
    expect(() =>
      root.start((ctx) => {
        ctx.create({ name: "a", channel: { namespace: "a", commands: { hello: () => { delivered = true; } } } });
        ctx.trigger("a", "hello");
        throw new Error("init failed");
      })
    ).toThrow(StartupError);
    expect(delivered).toBe(false);
  });

  it("refuses an initial Query towards a target that is still initialising", () => {
    const root = new Root({ causalBound: 10 });
    expect(() =>
      root.start((ctx) => {
        ctx.create({
          name: "a",
          channel: { namespace: "a", queries: { v: () => 1 } },
          init: (c) => { c.query("a", "v"); }
        });
      })
    ).toThrow(StartupError);
  });
});

// ── C.3 effects ──────────────────────────────────────────────────────────────

describe("C.3 — effects engaged after validation, in order", () => {
  it("engages nothing when the unit fails", () => {
    let written = false;
    const { root, handles } = boot((ctx) =>
      ctx.create({ name: "view", locals: { go: (_p, c) => { c.prepareEffect("write", () => { written = true; }); throw new Error("no"); } } })
    );
    root.admit(handles, "go", {}, click);
    expect(written).toBe(false);
  });

  it("stops at the first synchronous failure and reports the rest as not attempted", () => {
    const order: string[] = [];
    let report: unknown = null;
    const { root, handles } = boot((ctx) =>
      ctx.create({
        name: "view",
        locals: {
          go: (_p, c) => {
            c.prepareEffect("e1", () => order.push("e1"));
            c.prepareEffect("e2", () => { throw new Error("host refused"); });
            c.prepareEffect("e3", () => order.push("e3"));
            order.push("treatment end");
          },
          $effects: (p) => { report = p; }
        }
      })
    );
    root.admit(handles, "go", {}, click);
    expect(order).toEqual(["treatment end", "e1"]);
    expect(report).toEqual([
      { label: "e1", outcome: "engaged" },
      { label: "e2", outcome: "failed" },
      { label: "e3", outcome: "not-attempted" }
    ]);
  });
});

// ── A5.a ─────────────────────────────────────────────────────────────────────

describe("A5.a — no operation outside a validation unit", () => {
  it("refuses a context kept and used after its unit (e.g. in a .then())", () => {
    let kept!: TUnitContext;
    const { root, handles } = boot((ctx) => {
      ctx.create({ name: "cart", channel: { namespace: "cart", commands: { add: () => undefined } } });
      return ctx.create({ name: "view", locals: { go: (_p, c) => { kept = c; } } });
    });
    root.admit(handles, "go", {}, click);
    expect(() => kept.trigger("cart", "add")).toThrow(TransportError);
  });
});

// ── ADR-35 ───────────────────────────────────────────────────────────────────

describe("ADR-35 — synchronous drain, long units reported", () => {
  it("finishes the whole chain before admit returns", () => {
    const log: string[] = [];
    const { root, handles } = boot((ctx) => {
      ctx.create({ name: "b", channel: { namespace: "b", events: ["done"], commands: { step: (_p, c) => { log.push("b"); c.emit("done"); } } } });
      ctx.create({ name: "c", listens: [{ namespace: "b", event: "done", handler: () => log.push("c") }] });
      return ctx.create({ name: "a", locals: { go: (_p, c) => { log.push("a"); c.trigger("b", "step"); } } });
    });
    root.admit(handles, "go", {}, click);
    expect(log).toEqual(["a", "b", "c"]);
  });

  it("reports a unit and a drain beyond the threshold, without changing behaviour", () => {
    let clock = 0;
    const root = new Root({ causalBound: 10, longUnitMs: 50, now: () => clock });
    let view!: TComponentHandle;
    root.start((ctx) => {
      ctx.create({ name: "fast", channel: { namespace: "fast", commands: { go: () => { clock += 10; } } } });
      view = ctx.create({
        name: "slowView",
        locals: { render: (_p, c) => { clock += 80; c.trigger("fast", "go"); } }
      });
    });
    root.admit(view, "render", {}, click);
    const longUnits = root.trace.filter((e) => e.type === "long-unit");
    const longDrains = root.trace.filter((e) => e.type === "long-drain");
    expect(longUnits).toHaveLength(1);
    expect(longUnits[0]).toMatchObject({ owner: "slowView", durationMs: 80 });
    expect(longDrains).toHaveLength(1);
    expect(longDrains[0]).toMatchObject({ units: 2, durationMs: 90 });
  });
});
