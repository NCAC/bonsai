/**
 * @bonsai/feature — Types & runtime helpers for namespace authority
 *
 * Implémente la décision ADR-0039 : autorité, unicité et conformité des
 * namespaces de Feature.
 *
 * Trois rôles assumés par ce module :
 *   1. Types compile-time (`CamelCaseNamespace<S>`, `StrictManifest<M>`,
 *      `ValidatedManifest<M>`) qui encodent les invariants I68–I72.
 *   2. Constante framework `RESERVED_NAMESPACES` (I71) — non configurable
 *      par l'application.
 *   3. Filet de sécurité runtime (`assertValidNamespace`,
 *      `BonsaiNamespaceError`) pour les cas où le compile-time est contourné
 *      (cast `as any`, code JS, manifest dynamique).
 *
 * Invariants couverts :
 *   I21 (amendé) — namespace unique camelCase plat
 *   I24 (amendé) — Application valide format + réservés au bootstrap
 *   I57          — `local` réservé (ADR-0015)
 *   I68          — namespace porté par le manifest, pas par un `static`
 *   I69          — manifest = unique source de vérité de l'identité
 *   I70          — toute référence à un namespace externe DOIT être validée
 *   I71          — `RESERVED_NAMESPACES` est une constante framework
 *   I72          — `TSelfNS` doit correspondre à la clé du manifest
 *
 * @packageDocumentation
 */

import type { Entity, TJsonSerializable } from "@bonsai/entity";
import type { CamelCase } from "@bonsai/types";
import type { Feature } from "./bonsai-feature";

// ─── Mots réservés (I71, ADR-0015) ──────────────────────────────────────────

/**
 * Namespaces réservés par le framework — interdits à toute Feature applicative.
 *
 * Constante framework non configurable. Toute extension future
 * (`router`, `extensions`, …) se fera par modification de cette constante,
 * propagée par le typage dérivé.
 */
export const RESERVED_NAMESPACES = ["local"] as const;

/** Union des namespaces réservés (dérivée de la constante). */
export type ReservedNamespace = (typeof RESERVED_NAMESPACES)[number];

// ─── Compile-time camelCase enforcement ─────────────────────────────────────

/**
 * Alias local de `CamelCase` (ADR-0039 §Annexe — `CamelCaseNamespace<S>`).
 *
 * Le type générique vit dans `@bonsai/types` (réutilisable). Cet alias rend
 * lisible son rôle dans le contexte « namespace de Feature » et tient
 * la promesse de l'ADR sur le nom local.
 */
export type CamelCaseNamespace<S extends string> = CamelCase<S>;

// ─── Manifest types (ADR-0039 §Décision) ────────────────────────────────────

/**
 * Filtre du manifest : exclut les clés réservées au compile-time.
 *
 * `ValidatedManifest<M>` retire les entrées dont la clé est dans
 * `RESERVED_NAMESPACES`. Combiné à `StrictManifest<M>`, garantit qu'aucune
 * Feature applicative ne squatte un namespace framework.
 */
export type ValidatedManifest<M> = {
  [K in keyof M as K extends ReservedNamespace ? never : K]: M[K];
};

/**
 * Type structurel du value-manifest applicatif.
 *
 * Pour chaque clé `K` du type-manifest `M` :
 *   - `K` doit être camelCase plat (sinon `never` → erreur `satisfies`)
 *   - `K` ne doit pas être réservé (sinon `never`)
 *   - La valeur doit être un constructeur acceptant la clé `K` comme namespace
 *     ET produisant une `Feature<any, K>` — c'est ce qui force `TSelfNS === K`
 *     au compile-time (I72).
 *
 * Usage côté application :
 *
 * ```ts
 * const features = {
 *   cart: CartFeature,        // ✅
 *   user: UserFeature,        // ✅
 *   // local: BadFeature,     // ❌ never (réservé)
 *   // Cart: CartFeature,     // ❌ never (PascalCase)
 *   // user: CartFeature,     // ❌ TSelfNS "cart" ≠ "user"
 * } satisfies StrictManifest<AppManifest>;
 * ```
 */
export type StrictManifest<M> = {
  [K in keyof M & string]: K extends CamelCaseNamespace<K>
    ? K extends ReservedNamespace
      ? never
      : new (namespace: K) => Feature<Entity<TJsonSerializable>, K>
    : never;
};

// ─── Erreur typée (ADR-0039 §Décision — Filet de sécurité runtime) ──────────

/**
 * Codes d'erreur stables pour les violations de l'invariant namespace.
 *
 * `NAMESPACE_DUPLICATE` est théoriquement impossible avec un manifest
 * (TS1117 le détecte), mais reste levé par le filet runtime au cas où le
 * manifest serait construit dynamiquement.
 */
export type TBonsaiNamespaceErrorCode =
  | "NAMESPACE_INVALID_FORMAT"
  | "NAMESPACE_RESERVED"
  | "NAMESPACE_DUPLICATE"
  | "NAMESPACE_UNKNOWN_REFERENCE";

/**
 * Erreur typée pour toute violation détectée au runtime.
 *
 * Étend la hiérarchie d'erreurs framework évoquée par ADR-0003
 * (`BonsaiRegistryError`). Les codes sont stables et destinés à être
 * matchables par les consommateurs.
 */
export class BonsaiNamespaceError extends Error {
  readonly code: TBonsaiNamespaceErrorCode;

  constructor(code: TBonsaiNamespaceErrorCode, message: string) {
    super(`[Bonsai] ${code}: ${message}`);
    this.name = "BonsaiNamespaceError";
    this.code = code;
  }
}

// ─── Filet runtime ──────────────────────────────────────────────────────────

const CAMEL_CASE_REGEX = /^[a-z][a-zA-Z]*$/;

/** Test runtime du format camelCase. */
export function isCamelCaseNamespace(ns: string): boolean {
  return CAMEL_CASE_REGEX.test(ns);
}

/** Test runtime de réservation. */
export function isReservedNamespace(ns: string): ns is ReservedNamespace {
  return (RESERVED_NAMESPACES as readonly string[]).includes(ns);
}

/**
 * Filet de sécurité — vérifie format + réservation au runtime.
 *
 * Appelé par le constructeur de `Feature` (immuabilité dès construction) et
 * par `Application.start()` (validation du manifest entier). Lève
 * `BonsaiNamespaceError` avec un code stable.
 */
export function assertValidNamespace(ns: string): void {
  if (typeof ns !== "string" || ns.length === 0) {
    throw new BonsaiNamespaceError(
      "NAMESPACE_INVALID_FORMAT",
      `Namespace must be a non-empty string, received: ${String(ns)}`
    );
  }
  if (!isCamelCaseNamespace(ns)) {
    throw new BonsaiNamespaceError(
      "NAMESPACE_INVALID_FORMAT",
      `Namespace "${ns}" must be camelCase (lowercase first letter, letters only)`
    );
  }
  if (isReservedNamespace(ns)) {
    throw new BonsaiNamespaceError(
      "NAMESPACE_RESERVED",
      `Namespace "${ns}" is reserved by the framework`
    );
  }
}
