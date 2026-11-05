/**
 * Test — Pug compiler: analysis of template expressions (strate 1c, lot 4)
 *
 * Free identifiers are data fields or scope variables; the compiler renames
 * scope variables to unique names without touching anything else.
 */

import { describe, it, expect } from "@jest/globals";
import { analyzeExpression, staticValue } from "@tools/pug-compiler/src/expression";

const free = (src: string): string[] => [...analyzeExpression(src)!.free].sort();
const rewrite = (src: string, names: Record<string, string>): string =>
  analyzeExpression(src)!.rewrite(new Map(Object.entries(names)));

describe("analyzeExpression", () => {
  it("free identifiers: references only, not properties, keys, locals nor globals", () => {
    expect(free("a.b + c[d] + { e: f, g }.e")).toEqual(["a", "c", "d", "f", "g"]);
    expect(free("xs.map((x, i) => x + i + y)")).toEqual(["xs", "y"]);
    expect(free("xs.map(({ k: [v] }) => v)")).toEqual(["xs"]);
    expect(free("function named(p) { const q = p; return named(q) + r; }")).toEqual(["r"]);
    expect(free("Math.max(a, NaN) + JSON.stringify(undefined) + String(b)")).toEqual(["a", "b"]);
    expect(free("({ m() { return z; }, get n() { return 1; } })")).toEqual(["z"]);
    expect(free("a as unknown as T")).toEqual(["a"]);
  });

  it("rewrite renames scope variables, expanding shorthand properties", () => {
    expect(rewrite("item.name + item.qty", { item: "item$1" })).toBe("item$1.name + item$1.qty");
    expect(rewrite("{ item, n }", { item: "item$1" })).toBe("{ item: item$1, n }");
    expect(rewrite("xs.map((item) => item.id + other)", { item: "item$1", other: "other$2" })).toBe(
      "xs.map((item) => item.id + other$2)"
    );
    expect(rewrite("  a  ", {})).toBe("a");
  });

  it("not a single expression: null", () => {
    expect(analyzeExpression("a +")).toBeNull();
    expect(analyzeExpression("a; b")).toBeNull();
    expect(analyzeExpression("")).toBeNull();
  });
});

describe("staticValue", () => {
  it("constants are static, anything else dynamic", () => {
    expect(staticValue("'a'")).toBe("a");
    expect(staticValue('"b"')).toBe("b");
    expect(staticValue("`c`")).toBe("c");
    expect(staticValue("3.50")).toBe("3.5");
    expect(staticValue("true")).toBe(true);
    expect(staticValue("false")).toBe(false);
    expect(staticValue(true)).toBe(true);
    expect(staticValue("`${a}`")).toBeUndefined();
    expect(staticValue("a")).toBeUndefined();
    expect(staticValue("a +")).toBeUndefined();
  });
});
