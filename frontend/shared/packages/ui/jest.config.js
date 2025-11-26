const path = require("path");

const esModules = [
  "react-leaflet",
  "@react-leaflet",
  "leaflet",
  "next-intl",
  "next-themes",
  "use-intl",
];
const esmPattern = esModules.join("|");
const transformIgnorePattern = `node_modules/(?!((?:\\.pnpm/[^/]+/node_modules/)?(${esmPattern}))/)`;
const workspaceRoot = path.resolve(__dirname, "../../..");
const workspaceReact = path.join(workspaceRoot, "node_modules/react/index.js");
const workspaceReactDom = path.join(workspaceRoot, "node_modules/react-dom/index.js");
const workspaceReactJsxRuntime = path.join(workspaceRoot, "node_modules/react/jsx-runtime.js");

/** @type {import('jest').Config} */
const config = {
  displayName: "@dotmac/ui",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/__tests__/setup.ts"],
  testMatch: [
    "<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}",
    "<rootDir>/src/**/*.{test,spec}.{js,jsx,ts,tsx}",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
    "^react$": workspaceReact,
    "^react-dom$": workspaceReactDom,
    "^react/jsx-runtime$": workspaceReactJsxRuntime,
  },
  collectCoverageFrom: [
    "src/**/*.{js,jsx,ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/*.stories.{js,jsx,ts,tsx}",
    "!src/**/index.{js,jsx,ts,tsx}",
  ],
  coverageReporters: ["text", "lcov", "html"],
  coverageDirectory: "coverage",
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  transform: {
    "^.+\\.(js|jsx|ts|tsx)$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: {
          jsx: "react-jsx",
        },
      },
    ],
  },
  transformIgnorePatterns: [transformIgnorePattern],
  moduleFileExtensions: ["js", "jsx", "ts", "tsx", "json", "node"],
  testTimeout: 10000,
  verbose: true,
  preset: "ts-jest/presets/js-with-ts",
  extensionsToTreatAsEsm: [".ts", ".tsx"],
};

module.exports = config;
