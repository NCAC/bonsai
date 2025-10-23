/**
 * Bundles TypeScript definition files (.d.ts) for Bonsai libraries
 *
 * This module generates a single .d.ts file that aggregates all type definitions
 * of an external library (target package) into a specific namespace.
 * The namespace is defined by the 'namespace' property of the source package.
 */

import { join, resolve, dirname } from "node:path";
import fileSystem from "fs-extra";
import { Project, SyntaxKind, SourceFile, Node, Statement } from "ts-morph";
import { PathManager } from "@build/core/path-manager.class";
import { TPackage } from "@lib/build/build.type";

// Type for a ts-morph namespace
type NamespaceDeclaration = Node;

/**
 * Generates a bundled TypeScript definition file (.d.ts) for a package
 * by aggregating all type definitions into a single exported object.
 *
 * @param pkg - TPackage representing the source package
 */
async function generateBundledDts(pkg: TPackage): Promise<void> {
  const namespaceName = pkg.namespace;
  if (!namespaceName) {
    throw new Error(
      `Package ${pkg.name} does not have a namespace defined in its package.json`
    );
  }
  console.log(
    `🔄 Processing library ${pkg.name} with namespace ${namespaceName}`
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
    throw new Error(`No .d.ts files found for ${pkg.name}`);
  }
  project.addSourceFilesAtPaths(dtsFiles);
  const outputFilePath = pkg.outDtsFile;
  console.log(`📝 Creating output file: ${outputFilePath}`);
  // Global set to avoid duplicate declarations
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
      // Exported functions
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
      // Exported variables
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
  // Generate the RXJS namespace block
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
  // Clean up remaining relative imports (../ or ./)
  function removeRelativeImports(code: string): string {
    return code.replace(
      /^\s*import[^;]+from\s+['"](\.\.?\/[^'"]+)['"];?\s*$/gm,
      ""
    );
  }
  // Replace imported type references with their local name (generic)
  function fixInlineTypeImports(code: string): string {
    // Replace import("...").Type with Type, for all paths
    return code.replace(/import\(["'][^"']+["']\)\.(\w+)/g, "$1");
  }
  // Generate final content
  const header = `/**\n * Types for ${pkg.name}\n * Automatically generated - DO NOT MODIFY\n */\n`;
  let content = [header, namespaceBlock, `export { ${namespaceName} };`].join(
    "\n\n"
  );
  content = removeRelativeImports(content);
  content = fixInlineTypeImports(content);
  // Write the output file
  await fileSystem.outputFile(outputFilePath, content);
  console.log(`💾 Bundle file saved: ${outputFilePath}`);
}

/**
 * Recursively explores the exports of a file to extract all type declarations
 *
 * @param sourceFile - Source file to explore
 * @param project - TS-Morph project
 * @param processedFiles - Already processed files to avoid infinite loops
 * @returns An array of declarations to add
 */
function extractDeclarationsRecursively(
  sourceFile: SourceFile,
  project: Project,
  processedFiles: Set<string> = new Set()
): Statement[] {
  const filePath = sourceFile.getFilePath();

  // Avoid infinite loops
  if (processedFiles.has(filePath)) {
    return [];
  }

  // console.log(`🔄 Recursively exploring exports of: ${filePath}`);
  processedFiles.add(filePath);

  // Collect all local declarations
  const declarations: Statement[] = [...sourceFile.getStatements()];

  // Search for export declarations from other modules
  const exportDeclarations = sourceFile.getExportDeclarations();

  for (const exportDecl of exportDeclarations) {
    try {
      const moduleSpecifier = exportDecl.getModuleSpecifierValue();
      if (!moduleSpecifier) continue;

      // console.log(`📦 Export found from module: ${moduleSpecifier}`);

      // Attempt to resolve the source file of the exported module
      try {
        const resolvedSourceFile = exportDecl.getModuleSpecifierSourceFile();

        if (resolvedSourceFile) {
          // console.log(`✅ Module resolved: ${resolvedSourceFile.getFilePath()}`);

          // Recursively extract declarations from the imported module
          const importedDeclarations = extractDeclarationsRecursively(
            resolvedSourceFile,
            project,
            processedFiles
          );

          // Add imported declarations to our collection
          declarations.push(...importedDeclarations);
        } else {
          console.log(`⚠️ Unable to resolve module: ${moduleSpecifier}`);
        }
      } catch (error) {
        console.warn(`⚠️ Error resolving module ${moduleSpecifier}:`, error);
      }
    } catch (error) {
      console.warn(`⚠️ Error processing export declaration:`, error);
    }
  }

  return declarations;
}

/**
 * Copies declarations from a source file to a target namespace
 * while avoiding duplicates.
 *
 * @param sourceFile - Source file containing declarations
 * @param namespace - Target namespace to add declarations to
 * @param addedDeclarations - Set of already added declarations (to avoid duplicates)
 * @returns Number of declarations added
 */
function copyDeclarationsToNamespace(
  sourceFile: SourceFile,
  namespace: Node,
  addedDeclarations: Set<string>
): number {
  // console.log(
  //   `🔍 Extracting declarations from file: ${sourceFile.getFilePath()}`
  // );

  // Retrieve all declarations from the source file by recursively exploring exports
  const project = sourceFile.getProject();
  const declarations = extractDeclarationsRecursively(sourceFile, project);
  // console.log(
  //   `📊 Number of declarations found (with recursion): ${declarations.length}`
  // );

  let addedCount = 0;

  // Types of declarations to include in the namespace
  const relevantDeclarationKinds = [
    SyntaxKind.InterfaceDeclaration,
    SyntaxKind.TypeAliasDeclaration,
    SyntaxKind.EnumDeclaration,
    SyntaxKind.ClassDeclaration,
    SyntaxKind.FunctionDeclaration,
    SyntaxKind.VariableStatement,
    SyntaxKind.ModuleDeclaration
  ];

  // Retrieve the body of the namespace
  // Secure approach to retrieve the body of the namespace
  let namespaceBody: any;
  try {
    // Secure access by checking each step
    if (
      namespace.getKind &&
      namespace.getKind() === SyntaxKind.ModuleDeclaration
    ) {
      // For ModuleDeclaration (which represent namespaces in TS)
      const moduleDecl = namespace as any;
      if (moduleDecl.getBody) {
        namespaceBody = moduleDecl.getBody();
      }
    } else {
      // Fallback - try directly getBody() if available
      // @ts-ignore - Access the body of the namespace which is of type Block
      namespaceBody = namespace.getBody && namespace.getBody();
    }
  } catch (error) {
    console.error("Error accessing namespace body:", error);
  }

  if (!namespaceBody) {
    // If we couldn't get the body via getBody, try an alternative approach
    try {
      // Extract the body of the namespace by analyzing the structure
      const children = namespace.getChildren && namespace.getChildren();
      if (children && children.length > 0) {
        // The last child is usually the code block
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
      console.error("Error extracting namespace body via children:", error);
    }
  }

  if (!namespaceBody) {
    throw new Error(`Unable to retrieve namespace body to add declarations`);
  }

  // Extract local imports to transform into declarations
  const importMap = new Map<string, string>();
  for (const declaration of declarations) {
    if (declaration.getKind() === SyntaxKind.ImportDeclaration) {
      try {
        // @ts-ignore - Access properties of ImportDeclaration
        const importClause = declaration.getImportClause();
        // @ts-ignore - Access properties of ModuleSpecifier
        const moduleSpecifier = declaration.getModuleSpecifierValue();

        if (importClause && moduleSpecifier) {
          // Ignore external imports (starting with letters)
          if (
            !moduleSpecifier.startsWith(".") &&
            !moduleSpecifier.startsWith("/")
          ) {
            continue;
          }

          // @ts-ignore - Access properties of NamedImports
          const namedImports = importClause.getNamedImports();
          if (namedImports && namedImports.length > 0) {
            for (const namedImport of namedImports) {
              // @ts-ignore - Access import name
              const importName = namedImport.getName();
              importMap.set(importName, moduleSpecifier);
            }
          }

          // @ts-ignore - Access DefaultImport
          const defaultImport = importClause.getDefaultImport();
          if (defaultImport) {
            // @ts-ignore - Access default import name
            const defaultName = defaultImport.getText();
            importMap.set(defaultName, moduleSpecifier);
          }
        }
      } catch (error) {
        console.warn(`⚠️ Error analyzing import:`, error);
      }
    }
  }

  for (const declaration of declarations) {
    // Explicitly ignore import declarations
    if (declaration.getKind() === SyntaxKind.ImportDeclaration) {
      // console.log(`🔄 Ignored: Import declaration`);
      continue;
    }

    // console.log(
    //   `🔍 Analyzing type declaration: ${
    //     SyntaxKind[declaration.getKind()]
    //   }`
    // );
    // console.log(
    //   `📝 Declaration content:\n${declaration.getText().slice(0, 200)}${
    //     declaration.getText().length > 200 ? "..." : ""
    //   }`
    // );

    // Check if the declaration is of a relevant type
    if (relevantDeclarationKinds.includes(declaration.getKind())) {
      // Get the name of the declaration to avoid duplicates
      let declarationName = "";
      try {
        // For named declarations, try to get the name
        if (
          declaration.getKind() === SyntaxKind.InterfaceDeclaration ||
          declaration.getKind() === SyntaxKind.TypeAliasDeclaration ||
          declaration.getKind() === SyntaxKind.EnumDeclaration ||
          declaration.getKind() === SyntaxKind.ClassDeclaration ||
          declaration.getKind() === SyntaxKind.FunctionDeclaration
        ) {
          // @ts-ignore - We know these declarations have a name
          declarationName = declaration.getName();
        } else if (declaration.getKind() === SyntaxKind.VariableStatement) {
          // For variable declarations, extract variable names
          try {
            // @ts-ignore - Access variable declarations
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
            console.warn("Error extracting variable name:", error);
            declarationName = declaration.getText().slice(0, 100);
          }
        } else {
          // Use a hash of the content for other declarations
          declarationName = declaration.getText().slice(0, 100); // Limit length
        }
      } catch {
        // Fallback if getName() is not available
        declarationName = declaration.getText().slice(0, 100);
      }

      // Check if the declaration has already been added
      if (declarationName && addedDeclarations.has(declarationName)) {
        continue; // Ignore already added declarations
      }

      // Add to set to avoid duplicates
      if (declarationName) {
        addedDeclarations.add(declarationName);
      }

      // Retrieve the declaration code and add it to the namespace body
      let text = declaration.getText();

      // Replace references to imported types with their full equivalents
      for (const [importName, modulePath] of importMap.entries()) {
        const regex = new RegExp(`\\b${importName}\\b(?!\\.)`);
        if (regex.test(text)) {
          // console.log(
          //   `🔄 Resolving reference: ${importName} -> ${modulePath}`
          // );
        }
      }

      try {
        // Remove export and export declare prefixes
        const cleanedText = text.replace(/^export\s+(declare\s+)?/gm, "");

        // Handle empty or invalid declarations
        if (!cleanedText.trim()) {
          // console.log(`⚠️ Ignored empty declaration`);
          continue;
        }

        // Check if the declaration contains iterator elements that may cause errors
        const hasIteratorSyntax =
          /\s+next\(\s*\)/.test(cleanedText) ||
          /\s+Symbol\.iterator\s*\(/.test(cleanedText);

        // For declarations containing iterators (like in RxJS), use an alternative approach
        if (hasIteratorSyntax) {
          // console.log(
          //   `🔄 Using alternative approach for iterator declaration`
          // );

          try {
            // Approach 1: Attempt direct addition with error monitoring
            try {
              namespaceBody.addStatements(cleanedText);
              // console.log(
              //   `✓ Iterator declaration added via addStatements: ${declarationName.substring(
              //     0,
              //     30
              //   )}...`
              // );
              addedCount++;
            } catch (addError) {
              console.warn(
                `⚠️ Error adding iterator declaration directly: ${addError.message}. Attempting alternative approach...`
              );

              // Approach 2: Modify namespace text (more secure)
              // Retrieve namespace text
              const namespaceText = namespace.getText();
              if (!namespaceText) {
                throw new Error("Unable to retrieve namespace text");
              }

              // Find position just before closing brace
              const insertPosition = namespaceText.lastIndexOf("}");
              if (insertPosition <= 0) {
                throw new Error(
                  "Invalid namespace structure - closing brace not found"
                );
              }

              // Construct new namespace text
              const newText =
                namespaceText.substring(0, insertPosition) +
                "\n  " +
                cleanedText.replace(/\n/g, "\n  ") +
                "\n" +
                namespaceText.substring(insertPosition);

              // Ensure new text is valid
              if (!newText || newText === namespaceText) {
                throw new Error("Failed to generate new text for namespace");
              }

              // Securely replace text
              try {
                namespace.replaceWithText(newText);
                // console.log(
                //   `✓ Iterator declaration added via replaceWithText: ${declarationName.substring(
                //     0,
                //     30
                //   )}...`
                // );
                addedCount++;
              } catch (replaceError) {
                throw new Error(
                  `Failed to replace text: ${replaceError.message}`
                );
              }
            }
          } catch (error) {
            // Approach 3: Add declaration as comment if all else fails
            console.warn(
              `⚠️ All attempts to add iterator declaration failed. Adding as comment for reference: ${error.message}`
            );

            try {
              const commentText = `/* Problematic iterator declaration - added as comment:
${cleanedText}
*/`;
              namespaceBody.addStatements(commentText);
              // console.log(
              //   `✓ Iterator declaration added as comment: ${declarationName.substring(
              //     0,
              //     30
              //   )}...`
              // );
              // Do not increment addedCount as we didn't actually add the declaration
            } catch (commentError) {
              console.error(
                `❌ Unable to add even as comment: ${commentError.message}. Declaration will be ignored.`
              );
            }
          }
        } else {
          // Standard approach for normal declarations
          namespaceBody.addStatements(cleanedText);
          // console.log(
          //   `✓ Declaration added: ${declarationName.substring(0, 50)}${
          //     declarationName.length > 50 ? "..." : ""
          //   }`
          // );
          addedCount++;
        }
      } catch (error) {
        console.warn(
          `⚠️ Error adding declaration "${declarationName.substring(
            0,
            50
          )}...": ${error.message}`
        );

        // Fallback approach in case of error
        try {
          console.log("Attempting recovery after error...");

          // Approach 1: Add as comment
          try {
            const commentText = `/* Problematic declaration - added as comment for reference:
${text.replace(/^export\s+(declare\s+)?/gm, "")}
*/`;

            // Try adding directly as comment
            namespaceBody.addStatements(commentText);
            console.log(
              `✓ Declaration added as comment: ${declarationName.substring(
                0,
                30
              )}...`
            );
            // Do not increment addedCount as it's just a comment
          } catch (commentError) {
            console.warn(
              `⚠️ Failed to add as comment: ${commentError.message}`
            );

            // Approach 2: Manual text modification (as last resort)
            try {
              // Securely retrieve namespace text
              let namespaceText: string | undefined;
              try {
                namespaceText = namespace.getText();
              } catch (textError) {
                console.warn(
                  `⚠️ Unable to retrieve namespace text: ${textError.message}`
                );

                // If we can't get the text, abandon this approach
                throw new Error("Unable to retrieve namespace text");
              }

              if (!namespaceText) {
                throw new Error("Namespace text is empty or undefined");
              }

              // Find position just before closing brace
              const insertPosition = namespaceText.lastIndexOf("}");
              if (insertPosition <= 0) {
                throw new Error("Closing brace not found in namespace");
              }

              // Create a secure comment to avoid syntax issues
              const safeComment = `// PROBLEMATIC DECLARATION (added as comment)
  // Original name: ${declarationName.substring(0, 30)}...
  // This declaration was commented out to avoid compilation errors
  `;

              // Construct new text with comment
              const newText =
                namespaceText.substring(0, insertPosition) +
                "\n  " +
                safeComment +
                "\n" +
                namespaceText.substring(insertPosition);

              // Attempt to replace text
              namespace.replaceWithText(newText);
              console.log(
                `✓ Security comment added for: ${declarationName.substring(
                  0,
                  30
                )}...`
              );
            } catch (finalError) {
              console.error(
                `❌ All recovery attempts failed: ${finalError.message}`
              );
              console.warn(
                `⚠️ Declaration "${declarationName.substring(
                  0,
                  30
                )}..." will be completely ignored`
              );
            }
          }
        } catch (alternativeError) {
          console.error(`❌ Fallback method failed:`, alternativeError);
          console.warn(
            `⚠️ Declaration will be ignored to avoid complete build failure`
          );
        }
      }
    }
  }

  return addedCount;
}

/**
 * Recursively collects all .d.ts files in a folder and its subfolders.
 * Also resolves <reference path="..."> references in files.
 *
 * @param dir - Directory to scan
 * @param dtsFiles - Array to store found file paths
 * @param ignoreDirs - Directories to ignore during search
 * @param processedFiles - Set of already processed files (to avoid duplicates)
 */
function collectDtsFiles(
  dir: string,
  dtsFiles: string[],
  ignoreDirs: string[] = [".git"],
  processedFiles: Set<string> = new Set()
): void {
  // console.log(`📂 Scanning directory: ${dir}`);

  if (!fileSystem.existsSync(dir)) {
    console.log(`⚠️ Directory does not exist: ${dir}`);
    return;
  }

  try {
    const files = fileSystem.readdirSync(dir);

    for (const file of files) {
      const filePath = join(dir, file);

      try {
        const stat = fileSystem.statSync(filePath);

        if (stat.isDirectory()) {
          // Ignore certain non-relevant folders
          if (!ignoreDirs.includes(file)) {
            collectDtsFiles(filePath, dtsFiles, ignoreDirs, processedFiles);
          }
        } else if (file.endsWith(".d.ts") && !file.endsWith(".min.d.ts")) {
          // Ignore minified files
          if (!processedFiles.has(filePath)) {
            dtsFiles.push(filePath);
            processedFiles.add(filePath);
            // console.log(`📄 .d.ts file found: ${filePath}`);

            // Display first lines of the file for debugging
            try {
              const content = fileSystem.readFileSync(filePath, "utf-8");
              const firstLines = content.split("\n").slice(0, 10).join("\n");
              // console.log(
              //   `📝 File preview ${filePath}:\n${firstLines}\n[...]`
              // );
            } catch (error) {
              console.warn(`⚠️ Unable to read content of ${filePath}:`, error);
            }

            // Process references in the file
            try {
              const content = fileSystem.readFileSync(filePath, "utf-8");
              const referenceRegex =
                /\/\/\/\s*<reference\s+path\s*=\s*["']([^"']+)["']\s*\/>/g;
              let match;

              while ((match = referenceRegex.exec(content)) !== null) {
                const referencePath = match[1];
                const absoluteReferencePath = resolve(
                  dirname(filePath),
                  referencePath
                );

                if (
                  fileSystem.existsSync(absoluteReferencePath) &&
                  !processedFiles.has(absoluteReferencePath)
                ) {
                  dtsFiles.push(absoluteReferencePath);
                  processedFiles.add(absoluteReferencePath);
                  // console.log(
                  //   `📄 Referenced file found: ${absoluteReferencePath}`
                  // );

                  // If it's a folder, collect all .d.ts files
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
                `⚠️ Error reading references in ${filePath}:`,
                error
              );
            }
          }
        }
      } catch (error) {
        console.warn(`⚠️ Error accessing ${filePath}:`, error);
      }
    }
  } catch (error) {
    console.warn(`⚠️ Error reading directory ${dir}:`, error);
  }
}

/**
 * Retrieves all .d.ts files from the target library.
 * The target library is determined by analyzing imports in the source file.
 *
 * @param pkg - TPackage representing the source package
 * @returns List of absolute paths to .d.ts files
 */
function getAllDtsFiles(pkg: TPackage): string[] {
  const pathManager = PathManager.me();
  // Retrieve the name of the source package
  const packageName = pkg.name;

  // Read the content of the source file to identify the target library
  const srcContent = fileSystem.readFileSync(pkg.srcFile, "utf-8");

  // Analyze to find all imports
  const importMatches = srcContent.match(/from ['"]([^'"]+)['"]/g);
  if (!importMatches || importMatches.length === 0) {
    throw new Error(`Unable to determine target library in ${pkg.srcFile}`);
  }

  // Extract names of all imported libraries and their sub-packages
  const targetLibraries = new Set<string>();
  const subPackages = new Map<string, Set<string>>();

  for (const importMatch of importMatches) {
    const match = importMatch.match(/from ['"]([^'"]+)['"]/);
    if (match && match[1]) {
      const libraryPath = match[1];
      const pathParts = libraryPath.split("/");
      const mainLibrary = pathParts[0];

      // Add the main library
      targetLibraries.add(mainLibrary);

      // If it's a sub-package (like rxjs/operators), register it
      if (pathParts.length > 1) {
        if (!subPackages.has(mainLibrary)) {
          subPackages.set(mainLibrary, new Set<string>());
        }
        subPackages.get(mainLibrary)!.add(libraryPath);
      }
    }
  }
  if (targetLibraries.size === 0) {
    throw new Error(`Unable to determine target library in ${pkg.srcFile}`);
  }

  console.log(
    `📦 Identified target libraries: ${Array.from(targetLibraries).join(", ")}`
  );

  // Add all sub-packages to the targets to process
  for (const [mainLib, subPkgs] of subPackages.entries()) {
    console.log(
      `📦 Detected sub-packages of ${mainLib}: ${Array.from(subPkgs).join(
        ", "
      )}`
    );
    // Add each sub-package to the list of target libraries
    subPkgs.forEach((subPkg) => targetLibraries.add(subPkg));
  }

  // Collect .d.ts files
  const dtsFiles: string[] = [];

  // const nodeModulesPath = join(buildStoreConfig.rootPath, "node_modules");
  // with PathManager
  const nodeModulesPath = join(pathManager.rootPath, "node_modules");

  // Process each target library
  for (const targetLibrary of targetLibraries) {
    console.log(`🔍 Searching for .d.ts files for ${targetLibrary}...`);

    // Search in PNPM then in standard node_modules
    const basePackageName = targetLibrary.split("/")[0]; // Take the part before the first /

    // First search in PNPM structure
    const pnpmDir = join(nodeModulesPath, ".pnpm");
    let libraryPath = "";

    if (fileSystem.existsSync(pnpmDir)) {
      try {
        // Find the package folder in the PNPM structure
        const possibleDirs = fileSystem
          .readdirSync(pnpmDir)
          .filter((dir) => dir.startsWith(`${basePackageName}@`));

        if (possibleDirs.length > 0) {
          // console.log(`📦 PNPM package found: ${possibleDirs[0]}`);

          // For the main package (e.g., 'rxjs')
          if (targetLibrary === basePackageName) {
            libraryPath = join(
              pnpmDir,
              possibleDirs[0],
              "node_modules",
              basePackageName
            );
          }
          // For sub-packages (e.g., 'rxjs/operators')
          else if (targetLibrary.includes("/")) {
            // Construct the path to the module in .pnpm
            const subPackagePath = targetLibrary.substring(
              targetLibrary.indexOf("/") + 1
            );
            libraryPath = join(
              pnpmDir,
              possibleDirs[0],
              "node_modules",
              basePackageName
            );
          }
        }
      } catch (error) {
        console.warn(`⚠️ Error searching PNPM for ${targetLibrary}:`, error);
      }
    }

    // If PNPM failed, try in standard node_modules
    if (!libraryPath || !fileSystem.existsSync(libraryPath)) {
      const standardPath = join(nodeModulesPath, targetLibrary);
      if (fileSystem.existsSync(standardPath)) {
        libraryPath = standardPath;
        console.log(
          `📦 Package found in standard node_modules: ${libraryPath}`
        );
      }
    }

    if (!libraryPath || !fileSystem.existsSync(libraryPath)) {
      console.warn(`⚠️ Unable to find package ${targetLibrary}`);
      continue;
    }

    // Read package.json to find types path
    try {
      const packageJsonPath = join(libraryPath, "package.json");
      if (fileSystem.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(
          fileSystem.readFileSync(packageJsonPath, "utf-8")
        );
        const typesPath = packageJson.types || packageJson.typings;

        if (typesPath) {
          console.log(`📄 Types path defined in package.json: ${typesPath}`);
          const absoluteTypesPath = join(libraryPath, typesPath);

          // Check if types path exists
          if (fileSystem.existsSync(absoluteTypesPath)) {
            // If it's a .d.ts file
            if (absoluteTypesPath.endsWith(".d.ts")) {
              dtsFiles.push(absoluteTypesPath);
              console.log(`📄 Types file found: ${absoluteTypesPath}`);
            }
            // If it's a folder, search all .d.ts files inside
            else if (fileSystem.statSync(absoluteTypesPath).isDirectory()) {
              collectDtsFiles(absoluteTypesPath, dtsFiles);
            }
          }
        }
      }

      // Search common locations if no file found
      if (dtsFiles.length === 0 || targetLibrary.includes("/")) {
        // Handle sub-packages generically
        if (targetLibrary.includes("/")) {
          const typesDir = join(libraryPath, "dist", "types");
          if (fileSystem.existsSync(typesDir)) {
            // Construct the path of the sub-package (e.g., operators for rxjs/operators)
            const subPackagePath = targetLibrary.substring(
              targetLibrary.indexOf("/") + 1
            );
            const subPackageDir = join(typesDir, subPackagePath);

            if (fileSystem.existsSync(subPackageDir)) {
              console.log(
                `📁 Types folder for sub-package found: ${subPackageDir}`
              );
              collectDtsFiles(subPackageDir, dtsFiles);
            }
          }
        }
        // For the main package
        else {
          const typesDir = join(libraryPath, "dist", "types");
          if (fileSystem.existsSync(typesDir)) {
            console.log(`📁 Main types folder found: ${typesDir}`);
            collectDtsFiles(typesDir, dtsFiles);
          }
        }

        // List of common paths to search for .d.ts files
        const commonPaths = [
          join(libraryPath, "dist", "types"),
          join(libraryPath, "dist"),
          join(libraryPath, "lib"),
          join(libraryPath, "esm"),
          join(libraryPath, "@types"),
          libraryPath
        ];

        // Search all common paths
        for (const commonPath of commonPaths) {
          if (fileSystem.existsSync(commonPath)) {
            // console.log(`🔍 Searching in ${commonPath}...`);
            collectDtsFiles(commonPath, dtsFiles);
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️ Error searching types for ${targetLibrary}:`, error);
    }
  }

  if (dtsFiles.length === 0) {
    throw new Error(
      `No .d.ts files found for libraries: ${Array.from(targetLibraries).join(
        ", "
      )}`
    );
  }

  // console.log(
  //   `✅ ${dtsFiles.length} .d.ts files found for ${Array.from(
  //     targetLibraries
  //   ).join(", ")}`
  // );

  return dtsFiles;
}

// Main exported function
/**
 * Main exported function to generate a TypeScript definitions bundle.
 *
 * @param packageDir - Absolute path to the source package folder
 */
export async function bundleLibraryDts(pkg: TPackage): Promise<void> {
  console.log(`🔍 Generating DTS bundle for library: ${pkg.name}`);

  try {
    await generateBundledDts(pkg);
    console.log(`✅ DTS bundle successfully generated for: ${pkg.name}`);
  } catch (error) {
    console.error(`❌ Error generating DTS bundle:`, error);
    throw error;
  }
}
