/**
 * @bonsai/view — View base class
 *
 * Strate 0 — Capacités :
 *   - trigger("ns:cmd", payload) → envoie un Command typé (I4, ADR-0040, ADR-0041)
 *   - request("ns:req", params)  → interroge un Channel typé (ADR-0040, ADR-0041)
 *   - getUI(key) → TProjectionNode (mutations DOM chirurgicales N1 — D19)
 *   - Auto-discovery D48 : on{UiKey}{DomEvent} → addEventListener
 *   - Auto-discovery I48 : on{Namespace}{EventName}Event → channel.listen
 *   - onAttach() lifecycle hook
 *
 * Pattern consommateur unifié (ADR-0041) :
 *   - Étape 1 — `type TMyDeps = { listens: [typeof XFeature]; ... }`  (type pur)
 *   - Étape 2 — `const myContract = { ... } satisfies TViewContract<TMyDeps>`
 *   - Étape 3 — `type TMyContract = typeof myContract`  (préserve les littéraux)
 *   - Étape 4 — `class MyView extends View<TMyDeps, TMyContract>
 *                 implements TListenCallbacks<TMyDeps, TMyContract>`
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
 *   I48 — Handlers auto-découverts par convention de nommage,
 *         déclarés dans contract.listens, vérifiés par implements TListenCallbacks
 *   D48 — UI handlers auto-dérivés depuis uiElements
 *   I75 — Aucun `any` dans la surface publique ; casts internes documentés
 *   I80 — Aucun TChannelToken dans la surface publique consommateur
 *   I81 — `contract` est la source de vérité runtime du composant
 *   I82 — Handler manquant → erreur compile via implements TListenCallbacks
 *   I83 — Pattern unifié View / Composer / Behavior
 *
 * @packageDocumentation
 */

import { Radio, type Channel } from "@bonsai/event";
import type {
  TConsumerDeps,
  TConsumerContract,
  TCommandPayload,
  TRequestParams,
  TRequestResult
} from "@bonsai/feature";

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
 * Contrat View — étend `TConsumerContract<TDeps>` (ADR-0041) avec la map
 * `uiElements` propre à la couche DOM.
 *
 * Les trois lanes (`listens` / `triggers` / `requests`) portent des clés
 * namespacées `"ns:name"` validées par `satisfies` contre les Features
 * déclarées dans `TDeps`.
 */
export type TViewContract<TDeps extends TConsumerDeps> = TConsumerContract<TDeps> & {
  /** Nœuds DOM manipulables : clé → sélecteur CSS */
  readonly uiElements: Readonly<Record<string, string>>;
};

/**
 * Type structurel d'une classe View concrète, indépendant de ses paramètres
 * `TDeps` / `TContract`. Utilisé par les composants orchestrateurs (Composer)
 * qui ne dépendent que de la surface publique de mount, pas du contrat
 * spécifique d'une View particulière.
 *
 * **Pourquoi `any, any`** : les paramètres de type d'une classe générique sont
 * invariants en TypeScript. `typeof View` (defaults) n'accepterait pas
 * `typeof CartView` (génériques concrets). `TViewClass` est l'échappatoire
 * structurelle bornée à cette frontière framework-interne. Le code applicatif
 * n'utilise jamais ce type — il déclare ses `TDeps`/`TContract` concrets (I80, I83).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TViewClass = abstract new () => View<any, any>;

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

// ─── View abstract class ─────────────────────────────────────────────────────

/**
 * View — couche présentation paramétrée par ses dépendances Feature et
 * son contrat namespacé (ADR-0041).
 *
 * Paramètres de type :
 *   - `TDeps`     : Features participant à chaque lane (type pur, étape 1)
 *   - `TContract` : contrat namespacé runtime (étape 2 + 3 — `typeof myContract`)
 *
 * Pattern d'usage :
 * ```ts
 * type TCartViewDeps = {
 *   readonly listens:  [typeof CartFeature];
 *   readonly triggers: [typeof CartFeature];
 *   readonly requests: [typeof CartFeature];
 * };
 *
 * const cartViewContract = {
 *   uiElements: { itemCount: "[data-ui='itemCount']", addBtn: "[data-ui='addBtn']" },
 *   listens:  ["cart:itemAdded"] as const,
 *   triggers: ["cart:addItem"]  as const,
 *   requests: [] as const,
 * } satisfies TViewContract<TCartViewDeps>;
 *
 * type TCartViewContract = typeof cartViewContract;
 *
 * class CartView
 *   extends View<TCartViewDeps, TCartViewContract>
 *   implements TListenCallbacks<TCartViewDeps, TCartViewContract>
 * {
 *   get contract() { return cartViewContract; }
 *
 *   onAddBtnClick() {
 *     this.trigger("cart:addItem", { ... });   // ✅ payload inféré
 *   }
 *
 *   onCartItemAddedEvent(payload) { ... }      // ✅ requis par implements
 * }
 * ```
 */
export abstract class View<
  TDeps extends TConsumerDeps = TConsumerDeps,
  TContract extends TViewContract<TDeps> = TViewContract<TDeps>
> {
  #rootElement: string | null = null;
  #rootEl: HTMLElement | null = null;
  #mounted = false;
  #uiElements: Readonly<Record<string, string>> = {};
  #listenKeys: readonly string[] = [];

  // ─── Abstract : ADR-0024 value-first ───────────────────────────────────

  /**
   * Manifeste de la View (ADR-0024 + ADR-0041).
   * Évalué UNE SEULE FOIS au mount — le framework destructure et stocke.
   * Le retour est typé `TContract` pour préserver les types littéraux des
   * tableaux `listens` / `triggers` / `requests` côté sous-classe.
   */
  abstract get contract(): TContract;

  // ─── Public API ────────────────────────────────────────────────────────

  /**
   * Le sélecteur rootElement injecté au mount (I31).
   */
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
   * - Lit `get contract()` une seule fois (ADR-0024)
   * - Résout le rootElement dans le DOM
   * - Auto-discover les UI handlers (D48)
   * - Auto-discover les Event listeners (I48 — pilotés par contract.listens)
   * - Appelle onAttach()
   */
  mount(rootSelector: string): void {
    if (this.#mounted) return;
    this.#mounted = true;

    // ADR-0024 : lecture unique du manifeste
    const contract = this.contract;
    this.#uiElements = contract.uiElements;
    // Cast vers readonly string[] pour l'enregistrement runtime (I75) — la
    // contrainte type-level est portée par TContract.
    this.#listenKeys = contract.listens as readonly string[];

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
    this.#registerEventListeners();

    // Lifecycle
    this.onAttach();
  }

  /**
   * I39 — Accès DOM typé via getUI(key). Résout dans le scope du rootElement (I40).
   * `K` est contraint à `keyof TContract['uiElements']` — clé invalide refusée compile-time.
   */
  getUI<K extends keyof TContract["uiElements"] & string>(key: K): TProjectionNode {
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
   * Envoie un Command typé via Channel (I4 — View ne peut qu'envoyer,
   * jamais émettre, ADR-0040 / ADR-0041).
   *
   * `key` est une clé namespacée `"ns:cmd"` ; doit appartenir à
   * `TContract['triggers']`, sinon erreur compile.
   * Exposé en `protected` — les sous-classes l'appellent depuis les handlers UI.
   */
  protected trigger<K extends TContract["triggers"][number] & string>(
    key: K,
    payload: TCommandPayload<TDeps, K>
  ): void {
    const { namespace, name } = parseNSKey(key);
    // Cast vers Channel non paramétré pour l'enregistrement par string (I75).
    const ch = Radio.me().channel(namespace) as unknown as Channel;
    ch.trigger(name, payload);
  }

  /**
   * Wrapper public de trigger — utilisé dans les tests pour déclencher depuis
   * l'extérieur. En production, trigger est appelé depuis les handlers UI.
   */
  callTrigger<K extends TContract["triggers"][number] & string>(
    key: K,
    payload: TCommandPayload<TDeps, K>
  ): void {
    this.trigger(key, payload);
  }

  /**
   * Effectue une Request synchrone typée vers un Channel déclaré (ADR-0023,
   * ADR-0040 / ADR-0041). Retourne le résultat typé ou `null` si aucun replier
   * n'est enregistré côté Feature propriétaire (D44).
   *
   * `key` est une clé namespacée `"ns:req"` ; doit appartenir à
   * `TContract['requests']`, sinon erreur compile.
   */
  protected request<K extends TContract["requests"][number] & string>(
    key: K,
    params: TRequestParams<TDeps, K>
  ): TRequestResult<TDeps, K> | null {
    const { namespace, name } = parseNSKey(key);
    // Cast vers Channel non paramétré pour l'enregistrement par string (I75).
    const ch = Radio.me().channel(namespace) as unknown as Channel;
    return ch.request(name, params) as TRequestResult<TDeps, K> | null;
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
    const methods = Object.getOwnPropertyNames(proto) as string[];

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
      const uiKeyPascal = capitalize(uiKey);

      for (const domEvent of DOM_EVENTS) {
        const handlerName = `on${uiKeyPascal}${domEvent}`;
        if (methods.includes(handlerName)) {
          const selector = this.#uiElements[uiKey];
          const el = this.#rootEl!.querySelector(selector) as HTMLElement;
          if (el) {
            el.addEventListener(domEvent.toLowerCase(), (event: Event) => {
              (this as unknown as Record<string, (e: Event) => void>)[handlerName](event);
            });
          }
        }
      }
    }
  }

  /**
   * I48 — Pour chaque clé `"ns:event"` déclarée dans `contract.listens`,
   * câble la méthode `on{Ns}{Event}Event` correspondante sur le Channel `ns`.
   *
   * Le contrat est piloté par la déclaration : un handler manquant pour une
   * clé déclarée → throw (parallèle runtime de I82 — `implements TListenCallbacks`
   * impose la présence à la compilation).
   */
  #registerEventListeners(): void {
    if (this.#listenKeys.length === 0) return;

    for (const key of this.#listenKeys) {
      const { namespace, name: eventName } = parseNSKey(key);
      const handlerName = `on${capitalize(namespace)}${capitalize(eventName)}Event`;

      const handler = (this as unknown as Record<string, unknown>)[handlerName];
      if (typeof handler !== "function") {
        throw new Error(
          `[Bonsai View] Missing handler "${handlerName}" for declared listen "${key}". ` +
            `Add the method or remove "${key}" from contract.listens.`
        );
      }

      // Cast vers Channel non paramétré pour l'enregistrement par string (I75).
      const ch = Radio.me().channel(namespace) as unknown as Channel;
      ch.listen(eventName, (payload: unknown) => {
        (handler as (p: unknown) => void).call(this, payload);
      });
    }
  }
}
