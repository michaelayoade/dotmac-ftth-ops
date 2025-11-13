module.exports = {
  root: true,
  extends: ["@dotmac/eslint-config/react"],
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
  },
  rules: {
    "@dotmac/no-cross-portal-imports": "off",
    "@typescript-eslint/no-empty-object-type": "off",
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      },
    ],
    "no-unused-vars": "off",
    "react/jsx-no-bind": "off",
    "react/no-array-index-key": "off",
  },
  overrides: [
    {
      files: ["**/*.examples.ts?(x)", "**/__tests__/**/*.{ts,tsx}"],
      rules: {
        "no-console": "off",
      },
    },
  ],
  ignorePatterns: ["dist", "node_modules"],
};
