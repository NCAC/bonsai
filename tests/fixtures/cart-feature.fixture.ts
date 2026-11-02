/**
 * Fixture — CartFeature, CartEntity, CartView, MainComposer, AppFoundation
 *
 * Mini-domaine "panier" conforme au contrat strate 0 (post-audit 2026-04-21,
 * ADR-09, ADR-20, ADR-14). Sert de gate E2E
 * (cf. strate-0.cart-round-trip.test.ts).
 *
 * Flux complet illustré :
 *   View.click @addButton
 *     => trigger("cart:addItem", payload)
 *     => Channel.handle => CartFeature.onAddItemCommand
 *     => entity.mutate("addItem", recipe)
 *     => emit("itemAdded", { item })
 *     => View.onCartItemAddedEvent
 *     => getUI("itemCount").text(...)  // projection N1
 */

import { Entity } from "@bonsai/entity";
import { type TChannelToken } from "@bonsai/kernel";
import {
  Feature,
  type TFeatureContract,
  type TFeatureCallbacks,
  type TFeatureContext,
  type TFeatureQueryContext
} from "@bonsai/feature";
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
import {
  Composer,
  type TComposerContract,
  type TComposeContext,
  type TComposition
} from "@bonsai/composer";
import { Foundation } from "@bonsai/foundation";

// ─── Types ──────────────────────────────────────────────────────────────────

export type TCartItem = {
  productId: string;
  qty: number;
  price: number;
};

export type TCartState = {
  items: TCartItem[];
  total: number;
};

// ─── Entity ─────────────────────────────────────────────────────────────────

export class CartEntity extends Entity<TCartState> {
  protected defineInitialState(): TCartState {
    return { items: [], total: 0 };
  }

  get query() {
    return {
      getTotal: () => this.state.total,
      getItemCount: () => this.state.items.length
    };
  }
}

// ─── Channel definition (ADR-14 — I74 : co-localisé dans le fichier feature) ─

export type TCartChannelDef = {
  commands: {
    addItem: TCartItem;
  };
  events: {
    itemAdded: { item: TCartItem };
  };
  queries: {
    getItemCount: { params: null; result: number };
    getTotal: { params: null; result: number };
  };
};

const cartListens = [] as const;

// ─── Feature ────────────────────────────────────────────────────────────────

/**
 * CartFeature — `TSelfNS = "cart"` ancre la classe à la clé du manifest
 * applicatif (ADR-08 — I72). Plus de `static namespace`.
 */
export class CartFeature
  extends Feature<CartEntity, TCartChannelDef, "cart">
  implements TFeatureCallbacks<TCartChannelDef, typeof cartListens, CartEntity>
{
  static readonly channel: TChannelToken<TCartChannelDef, "cart"> = {
    namespace: "cart",
    events: ["itemAdded"]
  };
  get listens() {
    return cartListens;
  }
  get queries() {
    return [] as const;
  }

  protected get Entity() {
    return CartEntity;
  }

  // C2 — Command handler auto-discovered (I48)
  onAddItemCommand(payload: TCartItem, ctx: TFeatureContext<TCartChannelDef, CartEntity>): void {
    ctx.mutate("addItem", (draft) => {
      draft.items.push(payload);
      draft.total += payload.price * payload.qty;
    });
    // C1 — emit on own Channel
    ctx.emit("itemAdded", { item: payload });
  }

  // C4 — Reply auto-discovered
  onGetItemCountQuery(_params: null, _ctx: TFeatureQueryContext): number {
    return this.entity.query.getItemCount();
  }

  onGetTotalQuery(_params: null, _ctx: TFeatureQueryContext): number {
    return this.entity.query.getTotal();
  }
}

// ─── View (ADR-14 — pattern modulaire) ────────────────────────────────────

// Étape 1 — Feature contract (Feature-groupé)
const cartViewFeatures = {
  cart: {
    feature: CartFeature,
    listens: ["itemAdded"] as const,
    triggers: ["addItem"] as const,
    queries: ["getItemCount", "getTotal"] as const
  }
} satisfies TFeatureContract;

// Étape 2 — UI contract (events DOM + phantom TEl)
const cartViewUiEvents = {
  itemCount: ui<HTMLElement>()([]),
  total: ui<HTMLElement>()([]),
  addButton: ui<HTMLButtonElement>()(["click"]),
  emptyMessage: ui<HTMLElement>()([])
} satisfies TUIContract;

// Étape 3 — sélecteurs CSS (overridable ADR-21)
const cartViewUiElements = {
  itemCount: "[data-ui='itemCount']",
  total: "[data-ui='total']",
  addButton: "[data-ui='addButton']",
  emptyMessage: "[data-ui='emptyMessage']"
} satisfies TUIElements<typeof cartViewUiEvents>;

// Étape 4 — type composé
type TCartViewContract = TViewContract<
  typeof cartViewFeatures,
  typeof cartViewUiEvents
>;

// Étape 5 — classe (un générique, un implements)
export class CartView
  extends View<TCartViewContract>
  implements TViewCallbacks<TCartViewContract>
{
  get features() {
    return cartViewFeatures;
  }
  get uiEvents() {
    return cartViewUiEvents;
  }
  get uiElements() {
    return cartViewUiElements;
  }

  // Contenu initial de la partie attribuée par le Composer.
  get template() {
    return (
      `<span data-ui="itemCount">0</span>` +
      `<span data-ui="total">0.00</span>` +
      `<button data-ui="addButton">Add Item</button>` +
      `<div data-ui="emptyMessage">Cart is empty</div>`
    );
  }

  // I48 UI — fait de l'hôte admis dans la partie (events: ["click"] sur addButton)
  onAddButtonClick(_fact: TFact, ctx: TFactContext<TCartViewContract>): void {
    ctx.trigger("cart:addItem", { productId: "prod", qty: 1, price: 9.99 });
  }

  // I48 channel — la View projette ce que la Feature a décidé ; elle ne tient pas d'état
  onCartItemAddedEvent(_payload: { item: TCartItem }, ctx: TEventContext<TCartViewContract>): void {
    this.getUI("itemCount").text(String(ctx.query("cart:getItemCount", null)));
    this.getUI("total").text(ctx.query("cart:getTotal", null).toFixed(2));
    this.getUI("emptyMessage").visible(false);
  }
}

// ─── Composer ───────────────────────────────────────────────────────────────

const mainComposerFeatures = {
  cart: {
    feature: CartFeature,
    listens: [] as const,
    queries: [] as const
  }
};

const mainComposerViews = { cart: CartView };

type TMainComposerContract = TComposerContract<
  typeof mainComposerFeatures,
  typeof mainComposerViews
>;

export class MainComposer extends Composer<TMainComposerContract> {
  get features() {
    return mainComposerFeatures;
  }
  get views() {
    return mainComposerViews;
  }

  resolve(_ctx: TComposeContext<TMainComposerContract>): TComposition<TMainComposerContract> {
    return [{ view: "cart", key: "cart" }];
  }
}

// ─── Foundation ─────────────────────────────────────────────────────────────

export class AppFoundation extends Foundation {
  // ADR-20 — un emplacement existant de l'ancre, et le Composer qui le remplit.
  get composers() {
    return {
      main: { slot: "[data-region='main']", composer: MainComposer }
    } as const;
  }
}
