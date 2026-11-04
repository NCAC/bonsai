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
} from "../../../packages/kernel/src/kernel";

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

describe("G5, I29 — synchronous Queries towards a ready, inactive target", () => {
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

describe("G7, I55 — a failing unit is rolled back", () => {
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

  it("I65 — reports a Query error in the trace with the author's causal context, outside the transport; the unit still fails", () => {
    let author!: TCausalContext;
    const delivered: string[] = [];
    const { root, handles } = boot((ctx) => {
      ctx.create({ name: "broken", channel: { namespace: "broken", queries: { q: () => { throw new Error("boom"); } } } });
      ctx.create({ name: "spy", listens: [{ namespace: "author", event: "done", handler: () => { delivered.push("done"); } }] });
      return ctx.create({
        name: "author",
        channel: { namespace: "author", events: ["done"] },
        locals: { go: (_p, c) => { author = c.cause; c.emit("done"); c.query("broken", "q"); } }
      });
    });
    const before = root.trace.length;
    root.admit(handles, "go", {}, click);
    const entries = root.trace.slice(before);
    const failure = entries.find((e) => e.type === "unit-failed") as Extract<(typeof entries)[number], { type: "unit-failed" }>;
    expect(failure.context).toBe(author);
    expect((failure.error as Error).message).toBe("boom");
    expect(delivered).toEqual([]);                                   // the report is not a message
    expect(entries.filter((e) => e.type === "delivered").map((e) => e.type === "delivered" && e.name)).toEqual(["go"]);
  });

  it("I27 — a Command is refused by the failure of its handler; an Event is a fact a subscriber cannot refuse", () => {
    let total = 0;
    const heard: string[] = [];
    const { root } = boot((ctx) => {
      ctx.create({
        name: "cart",
        channel: {
          namespace: "cart",
          events: ["added"],
          commands: {
            add: (p, c) => {
              const qty = (p as { qty: number }).qty;
              if (qty <= 0) throw new Error("refused: quantity must be positive");
              total += qty;
              c.journal(() => { total -= qty; });
              c.emit("added");
            }
          }
        }
      });
      for (const name of ["failing", "other"]) {
        ctx.create({ name, listens: [{ namespace: "cart", event: "added", handler: () => { heard.push(name); if (name === "failing") throw new Error("cannot refuse a fact"); } }] });
      }
      ctx.trigger("cart", "add", { qty: 0 });
      ctx.trigger("cart", "add", { qty: 2 });
    });
    expect(total).toBe(2);                                  // the refused Command left nothing
    expect(heard).toEqual(["failing", "other"]);            // only the accepted one produced the Event
    expect(failures(root).map((e) => (e as Error).message)).toEqual(["refused: quantity must be positive", "cannot refuse a fact"]);
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

  it("I19 — refuses a destruction by a component that is not the parent (A1.b)", () => {
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

describe("G8, I7, I8 — causal contexts created by the kernel", () => {
  it("qualifies startup as an origin of its own: a startup message is its child", () => {
    let start!: TCausalContext;
    let delivered!: TCausalContext;
    boot((ctx) => {
      start = ctx.cause;
      ctx.create({ name: "a", channel: { namespace: "a", commands: { hello: (_p, c) => { delivered = c.cause; } } } });
      ctx.trigger("a", "hello");
    });
    expect([start.originKind, start.parentId, start.depth]).toEqual(["startup", null, 0]);
    expect([delivered.parentId, delivered.originId, delivered.depth]).toEqual([start.id, start.id, 1]);
    expect(Object.isFrozen(delivered)).toBe(true);                 // the application cannot rewrite it
  });

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

describe("D9, I9 — causal depth bound", () => {
  it("refuses an Event beyond the bound before reserving any branch", () => {
    const reached: string[] = [];
    const { root, handles } = boot((ctx) => {
      const cart = ctx.create({ name: "cart", channel: { namespace: "cart", events: ["added"] }, locals: { go: (_p, c) => { c.emit("added"); } } });
      for (const name of ["s1", "s2"]) {
        ctx.create({ name, listens: [{ namespace: "cart", event: "added", handler: () => { reached.push(name); } }] });
      }
      return cart;
    }, 0);
    root.admit(handles, "go", {}, click);
    expect(reached).toEqual([]);
    expect((failures(root)[0] as TransportError).code).toBe("CAUSAL_BOUND");
  });

  it("gives every branch of an Event the same depth: the fan-out does not deepen the chain", () => {
    const depths: number[] = [];
    const { root, handles } = boot((ctx) => {
      const cart = ctx.create({ name: "cart", channel: { namespace: "cart", events: ["added"] }, locals: { go: (_p, c) => { c.emit("added"); } } });
      for (const name of ["s1", "s2", "s3"]) {
        ctx.create({ name, listens: [{ namespace: "cart", event: "added", handler: (_p, c) => { depths.push(c.cause.depth); } }] });
      }
      return cart;
    }, 1);
    root.admit(handles, "go", {}, click);
    expect(depths).toEqual([1, 1, 1]);
  });

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

  it("starts once: a started or abandoned root cannot start again", () => {
    const { root } = boot(() => undefined);
    expect(() => root.start(() => undefined)).toThrow(/root cannot start from state "started"/);
    const abandoned = new Root({ causalBound: 10 });
    expect(() => abandoned.start(() => { throw new Error("init failed"); })).toThrow(StartupError);
    expect(() => abandoned.start(() => undefined)).toThrow(/root cannot start from state "abandoned"/);
  });

  it("refuses two living Channels of one namespace in a root", () => {
    const root = new Root({ causalBound: 10 });
    let cause: unknown;
    try {
      root.start((ctx) => {
        ctx.create({ name: "a", channel: { namespace: "cart" } });
        ctx.create({ name: "b", channel: { namespace: "cart" } });
      });
    } catch (error) {
      cause = (error as StartupError).cause;
    }
    expect((cause as TransportError).code).toBe("DUPLICATE_NAMESPACE");
  });

  it("refuses the admission of a local message the component does not declare", () => {
    const { root, handles } = boot((ctx) => ctx.create({ name: "a", locals: { go: () => undefined } }));
    expect(() => root.admit(handles, "missing", {}, click)).toThrow(/local "missing" not declared by a/);
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

  it("closes the resource of a synchronous failure: later effects on the same resource are not attempted", () => {
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

  it("keeps engaging effects on other resources: each named target, such as one request, is closed alone", () => {
    const order: string[] = [];
    let report: unknown = null;
    const { root, handles } = boot((ctx) =>
      ctx.create({
        name: "client",
        locals: {
          go: (_p, c) => {
            c.prepareEffect("request 1", () => { throw new Error("refused"); }, { target: "request-1" });
            c.prepareEffect("request 1 again", () => order.push("request 1 again"), { target: "request-1" });
            c.prepareEffect("request 2", () => order.push("request 2"), { target: "request-2" });
            c.prepareEffect("unnamed", () => order.push("unnamed"));
          },
          $effects: (p) => { report = p; }
        }
      })
    );
    root.admit(handles, "go", {}, click);
    expect(order).toEqual(["request 2", "unnamed"]);
    expect(report).toEqual([
      { label: "request 1", outcome: "failed" },
      { label: "request 1 again", outcome: "not-attempted" },
      { label: "request 2", outcome: "engaged" },
      { label: "unnamed", outcome: "engaged" }
    ]);
  });
});

// ── A5.a ─────────────────────────────────────────────────────────────────────

describe("C.3 and D9 — the engagement report is bounded too", () => {
  it("abandons the $effects admission beyond the causal bound, and keeps the line in the trace", () => {
    const received: unknown[] = [];
    const { root, handles } = boot((ctx) =>
      ctx.create({
        name: "client",
        locals: {
          go: (_p, c) => { c.prepareEffect("send", () => undefined); },
          $effects: (p) => { received.push(p); }
        }
      }), 0);
    root.admit(handles, "go", {}, click);
    expect(received).toEqual([]);
    expect(root.trace.filter((e) => e.type === "admission-abandoned")).toEqual([{ type: "admission-abandoned", reason: "causal bound", name: "$effects" }]);
    const report = root.trace.find((e) => e.type === "effects") as Extract<(typeof root.trace)[number], { type: "effects" }>;
    expect(report.report.map((l) => [l.label, l.outcome, l.admitted])).toEqual([["send", "engaged", false]]);
  });
});

describe("Refusals of the unit context: the author's unit fails (G7)", () => {
  const codes = (root: Root): string[] => failures(root).map((e) => (e as TransportError).code);

  it("a Command to a namespace that has no Channel in this root (UNKNOWN_TARGET)", () => {
    const { root, handles } = boot((ctx) => ctx.create({ name: "a", locals: { go: (_p, c) => c.trigger("nowhere", "hit") } }));
    root.admit(handles, "go", {}, click);
    expect(codes(root)).toEqual(["UNKNOWN_TARGET"]);
  });

  it("an emit without a Channel of one's own, or of an Event its Channel does not declare (A3.e, D16)", () => {
    const { root, handles } = boot((ctx) => ({
      bare: ctx.create({ name: "bare", locals: { go: (_p, c) => c.emit("e") } }),
      silent: ctx.create({ name: "silent", channel: { namespace: "silent" }, locals: { go: (_p, c) => c.emit("e") } })
    }));
    root.admit(handles.bare, "go", {}, click);
    root.admit(handles.silent, "go", {}, click);
    expect(codes(root)).toEqual(["NOT_OWNER", "UNDECLARED_MESSAGE"]);
  });

  it("a local message the component does not declare, sent from a unit", () => {
    const { root, handles } = boot((ctx) => ctx.create({ name: "a", locals: { go: (_p, c) => c.local("missing") } }));
    root.admit(handles, "go", {}, click);
    expect(codes(root)).toEqual(["UNDECLARED_MESSAGE"]);
  });

  it("projecting on, simulating on or reading the attributions of a resource one does not own (A1.b)", () => {
    const { root, handles } = boot((ctx) => {
      let child!: TComponentHandle;
      ctx.create({
        name: "parent",
        init: (c) => {
          const resource = c.admitDistributable("#app");
          child = c.create({
            name: "child",
            locals: {
              project: (_p, cc) => { cc.project(resource, "write", () => undefined); },
              simulate: (_p, cc) => { cc.simulate(resource, "click"); },
              attributed: (_p, cc) => { cc.attributed(resource); }
            }
          });
        }
      });
      return () => child;
    });
    for (const local of ["project", "simulate", "attributed"]) root.admit(handles(), local, {}, click);
    expect(codes(root)).toEqual(["NOT_OWNER", "NOT_OWNER", "NOT_OWNER"]);
  });

  it("reading or mutating a state without an Entity; in a Query handler too (16.2)", () => {
    const { root, handles } = boot((ctx) => ({
      bare: ctx.create({
        name: "bare",
        channel: { namespace: "bare", queries: { v: (_p, c) => c.state() } },
        locals: { read: (_p, c) => { c.state(); }, mutate: (_p, c) => { c.mutate(() => undefined); } }
      }),
      asker: ctx.create({ name: "asker", locals: { ask: (_p, c) => { c.query("bare", "v"); } } })
    }));
    root.admit(handles.bare, "read", {}, click);
    root.admit(handles.bare, "mutate", {}, click);
    root.admit(handles.asker, "ask", {}, click);
    expect(codes(root)).toEqual(["NOT_OWNER", "NOT_OWNER", "READ_ONLY"]);
    expect(String(failures(root)[2])).toMatch(/state without Entity/);
  });

  it("a Query beyond the causal bound (D9)", () => {
    const { root, handles } = boot((ctx) => ({
      asker: ctx.create({ name: "asker", locals: { ask: (_p, c) => { c.query("answer", "v"); } } }),
      answer: ctx.create({ name: "answer", channel: { namespace: "answer", queries: { v: () => 1 } } })
    }), 0);
    root.admit(handles.asker, "ask", {}, click);
    expect(codes(root)).toEqual(["CAUSAL_BOUND"]);
  });
});

describe("ADR-04, I54 — kernel errors carry the context where they were born", () => {
  it("a refusal in a unit carries the unit's context, the one in the trace", () => {
    let cause!: TCausalContext;
    const { root, handles } = boot((ctx) => ctx.create({ name: "a", locals: { go: (_p, c) => { cause = c.cause; c.trigger("nowhere", "hit"); } } }));
    root.admit(handles, "go", {}, click);
    const error = failures(root)[0] as TransportError;
    expect(error.context).toBe(cause);
    expect(Object.isFrozen(error.context)).toBe(true);
  });

  it("a refusal born while answering a Query carries the Query's context, child of its author", () => {
    let author!: TCausalContext;
    const { root, handles } = boot((ctx) => ({
      bare: ctx.create({ name: "bare", channel: { namespace: "bare", queries: { v: (_p, c) => c.state() } } }),
      asker: ctx.create({ name: "asker", locals: { ask: (_p, c) => { author = c.cause; c.query("bare", "v"); } } })
    }));
    root.admit(handles.asker, "ask", {}, click);
    const error = failures(root)[0] as TransportError;
    expect(error.code).toBe("READ_ONLY");
    expect(error.context!.parentId).toBe(author.id);
  });

  it("an intercepted Query failure: UNRECOVERABLE and its original refusal are both dated", () => {
    let author!: TCausalContext;
    const { root, handles } = boot((ctx) => ({
      answer: ctx.create({ name: "answer", channel: { namespace: "answer", queries: { v: () => 1 } } }),
      asker: ctx.create({
        name: "asker",
        locals: { ask: (_p, c) => { author = c.cause; try { c.query("answer", "missing"); } catch { /* intercepted */ } } }
      })
    }));
    root.admit(handles.asker, "ask", {}, click);
    const error = failures(root)[0] as TransportError;
    expect(error.code).toBe("UNRECOVERABLE");
    expect(error.context).toBe(author);
    expect((error.cause as TransportError).context).toBe(author);   // refused before reaching the target
  });

  it("an error raised by application code is left untouched; its context is in the trace", () => {
    const thrown = new Error("application failure");
    const { root, handles } = boot((ctx) => ctx.create({ name: "a", locals: { go: () => { throw thrown; } } }));
    root.admit(handles, "go", {}, click);
    expect(failures(root)[0]).toBe(thrown);
    expect("context" in thrown).toBe(false);
    const entry = root.trace.find((e) => e.type === "unit-failed");
    expect(entry && entry.type === "unit-failed" && entry.context.originKind).toBe("spontaneous");
  });

  it("a refusal outside any unit carries no context", () => {
    const { root, handles } = boot((ctx) => ctx.create({ name: "a" }));
    let error: unknown;
    try { root.admit(handles, "undeclared", {}, click); } catch (e) { error = e; }
    expect((error as TransportError).code).toBe("UNDECLARED_MESSAGE");
    expect((error as TransportError).context).toBeUndefined();
  });
});

describe("C.6 — a delivery whose target is gone is abandoned, not run", () => {
  it("a Command whose Channel was destroyed before its delivery", () => {
    let hits = 0;
    let child!: TComponentHandle;
    const { root, handles } = boot((ctx) =>
      ctx.create({
        name: "parent",
        init: (c) => { child = c.create({ name: "child", channel: { namespace: "child", commands: { hit: () => { hits++; } } } }); },
        locals: {
          go: (_p, c) => {
            c.trigger("child", "hit");
            c.destroy(child);
          }
        }
      })
    );
    root.admit(handles, "go", {}, click);
    expect(hits).toBe(0);
    expect(root.trace.filter((e) => e.type === "delivery-abandoned").map((e) => (e as { reason: string }).reason)).toEqual(["channel destroyed"]);
    expect(failures(root)).toEqual([]);
  });

  it("a local message whose recipient was destroyed by a delivery that came before it", () => {
    let next = 0;
    let child!: TComponentHandle;
    const { root } = boot((ctx) =>
      ctx.create({
        name: "parent",
        channel: { namespace: "parent", commands: { kill: (_p, c) => c.destroy(child) } },
        init: (c) => {
          child = c.create({
            name: "child",
            locals: {
              go: (_p, cc) => { cc.trigger("parent", "kill"); cc.local("next"); },
              next: () => { next++; }
            }
          });
        }
      })
    );
    root.admit(child, "go", {}, click);
    expect(next).toBe(0);
    expect(root.trace.filter((e) => e.type === "delivery-abandoned").map((e) => (e as { reason: string }).reason)).toEqual(["recipient destroyed"]);
  });
});

describe("A5.a, I66 — no operation outside a validation unit", () => {
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
