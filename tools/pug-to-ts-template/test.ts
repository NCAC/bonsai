import { generateTSCodeFromPug } from "./lib/generate-tscode-from-pug.js";

import { lex } from "./lib/pug-ts/lexer.js";
import { parse } from "./lib/pug-ts/parser.js";

import fileSystem from "fs-extra";

fileSystem
  .readFile("./Page/pageView.template.pug", "utf-8")
  .then(async (str) => {
    try {
      const lexed = lex(str, { filename: "pageView.template.pug" });
      await fileSystem.writeJSON("lex.json", JSON.stringify(lexed));
      const parsed = parse(lexed, { filename: "pageView.template.pug" });
      await fileSystem.writeJSON("parse.json", JSON.stringify(parsed));
      await generateTSCodeFromPug("./Page/pageView.template.pug");
    } catch (e) {
      throw e;
    }
  });
