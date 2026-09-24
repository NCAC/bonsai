# ADR-06 — Modes de validation : compile-time, bootstrap, dev, prod

| Champ | Valeur |
| --- | --- |
| **Statut** | 🟢 Accepted |
| **Livré** | ⚠️ partiel — `invariant` / `hardInvariant` / `warning` livrés, mais seul `hardInvariant` a un appelant (I96) ; `__DEV__` n'est défini par aucun build, donc `invariant()` n'est **jamais** éliminé en production |
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

`__DEV__` est une constante injectée par le bundler. Absente, le framework
suppose le mode dev : mieux vaut montrer une erreur que la masquer.

Règle de choix : si la violation laisse le framework dans un **état incohérent**,
`hardInvariant` ; si c'est une **aide au diagnostic**, `invariant`.

## Alternatives rejetées

- **Toutes les vérifications toujours actives** — coût en production pour des contrôles déjà garantis par le compilateur.
- **Aucune vérification runtime (confiance totale dans TS)** — ignore `as any`, JS pur et chargement paresseux.
- **Bibliothèque de validation externe pour les invariants** — surdimensionné ; `asserts condition` suffit et apporte le narrowing TypeScript.

## Conséquences

- Dépend du bundler pour l'élimination de code mort (Rollup, `define`).
- ⚠️ À corriger : la pipeline de build (ADR-29) doit définir `__DEV__` (`false` pour le bundle de production), sinon le « zéro overhead en prod » n'est pas tenu.
