/**
 * @bonsai/view - Version 0.0.1
 * Bundled by Bonsai Build System
 * Date: 2026-09-24T20:13:10.578Z
 */
import { Radio } from '@bonsai/event';

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
 * @bonsai/view — View base class (ADR-14)
 *
 * Capabilities:
 *   - trigger("ns:cmd", payload) → sends a typed Command through the Channel
 *   - request("ns:req", params)  → queries a typed Channel
 *   - getUI(key) → TProjectionNode<TEl>, typed to the HTMLElement subtype (phantom)
 *   - I48 channel auto-discovery: on{NS}{Event}Event → channel.listen
 *   - I48 UI auto-discovery     : on{UIKey}{DomEvent} → addEventListener
 *   - onAttach() lifecycle hook
 *
 * ADR-14 modular pattern:
 *   1. `const features satisfies TFeatureContract` — Feature-grouped
 *   2. `const uiEvents satisfies TUIContract`      — DOM events + phantom TEl
 *   3. `const uiElements satisfies TUIElements<typeof uiEvents>` — selectors
 *   4. `type TVC = TViewContract<typeof features, typeof uiEvents>`
 *   5. `class XxxView extends View<TVC> implements TViewCallbacks<TVC>`
 *
 * Three abstract getters:
 *   - `get features()`   → Feature refs + lanes (structural, not overridable)
 *   - `get uiEvents()`   → DOM events + phantom TEl (structural)
 *   - `get uiElements()` → CSS selectors (overridable by the Composer, ADR-21 — not delivered)
 *
 * The Channel stays private behind its Feature (I80) — no `TChannelToken` in
 * the public surface.
 *
 * Invariants:
 *   I4  — A View NEVER has emit() — absent from the type
 *   I31 — rootElement is a CSS selector string injected at mount
 *   I36 — A View never composes other Views directly
 *   I39 — DOM access only through getUI(key)
 *   I40 — DOM scope: resolution inside rootElement only
 *   I48 — Handlers are auto-discovered by naming convention
 *   I75 — No `any` in the public surface; internal casts are documented
 *   I80 — No TChannelToken in the consumer public surface
 *   I81 — `features` / `uiEvents` / `uiElements` are the sources of truth
 *   I82 — Missing handler → compile error through `implements TViewCallbacks`
 *   I83 — Reusable modular `T{Component}Contract` pattern
 *   I84 — A non-empty `events: [E, ...]` requires the matching DOM handlers
 *   I85 — `ui<TEl>()(events)` is the only TUIEntry helper (curried form)
 *   I86 — `events` is always present in TUIEntry (never optional); ReadonlyArray<TEventsFor<TEl>> without duplicates
 *   I87 — object key ≡ namespace of the referenced Feature
 *   I88 — Contract/Callbacks symmetry
 *   I89 — every declared event name belongs to TEventsFor<TEl> ⊆ keyof HTMLElementEventMap (ADR-15)
 *   I90 — no duplicate in TUIEntry["events"] — double binding forbidden (ADR-15)
 *   I91 — TEventsFor<TEl> is Bonsai's official element → events mapping (ADR-15)
 *
 * @packageDocumentation
 */
var _View_instances, _View_rootElement, _View_rootEl, _View_mounted, _View_uiSelectors, _View_uiDomEvents, _View_features, _View_registerUIHandlers, _View_registerChannelListeners;
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
 */
function ui() {
    return (events) => ({ events });
}
// ─── ProjectionNode factory ──────────────────────────────────────────────────
function createProjectionNode(el) {
    return {
        text(value) {
            el.textContent = value;
        },
        attr(name, value) {
            el.setAttribute(name, value);
        },
        toggleClass(className, force) {
            el.classList.toggle(className, force);
        },
        visible(show) {
            el.style.display = show ? "" : "none";
        },
        style(property, value) {
            el.style.setProperty(property, value);
        },
        element() {
            return el;
        }
    };
}
// ─── Internal helpers ────────────────────────────────────────────────────────
function capitalize(s) {
    return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}
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
 * Usage pattern:
 *
 * ```ts
 * import { CartFeature } from "../Cart/cart.feature";
 * import { View, ui, type TViewContract, type TViewCallbacks,
 *   type TFeatureContract, type TUIContract, type TUIElements
 * } from "@bonsai/view";
 *
 * const cartViewFeatures = {
 *   cart: {
 *     feature:  CartFeature,
 *     listens:  ["itemAdded"]  as const,
 *     triggers: ["addItem"]    as const,
 *     requests: []             as const,
 *   },
 * } satisfies TFeatureContract;
 *
 * const cartViewUiEvents = {
 *   total:  ui<HTMLSpanElement>()([]),
 *   addBtn: ui<HTMLButtonElement>()(["click"]),
 * } satisfies TUIContract;
 *
 * const cartViewUiElements = {
 *   total:  ".cart-total",
 *   addBtn: "#add-btn",
 * } satisfies TUIElements<typeof cartViewUiEvents>;
 *
 * type TCartViewContract = TViewContract<
 *   typeof cartViewFeatures,
 *   typeof cartViewUiEvents
 * >;
 *
 * class CartView
 *   extends View<TCartViewContract>
 *   implements TViewCallbacks<TCartViewContract>
 * {
 *   get features()   { return cartViewFeatures; }
 *   get uiEvents()   { return cartViewUiEvents; }
 *   get uiElements() { return cartViewUiElements; }
 *
 *   onCartItemAddedEvent(p: { id: string; qty: number }): void {
 *     this.getUI("total").text(`${p.qty} items`);  // → TProjectionNode<HTMLSpanElement>
 *   }
 *   onAddBtnClick(e: MouseEvent): void {
 *     this.trigger("cart:addItem", { id: "p1", qty: 1 });  // ✅ inferred payload
 *   }
 * }
 * ```
 */
class View {
    constructor() {
        _View_instances.add(this);
        _View_rootElement.set(this, null);
        _View_rootEl.set(this, null);
        _View_mounted.set(this, false);
        _View_uiSelectors.set(this, {});
        _View_uiDomEvents.set(this, {});
        _View_features.set(this, {});
    }
    // ─── Public API ────────────────────────────────────────────────────────
    /** The rootElement selector injected at mount (I31). */
    get rootElement() {
        return __classPrivateFieldGet(this, _View_rootElement, "f");
    }
    /**
     * Root DOM element after mount. Available in onAttach() and in handlers —
     * lets subclasses read data-* attributes (I34).
     */
    get el() {
        return __classPrivateFieldGet(this, _View_rootEl, "f");
    }
    /**
     * Mounts the View on a rootElement. Called by the Composer.
     * - Reads `get features()` / `get uiEvents()` / `get uiElements()` once (ADR-14)
     * - Resolves the rootElement in the DOM (whole document today, not the
     *   Composer's slot — ADR-19 gap)
     * - Auto-discovers the UI handlers (I48 UI — driven by uiEvents[k].events)
     * - Auto-discovers the Channel listeners (I48 channel — driven by features[NS].listens)
     * - Calls onAttach()
     */
    mount(rootSelector) {
        if (__classPrivateFieldGet(this, _View_mounted, "f"))
            return;
        __classPrivateFieldSet(this, _View_mounted, true, "f");
        // ADR-14: contract modules are read once
        __classPrivateFieldSet(this, _View_features, this.features, "f");
        __classPrivateFieldSet(this, _View_uiSelectors, this.uiElements, "f");
        // Extract DOM events per UI key (runtime, ADR-15)
        const uiEvents = this.uiEvents;
        const domEventsMap = {};
        for (const key of Object.keys(uiEvents)) {
            domEventsMap[key] = uiEvents[key].events;
        }
        __classPrivateFieldSet(this, _View_uiDomEvents, domEventsMap, "f");
        __classPrivateFieldSet(this, _View_rootElement, rootSelector, "f");
        __classPrivateFieldSet(this, _View_rootEl, document.querySelector(rootSelector), "f");
        // I34: rootElement must not be document.body itself
        if (__classPrivateFieldGet(this, _View_rootEl, "f") === document.body) {
            throw new Error(`[Bonsai View] I34 — rootElement cannot be document.body. Provide a child element selector.`);
        }
        // Auto-discovery
        __classPrivateFieldGet(this, _View_instances, "m", _View_registerUIHandlers).call(this);
        __classPrivateFieldGet(this, _View_instances, "m", _View_registerChannelListeners).call(this);
        // Lifecycle
        this.onAttach();
    }
    /**
     * I39 — typed DOM access through `getUI(key)`. Resolves inside the
     * rootElement scope (I40; slot exclusion not delivered yet).
     * Returns `TProjectionNode<TEl>`, where `TEl` comes from the `_el?` phantom
     * of the declared UI entry — `element()` returns the actual HTML subtype.
     */
    getUI(key) {
        const selector = __classPrivateFieldGet(this, _View_uiSelectors, "f")[key];
        if (!selector) {
            throw new Error(`[Bonsai View] Unknown UI key "${key}". Declared keys: ${Object.keys(__classPrivateFieldGet(this, _View_uiSelectors, "f")).join(", ")}`);
        }
        const el = __classPrivateFieldGet(this, _View_rootEl, "f").querySelector(selector);
        if (!el) {
            throw new Error(`[Bonsai View] UI element "${key}" not found with selector "${selector}" in rootElement "${__classPrivateFieldGet(this, _View_rootElement, "f")}"`);
        }
        return createProjectionNode(el);
    }
    /**
     * Sends a typed Command through the Channel (I4 — a View can only send).
     *
     * `key` is a namespaced `"ns:cmd"` key; it must belong to
     * `TFlatTriggers<TVC["features"]>`, otherwise a compile error.
     * `protected` — subclasses call it from their UI handlers.
     */
    trigger(key, payload) {
        const { namespace, name } = parseNSKey(key);
        // Cast to the untyped Channel to register by string (I75).
        const ch = Radio.me().channel(namespace);
        ch.trigger(name, payload);
    }
    /**
     * Performs a typed synchronous Request to a declared Channel.
     * Returns the typed result, or `null` when the owning Feature registered
     * no replier (ADR-02).
     *
     * `key` is a namespaced `"ns:req"` key; it must belong to
     * `TFlatRequests<TVC["features"]>`, otherwise a compile error.
     */
    request(key, params) {
        const { namespace, name } = parseNSKey(key);
        // Cast to the untyped Channel to register by string (I75).
        const ch = Radio.me().channel(namespace);
        return ch.request(name, params);
    }
    // ─── Lifecycle hooks ───────────────────────────────────────────────────
    /** Hook called after mount. Override it in subclasses. */
    onAttach() {
        // Default no-op
    }
}
_View_rootElement = new WeakMap(), _View_rootEl = new WeakMap(), _View_mounted = new WeakMap(), _View_uiSelectors = new WeakMap(), _View_uiDomEvents = new WeakMap(), _View_features = new WeakMap(), _View_instances = new WeakSet(), _View_registerUIHandlers = function _View_registerUIHandlers() {
    const proto = Object.getPrototypeOf(this);
    const methods = Object.getOwnPropertyNames(proto);
    for (const uiKey of Object.keys(__classPrivateFieldGet(this, _View_uiDomEvents, "f"))) {
        const events = __classPrivateFieldGet(this, _View_uiDomEvents, "f")[uiKey];
        if (events.length === 0)
            continue; // non-interactive
        const uiKeyPascal = capitalize(uiKey);
        const selector = __classPrivateFieldGet(this, _View_uiSelectors, "f")[uiKey];
        if (!selector) {
            throw new Error(`[Bonsai View] UI key "${uiKey}" declared in uiEvents but missing in uiElements.`);
        }
        const el = __classPrivateFieldGet(this, _View_rootEl, "f").querySelector(selector);
        if (!el)
            continue; // no element = no listener (silent)
        for (const domEvent of events) {
            const handlerName = `on${uiKeyPascal}${capitalize(domEvent)}`;
            if (!methods.includes(handlerName)) {
                throw new Error(`[Bonsai View] Missing handler "${handlerName}" for declared event "${domEvent}" on ui.${uiKey}. ` +
                    `Add the method or remove "${domEvent}" from uiEvents.${uiKey}.events.`);
            }
            el.addEventListener(domEvent, (event) => {
                this[handlerName](event);
            });
        }
    }
}, _View_registerChannelListeners = function _View_registerChannelListeners() {
    for (const namespace of Object.keys(__classPrivateFieldGet(this, _View_features, "f"))) {
        const entry = __classPrivateFieldGet(this, _View_features, "f")[namespace];
        const listens = entry.listens;
        if (listens.length === 0)
            continue;
        const ch = Radio.me().channel(namespace);
        for (const eventName of listens) {
            const handlerName = `on${capitalize(namespace)}${capitalize(eventName)}Event`;
            const handler = this[handlerName];
            if (typeof handler !== "function") {
                throw new Error(`[Bonsai View] Missing handler "${handlerName}" for declared listen "${namespace}:${eventName}". ` +
                    `Add the method or remove "${eventName}" from features.${namespace}.listens.`);
            }
            ch.listen(eventName, (payload) => {
                handler.call(this, payload);
            });
        }
    }
};

export { View, ui };
