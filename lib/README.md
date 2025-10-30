# Documentation du Système de Build Bonsai

Index complet de la documentation du système de build.

## 📚 Documents disponibles

### Documentation principale

- **[BUILD.md](./BUILD.md)** - Vue d'ensemble du système de build (FR)
- **[BUILD-EN.md](./BUILD-EN.md)** - Build system overview (EN)

### Documentation technique

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Architecture technique détaillée (FR)
- **[DEVELOPER-GUIDE.md](./DEVELOPER-GUIDE.md)** - Guide pratique du développeur (FR)
- **[DEVELOPER-GUIDE-EN.md](./DEVELOPER-GUIDE-EN.md)** - Developer practical guide (EN)

### Documentation spécialisée

- **[cache/CACHE.md](./build/cache/CACHE.md)** - Système de cache de build

## 🚀 Démarrage rapide

### Nouveaux développeurs

1. Lire [BUILD.md](./BUILD.md) pour comprendre les concepts
2. Consulter [DEVELOPER-GUIDE.md](./DEVELOPER-GUIDE.md) pour la pratique
3. Référencer [ARCHITECTURE.md](./ARCHITECTURE.md) pour les détails techniques

### Contribution au système de build

1. Comprendre l'architecture dans [ARCHITECTURE.md](./ARCHITECTURE.md)
2. Suivre les bonnes pratiques du [DEVELOPER-GUIDE.md](./DEVELOPER-GUIDE.md)
3. Tester les modifications selon les guidelines

## 🏗️ Architecture du système

```
Système de Build Bonsai
├── Détection automatique des packages
│   ├── Packages réguliers (TypeScript + Rollup)
│   └── Packages types-only (copie directe .d.ts)
├── Build incrémental avec cache
├── Parallélisation des bibliothèques
└── Bundle framework unifié
```

## 📋 Checklist pour créer un package

### Package régulier

- [ ] Structure de dossier correcte
- [ ] `package.json` avec exports appropriés
- [ ] Code source TypeScript
- [ ] Ajout dans `bonsai-components.yaml`
- [ ] Tests unitaires

### Package types-only

- [ ] `package.json` avec uniquement `exports.types`
- [ ] Fichiers `.d.ts` dans `/src`
- [ ] Pas de code exécutable
- [ ] Ajout dans `bonsai-components.yaml`
- [ ] Validation des types

## 🔧 Commands utiles

```bash
# Build complet
pnpm run build

# Build avec nettoyage
pnpm run build:clean

# Logs détaillés
DEBUG=bonsai:build pnpm run build

# Tests
npm test
```

## 🐛 Dépannage rapide

| Problème                             | Solution                                        |
| ------------------------------------ | ----------------------------------------------- |
| Package non détecté comme types-only | Vérifier `package.json` et contenu `/src`       |
| Erreurs TypeScript                   | Compiler manuellement avec `npx tsc`            |
| Cache corrompu                       | `pnpm run build:clean && rm -rf .bonsai-cache/` |
| Build lent                           | Vérifier si packages peuvent être types-only    |

## 📊 Métriques de performance

Le système affiche automatiquement :

- ⚡ Cache hits (packages non modifiés)
- 📝 Détection types-only
- 🔨 Temps de build par package
- 🏁 Temps total de build

## 🤝 Contribution

Pour contribuer au système de build :

1. **Fork et clone** le repository
2. **Lire la documentation** technique
3. **Créer une branche** pour vos modifications
4. **Tester** vos changements
5. **Soumettre une PR** avec description détaillée

## 📞 Support

- **Issues GitHub** : Pour les bugs et demandes de fonctionnalités
- **Documentation** : Cette section pour les questions d'usage
- **Code source** : `/lib/build/` pour l'implémentation

---

> 💡 **Note** : Cette documentation évolue avec le système. N'hésitez pas à proposer des améliorations !
