import fileSystem from "fs-extra";
import { join } from "node:path";
import { IPackageJson, IDependencyMap } from "package-json-type";
import { load as yamlLoad } from "js-yaml";
import { isDefined } from "remeda";

export type TFramework = {
  name: string;
  src: string;
  out: string;
  types: string;
  dependencies: string[];
  rootPath: string;
};
export type TPackage = TFramework & {
  namespace: false | string;
};

async function getPackagesDirectories(rootPath: string): Promise<string[]> {
  try {
    const packagesPath = join(rootPath, "packages");
    await fileSystem.ensureDir(packagesPath);
    let filesAndDirectories = await fileSystem.readdir(packagesPath);

    let packagesDirectories: string[] = [];
    await Promise.all(
      filesAndDirectories.map(async (name) => {
        const packagePath = join(packagesPath, name);
        const stat = await fileSystem.stat(packagePath);
        if (stat.isDirectory()) {
          packagesDirectories.push(packagePath);
        }
      })
    );
    return packagesDirectories;
  } catch (e) {
    throw e;
  }
}

export async function getPackagesInfos(
  directories: string[]
): Promise<TPackage[]> {
  return Promise.all(
    directories.map(async (directory) => {
      const packageJson: IPackageJson = await fileSystem.readJSON(
        join(directory, "package.json")
      );
      try {
        let dependencies: string[] = [];
        if (packageJson.dependencies) {
          dependencies = Object.keys(
            packageJson.dependencies as IDependencyMap
          ) as string[];
        }

        const external_name = isDefined(packageJson.external_name)
          ? packageJson.external_name
          : false;

        return {
          rootPath: directory,
          name: packageJson.name as string,
          src: join(directory, packageJson.src),
          out: join(directory, packageJson.main as string),
          types: join(directory, packageJson.types as string),
          dependencies,
          external_name
        };
      } catch (err) {
        throw err;
      }
    })
  );
}

export type TPackagesPhases = {
  readonly libraries: TPackage[]; // Packages externes compilables en parallèle
  readonly packages: TPackage[]; // Packages internes à compiler séquentiellement
};

export type TPackagesAndFrameWork = {
  readonly rootPath: string;
  readonly framework: TFramework;
  readonly packages: Set<TPackage>;
  readonly phases: TPackagesPhases;
};

export async function getFrameworkPackages(): Promise<TPackagesAndFrameWork> {
  try {
    const rootPath = process.cwd();
    const frameworkRootPath = join(rootPath, "core");
    const packagesDirectories = await getPackagesDirectories(rootPath);
    const packagesInfos = await getPackagesInfos(packagesDirectories);
    const orderedPackages = new Set<TPackage>();
    const librariesPackages: TPackage[] = [];
    const internalPackages: TPackage[] = [];

    // Charger le fichier de configuration des packages
    const orderedPackagesFile = await fileSystem.readFile(
      join(rootPath, "bonsai-components.yaml"),
      "utf-8"
    );

    // Charger la nouvelle structure YAML avec les catégories
    const packagesConfig = yamlLoad(orderedPackagesFile) as {
      libraries: string[];
      packages: string[];
    };

    // Traiter les packages externes (bibliothèques)
    if (Array.isArray(packagesConfig.libraries)) {
      packagesConfig.libraries.forEach((packageName) => {
        const found = packagesInfos.find((myPackage) => {
          return packageName === myPackage.name;
        });

        if (found) {
          librariesPackages.push(found);
          orderedPackages.add(found);
        }
      });
    }

    // Traiter les packages internes (maison)
    if (Array.isArray(packagesConfig.packages)) {
      packagesConfig.packages.forEach((packageName) => {
        const found = packagesInfos.find((myPackage) => {
          return packageName === myPackage.name;
        });

        if (found) {
          internalPackages.push(found);
          orderedPackages.add(found);
        }
      });
    }

    const frameworkPackageJson: IPackageJson = await fileSystem.readJSON(
      join(frameworkRootPath, "package.json")
    );

    const frameworkDependencies = Object.keys(
      <IDependencyMap>frameworkPackageJson.dependencies
    );

    return {
      rootPath,
      framework: {
        rootPath: frameworkRootPath,
        name: frameworkPackageJson.name as string,
        src: frameworkPackageJson.src,
        out: frameworkPackageJson.main as string,
        types: frameworkPackageJson.types as string,
        dependencies: frameworkDependencies
      },
      packages: orderedPackages as Set<TPackage>,
      phases: {
        libraries: librariesPackages,
        packages: internalPackages
      }
    } as const;
  } catch (err) {
    throw err;
  }
}
