export type TClass<T, Arguments extends unknown[] = any[]> = TConstructor<
  T,
  Arguments
> & { prototype: T };

export type TConstructor<T, Arguments extends unknown[] = any[]> = new (
  ...arguments_: Arguments
) => T;
