# ADR-0033 : Workflow Git & stratégie de versioning

> **Quel modèle de branching Git, quelle politique de versioning et quel processus de release pour le framework Bonsai ?**

| Champ           | Valeur                                                                                                                                                                                                               |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Statut**      | 🟢 Accepted                                                                                                                                                                                                          |
| **Date**        | 2026-04-14                                                                                                                                                                                                           |
| **Décideurs**   | @ncac                                                                                                                                                                                                                |
| **ADR liées**   | [ADR-0028](ADR-0028-implementation-phasing-strategy.md) (phasage kernel-first 3 strates), [ADR-0029](ADR-0029-v1-scope-freeze.md) (scope v1 gelé), [ADR-0032](ADR-0032-build-pipeline-toolchain.md) (build pipeline) |
| **Déclencheur** | Tous les commits sont sur `main`, aucun tag, aucune release, aucun workflow Git formalisé — version `0.1.0` partout sans signification sémantique                                                                    |

---

## 📋 Table des matières

1. [Contexte](#contexte)
2. [Contraintes](#contraintes)
3. [Options considérées — Workflow Git](#options-considérées--workflow-git)
4. [Options considérées — Stratégie de versioning](#options-considérées--stratégie-de-versioning)
5. [Analyse comparative — Workflow Git](#analyse-comparative--workflow-git)
6. [Analyse comparative — Versioning](#analyse-comparative--versioning)
7. [Décision](#décision)
8. [Gestion de l'historique existant](#gestion-de-lhistorique-existant)
9. [Spécification du workflow](#spécification-du-workflow)
10. [Spécification du versioning](#spécification-du-versioning)
11. [Conséquences](#conséquences)
12. [Actions de suivi](#actions-de-suivi)

---

## Contexte

### L'état actuel — chaos assumé

L'état Git de Bonsai au 2026-04-14 :

| Métrique             | Valeur                           | Problème                                                                      |
| -------------------- | -------------------------------- | ----------------------------------------------------------------------------- |
| Branches             | **1** (`main`)                   | Pas de branche d'intégration, pas de feature branches                         |
| Tags                 | **0**                            | Aucun jalon traçable dans l'historique                                        |
| Commits              | **15** sur `main`                | Tout est linéaire, pas de granularité                                         |
| Version              | **`0.1.0`** partout              | Chiffre arbitraire, aucune sémantique                                         |
| CHANGELOG            | **Inexistant**                   | Pas de trace des changements entre versions                                   |
| Outils de release    | **Aucun**                        | Ni changesets, ni semantic-release, ni script                                 |
| Conventional Commits | **Documentés** (CONTRIBUTING.md) | **Pas appliqués uniformément** (ex: `very-first-commit`, `🎉 Initial commit`) |
| `private: true`      | **Tous les packages**            | Aucune publication npm — monorepo fermé                                       |

Ce chaos était acceptable en phase exploratoire (marionext → corpus documentaire). Il ne l'est plus maintenant que l'implémentation de la strate 0 (ADR-0028) démarre : chaque composant implémenté doit être traçable, chaque jalon identifiable.

### Deux sujets, un ADR

Le workflow Git et le versioning sont **interdépendants** :

- Le modèle de branching détermine **quand** un merge sur `main` se produit → quand un tag est posé
- La stratégie de versioning détermine **quel numéro** est assigné à ce tag
- Les strates ADR-0028 sont des **jalons naturels** qui doivent se refléter dans les branches ET dans les versions
- Les Conventional Commits lient les deux : le **type** du commit (`feat`, `fix`, `feat!`) détermine le **bump** de version

Les traiter séparément créerait des incohérences.

### Ce qui existe déjà

- **Conventional Commits** : documentés dans CONTRIBUTING.md avec les types `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `ci`. Template de PR avec classification breaking/non-breaking. **Base solide mais pas appliquée.**
- **Convention de nommage des branches** : documentée dans CONTRIBUTING.md (`feature/`, `fix/`, `docs/`, `refactor/`, `test/`). **Jamais utilisée** (0 branche autre que `main`).
- **Monorepo privé** : tous les packages sont `private: true`. Aucune publication npm. Le versioning ne concerne que la **traçabilité interne** et la **préparation de la v1 publique**.

---

## Contraintes

| #   | Contrainte                                                                                                                 | Source                   |
| --- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| C1  | Le workflow DOIT supporter le **phasage en 3 strates** (ADR-0028) — chaque fin de strate est un jalon identifiable         | ADR-0028                 |
| C2  | Le workflow DOIT permettre de **travailler sur plusieurs features en parallèle** sans polluer la branche stable            | DX développeur           |
| C3  | Le versioning DOIT suivre **SemVer 2.0.0** (`MAJOR.MINOR.PATCH[-prerelease]`)                                              | Standard industriel      |
| C4  | En phase pré-v1 (`0.x.y`), **toute version `0.x.y`** signifie « API instable, breaking changes possibles » (SemVer §4)     | SemVer spec              |
| C5  | Le workflow NE DOIT PAS être **surdimensionné** pour un développeur principal + contributeurs occasionnels                 | Pragmatisme              |
| C6  | Chaque **merge sur `main`** DOIT être accompagné d'un **tag versionné** — `main` ne reçoit que des états stables           | Traçabilité              |
| C7  | Les **Conventional Commits** DOIVENT être respectés — ils sont la base du changelog automatique et du bump de version      | CONTRIBUTING.md          |
| C8  | Le processus de release DOIT être **reproductible et documenté** — pas de release manuelle ad hoc                          | Maintenabilité           |
| C9  | Le versioning DOIT être **synchronisé** (version unique pour tout `@bonsai/*`) — pas de versioning indépendant par package | Monorepo privé, ADR-0031 |

---

## Options considérées — Workflow Git

### Option A — Git Flow classique

**Description** : le modèle complet de Vincent Driessen (2010). Deux branches permanentes (`main`, `develop`), trois types de branches éphémères (`feature/*`, `release/*`, `hotfix/*`).

```
main      ──●───────────────────────●───────────────●──── (releases uniquement)
             \                     / \             /
develop    ───●──●──●──●──●──●──●──●───●──●──●──●──●──── (intégration)
                  \   /     \   /         \   /
feature/*      ────●──●      ●──●          ●──●           (éphémères)
                                   \     /
release/*                           ●──●                   (préparation release)
                                          \
hotfix/*                                   ●──●            (correctif d'urgence)
```

| Avantages                                 | Inconvénients                                              |
| ----------------------------------------- | ---------------------------------------------------------- |
| + Modèle éprouvé, universellement compris | - `hotfix/*` inutile pré-v1 (aucun consommateur à patcher) |
| + Séparation claire stable / WIP          | - `release/*` surdimensionné pour un développeur principal |
| + `develop` comme tampon d'intégration    | - Cérémonie de merge `release → main + develop` lourde     |
| + Compatible avec les strates ADR-0028    | - 5 types de branches à gérer — overhead cognitif          |
| + Supporté nativement par `git flow` CLI  |                                                            |

---

### Option B — Git Flow adapté (2 phases)

**Description** : Git Flow simplifié en phase pré-v1 (pas de `release/*` ni `hotfix/*`), puis Git Flow complet post-v1. Deux branches permanentes (`main`, `develop`), un type de branche éphémère (`feature/*`) en pré-v1.

#### Phase pré-v1 (maintenant → v1.0.0)

```
main      ──●─────────────────────────────────●──── (jalons uniquement)
             \                                 ↑
develop    ───●──●──●──●──●──●──●──●──●──●──●──● ← intégration quotidienne
                  \     /     \     /       \  /
feature/*      ────●──●       ●──●          ●●    (éphémères)
```

- **`main`** : reçoit des merges de `develop` uniquement aux **jalons** (fin de strate, ADR structurante validée)
- **`develop`** : branche d'intégration — tout merge ici en continu
- **`feature/*`** : une branche par unité de travail (composant, ADR, PoC, fix) — durée de vie courte

#### Phase post-v1 (après release publique)

Passage au Git Flow complet : ajout de `release/*` et `hotfix/*` quand il y a des consommateurs externes.

| Avantages                                        | Inconvénients                                         |
| ------------------------------------------------ | ----------------------------------------------------- |
| + Léger pré-v1 (3 types de branches)             | - Moins formalisé que Git Flow complet                |
| + S'enrichit naturellement vers Git Flow complet | - Transition pré/post-v1 à documenter                 |
| + `develop` isole `main` du WIP                  | - Discipline requise pour les merges `develop → main` |
| + Pas de cérémonie inutile pré-v1                |                                                       |
| + Compatible avec les strates ADR-0028           |                                                       |

---

### Option C — GitHub Flow

**Description** : une seule branche permanente (`main`). Les feature branches sont mergées directement dans `main` via Pull Request.

```
main      ──●──●──●──●──●──●──●──●──●──●──●──●── (tout ici)
               \  /     \  /       \  /
feature/*       ●●       ●●        ●●             (éphémères, merge direct)
```

| Avantages                                  | Inconvénients                                                              |
| ------------------------------------------ | -------------------------------------------------------------------------- |
| + Extrêmement simple — 2 types de branches | - `main` reçoit du WIP en continu — pas de « stable » vs « en cours »      |
| + Pas de branche `develop` à maintenir     | - Pas de notion de jalon/milestone dans le modèle                          |
| + Adapté au déploiement continu (SaaS)     | - Un framework n'est pas un SaaS — il a des releases versionnées           |
|                                            | - Pas de tampon d'intégration — un merge cassé pollue `main` immédiatement |
|                                            | - Les strates ADR-0028 n'ont pas de représentation naturelle               |

---

### Option D — Trunk-Based Development

**Description** : une seule branche permanente (`main`/`trunk`). Les développeurs commitent directement sur `main` ou via des feature branches très courtes (<1 jour). Feature flags pour le WIP.

```
main      ──●──●──●──●──●──●──●──●──●──●── (tout ici, commits directs)
                \  /                         (branches <1 jour exceptionnellement)
feature/*        ●●
```

| Avantages                          | Inconvénients                                                        |
| ---------------------------------- | -------------------------------------------------------------------- |
| + Intégration continue maximale    | - Feature flags nécessaires pour le WIP — overhead pour un framework |
| + Pas de branches longues à gérer  | - Pas de notion de version/release native                            |
| + Feedback rapide sur les conflits | - Discipliné : nécessite CI solide + review rapide                   |
|                                    | - Inadapté aux jalons structurants (strates)                         |
|                                    | - Un framework a besoin de versions, pas de déploiements continus    |

---

## Options considérées — Stratégie de versioning

### Option V1 — Pré-release SemVer (`0.x.y` → `1.0.0`)

**Description** : rester en `0.x.y` pendant toute la phase pré-v1. Chaque MINOR (`0.x.0`) correspond à un jalon (fin de strate). La v1.0.0 est posée quand la strate 2 est complète et validée.

**Schéma de versions** :

```
0.1.0           ← état actuel (historique marionext, pas de sémantique)
0.1.1 … 0.1.N  ← correctifs/docs pendant la strate 0
0.2.0           ← fin strate 0 (Entity, Channel, Radio)
0.2.1 … 0.2.N  ← correctifs strate 0
0.3.0           ← fin strate 1 (Feature, Application)
0.3.1 … 0.3.N  ← correctifs strate 1
0.4.0           ← fin strate 2 (Foundation, Composer, View, Behavior, Router)
0.4.1 … 0.4.N  ← correctifs strate 2
1.0.0-rc.1      ← release candidate — API gelée, tests E2E
1.0.0-rc.N      ← corrections RC
1.0.0           ← release publique
```

**Règles SemVer pré-1.0** (SemVer §4) :

- `MAJOR = 0` signifie « API instable — tout peut changer »
- `MINOR` incrémenté = nouveau jalon avec potentiellement des breaking changes
- `PATCH` incrémenté = correctifs sans breaking change
- **Pas de garantie de rétrocompatibilité** entre `0.x.0` et `0.(x+1).0`

| Avantages                                            | Inconvénients                                                  |
| ---------------------------------------------------- | -------------------------------------------------------------- |
| + **Standard SemVer** — universellement compris      | - `0.x.y` ne signale pas la **maturité** au-delà de « pré-v1 » |
| + Les MINOR mappent naturellement sur les strates    | - 4 incréments MINOR avant la v1 — historique court            |
| + `1.0.0` a une signification forte (API stable)     |                                                                |
| + Compatible avec tout outil (npm, pnpm, changesets) |                                                                |

---

### Option V2 — Strate-based (`0.STRATE.PATCH` → `1.0.0`)

**Description** : encoder la strate directement dans le numéro de version. `0.STRATE.PATCH` où STRATE = {0, 1, 2}.

**Schéma de versions** :

```
0.0.0           ← baseline (immédiatement après adoption de cet ADR)
0.0.1 … 0.0.N  ← builds strate 0
0.1.0           ← début strate 1
0.1.1 … 0.1.N  ← builds strate 1
0.2.0           ← début strate 2
0.2.1 … 0.2.N  ← builds strate 2
1.0.0-rc.1      ← RC
1.0.0           ← release publique
```

| Avantages                                       | Inconvénients                                                                |
| ----------------------------------------------- | ---------------------------------------------------------------------------- |
| + Lecture immédiate de la strate dans le numéro | - Convention **non standard** — `0.STRATE.x` n'est pas SemVer orthodoxe      |
| + Alignement ADR-0028 visible                   | - MINOR commence à 0 et va jusqu'à 2 — très court                            |
|                                                 | - Conflit sémantique : est-ce que `0.1.0` = strate 1 ou premier minor bump ? |

---

### Option V3 — Alpha/Beta labels (`0.1.0-alpha.x` → `0.1.0-beta.x` → `1.0.0`)

**Description** : utiliser des pre-release labels SemVer pour marquer la maturité. `0.1.0-alpha.x` (strate 0), `0.1.0-beta.x` (strate 1-2), `1.0.0-rc.x`, `1.0.0`.

**Schéma de versions** :

```
0.1.0-alpha.0     ← début strate 0
0.1.0-alpha.1 …   ← builds strate 0
0.1.0-beta.0      ← début strate 1 (kernel complet)
0.1.0-beta.1 …    ← builds strate 1-2
1.0.0-rc.1        ← RC
1.0.0             ← release publique
```

| Avantages                                                             | Inconvénients                                                                            |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| + Labels significatifs (alpha → beta → rc)                            | - La version `0.1.0` ne change jamais — tout est dans le label                           |
| + Tradition bien comprise (alpha = instable, beta = feature-complete) | - `alpha.47` — les compteurs montent indéfiniment, peu lisible                           |
|                                                                       | - SemVer pre-release : `0.1.0-alpha.1 < 0.1.0-beta.1 < 0.1.0` — tri correct mais verbeux |
|                                                                       | - Pas de granularité pour les jalons inter-strates                                       |

---

## Analyse comparative — Workflow Git

| Critère                          | A — Git Flow             | B — Git Flow adapté | C — GitHub Flow    | D — Trunk-Based     |
| -------------------------------- | ------------------------ | ------------------- | ------------------ | ------------------- |
| **Séparation stable/WIP**        | ⭐⭐⭐                   | ⭐⭐⭐              | ⭐ (tout sur main) | ⭐ (tout sur trunk) |
| **Support des strates ADR-0028** | ⭐⭐⭐                   | ⭐⭐⭐              | ⭐ (pas naturel)   | ⭐ (pas naturel)    |
| **Simplicité pré-v1**            | ⭐ (5 types de branches) | ⭐⭐⭐ (3 types)    | ⭐⭐⭐ (2 types)   | ⭐⭐⭐ (1-2 types)  |
| **Scalabilité post-v1**          | ⭐⭐⭐ (complet)         | ⭐⭐⭐ (transition) | ⭐⭐ (limité)      | ⭐⭐ (limité)       |
| **Overhead cognitif**            | ⭐ (lourd)               | ⭐⭐ (modéré)       | ⭐⭐⭐ (minimal)   | ⭐⭐⭐ (minimal)    |
| **Adapté à un framework**        | ⭐⭐⭐                   | ⭐⭐⭐              | ⭐ (SaaS-oriented) | ⭐ (CI/CD-oriented) |
| **Traçabilité des releases**     | ⭐⭐⭐                   | ⭐⭐⭐              | ⭐⭐               | ⭐                  |

---

## Analyse comparative — Versioning

| Critère                  | V1 — Pré-release SemVer        | V2 — Strate-based                   | V3 — Alpha/Beta labels            |
| ------------------------ | ------------------------------ | ----------------------------------- | --------------------------------- |
| **Conformité SemVer**    | ⭐⭐⭐ (standard)              | ⭐⭐ (convention)                   | ⭐⭐⭐ (standard)                 |
| **Lisibilité**           | ⭐⭐⭐ (`0.2.0` = clair)       | ⭐⭐ (`0.1.3` = strate 1 patch 3 ?) | ⭐⭐ (`0.1.0-alpha.47` = verbeux) |
| **Alignement strates**   | ⭐⭐ (par convention)          | ⭐⭐⭐ (natif)                      | ⭐⭐ (labels = phases)            |
| **Granularité**          | ⭐⭐⭐ (MINOR + PATCH)         | ⭐⭐ (PATCH seul intra-strate)      | ⭐ (compteur monotone)            |
| **Compatibilité outils** | ⭐⭐⭐ (npm, pnpm, changesets) | ⭐⭐⭐ (standard)                   | ⭐⭐⭐ (standard)                 |
| **Signal v1.0.0**        | ⭐⭐⭐ (passage fort 0→1)      | ⭐⭐⭐ (idem)                       | ⭐⭐⭐ (idem)                     |
| **Simple à expliquer**   | ⭐⭐⭐                         | ⭐⭐                                | ⭐⭐                              |

---

## Décision

### Workflow Git : Option B — Git Flow adapté (2 phases)

Nous choisissons **Git Flow adapté** parce que :

1. **Séparation stable/WIP sans overhead.** La branche `develop` absorbe le travail quotidien. `main` ne reçoit que des états validés (fin de strate, jalon). Pas de feature cassée sur `main`, pas de hotfix à gérer.

2. **Alignement naturel avec les strates.** Chaque merge `develop → main` correspond à un jalon traçable : fin de strate 0, strate 1, strate 2, v1.0.0. Le modèle de branching reflète le modèle d'implémentation (ADR-0028).

3. **Simplicité pré-v1.** Trois types de branches suffisent (`main`, `develop`, `feature/*`). Pas de `release/*` ni `hotfix/*` — il n'y a ni consommateur externe à patcher ni processus de release formalisé. L'overhead est minimal.

4. **Évolution naturelle post-v1.** Quand Bonsai aura des consommateurs et un versioning public, l'ajout de `release/*` et `hotfix/*` est mécanique — pas de migration de modèle.

**Pourquoi pas Git Flow complet (Option A) ?** `release/*` et `hotfix/*` sont des solutions à des problèmes qui n'existent pas pré-v1 (patches urgents, préparation multi-step de releases publiques). Les ajouter maintenant, c'est de la cérémonie sans valeur.

**Pourquoi pas GitHub Flow (Option C) ?** `main` reçoit du WIP en continu. Un framework a besoin de jalons (strates → versions), pas d'un flux continu. GitHub Flow est fait pour le SaaS et le déploiement continu — pas pour un framework versionné.

**Pourquoi pas Trunk-Based (Option D) ?** Même problème que GitHub Flow, aggravé : pas de branche d'intégration, nécessité de feature flags pour le WIP. Un framework n'a pas de déploiement continu — il a des releases.

### Versioning : Option V1 — Pré-release SemVer (`0.x.y`)

Nous choisissons **SemVer standard avec `0.x.y` pré-v1** parce que :

1. **Standard universel.** SemVer 2.0.0 est compris par tous les outils (npm, pnpm, changesets) et tous les développeurs. Pas de convention exotique à expliquer.

2. **MINOR = jalon.** `0.2.0` = fin strate 0. `0.3.0` = fin strate 1. `0.4.0` = fin strate 2. Simple, lisible, traçable. La convention est documentée ici et ne nécessite pas d'encodage dans le numéro.

3. **Granularité suffisante.** PATCH pour les corrections intra-strate, MINOR pour les jalons. Pas besoin de labels alpha/beta tant que le monorepo est privé — `0.x.y` dit déjà « API instable ».

4. **`1.0.0` = signal fort.** Le passage de `0.x.y` à `1.0.0` signifie « API publique stable, garantie de rétrocompatibilité ». C'est le seul chiffre qui compte pour les consommateurs externes.

**Pourquoi pas Strate-based (Option V2) ?** Convention non standard — `0.1.3` est-ce « strate 1, patch 3 » ou « premier MINOR, troisième patch » ? L'ambiguïté n'en vaut pas la peine. L'alignement strate → MINOR est documenté dans cette ADR — pas besoin de l'encoder dans la mécanique.

**Pourquoi pas Alpha/Beta labels (Option V3) ?** `0.1.0-alpha.47` est verbeux et le compteur monotone ne porte pas de sémantique. Les labels alpha/beta sont utiles pour les **pré-releases d'une version publique** (ex: `1.0.0-rc.1`). Pré-v1, `0.x.y` suffit. Les labels `rc.N` seront utilisés uniquement pour la `1.0.0`.

---

## Gestion de l'historique existant

### Le problème

Au moment de l'adoption de cet ADR, `main` contient **15 commits** dont l'historique est incohérent :

```
355af44 🎉 Initial commit: Bonsai framework v0.1.0
9f170a9 chore: clean old documentation
e332809 @Todo : make the buildFramework works ..
2f2f629 chore: todo
acca451 chore: build system
a11b888 docs: README
1cbba2f docs : add FR version
4c08a3a very-first-commit
11c87de ADR-0024-0025-0026-0027
911c211 Propagation ADR-0024/0026 — exemples et fichiers périphériques
8e34194 fix(docs): normalisation pré-implémentation — alignement ADR Accepted sur docs de référence
ed2c5c4 feat(adr): ADR-0028 Accepted — stratégie de phasage kernel-first en 3 strates
b175163 feat(adr): ADR-0029 Accepted — périmètre gelé v1
4c5a3da feat(adr): ADR-0030 Accepted — tests comme preuve d'architecture
dbd167d feat(test): infrastructure TDD strate 0 — tests rouge/skip + fix devcontainer
```

**Problèmes** :

- Les 8 premiers commits ne suivent pas Conventional Commits (`very-first-commit`, `🎉 Initial commit`, `@Todo`, `chore: todo`)
- Les messages ne portent aucune sémantique exploitable (ni scope, ni description utile)
- Pour un nouveau contributeur, cet historique est **illisible et décourageant** — il ne raconte rien de l'évolution du projet
- Aucun de ces commits n'a de valeur de traçabilité individuelle — ils représentent collectivement « la phase exploratoire marionext → corpus documentaire »

### Options considérées

#### Option H1 — Conserver l'historique tel quel

Garder les 15 commits, poser le tag `v0.1.0` sur `HEAD`, et passer à autre chose.

| Avantages                        | Inconvénients                                                   |
| -------------------------------- | --------------------------------------------------------------- |
| + Aucune opération destructive   | - Historique illisible pour tout nouvel arrivant                |
| + Conservation des dates exactes | - 8 commits non-conventionnels polluent `git log` à perpétuité  |
| + Pas de risque technique        | - Incohérent avec la discipline Conventional Commits de cet ADR |

#### Option H2 — Squash en 1 commit baseline

Squasher les 15 commits en **un seul commit baseline** qui représente l'état de départ du projet.

| Avantages                                                             | Inconvénients                                        |
| --------------------------------------------------------------------- | ---------------------------------------------------- |
| + Historique **propre dès le premier commit** — cohérent avec cet ADR | - Opération destructive (`--force` sur `main`)       |
| + Le `git log` commence par un commit lisible et conventionnel        | - Perte des dates individuelles (information faible) |
| + Un nouveau contributeur voit un point de départ clair               | - Les SHAs actuels deviennent invalides              |
| + 0 clones externes, 0 forks, 0 CI liée aux SHAs — aucun impact       |                                                      |

#### Option H3 — Rebase interactif (réécrire les messages)

Conserver les 15 commits mais réécrire chaque message pour respecter Conventional Commits.

| Avantages                                     | Inconvénients                                                          |
| --------------------------------------------- | ---------------------------------------------------------------------- |
| + Conservation de la granularité (15 commits) | - Effort de réécriture de 8+ messages sans valeur ajoutée              |
| + Messages propres                            | - Opération destructive aussi (`rebase -i --root`)                     |
| + Dates conservées                            | - Les 8 premiers commits n'ont pas de granularité utile de toute façon |

### Décision : Option H2 — Squash baseline

Nous choisissons le **squash en 1 commit baseline** parce que :

1. **Zéro impact externe.** Le dépôt a 0 clones, 0 forks, 0 release, 0 CI liée aux SHAs. L'opération `--force` est sans risque.

2. **Lisibilité immédiate.** Le premier commit que voit un nouveau contributeur est :

   ```
   chore: baseline v0.1.0 — corpus documentaire, infrastructure build et test
   ```

   C'est cohérent, professionnel et conforme aux Conventional Commits.

3. **Les 15 commits n'ont pas de valeur individuelle.** Ils représentent collectivement « tout ce qui a été fait avant la formalisation du workflow Git ». Un seul commit « baseline » capture cette sémantique exactement.

4. **L'ADR-0033 commence l'histoire.** Le squash est l'acte fondateur : à partir de ce commit, chaque commit suivra Conventional Commits, chaque merge sera un jalon, chaque tag aura une sémantique. L'historique avant cet acte est pré-historique.

**Pourquoi pas H1 (garder tel quel) ?** L'incohérence entre un ADR qui impose Conventional Commits et un historique qui contient `very-first-commit` est embarrassante. Le coût du squash est nul (0 impact externe) et le bénéfice est permanent.

**Pourquoi pas H3 (rebase interactif) ?** Effort supérieur pour un résultat inférieur. Réécrire 8 messages pour des commits qui n'ont individuellement aucune valeur de traçabilité est du travail perdu.

### Exécution

```bash
# 1. Squash — reset soft vers le premier commit, amend avec tout le contenu
git reset --soft $(git rev-list --max-parents=0 HEAD)
git commit --amend -m "chore: baseline v0.1.0 — corpus documentaire, infrastructure build et test"

# 2. Tag baseline
git tag -a v0.1.0 -m "v0.1.0 — Baseline : corpus documentaire (RFC-0001 à RFC-0003, ADR-0001 à ADR-0033), infrastructure de build et de test, packages fondations (@bonsai/types, @bonsai/event, @bonsai/rxjs, @bonsai/valibot)"

# 3. Créer develop
git checkout -b develop

# 4. Force push main (0 clones, 0 forks — safe)
git push --force origin main --tags
git push -u origin develop
```

> **Après cette opération, plus aucun commit direct sur `main`.** Tout le travail se fait sur `develop` ou des feature branches.

---

## Spécification du workflow

### Branches permanentes

| Branche       | Rôle                                                                                                                  | Protections                                                                                                            |
| ------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **`main`**    | **Branche stable** — ne reçoit que des merges de `develop` aux jalons. Chaque commit sur `main` est taggé.            | Merge uniquement depuis `develop` via merge commit (no fast-forward). Pas de push direct.                              |
| **`develop`** | **Branche d'intégration** — reçoit les merges des feature branches en continu. C'est l'état « dernière intégration ». | Merge depuis `feature/*` via merge commit ou squash (au choix du développeur). Pas de push direct de code non-reviewé. |

### Branches éphémères (pré-v1)

| Pattern            | Rôle                                         | Durée de vie            | Merge vers | Exemples                                                                                   |
| ------------------ | -------------------------------------------- | ----------------------- | ---------- | ------------------------------------------------------------------------------------------ |
| `feature/{scope}`  | Nouvelle fonctionnalité, composant, ADR, PoC | Heures → quelques jours | `develop`  | `feature/entity-strate0`, `feature/poc-rollup-plugin-dts`, `feature/adr-0033-git-workflow` |
| `fix/{scope}`      | Correctif d'un bug identifié                 | Heures                  | `develop`  | `fix/channel-memory-leak`, `fix/cache-invalidation`                                        |
| `docs/{scope}`     | Documentation pure (ADR, RFC, guides)        | Heures                  | `develop`  | `docs/adr-0032-build-pipeline`, `docs/contributing-update`                                 |
| `refactor/{scope}` | Refactoring sans changement de comportement  | Heures → jours          | `develop`  | `refactor/builder-dts-cleanup`, `refactor/registry-adr0031`                                |
| `test/{scope}`     | Ajout/modification de tests uniquement       | Heures                  | `develop`  | `test/entity-unit-tests`, `test/build-vitest`                                              |

### Branches additionnelles (post-v1)

| Pattern             | Rôle                                                                | Ajouté quand                                    |
| ------------------- | ------------------------------------------------------------------- | ----------------------------------------------- |
| `release/{version}` | Préparation d'une release (bump version, CHANGELOG, derniers fixes) | Quand Bonsai a des consommateurs externes       |
| `hotfix/{scope}`    | Correctif urgent sur `main` (backporté sur `develop`)               | Quand un bug critique affecte des consommateurs |

### Politique de merge

| Opération                     | Stratégie                                     | Justification                                                                                                       |
| ----------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `feature/*` → `develop`       | **Squash merge** (par défaut) ou merge commit | Squash pour garder un historique `develop` propre. Merge commit si l'historique de la feature a de la valeur        |
| `develop` → `main`            | **Merge commit** (no fast-forward)            | Le merge commit est le jalon. `git log --first-parent main` montre l'historique des releases. `--no-ff` obligatoire |
| `hotfix/*` → `main` (post-v1) | **Merge commit** + cherry-pick vers `develop` | Standard Git Flow                                                                                                   |

### Conventions de commit (rappel — CONTRIBUTING.md)

Tous les commits DOIVENT suivre **Conventional Commits** :

```
<type>(<scope>): <description courte>

<body optionnel — détails, motivation, contexte>

<footer optionnel — BREAKING CHANGE:, Refs:, Closes:>
```

**Types** : `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`

**Breaking changes** : `feat!` ou `fix!` (abrégé) ou footer `BREAKING CHANGE: <description>`.

**Scope** : nom du composant ou du sous-système — `entity`, `channel`, `build`, `adr`, `types`, etc.

**Exemples** :

```bash
# Feature dans strate 0
feat(entity): implement mutate() with Immer produceWithPatches

# Breaking change
feat!(channel): rename TChannelDefinition to TChannelContract

BREAKING CHANGE: TChannelDefinition is renamed to TChannelContract.
Update all Feature implementations.

# Fix
fix(build): resolve rollup-plugin-dts path alias resolution

# Documentation
docs(adr): ADR-0033 Accepted — workflow Git & versioning strategy
```

### Cycle de vie d'une feature

```
1. Créer la branche
   git checkout develop
   git pull origin develop
   git checkout -b feature/entity-strate0

2. Développer + commiter (Conventional Commits)
   git commit -m "feat(entity): implement TEntityStructure base type"
   git commit -m "test(entity): add red tests for mutate()"
   git commit -m "feat(entity): implement mutate() with Immer"

3. Merger vers develop
   git checkout develop
   git merge --squash feature/entity-strate0   # ou --no-ff pour conserver l'historique
   git commit -m "feat(entity): Entity strate 0 — TEntityStructure + mutate()"
   git push origin develop

4. Supprimer la branche
   git branch -d feature/entity-strate0
```

### Cycle de vie d'un jalon (merge develop → main)

```
1. Vérifier que develop est stable
   - Tous les tests passent
   - Build produit un artefact valide
   - Pas de WIP en cours

2. Merger vers main
   git checkout main
   git merge --no-ff develop -m "release: v0.2.0 — fin strate 0"

3. Tagger
   git tag -a v0.2.0 -m "v0.2.0 — Strate 0 complète (Entity, Channel, Radio)"

4. Pousser
   git push origin main --tags

5. Mettre à jour les versions dans les package.json
   (voir §9 — fait AVANT le merge, sur develop)
```

---

## Spécification du versioning

### Version actuelle → version correcte

| État                          | Version | Signification                                         |
| ----------------------------- | ------- | ----------------------------------------------------- |
| **Actuel** (2026-04-14)       | `0.1.0` | Arbitraire — pas de sémantique                        |
| **Après adoption de cet ADR** | `0.1.0` | Conservée — les prochains bumps auront une sémantique |

> On ne bumpe pas la version maintenant. `0.1.0` devient rétroactivement « la baseline pré-strate 0 ». Le prochain bump (`0.1.1` ou `0.2.0`) sera le premier à avoir une sémantique réelle.

### Mapping versions → jalons

| Version      | Jalon                 | Contenu attendu                                                  | Branche            |
| ------------ | --------------------- | ---------------------------------------------------------------- | ------------------ |
| `0.1.0`      | Baseline              | Corpus documentaire + infrastructure (état actuel)               | `main` actuel      |
| `0.1.x`      | Patches strate 0 WIP  | Build pipeline (ADR-0032), PoC, correctifs                       | `develop` → `main` |
| **`0.2.0`**  | **Fin strate 0**      | Entity, Channel, Radio — tests verts, build fonctionnel          | `develop` → `main` |
| `0.2.x`      | Patches post-strate 0 | Correctifs, documentation                                        | `develop` → `main` |
| **`0.3.0`**  | **Fin strate 1**      | Feature, Application — intégration Entity/Channel                | `develop` → `main` |
| `0.3.x`      | Patches post-strate 1 | Correctifs, documentation                                        | `develop` → `main` |
| **`0.4.0`**  | **Fin strate 2**      | Foundation, Composer, View, Behavior, Router — framework complet | `develop` → `main` |
| `0.4.x`      | Patches post-strate 2 | Correctifs, stabilisation                                        | `develop` → `main` |
| `1.0.0-rc.1` | Release candidate     | API gelée, tests E2E complets, documentation finale              | `develop` → `main` |
| `1.0.0-rc.N` | Corrections RC        | Bug fixes uniquement, pas de nouvelles features                  | `develop` → `main` |
| **`1.0.0`**  | **Release publique**  | Framework stable, premier `private: false`, publication npm      | `develop` → `main` |

### Règles de bump

#### Pré-v1 (`0.x.y`) — API instable

| Changement                          | Bump                                        | Exemple           |
| ----------------------------------- | ------------------------------------------- | ----------------- |
| Fin de strate (jalon majeur)        | **MINOR**                                   | `0.1.0` → `0.2.0` |
| Nouvelle feature intra-strate       | **PATCH**                                   | `0.2.0` → `0.2.1` |
| Bug fix                             | **PATCH**                                   | `0.2.1` → `0.2.2` |
| Breaking change intra-strate        | **PATCH** + mention dans CHANGELOG          | `0.2.2` → `0.2.3` |
| Documentation seule                 | Pas de bump                                 | —                 |
| Refactoring interne sans impact API | Pas de bump (ou PATCH si release souhaitée) | —                 |

> **Note SemVer §4** : en `0.x.y`, les breaking changes n'imposent pas de bump MAJOR — c'est explicitement « tout peut changer ». On les documente dans le CHANGELOG mais on ne bumpe que le PATCH.

#### Post-v1 (`x.y.z`) — SemVer strict

| Changement                              | Bump      | Exemple           |
| --------------------------------------- | --------- | ----------------- |
| Breaking change (API publique modifiée) | **MAJOR** | `1.0.0` → `2.0.0` |
| Nouvelle feature (rétrocompatible)      | **MINOR** | `1.0.0` → `1.1.0` |
| Bug fix (rétrocompatible)               | **PATCH** | `1.1.0` → `1.1.1` |

### Versioning synchronisé (monorepo)

**Tous les packages `@bonsai/*` partagent la même version.** Il n'y a pas de versioning indépendant par package.

**Justification** :

- Les packages sont internes au monorepo — ils ne sont pas publiés indépendamment sur npm
- La topologie ADR-0031 fait que les packages ont des dépendances croisées — une version de `@bonsai/entity` n'a de sens qu'avec la version correspondante de `@bonsai/types`
- Pour le consommateur, `@bonsai/core` est le seul point d'entrée — il ne voit qu'une version
- Post-v1, si les packages sont publiés indépendamment, un ADR dédié au versioning indépendant sera créé

**Mécanisme** :

```bash
# Bump de version dans TOUS les package.json simultanément
pnpm -r exec -- npm version 0.2.0 --no-git-tag-version
# Ou via un script dédié (à créer)
```

### CHANGELOG

Un fichier `CHANGELOG.md` est maintenu **à la racine du monorepo**. Format : [Keep a Changelog](https://keepachangelog.com/) avec les sections standard.

**Structure** :

```markdown
# Changelog

Toutes les modifications notables de Bonsai sont documentées ici.
Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/)
Versioning : [SemVer](https://semver.org/lang/fr/)

## [Unreleased]

### Added

- ...

### Changed

- ...

### Fixed

- ...

## [0.2.0] — YYYY-MM-DD — Strate 0

### Added

- Entity : `mutate()` avec Immer (ADR-0001)
- Channel : tri-lane (Commands, Events, Requests) (ADR-0003)
- Radio : singleton pub/sub
- Build pipeline : `rollup-plugin-dts` (ADR-0032)

### Changed

- ...

### Removed

- Build : suppression de 5 893 lignes de bundling DTS custom

## [0.1.0] — 2026-04-14 — Baseline

### Added

- Corpus documentaire : RFC-0001 à RFC-0003, ADR-0001 à ADR-0033
- Infrastructure de build (prototype)
- Infrastructure de test (Jest framework, Vitest build)
- Packages : @bonsai/types, @bonsai/event, @bonsai/rxjs, @bonsai/valibot
```

**Règles** :

- Le CHANGELOG est mis à jour **dans le commit de merge `develop → main`** — pas à chaque commit sur `develop`
- Chaque version liste les ADR impactées (`ADR-XXXX`)
- La section `[Unreleased]` accumule les changements en cours sur `develop`
- **Post-v1** : envisager un outil de génération automatique depuis les Conventional Commits (`conventional-changelog`, `changesets`, ou similaire)

### Tags Git

| Format                            | Quand                         | Exemple                      |
| --------------------------------- | ----------------------------- | ---------------------------- |
| `v{MAJOR}.{MINOR}.{PATCH}`        | Chaque merge `develop → main` | `v0.2.0`, `v0.3.0`, `v1.0.0` |
| `v{MAJOR}.{MINOR}.{PATCH}-rc.{N}` | Release candidates de la v1   | `v1.0.0-rc.1`, `v1.0.0-rc.2` |

**Règles** :

- Tags annotés uniquement (`git tag -a`) — pas de tags légers
- Le message du tag décrit le jalon : `v0.2.0 — Strate 0 complète (Entity, Channel, Radio)`
- Un tag est **immutable** — jamais supprimé ni déplacé

---

## Conséquences

### Positives

- ✅ **Traçabilité** — chaque jalon est un tag sur `main`, chaque strate a un numéro de version, l'historique est lisible via `git log --first-parent main`
- ✅ **Isolation du WIP** — `develop` absorbe le travail quotidien, `main` reste stable. Un build depuis `main` produit toujours un artefact valide
- ✅ **Alignement ADR-0028** — les strates se reflètent directement dans les versions (`0.2.0` = strate 0, `0.3.0` = strate 1, `0.4.0` = strate 2)
- ✅ **SemVer standard** — tout outil npm/pnpm comprend le versioning. Pas de convention exotique
- ✅ **Scalabilité** — passage naturel au Git Flow complet post-v1 (ajout `release/*`, `hotfix/*`)
- ✅ **CHANGELOG** — trace lisible par un humain des changements entre versions, avec références aux ADR
- ✅ **Conventional Commits appliqués** — base pour un changelog automatique post-v1

### Négatives (acceptées)

- ⚠️ **Discipline requise** — les merges `develop → main` doivent être des actes conscients (jalon validé). Risque de merger trop souvent ou pas assez
- ⚠️ **CHANGELOG manuel pré-v1** — pas d'outil de génération automatique. Accepté : le volume de changements est gérable manuellement tant qu'il y a un développeur principal
- ⚠️ **Versioning synchronisé** — si post-v1 les packages sont publiés indépendamment, le modèle devra évoluer (nouvel ADR). Accepté : ce n'est pas un problème v1

### Actions immédiates après adoption

0. **Squasher l'historique** en 1 commit baseline (§8 — Option H2)
1. Poser le tag `v0.1.0` sur le commit squashé
2. Créer la branche `develop` depuis `main`
3. Créer le fichier `CHANGELOG.md` avec la section `[0.1.0]` (baseline)
4. Force push `main` + `develop` + tags vers `origin`
5. Commencer à travailler sur `develop` — plus aucun commit direct sur `main`

---

## Actions de suivi

- [x] Squasher l'historique en 1 commit baseline (§8 — Option H2)
- [x] Poser le tag `v0.1.0` sur le commit squashé
- [x] Créer la branche `develop` depuis `main`
- [ ] Créer `CHANGELOG.md` à la racine (structure Keep a Changelog)
- [ ] Configurer la protection de `main` (no direct push, merge from `develop` only)
- [ ] Mettre à jour `CONTRIBUTING.md` — section Workflow pour refléter le modèle Git Flow adapté (remplacer le workflow actuel basé sur `main`)
- [ ] Créer un script `scripts/bump-version.sh` pour bumper tous les `package.json` synchroniquement
- [ ] Mettre à jour les agents (`dev-framework.agent.md`, `build-framework.agent.md`) pour documenter le workflow Git et les conventions de branches

---

## Références

- [SemVer 2.0.0](https://semver.org/) — Spécification du versioning sémantique
- [Keep a Changelog](https://keepachangelog.com/) — Format de CHANGELOG
- [Conventional Commits](https://www.conventionalcommits.org/) — Convention de messages de commit
- [Git Flow](https://nvie.com/posts/a-successful-git-branching-model/) — Vincent Driessen, 2010
- [ADR-0028](ADR-0028-implementation-phasing-strategy.md) — Phasage kernel-first 3 strates
- [ADR-0029](ADR-0029-v1-scope-freeze.md) — Scope v1 gelé
- [ADR-0032](ADR-0032-build-pipeline-toolchain.md) — Build pipeline toolchain

---

## Historique

| Date       | Changement                                                                                                                                                                                                                                    |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-14 | Création (Proposed) — workflow Git Flow adapté + versioning SemVer `0.x.y`. 4 options Git (Git Flow, Git Flow adapté, GitHub Flow, Trunk-Based), 3 options versioning (SemVer pré-release, strate-based, alpha/beta labels)                   |
| 2026-04-14 | Ajout §8 Gestion de l'historique existant — 3 options (H1 conserver, H2 squash, H3 rebase), décision H2 (squash baseline). Justification : 0 clones, 0 forks, historique illisible, cohérence avec Conventional Commits. Exécution documentée |
| 2026-04-17 | **Accepted** — workflow appliqué de facto (branches `develop` + `feature/*` actives). Passage formalisé suite à feedback review (point 5 : « Proposed mais déjà prescriptif »)                                                                |
