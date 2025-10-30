/**
 * Script to generate a flat .d.ts file for the framework
 * Combines all types from packages without re-exports
() * Uses ts-morph for robust TypeScript AST parsing
 */

import * as path from "node:path";
import fileSystem from "fs-extra";
import { Project, SourceFile, SyntaxKind } from "ts-morph";

interface PackageInfo {
  name: string;
  packageJsonPath: string;
  typesPath: string;
  content: string;
}

export async function generateFlatFrameworkDts(
  frameworkSourcePath: string,
  outputPath: string,
  workspaceRoot: string = "/bonsai"
): Promise<void> {
  console.log("🔄 Generating flat .d.ts file for the framework...");

  // Step 1: Read the framework source file to identify packages to include
  const packageNames = await extractPackageNamesFromFramework(
    frameworkSourcePath
  );
  console.log(`📦 Detected packages: ${packageNames.join(", ")}`);

  // Step 2: Dynamically resolve info for each package
  const packagesInfo = await resolvePackagesInfo(packageNames, workspaceRoot);

  // Step 3: Build the flat .d.ts file
  let flatContent = generateHeader(packageNames);

  // Add the content of each package
  for (const packageInfo of packagesInfo) {
    console.log(`📄 Processing ${packageInfo.name}...`);

    if (packageInfo.name === "@bonsai/types") {
      const typesContent = await extractTypesOnlyPackageContent(
        packageInfo.content,
        packageInfo.typesPath
      );
      flatContent += typesContent;
    } else if (packageInfo.name === "@bonsai/rxjs") {
      flatContent += extractRxjsNamespace(packageInfo.content);
    } else if (packageInfo.name === "@bonsai/event") {
      flatContent += extractEventTypesAndClasses(packageInfo.content);
    } else {
      // For other packages, generic extraction
      flatContent += extractGenericPackageTypes(
        packageInfo.content,
        packageInfo.name
      );
    }
  }

  // Write the final file
  await fileSystem.writeFile(outputPath, flatContent, "utf-8");

  console.log(`✅ Flat .d.ts file generated: ${outputPath}`);
}

/**
 * Extracts package names from the framework source file
 */
async function extractPackageNamesFromFramework(
  frameworkSourcePath: string
): Promise<string[]> {
  const content = await fileSystem.readFile(frameworkSourcePath, "utf-8");

  // Extract packages exported via export * from
  const exportMatches = content.match(
    /export \* from ['"](@bonsai\/[^'"]+)['"]/g
  );

  if (!exportMatches) {
    throw new Error(`No @bonsai/* export found in ${frameworkSourcePath}`);
  }

  return exportMatches
    .map((match) => {
      const packageMatch = match.match(
        /export \* from ['"](@bonsai\/[^'"]+)['"]/
      );
      return packageMatch ? packageMatch[1] : null;
    })
    .filter(Boolean) as string[];
}

/**
 * Dynamically resolves package information from their package.json
 */
async function resolvePackagesInfo(
  packageNames: string[],
  workspaceRoot: string
): Promise<PackageInfo[]> {
  const packagesInfo: PackageInfo[] = [];

  for (const packageName of packageNames) {
    try {
      // Build the path to the package (removing @bonsai/)
      const packageDir = path.join(
        workspaceRoot,
        "packages",
        packageName.replace("@bonsai/", "")
      );
      const packageJsonPath = path.join(packageDir, "package.json");

      // Check that package.json exists
      if (!(await fileSystem.pathExists(packageJsonPath))) {
        console.warn(`⚠️ Package not found: ${packageJsonPath}`);
        continue;
      }

      // Read package.json
      const packageJsonContent = await fileSystem.readFile(
        packageJsonPath,
        "utf-8"
      );
      const packageJson = JSON.parse(packageJsonContent);

      // Get the path to the types
      const typesField = packageJson.types;
      if (!typesField) {
        console.warn(`⚠️ "types" field missing in ${packageJsonPath}`);
        continue;
      }

      const typesPath = path.resolve(packageDir, typesField);

      // Check that the .d.ts file exists
      if (!(await fileSystem.pathExists(typesPath))) {
        console.warn(`⚠️ Types file not found: ${typesPath}`);
        continue;
      }

      // Read the content of the .d.ts file
      const typesContent = await fileSystem.readFile(typesPath, "utf-8");

      packagesInfo.push({
        name: packageName,
        packageJsonPath,
        typesPath,
        content: typesContent
      });

      console.log(`✅ Package resolved: ${packageName} -> ${typesPath}`);
    } catch (error) {
      console.error(`❌ Error while resolving ${packageName}:`, error);
    }
  }

  return packagesInfo;
}

function generateHeader(packageNames: string[]): string {
  return `/**
 * Bundled TypeScript definitions for Bonsai Framework
 * Generated: ${new Date().toISOString()}
 * 
 * This file contains all types from:
${packageNames.map((name) => ` * - ${name}`).join("\n")}
 */

`;
}

function extractTypesFromPackage(content: string, packageName: string): string {
  // Extract everything after "// Type declarations" for other packages
  const match = content.match(/\/\/ Type declarations\n([\s\S]*)/);
  if (!match) return "";

  let extractedContent = match[1];

  // Fix StrictArrayOfValues type to avoid constraint error
  extractedContent = extractedContent.replace(
    /export type StrictArrayOfValues<T extends object | null>/g,
    "// Problematic type temporarily removed - to review\n// export type StrictArrayOfValues<T extends Record<any, any> | null>"
  );

  return `// ===== Types from ${packageName} =====\n${extractedContent}\n`;
}

/**
 * Extracts and flattens all types from a types-only package using ts-morph
 * Resolves the re-exported types from their source files
 */
async function extractTypesOnlyPackageContent(indexContent: string, packagePath: string): Promise<string> {
  let result = "// ===== Types from @bonsai/types (flattened) =====\n";
  
  try {
    // Extract the source directory path
    const srcPath = path.join(path.dirname(packagePath), "src");
    
    // Create a ts-morph project for parsing
    const project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: {
        declaration: true,
        emitDeclarationOnly: true,
        strict: false, // Be more permissive for parsing
      }
    });
    
    // Keep track of already defined types to avoid duplicates
    const definedTypes = new Set<string>();
    
    // Read all .d.ts files from the src directory
    const srcFiles = await fileSystem.readdir(srcPath);
    const dtsFiles = srcFiles.filter(file => file.endsWith('.d.ts'));
    
    // Process each .d.ts file and extract type definitions using ts-morph
    for (const dtsFile of dtsFiles) {
      const filePath = path.join(srcPath, dtsFile);
      const fileContent = await fileSystem.readFile(filePath, 'utf-8');
      
      // Add the file to the ts-morph project
      const sourceFile = project.createSourceFile(`${dtsFile}`, fileContent);
      
      // Extract type definitions from the file using AST
      const extractedTypes = extractTypeDefinitionsFromSourceFile(sourceFile, dtsFile, definedTypes);
      result += extractedTypes;
    }
    
  } catch (error) {
    console.warn(`Warning: Could not read source files for @bonsai/types: ${error}`);
    
    // Fallback: extract type names from export statements and create placeholders
    const exportMatches = indexContent.match(/export type \{[^}]+\}/g);
    
    if (exportMatches) {
      for (const exportMatch of exportMatches) {
        const typeNames = exportMatch
          .replace(/export type \{/, '')
          .replace(/\}.*/, '')
          .split(',')
          .map(name => name.trim())
          .filter(name => name.length > 0);
        
        for (const typeName of typeNames) {
          result += `export type ${typeName} = any; // TODO: Resolve from source\n`;
        }
      }
    }
  }
  
  result += "\n";
  return result;
}

/**
 * Extracts type definitions from a TypeScript source file using ts-morph AST
 */
function extractTypeDefinitionsFromSourceFile(sourceFile: SourceFile, filename: string, definedTypes: Set<string> = new Set()): string {
  let result = `// From ${filename}\n`;
  
  // Get all type alias declarations (both exported and internal)
  const typeAliases = sourceFile.getTypeAliases();
  for (const typeAlias of typeAliases) {
    const typeName = typeAlias.getName();
    if (!definedTypes.has(typeName)) {
      definedTypes.add(typeName);
      // Clean the text by removing JSDoc comments that might be problematic
      const text = cleanTypeDefinitionText(typeAlias.getText());
      result += text + '\n';
    }
  }
  
  // Get all interface declarations  
  const interfaces = sourceFile.getInterfaces();
  for (const interfaceDeclaration of interfaces) {
    const interfaceName = interfaceDeclaration.getName();
    if (!definedTypes.has(interfaceName)) {
      definedTypes.add(interfaceName);
      const text = cleanTypeDefinitionText(interfaceDeclaration.getText());
      result += text + '\n';
    }
  }
  
  // Get all variable declarations with 'declare' or 'export declare'
  const variableStatements = sourceFile.getVariableStatements();
  for (const variableStatement of variableStatements) {
    if (variableStatement.hasExportKeyword() || variableStatement.hasDeclareKeyword()) {
      // Extract variable names from the declaration
      const declarations = variableStatement.getDeclarations();
      let shouldInclude = false;
      
      for (const declaration of declarations) {
        const varName = declaration.getName();
        if (!definedTypes.has(varName)) {
          definedTypes.add(varName);
          shouldInclude = true;
        }
      }
      
      if (shouldInclude) {
        const text = cleanTypeDefinitionText(variableStatement.getText());
        result += text + '\n';
      }
    }
  }
  
  // Get all class declarations
  const classes = sourceFile.getClasses();
  for (const classDeclaration of classes) {
    const className = classDeclaration.getName();
    if (className && !definedTypes.has(className)) {
      definedTypes.add(className);
      const text = cleanTypeDefinitionText(classDeclaration.getText());
      result += text + '\n';
    }
  }
  
  // Get all enum declarations
  const enums = sourceFile.getEnums();
  for (const enumDeclaration of enums) {
    const enumName = enumDeclaration.getName();
    if (!definedTypes.has(enumName)) {
      definedTypes.add(enumName);
      const text = cleanTypeDefinitionText(enumDeclaration.getText());
      result += text + '\n';
    }
  }
  
  // Get all module/namespace declarations using getChildrenOfKind
  const namespaces = sourceFile.getChildrenOfKind(SyntaxKind.ModuleDeclaration);
  for (const namespaceDeclaration of namespaces) {
    // For namespaces, we'll include them as they are usually unique by design
    const text = cleanTypeDefinitionText(namespaceDeclaration.getText());
    result += text + '\n';
  }
  
  // Get all function declarations
  const functions = sourceFile.getFunctions();
  for (const functionDeclaration of functions) {
    const functionName = functionDeclaration.getName();
    if (functionName && !definedTypes.has(functionName)) {
      definedTypes.add(functionName);
      const text = cleanTypeDefinitionText(functionDeclaration.getText());
      result += text + '\n';
    }
  }
  
  return result + '\n';
}

/**
 * Cleans type definition text by removing problematic JSDoc comments
 * and ensuring proper formatting for .d.ts files
 */
function cleanTypeDefinitionText(text: string): string {
  // Remove JSDoc comments that contain code blocks or problematic syntax
  const cleanedText = text
    // Remove JSDoc blocks that contain ```typescript or similar
    .replace(/\/\*\*[\s\S]*?```[\s\S]*?\*\//g, '')
    // Remove single-line JSDoc comments with problematic content
    .replace(/\/\*\*[^*]*\*\//g, '')
    // Remove @example blocks specifically
    .replace(/\/\*\*[\s\S]*?@example[\s\S]*?\*\//g, '')
    // Remove @see blocks that might have links
    .replace(/\/\*\*[\s\S]*?@see[\s\S]*?\*\//g, '')
    // Clean up multiple newlines
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    // Trim whitespace
    .trim();
    
  return cleanedText;
}

function extractRxjsNamespace(content: string): string {
  // Extract RXJS namespace declaration
  const match = content.match(/(declare namespace RXJS \{[\s\S]*?\n\})/);
  if (!match) return "";

  return `// ===== RXJS Namespace =====\n${match[1]}\n\n`;
}

function extractEventTypesAndClasses(content: string): string {
  // Remove import lines
  let cleanContent = content.replace(/^import .*$/gm, "");

  // Extract everything after "// Type declarations"
  const match = cleanContent.match(/\/\/ Type declarations\n([\s\S]*)/);
  if (!match) return "";

  return `// ===== Types and Classes from @bonsai/event =====\n${match[1]}\n`;
}

function extractGenericPackageTypes(
  content: string,
  packageName: string
): string {
  // Generic extraction for other packages
  const match = content.match(/\/\/ Type declarations\n([\s\S]*)/);
  if (!match) return "";

  // Remove imports
  let cleanContent = match[1].replace(/^import .*$/gm, "");

  return `// ===== Types from ${packageName} =====\n${cleanContent}\n`;
}

// For direct test
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// If this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateFlatFrameworkDts(
    "/bonsai/core/src/bonsai.ts",
    "/bonsai/core/dist/bonsai.d.ts",
    "/bonsai"
  )
    .then(() => console.log("✅ Done"))
    .catch(console.error);
}
