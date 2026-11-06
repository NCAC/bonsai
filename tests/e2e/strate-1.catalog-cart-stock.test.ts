/**
 * TEST GATE — Strate 1 : catalog / cart / stock, causal context across Features
 *
 * Scenario (ADR-31, strate 1d):
 *
 *   - three Features: `catalog` (products), `cart` (reads the price in `catalog`),
 *     `stock` (listens to `cart`);
 *   - one `ProductView` per product, under its key, rendered by a **compiled Pug
 *     template** (mode C, zone `card`); each hosts a nested `StockBadgeView`
 *     (slot declared by `View.composers`) projected **without template**, in N1;
 *   - a `CartSummaryView`, also without template, in a second slot.
 *
 *   click on a card → fact → `cart:addProduct` → `cart.productAdded` →
 *   `stock.levelChanged` → views. One click is one origin: every delivery of the
 *   chain carries the same `originId`, the `parentId` of each is the previous
 *   link, and `depth` grows by one. Handlers read it through `ctx.cause`.
 *   Discontinuing a product destroys its card only, and the nested View with it.
 *
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { drive } from "../helpers/drive";
import { resetDOM } from "../helpers/dom-setup";
import { Entity } from "@bonsai/entity";
import type { TChannelToken, TCausalContext } from "@bonsai/kernel";
import {
  Feature,
  type TFeatureContract,
  type TFeatureCallbacks,
  type TFeatureContext,
  type TFeatureQueryContext
} from "@bonsai/feature";
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
  type TEventContext
} from "@bonsai/view";
import { ProductCardTemplate } from "../fixtures/templates/product-card.template";

// ─── Recording of the causal context read by the handlers ───────────────────

const seen: Array<{ step: string; cause: TCausalContext }> = [];

// ─── catalog ────────────────────────────────────────────────────────────────

type TProduct = { id: string; name: string; price: number; discontinued: boolean };
class CatalogEntity extends Entity<{ products: TProduct[] }> {
  protected defineInitialState() {
    return {
      products: [
        { id: "p1", name: "Bonsai", price: 40, discontinued: false },
        { id: "p2", name: "Pot", price: 12.5, discontinued: false },
        { id: "p3", name: "Shears", price: 25, discontinued: false }
      ]
    };
  }
}
type TCatalogDef = {
  commands: { discontinue: { productId: string } };
  events: { changed: null };
  queries: {
    products: { params: null; result: readonly TProduct[] };
    product: { params: { id: string }; result: TProduct };
    price: { params: { id: string }; result: number };
  };
};
class CatalogFeature
  extends Feature<CatalogEntity, TCatalogDef, "catalog">
  implements TFeatureCallbacks<TCatalogDef, readonly [], CatalogEntity>
{
  static readonly channel: TChannelToken<TCatalogDef, "catalog"> = { namespace: "catalog", events: ["changed"] };
  get listens() { return [] as const; }
  get queries() { return [] as const; }
  protected get Entity() { return CatalogEntity; }
  onDiscontinueCommand(payload: { productId: string }, ctx: TFeatureContext<TCatalogDef, CatalogEntity>): void {
    ctx.mutate("discontinue", (d) => {
      const product = d.products.find((p) => p.id === payload.productId);
      if (product !== undefined) product.discontinued = true;
    });
    ctx.emit("changed", null);
  }
  onProductsQuery(): readonly TProduct[] { return this.entity.state.products.filter((p) => !p.discontinued); }
  onProductQuery(params: { id: string }): TProduct { return this.entity.state.products.find((p) => p.id === params.id)!; }
  onPriceQuery(params: { id: string }): number { return this.entity.state.products.find((p) => p.id === params.id)!.price; }
}

// ─── cart (reads the price in catalog) ──────────────────────────────────────

type TLine = { productId: string; qty: number; price: number };
class CartEntity extends Entity<{ lines: TLine[] }> {
  protected defineInitialState() { return { lines: [] }; }
}
type TCartDef = {
  commands: { addProduct: { productId: string } };
  events: { productAdded: { productId: string } };
  queries: { count: { params: null; result: number }; total: { params: null; result: number } };
};
class CartFeature
  extends Feature<CartEntity, TCartDef, "cart">
  implements TFeatureCallbacks<TCartDef, readonly [], CartEntity>
{
  static readonly channel: TChannelToken<TCartDef, "cart"> = { namespace: "cart", events: ["productAdded"] };
  get listens() { return [] as const; }
  get queries() { return [CatalogFeature.channel] as const; }
  protected get Entity() { return CartEntity; }
  onAddProductCommand(payload: { productId: string }, ctx: TFeatureContext<TCartDef, CartEntity>): void {
    seen.push({ step: "cart.addProduct", cause: ctx.cause });
    const price = ctx.query(CatalogFeature.channel, "price", { id: payload.productId });
    ctx.mutate("addProduct", (d) => {
      const line = d.lines.find((l) => l.productId === payload.productId);
      if (line === undefined) d.lines.push({ productId: payload.productId, qty: 1, price });
      else line.qty++;
    });
    ctx.emit("productAdded", { productId: payload.productId });
  }
  onCountQuery(_p: null, _ctx: TFeatureQueryContext): number { return this.entity.state.lines.reduce((n, l) => n + l.qty, 0); }
  onTotalQuery(_p: null, _ctx: TFeatureQueryContext): number { return this.entity.state.lines.reduce((n, l) => n + l.qty * l.price, 0); }
}

// ─── stock (listens to cart) ────────────────────────────────────────────────

class StockEntity extends Entity<{ levels: Record<string, number> }> {
  protected defineInitialState() { return { levels: { p1: 3, p2: 5, p3: 1 } }; }
}
type TStockDef = {
  commands: Record<never, never>;
  events: { levelChanged: { productId: string; level: number } };
  queries: { total: { params: null; result: number } };
};
const stockListens = [CartFeature.channel] as const;
class StockFeature
  extends Feature<StockEntity, TStockDef, "stock">
  implements TFeatureCallbacks<TStockDef, typeof stockListens, StockEntity>
{
  static readonly channel: TChannelToken<TStockDef, "stock"> = { namespace: "stock", events: ["levelChanged"] };
  get listens() { return stockListens; }
  get queries() { return [] as const; }
  protected get Entity() { return StockEntity; }
  onCartProductAddedEvent(payload: { productId: string }, ctx: TFeatureContext<TStockDef, StockEntity>): void {
    seen.push({ step: "stock.productAdded", cause: ctx.cause });
    let level = 0;
    ctx.mutate("decrement", (d) => { level = --d.levels[payload.productId]; });
    ctx.emit("levelChanged", { productId: payload.productId, level });
  }
  onTotalQuery(): number { return Object.values(this.entity.state.levels).reduce((n, l) => n + l, 0); }
}

// ─── StockBadgeView: nested, no template (N1 through getUI) ─────────────────

const badgeFeatures = {
  stock: { feature: StockFeature, listens: ["levelChanged"] as const, triggers: [] as const, queries: ["total"] as const }
} satisfies TFeatureContract;
const badgeUiEvents = { level: ui<HTMLElement>()([]) } satisfies TUIContract;
const badgeUiElements = { level: "[data-ui='level']" } satisfies TUIElements<typeof badgeUiEvents>;
type TBadgeContract = TViewContract<typeof badgeFeatures, typeof badgeUiEvents>;
class StockBadgeView extends View<TBadgeContract> implements TViewCallbacks<TBadgeContract> {
  get features() { return badgeFeatures; }
  get uiEvents() { return badgeUiEvents; }
  get uiElements() { return badgeUiElements; }
  get template() { return `<span data-ui="level">…</span>`; }
  onStockLevelChangedEvent(_payload: unknown, ctx: TEventContext<TBadgeContract>): void {
    this.getUI("level").text(String(ctx.query("stock:total", null)));
  }
}
class BadgeComposer extends Composer<TComposerContract<Record<string, never>, { badge: typeof StockBadgeView }>> {
  get features() { return {}; }
  get views() { return { badge: StockBadgeView }; }
  resolve() { return [{ view: "badge" as const, key: "badge" }]; }
}

// ─── ProductView: Pug template (zone `card`) + nested slot ──────────────────

const productFeatures = {
  catalog: { feature: CatalogFeature, listens: ["changed"] as const, triggers: [] as const, queries: ["product"] as const },
  cart: { feature: CartFeature, listens: [] as const, triggers: ["addProduct"] as const, queries: [] as const }
} satisfies TFeatureContract;
const productUiEvents = {
  card: ui<HTMLDivElement>()([]),
  add: ui<HTMLButtonElement>()(["click"])
} satisfies TUIContract;
const productUiElements = { card: "[data-ui='card']", add: ".add" } satisfies TUIElements<typeof productUiEvents>;
type TProductContract = TViewContract<typeof productFeatures, typeof productUiEvents, { productId: string }>;

const productTemplates = {
  card: bind<TProductContract>()({
    template: ProductCardTemplate,
    query: "catalog:product",
    params: (viewParams) => ({ id: viewParams.productId }),
    on: ["catalog:changed"]
  })
} as const;

class ProductView extends View<TProductContract> implements TViewCallbacks<TProductContract, typeof productTemplates> {
  get features() { return productFeatures; }
  get uiEvents() { return productUiEvents; }
  get uiElements() { return productUiElements; }
  get template() { return `<div data-ui="card"></div><div class="stock-slot"></div>`; }
  override get templates(): TViewTemplates<TProductContract> { return productTemplates; }
  override get composers() { return { stock: { slot: ".stock-slot", composer: BadgeComposer } } as const; }
  onAddClick(_fact: TFact, ctx: TFactContext<TProductContract>): void {
    ctx.trigger("cart:addProduct", { productId: this.params.productId });
  }
}

// ─── CartSummaryView: no template ───────────────────────────────────────────

const summaryFeatures = {
  cart: { feature: CartFeature, listens: ["productAdded"] as const, triggers: [] as const, queries: ["count", "total"] as const }
} satisfies TFeatureContract;
const summaryUiEvents = { count: ui<HTMLElement>()([]), total: ui<HTMLElement>()([]) } satisfies TUIContract;
const summaryUiElements = { count: "[data-ui='count']", total: "[data-ui='total']" } satisfies TUIElements<typeof summaryUiEvents>;
type TSummaryContract = TViewContract<typeof summaryFeatures, typeof summaryUiEvents>;
class CartSummaryView extends View<TSummaryContract> implements TViewCallbacks<TSummaryContract> {
  get features() { return summaryFeatures; }
  get uiEvents() { return summaryUiEvents; }
  get uiElements() { return summaryUiElements; }
  get template() { return `<span data-ui="count">0</span><span data-ui="total">0.00</span>`; }
  onCartProductAddedEvent(_payload: unknown, ctx: TEventContext<TSummaryContract>): void {
    this.getUI("count").text(String(ctx.query("cart:count", null)));
    this.getUI("total").text(ctx.query("cart:total", null).toFixed(2));
  }
}

// ─── Composers and Foundation ───────────────────────────────────────────────

const catalogComposerFeatures = {
  catalog: { feature: CatalogFeature, listens: ["changed"] as const, queries: ["products"] as const }
};
const catalogViews = { product: ProductView };
type TCatalogComposer = TComposerContract<typeof catalogComposerFeatures, typeof catalogViews>;
class CatalogComposer extends Composer<TCatalogComposer> {
  get features() { return catalogComposerFeatures; }
  get views() { return catalogViews; }
  resolve(ctx: TComposeContext<TCatalogComposer>): TComposition<TCatalogComposer> {
    seen.push({ step: "catalogComposer.resolve", cause: ctx.cause });
    return ctx.query("catalog:products", null).map((p) => ({ view: "product" as const, key: p.id, params: { productId: p.id } }));
  }
}
class SummaryComposer extends Composer<TComposerContract<Record<string, never>, { summary: typeof CartSummaryView }>> {
  get features() { return {}; }
  get views() { return { summary: CartSummaryView }; }
  resolve() { return [{ view: "summary" as const, key: "summary" }]; }
}
class Page extends Foundation {
  get composers() {
    return {
      catalog: { slot: "#catalog", composer: CatalogComposer },
      summary: { slot: "#summary", composer: SummaryComposer }
    } as const;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const q = <T extends Element>(selector: string): T => document.querySelector(selector) as T;
const card = (id: string): HTMLElement => q(`article[data-product-id='${id}']`);
const cards = (): string[] => Array.from(document.querySelectorAll("article")).map((a) => a.getAttribute("data-product-id")!);
const badges = (): string[] => Array.from(document.querySelectorAll(".stock-slot [data-ui='level']")).map((b) => b.textContent!);

const mount = () => drive({ catalog: CatalogFeature, cart: CartFeature, stock: StockFeature }, { foundation: Page, document });

describe("🚪 GATE Strate 1 — catalog / cart / stock, causal context [ADR-31]", () => {
  beforeEach(() => {
    resetDOM();
    document.body.innerHTML = `<div id="summary"></div><div id="catalog"></div>`;
    seen.length = 0;
  });

  it("one card per product, rendered by the compiled Pug template; nested View and summary without template", () => {
    const d = mount();
    expect(cards()).toEqual(["p1", "p2", "p3"]);
    expect(card("p2").querySelector(".name")!.textContent).toBe("Pot");
    expect(card("p2").querySelector(".price")!.textContent).toBe("12.5");
    expect(badges()).toEqual(["…", "…", "…"]);
    expect(q("[data-ui='count']").textContent).toBe("0");
    expect(d.failures()).toEqual([]);
  });

  it("a click crosses three Features under one origin; handlers read the chain through ctx.cause", () => {
    const d = mount();
    seen.length = 0;
    (card("p2").querySelector(".add") as HTMLElement).click();

    // Views, without template: summary and every nested badge are projected in N1
    expect(q("[data-ui='count']").textContent).toBe("1");
    expect(q("[data-ui='total']").textContent).toBe("12.50");
    expect(badges()).toEqual(["8", "8", "8"]); // stock total: 3 + 5 + 1, minus the unit added

    const [command, event] = seen.map((s) => s.cause);
    expect(seen.map((s) => s.step)).toEqual(["cart.addProduct", "stock.productAdded"]);
    expect(command.originKind).toBe(event.originKind);
    expect(event.originId).toBe(command.originId);        // same origin
    expect(event.parentId).toBe(command.id);              // the Event comes from the Command's unit
    expect(event.depth).toBe(command.depth + 1);

    // Trace: every delivery of the chain carries the origin of the click
    const origin = command.originId;
    const chain = d.root.trace.flatMap((e) =>
      e.type === "delivered" && e.context.originId === origin ? [`${e.kind}:${e.to}:${e.name}`] : []
    );
    expect(chain).toEqual(expect.arrayContaining(["command:cart:addProduct", "event:stock:productAdded"]));
    expect(d.failures()).toEqual([]);
  });

  it("discontinuing a product destroys its card and its nested View, and only those", () => {
    const d = mount();
    const [p1, p3] = [card("p1"), card("p3")];
    d.send("catalog", "discontinue", { productId: "p2" });

    expect(cards()).toEqual(["p1", "p3"]);
    expect(card("p1")).toBe(p1);                     // untouched cards keep their nodes
    expect(card("p3")).toBe(p3);
    expect(badges()).toHaveLength(2);                // the nested View went with its parent (cascade)
    expect(document.querySelectorAll("[data-product-id='p2']")).toHaveLength(0);

    // the remaining chain still works end to end
    (card("p3").querySelector(".add") as HTMLElement).click();
    expect(q("[data-ui='count']").textContent).toBe("1");
    expect(d.failures()).toEqual([]);
  });
});
