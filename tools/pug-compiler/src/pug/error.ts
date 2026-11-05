/**
 * Compile error of a Pug template: stable code, position, source excerpt.
 * Replaces the `pug-error` package of the original lexer/parser.
 */
export type TPugErrorLocation = {
  readonly line: number;
  readonly column?: number;
  readonly filename?: string;
  readonly src?: string;
};

export class PugError extends Error {
  readonly code: string;
  readonly msg: string;
  readonly line: number;
  readonly column: number | undefined;
  readonly filename: string | undefined;

  constructor(code: string, message: string, location: TPugErrorLocation) {
    super(PugError.#format(message, location));
    this.name = "PugError";
    this.code = `PUG:${code}`;
    this.msg = message;
    this.line = location.line;
    this.column = location.column;
    this.filename = location.filename;
  }

  static #format(message: string, { line, column, filename, src }: TPugErrorLocation): string {
    const where = `${filename ?? "Pug"}:${line}${column === undefined ? "" : `:${column}`}`;
    if (src === undefined) return `${where}\n\n${message}`;
    const lines = src.split("\n");
    const start = Math.max(line - 3, 0);
    const end = Math.min(lines.length, line + 3);
    const excerpt = lines
      .slice(start, end)
      .map((text, i) => {
        const current = i + start + 1;
        const prefix = `${current === line ? "  > " : "    "}${current}| `;
        const caret = current === line && column !== undefined ? `\n${"-".repeat(prefix.length + column - 1)}^` : "";
        return prefix + text + caret;
      })
      .join("\n");
    return `${where}\n${excerpt}\n\n${message}`;
  }
}

/** Same signature as `pug-error`. */
export function error(code: string, message: string, location: TPugErrorLocation): PugError {
  return new PugError(code, message, location);
}
