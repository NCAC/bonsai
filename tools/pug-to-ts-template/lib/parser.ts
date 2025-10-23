"use strict";

import assert from "assert";
import { TokenStream } from "./token-stream.js";
import error from "pug-error";
// var inlineTags = require("./lib/inline-tags");

import {
  TPugBlockCommentNode,
  TPugBlockNode,
  TPugCommentNode,
  TPugTextNode,
  TPugAnyNode,
  TPugWhenNode,
  TPugWhenBlock,
  TPugCodeNode,
  TPugConditionalNode,
  TPugWhileNode,
  TPugTagNode,
  TPugInterpolatedTagNode,
  TPugMixinNode,
  TPugNamedBlockNode,
  TPugAttribute,
  TPugEachNode,
  TPugCaseNode,
  TPugDocContext,
  TPugIncludeNode,
  TPugFileReferenceNode
} from "./pug.types";
import {
  Token,
  LexToken,
  LexTokenType,
  InterpolatedCodeToken,
  TagToken,
  MixinToken,
  CallToken,
  ClassToken,
  IdToken,
  CodeToken,
  TextToken,
  NewlineToken,
  TextHtmlToken,
  CaseToken,
  PathToken,
  IfToken,
  ElseIfToken
} from "./lexer.types";
import { BlockcodeToken } from "pug-lexer";

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
] as const;

type TInlineTag = (typeof inlineTags)[number];

export function parse(tokens: Token[], options) {
  var parser = new Parser(tokens, options);
  var ast = parser.startParsing();
  return JSON.parse(JSON.stringify(ast));
}

/**
 * Initialize `Parser` with the given input `str` and `filename`.
 *
 * @param {String} str
 * @param {String} filename
 * @param {Object} options
 * @api public
 */

class Parser {
  private tokens: TokenStream;
  filename?: string;
  src?: string;
  inMixin: number;
  plugins: any[];

  constructor(tokens: Token[], options) {
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

  /**
   * Parse input returning a ast.
   * First entry
   */

  startParsing(): TPugBlockNode {
    var block = this.emptyBlock(0);

    while ("eos" != this.peek().type) {
      if ("newline" == this.peek().type) {
        this.advance();
      } else if ("text-html" == this.peek().type) {
        block.nodes = block.nodes.concat(
          this.parseTextHtml() as unknown as TPugAnyNode
        );
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

  error(code: string, message: string, token: Token) {
    var err = error(code, message, {
      line: token.loc.start.line,
      column: token.loc.start.column,
      filename: this.filename,
      src: this.src
    });
    throw err;
  }

  /**
   * Return the next token object.
   */
  advance(): Token {
    return this.tokens.advance();
  }

  /**
   * Single token lookahead.
   * Returns the first token
   */
  peek(): Token {
    return this.tokens.peek();
  }

  /**
   * `n` token lookahead.
   *
   * @param {Number} n
   * @return {Object}
   * @api private
   */

  lookahead(n: number): Token {
    return this.tokens.lookahead(n);
  }

  /**
   * Expect the given type
   * * if ok, returns the next token
   * * if not, returns the first token.
   */

  expect<Type extends LexTokenType>(type: Type): LexToken<Type> | undefined {
    if (this.peek().type === type) {
      return this.advance() as LexToken<Type>;
    } else {
      this.error(
        "INVALID_TOKEN",
        'expected "' + type + '", but got "' + this.peek().type + '"',
        this.peek()
      );
    }
  }

  /**
   * Accept the given `type` and returns the next tokens
   */

  accept<Type extends LexTokenType>(type: Type) {
    if (this.peek().type === type) {
      return this.advance();
    }
  }

  initBlock(line: number, nodes: any[]): TPugBlockNode {
    /* istanbul ignore if */
    if ((line | 0) !== line) throw new Error("`line` is not an integer");
    /* istanbul ignore if */
    if (!Array.isArray(nodes)) throw new Error("`nodes` is not an array");
    return {
      type: "Block",
      nodes: nodes,
      line: line,
      filename: this.filename
    };
  }

  emptyBlock(line: number) {
    return this.initBlock(line, []);
  }

  runPlugin(context, tok, ...args: any[]) {
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

  /**
   *   tag
   * | doctype
   * | mixin
   * | include
   * | filter
   * | comment
   * | text
   * | text-html
   * | dot
   * | each
   * | code
   * | yield
   * | id
   * | class
   * | interpolation
   */

  parseExpr() {
    switch (this.peek().type) {
      case "tag":
        return this.parseTag();
      case "mixin":
        return this.parseMixin();
      // case "block":
      //   return this.parseBlock();
      case "mixin-block":
        return this.parseMixinBlock();
      case "case":
        return this.parseCase();
      // case "extends":
      //   return this.parseExtends();
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
      // case "eachOf":
      //   return this.parseEachOf();
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
          // filename: this.filename
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

  /**
   * Text
   */

  parseText(options?: any) {
    var tags = [];
    var lineno = this.peek().loc.start.line;
    var nextTok = this.peek();
    loop: while (true) {
      switch (nextTok.type) {
        case "text":
          const textTok = this.advance() as TextToken;
          tags.push({
            type: "Text",
            val: textTok.val,
            line: textTok.loc.start.line,
            column: textTok.loc.start.column,
            filename: this.filename
          });
          break;
        case "interpolated-code":
          const interpolatedCodeTok = this.advance() as InterpolatedCodeToken;
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
          const newLineTok = this.advance() as NewlineToken;
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
    const nodes: (TPugTextNode | TPugDocContext)[] = [];
    var currentNode = null;
    loop: while (true) {
      switch (this.peek().type) {
        case "text-html":
          var text = this.advance() as TextHtmlToken;
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
          (block.nodes as TPugTextNode[]).forEach(function (node) {
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

  /**
   *   ':' expr
   * | block
   */

  parseBlockExpansion() {
    var tok = this.accept<":">(":");
    if (tok) {
      var expr = this.parseExpr();
      return expr.type === "Block"
        ? expr
        : this.initBlock(tok.loc.start.line, [expr]);
    } else {
      return this.block();
    }
  }

  /**
   * case
   */

  parseCase() {
    var tok = this.expect("case") as CaseToken;
    var node: Partial<TPugCaseNode> = {
      type: "Case",
      expr: tok.val,
      line: tok.loc.start.line,
      column: tok.loc.start.column,
      filename: this.filename
    };

    var block = this.emptyBlock(
      tok.loc.start.line + 1
    ) as unknown as TPugWhenBlock;
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

  /**
   * when
   */

  parseWhen(): TPugWhenNode {
    var tok = this.expect<"when">("when");
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

  /**
   * default
   */

  parseDefault(): TPugWhenNode {
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

  /**
   * code
   */

  parseCode(noBlock: boolean = false) {
    var tok = this.expect("code") as CodeToken;
    assert(
      typeof tok.mustEscape === "boolean",
      "Please update to the newest version of pug-lexer."
    );
    var node: TPugCodeNode = {
      type: "Code",
      val: tok.val,
      buffer: tok.buffer,
      mustEscape: tok.mustEscape !== false,
      isInline: !!noBlock,
      line: tok.loc.start.line,
      column: tok.loc.start.column,
      filename: this.filename
    };
    // todo: why is this here?  It seems like a hacky workaround
    if (node.val.match(/^ *else/)) node.debug = false;

    if (noBlock) return node;

    let block: boolean;

    // handle block
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
    let tok: IfToken | ElseIfToken = this.expect("if");
    var node: TPugConditionalNode = {
      type: "Conditional",
      test: tok.val,
      consequent: this.emptyBlock(tok.loc.start.line),
      alternate: null,
      line: tok.loc.start.line,
      column: tok.loc.start.column,
      filename: this.filename
    };

    // handle block
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
    var node: Partial<TPugWhileNode> = {
      type: "While",
      test: tok.val,
      line: tok.loc.start.line,
      column: tok.loc.start.column,
      filename: this.filename
    };

    // handle block
    if ("indent" == this.peek().type) {
      node.block = this.block();
    } else {
      node.block = this.emptyBlock(tok.loc.start.line);
    }

    return node as TPugWhileNode;
  }

  /**
   * block code
   */

  parseBlockCode() {
    let tok = this.expect("blockcode") as
      | BlockcodeToken
      | TextToken
      | NewlineToken;
    var line = tok.loc.start.line;
    var column = tok.loc.start.column;
    var body = this.peek();
    var text = "";
    if (body.type === "start-pipeless-text") {
      this.advance();
      while (this.peek().type !== "end-pipeless-text") {
        tok = this.advance() as TextToken | NewlineToken;
        switch (tok.type) {
          case "text":
            text += tok.val;
            break;
          case "newline":
            text += "\n";
            break;
          default:
            var pluginResult = this.runPlugin(
              "blockCodeTokens",
              tok as Token,
              tok as Token
            );
            if (pluginResult) {
              text += pluginResult;
              break;
            }
            this.error(
              "INVALID_TOKEN",
              "Unexpected token type: " + (tok as Token).type,
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
  /**
   * comment
   */

  parseComment(): TPugCommentNode | TPugBlockCommentNode {
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

  /**
   * doctype
   */

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

  /**
   * filter attrs? text-block
   */

  parseFilter() {
    var tok = this.expect("filter");
    var block,
      attrs = [];

    if (this.peek().type === "start-attributes") {
      attrs = this.attrs();
    }

    if (this.peek().type === "text") {
      var textToken = this.advance() as TextToken;
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

  /**
   * each block
   */

  parseEach() {
    var tok = this.expect("each");
    const node: Partial<TPugEachNode> = {
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
    return node as TPugEachNode;
  }

  // parseEachOf() {
  //   var tok = this.expect("eachOf");
  //   var node: TPugEachNode = {
  //     type: "EachOf",
  //     obj: tok.code,
  //     val: tok.val,
  //     block: this.block(),
  //     line: tok.loc.start.line,
  //     column: tok.loc.start.column,
  //     filename: this.filename
  //   };
  //   return node;
  // }
  /**
   * 'extends' name
   */

  // parseExtends() {
  //   var tok = this.expect("extends");
  //   var path = this.expect<"path">("path") as PathToken;
  //   return {
  //     type: "Extends",
  //     file: {
  //       type: "FileReference",
  //       path: path.val.trim(),
  //       line: path.loc.start.line,
  //       column: path.loc.start.column,
  //       filename: this.filename
  //     },
  //     line: tok.loc.start.line,
  //     column: tok.loc.start.column,
  //     filename: this.filename
  //   };
  // }

  /**
   * 'block' name block
   */

  // parseBlock() {
  //   const tok = this.expect("block");
  //   const node: TPugNamedBlockNode =
  //     "indent" == this.peek().type
  //       ? this.block()
  //       : this.emptyBlock(tok.loc.start.line);
  //   node.type = "NamedBlock";
  //   node.name = tok.val.trim();
  //   node.mode = tok.mode;
  //   node.line = tok.loc.start.line;
  //   node.column = tok.loc.start.column;

  //   return node;
  // }

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

  /**
   * include block?
   */
  parseInclude() {
    var tok = this.expect("include");

    const fileNode: Partial<TPugFileReferenceNode> = {
      type: "FileReference",
      filename: this.filename
    };

    const node: Partial<TPugIncludeNode> = {
      type: "Include",
      // file: {
      //   type: "FileReference",
      //   filename: this.filename
      // },
      line: tok.loc.start.line,
      column: tok.loc.start.column,
      filename: this.filename
    };
    var path = this.expect<"path">("path") as PathToken;
    fileNode.path = path.val.trim();
    fileNode.line = path.loc.start.line;
    fileNode.column = path.loc.start.column;

    node.file = fileNode as TPugFileReferenceNode;

    node.block =
      "indent" == this.peek().type
        ? this.block()
        : this.emptyBlock(tok.loc.start.line);

    return node;
  }
  /**
   * parseInclude() {
    var tok = this.expect("include");

    const fileNode: Partial<TPugFileReferenceNode> = {
      type: "FileReference",
      filename: this.filename
    };

    const node: Partial<TPugIncludeNode> = {
      type: "Include",
      // file: {
      //   type: "FileReference",
      //   filename: this.filename
      // },
      line: tok.loc.start.line,
      column: tok.loc.start.column,
      filename: this.filename
    };
    var filters = [];
    while (this.peek().type === "filter") {
      filters.push(this.parseIncludeFilter());
    }
    var path = this.expect<"path">("path") as PathToken;
    fileNode.path = path.val.trim();
    fileNode.line = path.loc.start.line;
    fileNode.column = path.loc.start.column;

    node.file = fileNode as TPugFileReferenceNode;

    if (/\.pug$/.test(node.file.path) && !filters.length) {
      node.block =
        "indent" == this.peek().type
          ? this.block()
          : this.emptyBlock(tok.loc.start.line);
    }

    return node;
  }
   */

  /**
   * call ident block
   */
  parseCall() {
    var tok = this.expect("call") as CallToken;
    var name = tok.val;
    var args = tok.args;
    var mixin: TPugMixinNode = {
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

    this.tag<"mixin">(mixin);
    if (mixin.code) {
      mixin.block.nodes.push(mixin.code);
      delete mixin.code;
    }
    if (mixin.block.nodes.length === 0) mixin.block = null;
    return mixin;
  }

  /**
   * mixin block
   */

  parseMixin(): TPugMixinNode | undefined {
    var tok = this.expect("mixin") as MixinToken;
    var name = tok.val;
    var args = tok.args;

    if ("indent" == this.peek().type) {
      this.inMixin++;
      const mixin: TPugMixinNode = {
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

  /**
   * indent (text | newline)* outdent
   */

  parseTextBlock(): TPugBlockNode {
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

  /**
   * indent expr* outdent
   */

  block() {
    var tok = this.expect("indent");
    var block = this.emptyBlock(tok.loc.start.line);
    while ("outdent" != this.peek().type) {
      if ("newline" == this.peek().type) {
        this.advance();
      } else if ("text-html" == this.peek().type) {
        block.nodes = block.nodes.concat(
          this.parseTextHtml() as unknown as TPugAnyNode
        );
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

  /**
   * interpolation (attrs | class | id)* (text | code | ':')? newline* block?
   */

  parseInterpolation() {
    var tok = this.advance() as InterpolatedCodeToken;
    var tag: TPugInterpolatedTagNode = {
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

    return this.tag<"interpolated-code">(tag, { selfClosingAllowed: true });
  }

  /**
   * tag (attrs | class | id)* (text | code | ':')? newline* block?
   */
  parseTag(): TPugTagNode {
    var tok = this.advance() as TagToken;
    var tag: TPugTagNode = {
      type: "Tag",
      name: tok.val,
      selfClosing: false,
      block: this.emptyBlock(tok.loc.start.line),
      attrs: [],
      attributeBlocks: [],
      isInline: inlineTags.indexOf(tok.val as TInlineTag) !== -1,
      line: tok.loc.start.line,
      column: tok.loc.start.column,
      filename: this.filename
    };

    return this.tag<"tag">(tag, { selfClosingAllowed: true });
  }

  /**
   * Parse tag.
   */

  tag<Type extends LexTokenType>(
    tag: TPugTagNode | TPugInterpolatedTagNode | TPugMixinNode,
    options?: { selfClosingAllowed: boolean }
  ): "tag" extends Type
    ? TPugTagNode
    : "interpolated-code" extends Type
    ? TPugInterpolatedTagNode
    : "mixin" extends Type
    ? TPugMixinNode
    : TPugTagNode {
    var seenAttrs = false;
    var attributeNames = [];
    var selfClosingAllowed = options && options.selfClosingAllowed;
    // (attrs | class | id)*
    out: while (true) {
      switch (this.peek().type) {
        case "id":
        case "class":
          const classOrIdTok = this.advance() as ClassToken | IdToken;
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

    // check immediate '.'
    if ("dot" == this.peek().type) {
      (tag as TPugTagNode).textOnly = true;
      this.advance();
    }

    // (text | code | ':')?
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
          (tag as TPugTagNode | TPugInterpolatedTagNode).selfClosing = true;
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

    // newline*
    while ("newline" == this.peek().type) this.advance();

    // block?
    if ((tag as TPugTagNode | TPugInterpolatedTagNode).textOnly) {
      tag.block = this.parseTextBlock() || this.emptyBlock(tag.line);
    } else if ("indent" == this.peek().type) {
      var block = this.block();
      for (var i = 0, len = block.nodes.length; i < len; ++i) {
        tag.block.nodes.push(block.nodes[i]);
      }
    }

    return tag as "tag" extends Type
      ? TPugTagNode
      : "interpolated-code" extends Type
      ? TPugInterpolatedTagNode
      : "mixin" extends Type
      ? TPugMixinNode
      : TPugTagNode;
  }

  attrs(attributeNames?: string[]) {
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
