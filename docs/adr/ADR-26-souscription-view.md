# ADR-26 — Données d'un template : Query déclarée, relancée par des Events explicites

| Champ | Valeur |
| --- | --- |
| **Statut** | 🟢 Accepted |
| **Invariants impactés** | I41, I82 |
| **Livré** | ⏳ strate 1c, lot 2 (runtime N2/N3) — handlers granulaires `on{NS}{Event}Event(payload, ctx)` livrés (ADR-14) ; bindings `query`/`on`/`select` absents |
| **Spec** | [5-rendu.md §7](../spec/5-rendu.md) · théorie A4.d, G5, C.3, D18 |

## Contexte

Un template (N2/N3, ADR-22) projette des données du domaine. La cible
antérieure lui passait, sur un événement `any`, une référence au state complet
de l'Entity. Elle contredit la théorie : l'état ne se lit que par Query (G5),
la View n'a aucun accès à l'Entity (I6, I80), et une information présentée
comme l'état métier vient d'un message ou d'une réponse du domaine (A4.d).
Reste à fixer d'où le template tire ses données et quand il les relit.

## Décision

**Chaque binding déclare la Query qui l'alimente et les Events qui la relancent.**

```ts
get templates() {
  return {
    items: {
      template: CartItemsTemplate,
      query: "cart:items",                  // Query déclarée dans features.cart.queries
      on: ["cart:itemAdded", "cart:itemRemoved"], // Events déclarés dans features.cart.listens
      select: (items) => items.filter((i) => i.qty > 0) // dérivation de présentation, pure
    },
    header: { template: OrderHeaderTemplate } // statique : projeté une fois
  };
}
```

- **Paramètres** : `params` facultatif, valeur fixe ou fonction des paramètres de création de la View (capturés, A3.d).
- **Projection initiale** : dans l'unité qui crée la View, le framework exécute la Query, applique `select` et prépare la projection.
- **Relance** : après la délivrance d'un Event listé dans `on`, et après son handler s'il existe, le framework exécute les Queries concernées dans l'unité de l'Event, en une seule passe. Une Query identique n'est exécutée qu'une fois par passe.
- **Saut** : si la sortie de `select` est `shallowEqual` à la dernière sortie projetée, rien n'est préparé. Cette mémoire est journalisée : elle est défaite avec l'unité (G7).
- **Effets** : la projection est un effet préparé, engagé après validation (C.3). Elle n'ouvre aucun droit de commander (D18).
- **I82 amendé** : un handler `on{NS}{Event}Event` reste exigé pour chaque Event écouté, sauf s'il figure dans le `on` d'un binding (il devient alors facultatif).
- **I41** : une clé couverte par un template n'est pas mutable par `getUI()`.

## Alternatives rejetées

- **Événement `any` + state complet par référence** — lecture d'Entity hors Query (G5, I6, I80, A4.d).
- **Payload de l'Event seul** — filtre et tri devraient reconstituer l'état à la main.
- **Projection explicite par le handler** (`this.render(key, data)`) — perd l'auto-réactivité déclarée, chaque handler la réécrit.
- **Relance par tout Event du namespace ou toute Event écoutée** — implicite, et impose des handlers vides (I82).

## Conséquences

- La Feature expose une Query par vue de ses données dont un template a besoin ; la dérivation de présentation (tri, filtre, format) reste dans `select`, sans autorité métier (A4.d).
- La description de la View vérifie (O2) que chaque `query` et chaque Event de `on` sont déclarés dans le contrat, et qu'un binding avec `query` a un `on` non vide.
- Le state local (`local`, ADR-17) n'entre pas dans ce mécanisme ; son articulation avec les templates relève de la strate 2a.
