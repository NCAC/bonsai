/**
 * @bonsai/foundation - Version 0.0.1
 * Bundled by Bonsai Build System
 * Date: 2026-05-07T09:44:55.167Z
 */
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
 * @bonsai/foundation — Foundation abstract base class
 *
 * Strate 0 — Capacités :
 *   - body  = document.body            (toujours en strate 0, I33)
 *   - html  = document.documentElement (droit d'altération N1, D27)
 *   - Déclare les Composers racines via abstract get composers()
 *     (Readonly<Record<string, typeof Composer>> — ADR-0038)
 *   - Crée et attache les Composers au bootstrap dans l'ordre d'insertion
 *     (ES2015+ Object.entries garantit l'ordre des clés string)
 *   - Hooks onAttach() / onDetach()
 *
 * Invariants :
 *   I33  — Foundation unique par application — cible <body>
 *   I20  — Seuls Foundation/Composers créent/détruisent des Views
 *   I34  — rootElement d'une View = enfant de <body>, jamais <body>
 *   I67  — Stabilité structurelle de Foundation (ADR-0038)
 *   D27  — Foundation peut altérer html/body en N1 uniquement
 *
 * Strate 0 simplifications (ADR-0028) :
 *   - Pas de TUIMap (ADR-0018 Suspended)
 *   - Pas d'event delegation globale (strate 1)
 *   - Pas de params() Channel capabilities (strate 1)
 *
 * @packageDocumentation
 */
var _Foundation_body, _Foundation_html, _Foundation_composerInstances, _Foundation_attached;
// ─── Foundation abstract class ───────────────────────────────────────────────
class Foundation {
    constructor() {
        /** Référence à <body> — toujours document.body en strate 0 (I33) */
        _Foundation_body.set(this, void 0);
        /** Référence à <html> — droit d'altération N1 (D27, RFC foundation.md §2) */
        _Foundation_html.set(this, void 0);
        /** Les instances de Composers racines créées au bootstrap */
        _Foundation_composerInstances.set(this, []);
        /** Flag : Foundation déjà attachée */
        _Foundation_attached.set(this, false);
        __classPrivateFieldSet(this, _Foundation_body, document.body, "f");
        __classPrivateFieldSet(this, _Foundation_html, document.documentElement, "f");
    }
    // ─── Public API ────────────────────────────────────────────────────────
    /**
     * Référence à <body> — alignement RFC foundation.md §1.
     * Le développeur peut altérer en N1 (classes, attributs) — D27.
     */
    get body() {
        return __classPrivateFieldGet(this, _Foundation_body, "f");
    }
    /**
     * Référence à <html> — alignement RFC foundation.md §1.
     * Le développeur peut altérer en N1 (classes, attributs) — D27.
     */
    get html() {
        return __classPrivateFieldGet(this, _Foundation_html, "f");
    }
    /**
     * Les Composer instances créées.
     */
    get composerInstances() {
        return __classPrivateFieldGet(this, _Foundation_composerInstances, "f");
    }
    /**
     * Attache la Foundation : résout et crée les Composers racines.
     * Appelé une seule fois par Application.start().
     *
     * Itère sur Object.entries(this.composers) — l'ordre d'insertion des
     * clés string non numériques est garanti par ES2015+ (§9.1.12).
     */
    attach() {
        if (__classPrivateFieldGet(this, _Foundation_attached, "f")) {
            throw new Error("[Bonsai Foundation] Foundation already attached — I33 singleton violated");
        }
        __classPrivateFieldSet(this, _Foundation_attached, true, "f");
        const composersMap = this.composers;
        for (const [selector, ComposerCtor] of Object.entries(composersMap)) {
            const ComposerClass = ComposerCtor;
            const instance = new ComposerClass({ rootElement: selector });
            instance.attach(__classPrivateFieldGet(this, _Foundation_body, "f"));
            __classPrivateFieldGet(this, _Foundation_composerInstances, "f").push(instance);
        }
        this.onAttach();
    }
    // ─── Lifecycle hooks ───────────────────────────────────────────────────
    /**
     * Hook appelé après résolution des Composers racines.
     * Surcharger pour brancher des écouteurs DOM globaux (resize, scroll, etc.).
     * Default no-op.
     */
    onAttach() {
        // Default no-op
    }
    /**
     * Hook appelé au shutdown — symétrique de onAttach().
     * Surcharger pour débrancher les écouteurs DOM globaux installés dans onAttach().
     * Default no-op.
     *
     * NB : non invoqué automatiquement en strate 0 (pas de shutdown formalisé) ;
     * point d'extension pour la strate 1.
     */
    onDetach() {
        // Default no-op
    }
}
_Foundation_body = new WeakMap(), _Foundation_html = new WeakMap(), _Foundation_composerInstances = new WeakMap(), _Foundation_attached = new WeakMap();

export { Foundation };
