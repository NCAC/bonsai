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

  // Test configuration
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  testTimeout: 30000,
  verbose: true,

  // Automatic cleanup between tests
  clearMocks: true,
  restoreMocks: true
};

export default config;
