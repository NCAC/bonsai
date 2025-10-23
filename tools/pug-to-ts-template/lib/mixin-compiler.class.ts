import {
  TPugAttribute,
  TPugTagNode,
  TPugTextNode,
  TPugBlockNode,
  TPugAnyNode,
  TPugInterpolatedTagNode,
  TPugCaseNode,
  TPugWhenNode,
  TPugMixinNode,
  TPugWhileNode,
  TPugEachNode,
  TPugCodeNode,
  TPugCommentNode,
  TPugBlockCommentNode,
  TPugConditionalNode,
  TPugIncludeNode
} from "./types/pug.types.js";
import { Writer } from "./writer.class.js";
import { BaseCompiler } from "./base-compiler.class.js";

export class MixinCompiler extends BaseCompiler {
  name: string;
  nodeId: number = 0;
  parentTagId: number = 0;
  body: Writer;
  ast: TPugBlockNode;
  constructor(node: TPugBlockNode, name: string, indent: number) {
    super(node);
    this.name = name;
    this.body = new Writer(indent);
  }
}
