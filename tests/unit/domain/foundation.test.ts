/**
 * Test — Foundation on the kernel (lot M6.2)
 *
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { Application } from "@bonsai/application";
import { resetDOM } from "../../helpers/dom-setup";
import { Composer, type TComposerContract, type TComposition } from "@bonsai/composer";
import { Foundation } from "@bonsai/foundation";
import { View, type TViewContract } from "@bonsai/view";

type TNo = TViewContract<Record<string, never>, Record<string, never>>;
class Leaf extends View<TNo> {
  get features() { return {}; }
  get uiEvents() { return {}; }
  get uiElements() { return {}; }
  get template() { return "leaf"; }
}
type TC = TComposerContract<Record<string, never>, { leaf: typeof Leaf }>;
class LeafComposer extends Composer<TC> {
  get features() { return {}; }
  get views() { return { leaf: Leaf }; }
  resolve(): TComposition<TC> { return [{ view: "leaf", key: "l" }]; }
}

const foundationOf = (slots: Record<string, string>) =>
  class Page extends Foundation {
    get composers() {
      return Object.fromEntries(Object.entries(slots).map(([key, slot]) => [key, { slot, composer: LeafComposer }])) as never;
    }
  };

/** A slot that cannot be adopted is an effect that fails after validation (C.3): reported in the trace. */
const failedEffects = (app: Application): string[] =>
  app.root!.trace.flatMap((t) =>
    t.type === "effects" ? t.report.filter((r) => r.outcome === "failed").map((r) => String((r.error as Error).message)) : []
  );

describe("Foundation on the kernel", () => {
  beforeEach(() => {
    resetDOM();
    document.body.innerHTML = `<header id="h"></header><main id="m"></main>`;
  });

  it("I33 — fills each declared slot through its Composer, inside the anchor (default body)", () => {
    const app = new Application({ foundation: foundationOf({ head: "#h", main: "#m" }), document });
    app.start();
    expect(document.querySelector("#h")!.textContent).toBe("leaf");
    expect(document.querySelector("#m")!.textContent).toBe("leaf");
    expect(app.root!.trace.filter((t) => t.type === "unit-failed")).toEqual([]);
  });

  it("I67 — reads `composers` once, at startup: its structure stays fixed", () => {
    let reads = 0;
    const Base = foundationOf({ main: "#m" });
    class Counted extends Base {
      get composers() { reads++; return super.composers; }
    }
    const app = new Application({ foundation: Counted, document });
    app.start();
    expect(reads).toBe(1);
    expect(document.querySelector("#m")!.textContent).toBe("leaf");
  });

  it("the anchor is an Application option", () => {
    document.body.innerHTML = `<div id="app"><main id="m"></main></div><main id="outside"></main>`;
    new Application({ foundation: foundationOf({ main: "#m" }), document, anchor: "#app" }).start();
    expect(document.querySelector("#m")!.textContent).toBe("leaf");
    expect(document.querySelector("#outside")!.textContent).toBe("");
  });

  it("a slot that matches no element is reported as a failed effect, on the console in development (O2)", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const app = new Application({ foundation: foundationOf({ main: "#nope" }), document });
    app.start();
    expect(failedEffects(app).join()).toMatch(/matches 0 elements/);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toBe(
      `[Bonsai] effect "materialize body/main" of "Page" failed (C.3); not attempted because of it: "materialize body/main/l" (LeafComposer), "template" (Leaf)`
    );
  });

  it("the trace sink is an Application option: a sink of one's own, or none", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const seen: string[] = [];
    new Application({ foundation: foundationOf({ main: "#nope" }), document, onTrace: (e) => seen.push(e.type) }).start();
    new Application({ foundation: foundationOf({ main: "#nope" }), document, onTrace: null }).start();
    expect(seen).toContain("effects");
    expect(warn).not.toHaveBeenCalled();
  });

  it("a slot that matches several elements is reported as a failed effect", () => {
    document.body.innerHTML = `<main class="m"></main><main class="m"></main>`;
    const app = new Application({ foundation: foundationOf({ main: ".m" }), document, onTrace: null });
    app.start();
    expect(failedEffects(app).join()).toMatch(/matches 2 elements/);
  });

  it("an Application with a Foundation requires the host document", () => {
    expect(() => new Application({ foundation: foundationOf({}) })).toThrow(/needs the host `document`/);
  });

  it("I33 — a Foundation has no body/html getters and no attach hooks any more", () => {
    const f = new (foundationOf({}))() as unknown as Record<string, unknown>;
    for (const name of ["body", "html", "onAttach", "onDetach"]) expect(f[name]).toBeUndefined();
  });

  it("an Application without Foundation stays legitimate (headless)", () => {
    const app = new Application();
    expect(() => app.start()).not.toThrow();
  });
});
