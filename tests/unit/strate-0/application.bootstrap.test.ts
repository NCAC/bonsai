/**
 * Tests Strate 0 — Application bootstrap
 *
 * Invariants prouvés :
 *   I23  — Application est dormante au runtime
 *   I24  — Application garantit l'unicité des namespaces au bootstrap
 *   I56  — onInit() de chaque Feature appelé avant la création de la Foundation
 *
 * Sémantiques strate 0 :
 *   - register(FeatureClass) — enregistre une Feature
 *   - start() — bootstrap en 4 phases simplifiées
 *
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { resetDOM } from "../../helpers/dom-setup";
import { Application } from "@bonsai/application";
import { Foundation } from "@bonsai/foundation";
import { Entity } from "@bonsai/entity";
import { Feature } from "@bonsai/feature";
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

class CartFeature extends Feature<CartEntity> {
  static readonly namespace = "cart" as const;
  static readonly channels = {
    commands: ["addItem"],
    events: ["itemAdded"],
    requests: []
  } as const;

  protected get Entity() {
    return CartEntity;
  }
}

class EmptyFoundation extends Foundation {
  get composers() {
    return {};
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Application bootstrap — Strate 0 [I23, I24, I56]", () => {
  beforeEach(() => {
    resetDOM();
    Radio.reset();
  });

  describe("register() — Feature registration", () => {
    it("register() accepts a Feature class", () => {
      const app = new Application();
      expect(() => app.register(CartFeature)).not.toThrow();
    });

    it("I24 — register() with duplicate namespace throws", () => {
      const app = new Application();
      app.register(CartFeature);

      class FakeCartFeature extends Feature {
        static readonly namespace = "cart" as const;
        static readonly channels = {
          commands: [],
          events: [],
          requests: []
        } as const;
      }

      expect(() => app.register(FakeCartFeature)).toThrow(
        /namespace.*collision/i
      );
    });

    it("register() after start() throws", () => {
      const app = new Application({
        foundation: EmptyFoundation as unknown as typeof Foundation
      });
      app.register(CartFeature);
      app.start();

      class AnotherFeature extends Feature {
        static readonly namespace = "orders" as const;
        static readonly channels = {
          commands: [],
          events: [],
          requests: []
        } as const;
      }

      expect(() => app.register(AnotherFeature)).toThrow(/already started/i);
    });
  });

  describe("start() — 4-phase bootstrap", () => {
    it("start() creates channels for registered Features", () => {
      const app = new Application({
        foundation: EmptyFoundation as unknown as typeof Foundation
      });
      app.register(CartFeature);
      app.start();

      // Channel "cart" should exist in Radio
      expect(() => Radio.me().channel("cart")).not.toThrow();
    });

    it("I56 — onInit() of every Feature called before Foundation creation", () => {
      const callOrder: string[] = [];

      class OrderedFeature extends Feature {
        static readonly namespace = "ordered" as const;
        static readonly channels = {
          commands: [],
          events: [],
          requests: []
        } as const;
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
        foundation: OrderedFoundation as unknown as typeof Foundation
      });
      app.register(OrderedFeature);
      app.start();

      const initIndex = callOrder.indexOf("feature:onInit");
      const foundationIndex = callOrder.indexOf("foundation:onAttach");
      expect(initIndex).toBeLessThan(foundationIndex);
    });

    it("start() can only be called once", () => {
      const app = new Application({
        foundation: EmptyFoundation as unknown as typeof Foundation
      });
      app.register(CartFeature);
      app.start();

      expect(() => app.start()).toThrow(/already started/i);
    });
  });

  describe("I23 — Application is dormant at runtime", () => {
    it("Application has no runtime behavior after start()", () => {
      const app = new Application({
        foundation: EmptyFoundation as unknown as typeof Foundation
      });
      app.register(CartFeature);
      app.start();

      expect((app as any).handle).toBeUndefined();
      expect((app as any).emit).toBeUndefined();
      expect((app as any).listen).toBeUndefined();
      expect((app as any).request).toBeUndefined();
    });
  });

  describe("Namespace reserved words", () => {
    it("namespace 'local' is reserved — throws at registration", () => {
      class BadFeature extends Feature {
        static readonly namespace = "local" as const;
        static readonly channels = {
          commands: [],
          events: [],
          requests: []
        } as const;
      }

      const app = new Application();
      expect(() => app.register(BadFeature)).toThrow(/reserved/i);
    });
  });

  // ── Bootstrap guards (Étape 5 — durcissement) ────────────────────────────

  describe("Bootstrap guards [I33, I56, ADR-0010]", () => {
    it("start() throws if no Foundation provided (I33)", () => {
      const app = new Application();
      app.register(CartFeature);

      expect(() => app.start()).toThrow(/no Foundation/i);
    });

    it("start() instantiates the Foundation and exposes app.foundation", () => {
      const app = new Application({
        foundation: EmptyFoundation as unknown as typeof Foundation
      });
      app.register(CartFeature);

      expect(app.foundation).toBeNull();
      expect(app.started).toBe(false);

      app.start();

      expect(app.started).toBe(true);
      expect(app.foundation).toBeInstanceOf(EmptyFoundation);
    });

    it("Bootstrap order — channels created BEFORE Feature.onInit (Phase 1 < Phase 3)", () => {
      const callOrder: string[] = [];

      class ChannelObserverFeature extends Feature {
        static readonly namespace = "observer" as const;
        static readonly channels = {
          commands: [],
          events: [],
          requests: []
        } as const;
        onInit() {
          // Si on arrive ici, le channel doit déjà exister (Phase 1 terminée)
          try {
            Radio.me().channel("observer");
            callOrder.push("channel-exists-at-onInit");
          } catch {
            callOrder.push("channel-MISSING-at-onInit");
          }
        }
      }

      const app = new Application({
        foundation: EmptyFoundation as unknown as typeof Foundation
      });
      app.register(ChannelObserverFeature);
      app.start();

      expect(callOrder).toEqual(["channel-exists-at-onInit"]);
    });

    it("Bootstrap order — Foundation.attach called AFTER all Features.onInit (Phase 3 < Phase 4)", () => {
      const callOrder: string[] = [];

      class FeatureA extends Feature {
        static readonly namespace = "feat-a" as const;
        static readonly channels = {
          commands: [],
          events: [],
          requests: []
        } as const;
        onInit() {
          callOrder.push("featA:onInit");
        }
      }
      class FeatureB extends Feature {
        static readonly namespace = "feat-b" as const;
        static readonly channels = {
          commands: [],
          events: [],
          requests: []
        } as const;
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
        foundation: WatcherFoundation as unknown as typeof Foundation
      });
      app.register(FeatureA);
      app.register(FeatureB);
      app.start();

      expect(callOrder).toEqual([
        "featA:onInit",
        "featB:onInit",
        "foundation:onAttach"
      ]);
    });
  });
});
