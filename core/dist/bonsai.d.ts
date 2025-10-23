/**
 * Bundled TypeScript definitions for Bonsai Framework
 * Generated: 2025-10-30T12:54:48.061Z
 * 
 * This file contains all types from:
 * - @bonsai/types
 * - @bonsai/rxjs
 * - @bonsai/remeda
 * - @bonsai/zod
 * - @bonsai/event
 */

// ===== Types from @bonsai/types (flattened) =====
// From class.d.ts
export type TClass<T, Arguments extends unknown[] = any[]> = TConstructor<
  T,
  Arguments
> & { prototype: T };
export type TConstructor<T, Arguments extends unknown[] = any[]> = new (
  ...arguments_: Arguments
) => T;

// From dictionaries.d.ts
export type TDictionary<T extends TDictionaryValue = TDictionaryValue> = {
  [key: string]: T;
};
export type TJsonDictionary<T extends TJsonValue = TJsonValue> = {
  [key: string]: T;
};
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

// From entries.d.ts
type TMapKey<BaseType> = BaseType extends Map<infer KeyType, unknown>
  ? KeyType
  : never;
type TMapValue<BaseType> = BaseType extends Map<unknown, infer ValueType>
  ? ValueType
  : never;
export type ArrayEntry<BaseType extends readonly unknown[]> = [
  number,
  BaseType[number]
];
export type TMapEntry<BaseType> = [TMapKey<BaseType>, TMapValue<BaseType>];
export type TObjectEntry<BaseType> = [keyof BaseType, BaseType[keyof BaseType]];
export type TSetEntry<BaseType> = BaseType extends Set<infer ItemType>
  ? [ItemType, ItemType]
  : never;
export type Entry<BaseType> = BaseType extends Map<unknown, unknown>
  ? TMapEntry<BaseType>
  : BaseType extends Set<unknown>
  ? TSetEntry<BaseType>
  : BaseType extends readonly unknown[]
  ? ArrayEntry<BaseType>
  : BaseType extends object
  ? TObjectEntry<BaseType>
  : never;
type ArrayEntries<BaseType extends readonly unknown[]> = Array<
  ArrayEntry<BaseType>
>;
type TMapEntries<BaseType> = Array<TMapEntry<BaseType>>;
type TObjectEntries<BaseType> = Array<TObjectEntry<BaseType>>;
type TSetEntries<BaseType extends Set<unknown>> = Array<TSetEntry<BaseType>>;
export type TEntries<BaseType> = BaseType extends Map<unknown, unknown>
  ? TMapEntries<BaseType>
  : BaseType extends Set<unknown>
  ? TSetEntries<BaseType>
  : BaseType extends readonly unknown[]
  ? ArrayEntries<BaseType>
  : BaseType extends object
  ? TObjectEntries<BaseType>
  : never;

// From functions.d.ts
export type AnyFunction = (...args: unknown[]) => unknown;
export type TParameters<T extends (...args: unknown[]) => unknown> = T extends (
  ...args: infer P
) => unknown
  ? P
  : never;
export type AlwaysParameters<T extends (...args: any) => any> = T extends (
  ...args: infer P
) => any
  ? P
  : any[];

// From object.d.ts
export type EmptyObject = { [emptyObjectSymbol]?: never };
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
export type TFunctionPropertyNames<T extends object> = TPropertyNameByType<
  T,
  Function
>;
export type TNonFunctionPropertyNames<T extends object> =
  TPropertyNameByNotType<T, Function>;
export type TPropertyNames<T extends object> = {
  [K in keyof T]-?: TNonUndefined<K>;
}[keyof T];
type Filter<KeyType, ExcludeType> = IsEqual<KeyType, ExcludeType> extends true
  ? never
  : KeyType extends ExcludeType
  ? never
  : KeyType;
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
export type TLookup<T, K> = K extends keyof T ? T[K] : never;
export type MutableKeys<T extends object> = {
  [P in keyof T]-?: IfEquals<
    { [Q in P]: T[P] },
    { -readonly [Q in P]: T[P] },
    P
  >;
}[keyof T];
export type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];
export type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never;
}[keyof T];
export type ExcludeOptionalKeys<T> = Pick<T, RequiredKeys<T>>;
export type PickByValue<T, ValueType> = Pick<
  T,
  { [Key in keyof T]-?: T[Key] extends ValueType ? Key : never }[keyof T]
>;
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
export declare const emptyObjectSymbol: unique symbol;

// From primitive-values.d.ts
export type TPrimitive =
  | string
  | number
  | bigint
  | boolean
  | symbol
  | null
  | undefined;
export type TJsonPrimitive = string | number | boolean | null;
export type TFalsy = false | "" | 0 | null | undefined;
export type TNullish = null | undefined;
export type TPropertyName = string | number | symbol;
export type TNonUndefined<A> = A extends undefined ? never : A;

// From string.d.ts
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

// From type-fest-empty-object.d.ts

// From utils.d.ts
export type TInstanceOrT<T> = T extends new (...args: any) => any
  ? InstanceType<T>
  : T;
export type IfEquals<X, Y, A = X, B = never> = (<T>() => T extends X
  ? 1
  : 2) extends <T>() => T extends Y ? 1 : 2
  ? A
  : B;
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
export type StrictArrayOfValues<T extends Record<any, any> | null> =
  T extends null 
    ? readonly [] 
    : T extends Record<any, any>
    ? Readonly<TuplifyUnion<ValuesType<T>>>
    : readonly [];
export type StrictArrayOfKeys<T extends object> = Readonly<
  TuplifyUnion<TPropertyNames<T>>
>;
export type ValuesType<
  T extends ReadonlyArray<any> | ArrayLike<any> | Record<any, any>
> = T extends ReadonlyArray<any>
  ? T[number]
  : T extends ArrayLike<any>
  ? T[number]
  : T extends object
  ? T[keyof T]
  : never;
export type ElementType<T extends ReadonlyArray<unknown>> =
  T extends ReadonlyArray<infer ElementType> ? ElementType : never;
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


// ===== RXJS Namespace =====
declare namespace RXJS {
  type AnyCatcher = typeof anyCatcherSymbol;

  class AsyncSubject<T> extends Subject<T> {
      private _value;
      private _hasValue;
      private _isComplete;
      next(value: T): void;
      complete(): void;
  }

  class BehaviorSubject<T> extends Subject<T> {
      private _value;
      constructor(_value: T);
      get value(): T;
      getValue(): T;
      next(value: T): void;
  }

  interface GlobalConfig {
      /**
       * A registration point for unhandled errors from RxJS. These are errors that
       * cannot were not handled by consuming code in the usual subscription path. For
       * example, if you have this configured, and you subscribe to an observable without
       * providing an error handler, errors from that subscription will end up here. This
       * will _always_ be called asynchronously on another job in the runtime. This is because
       * we do not want errors thrown in this user-configured handler to interfere with the
       * behavior of the library.
       */
      onUnhandledError: ((err: any) => void) | null;
      /**
       * A registration point for notifications that cannot be sent to subscribers because they
       * have completed, errored or have been explicitly unsubscribed. By default, next, complete
       * and error notifications sent to stopped subscribers are noops. However, sometimes callers
       * might want a different behavior. For example, with sources that attempt to report errors
       * to stopped subscribers, a caller can configure RxJS to throw an unhandled error instead.
       * This will _always_ be called asynchronously on another job in the runtime. This is because
       * we do not want errors thrown in this user-configured handler to interfere with the
       * behavior of the library.
       */
      onStoppedNotification: ((notification: ObservableNotification<any>, subscriber: Subscriber<any>) => void) | null;
      /**
       * The promise constructor used by default for {@link Observable#toPromise toPromise} and {@link Observable#forEach forEach}
       * methods.
       *
       * @deprecated As of version 8, RxJS will no longer support this sort of injection of a
       * Promise constructor. If you need a Promise implementation other than native promises,
       * please polyfill/patch Promise as you see appropriate. Will be removed in v8.
       */
      Promise?: PromiseConstructorLike;
      /**
       * If true, turns on synchronous error rethrowing, which is a deprecated behavior
       * in v6 and higher. This behavior enables bad patterns like wrapping a subscribe
       * call in a try/catch block. It also enables producer interference, a nasty bug
       * where a multicast can be broken for all observers by a downstream consumer with
       * an unhandled error. DO NOT USE THIS FLAG UNLESS IT'S NEEDED TO BUY TIME
       * FOR MIGRATION REASONS.
       *
       * @deprecated As of version 8, RxJS will no longer support synchronous throwing
       * of unhandled errors. All errors will be thrown on a separate call stack to prevent bad
       * behaviors described above. Will be removed in v8.
       */
      useDeprecatedSynchronousErrorHandling: boolean;
      /**
       * If true, enables an as-of-yet undocumented feature from v5: The ability to access
       * `unsubscribe()` via `this` context in `next` functions created in observers passed
       * to `subscribe`.
       *
       * This is being removed because the performance was severely problematic, and it could also cause
       * issues when types other than POJOs are passed to subscribe as subscribers, as they will likely have
       * their `this` context overwritten.
       *
       * @deprecated As of version 8, RxJS will no longer support altering the
       * context of next functions provided as part of an observer to Subscribe. Instead,
       * you will have access to a subscription or a signal or token that will allow you to do things like
       * unsubscribe and test closed status. Will be removed in v8.
       */
      useDeprecatedNextContext: boolean;
  }

  interface FirstValueFromConfig<T> {
      defaultValue: T;
  }

  interface LastValueFromConfig<T> {
      defaultValue: T;
  }

  enum NotificationKind {
      NEXT = "N",
      ERROR = "E",
      COMPLETE = "C"
  }

  class Notification<T> {
      readonly kind: 'N' | 'E' | 'C';
      readonly value?: T | undefined;
      readonly error?: any;
      /**
       * A value signifying that the notification will "next" if observed. In truth,
       * This is really synonymous with just checking `kind === "N"`.
       * @deprecated Will be removed in v8. Instead, just check to see if the value of `kind` is `"N"`.
       */
      readonly hasValue: boolean;
      /**
       * Creates a "Next" notification object.
       * @param kind Always `'N'`
       * @param value The value to notify with if observed.
       * @deprecated Internal implementation detail. Use {@link Notification#createNext createNext} instead.
       */
      constructor(kind: 'N', value?: T);
      /**
       * Creates an "Error" notification object.
       * @param kind Always `'E'`
       * @param value Always `undefined`
       * @param error The error to notify with if observed.
       * @deprecated Internal implementation detail. Use {@link Notification#createError createError} instead.
       */
      constructor(kind: 'E', value: undefined, error: any);
      /**
       * Creates a "completion" notification object.
       * @param kind Always `'C'`
       * @deprecated Internal implementation detail. Use {@link Notification#createComplete createComplete} instead.
       */
      constructor(kind: 'C');
      /**
       * Executes the appropriate handler on a passed `observer` given the `kind` of notification.
       * If the handler is missing it will do nothing. Even if the notification is an error, if
       * there is no error handler on the observer, an error will not be thrown, it will noop.
       * @param observer The observer to notify.
       */
      observe(observer: PartialObserver<T>): void;
      /**
       * Executes a notification on the appropriate handler from a list provided.
       * If a handler is missing for the kind of notification, nothing is called
       * and no error is thrown, it will be a noop.
       * @param next A next handler
       * @param error An error handler
       * @param complete A complete handler
       * @deprecated Replaced with {@link Notification#observe observe}. Will be removed in v8.
       */
      do(next: (value: T) => void, error: (err: any) => void, complete: () => void): void;
      /**
       * Executes a notification on the appropriate handler from a list provided.
       * If a handler is missing for the kind of notification, nothing is called
       * and no error is thrown, it will be a noop.
       * @param next A next handler
       * @param error An error handler
       * @deprecated Replaced with {@link Notification#observe observe}. Will be removed in v8.
       */
      do(next: (value: T) => void, error: (err: any) => void): void;
      /**
       * Executes the next handler if the Notification is of `kind` `"N"`. Otherwise
       * this will not error, and it will be a noop.
       * @param next The next handler
       * @deprecated Replaced with {@link Notification#observe observe}. Will be removed in v8.
       */
      do(next: (value: T) => void): void;
      /**
       * Executes a notification on the appropriate handler from a list provided.
       * If a handler is missing for the kind of notification, nothing is called
       * and no error is thrown, it will be a noop.
       * @param next A next handler
       * @param error An error handler
       * @param complete A complete handler
       * @deprecated Replaced with {@link Notification#observe observe}. Will be removed in v8.
       */
      accept(next: (value: T) => void, error: (err: any) => void, complete: () => void): void;
      /**
       * Executes a notification on the appropriate handler from a list provided.
       * If a handler is missing for the kind of notification, nothing is called
       * and no error is thrown, it will be a noop.
       * @param next A next handler
       * @param error An error handler
       * @deprecated Replaced with {@link Notification#observe observe}. Will be removed in v8.
       */
      accept(next: (value: T) => void, error: (err: any) => void): void;
      /**
       * Executes the next handler if the Notification is of `kind` `"N"`. Otherwise
       * this will not error, and it will be a noop.
       * @param next The next handler
       * @deprecated Replaced with {@link Notification#observe observe}. Will be removed in v8.
       */
      accept(next: (value: T) => void): void;
      /**
       * Executes the appropriate handler on a passed `observer` given the `kind` of notification.
       * If the handler is missing it will do nothing. Even if the notification is an error, if
       * there is no error handler on the observer, an error will not be thrown, it will noop.
       * @param observer The observer to notify.
       * @deprecated Replaced with {@link Notification#observe observe}. Will be removed in v8.
       */
      accept(observer: PartialObserver<T>): void;
      /**
       * Returns a simple Observable that just delivers the notification represented
       * by this Notification instance.
       *
       * @deprecated Will be removed in v8. To convert a `Notification` to an {@link Observable},
       * use {@link of} and {@link dematerialize}: `of(notification).pipe(dematerialize())`.
       */
      toObservable(): Observable<T>;
      private static completeNotification;
      /**
       * A shortcut to create a Notification instance of the type `next` from a
       * given value.
       * @param value The `next` value.
       * @return The "next" Notification representing the argument.
       * @deprecated It is NOT recommended to create instances of `Notification` directly.
       * Rather, try to create POJOs matching the signature outlined in {@link ObservableNotification}.
       * For example: `{ kind: 'N', value: 1 }`, `{ kind: 'E', error: new Error('bad') }`, or `{ kind: 'C' }`.
       * Will be removed in v8.
       */
      static createNext<T>(value: T): Notification<T> & NextNotification<T>;
      /**
       * A shortcut to create a Notification instance of the type `error` from a
       * given error.
       * @param err The `error` error.
       * @return The "error" Notification representing the argument.
       * @deprecated It is NOT recommended to create instances of `Notification` directly.
       * Rather, try to create POJOs matching the signature outlined in {@link ObservableNotification}.
       * For example: `{ kind: 'N', value: 1 }`, `{ kind: 'E', error: new Error('bad') }`, or `{ kind: 'C' }`.
       * Will be removed in v8.
       */
      static createError(err?: any): Notification<never> & ErrorNotification;
      /**
       * A shortcut to create a Notification instance of the type `complete`.
       * @return The valueless "complete" Notification.
       * @deprecated It is NOT recommended to create instances of `Notification` directly.
       * Rather, try to create POJOs matching the signature outlined in {@link ObservableNotification}.
       * For example: `{ kind: 'N', value: 1 }`, `{ kind: 'E', error: new Error('bad') }`, or `{ kind: 'C' }`.
       * Will be removed in v8.
       */
      static createComplete(): Notification<never> & CompleteNotification;
  }

  class Observable<T> implements Subscribable<T> {
      /**
       * @deprecated Internal implementation detail, do not use directly. Will be made internal in v8.
       */
      source: Observable<any> | undefined;
      /**
       * @deprecated Internal implementation detail, do not use directly. Will be made internal in v8.
       */
      operator: Operator<any, T> | undefined;
      /**
       * @param subscribe The function that is called when the Observable is
       * initially subscribed to. This function is given a Subscriber, to which new values
       * can be `next`ed, or an `error` method can be called to raise an error, or
       * `complete` can be called to notify of a successful completion.
       */
      constructor(subscribe?: (this: Observable<T>, subscriber: Subscriber<T>) => TeardownLogic);
      /**
       * Creates a new Observable by calling the Observable constructor
       * @param subscribe the subscriber function to be passed to the Observable constructor
       * @return A new observable.
       * @deprecated Use `new Observable()` instead. Will be removed in v8.
       */
      static create: (...args: any[]) => any;
      /**
       * Creates a new Observable, with this Observable instance as the source, and the passed
       * operator defined as the new observable's operator.
       * @param operator the operator defining the operation to take on the observable
       * @return A new observable with the Operator applied.
       * @deprecated Internal implementation detail, do not use directly. Will be made internal in v8.
       * If you have implemented an operator using `lift`, it is recommended that you create an
       * operator by simply returning `new Observable()` directly. See "Creating new operators from
       * scratch" section here: https://rxjs.dev/guide/operators
       */
      lift<R>(operator?: Operator<T, R>): Observable<R>;
      subscribe(observerOrNext?: Partial<Observer<T>> | ((value: T) => void)): Subscription;
      /** @deprecated Instead of passing separate callback arguments, use an observer argument. Signatures taking separate callback arguments will be removed in v8. Details: https://rxjs.dev/deprecations/subscribe-arguments */
      subscribe(next?: ((value: T) => void) | null, error?: ((error: any) => void) | null, complete?: (() => void) | null): Subscription;
      /**
       * Used as a NON-CANCELLABLE means of subscribing to an observable, for use with
       * APIs that expect promises, like `async/await`. You cannot unsubscribe from this.
       *
       * **WARNING**: Only use this with observables you *know* will complete. If the source
       * observable does not complete, you will end up with a promise that is hung up, and
       * potentially all of the state of an async function hanging out in memory. To avoid
       * this situation, look into adding something like {@link timeout}, {@link take},
       * {@link takeWhile}, or {@link takeUntil} amongst others.
       *
       * #### Example
       *
       * ```ts
       * import { interval, take } from 'rxjs';
       *
       * const source$ = interval(1000).pipe(take(4));
       *
       * async function getTotal() {
       *   let total = 0;
       *
       *   await source$.forEach(value => {
       *     total += value;
       *     console.log('observable -> ' + value);
       *   });
       *
       *   return total;
       * }
       *
       * getTotal().then(
       *   total => console.log('Total: ' + total)
       * );
       *
       * // Expected:
       * // 'observable -> 0'
       * // 'observable -> 1'
       * // 'observable -> 2'
       * // 'observable -> 3'
       * // 'Total: 6'
       * ```
       *
       * @param next A handler for each value emitted by the observable.
       * @return A promise that either resolves on observable completion or
       * rejects with the handled error.
       */
      forEach(next: (value: T) => void): Promise<void>;
      /**
       * @param next a handler for each value emitted by the observable
       * @param promiseCtor a constructor function used to instantiate the Promise
       * @return a promise that either resolves on observable completion or
       *  rejects with the handled error
       * @deprecated Passing a Promise constructor will no longer be available
       * in upcoming versions of RxJS. This is because it adds weight to the library, for very
       * little benefit. If you need this functionality, it is recommended that you either
       * polyfill Promise, or you create an adapter to convert the returned native promise
       * to whatever promise implementation you wanted. Will be removed in v8.
       */
      forEach(next: (value: T) => void, promiseCtor: PromiseConstructorLike): Promise<void>;
      pipe(): Observable<T>;
      pipe<A>(op1: OperatorFunction<T, A>): Observable<A>;
      pipe<A, B>(op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>): Observable<B>;
      pipe<A, B, C>(op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>): Observable<C>;
      pipe<A, B, C, D>(op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>, op4: OperatorFunction<C, D>): Observable<D>;
      pipe<A, B, C, D, E>(op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>, op4: OperatorFunction<C, D>, op5: OperatorFunction<D, E>): Observable<E>;
      pipe<A, B, C, D, E, F>(op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>, op4: OperatorFunction<C, D>, op5: OperatorFunction<D, E>, op6: OperatorFunction<E, F>): Observable<F>;
      pipe<A, B, C, D, E, F, G>(op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>, op4: OperatorFunction<C, D>, op5: OperatorFunction<D, E>, op6: OperatorFunction<E, F>, op7: OperatorFunction<F, G>): Observable<G>;
      pipe<A, B, C, D, E, F, G, H>(op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>, op4: OperatorFunction<C, D>, op5: OperatorFunction<D, E>, op6: OperatorFunction<E, F>, op7: OperatorFunction<F, G>, op8: OperatorFunction<G, H>): Observable<H>;
      pipe<A, B, C, D, E, F, G, H, I>(op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>, op4: OperatorFunction<C, D>, op5: OperatorFunction<D, E>, op6: OperatorFunction<E, F>, op7: OperatorFunction<F, G>, op8: OperatorFunction<G, H>, op9: OperatorFunction<H, I>): Observable<I>;
      pipe<A, B, C, D, E, F, G, H, I>(op1: OperatorFunction<T, A>, op2: OperatorFunction<A, B>, op3: OperatorFunction<B, C>, op4: OperatorFunction<C, D>, op5: OperatorFunction<D, E>, op6: OperatorFunction<E, F>, op7: OperatorFunction<F, G>, op8: OperatorFunction<G, H>, op9: OperatorFunction<H, I>, ...operations: OperatorFunction<any, any>[]): Observable<unknown>;
      /** @deprecated Replaced with {@link firstValueFrom} and {@link lastValueFrom}. Will be removed in v8. Details: https://rxjs.dev/deprecations/to-promise */
      toPromise(): Promise<T | undefined>;
      /** @deprecated Replaced with {@link firstValueFrom} and {@link lastValueFrom}. Will be removed in v8. Details: https://rxjs.dev/deprecations/to-promise */
      toPromise(PromiseCtor: typeof Promise): Promise<T | undefined>;
      /** @deprecated Replaced with {@link firstValueFrom} and {@link lastValueFrom}. Will be removed in v8. Details: https://rxjs.dev/deprecations/to-promise */
      toPromise(PromiseCtor: PromiseConstructorLike): Promise<T | undefined>;
  }

  interface Operator<T, R> {
      call(subscriber: Subscriber<R>, source: any): TeardownLogic;
  }

  class ReplaySubject<T> extends Subject<T> {
      private _bufferSize;
      private _windowTime;
      private _timestampProvider;
      private _buffer;
      private _infiniteTimeWindow;
      /**
       * @param _bufferSize The size of the buffer to replay on subscription
       * @param _windowTime The amount of time the buffered items will stay buffered
       * @param _timestampProvider An object with a `now()` method that provides the current timestamp. This is used to
       * calculate the amount of time something has been buffered.
       */
      constructor(_bufferSize?: number, _windowTime?: number, _timestampProvider?: TimestampProvider);
      next(value: T): void;
      private _trimBuffer;
  }

  class Scheduler implements SchedulerLike {
      private schedulerActionCtor;
      static now: () => number;
      constructor(schedulerActionCtor: typeof Action, now?: () => number);
      /**
       * A getter method that returns a number representing the current time
       * (at the time this function was called) according to the scheduler's own
       * internal clock.
       * @return A number that represents the current time. May or may not
       * have a relation to wall-clock time. May or may not refer to a time unit
       * (e.g. milliseconds).
       */
      now: () => number;
      /**
       * Schedules a function, `work`, for execution. May happen at some point in
       * the future, according to the `delay` parameter, if specified. May be passed
       * some context object, `state`, which will be passed to the `work` function.
       *
       * The given arguments will be processed an stored as an Action object in a
       * queue of actions.
       *
       * @param work A function representing a task, or some unit of work to be
       * executed by the Scheduler.
       * @param delay Time to wait before executing the work, where the time unit is
       * implicit and defined by the Scheduler itself.
       * @param state Some contextual data that the `work` function uses when called
       * by the Scheduler.
       * @return A subscription in order to be able to unsubscribe the scheduled work.
       */
      schedule<T>(work: (this: SchedulerAction<T>, state?: T) => void, delay?: number, state?: T): Subscription;
  }

  class Subject<T> extends Observable<T> implements SubscriptionLike {
      closed: boolean;
      private currentObservers;
      /** @deprecated Internal implementation detail, do not use directly. Will be made internal in v8. */
      observers: Observer<T>[];
      /** @deprecated Internal implementation detail, do not use directly. Will be made internal in v8. */
      isStopped: boolean;
      /** @deprecated Internal implementation detail, do not use directly. Will be made internal in v8. */
      hasError: boolean;
      /** @deprecated Internal implementation detail, do not use directly. Will be made internal in v8. */
      thrownError: any;
      /**
       * Creates a "subject" by basically gluing an observer to an observable.
       *
       * @deprecated Recommended you do not use. Will be removed at some point in the future. Plans for replacement still under discussion.
       */
      static create: (...args: any[]) => any;
      constructor();
      /** @deprecated Internal implementation detail, do not use directly. Will be made internal in v8. */
      lift<R>(operator: Operator<T, R>): Observable<R>;
      next(value: T): void;
      error(err: any): void;
      complete(): void;
      unsubscribe(): void;
      get observed(): boolean;
      /**
       * Creates a new Observable with this Subject as the source. You can do this
       * to create custom Observer-side logic of the Subject and conceal it from
       * code that uses the Observable.
       * @return Observable that this Subject casts to.
       */
      asObservable(): Observable<T>;
  }

  class AnonymousSubject<T> extends Subject<T> {
      /** @deprecated Internal implementation detail, do not use directly. Will be made internal in v8. */
      destination?: Observer<T> | undefined;
      constructor(
      /** @deprecated Internal implementation detail, do not use directly. Will be made internal in v8. */
      destination?: Observer<T> | undefined, source?: Observable<T>);
      next(value: T): void;
      error(err: any): void;
      complete(): void;
  }

  class Subscriber<T> extends Subscription implements Observer<T> {
      /**
       * A static factory for a Subscriber, given a (potentially partial) definition
       * of an Observer.
       * @param next The `next` callback of an Observer.
       * @param error The `error` callback of an
       * Observer.
       * @param complete The `complete` callback of an
       * Observer.
       * @return A Subscriber wrapping the (partially defined)
       * Observer represented by the given arguments.
       * @deprecated Do not use. Will be removed in v8. There is no replacement for this
       * method, and there is no reason to be creating instances of `Subscriber` directly.
       * If you have a specific use case, please file an issue.
       */
      static create<T>(next?: (x?: T) => void, error?: (e?: any) => void, complete?: () => void): Subscriber<T>;
      /** @deprecated Internal implementation detail, do not use directly. Will be made internal in v8. */
      protected isStopped: boolean;
      /** @deprecated Internal implementation detail, do not use directly. Will be made internal in v8. */
      protected destination: Subscriber<any> | Observer<any>;
      /**
       * @deprecated Internal implementation detail, do not use directly. Will be made internal in v8.
       * There is no reason to directly create an instance of Subscriber. This type is exported for typings reasons.
       */
      constructor(destination?: Subscriber<any> | Observer<any>);
      /**
       * The {@link Observer} callback to receive notifications of type `next` from
       * the Observable, with a value. The Observable may call this method 0 or more
       * times.
       * @param value The `next` value.
       */
      next(value: T): void;
      /**
       * The {@link Observer} callback to receive notifications of type `error` from
       * the Observable, with an attached `Error`. Notifies the Observer that
       * the Observable has experienced an error condition.
       * @param err The `error` exception.
       */
      error(err?: any): void;
      /**
       * The {@link Observer} callback to receive a valueless notification of type
       * `complete` from the Observable. Notifies the Observer that the Observable
       * has finished sending push-based notifications.
       */
      complete(): void;
      unsubscribe(): void;
      protected _next(value: T): void;
      protected _error(err: any): void;
      protected _complete(): void;
  }

  class SafeSubscriber<T> extends Subscriber<T> {
      constructor(observerOrNext?: Partial<Observer<T>> | ((value: T) => void) | null, error?: ((e?: any) => void) | null, complete?: (() => void) | null);
  }

  class Subscription implements SubscriptionLike {
      private initialTeardown?;
      static EMPTY: Subscription;
      /**
       * A flag to indicate whether this Subscription has already been unsubscribed.
       */
      closed: boolean;
      private _parentage;
      /**
       * The list of registered finalizers to execute upon unsubscription. Adding and removing from this
       * list occurs in the {@link #add} and {@link #remove} methods.
       */
      private _finalizers;
      /**
       * @param initialTeardown A function executed first as part of the finalization
       * process that is kicked off when {@link #unsubscribe} is called.
       */
      constructor(initialTeardown?: (() => void) | undefined);
      /**
       * Disposes the resources held by the subscription. May, for instance, cancel
       * an ongoing Observable execution or cancel any other type of work that
       * started when the Subscription was created.
       */
      unsubscribe(): void;
      /**
       * Adds a finalizer to this subscription, so that finalization will be unsubscribed/called
       * when this subscription is unsubscribed. If this subscription is already {@link #closed},
       * because it has already been unsubscribed, then whatever finalizer is passed to it
       * will automatically be executed (unless the finalizer itself is also a closed subscription).
       *
       * Closed Subscriptions cannot be added as finalizers to any subscription. Adding a closed
       * subscription to a any subscription will result in no operation. (A noop).
       *
       * Adding a subscription to itself, or adding `null` or `undefined` will not perform any
       * operation at all. (A noop).
       *
       * `Subscription` instances that are added to this instance will automatically remove themselves
       * if they are unsubscribed. Functions and {@link Unsubscribable} objects that you wish to remove
       * will need to be removed manually with {@link #remove}
       *
       * @param teardown The finalization logic to add to this subscription.
       */
      add(teardown: TeardownLogic): void;
      /**
       * Checks to see if a this subscription already has a particular parent.
       * This will signal that this subscription has already been added to the parent in question.
       * @param parent the parent to check for
       */
      private _hasParent;
      /**
       * Adds a parent to this subscription so it can be removed from the parent if it
       * unsubscribes on it's own.
       *
       * NOTE: THIS ASSUMES THAT {@link _hasParent} HAS ALREADY BEEN CHECKED.
       * @param parent The parent subscription to add
       */
      private _addParent;
      /**
       * Called on a child when it is removed via {@link #remove}.
       * @param parent The parent to remove
       */
      private _removeParent;
      /**
       * Removes a finalizer from this subscription that was previously added with the {@link #add} method.
       *
       * Note that `Subscription` instances, when unsubscribed, will automatically remove themselves
       * from every other `Subscription` they have been added to. This means that using the `remove` method
       * is not a common thing and should be used thoughtfully.
       *
       * If you add the same finalizer instance of a function or an unsubscribable object to a `Subscription` instance
       * more than once, you will need to call `remove` the same number of times to remove all instances.
       *
       * All finalizer instances are removed to free up memory upon unsubscription.
       *
       * @param teardown The finalizer to remove from this subscription
       */
      remove(teardown: Exclude<TeardownLogic, void>): void;
  }

  interface UnaryFunction<T, R> {
      (source: T): R;
  }

  interface OperatorFunction<T, R> extends UnaryFunction<Observable<T>, Observable<R>> {
  }

  type FactoryOrValue<T> = T | (() => T);

  interface MonoTypeOperatorFunction<T> extends OperatorFunction<T, T> {
  }

  interface Timestamp<T> {
      value: T;
      /**
       * The timestamp. By default, this is in epoch milliseconds.
       * Could vary based on the timestamp provider passed to the operator.
       */
      timestamp: number;
  }

  interface TimeInterval<T> {
      value: T;
      /**
       * The amount of time between this value's emission and the previous value's emission.
       * If this is the first emitted value, then it will be the amount of time since subscription
       * started.
       */
      interval: number;
  }

  interface Unsubscribable {
      unsubscribe(): void;
  }

  type TeardownLogic = Subscription | Unsubscribable | (() => void) | void;

  interface SubscriptionLike extends Unsubscribable {
      unsubscribe(): void;
      readonly closed: boolean;
  }

  type SubscribableOrPromise<T> = Subscribable<T> | Subscribable<never> | PromiseLike<T> | InteropObservable<T>;

  interface Subscribable<T> {
      subscribe(observer: Partial<Observer<T>>): Unsubscribable;
  }

  type ObservableInput<T> = Observable<T> | InteropObservable<T> | AsyncIterable<T> | PromiseLike<T> | ArrayLike<T> | Iterable<T> | ReadableStreamLike<T>;

  type ObservableLike<T> = InteropObservable<T>;

  interface InteropObservable<T> {
      [Symbol.observable]: () => Subscribable<T>;
  }

  interface NextNotification<T> {
      /** The kind of notification. Always "N" */
      kind: 'N';
      /** The value of the notification. */
      value: T;
  }

  interface ErrorNotification {
      /** The kind of notification. Always "E" */
      kind: 'E';
      error: any;
  }

  interface CompleteNotification {
      kind: 'C';
  }

  type ObservableNotification<T> = NextNotification<T> | ErrorNotification | CompleteNotification;

  interface NextObserver<T> {
      closed?: boolean;
      next: (value: T) => void;
      error?: (err: any) => void;
      complete?: () => void;
  }

  interface ErrorObserver<T> {
      closed?: boolean;
      next?: (value: T) => void;
      error: (err: any) => void;
      complete?: () => void;
  }

  interface CompletionObserver<T> {
      closed?: boolean;
      next?: (value: T) => void;
      error?: (err: any) => void;
      complete: () => void;
  }

  type PartialObserver<T> = NextObserver<T> | ErrorObserver<T> | CompletionObserver<T>;

  interface Observer<T> {
      /**
       * A callback function that gets called by the producer during the subscription when
       * the producer "has" the `value`. It won't be called if `error` or `complete` callback
       * functions have been called, nor after the consumer has unsubscribed.
       *
       * For more info, please refer to {@link guide/glossary-and-semantics#next this guide}.
       */
      next: (value: T) => void;
      /**
       * A callback function that gets called by the producer if and when it encountered a
       * problem of any kind. The errored value will be provided through the `err` parameter.
       * This callback can't be called more than one time, it can't be called if the
       * `complete` callback function have been called previously, nor it can't be called if
       * the consumer has unsubscribed.
       *
       * For more info, please refer to {@link guide/glossary-and-semantics#error this guide}.
       */
      error: (err: any) => void;
      /**
       * A callback function that gets called by the producer if and when it has no more
       * values to provide (by calling `next` callback function). This means that no error
       * has happened. This callback can't be called more than one time, it can't be called
       * if the `error` callback function have been called previously, nor it can't be called
       * if the consumer has unsubscribed.
       *
       * For more info, please refer to {@link guide/glossary-and-semantics#complete this guide}.
       */
      complete: () => void;
  }

  interface SubjectLike<T> extends Observer<T>, Subscribable<T> {
  }

  interface SchedulerLike extends TimestampProvider {
      schedule<T>(work: (this: SchedulerAction<T>, state: T) => void, delay: number, state: T): Subscription;
      schedule<T>(work: (this: SchedulerAction<T>, state?: T) => void, delay: number, state?: T): Subscription;
      schedule<T>(work: (this: SchedulerAction<T>, state?: T) => void, delay?: number, state?: T): Subscription;
  }

  interface SchedulerAction<T> extends Subscription {
      schedule(state?: T, delay?: number): Subscription;
  }

  interface TimestampProvider {
      /**
       * Returns a timestamp as a number.
       *
       * This is used by types like `ReplaySubject` or operators like `timestamp` to calculate
       * the amount of time passed between events.
       */
      now(): number;
  }

  type ObservedValueOf<O> = O extends ObservableInput<infer T> ? T : never;

  type ObservedValueUnionFromArray<X> = X extends Array<ObservableInput<infer T>> ? T : never;

  type ObservedValuesFromArray<X> = ObservedValueUnionFromArray<X>;

  type ObservedValueTupleFromArray<X> = {
      [K in keyof X]: ObservedValueOf<X[K]>;
  };

  type ObservableInputTuple<T> = {
      [K in keyof T]: ObservableInput<T[K]>;
  };

  type Cons<X, Y extends readonly any[]> = ((arg: X, ...rest: Y) => any) extends (...args: infer U) => any ? U : never;

  type Head<X extends readonly any[]> = ((...args: X) => any) extends (arg: infer U, ...rest: any[]) => any ? U : never;

  type Tail<X extends readonly any[]> = ((...args: X) => any) extends (arg: any, ...rest: infer U) => any ? U : never;

  type ValueFromArray<A extends readonly unknown[]> = A extends Array<infer T> ? T : never;

  type ValueFromNotification<T> = T extends {
      kind: 'N' | 'E' | 'C';
  } ? T extends NextNotification<any> ? T extends {
      value: infer V;
  } ? V : undefined : never : never;

  type Falsy = null | undefined | false | 0 | -0 | 0n | '';

  type TruthyTypesOf<T> = T extends Falsy ? never : T;

  interface ReadableStreamDefaultReaderLike<T> {
      read(): PromiseLike<{
          done: false;
          value: T;
      } | {
          done: true;
          value?: undefined;
      }>;
      releaseLock(): void;
  }

  interface ReadableStreamLike<T> {
      getReader(): ReadableStreamDefaultReaderLike<T>;
  }

  interface Connectable<T> extends Observable<T> {
      /**
       * (Idempotent) Calling this method will connect the underlying source observable to all subscribed consumers
       * through an underlying {@link Subject}.
       * @returns A subscription, that when unsubscribed, will "disconnect" the source from the connector subject,
       * severing notifications to all consumers.
       */
      connect(): Subscription;
  }

  interface AjaxCreationMethod {
      /**
       * Creates an observable that will perform an AJAX request using the
       * [XMLHttpRequest](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest) in
       * global scope by default.
       *
       * This is the most configurable option, and the basis for all other AJAX calls in the library.
       *
       * ## Example
       *
       * ```ts
       * import { ajax } from 'rxjs/ajax';
       * import { map, catchError, of } from 'rxjs';
       *
       * const obs$ = ajax({
       *   method: 'GET',
       *   url: 'https://api.github.com/users?per_page=5',
       *   responseType: 'json'
       * }).pipe(
       *   map(userResponse => console.log('users: ', userResponse)),
       *   catchError(error => {
       *     console.log('error: ', error);
       *     return of(error);
       *   })
       * );
       * ```
       */
      <T>(config: AjaxConfig): Observable<AjaxResponse<T>>;
      /**
       * Perform an HTTP GET using the
       * [XMLHttpRequest](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest) in
       * global scope. Defaults to a `responseType` of `"json"`.
       *
       * ## Example
       *
       * ```ts
       * import { ajax } from 'rxjs/ajax';
       * import { map, catchError, of } from 'rxjs';
       *
       * const obs$ = ajax('https://api.github.com/users?per_page=5').pipe(
       *   map(userResponse => console.log('users: ', userResponse)),
       *   catchError(error => {
       *     console.log('error: ', error);
       *     return of(error);
       *   })
       * );
       * ```
       */
      <T>(url: string): Observable<AjaxResponse<T>>;
      /**
       * Performs an HTTP GET using the
       * [XMLHttpRequest](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest) in
       * global scope by default, and a `responseType` of `"json"`.
       *
       * @param url The URL to get the resource from
       * @param headers Optional headers. Case-Insensitive.
       */
      get<T>(url: string, headers?: Record<string, string>): Observable<AjaxResponse<T>>;
      /**
       * Performs an HTTP POST using the
       * [XMLHttpRequest](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest) in
       * global scope by default, and a `responseType` of `"json"`.
       *
       * Before sending the value passed to the `body` argument, it is automatically serialized
       * based on the specified `responseType`. By default, a JavaScript object will be serialized
       * to JSON. A `responseType` of `application/x-www-form-urlencoded` will flatten any provided
       * dictionary object to a url-encoded string.
       *
       * @param url The URL to get the resource from
       * @param body The content to send. The body is automatically serialized.
       * @param headers Optional headers. Case-Insensitive.
       */
      post<T>(url: string, body?: any, headers?: Record<string, string>): Observable<AjaxResponse<T>>;
      /**
       * Performs an HTTP PUT using the
       * [XMLHttpRequest](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest) in
       * global scope by default, and a `responseType` of `"json"`.
       *
       * Before sending the value passed to the `body` argument, it is automatically serialized
       * based on the specified `responseType`. By default, a JavaScript object will be serialized
       * to JSON. A `responseType` of `application/x-www-form-urlencoded` will flatten any provided
       * dictionary object to a url-encoded string.
       *
       * @param url The URL to get the resource from
       * @param body The content to send. The body is automatically serialized.
       * @param headers Optional headers. Case-Insensitive.
       */
      put<T>(url: string, body?: any, headers?: Record<string, string>): Observable<AjaxResponse<T>>;
      /**
       * Performs an HTTP PATCH using the
       * [XMLHttpRequest](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest) in
       * global scope by default, and a `responseType` of `"json"`.
       *
       * Before sending the value passed to the `body` argument, it is automatically serialized
       * based on the specified `responseType`. By default, a JavaScript object will be serialized
       * to JSON. A `responseType` of `application/x-www-form-urlencoded` will flatten any provided
       * dictionary object to a url-encoded string.
       *
       * @param url The URL to get the resource from
       * @param body The content to send. The body is automatically serialized.
       * @param headers Optional headers. Case-Insensitive.
       */
      patch<T>(url: string, body?: any, headers?: Record<string, string>): Observable<AjaxResponse<T>>;
      /**
       * Performs an HTTP DELETE using the
       * [XMLHttpRequest](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest) in
       * global scope by default, and a `responseType` of `"json"`.
       *
       * @param url The URL to get the resource from
       * @param headers Optional headers. Case-Insensitive.
       */
      delete<T>(url: string, headers?: Record<string, string>): Observable<AjaxResponse<T>>;
      /**
       * Performs an HTTP GET using the
       * [XMLHttpRequest](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest) in
       * global scope by default, and returns the hydrated JavaScript object from the
       * response.
       *
       * @param url The URL to get the resource from
       * @param headers Optional headers. Case-Insensitive.
       */
      getJSON<T>(url: string, headers?: Record<string, string>): Observable<T>;
  }

  class AjaxResponse<T> {
      /**
       * The original event object from the raw XHR event.
       */
      readonly originalEvent: ProgressEvent;
      /**
       * The XMLHttpRequest object used to make the request.
       * NOTE: It is advised not to hold this in memory, as it will retain references to all of it's event handlers
       * and many other things related to the request.
       */
      readonly xhr: XMLHttpRequest;
      /**
       * The request parameters used to make the HTTP request.
       */
      readonly request: AjaxRequest;
      /**
       * The event type. This can be used to discern between different events
       * if you're using progress events with {@link includeDownloadProgress} or
       * {@link includeUploadProgress} settings in {@link AjaxConfig}.
       *
       * The event type consists of two parts: the {@link AjaxDirection} and the
       * the event type. Merged with `_`, they form the `type` string. The
       * direction can be an `upload` or a `download` direction, while an event can
       * be `loadstart`, `progress` or `load`.
       *
       * `download_load` is the type of event when download has finished and the
       * response is available.
       */
      readonly type: AjaxResponseType;
      /** The HTTP status code */
      readonly status: number;
      /**
       * The response data, if any. Note that this will automatically be converted to the proper type
       */
      readonly response: T;
      /**
       * The responseType set on the request. (For example: `""`, `"arraybuffer"`, `"blob"`, `"document"`, `"json"`, or `"text"`)
       * @deprecated There isn't much reason to examine this. It's the same responseType set (or defaulted) on the ajax config.
       * If you really need to examine this value, you can check it on the `request` or the `xhr`. Will be removed in v8.
       */
      readonly responseType: XMLHttpRequestResponseType;
      /**
       * The total number of bytes loaded so far. To be used with {@link total} while
       * calculating progress. (You will want to set {@link includeDownloadProgress} or
       * {@link includeDownloadProgress})
       */
      readonly loaded: number;
      /**
       * The total number of bytes to be loaded. To be used with {@link loaded} while
       * calculating progress. (You will want to set {@link includeDownloadProgress} or
       * {@link includeDownloadProgress})
       */
      readonly total: number;
      /**
       * A dictionary of the response headers.
       */
      readonly responseHeaders: Record<string, string>;
      /**
       * A normalized response from an AJAX request. To get the data from the response,
       * you will want to read the `response` property.
       *
       * - DO NOT create instances of this class directly.
       * - DO NOT subclass this class.
       *
       * @param originalEvent The original event object from the XHR `onload` event.
       * @param xhr The `XMLHttpRequest` object used to make the request. This is useful for examining status code, etc.
       * @param request The request settings used to make the HTTP request.
       * @param type The type of the event emitted by the {@link ajax} Observable
       */
      constructor(
      /**
       * The original event object from the raw XHR event.
       */
      originalEvent: ProgressEvent, 
      /**
       * The XMLHttpRequest object used to make the request.
       * NOTE: It is advised not to hold this in memory, as it will retain references to all of it's event handlers
       * and many other things related to the request.
       */
      xhr: XMLHttpRequest, 
      /**
       * The request parameters used to make the HTTP request.
       */
      request: AjaxRequest, 
      /**
       * The event type. This can be used to discern between different events
       * if you're using progress events with {@link includeDownloadProgress} or
       * {@link includeUploadProgress} settings in {@link AjaxConfig}.
       *
       * The event type consists of two parts: the {@link AjaxDirection} and the
       * the event type. Merged with `_`, they form the `type` string. The
       * direction can be an `upload` or a `download` direction, while an event can
       * be `loadstart`, `progress` or `load`.
       *
       * `download_load` is the type of event when download has finished and the
       * response is available.
       */
      type?: AjaxResponseType);
  }

  interface AjaxError extends Error {
      /**
       * The XHR instance associated with the error.
       */
      xhr: XMLHttpRequest;
      /**
       * The AjaxRequest associated with the error.
       */
      request: AjaxRequest;
      /**
       * The HTTP status code, if the request has completed. If not,
       * it is set to `0`.
       */
      status: number;
      /**
       * The responseType (e.g. 'json', 'arraybuffer', or 'xml').
       */
      responseType: XMLHttpRequestResponseType;
      /**
       * The response data.
       */
      response: any;
  }

  interface AjaxErrorCtor {
      /**
       * @deprecated Internal implementation detail. Do not construct error instances.
       * Cannot be tagged as internal: https://github.com/ReactiveX/rxjs/issues/6269
       */
      new (message: string, xhr: XMLHttpRequest, request: AjaxRequest): AjaxError;
  }

  interface AjaxTimeoutError extends AjaxError {
  }

  interface AjaxTimeoutErrorCtor {
      /**
       * @deprecated Internal implementation detail. Do not construct error instances.
       * Cannot be tagged as internal: https://github.com/ReactiveX/rxjs/issues/6269
       */
      new (xhr: XMLHttpRequest, request: AjaxRequest): AjaxTimeoutError;
  }

  type AjaxDirection = 'upload' | 'download';

  type ProgressEventType = 'loadstart' | 'progress' | 'load';

  type AjaxResponseType = `${AjaxDirection}_${ProgressEventType}`;

  interface AjaxRequest {
      /**
       * The URL requested.
       */
      url: string;
      /**
       * The body to send over the HTTP request.
       */
      body?: any;
      /**
       * The HTTP method used to make the HTTP request.
       */
      method: string;
      /**
       * Whether or not the request was made asynchronously.
       */
      async: boolean;
      /**
       * The headers sent over the HTTP request.
       */
      headers: Readonly<Record<string, any>>;
      /**
       * The timeout value used for the HTTP request.
       * Note: this is only honored if the request is asynchronous (`async` is `true`).
       */
      timeout: number;
      /**
       * The user credentials user name sent with the HTTP request.
       */
      user?: string;
      /**
       * The user credentials password sent with the HTTP request.
       */
      password?: string;
      /**
       * Whether or not the request was a CORS request.
       */
      crossDomain: boolean;
      /**
       * Whether or not a CORS request was sent with credentials.
       * If `false`, will also ignore cookies in the CORS response.
       */
      withCredentials: boolean;
      /**
       * The [`responseType`](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/responseType) set before sending the request.
       */
      responseType: XMLHttpRequestResponseType;
  }

  interface AjaxConfig {
      /** The address of the resource to request via HTTP. */
      url: string;
      /**
       * The body of the HTTP request to send.
       *
       * This is serialized, by default, based off of the value of the `"content-type"` header.
       * For example, if the `"content-type"` is `"application/json"`, the body will be serialized
       * as JSON. If the `"content-type"` is `"application/x-www-form-urlencoded"`, whatever object passed
       * to the body will be serialized as URL, using key-value pairs based off of the keys and values of the object.
       * In all other cases, the body will be passed directly.
       */
      body?: any;
      /**
       * Whether or not to send the request asynchronously. Defaults to `true`.
       * If set to `false`, this will block the thread until the AJAX request responds.
       */
      async?: boolean;
      /**
       * The HTTP Method to use for the request. Defaults to "GET".
       */
      method?: string;
      /**
       * The HTTP headers to apply.
       *
       * Note that, by default, RxJS will add the following headers under certain conditions:
       *
       * 1. If the `"content-type"` header is **NOT** set, and the `body` is [`FormData`](https://developer.mozilla.org/en-US/docs/Web/API/FormData),
       *    a `"content-type"` of `"application/x-www-form-urlencoded; charset=UTF-8"` will be set automatically.
       * 2. If the `"x-requested-with"` header is **NOT** set, and the `crossDomain` configuration property is **NOT** explicitly set to `true`,
       *    (meaning it is not a CORS request), a `"x-requested-with"` header with a value of `"XMLHttpRequest"` will be set automatically.
       *    This header is generally meaningless, and is set by libraries and frameworks using `XMLHttpRequest` to make HTTP requests.
       */
      headers?: Readonly<Record<string, any>>;
      /**
       * The time to wait before causing the underlying XMLHttpRequest to timeout. This is only honored if the
       * `async` configuration setting is unset or set to `true`. Defaults to `0`, which is idiomatic for "never timeout".
       */
      timeout?: number;
      /** The user credentials user name to send with the HTTP request */
      user?: string;
      /** The user credentials password to send with the HTTP request*/
      password?: string;
      /**
       * Whether or not to send the HTTP request as a CORS request.
       * Defaults to `false`.
       *
       * @deprecated Will be removed in version 8. Cross domain requests and what creates a cross
       * domain request, are dictated by the browser, and a boolean that forces it to be cross domain
       * does not make sense. If you need to force cross domain, make sure you're making a secure request,
       * then add a custom header to the request or use `withCredentials`. For more information on what
       * triggers a cross domain request, see the [MDN documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Access_control_CORS#Requests_with_credentials).
       * In particular, the section on [Simple Requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS#Simple_requests) is useful
       * for understanding when CORS will not be used.
       */
      crossDomain?: boolean;
      /**
       * To send user credentials in a CORS request, set to `true`. To exclude user credentials from
       * a CORS request, _OR_ when cookies are to be ignored by the CORS response, set to `false`.
       *
       * Defaults to `false`.
       */
      withCredentials?: boolean;
      /**
       * The name of your site's XSRF cookie.
       */
      xsrfCookieName?: string;
      /**
       * The name of a custom header that you can use to send your XSRF cookie.
       */
      xsrfHeaderName?: string;
      /**
       * Can be set to change the response type.
       * Valid values are `"arraybuffer"`, `"blob"`, `"document"`, `"json"`, and `"text"`.
       * Note that the type of `"document"` (such as an XML document) is ignored if the global context is
       * not `Window`.
       *
       * Defaults to `"json"`.
       */
      responseType?: XMLHttpRequestResponseType;
      /**
       * An optional factory used to create the XMLHttpRequest object used to make the AJAX request.
       * This is useful in environments that lack `XMLHttpRequest`, or in situations where you
       * wish to override the default `XMLHttpRequest` for some reason.
       *
       * If not provided, the `XMLHttpRequest` in global scope will be used.
       *
       * NOTE: This AJAX implementation relies on the built-in serialization and setting
       * of Content-Type headers that is provided by standards-compliant XMLHttpRequest implementations,
       * be sure any implementation you use meets that standard.
       */
      createXHR?: () => XMLHttpRequest;
      /**
       * An observer for watching the upload progress of an HTTP request. Will
       * emit progress events, and completes on the final upload load event, will error for
       * any XHR error or timeout.
       *
       * This will **not** error for errored status codes. Rather, it will always _complete_ when
       * the HTTP response comes back.
       *
       * @deprecated If you're looking for progress events, use {@link includeDownloadProgress} and
       * {@link includeUploadProgress} instead. Will be removed in v8.
       */
      progressSubscriber?: PartialObserver<ProgressEvent>;
      /**
       * If `true`, will emit all download progress and load complete events as {@link AjaxResponse}
       * from the observable. The final download event will also be emitted as a {@link AjaxResponse}.
       *
       * If both this and {@link includeUploadProgress} are `false`, then only the {@link AjaxResponse} will
       * be emitted from the resulting observable.
       */
      includeDownloadProgress?: boolean;
      /**
       * If `true`, will emit all upload progress and load complete events as {@link AjaxResponse}
       * from the observable. The final download event will also be emitted as a {@link AjaxResponse}.
       *
       * If both this and {@link includeDownloadProgress} are `false`, then only the {@link AjaxResponse} will
       * be emitted from the resulting observable.
       */
      includeUploadProgress?: boolean;
      /**
       * Query string parameters to add to the URL in the request.
       * <em>This will require a polyfill for `URL` and `URLSearchParams` in Internet Explorer!</em>
       *
       * Accepts either a query string, a `URLSearchParams` object, a dictionary of key/value pairs, or an
       * array of key/value entry tuples. (Essentially, it takes anything that `new URLSearchParams` would normally take).
       *
       * If, for some reason you have a query string in the `url` argument, this will append to the query string in the url,
       * but it will also overwrite the value of any keys that are an exact match. In other words, a url of `/test?a=1&b=2`,
       * with queryParams of `{ b: 5, c: 6 }` will result in a url of roughly `/test?a=1&b=5&c=6`.
       */
      queryParams?: string | URLSearchParams | Record<string, string | number | boolean | string[] | number[] | boolean[]> | [string, string | number | boolean | string[] | number[] | boolean[]][];
  }

  interface ConnectableConfig<T> {
      /**
       * A factory function used to create the Subject through which the source
       * is multicast. By default this creates a {@link Subject}.
       */
      connector: () => SubjectLike<T>;
      /**
       * If true, the resulting observable will reset internal state upon disconnection
       * and return to a "cold" state. This allows the resulting observable to be
       * reconnected.
       * If false, upon disconnection, the connecting subject will remain the
       * connecting subject, meaning the resulting observable will not go "cold" again,
       * and subsequent repeats or resubscriptions will resubscribe to that same subject.
       */
      resetOnDisconnect?: boolean;
  }

  class ConnectableObservable<T> extends Observable<T> {
      source: Observable<T>;
      protected subjectFactory: () => Subject<T>;
      protected _subject: Subject<T> | null;
      protected _refCount: number;
      protected _connection: Subscription | null;
      /**
       * @param source The source observable
       * @param subjectFactory The factory that creates the subject used internally.
       * @deprecated Will be removed in v8. Use {@link connectable} to create a connectable observable.
       * `new ConnectableObservable(source, factory)` is equivalent to
       * `connectable(source, { connector: factory })`.
       * When the `refCount()` method is needed, the {@link share} operator should be used instead:
       * `new ConnectableObservable(source, factory).refCount()` is equivalent to
       * `source.pipe(share({ connector: factory }))`.
       * Details: https://rxjs.dev/deprecations/multicasting
       */
      constructor(source: Observable<T>, subjectFactory: () => Subject<T>);
      protected getSubject(): Subject<T>;
      protected _teardown(): void;
      /**
       * @deprecated {@link ConnectableObservable} will be removed in v8. Use {@link connectable} instead.
       * Details: https://rxjs.dev/deprecations/multicasting
       */
      connect(): Subscription;
      /**
       * @deprecated {@link ConnectableObservable} will be removed in v8. Use the {@link share} operator instead.
       * Details: https://rxjs.dev/deprecations/multicasting
       */
      refCount(): Observable<T>;
  }

  interface NodeStyleEventEmitter {
      addListener(eventName: string | symbol, handler: NodeEventHandler): this;
      removeListener(eventName: string | symbol, handler: NodeEventHandler): this;
  }

  type NodeEventHandler = (...args: any[]) => void;

  interface NodeCompatibleEventEmitter {
      addListener(eventName: string, handler: NodeEventHandler): void | {};
      removeListener(eventName: string, handler: NodeEventHandler): void | {};
  }

  interface JQueryStyleEventEmitter<TContext, T> {
      on(eventName: string, handler: (this: TContext, t: T, ...args: any[]) => any): void;
      off(eventName: string, handler: (this: TContext, t: T, ...args: any[]) => any): void;
  }

  interface EventListenerObject<E> {
      handleEvent(evt: E): void;
  }

  interface HasEventTargetAddRemove<E> {
      addEventListener(type: string, listener: ((evt: E) => void) | EventListenerObject<E> | null, options?: boolean | AddEventListenerOptions): void;
      removeEventListener(type: string, listener: ((evt: E) => void) | EventListenerObject<E> | null, options?: EventListenerOptions | boolean): void;
  }

  interface EventListenerOptions {
      capture?: boolean;
      passive?: boolean;
      once?: boolean;
  }

  interface AddEventListenerOptions extends EventListenerOptions {
      once?: boolean;
      passive?: boolean;
  }

  type ConditionFunc<S> = (state: S) => boolean;

  type IterateFunc<S> = (state: S) => S;

  type ResultFunc<S, T> = (state: S) => T;

  interface GenerateBaseOptions<S> {
      /**
       * Initial state.
       */
      initialState: S;
      /**
       * Condition function that accepts state and returns boolean.
       * When it returns false, the generator stops.
       * If not specified, a generator never stops.
       */
      condition?: ConditionFunc<S>;
      /**
       * Iterate function that accepts state and returns new state.
       */
      iterate: IterateFunc<S>;
      /**
       * SchedulerLike to use for generation process.
       * By default, a generator starts immediately.
       */
      scheduler?: SchedulerLike;
  }

  interface GenerateOptions<T, S> extends GenerateBaseOptions<S> {
      /**
       * Result selection function that accepts state and returns a value to emit.
       */
      resultSelector: ResultFunc<S, T>;
  }

  interface ConnectConfig<T> {
      /**
       * A factory function used to create the Subject through which the source
       * is multicast. By default, this creates a {@link Subject}.
       */
      connector: () => SubjectLike<T>;
  }

  interface BasicGroupByOptions<K, T> {
      element?: undefined;
      duration?: (grouped: GroupedObservable<K, T>) => ObservableInput<any>;
      connector?: () => SubjectLike<T>;
  }

  interface GroupByOptionsWithElement<K, E, T> {
      element: (value: T) => E;
      duration?: (grouped: GroupedObservable<K, E>) => ObservableInput<any>;
      connector?: () => SubjectLike<E>;
  }

  interface GroupedObservable<K, T> extends Observable<T> {
      /**
       * The key value for the grouped notifications.
       */
      readonly key: K;
  }

  class OperatorSubscriber<T> extends Subscriber<T> {
      private onFinalize?;
      private shouldUnsubscribe?;
      /**
       * Creates an instance of an `OperatorSubscriber`.
       * @param destination The downstream subscriber.
       * @param onNext Handles next values, only called if this subscriber is not stopped or closed. Any
       * error that occurs in this function is caught and sent to the `error` method of this subscriber.
       * @param onError Handles errors from the subscription, any errors that occur in this handler are caught
       * and send to the `destination` error handler.
       * @param onComplete Handles completion notification from the subscription. Any errors that occur in
       * this handler are sent to the `destination` error handler.
       * @param onFinalize Additional finalization logic here. This will only be called on finalization if the
       * subscriber itself is not already closed. This is called after all other finalization logic is executed.
       * @param shouldUnsubscribe An optional check to see if an unsubscribe call should truly unsubscribe.
       * NOTE: This currently **ONLY** exists to support the strange behavior of {@link groupBy}, where unsubscription
       * to the resulting observable does not actually disconnect from the source if there are active subscriptions
       * to any grouped observable. (DO NOT EXPOSE OR USE EXTERNALLY!!!)
       */
      constructor(destination: Subscriber<any>, onNext?: (value: T) => void, onComplete?: () => void, onError?: (err: any) => void, onFinalize?: (() => void) | undefined, shouldUnsubscribe?: (() => boolean) | undefined);
      unsubscribe(): void;
  }

  interface RepeatConfig {
      /**
       * The number of times to repeat the source. Defaults to `Infinity`.
       */
      count?: number;
      /**
       * If a `number`, will delay the repeat of the source by that number of milliseconds.
       * If a function, it will provide the number of times the source has been subscribed to,
       * and the return value should be a valid observable input that will notify when the source
       * should be repeated. If the notifier observable is empty, the result will complete.
       */
      delay?: number | ((count: number) => ObservableInput<any>);
  }

  interface RetryConfig {
      /**
       * The maximum number of times to retry. If `count` is omitted, `retry` will try to
       * resubscribe on errors infinite number of times.
       */
      count?: number;
      /**
       * The number of milliseconds to delay before retrying, OR a function to
       * return a notifier for delaying. If a function is given, that function should
       * return a notifier that, when it emits will retry the source. If the notifier
       * completes _without_ emitting, the resulting observable will complete without error,
       * if the notifier errors, the error will be pushed to the result.
       */
      delay?: number | ((error: any, retryCount: number) => ObservableInput<any>);
      /**
       * Whether or not to reset the retry counter when the retried subscription
       * emits its first value.
       */
      resetOnSuccess?: boolean;
  }

  interface ShareConfig<T> {
      /**
       * The factory used to create the subject that will connect the source observable to
       * multicast consumers.
       */
      connector?: () => SubjectLike<T>;
      /**
       * If `true`, the resulting observable will reset internal state on error from source and return to a "cold" state. This
       * allows the resulting observable to be "retried" in the event of an error.
       * If `false`, when an error comes from the source it will push the error into the connecting subject, and the subject
       * will remain the connecting subject, meaning the resulting observable will not go "cold" again, and subsequent retries
       * or resubscriptions will resubscribe to that same subject. In all cases, RxJS subjects will emit the same error again, however
       * {@link ReplaySubject} will also push its buffered values before pushing the error.
       * It is also possible to pass a notifier factory returning an `ObservableInput` instead which grants more fine-grained
       * control over how and when the reset should happen. This allows behaviors like conditional or delayed resets.
       */
      resetOnError?: boolean | ((error: any) => ObservableInput<any>);
      /**
       * If `true`, the resulting observable will reset internal state on completion from source and return to a "cold" state. This
       * allows the resulting observable to be "repeated" after it is done.
       * If `false`, when the source completes, it will push the completion through the connecting subject, and the subject
       * will remain the connecting subject, meaning the resulting observable will not go "cold" again, and subsequent repeats
       * or resubscriptions will resubscribe to that same subject.
       * It is also possible to pass a notifier factory returning an `ObservableInput` instead which grants more fine-grained
       * control over how and when the reset should happen. This allows behaviors like conditional or delayed resets.
       */
      resetOnComplete?: boolean | (() => ObservableInput<any>);
      /**
       * If `true`, when the number of subscribers to the resulting observable reaches zero due to those subscribers unsubscribing, the
       * internal state will be reset and the resulting observable will return to a "cold" state. This means that the next
       * time the resulting observable is subscribed to, a new subject will be created and the source will be subscribed to
       * again.
       * If `false`, when the number of subscribers to the resulting observable reaches zero due to unsubscription, the subject
       * will remain connected to the source, and new subscriptions to the result will be connected through that same subject.
       * It is also possible to pass a notifier factory returning an `ObservableInput` instead which grants more fine-grained
       * control over how and when the reset should happen. This allows behaviors like conditional or delayed resets.
       */
      resetOnRefCountZero?: boolean | (() => ObservableInput<any>);
  }

  interface ShareReplayConfig {
      bufferSize?: number;
      windowTime?: number;
      refCount: boolean;
      scheduler?: SchedulerLike;
  }

  interface TapObserver<T> extends Observer<T> {
      /**
       * The callback that `tap` operator invokes at the moment when the source Observable
       * gets subscribed to.
       */
      subscribe: () => void;
      /**
       * The callback that `tap` operator invokes when an explicit
       * {@link guide/glossary-and-semantics#unsubscription unsubscribe} happens. It won't get invoked on
       * `error` or `complete` events.
       */
      unsubscribe: () => void;
      /**
       * The callback that `tap` operator invokes when any kind of
       * {@link guide/glossary-and-semantics#finalization finalization} happens - either when
       * the source Observable `error`s or `complete`s or when it gets explicitly unsubscribed
       * by the user. There is no difference in using this callback or the {@link finalize}
       * operator, but if you're already using `tap` operator, you can use this callback
       * instead. You'd get the same result in either case.
       */
      finalize: () => void;
  }

  interface ThrottleConfig {
      /**
       * If `true`, the resulting Observable will emit the first value from the source
       * Observable at the **start** of the "throttling" process (when starting an
       * internal timer that prevents other emissions from the source to pass through).
       * If `false`, it will not emit the first value from the source Observable at the
       * start of the "throttling" process.
       *
       * If not provided, defaults to: `true`.
       */
      leading?: boolean;
      /**
       * If `true`, the resulting Observable will emit the last value from the source
       * Observable at the **end** of the "throttling" process (when ending an internal
       * timer that prevents other emissions from the source to pass through).
       * If `false`, it will not emit the last value from the source Observable at the
       * end of the "throttling" process.
       *
       * If not provided, defaults to: `false`.
       */
      trailing?: boolean;
  }

  interface TimeoutConfig<T, O extends ObservableInput<unknown> = ObservableInput<T>, M = unknown> {
      /**
       * The time allowed between values from the source before timeout is triggered.
       */
      each?: number;
      /**
       * The relative time as a `number` in milliseconds, or a specific time as a `Date` object,
       * by which the first value must arrive from the source before timeout is triggered.
       */
      first?: number | Date;
      /**
       * The scheduler to use with time-related operations within this operator. Defaults to {@link asyncScheduler}
       */
      scheduler?: SchedulerLike;
      /**
       * A factory used to create observable to switch to when timeout occurs. Provides
       * a {@link TimeoutInfo} about the source observable's emissions and what delay or
       * exact time triggered the timeout.
       */
      with?: (info: TimeoutInfo<T, M>) => O;
      /**
       * Optional additional metadata you can provide to code that handles
       * the timeout, will be provided through the {@link TimeoutError}.
       * This can be used to help identify the source of a timeout or pass along
       * other information related to the timeout.
       */
      meta?: M;
  }

  interface TimeoutInfo<T, M = unknown> {
      /** Optional metadata that was provided to the timeout configuration. */
      readonly meta: M;
      /** The number of messages seen before the timeout */
      readonly seen: number;
      /** The last message seen */
      readonly lastValue: T | null;
  }

  interface TimeoutError<T = unknown, M = unknown> extends Error {
      /**
       * The information provided to the error by the timeout
       * operation that created the error. Will be `null` if
       * used directly in non-RxJS code with an empty constructor.
       * (Note that using this constructor directly is not recommended,
       * you should create your own errors)
       */
      info: TimeoutInfo<T, M> | null;
  }

  interface TimeoutErrorCtor {
      /**
       * @deprecated Internal implementation detail. Do not construct error instances.
       * Cannot be tagged as internal: https://github.com/ReactiveX/rxjs/issues/6269
       */
      new <T = unknown, M = unknown>(info?: TimeoutInfo<T, M>): TimeoutError<T, M>;
  }

  class Action<T> extends Subscription {
      constructor(scheduler: Scheduler, work: (this: SchedulerAction<T>, state?: T) => void);
      /**
       * Schedules this action on its parent {@link SchedulerLike} for execution. May be passed
       * some context object, `state`. May happen at some point in the future,
       * according to the `delay` parameter, if specified.
       * @param state Some contextual data that the `work` function uses when called by the
       * Scheduler.
       * @param delay Time to wait before executing the work, where the time unit is implicit
       * and defined by the Scheduler.
       * @return A subscription in order to be able to unsubscribe the scheduled work.
       */
      schedule(state?: T, delay?: number): Subscription;
  }

  class AnimationFrameAction<T> extends AsyncAction<T> {
      protected scheduler: AnimationFrameScheduler;
      protected work: (this: SchedulerAction<T>, state?: T) => void;
      constructor(scheduler: AnimationFrameScheduler, work: (this: SchedulerAction<T>, state?: T) => void);
      protected requestAsyncId(scheduler: AnimationFrameScheduler, id?: TimerHandle, delay?: number): TimerHandle;
      protected recycleAsyncId(scheduler: AnimationFrameScheduler, id?: TimerHandle, delay?: number): TimerHandle | undefined;
  }

  interface AnimationFrameProvider {
      schedule(callback: FrameRequestCallback): Subscription;
      requestAnimationFrame: typeof requestAnimationFrame;
      cancelAnimationFrame: typeof cancelAnimationFrame;
      delegate: {
          requestAnimationFrame: typeof requestAnimationFrame;
          cancelAnimationFrame: typeof cancelAnimationFrame;
      } | undefined;
  }

  class AnimationFrameScheduler extends AsyncScheduler {
      flush(action?: AsyncAction<any>): void;
  }

  class AsapAction<T> extends AsyncAction<T> {
      protected scheduler: AsapScheduler;
      protected work: (this: SchedulerAction<T>, state?: T) => void;
      constructor(scheduler: AsapScheduler, work: (this: SchedulerAction<T>, state?: T) => void);
      protected requestAsyncId(scheduler: AsapScheduler, id?: TimerHandle, delay?: number): TimerHandle;
      protected recycleAsyncId(scheduler: AsapScheduler, id?: TimerHandle, delay?: number): TimerHandle | undefined;
  }

  class AsapScheduler extends AsyncScheduler {
      flush(action?: AsyncAction<any>): void;
  }

  class AsyncAction<T> extends Action<T> {
      protected scheduler: AsyncScheduler;
      protected work: (this: SchedulerAction<T>, state?: T) => void;
      id: TimerHandle | undefined;
      state?: T;
      delay: number;
      protected pending: boolean;
      constructor(scheduler: AsyncScheduler, work: (this: SchedulerAction<T>, state?: T) => void);
      schedule(state?: T, delay?: number): Subscription;
      protected requestAsyncId(scheduler: AsyncScheduler, _id?: TimerHandle, delay?: number): TimerHandle;
      protected recycleAsyncId(_scheduler: AsyncScheduler, id?: TimerHandle, delay?: number | null): TimerHandle | undefined;
      /**
       * Immediately executes this action and the `work` it contains.
       */
      execute(state: T, delay: number): any;
      protected _execute(state: T, _delay: number): any;
      unsubscribe(): void;
  }

  class AsyncScheduler extends Scheduler {
      actions: Array<AsyncAction<any>>;
      constructor(SchedulerAction: typeof Action, now?: () => number);
      flush(action: AsyncAction<any>): void;
  }

  interface DateTimestampProvider extends TimestampProvider {
      delegate: TimestampProvider | undefined;
  }

  type SetImmediateFunction = (handler: () => void, ...args: any[]) => TimerHandle;

  type ClearImmediateFunction = (handle: TimerHandle) => void;

  interface ImmediateProvider {
      setImmediate: SetImmediateFunction;
      clearImmediate: ClearImmediateFunction;
      delegate: {
          setImmediate: SetImmediateFunction;
          clearImmediate: ClearImmediateFunction;
      } | undefined;
  }

  type SetIntervalFunction = (handler: () => void, timeout?: number, ...args: any[]) => TimerHandle;

  type ClearIntervalFunction = (handle: TimerHandle) => void;

  interface IntervalProvider {
      setInterval: SetIntervalFunction;
      clearInterval: ClearIntervalFunction;
      delegate: {
          setInterval: SetIntervalFunction;
          clearInterval: ClearIntervalFunction;
      } | undefined;
  }

  interface PerformanceTimestampProvider extends TimestampProvider {
      delegate: TimestampProvider | undefined;
  }

  class QueueAction<T> extends AsyncAction<T> {
      protected scheduler: QueueScheduler;
      protected work: (this: SchedulerAction<T>, state?: T) => void;
      constructor(scheduler: QueueScheduler, work: (this: SchedulerAction<T>, state?: T) => void);
      schedule(state?: T, delay?: number): Subscription;
      execute(state: T, delay: number): any;
      protected requestAsyncId(scheduler: QueueScheduler, id?: TimerHandle, delay?: number): TimerHandle;
  }

  class QueueScheduler extends AsyncScheduler {
  }

  type SetTimeoutFunction = (handler: () => void, timeout?: number, ...args: any[]) => TimerHandle;

  type ClearTimeoutFunction = (handle: TimerHandle) => void;

  interface TimeoutProvider {
      setTimeout: SetTimeoutFunction;
      clearTimeout: ClearTimeoutFunction;
      delegate: {
          setTimeout: SetTimeoutFunction;
          clearTimeout: ClearTimeoutFunction;
      } | undefined;
  }

  type TimerHandle = number | ReturnType<typeof setTimeout>;

  class VirtualTimeScheduler extends AsyncScheduler {
      maxFrames: number;
      /** @deprecated Not used in VirtualTimeScheduler directly. Will be removed in v8. */
      static frameTimeFactor: number;
      /**
       * The current frame for the state of the virtual scheduler instance. The difference
       * between two "frames" is synonymous with the passage of "virtual time units". So if
       * you record `scheduler.frame` to be `1`, then later, observe `scheduler.frame` to be at `11`,
       * that means `10` virtual time units have passed.
       */
      frame: number;
      /**
       * Used internally to examine the current virtual action index being processed.
       * @deprecated Internal implementation detail, do not use directly. Will be made internal in v8.
       */
      index: number;
      /**
       * This creates an instance of a `VirtualTimeScheduler`. Experts only. The signature of
       * this constructor is likely to change in the long run.
       *
       * @param schedulerActionCtor The type of Action to initialize when initializing actions during scheduling.
       * @param maxFrames The maximum number of frames to process before stopping. Used to prevent endless flush cycles.
       */
      constructor(schedulerActionCtor?: typeof AsyncAction, maxFrames?: number);
      /**
       * Prompt the Scheduler to execute all of its queued actions, therefore
       * clearing its queue.
       */
      flush(): void;
  }

  class VirtualAction<T> extends AsyncAction<T> {
      protected scheduler: VirtualTimeScheduler;
      protected work: (this: SchedulerAction<T>, state?: T) => void;
      protected index: number;
      protected active: boolean;
      constructor(scheduler: VirtualTimeScheduler, work: (this: SchedulerAction<T>, state?: T) => void, index?: number);
      schedule(state?: T, delay?: number): Subscription;
      protected requestAsyncId(scheduler: VirtualTimeScheduler, id?: any, delay?: number): TimerHandle;
      protected recycleAsyncId(scheduler: VirtualTimeScheduler, id?: any, delay?: number): TimerHandle | undefined;
      protected _execute(state: T, delay: number): any;
      private static sortActions;
  }

  class ColdObservable<T> extends Observable<T> implements SubscriptionLoggable {
      messages: TestMessage[];
      subscriptions: SubscriptionLog[];
      scheduler: Scheduler;
      logSubscribedFrame: () => number;
      logUnsubscribedFrame: (index: number) => void;
      constructor(messages: TestMessage[], scheduler: Scheduler);
      scheduleMessages(subscriber: Subscriber<any>): void;
  }

  class HotObservable<T> extends Subject<T> implements SubscriptionLoggable {
      messages: TestMessage[];
      subscriptions: SubscriptionLog[];
      scheduler: Scheduler;
      logSubscribedFrame: () => number;
      logUnsubscribedFrame: (index: number) => void;
      constructor(messages: TestMessage[], scheduler: Scheduler);
      setup(): void;
  }

  class SubscriptionLog {
      subscribedFrame: number;
      unsubscribedFrame: number;
      constructor(subscribedFrame: number, unsubscribedFrame?: number);
  }

  class SubscriptionLoggable {
      subscriptions: SubscriptionLog[];
      scheduler: Scheduler;
      logSubscribedFrame(): number;
      logUnsubscribedFrame(index: number): void;
  }

  interface TestMessage {
      frame: number;
      notification: ObservableNotification<any>;
      isGhost?: boolean;
  }

  interface RunHelpers {
      cold: typeof TestScheduler.prototype.createColdObservable;
      hot: typeof TestScheduler.prototype.createHotObservable;
      flush: typeof TestScheduler.prototype.flush;
      time: typeof TestScheduler.prototype.createTime;
      expectObservable: typeof TestScheduler.prototype.expectObservable;
      expectSubscriptions: typeof TestScheduler.prototype.expectSubscriptions;
      animate: (marbles: string) => void;
  }

  type observableToBeFn = (marbles: string, values?: any, errorValue?: any) => void;

  type subscriptionLogsToBeFn = (marbles: string | string[]) => void;

  class TestScheduler extends VirtualTimeScheduler {
      assertDeepEqual: (actual: any, expected: any) => boolean | void;
      /**
       * The number of virtual time units each character in a marble diagram represents. If
       * the test scheduler is being used in "run mode", via the `run` method, this is temporarily
       * set to `1` for the duration of the `run` block, then set back to whatever value it was.
       */
      static frameTimeFactor: number;
      /**
       * @deprecated Internal implementation detail, do not use directly. Will be made internal in v8.
       */
      readonly hotObservables: HotObservable<any>[];
      /**
       * @deprecated Internal implementation detail, do not use directly. Will be made internal in v8.
       */
      readonly coldObservables: ColdObservable<any>[];
      /**
       * Test meta data to be processed during `flush()`
       */
      private flushTests;
      /**
       * Indicates whether the TestScheduler instance is operating in "run mode",
       * meaning it's processing a call to `run()`
       */
      private runMode;
      /**
       *
       * @param assertDeepEqual A function to set up your assertion for your test harness
       */
      constructor(assertDeepEqual: (actual: any, expected: any) => boolean | void);
      createTime(marbles: string): number;
      /**
       * @param marbles A diagram in the marble DSL. Letters map to keys in `values` if provided.
       * @param values Values to use for the letters in `marbles`. If omitted, the letters themselves are used.
       * @param error The error to use for the `#` marble (if present).
       */
      createColdObservable<T = string>(marbles: string, values?: {
          [marble: string]: T;
      }, error?: any): ColdObservable<T>;
      /**
       * @param marbles A diagram in the marble DSL. Letters map to keys in `values` if provided.
       * @param values Values to use for the letters in `marbles`. If omitted, the letters themselves are used.
       * @param error The error to use for the `#` marble (if present).
       */
      createHotObservable<T = string>(marbles: string, values?: {
          [marble: string]: T;
      }, error?: any): HotObservable<T>;
      private materializeInnerObservable;
      expectObservable<T>(observable: Observable<T>, subscriptionMarbles?: string | null): {
          toBe(marbles: string, values?: any, errorValue?: any): void;
          toEqual: (other: Observable<T>) => void;
      };
      expectSubscriptions(actualSubscriptionLogs: SubscriptionLog[]): {
          toBe: subscriptionLogsToBeFn;
      };
      flush(): void;
      static parseMarblesAsSubscriptions(marbles: string | null, runMode?: boolean): SubscriptionLog;
      static parseMarbles(marbles: string, values?: any, errorValue?: any, materializeInnerObservables?: boolean, runMode?: boolean): TestMessage[];
      private createAnimator;
      private createDelegates;
      /**
       * The `run` method performs the test in 'run mode' - in which schedulers
       * used within the test automatically delegate to the `TestScheduler`. That
       * is, in 'run mode' there is no need to explicitly pass a `TestScheduler`
       * instance to observable creators or operators.
       *
       * @see {@link /guide/testing/marble-testing}
       */
      run<T>(callback: (helpers: RunHelpers) => T): T;
  }

  interface ArgumentOutOfRangeError extends Error {
  }

  interface ArgumentOutOfRangeErrorCtor {
      /**
       * @deprecated Internal implementation detail. Do not construct error instances.
       * Cannot be tagged as internal: https://github.com/ReactiveX/rxjs/issues/6269
       */
      new (): ArgumentOutOfRangeError;
  }

  interface EmptyError extends Error {
  }

  interface EmptyErrorCtor {
      /**
       * @deprecated Internal implementation detail. Do not construct error instances.
       * Cannot be tagged as internal: https://github.com/ReactiveX/rxjs/issues/6269
       */
      new (): EmptyError;
  }

  interface NotFoundError extends Error {
  }

  interface NotFoundErrorCtor {
      /**
       * @deprecated Internal implementation detail. Do not construct error instances.
       * Cannot be tagged as internal: https://github.com/ReactiveX/rxjs/issues/6269
       */
      new (message: string): NotFoundError;
  }

  interface ObjectUnsubscribedError extends Error {
  }

  interface ObjectUnsubscribedErrorCtor {
      /**
       * @deprecated Internal implementation detail. Do not construct error instances.
       * Cannot be tagged as internal: https://github.com/ReactiveX/rxjs/issues/6269
       */
      new (): ObjectUnsubscribedError;
  }

  interface SequenceError extends Error {
  }

  interface SequenceErrorCtor {
      /**
       * @deprecated Internal implementation detail. Do not construct error instances.
       * Cannot be tagged as internal: https://github.com/ReactiveX/rxjs/issues/6269
       */
      new (message: string): SequenceError;
  }

  interface UnsubscriptionError extends Error {
      readonly errors: any[];
  }

  interface UnsubscriptionErrorCtor {
      /**
       * @deprecated Internal implementation detail. Do not construct error instances.
       * Cannot be tagged as internal: https://github.com/ReactiveX/rxjs/issues/6269
       */
      new (errors: any[]): UnsubscriptionError;
  }

  interface WebSocketSubjectConfig<T> {
      /** The url of the socket server to connect to */
      url: string;
      /** The protocol to use to connect */
      protocol?: string | Array<string>;
      /** @deprecated Will be removed in v8. Use {@link deserializer} instead. */
      resultSelector?: (e: MessageEvent) => T;
      /**
       * A serializer used to create messages from passed values before the
       * messages are sent to the server. Defaults to JSON.stringify.
       */
      serializer?: (value: T) => WebSocketMessage;
      /**
       * A deserializer used for messages arriving on the socket from the
       * server. Defaults to JSON.parse.
       */
      deserializer?: (e: MessageEvent) => T;
      /**
       * An Observer that watches when open events occur on the underlying web socket.
       */
      openObserver?: NextObserver<Event>;
      /**
       * An Observer that watches when close events occur on the underlying web socket
       */
      closeObserver?: NextObserver<CloseEvent>;
      /**
       * An Observer that watches when a close is about to occur due to
       * unsubscription.
       */
      closingObserver?: NextObserver<void>;
      /**
       * A WebSocket constructor to use. This is useful for situations like using a
       * WebSocket impl in Node (WebSocket is a DOM API), or for mocking a WebSocket
       * for testing purposes
       */
      WebSocketCtor?: {
          new (url: string, protocols?: string | string[]): WebSocket;
      };
      /** Sets the `binaryType` property of the underlying WebSocket. */
      binaryType?: 'blob' | 'arraybuffer';
  }

  type WebSocketMessage = string | ArrayBuffer | Blob | ArrayBufferView;

  class WebSocketSubject<T> extends AnonymousSubject<T> {
      private _config;
      private _socket;
      constructor(urlConfigOrSource: string | WebSocketSubjectConfig<T> | Observable<T>, destination?: Observer<T>);
      /** @deprecated Internal implementation detail, do not use directly. Will be made internal in v8. */
      lift<R>(operator: Operator<T, R>): WebSocketSubject<R>;
      private _resetState;
      /**
       * Creates an {@link Observable}, that when subscribed to, sends a message,
       * defined by the `subMsg` function, to the server over the socket to begin a
       * subscription to data over that socket. Once data arrives, the
       * `messageFilter` argument will be used to select the appropriate data for
       * the resulting Observable. When finalization occurs, either due to
       * unsubscription, completion, or error, a message defined by the `unsubMsg`
       * argument will be sent to the server over the WebSocketSubject.
       *
       * @param subMsg A function to generate the subscription message to be sent to
       * the server. This will still be processed by the serializer in the
       * WebSocketSubject's config. (Which defaults to JSON serialization)
       * @param unsubMsg A function to generate the unsubscription message to be
       * sent to the server at finalization. This will still be processed by the
       * serializer in the WebSocketSubject's config.
       * @param messageFilter A predicate for selecting the appropriate messages
       * from the server for the output stream.
       */
      multiplex(subMsg: () => any, unsubMsg: () => any, messageFilter: (value: T) => boolean): Observable<T>;
      private _connectSocket;
      unsubscribe(): void;
  }

  const anyCatcherSymbol: unique symbol;

  const config: GlobalConfig;

  function firstValueFrom<T, D>(source: Observable<T>, config: FirstValueFromConfig<D>): Promise<T | D>;

  function lastValueFrom<T, D>(source: Observable<T>, config: LastValueFromConfig<D>): Promise<T | D>;

  function observeNotification<T>(notification: ObservableNotification<T>, observer: PartialObserver<T>): void;

  const EMPTY_OBSERVER: Readonly<Observer<any>> & {
      closed: true;
  };

  const EMPTY_SUBSCRIPTION: Subscription;

  function isSubscription(value: any): value is Subscription;

  const ajax: AjaxCreationMethod;

  function fromAjax<T>(init: AjaxConfig): Observable<AjaxResponse<T>>;

  function getXHRResponse(xhr: XMLHttpRequest): any;

  function bindCallback(callbackFunc: (...args: any[]) => void, resultSelector: (...args: any[]) => any, scheduler?: SchedulerLike): (...args: any[]) => Observable<any>;

  function bindCallbackInternals(isNodeStyle: boolean, callbackFunc: any, resultSelector?: any, scheduler?: SchedulerLike): (...args: any[]) => Observable<unknown>;

  function bindNodeCallback(callbackFunc: (...args: any[]) => void, resultSelector: (...args: any[]) => any, scheduler?: SchedulerLike): (...args: any[]) => Observable<any>;

  function combineLatest<T extends AnyCatcher>(arg: T): Observable<unknown>;

  function combineLatestInit(observables: ObservableInput<any>[], scheduler?: SchedulerLike, valueTransform?: (values: any[]) => any): (subscriber: Subscriber<any>) => void;

  function concat<T extends readonly unknown[]>(...inputs: [...ObservableInputTuple<T>]): Observable<T[number]>;

  function connectable<T>(source: ObservableInput<T>, config?: ConnectableConfig<T>): Connectable<T>;

  function defer<R extends ObservableInput<any>>(observableFactory: () => R): Observable<ObservedValueOf<R>>;

  const EMPTY: Observable<never>;

  function empty(scheduler?: SchedulerLike): Observable<never>;

  function forkJoin<T extends AnyCatcher>(arg: T): Observable<unknown>;

  function from<O extends ObservableInput<any>>(input: O): Observable<ObservedValueOf<O>>;

  function fromEvent<T>(target: HasEventTargetAddRemove<T> | ArrayLike<HasEventTargetAddRemove<T>>, eventName: string): Observable<T>;

  function fromEventPattern<T>(addHandler: (handler: NodeEventHandler) => any, removeHandler?: (handler: NodeEventHandler, signal?: any) => void): Observable<T>;

  function fromSubscribable<T>(subscribable: Subscribable<T>): Observable<T>;

  function generate<T, S>(initialState: S, condition: ConditionFunc<S>, iterate: IterateFunc<S>, resultSelector: ResultFunc<S, T>, scheduler?: SchedulerLike): Observable<T>;

  function iif<T, F>(condition: () => boolean, trueResult: ObservableInput<T>, falseResult: ObservableInput<F>): Observable<T | F>;

  function innerFrom<O extends ObservableInput<any>>(input: O): Observable<ObservedValueOf<O>>;

  function fromInteropObservable<T>(obj: any): Observable<T>;

  function fromArrayLike<T>(array: ArrayLike<T>): Observable<T>;

  function fromPromise<T>(promise: PromiseLike<T>): Observable<T>;

  function fromIterable<T>(iterable: Iterable<T>): Observable<T>;

  function fromAsyncIterable<T>(asyncIterable: AsyncIterable<T>): Observable<T>;

  function fromReadableStreamLike<T>(readableStream: ReadableStreamLike<T>): Observable<T>;

  function interval(period?: number, scheduler?: SchedulerLike): Observable<number>;

  function merge<A extends readonly unknown[]>(...sources: [...ObservableInputTuple<A>]): Observable<A[number]>;

  const NEVER: Observable<never>;

  function never(): Observable<never>;

  function of(value: null): Observable<null>;

  function onErrorResumeNext<A extends readonly unknown[]>(sources: [...ObservableInputTuple<A>]): Observable<A[number]>;

  function pairs<T>(arr: readonly T[], scheduler?: SchedulerLike): Observable<[string, T]>;

  function partition<T, U extends T, A>(source: ObservableInput<T>, predicate: (this: A, value: T, index: number) => value is U, thisArg: A): [Observable<U>, Observable<Exclude<T, U>>];

  function race<T extends readonly unknown[]>(inputs: [...ObservableInputTuple<T>]): Observable<T[number]>;

  function raceInit<T>(sources: ObservableInput<T>[]): (subscriber: Subscriber<T>) => void;

  function range(start: number, count?: number): Observable<number>;

  function throwError(errorFactory: () => any): Observable<never>;

  function timer(due: number | Date, scheduler?: SchedulerLike): Observable<0>;

  function using<T extends ObservableInput<any>>(resourceFactory: () => Unsubscribable | void, observableFactory: (resource: Unsubscribable | void) => T | void): Observable<ObservedValueOf<T>>;

  function zip<A extends readonly unknown[]>(sources: [...ObservableInputTuple<A>]): Observable<A>;

  function audit<T>(durationSelector: (value: T) => ObservableInput<any>): MonoTypeOperatorFunction<T>;

  function auditTime<T>(duration: number, scheduler?: SchedulerLike): MonoTypeOperatorFunction<T>;

  function buffer<T>(closingNotifier: ObservableInput<any>): OperatorFunction<T, T[]>;

  function bufferCount<T>(bufferSize: number, startBufferEvery?: number | null): OperatorFunction<T, T[]>;

  function bufferTime<T>(bufferTimeSpan: number, scheduler?: SchedulerLike): OperatorFunction<T, T[]>;

  function bufferToggle<T, O>(openings: ObservableInput<O>, closingSelector: (value: O) => ObservableInput<any>): OperatorFunction<T, T[]>;

  function bufferWhen<T>(closingSelector: () => ObservableInput<any>): OperatorFunction<T, T[]>;

  function catchError<T, O extends ObservableInput<any>>(selector: (err: any, caught: Observable<T>) => O): OperatorFunction<T, T | ObservedValueOf<O>>;

  const combineAll: typeof combineLatestAll;

  function combineLatestAll<T>(): OperatorFunction<ObservableInput<T>, T[]>;

  function combineLatestWith<T, A extends readonly unknown[]>(...otherSources: [...ObservableInputTuple<A>]): OperatorFunction<T, Cons<T, A>>;

  function concatAll<O extends ObservableInput<any>>(): OperatorFunction<O, ObservedValueOf<O>>;

  function concatMap<T, O extends ObservableInput<any>>(project: (value: T, index: number) => O): OperatorFunction<T, ObservedValueOf<O>>;

  function concatMapTo<O extends ObservableInput<unknown>>(observable: O): OperatorFunction<unknown, ObservedValueOf<O>>;

  function concatWith<T, A extends readonly unknown[]>(...otherSources: [...ObservableInputTuple<A>]): OperatorFunction<T, T | A[number]>;

  function connect<T, O extends ObservableInput<unknown>>(selector: (shared: Observable<T>) => O, config?: ConnectConfig<T>): OperatorFunction<T, ObservedValueOf<O>>;

  function count<T>(predicate?: (value: T, index: number) => boolean): OperatorFunction<T, number>;

  function debounce<T>(durationSelector: (value: T) => ObservableInput<any>): MonoTypeOperatorFunction<T>;

  function debounceTime<T>(dueTime: number, scheduler?: SchedulerLike): MonoTypeOperatorFunction<T>;

  function defaultIfEmpty<T, R>(defaultValue: R): OperatorFunction<T, T | R>;

  function delay<T>(due: number | Date, scheduler?: SchedulerLike): MonoTypeOperatorFunction<T>;

  function delayWhen<T>(delayDurationSelector: (value: T, index: number) => ObservableInput<any>, subscriptionDelay: Observable<any>): MonoTypeOperatorFunction<T>;

  function dematerialize<N extends ObservableNotification<any>>(): OperatorFunction<N, ValueFromNotification<N>>;

  function distinct<T, K>(keySelector?: (value: T) => K, flushes?: ObservableInput<any>): MonoTypeOperatorFunction<T>;

  function distinctUntilChanged<T>(comparator?: (previous: T, current: T) => boolean): MonoTypeOperatorFunction<T>;

  function distinctUntilKeyChanged<T>(key: keyof T): MonoTypeOperatorFunction<T>;

  function elementAt<T, D = T>(index: number, defaultValue?: D): OperatorFunction<T, T | D>;

  function endWith<T>(scheduler: SchedulerLike): MonoTypeOperatorFunction<T>;

  function every<T>(predicate: BooleanConstructor): OperatorFunction<T, Exclude<T, Falsy> extends never ? false : boolean>;

  const exhaust: typeof exhaustAll;

  function exhaustAll<O extends ObservableInput<any>>(): OperatorFunction<O, ObservedValueOf<O>>;

  function exhaustMap<T, O extends ObservableInput<any>>(project: (value: T, index: number) => O): OperatorFunction<T, ObservedValueOf<O>>;

  function expand<T, O extends ObservableInput<unknown>>(project: (value: T, index: number) => O, concurrent?: number, scheduler?: SchedulerLike): OperatorFunction<T, ObservedValueOf<O>>;

  function filter<T, S extends T, A>(predicate: (this: A, value: T, index: number) => value is S, thisArg: A): OperatorFunction<T, S>;

  function finalize<T>(callback: () => void): MonoTypeOperatorFunction<T>;

  function find<T>(predicate: BooleanConstructor): OperatorFunction<T, TruthyTypesOf<T>>;

  function createFind<T>(predicate: (value: T, index: number, source: Observable<T>) => boolean, thisArg: any, emit: 'value' | 'index'): (source: Observable<T>, subscriber: Subscriber<any>) => void;

  function findIndex<T>(predicate: BooleanConstructor): OperatorFunction<T, T extends Falsy ? -1 : number>;

  function first<T, D = T>(predicate?: null, defaultValue?: D): OperatorFunction<T, T | D>;

  const flatMap: typeof mergeMap;

  function groupBy<T, K>(key: (value: T) => K, options: BasicGroupByOptions<K, T>): OperatorFunction<T, GroupedObservable<K, T>>;

  function ignoreElements(): OperatorFunction<unknown, never>;

  function isEmpty<T>(): OperatorFunction<T, boolean>;

  function joinAllInternals<T, R>(joinFn: (sources: ObservableInput<T>[]) => Observable<T>, project?: (...args: any[]) => R): UnaryFunction<Observable<ObservableInput<T>>, unknown>;

  function last<T>(predicate: BooleanConstructor): OperatorFunction<T, TruthyTypesOf<T>>;

  function map<T, R>(project: (value: T, index: number) => R): OperatorFunction<T, R>;

  function mapTo<R>(value: R): OperatorFunction<unknown, R>;

  function materialize<T>(): OperatorFunction<T, Notification<T> & ObservableNotification<T>>;

  function max<T>(comparer?: (x: T, y: T) => number): MonoTypeOperatorFunction<T>;

  function mergeAll<O extends ObservableInput<any>>(concurrent?: number): OperatorFunction<O, ObservedValueOf<O>>;

  function mergeInternals<T, R>(source: Observable<T>, subscriber: Subscriber<R>, project: (value: T, index: number) => ObservableInput<R>, concurrent: number, onBeforeNext?: (innerValue: R) => void, expand?: boolean, innerSubScheduler?: SchedulerLike, additionalFinalizer?: () => void): () => void;

  function mergeMap<T, O extends ObservableInput<any>>(project: (value: T, index: number) => O, concurrent?: number): OperatorFunction<T, ObservedValueOf<O>>;

  function mergeMapTo<O extends ObservableInput<unknown>>(innerObservable: O, concurrent?: number): OperatorFunction<unknown, ObservedValueOf<O>>;

  function mergeScan<T, R>(accumulator: (acc: R, value: T, index: number) => ObservableInput<R>, seed: R, concurrent?: number): OperatorFunction<T, R>;

  function mergeWith<T, A extends readonly unknown[]>(...otherSources: [...ObservableInputTuple<A>]): OperatorFunction<T, T | A[number]>;

  function min<T>(comparer?: (x: T, y: T) => number): MonoTypeOperatorFunction<T>;

  function multicast<T>(subject: Subject<T>): UnaryFunction<Observable<T>, ConnectableObservable<T>>;

  function observeOn<T>(scheduler: SchedulerLike, delay?: number): MonoTypeOperatorFunction<T>;

  function onErrorResumeNextWith<T, A extends readonly unknown[]>(sources: [...ObservableInputTuple<A>]): OperatorFunction<T, T | A[number]>;

  function createOperatorSubscriber<T>(destination: Subscriber<any>, onNext?: (value: T) => void, onComplete?: () => void, onError?: (err: any) => void, onFinalize?: () => void): Subscriber<T>;

  function pairwise<T>(): OperatorFunction<T, [T, T]>;

  function pluck<T, K1 extends keyof T>(k1: K1): OperatorFunction<T, T[K1]>;

  function publish<T>(): UnaryFunction<Observable<T>, ConnectableObservable<T>>;

  function publishBehavior<T>(initialValue: T): UnaryFunction<Observable<T>, ConnectableObservable<T>>;

  function publishLast<T>(): UnaryFunction<Observable<T>, ConnectableObservable<T>>;

  function publishReplay<T>(bufferSize?: number, windowTime?: number, timestampProvider?: TimestampProvider): MonoTypeOperatorFunction<T>;

  function raceWith<T, A extends readonly unknown[]>(...otherSources: [...ObservableInputTuple<A>]): OperatorFunction<T, T | A[number]>;

  function reduce<V, A = V>(accumulator: (acc: A | V, value: V, index: number) => A): OperatorFunction<V, V | A>;

  function refCount<T>(): MonoTypeOperatorFunction<T>;

  function repeat<T>(countOrConfig?: number | RepeatConfig): MonoTypeOperatorFunction<T>;

  function repeatWhen<T>(notifier: (notifications: Observable<void>) => ObservableInput<any>): MonoTypeOperatorFunction<T>;

  function retry<T>(count?: number): MonoTypeOperatorFunction<T>;

  function retryWhen<T>(notifier: (errors: Observable<any>) => ObservableInput<any>): MonoTypeOperatorFunction<T>;

  function sample<T>(notifier: ObservableInput<any>): MonoTypeOperatorFunction<T>;

  function sampleTime<T>(period: number, scheduler?: SchedulerLike): MonoTypeOperatorFunction<T>;

  function scan<V, A = V>(accumulator: (acc: A | V, value: V, index: number) => A): OperatorFunction<V, V | A>;

  function scanInternals<V, A, S>(accumulator: (acc: V | A | S, value: V, index: number) => A, seed: S, hasSeed: boolean, emitOnNext: boolean, emitBeforeComplete?: undefined | true): (source: Observable<V>, subscriber: Subscriber<any>) => void;

  function sequenceEqual<T>(compareTo: ObservableInput<T>, comparator?: (a: T, b: T) => boolean): OperatorFunction<T, boolean>;

  function share<T>(): MonoTypeOperatorFunction<T>;

  function shareReplay<T>(config: ShareReplayConfig): MonoTypeOperatorFunction<T>;

  function single<T>(predicate: BooleanConstructor): OperatorFunction<T, TruthyTypesOf<T>>;

  function skip<T>(count: number): MonoTypeOperatorFunction<T>;

  function skipLast<T>(skipCount: number): MonoTypeOperatorFunction<T>;

  function skipUntil<T>(notifier: ObservableInput<any>): MonoTypeOperatorFunction<T>;

  function skipWhile<T>(predicate: BooleanConstructor): OperatorFunction<T, Extract<T, Falsy> extends never ? never : T>;

  function startWith<T>(value: null): OperatorFunction<T, T | null>;

  function subscribeOn<T>(scheduler: SchedulerLike, delay?: number): MonoTypeOperatorFunction<T>;

  function switchAll<O extends ObservableInput<any>>(): OperatorFunction<O, ObservedValueOf<O>>;

  function switchMap<T, O extends ObservableInput<any>>(project: (value: T, index: number) => O): OperatorFunction<T, ObservedValueOf<O>>;

  function switchMapTo<O extends ObservableInput<unknown>>(observable: O): OperatorFunction<unknown, ObservedValueOf<O>>;

  function switchScan<T, R, O extends ObservableInput<any>>(accumulator: (acc: R, value: T, index: number) => O, seed: R): OperatorFunction<T, ObservedValueOf<O>>;

  function take<T>(count: number): MonoTypeOperatorFunction<T>;

  function takeLast<T>(count: number): MonoTypeOperatorFunction<T>;

  function takeUntil<T>(notifier: ObservableInput<any>): MonoTypeOperatorFunction<T>;

  function takeWhile<T>(predicate: BooleanConstructor, inclusive: true): MonoTypeOperatorFunction<T>;

  function tap<T>(observerOrNext?: Partial<TapObserver<T>> | ((value: T) => void)): MonoTypeOperatorFunction<T>;

  function throttle<T>(durationSelector: (value: T) => ObservableInput<any>, config?: ThrottleConfig): MonoTypeOperatorFunction<T>;

  function throttleTime<T>(duration: number, scheduler?: SchedulerLike, config?: ThrottleConfig): MonoTypeOperatorFunction<T>;

  function throwIfEmpty<T>(errorFactory?: () => any): MonoTypeOperatorFunction<T>;

  function timeInterval<T>(scheduler?: SchedulerLike): OperatorFunction<T, TimeInterval<T>>;

  function timeout<T, O extends ObservableInput<unknown>, M = unknown>(config: TimeoutConfig<T, O, M> & {
      with: (info: TimeoutInfo<T, M>) => O;
  }): OperatorFunction<T, T | ObservedValueOf<O>>;

  function timeoutWith<T, R>(dueBy: Date, switchTo: ObservableInput<R>, scheduler?: SchedulerLike): OperatorFunction<T, T | R>;

  function timestamp<T>(timestampProvider?: TimestampProvider): OperatorFunction<T, Timestamp<T>>;

  function toArray<T>(): OperatorFunction<T, T[]>;

  function window<T>(windowBoundaries: ObservableInput<any>): OperatorFunction<T, Observable<T>>;

  function windowCount<T>(windowSize: number, startWindowEvery?: number): OperatorFunction<T, Observable<T>>;

  function windowTime<T>(windowTimeSpan: number, scheduler?: SchedulerLike): OperatorFunction<T, Observable<T>>;

  function windowToggle<T, O>(openings: ObservableInput<O>, closingSelector: (openValue: O) => ObservableInput<any>): OperatorFunction<T, Observable<T>>;

  function windowWhen<T>(closingSelector: () => ObservableInput<any>): OperatorFunction<T, Observable<T>>;

  function withLatestFrom<T, O extends unknown[]>(...inputs: [...ObservableInputTuple<O>]): OperatorFunction<T, [T, ...O]>;

  function zipAll<T>(): OperatorFunction<ObservableInput<T>, T[]>;

  function zipWith<T, A extends readonly unknown[]>(...otherInputs: [...ObservableInputTuple<A>]): OperatorFunction<T, Cons<T, A>>;

  function scheduleArray<T>(input: ArrayLike<T>, scheduler: SchedulerLike): Observable<T>;

  function scheduleAsyncIterable<T>(input: AsyncIterable<T>, scheduler: SchedulerLike): Observable<T>;

  function scheduled<T>(input: ObservableInput<T>, scheduler: SchedulerLike): Observable<T>;

  function scheduleIterable<T>(input: Iterable<T>, scheduler: SchedulerLike): Observable<T>;

  function scheduleObservable<T>(input: InteropObservable<T>, scheduler: SchedulerLike): Observable<T>;

  function schedulePromise<T>(input: PromiseLike<T>, scheduler: SchedulerLike): Observable<T>;

  function scheduleReadableStreamLike<T>(input: ReadableStreamLike<T>, scheduler: SchedulerLike): Observable<T>;

  const animationFrameScheduler: AnimationFrameScheduler;

  const animationFrame: AnimationFrameScheduler;

  const animationFrameProvider: AnimationFrameProvider;

  const asapScheduler: AsapScheduler;

  const asap: AsapScheduler;

  const asyncScheduler: AsyncScheduler;

  const async: AsyncScheduler;

  const dateTimestampProvider: DateTimestampProvider;

  const immediateProvider: ImmediateProvider;

  const intervalProvider: IntervalProvider;

  const performanceTimestampProvider: PerformanceTimestampProvider;

  const queueScheduler: QueueScheduler;

  const queue: QueueScheduler;

  const timeoutProvider: TimeoutProvider;

  function getSymbolIterator(): symbol;

  const iterator: symbol;

  const observable: string | symbol;

  function applyMixins(derivedCtor: any, baseCtors: any[]): void;

  function popResultSelector(args: any[]): ((...args: unknown[]) => unknown) | undefined;

  function popScheduler(args: any[]): SchedulerLike | undefined;

  function popNumber(args: any[], defaultValue: number): number;

  function argsArgArrayOrObject<T, O extends Record<string, T>>(args: T[] | [O] | [T[]]): {
      args: T[];
      keys: string[] | null;
  };

  function argsOrArgArray<T>(args: (T | T[])[]): T[];

  function arrRemove<T>(arr: T[] | undefined | null, item: T): void;

  function createErrorClass<T>(createImpl: (_super: any) => any): T;

  function createObject(keys: string[], values: any[]): any;

  function errorContext(cb: () => void): void;

  function captureError(err: any): void;

  function executeSchedule(parentSubscription: Subscription, scheduler: SchedulerLike, work: () => void, delay: number, repeat: true): void;

  function identity<T>(x: T): T;

  const Immediate: {
      setImmediate(cb: () => void): number;
      clearImmediate(handle: number): void;
  };

  const TestTools: {
      pending(): number;
  };

  const isArrayLike: <T>(x: any) => x is ArrayLike<T>;

  function isAsyncIterable<T>(obj: any): obj is AsyncIterable<T>;

  function isValidDate(value: any): value is Date;

  function isFunction(value: any): value is (...args: any[]) => any;

  function isInteropObservable(input: any): input is InteropObservable<any>;

  function isIterable(input: any): input is Iterable<any>;

  function isObservable(obj: any): obj is Observable<unknown>;

  function isPromise(value: any): value is PromiseLike<any>;

  function readableStreamLikeToAsyncGenerator<T>(readableStream: ReadableStreamLike<T>): AsyncGenerator<T>;

  function isReadableStreamLike<T>(obj: any): obj is ReadableStreamLike<T>;

  function isScheduler(value: any): value is SchedulerLike;

  function hasLift(source: any): source is {
      lift: InstanceType<typeof Observable>['lift'];
  };

  function operate<T, R>(init: (liftedSource: Observable<T>, subscriber: Subscriber<R>) => (() => void) | void): OperatorFunction<T, R>;

  function mapOneOrManyArgs<T, R>(fn: ((...values: T[]) => R)): OperatorFunction<T | T[], R>;

  function noop(): void;

  function not<T>(pred: (value: T, index: number) => boolean, thisArg: any): (value: T, index: number) => boolean;

  function pipe(): typeof identity;

  function reportUnhandledError(err: any): void;

  const subscribeToArray: <T>(array: ArrayLike<T>) => (subscriber: Subscriber<T>) => void;

  function createInvalidObservableTypeError(input: any): TypeError;

  function animationFrames(timestampProvider?: TimestampProvider): Observable<{
      timestamp: number;
      elapsed: number;
  }>;

  function fromFetch<T>(input: string | Request, init: RequestInit & {
      selector: (response: Response) => ObservableInput<T>;
  }): Observable<T>;

  function webSocket<T>(urlConfigOrSource: string | WebSocketSubjectConfig<T>): WebSocketSubject<T>;
}

// ===== Types and Classes from @bonsai/event =====
export type EventCallback<T = any> = (data: T) => void;
export type RequestHandler<TRequest = any, TResponse = any> = (data: TRequest) => TResponse | Promise<TResponse>;
export declare class Channel {
    readonly name: string;
    private listeners;
    private requestHandlers;
    constructor(name: string);
    /**
     * Enregistre un listener pour un événement (Pub/Sub)
     */
    on<T = any>(event: string, callback: EventCallback<T>): void;
    /**
     * Supprime un listener pour un événement
     */
    off(event: string, callback: EventCallback): void;
    /**
     * Déclenche un événement avec des données (Pub/Sub)
     */
    trigger<T = any>(event: string, data?: T): void;
    /**
     * Enregistre un handler pour une requête (Request/Reply)
     */
    reply<TRequest = any, TResponse = any>(requestType: string, handler: RequestHandler<TRequest, TResponse>): void;
    /**
     * Supprime un handler de requête
     */
    unreply(requestType: string): void;
    /**
     * Effectue une requête et attend la réponse (Request/Reply)
     */
    request<TRequest = any, TResponse = any>(requestType: string, data?: TRequest): Promise<TResponse>;
    /**
     * Obtient la liste des événements écoutés
     */
    getListenedEvents(): string[];
    /**
     * Obtient la liste des types de requête supportés
     */
    getSupportedRequests(): string[];
    /**
     * Vérifie si le channel écoute un événement
     */
    isListening(event: string): boolean;
    /**
     * Vérifie si le channel peut traiter un type de requête
     */
    canHandle(requestType: string): boolean;
    /**
     * Nettoyage complet du channel
     */
    clear(): void;
}
export declare abstract class EventTrigger<ChildEventTrigger extends EventTrigger<ChildEventTrigger, ChildEventMap>, ChildEventMap extends TEventMap<TDefaultEventMap>> {
    /** @hidden */
    readonly TClassEventMap: ChildEventMap;
    private subjects;
    private subscriptions;
    on<EventKey extends keyof ChildEventMap, Callback extends EventKeyCallback<ChildEventMap, EventKey>>(event: EventKey, listener: Callback): void;
    off<EventKey extends keyof ChildEventMap>(event: EventKey): void;
    once<EventKey extends keyof ChildEventMap, Callback extends EventKeyCallback<ChildEventMap, EventKey>>(event: EventKey, listener: Callback): void;
    listenTo<ListenObj extends AnyEventTrigger, ListenEventMap extends ListenObj["TClassEventMap"], ListenEventKey extends Extract<keyof ListenEventMap, string>, ListenCallback extends ListenEventMap[ListenEventKey]>(emitter: ListenObj, event: ListenEventKey, listener: ListenEventMap[ListenEventKey]): void;
    listenToOnce(emitter: EventTrigger<ChildEventTrigger, ChildEventMap>, event: Extract<keyof ChildEventMap, string | number>, listener: (...args: any[]) => void): void;
    stopListening<EventKey extends keyof ChildEventMap>(event: EventKey): void;
    trigger<EventKey extends keyof ChildEventMap, CallbackParams extends ChildEventMap[EventKey]>(event: EventKey, data: CallbackParams): void;
    private getEventObservable;
}
export declare class Radio {
    private static instance;
    private channels;
    /**
     * Constructeur privé pour forcer le pattern singleton
     */
    private constructor();
    /**
     * Obtient l'instance unique du Radio
     */
    static me(): Radio;
    /**
     * Obtient ou crée un channel par son nom
     */
    channel(name: string): Channel;
    /**
     * Liste tous les noms de channels existants
     */
    getChannelNames(): string[];
    /**
     * Vérifie si un channel existe
     */
    hasChannel(name: string): boolean;
    /**
     * Supprime un channel
     */
    removeChannel(name: string): boolean;
    /**
     * Réinitialise le Radio (utile pour les tests)
     */
    static reset(): void;
}
export type EventHandlerParamObj = {
    [key: string]: TJsonValue;
};
export type TDefaultEventMap = {
    [K: string]: EventHandlerParamObj;
};
export type TEventMap<EventMap extends TDefaultEventMap> = {
    [K in keyof EventMap]: EventMap[K];
} & {
    all: EventMap;
};
export type ThisMapEvents<EventMap extends TDefaultEventMap, EventKey extends keyof EventMap> = Map<EventKey, RXJS.Subject<EventMap[EventKey]>>;
export type EventKeyCallback<EventMap extends TDefaultEventMap, EventKey extends keyof EventMap> = (data: EventMap[EventKey]) => void;
export interface AnyEventTrigger<ObjEventMap extends TEventMap<TDefaultEventMap> = TEventMap<TDefaultEventMap>> extends EventTrigger<AnyEventTrigger<ObjEventMap>, ObjEventMap> {
    [key: string]: any;
}

