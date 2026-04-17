# ADR-0034 : Gate de non-régression cumulative par strate

| Champ         | Valeur                                                                         |
| ------------- | ------------------------------------------------------------------------------ |
| **Statut**    | 🟡 Proposed                                                                    |
| **Date**      | 2026-04-17                                                                     |
| **Décideurs** | @NCAC                                                                          |
| **RFC liée**  | ADR-0028 (phasage), ADR-0030 (tests comme preuve), ADR-0006 (testing strategy) |

---

## Contexte

Le framework Bonsai est implémenté par **strates** successives (ADR-0028). Chaque strate se compose de plusieurs Pull Requests, chaque PR apportant de nouveaux tests unitaires, d'intégration et/ou e2e.

**Problème** : lorsqu'une nouvelle PR est développée (PI N+1), rien ne garantit formellement que les tests validés aux PI précédents passent toujours. Le script `pnpm test` exécute _tout_, mais :

1. Il n'y a pas de **gate explicite** « les N tests déjà validés ne cassent pas »
2. En CI, il n'y a pas de distinction entre « nouveau test en cours de dev » et « test précédemment vert qui casse » (régression)
3. L'absence de fichier d'entrée cumulatif empêche de cibler uniquement la non-régression

**Déclencheur** : PR #2 (Channel tri-lane + Radio singleton) valide `channel.basic.test.ts` et `radio.singleton.test.ts`. La PR #3 va ajouter de nouveaux tests — comment s'assurer que les tests de la PR #2 restent verts ?

---

## Contraintes

- **C1** : Compatible avec Jest (le test runner en place)
- **C2** : Compatible avec le monorepo pnpm existant
- **C3** : Ne doit pas ralentir significativement le workflow de développement
- **C4** : Doit supporter les 3 niveaux de tests (unit, integration, e2e)
- **C5** : Doit être intégrable à GitHub Actions
- **C6** : Doit être explicite et traçable (philosophie Bonsai : explicite > implicite)

---

## Options considérées

### Option A — Fichier d'entrée cumulatif explicite (un par strate)

**Description** : Un fichier `<strate>.regression.test.ts` par strate, qui importe tous les fichiers de test validés via `import "./fichier.test"`. Chaque PR mergée ajoute ses imports au fichier. Un script npm et un workflow CI exécutent ce fichier.

```typescript
// tests/unit/strate-0/strate-0.regression.test.ts

/**
 * Strate 0 — Suite de non-régression cumulative
 * Chaque PR mergée ajoute ses imports ici.
 */

// ── PR #2 — Channel tri-lane + Radio singleton ──────────
import "./channel.basic.test";
import "./radio.singleton.test";

// ── PR #3 — Feature core + Entity ───────────────────────
import "./feature.core.test";
import "./entity.basic.test";

// ── PR #4 — Application bootstrap ───────────────────────
import "./application.bootstrap.test";
```

| Avantages                                            | Inconvénients                                           |
| ---------------------------------------------------- | ------------------------------------------------------- |
| + Intentionnel : chaque ajout est un acte délibéré   | - Maintenance manuelle (oubli possible)                 |
| + Traçable : commentaire PR + date                   | - Un fichier de plus à maintenir                        |
| + Simple : aucune infra custom, juste des imports TS | - Duplication conceptuelle (les fichiers existent déjà) |
| + Ciblable : `jest strate-0.regression.test.ts`      |                                                         |
| + Compatible avec tous les niveaux de test           |                                                         |

---

### Option B — Jest projects (un config par strate)

**Description** : Utiliser la fonctionnalité `projects` de Jest pour définir un projet par strate avec des globs `testMatch`.

```typescript
// jest.config.ts
const config: Config = {
  projects: [
    {
      displayName: "strate-0-regression",
      testMatch: [
        "<rootDir>/tests/unit/strate-0/channel.basic.test.ts",
        "<rootDir>/tests/unit/strate-0/radio.singleton.test.ts"
        // ... ajoutés au fil des PR
      ]
    }
  ]
};
```

| Avantages                                | Inconvénients                                                           |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| + Natif Jest                             | - Perd la traçabilité PR (pas de commentaires dans un JSON-like config) |
| + Pas de fichier .test.ts supplémentaire | - Config Jest déjà complexe (moduleNameMapper, transforms...)           |
|                                          | - Mélange configuration et intention de test                            |

---

### Option C — Tags / annotations avec filtre custom

**Description** : Ajouter un commentaire `@regression` dans chaque fichier de test validé, et un Jest custom runner/filter qui ne sélectionne que les fichiers taggés.

```typescript
// channel.basic.test.ts
/**
 * @regression PR#2 2026-04-17
 */
describe("Channel tri-lane basic", () => {
  /* ... */
});
```

| Avantages                                 | Inconvénients                               |
| ----------------------------------------- | ------------------------------------------- |
| + Décentralisé (pas de fichier central)   | - Nécessite un custom runner/transform Jest |
| + Granulaire (par describe/test possible) | - Facile d'oublier le tag                   |
|                                           | - Infra custom à maintenir                  |
|                                           | - Non standard, courbe d'apprentissage      |

---

## Analyse comparative

| Critère                        | Option A (Cumulatif) | Option B (Jest projects) | Option C (Tags) |
| ------------------------------ | -------------------- | ------------------------ | --------------- |
| Simplicité                     | ⭐⭐⭐               | ⭐⭐                     | ⭐              |
| Traçabilité                    | ⭐⭐⭐               | ⭐                       | ⭐⭐            |
| DX                             | ⭐⭐⭐               | ⭐⭐                     | ⭐              |
| Maintenabilité                 | ⭐⭐                 | ⭐⭐                     | ⭐              |
| Type-safety                    | ⭐⭐⭐               | ⭐                       | ⭐              |
| Intégration CI                 | ⭐⭐⭐               | ⭐⭐⭐                   | ⭐⭐            |
| Philosophie Bonsai (explicite) | ⭐⭐⭐               | ⭐⭐                     | ⭐              |

---

## Décision

Nous choisissons **Option A — Fichier d'entrée cumulatif explicite** parce que :

1. **Explicite > Implicite** : chaque ajout au fichier de régression est un acte délibéré, documenté avec le numéro de PR et la date. Pas de magie, pas de convention cachée.
2. **Zéro infra supplémentaire** : ce sont des imports TypeScript standard. Pas de runner custom, pas de plugin Jest.
3. **Ciblage précis** : `npx jest strate-0.regression.test.ts` exécute exactement la gate de non-régression, sans bruit.
4. **Traçabilité historique** : le fichier lui-même sert de journal des PR validées — on sait exactement quand chaque test a été ajouté et par quelle PR.
5. **Compatible CI immédiatement** : un seul job GitHub Actions suffit.

**Rejet de l'Option B** : mélange config et intention ; perd la traçabilité par PR ; complexifie un `jest.config.ts` déjà chargé.

**Rejet de l'Option C** : infra custom disproportionnée pour le besoin ; le tag est facile à oublier, ce qui va à l'encontre de l'intentionnalité recherchée.

---

## Protocole d'ajout

### Quand ajouter au fichier de régression

1. La PR est **mergée** (ou prête à être mergée, tests tous verts)
2. Le développeur ajoute les imports dans le fichier `<strate>.regression.test.ts` correspondant
3. Le commentaire suit le format : `// ── PR #N — Description courte ──`

### Convention de nommage

```
tests/
├── unit/
│   └── strate-0/
│       ├── strate-0.regression.test.ts    ← gate cumulative unit
│       ├── channel.basic.test.ts
│       └── radio.singleton.test.ts
├── integration/
│   └── strate-0/
│       ├── strate-0.regression.test.ts    ← gate cumulative integ
│       └── trigger-handle-mutate-emit.test.ts
└── e2e/
    └── strate-0/
        ├── strate-0.regression.test.ts    ← gate cumulative e2e
        └── cart-round-trip.test.ts
```

### Scripts npm

```jsonc
{
  "test:regression": "npx jest --testPathPattern='regression\\.test\\.ts$' --no-coverage",
  "test:strate-0:regression": "npx jest tests/unit/strate-0/strate-0.regression.test.ts --no-coverage"
}
```

### CI GitHub Actions

Le workflow `regression.yml` s'exécute :

- Sur chaque **push** vers une branche `feature/*` ou `fix/*`
- Sur chaque **pull_request** vers `main`
- Exécute uniquement `pnpm test:regression`
- Échec = la PR ne peut pas être mergée (branch protection rule)

---

## Conséquences

### Positives

- ✅ Gate de non-régression explicite, ciblable, traçable
- ✅ Intégration CI immédiate (GitHub Actions)
- ✅ Chaque PI empile ses tests — le fichier grossit naturellement
- ✅ Détection immédiate si un refactoring casse un test précédemment validé
- ✅ Compatible avec la stratégie de phasage par strates (ADR-0028)

### Négatives (acceptées)

- ⚠️ Maintenance manuelle du fichier — accepté parce que l'intentionnalité est plus importante que l'automatisme
- ⚠️ Risque d'oubli d'ajout — mitigé par la checklist PR dans CONTRIBUTING.md et la CI

### Risques identifiés

- 🔶 Oubli d'ajout au fichier cumulatif — mitigation : ajout à la checklist PR dans CONTRIBUTING.md
- 🔶 Fichier cumulatif qui grossit beaucoup — mitigation : un fichier par strate, pas un fichier global

---

## Actions de suivi

- [x] Créer `tests/unit/strate-0/strate-0.regression.test.ts` avec les tests PR #2
- [ ] Créer `.github/workflows/regression.yml`
- [ ] Ajouter `test:regression` au `package.json`
- [ ] Mettre à jour `CONTRIBUTING.md` — section non-régression + checklist PR
- [ ] Configurer branch protection rule sur `main` (quand le repo est prêt)

---

## Références

- [ADR-0028 — Stratégie de phasage d'implémentation](ADR-0028-implementation-phasing-strategy.md)
- [ADR-0030 — Tests comme preuve d'architecture](ADR-0030-testing-as-architecture-proof.md)
- [ADR-0006 — Testing strategy](ADR-0006-testing-strategy.md)
- [CONTRIBUTING.md](/CONTRIBUTING.md)

---

## Historique

| Date       | Changement                              |
| ---------- | --------------------------------------- |
| 2026-04-17 | Création (Proposed) — déclencheur PR #2 |
