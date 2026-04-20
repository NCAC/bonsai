# ADR-0035 : Build Artifacts Versioning Strategy

| Champ         | Valeur                                              |
| ------------- | --------------------------------------------------- |
| **Statut**    | 🟢 Accepted                                         |
| **Date**      | 2026-04-17                                          |
| **Décideurs** | @ncac                                               |
| **RFC liée**  | ADR-0032 (DTS bundling), ADR-0034 (regression gate) |

---

## Contexte

Le monorepo Bonsai produit deux catégories d'artefacts de build :

1. **Bundle JS** (`bonsai.js`) — le code exécutable du framework
2. **Bundle DTS** (`bonsai.d.ts`) — le contrat TypeScript bundlé (flat `.d.ts`)

Ces artefacts sont aujourd'hui **versionnés dans git** (`core/dist/bonsai.js`, `core/dist/bonsai.d.ts`), hérité de l'époque Marionext. Cela pose plusieurs problèmes :

- **Diffs massifs** : le `.d.ts` bundlé fait ~24 700 lignes (1 MB). Chaque PR qui modifie un type génère un diff illisible.
- **Merge conflicts** : les fichiers générés sont une source constante de conflits artificiels entre branches.
- **Désynchronisation** : risque d'oublier de rebuilder avant le commit → artefact en décalage avec les sources.
- **Bruit dans l'historique** : `git log` et `git blame` sont pollués par des commits de rebuild.
- **Double source de vérité** : les sources `.ts` ET les artefacts `.d.ts` coexistent — lequel fait foi ?

### Déclencheur

L'ajout de `@bonsai/immer` (Tier 3 opaque) a mis en évidence que l'ancien `core/dist/bonsai.d.ts` (pré-Channel tri-lane) provoquait des erreurs IDE car il ne correspondait plus aux sources actuelles.

---

## Contraintes

- **C1 — Déterminisme** : même source → même artefact. Le build est reproductible.
- **C2 — Validabilité** : le PoC ADR-0032 (`run-poc.ts`) valide déjà 8 critères (VC1–VC8) sur la pipeline de build.
- **C3 — Consommabilité** : les artefacts doivent être accessibles pour les consommateurs du framework (release).
- **C4 — CI existante** : GitHub Actions est déjà configuré (`.github/workflows/regression.yml`).
- **C5 — Pas de registry npm** : Bonsai n'est pas publié sur npm pour l'instant. Distribution via GitHub.

---

## Options considérées

### Option A — Artefacts versionnés dans git (statu quo)

**Description** : Conserver `core/dist/bonsai.js` et `core/dist/bonsai.d.ts` dans le repo. Rebuilder et committer à chaque PR.

| Avantages                                  | Inconvénients                                           |
| ------------------------------------------ | ------------------------------------------------------- |
| + Contrat visible directement dans le repo | - Diffs de 24K+ lignes sur chaque PR touchant les types |
| + `git blame` sur le `.d.ts`               | - Merge conflicts constants sur fichiers générés        |
| + Consommable sans build                   | - Risque de désynchronisation source ↔ artefact         |
|                                            | - Bruit massif dans l'historique git                    |
|                                            | - Double source de vérité                               |

---

### Option B — Artefacts éphémères, jamais versionnés

**Description** : Supprimer `core/dist/` du tracking git. Les artefacts ne sont jamais stockés — uniquement générés localement ou en CI pour validation.

| Avantages                                | Inconvénients                               |
| ---------------------------------------- | ------------------------------------------- |
| + Repo propre, zéro fichier généré       | - Pas de visibilité du contrat dans le repo |
| + Zéro conflit de merge                  | - Build obligatoire pour consommer          |
| + Single source of truth = sources `.ts` | - Pas d'artefact distribuable               |

---

### Option C — Hybride : CI valide, releases distribuent

**Description** : Les artefacts **ne sont pas versionnés** dans git au quotidien. La CI valide la pipeline de build à chaque PR (PoC VC1–VC8). Les artefacts sont buildés et attachés comme **release assets** GitHub uniquement lors d'un tag de release (`v0.x.y`).

| Avantages                                                  | Inconvénients                                         |
| ---------------------------------------------------------- | ----------------------------------------------------- |
| + Repo propre au quotidien                                 | - Pas de `.d.ts` consultable directement dans le repo |
| + CI garantit l'intégrité à chaque PR                      | - Workflow release à mettre en place                  |
| + Single source of truth = sources `.ts`                   |                                                       |
| + Artefacts distribués via GitHub Releases                 |                                                       |
| + Le PoC `run-poc.ts` devient le test de pipeline officiel |                                                       |
| + Zéro conflit de merge sur fichiers générés               |                                                       |

---

### Option D — Tout versionné + rebuild systématique + règle de branche

**Description** : Tous les artefacts (`core/dist/` + `packages/*/dist/`) sont versionnés dans git. Le rebuild est **obligatoire avant chaque merge**. La CI valide la cohérence (PoC VC1–VC8) et les tests d'intégration/e2e tournent contre les bundles réels. Seuls les artefacts de la branche `main` (tagués release) sont considérés comme consommables par d'autres équipes.

| Avantages                                                | Inconvénients                                                                            |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| + Contrat visible directement dans le repo               | - Diffs volumineux sur les PR touchant les types (~24K lignes `.d.ts`)                   |
| + Tests e2e/intégration sans faux positifs (bundle réel) | - Discipline de rebuild obligatoire (mitigé par CI)                                      |
| + Traçabilité complète (`git blame` sur le `.d.ts`)      | - Conflits de merge possibles sur fichiers générés (mitigé par feature branches courtes) |
| + Zéro erreur IDE — artefacts toujours à jour            |                                                                                          |
| + Pas besoin de workflow release séparé                  |                                                                                          |
| + Distribution immédiate via `git clone`                 |                                                                                          |

**Règle de branche** :

- `main` : artefacts **font foi** — seuls ceux-ci sont consommables par d'autres équipes
- `develop` : artefacts à jour mais non garantis pour consommation externe
- `feature/*` : artefacts rebuildés avant merge, validés par CI

---

## Analyse comparative

| Critère                  | Option A (statu quo) | Option B (éphémère) | Option C (hybride) | Option D (tout + discipline) |
| ------------------------ | -------------------- | ------------------- | ------------------ | ---------------------------- |
| Propreté du repo         | ⭐                   | ⭐⭐⭐              | ⭐⭐⭐             | ⭐⭐                         |
| Risque désynchronisation | ⭐                   | ⭐⭐⭐              | ⭐⭐⭐             | ⭐⭐⭐ (CI enforce)          |
| Visibilité contrat       | ⭐⭐⭐               | ⭐                  | ⭐⭐               | ⭐⭐⭐                       |
| Distribuabilité          | ⭐⭐                 | ⭐                  | ⭐⭐⭐             | ⭐⭐⭐                       |
| Complexité CI            | ⭐⭐⭐               | ⭐⭐                | ⭐⭐               | ⭐⭐                         |
| Conflits de merge        | ⭐                   | ⭐⭐⭐              | ⭐⭐⭐             | ⭐⭐ (feature branches)      |
| DX quotidienne           | ⭐⭐                 | ⭐⭐⭐              | ⭐⭐⭐             | ⭐⭐⭐ (IDE toujours juste)  |
| Tests e2e fiabilité      | ⭐⭐                 | ⭐⭐                | ⭐⭐               | ⭐⭐⭐ (bundle réel)         |

---

## Décision

Nous choisissons **Option D — Tout versionné + rebuild systématique + règle de branche** parce que :

1. **Les tests d'intégration et e2e doivent tourner contre les bundles réels** — pas contre les sources `.ts` résolues par des path aliases. Les artefacts versionnés garantissent zéro faux positif dans la pipeline de test.
2. **Les artefacts stale sont le vrai problème, pas le versionnement** — l'ancien `core/dist/bonsai.d.ts` causait des erreurs IDE parce qu'il n'était pas rebuildé. Si la CI enforce le rebuild, la désynchronisation est impossible.
3. **Traçabilité du contrat public** — `git blame` sur `bonsai.d.ts` permet de savoir exactement quelle PR a modifié le contrat exposé. Les diffs de `.d.ts` dans les PR révèlent les changements d'API (breaking ou non).
4. **Distribution immédiate** — un `git clone` + checkout du tag suffit pour consommer le framework. Pas besoin de workflow release ni de build local.
5. **Règle de branche** — seuls les artefacts sur `main` (tagués release) sont garantis pour consommation externe. Les branches `develop` et `feature/*` ont des artefacts à jour mais non contractuels.

**Option A rejetée** : même approche mais sans la discipline de rebuild ni la CI comme gardien → désynchronisation garantie.

**Option B rejetée** : les tests e2e/intégration perdent en fiabilité sans bundle réel, et la visibilité du contrat public disparaît du repo.

**Option C non retenue** : la surcouche release workflow ajoute de la complexité sans valeur supplémentaire puisque les artefacts sont déjà dans git.

---

## Conséquences

### Positives

- ✅ **Tests e2e sans faux positifs** — les tests d'intégration consomment les bundles réels, pas des résolutions de path aliases
- ✅ **Zéro erreur IDE** — les artefacts sont toujours à jour grâce au rebuild obligatoire
- ✅ **Traçabilité du contrat** — `git blame` et diffs de PR sur les `.d.ts` révèlent les changements d'API
- ✅ **Distribution immédiate** — `git clone` suffit, pas de build local requis
- ✅ **CI comme gardien** — `run-poc.ts` (VC1–VC8) valide la cohérence à chaque PR
- ✅ **Règle de branche claire** — `main` = consommable, le reste = work in progress

### Négatives (acceptées)

- ⚠️ **Diffs volumineux** — le `.d.ts` bundlé fait ~24K lignes. Les PR touchant les types génèrent des diffs importants — accepté car ces diffs ont une valeur (visualiser les changements d'API). Les reviewers peuvent ignorer le fichier `.d.ts` et se concentrer sur les sources.
- ⚠️ **Discipline de rebuild** — oublier de rebuilder avant commit → CI échoue. Mitigé par un script npm `prebuild` ou un hook pre-commit (post-v1).
- ⚠️ **Conflits de merge sur fichiers générés** — mitigé par des feature branches courtes (ADR-0033) et le fait qu'un rebuild résout toujours le conflit mécaniquement.

### Risques identifiés

- 🔶 **Oubli de rebuild** — mitigation : CI vérifie que les artefacts sont cohérents avec les sources (job `build-validation`). Si incohérent → PR bloquée.
- 🔶 **Taille du repo** — les bundles ajoutent ~1 MB par rebuild. Mitigé par le fait que git compresse bien les fichiers texte et que les deltas sont petits entre commits.

---

## Implémentation

### Étape 1 — Rebuilder les artefacts stale (immédiat)

Rebuilder `core/dist/bonsai.js` et `core/dist/bonsai.d.ts` à partir des sources actuelles pour éliminer les erreurs IDE :

```bash
# Rebuilder via le PoC (génère le .d.ts bundlé)
npx tsx lib/build/__poc__/run-poc.ts
# Copier le .d.ts bundlé vers core/dist/
cp lib/build/__poc__/out/bonsai.d.ts core/dist/bonsai.d.ts
```

> **Note** : le build JS (`bonsai.js`) nécessite la pipeline de build complète (ADR-0032).
> Pour l'instant, seul le `.d.ts` est produisible via le PoC. Le `.js` sera adressé quand
> la pipeline de build JS sera en place.

### Étape 2 — CI : intégrer le PoC comme job de validation

Ajouter un job `build-validation` au workflow GitHub Actions existant :

```yaml
# .github/workflows/regression.yml (ou dédié)
build-validation:
  name: Build Pipeline Validation (VC1–VC8)
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: pnpm
    - run: pnpm install --frozen-lockfile
    - run: npx tsx lib/build/__poc__/run-poc.ts
```

### Étape 3 — Script npm de rebuild

```jsonc
// package.json
{
  "scripts": {
    "build:dts": "tsx lib/build/__poc__/run-poc.ts && cp lib/build/__poc__/out/bonsai.d.ts core/dist/bonsai.d.ts"
  }
}
```

### Règle de branche — consommabilité des artefacts

| Branche                 | Artefacts                         | Consommable par d'autres équipes ?    |
| ----------------------- | --------------------------------- | ------------------------------------- |
| `main` (tagué `vX.Y.Z`) | Rebuildés, validés par CI, tagués | ✅ **Oui — seule source officielle**  |
| `develop`               | Rebuildés, validés par CI         | ⚠️ Non garanti — use at your own risk |
| `feature/*`             | Rebuildés avant merge             | ❌ Non — work in progress             |

### Quels artefacts sont versionnés

| Répertoire               | Contenu                          | Versionné ?                         |
| ------------------------ | -------------------------------- | ----------------------------------- |
| `core/dist/bonsai.d.ts`  | Méga-bundle DTS (contrat public) | ✅ Oui                              |
| `core/dist/bonsai.js`    | Bundle JS du framework           | ✅ Oui (quand pipeline JS en place) |
| `packages/rxjs/dist/`    | `rxjs.js` + `rxjs.d.ts`          | ✅ Oui                              |
| `packages/immer/dist/`   | `immer.js` + `immer.d.ts`        | ✅ Oui (à builder)                  |
| `packages/valibot/dist/` | `valibot.js` + `valibot.d.ts`    | ✅ Oui (à builder)                  |
| `lib/build/__poc__/out/` | Sortie PoC temporaire            | ❌ Non — `.gitignore`               |

---

## Actions de suivi

- [ ] Rebuilder `core/dist/bonsai.d.ts` depuis les sources actuelles (PoC)
- [ ] Builder `packages/immer/dist/` (immer.js + immer.d.ts)
- [ ] Builder `packages/valibot/dist/` (valibot.js + valibot.d.ts)
- [ ] Intégrer `run-poc.ts` comme job CI dans `.github/workflows/regression.yml`
- [ ] Ajouter script npm `build:dts` dans `package.json`
- [ ] Mettre à jour ADR-0032 §11 pour référencer cette stratégie
- [ ] (Post-v1) Ajouter un hook pre-commit ou CI check pour détecter les artefacts stale

---

## Références

- [ADR-0032](ADR-0032-dts-bundling-strategy.md) — DTS bundling strategy
- [ADR-0034](ADR-0034-cumulative-regression-gate.md) — Cumulative regression gate
- [ADR-0033](ADR-0033-git-workflow-versioning-strategy.md) — Git workflow & versioning
- [PoC run-poc.ts](../../lib/build/__poc__/run-poc.ts) — Validation pipeline VC1–VC8

---

## Historique

| Date       | Changement                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------- |
| 2026-04-17 | Création — Proposed (Option B éphémère)                                                     |
| 2026-04-17 | Révisé — **Accepted (Option D)** : tout versionné + rebuild systématique + règle de branche |
