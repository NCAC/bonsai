/**
 * @credit https://github.com/sindresorhus/type-fest
 */

//#region entry

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

//#endregion

//#region entries

/**
Many collections have an `entries` method which returns an array of a given object's own enumerable string-keyed property [key, value] pairs. The `Entry` type will return the type of that collection's entry.
For example the {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/entries|`Object`}, {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/entries|`Map`}, {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/entries|`Array`}, and {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/entries|`Set`} collections all have this method. Note that `WeakMap` and `WeakSet` do not have this method since their entries are not enumerable.
@see `Entries` if you want to just access the type of the array of entries (which is the return of the `.entries()` method).
@example
```
import type {Entry} from 'type-fest';
interface Example {
	someKey: number;
}
const manipulatesEntry = (example: Entry<Example>) => [
	// Does some arbitrary processing on the key (with type information available)
	example[0].toUpperCase(),
	// Does some arbitrary processing on the value (with type information available)
	example[1].toFixed(),
];
const example: Example = {someKey: 1};
const entry = Object.entries(example)[0] as Entry<Example>;
const output = manipulatesEntry(entry);
// Objects
const objectExample = {a: 1};
const objectEntry: Entry<typeof objectExample> = ['a', 1];
// Arrays
const arrayExample = ['a', 1];
const arrayEntryString: Entry<typeof arrayExample> = [0, 'a'];
const arrayEntryNumber: Entry<typeof arrayExample> = [1, 1];
// Maps
const mapExample = new Map([['a', 1]]);
const mapEntry: Entry<typeof mapExample> = ['a', 1];
// Sets
const setExample = new Set(['a', 1]);
const setEntryString: Entry<typeof setExample> = ['a', 'a'];
const setEntryNumber: Entry<typeof setExample> = [1, 1];
```
@category Object
@category Map
@category Array
@category Set
*/
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

/**
Many collections have an `entries` method which returns an array of a given object's own enumerable string-keyed property [key, value] pairs. The `Entries` type will return the type of that collection's entries.
For example the {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/entries|`Object`}, {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/entries|`Map`}, {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/entries|`Array`}, and {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/entries|`Set`} collections all have this method. Note that `WeakMap` and `WeakSet` do not have this method since their entries are not enumerable.
@see `Entry` if you want to just access the type of a single entry.
@example
```
import type {Entries} from 'type-fest';
interface Example {
	someKey: number;
}
const manipulatesEntries = (examples: Entries<Example>) => examples.map(example => [
	// Does some arbitrary processing on the key (with type information available)
	example[0].toUpperCase(),
	// Does some arbitrary processing on the value (with type information available)
	example[1].toFixed()
]);
const example: Example = {someKey: 1};
const entries = Object.entries(example) as Entries<Example>;
const output = manipulatesEntries(entries);
// Objects
const objectExample = {a: 1};
const objectEntries: Entries<typeof objectExample> = [['a', 1]];
// Arrays
const arrayExample = ['a', 1];
const arrayEntries: Entries<typeof arrayExample> = [[0, 'a'], [1, 1]];
// Maps
const mapExample = new Map([['a', 1]]);
const mapEntries: Entries<typeof map> = [['a', 1]];
// Sets
const setExample = new Set(['a', 1]);
const setEntries: Entries<typeof setExample> = [['a', 'a'], [1, 1]];
```
@category Object
@category Map
@category Set
@category Array
*/
export type TEntries<BaseType> = BaseType extends Map<unknown, unknown>
  ? TMapEntries<BaseType>
  : BaseType extends Set<unknown>
  ? TSetEntries<BaseType>
  : BaseType extends readonly unknown[]
  ? ArrayEntries<BaseType>
  : BaseType extends object
  ? TObjectEntries<BaseType>
  : never;

//#endregion
