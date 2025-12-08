/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.json",
        diagnostics: false,
      },
    ],
  },
  moduleNameMapper: {
    "^react$": "<rootDir>/../../../node_modules/react",
    "^react-dom$": "<rootDir>/../../../node_modules/react-dom",
    "^react/jsx-runtime$": "<rootDir>/../../../node_modules/react/jsx-runtime",
  },
  moduleFileExtensions: ["ts", "tsx", "js", "json"],
};
