/**
 * @bonsai/event - Version 1.0.0
 * Bundled by Bonsai Build System
 * Date: 2025-10-23T11:57:14.606Z
 */
import { RXJS } from '@bonsai/rxjs';

class EventTrigger {
    constructor() {
        this.subjects = new Map();
        this.subscriptions = new Map();
    }
    on(event, listener) {
        if (!this.subjects.has(event)) {
            this.subjects.set(event, new RXJS.Subject());
        }
        this.subjects.get(event).subscribe(listener);
    }
    off(event) {
        const subject = this.subjects.get(event);
        if (subject) {
            const subscription = this.subscriptions.get(event);
            if (subscription) {
                subscription.unsubscribe();
                this.subscriptions.delete(event);
            }
        }
    }
    once(event, listener) {
        if (!this.subjects.has(event)) {
            this.subjects.set(event, new RXJS.Subject());
        }
        this.subjects.get(event).pipe(RXJS.take(1)).subscribe(listener);
    }
    listenTo(emitter, event, listener) {
        const subscription = emitter.getEventObservable(event).subscribe(listener);
        this.subscriptions.set(event, subscription);
    }
    listenToOnce(emitter, event, listener) {
        const subject = emitter.getEventObservable(event);
        if (subject instanceof RXJS.Subject) {
            const subscription = subject.pipe(RXJS.take(1)).subscribe(listener);
            this.subscriptions.set(event, subscription);
        }
    }
    stopListening(event) {
        const subscription = this.subscriptions.get(event);
        if (subscription) {
            subscription.unsubscribe();
            this.subscriptions.delete(event);
        }
    }
    trigger(event, data) {
        if (!this.subjects.has(event)) {
            this.subjects.set(event, new RXJS.Subject());
        }
        this.subjects.get(event).next(data);
    }
    getEventObservable(event) {
        if (!this.subjects.has(event)) {
            this.subjects.set(event, new RXJS.Subject());
        }
        return this.subjects.get(event);
    }
}
class TestEvent extends EventTrigger {
}
const testEvent = new TestEvent();
testEvent.on("event1", (message) => {
    console.log(`Received: [idea ${message.idea}] [num ${message.num}] [isFinite ${message.isFinite}]`);
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

export { EventTrigger };
