// @bonsai/types — utility types (re-exported at top level)
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

// @bonsai/rxjs — Tier 3 opaque (ADR-29)
// RxJS types are wrapped in the `RXJS` namespace and are not part of the
// documented public API. They are re-exported because @bonsai/event types
// (ThisMapEvents, etc.) reference RXJS.Subject<T>.
export * from "@bonsai/rxjs";

// @bonsai/valibot — Tier 1 integrated (ADR-11, ADR-29)
export * from "@bonsai/valibot";

// @bonsai/immer — Tier 3 opaque (ADR-10 + ADR-29)
// Immer is used internally for immutable Entity mutations.
// Its types (Draft, Patch, etc.) are wrapped in the `Immer` namespace.
export * from "@bonsai/immer";

// @bonsai/event — contract types only. `Radio` and `Channel` stay internal to
// the framework (I15, I80): exported by `@bonsai/event` for cross-package use,
// never re-exported in the application-facing surface.
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
