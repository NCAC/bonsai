# Communication et flux de données

> **Flux unidirectionnel, tri-lane (command/event/request), Radio, namespaces**

[← Retour à l'architecture](README.md) · [← Philosophie](../1-philosophie.md)

---

## 1. Primitives de communication

### Format des messages (D5)

Tous les messages suivent le format **`namespace:messageName`** :

- **Séparateur** : `:` (colon)
- **Namespace** : `camelCase` plat — identifie la Feature propriétaire du Channel
- **Message name** : `camelCase` — nom sémantique du message

### Sémantique par type de message (D5, D7)

| Type | Primitive | Émetteur | Sémantique | Cardinalité | Convention | Exemples |
|------|-----------|----------|-----------|------------|------------|----------|
| **Command** | `trigger()` | View, Behavior | **Intention d'action** — peut être refusée | 1:1 (un handler) | `namespace:verbeObjet` | `cart:addItem`, `user:updateProfile` |
| **Event** | `emit()` | Feature (propriétaire) | **Fait accompli** — changement de state survenu | 1:N (broadcast) | `namespace:objetVerbe` (passé) | `cart:itemAdded`, `inventory:stockUpdated` |
| **Request** | `request()` | Feature, View, Behavior | **Interrogation** — lecture seule, retourne `T` synchrone (D9 révisé par [ADR-0023](../../adr/ADR-0023-request-reply-sync-vs-async.md)) | 1:1 (un replier) | `namespace:nominalMétier` | `cart:total`, `pricing:totalAmount` |

> **Convention mnémotechnique** :
> - Command = "Fais ça" → impératif (`addItem`)
> - Event = "Ça s'est passé" → passé (`itemAdded`)
> - Request = "Donne-moi ça" → nominal (`total`)

---

## 2. Matrice des droits de communication

Tous les droits de communication sont **DÉCLARATIFS** (D1).
Un composant ne peut interagir qu'avec les Channels qu'il a
explicitement déclarés dans sa définition.
Radio résout ces déclarations en interne.

### Feature (capacités C1–C5)

| Capacité              | Son propre Channel      | Channels déclarés en `listen` | Channels déclarés en `request` |
|-----------------------|-------------------------|-------------------------------|--------------------------------|
| **C1 — Emit**         | ✅ Implicite             | ❌ **Interdit — sans exception** | ❌                              |
| **C2 — Handle**       | ✅ Implicite             | ❌                             | ❌                              |
| **C3 — Listen**       | ❌ *                     | ✅ Si déclaré                  | ❌                              |
| **C4 — Reply**        | ✅ Implicite             | ❌                             | ❌                              |
| **C5 — Request**      | ❌ *                     | ❌                             | ✅ Si déclaré (D3)              |

> \* Une Feature n'a pas de raison de `listen` ou `request` son propre Channel :
> elle connaît déjà son propre state via son Entity.
>
> Le Channel propre est toujours disponible pour `emit`, `handle` et `reply`.
> Les dépendances externes déclarables sont `listen` et `request`.
> **Emit cross-domain : interdit, sans exception, pour toute Feature** (D2, D7).
> **Request cross-domain : autorisé, lecture seule, déclaration obligatoire** (D3).

### View / Behavior

| Action                | Channels déclarés en `trigger` | Channels déclarés en `listen` | Channels déclarés en `request` |
|-----------------------|--------------------------------|-------------------------------|--------------------------------|
| **Trigger** (Command) | ✅ Si déclaré                   | ❌                             | ❌                              |
| **Listen** (Event)    | ❌                              | ✅ Si déclaré                  | ❌                              |
| **Request** (Query)   | ❌                              | ❌                             | ✅ Si déclaré                   |
| **Emit** (Event)      | ❌ **Interdit — réservé aux Features (D7)** | ❌               | ❌                              |

> Les Views/Behaviors n'ont pas de Channel propre. Toute interaction
> nécessite une déclaration explicite.
> Les Views/Behaviors ne peuvent **jamais** utiliser `emit()` —
> seule la Feature propriétaire du Channel peut émettre des Events (D7).

### Accès aux Entities

| Composant  | Accès Entity |
|------------|-------------|
| Feature    | ✅ Sa propre Entity uniquement |
| View       | ❌ Jamais |
| Behavior   | ❌ Jamais |

### Règle de non-accès dynamique (D1)

> Aucun composant n'a le droit d'accéder à un Channel qu'il n'a pas
> déclaré dans sa définition. Toute tentative d'accès non déclaré
> est une erreur de compilation (TypeScript) ou de runtime (garde-fou framework).

---

## 3. Flux unidirectionnel

Le flux canonique d'une interaction utilisateur suit un chemin **strictement unidirectionnel** :

```
┌─────────┐   trigger(Command)   ┌──────────┐   mutate()   ┌────────┐
│  View   │ ──────────────────►  │ Feature  │ ───────────► │ Entity │
│(trigger)│                      │ (handle) │              │(state) │
└─────────┘                      └──────────┘              └────────┘
    ▲                                │
    │          listen(Event)         │      emit(Event)
    └────────────────────────────────┘
```

1. La **View** capture une interaction utilisateur et émet un **Command** via `trigger()`
2. La **Feature** propriétaire du Channel reçoit le Command (handler `onXxxCommand`)
3. La Feature **mute** son Entity via `this.entity.mutate(intent, ...)`
4. L'Entity notifie la Feature des changements (patches, changedKeys)
5. La Feature **émet** un ou plusieurs **Events** via `emit()`
6. Les **Views** abonnées (`listen`) reçoivent l'Event et se mettent à jour

> **Invariants garantis** :
> - Le Command a un **seul** handler (I10)
> - L'Event peut avoir **N** subscribers (I11)
> - Seule la Feature propriétaire peut `emit()` sur son Channel (I1, I12)
> - La View ne peut jamais `emit()` (I4)
> - Le flux ne remonte jamais : pas de Event → Command automatique

---

## 4. Flux cross-features

> **Décision D2** : le modèle de communication cross-features est la **chorégraphie pure**.

Chaque Feature est **autonome** : elle réagit aux événements qu'elle écoute et ne modifie que son propre state. Le comportement global de l'application **émerge** de la composition de ces réactions individuelles.

### Flux cross-features canonique

```
1. View  →  trigger(cart:addItem)      → Channel Cart    [Command 1:1]
2. CartFeature  ←  handle(cart:addItem)                   [traite, modifie Entity]
3. CartFeature  →  emit(cart:itemAdded)  → Channel Cart    [Event 1:N]
4. InventoryFeature  ←  listen(cart:itemAdded)             [réagit, modifie Entity]
5. InventoryFeature  →  emit(inventory:stockUpdated)       [Event 1:N]
6. View  ←  listen(cart:itemAdded, inventory:stockUpdated)  [mise à jour UI]
```

> **Point clé** : la View envoie un **Command** (intention) ; la Feature le traite
> et émet un **Event** (fait). Aucune Feature n'a "commandé" l'autre.
> Chacune a réagi de manière autonome à un Event survenu ailleurs.

---

## 5. Le concept Channel — tri-lane

Un Channel est un **contrat de communication typé** qui définit trois lanes :

| Lane | Type de message | Cardinalité | Sémantique |
|------|----------------|-------------|------------|
| **Command Lane** | Commands | 1:1 | Intention → Feature propriétaire (seul handler) |
| **Event Lane** | Events | 1:N | Fait accompli → tous les listeners |
| **Request Lane** | Requests | 1:1 | Interrogation → Feature propriétaire (seul replier) |

Un Channel **n'est pas une classe à instancier**. C'est un contrat déclaré via `TChannelDefinition` dans la Feature. Le framework (via Radio) câble automatiquement les lanes.

> **Pour la pratique** (comment déclarer un `TChannelDefinition`, types `TCommandMap`, `TEventMap`, `TRequestMap`) → voir [feature.md](../3-couche-abstraite/feature.md) (capacité C2).

---

## 6. Infrastructure — Radio et namespaces

### Radio : la plomberie interne

Radio est le **singleton interne** qui câble les Channels. Il n'est **jamais exposé** au développeur (I15).

| Aspect | Détail |
|--------|--------|
| **Rôle** | Résoudre les déclarations statiques des composants en connexions runtime |
| **Visibilité** | Interne au framework — `Radio` n'est pas exporté |
| **Invariant** | I15 — aucun composant n'y accède directement |
| **Anti-pattern** | `Radio.channel('name')` → interdit, voir [anti-patterns](../reference/anti-patterns.md) |

### Namespaces : le système d'adressage

Chaque Feature déclare un **namespace unique** (I21), `camelCase` plat, qui sert de :
- Clé d'adressage du Channel (`namespace:messageName`)
- Identifiant du store logique distribué (`namespace` → Entity)
- Préfixe dans les DevTools et le Event Ledger

| Règle | Invariant |
|-------|-----------|
| Unicité stricte | I21, I24 — collision = erreur bootstrap |
| Relation 1:1:1 | I22 — un namespace = une Feature = une Entity |
| Réservés | `router` (I28), `local` (I57) |
| Format | `camelCase` plat — pas de `.`, `/`, `-` |

---

## 7. Événement réservé `any` — contrat de réactivité UI

> **`any` n'est pas un détail d'implémentation. C'est une API de réactivité publique.**
> Il constitue le pont officiel entre l'event lane (communication métier inter-Feature)
> et la Projection DOM Réactive (réactivité UI).

Après **chaque** Event granulaire émis sur l'event lane, le Channel émet automatiquement un événement technique **`any`**.

| Aspect | Description |
|--------|-------------|
| **Déclenchement** | Automatique, après chaque `emit()` d'un Event granulaire |
| **Payload** | `{ event: string, changes: Record<string, unknown> }` — nom de l'Event source + clés du state modifiées |
| **Audience** | Les **Views** et **Behaviors** s'y abonnent pour la réactivité UI (PDR) |
| **Non destiné à** | La communication inter-Feature — les Features écoutent les Events granulaires |
| **Filtrage** | Les selectors des templates filtrent les clés de changement — seuls les templates dont les clés `select()` matchent les `changes` sont ré-évalués |
| **Émission** | Uniquement par le framework — jamais par le développeur |

```typescript
type TAnyEventPayload = {
  /** Nom de l'Event granulaire qui a déclenché `any` */
  readonly event: string;
  /** Clés du state modifiées par la mutation Entity sous-jacente */
  readonly changes: Record<string, unknown>;
};
```

> **Relation `any` ↔ mutations Entity** : les `changes` transmis dans `any` correspondent
> aux `changedKeys` produits par `entity.mutate()`.
> Le framework assure la cohérence mutation → Event granulaire → `any` — le développeur ne gère pas cette liaison.

---

## 8. Radio -- infrastructure interne

### 8.1 Resolution des declarations

Au bootstrap (`start()`), Radio execute la resolution.
Les instances Channel existent deja -- creees lors des `register()` (D15).

1. **Collecte** toutes les déclarations :
   - `Feature.namespace`, `Feature.listen`, `Feature.request`
   - `View.params` : `listen`, `trigger`, `request` (ADR-0024 value-first)
   - `Behavior.params` : `listen`, `trigger`, `request`
   - `Foundation.params` : `listen`, `trigger`, `request`
   - `Composer.params` : `listen`, `request` (ADR-0024 value-first)

2. **Resout les tokens** : chaque `Namespace.channel` reference en
   `listen`/`trigger`/`request` est associe a l'instance Channel
   correspondante dans Radio (via le namespace string)

3. **Verifie la coherence** :
   - Chaque Channel reference correspond a un namespace enregistre
   - Pas de Channel orphelin (declare mais pas enregistre)

4. **Cable les handlers** :
   - Les methodes `onXxx{Command|Event|Request}` sont rattachees
     aux registres des instances Channel correspondantes

### 8.2 Cablage au bootstrap

**Pour chaque Feature enregistree :**

1. Recuperer l'instance Channel deja creee au `register()` (D15)
2. Introspecter les methodes `onXXX`
3. Pour chaque `onXxxCommand` -> enregistrer dans le registre `commandHandlers`
4. Pour chaque `onXxxRequest` -> enregistrer dans le registre `requestRepliers`
5. Pour chaque `onXxxEvent` -> identifier le Channel source (via le prefixe)
   et enregistrer dans le registre `eventListeners` du Channel source

**Pour chaque View et Behavior (au moment de l'instanciation, etape 6+) :**

1. Resoudre les tokens declares en `params.trigger`, `params.listen`, `params.request`
   vers les instances Channel correspondantes
2. Cabler les handlers `onXXX` dans les registres
3. Fournir les methodes `trigger()` et `request()` liees aux Channels declares

**Pour chaque Composer (au moment de l'instanciation) :**

1. Resoudre les tokens declares en `params.listen`, `params.request`
   vers les instances Channel correspondantes
2. Le framework **ne fait pas** d'introspection `onXXX` sur le Composer (ADR-0027) —
   `resolve(event)` est l'unique handler. Le framework appelle `resolve(event)`
   avec l'Event declencheur quand un Event ecoute arrive
3. Fournir la methode `request()` liee aux Channels declares

### 8.3 Validation des invariants

| Type | Invariants verifies | Mecanisme |
|------|--------------------|-----------| 
| **Compile-time** | I4 (View ne peut pas `emit`), I14/I16 (Channel non declare), D9/D10 (types) | TypeScript strict |
| **Bootstrap** | I21 (namespace unique), I10 (un seul handler par Command), I15 (Radio non expose) | `hardInvariant()` |
| **Runtime** | I9 (`hop > maxHops`), I1/I12 (`emit` cross-domain), I25 (Feature interdit `trigger`) | `invariant()` / `hardInvariant()` |

---

## 9. Sémantiques runtime — contrat normatif

> **Absorbé depuis** : [ADR-0003](../../adr/ADR-0003-channel-runtime-semantics.md) (Accepted).

### 9.1 Comportements selon le mode

| Situation | Mode développement (`debug: true`) | Mode production |
|-----------|-----------------------------------|----------------|
| `trigger()` sans handler Command | 🔴 `throw` — erreur explicite (I10) | ⚠️ `warn` — ne bloque pas |
| `emit()` sans listener Event | ✅ Silent — valide sémantiquement | ✅ Silent |
| `request()` sans replier | ⚠️ `warn` + retourne `null` (D44 révisé) | ✅ Retourne `null` silencieusement |
| Handler qui throw | Erreur capturée + log structuré (ADR-0002) | Identique |

### 9.2 Ordre d'exécution et isolation

| Aspect | Comportement |
|--------|-------------|
| **Ordre des listeners Event** | Séquentiel, dans l'ordre de déclaration |
| **Isolation des erreurs** | Une exception dans un listener n'empêche pas les autres d'être appelés (ADR-0002) |
| **Request sync** | `request()` retourne `T \| null` synchrone (D9 révisé par [ADR-0023](../../adr/ADR-0023-request-reply-sync-vs-async.md)). Pas de timeout — le replier lit l'état en mémoire |
| **Stabilité d'ordre** | L'ordre des listeners est **stable** pour la durée de la session |

> Les Features **NE DOIVENT PAS** dépendre de l'ordre d'exécution relatif de leurs listeners
> pour la correction de leur logique (chorégraphie pure, D2).

### 9.3 Chaînes de réactions et anti-boucle

Quand un Event déclenche des réactions en cascade, le framework garantit :

1. **Traçabilité complète** via `correlationId` et `causationId` (I7, I8)
2. **Anti-boucle** via le compteur `hop` (I9) — rejet si `hop > MAX_HOPS`
3. **Isolation des erreurs** à chaque maillon de la chaîne (ADR-0002)

> Si une réaction intermédiaire échoue, les réactions suivantes ne sont pas
> automatiquement annulées — Bonsai n'implémente pas de transactions distribuées en v1.

### 9.4 Nettoyage automatique des subscriptions

Le framework nettoie automatiquement toutes les subscriptions Channel :
- **View / Behavior** : au `onDetach()` — via AbortController interne
- **Composer** : à l'état `destroyed`
- **Feature** : au shutdown `app.stop()`

> Aucun composant n'a besoin de gérer manuellement ses subscriptions.
> Pas de `unsubscribe()` exposé — le framework garantit l'absence de memory leaks.

### 9.5 Configuration runtime Channel

```typescript
const app = createApplication({
  channels: {
    noHandler: 'mode-dependent' // 'throw' | 'warn' | 'silent' | 'mode-dependent'
  }
});
```

| Config | Défaut | Override |
|--------|--------|----------|
| `noHandler` | `'mode-dependent'` | Global uniquement |
| `autoCleanup` | Toujours actif | ❌ Non configurable |
| `listenerExecution` | Séquentiel isolé | ❌ Non configurable |

> **Note** : `requestTimeout` a été supprimé — `request()` est synchrone (D9 révisé par [ADR-0023](../../adr/ADR-0023-request-reply-sync-vs-async.md)). Le replier lit l'état de son Entity en mémoire, aucun timeout n'a de sens.

### 9.6 Channel runtime — infrastructure interne (D15)

L'instance runtime `Channel` est un objet **interne au framework**, créé automatiquement
lors de `Application.register()` (D15). Le développeur ne la voit jamais.

| Facette | Nature | Visibilité |
|---------|--------|------------|
| `TChannelDefinition` (type) | Contrat de communication tri-lane | Public — exporté |
| `Channel` (classe runtime) | Registres de handlers, dispatch | Interne framework — jamais exposé |

```
  Développeur                            Framework
  ────────────                            ─────────
  Cart.Channel (type)          →   compile-time only
  Cart.channel (token)         →   { namespace: 'cart' }
       │  app.register(CartFeature)
       └───────────────────────────→   Channel<Cart.Channel>
                                       │  commandHandlers: Map
                                       │  eventListeners: Map
                                       │  requestRepliers: Map
                                       └─ instance interne, jamais exposée
```

| Étape | Déclencheur | Action |
|-------|-------------|--------|
| **Création** | `app.register(FeatureClass)` | Lit le namespace, crée l'instance Channel, l'enregistre dans Radio |
| **Câblage** | `app.start()` — bootstrap étape 3 | Introspecte `onXXX`, peuple les registres |
| **Actif** | Bootstrap étape 5+ | Dispatch les messages entre composants |
| **Destruction** | `app.stop()` | Vide les registres, déréférence le Channel |

> L'implémentation runtime peut s'appuyer sur **rxjs** (Subjects, Observables) pour le
> dispatch et le multicasting. C'est un détail d'implémentation interne — le développeur
> n'importe jamais rxjs et ne manipule jamais d'Observable.

---

## Lecture suivante

-> [State](state.md) -- encapsulation via Entity, ownership, store distribue
