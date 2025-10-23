import { join, basename } from "node:path";
import fileSystem from "fs-extra";
import chalk from "chalk";

import { BuildEventManager } from "./BuildEventManager.js";

import {
  getBuildInfos,
  TBuildInfos,
  // TBuildInfo,
  TPaths,
  TJsBuildInfo
} from "./get-build-infos.js";
import { isNonNull } from "remeda";

export class BuildStoreConfig {
  private static _instance: BuildStoreConfig;
  private _events!: BuildEventManager;

  public static getInstance(): BuildStoreConfig {
    return BuildStoreConfig._instance;
  }

  public get events() {
    return this._events;
  }
  private _watchers: TBuildInfos["filesToWatch"];
  public get watchers() {
    return this._watchers;
  }
  private _filesToBuild: TBuildInfos["filesToBuild"];
  public get filesToBuild() {
    return this._filesToBuild;
  }
  private _appVersion: string;
  get appVersion() {
    return this._appVersion;
  }
  private _versionHeader: string;
  public get versionHeader() {
    return this._versionHeader;
  }

  public static async init(rootPath: string) {
    if (!BuildStoreConfig._instance) {
      try {
        const buildInfos = await getBuildInfos();
        BuildStoreConfig._instance = new BuildStoreConfig(buildInfos);
        const buildStoreConfig = BuildStoreConfig._instance;
        buildStoreConfig._events = new BuildEventManager();
        return buildStoreConfig;
      } catch (error) {
        throw error;
      }
    }
    return BuildStoreConfig._instance;
  }

  private _paths: TPaths;
  get paths() {
    return this._paths;
  }

  private constructor(buildInfos: TBuildInfos) {
    this._paths = buildInfos.paths;
    this._appVersion = `dartycuisine-v${buildInfos.version}`;
    this._versionHeader = `
/**
 * ${this._appVersion}
 */

`;
    this._filesToBuild = {
      css: buildInfos.filesToBuild.css,
      js: buildInfos.filesToBuild.js
    };
    this._watchers = buildInfos.filesToWatch;
    // if (buildInfos.filesToBuild.js) {
    //   this.setJsBuildData(buildInfos.filesToBuild.js);
    // }
  }

  public watch() {
    if (isNonNull(this._filesToBuild.css)) {
      this._watchers.css.on("change", (updatedPath: string) => {
        this._events.emit("css:updated", updatedPath);
      });
    }
    if (isNonNull(this._filesToBuild.js.frontEnd)) {
      this._watchers.frontEndJs.on("change", (updatedPath: string) => {
        this._events.emit("js:front:updated", updatedPath);
      });
    }
    if (isNonNull(this._filesToBuild.js.ambianceur)) {
      this._watchers.ambianceurJs.on("change", (updatedPath: string) => {
        console.log(updatedPath + " has been updated !");
        this._events.emit("js:ambianceur:updated", updatedPath);
      });
    }

  }

  public log(...messages: string[]) {
    const args = Array.prototype.slice.call(arguments) as string[];
    const sig = chalk.green("[BONSAI PACKAGE] ");
    args.unshift(sig);
    console.log.apply(console, args);
    return this;
  }

  public logError(...messages: string[]) {
    const args = Array.prototype.slice.call(arguments) as string[];
    const sig = `${chalk.green("[BONSAI PACKAGE] ")} ${chalk.red("Error !")}`;
    args.unshift(sig);
    console.trace.apply(console, args);
    return this;
  }
}
