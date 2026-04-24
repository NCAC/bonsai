/**
 * Fixture — CartFeature, CartEntity, CartView, MainComposer, AppFoundation
 *
 * Mini-domaine "panier" conforme au contrat strate 0 (post-audit 2026-04-21,
 * ADR-0037, ADR-0038). Sert de gate E2E (cf. strate-0.cart-round-trip.test.ts).
 *
 * Flux complet illustré :
 *   View.click @addButton
 *     => trigger("cart", "addItem", payload)
 *     => Channel.handle => CartFeature.onAddItemCommand
 *     => entity.mutate("addItem", recipe)
 *     => emit("itemAdded", { item })
 *     => View.onCartItemAddedEvent
 *     => getUI("itemCount").text(...)  // projection N1
 */

import { Entity } from "@bonsai/entity";
import { Feature } from "@bonsai/feature";
import { View, type TViewParams } from "@bonsai/view";
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
export class CartFeature extends Feature<CartEntity, "cart"> {
  static readonly channels = [] as const;

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

// ─── View ───────────────────────────────────────────────────────────────────

const cartViewParams = {
  uiElements: {
    itemCount: "[data-ui='itemCount']",
    total: "[data-ui='total']",
    addButton: "[data-ui='addButton']",
    emptyMessage: "[data-ui='emptyMessage']"
  },
  // Channels écoutés (auto-discovery on{Channel}{EventName}Event — I48)
  listen: ["cart"] as const,
  // Channels vers lesquels on peut trigger
  trigger: ["cart"] as const
} as const satisfies TViewParams;

export class CartView extends View {
  // Compteur local — la Feature est source de vérité, la View ne stocke
  // qu'un cache d'affichage minimal.
  #itemCount = 0;

  get params(): TViewParams {
    return cartViewParams;
  }

  // D48 — auto-derived from uiElements.addButton
  onAddButtonClick(_event: Event): void {
    this.callTrigger("cart", "addItem", {
      productId: `prod-${this.#itemCount + 1}`,
      qty: 1,
      price: 9.99
    });
  }

  // I48 — auto-derived: on{Channel}{EventName}Event
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
