/**
 * @bonsai/immer — Wrapper Immer pour le framework Bonsai
 *
 * Tier 3 — Dépendance opaque (ADR-0032 §3) :
 *   Le framework utilise Immer en interne pour les mutations
 *   immutables d'Entity via `mutate()` (ADR-0001).
 *   Les types Immer (`Draft`, `Patch`, etc.) apparaissent dans
 *   le .d.ts sous le namespace `Immer` mais ne font pas partie
 *   de l'API publique documentée.
 *
 * Le namespace `Immer` encapsule tous les exports immer pour éviter
 * la pollution du top-level (même pattern que `RXJS`, `Valibot`).
 *
 * Usage interne :
 *   import { Immer } from "@bonsai/immer";
 *   const nextState = Immer.produce(state, draft => { draft.count++; });
 */
export * as Immer from "immer";
