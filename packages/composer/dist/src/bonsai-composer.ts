/**
 * @bonsai/composer - Version 0.0.1
 * Bundled by Bonsai Build System
 * Date: 2026-05-07T09:44:50.651Z
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
 * Strate 0 — Capacités :
 *   - resolve(event | null) → TResolveResult | null (0/1 View)
 *   - Slot DOM immutable fourni par le parent (Foundation ou View)
 *   - Machine à états minimal : idle → active → idle
 *   - Création d'élément DOM si absent (D30)
 *   - Diff de transitions §3.1 (5 cas Same/New/null) sans recréation inutile
 *
 * Invariants :
 *   I20  — Seuls Foundation/Composers créent/détruisent des Views
 *   I35  — Composer n'a aucune écriture DOM (lecture scope autorisée)
 *   I37  — Un seul type de Composer, gère 0/1 Views en strate 0
 *   I40  — Scope DOM d'une View exclut les sous-arbres des slots déclarés
 *
 * ADRs :
 *   ADR-0024 — get params() value-first (strate 0 : pas de listen/request)
 *   ADR-0025 — Pas de lifecycle hooks (ni onMount, ni onUnmount, ni onAttach)
 *   ADR-0026 — rootElement = string CSS selector only
 *   ADR-0027 — resolve(event) unique point d'entrée, pas de state local
 *
 * Diff §3.1 (RFC composer.md) :
 *   | resolve() retourne | View montée         | Action                                    |
 *   | ------------------ | ------------------- | ----------------------------------------- |
 *   | SameView+SameRoot  | SameView instance   | **No-op** (instance conservée)            |
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
        /** Sélecteur CSS du slot DOM — immutable (ADR-0020) */
        _Composer_rootElement.set(this, void 0);
        /** Référence au slot DOM résolu */
        _Composer_slot.set(this, null);
        /** La View actuellement montée (null si resolve() a retourné null) */
        _Composer_currentView.set(this, null);
        /**
         * Dernier résultat retourné par resolve() — sert de référence pour le diff §3.1.
         * Null si la dernière sortie était null (ou avant le premier resolve).
         */
        _Composer_currentResult.set(this, null);
        /** Machine à états minimal : idle → active → idle */
        _Composer_state.set(this, "idle");
        __classPrivateFieldSet(this, _Composer_rootElement, options.rootElement, "f");
    }
    // ─── Public API (framework only) ────────────────────────────────────
    /**
     * Le sélecteur rootElement (ADR-0026).
     */
    get rootElement() {
        return __classPrivateFieldGet(this, _Composer_rootElement, "f");
    }
    /**
     * Référence au slot DOM résolu. Null avant attach().
     */
    get slot() {
        return __classPrivateFieldGet(this, _Composer_slot, "f");
    }
    /**
     * La View actuellement montée, ou null.
     */
    get currentView() {
        return __classPrivateFieldGet(this, _Composer_currentView, "f");
    }
    /**
     * Attache le Composer à son slot DOM.
     * Appelé par le framework (Foundation ou Composer parent).
     * Résout le slot dans le DOM, puis appelle initialResolve().
     */
    attach(parentElement) {
        const el = parentElement.querySelector(__classPrivateFieldGet(this, _Composer_rootElement, "f"));
        if (!el) {
            // D30 — Créer l'élément si absent
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
     * Appelé par le framework quand un Event est dispatché sur un Channel écouté.
     * En strate 0, pas de listen déclaré — cette méthode est un point d'extension.
     */
    performResolve(event) {
        __classPrivateFieldGet(this, _Composer_instances, "m", _Composer_performResolve).call(this, event);
    }
}
_Composer_rootElement = new WeakMap(), _Composer_slot = new WeakMap(), _Composer_currentView = new WeakMap(), _Composer_currentResult = new WeakMap(), _Composer_state = new WeakMap(), _Composer_instances = new WeakSet(), _Composer_performResolve = function _Composer_performResolve(event) {
    const next = this.resolve(event);
    const prev = __classPrivateFieldGet(this, _Composer_currentResult, "f");
    // Transition 5 : null + null → no-op
    if (next === null && prev === null) {
        return;
    }
    // Transition 4 : null + instance → detach
    if (next === null) {
        __classPrivateFieldGet(this, _Composer_instances, "m", _Composer_detachCurrent).call(this);
        return;
    }
    // À ce stade, next !== null
    // Transition 1 : SameView + SameRoot + currentView → no-op
    // (instance conservée, aucun remount)
    if (prev !== null &&
        __classPrivateFieldGet(this, _Composer_currentView, "f") !== null &&
        prev.view === next.view &&
        prev.rootElement === next.rootElement) {
        return;
    }
    // Transition 3 : NewView + null → attach simple
    if (__classPrivateFieldGet(this, _Composer_currentView, "f") === null) {
        __classPrivateFieldGet(this, _Composer_instances, "m", _Composer_attachNew).call(this, next);
        return;
    }
    // Transition 2 : NewView (ou même viewClass mais rootElement différent)
    //                + instance existante → detach + attach
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
