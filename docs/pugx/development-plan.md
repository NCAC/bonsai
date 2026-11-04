
### 📦 Dossiers du monorepo

#### `pugx-core/`
Contient le cœur du langage PugX :
- `lexer.ts` : découpe le texte en tokens typés.
- `parser.ts` : transforme les tokens en AST.
- `ast.ts` : définitions des types de nœuds.
- `resolver.ts` : gestion des imports et mixins.
- `index.ts` : point d’entrée du module.

#### `pugx-lsp/`
Serveur Language Server Protocol :
- `server.ts` : point d’entrée du serveur.
- `completion.ts` : suggestions d’autocomplétion.
- `diagnostics.ts` : vérification des erreurs.
- `index.ts` : initialisation du serveur.

#### `pugx-vscode/`
Extension VS Code :
- `extension.ts` : lance le serveur LSP.
- `syntaxes/pugx.tmLanguage.json` : coloration syntaxique.
- `language-configuration.json` : règles d’indentation et de commentaires.

#### Fichiers partagés
- `tsconfig.base.json` : configuration TypeScript commune.
- `package.json` : dépendances racine et configuration des workspaces.
- `README.md` : documentation du projet.

### 3. Resolver

- Résout les `import` de fichiers `.pugx` (mixins, fragments, helpers).
- Analyse les dépendances entre fichiers et construit un graphe d'importation.
- Met en cache les mixins et les définitions importées pour accélérer le parsing.
- Fournit des informations au LSP pour la navigation et la validation croisée.

### 4. Serveur LSP (`pugx-lsp`)

- Implémente le protocole LSP via `vscode-languageserver`.
- Utilise `pugx-core` pour analyser les fichiers `.pugx`.
- Fournit :
  - diagnostics (erreurs de syntaxe, typage, mixins inconnus),
  - autocomplétion (variables, mixins, helpers),
  - navigation (go-to-definition),
  - hover (documentation des mixins, types),
  - indexation des fichiers du projet.

### 5. Extension VS Code (`pugx-vscode`)

- Déclare le langage `.pugx` avec ses extensions et sa configuration.
- Lance le serveur LSP à l’ouverture d’un fichier `.pugx`.
- Fournit :
  - coloration syntaxique via TextMate (`pugx.tmLanguage.json`),
  - snippets pour les structures courantes (mixin, each, if),
  - commandes personnalisées (ex. : "Créer un mixin", "Insérer un helper"),
  - intégration avec le debugger ou le preview HTML.

## Étapes recommandées de développement
1. ✅ Définir la grammaire PugX (syntaxe, règles, extensions).
2. ✅ Implémenter le lexer avec tests unitaires.
3. ✅ Implémenter le parser avec tests unitaires.
4. ✅ Implémenter le resolver avec tests d’intégration.
5. ✅ Créer le serveur LSP avec tests simulés.
6. ✅ Créer l’extension VS Code et tester en local.
7. ✅ Ajouter des tests de bout en bout (fichier `.pugx` → AST → diagnostics).
