import {
  TEventMap,
  TDefaultEventMap,
  ThisMapEvents,
  EventKeyCallback,
  AnyEventTrigger
} from "./types";
import { RXJS } from "@bonsai/rxjs";

export abstract class EventTrigger<
  ChildEventTrigger extends EventTrigger<ChildEventTrigger, ChildEventMap>,
  ChildEventMap extends TEventMap<TDefaultEventMap>
> {
  /** @hidden */
  readonly TClassEventMap: ChildEventMap;

  private subjects: ThisMapEvents<ChildEventMap, keyof ChildEventMap> =
    new Map();
  private subscriptions: Map<keyof ChildEventMap, RXJS.Subscription> =
    new Map();

  on<
    EventKey extends keyof ChildEventMap,
    Callback extends EventKeyCallback<ChildEventMap, EventKey>
  >(event: EventKey, listener: Callback): void {
    if (!this.subjects.has(event)) {
      this.subjects.set(event, new RXJS.Subject<ChildEventMap[EventKey]>());
    }
    this.subjects.get(event)!.subscribe(listener);
  }

  off<EventKey extends keyof ChildEventMap>(event: EventKey): void {
    const subject = this.subjects.get(event);
    if (subject) {
      const subscription = this.subscriptions.get(event);
      if (subscription) {
        subscription.unsubscribe();
        this.subscriptions.delete(event);
      }
    }
  }

  once<
    EventKey extends keyof ChildEventMap,
    Callback extends EventKeyCallback<ChildEventMap, EventKey>
  >(event: EventKey, listener: Callback): void {
    if (!this.subjects.has(event)) {
      this.subjects.set(event, new RXJS.Subject<ChildEventMap[EventKey]>());
    }
    this.subjects.get(event)!.pipe(RXJS.take(1)).subscribe(listener);
  }

  listenTo<
    ListenObj extends AnyEventTrigger,
    ListenEventMap extends ListenObj["TClassEventMap"],
    ListenEventKey extends Extract<keyof ListenEventMap, string>,
    ListenCallback extends ListenEventMap[ListenEventKey]
  >(
    emitter: ListenObj,
    event: ListenEventKey,
    listener: ListenEventMap[ListenEventKey]
  ): void {
    const subscription = emitter.getEventObservable(event).subscribe(listener);
    this.subscriptions.set(event, subscription);
  }

  listenToOnce(
    emitter: EventTrigger<ChildEventTrigger, ChildEventMap>,
    event: Extract<keyof ChildEventMap, string | number>,
    listener: (...args: any[]) => void
  ): void {
    const subject = emitter.getEventObservable(event);
    if (subject instanceof RXJS.Subject) {
      const subscription = subject.pipe(RXJS.take(1)).subscribe(listener);
      this.subscriptions.set(event, subscription);
    }
  }

  stopListening<EventKey extends keyof ChildEventMap>(event: EventKey): void {
    const subscription = this.subscriptions.get(event);
    if (subscription) {
      subscription.unsubscribe();
      this.subscriptions.delete(event);
    }
  }

  trigger<
    EventKey extends keyof ChildEventMap,
    CallbackParams extends ChildEventMap[EventKey]
  >(event: EventKey, data: CallbackParams): void {
    if (!this.subjects.has(event)) {
      this.subjects.set(event, new RXJS.Subject<CallbackParams>());
    }
    this.subjects.get(event)!.next(data);
  }

  private getEventObservable<
    EventKey extends keyof ChildEventMap,
    CallbackParams extends ChildEventMap[EventKey]
  >(event: EventKey): RXJS.Subject<ChildEventMap[EventKey]> {
    if (!this.subjects.has(event)) {
      this.subjects.set(event, new RXJS.Subject<ChildEventMap[EventKey]>());
    }
    return this.subjects.get(event) as RXJS.Subject<ChildEventMap[EventKey]>;
  }
}

type TestEventMap = TEventMap<{
  event1: { idea: string; num: number; isFinite: boolean };
  event2: { string: string };
}>;
class TestEvent extends EventTrigger<TestEvent, TestEventMap> {
  // ...
}

const testEvent = new TestEvent();

testEvent.on("event1", (message) => {
  console.log(
    `Received: [idea ${message.idea}] [num ${message.num}] [isFinite ${message.isFinite}]`
  );
});

testEvent.trigger("event1", { idea: "Hello", num: 42, isFinite: true });

testEvent.off("event1");

// // Exemple d'utilisation
// const emitter1 = new EventTrigger();
// const emitter2 = new EventTrigger();

// emitter1.on("event1", (message: string) => {
//   console.log(`emitter1 received: ${message}`);
// });

// emitter2.listenTo(emitter1, "event1", (message: string) => {
//   console.log(`emitter2 received: ${message}`);
// });

// emitter1.trigger("event1", "Hello, world!");

// // Utilisation de listenToOnce
// emitter2.listenToOnce(emitter1, "event2", (message: string) => {
//   console.log(`emitter2 received once: ${message}`);
// });

// emitter1.trigger("event2", "This will be received once");
// emitter1.trigger("event2", "This will not be received");

// // Arrêter d'écouter un événement
// emitter2.stopListening("event1");
// emitter1.trigger("event1", "This will not be received by emitter2");

// type MyEventMap = TEventMap<{
//   event1: (message: { idea: string; num: number; isFinite: boolean }) => void;
//   event2: (message: string) => void;
// }>;

// class MyEvent extends EventTrigger<MyEvent, MyEventMap> {
//   // ...
// }

// const myEvent = new MyEvent();

// myEvent.on("event1", (message) => {
//   console.log(`Received: ${message.idea} ${message.num} ${message.isFinite}`);
// });
