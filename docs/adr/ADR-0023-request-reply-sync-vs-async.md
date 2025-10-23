# ADR-0023 : Sémantique de retour de `request()` / `reply()` — sync vs async

| Champ | Valeur |
|-------|--------|
| **Statut** | 🟢 Accepted |
| **Date** | 2026-04-03 |
| **Décideurs** | @ncac |
| **RFC liée** | [communication.md](../rfc/2-architecture/communication.md) |
| **Décision visée** | Révision de D9 |

---

## Contexte

**D9** (2026-03-11) stipule que `reply()` retourne toujours une `Promise<T>`, et donc que `request()` retourne toujours `Promise<T>`. La justification initiale était de "préserver l'encapsulation" — le consommateur n'a pas à savoir si le replier est async ou non.

Cette décision est remise en question. L'argument central :

> **Une `request` est une interrogation en lecture seule d'un état déjà matérialisé dans une Entity.**

Si ce principe est valide, alors l'Entity est toujours à jour au moment de l'appel — et il n'y a structurellement aucune raison d'attendre. `Promise<T>` devient un coût sans bénéfice.

La discussion a également mis en évidence un **principe plus large** sur l'asynchronicité dans Bonsai :

> **L'async est un effet de bord isolé : `command → side effect → nouvel état`.**
> Il vit dans les Features, jamais dans les repliers de `request`.

---

## Contraintes

- **C1** : La décision doit rester cohérente avec D2 (chorégraphie pure), D3 (request cross-domain, lecture seule), D7 (trigger = void, fire-and-forget)
- **C2** : `trigger()` est `void` — l'appelant ne reçoit jamais de résultat direct d'une commande. Cette asymétrie doit rester lisible
- **C3** : Le framework doit rester async-safe : les handlers de Command peuvent être async sans que cela pollue la Request Lane
- **C4** : D44 (`reply` en erreur retourne `null`) doit rester compatible

---

## Principe fondateur : où vit l'async dans Bonsai ?

L'analyse des cas légitimes d'asynchronicité montre qu'ils appartiennent **tous** à la couche Feature, jamais à la Request Lane :

| Source async | Pattern correct | Pattern incorrect |
|---|---|---|
| Fetch HTTP au bootstrap | `Feature.onInit() → fetch() → Entity.mutate()` | `reply() → fetch()` 🚩 |
| Fetch déclenché par Command | `trigger() → handle() → fetch() → Entity.mutate() → emit()` | `reply() → fetch()` 🚩 |
| Réaction à un Event cross-feature | `listen(event) → fetch() → Entity.mutate()` | `reply() → fetch()` 🚩 |
| Timer interne | `setInterval → fetch() → Entity.mutate()` | `reply() → fetch()` 🚩 |

**Invariant émergent** : si un replier a besoin d'être async pour répondre, c'est que l'état n'est pas encore dans l'Entity — ce qui est un problème d'ordre de bootstrap (ADR-0010), pas de sémantique de `request`.

---

## Options considérées

### Option A — Statu quo : `request()` → `Promise<T>` (D9 inchangé)

**Description** : le type de retour reste `Promise<T>` dans tous les cas. Le replier peut être async ou sync selon ses besoins.

| Avantages | Inconvénients |
|-----------|---------------|
| + Pas de migration | - Autorise le fetch paresseux dans un replier (anti-pattern masqué) |
| + Encapsulation totale (le consommateur ignore si c'est async) | - Force tous les appelants à gérer `await` même pour une lecture en mémoire |
| + Compatible avec un replier qui ferait un calcul long | - Brouille la frontière sémantique command/request |
| | - Pollue les templates et selectors avec `await` inutiles |
| | - Rend le pattern "request = lecture synchrone" non-enforçable |

---

### Option B — `request()` → `T` synchrone (révision de D9)

**Description** : `reply()` retourne `T` directement. `request()` retourne `T`. Le replier est contraint d'être synchrone — il ne peut lire que l'état de son Entity, déjà en mémoire.

| Avantages | Inconvénients |
|-----------|---------------|
| + Cohérence sémantique parfaite : request = lecture d'état connu | - Migration des usages existants (si implémentation en cours) |
| + Interdit par construction le fetch paresseux dans un replier | - Perd la "flexibilité" de D9 (mais c'était une fausse flexibilité) |
| + Les appelants n'ont pas à gérer `await` pour une lecture | - Nécessite de réviser D9, D44 (null sync) |
| + Simplifie les selectors et les templates | |
| + Rend la séparation command/request limpide | |
| + Cohérent avec l'invariant I25 (Feature interdit `trigger`) | |

**Pattern correct résultant** :

```typescript
// ✅ Pré-chargement via command (async, fire-and-forget)
trigger(pricing:refresh)
  → PricingFeature.onRefreshCommand()
  → fetch("/api/pricing")
  → this.entity.mutate(...)
  → emit(pricing:loaded)

// ✅ Lecture synchrone après chargement
const total = request(pricing:totalAmount)  // T, pas Promise<T>
```

**Où "caser" l'async** : le tableau complet des patterns autorisés avec `request() → T` :

| Besoin | Solution |
|---|---|
| Charger une donnée distante | `trigger(ns:refresh)` → Feature fetch → `Entity.mutate()` → `emit(ns:loaded)` |
| Réagir à un Event pour charger | `listen(router:navigated)` → Feature fetch → `Entity.mutate()` |
| Polling / refresh périodique | Timer interne Feature → fetch → `Entity.mutate()` |
| Donnée pas encore disponible | Problème de bootstrap (ADR-0010) — garantir l'ordre de chargement |
| Calculer une valeur dérivée | Selector de View (D46, D47) — pas dans le replier |

---

### Option C — `request()` → `T | Promise<T>` (union type)

**Description** : le replier peut retourner `T` ou `Promise<T>` à sa discrétion. Le framework normalise en `Promise<T>` côté consommateur.

| Avantages | Inconvénients |
|-----------|---------------|
| + Flexible | - Exactement le problème que D9 voulait éviter (reply mixte) |
| | - Complexifie le type du consommateur |
| | - Aucune garantie que les mauvaises pratiques sont évitées |

> **Rejetée** : c'est l'alternative "Reply mixte" déjà écartée dans D9, pour les mêmes raisons.

---

## Analyse comparative

| Critère | Option A (statu quo) | Option B (sync) | Option C (union) |
|---------|---------------------|-----------------|------------------|
| Cohérence sémantique | ⭐⭐ | ⭐⭐⭐ | ⭐ |
| Prévention des anti-patterns | ⭐ | ⭐⭐⭐ | ⭐ |
| Simplicité DX | ⭐⭐ | ⭐⭐⭐ | ⭐ |
| Contrainte productive | ❌ | ✅ | ❌ |
| Migration | ✅ aucune | ⚠️ à évaluer | ⚠️ |

---

## Décision

🟢 **Option B retenue** — `request()` retourne `T` synchrone.

### Justification

1. `request` est une **lecture d'état déjà matérialisé** — la `Promise` est superflue par design
2. La contrainte sync est **productive** : elle force le bon pattern (pré-chargement via command) plutôt que de le permettre passivement
3. `trigger` étant `void` et `emit` étant `void`, la cohérence du tri-lane est limpide : **seule la Request Lane retourne une valeur, et cette valeur est immédiate**
4. L'async ne disparaît pas — il est simplement canalisé là où il appartient : dans les handlers de Command et les listeners d'Event des Features

### Trois conséquences architecturales

#### Conséquence 1 — Seule la couche abstraite fait de l'async

L'asynchronicité (fetch HTTP, timers, WebSocket, etc.) est un privilège exclusif de la **couche abstraite** : `Application` et `Feature`. Les handlers de Command (`handle`), les listeners d'Event (`listen`), et les hooks de lifecycle (`onInit`, `onDestroy`) sont les seuls emplacements légitimes pour du code async.

La couche concrète (View, Behavior, Foundation, Composer) est **synchrone par conception**. Elle projette un état déjà matérialisé et émet des intentions via `trigger()`.

#### Conséquence 2 — Toute opération async dans View/Behavior passe par `trigger()`

Si une View ou un Behavior a besoin d'un effet asynchrone (« je veux me connecter », « je veux envoyer un commentaire », « je veux rafraîchir ma liste de services sélectionnés »), cela passe **forcément** par un `trigger()` qui délègue à une Feature. La Feature exécute l'opération async, mute son Entity, émet un Event — la View se met à jour via sa souscription.

```typescript
// ✅ Pattern correct : la View délègue l'async via trigger
class CartView extends View {
  onAddToCartButtonClick(event: MouseEvent, metas: TMetas): void {
    // Intention synchrone — fire-and-forget
    this.trigger('cart:addItem', { productId: 123 }, { metas });
  }
}

// ✅ La Feature gère l'async
class CartFeature extends Feature {
  async onAddItemCommand(payload: { productId: number }, metas: TMetas): Promise<void> {
    const result = await fetch(`/api/cart/add/${payload.productId}`);
    const item = await result.json();
    this.entity.mutate('addItem', { item }, (draft) => {
      draft.items.push(item);
    }, { metas });
    this.emit('cart:itemAdded', { item }, { metas });
  }
}
```

#### Conséquence 3 — Anti-pattern « Async in Concrete Layer » (non détectable mécaniquement)

Il est impossible d'interdire **mécaniquement** (compile-time) qu'un développeur colle un `fetch()`, un `setTimeout()` ou un `await` dans une View ou un Behavior — TypeScript ne distingue pas structurellement un appel async d'un appel sync au niveau de la classe.

Cet anti-pattern est donc documenté **explicitement** dans [anti-patterns.md](../rfc/reference/anti-patterns.md) et enforçable par :
- `[Code review]` — convention d'équipe
- `[Lint]` — règle ESLint custom (future) pour détecter `fetch`, `async`, `await`, `Promise`, `setTimeout`, `setInterval` dans les fichiers `.view.ts` et `.behavior.ts`

### Révisions de décisions

**Révision de D9** :

> ~~D9 — Reply toujours async (`Promise<T>`)~~
> **D9 (révisé) — Reply toujours synchrone (`T`)** : `reply()` retourne `T` directement. Le replier ne peut qu'accéder à l'état de son Entity, déjà en mémoire. Tout chargement async préalable est de la responsabilité des handlers Command ou des listeners Event. Un replier async est un anti-pattern.

**Révision de D44** :

> ~~D44 — `reply()` retourne `Promise<T | null>`~~
> **D44 (révisé) — Reply en erreur retourne `null` (sync)** : `reply()` retourne `T | null`. Si le handler reply throw ou si le Channel n'est pas enregistré, retourne `null` synchrone. Pas de `Promise`.

---

## Conséquences

### Positives

- ✅ Sémantique du tri-lane clarifiée : `trigger()` = `void`, `emit()` = `void`, `request()` = `T`
- ✅ Interdit par construction le fetch paresseux dans un replier
- ✅ Selectors et templates simplifiés (pas de `await request(...)`)
- ✅ Renforce ADR-0010 (bootstrap order) comme seule solution aux données non disponibles
- ✅ L'async est canalisé dans la couche abstraite (Feature) — invisible depuis la couche concrète (View, Behavior)
- ✅ **Principe structurant** : toute opération async dans une View/Behavior passe par `trigger()`, ce qui force la séparation intention/exécution

### Négatives (acceptées)

- ⚠️ Migration des usages existants de `await request()` → acceptée car mécanique (suppression des `await`)
- ⚠️ Un replier ne peut plus « prendre le temps » pour un calcul lourd — accepté : un calcul lourd doit être pré-calculé dans l'Entity ou délégué à un Web Worker via Command
- ⚠️ L'interdiction de l'async dans View/Behavior **n'est pas détectable mécaniquement** en v1 — accepté : enforçable par code review et lint rule custom

### Risques identifiés

- 🔶 **Donnée non initialisée** : si le bootstrap n'a pas encore chargé la donnée, `request()` retourne `null` — mitigation : ordre de bootstrap strict (ADR-0010), état initial explicite dans l'Entity
- 🔶 **Calcul coûteux dans le replier** : un développeur pourrait mettre un calcul O(n²) dans un replier sync — mitigation : D47 (données dérivées dans le selector, pas l'Entity) + lint rule
- 🔶 **Async clandestin dans View/Behavior** : un développeur pourrait coller un `fetch()` dans un handler View — mitigation : anti-pattern documenté, lint rule ESLint future, code review

---

## Actions de suivi

- [x] Valider Option B — **Accepted 2026-04-03**
- [x] Réviser D9 dans [decisions.md](../rfc/reference/decisions.md) — `Promise<T>` → `T`
- [x] Réviser D44 dans [decisions.md](../rfc/reference/decisions.md) — `Promise<T | null>` → `T | null`
- [x] Mettre à jour [communication.md](../rfc/2-architecture/communication.md) — tableau §1 : `Promise<T>` → `T`
- [x] Ajouter anti-pattern « Async in Concrete Layer » dans [anti-patterns.md](../rfc/reference/anti-patterns.md)
- [x] Ajouter anti-pattern « Async Replier » dans [anti-patterns.md](../rfc/reference/anti-patterns.md)
- [x] Vérifier cohérence avec ADR-0003 (channel runtime semantics — timeout Request Lane) — **Amendement propagé 2026-04-03** : timeout supprimé, Cas B simplifié, I29 révisé, synthèse + config + implémentation amendées
- [ ] Ajouter lint rule ESLint custom pour détecter async/fetch/Promise dans `.view.ts` et `.behavior.ts`

---

## Références

- [D9 — decisions.md](../rfc/reference/decisions.md)
- [D44 — decisions.md](../rfc/reference/decisions.md)
- [ADR-0003 — channel-runtime-semantics](ADR-0003-channel-runtime-semantics.md)
- [ADR-0010 — bootstrap-order](ADR-0010-bootstrap-order.md)
- [communication.md §1](../rfc/2-architecture/communication.md)

---

## Historique

| Date | Changement |
|------|------------|
| 2026-04-02 | Création (Proposed) — issue de la discussion sur l'asynchronicité de `request()` |
| 2026-04-03 | **Accepted** — Option B retenue. Seule la couche abstraite fait de l'async. Async dans View/Behavior = anti-pattern (code review). Révision D9 + D44 propagée |
