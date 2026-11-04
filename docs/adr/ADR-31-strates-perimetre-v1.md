# ADR-31 — Strates d'implémentation et périmètre v1 gelé

| Champ | Valeur |
| --- | --- |
| **Statut** | 🟢 Accepted |
| **Livré** | Strate 0 ✅ (gate E2E vert) · 1a ✅ · 1b ⚠️ (borne causale, échec par unité et contexte causal exposé par `ctx.cause` livrés, ADR-04 ✅ ; reste ADR-05 : hiérarchie `BonsaiError` et hook `onError`) · 1c ⏳ · 1d ⚠️ (composition par clé, `View.composers` et cascade livrées au lot M6.2 ; gate ⏳) · strate 2 ⏳, sauf le Router (ADR-13) — pas encore de test gate strate 1 |
| **Spec** | [TESTING.md](../guides/TESTING.md) · [CHANGELOG.md](../../CHANGELOG.md) |

## Contexte

Le contrat v1 couvre une dizaine de composants et trois points durs identifiés :
ré-entrance de l'Entity, `localState` dual N1/N2-N3, composition N instances
avec cascade de destruction. Tout livrer d'un coup ne montre aucun bug
d'interaction avant la fin ; livrer couche par couche ne permet aucun test
de bout en bout visible. Et sans liste fermée, le périmètre dérive.

## Décision

**Phasage kernel-first en strates de profondeur croissante.** Chaque strate se
termine par un **test E2E gate** qui traverse le framework sans mock ; on ne
commence pas la strate N+1 sans suite verte sur la strate N.

| Strate | Contenu | Gate E2E |
| --- | --- | --- |
| **0** — kernel | Channels (Commands, Events, Queries), Entity, Feature, View N1, Composer, Foundation, Application ; depuis M6 sur le noyau (`Root`) | `strate-0.cart-round-trip` : clic → Command → mutation → Event → projection |
| **1a** | Entity : patches, handlers par clé, ré-entrance bornée (ADR-10) | — |
| **1b** | Metas causales (ADR-04), anti-boucle, isolation des erreurs (ADR-05) | — |
| **1c** | Rendu PDR : templates N2/N3, selectors (ADR-22, ADR-26) | — |
| **1d** | Composer N instances, `View.composers`, cascade (ADR-18) | chorégraphie multi-Features avec metas traçables + N instances |
| **2** | `localState` (2a), Behavior (2b), hydratation SSR et DevTools (2c) | `localState` dual avec Behavior |

1a et 1b sont indépendantes ; 1c dépend de 1b, 1d de 1c.

**Périmètre v1 = strates 0 + 1 + 2**, et rien d'autre. **Exclus de v1** :
`VirtualizedList` (ADR-23), FormBehavior complet (ADR-25), mode ESM et
`BonsaiRegistry` (ADR-27), helpers de test publics, event sourcing, extensions
de Foundation, plateforme et plugins, time-travel, extension navigateur,
rendu serveur Node. Ces sujets vont dans la [roadmap](../ROADMAP.md) ; ajouter
un élément à la v1 passe par une révision de cet ADR.

## Alternatives rejetées

- **Big bang** — aucun retour sur les points durs avant la fin.
- **Phasage par couche (abstraite puis concrète)** — la couche abstraite seule n'a rien de visible à tester de bout en bout.
- **Périmètre ouvert (« tout ADR Accepted est v1 »)** — pas de date de fin.
- **Liste restreinte au kernel** — une v1 sans rendu PDR ni composition ne valide pas l'architecture.

## Conséquences

- Chaque point dur est isolé dans une sous-strate testable seule.
- Le noyau d'exécution (lots M1 à M6, théorie V0.9.5) a été livré hors strate : il refond les strates 0 et 1a sur la racine (`Root`), remplace la file de ré-entrance de l'Entity par la file différée, et avance une partie des strates 1b, 1d et 2 (Router).
- Les ADR ⏳ restent valides : leur ligne **Livré** indique la strate visée.
- Jalons de version : fin de strate = MINOR (ADR-33).
