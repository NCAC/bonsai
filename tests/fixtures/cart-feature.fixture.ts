/**
 * Fixture — CartFeature, CartEntity, CartView, MainComposer, AppFoundation
 *
 * Mini-domaine "panier" conforme au contrat strate 0 (post-audit 2026-04-21,
 * ADR-0037, ADR-0038, ADR-0040, ADR-0041). Sert de gate E2E
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
import { type TChannelDefinition, type TChannelToken } from "@bonsai/event";
import {
  Feature,
  type TFeatureContract
} from "@bonsai/feature";
import {
  View, ui,
  type TViewContract,
  type TViewCallbacks,
  type TUIContract,
  type TUIElements
} from "@bonsai/view";
import {
  Composer,
  type TResolveResult,
  type TComposerOptions
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

// ─── Feature ────────────────────────────────────────────────────────────────

/**
 * CartFeature — `TSelfNS = "cart"` ancre la classe à la clé du manifest
 * applicatif (ADR-0039 — I72). Plus de `static namespace`.
 */
export class CartFeature extends Feature<CartEntity, TChannelDefinition, "cart"> {
  static readonly channel: TChannelToken<TChannelDefinition, "cart"> = { namespace: "cart" };
  static readonly listens = [] as const;
  static readonly queries = [] as const;

  protected get Entity() {
    return CartEntity;
  }

  // C2 — Command handler auto-discovered (I48)
  onAddItemCommand(payload: TCartItem): void {
    this.entity.mutate("addItem", (draft) => {
      draft.items.push(payload);
      draft.total += payload.price * payload.qty;
    });
    // C1 — emit on own Channel
    this.emit("itemAdded", { item: payload });
  }

  // C4 — Reply auto-discovered
  onGetItemCountRequest(): number {
    return this.entity.query.getItemCount();
  }
}

// ─── View (ADR-0042 — pattern modulaire) ────────────────────────────────────

// Étape 1 — Feature contract (Feature-groupé)
const cartViewFeatures = {
  cart: {
    feature:  CartFeature,
    listens:  ["itemAdded"] as const,
    triggers: ["addItem"]   as const,
    requests: []            as const
  }
} satisfies TFeatureContract;

// Étape 2 — UI contract (events DOM + phantom TEl)
const cartViewUiEvents = {
  itemCount:    ui<HTMLElement>()([]),
  total:        ui<HTMLElement>()([]),
  addButton:    ui<HTMLButtonElement>()(["click"]),
  emptyMessage: ui<HTMLElement>()([])
} satisfies TUIContract;

// Étape 3 — sélecteurs CSS (overridable D34)
const cartViewUiElements = {
  itemCount:    "[data-ui='itemCount']",
  total:        "[data-ui='total']",
  addButton:    "[data-ui='addButton']",
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
  // Compteur local — la Feature est source de vérité, la View ne stocke
  // qu'un cache d'affichage minimal.
  #itemCount = 0;

  get features()   { return cartViewFeatures; }
  get uiEvents()   { return cartViewUiEvents; }
  get uiElements() { return cartViewUiElements; }

  // D48 UI — handler requis par TViewCallbacks (events: ["click"] sur addButton)
  onAddButtonClick(_event: MouseEvent): void {
    this.callTrigger("cart:addItem", {
      productId: `prod-${this.#itemCount + 1}`,
      qty: 1,
      price: 9.99
    });
  }

  // D48 channel — handler requis par TViewCallbacks (cart.listens: ["itemAdded"])
  onCartItemAddedEvent(_payload: { item: TCartItem }): void {
    this.#itemCount += 1;
    this.getUI("itemCount").text(String(this.#itemCount));
    this.getUI("total").text((this.#itemCount * 9.99).toFixed(2));
    this.getUI("emptyMessage").visible(false);
  }
}

// ─── Composer ───────────────────────────────────────────────────────────────

export class MainComposer extends Composer {
  constructor(options: TComposerOptions) {
    super(options);
  }

  resolve(_event: unknown | null): TResolveResult | null {
    return {
      view: CartView,
      rootElement: "[data-view='cart']"
    };
  }
}

// ─── Foundation ─────────────────────────────────────────────────────────────

export class AppFoundation extends Foundation {
  // ADR-0038 — Record<string, typeof Composer> ; clés = sélecteurs CSS dans <body>.
  // Layout stable : un seul slot principal en strate 0.
  get composers() {
    return {
      "[data-region='main']": MainComposer
    } as const;
  }
}
