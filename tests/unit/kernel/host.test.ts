/**
 * @jest-environment jsdom
 */

/**
 * Discriminating tests of the kernel prototype, lot M4: materialization of
 * parts in a host document after validation, projection effects, physical
 * cleanup, results of effects routed to their own occurrence.
 */

import { beforeEach, describe, expect, it } from "@jest/globals";
import {
  Root,
  StartupError,
  type TComponentHandle,
  type TComponentSpec,
  type TResourceHandle
} from "../../../packages/event/src/kernel";

const click = { kind: "independent" } as const;

function parts(selector = "#app"): string {
  const describe = (el: Element): string => {
    const children = Array.from(el.children).map(describe).join("");
    const text = el.children.length === 0 ? el.textContent ?? "" : "";
    return `<${el.getAttribute("data-bonsai-part") ?? el.id}${text ? `:${text}` : ""}>${children}`;
  };
  return describe(document.querySelector(selector)!);
}

beforeEach(() => {
  document.body.innerHTML = `<div id="app"></div>`;
});

function setup() {
  const reports: Record<string, unknown[]> = {};
  const seenDuringInit: number[] = [];
  const h: { composer?: TComponentHandle; a?: TComponentHandle } = {};
  let slot!: TResourceHandle;

  const view = (name: string, text: string, failing = false): TComponentSpec => ({
    name,
    entity: { name, initial: { label: text } },
    channel: { namespace: name, queries: { label: (_p, c) => c.state<{ label: string }>().label } },
    init: (c) => {
      seenDuringInit.push(document.querySelectorAll("[data-bonsai-part]").length);
      const part = c.resolve(c.designation()!);
      c.project(part, "render", (el) => { el.textContent = text; });
    },
    locals: {
      rename: (p, c) => {
        c.mutate<{ label: string }>((d) => { d.label = p as string; });
        const part = c.resolve(c.designation()!);
        c.project(part, "render", (el) => {
          if (failing) throw new Error("host refused the write");
          el.textContent = p as string;
        });
      },
      $effects: (p) => { (reports[name] ??= []).push(p); }
    }
  });

  const root = new Root({ causalBound: 20, document });
  let reader!: TComponentHandle;
  root.start((ctx) => {
    ctx.create({
      name: "foundation",
      init: (c) => {
        const body = c.admitDistributable("#app");
        h.composer = c.create({
          name: "composer",
          init: (cc) => {
            slot = cc.resolve(cc.designation()!);
            h.a = cc.create(view("viewA", "A", true), { part: { resource: slot, portion: "a" } });
            cc.create(view("viewB", "B"), { part: { resource: slot, portion: "b" } });
          },
          locals: {
            swap: (_p, cc) => { cc.destroy(h.a!); h.a = cc.create(view("viewA2", "A2"), { part: { resource: slot, portion: "a", before: "b" } }); },
            swapThenFail: (_p, cc) => { cc.destroy(h.a!); cc.create(view("viewX", "X"), { part: { resource: slot, portion: "x" } }); throw new Error("cancel"); },
            $effects: (p) => { (reports.composer ??= []).push(p); }
          }
        }, { part: { resource: body, portion: "main" } });
      }
    });
    reader = ctx.create({ name: "reader", locals: { read: (p, c) => { (reports.read ??= []).push(c.query(p as string, "label")); } } });
  });
  return { root, reports, seenDuringInit, h, reader };
}

describe("M4 — materialization after validation (C.3, 9.10)", () => {
  it("creates no element during the unit, then materializes parts in attribution order", () => {
    const { seenDuringInit } = setup();
    expect(seenDuringInit).toEqual([0, 0]);
    expect(parts()).toBe("<app><main><a:A><b:B>");
  });

  it("refuses to start when the host element does not exist (D3)", () => {
    document.body.innerHTML = "";
    expect(() => setup()).toThrow(StartupError);
  });
});

describe("M4 — destruction and cancellation in the host", () => {
  it("removes the element after a validated destruction and keeps the order on replacement", () => {
    const { root, h } = setup();
    root.admit(h.composer!, "swap", {}, click);
    expect(parts()).toBe("<app><main><a:A2><b:B>");
  });

  it("changes nothing in the host when the unit is cancelled", () => {
    const { root, h } = setup();
    root.admit(h.composer!, "swapThenFail", {}, click);
    expect(parts()).toBe("<app><main><a:A><b:B>");
  });
});

describe("M4 — results of effects (C.3)", () => {
  it("routes each report to its own occurrence: the child's projection is not reported to its creator", () => {
    const { reports } = setup();
    // startup effects: the Composer materialized two parts, each View projected once
    expect(reports.composer).toEqual([[
      { label: "materialize #app/main/a", outcome: "engaged" },
      { label: "materialize #app/main/b", outcome: "engaged" }
    ]]);
    expect(reports.viewA).toEqual([[{ label: "render", outcome: "engaged" }]]);
    expect(reports.viewB).toEqual([[{ label: "render", outcome: "engaged" }]]);
  });

  it("does not revoke the validated state when the host refuses an effect", () => {
    const { root, reports, h, reader } = setup();
    root.admit(h.a!, "rename", "new label", click);
    expect(reports.viewA!.at(-1)).toEqual([{ label: "render", outcome: "failed" }]);
    expect(parts()).toBe("<app><main><a:A><b:B>");          // the host still shows the old text
    root.admit(reader, "read", "viewA", click);
    expect(reports.read).toEqual(["new label"]);             // the Entity keeps its validated value
  });
});
