/**
 * @bonsai/composer — Composer abstract base class (migration lot M6.2)
 *
 * A Composer decides which Views exist in one slot, and in which order. It is
 * a child of a Foundation or of a View; it is the only creator of Views (D11).
 *
 *   - `get features()` — the Channels it listens to and queries (no `triggers`: D12)
 *   - `get views()`    — the finite catalogue of Views it can create
 *   - `resolve(ctx)`   — one pure decision: the ordered composition, from Queries only
 *
 * `resolve` runs twice at most per cause, only by the framework: during the
 * Composer's initialisation (in its creator's validation unit), then in the
 * unit of each Event declared in `features[NS].listens`. It never receives the
 * triggering Event: the composition is recomputed from the domain's state.
 *
 * Reconciliation (T3): same `key` and same View with equal `params` → the
 * instance is kept; otherwise it is destroyed, then created again; a `key`
 * that disappeared is destroyed with its descendants. The array order is the
 * order in the slot, placed explicitly (no dependence on history).
 *
 * Invariants:
 *   D11  — Views are created and destroyed only by Composers
 *   D12  — no Command, no Channel of its own, no state independent of its Views
 *   I35  — the Composer's structural writes are the attribution of parts
 *   T7   — parts are disjoint
 *
 * Known limit (C.3): a View whose element could not be created is not yet
 * destroyed logically; the failure is reported in the kernel trace only.
 *
 * @packageDocumentation
 */

import {
  DESCRIBE,
  describeComponent,
  type TComponentSpec,
  type TUnitContext
} from "@bonsai/event";
import type {
  TFeatureRefForNS,
  TFlatQueries,
  TQueryParamsFor,
  TQueryResultFor
} from "@bonsai/feature";
import type { TViewClass } from "@bonsai/view";

// ─── Contract types ──────────────────────────────────────────────────────────

/**
 * Features a Composer depends on: Events that make it decide again, Queries it
 * reads. No `triggers` lane: a Composer addresses no Command (D12).
 */
export type TComposerFeatures = {
  readonly [NS in string]: {
    readonly feature: TFeatureRefForNS<NS>;
    readonly listens: readonly string[];
    readonly queries: readonly string[];
  };
};

/** Finite catalogue of the Views a Composer can create. */
export type TViewCatalog = Readonly<Record<string, TViewClass>>;

/** The whole contract of a Composer: its Features and its Views. */
export type TComposerContract<
  F extends TComposerFeatures = TComposerFeatures,
  V extends TViewCatalog = TViewCatalog
> = {
  readonly features: F;
  readonly views: V;
};

/**
 * What `resolve` can do: ask Queries. Nothing else — no Command, no Event, no
 * state (D12).
 */
export type TComposeContext<TCC extends TComposerContract> = {
  query<K extends TFlatQueries<TCC["features"]> & string>(
    key: K,
    params: TQueryParamsFor<TCC["features"], K>
  ): TQueryResultFor<TCC["features"], K>;
};

/**
 * One View of the composition: which View of the catalogue, under which
 * `key` (unique in the composition), with which creation `params` (values only,
 * A3.d).
 */
export type TComposed<TCC extends TComposerContract> = {
  [K in keyof TCC["views"] & string]: {
    readonly view: K;
    readonly key: string;
    readonly params?: Readonly<Record<string, unknown>>;
  };
}[keyof TCC["views"] & string];

/** Ordered composition: the Views of the slot, in display order. */
export type TComposition<TCC extends TComposerContract> = ReadonlyArray<TComposed<TCC>>;

/** Structural type of a concrete Composer class, independent of its contract. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TComposerClass = abstract new (...args: any[]) => Composer<any>;

// ─── Composer abstract class ─────────────────────────────────────────────────

type TPresent = {
  readonly handle: ReturnType<TUnitContext["create"]>;
  readonly view: string;
  readonly params: string;
};

const stable = (value: unknown): string => JSON.stringify(value ?? null, (_k, v: unknown) =>
  v !== null && typeof v === "object" && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)))
    : v
);

export abstract class Composer<TCC extends TComposerContract = TComposerContract> {
  /** Features it listens to and queries (no `triggers`, D12). */
  abstract get features(): TCC["features"];

  /** Finite catalogue of the Views it can create. */
  abstract get views(): TCC["views"];

  /**
   * The single decision: the ordered composition, computed from Queries only.
   * Called by the framework, never by application code.
   */
  abstract resolve(ctx: TComposeContext<TCC>): TComposition<TCC>;

  /** @internal Description given to the kernel by the creator (Foundation or View). */
  [DESCRIBE](): TComponentSpec {
    const features = this.features as TComposerFeatures;
    const views = this.views as TViewCatalog;
    // Views present in the slot, by key — structural bookkeeping, rolled back with the unit (G7).
    const present = new Map<string, TPresent>();

    const reconcile = (c: TUnitContext): void => {
      const slot = c.resolve(c.designation()!);
      const composition = this.resolve({
        query: ((key: string, params: unknown) => {
          const idx = key.indexOf(":");
          return c.query(key.slice(0, idx), key.slice(idx + 1), params);
        }) as TComposeContext<TCC>["query"]
      });

      const keys = new Set<string>();
      for (const entry of composition) {
        if (keys.has(entry.key)) throw new Error(`[Bonsai Composer] duplicate key "${entry.key}" in a composition (T3)`);
        keys.add(entry.key);
        if (views[entry.view] === undefined) throw new Error(`[Bonsai Composer] View "${entry.view}" is not in the catalogue of ${this.constructor.name}`);
      }

      // Destroy what disappeared or changed (T3); the previous Views stay until the unit validates.
      const kept = new Set<string>();
      for (const [key, current] of [...present]) {
        const wanted = composition.find((e) => e.key === key);
        if (wanted !== undefined && wanted.view === current.view && stable(wanted.params) === current.params) {
          kept.add(key);
          continue;
        }
        c.destroy(current.handle);
        present.delete(key);
        c.journal(() => { present.set(key, current); });
      }

      // Create what is new, placing each View before the next one that already stays (explicit order).
      composition.forEach((entry, index) => {
        if (kept.has(entry.key)) return;
        const next = composition.slice(index + 1).find((e) => kept.has(e.key));
        const ViewClass = views[entry.view] as unknown as new () => object;
        const handle = c.create(describeComponent(new ViewClass()), {
          params: entry.params,
          part: { resource: slot, portion: entry.key, ...(next === undefined ? {} : { before: next.key }) }
        });
        const created: TPresent = { handle, view: entry.view, params: stable(entry.params) };
        present.set(entry.key, created);
        c.journal(() => { present.delete(entry.key); });
      });
    };

    const listens: NonNullable<TComponentSpec["listens"]>[number][] = [];
    for (const [namespace, entry] of Object.entries(features)) {
      for (const event of entry.listens) {
        listens.push({ namespace, event, handler: (_payload, c) => reconcile(c) });
      }
    }

    return {
      name: this.constructor.name,
      listens,
      init: (c) => reconcile(c)
    };
  }
}
