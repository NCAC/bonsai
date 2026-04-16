/**
 * Fonctions de validation du framework Bonsai.
 *
 * - `invariant()` : assertion runtime, strippable en prod via `__DEV__`
 * - `hardInvariant()` : assertion NON-strippable — erreurs structurelles fatales
 * - `warning()` : log conditionnel `__DEV__` only, ne throw jamais
 *
 * @see ADR-0004 — Validation Modes
 */

import { BonsaiError } from "./bonsai-error.class";

/**
 * Déclare la variable globale `__DEV__` injectée par le bundler.
 * En développement : `true`. En production : `false` (tree-shaken).
 */
declare const __DEV__: boolean;

/**
 * Retourne `true` si on est en mode développement.
 * Fallback : `true` si `__DEV__` n'est pas défini (sécurité — on préfère
 * montrer les erreurs plutôt que les masquer).
 */
function isDev(): boolean {
  try {
    return typeof __DEV__ !== "undefined" ? __DEV__ : true;
  } catch {
    return true;
  }
}

/**
 * Assertion runtime — throw `BonsaiError` si la condition est fausse.
 *
 * **Strippable en production** : les appels `invariant()` sont éliminés
 * par le bundler quand `__DEV__ === false`. Utiliser pour les validations
 * de développement (vérifications de type, gardes-fous DX).
 *
 * Pour les violations structurelles qui doivent rester en prod → `hardInvariant()`.
 *
 * @param condition - Si `false`, throw une `BonsaiError`
 * @param message - Message d'erreur descriptif
 * @param invariantId - Identifiant de l'invariant violé (ex: "I10")
 * @param component - Namespace ou nom du composant concerné (optionnel)
 *
 * @example
 * ```typescript
 * invariant(handlers.size === 0, "Duplicate command handler", "I10", "cart");
 * ```
 */
export function invariant(
  condition: unknown,
  message: string,
  invariantId: string = "",
  component: string = ""
): asserts condition {
  if (isDev()) {
    if (!condition) {
      throw new BonsaiError(message, invariantId, component);
    }
  }
}

/**
 * Assertion NON-strippable — reste en production.
 *
 * Utiliser pour les erreurs structurelles fatales détectées au bootstrap
 * (namespace dupliqué I21, handler Command dupliqué I10, etc.).
 * Un `hardInvariant` qui échoue signifie que le framework est dans un
 * état incohérent — il DOIT throw, même en production.
 *
 * @param condition - Si `false`, throw une `BonsaiError`
 * @param message - Message d'erreur descriptif
 * @param invariantId - Identifiant de l'invariant violé
 * @param component - Namespace ou nom du composant concerné (optionnel)
 */
export function hardInvariant(
  condition: unknown,
  message: string,
  invariantId: string = "",
  component: string = ""
): asserts condition {
  if (!condition) {
    throw new BonsaiError(message, invariantId, component);
  }
}

/**
 * Log conditionnel en développement — ne throw jamais.
 *
 * Strippé en production (`__DEV__ === false`).
 * Utiliser pour les avertissements non-bloquants (ex: `request()` sans replier en prod).
 *
 * @param condition - Si `false`, log un warning
 * @param message - Message d'avertissement
 */
export function warning(condition: unknown, message: string): void {
  if (isDev()) {
    if (!condition) {
      console.warn(`[Bonsai] ${message}`);
    }
  }
}
