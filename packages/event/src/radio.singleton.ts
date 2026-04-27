/**
 * Radio — Singleton registre des Channels.
 *
 * Radio est le point central de câblage des communications Bonsai.
 * Il gère les instances Channel par namespace (get-or-create).
 *
 * I15 — Radio n'est jamais exposé au développeur d'application.
 *
 * @see RFC 2-architecture/communication.md §8
 */

import { Channel, type TChannelDefinition, type TChannelToken } from "./channel.class";

export class Radio {
  static #instance: Radio | undefined;
  static #constructing = false;
  readonly #channels = new Map<string, Channel>();

  /** Constructeur privé — force le pattern singleton via `me()`. */
  private constructor() {
    if (!Radio.#constructing) {
      throw new Error(
        "Radio is a singleton — use Radio.me() to get the instance."
      );
    }
  }

  /** Retourne l'instance unique du Radio. */
  static me(): Radio {
    if (!Radio.#instance) {
      Radio.#constructing = true;
      Radio.#instance = new Radio();
      Radio.#constructing = false;
    }
    return Radio.#instance;
  }

  /**
   * Obtient ou crée un Channel par namespace (API interne).
   * Retourne `Channel<TChannelDefinition>` — toutes lanes `Record<string, unknown>`.
   * Pour un accès typé depuis l'extérieur, utiliser `channelFor(token)`.
   */
  channel(name: string): Channel {
    if (!this.#channels.has(name)) {
      this.#channels.set(name, new Channel(name));
    }
    return this.#channels.get(name)!;
  }

  /**
   * Obtient ou crée un Channel typé via son token (ADR-0040, I77, I79).
   *
   * Le cast `as Channel<TDef>` est sûr par I22 : un namespace ne peut être
   * associé qu'à une seule Feature et donc à un seul `TDef`.
   */
  channelFor<TDef extends TChannelDefinition, TNS extends string>(
    token: TChannelToken<TDef, TNS>
  ): Channel<TDef> {
    return this.channel(token.namespace) as Channel<TDef>;
  }

  /** Vérifie si un Channel existe pour ce namespace. */
  hasChannel(name: string): boolean {
    return this.#channels.has(name);
  }

  /** Liste tous les namespaces enregistrés. */
  getChannelNames(): string[] {
    return Array.from(this.#channels.keys());
  }

  /**
   * Supprime un Channel. Appelle `clear()` sur le Channel avant suppression.
   * @returns `true` si le Channel existait, `false` sinon
   */
  removeChannel(name: string): boolean {
    const channel = this.#channels.get(name);
    if (channel) {
      channel.clear();
      return this.#channels.delete(name);
    }
    return false;
  }

  /** Reset complet — détruit le singleton. Usage : tests uniquement. */
  static reset(): void {
    if (Radio.#instance) {
      for (const [, channel] of Radio.#instance.#channels) {
        channel.clear();
      }
      Radio.#instance.#channels.clear();
    }
    Radio.#instance = undefined;
  }
}
