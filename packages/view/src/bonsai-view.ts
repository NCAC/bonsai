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

import {
  DESCRIBE,
  describeComponent,
  type TCausalContext,
  type TComponentSpec,
  type TDomAdmission,
  type TResourceHandle,
  type TUnitContext
} from "@bonsai/kernel";
import { type UnionToIntersection } from "@bonsai/types";
import type {
  TFeatureContract,
  TFlatTriggers,
  TFlatListens,
  TFlatQueries,
  TCommandPayloadFor,
  TQueryParamsFor,
  TQueryResultFor,
  TEventPayloadFor,
  TChannelHandlerName
} from "@bonsai/feature";
import type { TComposerClass } from "@bonsai/composer";
import { BonsaiError } from "@bonsai/error";

export { ProjectionList, type TProjectionListOptions } from "./projection-list";

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
 * - `data?`  : names of values captured with a fact of the key (ADR-23, C.5):
 *             `itemId` reads `data-item-id` on the closest carrying ancestor.
 * - `_el?`  : phantom TEl (compile time only, never allocated at runtime).
 *             Types the events of the key (`TEventsFor<TEl>`).
 *
 * NO CSS selector here — it lives in `get uiElements()` (overridable, ADR-21).
 */
export type TUIEntry<
  TEl extends HTMLElement = HTMLElement,
  TEvts extends ReadonlyArray<TEventsFor<TEl>> = ReadonlyArray<TEventsFor<TEl>>,
  TData extends string = string
> = {
  readonly events: TEvts;
  readonly cancelDefault?: ReadonlyArray<TEvts[number]>;
  readonly data?: ReadonlyArray<TData>;
  readonly _el?: TEl;
};

/**
 * Options of a UI entry.
 * - `cancelDefault` names declared events of the key whose host default action
 *   is cancelled (D20): the handler never decides it, since it receives a fact
 *   as data, not the host event (A3.c).
 * - `data` names the values captured with each fact of the key (ADR-23, C.5).
 */
export type TUIEntryOptions<TEvt extends string, TData extends string = never> = {
  readonly cancelDefault?: ReadonlyArray<TEvt>;
  readonly data?: ReadonlyArray<TData>;
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
 * @example ui<HTMLButtonElement>()(["click"], { data: ["itemId"] })  // fact.data.itemId (ADR-23)
 */
export function ui<TEl extends HTMLElement = HTMLElement>(): <
  const TEvts extends ReadonlyArray<TEventsFor<TEl>>,
  const TData extends string = never
>(
  events: HasNoDuplicates<TEvts> extends true ? TEvts : never,
  options?: TUIEntryOptions<NoInfer<TEvts[number]>, TData>
) => TUIEntry<TEl, TEvts, TData> {
  return <const TEvts extends ReadonlyArray<TEventsFor<TEl>>, const TData extends string = never>(
    events: TEvts,
    options?: TUIEntryOptions<TEvts[number], TData>
  ) => {
    const entry: { events: TEvts; cancelDefault?: ReadonlyArray<TEvts[number]>; data?: ReadonlyArray<TData> } = { events };
    if (options?.cancelDefault !== undefined && options.cancelDefault.length > 0) entry.cancelDefault = options.cancelDefault;
    if (options?.data !== undefined && options.data.length > 0) entry.data = options.data;
    return entry as TUIEntry<TEl, TEvts, TData>;
  };
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
  TEntry extends TUIEntry<infer TEl, infer _TEvts, infer _TData> ? TEl : HTMLElement;

/** Names of the values a UI entry captures with its facts (ADR-23). */
export type ExtractData<TEntry extends TUIEntry> =
  TEntry extends { readonly data?: ReadonlyArray<infer TData> } ? (string extends TData ? never : TData & string) : never;

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
export type TFact<TData extends string = never> = {
  /** Host event type, e.g. `"click"`. */
  readonly type: string;
  /** UI key the target belongs to, `null` when none. */
  readonly ui: string | null;
  /**
   * Values declared by the key (`data`), captured at admission (C.5, ADR-23):
   * the `data-*` attribute of the closest carrying ancestor in the part, `null`
   * without one. Empty for a key that captures nothing.
   */
  readonly data: Readonly<Record<TData, string | null>>;
};

/** What every View handler can do: read its causal context, ask Queries. */
export type TQueryContext<TVC extends TViewContract> = {
  /** Causal context of the message being handled, established by the kernel (G8, ADR-04). Read-only. */
  readonly cause: TCausalContext;
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
  TEntry extends TUIEntry<infer _TEl, infer TEvts, infer _TData>
    ? {
        [E in TEvts[number] as `on${Capitalize<TKey>}${Capitalize<E & string>}`]: (
          fact: TFact<ExtractData<TEntry>>,
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

/** Handler of the Event `NS:E` of a View. */
type TEventHandler<TVC extends TViewContract, NS extends string, E extends string> = (
  payload: TEventPayloadFor<TVC["features"], `${NS}:${E}`>,
  ctx: TEventContext<TVC>
) => void;

/**
 * Event handlers of the `listens` of a `TFeatureContract` (I48 channel):
 * REQUIRED, except for an Event of `TOn`, which re-runs a template binding and
 * whose handler is optional (I82 amended, ADR-26).
 */
export type TEventCallbacks<TVC extends TViewContract, TOn extends string = never> = UnionToIntersection<
  {
    [NS in keyof TVC["features"] & string]: {
      [E in TVC["features"][NS]["listens"][number] as `${NS}:${E & string}` extends TOn
        ? never
        : TChannelHandlerName<NS, E & string>]: TEventHandler<TVC, NS, E & string>;
    } & {
      [E in TVC["features"][NS]["listens"][number] as `${NS}:${E & string}` extends TOn
        ? TChannelHandlerName<NS, E & string>
        : never]?: TEventHandler<TVC, NS, E & string>;
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

// ─── Template bindings (ADR-26, 5-rendu §7) ─────────────────────────────────

/**
 * Compiled template of a projection zone (ADR-22, 5-rendu §4.6). The compiler
 * generates it from Pug (strate 1c, lot 4); it can be written by hand.
 *
 * Its functions run only when the projection is engaged, after the unit
 * validates (C.3): they receive host nodes and nothing else.
 */
export type TProjectionTemplate<TData = unknown, TNodes = unknown> = {
  /** Builds the content of the zone from data (SPA mode); inserted in the container. */
  create(data: TData): Node;
  /** Locates the dynamic nodes inside the container (hydration, ADR-24 H2). */
  setup(container: HTMLElement): TNodes;
  /** Surgical mutations from data, guarded per node (5-rendu §7bis R5). */
  project(nodes: TNodes, data: TData): void;
};

/**
 * Binding fed by a declared Query and re-run by the Events of `on` (ADR-26).
 * Built with `bind<TVC>()(...)` for `select` and the template to be typed by
 * the result of the Query.
 */
export type TQueryBinding<
  TVC extends TViewContract,
  K extends TFlatQueries<TVC["features"]> & string,
  TData = TQueryResultFor<TVC["features"], K>,
  TOn extends TBindingEvents<TVC> = TBindingEvents<TVC>
> = {
  readonly template: TProjectionTemplate<TData>;
  /** `"ns:query"` key of a Query declared in `features[ns].queries`. */
  readonly query: K;
  /** Parameters of the Query: a value, or a function of the View's creation parameters (A3.d). */
  readonly params?:
    | TQueryParamsFor<TVC["features"], K>
    | ((viewParams: Readonly<Record<string, unknown>>) => TQueryParamsFor<TVC["features"], K>);
  /** Events that re-run the Query: declared in `features[ns].listens`, never empty. */
  readonly on: TOn;
  /** Pure presentation derivation of the result, without business authority (A4.d). */
  readonly select?: (result: TQueryResultFor<TVC["features"], K>) => TData;
};

/** Non-empty list of `"ns:event"` keys a binding is re-run by. */
export type TBindingEvents<TVC extends TViewContract> = readonly [
  TFlatListens<TVC["features"]>,
  ...TFlatListens<TVC["features"]>[]
];

/** Static binding: no data, projected once when the View is created. */
export type TStaticBinding = {
  readonly template: TProjectionTemplate<undefined>;
  readonly query?: never;
  readonly on?: never;
};

/** Any binding of a View: static, or fed by one of its declared Queries. */
export type TTemplateBinding<TVC extends TViewContract> =
  | TStaticBinding
  | {
      [K in TFlatQueries<TVC["features"]> & string]: TQueryBinding<TVC, K, unknown>;
    }[TFlatQueries<TVC["features"]> & string];

/**
 * Template bindings of a View (ADR-22 modes):
 *   - `null` — mode A, no template (N1 projections through `getUI()` only);
 *   - `{ root }` — mode B, one template covers the whole part;
 *   - `{ [uiKey]: binding }` — mode C, one template per UI key, as islands.
 */
export type TViewTemplates<TVC extends TViewContract> =
  | null
  | { readonly root: TTemplateBinding<TVC> }
  | { readonly [K in keyof TVC["ui"] & string]?: TTemplateBinding<TVC> };

/** Union of the `"ns:event"` keys cited in the `on` of some bindings. */
export type TTemplateEvents<TTemplates> = TTemplates extends null
  ? never
  : {
      [K in keyof TTemplates]: TTemplates[K] extends { readonly on: readonly (infer E)[] } ? E & string : never;
    }[keyof TTemplates];

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
export function bind<TVC extends TViewContract>() {
  return <
    K extends TFlatQueries<TVC["features"]> & string,
    const TOn extends TBindingEvents<TVC>,
    TData = TQueryResultFor<TVC["features"], K>
  >(
    binding: TQueryBinding<TVC, K, TData, TOn>
  ): TQueryBinding<TVC, K, TData, TOn> => binding;
}

/**
 * Single `implements` clause of a View (ADR-14, I88): the handlers of the
 * Events it listens to and of the host events it declares. With the type of
 * its `templates`, the handler of an Event cited in an `on` becomes optional
 * (I82 amended, ADR-26).
 */
export type TViewCallbacks<TVC extends TViewContract, TTemplates = null> = TEventCallbacks<
  TVC,
  TTemplateEvents<TTemplates>
> &
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

/** Shallow equality of two projected outputs (5-rendu §7bis R4). */
function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  return ka.every((k) => Object.prototype.hasOwnProperty.call(rb, k) && Object.is(ra[k], rb[k]));
}

/** Identity of a Query asked with its parameters, for one pass; `null` when not comparable. */
function queryIdentity(query: string, params: unknown): string | null {
  try {
    return `${query}\u0000${String(JSON.stringify(params))}`;
  } catch {
    return null;
  }
}

/** A template binding after its checks at description (internal). */
type TCheckedBinding = {
  readonly key: string;
  readonly template: TProjectionTemplate;
  readonly query: { readonly namespace: string; readonly name: string; readonly key: string } | null;
  readonly params: unknown;
  readonly on: readonly string[];
  readonly select: ((result: unknown) => unknown) | null;
};

function parseNSKey(key: string): { namespace: string; name: string } {
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
export abstract class View<TVC extends TViewContract = TViewContract> {
  /** The unit context of the handler being run, for `getUI` and `params`. */
  #current: TUnitContext | null = null;
  #selectors: Readonly<Record<string, string>> = {};
  /** Keys covered by a template binding (`root` covers the whole part), I41. */
  #templated: ReadonlySet<string> = new Set();
  /**
   * Last output projected by each binding: confined local state of the View
   * (16.5), journaled so that a failed unit restores it (G7).
   */
  readonly #projected = new Map<string, unknown>();
  /** Nodes located by `setup()`, per container; read and written only at engagement (C.3). */
  readonly #nodes = new WeakMap<Element, unknown>();

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

  /**
   * Template bindings (ADR-26): for each zone, the template, the declared
   * Query that feeds it and the Events that re-run it. `null` (default): no
   * template. Projected when the View is created, then after each Event of
   * an `on`, unless the output is shallow-equal to the last one projected.
   */
  get templates(): TViewTemplates<TVC> {
    return null;
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
    if (this.#templated.has(key) || this.#templated.has("root")) {
      throw new BonsaiError("TEMPLATE_OWNED_KEY", `UI key "${key}" is covered by a template binding; getUI() cannot write there (I41).`, {
        component: this.constructor.name,
        suggestion: "Project this zone through its template, or remove the binding."
      });
    }
    const selector = this.#selectors[key];
    if (selector === undefined) {
      throw new BonsaiError("UNKNOWN_UI_KEY", `Unknown UI key "${key}". Declared keys: ${Object.keys(this.#selectors).join(", ")}`);
    }
    const part = c.resolve(c.designation()!);
    const write = (label: string, apply: (el: HTMLElement) => void): void => {
      c.project(part, `${key}.${label}`, (root) => {
        const el = root.querySelector(selector) as HTMLElement | null;
        if (el === null) throw new BonsaiError("UI_ELEMENT_NOT_FOUND", `UI element "${key}" not found with selector "${selector}" in the part`);
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
    const initial = this.template;
    const bindings = this.#checkTemplates(features, selectors, initial);
    const methods = this.#methodNames();
    const self = this as unknown as Record<string, (...args: unknown[]) => void>;

    // I48 UI — one handler per declared (key, event); a missing one is a safety net (I84).
    const domTypes = new Map<string, Record<string, string>>();
    const cancelled = new Map<string, string[]>();
    // ADR-23, C.5 — values captured with the facts of a key.
    const captured: Record<string, readonly string[]> = {};
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
      if (entry.events.length === 0) continue;
      const selector = selectors[uiKey];
      if (selector === undefined) {
        throw new BonsaiError("MISSING_UI_ELEMENT", `UI key "${uiKey}" declared in uiEvents but missing in uiElements.`);
      }
      for (const domEvent of entry.events) {
        const handlerName = `on${capitalize(uiKey)}${capitalize(domEvent)}`;
        if (!methods.includes(handlerName)) {
          throw new BonsaiError("MISSING_HANDLER", 
            `Missing handler "${handlerName}" for declared event "${domEvent}" on ui.${uiKey}. ` +
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
          throw new BonsaiError("UNDECLARED_DEFAULT_CANCEL", 
            `ui.${uiKey} cancels the default action of "${domEvent}", which it does not declare in events (D20).`
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
      dom[type] = cancelDefault === undefined ? { local: "fact", keys, data: captured } : { local: "fact", keys, cancelDefault, data: captured };
    }

    // I48 channel — on{NS}{Event}Event for each listened Event, then one pass
    // on the bindings it re-runs (ADR-26). The handler is optional for an
    // Event cited in an `on` (I82 amended).
    const listens: NonNullable<TComponentSpec["listens"]>[number][] = [];
    for (const [namespace, entry] of Object.entries(features)) {
      for (const event of entry.listens) {
        const handlerName = `on${capitalize(namespace)}${capitalize(event)}Event`;
        const rerun = bindings.filter((b) => b.on.includes(`${namespace}:${event}`));
        const handler = typeof self[handlerName] === "function" ? self[handlerName] : null;
        if (handler === null && rerun.length === 0) {
          throw new BonsaiError("MISSING_HANDLER", 
            `Missing handler "${handlerName}" for declared listen "${namespace}:${event}". ` +
              `Add the method, cite "${namespace}:${event}" in the \`on\` of a template binding, ` +
              `or remove "${event}" from features.${namespace}.listens.`
          );
        }
        listens.push({
          namespace,
          event,
          handler: (payload, c) =>
            this.#run(c, () => {
              if (handler !== null) handler.call(this, payload, this.#eventContext(c));
              if (rerun.length > 0) this.#projectBindings(c, rerun, false);
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
          const fact = payload as TFact;
          if (fact.ui === null || !uiEvents[fact.ui]?.events.includes(fact.type as never)) return;
          const handlerName = `on${capitalize(fact.ui)}${capitalize(fact.type)}`;
          this.#run(c, () => self[handlerName]!(fact, this.#factContext(c)));
        }
      },
      init: (c) => {
        this.#run(c, () => {
          const part = c.resolve(c.designation()!);
          if (initial !== "") c.project(part, "template", (el) => { el.innerHTML = initial; });
          if (bindings.length > 0) this.#projectBindings(c, bindings, true, part);
          for (const [key, { slot, composer }] of Object.entries(this.composers)) {
            if (key in uiEvents) throw new BonsaiError("SLOT_KEY_COLLISION", `slot key "${key}" collides with a UI key (D13)`);
            const ComposerClass = composer as unknown as new () => object;
            c.create(describeComponent(new ComposerClass()), { part: { resource: part, portion: key, host: slot } });
          }
        });
      }
    };
  }

  // ─── Private ───────────────────────────────────────────────────────

  /**
   * Reads `templates` once and checks it against the contract (O2, ADR-26):
   * keys are UI keys or a lone `root`, every `query` and every Event of `on`
   * is declared, a binding with a Query has a non-empty `on`.
   */
  #checkTemplates(
    features: TFeatureContract,
    selectors: Readonly<Record<string, string>>,
    initial: string
  ): TCheckedBinding[] {
    const declared = this.templates as Readonly<Record<string, Partial<TQueryBinding<TViewContract, never>> & { template?: TProjectionTemplate }>> | null;
    if (declared === null) return [];
    const component = this.constructor.name;
    const fail = (code: string, message: string, suggestion?: string): never => {
      throw new BonsaiError(code, message, suggestion === undefined ? { component } : { component, suggestion });
    };
    const keys = Object.keys(declared);
    if (keys.includes("root")) {
      if (keys.length > 1) fail("ROOT_TEMPLATE_EXCLUSIVE", `templates.root covers the whole part; it excludes the keys ${keys.filter((k) => k !== "root").join(", ")}.`);
      if (initial !== "") fail("ROOT_TEMPLATE_EXCLUSIVE", "templates.root covers the whole part; `template` must stay empty.");
    }
    const checked = keys.map((key): TCheckedBinding => {
      const binding = declared[key]!;
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
        return { key, template: binding.template!, query: null, params: null, on: [], select: null };
      }
      const query = parseNSKey(binding.query);
      if (!features[query.namespace]?.queries.includes(query.name)) {
        fail("UNDECLARED_QUERY", `templates.${key} reads "${binding.query}", which is not declared.`, `Add "${query.name}" to features.${query.namespace}.queries.`);
      }
      const on = (binding.on ?? []) as readonly string[];
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
        template: binding.template!,
        query: { ...query, key: binding.query },
        params: binding.params ?? null,
        on,
        select: (binding.select as ((result: unknown) => unknown) | undefined) ?? null
      };
    });
    this.#templated = new Set(keys);
    return checked;
  }

  /**
   * One pass on bindings (ADR-26): Query (once per Query and parameters),
   * `select`, skip when shallow-equal to the last projected output, then a
   * prepared projection (C.3). At creation the content is created instead.
   */
  #projectBindings(
    c: TUnitContext,
    bindings: readonly TCheckedBinding[],
    creation: boolean,
    part: TResourceHandle = c.resolve(c.designation()!)
  ): void {
    const results = new Map<string, unknown>();
    for (const binding of bindings) {
      let data: unknown = undefined;
      if (binding.query !== null) {
        const { namespace, name, key } = binding.query;
        const params =
          typeof binding.params === "function"
            ? (binding.params as (p: Readonly<Record<string, unknown>>) => unknown)(c.params<Readonly<Record<string, unknown>>>() ?? {})
            : binding.params;
        const id = queryIdentity(key, params);
        let result: unknown;
        if (id !== null && results.has(id)) {
          result = results.get(id);
        } else {
          result = c.query(namespace, name, params);
          if (id !== null) results.set(id, result);
        }
        data = binding.select === null ? result : binding.select(result);
      }
      if (!creation && shallowEqual(this.#projected.get(binding.key), data)) continue;
      this.#remember(c, binding.key, data);
      const { template } = binding;
      c.project(part, `templates.${binding.key}`, (root) => {
        const container = this.#container(root, binding.key);
        if (creation) {
          container.replaceChildren(template.create(data));
          this.#nodes.set(container, template.setup(container));
          return;
        }
        let nodes = this.#nodes.get(container);
        if (nodes === undefined) {
          nodes = template.setup(container);
          this.#nodes.set(container, nodes);
        }
        template.project(nodes, data);
      });
    }
  }

  /** Records the last projected output of a binding, undone if the unit fails (G7). */
  #remember(c: TUnitContext, key: string, data: unknown): void {
    const had = this.#projected.has(key);
    const previous = this.#projected.get(key);
    this.#projected.set(key, data);
    c.journal(() => {
      if (had) this.#projected.set(key, previous);
      else this.#projected.delete(key);
    });
  }

  /** Container of a binding at engagement: the part itself, or its UI key element. */
  #container(root: Element, key: string): HTMLElement {
    if (key === "root") return root as HTMLElement;
    const selector = this.#selectors[key]!;
    const el = root.querySelector(selector) as HTMLElement | null;
    if (el === null) throw new BonsaiError("UI_ELEMENT_NOT_FOUND", `UI element "${key}" not found with selector "${selector}" in the part`);
    return el;
  }

  #unit(operation: string): TUnitContext {
    if (this.#current === null) {
      throw new BonsaiError("OUTSIDE_HANDLER", `${operation} is usable only inside a handler of the View (C.3)`);
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
      cause: c.cause,
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
