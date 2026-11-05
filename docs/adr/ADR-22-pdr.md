# ADR-22 — Rendu : Projection DOM Réactive chirurgicale, pas de VDOM

| Champ | Valeur |
| --- | --- |
| **Statut** | 🟢 Accepted |
| **Invariants impactés** | I38, I41 |
| **Livré** | ✅ strate 1c — N1 (`getUI()`, ADR-16) ; templates N2/N3 alimentés par Query (lot 2, ADR-26) ; `ProjectionList` (lot 3, ADR-23) ; compilateur Pug `tools/pug-compiler` et `ProjectionSwitch` (lot 4). Animations : [ROADMAP](../ROADMAP.md) ; hydratation : strate 2c (ADR-24). Statut `Accepted` tant que I38 reste partiel |
| **Spec** | [5-rendu.md](../spec/5-rendu.md) · [view.md §4](../spec/4-couche-concrete/view.md) |

## Contexte

Le DOM préexiste dans la grande majorité des cas (SSR, CMS, HTML statique), et
l'Entity sait déjà **quoi** a changé (notifications par clé, ADR-10). Un VDOM
recopie ce DOM en mémoire pour redécouvrir, par diff, une information déjà
connue. Le cas qui semblait l'exiger (filtre/tri d'une liste rendue côté
serveur) se traite avec une réconciliation par clé.

## Décision

**La View projette, elle ne re-rend pas.** Les données sont appliquées au DOM
existant par mutations ciblées, sans VDOM ni diff d'arbre. Trois modes de
template, mutuellement exclusifs par View :

| Mode | `get templates()` | Niveau | Usage |
| --- | --- | --- | --- |
| A | `null` | N1 | projection via `getUI()` seulement |
| B | `{ root: binding }` | N3 | template complet de la part |
| C | `{ [cléUI]?: binding }` | N2 | îlots : fragments sur certaines clés (`root` interdit) |

- Templates écrits en **Pug**, compilés au build (`pnpm pug`) en un module versionné qui exporte un `TProjectionTemplate` : `create()` produit le DOM, `setup()` y localise les nœuds dynamiques (c'est aussi l'hydratation, ADR-24), `project()` applique des mutations gardées. Le type des données est déclaré en tête du template et vérifié par `tsc` sur le module généré :

```pug
//- @data import("./cart.types").TCartItemsData
ul
  each item in items
    li(data-item-id=item.id) #{item.name}
```

- `each` à clé (imbriqués supportés) → `ProjectionList` ; `if`/`else` → `ProjectionSwitch`, branche encadrée de deux commentaires marqueurs ; mixins inlinés.
- Chaque binding tire ses données d'une Query déclarée, relancée par les Events de son `on`, puis d'un `select` facultatif ; la projection est sautée si la sortie est `shallowEqual` à la précédente (ADR-26).
- **Source de mutation unique par clé** (I41) : une clé couverte par un template n'est plus mutable par `getUI()`.
- Les listes passent par `ProjectionList.reconcile()` (ADR-23), l'équivalent d'un diff keyed sans arbres alloués.
- **Les données dérivées (filtrées, triées) ne vont jamais dans l'Entity** : elle stocke les items bruts et les critères, le selector dérive.
- **Animations** : callbacks + transitions CSS, pas de moteur intégré ; reportées avec ceux de `ProjectionList` ([ROADMAP](../ROADMAP.md)).

## Alternatives rejetées

- **VDOM global (type Snabbdom)** — copie du DOM, hydratation par `vnodeFromDom` fragile, re-render incompatible avec les Behaviors à 60 fps, rend `ProjectionList` redondante.
- **VDOM local par template** — deux modèles de rendu et deux réconciliations qui coexistent, pour des opérations DOM finales identiques.
- **Pool de recyclage des items** — complexité disproportionnée ; les listes lourdes relèvent de `VirtualizedList`.
- **Moteur d'animation intégré** — surface d'API excessive.
- **Interdire les `each` imbriqués** — contournements pires que le support natif.
- **Type des données inféré des chemins du template** — interdit toute expression hors chemin ; retenu : type TypeScript déclaré, expressions libres.
- **Conditionnel par recréation de l'élément parent** — perd l'état des frères ; retenu : marqueurs commentaires.

## Conséquences

- Zéro allocation intermédiaire : le coût d'une mise à jour est proportionnel au delta.
- La correction repose sur le compilateur PDR, vérifiable au build, plutôt que sur un diff runtime.
- Le prototype VDOM `tools/pug-to-ts-template/` est supprimé ; son lexer et son parser forkés sont repris.

**Écarts du livré** :

- Pug réduit à ce qui se projette : `case`, `while`, `include`, `extends`, code non bufferisé, sortie non échappée, `&attributes` et `class` dynamique sont des erreurs de compilation ([5-rendu §8](../spec/5-rendu.md)).
- La clé d'un item est `data-item-id` ou `data-key` (pas `id`) ; un `each` est le seul contenu de son parent.
- La directive `@ui` (correspondance template ↔ `uiElements` au build) n'est pas livrée ([ROADMAP](../ROADMAP.md)).
- Un rendu serveur devra émettre les marqueurs `<!--bonsai-if:N-->` pour être hydraté (strate 2c).
