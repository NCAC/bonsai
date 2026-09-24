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

import { Radio, type Channel } from "@bonsai/event";
import { type UnionToIntersection } from "@bonsai/types";
import type {
  TFeatureContract,
  TFlatTriggers,
  TFlatRequests,
  TCommandPayloadFor,
  TRequestParamsFor,
  TRequestResultFor,
  TChannelCallbacks
} from "@bonsai/feature";

// ─── UI contract module (ADR-14) ───────────────────────────────────────────

// ─── DOM event categories — Bonsai semantic layer (ADR-15) ─────────────────

/**
 * Pointer events: mouse, touch, pointer API, wheel.
 * Universal — available on every interactive HTMLElement.
 */
export type TUIPointerEvents =
  | "auxclick"
  | "click"
  | "contextmenu"
  | "dblclick"
  | "mousedown"
  | "mouseenter"
  | "mouseleave"
  | "mousemove"
  | "mouseout"
  | "mouseover"
  | "mouseup"
  | "gotpointercapture"
  | "lostpointercapture"
  | "pointercancel"
  | "pointerdown"
  | "pointerenter"
  | "pointerleave"
  | "pointermove"
  | "pointerout"
  | "pointerover"
  | "pointerup"
  | "touchcancel"
  | "touchend"
  | "touchmove"
  | "touchstart"
  | "wheel";

/** Focus events: focusable elements (buttons, inputs, links, tabindex). */
export type TUIFocusEvents = "blur" | "focus" | "focusin" | "focusout";

/** Keyboard events: elements receiving text or shortcuts. */
export type TUIKeyboardEvents =
  | "beforeinput"
  | "compositionend"
  | "compositionstart"
  | "compositionupdate"
  | "keydown"
  | "keypress"
  | "keyup";

/** Clipboard events. */
export type TUIClipboardEvents = "copy" | "cut" | "paste";

/** Events drag & drop. */
export type TUIDragEvents =
  | "drag"
  | "dragend"
  | "dragenter"
  | "dragleave"
  | "dragover"
  | "dragstart"
  | "drop";

/** CSS animation and CSS transition events. */
export type TUIAnimationEvents =
  | "animationcancel"
  | "animationend"
  | "animationiteration"
  | "animationstart"
  | "transitioncancel"
  | "transitionend"
  | "transitionrun"
  | "transitionstart";

/**
 * Universal base: events available on EVERY HTMLElement.
 * Union of all non-specialised categories.
 */
export type TUIBaseEvents =
  | TUIPointerEvents
  | TUIFocusEvents
  | TUIKeyboardEvents
  | TUIClipboardEvents
  | TUIDragEvents
  | TUIAnimationEvents;

/**
 * Value events: elements carrying an editable value.
 * Specific to HTMLInputElement, HTMLTextAreaElement, HTMLSelectElement.
 */
export type TUIFormValueEvents =
  | "change"
  | "input"
  | "invalid"
  | "select"
  | "selectionchange"
  | "selectstart";

/** Form-container events: HTMLFormElement only. */
export type TUIFormContainerEvents = "formdata" | "reset" | "submit";

/**
 * Scroll events: elements with overflow scrolling.
 * NOT part of TUIBaseEvents — a button does not scroll.
 */
export type TUIScrollEvents = "scroll" | "scrollend";

/** Media events: audio and video. */
export type TUIMediaEvents =
  | "abort"
  | "canplay"
  | "canplaythrough"
  | "cuechange"
  | "durationchange"
  | "emptied"
  | "ended"
  | "error"
  | "loadeddata"
  | "loadedmetadata"
  | "loadstart"
  | "pause"
  | "play"
  | "playing"
  | "progress"
  | "ratechange"
  | "seeked"
  | "seeking"
  | "stalled"
  | "suspend"
  | "timeupdate"
  | "volumechange"
  | "waiting";

/** Toggle events: details, dialog. */
export type TUIToggleEvents = "beforetoggle" | "cancel" | "close" | "toggle";

/**
 * Semantic mapping: HTMLElement subtype → allowed DOM events. (ADR-15)
 *
 * - Known elements: positive list of semantically consistent events.
 * - Generic HTMLElement fallback: broad union (all categories).
 *
 * Known gap (ADR-15): the "scrollable containers" branch includes
 * `HTMLElement`, so every unlisted element (HTMLElement itself included)
 * gets base + scroll events and the broad fallback is never reached.
 *
 * Deliberately stricter than lib.dom.d.ts for known elements.
 * `TEventsFor<TEl>` is a subtype of `keyof HTMLElementEventMap` (I89).
 *
 * @see ADR-15
 */
export type TEventsFor<TEl extends HTMLElement> =
  // ── Value elements ────────────────────────────────────────────────────────
  TEl extends HTMLInputElement | HTMLTextAreaElement
    ? TUIBaseEvents | TUIFormValueEvents
    : TEl extends HTMLSelectElement
      ? TUIBaseEvents | "change" | "input" | "invalid"
      : // ── Form container ───────────────────────────────────────────────────
        TEl extends HTMLFormElement
        ? TUIBaseEvents | TUIFormValueEvents | TUIFormContainerEvents
        : // ── Interactive elements without a value ─────────────────────────
          TEl extends HTMLButtonElement | HTMLAnchorElement
          ? TUIBaseEvents
          : // ── Media elements ───────────────────────────────────────────────
            TEl extends HTMLVideoElement
            ?
                | TUIBaseEvents
                | TUIMediaEvents
                | TUIScrollEvents
                | "enterpictureinpicture"
                | "leavepictureinpicture"
            : TEl extends HTMLAudioElement
              ? TUIBaseEvents | TUIMediaEvents
              : // ── Toggle elements ───────────────────────────────────────────
                TEl extends HTMLDetailsElement
                ? TUIBaseEvents | "toggle" | "beforetoggle"
                : TEl extends HTMLDialogElement
                  ? TUIBaseEvents | TUIToggleEvents
                  : // ── Known scrollable containers ───────────────────────────
                    TEl extends
                        | HTMLDivElement
                        | HTMLElement // matches every element — makes the fallback below unreachable (ADR-15)
                        | HTMLUListElement
                        | HTMLOListElement
                        | HTMLTableElement
                    ? TUIBaseEvents | TUIScrollEvents
                    : // ── Fallback: generic HTMLElement — broad union ────────────
                        | TUIBaseEvents
                        | TUIFormValueEvents
                        | TUIFormContainerEvents
                        | TUIScrollEvents
                        | TUIMediaEvents
                        | TUIToggleEvents;

/**
 * Forbids duplicates in a readonly tuple. (ADR-15)
 *
 * A duplicate in `events` would add the same listener twice at mount.
 * If `T` contains a duplicate → returns `false` → `ui()()` expects `never`.
 */
export type HasNoDuplicates<
  T extends readonly unknown[],
  Seen extends readonly unknown[] = readonly []
> = T extends readonly [infer H, ...infer R extends readonly unknown[]]
  ? H extends Seen[number]
    ? false
    : HasNoDuplicates<R, readonly [H, ...Seen]>
  : true;

/**
 * Typed UI entry.
 *
 * - `events`: declared DOM events (REQUIRED — I86)
 *             `[]` = explicitly non-interactive element (projection only).
 *             Constrained to `TEventsFor<TEl>` — valid names + semantic consistency (I89 / I91).
 * - `_el?`  : phantom TEl (compile time only, never allocated at runtime).
 *             Lets `getUI(k).element()` return `TEl` instead of a generic
 *             `HTMLElement`.
 *
 * NO CSS selector here — it lives in `get uiElements()` (overridable, ADR-21).
 */
export type TUIEntry<
  TEl extends HTMLElement = HTMLElement,
  TEvts extends ReadonlyArray<TEventsFor<TEl>> = ReadonlyArray<TEventsFor<TEl>>
> = {
  readonly events: TEvts;
  readonly _el?: TEl;
};

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
export function ui<TEl extends HTMLElement = HTMLElement>(): <
  const TEvts extends ReadonlyArray<TEventsFor<TEl>>
>(
  events: HasNoDuplicates<TEvts> extends true ? TEvts : never
) => TUIEntry<TEl, TEvts> {
  return <const TEvts extends ReadonlyArray<TEventsFor<TEl>>>(events: TEvts) =>
    ({ events }) as TUIEntry<TEl, TEvts>;
}

/**
 * UI contract module — keys → typed entries (ADR-14).
 * A View or Behavior composes it with a `TFeatureContract`.
 */
export type TUIContract = Readonly<Record<string, TUIEntry>>;

/**
 * CSS selector module — overridable by the Composer (ADR-21).
 *
 * Keys must match `TUI`: no orphan key is possible. A selector must be
 * provided for every entry declared in `uiEvents` — missing → compile error.
 */
export type TUIElements<TUI extends TUIContract> = {
  readonly [K in keyof TUI]: string;
};

/** Extracts the HTMLElement subtype of a TUIEntry through the phantom. */
export type ExtractEl<TEntry extends TUIEntry> =
  TEntry extends TUIEntry<infer TEl, infer _TEvts> ? TEl : HTMLElement;

// ─── Generic TProjectionNode (ADR-14) ──────────────────────────────────────

/**
 * N1 projection node — targeted DOM mutations typed to the TEl subtype.
 * `element()` returns the actual declared HTMLElement (HTMLButtonElement, ...).
 * Known gap (ADR-16): exposing the raw element weakens I39.
 */
export type TProjectionNode<TEl extends HTMLElement = HTMLElement> = {
  /** Sets textContent */
  text(value: string): void;
  /** Sets an attribute */
  attr(name: string, value: string): void;
  /** Adds or removes a CSS class */
  toggleClass(className: string, force: boolean): void;
  /** Shows/hides via display:none */
  visible(show: boolean): void;
  /** Sets an inline style property */
  style(property: string, value: string): void;
  /** Returns the underlying element typed at the declared sub-type. */
  element(): TEl;
};

// ─── UI handlers (I48 UI) ────────────────────────────────────────────────────

/**
 * Maps a DOM event name to its native type in HTMLElementEventMap.
 *
 * The `: Event` branch covers events of specific sub-maps missing from the
 * base `HTMLElementEventMap` (e.g. `"enterpictureinpicture"` from
 * `HTMLVideoElementEventMap`). It is still needed with ADR-15.
 */
export type TDOMEventFor<S extends string> = S extends keyof HTMLElementEventMap
  ? HTMLElementEventMap[S]
  : Event;

/**
 * DOM handlers REQUIRED for a UI entry: one per declared event.
 * I48 UI convention: `on{UIKey}{DomEvent}` (no suffix — ADR-15).
 */
export type TUIEntryHandlers<TKey extends string, TEntry extends TUIEntry> =
  TEntry extends TUIEntry<infer _TEl, infer TEvts>
    ? {
        [E in TEvts[number] as `on${Capitalize<TKey>}${Capitalize<E & string>}`]: (
          e: TDOMEventFor<E & string>
        ) => void;
      }
    : never;

/**
 * Intersection of every DOM handler required by a `TUIContract`.
 *
 * Contract/Callbacks symmetry (ADR-14, I88): declaring `events: ["click"]`
 * requires `on{Key}Click`. An `events: []` entry requires no handler.
 */
export type TUICallbacks<U extends TUIContract> = UnionToIntersection<
  {
    [K in keyof U]: TUIEntryHandlers<K & string, U[K]>;
  }[keyof U]
>;

// ─── View composition (ADR-14) ─────────────────────────────────────────────

/**
 * Composite View contract — `features` (channel) + `ui` (DOM).
 * A single generic on the class: `View<TViewContract<F, U>>`.
 */
export type TViewContract<
  F extends TFeatureContract = TFeatureContract,
  U extends TUIContract = TUIContract
> = {
  readonly features: F;
  readonly ui: U;
};

/**
 * Single `implements` clause of a View (ADR-14, I88).
 *
 * Merges:
 *  - `TChannelCallbacks<F>`: channel handlers (I48 channel — `on{NS}{Event}Event`)
 *  - `TUICallbacks<U>`     : DOM handlers     (I48 UI      — `on{UIKey}{DomEvent}`)
 *
 * Contract/Callbacks symmetry: for every `TViewContract`, the developer writes
 * `extends View<TVC>` AND `implements TViewCallbacks<TVC>`.
 */
export type TViewCallbacks<TVC extends TViewContract> = TChannelCallbacks<
  TVC["features"]
> &
  TUICallbacks<TVC["ui"]>;

/**
 * Structural type of a concrete View class, independent of its contract.
 * Used by orchestrating components (Composer) that only depend on the public
 * mount surface, not on the specific contract.
 *
 * A single `any`, since View<> has a single generic.
 * `...args: any[]` accepts any constructor; concrete Views may or may not
 * declare one — the surface the Composer uses is `mount(rootSelector)`,
 * independent of the constructor.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TViewClass = abstract new (...args: any[]) => View<any>;

// ─── ProjectionNode factory ──────────────────────────────────────────────────

function createProjectionNode<TEl extends HTMLElement = HTMLElement>(
  el: TEl
): TProjectionNode<TEl> {
  return {
    text(value: string): void {
      el.textContent = value;
    },
    attr(name: string, value: string): void {
      el.setAttribute(name, value);
    },
    toggleClass(className: string, force: boolean): void {
      el.classList.toggle(className, force);
    },
    visible(show: boolean): void {
      el.style.display = show ? "" : "none";
    },
    style(property: string, value: string): void {
      el.style.setProperty(property, value);
    },
    element(): TEl {
      return el;
    }
  };
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

function parseNSKey(key: string): { namespace: string; name: string } {
  const idx = key.indexOf(":");
  if (idx <= 0 || idx === key.length - 1) {
    throw new Error(
      `[Bonsai View] Malformed namespaced key "${key}". Expected "namespace:name".`
    );
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
export abstract class View<TVC extends TViewContract = TViewContract> {
  #rootElement: string | null = null;
  #rootEl: HTMLElement | null = null;
  #mounted = false;
  #uiSelectors: Readonly<Record<string, string>> = {};
  #uiDomEvents: Readonly<Record<string, readonly string[]>> = {};
  #features: TFeatureContract = {};

  // ─── Abstract: three sources of truth (ADR-14 / I81) ────────────────

  /**
   * Feature module: Feature refs by lane (Feature-grouped).
   * Read once at mount (ADR-14). Structural — not overridable.
   */
  abstract get features(): TVC["features"];

  /**
   * UI events module: DOM nodes + HTML types + declared events.
   * Structural — not overridable. Read at mount to add listeners (ADR-15).
   */
  abstract get uiEvents(): TVC["ui"];

  /**
   * CSS selector module — overridable by the Composer (ADR-21).
   * Planned: the Composer will inject overrides through `resolve() → options`
   * (stratum 2, not delivered).
   */
  abstract get uiElements(): TUIElements<TVC["ui"]>;

  // ─── Public API ────────────────────────────────────────────────────────

  /** The rootElement selector injected at mount (I31). */
  get rootElement(): string | null {
    return this.#rootElement;
  }

  /**
   * Root DOM element after mount. Available in onAttach() and in handlers —
   * lets subclasses read data-* attributes (I34).
   */
  protected get el(): HTMLElement | null {
    return this.#rootEl;
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
  mount(rootSelector: string): void {
    if (this.#mounted) return;
    this.#mounted = true;

    // ADR-14: contract modules are read once
    this.#features = this.features;
    this.#uiSelectors = this.uiElements;

    // Extract DOM events per UI key (runtime, ADR-15)
    const uiEvents = this.uiEvents;
    const domEventsMap: Record<string, readonly string[]> = {};
    for (const key of Object.keys(uiEvents)) {
      domEventsMap[key] = uiEvents[key].events;
    }
    this.#uiDomEvents = domEventsMap;

    this.#rootElement = rootSelector;
    this.#rootEl = document.querySelector(rootSelector) as HTMLElement;

    // I34: rootElement must not be document.body itself
    if (this.#rootEl === document.body) {
      throw new Error(
        `[Bonsai View] I34 — rootElement cannot be document.body. Provide a child element selector.`
      );
    }

    // Auto-discovery
    this.#registerUIHandlers();
    this.#registerChannelListeners();

    // Lifecycle
    this.onAttach();
  }

  /**
   * I39 — typed DOM access through `getUI(key)`. Resolves inside the
   * rootElement scope (I40; slot exclusion not delivered yet).
   * Returns `TProjectionNode<TEl>`, where `TEl` comes from the `_el?` phantom
   * of the declared UI entry — `element()` returns the actual HTML subtype.
   */
  getUI<K extends keyof TVC["ui"] & string>(
    key: K
  ): TProjectionNode<ExtractEl<TVC["ui"][K]>> {
    const selector = this.#uiSelectors[key];
    if (!selector) {
      throw new Error(
        `[Bonsai View] Unknown UI key "${key}". Declared keys: ${Object.keys(this.#uiSelectors).join(", ")}`
      );
    }

    const el = this.#rootEl!.querySelector(selector) as ExtractEl<TVC["ui"][K]>;
    if (!el) {
      throw new Error(
        `[Bonsai View] UI element "${key}" not found with selector "${selector}" in rootElement "${this.#rootElement}"`
      );
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
  protected trigger<K extends TFlatTriggers<TVC["features"]> & string>(
    key: K,
    payload: TCommandPayloadFor<TVC["features"], K>
  ): void {
    const { namespace, name } = parseNSKey(key);
    // Cast to the untyped Channel to register by string (I75).
    const ch = Radio.me().channel(namespace) as unknown as Channel;
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
  protected request<K extends TFlatRequests<TVC["features"]> & string>(
    key: K,
    params: TRequestParamsFor<TVC["features"], K>
  ): TRequestResultFor<TVC["features"], K> | null {
    const { namespace, name } = parseNSKey(key);
    // Cast to the untyped Channel to register by string (I75).
    const ch = Radio.me().channel(namespace) as unknown as Channel;
    return ch.request(name, params) as TRequestResultFor<
      TVC["features"],
      K
    > | null;
  }

  // ─── Lifecycle hooks ───────────────────────────────────────────────────

  /** Hook called after mount. Override it in subclasses. */
  onAttach(): void {
    // Default no-op
  }

  // ─── Private: auto-discovery ───────────────────────────────────────────

  /**
   * I48 UI — for each `uiEvents[k]` entry with `events: [E1, E2, ...]`,
   * adds `addEventListener(E)` on the element resolved through
   * `uiElements[k]` and dispatches to the matching `on{Key}{Event}` method.
   *
   * Convention: `events: ["click"]` on `addBtn` → addEventListener("click")
   * → `onAddBtnClick(e)` method.
   *
   * Runtime counterpart of I84/I82: a missing handler throws (compile time
   * should have caught it; this is a safety net).
   *
   * Known gap (ADR-15): only the direct prototype is inspected, so a handler
   * inherited from a parent View is reported as missing.
   */
  #registerUIHandlers(): void {
    const proto = Object.getPrototypeOf(this);
    const methods = Object.getOwnPropertyNames(proto) as string[];

    for (const uiKey of Object.keys(this.#uiDomEvents)) {
      const events = this.#uiDomEvents[uiKey];
      if (events.length === 0) continue; // non-interactive

      const uiKeyPascal = capitalize(uiKey);
      const selector = this.#uiSelectors[uiKey];
      if (!selector) {
        throw new Error(
          `[Bonsai View] UI key "${uiKey}" declared in uiEvents but missing in uiElements.`
        );
      }
      const el = this.#rootEl!.querySelector(selector) as HTMLElement;
      if (!el) continue; // no element = no listener (silent)

      for (const domEvent of events) {
        const handlerName = `on${uiKeyPascal}${capitalize(domEvent)}`;
        if (!methods.includes(handlerName)) {
          throw new Error(
            `[Bonsai View] Missing handler "${handlerName}" for declared event "${domEvent}" on ui.${uiKey}. ` +
              `Add the method or remove "${domEvent}" from uiEvents.${uiKey}.events.`
          );
        }
        el.addEventListener(domEvent, (event: Event) => {
          (this as unknown as Record<string, (e: Event) => void>)[handlerName](
            event
          );
        });
      }
    }
  }

  /**
   * I48 channel — for each Feature in `features` and each event of
   * `features[NS].listens`, wires the `on{NS}{Event}Event` method on the
   * matching Channel.
   *
   * Runtime counterpart of I82 — `implements TViewCallbacks` enforces presence
   * at compile time; this net catches bypasses (`as any` cast).
   */
  #registerChannelListeners(): void {
    for (const namespace of Object.keys(this.#features)) {
      const entry = this.#features[namespace];
      const listens = entry.listens;
      if (listens.length === 0) continue;

      const ch = Radio.me().channel(namespace) as unknown as Channel;

      for (const eventName of listens) {
        const handlerName = `on${capitalize(namespace)}${capitalize(eventName)}Event`;
        const handler = (this as unknown as Record<string, unknown>)[
          handlerName
        ];
        if (typeof handler !== "function") {
          throw new Error(
            `[Bonsai View] Missing handler "${handlerName}" for declared listen "${namespace}:${eventName}". ` +
              `Add the method or remove "${eventName}" from features.${namespace}.listens.`
          );
        }

        ch.listen(eventName, (payload: unknown) => {
          (handler as (p: unknown) => void).call(this, payload);
        });
      }
    }
  }
}
