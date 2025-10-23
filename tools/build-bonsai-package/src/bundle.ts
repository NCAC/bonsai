import {
  rollup,
  InputOptions,
  OutputOptions,
  RollupBuild,
  Plugin
} from "rollup";
import fileSystem from "fs-extra";
import { BuildTool, BuildToolTest } from "./build-tool-class";

export async function bundle(
  buildTool: BuildTool | BuildToolTest,
  path: string,
  rollupOptions: BuildTool["rollupOptions"]
): Promise<void> {
  let bundle: RollupBuild;
  try {
    await fileSystem.ensureDir(path);
    bundle = await rollup(rollupOptions.input);
    await (bundle as RollupBuild).write(rollupOptions.output);
  } catch (error) {
    let errorMessage = "\n";
    Object.entries(error).forEach(([k, v]) => {
      if (typeof v !== "string") {
        v = JSON.stringify(v);
      }
      errorMessage += `
          * ${k}: ${v}
        `;
    });
    buildTool.logError(errorMessage);
  }
  if (bundle) {
    await (bundle as RollupBuild).close();
  }
}