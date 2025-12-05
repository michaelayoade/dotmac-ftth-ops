/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: {
          esModuleInterop: true,
          module: "commonjs",
          target: "ES2020",
          lib: ["DOM", "ES2020"],
          strict: true,
          skipLibCheck: true,
        },
        diagnostics: false,
      },
    ],
  },
  moduleFileExtensions: ["ts", "js", "json"],
  setupFilesAfterEnv: ["<rootDir>/src/__tests__/setup.ts"],
};
