# ADR-0047 : Typage du paramètre `intent` de `Entity.mutate()`

| Champ | Valeur |
|-------|--------|
| **Statut** | 🟡 Proposed |
| **Date** | 2026-05-20 |
| **Décideurs** | @NCAC |
| **RFC liée** | [entity.md §4](../rfc/3-couche-abstraite/entity.md#4-api-de-mutation--mutateintent-params-recipe) |
| **ADRs liées** | [ADR-0001](ADR-0001-entity-diff-notification-strategy.md) (mutate/notification — 🔵 Tested, potentiellement amendée), [ADR-0037](ADR-0037-feature-generic-entity-class.md) (pattern générique `Entity<TStructure>` / dérivation `TEntityState<E>`), [ADR-0040](ADR-0040-typescript-first-api-channel-definition-typed.md) (typage strict des clés Channel — I76, précédent direct de la question posée ici) |
| **Invariants impactés** | Aucun à ce jour — dépend de l'option retenue (voir §Conséquences) |

---

## Contexte

ADR-0028 (strate 1a) vient d'amener `Entity.mutate()` à son contrat cible
(`produceWithPatches`, `TEntityEvent` enrichi, ré-entrance FIFO — I96-I98).
En le implémentant, une question est restée ouverte, posée par l'utilisateur
lors de la revue : **le paramètre `intent` doit-il être typé ?**

Aujourd'hui :

```typescript
mutate(intent: string, recipe: (draft: Draft<TStructure>) => void): TEntityEvent<TStructure> | null;
```

`intent` est un `string` libre. C'est une **asymétrie assumée** avec le reste
du framework : `Channel.{trigger,emit,request,handle,listen,reply}` sont tous
strictement typés contre `TChannelDefinition` (I76, ADR-0040 — `keyof
TDef["commands"]`, jamais un `string` libre). `mutate()` est la seule API de
discriminant du framework qui échappe à cette règle. Le seul garde-fou
documenté aujourd'hui est une **convention de code review** (ADR-0001
§Anti-patterns : « intent explicite et métier, jamais générique ») —
comparable à I18, sans vérification mécanique.

Le principe directeur du framework (« Le type EST le contrat », CLAUDE.md)
pousse naturellement à se demander si cette exception est justifiée, ou si
elle mérite d'être corrigée maintenant que le contrat `mutate()` est
stabilisé (strate 1a).

**Cet ADR ne tranche pas** — il documente le problème, les options et une
recommandation, pour décision ultérieure.

---

## Contraintes

- **C1 — Entity reste agnostique du namespace** (I5, I6, I22) : `Entity` ne
  connaît jamais sa `Feature` propriétaire ni le namespace applicatif. Toute
  option qui voudrait dériver `intent` du namespace (`"cart:addItem"`) doit
  composer avec cette frontière — le namespace n'est disponible que côté
  `Feature`, jamais côté `Entity`.
- **C2 — Constructeur `Entity` zéro-argument** (contrat `new () => TEntity`
  utilisé par `Feature` — ADR-0037, I22) : toute option ne doit pas exiger de
  paramètre de construction supplémentaire pour transporter un type d'intents.
- **C3 — Rétrocompatibilité des `Entity` existantes** : `CartEntity` et les
  fixtures de test ne déclarent aujourd'hui aucune liste d'intents. Une
  option qui rendrait le typage obligatoire casserait tout le corpus
  strate 0/1a existant sans migration.
- **C4 — L'`intent` n'est pas un discriminant de dispatch** (contrairement
  aux commands/events de Channel) : rien dans `Feature#registerEntityHandlers`
  (I96) ne route sur sa valeur — c'est un identifiant de traçabilité/logging/
  Event Sourcing (ADR-0001 §Event Sourcing Compatibility). Le typer n'a donc
  pas la même urgence structurelle que typer les clés de Channel.

---

## Options considérées

### Option A — Statu quo : `intent: string` libre

**Description** : ne rien changer. Le garde-fou reste une convention de code
review (ADR-0001 §Anti-patterns), sans mécanisme compile-time.

| Avantages | Inconvénients |
|-----------|---------------|
| + Zéro changement, zéro migration | - Incohérent avec I76 (Channel) — asymétrie qui interpelle à la lecture du code |
| + `Entity` reste simple à sous-classer (une seule sous-classe minimale : `defineInitialState()`) | - Une faute de frappe dans l'intent ne casse rien à la compilation (juste un log/event mal nommé) |
| + Aucune contrainte nouvelle sur C1/C2/C3 | - Pas d'auto-complétion IDE sur les intents existants d'une Entity |

**Exemple** :

```typescript
class CartEntity extends Entity<TCartState> {
  protected defineInitialState(): TCartState {
    return { items: [], total: 0 };
  }
}

// Aucune vérification compile-time sur la chaîne :
this.entity.mutate("cart:addItem", (draft) => { /* ... */ });
this.entity.mutate("cart:addItm", (draft) => { /* ... */ }); // typo — compile quand même
```

---

### Option B — Union de littéraux exhaustive via un 2ᵉ paramètre générique

**Description** : `Entity<TStructure, TIntent extends string = string>` — les
sous-classes qui veulent le typage strict spécifient `TIntent` comme union de
littéraux ; celles qui ne le font pas gardent le défaut `string` (non
cassant, C3 respectée). `mutate()` est contraint par `TIntent` uniquement
quand il est spécifié.

| Avantages | Inconvénients |
|-----------|---------------|
| + Symétrie totale avec I76 (Channel) — même rigueur pour Entity | - Duplique la liste des intents dans chaque `Entity` (pas de source de vérité partagée avec la Feature qui les émet) |
| + Non cassant par défaut (C3) — opt-in par sous-classe | - Verbeux : une union à maintenir en plus du state |
| + Auto-complétion IDE immédiate sur les intents déclarés | - Ne capture pas la convention `namespace:verbNoun` (juste une énumération fermée) |
| + Compatible C1/C2 (générique purement compile-time, aucun paramètre runtime) | |

**Exemple** :

```typescript
type TCartIntents = "addItem" | "removeItem" | "clear";

class CartEntity extends Entity<TCartState, TCartIntents> {
  protected defineInitialState(): TCartState {
    return { items: [], total: 0 };
  }
}

this.entity.mutate("addItem", (draft) => { /* ... */ });   // ✅
this.entity.mutate("addItm", (draft) => { /* ... */ });    // ❌ TS2345 — n'appartient pas à TCartIntents
```

---

### Option C — Contrainte structurelle par template literal type (pattern `namespace:verbNoun`)

**Description** : sans énumérer les intents un par un, contraindre `intent`
à respecter mécaniquement la convention déjà documentée dans CLAUDE.md
(`namespace:verbNoun`) via un type gabarit (`template literal type`).
Nécessite de faire connaître le namespace à `Entity` au niveau **type**
uniquement (paramètre générique phantom, jamais lu au runtime — pas de
violation de C1 au sens strict, puisque c'est un artefact de type-checking,
pas une donnée manipulée par l'instance).

| Avantages | Inconvénients |
|-----------|---------------|
| + Vérifie mécaniquement une convention aujourd'hui non-outillée (I18-like) | - Ne détecte pas une typo dans le verbe (`"cart:addItm"` reste valide structurellement) |
| + Pas de liste à maintenir — contrainte purement syntaxique | - Introduit un couplage type-level Entity → namespace, contraire à l'esprit actuel de C1 (même si sans effet runtime) |
| + Composable avec l'Option B (les deux ne s'excluent pas) | - Le message d'erreur TS sur un template literal type mal respecté est nettement moins lisible qu'un TS2345 sur union fermée |

**Exemple** :

```typescript
type TIntentFor<NS extends string> = `${NS}:${string}`;

class CartEntity extends Entity<TCartState, TIntentFor<"cart">> {
  protected defineInitialState(): TCartState {
    return { items: [], total: 0 };
  }
}

this.entity.mutate("cart:addItem", (draft) => { /* ... */ });  // ✅
this.entity.mutate("addItem", (draft) => { /* ... */ });       // ❌ TS2345 — ne respecte pas `cart:${string}`
this.entity.mutate("cart:addItm", (draft) => { /* ... */ });   // ✅ compile quand même — la typo du verbe échappe au pattern
```

---

## Analyse comparative

| Critère | Option A (statu quo) | Option B (union exhaustive) | Option C (template literal) |
|---------|:---:|:---:|:---:|
| Symétrie avec I76 (Channel) | ⭐ | ⭐⭐⭐ | ⭐⭐ |
| Détection de typo | ⭐ | ⭐⭐⭐ | ⭐ (verbe non couvert) |
| Coût de maintenance (liste à jour) | ⭐⭐⭐ (rien à maintenir) | ⭐ (union à synchroniser) | ⭐⭐⭐ (rien à maintenir) |
| Respect strict de C1 (Entity agnostique namespace) | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ (couplage type-level) |
| Non cassant pour le corpus existant (C3) | ⭐⭐⭐ | ⭐⭐⭐ (défaut `string`) | ⭐⭐ (nécessite un paramètre NS explicite) |
| Lisibilité des erreurs TS | — | ⭐⭐⭐ | ⭐ |

---

## Décision

> ⏳ **En attente de décision.** Les options sont présentées pour discussion —
> tranchées plus tard, une fois l'usage réel de `intent` observé sur
> plusieurs Features en strate 1 (multi-feature choreography, ADR-0028
> §Critère de validation strate 1).

### Piste de recommandation (non actée)

Option B seule, en opt-in (défaut `string` préservé) : elle apporte la
symétrie avec I76 sans toucher à la frontière Entity/namespace (C1) ni casser
l'existant (C3). Option C est intéressante mais son couplage type-level au
namespace mérite d'être rediscuté à la lumière de la composition
inter-Features prévue en strate 1b/1c — prématuré tant que ce chantier n'a
pas commencé.

---

## Conséquences

*(dépendent de l'option retenue — à documenter au moment de la décision)*

### Risques identifiés

- 🔶 Si tranché en Option B ou C : nécessite un amendement d'ADR-0001
  (🔵 Tested) — l'amendement devra lister précisément quelles Entity du
  corpus existant (fixtures, tests) migrent vers un `TIntent` explicite, et
  lesquelles restent au défaut `string`.
- 🔶 Attendre trop longtemps pour trancher risque de laisser le corpus
  strate 1b/1c (multi-feature) s'appuyer sur des intents non typés à grande
  échelle, rendant une migration ultérieure plus coûteuse.

---

## Actions de suivi

- [ ] Observer l'usage de `intent` pendant l'implémentation de la strate 1b
      (Metas + Channel enrichi, ADR-0028) — recueillir des exemples concrets
      multi-Feature avant de trancher.
- [ ] Revenir sur cet ADR une fois 2-3 domaines métier réels (pas seulement
      `cart`) implémentés, pour juger si l'union de littéraux (Option B)
      reste gérable en pratique.
- [ ] Si Option B ou C retenue : rédiger l'amendement à ADR-0001 et réserver
      les invariants nécessaires (prochain numéro libre à la date de la
      décision).

---

## Références

- [entity.md §4](../rfc/3-couche-abstraite/entity.md#4-api-de-mutation--mutateintent-params-recipe)
- [ADR-0001](ADR-0001-entity-diff-notification-strategy.md)
- [ADR-0040](ADR-0040-typescript-first-api-channel-definition-typed.md) — I76, précédent de typage strict des discriminants Channel

---

## Historique

| Date | Changement |
|------|------------|
| 2026-05-20 | Création (Proposed) — question posée en revue de la strate 1a (Entity enrichie) |
