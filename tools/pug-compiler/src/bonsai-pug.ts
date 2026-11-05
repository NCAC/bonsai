/**
 * Pug → projection template compiler (strate 1c, lot 4, ADR-22).
 *
 * Compiles a `.pug` template into a TypeScript module exporting a
 * `TProjectionTemplate<TData, TNodes>` of `@bonsai/view`: `create()` builds
 * the DOM, `setup()` locates its dynamic nodes, `project()` applies guarded
 * mutations. No VDOM, no parsing at runtime.
 *
 * The type of the data is declared in the template:
 *
 *   //- @data import("./cart.types").TCartData
 *
 * @packageDocumentation
 */
import { basename } from "node:path";
import { lex } from "./pug/lexer";
import { parse } from "./pug/parser";
import { buildIR } from "./ir";
import { generate } from "./generate";

export { PugError } from "./pug/error";

export type TCompileOptions = {
  /** Path of the template, for messages and the default name. */
  readonly filename: string;
  /** Exported name; default derived from the file name (`cart-items.template.pug` → `CartItemsTemplate`). */
  readonly name?: string;
  /** Module the generated code imports the runtime from; default `@bonsai/view`. */
  readonly runtime?: string;
};

/** `cart-items.template.pug` → `CartItemsTemplate`. */
export function templateName(filename: string): string {
  const stem = basename(filename).replace(/\.pug$/, "").replace(/\.template$/, "");
  const pascal = stem
    .split(/[^A-Za-z0-9]+/)
    .filter((part) => part !== "")
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join("");
  return `${/^[0-9]/.test(pascal) ? "T" : ""}${pascal}Template`;
}

/** Path of the generated module: `x.template.pug` → `x.template.ts`. */
export function outputPath(filename: string): string {
  return filename.replace(/\.pug$/, ".ts");
}

/** Compiles the source of a template into the source of a TypeScript module. Throws a `PugError`. */
export function compilePug(src: string, options: TCompileOptions): string {
  const { filename } = options;
  const ast = parse(lex(src, { filename }), { filename, src });
  const ir = buildIR(ast, { filename, src });
  return generate(ir, {
    name: options.name ?? templateName(filename),
    source: basename(filename),
    runtime: options.runtime ?? "@bonsai/view"
  });
}
