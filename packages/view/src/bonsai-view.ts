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

// ─── Module contractuel UI (ADR-0042) ────────────────────────────────────────

// ─── Catégories d'événements DOM — couche sémantique Bonsai (ADR-0045) ───────

/**
 * Events de pointeur : souris, touch, pointer API, molette.
 * Universels — disponibles sur tout HTMLElement interactif.
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

/** Events focus : éléments focusables (boutons, inputs, liens, tabindex). */
export type TUIFocusEvents = "blur" | "focus" | "focusin" | "focusout";

/** Events clavier : éléments recevant du texte ou des raccourcis. */
export type TUIKeyboardEvents =
  | "beforeinput"
  | "compositionend"
  | "compositionstart"
  | "compositionupdate"
  | "keydown"
  | "keypress"
  | "keyup";

/** Events presse-papiers. */
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

/** Events animation CSS et transition CSS. */
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
 * Base universelle : events disponibles sur TOUT HTMLElement.
 * Composition de toutes les catégories non-spécialisées.
 */
export type TUIBaseEvents =
  | TUIPointerEvents
  | TUIFocusEvents
  | TUIKeyboardEvents
  | TUIClipboardEvents
  | TUIDragEvents
  | TUIAnimationEvents;

/**
 * Events de valeur : éléments portant une valeur éditable.
 * Spécifiques à HTMLInputElement, HTMLTextAreaElement, HTMLSelectElement.
 */
export type TUIFormValueEvents =
  | "change"
  | "input"
  | "invalid"
  | "select"
  | "selectionchange"
  | "selectstart";

/** Events de formulaire-conteneur : HTMLFormElement uniquement. */
export type TUIFormContainerEvents = "formdata" | "reset" | "submit";

/**
 * Events de défilement : éléments avec overflow scroll.
 * NON inclus dans TUIBaseEvents — un bouton ne défile pas.
 */
export type TUIScrollEvents = "scroll" | "scrollend";

/** Events media : audio et vidéo. */
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

/** Events de bascule : details, dialog. */
export type TUIToggleEvents = "beforetoggle" | "cancel" | "close" | "toggle";

/**
 * Mapping sémantique : sous-type HTMLElement → events DOM autorisés. (ADR-0045)
 *
 * - Éléments connus : liste positive d'events sémantiquement cohérents.
 * - Fallback HTMLElement générique : union large (toutes catégories — non-régressif).
 *
 * Intentionnellement plus strict que lib.dom.d.ts pour les éléments connus.
 * `TEventsFor<TEl>` est un sous-type de `keyof HTMLElementEventMap` (I89).
 *
 * @see ADR-0045
 */
export type TEventsFor<TEl extends HTMLElement> =
  // ── Éléments de valeur ────────────────────────────────────────────────────
  TEl extends HTMLInputElement | HTMLTextAreaElement
    ? TUIBaseEvents | TUIFormValueEvents
    : TEl extends HTMLSelectElement
      ? TUIBaseEvents | "change" | "input" | "invalid"
      : // ── Formulaire conteneur ─────────────────────────────────────────────
        TEl extends HTMLFormElement
        ? TUIBaseEvents | TUIFormValueEvents | TUIFormContainerEvents
        : // ── Éléments interactifs sans valeur ─────────────────────────────
          TEl extends HTMLButtonElement | HTMLAnchorElement
          ? TUIBaseEvents
          : // ── Éléments media ───────────────────────────────────────────────
            TEl extends HTMLVideoElement
            ?
                | TUIBaseEvents
                | TUIMediaEvents
                | TUIScrollEvents
                | "enterpictureinpicture"
                | "leavepictureinpicture"
            : TEl extends HTMLAudioElement
              ? TUIBaseEvents | TUIMediaEvents
              : // ── Éléments toggle ───────────────────────────────────────────
                TEl extends HTMLDetailsElement
                ? TUIBaseEvents | "toggle" | "beforetoggle"
                : TEl extends HTMLDialogElement
                  ? TUIBaseEvents | TUIToggleEvents
                  : // ── Conteneurs scrollables connus ─────────────────────────
                    TEl extends
                        | HTMLDivElement
                        | HTMLElement // HTMLSectionElement, HTMLMainElement, etc. via HTMLElement
                        | HTMLUListElement
                        | HTMLOListElement
                        | HTMLTableElement
                    ? TUIBaseEvents | TUIScrollEvents
                    : // ── Fallback : HTMLElement générique — union large ─────────
                        | TUIBaseEvents
                        | TUIFormValueEvents
                        | TUIFormContainerEvents
                        | TUIScrollEvents
                        | TUIMediaEvents
                        | TUIToggleEvents;

/**
 * Interdit les doublons dans un tuple readonly. (ADR-0044)
 *
 * Un doublon dans `events` entraînerait un double `addEventListener` au mount.
 * Si `T` contient un doublon → retourne `false` → `ui()()` attend `never`.
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
 * Entrée UI typée.
 *
 * - `events` : événements DOM déclarés (OBLIGATOIRE — C5 / I86)
 *              `[]` = élément non-interactif explicite (projection seule).
 *              Contraint à `TEventsFor<TEl>` — noms valides + cohérence sémantique (I89 / I91).
 * - `_el?`   : phantom TEl (compile-time only, jamais alloué au runtime).
 *              Permet à `getUI(k).element()` de retourner `TEl` au lieu de
 *              `HTMLElement` générique.
 *
 * AUCUN sélecteur CSS ici — il vit dans `get uiElements()` (overridable D34).
 */
export type TUIEntry<
  TEl extends HTMLElement = HTMLElement,
  TEvts extends ReadonlyArray<TEventsFor<TEl>> = ReadonlyArray<TEventsFor<TEl>>
> = {
  readonly events: TEvts;
  readonly _el?: TEl;
};

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
export function ui<TEl extends HTMLElement = HTMLElement>(): <
  const TEvts extends ReadonlyArray<TEventsFor<TEl>>
>(
  events: HasNoDuplicates<TEvts> extends true ? TEvts : never
) => TUIEntry<TEl, TEvts> {
  return <const TEvts extends ReadonlyArray<TEventsFor<TEl>>>(events: TEvts) =>
    ({ events }) as TUIEntry<TEl, TEvts>;
}

/**
 * Module contractuel UI — clés → entrées typées (ADR-0042).
 * Une View ou Behavior compose ce module avec un `TFeatureContract`.
 */
export type TUIContract = Readonly<Record<string, TUIEntry>>;

/**
 * Module sélecteurs CSS — overridable par Composer (D34).
 *
 * Contraint les clés à matcher `TUI` : aucune clé orpheline possible.
 * Le développeur doit fournir un sélecteur pour chaque entrée déclarée
 * dans `uiEvents` — manquant → erreur compile.
 */
export type TUIElements<TUI extends TUIContract> = {
  readonly [K in keyof TUI]: string;
};

/** Extrait le sous-type HTMLElement d'une TUIEntry via le phantom. */
export type ExtractEl<TEntry extends TUIEntry> =
  TEntry extends TUIEntry<infer TEl, infer _TEvts> ? TEl : HTMLElement;

// ─── TProjectionNode générique (ADR-0042) ────────────────────────────────────

/**
 * Projection Node N1 — mutations DOM chirurgicales typées au sous-type TEl.
 * `element()` retourne le vrai HTMLElement déclaré (HTMLButtonElement, ...).
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

// ─── UI handlers (D48 UI) ────────────────────────────────────────────────────

/**
 * Mappe un nom d'événement DOM vers son type natif dans HTMLElementEventMap.
 *
 * La branche `: Event` couvre les événements de sous-maps spécifiques non
 * présents dans `HTMLElementEventMap` base (ex: `"enterpictureinpicture"` de
 * `HTMLVideoElementEventMap`). Elle reste nécessaire même avec ADR-0044/0045.
 */
export type TDOMEventFor<S extends string> = S extends keyof HTMLElementEventMap
  ? HTMLElementEventMap[S]
  : Event;

/**
 * Handlers DOM REQUIS pour une entrée UI : un par event déclaré.
 * Convention D48 UI : `on{UIKey}{DomEvent}` (sans suffixe — ADR-0042 C14).
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
 * Intersection de tous les handlers DOM requis pour un `TUIContract`.
 *
 * Symétrie Contract/Callbacks (ADR-0042 C15, I88) : déclarer
 * `events: ["click"]` impose la présence de `on{Key}Click`.
 * Une entrée `events: []` ne génère aucun handler requis.
 */
export type TUICallbacks<U extends TUIContract> = UnionToIntersection<
  {
    [K in keyof U]: TUIEntryHandlers<K & string, U[K]>;
  }[keyof U]
>;

// ─── Composition View (ADR-0042) ─────────────────────────────────────────────

/**
 * Contrat View composé — `features` (channel) + `ui` (DOM).
 * Un seul générique sur la classe : `View<TViewContract<F, U>>`.
 */
export type TViewContract<
  F extends TFeatureContract = TFeatureContract,
  U extends TUIContract = TUIContract
> = {
  readonly features: F;
  readonly ui: U;
};

/**
 * Clause `implements` unique pour une View (ADR-0042 C3, C15, I88).
 *
 * Fusionne :
 *  - `TChannelCallbacks<F>` : handlers channel (D48 channel — `on{NS}{Event}Event`)
 *  - `TUICallbacks<U>`      : handlers DOM     (D48 UI      — `on{UIKey}{DomEvent}`)
 *
 * Symétrie Contract/Callbacks : pour tout `TViewContract`, le développeur écrit
 * `extends View<TVC>` ET `implements TViewCallbacks<TVC>`.
 */
export type TViewCallbacks<TVC extends TViewContract> = TChannelCallbacks<
  TVC["features"]
> &
  TUICallbacks<TVC["ui"]>;

/**
 * Type structurel d'une classe View concrète, indépendant de son contrat.
 * Utilisé par les composants orchestrateurs (Composer) qui ne dépendent que
 * de la surface publique de mount, pas du contrat spécifique.
 *
 * Un seul `any` (vs `<any, any>` avant ADR-0042) — un seul générique sur View<>.
 * `...args: any[]` autorise tout constructeur ; les Vues concrètes peuvent
 * avoir ou non un constructeur explicite — la surface utilisée par le Composer
 * est `mount(rootSelector)`, indépendante du constructeur.
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

// ─── Helpers internes ────────────────────────────────────────────────────────

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
export abstract class View<TVC extends TViewContract = TViewContract> {
  #rootElement: string | null = null;
  #rootEl: HTMLElement | null = null;
  #mounted = false;
  #uiSelectors: Readonly<Record<string, string>> = {};
  #uiDomEvents: Readonly<Record<string, readonly string[]>> = {};
  #features: TFeatureContract = {};

  // ─── Abstract : trois sources de vérité (ADR-0042 / I81) ───────────────

  /**
   * Module Feature : Feature refs par lane (Feature-groupé).
   * Évalué une seule fois au mount (ADR-0024). Structurel — non-overridable.
   */
  abstract get features(): TVC["features"];

  /**
   * Module UI events : nœuds DOM + types HTML + events déclarés.
   * Structurel — non-overridable. Lu au mount pour D48 (`addEventListener`).
   */
  abstract get uiEvents(): TVC["ui"];

  /**
   * Module sélecteurs CSS — overridable par Composer (D34).
   * Le Composer peut injecter des overrides via `resolve() → options.uiElements`.
   */
  abstract get uiElements(): TUIElements<TVC["ui"]>;

  // ─── Public API ────────────────────────────────────────────────────────

  /** Le sélecteur rootElement injecté au mount (I31). */
  get rootElement(): string | null {
    return this.#rootElement;
  }

  /**
   * L'élément DOM racine après mount. Disponible dans onAttach() et les
   * handlers — permet aux sous-classes de lire les data-* attributes (I34).
   */
  protected get el(): HTMLElement | null {
    return this.#rootEl;
  }

  /**
   * Monte la View sur un rootElement. Appelé par le Composer.
   * - Lit `get features()` / `get uiEvents()` / `get uiElements()` une seule fois (ADR-0024)
   * - Résout le rootElement dans le DOM
   * - Auto-discover les UI handlers (D48 UI — pilotés par uiEvents[k].events)
   * - Auto-discover les Channel listeners (D48 channel — pilotés par features[NS].listens)
   * - Appelle onAttach()
   */
  mount(rootSelector: string): void {
    if (this.#mounted) return;
    this.#mounted = true;

    // ADR-0024 : lecture unique des modules contractuels
    this.#features = this.features;
    this.#uiSelectors = this.uiElements;

    // Extraction des events DOM par clé UI (runtime D48)
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
   * I39 — Accès DOM typé via `getUI(key)`. Résout dans le scope du rootElement (I40).
   * Le retour est `TProjectionNode<TEl>` où `TEl` est extrait du phantom `_el?`
   * de l'entrée UI déclarée — `element()` retourne le vrai sous-type HTML.
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
   * Envoie un Command typé via Channel (I4 — View ne peut qu'envoyer).
   *
   * `key` est une clé namespacée `"ns:cmd"` ; doit appartenir à
   * `TFlatTriggers<TVC["features"]>`, sinon erreur compile.
   * Exposé en `protected` — les sous-classes l'appellent depuis les handlers UI.
   */
  protected trigger<K extends TFlatTriggers<TVC["features"]> & string>(
    key: K,
    payload: TCommandPayloadFor<TVC["features"], K>
  ): void {
    const { namespace, name } = parseNSKey(key);
    // Cast vers Channel non paramétré pour l'enregistrement par string (I75).
    const ch = Radio.me().channel(namespace) as unknown as Channel;
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
  protected request<K extends TFlatRequests<TVC["features"]> & string>(
    key: K,
    params: TRequestParamsFor<TVC["features"], K>
  ): TRequestResultFor<TVC["features"], K> | null {
    const { namespace, name } = parseNSKey(key);
    // Cast vers Channel non paramétré pour l'enregistrement par string (I75).
    const ch = Radio.me().channel(namespace) as unknown as Channel;
    return ch.request(name, params) as TRequestResultFor<
      TVC["features"],
      K
    > | null;
  }

  // ─── Lifecycle hooks ───────────────────────────────────────────────────

  /** Hook appelé après le mount. Override dans les sous-classes. */
  onAttach(): void {
    // Default no-op
  }

  // ─── Private : Auto-discovery ──────────────────────────────────────────

  /**
   * D48 UI — pour chaque entrée `uiEvents[k]` avec `events: [E1, E2, ...]`,
   * câble `addEventListener(E)` sur l'élément résolu via `uiElements[k]` et
   * dispatche vers la méthode `on{Key}{Event}` correspondante.
   *
   * Convention : `events: ["click"]` sur `addBtn` → addEventListener("click")
   * → méthode `onAddBtnClick(e)`.
   *
   * Symétrie runtime de I84/I82 : un handler manquant déclenche une erreur
   * (le compile-time aurait dû la prévenir, mais filet de sécurité).
   */
  #registerUIHandlers(): void {
    const proto = Object.getPrototypeOf(this);
    const methods = Object.getOwnPropertyNames(proto) as string[];

    for (const uiKey of Object.keys(this.#uiDomEvents)) {
      const events = this.#uiDomEvents[uiKey];
      if (events.length === 0) continue; // C9 — non-interactif

      const uiKeyPascal = capitalize(uiKey);
      const selector = this.#uiSelectors[uiKey];
      if (!selector) {
        throw new Error(
          `[Bonsai View] UI key "${uiKey}" declared in uiEvents but missing in uiElements.`
        );
      }
      const el = this.#rootEl!.querySelector(selector) as HTMLElement;
      if (!el) continue; // pas d'élément = pas de listener (silencieux)

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
   * D48 channel — pour chaque Feature dans `features` et chaque event dans
   * `features[NS].listens`, câble la méthode `on{NS}{Event}Event` sur le
   * Channel correspondant.
   *
   * Symétrie runtime de I82 — `implements TViewCallbacks` impose la présence
   * compile-time ; ce filet attrape les contournements (cast `as any`).
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
