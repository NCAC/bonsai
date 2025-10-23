/**
 * @bonsai/event - Version 0.1.0
 * Bundled by Bonsai Build System
 * Date: 2025-10-23T15:13:52.700Z
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

/**
 * Channel - Gestionnaire de communications pub/sub et request/reply
 *
 * Un Channel représente un canal de communication nommé qui supporte :
 * - Pub/Sub avec événements
 * - Request/Reply avec promesses
 */
class Channel {
    constructor(name) {
        this.name = name;
        this.listeners = new Map();
        this.requestHandlers = new Map();
    }
    /**
     * Enregistre un listener pour un événement (Pub/Sub)
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }
    /**
     * Supprime un listener pour un événement
     */
    off(event, callback) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }
    /**
     * Déclenche un événement avec des données (Pub/Sub)
     */
    trigger(event, data) {
        const callbacks = this.listeners.get(event) || [];
        callbacks.forEach((callback) => {
            try {
                callback(data);
            }
            catch (error) {
                console.error(`Error in event listener for ${event}:`, error);
            }
        });
    }
    /**
     * Enregistre un handler pour une requête (Request/Reply)
     */
    reply(requestType, handler) {
        this.requestHandlers.set(requestType, handler);
    }
    /**
     * Supprime un handler de requête
     */
    unreply(requestType) {
        this.requestHandlers.delete(requestType);
    }
    /**
     * Effectue une requête et attend la réponse (Request/Reply)
     */
    async request(requestType, data) {
        const handler = this.requestHandlers.get(requestType);
        if (!handler) {
            throw new Error(`No handler registered for request type: ${requestType}`);
        }
        try {
            const result = await handler(data);
            return result;
        }
        catch (error) {
            throw new Error(`Request handler error for ${requestType}: ${error}`);
        }
    }
    /**
     * Obtient la liste des événements écoutés
     */
    getListenedEvents() {
        return Array.from(this.listeners.keys());
    }
    /**
     * Obtient la liste des types de requête supportés
     */
    getSupportedRequests() {
        return Array.from(this.requestHandlers.keys());
    }
    /**
     * Vérifie si le channel écoute un événement
     */
    isListening(event) {
        return this.listeners.has(event) && this.listeners.get(event).length > 0;
    }
    /**
     * Vérifie si le channel peut traiter un type de requête
     */
    canHandle(requestType) {
        return this.requestHandlers.has(requestType);
    }
    /**
     * Nettoyage complet du channel
     */
    clear() {
        this.listeners.clear();
        this.requestHandlers.clear();
    }
}

/**
 * Radio Singleton - Gestionnaire central des channels de communication
 *
 * Le Radio est le point central de communication dans Bonsai.
 * Il gère les channels nommés et permet l'accès global aux communications.
 */
class Radio {
    /**
     * Constructeur privé pour forcer le pattern singleton
     */
    constructor() {
        this.channels = new Map();
    }
    /**
     * Obtient l'instance unique du Radio
     */
    static me() {
        if (!Radio.instance) {
            Radio.instance = new Radio();
        }
        return Radio.instance;
    }
    /**
     * Obtient ou crée un channel par son nom
     */
    channel(name) {
        if (!this.channels.has(name)) {
            this.channels.set(name, new Channel(name));
        }
        return this.channels.get(name);
    }
    /**
     * Liste tous les noms de channels existants
     */
    getChannelNames() {
        return Array.from(this.channels.keys());
    }
    /**
     * Vérifie si un channel existe
     */
    hasChannel(name) {
        return this.channels.has(name);
    }
    /**
     * Supprime un channel
     */
    removeChannel(name) {
        return this.channels.delete(name);
    }
    /**
     * Réinitialise le Radio (utile pour les tests)
     */
    static reset() {
        if (Radio.instance) {
            Radio.instance.channels.clear();
        }
        Radio.instance = undefined;
    }
}

export { Channel, EventTrigger, Radio };
