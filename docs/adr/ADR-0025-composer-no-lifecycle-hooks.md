# ADR-0025 : Retrait des hooks de lifecycle du Composer — `onMount`/`onUnmount` supprimés

> **Le Composer est un décideur pur : `resolve()` est son unique point d'entrée.
> Les hooks `onMount`/`onUnmount` n'ont aucun cas d'usage légitime et sont retirés.**

| Champ | Valeur |
|-------|--------|
| **Statut** | 🟢 Accepted |
| **Date** | 2026-04-07 |
| **Décideurs** | @ncac |
| **RFC liée** | [composer.md](../rfc/4-couche-concrete/composer.md), [lifecycle.md](../rfc/2-architecture/lifecycle.md) |
| **Invariants impactés** | I35 (renforcé), I38 (inchangé) |
| **ADRs liées** | [ADR-0020](ADR-0020-composers-n-instances-composition-heterogene.md) (N-instances, scope immutable) |
| **Supersède** | — (corrige une incohérence interne, pas de décision antérieure formelle) |

> ### Statut normatif
> Ce document est **normatif** pour le contrat de lifecycle du Composer.
> Il résout la contradiction entre `composer.md` (qui déclarait les hooks)
> et `lifecycle.md` (qui les niait). En cas de divergence résiduelle, **ce document prévaut**.

---

## 📋 Table des matières

1. [Contexte](#contexte)
2. [Contraintes](#contraintes)
3. [Options considérées](#options-considérées)
4. [Analyse comparative](#analyse-comparative)
5. [Décision](#décision)
6. [Conséquences](#conséquences)
7. [Actions de suivi](#actions-de-suivi)
8. [Historique](#historique)

---

## Contexte

### La contradiction documentaire

Le corpus contient une contradiction bloquante sur le lifecycle du Composer :

**`composer.md` §1** déclare deux hooks sur la classe abstraite :

```typescript
abstract class Composer {
  protected onMount(): void;     // le scope existe et le Composer est actif
  protected onUnmount(): void;   // le scope a disparu
}
```

**`lifecycle.md` §4** affirme le contraire :

> « Les Composers n'ont pas de `onAttach`/`onDetach` — leur lifecycle est
> implicite (création au bootstrap ou par la View parente, destruction en cascade). »

Il faut trancher.

### Analyse fonctionnelle : que ferait un développeur dans ces hooks ?

Pour déterminer si les hooks sont nécessaires, examinons les deux moments de vie concernés.

#### `onMount()` — le scope existe, le Composer est activé

À ce moment, le framework :
1. A résolu le slot DOM (l'élément `@ui` ou le sélecteur Foundation)
2. A instancié le Composer avec `this.slot` assigné
3. Va immédiatement appeler `resolve()`

**Question** : que pourrait faire le développeur dans `onMount()` que `resolve()` ne peut pas faire ?

| Action hypothétique | Possible dans `resolve()` ? | Verdict |
|--------------------|-----------------------------|---------|
| Lire le DOM du scope (querySelector, getAttribute) | ✅ Oui — I35 autorise la lecture | Inutile |
| Faire un `request()` pour obtenir une donnée décisionnelle | ✅ Oui — le Composer a ses Channels câblés | Inutile |
| Stocker de l'information décisionnelle initiale | ✅ Oui — dans le handler d'Event ou dans `resolve()` | Inutile |
| Effectuer un side-effect (log, analytics) | ⚠️ Possible mais hors contrat — le Composer est un décideur pur | Anti-pattern |
| Écrire dans le DOM | ❌ Interdit — I35 | Impossible |

**Résultat** : aucun cas d'usage légitime. `resolve()` est strictement suffisant.

#### `onUnmount()` — le slot a disparu, le Composer est détruit

À ce moment, le framework :
1. A détaché récursivement toutes les Views du Composer et leurs sous-arbres
2. A unsubscribed tous les listeners Channel
3. A nettoyé les event listeners DOM
4. A libéré toutes les références
5. Marque le Composer comme `destroyed` (état terminal)

**Question** : que pourrait faire le développeur dans `onUnmount()` que le framework ne fait pas déjà ?

| Action hypothétique | Gérée par le framework ? | Verdict |
|--------------------|-------------------------|---------|
| Nettoyer les subscriptions Channel | ✅ Automatique — §9.4 de communication.md | Inutile |
| Nettoyer les event listeners DOM | ✅ Automatique — cascade de destruction | Inutile |
| Libérer les références aux Views | ✅ Automatique — `currentView = null` | Inutile |
| Annuler des timers/intervals | ❌ Le Composer ne devrait pas en avoir — c'est un décideur pur, pas un gestionnaire de ressources | Anti-pattern |
| Notifier un autre composant de la destruction | ❌ Le Composer ne peut pas `emit()` — seule la Feature le peut (I1, I4) | Impossible |
| Sauvegarder de l'information décisionnelle | ❌ L'info décisionnelle est transitoire (§2 de composer.md) — pas de persistance | Anti-pattern |

**Résultat** : aucun cas d'usage légitime. Le framework gère 100% du cleanup.

### Pourquoi le Composer est fondamentalement différent de la View

| Aspect | View | Composer |
|--------|------|----------|
| **Écrit dans le DOM** | ✅ Oui (PDR, getUI, templates) | ❌ Non (I35) |
| **Possède des ressources** | ✅ Oui (nodes, uiCache, delegation) | ❌ Non |
| **A du state observable** | ✅ localState (I42) | ❌ Info décisionnelle transitoire uniquement |
| **Besoin d'initialisation post-DOM** | ✅ Oui (première projection, focus, scroll) | ❌ Non — `resolve()` suffit |
| **Besoin de cleanup custom** | ✅ Rare mais possible (animation timers) | ❌ Non — rien à nettoyer |

La View a besoin de `onAttach`/`onDetach` parce qu'elle **possède** des ressources DOM
et peut avoir besoin d'un setup post-insertion (focus sur un champ, démarrage d'une animation).
Le Composer ne possède rien — il décide.

---

## Contraintes

| # | Contrainte | Justification |
|---|-----------|---------------|
| **C1** | **I35** — Le Composer n'a aucune écriture DOM | Pas de ressource à acquérir ni à libérer |
| **C2** | **D21** — Le Composer est un décideur pur | Sa seule logique est dans `resolve()` et les event handlers |
| **C3** | **Nettoyage framework 100%** | Le framework gère automatiquement tout le cleanup (§9.4, §5 cascade) |
| **C4** | **Cohérence API** — chaque hook doit avoir un cas d'usage documenté | Un hook sans cas d'usage est une surface API inutile qui invite aux anti-patterns |

---

## Options considérées

### Option A — Garder `onMount`/`onUnmount`

**Description** : conserver les deux hooks sur la classe abstraite. Corriger `lifecycle.md`
pour s'aligner sur `composer.md`. Documenter que les hooks sont rarement nécessaires.

| Avantages | Inconvénients |
|-----------|---------------|
| + Symétrie API avec View (`onAttach`/`onDetach`) | - Aucun cas d'usage légitime identifié |
| + Extensibilité « au cas où » | - Invite aux anti-patterns (side-effects, timers, accès DOM) |
| | - Augmente la surface API sans bénéfice |
| | - Le développeur se demande « que mettre dedans ? » |

```typescript
// Option A — hooks conservés mais... vides
class MainContentComposer extends Composer {
  onMount(): void {
    // ... rien de légitime à faire ici
    // resolve() est appelé immédiatement après
  }

  onUnmount(): void {
    // ... rien à nettoyer
    // le framework a déjà tout fait
  }

  resolve(): TResolveResult | null {
    // toute la logique est ici
    return { view: HomeView, rootElement: '.HomePage-root' };
  }
}
```

---

### Option B — Retirer `onMount`/`onUnmount`

**Description** : supprimer les deux hooks de la classe abstraite Composer.
Le Composer n'a que `resolve()` comme point d'entrée et les event handlers
comme canaux de réception. Corriger `composer.md` pour s'aligner sur `lifecycle.md`.

| Avantages | Inconvénients |
|-----------|---------------|
| + API minimale — le Composer n'expose que ce qui est utile | - Perte de symétrie avec View |
| + Impossible de faire des anti-patterns dans des hooks inexistants | - Si un cas d'usage émerge, il faudra un nouvel ADR pour réintroduire |
| + Cohérent avec la nature de « décideur pur » | |
| + Résout la contradiction documentaire en faveur de la simplification | |
| + Le développeur comprend immédiatement : « un Composer, c'est `resolve()` + des event handlers » | |

```typescript
// Option B — classe Composer épurée
abstract class Composer {
  protected readonly slot: HTMLElement;

  static readonly listen: readonly TChannelDefinition[];
  static readonly request: readonly TChannelDefinition[];

  abstract resolve(): TResolveResult | TResolveResult[] | null;

  protected readonly currentView: View<any> | null;

  // Pas de onMount, pas de onUnmount.
  // resolve() est le seul point d'entrée.
  // Les event handlers (onXxxEvent) sont les seuls canaux de réception.
}
```

---

## Analyse comparative

| Critère | Option A (garder) | Option B (retirer) |
|---------|-------------------|-------------------|
| **Minimalisme API** | ⭐⭐ | ⭐⭐⭐ |
| **Clarté du contrat** | ⭐⭐ | ⭐⭐⭐ |
| **Prévention anti-patterns** | ⭐ | ⭐⭐⭐ |
| **Extensibilité future** | ⭐⭐⭐ | ⭐⭐ (nécessite ADR) |
| **Cohérence avec la nature du Composer** | ⭐⭐ | ⭐⭐⭐ |
| **DX** | ⭐⭐ (hooks vides déroutants) | ⭐⭐⭐ (contrat limpide) |

---

## Décision

Nous choisissons **Option B — Retirer `onMount`/`onUnmount`** parce que :

1. **Aucun cas d'usage légitime n'a été identifié** après audit exhaustif des moments de vie du Composer
2. **Le Composer est un décideur pur** (D21, I35) — il ne possède aucune ressource, n'écrit pas dans le DOM, ne gère pas de timers. Il n'a rien à initialiser ni à nettoyer.
3. **`resolve()` est strictement suffisant** comme point d'entrée — il est appelé au premier montage, après chaque Event, et à la réapparition du scope. Toute logique décisionnelle y vit.
4. **Le framework gère 100% du cleanup** — subscriptions Channel, event listeners DOM, références, cascade de destruction. Le développeur n'a rien à ajouter.
5. **Un hook vide est une invitation aux anti-patterns** — les développeurs y mettraient des side-effects, des timers, des accès DOM qui violent I35.

L'Option A est rejetée car elle ajoute de la surface API sans bénéfice et crée une symétrie trompeuse avec les hooks View (`onAttach`/`onDetach`) alors que le Composer a une nature fondamentalement différente.

> **Si un cas d'usage émerge dans le futur**, un nouvel ADR pourra réintroduire
> un hook ciblé avec un contrat explicite. Mieux vaut ajouter un hook justifié
> que de retirer un hook mal utilisé.

---

## Conséquences

### Positives

- ✅ **Contrat Composer limpide** : `resolve()` + event handlers, rien d'autre
- ✅ **Résolution de la contradiction** lifecycle.md ↔ composer.md en faveur de la simplicité
- ✅ **Surface API réduite** — moins de méthodes = moins de questions = meilleure DX
- ✅ **Anti-patterns impossibles** par construction — pas de hook = pas de side-effects
- ✅ **Cohérent avec la philosophie Bonsai** : compile-time > runtime, explicite > implicite

### Négatives (acceptées)

- ⚠️ **Perte de point d'extension** — si un Composer avait besoin d'un setup one-shot, il n'a pas de hook pour ça. Accepté car `resolve()` couvre ce cas (appelé au premier montage).
- ⚠️ **Asymétrie avec View** — la View a `onAttach`/`onDetach`, le Composer n'a rien. Accepté car l'asymétrie reflète une asymétrie réelle de responsabilités (projection DOM vs décision pure).

### Risques identifiés

- 🔶 **Cas d'usage imprévu** — un Composer qui aurait besoin d'un setup async avant le premier `resolve()`. Mitigation : ce cas peut être couvert par un `request()` dans `resolve()`, ou par l'init de la Feature (bootstrap phase 4).

---

## Actions de suivi

- [ ] Mettre à jour `composer.md` §1 — retirer `onMount`/`onUnmount` de la classe abstraite
- [ ] Mettre à jour `composer.md` §4.2 — retirer `composer.onUnmount()` de la séquence de détachement (étape 2b)
- [ ] Mettre à jour `composer.md` §5 — retirer `SidebarComposer.onUnmount()` de la cascade de destruction
- [ ] Mettre à jour `lifecycle.md` §4 — confirmer que le Composer n'a que `resolve()`, pas de hooks lifecycle
- [ ] Vérifier `types-index.md` — retirer toute mention de `onMount`/`onUnmount` sur Composer
- [ ] Mettre à jour `PLAN-CORRECTIONS-2026-04-07.md` — marquer C1 résolu

---

## Références

- [composer.md](../rfc/4-couche-concrete/composer.md) — contrat du Composer
- [lifecycle.md](../rfc/2-architecture/lifecycle.md) — cycles de vie des composants
- [ADR-0020](ADR-0020-composers-n-instances-composition-heterogene.md) — N-instances, scope immutable
- [communication.md §9.4](../rfc/2-architecture/communication.md) — nettoyage automatique des subscriptions

---

## Historique

| Date | Changement |
|------|------------|
| 2026-04-07 | Création (Proposed) — suite à l'audit de cohérence documentaire |
