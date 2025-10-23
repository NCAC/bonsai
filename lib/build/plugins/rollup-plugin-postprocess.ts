// 2. Dépendances externes
import MagicString from "magic-string";
import {
  PluginContext,
  Plugin,
  NormalizedOutputOptions,
  OutputBundle,
  RenderedChunk
} from "rollup";

type PostProcessOptions = {
  find: string | RegExp;
  replace: string;
}[];

function postprocess(replacements: PostProcessOptions): Plugin {
  return {
    name: "postprocess",

    renderChunk: function generateBundle(
      this: PluginContext,
      code: string,
      chunk: RenderedChunk,
      options: NormalizedOutputOptions,
      meta: { chunks: Record<string, RenderedChunk> }
    ): { code: string } {
      const str = new MagicString(code);

      for (let i = 0; i < replacements.length; i++) {
        const { find, replace } = replacements[i];
        const regex = typeof find === "string" ? new RegExp(find, "m") : find;

        // Plutôt que d'utiliser des variables globales, traiter chaque correspondance localement
        const match = regex.exec(code);
        if (match) {
          // Fonction de remplacement locale qui utilise la capture actuelle
          const createReplaceValue = (matchResult: RegExpExecArray) => {
            return replace.replace(/\$(\d+)/g, (_, index) => {
              return matchResult[index] || "";
            });
          };

          const value = createReplaceValue(match);
          str.overwrite(match.index, match.index + match[0].length, value);
        }
      }

      // Libérer la mémoire en convertissant immédiatement en chaîne
      const result = str.toString();
      return { code: result };
    }
  };
}

export default postprocess;
