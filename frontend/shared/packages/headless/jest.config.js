/** @type {import('jest').Config} */
const config = {
  displayName: "@dotmac/headless",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/__tests__/setup.ts"],
  testMatch: [
    "<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}",
    "<rootDir>/src/**/*.{test,spec}.{js,jsx,ts,tsx}",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@dotmac/headless/(.*)$": "<rootDir>/src/$1",
    "^@dotmac/headless$": "<rootDir>/src",
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
    // Provide shared testing utilities + MSW server
    "^@dotmac/testing$": "<rootDir>/../primitives/src/testing/index.ts",
  },
  collectCoverageFrom: [
    "src/**/*.{js,jsx,ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/*.stories.{js,jsx,ts,tsx}",
    "!src/**/index.{js,jsx,ts,tsx}",
    "!src/**/__tests__/**",
    "!src/**/*.test.{js,jsx,ts,tsx}",
    "!src/**/*.spec.{js,jsx,ts,tsx}",
  ],
  coverageReporters: ["text", "lcov", "html"],
  coverageDirectory: "coverage",
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  transform: {
    "^.+\\.(js|jsx|ts|tsx)$": [
      "babel-jest",
      {
        presets: [
          ["@babel/preset-env", { targets: { node: "current" } }],
          ["@babel/preset-react", { runtime: "automatic" }],
          "@babel/preset-typescript",
        ],
      },
    ],
  },
  moduleFileExtensions: ["js", "jsx", "ts", "tsx", "json", "node"],
  testTimeout: 10000,
  verbose: true,
  // Additional config for headless hook testing
  globals: {
    "process.env": {
      NODE_ENV: "test",
    },
  },
  // Ignore patterns for test files
  testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/dist/", "<rootDir>/coverage/"],
  // Watch plugins for better development experience
  watchPlugins: ["jest-watch-typeahead/filename", "jest-watch-typeahead/testname"],
  // Additional setup for React hooks testing
  testEnvironmentOptions: {
    url: "http://localhost",
  },
};

module.exports = config;
