/**
 * Test — public surface of @bonsai/error: the BonsaiError taxonomy (ADR-05)
 * and the validation helpers (ADR-06), through the package entry point.
 */

import { describe, expect, it, jest } from "@jest/globals";
import {
  BonsaiError,
  MutationError,
  EntityReentrancyError,
  CommandError,
  RequestError,
  BroadcastError,
  ListenerError,
  NoHandlerError,
  DuplicateHandlerError,
  RenderError,
  BehaviorError,
  invariant,
  hardInvariant,
  warning,
  isDev
} from "@bonsai/error";

describe("BonsaiError (ADR-05)", () => {
  it("formats the invariant id, the component and the suggestion when given", () => {
    const full = new BonsaiError("duplicate handler", "I10", "cart", "remove one of them");
    expect(full.message).toBe("[I10] cart — duplicate handler\n  → remove one of them");
    expect([full.invariantId, full.component, full.suggestion]).toEqual(["I10", "cart", "remove one of them"]);
    expect(full.name).toBe("BonsaiError");

    const bare = new BonsaiError("no context", "ADR-05");
    expect(bare.message).toBe("[ADR-05] — no context");
    expect([bare.component, bare.suggestion]).toEqual(["", ""]);
  });

  it("names each error of the taxonomy and keeps it a BonsaiError", () => {
    const classes = [
      MutationError,
      EntityReentrancyError,
      CommandError,
      RequestError,
      BroadcastError,
      ListenerError,
      NoHandlerError,
      DuplicateHandlerError,
      RenderError,
      BehaviorError
    ];
    for (const ErrorClass of classes) {
      const error = new ErrorClass("failed", "I1", "cart");
      expect(error).toBeInstanceOf(BonsaiError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe(ErrorClass.name);
      expect(error.message).toBe("[I1] cart — failed");
    }
  });
});

describe("Validation helpers (ADR-06)", () => {
  it("isDev is true when __DEV__ is not defined (tests run the sources, not a bundle)", () => {
    expect(isDev()).toBe(true);
  });

  it("invariant and hardInvariant throw a BonsaiError only when the condition is false", () => {
    expect(() => invariant(true, "never")).not.toThrow();
    expect(() => hardInvariant(1, "never")).not.toThrow();
    expect(() => invariant(false, "dev check", "I10", "cart")).toThrow("[I10] cart — dev check");
    expect(() => hardInvariant(0, "structural", "I21")).toThrow(BonsaiError);
  });

  it("warning logs in development and never throws", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    warning(true, "silent");
    warning(false, "something is off");
    expect(warn.mock.calls).toEqual([["[Bonsai] something is off"]]);
  });
});
