# ADR-24 — Hydratation SSR structurelle, `serverState` opt-in

| Champ | Valeur |
| --- | --- |
| **Statut** | 🟢 Accepted |
| **Livré** | ⏳ strate 1c — `setup()`, adoption par `keyAttr` et `serverState` absents ; seule la réutilisation d'un élément existant est livrée (ADR-19) |
| **Spec** | [5-rendu.md](../spec/5-rendu.md) · [application.md](../spec/3-couche-abstraite/application.md) |

## Contexte

Bonsai vise SSR, SPA et hybride (îlots SPA dans une page serveur). La plupart
des frameworks hydratent en rejouant le rendu à partir d'un state sérialisé
dans la page. Or en PDR (ADR-22) le DOM est déjà la source structurelle :
il suffit de le localiser. Reste le coût d'un second chargement des données.

## Décision

**Hydratation structurelle par défaut** ; state sérialisé en **option explicite**.

- **H1 — Mode détecté par View, pas par application** : le `rootElement` existe dans le slot → adoption et `setup()` ; absent → création depuis le sélecteur (ADR-19) et `create()`. SSR et SPA coexistent dans la même page.
- **H2 — `setup()` est l'hydratation** : il localise les nœuds dynamiques, sans chemin spécial SSR.
- **H3 — `ProjectionList` adopte les items existants** par leur attribut de clé ; seuls les manquants sont créés (ADR-23).
- **H4 — Première projection sans effet visuel** : si les données n'ont pas changé, `shallowEqual` évite toute mutation.
- **H5 — `serverState` est le seul state sérialisé** : `app.start({ serverState })` peuple les Entities **silencieusement** (sans Event) avant le premier `onAttach()`. Le développeur choisit la source (JSON inline, fetch…) ; le framework ne lit jamais de state dans le DOM.

```ts
app.start({
  serverState: JSON.parse(document.getElementById("__STATE__")?.textContent ?? "{}"),
});
```

## Alternatives rejetées

- **State sérialisé obligatoire** — lecture ad hoc du DOM par le framework, couplage serveur ↔ structure des Entities, surface XSS en plus.
- **Islands progressives (`data-bonsai-state` par élément)** — couplage HTML ↔ TypeScript non typé ; le mode C (ADR-22) est déjà une forme d'îlots.
- **Erreur si le `rootElement` est absent** — interdit le mode SPA (ADR-19).

## Conséquences

- Le même code de View sert en SSR et en SPA.
- Sans `serverState`, les Features rechargent leurs données au démarrage ; H4 évite le clignotement.
- `populateFromServer()` sur l'Entity et `TBootstrapOptions` restent à créer.
