/**
 * @bonsai/valibot — Wrapper Valibot pour le framework Bonsai
 *
 * Tier 1 — Dépendance intégrée (ADR-0022 + ADR-0032 §3) :
 *   Le développeur utilise directement l'API Valibot pour définir
 *   les schémas Entity. Valibot est ré-exporté sous un namespace
 *   `Valibot` (PascalCase) pour éviter la pollution du top-level.
 *
 * Usage développeur :
 *   import { Valibot } from "@bonsai/core";
 *   const schema = Valibot.object({ name: Valibot.string() });
 */
export * as Valibot from "valibot";
