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
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "no-unused-vars": "off",
    "no-alert": "off",
    "no-useless-catch": "off",
    "no-duplicate-imports": "off",
    "react/jsx-no-bind": "off",
    "react/no-array-index-key": "off",
    "react/no-danger": "off",
    "jsx-a11y/label-has-associated-control": "off",
    "jsx-a11y/no-static-element-interactions": "off",
    "jsx-a11y/click-events-have-key-events": "off",
  },
  ignorePatterns: ["dist", "node_modules"],
};
