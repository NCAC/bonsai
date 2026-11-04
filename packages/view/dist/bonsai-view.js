/**
 * @bonsai/view - Version 0.2.0
 * Bundled by Bonsai Build System
 * Date: 2026-11-04T22:22:09.639Z
 */
import { DESCRIBE, describeComponent } from '@bonsai/kernel';
import { BonsaiError } from '@bonsai/error';

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
 * ProjectionList — keyed reconciliation of a list of items (ADR-23, 5-rendu §6).
 *
 * Used inside a `TProjectionTemplate`: built in `setup()`, reconciled in
 * `project()`. It therefore runs only when the projection is engaged, after
 * the unit validates (C.3), and adds no listener: the View's part already
 * delegates one listener per declared event type, and the item touched is
 * identified by a value captured with the fact (`data`, C.5).
 *
 * @packageDocumentation
 */
var _a$1, _ProjectionList_container, _ProjectionList_options, _ProjectionList_entries, _ProjectionList_duplicate;
/**
 * Keyed list over the element children of a container. At construction it
 * adopts the children carrying `keyAttr` — those `create()` of the template
 * just produced, or a server rendering (ADR-24) — without recreating them.
 */
class ProjectionList {
    constructor(container, options) {
        _ProjectionList_container.set(this, void 0);
        _ProjectionList_options.set(this, void 0);
        _ProjectionList_entries.set(this, new Map());
        __classPrivateFieldSet(this, _ProjectionList_container, container, "f");
        __classPrivateFieldSet(this, _ProjectionList_options, options, "f");
        for (const child of Array.from(container.children)) {
            const key = child.getAttribute(options.keyAttr);
            if (key === null)
                continue;
            if (__classPrivateFieldGet(this, _ProjectionList_entries, "f").has(key))
                throw __classPrivateFieldGet(_a$1, _a$1, "m", _ProjectionList_duplicate).call(_a$1, key);
            const el = child;
            __classPrivateFieldGet(this, _ProjectionList_entries, "f").set(key, { el, nodes: options.setup(el) });
        }
    }
    /**
     * Reconciles the container with `items`, in this order: updates known items,
     * moves only misplaced ones (`insertBefore`), creates new ones, removes the
     * elements whose key is gone. O(n) through the map of keys.
     */
    reconcile(items) {
        const { keyAttr, key, create, setup, update } = __classPrivateFieldGet(this, _ProjectionList_options, "f");
        const container = __classPrivateFieldGet(this, _ProjectionList_container, "f");
        const seen = new Set();
        let previous = null;
        items.forEach((item, index) => {
            const k = key(item);
            if (seen.has(k))
                throw __classPrivateFieldGet(_a$1, _a$1, "m", _ProjectionList_duplicate).call(_a$1, k);
            seen.add(k);
            let entry = __classPrivateFieldGet(this, _ProjectionList_entries, "f").get(k);
            if (entry === undefined) {
                const el = create(item);
                el.setAttribute(keyAttr, k);
                entry = { el, nodes: setup(el) };
                __classPrivateFieldGet(this, _ProjectionList_entries, "f").set(k, entry);
            }
            const expected = previous === null ? container.firstElementChild : previous.nextElementSibling;
            if (entry.el !== expected)
                container.insertBefore(entry.el, expected);
            update(entry.nodes, item, index);
            previous = entry.el;
        });
        for (const [k, entry] of __classPrivateFieldGet(this, _ProjectionList_entries, "f")) {
            if (seen.has(k))
                continue;
            entry.el.remove();
            __classPrivateFieldGet(this, _ProjectionList_entries, "f").delete(k);
        }
    }
    /** Nodes of an item by its key. */
    nodes(key) {
        return __classPrivateFieldGet(this, _ProjectionList_entries, "f").get(key)?.nodes;
    }
}
_a$1 = ProjectionList, _ProjectionList_container = new WeakMap(), _ProjectionList_options = new WeakMap(), _ProjectionList_entries = new WeakMap(), _ProjectionList_duplicate = function _ProjectionList_duplicate(key) {
    return new BonsaiError("DUPLICATE_KEY", `duplicate key "${key}" in a list.`, {
        component: "ProjectionList",
        suggestion: "Each item needs a unique key (key / keyAttr)."
    });
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
 *   6. `get templates()`  — template bindings (N2/N3, ADR-26): the Query that
 *      feeds each zone and the Events that re-run it
 *
 * Removed with this lot: `this.trigger`, `this.request`, `mount()`, `onAttach()`,
 * and `TProjectionNode.element()` (a raw element contradicts I39 and cannot be
 * given before engagement).
 *
 * Invariants:
 *   I4  — A View NEVER has emit() — absent from the type
 *   I36 — A View never composes other Views directly (only declares Composers)
 *   I39 — DOM access only through getUI(key) or a template binding, as prepared effects
 *   I41 — A key covered by a template binding is not a target of getUI(key)
 *   I48 — Handlers are auto-discovered by naming convention
 *   I80 — No TChannelToken in the consumer public surface
 *   I81 — `features` / `uiEvents` / `uiElements` are the sources of truth
 *   I82 — Missing handler → compile error through `implements TViewCallbacks`;
 *         optional for an Event cited in the `on` of a template binding (ADR-26)
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
var _View_instances, _a, _View_current, _View_selectors, _View_templated, _View_projected, _View_nodes, _View_checkTemplates, _View_projectBindings, _View_remember, _View_container, _View_unit, _View_run, _View_methodNames, _View_eventContext, _View_factContext;
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
 * @example ui<HTMLButtonElement>()(["click"], { data: ["itemId"] })  // fact.data.itemId (ADR-23)
 */
function ui() {
    return (events, options) => {
        const entry = { events };
        if (options?.cancelDefault !== undefined && options.cancelDefault.length > 0)
            entry.cancelDefault = options.cancelDefault;
        if (options?.data !== undefined && options.data.length > 0)
            entry.data = options.data;
        return entry;
    };
}
/**
 * Typed binding helper (ADR-26): `select` receives the result of the Query,
 * the template receives the output of `select`, and `on` keeps its literal
 * keys for `TViewCallbacks`.
 *
 * ```ts
 * const items = bind<TCartViewContract>()({
 *   template: CartItemsTemplate,
 *   query: "cart:items",
 *   on: ["cart:itemAdded", "cart:itemRemoved"],
 *   select: (items) => items.filter((i) => i.qty > 0)
 * });
 * ```
 */
function bind() {
    return (binding) => binding;
}
// ─── Internal helpers ────────────────────────────────────────────────────────
const capitalize = (s) => (s.length === 0 ? s : s[0].toUpperCase() + s.slice(1));
/** Shallow equality of two projected outputs (5-rendu §7bis R4). */
function shallowEqual(a, b) {
    if (Object.is(a, b))
        return true;
    if (typeof a !== "object" || typeof b !== "object" || a === null || b === null)
        return false;
    if (Array.isArray(a) !== Array.isArray(b))
        return false;
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length)
        return false;
    const ra = a;
    const rb = b;
    return ka.every((k) => Object.prototype.hasOwnProperty.call(rb, k) && Object.is(ra[k], rb[k]));
}
/** Identity of a Query asked with its parameters, for one pass; `null` when not comparable. */
function queryIdentity(query, params) {
    try {
        return `${query}\u0000${String(JSON.stringify(params))}`;
    }
    catch {
        return null;
    }
}
function parseNSKey(key) {
    const idx = key.indexOf(":");
    if (idx <= 0 || idx === key.length - 1) {
        throw new BonsaiError("MALFORMED_KEY", `Malformed namespaced key "${key}". Expected "namespace:name".`);
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
        /** Keys covered by a template binding (`root` covers the whole part), I41. */
        _View_templated.set(this, new Set());
        /**
         * Last output projected by each binding: confined local state of the View
         * (16.5), journaled so that a failed unit restores it (G7).
         */
        _View_projected.set(this, new Map());
        /** Nodes located by `setup()`, per container; read and written only at engagement (C.3). */
        _View_nodes.set(this, new WeakMap());
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
    /**
     * Template bindings (ADR-26): for each zone, the template, the declared
     * Query that feeds it and the Events that re-run it. `null` (default): no
     * template. Projected when the View is created, then after each Event of
     * an `on`, unless the output is shallow-equal to the last one projected.
     */
    get templates() {
        return null;
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
        if (__classPrivateFieldGet(this, _View_templated, "f").has(key) || __classPrivateFieldGet(this, _View_templated, "f").has("root")) {
            throw new BonsaiError("TEMPLATE_OWNED_KEY", `UI key "${key}" is covered by a template binding; getUI() cannot write there (I41).`, {
                component: this.constructor.name,
                suggestion: "Project this zone through its template, or remove the binding."
            });
        }
        const selector = __classPrivateFieldGet(this, _View_selectors, "f")[key];
        if (selector === undefined) {
            throw new BonsaiError("UNKNOWN_UI_KEY", `Unknown UI key "${key}". Declared keys: ${Object.keys(__classPrivateFieldGet(this, _View_selectors, "f")).join(", ")}`);
        }
        const part = c.resolve(c.designation());
        const write = (label, apply) => {
            c.project(part, `${key}.${label}`, (root) => {
                const el = root.querySelector(selector);
                if (el === null)
                    throw new BonsaiError("UI_ELEMENT_NOT_FOUND", `UI element "${key}" not found with selector "${selector}" in the part`);
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
    [(_View_current = new WeakMap(), _View_selectors = new WeakMap(), _View_templated = new WeakMap(), _View_projected = new WeakMap(), _View_nodes = new WeakMap(), _View_instances = new WeakSet(), DESCRIBE)]() {
        const features = this.features;
        const uiEvents = this.uiEvents;
        const selectors = this.uiElements;
        __classPrivateFieldSet(this, _View_selectors, selectors, "f");
        const initial = this.template;
        const bindings = __classPrivateFieldGet(this, _View_instances, "m", _View_checkTemplates).call(this, features, selectors, initial);
        const methods = __classPrivateFieldGet(this, _View_instances, "m", _View_methodNames).call(this);
        const self = this;
        // I48 UI — one handler per declared (key, event); a missing one is a safety net (I84).
        const domTypes = new Map();
        const cancelled = new Map();
        // ADR-23, C.5 — values captured with the facts of a key.
        const captured = {};
        for (const [uiKey, entry] of Object.entries(uiEvents)) {
            const data = entry.data ?? [];
            for (const name of data) {
                if (!/^[a-z][a-zA-Z]*$/.test(name)) {
                    throw new BonsaiError("MALFORMED_DATA_NAME", `ui.${uiKey} captures "${name}"; a captured name is camelCase letters (itemId → data-item-id).`, { component: this.constructor.name });
                }
            }
            if (data.length > 0) {
                if (entry.events.length === 0) {
                    throw new BonsaiError("DATA_WITHOUT_EVENT", `ui.${uiKey} captures ${data.join(", ")} but declares no event: no fact would carry them.`, { component: this.constructor.name });
                }
                captured[uiKey] = [...data];
            }
            if (entry.events.length === 0)
                continue;
            const selector = selectors[uiKey];
            if (selector === undefined) {
                throw new BonsaiError("MISSING_UI_ELEMENT", `UI key "${uiKey}" declared in uiEvents but missing in uiElements.`);
            }
            for (const domEvent of entry.events) {
                const handlerName = `on${capitalize(uiKey)}${capitalize(domEvent)}`;
                if (!methods.includes(handlerName)) {
                    throw new BonsaiError("MISSING_HANDLER", `Missing handler "${handlerName}" for declared event "${domEvent}" on ui.${uiKey}. ` +
                        `Add the method or remove "${domEvent}" from uiEvents.${uiKey}.events.`);
                }
                const keys = domTypes.get(domEvent) ?? {};
                keys[uiKey] = selector;
                domTypes.set(domEvent, keys);
            }
            // D20 — the default action is cancelled by declaration only, for a declared event.
            for (const domEvent of entry.cancelDefault ?? []) {
                if (!entry.events.includes(domEvent)) {
                    throw new BonsaiError("UNDECLARED_DEFAULT_CANCEL", `ui.${uiKey} cancels the default action of "${domEvent}", which it does not declare in events (D20).`);
                }
                const keys = cancelled.get(domEvent) ?? [];
                keys.push(uiKey);
                cancelled.set(domEvent, keys);
            }
        }
        const dom = {};
        for (const [type, keys] of domTypes) {
            const cancelDefault = cancelled.get(type);
            dom[type] = cancelDefault === undefined ? { local: "fact", keys, data: captured } : { local: "fact", keys, cancelDefault, data: captured };
        }
        // I48 channel — on{NS}{Event}Event for each listened Event, then one pass
        // on the bindings it re-runs (ADR-26). The handler is optional for an
        // Event cited in an `on` (I82 amended).
        const listens = [];
        for (const [namespace, entry] of Object.entries(features)) {
            for (const event of entry.listens) {
                const handlerName = `on${capitalize(namespace)}${capitalize(event)}Event`;
                const rerun = bindings.filter((b) => b.on.includes(`${namespace}:${event}`));
                const handler = typeof self[handlerName] === "function" ? self[handlerName] : null;
                if (handler === null && rerun.length === 0) {
                    throw new BonsaiError("MISSING_HANDLER", `Missing handler "${handlerName}" for declared listen "${namespace}:${event}". ` +
                        `Add the method, cite "${namespace}:${event}" in the \`on\` of a template binding, ` +
                        `or remove "${event}" from features.${namespace}.listens.`);
                }
                listens.push({
                    namespace,
                    event,
                    handler: (payload, c) => __classPrivateFieldGet(this, _View_instances, "m", _View_run).call(this, c, () => {
                        if (handler !== null)
                            handler.call(this, payload, __classPrivateFieldGet(this, _View_instances, "m", _View_eventContext).call(this, c));
                        if (rerun.length > 0)
                            __classPrivateFieldGet(this, _View_instances, "m", _View_projectBindings).call(this, c, rerun, false);
                    })
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
                    if (initial !== "")
                        c.project(part, "template", (el) => { el.innerHTML = initial; });
                    if (bindings.length > 0)
                        __classPrivateFieldGet(this, _View_instances, "m", _View_projectBindings).call(this, c, bindings, true, part);
                    for (const [key, { slot, composer }] of Object.entries(this.composers)) {
                        if (key in uiEvents)
                            throw new BonsaiError("SLOT_KEY_COLLISION", `slot key "${key}" collides with a UI key (D13)`);
                        const ComposerClass = composer;
                        c.create(describeComponent(new ComposerClass()), { part: { resource: part, portion: key, host: slot } });
                    }
                });
            }
        };
    }
}
_a = View, _View_checkTemplates = function _View_checkTemplates(features, selectors, initial) {
    const declared = this.templates;
    if (declared === null)
        return [];
    const component = this.constructor.name;
    const fail = (code, message, suggestion) => {
        throw new BonsaiError(code, message, suggestion === undefined ? { component } : { component, suggestion });
    };
    const keys = Object.keys(declared);
    if (keys.includes("root")) {
        if (keys.length > 1)
            fail("ROOT_TEMPLATE_EXCLUSIVE", `templates.root covers the whole part; it excludes the keys ${keys.filter((k) => k !== "root").join(", ")}.`);
        if (initial !== "")
            fail("ROOT_TEMPLATE_EXCLUSIVE", "templates.root covers the whole part; `template` must stay empty.");
    }
    const checked = keys.map((key) => {
        const binding = declared[key];
        if (key !== "root" && selectors[key] === undefined) {
            fail("UNKNOWN_TEMPLATE_KEY", `templates.${key} is neither a UI key nor "root".`, `Declare "${key}" in uiEvents and uiElements.`);
        }
        if (typeof binding.template?.create !== "function") {
            fail("MISSING_TEMPLATE", `templates.${key} has no template (create/setup/project).`);
        }
        if (binding.query === undefined) {
            if (binding.on !== undefined || binding.select !== undefined || binding.params !== undefined) {
                fail("MISSING_QUERY", `templates.${key} declares on, select or params without a query.`, "Add the Query that feeds it, or make it static.");
            }
            return { key, template: binding.template, query: null, params: null, on: [], select: null };
        }
        const query = parseNSKey(binding.query);
        if (!features[query.namespace]?.queries.includes(query.name)) {
            fail("UNDECLARED_QUERY", `templates.${key} reads "${binding.query}", which is not declared.`, `Add "${query.name}" to features.${query.namespace}.queries.`);
        }
        const on = (binding.on ?? []);
        if (on.length === 0) {
            fail("MISSING_ON", `templates.${key} reads "${binding.query}" but no Event re-runs it.`, "List in `on` the Events that change its result.");
        }
        for (const eventKey of on) {
            const event = parseNSKey(eventKey);
            if (!features[event.namespace]?.listens.includes(event.name)) {
                fail("UNDECLARED_LISTEN", `templates.${key} is re-run by "${eventKey}", which is not listened to.`, `Add "${event.name}" to features.${event.namespace}.listens.`);
            }
        }
        return {
            key,
            template: binding.template,
            query: { ...query, key: binding.query },
            params: binding.params ?? null,
            on,
            select: binding.select ?? null
        };
    });
    __classPrivateFieldSet(this, _View_templated, new Set(keys), "f");
    return checked;
}, _View_projectBindings = function _View_projectBindings(c, bindings, creation, part = c.resolve(c.designation())) {
    const results = new Map();
    for (const binding of bindings) {
        let data = undefined;
        if (binding.query !== null) {
            const { namespace, name, key } = binding.query;
            const params = typeof binding.params === "function"
                ? binding.params(c.params() ?? {})
                : binding.params;
            const id = queryIdentity(key, params);
            let result;
            if (id !== null && results.has(id)) {
                result = results.get(id);
            }
            else {
                result = c.query(namespace, name, params);
                if (id !== null)
                    results.set(id, result);
            }
            data = binding.select === null ? result : binding.select(result);
        }
        if (!creation && shallowEqual(__classPrivateFieldGet(this, _View_projected, "f").get(binding.key), data))
            continue;
        __classPrivateFieldGet(this, _View_instances, "m", _View_remember).call(this, c, binding.key, data);
        const { template } = binding;
        c.project(part, `templates.${binding.key}`, (root) => {
            const container = __classPrivateFieldGet(this, _View_instances, "m", _View_container).call(this, root, binding.key);
            if (creation) {
                container.replaceChildren(template.create(data));
                __classPrivateFieldGet(this, _View_nodes, "f").set(container, template.setup(container));
                return;
            }
            let nodes = __classPrivateFieldGet(this, _View_nodes, "f").get(container);
            if (nodes === undefined) {
                nodes = template.setup(container);
                __classPrivateFieldGet(this, _View_nodes, "f").set(container, nodes);
            }
            template.project(nodes, data);
        });
    }
}, _View_remember = function _View_remember(c, key, data) {
    const had = __classPrivateFieldGet(this, _View_projected, "f").has(key);
    const previous = __classPrivateFieldGet(this, _View_projected, "f").get(key);
    __classPrivateFieldGet(this, _View_projected, "f").set(key, data);
    c.journal(() => {
        if (had)
            __classPrivateFieldGet(this, _View_projected, "f").set(key, previous);
        else
            __classPrivateFieldGet(this, _View_projected, "f").delete(key);
    });
}, _View_container = function _View_container(root, key) {
    if (key === "root")
        return root;
    const selector = __classPrivateFieldGet(this, _View_selectors, "f")[key];
    const el = root.querySelector(selector);
    if (el === null)
        throw new BonsaiError("UI_ELEMENT_NOT_FOUND", `UI element "${key}" not found with selector "${selector}" in the part`);
    return el;
}, _View_unit = function _View_unit(operation) {
    if (__classPrivateFieldGet(this, _View_current, "f") === null) {
        throw new BonsaiError("OUTSIDE_HANDLER", `${operation} is usable only inside a handler of the View (C.3)`);
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

export { ProjectionList, View, bind, ui };
