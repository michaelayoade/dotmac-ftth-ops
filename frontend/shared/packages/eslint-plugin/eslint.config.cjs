const js = require("@eslint/js");

const nodeGlobals = {
  __dirname: "readonly",
  __filename: "readonly",
  Buffer: "readonly",
  console: "readonly",
  exports: "writable",
  module: "writable",
  process: "readonly",
  require: "readonly",
  setImmediate: "readonly",
  clearImmediate: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
};

const jestGlobals = {
  afterAll: "readonly",
  afterEach: "readonly",
  beforeAll: "readonly",
  beforeEach: "readonly",
  describe: "readonly",
  expect: "readonly",
  it: "readonly",
  jest: "readonly",
  test: "readonly",
};

const baseRecommended = js.configs.recommended;

module.exports = [
  {
    ignores: ["node_modules/**"],
  },
  {
    ...baseRecommended,
    files: ["**/*.js"],
    languageOptions: {
      ...(baseRecommended.languageOptions || {}),
      ecmaVersion: 2021,
      sourceType: "commonjs",
      globals: {
        ...((baseRecommended.languageOptions && baseRecommended.languageOptions.globals) || {}),
        ...nodeGlobals,
      },
    },
  },
  {
    files: ["__tests__/**/*.js", "**/*.test.js"],
    languageOptions: {
      ...(baseRecommended.languageOptions || {}),
      ecmaVersion: 2021,
      sourceType: "commonjs",
      globals: {
        ...((baseRecommended.languageOptions && baseRecommended.languageOptions.globals) || {}),
        ...nodeGlobals,
        ...jestGlobals,
      },
    },
  },
];
