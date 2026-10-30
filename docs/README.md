# 📖 Documentation Bonsai

> Point d'entrée de la documentation technique du framework Bonsai.

## 📁 Structure

```text
docs/
├── theorie.md    ← Théorie : vocabulaire, axiomes, garanties, décisions, rôles (fait autorité)
├── theorie-explication-pedagogique.md ← Guide d'initiation à la théorie (non normatif)
├── tracabilite.md ← Index de traçabilité V0.9.5, aligné sur la théorie
├── gardes.md     ← Table de conformité : obligations, gardes et scénarios requis
├── adaptateurs/  ← Fiches des adaptateurs de l'hôte navigateur (annexe B de la théorie)
├── rapports/     ← Rapports de travail sur la théorie : audits, registre, écarts (non normatifs)
├── invariants/   ← Registre opérationnel des règles, états et justifications (subordonné à la théorie)
├── spec/          ← Spécification : le QUOI (contrats, signatures, invariants)
├── adr/          ← Décisions : le POURQUOI (ADR-01 à ADR-34)
├── guides/       ← Conventions et mode d'emploi : le COMMENT
├── ROADMAP.md    ← Pistes post-v1 (ce qui n'est pas décidé ou pas dans la v1)
├── GENESIS.md    ← L'histoire du projet
├── pugx/         ← Sous-projet PugX (WIP)
└── archive/      ← Mémoire, non normative
    ├── adr-v0/        ← anciens ADR-0001…0047 et journal D1–D48, table de correspondance
    ├── analyses/      ← audits et analyses ponctuelles
    └── explorations/  ← notes de réflexion brutes
```

## 🌱 Théorie — [theorie.md](theorie.md)

La théorie fait autorité sur la spécification, les ADR et le registre : en cas d'écart, ce sont eux qui se corrigent.

### Règle de confiance et d’alignement

**Tout le corpus actif, les contrats TypeScript, les tests, le code et les artefacts générés doivent correspondre au corps théorique validé.** Leur existence, leur ancienneté, un statut Accepted/Tested ou une suite de tests verte ne peuvent justifier une exception à la théorie.

| Niveau | Responsabilité | Traitement d’un écart |
| --- | --- | --- |
| Théorie validée | Source normative de confiance ; fixe les obligations et les arbitrages déjà tranchés | Une évolution exige un amendement explicite et tracé de la théorie, jamais une dérogation implicite en aval. |
| Registre, spécification et ADR | Déclinent les obligations ; les ADR justifient les choix de réalisation restant compatibles | Corriger le document divergent ; un ADR ne remet pas en vote une obligation déjà fixée par la théorie. |
| Guides, tests, code et artefacts | Expliquent, vérifient ou réalisent les contrats | Corriger les instructions, assertions et mécanismes incompatibles ; régénérer les sorties depuis leur source. |
| Rapports historiques et archives | Conservent les faits et décisions de leur époque, sans autorité sur le contrat courant | Conserver leur contenu historique et expliciter leur portée ; ne pas les réécrire pour simuler un alignement passé. |

L’alignement est **obligatoire**, sa réalisation peut être **progressive** : tout écart restant doit être identifié et suivi, sans être présenté comme conforme. Une succession d’ADR trace le remplacement d’une ancienne décision ; elle n’est pas une autorisation préalable pour appliquer une obligation théorique déjà validée. Les choix réellement ouverts portent uniquement sur les mécanismes compatibles avec cette obligation.

| Document | Rôle |
| --- | --- |
| [theorie.md](theorie.md) | V0.9.5 : 55 termes, axiomes A0–A5, garanties G1–G8, conséquences, objectifs, décisions D1–D19 (D5 retirée), rôles, gardes, annexes A et B (navigateur) et C (protocole d’exécution) |
| [theorie-explication-pedagogique.md](theorie-explication-pedagogique.md) | Guide d'initiation, avec un exemple de boutique filé de bout en bout |
| [tracabilite.md](tracabilite.md) | Chaque élément de la théorie : catégorie, statut, dépendances, justification |
| [gardes.md](gardes.md) | Obligations, niveaux de garde, invariants et scénarios de conformité requis, dont P01–P20 ; aucune exécution de test présumée |
| [adaptateurs/](adaptateurs/README.md) | Les treize adaptateurs de l'hôte navigateur, en fiches de 30 rubriques |
| [rapports/](rapports/) | Audits et revues historiques, arbitrages V0.9.3 et suivi des vingt corrections V0.9.4 ; documents non normatifs |

Le socle documentaire courant est **V0.9.5 — 30 octobre 2026** : vocabulaire opérationnel défini et protocole d’exécution en annexe C, sans obligation ajoutée ni retirée, après le protocole du monde fermé (points R1 à R3 de la [relecture de fond V0.9.4](rapports/relecture-V0.9.4-2026-10-30.md)). Il conserve les [28 arbitrages V0.9.3](rapports/arbitrages-V0.9.3-2026-10-30.md) et intègre les réponses aux vingt constats de la [revue V0.9.3](rapports/revue-academique-architecture-V0.9.3-2026-10-30.md), détaillées dans le [suivi des corrections V0.9.4](rapports/corrections-V0.9.4-2026-10-30.md). Les constats, citations et notes des rapports historiques ne sont pas réévalués rétroactivement.

Les contrats transversaux précisent la disponibilité des Queries, la publication des états provisoires, les occurrences de vie, les résultats d’effets, la capture sans alias mutable et les réservations d’abonnements. La causalité garantie est **observable** : une notification non corrélable porte un antécédent inconnu, sans parent inventé ni permission de Command pour l’interface. D9 borne les segments connus, pas les boucles traversant une coupure d’observation.

Les contrats de la spécification, les ADR et le registre opérationnel restent soumis à la théorie ; leur alignement intégral, leurs vues générées et la livraison du runtime ne sont pas présumés réalisés par cette passe. Les scénarios prescrits ne sont pas déclarés exécutés ; aucune preuve formelle de consistance ni note automatique de 10/10 n’en découle. Les décisions des ADR Accepted ne sont pas réécrites par cet amendement : un changement de décision suit leur procédure de supersession. Le protocole général de clic ou déplacement du focus hors d’une View reste ouvert (18.30) ; sans admetteur déjà autorisé, le besoin n’est **pas pris en charge en V1**.

## 📐 Spécification — [spec/](spec/README.md)

Référence des contrats opérationnels, subordonnée à la théorie en cas d’écart. Organisée par chapitres :

| Chapitre | Contenu |
| --- | --- |
| [1. Philosophie](spec/1-philosophie.md) | Principes, frontières |
| [2. Architecture](spec/2-architecture/README.md) | Communication, state, metas, erreurs, lifecycle, distribution |
| [3. Couche abstraite](spec/3-couche-abstraite/README.md) | Application, Feature, Entity, Router |
| [4. Couche concrète](spec/4-couche-concrete/README.md) | Foundation, Composer, View, Behavior |
| [5. Rendu](spec/5-rendu.md) | PDR, templates, ProjectionList, hydratation |
| [6. Transversal](spec/6-transversal/conventions-typage.md) | Conventions de typage, validation, formulaires |
| [DevTools](spec/devtools.md) | Observabilité (🟡 brouillon) |
| [Référence](spec/reference/invariants.md) | [Invariants](spec/reference/invariants.md) · [Glossaire](spec/reference/glossaire.md) · [Anti-patterns](spec/reference/anti-patterns.md) · [Index des types](spec/reference/types-index.md) |

Les anciens identifiants `RFC-0001`…`RFC-0004` restent cités çà et là :
correspondance dans [spec/README.md](spec/README.md#anciens-identifiants-rfc-000x).

## 🧭 Décisions — [adr/](adr/README.md)

34 ADR répertoriés (30–80 lignes), groupés en 7 chapitres : communication et
runtime, couche abstraite, contrats typés, couche concrète, rendu,
distribution et build, processus. Chaque ADR porte une ligne **Livré**
(✅ / ⚠️ / ⏳) qui dit ce que le code implémente réellement.

## 📚 Guides — [guides/](guides/)

| Guide | Périmètre |
| --- | --- |
| [FRAMEWORK-STYLE-GUIDE.md](guides/FRAMEWORK-STYLE-GUIDE.md) | Code applicatif et framework : DOM, HTML, CSS, API TypeScript |
| [BUILD-CODING-STYLE.md](guides/BUILD-CODING-STYLE.md) | Pipeline de build (`lib/`, `tools/`) |
| [NAMESPACE-MENTAL-MODEL.md](guides/NAMESPACE-MENTAL-MODEL.md) | Les quatre lieux où vit le namespace d'une Feature (ADR-08) |
| [TESTING.md](guides/TESTING.md) | Organisation et écriture des tests (ADR-32) |
| [FORMS-GUIDE.md](guides/FORMS-GUIDE.md) | Formulaires : patterns B, C, D (ADR-25) |
| [INVARIANTS.md](guides/INVARIANTS.md) | Ajouter, modifier, fusionner, supprimer ou renuméroter un invariant |

## 🔎 Je veux…

| … | Je lis |
| --- | --- |
| découvrir la théorie | [Guide pédagogique](theorie-explication-pedagogique.md), puis [Théorie V0.9.5](theorie.md) |
| retrouver une obligation et ses contrôles requis | [Traçabilité](tracabilite.md), puis [Gardes](gardes.md) |
| comprendre les corrections de la dernière revue | [Suivi V0.9.4](rapports/corrections-V0.9.4-2026-10-30.md) |
| connaître les réserves avant gel de la théorie | [Relecture de fond V0.9.4](rapports/relecture-V0.9.4-2026-10-30.md) — propositions R1–R4, L1–L7, S1–S3, non appliquées |
| suivre la migration du registre et du code vers V0.9.4 | [Diagnostic, plan et lots appliqués](rapports/migration-invariants-runtime-V0.9.4-2026-10-30.md) — trois lots documentaires appliqués : Query/Composer, causalité/permissions, propriété/cycle de vie ; runtime non migré |
| comprendre l'architecture | [Philosophie](spec/1-philosophie.md), puis [Architecture](spec/2-architecture/README.md) |
| connaître les règles non négociables | [Arbre des invariants](invariants/generated/arbre.md) (registre) · [Invariants](spec/reference/invariants.md) (matrice détaillée) |
| connaître les règles et les écarts d'un composant | [Invariants par rôle](invariants/generated/roles/README.md) (vues générées) |
| ajouter ou modifier un invariant | [Guide des invariants](guides/INVARIANTS.md) |
| savoir pourquoi un choix a été fait | [ADR](adr/README.md) |
| savoir ce qui est réellement livré | la ligne **Livré** de chaque ADR · [ADR-31](adr/ADR-31-strates-perimetre-v1.md) (strates) |
| savoir ce qui viendra après la v1 | [ROADMAP](ROADMAP.md) |
| écrire une Feature ou une View | [FRAMEWORK-STYLE-GUIDE](guides/FRAMEWORK-STYLE-GUIDE.md) |
| retrouver un ancien ADR ou une décision `Dn` | [archive/adr-v0](archive/adr-v0/README.md) |

## 📏 Types de documents

| Type | Rôle | Évolution |
| --- | --- | --- |
| **Théorie** | Le socle normatif : vocabulaire, axiomes, garanties et décisions ; prévaut en cas d’écart | Versionnée ; amendements tracés dans les rapports datés |
| **Spec** (`spec/`) | Le quoi : contrats normatifs, sous l’autorité de la théorie | Vivante |
| **ADR** | Le pourquoi : une décision, ses alternatives rejetées | Suivi vivant des décisions et de leur livraison ; un changement de décision Accepted exige un ADR de supersession, pas une réécriture rétroactive |
| **Traçabilité et gardes** | Index des obligations, dépendances, contrôles et scénarios requis | Alignées sur la théorie, sans attester la conformité du runtime |
| **Guide** | Le comment : mode d'emploi | Vivant |
| **Rapport** | Revue, audit ou suivi daté ; ne fait pas autorité sur la théorie | Constats historiques conservés ; suites documentées séparément |
| **Roadmap** | Pistes non décidées ou hors v1 | Une piste devient un ADR quand on la travaille |
| **Archive** | Mémoire | Figée, non normative |

Le français est la langue source ; les traductions sont suffixées `-EN.md` (ADR-34).
