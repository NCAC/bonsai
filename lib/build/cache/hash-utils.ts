// 1. Bibliothèques standard Node.js
import { createHash } from "node:crypto";
// 2. Dépendances externes
import fs from "fs-extra";

/**
 * Calcule le hash du contenu d'un fichier
 *
 * @param filePath Chemin du fichier
 * @returns Hash du contenu
 */
export function hashFileContent(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return createHash("md5").update(content).digest("hex");
}

/**
 * Calcule le hash d'une chaîne
 *
 * @param content Contenu à hacher
 * @returns Hash du contenu
 */
export function hashString(content: string): string {
  return createHash("md5").update(content).digest("hex");
}

/**
 * Calcule le hash d'un objet
 *
 * @param obj Objet à hacher
 * @returns Hash de l'objet
 */
export function hashObject(obj: any): string {
  const content = JSON.stringify(obj, Object.keys(obj).sort());
  return hashString(content);
}

/**
 * Génère une clé de cache à partir d'un nom de package et d'un chemin de fichier
 *
 * @param packageName Nom du package
 * @param filePath Chemin du fichier
 * @param suffix Suffixe optionnel (ex: "js", "dts")
 * @returns Clé de cache
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
 * Vérifie si un fichier a été modifié depuis le dernier build
 *
 * @param filePath Chemin du fichier
 * @param previousHash Hash précédent
 * @returns true si le fichier a été modifié
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
