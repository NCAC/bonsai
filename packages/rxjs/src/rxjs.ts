/**
 * @bonsai/rxjs — Wrapper RxJS pour le framework Bonsai
 *
 * Tier 3 — Dépendance opaque (ADR-0032 §3) :
 *   Le framework utilise RxJS en interne pour le système événementiel.
 *   Les types RxJS apparaissent dans le .d.ts sous le namespace `RXJS`
 *   mais ne font pas partie de l'API publique documentée.
 *
 * Le namespace `RXJS` encapsule tous les types rxjs pour éviter
 * la pollution du top-level (même pattern que `Valibot`).
 *
 * Usage interne :
 *   import { RXJS } from "@bonsai/rxjs";
 *   const subject = new RXJS.Subject<T>();
 *   subject.pipe(RXJS.take(1)).subscribe(...);
 */
export * as RXJS from "rxjs";
