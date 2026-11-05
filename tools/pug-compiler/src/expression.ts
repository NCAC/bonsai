/**
 * JavaScript expressions of a template: free identifiers and renaming.
 *
 * An identifier of an expression is either a variable of the template scope
 * (loop item, index, mixin parameter: renamed to a unique name), an
 * ECMAScript global, or a field of the template data (`TData`).
 */
import ts from "typescript";

/** Standard globals an expression may read without them being data fields. */
const GLOBALS = new Set([
  "undefined", "NaN", "Infinity", "globalThis",
  "Math", "JSON", "Intl", "Reflect",
  "Number", "String", "Boolean", "Symbol", "BigInt", "Object", "Array", "Date", "RegExp", "Map", "Set", "WeakMap", "WeakSet", "Error",
  "parseInt", "parseFloat", "isNaN", "isFinite",
  "encodeURI", "encodeURIComponent", "decodeURI", "decodeURIComponent"
]);

type TOccurrence = { readonly name: string; readonly start: number; readonly end: number; readonly shorthand: boolean };

export type TExpression = {
  /** Source text, as written in the template. */
  readonly source: string;
  /** Identifiers read from the enclosing scope (neither declared inside nor globals). */
  readonly free: ReadonlySet<string>;
  /** Source with the free identifiers renamed through `names` (others kept). */
  rewrite(names: ReadonlyMap<string, string>): string;
};

/** Whether `src` parses as one expression; `null` when it does not. */
function parseExpression(src: string): ts.Expression | null {
  const file = ts.createSourceFile("expr.ts", `(${src}\n);`, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const diagnostics = (file as unknown as { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics;
  if (diagnostics.length > 0 || file.statements.length !== 1) return null;
  const statement = file.statements[0];
  if (!ts.isExpressionStatement(statement)) return null;
  return (statement.expression as ts.ParenthesizedExpression).expression;
}

/** Names bound by a binding pattern or identifier. */
function boundNames(name: ts.BindingName, into: Set<string>): void {
  if (ts.isIdentifier(name)) {
    into.add(name.text);
    return;
  }
  for (const element of name.elements) {
    if (ts.isBindingElement(element)) boundNames(element.name, into);
  }
}

/** Whether this identifier is a reference to a variable (not a property name, label, …). */
function isReference(id: ts.Identifier): boolean {
  const parent = id.parent;
  if (ts.isPropertyAccessExpression(parent) && parent.name === id) return false;
  if (ts.isPropertyAssignment(parent) && parent.name === id) return false;
  if ((ts.isMethodDeclaration(parent) || ts.isGetAccessor(parent) || ts.isSetAccessor(parent)) && parent.name === id) return false;
  if (ts.isBindingElement(parent) && parent.propertyName === id) return false;
  if (ts.isParameter(parent) || ts.isVariableDeclaration(parent) || ts.isBindingElement(parent)) return false;
  if ((ts.isFunctionExpression(parent) || ts.isClassExpression(parent)) && parent.name === id) return false;
  if (ts.isLabeledStatement(parent) || ts.isBreakOrContinueStatement(parent)) return false;
  if (ts.isQualifiedName(parent) || ts.isTypeReferenceNode(parent)) return false;
  return true;
}

/**
 * Analyses an expression of the template. Returns `null` when it is not a
 * single JavaScript expression.
 */
export function analyzeExpression(source: string): TExpression | null {
  const expression = parseExpression(source);
  if (expression === null) return null;
  const offset = 1; // the leading "(" of the parsed text
  const occurrences: TOccurrence[] = [];

  const visit = (node: ts.Node, declared: ReadonlySet<string>): void => {
    if (ts.isTypeNode(node)) return;
    if (ts.isFunctionLike(node)) {
      const inner = new Set(declared);
      if ((ts.isFunctionExpression(node) || ts.isClassExpression(node)) && node.name !== undefined) inner.add(node.name.text);
      for (const parameter of node.parameters) boundNames(parameter.name, inner);
      ts.forEachChild(node, (child) => visit(child, inner));
      return;
    }
    if (ts.isBlock(node)) {
      const inner = new Set(declared);
      for (const statement of node.statements) {
        if (ts.isVariableStatement(statement)) {
          for (const declaration of statement.declarationList.declarations) boundNames(declaration.name, inner);
        }
      }
      ts.forEachChild(node, (child) => visit(child, inner));
      return;
    }
    if (ts.isIdentifier(node)) {
      if (isReference(node) && !declared.has(node.text) && !GLOBALS.has(node.text)) {
        occurrences.push({
          name: node.text,
          start: node.getStart() - offset,
          end: node.getEnd() - offset,
          shorthand: ts.isShorthandPropertyAssignment(node.parent)
        });
      }
      return;
    }
    ts.forEachChild(node, (child) => visit(child, declared));
  };
  visit(expression, new Set());

  const free = new Set(occurrences.map((o) => o.name));
  const trimmedStart = expression.getStart() - offset;
  const trimmedEnd = expression.getEnd() - offset;
  return {
    source,
    free,
    rewrite(names) {
      let out = "";
      let cursor = trimmedStart;
      for (const o of occurrences) {
        const renamed = names.get(o.name);
        if (renamed === undefined || renamed === o.name) continue;
        out += source.slice(cursor, o.start) + (o.shorthand ? `${o.name}: ${renamed}` : renamed);
        cursor = o.end;
      }
      return out + source.slice(cursor, trimmedEnd);
    }
  };
}

/** Literal value of a constant attribute expression; `undefined` when it is dynamic. */
export function staticValue(source: string | boolean): string | boolean | undefined {
  if (typeof source === "boolean") return source;
  const expression = parseExpression(source);
  if (expression === null) return undefined;
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) return expression.text;
  if (ts.isNumericLiteral(expression)) return String(Number(expression.text));
  if (expression.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (expression.kind === ts.SyntaxKind.FalseKeyword) return false;
  return undefined;
}
