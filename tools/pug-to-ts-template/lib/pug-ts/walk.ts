import {
  TPugAnyNode,
  TPugAst,
  TPugBlockNode,
  TPugCaseNode,
  TPugTagNode
} from "../types/pug.types";

export type TWalkCallback = (
  node: TPugAnyNode,
  cb: (...args: any[]) => void
) => void | boolean;

export function walkAST(
  ast: TPugAnyNode,
  before: TWalkCallback | null,
  after?: TWalkCallback
) {
  type TReplaceFn = ((replacement: any) => void) & {
    arrayAllowed: boolean;
  };
  var replace = function replace(replacement) {
    if (Array.isArray(replacement) && !(replace as TReplaceFn).arrayAllowed) {
      throw new Error(
        "replace() can only be called with an array if the last parent is a Block or NamedBlock"
      );
    }
    ast = replacement;
  } as TReplaceFn;

  replace.arrayAllowed = false;

  if (before) {
    var result = before(ast, replace);
    if (result === false) {
      return ast;
    } else if (Array.isArray(ast)) {
      // return right here to skip after() call on array
      return walkAndMergeNodes(ast);
    }
  }

  switch (ast.type) {
    case "NamedBlock":
    case "Block":
      (ast as TPugBlockNode).nodes = walkAndMergeNodes(
        (ast as TPugBlockNode).nodes
      );
      break;
    case "Case":
    case "Mixin":
    case "Tag":
    case "InterpolatedTag":
    case "When":
    case "Code":
    case "While":
      if (ast.block) {
        ast.block = walkAST(
          (ast as unknown as TPugTagNode).block,
          before,
          after
        );
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
      walkAST(ast.file as unknown as TPugAnyNode, before, after);
      break;

    // case "RawInclude":
    //   ast.filters = walkAndMergeNodes(ast.filters);
    //   walkAST(ast.file, before, after, options);
    //   break;
    // case "Attrs":
    case "BlockComment":
    case "Comment":
    // case "Doctype":
    // case "IncludeFilter":
    case "MixinBlock":
    // case "YieldBlock":
    case "Text":
      break;
    case "FileReference":
      // if (options.includeDependencies && ast.ast) {
      //   walkAST(ast.ast, before, after);
      // }
      break;
    default:
      throw new Error("Unexpected node type " + (ast as any).type);
      break;
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
