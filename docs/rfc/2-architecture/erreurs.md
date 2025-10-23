# Modele d'erreurs et semantiques operationnelles

> **Categories d'erreurs, propagation, diagnostics, position SSR v1**

[← Retour a l'architecture](README.md) · [← Metas](metas.md)

---

> **Contrat complet** (hierarchie `BonsaiError`, matrice de comportement, recovery hooks)
> → voir la Feature ([feature.md](../3-couche-abstraite/feature.md)).
> **Modes de validation** (`invariant()`, `warning()`, `__DEV__`)
> → voir les conventions transversales ([conventions-typage.md](../6-transversal/conventions-typage.md)).
> **Decisions sources** : [ADR-0002](../../adr/ADR-0002-error-propagation-strategy.md), [ADR-0004](../../adr/ADR-0004-validation-modes.md).

---

## 1. Categories d'erreurs

Bonsai distingue quatre categories d'erreurs selon leur origine et leur moment de detection :

| Categorie | Detection | Responsable | Exemples |
|-----------|-----------|-------------|---------|
| **Erreur de contrat** | Compile-time | TypeScript | Command sans handler (`implements` echoue), payload mal type, `emit` sur Channel inconnu |
| **Erreur de cablage** | Bootstrap (`app.start()`) | Framework | Namespace duplique, `onXXX` sans message declare, collision de cles UIMap |
| **Violation d'invariant** | Bootstrap ou runtime | Framework | `hop > maxHops` (I9), mutation inter-Feature (I6), double handler Command (I10) |
| **Erreur applicative** | Runtime | Feature / developpeur | Exception dans `onXxxCommand`, timeout de `request()`, `reply()` manquant |

---

## 2. Principes de propagation

### Principe 1 — Priorite au compile-time

Toute violation detectable sans execution DOIT etre une erreur TypeScript.
Le framework fournit des types utilitaires (`TRequiredCommandHandlers`, `TRequiredRequestHandlers`)
qui garantissent mecaniquement la presence des handlers obligatoires avant la premiere execution.

### Principe 2 — Bootstrap fatal pour les violations structurelles

Les violations d'invariant detectees au bootstrap (I21, I22, I33, I43...) sont **fatales** :
elles bloquent le demarrage avec un message structure incluant le nom de l'invariant viole.
Un bootstrap reussi garantit la coherence initiale du systeme — pas de demi-demarrage.

### Principe 3 — Isolation des erreurs applicatives

Une exception dans un handler (`onXxxCommand`, `onXxxEvent`) ne propage pas
aux autres listeners ni a l'emetteur. L'erreur est capturee, logguee avec son
contexte causal complet (correlationId, causationId, hop), et le systeme continue.
Le detail de la strategie d'isolation est dans [ADR-0002](../../adr/ADR-0002-error-propagation-strategy.md).

### Principe 4 — Request timeout → `null`, sans exception

Un `request()` sans `reply()` dans le delai configure retourne `null` (I55, D44).
Le consommateur ne recoit jamais d'exception non controlee pour un timeout.
Le detail (timeout configurable, comportement debug/prod) est dans [ADR-0003](../../adr/ADR-0003-channel-runtime-semantics.md).

### Principe 5 — Anti-boucle causale → rejet explicite

Un message dont `hop > maxHops` est rejete avec une erreur structuree incluant
l'integralite de la chaine causale (tous les messageIds, correlation, hop count).
Ce message d'erreur DOIT etre lisible par un humain et pointer vers I9.

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
