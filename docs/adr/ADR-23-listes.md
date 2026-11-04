# ADR-23 — Listes : `ProjectionList` + délégation, item identifié par capture déclarée

| Champ | Valeur |
| --- | --- |
| **Statut** | 🔵 Tested |
| **Invariants impactés** | I39 |
| **Livré** | ✅ strate 1c, lot 3 — `ProjectionList` et capture `data` (`@bonsai/view`, noyau) ; `VirtualizedList` et animations hors v1 ([ROADMAP](../ROADMAP.md)) |
| **Spec** | [5-rendu.md §6](../spec/5-rendu.md) · théorie C.3, C.5, A5.a |

## Contexte

Les listes dynamiques sont le cas de rendu le plus fréquent et le plus coûteux :
insertion, suppression, réordonnancement, 1000+ éléments, une action par
ligne. Il faut **un** mécanisme par défaut. Il faut aussi que le traitement d'un
clic sache **quel item** a été touché, sans lire le DOM (I39) : un fait de
l'hôte ne porte aujourd'hui que `{ type, ui }`.

## Décision

**Rendu : `ProjectionList`, réconciliation par clé dans le template.**

```ts
setup(container) {
  return new ProjectionList<TItem, TRowNodes>(container.querySelector("ul")!, {
    keyAttr: "data-item-id",
    key: (item) => item.id,
    create: (item) => row(item),               // élément d'un nouvel item
    setup: (el) => ({ qty: el.querySelector(".qty")! }),
    update: (nodes, item) => { if (nodes.qty.textContent !== String(item.qty)) nodes.qty.textContent = String(item.qty); }
  });
},
project(list, items) { list.reconcile(items); }
```

- `reconcile(items)` : O(n) par carte de clés ; crée, déplace (`insertBefore`), supprime ; `update` est appelé pour chaque item, gardé par nœud.
- À sa construction, la liste **adopte** les enfants qui portent `keyAttr` : ceux que `create()` du template vient de produire, ou ceux du rendu serveur (ADR-24).
- Elle ne s'exécute qu'à l'engagement, dans `setup()`/`project()` (C.3). Une clé dupliquée est une erreur d'engagement.

**Interaction : délégation existante, item capturé avec le fait.** La part a
déjà un seul écouteur par type d'événement. Une clé UI déclare les attributs à
capturer ; le noyau les lit à l'admission, sur l'ancêtre le plus proche de la
cible dans la part (C.5), et le fait les porte comme données.

```ts
remove: ui<HTMLButtonElement>()(["click"], { data: ["itemId"] }) // lit data-item-id

onRemoveClick(fact: TFact<"itemId">, ctx) {
  if (fact.data.itemId !== null) ctx.trigger("cart:removeItem", { itemId: fact.data.itemId });
}
```

Les **child Views** (slot + Composer) restent réservées aux items qui sont de
vrais composants (cycle de vie, Channels propres).

## Alternatives rejetées

- **Child View par item** par défaut — coût de cycle de vie disproportionné pour une ligne.
- **`CollectionComposer`** ou **`ViewFragment`** — une abstraction de plus pour un besoin de rendu.
- **Helper `getItemData(fact, attr)`** sur tous les `data-*` capturés — non déclaré (D16), non typé.
- **Callbacks `onInsert`/`onMove`/`onRemove`** — reportés avec les animations ([ROADMAP](../ROADMAP.md)) : une sortie animée laisse un élément après l'engagement.
- **Virtualisation intégrée** — alourdit le cas simple ; `VirtualizedList` est une API distincte, hors v1.
- **Pool de recyclage** — voir ADR-22.

## Conséquences

- Un seul chemin de création d'item (`create`) ; le filtre et le tri restent dans `select` (ADR-26).
- La valeur capturée est une chaîne détachée, ou `null` sans ancêtre porteur : le handler ne relit jamais l'hôte.
- La capture d'autres valeurs (saisie d'un champ) suit le même canal, à étendre avec les formulaires (strate 2).
