/**
 * Type tests — creation params of a composed View are typed by its contract
 * (strate 1d, ADR-18, A3.d)
 *
 * The third parameter of `TViewContract` declares what the View expects; the
 * Composer must give exactly that, and the View reads it typed, in a handler
 * and in the `params` of a template binding.
 *
 * @jest-environment node
 */

import { describe, it } from "@jest/globals";
import { type TChannelToken } from "@bonsai/kernel";
import type { TFeatureContract } from "@bonsai/feature";
import { Composer, type TComposerContract, type TComposeContext, type TComposition } from "@bonsai/composer";
import { View, ui, bind, type TViewContract, type TUIContract, type TViewParamsOf, type TProjectionTemplate } from "@bonsai/view";

type TCatalogDef = {
  readonly commands: Record<string, never>;
  readonly events: { changed: null };
  readonly queries: { ids: { params: null; result: readonly string[] }; name: { params: { id: string }; result: string } };
};
class CatalogFeature {
  static readonly channel: TChannelToken<TCatalogDef, "catalog"> = { namespace: "catalog" };
}
const features = {
  catalog: { feature: CatalogFeature, listens: ["changed"] as const, triggers: [] as const, queries: ["ids", "name"] as const }
} satisfies TFeatureContract;
const uiEvents = { name: ui<HTMLElement>()([]) } satisfies TUIContract;

type TProductContract = TViewContract<typeof features, typeof uiEvents, { readonly productId: string }>;
type TFilterContract = TViewContract<typeof features, typeof uiEvents, { readonly query?: string }>;
type TEmptyContract = TViewContract<typeof features, typeof uiEvents>;

declare const NameTemplate: TProjectionTemplate<string>;

class ProductView extends View<TProductContract> {
  get features() { return features; }
  get uiEvents() { return uiEvents; }
  get uiElements() { return { name: ".name" }; }
  get template() { return `<span class="name"></span>`; }
  override get templates() {
    return {
      name: bind<TProductContract>()({
        template: NameTemplate,
        query: "catalog:name",
        params: (p) => ({ id: p.productId }),   // p is typed by the contract
        on: ["catalog:changed"]
      })
    };
  }
  read(): string {
    const id: string = this.params.productId;
    // @ts-expect-error — not declared by the contract
    void this.params.other;
    return id;
  }
}
class FilterView extends View<TFilterContract> {
  get features() { return features; }
  get uiEvents() { return uiEvents; }
  get uiElements() { return { name: ".name" }; }
  get template() { return `<span class="name"></span>`; }
}
class EmptyView extends View<TEmptyContract> {
  get features() { return features; }
  get uiEvents() { return uiEvents; }
  get uiElements() { return { name: ".name" }; }
  get template() { return `<span class="name"></span>`; }
}

const views = { product: ProductView, filter: FilterView, empty: EmptyView };
type TC = TComposerContract<{ catalog: { feature: typeof CatalogFeature; listens: readonly ["changed"]; queries: readonly ["ids"] } }, typeof views>;

// The params of a View class are those of its contract.
const _productParams: TViewParamsOf<typeof ProductView> = { productId: "p" };

class _Composer extends Composer<TC> {
  get features() { return { catalog: { feature: CatalogFeature, listens: ["changed"] as const, queries: ["ids"] as const } }; }
  get views() { return views; }
  resolve(ctx: TComposeContext<TC>): TComposition<TC> {
    return [
      ...ctx.query("catalog:ids", null).map((id) => ({ view: "product" as const, key: id, params: { productId: id } })),
      { view: "filter", key: "f" },                          // nothing required: params may be omitted
      { view: "filter", key: "g", params: { query: "a" } },
      { view: "empty", key: "e" }
    ];
  }
}

// @ts-expect-error — the params of ProductView are required
const _missing: TComposition<TC> = [{ view: "product", key: "p" }];
// @ts-expect-error — unknown property
const _unknown: TComposition<TC> = [{ view: "product", key: "p", params: { productID: "p" } }];
// @ts-expect-error — wrong type
const _wrong: TComposition<TC> = [{ view: "product", key: "p", params: { productId: 42 } }];
// @ts-expect-error — EmptyView declares no params
const _none: TComposition<TC> = [{ view: "empty", key: "e", params: { x: 1 } }];

describe("Composition params typed by the View's contract (ADR-18)", () => {
  it("compiles (see the @ts-expect-error directives)", () => undefined);
});
