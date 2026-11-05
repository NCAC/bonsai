/**
 * pnpm pug [--check] [--runtime <module>] <file.pug | dir>...
 *
 * Compiles each `*.template.pug` into the `*.template.ts` next to it. Without
 * paths, every template of the repository that git does not ignore.
 * `--check` compiles without writing and fails if a generated file is stale.
 */
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { execFileSync } from "node:child_process";
import minimist from "minimist";
import { compilePug, outputPath, PugError } from "./src/bonsai-pug";

const argv = minimist(process.argv.slice(2), { boolean: ["check"], string: ["runtime"] });
const roots: string[] = argv._.length > 0 ? argv._.map(String) : ["."];

/** Templates under `roots`: those git knows (tracked, or untracked and not ignored), else a directory walk. */
const discover = (paths: readonly string[]): string[] => {
  try {
    const listed = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", ...paths], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"]
    });
    return [...new Set(listed.split("\0"))].filter((f) => f.endsWith(".template.pug") && existsSync(f)).sort();
  } catch {
    const out: string[] = [];
    const SKIP = new Set(["node_modules", "dist", "coverage", ".git"]);
    const walk = (path: string): void => {
      if (statSync(path).isDirectory()) {
        for (const entry of readdirSync(path)) if (!SKIP.has(entry)) walk(join(path, entry));
      } else if (path.endsWith(".template.pug")) out.push(path);
    };
    for (const path of paths) walk(path);
    return out.sort();
  }
};
const files = discover(roots);

let failed = 0;
for (const file of files) {
  const target = outputPath(file);
  try {
    const code = compilePug(readFileSync(file, "utf-8"), { filename: file, runtime: argv.runtime });
    const current = existsSync(target) ? readFileSync(target, "utf-8") : null;
    if (argv.check) {
      if (current !== code) {
        failed++;
        console.error(`✗ ${relative(process.cwd(), target)} is stale: run pnpm pug`);
      }
    } else if (current !== code) {
      writeFileSync(target, code);
      console.log(`✓ ${relative(process.cwd(), target)}`);
    }
  } catch (e) {
    failed++;
    console.error(e instanceof PugError ? `✗ ${e.code} ${e.message}` : e);
  }
}
if (failed > 0) process.exit(1);
if (argv.check) console.log(`✓ ${files.length} template(s) up to date`);
