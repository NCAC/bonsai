/**
 * Channel - Gestionnaire de communications pub/sub et request/reply
 *
 * Un Channel représente un canal de communication nommé qui supporte :
 * - Pub/Sub avec événements
 * - Request/Reply avec promesses
 */

export type EventCallback<T = any> = (data: T) => void;
export type RequestHandler<TRequest = any, TResponse = any> = (
  data: TRequest
) => TResponse | Promise<TResponse>;

export class Channel {
  private listeners: Map<string, EventCallback[]> = new Map();
  private requestHandlers: Map<string, RequestHandler> = new Map();

  constructor(public readonly name: string) {}

  /**
   * Enregistre un listener pour un événement (Pub/Sub)
   */
  on<T = any>(event: string, callback: EventCallback<T>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  /**
   * Supprime un listener pour un événement
   */
  off(event: string, callback: EventCallback): void {
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
  trigger<T = any>(event: string, data?: T): void {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
  }

  /**
   * Enregistre un handler pour une requête (Request/Reply)
   */
  reply<TRequest = any, TResponse = any>(
    requestType: string,
    handler: RequestHandler<TRequest, TResponse>
  ): void {
    this.requestHandlers.set(requestType, handler);
  }

  /**
   * Supprime un handler de requête
   */
  unreply(requestType: string): void {
    this.requestHandlers.delete(requestType);
  }

  /**
   * Effectue une requête et attend la réponse (Request/Reply)
   */
  async request<TRequest = any, TResponse = any>(
    requestType: string,
    data?: TRequest
  ): Promise<TResponse> {
    const handler = this.requestHandlers.get(requestType);
    if (!handler) {
      throw new Error(`No handler registered for request type: ${requestType}`);
    }

    try {
      const result = await handler(data);
      return result;
    } catch (error) {
      throw new Error(`Request handler error for ${requestType}: ${error}`);
    }
  }

  /**
   * Obtient la liste des événements écoutés
   */
  getListenedEvents(): string[] {
    return Array.from(this.listeners.keys());
  }

  /**
   * Obtient la liste des types de requête supportés
   */
  getSupportedRequests(): string[] {
    return Array.from(this.requestHandlers.keys());
  }

  /**
   * Vérifie si le channel écoute un événement
   */
  isListening(event: string): boolean {
    return this.listeners.has(event) && this.listeners.get(event)!.length > 0;
  }

  /**
   * Vérifie si le channel peut traiter un type de requête
   */
  canHandle(requestType: string): boolean {
    return this.requestHandlers.has(requestType);
  }

  /**
   * Nettoyage complet du channel
   */
  clear(): void {
    this.listeners.clear();
    this.requestHandlers.clear();
  }
}
