# 📖 Documentation Bonsai

> Point d'entrée de la documentation technique du framework Bonsai.

## 📁 Structure

```text
docs/
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

## 🔎 Je veux…

| … | Je lis |
| --- | --- |
| comprendre l'architecture | [Philosophie](spec/1-philosophie.md), puis [Architecture](spec/2-architecture/README.md) |
| connaître les règles non négociables | [Invariants](spec/reference/invariants.md) |
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
