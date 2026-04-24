/**
 * @bonsai/feature — Feature base class
 *
 * Strate 0 — Les 5 capacités :
 *   C1 — emit(event, payload) sur son propre Channel
 *   C2 — handle(command) via auto-discovery des méthodes on{Name}Command
 *   C3 — listen(event) sur Channels externes déclarés via on{Channel}{EventName}Event
 *   C4 — reply(request) via auto-discovery des méthodes on{Name}Request
 *   C5 — request(target, name, params) vers Channels déclarés
 *
 * Invariants :
 *   I1  — Feature ne peut emit() que sur son propre Channel
 *   I2  — Feature peut listen les Events des Channels externes déclarés
 *   I3  — Feature ne peut reply que sur son propre Channel
 *   I5  — Entity n'est accessible que par sa Feature propriétaire
 *   I12 — Aucune Feature ne peut emit sur le Channel d'une autre
 *   I21 — Chaque Feature DOIT être enregistrée dans le manifest applicatif
 *         sous une clé namespace unique camelCase plat (amendé ADR-0039)
 *   I22 — Relation namespace ↔ Feature ↔ Entity est 1:1:1 stricte
 *   I48 — Handlers auto-découverts par convention de nommage
 *   I68 — Le namespace est porté par le manifest applicatif, pas par
 *         un `static` sur la classe Feature (ADR-0039)
 *   I72 — `TSelfNS` doit correspondre exactement à la clé sous laquelle
 *         la Feature est enregistrée dans le manifest (ADR-0039)
 *
 * @packageDocumentation
 */

import { Entity, type TJsonSerializable } from "@bonsai/entity";
import { Radio } from "@bonsai/event";
import { assertValidNamespace } from "./types";

// ─── Re-exports — surface publique du package ───────────────────────────────

export {
  RESERVED_NAMESPACES,
  BonsaiNamespaceError,
  isCamelCaseNamespace,
  isReservedNamespace,
  assertValidNamespace
} from "./types";
export type {
  ReservedNamespace,
  CamelCaseNamespace,
  ValidatedManifest,
  StrictManifest,
  TBonsaiNamespaceErrorCode
} from "./types";

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Constructeur concret d'une sous-classe de Feature.
 *
 * Depuis ADR-0039, le constructeur prend obligatoirement `namespace: TSelfNS`
 * en paramètre — ce qui permet à `StrictManifest<M>` de vérifier au
 * compile-time que la classe est compatible avec sa clé d'enregistrement (I72).
 */
export type TFeatureClass<
  TEntity extends Entity<TJsonSerializable> = Entity<TJsonSerializable>,
  TSelfNS extends string = string
> = new (namespace: TSelfNS) => Feature<TEntity, TSelfNS>;

// ─── Feature abstract class ──────────────────────────────────────────────────

/**
 * Feature — unité métier paramétrée par sa classe Entity et son namespace.
 *
 * Paramètres de type :
 *   - `TEntity`  : la classe Entity (ADR-0037 — encode I22 au type-level)
 *   - `TSelfNS`  : le namespace sous lequel cette Feature s'attend à être
 *                  enregistrée dans le manifest applicatif (ADR-0039 — I72).
 *                  Par défaut `string` pour les sous-classes non paramétrées.
 *
 * **Le namespace n'est plus déclaré sur la classe** (`static namespace`
 * supprimé, ADR-0039 — I68). Il est :
 *   - injecté par le constructeur (immuabilité dès construction)
 *   - dérivé de la clé du manifest applicatif (source de vérité — I69)
 *   - validé au compile-time par `StrictManifest<M>` au `satisfies`
 *   - validé au runtime par `assertValidNamespace()` (filet — I71)
 *
 * Le générique `TChannel` prévu par la RFC sera ajouté en strate supérieure
 * quand le typage Channel sera mis en place — il s'insérera entre `TEntity`
 * et `TSelfNS`.
 */
export abstract class Feature<
  TEntity extends Entity<TJsonSerializable> = Entity<TJsonSerializable>,
  TSelfNS extends string = string
> {
  /**
   * Namespaces externes écoutés par cette Feature (auto-discovery I48).
   *
   * Reste un `static` parce qu'il participe à la signature de la classe
   * (lue par `Application.start()` avant toute instanciation) et qu'il est
   * immuable par classe. Le typage strict via `ExternalOf<TSelfNS>` viendra
   * avec le paramètre `TChannel` en strate supérieure.
   */
  static readonly channels: readonly string[] = [];

  readonly #namespace: TSelfNS;
  #entity!: TEntity;
  #bootstrapped = false;

  // ─── Constructor ───────────────────────────────────────────────────────

  /**
   * Crée une Feature attachée au namespace passé en paramètre.
   *
   * Appelé exclusivement par `Application.start()` qui transmet la clé du
   * manifest. L'instanciation manuelle (tests) doit aussi passer le namespace.
   *
   * @throws `BonsaiNamespaceError` si le namespace est invalide ou réservé.
   */
  constructor(namespace: TSelfNS) {
    assertValidNamespace(namespace);
    this.#namespace = namespace;
  }

  // ─── Abstract ──────────────────────────────────────────────────────────

  /**
   * Liaison Feature → Entity concrète (D17 amendé par ADR-0037).
   *
   * Chaque Feature concrète DOIT fournir ce getter retournant le constructeur
   * de son Entity. Le retour est typé par TEntity (la classe concrète), ce qui
   * permet à `this.entity` d'être typé sans cast.
   */
  protected abstract get Entity(): new () => TEntity;

  // ─── Public API ────────────────────────────────────────────────────────

  /**
   * Le namespace de cette instance — immuable, défini au constructeur.
   * Typé `TSelfNS` (string littéral si la Feature est paramétrée).
   */
  get namespace(): TSelfNS {
    return this.#namespace;
  }

  /**
   * Accès à l'Entity (I5 — propriétaire exclusif).
   * Typée par la classe concrète (TEntity) grâce à ADR-0037.
   */
  get entity(): TEntity {
    return this.#entity;
  }

  /**
   * Bootstrap : crée l'Entity, enregistre les handlers sur le Channel,
   * et appelle onInit(). Appelé par Application ou manuellement en test.
   */
  bootstrap(): void {
    if (this.#bootstrapped) return;
    this.#bootstrapped = true;

    // I22 — Création de l'Entity 1:1 via le getter Entity (D17 amendé par ADR-0037)
    const EntityCtor = this.Entity;
    this.#entity = new EntityCtor();

    // Auto-discovery des handlers (I48)
    this.#registerCommandHandlers();
    this.#registerRequestRepliers();
    this.#registerEventListeners();

    // Lifecycle
    this.onInit();
  }

  // ─── Capacités (C1–C5) ─────────────────────────────────────────────────

  /**
   * C1 — Émet un Event sur le propre Channel de cette Feature (I1, I12).
   */
  protected emit(eventName: string, payload: unknown): void {
    const channel = Radio.me().channel(this.#namespace);
    channel.emit(eventName, payload);
  }

  /**
   * C5 — Effectue une Request vers un Channel déclaré (I17).
   * Retourne T | null (ADR-0023).
   */
  protected request(
    targetNamespace: string,
    requestName: string,
    params: unknown
  ): unknown | null {
    const channel = Radio.me().channel(targetNamespace);
    return channel.request(requestName, params);
  }

  // ─── Lifecycle hooks ───────────────────────────────────────────────────

  /**
   * Hook appelé après le bootstrap. Override dans les sous-classes.
   */
  onInit(): void {
    // Default no-op — subclasses override
  }

  // ─── Private : Auto-discovery (I48) ────────────────────────────────────

  /**
   * Découvre les méthodes `on{Name}Command` et les enregistre comme handlers
   * sur le Channel propre de cette Feature (C2).
   *
   * Convention : `onAddItemCommand` → commande "addItem"
   */
  #registerCommandHandlers(): void {
    const channel = Radio.me().channel(this.#namespace);
    const proto = Object.getPrototypeOf(this);
    const methods = Object.getOwnPropertyNames(proto);

    for (const method of methods) {
      const match = method.match(/^on([A-Z][a-zA-Z]*)Command$/);
      if (match) {
        const commandName = match[1][0].toLowerCase() + match[1].slice(1);
        channel.handle(commandName, (payload: unknown) => {
          (this as any)[method](payload);
        });
      }
    }
  }

  /**
   * Découvre les méthodes `on{Name}Request` et les enregistre comme repliers
   * sur le Channel propre de cette Feature (C4, I3).
   *
   * Convention : `onGetTotalRequest` → request "getTotal"
   */
  #registerRequestRepliers(): void {
    const channel = Radio.me().channel(this.#namespace);
    const proto = Object.getPrototypeOf(this);
    const methods = Object.getOwnPropertyNames(proto);

    for (const method of methods) {
      const match = method.match(/^on([A-Z][a-zA-Z]*)Request$/);
      if (match) {
        const requestName = match[1][0].toLowerCase() + match[1].slice(1);
        channel.reply(requestName, (params: unknown) => {
          return (this as any)[method](params);
        });
      }
    }
  }

  /**
   * Découvre les méthodes `on{Channel}{EventName}Event` et les enregistre
   * comme listeners sur les Channels déclarés (C3, I2).
   *
   * Convention : `onCartItemAddedEvent` avec `static channels = ["cart"]`
   * → écoute "itemAdded" sur le Channel "cart"
   *
   * Le pattern est : on + ChannelName(PascalCase) + EventName(PascalCase) + Event
   */
  #registerEventListeners(): void {
    const declaredChannels = (this.constructor as typeof Feature).channels;
    if (declaredChannels.length === 0) return;

    const proto = Object.getPrototypeOf(this);
    const methods = Object.getOwnPropertyNames(proto);

    for (const channelName of declaredChannels) {
      const channelPascal = channelName[0].toUpperCase() + channelName.slice(1);
      const prefix = `on${channelPascal}`;
      const suffix = "Event";

      for (const method of methods) {
        if (method.startsWith(prefix) && method.endsWith(suffix)) {
          // Extract event name between prefix and suffix
          const eventPascal = method.slice(prefix.length, -suffix.length);
          if (eventPascal.length === 0) continue;

          const eventName = eventPascal[0].toLowerCase() + eventPascal.slice(1);
          const channel = Radio.me().channel(channelName);

          channel.listen(eventName, (payload: unknown) => {
            (this as any)[method](payload);
          });
        }
      }
    }
  }
}
