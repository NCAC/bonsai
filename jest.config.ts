import type { Config } from "jest";

/** Threshold of a fully covered file. */
const full = { statements: 100, branches: 100, functions: 100, lines: 100 };

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
    "/coverage/"
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
    // ── Packages composants framework (ADR-28 Option D) ──
    "^@bonsai/entity$": "<rootDir>/packages/entity/src/bonsai-entity.ts",
    "^@bonsai/feature$": "<rootDir>/packages/feature/src/bonsai-feature.ts",
    "^@bonsai/kernel$": "<rootDir>/packages/kernel/src/bonsai-kernel.ts",
    "^@bonsai/error$": "<rootDir>/packages/error/src/bonsai-error.ts",
    "^@bonsai/view$": "<rootDir>/packages/view/src/bonsai-view.ts",
    "^@bonsai/composer$": "<rootDir>/packages/composer/src/bonsai-composer.ts",
    "^@bonsai/foundation$":
      "<rootDir>/packages/foundation/src/bonsai-foundation.ts",
    "^@bonsai/router$": "<rootDir>/packages/router/src/bonsai-router.ts",
    "^@bonsai/behavior$": "<rootDir>/packages/behavior/src/bonsai-behavior.ts",
    "^@bonsai/application$":
      "<rootDir>/packages/application/src/bonsai-application.ts",
    // ── Méta-package barrel (pour tests intégration/e2e) ──
    "^@bonsai/core$": "<rootDir>/core/src/bonsai.ts",
    // ── Wrappers libs tierces ──
    "^@bonsai/types$": "<rootDir>/packages/types/index.d.ts",
    "^@bonsai/rxjs$": "<rootDir>/packages/rxjs/src/rxjs.ts",
    "^@bonsai/immer$": "<rootDir>/packages/immer/src/immer.ts",
    "^@bonsai/valibot$": "<rootDir>/packages/valibot/src/valibot.ts",
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

  // Coverage thresholds — raised on 2026-11-03 to the measured coverage,
  // rounded down to the integer. Any regression below them fails the CI.
  // Cf. ADR-31 (strate 0 gate) and ADR-32 (tests are the proof).
  //
  // NB Jest: a path-specific threshold applies to each matched file, and a
  // matched file is EXCLUDED from the global computation. `global` therefore
  // only covers the files no pattern names (core, immer, rxjs, valibot).
  //
  // At 100: a new uncovered line, branch or function in these files fails the
  // CI. Below 100: the branches left aside on purpose (defensive fallbacks,
  // edge cases the theory does not settle yet — cf. tests/unit/kernel/root.test.ts).
  coverageThreshold: {
    global: full,
    "packages/application/src/**/*.ts": full,
    "packages/composer/src/**/*.ts": full,
    "packages/entity/src/**/*.ts": full,
    "packages/error/src/**/*.ts": full,
    "packages/feature/src/**/*.ts": full,
    "packages/foundation/src/**/*.ts": full,
    // root.ts: 98.78 / 96.77 / 98.43 / 100 on 2026-11-03.
    "packages/kernel/src/**/*.ts": { statements: 98, branches: 96, functions: 98, lines: 100 },
    // history-adapter.ts: 99.12 / 87.09 / 100 / 100 on 2026-11-03.
    "packages/router/src/**/*.ts": { statements: 99, branches: 87, functions: 100, lines: 100 },
    // bonsai-view.ts: 100 / 97.05 / 100 / 100 on 2026-11-04.
    "packages/view/src/**/*.ts": { statements: 100, branches: 97, functions: 100, lines: 100 }
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
