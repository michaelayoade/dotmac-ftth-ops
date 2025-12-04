/**
 * ESLint rule: require-component-registration
 *
 * Ensures that React components are properly registered with the
 * component registry system for tracking and metadata purposes.
 */

module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Require React components to be registered with the component registry",
      category: "Best Practices",
      recommended: false,
    },
    fixable: "code",
    schema: [
      {
        type: "object",
        properties: {
          enforceRegistration: {
            type: "boolean",
            description: "Whether to enforce component registration (default: false)",
            default: false,
          },
          componentPatterns: {
            type: "array",
            items: {
              type: "string",
            },
            description: "File patterns that should have registered components",
            default: ["**/*.component.tsx", "**/components/**/*.tsx"],
          },
          excludePatterns: {
            type: "array",
            items: {
              type: "string",
            },
            description: "File patterns to exclude from registration requirement",
            default: ["**/*.test.tsx", "**/*.stories.tsx", "**/*.spec.tsx"],
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missingRegistration:
        'Component "{{componentName}}" should be registered with the component registry using @registerComponent or withComponentRegistration.',
      suggestionAddRegistration: "Add component registration decorator",
      missingMetadata: "Component registration is missing required metadata",
    },
  },

  create(context) {
    const options = context.options[0] || {};
    const enforceRegistration = options.enforceRegistration || false;
    const componentPatterns = options.componentPatterns || [
      "**/*.component.tsx",
      "**/components/**/*.tsx",
    ];
    const excludePatterns = options.excludePatterns || [
      "**/*.test.tsx",
      "**/*.stories.tsx",
      "**/*.spec.tsx",
    ];

    const filename = context.getFilename();
    const sourceCode = context.getSourceCode();

    // Check if file should be processed
    function shouldProcessFile() {
      const path = require("path");
      const minimatch = require("minimatch");
      const relativePath = path.relative(process.cwd(), filename);

      // Check exclude patterns first
      if (excludePatterns.some((pattern) => minimatch(relativePath, pattern))) {
        return false;
      }

      // Check if file matches component patterns
      return componentPatterns.some((pattern) => minimatch(relativePath, pattern));
    }

    // Check if component is registered
    function hasRegistrationDecorator(node) {
      if (!node.decorators) return false;

      return node.decorators.some((decorator) => {
        if (decorator.expression.type === "CallExpression") {
          return decorator.expression.callee.name === "registerComponent";
        }
        return decorator.expression.name === "registerComponent";
      });
    }

    // Check if component is wrapped with registration HOC
    function hasRegistrationHOC(node) {
      const parent = node.parent;

      if (parent && parent.type === "CallExpression") {
        const callee = parent.callee;
        return callee.name === "withComponentRegistration";
      }

      return false;
    }

    // Check if file imports registration utilities
    function hasRegistrationImports() {
      const imports = sourceCode.ast.body
        .filter((node) => node.type === "ImportDeclaration")
        .map((node) => ({
          source: node.source.value,
          specifiers: node.specifiers.map((spec) =>
            spec.imported ? spec.imported.name : spec.local.name,
          ),
        }));

      return imports.some(
        (imp) =>
          imp.source === "@dotmac/registry" &&
          (imp.specifiers.includes("registerComponent") ||
            imp.specifiers.includes("withComponentRegistration")),
      );
    }

    // Extract component name
    function getComponentName(node) {
      if (node.type === "FunctionDeclaration") {
        return node.id ? node.id.name : null;
      }

      if (node.type === "VariableDeclarator") {
        return node.id.name;
      }

      if (node.type === "ExportDefaultDeclaration") {
        if (node.declaration.type === "FunctionDeclaration") {
          return node.declaration.id ? node.declaration.id.name : "DefaultExport";
        }
        if (node.declaration.type === "Identifier") {
          return node.declaration.name;
        }
      }

      return null;
    }

    // Check if node is a React component
    function isReactComponent(node) {
      // Function components
      if (
        node.type === "FunctionDeclaration" ||
        (node.type === "VariableDeclarator" &&
          node.init &&
          (node.init.type === "ArrowFunctionExpression" || node.init.type === "FunctionExpression"))
      ) {
        const componentName = getComponentName(node);

        // Component name should start with uppercase
        if (!componentName || !/^[A-Z]/.test(componentName)) {
          return false;
        }

        // Check if it returns JSX
        const functionNode = node.type === "FunctionDeclaration" ? node : node.init;

        // Simple heuristic: if it has JSX in return statements
        let hasJSX = false;

        const checkForJSX = (n) => {
          if (n.type === "JSXElement" || n.type === "JSXFragment") {
            hasJSX = true;
            return;
          }

          if (n.type === "ReturnStatement" && n.argument) {
            if (n.argument.type === "JSXElement" || n.argument.type === "JSXFragment") {
              hasJSX = true;
            }
          }

          // Recursively check child nodes
          for (const key in n) {
            if (key !== "parent" && n[key] && typeof n[key] === "object") {
              if (Array.isArray(n[key])) {
                n[key].forEach(checkForJSX);
              } else if (n[key].type) {
                checkForJSX(n[key]);
              }
            }
          }
        };

        if (functionNode.body) {
          checkForJSX(functionNode.body);
        }

        return hasJSX;
      }

      return false;
    }

    // Only process if file matches patterns
    if (!shouldProcessFile()) {
      return {};
    }

    const componentsFound = [];
    const hasRegistrationUtils = hasRegistrationImports();

    return {
      FunctionDeclaration(node) {
        if (isReactComponent(node)) {
          const componentName = getComponentName(node);

          if (componentName && !hasRegistrationDecorator(node) && !hasRegistrationHOC(node)) {
            componentsFound.push({
              node,
              name: componentName,
            });
          }
        }
      },

      VariableDeclarator(node) {
        if (isReactComponent(node)) {
          const componentName = getComponentName(node);

          if (componentName && !hasRegistrationHOC(node)) {
            componentsFound.push({
              node,
              name: componentName,
            });
          }
        }
      },

      "Program:exit"() {
        // Only report if enforcement is enabled or if registration utils are imported
        if (!enforceRegistration && !hasRegistrationUtils) {
          return;
        }

        componentsFound.forEach(({ node, name }) => {
          context.report({
            node,
            messageId: "missingRegistration",
            data: {
              componentName: name,
            },
          });
        });
      },
    };
  },
};
