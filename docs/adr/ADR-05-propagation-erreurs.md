# ADR-05 — Propagation des erreurs

| Champ | Valeur |
| --- | --- |
| **Statut** | 🟢 Accepted |
| **Livré** | ⚠️ partiel — hiérarchie `BonsaiError` et isolation Broadcast/Listener livrées ; `CommandError`, `RequestError`, `RenderError`, `BehaviorError` déclarées mais jamais levées ; `BonsaiNamespaceError` et les `Error` de View/Application/Foundation hors hiérarchie ; metas absentes |
| **Spec** | [erreurs.md](../spec/2-architecture/erreurs.md) |

## Contexte

Une exception peut naître à chaque étage : recipe de mutation, handler de
Command, replier, handler de notification Entity, listener d'Event, rendu. Sans
règle, soit une erreur locale abat toute la chorégraphie, soit elle disparaît
silencieusement. Il faut décider, par catégorie, si l'état est préservé, si
l'exécution continue et qui est prévenu.

## Décision

Toutes les erreurs framework dérivent de `BonsaiError(message, invariantId, component, suggestion)`.
Le message est préfixé par l'identifiant violé (`[I10] cart — …`) et suivi d'une
suggestion actionnable.

| Erreur | Origine | État | Suite | Remontée |
| --- | --- | --- | --- | --- |
| `MutationError` | recipe `mutate()` throw | **rollback** Immer, intact | arrêt | throw à l'appelant |
| `EntityReentrancyError` | profondeur de ré-entrance dépassée (ADR-10) | intact | arrêt | throw à l'appelant externe |
| `CommandError` | `on{X}Command` throw | non muté | arrêt | throw |
| `BroadcastError` | `on{Key}EntityUpdated` / `onAnyEntityUpdated` throw | **conservé** (la mutation a réussi) | handlers suivants exécutés | log |
| `ListenerError` | listener d'Event throw | — | listeners suivants exécutés | log |
| _(replier throw)_ | `on{X}Request` throw | — | `null` au demandeur (ADR-02) | log + `ErrorReporter` (ADR-03) |
| `NoHandlerError` | `trigger()` sans handler | — | arrêt | throw |
| `DuplicateHandlerError` | double `handle`/`reply` | — | bootstrap échoue | throw |
| `RenderError` | projection ou template throw | — | isolée à la View | boundary |
| `BehaviorError` | Behavior throw | — | View hôte continue | log |

**Principe clé** : on sépare la **mutation** (échec : rien n'a changé, l'appelant
doit savoir) du **broadcast** (échec : l'état est juste, seule une réaction a
échoué, on isole et on continue).

Cible : chaque erreur porte les metas du message fautif (ADR-04).

## Alternatives rejetées

- **Tout propager** — un handler d'analytics défaillant annulerait une mutation réussie.
- **Tout isoler et logger** — un échec de mutation deviendrait invisible pour l'appelant.
- **Type `Result<T>` sur toutes les APIs** — verbosité sans bénéfice, pour un framework dont les chemins nominaux sont synchrones.

## Conséquences

- ⚠️ Aujourd'hui une exception dans `on{X}Command` remonte **brute** (non enveloppée en `CommandError`) jusqu'au `trigger()`, donc jusqu'au handler DOM de la View. Un handler `async` qui rejette produit une promesse rejetée non observée.
- ⚠️ **Hors hiérarchie** : `BonsaiNamespaceError` (`@bonsai/feature`, code stable `NAMESPACE_*` / `FEATURE_*`) étend `Error`, pas `BonsaiError`, et n'a pas d'`invariantId`. `Application`, `Foundation` et `View` lèvent des `Error` simples au préfixe `[Bonsai …]` (double `start()`, Foundation absente, `attach()` répété, handler DOM/Channel manquant au `mount()`, `getUI()` sur clé inconnue). Le principe « toutes les erreurs framework dérivent de `BonsaiError` » n'est donc tenu que pour Entity, Channel et l'invariant I96.
- L'`invariantId` sert de code stable pour les tests et le monitoring.
