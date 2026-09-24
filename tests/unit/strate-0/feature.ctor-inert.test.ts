/**
 * Tests Strate 0 — Constructeur de Feature inerte [I94, ADR-0046]
 *
 * Preuve du gate ADR-0046 (audit docs/AUDIT-DOCS-2026-09-16.md — T5) :
 * I94 est listé en « Invariants impactés » d'ADR-0046 mais n'était cité
 * dans aucun fichier de `tests/`. Ce fichier comble le vide.
 *
 * I94 — Le constructeur de Feature est inerte : il ne DOIT effectuer aucun
 * side-effect autre que `assertValidNamespace(namespace)` et l'assignement
 * `#namespace = namespace`. Filet runtime : sentinel Phase 0b dans
 * `Application.start()` — snapshot `Radio.me().getChannelNames()` avant
 * `new FeatureClass(ns)` et compare après ; throw si dérive.
 *
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { resetDOM } from "../../helpers/dom-setup";
import { Application } from "@bonsai/application";
import { Foundation } from "@bonsai/foundation";
import { Entity } from "@bonsai/entity";
import { Feature } from "@bonsai/feature";
import {
  Radio,
  type TChannelDefinition,
  type TChannelToken
} from "@bonsai/event";

// ─── Fixtures ────────────────────────────────────────────────────────────────

type TNoopState = Record<string, never>;
class NoopEntity extends Entity<TNoopState> {
  protected defineInitialState(): TNoopState {
    return {};
  }
}

class EmptyFoundation extends Foundation {
  get composers() {
    return {};
  }
}

/** Feature conforme — ctor inerte (I94), aucun side-effect Radio. */
class InertFeature extends Feature<NoopEntity, TChannelDefinition, "inert"> {
  static readonly channel: TChannelToken<TChannelDefinition, "inert"> = {
    namespace: "inert"
  };
  get listens() {
    return [] as const;
  }
  get queries() {
    return [] as const;
  }
  protected get Entity() {
    return NoopEntity;
  }
}

/** Feature non conforme — le ctor crée un Channel dans Radio (viole I94). */
class NonInertFeature extends Feature<
  NoopEntity,
  TChannelDefinition,
  "nonInert"
> {
  static readonly channel: TChannelToken<TChannelDefinition, "nonInert"> = {
    namespace: "nonInert"
  };
  get listens() {
    return [] as const;
  }
  get queries() {
    return [] as const;
  }
  protected get Entity() {
    return NoopEntity;
  }

  constructor(namespace: "nonInert") {
    super(namespace);
    // Side-effect Radio interdit dans le ctor — c'est exactement ce que I94 proscrit.
    Radio.me().channel("sideEffectChannel");
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Feature constructor inertness — Strate 0 [I94, ADR-0046]", () => {
  beforeEach(() => {
    resetDOM();
    Radio.reset();
  });

  it("I94 — a conformant Feature (ctor limited to assertValidNamespace + #namespace) instantiates without mutating Radio", () => {
    const namesBefore = Radio.me().getChannelNames();

    const app = new Application({
      foundation: EmptyFoundation as unknown as typeof Foundation,
      features: { inert: InertFeature }
    });

    expect(() => app.start()).not.toThrow();
    // Seul le Channel "inert" créé en Phase 1 doit apparaître — rien d'autre
    // n'a été ajouté par le ctor de Phase 0b.
    expect(Radio.me().getChannelNames()).toEqual([
      ...namesBefore,
      "inert"
    ]);
  });

  it("I94 — a Feature whose constructor mutates Radio is rejected by the Phase 0b sentinel in Application.start()", () => {
    const app = new Application({
      foundation: EmptyFoundation as unknown as typeof Foundation,
      features: { nonInert: NonInertFeature }
    });

    expect(() => app.start()).toThrow(/constructor is not inert/i);
  });

  it("I94 — the sentinel error message names the offending Feature and cites I94", () => {
    const app = new Application({
      foundation: EmptyFoundation as unknown as typeof Foundation,
      features: { nonInert: NonInertFeature }
    });

    try {
      app.start();
      throw new Error("expected throw");
    } catch (err) {
      expect((err as Error).message).toMatch(/nonInert/);
      expect((err as Error).message).toMatch(/I94/);
    }
  });
});
