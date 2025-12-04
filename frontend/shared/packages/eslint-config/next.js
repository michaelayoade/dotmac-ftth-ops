/**
 * Next.js-specific ESLint configuration for DotMac projects
 */

const react = require("./react");

module.exports = {
  ...react,

  extends: [...react.extends, "plugin:@next/next/recommended"],

  plugins: [...react.plugins, "@next/next"],

  rules: {
    ...react.rules,

    // Next.js specific rules
    "@next/next/google-font-display": "error",
    "@next/next/google-font-preconnect": "error",
    "@next/next/next-script-for-ga": "error",
    "@next/next/no-before-interactive-script-outside-document": "error",
    "@next/next/no-css-tags": "error",
    "@next/next/no-document-import-in-page": "error",
    "@next/next/no-duplicate-head": "error",
    "@next/next/no-head-element": "error",
    "@next/next/no-head-import-in-document": "error",
    "@next/next/no-html-link-for-pages": "error",
    "@next/next/no-img-element": "error",
    "@next/next/no-page-custom-font": "error",
    "@next/next/no-styled-jsx-in-document": "error",
    "@next/next/no-sync-scripts": "error",
    "@next/next/no-title-in-document-head": "error",
    "@next/next/no-typos": "error",
    "@next/next/no-unwanted-polyfillio": "error",

    // Performance optimizations for Next.js
    "@next/next/inline-script-id": "error",
    "@next/next/no-assign-module-variable": "error",

    // Security enhancements for Next.js
    "@next/next/no-server-import-in-page": "error",

    // Disable some rules that conflict with Next.js patterns
    "jsx-a11y/anchor-is-valid": [
      "error",
      {
        components: ["Link"],
        specialLink: ["hrefLeft", "hrefRight"],
        aspects: ["invalidHref", "preferButton"],
      },
    ],
  },

  overrides: [
    // API routes specific rules
    {
      files: ["pages/api/**/*", "app/api/**/*", "src/pages/api/**/*", "src/app/api/**/*"],
      rules: {
        "@dotmac/no-cross-portal-imports": "off", // API routes may need cross-portal access
        "import/no-anonymous-default-export": "off", // API routes use anonymous exports
      },
    },

    // App directory specific rules
    {
      files: ["app/**/*", "src/app/**/*"],
      rules: {
        "react/no-unescaped-entities": "off", // App directory handles this differently
      },
    },

    // Pages directory specific rules
    {
      files: ["pages/**/*", "src/pages/**/*"],
      rules: {
        "react/react-in-jsx-scope": "off", // Pages don't need React import
        "import/no-anonymous-default-export": "off", // Pages use anonymous exports
      },
    },
  ],

  env: {
    browser: true,
    es2021: true,
    node: true,
  },
};
