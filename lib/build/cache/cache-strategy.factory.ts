// Factory that instantiates the right cache strategy for a component type
import { BuildCache } from "@build/cache/build-cache.class";
import { PackageCache } from "@build/cache/package-cache.class";
import { ICacheStrategy } from "@build/cache/cache-strategy.interface";

export type CacheType = "library" | "package";

export class CacheStrategyFactory {
  // Singleton for the package cache
  private static packageCacheInstance: PackageCache | null = null;

  static create(type: CacheType): ICacheStrategy {
    if (type === "library") {
      // Use the singleton to guarantee a single cache
      return BuildCache.getLibraryCacheSingleton();
    }
    if (type === "package") {
      return PackageCache.me();
    }
    throw new Error(`Type de cache inconnu: ${type}`);
  }
}
