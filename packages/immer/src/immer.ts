/**
 * @bonsai/immer — Immer wrapper for the Bonsai framework
 *
 * Tier 3 — opaque dependency (ADR-29):
 *   The framework uses Immer internally for immutable Entity
 *   mutations through `mutate()` (ADR-10).
 *   Immer types (`Draft`, `Patch`, etc.) appear in the .d.ts under
 *   the `Immer` namespace but are not part of the documented public API.
 *
 * The `Immer` namespace wraps all immer exports to keep the top level
 * clean (same pattern as `RXJS`, `Valibot`).
 *
 * Internal usage:
 *   import { Immer } from "@bonsai/immer";
 *   const nextState = Immer.produce(state, draft => { draft.count++; });
 */
export * as Immer from "immer";
