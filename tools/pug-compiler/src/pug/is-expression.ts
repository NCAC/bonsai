import ts from "typescript";

/** Whether `src` parses as a single JavaScript expression. */
export function isExpression(src: string): boolean {
  if (src.trim() === "") return false;
  const file = ts.createSourceFile("expr.ts", `(${src}\n);`, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
  const diagnostics = (file as unknown as { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics;
  return diagnostics.length === 0 && file.statements.length === 1;
}
