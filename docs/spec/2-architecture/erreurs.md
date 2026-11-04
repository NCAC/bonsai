# Modèle d'erreurs et sémantiques opérationnelles

> 🟢 **Aligné sur la théorie V0.9.5 et sur le code livré (noyau M1 à M5, lot M6, 4 novembre 2026).** Les écarts restants sont listés au §5. En cas d'écart, la [théorie](../../theorie.md) prévaut ([règle de confiance](../../README.md#règle-de-confiance-et-dalignement)).

> **Catégories d'erreurs, frontière de l'unité de validation, diagnostics, position SSR v1**

[← Retour à l'architecture](README.md) · [← Metas](metas.md)

---

> **Décisions sources** : [ADR-05](../../adr/ADR-05-propagation-erreurs.md) (l'unité de validation comme frontière), [ADR-06](../../adr/ADR-06-modes-validation.md) (`invariant()`, `warning()`, `__DEV__`, voir [validation.md](../6-transversal/validation.md)) ; théorie G7, O2, C.3.

---

## 1. Catégories d'erreurs

| Catégorie | Détection | Erreur | Exemples |
| --- | --- | --- | --- |
| **Erreur de contrat** | Compile-time | TypeScript | Command sans handler (`implements TFeatureCallbacks`), payload mal typé, `emit` d'une clé absente de `events`, `ctx.trigger` d'une clé non déclarée dans `features` |
| **Erreur de Manifest** | `app.start()`, avant toute création | `BonsaiNamespaceError` (avec `code`), `ManifestError` | Namespace invalide ou réservé, `static channel` absent ou incohérent (phase 0a), `listens`/`queries` vers un namespace inconnu (phase 0c), cycle de dépendances initiales (C.1) |
| **Échec au démarrage** | Unité de démarrage | `StartupError` | `onInit` qui lève, Query initiale vers une cible encore en initialisation |
| **Échec d'une unité** | Pendant un traitement | l'erreur levée, `TransportError` (code stable), `InvariantError` | Handler ou recette qui lève, refus du noyau (`UNKNOWN_TARGET`, `NOT_AUTHORIZED`, `CAUSAL_BOUND`, `READ_ONLY`…), invariant d'Entity violé en fin d'unité |
| **Échec d'un effet** | Après validation, sur l'hôte | consigné dans la trace | Slot introuvable, élément d'interface absent de la part |

---

## 2. Principes de propagation

### Principe 1 — Priorité au compile-time

Toute violation détectable sans exécution DOIT être une erreur TypeScript. Les types `TFeatureCallbacks` (ADR-09) et `TViewCallbacks` (ADR-14) rendent obligatoires les handlers dérivés du contrat ; les clés de `trigger`, `query` et `emit` sont des unions dérivées des déclarations.

### Principe 2 — Manifest fatal, démarrage tout ou rien

Un Manifest invalide fait lever `start()` avant la création de la racine : rien n'est créé. Un échec pendant l'unité de démarrage abandonne le modèle en construction (`StartupError`) ; les messages produits au démarrage ne sont jamais délivrés. Pas de demi-démarrage.

### Principe 3 — Une erreur fait échouer son unité, et seulement elle (G7)

Chaque traitement (Command, Event, notification d'Entity, fait du DOM, démarrage) s'exécute dans une unité de validation. Si l'unité échoue :

- l'état journalisé est restauré (mutations d'Entity, créations et destructions, abonnements) ;
- ses messages différés sont abandonnés ;
- ses effets préparés ne sont pas engagés ;
- les autres délivrances continuent : un abonné défaillant n'annule ni l'émetteur, déjà validé, ni les autres abonnés.

Un échec n'est pas une réponse : une Command dont le handler lève est refusée ; un Event est un fait qu'aucun abonné ne peut refuser (I27). Une notification d'Entity qui lève fait échouer sa propre unité ; la mutation, déjà validée, reste.

### Principe 4 — Une Query en échec n'est pas récupérable

Une Query est synchrone (G5) et retourne la valeur du handler, jamais un `null` de substitution. Si elle est refusée (cible inconnue, active ou non prête, borne causale) ou si son handler lève, l'erreur interrompt l'auteur et fait échouer son unité. Un `try/catch` autour de `ctx.query` ne sauve rien : l'unité échoue quand même (`UNRECOVERABLE`). L'échec est écrit dans la trace avec le contexte causal de l'auteur (I65).

### Principe 5 — Borne causale : refus explicite (D9)

Un message dont la profondeur causale dépasserait `causalBound` (option de l'Application, 50 par défaut) est refusé à la soumission (`CAUSAL_BOUND`) : l'unité qui le soumet échoue. Un Event refusé ne réserve aucun abonné ; toutes les branches d'un Event ont la même profondeur.

### Principe 6 — Un effet engagé n'est pas annulé

Les effets (projections, matérialisations, retraits) sont engagés après validation, dans l'ordre (C.3). L'échec synchrone d'un effet ferme sa ressource : les effets suivants sur la même ressource ne sont pas tentés, ceux des autres ressources continuent. La validation interne n'est pas révoquée, l'hôte n'est pas restauré.

---

## 3. Diagnostics

> **Un framework aussi contraignant que Bonsai ne peut tenir ses promesses qu'avec
> des diagnostics impeccables.**

| Canal | Contenu |
| --- | --- |
| **Trace de la racine** (`app.root.trace`) | `delivered`, `unit-failed` {owner, context, error}, `delivery-abandoned`, `admission-abandoned`, `effects`, `restitution`, `long-unit`, `long-drain` : les entrées d'un traitement portent son contexte causal (G8) |
| **Console en développement** (`reportToConsole`, O2) | Les échecs que personne ne reçoit ; c'est la sortie par défaut de l'option `onTrace` |
| **Message d'erreur** | Code stable (`TransportError.code`), composant concerné, référence à la théorie (`(A3.e)`, `(D18)`…) |

L'option `onTrace` de l'Application remplace la sortie par défaut par un récepteur propre, ou la supprime. Les [DevTools](../devtools.md) (strate 2) s'appuieront sur la même trace.

---

## 4. SSR et hydratation — position v1

| Aspect | Position v1 |
| --- | --- |
| **Slots** | Un slot désigne un élément existant de l'ancre ou du template de la View : il est réutilisé, jamais recréé |
| **Part d'une View** | Toujours un élément créé par le noyau (`<div data-bonsai-part>`) et rempli par le `template` ; un DOM pré-rendu n'est pas adopté (⏳ strate 1c, [ADR-24](../../adr/ADR-24-hydratation-ssr.md)) |
| **Rendu serveur** | Hors scope v1 |
| **DOM modifié hors framework** | Non garanti : un élément d'interface absent fait échouer sa projection (effet), pas l'unité |
| **Streaming** | Hors scope v1 |

La doctrine de rendu complète est dans [5-rendu.md](../5-rendu.md) (cible strate 1c).

---

## 5. Écarts connus

- La hiérarchie `BonsaiError` (`@bonsai/error`) n'est levée que par `hardInvariant` ; ses autres classes (`CommandError`, `RequestError`, `ListenerError`…) sont déclarées mais jamais levées, et les erreurs du noyau (`TransportError`, `StartupError`, `InvariantError`, `ManifestError`) n'en dérivent pas ([ADR-05](../../adr/ADR-05-propagation-erreurs.md), à décider).
- Pas d'`ErrorReporter` injectable ni de hook `onError()` : la trace et `onTrace` en tiennent lieu ([ADR-03](../../adr/ADR-03-channel-runtime.md)).
- Le contexte causal est joint aux erreurs du noyau (`TransportError`, `InvariantError` : champ `context`, l'erreur la plus interne gardant le sien) ; une `Error` levée par le code applicatif n'est pas modifiée, son contexte est dans l'entrée `unit-failed` de la trace ([ADR-04](../../adr/ADR-04-metas-explicites.md)).

---

## Lecture suivante

→ [Couche abstraite](../3-couche-abstraite/README.md) — Feature, Entity, Application, Router
