/**
 * @bonsai/feature — Feature base class
 *
 * Strate 0 — Les 5 capacités :
 *   C1 — emit(event, payload) sur son propre Channel (typé TChannelDef, ADR-0040)
 *   C2 — handle(command) via auto-discovery des méthodes on{Name}Command
 *   C3 — listen(event) sur Channels externes déclarés via on{Channel}{EventName}Event
 *   C4 — reply(request) via auto-discovery des méthodes on{Name}Request
 *   C5 — request(token, name, params) vers Channels déclarés (typé via token, ADR-0040)
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
 *   I73 — Chaque Feature concrète DOIT exposer `static readonly channel:
 *         TChannelToken<TChannelDef, TSelfNS>` — pont entre la classe et son
 *         Channel typé (ADR-0040)
 *   I74 — `TChannelDef` co-localisé dans le fichier `.feature.ts` du domaine
 *         (pas de `.channel.ts` séparé) (ADR-0040)
 *   I75 — Aucun `any`/`unknown` dans la surface publique de Channel/Feature/
 *         View ; casts internes documentés et délimités (ADR-0040)
 *   I76 — `Channel.{trigger,emit,request,handle,listen,reply}` strictement
 *         typés par `TDef` — clé = `keyof TDef[lane]`, jamais `string` libre
 *         (ADR-0040)
 *   I79 — `Feature.request()` accepte uniquement un `TChannelToken` typé ;
 *         `abstract get listens()`/`abstract get queries()` portent ces tokens
 *         comme déclarations instance (ADR-0040, amendé ADR-0046 — I93)
 *   I93 — `listens` et `queries` sont des `abstract get` instance sur Feature
 *         (ADR-0046 — TS2515 si absent sur une classe concrète)
 *   I94 — Le constructeur de Feature est inerte : assertValidNamespace + #namespace
 *         uniquement. Aucun side-effect Radio/Entity.
 *   I96 — Handlers Entity `on<Key>EntityUpdated`/`onAnyEntityUpdated` auto-
 *         découverts sur la Feature (même mécanisme que I48), dispatchés par
 *         ordre alphabétique des `changedKeys` puis catch-all. Clé inconnue
 *         → erreur bootstrap. Handler qui throw → isolé (BroadcastError,
 *         ADR-0002), notification suivante non interrompue (ADR-0028 strate 1a)
 *
 * @packageDocumentation
 */

import {
  Entity,
  type TEntityEvent,
  type TJsonSerializable
} from "@bonsai/entity";
import {
  Radio,
  type Channel,
  type TChannelDefinition,
  type TChannelToken
} from "@bonsai/event";
import { BroadcastError, hardInvariant } from "@bonsai/error";
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
  TBonsaiNamespaceErrorCode,
  // ── Modules contractuels (ADR-0042) ──────────────────────────────────────
  TFeatureRef,
  TFeatureRefForNS,
  TFeatureContract,
  // Helpers d'aplatissement
  TFlatListens,
  TFlatTriggers,
  TFlatRequests,
  // Extracteurs de payload
  TEventPayloadFor,
  TCommandPayloadFor,
  TRequestParamsFor,
  TRequestResultFor,
  // Channel callbacks (symétrie Contract/Callbacks — I88)
  TChannelHandlerName,
  TChannelCallbacks,
  // Feature callbacks (ADR-0046 — M2 — symétrie I88 portée à Feature)
  TCommandCallbacks,
  TRequestCallbacks,
  TListenCallbacks,
  TFeatureCallbacks,
  // Feature class constraint (ADR-0046 — M3 — I95)
  TStrictFeatureClass
} from "./types";

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Constructeur concret d'une sous-classe de Feature.
 *
 * Depuis ADR-0039, le constructeur prend obligatoirement `namespace: TSelfNS`
 * en paramètre — ce qui permet à `StrictManifest<M>` de vérifier au
 * compile-time que la classe est compatible avec sa clé d'enregistrement (I72).
 *
 * Ce type n'encode que la signature du constructeur. Les membres `static`
 * (`channel`, `listens`, `queries` — ADR-0040) font partie du contrat de classe
 * mais ne peuvent pas être exprimés dans un type constructeur sans intersection
 * explicite. Leur présence est garantie par convention et par le filet runtime
 * de `Application.start()` — cf. limitation `abstract static` ci-dessous.
 */
export type TFeatureClass<
  TEntity extends Entity<TJsonSerializable> = Entity<TJsonSerializable>,
  TChannelDef extends TChannelDefinition = TChannelDefinition,
  TSelfNS extends string = string
> = new (namespace: TSelfNS) => Feature<TEntity, TChannelDef, TSelfNS>;

// ─── Feature abstract class ──────────────────────────────────────────────────

/**
 * Feature — unité métier paramétrée par sa classe Entity, son contrat Channel
 * et son namespace.
 *
 * Paramètres de type :
 *   - `TEntity`     : la classe Entity (ADR-0037 — encode I22 au type-level)
 *   - `TChannelDef` : le contrat du Channel propre — types de commandes, events,
 *                     requests (ADR-0040 — I74, I76). Par défaut `TChannelDefinition`
 *                     (toutes lanes `Record<string, unknown>`) pour une utilisation
 *                     non paramétrée rétrocompatible.
 *   - `TSelfNS`     : le namespace sous lequel cette Feature s'attend à être
 *                     enregistrée dans le manifest applicatif (ADR-0039 — I72).
 *                     Par défaut `string` pour les sous-classes non paramétrées.
 *
 * **Le namespace n'est plus déclaré sur la classe** (`static namespace`
 * supprimé, ADR-0039 — I68). Il est :
 *   - injecté par le constructeur (immuabilité dès construction)
 *   - dérivé de la clé du manifest applicatif (source de vérité — I69)
 *   - validé au compile-time par `StrictManifest<M>` au `satisfies`
 *   - validé au runtime par `assertValidNamespace()` (filet — I71)
 */
export abstract class Feature<
  TEntity extends Entity<TJsonSerializable> = Entity<TJsonSerializable>,
  TChannelDef extends TChannelDefinition = TChannelDefinition,
  TSelfNS extends string = string
> {
  /**
   * Tokens des Channels externes écoutés par cette Feature (C3 — I2, ADR-0040,
   * amendé ADR-0046 — I93).
   *
   * Déclaration **instance** (`abstract get`) depuis ADR-0046 — symétrie avec
   * les `abstract get` de View (ADR-0042). Chaque Feature concrète DOIT
   * implémenter ce getter (TS2515 sinon).
   *
   * Les tokens retournés sont lus par `Application.start()` en Phase 0c,
   * APRÈS instanciation pure (ctor inerte — I94) et AVANT tout side-effect
   * Radio/Entity, pour valider les dépendances croisées (I70 amendé).
   */
  abstract get listens(): readonly TChannelToken<TChannelDefinition, string>[];

  /**
   * Tokens des Channels externes interrogés par cette Feature (C5 — I17,
   * ADR-0040, amendé ADR-0046 — I93).
   *
   * Déclaration **instance** (`abstract get`) depuis ADR-0046 — voir `listens`.
   */
  abstract get queries(): readonly TChannelToken<TChannelDefinition, string>[];

  readonly #namespace: TSelfNS;
  #entity!: TEntity;
  // Canal propre — assigné au bootstrap, cast sûr par I22 (1 namespace = 1 TDef).
  #channel!: Channel<TChannelDef>;
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

    // Cast sûr par I22 : 1 namespace = 1 Feature = 1 TDef (I75).
    this.#channel = Radio.me().channel(
      this.#namespace
    ) as unknown as Channel<TChannelDef>;

    // I22 — Création de l'Entity 1:1 via le getter Entity (D17 amendé par ADR-0037)
    const EntityCtor = this.Entity;
    this.#entity = new EntityCtor();

    // Auto-discovery des handlers (I48)
    this.#registerCommandHandlers();
    this.#registerRequestRepliers();
    this.#registerEventListeners();
    this.#registerEntityHandlers();

    // Lifecycle
    this.onInit();
  }

  // ─── Capacités (C1–C5) ─────────────────────────────────────────────────

  /**
   * C1 — Émet un Event typé sur le propre Channel de cette Feature (I1, I12, ADR-0040).
   */
  protected emit<K extends keyof TChannelDef["events"] & string>(
    eventName: K,
    payload: TChannelDef["events"][K]
  ): void {
    this.#channel.emit(eventName, payload);
  }

  /**
   * C5 — Effectue une Request typée vers un Channel déclaré (I17, ADR-0040).
   * Retourne le résultat typé ou null (ADR-0023).
   */
  protected request<
    TDef extends TChannelDefinition,
    TNS extends string,
    K extends keyof TDef["requests"] & string
  >(
    token: TChannelToken<TDef, TNS>,
    requestName: K,
    params: TDef["requests"][K]["params"]
  ): TDef["requests"][K]["result"] | null {
    return Radio.me().channelFor(token).request(requestName, params);
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
    // Cast vers Channel non paramétré pour l'enregistrement par string (I75).
    const ch = this.#channel as unknown as Channel;
    const proto = Object.getPrototypeOf(this);
    const methods = Object.getOwnPropertyNames(proto) as string[];

    for (const method of methods) {
      const match = method.match(/^on([A-Z][a-zA-Z]*)Command$/);
      if (match) {
        const commandName = match[1][0].toLowerCase() + match[1].slice(1);
        ch.handle(commandName, (payload: unknown) => {
          (this as unknown as Record<string, (p: unknown) => void>)[method](
            payload
          );
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
    // Cast vers Channel non paramétré pour l'enregistrement par string (I75).
    const ch = this.#channel as unknown as Channel;
    const proto = Object.getPrototypeOf(this);
    const methods = Object.getOwnPropertyNames(proto) as string[];

    for (const method of methods) {
      const match = method.match(/^on([A-Z][a-zA-Z]*)Request$/);
      if (match) {
        const requestName = match[1][0].toLowerCase() + match[1].slice(1);
        ch.reply(requestName, (params: unknown) => {
          return (this as unknown as Record<string, (p: unknown) => unknown>)[
            method
          ](params);
        });
      }
    }
  }

  /**
   * Découvre les méthodes `on{Channel}{EventName}Event` et les enregistre
   * comme listeners sur les Channels déclarés via `get listens()` (C3, I2,
   * I48, ADR-0040, amendé ADR-0046 — I93).
   *
   * Convention : `onCartItemAddedEvent` avec `get listens() { return [CartFeature.channel]; }`
   * → écoute "itemAdded" sur le Channel "cart"
   *
   * Le pattern est : on + ChannelName(PascalCase) + EventName(PascalCase) + Event
   */
  #registerEventListeners(): void {
    const listenTokens = this.listens;
    if (listenTokens.length === 0) return;

    const proto = Object.getPrototypeOf(this);
    const methods = Object.getOwnPropertyNames(proto) as string[];

    for (const token of listenTokens) {
      const channelName = token.namespace;
      const channelPascal = channelName[0].toUpperCase() + channelName.slice(1);
      const prefix = `on${channelPascal}`;
      const suffix = "Event";

      // Cast vers Channel non paramétré pour l'enregistrement par string (I75).
      const ch = Radio.me().channel(channelName) as unknown as Channel;

      for (const method of methods) {
        if (method.startsWith(prefix) && method.endsWith(suffix)) {
          const eventPascal = method.slice(prefix.length, -suffix.length);
          if (eventPascal.length === 0) continue;

          const eventName = eventPascal[0].toLowerCase() + eventPascal.slice(1);

          ch.listen(eventName, (payload: unknown) => {
            (this as unknown as Record<string, (p: unknown) => void>)[method](
              payload
            );
          });
        }
      }
    }
  }

  /**
   * Découvre les méthodes `on{Key}EntityUpdated` et s'abonne une fois à
   * `entity.onAnyEntityUpdated()` pour les dispatcher (I96, ADR-0028 strate 1a).
   *
   * Convention : `onItemsEntityUpdated` avec une clé `items` sur le state
   * de l'Entity → appelé à chaque mutation qui change `items`.
   * `onAnyEntityUpdated` (catch-all) est câblé sans vérification de clé.
   *
   * Filet runtime : une méthode `on<Key>EntityUpdated` dont `<Key>` ne
   * correspond à aucune clé du state de l'Entity → erreur bootstrap.
   */
  #registerEntityHandlers(): void {
    const proto = Object.getPrototypeOf(this);
    const methods = Object.getOwnPropertyNames(proto) as string[];
    const stateKeys = new Set(Object.keys(this.#entity.state as object));

    for (const method of methods) {
      const match = method.match(/^on([A-Z][a-zA-Z]*)EntityUpdated$/);
      if (!match || match[1] === "Any") continue;

      const key = match[1][0].toLowerCase() + match[1].slice(1);
      hardInvariant(
        stateKeys.has(key),
        `Feature "${this.#namespace}" declares entity handler "${method}" for unknown key "${key}"`,
        "I96",
        this.#namespace
      );
    }

    this.#entity.onAnyEntityUpdated((event: TEntityEvent) => {
      this.#dispatchEntityEvent(event);
    });
  }

  /**
   * Route un `TEntityEvent` vers les handlers per-key (ordre alphabétique
   * des `changedKeys`) puis le catch-all, s'ils existent. Chaque appel est
   * isolé : un throw devient une `BroadcastError` loggée, la notification
   * continue (ADR-0002, I96).
   */
  #dispatchEntityEvent(event: TEntityEvent): void {
    const self = this as unknown as Record<
      string,
      (...args: unknown[]) => void
    >;

    for (const key of [...event.changedKeys].sort()) {
      const handlerName = `on${key[0].toUpperCase()}${key.slice(1)}EntityUpdated`;
      if (typeof self[handlerName] !== "function") continue;

      const keyPatches = event.patches.filter(
        (p) => String(p.path[0]) === key
      );
      const prev = (event.previousState as Record<string, unknown>)[key];
      const next = (event.nextState as Record<string, unknown>)[key];

      try {
        self[handlerName](prev, next, keyPatches);
      } catch (error) {
        console.error(
          new BroadcastError(
            `Entity handler "${handlerName}" threw for intent "${event.intent}"`,
            "ADR-0002",
            this.#namespace
          ),
          error
        );
      }
    }

    if (typeof self["onAnyEntityUpdated"] === "function") {
      try {
        self["onAnyEntityUpdated"](event);
      } catch (error) {
        console.error(
          new BroadcastError(
            `Entity handler "onAnyEntityUpdated" threw for intent "${event.intent}"`,
            "ADR-0002",
            this.#namespace
          ),
          error
        );
      }
    }
  }
}
