# Spécification technique : Templates typés PugJS pour Bonsai

## 1. Contexte

Le framework Bonsai utilise des templates PugJS transformés en fonctions snabbdom via Rollup ou EsBuild. Chaque template fait référence à un composant TypeScript qui fournit une structure de données typée. L’objectif est d’assurer un typage strict, une validation automatique, une documentation et une intégration fluide dans l’IDE.

Les fichiers templates auront une extension personnalisée : `.bsn.template` ou `.pug.template`, avec une syntaxe proche de PugJS et une section `import` pour référencer la View et sa structure typée.

---

## 2. Analyse statique des templates

- Extraction des variables via l’AST de Pug (`pug-lexer`, `pug-parser`, `pug-walk`)
- Identification des nœuds `Code`, `Interpolation`, `Each`, `If`, etc.
- Génération automatique d’une interface TypeScript à partir des noms détectés
- Prise en charge des types complexes : `Record`, `Array`, `Partial`, `Union`, `Intersection`, etc.

---

## 3. Validation typée

- Vérification automatique de la compatibilité entre les variables du template et la structure TypeScript
- Analyse des expressions dynamiques : `items.filter(...)`, `user?.isAdmin`, etc.
- Vérification des helpers/fonctions utilitaires : `formatDate(date)`, `truncate(text, length)`
- Validation des attributs HTML dynamiques : `class`, `style`, `data-*`
- Validation croisée entre plusieurs templates utilisant le même composant

---

## 4. Transformation et build

- Extension personnalisée : `.bsn.template` ou `.pug.template`
- Transformation via Rollup/EsBuild en fonction snabbdom exportée
- La fonction prend en paramètre la structure typée du composant
- Validation des templates avant transformation (étape CLI ou build)

---

## 5. Intégration IDE & LSP

- Serveur LSP personnalisé basé sur `vscode-languageserver`
- Analyse des fichiers `.template` et `.ts`
- Fonctionnalités : autocomplétion, diagnostics, navigation
- Extension VSCode dédiée
- Reconnaissance automatique des extensions personnalisées

---

## 6. Preview & test

- Simulation du rendu snabbdom avec des données typées
- Environnement de test ou preview pour valider le comportement dynamique

---

## 7. Documentation automatique

- Génération de documentation à partir du template :
  - Variables attendues
  - Types
  - Helpers utilisés
  - Structures de contrôle (`if`, `each`, etc.)

---

## 8. Évolutions envisagées

- Réécriture du parser PugJS pour un typage renforcé
- Adoption d’un AST moderne compatible avec Rehype
