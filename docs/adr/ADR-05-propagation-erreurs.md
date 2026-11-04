# ADR-05 — Propagation des erreurs : l'unité de validation comme frontière

| Champ | Valeur |
| --- | --- |
| **Statut** | 🟢 Accepted |
| **Livré** | ⚠️ partiel — échec par unité, rollback et trace livrés par `Root` · `BonsaiError` levée seulement par `hardInvariant` (I96) ; `MutationError`, `EntityReentrancyError`, `CommandError`, `RequestError`, `BroadcastError`, `ListenerError`, `NoHandlerError`, `DuplicateHandlerError`, `RenderError`, `BehaviorError` déclarées mais jamais levées · erreurs du noyau, `BonsaiNamespaceError` et `Error` des composants hors hiérarchie · les erreurs du noyau portent le contexte causal de leur unité (`context`, ADR-04) ; une `Error` applicative le trouve dans la trace |
| **Spec** | [erreurs.md](../spec/2-architecture/erreurs.md) · théorie G7, O2 |

## Contexte

Une exception peut naître à chaque étage : recette de mutation, handler de
Command ou d'Event, handler de Query, notification d'Entity, projection. Sans
règle, soit une erreur locale abat toute la chorégraphie, soit elle disparaît
silencieusement en laissant un traitement à moitié fait.

## Décision

**Une erreur fait échouer l'unité de validation où elle survient, et seulement
elle** (G7). L'unité restaure l'état qu'elle a modifié, abandonne ses créations
et ses messages différés, et n'engage aucun de ses effets.

| Erreur | Où | Effet |
| --- | --- | --- |
| Handler, recette ou invariant d'Entity qui échoue (`InvariantError`) | unité du handler | unité défaite ; les autres délivrances continuent |
| Refus de transport (`TransportError`, code stable) | unité de l'auteur | idem ; une Query en échec n'est pas récupérable (`UNRECOVERABLE`) |
| Notification d'Entity qui lève | sa propre unité | la mutation, déjà validée, reste |
| Échec au démarrage (`StartupError`) | unité de démarrage | la racine est abandonnée |
| Manifest invalide (`BonsaiNamespaceError`, `ManifestError`) | avant la racine | `start()` lève, rien n'est créé |
| Effet engagé qui échoue | hôte | la ressource visée est fermée, ses effets suivants non tentés (C.3) |

Tout échec est écrit dans la **trace** de la racine avec son contexte causal, que les erreurs du noyau portent aussi (`context`, ADR-04) ;
en développement, `reportToConsole` signale ceux que personne ne reçoit (O2).

Les erreurs de configuration du framework dérivent de
`BonsaiError(message, invariantId, component, suggestion)`, préfixées par
l'invariant violé (`[I96] cart — …`).

## Alternatives rejetées

- **Isoler les réactions et journaliser** (`BroadcastError`, `ListenerError`, `null` de Query, strate 0) — valide des traitements à moitié faits.
- **Tout propager jusqu'au fait de l'hôte** — un abonné défaillant annulerait l'émetteur, déjà validé.
- **Type `Result<T>` sur toutes les API** — une erreur de transport n'est pas une valeur métier.

## Conséquences

- Un handler n'a rien à rattraper : ne pas intercepter une erreur de Query, laisser l'unité échouer.
- Un effet déjà appliqué à l'hôte n'est pas annulé ; son échec revient par un nouveau message (G7).
- **À décider** : réduire la hiérarchie `BonsaiError` aux erreurs réellement levées, et y rattacher les erreurs du noyau et des composants.
- L'`ErrorReporter` injectable et le hook `onError()` restent à livrer (ADR-03).
