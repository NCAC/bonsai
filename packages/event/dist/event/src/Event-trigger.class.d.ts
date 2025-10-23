import { TEventMap, TDefaultEventMap, EventKeyCallback, AnyEventTrigger } from "./types";
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
