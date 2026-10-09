/**
 * @bonsai/entity — Entity base class
 *
 * Implements ADR-10:
 *   - mutate(intent, params?, recipe) through Immer produceWithPatches
 *   - changedKeys derived from the patches (first path segment)
 *   - No-op detection (no patch produced → no notification)
 *   - Catch-all notification onAnyEntityUpdated (I51) — enriched event
 *     (patches, inversePatches, payload, metas)
 *   - FIFO re-entrance bounded by maxEntityNotificationDepth (I98,
 *     stratum 1a) — see docs/spec/3-couche-abstraite/entity.md
 *   - MutationError when the recipe throws (automatic Immer rollback,
 *     ADR-05)
 *   - initialState getter (ADR-10)
 *
 * NOTE: per-key `on<Key>EntityUpdated` handlers are NOT dispatched here —
 * that is the job of `Feature#registerEntityHandlers` (I96), which
 * subscribes to `onAnyEntityUpdated` and routes internally. An Entity never
 * knows its Feature (I6).
 */

import { Immer } from "@bonsai/immer";
import type { Draft, Patch } from "immer";
import { EntityReentrancyError, MutationError } from "@bonsai/error";

Immer.enablePatches();

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
 * Introduced by ADR-09 — derives the state shape from an Entity class
 * without declaring it again by hand.
 *
 * @example
 *   type TCartState = TEntityState<CartEntity>;  // = { items: [...]; total: number }
 */
export type TEntityState<E extends Entity<TJsonSerializable>> =
  E extends Entity<infer S> ? S : never;

/**
 * Optional parameters passed to mutate() — payload + metas (traceability).
 */
export type TMutationParams = {
  payload?: unknown;
  metas?: Record<string, unknown>;
};

/**
 * Event emitted after a successful (non no-op) mutation.
 * Received by onAnyEntityUpdated listeners, and dispatched by the Feature to
 * its per-key/catch-all handlers (I96).
 */
export type TEntityEvent<
  TStructure extends TJsonSerializable = TJsonSerializable
> = {
  readonly intent: string;
  readonly payload?: unknown;
  readonly metas?: Record<string, unknown>;
  readonly changedKeys: string[];
  readonly patches: Patch[];
  readonly inversePatches: Patch[];
  readonly previousState: TStructure;
  readonly nextState: TStructure;
  readonly timestamp: number;
};

/**
 * Signature of the catch-all listener.
 */
export type TEntityUpdateListener<
  TStructure extends TJsonSerializable = TJsonSerializable
> = (event: TEntityEvent<TStructure>) => void;

/**
 * Mutation waiting in the re-entrance queue (I98).
 */
type TPendingMutation<TStructure extends TJsonSerializable> = {
  intent: string;
  params: TMutationParams | null;
  recipe: (draft: Draft<TStructure>) => void;
};

// ─── Abstract Entity class ───────────────────────────────────────────────────

/**
 * Entity — immutable state container of a Feature (I6, I22, I46).
 *
 * Abstract class: subclasses must implement `defineInitialState()`.
 *
 * @template TStructure - The state type, constrained to TJsonSerializable.
 */
export abstract class Entity<TStructure extends TJsonSerializable> {
  /**
   * Current Entity state. Readable by subclasses and by any code holding a
   * reference to the Entity.
   */
  #state!: TStructure;

  /**
   * Copy of the initial state, returned by `initialState` (ADR-10).
   */
  #initialState!: TStructure;

  /**
   * Catch-all listeners (I51).
   */
  #listeners: Array<TEntityUpdateListener<TStructure>> = [];

  /**
   * Initialisation flag (lazy init, to work around the abstract-member restriction).
   */
  #initialized = false;

  // ─── FIFO re-entrance (I98) ────────────────────────────────────────────

  /** `true` while a mutate → notify cycle is running (external driver). */
  #draining = false;

  /** Depth of the current cycle (1 = external call, incremented on each dequeue). */
  #cycleDepth = 0;

  /** FIFO queue of mutations triggered during a notification. */
  #queue: TPendingMutation<TStructure>[] = [];

  constructor() {
    // Actual initialisation happens in #ensureInitialized(), because
    // TS forbids accessing abstract members in the constructor.
    this.#ensureInitialized();
  }

  #ensureInitialized(): void {
    if (!this.#initialized) {
      this.#initialState = this.defineInitialState();
      this.#state = this.#initialState;
      this.#initialized = true;
    }
  }

  // ─── Abstract ────────────────────────────────────────────────────────

  /**
   * Returns the initial state of the Entity.
   * Every concrete subclass MUST implement this method.
   */
  protected abstract defineInitialState(): TStructure;

  // ─── Overridable configuration ─────────────────────────────────────────

  /**
   * Maximum re-entrance depth (I98, stratum 1a — default 3).
   * A concrete subclass may override it for advanced use cases.
   */
  protected get maxEntityNotificationDepth(): number {
    return 3;
  }

  // ─── Public API ──────────────────────────────────────────────────────

  /**
   * Current state (read-only from outside).
   */
  get state(): TStructure {
    return this.#state;
  }

  /**
   * Returns the initial state as defined at construction (ADR-10).
   * Public, for reset or comparison.
   */
  get initialState(): TStructure {
    return this.#initialState;
  }

  /**
   * Immutable mutation through Immer produceWithPatches (ADR-10, I97).
   *
   * Overload 1: mutate(intent, recipe)
   * Overload 2: mutate(intent, params, recipe)
   *
   * Detects no-ops: when no patch is produced → no notification, returns
   * `null`.
   *
   * Re-entrance (I98): when called during a running notification cycle, the
   * mutation is queued (FIFO) and executed once the current cycle ends —
   * returns `null` immediately (the event is not available synchronously).
   * Throws `EntityReentrancyError` if `maxEntityNotificationDepth` would be
   * exceeded.
   *
   * @throws MutationError when the recipe throws (state intact, Immer rollback).
   * @throws EntityReentrancyError when the maximum re-entrance depth is exceeded.
   */
  mutate(
    intent: string,
    recipe: (draft: Draft<TStructure>) => void
  ): TEntityEvent<TStructure> | null;
  mutate(
    intent: string,
    params: TMutationParams,
    recipe: (draft: Draft<TStructure>) => void
  ): TEntityEvent<TStructure> | null;
  mutate(
    intent: string,
    paramsOrRecipe: TMutationParams | ((draft: Draft<TStructure>) => void),
    maybeRecipe?: (draft: Draft<TStructure>) => void
  ): TEntityEvent<TStructure> | null {
    // Overload resolution
    let params: TMutationParams | null = null;
    let recipe: (draft: Draft<TStructure>) => void;

    if (typeof paramsOrRecipe === "function") {
      recipe = paramsOrRecipe;
    } else {
      params = paramsOrRecipe;
      recipe = maybeRecipe!;
    }

    // Re-entrance: a cycle is already running — enqueue (I98)
    if (this.#draining) {
      const wouldBeDepth = this.#cycleDepth + this.#queue.length + 1;
      if (wouldBeDepth > this.maxEntityNotificationDepth) {
        throw new EntityReentrancyError(
          `Entity re-entrance exceeded maxEntityNotificationDepth (${this.maxEntityNotificationDepth}) — intent "${intent}"`,
          "I98",
          "Entity",
          "Check that no entity handler triggers a cascading mutation loop."
        );
      }
      this.#queue.push({ intent, params, recipe });
      return null;
    }

    // External call — this mutate() drives the whole cycle (first + queue)
    this.#draining = true;
    this.#cycleDepth = 1;
    try {
      const firstEvent = this.#runCycle(intent, params, recipe);

      while (this.#queue.length > 0) {
        this.#cycleDepth += 1;
        const next = this.#queue.shift()!;
        this.#runCycle(next.intent, next.params, next.recipe);
      }

      return firstEvent;
    } finally {
      this.#draining = false;
      this.#cycleDepth = 0;
      this.#queue.length = 0;
    }
  }

  /**
   * Registers a catch-all listener (I51).
   * Called after every non no-op mutation. No error isolation here — a
   * listener exception propagates up to the external caller of `mutate()`
   * (I98 relies on that propagation). `BroadcastError` isolation is the
   * responsibility of the Feature dispatch (I96).
   */
  onAnyEntityUpdated(listener: TEntityUpdateListener<TStructure>): void {
    this.#listeners.push(listener);
  }

  // ─── Private ─────────────────────────────────────────────────────────

  /**
   * Runs a full cycle: recipe → patches → notification.
   * Does not handle the queue — that is the caller's job (`mutate()`).
   */
  #runCycle(
    intent: string,
    params: TMutationParams | null,
    recipe: (draft: Draft<TStructure>) => void
  ): TEntityEvent<TStructure> | null {
    const previousState = this.#state;

    let nextState: TStructure;
    let patches: Patch[];
    let inversePatches: Patch[];
    try {
      [nextState, patches, inversePatches] = Immer.produceWithPatches(
        previousState,
        recipe
      ) as [TStructure, Patch[], Patch[]];
    } catch (error) {
      throw new MutationError(
        `Recipe threw for intent "${intent}" — state kept (Immer rollback)`,
        "ADR-05",
        "Entity",
        error instanceof Error ? error.message : String(error)
      );
    }

    if (patches.length === 0) {
      // No-op — no notification
      return null;
    }

    // changedKeys derived from the first path segment of each patch (I97)
    const changedKeys = [...new Set(patches.map((p) => String(p.path[0])))];

    this.#state = nextState;

    const event: TEntityEvent<TStructure> = {
      intent,
      payload: params?.payload,
      metas: params?.metas,
      changedKeys,
      patches,
      inversePatches,
      previousState,
      nextState,
      timestamp: Date.now()
    };

    for (const listener of this.#listeners) {
      listener(event);
    }

    return event;
  }
}
