/**
 * @bonsai/view - Version 0.0.1
 * Bundled by Bonsai Build System
 * Date: 2026-05-13T18:01:10.547Z
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
 * @bonsai/view — View base class (ADR-0042)
 *
 * Strate 1 — Capacités :
 *   - trigger("ns:cmd", payload) → envoie un Command typé via Channel
 *   - request("ns:req", params)  → interroge un Channel typé
 *   - getUI(key) → TProjectionNode<TEl> typé au sous-type HTMLElement (phantom)
 *   - Auto-discovery D48 channel : on{NS}{Event}Event → channel.listen
 *   - Auto-discovery D48 UI      : on{UIKey}{DomEvent} → addEventListener
 *   - onAttach() lifecycle hook
 *
 * Pattern modulaire ADR-0042 :
 *   1. `const features satisfies TFeatureContract` — Feature-groupé
 *   2. `const uiEvents satisfies TUIContract`      — events DOM + phantom TEl
 *   3. `const uiElements satisfies TUIElements<typeof uiEvents>` — sélecteurs
 *   4. `type TVC = TViewContract<typeof features, typeof uiEvents>`
 *   5. `class XxxView extends View<TVC> implements TViewCallbacks<TVC>`
 *
 * Trois getters abstraits :
 *   - `get features()`   → Feature refs + lanes (structurel, non-overridable)
 *   - `get uiEvents()`   → events DOM + phantom TEl (structurel)
 *   - `get uiElements()` → sélecteurs CSS (overridable par Composer D34)
 *
 * Channel reste privé derrière sa Feature (I80) — aucun `TChannelToken` dans
 * la surface publique.
 *
 * Invariants :
 *   I4  — View n'a JAMAIS emit() — absent du type
 *   I31 — rootElement est un sélecteur CSS string injecté au mount
 *   I36 — View ne compose jamais d'autres Views directement
 *   I39 — Accès DOM exclusivement via getUI(key)
 *   I40 — Scope DOM : résolution dans rootElement uniquement
 *   I48 — Handlers auto-découverts par convention de nommage
 *   I75 — Aucun `any` dans la surface publique ; casts internes documentés
 *   I80 — Aucun TChannelToken dans la surface publique consommateur
 *   I81 — `features` / `uiEvents` / `uiElements` sont les sources de vérité
 *   I82 — Handler manquant → erreur compile via `implements TViewCallbacks`
 *   I83 — Pattern modulaire `T{Component}Contract` réutilisable
 *   I84 — `events: [E, ...]` non-vide impose les handlers DOM correspondants
 *   I85 — `ui<TEl>()(events)` est l'unique helper pour TUIEntry (forme curryfiée)
 *   I86 — `events` toujours présent dans TUIEntry (pas d'optionnel) ; ReadonlyArray<TEventsFor<TEl>> sans doublons
 *   I87 — clé d'objet ≡ namespace de la Feature référencée
 *   I88 — symétrie Contract/Callbacks
 *   I89 — tout nom d'event déclaré appartient à TEventsFor<TEl> ⊆ keyof HTMLElementEventMap (ADR-0044/0045)
 *   I90 — pas de doublons dans TUIEntry["events"] — double-binding interdit (ADR-0044)
 *   I91 — TEventsFor<TEl> est le mapping sémantique officiel Bonsai élément→events (ADR-0045)
 *
 * @packageDocumentation
 */
var _View_instances, _View_rootElement, _View_rootEl, _View_mounted, _View_uiSelectors, _View_uiDomEvents, _View_features, _View_registerUIHandlers, _View_registerChannelListeners;
/**
 * Helper de construction d'une entrée UI (I85 — unique mécanisme).
 *
 * Encode le sous-type TEl via le phantom `_el?` et capture les events runtime.
 * Forme curryfiée nécessaire pour préserver l'inférence littérale de `events`
 * tout en spécifiant `TEl` explicitement (limitation TypeScript : `const T`
 * sur un paramètre ne préserve pas le littéral si un autre paramètre est
 * passé explicitement avec un défaut).
 *
 * Contraintes (ADR-0044 + ADR-0045) :
 *  - `TEvts` ⊆ `TEventsFor<TEl>` — noms valides + sémantique cohérente
 *  - `HasNoDuplicates<TEvts>` — interdit le double-binding addEventListener
 *
 * @example ui<HTMLButtonElement>()(["click"])           // interactif
 * @example ui<HTMLSpanElement>()([])                    // non-interactif explicite
 * @example ui<HTMLInputElement>()(["input", "change"])  // 2 handlers requis
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
// ─── Helpers internes ────────────────────────────────────────────────────────
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
// ─── View abstract class (ADR-0042) ─────────────────────────────────────────
/**
 * View — couche présentation paramétrée par un seul générique : `TViewContract`.
 *
 * Pattern d'usage :
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
 *     this.trigger("cart:addItem", { id: "p1", qty: 1 });  // ✅ payload inféré
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
    /** Le sélecteur rootElement injecté au mount (I31). */
    get rootElement() {
        return __classPrivateFieldGet(this, _View_rootElement, "f");
    }
    /**
     * L'élément DOM racine après mount. Disponible dans onAttach() et les
     * handlers — permet aux sous-classes de lire les data-* attributes (I34).
     */
    get el() {
        return __classPrivateFieldGet(this, _View_rootEl, "f");
    }
    /**
     * Monte la View sur un rootElement. Appelé par le Composer.
     * - Lit `get features()` / `get uiEvents()` / `get uiElements()` une seule fois (ADR-0024)
     * - Résout le rootElement dans le DOM
     * - Auto-discover les UI handlers (D48 UI — pilotés par uiEvents[k].events)
     * - Auto-discover les Channel listeners (D48 channel — pilotés par features[NS].listens)
     * - Appelle onAttach()
     */
    mount(rootSelector) {
        if (__classPrivateFieldGet(this, _View_mounted, "f"))
            return;
        __classPrivateFieldSet(this, _View_mounted, true, "f");
        // ADR-0024 : lecture unique des modules contractuels
        __classPrivateFieldSet(this, _View_features, this.features, "f");
        __classPrivateFieldSet(this, _View_uiSelectors, this.uiElements, "f");
        // Extraction des events DOM par clé UI (runtime D48)
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
     * I39 — Accès DOM typé via `getUI(key)`. Résout dans le scope du rootElement (I40).
     * Le retour est `TProjectionNode<TEl>` où `TEl` est extrait du phantom `_el?`
     * de l'entrée UI déclarée — `element()` retourne le vrai sous-type HTML.
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
     * Envoie un Command typé via Channel (I4 — View ne peut qu'envoyer).
     *
     * `key` est une clé namespacée `"ns:cmd"` ; doit appartenir à
     * `TFlatTriggers<TVC["features"]>`, sinon erreur compile.
     * Exposé en `protected` — les sous-classes l'appellent depuis les handlers UI.
     */
    trigger(key, payload) {
        const { namespace, name } = parseNSKey(key);
        // Cast vers Channel non paramétré pour l'enregistrement par string (I75).
        const ch = Radio.me().channel(namespace);
        ch.trigger(name, payload);
    }
    /**
     * Effectue une Request synchrone typée vers un Channel déclaré.
     * Retourne le résultat typé ou `null` si aucun replier n'est enregistré
     * côté Feature propriétaire (D44).
     *
     * `key` est une clé namespacée `"ns:req"` ; doit appartenir à
     * `TFlatRequests<TVC["features"]>`, sinon erreur compile.
     */
    request(key, params) {
        const { namespace, name } = parseNSKey(key);
        // Cast vers Channel non paramétré pour l'enregistrement par string (I75).
        const ch = Radio.me().channel(namespace);
        return ch.request(name, params);
    }
    // ─── Lifecycle hooks ───────────────────────────────────────────────────
    /** Hook appelé après le mount. Override dans les sous-classes. */
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
            continue; // C9 — non-interactif
        const uiKeyPascal = capitalize(uiKey);
        const selector = __classPrivateFieldGet(this, _View_uiSelectors, "f")[uiKey];
        if (!selector) {
            throw new Error(`[Bonsai View] UI key "${uiKey}" declared in uiEvents but missing in uiElements.`);
        }
        const el = __classPrivateFieldGet(this, _View_rootEl, "f").querySelector(selector);
        if (!el)
            continue; // pas d'élément = pas de listener (silencieux)
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
