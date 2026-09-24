/**
 * @bonsai/composer - Version 0.0.1
 * Bundled by Bonsai Build System
 * Date: 2026-09-24T20:07:47.933Z
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
 * @bonsai/composer — Composer abstract base class
 *
 * Delivered capabilities:
 *   - resolve(event | null) → TResolveResult | null (0/1 View)
 *   - Immutable DOM slot provided by the parent (Foundation or View)
 *   - Minimal state machine: idle → active → idle
 *   - Slot element created when missing (ADR-19)
 *   - §3.1 transition diff (5 Same/New/null cases), no needless re-creation
 *
 * Invariants:
 *   I20  — Only Foundation/Composers create or destroy Views
 *   I35  — A Composer never writes to the DOM (reading its scope is allowed)
 *   I37  — A single Composer type; manages 0/1 View today (N instances: stratum 1d)
 *   I40  — A View's DOM scope excludes the subtrees of its declared slots
 *
 * ADRs:
 *   ADR-14 — modular contract (`get features()`): not delivered yet, no listen/request
 *   ADR-18 — no lifecycle hooks (no onMount, onUnmount or onAttach)
 *   ADR-19 — rootElement is a CSS selector string only
 *   ADR-18 — resolve(event) is the single entry point, no local state
 *
 * §3.1 diff (docs/spec/4-couche-concrete/composer.md):
 *   | resolve() returns  | Mounted View        | Action                                    |
 *   | ------------------ | ------------------- | ----------------------------------------- |
 *   | SameView+SameRoot  | SameView instance   | **No-op** (instance kept)                 |
 *   | NewView (ou root)  | OldView instance    | **Detach** OldView → **Attach** NewView   |
 *   | NewView            | null                | **Attach** NewView                        |
 *   | null               | OldView instance    | **Detach** OldView                        |
 *   | null               | null                | **No-op**                                 |
 *
 * @packageDocumentation
 */
var _Composer_instances, _Composer_rootElement, _Composer_slot, _Composer_currentView, _Composer_currentResult, _Composer_state, _Composer_performResolve, _Composer_attachNew, _Composer_detachCurrent, _Composer_createElementFromSelector;
// ─── Composer abstract class ─────────────────────────────────────────────────
class Composer {
    constructor(options) {
        _Composer_instances.add(this);
        /** CSS selector of the DOM slot — immutable (ADR-18) */
        _Composer_rootElement.set(this, void 0);
        /** Resolved DOM slot */
        _Composer_slot.set(this, null);
        /** Currently mounted View (null when resolve() returned null) */
        _Composer_currentView.set(this, null);
        /**
         * Last result returned by resolve() — reference for the §3.1 diff.
         * Null when the last output was null (or before the first resolve).
         */
        _Composer_currentResult.set(this, null);
        /** Minimal state machine: idle → active → idle */
        _Composer_state.set(this, "idle");
        __classPrivateFieldSet(this, _Composer_rootElement, options.rootElement, "f");
    }
    // ─── Public API (framework only) ────────────────────────────────────
    /**
     * The rootElement selector (ADR-19).
     */
    get rootElement() {
        return __classPrivateFieldGet(this, _Composer_rootElement, "f");
    }
    /**
     * Resolved DOM slot. Null before attach().
     */
    get slot() {
        return __classPrivateFieldGet(this, _Composer_slot, "f");
    }
    /**
     * Currently mounted View, or null.
     */
    get currentView() {
        return __classPrivateFieldGet(this, _Composer_currentView, "f");
    }
    /**
     * Attaches the Composer to its DOM slot.
     * Called by the framework (Foundation or parent Composer).
     * Resolves the slot in the DOM, then runs the initial resolve.
     */
    attach(parentElement) {
        const el = parentElement.querySelector(__classPrivateFieldGet(this, _Composer_rootElement, "f"));
        if (!el) {
            // ADR-19 — create the element when missing
            const created = __classPrivateFieldGet(this, _Composer_instances, "m", _Composer_createElementFromSelector).call(this, __classPrivateFieldGet(this, _Composer_rootElement, "f"));
            parentElement.appendChild(created);
            __classPrivateFieldSet(this, _Composer_slot, created, "f");
        }
        else {
            __classPrivateFieldSet(this, _Composer_slot, el, "f");
        }
        // Initial resolve — null event = bootstrap
        __classPrivateFieldGet(this, _Composer_instances, "m", _Composer_performResolve).call(this, null);
    }
    /**
     * Called by the framework when an Event is dispatched on a listened Channel.
     * No listen declaration exists yet, so only tests call it today (ADR-18).
     */
    performResolve(event) {
        __classPrivateFieldGet(this, _Composer_instances, "m", _Composer_performResolve).call(this, event);
    }
}
_Composer_rootElement = new WeakMap(), _Composer_slot = new WeakMap(), _Composer_currentView = new WeakMap(), _Composer_currentResult = new WeakMap(), _Composer_state = new WeakMap(), _Composer_instances = new WeakSet(), _Composer_performResolve = function _Composer_performResolve(event) {
    const next = this.resolve(event);
    const prev = __classPrivateFieldGet(this, _Composer_currentResult, "f");
    // Transition 5: null + null → no-op
    if (next === null && prev === null) {
        return;
    }
    // Transition 4: null + instance → detach
    if (next === null) {
        __classPrivateFieldGet(this, _Composer_instances, "m", _Composer_detachCurrent).call(this);
        return;
    }
    // From here on, next !== null
    // Transition 1: SameView + SameRoot + currentView → no-op
    // (instance kept, no remount)
    if (prev !== null &&
        __classPrivateFieldGet(this, _Composer_currentView, "f") !== null &&
        prev.view === next.view &&
        prev.rootElement === next.rootElement) {
        return;
    }
    // Transition 3: NewView + null → plain attach
    if (__classPrivateFieldGet(this, _Composer_currentView, "f") === null) {
        __classPrivateFieldGet(this, _Composer_instances, "m", _Composer_attachNew).call(this, next);
        return;
    }
    // Transition 2: NewView (or same view class with a different rootElement)
    //               + existing instance → detach + attach
    __classPrivateFieldGet(this, _Composer_instances, "m", _Composer_detachCurrent).call(this);
    __classPrivateFieldGet(this, _Composer_instances, "m", _Composer_attachNew).call(this, next);
}, _Composer_attachNew = function _Composer_attachNew(result) {
    const ViewClass = result.view;
    const view = new ViewClass();
    view.mount(result.rootElement);
    __classPrivateFieldSet(this, _Composer_currentView, view, "f");
    __classPrivateFieldSet(this, _Composer_currentResult, result, "f");
    __classPrivateFieldSet(this, _Composer_state, "active", "f");
}, _Composer_detachCurrent = function _Composer_detachCurrent() {
    __classPrivateFieldSet(this, _Composer_currentView, null, "f");
    __classPrivateFieldSet(this, _Composer_currentResult, null, "f");
    __classPrivateFieldSet(this, _Composer_state, "idle", "f");
}, _Composer_createElementFromSelector = function _Composer_createElementFromSelector(selector) {
    let tag = "div";
    const el = document.createElement(tag);
    // [attr='value'] or [attr="value"]
    const attrMatches = selector.matchAll(/\[([^\]=]+)(?:=["']([^"']*)["'])?\]/g);
    for (const match of attrMatches) {
        el.setAttribute(match[1], match[2] ?? "");
    }
    // .class
    const classMatch = selector.match(/\.([a-zA-Z0-9_-]+)/);
    if (classMatch) {
        el.classList.add(classMatch[1]);
    }
    // #id
    const idMatch = selector.match(/#([a-zA-Z0-9_-]+)/);
    if (idMatch) {
        el.id = idMatch[1];
    }
    return el;
};

export { Composer };
