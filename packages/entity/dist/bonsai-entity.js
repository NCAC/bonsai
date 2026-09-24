/**
 * @bonsai/entity - Version 0.1.0
 * Bundled by Bonsai Build System
 * Date: 2026-09-24T20:32:46.185Z
 */
import { Immer } from '@bonsai/immer';
import { EntityReentrancyError, MutationError } from '@bonsai/error';

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise, SuppressedError, Symbol, Iterator */


function __classPrivateFieldGet(receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
}

function __classPrivateFieldSet(receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

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
 * knows its Feature (I5, I6).
 */
var _Entity_instances, _Entity_state, _Entity_initialState, _Entity_listeners, _Entity_initialized, _Entity_draining, _Entity_cycleDepth, _Entity_queue, _Entity_ensureInitialized, _Entity_runCycle;
Immer.enablePatches();
// ─── Abstract Entity class ───────────────────────────────────────────────────
/**
 * Entity — immutable state container of a Feature (I6, I22, I46).
 *
 * Abstract class: subclasses must implement `defineInitialState()`.
 *
 * @template TStructure - The state type, constrained to TJsonSerializable.
 */
class Entity {
    constructor() {
        _Entity_instances.add(this);
        /**
         * Current Entity state. Readable by subclasses and by any code holding a
         * reference to the Entity.
         */
        _Entity_state.set(this, void 0);
        /**
         * Copy of the initial state, returned by `initialState` (ADR-10).
         */
        _Entity_initialState.set(this, void 0);
        /**
         * Catch-all listeners (I51).
         */
        _Entity_listeners.set(this, []);
        /**
         * Initialisation flag (lazy init, to work around the abstract-member restriction).
         */
        _Entity_initialized.set(this, false);
        // ─── FIFO re-entrance (I98) ────────────────────────────────────────────
        /** `true` while a mutate → notify cycle is running (external driver). */
        _Entity_draining.set(this, false);
        /** Depth of the current cycle (1 = external call, incremented on each dequeue). */
        _Entity_cycleDepth.set(this, 0);
        /** FIFO queue of mutations triggered during a notification. */
        _Entity_queue.set(this, []);
        // Actual initialisation happens in #ensureInitialized(), because
        // TS forbids accessing abstract members in the constructor.
        __classPrivateFieldGet(this, _Entity_instances, "m", _Entity_ensureInitialized).call(this);
    }
    // ─── Overridable configuration ─────────────────────────────────────────
    /**
     * Maximum re-entrance depth (I98, stratum 1a — default 3).
     * A concrete subclass may override it for advanced use cases.
     */
    get maxEntityNotificationDepth() {
        return 3;
    }
    // ─── Public API ──────────────────────────────────────────────────────
    /**
     * Current state (read-only from outside).
     */
    get state() {
        return __classPrivateFieldGet(this, _Entity_state, "f");
    }
    /**
     * Returns the initial state as defined at construction (ADR-10).
     * Public, for reset or comparison.
     */
    get initialState() {
        return __classPrivateFieldGet(this, _Entity_initialState, "f");
    }
    mutate(intent, paramsOrRecipe, maybeRecipe) {
        // Overload resolution
        let params = null;
        let recipe;
        if (typeof paramsOrRecipe === "function") {
            recipe = paramsOrRecipe;
        }
        else {
            params = paramsOrRecipe;
            recipe = maybeRecipe;
        }
        // Re-entrance: a cycle is already running — enqueue (I98)
        if (__classPrivateFieldGet(this, _Entity_draining, "f")) {
            const wouldBeDepth = __classPrivateFieldGet(this, _Entity_cycleDepth, "f") + __classPrivateFieldGet(this, _Entity_queue, "f").length + 1;
            if (wouldBeDepth > this.maxEntityNotificationDepth) {
                throw new EntityReentrancyError(`Entity re-entrance exceeded maxEntityNotificationDepth (${this.maxEntityNotificationDepth}) — intent "${intent}"`, "I98", "Entity", "Check that no entity handler triggers a cascading mutation loop.");
            }
            __classPrivateFieldGet(this, _Entity_queue, "f").push({ intent, params, recipe });
            return null;
        }
        // External call — this mutate() drives the whole cycle (first + queue)
        __classPrivateFieldSet(this, _Entity_draining, true, "f");
        __classPrivateFieldSet(this, _Entity_cycleDepth, 1, "f");
        try {
            const firstEvent = __classPrivateFieldGet(this, _Entity_instances, "m", _Entity_runCycle).call(this, intent, params, recipe);
            while (__classPrivateFieldGet(this, _Entity_queue, "f").length > 0) {
                __classPrivateFieldSet(this, _Entity_cycleDepth, __classPrivateFieldGet(this, _Entity_cycleDepth, "f") + 1, "f");
                const next = __classPrivateFieldGet(this, _Entity_queue, "f").shift();
                __classPrivateFieldGet(this, _Entity_instances, "m", _Entity_runCycle).call(this, next.intent, next.params, next.recipe);
            }
            return firstEvent;
        }
        finally {
            __classPrivateFieldSet(this, _Entity_draining, false, "f");
            __classPrivateFieldSet(this, _Entity_cycleDepth, 0, "f");
            __classPrivateFieldGet(this, _Entity_queue, "f").length = 0;
        }
    }
    /**
     * Registers a catch-all listener (I51).
     * Called after every non no-op mutation. No error isolation here — a
     * listener exception propagates up to the external caller of `mutate()`
     * (I98 relies on that propagation). `BroadcastError` isolation is the
     * responsibility of the Feature dispatch (I96).
     */
    onAnyEntityUpdated(listener) {
        __classPrivateFieldGet(this, _Entity_listeners, "f").push(listener);
    }
}
_Entity_state = new WeakMap(), _Entity_initialState = new WeakMap(), _Entity_listeners = new WeakMap(), _Entity_initialized = new WeakMap(), _Entity_draining = new WeakMap(), _Entity_cycleDepth = new WeakMap(), _Entity_queue = new WeakMap(), _Entity_instances = new WeakSet(), _Entity_ensureInitialized = function _Entity_ensureInitialized() {
    if (!__classPrivateFieldGet(this, _Entity_initialized, "f")) {
        __classPrivateFieldSet(this, _Entity_initialState, this.defineInitialState(), "f");
        __classPrivateFieldSet(this, _Entity_state, __classPrivateFieldGet(this, _Entity_initialState, "f"), "f");
        __classPrivateFieldSet(this, _Entity_initialized, true, "f");
    }
}, _Entity_runCycle = function _Entity_runCycle(intent, params, recipe) {
    const previousState = __classPrivateFieldGet(this, _Entity_state, "f");
    let nextState;
    let patches;
    let inversePatches;
    try {
        [nextState, patches, inversePatches] = Immer.produceWithPatches(previousState, recipe);
    }
    catch (error) {
        throw new MutationError(`Recipe threw for intent "${intent}" — state kept (Immer rollback)`, "ADR-05", "Entity", error instanceof Error ? error.message : String(error));
    }
    if (patches.length === 0) {
        // No-op — no notification
        return null;
    }
    // changedKeys derived from the first path segment of each patch (I97)
    const changedKeys = [...new Set(patches.map((p) => String(p.path[0])))];
    __classPrivateFieldSet(this, _Entity_state, nextState, "f");
    const event = {
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
    for (const listener of __classPrivateFieldGet(this, _Entity_listeners, "f")) {
        listener(event);
    }
    return event;
};

export { Entity };
