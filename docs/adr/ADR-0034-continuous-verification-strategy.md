# ADR-0034 : Stratégie de vérification continue — Hooks locaux & CI GitHub Actions

> **Comment garantir à chaque commit et à chaque PR que le code Bonsai ne régresse pas — au niveau typage ET au niveau comportemental ?**

| Champ         | Valeur                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| **Statut**    | 🟢 Accepted                                                                                             |
| **Date**      | 2026-04-20                                                                                              |
| **Décideurs** | @NCAC                                                                                                   |
| **RFC liée**  | ADR-0028 (phasage), ADR-0030 (tests comme preuve), ADR-0006 (testing strategy), ADR-0033 (workflow Git) |

---

## 📋 Table des matières

1. [Contexte](#contexte)
2. [Contraintes](#contraintes)
3. [Décision — Deux niveaux de vérification](#décision--deux-niveaux-de-vérification)
4. [Niveau 1 — Hooks Husky (pre-commit)](#niveau-1--hooks-husky-pre-commit)
5. [Niveau 2 — CI GitHub Actions](#niveau-2--ci-github-actions)
6. [Gate de non-régression cumulative (Option A retenue)](#gate-de-non-régression-cumulative-option-a-retenue)
7. [Protocole d'ajout au fichier de régression](#protocole-dajout-au-fichier-de-régression)
8. [Conséquences](#conséquences)
9. [Actions de suivi](#actions-de-suivi)

---

## Contexte

### Le problème

Le framework Bonsai est implémenté par **strates** successives (ADR-0028). Chaque strate se compose de plusieurs Pull Requests, chaque PR apportant de nouveaux tests unitaires, d'intégration et/ou e2e.

Deux risques de régression existent :

1. **Régression de typage** : un refactoring casse la compilation sans qu'aucun test ne le détecte (les tests peuvent passer avec des `any` implicites)
2. **Régression comportementale** : un test précédemment vert casse à cause d'un changement dans une autre partie du code

### L'état existant au 2026-04-20

| Élément                            | État                                         | Problème                                |
| ---------------------------------- | -------------------------------------------- | --------------------------------------- |
| `.husky/pre-commit`                | Non exécutable (`-rw-r--r--`)                | Ne s'exécute jamais                     |
| `.husky/pre-commit` contenu        | `pnpm run test` (TOUS les tests)             | Trop lent pour un hook pre-commit       |
| `.husky/commit-msg`                | Non exécutable                               | Ne s'exécute jamais                     |
| `.husky/commit-msg` contenu        | Valide le format conventionnel               | Utilise `refacto` au lieu de `refactor` |
| `.husky/pre-push`                  | Non exécutable                               | Ne s'exécute jamais                     |
| `.husky/pre-push` contenu          | Merge `origin/develop` automatique           | Legacy, dangereux, non désiré           |
| `.husky/_/husky.sh`                | Shim Husky v8 déprécié                       | « WILL FAIL in v10.0.0 »                |
| `.devcontainer/scripts/`           | 13 scripts git-flow copiés d'un autre projet | Inutiles pré-v1 (ADR-0033)              |
| `post-create-command.sh`           | `npx husky install` (API v8)                 | Obsolète                                |
| `.github/workflows/regression.yml` | PR → `main`                                  | Devrait être PR → `develop` (ADR-0033)  |
| `package.json`                     | `test:regression` existe                     | ✅ OK                                   |

### Déclencheur

Implémentation de la strate 0 : chaque PR doit garantir que les PI précédents ne cassent pas.

---

## Contraintes

| #   | Contrainte                                                                                | Source             |
| --- | ----------------------------------------------------------------------------------------- | ------------------ |
| C1  | Compatible avec Jest (test runner en place)                                               | Existant           |
| C2  | Compatible avec le monorepo pnpm                                                          | Existant           |
| C3  | Le hook pre-commit DOIT s'exécuter en **< 30 secondes**                                   | DX                 |
| C4  | La CI DOIT exécuter **tous** les tests (unit + integration + e2e)                         | Qualité            |
| C5  | Compatible avec le workflow Git Flow adapté (ADR-0033) : PR → `develop`, release → `main` | ADR-0033           |
| C6  | Explicite et traçable (philosophie Bonsai)                                                | Core               |
| C7  | `tsc` comme première ligne de défense (« Compile-time > Runtime »)                        | Philosophie Bonsai |

---

## Décision — Deux niveaux de vérification

Nous adoptons une stratégie à **deux niveaux complémentaires** :

| Niveau                      | Déclencheur               | Vérifications                      | Temps cible | Bloquant ?                                     |
| --------------------------- | ------------------------- | ---------------------------------- | ----------- | ---------------------------------------------- |
| **1 — Pre-commit (Husky)**  | Chaque `git commit` local | `tsc --noEmit` + `test:regression` | < 30s       | Oui (local — contournable via `--no-verify`)   |
| **2 — CI (GitHub Actions)** | PR vers `develop`         | `tsc --noEmit` + `pnpm test:ci`    | < 3 min     | **Oui (branch protection — non-contournable)** |

### Justification

- **`tsc --noEmit` en pre-commit** : la vérification Bonsai par excellence. Un changement qui casse le typage est détecté _avant même_ d'écrire un message de commit. Coût : ~5-10s pour le monorepo.
- **`test:regression` en pre-commit** : exécute uniquement les fichiers `*.regression.test.ts` — la gate cumulative des tests déjà validés. Rapide car ciblé.
- **`pnpm test` en CI** : l'intégralité des tests, y compris les tests en cours de développement. La CI a le temps — pas le développeur.

### Pourquoi pas `pnpm test` en pre-commit ?

Le temps. `pnpm test` exécute tous les tests de tous les niveaux. Un hook pre-commit qui prend > 30s est contourné (via `--no-verify`), ce qui annule son utilité. La philosophie est : **rapide localement, exhaustif en CI**.

---

## Niveau 1 — Hooks Husky (pre-commit)

### Configuration Husky (v9+)

Husky v9+ n'utilise plus le shim `_/husky.sh`. Les hooks sont de simples scripts shell exécutables.

#### Initialisation (DevContainer)

```bash
npx husky                     # Husky v9+ : pas de "install"
chmod +x .husky/pre-commit .husky/commit-msg .husky/pre-push
```

#### `.husky/pre-commit`

```bash
#!/bin/sh

# ── Vérification de typage ────────────────────────────────
echo "🔍 Type-checking (tsc --noEmit)..."
pnpm tsc --noEmit || {
  echo "❌ Erreurs de compilation TypeScript. Commit annulé."
  exit 1
}

# ── Gate de non-régression ────────────────────────────────
echo "🧪 Running regression tests..."
pnpm test:regression || {
  echo "❌ Tests de non-régression en échec. Commit annulé."
  exit 1
}

echo "✅ Pre-commit checks passed."
```

#### `.husky/commit-msg`

```bash
#!/bin/sh

# Validation Conventional Commits (ADR-0033, CONTRIBUTING.md)
commit_msg=$(cat "$1")
commit_pattern='^(feat|fix|docs|refactor|test|chore|perf|ci|build)(\(.+\))?!?:.+'

if ! echo "$commit_msg" | grep -qE "$commit_pattern"; then
  echo ""
  echo "❌ Message de commit invalide."
  echo "📘 Format attendu : type(scope)?: message"
  echo "   Exemples : feat: add Channel class"
  echo "              fix(entity): correct mutate signature"
  echo "   Types : feat, fix, docs, refactor, test, chore, perf, ci, build"
  exit 1
fi
```

#### `.husky/pre-push`

```bash
#!/bin/sh

echo "🧪 Running full test suite before push..."
pnpm test || {
  echo "❌ Tests failed. Push annulé."
  exit 1
}

echo "✅ Pre-push checks passed."
```

### Scripts `.devcontainer/scripts/` — Suppression

Les 13 scripts legacy (`commit`, `finish-bugfix`, `finish-feature`, `start-release`, etc.) sont **supprimés**. Ils proviennent d'un autre projet et ne correspondent pas au workflow Git Flow adapté (ADR-0033). Les commandes Git natives suffisent :

```bash
git checkout -b feature/my-feature develop   # start feature
git checkout develop && git merge --no-ff feature/my-feature  # finish feature
```

---

## Niveau 2 — CI GitHub Actions

### Workflow `.github/workflows/regression.yml`

Exécuté sur chaque **push** sur branche `feature/*` ou `fix/*`, et sur chaque **pull_request** vers `develop` (conformément à ADR-0033 : `develop` est la branche d'intégration pré-v1).

```yaml
name: "🛡️ Continuous Verification"

on:
  push:
    branches:
      - "feature/**"
      - "fix/**"
  pull_request:
    branches:
      - develop

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  verify:
    name: "Type-check + Full test suite"
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"
      - run: pnpm install --frozen-lockfile
      - name: Type-check
        run: pnpm tsc --noEmit
      - name: Full test suite
        run: pnpm test:ci
```

### Status check requis sur la branch protection de `develop`

Le workflow ci-dessus DOIT être configuré comme **status check requis** sur la branche `develop` (Settings → Branches → Branch protection rule for `develop`).

| Paramètre branch protection                          | Valeur                         | Justification                                                                                                                   |
| ---------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| **Require status checks to pass before merging**     | ☑ activé                       | Sans ça, le bouton « Squash and merge » fonctionne même si la CI échoue → la gate du Niveau 2 devient purement informative      |
| **Require branches to be up to date before merging** | ☑ activé                       | Force le rebase/merge de `develop` dans la branche feature avant le merge final → la CI a tourné sur le code _réellement mergé_ |
| **Required check (nom exact)**                       | `Type-check + Full test suite` | Correspond au champ `name:` du job `verify` dans `regression.yml` (et non pas au nom du workflow)                               |
| **Allow administrators to bypass**                   | ☑ activé (toi seul)            | Garde-fou en cas d'urgence ; ne doit jamais être utilisé en routine                                                             |

> ⚠️ La liste déroulante des status checks dans GitHub ne propose que les checks **déjà exécutés au moins une fois**. Si le check n'apparaît pas, taper exactement `Type-check + Full test suite`.

Avec cette configuration, la promesse de l'ADR — « la CI est bloquante au merge » — est mécaniquement garantie par GitHub, et non plus dépendante de la discipline du mergeur.

### Évolution future (post-v1)

Quand le projet sera plus mature, un second workflow sera ajouté pour les releases :

```yaml
# Future : release.yml (non implémenté maintenant)
on:
  push:
    branches: [main]
# → build + test + tag + publish
```

Ce workflow n'est **pas implémenté maintenant** — il le sera quand `main` recevra ses premiers merges de `develop` (fin de strate 0).

---

## Gate de non-régression cumulative (Option A retenue)

### Principe

Un fichier `<strate>.regression.test.ts` par strate, qui importe tous les fichiers de test validés. Chaque PR mergée ajoute ses imports au fichier.

### Options analysées

| Option                             | Description                                                 | Verdict                   |
| ---------------------------------- | ----------------------------------------------------------- | ------------------------- |
| **A — Fichier d'entrée cumulatif** | Imports explicites dans un `.regression.test.ts` par strate | ✅ **Retenue**            |
| B — Jest projects                  | Config `projects` dans `jest.config.ts`                     | ❌ Perd la traçabilité PR |
| C — Tags `@regression`             | Annotations dans chaque fichier + custom runner             | ❌ Infra disproportionnée |

### Justification du choix (Option A)

1. **Explicite > Implicite** : chaque ajout est un acte délibéré, commenté avec le numéro de PR
2. **Zéro infra supplémentaire** : imports TypeScript standard, pas de runner custom
3. **Ciblage précis** : `pnpm test:regression` exécute exactement la gate, sans bruit
4. **Traçabilité historique** : le fichier sert de journal des PR validées
5. **Compatible CI immédiatement** : un seul job suffit

### Convention de nommage

```
tests/
├── unit/
│   └── strate-0/
│       ├── strate-0.regression.test.ts    ← gate cumulative unit
│       ├── channel.class.test.ts
│       └── radio.singleton.test.ts
├── integration/
│   └── strate-0/
│       ├── strate-0.regression.test.ts    ← gate cumulative integ
│       └── trigger-handle-mutate-emit.test.ts
└── e2e/
    └── strate-0/
        ├── strate-0.regression.test.ts    ← gate cumulative e2e
        └── strate-0.cart-round-trip.test.ts
```

---

## Protocole d'ajout au fichier de régression

### Quand ajouter

1. La PR est **prête à être mergée** (tests tous verts)
2. Le développeur ajoute les imports dans le fichier `<strate>.regression.test.ts` correspondant
3. Le commentaire suit le format : `// ── PR #N — Description courte ──`

### Exemple

```typescript
// tests/unit/strate-0/strate-0.regression.test.ts

/**
 * Strate 0 — Suite de non-régression cumulative (unit)
 * Chaque PR mergée ajoute ses imports ici.
 */

// ── PR #2 — Channel tri-lane + Radio singleton ──────────
import "./channel.class.test";
import "./radio.singleton.test";

// ── PR #3 — Application bootstrap ───────────────────────
import "./application.bootstrap.test";
```

### Scripts npm

```jsonc
{
  "test:regression": "npx jest --testPathPattern='regression\\.test\\.ts$' --no-coverage",
  "test:strate-0:regression": "npx jest tests/unit/strate-0/strate-0.regression.test.ts --no-coverage",
  "tsc:check": "tsc --noEmit"
}
```

---

## Conséquences

### Positives

- ✅ **Deux niveaux complémentaires** : rapide localement (pre-commit), exhaustif en CI
- ✅ **`tsc --noEmit` comme première ligne** : les régressions de typage sont détectées avant le commit
- ✅ **Gate de non-régression explicite** : ciblable, traçable, cumulative
- ✅ **Hooks Husky fonctionnels** : exécutables, compatibles Husky v9+, sans shim déprécié
- ✅ **Scripts legacy nettoyés** : suppression de 13 scripts inutiles de `.devcontainer/scripts/`
- ✅ **CI alignée sur ADR-0033** : PR vers `develop` (pas `main`)
- ✅ **Compatible ADR-0028** : les strates sont des jalons naturels dans les fichiers de régression

### Négatives (acceptées)

- ⚠️ Maintenance manuelle du fichier de régression — accepté : l'intentionnalité > l'automatisme
- ⚠️ `tsc --noEmit` ajoute ~5-10s au pre-commit — accepté : le type-checking est non-négociable

### Risques identifiés

| Risque                                             | Mitigation                             |
| -------------------------------------------------- | -------------------------------------- |
| Oubli d'ajout au fichier cumulatif                 | Checklist PR dans CONTRIBUTING.md      |
| Pre-commit contourné (`--no-verify`)               | CI comme filet de sécurité obligatoire |
| `tsc --noEmit` trop lent quand le monorepo grossit | Envisager `tsc --build` incrémental    |

---

## Actions de suivi

- [x] Créer `tests/unit/strate-0/strate-0.regression.test.ts` avec les tests PR #2
- [x] Réécrire `.husky/pre-commit` (tsc + regression)
- [x] Réécrire `.husky/commit-msg` (types alignés sur CONTRIBUTING.md)
- [x] Réécrire `.husky/pre-push` (full test suite, sans merge automatique)
- [x] Mettre à jour `.github/workflows/regression.yml` (PR → `develop`)
- [x] Supprimer `.devcontainer/scripts/` (legacy)
- [x] Mettre à jour `post-create-command.sh` (Husky v9+, chmod +x)
- [x] Ajouter `tsc:check` au `package.json`
- [ ] Mettre à jour `CONTRIBUTING.md` — section non-régression + checklist PR
- [x] Configurer branch protection rule sur `develop` avec le status check requis (2026-04-21 — voir § Niveau 2)

---

## Références

- [ADR-0028 — Stratégie de phasage d'implémentation](ADR-0028-implementation-phasing-strategy.md)
- [ADR-0030 — Tests comme preuve d'architecture](ADR-0030-testing-as-architecture-proof.md)
- [ADR-0033 — Workflow Git & versioning](ADR-0033-git-workflow-versioning-strategy.md)
- [ADR-0006 — Testing strategy](ADR-0006-testing-strategy.md)
- [CONTRIBUTING.md](/CONTRIBUTING.md)

---

## Historique

| Date       | Changement                                                                                                                                                           |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-17 | Création (Proposed) — scope initial : gate de non-régression cumulative                                                                                              |
| 2026-04-20 | Élargi et renommé : stratégie de vérification continue (hooks + CI). Accepted.                                                                                       |
| 2026-04-21 | Amendement : workflow CI promu **status check requis** sur `develop` (branch protection). Job exécute `pnpm test:ci` (full suite) au lieu de `pnpm test:regression`. |
