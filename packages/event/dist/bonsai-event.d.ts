/**
 * Bundled TypeScript definitions
 * Generated: 2025-10-23T15:13:53.708Z
 */

// External imports
import { TJsonValue } from "@bonsai/types";
import { RXJS } from "@bonsai/rxjs";

// Type declarations
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
