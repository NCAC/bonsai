import { join, relative, dirname, basename } from "node:path";
import slash from "slash";
import fileSystem from "fs-extra";

import { FSWatcher, WatchOptions, watch } from "chokidar";
import { IPackageJson } from "package-json-type";
import { load as yamlLoad } from "js-yaml";
import { InputOptions, OutputOptions, RollupOptions, RollupLog } from "rollup";
import rollupTypescript from "rollup-plugin-ts";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import alias, { RollupAliasOptions } from "@rollup/plugin-alias";
import commonJs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";

import { isDefined } from "remeda";


function onwarn({ loc, frame, message }: RollupLog) {
  if (loc) {
    console.warn(`${loc.file} (${loc.line}:${loc.column}) ${message}`);
    if (frame) console.warn(frame);
  } else {
    console.warn(message);
  }
}

//#region types
export type TPaths = {
  root: string;
  dist: string;
  outJs: string;
  outDts: string;
  src: string;
};



export type TBaseBuildInfo = {
  name: string;
  inputFile: string;
  outputFileBaseName: string;
  outputPath: string;
  outputFile: string;
};

export type TBuildInfo = TBaseBuildInfo & {
  watch: string[];
};

export type TJsBuildInfo = TBuildInfo & {
  rollupOptions: {
    input: InputOptions;
    output: OutputOptions;
  };
};

export type TFilesToBuild = {
  css: TBuildInfo[];
  js: Partial<{
    frontEnd: TBuildInfo;
    ambianceur: TBuildInfo;
  }>;
};

export type TBuildInfos = {
  version: string;
  filesToWatch: TFilesToWatch;
  filesToBuild: TFilesToBuild;
  paths: TPaths;
};
//#endregion

//#region paths
export async function getPaths(): Promise<TPaths> {
  const root = process.cwd();
  try {
    const packageJsonFile = await fileSystem.readJson(join(rootPath, "package.json")) as IPackageJson;
    const dist = join(root, "dist");
    const outJs = join(root, <string>packageJsonFile.main);
    const outDts = join(root, <string>packageJsonFile.types);
    const src = join(root, <string>packageJsonFile.src);
    return {
      root,
      dist,
      outJs,
      outDts,
      src
    }
  } catch (error) {
    throw error;
  }
}
//#endregion

//#region filesToBuild
export async function getFilesToBuild(paths: TPaths): Promise<{
  css: TBuildInfo[];
  js: Partial<{ frontEnd: TBuildInfo; ambianceur: TBuildInfo }>;
}> {
  try {
    const buildYamlFile = await fileSystem.readFile(
      join(paths.root, "dev-tools", "cuisine", "build.yaml"),
      "utf-8"
    );
    const buildJson = yamlLoad(buildYamlFile) as {
      css: TBuildInfo[];
      js: TBuildInfo[];
    };

    let cssToBuild: TBuildInfo[] = [];

    if (buildJson.css) {
      cssToBuild = [];
      buildJson.css.forEach((value: TBuildInfo) => {
        cssToBuild.push({
          name: value.name,
          inputFile: value.inputFile,
          outputFileBaseName: value.outputFileBaseName,
          outputPath: value.outputPath,
          outputFile: value.outputFile,
          watch: value.watch.map((watchPath) => {
            return `${watchPath}/**/*.scss`;
          })
        });
      });
    }
    const jsToBuild: Partial<{
      frontEnd: TJsBuildInfo;
      ambianceur: TJsBuildInfo;
    }> = {};
    buildJson.js.forEach((jsBuild) => {
      if ("frontEnd" === jsBuild.name) {
        jsToBuild.frontEnd = getFrontEndJsFilesToBuild(paths, jsBuild);
      } else if ("ambianceur" == jsBuild.name) {
        jsToBuild.ambianceur = getAmbianceurJsFilesToBuild(paths, jsBuild);
      }
    });

    return { css: cssToBuild, js: jsToBuild };
  } catch (err) {
    throw err;
  }
}

export function getFrontEndJsFilesToBuild(paths: TPaths, jsData: TBuildInfo) {
  const name = jsData.name;
  const inputFile = jsData.inputFile;
  const outputFileBaseName = jsData.outputFileBaseName;
  const outputPath = jsData.outputPath;
  const outputFile = jsData.outputFile;
  const watch = jsData.watch.map((watchPath) => {
    return `${watchPath}/**/*.{ts,js,pug,json}`;
  });
  const themeComponentsPath = paths.frontTheme.components;
  const moduleCustomPath = paths.modulesCustom;
  const aliases: RollupAliasOptions = {
    entries: [
      {
        find: "window",
        replacement: join(themeComponentsPath, "@types", "window.d.ts")
      },
      {
        find: "IScroll",
        replacement: join(themeComponentsPath, "IScroll", "IScroll.js")
      },
      {
        find: /^@cuisine_app\/(.+)$/,
        replacement: join(themeComponentsPath, "App", "$1")
      },
      {
        find: /^@cuisine_root\/(.+)$/,
        replacement: join(themeComponentsPath, "$1")
      },
      {
        find: /^@cuisine_home\/(.+)$/,
        replacement: join(
          <string>moduleCustomPath.get("cuisine_homepage"),
          "components",
          "$1"
        )
      },
      {
        find: /^@cuisine_gem\/(.+)$/,
        replacement: join(
          <string>moduleCustomPath.get("cuisine_blocks"),
          "modules",
          "gem_block",
          "components",
          "$1"
        )
      },
      {
        find: /^@cuisine_body(.+)$/,
        replacement: join(themeComponentsPath, "Body", "$1")
      },
      {
        find: /^@cuisine_fiche\/(.+)$/,
        replacement: join(
          <string>moduleCustomPath.get("cuisine_fiche"),
          "components",
          "$1"
        )
      },
      {
        find: /^@cuisine_diapo\/(.+)$/,
        replacement: join(themeComponentsPath, "Diapo", "$1")
      },

      {
        find: /^@cuisine_header\/(.+)/,
        replacement: join(
          <string>moduleCustomPath.get("cuisine_header"),
          "components",
          "$1"
        )
      },
      {
        find: /^@cuisine_iScroll\/(.+)/,
        replacement: join(themeComponentsPath, "IScroll", "$1")
      },
      {
        find: /^@cuisine_listeCuisines\/(.+)/,
        replacement: join(themeComponentsPath, "ListeCuisines", "$1")
      },
      {
        find: /^@cuisine_main\/(.+)/,
        replacement: join(themeComponentsPath, "Main", "$1")
      },
      {
        find: /^@cuisine_opSpeciale\/(.+)/,
        replacement: join(themeComponentsPath, "OperationSpeciale", "$1")
      },
      {
        find: /^@cuisine_page\/(.+)/,
        replacement: join(themeComponentsPath, "Page", "$1")
      },

      {
        find: /^@cuisine_userActions\/(.+)/,
        replacement: join(themeComponentsPath, "UserActions", "$1")
      },
      {
        find: /^breakpointsDatas/,
        replacement: join(themeComponentsPath, "breakpointsDatas.json")
      }
    ]
  };
  const inputOptions: InputOptions = {
    input: join(paths.root, (jsData as unknown as TBuildInfo).inputFile),
    onwarn,
    external: ["window", "AMBIANCEUR_API_URL"],
    plugins: [
      alias(aliases),
      marionextPugPlugin({
        sourceMap: false,
        marionextModuleName: "marionext"
      }),
      json({
        indent: " ",
        compact: true
      }),
      nodeResolve({
        extensions: [".json", ".js"],
        preferBuiltins: true
      }),
      commonJs(),
      rollupTypescript({
        // transpiler: "babel",
        tsconfig: join(paths.root, "tsconfig.json"),
        browserslist: false
      })
    ]
  };
  const outputOptions: OutputOptions = {
    file: join(paths.root, (jsData as unknown as TBuildInfo).outputFile),
    format: "iife",
    esModule: false,
    interop: "auto",
    globals: {
      window: "window"
    }
  };
  return {
    name,
    inputFile,
    outputFileBaseName,
    outputPath,
    outputFile,
    watch,
    rollupOptions: {
      input: inputOptions,
      output: outputOptions
    }
  };
}

export function getAmbianceurJsFilesToBuild(paths: TPaths, jsData: TBuildInfo) {
  const name = jsData.name;
  const inputFile = jsData.inputFile;
  const outputFileBaseName = jsData.outputFileBaseName;
  const outputPath = jsData.outputPath;
  const outputFile = jsData.outputFile;
  const watch = jsData.watch.map((watchPath) => {
    return `${watchPath}/**/*.{ts,js,pug,json}`;
  });
  const inputOptions: InputOptions = {
    input: join(paths.root, (jsData as unknown as TBuildInfo).inputFile),
    onwarn,
    external: ["window"],
    plugins: [
      json({
        indent: " ",
        compact: true
      }),
      nodeResolve({
        extensions: [".json", ".js"],
        preferBuiltins: true
      }),
      commonJs(),
      rollupTypescript({
        // transpiler: "babel",
        tsconfig: join(paths.root, "tsconfig.json"),
        browserslist: false
      })
    ]
  };
  const outputOptions: OutputOptions = {
    file: join(paths.root, (jsData as unknown as TBuildInfo).outputFile),
    format: "iife",
    esModule: false,
    interop: "auto",
    globals: {
      window: "window"
    }
  };
  return {
    name,
    inputFile,
    outputFileBaseName,
    outputPath,
    outputFile,
    watch,
    rollupOptions: {
      input: inputOptions,
      output: outputOptions
    }
  };
}
//#endregion

//#region filesToWatch
export type TFilesToWatch = {
  css: FSWatcher;
  frontEndJs: FSWatcher;


};

export function getFilesToWatch(
  paths: TPaths,
  filesToBuild: {
    css: TBuildInfo[];
    js: Partial<{ frontEnd: TBuildInfo; ambianceur: TBuildInfo }>;
  }
): TFilesToWatch {
  const watcherOptions: WatchOptions = { cwd: paths.root };

  let cssWatched: string[] = [];
  filesToBuild.css.forEach((value: TBuildInfo) => {
    cssWatched = cssWatched.concat(value.watch);
  });
  const cssPathsToWatch = watch(cssWatched, watcherOptions);
  const frontEndJsWatched: string[] = isDefined(filesToBuild.js.frontEnd)
    ? filesToBuild.js.frontEnd?.watch
    : [];
  const ambianceurJsWatched: string[] = isDefined(filesToBuild.js.ambianceur)
    ? filesToBuild.js.ambianceur.watch
    : [];

  const frontEndJsToWatch = watch(frontEndJsWatched, watcherOptions);
  const ambianceurJsPathsToWatch = watch(ambianceurJsWatched, watcherOptions);

  let phpTwigPaths: string[] = [];
  [...paths.modulesCustom].forEach((modulePath) => {
    const baseModulePath: string = slash(
      relative(paths.root, Object.values(modulePath)[0])
    );
    phpTwigPaths.push(`${baseModulePath}/**/*.{module,php,inc,twig}`);
  });
  phpTwigPaths.push(
    `${slash(
      relative(paths.root, paths.frontTheme.components)
    )}/**/*.{theme,php,inc,twig}`
  );
  phpTwigPaths.push("sites/default/*.{php,sh,yml}");
  const phpTwigPathsToWatch = watch(phpTwigPaths, watcherOptions);

  return {
    css: cssPathsToWatch,
    frontEndJs: frontEndJsToWatch,
    ambianceurJs: ambianceurJsPathsToWatch,
    twigPhp: phpTwigPathsToWatch
  };
}
//#endregion

//#region buildInfos
export async function getBuildInfos(): Promise<TBuildInfos> {
  try {
    const paths = await getPaths();
    const buildYamlFile = await fileSystem.readFile(
      join(paths.root, "dev-tools", "cuisine", "build.yaml"),
      "utf-8"
    );
    const buildJson = yamlLoad(buildYamlFile) as {
      version: string;
    };
    const version = buildJson.version;
    const filesToBuild = await getFilesToBuild(paths);
    const filesToWatch = getFilesToWatch(paths, filesToBuild);
    return {
      version,
      paths,
      filesToWatch,
      filesToBuild
    };
  } catch (error) {
    throw error;
  }
}
//#endregion
