/**
 * Test helpers — compiles a Pug template and loads the generated module
 * (strate 1c, lot 4).
 *
 * The generated TypeScript is transpiled to CommonJS and evaluated with
 * `@bonsai/view` as its only import: what runs is exactly what the compiler
 * wrote.
 */
import ts from "typescript";
import * as view from "@bonsai/view";
import type { TProjectionTemplate } from "@bonsai/view";
import { compilePug } from "@tools/pug-compiler/src/bonsai-pug";

/** Compiles `src` and returns the generated TypeScript. */
export function compile(src: string, filename = "test.template.pug"): string {
  return compilePug(src, { filename });
}

/** Compiles `src` and evaluates the generated module; returns its template. */
export function load<TData = any>(src: string, filename = "test.template.pug"): TProjectionTemplate<TData, any> {
  const code = compile(src, filename);
  const js = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const exports: Record<string, unknown> = {};
  const require = (id: string): unknown => {
    if (id === "@bonsai/view") return view;
    throw new Error(`unexpected import ${id}`);
  };
  new Function("exports", "require", js)(exports, require);
  const template = Object.entries(exports).find(([k]) => k.endsWith("Template"));
  if (template === undefined) throw new Error("no template exported");
  return template[1] as TProjectionTemplate<TData, any>;
}

/**
 * What `View` does at creation (`create`, then `setup` on the container) and
 * at each re-run (`project`). Returns the container and a `project` function.
 */
export function mount<TData>(template: TProjectionTemplate<TData, any>, data: TData) {
  const container = document.createElement("div");
  document.body.append(container);
  container.replaceChildren(template.create(data));
  const nodes = template.setup(container);
  return {
    container,
    nodes,
    project(next: TData): void {
      template.project(nodes, next);
    }
  };
}

/** Mutation records produced by `run` on `target` (subtree, attributes, text). */
export function mutations(target: Node, run: () => void): MutationRecord[] {
  const observer = new MutationObserver(() => undefined);
  observer.observe(target, { subtree: true, childList: true, attributes: true, characterData: true });
  run();
  const records = observer.takeRecords();
  observer.disconnect();
  return records;
}

/** HTML without the markers of conditional zones. */
export function html(el: Element): string {
  return el.innerHTML.replace(/<!--\/?bonsai-if(:-?\d+)?-->/g, "");
}
