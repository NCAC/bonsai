export type TPugNodeType =
  | "Tag"
  | "Block"
  | "NamedBlock"
  | "Text"
  | "Code"
  | "Conditional"
  | "InterpolatedTag"
  | "When"
  | "Case"
  | "MixinBlock"
  | "Mixin"
  | "Extends"
  | "Each"
  | "While"
  | "Comment"
  | "BlockComment"
  | "Include"
  | "FileReference";

export type TPugDocContext = {
  line: number; // line number of the start position of the node
  column: number | null; // column number at the starting position of the node
  filename: string | null; // the name of the file the node originally belongs to
};

/**
 * Generic Node object
 */

export type TPugNode<NodeType extends TPugNodeType = TPugNodeType> = {
  type: NodeType;
  // nodes?: TPugNode[];
} & TPugDocContext;

//#region "Block" Node
export type TPugBlockNode = {
  type: "Block";
  line: number;
  filename: string;
  nodes: TPugAnyNode[];
};

export type TPugAnyNode =
  | TPugBlockNode
  | TPugNamedBlockNode
  | TPugCommentNode
  | TPugBlockCommentNode
  | TPugTextNode
  | TPugTagNode
  | TPugInterpolatedTagNode
  | TPugCodeNode
  | TPugConditionalNode
  | TPugCaseNode
  | TPugMixinNode
  | TPugMixinBlockNode
  | TPugIncludeNode
  | TPugFileReferenceNode
  | TPugWhenNode
  | TPugWhileNode
  | TPugEachNode;
//#endregion

//#region Abstract Node Types
export type TPugAttributeNode<NodeType extends TPugNodeType = TPugNodeType> =
  TPugNode<NodeType> & {
    attrs: TPugAttribute[]; // all the individual attributes of the node,
    attributeBlocks: Array<{
      line: number;
      column: number;
      type: string;
      val: string;
      filename: string;
    }>; // all the &attributes expressions effective on this node
  };
export type TPugAttribute = {
  name: string; // the name of the attribute
  val: string; // JavaScript expression returning the value of the attribute
  mustEscape: boolean; // if the value must be HTML-escaped before being buffered
} & TPugDocContext;
type TPugValueNode<NodeType extends TPugNodeType = TPugNodeType> =
  TPugNode<NodeType> & {
    val: string;
  };
type TPugExpressionNode<NodeType extends TPugNodeType = TPugNodeType> =
  TPugNode<NodeType> & {
    expr: string;
  };
type TPugBlock = {
  block: TPugBlockNode;
};
//#endregion

//#region Comments
type TPugBaseComment<NodeType extends TPugNodeType = TPugNodeType> =
  TPugValueNode<NodeType> & {
    buffer: boolean; // whether the comment should appear when rendered
  };
// single comment
export type TPugCommentNode = TPugBaseComment<"Comment">;

// multi-line comment
export type TPugBlockCommentNode = TPugBaseComment<"BlockComment"> & TPugBlock;
//#endregion

// text node
export type TPugTextNode = TPugValueNode<"Text"> & { isHtml?: boolean };

//#region "Tag" Node
type TPugCommonTag<NodeType extends "Tag" | "InterpolatedTag"> =
  TPugAttributeNode<NodeType> &
    TPugBlock & {
      selfClosing: boolean; // if the tag is explicitly stated as self-closing
      isInline: boolean; // if the tag is defined as an inline tag as opposed to a block-level tag
    };

export type TPugTagNode = TPugCommonTag<"Tag"> & {
  name: string; // the name of the tag (div | ul | h1 | ... any string)
  textOnly?: boolean;
};

export type TPugInterpolatedTagNode = TPugCommonTag<"InterpolatedTag"> &
  TPugExpressionNode<"InterpolatedTag"> & { textOnly?: boolean };
//#endregion

//#region Code

// Code Node
export type TPugCodeNode = TPugValueNode<"Code"> & {
  buffer: boolean; // if the value of the piece of code is buffered in the template
  mustEscape: boolean; // if the value must be HTML-escaped before being buffered
  isInline: boolean; // whether the node is the result of a string interpolation
  block?: TPugBlockNode | null;
  debug?: boolean;
};

// Conditional
export type TPugConditionalNode = TPugNode<"Conditional"> & {
  test: string;
  consequent: TPugBlockNode;
  alternate: TPugConditionalNode | TPugBlockNode | null;
};

// Case / When
export type TPugCaseNode = TPugExpressionNode<"Case"> & {
  block: TPugWhenBlock;
};

export type TPugWhenBlock = TPugBlock & {
  nodes: TPugWhenNode[];
};

export type TPugWhenNode = Partial<TPugBlock> &
  TPugNode<"When"> & {
    expr: string | "default";
    debug?: boolean;
  };

export type TPugWhileNode = TPugBlock &
  TPugNode<"While"> & {
    test: string;
  };

export type TPugEachNode = TPugBlock &
  TPugNode<"Each"> & {
    obj: string; // the object or array that is being looped
    val: string; // the variable name of the value of a specific object property or array member
    key: string | null; // the variable name, if any, of the object property name or array index of `val`
    alternate: TPugBlockNode | null; // the else expression
  };

//#region "NamedBlock" Node
export type TPugNamedBlockNode = TPugNode<"NamedBlock"> & {
  name: string;
  mode: "replace" | "append" | "prepend";
};
//#endregion

export type TPugIncludeNode = TPugBlock &
  TPugNode<"Include"> & {
    file: TPugFileReferenceNode;
  };

export type TPugFileReferenceNode = TPugNode<"FileReference"> & {
  path: string;
  fullPath: string;
  str: string;
  raw: Buffer;
  ast: TPugAst;
};

export type TPugMixinNode = TPugBlock &
  TPugNode<"Mixin"> & {
    name: string; // the name of the mixin
    call: boolean; // if this node is a mixin call (as opposed to mixin definition)
    args: string; // list of arguments (declared in case of mixin definition, or specified in case of mixin call)
    attrs?: TPugAttribute[];
    attributeBlocks?: TPugAttribute[];
    code?: TPugCodeNode;
  };

export type TPugMixinBlockNode = TPugNode<"MixinBlock">;

// final test

export type TPugAst = {
  type: "Block";
  nodes: TPugAnyNode[];
} & TPugDocContext;
