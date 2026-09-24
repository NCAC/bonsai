# ADR-33 — Workflow git, SemVer, hooks et CI

| Champ | Valeur |
| --- | --- |
| **Statut** | 🟢 Accepted |
| **Livré** | ✅ branches, hooks, CI · ⚠️ jalon strate 0 tagué `v0.1.0-strate-0` (en plus du tag `v0.1.0` de la baseline) au lieu de `v0.2.0` (le `package.json` est resté en `0.1.0`) ; gate de régression limitée à 5 fichiers unitaires de la strate 0 (Channel, Radio, Entity, Feature, View — ni Composer, Foundation, Application) ; `tsc --noEmit` ne vérifie que `lib/` |
| **Spec** | [CONTRIBUTING.md](../../CONTRIBUTING.md) · [CHANGELOG.md](../../CHANGELOG.md) |

## Contexte

Un framework se livre par jalons (fins de strate), pas en flux continu. Un
seul mainteneur, pas de registre npm ni de consommateur externe : le processus
doit protéger `main` sans cérémonie, et attraper une régression avant qu'elle
atteigne la branche d'intégration.

## Décision

**Git Flow adapté, sans `release/*` ni `hotfix/*` avant la v1** :
`feature/*` → PR vers **`develop`** (intégration) → merge vers **`main`** aux
jalons seulement. `main` ne porte que des états validés et tagués.

**SemVer `0.x.y` avant la v1** : **MINOR = fin de strate** (`0.2.0` strate 0,
`0.3.0` strate 1, `0.4.0` strate 2), PATCH = correction intra-strate, `1.0.0` =
API publique stable. Historique dans `CHANGELOG.md` (Keep a Changelog).

**Messages de commit Conventional Commits** : `type(scope)?: description`.

**Vérification à deux niveaux** :

| Niveau | Quand | Quoi | Bloquant |
| --- | --- | --- | --- |
| Hooks Husky | `commit` | `tsc --noEmit` (`lib/` seulement) + `test:regression` (< 30 s) + format du message | local (`--no-verify` possible) |
| | `push` | suite complète | local |
| CI GitHub Actions | push `feature/**` et `fix/**`, PR vers `develop` | `tsc --noEmit` (`lib/` seulement) + `test:ci` (couverture) | oui, via protection de branche |

**Gate de non-régression cumulative** : un fichier `strate-N.regression.test.ts`
qui importe explicitement les suites validées ; chaque PR y ajoute les siennes,
avec son numéro.

## Alternatives rejetées

- **Git Flow complet** (`release/*`, `hotfix/*`) — résout des problèmes qui n'existent pas avant la v1.
- **GitHub Flow / trunk-based** — `main` reçoit du travail en cours ; il faut des jalons, pas du flux.
- **Version codée par strate (`0.<strate>.<patch>`)** ou **labels `alpha.N`** — conventions ambiguës ou verbeuses.
- **Suite complète en pre-commit** — trop lent, donc contourné.
- **Jest `projects` ou tags `@regression`** pour la gate — perdent la trace par PR ou demandent un runner maison.

## Conséquences

- `main` est la seule source contractuelle des artefacts (ADR-30).
- Passer en post-v1 ajoutera `release/*` et `hotfix/*` sans changer de modèle.
- **Écart** : le prochain jalon doit recaler la numérotation (`0.2.0` ou `0.3.0`) et aligner `package.json` sur le tag.
