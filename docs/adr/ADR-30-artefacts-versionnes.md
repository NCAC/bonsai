# ADR-30 — Artefacts de build versionnés, reconstruits à chaque changement

| Champ | Valeur |
| --- | --- |
| **Statut** | 🟢 Accepted |
| **Livré** | ⚠️ partiel — artefacts versionnés et reconstruits à la main ; aucune vérification CI de fraîcheur ; les tests tournent contre les sources, pas contre les bundles |
| **Spec** | [lib/BUILD.md](../../lib/BUILD.md) |

## Contexte

`core/dist/bonsai.js` et `bonsai.d.ts` sont dans git. Un ancien `bonsai.d.ts`
jamais reconstruit a provoqué des erreurs dans l'IDE. Le versionnement coûte
aussi des diffs illisibles (le `.d.ts` fait ~25 000 lignes) et des conflits de
fusion. Bonsai n'est pas publié sur npm : la distribution passe par GitHub.

## Décision

**Tout est versionné, et reconstruit à chaque changement de source** :

- versionnés : `core/dist/bonsai.js`, `core/dist/bonsai.d.ts`, `packages/*/dist/` ;
- un commit qui touche une source touche aussi l'artefact correspondant (`pnpm run build:no-watch`) ;
- la CI est censée refuser un artefact périmé ;
- **règle de branche** : seuls les artefacts de `main` tagués `vX.Y.Z` sont contractuels ; `develop` et `feature/*` sont à jour mais non garantis.

Le problème n'était pas le versionnement mais les artefacts périmés.

## Alternatives rejetées

- **Versionnés sans discipline de rebuild** (statu quo antérieur) — désynchronisation garantie.
- **Jamais versionnés** — le contrat public (`bonsai.d.ts`) disparaît du dépôt, plus de `git blame` sur l'API.
- **CI qui valide + workflow de release qui distribue** — complexité sans valeur tant qu'il n'y a pas de registre npm.

## Conséquences

- Les changements d'API publique sont visibles dans le diff de `bonsai.d.ts` d'une PR.
- **Écarts livrés** : aucun job CI ne reconstruit ni ne compare les artefacts (seuls `tsc --noEmit` et `pnpm test:ci` tournent) ; le job prévu s'appuyait sur le script PoC, qui ne passe plus (ADR-29). Jest résout `@bonsai/*` vers les sources : l'argument « e2e contre le bundle réel » n'est pas tenu.
- Les fins de ligne CRLF de certains `packages/*/dist/*.js` produisent des avertissements git à chaque rebuild.
