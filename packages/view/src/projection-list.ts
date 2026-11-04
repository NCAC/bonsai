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

import { BonsaiError } from "@bonsai/error";

/** Options of a `ProjectionList` (5-rendu §6.1). */
export type TProjectionListOptions<TItem, TItemNodes> = {
  /** Attribute carrying the key of each item element, e.g. `"data-item-id"`. */
  readonly keyAttr: string;
  /** Unique key of an item. */
  readonly key: (item: TItem) => string;
  /** Creates the element of a new item; the list sets `keyAttr` on it. */
  readonly create: (item: TItem) => HTMLElement;
  /** Locates the dynamic nodes of an item element. */
  readonly setup: (el: HTMLElement) => TItemNodes;
  /**
   * Updates the nodes of an item. Called for every item on every
   * reconciliation, changed or not: it must guard each node
   * (`if (node.textContent !== value)`) and never create nor remove nodes (R5).
   */
  readonly update: (nodes: TItemNodes, item: TItem, index: number) => void;
};

type TEntry<TItemNodes> = { readonly el: HTMLElement; readonly nodes: TItemNodes };

/**
 * Keyed list over the element children of a container. At construction it
 * adopts the children carrying `keyAttr` — those `create()` of the template
 * just produced, or a server rendering (ADR-24) — without recreating them.
 */
export class ProjectionList<TItem, TItemNodes> {
  readonly #container: HTMLElement;
  readonly #options: TProjectionListOptions<TItem, TItemNodes>;
  readonly #entries = new Map<string, TEntry<TItemNodes>>();

  constructor(container: HTMLElement, options: TProjectionListOptions<TItem, TItemNodes>) {
    this.#container = container;
    this.#options = options;
    for (const child of Array.from(container.children)) {
      const key = child.getAttribute(options.keyAttr);
      if (key === null) continue;
      if (this.#entries.has(key)) throw ProjectionList.#duplicate(key);
      const el = child as HTMLElement;
      this.#entries.set(key, { el, nodes: options.setup(el) });
    }
  }

  /**
   * Reconciles the container with `items`, in this order: updates known items,
   * moves only misplaced ones (`insertBefore`), creates new ones, removes the
   * elements whose key is gone. O(n) through the map of keys.
   */
  reconcile(items: readonly TItem[]): void {
    const { keyAttr, key, create, setup, update } = this.#options;
    const container = this.#container;
    const seen = new Set<string>();
    let previous: Element | null = null;
    items.forEach((item, index) => {
      const k = key(item);
      if (seen.has(k)) throw ProjectionList.#duplicate(k);
      seen.add(k);
      let entry = this.#entries.get(k);
      if (entry === undefined) {
        const el = create(item);
        el.setAttribute(keyAttr, k);
        entry = { el, nodes: setup(el) };
        this.#entries.set(k, entry);
      }
      const expected: Element | null = previous === null ? container.firstElementChild : previous.nextElementSibling;
      if (entry.el !== expected) container.insertBefore(entry.el, expected);
      update(entry.nodes, item, index);
      previous = entry.el;
    });
    for (const [k, entry] of this.#entries) {
      if (seen.has(k)) continue;
      entry.el.remove();
      this.#entries.delete(k);
    }
  }

  /** Nodes of an item by its key. */
  nodes(key: string): TItemNodes | undefined {
    return this.#entries.get(key)?.nodes;
  }

  static #duplicate(key: string): BonsaiError {
    return new BonsaiError("DUPLICATE_KEY", `duplicate key "${key}" in a list.`, {
      component: "ProjectionList",
      suggestion: "Each item needs a unique key (key / keyAttr)."
    });
  }
}
