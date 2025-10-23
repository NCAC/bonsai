# ADR-0027 : `resolve(event)` — l'événement déclencheur comme argument unique du Composer

> **Le Composer reçoit l'événement déclencheur en argument de `resolve()`.
> Les handlers `onXxxEvent` sont supprimés. Le pseudo-state local décisionnel est éliminé.
> `resolve()` est l'unique méthode abstraite du Composer.**

| Champ | Valeur |
|-------|--------|
| **Statut** | 🟢 Accepted |
| **Date** | 2026-04-07 |
| **Décideurs** | @ncac |
| **RFC liée** | [composer.md](../rfc/4-couche-concrete/composer.md), [communication.md](../rfc/2-architecture/communication.md) §8.2, [lifecycle.md](../rfc/2-architecture/lifecycle.md) §4 |
| **Invariants impactés** | I35 (renforcé — Composer encore plus pur), I37 (inchangé — toujours 0/N Views) |
| **Décisions impactées** | D12 (amendé — convention `onXxx` ne s'applique plus au Composer), D21 (renforcé — décideur pur) |
| **ADRs liées** | [ADR-0020](ADR-0020-composers-n-instances-composition-heterogene.md) (N-instances, TResolveResult), [ADR-0025](ADR-0025-composer-no-lifecycle-hooks.md) (pas de hooks lifecycle — renforcé) |
| **Complète** | ADR-0025 (supprimait les hooks, maintenant on supprime aussi les handlers `onXxxEvent`) |

> ### Statut normatif
> Ce document est **normatif** pour le contrat de réactivité du Composer.
> Il définit comment le Composer reçoit les événements des Channels qu'il écoute.
> En cas de divergence avec `composer.md`, **ce document prévaut**.
> Il complète ADR-0025 : ensemble, ils définissent le Composer comme un composant
> à **une seule méthode abstraite** (`resolve(event)`), zéro handler, zéro hook.

---

## 📋 Table des matières

1. [Contexte](#contexte)
2. [Contraintes](#contraintes)
3. [Options considérées](#options-considérées)
4. [Analyse comparative](#analyse-comparative)
5. [Décision](#décision)
6. [Spécification normative — `TComposerEvent<TListen>`](#spécification-normative--tcomposereventtlisten)
7. [Conséquences](#conséquences)
8. [Actions de suivi](#actions-de-suivi)
9. [Historique](#historique)

---

## Contexte

### Deux inélégances dans le design actuel

Le Composer réagit aux événements des Channels qu'il écoute via `static readonly listen`.
Le design actuel impose un **double mécanisme** pour une seule décision :

**Étape 1** — Un handler `onXxxEvent` reçoit le payload et le stocke :

```typescript
// ❌ DESIGN ACTUEL — handler passeur + pseudo-state
class SidebarComposer extends Composer {
  static readonly listen = [Auth.channel] as const;
  private isAuthenticated = false;  // ← pseudo-state intermédiaire

  onAuthStateChangedEvent(payload: { isAuthenticated: boolean }): void {
    this.isAuthenticated = payload.isAuthenticated;  // ← Step 1: stocker
    // Le framework appelle resolve() automatiquement après un Event
  }

  resolve(): TResolveResult | null {
    return {
      view: this.isAuthenticated ? ProfileView : LoginView,  // ← Step 2: lire
      rootElement: '.Sidebar-content',
    };
  }
}
```

**Étape 2** — Le framework rappelle implicitement `resolve()`, qui lit le pseudo-state.

### Problème 1 — Le pseudo-state local (indirection inutile)

Le handler `onAuthStateChangedEvent` ne fait **rien d'autre** que transférer un payload
dans un champ privé. C'est un **passeur de données** — zéro logique métier, zéro décision.
Sa seule raison d'existence : `resolve()` ne reçoit pas l'événement.

Le corpus ([composer.md §2](../rfc/4-couche-concrete/composer.md)) documente ce pseudo-state
avec des contraintes formelles (dérivé d'Events, utilisé uniquement par resolve, pas de valeur
métier, durée de vie liée au Composer). Quatre contraintes pour encadrer un pattern qui ne devrait
pas exister.

### Problème 2 — Le « magic call » invisible

Le commentaire dans `composer.md` dit :

> *Le framework appelle resolve() automatiquement après un Event*

Mais ce mécanisme n'est **visible nulle part** dans le code du développeur. Le flux réel :

```
Event reçu → onXxxEvent(payload) → [framework: appelle resolve()] → diff → attach/detach
```

L'étape 2→3 est **implicite**. Le développeur ne voit pas pourquoi `resolve()` est rappelé.
C'est la définition de « magie framework » — exactement ce que la philosophie Bonsai
(« Explicite > Implicite ») veut éliminer.

### Problème 3 — Surface API disproportionnée

Un Composer qui écoute 3 Channels avec chacun 4 Events doit déclarer **12 handlers** dont
le seul rôle est de recopier un payload dans un champ privé, plus `resolve()` qui prend
la vraie décision. 13 méthodes pour un composant censé être un « décideur pur ».

### Le paradoxe

Le document dit que le Composer est un « **décideur pur** ». Mais il a :
- Des handlers d'événements qui sont de purs passeurs (`onXxxEvent`)
- Un state local mutable qui n'est même pas du state au sens Bonsai
- Un mécanisme invisible de rappel de `resolve()`

Un vrai décideur pur recevrait l'information et rendrait sa décision **en un seul point**.

### Relation avec ADR-0025

ADR-0025 a supprimé `onMount`/`onUnmount`. Cette ADR va plus loin : elle supprime aussi
les handlers `onXxxEvent`. Le Composer ne conserve qu'une seule méthode abstraite : `resolve(event)`.

```
ADR-0025 : Composer = resolve() + onXxxEvent handlers
ADR-0027 : Composer = resolve(event)   ← une seule méthode
```

---

## Contraintes

| # | Contrainte | Justification |
|---|-----------|---------------|
| **C1** | **Explicite > Implicite** — le lien event → décision doit être visible dans le code | Philosophie Bonsai |
| **C2** | **Compile-time > Runtime** — le type de l'événement doit être vérifié par TypeScript | Philosophie Bonsai |
| **C3** | **D12** — les handlers `onXxx` sont le mécanisme standard pour Feature, View, Behavior | Cohérence API (mais le Composer est fondamentalement différent) |
| **C4** | **ADR-0025** — le Composer n'a déjà plus de hooks lifecycle | Point de départ acquis |
| **C5** | **I35** — le Composer est un décideur pur, pas un gestionnaire de ressources | Nature du composant |
| **C6** | **Montage initial** — `resolve()` doit aussi fonctionner sans événement (premier appel) | Complétude fonctionnelle |
| **C7** | **Type narrowing** — dans un `switch` sur le nom de l'Event, le payload doit être narrowé par TypeScript | DX TypeScript-first |

---

## Options considérées

### Option A — Statu quo (handlers `onXxxEvent` + `resolve()` sans argument)

**Description** : conserver le design actuel. Les Events des Channels écoutés sont routés
vers des handlers `onXxxEvent` conformes à D12. Le Composer stocke l'information décisionnelle
dans des propriétés privées. Le framework rappelle `resolve()` après chaque Event.

```typescript
// Option A — design actuel
class MainContentComposer extends Composer {
  static readonly listen = [Router.channel, Auth.channel] as const;

  private currentRoute: string = 'home';
  private isAuthenticated: boolean = false;

  onRouterRouteChangedEvent(
    payload: { page: string; params: Record<string, string> }
  ): void {
    this.currentRoute = payload.page;
  }

  onAuthStateChangedEvent(
    payload: { isAuthenticated: boolean }
  ): void {
    this.isAuthenticated = payload.isAuthenticated;
  }

  resolve(): TResolveResult | null {
    if (!this.isAuthenticated) {
      return { view: LoginView, rootElement: '.MainContent' };
    }
    switch (this.currentRoute) {
      case 'home':    return { view: HomeView,    rootElement: '.MainContent' };
      case 'product': return { view: ProductView, rootElement: '.MainContent' };
      default:        return { view: NotFoundView, rootElement: '.MainContent' };
    }
  }
}
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Cohérent avec D12 (convention `onXxx` uniforme) | - Handlers passeurs sans logique — boilerplate pur |
| + Le Composer peut « accumuler » de l'info au fil des Events | - Pseudo-state mutable hors de tout contrôle framework |
| + Familier pour les développeurs venant de MarionetteJS | - `resolve()` est rappelé magiquement — couplage invisible |
| | - 3 Channels × 4 Events = 12 handlers + 12 propriétés + `resolve()` |
| | - Contradiction avec « Explicite > Implicite » |

---

### Option B — `resolve(event)` comme unique point d'entrée (recommandée)

**Description** : `resolve()` reçoit l'événement déclencheur en argument. Les handlers
`onXxxEvent` sont supprimés. Le pseudo-state local décisionnel est éliminé.
Le Composer devient un composant à **une seule méthode abstraite**.

Au montage initial (premier appel, réapparition du scope), `event` vaut `null`.

Le type de `event` est une **union discriminée auto-dérivée** des `TChannelDefinition`
déclarés dans `listen`. TypeScript narrow le `payload` dans chaque branche du `switch`.

```typescript
// Option B — resolve(event) unique
class MainContentComposer extends Composer {
  static readonly listen = [Router.channel, Auth.channel] as const;
  static readonly request = [Router.channel, Auth.channel] as const;

  resolve(
    event: TComposerEvent<[Router.Channel, Auth.Channel]> | null
  ): TResolveResult | null {
    // Interroger l'état courant via request() — fonctionne au mount ET après event
    const route = this.request(Router.channel, 'currentRoute');
    const auth = this.request(Auth.channel, 'currentAuth');

    if (!auth?.isAuthenticated) {
      return { view: LoginView, rootElement: '.MainContent' };
    }

    switch (route?.page) {
      case 'home':    return { view: HomeView,    rootElement: '.MainContent' };
      case 'product': return { view: ProductView, rootElement: '.MainContent' };
      default:        return { view: NotFoundView, rootElement: '.MainContent' };
    }
  }
}
```

**Variante avec exploitation directe de l'event** (Composer simple, 1 Channel) :

```typescript
class SidebarComposer extends Composer {
  static readonly listen = [Auth.channel] as const;
  static readonly request = [Auth.channel] as const;

  resolve(
    event: TComposerEvent<[Auth.Channel]> | null
  ): TResolveResult {
    // Au mount : interroger le state. Après event : on peut aussi utiliser le payload.
    const isAuth = event !== null
      ? event.payload.isAuthenticated   // ← narrowing parfait via TComposerEvent
      : this.request(Auth.channel, 'currentAuth')?.isAuthenticated ?? false;

    return {
      view: isAuth ? ProfileView : LoginView,
      rootElement: '.Sidebar-content',
    };
  }
}
```

**Composer statique (pas de Channel)** — signature dégénérée :

```typescript
class FooterComposer extends Composer {
  // Pas de listen → TComposerEvent<[]> = never → event: never | null = null
  resolve(event: null): TResolveResult {
    return { view: FooterView, rootElement: 'footer.Footer' };
  }
}
```

| Avantages | Inconvénients |
|-----------|---------------|
| + **1 méthode** — surface API minimale absolue | - Rompt D12 (convention `onXxx`) pour le Composer |
| + **Zéro pseudo-state** — pas de propriétés privées passeurs | - Le pattern `request()` systématique ajoute N appels par resolve |
| + **Explicite** — l'event est visible, pas caché | - Si un Composer veut accumuler de l'info, il ne peut plus (sauf request) |
| + **Type-safe** — union discriminée, narrowing compile-time | - Paramétrage générique `TListen` sur la classe |
| + **Pas de magic call** — le développeur voit l'event arriver | |
| + **Composer = 1 méthode** — impossible de se tromper | |
| + **Cohérent avec ADR-0025** — ni hooks, ni handlers, juste `resolve()` | |

---

### Option C — Pattern reducer : `resolve(event, previousDecision)`

**Description** : variante de l'Option B où `resolve()` reçoit aussi la décision précédente
(le `TResolveResult` retourné au dernier appel). Permet des optimisations sans state local.

```typescript
// Option C — reducer
class MainContentComposer extends Composer {
  static readonly listen = [Router.channel, Auth.channel] as const;

  resolve(
    event: TComposerEvent<[Router.Channel, Auth.Channel]> | null,
    previous: TResolveResult | TResolveResult[] | null
  ): TResolveResult | null {
    // previous permet d'optimiser : si event ne concerne pas la route, no-op
    if (event?.name === 'auth:stateChanged' && !event.payload.isAuthenticated) {
      return { view: LoginView, rootElement: '.MainContent' };
    }
    // ... décision complète sinon
  }
}
```

| Avantages | Inconvénients |
|-----------|---------------|
| + Mêmes avantages que B | - `previous` est une info framework que le Composer n'a pas besoin de connaître |
| + Optimisation possible (skip le request si seul un event non-pertinent a changé) | - Signature plus complexe |
| | - Le framework fait déjà le diff sur le résultat — optimiser dans resolve est inutile |
| | - Invite le développeur à « patcher » previous au lieu de recalculer — fragile |

---

## Analyse comparative

| Critère | Option A (statu quo) | Option B (resolve(event)) | Option C (reducer) |
|---------|---------------------|--------------------------|-------------------|
| **Minimalisme API** | ⭐ (N handlers + resolve) | ⭐⭐⭐ (1 méthode) | ⭐⭐ (1 méthode, 2 args) |
| **Explicite > Implicite** | ⭐ (magic call) | ⭐⭐⭐ (event visible) | ⭐⭐⭐ (event visible) |
| **Type-safety** | ⭐⭐ (handlers typés) | ⭐⭐⭐ (union discriminée + narrowing) | ⭐⭐⭐ |
| **Prévention anti-patterns** | ⭐ (pseudo-state, timers) | ⭐⭐⭐ (impossible) | ⭐⭐ (tentation de patcher previous) |
| **Complexité générique TS** | ⭐⭐⭐ (pas de TListen) | ⭐⭐ (TListen nécessaire) | ⭐⭐ (TListen + TResult) |
| **Cohérence D12** | ⭐⭐⭐ (onXxx partout) | ⭐⭐ (Composer = exception justifiée) | ⭐⭐ |
| **DX quotidienne** | ⭐ (boilerplate) | ⭐⭐⭐ (switch + request) | ⭐⭐ (signature lourde) |
| **Cohérence ADR-0025** | ⭐ (hooks retirés mais handlers restent) | ⭐⭐⭐ (1 méthode = pur) | ⭐⭐⭐ |

---

## Décision

Nous choisissons **Option B — `resolve(event)` comme unique point d'entrée** parce que :

1. **Le Composer devient le composant le plus simple de l'architecture** — une seule
   méthode abstraite, zéro handler, zéro hook, zéro state local. La formule est limpide :
   `Composer = slot immutable + resolve(event) → ViewDecision`

2. **L'événement est explicite** — le développeur voit arriver l'information, il décide
   dans le même appel. Pas de magic call, pas de pseudo-state intermédiaire.

3. **Le type-safety est maximal** — l'union discriminée `TComposerEvent<TListen>` donne
   un narrowing parfait dans le `switch`. L'IDE propose les cas, le compilateur vérifie
   l'exhaustivité. C'est du TypeScript-first dans sa plus pure expression.

4. **L'élimination du pseudo-state est un gain net** — quatre contraintes formelles (§2 de
   composer.md) encadraient un pattern qui n'aurait jamais dû exister. Le Composer n'a pas
   de state — il a une **question** (event) et une **réponse** (TResolveResult).

5. **Cohérence totale avec ADR-0025** — ADR-0025 retirait les hooks lifecycle, ADR-0027
   retire les handlers événementiels. Il reste une seule méthode : `resolve(event)`.

### Rejets argumentés

**Option A rejetée** : le pseudo-state local et le magic call violent les principes
fondateurs « Explicite > Implicite » et « Compile-time > Runtime ». Le boilerplate
des handlers passeurs est disproportionné pour un composant décideur.

**Option C rejetée** : le `previous` est une information que le framework possède déjà
pour son algorithme de diff. L'exposer au développeur l'invite à « patcher » la décision
précédente au lieu de la recalculer proprement. Le framework diff déjà le résultat —
optimiser dans `resolve()` est une responsabilité mal placée.

### Exception à D12

D12 (convention `onXxx` auto-découverte) continue de s'appliquer à **Feature, View et Behavior**.
Le Composer est la seule exception justifiée :

| Composant | Reçoit les messages via | Justification |
|-----------|------------------------|---------------|
| Feature | `onXxxCommand`, `onXxxEvent`, `onXxxRequest` | La Feature traite N types de messages avec des sémantiques différentes (muter, écouter, répondre) |
| View | `onXxxEvent` (via listen) | La View réagit aux Events pour se re-projeter |
| Behavior | `onXxxEvent` (via listen) | Idem View |
| **Composer** | **`resolve(event)`** | Le Composer ne traite pas les Events — il **décide** en fonction de l'Event. La décision est toujours la même action : retourner un `TResolveResult`. |

La différence fondamentale : pour les Feature/View/Behavior, chaque Event peut déclencher
une **action différente** (muter, projeter, animer). Pour le Composer, chaque Event déclenche
la **même action** : recalculer la décision de composition. Un point d'entrée unique est
donc naturel.

---

## Spécification normative — `TComposerEvent<TListen>`

### 6.1 Type `TComposerEvent`

```typescript
/**
 * Union discriminée des événements qu'un Composer peut recevoir.
 * Dérivée automatiquement des TChannelDefinition déclarés dans `listen`.
 *
 * Le discriminant est `name` au format `namespace:eventName` (D5).
 * TypeScript narrow le `payload` dans chaque branche du switch.
 *
 * @template TListened — tuple des TChannelDefinition écoutés (readonly)
 */
type TComposerEvent<TListened extends readonly TChannelDefinition[]> =
  TListened[number] extends infer TChannel
    ? TChannel extends TChannelDefinition
      ? {
          [K in keyof TChannel['events'] & string]: {
            /** Nom qualifié de l'Event : `namespace:eventName` (D5) */
            readonly name: `${TChannel['namespace']}:${K}`;
            /** Payload typé de l'Event — identique à TChannel['events'][K] */
            readonly payload: TChannel['events'][K];
            /** Métadonnées causales (I7, ADR-0016) */
            readonly metas: TMessageMetas;
          }
        }[keyof TChannel['events'] & string]
      : never
    : never;
```

### 6.2 Résolution concrète — exemples

**Exemple 1** — `listen = [Auth.channel]` avec `Auth.Channel` :

```typescript
// Auth.Channel.events = { stateChanged: { isAuthenticated: boolean }; loggedOut: void }
// →
type Resolved =
  | { name: 'auth:stateChanged'; payload: { isAuthenticated: boolean }; metas: TMessageMetas }
  | { name: 'auth:loggedOut';    payload: void;                        metas: TMessageMetas };
```

**Exemple 2** — `listen = [Router.channel, Auth.channel]` :

```typescript
type Resolved =
  | { name: 'router:routeChanged'; payload: { page: string; params: Record<string, string> }; metas: TMessageMetas }
  | { name: 'auth:stateChanged';   payload: { isAuthenticated: boolean };                      metas: TMessageMetas }
  | { name: 'auth:loggedOut';      payload: void;                                              metas: TMessageMetas };
```

**Exemple 3** — `listen = []` (Composer statique) :

```typescript
type Resolved = never;
// → event: never | null  ≡  event: null
```

### 6.3 Narrowing dans le `switch`

Le discriminant `name` est un **template literal type** (`${namespace}:${eventName}`).
TypeScript narrow `payload` dans chaque branche :

```typescript
resolve(event: TComposerEvent<[Router.Channel, Auth.Channel]> | null): TResolveResult | null {
  if (event === null) {
    // Montage initial — pas d'Event
    return this.resolveFromCurrentState();
  }

  switch (event.name) {
    case 'router:routeChanged':
      // TypeScript sait : event.payload est { page: string; params: Record<string, string> }
      return this.resolveForRoute(event.payload.page);

    case 'auth:stateChanged':
      // TypeScript sait : event.payload est { isAuthenticated: boolean }
      if (!event.payload.isAuthenticated) {
        return { view: LoginView, rootElement: '.MainContent' };
      }
      return this.resolveFromCurrentState();

    case 'auth:loggedOut':
      // TypeScript sait : event.payload est void
      return { view: LoginView, rootElement: '.MainContent' };
  }
}
```

> **Exhaustiveness check** : si le développeur active `noImplicitReturns` et que le
> `switch` ne couvre pas tous les cas, TypeScript émet une erreur. Alternativement,
> un `default` case ou un `satisfies never` guard garantit l'exhaustivité.

### 6.4 Classe abstraite Composer révisée

```typescript
/**
 * Composer — décideur de composition attaché à un scope DOM.
 *
 * Unique responsabilité : recevoir un événement (ou null au montage)
 * et retourner la décision de composition (0/N Views).
 *
 * Le Composer est le composant le plus simple de l'architecture :
 * - 1 seule méthode abstraite : resolve(event)
 * - 0 handler onXxx
 * - 0 hook lifecycle
 * - 0 state local
 *
 * @template TListen — tuple des TChannelDefinition écoutés
 */
abstract class Composer<
  TListen extends readonly TChannelDefinition[] = readonly []
> {
  /** Scope DOM — fourni par le framework, immutable (I58, ADR-0020) */
  protected readonly slot: HTMLElement;

  /** Channels écoutés — Events routés vers resolve() */
  static readonly listen: readonly TChannelDefinition[];

  /** Channels interrogeables — Requests via this.request() */
  static readonly request: readonly TChannelDefinition[];

  /**
   * Unique point d'entrée du Composer.
   *
   * Appelé par le framework :
   * - Au premier montage (event = null)
   * - Quand un Event écouté est reçu (event = TComposerEvent)
   * - À la réapparition du scope (event = null)
   *
   * @param event — L'événement déclencheur :
   *   - TComposerEvent<TListen> : un Event d'un Channel écouté (union discriminée)
   *   - null : montage initial ou réapparition du scope
   *
   * @returns
   *   - TResolveResult      : instancier 1 View
   *   - TResolveResult[]    : instancier N Views hétérogènes (ADR-0020)
   *   - null                : détacher les Views courantes (scope vide)
   */
  abstract resolve(
    event: TComposerEvent<TListen> | null
  ): TResolveResult | TResolveResult[] | null;

  /**
   * Interroge un Channel externe déclaré en `static readonly request`.
   * Disponible dans resolve() pour obtenir l'état courant d'une Feature.
   */
  protected request<
    TTarget extends TChannelDefinition,
    K extends keyof TTarget['requests'] & string
  >(
    channel: { namespace: TTarget['namespace'] },
    requestName: K,
    params?: TTarget['requests'][K] extends { params: infer P } ? P : never
  ): (TTarget['requests'][K] extends { result: infer R } ? R : never) | null;

  /** La View actuellement montée (null si scope vide) — lecture seule */
  protected readonly currentView: View<any> | null;
}
```

> **Surface API finale du Composer** : 1 méthode abstraite (`resolve`), 1 méthode protégée
> (`request`), 1 propriété lecture seule (`currentView`), 1 propriété framework (`slot`),
> 2 déclarations statiques (`listen`, `request`). C'est le composant le plus simple de Bonsai.

### 6.5 Câblage Radio — modification du bootstrap

Le câblage du Composer par Radio change :

**Avant (statu quo)** :

```
1. Introspecter les méthodes onXxx du Composer
2. Pour chaque onXxxEvent → enregistrer comme listener dans le Channel source
3. Après chaque Event dispatché à un listener Composer → appeler resolve()
4. Comparer le résultat avec le précédent → diff → attach/detach
```

**Après (ADR-0027)** :

```
1. Lire la déclaration statique `listen` du Composer
2. Pour chaque Channel dans listen → enregistrer resolve comme handler universel
3. Quand un Event est dispatché sur un Channel écouté :
   a. Construire l'objet TComposerEvent { name, payload, metas }
   b. Appeler composer.resolve(composerEvent)
   c. Comparer le résultat avec le précédent → diff → attach/detach
```

Le framework n'introspecte plus les méthodes du Composer. Il lit `listen` et câble
directement `resolve()` comme récepteur universel. C'est plus simple à implémenter
et plus prévisible.

### 6.6 Pattern recommandé — `request()` systématique vs `event` ponctuel

Deux styles sont possibles et les deux sont valides :

**Style A — `request()` systématique** (recommandé pour multi-channel) :

```typescript
// Le Composer ignore event et interroge l'état courant
// Fonctionne identiquement au mount et après chaque Event
resolve(event: TComposerEvent<[Router.Channel, Auth.Channel]> | null): TResolveResult | null {
  const route = this.request(Router.channel, 'currentRoute');
  const auth = this.request(Auth.channel, 'currentAuth');

  if (!auth?.isAuthenticated) return { view: LoginView, rootElement: '.MainContent' };
  switch (route?.page) {
    case 'home':    return { view: HomeView,    rootElement: '.MainContent' };
    case 'product': return { view: ProductView, rootElement: '.MainContent' };
    default:        return { view: NotFoundView, rootElement: '.MainContent' };
  }
}
```

> Ce style traite `resolve()` comme une **fonction pure de l'état global** : peu importe
> quel Event a déclenché l'appel, on interroge l'état courant et on décide. Simple,
> prévisible, uniforme.

**Style B — exploitation directe de `event`** (valide pour single-channel) :

```typescript
// Le Composer utilise le payload de l'event quand il est disponible
resolve(event: TComposerEvent<[Auth.Channel]> | null): TResolveResult {
  const isAuth = event !== null
    ? event.payload.isAuthenticated
    : this.request(Auth.channel, 'currentAuth')?.isAuthenticated ?? false;

  return {
    view: isAuth ? ProfileView : LoginView,
    rootElement: '.Sidebar-content',
  };
}
```

> Ce style est plus performant (évite un `request()` quand l'info est dans l'event)
> mais nécessite la gestion du cas `null` séparément. Recommandé uniquement pour les
> Composers à un seul Channel.

### 6.7 Cas du Composer statique (pas de `listen`)

Un Composer sans Channel est un composant de composition fixe. Son `resolve()` est appelé
une seule fois (au montage) et retourne toujours la même chose.

```typescript
class FooterComposer extends Composer {
  resolve(event: null): TResolveResult {
    return { view: FooterView, rootElement: 'footer.Footer' };
  }
}
```

Le type `TComposerEvent<readonly []>` résout en `never`.
Donc `event: never | null` simplifie en `event: null`.
TypeScript refuse `event.name` dans le body — cohérent.

---

## Conséquences

### Positives

- ✅ **Composer = 1 méthode** — le contrat le plus simple de toute l'architecture
- ✅ **Zéro pseudo-state** — plus de propriétés privées passeurs, plus de 4 contraintes formelles pour les encadrer
- ✅ **Explicite** — l'event est un argument visible, pas un magic call caché
- ✅ **Type-safe** — union discriminée, narrowing par `switch`, exhaustiveness check
- ✅ **Implémentation framework simplifiée** — pas d'introspection `onXxx` pour le Composer, câblage direct
- ✅ **ADR-0025 complété** — le Composer n'a définitivement plus rien d'autre que `resolve()`
- ✅ **Boilerplate éliminé** — 12 handlers + 12 propriétés → 1 méthode

### Négatives (acceptées)

- ⚠️ **Rupture avec D12** — le Composer ne suit plus la convention `onXxx`. Accepté car il est le seul composant dont tous les Events déclenchent la même action (`resolve`), contrairement à Feature/View/Behavior.
- ⚠️ **Ajout d'un générique `TListen`** — la classe Composer prend un type parameter. Accepté car le pattern est identique à `Feature<TStructure, TChannel>` — familier dans l'écosystème Bonsai.
- ⚠️ **Perte de la capacité d'accumulation** — le Composer ne peut plus accumuler de l'information au fil des Events. Accepté car `request()` couvre ce besoin (lire l'état courant d'une Feature) et l'accumulation était un anti-pattern déguisé (pseudo-state hors contrôle).

### Risques identifiés

- 🔶 **Performance request()** — un Composer multi-channel pourrait faire N `request()` à chaque `resolve()`. Mitigation : `request()` est synchrone (ADR-0023) et lit l'état en mémoire de l'Entity — coût négligeable.
- 🔶 **Complexité du type `TComposerEvent`** — le conditional type distribué est avancé. Mitigation : le développeur n'écrit pas le type manuellement — il est inféré par le framework. L'IDE affiche le résultat résolu.

### Impact sur le corpus

| Document | Section | Modification |
|----------|---------|-------------|
| [composer.md](../rfc/4-couche-concrete/composer.md) | §1 Classe | Retirer `onXxxEvent`, ajouter `TListen`, signature `resolve(event)` |
| [composer.md](../rfc/4-couche-concrete/composer.md) | §2 Exemples | Réécrire les 3 exemples avec `resolve(event)` |
| [composer.md](../rfc/4-couche-concrete/composer.md) | §2 Notes | Supprimer la section « information décisionnelle » et ses 4 contraintes |
| [composer.md](../rfc/4-couche-concrete/composer.md) | §3 Tableau | « Après un Event » → « Quand un Event écouté est reçu — l'event est passé en argument » |
| [communication.md](../rfc/2-architecture/communication.md) | §8.1–8.2 | Modifier le câblage Composer (plus d'introspection onXxx, resolve = handler) |
| [lifecycle.md](../rfc/2-architecture/lifecycle.md) | §4 Composer | Confirmer : `resolve(event)` seule méthode, pas de handlers, pas de hooks |
| [types-index.md](../rfc/reference/types-index.md) | — | Ajouter `TComposerEvent<TListen>` |
| [decisions.md](../rfc/reference/decisions.md) | D12 | Ajouter note : exception Composer (ADR-0027) |
| [ADR-0025](ADR-0025-composer-no-lifecycle-hooks.md) | Contexte | Mentionner ADR-0027 comme complément |

### Amendement D12

> **D12 (amendé par ADR-0027)** : les handlers sont des méthodes conventionnelles auto-découvertes
> (`onXxxCommand`, `onXxxEvent`, `onXxxRequest`) pour **Feature, View et Behavior**.
> Le Composer est la seule exception : ses Events écoutés sont reçus via l'argument de `resolve(event)`,
> pas via des handlers individuels.

---

## Actions de suivi

- [ ] Mettre à jour `composer.md` — réécriture complète §1 (classe), §2 (exemples), §3 (spec), supprimer la note « information décisionnelle »
- [ ] Mettre à jour `communication.md` §8.1–8.2 — câblage Composer simplifié
- [ ] Mettre à jour `lifecycle.md` §4 — confirmer : Composer = `resolve(event)` uniquement
- [ ] Mettre à jour `types-index.md` — ajouter `TComposerEvent<TListen>`
- [ ] Mettre à jour `decisions.md` — amender D12 (exception Composer)
- [ ] Mettre à jour `ADR-0025` — ajouter référence à ADR-0027 comme complément
- [ ] Mettre à jour `PLAN-CORRECTIONS-2026-04-07.md` — intégrer ADR-0027

---

## Références

- [composer.md](../rfc/4-couche-concrete/composer.md) — contrat du Composer
- [communication.md](../rfc/2-architecture/communication.md) — câblage Radio §8
- [lifecycle.md](../rfc/2-architecture/lifecycle.md) — cycles de vie §4
- [ADR-0020](ADR-0020-composers-n-instances-composition-heterogene.md) — N-instances, TResolveResult
- [ADR-0023](ADR-0023-request-reply-sync-vs-async.md) — request/reply synchrone
- [ADR-0025](ADR-0025-composer-no-lifecycle-hooks.md) — suppression des hooks lifecycle

---

## Historique

| Date | Changement |
|------|------------|
| 2026-04-07 | Création (Proposed) — suite à l'analyse d'élégance du contrat Composer |
