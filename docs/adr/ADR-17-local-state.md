# ADR-17 — `localState` de présentation

| Champ | Valeur |
| --- | --- |
| **Statut** | 🟢 Accepted |
| **Invariants impactés** | I42, I57 |
| **Livré** | ⏳ strate 2a — seule la réservation du namespace `local` est livrée (`RESERVED_NAMESPACES`) |
| **Spec** | [view.md §7](../spec/4-couche-concrete/view.md#7-api-localstate) · [behavior.md](../spec/4-couche-concrete/behavior.md) |

## Contexte

« Aucun state dans la View » (I30) est trop absolu : l'étape courante d'un
wizard, les erreurs d'un formulaire, un panneau déplié ne concernent personne
d'autre que la View. Les faire passer par Feature + Entity + Channel est une
cérémonie disproportionnée. Le vrai risque n'est pas le state dans la View,
c'est le state **invisible** (`this.isOpen = true` ad hoc).

## Décision

Une View **ou un Behavior** peut déclarer un state local de présentation par un
mécanisme dédié (I42), sous cinq contraintes : **typé et déclaré**, **réactif**,
**encapsulé**, **non diffusable**, **détruit au détachement**.

```ts
class WizardView extends View<TVC> {
  get localState() { return { step: 1, errors: [] as string[] }; }

  onNextBtnClick() {
    this.updateLocal(draft => { draft.step += 1; });      // Immer, comme mutate()
  }
  onLocalStepUpdated({ actual }: TLocalUpdate<number>) {   // réaction N1 optionnelle
    this.getUI("stepLabel").text(`Étape ${actual}`);
  }
}
```

- `updateLocal(recipe)` produit un nouvel état immuable (Immer, comme l'Entity, ADR-10).
- Réactivité duale : callbacks `onLocal{Key}Updated` pour le N1, et selectors
  `data.local.xxx` dans les templates pour le N2/N3 (ADR-22).
- `local` est une **clé de données réservée** (I57), pas un Channel : rien ne
  transite par Radio, personne ne peut l'écouter ni le requêter.
- **Critère de migration** : dès qu'un autre composant a besoin de la donnée,
  elle part dans une Feature.

## Alternatives rejetées

- **I30 strict (tout dans Feature + Entity)** — sur-ingénierie pour un état que personne n'observe.
- **Propriétés libres `this.xxx`** — state invisible, non réactif, non nettoyé.
- **Channel `local` scopé** — observable via Radio : une Feature déguisée, viole l'encapsulation.
- **Callbacks comme mécanisme unique** — redondant avec la re-projection automatique des templates.
- **Signature positionnelle `(prev, next)`** — sans patches, l'objet nommé `{ previous, actual }` est plus lisible.
- **localState réservé au Behavior (état éphémère seul)** — les cas légitimes concernent d'abord la View.

## Conséquences

- La View a enfin une place explicite pour son état, que le framework réinitialise au détachement.
- Tant que l'API n'est pas livrée, les exemples de state dans `view.md` §7 et `behavior.md` sont normatifs mais non exécutables.
