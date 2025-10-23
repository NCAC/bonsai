# 🌿 Analyse complète du framework Bonsai

> **Document généré le 17 mars 2026**
> 
> Relecture exhaustive des RFC du dossier `/docs/rfc/` pour évaluer la robustesse,
> la cohérence et la complétude de l'architecture Bonsai, suivie d'une comparaison
> avec les principaux frameworks front-end du marché.

---

## Table des matières

1. [Évaluation de la robustesse et de la cohérence](#1-évaluation-de-la-robustesse-et-de-la-cohérence)
   - 1.1 [Points forts remarquables](#11-points-forts-remarquables)
   - 1.2 [Points de vigilance identifiés](#12-points-de-vigilance-identifiés)
2. [Comparaison avec les frameworks majeurs](#2-comparaison-avec-les-frameworks-majeurs)
   - 2.1 [Tableau de synthèse](#21-tableau-de-synthèse)
   - 2.2 [React vs Bonsai](#22-react-vs-bonsai)
   - 2.3 [Vue 3 vs Bonsai](#23-vue-3-vs-bonsai)
   - 2.4 [Angular vs Bonsai](#24-angular-vs-bonsai)
   - 2.5 [Svelte 5 vs Bonsai](#25-svelte-5-vs-bonsai)
   - 2.6 [Solid.js vs Bonsai](#26-solidjs-vs-bonsai)
3. [Verdict final](#3-verdict-final)
   - 3.1 [Forces uniques de Bonsai](#31-forces-uniques-de-bonsai)
   - 3.2 [Faiblesses à adresser](#32-faiblesses-à-adresser)
   - 3.3 [Recommandation](#33-recommandation)

---

## 1. Évaluation de la robustesse et de la cohérence

### 1.1 Points forts remarquables

#### 1.1.1 Rigueur conceptuelle exceptionnelle

L'architecture Bonsai démontre un niveau de formalisation rare dans l'écosystème front-end :

- **41 invariants** (I1-I41) couvrent exhaustivement les règles non-négociables
- **32 décisions** (D1-D32) documentent chaque choix avec contexte, alternatives rejetées et justifications
- La relation **1:1:1** (namespace ↔ Feature ↔ Entity) élimine toute ambiguïté d'ownership

> **Observation** : Aucun framework majeur (React, Vue, Angular, Svelte, Solid) ne dispose
> d'une documentation aussi formalisée de ses invariants architecturaux. Cette rigueur
> permet une compréhension non-ambiguë du modèle mental attendu.

#### 1.1.2 Séparation couche abstraite / couche concrète

```
Couche Abstraite (state + logique)     Couche Concrète (DOM + interaction)
├── Feature                            ├── Foundation (unique, <body>)
├── Entity                             ├── Composer (décideur 0/1 View)
├── Channel                            ├── View (projection pure)
└── Radio (infra interne)              └── Behavior (enrichissement)
```

Cette séparation est **plus propre que React/Vue** où les composants mélangent state, logique et rendu.

**Avantages observés** :
- La couche abstraite peut être testée sans DOM
- Le remplacement de la couche concrète (ex: React Native) est théoriquement possible
- La logique métier est isolée des détails de rendu

#### 1.1.3 TypeScript-first avec garanties compile-time

Le système de types de Bonsai va bien au-delà du "TypeScript supporté" des autres frameworks :

| Pattern TypeScript | Usage dans Bonsai | Bénéfice |
|-------------------|-------------------|----------|
| Template literal types | `ExtractHandlerName` : `"addItem"` → `"onAddItemCommand"` | Autocomplétion des handlers |
| Mapped types | `RequiredCommandHandlers<TChannel>` | Force l'implémentation complète |
| Conditional types + infer | `RequestResult<TChannel, TName>` | Typage automatique des retours |
| Constrained generics | `TStructure extends JsonSerializable` | Entities sérialisables garanties |
| Surcharges discriminées | `getUI()` retourne `ProjectionRead` ou `ProjectionNode` selon `TTemplated` | I41 garanti au compile-time |

**Conséquence** : les erreurs architecturales sont détectées **avant** l'exécution.

#### 1.1.4 PDR (Projection DOM Réactive) — décision audacieuse

```
VDOM (React/Vue/Svelte)              PDR (Bonsai)
─────────────────────────            ─────────────────
1. State change                      1. State change
2. Re-render virtual tree            2. Notification per-key (D16)
3. Diff old vs new VDOM              3. Mutation DOM directe
4. Patch DOM                         ─────────────────
                                     O(Δ) vs O(n) diff
```

**Justification D19** : le DOM préexiste dans 99% des cas (SSR/CMS/HTML statique).
Les notifications per-key (D16) fournissent déjà l'information « quoi a changé ».
Pas besoin de diff runtime.

**Avantages** :
- Zéro allocation, zéro diff d'arbre
- Pas de double template (front + back)
- Compatible SSR natif sans hydration coûteuse

#### 1.1.5 Anti-patterns explicitement documentés

La section §12 de RFC-0001 (Anti-patterns) est remarquable — aucun framework majeur
ne documente aussi clairement ce qui est **interdit** :

| Anti-pattern | Description | Invariant violé |
|--------------|-------------|-----------------|
| Smart View | View qui orchestre le métier | I13 |
| Cross-domain Trigger | Feature A commande Feature B | I25 |
| Cross-domain Emit | Feature A émet sur Channel de B | I1, I12 |
| Double Handler | Plusieurs handlers pour un Command | I10 |
| Entity leaking | Entity accessible hors Feature | I5, I6 |
| Stateful View | View avec state local | I30 |
| Radio Direct Access | `Radio.channel('name')` au lieu de déclaration | I14, I15, I16 |

Cette documentation explicite prévient les dérives architecturales.

#### 1.1.6 Traçabilité causale via les metas

Le système de metas (§10, §13) est unique dans l'écosystème :

```typescript
type TMeta = {
  messageId: string;      // Identifiant unique
  correlationId: string;  // Transaction logique (créé par l'UI, I8)
  causationId: string;    // Message parent direct
  origin: { kind, name }; // Émetteur
  hop: number;            // Profondeur (anti-boucle I9)
  timestamp: number;
};
```

**Bénéfices** :
- Debugging : suivre une transaction utilisateur de bout en bout
- Anti-boucle : `hop > maxHops` → rejet automatique
- DevTools : reconstruction du graphe causal (prévu RFC-0004)

**Aucun autre framework** ne fournit ce niveau de traçabilité built-in.

---

### 1.2 Points de vigilance identifiés

#### 1.2.1 Complexité d'entrée

Le modèle Bonsai introduit de nombreux concepts :

| Catégorie | Concepts |
|-----------|----------|
| Capacités Feature | C1 emit, C2 handle, C3 listen, C4 reply, C5 request |
| Voies Channel | Commands (1:1), Events (1:N), Requests (async) |
| Niveaux DOM | N1 (attributs), N2 (zones), N3 (template complet) |
| Modes template | A (pas de template), B (root complet), C (fragments) |
| Composants | Feature, Entity, Channel, View, Behavior, Foundation, Composer |

**Comparaison** :
- **Vue** : `ref()`, `reactive()`, `computed()` — 3 concepts principaux
- **React** : `useState`, `useEffect`, `useContext` — apprentissage progressif
- **Svelte** : `$state`, `$derived`, `$effect` — syntaxe minimale

**Risque** : la courbe d'apprentissage peut décourager l'adoption.

#### 1.2.2 Absence de state UI local — position extrême

L'invariant I30 interdit **tout** state local dans les Views/Behaviors :

```typescript
// ❌ INTERDIT dans Bonsai (viole I30)
class DropdownView extends View {
  private isOpen = false;
  
  onToggleClick(): void {
    this.isOpen = !this.isOpen;  // State local UI
  }
}

// ✅ REQUIS dans Bonsai
// 1. Créer DropdownUiFeature avec Entity { isOpen: boolean }
// 2. View trigger 'dropdownUi:toggle'
// 3. View listen 'dropdownUi:stateChanged'
// 4. Feature handle command, mute Entity, emit event
```

**Comparaison avec les autres frameworks** :

| Framework | State local UI | Pattern |
|-----------|---------------|---------|
| React | ✅ `useState()` | Natif |
| Vue | ✅ `ref()` | Natif |
| Angular | ✅ Variables de classe | Natif |
| Svelte | ✅ `$state` | Natif |
| Solid | ✅ `createSignal()` | Natif |
| **Bonsai** | ❌ | Feature + Entity obligatoire |

**Analyse** : La position Bonsai est **doctrinalement pure** (tout state dans des Entities)
mais génère du boilerplate significatif pour des interactions UI simples.

**Justification I30** : "un autre composant *pourrait* être intéressé par ce changement
d'état, même s'il semble pure-UI (analytics, persistance, dépendances entre composants)".

**Contre-argument** : pour un dropdown isolé, ce surcoût architectural est disproportionné.

#### 1.2.3 Pattern Composer vs composants imbriqués

Le modèle Composer (D21-D24) introduit une indirection :

```typescript
// React — composition directe et déclarative
function Layout() {
  const page = useRoute();
  return (
    <div>
      <Sidebar />
      <main>
        {page === 'home' ? <Home /> : <Product />}
      </main>
    </div>
  );
}

// Bonsai — indirection via Composer
class LayoutView extends View<...> {
  get composers() {
    return {
      sidebarSlot: SidebarComposer,
      contentSlot: ContentComposer,  // decide via resolve()
    };
  }
}

class ContentComposer extends Composer {
  static readonly listen = [Router.channel] as const;
  
  resolve(): typeof View | null {
    return this.lastRoute?.page === 'home' ? HomeView : ProductView;
  }
}
```

**Avantages** :
- Découplage explicite entre parent et enfant
- Le Composer encapsule la logique de décision
- Testabilité du Composer en isolation

**Inconvénients** :
- Plus verbeux (2 classes au lieu de JSX conditionnel)
- Navigation mentale plus difficile (quel Composer monte quoi ?)

#### 1.2.4 Questions ouvertes non résolues

Plusieurs questions restent en suspens dans les RFC :

| Question | Statut | Impact |
|----------|--------|--------|
| Q14 (Metas auto-injectées) | 💬 Penchant fort, pas acté | Nécessite `AsyncLocalStorage` ou équivalent |
| Q16 (Reply en erreur) | 💬 Penchant `null` | `Promise<T \| null>` vs `Result<T>` — impact DX |
| Q7 (Behavior N1 ou N2 ?) | ⏳ Partiellement résolu | Niveau d'altération DOM des Behaviors |

**Recommandation** : résoudre Q14 et Q16 avant l'implémentation.

#### 1.2.5 Écosystème à construire

| Composant | État |
|-----------|------|
| Core framework | 🔶 Design complet, implémentation partielle |
| Router | 🔶 Spécifié (D8), pas implémenté |
| DevTools | 📋 Prévu RFC-0004 |
| CLI / Scaffolding | ❌ Non mentionné |
| Testing utilities | ❌ Non spécifié |
| Documentation interactive | ❌ Non existant |

**Comparaison** : React, Vue, Angular, Svelte ont des écosystèmes matures (CLI, DevTools, testing, etc.).

---

## 2. Comparaison avec les frameworks majeurs

### 2.1 Tableau de synthèse

| Aspect | **Bonsai** | **React** | **Vue 3** | **Angular** | **Svelte 5** | **Solid** |
|--------|------------|-----------|-----------|-------------|--------------|-----------|
| **Paradigme** | Event-driven chorégraphique | Composants déclaratifs | Composants réactifs | Modules + DI | Compile-time reactivity | Fine-grained reactivity |
| **State management** | Entity + Channel (distribué) | useState/Redux/Zustand | ref/reactive/Pinia | Services + Signals | $state + stores | Signals + Context |
| **Rendu** | PDR (mutations directes) | VDOM + diffing | VDOM + Proxy | Zone.js + DOM | Compilé en DOM ops | Fine-grained updates |
| **Typage** | TypeScript-first (design) | TypeScript supporté | TypeScript supporté | TypeScript natif | TypeScript supporté | TypeScript supporté |
| **Composition** | Composer → View | Composants imbriqués | Composants + slots | Composants + DI | Composants + snippets | Composants |
| **State local UI** | ❌ Interdit (Entity obligatoire) | ✅ useState | ✅ ref() | ✅ Variables | ✅ $state | ✅ createSignal |
| **SSR story** | ✅ Native (PDR sur DOM existant) | ⚠️ Hydration coûteuse | ⚠️ Hydration | ⚠️ Universal | ⚠️ Hydration | ⚠️ Hydration |
| **Communication** | Channel explicite (D1) | Props drilling / Context | Props / Provide-Inject | Services / Observables | Props / Context | Props / Context |
| **Courbe d'apprentissage** | 📈 Élevée (41 invariants) | 📊 Moyenne | 📊 Moyenne-Douce | 📈 Élevée | 📉 Douce | 📊 Moyenne |
| **Maturité écosystème** | 🔶 Émergent | ✅ Mature | ✅ Mature | ✅ Mature | ✅ Mature | 📊 Croissant |

---

### 2.2 React vs Bonsai

#### Comparaison détaillée

| Aspect | React | Bonsai | Verdict |
|--------|-------|--------|---------|
| **Predictability** | Flux unidirectionnel | Flux unidirectionnel + traçabilité metas | ✅ **Bonsai** (correlationId, causationId, hop) |
| **Boilerplate** | Minimal avec hooks | Plus élevé (Feature + Entity + Channel) | ✅ **React** |
| **Testabilité** | Components testables en isolation | Channels mockables, Features testables | ≈ Équivalent |
| **DevTools** | React DevTools matures | Prévu RFC-0004 (pas implémenté) | ✅ **React** |
| **Performance SSR** | Hydration coûteuse | PDR sans re-render | ✅ **Bonsai** |
| **State management** | Fragmenté (Context, Redux, Zustand, Jotai...) | Unifié (Entity + Channel) | ✅ **Bonsai** (cohérence) |
| **Adoption** | Écosystème dominant | Framework émergent | ✅ **React** |

#### Flux typique comparé

**React** — mise à jour d'un panier :

```tsx
function CartView() {
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);

  const addItem = (product: Product) => {
    setItems(prev => [...prev, { productId: product.id, qty: 1 }]);
    setTotal(prev => prev + product.price);
  };

  return (
    <div>
      <ul>{items.map(i => <li key={i.productId}>{i.qty}</li>)}</ul>
      <p>Total: {total}</p>
      <button onClick={() => addItem(someProduct)}>Add</button>
    </div>
  );
}
```

**Bonsai** — même fonctionnalité :

```typescript
// 1. Définir le Channel
export namespace Cart {
  export type Channel = TChannelDefinition & {
    namespace: 'cart';
    commands: { addItem: { productId: string; qty: number } };
    events: { itemAdded: { productId: string; qty: number }; totalUpdated: number };
    requests: { items: { params: void; result: CartItem[] }; total: { params: void; result: number } };
  };
  export const channel = declareChannel<Channel>('cart');
}

// 2. Implémenter la Feature
class CartFeature extends Feature<Cart.State, Cart.Channel> {
  onAddItemCommand(payload: { productId: string; qty: number }): void {
    this.entity.addItem(payload.productId, payload.qty);
    this.emit('itemAdded', payload);
    this.emit('totalUpdated', this.entity.getTotal());
  }
}

// 3. Implémenter la View
class CartView extends View<[Cart.Channel], TCartUI> {
  static readonly listen = [Cart.channel] as const;
  static readonly trigger = [Cart.channel] as const;

  onCartItemAddedEvent(payload: { productId: string }): void {
    // PDR : mise à jour DOM directe
    this.getUI('itemList').text(/* ... */);
  }

  onAddButtonClick(): void {
    this.trigger(Cart.channel, 'addItem', { productId: '123', qty: 1 });
  }
}
```

**Analyse** : React est plus concis, Bonsai est plus structuré et traçable.

---

### 2.3 Vue 3 vs Bonsai

#### Comparaison détaillée

| Aspect | Vue 3 | Bonsai | Verdict |
|--------|-------|--------|---------|
| **Réactivité** | Proxy automatique sur ref/reactive | Entity + notifications per-key | ≈ Équivalent (approches différentes) |
| **APIs multiples** | Options API + Composition API | Un seul paradigme | ✅ **Bonsai** (cohérence) |
| **Template système** | SFC avec `<template>` | PugJS compilé → PDR | ≈ Équivalent |
| **Écosystème** | Mature (Pinia, VueRouter, Vuetify) | À construire | ✅ **Vue** |
| **Communication** | Events/Props/Provide-Inject | Channel tri-lane | ✅ **Bonsai** (plus structuré) |
| **TypeScript** | Supporté (macros) | By design | ✅ **Bonsai** |

#### Pattern de communication comparé

**Vue** — communication parent/enfant :

```vue
<!-- Parent.vue -->
<template>
  <Child :count="count" @increment="count++" />
</template>

<!-- Child.vue -->
<template>
  <button @click="$emit('increment')">{{ count }}</button>
</template>
```

**Bonsai** — même interaction :

```typescript
// La View enfant trigger un Command sur un Channel
class ChildView extends View<[Counter.Channel], TChildUI> {
  static readonly trigger = [Counter.channel] as const;

  onButtonClick(): void {
    this.trigger(Counter.channel, 'increment', {});
  }
}

// La Feature handle et émet un Event
class CounterFeature extends Feature<Counter.State, Counter.Channel> {
  onIncrementCommand(): void {
    this.entity.increment();
    this.emit('countChanged', { count: this.entity.getCount() });
  }
}

// La View parente (ou n'importe quelle View) écoute l'Event
class ParentView extends View<[Counter.Channel], TParentUI> {
  static readonly listen = [Counter.channel] as const;

  onCounterCountChangedEvent(payload: { count: number }): void {
    this.getUI('display').text(payload.count.toString());
  }
}
```

**Analyse** : Vue favorise la communication directe, Bonsai passe par les Channels (découplage).

---

### 2.4 Angular vs Bonsai

#### Comparaison détaillée

| Aspect | Angular | Bonsai | Verdict |
|--------|---------|--------|---------|
| **Architecture** | Modules + Services + DI | Features + Channels + Radio | ≈ Philosophies similaires |
| **Typage** | TypeScript natif avec decorators | TypeScript-first sans decorators (D12) | ✅ **Bonsai** |
| **Boilerplate** | Élevé (modules, services, pipes) | Élevé (mais différent) | ≈ Équivalent |
| **Change Detection** | Zone.js (magique, patches async) | Explicite (Entity → Feature → View) | ✅ **Bonsai** (prévisible) |
| **Enterprise ready** | ✅ Prouvé à grande échelle | 🔶 Non prouvé | ✅ **Angular** |
| **Courbe d'apprentissage** | Élevée | Élevée | ≈ Équivalent |

#### Philosophies comparées

**Points communs** :
- Architecture opinionated avec règles strictes
- TypeScript obligatoire
- Séparation des responsabilités
- Injection de dépendances (Angular: DI explicite, Bonsai: déclarations Channel)

**Différences fondamentales** :

| Aspect | Angular | Bonsai |
|--------|---------|--------|
| Change detection | Zone.js patche les APIs async | Notifications explicites per-key |
| State | Services injectables | Entities encapsulées dans Features |
| Communication | Observable/Subject (rxjs exposé) | Channels (rxjs interne, jamais exposé) |
| Rendu | Templates compilés + dirty checking | PDR sans VDOM |

**Insight** : Bonsai partage la rigueur d'Angular sans la magie de Zone.js.

---

### 2.5 Svelte 5 vs Bonsai

#### Comparaison détaillée

| Aspect | Svelte 5 | Bonsai | Verdict |
|--------|----------|--------|---------|
| **Approche** | Compilateur élimine le runtime | Framework runtime avec PDR | Philosophies opposées |
| **Performance** | Excellente (pas de VDOM) | Excellente (PDR sans VDOM) | ≈ Équivalent |
| **Bundle size** | Minimal (compile away) | À mesurer | 🔶 Probablement **Svelte** |
| **Simplicité** | `$state`, `$derived`, `$effect` | 5 capacités, 3 voies, N niveaux | ✅ **Svelte** |
| **State local** | ✅ Natif avec `$state` | ❌ Interdit (Entity obligatoire) | Dépend du use case |
| **TypeScript** | Supporté | By design | ✅ **Bonsai** |

#### Exemple de réactivité comparé

**Svelte 5** :

```svelte
<script>
  let count = $state(0);
  let doubled = $derived(count * 2);
</script>

<button onclick={() => count++}>
  Count: {count}, Doubled: {doubled}
</button>
```

**Bonsai** — même fonctionnalité :

```typescript
// Entity
class CounterEntity extends Entity<{ count: number }> {
  increment(): void { this.state.count++; }
  getDoubled(): number { return this.state.count * 2; }
}

// Feature avec notification per-key
class CounterFeature extends Feature<...> {
  onCountEntityUpdated(count: number): void {
    this.emit('countChanged', { count, doubled: this.entity.getDoubled() });
  }
}

// View avec projection
class CounterView extends View<...> {
  onCounterCountChangedEvent(payload: { count: number; doubled: number }): void {
    this.getUI('countDisplay').text(`Count: ${payload.count}, Doubled: ${payload.doubled}`);
  }
}
```

**Analyse** : Svelte optimise la concision développeur, Bonsai optimise la traçabilité.

---

### 2.6 Solid.js vs Bonsai

#### Comparaison détaillée

| Aspect | Solid | Bonsai | Verdict |
|--------|-------|--------|---------|
| **Réactivité** | Fine-grained signals | Notifications per-key | ≈ Similaire en granularité |
| **Rendu** | No VDOM, compile-time tracking | No VDOM, PDR | ≈ Équivalent |
| **API surface** | Simple (createSignal, createEffect) | Complexe (5 capacités, etc.) | ✅ **Solid** |
| **Composition** | Components + Context | Features + Composers | ✅ **Bonsai** (plus structuré) |
| **SSR** | Hydration (streaming) | PDR natif | ✅ **Bonsai** |

#### Pattern de réactivité comparé

**Solid** — granularité fine :

```tsx
function Counter() {
  const [count, setCount] = createSignal(0);
  const doubled = createMemo(() => count() * 2);

  return (
    <button onClick={() => setCount(c => c + 1)}>
      Count: {count()}, Doubled: {doubled()}
    </button>
  );
}
```

**Bonsai** — granularité via D16 (per-key) :

```typescript
// La notification on<Key>EntityUpdated est la granularité fine de Bonsai
onCountEntityUpdated(value: number, previous: number): void {
  // Seul le changement de 'count' trigger ce handler
  this.emit('countChanged', { value, previous });
}
```

**Analyse** : Solid et Bonsai partagent le rejet du VDOM mais diffèrent en complexité.

---

## 3. Verdict final

### 3.1 Forces uniques de Bonsai

#### 3.1.1 Traçabilité causale

Aucun autre framework ne trace `correlationId → causationId → hop`.

**Use case** : debug d'un bug en production où une action utilisateur déclenche
une cascade inattendue. Avec Bonsai, on reconstruit le graphe causal complet.

#### 3.1.2 PDR natif SSR

Le DOM serveur est la source de vérité, pas de double-render, pas d'hydration coûteuse.

**Use case** : applications CMS/e-commerce où le HTML est généré côté serveur.

#### 3.1.3 Séparation stricte state/UI

Plus propre que React/Vue où tout vit dans les composants.

**Use case** : équipes avec séparation back-end (Features/Entities) et front-end (Views/Behaviors).

#### 3.1.4 Typage by design

Pas un afterthought, mais le fondement même de l'architecture.

**Use case** : équipes qui exigent des garanties compile-time sur l'architecture.

---

### 3.2 Faiblesses à adresser

#### 3.2.1 Écosystème à construire

| Manque | Impact | Priorité |
|--------|--------|----------|
| DevTools | Debug difficile sans visualisation | 🔴 Haute |
| CLI scaffolding | Boilerplate manuel | 🟡 Moyenne |
| Testing utilities | Mocks ad-hoc | 🟡 Moyenne |
| Documentation interactive | Courbe d'apprentissage | 🔴 Haute |

#### 3.2.2 Courbe d'apprentissage

41 invariants + 32 décisions + concepts multiples = investissement initial important.

**Mitigation possible** : documentation progressive, exemples graduels, playground interactif.

#### 3.2.3 I30 potentiellement trop strict

Le state UI local devrait être optionnel avec un pattern Behavior ou relaxation contrôlée.

**Proposition** : permettre un Behavior avec state local encapsulé pour les interactions
purement visuelles (dropdown, tooltip, etc.) avec opt-in explicite.

---

### 3.3 Recommandation

#### Public cible

| **Bonsai convient pour** | **Bonsai ne convient pas pour** |
|--------------------------|--------------------------------|
| Applications critiques long terme | Prototypes rapides |
| Équipes avec discipline architecturale | Développeurs débutants |
| Contextes SSR/CMS avec DOM existant | SPA pure sans HTML serveur |
| Entreprises qui valorisent la traçabilité | Startups en hypercroissance |
| Codebases > 50k lignes | Projets < 5k lignes |

#### Positionnement marché

```
                    Simplicité
                        ↑
                        │
           Svelte ●     │     ● Vue
                        │
        ─────────────────────────────→ Structure
                        │
           React ●      │     ● Bonsai
                        │
                   Angular ●
```

**Comparaison finale** : Bonsai se positionne entre **Angular** (rigueur enterprise)
et **Backbone/Marionette** (event-driven), avec une modernité TypeScript supérieure aux deux.

C'est un framework **d'architecte**, pas un framework de prototypage.

---

## Annexe A — Checklist de validation RFC

| Aspect | RFC-0001 | RFC-0002 | RFC-0002-channel | RFC-0002-entity | RFC-0002-feature |
|--------|----------|----------|------------------|-----------------|------------------|
| Invariants complets | ✅ I1-I41 | ✅ I31-I41 | ✅ | ✅ | ✅ |
| Décisions documentées | ✅ D1-D32 | ✅ D10-D19, D32 | ✅ D11-D15 | ✅ D10, D16, D17 | ✅ D12, D17, D18 |
| Alternatives rejetées | ✅ | ✅ | ✅ | ✅ | ✅ |
| Glossaire | ✅ | ✅ | ✅ | ✅ | — |
| Questions ouvertes | ✅ Q1-Q9 | ✅ Q9, Q11, Q14-Q17 | — | — | — |
| Anti-patterns | ✅ §12 | — | — | — | — |
| Exemples code | ✅ | ✅ | ✅ | ✅ | ✅ |
| Types TypeScript | — | ✅ Complets | ✅ | ✅ | ✅ |

---

## Annexe B — Références

- [RFC-0001 — Architecture Fondamentale](rfc/RFC-0001-architecture-fondamentale.md)
- [RFC-0002 — API et Contrats de Typage](rfc/RFC-0002-api-contrats-typage.md)
- [RFC-0002 — Channel](rfc/RFC-0002-channel.md)
- [RFC-0002 — Entity](rfc/RFC-0002-entity.md)
- [RFC-0002 — Feature](rfc/RFC-0002-feature.md)
