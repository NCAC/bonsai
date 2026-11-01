/**
 * @jest-environment jsdom
 */

/**
 * Discriminating tests of the kernel prototype, lot M5: admission of host
 * events in parts (D10, A5.d), qualification by the closed world (C.4), and
 * the right of the user interface to command according to the trigger (D18).
 */

import { beforeEach, describe, expect, it } from "@jest/globals";
import {
  Root,
  TransportError,
  type TComponentHandle,
  type TComponentSpec,
  type TCorrelationToken,
  type TResourceHandle
} from "../../../packages/event/src/kernel";

beforeEach(() => {
  document.body.innerHTML = `<div id="app"></div>`;
});

function failures(root: Root): TransportError[] {
  return root.trace.filter((e) => e.type === "unit-failed").map((e) => (e as { error: unknown }).error as TransportError);
}

/**
 * Foundation → Composer → outer View (part "outer") → inner Composer →
 * inner View (part "inner" inside the outer part). A cart Feature counts
 * the Commands it accepts and emits `added`.
 */
function setup() {
  const log: string[] = [];
  let added = 0;
  const tokens: Record<string, TCorrelationToken> = {};
  const h: Record<string, TComponentHandle> = {};
  const parts: Record<string, TResourceHandle> = {};

  const view = (name: string, extra: Partial<TComponentSpec> = {}): TComponentSpec => ({
    name,
    ui: true,
    dom: { click: "click" },
    listens: [{ namespace: "cart", event: "added", handler: (_p, c) => {
      log.push(`${name} sees added`);
      if (name === "outer") c.trigger("cart", "add");   // refused: an Event grants no right (D18)
    } }],
    init: (c) => { parts[name] = c.resolve(c.designation()!); },
    locals: {
      click: (_p, c) => { log.push(`${name} admits click`); c.query("cart", "count"); c.trigger("cart", "add"); },
      relay: (_p, c) => { c.trigger("cart", "add"); },
      launder: (_p, c) => { c.simulate(parts[name]!, "click"); },
      arm: (_p, c) => { tokens[name] = c.correlate(); },
      result: (_p, c) => { c.trigger("cart", "add"); }
    },
    ...extra
  });

  const root = new Root({ causalBound: 30, document });
  root.start((ctx) => {
    ctx.create({
      name: "cart",
      channel: {
        namespace: "cart",
        events: ["added"],
        queries: { count: () => added },
        commands: { add: (_p, c) => { added++; c.journal(() => { added--; }); c.emit("added"); } }
      }
    });
    ctx.create({
      name: "foundation",
      init: (c) => {
        const body = c.admitDistributable("#app");
        c.create({
          name: "composer",
          init: (cc) => {
            const slot = cc.resolve(cc.designation()!);
            h.outer = cc.create(view("outer", {
              init: (v) => {
                parts.outer = v.resolve(v.designation()!);
                v.create({
                  name: "innerComposer",
                  init: (ic) => {
                    const innerSlot = ic.resolve(ic.designation()!);
                    h.inner = ic.create(view("inner"), { part: { resource: innerSlot, portion: "inner" } });
                  }
                }, { part: { resource: parts.outer, portion: "slot" } });
              }
            }), { part: { resource: slot, portion: "outer" } });
          }
        }, { part: { resource: body, portion: "main" } });
      }
    });
  });
  const element = (portion: string) => document.querySelector(`[data-bonsai-part="${portion}"]`) as HTMLElement;
  return { root, log, h, tokens, element, count: () => added };
}

describe("M5 — admission in the innermost part (D10, A5.d)", () => {
  it("admits a user click once, by the View owning the innermost part; the click may command", () => {
    const { log, element, count } = setup();
    element("inner").click();
    expect(log.filter((l) => l.includes("admits"))).toEqual(["inner admits click"]);
    expect(count()).toBe(1);
  });

  it("admits a click in the outer part, outside the slot, by the outer View only", () => {
    const { log, element, count } = setup();
    element("outer").click();
    expect(log.filter((l) => l.includes("admits"))).toEqual(["outer admits click"]);
    expect(count()).toBe(1);
  });
});

describe("M5 — D18: the right to command follows the trigger", () => {
  it("refuses a Command in reaction to an Event", () => {
    const { root, element, count } = setup();
    element("inner").click();                              // inner commands → cart emits added
    const refused = root.trace.find((e) => e.type === "unit-failed");
    expect(refused && refused.type === "unit-failed" && refused.owner).toBe("outer");
    expect((failures(root)[0]!).code).toBe("NOT_AUTHORIZED");
    expect(count()).toBe(1);                               // the refused Command never ran
  });

  it("refuses a Command relayed by a local message produced in an Event reaction", () => {
    const root = new Root({ causalBound: 10 });
    let count = 0;
    let view!: TComponentHandle;
    root.start((ctx) => {
      ctx.create({ name: "cart", channel: { namespace: "cart", events: ["added"], commands: { add: (_p, c) => { count++; c.emit("added"); } } } });
      view = ctx.create({
        name: "view",
        ui: true,
        listens: [{ namespace: "cart", event: "added", handler: (_p, c) => { if (count === 1) c.local("relay"); } }],
        locals: { click: (_p, c) => c.trigger("cart", "add"), relay: (_p, c) => c.trigger("cart", "add") }
      });
    });
    root.admit(view, "click", {}, { kind: "independent" });
    expect(count).toBe(1);
    expect(failures(root)[0]!.code).toBe("NOT_AUTHORIZED");
  });

  it("refuses a Command on an observation of unknown antecedent", () => {
    const { root, h, count } = setup();
    root.admit(h.inner!, "relay", {}, { kind: "unknown" });
    expect(count()).toBe(0);
    expect(failures(root)[0]!.code).toBe("NOT_AUTHORIZED");
  });

  it("keeps the right of an authorized reaction for its correlated result, not for one armed in an Event reaction", () => {
    const root = new Root({ causalBound: 20 });
    let count = 0;
    let view!: TComponentHandle;
    const tokens: TCorrelationToken[] = [];
    root.start((ctx) => {
      ctx.create({ name: "cart", channel: { namespace: "cart", events: ["added"], commands: { add: (_p, c) => { count++; c.emit("added"); } } } });
      view = ctx.create({
        name: "view",
        ui: true,
        listens: [{ namespace: "cart", event: "added", handler: (_p, c) => { tokens.push(c.correlate()); } }],
        locals: { click: (_p, c) => { tokens.push(c.correlate()); }, result: (_p, c) => c.trigger("cart", "add") }
      });
    });
    root.admit(view, "click", {}, { kind: "independent" });
    root.admit(view, "result", {}, { kind: "correlated", token: tokens[0]! });   // continuation of the click
    expect(count).toBe(1);
    root.admit(view, "result", {}, { kind: "correlated", token: tokens[1]! });   // armed while reacting to `added`
    expect(count).toBe(1);
    expect(failures(root)[0]!.code).toBe("NOT_AUTHORIZED");
  });
});

describe("M5 — closed world (C.4): a simulated occurrence is correlated, never independent", () => {
  it("does not launder an Event reaction through a simulated click", () => {
    const root = new Root({ causalBound: 20, document });
    let count = 0;
    let view!: TComponentHandle;
    let part!: TResourceHandle;
    root.start((ctx) => {
      ctx.create({ name: "cart", channel: { namespace: "cart", events: ["added"], commands: { add: (_p, c) => { count++; c.emit("added"); } } } });
      ctx.create({
        name: "foundation",
        init: (c) => {
          const body = c.admitDistributable("#app");
          view = c.create({
            name: "view",
            ui: true,
            dom: { click: "click" },
            init: (v) => { part = v.resolve(v.designation()!); },
            listens: [{ namespace: "cart", event: "added", handler: (_p, v) => { if (count === 1) v.simulate(part, "click"); } }],
            locals: { click: (_p, v) => v.trigger("cart", "add"), go: (_p, v) => v.simulate(part, "click") }
          }, { part: { resource: body, portion: "view" } });
        }
      });
    });
    (document.querySelector('[data-bonsai-part="view"]') as HTMLElement).click();   // user click: count 1
    expect(count).toBe(1);
    // the reaction to `added` simulated a click: correlated to an Event reaction → refused
    expect(failures(root)[0]!.code).toBe("NOT_AUTHORIZED");
    const clicks = root.trace.filter((e) => e.type === "delivered" && e.name === "click").map((e) => e.type === "delivered" && e.context.originKind);
    expect(clicks).toEqual(["spontaneous", "spontaneous"]);  // second is a continuation of the first origin, not a new one
    const second = root.trace.filter((e) => e.type === "delivered" && e.name === "click")[1]!;
    expect(second.type === "delivered" && second.context.parentId).not.toBeNull();
    void view;
  });

  it("accepts a simulated click inside an authorized reaction, as its continuation", () => {
    const { root, h, count } = setup();
    root.admit(h.inner!, "launder", {}, { kind: "independent" });   // an authorized reaction simulates a click
    expect(count()).toBe(1);                                        // the simulated click commanded
    // the only refusal is the outer View's reaction to `added`
    expect(root.trace.filter((e) => e.type === "unit-failed").map((e) => e.type === "unit-failed" && e.owner)).toEqual(["outer"]);
  });

  it("cannot tell an uncoordinated script from a user (documented limit, B.2)", () => {
    const { element, count } = setup();
    element("inner").dispatchEvent(new window.Event("click", { bubbles: true }));  // raw call, outside Bonsai
    expect(count()).toBe(1);
  });
});
