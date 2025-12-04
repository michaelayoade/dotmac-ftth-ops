const path = require("path");

const esModules = [
  "react-leaflet",
  "@react-leaflet",
  "leaflet",
  "framer-motion",
  "recharts",
  "@radix-ui",
  "lucide-react",
  "@heroicons/react",
];

const esmPattern = esModules.join("|");
const transformIgnorePattern = `node_modules/(?!((?:\\.pnpm/[^/]+/node_modules/)?(${esmPattern}))/)`;
const workspaceRoot = path.resolve(__dirname, "../../..");
const workspaceReact = path.join(workspaceRoot, "node_modules/react/index.js");
const workspaceReactDom = path.join(workspaceRoot, "node_modules/react-dom/index.js");
const workspaceReactJsxRuntime = path.join(workspaceRoot, "node_modules/react/jsx-runtime.js");

/** @type {import('jest').Config} */
const config = {
  displayName: "@dotmac/primitives",
  rootDir: __dirname,
  preset: "ts-jest/presets/js-with-ts",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/__tests__/setup.ts"],
  testMatch: [
    "<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}",
    "<rootDir>/src/**/*.{test,spec}.{js,jsx,ts,tsx}",
  ],
  moduleNameMapper: {
    "^@dotmac/primitives$": "<rootDir>/src/index.ts",
    "^@dotmac/primitives/(.*)$": "<rootDir>/src/$1",
    "^@dotmac/testing$": "<rootDir>/src/testing/index.ts",
    "^@dotmac/headless$": "<rootDir>/../headless/src/index.ts",
    "^@dotmac/headless/(.*)$": "<rootDir>/../headless/src/$1",
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
    "^react$": workspaceReact,
    "^react-dom$": workspaceReactDom,
    "^react/jsx-runtime$": workspaceReactJsxRuntime,
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
  extensionsToTreatAsEsm: [".ts", ".tsx"],
  transformIgnorePatterns: [transformIgnorePattern],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  testTimeout: 15000,
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/*.stories.{ts,tsx}",
    "!src/**/index.{ts,tsx}",
  ],
  coverageDirectory: "<rootDir>/coverage",
  coverageReporters: ["text", "lcov", "html"],
  resetMocks: true,
  clearMocks: true,
};

module.exports = config;
