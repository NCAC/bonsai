/**
 * @bonsai/entity - Version 0.2.0
 * Bundled by Bonsai Build System
 * Date: 2026-11-04T20:50:13.522Z
 */
import { BonsaiError } from '@bonsai/error';

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
var _Entity_initialState;
// ─── Internal binding to the kernel state ────────────────────────────────────
const stateSources = new WeakMap();
/**
 * @internal Framework use only (`@bonsai/feature`).
 *
 * Binds an Entity to the kernel's current state for the duration of a handler.
 * Returns the function that restores the previous binding (bindings nest when
 * a Query reaches the same Feature again).
 */
function bindEntityState(entity, source) {
    const previous = stateSources.get(entity);
    stateSources.set(entity, source);
    return () => {
        if (previous === undefined)
            stateSources.delete(entity);
        else
            stateSources.set(entity, previous);
    };
}
/**
 * @internal Framework use only (`@bonsai/feature`).
 *
 * What the kernel needs to own the state of an Entity: its name, its initial
 * state and its invariants.
 */
function describeEntity(entity) {
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
class Entity {
    constructor() {
        /**
         * Copy of the initial state, returned by `initialState` (ADR-10).
         */
        _Entity_initialState.set(this, void 0);
        __classPrivateFieldSet(this, _Entity_initialState, this.defineInitialState(), "f");
    }
    // ─── Overridable configuration ─────────────────────────────────────────
    /**
     * Business invariants (11.3, A4.a). Verified by the kernel at the end of
     * every validation unit that touched the state and at the end of startup;
     * a violation fails the unit, which is rolled back (G7).
     */
    get invariants() {
        return [];
    }
    // ─── Public API ──────────────────────────────────────────────────────
    /**
     * Current state, frozen, while a handler of the owning Feature is running.
     *
     * @throws outside a handler: the current state is observed through a Query.
     */
    get state() {
        const source = stateSources.get(this);
        if (source === undefined) {
            throw new BonsaiError("OUTSIDE_HANDLER", `"${this.constructor.name}".state is readable only inside a handler of its Feature. ` +
                "Observe the current state through a Query (G5, I6).");
        }
        return source();
    }
    /**
     * Returns the initial state as defined at construction (ADR-10).
     */
    get initialState() {
        return __classPrivateFieldGet(this, _Entity_initialState, "f");
    }
}
_Entity_initialState = new WeakMap();

export { Entity, bindEntityState, describeEntity };
