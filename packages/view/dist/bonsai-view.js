/**
 * @bonsai/view - Version 0.2.0
 * Bundled by Bonsai Build System
 * Date: 2026-11-04T20:36:10.808Z
 */
import { DESCRIBE, describeComponent } from '@bonsai/kernel';

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
 * @bonsai/view — View base class (ADR-14, migration lot M6.2)
 *
 * A View projects the domain onto the part of the document its Composer
 * attributed to it. It is a child of a Composer only (D11).
 *
 * Every handler receives a context as its second argument (D18):
 *   - `on{UiKey}{DomEvent}(fact, ctx: TFactContext)` — a fact of the host
 *     admitted in the View's part: `ctx.query` and `ctx.trigger`
 *   - `on{Ns}{Event}Event(payload, ctx: TEventContext)` — an Event of a Feature:
 *     `ctx.query` only. No `trigger`: an Event grants no right to command.
 *
 * A handler runs inside a validation unit (G7). Its projections (`getUI(key)`)
 * are *prepared* during the unit and engaged after it validates (C.3); a
 * handler therefore never reads the document.
 *
 * Declarations (read once, when the View is described to the kernel):
 *   1. `get features()`   — Features it listens to, queries and addresses
 *   2. `get uiEvents()`   — UI keys, their element subtype and host events
 *   3. `get uiElements()` — CSS selector of each key, inside the View's part
 *   4. `get template()`   — initial content of the part (HTML string; default empty)
 *   5. `get composers()`  — slots of the part and the Composer of each
 *
 * Removed with this lot: `this.trigger`, `this.request`, `mount()`, `onAttach()`,
 * and `TProjectionNode.element()` (a raw element contradicts I39 and cannot be
 * given before engagement).
 *
 * Invariants:
 *   I4  — A View NEVER has emit() — absent from the type
 *   I36 — A View never composes other Views directly (only declares Composers)
 *   I39 — DOM access only through getUI(key), as prepared effects
 *   I48 — Handlers are auto-discovered by naming convention
 *   I80 — No TChannelToken in the consumer public surface
 *   I81 — `features` / `uiEvents` / `uiElements` are the sources of truth
 *   I82 — Missing handler → compile error through `implements TViewCallbacks`
 *   I84 — A non-empty `events: [E, ...]` requires the matching DOM handlers
 *   I85 — `ui<TEl>()(events)` is the only TUIEntry helper (curried form)
 *   I86 — `events` is always present in TUIEntry (never optional)
 *   I87 — object key ≡ namespace of the referenced Feature
 *   I88 — Contract/Callbacks symmetry
 *   I89–I91 — events belong to TEventsFor<TEl> ⊆ keyof HTMLElementEventMap (ADR-15)
 *
 * Known limit (view.md §4.4): a projection receives the whole part, slot
 * contents included; writing there is forbidden by review, not by construction.
 *
 * @packageDocumentation
 */
var _View_instances, _a, _View_current, _View_selectors, _View_unit, _View_run, _View_methodNames, _View_eventContext, _View_factContext;
/**
 * Builder of a UI entry (I85 — the only mechanism).
 *
 * Encodes the TEl subtype through the `_el?` phantom and captures the runtime
 * events. The curried form keeps literal inference of `events` while `TEl` is
 * given explicitly (TypeScript limitation: `const T` on a parameter loses the
 * literal when another type parameter is passed explicitly with a default).
 *
 * Constraints (ADR-15):
 *  - `TEvts` ⊆ `TEventsFor<TEl>` — valid names + consistent semantics
 *  - `HasNoDuplicates<TEvts>` — forbids double addEventListener binding
 *
 * @example ui<HTMLButtonElement>()(["click"])           // interactive
 * @example ui<HTMLSpanElement>()([])                    // explicitly non-interactive
 * @example ui<HTMLInputElement>()(["input", "change"])  // 2 required handlers
 * @example ui<HTMLAnchorElement>()(["click"], { cancelDefault: ["click"] }) // link relayed to the router (D20)
 */
function ui() {
    return (events, options) => (options === undefined || options.cancelDefault.length === 0
        ? { events }
        : { events, cancelDefault: options.cancelDefault });
}
// ─── Internal helpers ────────────────────────────────────────────────────────
const capitalize = (s) => (s.length === 0 ? s : s[0].toUpperCase() + s.slice(1));
function parseNSKey(key) {
    const idx = key.indexOf(":");
    if (idx <= 0 || idx === key.length - 1) {
        throw new Error(`[Bonsai View] Malformed namespaced key "${key}". Expected "namespace:name".`);
    }
    return { namespace: key.slice(0, idx), name: key.slice(idx + 1) };
}
// ─── View abstract class (ADR-14) ─────────────────────────────────────────
/**
 * View — presentation layer parameterised by a single generic: `TViewContract`.
 *
 * ```ts
 * class CartView
 *   extends View<TCartViewContract>
 *   implements TViewCallbacks<TCartViewContract>
 * {
 *   get features()   { return cartViewFeatures; }
 *   get uiEvents()   { return cartViewUiEvents; }
 *   get uiElements() { return cartViewUiElements; }
 *   get template()   { return `<button data-ui="addButton">Add</button><span data-ui="itemCount"></span>`; }
 *
 *   onAddButtonClick(_fact: TFact, ctx: TFactContext<TCartViewContract>): void {
 *     ctx.trigger("cart:addItem", { productId: "p1", qty: 1, price: 10 });
 *   }
 *   onCartItemAddedEvent(payload: { item: TCartItem }, ctx: TEventContext<TCartViewContract>): void {
 *     this.getUI("itemCount").text(String(ctx.query("cart:getItemCount", null)));
 *   }
 * }
 * ```
 */
class View {
    constructor() {
        _View_instances.add(this);
        /** The unit context of the handler being run, for `getUI` and `params`. */
        _View_current.set(this, null);
        _View_selectors.set(this, {});
    }
    // ─── Optional declarations ──────────────────────────────────────────
    /** Initial content of the part (HTML). Projected when the part exists. */
    get template() {
        return "";
    }
    /**
     * Slots of the part and their Composers (Composer §1.3). Keys are disjoint
     * from the UI keys; each slot selector matches exactly one element of the
     * part, in the content produced by `template`.
     */
    get composers() {
        return {};
    }
    // ─── Handler-only API ───────────────────────────────────────────────
    /** Creation parameters given by the Composer, frozen (6.2). Only inside a handler. */
    get params() {
        return (__classPrivateFieldGet(this, _View_instances, "m", _View_unit).call(this, "params").params() ?? {});
    }
    /**
     * I39 — typed projection on a UI key. Every operation is *prepared*: it is
     * engaged after the unit validates (C.3). Only inside a handler.
     */
    getUI(key) {
        const c = __classPrivateFieldGet(this, _View_instances, "m", _View_unit).call(this, `getUI("${key}")`);
        const selector = __classPrivateFieldGet(this, _View_selectors, "f")[key];
        if (selector === undefined) {
            throw new Error(`[Bonsai View] Unknown UI key "${key}". Declared keys: ${Object.keys(__classPrivateFieldGet(this, _View_selectors, "f")).join(", ")}`);
        }
        const part = c.resolve(c.designation());
        const write = (label, apply) => {
            c.project(part, `${key}.${label}`, (root) => {
                const el = root.querySelector(selector);
                if (el === null)
                    throw new Error(`[Bonsai View] UI element "${key}" not found with selector "${selector}" in the part`);
                apply(el);
            });
        };
        return {
            text: (value) => write("text", (el) => { el.textContent = value; }),
            attr: (name, value) => write(`attr:${name}`, (el) => { el.setAttribute(name, value); }),
            toggleClass: (className, force) => write(`class:${className}`, (el) => { el.classList.toggle(className, force); }),
            visible: (show) => write("visible", (el) => { el.style.display = show ? "" : "none"; }),
            style: (property, value) => write(`style:${property}`, (el) => { el.style.setProperty(property, value); })
        };
    }
    // ─── Kernel description (internal) ─────────────────────────────────
    /** @internal Description given to the kernel by the Composer that creates the View. */
    [(_View_current = new WeakMap(), _View_selectors = new WeakMap(), _View_instances = new WeakSet(), DESCRIBE)]() {
        const features = this.features;
        const uiEvents = this.uiEvents;
        const selectors = this.uiElements;
        __classPrivateFieldSet(this, _View_selectors, selectors, "f");
        const methods = __classPrivateFieldGet(this, _View_instances, "m", _View_methodNames).call(this);
        const self = this;
        // I48 UI — one handler per declared (key, event); a missing one is a safety net (I84).
        const domTypes = new Map();
        const cancelled = new Map();
        for (const [uiKey, entry] of Object.entries(uiEvents)) {
            if (entry.events.length === 0)
                continue;
            const selector = selectors[uiKey];
            if (selector === undefined) {
                throw new Error(`[Bonsai View] UI key "${uiKey}" declared in uiEvents but missing in uiElements.`);
            }
            for (const domEvent of entry.events) {
                const handlerName = `on${capitalize(uiKey)}${capitalize(domEvent)}`;
                if (!methods.includes(handlerName)) {
                    throw new Error(`[Bonsai View] Missing handler "${handlerName}" for declared event "${domEvent}" on ui.${uiKey}. ` +
                        `Add the method or remove "${domEvent}" from uiEvents.${uiKey}.events.`);
                }
                const keys = domTypes.get(domEvent) ?? {};
                keys[uiKey] = selector;
                domTypes.set(domEvent, keys);
            }
            // D20 — the default action is cancelled by declaration only, for a declared event.
            for (const domEvent of entry.cancelDefault ?? []) {
                if (!entry.events.includes(domEvent)) {
                    throw new Error(`[Bonsai View] ui.${uiKey} cancels the default action of "${domEvent}", which it does not declare in events (D20).`);
                }
                const keys = cancelled.get(domEvent) ?? [];
                keys.push(uiKey);
                cancelled.set(domEvent, keys);
            }
        }
        const dom = {};
        for (const [type, keys] of domTypes) {
            const cancelDefault = cancelled.get(type);
            dom[type] = cancelDefault === undefined ? { local: "fact", keys } : { local: "fact", keys, cancelDefault };
        }
        // I48 channel — on{NS}{Event}Event for each listened Event.
        const listens = [];
        for (const [namespace, entry] of Object.entries(features)) {
            for (const event of entry.listens) {
                const handlerName = `on${capitalize(namespace)}${capitalize(event)}Event`;
                if (typeof self[handlerName] !== "function") {
                    throw new Error(`[Bonsai View] Missing handler "${handlerName}" for declared listen "${namespace}:${event}". ` +
                        `Add the method or remove "${event}" from features.${namespace}.listens.`);
                }
                listens.push({
                    namespace,
                    event,
                    handler: (payload, c) => __classPrivateFieldGet(this, _View_instances, "m", _View_run).call(this, c, () => self[handlerName](payload, __classPrivateFieldGet(this, _View_instances, "m", _View_eventContext).call(this, c)))
                });
            }
        }
        return {
            name: this.constructor.name,
            ui: true,
            dom,
            listens,
            locals: {
                fact: (payload, c) => {
                    const fact = payload;
                    if (fact.ui === null || !uiEvents[fact.ui]?.events.includes(fact.type))
                        return;
                    const handlerName = `on${capitalize(fact.ui)}${capitalize(fact.type)}`;
                    __classPrivateFieldGet(this, _View_instances, "m", _View_run).call(this, c, () => self[handlerName](fact, __classPrivateFieldGet(this, _View_instances, "m", _View_factContext).call(this, c)));
                }
            },
            init: (c) => {
                __classPrivateFieldGet(this, _View_instances, "m", _View_run).call(this, c, () => {
                    const part = c.resolve(c.designation());
                    const template = this.template;
                    if (template !== "")
                        c.project(part, "template", (el) => { el.innerHTML = template; });
                    for (const [key, { slot, composer }] of Object.entries(this.composers)) {
                        if (key in uiEvents)
                            throw new Error(`[Bonsai View] slot key "${key}" collides with a UI key (D13)`);
                        const ComposerClass = composer;
                        c.create(describeComponent(new ComposerClass()), { part: { resource: part, portion: key, host: slot } });
                    }
                });
            }
        };
    }
}
_a = View, _View_unit = function _View_unit(operation) {
    if (__classPrivateFieldGet(this, _View_current, "f") === null) {
        throw new Error(`[Bonsai View] ${operation} is usable only inside a handler of the View (C.3)`);
    }
    return __classPrivateFieldGet(this, _View_current, "f");
}, _View_run = function _View_run(c, fn) {
    const previous = __classPrivateFieldGet(this, _View_current, "f");
    __classPrivateFieldSet(this, _View_current, c, "f");
    try {
        return fn();
    }
    finally {
        __classPrivateFieldSet(this, _View_current, previous, "f");
    }
}, _View_methodNames = function _View_methodNames() {
    const names = new Set();
    for (let proto = Object.getPrototypeOf(this); proto !== null && proto !== _a.prototype; proto = Object.getPrototypeOf(proto)) {
        for (const name of Object.getOwnPropertyNames(proto))
            names.add(name);
    }
    return [...names];
}, _View_eventContext = function _View_eventContext(c) {
    return {
        cause: c.cause,
        query: ((key, params) => {
            const { namespace, name } = parseNSKey(key);
            return c.query(namespace, name, params);
        })
    };
}, _View_factContext = function _View_factContext(c) {
    return {
        ...__classPrivateFieldGet(this, _View_instances, "m", _View_eventContext).call(this, c),
        trigger: ((key, payload) => {
            const { namespace, name } = parseNSKey(key);
            c.trigger(namespace, name, payload);
        })
    };
};

export { View, ui };
