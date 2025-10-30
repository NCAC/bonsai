import { join } from "node:path";
import { IPackageJson } from "package-json-type";
import fileSystem from "fs-extra";
import { load as yamlLoad } from "js-yaml";
import { Logger } from "@build/monitoring/logger.class";
import { PathManager } from "@build/core/path-manager.class";
import { TFramework, TPackage } from "@build/build.type";

/**
 * Type representing the structure of the bonsai-components.yaml file
 */
export type TComponentsConfig = {
  libraries: string[];
  packages: string[];
};

/**
 * Type representing the organized components after analysis
 */
export type TOrganizedComponents = {
  framework: TFramework;
  libraries: TPackage[];
  packages: TPackage[];
  allPackages: Set<TPackage>;
};

/**
 * Class responsible for analyzing Bonsai components
 */
export class ComponentsRegistry {
  private static instance: ComponentsRegistry;
  private logger: Logger;
  private pathManager: PathManager;
  private _organizedComponents: TOrganizedComponents | null = null;

  /**
   * Private constructor for singleton
   */
  private constructor() {
    this.logger = Logger.me();
    this.pathManager = PathManager.me();
  }

  /**
   * Get the analyzer instance
   */
  public static me(): ComponentsRegistry {
    if (!ComponentsRegistry.instance) {
      ComponentsRegistry.instance = new ComponentsRegistry();
    }
    return ComponentsRegistry.instance;
  }

  /**
   * Collect all Bonsai components
   */
  public async collect(): Promise<TOrganizedComponents> {
    this.logger.info("Collecting Bonsai components...");

    // Load component configuration file
    const componentsConfig = await this.loadComponentsConfig();

    // Retrieve the framework
    const framework = await this.collectFramework();

    // Retrieve libraries
    const libraries = await this.collectComponents(
      componentsConfig.libraries,
      true
    );

    // Retrieve internal packages
    const packages = await this.collectComponents(
      componentsConfig.packages,
      false
    );

    // Create a Set with all packages
    const allPackages = new Set<TPackage>([...libraries, ...packages]);

    this.logger.info(
      `Collection completed: 1 framework, ${libraries.length} libraries, ${packages.length} packages`
    );

    // Store the organized result
    this._organizedComponents = {
      framework,
      libraries,
      packages,
      allPackages
    };

    return this._organizedComponents;
  }

  /**
   * Access the last organized collection result (null if not collected)
   */
  public get organizedComponents(): TOrganizedComponents | null {
    return this._organizedComponents;
  }

  /**
   * Load component configuration from YAML file
   */
  private async loadComponentsConfig(): Promise<TComponentsConfig> {
    const configPath = join(
      this.pathManager.rootPath,
      "bonsai-components.yaml"
    );

    try {
      // Check that the file exists
      await fileSystem.access(configPath);
      this.logger.info(`Component configuration file found: ${configPath}`);

      // Read and parse the YAML file
      const configContent = await fileSystem.readFile(configPath, "utf-8");
      const config = yamlLoad(configContent) as Partial<TComponentsConfig>;

      // Ensure that the libraries and packages sections exist, even if they are empty
      const librariesList = Array.isArray(config.libraries)
        ? config.libraries
        : [];
      const packagesList = Array.isArray(config.packages)
        ? config.packages
        : [];

      // Return the normalized configuration
      const result: TComponentsConfig = {
        libraries: librariesList,
        packages: packagesList
      };

      this.logger.debug(
        `Configuration loaded: ${librariesList.length} libraries, ${packagesList.length} packages`
      );
      return result;
    } catch (error) {
      this.logger.error(`Error loading configuration: ${error}`);
      throw new Error(`Unable to load component configuration: ${error}`);
    }
  }

  /**
   * Retrieve the framework
   */
  private async collectFramework(): Promise<TFramework> {
    const frameworkPath = this.pathManager.frameworkPath;

    try {
      // Check that the folder exists
      await fileSystem.access(frameworkPath);

      // Read the package.json
      const packageJsonPath = join(frameworkPath, "package.json");
      const packageJsonContent = await fileSystem.readFile(
        packageJsonPath,
        "utf-8"
      );
      const packageJson: IPackageJson = JSON.parse(packageJsonContent);

      // Validate the name
      if (!packageJson.name) {
        throw new Error("The framework has no name in its package.json");
      }

      // Extract dependencies
      const packages: string[] = [];
      if (packageJson.dependencies) {
        Object.keys(packageJson.dependencies).forEach((dep) => {
          packages.push(dep);
        });
      }

      // Determine paths
      const srcPath = join(frameworkPath, "src");
      const distPath = join(frameworkPath, "dist");
      const srcFile = join(srcPath, "bonsai.ts");
      const outJsFile = join(distPath, "bonsai.js");
      const outDtsFile = join(distPath, "bonsai.d.ts");

      this.logger.info(`Framework analyzed: ${packageJson.name}`);

      return {
        rootPath: frameworkPath,
        distPath,
        srcPath,
        outJsFile,
        outDtsFile,
        srcFile,
        packages,
        packageJson
      };
    } catch (error) {
      this.logger.error(`Error analyzing framework: ${error}`);
      throw new Error(`Unable to analyze framework: ${error}`);
    }
  }

  /**
   * Retrieve a list of components
   */
  private async collectComponents(
    componentNames: string[],
    isLibrary: boolean
  ): Promise<TPackage[]> {
    const components: TPackage[] = [];
    const componentType = isLibrary ? "library" : "package";

    for (const name of componentNames) {
      try {
        // Extract the package name without the @bonsai/ prefix
        const packageName = name.replace(/^@bonsai\//, "");
        const component = await this.collectComponent(packageName, isLibrary);
        components.push(component);
        this.logger.debug(`${componentType} analyzed: ${name}`);
      } catch (error) {
        this.logger.warn(`Error analyzing ${componentType} ${name}: ${error}`);
      }
    }

    this.logger.info(`${components.length} ${componentType}s analyzed`);
    return components;
  }

  /**
   * Retrieve a specific component
   */
  private async collectComponent(
    packageName: string,
    isLibrary: boolean
  ): Promise<TPackage> {
    const packagePath = join(this.pathManager.packagesPath, packageName);

    try {
      // Check that the folder exists
      await fileSystem.access(packagePath);

      // Read the package.json
      const packageJsonPath = join(packagePath, "package.json");
      const packageJsonContent = await fileSystem.readFile(
        packageJsonPath,
        "utf-8"
      );
      const packageJson: IPackageJson = JSON.parse(packageJsonContent);

      // Validate the name
      if (!packageJson.name) {
        throw new Error(
          `The component ${packageName} has no name in its package.json`
        );
      }

      // Extract dependencies
      const dependencies: string[] = [];
      if (packageJson.dependencies) {
        Object.keys(packageJson.dependencies).forEach((dep) => {
          dependencies.push(dep);
        });
      }

      // Determine paths
      const srcPath = join(packagePath, "src");
      const distPath = join(packagePath, "dist");

      // Determine file names based on package.json if possible
      const mainFile = packageJson.main
        ? packageJson.main.replace(/^\.\/dist\//, "").replace(/^\.\//, "")
        : `${packageName}.js`;
      const typesFile = packageJson.types
        ? packageJson.types.replace(/^\.\/dist\//, "").replace(/^\.\//, "")
        : `${packageName}.d.ts`;

      // Determine the source file
      let srcFileName = `${packageName}.ts`;
      // If src is specified in package.json, use it
      if (packageJson.src) {
        srcFileName = packageJson.src.replace(/^\.\/src\//, "");
      }

      const srcFile = join(srcPath, srcFileName);
      const outJsFile = join(distPath, mainFile);
      const outDtsFile = join(distPath, typesFile);

      // Extract the namespace
      const namespace = packageJson.namespace || null;

      // Detect upstream dependency
      const upstreamDependency =
        ComponentsRegistry.detectUpstreamDependency(packageJson);

      // Detect if this is a types-only package
      const isTypesOnly = await ComponentsRegistry.detectTypesOnlyPackage(
        packagePath,
        packageJson
      );

      if (isTypesOnly) {
        this.logger.info(
          `📝 Package ${packageJson.name} detected as types-only`
        );
      }

      return {
        rootPath: packagePath,
        name: packageJson.name,
        distPath,
        srcPath,
        outJsFile,
        outDtsFile,
        srcFile,
        dependencies,
        packageJson,
        isLibrary,
        namespace,
        upstreamDependency,
        isTypesOnly
      };
    } catch (error) {
      this.logger.error(`Error analyzing component ${packageName}: ${error}`);
      throw new Error(`Unable to analyze component ${packageName}: ${error}`);
    }
  }

  /**
   * Detect the upstream dependency name of a Bonsai wrapper.
   *
   * Priority:
   * 1. Custom field "bonsaiUpstream" in package.json (string)
   * 2. First declared dependency in "dependencies"
   * 3. Package name ("name" field)
   *
   * @param packageJson The package.json of the analyzed wrapper
   * @returns The upstream package name to track for versioning
   */
  public static detectUpstreamDependency(packageJson: IPackageJson): string {
    // 1. Custom field "bonsaiUpstream" in package.json (string)
    if (
      typeof (packageJson as any).bonsaiUpstream === "string" &&
      (packageJson as any).bonsaiUpstream.trim()
    ) {
      return (packageJson as any).bonsaiUpstream.trim();
    }
    // 2. First declared dependency in "dependencies"
    if (
      packageJson.dependencies &&
      Object.keys(packageJson.dependencies).length > 0
    ) {
      return Object.keys(packageJson.dependencies)[0];
    }
    // 3. Fallback on package name
    if (packageJson.name) {
      return packageJson.name;
    }
    throw new Error(
      "Unable to detect upstream dependency of the wrapper (incomplete package.json)"
    );
  }

  /**
   * Detect if a package is types-only (no JavaScript code, only TypeScript declarations)
   *
   * A package is considered types-only if:
   * 1. The package.json has only "types" in exports (no "import" or "require")
   * 2. The package.json has no "main" field or main points to a .d.ts file
   * 3. The src folder contains only .d.ts files (no .ts files with actual code)
   * 4. The package.json has a "types" field pointing to an index.d.ts
   *
   * @param packagePath The absolute path to the package directory
   * @param packageJson The package.json content
   * @returns true if the package is types-only, false otherwise
   */
  public static async detectTypesOnlyPackage(
    packagePath: string,
    packageJson: IPackageJson
  ): Promise<boolean> {
    try {
      // Check 1: exports field analysis
      if (packageJson.exports) {
        const exports = packageJson.exports as any;

        // If exports is a string, check if it points to a .d.ts file
        if (typeof exports === "string") {
          return exports.endsWith(".d.ts");
        }

        // If exports is an object, check if it only has "types" field
        if (typeof exports === "object" && exports !== null) {
          const mainExport = exports["."] || exports;
          if (typeof mainExport === "object" && mainExport !== null) {
            const hasTypes = "types" in mainExport;
            const hasImport = "import" in mainExport;
            const hasRequire = "require" in mainExport;
            const hasDefault = "default" in mainExport;

            // Types-only if it only has "types" field
            return hasTypes && !hasImport && !hasRequire && !hasDefault;
          }
        }
      }

      // Check 2: main field analysis
      if (packageJson.main) {
        // If main points to a .d.ts file, it's types-only
        if (packageJson.main.endsWith(".d.ts")) {
          return true;
        }
        // If main exists and doesn't point to .d.ts, it's not types-only
        return false;
      }

      // Check 3: types field must exist
      if (!packageJson.types) {
        return false;
      }

      // Check 4: examine src folder content
      const srcPath = join(packagePath, "src");
      try {
        await fileSystem.access(srcPath);
        const srcFiles = await fileSystem.readdir(srcPath, {
          withFileTypes: true
        });

        // Look for .ts files that are not .d.ts files
        for (const file of srcFiles) {
          if (
            file.isFile() &&
            file.name.endsWith(".ts") &&
            !file.name.endsWith(".d.ts")
          ) {
            // Found a regular .ts file, check if it contains actual code
            const filePath = join(srcPath, file.name);
            const content = await fileSystem.readFile(filePath, "utf-8");

            // Remove comments and whitespace
            const cleanContent = content
              .replace(/\/\*[\s\S]*?\*\//g, "") // Remove block comments
              .replace(/\/\/.*$/gm, "") // Remove line comments
              .replace(/\s+/g, " ") // Normalize whitespace
              .trim();

            // If there's substantial content beyond just type exports, it's not types-only
            if (cleanContent && !this.isOnlyTypeExports(cleanContent)) {
              return false;
            }
          }
        }

        return true; // Only .d.ts files or empty/export-only .ts files found
      } catch {
        // If src folder doesn't exist or can't be read, fall back to package.json analysis
        return packageJson.types !== undefined && !packageJson.main;
      }
    } catch (error) {
      // In case of any error, assume it's not types-only
      return false;
    }
  }

  /**
   * Helper method to check if a TypeScript file content only contains type exports
   */
  private static isOnlyTypeExports(content: string): boolean {
    // Remove import statements
    const withoutImports = content.replace(
      /import\s+.*?from\s+['"][^'"]*['"];?/g,
      ""
    );

    // Check if remaining content only contains export type/interface statements
    const exportOnlyPattern =
      /^(export\s+(type|interface|declare)\s+.*?[;}]|\s)*$/;

    return exportOnlyPattern.test(withoutImports.trim());
  }
}

// Export the instance and types
export const componentsRegistry = ComponentsRegistry.me();

/**
 * Utility function to collect Bonsai components
 */
export async function collectComponents(): Promise<TOrganizedComponents> {
  return componentsRegistry.collect();
}
