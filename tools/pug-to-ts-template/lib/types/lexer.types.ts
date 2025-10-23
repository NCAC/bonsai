import { extend } from "lodash-es";

export interface Loc {
  start: { line: number; column: number };
  end: { line: number; column: number };
  filename?: string;
}

export type LexTokenType =
  | ":"
  | "&attributes"
  | "attribute"
  | "block"
  | "blockcode"
  | "call"
  | "case"
  | "class"
  | "code"
  | "comment"
  | "default"
  | "doctype"
  | "dot"
  | "each"
  | "eachOf"
  | "else-if"
  | "else"
  | "end-attributes"
  | "end-pipeless-text"
  | "end-pug-interpolation"
  | "eos"
  | "extends"
  | "filter"
  | "id"
  | "if"
  | "include"
  | "indent"
  | "interpolated-code"
  | "interpolation"
  | "mixin-block"
  | "mixin"
  | "newline"
  | "outdent"
  | "path"
  | "slash"
  | "start-attributes"
  | "start-pipeless-text"
  | "start-pug-interpolation"
  | "tag"
  | "text-html"
  | "text"
  | "when"
  | "while"
  | "yield";

export type LexBaseToken = {
  loc: Loc;
};

export type TValStringToken = { val: string };

export type TagToken = LexBaseToken & {
  type: "tag";
} & TValStringToken;
export type StartAttributesToken = LexBaseToken & { type: "start-attributes" };
export type AttributeToken = LexBaseToken & { type: "attribute" } & {
  name: string;
  val: string | boolean;
  mustEscape: boolean;
};
export type EndAttributesToken = LexBaseToken & { type: "end-attributes" };
export type IndentToken = LexBaseToken & { type: "indent" };
export type ClassToken = LexBaseToken & { type: "class" } & TValStringToken;
export type OutdentToken = LexBaseToken & { type: "outdent" };
export type EosToken = LexBaseToken & { type: "eos" };
export type CommentToken = LexBaseToken & { type: "comment" } & {
  buffer: boolean;
  val: string;
};
export type NewlineToken = LexBaseToken & { type: "newline" };
export type TextToken = LexBaseToken & { type: "text" } & TValStringToken;
export type InterpolatedCodeToken = LexBaseToken & {
  type: "interpolated-code";
} & { mustEscape: boolean; buffer: boolean; val: string };
export type CodeToken = LexBaseToken & { type: "code" } & {
  val: string;
  mustEscape: boolean;
  buffer: boolean;
};
export type IdToken = LexBaseToken & { type: "id" } & TValStringToken;
export type StartPipelessTextToken = LexBaseToken & {
  type: "start-pipeless-text";
};
export type EndPipelessTextToken = LexBaseToken & { type: "end-pipeless-text" };
export type DoctypeToken = LexBaseToken & { type: "doctype" } & TValStringToken;
export type DotToken = LexBaseToken & { type: "dot" };
export type BlockToken = LexBaseToken & { type: "block" } & {
  val: string;
  mode: "replace" | "prepend" | "append";
};
export type ExtendsToken = LexBaseToken & { type: "extends" };
export type PathToken = LexBaseToken & { type: "path" } & { val: string };
export type StartPugInterpolationToken = LexBaseToken & {
  type: "start-pug-interpolation";
};
export type EndPugInterpolationToken = LexBaseToken & {
  type: "end-pug-interpolation";
};
export type InterpolationToken = LexBaseToken & {
  type: "interpolation";
} & TValStringToken;
export type IncludeToken = LexBaseToken & { type: "include" };
export type FilterToken = LexBaseToken & { type: "filter" } & TValStringToken;
export type CallToken = LexBaseToken & { type: "call" } & {
  val: string;
  args: string;
};
export type MixinToken = LexBaseToken & { type: "mixin" } & {
  val: string;
  args: string | null;
};
export type IfToken = LexBaseToken & { type: "if" } & TValStringToken;
export type MixinBlockToken = LexBaseToken & { type: "mixin-block" };
export type ElseToken = LexBaseToken & { type: "else" } & TValStringToken;
export type TextHtmlToken = LexBaseToken & {
  type: "text-html";
} & TValStringToken;
export type EachToken = LexBaseToken & { type: "each" } & {
  val: string;
  key: string | null;
  code: string;
};
export type EachOfToken = LexBaseToken & { type: "eachOf" } & {
  val: string;
  value: string;
  code: string;
};
export type WhileToken = LexBaseToken & { type: "while" } & TValStringToken;
export type CaseToken = LexBaseToken & { type: "case" } & TValStringToken;
export type WhenToken = LexBaseToken & { type: "when" } & TValStringToken;
export type ColonToken = LexBaseToken & { type: ":" };
export type DefaultToken = LexBaseToken & { type: "default" };
export type ElseIfToken = LexBaseToken & { type: "else-if" } & TValStringToken;
export type BlockcodeToken = LexBaseToken & { type: "blockcode" };
export type YieldToken = LexBaseToken & { type: "yield" };
export type SlashToken = LexBaseToken & { type: "slash" };

export type LexToken<Type extends LexTokenType> = "tag" extends Type
  ? TagToken
  : "start-attribute" extends Type
  ? StartAttributesToken
  : "attribute" extends Type
  ? AttributeToken
  : "end-attribute" extends Type
  ? EndAttributesToken
  : "indent" extends Type
  ? IndentToken
  : "class" extends Type
  ? ClassToken
  : "outdent" extends Type
  ? OutdentToken
  : "eos" extends Type
  ? EosToken
  : "comment" extends Type
  ? CommentToken
  : "newline" extends Type
  ? NewlineToken
  : "text" extends Type
  ? TextToken
  : "interpolated-code" extends Type
  ? InterpolatedCodeToken
  : "code" extends Type
  ? CodeToken
  : "id" extends Type
  ? IdToken
  : "start-pipeless-text" extends Type
  ? StartPipelessTextToken
  : "end-pipeless-text" extends Type
  ? EndPipelessTextToken
  : "doctype" extends Type
  ? DoctypeToken
  : "dot" extends Type
  ? DotToken
  : "block" extends Type
  ? BlockToken
  : "extends" extends Type
  ? ExtendsToken
  : "path" extends Token
  ? PathToken
  : "start-pug-interpolation" extends Type
  ? StartPugInterpolationToken
  : "end-pug-interpolation" extends Type
  ? EndPugInterpolationToken
  : "interpolation" extends Type
  ? InterpolationToken
  : "include" extends Type
  ? IncludeToken
  : "filter" extends Type
  ? FilterToken
  : "call" extends Type
  ? CallToken
  : "mixin" extends Type
  ? MixinToken
  : "if" extends Type
  ? IfToken
  : "mixin-block" extends Type
  ? MixinBlockToken
  : "else" extends Type
  ? ElseIfToken
  : "text-html" extends Type
  ? TextHtmlToken
  : "each" extends Type
  ? EachToken
  : "eachOf" extends Type
  ? EachOfToken
  : "while" extends Type
  ? WhileToken
  : "case" extends Type
  ? CaseToken
  : "when" extends Type
  ? WhenToken
  : ":" extends Type
  ? ColonToken
  : "default" extends Type
  ? DefaultToken
  : "else-if" extends Type
  ? ElseIfToken
  : "blockcode" extends Type
  ? BlockcodeToken
  : "yield" extends Type
  ? YieldToken
  : "slash" extends Type
  ? SlashToken
  : Token;

export type Token =
  | AttributeToken
  | BlockcodeToken
  | BlockToken
  | CallToken
  | CaseToken
  | ClassToken
  | CodeToken
  | ColonToken
  | CommentToken
  | DefaultToken
  | DoctypeToken
  | DotToken
  | EachToken
  | EachOfToken
  | ElseIfToken
  | ElseToken
  | EndAttributesToken
  | EndPipelessTextToken
  | EndPugInterpolationToken
  | EosToken
  | ExtendsToken
  | FilterToken
  | IdToken
  | IfToken
  | IncludeToken
  | IndentToken
  | InterpolatedCodeToken
  | InterpolationToken
  | MixinBlockToken
  | MixinToken
  | NewlineToken
  | OutdentToken
  | PathToken
  | SlashToken
  | StartAttributesToken
  | StartPipelessTextToken
  | StartPugInterpolationToken
  | TagToken
  | TextHtmlToken
  | TextToken
  | WhenToken
  | WhileToken
  | YieldToken;

export type LexerFunction = (type: string, exp?: any) => boolean;
export interface LexerOptions {
  filename: string;
  interpolated?: boolean;
  startingLine?: number;
  startingColumn?: number;
  plugins?: LexerFunction[];
}
