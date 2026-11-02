/**
 * Describing a component to the kernel (migration lot M6.2).
 *
 * Feature, Foundation, Composer and View are classes written by developers;
 * the kernel works on component descriptions (`TComponentSpec`). Each class
 * knows how to describe itself through the shared `DESCRIBE` symbol, so that
 * the packages need not import one another at run time (a View declares
 * Composers, a Composer creates Views).
 */

import type { TComponentSpec } from "./kernel/types";

/** Registered symbol: the same in every package that holds a copy of this module. */
export const DESCRIBE: unique symbol = Symbol.for("bonsai.component.describe") as never;

/** A class instance able to describe itself to the kernel. */
export type TDescribable<TOptions = undefined> = {
  [DESCRIBE](options: TOptions): TComponentSpec;
};

/**
 * @internal Framework use only.
 *
 * Builds the kernel description of a component instance.
 *
 * @throws when the instance is not a Bonsai component.
 */
export function describeComponent(instance: object, options?: unknown): TComponentSpec {
  const describe = (instance as Partial<TDescribable<unknown>>)[DESCRIBE];
  if (typeof describe !== "function") {
    throw new Error(`[Bonsai] ${instance.constructor.name} is not a Bonsai component and cannot be created by the framework`);
  }
  return describe.call(instance, options);
}
