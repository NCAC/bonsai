// @bonsai/types — types utilitaires (ré-exportés au top-level)
export * from "@bonsai/types";

// Export all types from @bonsai/types at top-level (flat)
export type {
  TInstanceOrT,
  IfEquals,
  IsEqual,
  UnionToIntersection,
  LastOf,
  Push,
  TuplifyUnion,
  StrictArrayOfValues,
  StrictArrayOfKeys,
  ValuesType,
  ElementType,
  KeysOfUnion,
  StringDigit,
  Whitespace,
  TObjectKeys,
  TPrimitive,
  TJsonPrimitive,
  TFalsy,
  TNullish,
  TPropertyName,
  TNonUndefined,
  TDictionary,
  TJsonDictionary,
  TNumericDictionary,
  TNumericJsonDictionary,
  StringHash,
  TJsonObject,
  TJsonArray,
  TJsonValue,
  TDictionaryArray,
  TDictionaryValue,
  TNonEmptyString,
  TOneLetter,
  ArrayEntry,
  TMapEntry,
  TObjectEntry,
  TSetEntry,
  Entry,
  TEntries,
  EmptyObject,
  IsEmptyObject,
  TPropertyNameByType,
  RequiredFieldsOnly,
  TPropertyNameByNotType,
  TFunctionPropertyNames,
  TNonFunctionPropertyNames,
  TPropertyNames,
  TExcludeKeys,
  TExcludeValues,
  TLookup,
  MutableKeys,
  RequiredKeys,
  OptionalKeys,
  ExcludeOptionalKeys,
  PickByValue,
  PickByValueExact,
  TClass,
  TConstructor,
  AnyFunction,
  TParameters,
  AlwaysParameters
} from "@bonsai/types";

// @bonsai/rxjs — Tier 3 opaque (ADR-0032 §3)
// Les types RxJS sont encapsulés dans le namespace `RXJS` et ne font pas
// partie de l'API publique documentée. Ils sont ré-exportés car les types
// @bonsai/event (ThisMapEvents, etc.) référencent RXJS.Subject<T>.
export * from "@bonsai/rxjs";

// @bonsai/valibot — Tier 1 intégrée (ADR-0022 + ADR-0032 §3)
export * from "@bonsai/valibot";

// @bonsai/immer — Tier 3 opaque (ADR-0001 + ADR-0032 §3)
// Immer est utilisé en interne pour les mutations immutables d'Entity.
// Les types (Draft, Patch, etc.) sont encapsulés dans le namespace `Immer`.
export * from "@bonsai/immer";

// @bonsai/event — types de contrat uniquement. `Radio` et `Channel` restent
// internes au framework (I15, I80) : exportés par `@bonsai/event` pour l'usage
// inter-packages, jamais ré-exportés dans la surface applicative.
export type {
  TChannelDefinition,
  TChannelToken,
  TTokenDef,
  TAnyEventPayload
} from "@bonsai/event";

// @bonsai/feature — Feature base class, BonsaiNamespaceError, TFeatureContract, etc.
export * from "@bonsai/feature";

// @bonsai/view — View base class
export * from "@bonsai/view";

// @bonsai/composer — Composer base class
export * from "@bonsai/composer";

// @bonsai/foundation — Foundation base class
export * from "@bonsai/foundation";

// @bonsai/application — Application orchestrator
export * from "@bonsai/application";
