/**
 * Types pour le système d'événements de Bonsai
 *
 * Ces types définissent les interfaces pour les événements,
 * les requêtes et les channels typés.
 */

/**
 * Fonction de callback pour un événement
 */
export type EventCallback<TData = any> = (data: TData) => void;

/**
 * Fonction de callback pour une requête une seule fois
 */
export type OnceCallback<TData = any> = (data: TData) => void;

/**
 * Handler pour les requêtes request/reply
 */
export type RequestHandler<TInput = any, TOutput = any> = (
  input: TInput
) => TOutput | Promise<TOutput>;

/**
 * Map des événements typés pour un channel
 * Clé = nom de l'événement, Valeur = type des données
 */
export type EventMap = Record<string, any>;

/**
 * Map des requêtes typées pour un channel
 * Clé = nom de la requête, Valeur = fonction handler
 */
export type RequestMap = Record<string, RequestHandler>;

/**
 * Options pour les listeners d'événements
 */
export interface ListenerOptions {
  /** Contexte dans lequel exécuter le callback */
  context?: any;
  /** Si true, le listener sera automatiquement retiré après la première exécution */
  once?: boolean;
}

/**
 * Informations sur un listener enregistré
 */
export interface ListenerInfo<TData = any> {
  callback: EventCallback<TData>;
  context?: any;
  once: boolean;
  id: string;
}

/**
 * Interface pour les objets qui peuvent émettre des événements
 */
export interface EventEmitter<TEvents extends EventMap = EventMap> {
  on<K extends keyof TEvents>(
    event: K,
    callback: EventCallback<TEvents[K]>,
    options?: ListenerOptions
  ): void;
  off<K extends keyof TEvents>(
    event: K,
    callback?: EventCallback<TEvents[K]>
  ): void;
  once<K extends keyof TEvents>(
    event: K,
    callback: OnceCallback<TEvents[K]>
  ): void;
  trigger<K extends keyof TEvents>(event: K, data: TEvents[K]): void;
  hasListeners<K extends keyof TEvents>(event?: K): boolean;
}

/**
 * Interface pour les objets qui peuvent gérer des requêtes
 */
export interface RequestReply<TRequests extends RequestMap = RequestMap> {
  reply<K extends keyof TRequests>(request: K, handler: TRequests[K]): void;
  stopReplying<K extends keyof TRequests>(request: K): void;
  request<K extends keyof TRequests>(
    request: K,
    ...args: Parameters<TRequests[K]>
  ): Promise<ReturnType<TRequests[K]>>;
  hasReplyHandler<K extends keyof TRequests>(request: K): boolean;
}
