import type { TJsonPrimitive } from "./primitive-values.d.ts";

/**
 * Dictionaries are "jsonifiable" object ie with non-cyclic values and "finite" values
 */

/**
 * @credit https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/lodash
 */
export type TDictionary<T extends TDictionaryValue = TDictionaryValue> = {
  [key: string]: T;
};

export type TJsonDictionary<T extends TJsonValue = TJsonValue> = {
  [key: string]: T;
};

/**
 * @credit https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/lodash
 */
export type TNumericDictionary<T extends TDictionaryValue = TDictionaryValue> =
  {
    [key: number]: T;
  };
export type TNumericJsonDictionary<T extends TJsonValue = TJsonValue> = {
  [key: number]: T;
};

export type StringHash = TDictionary<string>;

export type TJsonObject = { [Key in string]: TJsonValue } & {
  [Key in string]?: TJsonValue | undefined;
};

export type TJsonArray = TJsonValue[];

export type TJsonValue = TJsonPrimitive | TJsonObject | TJsonArray;

export type TDictionaryArray = TDictionaryValue[];
export type TDictionaryValue = TJsonPrimitive | object | TDictionaryArray;
