# ADR-06 — Modes de validation : compile-time, bootstrap, dev, prod

| Champ | Valeur |
| --- | --- |
| **Statut** | 🟢 Accepted |
| **Livré** | ⚠️ partiel — `invariant` / `hardInvariant` / `warning` / `isDev` livrés ; `__DEV__` est défini par la pipeline : `core/dist/bonsai.js` (`true`) et `core/dist/bonsai.prod.js` (`false`, branches de développement éliminées), choisis par la condition `production` de `exports`. ⚠️ Seuls `hardInvariant` (I96) et `isDev` (sink de trace par défaut, O2) ont un appelant ; les bundles par package laissent `__DEV__` libre |
| **Spec** | [validation.md](../spec/6-transversal/validation.md) |

## Contexte

Bonsai veut des erreurs riches en développement (quel invariant, quel
composant, que faire) sans payer ces vérifications en production. Toutes les
vérifications n'ont pas le même statut : certaines protègent la cohérence du
framework et doivent survivre en production, d'autres sont de l'aide au
développeur.

## Décision

Quatre niveaux, par ordre de préférence : **on vérifie au plus tôt possible.**

| Niveau | Quand | Outil | Exemple |
| --- | --- | --- | --- |
| Compile-time | `tsc` | types | nom de message hors contrat, clé de manifest dupliquée |
| Bootstrap | `start()` | erreur dédiée ou `hardInvariant()` — **toujours actifs** | namespace réservé (`BonsaiNamespaceError`), handler dupliqué (`DuplicateHandlerError`), handler Entity pour une clé inconnue (`hardInvariant`, I96) |
| Runtime dev | chaque appel | `invariant()` — éliminé en prod | ⏳ `hop > MAX_HOPS`, validation de schema après `mutate()` (ADR-11) : aucun appelant aujourd'hui |
| Avertissement | chaque appel | `warning()` — dev seul, ne throw jamais | ⏳ indices de performance : aucun appelant aujourd'hui |

```ts
invariant(cond, "Feature cannot emit on a foreign channel", "I1", "cart");
// → BonsaiError "[I1] cart — Feature cannot emit on a foreign channel"
```

`__DEV__` est une constante remplacée par la pipeline de build : le framework
publie un bundle de développement (`true`) et un bundle de production
(`false`), où Rollup élimine les branches mortes. L'application choisit le
bundle par la condition `production` de `exports`. Absente (sources lancées
par les tests, bundles par package), le framework suppose le mode dev : mieux
vaut montrer une erreur que la masquer.

```json
"exports": { ".": { "types": "./dist/bonsai.d.ts", "production": "./dist/bonsai.prod.js", "default": "./dist/bonsai.js" } }
```

Règle de choix : si la violation laisse le framework dans un **état incohérent**,
`hardInvariant` ; si c'est une **aide au diagnostic**, `invariant`.

## Alternatives rejetées

- **Toutes les vérifications toujours actives** — coût en production pour des contrôles déjà garantis par le compilateur.
- **Aucune vérification runtime (confiance totale dans TS)** — ignore `as any`, JS pur et chargement paresseux.
- **Bibliothèque de validation externe pour les invariants** — surdimensionné ; `asserts condition` suffit et apporte le narrowing TypeScript.

## Conséquences

- Dépend du bundler pour l'élimination de code mort (Rollup, `define`).
- La pipeline (ADR-29) construit deux bundles du framework ; le remplacement porte sur l'AST (`lib/build/plugins/rollup-plugin-define.ts`), jamais sur les commentaires ni les chaînes. Preuve : `tests/integration/bundles-dev-prod.test.ts`.
- Le `define` du bundler applicatif ne s'applique plus au framework : seule la condition `production` choisit le bundle. Vite et webpack 5 la posent en build de production ; esbuild (`--conditions=production`) et `@rollup/plugin-node-resolve` (`exportConditions`) doivent la déclarer.
