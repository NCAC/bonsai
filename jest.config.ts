import type { Config } from "jest";

const config: Config = {
  // Basic configuration
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",

  // Test directories and files
  roots: ["<rootDir>/tests"],
  testMatch: ["**/tests/**/*.test.ts", "**/tests/**/*.spec.ts"],

  // Ignore problematic files
  testPathIgnorePatterns: [
    "/node_modules/",
    "/dist/",
    "/coverage/",
    "/tools/pug-to-ts-template/test.ts"
  ],

  // Supported file extensions
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],

  // File transformation
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "tsconfig.test.json"
      }
    ]
  },

  // ES module support
  extensionsToTreatAsEsm: [".ts"],

  // Module aliases (consistent with tsconfig.json)
  moduleNameMapper: {
    // ── Packages composants framework (ADR-0031 Option D) ──
    "^@bonsai/entity$": "<rootDir>/packages/entity/src/bonsai-entity.ts",
    "^@bonsai/feature$": "<rootDir>/packages/feature/src/bonsai-feature.ts",
    "^@bonsai/event$": "<rootDir>/packages/event/src/bonsai-event.ts",
    "^@bonsai/error$": "<rootDir>/packages/error/src/bonsai-error.ts",
    "^@bonsai/view$": "<rootDir>/packages/view/src/bonsai-view.ts",
    "^@bonsai/composer$": "<rootDir>/packages/composer/src/bonsai-composer.ts",
    "^@bonsai/foundation$":
      "<rootDir>/packages/foundation/src/bonsai-foundation.ts",
    "^@bonsai/behavior$": "<rootDir>/packages/behavior/src/bonsai-behavior.ts",
    "^@bonsai/application$":
      "<rootDir>/packages/application/src/bonsai-application.ts",
    // ── Méta-package barrel (pour tests intégration/e2e) ──
    "^@bonsai/core$": "<rootDir>/core/src/bonsai.ts",
    // ── Wrappers libs tierces ──
    "^@bonsai/types$": "<rootDir>/packages/types/index.d.ts",
    "^@bonsai/rxjs$": "<rootDir>/packages/rxjs/src/rxjs.ts",
    "^@bonsai/immer$": "<rootDir>/packages/immer/src/immer.ts",
    "^@bonsai/remeda$": "<rootDir>/packages/remeda/src/remeda.ts",
    "^@bonsai/zod$": "<rootDir>/packages/zod/src/zod.ts",
    // ── Alias internes ──
    "^@build/(.*)$": "<rootDir>/lib/build/$1",
    "^@lib/(.*)$": "<rootDir>/lib/$1",
    "^@packages/(.*)$": "<rootDir>/packages/$1",
    "^@tools/(.*)$": "<rootDir>/tools/$1"
  },

  // Coverage configuration
  collectCoverage: false,
  collectCoverageFrom: [
    "core/src/**/*.ts",
    "packages/*/src/**/*.ts",
    "lib/build/**/*.ts",
    "!**/*.d.ts",
    "!**/*.test.ts",
    "!**/__tests__/**",
    "!**/node_modules/**"
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "html", "lcov"],

  // Coverage thresholds — baseline figée à la livraison strate 0 (2026-04-21).
  // Toute régression sous ces seuils fait échouer la CI.
  // Cf. ADR-0028 (gate strate 0) et bilan coverage post-livraison.
  //
  // NB Jest : un fichier matché par un seuil path-specific est EXCLU du calcul
  // global. Les seuils ci-dessous couvrent donc explicitement chaque package
  // strate 0 ; le `global` ne sert qu'aux fichiers hors strate 0.
  coverageThreshold: {
    global: {
      statements: 80,
      lines: 80,
      branches: 55,
      functions: 55
    },
    // ── Composants core du flux unidirectionnel — exigence forte ──
    "packages/entity/src/**/*.ts": {
      statements: 100,
      lines: 100,
      branches: 95,
      functions: 100
    },
    "packages/application/src/**/*.ts": {
      statements: 95,
      lines: 95,
      branches: 85,
      functions: 95
    },
    "packages/composer/src/**/*.ts": {
      statements: 95,
      lines: 95,
      branches: 80,
      functions: 95
    },
    "packages/feature/src/**/*.ts": {
      statements: 95,
      lines: 95,
      branches: 70,
      functions: 95
    },
    "packages/view/src/**/*.ts": {
      statements: 95,
      lines: 95,
      branches: 80,
      functions: 90
    },
    // ── Plomberie événementielle — exigence haute ──
    "packages/event/src/**/*.ts": {
      statements: 85,
      lines: 85,
      branches: 80,
      functions: 75
    },
    // ── Foundation — hooks no-op non couverts intentionnellement ──
    "packages/foundation/src/**/*.ts": {
      statements: 85,
      lines: 85,
      branches: 90,
      functions: 55
    },
    // ── Helpers d'erreur défensifs — couverture faible assumée ──
    "packages/error/src/bonsai-error.class.ts": {
      statements: 70,
      lines: 70,
      branches: 60,
      functions: 95
    },
    "packages/error/src/bonsai-error.ts": {
      statements: 95,
      lines: 95,
      branches: 95,
      functions: 20
    },
    // invariant.ts — helpers défensifs jamais déclenchés sur code conforme
    "packages/error/src/invariant.ts": {
      statements: 25,
      lines: 25,
      branches: 0,
      functions: 0
    }
  },

  // Test configuration
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  testTimeout: 30000,
  verbose: true,

  // Automatic cleanup between tests
  clearMocks: true,
  restoreMocks: true
};

export default config;
