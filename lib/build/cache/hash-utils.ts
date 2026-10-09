// 1. Node.js standard library
import { createHash } from "node:crypto";
// 2. External dependencies
import fs from "fs-extra";

/**
 * Computes the hash of a file's content
 *
 * @param filePath File path
 * @returns Content hash
 */
export function hashFileContent(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return createHash("md5").update(content).digest("hex");
}

/**
 * Computes the hash of a string
 *
 * @param content Content to hash
 * @returns Content hash
 */
export function hashString(content: string): string {
  return createHash("md5").update(content).digest("hex");
}

/**
 * Computes the hash of an object
 *
 * @param obj Object to hash
 * @returns Hash de l'objet
 */
export function hashObject(obj: any): string {
  const content = JSON.stringify(obj, Object.keys(obj).sort());
  return hashString(content);
}

/**
 * Builds a cache key from a package name and a file path
 *
 * @param packageName Package name
 * @param filePath File path
 * @param suffix Suffixe optionnel (ex: "js", "dts")
 * @returns Cache key
 */
export function generateCacheKey(
  packageName: string,
  filePath: string,
  suffix?: string
): string {
  const baseKey = `${packageName}:${filePath}`;
  return suffix ? `${baseKey}:${suffix}` : baseKey;
}

/**
 * Checks whether a file changed since the last build
 *
 * @param filePath File path
 * @param previousHash Previous hash
 * @returns true when the file changed
 */
export function isFileModified(
  filePath: string,
  previousHash?: string
): boolean {
  if (!previousHash || !fs.existsSync(filePath)) {
    return true;
  }

  const currentHash = hashFileContent(filePath);
  return currentHash !== previousHash;
}
