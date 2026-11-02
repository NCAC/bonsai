/**
 * Tests — Application on the kernel (lot M6.1)
 *
 * Invariants proved:
 *   I21 / I71 — unique camelCase namespaces, reserved names refused
 *   I22 / I73 — `static readonly channel` present and in agreement with the key
 *   I23       — the Application is dormant once started
 *   I56       — every Feature's onInit runs inside the startup unit
 *   I70       — every reference is checked against the manifest
 *   I72       — instances receive the manifest key as namespace
 *   G6        — one communication root per Application
 *   C.1       — start order by initial Query dependencies; a cycle is refused
 *   §2.5      — a startup failure abandons the model under construction
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { Application } from "@bonsai/application";
import { Feature, BonsaiNamespaceError, type TFeatureContext } from "@bonsai/feature";
import { Entity } from "@bonsai/entity";
import { ManifestError, StartupError, type TChannelDefinition, type TChannelToken } from "@bonsai/event";

// ─── Fixtures ──────────────────────────────────────────────────────────────

class EmptyEntity extends Entity<{ n: number }> {
  protected defineInitialState() { return { n: 0 }; }
}

type TDef = TChannelDefinition;
const order: string[] = [];
beforeEach(() => { order.length = 0; });

/** Builds a Feature class that records its onInit and declares its dependencies. */
function feature(ns: string, deps: { listens?: string[]; queries?: string[]; dependsOn?: string[] } = {}, init?: () => void) {
  const token = (n: string): TChannelToken<TDef, string> => ({ namespace: n });
  class F extends Feature<EmptyEntity, TDef, string> {
    static readonly channel: TChannelToken<TDef, string> = { namespace: ns };
    get listens() { return (deps.listens ?? []).map(token); }
    get queries() { return (deps.queries ?? []).map(token); }
    get dependsOn() { return (deps.dependsOn ?? []).map(token); }
    protected get Entity() { return EmptyEntity; }
    onInit(_ctx: TFeatureContext<TDef, EmptyEntity>): void {
      order.push(ns);
      init?.();
    }
  }
  return F;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("Application on the kernel — lot M6.1", () => {
  describe("manifest (ADR-08 — I68/I69/I72)", () => {
    it("accepts a manifest, and an empty one", () => {
      expect(() => new Application({ features: { a: feature("a") } }).start()).not.toThrow();
      expect(() => new Application().start()).not.toThrow();
    });

    it("instantiates each Feature with the namespace of its key (I72)", () => {
      const seen: string[] = [];
      class Probe extends feature("alpha") {
        constructor(ns: string) { super(ns); seen.push(ns); }
      }
      new Application({ features: { alpha: Probe } }).start();
      expect(seen).toEqual(["alpha"]);
    });

    it("has no register() method any more (ADR-08)", () => {
      expect((new Application() as unknown as { register?: unknown }).register).toBeUndefined();
    });

    it("start() can be called only once", () => {
      const app = new Application({ features: { a: feature("a") } });
      app.start();
      expect(() => app.start()).toThrow(/already started/);
    });
  });

  describe("runtime validation (I70, I71, I73)", () => {
    it("a non-camelCase key → NAMESPACE_INVALID_FORMAT", () => {
      expect(() => new Application({ features: { "my-cart": feature("my-cart") } as never }).start()).toThrow(
        expect.objectContaining({ code: "NAMESPACE_INVALID_FORMAT" })
      );
    });

    it("an empty key → NAMESPACE_INVALID_FORMAT", () => {
      expect(() => new Application({ features: { "": feature("") } as never }).start()).toThrow(BonsaiNamespaceError);
    });

    it("a reserved key → NAMESPACE_RESERVED", () => {
      expect(() => new Application({ features: { router: feature("router") } as never }).start()).toThrow(
        expect.objectContaining({ code: "NAMESPACE_RESERVED" })
      );
    });

    it("a reference to an unknown namespace → NAMESPACE_UNKNOWN_REFERENCE (I70)", () => {
      expect(() => new Application({ features: { ghost: feature("ghost", { listens: ["nowhere"] }) } }).start()).toThrow(
        expect.objectContaining({ code: "NAMESPACE_UNKNOWN_REFERENCE" })
      );
    });

    it("a Feature without static channel → FEATURE_MISSING_CHANNEL (I73)", () => {
      class NoChannel extends Feature<EmptyEntity, TDef, string> {
        get listens() { return [] as const; }
        get queries() { return [] as const; }
        protected get Entity() { return EmptyEntity; }
      }
      expect(() => new Application({ features: { noChannel: NoChannel } as never }).start()).toThrow(
        expect.objectContaining({ code: "FEATURE_MISSING_CHANNEL" })
      );
    });

    it("a channel namespace different from the key → FEATURE_CHANNEL_NAMESPACE_MISMATCH (I22)", () => {
      expect(() => new Application({ features: { other: feature("cart") } as never }).start()).toThrow(
        expect.objectContaining({ code: "FEATURE_CHANNEL_NAMESPACE_MISMATCH" })
      );
    });

    it("cross-references between manifested Features are accepted", () => {
      const features = { cart: feature("cart"), listener: feature("listener", { listens: ["cart"] }) };
      expect(() => new Application({ features }).start()).not.toThrow();
    });
  });

  describe("C.1 — start order by initial dependencies (`dependsOn`)", () => {
    it("starts a Feature after those it queries, whatever the declaration order", () => {
      new Application({
        features: {
          top: feature("top", { queries: ["middle"], dependsOn: ["middle"] }),
          middle: feature("middle", { queries: ["base"], dependsOn: ["base"] }),
          base: feature("base")
        }
      }).start();
      expect(order).toEqual(["base", "middle", "top"]);
    });

    it("among Features without dependency, declaration order decides", () => {
      new Application({ features: { b: feature("b"), a: feature("a"), c: feature("c") } }).start();
      expect(order).toEqual(["b", "a", "c"]);
    });

    it("listening creates no start dependency", () => {
      new Application({ features: { listener: feature("listener", { listens: ["source"] }), source: feature("source") } }).start();
      expect(order).toEqual(["listener", "source"]);
    });

    it("querying creates no start dependency: Features may query each other during their life", () => {
      const features = { a: feature("a", { queries: ["b"] }), b: feature("b", { queries: ["a"] }) };
      new Application({ features }).start();
      expect(order).toEqual(["a", "b"]);
    });

    it("cyclic initial dependencies are refused before anything starts", () => {
      const features = {
        a: feature("a", { queries: ["b"], dependsOn: ["b"] }),
        b: feature("b", { queries: ["a"], dependsOn: ["a"] })
      };
      expect(() => new Application({ features }).start()).toThrow(ManifestError);
      expect(order).toEqual([]);
    });

    it("an initial dependency must be a declared Query", () => {
      const features = { a: feature("a", { dependsOn: ["b"] }), b: feature("b") };
      expect(() => new Application({ features }).start()).toThrow(/FEATURE_DEPENDENCY_NOT_QUERIED/);
      expect(order).toEqual([]);
    });

    it("an unknown initial dependency is refused before anything starts", () => {
      const features = { a: feature("a", { queries: ["ghost"], dependsOn: ["ghost"] }) };
      expect(() => new Application({ features }).start()).toThrow(/NAMESPACE_UNKNOWN_REFERENCE/);
    });
  });

  describe("§2.5 — startup", () => {
    it("every Feature's onInit runs inside the startup unit (I56)", () => {
      const app = new Application({ features: { a: feature("a"), b: feature("b") } });
      app.start();
      expect(order).toEqual(["a", "b"]);
      expect(app.root!.trace.some((e) => e.type === "unit-failed")).toBe(false);
    });

    it("a Feature failing in onInit abandons the whole model (StartupError)", () => {
      const features = {
        a: feature("a"),
        boom: feature("boom", {}, () => { throw new Error("init failed"); })
      };
      const app = new Application({ features });
      expect(() => app.start()).toThrow(StartupError);
    });
  });

  describe("G6 / I23 — one root, dormant Application", () => {
    it("exposes no root before start, one after", () => {
      const app = new Application({ features: { a: feature("a") } });
      expect(app.root).toBeNull();
      expect(app.started).toBe(false);
      app.start();
      expect(app.root).not.toBeNull();
      expect(app.started).toBe(true);
    });

    it("two Applications have two independent roots", () => {
      const one = new Application({ features: { a: feature("a") } });
      const two = new Application({ features: { a: feature("a") } });
      one.start();
      two.start();
      expect(one.root).not.toBe(two.root);
    });

    it("exposes no communication capability", () => {
      const app = new Application() as unknown as Record<string, unknown>;
      for (const name of ["emit", "trigger", "handle", "listen", "request", "query"]) {
        expect(app[name]).toBeUndefined();
      }
    });
  });
});
