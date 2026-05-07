/**
 * @bonsai/error - Version 0.1.0
 * Bundled by Bonsai Build System
 * Date: 2026-05-07T09:44:37.575Z
 */
/**
 * BonsaiError — Classe de base pour toutes les erreurs structurées du framework.
 *
 * Chaque erreur Bonsai fournit :
 * - `invariantId` : identifiant de l'invariant ou ADR violé (ex: "I10", "ADR-0002")
 * - `component` : namespace ou nom du composant concerné
 * - `suggestion` : message actionnable pour le développeur
 *
 * @see ADR-0002 — Error Propagation Strategy (taxonomie complète)
 */
class BonsaiError extends Error {
    constructor(message, invariantId, component = "", suggestion = "") {
        super(`[${invariantId}]${component ? ` ${component}` : ""} — ${message}${suggestion ? `\n  → ${suggestion}` : ""}`);
        this.invariantId = invariantId;
        this.component = component;
        this.suggestion = suggestion;
        this.name = "BonsaiError";
    }
}
// ═══════════════════════════════════════════════════════════════
// Entity Layer (State)
// ═══════════════════════════════════════════════════════════════
/**
 * Recipe `mutate()` a throw → Immer rollback automatique, state intact.
 */
class MutationError extends BonsaiError {
    constructor() {
        super(...arguments);
        this.name = "MutationError";
    }
}
// ═══════════════════════════════════════════════════════════════
// Feature Layer (Logic)
// ═══════════════════════════════════════════════════════════════
/**
 * `onXxxCommand()` handler a throw.
 */
class CommandError extends BonsaiError {
    constructor() {
        super(...arguments);
        this.name = "CommandError";
    }
}
/**
 * `onXxxRequest()` handler a throw ou reject.
 */
class RequestError extends BonsaiError {
    constructor() {
        super(...arguments);
        this.name = "RequestError";
    }
}
/**
 * `onXxxEntityUpdated()` handler a throw — state conservé, notification continue.
 */
class BroadcastError extends BonsaiError {
    constructor() {
        super(...arguments);
        this.name = "BroadcastError";
    }
}
// ═══════════════════════════════════════════════════════════════
// Channel Layer (Communication)
// ═══════════════════════════════════════════════════════════════
/**
 * Event listener a throw — erreur isolée, les autres listeners continuent.
 */
class ListenerError extends BonsaiError {
    constructor() {
        super(...arguments);
        this.name = "ListenerError";
    }
}
/**
 * `trigger()` sans `handle()` enregistré, ou `request()` sans `reply()`.
 */
class NoHandlerError extends BonsaiError {
    constructor() {
        super(...arguments);
        this.name = "NoHandlerError";
    }
}
/**
 * `handle()` ou `reply()` appelé deux fois pour le même message (I10).
 */
class DuplicateHandlerError extends BonsaiError {
    constructor() {
        super(...arguments);
        this.name = "DuplicateHandlerError";
    }
}
// ═══════════════════════════════════════════════════════════════
// View Layer (UI)
// ═══════════════════════════════════════════════════════════════
/**
 * Projection ou template a throw.
 */
class RenderError extends BonsaiError {
    constructor() {
        super(...arguments);
        this.name = "RenderError";
    }
}
/**
 * Behavior a throw.
 */
class BehaviorError extends BonsaiError {
    constructor() {
        super(...arguments);
        this.name = "BehaviorError";
    }
}

/**
 * Fonctions de validation du framework Bonsai.
 *
 * - `invariant()` : assertion runtime, strippable en prod via `__DEV__`
 * - `hardInvariant()` : assertion NON-strippable — erreurs structurelles fatales
 * - `warning()` : log conditionnel `__DEV__` only, ne throw jamais
 *
 * @see ADR-0004 — Validation Modes
 */
/**
 * Retourne `true` si on est en mode développement.
 * Fallback : `true` si `__DEV__` n'est pas défini (sécurité — on préfère
 * montrer les erreurs plutôt que les masquer).
 */
function isDev() {
    try {
        return typeof __DEV__ !== "undefined" ? __DEV__ : true;
    }
    catch {
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
function invariant(condition, message, invariantId = "", component = "") {
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
function hardInvariant(condition, message, invariantId = "", component = "") {
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
function warning(condition, message) {
    if (isDev()) {
        if (!condition) {
            console.warn(`[Bonsai] ${message}`);
        }
    }
}

export { BehaviorError, BonsaiError, BroadcastError, CommandError, DuplicateHandlerError, ListenerError, MutationError, NoHandlerError, RenderError, RequestError, hardInvariant, invariant, warning };
