# ADR-15 — Événements UI : `ui<TEl>()(events)`, `TEventsFor<TEl>`, auto-discovery

| Champ | Valeur |
| --- | --- |
| **Statut** | 🟢 Accepted |
| **Invariants impactés** | I48, I84, I85, I86, I89, I90, I91 |
| **Livré** | ⚠️ partiel — le fallback « union large » de `TEventsFor` est inatteignable et `TUIContract` refuse tout événement hors base/défilement (voir Conséquences) |
| **Spec** | [view.md](../spec/4-couche-concrete/view.md) |

## Contexte

Une View déclare les nœuds DOM qu'elle projette et les événements qu'elle y
écoute. Sans contrainte, trois bugs restent silencieux : un nom d'événement mal
orthographié (`"clic"`), un événement absurde pour l'élément (`"play"` sur un
bouton), un doublon qui câble deux fois `addEventListener`. Il faut aussi relier
chaque événement déclaré à son handler sans table de correspondance manuelle.

## Décision

**Déclaration** (module UI du contrat, ADR-14) :

```ts
const uiEvents = {
  total:  ui<HTMLSpanElement>()([]),                 // projection seule
  addBtn: ui<HTMLButtonElement>()(["click"]),
  qty:    ui<HTMLInputElement>()(["input", "change"]),
} satisfies TUIContract;
const uiElements = { total: ".cart-total", addBtn: "#add-btn", qty: "#qty" }
  satisfies TUIElements<typeof uiEvents>;            // un sélecteur par clé
```

1. **`ui<TEl>()(events)` est l'unique helper** (I85) : la forme curryfiée fixe
   `TEl` tout en gardant le tuple `events` littéral. `TEl` est un champ fantôme qui
   contraint les événements admis et les projections de `getUI("qty")`.
2. **`events` est obligatoire** (I86) ; `[]` déclare explicitement un élément non interactif.
3. **Noms contraints par `TEventsFor<TEl>`** (I89, I91) ⊆ `keyof HTMLElementEventMap` :
   mapping sémantique élément → catégories (pointeur, focus, clavier, valeur,
   formulaire, média, défilement, bascule…). `"clic"` et `"play"` sur un bouton ne compilent pas.
4. **Pas de doublon** (I90) : `HasNoDuplicates<TEvts>` rend le paramètre `never`.
5. **Action par défaut** (D20) : `ui<HTMLAnchorElement>()(["click"], { cancelDefault: ["click"] })`
   annule à la capture l'action par défaut de l'hôte pour les événements cités, qui
   doivent être déclarés par la clé (compilation, puis description de la View).
6. **Auto-discovery** (I48, I84) : `addBtn` + `"click"` → méthode `onAddBtnClick(fact, ctx)`,
   imposée par `TViewCallbacks`, héritée comprise. Le handler reçoit une donnée
   `{ type, ui }`, jamais l'événement natif (A3.c), et un contexte qui peut commander
   (D18). À la description de la View, le noyau pose l'observateur sur sa part et
   une méthode manquante est une erreur. Pas de suffixe, contrairement aux
   handlers de Channel `on{NS}{Event}Event` (ADR-14).

Les sélecteurs vivent à part (`uiElements`) pour pouvoir être surchargés sans
toucher au contrat structurel (ADR-21). Les `CustomEvent` arbitraires sont hors
périmètre : la communication entre composants passe par les Channels.

## Alternatives rejetées

- **Map manuelle `get uiEvents() { return { "click #add": "onAdd" } }`** — mapping redondant avec la déclaration.
- **Décorateurs `@OnClick('addBtn')`** — dépendance stage 3, magie implicite.
- **`events: readonly string[]`** — fautes de frappe silencieuses.
- **`preventDefault()` dans le handler** — exigerait de lui transmettre l'événement de l'hôte (A3.c) ; un handler en échec laisserait l'action s'exécuter (D20).
- **`keyof HTMLElementEventMap` uniforme** — accepte `"play"` sur un bouton ; `lib.dom` n'offre pas de map par élément.
- **Règle ESLint dédiée** — contrôle hors compilateur, contournable, à maintenir à part.

## Conséquences

- `TEventsFor` est plus strict que `lib.dom.d.ts` : toute évolution passe par cet ADR (I91).
- **Écart livré** : la branche « conteneurs » du type conditionnel inclut `HTMLElement`, donc tout élément non listé (dont `HTMLElement` lui-même) reçoit `TUIBaseEvents | TUIScrollEvents`. La branche de repli prévue (union large) n'est jamais atteinte : `ui<HTMLElement>()(["input"])` (ex. `contenteditable`) ne compile pas.
- **Écart livré** : `TUIContract` est `Record<string, TUIEntry>` avec `TEl = HTMLElement` par défaut, donc `events` y est contraint à `TUIBaseEvents | TUIScrollEvents`. `ui<HTMLInputElement>()(["input"])` compile seul (les tests de type s'arrêtent là), mais `{ … } satisfies TUIContract` et `TViewContract<F, U>` le rejettent (TS2322/TS2344) : `input`/`change`, `submit`, `toggle`, les événements média… ne sont utilisables dans aucun contrat de View. `click`, `keydown`, `focus`, `scroll` passent.
- Un fait est admis par la seule View dont la part est la plus interne (A5.d) ; sa clé est la première, dans l'ordre de déclaration, dont le sélecteur correspond à la cible ou à un ancêtre.
