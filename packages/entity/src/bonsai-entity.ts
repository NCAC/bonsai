/**
 * @bonsai/entity — Entity base class
 *
 * The Entity describes the domain state of a Feature (theory 11.3, A4.a):
 *   - its initial state (`defineInitialState`)
 *   - its business invariants (`invariants`), verified by the kernel at the
 *     successful end of every validation unit that touched the state
 *   - its read methods (`query`-style getters), which read the current state
 *
 * The state itself is **owned by the kernel** (migration lot M6.1): it lives in
 * the root, is mutated only through the handler context (`ctx.mutate`), and is
 * journaled so that a failed unit leaves it intact (G7). The Entity holds no
 * mutable state and no `mutate` method: a mutation outside a unit is not
 * expressible (A5.a).
 *
 * `state` is readable only while a handler of the owning Feature is running
 * (the Feature binds the Entity to the kernel's current state for the duration
 * of the handler). Anywhere else it throws: the current state is observed
 * through a Query (G5), never by holding the Entity.
 *
 * Notifications `on<Key>EntityUpdated` / `onAnyEntityUpdated` are not sent by
 * the Entity any more: after a mutation the Feature delivers them to itself as
 * a deferred local message (G5, D8). An Entity never knows its Feature (I6).
 */

import type { Draft, Patch } from "immer";
import type { TCausalContext } from "@bonsai/kernel";
import { BonsaiError } from "@bonsai/error";

// ─── Public types ────────────────────────────────────────────────────────────

/**
 * Structural constraint: an Entity state must be JsonSerializable (I46).
 */
export type TJsonSerializable =
  | string
  | number
  | boolean
  | null
  | TJsonSerializable[]
  | { [key: string]: TJsonSerializable };

/**
 * Extracts the state structure (TStructure) of a concrete Entity class.
 *
 * @example
 *   type TCartState = TEntityState<CartEntity>;  // = { items: [...]; total: number }
 */
export type TEntityState<E extends Entity<TJsonSerializable>> =
  E extends Entity<infer S> ? S : never;

/**
 * Optional parameters passed to `ctx.mutate()`. The causal context is not a
 * parameter: the kernel attaches it to the `TEntityEvent` (ADR-04).
 */
export type TMutationParams = {
  payload?: unknown;
};

/**
 * Event describing a successful (non no-op) mutation.
 * Received by the Feature's `on<Key>EntityUpdated` / `onAnyEntityUpdated`
 * handlers, as a deferred local message.
 */
export type TEntityEvent<
  TStructure extends TJsonSerializable = TJsonSerializable
> = {
  readonly intent: string;
  readonly payload?: unknown;
  /** Causal context of the unit that mutated, established by the kernel (G8, ADR-04). */
  readonly context: TCausalContext;
  readonly changedKeys: string[];
  readonly patches: Patch[];
  readonly inversePatches: Patch[];
  readonly previousState: TStructure;
  readonly nextState: TStructure;
  readonly timestamp: number;
};

/**
 * Recipe applied to a draft of the state.
 */
export type TEntityRecipe<TStructure extends TJsonSerializable> = (
  draft: Draft<TStructure>
) => void;

/**
 * A business invariant: `check` returns `true` when the state satisfies it.
 * Verified at the end of every validation unit that touched the state (A4.a).
 */
export type TEntityInvariant<TStructure extends TJsonSerializable> = {
  readonly name: string;
  readonly check: (state: TStructure) => boolean;
};

// ─── Internal binding to the kernel state ────────────────────────────────────

const stateSources = new WeakMap<object, () => unknown>();

/**
 * @internal Framework use only (`@bonsai/feature`).
 *
 * Binds an Entity to the kernel's current state for the duration of a handler.
 * Returns the function that restores the previous binding (bindings nest when
 * a Query reaches the same Feature again).
 */
export function bindEntityState(
  entity: Entity<TJsonSerializable>,
  source: () => unknown
): () => void {
  const previous = stateSources.get(entity);
  stateSources.set(entity, source);
  return () => {
    if (previous === undefined) stateSources.delete(entity);
    else stateSources.set(entity, previous);
  };
}

/**
 * @internal Framework use only (`@bonsai/feature`).
 *
 * What the kernel needs to own the state of an Entity: its name, its initial
 * state and its invariants.
 */
export function describeEntity<TStructure extends TJsonSerializable>(
  entity: Entity<TStructure>
): {
  readonly name: string;
  readonly initial: TStructure;
  readonly invariants: ReadonlyArray<TEntityInvariant<TStructure>>;
} {
  return {
    name: entity.constructor.name,
    initial: entity.initialState,
    invariants: entity.invariants
  };
}

// ─── Abstract Entity class ───────────────────────────────────────────────────

/**
 * Entity — description of the domain state of a Feature (I6, I22, I46).
 *
 * Abstract class: subclasses must implement `defineInitialState()`.
 *
 * @template TStructure - The state type, constrained to TJsonSerializable.
 */
export abstract class Entity<TStructure extends TJsonSerializable> {
  /**
   * Copy of the initial state, returned by `initialState` (ADR-10).
   */
  readonly #initialState: TStructure;

  constructor() {
    this.#initialState = this.defineInitialState();
  }

  // ─── Abstract ────────────────────────────────────────────────────────

  /**
   * Returns the initial state of the Entity.
   * Every concrete subclass MUST implement this method.
   */
  protected abstract defineInitialState(): TStructure;

  // ─── Overridable configuration ─────────────────────────────────────────

  /**
   * Business invariants (11.3, A4.a). Verified by the kernel at the end of
   * every validation unit that touched the state and at the end of startup;
   * a violation fails the unit, which is rolled back (G7).
   */
  get invariants(): ReadonlyArray<TEntityInvariant<TStructure>> {
    return [];
  }

  // ─── Public API ──────────────────────────────────────────────────────

  /**
   * Current state, frozen, while a handler of the owning Feature is running.
   *
   * @throws outside a handler: the current state is observed through a Query.
   */
  get state(): TStructure {
    const source = stateSources.get(this);
    if (source === undefined) {
      throw new BonsaiError("OUTSIDE_HANDLER", 
        `"${this.constructor.name}".state is readable only inside a handler of its Feature. ` +
          "Observe the current state through a Query (G5, I6)."
      );
    }
    return source() as TStructure;
  }

  /**
   * Returns the initial state as defined at construction (ADR-10).
   */
  get initialState(): TStructure {
    return this.#initialState;
  }
}
