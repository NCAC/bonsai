import { lex } from "./lexer.js";
import { parse } from "./parser.js";
import { TPugAst, TPugIncludeNode } from "../types/pug.types.js";
import { walkAST } from "./walk.js";
import fs from "fs-extra";
import { join, dirname } from "path";

export type TLoadOptions = {
  filename: string;
};

function loadAst(ast: TPugAst, options: TLoadOptions) {
  // options = getOptions(options);
  // clone the ast
  ast = JSON.parse(JSON.stringify(ast));
  return walkAST(ast, function (node) {
    if ((node as any).str === undefined) {
      if (
        (node as unknown as TPugIncludeNode).type === "Include" ||
        (node as any).type === "RawInclude" ||
        (node as any).type === "Extends"
      ) {
        var file = (node as unknown as TPugIncludeNode).file;
        if (file.type !== "FileReference") {
          throw new Error('Expected file.type to be "FileReference"');
        }
        let path: string;
        let raw: Buffer;
        let str: string;
        try {
          path = resolve(file.path, file.filename);
          file.fullPath = path;
          raw = fs.readFileSync(path);
          str = raw.toString("utf8");
          file.str = str;
          file.raw = raw;
        } catch (ex) {
          ex.message += "\n    at " + node.filename + " line " + node.line;
          throw ex;
        }

        if ((node as unknown as TPugIncludeNode).type === "Include") {
          file.ast = loadTemplate(str, path);
        }
      }
    }
  });
}

export function loadTemplate(src: string, filename: string) {
  const opts = { filename };
  const tokens = lex(src, opts);
  const ast = parse(tokens, opts);
  return loadAst(ast, opts);
}

function resolve(filename: string, source: string) {
  filename = filename.trim();
  if (filename[0] !== "/" && !source)
    throw new Error(
      'the "filename" option is required to use includes and extends with "relative" paths'
    );

  filename = join(dirname(source.trim()), filename);

  return filename;
}
