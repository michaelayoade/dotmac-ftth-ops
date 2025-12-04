/**
 * @dotmac/eslint-plugin
 *
 * Custom ESLint rules used across DotMac projects.
 */

const rules = {
  "no-cross-portal-imports": require("./rules/no-cross-portal-imports"),
  "require-component-registration": require("./rules/require-component-registration"),
};

module.exports = {
  rules,
  configs: {},
};
