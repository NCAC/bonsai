/**
 * @bonsai/application - Version 0.2.0
 * Bundled by Bonsai Build System
 * Date: 2026-11-05T11:06:34.166Z
 */
import { isDev, BonsaiError } from '@bonsai/error';
import { reportToConsole, Root, describeComponent } from '@bonsai/kernel';
import { BonsaiNamespaceError, describeFeature, assertValidNamespace } from '@bonsai/feature';
import { RouterFeature } from '@bonsai/router';

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
 * @bonsai/application — Application class
 *
 * Capabilities (ADR-07, ADR-08, ADR-09):
 *   - constructor({ features, components?, causalBound? }) — declares the application manifest
 *   - start() — phased bootstrap on the communication kernel (migration lot M6.1):
 *       Phase 0a: namespace format validation (assertValidNamespace)
 *       Phase 0b: pure instantiation of the Features (inert ctor — I94)
 *       Phase 0c: read instance.listens/queries/dependsOn — cross-reference validation (I70)
 *       Phase 1: kernel startup — one `Root` per Application (G6); the Features
 *                become its children in an order that respects their initial
 *                initial dependencies (`dependsOn`, C.1); each creates its Entity,
 *                registers its handlers and runs `onInit()` inside the startup
 *                unit (§2.5, I56)
 *       Then the Foundation (if any), which creates its Composers, which
 *       create the Views (lot M6.2)
 *
 * Invariants:
 *   I23  — Application is dormant at runtime (no handle/emit/listen/request)
 *   I21  — The manifest guarantees uniqueness at compile time; Application
 *          validates format, reserved names and `channel` consistency at bootstrap
 *   I33  — An Application without a Foundation cannot render anything
 *          (still not enforced: the Foundation stays optional — a headless
 *          Application is legitimate in tests)
 *   I56  — Every Feature's onInit() runs before the Foundation is created
 *   I68  — The namespace is carried by the manifest, not by a static (ADR-08)
 *   I69  — The manifest is the single source of truth for identity (ADR-08)
 *   I70  — Every reference to an external namespace MUST be validated against
 *          the manifest — read from instance.listens/queries (ADR-09)
 *   I71  — `RESERVED_NAMESPACES` is a framework constant (ADR-08)
 *   I94  — The Feature constructor is inert: it creates no Entity and
 *          touches no kernel; everything happens at startup (ADR-09)
 *
 * Not delivered yet:
 *   - stop()
 *   - SSR (serverState)
 *   - DevTools
 *   - ESM BonsaiRegistry
 *
 * @packageDocumentation
 */
var _Application_instances, _Application_manifest, _Application_components, _Application_causalBound, _Application_onTrace, _Application_foundation, _Application_document, _Application_anchor, _Application_router, _Application_adapters, _Application_adapterOptions, _Application_stop, _Application_started, _Application_root, _Application_featureInstances, _Application_validateManifest;
// ─── Application class ───────────────────────────────────────────────────────
class Application {
    constructor(options) {
        _Application_instances.add(this);
        _Application_manifest.set(this, void 0);
        _Application_components.set(this, void 0);
        _Application_causalBound.set(this, void 0);
        _Application_onTrace.set(this, void 0);
        _Application_foundation.set(this, void 0);
        _Application_document.set(this, void 0);
        _Application_anchor.set(this, void 0);
        _Application_router.set(this, void 0);
        _Application_adapters.set(this, void 0);
        _Application_adapterOptions.set(this, void 0);
        _Application_stop.set(this, new AbortController());
        _Application_started.set(this, false);
        _Application_root.set(this, null);
        _Application_featureInstances.set(this, []);
        __classPrivateFieldSet(this, _Application_manifest, options?.features ?? {}, "f");
        __classPrivateFieldSet(this, _Application_components, options?.components ?? [], "f");
        __classPrivateFieldSet(this, _Application_causalBound, options?.causalBound ?? 50, "f");
        __classPrivateFieldSet(this, _Application_onTrace, options?.onTrace === undefined ? (isDev() ? (entry) => reportToConsole(entry) : null) : options.onTrace, "f");
        __classPrivateFieldSet(this, _Application_foundation, options?.foundation ?? null, "f");
        __classPrivateFieldSet(this, _Application_document, options?.document, "f");
        __classPrivateFieldSet(this, _Application_anchor, options?.anchor, "f");
        __classPrivateFieldSet(this, _Application_router, options?.router ?? false, "f");
        __classPrivateFieldSet(this, _Application_adapters, options?.adapters ?? [], "f");
        __classPrivateFieldSet(this, _Application_adapterOptions, options?.adapterOptions ?? {}, "f");
        if (__classPrivateFieldGet(this, _Application_foundation, "f") !== null && __classPrivateFieldGet(this, _Application_document, "f") === undefined) {
            throw new BonsaiError("MISSING_DOCUMENT", "a `foundation` needs the host `document` it renders in");
        }
        if (__classPrivateFieldGet(this, _Application_adapters, "f").length > 0 && __classPrivateFieldGet(this, _Application_document, "f") === undefined) {
            throw new BonsaiError("MISSING_DOCUMENT", "`adapters` need the host `document` they observe");
        }
        const categories = new Set();
        for (const adapter of __classPrivateFieldGet(this, _Application_adapters, "f")) {
            if (categories.has(adapter.category)) {
                throw new BonsaiError("DUPLICATE_ADAPTER", `two adapters of the category "${adapter.category}": a source of the host is admitted by one instance only (A5.d, D7)`);
            }
            categories.add(adapter.category);
            for (const needed of adapter.requires ?? []) {
                if (needed === "router" && !__classPrivateFieldGet(this, _Application_router, "f")) {
                    throw new BonsaiError("MISSING_FEATURE", `the adapter "${adapter.category}" needs the Feature "${needed}": activate it with \`router: true\``);
                }
            }
        }
    }
    // ─── Public API ────────────────────────────────────────────────────────
    /**
     * Phased bootstrap (ADR-07, ADR-09). Can only be called once.
     *
     * @throws when called twice (no re-bootstrap)
     * @throws `BonsaiNamespaceError` when the manifest breaks the invariants
     *   (runtime safety net — compile time should already have caught it
     *   through `StrictManifest<M>`).
     * @throws `ManifestError` when the initial Query dependencies are cyclic (C.1).
     * @throws `StartupError` when a Feature fails during startup: the model
     *   under construction is abandoned (§2.5).
     */
    start() {
        if (__classPrivateFieldGet(this, _Application_started, "f")) {
            throw new BonsaiError("ALREADY_STARTED", "Cannot start() — already started");
        }
        // ── Phase 0a — format + channel validation (ADR-08 — I70/I71/I73) ───
        __classPrivateFieldGet(this, _Application_instances, "m", _Application_validateManifest).call(this);
        __classPrivateFieldSet(this, _Application_started, true, "f");
        const entries = Object.entries(__classPrivateFieldGet(this, _Application_manifest, "f"));
        // ── Phase 0b — pure instantiation ───────────────────────────────────
        // The Feature ctor is inert (I94): assertValidNamespace + #namespace.
        for (const [namespace, FeatureClass] of entries) {
            __classPrivateFieldGet(this, _Application_featureInstances, "f").push(new FeatureClass(namespace));
        }
        // ── Phase 0c — cross-reference validation from the instances (I70) ───
        const known = new Set(entries.map(([ns]) => ns));
        if (__classPrivateFieldGet(this, _Application_router, "f"))
            known.add("router");
        for (let i = 0; i < entries.length; i++) {
            const [ownNs] = entries[i];
            const instance = __classPrivateFieldGet(this, _Application_featureInstances, "f")[i];
            const queried = new Set(instance.queries.map((t) => t.namespace));
            for (const dependency of instance.dependsOn) {
                // C.1: an initial dependency is a Query made at startup, so it must be a declared one.
                if (!queried.has(dependency.namespace)) {
                    throw new BonsaiNamespaceError("FEATURE_DEPENDENCY_NOT_QUERIED", `Feature "${ownNs}" depends on "${dependency.namespace}" for its startup but does not declare it in \`queries\`.`);
                }
            }
            const refs = [...instance.listens, ...instance.queries, ...instance.dependsOn].map((t) => t.namespace);
            for (const ref of refs) {
                if (!known.has(ref)) {
                    throw new BonsaiNamespaceError("NAMESPACE_UNKNOWN_REFERENCE", `Feature "${ownNs}" declares unknown channel "${ref}". ` +
                        `Known namespaces: ${[...known].join(", ")}`);
                }
            }
        }
        // The Feature of navigation is provided by the framework, outside the manifest (D15, I71).
        const framework = __classPrivateFieldGet(this, _Application_router, "f") ? [new RouterFeature("router")] : [];
        // ── Phase 1 — kernel startup (§2.5, C.1) ─────────────────────────────
        __classPrivateFieldSet(this, _Application_root, new Root({
            causalBound: __classPrivateFieldGet(this, _Application_causalBound, "f"),
            ...(__classPrivateFieldGet(this, _Application_onTrace, "f") === null ? {} : { onTrace: __classPrivateFieldGet(this, _Application_onTrace, "f") }),
            ...(__classPrivateFieldGet(this, _Application_document, "f") === undefined ? {} : { document: __classPrivateFieldGet(this, _Application_document, "f") })
        }), "f");
        // Features first (I56), then the adapters of the host, then the Foundation, then the other components.
        const adapters = __classPrivateFieldGet(this, _Application_adapters, "f").map((Adapter) => describeComponent(new Adapter(), {
            ...__classPrivateFieldGet(this, _Application_adapterOptions, "f")[Adapter.category],
            root: __classPrivateFieldGet(this, _Application_root, "f"),
            document: __classPrivateFieldGet(this, _Application_document, "f"),
            signal: __classPrivateFieldGet(this, _Application_stop, "f").signal
        }));
        const foundation = __classPrivateFieldGet(this, _Application_foundation, "f") === null
            ? []
            : [describeComponent(new (__classPrivateFieldGet(this, _Application_foundation, "f"))(), { anchor: __classPrivateFieldGet(this, _Application_anchor, "f") })];
        __classPrivateFieldGet(this, _Application_root, "f").startFromManifest([
            ...[...__classPrivateFieldGet(this, _Application_featureInstances, "f"), ...framework].map((instance) => describeFeature(instance)),
            ...adapters,
            ...foundation,
            ...__classPrivateFieldGet(this, _Application_components, "f")
        ]);
    }
    /** The communication root (one per Application, G6); `null` before start(). */
    get root() {
        return __classPrivateFieldGet(this, _Application_root, "f");
    }
    /**
     * Removes the observers that Bonsai registered on the host (B.2). The model
     * is not destroyed: this is the only part of a stop that exists yet.
     */
    stop() {
        __classPrivateFieldGet(this, _Application_stop, "f").abort();
    }
    /** Whether the application has started. */
    get started() {
        return __classPrivateFieldGet(this, _Application_started, "f");
    }
}
_Application_manifest = new WeakMap(), _Application_components = new WeakMap(), _Application_causalBound = new WeakMap(), _Application_onTrace = new WeakMap(), _Application_foundation = new WeakMap(), _Application_document = new WeakMap(), _Application_anchor = new WeakMap(), _Application_router = new WeakMap(), _Application_adapters = new WeakMap(), _Application_adapterOptions = new WeakMap(), _Application_stop = new WeakMap(), _Application_started = new WeakMap(), _Application_root = new WeakMap(), _Application_featureInstances = new WeakMap(), _Application_instances = new WeakSet(), _Application_validateManifest = function _Application_validateManifest() {
    const namespaces = Object.keys(__classPrivateFieldGet(this, _Application_manifest, "f"));
    // I21/I57/I71 — delegates to assertValidNamespace
    for (const ns of namespaces) {
        assertValidNamespace(ns);
    }
    for (const [ownNs, FeatureClass] of Object.entries(__classPrivateFieldGet(this, _Application_manifest, "f"))) {
        const cls = FeatureClass;
        const token = cls.channel;
        if (token === undefined ||
            token === null ||
            typeof token !== "object" ||
            typeof token.namespace !== "string") {
            throw new BonsaiNamespaceError("FEATURE_MISSING_CHANNEL", `Feature "${ownNs}" does not declare \`static readonly channel: ` +
                `TChannelToken<TDef, "${ownNs}">\` (I73 — ADR-14). Add ` +
                `\`static readonly channel = { namespace: "${ownNs}" }\` ` +
                `to the class.`);
        }
        if (token.namespace !== ownNs) {
            throw new BonsaiNamespaceError("FEATURE_CHANNEL_NAMESPACE_MISMATCH", `Feature registered under "${ownNs}" declares ` +
                `channel.namespace="${token.namespace}" — must match the manifest ` +
                `key (I22, I73). The channel token namespace and the manifest key ` +
                `are the authoritative identity of the Feature.`);
        }
    }
};

export { Application };
