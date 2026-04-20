/**
 * @bonsai/view — View base class
 *
 * Strate 0 — Capacités :
 *   - trigger(namespace, commandName, payload) → envoie un Command (pas d'emit — I4)
 *   - getUI(key) → TProjectionNode (mutations DOM chirurgicales N1 — D19)
 *   - Auto-discovery D48 : on{UiKey}{DomEvent} → addEventListener
 *   - Auto-discovery I48 : on{Channel}{EventName}Event → channel.listen
 *   - onAttach() lifecycle hook
 *
 * Déclarations via `get params()` (ADR-0024 value-first) :
 *   - uiElements: Record<string, selector> — les nœuds DOM manipulables
 *   - listen: readonly string[] — Channels écoutés (auto-discovery)
 *   - trigger: readonly string[] — Channels vers lesquels on peut trigger
 *
 * Invariants :
 *   I4  — View n'a JAMAIS emit() — absent du type
 *   I31 — rootElement est un sélecteur CSS string injecté au mount
 *   I36 — View ne compose jamais d'autres Views directement
 *   I39 — Accès DOM exclusivement via getUI(key)
 *   I40 — Scope DOM : résolution dans rootElement uniquement
 *   I48 — Handlers auto-découverts par convention de nommage
 *   D48 — UI handlers auto-dérivés depuis uiElements
 *
 * @packageDocumentation
 */

import { Radio } from "@bonsai/event";

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Projection Node N1 — mutations DOM chirurgicales.
 * Chaque méthode opère directement sur l'élément HTML sous-jacent.
 */
export type TProjectionNode = {
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
  /** Returns the underlying HTMLElement */
  element(): HTMLElement;
};

/**
 * Manifeste retourné par `get params()` — ADR-0024 value-first.
 * Évalué une seule fois au mount, puis destructuré en champs privés.
 */
export type TViewParams = {
  /** Nœuds DOM manipulables : clé → sélecteur CSS */
  readonly uiElements: Readonly<Record<string, string>>;
  /** Channels dont cette View écoute les Events (auto-discovery I48) */
  readonly listen: readonly string[];
  /** Channels vers lesquels cette View peut trigger des Commands */
  readonly trigger: readonly string[];
};

// ─── ProjectionNode factory ──────────────────────────────────────────────────

function createProjectionNode(el: HTMLElement): TProjectionNode {
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
    element(): HTMLElement {
      return el;
    }
  };
}

// ─── View abstract class ─────────────────────────────────────────────────────

export abstract class View {
  #rootElement: string | null = null;
  #rootEl: HTMLElement | null = null;
  #mounted = false;
  #uiElements: Readonly<Record<string, string>> = {};
  #listenChannels: readonly string[] = [];

  // ─── Abstract : ADR-0024 value-first ───────────────────────────────────

  /**
   * Manifeste de la View (ADR-0024).
   * Évalué UNE SEULE FOIS au mount — le framework destructure et stocke.
   *
   * Pattern d'usage :
   * ```typescript
   * const myViewParams = {
   *   uiElements: { title: "[data-ui='title']", btn: "[data-ui='btn']" },
   *   listen: ["cart"],
   *   trigger: ["cart"],
   * } as const satisfies TViewParams;
   *
   * class MyView extends View {
   *   get params() { return myViewParams; }
   * }
   * ```
   */
  abstract get params(): TViewParams;

  // ─── Public API ────────────────────────────────────────────────────────

  /**
   * Le sélecteur rootElement injecté au mount (I31).
   */
  get rootElement(): string | null {
    return this.#rootElement;
  }

  /**
   * Monte la View sur un rootElement. Appelé par le Composer.
   * - Lit `get params()` une seule fois (ADR-0024)
   * - Résout le rootElement dans le DOM
   * - Auto-discover les UI handlers (D48)
   * - Auto-discover les Event listeners (I48)
   * - Appelle onAttach()
   */
  mount(rootSelector: string): void {
    if (this.#mounted) return;
    this.#mounted = true;

    // ADR-0024 : lecture unique du manifeste
    const params = this.params;
    this.#uiElements = params.uiElements;
    this.#listenChannels = params.listen;

    this.#rootElement = rootSelector;
    this.#rootEl = document.querySelector(rootSelector) as HTMLElement;

    // Auto-discovery
    this.#registerUIHandlers();
    this.#registerEventListeners();

    // Lifecycle
    this.onAttach();
  }

  /**
   * I39 — Accès DOM via getUI(key). Résout dans le scope du rootElement (I40).
   */
  getUI(key: string): TProjectionNode {
    const selector = this.#uiElements[key];
    if (!selector) {
      throw new Error(
        `[Bonsai View] Unknown UI key "${key}". Declared keys: ${Object.keys(this.#uiElements).join(", ")}`
      );
    }

    const el = this.#rootEl!.querySelector(selector) as HTMLElement;
    if (!el) {
      throw new Error(
        `[Bonsai View] UI element "${key}" not found with selector "${selector}" in rootElement "${this.#rootElement}"`
      );
    }

    return createProjectionNode(el);
  }

  /**
   * Sends a Command via Channel. View can only trigger, never emit (I4).
   * Exposed as protected — subclasses call it from UI handlers.
   */
  protected trigger(
    targetNamespace: string,
    commandName: string,
    payload: unknown
  ): void {
    const channel = Radio.me().channel(targetNamespace);
    channel.trigger(commandName, payload);
  }

  /**
   * Public wrapper for trigger — used in tests to call trigger externally.
   * In production, trigger is called from UI handlers only.
   */
  callTrigger(
    targetNamespace: string,
    commandName: string,
    payload: unknown
  ): void {
    this.trigger(targetNamespace, commandName, payload);
  }

  // ─── Lifecycle hooks ───────────────────────────────────────────────────

  /**
   * Hook appelé après le mount. Override dans les sous-classes.
   */
  onAttach(): void {
    // Default no-op
  }

  // ─── Private : Auto-discovery ──────────────────────────────────────────

  /**
   * D48 — Découvre les méthodes `on{UiKey}{DomEvent}` et les enregistre
   * comme addEventListener sur les éléments UI correspondants.
   *
   * Convention : `onToggleBtnClick` → addEventListener("click") sur uiElements.toggleBtn
   */
  #registerUIHandlers(): void {
    const proto = Object.getPrototypeOf(this);
    const methods = Object.getOwnPropertyNames(proto);

    const DOM_EVENTS = [
      "Click",
      "Input",
      "Change",
      "Submit",
      "Focus",
      "Blur",
      "Keydown",
      "Keyup",
      "Keypress",
      "Mouseenter",
      "Mouseleave"
    ];

    for (const uiKey of Object.keys(this.#uiElements)) {
      const uiKeyPascal = uiKey[0].toUpperCase() + uiKey.slice(1);

      for (const domEvent of DOM_EVENTS) {
        const handlerName = `on${uiKeyPascal}${domEvent}`;
        if (methods.includes(handlerName)) {
          const selector = this.#uiElements[uiKey];
          const el = this.#rootEl!.querySelector(selector) as HTMLElement;
          if (el) {
            el.addEventListener(domEvent.toLowerCase(), (event: Event) => {
              (this as any)[handlerName](event);
            });
          }
        }
      }
    }
  }

  /**
   * I48 — Découvre les méthodes `on{Channel}{EventName}Event` et les enregistre
   * comme listeners sur les Channels déclarés dans params.listen.
   *
   * Même pattern que Feature.#registerEventListeners().
   */
  #registerEventListeners(): void {
    if (this.#listenChannels.length === 0) return;

    const proto = Object.getPrototypeOf(this);
    const methods = Object.getOwnPropertyNames(proto);

    for (const channelName of this.#listenChannels) {
      const channelPascal = channelName[0].toUpperCase() + channelName.slice(1);
      const prefix = `on${channelPascal}`;
      const suffix = "Event";

      for (const method of methods) {
        if (method.startsWith(prefix) && method.endsWith(suffix)) {
          const eventPascal = method.slice(prefix.length, -suffix.length);
          if (eventPascal.length === 0) continue;

          const eventName = eventPascal[0].toLowerCase() + eventPascal.slice(1);
          const channel = Radio.me().channel(channelName);

          channel.listen(eventName, (payload: unknown) => {
            (this as any)[method](payload);
          });
        }
      }
    }
  }
}
