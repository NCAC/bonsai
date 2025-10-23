# Réflexion sur View et le "state"

Je ne sais pas si cela est posé tel quel, mais le principe "La View est stateless" n'est pas tout à fait exact ou bien trop restrictif.

Ce qui est fermement validé, c'est  "La View ne peut pas broadcaster d'events directement à d'autres composants (Views, Behaviors, Composers, etc.). Elle n'a pas d'autres capacités de communication que de déclencher une commande (intention) sur un Channel et d'écouter des évènements d'autres Channels. Mais qu'en est-il de son "state local". C'est là qu'il y a un problème.

Dans /home/cms/projects/bonsai/docs/rfc/RFC-0003-rendu-avance, nous avons défini trois types de rendu :
- **N1** Mutation d'attributs/noeud de texte
- **N2** Mutation de structure par ilôts (clé ui)
- **N3** Mutation de structure complète (rootElement)

Rien n'empêche d'écrire ceci :

```typescript

class MyView extends View {

  private localState: "pending"|"activated"|"deactivated" = "deactivated"

  // évènement UIEvent
  onSubmmitButtonCLick(event: Event) {
    const localState = this.localState;
    const messageText: string = "";
    switch (localState) {

      case "pending":
        messageText = "Le formulaire est en cours de soumission";
        break;
      case "activated":
        messageText = "Le formulaire a bien été soumis";
        break;
      case "deactivated":
        messageText = "Le formulaire est désactivé";
        break;

    }
    this.getUI("message").text(messageText);
  }
}
```

`this.localState` peut servir de data pour la mutation de type N1 ; par contre c'est impossible pour les mutations de type N2 et N3 (puisque l'on se base sur les `listen` d'autres Channels).

Je pense qu'on pourait envisager un "state local" pour N2 et N3 en se disant qu'une View *devrait pouvoir réagir égalament aux changements de son state local* en plus de réagir aux changements de state d'autre composants. Mais que si on a besoin de broadcaster ces changements, il faut migrer le state local vers un Channel <-> Feature <-> Entity.


Actuellement on peut déclarer un propriété sur sa View mais il n'y a aucun mécanisme d'events locaux ; dans notre exemple, `MyView` ne peut pas réagir dynamiquement aux changements survenus sur `this.localState`. 


Reste qu'il faudrait bien définir/circonscrire ce que l'on nomme par "state" : ce n'est pas de la configuration (immuable, défini au bootstrap ou à l'instanciation) ; c'est de la data que l'on souhaite rendre disponible cross-components (via events et requests) et qui est succeptible d'être altéeé via des commands.

Le cas du state local est un peu différent car c'est de la data qui n'est disponible que dans une seule instance

---

## Conclusion — Décision D33 (2026-03-23)

Cette réflexion a abouti à la **décision D33** et à l'**invariant I42**, formalisés dans les RFCs.

### Ce qui change

**I30 (révisé)** : restreint au **domain state** uniquement. Une View et un Behavior ne possèdent aucun domain state. Toute donnée partagée entre composants vit exclusivement dans une Entity gérée par une Feature.

**I42 (nouveau)** : une View **PEUT** déclarer un **state local de présentation** via un mécanisme dédié du framework, sous 5 contraintes :

1. **Typé et déclaré explicitement** — pas de propriétés ad hoc `this.xxx`
2. **Réactif** — ses mutations déclenchent le même cycle de projection que les events `listen`
3. **Encapsulé** — inaccessible depuis l'extérieur de la View
4. **Non-broadcastable** — aucun trigger/emit, ne transite jamais par un Channel
5. **Éphémère** — ne survit pas à la destruction de la View (nettoyé au `onDetach()`)

### Le principe directeur

La vraie ligne de défense n'est pas « aucun state dans la View » — c'est **« aucun state invisible dans la View »**. Le mécanisme dédié rend le state explicite, déclaratif et traçable.

### Critère de migration

Dès qu'un autre composant a besoin d'observer une donnée du localState → migrer cette donnée vers Feature + Entity. Le localState est strictement intra-View.

### Points ouverts

- **Behavior et localState** : un Behavior pourrait avoir besoin de state local (ex: `isDragging`, `dragOffset` pour un DragDropBehavior). À traiter séparément.
- **API d'implémentation** (`defineLocalState`, `localState.get()`, `localState.set()`, selector fusion) : détails du *comment*, traités dans RFC-0002 lors de la phase d'implémentation.

### Références

- [RFC-0001-invariants-decisions.md](rfc/RFC-0001-invariants-decisions.md) — I30 (révisé), I42 (nouveau), D33, anti-pattern nuancé
- [RFC-0001-composants.md](rfc/RFC-0001-composants.md) — Limites View et Behavior mises à jour
- [RFC-0002-api-contrats-typage.md](rfc/RFC-0002-api-contrats-typage.md) — §9.1, §10.1, table des invariants, D33 dans l'historique