# Modèle d'erreurs et sémantiques opérationnelles

> 🟢 **Aligné sur la théorie V0.9.5 et sur le code livré (noyau M1 à M6, strate 1b — ADR-04 et ADR-05, 4 novembre 2026).** Les écarts restants sont listés au §5. En cas d'écart, la [théorie](../../theorie.md) prévaut ([règle de confiance](../../README.md#règle-de-confiance-et-dalignement)).

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
| **Échec d'une unité** | Pendant un traitement | l'erreur levée par le code applicatif (non modifiée), ou une `BonsaiError` : `TransportError`, `InvariantError`, erreur d'un composant | Handler ou recette qui lève, refus du noyau (`UNKNOWN_TARGET`, `NOT_AUTHORIZED`, `CAUSAL_BOUND`, `READ_ONLY`…), invariant d'Entity violé en fin d'unité |
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
| **Message d'erreur** | `[code] composant — message`, avec une référence à la théorie (`(A3.e)`, `(D18)`…) ; champs `code`, `component`, `suggestion`, `context` |

L'option `onTrace` de l'Application remplace la sortie par défaut par un récepteur propre, ou la supprime. C'est le récepteur unique des échecs : il n'y a ni hook `onError()` ni `ErrorReporter` (un traitement réagissant à un échec serait un message sans parent, G8 ; [ADR-05](../../adr/ADR-05-propagation-erreurs.md)). Une réaction métier à un échec passe par un fait admis, comme le résultat d'un effet (C.3). Les [DevTools](../devtools.md) (strate 2) s'appuieront sur la même trace.

### 3.1 `BonsaiError`, racine des erreurs du framework

Toute erreur levée par Bonsai dérive de `BonsaiError` (`@bonsai/error`) ; une erreur du code applicatif n'est jamais enveloppée ni modifiée. `instanceof BonsaiError` les distingue donc dans un récepteur `onTrace`.

| Champ | Contenu |
| --- | --- |
| `code` | Identifiant stable à comparer : code symbolique ou identifiant d'invariant (`I96`). Le renommer est un changement cassant. |
| `component` | Namespace ou nom du composant concerné, `""` sinon. |
| `suggestion` | Indication pour corriger, `""` sinon. |
| `context` | Contexte causal de l'unité ou de la Query où l'erreur est née, posé par le noyau ([ADR-04](../../adr/ADR-04-metas-explicites.md)) ; l'erreur la plus interne garde le sien ; absent hors unité. |
| `cause` | Propriété standard `Error.cause` : l'erreur rapportée (`UNRECOVERABLE`, `STARTUP_FAILED`). |

| Classe | Codes |
| --- | --- |
| `TransportError` (`@bonsai/kernel`) | `TTransportErrorCode` : `UNKNOWN_TARGET`, `UNDECLARED_MESSAGE`, `TARGET_NOT_READY`, `TARGET_ACTIVE`, `READ_ONLY`, `NOT_OWNER`, `CAUSAL_BOUND`, `NOT_CAPTURABLE`, `DUPLICATE_NAMESPACE`, `NO_UNIT`, `UNRECOVERABLE`, `PORTION_TAKEN`, `INVALID_DESIGNATION`, `HOST_NOT_FOUND`, `NOT_AUTHORIZED`, `ROOT_ABANDONED` |
| `InvariantError` (`@bonsai/kernel`) | `INVARIANT_VIOLATED` (champs `entity`, `invariant`) |
| `StartupError` (`@bonsai/kernel`) | `STARTUP_FAILED` (`cause` : l'erreur de l'unité de démarrage) |
| `ManifestError` (`@bonsai/kernel`) | `UNKNOWN_DEPENDENCY`, `CYCLIC_DEPENDENCIES` |
| `BonsaiNamespaceError` (`@bonsai/feature`) | `TBonsaiNamespaceErrorCode` (phases 0a–0c) |
| `BonsaiError` (composants) | `ALREADY_STARTED`, `MISSING_DOCUMENT`, `DUPLICATE_ADAPTER`, `MISSING_FEATURE` (Application) ; `NOT_STARTED` (Feature) ; `OUTSIDE_HANDLER` (Entity, View) ; `MALFORMED_KEY`, `UNKNOWN_UI_KEY`, `UI_ELEMENT_NOT_FOUND`, `MISSING_UI_ELEMENT`, `MISSING_HANDLER`, `UNDECLARED_DEFAULT_CANCEL`, `SLOT_KEY_COLLISION` (View) ; `DUPLICATE_KEY`, `UNKNOWN_VIEW` (Composer) ; `INVALID_LOCATION`, `HOST_UNAVAILABLE` (Router) ; `NOT_A_COMPONENT`, `NOT_MATERIALIZED`, `SLOT_NOT_UNIQUE` (noyau) ; identifiant d'invariant pour `invariant()`/`hardInvariant()` (`INVARIANT` par défaut) |

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

- `NAMESPACE_DUPLICATE` est déclaré dans `TBonsaiNamespaceErrorCode` mais n'est jamais levé (le manifest l'empêche à la compilation).
- Une erreur levée hors de toute unité (par exemple pendant la validation du Manifest ou `admit` d'un local non déclaré) ne porte pas de `context`.

---

## Lecture suivante

→ [Couche abstraite](../3-couche-abstraite/README.md) — Feature, Entity, Application, Router
