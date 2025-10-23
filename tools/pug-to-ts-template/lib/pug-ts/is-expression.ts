"use strict";

import { parseExpression } from "@babel/parser";

export function isExpression(src: string) {
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
