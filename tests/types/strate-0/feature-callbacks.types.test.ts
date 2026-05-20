/**
 * Tests de type — TListenCallbacks + UnionToIntersection (ADR-0046, I92)
 *
 * Ces tests vérifient que TypeScript enforce correctement la couverture
 * exhaustive des handlers de listen via `TFeatureCallbacks<TDef, TListens>`.
 *
 * Origine : POC-Q7-tlisten-callbacks.ts (racine) — supprimé après validation
 * empirique de l'hypothèse Q7 (ADR-0046 §Q7 résolu).
 *
 * Hypothèse validée (I92) :
 *   Avec UnionToIntersection dans TListenCallbacks, on obtient l'INTERSECTION
 *   de tous les objets handler → `implements` impose la couverture complète.
 *   Handler absent → TS2420. Signature incorrecte → TS2416.
 */

import { describe, it } from "@jest/globals";
import type {
  TFeatureCallbacks,
  TListenCallbacks,
  TCommandCallbacks,
  TRequestCallbacks
} from "@bonsai/feature";
import type { TChannelToken } from "@bonsai/event";

// ─── ChannelDef concrets ──────────────────────────────────────────────────

type TCartChannelDef = {
  commands: { addItem: { id: string } };
  events: { itemAdded: { id: string }; itemRemoved: { id: string } };
  requests: { getTotal: { params: null; result: number } };
};

type TWishlistChannelDef = {
  commands: { addToWishlist: { sku: string } };
  events: { productSaved: { sku: string } };
  requests: Record<never, never>;
};

const cartListens = [
  null as unknown as TChannelToken<TCartChannelDef, "cart">,
  null as unknown as TChannelToken<TWishlistChannelDef, "wishlist">
] as const;
type TCartListenerListens = typeof cartListens;

type AssertTrue<T extends true> = T;

// ─── Tests ────────────────────────────────────────────────────────────────

describe("TFeatureCallbacks — I92 (ADR-0046)", () => {
  it("TListenCallbacks produit une intersection (toutes clés requises)", () => {
    type TFixed = TListenCallbacks<TCartListenerListens>;
    type FixedKeys = keyof TFixed;
    type _1 = AssertTrue<
      "onCartItemAddedEvent" extends FixedKeys ? true : false
    >;
    type _2 = AssertTrue<
      "onCartItemRemovedEvent" extends FixedKeys ? true : false
    >;
    type _3 = AssertTrue<
      "onWishlistProductSavedEvent" extends FixedKeys ? true : false
    >;
    void (null as unknown as _1);
    void (null as unknown as _2);
    void (null as unknown as _3);
  });

  it("TCommandCallbacks dérive les handlers Command", () => {
    type TCartCommands = TCommandCallbacks<TCartChannelDef>;
    type _1 = AssertTrue<
      "onAddItemCommand" extends keyof TCartCommands ? true : false
    >;
    void (null as unknown as _1);
  });

  it("TRequestCallbacks dérive les handlers Request (repliers)", () => {
    type TCartRequests = TRequestCallbacks<TCartChannelDef>;
    type _1 = AssertTrue<
      "onGetTotalRequest" extends keyof TCartRequests ? true : false
    >;
    void (null as unknown as _1);
  });

  it("TFeatureCallbacks = Command + Request + Listen (couverture totale)", () => {
    type TFull = TFeatureCallbacks<TCartChannelDef, TCartListenerListens>;
    type Keys = keyof TFull;
    type _1 = AssertTrue<"onAddItemCommand" extends Keys ? true : false>;
    type _2 = AssertTrue<"onGetTotalRequest" extends Keys ? true : false>;
    type _3 = AssertTrue<"onCartItemAddedEvent" extends Keys ? true : false>;
    type _4 = AssertTrue<"onCartItemRemovedEvent" extends Keys ? true : false>;
    type _5 = AssertTrue<
      "onWishlistProductSavedEvent" extends Keys ? true : false
    >;
    void (null as unknown as _1);
    void (null as unknown as _2);
    void (null as unknown as _3);
    void (null as unknown as _4);
    void (null as unknown as _5);
  });

  it("classe avec handler listen manquant → @ts-expect-error TS2420 (I92)", () => {
    type TFixed = TListenCallbacks<TCartListenerListens>;
    // @ts-expect-error TS2420 — manque onWishlistProductSavedEvent
    class IncompleteListenerFeature implements TFixed {
      onCartItemAddedEvent(_: { id: string }): void {}
      onCartItemRemovedEvent(_: { id: string }): void {}
    }
    void IncompleteListenerFeature;
  });

  it("classe complète implements TListenCallbacks sans erreur (I92)", () => {
    type TFixed = TListenCallbacks<TCartListenerListens>;
    class CompleteListenerFeature implements TFixed {
      onCartItemAddedEvent(_: { id: string }): void {}
      onCartItemRemovedEvent(_: { id: string }): void {}
      onWishlistProductSavedEvent(_: { sku: string }): void {}
    }
    void CompleteListenerFeature;
  });

  it("classe avec handler Command manquant → @ts-expect-error TS2420 (I92)", () => {
    type TFull = TFeatureCallbacks<TCartChannelDef, TCartListenerListens>;
    // @ts-expect-error TS2420 — manque onAddItemCommand
    class MissingCommandFeature implements TFull {
      onGetTotalRequest(_params: null): number {
        return 0;
      }
      onCartItemAddedEvent(_: { id: string }): void {}
      onCartItemRemovedEvent(_: { id: string }): void {}
      onWishlistProductSavedEvent(_: { sku: string }): void {}
    }
    void MissingCommandFeature;
  });
});
