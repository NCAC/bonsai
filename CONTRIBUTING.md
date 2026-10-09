# 🤝 Guide de Contribution - Framework Bonsai

Bonsai est développé par un mainteneur unique, sans registre npm ni consommateur externe
([ADR-33](docs/adr/ADR-33-workflow-git-ci.md)). Ce guide décrit le processus **réellement en place** ;
les décisions sont dans les [ADR](docs/adr/README.md), les contrats dans la [spec](docs/spec/README.md).

## Table des matières

1. [Types de contributions](#types-de-contributions)
2. [Workflow git](#workflow-git)
3. [Commits](#commits)
4. [Standards de code](#standards-de-code)
5. [Tests et qualité](#tests-et-qualité)
6. [Documentation](#documentation)
7. [Revue](#revue)

---

## Types de contributions

- 🐛 **Bug reports** : étapes de reproduction, version de Node/TypeScript, logs complets.
- ✨ **Feature requests** : cas d'usage, cohérence avec la philosophie (« le type EST le contrat »), discussion dans une issue avant toute implémentation. Le périmètre v1 est **gelé** ([ADR-31](docs/adr/ADR-31-strates-perimetre-v1.md)) : ajouter un élément à la v1 passe par une révision de cet ADR ; les pistes post-v1 vivent dans la [roadmap](docs/ROADMAP.md).
- 📖 **Documentation** : voir [Documentation](#documentation).
- 🔧 **Code** : voir les sections suivantes.

---

## Workflow git

Git Flow adapté, sans `release/*` ni `hotfix/*` avant la v1 (ADR-33) :

`feature/*` (ou `fix/*`) → PR vers **`develop`** → merge vers **`main`** aux jalons seulement. `main` ne porte que des états validés et tagués.

```bash
git checkout develop
git pull
git checkout -b feature/ma-nouvelle-fonctionnalite   # ou fix/correction-bug-123

pnpm install
pnpm test
```

| Type | Format | Exemple |
| --- | --- | --- |
| Feature | `feature/description-courte` | `feature/entity-validation` |
| Correction | `fix/description-courte` | `fix/channel-memory-leak` |
| Documentation | `docs/description-courte` | `docs/api-reference-update` |
| Refactoring | `refactor/description-courte` | `refactor/build-system-optimization` |

**SemVer `0.x.y`** avant la v1 : MINOR = fin de strate, PATCH = correction intra-strate. Historique dans [CHANGELOG.md](CHANGELOG.md).

---

## Commits

Conventional Commits, **type et portée en anglais, description en français** (ADR-33, [ADR-34](docs/adr/ADR-34-documentation-francais.md)) :

```text
<type>(<portée>): <description en français>
```

Types acceptés par le hook `commit-msg` : `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `ci`, `build` (pas de `style`). Un `!` après la portée marque un changement cassant.

```text
refactor(entity): messages d'erreur en anglais
refactor(i18n): JSDoc en anglais — @bonsai/view
docs(adr): ADR-34 — JSDoc en anglais, commits en français
docs(spec): S5 — référence et devtools alignés sur les ADR
```

### Hooks Husky

| Hook | Vérifie | Bloquant |
| --- | --- | --- |
| `commit-msg` | format Conventional Commits | local |
| `pre-commit` | `tsc --noEmit` (⚠️ `lib/` seulement), `pnpm test:regression`, puis `lib/check-adr-tested-status.ts` (informatif) | local (`--no-verify` possible) |
| `pre-push` | suite complète `pnpm test` | local |

### CI

Workflow `.github/workflows/regression.yml` : sur push `feature/**` et `fix/**` et sur PR vers `develop`, `pnpm tsc --noEmit` (⚠️ `lib/` seulement) puis `pnpm test:ci` (couverture). Un échec bloque le merge via la protection de branche.

---

## Standards de code

Conventions complètes : [FRAMEWORK-STYLE-GUIDE](docs/guides/FRAMEWORK-STYLE-GUIDE.md) (`packages/`, `core/`) et [BUILD-CODING-STYLE](docs/guides/BUILD-CODING-STYLE.md) (`lib/`, `tools/`). Points clés du code framework :

- **Nommage des types** : `T` + PascalCase pour la surface développeur (`TChannelDefinition`), PascalCase sans préfixe pour la plomberie type-level (`StrictManifest`), `type` plutôt qu'`interface`.
- **Encapsulation** : `#field` (hard private ES2022) ; `private` TypeScript seulement pour `private constructor()`.
- **Signatures** : discriminant en premier argument, puis objet de paramètres (`mutate("cart:addItem", { payload }, recipe)`).
- **Langues** : code, JSDoc et commentaires en **anglais** ; documentation et commits en **français** (ADR-34).
- **Artefacts versionnés** : toute modification de source dans `packages/` ou `core/` s'accompagne de `pnpm run build:no-watch` ([ADR-30](docs/adr/ADR-30-artefacts-versionnes.md)).

> ⚠️ **Configuration TypeScript** : aucun `tsconfig` du dépôt n'active `strict`, et le contrat `Feature<TEntity, …>` ne compile pas sous `strictFunctionTypes` ([ADR-14](docs/adr/ADR-14-contrats-types.md)). Ne pas activer `strict` sans traiter ce point. Il n'y a ni ESLint ni script `lint` : le formatage repose sur Prettier côté éditeur.

Exemple minimal conforme (extrait de [`tests/fixtures/cart-feature.fixture.ts`](tests/fixtures/cart-feature.fixture.ts)) :

```ts
class CartFeature
  extends Feature<CartEntity, TCartChannelDef, "cart">
  implements TFeatureCallbacks<TCartChannelDef, typeof cartListens>
{
  static readonly channel: TChannelToken<TCartChannelDef, "cart"> = { namespace: "cart" };
  get listens() { return cartListens; }
  get queries() { return [] as const; }
  protected get Entity() { return CartEntity; }

  onAddItemCommand(payload: TCartItem): void {
    this.entity.mutate("addItem", (draft) => { draft.items.push(payload); });
    this.emit("itemAdded", { item: payload });
  }
}
```

---

## Tests et qualité

Guide détaillé : [TESTING.md](docs/guides/TESTING.md) ([ADR-32](docs/adr/ADR-32-tests-preuve-architecture.md) : les tests sont une preuve d'architecture).

```bash
pnpm test                                  # suite complète (Jest, ts-jest en isolatedModules)
pnpm test:unit | test:integration | test:e2e
pnpm test:strate-0:regression              # gate de régression strate 0
pnpm test:coverage                         # couverture ; seuils dans jest.config.ts
npx tsc --noEmit -p tsconfig.test.json     # type-check de packages/ + tests/ — À LANCER À LA MAIN
```

- **TDD** : écrire le test d'abord, dans `tests/unit/strate-N/<composant>.<sujet>.test.ts`.
- **Citer l'invariant prouvé** (`I<N>`) dans l'en-tête du fichier et dans les `describe`/`it` (ADR-32) ; `lib/check-adr-tested-status.ts` liste les ADR promouvables.
- **Jest ne type-check pas** : les tests de `tests/types/` (`@ts-expect-error`) ne sont vérifiés que par la commande `tsc` ci-dessus. Avant de merger un changement touchant les types publics, la lancer.
- **Gate de non-régression cumulative** (ADR-33) : chaque PR ajoute ses fichiers de test à `tests/unit/strate-N/strate-N.regression.test.ts`, avec le numéro de PR :

  ```ts
  // ── PR #N — Description courte ──────────────────────────
  import "./mon-nouveau.test";
  ```

  ⚠️ Aujourd'hui la gate strate 0 n'importe que Channel, Radio, Entity, Feature et View.
- **Seuils de couverture** figés dans `jest.config.ts` : toute régression fait échouer la CI.
- **Ne pas casser** la gate E2E `tests/e2e/strate-0.cart-round-trip.test.ts`.

---

## Documentation

Point d'entrée : [docs/README.md](docs/README.md). Toute la documentation est en **français** (ADR-34).

- **Spec** (`docs/spec/`) : le *quoi*, contrat cible ; chaque section non livrée porte un encadré ⏳ qui renvoie à l'ADR.
- **ADR** (`docs/adr/`) : le *pourquoi*, 30 à 80 lignes, **vivants** (réécrits en place), modèle [TEMPLATE.md](docs/adr/TEMPLATE.md), ligne **Livré** (✅/⚠️/⏳) écrite depuis le code livré.
- **Le code fait foi** : en cas d'écart doc ↔ code, corriger la documentation (ou consigner l'écart dans la ligne **Livré**), jamais l'inverse sans décision.
- Vérifier les liens et ancres après tout renommage de titre.

---

## Revue

Mainteneur unique : la revue vérifie les points suivants.

- [ ] Code conforme aux conventions ci-dessus ; architecture respectée (flux `View → Command → Feature → Event → View`)
- [ ] Tests ajoutés (TDD), invariants cités, gate de régression mise à jour
- [ ] `pnpm test` vert ; `npx tsc --noEmit -p tsconfig.test.json` vert
- [ ] `pnpm run build:no-watch` relancé si `packages/` ou `core/` ont changé
- [ ] Documentation alignée (ADR/spec/guides) ; changement cassant noté dans le CHANGELOG

---

## Ressources

- 📖 [Documentation](docs/README.md) · 🔧 [Build system](lib/DEVELOPER-GUIDE.md) · 🤖 [Agent de développement](.github/agents/dev-framework.agent.md)
- **Outils** : VS Code + Dev Container, Jest (framework), Husky, GitHub Actions.
