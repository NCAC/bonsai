/**
 * Radio — singleton registry of Channels.
 *
 * Radio is the central wiring point of Bonsai communication. It manages
 * Channel instances by namespace (get-or-create).
 *
 * I15 — Radio is never exposed to application developers.
 *
 * @see docs/spec/2-architecture/communication.md §8
 */

import { Channel, type TChannelDefinition, type TChannelToken } from "./channel.class";

export class Radio {
  static #instance: Radio | undefined;
  static #constructing = false;
  readonly #channels = new Map<string, Channel>();

  /** Private constructor — enforces the singleton through `me()`. */
  private constructor() {
    if (!Radio.#constructing) {
      throw new Error(
        "Radio is a singleton — use Radio.me() to get the instance."
      );
    }
  }

  /** Returns the single Radio instance. */
  static me(): Radio {
    if (!Radio.#instance) {
      Radio.#constructing = true;
      Radio.#instance = new Radio();
      Radio.#constructing = false;
    }
    return Radio.#instance;
  }

  /**
   * Gets or creates a Channel by namespace (internal API).
   * Returns `Channel<TChannelDefinition>` — all lanes `Record<string, unknown>`.
   * For typed access from outside, use `channelFor(token)`.
   */
  channel(name: string): Channel {
    if (!this.#channels.has(name)) {
      this.#channels.set(name, new Channel(name));
    }
    return this.#channels.get(name)!;
  }

  /**
   * Gets or creates a typed Channel from its token (ADR-14, I77, I79).
   *
   * The `as Channel<TDef>` cast is safe by I22: a namespace belongs to a
   * single Feature, hence to a single `TDef`.
   */
  channelFor<TDef extends TChannelDefinition, TNS extends string>(
    token: TChannelToken<TDef, TNS>
  ): Channel<TDef> {
    return this.channel(token.namespace) as Channel<TDef>;
  }

  /** Checks whether a Channel exists for this namespace. */
  hasChannel(name: string): boolean {
    return this.#channels.has(name);
  }

  /** Lists all registered namespaces. */
  getChannelNames(): string[] {
    return Array.from(this.#channels.keys());
  }

  /**
   * Removes a Channel, calling `clear()` on it first.
   * @returns `true` if the Channel existed, `false` otherwise
   */
  removeChannel(name: string): boolean {
    const channel = this.#channels.get(name);
    if (channel) {
      channel.clear();
      return this.#channels.delete(name);
    }
    return false;
  }

  /** Full reset — destroys the singleton. Tests only. */
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
