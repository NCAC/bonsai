# 📋 TODO - Bonsai Framework Development Roadmap

**Version**: 0.1.0  
**Dernière mise à jour**: 23 octobre 2025  
**Statut**: En développement actif

## 🎯 Objectifs principaux

Ce document définit la roadmap de développement pour compléter le framework Bonsai. L'accent est mis sur une approche **Test-Driven Development (TDD)** et une implémentation progressive des composants core.

---

## 🧪 Stratégie TDD (Test-Driven Development)

### Philosophie adoptée

1. **Red → Green → Refactor** : Cycle TDD strict pour tous les nouveaux composants
2. **Tests d'abord** : Écrire les tests avant l'implémentation
3. **Couverture complète** : Viser 100% de couverture pour les composants core
4. **Tests de régression** : Maintenir une suite de tests robuste

### Configuration des tests

#### ✅ À faire immédiatement

- [ ] **Configurer Jest** comme framework de test principal
- [ ] **Créer la structure de tests** `/tests` à la racine
- [ ] **Configurer TypeScript** pour les tests (tsconfig.test.json)
- [ ] **Ajouter scripts npm** pour les tests (test, test:watch, test:coverage)
- [ ] **Configurer ESLint** pour les fichiers de tests
- [ ] **Intégrer les tests** dans le système de build

#### Structure de tests proposée

```
/tests/
├── unit/           # Tests unitaires par composant
├── integration/    # Tests d'intégration entre composants
├── e2e/           # Tests de bout en bout
├── fixtures/      # Données de test réutilisables
├── helpers/       # Utilitaires pour les tests
└── setup.ts       # Configuration globale des tests
```

---

## 🏗️ Phase 1: Infrastructure de base

### 1.1 Configuration des tests

#### 🔴 Tests à écrire d'abord

- [ ] Test de l'architecture singleton (`Radio`, `Logger`, etc.)
- [ ] Tests des utilitaires de base
- [ ] Tests du système de types

#### 🟢 Implémentation

- [ ] **Installer et configurer Jest**
  ```bash
  pnpm add -D jest @types/jest ts-jest
  ```
- [ ] **Créer jest.config.js**
- [ ] **Créer /tests/setup.ts**
- [ ] **Ajouter scripts de test dans package.json**

#### 🔵 Refactor

- [ ] Optimiser les configurations
- [ ] Ajouter les pre-commit hooks pour les tests

### 1.2 Système de build - Finalisation

#### 🔴 Tests pour buildFramework()

- [ ] Test du build du framework avec dépendances
- [ ] Test de la génération des exports du framework
- [ ] Test de l'intégration des packages dans le framework

#### 🟢 Implémentation

- [ ] **Implémenter buildFramework()** dans `builder.class.ts`
- [ ] **Finaliser le bundling du framework** (agrégation des packages)
- [ ] **Tester l'intégration complète** du système de build

---

## 🧠 Phase 2: Framework Core - Composants abstraits

### 2.1 Système Radio et Channels

#### 🟢 Tests TDD - ✅ TERMINÉ

- [x] **Radio singleton**
  - ✅ Test de l'unicité de l'instance
  - ✅ Test de création/récupération des channels
  - ✅ Test de la gestion mémoire des channels
- [x] **Channel de base**
  - ✅ Tests pub/sub (trigger/on)
  - ✅ Tests request/reply
  - ✅ Tests de déconnexion propre
- [ ] **EventTrigger abstrait**
  - Tests des méthodes on/off/trigger
  - Tests listenTo/stopListening
  - Tests once/listenToOnce

#### 🟢 Implémentation - ✅ TERMINÉ

- [x] **Créé dans `/packages/event/src/`** (dans le package @bonsai/event)
  - ✅ `radio.singleton.ts` - Singleton Radio
  - ✅ `channel.class.ts` - Classe Channel de base
  - ✅ Types EventCallback et RequestHandler
- [x] **Package @bonsai/event buildé avec succès**
  - ✅ Radio et Channel exportés et utilisables
  - ✅ Tests TDD complets (19/19 ✅)
- [ ] **Créer `/core/src/events/`**
  - `event-trigger.abstract.ts` - Classe abstraite EventTrigger
  - `event-types.ts` - Types pour les événements

#### 🔵 Refactor

- [ ] Optimiser les performances du pub/sub
- [ ] Ajouter des mécanismes de debug
- [ ] Documentation JSDoc complète

### 2.2 Système Entity et State

#### 🔴 Tests TDD

- [ ] **Entity abstraite**
  - Test d'encapsulation du state
  - Test des observateurs (Feature propriétaire)
  - Test de l'immutabilité des données
- [ ] **State management**
  - Tests de modification du state
  - Tests de notification des changements
  - Tests de validation des types

#### 🟢 Implémentation

- [ ] **Créer `/core/src/state/`**
  - `entity.abstract.ts` - Classe abstraite Entity
  - `state-manager.class.ts` - Gestionnaire d'état
  - `state-types.ts` - Types pour le state

#### 🔵 Refactor

- [ ] Optimiser les notifications de changement
- [ ] Ajouter des mécanismes de validation
- [ ] Implémenter l'immutabilité

### 2.3 Système Feature

#### 🔴 Tests TDD

- [ ] **Feature abstraite**
  - Test du cycle de vie (init/destroy)
  - Test de l'association avec Entity
  - Test de la communication via Channel
- [ ] **Feature Manager**
  - Test de l'orchestration des Features
  - Test des dépendances entre Features
  - Test du nettoyage mémoire

#### 🟢 Implémentation

- [ ] **Créer `/core/src/features/`**
  - `feature.abstract.ts` - Classe abstraite Feature
  - `feature-manager.class.ts` - Gestionnaire des Features
  - `feature-types.ts` - Types pour les Features

---

## 🎨 Phase 3: Framework Core - Composants UI

### 3.1 Système View

#### 🔴 Tests TDD

- [ ] **View abstraite**
  - Test du cycle de vie (render/destroy)
  - Test de la liaison avec les Channels
  - Test des interactions DOM
- [ ] **ViewChildrenManager**
  - Test de la gestion des vues enfants
  - Test de l'ajout/suppression dynamique
  - Test du nettoyage des références

#### 🟢 Implémentation

- [ ] **Créer `/core/src/views/`**
  - `view.abstract.ts` - Classe abstraite View
  - `view-children-manager.class.ts` - Gestionnaire des vues enfants
  - `view-types.ts` - Types pour les vues

### 3.2 Système Behavior et RootNode

#### 🔴 Tests TDD

- [ ] **Behavior**
  - Test d'attachement/détachement
  - Test de la réutilisabilité
  - Test des interactions avec la View
- [ ] **RootNode**
  - Test d'initialisation sur élément DOM
  - Test de la gestion de la zone racine

#### 🟢 Implémentation

- [ ] **Créer `/core/src/behaviors/`**
  - `behavior.abstract.ts` - Classe abstraite Behavior
  - `behavior-manager.class.ts` - Gestionnaire des Behaviors
- [ ] **Créer `/core/src/root/`**
  - `root-node.class.ts` - Classe RootNode

---

## 🧭 Phase 4: Router et Navigation

### 4.1 Router Feature

#### 🔴 Tests TDD

- [ ] **Router spécialisé**
  - Test de la navigation (hash/history)
  - Test des événements de route
  - Test des paramètres de route
- [ ] **Route matching**
  - Test du parsing des routes
  - Test des wildcards et paramètres
  - Test de la validation des routes

#### 🟢 Implémentation

- [ ] **Créer `/core/src/router/`**
  - `router.feature.ts` - Feature Router
  - `route-parser.class.ts` - Parser de routes
  - `router-types.ts` - Types pour le routeur

---

## 🏛️ Phase 5: Application et orchestration

### 5.1 Application principale

#### 🔴 Tests TDD

- [ ] **Application orchestrator**
  - Test d'initialisation complète
  - Test de configuration des Features
  - Test de la gestion du cycle de vie

#### 🟢 Implémentation

- [ ] **Créer `/core/src/application/`**
  - `application.class.ts` - Classe Application principale
  - `application-config.interface.ts` - Configuration app

### 5.2 Intégration finale

#### 🔴 Tests d'intégration

- [ ] **Tests de bout en bout**
  - Test d'une application complète
  - Test des interactions entre tous les composants
  - Test des performances

#### 🟢 Finalisation

- [ ] **Créer `/core/src/index.ts`** - Point d'entrée principal
- [ ] **Finaliser buildFramework()** avec tous les composants
- [ ] **Créer des exemples d'usage** complets

---

## 📚 Phase 6: Documentation et exemples

### 6.1 Documentation API

- [ ] **JSDoc complet** pour toutes les classes publiques
- [ ] **Guide de démarrage** avec exemples pratiques
- [ ] **Architecture guide** détaillé
- [ ] **Migration guide** si nécessaire

### 6.2 Exemples et templates

- [ ] **Todo App** - Exemple SPA complet
- [ ] **Dashboard** - Exemple avec multiple Features
- [ ] **Form Builder** - Exemple d'éditeur
- [ ] **Templates CLI** - Scaffolding pour nouveaux projets

---

## 🔧 Phase 7: Outils et DX (Developer Experience)

### 7.1 CLI et outils

- [ ] **CLI Bonsai** pour créer/gérer des projets
- [ ] **Plugin VSCode** pour l'autocomplétion
- [ ] **Templates** pour Features/Views/Entities
- [ ] **Hot reloading** en mode développement

### 7.2 Performance et optimisation

- [ ] **Bundle analyzer** pour optimiser la taille
- [ ] **Performance monitoring** des Features
- [ ] **Memory leak detection** en développement
- [ ] **Lazy loading** des Features

---

## 📊 Métriques et objectifs

### Objectifs de qualité

- **Couverture de tests** : 100% pour les composants core
- **Performance** : < 50ms pour l'initialisation d'une Feature
- **Bundle size** : < 20kb pour le core (gzippé)
- **Memory footprint** : < 1MB pour une application moyenne

### Métriques de développement

- **Vitesse de build** : < 5s pour un rebuild complet
- **Temps de test** : < 30s pour la suite complète
- **Documentation** : 100% des APIs publiques documentées

---

## 🚀 Priorités pour les prochaines semaines

### Semaine 1 (23-30 octobre 2025)

1. **Configuration Jest et structure de tests**
2. **Tests et implémentation Radio/Channel**
3. **Tests et implémentation EventTrigger**

### Semaine 2 (30 octobre - 6 novembre 2025)

1. **Tests et implémentation Entity/State**
2. **Tests et implémentation Feature abstraite**
3. **Début des tests View**

### Semaine 3 (6-13 novembre 2025)

1. **Finalisation du système View**
2. **Implémentation Router**
3. **Tests d'intégration**

### Semaine 4 (13-20 novembre 2025)

1. **Application orchestrator**
2. **buildFramework() complet**
3. **Premiers exemples d'usage**

---

## 📝 Notes et conventions

### Standards de code TDD

1. **Nommage des tests** : `describe('ComponentName')` et `it('should do something')`
2. **Structure des tests** : Arrange/Act/Assert pattern
3. **Mocks et stubs** : Utiliser jest.fn() et jest.mock()
4. **Tests d'intégration** : Tester les interactions entre composants réels

### Conventions de commit

- `test: add tests for FeatureName` - Ajout de tests
- `feat: implement FeatureName` - Implémentation après tests
- `refactor: optimize FeatureName` - Refactoring post-implémentation
- `docs: update documentation for FeatureName` - Documentation

### Branches de développement

- `main` - Code stable et testé
- `develop` - Branche d'intégration
- `feature/component-name` - Branches pour chaque composant
- `test/component-name` - Branches pour les tests TDD

---

**Next Action**: Commencer par la configuration Jest et les premiers tests du système Radio/Channel.
