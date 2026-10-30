# 📖 Documentation Bonsai

> Point d'entrée de la documentation technique du framework Bonsai.

## 📁 Structure

```text
docs/
├── theorie.md    ← Théorie : vocabulaire, axiomes, garanties, décisions, rôles (fait autorité)
├── theorie-explication-pedagogique.md ← Guide d'initiation à la théorie (non normatif)
├── tracabilite.md ← Matrice de traçabilité, générée depuis la théorie
├── gardes.md     ← Table de conformité : chaque obligation, sa garde et son test
├── adaptateurs/  ← Fiches des adaptateurs de l'hôte navigateur (annexe B de la théorie)
├── rapports/     ← Rapports de travail sur la théorie : audits, registre, écarts (non normatifs)
├── invariants/   ← Registre des invariants : les RÈGLES, leur état et leur pourquoi (source de vérité)
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

| Document | Rôle |
| --- | --- |
| [theorie.md](theorie.md) | Termes, axiomes A0–A5, garanties G1–G7, conséquences, objectifs, décisions D1–D18, rôles, gardes, annexes |
| [theorie-explication-pedagogique.md](theorie-explication-pedagogique.md) | Guide d'initiation, avec un exemple de boutique filé de bout en bout |
| [tracabilite.md](tracabilite.md) | Chaque élément de la théorie : catégorie, statut, dépendances, justification |
| [gardes.md](gardes.md) | Chaque obligation du code applicatif : niveau de garde, invariants, test |
| [adaptateurs/](adaptateurs/README.md) | Les treize adaptateurs de l'hôte navigateur, en fiches de 30 rubriques |
| [rapports/](rapports/) | Audit du noyau (V0.7), gardes (V0.9.1), registre rattaché, écarts du dépôt, audit de cohérence (V0.9.2) |

## 📐 Spécification — [spec/](spec/README.md)

Source de vérité des contrats. Organisée par chapitres :

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

34 ADR **vivants** (30–80 lignes), groupés en 7 chapitres : communication et
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
| **Spec** (`spec/`) | Le quoi : contrats normatifs | Vivante |
| **ADR** | Le pourquoi : une décision, ses alternatives rejetées | **Vivant** : réécrit en place, git garde l'historique ([ADR-32](adr/ADR-32-tests-preuve-architecture.md), [ADR-34](adr/ADR-34-documentation-francais.md)) |
| **Guide** | Le comment : mode d'emploi | Vivant |
| **Roadmap** | Pistes non décidées ou hors v1 | Une piste devient un ADR quand on la travaille |
| **Archive** | Mémoire | Figée, non normative |

Le français est la langue source ; les traductions sont suffixées `-EN.md` (ADR-34).
