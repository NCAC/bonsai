# ADR-26 — Souscription de la View : handlers granulaires ou `any` + selectors

| Champ | Valeur |
| --- | --- |
| **Statut** | 🟡 Proposed |
| **Livré** | Handlers granulaires `on{NS}{Event}Event` livrés (ADR-14) ; `any` émis par le Channel mais consommé par personne ; selectors ⏳ |
| **Spec** | [5-rendu.md §7](../spec/5-rendu.md) |

## Contexte

Deux mécanismes de réaction de la View aux données coexistent dans le corpus,
sans qu'aucun ADR n'ait tranché leur articulation :

- **Livré** : la View déclare `features[ns].listens` et reçoit chaque Event
  dans un handler dédié `on{NS}{Event}Event(payload)` (ADR-14). Adapté au N1.
- **Cible des templates** (ADR-22) : la View s'abonne à l'événement `any` de
  chaque Channel écouté ; le framework passe à chaque `select(data)` le state
  **complet** de chaque namespace (`data.cart`, `data.local`), par référence
  gelée, et saute la projection si la sortie est `shallowEqual`.

La cible pose deux problèmes non résolus :

1. Un même Event va-t-il au handler granulaire **et** aux selectors ? Dans quel ordre ? L'un peut-il désactiver l'autre ?
2. Le selector reçoit le state de l'Entity, alors que le Channel l'ignore par construction et que la View n'a pas d'accès Entity (I6, I80). Par quel chemin passe-t-il ?

## Options en présence

**A — Deux mécanismes complémentaires.** Handlers pour le N1 et les effets
ponctuels, selectors pour les templates. Les handlers passent d'abord, puis
une seule passe de projection par Event. Reste à définir comment le state
atteint le selector (piste : la Feature l'expose elle-même, jamais le Channel).

**B — Selectors seuls.** Les handlers granulaires disparaissent ; le N1 lui
aussi passe par `select`. Un seul modèle, mais on perd la vérification
compile-time par Event (I82) et on reprend le contrat livré.

**C — Handlers seuls.** Pas de `any` ni de state complet : un template se
projette depuis le payload de l'Event et, au besoin, une Request explicite.
Cohérent avec I80, mais le filtre/tri doit reconstituer le state à la main.

## Critères (non actés)

- Préserver I80 (Channel privé derrière la Feature) et I82 (handlers imposés au compile-time).
- Une seule passe de projection par Event, déterministe.
- Coût : pas de copie du state (la référence gelée d'Immer est gratuite).

## Conséquences

À rédiger à la décision. En attendant, `5-rendu.md` §7 décrit le mécanisme
`any` + selectors sans trancher ces deux points : il n'est pas normatif sur eux.
