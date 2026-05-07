# ADR-0044 : `TEvts` restreint à `keyof HTMLElementEventMap` — noms d'événements DOM validés à la compilation

| Champ                   | Valeur                                                                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Statut**              | 🟡 Proposed                                                                                                                             |
| **Date**                | 2026-05-07                                                                                                                              |
| **Décideurs**           | @NCAC                                                                                                                                   |
| **RFC liée**            | [view.md](../rfc/4-couche-concrete/view.md)                                                                                             |
| **ADRs liées**          | [ADR-0042](ADR-0042-view-contract-unified-ui-deps-single-generic.md), [ADR-0045](ADR-0045-teventsfor-semantic-element-event-mapping.md) |
| **Invariants impactés** | I86 (amendé), I89 (nouveau), I90 (nouveau)                                                                                              |

---

## Contexte

Le type `TUIEntry<TEl, TEvts>` déclare les événements DOM qu'un nœud UI peut émettre. Actuellement, `TEvts` est contraint à `readonly string[]` — n'importe quelle chaîne est acceptée sans erreur :

```typescript
// Actuellement accepté — trois classes de bugs silencieux
const uiEvents = {
  addBtn: ui<HTMLButtonElement>()(["clic"]), // ① faute de frappe
  banner: ui<HTMLDivElement>()(["anyway"]), // ② n'est pas un event DOM
  form: ui<HTMLFormElement>()(["submit", "submit"]) // ③ doublon → double-binding
} satisfies TUIContract;
```

Par ailleurs, `TDOMEventFor<S>` contient une branche de fallback `: Event` pour les noms inconnus — branche qui deviendrait **morte** si `TEvts` était contraint à `keyof HTMLElementEventMap` :

```typescript
export type TDOMEventFor<S extends string> = S extends keyof HTMLElementEventMap
  ? HTMLElementEventMap[S]
  : Event;
//                                                              ^^^^^^ branche morte si TEvts ⊆ HTMLElementEventMap
```

> **Relation avec ADR-0045** : cet ADR établit la restriction syntaxique de premier niveau (`keyof HTMLElementEventMap`). ADR-0045 introduit la restriction sémantique de second niveau (`TEventsFor<TEl>` — mapping par sous-type d'élément). ADR-0045 dépend d'ADR-0044 et peut le superseder partiellement sur la contrainte de `TEvts`.

---

## Contraintes

- **C1** : Les `CustomEvent` DOM arbitraires ne sont pas concernés — les événements inter-composants transitent par les Channels Bonsai (I1, I10, I11).
- **C2** : La contrainte ne doit pas casser l'inférence `const` du tuple `events` (critique pour `TUICallbacks<U>`).
- **C3** : `HTMLButtonElement`, `HTMLInputElement`, `HTMLSelectElement` utilisent tous `keyof HTMLElementEventMap` dans lib.dom.d.ts — aucune distinction native. La restriction sémantique fine fait l'objet d'ADR-0045.

---

## Options considérées

### Option A — Conserver `readonly string[]` (statu quo)

| Avantages              | Inconvénients                            |
| ---------------------- | ---------------------------------------- |
| + Zéro breaking change | - Fautes de frappe silencieuses          |
|                        | - Branche morte dans `TDOMEventFor`      |
|                        | - Contredit I75 (Compile-time > Runtime) |

### Option B — Restreindre à `ReadonlyArray<keyof HTMLElementEventMap>` ✅

| Avantages                                                      | Inconvénients                                  |
| -------------------------------------------------------------- | ---------------------------------------------- |
| + Erreur compile sur fautes de frappe (`"clic"`, `"onChange"`) | - Breaking change (scope faible)               |
| + `addEventListener(domEvent, ...)` nativement typé            | - `CustomEvent` DOM arbitraires exclus (voulu) |
| + Branche `: Event` de `TDOMEventFor` supprimable              |                                                |
| + IntelliSense avec autocomplétion DOM                         |                                                |

```typescript
// ❌ Erreur compile
ui<HTMLButtonElement>()(["clic"]);
// Type '"clic"' is not assignable to type 'keyof HTMLElementEventMap'

// ✅ Acceptés
ui<HTMLButtonElement>()(["click"]);
ui<HTMLInputElement>()(["input", "change"]);
ui<HTMLVideoElement>()(["play", "ended"]);
```

### Option C — Type `HasNoDuplicates<T>` pour les doublons ✅ (complément de B)

```typescript
type HasNoDuplicates<
  T extends readonly unknown[],
  Seen extends readonly unknown[] = readonly []
> = T extends readonly [infer H, ...infer R extends readonly unknown[]]
  ? H extends Seen[number]
    ? false
    : HasNoDuplicates<R, readonly [H, ...Seen]>
  : true;

// Signature ui() avec contrainte double
export function ui<TEl extends HTMLElement = HTMLElement>(): <
  const TEvts extends ReadonlyArray<keyof HTMLElementEventMap>
>(
  events: HasNoDuplicates<TEvts> extends true ? TEvts : never
) => TUIEntry<TEl, TEvts>;

// ❌ Erreur compile
ui<HTMLFormElement>()(["submit", "submit"]);
// Argument of type '["submit", "submit"]' is not assignable to parameter of type 'never'
```

---

## Décision

**Option B + C** retenues conjointement :

1. `TEvts` restreint à `ReadonlyArray<keyof HTMLElementEventMap>` — validation syntaxique des noms d'events.
2. `HasNoDuplicates<TEvts>` — interdiction des doublons (double-binding runtime).
3. La restriction sémantique par sous-type d'élément est adressée dans **ADR-0045** (`TEventsFor<TEl>`).

---

## Amendement des invariants

- **I86 (amendé)** : `TUIEntry["events"]` est `ReadonlyArray<keyof HTMLElementEventMap>` sans doublons, possiblement vide.
- **I89 (nouveau)** : Tout nom d'event déclaré doit être une clé de `HTMLElementEventMap`. Validation compile-time uniquement.
- **I90 (nouveau)** : Pas de doublons dans `TUIEntry["events"]` — chaque nom apparaît au plus une fois. Doublon = double-binding `addEventListener` au mount.

---

## Fichiers impactés

| Fichier                              | Modification                                                |
| ------------------------------------ | ----------------------------------------------------------- |
| `packages/view/src/bonsai-view.ts`   | `TUIEntry`, `ui()`, `TDOMEventFor`, ajout `HasNoDuplicates` |
| `docs/rfc/4-couche-concrete/view.md` | Signatures mises à jour                                     |
| `docs/rfc/reference/invariants.md`   | Amendement I86, ajout I89–I90                               |
| `docs/rfc/reference/glossaire.md`    | Entrée `TUIEntry`                                           |

> **Note** : Si ADR-0045 est accepté, `keyof HTMLElementEventMap` dans `TEvts` est remplacé par `TEventsFor<TEl>` — contrainte plus fine qui subsume celle d'ADR-0044. ADR-0044 reste valide comme niveau de restriction minimal.

---

## Historique

| Date       | Changement             |
| ---------- | ---------------------- |
| 2026-05-07 | Création (🟡 Proposed) |
