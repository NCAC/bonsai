import camelcase from "camelcase";
import { dirname, join, basename } from "node:path";
import fileSystem from "fs-extra";
import { loadTemplate } from "./pug-ts/load.js";
import { TemplateCompiler } from "./template-compiler.class.js";
import { format } from "prettier";

export async function generateTSCodeFromPug(
  filePath: string
): Promise<false | string> {
  try {
    const fileDir = dirname(filePath);
    const moduleName = basename(fileDir);
    console.log(`fileDir: ${fileDir} and moduleName: ${moduleName}`);
    const fileContent = await fileSystem.readFile(filePath, {
      encoding: "utf-8"
    });

    const ast = loadTemplate(fileContent, filePath);
    //#region test
    await fileSystem.writeJSON("ast.json", ast);
    //#endregion test
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
