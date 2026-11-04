/**
 * Type tests — template bindings of a View (strate 1c, lot 2, ADR-26)
 *
 * These tests do not run anything: a `@ts-expect-error` that no longer fires
 * fails `pnpm tsc:check:tests` ("Unused '@ts-expect-error' directive").
 *
 * Covers:
 *   - `bind<TVC>()`: `query` is a declared Query, `on` a non-empty list of
 *     listened Events, `params` typed by the Query, `select` receives the
 *     result of the Query and the template receives the output of `select`.
 *   - I82 amended: with `TViewCallbacks<TVC, typeof templates>`, the handler
 *     of an Event cited in an `on` is optional; the others stay required.
 *   - `TViewTemplates`: keys are UI keys, or `root` alone.
 *
 * @jest-environment node
 */

import { describe, it } from "@jest/globals";
import { type TChannelToken } from "@bonsai/kernel";
import type { TFeatureContract } from "@bonsai/feature";
import {
  View,
  ui,
  bind,
  type TViewContract,
  type TViewCallbacks,
  type TViewTemplates,
  type TUIContract,
  type TUIElements,
  type TProjectionTemplate
} from "@bonsai/view";

type TItem = { id: string; qty: number };
type TCartDef = {
  readonly commands: { addItem: TItem };
  readonly events: { itemAdded: { id: string }; itemRemoved: { id: string }; cleared: null };
  readonly queries: {
    items: { params: null; result: readonly TItem[] };
    price: { params: { id: string }; result: number };
  };
};
class CartFeature {
  static readonly channel: TChannelToken<TCartDef, "cart"> = { namespace: "cart" };
}

const features = {
  cart: {
    feature: CartFeature,
    listens: ["itemAdded", "itemRemoved", "cleared"] as const,
    triggers: [] as const,
    queries: ["items", "price"] as const
  }
} satisfies TFeatureContract;
const uiEvents = { list: ui<HTMLElement>()([]), price: ui<HTMLElement>()([]) } satisfies TUIContract;
const uiElements = { list: "ul", price: "b" } satisfies TUIElements<typeof uiEvents>;
type TC = TViewContract<typeof features, typeof uiEvents>;

/** A template typed by its data; never run here. */
const template = <TData>(): TProjectionTemplate<TData> => ({ create: () => ({}) as Node, setup: () => null, project: () => {} });
const IdsTemplate = template<readonly string[]>();
const ItemsTemplate = template<readonly TItem[]>();
const PriceTemplate = template<number>();

// ─── bind<TVC>() ─────────────────────────────────────────────────────────────

const _ok_select = bind<TC>()({
  template: IdsTemplate,
  query: "cart:items",
  params: null,
  on: ["cart:itemAdded", "cart:itemRemoved"],
  select: (items) => items.map((i) => i.id) // items: readonly TItem[]
});

const _ok_identity = bind<TC>()({ template: ItemsTemplate, query: "cart:items", params: null, on: ["cart:itemAdded"] });

const _ok_params_fn = bind<TC>()({
  template: PriceTemplate,
  query: "cart:price",
  params: (viewParams) => ({ id: String(viewParams["id"]) }),
  on: ["cart:itemAdded"]
});

// @ts-expect-error — undeclared Query
const _ko_query = bind<TC>()({ template: ItemsTemplate, query: "cart:total", on: ["cart:itemAdded"] });

// @ts-expect-error — an Event that is not listened to
const _ko_on = bind<TC>()({ template: ItemsTemplate, query: "cart:items", on: ["cart:itemMoved"] });

// @ts-expect-error — `on` cannot be empty
const _ko_on_empty = bind<TC>()({ template: ItemsTemplate, query: "cart:items", on: [] });

// @ts-expect-error — params typed by the Query
const _ko_params = bind<TC>()({ template: PriceTemplate, query: "cart:price", params: { sku: "x" }, on: ["cart:itemAdded"] });

const _ko_template = bind<TC>()({
  template: ItemsTemplate,
  query: "cart:items",
  on: ["cart:itemAdded"],
  // @ts-expect-error — the template receives the output of `select`: readonly TItem[] here, not a number
  select: (items) => items.length
});

// ─── TViewTemplates ─────────────────────────────────────────────────────────

const _keys_ok: TViewTemplates<TC> = { list: _ok_select, price: _ok_params_fn };
const _root_ok: TViewTemplates<TC> = { root: _ok_identity };
// @ts-expect-error — a key that is not a UI key
const _keys_ko: TViewTemplates<TC> = { header: _ok_identity };

// ─── I82 amended ─────────────────────────────────────────────────────────────

const templates = { list: _ok_select } as const; // cites cart:itemAdded and cart:itemRemoved

class TemplatedView extends View<TC> implements TViewCallbacks<TC, typeof templates> {
  get features() { return features; }
  get uiEvents() { return uiEvents; }
  get uiElements() { return uiElements; }
  override get templates() { return templates; }
  onCartClearedEvent(): void {} // required: cited in no `on`
}

// @ts-expect-error — onCartClearedEvent missing: "cleared" re-runs no binding
class MissingHandlerView extends View<TC> implements TViewCallbacks<TC, typeof templates> {
  get features() { return features; }
  get uiEvents() { return uiEvents; }
  get uiElements() { return uiElements; }
  override get templates() { return templates; }
}

class OptionalHandlerView extends View<TC> implements TViewCallbacks<TC, typeof templates> {
  get features() { return features; }
  get uiEvents() { return uiEvents; }
  get uiElements() { return uiElements; }
  override get templates() { return templates; }
  onCartClearedEvent(): void {}
  // Optional, but still typed when present.
  onCartItemAddedEvent(_payload: { id: string }): void {}
}

class BadOptionalHandlerView extends View<TC> implements TViewCallbacks<TC, typeof templates> {
  get features() { return features; }
  get uiEvents() { return uiEvents; }
  get uiElements() { return uiElements; }
  override get templates() { return templates; }
  onCartClearedEvent(): void {}
  // @ts-expect-error — optional handler with a wrong payload
  onCartItemAddedEvent(_payload: { sku: number }): void {}
}

describe("View template bindings — compile-time (ADR-26)", () => {
  it("bind, TViewTemplates and the amended I82 hold at the type level", () => {
    void [_ok_select, _ok_identity, _ok_params_fn, _ko_query, _ko_on, _ko_on_empty, _ko_params, _ko_template];
    void [_keys_ok, _root_ok, _keys_ko];
    void [TemplatedView, MissingHandlerView, OptionalHandlerView, BadOptionalHandlerView];
  });
});
