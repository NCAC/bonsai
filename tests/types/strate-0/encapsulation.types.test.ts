/**
 * Tests — Encapsulation de la surface applicative
 *
 * Couvre :
 *   I5, I6 — `Feature.entity` est `protected` : inaccessible hors de la Feature
 *            et de ses sous-classes (compile-time, `@ts-expect-error`).
 *   I15    — `Radio` n'est pas exposé par `@bonsai/core` (surface applicative).
 *   I80    — `Channel` n'est pas exposé par `@bonsai/core` : le Channel reste
 *            privé derrière sa Feature.
 *
 * `Radio` et `Channel` restent exportés par `@bonsai/event` pour l'usage
 * inter-packages du framework (ADR-0031) ; le développeur applicatif importe
 * exclusivement depuis `@bonsai/core`.
 *
 * @jest-environment node
 */

import { describe, it, expect } from "@jest/globals";
import { Entity } from "@bonsai/entity";
import { type TChannelDefinition, type TChannelToken } from "@bonsai/event";
import { Feature } from "@bonsai/feature";
import * as Core from "@bonsai/core";

type TCounterState = { count: number };

class CounterEntity extends Entity<TCounterState> {
  protected defineInitialState(): TCounterState {
    return { count: 0 };
  }
}

class CounterFeature extends Feature<
  CounterEntity,
  TChannelDefinition,
  "counter"
> {
  static readonly channel: TChannelToken<TChannelDefinition, "counter"> = {
    namespace: "counter"
  };
  get listens() {
    return [] as const;
  }
  get queries() {
    return [] as const;
  }
  protected get Entity() {
    return CounterEntity;
  }
}

describe("Encapsulation Feature → Entity [I5, I6]", () => {
  it("I5, I6 — `entity` est inaccessible hors de la Feature (compile-time)", () => {
    const feature = new CounterFeature("counter");
    // @ts-expect-error — `entity` est protected (I5, I6)
    void feature.entity;
  });
});

describe("Surface applicative @bonsai/core [I15, I80]", () => {
  it("I15 — `Radio` n'est pas exporté par @bonsai/core", () => {
    // @ts-expect-error — `Radio` absent de la surface applicative (I15)
    void Core.Radio;
    expect("Radio" in Core).toBe(false);
  });

  it("I80 — `Channel` n'est pas exporté par @bonsai/core", () => {
    // @ts-expect-error — `Channel` absent de la surface applicative (I80)
    void Core.Channel;
    expect("Channel" in Core).toBe(false);
  });
});
