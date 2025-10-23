# Gestion du cache dans le build Bonsai

## Fonctionnement détaillé du système de cache

Le système de cache du build Bonsai repose sur deux mécanismes principaux : un cache pour les packages internes et un cache pour les bibliothèques externes (wrappers). Chaque mécanisme s’appuie sur des fichiers de persistance distincts et des stratégies adaptées à la nature des composants.

### 1. Fichiers principaux du cache

- **.bonsai-cache/cache-index.json**

  - Contient le cache des packages internes Bonsai.
  - Structure : une map `{ cheminPackage: hash }`.
  - Géré par la classe `PackageCache` (lib/build/cache/package-cache.class.ts).
  - Mis à jour à chaque build de package : si le hash des sources n’a pas changé, le build est court-circuité.

- **.bonsai-cache/library-cache.json**
  - Contient le cache des bibliothèques externes (wrappers Bonsai).
  - Structure : une map `{ nomLibrairie: version }`.
  - Géré par la classe `LibraryCache` (lib/build/cache/library-cache.class.ts).
  - Mis à jour à chaque build de wrapper : si la version de la dépendance n’a pas changé, le build est court-circuité.

### 2. Orchestration et ordre d’exécution

1. **Initialisation**

   - Le build orchestrator (`build-orchestrator.class.ts`) initialise le cache en appelant `waitReady()` sur les singletons `BuildCache`, `PackageCache` et `LibraryCache`.
   - Les fichiers `.bonsai-cache/cache-index.json` et `.bonsai-cache/library-cache.json` sont lus (créés si absents).

2. **Build des bibliothèques externes**

   - Pour chaque wrapper Bonsai (ex : @bonsai/rxjs), `LibraryCache.isValid()` vérifie la version de la dépendance (via `pnpm list --json`).
   - Si la version n’a pas changé, le build est court-circuité.
   - Sinon, le wrapper est rebuilder, puis `LibraryCache.write()` met à jour le cache et persiste dans `library-cache.json`.

3. **Build des packages internes**

   - Pour chaque package, `PackageCache.isValid()` calcule le hash de tous les fichiers sources.
   - Si le hash n’a pas changé, le build est court-circuité.
   - Sinon, le package est rebuilder, puis `PackageCache.write()` met à jour le cache et persiste dans `cache-index.json`.

4. **Nettoyage et maintenance**
   - Les méthodes `cleanOldEntries` (pour les entrées obsolètes) et `clearCache` (pour vider tout le cache) sont disponibles dans `BuildCache`.
   - Les fichiers de cache sont automatiquement mis à jour après chaque build.

### 3. Récapitulatif des fichiers et rôles

- `/bonsai/lib/build/cache/build-cache.class.ts` : Orchestrateur général du cache, expose les méthodes utilitaires et le singleton global.
- `/bonsai/lib/build/cache/package-cache.class.ts` : Gestion du cache des packages internes, persistance dans `cache-index.json`.
- `/bonsai/lib/build/cache/library-cache.class.ts` : Gestion du cache des bibliothèques externes, persistance dans `library-cache.json`.
- `/bonsai/lib/build/building/build-orchestrator.class.ts` : Orchestration du build, initialisation et utilisation des caches.
- `.bonsai-cache/cache-index.json` : Cache persistant des packages internes.
- `.bonsai-cache/library-cache.json` : Cache persistant des bibliothèques externes.

### 4. Ordre d’utilisation lors d’un build

1. Initialisation des caches (lecture ou création des fichiers de cache).
2. Vérification du cache pour chaque composant (package ou wrapper).
3. Build uniquement si le cache est invalide.
4. Mise à jour et persistance du cache après chaque build effectif.

---

Pour plus de détails sur les stratégies et l’API, voir les fichiers sources et la documentation technique associée.

# Gestion du cache dans le build Bonsai

## À quoi sert le cache de build ?

Le cache de build a pour objectif principal d’accélérer le processus de compilation en évitant de rebuilder inutilement des artefacts qui n’ont pas changé. Il permet de :

- **Réduire le temps de build** : seuls les fichiers ou packages réellement modifiés sont recompilés, les autres sont réutilisés depuis le cache.
- **Optimiser la CI/CD** : en environnement d’intégration continue, le cache permet de ne pas rebuilder tout le projet à chaque commit, ce qui réduit la charge et le temps d’exécution.
- **Améliorer l’expérience développeur** : les builds locaux sont plus rapides, surtout lors de modifications incrémentales.
- **Limiter la consommation de ressources** : moins de CPU, moins d’I/O disque, moins de pollution des artefacts temporaires.

## Cas d’usage typiques

- **Détection de fichiers inchangés** : en stockant un hash du contenu des fichiers sources, on peut déterminer si un fichier doit être rebuilder ou non.
- **Cache des artefacts intermédiaires** : stockage des bundles JS/DTS générés, pour éviter de relancer Rollup/TypeScript si les entrées n’ont pas changé.
- **Cache partagé entre développeurs/CI** : possibilité de partager le cache sur un serveur ou un volume réseau pour accélérer les builds d’équipe.
- **Invalidation intelligente** : suppression automatique des entrées de cache obsolètes lors de changements majeurs (ex : changement de version de TypeScript, options de build, etc.).

## Limites et points d’attention

- Le cache doit être invalidé dès qu’un paramètre influant sur le build change (fichier source, config, version de dépendance, etc.).
- Un cache corrompu ou obsolète peut causer des builds incohérents : il faut prévoir des options pour le vider (`--clear-cache`) ou le désactiver (`--no-cache`).
- Le cache ne doit jamais masquer une erreur de build réelle.

# Synthèse des stratégies de cache dans Bonsai

## 1. Composants de type `library` (ex : @bonsai/rxjs, remeda, zod...)

- **Principe** : Le cache repose sur la version de la librairie référencée dans `pnpm-lock.yaml`.
- **Fonctionnement** :
  - Tant que la version de la dépendance (ex : rxjs) n'a pas changé dans le lockfile, il est inutile de rebuilder la librairie, sauf si l'option `--force-rebuild` est utilisée.
  - Si la version change (mise à jour de la dépendance), le cache est invalidé et la librairie est rebuildée.
  - On peut aussi vérifier que les fichiers wrapper Bonsai n'ont pas changé (hash de leur contenu).
- **Avantage** : Build très rapide pour les librairies stables, rebuild automatique lors des upgrades de dépendances.

## 2. Composants de type `package` (packages internes Bonsai)

- **Principe** : Le cache repose sur le hash du contenu des fichiers sources du package.
- **Fonctionnement** :
  - À chaque build, on calcule un hash (md5/sha1) de tous les fichiers sources du package.
  - Si le hash n'a pas changé depuis le dernier build, on réutilise les artefacts du cache.
  - Si un fichier source est modifié, le hash change et le package est rebuildé.
- **Avantage** : Build incrémental très efficace, aucune recompilation inutile.

## Résumé

- **library** : cache basé sur la version de la dépendance externe (et hash wrapper optionnel)
- **package** : cache basé sur le hash du contenu des fichiers sources

Cette double approche permet d'optimiser le temps de build tout en garantissant la cohérence des artefacts générés.

## Conclusion

La gestion du cache est un levier majeur pour accélérer et fiabiliser le build multi-package. Elle doit être pensée comme un composant central, mais toujours optionnel et contrôlable par l’utilisateur.
