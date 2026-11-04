# ADR-19 — Part de la View : attribuée par le Composer, créée par le noyau

| Champ | Valeur |
| --- | --- |
| **Statut** | 🟢 Accepted |
| **Invariants impactés** | I31, I32, I34 |
| **Livré** | ✅ part attribuée, matérialisée après validation, projection du `template` (lot M6.2) · ⚠️ une part n'est matérialisée qu'à son attribution : un élément apparu plus tard n'est pas repris ; adoption d'un élément rendu par le serveur ⏳ (ADR-24) |
| **Spec** | [view.md](../spec/4-couche-concrete/view.md) · [composer.md](../spec/4-couche-concrete/composer.md) · théorie 6.5, 8.5, C.3, C.7 |

## Contexte

Une View doit savoir où elle vit. Déclaré par la View, cet emplacement la lie à
un contexte unique et entre en conflit avec le Composer qui décide où elle va.
Choisi par le Composer comme sélecteur dans tout le document, il peut viser un
élément qui ne lui appartient pas. Il faut un propriétaire unique par nœud et
un seul algorithme pour l'élément présent ou à créer.

## Décision

**Une View occupe une part** : une portion du contenu que son Composer a reçu,
attribuée à la création de la View (I31). La View ne la choisit pas, et les parts
ne se recouvrent pas (T7, `PORTION_TAKEN`).

- Le noyau **crée l'élément de la part** et y projette le `template` de la View ; cette matérialisation est un effet, engagé après la validation de l'unité qui crée la View (C.3).
- La View écrit dans sa part par des effets préparés (`getUI`, ADR-16) ; elle ne peut ni la détruire ni la remplacer (I32). Sa destruction restitue la part à son Composer.
- La Foundation admet un élément de l'hôte (`anchor`, `body` par défaut), jamais une View (I34) ; ses slots sont les premières parts attribuées.

```ts
get composers() {
  return { main: { slot: "[data-slot='main']", composer: MainComposer } } as const;
}
// le Composer de "main" attribue une part par View de sa composition : { view: "cart", key: "cart" }
```

## Alternatives rejetées

- **`rootElement` dans les paramètres de la View** — dualité View/Composer.
- **`rootElement` : sélecteur CSS fourni par le Composer** (strate 0) — résolu dans tout le document, il pouvait prendre l'élément d'un autre composant.
- **`Element | string | descripteur`** — trois formes pour une attribution que le noyau tient déjà.
- **Le Composer crée l'élément** — rendu de présentation hors de son rôle (D12).
- **Erreur stricte si l'élément manque** — interdit le mode SPA sans HTML préalable.

## Conséquences

- Un composant ne lit ni n'écrit hors de ce qu'on lui a attribué : le périmètre est un fait du noyau, pas une convention.
- Un échec de matérialisation ne fait pas échouer l'unité : il est rapporté dans la trace ; la View reste vivante, ses effets sont non tentés (view.md §9).
- L'adoption d'un élément déjà rendu (SSR) reste à concevoir avec l'hydratation (ADR-24).
