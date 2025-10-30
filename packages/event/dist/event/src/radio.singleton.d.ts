/**
 * Radio Singleton - Gestionnaire central des channels de communication
 *
 * Le Radio est le point central de communication dans Bonsai.
 * Il gère les channels nommés et permet l'accès global aux communications.
 */
import { Channel } from "./channel.class";
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
