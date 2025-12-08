/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.json",
        diagnostics: false,
      },
    ],
  },
  moduleNameMapper: {
    "^@dotmac/http-client$": "<rootDir>/../http-client/src/index.ts",
    "^react$": "<rootDir>/../../../node_modules/react",
    "^react-dom$": "<rootDir>/../../../node_modules/react-dom",
    "^react/jsx-runtime$": "<rootDir>/../../../node_modules/react/jsx-runtime",
  },
  moduleFileExtensions: ["ts", "tsx", "js", "json"],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/**/index.ts",
    "!src/**/__tests__/**",
  ],
  coverageReporters: ["text", "lcov"],
  coverageDirectory: "coverage",
};
