/**
 * Test — `__DEV__` is a compile-time constant of each framework bundle (ADR-06)
 *
 * Reads the versioned artefacts (ADR-30): `core/dist/bonsai.js` is the
 * development bundle, `core/dist/bonsai.prod.js` the production bundle, chosen
 * by the `production` condition of `exports` in `core/package.json`.
 */

import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..", "..");
const read = (file: string): string => readFileSync(join(root, "core", "dist", file), "utf8");
/** Code without its comments, which may still name `__DEV__`. */
const code = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("ADR-06 — development and production bundles", () => {
  it("leaves no free `__DEV__` in either bundle", () => {
    for (const file of ["bonsai.js", "bonsai.prod.js"]) {
      expect(code(read(file))).not.toMatch(/\b__DEV__\b/);
    }
  });

  it("keeps the console sink of the trace in development only (O2)", () => {
    expect(code(read("bonsai.js"))).toMatch(/reportToConsole\(entry\)/);
    expect(code(read("bonsai.prod.js"))).not.toMatch(/reportToConsole/);
  });

  it("selects the production bundle by the `production` condition of `exports`", () => {
    const pkg = JSON.parse(readFileSync(join(root, "core", "package.json"), "utf8")) as {
      exports: { ".": Record<string, string> };
    };
    expect(pkg.exports["."]).toEqual({
      types: "./dist/bonsai.d.ts",
      production: "./dist/bonsai.prod.js",
      default: "./dist/bonsai.js"
    });
  });
});
