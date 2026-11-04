/**
 * Test — engagement reports in the trace (C.3) and technical sink of the trace (O2)
 *
 * @jest-environment jsdom
 */

import { describe, expect, it, jest } from "@jest/globals";
import { Root, reportToConsole, type TComponentHandle, type TTraceEntry } from "@bonsai/kernel";

const click = { kind: "independent" } as const;

type TEffectsEntry = Extract<TTraceEntry, { type: "effects" }>;
const lists = (root: Root): TEffectsEntry[] => root.trace.filter((e): e is TEffectsEntry => e.type === "effects");

/** Startup of a Foundation with two slots, each holding a View that renders: `lost` matches no element. */
function twoSlots(order: readonly ("lost" | "main")[], options: { onTrace?: (entry: TTraceEntry) => void } = {}): Root {
  document.body.innerHTML = `<div id="app"><section data-slot="main"></section></div>`;
  const root = new Root({ causalBound: 10, document, ...options });
  root.start((ctx) => {
    ctx.create({
      name: "foundation",
      init: (c) => {
        const app = c.admitDistributable("#app");
        for (const name of order) {
          c.create(
            {
              name: `${name}Composer`,
              init: (cc) => {
                cc.create(
                  { name: `${name}View`, init: (v) => { v.project(v.resolve(v.designation()!), "render", (el) => { el.append(name); }); } },
                  { part: { resource: cc.resolve(cc.designation()!), portion: "v" } }
                );
              }
            },
            { part: { resource: app, portion: name, host: `[data-slot='${name}']` } }
          );
        }
      }
    });
  });
  return root;
}

describe("6.2 — one trace entry per engagement list, in the real order of engagement", () => {
  it("interleaves the owners as the effects were engaged, instead of grouping them by owner", () => {
    const root = twoSlots(["main", "lost"]);
    expect(lists(root)).toHaveLength(1);
    expect(lists(root)[0]!.report.map((l) => `${l.owner}:${l.label}:${l.outcome}`)).toEqual([
      "foundation:materialize #app/main:engaged",
      "mainComposer:materialize #app/main/v:engaged",
      "mainView:render:engaged",
      "foundation:materialize #app/lost:failed",
      "lostComposer:materialize #app/lost/v:not-attempted",
      "lostView:render:not-attempted"
    ]);
  });

  it("names, for each line not attempted, the failed line that closed its resource", () => {
    const report = lists(twoSlots(["lost", "main"]))[0]!.report;
    const failed = report.findIndex((l) => l.outcome === "failed");
    expect(report[failed]!.label).toBe("materialize #app/lost");
    expect(report.filter((l) => l.outcome === "not-attempted").map((l) => [l.label, l.closedBy])).toEqual([
      ["materialize #app/lost/v", failed],
      ["render", failed]
    ]);
    expect(report.filter((l) => l.outcome !== "not-attempted").every((l) => l.closedBy === undefined)).toBe(true);
    expect(report.every((l) => l.context !== undefined)).toBe(true);
  });

  it("admits to each owner declaring $effects its own lines only, and marks them admitted", () => {
    const received: unknown[] = [];
    let handle!: TComponentHandle;
    const root = new Root({ causalBound: 10 });
    root.start((ctx) => {
      handle = ctx.create({
        name: "client",
        locals: {
          go: (_p, c) => {
            c.prepareEffect("send", () => { throw new Error("refused"); }, { target: "request" });
            c.create({ name: "silent", init: (s) => { s.prepareEffect("log", () => undefined); } });
          },
          $effects: (p) => { received.push(p); }
        }
      });
    });
    root.admit(handle, "go", {}, click);
    expect(received).toEqual([[{ label: "send", outcome: "failed" }]]);
    const report = lists(root)[0]!.report;
    expect(report.map((l) => [l.owner, l.label, l.admitted])).toEqual([
      ["client", "send", true],
      ["silent", "log", false]
    ]);
  });
});

describe("6.1 — technical sink of the trace (O2)", () => {
  it("receives every trace entry as it is written, in order", () => {
    const seen: TTraceEntry[] = [];
    const root = twoSlots(["lost", "main"], { onTrace: (entry) => seen.push(entry) });
    expect(seen).toEqual([...root.trace]);
    expect(seen.some((e) => e.type === "effects")).toBe(true);
  });

  it("a sink that throws changes nothing in the model", () => {
    const root = twoSlots(["lost", "main"], { onTrace: () => { throw new Error("sink down"); } });
    expect(document.querySelector("section")!.textContent).toBe("main");
    expect(root.trace.filter((e) => e.type === "unit-failed")).toEqual([]);
  });

  describe("reportToConsole", () => {
    const output = () => ({ error: jest.fn(), warn: jest.fn() });

    it("warns about a failed effect that no $effects receives, with the effects it left not attempted", () => {
      const out = output();
      for (const entry of twoSlots(["lost", "main"]).trace) reportToConsole(entry, out);
      expect(out.warn).toHaveBeenCalledTimes(1);
      expect(out.warn.mock.calls[0]![0]).toBe(
        `[Bonsai] effect "materialize #app/lost" of "foundation" failed (C.3); not attempted because of it: "materialize #app/lost/v" (lostComposer), "render" (lostView)`
      );
      expect(String(out.warn.mock.calls[0]![1])).toMatch(/matches 0 elements/);
      expect(out.error).not.toHaveBeenCalled();
    });

    it("stays silent about a failed effect admitted in an $effects result", () => {
      const out = output();
      const root = new Root({ causalBound: 10, onTrace: (e) => reportToConsole(e, out) });
      let handle!: TComponentHandle;
      root.start((ctx) => {
        handle = ctx.create({
          name: "client",
          locals: { go: (_p, c) => { c.prepareEffect("send", () => { throw new Error("refused"); }); }, $effects: () => undefined }
        });
      });
      root.admit(handle, "go", {}, click);
      expect(out.warn).not.toHaveBeenCalled();
    });

    it("reports a failed treatment after startup, not a failed startup, which start() throws", () => {
      const out = output();
      const root = new Root({ causalBound: 10, onTrace: (e) => reportToConsole(e, out) });
      let handle!: TComponentHandle;
      root.start((ctx) => {
        handle = ctx.create({ name: "view", locals: { go: () => { throw new Error("boom"); } } });
      });
      root.admit(handle, "go", {}, click);
      expect(out.error).toHaveBeenCalledTimes(1);
      expect(out.error.mock.calls[0]![0]).toBe(`[Bonsai] a treatment of "view" failed and was rolled back (G7)`);

      const failing = new Root({ causalBound: 10, onTrace: (e) => reportToConsole(e, out) });
      expect(() => failing.start(() => { throw new Error("startup"); })).toThrow();
      expect(out.error).toHaveBeenCalledTimes(1);
    });

    it("names no effect not attempted when the failure closed nothing else", () => {
      const out = output();
      const root = new Root({ causalBound: 10, onTrace: (e) => reportToConsole(e, out) });
      let handle!: TComponentHandle;
      root.start((ctx) => {
        handle = ctx.create({ name: "client", locals: { go: (_p, c) => { c.prepareEffect("send", () => { throw new Error("refused"); }); } } });
      });
      root.admit(handle, "go", {}, click);
      expect(out.warn.mock.calls.map((c) => c[0])).toEqual([`[Bonsai] effect "send" of "client" failed (C.3)`]);
    });

    it("stays silent about a delivery abandoned because its recipient is gone (C.6)", () => {
      const out = output();
      const root = new Root({ causalBound: 10, onTrace: (e) => reportToConsole(e, out) });
      let src!: TComponentHandle;
      let sub!: TComponentHandle;
      root.start((ctx) => {
        src = ctx.create({
          name: "src",
          channel: { namespace: "src", events: ["e"] },
          init: (c) => { sub = c.create({ name: "sub", listens: [{ namespace: "src", event: "e", handler: () => undefined }] }); },
          locals: { go: (_p, c) => { c.emit("e"); c.destroy(sub); } }
        });
      });
      root.admit(src, "go", {}, click);
      expect(root.trace.some((e) => e.type === "delivery-abandoned")).toBe(true);
      expect(out.warn).not.toHaveBeenCalled();
      expect(out.error).not.toHaveBeenCalled();
    });

    it("warns about a message abandoned at the causal bound (D9)", () => {
      const out = output();
      reportToConsole({ type: "admission-abandoned", reason: "causal bound", name: "$effects" }, out);
      reportToConsole({ type: "admission-abandoned", reason: "occurrence no longer alive", name: "late" }, out);
      expect(out.warn.mock.calls.map((c) => c[0])).toEqual([`[Bonsai] "$effects" abandoned: causal bound reached (D9)`]);
    });
  });
});
