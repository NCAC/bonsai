import { TNonUndefined } from "./primitive-values";
import { IsEqual, IfEquals } from "./utils";
import { TDictionary } from "./dictionaries";

declare const emptyObjectSymbol: unique symbol;

export type EmptyObject = { [emptyObjectSymbol]?: never };

/**
Returns a `boolean` for whether the type is strictly equal to an empty plain object, the `{}` value.
@example
```
import type {IsEmptyObject} from 'type-fest';
type Pass = IsEmptyObject<{}>; //=> true
type Fail = IsEmptyObject<[]>; //=> false
type Fail = IsEmptyObject<null>; //=> false
```
@see EmptyObject
@category Object
*/
export type IsEmptyObject<T> = T extends EmptyObject ? true : false;

export type TPropertyNameByType<T extends object, ValueType> = {
  [K in keyof T]-?: TNonUndefined<T[K]> extends ValueType ? K : never;
}[keyof T];

export type RequiredFieldsOnly<T> = {
  [K in keyof T as T[K] extends Required<T>[K] ? K : never]: T[K];
};

/**
 * TPropertyNameByNotType<T, ValueType>
 * -------
 * From object `T` get union type of all the properties that are NOT of type `ValueType`
 *
 * @example
 * ```
 * const obj = {
 *  name: "koala",
 *  sayHello() {
 *    return "grmmm";
 *  },
 *  isDangerous: false
 * };
 * type TObjFunctionPropertyNames = PropertyNameByNotType<typeof obj, boolean>;
 * // Expect: "name" | "sayHello"
 * ```
 */
export type TPropertyNameByNotType<T extends object, ValueType> = {
  [K in keyof T]-?: TNonUndefined<T[K]> extends ValueType ? never : K;
}[keyof T];

/**
 * TFunctionPropertyNames<T>
 * -------
 * From object `T` get union type of all the properties that are functions
 *
 * @example
 * ```
 * const obj = {
 *  name: "koala",
 *  sayHello() {
 *    return "grmmm";
 *  }
 * };
 * type TObjFunctionPropertyNames = FunctionPropertyNames<typeof obj>;
 * // Expect: "sayHello"
 * ```
 */
export type TFunctionPropertyNames<T extends object> = TPropertyNameByType<
  T,
  Function
>;

/**
 * TNonFunctionPropertyNames<T>
 * ------
 * From object `T`, get union type of all the properties that are NOT functions
 *
 * @example
 * ```
 * const obj = {
 *  name: "koala",
 *  sayHello() {
 *    return "grmmm";
 *  }
 * };
 * type TObjFunctionPropertyNames = NonFunctionPropertyNames<typeof obj>;
 * // Expect: "name"
 * ```
 */
// export type NonFunctionPropertyNames<T extends object> = {
//   [K in keyof T]-?: NonUndefined<T[K]> extends Function ? never : K;
// }[keyof T];
export type TNonFunctionPropertyNames<T extends object> =
  TPropertyNameByNotType<T, Function>;

/**
 * TPropertyNames<T>
 * ---------
 * From `T` get union type of name of all the properties
 *
 * @credit https://github.com/piotrwitek/utility-types
 * @example
 * ```
 * const obj = {
 *  name: "koala",
 *  sayHello() {
 *    return "grmmm";
 *  }
 * };
 * type TObjPropertyNames = PropertyNames<typeof obj>;
 * // Expect: "name" | "sayHello"
 * ```
 */
export type TPropertyNames<T extends object> = {
  [K in keyof T]-?: TNonUndefined<K>;
}[keyof T];

/**
Filter out keys from an object.
Returns `never` if `Exclude` is strictly equal to `Key`.
Returns `never` if `Key` extends `Exclude`.
Returns `Key` otherwise.
@example
```
type Filtered = Filter<'foo', 'foo'>;
//=> never
```
@example
```
type Filtered = Filter<'bar', string>;
//=> never
```
@example
```
type Filtered = Filter<'bar', 'foo'>;
//=> 'bar'
```
@see {Except}
*/
type Filter<KeyType, ExcludeType> = IsEqual<KeyType, ExcludeType> extends true
  ? never
  : KeyType extends ExcludeType
  ? never
  : KeyType;

/**
Create a type from an object type without certain keys.
This type is a stricter version of [`Omit`](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-5.html#the-omit-helper-type). The `Omit` type does not restrict the omitted keys to be keys present on the given type, while `Except` does. The benefits of a stricter type are avoiding typos and allowing the compiler to pick up on rename refactors automatically.
This type was proposed to the TypeScript team, which declined it, saying they prefer that libraries implement stricter versions of the built-in types ([microsoft/TypeScript#30825](https://github.com/microsoft/TypeScript/issues/30825#issuecomment-523668235)).
@example
```
import type {Except} from 'type-fest';
type Foo = {
	a: number;
	b: string;
	c: boolean;
};
type FooWithoutA = Except<Foo, 'a' | 'c'>;
//=> {b: string};
```
@category Object
*/
export type TExcludeKeys<ObjectType, KeysType extends keyof ObjectType> = {
  [KeyType in keyof ObjectType as Filter<
    KeyType,
    KeysType
  >]: ObjectType[KeyType];
};

export type TExcludeValues<T extends TDictionary, V> = Pick<
  T,
  { [K in keyof T]-?: T[K] extends V ? never : K }[keyof T]
>;

/**
 * Lookup<T, K>
 * ----
 * From an object `T`, get the type of the value of the key `K`
 * @example
 * ```
 * type Props = { readonly age: 42; readonly name: "Bob" }
 * type AgeValue = Lookup<Props, "age"> // Expected: 42
 * ```
 */
export type TLookup<T, K> = K extends keyof T ? T[K] : never;

/**
 * MutableKeys<T>
 * ---
 * Get union type of keys that are mutable in object type `T`
 * @credit https://github.com/piotrwitek/utility-types
 * @author Matt McCutchen
 * https://stackoverflow.com/questions/52443276/how-to-exclude-getter-only-properties-from-type-in-typescript
 * @example
 * ```
 *   type Props = { readonly foo: string; bar: number };
 *
 *   // Expect: "bar"
 *   type Keys = MutableKeys<Props>;
 * ```
 */
export type MutableKeys<T extends object> = {
  [P in keyof T]-?: IfEquals<
    { [Q in P]: T[P] },
    { -readonly [Q in P]: T[P] },
    P
  >;
}[keyof T];

// class Test0 {
//   get name() {
//     return "OUAAA";
//   }
//   age: number;
//   constructor(age: number) {
//     this.age = age;
//   }
// }
// type MutableTest0 = MutableKeys<Test0>

/**
 * RequiredKeys<T>
 * -----
 * Get union type of keys that are required in object type `T`
 * @credit https://github.com/piotrwitek/utility-types
 * @see https://stackoverflow.com/questions/52984808/is-there-a-way-to-get-all-required-properties-of-a-typescript-object
 * @example
 * ```
 *   type Props = { req: number; reqUndef: number | undefined; opt?: string; optUndef?: number | undefined; };
 *   type Keys = RequiredKeys<Props>; // Expect: "req" | "reqUndef"
 * ```
 */
export type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

/**
 * OptionalKeys<T>
 * -----
 * Get union type of keys that are optional in object type `T`
 * @credit https://github.com/piotrwitek/utility-types
 * @see https://stackoverflow.com/questions/52984808/is-there-a-way-to-get-all-required-properties-of-a-typescript-object
 * @example
 * ```
 *   type Props = { req: number; reqUndef: number | undefined; opt?: string; optUndef?: number | undefined; };
 *   type Keys = OptionalKeys<Props>; // Expect: "opt" | "optUndef"
 * ```
 */
export type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never;
}[keyof T];

export type ExcludeOptionalKeys<T> = Pick<T, RequiredKeys<T>>;

/**
 * PickByValue<T, ValueType>
 * ------
 * From `T` pick a set of properties by value matching `ValueType`.
 * @credit https://github.com/piotrwitek/utility-types
 * @author [Piotr Lewandowski](https://medium.com/dailyjs/typescript-create-a-condition-based-subset-types-9d902cea5b8c)
 * @example
 * ```
 *   type Props = { req: number; reqUndef: number | undefined; opt?: string; };
 *   type Props = PickByValue<Props, number>; // Expect: { req: number }
 *   type Props = PickByValue<Props, number | undefined>; // Expect: { req: number; reqUndef: number | undefined; }
 * ```
 */
export type PickByValue<T, ValueType> = Pick<
  T,
  { [Key in keyof T]-?: T[Key] extends ValueType ? Key : never }[keyof T]
>;

/**
 * PickByValueExact<T, ValueType
 * -------
 * From `T` pick a set of properties by value matching exact `ValueType`.
 * @credit https://github.com/piotrwitek/utility-types
 * @example
 * ```
 *   type Props = { req: number; reqUndef: number | undefined; opt?: string; };
 *   type Props = PickByValueExact<Props, number>; // Expect: { req: number }
 *   type Props = PickByValueExact<Props, number | undefined>; // Expect: { reqUndef: number | undefined; }
 * ```
 */
export type PickByValueExact<T, ValueType> = Pick<
  T,
  {
    [Key in keyof T]-?: [ValueType] extends [T[Key]]
      ? [T[Key]] extends [ValueType]
        ? Key
        : never
      : never;
  }[keyof T]
>;
