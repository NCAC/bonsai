/**
 * @bonsai/application - Version 0.0.1
 * Bundled by Bonsai Build System
 * Date: 2026-05-13T20:26:20.686Z
 */
import { Radio } from '@bonsai/event';
import { assertValidNamespace, BonsaiNamespaceError } from '@bonsai/feature';

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
 * Strate 0 (refondu ADR-0039) — Capacités :
 *   - constructor({ foundation, features }) — déclare le manifest applicatif
 *   - start() — bootstrap en 4 phases simplifiées :
 *       Phase 0: Validation runtime du manifest (filet ADR-0039)
 *       Phase 1: Channels (crée les channels de chaque Feature)
 *       Phase 2: Entities (instanciées par les Features)
 *       Phase 3: Features (new FeatureClass(ns), bootstrap, onInit)
 *       Phase 4: Foundation (composers → views, attach)
 *
 * Invariants :
 *   I23  — Application est dormante au runtime (pas de handle/emit/listen/request)
 *   I24  — Le manifest garantit l'unicité au compile-time ; Application valide
 *          format + réservés + cohérence des `channels` au bootstrap (amendé ADR-0039)
 *   I33  — Application sans Foundation ne peut rien afficher
 *   I56  — onInit() de chaque Feature appelé avant la création de la Foundation
 *   I68  — Le namespace est porté par le manifest, pas par un static (ADR-0039)
 *   I69  — Le manifest est l'unique source de vérité de l'identité (ADR-0039)
 *   I70  — Toute référence à un namespace externe DOIT être validée
 *          contre le manifest (ADR-0039)
 *   I71  — `RESERVED_NAMESPACES` est une constante framework (ADR-0039)
 *
 * Strate 0 simplifications :
 *   - Pas de stop()
 *   - Pas de SSR (serverState)
 *   - Pas de DevTools
 *   - Pas de BonsaiRegistry ESM
 *
 * @packageDocumentation
 */
var _Application_instances, _Application_manifest, _Application_started, _Application_foundationClass, _Application_foundationInstance, _Application_featureInstances, _Application_validateManifest;
// ─── Application class ───────────────────────────────────────────────────────
class Application {
    constructor(options) {
        _Application_instances.add(this);
        _Application_manifest.set(this, void 0);
        _Application_started.set(this, false);
        _Application_foundationClass.set(this, void 0);
        _Application_foundationInstance.set(this, null);
        _Application_featureInstances.set(this, []);
        __classPrivateFieldSet(this, _Application_foundationClass, options?.foundation ?? null, "f");
        __classPrivateFieldSet(this, _Application_manifest, options?.features ?? {}, "f");
    }
    // ─── Public API ────────────────────────────────────────────────────────
    /**
     * Bootstrap en 4 phases simplifiées (strate 0).
     * Ne peut être appelé qu'une seule fois.
     *
     * Phases :
     *   Phase 0 — Validation runtime du manifest (filet ADR-0039) :
     *             format camelCase, mots réservés, références `static channels`.
     *   Phase 1 — Channels  : `Radio.channel(namespace)` pour chaque Feature
     *   Phase 2 — Entities  : (créées implicitement par Feature.bootstrap)
     *   Phase 3 — Features  : `new FeatureClass(namespace)` + `bootstrap()` (I56)
     *   Phase 4 — Foundation: `Foundation.attach()` qui orchestre Composers → Views
     *
     * @throws si appelée deux fois (strate 0 : pas de re-bootstrap)
     * @throws `BonsaiNamespaceError` si le manifest viole les invariants (filet
     *   runtime — le compile-time est censé l'avoir déjà attrapé via
     *   `StrictManifest<M>`).
     * @throws si aucune Foundation n'a été fournie au constructeur (I33).
     */
    start() {
        if (__classPrivateFieldGet(this, _Application_started, "f")) {
            throw new Error("[Bonsai Application] Cannot start() — already started");
        }
        if (__classPrivateFieldGet(this, _Application_foundationClass, "f") === null) {
            throw new Error("[Bonsai Application] Cannot start() — no Foundation provided. " +
                "Pass { foundation: MyFoundation } to the Application constructor (I33).");
        }
        // ── Phase 0 — Validation runtime du manifest (ADR-0039 — I70/I71) ───
        __classPrivateFieldGet(this, _Application_instances, "m", _Application_validateManifest).call(this);
        __classPrivateFieldSet(this, _Application_started, true, "f");
        const entries = Object.entries(__classPrivateFieldGet(this, _Application_manifest, "f"));
        // Phase 1: Channels — crée le channel de chaque Feature dans Radio
        for (const [namespace] of entries) {
            Radio.me().channel(namespace);
        }
        // Phase 2: Entities — créées par chaque Feature dans bootstrap()
        // Phase 3: Features — instancie avec le namespace du manifest, bootstrap
        // (auto-discovery handlers I48), appelle onInit (I56)
        for (const [namespace, FeatureClass] of entries) {
            const instance = new FeatureClass(namespace);
            __classPrivateFieldGet(this, _Application_featureInstances, "f").push(instance);
            instance.bootstrap();
        }
        // Phase 4: Views — Foundation → Composers → Views
        const FoundationClass = __classPrivateFieldGet(this, _Application_foundationClass, "f");
        __classPrivateFieldSet(this, _Application_foundationInstance, new FoundationClass(), "f");
        __classPrivateFieldGet(this, _Application_foundationInstance, "f").attach();
    }
    /** La Foundation instanciée (après start). */
    get foundation() {
        return __classPrivateFieldGet(this, _Application_foundationInstance, "f");
    }
    /** Indique si l'application a démarré. */
    get started() {
        return __classPrivateFieldGet(this, _Application_started, "f");
    }
}
_Application_manifest = new WeakMap(), _Application_started = new WeakMap(), _Application_foundationClass = new WeakMap(), _Application_foundationInstance = new WeakMap(), _Application_featureInstances = new WeakMap(), _Application_instances = new WeakSet(), _Application_validateManifest = function _Application_validateManifest() {
    const namespaces = Object.keys(__classPrivateFieldGet(this, _Application_manifest, "f"));
    // I21/I57/I71 — délègue à assertValidNamespace
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
                `TChannelToken<TDef, "${ownNs}">\` (I73 — ADR-0040). Add ` +
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
    // I70 — cohérence des références croisées via `static listens` et `static queries`
    const known = new Set(namespaces);
    for (const [ownNs, FeatureClass] of Object.entries(__classPrivateFieldGet(this, _Application_manifest, "f"))) {
        const cls = FeatureClass;
        const refs = [
            ...(cls.listens ?? []),
            ...(cls.queries ?? [])
        ].map((t) => t.namespace);
        for (const ref of refs) {
            if (!known.has(ref)) {
                throw new BonsaiNamespaceError("NAMESPACE_UNKNOWN_REFERENCE", `Feature "${ownNs}" declares unknown channel "${ref}". ` +
                    `Known namespaces: ${namespaces.join(", ")}`);
            }
        }
    }
};

export { Application };
