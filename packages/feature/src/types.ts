/**
 * @bonsai/feature — Types & runtime helpers
 *
 * Implémente :
 *   - ADR-0039 : autorité, unicité et conformité des namespaces de Feature.
 *   - ADR-0042 : pattern modulaire de contrat consommateur — `TFeatureContract`
 *     Feature-groupé + helpers d'aplatissement (`TFlatListens`, `TFlatTriggers`,
 *     `TFlatRequests`) + extracteurs de payload (`TEventPayloadFor`,
 *     `TCommandPayloadFor`, `TRequestParamsFor`, `TRequestResultFor`) +
 *     `TChannelCallbacks` (handlers requis dérivés du contrat).
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
 *   I81 (ADR-0042) — `get features()` est la source de vérité runtime
 *   I82 (ADR-0042) — `implements TViewCallbacks<TVC>` impose les handlers
 *   I83 (ADR-0042) — pattern modulaire `T{Component}Contract` réutilisable
 *   I87 (ADR-0042) — clé d'objet ≡ namespace de la Feature référencée
 *   I88 (ADR-0042) — symétrie Contract/Callbacks
 *
 * @packageDocumentation
 */

import type { Entity, TJsonSerializable } from "@bonsai/entity";
import type { TChannelDefinition, TChannelToken } from "@bonsai/event";
import type { CamelCase, UnionToIntersection } from "@bonsai/types";
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

/**
 * Contrainte compile-time d'une classe Feature enregistrable dans un manifest.
 *
 * Exige (ADR-0046 — M3, I95 reformulé) :
 *   - Un constructeur `(namespace: TNS) => Feature<…, TDef, TNS>` — force
 *     `TSelfNS === TNS` (I72).
 *   - Un membre statique `channel: TChannelToken<TDef, TNS>` — présence ET
 *     alignement `channel.namespace === TNS` au compile-time (I73/I74/I22).
 *
 * **La couverture des handlers n'est PAS imposée ici** (ADR-0046 §Décision) :
 * un manifest type-only à valeurs `unknown` (ADR-0039) ne permet pas d'extraire
 * `TDef` par clé, donc aucune inférence de handlers n'est possible au point
 * manifest. La couverture est garantie par I92 (`implements TFeatureCallbacks`
 * sur chaque classe — symétrie View/ADR-0042) + filet runtime auto-discovery.
 *
 * @example
 * ```ts
 * // ✅ CartFeature satisfait TStrictFeatureClass<"cart">
 * // ❌ Classe sans static channel → erreur compile
 * // ❌ channel.namespace ≠ "cart" → erreur compile
 * ```
 */
export type TStrictFeatureClass<
  TNS extends string,
  TDef extends TChannelDefinition = TChannelDefinition
> = (new (
  namespace: TNS
) => Feature<Entity<TJsonSerializable>, TDef, TNS>) & {
  readonly channel: TChannelToken<TDef, TNS>;
};

export type StrictManifest<M> = {
  [K in keyof M & string]: K extends CamelCaseNamespace<K>
    ? K extends ReservedNamespace
      ? never
      : TStrictFeatureClass<K, TChannelDefinition>
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
  | "NAMESPACE_UNKNOWN_REFERENCE"
  | "FEATURE_MISSING_CHANNEL"
  | "FEATURE_CHANNEL_NAMESPACE_MISMATCH";

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

// ─── Pattern consommateur modulaire (ADR-0042) ──────────────────────────────

/**
 * Contrainte structurelle minimale pour toute Feature référençable par un
 * composant consommateur (View, Composer, Behavior).
 *
 * En pratique : `typeof CartFeature` (constructeur avec `static readonly channel`)
 * satisfait ce type. Le Channel reste privé — seul son token est exposé.
 *
 * I80 — aucun consommateur ne référence `TChannelToken` directement.
 */
export type TFeatureRef<
  TDef extends TChannelDefinition = TChannelDefinition,
  TNS extends string = string
> = { readonly channel: TChannelToken<TDef, TNS> };

/**
 * `TFeatureRef` contraint à un namespace donné (ADR-0042 C10, I87).
 *
 * Utilisé par `TFeatureContract` pour imposer compile-time que la clé d'objet
 * (`cart`, `user`) corresponde au namespace de la Feature référencée :
 *
 * ```ts
 * const features = {
 *   cart: { feature: UserFeature, ... },  // ❌ erreur compile — "cart" ≠ "user"
 * } satisfies TFeatureContract;
 * ```
 */
export type TFeatureRefForNS<NS extends string> = TFeatureRef<
  TChannelDefinition,
  NS
>;

/**
 * Module contractuel Feature — Feature-groupé (ADR-0042).
 *
 * Une entrée par Feature consommée. La clé d'objet DOIT correspondre au
 * namespace de la Feature référencée par `feature` (validation par
 * `TFeatureRefForNS<NS>` — I87).
 *
 * Pour chaque Feature :
 *   - `feature`  : ref runtime (`typeof XxxFeature`) — extrait
 *                  channel/events/commands/requests via le token
 *   - `listens`  : noms d'events sans préfixe namespace (la clé EST le NS)
 *   - `triggers` : noms de commands sans préfixe namespace
 *   - `requests` : noms de requests sans préfixe namespace
 *
 * Le mapped type `[NS in string]` capture chaque clé littérale et instancie
 * `TFeatureRefForNS<NS>` per-key — c'est ce qui produit l'erreur compile
 * sur incohérence clé/namespace.
 *
 * Usage :
 *
 * ```ts
 * const cartViewFeatures = {
 *   cart: {
 *     feature:  CartFeature,
 *     listens:  ["itemAdded"]  as const,
 *     triggers: ["addItem"]    as const,
 *     requests: []             as const,
 *   },
 *   user: {
 *     feature:  UserFeature,
 *     listens:  ["profileUpdated"] as const,
 *     triggers: []                 as const,
 *     requests: ["getProfile"]     as const,
 *   },
 * } satisfies TFeatureContract;
 * ```
 *
 * I81 — source de vérité runtime du composant consommateur.
 * I83 — module réutilisable par View / Composer / Behavior.
 * I87 — clé ≡ namespace, contrôle compile-time.
 */
export type TFeatureContract = {
  readonly [NS in string]: {
    readonly feature: TFeatureRefForNS<NS>;
    readonly listens: readonly string[];
    readonly triggers: readonly string[];
    readonly requests: readonly string[];
  };
};

// ─── Helpers d'aplatissement (clés flat-préfixées) ──────────────────────────

/**
 * Aplatit toutes les `listens` du contrat en union de clés `"ns:event"`.
 *
 * @example
 *   TFlatListens<{ cart: { listens: ["itemAdded"] }; user: { listens: ["profileUpdated"] } }>
 *   → "cart:itemAdded" | "user:profileUpdated"
 */
export type TFlatListens<F extends TFeatureContract> = {
  [NS in keyof F & string]: F[NS]["listens"][number] extends infer E
    ? E extends string
      ? `${NS}:${E}`
      : never
    : never;
}[keyof F & string];

/** Aplatit toutes les `triggers` en union de clés `"ns:cmd"`. */
export type TFlatTriggers<F extends TFeatureContract> = {
  [NS in keyof F & string]: F[NS]["triggers"][number] extends infer C
    ? C extends string
      ? `${NS}:${C}`
      : never
    : never;
}[keyof F & string];

/** Aplatit toutes les `requests` en union de clés `"ns:req"`. */
export type TFlatRequests<F extends TFeatureContract> = {
  [NS in keyof F & string]: F[NS]["requests"][number] extends infer R
    ? R extends string
      ? `${NS}:${R}`
      : never
    : never;
}[keyof F & string];

// ─── Extracteurs de payload depuis une clé flat-préfixée ───────────────────

/**
 * Payload d'un event depuis une clé `"ns:event"` et le contrat Feature.
 *
 * Résolution :
 *   1. Décompose `K` en `${NS}:${E}` via template literal.
 *   2. Extrait la définition `D` du Channel via le token static.
 *   3. Lit `D["events"][E]`.
 */
export type TEventPayloadFor<
  F extends TFeatureContract,
  K extends string
> = K extends `${infer NS}:${infer E}`
  ? NS extends keyof F
    ? F[NS]["feature"]["channel"] extends TChannelToken<infer D, NS>
      ? E extends keyof D["events"]
        ? D["events"][E]
        : never
      : never
    : never
  : never;

/** Payload d'une command depuis une clé `"ns:cmd"`. */
export type TCommandPayloadFor<
  F extends TFeatureContract,
  K extends string
> = K extends `${infer NS}:${infer C}`
  ? NS extends keyof F
    ? F[NS]["feature"]["channel"] extends TChannelToken<infer D, NS>
      ? C extends keyof D["commands"]
        ? D["commands"][C]
        : never
      : never
    : never
  : never;

/** Params d'une request depuis une clé `"ns:req"`. */
export type TRequestParamsFor<
  F extends TFeatureContract,
  K extends string
> = K extends `${infer NS}:${infer R}`
  ? NS extends keyof F
    ? F[NS]["feature"]["channel"] extends TChannelToken<infer D, NS>
      ? R extends keyof D["requests"]
        ? D["requests"][R]["params"]
        : never
      : never
    : never
  : never;

/** Résultat d'une request depuis une clé `"ns:req"`. */
export type TRequestResultFor<
  F extends TFeatureContract,
  K extends string
> = K extends `${infer NS}:${infer R}`
  ? NS extends keyof F
    ? F[NS]["feature"]["channel"] extends TChannelToken<infer D, NS>
      ? R extends keyof D["requests"]
        ? D["requests"][R]["result"]
        : never
      : never
    : never
  : never;

// ─── Channel handlers (D48 channel) ──────────────────────────────────────────

/**
 * Dérive le nom du handler channel depuis un namespace + event name.
 * Convention D48 channel : `on{NS}{EventName}Event` (suffixe `Event` conservé
 * pour anti-collision avec les handlers DOM, ADR-0042 C13).
 *
 * @example
 *   TChannelHandlerName<"cart", "itemAdded">  → "onCartItemAddedEvent"
 */
export type TChannelHandlerName<
  NS extends string,
  E extends string
> = `on${Capitalize<NS>}${Capitalize<E>}Event`;

/**
 * Handlers channel REQUIS pour un `TFeatureContract` — un par event déclaré
 * dans `listens` de chaque Feature.
 *
 * Symétrie Contract/Callbacks (ADR-0042 C15, I88) : pour chaque entrée dans
 * `features[NS].listens`, le compilateur impose la présence de la méthode
 * `on{NS}{EventName}Event` avec la signature exacte `(payload) => void`.
 *
 * Le payload est résolu via `TEventPayloadFor` — typé par le `TChannelDefinition`
 * de la Feature.
 *
 * Note strate 0/1 : ADR-0040 §615 met les metas hors-scope strate 0. Le second
 * paramètre `metas: TMessageMetas` sera ajouté à la signature en strate 1, via
 * un ADR dédié amendant ADR-0040 et ADR-0042. Le code actuel est volontairement
 * sans metas.
 */
export type TChannelCallbacks<F extends TFeatureContract> = UnionToIntersection<
  {
    [NS in keyof F & string]: {
      [E in F[NS]["listens"][number] as TChannelHandlerName<NS, E & string>]: (
        payload: TEventPayloadFor<F, `${NS}:${E & string}`>
      ) => void;
    };
  }[keyof F & string]
>;

// ─── Feature callbacks (ADR-0046 — M2 — symétrie I88 portée à Feature) ──────

/**
 * Handlers command REQUIS pour une Feature concrète.
 *
 * Convention D48 command : `on{Cmd}Command` (suffixe `Command`).
 * Pour chaque commande `K ∈ keyof TDef["commands"]`, impose la méthode
 * `onKCommand(payload: TDef["commands"][K]): void`.
 *
 * @example
 *   TCommandCallbacks<{ commands: { addItem: { productId: string } }; ... }>
 *   → { onAddItemCommand(payload: { productId: string }): void }
 */
export type TCommandCallbacks<TDef extends TChannelDefinition> = {
  [K in keyof TDef["commands"] & string as `on${Capitalize<K>}Command`]: (
    payload: TDef["commands"][K]
  ) => void;
};

/**
 * Handlers request REQUIS pour une Feature concrète.
 *
 * Convention D48 request : `on{Req}Request` (suffixe `Request`).
 * Pour chaque request `K ∈ keyof TDef["requests"]`, impose la méthode
 * `onKRequest(params: TDef["requests"][K]["params"]): TDef["requests"][K]["result"]`.
 */
export type TRequestCallbacks<TDef extends TChannelDefinition> = {
  [K in keyof TDef["requests"] & string as `on${Capitalize<K>}Request`]: (
    params: TDef["requests"][K]["params"]
  ) => TDef["requests"][K]["result"];
};

/**
 * Handlers listen REQUIS pour chaque token `TListens[number]`.
 *
 * Convention D48 channel : `on{NS}{EventName}Event` — le préfixe namespace
 * différencie les events de Channels distincts (anti-collision).
 *
 * **`UnionToIntersection` OBLIGATOIRE** (cf. POC QA-0046 §9.5 + Annexe §2 ADR-0046).
 * Sans wrapper : la distributivité du conditionnel produit une union d'objets
 * `{ …cart } | { …wishlist }` que TS refuse comme cible `implements` (TS2422).
 * `UnionToIntersection` fusionne les objets en intersection, rendant le type
 * utilisable comme target `implements`.
 */
export type TListenCallbacks<
  TListens extends readonly TChannelToken<TChannelDefinition, string>[]
> = UnionToIntersection<
  TListens[number] extends infer Tok
    ? Tok extends TChannelToken<infer DEF, infer NS>
      ? {
          [E in keyof DEF["events"] &
            string as `on${Capitalize<NS & string>}${Capitalize<E>}Event`]: (
            payload: DEF["events"][E]
          ) => void;
        }
      : never
    : never
>;

/**
 * Type d'enforcement compile-time des handlers d'une Feature concrète.
 *
 * Symétrie Contract/Callbacks (ADR-0046 — M2, I88 élargi, I92) :
 * `implements TFeatureCallbacks<TDef, TListens>` impose au compilateur
 * la présence et la signature exacte de TOUS les handlers dérivés :
 *   - `onXxxCommand`        pour chaque `K ∈ keyof TDef["commands"]`
 *   - `onXxxRequest`        pour chaque `K ∈ keyof TDef["requests"]`
 *   - `on{NS}{Evt}Event`    pour chaque `(token, event) ∈ TListens`
 *
 * Handler oublié → TS2515 ; signature fautive → TS2416.
 *
 * @example
 * ```ts
 * class CartFeature
 *   extends Feature<CartEntity, TCartChannelDef, "cart">
 *   implements TFeatureCallbacks<TCartChannelDef, typeof cartListens>
 * { … }
 * ```
 */
export type TFeatureCallbacks<
  TDef extends TChannelDefinition,
  TListens extends readonly TChannelToken<TChannelDefinition, string>[] =
    readonly []
> = TCommandCallbacks<TDef> &
  TRequestCallbacks<TDef> &
  TListenCallbacks<TListens>;

// ─── Filet runtime ──────────────────────────────────────────────────────────

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
