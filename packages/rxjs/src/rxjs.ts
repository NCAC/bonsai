/**
 * @bonsai/rxjs — RxJS wrapper for the Bonsai framework
 *
 * Tier 3 — opaque dependency (ADR-29):
 *   The framework uses RxJS internally for its event system.
 *   RxJS types appear in the .d.ts under the `RXJS` namespace but
 *   are not part of the documented public API.
 *
 * The `RXJS` namespace wraps all rxjs exports to keep the top level
 * clean (same pattern as `Valibot`).
 *
 * Internal usage:
 *   import { RXJS } from "@bonsai/rxjs";
 *   const subject = new RXJS.Subject<T>();
 *   subject.pipe(RXJS.take(1)).subscribe(...);
 */
export * as RXJS from "rxjs";
