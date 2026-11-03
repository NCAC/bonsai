/**
 * Default technical sink of the trace (O2): reports on the console the failures
 * that no component receives. Outside the application transport, it admits
 * nothing.
 *
 * Reported:
 * - a failed unit after startup (a failed startup is thrown by `start()`);
 * - a failed effect whose owner does not receive it in an `$effects` result
 *   (C.3), with the effects it left not attempted;
 * - a message or an admission abandoned at the causal bound (D9).
 */

import type { TTraceEntry } from "./types";

/** Console used by the sink; injected by tests. */
export type TTraceConsole = Pick<Console, "error" | "warn">;

/** Name of the startup unit's owner: its failure is thrown, not reported. */
const STARTUP_OWNER = "root";

export function reportToConsole(entry: TTraceEntry, output: TTraceConsole = console): void {
  switch (entry.type) {
    case "unit-failed":
      if (entry.owner === STARTUP_OWNER) return;
      output.error(`[Bonsai] a treatment of "${entry.owner}" failed and was rolled back (G7)`, entry.error);
      return;
    case "effects":
      entry.report.forEach((line, index) => {
        if (line.outcome !== "failed" || line.admitted) return;
        const skipped = entry.report
          .filter((later) => later.closedBy === index)
          .map((later) => `"${later.label}" (${later.owner})`);
        const suffix = skipped.length === 0 ? "" : `; not attempted because of it: ${skipped.join(", ")}`;
        output.warn(`[Bonsai] effect "${line.label}" of "${line.owner}" failed (C.3)${suffix}`, line.error);
      });
      return;
    case "delivery-abandoned":
    case "admission-abandoned":
      if (entry.reason !== "causal bound") return;
      output.warn(`[Bonsai] "${entry.name}" abandoned: causal bound reached (D9)`);
      return;
    default:
      return;
  }
}
