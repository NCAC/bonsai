import { rollup, RollupBuild, RollupError } from "rollup";
import nodeResolve from "@rollup/plugin-node-resolve";
import { dirname, join } from "node:path";
import rollupTypescript from "rollup-plugin-ts";
import { fileURLToPath } from "node:url";
import fileSystem from "fs-extra";
import stripComments from "gulp-strip-comments";
import prettier from "gulp-prettier";
import { IPackageJson } from "package-json-type";
import vinylFs from "vinyl-fs";

function bundleError(err: RollupError) {
  let errorMessage = "\n";
  Object.entries(err).forEach(([k, v]) => {
    if (typeof v !== "string") {
      v = JSON.stringify(v);
    }
    errorMessage += `
          * ${k}: ${v}
        `;
  });
  return errorMessage;
}

const __dirname = fileURLToPath(import.meta.url);
const rootPath = join(__dirname, "..");
const pkg: Required<IPackageJson> = fileSystem.readJSONSync(
  join(rootPath, "package.json")
);
let outputFile: string = "";
let external: string[] = [];
fileSystem
  .readJson(join(rootPath, "package.json"))
  .then(async (pkg: Required<IPackageJson>) => {
    outputFile = join(rootPath, pkg.main);
    external = ["fs-extra", "path"].concat(
      pkg.dependencies ? Object.keys(pkg.dependencies) : []
    );
    let bundle: RollupBuild;
    try {
      bundle = await rollup({
        input: join(rootPath, "lib", "generate-tscode-from-pug.ts"),
        plugins: [
          nodeResolve(),
          rollupTypescript({
            browserslist: false,
            tsconfig: join(rootPath, "tsconfig.json")
          })
        ],
        external
      });
      await (bundle as RollupBuild).write({
        file: outputFile,
        format: "es"
      });
    } catch (err: unknown) {
      const errorMessage = bundleError(err as RollupError);
      throw errorMessage;
    }
    if (bundle) {
      await (bundle as RollupBuild).close();
    }
  })

  .then(() => {
    return new Promise((resolve, reject) => {
      vinylFs
        .src(outputFile)
        .pipe(stripComments())
        .pipe(prettier())
        .pipe(vinylFs.dest(join(rootPath, "dist")))
        .on("error", reject)
        .on("end", resolve);
    });
  })
  .catch((err) => {
    throw err;
  })
  .then(() => {
    console.log("pug-ts has been successfully bundled. Thank you.");
  });
