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
 * Lettre minuscule unique (a–z). Dérivée de `TOneLetter`.
 */
export type TLowerLetter = Lowercase<TOneLetter>;

/**
 * Lettre majuscule unique (A–Z). Dérivée de `TOneLetter`.
 */
export type TUpperLetter = Uppercase<TOneLetter>;

/**
 * Vrai si `S` est composée exclusivement de lettres (a–z ou A–Z).
 * `""` est considérée comme valide (cas terminal de la récursion).
 */
export type TAllLetters<S extends string> = S extends ""
  ? true
  : S extends `${infer Head}${infer Tail}`
    ? Head extends TOneLetter
      ? TAllLetters<Tail>
      : false
    : false;

/**
 * camelCase plat — première lettre minuscule, reste exclusivement lettres.
 *
 * Retourne `S` si `S` est camelCase, sinon `never`. Conçu pour être utilisé
 * dans un mapped type afin de rejeter au compile-time les clés non
 * conformes (typiquement : clés d'un manifest applicatif).
 *
 * | Entrée          | Résultat        |
 * | --------------- | --------------- |
 * | `"cart"`        | `"cart"`        |
 * | `"userProfile"` | `"userProfile"` |
 * | `"Cart"`        | `never`         |
 * | `"my-cart"`     | `never`         |
 * | `"my_cart"`     | `never`         |
 * | `"cart2"`       | `never`         |
 * | `""`            | `never`         |
 *
 * Si tolérer les chiffres après la première lettre devient nécessaire,
 * étendre via une nouvelle variante (`CamelCaseAlnum<S>`) plutôt que
 * d'élargir ce type — préserver la garantie « lettres seules » pour les
 * appelants existants.
 */
export type CamelCase<S extends string> =
  S extends `${infer First}${infer Rest}`
    ? First extends TLowerLetter
      ? TAllLetters<Rest> extends true
        ? S
        : never
      : never
    : never;
