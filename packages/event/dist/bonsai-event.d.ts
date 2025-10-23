/**
 * Bundled TypeScript definitions
 * Generated: 2025-10-23T11:57:15.384Z
 */

// External imports
import { TJsonValue } from "@bonsai/types";
import { RXJS } from "@bonsai/rxjs";

// Type declarations
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
