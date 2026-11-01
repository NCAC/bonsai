/**
 * Test — Foundation on the kernel (lot M6.2)
 *
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
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
  class extends Foundation {
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

  it("fills each declared slot through its Composer, inside the anchor (default body)", () => {
    const app = new Application({ foundation: foundationOf({ head: "#h", main: "#m" }), document });
    app.start();
    expect(document.querySelector("#h")!.textContent).toBe("leaf");
    expect(document.querySelector("#m")!.textContent).toBe("leaf");
    expect(app.root!.trace.filter((t) => t.type === "unit-failed")).toEqual([]);
  });

  it("the anchor is an Application option", () => {
    document.body.innerHTML = `<div id="app"><main id="m"></main></div><main id="outside"></main>`;
    new Application({ foundation: foundationOf({ main: "#m" }), document, anchor: "#app" }).start();
    expect(document.querySelector("#m")!.textContent).toBe("leaf");
    expect(document.querySelector("#outside")!.textContent).toBe("");
  });

  it("a slot that matches no element is reported as a failed effect", () => {
    const app = new Application({ foundation: foundationOf({ main: "#nope" }), document });
    app.start();
    expect(failedEffects(app).join()).toMatch(/matches 0 elements/);
  });

  it("a slot that matches several elements is reported as a failed effect", () => {
    document.body.innerHTML = `<main class="m"></main><main class="m"></main>`;
    const app = new Application({ foundation: foundationOf({ main: ".m" }), document });
    app.start();
    expect(failedEffects(app).join()).toMatch(/matches 2 elements/);
  });

  it("an Application with a Foundation requires the host document", () => {
    expect(() => new Application({ foundation: foundationOf({}) })).toThrow(/needs the host `document`/);
  });

  it("a Foundation has no body/html getters and no attach hooks any more", () => {
    const f = new (foundationOf({}))() as unknown as Record<string, unknown>;
    for (const name of ["body", "html", "onAttach", "onDetach"]) expect(f[name]).toBeUndefined();
  });

  it("an Application without Foundation stays legitimate (headless)", () => {
    const app = new Application();
    expect(() => app.start()).not.toThrow();
  });
});
