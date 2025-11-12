/**
 * ESLint rule: no-cross-portal-imports
 *
 * Prevents importing components from different portals to maintain
 * architectural boundaries and prevent style conflicts.
 */

const path = require("path");

const PORTAL_PATTERNS = {
  admin: /@dotmac\/styled-components\/admin|\/admin\//,
  customer: /@dotmac\/styled-components\/customer|\/customer\//,
  reseller: /@dotmac\/styled-components\/reseller|\/reseller\//,
  shared: /@dotmac\/styled-components\/shared|\/shared\//,
};

const ALLOWED_CROSS_PORTAL_IMPORTS = [
  "@dotmac/primitives",
  "@dotmac/headless",
  "@dotmac/registry",
  "@dotmac/security",
  "@dotmac/testing",
  "@dotmac/styled-components/shared", // Shared components are always allowed
];

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow importing components from different portals",
      category: "Best Practices",
      recommended: true,
    },
    fixable: null,
    schema: [
      {
        type: "object",
        properties: {
          allowedCrossPortalImports: {
            type: "array",
            items: {
              type: "string",
            },
            description: "Additional modules allowed to be imported across portals",
          },
          strictMode: {
            type: "boolean",
            description: "Whether to enforce strict portal boundaries (default: true)",
            default: true,
          },
          ignorePatterns: {
            type: "array",
            items: {
              type: "string",
            },
            description: "File patterns to ignore (glob patterns)",
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      crossPortalImport:
        'Cannot import "{{importPath}}" from {{sourcePortal}} portal into {{targetPortal}} portal. Portals should remain isolated.',
      unknownPortal:
        'Cannot determine portal for file "{{filename}}". Ensure proper directory structure.',
      restrictedImport: 'Import "{{importPath}}" is not allowed in portal "{{portal}}".',
    },
  },

  create(context) {
    const options = context.options[0] || {};
    const allowedCrossPortalImports = [
      ...ALLOWED_CROSS_PORTAL_IMPORTS,
      ...(options.allowedCrossPortalImports || []),
    ];
    const strictMode = options.strictMode !== false;
    const ignorePatterns = options.ignorePatterns || [];

    // Get the current file's path
    const filename = context.getFilename();

    // Check if file should be ignored
    if (
      ignorePatterns.some((pattern) => {
        const regex = new RegExp(pattern.replace(/\*/g, ".*"));
        return regex.test(filename);
      })
    ) {
      return {};
    }

    // Determine the portal of the current file
    function getCurrentPortal() {
      const relativePath = path.relative(process.cwd(), filename);

      if (relativePath.includes("isp-framework/admin/") || relativePath.includes("/admin/")) {
        return "admin";
      }
      if (relativePath.includes("isp-framework/customer/") || relativePath.includes("/customer/")) {
        return "customer";
      }
      if (relativePath.includes("isp-framework/reseller/") || relativePath.includes("/reseller/")) {
        return "reseller";
      }
      if (
        relativePath.includes("isp-framework/field-ops/") ||
        relativePath.includes("/field-ops/")
      ) {
        return "field-ops";
      }
      if (
        relativePath.includes("management-portal/admin/") ||
        relativePath.includes("management-portal/reseller/") ||
        relativePath.includes("management-portal/tenant/")
      ) {
        return "management";
      }
      if (relativePath.includes("/shared/")) {
        return "shared";
      }

      // Check styled-components package structure
      for (const [portal, pattern] of Object.entries(PORTAL_PATTERNS)) {
        if (pattern.test(relativePath)) {
          return portal;
        }
      }

      return null;
    }

    // Determine the portal of an import path
    function getImportPortal(importPath) {
      for (const [portal, pattern] of Object.entries(PORTAL_PATTERNS)) {
        if (pattern.test(importPath)) {
          return portal;
        }
      }
      return null;
    }

    // Check if import is allowed
    function isImportAllowed(importPath, currentPortal) {
      // Always allow imports from allowed cross-portal modules
      if (allowedCrossPortalImports.some((allowed) => importPath.startsWith(allowed))) {
        return true;
      }

      const importPortal = getImportPortal(importPath);

      // If no portal detected in import, allow it (likely external or primitives)
      if (!importPortal) {
        return true;
      }

      // Allow imports from same portal
      if (importPortal === currentPortal) {
        return true;
      }

      // Allow imports from shared portal to any portal
      if (importPortal === "shared") {
        return true;
      }

      // Disallow cross-portal imports
      return false;
    }

    const currentPortal = getCurrentPortal();

    // If we can't determine current portal and strict mode is on, warn
    if (!currentPortal && strictMode) {
      return {
        Program(node) {
          context.report({
            node,
            messageId: "unknownPortal",
            data: {
              filename: path.relative(process.cwd(), filename),
            },
          });
        },
      };
    }

    return {
      ImportDeclaration(node) {
        const importPath = node.source.value;

        // Skip relative imports and non-dotmac imports
        if (importPath.startsWith(".") || !importPath.startsWith("@dotmac/")) {
          return;
        }

        // Skip if no current portal (non-strict mode)
        if (!currentPortal && !strictMode) {
          return;
        }

        if (!isImportAllowed(importPath, currentPortal)) {
          const importPortal = getImportPortal(importPath);

          context.report({
            node,
            messageId: "crossPortalImport",
            data: {
              importPath,
              sourcePortal: importPortal,
              targetPortal: currentPortal,
            },
          });
        }
      },

      // Also check dynamic imports
      CallExpression(node) {
        if (
          node.callee.type === "Import" &&
          node.arguments.length === 1 &&
          node.arguments[0].type === "Literal"
        ) {
          const importPath = node.arguments[0].value;

          // Apply same rules as ImportDeclaration
          if (importPath.startsWith(".") || !importPath.startsWith("@dotmac/")) {
            return;
          }

          if (!currentPortal && !strictMode) {
            return;
          }

          if (!isImportAllowed(importPath, currentPortal)) {
            const importPortal = getImportPortal(importPath);

            context.report({
              node,
              messageId: "crossPortalImport",
              data: {
                importPath,
                sourcePortal: importPortal,
                targetPortal: currentPortal,
              },
            });
          }
        }
      },
    };
  },
};
