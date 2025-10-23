# Conventions de typage

> **Prefixes, contraintes, patterns TypeScript fondamentaux du framework Bonsai**

[← Retour a l'index](../README.md)

---

## 1. Objectifs

1. **Definir** la signature TypeScript complete de chaque composant
2. **Formaliser** le mecanisme de decouverte automatique des handlers (`onXXX`)
3. **Specifier** le cycle de vie des composants (hooks internes)
4. **Etablir** les contrats de typage des Channels (tri-lane, generiques)
5. **Decrire** le protocole framework interne (Radio, cablage, validation)
6. **Documenter** les patterns TypeScript avances pour la validation compile-time
7. **Definir** le type `TMessageMetas` et sa propagation explicite (ADR-0005, ADR-0016)

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
|     View / Behavior                                               |
|       -> TUIMap : noeuds DOM, type HTML, events autorises         |
|         (les CSS selectors ne viennent qu'en dernier)             |
|                                                                   |
|  2. IMPLEMENTER LA CLASSE                                         |
|     Feature -> extends Feature<TEntityStructure, TChannel>        |
|            -> implements TRequiredCommandHandlers<TChannel>        |
|     View   -> extends View<TViewCapabilities> (ADR-0024)          |
|                                                                   |
|  3. RECOMPENSE AUTOMATIQUE                                        |
|     Feature -> handlers onXXXCommand/Event/Request auto-types     |
|            -> payloads types, retours verifies compile-time        |
|     View   -> handlers onXXXClick/Input auto-generes (D48)        |
|            -> getUI() : TProjectionNode<HTMLButtonElement>         |
|     Tous   -> Refactoring : renommer un symbole = erreur partout  |
|            -> Zero runtime surprise : tout verifie au build       |
+------------------------------------------------------------------+
```

> **Principe** : de la rigueur et de la discipline au depart, mais a l'arrivee
> le compilateur travaille pour le developpeur — sur *toute* la surface de l'API.
> Les CSS selectors, les selecteurs DOM, les valeurs d'attribut sont des
> details d'implementation. Les contrats de type sont la source de verite.

---

## 2. Prefixes de types

| Categorie | Prefixe | Regle | Exemples |
|-----------|---------|-------|----------|
| **Types structurels** — formes de donnees (state, config, payload, definition) | `T` | **DOIT** | `TChannelDefinition`, `TMessageMetas`, `TRouteState`, `TEntityEvent` |
| **Types contractuels** — utilises en `implements`, API surface | `T` | **DOIT** | `TRequiredCommandHandlers`, `TEntityKeyHandlers`, `TProjectionNode` |
| **Types utilitaires** — calcul type-level (mapped, conditional, template literal) | — | **NE DOIT PAS** | `ExtractHandlerName`, `UnionToIntersection`, `CommandPayload` |
| **Types namespace-scoped** — qualifies par le namespace | — | **NE DOIT PAS** | `Cart.Channel`, `Cart.State`, `Inventory.Channel` |
| **Classes** | — | **NE DOIT PAS** | `Feature`, `Entity`, `Application` |

> **Justification** : le prefixe `T` distingue les types des classes dans les signatures.
> Les types utilitaires s'alignent sur les conventions TypeScript natives (`Partial`, `Record`,
> `Extract`) et les types namespace-scoped sont deja qualifies par leur namespace.

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

> **Regle** : `interface` n'est jamais utilise dans le code Bonsai.
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
  TSuffix extends 'Command' | 'Event' | 'Request'
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
type ExtractEntityKeyHandlerName<
  TKey extends string
> = `on${Capitalize<TKey>}EntityUpdated`;
```

### 5.2 Mapped types — contrainte des handlers depuis les declarations Channel

```typescript
/**
 * Genere les signatures requises pour les Command handlers
 * a partir d'une TChannelDefinition.
 *
 * Mapped type qui transforme chaque cle de commands en signature
 * de methode onXxxCommand() avec le payload correctement type.
 */
type TRequiredCommandHandlers<TChannel extends TChannelDefinition> = {
  [K in keyof TChannel['commands'] as ExtractHandlerName<
    K & string, 'Command'
  >]: (payload: TChannel['commands'][K], metas: TMessageMetas) => void;
};

/**
 * Genere les signatures requises pour les Request handlers.
 * Le retour est toujours `R | null` synchrone (D9 revisé par ADR-0023, I29 revisé).
 * `null` si le replier throw ou si le Channel n'est pas enregistré (D44 revisé).
 */
type TRequiredRequestHandlers<TChannel extends TChannelDefinition> = {
  [K in keyof TChannel['requests'] as ExtractHandlerName<
    K & string, 'Request'
  >]: TChannel['requests'][K] extends { params: infer P; result: infer R }
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
type TEventHandlers<
  TChannels extends readonly TChannelDefinition[]
> = Partial<
  UnionToIntersection<{
    [I in keyof TChannels]: TChannels[I] extends TChannelDefinition
      ? {
          [K in keyof TChannels[I]['events'] as ExtractCrossChannelHandlerName<
            TChannels[I]['namespace'] & string,
            K & string
          >]: (payload: TChannels[I]['events'][K], metas: TMessageMetas) => void;
        }
      : never;
  }[number]>
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
type UnionToIntersection<U> =
  (U extends any ? (k: U) => void : never) extends
  (k: infer I) => void ? I : never;
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
  [K in keyof TStructure as ExtractEntityKeyHandlerName<
    K & string
  >]: (prev: TStructure[K], next: TStructure[K], patches: Patch[]) => void;
}>;
```

> **Philosophie** : le developpeur declare le `TChannelDefinition`,
> et le type system genere automatiquement les signatures handler
> attendues. `implements TRequiredCommandHandlers<TChannel>` suffit
> pour que l'IDE propose l'autocompletion de toutes les methodes
> manquantes avec les bons types.

### 5.3 Infer et conditional types — extraction des types de payload

```typescript
/**
 * Extrait le type de payload d'un Command a partir du Channel.
 */
type CommandPayload<
  TChannel extends TChannelDefinition,
  TName extends keyof TChannel['commands']
> = TChannel['commands'][TName];

/**
 * Extrait le type de resultat d'un Request a partir du Channel.
 */
type RequestResult<
  TChannel extends TChannelDefinition,
  TName extends keyof TChannel['requests']
> = TChannel['requests'][TName] extends { result: infer R } ? R : never;
```

---

## 6. Invariants de contrats TypeScript (I46–I56)

> Invariants spécifiques à l'API, complémentaires aux invariants architecturaux (I1–I45, I57, I58)
> définis dans [reference/invariants.md](../reference/invariants.md).
>
> Numérotation continue à partir de I46 (RFC-0001 contient I1–I45, I57, I58).
> I39–I41 sont des rappels contextuels déjà définis dans les invariants architecturaux.
> I54–I56 actés suite aux décisions D43, D44, D18 et ADR-0016.

| #     | Invariant | Principe |
|-------|-----------|----------|
| **I46** | `TStructure` d'une Entity est contraint à `TJsonSerializable` — pas de classes, pas de fonctions, pas de cycles (D10) | → [Entity §2](../3-couche-abstraite/entity.md) |
| **I47** | Les déclarations Channel se font via le token `Namespace.channel` (D11, D14) — pas via la classe Feature ni via une string | → [Feature §2](../3-couche-abstraite/feature.md), [Communication §3](../2-architecture/communication.md) |
| **I48** | Les handlers sont des méthodes conventionnelles `on<Name><Command\|Event\|Request>` — le framework les découvre et les câble automatiquement (D12) | → [Feature §4](../3-couche-abstraite/feature.md) |
| **I49** | Chaque Feature exporte un TS `namespace` regroupant `Channel`, `State` et `channel` token — c'est le contrat public unique (D13, D14) | → [Communication §3](../2-architecture/communication.md) |
| **I50** | L'instance runtime `Channel` est interne au framework — créée au `register()`, jamais exposée ni manipulée par le développeur (D15) | → [Communication §5](../2-architecture/communication.md) |
| **I51** | Les mutations de l'Entity déclenchent des notifications auto-découvertes `on<Key>EntityUpdated` (per-key) et/ou `onAnyEntityUpdated` (catch-all) sur la Feature propriétaire — le framework les câble automatiquement (D16, D12) | → [Entity §4](../3-couche-abstraite/entity.md) |
| **I52** | L'Entity peut exposer des **méthodes query** (lecture seule, pures) pour servir les request handlers de la Feature — ces méthodes ne modifient jamais `this.state` (D16) | → [Entity §5](../3-couche-abstraite/entity.md) |
| **I53** | Un handler `on<Key>EntityUpdated` où `<Key>` ne correspond pas à une clé de `TStructure` est une erreur (compile-time via `TEntityKeyHandlers<TStructure>`, runtime au bootstrap) | → [Entity §6](../3-couche-abstraite/entity.md) |
| **I54** | Le framework **crée** les metas au point d'entrée (trigger, timer, init). Le développeur les **reçoit** en paramètre `(payload, metas)` et les **propage** explicitement à `emit()`, `request()` et `mutate()`. Le développeur ne forge **jamais** de metas manuellement. (D43 amendé par ADR-0016) | → [Metas](../2-architecture/metas.md) |
| **I55** | `reply()` ne throw jamais — retourne toujours un résultat ou `null` (D44 révisé par ADR-0023) | → [Feature §3](../3-couche-abstraite/feature.md), [Communication](../2-architecture/communication.md) |
| **I56** | `onInit()` de chaque Feature est appelé avant la création des Foundations — la couche abstraite est intégralement active avant la couche concrète (D18, principe d'ordre de bootstrap) | → [Lifecycle](../2-architecture/lifecycle.md) |

---

## Lecture suivante

→ [Validation statique et dynamique](validation.md) — compile-time et runtime checks
