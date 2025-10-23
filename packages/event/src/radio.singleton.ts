/**
 * Radio Singleton - Gestionnaire central des channels de communication
 *
 * Le Radio est le point central de communication dans Bonsai.
 * Il gère les channels nommés et permet l'accès global aux communications.
 */

import { Channel } from "./channel.class";

export class Radio {
  private static instance: Radio;
  private channels: Map<string, Channel> = new Map();

  /**
   * Constructeur privé pour forcer le pattern singleton
   */
  private constructor() {}

  /**
   * Obtient l'instance unique du Radio
   */
  static me(): Radio {
    if (!Radio.instance) {
      Radio.instance = new Radio();
    }
    return Radio.instance;
  }

  /**
   * Obtient ou crée un channel par son nom
   */
  channel(name: string): Channel {
    if (!this.channels.has(name)) {
      this.channels.set(name, new Channel(name));
    }
    return this.channels.get(name)!;
  }

  /**
   * Liste tous les noms de channels existants
   */
  getChannelNames(): string[] {
    return Array.from(this.channels.keys());
  }

  /**
   * Vérifie si un channel existe
   */
  hasChannel(name: string): boolean {
    return this.channels.has(name);
  }

  /**
   * Supprime un channel
   */
  removeChannel(name: string): boolean {
    return this.channels.delete(name);
  }

  /**
   * Réinitialise le Radio (utile pour les tests)
   */
  static reset(): void {
    if (Radio.instance) {
      Radio.instance.channels.clear();
    }
    Radio.instance = undefined as any;
  }
}
