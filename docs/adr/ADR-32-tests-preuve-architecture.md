# ADR-32 — Tests = preuve d'architecture, statut `Tested`

| Champ | Valeur |
| --- | --- |
| **Statut** | 🟢 Accepted |
| **Livré** | ✅ structure et script `lib/check-adr-tested-status.ts` · ⚠️ le script est informatif (non bloquant) et ne vérifie qu'une citation textuelle `I<N>` ; les tests de type ne sont vérifiés par aucun hook ni job CI (voir Conséquences) |
| **Spec** | [TESTING.md](../guides/TESTING.md) |

## Contexte

Un invariant non testé est une intention, pas une garantie. Il faut savoir,
pour chaque règle d'architecture, quel test la prouve ; pouvoir valider une
strate sans exécuter les suivantes ; et qu'un ADR marqué « fait » le soit
vraiment. L'audit de 2026-09 a trouvé plusieurs ADR `Tested` dont le contrat
n'était pas livré.

## Décision

**Arborescence composant × strate, avec traçabilité par citation :**

```text
tests/
├── unit/strate-N/    # un fichier par composant et par point dur
├── types/            # compile-time : @ts-expect-error, sans exécution
├── integration/      # scénarios multi-packages
├── e2e/              # gates de strate (ADR-31), vrai DOM (jsdom), sans mock
└── fixtures/         # CartFeature, etc.
```

- Chaque fichier annonce en en-tête les invariants qu'il prouve ; les `describe`/`it` citent `I<N>`.
- Les tests compile-time vivent à part : si un `@ts-expect-error` ne déclenche plus d'erreur, le typage s'est relâché et `tsc` échoue (TS2578) — vérifié par `pnpm tsc:check:tests` (pre-commit et CI).
- Les seuils de couverture sont figés dans `jest.config.ts` ; une baisse fait échouer la CI.

**Statut d'un ADR** — `🟡 Proposed → 🟢 Accepted → 🔵 Tested` :

- **Tested** exige une ligne **Livré** ✅ **et** :
  - *(invariants)* chaque `I<N>` de la ligne « Invariants impactés » est cité dans au moins un test exécutable ;
  - *(sans invariant)* la sémantique décrite est couverte par un test, validé en revue.
- Un ADR de **processus** (phasage, workflow, langue) reste `Accepted` : aucun test ne prouve une décision de process.
- Une livraison ⚠️ ou ⏳ interdit `Tested`, même si les citations existent.
- Les ADR sont vivants (réécrits en place) : plus de `Superseded` ni `Suspended`.

## Alternatives rejetées

- **Tests par composant sans traçabilité** — impossible de savoir ce qui est prouvé.
- **Un fichier par invariant** — des dizaines de fichiers triviaux, pas de vue par composant.
- **Double champ « Statut » + « Statut de test »** — deux colonnes à lire pour un seul état.
- **Statut par strate** — plus fin que le besoin.

## Conséquences

- `lib/check-adr-tested-status.ts` liste les ADR promouvables (hook pre-commit, sortie toujours 0).
- **Limite** : la citation est un simple jeton textuel ; un `I4` écrit dans n'importe quel test compte. La vérification de fond reste la revue.
- **Tests de type** : Jest (`ts-jest`, `isolatedModules`) ne type-check pas `tests/`, et `pnpm tsc:check` ne couvre que `lib/`. `pnpm tsc:check:tests` (`tsconfig.test.json`, hors mode `strict`) vérifie `tests/` et `packages/` ; il est lancé par le pre-commit et la CI, si bien qu'un `@ts-expect-error` devenu inutile bloque le commit.
