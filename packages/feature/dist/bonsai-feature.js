/**
 * @bonsai/feature - Version 0.1.0
 * Bundled by Bonsai Build System
 * Date: 2026-09-30T06:19:06.075Z
 */
import { Radio } from '@bonsai/event';
import { hardInvariant, BroadcastError } from '@bonsai/error';

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
 *     + flattening helpers (`TFlatListens`, `TFlatTriggers`, `TFlatRequests`)
 *     + payload extractors (`TEventPayloadFor`, `TCommandPayloadFor`,
 *     `TRequestParamsFor`, `TRequestResultFor`) + `TChannelCallbacks`
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
 * Typed error for any violation detected at runtime.
 *
 * Belongs to the framework error family (ADR-05). Codes are stable and
 * meant to be matched by consumers.
 */
class BonsaiNamespaceError extends Error {
    constructor(code, message) {
        super(`[Bonsai] ${code}: ${message}`);
        this.name = "BonsaiNamespaceError";
        this.code = code;
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
function assertValidNamespace(ns) {
    if (typeof ns !== "string" || ns.length === 0) {
        throw new BonsaiNamespaceError("NAMESPACE_INVALID_FORMAT", `Namespace must be a non-empty string, received: ${String(ns)}`);
    }
    if (!isCamelCaseNamespace(ns)) {
        throw new BonsaiNamespaceError("NAMESPACE_INVALID_FORMAT", `Namespace "${ns}" must be camelCase (lowercase first letter, letters only)`);
    }
    if (isReservedNamespace(ns)) {
        throw new BonsaiNamespaceError("NAMESPACE_RESERVED", `Namespace "${ns}" is reserved by the framework`);
    }
}

/**
 * @bonsai/feature — Feature base class
 *
 * The 5 capabilities (ADR-01):
 *   C1 — emit(event, payload) on its own Channel (typed by TChannelDef, ADR-14)
 *   C2 — handle(command) through auto-discovered on{Name}Command methods
 *   C3 — listen(event) on declared external Channels through on{Channel}{EventName}Event
 *   C4 — reply(request) through auto-discovered on{Name}Request methods
 *   C5 — request(token, name, params) to declared Channels (typed by the token, ADR-14)
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
 *   I76 — `Channel.{trigger,emit,request,handle,listen,reply}` are strictly
 *         typed by `TDef` — key = `keyof TDef[lane]`, never a free `string`
 *         (ADR-14)
 *   I79 — `Feature.request()` only accepts a typed `TChannelToken`;
 *         `abstract get listens()`/`abstract get queries()` carry these tokens
 *         as instance declarations (ADR-14, ADR-09 — I93)
 *   I93 — `listens` and `queries` are instance `abstract get` on Feature
 *         (ADR-09 — TS2515 when missing on a concrete class)
 *   I94 — The Feature constructor is inert: assertValidNamespace + #namespace
 *         only. No Radio/Entity side effect.
 *   I96 — Entity handlers `on<Key>EntityUpdated`/`onAnyEntityUpdated` are
 *         auto-discovered on the Feature (same mechanism as I48), dispatched
 *         in alphabetical order of `changedKeys`, then the catch-all. Unknown
 *         key → bootstrap error. A throwing handler is isolated (BroadcastError,
 *         ADR-05) and the next notification still runs (stratum 1a)
 *
 * @packageDocumentation
 */
var _Feature_instances, _Feature_namespace, _Feature_entity, _Feature_channel, _Feature_bootstrapped, _Feature_registerCommandHandlers, _Feature_registerRequestRepliers, _Feature_registerEventListeners, _Feature_registerEntityHandlers, _Feature_dispatchEntityEvent;
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
 */
class Feature {
    // ─── Constructor ───────────────────────────────────────────────────────
    /**
     * Creates a Feature bound to the given namespace.
     *
     * Called only by `Application.start()`, which passes the manifest key.
     * Manual instantiation (tests) must pass the namespace too.
     *
     * @throws `BonsaiNamespaceError` when the namespace is invalid or reserved.
     */
    constructor(namespace) {
        _Feature_instances.add(this);
        _Feature_namespace.set(this, void 0);
        _Feature_entity.set(this, void 0);
        // Own channel — assigned at bootstrap; the cast is safe by I22 (1 namespace = 1 TDef).
        _Feature_channel.set(this, void 0);
        _Feature_bootstrapped.set(this, false);
        assertValidNamespace(namespace);
        __classPrivateFieldSet(this, _Feature_namespace, namespace, "f");
    }
    // ─── Public API ────────────────────────────────────────────────────────
    /**
     * Namespace of this instance — immutable, set by the constructor.
     * Typed `TSelfNS` (a string literal when the Feature is parameterised).
     */
    get namespace() {
        return __classPrivateFieldGet(this, _Feature_namespace, "f");
    }
    /**
     * Access to the Entity (I6 — exclusive owner).
     * `protected`: only the Feature and its subclasses reach it.
     * Typed by the concrete class (TEntity) thanks to ADR-09.
     */
    get entity() {
        return __classPrivateFieldGet(this, _Feature_entity, "f");
    }
    /**
     * Bootstrap: creates the Entity, registers the handlers on the Channel and
     * calls onInit(). Called by Application, or manually in tests.
     */
    bootstrap() {
        if (__classPrivateFieldGet(this, _Feature_bootstrapped, "f"))
            return;
        __classPrivateFieldSet(this, _Feature_bootstrapped, true, "f");
        // Safe cast by I22: 1 namespace = 1 Feature = 1 TDef (I75).
        __classPrivateFieldSet(this, _Feature_channel, Radio.me().channel(__classPrivateFieldGet(this, _Feature_namespace, "f")), "f");
        // I22 — 1:1 Entity creation through the Entity getter (ADR-09)
        const EntityCtor = this.Entity;
        __classPrivateFieldSet(this, _Feature_entity, new EntityCtor(), "f");
        // Handler auto-discovery (I48)
        __classPrivateFieldGet(this, _Feature_instances, "m", _Feature_registerCommandHandlers).call(this);
        __classPrivateFieldGet(this, _Feature_instances, "m", _Feature_registerRequestRepliers).call(this);
        __classPrivateFieldGet(this, _Feature_instances, "m", _Feature_registerEventListeners).call(this);
        __classPrivateFieldGet(this, _Feature_instances, "m", _Feature_registerEntityHandlers).call(this);
        // Lifecycle
        this.onInit();
    }
    // ─── Capabilities (C1–C5) ──────────────────────────────────────────────
    /**
     * C1 — Emits a typed Event on this Feature's own Channel (I1, ADR-14).
     */
    emit(eventName, payload) {
        __classPrivateFieldGet(this, _Feature_channel, "f").emit(eventName, payload);
    }
    /**
     * C5 — Performs a typed Request to a declared Channel (I17, ADR-14).
     * Returns the typed result or null (ADR-02).
     */
    request(token, requestName, params) {
        return Radio.me().channelFor(token).request(requestName, params);
    }
    // ─── Lifecycle hooks ───────────────────────────────────────────────────
    /**
     * Hook called after bootstrap. Override it in subclasses.
     */
    onInit() {
        // Default no-op — subclasses override
    }
}
_Feature_namespace = new WeakMap(), _Feature_entity = new WeakMap(), _Feature_channel = new WeakMap(), _Feature_bootstrapped = new WeakMap(), _Feature_instances = new WeakSet(), _Feature_registerCommandHandlers = function _Feature_registerCommandHandlers() {
    // Cast to the untyped Channel to register by string (I75).
    const ch = __classPrivateFieldGet(this, _Feature_channel, "f");
    const proto = Object.getPrototypeOf(this);
    const methods = Object.getOwnPropertyNames(proto);
    for (const method of methods) {
        const match = method.match(/^on([A-Z][a-zA-Z]*)Command$/);
        if (match) {
            const commandName = match[1][0].toLowerCase() + match[1].slice(1);
            ch.handle(commandName, (payload) => {
                this[method](payload);
            });
        }
    }
}, _Feature_registerRequestRepliers = function _Feature_registerRequestRepliers() {
    // Cast to the untyped Channel to register by string (I75).
    const ch = __classPrivateFieldGet(this, _Feature_channel, "f");
    const proto = Object.getPrototypeOf(this);
    const methods = Object.getOwnPropertyNames(proto);
    for (const method of methods) {
        const match = method.match(/^on([A-Z][a-zA-Z]*)Request$/);
        if (match) {
            const requestName = match[1][0].toLowerCase() + match[1].slice(1);
            ch.reply(requestName, (params) => {
                return this[method](params);
            });
        }
    }
}, _Feature_registerEventListeners = function _Feature_registerEventListeners() {
    const listenTokens = this.listens;
    if (listenTokens.length === 0)
        return;
    const proto = Object.getPrototypeOf(this);
    const methods = Object.getOwnPropertyNames(proto);
    for (const token of listenTokens) {
        const channelName = token.namespace;
        const channelPascal = channelName[0].toUpperCase() + channelName.slice(1);
        const prefix = `on${channelPascal}`;
        const suffix = "Event";
        // Cast to the untyped Channel to register by string (I75).
        const ch = Radio.me().channel(channelName);
        for (const method of methods) {
            if (method.startsWith(prefix) && method.endsWith(suffix)) {
                const eventPascal = method.slice(prefix.length, -suffix.length);
                if (eventPascal.length === 0)
                    continue;
                const eventName = eventPascal[0].toLowerCase() + eventPascal.slice(1);
                ch.listen(eventName, (payload) => {
                    this[method](payload);
                });
            }
        }
    }
}, _Feature_registerEntityHandlers = function _Feature_registerEntityHandlers() {
    const proto = Object.getPrototypeOf(this);
    const methods = Object.getOwnPropertyNames(proto);
    const stateKeys = new Set(Object.keys(__classPrivateFieldGet(this, _Feature_entity, "f").state));
    for (const method of methods) {
        const match = method.match(/^on([A-Z][a-zA-Z]*)EntityUpdated$/);
        if (!match || match[1] === "Any")
            continue;
        const key = match[1][0].toLowerCase() + match[1].slice(1);
        hardInvariant(stateKeys.has(key), `Feature "${__classPrivateFieldGet(this, _Feature_namespace, "f")}" declares entity handler "${method}" for unknown key "${key}"`, "I96", __classPrivateFieldGet(this, _Feature_namespace, "f"));
    }
    __classPrivateFieldGet(this, _Feature_entity, "f").onAnyEntityUpdated((event) => {
        __classPrivateFieldGet(this, _Feature_instances, "m", _Feature_dispatchEntityEvent).call(this, event);
    });
}, _Feature_dispatchEntityEvent = function _Feature_dispatchEntityEvent(event) {
    const self = this;
    for (const key of [...event.changedKeys].sort()) {
        const handlerName = `on${key[0].toUpperCase()}${key.slice(1)}EntityUpdated`;
        if (typeof self[handlerName] !== "function")
            continue;
        const keyPatches = event.patches.filter((p) => String(p.path[0]) === key);
        const prev = event.previousState[key];
        const next = event.nextState[key];
        try {
            self[handlerName](prev, next, keyPatches);
        }
        catch (error) {
            console.error(new BroadcastError(`Entity handler "${handlerName}" threw for intent "${event.intent}"`, "ADR-05", __classPrivateFieldGet(this, _Feature_namespace, "f")), error);
        }
    }
    if (typeof self["onAnyEntityUpdated"] === "function") {
        try {
            self["onAnyEntityUpdated"](event);
        }
        catch (error) {
            console.error(new BroadcastError(`Entity handler "onAnyEntityUpdated" threw for intent "${event.intent}"`, "ADR-05", __classPrivateFieldGet(this, _Feature_namespace, "f")), error);
        }
    }
};

export { BonsaiNamespaceError, Feature, RESERVED_NAMESPACES, assertValidNamespace, isCamelCaseNamespace, isReservedNamespace };
