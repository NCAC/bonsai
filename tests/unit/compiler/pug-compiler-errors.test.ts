/**
 * Test — Pug compiler: compile errors (strate 1c, lot 4, 5-rendu §10.1)
 *
 * What the compiler cannot project surgically, or what the conventions
 * forbid, is refused at build time with a stable code and the position in
 * the template.
 */

import { describe, it, expect } from "@jest/globals";
import { compile } from "../../helpers/pug";
import { PugError } from "@tools/pug-compiler/src/bonsai-pug";

const refused = (src: string): PugError => {
  try {
    compile(src);
  } catch (e) {
    if (e instanceof PugError) return e;
    throw e;
  }
  throw new Error("compiled without error");
};

describe("Compile errors", () => {
  it.each([
    ["each without key", `//- @data { xs: { id: number }[] }\nul\n  each x in xs\n    li= x.id`, "EACH_KEY", 4],
    ["each with a constant key", `//- @data { xs: { id: number }[] }\nul\n  each x in xs\n    li(data-item-id="k")= x.id`, "EACH_KEY", 4],
    ["key depending on the index", `//- @data { xs: number[] }\nul\n  each x, i in xs\n    li(data-key=i)= x`, "KEY_USES_INDEX", 4],
    ["key depending on the index through a mixin", `//- @data { xs: number[] }\nmixin r(n)\n  li(data-key=n)\nul\n  each x, i in xs\n    +r(i)`, "KEY_USES_INDEX", 3],
    ["each body with two roots", `//- @data { xs: { id: number }[] }\nul\n  each x in xs\n    li(data-key=x.id)\n    li(data-key=x.id)`, "EACH_SINGLE_ROOT", 3],
    ["each body made of text", `//- @data { xs: number[] }\nul\n  each x in xs\n    | #{x}`, "EACH_SINGLE_ROOT", 3],
    ["each with siblings", `//- @data { xs: { id: number }[] }\nul\n  li header\n  each x in xs\n    li(data-key=x.id)`, "EACH_NOT_ALONE", 4],
    ["each directly in a branch", `//- @data { xs: { id: number }[] }\nif xs\n  each x in xs\n    li(data-key=x.id)`, "EACH_IN_BRANCH", 3],
    ["each … else", `//- @data { xs: { id: number }[] }\nul\n  each x in xs\n    li(data-key=x.id)\n  else\n    li none`, "EACH_ELSE", 3],
    ["data read without a declared type", `p= title`, "NO_DATA_TYPE", 1],
    ["two @data", `//- @data { a: 1 }\n//- @data { b: 1 }\np x`, "DUPLICATE_DATA", 2],
    ["empty @data", `//- @data\np x`, "EMPTY_DATA", 1],
    ["unbuffered code", `- const a = 1\np= a`, "CODE", 1],
    ["unescaped text", `//- @data { h: string }\np!= h`, "UNESCAPED", 2],
    ["unescaped interpolation", `//- @data { h: string }\np !{h}`, "UNESCAPED", 2],
    ["raw HTML in text", `p a <b>b</b>`, "INLINE_HTML", 1],
    ["unknown entity", `p &copy;`, "ENTITY", 1],
    ["dynamic class", `//- @data { s: string }\np(class=s)`, "DYNAMIC_CLASS", 2],
    ["&attributes", `//- @data { a: object }\np&attributes(a)`, "UNEXPECTED_TEXT", 2],
    ["invalid attribute name", `button(@ui="x")`, "ATTRIBUTE_NAME", 1],
    ["duplicate attribute", `p(title="a" title="b")`, "DUPLICATE_ATTRIBUTE", 1],
    ["invalid expression", `//- @data { a: 1 }\np(title=a +)`, "EXPRESSION", 2],
    ["case/when", `//- @data { a: 1 }\ncase a\n  when 1\n    p one`, "UNSUPPORTED", 2],
    ["while", `//- @data { a: boolean }\nwhile a\n  p x`, "UNSUPPORTED", 2],
    ["interpolated tag name", `//- @data { t: string }\n#{t} x`, "UNSUPPORTED", 2],
    ["include", `include other.pug`, "UNSUPPORTED", 1],
    ["named block", `block content\n  p x`, "UNSUPPORTED", 1],
    ["extends", `extends layout.pug`, "UNSUPPORTED", 1],
    ["unknown mixin", `+nope()`, "UNKNOWN_MIXIN", 1],
    ["recursive mixin", `mixin m()\n  +m()\n+m()`, "RECURSIVE_MIXIN", 2],
    ["mixin defined twice", `mixin m()\n  p\nmixin m()\n  p`, "DUPLICATE_MIXIN", 3],
    ["nested mixin definition", `div\n  mixin m()\n    p`, "NESTED_MIXIN", 2],
    ["mixin parameter with a default", `mixin m(a = 1)\n  p= a\n+m()`, "MIXIN_PARAMS", 1],
    ["too many mixin arguments", `mixin m(a)\n  p= a\n+m(1, 2)`, "MIXIN_ARGUMENTS", 3],
    ["invalid mixin arguments", `mixin m(a)\n  p= a\n+m(1 +)`, "EXPRESSION", 3],
    ["attributes on a mixin call", `mixin m()\n  p\n+m()(title="x")`, "MIXIN_ATTRIBUTES", 3],
    ["block outside a mixin", `div\n  block`, "BLOCK_OUTSIDE_MIXIN", 2],
    ["unknown node (doctype)", `doctype html`, "UNSUPPORTED", 1],
    ["svg (namespace)", `div\n  svg(viewBox="0 0 1 1")`, "UNSUPPORTED", 2]
  ])("%s", (_label, src, code, line) => {
    const e = refused(src);
    expect(e.code).toBe(`PUG:${code}`);
    expect(e.line).toBe(line);
  });

  it("the message quotes the template with a caret at the position", () => {
    const e = refused(`//- @data { s: string }\np\n  span(class=s)`);
    expect(e.message).toContain("test.template.pug:3");
    expect(e.message).toMatch(/> 3\|\s+span\(class=s\)/);
    expect(e.message).toContain("data-state");
  });
});
