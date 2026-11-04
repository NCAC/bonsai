/**
 * @bonsai/feature - Version 0.2.0
 * Bundled by Bonsai Build System
 * Date: 2026-11-04T20:50:15.290Z
 */
import { describeEntity, bindEntityState } from '@bonsai/entity';
import { BonsaiError, hardInvariant } from '@bonsai/error';

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
 * @bonsai/feature — Types & runtime helpers
 *
 * Implements:
 *   - ADR-08: authority, uniqueness and conformity of Feature namespaces.
 *   - ADR-14: modular consumer contract — Feature-grouped `TFeatureContract`
 *     + flattening helpers (`TFlatListens`, `TFlatTriggers`, `TFlatQueries`)
 *     + payload extractors (`TEventPayloadFor`, `TCommandPayloadFor`,
 *     `TQueryParamsFor`, `TQueryResultFor`) + `TChannelCallbacks`
 *     (required handlers derived from the contract).
 *
 * This module has three roles:
 *   1. Compile-time types (`CamelCaseNamespace<S>`, `StrictManifest<M>`,
 *      `ValidatedManifest<M>`) encoding invariants I68–I72.
 *   2. The framework constant `RESERVED_NAMESPACES` (I71) — not configurable
 *      by the application.
 *   3. A runtime safety net (`assertValidNamespace`, `BonsaiNamespaceError`)
 *      for when compile-time checks are bypassed (`as any` cast, plain JS,
 *      dynamic manifest).
 *
 * Invariants covered:
 *   I21          — unique, flat camelCase namespace; Application re-validates
 *                  format + reserved names at bootstrap
 *   I57          — `local` is reserved (ADR-17)
 *   I68          — the namespace is carried by the manifest, not by a `static`
 *   I69          — the manifest is the single source of truth for identity
 *   I70          — every reference to an external namespace MUST be validated
 *   I71          — `RESERVED_NAMESPACES` is a framework constant
 *   I72          — `TSelfNS` must match the manifest key
 *   I81 (ADR-14) — `get features()` is the runtime source of truth
 *   I82 (ADR-14) — `implements TViewCallbacks<TVC>` enforces the handlers
 *   I83 (ADR-14) — reusable modular `T{Component}Contract` pattern
 *   I87 (ADR-14) — object key ≡ namespace of the referenced Feature
 *   I88 (ADR-14) — Contract/Callbacks symmetry
 *
 * @packageDocumentation
 */
// ─── Reserved words (I71, ADR-17) ─────────────────────────────────────────
/**
 * Namespaces reserved by the framework — forbidden to application Features.
 *
 *   - `local`  : localState key in namespaced data (I57, ADR-17)
 *   - `router` : framework navigation Feature, instantiated by Application (I28, ADR-13)
 *
 * Non-configurable framework constant. Any future extension changes this
 * constant and propagates through the derived types (I71).
 */
const RESERVED_NAMESPACES = ["local", "router"];
/**
 * Manifest violation detected at runtime (phases 0a–0c, ADR-08).
 *
 * A `BonsaiError` (ADR-05): codes are stable and meant to be matched by consumers.
 */
class BonsaiNamespaceError extends BonsaiError {
    constructor(code, message) {
        super(code, message);
        this.name = "BonsaiNamespaceError";
    }
}
// ─── Runtime safety net ─────────────────────────────────────────────────────
const CAMEL_CASE_REGEX = /^[a-z][a-zA-Z]*$/;
// ─── Runtime safety net ─────────────────────────────────────────────────────
/** Runtime camelCase format check. */
function isCamelCaseNamespace(ns) {
    return CAMEL_CASE_REGEX.test(ns);
}
/** Runtime reserved-name check. */
function isReservedNamespace(ns) {
    return RESERVED_NAMESPACES.includes(ns);
}
/**
 * Safety net — checks format + reservation at runtime.
 *
 * Called by the `Feature` constructor (immutable from construction) and by
 * `Application.start()` (whole-manifest validation). Throws
 * `BonsaiNamespaceError` with a stable code.
 */
function assertValidNamespace(ns, options) {
    if (typeof ns !== "string" || ns.length === 0) {
        throw new BonsaiNamespaceError("NAMESPACE_INVALID_FORMAT", `Namespace must be a non-empty string, received: ${String(ns)}`);
    }
    if (!isCamelCaseNamespace(ns)) {
        throw new BonsaiNamespaceError("NAMESPACE_INVALID_FORMAT", `Namespace "${ns}" must be camelCase (lowercase first letter, letters only)`);
    }
    if (isReservedNamespace(ns) && options?.framework !== true) {
        throw new BonsaiNamespaceError("NAMESPACE_RESERVED", `Namespace "${ns}" is reserved by the framework`);
    }
}

/**
 * @bonsai/feature — Feature base class
 *
 * The 5 capabilities (ADR-01), realised on the kernel (migration lot M6.1):
 *   C1 — ctx.emit(event, payload) on its own Channel (typed by TChannelDef, ADR-14)
 *   C2 — handle(command) through auto-discovered on{Name}Command(payload, ctx) methods
 *   C3 — listen(event) on declared external Channels through on{Channel}{EventName}Event(payload, ctx)
 *   C4 — reply(query) through auto-discovered on{Name}Query(params, ctx) methods
 *   C5 — ctx.query(token, name, params) to declared Channels (typed by the token, ADR-14)
 *
 * Every handler receives a context as second argument: there is no `this.emit`,
 * `this.request` or `this.entity.mutate` any more. A handler runs inside a
 * validation unit of the kernel (G7): its mutations and emissions are
 * applied together or not at all. A Feature never addresses a Command (D17).
 *
 * Invariants:
 *   I1  — A Feature can only emit() on its own Channel, never on another Feature's
 *   I2  — A Feature can listen to Events of declared external Channels
 *   I3  — A Feature can only reply on its own Channel
 *   I6  — An Entity is only accessible to its owning Feature
 *   I21 — Every Feature MUST be registered in the application manifest under
 *         a unique, flat camelCase namespace key (ADR-08)
 *   I22 — namespace ↔ Feature ↔ Entity is a strict 1:1:1 relation
 *   I48 — Handlers are auto-discovered by naming convention
 *   I68 — The namespace is carried by the application manifest, not by a
 *         `static` on the Feature class (ADR-08)
 *   I72 — `TSelfNS` must match exactly the key the Feature is registered
 *         under in the manifest (ADR-08)
 *   I73 — Every concrete Feature MUST expose `static readonly channel:
 *         TChannelToken<TChannelDef, TSelfNS>` — the bridge between the class
 *         and its typed Channel (ADR-14)
 *   I74 — `TChannelDef` is co-located in the domain's `.feature.ts` file
 *         (no separate `.channel.ts`) (ADR-14)
 *   I75 — No `any`/`unknown` in the public surface of Channel/Feature/View;
 *         internal casts are documented and contained (ADR-14)
 *   I76 — The handler contexts (`emit`, `query`, `mutate`) are strictly
 *         typed by `TDef` — key = `keyof TDef[lane]`, never a free `string`
 *         (ADR-14)
 *   I79 — The Feature's `ctx.query` only accepts a typed `TChannelToken`;
 *         `abstract get listens()`/`abstract get queries()` carry these tokens
 *         as instance declarations (ADR-14, ADR-09 — I93)
 *   I93 — `listens` and `queries` are instance `abstract get` on Feature
 *         (ADR-09 — TS2515 when missing on a concrete class)
 *   I94 — The Feature constructor is inert: assertValidNamespace + #namespace
 *         only. No kernel/Entity side effect.
 *   I96 — Entity handlers `on<Key>EntityUpdated`/`onAnyEntityUpdated` are
 *         auto-discovered on the Feature (same mechanism as I48), dispatched
 *         in alphabetical order of `changedKeys`, then the catch-all. Unknown
 *         key → bootstrap error. The notification is a deferred local message
 *         the Feature sends to itself after the mutation (G5, D8): a throwing
 *         handler fails its own unit, never the one that mutated.
 *
 * @packageDocumentation
 */
var _Feature_instances, _a, _Feature_namespace, _Feature_entity, _Feature_methodNames, _Feature_run, _Feature_queryContext, _Feature_featureContext, _Feature_checkEntityHandlers, _Feature_dispatchEntityEvent;
// ─── Framework description of a Feature ──────────────────────────────────────
const DESCRIBE = Symbol("bonsai.feature.describe");
/** Name of the local message a Feature sends itself after a mutation (I96). */
const ENTITY_UPDATED = "entityUpdated";
/**
 * @internal Framework use only (`Application`).
 *
 * Builds the description the kernel needs to create the Feature as a child of
 * the root: its Channel, subscriptions, local message, Entity and initial
 * Query dependencies (D16, C.1). Creates the Entity (I22).
 */
function describeFeature(feature) {
    return feature[DESCRIBE]();
}
const lowerFirst = (s) => s[0].toLowerCase() + s.slice(1);
// ─── Feature abstract class ──────────────────────────────────────────────────
/**
 * Feature — business unit parameterised by its Entity class, its Channel
 * contract and its namespace.
 *
 * Type parameters:
 *   - `TEntity`     : the Entity class (ADR-09 — encodes I22 at type level)
 *   - `TChannelDef` : the contract of its own Channel — command, event and
 *                     request types (ADR-14 — I74, I76). Defaults to
 *                     `TChannelDefinition` (all lanes `Record<string, unknown>`)
 *                     for untyped use.
 *   - `TSelfNS`     : the namespace this Feature expects to be registered
 *                     under in the application manifest (ADR-08 — I72).
 *                     Defaults to `string` for unparameterised subclasses.
 *
 * **The namespace is not declared on the class** (no `static namespace`,
 * ADR-08 — I68). It is:
 *   - injected by the constructor (immutable from construction)
 *   - derived from the application manifest key (source of truth — I69)
 *   - checked at compile time by `StrictManifest<M>` through `satisfies`
 *   - checked at runtime by `assertValidNamespace()` (safety net — I71)
 *
 * **The Events a Feature may emit are declared on its `static readonly
 * channel` token** (`events`, D16): the kernel refuses an emission that was
 * not declared.
 */
class Feature {
    /**
     * Tokens of the Features this Feature queries **during its own initial
     * unit** (C.1): the kernel starts the Feature after them, whatever the order
     * of the Manifest. Optional (none by default). Each must also be declared in
     * `queries`; a cycle is refused before startup.
     */
    get dependsOn() {
        return [];
    }
    // ─── Constructor ───────────────────────────────────────────────────────
    /**
     * Creates a Feature bound to the given namespace.
     *
     * Called only by `Application.start()`, which passes the manifest key.
     *
     * @throws `BonsaiNamespaceError` when the namespace is invalid or reserved.
     */
    constructor(namespace) {
        _Feature_instances.add(this);
        _Feature_namespace.set(this, void 0);
        _Feature_entity.set(this, null);
        // A class provided by the framework (static `framework`, e.g. the router) may take a reserved namespace.
        // The Application manifest still refuses a reserved key: only the Application instantiates it (I71).
        assertValidNamespace(namespace, { framework: new.target.framework === true });
        __classPrivateFieldSet(this, _Feature_namespace, namespace, "f");
    }
    // ─── Public API ────────────────────────────────────────────────────────
    /**
     * Namespace of this instance — immutable, set by the constructor.
     */
    get namespace() {
        return __classPrivateFieldGet(this, _Feature_namespace, "f");
    }
    /**
     * Access to the Entity description and read methods (I6 — exclusive owner).
     * `protected`: only the Feature and its subclasses reach it. Its `state` is
     * readable only inside a handler; mutation goes through `ctx.mutate`.
     */
    get entity() {
        if (__classPrivateFieldGet(this, _Feature_entity, "f") === null) {
            throw new BonsaiError("NOT_STARTED", `"${__classPrivateFieldGet(this, _Feature_namespace, "f")}": the Entity exists only once the Feature is started by its Application (I94).`);
        }
        return __classPrivateFieldGet(this, _Feature_entity, "f");
    }
    // ─── Lifecycle hooks ───────────────────────────────────────────────────
    /**
     * Hook called inside the startup unit, after the Entity exists (I56).
     * Override it in subclasses. It receives the same context as a handler.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onInit(_ctx) {
        // Default no-op — subclasses override
    }
    // ─── Framework description (internal) ──────────────────────────────────
    [(_Feature_namespace = new WeakMap(), _Feature_entity = new WeakMap(), _Feature_instances = new WeakSet(), DESCRIBE)]() {
        const namespace = __classPrivateFieldGet(this, _Feature_namespace, "f");
        // I22 — 1:1 Entity creation through the Entity getter (ADR-09)
        const EntityCtor = this.Entity;
        const entity = new EntityCtor();
        __classPrivateFieldSet(this, _Feature_entity, entity, "f");
        const definition = describeEntity(entity);
        const methods = __classPrivateFieldGet(this, _Feature_instances, "m", _Feature_methodNames).call(this);
        __classPrivateFieldGet(this, _Feature_instances, "m", _Feature_checkEntityHandlers).call(this, methods, definition.initial);
        const token = this.constructor.channel;
        const events = token?.events ?? [];
        const commands = {};
        const queries = {};
        const listens = [];
        const self = this;
        // Handler auto-discovery (I48)
        for (const method of methods) {
            let match = method.match(/^on([A-Z][a-zA-Z]*)Command$/);
            if (match) {
                commands[lowerFirst(match[1])] = (payload, c) => __classPrivateFieldGet(this, _Feature_instances, "m", _Feature_run).call(this, c, () => self[method](payload, __classPrivateFieldGet(this, _Feature_instances, "m", _Feature_featureContext).call(this, c)));
                continue;
            }
            match = method.match(/^on([A-Z][a-zA-Z]*)Query$/);
            if (match) {
                queries[lowerFirst(match[1])] = (params, c) => __classPrivateFieldGet(this, _Feature_instances, "m", _Feature_run).call(this, c, () => self[method](params, __classPrivateFieldGet(this, _Feature_instances, "m", _Feature_queryContext).call(this, c)));
            }
        }
        // Subscriptions to the declared external Channels (C3, I2, I48)
        for (const external of this.listens) {
            const channelPascal = external.namespace[0].toUpperCase() + external.namespace.slice(1);
            const prefix = `on${channelPascal}`;
            for (const method of methods) {
                if (!method.startsWith(prefix) || !method.endsWith("Event"))
                    continue;
                const eventPascal = method.slice(prefix.length, -"Event".length);
                if (eventPascal.length === 0)
                    continue;
                listens.push({
                    namespace: external.namespace,
                    event: lowerFirst(eventPascal),
                    handler: (payload, c) => __classPrivateFieldGet(this, _Feature_instances, "m", _Feature_run).call(this, c, () => self[method](payload, __classPrivateFieldGet(this, _Feature_instances, "m", _Feature_featureContext).call(this, c)))
                });
            }
        }
        return {
            name: namespace,
            channel: { namespace, events, commands, queries },
            listens,
            locals: {
                [ENTITY_UPDATED]: (event, c) => __classPrivateFieldGet(this, _Feature_instances, "m", _Feature_run).call(this, c, () => __classPrivateFieldGet(this, _Feature_instances, "m", _Feature_dispatchEntityEvent).call(this, event, __classPrivateFieldGet(this, _Feature_instances, "m", _Feature_featureContext).call(this, c)))
            },
            entity: definition,
            init: (c) => __classPrivateFieldGet(this, _Feature_instances, "m", _Feature_run).call(this, c, () => this.onInit(__classPrivateFieldGet(this, _Feature_instances, "m", _Feature_featureContext).call(this, c))),
            dependsOn: this.dependsOn.map((t) => t.namespace)
        };
    }
}
_a = Feature, _Feature_methodNames = function _Feature_methodNames() {
    const names = new Set();
    for (let proto = Object.getPrototypeOf(this); proto !== null && proto !== _a.prototype; proto = Object.getPrototypeOf(proto)) {
        for (const name of Object.getOwnPropertyNames(proto))
            names.add(name);
    }
    return [...names];
}, _Feature_run = function _Feature_run(c, fn) {
    const entity = __classPrivateFieldGet(this, _Feature_entity, "f");
    const restore = bindEntityState(entity, () => c.state());
    try {
        return fn();
    }
    finally {
        restore();
    }
}, _Feature_queryContext = function _Feature_queryContext(c) {
    return {
        cause: c.cause,
        query: (token, name, params) => c.query(token.namespace, name, params)
    };
}, _Feature_featureContext = function _Feature_featureContext(c) {
    const mutate = (intent, paramsOrRecipe, maybeRecipe) => {
        const params = typeof paramsOrRecipe === "function" ? null : paramsOrRecipe;
        const recipe = typeof paramsOrRecipe === "function" ? paramsOrRecipe : maybeRecipe;
        const change = c.mutate(recipe);
        if (change === null)
            return null; // no-op: no notification
        const event = {
            intent,
            payload: params?.payload,
            context: c.cause,
            // Keys derived from the first path segment of each patch (I97)
            changedKeys: [...new Set(change.patches.map((p) => String(p.path[0])))],
            patches: [...change.patches],
            inversePatches: [...change.inversePatches],
            previousState: change.previous,
            nextState: change.next,
            timestamp: Date.now()
        };
        // The notification is a deferred local message (G5, D8).
        c.local(ENTITY_UPDATED, event);
        return event;
    };
    return {
        ...__classPrivateFieldGet(this, _Feature_instances, "m", _Feature_queryContext).call(this, c),
        emit: (event, payload) => c.emit(event, payload),
        mutate: mutate
    };
}, _Feature_checkEntityHandlers = function _Feature_checkEntityHandlers(methods, initial) {
    const stateKeys = new Set(Object.keys(initial));
    for (const method of methods) {
        const match = method.match(/^on([A-Z][a-zA-Z]*)EntityUpdated$/);
        if (!match || match[1] === "Any")
            continue;
        const key = lowerFirst(match[1]);
        hardInvariant(stateKeys.has(key), `Feature "${__classPrivateFieldGet(this, _Feature_namespace, "f")}" declares entity handler "${method}" for unknown key "${key}"`, "I96", __classPrivateFieldGet(this, _Feature_namespace, "f"));
    }
}, _Feature_dispatchEntityEvent = function _Feature_dispatchEntityEvent(event, ctx) {
    const self = this;
    for (const key of [...event.changedKeys].sort()) {
        const handlerName = `on${key[0].toUpperCase()}${key.slice(1)}EntityUpdated`;
        if (typeof self[handlerName] !== "function")
            continue;
        const keyPatches = event.patches.filter((p) => String(p.path[0]) === key);
        const prev = event.previousState[key];
        const next = event.nextState[key];
        self[handlerName](prev, next, keyPatches, ctx);
    }
    if (typeof self["onAnyEntityUpdated"] === "function") {
        self["onAnyEntityUpdated"](event, ctx);
    }
};

export { BonsaiNamespaceError, Feature, RESERVED_NAMESPACES, assertValidNamespace, describeFeature, isCamelCaseNamespace, isReservedNamespace };
