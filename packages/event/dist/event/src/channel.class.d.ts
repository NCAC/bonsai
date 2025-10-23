/**
 * Channel - Gestionnaire de communications pub/sub et request/reply
 *
 * Un Channel représente un canal de communication nommé qui supporte :
 * - Pub/Sub avec événements
 * - Request/Reply avec promesses
 */
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
