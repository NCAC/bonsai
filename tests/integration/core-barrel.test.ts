/**
 * Test — `@bonsai/core` re-exports every component package (ADR-28).
 *
 * Checks the barrel source (mapped by Jest) and the export list of the
 * versioned bundles (ADR-30), which must carry the same public names.
 */

import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as core from "@bonsai/core";

const COMPONENTS = [
  "Application",
  "Feature",
  "Entity",
  "View",
  "Composer",
  "Foundation",
  "RouterFeature",
  "RouteEntity",
  "HistoryAdapter",
  "BonsaiError",
  "invariant"
] as const;

/** Names listed by the final `export { … }` statement of a bundle. */
function bundleExports(file: string): string[] {
  const source = readFileSync(join(__dirname, "..", "..", "core", "dist", file), "utf8");
  const list = [...source.matchAll(/^export \{([^}]*)\};?\s*$/gm)].pop()?.[1] ?? "";
  return list.split(",").map((name) => name.trim().split(/\s+as\s+/).pop()!).filter(Boolean);
}

describe("ADR-28 — @bonsai/core re-exports every component", () => {
  it("exposes the Entity, the router and the error helpers next to the other components", () => {
    for (const name of COMPONENTS) expect(typeof (core as Record<string, unknown>)[name]).toBe("function");
  });

  it("carries the same names in the development and production bundles", () => {
    for (const file of ["bonsai.js", "bonsai.prod.js"]) {
      expect(bundleExports(file)).toEqual(expect.arrayContaining([...COMPONENTS]));
    }
  });

  it("keeps the kernel root internal (I15)", () => {
    expect("Root" in core).toBe(false);
    for (const file of ["bonsai.js", "bonsai.prod.js"]) expect(bundleExports(file)).not.toContain("Root");
  });
});
