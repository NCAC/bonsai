/**
 * Test — Composer on the kernel (lot M6.2)
 *
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { drive } from "../../helpers/drive";
import { resetDOM } from "../../helpers/dom-setup";
import { Entity } from "@bonsai/entity";
import { Feature, type TFeatureCallbacks, type TFeatureContext } from "@bonsai/feature";
import type { TCausalContext, TChannelToken } from "@bonsai/kernel";
import { Composer, type TComposerContract, type TComposeContext, type TComposition } from "@bonsai/composer";
import { Foundation } from "@bonsai/foundation";
import { View, type TViewContract } from "@bonsai/view";

// ─── Domain: an ordered list of names, with a "variant" per name ────────────

type TRow = { id: string; variant: string };
class ListEntity extends Entity<{ rows: TRow[] }> {
  protected defineInitialState() { return { rows: [{ id: "a", variant: "x" }, { id: "b", variant: "x" }] }; }
}
type TListDef = {
  commands: { set: TRow[] };
  events: { changed: null };
  queries: { rows: { params: null; result: TRow[] } };
};
const listListens = [] as const;
class ListFeature
  extends Feature<ListEntity, TListDef, "list">
  implements TFeatureCallbacks<TListDef, typeof listListens, ListEntity>
{
  static readonly channel: TChannelToken<TListDef, "list"> = { namespace: "list", events: ["changed"] };
  get listens() { return listListens; }
  get queries() { return [] as const; }
  protected get Entity() { return ListEntity; }
  onSetCommand(rows: TRow[], ctx: TFeatureContext<TListDef, ListEntity>): void {
    ctx.mutate("set", (d) => { d.rows = rows; });
    ctx.emit("changed", null);
  }
  onRowsQuery(): TRow[] { return this.entity.state.rows; }
}

// ─── Views: one element per row, marked with the variant it was created with ─

type TNoContract = TViewContract<Record<string, never>, Record<string, never>>;
const created: string[] = [];
class RowView extends View<TNoContract> {
  get features() { return {}; }
  get uiEvents() { return {}; }
  get uiElements() { return {}; }
  get template() { return "row"; }
}
/** When set, creating an OtherView fails inside the Composer's unit (C.1). */
let failOther = false;
class OtherView extends RowView {
  override get template() {
    if (failOther) throw new Error("other cannot render");
    return "other";
  }
}

const features = { list: { feature: ListFeature, listens: ["changed"] as const, queries: ["rows"] as const } };
const views = { row: RowView, other: OtherView };
type TC = TComposerContract<typeof features, typeof views>;

let viewOf: (row: TRow) => "row" | "other" = () => "row";
let paramsOf: (row: TRow) => Record<string, string> = (r) => ({ variant: r.variant });
const causes: TCausalContext[] = [];
class ListComposer extends Composer<TC> {
  get features() { return features; }
  get views() { return views; }
  resolve(ctx: TComposeContext<TC>): TComposition<TC> {
    causes.push(ctx.cause);
    return ctx.query("list:rows", null).map((r) => ({ view: viewOf(r), key: r.id, params: paramsOf(r) }));
  }
}
class Page extends Foundation {
  get composers() { return { main: { slot: "#main", composer: ListComposer } } as const; }
}

const setup = () => drive({ list: ListFeature }, { foundation: Page, document });
const parts = () => Array.from(document.querySelectorAll("#main > [data-bonsai-part]")) as HTMLElement[];
const keys = () => parts().map((p) => p.getAttribute("data-bonsai-part"));

describe("Composer on the kernel", () => {
  beforeEach(() => {
    resetDOM();
    document.body.innerHTML = `<div id="main"></div>`;
    created.length = 0;
    viewOf = () => "row";
    paramsOf = (r) => ({ variant: r.variant });
    failOther = false;
    causes.length = 0;
  });

  it("I54 / ADR-04 — resolve reads the causal context: startup, then a continuation of the Event", () => {
    const d = setup();
    expect(causes[0]!.originKind).toBe("startup");
    d.send("list", "set", [{ id: "a", variant: "x" }]);
    const last = causes[causes.length - 1]!;
    expect(last.originKind).toBe("spontaneous");                   // the probe's fact → Command → Event
    expect(last.depth).toBeGreaterThanOrEqual(2);
    expect(Object.isFrozen(last)).toBe(true);
  });

  it("I37 — creates the Views of the initial composition, in order", () => {
    const d = setup();
    expect(keys()).toEqual(["a", "b"]);
    expect(d.failures()).toEqual([]);
  });

  it("recomputes from the domain when a declared Event is delivered", () => {
    const d = setup();
    d.send("list", "set", [{ id: "a", variant: "x" }, { id: "b", variant: "x" }, { id: "c", variant: "x" }]);
    expect(keys()).toEqual(["a", "b", "c"]);
    expect(d.failures()).toEqual([]);
  });

  it("keeps the instance of a View whose key, View and params are unchanged", () => {
    const d = setup();
    const [a, b] = parts();
    d.send("list", "set", [{ id: "a", variant: "x" }, { id: "b", variant: "x" }, { id: "c", variant: "x" }]);
    expect(parts()[0]).toBe(a);
    expect(parts()[1]).toBe(b);
  });

  it("places a new View in the middle where the composition says (explicit order)", () => {
    const d = setup();
    d.send("list", "set", [{ id: "a", variant: "x" }, { id: "n", variant: "x" }, { id: "b", variant: "x" }]);
    expect(keys()).toEqual(["a", "n", "b"]);
  });

  it("I19, I20 — destroys a View whose key disappeared, with its part", () => {
    const d = setup();
    d.send("list", "set", [{ id: "b", variant: "x" }]);
    expect(keys()).toEqual(["b"]);
    expect(d.failures()).toEqual([]);
  });

  it("destroys then creates again when the params change", () => {
    const d = setup();
    const [a, b] = parts();
    d.send("list", "set", [{ id: "a", variant: "x" }, { id: "b", variant: "y" }]);
    expect(parts()[0]).toBe(a);
    expect(parts()[1]).not.toBe(b);
    expect(keys()).toEqual(["a", "b"]);
  });

  it("destroys then creates again when the View of a key changes", () => {
    const d = setup();
    const [, b] = parts();
    viewOf = (r) => (r.id === "b" ? "other" : "row");
    d.send("list", "set", [{ id: "a", variant: "x" }, { id: "b", variant: "x" }]);
    expect(parts()[1]).not.toBe(b);
    expect(parts()[1]!.textContent).toBe("other");
  });

  it("a duplicate key fails the unit and leaves the slot as it was (G7)", () => {
    const d = setup();
    d.send("list", "set", [{ id: "a", variant: "x" }, { id: "a", variant: "y" }]);
    expect(d.failures().length).toBeGreaterThan(0);
    expect(keys()).toEqual(["a", "b"]);
  });

  it("a View outside the catalogue fails the unit", () => {
    const d = setup();
    viewOf = () => "ghost" as never;
    d.send("list", "set", [{ id: "a", variant: "x" }]);
    expect(String((d.failures().at(-1)!.error as Error).message)).toMatch(/not in the catalogue/);
    expect(keys()).toEqual(["a", "b"]);
  });

  it("I35 — the bookkeeping is rolled back with the unit: the next composition reconciles against what exists", () => {
    const d = setup();
    d.send("list", "set", [{ id: "a", variant: "x" }, { id: "a", variant: "y" }]); // fails
    d.send("list", "set", [{ id: "a", variant: "x" }, { id: "b", variant: "x" }, { id: "c", variant: "x" }]);
    expect(keys()).toEqual(["a", "b", "c"]);
  });

  it("a unit failing after it destroyed and created Views restores the bookkeeping (G7)", () => {
    const d = setup();
    const [a, b] = parts();
    failOther = true;
    viewOf = (r) => (r.id === "c" ? "other" : "row");
    // b changes variant (destroyed, then created again), n is new, c fails to render: the unit fails.
    d.send("list", "set", [{ id: "a", variant: "x" }, { id: "b", variant: "y" }, { id: "n", variant: "x" }, { id: "c", variant: "x" }]);
    const failed = d.failures().length;
    expect(failed).toBeGreaterThan(0);
    expect(parts()).toEqual([a, b]);
    // Reconciled against what really exists: a and b unchanged are kept, n and c are created for real.
    failOther = false;
    d.send("list", "set", [{ id: "a", variant: "x" }, { id: "b", variant: "x" }, { id: "n", variant: "x" }, { id: "c", variant: "x" }]);
    expect(d.failures()).toHaveLength(failed);
    expect(keys()).toEqual(["a", "b", "n", "c"]);
    expect(parts()[0]).toBe(a);
    expect(parts()[1]).toBe(b);
    // And b changing variant now is a plain replacement.
    d.send("list", "set", [{ id: "a", variant: "x" }, { id: "b", variant: "y" }, { id: "n", variant: "x" }, { id: "c", variant: "x" }]);
    expect(d.failures()).toHaveLength(failed);
    expect(keys()).toEqual(["a", "b", "n", "c"]);
    expect(parts()[1]).not.toBe(b);
  });

  it("compares params by value: the same params with keys in another order keep the View", () => {
    let flip = false;
    paramsOf = (r) => (flip ? { variant: r.variant, id: r.id } : { id: r.id, variant: r.variant });
    const d = setup();
    const [a, b] = parts();
    flip = true;
    d.send("list", "set", [{ id: "a", variant: "x" }, { id: "b", variant: "x" }]);
    expect(parts()[0]).toBe(a);
    expect(parts()[1]).toBe(b);
    expect(d.failures()).toEqual([]);
  });

  it("I35 — has no triggers lane and no emit: a Composer addresses nothing (D12)", () => {
    const c = new ListComposer() as unknown as Record<string, unknown>;
    for (const name of ["trigger", "emit", "request"]) expect(c[name]).toBeUndefined();
  });
});
