/**
 * @bonsai/valibot — Valibot wrapper for the Bonsai framework
 *
 * Tier 1 — integrated dependency (ADR-11, ADR-29):
 *   Developers use the Valibot API directly to define Entity schemas.
 *   Valibot is re-exported under a `Valibot` namespace (PascalCase)
 *   to keep the top level clean.
 *
 * Developer usage:
 *   import { Valibot } from "@bonsai/core";
 *   const schema = Valibot.object({ name: Valibot.string() });
 */
export * as Valibot from "valibot";
