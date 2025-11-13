const path = require("path");
const { RuleTester } = require("eslint");
const rule = require("../rules/no-cross-portal-imports");

const packageRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(packageRoot, "../../../..");
const originalCwd = process.cwd();

process.chdir(workspaceRoot);
afterAll(() => {
  process.chdir(originalCwd);
});

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

const fixtureBasePath = path.join(workspaceRoot, "__eslint_rule_tests__");

const adminComponentPath = path.join(
  fixtureBasePath,
  "frontend/apps/isp-ops-app/app/dashboard/admin/components/AdminCard.tsx",
);
const customerComponentPath = path.join(
  fixtureBasePath,
  "frontend/apps/isp-ops-app/app/customer/components/CustomerWidget.tsx",
);
const unknownPortalPath = path.join(
  fixtureBasePath,
  "apps/experiments/components/UnknownWidget.tsx",
);

ruleTester.run("@dotmac/no-cross-portal-imports", rule, {
  valid: [
    {
      filename: adminComponentPath,
      code: "import Button from '@dotmac/styled-components/admin/Button';",
    },
    {
      filename: adminComponentPath,
      code: "import { Card } from '@dotmac/styled-components/shared/layout';",
    },
    {
      filename: adminComponentPath,
      code: "import { useAnalytics } from '@dotmac/primitives/analytics';",
    },
    {
      filename: adminComponentPath,
      code: "import React from 'react';",
    },
  ],
  invalid: [
    {
      filename: adminComponentPath,
      code: "import Widget from '@dotmac/styled-components/customer/Widget';",
      errors: [{ messageId: "crossPortalImport" }],
    },
    {
      filename: customerComponentPath,
      code: "import AdminNav from '@dotmac/styled-components/admin/Nav';",
      errors: [{ messageId: "crossPortalImport" }],
    },
    {
      filename: unknownPortalPath,
      code: "const noop = () => null;",
      errors: [{ messageId: "unknownPortal" }],
    },
  ],
});
