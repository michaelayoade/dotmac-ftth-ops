module.exports = {
  root: true,
  extends: ["@dotmac/eslint-config/react"],
  plugins: ["@typescript-eslint"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    tsconfigRootDir: __dirname,
    ecmaFeatures: {
      jsx: true,
    },
  },
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  ignorePatterns: ["dist", "node_modules"],
  rules: {
    "@dotmac/no-cross-portal-imports": "off",
    "@typescript-eslint/no-empty-object-type": "off",
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
    "no-console": "off",
    "react/jsx-no-bind": "off",
    "react/no-array-index-key": "off",
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
};
