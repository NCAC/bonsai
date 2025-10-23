/**
 * Bundle des fichiers de définition TypeScript (.d.ts) pour les bibliothèques Bonsai
 *
 * Ce module permet de générer un fichier .d.ts unique qui regroupe toutes les définitions
 * de types d'une bibliothèque externe (package cible) dans un namespace spécifique.
 * Le namespace est défini par la propriété 'namespace' du package source.
 */

import * as path from "node:path";
import fileSystem from "fs-extra";
import { Project, SyntaxKind, SourceFile, Node, Statement } from "ts-morph";
import { PathManager } from "@build/core/path-manager.class";
import { TPackage } from "@lib/build/build.type";
import { Path } from "glob";

// Type pour un namespace ts-morph
type NamespaceDeclaration = Node;

/**
 * Génère un fichier bundle de définitions TypeScript (.d.ts) pour un package
 * en regroupant toutes les définitions de types à plat dans un objet exporté unique.
 *
 * @param pkg - TPackage représentant le package source
 */
async function generateBundledDts(pkg: TPackage): Promise<void> {
  const namespaceName = pkg.namespace;
  if (!namespaceName) {
    throw new Error(
      `Le package ${pkg.name} n'a pas de namespace défini dans son package.json`
    );
  }
  console.log(
    `🔄 Traitement de la bibliothèque ${pkg.name} avec le namespace ${namespaceName}`
  );
  const project = new Project({
    compilerOptions: {
      declaration: true,
      emitDeclarationOnly: true,
      skipLibCheck: true
    }
  });
  const dtsFiles = getAllDtsFiles(pkg);
  if (dtsFiles.length === 0) {
    throw new Error(`Aucun fichier .d.ts trouvé pour ${pkg.name}`);
  }
  project.addSourceFilesAtPaths(dtsFiles);
  const outputFilePath = pkg.outDtsFile;
  console.log(`📝 Création du fichier de sortie: ${outputFilePath}`);
  // Set global pour éviter les doublons de déclaration
  const declaredNames = new Set<string>();
  const exportNames = new Set<string>();
  const typeDeclarations: string[] = [];
  const valueDeclarations: string[] = [];
  for (const sourceFile of project.getSourceFiles()) {
    for (const statement of sourceFile.getStatements()) {
      // Types
      if (
        Node.isInterfaceDeclaration(statement) ||
        Node.isTypeAliasDeclaration(statement) ||
        Node.isEnumDeclaration(statement) ||
        Node.isClassDeclaration(statement)
      ) {
        if (statement.getName) {
          const name = statement.getName();
          if (name && !declaredNames.has(name)) {
            typeDeclarations.push(statement.getText());
            declaredNames.add(name);
            if (statement.isExported && statement.isExported()) {
              exportNames.add(name);
            }
          }
        }
      }
      // Fonctions exportées
      if (Node.isFunctionDeclaration(statement)) {
        if (statement.getName) {
          const name = statement.getName();
          if (name && !declaredNames.has(name)) {
            valueDeclarations.push(statement.getText());
            declaredNames.add(name);
            if (statement.isExported && statement.isExported()) {
              exportNames.add(name);
            }
          }
        }
      }
      // Variables exportées
      if (Node.isVariableStatement(statement)) {
        const declList = statement.getDeclarationList();
        for (const decl of declList.getDeclarations()) {
          if (decl.getName) {
            const name = decl.getName();
            if (name && !declaredNames.has(name)) {
              valueDeclarations.push(statement.getText());
              declaredNames.add(name);
              if (decl.isExported && decl.isExported()) {
                exportNames.add(name);
              }
            }
          }
        }
      }
    }
  }
  // Générer le bloc namespace RXJS
  const cleanDeclaration = (line: string) =>
    line
      .replace(/^\s*export\s+(declare\s+)?/gm, "")
      .replace(/^\s*declare\s+/gm, "");
  const namespaceBody = [...typeDeclarations, ...valueDeclarations]
    .map(cleanDeclaration)
    .filter(Boolean)
    .join("\n\n");
  const namespaceBlock = `declare namespace ${namespaceName} {\n${namespaceBody
    .split("\n")
    .map((l) => (l ? "  " + l : ""))
    .join("\n")}\n}`;
  // Nettoyer les imports relatifs restants (../ ou ./)
  function removeRelativeImports(code: string): string {
    return code.replace(
      /^\s*import[^;]+from\s+['\"](\.\.?\/[^'\"]+)['\"];?\s*$/gm,
      ""
    );
  }
  // Remplace les références importées par leur nom local (générique)
  function fixInlineTypeImports(code: string): string {
    // Remplace import("...").Type par Type, pour tous les chemins
    return code.replace(/import\(["'][^"']+["']\)\.(\w+)/g, "$1");
  }
  // Générer le contenu final
  const header = `/**\n * Types pour ${pkg.name}\n * Générés automatiquement - NE PAS MODIFIER\n */\n`;
  let content = [header, namespaceBlock, `export { ${namespaceName} };`].join(
    "\n\n"
  );
  content = removeRelativeImports(content);
  content = fixInlineTypeImports(content);
  // Écrire le fichier de sortie
  await fileSystem.outputFile(outputFilePath, content);
  console.log(`💾 Fichier bundle sauvegardé: ${outputFilePath}`);
}

/**
 * Explore récursivement les exports d'un fichier pour extraire toutes les déclarations de types
 *
 * @param sourceFile - Fichier source à explorer
 * @param project - Projet TS-Morph
 * @param processedFiles - Fichiers déjà traités pour éviter les boucles infinies
 * @returns Un tableau des déclarations à ajouter
 */
function extractDeclarationsRecursively(
  sourceFile: SourceFile,
  project: Project,
  processedFiles: Set<string> = new Set()
): Statement[] {
  const filePath = sourceFile.getFilePath();

  // Éviter les boucles infinies
  if (processedFiles.has(filePath)) {
    return [];
  }

  // console.log(`🔄 Exploration récursive des exports de: ${filePath}`);
  processedFiles.add(filePath);

  // Collecter toutes les déclarations locales
  const declarations: Statement[] = [...sourceFile.getStatements()];

  // Chercher les déclarations d'export depuis d'autres modules
  const exportDeclarations = sourceFile.getExportDeclarations();

  for (const exportDecl of exportDeclarations) {
    try {
      const moduleSpecifier = exportDecl.getModuleSpecifierValue();
      if (!moduleSpecifier) continue;

      // console.log(`📦 Export trouvé depuis le module: ${moduleSpecifier}`);

      // Tenter de résoudre le fichier source du module exporté
      try {
        const resolvedSourceFile = exportDecl.getModuleSpecifierSourceFile();

        if (resolvedSourceFile) {
          // console.log(`✅ Module résolu: ${resolvedSourceFile.getFilePath()}`);

          // Extraire récursivement les déclarations du module importé
          const importedDeclarations = extractDeclarationsRecursively(
            resolvedSourceFile,
            project,
            processedFiles
          );

          // Ajouter les déclarations importées à notre collection
          declarations.push(...importedDeclarations);
        } else {
          console.log(
            `⚠️ Impossible de résoudre le module: ${moduleSpecifier}`
          );
        }
      } catch (error) {
        console.warn(
          `⚠️ Erreur lors de la résolution du module ${moduleSpecifier}:`,
          error
        );
      }
    } catch (error) {
      console.warn(
        `⚠️ Erreur lors du traitement d'une déclaration d'export:`,
        error
      );
    }
  }

  return declarations;
}

/**
 * Copie les déclarations d'un fichier source vers un namespace cible
 * en évitant les doublons.
 *
 * @param sourceFile - Fichier source contenant les déclarations
 * @param namespace - Namespace cible où ajouter les déclarations
 * @param addedDeclarations - Ensemble des déclarations déjà ajoutées (pour éviter les doublons)
 * @returns Nombre de déclarations ajoutées
 */
function copyDeclarationsToNamespace(
  sourceFile: SourceFile,
  namespace: Node,
  addedDeclarations: Set<string>
): number {
  // console.log(
  //   `🔍 Extraction des déclarations du fichier: ${sourceFile.getFilePath()}`
  // );

  // Récupérer toutes les déclarations du fichier source en explorant récursivement les exports
  const project = sourceFile.getProject();
  const declarations = extractDeclarationsRecursively(sourceFile, project);
  // console.log(
  //   `📊 Nombre de déclarations trouvées (avec récursion): ${declarations.length}`
  // );

  let addedCount = 0;

  // Types de déclarations à inclure dans le namespace
  const relevantDeclarationKinds = [
    SyntaxKind.InterfaceDeclaration,
    SyntaxKind.TypeAliasDeclaration,
    SyntaxKind.EnumDeclaration,
    SyntaxKind.ClassDeclaration,
    SyntaxKind.FunctionDeclaration,
    SyntaxKind.VariableStatement,
    SyntaxKind.ModuleDeclaration
  ];

  // Récupérer le corps du namespace
  // Approche sécurisée pour récupérer le corps du namespace
  let namespaceBody: any;
  try {
    // Accès sécurisé en vérifiant chaque étape
    if (
      namespace.getKind &&
      namespace.getKind() === SyntaxKind.ModuleDeclaration
    ) {
      // Pour les ModuleDeclaration (qui représentent les namespaces dans TS)
      const moduleDecl = namespace as any;
      if (moduleDecl.getBody) {
        namespaceBody = moduleDecl.getBody();
      }
    } else {
      // Fallback - essayer directement getBody() si disponible
      // @ts-ignore - Accéder au corps du namespace qui est de type Block
      namespaceBody = namespace.getBody && namespace.getBody();
    }
  } catch (error) {
    console.error("Erreur lors de l'accès au corps du namespace:", error);
  }

  if (!namespaceBody) {
    // Si nous n'avons pas pu obtenir le corps via getBody, essayons une approche alternative
    try {
      // Extraire le corps du namespace en analysant la structure
      const children = namespace.getChildren && namespace.getChildren();
      if (children && children.length > 0) {
        // Le dernier enfant est généralement le bloc de code
        const lastChild = children[children.length - 1];
        if (
          lastChild &&
          lastChild.getKind &&
          lastChild.getKind() === SyntaxKind.Block
        ) {
          namespaceBody = lastChild;
        }
      }
    } catch (error) {
      console.error(
        "Erreur lors de l'extraction du corps du namespace via les enfants:",
        error
      );
    }
  }

  if (!namespaceBody) {
    throw new Error(
      `Impossible de récupérer le corps du namespace pour y ajouter des déclarations`
    );
  }

  // Extraire également les importations locales pour les transformer en déclarations
  const importMap = new Map<string, string>();
  for (const declaration of declarations) {
    if (declaration.getKind() === SyntaxKind.ImportDeclaration) {
      try {
        // @ts-ignore - Accéder aux propriétés d'ImportDeclaration
        const importClause = declaration.getImportClause();
        // @ts-ignore - Accéder aux propriétés de ModuleSpecifier
        const moduleSpecifier = declaration.getModuleSpecifierValue();

        if (importClause && moduleSpecifier) {
          // Ignorer les importations externes (commençant par des lettres)
          if (
            !moduleSpecifier.startsWith(".") &&
            !moduleSpecifier.startsWith("/")
          ) {
            continue;
          }

          // @ts-ignore - Accéder aux propriétés de NamedImports
          const namedImports = importClause.getNamedImports();
          if (namedImports && namedImports.length > 0) {
            for (const namedImport of namedImports) {
              // @ts-ignore - Accéder au nom de l'importation
              const importName = namedImport.getName();
              importMap.set(importName, moduleSpecifier);
            }
          }

          // @ts-ignore - Accéder à DefaultImport
          const defaultImport = importClause.getDefaultImport();
          if (defaultImport) {
            // @ts-ignore - Accéder au nom de l'importation par défaut
            const defaultName = defaultImport.getText();
            importMap.set(defaultName, moduleSpecifier);
          }
        }
      } catch (error) {
        console.warn(`⚠️ Erreur lors de l'analyse de l'importation:`, error);
      }
    }
  }

  for (const declaration of declarations) {
    // Ignorer explicitement les déclarations d'importation
    if (declaration.getKind() === SyntaxKind.ImportDeclaration) {
      // console.log(`🔄 Ignoré: Déclaration d'importation`);
      continue;
    }

    // console.log(
    //   `🔍 Analyse de la déclaration de type: ${
    //     SyntaxKind[declaration.getKind()]
    //   }`
    // );
    // console.log(
    //   `📝 Contenu de la déclaration:\n${declaration.getText().slice(0, 200)}${
    //     declaration.getText().length > 200 ? "..." : ""
    //   }`
    // );

    // Vérifier si la déclaration est d'un type pertinent
    if (relevantDeclarationKinds.includes(declaration.getKind())) {
      // Obtenir le nom de la déclaration pour éviter les doublons
      let declarationName = "";
      try {
        // Pour les déclarations nommées, essayer d'obtenir le nom
        if (
          declaration.getKind() === SyntaxKind.InterfaceDeclaration ||
          declaration.getKind() === SyntaxKind.TypeAliasDeclaration ||
          declaration.getKind() === SyntaxKind.EnumDeclaration ||
          declaration.getKind() === SyntaxKind.ClassDeclaration ||
          declaration.getKind() === SyntaxKind.FunctionDeclaration
        ) {
          // @ts-ignore - Nous savons que ces déclarations ont un nom
          declarationName = declaration.getName();
        } else if (declaration.getKind() === SyntaxKind.VariableStatement) {
          // Pour les déclarations de variables, extraire les noms des variables
          try {
            // @ts-ignore - Accéder aux déclarations de variables
            const variableDeclaration = declaration as any;
            if (
              variableDeclaration.getDeclarationList &&
              typeof variableDeclaration.getDeclarationList === "function"
            ) {
              const declarationList = variableDeclaration.getDeclarationList();
              if (declarationList && declarationList.getDeclarations) {
                const declarations = declarationList.getDeclarations();
                if (declarations.length > 0 && declarations[0].getName) {
                  declarationName = declarations[0].getName();
                }
              }
            }
          } catch (error) {
            console.warn(
              "Erreur lors de l'extraction du nom de variable:",
              error
            );
            declarationName = declaration.getText().slice(0, 100);
          }
        } else {
          // Utiliser un hash du contenu pour les autres déclarations
          declarationName = declaration.getText().slice(0, 100); // Limiter la longueur
        }
      } catch {
        // Fallback si getName() n'est pas disponible
        declarationName = declaration.getText().slice(0, 100);
      }

      // Vérifier si la déclaration a déjà été ajoutée
      if (declarationName && addedDeclarations.has(declarationName)) {
        continue; // Ignorer les déclarations déjà ajoutées
      }

      // Ajouter au set pour éviter les doublons
      if (declarationName) {
        addedDeclarations.add(declarationName);
      }

      // Récupérer le code de la déclaration et l'ajouter au corps du namespace
      let text = declaration.getText();

      // Remplacer les références aux types importés par leurs équivalents complets
      for (const [importName, modulePath] of importMap.entries()) {
        const regex = new RegExp(`\\b${importName}\\b(?!\\.)`);
        if (regex.test(text)) {
          // console.log(
          //   `🔄 Résolution de la référence: ${importName} -> ${modulePath}`
          // );
        }
      }

      try {
        // Supprimer les préfixes export et export declare
        const cleanedText = text.replace(/^export\s+(declare\s+)?/gm, "");

        // Gérer le cas des déclarations vides ou invalides
        if (!cleanedText.trim()) {
          // console.log(`⚠️ Déclaration vide ignorée`);
          continue;
        }

        // Vérifier si la déclaration contient des éléments d'itérateur qui peuvent causer des erreurs
        const hasIteratorSyntax =
          /\s+next\(\s*\)/.test(cleanedText) ||
          /\s+Symbol\.iterator\s*\(/.test(cleanedText);

        // Pour les déclarations contenant des itérateurs (comme dans RxJS), utiliser une approche alternative
        if (hasIteratorSyntax) {
          // console.log(
          //   `🔄 Utilisation de l'approche alternative pour une déclaration d'itérateur`
          // );

          try {
            // Approche 1: Tentative d'ajout direct avec surveillance des erreurs
            try {
              namespaceBody.addStatements(cleanedText);
              // console.log(
              //   `✓ Déclaration d'itérateur ajoutée via addStatements: ${declarationName.substring(
              //     0,
              //     30
              //   )}...`
              // );
              addedCount++;
            } catch (addError) {
              console.warn(
                `⚠️ Erreur lors de l'ajout direct de la déclaration d'itérateur: ${addError.message}. Tentative d'approche alternative...`
              );

              // Approche 2: Modification du texte du namespace (plus sécurisée)
              // Récupérer le texte du namespace
              const namespaceText = namespace.getText();
              if (!namespaceText) {
                throw new Error(
                  "Impossible de récupérer le texte du namespace"
                );
              }

              // Trouver la position juste avant l'accolade fermante
              const insertPosition = namespaceText.lastIndexOf("}");
              if (insertPosition <= 0) {
                throw new Error(
                  "Structure de namespace invalide - accolade fermante non trouvée"
                );
              }

              // Construire le nouveau texte du namespace
              const newText =
                namespaceText.substring(0, insertPosition) +
                "\n  " +
                cleanedText.replace(/\n/g, "\n  ") +
                "\n" +
                namespaceText.substring(insertPosition);

              // Vérifier que le nouveau texte est valide
              if (!newText || newText === namespaceText) {
                throw new Error(
                  "Échec de la génération du nouveau texte pour le namespace"
                );
              }

              // Utiliser une approche sécurisée pour remplacer le texte
              try {
                namespace.replaceWithText(newText);
                // console.log(
                //   `✓ Déclaration d'itérateur ajoutée via replaceWithText: ${declarationName.substring(
                //     0,
                //     30
                //   )}...`
                // );
                addedCount++;
              } catch (replaceError) {
                throw new Error(
                  `Échec du remplacement du texte: ${replaceError.message}`
                );
              }
            }
          } catch (error) {
            // Approche 3: Ajouter la déclaration en tant que commentaire si tout échoue
            console.warn(
              `⚠️ Échec de toutes les tentatives d'ajout de la déclaration d'itérateur. Ajout en commentaire pour référence: ${error.message}`
            );

            try {
              const commentText = `/* Déclaration problématique avec itérateur - ajoutée en commentaire:
${cleanedText}
*/`;
              namespaceBody.addStatements(commentText);
              // console.log(
              //   `✓ Déclaration d'itérateur ajoutée en commentaire: ${declarationName.substring(
              //     0,
              //     30
              //   )}...`
              // );
              // Ne pas incrémenter addedCount car nous n'avons pas vraiment ajouté la déclaration
            } catch (commentError) {
              console.error(
                `❌ Impossible d'ajouter même en commentaire: ${commentError.message}. La déclaration sera ignorée.`
              );
            }
          }
        } else {
          // Approche standard pour les déclarations normales
          namespaceBody.addStatements(cleanedText);
          // console.log(
          //   `✓ Déclaration ajoutée: ${declarationName.substring(0, 50)}${
          //     declarationName.length > 50 ? "..." : ""
          //   }`
          // );
          addedCount++;
        }
      } catch (error) {
        console.warn(
          `⚠️ Erreur lors de l'ajout de la déclaration "${declarationName.substring(
            0,
            50
          )}...": ${error.message}`
        );

        // Approche de secours en cas d'erreur
        try {
          console.log("Tentative de récupération suite à l'erreur...");

          // Approche 1: Ajout comme commentaire
          try {
            const commentText = `/* Déclaration problématique - ajoutée en commentaire pour référence:
${text.replace(/^export\s+(declare\s+)?/gm, "")}
*/`;

            // Essayer d'ajouter directement comme commentaire
            namespaceBody.addStatements(commentText);
            console.log(
              `✓ Déclaration ajoutée en commentaire: ${declarationName.substring(
                0,
                30
              )}...`
            );
            // Ne pas incrémenter addedCount car c'est juste un commentaire
          } catch (commentError) {
            console.warn(
              `⚠️ Échec de l'ajout en commentaire: ${commentError.message}`
            );

            // Approche 2: Modification manuelle du texte (comme dernier recours)
            try {
              // Récupérer le texte du namespace de manière sécurisée
              let namespaceText: string | undefined;
              try {
                namespaceText = namespace.getText();
              } catch (textError) {
                console.warn(
                  `⚠️ Impossible de récupérer le texte du namespace: ${textError.message}`
                );

                // Si nous ne pouvons pas obtenir le texte, abandonner cette approche
                throw new Error(
                  "Impossible de récupérer le texte du namespace"
                );
              }

              if (!namespaceText) {
                throw new Error("Le texte du namespace est vide ou indéfini");
              }

              // Trouver la position juste avant l'accolade fermante
              const insertPosition = namespaceText.lastIndexOf("}");
              if (insertPosition <= 0) {
                throw new Error(
                  "Accolade fermante non trouvée dans le namespace"
                );
              }

              // Créer un commentaire sécurisé pour éviter tout problème syntaxique
              const safeComment = `// DÉCLARATION PROBLÉMATIQUE (ajoutée comme commentaire)
  // Nom original: ${declarationName.substring(0, 30)}...
  // Cette déclaration a été commentée pour éviter les erreurs de compilation
  `;

              // Construire le nouveau texte avec le commentaire
              const newText =
                namespaceText.substring(0, insertPosition) +
                "\n  " +
                safeComment +
                "\n" +
                namespaceText.substring(insertPosition);

              // Tenter de remplacer le texte
              namespace.replaceWithText(newText);
              console.log(
                `✓ Commentaire de sécurité ajouté pour: ${declarationName.substring(
                  0,
                  30
                )}...`
              );
            } catch (finalError) {
              console.error(
                `❌ Toutes les tentatives de récupération ont échoué: ${finalError.message}`
              );
              console.warn(
                `⚠️ La déclaration "${declarationName.substring(
                  0,
                  30
                )}..." sera ignorée complètement`
              );
            }
          }
        } catch (alternativeError) {
          console.error(`❌ Échec de la méthode de secours:`, alternativeError);
          console.warn(
            `⚠️ La déclaration sera ignorée pour éviter l'échec complet du build`
          );
        }
      }
    }
  }

  return addedCount;
}

/**
 * Collecte récursivement tous les fichiers .d.ts dans un dossier et ses sous-dossiers.
 * Résout également les références (<reference path="...">) dans les fichiers.
 *
 * @param dir - Dossier à parcourir
 * @param dtsFiles - Tableau où stocker les chemins des fichiers trouvés
 * @param ignoreDirs - Dossiers à ignorer lors de la recherche
 * @param processedFiles - Ensemble des fichiers déjà traités (pour éviter les doublons)
 */
function collectDtsFiles(
  dir: string,
  dtsFiles: string[],
  ignoreDirs: string[] = [".git"],
  processedFiles: Set<string> = new Set()
): void {
  // console.log(`📂 Exploration du répertoire: ${dir}`);

  if (!fileSystem.existsSync(dir)) {
    console.log(`⚠️ Le répertoire n'existe pas: ${dir}`);
    return;
  }

  try {
    const files = fileSystem.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);

      try {
        const stat = fileSystem.statSync(filePath);

        if (stat.isDirectory()) {
          // Ignorer certains dossiers non pertinents
          if (!ignoreDirs.includes(file)) {
            collectDtsFiles(filePath, dtsFiles, ignoreDirs, processedFiles);
          }
        } else if (file.endsWith(".d.ts") && !file.endsWith(".min.d.ts")) {
          // Ignorer les fichiers minifiés
          if (!processedFiles.has(filePath)) {
            dtsFiles.push(filePath);
            processedFiles.add(filePath);
            // console.log(`📄 Fichier .d.ts trouvé: ${filePath}`);

            // Afficher les premières lignes du fichier pour débug
            try {
              const content = fileSystem.readFileSync(filePath, "utf-8");
              const firstLines = content.split("\n").slice(0, 10).join("\n");
              // console.log(
              //   `📝 Aperçu du fichier ${filePath}:\n${firstLines}\n[...]`
              // );
            } catch (error) {
              console.warn(
                `⚠️ Impossible de lire le contenu de ${filePath}:`,
                error
              );
            }

            // Traiter les références dans le fichier
            try {
              const content = fileSystem.readFileSync(filePath, "utf-8");
              const referenceRegex =
                /\/\/\/\s*<reference\s+path\s*=\s*["']([^"']+)["']\s*\/>/g;
              let match;

              while ((match = referenceRegex.exec(content)) !== null) {
                const referencePath = match[1];
                const absoluteReferencePath = path.resolve(
                  path.dirname(filePath),
                  referencePath
                );

                if (
                  fileSystem.existsSync(absoluteReferencePath) &&
                  !processedFiles.has(absoluteReferencePath)
                ) {
                  dtsFiles.push(absoluteReferencePath);
                  processedFiles.add(absoluteReferencePath);
                  // console.log(
                  //   `📄 Fichier référencé trouvé: ${absoluteReferencePath}`
                  // );

                  // Si c'est un dossier, collecter tous les fichiers .d.ts
                  if (
                    fileSystem.statSync(absoluteReferencePath).isDirectory()
                  ) {
                    collectDtsFiles(
                      absoluteReferencePath,
                      dtsFiles,
                      ignoreDirs,
                      processedFiles
                    );
                  }
                }
              }
            } catch (error) {
              console.warn(
                `⚠️ Erreur lors de la lecture des références dans ${filePath}:`,
                error
              );
            }
          }
        }
      } catch (error) {
        console.warn(`⚠️ Erreur lors de l'accès à ${filePath}:`, error);
      }
    }
  } catch (error) {
    console.warn(`⚠️ Erreur lors de la lecture du dossier ${dir}:`, error);
  }
}

/**
 * Récupère tous les fichiers .d.ts de la librairie cible.
 * La librairie cible est déterminée en analysant les importations dans le fichier source.
 *
 * @param pkg - TPackage représentant le package source
 * @returns Liste des chemins absolus vers les fichiers .d.ts
 */
function getAllDtsFiles(pkg: TPackage): string[] {
  const pathManager = PathManager.me();
  // Récupérer le nom du package source
  const packageName = pkg.name;

  // Lire le contenu du fichier source pour identifier la librairie cible
  const srcContent = fileSystem.readFileSync(pkg.srcFile, "utf-8");

  // Analyse pour trouver toutes les importations
  const importMatches = srcContent.match(/from ['"]([^'"]+)['"]/g);
  if (!importMatches || importMatches.length === 0) {
    throw new Error(
      `Impossible de déterminer la librairie cible dans ${pkg.srcFile}`
    );
  }

  // Extraire les noms de toutes les librairies importées et leurs sous-packages
  const targetLibraries = new Set<string>();
  const subPackages = new Map<string, Set<string>>();

  for (const importMatch of importMatches) {
    const match = importMatch.match(/from ['"]([^'"]+)['"]/);
    if (match && match[1]) {
      const libraryPath = match[1];
      const pathParts = libraryPath.split("/");
      const mainLibrary = pathParts[0];

      // Ajouter la bibliothèque principale
      targetLibraries.add(mainLibrary);

      // Si c'est un sous-package (comme rxjs/operators), l'enregistrer
      if (pathParts.length > 1) {
        if (!subPackages.has(mainLibrary)) {
          subPackages.set(mainLibrary, new Set<string>());
        }
        subPackages.get(mainLibrary)!.add(libraryPath);
      }
    }
  }
  if (targetLibraries.size === 0) {
    throw new Error(
      `Impossible de déterminer la librairie cible dans ${pkg.srcFile}`
    );
  }

  console.log(
    `📦 Librairies cibles identifiées: ${Array.from(targetLibraries).join(
      ", "
    )}`
  );

  // Ajouter tous les sous-packages aux cibles à traiter
  for (const [mainLib, subPkgs] of subPackages.entries()) {
    console.log(
      `📦 Sous-packages de ${mainLib} détectés: ${Array.from(subPkgs).join(
        ", "
      )}`
    );
    // Ajouter chaque sous-package à la liste des bibliothèques cibles
    subPkgs.forEach((subPkg) => targetLibraries.add(subPkg));
  }

  // Collecter les fichiers .d.ts
  const dtsFiles: string[] = [];

  // const nodeModulesPath = path.join(buildStoreConfig.rootPath, "node_modules");
  // with PathManager
  const nodeModulesPath = path.join(pathManager.rootPath, "node_modules");

  // Traiter chaque librairie cible
  for (const targetLibrary of targetLibraries) {
    console.log(`🔍 Recherche des fichiers .d.ts pour ${targetLibrary}...`);

    // Recherche dans PNPM puis dans le node_modules standard
    const basePackageName = targetLibrary.split("/")[0]; // Prendre la partie avant le premier /

    // Rechercher d'abord dans la structure PNPM
    const pnpmDir = path.join(nodeModulesPath, ".pnpm");
    let libraryPath = "";

    if (fileSystem.existsSync(pnpmDir)) {
      try {
        // Trouver le dossier du package dans la structure PNPM
        const possibleDirs = fileSystem
          .readdirSync(pnpmDir)
          .filter((dir) => dir.startsWith(`${basePackageName}@`));

        if (possibleDirs.length > 0) {
          // console.log(`📦 Package PNPM trouvé: ${possibleDirs[0]}`);

          // Pour le package principal (par exemple 'rxjs')
          if (targetLibrary === basePackageName) {
            libraryPath = path.join(
              pnpmDir,
              possibleDirs[0],
              "node_modules",
              basePackageName
            );
          }
          // Pour les sous-packages (par exemple 'rxjs/operators')
          else if (targetLibrary.includes("/")) {
            // Construire le chemin vers le module dans .pnpm
            const subPackagePath = targetLibrary.substring(
              targetLibrary.indexOf("/") + 1
            );
            libraryPath = path.join(
              pnpmDir,
              possibleDirs[0],
              "node_modules",
              basePackageName
            );
          }
        }
      } catch (error) {
        console.warn(
          `⚠️ Erreur lors de la recherche PNPM pour ${targetLibrary}:`,
          error
        );
      }
    }

    // Si PNPM a échoué, essayer dans node_modules standard
    if (!libraryPath || !fileSystem.existsSync(libraryPath)) {
      const standardPath = path.join(nodeModulesPath, targetLibrary);
      if (fileSystem.existsSync(standardPath)) {
        libraryPath = standardPath;
        console.log(
          `📦 Package trouvé dans node_modules standard: ${libraryPath}`
        );
      }
    }

    if (!libraryPath || !fileSystem.existsSync(libraryPath)) {
      console.warn(`⚠️ Impossible de trouver le package ${targetLibrary}`);
      continue;
    }

    // Lire le package.json pour trouver le chemin des types
    try {
      const packageJsonPath = path.join(libraryPath, "package.json");
      if (fileSystem.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(
          fileSystem.readFileSync(packageJsonPath, "utf-8")
        );
        const typesPath = packageJson.types || packageJson.typings;

        if (typesPath) {
          console.log(
            `📄 Chemin des types défini dans package.json: ${typesPath}`
          );
          const absoluteTypesPath = path.join(libraryPath, typesPath);

          // Vérifier si le chemin des types existe
          if (fileSystem.existsSync(absoluteTypesPath)) {
            // Si c'est un fichier .d.ts
            if (absoluteTypesPath.endsWith(".d.ts")) {
              dtsFiles.push(absoluteTypesPath);
              console.log(`📄 Fichier de types trouvé: ${absoluteTypesPath}`);
            }
            // Si c'est un dossier, chercher tous les .d.ts dedans
            else if (fileSystem.statSync(absoluteTypesPath).isDirectory()) {
              collectDtsFiles(absoluteTypesPath, dtsFiles);
            }
          }
        }
      }

      // Chercher dans les emplacements communs si aucun fichier n'a été trouvé
      if (dtsFiles.length === 0 || targetLibrary.includes("/")) {
        // Traiter le cas des sous-packages de façon générique
        if (targetLibrary.includes("/")) {
          const typesDir = path.join(libraryPath, "dist", "types");
          if (fileSystem.existsSync(typesDir)) {
            // Construire le chemin du sous-package (ex: operators pour rxjs/operators)
            const subPackagePath = targetLibrary.substring(
              targetLibrary.indexOf("/") + 1
            );
            const subPackageDir = path.join(typesDir, subPackagePath);

            if (fileSystem.existsSync(subPackageDir)) {
              console.log(
                `📁 Dossier de types pour sous-package trouvé: ${subPackageDir}`
              );
              collectDtsFiles(subPackageDir, dtsFiles);
            }
          }
        }
        // Pour le package principal
        else {
          const typesDir = path.join(libraryPath, "dist", "types");
          if (fileSystem.existsSync(typesDir)) {
            console.log(`📁 Dossier de types principal trouvé: ${typesDir}`);
            collectDtsFiles(typesDir, dtsFiles);
          }
        }

        // Liste des chemins communs où chercher les .d.ts
        const commonPaths = [
          path.join(libraryPath, "dist", "types"),
          path.join(libraryPath, "dist"),
          path.join(libraryPath, "lib"),
          path.join(libraryPath, "esm"),
          path.join(libraryPath, "@types"),
          libraryPath
        ];

        // Chercher dans tous les chemins communs
        for (const commonPath of commonPaths) {
          if (fileSystem.existsSync(commonPath)) {
            // console.log(`🔍 Recherche dans ${commonPath}...`);
            collectDtsFiles(commonPath, dtsFiles);
          }
        }
      }
    } catch (error) {
      console.warn(
        `⚠️ Erreur lors de la recherche des types pour ${targetLibrary}:`,
        error
      );
    }
  }

  if (dtsFiles.length === 0) {
    throw new Error(
      `Aucun fichier .d.ts trouvé pour les librairies: ${Array.from(
        targetLibraries
      ).join(", ")}`
    );
  }

  // console.log(
  //   `✅ ${dtsFiles.length} fichiers .d.ts trouvés pour ${Array.from(
  //     targetLibraries
  //   ).join(", ")}`
  // );

  return dtsFiles;
}

// Fonction principale exportée
/**
 * Fonction principale exportée pour générer un bundle de définitions TypeScript.
 *
 * @param packageDir - Chemin absolu vers le dossier du package source
 */
export async function bundleLibraryDts(pkg: TPackage): Promise<void> {
  console.log(`🔍 Génération du bundle DTS pour la bibliothèque: ${pkg.name}`);

  try {
    await generateBundledDts(pkg);
    console.log(`✅ Bundle DTS généré avec succès pour: ${pkg.name}`);
  } catch (error) {
    console.error(`❌ Erreur lors de la génération du bundle DTS:`, error);
    throw error;
  }
}
