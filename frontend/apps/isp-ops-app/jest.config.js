const nextJest = require("next/jest");

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: "./",
});

// Add any custom config to be passed to Jest
const config = {
  coverageProvider: "v8",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  // Increase timeout for full suite runs with MSW (tests complete in 2-5s individually)
  testTimeout: 15000,
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^@dotmac/testing$": "<rootDir>/../../shared/packages/primitives/src/testing/index.ts",
    "^@dotmac/([^/]+)$": "<rootDir>/../../shared/packages/$1/src",
    "^@dotmac/([^/]+)/(.+)$": "<rootDir>/../../shared/packages/$1/src/$2",
    // MSW v2 with legacy compatibility layer for handlers using rest.get() syntax
    "^msw$": "<rootDir>/__tests__/msw/legacy.cjs",
    "^until-async$": "<rootDir>/jest.until-async.cjs",
    "^until-async/(.*)$": "<rootDir>/jest.until-async.cjs",
    "^msw/node$": "<rootDir>/jest.mswnode.cjs",
    "^@mswjs/interceptors$": "<rootDir>/node_modules/@mswjs/interceptors/lib/node/index.js",
    "^@mswjs/interceptors/ClientRequest$":
      "<rootDir>/node_modules/@mswjs/interceptors/lib/node/interceptors/ClientRequest/index.js",
    "^@mswjs/interceptors/XMLHttpRequest$":
      "<rootDir>/node_modules/@mswjs/interceptors/lib/node/interceptors/XMLHttpRequest/index.js",
    "^@mswjs/interceptors/fetch$":
      "<rootDir>/node_modules/@mswjs/interceptors/lib/node/interceptors/fetch/index.js",
  },
  testMatch: ["**/__tests__/**/*.test.[jt]s?(x)", "**/?(*.)+(spec|test).[jt]s?(x)"],
  transformIgnorePatterns: ["node_modules/(?!(msw|@mswjs|@bundled-es-modules|until-async)/)"],
  collectCoverageFrom: [
    "hooks/**/*.{js,jsx,ts,tsx}",
    "app/**/*.{js,jsx,ts,tsx}",
    "components/**/*.{js,jsx,ts,tsx}",
    "lib/**/*.{js,jsx,ts,tsx}",
    "!**/*.d.ts",
    "!**/node_modules/**",
    "!**/.next/**",
    "!**/coverage/**",
    "!**/jest.config.js",
  ],
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(config);
