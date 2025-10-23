# ADR-0016 : Signature des handlers — metas explicites vs auto-injectées

| Champ | Valeur |
|-------|--------|
| **Statut** | 🟢 Accepted |
| **Date** | 2026-03-25 |
| **Décideurs** | @ncac |
| **RFC liée** | RFC-0001 §10.2, RFC-0002 §13 |
| **ADR liée** | ADR-0005 (Meta Lifecycle) 🟢 Accepted |
| **Supersède** | D43 (partiellement — volet « accès metas dans handlers ») |

---

## Contexte

### Le problème

Depuis l'errata du 2026-03-23 (ERR-009), une **contradiction frontale** traverse le corpus documentaire Bonsai sur la question : *comment les handlers accèdent-ils aux metas du message courant ?*

Deux positions incompatibles coexistent dans des documents normatifs :

| Source | Statut | Position | Signature handler |
|--------|--------|----------|-------------------|
| **ADR-0005** (2026-03-18) | 🟢 Accepted | Metas reçues **explicitement** en paramètre ; getter `this.currentMetas` **nommément rejeté** (Options 3B, 3C) | `onXxxCommand(payload, metas)` |
| **RFC-0001 §10.2** (2026-03-20) | 🟢 Stable | Aligné sur ADR-0005 : « tous les handlers reçoivent **toujours** deux paramètres » | `onXxxCommand(payload, metas)` |
| **FRAMEWORK-STYLE-GUIDE §2.3** (2026-03-20) | 🟢 Active | « les metas sont toujours passées explicitement en paramètre. Pas de `this.currentMetas` » | `onXxxCommand(payload, metas)` |
| **D43 / RFC-0002 §13** (2026-03-23) | 🟢 Stable | Metas **auto-injectées** par le framework ; handlers reçoivent `(payload)` **seul** ; « contexte causal implicite framework-managed » | `onXxxCommand(payload)` |
| **RFC-0002-feature** (2026-03-20) | 🟢 Stable | Aligné sur D43 | `onXxxCommand(payload)` |
| **RFC-0002-entity** (2026-03-20) | 🟢 Stable | `TMutationParams` sans champ `metas` (aligné D43) | `mutate(intent, { payload }, recipe)` |

### La violation de gouvernance

D43 contredit directement ADR-0005 (Accepted) **sans qu'un nouvel ADR ne soit créé pour la superseder**. C'est une violation du processus documentaire : *« un ADR Accepted ne se modifie plus — si la décision change, on crée un nouvel ADR qui SUPERSEDES »*.

Cet ADR-0016 rétablit le processus : il examine formellement les deux positions, tranche, et documente les conséquences.

### Divergences collatérales

La contradiction sur la signature des handlers a engendré des divergences secondaires :

| Aspect | ADR-0005 / RFC-0001 | D43 / RFC-0002 |
|--------|---------------------|----------------|
| Nom du type | `TMessageMetas` | `TMeta` |
| `origin.kind` | 5 valeurs (`view`, `feature`, `behavior`, `composer`, `foundation`) | 2 valeurs (`ui`, `feature`) |
| `origin.namespace` | ✅ Présent | ❌ Absent |
| Préfixes `correlationId` | `usr-` / `sys-` | Non mentionnés |
| Format IDs | **ULID** | `uuid()` dans les exemples |
| `TMutationParams.metas` | `{ payload?, metas?: TMessageMetas }` | `{ payload? }` (pas de `metas`) |
| `TEntityEvent.metas` | ✅ Contient `metas?` | ❌ Pas de `metas` |

---

## Contraintes

### Non négociables

- **I7** : tout message porte des metas causales complètes
- **I8** : `correlationId` créé à la racine, jamais modifié
- **I9** : `hop` incrémenté, anti-boucle mécanique
- **Principe Bonsai** : « Explicite > Implicite » (RFC-0001 §3.7)
- **Principe Bonsai** : « Compile-time > Runtime » (RFC-0001 §3.8)
- **Async safety** : les handlers de Command peuvent être `async` (D18)
- Le développeur ne doit **jamais forger** de metas manuellement (consensus des deux positions)

### Techniques

- Les Features peuvent avoir des handlers `async` (handlers Command, listeners Event) qui font du `fetch()`, `setTimeout()`, etc.
- `request()` est synchrone (D9 révisé par [ADR-0023](ADR-0023-request-reply-sync-vs-async.md)) — pas de `await this.request()`
- Pendant un `await`, d'autres handlers peuvent s'exécuter sur la même Feature (`listen` handlers pendant qu'un `handle` command attend)
- JavaScript est single-threaded mais l'interleaving async est réel

---

## Options considérées

### Option A — Confirmer D43 : metas auto-injectées, handlers `(payload)` seul

Le framework maintient un **contexte causal implicite** interne. Les handlers ne reçoivent que le `payload`. Les metas sont propagées automatiquement quand la Feature appelle `emit()`, `request()` ou `mutate()`.

```typescript
class CartFeature extends Feature<Cart.State, Cart.Channel> {
  // ✅ Pattern D43 : pas de paramètre metas
  onAddItemCommand(payload: { productId: string; qty: number }) {
    this.entity.mutate("cart:addItem", { payload }, draft => {
      draft.items.push({ id: payload.productId, qty: payload.qty });
    });

    // emit() → le framework attache automatiquement les metas
    this.emit('cart:itemAdded', { productId: payload.productId, qty: payload.qty });
  }

  // ✅ Async : pas besoin de propager les metas manuellement
  async onCheckoutCommand(payload: { items: string[] }) {
    const price = await this.request(Pricing.channel, 'calculate', { items: payload.items });
    this.emit('cart:checkedOut', { total: price });
  }
}
```

| Critère | Évaluation |
|---------|------------|
| **DX / Ergonomie** | ⭐⭐⭐⭐⭐ Signature simple, moins de boilerplate |
| **Explicite** | ⭐⭐ Magie — les metas sont invisibles dans la signature |
| **Async safety** | ⭐⭐ Problème d'interleaving (voir analyse ci-dessous) |
| **Type-safety** | ⭐⭐⭐ Les metas ne font pas partie du contrat TypeScript visible |
| **Testabilité** | ⭐⭐⭐ Les metas sont injectables via le framework de test, mais non visibles dans la signature |
| **Debugging** | ⭐⭐ Les metas n'apparaissent pas dans les stack traces |
| **Alignement Bonsai** | ⭐⭐ « Explicite > Implicite » violé |

#### ⚠️ Problème d'interleaving async démontré

Le mécanisme de « contexte causal implicite framework-managed » (quel qu'il soit : stack, getter, slot) est vulnérable à l'interleaving :

```typescript
class OrderFeature extends Feature<Order.State, Order.Channel> {
  static readonly listen = [Cart.channel, Payment.channel] as const;
  static readonly request = [Pricing.channel] as const;

  // Handler A — command handler (async)
  async onCreateOrderCommand(payload: { items: string[] }) {
    // Contexte causal : correlationId = 'usr-AAA'
    
    const total = await this.request(Pricing.channel, 'calculate', { items: payload.items });
    //             ↑ PENDANT CE AWAIT :
    //             Un Event 'payment:refunded' arrive et déclenche Handler B
    //             sur la MÊME Feature (via listen)
    
    // ⚠️ Ici, quel contexte causal ? 'usr-AAA' ou 'usr-BBB' ?
    // Si stack/getter : risque de corruption
    this.emit('order:created', { total });
  }

  // Handler B — event listener (peut s'exécuter pendant le await de A)
  onPaymentRefundedEvent(payload: { orderId: string }) {
    // Contexte causal : correlationId = 'usr-BBB'
    this.entity.mutate("order:markRefunded", { payload }, draft => {
      draft.status = 'refunded';
    });
    this.emit('order:refunded', { orderId: payload.orderId });
  }
}
```

**Scénario d'interleaving** :
1. Handler A démarre → contexte = `usr-AAA`
2. Handler A appelle `await this.request(...)` → suspendu
3. Event `payment:refunded` arrive → Handler B démarre → contexte = `usr-BBB`
4. Handler B appelle `this.emit(...)` → lit contexte = `usr-BBB` ✅
5. Handler B termine
6. Handler A reprend → contexte = `usr-BBB` ❌ **CORROMPU**

Aucun mécanisme de contexte implicite ne résout ce problème sans recourir à une infrastructure complexe (`AsyncLocalStorage` — Node.js only, rejeté par ADR-0005 pour cette raison).

---

### Option B — Maintenir ADR-0005 : metas explicites, handlers `(payload, metas)`

Les handlers reçoivent `(payload, metas)` en paramètre. La propagation est explicite : `emit(name, payload, { metas })`, `request(channel, name, params, { metas })`, `mutate(intent, { payload, metas }, recipe)`. Le closure capture les metas naturellement dans les handlers async.

```typescript
class CartFeature extends Feature<Cart.State, Cart.Channel> {
  // ✅ Pattern ADR-0005 : payload + metas explicites
  onAddItemCommand(payload: { productId: string; qty: number }, metas: TMessageMetas) {
    this.entity.mutate("cart:addItem", { payload, metas }, draft => {
      draft.items.push({ id: payload.productId, qty: payload.qty });
    });

    // Propagation explicite — le développeur voit la chaîne causale
    this.emit('cart:itemAdded', { productId: payload.productId, qty: payload.qty }, { metas });
  }

  // ✅ Async : le closure capture metas — async-safe par construction
  async onCheckoutCommand(payload: { items: string[] }, metas: TMessageMetas) {
    const price = await this.request(Pricing.channel, 'calculate', { items: payload.items }, { metas });
    // Après le await, metas est toujours le même objet (closure) — impossible de corrompre
    this.emit('cart:checkedOut', { total: price }, { metas });
  }
}
```

| Critère | Évaluation |
|---------|------------|
| **DX / Ergonomie** | ⭐⭐⭐ Un paramètre supplémentaire + propagation explicite |
| **Explicite** | ⭐⭐⭐⭐⭐ Zéro magie — tout est visible dans la signature |
| **Async safety** | ⭐⭐⭐⭐⭐ Prouvablement correct — le closure est immuable |
| **Type-safety** | ⭐⭐⭐⭐⭐ `TMessageMetas` dans la signature = contrat TypeScript |
| **Testabilité** | ⭐⭐⭐⭐⭐ Metas injectables directement dans l'appel de test |
| **Debugging** | ⭐⭐⭐⭐⭐ Metas visibles dans les stack traces, les breakpoints |
| **Alignement Bonsai** | ⭐⭐⭐⭐⭐ « Explicite > Implicite », « Pas de magie » |

#### Coût réel de la verbosité

Le « surcoût » se résume à :
- `metas: TMessageMetas` dans la signature du handler (+1 paramètre)
- `{ metas }` dans chaque appel `emit()` et `request()`

```typescript
// Avec metas explicites
this.emit('cart:itemAdded', { item }, { metas });

// Sans metas (D43)
this.emit('cart:itemAdded', { item });
```

La différence est **10 caractères** par appel. En échange : sécurité async prouvée, debugging facilité, alignement avec les principes fondateurs.

---

## Analyse comparative

| Critère | Poids | Option A (D43 — implicite) | Option B (ADR-0005 — explicite) |
|---------|-------|---------------------------|--------------------------------|
| **Async safety** | Critique | ⭐⭐ Vulnérable à l'interleaving | ⭐⭐⭐⭐⭐ Prouvablement correct |
| **Alignement principes Bonsai** | Élevé | ⭐⭐ Viole « Explicite > Implicite » | ⭐⭐⭐⭐⭐ Pleinement aligné |
| **Type-safety** | Élevé | ⭐⭐⭐ Metas hors contrat | ⭐⭐⭐⭐⭐ Metas dans le contrat |
| **DX / Ergonomie** | Moyen | ⭐⭐⭐⭐⭐ Moins verbeux | ⭐⭐⭐ +1 param, +10 chars |
| **Testabilité** | Moyen | ⭐⭐⭐ Injection indirecte | ⭐⭐⭐⭐⭐ Injection directe |
| **Debugging** | Moyen | ⭐⭐ Invisible | ⭐⭐⭐⭐⭐ Visible partout |
| **Complexité framework** | Moyen | ⭐⭐ Contexte implicite à gérer | ⭐⭐⭐⭐⭐ Aucun mécanisme caché |
| **Gouvernance** | Élevé | ⭐ Viole le processus ADR | ⭐⭐⭐⭐⭐ Respecte ADR-0005 |

---

## Décision

### 🟢 Option B retenue — Metas explicites `(payload, metas)`

**ADR-0005 est maintenu et confirmé.** La décision D43 est **révoquée** sur le volet « handlers reçoivent uniquement `(payload)` » et « contexte causal implicite framework-managed ».

### Ce qui est confirmé (consensus des deux positions)

| Principe | Source | Statut |
|----------|--------|--------|
| Le développeur ne forge **jamais** de metas manuellement | D43, ADR-0005 | ✅ Maintenu |
| Le framework **crée** les metas au point d'entrée (`trigger`, `onInit`, timer) | D43, ADR-0005 | ✅ Maintenu |
| Le `correlationId` est **préfixé** `usr-` (UI) ou `sys-` (système) | ADR-0005 | ✅ Maintenu |
| Les IDs sont des **ULID** (triables temporellement) | ADR-0005 | ✅ Maintenu |
| Les Requests portent des metas (I7 complet) | ADR-0005 | ✅ Maintenu |
| Le `hop` est vérifié mécaniquement (I9) | RFC-0001 §10.3 | ✅ Maintenu |

### Ce qui est révoqué (D43)

| Aspect de D43 | Statut | Remplacement |
|---------------|--------|-------------|
| Handlers reçoivent `(payload)` seul | ❌ **Révoqué** | Handlers reçoivent `(payload, metas)` |
| « Contexte causal implicite framework-managed » | ❌ **Révoqué** | Propagation explicite via paramètre |
| Getter `this.currentMeta` (debug/logging) | ❌ **Révoqué** | Metas disponibles en paramètre |
| I54 « metas injectées automatiquement — développeur ne forge jamais » | ⚠️ **Amendé** | I54 reformulé : « le framework **crée** les metas au point d'entrée ; le développeur les **reçoit** en paramètre et les **propage** explicitement » |

### Justification

1. **Async safety** : le problème d'interleaving démontré dans l'Option A est un bug **silencieux** et **non-déterministe** — la pire catégorie de bug. L'approche explicite le rend **structurellement impossible**.

2. **Alignement philosophique** : Bonsai se définit par « Explicite > Implicite » et « Pas de magie ». Introduire un contexte causal implicite contredit ces principes fondateurs.

3. **Gouvernance** : ADR-0005 est un ADR Accepted. Ses décisions ne peuvent être changées que par un nouvel ADR, pas par une modification silencieuse dans une RFC.

4. **Coût réel minimal** : 10 caractères supplémentaires par appel `emit()` — un coût négligeable face aux garanties obtenues.

### Nom et structure du type : harmonisation

Le type est `TMessageMetas` (conforme ADR-0005, plus descriptif que `TMeta`).

```typescript
type TMessageMetas = {
  readonly messageId: string;           // ULID
  readonly correlationId: string;       // ULID, préfixé 'usr-' ou 'sys-'
  readonly causationId: string | null;  // messageId du parent, null si racine
  readonly hop: number;                 // 0 = racine, +1 à chaque réaction
  readonly timestamp: number;           // Date.now()
  readonly origin: {
    readonly kind: 'view' | 'feature' | 'behavior' | 'composer' | 'foundation';
    readonly name: string;
    readonly namespace?: string;        // namespace si Feature
  };
};
```

### Signatures définitives

```typescript
// ══════════════════════════════════════════════════════════════
// Feature — handlers reçoivent (payload, metas)
// ══════════════════════════════════════════════════════════════

// C1 — emit : propage les metas explicitement
protected emit<K extends keyof TChannel['events'] & string>(
  eventName: K,
  payload: TChannel['events'][K],
  options: { metas: TMessageMetas }
): void;

// C2 — handle : reçoit les metas
// Méthode auto-découverte onXxxCommand(payload, metas)
onAddItemCommand(payload: { productId: string; qty: number }, metas: TMessageMetas): void;

// C3 — listen : reçoit les metas
// Méthode auto-découverte onXxxEvent(payload, metas)
onCartItemAddedEvent(payload: { item: CartItem }, metas: TMessageMetas): void;

// C4 — reply : reçoit les metas
// Méthode auto-découverte onXxxRequest(params, metas)
// Retourne T synchrone (D9 révisé par ADR-0023)
onGetItemsRequest(params: void, metas: TMessageMetas): CartItem[];

// C5 — request : propage les metas explicitement
// Retourne T | null synchrone (D9/D44 révisés par ADR-0023)
protected request<TTarget extends TChannelDefinition, K extends keyof TTarget['requests'] & string>(
  channel: TTarget,
  requestName: K,
  params: TTarget['requests'][K]['params'],
  options: { metas: TMessageMetas }
): TTarget['requests'][K]['result'] | null;

// ══════════════════════════════════════════════════════════════
// View/Behavior — trigger : le framework crée les metas
// ══════════════════════════════════════════════════════════════

// trigger() ne prend PAS de metas — le framework les crée
protected trigger<TTarget extends TChannelDefinition, K extends keyof TTarget['commands'] & string>(
  channel: TTarget,
  commandName: K,
  payload: TTarget['commands'][K]
): void;

// ══════════════════════════════════════════════════════════════
// Entity — mutate : reçoit les metas via params
// ══════════════════════════════════════════════════════════════

type TMutationParams = {
  payload?: unknown;
  metas?: TMessageMetas;
};

mutate(intent: string, params: TMutationParams | null, recipe: (draft: Draft<T>) => void): TEntityEvent;
mutate(intent: string, recipe: (draft: Draft<T>) => void): TEntityEvent;
```

---

## Conséquences

### Documents à mettre à jour

| Document | Action |
|----------|--------|
| **RFC-0002 §13** | Réécrire pour aligner sur ADR-0005 : handlers `(payload, metas)`, propagation explicite, supprimer le getter `this.currentMeta`, supprimer la mention « contexte causal implicite » |
| **RFC-0002 §13.1** | Renommer `TMeta` → `TMessageMetas`, ajouter `origin.namespace`, élargir `origin.kind` à 5 valeurs |
| **RFC-0002 §13.2/13.3** | Corriger `uuid()` → `ulid()`, ajouter les préfixes `usr-`/`sys-` |
| **RFC-0002-feature §3** | Restaurer `metas: TMessageMetas` dans les signatures `emit()`, `request()`, et dans les handlers `onXxx` |
| **RFC-0002-feature §4** | Restaurer `(payload, metas)` dans tous les exemples d'auto-découverte |
| **RFC-0002-entity §4** | Restaurer `metas?: TMessageMetas` dans `TMutationParams` et `TEntityEvent` ; supprimer le code fantôme `params?.metas` qui accède à un champ absent du type |
| **RFC-0001 §10.2** | Déjà aligné — aucune modification nécessaire |
| **RFC-0001-invariants-decisions** | Amender D43 : marquer comme « partiellement révoqué par ADR-0016 » ; amender I54 : reformuler |
| **FRAMEWORK-STYLE-GUIDE §2.3** | Déjà aligné — aucune modification nécessaire |
| **ADR-0001** | Déjà aligné sur `(payload, metas)` — aucune modification nécessaire |

### Invariants impactés

| Invariant | Action |
|-----------|--------|
| **I54** | Reformuler : « Le framework **crée** les metas au point d'entrée (trigger, timer, init). Le développeur les **reçoit** en paramètre `(payload, metas)` et les **propage** explicitement à `emit()`, `request()` et `mutate()`. Le développeur ne forge **jamais** de metas manuellement. » |
| **I7** | Inchangé — tout message porte des metas complètes |
| **I8** | Inchangé — `correlationId` jamais modifié |
| **I9** | Inchangé — anti-boucle via `hop` |

### Impact positif

- ✅ Cohérence restaurée entre ADR-0005, RFC-0001, RFC-0002, FRAMEWORK-STYLE-GUIDE
- ✅ Async safety prouvée par construction
- ✅ Alignement avec les principes fondateurs Bonsai
- ✅ Gouvernance documentaire respectée

### Impact négatif (accepté)

- ⚠️ Verbosité légèrement supérieure (+1 paramètre, +10 chars par appel emit/request)
- ⚠️ Risque d'oubli de propagation — mitigé par TypeScript (`metas` requis dans les options d'emit/request)

---

## Actions de suivi

- [x] Accepter cet ADR → passer à 🟢 Accepted
- [x] Mettre à jour RFC-0002 §13 (type, exemples, supprimer contexte implicite)
- [x] Mettre à jour RFC-0002-feature (signatures handlers)
- [x] Mettre à jour RFC-0002-entity (TMutationParams, TEntityEvent)
- [x] Amender D43 et I54 dans RFC-0001-invariants-decisions
- [x] Vérifier que tous les exemples de code utilisent `ulid()` et non `uuid()`
- [x] Mettre à jour TRequiredCommandHandlers / TRequiredRequestHandlers / TEventHandlers (ex-TRequiredEventHandlers) (RFC-0002 §3)
- [x] Aligner FRAMEWORK-STYLE-GUIDE (TMeta → TMessageMetas, exemples)
- [x] Corriger anti-pattern Meta-Driven Logic (RFC-0001-invariants-decisions)
- [x] Aligner RFC-0002-channel (`meta:` → `metas:`)
- [x] Mettre à jour glossaire (RFC-0001-glossaire)

---

## Références

- [ADR-0005 — Meta Lifecycle](ADR-0005-meta-lifecycle.md) — Décision source (Accepted)
- [RFC-0001 §10 — Traçabilité](../rfc/1-philosophie.md#10-traçabilité-et-métadonnées-causales)
- [RFC-0002 §13 — Système de metas](../rfc/6-transversal/conventions-typage.md#13-système-de-metas) — Position D43 (révoquée)
- [FRAMEWORK-STYLE-GUIDE §2.3](../guides/FRAMEWORK-STYLE-GUIDE.md) — Pattern explicite (déjà aligné)
- [Rapport d'audit 2026-03-25](../ERRATA-2026-03-23.md) — Identification de la contradiction B1

---

## Historique

| Date | Changement |
|------|------------|
| 2026-03-25 | Création (Proposed) — Résolution de la contradiction B1 entre ADR-0005 et D43 |
| 2026-03-25 | 🟢 **Accepted** — Option B retenue (metas explicites). Propagation des conséquences dans RFC-0002 |
