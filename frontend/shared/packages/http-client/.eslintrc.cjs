module.exports = {
  root: true,
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "@dotmac/eslint-config"],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  parserOptions: {
    tsconfigRootDir: __dirname,
    sourceType: "module",
  },
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  rules: {
    "@dotmac/no-cross-portal-imports": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      },
    ],
    "@typescript-eslint/no-unused-expressions": "off",
    "no-unused-vars": "off",
    "no-restricted-globals": "off",
  },
  overrides: [
    {
      files: ["**/__tests__/**/*.{ts,tsx}"],
      rules: {
        "@typescript-eslint/no-unused-vars": "off",
        "@typescript-eslint/ban-ts-comment": "off",
      },
    },
  ],
  ignorePatterns: ["dist", "node_modules"],
};
