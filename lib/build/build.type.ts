// Types centralisés pour le système de build

import { IPackageJson } from "package-json-type";
import { InputOptions, OutputOptions, RollupOptions } from "rollup";

/**
 * Type représentant un package stocké avec sa configuration
 */
export type TStoredPackage = {
  rootPath: string;
  packageName: string;
  distPath: string;
  srcPath: string;
  outJsFile: string;
  outDtsFile: string;
  srcFile: string;
  externalName?: string; // Propriété optionnelle pour les packages externes
  rollupOptions: {
    js: { input: RollupOptions; output: OutputOptions };
    dts: { input: RollupOptions; output: OutputOptions };
  };
};

/**
 * Type représentant le framework
 */
export type TFramework = {
  rootPath: string;
  distPath: string;
  srcPath: string;
  outJsFile: string;
  outDtsFile: string;
  srcFile: string;
  packages: string[];
  packageJson: IPackageJson;
};

/**
 * Type représentant un package
 */
export type TPackage = {
  rootPath: string;
  name: string;
  distPath: string;
  srcPath: string;
  outJsFile: string;
  outDtsFile: string;
  srcFile: string;
  dependencies: string[];
  packageJson: IPackageJson;
  isLibrary?: boolean;
  namespace?: string | null;
  /**
   * Nom de la dépendance amont (upstream) à tracker pour la version (ex: 'rxjs' ou 'remeda')
   */
  upstreamDependency?: string;
};

/**
 * Type représentant l'ensemble des packages et le framework
 */
export type TPackagesAndFrameWork = {
  packages: TPackage[];
  framework: TFramework;
};
