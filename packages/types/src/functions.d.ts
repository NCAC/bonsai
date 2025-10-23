export type AnyFunction = (...args: unknown[]) => unknown;

/**
 * TParameters<T>
 * --------
 * From `T` (function) get export type of parameters
 */
export type TParameters<T extends (...args: unknown[]) => unknown> = T extends (
  ...args: infer P
) => unknown
  ? P
  : never;

/**
 * Obtain the parameters of a function export type in a tuple
 */
export type AlwaysParameters<T extends (...args: any) => any> = T extends (
  ...args: infer P
) => any
  ? P
  : any[];
