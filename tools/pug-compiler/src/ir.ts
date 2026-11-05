/**
 * Pug AST → intermediate representation of a projection template.
 *
 * The IR splits the template into **fragments**: the root, the body of each
 * `each` (one per item) and each branch of an `if` chain. A fragment has one
 * evaluator: a pure function of its parameters (`$data` and the variables in
 * scope) returning every dynamic value of the fragment as a numbered slot.
 * Mixins are inlined: their parameters become locals of the fragment where
 * they are called, under unique names.
 */
import ts from "typescript";
import { analyzeExpression, staticValue, type TExpression } from "./expression";
import { error } from "./pug/error";
import type { TPugAnyNode, TPugAttribute, TPugBlockNode, TPugMixinNode, TPugTagNode } from "./pug/pug.types";

/** Variable of the template scope, under its unique generated name. */
export type TVar = { readonly id: string; readonly type: string };

/** Mixin parameter, computed by the evaluator of the fragment where the mixin is called. */
export type TLocal = { readonly id: string; readonly code: string; readonly refs: ReadonlySet<string>; readonly fields: ReadonlySet<string> };

/** Dynamic value of a fragment, `s<n>` in the result of its evaluator. */
export type TSlot = { readonly id: string; readonly code: string };

export type TAttr = { readonly name: string; readonly value: string | true };
export type TDynAttr = { readonly name: string; readonly slot: string };

export type TElement = {
  readonly kind: "element";
  readonly tag: string;
  readonly attrs: TAttr[];
  readonly dyn: TDynAttr[];
  /** Attribute carrying the key of an item root: set at creation, never projected. */
  key: TDynAttr | null;
  /** Content made of text only: projected as `textContent`. */
  text: { readonly value: string } | { readonly slot: string } | null;
  readonly children: TNode[];
  readonly line: number;
};
export type TText = { readonly kind: "text"; readonly value: string };
export type TDynText = { readonly kind: "dyntext"; readonly slot: string };
export type TSwitch = { readonly kind: "switch"; readonly id: string; readonly slot: string; readonly branches: TFragment[] };
export type TList = {
  readonly kind: "list";
  readonly id: string;
  readonly slot: string;
  readonly body: TFragment;
  readonly line: number;
  readonly column: number;
};
export type TNode = TElement | TText | TDynText | TSwitch | TList;

export type TKey = { readonly attr: string; readonly code: string; readonly locals: TLocal[]; readonly fields: ReadonlySet<string> };

export type TFragment = {
  readonly index: number;
  readonly kind: "root" | "item" | "branch";
  /** Variables received from the enclosing fragment (plus item and index for an item). */
  readonly params: TVar[];
  readonly locals: TLocal[];
  readonly slots: TSlot[];
  readonly fields: Set<string>;
  readonly nodes: TNode[];
  /** For an item fragment: key of the item, computed without the index. */
  key: TKey | null;
};

export type TTemplateIR = {
  /** TypeScript type of the template data, from `//- @data <type>`; `null` when absent. */
  readonly dataType: string | null;
  readonly root: TFragment;
  readonly fragments: TFragment[];
  readonly usesSwitch: boolean;
  readonly usesList: boolean;
};

export type TBuildOptions = { readonly filename: string; readonly src: string };

const KEY_ATTRS = ["data-item-id", "data-key"] as const;
const ATTRIBUTE_NAME = /^[A-Za-z_][-A-Za-z0-9_.:]*$/;
const TAG_NAME = /^[A-Za-z][-A-Za-z0-9]*$/;
/** Keywords of Pug template inheritance, lexed as tags by the fork: refused rather than rendered. */
const INHERITANCE = new Set(["block", "extends", "append", "prepend"]);
const ENTITIES: Readonly<Record<string, string>> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** Where a source name resolves: a scope variable (renamed) of the current lexical environment. */
type TEnv = ReadonlyMap<string, string>;

type TCallerBlock = { readonly block: TPugBlockNode | null; readonly env: TEnv; readonly outer: TCallerBlock | null };

type TPending = { parts: ({ text: string } | { expr: string })[] };

type TContext = {
  readonly fragment: TFragment;
  readonly env: TEnv;
  /** Variables available at this point, in order: what a child fragment receives. */
  readonly available: TVar[];
  readonly mixins: readonly string[];
  readonly caller: TCallerBlock | null;
};

type TPugLoc = { line: number; column?: number | null };

export function buildIR(ast: TPugBlockNode, { filename, src }: TBuildOptions): TTemplateIR {
  const fail = (code: string, message: string, at: TPugLoc): never => {
    throw error(code, message, { line: at.line, column: at.column ?? undefined, filename, src });
  };

  let counter = 0;
  const unique = (name: string): string => `${name}$${++counter}`;
  let slotCounter = 0;
  const fragments: TFragment[] = [];
  let usesSwitch = false;
  let usesList = false;
  let firstField: { name: string; at: TPugLoc } | null = null;

  const newFragment = (kind: TFragment["kind"], params: TVar[]): TFragment => {
    const fragment: TFragment = { index: fragments.length, kind, params, locals: [], slots: [], fields: new Set(), nodes: [], key: null };
    fragments.push(fragment);
    return fragment;
  };

  // ── Top level: @data type and mixin definitions ──────────────────────
  let dataType: string | null = null;
  const definitions = new Map<string, TPugMixinNode>();
  for (const node of ast.nodes) {
    if ((node.type === "Comment" || node.type === "BlockComment") && !node.buffer) {
      const body =
        node.type === "BlockComment"
          ? [node.val, ...node.block.nodes.map((n) => (n.type === "Text" ? n.val : ""))].join("")
          : node.val;
      const match = /^\s*@data\b([\s\S]*)$/.exec(body);
      if (match === null) continue;
      if (dataType !== null) fail("DUPLICATE_DATA", "The template declares its data type twice (//- @data).", node);
      const type = match[1]!.trim();
      if (type === "") fail("EMPTY_DATA", "//- @data needs a TypeScript type, e.g. //- @data import(\"./cart\").TCartData", node);
      dataType = type;
    } else if (node.type === "Mixin" && !node.call) {
      if (definitions.has(node.name)) fail("DUPLICATE_MIXIN", `Mixin "${node.name}" is defined twice.`, node);
      definitions.set(node.name, node);
    }
  }

  // ── Expressions ──────────────────────────────────────────────────────
  type TCompiled = { code: string; refs: Set<string>; fields: Set<string> };
  const compile = (source: string, ctx: TContext, at: TPugLoc): TCompiled => {
    const expression: TExpression | null = analyzeExpression(source);
    if (expression === null) return fail("EXPRESSION", `Invalid JavaScript expression: ${source}`, at);
    const refs = new Set<string>();
    const fields = new Set<string>();
    for (const name of expression.free) {
      const renamed = ctx.env.get(name);
      if (renamed !== undefined) refs.add(renamed);
      else {
        fields.add(name);
        if (firstField === null) firstField = { name, at };
      }
    }
    return { code: expression.rewrite(ctx.env), refs, fields };
  };
  /** Scope variables and data fields read by each slot. */
  const slotInfo = new Map<string, { refs: ReadonlySet<string>; fields: ReadonlySet<string> }>();
  const addSlot = (ctx: TContext, compiled: { code: string; refs?: ReadonlySet<string>; fields: ReadonlySet<string> }): string => {
    const id = `s${slotCounter++}`;
    slotInfo.set(id, { refs: compiled.refs ?? new Set(), fields: compiled.fields });
    ctx.fragment.slots.push({ id, code: compiled.code });
    for (const field of compiled.fields) ctx.fragment.fields.add(field);
    return id;
  };

  // ── Text runs ────────────────────────────────────────────────────────
  const decode = (text: string, at: TPugLoc): string => {
    if (/<[A-Za-z!/]/.test(text)) fail("INLINE_HTML", "Raw HTML in text is not supported: write the tag in Pug, e.g. #[em text].", at);
    return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[A-Za-z]+);/g, (whole, name: string) => {
      if (name.startsWith("#x")) return String.fromCodePoint(parseInt(name.slice(2), 16));
      if (name.startsWith("#")) return String.fromCodePoint(parseInt(name.slice(1), 10));
      const value = ENTITIES[name];
      return value ?? fail("ENTITY", `Unknown HTML entity ${whole}: write the character itself.`, at);
    });
  };
  const flush = (out: TNode[], pending: TPending, ctx: TContext): void => {
    const parts = pending.parts;
    pending.parts = [];
    if (parts.length === 0) return;
    if (parts.every((p) => "text" in p)) {
      const value = parts.map((p) => (p as { text: string }).text).join("");
      if (value !== "") out.push({ kind: "text", value });
      return;
    }
    const code = parts.map((p) => ("text" in p ? JSON.stringify(p.text) : `$text(${p.expr})`)).join(" + ");
    out.push({ kind: "dyntext", slot: addSlot(ctx, { code, fields: new Set() }) });
  };

  // ── Walk ─────────────────────────────────────────────────────────────
  const walk = (nodes: readonly TPugAnyNode[], ctx: TContext, out: TNode[], pending: TPending): void => {
    for (const node of nodes) {
      switch (node.type) {
        case "Text":
          pending.parts.push({ text: decode(node.val, node) });
          break;
        case "Code": {
          if (!node.buffer) fail("CODE", "Unbuffered code (- …) is not supported: compute values in select (ADR-26).", node);
          if (!node.mustEscape) fail("UNESCAPED", "Unescaped output (!= or !{}) is not supported: a template projects text, never HTML.", node);
          const compiled = compile(node.val, ctx, node);
          for (const field of compiled.fields) ctx.fragment.fields.add(field);
          pending.parts.push({ expr: compiled.code });
          break;
        }
        case "Tag":
          flush(out, pending, ctx);
          out.push(element(node, ctx));
          break;
        case "Conditional": {
          flush(out, pending, ctx);
          out.push(conditional(node, ctx));
          break;
        }
        case "Each": {
          flush(out, pending, ctx);
          out.push(list(node, ctx));
          break;
        }
        case "Mixin":
          if (!node.call) {
            if (ctx.mixins.length > 0 || ctx.fragment.kind !== "root" || !definitions.has(node.name) || definitions.get(node.name) !== node) {
              fail("NESTED_MIXIN", `Mixin "${node.name}" must be defined at the top level of the template.`, node);
            }
            break;
          }
          mixinCall(node, ctx, out, pending);
          break;
        case "MixinBlock": {
          // The parser refuses `block` outside a mixin definition: a caller exists.
          const caller = ctx.caller!;
          if (caller.block !== null) walk(caller.block.nodes, { ...ctx, env: caller.env, caller: caller.outer }, out, pending);
          break;
        }
        case "Block":
          walk(node.nodes, ctx, out, pending);
          break;
        case "Comment":
        case "BlockComment":
          break;
        default:
          fail("UNSUPPORTED", `${describe(node)} is not supported in a Bonsai template (supported: tags, text, =, #{}, if/else, unless, each, mixins).`, node as TPugLoc);
      }
    }
  };

  const describe = (node: TPugAnyNode): string => {
    switch (node.type) {
      case "Case":
      case "When":
        return "case/when";
      case "While":
        return "while";
      case "InterpolatedTag":
        return "An interpolated tag name (#{…})";
      case "Include":
      case "FileReference":
        return "include";
      default:
        return `Node "${(node as { type: string }).type}"`;
    }
  };

  const element = (node: TPugTagNode, ctx: TContext): TElement => {
    if (INHERITANCE.has(node.name)) {
      fail("UNSUPPORTED", `Template inheritance (${node.name}) is not supported in a Bonsai template: use mixins.`, node);
    }
    if (node.name === "svg" || node.name === "math") {
      fail("UNSUPPORTED", `<${node.name}> needs its XML namespace, which the compiler does not create yet: keep it out of the template.`, node);
    }
    if (!TAG_NAME.test(node.name)) fail("TAG_NAME", `Invalid tag name "${node.name}".`, node);
    const el: TElement = { kind: "element", tag: node.name, attrs: [], dyn: [], key: null, text: null, children: [], line: node.line };
    const classes: string[] = [];
    const seen = new Set<string>();
    for (const attr of node.attrs as TPugAttribute[]) {
      const value = staticValue(attr.val as string | boolean);
      if (attr.name === "class") {
        if (typeof value !== "string") {
          fail("DYNAMIC_CLASS", "A class is a stable role, never a state: use a data-* attribute for what changes (data-state=…).", attr);
        }
        if (value !== "") classes.push(value as string);
        continue;
      }
      if (!ATTRIBUTE_NAME.test(attr.name)) fail("ATTRIBUTE_NAME", `Invalid attribute name "${attr.name}".`, attr);
      if (seen.has(attr.name)) fail("DUPLICATE_ATTRIBUTE", `Attribute "${attr.name}" is declared twice.`, attr);
      seen.add(attr.name);
      if (value === undefined) {
        const compiled = compile(attr.val, ctx, attr);
        el.dyn.push({ name: attr.name, slot: addSlot(ctx, compiled) });
      } else if (value !== false) {
        el.attrs.push({ name: attr.name, value: value === true ? true : value });
      }
    }
    if (classes.length > 0) el.attrs.unshift({ name: "class", value: classes.join(" ") });

    const children: TNode[] = [];
    const pending: TPending = { parts: [] };
    walk(node.block.nodes, ctx, children, pending);
    flush(children, pending, ctx);
    const only = children.length === 1 ? children[0]! : null;
    if (only !== null && only.kind === "text") el.text = { value: only.value };
    else if (only !== null && only.kind === "dyntext") el.text = { slot: only.slot };
    else {
      checkLists(children);
      el.children.push(...children);
    }
    return el;
  };

  /** A list owns the children of its container: it must be its only content. */
  const checkLists = (children: readonly TNode[]): void => {
    if (children.length <= 1) return;
    const lone = children.find((c): c is TList => c.kind === "list");
    if (lone !== undefined) {
      fail("EACH_NOT_ALONE", "An each must be the only content of its parent element: wrap it, or move its siblings out.", lone);
    }
  };

  const conditional = (node: Extract<TPugAnyNode, { type: "Conditional" }>, ctx: TContext): TSwitch => {
    usesSwitch = true;
    const tests: string[] = [];
    const fields = new Set<string>();
    const branches: TFragment[] = [];
    let current: Extract<TPugAnyNode, { type: "Conditional" }> | TPugBlockNode | null = node;
    while (current !== null) {
      const block: TPugBlockNode = current.type === "Conditional" ? current.consequent : current;
      if (current.type === "Conditional") {
        const compiled = compile(current.test, ctx, current);
        for (const field of compiled.fields) fields.add(field);
        tests.push(compiled.code);
      }
      branches.push(fragmentOf("branch", block.nodes, ctx, [], block));
      current = current.type === "Conditional" ? current.alternate : null;
    }
    const hasElse = branches.length > tests.length;
    let code = hasElse ? String(tests.length) : "-1";
    for (let i = tests.length - 1; i >= 0; i--) code = `(${tests[i]}) ? ${i} : ${code}`;
    return { kind: "switch", id: `i${slotCounter}`, slot: addSlot(ctx, { code, fields }), branches };
  };

  const list = (node: Extract<TPugAnyNode, { type: "Each" }>, ctx: TContext): TList => {
    usesList = true;
    if (node.alternate !== null && node.alternate !== undefined) fail("EACH_ELSE", "each … else is not supported: use if items.length / else around the list.", node);
    const source = compile(node.obj, ctx, node);
    const slot = addSlot(ctx, source);
    const item: TVar = { id: unique(node.val), type: `$Item<ReturnType<typeof $e${ctx.fragment.index}>["${slot}"]>` };
    const index: TVar = { id: unique(node.key ?? "index"), type: "number" };
    const names: [string, string][] = [[node.val, item.id]];
    if (node.key !== null) names.push([node.key, index.id]);
    const body = fragmentOf("item", node.block.nodes, ctx, [item, index], node, names);
    return { kind: "list", id: `l${slot.slice(1)}`, slot, body, line: node.line, column: node.column ?? 0 };
  };

  /** Builds a child fragment receiving every variable available here. */
  const fragmentOf = (
    kind: "item" | "branch",
    nodes: readonly TPugAnyNode[],
    ctx: TContext,
    extra: TVar[],
    at: TPugLoc,
    names: [string, string][] = []
  ): TFragment => {
    const params = [...ctx.available, ...extra];
    const fragment = newFragment(kind, params);
    const env = new Map(ctx.env);
    for (const [name, id] of names) env.set(name, id);
    const child: TContext = { fragment, env, available: [...params], mixins: ctx.mixins, caller: ctx.caller };
    const pending: TPending = { parts: [] };
    walk(nodes, child, fragment.nodes, pending);
    flush(fragment.nodes, pending, child);
    if (kind === "branch") {
      const nested = fragment.nodes.find((n): n is TList => n.kind === "list");
      if (nested !== undefined) fail("EACH_IN_BRANCH", "An each directly under if/else needs a parent element: wrap it.", nested);
    } else {
      const root = fragment.nodes[0];
      if (fragment.nodes.length !== 1 || root === undefined || root.kind !== "element") {
        fail("EACH_SINGLE_ROOT", "The body of an each must be exactly one element, the item root.", at);
      }
      fragment.key = keyOf(root as TElement, fragment, extra[1]!.id, at);
    }
    return fragment;
  };

  const keyOf = (root: TElement, fragment: TFragment, indexId: string, at: TPugLoc): TKey => {
    const attr = KEY_ATTRS.find((name) => root.dyn.some((d) => d.name === name));
    if (attr === undefined) {
      const fixed = root.attrs.some((a) => (KEY_ATTRS as readonly string[]).includes(a.name));
      fail(
        "EACH_KEY",
        fixed
          ? "The key of an item must depend on the item: data-item-id=item.id, not a constant."
          : "List item requires a key for reconciliation: add data-item-id=… (or data-key=…) on the item root.",
        { line: root.line, column: at.column }
      );
    }
    const dyn = root.dyn.find((d) => d.name === attr)!;
    root.dyn.splice(root.dyn.indexOf(dyn), 1);
    root.key = dyn;
    const code = fragment.slots.find((s) => s.id === dyn.slot)!.code;
    // Locals the key depends on, transitively; the key never depends on the index.
    const info = slotInfo.get(dyn.slot)!;
    const needed = new Set<string>();
    const visit = (id: string): void => {
      if (needed.has(id)) return;
      if (id === indexId) fail("KEY_USES_INDEX", "The key of an item cannot depend on its index: use a stable property of the item.", { line: root.line });
      const local = fragment.locals.find((l) => l.id === id);
      if (local === undefined) return;
      needed.add(id);
      for (const ref of local.refs) visit(ref);
    };
    for (const ref of info.refs) visit(ref);
    const locals = fragment.locals.filter((l) => needed.has(l.id));
    const fields = new Set(info.fields);
    for (const local of locals) for (const field of local.fields) fields.add(field);
    return { attr, code, locals, fields };
  };

  const mixinCall = (node: TPugMixinNode, ctx: TContext, out: TNode[], pending: TPending): void => {
    const definition = definitions.get(node.name);
    if (definition === undefined) return fail("UNKNOWN_MIXIN", `Unknown mixin "${node.name}".`, node);
    if (ctx.mixins.includes(node.name)) fail("RECURSIVE_MIXIN", `Mixin "${node.name}" calls itself: recursion is not supported.`, node);
    if (node.attrs.length > 0) {
      fail("MIXIN_ATTRIBUTES", "Attributes on a mixin call (+m()(…)) are not supported: pass them as arguments.", node);
    }
    const params = mixinParams(definition);
    const args = mixinArgs(node);
    if (args.length > params.length) fail("MIXIN_ARGUMENTS", `Mixin "${node.name}" takes ${params.length} argument(s), ${args.length} given.`, node);
    const env = new Map<string, string>();
    const available = [...ctx.available];
    params.forEach((param, i) => {
      const arg = args[i];
      const compiled = arg === undefined ? { code: "undefined", refs: new Set<string>(), fields: new Set<string>() } : compile(arg, ctx, node);
      const id = unique(param);
      ctx.fragment.locals.push({ id, code: compiled.code, refs: compiled.refs, fields: compiled.fields });
      for (const field of compiled.fields) ctx.fragment.fields.add(field);
      env.set(param, id);
      available.push({ id, type: `ReturnType<typeof $e${ctx.fragment.index}>["${id}"]` });
    });
    const inner: TContext = {
      fragment: ctx.fragment,
      env,
      available,
      mixins: [...ctx.mixins, node.name],
      caller: { block: node.block ?? null, env: ctx.env, outer: ctx.caller }
    };
    walk(definition.block.nodes, inner, out, pending);
  };

  const mixinParams = (definition: TPugMixinNode): string[] => {
    const raw = (definition.args ?? "").trim();
    if (raw === "") return [];
    const names = raw.split(",").map((s) => s.trim());
    for (const name of names) {
      if (!/^[A-Za-z_$][\w$]*$/.test(name)) {
        fail("MIXIN_PARAMS", `Mixin "${definition.name}": parameters must be plain names (no default, no rest): "${name}".`, definition);
      }
    }
    return names;
  };

  const mixinArgs = (node: TPugMixinNode): string[] => {
    const raw = (node.args ?? "").trim();
    if (raw === "") return [];
    const call = splitArguments(raw);
    if (call === null) return fail("EXPRESSION", `Invalid mixin arguments: ${raw}`, node);
    return call;
  };

  // ── Root ─────────────────────────────────────────────────────────────
  const root = newFragment("root", []);
  const rootCtx: TContext = { fragment: root, env: new Map(), available: [], mixins: [], caller: null };
  const pending: TPending = { parts: [] };
  walk(ast.nodes, rootCtx, root.nodes, pending);
  flush(root.nodes, pending, rootCtx);
  checkLists(root.nodes);

  if (dataType === null && firstField !== null) {
    const { name, at } = firstField as { name: string; at: TPugLoc };
    fail("NO_DATA_TYPE", `The template reads "${name}" but declares no data type: add //- @data <type> at the top.`, at);
  }
  return { dataType, root, fragments, usesSwitch, usesList };
}

/** Arguments of a call `f(<raw>)`, as source texts; `null` if it does not parse. */
function splitArguments(raw: string): string[] | null {
  const text = `f(${raw}\n);`;
  const file = ts.createSourceFile("args.ts", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const diagnostics = (file as unknown as { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics;
  const statement = file.statements[0];
  if (diagnostics.length > 0 || file.statements.length !== 1 || statement === undefined || !ts.isExpressionStatement(statement)) return null;
  const call = statement.expression;
  if (!ts.isCallExpression(call)) return null;
  return call.arguments.map((a) => text.slice(a.getStart(), a.getEnd()));
}
