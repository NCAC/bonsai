import { TParameters, AnyFunction, TJsonValue } from "@bonsai/types";
import { EventTrigger } from "./Event-trigger.class";
import { RXJS } from "@bonsai/rxjs";

export type EventHandlerParamObj = {
  [key: string]: TJsonValue;
};

/**
 * An literal object with key: `string` and value: `EventHandlerParamObj`
 */
export type TDefaultEventMap = {
  [K: string]: EventHandlerParamObj;
};

/**
 * Ensure that `EventMap` is well typed and add an `all` event, which is common to all EventMaps
 *
 * @typeParam EventMap - A literal object with key: `string` and value: `AnyClassEventHandlerFunction`
 */
export type TEventMap<EventMap extends TDefaultEventMap> = {
  [K in keyof EventMap]: EventMap[K];
} & {
  all: EventMap;
};

export type ThisMapEvents<
  EventMap extends TDefaultEventMap,
  EventKey extends keyof EventMap
> = Map<EventKey, RXJS.Subject<EventMap[EventKey]>>;

export type EventKeyCallback<
  EventMap extends TDefaultEventMap,
  EventKey extends keyof EventMap
> = (data: EventMap[EventKey]) => void;

export interface AnyEventTrigger<
  ObjEventMap extends TEventMap<TDefaultEventMap> = TEventMap<TDefaultEventMap>
> extends EventTrigger<AnyEventTrigger<ObjEventMap>, ObjEventMap> {
  [key: string]: any;
}
//
//
//
