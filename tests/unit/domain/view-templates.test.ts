/**
 * Test — template bindings of a View (strate 1c, lot 2, ADR-26)
 *
 * A binding declares the Query that feeds a zone and the Events that re-run
 * it. The framework projects it when the View is created, then after each
 * Event of its `on`, in one pass, skipping a shallow-equal output.
 *
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { drive } from "../../helpers/drive";
import { resetDOM } from "../../helpers/dom-setup";
import { Entity } from "@bonsai/entity";
import { Feature, type TFeatureContract, type TFeatureCallbacks, type TFeatureContext } from "@bonsai/feature";
import type { TChannelToken } from "@bonsai/kernel";
import { BonsaiError } from "@bonsai/error";
import { Composer, type TComposerContract, type TComposeContext, type TComposition } from "@bonsai/composer";
import { Foundation } from "@bonsai/foundation";
import {
  View,
  ui,
  bind,
  type TViewContract,
  type TViewCallbacks,
  type TViewTemplates,
  type TUIContract,
  type TUIElements,
  type TFact,
  type TFactContext,
  type TEventContext,
  type TProjectionTemplate
} from "@bonsai/view";

// ─── A small domain: a list of items with a label ───────────────────────────

type TItem = { id: string; qty: number };
type TListState = { items: TItem[]; label: string };

class ListEntity extends Entity<TListState> {
  protected defineInitialState(): TListState {
    return { items: [{ id: "a", qty: 1 }], label: "start" };
  }
}
type TListDef = {
  commands: { add: TItem; rename: string; touch: null; fail: null };
  events: { added: { id: string }; renamed: null; touched: null };
  queries: {
    items: { params: null; result: readonly TItem[] };
    label: { params: { upper: boolean }; result: string };
  };
};
const listListens = [] as const;
class ListFeature
  extends Feature<ListEntity, TListDef, "list">
  implements TFeatureCallbacks<TListDef, typeof listListens, ListEntity>
{
  static readonly channel: TChannelToken<TListDef, "list"> = { namespace: "list", events: ["added", "renamed", "touched"] };
  get listens() { return listListens; }
  get queries() { return [] as const; }
  protected get Entity() { return ListEntity; }
  onAddCommand(item: TItem, ctx: TFeatureContext<TListDef, ListEntity>): void {
    ctx.mutate("add", (d) => { d.items.push(item); });
    ctx.emit("added", { id: item.id });
  }
  onRenameCommand(label: string, ctx: TFeatureContext<TListDef, ListEntity>): void {
    ctx.mutate("rename", (d) => { d.label = label; });
    ctx.emit("renamed", null);
  }
  /** Emits without changing anything: the projected output stays equal. */
  onTouchCommand(_p: null, ctx: TFeatureContext<TListDef, ListEntity>): void {
    ctx.emit("touched", null);
  }
  onFailCommand(): void {}
  onItemsQuery(): readonly TItem[] { counts.items++; return this.entity.state.items; }
  onLabelQuery(params: { upper: boolean }): string {
    counts.label++;
    return params.upper ? this.entity.state.label.toUpperCase() : this.entity.state.label;
  }
}

const features = {
  list: {
    feature: ListFeature,
    listens: ["added", "renamed", "touched"] as const,
    triggers: ["add", "rename", "touch"] as const,
    queries: ["items", "label"] as const
  }
} satisfies TFeatureContract;
const uiEvents = {
  items: ui<HTMLElement>()([]),
  title: ui<HTMLElement>()([]),
  footer: ui<HTMLElement>()([]),
  flash: ui<HTMLElement>()([]),
  add: ui<HTMLButtonElement>()(["click"])
} satisfies TUIContract;
const uiElements = {
  items: "[data-ui='items']",
  title: "[data-ui='title']",
  footer: "[data-ui='footer']",
  flash: "[data-ui='flash']",
  add: "[data-ui='add']"
} satisfies TUIElements<typeof uiEvents>;
type TContract = TViewContract<typeof features, typeof uiEvents>;

// ─── Hand-written templates (the Pug compiler comes with lot 4) ──────────────

/** Calls of the template functions, per test. */
const calls: string[] = [];
const counts = { items: 0, label: 0 };

const ItemsTemplate: TProjectionTemplate<readonly string[], { list: HTMLElement }> = {
  create(ids) {
    calls.push(`items.create:${ids.join(",")}`);
    const ul = document.createElement("ul");
    ul.textContent = ids.join(",");
    return ul;
  },
  setup(container) {
    calls.push("items.setup");
    return { list: container.querySelector("ul") as HTMLElement };
  },
  project(nodes, ids) {
    calls.push(`items.project:${ids.join(",")}`);
    nodes.list.textContent = ids.join(",");
  }
};

const TextTemplate = (name: string): TProjectionTemplate<string, { text: Text }> => ({
  create(value) {
    calls.push(`${name}.create:${value}`);
    return document.createTextNode(value);
  },
  setup(container) {
    return { text: container.firstChild as Text };
  },
  project(nodes, value) {
    calls.push(`${name}.project:${value}`);
    nodes.text.data = value;
  }
});

const FooterTemplate: TProjectionTemplate<undefined> = {
  create() { calls.push("footer.create"); const b = document.createElement("b"); b.textContent = "static"; return b; },
  setup() { return null; },
  project() { calls.push("footer.project"); }
};

const templates = {
  items: bind<TContract>()({
    template: ItemsTemplate,
    query: "list:items",
    params: null,
    on: ["list:added", "list:touched"],
    select: (items) => items.map((i) => i.id)
  }),
  title: bind<TContract>()({
    template: TextTemplate("title"),
    query: "list:label",
    params: (viewParams) => ({ upper: viewParams["upper"] === true }),
    on: ["list:renamed", "list:touched"]
  }),
  footer: { template: FooterTemplate }
} as const;

const seen: { handled: string[] } = { handled: [] };

class ListView extends View<TContract> implements TViewCallbacks<TContract, typeof templates> {
  get features() { return features; }
  get uiEvents() { return uiEvents; }
  get uiElements() { return uiElements; }
  get template() {
    return `<div data-ui="items"></div><h1 data-ui="title"></h1><p data-ui="flash"></p><footer data-ui="footer"></footer><button data-ui="add">+</button>`;
  }
  override get templates(): TViewTemplates<TContract> { return templates; }

  onAddClick(_fact: TFact, ctx: TFactContext<TContract>): void {
    ctx.trigger("list:add", { id: "b", qty: 2 });
  }
  // Optional (cited in an `on`): runs before the pass, may still project on a free key.
  onListAddedEvent(payload: { id: string }, _ctx: TEventContext<TContract>): void {
    seen.handled.push(`added:${payload.id}`);
    calls.push("handler.added");
    this.getUI("flash").text(`${payload.id} added`);
  }
}

/** Handles every Event, for variants whose bindings cite fewer of them. */
class HandledView extends ListView {
  onListRenamedEvent(): void {}
  onListTouchedEvent(): void {}
}

// ─── Harness ─────────────────────────────────────────────────────────────────

const mount = (ViewClass: typeof ListView, params: Record<string, unknown> = { upper: true }) => {
  const composerFeatures = { list: { feature: ListFeature, listens: [] as const, queries: [] as const } };
  const composerViews = { list: ViewClass };
  type TC = TComposerContract<typeof composerFeatures, typeof composerViews>;
  class Host extends Composer<TC> {
    get features() { return composerFeatures; }
    get views() { return composerViews; }
    resolve(_ctx: TComposeContext<TC>): TComposition<TC> { return [{ view: "list", key: "l", params }]; }
  }
  class Page extends Foundation {
    get composers() { return { main: { slot: "#main", composer: Host } } as const; }
  }
  return drive({ list: ListFeature }, { foundation: Page, document });
};

const text = (key: string): string => document.querySelector(`[data-ui='${key}']`)!.textContent ?? "";

/** Startup wraps the cause of a refused description (§2.5). */
const startupError = (run: () => unknown): BonsaiError | undefined => {
  try { run(); } catch (e) { return ((e as { cause?: unknown }).cause ?? e) as BonsaiError; }
  return undefined;
};

describe("View template bindings (ADR-26)", () => {
  beforeEach(() => {
    resetDOM();
    document.body.innerHTML = `<div id="main"></div>`;
    calls.length = 0;
    counts.items = 0;
    counts.label = 0;
    seen.handled = [];
  });

  it("creation: each binding is created from its Query and select, static ones without data", () => {
    const d = mount(ListView);
    expect(text("items")).toBe("a");
    expect(text("title")).toBe("START"); // params from the View's creation parameters
    expect(text("footer")).toBe("static");
    expect(calls).toEqual(["items.create:a", "items.setup", "title.create:START", "footer.create"]);
    expect(d.failures()).toEqual([]);
  });

  it("an Event of `on` re-runs its bindings after the handler, and only them (L1)", () => {
    const d = mount(ListView);
    calls.length = 0;
    (document.querySelector("[data-ui='add']") as HTMLElement).click();
    expect(calls).toEqual(["handler.added", "items.project:a,b"]);
    expect(text("items")).toBe("a,b");
    expect(text("flash")).toBe("b added");
    expect(d.failures()).toEqual([]);
  });

  it("I82 amended — an Event cited in an `on` needs no handler", () => {
    const d = mount(ListView);
    calls.length = 0;
    d.send("list", "rename", "next");
    expect(calls).toEqual(["title.project:NEXT"]);
    expect(text("title")).toBe("NEXT");
    expect(d.failures()).toEqual([]);
  });

  it("L2 — a shallow-equal output is not projected", () => {
    const d = mount(ListView);
    calls.length = 0;
    d.send("list", "touch", null); // re-runs items and title, nothing changed
    expect(calls).toEqual([]);
    expect(counts).toEqual({ items: 2, label: 2 }); // asked at creation, then once in the pass
  });

  it("one pass asks a Query once per parameters, even for several bindings", () => {
    class Twice extends HandledView {
      override get templates() {
        return {
          items: templates.items,
          footer: bind<TContract>()({ template: TextTemplate("count"), query: "list:items", params: null, on: ["list:added"], select: (items) => String(items.length) })
        };
      }
    }
    const d = mount(Twice);
    expect(counts.items).toBe(1);
    (document.querySelector("[data-ui='add']") as HTMLElement).click();
    expect(counts.items).toBe(2);
    expect([text("items"), text("footer")]).toEqual(["a,b", "2"]);
    expect(d.failures()).toEqual([]);
  });

  it("G7 / C.3 — in a failed unit nothing is engaged and the last output is restored", () => {
    let fail = false;
    class Failing extends HandledView {
      override get templates(): TViewTemplates<TContract> {
        return {
          items: templates.items, // remembered first in the pass…
          footer: bind<TContract>()({
            template: TextTemplate("footer"),
            query: "list:items",
            params: null,
            on: ["list:added"],
            select: (items) => {
              if (fail) throw new Error("boom"); // …then the pass fails
              return String(items.length);
            }
          })
        };
      }
    }
    const d = mount(Failing);
    fail = true;
    d.send("list", "add", { id: "b", qty: 1 });
    expect(d.failures()).toHaveLength(1);
    expect(text("items")).toBe("a");
    // The memory of items was restored to "a": the output "a,b" is projected, not skipped.
    fail = false;
    calls.length = 0;
    d.send("list", "touch", null);
    expect(calls).toEqual(["items.project:a,b"]);
    expect(text("items")).toBe("a,b");
  });

  it("templates.root covers the whole part (mode B)", () => {
    class Whole extends HandledView {
      override get template() { return ""; }
      override get templates(): TViewTemplates<TContract> {
        return { root: bind<TContract>()({ template: ItemsTemplate, query: "list:items", params: null, on: ["list:added"], select: (items) => items.map((i) => i.id) }) };
      }
      override onListAddedEvent(): void {}
    }
    const d = mount(Whole);
    expect(document.querySelector("#main [data-bonsai-part]")!.innerHTML).toBe("<ul>a</ul>");
    d.send("list", "add", { id: "z", qty: 1 });
    expect(document.querySelector("#main [data-bonsai-part]")!.innerHTML).toBe("<ul>a,z</ul>");
    expect(d.failures()).toEqual([]);
  });

  it("I41 — getUI() refuses a key covered by a template", () => {
    class Writer extends ListView {
      override onListAddedEvent(): void { this.getUI("items").text("x"); }
    }
    const d = mount(Writer);
    d.send("list", "add", { id: "b", qty: 1 });
    const error = d.failures()[0]!.error as BonsaiError;
    expect(error).toBeInstanceOf(BonsaiError);
    expect(error.code).toBe("TEMPLATE_OWNED_KEY");
    expect(text("items")).toBe("a");
  });

  it("I41 — under templates.root, getUI() refuses every key", () => {
    class Writer extends HandledView {
      override get template() { return ""; }
      override get templates(): TViewTemplates<TContract> { return { root: { template: FooterTemplate } }; }
      override onListAddedEvent(): void { this.getUI("flash").text("x"); }
    }
    const d = mount(Writer);
    d.send("list", "add", { id: "b", qty: 1 });
    expect((d.failures()[0]!.error as BonsaiError).code).toBe("TEMPLATE_OWNED_KEY");
  });

  it("C.3 — a container missing at engagement fails that effect only, after validation", () => {
    class Missing extends ListView {
      override get template() { return `<h1 data-ui="title"></h1><footer data-ui="footer"></footer><button data-ui="add">+</button>`; }
    }
    const lines: Array<{ label: string; outcome: string }> = [];
    const composerFeatures = { list: { feature: ListFeature, listens: [] as const, queries: [] as const } };
    const composerViews = { list: Missing };
    type TC = TComposerContract<typeof composerFeatures, typeof composerViews>;
    class Host extends Composer<TC> {
      get features() { return composerFeatures; }
      get views() { return composerViews; }
      resolve(_ctx: TComposeContext<TC>): TComposition<TC> { return [{ view: "list", key: "l", params: { upper: true } }]; }
    }
    class Page extends Foundation {
      get composers() { return { main: { slot: "#main", composer: Host } } as const; }
    }
    const d = drive({ list: ListFeature }, {
      foundation: Page,
      document,
      onTrace: (entry) => {
        if (entry.type === "effects") for (const l of entry.report) if (l.owner === "Missing") lines.push({ label: l.label, outcome: l.outcome });
      }
    });
    expect(d.failures()).toEqual([]); // the unit validated
    expect(lines.find((l) => l.label === "templates.items")?.outcome).toBe("failed");
    // Without a target, the effects of a component aim at one resource: the next ones are not attempted.
    expect(lines.find((l) => l.label === "templates.footer")?.outcome).toBe("not-attempted");
  });

  it("L2 — shallowEqual compares own keys and values, arrays apart from objects", () => {
    const outputs: unknown[] = [{ a: 1 }, { a: 1 }, { b: 1 }, { a: 1, b: 1 }, { 0: 1 }, [1], 5, 5, null, null];
    let next = 0;
    const projected: unknown[] = [];
    const Probe: TProjectionTemplate<unknown> = {
      create: () => document.createTextNode(""),
      setup: () => null,
      project: (_n, data) => { projected.push(data); }
    };
    class Shapes extends HandledView {
      override get templates(): TViewTemplates<TContract> {
        return { footer: bind<TContract>()({ template: Probe, query: "list:items", params: null, on: ["list:touched"], select: () => outputs[next++] }) };
      }
    }
    const d = mount(Shapes);
    for (let i = 1; i < outputs.length; i++) d.send("list", "touch", null);
    // { a: 1 } created; equal { a: 1 } skipped; the second 5 and the second null skipped.
    expect(projected).toEqual([{ b: 1 }, { a: 1, b: 1 }, { 0: 1 }, [1], 5, null]);
    expect(d.failures()).toEqual([]);
  });

  it("parameters that cannot be serialized are not shared within a pass", () => {
    class Unshared extends HandledView {
      override get templates(): TViewTemplates<TContract> {
        const params = () => ({ upper: false, big: BigInt(1) }) as unknown as { upper: boolean };
        return {
          title: bind<TContract>()({ template: TextTemplate("a"), query: "list:label", params, on: ["list:renamed"] }),
          footer: bind<TContract>()({ template: TextTemplate("b"), query: "list:label", params, on: ["list:renamed"] })
        };
      }
    }
    mount(Unshared);
    expect(counts.label).toBe(2);
  });

  it("a container left without nodes by a failed creation is set up again at the next projection", () => {
    let broken = true;
    const Fragile: TProjectionTemplate<readonly string[], { list: HTMLElement }> = {
      ...ItemsTemplate,
      setup(container) {
        if (broken) throw new Error("setup failed");
        return ItemsTemplate.setup(container);
      }
    };
    class Recovering extends HandledView {
      override get templates(): TViewTemplates<TContract> {
        return { items: bind<TContract>()({ template: Fragile, query: "list:items", params: null, on: ["list:added"], select: (items) => items.map((i) => i.id) }) };
      }
    }
    const d = mount(Recovering);
    broken = false;
    calls.length = 0;
    d.send("list", "add", { id: "b", qty: 1 });
    expect(calls).toEqual(["handler.added", "items.setup", "items.project:a,b"]);
    expect(text("items")).toBe("a,b");
  });

  it("G7 — a creation that fails after its bindings leaves no projected output", () => {
    class Colliding extends ListView {
      override get composers() { return { items: { slot: "[data-ui='items']", composer: Composer as never } }; }
    }
    expect(startupError(() => mount(Colliding))!.code).toBe("SLOT_KEY_COLLISION");
  });

  describe("O2 — checks when the View is described", () => {
    const refused = (declared: unknown, template?: string): BonsaiError | undefined => {
      class Bad extends ListView {
        override get template() { return template ?? super.template; }
        override get templates() { return declared as TViewTemplates<TContract>; }
      }
      return startupError(() => mount(Bad));
    };

    it.each([
      ["UNKNOWN_TEMPLATE_KEY", { nope: { template: FooterTemplate } }],
      ["MISSING_TEMPLATE", { footer: {} }],
      ["MISSING_QUERY", { footer: { template: FooterTemplate, on: ["list:added"] } }],
      ["UNDECLARED_QUERY", { footer: { template: FooterTemplate, query: "list:other", on: ["list:added"] } }],
      ["UNDECLARED_QUERY", { footer: { template: FooterTemplate, query: "shop:items", on: ["list:added"] } }],
      ["MISSING_ON", { footer: { template: FooterTemplate, query: "list:items", on: [] } }],
      ["MISSING_ON", { footer: { template: FooterTemplate, query: "list:items" } }],
      ["UNDECLARED_LISTEN", { footer: { template: FooterTemplate, query: "list:items", on: ["list:removed"] } }],
      ["MALFORMED_KEY", { footer: { template: FooterTemplate, query: "items", on: ["list:added"] } }],
      ["ROOT_TEMPLATE_EXCLUSIVE", { root: { template: FooterTemplate }, footer: { template: FooterTemplate } }]
    ])("%s", (code, declared) => {
      const error = refused(declared);
      expect(error).toBeInstanceOf(BonsaiError);
      expect(error!.code).toBe(code);
    });

    it("ROOT_TEMPLATE_EXCLUSIVE — templates.root with an initial `template`", () => {
      expect(refused({ root: { template: FooterTemplate } })!.code).toBe("ROOT_TEMPLATE_EXCLUSIVE");
    });

    it("I82 — an Event neither handled nor cited in an `on` still requires its handler", () => {
      const error = refused({ items: templates.items, footer: templates.footer }); // "renamed" is no longer cited
      expect(error!.code).toBe("MISSING_HANDLER");
      expect(error!.message).toContain("onListRenamedEvent");
    });
  });
});
