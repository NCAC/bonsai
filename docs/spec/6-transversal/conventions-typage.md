# Conventions de typage

> **Préfixes, contraintes, patterns TypeScript fondamentaux du framework Bonsai**

[← Retour a l'index](../README.md)

---

## 1. Objectifs

> Le cycle de vie des composants, le protocole Radio et les metas sont traités
> ailleurs ([feature.md §7](../3-couche-abstraite/feature.md#7-cycle-de-vie),
> [communication.md](../2-architecture/communication.md), [metas.md](../2-architecture/metas.md)).

1. **Definir** la convention de prefixage des types (`T`, quand l'utiliser — §2)
2. **Trancher** `type` vs `interface` dans le code Bonsai (§3)
3. **Enoncer** les contraintes globales de typage (inference, exports — §4)
4. **Documenter** les patterns TypeScript avances utilises pour la validation
   compile-time des handlers (mapped types, template literal types,
   `UnionToIntersection` — §5)
5. **Repertorier** les invariants de contrats TypeScript spécifiques a l'API
   (I46–I56 — §6), complementaires aux invariants architecturaux d'ensemble
   ([reference/invariants.md](../reference/invariants.md))

### Philosophie : Types d'abord, récompense ensuite

Bonsai epouse pleinement les capacites de TypeScript. Le workflow de
developpement repose sur un investissement initial en typage qui se
rembourse integralement en DX — et ce pour **chaque composant** :

```text
+------------------------------------------------------------------+
|  1. DECLARER LES TYPES (le contrat)                              |
|                                                                   |
|     Feature / Entity                                              |
|       -> TChannelDefinition : Commands, Events, Requests types    |
|       -> Entity<TStructure> : etat jsonifiable (TJsonSerializable) |
|                                                                   |
|     View / Behavior (pattern modulaire ADR-14)                  |
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
|            -> implements TViewCallbacks<TVC>  (I88, ADR-14)     |
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

## 2. Préfixes de types

> **Critère** : ce n'est **pas** « type structurel vs type calculé
> (mapped/conditional) » — `TCommandCallbacks`, `TListenCallbacks`,
> `TChannelCallbacks`, `TFeatureCallbacks` sont des mapped/conditional types et
> portent le préfixe `T`. Le critère est la
> **surface developpeur** : un type que le developpeur ecrit explicitement
> dans son code applicatif (signature de classe, `implements`, annotation)
> porte `T`, même si son implementation est un mapped/conditional type. Un
> type qui n'est que de la plomberie type-level interne — jamais nomme
> directement par le developpeur, seulement compose par d'autres types —
> n'en porte pas.

| Categorie | Préfixe | Regle | Exemples |
| --- | --- | --- | --- |
| **Types de la surface developpeur** — ecrits explicitement dans le code applicatif (signatures, `implements`, payloads, state), qu'ils soient structurels ou calcules (mapped/conditional) | `T` | **DOIT** | `TChannelDefinition`, `TEntityEvent`, `TFeatureCallbacks`, `TCommandCallbacks`, `TListenCallbacks`, `TViewCallbacks` |
| **Types de plomberie type-level** — jamais ecrits directement par le developpeur, uniquement composes en interne par d'autres types exportes | — | **NE DOIT PAS** | `StrictManifest`, `ValidatedManifest`, `CamelCase`, `CamelCaseNamespace`, `UnionToIntersection`, `HasNoDuplicates`, `ExtractEl` |
| **Classes** | — | **NE DOIT PAS** | `Feature`, `Entity`, `Application` |

> **Justification** : le préfixe `T` signale au developpeur « ceci est un
> contrat que vous manipulez directement ». Un type de plomberie interne n'a
> pas besoin de ce signal : le developpeur ne l'ecrit jamais lui-même, il en
> beneficie seulement a travers un type de surface qui le compose (ex.
> `StrictManifest<M>` n'est jamais tape a la main dans une signature de
> Feature — seul `satisfies StrictManifest<AppManifest>` l'invoque une fois,
> au point du manifest).
>
> Il n'y a pas de types « namespace-scoped » (`Cart.Channel`, `Cart.State`) :
> pas de wrapper `namespace` TypeScript (ADR-14 ; voir I73, I74).

---

## 3. `type` plutot que `interface`

Bonsai utilise systematiquement `type` au lieu de `interface` pour toutes
les definitions de types. Raison : un `type` est **clos** — il ne peut pas
être etendu par déclaration merging, ni reouvert accidentellement depuis
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

> **Règle** : `interface` n'est jamais utilisé dans le code Bonsai, **y compris
> pour le type-manifest applicatif** : `export type AppManifest = { cart: unknown; user: unknown }`
> (ADR-08).
> Les seules exceptions sont les `implements` sur les classes,
> qui utilisent des `type` (TypeScript le permet nativement).

---

## 4. Contraintes globales

- TypeScript **strict mode** visé — ⚠️ **non tenu aujourd'hui** : aucun `tsconfig` du dépôt n'active `strict`, et `Feature<TEntity extends Entity<TJsonSerializable>, …>` ne compile pas sous `strictFunctionTypes` ([ADR-14](../../adr/ADR-14-contrats-types.md)). `strictNullChecks` est respecté
- Pas de `any` — `unknown` si nécessaire
- Generiques **contraints** (`extends`) plutot que libres
- **Inference maximale** — le developpeur déclare le minimum, le framework infere le reste
- Les types publics sont exportes, les types internes ne le sont pas

---

## 5. Patterns TypeScript fondamentaux

Le système de types de Bonsai repose sur des patterns TypeScript avances
utilises pour garantir la coherence a la compilation.

### 5.1 Template literal types — extraction de noms de méthodes

Conversion d'un nom de message en nom de méthode handler :

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
 * Pour les notifications Entity per-key (ADR-09) :
 * "items" + "EntityUpdated" -> "onItemsEntityUpdated"
 * "total" + "EntityUpdated" -> "onTotalEntityUpdated"
 *
 * Inspire du pattern Marionette.js Model `change:key`,
 * adapte a la convention onXXX auto-decouverte (ADR-09).
 */
type ExtractEntityKeyHandlerName<TKey extends string> =
  `on${Capitalize<TKey>}EntityUpdated`;
```

> Ces alias nomment la construction ; le code livré l'écrit en ligne dans ses
> mapped types. Seul `TChannelHandlerName<NS, E>` est exporté par `@bonsai/feature`.

### 5.2 Mapped types — handlers requis dérivés du contrat (ADR-09, ADR-14)

Le développeur déclare le `TChannelDefinition` ; des mapped types en dérivent
les signatures de handlers attendues, que `implements` impose. Types **exportés
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
// `implements` refuse — TS2422). Tous ces handlers sont requis (pas de
// Partial<>) : `listens` ne déclare que les Channels réellement écoutés,
// donc chaque event qu'ils exposent doit avoir un handler.
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

// Le contrat complet d'une Feature concrète (ADR-09, I92) :
type TFeatureCallbacks<
  TDef extends TChannelDefinition,
  TListens extends readonly TChannelToken<TChannelDefinition, string>[] = readonly []
> = TCommandCallbacks<TDef> & TRequestCallbacks<TDef> & TListenCallbacks<TListens>;
```

```typescript
// Fusion d'une union d'objets en intersection (@bonsai/types)
type UnionToIntersection<U> =
  (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;
```

> Pas de paramètre `metas` aujourd'hui (⏳ strate 1b, ADR-04). `TListenCallbacks`
> dérive du tuple renvoyé par `get listens()` (I93). Les handlers de notification
> Entity `on{Key}EntityUpdated` n'ont pas de type d'imposition : une clé inconnue
> est détectée au bootstrap seulement (I53, I96). Voir
> [feature.md §3bis](../3-couche-abstraite/feature.md#3bis-tfeaturecallbacks-et-tstrictfeatureclass-adr-09)
> pour l'exemple complet et [reference/invariants.md I92](../reference/invariants.md)
> pour la portée exacte de la garantie (compile-time uniquement).
>
> Côté View, le type frère est `TChannelCallbacks<F extends TFeatureContract>`
> (même fichier) — dérive les handlers `on{NS}{Event}Event` requis depuis
> `features[ns].listens`, en s'appuyant sur `TEventPayloadFor<F, K>` pour
> typer chaque payload.

### 5.3 Infer et conditional types — extraction des payloads

Un consommateur (View, Composer, Behavior) nomme un message par une clé
namespacée `"ns:nom"`. Quatre extracteurs en déduisent le type depuis son
`TFeatureContract`, en passant par le token de la Feature référencée :

```typescript
// Décompose "ns:nom", lit TDef via F[ns]["feature"]["channel"], renvoie le type
type TCommandPayloadFor<F extends TFeatureContract, K extends string>;  // commands[nom]
type TEventPayloadFor<F extends TFeatureContract, K extends string>;    // events[nom]
type TRequestParamsFor<F extends TFeatureContract, K extends string>;   // requests[nom]["params"]
type TRequestResultFor<F extends TFeatureContract, K extends string>;   // requests[nom]["result"]

// Exemple de mécanique (TCommandPayloadFor)
type TCommandPayloadFor<F extends TFeatureContract, K extends string> =
  K extends `${infer NS}:${infer C}`
    ? NS extends keyof F
      ? F[NS]["feature"]["channel"] extends TChannelToken<infer D, NS>
        ? C extends keyof D["commands"] ? D["commands"][C] : never
        : never
      : never
    : never;
```

Une clé hors contrat donne `never` : l'appel `trigger(K, payload)` est alors
rejeté à la compilation (I77, I87).

```typescript
/** Structure d'état d'une classe Entity concrète (ADR-09). */
type TEntityState<E extends Entity<TJsonSerializable>> =
  E extends Entity<infer S> ? S : never;

type TCartState = TEntityState<CartEntity>;
```

---

## 6. Invariants de contrats TypeScript (I46–I56)

> Invariants spécifiques à l'API, complémentaires aux invariants architecturaux (I1–I45, I57, I58)
> définis dans [reference/invariants.md](../reference/invariants.md).
>
> Les identifiants sont stables ; un invariant dont la règle a évolué est
> réécrit en place.

| # | Invariant | Principe |
| --- | --- | --- |
| **I46** | `TStructure` d'une Entity est contraint à `TJsonSerializable` — pas de classes, pas de fonctions, pas de cycles (ADR-10) | → [Entity §2](../3-couche-abstraite/entity.md) |
| **I47** | Une Feature expose son contrat par un token `static readonly channel: TChannelToken<TDef, NS>` porté par la classe ; les consommateurs y accèdent par `typeof XFeature` (ADR-14 ; détaillé par I73, I80) | → [Feature §2](../3-couche-abstraite/feature.md), [reference/invariants.md I73](../reference/invariants.md) |
| **I48** | Les handlers sont des méthodes conventionnelles `on<Name><Command\|Event\|Request>` — le framework les découvre et les câble automatiquement (ADR-09) | → [Feature §4](../3-couche-abstraite/feature.md) |
| **I49** | `TChannelDefinition`, type d'état et classe Feature sont co-localisés dans le fichier `*.feature.ts` du domaine, sans wrapper `namespace` TypeScript (ADR-14 ; voir I74) | → [Feature §2](../3-couche-abstraite/feature.md) |
| **I50** | L'instance runtime `Channel` est interne au framework : créée par Radio en phase 1 du bootstrap, jamais exposée ni manipulable par le développeur (voir I80) | → [Communication §5](../2-architecture/communication.md), [reference/invariants.md I80](../reference/invariants.md) |
| **I51** | Les mutations de l'Entity déclenchent des notifications auto-découvertes `on<Key>EntityUpdated` (per-key) et/ou `onAnyEntityUpdated` (catch-all) sur la Feature propriétaire — le framework les câble automatiquement (ADR-09). Mécanisme livré et détaillé par **I96** (`reference/invariants.md`) — dispatch, ordre, isolation des erreurs. | → [Entity §4](../3-couche-abstraite/entity.md), [reference/invariants.md I96](../reference/invariants.md) |
| **I52** | L'Entity peut exposer des **méthodes query** (lecture seule, pures) pour servir les request handlers de la Feature — ces méthodes ne modifient jamais `this.state` (ADR-10) | → [Entity §5](../3-couche-abstraite/entity.md) |
| **I53** | Un handler `on<Key>EntityUpdated` où `<Key>` ne correspond pas à une clé de `TStructure` est une erreur. **La détection compile-time via `TEntityKeyHandlers<TStructure>` n'existe pas** (type jamais exporté) — seule la détection **runtime au bootstrap** est livrée (`hardInvariant`, voir **I96** dans `reference/invariants.md`). | → [Entity §6](../3-couche-abstraite/entity.md), [reference/invariants.md I96](../reference/invariants.md) |
| **I54** | ⏳ **Cible strate 1, non livré.** Le framework **créerait** les metas au point d'entrée (trigger, timer, init) ; le développeur les **recevrait** en paramètre `(payload, metas)` et les **propagerait** explicitement à `emit()`, `request()` et `mutate()`, sans jamais en forger manuellement (ADR-04). Aujourd'hui, aucun `TMessageMetas` n'existe et les handlers reçoivent uniquement le payload (1 paramètre). | → [Metas](../2-architecture/metas.md) |
| **I55** | `reply()` ne throw jamais — retourne toujours un résultat ou `null` (ADR-02) | → [Feature §3](../3-couche-abstraite/feature.md), [Communication](../2-architecture/communication.md) |
| **I56** | `onInit()` de chaque Feature est appelé avant la création des Foundations — la couche abstraite est intégralement active avant la couche concrète (ADR-07, principe d'ordre de bootstrap) | → [Lifecycle](../2-architecture/lifecycle.md) |

---

## Lecture suivante

→ [Validation statique et dynamique](validation.md) — compile-time et runtime checks
