/**
 * Fixture — CartFeature, CartEntity, CartView, CartComposer
 *
 * Cette fixture définit un mini-domaine "panier" pour les tests.
 * Elle sera décommentée au fur et à mesure de l'implémentation.
 *
 * Utilisée par :
 *   - tests/unit/strate-0/feature.core.test.ts
 *   - tests/integration/strate-0/trigger-handle-mutate-emit.test.ts
 *   - tests/e2e/strate-0.cart-round-trip.test.ts
 */

// ============================================================================
// IMPORT TDD : les classes de base n'existent pas encore.
// import { Feature, Entity, View, Composer, Foundation } from "@core/bonsai";
// ============================================================================

// ─── Types ─────────────────────────────────────────────────────────

export interface TCartItem {
  productId: string;
  name: string;
  qty: number;
  price: number;
}

export interface TCartState {
  items: TCartItem[];
  total: number;
  lastUpdated: string | null;
}

export const CART_INITIAL_STATE: TCartState = {
  items: [],
  total: 0,
  lastUpdated: null,
};

// ─── Channel definition (namespace + commands + events + requests) ──

/**
 * Le Channel "cart" tel que défini par le namespace CartFeature.
 * En Bonsai, un namespace TypeScript exporte ce contrat.
 */
// export namespace Cart {
//   export const namespace = "cart" as const;
//
//   export type Commands = {
//     addItem: { productId: string; qty: number };
//     removeItem: { productId: string };
//     clearCart: void;
//   };
//
//   export type Events = {
//     itemAdded: { item: TCartItem };
//     itemRemoved: { productId: string };
//     cartCleared: void;
//   };
//
//   export type Requests = {
//     getTotal: { result: number };
//     getItemCount: { result: number };
//     getItemById: { params: { productId: string }; result: TCartItem | null };
//   };
// }

// ─── Entity ────────────────────────────────────────────────────────

// export class CartEntity extends Entity<TCartState> {
//   constructor() {
//     super(CART_INITIAL_STATE);
//   }
//
//   get query() {
//     return {
//       getItems: () => this.state.items,
//       getTotal: () => this.state.total,
//       getItemCount: () => this.state.items.length,
//       getItemById: (id: string) =>
//         this.state.items.find((item) => item.productId === id) ?? null,
//     };
//   }
// }

// ─── Feature ───────────────────────────────────────────────────────

// export class CartFeature extends Feature<typeof Cart, TCartState> {
//   static readonly namespace = Cart.namespace;
//
//   // C2 — handle command (auto-discovered: onAddItemCommand)
//   onAddItemCommand(payload: Cart.Commands["addItem"]) {
//     const price = this.request("pricing", "getItemPrice", {
//       productId: payload.productId,
//     }) ?? 0;
//
//     this.entity.mutate("addItem", (draft) => {
//       draft.items.push({
//         productId: payload.productId,
//         name: `Product ${payload.productId}`,
//         qty: payload.qty,
//         price,
//       });
//       draft.total += price * payload.qty;
//       draft.lastUpdated = new Date().toISOString();
//     });
//   }
//
//   // catch-all notification → emit event
//   onAnyEntityUpdated(event: TEntityEvent<TCartState>) {
//     if (event.changedKeys.includes("items")) {
//       const lastItem = event.nextState.items.at(-1);
//       if (lastItem) {
//         this.emit("itemAdded", { item: lastItem });
//       }
//     }
//   }
//
//   // C4 — reply request (auto-discovered: onGetTotalRequest)
//   onGetTotalRequest(): number {
//     return this.entity.query.getTotal();
//   }
//
//   onGetItemCountRequest(): number {
//     return this.entity.query.getItemCount();
//   }
// }

// ─── View ──────────────────────────────────────────────────────────

// export class CartView extends View {
//   static readonly ui = {
//     itemCount: "[data-ui='itemCount']",
//     total: "[data-ui='total']",
//     addButton: "[data-ui='addButton']",
//     itemList: "[data-ui='itemList']",
//     emptyMessage: "[data-ui='emptyMessage']",
//   } as const;
//
//   static readonly channels = ["cart"] as const;
//
//   get params() {
//     return {} as const;
//   }
//
//   // D48 — auto-derived from ui.addButton
//   onAddButtonClick(_event: Event) {
//     this.trigger("cart:addItem", { productId: "123", qty: 1 });
//   }
//
//   // Listen cart:itemAdded
//   onCartItemAddedEvent(payload: Cart.Events["itemAdded"]) {
//     const count = /* get from request or internal tracking */ 1;
//     this.getUI("itemCount").text(String(count));
//     this.getUI("emptyMessage").visible(false);
//   }
// }

// ─── Composer ──────────────────────────────────────────────────────

// export class MainComposer extends Composer {
//   resolve(event: TBonsaiEvent | null): TResolveResult | null {
//     return {
//       viewClass: CartView,
//       rootElement: "[data-view='cart']",
//     };
//   }
// }

// ─── Foundation ────────────────────────────────────────────────────

// export class AppFoundation extends Foundation {
//   get composers() {
//     return [
//       { composer: MainComposer, rootElement: "[data-region='main']" },
//     ] as const;
//   }
// }
