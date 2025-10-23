// Factory pour instancier la bonne stratégie de cache selon le type de composant
import { BuildCache } from "@build/cache/build-cache.class";
import { PackageCache } from "@build/cache/package-cache.class";
import { ICacheStrategy } from "@build/cache/cache-strategy.interface";

export type CacheType = "library" | "package";

export class CacheStrategyFactory {
  // Singleton pour le cache package
  private static packageCacheInstance: PackageCache | null = null;

  static create(type: CacheType): ICacheStrategy {
    if (type === "library") {
      // Utiliser le singleton pour garantir l'unicité du cache
      return BuildCache.getLibraryCacheSingleton();
    }
    if (type === "package") {
      return PackageCache.me();
    }
    throw new Error(`Type de cache inconnu: ${type}`);
  }
}
