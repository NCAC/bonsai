import { Token } from "../types/lexer.types";

export class TokenStream {
  private _tokens: Token[];
  constructor(tokens: Token[]) {
    if (!Array.isArray(tokens)) {
      throw new TypeError("tokens must be passed to TokenStream as an array.");
    }
    this._tokens = tokens;
  }
  /**
   * returns the token by index
   */
  lookahead(index: number) {
    if (this._tokens.length <= index) {
      throw new Error("Cannot read past the end of a stream");
    }
    return this._tokens[index];
  }
  /**
   * returns the first token
   */
  peek() {
    if (this._tokens.length === 0) {
      throw new Error("Cannot read past the end of a stream");
    }
    return this._tokens[0];
  }
  /**
   * Removes the first element of the tokens and returns it
   */
  advance() {
    if (this._tokens.length === 0) {
      throw new Error("Cannot read past the end of a stream");
    }
    return this._tokens.shift();
  }
  /**
   * Insert a token at index 0 and returns the new length.
   */
  defer(token: Token) {
    this._tokens.unshift(token);
  }
}
