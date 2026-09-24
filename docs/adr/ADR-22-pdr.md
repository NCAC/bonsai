# ADR-22 — Rendu : Projection DOM Réactive chirurgicale, pas de VDOM

| Champ | Valeur |
| --- | --- |
| **Statut** | 🟢 Accepted |
| **Invariants impactés** | I38, I41 |
| **Livré** | ⚠️ partiel — N1 seul (`getUI().text/attr/…`, ADR-16) ; templates N2/N3, compilateur PDR, `setup()`/`create()` et callbacks d'animation ⏳ strate 1c. Le prototype `tools/pug-to-ts-template/` génère du VDOM et précède cette décision |
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
| B | `{ root: binding }` | N3 | template complet du `rootElement` |
| C | `{ [cléUI]?: binding }` | N2 | îlots : fragments sur certaines clés (`root` interdit) |

- Templates écrits en **Pug**, compilés au build en deux fonctions : `setup()` localise les nœuds dynamiques dans un DOM existant (c'est l'hydratation, ADR-24), `create()` les produit quand le DOM est absent. Les boucles `each` imbriquées sont supportées.
- Chaque binding a un `select(data)` ; la projection est sautée si sa sortie est `shallowEqual` à la précédente (ADR-26).
- **Source de mutation unique par clé** (I41) : une clé couverte par un template n'est plus mutable par `getUI()`.
- Les listes passent par `ProjectionList.reconcile()` (ADR-23), l'équivalent d'un diff keyed sans arbres alloués.
- **Les données dérivées (filtrées, triées) ne vont jamais dans l'Entity** : elle stocke les items bruts et les critères, le selector dérive.
- **Animations** : callbacks `onBeforeEnter` / `onAfterEnter` / `onBeforeLeave` / `onAfterLeave` + transitions CSS, pas de moteur intégré.

## Alternatives rejetées

- **VDOM global (type Snabbdom)** — copie du DOM, hydratation par `vnodeFromDom` fragile, re-render incompatible avec les Behaviors à 60 fps, rend `ProjectionList` redondante.
- **VDOM local par template** — deux modèles de rendu et deux réconciliations qui coexistent, pour des opérations DOM finales identiques.
- **Pool de recyclage des items** — complexité disproportionnée ; les listes lourdes relèvent de `VirtualizedList`.
- **Moteur d'animation intégré** — surface d'API excessive.
- **Interdire les `each` imbriqués** — contournements pires que le support natif.

## Conséquences

- Zéro allocation intermédiaire : le coût d'une mise à jour est proportionnel au delta.
- La correction repose sur le compilateur PDR, vérifiable au build, plutôt que sur un diff runtime.
- Le prototype `tools/pug-to-ts-template/` est à réécrire pour produire `setup()`/`create()` au lieu de VNodes.
