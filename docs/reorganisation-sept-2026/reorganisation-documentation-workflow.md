# RFC — Évolution de l’organisation documentaire de Bonsai

## Statut

Proposition

## Résumé

Remplacer progressivement le modèle centré sur :

- ADR
- Spécifications
- Invariants
- Tests

par un modèle reposant sur :

- Architecture vivante
- Contrats architecturaux
- Workbench de conception
- Snapshots de strate
- Preuves automatisées

L'objectif est de réduire la dette cognitive documentaire tout en conservant, voire renforçant, la robustesse architecturale.

---

## 1. Constat

Le modèle actuel apporte de nombreux bénéfices :

- historique détaillé des décisions ;
- formalisation des invariants ;
- traçabilité vers les tests ;
- compréhension des motivations.

Cependant, dans une phase de conception active comme celle de Bonsai, plusieurs difficultés apparaissent :

- accumulation des ADR ;
- ADR supersedés à répétition ;
- duplication entre ADR, spécifications et invariants ;
- difficulté à identifier rapidement l'état réel de l'architecture ;
- charge cognitive importante pour les contributeurs et les IA.

Le problème principal n'est pas la qualité des documents mais le nombre de représentations d'une même connaissance.

---

## 2. Principe directeur

> Documenter les contrats actuellement garantis plutôt que l’historique complet des décisions.

La robustesse doit principalement être assurée par :

- les types ;
- les tests ;
- les contraintes architecturales ;
- les quality gates.

La documentation doit décrire :

- ce qui est vrai aujourd'hui ;
- pourquoi c'est vrai ;
- comment cela est vérifié ;
- ce qui reste en exploration.

---

## 3. Structure documentaire cible

```text
docs/
├── architecture/
├── reference/
├── guides/
├── workbench/
├── history/
└── pugx/
```

---

## 4. Architecture vivante

### Objectif

Décrire l’architecture actuellement valide.

Cette documentation constitue l’unique source de vérité normative du projet.

```text
docs/architecture/
├── README.md
├── data-flow.md
├── application.md
├── foundation.md
├── composer.md
├── view.md
├── channel.md
├── feature.md
├── entity.md
└── behavior.md
```

---

## 5. Contrats architecturaux

Chaque composant expose des contrats.

Exemple :

```markdown
### FEA-001 — Une Feature possède exactement une Entity

Maturité : stable
Preuves : S, I

Description :
Une Feature est l'unique propriétaire de son Entity.

Tests :
- tests/unit/feature/entity-ownership.test.ts

Implémentation :
- packages/feature/src/Feature.ts
```

---

## 6. Identifiants des contrats

Les contrats utilisent des identifiants scopés par domaine.

### Préfixes

```text
ARC-001
APP-001
FND-001
COM-001
VIE-001
CHA-001
FEA-001
ENT-001
BEH-001
PUG-001
```

### Principes

- numérotation locale par domaine ;
- pas de compteur global ;
- lisibilité immédiate ;
- aucune collision possible.

---

## 7. Lois architecturales

Les principes transversaux sont regroupés dans :

```text
docs/architecture/README.md
```

Exemples :

```text
ARC-001 — Le flux métier est unidirectionnel.

ARC-002 — Le state métier n'est modifié que par une Feature.

ARC-003 — Une View ne contient aucune logique métier.

ARC-004 — Les contrats publics doivent être vérifiables statiquement autant que possible.
```

Ces lois représentent l'identité profonde de Bonsai.

---

## 8. Système de maturité

Chaque contrat possède un statut.

```text
exploratoire
    ↓
candidat
    ↓
stable
    ↓
déprécié
    ↓
retiré
```

### Exploratoire

L'idée est encore étudiée.

### Candidat

Le mécanisme existe mais peut encore évoluer.

### Stable

Contrat considéré comme normatif.

### Déprécié

Contrat encore supporté mais destiné à disparaître.

### Retiré

Contrat supprimé de l’architecture courante.

---

## 9. Système de preuves

Un contrat doit indiquer comment il est garanti.

### Types de preuves

```text
S = Vérification statique
U = Test unitaire
I = Test d'intégration
E = Test End-to-End
A = Test architectural
R = Revue humaine
```

Exemple :

```markdown
### ENT-003

Preuves : U, I
```

---

## 10. Traçabilité contrat ↔ test

Le mécanisme actuel basé sur :

```text
I<N>
```

est remplacé par les identifiants des contrats.

Exemple :

```typescript
describe('ENT-003 — mutation sans changement', () => {
});
```

ou

```typescript
describe.contract('ENT-003', () => {
});
```

---

## 11. Génération automatique de l'index

Les contrats restent définis dans leurs documents respectifs.

Un index global est généré automatiquement.

```text
docs/architecture/contracts.generated.md
```

Exemple :

```markdown
# Index des contrats

## Entity

- ENT-001
- ENT-002
- ENT-003

## Feature

- FEA-001
- FEA-002
```

Cet index n'est jamais modifié manuellement.

---

## 12. Vérification automatisée

Le script :

```text
check-adr-tested-status.ts
```

évolue vers :

```text
check-contract-coverage.ts
```

Responsabilités :

- détecter les contrats ;
- détecter les doublons ;
- vérifier les identifiants ;
- vérifier les références depuis les tests ;
- produire un rapport de couverture documentaire.

---

## 13. Workbench

## Objectif

Accueillir les sujets encore en conception.

```text
docs/workbench/
```

Exemples :

```text
rendering-strategies.md
feature-lifecycle.md
routing.md
```

Le workbench n'est pas normatif.

---

## 14. Journal transitoire de conception

Afin d'éviter la perte d'information entre deux snapshots :

```text
docs/workbench/decision-log.md
```

est introduit.

Exemple :

```markdown
## 2026-09-27

Décision provisoire :

- abandon de la numérotation globale des invariants ;
- adoption d'identifiants scopés.

Motivation :

- meilleure lisibilité ;
- meilleure maintenabilité.

Actions :

- réécrire le script de couverture ;
- migrer les références existantes.
```

Ce fichier est vidé à la fin de chaque strate.

---

## 15. Snapshots de stratégie

Un historique synthétique est conservé dans :

```text
docs/history/releases/
```

Exemple :

```text
strate-0.md
strate-1.md
v1.0.md
```

Chaque snapshot décrit :

- les contrats introduits ;
- les contrats retirés ;
- les changements majeurs ;
- les motivations importantes.

---

## 16. Place de Git

Git devient l'unique historique détaillé.

La documentation n'a plus vocation à reproduire :

- chaque hésitation ;
- chaque décision intermédiaire ;
- chaque reformulation.

Elle décrit uniquement :

- l'état courant ;
- les règles ;
- les preuves ;
- les évolutions majeures.

---

## 17. Sort des documents existants

### Architecture

Destination :

```text
docs/architecture/
```

Contient :

- composants ;
- flux ;
- contrats ;
- lois architecturales.

---

### Reference

Destination :

```text
docs/reference/
```

Contient :

```text
glossary.md
anti-patterns.md
```

Rôle :

- vocabulaire commun ;
- catalogue des erreurs de conception ;
- information de référence.

---

### Guides

Destination :

```text
docs/guides/
```

Rôle :

- documentation orientée tâche ;
- tutoriels ;
- procédures.

Exemples :

```text
Créer une Feature
Créer une View
Écrire un test
Créer un package
```

---

### PugX

Destination :

```text
docs/pugx/
```

Rôle :

- grammaire ;
- AST ;
- typage ;
- syntaxe ;
- spécifications du langage.

PugX reste un sous-système documentaire distinct.

---

### CONTRIBUTING.md

Conservé à la racine.

Il décrit :

```text
Problème
    ↓
Workbench
    ↓
Contrat candidat
    ↓
Preuves
    ↓
Contrat stable
```

---

### ROADMAP.md

Conservé à la racine.

Il décrit :

- les futures strates ;
- les objectifs ;
- les priorités.

---

### GENESIS.md

Deux options :

#### Option A

```text
GENESIS.md
```

à la racine.

#### Option B

```text
docs/project/genesis.md
```

si le document est principalement historique.

---

## 18. Processus de développement

```text
Problème
    ↓
Workbench
    ↓
Prototype
    ↓
Contrat candidat
    ↓
Tests
    ↓
Contrat stable
    ↓
Snapshot de strate
```

Ce processus remplace progressivement :

```text
RFC
    ↓
ADR
    ↓
Spécification
    ↓
Invariant
    ↓
Test
```

---

## 19. Résultat attendu

```text
Architecture vivante
    = vérité actuelle

Contrats
    = règles normatives

Workbench
    = expérimentation

Tests et types
    = preuves

Snapshots
    = mémoire synthétique

Git
    = historique détaillé
```

L'objectif final est de permettre à un humain ou à une IA de répondre rapidement aux questions suivantes :

- Que garantit Bonsai aujourd'hui ?
- Comment ces garanties sont-elles vérifiées ?
- Quelles idées sont encore en exploration ?
- Quels changements majeurs ont été introduits lors des dernières strates ?

sans devoir reconstituer l’architecture à partir d’une longue chaîne d’ADR successifs.
