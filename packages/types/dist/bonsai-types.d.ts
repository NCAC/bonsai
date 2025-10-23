/**
 * Bundled TypeScript definitions
 * Generated: 2025-10-23T11:57:14.598Z
 */

// Type declarations
export type TClass<T, Arguments extends unknown[] = any[]> = TConstructor<T, Arguments> & {
    prototype: T;
};
export type TConstructor<T, Arguments extends unknown[] = any[]> = new (...arguments_: Arguments) => T;
export type TDictionary<T extends TDictionaryValue = TDictionaryValue> = {
    [key: string]: T;
};
export type TJsonDictionary<T extends TJsonValue = TJsonValue> = {
    [key: string]: T;
};
export type TNumericDictionary<T extends TDictionaryValue = TDictionaryValue> = {
    [key: number]: T;
};
export type TNumericJsonDictionary<T extends TJsonValue = TJsonValue> = {
    [key: number]: T;
};
export type StringHash = TDictionary<string>;
export type TJsonObject = {
    [Key in string]: TJsonValue;
} & {
    [Key in string]?: TJsonValue | undefined;
};
export type TJsonArray = TJsonValue[];
export type TJsonValue = TJsonPrimitive | TJsonObject | TJsonArray;
export type TDictionaryArray = TDictionaryValue[];
export type TDictionaryValue = TJsonPrimitive | object | TDictionaryArray;
type TMapKey<BaseType> = BaseType extends Map<infer KeyType, unknown> ? KeyType : never;
type TMapValue<BaseType> = BaseType extends Map<unknown, infer ValueType> ? ValueType : never;
export type ArrayEntry<BaseType extends readonly unknown[]> = [
    number,
    BaseType[number]
];
export type TMapEntry<BaseType> = [TMapKey<BaseType>, TMapValue<BaseType>];
export type TObjectEntry<BaseType> = [keyof BaseType, BaseType[keyof BaseType]];
export type TSetEntry<BaseType> = BaseType extends Set<infer ItemType> ? [ItemType, ItemType] : never;
export type Entry<BaseType> = BaseType extends Map<unknown, unknown> ? TMapEntry<BaseType> : BaseType extends Set<unknown> ? TSetEntry<BaseType> : BaseType extends readonly unknown[] ? ArrayEntry<BaseType> : BaseType extends object ? TObjectEntry<BaseType> : never;
type ArrayEntries<BaseType extends readonly unknown[]> = Array<ArrayEntry<BaseType>>;
type TMapEntries<BaseType> = Array<TMapEntry<BaseType>>;
type TObjectEntries<BaseType> = Array<TObjectEntry<BaseType>>;
type TSetEntries<BaseType extends Set<unknown>> = Array<TSetEntry<BaseType>>;
export type TEntries<BaseType> = BaseType extends Map<unknown, unknown> ? TMapEntries<BaseType> : BaseType extends Set<unknown> ? TSetEntries<BaseType> : BaseType extends readonly unknown[] ? ArrayEntries<BaseType> : BaseType extends object ? TObjectEntries<BaseType> : never;
export type AnyFunction = (...args: unknown[]) => unknown;
export type TParameters<T extends (...args: unknown[]) => unknown> = T extends (...args: infer P) => unknown ? P : never;
export type AlwaysParameters<T extends (...args: any) => any> = T extends (...args: infer P) => any ? P : any[];
export type EmptyObject = {
    [emptyObjectSymbol]?: never;
};
export type IsEmptyObject<T> = T extends EmptyObject ? true : false;
export type TPropertyNameByType<T extends object, ValueType> = {
    [K in keyof T]-?: TNonUndefined<T[K]> extends ValueType ? K : never;
}[keyof T];
export type RequiredFieldsOnly<T> = {
    [K in keyof T as T[K] extends Required<T>[K] ? K : never]: T[K];
};
export type TPropertyNameByNotType<T extends object, ValueType> = {
    [K in keyof T]-?: TNonUndefined<T[K]> extends ValueType ? never : K;
}[keyof T];
export type TFunctionPropertyNames<T extends object> = TPropertyNameByType<T, Function>;
export type TNonFunctionPropertyNames<T extends object> = TPropertyNameByNotType<T, Function>;
export type TPropertyNames<T extends object> = {
    [K in keyof T]-?: TNonUndefined<K>;
}[keyof T];
type Filter<KeyType, ExcludeType> = IsEqual<KeyType, ExcludeType> extends true ? never : KeyType extends ExcludeType ? never : KeyType;
export type TExcludeKeys<ObjectType, KeysType extends keyof ObjectType> = {
    [KeyType in keyof ObjectType as Filter<KeyType, KeysType>]: ObjectType[KeyType];
};
export type TExcludeValues<T extends TDictionary, V> = Pick<T, {
    [K in keyof T]-?: T[K] extends V ? never : K;
}[keyof T]>;
export type TLookup<T, K> = K extends keyof T ? T[K] : never;
export type MutableKeys<T extends object> = {
    [P in keyof T]-?: IfEquals<{
        [Q in P]: T[P];
    }, {
        -readonly [Q in P]: T[P];
    }, P>;
}[keyof T];
export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];
export type OptionalKeys<T> = {
    [K in keyof T]-?: {} extends Pick<T, K> ? K : never;
}[keyof T];
export type ExcludeOptionalKeys<T> = Pick<T, RequiredKeys<T>>;
export type PickByValue<T, ValueType> = Pick<T, {
    [Key in keyof T]-?: T[Key] extends ValueType ? Key : never;
}[keyof T]>;
export type PickByValueExact<T, ValueType> = Pick<T, {
    [Key in keyof T]-?: [ValueType] extends [T[Key]] ? [T[Key]] extends [ValueType] ? Key : never : never;
}[keyof T]>;
export type TPrimitive = string | number | bigint | boolean | symbol | null | undefined;
export type TJsonPrimitive = string | number | boolean | null;
export type TFalsy = false | "" | 0 | null | undefined;
export type TNullish = null | undefined;
export type TPropertyName = string | number | symbol;
export type TNonUndefined<A> = A extends undefined ? never : A;
export type TOneLetter = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i" | "j" | "k" | "l" | "m" | "n" | "o" | "p" | "q" | "r" | "s" | "t" | "u" | "v" | "w" | "x" | "y" | "z" | "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L" | "M" | "N" | "O" | "P" | "Q" | "R" | "S" | "T" | "U" | "V" | "W" | "X" | "Y" | "Z";
export type TNonEmptyString<T extends string> = "" extends T ? never : T;
export type TInstanceOrT<T> = T extends new (...args: any) => any ? InstanceType<T> : T;
export type IfEquals<X, Y, A = X, B = never> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? A : B;
export type IsEqual<A, B> = (<G>() => G extends A ? 1 : 2) extends <G>() => G extends B ? 1 : 2 ? true : false;
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;
type LastOf<T> = UnionToIntersection<T extends any ? () => T : never> extends () => infer R ? R : never;
type Push<T extends any[], V> = [...T, V];
type TuplifyUnion<T, L = LastOf<T>, N = [T] extends [never] ? true : false> = true extends N ? [] : Push<TuplifyUnion<Exclude<T, L>>, L>;
export type StrictArrayOfValues<T extends object | null> = Readonly<TuplifyUnion<ValuesType<T>>>;
export type StrictArrayOfKeys<T extends object> = Readonly<TuplifyUnion<TPropertyNames<T>>>;
export type ValuesType<T extends ReadonlyArray<any> | ArrayLike<any> | Record<any, any>> = T extends ReadonlyArray<any> ? T[number] : T extends ArrayLike<any> ? T[number] : T extends object ? T[keyof T] : never;
export type ElementType<T extends ReadonlyArray<unknown>> = T extends ReadonlyArray<infer ElementType> ? ElementType : never;
export type KeysOfUnion<T> = T extends T ? keyof T : never;
export type StringDigit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";
export type Whitespace = "\u{9}" | "\u{A}" | "\u{B}" | "\u{C}" | "\u{D}" | "\u{20}" | "\u{85}" | "\u{A0}" | "\u{1680}" | "\u{2000}" | "\u{2001}" | "\u{2002}" | "\u{2003}" | "\u{2004}" | "\u{2005}" | "\u{2006}" | "\u{2007}" | "\u{2008}" | "\u{2009}" | "\u{200A}" | "\u{2028}" | "\u{2029}" | "\u{202F}" | "\u{205F}" | "\u{3000}" | "\u{FEFF}";
export type TObjectKeys<T> = T extends object ? (keyof T)[] : T extends number ? [] : T extends Array<any> | string ? string[] : never;
