import camelcase from "camelcase";
import { join, dirname, basename } from "path";
import fileSystem from "fs-extra";
import assert from "assert";
import { parseExpression } from "@babel/parser";
import {
  parse as parse$1,
  parseUntil,
  defaultState,
  isPunctuator,
  parseChar
} from "character-parser";
import error from "pug-error";
import { isNull, isEmpty } from "lodash-es";
import { format } from "prettier";

function isExpression(src) {
  try {
    const result = parseExpression(src);
    if (result.errors) {
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

class Lexer {
  constructor(str, options) {
    this.pipelessText = function pipelessText(indents) {
      while (this.callLexerFunction("blank"));
      var captures = this.scanIndentation();
      indents = indents || (captures && captures[1].length);
      if (indents > this.indentStack[0]) {
        this.tokens.push(this.tokEnd(this.tok("start-pipeless-text")));
        var tokens = [];
        var token_indent = [];
        var isMatch;
        var stringPtr = 0;
        do {
          var i = this.input.substr(stringPtr + 1).indexOf("\n");
          if (-1 == i) i = this.input.length - stringPtr - 1;
          var str = this.input.substr(stringPtr + 1, i);
          var lineCaptures = this.indentRe.exec("\n" + str);
          var lineIndents = lineCaptures && lineCaptures[1].length;
          isMatch = lineIndents >= indents;
          token_indent.push(isMatch);
          isMatch = isMatch || !str.trim();
          if (isMatch) {
            stringPtr += str.length + 1;
            tokens.push(str.substr(indents));
          } else if (lineIndents > this.indentStack[0]) {
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
    this.interpolationAllowed = true;
    this.whitespaceRe = /[ \n\t]/;
    this.tokens = [];
    this.ended = false;
  }
  error(code, message) {
    var err = error(code, message, {
      line: this.lineno,
      column: this.colno,
      filename: this.filename,
      src: this.originalInput
    });
    throw err;
  }
  assert(value, message) {
    if (!value) this.error("ASSERT_FAILED", message);
  }
  isExpression(exp) {
    return isExpression(exp);
  }
  assertExpression(exp, noThrow) {
    try {
      this.callLexerFunction("isExpression", exp);
      return true;
    } catch (ex) {
      if (noThrow) return false;
      if (!ex.loc) throw ex;
      this.incrementLine(ex.loc.line - 1);
      this.incrementColumn(ex.loc.column);
      var msg =
        "Syntax Error: " + ex.message.replace(/ \([0-9]+:[0-9]+\)$/, "");
      this.error("SYNTAX_ERROR", msg);
    }
  }
  assertNestingCorrect(exp) {
    var res = parse$1(exp);
    if (res.isNesting()) {
      this.error(
        "INCORRECT_NESTING",
        "Nesting must match on expression `" + exp + "`"
      );
    }
  }
  tok(type, val) {
    var res = {
      type: type,
      loc: {
        start: {
          line: this.lineno,
          column: this.colno
        },
        filename: this.filename
      }
    };
    if (val !== undefined) res.val = val;
    return res;
  }
  tokEnd(tok) {
    tok.loc.end = {
      line: this.lineno,
      column: this.colno
    };
    return tok;
  }
  incrementLine(increment) {
    this.lineno += increment;
    if (increment) this.colno = 1;
  }
  incrementColumn(increment) {
    this.colno += increment;
  }
  consume(len) {
    this.input = this.input.substr(len);
  }
  scan(regexp, type) {
    let captures;
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
  scanEndOfLine(regexp, type) {
    let captures;
    if ((captures = regexp.exec(this.input))) {
      let whitespaceLength = 0;
      let whitespace;
      let tok;
      if ((whitespace = /^([ ]+)([^ ]*)/.exec(captures[0]))) {
        whitespaceLength = whitespace[1].length;
        this.incrementColumn(whitespaceLength);
      }
      var newInput = this.input.substr(captures[0].length);
      if (newInput[0] === ":") {
        this.input = newInput;
        tok = this.tok(type, captures[1]);
        this.incrementColumn(captures[0].length - whitespaceLength);
        return tok;
      }
      if (/^[ \t]*(\n|$)/.test(newInput)) {
        this.input = newInput.substr(/^[ \t]*/.exec(newInput)[0].length);
        tok = this.tok(type, captures[1]);
        this.incrementColumn(captures[0].length - whitespaceLength);
        return tok;
      }
    }
  }
  bracketExpression(skip) {
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
        var tmp = this.input.substr(skip).indexOf("\n");
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
  scanIndentation() {
    let captures, re;
    if (this.indentRe) {
      captures = this.indentRe.exec(this.input);
    } else {
      re = /^\n(\t*) */;
      captures = re.exec(this.input);
      if (captures && !captures[1].length) {
        re = /^\n( *)/;
        captures = re.exec(this.input);
      }
      if (captures && captures[1].length) this.indentRe = re;
    }
    return captures;
  }
  eos() {
    if (this.input.length) return;
    if (this.interpolated) {
      this.error(
        "NO_END_BRACKET",
        "End of line was reached with no closing bracket for interpolation."
      );
    }
    for (var i = 0; this.indentStack[i]; i++) {
      this.tokens.push(this.tokEnd(this.tok("outdent")));
    }
    this.tokens.push(this.tokEnd(this.tok("eos")));
    this.ended = true;
    return true;
  }
  blank() {
    var captures;
    if ((captures = /^\n[ \t]*\n/.exec(this.input))) {
      this.consume(captures[0].length - 1);
      this.incrementLine(1);
      return true;
    }
  }
  comment() {
    var captures;
    if ((captures = /^\/\/(-)?([^\n]*)/.exec(this.input))) {
      this.consume(captures[0].length);
      var tok = this.tok("comment", captures[2]);
      tok.buffer = "-" != captures[1];
      this.interpolationAllowed = tok.buffer;
      this.tokens.push(tok);
      this.incrementColumn(captures[0].length);
      this.tokEnd(tok);
      this.callLexerFunction("pipelessText");
      return true;
    }
  }
  interpolation() {
    if (/^#\{/.test(this.input)) {
      var match = this.bracketExpression(1);
      this.consume(match.end + 1);
      var tok = this.tok("interpolation", match.src);
      this.tokens.push(tok);
      this.incrementColumn(2);
      this.assertExpression(match.src);
      var splitted = match.src.split("\n");
      var lines = splitted.length - 1;
      this.incrementLine(lines);
      this.incrementColumn(splitted[lines].length + 1);
      this.tokEnd(tok);
      return true;
    }
  }
  tag() {
    var captures;
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
  filter(opts) {
    var tok = this.scan(/^:([\w\-]+)/, "filter");
    var inInclude = opts && opts.inInclude;
    if (tok) {
      this.tokens.push(tok);
      this.incrementColumn(tok.val.length);
      this.tokEnd(tok);
      this.callLexerFunction("attrs");
      if (!inInclude) {
        this.interpolationAllowed = false;
        this.callLexerFunction("pipelessText");
      }
      return true;
    }
  }
  doctype() {
    var node = this.scanEndOfLine(/^doctype *([^\n]*)/, "doctype");
    if (node) {
      this.tokens.push(this.tokEnd(node));
      return true;
    }
  }
  id() {
    var tok = this.scan(/^#([\w-]+)/, "id");
    if (tok) {
      this.tokens.push(tok);
      this.incrementColumn(tok.val.length);
      this.tokEnd(tok);
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
  className() {
    var tok = this.scan(/^\.([_a-z0-9\-]*[_a-z][_a-z0-9\-]*)/i, "class");
    if (tok) {
      this.tokens.push(tok);
      this.incrementColumn(tok.val.length);
      this.tokEnd(tok);
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
  endInterpolation() {
    if (this.interpolated && this.input[0] === "]") {
      this.input = this.input.substr(1);
      this.ended = true;
      return true;
    }
  }
  addText(type, value, prefix, escaped) {
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
  text() {
    var tok =
      this.scan(/^(?:\| ?| )([^\n]+)/, "text") ||
      this.scan(/^( )/, "text") ||
      this.scan(/^\|( ?)/, "text");
    if (tok) {
      this.addText("text", tok.val);
      return true;
    }
  }
  textHtml() {
    var tok = this.scan(/^(<[^\n]*)/, "text-html");
    if (tok) {
      this.addText("text-html", tok.val);
      return true;
    }
  }
  dot() {
    var tok;
    if ((tok = this.scanEndOfLine(/^\./, "dot"))) {
      this.tokens.push(this.tokEnd(tok));
      this.callLexerFunction("pipelessText");
      return true;
    }
  }
  block() {
    let captures;
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
      this.tokens.push(this.tokEnd(tok));
      this.consume(captures[0].length - comment.length);
      this.incrementColumn(captures[0].length - comment.length - len);
      return true;
    }
  }
  mixinBlock() {
    let tok;
    if ((tok = this.scanEndOfLine(/^block/, "mixin-block"))) {
      this.tokens.push(this.tokEnd(tok));
      return true;
    }
  }
  yield() {
    var tok = this.scanEndOfLine(/^yield/, "yield");
    if (tok) {
      this.tokens.push(this.tokEnd(tok));
      return true;
    }
  }
  include() {
    var tok = this.scan(/^include(?=:| |$|\n)/, "include");
    if (tok) {
      this.tokens.push(this.tokEnd(tok));
      while (this.callLexerFunction("filter", { inInclude: true }));
      if (!this.callLexerFunction("path")) {
        if (/^[^ \n]+/.test(this.input)) {
          this.fail();
        } else {
          this.error("NO_INCLUDE_PATH", "missing path for include");
        }
      }
      return true;
    }
    if (this.scan(/^include\b/)) {
      this.error("MALFORMED_INCLUDE", "malformed include");
    }
  }
  path() {
    const tok = this.scanEndOfLine(/^ ([^\n]+)/, "path");
    if (tok && (tok.val = tok.val.trim())) {
      this.tokens.push(this.tokEnd(tok));
      return true;
    }
  }
  case() {
    var tok = this.scanEndOfLine(/^case +([^\n]+)/, "case");
    if (tok) {
      this.incrementColumn(-tok.val.length);
      this.assertExpression(tok.val);
      this.incrementColumn(tok.val.length);
      this.tokens.push(this.tokEnd(tok));
      return true;
    }
    if (this.scan(/^case\b/)) {
      this.error("NO_CASE_EXPRESSION", "missing expression for case");
    }
  }
  when() {
    var tok = this.scanEndOfLine(/^when +([^:\n]+)/, "when");
    if (tok) {
      var parser = parse$1(tok.val);
      while (parser.isNesting() || parser.isString()) {
        var rest = /:([^:\n]+)/.exec(this.input);
        if (!rest) break;
        tok.val += rest[0];
        this.consume(rest[0].length);
        this.incrementColumn(rest[0].length);
        parser = parse$1(tok.val);
      }
      this.incrementColumn(-tok.val.length);
      this.assertExpression(tok.val);
      this.incrementColumn(tok.val.length);
      this.tokens.push(this.tokEnd(tok));
      return true;
    }
    if (this.scan(/^when\b/)) {
      this.error("NO_WHEN_EXPRESSION", "missing expression for when");
    }
  }
  default() {
    var tok = this.scanEndOfLine(/^default/, "default");
    if (tok) {
      this.tokens.push(this.tokEnd(tok));
      return true;
    }
    if (this.scan(/^default\b/)) {
      this.error(
        "DEFAULT_WITH_EXPRESSION",
        "default should not have an expression"
      );
    }
  }
  call() {
    var tok, captures, increment;
    if ((captures = /^\+(\s*)(([-\w]+)|(#\{))/.exec(this.input))) {
      if (captures[3]) {
        increment = captures[0].length;
        this.consume(increment);
        tok = this.tok("call", captures[3]);
      } else {
        var match = this.bracketExpression(2 + captures[1].length);
        increment = match.end + 1;
        this.consume(increment);
        this.assertExpression(match.src);
        tok = this.tok("call", "#{" + match.src + "}");
      }
      this.incrementColumn(increment);
      tok.args = null;
      if ((captures = /^ *\(/.exec(this.input))) {
        var range = this.bracketExpression(captures[0].length - 1);
        if (!/^\s*[-\w]+ *=/.test(range.src)) {
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
  mixin() {
    var captures;
    if ((captures = /^mixin +([-\w]+)(?: *\((.*)\))? */.exec(this.input))) {
      this.consume(captures[0].length);
      var tok = this.tok("mixin", captures[1]);
      tok.args = captures[2] || null;
      this.incrementColumn(captures[0].length);
      this.tokens.push(this.tokEnd(tok));
      return true;
    }
  }
  conditional() {
    let captures;
    if ((captures = /^(if|unless|else if|else)\b([^\n]*)/.exec(this.input))) {
      this.consume(captures[0].length);
      var type = captures[1].replace(/ /g, "-");
      var js = captures[2] && captures[2].trim();
      var tok = this.tok(type, js);
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
      this.tokens.push(this.tokEnd(tok));
      return true;
    }
  }
  while() {
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
  each() {
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
      this.tokens.push(this.tokEnd(tok));
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
  code() {
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
      this.incrementColumn(captures[0].length - captures[2].length);
      if (tok.buffer) this.assertExpression(code);
      this.tokens.push(tok);
      this.incrementColumn(code.length);
      this.tokEnd(tok);
      return true;
    }
  }
  blockCode() {
    var tok;
    if ((tok = this.scanEndOfLine(/^-/, "blockcode"))) {
      this.tokens.push(this.tokEnd(tok));
      this.interpolationAllowed = false;
      this.callLexerFunction("pipelessText");
      return true;
    }
  }
  attribute(str) {
    var quote = "";
    var quoteRe = /['"]/;
    var key = "";
    var i;
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
    if (quoteRe.test(str[i])) {
      quote = str[i];
      this.incrementColumn(1);
      i++;
    }
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
      tok.val = true;
      tok.mustEscape = true;
    }
    str = valueResponse.remainingSource;
    this.tokens.push(this.tokEnd(tok));
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
  attributeValue(str) {
    var quoteRe = /['"]/;
    var val = "";
    var done, i, x;
    var escapeAttr = true;
    var state = defaultState();
    var col = this.colno;
    var line = this.lineno;
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
    for (; i < str.length; i++) {
      if (!(state.isNesting() || state.isString())) {
        if (this.whitespaceRe.test(str[i])) {
          done = false;
          for (x = i; x < str.length; x++) {
            if (!this.whitespaceRe.test(str[x])) {
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
          if (done || x === str.length) {
            break;
          }
        }
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
  attrs() {
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
  indent() {
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
      if ("\n" == this.input[0]) {
        this.interpolationAllowed = true;
        return this.tokEnd(this.tok("newline"));
      }
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
      } else if (indents && indents != this.indentStack[0]) {
        tok = this.tok("indent", indents);
        this.colno = 1 + indents;
        this.tokens.push(this.tokEnd(tok));
        this.indentStack.unshift(indents);
      } else {
        tok = this.tok("newline");
        this.colno = 1 + Math.min(this.indentStack[0] || 0, indents);
        this.tokens.push(this.tokEnd(tok));
      }
      this.interpolationAllowed = true;
      return true;
    }
  }
  slash() {
    const tok = this.scan(/^\//, "slash");
    if (tok) {
      this.tokens.push(this.tokEnd(tok));
      return true;
    }
  }
  colon() {
    const tok = this.scan(/^: +/, ":");
    if (tok) {
      this.tokens.push(this.tokEnd(tok));
      return true;
    }
  }
  fail() {
    this.error(
      "UNEXPECTED_TEXT",
      'unexpected text "' + this.input.substr(0, 5) + '"'
    );
  }
  callLexerFunction(func, ...args) {
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
  advance() {
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
      this.callLexerFunction("mixinBlock") ||
      this.callLexerFunction("include") ||
      this.callLexerFunction("mixin") ||
      this.callLexerFunction("call") ||
      this.callLexerFunction("conditional") ||
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
      this.callLexerFunction("indent") ||
      this.callLexerFunction("text") ||
      this.callLexerFunction("textHtml") ||
      this.callLexerFunction("comment") ||
      this.callLexerFunction("slash") ||
      this.callLexerFunction("colon") ||
      this.fail()
    );
  }
  getTokens() {
    while (!this.ended) {
      this.callLexerFunction("advance");
    }
    return this.tokens;
  }
}
function lex(str, options) {
  const lexer = new Lexer(str, options);
  return JSON.parse(JSON.stringify(lexer.getTokens()));
}

class TokenStream {
  constructor(tokens) {
    if (!Array.isArray(tokens)) {
      throw new TypeError("tokens must be passed to TokenStream as an array.");
    }
    this._tokens = tokens;
  }
  lookahead(index) {
    if (this._tokens.length <= index) {
      throw new Error("Cannot read past the end of a stream");
    }
    return this._tokens[index];
  }
  peek() {
    if (this._tokens.length === 0) {
      throw new Error("Cannot read past the end of a stream");
    }
    return this._tokens[0];
  }
  advance() {
    if (this._tokens.length === 0) {
      throw new Error("Cannot read past the end of a stream");
    }
    return this._tokens.shift();
  }
  defer(token) {
    this._tokens.unshift(token);
  }
}

const inlineTags = [
  "a",
  "abbr",
  "acronym",
  "b",
  "br",
  "code",
  "em",
  "font",
  "i",
  "img",
  "ins",
  "kbd",
  "map",
  "samp",
  "small",
  "span",
  "strong",
  "sub",
  "sup"
];
function parse(tokens, options) {
  var parser = new Parser(tokens, options);
  var ast = parser.startParsing();
  return JSON.parse(JSON.stringify(ast));
}
class Parser {
  constructor(tokens, options) {
    options = options || {};
    if (!Array.isArray(tokens)) {
      throw new Error(
        'Expected tokens to be an Array but got "' + typeof tokens + '"'
      );
    }
    if (typeof options !== "object") {
      throw new Error(
        'Expected "options" to be an object but got "' + typeof options + '"'
      );
    }
    this.tokens = new TokenStream(tokens);
    this.filename = options.filename;
    this.src = options.src;
    this.inMixin = 0;
    this.plugins = options.plugins || [];
  }
  startParsing() {
    var block = this.emptyBlock(0);
    while ("eos" != this.peek().type) {
      if ("newline" == this.peek().type) {
        this.advance();
      } else if ("text-html" == this.peek().type) {
        block.nodes = block.nodes.concat(this.parseTextHtml());
      } else {
        var expr = this.parseExpr();
        if (expr) {
          if (expr.type === "Block") {
            block.nodes = block.nodes.concat(expr.nodes);
          } else {
            block.nodes.push(expr);
          }
        }
      }
    }
    return block;
  }
  error(code, message, token) {
    var err = error(code, message, {
      line: token.loc.start.line,
      column: token.loc.start.column,
      filename: this.filename,
      src: this.src
    });
    throw err;
  }
  advance() {
    return this.tokens.advance();
  }
  peek() {
    return this.tokens.peek();
  }
  lookahead(n) {
    return this.tokens.lookahead(n);
  }
  expect(type) {
    if (this.peek().type === type) {
      return this.advance();
    } else {
      this.error(
        "INVALID_TOKEN",
        'expected "' + type + '", but got "' + this.peek().type + '"',
        this.peek()
      );
    }
  }
  accept(type) {
    if (this.peek().type === type) {
      return this.advance();
    }
  }
  initBlock(line, nodes) {
    if ((line | 0) !== line) throw new Error("`line` is not an integer");
    if (!Array.isArray(nodes)) throw new Error("`nodes` is not an array");
    return {
      type: "Block",
      nodes: nodes,
      line: line,
      filename: this.filename
    };
  }
  emptyBlock(line) {
    return this.initBlock(line, []);
  }
  runPlugin(context, tok, ...args) {
    var rest = [this];
    for (var i = 2; i < arguments.length; i++) {
      rest.push(arguments[i]);
    }
    var pluginContext;
    for (var i = 0; i < this.plugins.length; i++) {
      var plugin = this.plugins[i];
      if (plugin[context] && plugin[context][tok.type]) {
        if (pluginContext)
          throw new Error(
            "Multiple plugin handlers found for context " +
              JSON.stringify(context) +
              ", token type " +
              JSON.stringify(tok.type)
          );
        pluginContext = plugin[context];
      }
    }
    if (pluginContext)
      return pluginContext[tok.type].apply(pluginContext, rest);
  }
  parseExpr() {
    switch (this.peek().type) {
      case "tag":
        return this.parseTag();
      case "mixin":
        return this.parseMixin();
      case "mixin-block":
        return this.parseMixinBlock();
      case "case":
        return this.parseCase();
      case "include":
        return this.parseInclude();
      case "doctype":
        return this.parseDoctype();
      case "filter":
        return this.parseFilter();
      case "comment":
        return this.parseComment();
      case "text":
      case "interpolated-code":
      case "start-pug-interpolation":
        return this.parseText({ block: true });
      case "text-html":
        return this.initBlock(this.peek().loc.start.line, this.parseTextHtml());
      case "dot":
        return this.parseDot();
      case "each":
        return this.parseEach();
      case "code":
        return this.parseCode();
      case "blockcode":
        return this.parseBlockCode();
      case "if":
        return this.parseConditional();
      case "while":
        return this.parseWhile();
      case "call":
        return this.parseCall();
      case "interpolation":
        return this.parseInterpolation();
      case "yield":
        return this.parseYield();
      case "id":
      case "class":
        if (!this.peek().loc.start) debugger;
        this.tokens.defer({
          type: "tag",
          val: "div",
          loc: this.peek().loc
        });
        return this.parseExpr();
      default:
        var pluginResult = this.runPlugin("expressionTokens", this.peek());
        if (pluginResult) return pluginResult;
        this.error(
          "INVALID_TOKEN",
          'unexpected token "' + this.peek().type + '"',
          this.peek()
        );
    }
  }
  parseDot() {
    this.advance();
    return this.parseTextBlock();
  }
  parseText(options) {
    var tags = [];
    var lineno = this.peek().loc.start.line;
    var nextTok = this.peek();
    loop: while (true) {
      switch (nextTok.type) {
        case "text":
          const textTok = this.advance();
          tags.push({
            type: "Text",
            val: textTok.val,
            line: textTok.loc.start.line,
            column: textTok.loc.start.column,
            filename: this.filename
          });
          break;
        case "interpolated-code":
          const interpolatedCodeTok = this.advance();
          tags.push({
            type: "Code",
            val: interpolatedCodeTok.val,
            buffer: interpolatedCodeTok.buffer,
            mustEscape: interpolatedCodeTok.mustEscape !== false,
            isInline: true,
            line: interpolatedCodeTok.loc.start.line,
            column: interpolatedCodeTok.loc.start.column,
            filename: this.filename
          });
          break;
        case "newline":
          if (!options || !options.block) break loop;
          const newLineTok = this.advance();
          var nextType = this.peek().type;
          if (nextType === "text" || nextType === "interpolated-code") {
            tags.push({
              type: "Text",
              val: "\n",
              line: newLineTok.loc.start.line,
              column: newLineTok.loc.start.column,
              filename: this.filename
            });
          }
          break;
        case "start-pug-interpolation":
          this.advance();
          tags.push(this.parseExpr());
          this.expect("end-pug-interpolation");
          break;
        default:
          var pluginResult = this.runPlugin("textTokens", nextTok, tags);
          if (pluginResult) break;
          break loop;
      }
      nextTok = this.peek();
    }
    if (tags.length === 1) return tags[0];
    else return this.initBlock(lineno, tags);
  }
  parseTextHtml() {
    const nodes = [];
    var currentNode = null;
    loop: while (true) {
      switch (this.peek().type) {
        case "text-html":
          var text = this.advance();
          if (!currentNode) {
            currentNode = {
              type: "Text",
              val: text.val,
              filename: this.filename,
              line: text.loc.start.line,
              column: text.loc.start.column,
              isHtml: true
            };
            nodes.push(currentNode);
          } else {
            currentNode.val += "\n" + text.val;
          }
          break;
        case "indent":
          var block = this.block();
          block.nodes.forEach(function (node) {
            if (node.isHtml) {
              if (!currentNode) {
                currentNode = node;
                nodes.push(currentNode);
              } else {
                currentNode.val += "\n" + node.val;
              }
            } else {
              currentNode = null;
              nodes.push(node);
            }
          });
          break;
        case "code":
          currentNode = null;
          nodes.push(this.parseCode(true));
          break;
        case "newline":
          this.advance();
          break;
        default:
          break loop;
      }
    }
    return nodes;
  }
  parseBlockExpansion() {
    var tok = this.accept(":");
    if (tok) {
      var expr = this.parseExpr();
      return expr.type === "Block"
        ? expr
        : this.initBlock(tok.loc.start.line, [expr]);
    } else {
      return this.block();
    }
  }
  parseCase() {
    var tok = this.expect("case");
    var node = {
      type: "Case",
      expr: tok.val,
      line: tok.loc.start.line,
      column: tok.loc.start.column,
      filename: this.filename
    };
    var block = this.emptyBlock(tok.loc.start.line + 1);
    this.expect("indent");
    while ("outdent" != this.peek().type) {
      switch (this.peek().type) {
        case "comment":
        case "newline":
          this.advance();
          break;
        case "when":
          block.nodes.push(this.parseWhen());
          break;
        case "default":
          block.nodes.push(this.parseDefault());
          break;
        default:
          var pluginResult = this.runPlugin("caseTokens", this.peek(), block);
          if (pluginResult) break;
          this.error(
            "INVALID_TOKEN",
            'Unexpected token "' +
              this.peek().type +
              '", expected "when", "default" or "newline"',
            this.peek()
          );
      }
    }
    this.expect("outdent");
    node.block = block;
    return node;
  }
  parseWhen() {
    var tok = this.expect("when");
    if (this.peek().type !== "newline") {
      return {
        type: "When",
        expr: tok.val,
        block: this.parseBlockExpansion(),
        debug: false,
        line: tok.loc.start.line,
        column: tok.loc.start.column,
        filename: this.filename
      };
    } else {
      return {
        type: "When",
        expr: tok.val,
        debug: false,
        line: tok.loc.start.line,
        column: tok.loc.start.column,
        filename: this.filename
      };
    }
  }
  parseDefault() {
    var tok = this.expect("default");
    return {
      type: "When",
      expr: "default",
      block: this.parseBlockExpansion(),
      debug: false,
      line: tok.loc.start.line,
      column: tok.loc.start.column,
      filename: this.filename
    };
  }
  parseCode(noBlock = false) {
    var tok = this.expect("code");
    assert(
      typeof tok.mustEscape === "boolean",
      "Please update to the newest version of pug-lexer."
    );
    var node = {
      type: "Code",
      val: tok.val,
      buffer: tok.buffer,
      mustEscape: tok.mustEscape !== false,
      isInline: !!noBlock,
      line: tok.loc.start.line,
      column: tok.loc.start.column,
      filename: this.filename
    };
    if (node.val.match(/^ *else/)) node.debug = false;
    if (noBlock) return node;
    let block;
    block = "indent" == this.peek().type;
    if (block) {
      if (tok.buffer) {
        this.error(
          "BLOCK_IN_BUFFERED_CODE",
          "Buffered code cannot have a block attached to it",
          this.peek()
        );
      }
      node.block = this.block();
    }
    return node;
  }
  parseConditional() {
    let tok = this.expect("if");
    var node = {
      type: "Conditional",
      test: tok.val,
      consequent: this.emptyBlock(tok.loc.start.line),
      alternate: null,
      line: tok.loc.start.line,
      column: tok.loc.start.column,
      filename: this.filename
    };
    if ("indent" == this.peek().type) {
      node.consequent = this.block();
    }
    var currentNode = node;
    while (true) {
      if (this.peek().type === "newline") {
        this.expect("newline");
      } else if (this.peek().type === "else-if") {
        tok = this.expect("else-if");
        currentNode = currentNode.alternate = {
          type: "Conditional",
          test: tok.val,
          consequent: this.emptyBlock(tok.loc.start.line),
          alternate: null,
          line: tok.loc.start.line,
          column: tok.loc.start.column,
          filename: this.filename
        };
        if ("indent" == this.peek().type) {
          currentNode.consequent = this.block();
        }
      } else if (this.peek().type === "else") {
        this.expect("else");
        if (this.peek().type === "indent") {
          currentNode.alternate = this.block();
        }
        break;
      } else {
        break;
      }
    }
    return node;
  }
  parseWhile() {
    var tok = this.expect("while");
    var node = {
      type: "While",
      test: tok.val,
      line: tok.loc.start.line,
      column: tok.loc.start.column,
      filename: this.filename
    };
    if ("indent" == this.peek().type) {
      node.block = this.block();
    } else {
      node.block = this.emptyBlock(tok.loc.start.line);
    }
    return node;
  }
  parseBlockCode() {
    let tok = this.expect("blockcode");
    var line = tok.loc.start.line;
    var column = tok.loc.start.column;
    var body = this.peek();
    var text = "";
    if (body.type === "start-pipeless-text") {
      this.advance();
      while (this.peek().type !== "end-pipeless-text") {
        tok = this.advance();
        switch (tok.type) {
          case "text":
            text += tok.val;
            break;
          case "newline":
            text += "\n";
            break;
          default:
            var pluginResult = this.runPlugin("blockCodeTokens", tok, tok);
            if (pluginResult) {
              text += pluginResult;
              break;
            }
            this.error(
              "INVALID_TOKEN",
              "Unexpected token type: " + tok.type,
              tok
            );
        }
      }
      this.advance();
    }
    return {
      type: "Code",
      val: text,
      buffer: false,
      mustEscape: false,
      isInline: false,
      line: line,
      column: column,
      filename: this.filename
    };
  }
  parseComment() {
    var tok = this.expect("comment");
    var block;
    if ((block = this.parseTextBlock())) {
      return {
        type: "BlockComment",
        val: tok.val,
        block: block,
        buffer: tok.buffer,
        line: tok.loc.start.line,
        column: tok.loc.start.column,
        filename: this.filename
      };
    } else {
      return {
        type: "Comment",
        val: tok.val,
        buffer: tok.buffer,
        line: tok.loc.start.line,
        column: tok.loc.start.column,
        filename: this.filename
      };
    }
  }
  parseDoctype() {
    var tok = this.expect("doctype");
    return {
      type: "Doctype",
      val: tok.val,
      line: tok.loc.start.line,
      column: tok.loc.start.column,
      filename: this.filename
    };
  }
  parseIncludeFilter() {
    var tok = this.expect("filter");
    var attrs = [];
    if (this.peek().type === "start-attributes") {
      attrs = this.attrs();
    }
    return {
      type: "IncludeFilter",
      name: tok.val,
      attrs: attrs,
      line: tok.loc.start.line,
      column: tok.loc.start.column,
      filename: this.filename
    };
  }
  parseFilter() {
    var tok = this.expect("filter");
    var block,
      attrs = [];
    if (this.peek().type === "start-attributes") {
      attrs = this.attrs();
    }
    if (this.peek().type === "text") {
      var textToken = this.advance();
      block = this.initBlock(textToken.loc.start.line, [
        {
          type: "Text",
          val: textToken.val,
          line: textToken.loc.start.line,
          column: textToken.loc.start.column,
          filename: this.filename
        }
      ]);
    } else if (this.peek().type === "filter") {
      block = this.initBlock(tok.loc.start.line, [this.parseFilter()]);
    } else {
      block = this.parseTextBlock() || this.emptyBlock(tok.loc.start.line);
    }
    return {
      type: "Filter",
      name: tok.val,
      block: block,
      attrs: attrs,
      line: tok.loc.start.line,
      column: tok.loc.start.column,
      filename: this.filename
    };
  }
  parseEach() {
    var tok = this.expect("each");
    const node = {
      type: "Each",
      obj: tok.code,
      val: tok.val,
      key: tok.key,
      block: this.block(),
      line: tok.loc.start.line,
      column: tok.loc.start.column,
      filename: this.filename
    };
    if (this.peek().type == "else") {
      this.advance();
      node.alternate = this.block();
    }
    return node;
  }
  parseMixinBlock() {
    var tok = this.expect("mixin-block");
    if (!this.inMixin) {
      this.error(
        "BLOCK_OUTISDE_MIXIN",
        "Anonymous blocks are not allowed unless they are part of a mixin.",
        tok
      );
    }
    return {
      type: "MixinBlock",
      line: tok.loc.start.line,
      column: tok.loc.start.column,
      filename: this.filename
    };
  }
  parseYield() {
    var tok = this.expect("yield");
    return {
      type: "YieldBlock",
      line: tok.loc.start.line,
      column: tok.loc.start.column,
      filename: this.filename
    };
  }
  parseInclude() {
    var tok = this.expect("include");
    const fileNode = {
      type: "FileReference",
      filename: this.filename
    };
    const node = {
      type: "Include",
      line: tok.loc.start.line,
      column: tok.loc.start.column,
      filename: this.filename
    };
    var path = this.expect("path");
    fileNode.path = path.val.trim();
    fileNode.line = path.loc.start.line;
    fileNode.column = path.loc.start.column;
    node.file = fileNode;
    node.block =
      "indent" == this.peek().type
        ? this.block()
        : this.emptyBlock(tok.loc.start.line);
    return node;
  }
  parseCall() {
    var tok = this.expect("call");
    var name = tok.val;
    var args = tok.args;
    var mixin = {
      type: "Mixin",
      name: name,
      args: args,
      block: this.emptyBlock(tok.loc.start.line),
      call: true,
      attrs: [],
      attributeBlocks: [],
      line: tok.loc.start.line,
      column: tok.loc.start.column,
      filename: this.filename
    };
    this.tag(mixin);
    if (mixin.code) {
      mixin.block.nodes.push(mixin.code);
      delete mixin.code;
    }
    if (mixin.block.nodes.length === 0) mixin.block = null;
    return mixin;
  }
  parseMixin() {
    var tok = this.expect("mixin");
    var name = tok.val;
    var args = tok.args;
    if ("indent" == this.peek().type) {
      this.inMixin++;
      const mixin = {
        type: "Mixin",
        name: name,
        args: args,
        block: this.block(),
        call: false,
        line: tok.loc.start.line,
        column: tok.loc.start.column,
        filename: this.filename
      };
      this.inMixin--;
      return mixin;
    } else {
      this.error(
        "MIXIN_WITHOUT_BODY",
        "Mixin " + name + " declared without body",
        tok
      );
    }
  }
  parseTextBlock() {
    var tok = this.accept("start-pipeless-text");
    if (!tok) return;
    var block = this.emptyBlock(tok.loc.start.line);
    while (this.peek().type !== "end-pipeless-text") {
      var tok = this.advance();
      switch (tok.type) {
        case "text":
          block.nodes.push({
            type: "Text",
            val: tok.val,
            line: tok.loc.start.line,
            column: tok.loc.start.column,
            filename: this.filename
          });
          break;
        case "newline":
          block.nodes.push({
            type: "Text",
            val: "\n",
            line: tok.loc.start.line,
            column: tok.loc.start.column,
            filename: this.filename
          });
          break;
        case "start-pug-interpolation":
          block.nodes.push(this.parseExpr());
          this.expect("end-pug-interpolation");
          break;
        case "interpolated-code":
          block.nodes.push({
            type: "Code",
            val: tok.val,
            buffer: tok.buffer,
            mustEscape: tok.mustEscape !== false,
            isInline: true,
            line: tok.loc.start.line,
            column: tok.loc.start.column,
            filename: this.filename
          });
          break;
        default:
          var pluginResult = this.runPlugin("textBlockTokens", tok, block, tok);
          if (pluginResult) break;
          this.error(
            "INVALID_TOKEN",
            "Unexpected token type: " + tok.type,
            tok
          );
      }
    }
    this.advance();
    return block;
  }
  block() {
    var tok = this.expect("indent");
    var block = this.emptyBlock(tok.loc.start.line);
    while ("outdent" != this.peek().type) {
      if ("newline" == this.peek().type) {
        this.advance();
      } else if ("text-html" == this.peek().type) {
        block.nodes = block.nodes.concat(this.parseTextHtml());
      } else {
        var expr = this.parseExpr();
        if (expr.type === "Block") {
          block.nodes = block.nodes.concat(expr.nodes);
        } else {
          block.nodes.push(expr);
        }
      }
    }
    this.expect("outdent");
    return block;
  }
  parseInterpolation() {
    var tok = this.advance();
    var tag = {
      type: "InterpolatedTag",
      expr: tok.val,
      selfClosing: false,
      block: this.emptyBlock(tok.loc.start.line),
      attrs: [],
      attributeBlocks: [],
      isInline: false,
      line: tok.loc.start.line,
      column: tok.loc.start.column,
      filename: this.filename
    };
    return this.tag(tag, { selfClosingAllowed: true });
  }
  parseTag() {
    var tok = this.advance();
    var tag = {
      type: "Tag",
      name: tok.val,
      selfClosing: false,
      block: this.emptyBlock(tok.loc.start.line),
      attrs: [],
      attributeBlocks: [],
      isInline: inlineTags.indexOf(tok.val) !== -1,
      line: tok.loc.start.line,
      column: tok.loc.start.column,
      filename: this.filename
    };
    return this.tag(tag, { selfClosingAllowed: true });
  }
  tag(tag, options) {
    var seenAttrs = false;
    var attributeNames = [];
    var selfClosingAllowed = options && options.selfClosingAllowed;
    out: while (true) {
      switch (this.peek().type) {
        case "id":
        case "class":
          const classOrIdTok = this.advance();
          if (classOrIdTok.type === "id") {
            if (attributeNames.indexOf("id") !== -1) {
              this.error(
                "DUPLICATE_ID",
                'Duplicate attribute "id" is not allowed.',
                classOrIdTok
              );
            }
            attributeNames.push("id");
          }
          tag.attrs.push({
            name: classOrIdTok.type,
            val: "'" + classOrIdTok.val + "'",
            line: classOrIdTok.loc.start.line,
            column: classOrIdTok.loc.start.column,
            filename: this.filename,
            mustEscape: false
          });
          continue;
        case "start-attributes":
          if (seenAttrs) {
            console.warn(
              this.filename +
                ", line " +
                this.peek().loc.start.line +
                ":\nYou should not have pug tags with multiple attributes."
            );
          }
          seenAttrs = true;
          tag.attrs = tag.attrs.concat(this.attrs(attributeNames));
          continue;
        default:
          var pluginResult = this.runPlugin(
            "tagAttributeTokens",
            this.peek(),
            tag,
            attributeNames
          );
          if (pluginResult) break;
          break out;
      }
    }
    if ("dot" == this.peek().type) {
      tag.textOnly = true;
      this.advance();
    }
    switch (this.peek().type) {
      case "text":
      case "interpolated-code":
        var text = this.parseText();
        if (text.type === "Block") {
          tag.block.nodes.push.apply(tag.block.nodes, text.nodes);
        } else {
          tag.block.nodes.push(text);
        }
        break;
      case "code":
        tag.block.nodes.push(this.parseCode(true));
        break;
      case ":":
        this.advance();
        var expr = this.parseExpr();
        tag.block =
          expr.type === "Block" ? expr : this.initBlock(tag.line, [expr]);
        break;
      case "newline":
      case "indent":
      case "outdent":
      case "eos":
      case "start-pipeless-text":
      case "end-pug-interpolation":
        break;
      case "slash":
        if (selfClosingAllowed) {
          this.advance();
          tag.selfClosing = true;
          break;
        }
      default:
        var pluginResult = this.runPlugin(
          "tagTokens",
          this.peek(),
          tag,
          options
        );
        if (pluginResult) break;
        this.error(
          "INVALID_TOKEN",
          "Unexpected token `" +
            this.peek().type +
            "` expected `text`, `interpolated-code`, `code`, `:`" +
            (selfClosingAllowed ? ", `slash`" : "") +
            ", `newline` or `eos`",
          this.peek()
        );
    }
    while ("newline" == this.peek().type) this.advance();
    if (tag.textOnly) {
      tag.block = this.parseTextBlock() || this.emptyBlock(tag.line);
    } else if ("indent" == this.peek().type) {
      var block = this.block();
      for (var i = 0, len = block.nodes.length; i < len; ++i) {
        tag.block.nodes.push(block.nodes[i]);
      }
    }
    return tag;
  }
  attrs(attributeNames) {
    this.expect("start-attributes");
    var attrs = [];
    var tok = this.advance();
    while (tok.type === "attribute") {
      if (tok.name !== "class" && attributeNames) {
        if (attributeNames.indexOf(tok.name) !== -1) {
          this.error(
            "DUPLICATE_ATTRIBUTE",
            'Duplicate attribute "' + tok.name + '" is not allowed.',
            tok
          );
        }
        attributeNames.push(tok.name);
      }
      attrs.push({
        name: tok.name,
        val: tok.val,
        line: tok.loc.start.line,
        column: tok.loc.start.column,
        filename: this.filename,
        mustEscape: tok.mustEscape !== false
      });
      tok = this.advance();
    }
    this.tokens.defer(tok);
    this.expect("end-attributes");
    return attrs;
  }
}

function walkAST(ast, before, after) {
  var replace = function replace(replacement) {
    if (Array.isArray(replacement) && !replace.arrayAllowed) {
      throw new Error(
        "replace() can only be called with an array if the last parent is a Block or NamedBlock"
      );
    }
    ast = replacement;
  };
  replace.arrayAllowed = false;
  if (before) {
    var result = before(ast, replace);
    if (result === false) {
      return ast;
    } else if (Array.isArray(ast)) {
      return walkAndMergeNodes(ast);
    }
  }
  switch (ast.type) {
    case "NamedBlock":
    case "Block":
      ast.nodes = walkAndMergeNodes(ast.nodes);
      break;
    case "Case":
    case "Mixin":
    case "Tag":
    case "InterpolatedTag":
    case "When":
    case "Code":
    case "While":
      if (ast.block) {
        ast.block = walkAST(ast.block, before, after);
      }
      break;
    case "Each":
      if (ast.block) {
        ast.block = walkAST(ast.block, before, after);
      }
      if (ast.alternate) {
        ast.alternate = walkAST(ast.alternate, before, after);
      }
      break;
    case "Conditional":
      if (ast.consequent) {
        ast.consequent = walkAST(ast.consequent, before, after);
      }
      if (ast.alternate) {
        ast.alternate = walkAST(ast.alternate, before, after);
      }
      break;
    case "Include":
      walkAST(ast.block, before, after);
      walkAST(ast.file, before, after);
      break;
    case "BlockComment":
    case "Comment":
    case "MixinBlock":
    case "Text":
      break;
    case "FileReference":
      break;
    default:
      throw new Error("Unexpected node type " + ast.type);
  }
  after && after(ast, replace);
  return ast;
  function walkAndMergeNodes(nodes) {
    return nodes.reduce(function (nodes, node) {
      var result = walkAST(node, before, after);
      if (Array.isArray(result)) {
        return nodes.concat(result);
      } else {
        return nodes.concat([result]);
      }
    }, []);
  }
}

function loadAst(ast, options) {
  ast = JSON.parse(JSON.stringify(ast));
  return walkAST(ast, function (node) {
    if (node.str === undefined) {
      if (
        node.type === "Include" ||
        node.type === "RawInclude" ||
        node.type === "Extends"
      ) {
        var file = node.file;
        if (file.type !== "FileReference") {
          throw new Error('Expected file.type to be "FileReference"');
        }
        let path;
        let raw;
        let str;
        try {
          path = resolve(file.path, file.filename);
          file.fullPath = path;
          raw = fileSystem.readFileSync(path);
          str = raw.toString("utf8");
          file.str = str;
          file.raw = raw;
        } catch (ex) {
          ex.message += "\n    at " + node.filename + " line " + node.line;
          throw ex;
        }
        if (node.type === "Include") {
          file.ast = loadTemplate(str, path);
        }
      }
    }
  });
}
function loadTemplate(src, filename) {
  const opts = { filename };
  const tokens = lex(src, opts);
  const ast = parse(tokens, opts);
  return loadAst(ast);
}
function resolve(filename, source) {
  filename = filename.trim();
  if (filename[0] !== "/" && !source)
    throw new Error(
      'the "filename" option is required to use includes and extends with "relative" paths'
    );
  filename = join(dirname(source.trim()), filename);
  return filename;
}

function cleanAttributeValues(str, params) {
  let result = "";
  if (params.isStyle) {
    const strRegex = /([a-zA-Z0-9:;\s\-\.]+)/;
    const objRegex = /(\{.*?\})/;
    const objMatch = str.match(objRegex);
    const strMatch = str.match(strRegex);
    if (!isNull(objMatch)) {
      try {
        const obj = JSON.parse(objMatch[1]);
        Object.entries(obj).forEach(([key, val], index) => {
          result += `${key}: ${val};`;
        });
      } catch (err) {
        result = "";
      }
    } else {
      const match = strMatch;
      result = !isNull(match) ? match[1] : "";
    }
  } else if (!params.isInterpolate) {
    const regex = /([a-zA-Z-_]+)/;
    const match = str.match(regex);
    result = !isNull(match) ? match[1] : "";
  } else {
    const regex = /([a-z\.A-Z-_]+)/;
    const match = str.match(regex);
    result = !isNull(match) ? match[1] : "";
  }
  return result;
}

function transformClassArray(vals) {
  let value = "";
  for (let i = 0; i < vals.length; i += 1) {
    if (i < vals.length - 1) {
      value += `${vals[i]} `;
    } else {
      value += vals[i];
    }
  }
  return value;
}

class Writer {
  constructor(indent) {
    this.buffer = [];
    this.indent = 1;
    if (indent) {
      this.indent = indent;
    }
  }
  addLine(str) {
    if (this.indent === -1) {
      console.log(str);
    }
    this.buffer.push(`${Array(this.indent).join("  ")}${str}\r\n`);
  }
  add(str) {
    this.buffer.push(str);
  }
  write() {
    return this.buffer.join("");
  }
  getCurrentIndex() {
    return this.buffer.length - 1;
  }
  addLineAtIndex(str, index) {
    const inserted = `${Array(this.indent).join("  ")}${str}\r\n`;
    this.buffer.splice(index, 0, inserted);
  }
}

class BaseCompiler {
  constructor(ast) {
    this.indent = 1;
    this.nodeId = 0;
    this.parentTagId = 0;
    this.buffer = [];
    this.ast = ast;
    this.body = new Writer();
  }
  uid() {
    this.nodeId++;
    return this.nodeId;
  }
  compile() {
    return [this.body.write()].join("\n\n");
  }
  compileAttrs(attributes, attributeBlocks) {
    const propsObj = {};
    let attrsObj = {};
    if (!attributeBlocks.length) {
      attrsObj = attributes.reduce((finalObj, attr) => {
        const isInterpolate = isNull(
          attr.val.match(/^(['"]{1})(.*)(['"]{1})$/)
        );
        const val = cleanAttributeValues(attr.val, {
          isStyle: "style" === attr.name,
          isInterpolate
        });
        if (finalObj[attr.name]) {
          finalObj[attr.name]["val"].concat(val);
        } else {
          finalObj[attr.name] = {
            val: [val],
            interpolate: isInterpolate
          };
        }
        return finalObj;
      }, {});
    } else {
      attrsObj = attributeBlocks.reduce(
        function (finalObj, currObj) {
          for (var propName in currObj) {
            finalObj[propName] = finalObj[propName]
              ? finalObj[propName].concat(currObj[propName])
              : [currObj[propName]];
          }
          return finalObj;
        },
        attributes.reduce(function (finalObj, attr) {
          var val = attr.val;
          finalObj[attr.name] = finalObj[attr.name]
            ? finalObj[attr.name].concat(val)
            : [val];
          return finalObj;
        }, {})
      );
    }
    for (var propName in attrsObj) {
      if ("class" !== propName) {
        attrsObj[propName]["val"] = attrsObj[propName]["val"].pop();
        if ("id" === propName) {
          propsObj.key = attrsObj[propName].val;
        }
      }
    }
    propsObj.attrs = attrsObj;
    return propsObj;
  }
  visit(node) {
    if (!this[`visit${node.type}`]) {
      throw new Error(`Node not handled: ${node.type}`);
    }
    this[`visit${node.type}`](node);
  }
  visitTag(node) {
    const props = this.compileAttrs(node.attrs, node.attributeBlocks);
    const isFirstNode = this.nodeId === 0;
    const id = this.uid();
    this.body.addLine("");
    this.body.addLine(`const n${id}Child: VNodeChildren = [];`);
    const s = this.parentTagId;
    this.parentTagId = id;
    if (!isNull(node.block)) {
      this.visitBlock(node.block);
    }
    this.body.addLine(`const props${id}: VNodeData = {}`);
    const selectors = [];
    for (const propKey in props) {
      const prop = props[propKey];
      if ("key" === propKey) {
        this.body.addLine(`props${id}.key = "${prop}";`);
      } else if ("attrs" === propKey) {
        if (!isEmpty(prop)) {
          Object.keys(prop).forEach((attr, index) => {
            const value = prop[attr]["val"];
            if (0 === index) {
              this.body.addLine(`props${id}.attrs = {};`);
            }
            switch (attr) {
              case "class":
                if (!prop[attr].interpolate) {
                  this.body.addLine(
                    `props${id}.attrs.class = "${transformClassArray(value)}";`
                  );
                  value.forEach((className) => {
                    selectors.push({
                      selector: ".",
                      value: className,
                      total: `.${className}`
                    });
                  });
                } else {
                  this.body.addLine(`props${id}.attrs.class = ${value};`);
                  selectors.push({
                    selector: ".",
                    value,
                    total: null
                  });
                }
                break;
              case "id":
                if (!prop[attr].interpolate) {
                  this.body.addLine(`props${id}.attrs.id = "${value}";`);
                  selectors.push({ selector: "#", value, total: `#${value}` });
                } else {
                  this.body.addLine(`props${id}.attrs.id = ${value};`);
                  selectors.push({ selector: "#", value, total: null });
                }
                break;
              default:
                if (!prop[attr].interpolate) {
                  this.body.addLine(
                    `props${id}.attrs["${attr}"] = "${value}";`
                  );
                  if (/^data-[a-zA-Z]+$/.test(attr)) {
                    selectors.push({
                      selector: attr,
                      value,
                      total: `[${attr}]`
                    });
                  }
                } else {
                  this.body.addLine(`props${id}.attrs["${attr}"] = ${value};`);
                  if (/^data-[a-zA-Z]+$/.test(attr)) {
                    selectors.push({ selector: attr, value, total: null });
                  }
                }
            }
          });
        }
      }
    }
    if (selectors.length) {
      this.body.addLine(`props${id}.on = {}`);
      this.body.addLine(`props${id}.hook = {}`);
      selectors.forEach((selector, i) => {
        if (!isNull(selector.total)) {
          this.body.addLine(
            `const uiEventBinding_${id}_${i} = "${selector.total}";`
          );
        } else {
          this.body.addLine(
            `const uiEventBinding_${id}_${i} = ${selector.value};`
          );
        }
        this.body.addLine(
          `if (Object.keys(uiEventsBindings).includes(uiEventBinding_${id}_${i})) {`
        );
        this.body.indent++;
        this.body.addLine(
          `uiEventsBindings["${selector.total}"].forEach((eventBinding) => {`
        );
        this.body.indent++;
        this.body.addLine(
          `(props${id}.on as VNodeOn)[eventBinding.event] = eventBinding.callback;`
        );
        this.body.indent--;
        this.body.addLine("});");
        this.body.indent--;
        this.body.addLine("}");
        this.body.addLine("if (!_.isNull(regions)) {");
        this.body.indent++;
        this.body.addLine(
          "Object.values(regions as any).forEach((regionElement: any) => {"
        );
        this.body.indent++;
        this.body.addLine(
          `if (regionElement.selector === "${selector.selector}" && regionElement.value === "${selector.value}" ) {`
        );
        this.body.indent++;
        this.body.addLine(
          `(props${id}.hook as Hooks).insert = regionElement.insertCallback;`
        );
        this.body.addLine(
          `(props${id}.hook as Hooks).remove = regionElement.removeCallback;`
        );
        this.body.indent--;
        this.body.addLine("}");
        this.body.indent--;
        this.body.addLine("});");
        this.body.indent--;
        this.body.addLine("}");
      });
    }
    if (isFirstNode) {
      this.body.addLine(
        `return VDom.h(${
          node.name ? `'${node.name}'` : `${node.expr}`
        }, props${id}, n${id}Child);`
      );
    } else {
      this.body.addLine(
        `var n${id} = VDom.h(${
          node.name ? `'${node.name}'` : `${node.expr}`
        }, props${id}, n${id}Child);`
      );
      this.parentTagId = s;
      this.body.addLine(`n${s}Child.push(n${id});`);
    }
  }
  visitBlock(node) {
    node.nodes.forEach((childNode) => {
      this.visit(childNode);
    });
  }
  visitInterpolatedTag(node) {
    this.visitTag(node);
  }
  visitText(node) {
    const val = node.val;
    const s = JSON.stringify(val);
    if (val[0] === "<") {
      this.body.addLine(
        `n${this.parentTagId}Child.push(VDom.makeHtmlNode(${s}))`
      );
    } else {
      this.body.addLine(`n${this.parentTagId}Child.push(VDom.text(${s}))`);
    }
  }
  visitCode(node) {
    if (node.buffer) {
      this.body.addLine(
        `n${this.parentTagId}Child.push(${
          node.mustEscape
            ? `VDom.text(${node.val})`
            : `VDom.makeHtmlNode(${node.val})`
        })`
      );
    } else {
      this.body.addLine(node.val + "");
    }
    if (node.block) {
      this.body.addLine("{");
      this.body.indent++;
      this.visitBlock(node.block);
      this.body.indent--;
      this.body.addLine("}");
    }
  }
  visitConditional(node) {
    this.body.addLine(`if (${node.test}) {`);
    this.body.indent++;
    this.visitBlock(node.consequent);
    this.body.indent--;
    if (node.alternate) {
      this.body.addLine(`} else {`);
      this.body.indent++;
      this.visit(node.alternate);
      this.body.indent--;
    }
    this.body.addLine(`}`);
  }
  visitComment(node) {}
  visitBlockComment(node) {}
  visitWhile(node) {
    this.body.addLine(`while (${node.test}){`);
    this.body.indent++;
    this.visitBlock(node.block);
    this.body.indent--;
    this.body.addLine(`}`);
  }
  visitEach(node) {
    const tempVar = `v${this.uid()}`;
    const key = node.key || `k${this.uid()}`;
    this.body.addLine(`var ${tempVar} = ${node.obj}`);
    this.body.addLine(`Object.keys(${tempVar}).forEach((${key}) => {`);
    this.body.indent++;
    this.body.addLine(`const ${node.val} = ${tempVar}[${key}]`);
    this.visitBlock(node.block);
    this.body.indent--;
    this.body.addLine(`})`);
  }
  visitExtends(node) {
    throw new Error(
      "Extends nodes need to be resolved with pug-load and pug-linker"
    );
  }
}

class MixinCompiler extends BaseCompiler {
  constructor(node, name, indent) {
    super(node);
    this.nodeId = 0;
    this.parentTagId = 0;
    this.name = name;
    this.body = new Writer(indent);
  }
}

class TemplateCompiler extends BaseCompiler {
  constructor(ast, options) {
    super(ast);
    this.indent = 1;
    this.nodeId = 0;
    this.parentTagId = 0;
    this.buffer = [];
    this.mixinCompilers = [];
    this.options = options;
    this.dataStructure = new Writer();
    this.imports = new Writer();
    this.moduleName = options.moduleName;
    const viewName = `${this.moduleName}View`;
    const dataStructure = `${viewName}Datastructure`;
    this.variablesNames = {
      view: viewName,
      dataStructure,
      typedDataStructure: `T${camelcase(dataStructure, { pascalCase: true })}`,
      typedDataTemplate: `T${viewName}TemplateData`,
      templateFunctionConst: `${camelcase(viewName)}Template`,
      templateFunction: `${camelcase(viewName)}TemplateFn`
    };
  }
  compile() {
    this.bootstrap();
    return [
      this.imports.write(),
      this.body.write(),
      this.dataStructure.write()
    ].join("\n\n");
  }
  bootstrap() {
    this.imports.addLine("/**");
    this.imports.indent++;
    this.imports.addLine("* DO NOT EDIT THIS FILE DIRECTLY");
    this.imports.addLine(
      "* This file has been generated by the tool @bonsai/pug-ts"
    );
    this.imports.addLine(
      `* Edit the file ${this.moduleName}.view.template.pug that will generate the ${this.variablesNames.view}.template.ts file automatically`
    );
    this.imports.indent--;
    this.imports.addLine("*/");
    this.imports.addLine(
      `import { VDom, _, DataTypes, TTemplateFunction, TDataTypesFromStructure, TEntityJsonData, VNode, VNodeChildren, VNodeData, VNodeOn, Hooks } from "bonsai";`
    );
    this.imports.addLine("");
    this.imports.addLine(
      `import { ${this.variablesNames.view} } from "./${this.moduleName}.view";`
    );
    this.body.addLine(
      `export const ${this.variablesNames.templateFunctionConst}: TTemplateFunction<${this.variablesNames.view}> = function ${this.variablesNames.templateFunction}(`
    );
    this.body.indent++;
    this.body.addLine(`view: ${this.variablesNames.view},`);
    this.body.addLine(`data: ${this.variablesNames.typedDataTemplate},`);
    this.body.indent--;
    this.body.addLine(") {");
    this.body.indent++;
    this.body.addLine("if (!VDom) {");
    this.body.indent++;
    this.body.addLine(`throw "VDom not found.";`);
    this.body.indent--;
    this.body.addLine("}");
    this.body.addLine("const elementSelector = view.elementSelector;");
    this.body.addLine("const uiEventsBindings = view.uiEventBindings;");
    this.body.addLine("const regions = view.regionElements || null;");
    this.body.indent--;
    this.visit(this.ast);
    if (this.mixinCompilers.length > 0) {
      const mixinCodes = [];
      this.mixinCompilers.forEach((mixinCompiler) => {
        mixinCodes.push(mixinCompiler.compile());
      });
      this.body.addLineAtIndex(
        mixinCodes.join("\n"),
        this.beforeBodyReturnIndex
      );
    }
    this.body.addLine("}");
    this.body.addLine("");
  }
  compileCompositeDataTag() {}
  visitData(node) {
    const _dataBlock = node.block;
    const _dataNodes = _dataBlock.nodes;
    if (_dataNodes.length) {
      this.dataStructure.addLine(
        `const ${this.variablesNames.dataStructure} = {`
      );
      this.dataStructure.indent++;
      _dataNodes.forEach((_dataNode, i) => {
        const prop = _dataNode.name;
        const _dataNode_nodes = _dataNode.block.nodes;
        if (
          _dataNode_nodes.length === 1 &&
          _dataNode_nodes[0].type === "Text"
        ) {
          const content =
            i < _dataNodes.length
              ? `${prop}: DataTypes.${_dataNode_nodes[0].val}(),`
              : `${prop}: DataTypes.${_dataNode_nodes[0].val}()`;
          this.dataStructure.addLine(content);
        } else if (
          _dataNode_nodes[0].type === "Text" &&
          _dataNode_nodes[1] &&
          _dataNode_nodes[1].type === "Tag" &&
          _dataNode_nodes[1].block &&
          _dataNode_nodes[1].block.nodes &&
          _dataNode_nodes[1].block.nodes[0].type === "Text"
        ) {
          this.dataStructure.addLine(
            `${prop}: DataTypes.${_dataNode_nodes[0].val}({`
          );
          this.dataStructure.indent++;
          this.dataStructure.addLine(
            `${_dataNode_nodes[1].name}: DataTypes.${_dataNode_nodes[1].block.nodes[0].val}()`
          );
          this.dataStructure.indent--;
          this.dataStructure.addLine("})");
          let value = `DataTypes.${_dataNode_nodes[0].val}({ ${_dataNode_nodes[1].name}: `;
          const _subDataBlock = _dataNode_nodes[1].block;
          const _subDataNodes = _subDataBlock.nodes;
          if (_subDataNodes.length && _subDataNodes[0].type === "Text") {
            value += `DataTypes.${_subDataNodes[0].val} })`;
          } else {
            value = false;
          }
        }
      });
      this.dataStructure.indent--;
      this.dataStructure.addLine("};");
      this.dataStructure.addLine("");
      this.dataStructure.addLine(
        `export type ${this.variablesNames.typedDataStructure} = TDataTypesFromStructure<typeof ${this.variablesNames.dataStructure}>;`
      );
      this.dataStructure.addLine("");
      this.dataStructure.addLine(
        `type ${this.variablesNames.typedDataTemplate} = Required<TEntityJsonData<${this.variablesNames.typedDataStructure}>>`
      );
    }
  }
  visit(node) {
    if (node.type === "Tag" && node.name === "_data") {
      this.visitData(node);
    } else {
      if (!this[`visit${node.type}`]) {
        throw new Error(`Node not handled: ${node.type}`);
      }
      this[`visit${node.type}`](node);
    }
  }
  visitInclude(node) {
    const block = node.file.ast;
    this.visitBlock(block);
  }
  visitTag(node) {
    const props = this.compileAttrs(node.attrs, node.attributeBlocks);
    const isFirstNode = this.nodeId === 0;
    if (isFirstNode) {
      const isRootTagName = `("${node.name}" !== elementSelector.tagName)`;
      const idAttribute = props.attrs.id ? `"${props.attrs.id}"` : "undefined";
      const classAttributes = props.attrs.class
        ? JSON.stringify(props.attrs.class)
        : `(<any[]>[undefined])`;
      this.body.addLine("if (");
      this.body.indent++;
      this.body.addLine(`${isRootTagName} ||`);
      this.body.addLine(
        `("id" === elementSelector.attr && ${idAttribute} !== elementSelector.value) ||`
      );
      this.body.addLine(
        `("class" === elementSelector.attr) && !${classAttributes}.includes(elementSelector.value)`
      );
      this.body.indent--;
      this.body.addLine(") {");
      this.body.indent++;
      this.body.addLine(
        `throw "Invalid root element in ${this.variablesNames.templateFunction} function";`
      );
      this.body.indent--;
      this.body.addLine("}");
    }
    const id = this.uid();
    this.body.addLine("");
    this.body.addLine(`const n${id}Child: VNodeChildren = [];`);
    const s = this.parentTagId;
    this.parentTagId = id;
    if (!isNull(node.block)) {
      this.visitBlock(node.block);
    }
    this.body.addLine(`const props${id}: VNodeData = {}`);
    const selectors = [];
    for (const propKey in props) {
      const prop = props[propKey];
      if ("key" === propKey) {
        this.body.addLine(`props${id}.key = "${prop}";`);
      } else if ("attrs" === propKey) {
        if (!isEmpty(prop)) {
          Object.keys(prop).forEach((attr, index) => {
            const value = prop[attr]["val"];
            if (0 === index) {
              this.body.addLine(`props${id}.attrs = {};`);
            }
            switch (attr) {
              case "class":
                if (!prop[attr].interpolate) {
                  this.body.addLine(
                    `props${id}.attrs.class = "${transformClassArray(value)}";`
                  );
                  value.forEach((className) => {
                    selectors.push({
                      selector: ".",
                      value: className,
                      total: `.${className}`
                    });
                  });
                } else {
                  this.body.addLine(`props${id}.attrs.class = ${value};`);
                  selectors.push({
                    selector: ".",
                    value,
                    total: null
                  });
                }
                break;
              case "id":
                if (!prop[attr].interpolate) {
                  this.body.addLine(`props${id}.attrs.id = "${value}";`);
                  selectors.push({ selector: "#", value, total: `#${value}` });
                } else {
                  this.body.addLine(`props${id}.attrs.id = ${value};`);
                  selectors.push({ selector: "#", value, total: null });
                }
                break;
              default:
                if (!prop[attr].interpolate) {
                  this.body.addLine(
                    `props${id}.attrs["${attr}"] = "${value}";`
                  );
                  if (/^data-[a-zA-Z]+$/.test(attr)) {
                    selectors.push({
                      selector: attr,
                      value,
                      total: `[${attr}]`
                    });
                  }
                } else {
                  this.body.addLine(`props${id}.attrs["${attr}"] = ${value};`);
                  if (/^data-[a-zA-Z]+$/.test(attr)) {
                    selectors.push({ selector: attr, value, total: null });
                  }
                }
            }
          });
        }
      }
    }
    if (selectors.length) {
      this.body.addLine(`props${id}.on = {}`);
      this.body.addLine(`props${id}.hook = {}`);
      selectors.forEach((selector, i) => {
        if (!isNull(selector.total)) {
          this.body.addLine(
            `const uiEventBinding_${id}_${i} = "${selector.total}";`
          );
        } else {
          this.body.addLine(
            `const uiEventBinding_${id}_${i} = ${selector.value};`
          );
        }
        this.body.addLine(
          `if (Object.keys(uiEventsBindings).includes(uiEventBinding_${id}_${i})) {`
        );
        this.body.indent++;
        this.body.addLine(
          `uiEventsBindings["${selector.total}"].forEach((eventBinding) => {`
        );
        this.body.indent++;
        this.body.addLine(
          `(props${id}.on as VNodeOn)[eventBinding.event] = eventBinding.callback;`
        );
        this.body.indent--;
        this.body.addLine("});");
        this.body.indent--;
        this.body.addLine("}");
        this.body.addLine("if (!_.isNull(regions)) {");
        this.body.indent++;
        this.body.addLine(
          "Object.values(regions as any).forEach((regionElement: any) => {"
        );
        this.body.indent++;
        this.body.addLine(
          `if (regionElement.selector === "${selector.selector}" && regionElement.value === "${selector.value}" ) {`
        );
        this.body.indent++;
        this.body.addLine(
          `(props${id}.hook as Hooks).insert = regionElement.insertCallback;`
        );
        this.body.addLine(
          `(props${id}.hook as Hooks).remove = regionElement.removeCallback;`
        );
        this.body.indent--;
        this.body.addLine("}");
        this.body.indent--;
        this.body.addLine("});");
        this.body.indent--;
        this.body.addLine("}");
      });
    }
    if (isFirstNode) {
      this.body.addLine(
        `return VDom.h(${
          node.name ? `'${node.name}'` : `${node.expr}`
        }, props${id}, n${id}Child);`
      );
      this.beforeBodyReturnIndex = this.body.getCurrentIndex();
    } else {
      this.body.addLine(
        `var n${id} = VDom.h(${
          node.name ? `'${node.name}'` : `${node.expr}`
        }, props${id}, n${id}Child);`
      );
      this.parentTagId = s;
      this.body.addLine(`n${s}Child.push(n${id});`);
    }
  }
  visitMixin(node) {
    const mixinName = node.name;
    var s = this.parentTagId;
    if (node.call) {
      if (node.block) {
        const id = this.uid();
        this.parentTagId = id;
        this.body.indent++;
        this.body.addLine(`const n${id}Child = []`);
        this.visitBlock(node.block);
        var args = node.args ? `${node.args}, n${id}Child` : `n${id}Child`;
        this.body.addLine(`n${s}Child.push(${node.name}(${args}));`);
        this.body.indent--;
        this.parentTagId = s;
      } else {
        this.body.addLine(`n${s}Child.push(${node.name}(${node.args})[0]);`);
      }
      return;
    } else {
      let mixinCompiler = this.mixinCompilers.find((mixin) => {
        return mixinName === mixin.name;
      });
      if (mixinCompiler === undefined) {
        this.mixinCompilers.push(
          new MixinCompiler(node.block, mixinName, this.body.indent)
        );
        mixinCompiler = this.mixinCompilers.find((mixin) => {
          return mixinName === mixin.name;
        });
      }
      const id = mixinCompiler.uid();
      mixinCompiler.parentTagId = id;
      const nodeArgs = node.args;
      let defNodeArgs = "";
      if (!isNull(nodeArgs)) {
        nodeArgs.split(",").forEach((nodeArg, index) => {
          if (index > 0) {
            defNodeArgs += ", ";
          }
          defNodeArgs += `${nodeArg}: any`;
        });
      }
      var args = node.args ? `${defNodeArgs}, __block?: any` : `__block?: any`;
      mixinCompiler.body.addLine(`function ${node.name}(${args}) {`);
      mixinCompiler.body.indent++;
      mixinCompiler.body.addLine(`const n${id}Child: VNodeChildren = []`);
      if (node.block) {
        mixinCompiler.visitBlock(node.block);
      }
      mixinCompiler.body.addLine(`return n${id}Child`);
      mixinCompiler.body.indent--;
      mixinCompiler.parentTagId = s;
      mixinCompiler.body.addLine(`}`);
    }
  }
  visitMixinBlock(node) {
    this.body.addLine(`n${this.parentTagId}Child.push(__block);`);
  }
  visitCase(node) {
    this.body.addLine(`switch(${node.expr}) {`);
    node.block.nodes.forEach((_case, index) => {
      this.body.indent++;
      this.visit(_case);
      this.body.indent--;
    });
    this.body.addLine(`}`);
  }
  visitWhen(node) {
    if (node.expr === "default") {
      this.body.addLine(`default:`);
    } else {
      this.body.addLine(`case ${node.expr}:`);
    }
    this.body.indent++;
    if (node.block) {
      this.visit(node.block);
    }
    this.body.addLine(`break;`);
    this.body.indent--;
  }
}

async function generateTSCodeFromPug(filePath) {
  try {
    const fileDir = dirname(filePath);
    const moduleName = basename(fileDir);
    console.log(`fileDir: ${fileDir} and moduleName: ${moduleName}`);
    const fileContent = await fileSystem.readFile(filePath, {
      encoding: "utf-8"
    });
    const ast = loadTemplate(fileContent, filePath);
    await fileSystem.writeJSON("ast.json", ast);
    const tsCode = new TemplateCompiler(ast, { moduleName }).compile();
    const newFile = join(
      fileDir,
      `${camelcase(moduleName + "View", { pascalCase: true })}.template.ts`
    );
    await fileSystem.writeFile(
      newFile,
      format(tsCode, { parser: "typescript", trailingComma: "none" }),
      {
        encoding: "utf-8"
      }
    );
    return newFile;
  } catch (err) {
    console.error("error in pug-to-ts-template");
    console.error(err);
    return false;
  }
}

export { generateTSCodeFromPug };
