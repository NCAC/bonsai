# Modele d'erreurs et semantiques operationnelles

> **Categories d'erreurs, propagation, diagnostics, position SSR v1**

[← Retour a l'architecture](README.md) · [← Metas](metas.md)

---

> **Contrat complet** (hierarchie `BonsaiError`, matrice de comportement, recovery hooks)
> → voir la Feature ([feature.md](../3-couche-abstraite/feature.md)).
> **Modes de validation** (`invariant()`, `warning()`, `__DEV__`)
> → voir [validation.md](../6-transversal/validation.md).
> **Decisions sources** : [ADR-0002](../../adr/ADR-0002-error-propagation-strategy.md), [ADR-0004](../../adr/ADR-0004-validation-modes.md).

---

> ### ⏳ Périmètre d'implémentation (ADR-0028)
>
> Ce document décrit le **contrat cible** des erreurs. Les éléments suivants ne sont **pas encore implémentés** :
>
> | Élément | Strate cible | Sections concernées |
> | ------- | ------------ | ------------------- |
> | Isolation et journalisation contextuelle des exceptions de handlers Command (contexte causal) | Strate 1b | §2 (Principe 3), §3 |
> | Rejet anti-boucle `hop > maxHops` | Strate 1b | §2 (Principe 5) |
> | `ErrorReporter` transversal | Strate 1 | §3 |
>
> **Périmètre effectif livré** : hiérarchie `BonsaiError` (`@bonsai/error`) avec `invariantId`, `component` et `suggestion` ; `MutationError` et `EntityReentrancyError` (strate 1a) ; isolation des handlers Entity (`BroadcastError` loguée, I96) et des listeners Event (`ListenerError` loguée) ; `NoHandlerError` et `DuplicateHandlerError` levées par le Channel ; `BonsaiNamespaceError` au bootstrap. `CommandError`, `RequestError`, `RenderError` et `BehaviorError` sont définies mais **jamais levées**.

## 1. Categories d'erreurs

Bonsai distingue quatre categories d'erreurs selon leur origine et leur moment de detection :

| Categorie | Detection | Responsable | Exemples |
|-----------|-----------|-------------|---------|
| **Erreur de contrat** | Compile-time | TypeScript | Command sans handler (`implements TFeatureCallbacks` echoue avec TS2515), payload mal type, `emit` sur une cle absente de `TChannel['events']` |
| **Erreur de cablage** | Bootstrap (`app.start()`) | Framework | Namespace duplique (TS1117, compile-time), reference `listens`/`queries` a un namespace inconnu (`BonsaiNamespaceError`, Phase 0c) |
| **Violation d'invariant** | Bootstrap ou runtime | Framework | Double handler Command/Request (I10, `DuplicateHandlerError`), namespace invalide (I21, `BonsaiNamespaceError`) ; `hop > maxHops` (I9) est ⏳ cible strate 1b, non livre |
| **Erreur applicative** | Runtime | Feature / developpeur | Exception dans `onXxxCommand` (⚠️ propage aujourd'hui a l'appelant, l'isolation est cible strate 1b — cf. Principe 3), `reply()` manquant (`request()` retourne `null`, pas de timeout — `request()` est synchrone, ADR-0023) |

---

## 2. Principes de propagation

### Principe 1 — Priorite au compile-time

Toute violation detectable sans execution DOIT etre une erreur TypeScript.
Le framework fournit des types utilitaires (`TCommandCallbacks`, `TRequestCallbacks`,
`TListenCallbacks`, composes en `TFeatureCallbacks` — ADR-0046, `packages/feature/src/types.ts`)
qui garantissent mecaniquement la presence des handlers obligatoires avant la premiere execution.

### Principe 2 — Bootstrap fatal pour les violations structurelles

Les violations d'invariant detectees au bootstrap (I21, I22, I33, I43...) sont **fatales** :
elles bloquent le demarrage avec un message structure incluant le nom de l'invariant viole.
Un bootstrap reussi garantit la coherence initiale du systeme — pas de demi-demarrage.

### Principe 3 — Isolation des erreurs applicatives ⏳ partiellement cible

Ce principe est **livre pour les listeners Event et les handlers Entity**,
**pas encore pour les Command handlers** :
- `onXxxEvent` (Channel.listen) : une exception est capturee, une
  `ListenerError` est logguee, les autres listeners continuent — **livre**.
- `on<Key>EntityUpdated`/`onAnyEntityUpdated` : une exception est capturee,
  une `BroadcastError` est logguee, la notification continue (I96) — **livre**.
- `onXxxCommand` : une exception **n'est pas capturee** — elle propage a
  travers `Channel.trigger()` jusqu'a l'appelant (typiquement une View).
  `CommandError` est definie (`@bonsai/error`) mais **jamais levee**.
  L'isolation des Command handlers est **cible strate 1b**, cf. le bandeau
  de perimetre en tete de document et
  [feature.md §8.7.2](../3-couche-abstraite/feature.md).

Le detail de la strategie cible est dans [ADR-0002](../../adr/ADR-0002-error-propagation-strategy.md).

### Principe 4 — Request sans replier → `null`, sans exception

Un `request()` sans `reply()` enregistre retourne `null` — **livre**, mais
sans notion de delai/timeout : `request()` est **synchrone** (ADR-0023, I29),
le replier lit l'etat de son Entity deja en memoire, aucune notion de
"delai configure" n'a de sens. Si le replier leve une exception, `null` est
egalement retourne, avec un `console.error` (pas de `RequestError` levee).
Le detail est dans [ADR-0003](../../adr/ADR-0003-channel-runtime-semantics.md)
et [ADR-0023](../../adr/ADR-0023-request-reply-sync-vs-async.md).

### Principe 5 — Anti-boucle causale → rejet explicite ⏳ cible strate 1b, non livre

Un message dont `hop > maxHops` serait rejete avec une erreur structuree
incluant l'integralite de la chaine causale (tous les messageIds, correlation,
hop count). **Aucune notion de `hop` n'existe dans le code livre** — ce
principe decrit le contrat cible d'I9, pas un comportement actuel.

---

## 3. Principe de diagnostics

> **Un framework aussi contraignant que Bonsai ne peut tenir ses promesses qu'avec
> des diagnostics impeccables. La rigueur des invariants impose une egale rigueur
> dans les messages d'erreur.**

Chaque erreur emise par le framework DOIT fournir :
- **Identifiant de l'invariant** ou de l'ADR viole (ex: `[I9]`, `[ADR-0002]`)
- **Composant concerne** : namespace, nom de la classe, nom de la methode
- **Contexte causal** : correlationId, causationId, hop au moment de l'erreur (si applicable)
- **Suggestion actionnable** : quoi corriger et vers quel document se referer

> Les [DevTools](../devtools.md) documentent les hooks d'observabilite permettant
> de visualiser les erreurs dans leur contexte graphe causal complet (Event Ledger,
> trace de messages). Ces outils sont consideres **prioritaires** pour v1.

---

## 4. Strategie SSR / hydratation — position v1

> **Position explicite** : Bonsai **supporte partiellement** le SSR en v1.

| Aspect | Position v1 |
|--------|------------|
| **Reutilisation du DOM existant (hydratation)** | Supporte — si le `rootElement` d'une View existe dans le DOM au moment de `onAttach()`, le framework le reutilise (D28, D30, I31). |
| **Rendu serveur (generation HTML cote serveur)** | Hors scope v1 — le framework ne fournit pas de moteur de rendu Node.js en v1. |
| **Reconciliation DOM modifie hors framework** | Non garanti — le DOM doit correspondre a ce que le framework attend (selectors `uiElements` resolvables). Tout ecart peut causer des erreurs bootstrap ou des incoherences de projection. |
| **Streaming / progressive rendering** | Hors scope v1. |

> La doctrine SSR complete et la strategie de reconciliation seront formalisees
> dans le document [rendu avance](../5-rendu.md) une fois le compilateur PDR stabilise.
> Voir aussi [ADR-0014](../../adr/ADR-0014-ssr-hydration-strategy.md).

---

## Lecture suivante

→ [Couche abstraite](../3-couche-abstraite/README.md) — Feature, Entity, Application, Router
