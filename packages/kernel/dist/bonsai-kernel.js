/**
 * @bonsai/kernel - Version 0.2.0
 * Bundled by Bonsai Build System
 * Date: 2026-11-04T21:46:40.105Z
 */
import { Immer } from '@bonsai/immer';
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
 * Execution kernel — transport errors (G5, G7, D9).
 *
 * A transport error is not a business answer: it interrupts the author and
 * propagates to the outermost validation unit, which then fails (G7).
 *
 * Every kernel error derives from `BonsaiError` (ADR-05): stable `code`, and
 * the causal context where it was born (`context`, ADR-04). `cause` keeps its
 * standard `Error.cause` meaning: the original error being reported.
 */
class TransportError extends BonsaiError {
    constructor(code, message, cause) {
        super(code, message, { cause });
        this.name = "TransportError";
    }
}
/** Raised by `Root.start()` when the startup unit fails (§2.5, C.1). */
class StartupError extends BonsaiError {
    constructor(cause) {
        super("STARTUP_FAILED", "the model under construction was abandoned (§2.5)", { cause });
        this.name = "StartupError";
    }
}
/**
 * A business invariant is violated at the end of a validation unit (A4.a).
 * Not a transport error: the unit fails and is rolled back (G7).
 */
class InvariantError extends BonsaiError {
    constructor(entity, invariant) {
        super("INVARIANT_VIOLATED", `invariant "${invariant}" violated at the end of the validation unit (A4.a)`, { component: entity });
        this.name = "InvariantError";
        this.entity = entity;
        this.invariant = invariant;
    }
}
/** The Manifest cannot be ordered: unknown or cyclic initial dependency (C.1). */
class ManifestError extends BonsaiError {
    constructor(code, message) {
        super(code, message);
        this.name = "ManifestError";
    }
}
/**
 * Attaches the causal context where a framework error was born (ADR-04). The
 * innermost boundary wins: a context already attached is kept. Errors raised
 * by application code are left untouched — their context is in the trace.
 */
function attachContext(error, context) {
    if (!(error instanceof BonsaiError) || error.context !== undefined)
        return;
    Object.defineProperty(error, "context", { value: context, enumerable: true, writable: false, configurable: false });
}

/**
 * Execution kernel — capture of transmitted values (G2, C.5, A3.d).
 *
 * A value is captured when it is submitted to the transport: a detached deep
 * copy, then deeply frozen. Neither the author nor any recipient keeps a
 * mutable alias on the transmitted value.
 *
 * The copier is the kernel's own, identical on every host (some test hosts,
 * such as jsdom, lack `structuredClone`). It accepts data only: primitives,
 * arrays, plain objects, `Date`, `Map`, `Set`. Anything else — a function, a
 * host element, an instance of a class — would carry a reference and is
 * refused (A3.d).
 */
function refuse(what) {
    throw new TransportError("NOT_CAPTURABLE", `value cannot be captured by copy: ${what} (A3.d)`);
}
function copy(value, seen) {
    if (value === null || value === undefined)
        return value;
    switch (typeof value) {
        case "string":
        case "number":
        case "boolean":
        case "bigint":
            return value;
        case "function":
            return refuse("function");
        case "symbol":
            return refuse("symbol");
    }
    const source = value;
    if (seen.has(source))
        return seen.get(source);
    if (Array.isArray(source)) {
        const target = [];
        seen.set(source, target);
        for (const item of source)
            target.push(copy(item, seen));
        return Object.freeze(target);
    }
    if (source instanceof Date)
        return Object.freeze(new Date(source.getTime()));
    if (source instanceof Map) {
        const target = new Map();
        seen.set(source, target);
        for (const [k, v] of source)
            target.set(copy(k, seen), copy(v, seen));
        return Object.freeze(target);
    }
    if (source instanceof Set) {
        const target = new Set();
        seen.set(source, target);
        for (const v of source)
            target.add(copy(v, seen));
        return Object.freeze(target);
    }
    const prototype = Object.getPrototypeOf(source);
    if (prototype !== Object.prototype && prototype !== null) {
        return refuse(`instance of ${source.constructor?.name ?? "a class"}`);
    }
    const target = {};
    seen.set(source, target);
    for (const key of Object.keys(source))
        target[key] = copy(source[key], seen);
    return Object.freeze(target);
}
function capture(value) {
    return copy(value, new Map());
}

/**
 * Execution kernel (migration lots M1–M6) — one Root per model.
 *
 * Realises the guarantees of the communication infrastructure
 * (docs/theorie.md §13 and annex C):
 *
 * - G1  delivery to the Channel owner, to subscription owners, to the author
 *       of a local message; responses to the author only.
 * - G2  values captured by copy at submission, responses at return (C.5).
 * - G3  no delivery to a destroyed Channel, subscription or component;
 *       reservations bound to a determined subscription (C.2, C.6).
 * - G5  deferred messages delivered only after the producing unit validates;
 *       Queries synchronous, refused towards a target not ready or active.
 * - G6  one registry per Root: no message crosses roots.
 * - G7  a failing unit restores what it journaled, drops its creations,
 *       destructions and deferred messages; Query errors poison the unit.
 * - G8  causal contexts created and propagated by the kernel only.
 * - D8  production order; subscription order; rank fixed at emission.
 * - D9  causal depth checked before any submission.
 * - C.3 effects prepared during the unit, engaged in order after it
 *       validates; a synchronous failure closes the resource the effect
 *       aims at (and, for a part, the parts below it), the rest goes on.
 *
 * Later lots added the Entity journal and invariants (M2), structural parts
 * and the host document (M3–M4), closed-world qualification of host sources
 * and D18 (M5).
 */
var _Root_instances, _Root_id, _Root_bound, _Root_longMs, _Root_now, _Root_document, _Root_onTrace, _Root_rights, _Root_simulating, _Root_registry, _Root_subscriptions, _Root_components, _Root_resources, _Root_queue, _Root_active, _Root_trace, _Root_counter, _Root_unit, _Root_draining, _Root_state, _Root_record, _Root_runUnit, _Root_checkInvariants, _Root_engage, _Root_drain, _Root_measure, _Root_deliver, _Root_abandon, _Root_unitContext, _Root_readContext, _Root_query, _Root_create, _Root_destroy, _Root_capture, _Root_origin, _Root_child, _Root_nextId, _Root_push;
Immer.enablePatches();
let rootCounter = 0;
// ── Root ─────────────────────────────────────────────────────────────────────
class Root {
    constructor(options) {
        _Root_instances.add(this);
        _Root_id.set(this, void 0);
        _Root_bound.set(this, void 0);
        _Root_longMs.set(this, void 0);
        _Root_now.set(this, void 0);
        _Root_document.set(this, void 0);
        _Root_onTrace.set(this, void 0);
        /** D18: right to command, by message context (the trigger of a treatment). */
        _Root_rights.set(this, new Map());
        /** C.4: instrumented simulation in progress, if any. */
        _Root_simulating.set(this, null);
        _Root_registry.set(this, new Map());
        _Root_subscriptions.set(this, []);
        _Root_components.set(this, new Map());
        _Root_resources.set(this, new Map());
        _Root_queue.set(this, []);
        _Root_active.set(this, []);
        _Root_trace.set(this, []);
        _Root_counter.set(this, 0);
        _Root_unit.set(this, null);
        _Root_draining.set(this, false);
        _Root_state.set(this, "created");
        _Root_record.set(this, void 0);
        __classPrivateFieldSet(this, _Root_id, `r${++rootCounter}`, "f");
        __classPrivateFieldSet(this, _Root_bound, options.causalBound, "f");
        __classPrivateFieldSet(this, _Root_longMs, options.longUnitMs ?? 50, "f");
        __classPrivateFieldSet(this, _Root_now, options.now ?? (() => performance.now()), "f");
        __classPrivateFieldSet(this, _Root_document, options.document ?? null, "f");
        __classPrivateFieldSet(this, _Root_onTrace, options.onTrace, "f");
        // The root's existence is provided by the host, not admitted (A0.d, 7.4).
        __classPrivateFieldSet(this, _Root_record, {
            handle: Object.freeze({ occurrence: __classPrivateFieldGet(this, _Root_instances, "m", _Root_nextId).call(this, "c"), name: "root" }),
            spec: { name: "root" },
            parent: null,
            children: [],
            status: "ready",
            channel: null,
            subscriptions: [],
            entity: null,
            resources: [],
            params: undefined,
            designation: null
        }, "f");
    }
    /** Technical trace, outside the application transport. */
    get trace() {
        return __classPrivateFieldGet(this, _Root_trace, "f");
    }
    /**
     * Startup: an exceptional validation unit whose cause is an origin (§2.5).
     * Deferred messages and admissions wait for its success; its failure
     * abandons the model under construction (C.1).
     */
    start(init) {
        if (__classPrivateFieldGet(this, _Root_state, "f") !== "created") {
            throw new TransportError("ROOT_ABANDONED", `root cannot start from state "${__classPrivateFieldGet(this, _Root_state, "f")}"`);
        }
        __classPrivateFieldSet(this, _Root_state, "starting", "f");
        const cause = __classPrivateFieldGet(this, _Root_instances, "m", _Root_origin).call(this, "startup");
        const error = __classPrivateFieldGet(this, _Root_instances, "m", _Root_runUnit).call(this, __classPrivateFieldGet(this, _Root_record, "f"), cause, (ctx) => init(ctx));
        if (error !== null) {
            __classPrivateFieldSet(this, _Root_state, "abandoned", "f");
            __classPrivateFieldGet(this, _Root_registry, "f").clear();
            __classPrivateFieldGet(this, _Root_subscriptions, "f").length = 0;
            __classPrivateFieldGet(this, _Root_queue, "f").length = 0;
            throw new StartupError(error.error);
        }
        __classPrivateFieldSet(this, _Root_state, "started", "f");
        __classPrivateFieldGet(this, _Root_instances, "m", _Root_drain).call(this);
    }
    /**
     * Starts from a Manifest (16.9, D14): the root creates its declared children
     * in an order that respects their initial Query dependencies; among children
     * without remaining dependency, declaration order decides; a cycle or an
     * unknown dependency is refused before startup (C.1).
     */
    startFromManifest(entries) {
        const byNamespace = new Map();
        for (const entry of entries) {
            if (entry.channel !== undefined)
                byNamespace.set(entry.channel.namespace, entry);
        }
        for (const entry of entries) {
            for (const dependency of entry.dependsOn ?? []) {
                if (!byNamespace.has(dependency))
                    throw new ManifestError("UNKNOWN_DEPENDENCY", `${entry.name} depends on unknown namespace "${dependency}" (C.1)`);
            }
        }
        const ordered = [];
        const placed = new Set();
        while (ordered.length < entries.length) {
            const next = entries.find((entry) => !placed.has(entry) && (entry.dependsOn ?? []).every((d) => placed.has(byNamespace.get(d))));
            if (next === undefined) {
                const blocked = entries.filter((entry) => !placed.has(entry)).map((entry) => entry.name);
                throw new ManifestError("CYCLIC_DEPENDENCIES", `cyclic initial dependencies between ${blocked.join(", ")} (C.1)`);
            }
            ordered.push(next);
            placed.add(next);
        }
        this.start((ctx) => {
            for (const entry of ordered)
                ctx.create(entry);
        });
    }
    /**
     * Admission of an occurrence of the host or of an external system (A5.c).
     * The preamble mutates nothing: it checks the occurrence of life, qualifies
     * the context (C.4), captures the payload and queues a local message.
     */
    admit(target, local, payload, admission) {
        if (__classPrivateFieldGet(this, _Root_state, "f") === "abandoned") {
            __classPrivateFieldGet(this, _Root_instances, "m", _Root_push).call(this, { type: "admission-abandoned", reason: "root abandoned", name: local });
            return;
        }
        const record = __classPrivateFieldGet(this, _Root_components, "f").get(target.occurrence);
        if (record === undefined || record.status === "destroyed") {
            __classPrivateFieldGet(this, _Root_instances, "m", _Root_push).call(this, { type: "admission-abandoned", reason: "occurrence no longer alive", name: local });
            return;
        }
        if (record.spec.locals?.[local] === undefined) {
            throw new TransportError("UNDECLARED_MESSAGE", `local "${local}" not declared by ${record.handle.name}`);
        }
        let context;
        if (admission.kind === "correlated") {
            if (admission.token.occurrence !== record.handle.occurrence) {
                __classPrivateFieldGet(this, _Root_instances, "m", _Root_push).call(this, { type: "admission-abandoned", reason: "result routed to another occurrence", name: local });
                return;
            }
            const child = __classPrivateFieldGet(this, _Root_instances, "m", _Root_child).call(this, admission.token.context);
            if (child.depth > __classPrivateFieldGet(this, _Root_bound, "f")) {
                // Refused at the preamble: no treatment starts, nothing is revoked (D9).
                __classPrivateFieldGet(this, _Root_instances, "m", _Root_push).call(this, { type: "admission-abandoned", reason: "causal bound", name: local });
                return;
            }
            context = child;
            // A correlated result continues the reaction that armed it, with its right (D18).
            __classPrivateFieldGet(this, _Root_rights, "f").set(context.id, __classPrivateFieldGet(this, _Root_rights, "f").get(admission.token.context.id) ?? false);
        }
        else {
            context = __classPrivateFieldGet(this, _Root_instances, "m", _Root_origin).call(this, admission.kind === "independent" ? "spontaneous" : "unknown");
            // Only an established independent fact grants the right to command (D18, C.4).
            __classPrivateFieldGet(this, _Root_rights, "f").set(context.id, admission.kind === "independent");
        }
        __classPrivateFieldGet(this, _Root_queue, "f").push({ kind: "local", target: record, name: local, payload: capture(payload), context });
        __classPrivateFieldGet(this, _Root_instances, "m", _Root_drain).call(this);
    }
}
_Root_id = new WeakMap(), _Root_bound = new WeakMap(), _Root_longMs = new WeakMap(), _Root_now = new WeakMap(), _Root_document = new WeakMap(), _Root_onTrace = new WeakMap(), _Root_rights = new WeakMap(), _Root_simulating = new WeakMap(), _Root_registry = new WeakMap(), _Root_subscriptions = new WeakMap(), _Root_components = new WeakMap(), _Root_resources = new WeakMap(), _Root_queue = new WeakMap(), _Root_active = new WeakMap(), _Root_trace = new WeakMap(), _Root_counter = new WeakMap(), _Root_unit = new WeakMap(), _Root_draining = new WeakMap(), _Root_state = new WeakMap(), _Root_record = new WeakMap(), _Root_instances = new WeakSet(), _Root_runUnit = function _Root_runUnit(owner, cause, body, right = false) {
    const startedAt = __classPrivateFieldGet(this, _Root_now, "f").call(this);
    const unit = { open: true, staged: [], undo: [], effects: [], touched: new Set(), restitutions: [], right, poisoned: null };
    __classPrivateFieldSet(this, _Root_unit, unit, "f");
    __classPrivateFieldGet(this, _Root_active, "f").push(owner);
    let failure = null;
    try {
        body(__classPrivateFieldGet(this, _Root_instances, "m", _Root_unitContext).call(this, owner, cause, unit));
    }
    catch (error) {
        failure = { error };
    }
    finally {
        __classPrivateFieldGet(this, _Root_active, "f").pop();
        unit.open = false;
        __classPrivateFieldSet(this, _Root_unit, null, "f");
    }
    // A Query error or a refused submission cannot be recovered locally (G7).
    if (failure === null && unit.poisoned !== null) {
        // The author intercepted a Query failure: the unit fails anyway (G7).
        failure = {
            error: new TransportError("UNRECOVERABLE", "Query refusée ou en échec : l'unité est annulée et ne peut pas reprendre localement (G7)", unit.poisoned.error)
        };
    }
    if (failure === null)
        failure = __classPrivateFieldGet(this, _Root_instances, "m", _Root_checkInvariants).call(this, unit);
    if (failure !== null) {
        attachContext(failure.error, cause);
        // An intercepted refusal reported by UNRECOVERABLE is also dated (ADR-04).
        if (unit.poisoned !== null)
            attachContext(unit.poisoned.error, cause);
        for (let i = unit.undo.length - 1; i >= 0; i--) {
            try {
                unit.undo[i]();
            }
            catch {
                // Undo must not throw; a failing undo is a kernel defect.
            }
        }
        __classPrivateFieldGet(this, _Root_instances, "m", _Root_push).call(this, { type: "unit-failed", owner: owner.handle.name, context: cause, error: failure.error });
        __classPrivateFieldGet(this, _Root_instances, "m", _Root_measure).call(this, "long-unit", startedAt, { owner: owner.handle.name, context: cause });
        return failure;
    }
    for (const entry of unit.restitutions)
        __classPrivateFieldGet(this, _Root_instances, "m", _Root_push).call(this, entry);
    __classPrivateFieldGet(this, _Root_queue, "f").push(...unit.staged);
    __classPrivateFieldGet(this, _Root_instances, "m", _Root_engage).call(this, unit.effects);
    __classPrivateFieldGet(this, _Root_instances, "m", _Root_measure).call(this, "long-unit", startedAt, { owner: owner.handle.name, context: cause });
    return null;
}, _Root_checkInvariants = function _Root_checkInvariants(unit) {
    for (const record of unit.touched) {
        if (record.status === "destroyed" || record.entity === null)
            continue;
        for (const invariant of record.entity.def.invariants ?? []) {
            let satisfied;
            try {
                satisfied = invariant.check(record.entity.state);
            }
            catch (error) {
                return { error };
            }
            if (!satisfied)
                return { error: new InvariantError(record.entity.def.name, invariant.name) };
        }
    }
    return null;
}, _Root_engage = function _Root_engage(effects) {
    if (effects.length === 0)
        return;
    const lines = [];
    // Closed resources, each with the index of the failed line that closed it.
    const closedParts = new Map();
    const closedKeys = new Map();
    const closedBy = (target) => {
        if ("part" in target) {
            for (let part = target.part; part !== null; part = part.container?.resource ?? null) {
                const index = closedParts.get(part);
                if (index !== undefined)
                    return index;
            }
            return undefined;
        }
        return closedKeys.get(target.owner)?.get(target.key);
    };
    const close = (target, index) => {
        if ("part" in target) {
            closedParts.set(target.part, index);
            return;
        }
        const keys = closedKeys.get(target.owner) ?? new Map();
        keys.set(target.key, index);
        closedKeys.set(target.owner, keys);
    };
    for (const effect of effects) {
        const by = closedBy(effect.target);
        if (by !== undefined) {
            lines.push({ effect, outcome: "not-attempted", closedBy: by });
            continue;
        }
        try {
            effect.run();
            lines.push({ effect, outcome: "engaged" });
        }
        catch (error) {
            close(effect.target, lines.length);
            lines.push({ effect, outcome: "failed", error });
        }
    }
    // The engagement report is admitted to each living owner that declares it, as a
    // correlated result carrying its own lines only (C.3); the trace keeps the whole list.
    const owners = [...new Set(lines.map((line) => line.effect.owner))];
    const admitted = new Set();
    const abandoned = [];
    for (const owner of owners) {
        if (owner.status === "destroyed" || owner.spec.locals?.["$effects"] === undefined)
            continue;
        const own = lines.filter((line) => line.effect.owner === owner);
        const child = __classPrivateFieldGet(this, _Root_instances, "m", _Root_child).call(this, own[0].effect.context);
        if (child.depth > __classPrivateFieldGet(this, _Root_bound, "f")) {
            abandoned.push({ type: "admission-abandoned", reason: "causal bound", name: "$effects" });
            continue;
        }
        admitted.add(owner);
        __classPrivateFieldGet(this, _Root_queue, "f").push({ kind: "local", target: owner, name: "$effects", payload: capture(own.map(({ effect, outcome }) => ({ label: effect.label, outcome }))), context: child });
    }
    __classPrivateFieldGet(this, _Root_instances, "m", _Root_push).call(this, {
        type: "effects",
        report: lines.map(({ effect, outcome, error, closedBy: by }) => ({
            owner: effect.owner.handle.name,
            label: effect.label,
            outcome,
            ...(outcome === "failed" ? { error } : {}),
            ...(by === undefined ? {} : { closedBy: by }),
            context: effect.context,
            admitted: admitted.has(effect.owner)
        }))
    });
    for (const entry of abandoned)
        __classPrivateFieldGet(this, _Root_instances, "m", _Root_push).call(this, entry);
}, _Root_drain = function _Root_drain() {
    if (__classPrivateFieldGet(this, _Root_draining, "f") || __classPrivateFieldGet(this, _Root_unit, "f") !== null || __classPrivateFieldGet(this, _Root_state, "f") !== "started")
        return;
    __classPrivateFieldSet(this, _Root_draining, true, "f");
    // ADR-35: the queue is drained in one go, without yielding to the host.
    const startedAt = __classPrivateFieldGet(this, _Root_now, "f").call(this);
    const context = __classPrivateFieldGet(this, _Root_queue, "f")[0]?.context;
    let units = 0;
    try {
        while (__classPrivateFieldGet(this, _Root_queue, "f").length > 0) {
            const delivery = __classPrivateFieldGet(this, _Root_queue, "f").shift();
            __classPrivateFieldGet(this, _Root_instances, "m", _Root_deliver).call(this, delivery);
            units++;
        }
    }
    finally {
        __classPrivateFieldSet(this, _Root_draining, false, "f");
        if (context !== undefined)
            __classPrivateFieldGet(this, _Root_instances, "m", _Root_measure).call(this, "long-drain", startedAt, { units, context });
    }
}, _Root_measure = function _Root_measure(type, startedAt, data) {
    const durationMs = __classPrivateFieldGet(this, _Root_now, "f").call(this) - startedAt;
    if (durationMs <= __classPrivateFieldGet(this, _Root_longMs, "f"))
        return;
    if (type === "long-unit") {
        __classPrivateFieldGet(this, _Root_instances, "m", _Root_push).call(this, { type, owner: data.owner, context: data.context, durationMs });
    }
    else {
        __classPrivateFieldGet(this, _Root_instances, "m", _Root_push).call(this, { type, units: data.units, context: data.context, durationMs });
    }
}, _Root_deliver = function _Root_deliver(delivery) {
    let owner;
    let handler;
    switch (delivery.kind) {
        case "command":
            if (!delivery.channel.alive)
                return __classPrivateFieldGet(this, _Root_instances, "m", _Root_abandon).call(this, "channel destroyed", delivery);
            owner = delivery.channel.owner;
            handler = owner.spec.channel?.commands?.[delivery.name];
            break;
        case "event":
            if (!delivery.subscription.alive)
                return __classPrivateFieldGet(this, _Root_instances, "m", _Root_abandon).call(this, "subscription destroyed", delivery);
            owner = delivery.subscription.owner;
            handler = delivery.subscription.handler;
            break;
        case "local":
            owner = delivery.target;
            handler = owner.spec.locals?.[delivery.name];
            break;
    }
    if (owner.status === "destroyed")
        return __classPrivateFieldGet(this, _Root_instances, "m", _Root_abandon).call(this, "recipient destroyed", delivery);
    if (handler === undefined)
        return __classPrivateFieldGet(this, _Root_instances, "m", _Root_abandon).call(this, "no declared handler", delivery);
    __classPrivateFieldGet(this, _Root_instances, "m", _Root_push).call(this, { type: "delivered", kind: delivery.kind, to: owner.handle.name, name: delivery.name, context: delivery.context });
    const run = handler;
    // D18: an Event never grants the right; a Command or a local message carries its producer's.
    if (delivery.kind === "event")
        __classPrivateFieldGet(this, _Root_rights, "f").set(delivery.context.id, false);
    const right = __classPrivateFieldGet(this, _Root_rights, "f").get(delivery.context.id) ?? false;
    __classPrivateFieldGet(this, _Root_instances, "m", _Root_runUnit).call(this, owner, delivery.context, (ctx) => run(delivery.payload, ctx), right);
}, _Root_abandon = function _Root_abandon(reason, delivery) {
    __classPrivateFieldGet(this, _Root_instances, "m", _Root_push).call(this, { type: "delivery-abandoned", reason, name: delivery.name, context: delivery.context });
}, _Root_unitContext = function _Root_unitContext(self, cause, unit) {
    const guard = () => {
        if (__classPrivateFieldGet(this, _Root_unit, "f") !== unit || !unit.open) {
            throw new TransportError("NO_UNIT", "context used outside its validation unit (A5.a)");
        }
    };
    const fail = (error) => {
        unit.poisoned = unit.poisoned ?? { error };
        throw error;
    };
    const submit = () => {
        const child = __classPrivateFieldGet(this, _Root_instances, "m", _Root_child).call(this, cause);
        if (child.depth > __classPrivateFieldGet(this, _Root_bound, "f")) {
            fail(new TransportError("CAUSAL_BOUND", `depth ${child.depth} exceeds bound ${__classPrivateFieldGet(this, _Root_bound, "f")}`));
        }
        __classPrivateFieldGet(this, _Root_rights, "f").set(child.id, unit.right);
        return child;
    };
    return {
        self: self.handle,
        cause,
        query: (namespace, name, params) => {
            guard();
            return __classPrivateFieldGet(this, _Root_instances, "m", _Root_query).call(this, namespace, name, params, cause, unit);
        },
        trigger: (namespace, command, payload) => {
            guard();
            const channel = __classPrivateFieldGet(this, _Root_registry, "f").get(namespace);
            if (channel === undefined || !channel.alive)
                fail(new TransportError("UNKNOWN_TARGET", `no Channel "${namespace}" in this root`));
            if (channel.owner.spec.channel?.commands?.[command] === undefined)
                fail(new TransportError("UNDECLARED_MESSAGE", `command "${namespace}:${command}" not declared`));
            // A4.b: only a component of the user interface addresses a Command to an adapter of the interface.
            if (channel.owner.spec.ui === true && self.spec.ui !== true) {
                fail(new TransportError("NOT_AUTHORIZED", `${self.handle.name} is not a component of the user interface: it may not address "${namespace}:${command}" (A4.b)`));
            }
            if (self.spec.ui === true && !unit.right) {
                fail(new TransportError("NOT_AUTHORIZED", `${self.handle.name} may not command: the trigger of this reaction grants no right (D18)`));
            }
            const context = submit();
            unit.staged.push({ kind: "command", channel: channel, name: command, payload: __classPrivateFieldGet(this, _Root_instances, "m", _Root_capture).call(this, payload, unit), context });
        },
        emit: (event, payload) => {
            guard();
            const channel = self.channel;
            if (channel === null || !channel.alive)
                fail(new TransportError("NOT_OWNER", `${self.handle.name} owns no Channel to emit on (A3.e)`));
            if (!(self.spec.channel?.events ?? []).includes(event))
                fail(new TransportError("UNDECLARED_MESSAGE", `event "${event}" not declared by ${self.handle.name}`));
            const context = submit();
            const value = __classPrivateFieldGet(this, _Root_instances, "m", _Root_capture).call(this, payload, unit);
            // D8 / C.6: reservations fixed now, on the subscriptions present now.
            for (const subscription of __classPrivateFieldGet(this, _Root_subscriptions, "f")) {
                if (subscription.alive && subscription.namespace === channel.namespace && subscription.event === event) {
                    unit.staged.push({ kind: "event", subscription, name: event, payload: value, context });
                }
            }
        },
        local: (name, payload) => {
            guard();
            if (self.spec.locals?.[name] === undefined)
                fail(new TransportError("UNDECLARED_MESSAGE", `local "${name}" not declared`));
            const context = submit();
            unit.staged.push({ kind: "local", target: self, name, payload: __classPrivateFieldGet(this, _Root_instances, "m", _Root_capture).call(this, payload, unit), context });
        },
        create: (spec, options) => {
            guard();
            return __classPrivateFieldGet(this, _Root_instances, "m", _Root_create).call(this, self, spec, cause, unit, options);
        },
        params: () => self.params,
        designation: () => self.designation,
        admitDistributable: (label) => {
            guard();
            let element = null;
            if (__classPrivateFieldGet(this, _Root_document, "f") !== null) {
                element = __classPrivateFieldGet(this, _Root_document, "f").querySelector(label);
                if (element === null)
                    fail(new TransportError("HOST_NOT_FOUND", `no host element matches "${label}" (D3)`));
            }
            const resource = { handle: Object.freeze({ id: __classPrivateFieldGet(this, _Root_instances, "m", _Root_nextId).call(this, "res"), label }), owner: self, container: null, portions: new Map(), alive: true, element };
            __classPrivateFieldGet(this, _Root_resources, "f").set(resource.handle.id, resource);
            self.resources.push(resource);
            unit.undo.push(() => {
                resource.alive = false;
                __classPrivateFieldGet(this, _Root_resources, "f").delete(resource.handle.id);
                self.resources.splice(self.resources.indexOf(resource), 1);
            });
            return resource.handle;
        },
        resolve: (designation) => {
            guard();
            const part = __classPrivateFieldGet(this, _Root_resources, "f").get(designation.attribution);
            const valid = part !== undefined && part.alive && part.owner === self && part.container !== null
                && part.container.resource.handle.id === designation.resource && part.container.portion === designation.portion
                && part.container.resource.portions.get(designation.portion) === part;
            if (!valid)
                fail(new TransportError("INVALID_DESIGNATION", `designation of portion "${designation.portion}" does not resolve to a living part owned by ${self.handle.name} (8.5, 9.10)`));
            return part.handle;
        },
        project: (resource, label, write) => {
            guard();
            const record = __classPrivateFieldGet(this, _Root_resources, "f").get(resource.id);
            if (record === undefined || !record.alive || record.owner !== self)
                fail(new TransportError("NOT_OWNER", `${self.handle.name} does not own resource ${resource.label} (A1.b)`));
            unit.effects.push({
                owner: self,
                label,
                context: cause,
                target: { part: record },
                run: () => {
                    if (!record.alive)
                        return;
                    if (record.element === null)
                        throw new BonsaiError("NOT_MATERIALIZED", `${record.handle.label} is not materialized (9.10)`);
                    write(record.element);
                }
            });
        },
        simulate: (resource, type) => {
            guard();
            const record = __classPrivateFieldGet(this, _Root_resources, "f").get(resource.id);
            if (record === undefined || !record.alive || record.owner !== self)
                fail(new TransportError("NOT_OWNER", `${self.handle.name} does not own resource ${resource.label} (A1.b)`));
            __classPrivateFieldGet(this, _Root_rights, "f").set(cause.id, unit.right);
            const token = Object.freeze({ kind: "correlation", occurrence: self.handle.occurrence, context: cause });
            unit.effects.push({
                owner: self,
                label: `simulate ${type}`,
                context: cause,
                target: { part: record },
                run: () => {
                    const element = record.element;
                    if (element === null)
                        throw new BonsaiError("NOT_MATERIALIZED", `${record.handle.label} is not materialized (9.10)`);
                    __classPrivateFieldSet(this, _Root_simulating, { element, type, token }, "f");
                    try {
                        // dispatchEvent, not element.click(): the drain may run inside the host's own dispatch of a
                        // click on this element, and the host ignores a nested click() while one is in progress.
                        const view = element.ownerDocument.defaultView;
                        const event = type === "click" ? new view.MouseEvent(type, { bubbles: true }) : new view.Event(type, { bubbles: true });
                        element.dispatchEvent(event);
                    }
                    finally {
                        __classPrivateFieldSet(this, _Root_simulating, null, "f");
                    }
                }
            });
        },
        attributed: (resource) => {
            const record = __classPrivateFieldGet(this, _Root_resources, "f").get(resource.id);
            if (record === undefined || !record.alive || record.owner !== self)
                fail(new TransportError("NOT_OWNER", `${self.handle.name} does not own resource ${resource.label}`));
            return [...record.portions.keys()];
        },
        destroy: (child) => {
            guard();
            const record = __classPrivateFieldGet(this, _Root_components, "f").get(child.occurrence);
            if (record === undefined || record.parent !== self)
                fail(new TransportError("NOT_OWNER", `${self.handle.name} is not the parent of ${child.name} (A1.b, T1)`));
            __classPrivateFieldGet(this, _Root_instances, "m", _Root_destroy).call(this, record, unit, cause);
        },
        state: () => {
            if (self.entity === null)
                fail(new TransportError("NOT_OWNER", `${self.handle.name} owns no Entity`));
            return self.entity.state;
        },
        mutate: (recipe) => {
            guard();
            const entity = self.entity;
            if (entity === null)
                fail(new TransportError("NOT_OWNER", `${self.handle.name} owns no Entity (16.2)`));
            const previous = entity.state;
            const [next, patches, inversePatches] = Immer.produceWithPatches(previous, recipe);
            if (next === previous)
                return null;
            entity.state = next;
            // Immutable states: restoring the previous reference is an exact undo (G7).
            unit.undo.push(() => { entity.state = previous; });
            unit.touched.add(self);
            return { previous, next, patches, inversePatches };
        },
        journal: (undo) => {
            guard();
            unit.undo.push(undo);
        },
        mayCommand: () => {
            guard();
            return unit.right;
        },
        prepareEffect: (label, run, options) => {
            guard();
            unit.effects.push({ owner: self, label, run, context: cause, target: { owner: self, key: options?.target ?? "" } });
        },
        correlate: () => {
            guard();
            __classPrivateFieldGet(this, _Root_rights, "f").set(cause.id, unit.right);
            return Object.freeze({ kind: "correlation", occurrence: self.handle.occurrence, context: cause });
        }
    };
}, _Root_readContext = function _Root_readContext(self, cause, unit) {
    const forbidden = (operation) => () => {
        const error = new TransportError("READ_ONLY", `${operation} forbidden while answering a Query (A3.g)`);
        unit.poisoned = unit.poisoned ?? { error };
        throw error;
    };
    return {
        self: self.handle,
        cause,
        query: (namespace, name, params) => __classPrivateFieldGet(this, _Root_instances, "m", _Root_query).call(this, namespace, name, params, cause, unit),
        state: () => {
            if (self.entity === null)
                return forbidden("state without Entity")();
            return self.entity.state;
        },
        mutate: forbidden("mutate"),
        params: forbidden("params"),
        designation: forbidden("designation"),
        admitDistributable: forbidden("admitDistributable"),
        resolve: forbidden("resolve"),
        attributed: forbidden("attributed"),
        project: forbidden("project"),
        simulate: forbidden("simulate"),
        trigger: forbidden("trigger"),
        emit: forbidden("emit"),
        local: forbidden("local"),
        create: forbidden("create"),
        destroy: forbidden("destroy"),
        journal: forbidden("journal"),
        prepareEffect: forbidden("prepareEffect"),
        mayCommand: forbidden("mayCommand"),
        correlate: forbidden("correlate")
    };
}, _Root_query = function _Root_query(namespace, name, params, cause, unit) {
    const fail = (error) => {
        unit.poisoned = unit.poisoned ?? { error };
        throw error;
    };
    const channel = __classPrivateFieldGet(this, _Root_registry, "f").get(namespace);
    if (channel === undefined || !channel.alive)
        return fail(new TransportError("UNKNOWN_TARGET", `no Channel "${namespace}" in this root`));
    const target = channel.owner;
    const handler = target.spec.channel?.queries?.[name];
    if (handler === undefined)
        return fail(new TransportError("UNDECLARED_MESSAGE", `query "${namespace}:${name}" not declared`));
    if (target.status !== "ready")
        return fail(new TransportError("TARGET_NOT_READY", `${target.handle.name} is not ready (C.1)`));
    if (__classPrivateFieldGet(this, _Root_active, "f").includes(target))
        return fail(new TransportError("TARGET_ACTIVE", `${target.handle.name} has an execution in progress (G5)`));
    const context = __classPrivateFieldGet(this, _Root_instances, "m", _Root_child).call(this, cause);
    if (context.depth > __classPrivateFieldGet(this, _Root_bound, "f"))
        return fail(new TransportError("CAUSAL_BOUND", `depth ${context.depth} exceeds bound ${__classPrivateFieldGet(this, _Root_bound, "f")}`));
    const value = __classPrivateFieldGet(this, _Root_instances, "m", _Root_capture).call(this, params, unit);
    __classPrivateFieldGet(this, _Root_active, "f").push(target);
    try {
        const result = handler(value, __classPrivateFieldGet(this, _Root_instances, "m", _Root_readContext).call(this, target, context, unit));
        return __classPrivateFieldGet(this, _Root_instances, "m", _Root_capture).call(this, result, unit);
    }
    catch (error) {
        // Born while answering the Query: it carries the Query's context (ADR-04).
        attachContext(error, context);
        // Any Query failure interrupts the author's unit; no local recovery (G7).
        unit.poisoned = unit.poisoned ?? { error };
        throw error;
    }
    finally {
        __classPrivateFieldGet(this, _Root_active, "f").pop();
    }
}, _Root_create = function _Root_create(parent, spec, cause, unit, options = {}) {
    const record = {
        handle: Object.freeze({ occurrence: __classPrivateFieldGet(this, _Root_instances, "m", _Root_nextId).call(this, "c"), name: spec.name }),
        spec,
        parent,
        children: [],
        status: "initializing",
        channel: null,
        subscriptions: [],
        entity: null,
        resources: [],
        params: undefined,
        designation: null
    };
    if (spec.entity !== undefined) {
        // Initial state captured by copy and frozen; checked at the end of the unit (A4.a).
        record.entity = { def: spec.entity, state: capture(spec.entity.initial) };
        unit.touched.add(record);
    }
    if (spec.channel !== undefined) {
        const existing = __classPrivateFieldGet(this, _Root_registry, "f").get(spec.channel.namespace);
        if (existing !== undefined && existing.alive) {
            const error = new TransportError("DUPLICATE_NAMESPACE", `namespace "${spec.channel.namespace}" already used in this root`);
            unit.poisoned = unit.poisoned ?? { error };
            throw error;
        }
        // A4.b (reception): a Channel of the user interface is not received by a component of the domain,
        // including a subscription made before this Channel exists.
        if (spec.ui === true) {
            const foreign = __classPrivateFieldGet(this, _Root_subscriptions, "f").find((s) => s.alive && s.namespace === spec.channel.namespace && s.owner.spec.ui !== true);
            if (foreign !== undefined) {
                const error = new TransportError("NOT_AUTHORIZED", `${foreign.owner.handle.name} is not a component of the user interface: it may not receive "${spec.channel.namespace}:${foreign.event}" (A4.b)`);
                unit.poisoned = unit.poisoned ?? { error };
                throw error;
            }
        }
        record.channel = { namespace: spec.channel.namespace, owner: record, alive: true };
        __classPrivateFieldGet(this, _Root_registry, "f").set(spec.channel.namespace, record.channel);
    }
    // A4.b (reception): only a component of the user interface subscribes to a Channel of the interface.
    // Checked before any subscription is registered, so a refusal leaves nothing behind.
    for (const listen of spec.listens ?? []) {
        const target = __classPrivateFieldGet(this, _Root_registry, "f").get(listen.namespace);
        if (target !== undefined && target.alive && target.owner.spec.ui === true && spec.ui !== true) {
            const error = new TransportError("NOT_AUTHORIZED", `${spec.name} is not a component of the user interface: it may not receive "${listen.namespace}:${listen.event}" (A4.b)`);
            unit.poisoned = unit.poisoned ?? { error };
            throw error;
        }
    }
    for (const listen of spec.listens ?? []) {
        const subscription = { owner: record, namespace: listen.namespace, event: listen.event, handler: listen.handler, alive: true };
        record.subscriptions.push(subscription);
        __classPrivateFieldGet(this, _Root_subscriptions, "f").push(subscription);
    }
    record.params = __classPrivateFieldGet(this, _Root_instances, "m", _Root_capture).call(this, options.params, unit);
    if (options.part !== undefined) {
        // Attribution (6.5): only by the container's owner (A1.b), only to a child (A2.d), never overlapping (T7).
        const container = __classPrivateFieldGet(this, _Root_resources, "f").get(options.part.resource.id);
        const fail = (error) => { unit.poisoned = unit.poisoned ?? { error }; throw error; };
        if (container === undefined || !container.alive || container.owner !== parent)
            fail(new TransportError("NOT_OWNER", `${parent.handle.name} does not own resource ${options.part.resource.label} (A1.b)`));
        if (container.portions.has(options.part.portion))
            fail(new TransportError("PORTION_TAKEN", `portion "${options.part.portion}" of ${options.part.resource.label} is already attributed (T7)`));
        const part = {
            handle: Object.freeze({ id: __classPrivateFieldGet(this, _Root_instances, "m", _Root_nextId).call(this, "part"), label: `${container.handle.label}/${options.part.portion}` }),
            owner: record,
            container: { resource: container, portion: options.part.portion },
            portions: new Map(),
            alive: true,
            element: null
        };
        container.portions.set(options.part.portion, part);
        // Materialization of the part: an effect of the container's owner, engaged after validation (D12, C.3).
        if (__classPrivateFieldGet(this, _Root_document, "f") !== null) {
            const document = __classPrivateFieldGet(this, _Root_document, "f");
            const portion = options.part.portion;
            unit.effects.push({
                owner: parent,
                label: `materialize ${part.handle.label}`,
                context: cause,
                target: { part },
                run: () => {
                    if (!part.alive)
                        return;
                    const host = container.element;
                    if (host === null)
                        throw new BonsaiError("NOT_MATERIALIZED", `${container.handle.label} is not materialized (9.10)`);
                    let element;
                    if (options.part.host !== undefined) {
                        // A declared slot: exactly one existing element of the container (Foundation §3).
                        const matches = host.querySelectorAll(options.part.host);
                        if (matches.length !== 1)
                            throw new BonsaiError("SLOT_NOT_UNIQUE", `slot "${options.part.host}" matches ${matches.length} elements of ${container.handle.label}, expected exactly one`);
                        element = matches[0];
                        element.setAttribute("data-bonsai-part", portion);
                    }
                    else {
                        element = document.createElement("div");
                        element.setAttribute("data-bonsai-part", portion);
                        // Order is explicit: before the part named by `before`, otherwise at the end (Composer §1.3).
                        const before = options.part.before === undefined ? null : container.portions.get(options.part.before)?.element ?? null;
                        host.insertBefore(element, before !== null && before.parentNode === host ? before : null);
                    }
                    part.element = element;
                    // Host sources of the part (D10, B.4): registered by Bonsai, admitted by the part's owner only.
                    for (const [type, admission] of Object.entries(record.spec.dom ?? {})) {
                        const local = typeof admission === "string" ? admission : admission.local;
                        const keys = typeof admission === "string" ? undefined : admission.keys;
                        const cancelDefault = typeof admission === "string" ? undefined : admission.cancelDefault;
                        element.addEventListener(type, (event) => {
                            const target = event.target;
                            if (target === null || target.closest("[data-bonsai-part]") !== element)
                                return; // innermost part only (A5.d)
                            let ui = target.getAttribute("data-ui");
                            if (keys !== undefined) {
                                ui = null;
                                for (const [key, selector] of Object.entries(keys)) {
                                    const hit = target.closest(selector);
                                    if (hit !== null && element.contains(hit)) {
                                        ui = key;
                                        break;
                                    }
                                }
                            }
                            // D20: cancelled at capture by declaration, never by the treatment, whatever its outcome.
                            if (ui !== null && cancelDefault?.includes(ui) === true)
                                event.preventDefault();
                            const pending = __classPrivateFieldGet(this, _Root_simulating, "f");
                            // Closed world (C.4): an occurrence no instrumented operation could have produced is independent.
                            const admission = pending !== null && pending.element === element && pending.type === type
                                ? { kind: "correlated", token: pending.token }
                                : { kind: "independent" };
                            this.admit(record.handle, local, { type, ui }, admission);
                        });
                    }
                }
            });
        }
        __classPrivateFieldGet(this, _Root_resources, "f").set(part.handle.id, part);
        record.resources.push(part);
        record.designation = Object.freeze({ resource: container.handle.id, portion: options.part.portion, attribution: part.handle.id });
        unit.undo.push(() => {
            part.alive = false;
            if (container.portions.get(options.part.portion) === part)
                container.portions.delete(options.part.portion);
            __classPrivateFieldGet(this, _Root_resources, "f").delete(part.handle.id);
        });
    }
    parent.children.push(record);
    __classPrivateFieldGet(this, _Root_components, "f").set(record.handle.occurrence, record);
    unit.undo.push(() => {
        // An abandoned creation is never published (§2.5, C.7).
        record.status = "destroyed";
        if (record.channel !== null) {
            record.channel.alive = false;
            if (__classPrivateFieldGet(this, _Root_registry, "f").get(record.channel.namespace) === record.channel)
                __classPrivateFieldGet(this, _Root_registry, "f").delete(record.channel.namespace);
        }
        for (const subscription of record.subscriptions) {
            subscription.alive = false;
            const index = __classPrivateFieldGet(this, _Root_subscriptions, "f").indexOf(subscription);
            if (index >= 0)
                __classPrivateFieldGet(this, _Root_subscriptions, "f").splice(index, 1);
        }
        const index = parent.children.indexOf(record);
        if (index >= 0)
            parent.children.splice(index, 1);
        __classPrivateFieldGet(this, _Root_components, "f").delete(record.handle.occurrence);
    });
    if (spec.init !== undefined) {
        // The child's initialisation belongs to its creator's unit (§2.5).
        __classPrivateFieldGet(this, _Root_active, "f").push(record);
        try {
            spec.init(__classPrivateFieldGet(this, _Root_instances, "m", _Root_unitContext).call(this, record, cause, unit));
        }
        finally {
            __classPrivateFieldGet(this, _Root_active, "f").pop();
        }
    }
    record.status = "ready";
    return record.handle;
}, _Root_destroy = function _Root_destroy(record, unit, cause) {
    const order = [];
    const visit = (node) => {
        for (const child of node.children)
            visit(child);
        order.push(node);
    };
    visit(record);
    const parent = record.parent;
    const position = parent.children.indexOf(record);
    const saved = order.map((node) => ({
        node,
        status: node.status,
        channelAlive: node.channel?.alive ?? false,
        subscriptions: node.subscriptions.map((s) => ({ s, alive: s.alive, index: __classPrivateFieldGet(this, _Root_subscriptions, "f").indexOf(s) }))
    }));
    const snapshots = new Map();
    const ended = [];
    for (const node of order) {
        // Bottom-up: each restitution is imputed to the container's owner, still present here (§2.5, T3).
        for (const resource of node.resources) {
            if (resource.container !== null && resource.container.resource.portions.get(resource.container.portion) === resource) {
                const { resource: container, portion } = resource.container;
                if (!snapshots.has(container))
                    snapshots.set(container, [...container.portions.entries()]);
                container.portions.delete(portion);
                unit.restitutions.push({ type: "restitution", portion, container: container.handle.label, imputedTo: container.owner.handle.name, endedOwner: node.handle.name });
            }
            if (resource.alive) {
                resource.alive = false;
                ended.push(resource);
            }
        }
        node.status = "destroyed";
        if (node.channel !== null) {
            node.channel.alive = false;
            if (__classPrivateFieldGet(this, _Root_registry, "f").get(node.channel.namespace) === node.channel)
                __classPrivateFieldGet(this, _Root_registry, "f").delete(node.channel.namespace);
        }
        for (const subscription of node.subscriptions) {
            subscription.alive = false;
            const index = __classPrivateFieldGet(this, _Root_subscriptions, "f").indexOf(subscription);
            if (index >= 0)
                __classPrivateFieldGet(this, _Root_subscriptions, "f").splice(index, 1);
        }
    }
    parent.children.splice(position, 1);
    // Physical cleanup, post-validation (C.7): only parts whose container survives; nested elements go with them.
    const destroyed = new Set(order);
    for (const resource of ended) {
        if (resource.container === null || destroyed.has(resource.container.resource.owner))
            continue;
        unit.effects.push({
            owner: resource.container.resource.owner,
            label: `remove ${resource.handle.label}`,
            context: cause,
            target: { part: resource },
            run: () => { resource.element?.remove(); resource.element = null; }
        });
    }
    unit.undo.push(() => {
        // Cancellation keeps the same occurrences, Channels and reservations (C.2).
        parent.children.splice(position, 0, record);
        const restored = saved.flatMap((entry) => entry.subscriptions).filter((x) => x.index >= 0).sort((a, b) => a.index - b.index);
        for (const entry of saved) {
            entry.node.status = entry.status;
            if (entry.node.channel !== null) {
                entry.node.channel.alive = entry.channelAlive;
                if (entry.channelAlive)
                    __classPrivateFieldGet(this, _Root_registry, "f").set(entry.node.channel.namespace, entry.node.channel);
            }
        }
        for (const { s, alive, index } of restored) {
            s.alive = alive;
            __classPrivateFieldGet(this, _Root_subscriptions, "f").splice(index, 0, s);
        }
        // Same parts and designations as before: neither a new creation nor a transfer (C.7).
        for (const resource of ended)
            resource.alive = true;
        // Exact restoration, order of attribution included.
        for (const [container, entries] of snapshots) {
            container.portions.clear();
            for (const [portion, part] of entries)
                container.portions.set(portion, part);
        }
    });
}, _Root_capture = function _Root_capture(value, unit) {
    try {
        return capture(value);
    }
    catch (error) {
        unit.poisoned = unit.poisoned ?? { error };
        throw error;
    }
}, _Root_origin = function _Root_origin(kind) {
    const id = __classPrivateFieldGet(this, _Root_instances, "m", _Root_nextId).call(this, "m");
    return Object.freeze({ id, parentId: null, originId: id, originKind: kind, depth: 0 });
}, _Root_child = function _Root_child(parent) {
    return Object.freeze({
        id: __classPrivateFieldGet(this, _Root_instances, "m", _Root_nextId).call(this, "m"),
        parentId: parent.id,
        originId: parent.originId,
        originKind: parent.originKind,
        depth: parent.depth + 1
    });
}, _Root_nextId = function _Root_nextId(prefix) {
    var _a;
    return `${__classPrivateFieldGet(this, _Root_id, "f")}:${prefix}${__classPrivateFieldSet(this, _Root_counter, (_a = __classPrivateFieldGet(this, _Root_counter, "f"), ++_a), "f")}`;
}, _Root_push = function _Root_push(entry) {
    __classPrivateFieldGet(this, _Root_trace, "f").push(entry);
    if (__classPrivateFieldGet(this, _Root_onTrace, "f") === undefined)
        return;
    try {
        __classPrivateFieldGet(this, _Root_onTrace, "f").call(this, entry);
    }
    catch {
        // The sink is technical: its failure changes nothing in the model (O2).
    }
};

/**
 * Default technical sink of the trace (O2): reports on the console the failures
 * that no component receives. Outside the application transport, it admits
 * nothing.
 *
 * Reported:
 * - a failed unit after startup (a failed startup is thrown by `start()`);
 * - a failed effect whose owner does not receive it in an `$effects` result
 *   (C.3), with the effects it left not attempted;
 * - a message or an admission abandoned at the causal bound (D9).
 */
/** Name of the startup unit's owner: its failure is thrown, not reported. */
const STARTUP_OWNER = "root";
function reportToConsole(entry, output = console) {
    switch (entry.type) {
        case "unit-failed":
            if (entry.owner === STARTUP_OWNER)
                return;
            output.error(`[Bonsai] a treatment of "${entry.owner}" failed and was rolled back (G7)`, entry.error);
            return;
        case "effects":
            entry.report.forEach((line, index) => {
                if (line.outcome !== "failed" || line.admitted)
                    return;
                const skipped = entry.report
                    .filter((later) => later.closedBy === index)
                    .map((later) => `"${later.label}" (${later.owner})`);
                const suffix = skipped.length === 0 ? "" : `; not attempted because of it: ${skipped.join(", ")}`;
                output.warn(`[Bonsai] effect "${line.label}" of "${line.owner}" failed (C.3)${suffix}`, line.error);
            });
            return;
        case "delivery-abandoned":
        case "admission-abandoned":
            if (entry.reason !== "causal bound")
                return;
            output.warn(`[Bonsai] "${entry.name}" abandoned: causal bound reached (D9)`);
            return;
        default:
            return;
    }
}

/**
 * Describing a component to the kernel (migration lot M6.2).
 *
 * Feature, Foundation, Composer and View are classes written by developers;
 * the kernel works on component descriptions (`TComponentSpec`). Each class
 * knows how to describe itself through the shared `DESCRIBE` symbol, so that
 * the packages need not import one another at run time (a View declares
 * Composers, a Composer creates Views).
 */
/** Registered symbol: the same in every package that holds a copy of this module. */
const DESCRIBE = Symbol.for("bonsai.component.describe");
/**
 * @internal Framework use only.
 *
 * Builds the kernel description of a component instance.
 *
 * @throws when the instance is not a Bonsai component.
 */
function describeComponent(instance, options) {
    const describe = instance[DESCRIBE];
    if (typeof describe !== "function") {
        throw new BonsaiError("NOT_A_COMPONENT", `[Bonsai] ${instance.constructor.name} is not a Bonsai component and cannot be created by the framework`);
    }
    return describe.call(instance, options);
}

export { DESCRIBE, InvariantError, ManifestError, Root, StartupError, TransportError, capture, describeComponent, reportToConsole };
