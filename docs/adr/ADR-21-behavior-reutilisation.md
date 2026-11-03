# ADR-21 — Behavior et réutilisation de View

| Champ | Valeur |
| --- | --- |
| **Statut** | 🟢 Accepted |
| **Invariants impactés** | I43, I44, I45 |
| **Livré** | ⏳ strate 2 — ni `Behavior`, ni options de View surchargées par le Composer ; l'auto-discovery UI ne voit pas les handlers hérités (ADR-15), ce qui gêne aussi l'héritage |
| **Spec** | [behavior.md](../spec/4-couche-concrete/behavior.md) · [view.md](../spec/4-couche-concrete/view.md) |

## Contexte

Deux besoins de réutilisation se présentent : la **même View dans un autre
contexte** (panier pleine page / mini-panier), et une **capacité transverse**
(tracking, défilement infini, drag & drop) à greffer sur des Views sans rapport.
Héritage, mixins, décorateurs et utilitaires sont tous possibles ; il faut une
règle qui dise lequel employer.

## Décision

**Behavior** : plugin UI réutilisable et **aveugle**, attaché à une View hôte.

- Même pattern modulaire que la View (ADR-14) : `features`, `uiEvents`, `uiElements`, handlers auto-découverts (ADR-15), `localState` (ADR-17).
- Ses propres Channels (`trigger`, `listen`, `request`, jamais `emit`).
- **Aucun accès à la View hôte** : ni `this.view`, ni son `el`, ni son `getUI()` (I44).
- Altération **N1 et N2 sur ses propres clés** uniquement, jamais N3 ; pas de `rootElement`, pas de slots (I45).
- Ses clés UI ne doivent pas entrer en collision avec celles de l'hôte : vérifié au montage (I43).

**Algorithme de choix** (du plus découplé au plus couplé) :

| Question | Réponse |
| --- | --- |
| Q0 — Sert de base de composition ? | **View** |
| Q1 — Même View, contexte différent ? | **View + options** : sélecteurs `uiElements` et options surchargés par le Composer dans `resolve()` (merge superficiel) |
| Q2 — Capacité orthogonale, applicable à des Views sans rapport ? | **Behavior** |
| Q3 — Modifie le template principal ? | **Héritage** (rare, découragé) |
| Q4 — A besoin de ses propres Channels ? | **Behavior** ; sinon une méthode privée |

## Alternatives rejetées

- **`this.view` accessible depuis le Behavior** — couplage à l'hôte, plus de réutilisation.
- **Behavior sans contrat UI propre** — collisions et accès implicites au DOM de l'hôte.
- **Behavior avec templates N3** — deviendrait une View.
- **Deux types (`Behavior` / `RenderableBehavior`) avec conteneur dédié** — complexité sans cas d'usage.
- **Mixins** — incompatibles avec un composant aveugle, typage fragile.
- **Décorateurs** — magie implicite.
- **Héritage comme mécanisme par défaut** — couplage total ; anti-pattern « Excessive View Inheritance ».

## Conséquences

- La nature du couplage (nul, partiel, total) choisit l'outil, pas la complexité apparente.
- Un Behavior se teste seul, sur un fragment DOM portant ses propres clés, sans View hôte.
- La syntaxe détaillée de `behavior.md` date d'avant ADR-14 et sera réécrite au démarrage de la strate 2.
