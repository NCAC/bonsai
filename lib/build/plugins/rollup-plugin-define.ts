import MagicString from "magic-string";
import type { Plugin } from "rollup";

/** Compile-time constants: identifier → literal value inlined in its place. */
export type TDefineOptions = Readonly<Record<string, boolean | number | string>>;

type TNode = { type: string; start: number; end: number; [key: string]: unknown };

const isNode = (value: unknown): value is TNode =>
  typeof value === "object" && value !== null && typeof (value as TNode).type === "string";

/**
 * Replaces free identifiers by compile-time constants (ADR-06: `__DEV__`).
 *
 * The replacement works on the AST of the transformed JavaScript, not on its
 * text: comments, strings and property names are left alone. Rollup then folds
 * the constant conditions and drops the dead branches.
 */
export function define(constants: TDefineOptions): Plugin {
  const names = new Set(Object.keys(constants));
  return {
    name: "bonsai-define",
    transform(code) {
      if (![...names].some((name) => code.includes(name))) return null;
      const output = new MagicString(code);
      const visit = (node: TNode, parent: TNode | null, key: string | null): void => {
        if (node.type === "Identifier" && names.has(node.name as string)) {
          const isProperty =
            parent !== null &&
            ((parent.type === "MemberExpression" && key === "property" && parent.computed !== true) ||
              (parent.type === "Property" && key === "key" && parent.computed !== true));
          if (!isProperty) output.overwrite(node.start, node.end, JSON.stringify(constants[node.name as string]));
          return;
        }
        for (const [childKey, child] of Object.entries(node)) {
          if (Array.isArray(child)) {
            for (const item of child) if (isNode(item)) visit(item, node, childKey);
          } else if (isNode(child)) {
            visit(child, node, childKey);
          }
        }
      };
      visit(this.parse(code) as unknown as TNode, null, null);
      return { code: output.toString(), map: null };
    }
  };
}
