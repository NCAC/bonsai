import type { TPropertyNames } from "./object.d.ts";

export type TInstanceOrT<T> = T extends new (...args: any) => any
  ? InstanceType<T>
  : T;

/**
 * @credit https://github.com/piotrwitek/utility-types
 * @see https://github.com/Microsoft/TypeScript/issues/27024#issuecomment-421529650
 */
export type IfEquals<X, Y, A = X, B = never> = (<T>() => T extends X
  ? 1
  : 2) extends <T>() => T extends Y ? 1 : 2
  ? A
  : B;

/**
Returns a boolean for whether the two given types are equal.

@link https://github.com/microsoft/TypeScript/issues/27024#issuecomment-421529650
@link https://stackoverflow.com/questions/68961864/how-does-the-equals-work-in-typescript/68963796#68963796

Use-cases:
- If you want to make a conditional branch based on the result of a comparison of two types.

@example
```

// This type returns a boolean for whether the given array includes the given item.
// `IsEqual` is used to compare the given array at position 0 and the given item and then return true if they are equal.
type Includes<Value extends readonly any[], Item> =
	Value extends readonly [Value[0], ...infer rest]
		? IsEqual<Value[0], Item> extends true
			? true
			: Includes<rest, Item>
		: false;
```

@category Utilities
*/
export type IsEqual<A, B> = (<G>() => G extends A ? 1 : 2) extends <
  G
>() => G extends B ? 1 : 2
  ? true
  : false;

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never;

type LastOf<T> = UnionToIntersection<
  T extends any ? () => T : never
> extends () => infer R
  ? R
  : never;
type Push<T extends any[], V> = [...T, V];
type TuplifyUnion<
  T,
  L = LastOf<T>,
  N = [T] extends [never] ? true : false
> = true extends N ? [] : Push<TuplifyUnion<Exclude<T, L>>, L>;

/**
 * StrictArrayOfValues<T>
 * @see https://stackoverflow.com/questions/55127004/how-to-transform-union-type-to-tuple-type
 * -----
 * From an object `T`, get a readonly array (order is not guaranted) of all the ValueTypes
 *
 * The order is not guaranted
 *
 * @example
 *  type MyObject = {
 *    one: string;
 *    two: boolean
 * }
 *  type valuesOfMyObject = StrictArrayOfValues<MyObject>;
 *  // Expect : readonly [string, boolean]
 */

export type StrictArrayOfValues<T extends Record<any, any> | null> =
  T extends null 
    ? readonly [] 
    : T extends Record<any, any>
    ? Readonly<TuplifyUnion<ValuesType<T>>>
    : readonly [];

/**
 * StrictArrayOfKeys<T>
 * @see https://stackoverflow.com/questions/55127004/how-to-transform-union-type-to-tuple-type
 * -----
 * From an object `T`, get a readonly array (order is not guaranted) of all the properties
 *
 * The order is not guaranted
 *
 * @example
 *  type MyObject = {
 *    one: string;
 *    two: boolean
 * }
 *  type KeysOfMyObject = StrictArrayOfKeys<MyObject>;
 *  // Expect : readonly ["one", "two"]
 */

export type StrictArrayOfKeys<T extends object> = Readonly<
  TuplifyUnion<TPropertyNames<T>>
>;

/**
 * ValueType<T>
 * ------
 *  Get the union type of all the values in an object, array or array-like type `T`
 * @example
 *    type Props = { name: string; age: number; visible: boolean };
 *    type PropsValues = ValuesType<Props>; // Expect: string | number | boolean
 */
export type ValuesType<
  T extends ReadonlyArray<any> | ArrayLike<any> | Record<any, any>
> = T extends ReadonlyArray<any>
  ? T[number]
  : T extends ArrayLike<any>
  ? T[number]
  : T extends object
  ? T[keyof T]
  : never;

/**
 * ElementType<T>
 * -------
 * From a ReadonlyArray `T` get union type of all the values
 * @example
 * ```
 * const values = [ "one", "two", "three"] as const;
 * types TValues = ElementType<typeof values>; // Expect : "one" | "two" | "three"
 * const test1: ElementType<typeof values> = "four" // error
 * const test2: ElementType<typeof values> = "three" // ok
 * ```
 */
export type ElementType<T extends ReadonlyArray<unknown>> =
  T extends ReadonlyArray<infer ElementType> ? ElementType : never;

/**
Gets keys from a type. Similar to `keyof` but this one also works for union types.
The reason a simple `keyof Union` does not work is because `keyof` always returns the accessible keys of a type. In the case of a union, that will only be the common keys.
@link https://stackoverflow.com/a/49402091
*/
export type KeysOfUnion<T> = T extends T ? keyof T : never;

export type StringDigit =
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9";

export type Whitespace =
  | "\u{9}" // '\t'
  | "\u{A}" // '\n'
  | "\u{B}" // '\v'
  | "\u{C}" // '\f'
  | "\u{D}" // '\r'
  | "\u{20}" // ' '
  | "\u{85}"
  | "\u{A0}"
  | "\u{1680}"
  | "\u{2000}"
  | "\u{2001}"
  | "\u{2002}"
  | "\u{2003}"
  | "\u{2004}"
  | "\u{2005}"
  | "\u{2006}"
  | "\u{2007}"
  | "\u{2008}"
  | "\u{2009}"
  | "\u{200A}"
  | "\u{2028}"
  | "\u{2029}"
  | "\u{202F}"
  | "\u{205F}"
  | "\u{3000}"
  | "\u{FEFF}";

export type TObjectKeys<T> = T extends object
  ? (keyof T)[]
  : T extends number
  ? []
  : T extends Array<any> | string
  ? string[]
  : never;
