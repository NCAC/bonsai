/**
 * Test — Pug compiler: behaviour of the generated templates
 * (strate 1c, lot 4, ADR-22, 5-rendu §4, §8, §11.4)
 *
 * Each template is compiled, transpiled and run in jsdom the way a View runs
 * it: `create()` then `setup()` at creation, `project()` at each re-run.
 * Projection is surgical: unchanged data produce no mutation, kept nodes keep
 * their identity.
 *
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { load, mount, mutations, html, compile } from "../../helpers/pug";

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("Static content", () => {
  it("builds tags, classes, id, static attributes and text", () => {
    const t = load(`
.Card#main(role="note" data-n=3 hidden)
  h2.Card-title.is Hello & welcome
  p
    | first
    | second
  input(type="checkbox" checked=true disabled=false)
  br`);
    const { container, nodes } = mount(t, undefined);
    expect(container.innerHTML).toBe(
      '<div class="Card" id="main" role="note" data-n="3" hidden=""><h2 class="Card-title is">Hello &amp; welcome</h2>' +
        '<p>first\nsecond</p><input type="checkbox" checked=""><br></div>'
    );
    expect(nodes).toEqual({});
  });

  it("decodes HTML entities of text into characters", () => {
    const t = load(`p a &lt;b&gt; &amp; &#233;&#x41;&nbsp;`);
    expect(mount(t, undefined).container.textContent).toBe("a <b> & éA ");
  });

  it("ignores comments, buffered or not", () => {
    const t = load(`// shown in Pug, not here\n//- hidden\np x`);
    expect(mount(t, undefined).container.innerHTML).toBe("<p>x</p>");
  });
});

describe("Text and attributes", () => {
  const src = `//- @data { name: string; count: number; state: string | null; flag: boolean }
p.greeting(data-state=state title=name aria-hidden=flag) Hello #{name}, you have #{count} items
span= count * 2`;
  type TData = { name: string; count: number; state: string | null; flag: boolean };

  it("create sets the values; nullish renders as empty text", () => {
    const t = load<TData>(src);
    const { container } = mount(t, { name: "Ana", count: 2, state: "open", flag: true });
    expect(container.innerHTML).toBe(
      '<p class="greeting" data-state="open" title="Ana" aria-hidden="">Hello Ana, you have 2 items</p><span>4</span>'
    );
  });

  it("project mutates only what changed, nothing when the data are equal", () => {
    const t = load<TData>(src);
    const m = mount(t, { name: "Ana", count: 2, state: "open", flag: true });
    const p = m.container.querySelector("p")!;
    expect(mutations(m.container, () => m.project({ name: "Ana", count: 2, state: "open", flag: true }))).toEqual([]);

    const records = mutations(m.container, () => m.project({ name: "Ana", count: 3, state: null, flag: false }));
    expect(m.container.querySelector("p")).toBe(p);
    expect(p.outerHTML).toBe('<p class="greeting" title="Ana">Hello Ana, you have 3 items</p>');
    expect(m.container.querySelector("span")!.textContent).toBe("6");
    expect(records.map((r) => r.attributeName ?? r.type).sort()).toEqual(["aria-hidden", "childList", "childList", "data-state"]);

    m.project({ name: "Bo", count: 3, state: "closed", flag: false });
    expect(p.getAttribute("data-state")).toBe("closed");
    expect(p.getAttribute("title")).toBe("Bo");
  });

  it("mixed content: each text run is one located text node", () => {
    const t = load<{ who: string; n: number }>(`//- @data { who: string; n: number }
p Hi #{who}, #[b bold #{n}] and #{n} more
  em !`);
    const m = mount(t, { who: "A", n: 1 });
    expect(m.container.innerHTML).toBe("<p>Hi A, <b>bold 1</b> and 1 more<em>!</em></p>");
    const before = Array.from(m.container.querySelector("p")!.childNodes);
    m.project({ who: "B", n: 2 });
    expect(m.container.innerHTML).toBe("<p>Hi B, <b>bold 2</b> and 2 more<em>!</em></p>");
    expect(Array.from(m.container.querySelector("p")!.childNodes)).toEqual(before);
  });

  it("globals are not data fields; arrow parameters are local", () => {
    const t = load<{ xs: number[] }>(`//- @data { xs: number[] }
p= Math.max(...xs.map((x) => x * 2)) + " " + JSON.stringify({ xs })`);
    expect(mount(t, { xs: [1, 3] }).container.textContent).toBe('6 {"xs":[1,3]}');
  });
});

describe("each — keyed lists (ProjectionList)", () => {
  type TItem = { id: string; label: string };
  const src = `//- @data { items: readonly { id: string; label: string }[]; unit: string }
ul.list
  each item, i in items
    li(data-item-id=item.id data-pos=i)
      span.label= item.label
      span.unit= unit`;
  const data = (ids: string, unit = "€") => ({ items: ids.split("").map((id): TItem => ({ id, label: id.toUpperCase() })), unit });
  const lis = (c: Element) => Array.from(c.querySelectorAll("li"));

  it("creates one keyed element per item", () => {
    const m = mount(load(src), data("abc"));
    expect(lis(m.container).map((li) => li.getAttribute("data-item-id"))).toEqual(["a", "b", "c"]);
    expect(lis(m.container).map((li) => li.textContent)).toEqual(["A€", "B€", "C€"]);
  });

  it("reorders, inserts and removes while keeping the elements of kept items", () => {
    const m = mount(load(src), data("abc"));
    const [a, , c] = lis(m.container);
    m.project(data("cxa"));
    const after = lis(m.container);
    expect(after.map((li) => li.getAttribute("data-item-id"))).toEqual(["c", "x", "a"]);
    expect(after[0]).toBe(c);
    expect(after[2]).toBe(a);
    expect(after.map((li) => li.getAttribute("data-pos"))).toEqual(["0", "1", "2"]);
    expect(after[1]!.textContent).toBe("X€");
  });

  it("re-projects items when the enclosing scope changes", () => {
    const m = mount(load(src), data("ab"));
    m.project(data("ab", "$"));
    expect(lis(m.container).map((li) => li.textContent)).toEqual(["A$", "B$"]);
  });

  it("an unchanged list produces no mutation", () => {
    const m = mount(load(src), data("abc"));
    expect(mutations(m.container, () => m.project(data("abc")))).toEqual([]);
  });

  it("a list may be the whole template", () => {
    const t = load<{ xs: { k: number }[] }>(`//- @data { xs: { k: number }[] }
each x in xs
  i(data-key=x.k)= x.k`);
    const m = mount(t, { xs: [{ k: 1 }, { k: 2 }] });
    expect(m.container.innerHTML).toBe('<i data-key="1">1</i><i data-key="2">2</i>');
    m.project({ xs: [{ k: 2 }, { k: 3 }] });
    expect(m.container.innerHTML).toBe('<i data-key="2">2</i><i data-key="3">3</i>');
  });

  it("nested lists reconcile at each level, the inner one reading the outer item", () => {
    type TCat = { id: string; products: { id: number; name: string }[] };
    const t = load<{ cats: TCat[] }>(`//- @data { cats: { id: string; products: { id: number; name: string }[] }[] }
each cat in cats
  section(data-item-id=cat.id)
    ul
      each p in cat.products
        li(data-item-id=p.id) #{cat.id}/#{p.name}`);
    const m = mount(t, { cats: [{ id: "c1", products: [{ id: 1, name: "a" }, { id: 2, name: "b" }] }, { id: "c2", products: [] }] });
    expect(m.container.textContent).toBe("c1/ac1/b");
    const li2 = m.container.querySelector("li[data-item-id='2']");
    m.project({ cats: [{ id: "c2", products: [{ id: 9, name: "z" }] }, { id: "c1", products: [{ id: 2, name: "B" }] }] });
    expect(m.container.textContent).toBe("c2/zc1/B");
    expect(m.container.querySelector("li[data-item-id='2']")).toBe(li2);
  });

  it("a duplicate key is an error of the projection", () => {
    const m = mount(load(src), data("ab"));
    expect(() => m.project(data("aa"))).toThrow(/duplicate key "a"/);
  });
});

describe("if / else if / else — conditional zones (ProjectionSwitch)", () => {
  const src = `//- @data { n: number; label: string }
div
  if n > 10
    strong big #{label}
  else if n > 0
    | small #{label}
    em !
  else
    i none
  span.after= label`;

  it("creates the active branch between markers", () => {
    const m = mount(load(src), { n: 5, label: "x" });
    expect(m.container.innerHTML).toBe('<div><!--bonsai-if:1-->small x<em>!</em><!--/bonsai-if--><span class="after">x</span></div>');
  });

  it("switches branches, projects the kept branch, and keeps locating what follows", () => {
    const m = mount(load(src), { n: 5, label: "x" });
    const div = m.container.firstElementChild!;
    m.project({ n: 6, label: "y" });
    expect(html(div)).toBe('small y<em>!</em><span class="after">y</span>');
    m.project({ n: 50, label: "z" });
    expect(html(div)).toBe('<strong>big z</strong><span class="after">z</span>');
    m.project({ n: 0, label: "w" });
    expect(html(div)).toBe('<i>none</i><span class="after">w</span>');
    m.project({ n: 20, label: "v" });
    expect(html(div)).toBe('<strong>big v</strong><span class="after">v</span>');
  });

  it("keeping the branch and the data produces no mutation", () => {
    const m = mount(load(src), { n: 50, label: "x" });
    expect(mutations(m.container, () => m.project({ n: 60, label: "x" }))).toEqual([]);
  });

  it("an if without else renders nothing when its test fails; unless negates", () => {
    const t = load<{ on: boolean }>(`//- @data { on: boolean }
if on
  b on
unless on
  i off
p end`);
    const m = mount(t, { on: false });
    expect(html(m.container)).toBe("<i>off</i><p>end</p>");
    m.project({ on: true });
    expect(html(m.container)).toBe("<b>on</b><p>end</p>");
  });

  it("nested and sibling zones at the same level", () => {
    const t = load<{ a: boolean; b: boolean }>(`//- @data { a: boolean; b: boolean }
if a
  if b
    | ab
  else
    | a
  | ;
if b
  | b`);
    const m = mount(t, { a: true, b: true });
    expect(html(m.container)).toBe("ab;b");
    m.project({ a: true, b: false });
    expect(html(m.container)).toBe("a;");
    m.project({ a: false, b: true });
    expect(html(m.container)).toBe("b");
    m.project({ a: true, b: true });
    expect(html(m.container)).toBe("ab;b");
  });

  it("a zone inside a list item follows its item", () => {
    const t = load<{ xs: { id: number; done: boolean }[] }>(`//- @data { xs: { id: number; done: boolean }[] }
ul
  each x in xs
    li(data-item-id=x.id)
      if x.done
        s= x.id
      else
        b= x.id`);
    const m = mount(t, { xs: [{ id: 1, done: false }, { id: 2, done: true }] });
    expect(html(m.container)).toBe('<ul><li data-item-id="1"><b>1</b></li><li data-item-id="2"><s>2</s></li></ul>');
    m.project({ xs: [{ id: 2, done: false }, { id: 1, done: true }] });
    expect(html(m.container)).toBe('<ul><li data-item-id="2"><b>2</b></li><li data-item-id="1"><s>1</s></li></ul>');
  });

  it("a list inside a branch is set up when the branch appears", () => {
    const t = load<{ xs: { id: number }[] }>(`//- @data { xs: { id: number }[] }
if xs.length
  ol
    each x in xs
      li(data-item-id=x.id)= x.id
else
  p empty`);
    const m = mount(t, { xs: [] });
    expect(html(m.container)).toBe("<p>empty</p>");
    m.project({ xs: [{ id: 1 }] });
    expect(html(m.container)).toBe('<ol><li data-item-id="1">1</li></ol>');
    const li = m.container.querySelector("li");
    m.project({ xs: [{ id: 1 }, { id: 2 }] });
    expect(m.container.querySelector("li")).toBe(li);
    expect(m.container.querySelectorAll("li")).toHaveLength(2);
  });
});

describe("Mixins — inlined at compile time", () => {
  it("parameters are evaluated in the caller's scope, block in the caller's", () => {
    type TData = { items: { id: number; price: number }[]; currency: string };
    const t = load<TData>(`//- @data { items: { id: number; price: number }[]; currency: string }
mixin price(amount, unit)
  span.price #{amount.toFixed(2)} #{unit}
  block

mixin row(it)
  li(data-item-id=it.id)
    +price(it.price, currency)
      small= it.id

ul
  each item in items
    +row(item)`);
    const m = mount(t, { items: [{ id: 1, price: 2 }, { id: 2, price: 3.5 }], currency: "€" });
    expect(m.container.innerHTML).toBe(
      '<ul><li data-item-id="1"><span class="price">2.00 €</span><small>1</small></li>' +
        '<li data-item-id="2"><span class="price">3.50 €</span><small>2</small></li></ul>'
    );
    m.project({ items: [{ id: 2, price: 4 }], currency: "$" });
    expect(m.container.innerHTML).toBe('<ul><li data-item-id="2"><span class="price">4.00 $</span><small>2</small></li></ul>');
  });

  it("a variable of the caller shadowed by a parameter stays distinct", () => {
    const t = load<{ x: string }>(`//- @data { x: string }
mixin m(x)
  b= x
  block
+m("inner")
  i= x`);
    expect(mount(t, { x: "outer" }).container.innerHTML).toBe("<b>inner</b><i>outer</i>");
  });

  it("a missing argument is undefined; a mixin without block ignores the caller's", () => {
    const t = load(`mixin m(a, b)
  b= b === undefined ? "none" : b
+m(1)`);
    expect(mount(t, undefined).container.innerHTML).toBe("<b>none</b>");
  });
});

describe("Setup on an existing DOM", () => {
  it("setup locates the nodes of a DOM built by create without changing it", () => {
    const t = load<{ a: string; xs: { id: number }[] }>(`//- @data { a: string; xs: { id: number }[] }
p= a
if a
  b= a
ul
  each x in xs
    li(data-item-id=x.id)= x.id`);
    const container = document.createElement("div");
    container.append(t.create({ a: "1", xs: [{ id: 1 }] }));
    const before = container.innerHTML;
    const records = mutations(container, () => {
      const nodes = t.setup(container);
      t.project(nodes, { a: "1", xs: [{ id: 1 }] });
    });
    expect(records).toEqual([]);
    expect(container.innerHTML).toBe(before);
  });

  it("a DOM that does not match the template is an error", () => {
    const t = load<{ a: boolean }>(`//- @data { a: boolean }
if a
  b x`);
    const container = document.createElement("div");
    container.innerHTML = "<b>x</b>";
    expect(() => t.setup(container)).toThrow(/does not match the template/);
  });
});

describe("Generated module", () => {
  it("exports the template under a name derived from the file, and its data type", () => {
    const code = compile(`//- @data { a: string }\np= a`, "src/cart-items.template.pug");
    expect(code).toContain("export const CartItemsTemplate: TProjectionTemplate<TData, ReturnType<typeof $s0>>");
    expect(code).toContain("export type TCartItemsTemplateData = { a: string };");
    expect(code).toContain('from "@bonsai/view"');
  });

  it("a multi-line @data block comment declares the type", () => {
    const code = compile(`//- @data
  {
    a: string
  }
p= a`);
    expect(code).toMatch(/export type TTestTemplateData = \{\s*a: string\s*\};/);
  });

  it("a static template has undefined data", () => {
    expect(compile(`p x`)).toContain("export type TTestTemplateData = undefined;");
  });
});
