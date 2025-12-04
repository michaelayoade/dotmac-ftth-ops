/**
 * Base ESLint configuration for DotMac projects
 */

module.exports = {
  plugins: ["@dotmac", "import"],

  // Register custom rules
  rules: {
    // Custom DotMac rules
    "@dotmac/no-cross-portal-imports": "error",
    "@dotmac/require-component-registration": "warn",

    // Enhanced security rules
    "no-eval": "error",
    "no-implied-eval": "error",
    "no-new-func": "error",
    "no-script-url": "error",
    "no-alert": "error",
    // Disallow console.log/debug/info in production code
    // console.warn and console.error are allowed for legitimate error handling
    "no-console": ["error", { allow: ["warn", "error"] }],

    // Prevent dangerous patterns
    "no-caller": "error",
    "no-extend-native": "error",
    "no-extra-bind": "error",
    "no-iterator": "error",
    "no-lone-blocks": "error",
    "no-loop-func": "error",
    "no-multi-str": "error",
    "no-new-object": "error",
    "no-new-wrappers": "error",
    "no-octal-escape": "error",
    "no-proto": "error",
    "no-return-assign": "error",
    "no-self-compare": "error",
    "no-sequences": "error",
    "no-throw-literal": "error",
    "no-unused-expressions": "error",
    "no-useless-call": "error",
    "no-useless-concat": "error",
    "no-void": "error",
    "no-with": "error",

    // Custom security patterns
    "no-restricted-globals": [
      "error",
      {
        name: "localStorage",
        message: "Use secureStorage utility instead of direct localStorage access for security.",
      },
      {
        name: "sessionStorage",
        message: "Use secureStorage utility instead of direct sessionStorage access for security.",
      },
    ],

    "no-restricted-syntax": [
      "error",
      {
        selector: "CallExpression[callee.name='eval']",
        message: "eval() is dangerous and should never be used.",
      },
      {
        selector: "NewExpression[callee.name='Function']",
        message: "new Function() is dangerous and should never be used.",
      },
      {
        selector: "AssignmentExpression[left.property.name='innerHTML']",
        message:
          "innerHTML assignments can lead to XSS. Use textContent or a sanitization library.",
      },
      {
        selector: "AssignmentExpression[left.property.name='outerHTML']",
        message:
          "outerHTML assignments can lead to XSS. Use textContent or a sanitization library.",
      },
    ],

    // Import/export rules
    "import/order": [
      "error",
      {
        groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
        "newlines-between": "always",
        alphabetize: {
          order: "asc",
          caseInsensitive: true,
        },
      },
    ],

    // Code quality rules
    "prefer-const": "error",
    "no-var": "error",
    "object-shorthand": "error",
    "prefer-arrow-callback": "error",
    "prefer-template": "error",

    // Performance rules
    "no-inner-declarations": "error",
    "no-duplicate-imports": "error",
    "no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      },
    ],
  },

  settings: {
    "import/resolver": {
      typescript: {
        alwaysTryTypes: true,
        project: ["./tsconfig.json", "./packages/*/tsconfig.json", "./apps/*/tsconfig.json"],
      },
    },
  },
};
