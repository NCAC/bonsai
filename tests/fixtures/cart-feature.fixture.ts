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
import { Feature, type TListenCallbacks } from "@bonsai/feature";
import { View, type TViewContract } from "@bonsai/view";
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

// ─── View ───────────────────────────────────────────────────────────────────

// Étape 1 — dépendances par lane (type pur)
type TCartViewDeps = {
  readonly listens:  [typeof CartFeature];
  readonly triggers: [typeof CartFeature];
  readonly requests: [typeof CartFeature];
};

// Étape 2 — contrat namespacé (validé par satisfies)
const cartViewContract = {
  uiElements: {
    itemCount: "[data-ui='itemCount']",
    total: "[data-ui='total']",
    addButton: "[data-ui='addButton']",
    emptyMessage: "[data-ui='emptyMessage']"
  },
  listens:  ["cart:itemAdded"] as const,
  triggers: ["cart:addItem"]   as const,
  requests: [] as const
} satisfies TViewContract<TCartViewDeps>;

// Étape 3 — type dérivé (préserve les littéraux)
type TCartViewContract = typeof cartViewContract;

// Étape 4 — classe
export class CartView
  extends View<TCartViewDeps, TCartViewContract>
  implements TListenCallbacks<TCartViewDeps, TCartViewContract>
{
  // Compteur local — la Feature est source de vérité, la View ne stocke
  // qu'un cache d'affichage minimal.
  #itemCount = 0;

  get contract() {
    return cartViewContract;
  }

  // D48 — auto-derived from uiElements.addButton
  onAddButtonClick(_event: Event): void {
    this.callTrigger("cart:addItem", {
      productId: `prod-${this.#itemCount + 1}`,
      qty: 1,
      price: 9.99
    });
  }

  // I48 — requis par implements TListenCallbacks (handler manquant = erreur compile)
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
