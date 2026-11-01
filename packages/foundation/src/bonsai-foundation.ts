/**
 * @bonsai/foundation — Foundation abstract base class (migration lot M6.2)
 *
 * One Foundation per root (G6). It is a child of the root, which owns its
 * existence. It admits one element of the host as a distributable resource —
 * by default `body` — and attributes the content of its declared slots to
 * Composers. It creates no View (D11) and has no Channel in V1.
 *
 *   - `get composers()` — the slots of the admitted element, each with the
 *     Composer that receives its content. Read once, at startup (I67).
 *
 * A slot is a selector that must match exactly one element inside the admitted
 * element; otherwise its materialisation fails and is reported (Foundation §3).
 *
 * Removed with this lot: the `body` / `html` getters (the Foundation holds no
 * host element: theory D3, Foundation §2) and the `onAttach` / `onDetach`
 * hooks (global DOM listeners are a matter for adapters, D7).
 *
 * Invariants:
 *   I20  — Only Composers create or destroy Views
 *   I67  — Structural stability of the Foundation's first level (ADR-20)
 *
 * @packageDocumentation
 */

import {
  DESCRIBE,
  describeComponent,
  type TComponentSpec
} from "@bonsai/event";
import type { TComposerClass } from "@bonsai/composer";

// ─── Types ───────────────────────────────────────────────────────────────────

/** A slot of the admitted element and the Composer that receives its content. */
export type TSlotDeclaration = {
  /** CSS selector matching exactly one element inside the admitted element. */
  readonly slot: string;
  readonly composer: TComposerClass;
};

/** Slots by key. The key names the portion; it must be unique. */
export type TFoundationSlots = Readonly<Record<string, TSlotDeclaration>>;

/** Options the Application gives when it creates the Foundation. */
export type TFoundationOptions = {
  /** CSS selector of the element admitted by the Foundation. Default `body`. */
  readonly anchor?: string;
};

// ─── Foundation abstract class ───────────────────────────────────────────────

export abstract class Foundation {
  /**
   * Declares the Foundation's slots — Composer §1.3.
   *
   * @example
   *   get composers() {
   *     return { main: { slot: "[data-slot='main']", composer: MainComposer } } as const;
   *   }
   */
  abstract get composers(): TFoundationSlots;

  /** @internal Description given to the kernel by the Application. */
  [DESCRIBE](options?: TFoundationOptions): TComponentSpec {
    return {
      name: this.constructor.name,
      init: (c) => {
        const anchor = c.admitDistributable(options?.anchor ?? "body");
        for (const [key, { slot, composer }] of Object.entries(this.composers)) {
          const ComposerClass = composer as unknown as new () => object;
          c.create(describeComponent(new ComposerClass()), {
            part: { resource: anchor, portion: key, host: slot }
          });
        }
      }
    };
  }
}
