import assert from "assert";
import { isExpression } from "./is-expression.js";
import {
  parse,
  parseUntil,
  isPunctuator,
  parseChar,
  defaultState
} from "character-parser";
import {
  LexTokenType,
  LexToken,
  LexerFunction,
  Token,
  LexerOptions,
  NewlineToken,
  LexBaseToken,
  Loc,
  TValStringToken,
  PathToken,
  MixinBlockToken
} from "../types/lexer.types.js";

import error from "pug-error";

export class Lexer {
  input: string;
  originalInput: string;
  filename?: string;
  interpolated: boolean;
  lineno: number;
  colno: number;
  plugins: LexerFunction[];
  indentStack: number[];
  indentRe: RegExp | null;
  interpolationAllowed: boolean;
  whitespaceRe: RegExp;
  tokens: Token[];
  ended: boolean;

  constructor(str: string, options?: Partial<LexerOptions>) {
    options = options || {};
    if (typeof str !== "string") {
      throw new Error(
        'Expected source code to be a string but got "' + typeof str + '"'
      );
    }
    if (typeof options !== "object") {
      throw new Error(
        'Expected "options" to be an object but got "' + typeof options + '"'
      );
    }
    //Strip any UTF-8 BOM off of the start of `str`, if it exists.
    str = str.replace(/^\uFEFF/, "");
    this.input = str.replace(/\r\n|\r/g, "\n");
    this.originalInput = this.input;
    this.filename = options.filename;
    this.interpolated = options.interpolated || false;
    this.lineno = options.startingLine || 1;
    this.colno = options.startingColumn || 1;
    this.plugins = options.plugins || [];
    this.indentStack = [0];
    this.indentRe = null;
    // If #{}, !{} or #[] syntax is allowed when adding text
    this.interpolationAllowed = true;
    this.whitespaceRe = /[ \n\t]/;

    this.tokens = [];
    this.ended = false;
  }

  error(code: string, message: string): never {
    var err = error(code, message, {
      line: this.lineno,
      column: this.colno,
      filename: this.filename,
      src: this.originalInput
    });
    throw err;
  }

  assert(value: any, message: string): void {
    if (!value) this.error("ASSERT_FAILED", message);
  }

  isExpression(exp: string): boolean {
    return isExpression(exp);
  }

  assertExpression(exp: string, noThrow?: boolean): boolean {
    //this verifies that a JavaScript expression is valid
    try {
      this.callLexerFunction("isExpression", exp);
      return true;
    } catch (ex) {
      if (noThrow) return false;

      // not coming from acorn
      if (!ex.loc) throw ex;

      this.incrementLine(ex.loc.line - 1);
      this.incrementColumn(ex.loc.column);
      var msg =
        "Syntax Error: " + ex.message.replace(/ \([0-9]+:[0-9]+\)$/, "");
      this.error("SYNTAX_ERROR", msg);
    }
  }

  assertNestingCorrect(exp: string): void {
    //this verifies that code is properly nested, but allows
    //invalid JavaScript such as the contents of `attributes`
    var res = parse(exp);
    if (res.isNesting()) {
      this.error(
        "INCORRECT_NESTING",
        "Nesting must match on expression `" + exp + "`"
      );
    }
  }

  /**
   * Construct a token with the given `type` and `val`.
   */
  private tok<Type extends LexTokenType>(
    type: Type,
    val?: any
  ): LexToken<Type> {
    var res: { loc: Partial<Loc> } & { type: LexTokenType } = {
      type: type,
      loc: {
        start: {
          line: this.lineno,
          column: this.colno
        },
        filename: this.filename
      }
    };

    if (val !== undefined) (res as unknown as TValStringToken).val = val;

    return res as LexToken<Type>;
  }

  /**
   * Set the token's `loc.end` value.
   */
  private tokEnd<Type extends LexTokenType>(
    tok: LexToken<Type>
  ): LexToken<Type> {
    (tok as LexBaseToken).loc.end = {
      line: this.lineno,
      column: this.colno
    };
    return tok;
  }

  /**
   * Increment `this.lineno` and reset `this.colno`.
   */
  private incrementLine(increment: number): void {
    this.lineno += increment;
    if (increment) this.colno = 1;
  }

  /**
   * Increment `this.colno`.
   */
  private incrementColumn(increment: number): void {
    this.colno += increment;
  }

  /**
   * Consume the given `len` of input.
   */
  private consume(len: number): void {
    this.input = this.input.substr(len);
  }

  /**
   * Scan for `type` with the given `regexp`.
   */
  private scan<Type extends LexTokenType>(
    regexp: RegExp,
    type?: Type
  ): LexToken<Type> | undefined {
    let captures: RegExpExecArray;
    if ((captures = regexp.exec(this.input))) {
      const len = captures[0].length;
      const val = captures[1];
      const diff = len - (val ? val.length : 0);
      const tok = this.tok(type, val);
      this.consume(len);
      this.incrementColumn(diff);
      return tok;
    }
  }

  private scanEndOfLine<Type extends LexTokenType>(
    regexp: RegExp,
    type: Type
  ): LexToken<Type> | undefined {
    let captures: RegExpExecArray;
    if ((captures = regexp.exec(this.input))) {
      let whitespaceLength = 0;
      let whitespace: RegExpExecArray;
      let tok: LexToken<Type>;
      if ((whitespace = /^([ ]+)([^ ]*)/.exec(captures[0]))) {
        whitespaceLength = whitespace[1].length;
        this.incrementColumn(whitespaceLength);
      }
      var newInput = this.input.substr(captures[0].length);
      if (newInput[0] === ":") {
        this.input = newInput;
        tok = this.tok(type, captures[1]);
        this.incrementColumn(captures[0].length - whitespaceLength);
        return tok as LexToken<Type>;
      }
      if (/^[ \t]*(\n|$)/.test(newInput)) {
        this.input = newInput.substr(/^[ \t]*/.exec(newInput)[0].length);
        tok = this.tok(type, captures[1]);
        this.incrementColumn(captures[0].length - whitespaceLength);
        return tok as LexToken<Type>;
      }
    }
  }

  /**
   * Return the indexOf `(` or `{` or `[` / `)` or `}` or `]` delimiters.
   *
   * Make sure that when calling this function, colno is at the character
   * immediately before the beginning.
   */
  private bracketExpression(skip?: number): ReturnType<typeof parseUntil> {
    skip = skip || 0;
    var start = this.input[skip];
    assert(
      start === "(" || start === "{" || start === "[",
      'The start character should be "(", "{" or "["'
    );
    var end = { "(": ")", "{": "}", "[": "]" }[start];
    var range;
    try {
      range = parseUntil(this.input, end, { start: skip + 1 });
    } catch (ex) {
      if (ex.index !== undefined) {
        var idx = ex.index;
        // starting from this.input[skip]
        var tmp = this.input.substr(skip).indexOf("\n");
        // starting from this.input[0]
        var nextNewline = tmp + skip;
        var ptr = 0;
        while (idx > nextNewline && tmp !== -1) {
          this.incrementLine(1);
          idx -= nextNewline + 1;
          ptr += nextNewline + 1;
          tmp = nextNewline = this.input.substr(ptr).indexOf("\n");
        }

        this.incrementColumn(idx);
      }
      if (ex.code === "CHARACTER_PARSER:END_OF_STRING_REACHED") {
        this.error(
          "NO_END_BRACKET",
          "The end of the string reached with no closing bracket " +
            end +
            " found."
        );
      } else if (ex.code === "CHARACTER_PARSER:MISMATCHED_BRACKET") {
        this.error("BRACKET_MISMATCH", ex.message);
      }
      throw ex;
    }
    return range;
  }

  scanIndentation(): RegExpExecArray | null {
    let captures: RegExpExecArray, re: RegExp;

    // established regexp
    if (this.indentRe) {
      captures = this.indentRe.exec(this.input);
      // determine regexp
    } else {
      // tabs
      re = /^\n(\t*) */;
      captures = re.exec(this.input);

      // spaces
      if (captures && !captures[1].length) {
        re = /^\n( *)/;
        captures = re.exec(this.input);
      }

      // established
      if (captures && captures[1].length) this.indentRe = re;
    }

    return captures;
  }

  //#region end-of-source.
  eos(): true | undefined {
    if (this.input.length) return;
    if (this.interpolated) {
      this.error(
        "NO_END_BRACKET",
        "End of line was reached with no closing bracket for interpolation."
      );
    }
    for (var i = 0; this.indentStack[i]; i++) {
      this.tokens.push(this.tokEnd<"outdent">(this.tok("outdent")));
    }
    this.tokens.push(this.tokEnd<"eos">(this.tok("eos")));
    this.ended = true;
    return true;
  }
  //#endregion

  //#region blank line
  blank(): true | undefined {
    var captures: RegExpExecArray;
    if ((captures = /^\n[ \t]*\n/.exec(this.input))) {
      this.consume(captures[0].length - 1);
      this.incrementLine(1);
      return true;
    }
  }
  //#endregion

  //#region Comment
  comment(): true | undefined {
    var captures: RegExpExecArray;
    if ((captures = /^\/\/(-)?([^\n]*)/.exec(this.input))) {
      this.consume(captures[0].length);
      var tok = this.tok<"comment">("comment", captures[2]);
      tok.buffer = "-" != captures[1];
      this.interpolationAllowed = tok.buffer;
      this.tokens.push(tok);
      this.incrementColumn(captures[0].length);
      this.tokEnd<"comment">(tok);
      this.callLexerFunction("pipelessText");
      return true;
    }
  }
  //#endregion

  //#region Interpolated tag
  interpolation(): true | undefined {
    if (/^#\{/.test(this.input)) {
      var match = this.bracketExpression(1);
      this.consume(match.end + 1);
      var tok = this.tok("interpolation", match.src);
      this.tokens.push(tok);
      this.incrementColumn(2); // '#{'
      this.assertExpression(match.src);

      var splitted = match.src.split("\n");
      var lines = splitted.length - 1;
      this.incrementLine(lines);
      this.incrementColumn(splitted[lines].length + 1); // + 1 → '}'
      this.tokEnd<"interpolation">(tok);
      return true;
    }
  }
  //#endregion

  //#region Tag.
  tag(): true | undefined {
    var captures: RegExpExecArray;

    if ((captures = /^(\w(?:[-:\w]*\w)?)/.exec(this.input))) {
      var tok,
        name = captures[1],
        len = captures[0].length;
      this.consume(len);
      tok = this.tok("tag", name);
      this.tokens.push(tok);
      this.incrementColumn(len);
      this.tokEnd(tok);
      return true;
    }
  }
  //#endregion

  //#region Filter.
  filter(opts: any): true | undefined {
    var tok = this.scan(/^:([\w\-]+)/, "filter");
    var inInclude = opts && opts.inInclude;
    if (tok) {
      this.tokens.push(tok);
      this.incrementColumn(tok.val.length);
      this.tokEnd<"filter">(tok);
      this.callLexerFunction("attrs");
      if (!inInclude) {
        this.interpolationAllowed = false;
        this.callLexerFunction("pipelessText");
      }
      return true;
    }
  }
  //#endregion

  //#region Doctype.
  doctype(): true | undefined {
    var node = this.scanEndOfLine(/^doctype *([^\n]*)/, "doctype");
    if (node) {
      this.tokens.push(this.tokEnd<"doctype">(node));
      return true;
    }
  }
  //#endregion

  //#region id
  id(): true | undefined {
    var tok = this.scan(/^#([\w-]+)/, "id");
    if (tok) {
      this.tokens.push(tok);
      this.incrementColumn(tok.val.length);
      this.tokEnd<"id">(tok);
      return true;
    }
    if (/^#/.test(this.input)) {
      this.error(
        "INVALID_ID",
        '"' +
          /.[^ \t\(\#\.\:]*/.exec(this.input.substr(1))[0] +
          '" is not a valid ID.'
      );
    }
  }
  //#endregion

  //#region class
  className(): true | undefined {
    var tok = this.scan(/^\.([_a-z0-9\-]*[_a-z][_a-z0-9\-]*)/i, "class");
    if (tok) {
      this.tokens.push(tok);
      this.incrementColumn(tok.val.length);
      this.tokEnd<"class">(tok);
      return true;
    }
    if (/^\.[_a-z0-9\-]+/i.test(this.input)) {
      this.error(
        "INVALID_CLASS_NAME",
        "Class names must contain at least one letter or underscore."
      );
    }
    if (/^\./.test(this.input)) {
      this.error(
        "INVALID_CLASS_NAME",
        '"' +
          /.[^ \t\(\#\.\:]*/.exec(this.input.substr(1))[0] +
          '" is not a valid class name.  Class names can only contain "_", "-", a-z and 0-9, and must contain at least one of "_", or a-z'
      );
    }
  }
  //#endregion

  //#region text
  endInterpolation(): true | undefined {
    if (this.interpolated && this.input[0] === "]") {
      this.input = this.input.substr(1);
      this.ended = true;
      return true;
    }
  }

  addText(
    type: LexTokenType,
    value: string,
    prefix?: string,
    escaped?: number
  ): void {
    var tok;
    if (value + prefix === "") return;
    prefix = prefix || "";
    escaped = escaped || 0;
    var indexOfEnd = this.interpolated ? value.indexOf("]") : -1;
    var indexOfStart = this.interpolationAllowed ? value.indexOf("#[") : -1;
    var indexOfEscaped = this.interpolationAllowed ? value.indexOf("\\#[") : -1;
    var matchOfStringInterp = /(\\)?([#!]){((?:.|\n)*)$/.exec(value);
    var indexOfStringInterp =
      this.interpolationAllowed && matchOfStringInterp
        ? matchOfStringInterp.index
        : Infinity;

    if (indexOfEnd === -1) indexOfEnd = Infinity;
    if (indexOfStart === -1) indexOfStart = Infinity;
    if (indexOfEscaped === -1) indexOfEscaped = Infinity;

    if (
      indexOfEscaped !== Infinity &&
      indexOfEscaped < indexOfEnd &&
      indexOfEscaped < indexOfStart &&
      indexOfEscaped < indexOfStringInterp
    ) {
      prefix = prefix + value.substring(0, indexOfEscaped) + "#[";
      return this.addText(
        type,
        value.substring(indexOfEscaped + 3),
        prefix,
        escaped + 1
      );
    }
    if (
      indexOfStart !== Infinity &&
      indexOfStart < indexOfEnd &&
      indexOfStart < indexOfEscaped &&
      indexOfStart < indexOfStringInterp
    ) {
      tok = this.tok(type, prefix + value.substring(0, indexOfStart));
      this.incrementColumn(prefix.length + indexOfStart + escaped);
      this.tokens.push(this.tokEnd(tok));
      tok = this.tok("start-pug-interpolation");
      this.incrementColumn(2);
      this.tokens.push(this.tokEnd(tok));
      var child = new Lexer(value.substr(indexOfStart + 2), {
        filename: this.filename,
        interpolated: true,
        startingLine: this.lineno,
        startingColumn: this.colno,
        plugins: this.plugins
      });
      var interpolated;
      try {
        interpolated = child.getTokens();
      } catch (ex) {
        if (ex.code && /^PUG:/.test(ex.code)) {
          this.colno = ex.column;
          this.error(ex.code.substr(4), ex.msg);
        }
        throw ex;
      }
      this.colno = child.colno;
      this.tokens = this.tokens.concat(interpolated);
      tok = this.tok("end-pug-interpolation");
      this.incrementColumn(1);
      this.tokens.push(this.tokEnd(tok));
      this.addText(type, child.input);
      return;
    }
    if (
      indexOfEnd !== Infinity &&
      indexOfEnd < indexOfStart &&
      indexOfEnd < indexOfEscaped &&
      indexOfEnd < indexOfStringInterp
    ) {
      if (prefix + value.substring(0, indexOfEnd)) {
        this.addText(type, value.substring(0, indexOfEnd), prefix);
      }
      this.ended = true;
      this.input = value.substr(value.indexOf("]") + 1) + this.input;
      return;
    }
    if (indexOfStringInterp !== Infinity) {
      if (matchOfStringInterp[1]) {
        prefix =
          prefix +
          value.substring(0, indexOfStringInterp) +
          matchOfStringInterp[2] +
          "{";
        return this.addText(
          type,
          value.substring(indexOfStringInterp + 3),
          prefix,
          escaped + 1
        );
      }
      var before = value.substr(0, indexOfStringInterp);
      if (prefix || before) {
        before = prefix + before;
        tok = this.tok(type, before);
        this.incrementColumn(before.length + escaped);
        this.tokens.push(this.tokEnd(tok));
      }

      var rest = matchOfStringInterp[3];
      var range;
      tok = this.tok("interpolated-code");
      this.incrementColumn(2);
      try {
        range = parseUntil(rest, "}");
      } catch (ex) {
        if (ex.index !== undefined) {
          this.incrementColumn(ex.index);
        }
        if (ex.code === "CHARACTER_PARSER:END_OF_STRING_REACHED") {
          this.error(
            "NO_END_BRACKET",
            "End of line was reached with no closing bracket for interpolation."
          );
        } else if (ex.code === "CHARACTER_PARSER:MISMATCHED_BRACKET") {
          this.error("BRACKET_MISMATCH", ex.message);
        } else {
          throw ex;
        }
      }
      tok.mustEscape = matchOfStringInterp[2] === "#";
      tok.buffer = true;
      tok.val = range.src;
      this.assertExpression(range.src);

      if (range.end + 1 < rest.length) {
        rest = rest.substr(range.end + 1);
        this.incrementColumn(range.end + 1);
        this.tokens.push(this.tokEnd(tok));
        this.addText(type, rest);
      } else {
        this.incrementColumn(rest.length);
        this.tokens.push(this.tokEnd(tok));
      }
      return;
    }

    value = prefix + value;
    tok = this.tok(type, value);
    this.incrementColumn(value.length + escaped);
    this.tokens.push(this.tokEnd(tok));
  }

  text(): true | undefined {
    var tok =
      this.scan(/^(?:\| ?| )([^\n]+)/, "text") ||
      this.scan(/^( )/, "text") ||
      this.scan(/^\|( ?)/, "text");
    if (tok) {
      this.addText("text", tok.val);
      return true;
    }
  }

  textHtml(): true | undefined {
    var tok = this.scan(/^(<[^\n]*)/, "text-html");
    if (tok) {
      this.addText("text-html", tok.val);
      return true;
    }
  }
  //#endregion

  //#region dot.
  dot(): true | undefined {
    var tok;
    if ((tok = this.scanEndOfLine(/^\./, "dot"))) {
      this.tokens.push(this.tokEnd(tok));
      this.callLexerFunction("pipelessText");
      return true;
    }
  }
  //#endregion

  //#region Extends.
  // extends(): true | undefined {
  //   var tok = this.scan(/^extends?(?= |$|\n)/, "extends");
  //   if (tok) {
  //     this.tokens.push(this.tokEnd<"extends">(tok));
  //     if (!this.callLexerFunction("path")) {
  //       this.error("NO_EXTENDS_PATH", "missing path for extends");
  //     }
  //     return true;
  //   }
  //   if (this.scan(/^extends?\b/)) {
  //     this.error("MALFORMED_EXTENDS", "malformed extends");
  //   }
  // }
  //#endregion

  //#region Block prepend.
  // prepend(): true | undefined {
  //   var captures;
  //   if ((captures = /^(?:block +)?prepend +([^\n]+)/.exec(this.input))) {
  //     var name = captures[1].trim();
  //     var comment = "";
  //     if (name.indexOf("//") !== -1) {
  //       comment = "//" + name.split("//").slice(1).join("//");
  //       name = name.split("//")[0].trim();
  //     }
  //     if (!name) return;
  //     var tok = this.tok("block", name);
  //     var len = captures[0].length - comment.length;
  //     while (this.whitespaceRe.test(this.input.charAt(len - 1))) len--;
  //     this.incrementColumn(len);
  //     tok.mode = "prepend";
  //     this.tokens.push(this.tokEnd<"block">(tok));
  //     this.consume(captures[0].length - comment.length);
  //     this.incrementColumn(captures[0].length - comment.length - len);
  //     return true;
  //   }
  // }
  //#endregion

  //#region Block append.
  // append(): true | undefined {
  //   var captures;
  //   if ((captures = /^(?:block +)?append +([^\n]+)/.exec(this.input))) {
  //     var name = captures[1].trim();
  //     var comment = "";
  //     if (name.indexOf("//") !== -1) {
  //       comment = "//" + name.split("//").slice(1).join("//");
  //       name = name.split("//")[0].trim();
  //     }
  //     if (!name) return;
  //     var tok = this.tok("block", name);
  //     var len = captures[0].length - comment.length;
  //     while (this.whitespaceRe.test(this.input.charAt(len - 1))) len--;
  //     this.incrementColumn(len);
  //     tok.mode = "append";
  //     this.tokens.push(this.tokEnd<"block">(tok));
  //     this.consume(captures[0].length - comment.length);
  //     this.incrementColumn(captures[0].length - comment.length - len);
  //     return true;
  //   }
  // }
  //#endregion

  //#region Block.
  block(): true | undefined {
    let captures: RegExpExecArray;
    if ((captures = /^block +([^\n]+)/.exec(this.input))) {
      var name = captures[1].trim();
      var comment = "";
      if (name.indexOf("//") !== -1) {
        comment = "//" + name.split("//").slice(1).join("//");
        name = name.split("//")[0].trim();
      }
      if (!name) return;
      var tok = this.tok("block", name);
      var len = captures[0].length - comment.length;
      while (this.whitespaceRe.test(this.input.charAt(len - 1))) len--;
      this.incrementColumn(len);
      tok.mode = "replace";
      this.tokens.push(this.tokEnd<"block">(tok));
      this.consume(captures[0].length - comment.length);
      this.incrementColumn(captures[0].length - comment.length - len);
      return true;
    }
  }
  //#endregion

  //#region Mixin block.
  mixinBlock(): true | undefined {
    let tok: MixinBlockToken;
    if ((tok = this.scanEndOfLine(/^block/, "mixin-block"))) {
      this.tokens.push(this.tokEnd<"mixin-block">(tok));
      return true;
    }
  }
  //#endregion

  //#region Yield.
  yield(): true | undefined {
    var tok = this.scanEndOfLine(/^yield/, "yield");
    if (tok) {
      this.tokens.push(this.tokEnd<"yield">(tok));
      return true;
    }
  }
  //#endregion

  //#region Include.
  include(): true | undefined {
    var tok = this.scan(/^include(?=:| |$|\n)/, "include");
    if (tok) {
      this.tokens.push(this.tokEnd<"include">(tok));
      while (this.callLexerFunction("filter", { inInclude: true }));
      if (!this.callLexerFunction("path")) {
        if (/^[^ \n]+/.test(this.input)) {
          // if there is more text
          this.fail();
        } else {
          // if not
          this.error("NO_INCLUDE_PATH", "missing path for include");
        }
      }
      return true;
    }
    if (this.scan(/^include\b/)) {
      this.error("MALFORMED_INCLUDE", "malformed include");
    }
  }
  //#endregion

  //#region Path
  path(): true | undefined {
    const tok = this.scanEndOfLine<"path">(/^ ([^\n]+)/, "path") as PathToken;
    if (tok && (tok.val = tok.val.trim())) {
      this.tokens.push(this.tokEnd<"path">(tok));
      return true;
    }
  }
  //#endregion

  //#region Case.
  case(): true | undefined {
    var tok = this.scanEndOfLine(/^case +([^\n]+)/, "case");
    if (tok) {
      this.incrementColumn(-tok.val.length);
      this.assertExpression(tok.val);
      this.incrementColumn(tok.val.length);
      this.tokens.push(this.tokEnd<"case">(tok));
      return true;
    }
    if (this.scan(/^case\b/)) {
      this.error("NO_CASE_EXPRESSION", "missing expression for case");
    }
  }
  //#endregion

  //#region When.
  when(): true | undefined {
    var tok = this.scanEndOfLine(/^when +([^:\n]+)/, "when");
    if (tok) {
      var parser = parse(tok.val);
      while (parser.isNesting() || parser.isString()) {
        var rest = /:([^:\n]+)/.exec(this.input);
        if (!rest) break;

        tok.val += rest[0];
        this.consume(rest[0].length);
        this.incrementColumn(rest[0].length);
        parser = parse(tok.val);
      }

      this.incrementColumn(-tok.val.length);
      this.assertExpression(tok.val);
      this.incrementColumn(tok.val.length);
      this.tokens.push(this.tokEnd<"when">(tok));
      return true;
    }
    if (this.scan(/^when\b/)) {
      this.error("NO_WHEN_EXPRESSION", "missing expression for when");
    }
  }
  //#endregion

  //#region Default.
  default(): true | undefined {
    var tok = this.scanEndOfLine(/^default/, "default");
    if (tok) {
      this.tokens.push(this.tokEnd<"default">(tok));
      return true;
    }
    if (this.scan(/^default\b/)) {
      this.error(
        "DEFAULT_WITH_EXPRESSION",
        "default should not have an expression"
      );
    }
  }
  //#endregion

  //#region Call mixin
  call(): true | undefined {
    var tok, captures, increment;
    if ((captures = /^\+(\s*)(([-\w]+)|(#\{))/.exec(this.input))) {
      // try to consume simple or interpolated call
      if (captures[3]) {
        // simple call
        increment = captures[0].length;
        this.consume(increment);
        tok = this.tok("call", captures[3]);
      } else {
        // interpolated call
        var match = this.bracketExpression(2 + captures[1].length);
        increment = match.end + 1;
        this.consume(increment);
        this.assertExpression(match.src);
        tok = this.tok("call", "#{" + match.src + "}");
      }

      this.incrementColumn(increment);

      tok.args = null;
      // Check for args (not attributes)
      if ((captures = /^ *\(/.exec(this.input))) {
        var range = this.bracketExpression(captures[0].length - 1);
        if (!/^\s*[-\w]+ *=/.test(range.src)) {
          // not attributes
          this.incrementColumn(1);
          this.consume(range.end + 1);
          tok.args = range.src;
          this.assertExpression("[" + tok.args + "]");
          for (var i = 0; i <= tok.args.length; i++) {
            if (tok.args[i] === "\n") {
              this.incrementLine(1);
            } else {
              this.incrementColumn(1);
            }
          }
        }
      }
      this.tokens.push(this.tokEnd(tok));
      return true;
    }
  }
  //#endregion

  //#region Mixin.
  mixin(): true | undefined {
    var captures;
    if ((captures = /^mixin +([-\w]+)(?: *\((.*)\))? */.exec(this.input))) {
      this.consume(captures[0].length);
      var tok = this.tok("mixin", captures[1]);
      tok.args = captures[2] || null;
      this.incrementColumn(captures[0].length);
      this.tokens.push(this.tokEnd<"mixin">(tok));
      return true;
    }
  }
  //#endregion

  //#region Conditional.
  conditional(): true | undefined {
    let captures: RegExpExecArray;
    if ((captures = /^(if|unless|else if|else)\b([^\n]*)/.exec(this.input))) {
      this.consume(captures[0].length);
      var type: string = captures[1].replace(/ /g, "-");
      var js = captures[2] && captures[2].trim();
      // type can be "if", "else-if" and "else"
      var tok = this.tok<"if" | "else-if" | "else">(
        type as "if" | "else-if" | "else",
        js
      );
      this.incrementColumn(captures[0].length - js.length);

      switch (type) {
        case "if":
        case "else-if":
          this.assertExpression(js);
          break;
        case "unless":
          this.assertExpression(js);
          tok.val = "!(" + js + ")";
          tok.type = "if";
          break;
        case "else":
          if (js) {
            this.error(
              "ELSE_CONDITION",
              "`else` cannot have a condition, perhaps you meant `else if`"
            );
          }
          break;
      }
      this.incrementColumn(js.length);
      this.tokens.push(this.tokEnd<"if">(tok));
      return true;
    }
  }
  //#endregion

  //#region While.
  while(): true | undefined {
    var captures, tok;
    if ((captures = /^while +([^\n]+)/.exec(this.input))) {
      this.consume(captures[0].length);
      this.assertExpression(captures[1]);
      tok = this.tok("while", captures[1]);
      this.incrementColumn(captures[0].length);
      this.tokens.push(this.tokEnd(tok));
      return true;
    }
    if (this.scan(/^while\b/)) {
      this.error("NO_WHILE_EXPRESSION", "missing expression for while");
    }
  }
  //#endregion

  //#region Each.
  each(): true | undefined {
    var captures;
    if (
      (captures =
        /^(?:each|for) +([a-zA-Z_$][\w$]*)(?: *, *([a-zA-Z_$][\w$]*))? * in *([^\n]+)/.exec(
          this.input
        ))
    ) {
      this.consume(captures[0].length);
      var tok = this.tok("each", captures[1]);
      tok.key = captures[2] || null;
      this.incrementColumn(captures[0].length - captures[3].length);
      this.assertExpression(captures[3]);
      tok.code = captures[3];
      this.incrementColumn(captures[3].length);
      this.tokens.push(this.tokEnd<"each">(tok));
      return true;
    }
    const name = /^each\b/.exec(this.input) ? "each" : "for";
    if (this.scan(/^(?:each|for)\b/)) {
      this.error(
        "MALFORMED_EACH",
        "This `" +
          name +
          "` has a syntax error. `" +
          name +
          "` statements should be of the form: `" +
          name +
          " VARIABLE_NAME of JS_EXPRESSION`"
      );
    }
    if (
      (captures =
        /^- *(?:each|for) +([a-zA-Z_$][\w$]*)(?: *, *([a-zA-Z_$][\w$]*))? +in +([^\n]+)/.exec(
          this.input
        ))
    ) {
      this.error(
        "MALFORMED_EACH",
        'Pug each and for should no longer be prefixed with a dash ("-"). They are pug keywords and not part of JavaScript.'
      );
    }
  }
  //#endregion

  //#region Each Of.
  // eachOf(): true | undefined {
  //   var captures;
  //   if ((captures = /^(?:each|for) (.*?) of *([^\n]+)/.exec(this.input))) {
  //     this.consume(captures[0].length);
  //     var tok = this.tok("eachOf", captures[1]);
  //     tok.value = captures[1];
  //     this.incrementColumn(captures[0].length - captures[2].length);
  //     this.assertExpression(captures[2]);
  //     tok.code = captures[2];
  //     this.incrementColumn(captures[2].length);
  //     this.tokens.push(this.tokEnd<"eachOf">(tok));

  //     if (
  //       !(
  //         /^[a-zA-Z_$][\w$]*$/.test(tok.value.trim()) ||
  //         /^\[ *[a-zA-Z_$][\w$]* *\, *[a-zA-Z_$][\w$]* *\]$/.test(
  //           tok.value.trim()
  //         )
  //       )
  //     ) {
  //       this.error(
  //         "MALFORMED_EACH_OF_LVAL",
  //         "The value variable for each must either be a valid identifier (e.g. `item`) or a pair of identifiers in square brackets (e.g. `[key, value]`)."
  //       );
  //     }

  //     return true;
  //   }
  //   if (
  //     (captures =
  //       /^- *(?:each|for) +([a-zA-Z_$][\w$]*)(?: *, *([a-zA-Z_$][\w$]*))? +of +([^\n]+)/.exec(
  //         this.input
  //       ))
  //   ) {
  //     this.error(
  //       "MALFORMED_EACH",
  //       'Pug each and for should not be prefixed with a dash ("-"). They are pug keywords and not part of JavaScript.'
  //     );
  //   }
  // }
  //#endregion

  //#region Code.
  code(): true | undefined {
    var captures;
    if ((captures = /^(!?=|-)[ \t]*([^\n]+)/.exec(this.input))) {
      var flags = captures[1];
      var code = captures[2];
      var shortened = 0;
      if (this.interpolated) {
        var parsed;
        try {
          parsed = parseUntil(code, "]");
        } catch (err) {
          if (err.index !== undefined) {
            this.incrementColumn(captures[0].length - code.length + err.index);
          }
          if (err.code === "CHARACTER_PARSER:END_OF_STRING_REACHED") {
            this.error(
              "NO_END_BRACKET",
              "End of line was reached with no closing bracket for interpolation."
            );
          } else if (err.code === "CHARACTER_PARSER:MISMATCHED_BRACKET") {
            this.error("BRACKET_MISMATCH", err.message);
          } else {
            throw err;
          }
        }
        shortened = code.length - parsed.end;
        code = parsed.src;
      }
      var consumed = captures[0].length - shortened;
      this.consume(consumed);
      var tok = this.tok("code", code);
      tok.mustEscape = flags.charAt(0) === "=";
      tok.buffer = flags.charAt(0) === "=" || flags.charAt(1) === "=";

      // p #[!=    abc] hey
      //     ^              original colno
      //     -------------- captures[0]
      //           -------- captures[2]
      //     ------         captures[0] - captures[2]
      //           ^        after colno

      // =   abc
      // ^                  original colno
      // -------            captures[0]
      //     ---            captures[2]
      // ----               captures[0] - captures[2]
      //     ^              after colno
      this.incrementColumn(captures[0].length - captures[2].length);
      if (tok.buffer) this.assertExpression(code);
      this.tokens.push(tok);

      // p #[!=    abc] hey
      //           ^        original colno
      //              ----- shortened
      //           ---      code
      //              ^     after colno

      // =   abc
      //     ^              original colno
      //                    shortened
      //     ---            code
      //        ^           after colno
      this.incrementColumn(code.length);
      this.tokEnd<"code">(tok);
      return true;
    }
  }
  //#endregion

  //#region Block code.
  blockCode(): true | undefined {
    var tok;
    if ((tok = this.scanEndOfLine(/^-/, "blockcode"))) {
      this.tokens.push(this.tokEnd(tok));
      this.interpolationAllowed = false;
      this.callLexerFunction("pipelessText");
      return true;
    }
  }
  //#endregion

  //#region Attribute Name.
  attribute(str: string): string {
    var quote = "";
    var quoteRe = /['"]/;
    var key = "";
    var i;

    // consume all whitespace before the key
    for (i = 0; i < str.length; i++) {
      if (!this.whitespaceRe.test(str[i])) break;
      if (str[i] === "\n") {
        this.incrementLine(1);
      } else {
        this.incrementColumn(1);
      }
    }

    if (i === str.length) {
      return "";
    }

    var tok = this.tok("attribute");

    // quote?
    if (quoteRe.test(str[i])) {
      quote = str[i];
      this.incrementColumn(1);
      i++;
    }

    // start looping through the key
    for (; i < str.length; i++) {
      if (quote) {
        if (str[i] === quote) {
          this.incrementColumn(1);
          i++;
          break;
        }
      } else {
        if (
          this.whitespaceRe.test(str[i]) ||
          str[i] === "!" ||
          str[i] === "=" ||
          str[i] === ","
        ) {
          break;
        }
      }

      key += str[i];

      if (str[i] === "\n") {
        this.incrementLine(1);
      } else {
        this.incrementColumn(1);
      }
    }

    tok.name = key;

    var valueResponse = this.attributeValue(str.substr(i));

    if (valueResponse.val) {
      tok.val = valueResponse.val;
      tok.mustEscape = valueResponse.mustEscape;
    } else {
      // was a boolean attribute (ex: `input(disabled)`)
      tok.val = true;
      tok.mustEscape = true;
    }

    str = valueResponse.remainingSource;

    this.tokens.push(this.tokEnd<"attribute">(tok));

    for (i = 0; i < str.length; i++) {
      if (!this.whitespaceRe.test(str[i])) {
        break;
      }
      if (str[i] === "\n") {
        this.incrementLine(1);
      } else {
        this.incrementColumn(1);
      }
    }

    if (str[i] === ",") {
      this.incrementColumn(1);
      i++;
    }

    return str.substr(i);
  }
  //#endregion

  //#region Attribute Value.
  attributeValue(str: string): {
    val?: string;
    mustEscape?: boolean;
    remainingSource: string;
  } {
    var quoteRe = /['"]/;
    var val = "";
    var done, i, x;
    var escapeAttr = true;
    var state = defaultState();
    var col = this.colno;
    var line = this.lineno;

    // consume all whitespace before the equals sign
    for (i = 0; i < str.length; i++) {
      if (!this.whitespaceRe.test(str[i])) break;
      if (str[i] === "\n") {
        line++;
        col = 1;
      } else {
        col++;
      }
    }

    if (i === str.length) {
      return { remainingSource: str };
    }

    if (str[i] === "!") {
      escapeAttr = false;
      col++;
      i++;
      if (str[i] !== "=")
        this.error(
          "INVALID_KEY_CHARACTER",
          "Unexpected character " + str[i] + " expected `=`"
        );
    }

    if (str[i] !== "=") {
      // check for anti-pattern `div("foo"bar)`
      if (i === 0 && str && !this.whitespaceRe.test(str[0]) && str[0] !== ",") {
        this.error(
          "INVALID_KEY_CHARACTER",
          "Unexpected character " + str[0] + " expected `=`"
        );
      } else {
        return { remainingSource: str };
      }
    }

    this.lineno = line;
    this.colno = col + 1;
    i++;

    // consume all whitespace before the value
    for (; i < str.length; i++) {
      if (!this.whitespaceRe.test(str[i])) break;
      if (str[i] === "\n") {
        this.incrementLine(1);
      } else {
        this.incrementColumn(1);
      }
    }

    line = this.lineno;
    col = this.colno;

    // start looping through the value
    for (; i < str.length; i++) {
      // if the character is in a string or in parentheses/brackets/braces
      if (!(state.isNesting() || state.isString())) {
        if (this.whitespaceRe.test(str[i])) {
          done = false;

          // find the first non-whitespace character
          for (x = i; x < str.length; x++) {
            if (!this.whitespaceRe.test(str[x])) {
              // if it is a JavaScript punctuator, then assume that it is
              // a part of the value
              const isNotPunctuator = !isPunctuator(str[x]);
              const isQuote = quoteRe.test(str[x]);
              const isColon = str[x] === ":";
              const isSpreadOperator =
                str[x] + str[x + 1] + str[x + 2] === "...";
              if (
                (isNotPunctuator || isQuote || isColon || isSpreadOperator) &&
                this.assertExpression(val, true)
              ) {
                done = true;
              }
              break;
            }
          }

          // if everything else is whitespace, return now so last attribute
          // does not include trailing whitespace
          if (done || x === str.length) {
            break;
          }
        }

        // if there's no whitespace and the character is not ',', the
        // attribute did not end.
        if (str[i] === "," && this.assertExpression(val, true)) {
          break;
        }
      }

      state = parseChar(str[i], state);
      val += str[i];

      if (str[i] === "\n") {
        line++;
        col = 1;
      } else {
        col++;
      }
    }

    this.assertExpression(val);

    this.lineno = line;
    this.colno = col;

    return { val: val, mustEscape: escapeAttr, remainingSource: str.substr(i) };
  }
  //#endregion

  //#region Attributes
  attrs(): true | undefined {
    var tok;

    if ("(" == this.input.charAt(0)) {
      tok = this.tok("start-attributes");
      var index = this.bracketExpression().end;
      var str = this.input.substr(1, index - 1);

      this.incrementColumn(1);
      this.tokens.push(this.tokEnd(tok));
      this.assertNestingCorrect(str);
      this.consume(index + 1);

      while (str) {
        str = this.attribute(str);
      }

      tok = this.tok("end-attributes");
      this.incrementColumn(1);
      this.tokens.push(this.tokEnd(tok));
      return true;
    }
  }
  //#endregion

  //#region &attributes block
  // attributesBlock(): true | undefined {
  //   if (/^&attributes\b/.test(this.input)) {
  //     var consumed = 11;
  //     this.consume(consumed);
  //     var tok = this.tok("&attributes");
  //     this.incrementColumn(consumed);
  //     var args = this.bracketExpression();
  //     consumed = args.end + 1;
  //     this.consume(consumed);
  //     tok.val = args.src;
  //     this.incrementColumn(consumed);
  //     this.tokens.push(this.tokEnd<"&attributes">(tok));
  //     return true;
  //   }
  // }
  //#endregion

  //#region Indent | Outdent | Newline.
  indent(): true | NewlineToken | undefined {
    var captures = this.scanIndentation();
    var tok;

    if (captures) {
      var indents = captures[1].length;

      this.incrementLine(1);
      this.consume(indents + 1);

      if (" " == this.input[0] || "\t" == this.input[0]) {
        this.error(
          "INVALID_INDENTATION",
          "Invalid indentation, you can use tabs or spaces but not both"
        );
      }

      // blank line
      if ("\n" == this.input[0]) {
        this.interpolationAllowed = true;
        return this.tokEnd<"newline">(this.tok("newline"));
      }

      // outdent
      if (indents < this.indentStack[0]) {
        var outdent_count = 0;
        while (this.indentStack[0] > indents) {
          if (this.indentStack[1] < indents) {
            this.error(
              "INCONSISTENT_INDENTATION",
              "Inconsistent indentation. Expecting either " +
                this.indentStack[1] +
                " or " +
                this.indentStack[0] +
                " spaces/tabs."
            );
          }
          outdent_count++;
          this.indentStack.shift();
        }
        while (outdent_count--) {
          this.colno = 1;
          tok = this.tok("outdent");
          this.colno = this.indentStack[0] + 1;
          this.tokens.push(this.tokEnd(tok));
        }
        // indent
      } else if (indents && indents != this.indentStack[0]) {
        tok = this.tok("indent", indents);
        this.colno = 1 + indents;
        this.tokens.push(this.tokEnd(tok));
        this.indentStack.unshift(indents);
        // newline
      } else {
        tok = this.tok("newline");
        this.colno = 1 + Math.min(this.indentStack[0] || 0, indents);
        this.tokens.push(this.tokEnd(tok));
      }

      this.interpolationAllowed = true;
      return true;
    }
  }
  //#endregion

  pipelessText = function pipelessText(indents?: number): boolean | undefined {
    while (this.callLexerFunction("blank"));

    var captures = this.scanIndentation();

    indents = indents || (captures && captures[1].length);
    if (indents > this.indentStack[0]) {
      this.tokens.push(this.tokEnd(this.tok("start-pipeless-text")));
      var tokens = [];
      var token_indent = [];
      var isMatch;
      // Index in this.input. Can't use this.consume because we might need to
      // retry lexing the block.
      var stringPtr = 0;
      do {
        // text has `\n` as a prefix
        var i = this.input.substr(stringPtr + 1).indexOf("\n");
        if (-1 == i) i = this.input.length - stringPtr - 1;
        var str = this.input.substr(stringPtr + 1, i);
        var lineCaptures = this.indentRe.exec("\n" + str);
        var lineIndents = lineCaptures && lineCaptures[1].length;
        isMatch = lineIndents >= indents;
        token_indent.push(isMatch);
        isMatch = isMatch || !str.trim();
        if (isMatch) {
          // consume test along with `\n` prefix if match
          stringPtr += str.length + 1;
          tokens.push(str.substr(indents));
        } else if (lineIndents > this.indentStack[0]) {
          // line is indented less than the first line but is still indented
          // need to retry lexing the text block
          this.tokens.pop();
          return pipelessText.call(this, lineCaptures[1].length);
        }
      } while (this.input.length - stringPtr && isMatch);
      this.consume(stringPtr);
      while (this.input.length === 0 && tokens[tokens.length - 1] === "")
        tokens.pop();
      tokens.forEach(
        function (token, i) {
          var tok;
          this.incrementLine(1);
          if (i !== 0) tok = this.tok("newline");
          if (token_indent[i]) this.incrementColumn(indents);
          if (tok) this.tokens.push(this.tokEnd(tok));
          this.addText("text", token);
        }.bind(this)
      );
      this.tokens.push(this.tokEnd(this.tok("end-pipeless-text")));
      return true;
    }
  };

  //#region Slash.
  slash(): true | undefined {
    const tok = this.scan(/^\//, "slash");
    if (tok) {
      this.tokens.push(this.tokEnd<"slash">(tok));
      return true;
    }
  }
  //#endregion

  //#region ':'
  colon(): true | undefined {
    const tok = this.scan(/^: +/, ":");
    if (tok) {
      this.tokens.push(this.tokEnd<":">(tok));
      return true;
    }
  }
  //#endregion

  fail(): never {
    this.error(
      "UNEXPECTED_TEXT",
      'unexpected text "' + this.input.substr(0, 5) + '"'
    );
  }

  callLexerFunction(func: string, ...args: any[]): boolean {
    var rest = [];
    for (var i = 1; i < arguments.length; i++) {
      rest.push(arguments[i]);
    }
    var pluginArgs = [this].concat(rest);
    for (var i = 0; i < this.plugins.length; i++) {
      var plugin = this.plugins[i];
      if (plugin[func] && plugin[func].apply(plugin, pluginArgs)) {
        return true;
      }
    }
    return this[func].apply(this, rest);
  }

  /**
   * Move to the next token
   */
  private advance(): boolean {
    return (
      this.callLexerFunction("blank") ||
      this.callLexerFunction("eos") ||
      this.callLexerFunction("endInterpolation") ||
      this.callLexerFunction("yield") ||
      this.callLexerFunction("doctype") ||
      this.callLexerFunction("interpolation") ||
      this.callLexerFunction("case") ||
      this.callLexerFunction("when") ||
      this.callLexerFunction("default") ||
      // this.callLexerFunction("extends") ||
      // this.callLexerFunction("append") ||
      // this.callLexerFunction("prepend") ||
      // this.callLexerFunction("block") ||
      this.callLexerFunction("mixinBlock") ||
      this.callLexerFunction("include") ||
      this.callLexerFunction("mixin") ||
      this.callLexerFunction("call") ||
      this.callLexerFunction("conditional") ||
      // this.callLexerFunction("eachOf") ||
      this.callLexerFunction("each") ||
      this.callLexerFunction("while") ||
      this.callLexerFunction("tag") ||
      this.callLexerFunction("filter") ||
      this.callLexerFunction("blockCode") ||
      this.callLexerFunction("code") ||
      this.callLexerFunction("id") ||
      this.callLexerFunction("dot") ||
      this.callLexerFunction("className") ||
      this.callLexerFunction("attrs") ||
      // this.callLexerFunction("attributesBlock") ||
      this.callLexerFunction("indent") ||
      this.callLexerFunction("text") ||
      this.callLexerFunction("textHtml") ||
      this.callLexerFunction("comment") ||
      this.callLexerFunction("slash") ||
      this.callLexerFunction("colon") ||
      this.fail()
    );
  }

  /**
   * Return an array of tokens for the current file
   */
  getTokens(): Token[] {
    while (!this.ended) {
      this.callLexerFunction("advance");
    }
    return this.tokens;
  }
}

export function lex(str: string, options: LexerOptions) {
  const lexer = new Lexer(str, options);
  return JSON.parse(JSON.stringify(lexer.getTokens()));
}
