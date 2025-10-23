# Bonsai Build System Cache — Suivi des Problèmes et Solutions (WIP)

## Enjeux du cache dans le build Bonsai

Le système de cache du build Bonsai v2 vise à accélérer les temps de compilation et à garantir la cohérence des artefacts générés. Il permet d'éviter de recompiler ou re-bundler des packages ou des librairies dont le contenu ou la version n'a pas changé. Cela est crucial pour :

- Réduire le temps de build, notamment dans des monorepos avec de nombreuses dépendances.
- Garantir la reproductibilité des builds (mêmes entrées → mêmes sorties).
- Limiter les accès disque et la consommation CPU lors de builds successifs.
- Permettre des builds incrémentaux fiables, même en CI/CD.

## Fonctionnement du cache dans le processus de build

Le build Bonsai utilise deux types de cache :

- **Cache des packages** (`.bonsai-cache/cache-index.json`) : basé sur un hash du contenu du package (sources, config, etc). Si le hash n'a pas changé, le build est court-circuité et les artefacts sont restaurés.
- **Cache des librairies** (`.bonsai-cache/library-cache.json`) : basé sur la version de la dépendance (ex : rxjs). Si la version n'a pas changé, le build de la librairie est évité.

### Étapes clés du processus :

1. **Avant le build**
   - Pour chaque package/librairie, le build-orchestrator interroge le cache correspondant (package ou librairie).
   - Si le cache est valide (hash ou version identique), le build est court-circuité.
2. **Après le build**
   - Si un build a eu lieu, le cache est mis à jour (hash recalculé ou version enregistrée).
   - Les fichiers de cache sont persistés sur disque.
3. **Logs**
   - Des logs explicites sont générés à chaque étape pour faciliter le debug et la validation du mécanisme.

## Problème rencontré

Le système de cache du build Bonsai v2 fonctionne correctement pour les packages (hash-based), mais le cache des libraries (version-based) ne persiste pas les entrées comme attendu. Plus précisément, le fichier `.bonsai-cache/library-cache.json` reste vide ou incomplet, car la détection de version des dépendances (ex : `rxjs`) échoue. Cela empêche la réutilisation efficace du cache lors des builds suivants.

### Symptômes

- `.bonsai-cache/cache-index.json` (cache des packages) est bien rempli et utilisé.
- `.bonsai-cache/library-cache.json` (cache des libraries) reste vide ou n'est pas mis à jour.
- Les logs de debug montrent que la méthode de détection de version (`getLibraryVersion`) ne trouve pas la version de certaines dépendances.

## Analyse des causes

- La logique actuelle tente de lire la version des dépendances dans le `pnpm-lock.yaml`, mais ce format est complexe et sujet à variations.
- Certaines dépendances (ex : `@bonsai/rxjs`) ne sont pas trouvées ou leur version n'est pas extraite correctement.

## Solutions envisagées

1. **Lecture directe dans `node_modules/<dep>/package.json`**
   - Avantage : fiable, standard, fonctionne pour toutes les dépendances installées.
   - Inconvénient : nécessite que les modules soient installés localement.
2. **Utilisation de `pnpm list --json`**
   - Avantage : donne la version exacte résolue par pnpm, même pour les dépendances transitive.
   - Inconvénient : nécessite d'exécuter une commande externe, parsing JSON.
3. **Fallback sur le lockfile**
   - Garder la logique actuelle comme solution de secours si les deux méthodes précédentes échouent.

## Solution retenue (à implémenter)

- Tenter d'abord la lecture dans `node_modules/<dep>/package.json`.
- Si échec, utiliser `pnpm list --json` pour obtenir la version.
- En dernier recours, parser le lockfile.
- Ajouter des logs explicites à chaque étape pour faciliter le debug.

## Validation du fonctionnement du cache

### Pour les packages

- Vérifier que `.bonsai-cache/cache-index.json` est bien mis à jour après un build.
- Relancer un build sans modification : vérifier que les entrées du cache sont utilisées (logs explicites).
- Supprimer le cache, relancer un build, vérifier la régénération.

### Pour les libraries

- Vérifier que `.bonsai-cache/library-cache.json` contient bien les versions des dépendances après build.
- Modifier la version d'une dépendance, relancer le build, vérifier l'invalidation du cache.
- Observer les logs pour s'assurer que la version est bien détectée et que le cache est utilisé.

### Tests automatisés

- Ajouter des tests unitaires et d'intégration pour :
  - La persistance du cache sur disque.
  - L'invalidation du cache lors d'un changement de version/hash.
  - L'utilisation effective du cache lors de builds successifs.

## Documentation et logs

- Documenter la logique de détection de version dans le code et dans ce fichier.
- Nettoyer les logs de debug une fois la solution validée, mais garder des logs explicites pour les cas d'échec de détection.

---

_Dernière mise à jour : 27/06/2025_
