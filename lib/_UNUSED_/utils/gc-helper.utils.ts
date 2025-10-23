/**
 * Déclare l'interface globale pour TypeScript avec le collecteur de déchets
 * Le type correct est utilisé pour éviter les conflits avec les définitions de Node.js
 */
declare global {
  // Réutilise le type existant au lieu de le redéclarer
  // var gc: (() => void) | undefined;
}

/**
 * Force une collecte des déchets si disponible
 * @returns {boolean} True si la collecte des déchets a été effectuée, false sinon
 */
export function forceGarbageCollection(): boolean {
  if (global.gc) {
    console.log("[Memory] Forçage de la collecte des déchets...");
    global.gc();
    return true;
  } else {
    console.log(
      "[Memory] La collecte des déchets explicite n'est pas disponible. Exécutez avec: tsx --expose-gc ./lib/build.ts"
    );
    return false;
  }
}

/**
 * Force une collecte de déchets avec plusieurs cycles pour maximiser l'effet
 * @param {string} packageName - Nom du package pour le logging
 * @returns {boolean} True si la collecte des déchets a été effectuée, false sinon
 */
export function forceAggressiveGarbageCollection(packageName: string): boolean {
  if (global.gc) {
    console.log(
      `[Memory] Exécution d'un premier cycle de GC pour ${packageName}`
    );
    global.gc();

    // Exécuter un second cycle de GC (peut aider à libérer plus de mémoire)
    console.log(
      `[Memory] Exécution d'un second cycle de GC pour ${packageName}`
    );
    global.gc();

    const memoryUsage = process.memoryUsage();
    const heapUsed = memoryUsage.heapUsed / 1024 / 1024;
    console.log(`[Memory] Après GC: Heap Used: ${heapUsed.toFixed(2)}MB`);
    return true;
  } else {
    console.log(
      "[Memory] La collecte des déchets explicite n'est pas disponible. Exécutez avec: tsx --expose-gc ./lib/build.ts"
    );
    return false;
  }
}

/**
 * Affiche un message sur la disponibilité du collecteur de déchets
 */
export function checkGCAvailability(): void {
  if (global.gc) {
    console.log(
      "[Memory] Collecteur de déchets explicite disponible (--expose-gc)"
    );
  } else {
    console.log(
      "[Memory] ATTENTION: Collecteur de déchets explicite NON disponible"
    );
    console.log(
      "[Memory] Pour de meilleures performances, exécutez avec: tsx --expose-gc ./lib/build.ts"
    );
  }
}
