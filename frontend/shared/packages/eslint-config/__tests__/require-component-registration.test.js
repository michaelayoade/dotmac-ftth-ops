const path = require("path");
const { RuleTester } = require("eslint");
const rule = require("../rules/require-component-registration");

const packageRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(packageRoot, "../../../..");
const originalCwd = process.cwd();

process.chdir(workspaceRoot);
afterAll(() => {
  process.chdir(originalCwd);
});

const ruleTester = new RuleTester({
  languageOptions: {
    parser: require("@typescript-eslint/parser"),
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
});

const fixtureBasePath = path.join(workspaceRoot, "__eslint_rule_tests__");

const adminComponentPath = path.join(
  fixtureBasePath,
  "frontend/apps/isp-ops-app/app/dashboard/admin/components/AdminCard.tsx",
);
const adminStoriesPath = path.join(
  fixtureBasePath,
  "frontend/apps/isp-ops-app/app/dashboard/admin/components/AdminCard.stories.tsx",
);

ruleTester.run("@dotmac/require-component-registration", rule, {
  valid: [
    {
      filename: adminStoriesPath,
      code: `
        export function AdminCardStory() {
          return <div />;
        }
      `,
      options: [{ enforceRegistration: true }],
    },
    {
      filename: adminComponentPath,
      code: `
        export function AdminCard() {
          return <div />;
        }
      `,
      options: [{ enforceRegistration: false }],
    },
  ],
  invalid: [
    {
      filename: adminComponentPath,
      code: `
        export function AdminCard() {
          return <div />;
        }
      `,
      options: [{ enforceRegistration: true }],
      errors: [{ messageId: "missingRegistration" }],
    },
    {
      filename: adminComponentPath,
      code: `
        import { registerComponent } from '@dotmac/registry';

        const AdminCard = () => {
          return <div />;
        };
      `,
      options: [{ enforceRegistration: false }],
      errors: [{ messageId: "missingRegistration" }],
    },
  ],
});
