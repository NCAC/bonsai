/**
 * @credit https://github.com/piotrwitek/utility-types
 */
export type TPrimitive =
  | string
  | number
  | bigint
  | boolean
  | symbol
  | null
  | undefined;

/**
 * @credit https://github.com/sindresorhus/type-fest
 */
export type TJsonPrimitive = string | number | boolean | null;

/**
 * @credit https://github.com/piotrwitek/utility-types
 */
export type TFalsy = false | "" | 0 | null | undefined;

/**
 * @credit https://github.com/piotrwitek/utility-types
 */
export type TNullish = null | undefined;

export type TPropertyName = string | number | symbol;

/**
 * @credit https://github.com/piotrwitek/utility-types
 */
export type TNonUndefined<A> = A extends undefined ? never : A;
