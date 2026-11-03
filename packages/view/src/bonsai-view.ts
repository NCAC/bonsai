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

import {
  DESCRIBE,
  describeComponent,
  type TComponentSpec,
  type TDomAdmission,
  type TUnitContext
} from "@bonsai/kernel";
import { type UnionToIntersection } from "@bonsai/types";
import type {
  TFeatureContract,
  TFlatTriggers,
  TFlatQueries,
  TCommandPayloadFor,
  TQueryParamsFor,
  TQueryResultFor,
  TEventPayloadFor,
  TChannelHandlerName
} from "@bonsai/feature";
import type { TComposerClass } from "@bonsai/composer";

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
 * - `cancelDefault?`: declared events whose host default action (following a
 *             link, submitting a form) is cancelled at capture, before the
 *             handler and whatever the unit's outcome (D20). Absent = none.
 * - `_el?`  : phantom TEl (compile time only, never allocated at runtime).
 *             Types the events of the key (`TEventsFor<TEl>`).
 *
 * NO CSS selector here — it lives in `get uiElements()` (overridable, ADR-21).
 */
export type TUIEntry<
  TEl extends HTMLElement = HTMLElement,
  TEvts extends ReadonlyArray<TEventsFor<TEl>> = ReadonlyArray<TEventsFor<TEl>>
> = {
  readonly events: TEvts;
  readonly cancelDefault?: ReadonlyArray<TEvts[number]>;
  readonly _el?: TEl;
};

/**
 * Options of a UI entry. `cancelDefault` names declared events of the key whose
 * host default action is cancelled (D20): the handler never decides it, since
 * it receives a fact as data, not the host event (A3.c).
 */
export type TUIEntryOptions<TEvt extends string> = {
  readonly cancelDefault: ReadonlyArray<TEvt>;
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
 * @example ui<HTMLAnchorElement>()(["click"], { cancelDefault: ["click"] }) // link relayed to the router (D20)
 */
export function ui<TEl extends HTMLElement = HTMLElement>(): <
  const TEvts extends ReadonlyArray<TEventsFor<TEl>>
>(
  events: HasNoDuplicates<TEvts> extends true ? TEvts : never,
  options?: TUIEntryOptions<NoInfer<TEvts[number]>>
) => TUIEntry<TEl, TEvts> {
  return <const TEvts extends ReadonlyArray<TEventsFor<TEl>>>(
    events: TEvts,
    options?: TUIEntryOptions<TEvts[number]>
  ) =>
    (options === undefined || options.cancelDefault.length === 0
      ? { events }
      : { events, cancelDefault: options.cancelDefault }) as TUIEntry<TEl, TEvts>;
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

// ─── Projection (ADR-14, C.3) ───────────────────────────────────────────────

/**
 * Projection onto the element of a UI key. Each call *prepares* an effect,
 * engaged after the unit validates (C.3); none reads the document.
 */
export type TProjectionNode<_TEl extends HTMLElement = HTMLElement> = {
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
};

// ─── Handler contexts (D18) ─────────────────────────────────────────────────

/** A fact of the host admitted in the View's part, as data (A3.d). */
export type TFact = {
  /** Host event type, e.g. `"click"`. */
  readonly type: string;
  /** UI key the target belongs to, `null` when none. */
  readonly ui: string | null;
};

/** What every View handler can do: ask Queries. */
export type TQueryContext<TVC extends TViewContract> = {
  /** Synchronous, read-only Query on a declared Channel (G5). */
  query<K extends TFlatQueries<TVC["features"]> & string>(
    key: K,
    params: TQueryParamsFor<TVC["features"], K>
  ): TQueryResultFor<TVC["features"], K>;
};

/**
 * Context of the reaction to a fact of the host. It offers `trigger`: the
 * right to command is checked at run time (D18, C.4).
 */
export type TFactContext<TVC extends TViewContract = TViewContract> = TQueryContext<TVC> & {
  /** Addresses a Command of a declared Feature; delivered after the unit validates (G5). */
  trigger<K extends TFlatTriggers<TVC["features"]> & string>(
    key: K,
    payload: TCommandPayloadFor<TVC["features"], K>
  ): void;
};

/**
 * Context of the reaction to an Event. No `trigger`: an Event, its local relay
 * or an effect correlated to it grants no right to command (D18).
 */
export type TEventContext<TVC extends TViewContract = TViewContract> = TQueryContext<TVC>;

// ─── Handlers required by the contract ─────────────────────────────────────

/**
 * Maps a DOM event name to its native type in HTMLElementEventMap.
 * Kept for the contract types; a handler receives a `TFact`, not this event.
 */
export type TDOMEventFor<S extends string> = S extends keyof HTMLElementEventMap
  ? HTMLElementEventMap[S]
  : Event;

/**
 * DOM handlers REQUIRED for a UI entry: one per declared event.
 * I48 UI convention: `on{UIKey}{DomEvent}` (no suffix — ADR-15).
 */
export type TUIEntryHandlers<
  TKey extends string,
  TEntry extends TUIEntry,
  TVC extends TViewContract = TViewContract
> =
  TEntry extends TUIEntry<infer _TEl, infer TEvts>
    ? {
        [E in TEvts[number] as `on${Capitalize<TKey>}${Capitalize<E & string>}`]: (
          fact: TFact,
          ctx: TFactContext<TVC>
        ) => void;
      }
    : never;

/**
 * Intersection of every DOM handler required by a `TUIContract`.
 * An `events: []` entry requires no handler (I88).
 */
export type TUICallbacks<
  U extends TUIContract,
  TVC extends TViewContract = TViewContract
> = UnionToIntersection<
  {
    [K in keyof U]: TUIEntryHandlers<K & string, U[K], TVC>;
  }[keyof U]
>;

/**
 * Event handlers REQUIRED by the `listens` of a `TFeatureContract` (I48 channel).
 */
export type TEventCallbacks<TVC extends TViewContract> = UnionToIntersection<
  {
    [NS in keyof TVC["features"] & string]: {
      [E in TVC["features"][NS]["listens"][number] as TChannelHandlerName<NS, E & string>]: (
        payload: TEventPayloadFor<TVC["features"], `${NS}:${E & string}`>,
        ctx: TEventContext<TVC>
      ) => void;
    };
  }[keyof TVC["features"] & string]
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
 * Single `implements` clause of a View (ADR-14, I88): the handlers of the
 * Events it listens to and of the host events it declares.
 */
export type TViewCallbacks<TVC extends TViewContract> = TEventCallbacks<TVC> &
  TUICallbacks<TVC["ui"], TVC>;

/**
 * Structural type of a concrete View class, independent of its contract.
 * Used by orchestrating components (Composer) that only depend on the
 * creation surface, not on the specific contract.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TViewClass = abstract new (...args: any[]) => View<any>;

/** A slot of the View's part and the Composer that receives its content. */
export type TViewSlotDeclaration = {
  /** CSS selector matching exactly one element inside the View's part. */
  readonly slot: string;
  readonly composer: TComposerClass;
};

// ─── Internal helpers ────────────────────────────────────────────────────────

const capitalize = (s: string): string => (s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1));

function parseNSKey(key: string): { namespace: string; name: string } {
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
export abstract class View<TVC extends TViewContract = TViewContract> {
  /** The unit context of the handler being run, for `getUI` and `params`. */
  #current: TUnitContext | null = null;
  #selectors: Readonly<Record<string, string>> = {};

  // ─── Abstract: sources of truth (ADR-14 / I81) ──────────────────────

  /** Features: Events it listens to, Queries it asks, Commands it addresses. */
  abstract get features(): TVC["features"];

  /** UI keys with their element subtype and the host events they declare. */
  abstract get uiEvents(): TVC["ui"];

  /** CSS selector of each UI key, resolved inside the View's part. */
  abstract get uiElements(): TUIElements<TVC["ui"]>;

  // ─── Optional declarations ──────────────────────────────────────────

  /** Initial content of the part (HTML). Projected when the part exists. */
  get template(): string {
    return "";
  }

  /**
   * Slots of the part and their Composers (Composer §1.3). Keys are disjoint
   * from the UI keys; each slot selector matches exactly one element of the
   * part, in the content produced by `template`.
   */
  get composers(): Readonly<Record<string, TViewSlotDeclaration>> {
    return {};
  }

  // ─── Handler-only API ───────────────────────────────────────────────

  /** Creation parameters given by the Composer, frozen (6.2). Only inside a handler. */
  protected get params(): Readonly<Record<string, unknown>> {
    return (this.#unit("params").params<Record<string, unknown>>() ?? {}) as Readonly<Record<string, unknown>>;
  }

  /**
   * I39 — typed projection on a UI key. Every operation is *prepared*: it is
   * engaged after the unit validates (C.3). Only inside a handler.
   */
  getUI<K extends keyof TVC["ui"] & string>(key: K): TProjectionNode<ExtractEl<TVC["ui"][K]>> {
    const c = this.#unit(`getUI("${key}")`);
    const selector = this.#selectors[key];
    if (selector === undefined) {
      throw new Error(`[Bonsai View] Unknown UI key "${key}". Declared keys: ${Object.keys(this.#selectors).join(", ")}`);
    }
    const part = c.resolve(c.designation()!);
    const write = (label: string, apply: (el: HTMLElement) => void): void => {
      c.project(part, `${key}.${label}`, (root) => {
        const el = root.querySelector(selector) as HTMLElement | null;
        if (el === null) throw new Error(`[Bonsai View] UI element "${key}" not found with selector "${selector}" in the part`);
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
  [DESCRIBE](): TComponentSpec {
    const features = this.features as TFeatureContract;
    const uiEvents = this.uiEvents as TUIContract;
    const selectors = this.uiElements as Readonly<Record<string, string>>;
    this.#selectors = selectors;
    const methods = this.#methodNames();
    const self = this as unknown as Record<string, (...args: unknown[]) => void>;

    // I48 UI — one handler per declared (key, event); a missing one is a safety net (I84).
    const domTypes = new Map<string, Record<string, string>>();
    const cancelled = new Map<string, string[]>();
    for (const [uiKey, entry] of Object.entries(uiEvents)) {
      if (entry.events.length === 0) continue;
      const selector = selectors[uiKey];
      if (selector === undefined) {
        throw new Error(`[Bonsai View] UI key "${uiKey}" declared in uiEvents but missing in uiElements.`);
      }
      for (const domEvent of entry.events) {
        const handlerName = `on${capitalize(uiKey)}${capitalize(domEvent)}`;
        if (!methods.includes(handlerName)) {
          throw new Error(
            `[Bonsai View] Missing handler "${handlerName}" for declared event "${domEvent}" on ui.${uiKey}. ` +
              `Add the method or remove "${domEvent}" from uiEvents.${uiKey}.events.`
          );
        }
        const keys = domTypes.get(domEvent) ?? {};
        keys[uiKey] = selector;
        domTypes.set(domEvent, keys);
      }
      // D20 — the default action is cancelled by declaration only, for a declared event.
      for (const domEvent of entry.cancelDefault ?? []) {
        if (!entry.events.includes(domEvent)) {
          throw new Error(
            `[Bonsai View] ui.${uiKey} cancels the default action of "${domEvent}", which it does not declare in events (D20).`
          );
        }
        const keys = cancelled.get(domEvent) ?? [];
        keys.push(uiKey);
        cancelled.set(domEvent, keys);
      }
    }
    const dom: Record<string, TDomAdmission> = {};
    for (const [type, keys] of domTypes) {
      const cancelDefault = cancelled.get(type);
      dom[type] = cancelDefault === undefined ? { local: "fact", keys } : { local: "fact", keys, cancelDefault };
    }

    // I48 channel — on{NS}{Event}Event for each listened Event.
    const listens: NonNullable<TComponentSpec["listens"]>[number][] = [];
    for (const [namespace, entry] of Object.entries(features)) {
      for (const event of entry.listens) {
        const handlerName = `on${capitalize(namespace)}${capitalize(event)}Event`;
        if (typeof self[handlerName] !== "function") {
          throw new Error(
            `[Bonsai View] Missing handler "${handlerName}" for declared listen "${namespace}:${event}". ` +
              `Add the method or remove "${event}" from features.${namespace}.listens.`
          );
        }
        listens.push({
          namespace,
          event,
          handler: (payload, c) => this.#run(c, () => self[handlerName]!(payload, this.#eventContext(c)))
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
          const fact = payload as TFact;
          if (fact.ui === null || !uiEvents[fact.ui]?.events.includes(fact.type as never)) return;
          const handlerName = `on${capitalize(fact.ui)}${capitalize(fact.type)}`;
          this.#run(c, () => self[handlerName]!(fact, this.#factContext(c)));
        }
      },
      init: (c) => {
        this.#run(c, () => {
          const part = c.resolve(c.designation()!);
          const template = this.template;
          if (template !== "") c.project(part, "template", (el) => { el.innerHTML = template; });
          for (const [key, { slot, composer }] of Object.entries(this.composers)) {
            if (key in uiEvents) throw new Error(`[Bonsai View] slot key "${key}" collides with a UI key (D13)`);
            const ComposerClass = composer as unknown as new () => object;
            c.create(describeComponent(new ComposerClass()), { part: { resource: part, portion: key, host: slot } });
          }
        });
      }
    };
  }

  // ─── Private ───────────────────────────────────────────────────────

  #unit(operation: string): TUnitContext {
    if (this.#current === null) {
      throw new Error(`[Bonsai View] ${operation} is usable only inside a handler of the View (C.3)`);
    }
    return this.#current;
  }

  /** Makes the unit context available to `getUI` and `params` while a handler runs. */
  #run<R>(c: TUnitContext, fn: () => R): R {
    const previous = this.#current;
    this.#current = c;
    try {
      return fn();
    } finally {
      this.#current = previous;
    }
  }

  #methodNames(): string[] {
    const names = new Set<string>();
    for (
      let proto = Object.getPrototypeOf(this) as object | null;
      proto !== null && proto !== View.prototype;
      proto = Object.getPrototypeOf(proto) as object | null
    ) {
      for (const name of Object.getOwnPropertyNames(proto)) names.add(name);
    }
    return [...names];
  }

  #eventContext(c: TUnitContext): TEventContext<TVC> {
    return {
      query: ((key: string, params: unknown) => {
        const { namespace, name } = parseNSKey(key);
        return c.query(namespace, name, params);
      }) as TEventContext<TVC>["query"]
    };
  }

  #factContext(c: TUnitContext): TFactContext<TVC> {
    return {
      ...this.#eventContext(c),
      trigger: ((key: string, payload: unknown) => {
        const { namespace, name } = parseNSKey(key);
        c.trigger(namespace, name, payload);
      }) as TFactContext<TVC>["trigger"]
    };
  }
}
