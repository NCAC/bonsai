/**
 * Tests Strate 0 — Application bootstrap (refondu ADR-0039)
 *
 * Invariants prouvés :
 *   I23  — Application est dormante au runtime
 *   I24  — Manifest garantit l'unicité au compile-time ; Application valide
 *          format + réservés + cohérence des `channels` au bootstrap (amendé ADR-0039)
 *   I33  — Application sans Foundation ne peut rien afficher
 *   I56  — onInit() de chaque Feature appelé avant la création de la Foundation
 *   I68  — Le namespace est porté par le manifest, pas par un static (ADR-0039)
 *   I69  — Le manifest est l'unique source de vérité de l'identité (ADR-0039)
 *   I70  — Toute référence à un namespace externe DOIT être validée (ADR-0039)
 *   I71  — `RESERVED_NAMESPACES` est une constante framework (ADR-0039)
 *
 * Sémantiques strate 0 :
 *   - constructor({ foundation, features }) — déclare le manifest applicatif
 *   - start() — bootstrap en 4 phases simplifiées
 *
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { resetDOM } from "../../helpers/dom-setup";
import { Application } from "@bonsai/application";
import { Foundation } from "@bonsai/foundation";
import { Entity } from "@bonsai/entity";
import { Feature, BonsaiNamespaceError } from "@bonsai/feature";
import { Radio } from "@bonsai/event";

// ─── Fixtures ────────────────────────────────────────────────────────────────

type TCartState = {
  items: Array<{ productId: string; qty: number; price: number }>;
  total: number;
};

class CartEntity extends Entity<TCartState> {
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

class CartFeature extends Feature<CartEntity, "cart"> {
  static readonly channels = [] as const;
  protected get Entity() {
    return CartEntity;
  }
}

/**
 * Stub partagé pour les fixtures de bootstrap qui n'ont pas de logique métier.
 */
type TNoopState = Record<string, never>;
class NoopEntity extends Entity<TNoopState> {
  protected defineInitialState(): TNoopState {
    return {};
  }
}
abstract class StubFeature<TSelfNS extends string> extends Feature<
  NoopEntity,
  TSelfNS
> {
  protected get Entity() {
    return NoopEntity;
  }
}

class EmptyFoundation extends Foundation {
  get composers() {
    return {};
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Application bootstrap — Strate 0 [I23, I24, I56, ADR-0039]", () => {
  beforeEach(() => {
    resetDOM();
    Radio.reset();
  });

  // ── Manifest API (ADR-0039) ────────────────────────────────────────────

  describe("Manifest applicatif (ADR-0039 — I68/I69)", () => {
    it("Application accepts a features manifest in its constructor", () => {
      expect(
        () =>
          new Application({
            foundation: EmptyFoundation as unknown as typeof Foundation,
            features: { cart: CartFeature }
          })
      ).not.toThrow();
    });

    it("start() instantiates each Feature with the namespace from the manifest key (I72)", () => {
      class OrderFeature extends StubFeature<"orders"> {
        static readonly channels = [] as const;
      }

      const app = new Application({
        foundation: EmptyFoundation as unknown as typeof Foundation,
        features: { cart: CartFeature, orders: OrderFeature }
      });
      app.start();

      // Channels créés sous les clés du manifest — Radio.channel() ne throw pas
      expect(() => Radio.me().channel("cart")).not.toThrow();
      expect(() => Radio.me().channel("orders")).not.toThrow();
    });

    it("Application has no register() method anymore (ADR-0039 D-η)", () => {
      const app = new Application({
        foundation: EmptyFoundation as unknown as typeof Foundation,
        features: { cart: CartFeature }
      });
      expect(
        (app as unknown as { register?: unknown }).register
      ).toBeUndefined();
    });
  });

  // ── 4-phase bootstrap ──────────────────────────────────────────────────

  describe("start() — 4-phase bootstrap", () => {
    it("start() creates channels for manifested Features", () => {
      const app = new Application({
        foundation: EmptyFoundation as unknown as typeof Foundation,
        features: { cart: CartFeature }
      });
      app.start();

      expect(() => Radio.me().channel("cart")).not.toThrow();
    });

    it("I56 — onInit() of every Feature called before Foundation creation", () => {
      const callOrder: string[] = [];

      class OrderedFeature extends StubFeature<"ordered"> {
        static readonly channels = [] as const;
        onInit() {
          callOrder.push("feature:onInit");
        }
      }

      class OrderedFoundation extends Foundation {
        get composers() {
          return {};
        }
        onAttach() {
          callOrder.push("foundation:onAttach");
        }
      }

      const app = new Application({
        foundation: OrderedFoundation as unknown as typeof Foundation,
        features: { ordered: OrderedFeature }
      });
      app.start();

      const initIndex = callOrder.indexOf("feature:onInit");
      const foundationIndex = callOrder.indexOf("foundation:onAttach");
      expect(initIndex).toBeLessThan(foundationIndex);
    });

    it("start() can only be called once", () => {
      const app = new Application({
        foundation: EmptyFoundation as unknown as typeof Foundation,
        features: { cart: CartFeature }
      });
      app.start();

      expect(() => app.start()).toThrow(/already started/i);
    });
  });

  // ── I23 — dormancy ─────────────────────────────────────────────────────

  describe("I23 — Application is dormant at runtime", () => {
    it("Application has no runtime behavior after start()", () => {
      const app = new Application({
        foundation: EmptyFoundation as unknown as typeof Foundation,
        features: { cart: CartFeature }
      });
      app.start();

      const runtime = app as unknown as Record<string, unknown>;
      expect(runtime.handle).toBeUndefined();
      expect(runtime.emit).toBeUndefined();
      expect(runtime.listen).toBeUndefined();
      expect(runtime.request).toBeUndefined();
    });
  });

  // ── Filet runtime du manifest (ADR-0039 — I70/I71) ─────────────────────

  describe("Manifest validation runtime [ADR-0039 — I70, I71]", () => {
    it("I71 — namespace 'local' is reserved → BonsaiNamespaceError(NAMESPACE_RESERVED)", () => {
      class BadFeature extends StubFeature<string> {
        static readonly channels = [] as const;
      }

      const app = new Application({
        foundation: EmptyFoundation as unknown as typeof Foundation,
        // Cast volontaire : simule un manifest construit sans le filet
        // compile-time `StrictManifest<M>` (cast `as any`, code JS, dynamique).
        features: { local: BadFeature } as unknown as {
          cart: typeof CartFeature;
        }
      });

      expect(() => app.start()).toThrow(BonsaiNamespaceError);
      try {
        app.start();
      } catch (err) {
        expect((err as BonsaiNamespaceError).code).toBe("NAMESPACE_RESERVED");
      }
    });

    it("Non-camelCase key → BonsaiNamespaceError(NAMESPACE_INVALID_FORMAT)", () => {
      class BadFeature extends StubFeature<string> {
        static readonly channels = [] as const;
      }

      const app = new Application({
        foundation: EmptyFoundation as unknown as typeof Foundation,
        features: { "my-cart": BadFeature } as unknown as {
          cart: typeof CartFeature;
        }
      });

      try {
        app.start();
        throw new Error("expected throw");
      } catch (err) {
        expect(err).toBeInstanceOf(BonsaiNamespaceError);
        expect((err as BonsaiNamespaceError).code).toBe(
          "NAMESPACE_INVALID_FORMAT"
        );
      }
    });

    it("I70 — `static channels` referencing an unknown namespace → BonsaiNamespaceError(NAMESPACE_UNKNOWN_REFERENCE)", () => {
      class GhostListener extends StubFeature<"ghostListener"> {
        // Référence "catlog" inexistant → filet runtime
        static readonly channels = ["catlog"] as const;
      }

      const app = new Application({
        foundation: EmptyFoundation as unknown as typeof Foundation,
        features: { ghostListener: GhostListener }
      });

      try {
        app.start();
        throw new Error("expected throw");
      } catch (err) {
        expect(err).toBeInstanceOf(BonsaiNamespaceError);
        expect((err as BonsaiNamespaceError).code).toBe(
          "NAMESPACE_UNKNOWN_REFERENCE"
        );
      }
    });

    it("Cross-references between manifested Features are accepted", () => {
      class ListenerFeature extends StubFeature<"listener"> {
        static readonly channels = ["cart"] as const;
      }

      const app = new Application({
        foundation: EmptyFoundation as unknown as typeof Foundation,
        features: { cart: CartFeature, listener: ListenerFeature }
      });

      expect(() => app.start()).not.toThrow();
    });
  });

  // ── Bootstrap guards ───────────────────────────────────────────────────

  describe("Bootstrap guards [I33, I56, ADR-0010]", () => {
    it("start() throws if no Foundation provided (I33)", () => {
      const app = new Application({ features: { cart: CartFeature } });
      expect(() => app.start()).toThrow(/no Foundation/i);
    });

    it("start() instantiates the Foundation and exposes app.foundation", () => {
      const app = new Application({
        foundation: EmptyFoundation as unknown as typeof Foundation,
        features: { cart: CartFeature }
      });

      expect(app.foundation).toBeNull();
      expect(app.started).toBe(false);

      app.start();

      expect(app.started).toBe(true);
      expect(app.foundation).toBeInstanceOf(EmptyFoundation);
    });

    it("Bootstrap order — channels created BEFORE Feature.onInit (Phase 1 < Phase 3)", () => {
      const callOrder: string[] = [];

      class ChannelObserverFeature extends StubFeature<"observer"> {
        static readonly channels = [] as const;
        onInit() {
          try {
            Radio.me().channel("observer");
            callOrder.push("channel-exists-at-onInit");
          } catch {
            callOrder.push("channel-MISSING-at-onInit");
          }
        }
      }

      const app = new Application({
        foundation: EmptyFoundation as unknown as typeof Foundation,
        features: { observer: ChannelObserverFeature }
      });
      app.start();

      expect(callOrder).toEqual(["channel-exists-at-onInit"]);
    });

    it("Bootstrap order — Foundation.attach called AFTER all Features.onInit (Phase 3 < Phase 4)", () => {
      const callOrder: string[] = [];

      class FeatureA extends StubFeature<"featA"> {
        static readonly channels = [] as const;
        onInit() {
          callOrder.push("featA:onInit");
        }
      }
      class FeatureB extends StubFeature<"featB"> {
        static readonly channels = [] as const;
        onInit() {
          callOrder.push("featB:onInit");
        }
      }
      class WatcherFoundation extends Foundation {
        get composers() {
          return {};
        }
        onAttach() {
          callOrder.push("foundation:onAttach");
        }
      }

      const app = new Application({
        foundation: WatcherFoundation as unknown as typeof Foundation,
        features: { featA: FeatureA, featB: FeatureB }
      });
      app.start();

      expect(callOrder).toEqual([
        "featA:onInit",
        "featB:onInit",
        "foundation:onAttach"
      ]);
    });
  });
});
