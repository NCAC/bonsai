/**
 * Test — View on the kernel (lot M6.2)
 *
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { drive } from "../../helpers/drive";
import { resetDOM } from "../../helpers/dom-setup";
import { Entity } from "@bonsai/entity";
import { Feature, type TFeatureContract, type TFeatureCallbacks, type TFeatureContext } from "@bonsai/feature";
import type { TChannelToken } from "@bonsai/kernel";
import { Composer, type TComposerContract, type TComposeContext, type TComposition } from "@bonsai/composer";
import { Foundation } from "@bonsai/foundation";
import {
  View,
  ui,
  type TViewContract,
  type TViewCallbacks,
  type TUIContract,
  type TUIElements,
  type TFact,
  type TFactContext,
  type TEventContext
} from "@bonsai/view";

// ─── A small domain: a counter ──────────────────────────────────────────────

class CounterEntity extends Entity<{ n: number }> {
  protected defineInitialState() {
    return { n: 0 };
  }
}
type TCounterDef = {
  commands: { inc: null };
  events: { changed: { n: number } };
  queries: { get: { params: null; result: number } };
};
const counterListens = [] as const;
class CounterFeature
  extends Feature<CounterEntity, TCounterDef, "counter">
  implements TFeatureCallbacks<TCounterDef, typeof counterListens, CounterEntity>
{
  static readonly channel: TChannelToken<TCounterDef, "counter"> = { namespace: "counter", events: ["changed"] };
  get listens() { return counterListens; }
  get queries() { return [] as const; }
  protected get Entity() { return CounterEntity; }
  onIncCommand(_p: null, ctx: TFeatureContext<TCounterDef, CounterEntity>): void {
    ctx.mutate("inc", (d) => { d.n += 1; });
    ctx.emit("changed", { n: this.entity.state.n });
  }
  onGetQuery(): number { return this.entity.state.n; }
}

const features = {
  counter: { feature: CounterFeature, listens: ["changed"] as const, triggers: ["inc"] as const, queries: ["get"] as const }
} satisfies TFeatureContract;
const uiEvents = {
  label: ui<HTMLElement>()([]),
  button: ui<HTMLButtonElement>()(["click"])
} satisfies TUIContract;
const uiElements = {
  label: "[data-ui='label']",
  button: "[data-ui='button']"
} satisfies TUIElements<typeof uiEvents>;
type TContract = TViewContract<typeof features, typeof uiEvents>;

/** Observation points of the Views under test, reset per test. */
const seen: { fact?: TFact; ctxKeys?: string[]; eventCtxKeys?: string[]; paramsRead?: unknown; outside?: unknown } = {};

class CounterView extends View<TContract> implements TViewCallbacks<TContract> {
  get features() { return features; }
  get uiEvents() { return uiEvents; }
  get uiElements() { return uiElements; }
  get template() { return `<b data-ui="label">0</b><button data-ui="button">+</button>`; }

  onButtonClick(fact: TFact, ctx: TFactContext<TContract>): void {
    seen.fact = fact;
    seen.ctxKeys = Object.keys(ctx).sort();
    ctx.trigger("counter:inc", null);
  }
  onCounterChangedEvent(payload: { n: number }, ctx: TEventContext<TContract>): void {
    seen.eventCtxKeys = Object.keys(ctx).sort();
    const label = this.getUI("label");
    label.text(String(ctx.query("counter:get", null)));
    label.attr("title", `n=${payload.n}`);
    label.toggleClass("big", payload.n > 1);
    label.style("color", "red");
    this.getUI("button").visible(payload.n < 3);
  }
}

const composerFeatures = { counter: { feature: CounterFeature, listens: [] as const, queries: [] as const } };
const composerViews = { counter: CounterView };
type TComposerC = TComposerContract<typeof composerFeatures, typeof composerViews>;
class HostComposer extends Composer<TComposerC> {
  get features() { return composerFeatures; }
  get views() { return composerViews; }
  resolve(_ctx: TComposeContext<TComposerC>): TComposition<TComposerC> { return [{ view: "counter", key: "c" }]; }
}
class Page extends Foundation {
  get composers() { return { main: { slot: "#main", composer: HostComposer } } as const; }
}

/** Startup wraps the cause of a refused description (§2.5). */
const startupCause = (run: () => unknown): string => {
  try { run(); } catch (e) { return String(((e as { cause?: Error }).cause ?? (e as Error)).message); }
  return "no error";
};

const page = () => drive({ counter: CounterFeature }, { foundation: Page, document });

describe("View on the kernel", () => {
  beforeEach(() => {
    resetDOM();
    document.body.innerHTML = `<div id="main"></div>`;
    for (const k of Object.keys(seen)) delete (seen as Record<string, unknown>)[k];
  });

  it("projects its template into the part attributed by the Composer", () => {
    const d = page();
    const main = document.getElementById("main")!;
    expect(main.children).toHaveLength(1);
    expect(main.querySelector("[data-ui='label']")!.textContent).toBe("0");
    expect(d.failures()).toEqual([]);
  });

  it("a click is admitted as a fact { type, ui }, and the handler may trigger and query", () => {
    const d = page();
    (document.querySelector("[data-ui='button']") as HTMLElement).click();
    expect(seen.fact).toEqual({ type: "click", ui: "button" });
    expect(seen.ctxKeys).toEqual(["query", "trigger"]);
    expect(d.ask<number>("counter", "get", null)).toBe(1);
    expect(document.querySelector("[data-ui='label']")!.textContent).toBe("1");
    expect(d.failures()).toEqual([]);
  });

  it("an Event handler can query but has no `trigger` (D18)", () => {
    page();
    (document.querySelector("[data-ui='button']") as HTMLElement).click();
    expect(seen.eventCtxKeys).toEqual(["query"]);
  });

  it("projections: text, attr, toggleClass, style and visible reach the document after the unit", () => {
    page();
    const button = document.querySelector("[data-ui='button']") as HTMLElement;
    button.click();
    button.click();
    const label = document.querySelector("[data-ui='label']") as HTMLElement;
    expect(label.textContent).toBe("2");
    expect(label.getAttribute("title")).toBe("n=2");
    expect(label.classList.contains("big")).toBe(true);
    expect(label.style.color).toBe("red");
    button.click();
    expect(button.style.display).toBe("none");
  });

  it("a fact on an element that declares no such event, or no UI key, is ignored without failure", () => {
    const d = page();
    (document.querySelector("[data-ui='label']") as HTMLElement).click(); // key without events
    (document.querySelector("#main > [data-bonsai-part]") as HTMLElement).click(); // part itself: no key
    expect(seen.fact).toBeUndefined();
    expect(d.failures()).toEqual([]);
  });

  it("a fact outside the View's own part is not admitted to it", () => {
    const d = page();
    document.body.insertAdjacentHTML("beforeend", `<button data-ui="button" id="stray">x</button>`);
    document.getElementById("stray")!.click();
    expect(d.ask<number>("counter", "get", null)).toBe(0);
  });

  it("a projection prepared in a unit that fails is never engaged (C.3, G7)", () => {
    class Failing extends CounterView {
      override onCounterChangedEvent(payload: { n: number }, ctx: TEventContext<TContract>): void {
        super.onCounterChangedEvent(payload, ctx);
        throw new Error("boom");
      }
    }
    class FailComposer extends HostComposer {
      override get views() { return { counter: Failing }; }
    }
    class FailPage extends Foundation {
      get composers() { return { main: { slot: "#main", composer: FailComposer } } as const; }
    }
    const d = drive({ counter: CounterFeature }, { foundation: FailPage, document });
    (document.querySelector("[data-ui='button']") as HTMLElement).click();
    expect(d.failures().length).toBeGreaterThan(0);
    expect(document.querySelector("[data-ui='label']")!.textContent).toBe("0");
  });

  it("getUI and params are usable only inside a handler", () => {
    class Probe extends CounterView {
      read() { return this.getUI("label"); }
      readParams() { return this.params; }
    }
    const v = new Probe();
    expect(() => v.read()).toThrow(/only inside a handler/);
    expect(() => v.readParams()).toThrow(/only inside a handler/);
  });

  it("has no emit, no trigger, no request, no element() (I4, I39)", () => {
    const v = new CounterView() as unknown as Record<string, unknown>;
    for (const name of ["emit", "trigger", "request", "mount", "onAttach"]) expect(v[name]).toBeUndefined();
  });

  it("I84 — a declared host event without handler is refused when the View is described", () => {
    class NoHandler extends View<TContract> {
      get features() { return features; }
      get uiEvents() { return uiEvents; }
      get uiElements() { return uiElements; }
    }
    class C extends HostComposer { override get views() { return { counter: NoHandler as never }; } }
    class P extends Foundation { get composers() { return { main: { slot: "#main", composer: C } } as const; } }
    expect(startupCause(() => drive({ counter: CounterFeature }, { foundation: P, document }))).toMatch(/Missing handler "onButtonClick"/);
  });

  it("I82 — a listened Event without handler is refused when the View is described", () => {
    class NoEvent extends View<TContract> {
      get features() { return features; }
      get uiEvents() { return { label: uiEvents.label, button: ui<HTMLButtonElement>()([]) } as never; }
      get uiElements() { return uiElements; }
    }
    class C extends HostComposer { override get views() { return { counter: NoEvent as never }; } }
    class P extends Foundation { get composers() { return { main: { slot: "#main", composer: C } } as const; } }
    expect(startupCause(() => drive({ counter: CounterFeature }, { foundation: P, document }))).toMatch(/Missing handler "onCounterChangedEvent"/);
  });

  it("a UI key declared with events but absent from uiElements is refused", () => {
    class NoSelector extends CounterView {
      override get uiElements() { return { label: uiElements.label } as never; }
    }
    class C extends HostComposer { override get views() { return { counter: NoSelector as never }; } }
    class P extends Foundation { get composers() { return { main: { slot: "#main", composer: C } } as const; } }
    expect(startupCause(() => drive({ counter: CounterFeature }, { foundation: P, document }))).toMatch(/missing in uiElements/);
  });

  it("an unknown UI key in getUI is an error", () => {
    class Bad extends CounterView {
      override onCounterChangedEvent(): void { (this as unknown as { getUI(k: string): unknown }).getUI("nope"); }
    }
    class C extends HostComposer { override get views() { return { counter: Bad }; } }
    class P extends Foundation { get composers() { return { main: { slot: "#main", composer: C } } as const; } }
    const d = drive({ counter: CounterFeature }, { foundation: P, document });
    (document.querySelector("[data-ui='button']") as HTMLElement).click();
    expect(d.failures().some((f) => /Unknown UI key "nope"/.test(String((f.error as Error).message)))).toBe(true);
  });

  it("creation params are readable in handlers", () => {
    const got: unknown[] = [];
    class WithParams extends CounterView {
      override onCounterChangedEvent(): void { got.push(this.params); }
    }
    class C extends Composer<TComposerC> {
      get features() { return composerFeatures; }
      get views() { return { counter: WithParams }; }
      resolve(): TComposition<TComposerC> { return [{ view: "counter", key: "c", params: { label: "A" } } as never]; }
    }
    class P extends Foundation { get composers() { return { main: { slot: "#main", composer: C } } as const; } }
    // the Composer listens to nothing: the View still receives counter Events
    drive({ counter: CounterFeature }, { foundation: P, document });
    (document.querySelector("[data-ui='button']") as HTMLElement).click();
    expect(got).toEqual([{ label: "A" }]);
  });

  it("a View may declare slots filled by nested Composers", () => {
    class InnerView extends View<TViewContract<Record<string, never>, Record<string, never>>> {
      get features() { return {}; }
      get uiEvents() { return {}; }
      get uiElements() { return {}; }
      get template() { return "inner"; }
    }
    class InnerComposer extends Composer<TComposerContract<Record<string, never>, { inner: typeof InnerView }>> {
      get features() { return {}; }
      get views() { return { inner: InnerView }; }
      resolve() { return [{ view: "inner" as const, key: "i" }]; }
    }
    class Outer extends View<TViewContract<Record<string, never>, Record<string, never>>> {
      get features() { return {}; }
      get uiEvents() { return {}; }
      get uiElements() { return {}; }
      get template() { return `<section class="slot"></section>`; }
      override get composers() { return { body: { slot: ".slot", composer: InnerComposer } } as const; }
    }
    class OuterComposer extends Composer<TComposerContract<Record<string, never>, { outer: typeof Outer }>> {
      get features() { return {}; }
      get views() { return { outer: Outer }; }
      resolve() { return [{ view: "outer" as const, key: "o" }]; }
    }
    class P extends Foundation { get composers() { return { main: { slot: "#main", composer: OuterComposer } } as const; } }
    const d = drive({}, { foundation: P, document });
    expect(document.querySelector("#main .slot")!.textContent).toBe("inner");
    expect(d.failures()).toEqual([]);
  });

  describe("a View whose element cannot be created stays alive (A1.b, C.3)", () => {
    class Probing extends CounterView {
      static reactions = 0;
      onCounterChangedEvent(payload: { n: number }, ctx: TEventContext<TContract>): void {
        Probing.reactions++;
        super.onCounterChangedEvent(payload, ctx);
      }
    }
    const probingViews = { counter: Probing };
    type TProbing = TComposerContract<typeof composerFeatures, typeof probingViews>;
    class ProbingComposer extends Composer<TProbing> {
      get features() { return composerFeatures; }
      get views() { return probingViews; }
      resolve(_ctx: TComposeContext<TProbing>): TComposition<TProbing> { return [{ view: "counter", key: "c" }]; }
    }
    class TwoSlots extends Foundation {
      get composers() {
        return {
          lost: { slot: "#nowhere", composer: ProbingComposer },
          main: { slot: "#main", composer: ProbingComposer }
        } as const;
      }
    }
    const failedMessages = (d: ReturnType<typeof drive>): string[] =>
      d.root.trace.flatMap((t) =>
        t.type === "effects" ? t.report.filter((r) => r.outcome === "failed").map((r) => String((r.error as Error).message)) : []
      );

    it("keeps reacting to Events: no unit fails, only effects do", () => {
      Probing.reactions = 0;
      const d = drive({ counter: CounterFeature }, { foundation: TwoSlots, document });
      expect(failedMessages(d).join()).toMatch(/matches 0 elements/);   // the element was never created
      d.send("counter", "inc");
      expect(Probing.reactions).toBe(2);                                // both Views reacted, the lost one included
      d.send("counter", "inc");
      expect(Probing.reactions).toBe(4);                                // and again: nothing destroyed it
      expect(d.failures()).toEqual([]);                                 // no unit failed: the projections of the lost View are failed or unattempted effects
    });

    class MainFirst extends Foundation {
      get composers() {
        return {
          main: { slot: "#main", composer: ProbingComposer },
          lost: { slot: "#nowhere", composer: ProbingComposer }
        } as const;
      }
    }

    it("C.3 — a failing slot does not deprive its sibling, whatever the declaration order", () => {
      for (const foundation of [TwoSlots, MainFirst]) {
        resetDOM();
        document.body.innerHTML = `<div id="main"></div>`;
        const d = drive({ counter: CounterFeature }, { foundation, document });
        const outcomes = d.root.trace.flatMap((t) => (t.type === "effects" ? t.report.map((r) => `${r.label}:${r.outcome}`) : []));
        expect(outcomes).toEqual(expect.arrayContaining([
          "materialize body/lost:failed",
          "materialize body/lost/c:not-attempted",   // the View of the failing slot lies below it
          "materialize body/main:engaged",
          "materialize body/main/c:engaged"
        ]));
        expect(document.querySelector("#main [data-ui='label']")!.textContent).toBe("0");
        d.send("counter", "inc");
        expect(document.querySelector("#main [data-ui='label']")!.textContent).toBe("1");
        expect(d.failures()).toEqual([]);
      }
    });
  });
});
