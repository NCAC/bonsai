import { join, dirname } from "node:path";
import prettyHrTime from "pretty-hrtime";
import fileSystem from "fs-extra";
import chalk from "chalk";
import { IPackageJson } from "package-json-type";
import { InputOptions, OutputOptions } from "rollup";
// import { set, get } from "lodash-es";

export class BuildTool {
  private static instance: BuildTool;
  private _rootPath: string;
  private _packageName: string;
  private _distPath: string;
  private _outJsFile: string;
  private _outDtsFile: string;
  private _srcFile: string;
  private _start: [number, number];
  private _pkg: IPackageJson;
  private _rollupOptions: {
    input: InputOptions;
    output: OutputOptions;
  };
  public static getInstance(rootPath?: string): BuildTool {
    if (!BuildTool.instance) {
      BuildTool.init(rootPath);
    }
    return BuildTool.instance;
  }
  public static async init(rootPath: string) {
    if (!BuildTool.instance) {
      const pkg = (await fileSystem.readJson(
        join(rootPath, "package.json")
      )) as IPackageJson;
      try {
        BuildTool.instance = new BuildTool(rootPath, pkg);
        return BuildTool.instance;
      } catch (error) {
        throw error;
      }
    }
  }
  private constructor(rootPath: string, pkg: IPackageJson) {
    this._pkg = pkg;
    this._packageName = pkg.name;
    this._rootPath = rootPath;
    this._distPath = join(rootPath, "dist");
    this._outJsFile = join(rootPath, pkg.main);
    this._outDtsFile = join(rootPath, pkg.types);
    this._srcFile = join(rootPath, pkg.src);
  }
  get rootPath() {
    return this._rootPath;
  }
  get packageName() {
    return this._packageName;
  }
  get distPath() {
    return this._distPath;
  }
  get outJsFile() {
    return this._outJsFile;
  }
  get outDtsFile() {
    return this._outDtsFile;
  }
  get srcFile() {
    return this._srcFile;
  }
  get start() {
    return this._start;
  }
  set start(time: [number, number]) {
    this._start = time;
  }

  get pkg() {
    return this._pkg;
  }

  // set(this: BuildTool, path: string, value: string) {
  //   set(this, path, value);
  // }
  // get(this: BuildTool, path: string) {
  //   return get(this, path);
  // }

  public log(...messages: string[]) {
    const args = Array.prototype.slice.call(arguments) as string[];
    const sig = chalk.green(this.packageName);
    args.unshift(sig);
    console.log.apply(console, args);
    return this;
  }

  public logError(...messages: string[]) {
    const args = Array.prototype.slice.call(arguments) as string[];
    const sig = chalk.green(this.packageName) + chalk.red("Error ! ");
    args.unshift(sig);
    console.trace.apply(console, args);
    return this;
  }

  public duration(start: [number, number]) {
    return chalk.magenta(prettyHrTime(process.hrtime(start)));
  }

  get rollupOptions() {
    return this._rollupOptions;
  }
  set rollupOptions(rollupOptions: {
    input: InputOptions;
    output: OutputOptions;
  }) {
    this._rollupOptions = rollupOptions;
  }
}

export type BuildToolTest = BuildTool & {
  test: {
    path: string;
    src: string;
    out: string;
  };
};