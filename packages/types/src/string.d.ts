export type TOneLetter =
  | "a"
  | "b"
  | "c"
  | "d"
  | "e"
  | "f"
  | "g"
  | "h"
  | "i"
  | "j"
  | "k"
  | "l"
  | "m"
  | "n"
  | "o"
  | "p"
  | "q"
  | "r"
  | "s"
  | "t"
  | "u"
  | "v"
  | "w"
  | "x"
  | "y"
  | "z"
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I"
  | "J"
  | "K"
  | "L"
  | "M"
  | "N"
  | "O"
  | "P"
  | "Q"
  | "R"
  | "S"
  | "T"
  | "U"
  | "V"
  | "W"
  | "X"
  | "Y"
  | "Z";

export type TNonEmptyString<T extends string> = "" extends T ? never : T;

/**
 * Single lowercase letter (a–z). Derived from `TOneLetter`.
 */
export type TLowerLetter = Lowercase<TOneLetter>;

/**
 * Single uppercase letter (A–Z). Derived from `TOneLetter`.
 */
export type TUpperLetter = Uppercase<TOneLetter>;

/**
 * True if `S` consists only of letters (a–z or A–Z).
 * `""` is considered valid (terminal case of the recursion).
 */
export type TAllLetters<S extends string> = S extends ""
  ? true
  : S extends `${infer Head}${infer Tail}`
    ? Head extends TOneLetter
      ? TAllLetters<Tail>
      : false
    : false;

/**
 * Flat camelCase — lowercase first letter, letters only afterwards.
 *
 * Returns `S` if `S` is camelCase, `never` otherwise. Designed for use in a
 * mapped type to reject non-conforming keys at compile time (typically the
 * keys of an application manifest).
 *
 * | Input           | Result          |
 * | --------------- | --------------- |
 * | `"cart"`        | `"cart"`        |
 * | `"userProfile"` | `"userProfile"` |
 * | `"Cart"`        | `never`         |
 * | `"my-cart"`     | `never`         |
 * | `"my_cart"`     | `never`         |
 * | `"cart2"`       | `never`         |
 * | `""`            | `never`         |
 *
 * If digits after the first letter ever need to be allowed, add a new
 * variant (`CamelCaseAlnum<S>`) rather than widening this type, to keep
 * the "letters only" guarantee for existing callers.
 */
export type CamelCase<S extends string> =
  S extends `${infer First}${infer Rest}`
    ? First extends TLowerLetter
      ? TAllLetters<Rest> extends true
        ? S
        : never
      : never
    : never;
