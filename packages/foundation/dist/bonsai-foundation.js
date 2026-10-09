/**
 * @bonsai/foundation - Version 0.0.1
 * Bundled by Bonsai Build System
 * Date: 2026-09-24T20:07:51.210Z
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
 * Delivered capabilities:
 *   - body = document.body            (I33)
 *   - html = document.documentElement (N1 alteration right, ADR-20)
 *   - Declares the root Composers through abstract get composers()
 *     (Readonly<Record<string, typeof Composer>> — ADR-20)
 *   - Creates and attaches the Composers at bootstrap in insertion order
 *     (ES2015+ Object.entries guarantees string-key order)
 *   - onAttach() / onDetach() hooks
 *
 * Invariants:
 *   I33  — A single Foundation per application — targets <body>
 *   I20  — Only Foundation/Composers create or destroy Views
 *   I34  — A View's rootElement is a descendant of <body>, never <body>
 *   I67  — Structural stability of the Foundation (ADR-20)
 *   ADR-20 — the Foundation may alter html/body at N1 only
 *
 * Not delivered yet:
 *   - Declared global events (post-v1 track, docs/ROADMAP.md)
 *   - Global event delegation
 *   - Channel capabilities (form not decided)
 *
 * @packageDocumentation
 */
var _Foundation_body, _Foundation_html, _Foundation_composerInstances, _Foundation_attached;
// ─── Foundation abstract class ───────────────────────────────────────────────
class Foundation {
    constructor() {
        /** <body> — always document.body (I33) */
        _Foundation_body.set(this, void 0);
        /** <html> — N1 alteration right (ADR-20, foundation.md §2) */
        _Foundation_html.set(this, void 0);
        /** Root Composer instances created at bootstrap */
        _Foundation_composerInstances.set(this, []);
        /** Flag: Foundation already attached */
        _Foundation_attached.set(this, false);
        __classPrivateFieldSet(this, _Foundation_body, document.body, "f");
        __classPrivateFieldSet(this, _Foundation_html, document.documentElement, "f");
    }
    // ─── Public API ────────────────────────────────────────────────────────
    /**
     * <body> (foundation.md §1).
     * Developers may alter it at N1 only (classes, attributes) — ADR-20.
     */
    get body() {
        return __classPrivateFieldGet(this, _Foundation_body, "f");
    }
    /**
     * <html> (foundation.md §1).
     * Developers may alter it at N1 only (classes, attributes) — ADR-20.
     */
    get html() {
        return __classPrivateFieldGet(this, _Foundation_html, "f");
    }
    /**
     * The created Composer instances.
     */
    get composerInstances() {
        return __classPrivateFieldGet(this, _Foundation_composerInstances, "f");
    }
    /**
     * Attaches the Foundation: resolves and creates the root Composers.
     * Called once by Application.start().
     *
     * Iterates over Object.entries(this.composers) — insertion order of
     * non-numeric string keys is guaranteed by ES2015+ (§9.1.12).
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
     * Hook called once the root Composers are resolved.
     * Override it to add global DOM listeners (resize, scroll, etc.).
     * Default no-op.
     */
    onAttach() {
        // Default no-op
    }
    /**
     * Hook called at shutdown — counterpart of onAttach().
     * Override it to remove the global DOM listeners added in onAttach().
     * Default no-op.
     *
     * NB: not called yet — Application.stop() does not exist (stratum 1).
     */
    onDetach() {
        // Default no-op
    }
}
_Foundation_body = new WeakMap(), _Foundation_html = new WeakMap(), _Foundation_composerInstances = new WeakMap(), _Foundation_attached = new WeakMap();

export { Foundation };
