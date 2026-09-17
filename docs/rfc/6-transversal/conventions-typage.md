# Conventions de typage

> **Prefixes, contraintes, patterns TypeScript fondamentaux du framework Bonsai**

[← Retour a l'index](../README.md)

---

## 1. Objectifs

> Objectifs realignes sur le contenu reel de ce document (audit doc
> 2026-09-17) — le cycle de vie des composants, le protocole Radio et
> `TMessageMetas` sont traites ailleurs (respectivement
> [feature.md §7](../3-couche-abstraite/feature.md#7-cycle-de-vie),
> [communication.md §8](../2-architecture/communication.md), et
> [metas.md](../2-architecture/metas.md), ce dernier documentant une cible
> strate 1 non livree) — ce document ne les redefinit pas.

1. **Definir** la convention de prefixage des types (`T`, quand l'utiliser — §2)
2. **Trancher** `type` vs `interface` dans le code Bonsai (§3)
3. **Enoncer** les contraintes globales de typage (inference, exports — §4)
4. **Documenter** les patterns TypeScript avances utilises pour la validation
   compile-time des handlers (mapped types, template literal types,
   `UnionToIntersection` — §5), avec la distinction entre le raisonnement
   historique (5.2, 5.3) et les types reellement exportes (5.2bis)
5. **Repertorier** les invariants de contrats TypeScript specifiques a l'API
   (I46–I56 — §6), complementaires aux invariants architecturaux d'ensemble
   ([reference/invariants.md](../reference/invariants.md))

### Philosophie : Types d'abord, recompense ensuite

Bonsai epouse pleinement les capacites de TypeScript. Le workflow de
developpement repose sur un investissement initial en typage qui se
rembourse integralement en DX — et ce pour **chaque composant** :

```
+------------------------------------------------------------------+
|  1. DECLARER LES TYPES (le contrat)                              |
|                                                                   |
|     Feature / Entity                                              |
|       -> TChannelDefinition : Commands, Events, Requests types    |
|       -> TEntityStructure   : etat jsonifiable                    |
|                                                                   |
|     View / Behavior (pattern modulaire ADR-0042)                  |
|       -> TFeatureContract : map { ns -> { feature, listens, ... }}|
|       -> TUIContract      : map { uiKey -> ui<TEl>()(events) }    |
|       -> TUIElements<TUI> : map { uiKey -> selecteur CSS }        |
|       -> TViewContract<F,U> : composition { features: F; ui: U }  |
|                                                                   |
|  2. IMPLEMENTER LA CLASSE                                         |
|     Feature -> extends Feature<TEntityClass, TChannelDef, TSelfNS>|
|            -> static channel: TChannelToken<TChannelDef, TSelfNS> |
|            -> handlers onXxxCommand/Request auto-decouverts (I48) |
|     View   -> extends View<TViewContract<F, U>>                   |
|            -> implements TViewCallbacks<TVC>  (I88, ADR-0042)     |
|                                                                   |
|  3. RECOMPENSE AUTOMATIQUE                                        |
|     Feature -> handlers onXXXCommand/Event/Request auto-types     |
|            -> payloads types, retours verifies compile-time        |
|     View   -> handlers on{NS}{Event}Event imposes par TVC.features|
|            -> handlers on{UIKey}{DomEvent} imposes par TVC.ui     |
|            -> getUI(k): TProjectionNode<TEl> (TEl extrait du TUIEntry)|
|     Tous   -> Refactoring : renommer un symbole = erreur partout  |
|            -> Zero runtime surprise : tout verifie au build       |
+------------------------------------------------------------------+
```

> **Principe** : de la rigueur et de la discipline au depart, mais a l'arrivee
> le compilateur travaille pour le developpeur — sur _toute_ la surface de l'API.
> Les CSS selectors, les selecteurs DOM, les valeurs d'attribut sont des
> details d'implementation. Les contrats de type sont la source de verite.

---

## 2. Prefixes de types

> **Regle amendee (audit doc 2026-09-17, decision M7a)** : le critere n'est
> **pas** « type structurel vs type calcule (mapped/conditional) » — le code
> livre contredit cette distinction (`TCommandCallbacks`, `TListenCallbacks`,
> `TChannelCallbacks`, `TFeatureCallbacks` sont tous des mapped/conditional
> types et portent pourtant le prefixe `T`). Le vrai critere est la
> **surface developpeur** : un type que le developpeur ecrit explicitement
> dans son code applicatif (signature de classe, `implements`, annotation)
> porte `T`, meme si son implementation est un mapped/conditional type. Un
> type qui n'est que de la plomberie type-level interne — jamais nomme
> directement par le developpeur, seulement compose par d'autres types —
> n'en porte pas.

| Categorie                                                                         | Prefixe | Regle           | Exemples                                                             |
| --------------------------------------------------------------------------------- | ------- | --------------- | -------------------------------------------------------------------- |
| **Types de la surface developpeur** — ecrits explicitement dans le code applicatif (signatures, `implements`, payloads, state), qu'ils soient structurels ou calcules (mapped/conditional) | `T`     | **DOIT**        | `TChannelDefinition`, `TEntityEvent`, `TFeatureCallbacks`, `TCommandCallbacks`, `TListenCallbacks`, `TViewCallbacks` |
| **Types de plomberie type-level** — jamais ecrits directement par le developpeur, uniquement composes en interne par d'autres types exportes | —       | **NE DOIT PAS** | `StrictManifest`, `ValidatedManifest`, `CamelCase`, `CamelCaseNamespace`, `UnionToIntersection`, `HasNoDuplicates`, `ExtractEl` |
| **Classes**                                                                       | —       | **NE DOIT PAS** | `Feature`, `Entity`, `Application`                                   |

> **Justification** : le prefixe `T` signale au developpeur « ceci est un
> contrat que vous manipulez directement ». Un type de plomberie interne n'a
> pas besoin de ce signal : le developpeur ne l'ecrit jamais lui-meme, il en
> beneficie seulement a travers un type de surface qui le compose (ex.
> `StrictManifest<M>` n'est jamais tape a la main dans une signature de
> Feature — seul `satisfies StrictManifest<AppManifest>` l'invoque une fois,
> au point du manifest).
>
> Il n'existe plus de categorie « types namespace-scoped » (`Cart.Channel`,
> `Cart.State`) — le pattern D14 (wrapper `namespace Cart { … }`) est
> supersede par ADR-0040 (voir I73, I74).

---

## 3. `type` plutot que `interface`

Bonsai utilise systematiquement `type` au lieu de `interface` pour toutes
les definitions de types. Raison : un `type` est **clos** — il ne peut pas
etre etendu par declaration merging, ni reouvert accidentellement depuis
un autre fichier. C'est un contrat grave dans le marbre.

```typescript
// ✅ Bonsai — type clos
type TMessageMetas = {
  readonly messageId: string;
  readonly correlationId: string;
};

// ❌ Pas dans Bonsai — interface ouverte
interface IMessageMetas {
  readonly messageId: string;
  readonly correlationId: string;
}
// N'importe quel fichier peut faire :
// interface IMessageMetas { extraField: string; }  <-- extension silencieuse
```

> **Regle** : `interface` n'est jamais utilise dans le code Bonsai — **y compris
> pour le type-manifest applicatif** (`AppManifest`, ADR-0039). ADR-0039
> (Accepted, non modifiable) utilise lui-meme `export type AppManifest = {
> user: unknown; cart: unknown; }` — un `type`, jamais `interface`. Plusieurs
> documents ulterieurs (I69 dans `reference/invariants.md`, `feature.md`,
> `NAMESPACE-MENTAL-MODEL.md`) avaient derivé vers `interface AppManifest`,
> ce qui contredisait a la fois cette regle et ADR-0039 lui-meme — corrige
> (audit doc 2026-09-17, decision M7b) : ces trois documents utilisent
> desormais `type AppManifest`, conformement a l'ADR source.
> Les seules exceptions sont les `implements` sur les classes,
> qui utilisent des `type` (TypeScript le permet nativement).

---

## 4. Contraintes globales

- TypeScript **strict mode** obligatoire
- Pas de `any` — `unknown` si necessaire
- Generiques **contraints** (`extends`) plutot que libres
- **Inference maximale** — le developpeur declare le minimum, le framework infere le reste
- Les types publics sont exportes, les types internes ne le sont pas

---

## 5. Patterns TypeScript fondamentaux

Le systeme de types de Bonsai repose sur des patterns TypeScript avances
utilises pour garantir la coherence a la compilation.

### 5.1 Template literal types — extraction de noms de methodes

Conversion d'un nom de message en nom de methode handler :

```typescript
/**
 * Convertit un nom de message en nom de methode handler.
 * "addItem" + "Command" -> "onAddItemCommand"
 *
 * Utilise les template literal types pour generer les noms
 * de methodes a partir des 3 suffixes (Command, Event, Request).
 */
type ExtractHandlerName<
  TMessageName extends string,
  TSuffix extends "Command" | "Event" | "Request"
> = `on${Capitalize<TMessageName>}${TSuffix}`;

/**
 * Pour les Events cross-Channel, prefixe le namespace source :
 * "inventory" + "stockUpdated" + "Event" -> "onInventoryStockUpdatedEvent"
 */
type ExtractCrossChannelHandlerName<
  TNamespace extends string,
  TEventName extends string
> = `on${Capitalize<TNamespace>}${Capitalize<TEventName>}Event`;

/**
 * Pour les notifications Entity per-key (D16) :
 * "items" + "EntityUpdated" -> "onItemsEntityUpdated"
 * "total" + "EntityUpdated" -> "onTotalEntityUpdated"
 *
 * Inspire du pattern Marionette.js Model `change:key`,
 * adapte a la convention onXXX auto-decouverte (D12).
 */
type ExtractEntityKeyHandlerName<TKey extends string> =
  `on${Capitalize<TKey>}EntityUpdated`;
```

### 5.2 Mapped types — contrainte des handlers depuis les declarations Channel

> ⚠️ **Contenu historique, supersédé par ADR-0046 (audit doc 2026-09-17)** —
> `TRequiredCommandHandlers`, `TRequiredRequestHandlers` et `TEventHandlers`
> ci-dessous ne sont **pas exportés par le code** : ils datent d'avant
> ADR-0040/ADR-0042/ADR-0046 (paramètre `metas` sur les handlers, `static
> readonly listen`/`params.listen` sur les Features/Views, `TChannels[I]["namespace"]`
> qui n'existe pas sur `TChannelDefinition`). Conservés ici uniquement pour
> l'historique du raisonnement type-level (mapped types + template literal
> types). **Les vrais types livrés sont documentés juste après**, en 5.2bis.

```typescript
/**
 * Genere les signatures requises pour les Command handlers
 * a partir d'une TChannelDefinition.
 *
 * Mapped type qui transforme chaque cle de commands en signature
 * de methode onXxxCommand() avec le payload correctement type.
 */
type TRequiredCommandHandlers<TChannel extends TChannelDefinition> = {
  [K in keyof TChannel["commands"] as ExtractHandlerName<
    K & string,
    "Command"
  >]: (payload: TChannel["commands"][K], metas: TMessageMetas) => void;
};

/**
 * Genere les signatures requises pour les Request handlers.
 * Le retour est toujours `R | null` synchrone (D9 revisé par ADR-0023, I29 revisé).
 * `null` si le replier throw ou si le Channel n'est pas enregistré (D44 revisé).
 */
type TRequiredRequestHandlers<TChannel extends TChannelDefinition> = {
  [K in keyof TChannel["requests"] as ExtractHandlerName<
    K & string,
    "Request"
  >]: TChannel["requests"][K] extends { params: infer P; result: infer R }
    ? P extends void
      ? (metas: TMessageMetas) => R | null
      : (params: P, metas: TMessageMetas) => R | null
    : never;
};

/**
 * Genere les signatures optionnelles pour les Event handlers
 * cross-Channel (C3 listen).
 *
 * Opere sur un tuple de Channels declares dans les capacites listen
 * du composant (Features : `static readonly listen` ; couche concrete : `params.listen`, ADR-0024).
 * Pour chaque Channel et chaque Event, genere :
 *   on<Namespace><EventName>Event(payload: T): void
 *
 * Partial<> car les event handlers sont OPTIONNELS — le developpeur
 * implemente uniquement les events qui l'interessent.
 *
 * Nommage : pas de prefixe `Required` car aucun handler n'est obligatoire.
 * Contraste avec `TRequiredCommandHandlers` et `TRequiredRequestHandlers`
 * ou TOUS les handlers DOIVENT etre implementes.
 */
type TEventHandlers<TChannels extends readonly TChannelDefinition[]> = Partial<
  UnionToIntersection<
    {
      [I in keyof TChannels]: TChannels[I] extends TChannelDefinition
        ? {
            [K in keyof TChannels[I]["events"] as ExtractCrossChannelHandlerName<
              TChannels[I]["namespace"] & string,
              K & string
            >]: (
              payload: TChannels[I]["events"][K],
              metas: TMessageMetas
            ) => void;
          }
        : never;
    }[number]
  >
>;
```

> **Nommage** : `TEventHandlers` (sans prefixe `Required`) car les Event handlers
> sont **optionnels** (`Partial<>`). On n'ecoute que ce qui interesse.
> Les types freres `TRequiredCommandHandlers` et `TRequiredRequestHandlers` conservent
> le prefixe `Required` car **tous** les handlers y sont obligatoires.

```typescript
/**
 * Utilitaire — convertit une union en intersection.
 * Necessaire pour fusionner les handlers de plusieurs Channels
 * en un seul type plat.
 */
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never;
```

```typescript
/**
 * Genere les signatures optionnelles pour les Entity key handlers.
 *
 * Pour chaque cle K de TStructure, genere :
 *   on<K>EntityUpdated(prev: TStructure[K], next: TStructure[K], patches: Patch[]): void
 *
 * Ces handlers sont OPTIONNELS (Partial<>) — le developpeur implemente
 * uniquement les cles qui l'interessent.
 *
 * Source of truth : entity.md §6.
 */
type TEntityKeyHandlers<TStructure extends TJsonSerializable> = Partial<{
  [K in keyof TStructure as ExtractEntityKeyHandlerName<K & string>]: (
    prev: TStructure[K],
    next: TStructure[K],
    patches: Patch[]
  ) => void;
}>;
```

> **Philosophie (historique)** : le developpeur declare le `TChannelDefinition`,
> et le type system genere automatiquement les signatures handler
> attendues. `implements TRequiredCommandHandlers<TChannel>` suffit
> pour que l'IDE propose l'autocompletion de toutes les methodes
> manquantes avec les bons types.

### 5.2bis Les types réellement livrés (`@bonsai/feature`, ADR-0046)

Le raisonnement de 5.2 (mapped types générant les signatures de handlers
requises) est le bon — seule la forme a changé. Voici les types **exportés
et testés** (`packages/feature/src/types.ts`) :

```typescript
// Handlers Command REQUIS — un par clé de TDef["commands"], sans metas (strate 0)
type TCommandCallbacks<TDef extends TChannelDefinition> = {
  [K in keyof TDef["commands"] & string as `on${Capitalize<K>}Command`]: (
    payload: TDef["commands"][K]
  ) => void;
};

// Handlers Request REQUIS — un par clé de TDef["requests"]
type TRequestCallbacks<TDef extends TChannelDefinition> = {
  [K in keyof TDef["requests"] & string as `on${Capitalize<K>}Request`]: (
    params: TDef["requests"][K]["params"]
  ) => TDef["requests"][K]["result"];
};

// Handlers Event cross-Channel REQUIS — un par (token, event) de `listens`.
// UnionToIntersection est OBLIGATOIRE (sans lui, TS produit une union que
// `implements` refuse — TS2422). Contrairement à l'historique 5.2, ces
// handlers sont désormais TOUS requis (pas de Partial<>) : `listens` ne
// déclare que les Channels réellement écoutés, donc chaque event qu'ils
// exposent doit avoir un handler.
type TListenCallbacks<
  TListens extends readonly TChannelToken<TChannelDefinition, string>[]
> = UnionToIntersection<
  TListens[number] extends infer Tok
    ? Tok extends TChannelToken<infer DEF, infer NS>
      ? {
          [E in keyof DEF["events"] &
            string as `on${Capitalize<NS & string>}${Capitalize<E>}Event`]: (
            payload: DEF["events"][E]
          ) => void;
        }
      : never
    : never
>;

// Le contrat complet d'une Feature concrète (ADR-0046, I92) :
type TFeatureCallbacks<
  TDef extends TChannelDefinition,
  TListens extends readonly TChannelToken<TChannelDefinition, string>[] = readonly []
> = TCommandCallbacks<TDef> & TRequestCallbacks<TDef> & TListenCallbacks<TListens>;
```

> **Différences avec 5.2** : pas de paramètre `metas` (strate 0, cible strate
> 1b) ; `TListenCallbacks` dérive du tuple `TListens` (les tokens retournés
> par `get listens()`, ADR-0046 — I93), pas d'un `static readonly listen`/
> `params.listen` qui n'existent plus ; pas de type `TEventHandlers` séparé
> avec `Partial<>` — la distinction « tous requis » vs « optionnels » a
> disparu car `listens` ne liste que ce qui est effectivement écouté. Voir
> [feature.md §3bis](../3-couche-abstraite/feature.md#3bis-tfeaturecallbacks-et-tstrictfeatureclass-adr-0046)
> pour l'exemple complet et [reference/invariants.md I92](../reference/invariants.md)
> pour la portée exacte de la garantie (compile-time uniquement).
>
> Côté View, le type frère est `TChannelCallbacks<F extends TFeatureContract>`
> (même fichier) — dérive les handlers `on{NS}{Event}Event` requis depuis
> `features[ns].listens`, en s'appuyant sur `TEventPayloadFor<F, K>` pour
> typer chaque payload.

### 5.3 Infer et conditional types — extraction des types de payload

> ⚠️ **`CommandPayload`/`RequestResult` ci-dessous ne sont pas exportés** —
> contenu historique. Ils extrayaient trivialement `TChannel["commands"][TName]`
> directement depuis le `TChannelDefinition` d'une Feature — un besoin que
> `TCommandCallbacks`/`TRequestCallbacks` (5.2bis) couvrent déjà en inline.
> Le besoin réel qui subsiste côté **consommateur externe** (une View lisant
> `TFeatureContract`, avec une clé namespacée `"ns:nom"`) est couvert par
> `TCommandPayloadFor<F, K>` / `TRequestParamsFor<F, K>` / `TRequestResultFor<F, K>`
> / `TEventPayloadFor<F, K>` (`packages/feature/src/types.ts`) — une famille de
> 4 extracteurs, pas 2, car le problème qu'ils résolvent (extraire depuis un
> contrat multi-Feature namespacé) est différent de l'extraction directe
> depuis un seul `TChannelDefinition` montrée ci-dessous.

```typescript
/**
 * Extrait le type de payload d'un Command a partir du Channel.
 */
type CommandPayload<
  TChannel extends TChannelDefinition,
  TName extends keyof TChannel["commands"]
> = TChannel["commands"][TName];

/**
 * Extrait le type de resultat d'un Request a partir du Channel.
 */
type RequestResult<
  TChannel extends TChannelDefinition,
  TName extends keyof TChannel["requests"]
> = TChannel["requests"][TName] extends { result: infer R } ? R : never;

/**
 * Extrait la structure d'état (TStructure) d'une classe Entity concrete.
 *
 * Introduit par [ADR-0037](../../adr/ADR-0037-feature-generic-entity-class.md) :
 * permet de dériver le state depuis le générique `Feature<TEntityClass, TChannel>`
 * sans redéclarer la forme du state au niveau de la Feature.
 *
 * @example
 *   type TCartState = TEntityState<CartEntity>;  // = Cart.State
 */
type TEntityState<E extends Entity<TJsonSerializable>> =
  E extends Entity<infer S> ? S : never;
```

---

## 6. Invariants de contrats TypeScript (I46–I56)

> Invariants spécifiques à l'API, complémentaires aux invariants architecturaux (I1–I45, I57, I58)
> définis dans [reference/invariants.md](../reference/invariants.md).
>
> Numérotation continue à partir de I46 (RFC-0001 contient I1–I45, I57, I58).
> I39–I41 sont des rappels contextuels déjà définis dans les invariants architecturaux.
> I54–I56 actés suite aux décisions D43, D44, D18 et ADR-0016.

| #       | Invariant                                                                                                                                                                                                                                                                                           | Principe                                                                                                 |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **I46** | `TStructure` d'une Entity est contraint à `TJsonSerializable` — pas de classes, pas de fonctions, pas de cycles (D10)                                                                                                                                                                               | → [Entity §2](../3-couche-abstraite/entity.md)                                                           |
| **I47** | ~~Les déclarations Channel se font via le token `Namespace.channel` (D11, D14)~~ — **supersédé par ADR-0040** : le token est `static readonly channel: TChannelToken<TDef, NS>` porté directement par la classe Feature (I73), plus de wrapper `namespace Cart { … }` (D14 abandonné). | → [Feature §2](../3-couche-abstraite/feature.md), [reference/invariants.md I73](../reference/invariants.md) |
| **I48** | Les handlers sont des méthodes conventionnelles `on<Name><Command\|Event\|Request>` — le framework les découvre et les câble automatiquement (D12)                                                                                                                                                  | → [Feature §4](../3-couche-abstraite/feature.md)                                                         |
| **I49** | ~~Chaque Feature exporte un TS `namespace` regroupant `Channel`, `State` et `channel` token~~ — **supersédé par ADR-0040/D13** : la co-localisation se fait par fichier (`*.feature.ts`), pas par un wrapper `namespace` TS ; `channel` est un `static readonly` sur la classe (I73, I74). | → [Feature §2](../3-couche-abstraite/feature.md)                                                         |
| **I50** | ~~L'instance runtime `Channel` est interne au framework — créée au `register()`~~ — **supersédé** : `Application.register()` n'existe plus (I69) ; le `Channel` est créé par `Radio.channel(namespace)` au bootstrap (Phase 1). Le principe reste vrai (jamais exposé ni manipulable par le développeur) — voir I80 (`reference/invariants.md`) pour la formulation à jour. | → [Communication §5](../2-architecture/communication.md), [reference/invariants.md I80](../reference/invariants.md) |
| **I51** | Les mutations de l'Entity déclenchent des notifications auto-découvertes `on<Key>EntityUpdated` (per-key) et/ou `onAnyEntityUpdated` (catch-all) sur la Feature propriétaire — le framework les câble automatiquement (D16, D12). Mécanisme livré et détaillé par **I96** (`reference/invariants.md`) — dispatch, ordre, isolation des erreurs. | → [Entity §4](../3-couche-abstraite/entity.md), [reference/invariants.md I96](../reference/invariants.md) |
| **I52** | L'Entity peut exposer des **méthodes query** (lecture seule, pures) pour servir les request handlers de la Feature — ces méthodes ne modifient jamais `this.state` (D16)                                                                                                                            | → [Entity §5](../3-couche-abstraite/entity.md)                                                           |
| **I53** | Un handler `on<Key>EntityUpdated` où `<Key>` ne correspond pas à une clé de `TStructure` est une erreur. **La détection compile-time via `TEntityKeyHandlers<TStructure>` n'existe pas** (type jamais exporté) — seule la détection **runtime au bootstrap** est livrée (`hardInvariant`, voir **I96** dans `reference/invariants.md`). | → [Entity §6](../3-couche-abstraite/entity.md), [reference/invariants.md I96](../reference/invariants.md) |
| **I54** | ⏳ **Cible strate 1, non livré.** Le framework **créerait** les metas au point d'entrée (trigger, timer, init) ; le développeur les **recevrait** en paramètre `(payload, metas)` et les **propagerait** explicitement à `emit()`, `request()` et `mutate()`, sans jamais en forger manuellement (D43 amendé par ADR-0016). Aujourd'hui, aucun `TMessageMetas` n'existe et les handlers reçoivent uniquement le payload (1 paramètre). | → [Metas](../2-architecture/metas.md)                                                                    |
| **I55** | `reply()` ne throw jamais — retourne toujours un résultat ou `null` (D44 révisé par ADR-0023)                                                                                                                                                                                                       | → [Feature §3](../3-couche-abstraite/feature.md), [Communication](../2-architecture/communication.md)    |
| **I56** | `onInit()` de chaque Feature est appelé avant la création des Foundations — la couche abstraite est intégralement active avant la couche concrète (D18, principe d'ordre de bootstrap)                                                                                                              | → [Lifecycle](../2-architecture/lifecycle.md)                                                            |

---

## Lecture suivante

→ [Validation statique et dynamique](validation.md) — compile-time et runtime checks
