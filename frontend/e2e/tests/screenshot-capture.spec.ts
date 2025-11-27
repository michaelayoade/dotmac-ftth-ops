import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

// Use workspace-relative output to avoid machine-specific absolute paths
const OUTPUT_DIR = path.resolve(process.cwd(), "ui-ux-screenshots-intercept");
const ISP_BASE_URL = "http://localhost:3001";
const PLATFORM_BASE_URL = "http://localhost:3002";

// Ensure output directory exists
test.beforeAll(async () => {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`Created output directory: ${OUTPUT_DIR}`);
  }
});

// Mock Session Data
const MOCK_SESSION = {
  user: {
    id: "dev-user",
    email: "admin@test.com",
    emailVerified: true,
    name: "Admin User",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    role: "super_admin",
    tenant_id: "default-tenant",
    activeOrganization: {
      id: "default-tenant",
      role: "tenant_owner",
      permissions: [],
    },
  },
  session: {
    id: "dev-session",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userId: "dev-user",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    token: "dev-token",
    ipAddress: "127.0.0.1",
  },
};

// Helper to wait for page stability
async function waitForPageStable(page: any) {
  // Wait for DOM to be ready
  await page.waitForLoadState("domcontentloaded");

  // Wait for network to settle (with timeout to avoid infinite wait)
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {
    console.log("Network did not settle, continuing anyway");
  });

  // Wait for any animations to complete
  await page.evaluate(() => {
    return new Promise<void>((resolve) => {
      // Disable animations for consistent screenshots
      const style = document.createElement("style");
      style.innerHTML = `
                *, *::before, *::after {
                    animation-duration: 0s !important;
                    animation-delay: 0s !important;
                    transition-duration: 0s !important;
                    transition-delay: 0s !important;
                }
            `;
      document.head.appendChild(style);

      // Give a small moment for any pending renders
      setTimeout(resolve, 500);
    });
  });
}

// ISP Ops App Pages (port 3001)
const ispOpsAuthenticatedPages = [
  { baseUrl: ISP_BASE_URL, path: "/dashboard", name: "isp-dashboard", selector: "h1, h2, main" },
  {
    baseUrl: ISP_BASE_URL,
    path: "/dashboard/subscribers",
    name: "isp-subscribers",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: ISP_BASE_URL,
    path: "/dashboard/network",
    name: "isp-network",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: ISP_BASE_URL,
    path: "/dashboard/billing-revenue",
    name: "isp-billing-revenue",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: ISP_BASE_URL,
    path: "/dashboard/billing",
    name: "isp-billing",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: ISP_BASE_URL,
    path: "/dashboard/radius",
    name: "isp-radius",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: ISP_BASE_URL,
    path: "/dashboard/devices",
    name: "isp-devices",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: ISP_BASE_URL,
    path: "/dashboard/settings",
    name: "isp-settings",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: ISP_BASE_URL,
    path: "/dashboard/analytics",
    name: "isp-analytics",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: ISP_BASE_URL,
    path: "/dashboard/automation",
    name: "isp-automation",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: ISP_BASE_URL,
    path: "/dashboard/banking",
    name: "isp-banking",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: ISP_BASE_URL,
    path: "/dashboard/banking-v2",
    name: "isp-banking-v2",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: ISP_BASE_URL,
    path: "/dashboard/communications",
    name: "isp-communications",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: ISP_BASE_URL,
    path: "/dashboard/crm",
    name: "isp-crm",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: ISP_BASE_URL,
    path: "/dashboard/dcim",
    name: "isp-dcim",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: ISP_BASE_URL,
    path: "/dashboard/diagnostics",
    name: "isp-diagnostics",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: ISP_BASE_URL,
    path: "/dashboard/enhanced",
    name: "isp-enhanced",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: ISP_BASE_URL,
    path: "/dashboard/infrastructure",
    name: "isp-infrastructure",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: ISP_BASE_URL,
    path: "/dashboard/ipam",
    name: "isp-ipam",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: ISP_BASE_URL,
    path: "/dashboard/map",
    name: "isp-map",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: ISP_BASE_URL,
    path: "/dashboard/network-monitoring",
    name: "isp-network-monitoring",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: ISP_BASE_URL,
    path: "/dashboard/operations",
    name: "isp-operations",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: ISP_BASE_URL,
    path: "/dashboard/orchestration",
    name: "isp-orchestration",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: ISP_BASE_URL,
    path: "/dashboard/partners",
    name: "isp-partners",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: ISP_BASE_URL,
    path: "/dashboard/pon",
    name: "isp-pon",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: ISP_BASE_URL,
    path: "/dashboard/profile",
    name: "isp-profile",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: ISP_BASE_URL,
    path: "/dashboard/projects",
    name: "isp-projects",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: ISP_BASE_URL,
    path: "/dashboard/resources",
    name: "isp-resources",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: ISP_BASE_URL,
    path: "/dashboard/sales",
    name: "isp-sales",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: ISP_BASE_URL,
    path: "/dashboard/scheduling",
    name: "isp-scheduling",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: ISP_BASE_URL,
    path: "/dashboard/security-access",
    name: "isp-security-access",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: ISP_BASE_URL,
    path: "/dashboard/services",
    name: "isp-services",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: ISP_BASE_URL,
    path: "/dashboard/support",
    name: "isp-support",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: ISP_BASE_URL,
    path: "/dashboard/technician",
    name: "isp-technician",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: ISP_BASE_URL,
    path: "/dashboard/ticketing",
    name: "isp-ticketing",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: ISP_BASE_URL,
    path: "/dashboard/time-tracking",
    name: "isp-time-tracking",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: ISP_BASE_URL,
    path: "/dashboard/ui-showcase",
    name: "isp-ui-showcase",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: ISP_BASE_URL,
    path: "/dashboard/webhooks",
    name: "isp-webhooks",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: ISP_BASE_URL,
    path: "/dashboard/wireless",
    name: "isp-wireless",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: ISP_BASE_URL,
    path: "/dashboard/workflows",
    name: "isp-workflows",
    selector: 'main, [role="main"]',
  },
];

const ispOpsUnauthenticatedPages = [
  { baseUrl: ISP_BASE_URL, path: "/", name: "isp-homepage", selector: "body" },
  {
    baseUrl: ISP_BASE_URL,
    path: "/login",
    name: "isp-login",
    selector: 'input[name="email"], input[type="email"]',
  },
  {
    baseUrl: ISP_BASE_URL,
    path: "/customer-portal",
    name: "isp-customer-portal",
    selector: "body",
  },
  {
    baseUrl: ISP_BASE_URL,
    path: "/customer-portal/service",
    name: "isp-customer-portal-service",
    selector: "body",
  },
  {
    baseUrl: ISP_BASE_URL,
    path: "/customer-portal/settings",
    name: "isp-customer-portal-settings",
    selector: "body",
  },
  {
    baseUrl: ISP_BASE_URL,
    path: "/customer-portal/support",
    name: "isp-customer-portal-support",
    selector: "body",
  },
  {
    baseUrl: ISP_BASE_URL,
    path: "/customer-portal/billing",
    name: "isp-customer-portal-billing",
    selector: "body",
  },
  {
    baseUrl: ISP_BASE_URL,
    path: "/customer-portal/usage",
    name: "isp-customer-portal-usage",
    selector: "body",
  },
  {
    baseUrl: ISP_BASE_URL,
    path: "/tools/ip-calculator",
    name: "isp-tools-ip-calculator",
    selector: "body",
  },
];

// Platform Admin App Pages (port 3002)
const platformAdminAuthenticatedPages = [
  {
    baseUrl: PLATFORM_BASE_URL,
    path: "/dashboard",
    name: "platform-dashboard",
    selector: "h1, h2, main",
  },
  {
    baseUrl: PLATFORM_BASE_URL,
    path: "/dashboard/platform-admin",
    name: "platform-admin-home",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: PLATFORM_BASE_URL,
    path: "/dashboard/platform-admin/tenants",
    name: "platform-tenants",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: PLATFORM_BASE_URL,
    path: "/dashboard/platform-admin/licensing",
    name: "platform-licensing",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: PLATFORM_BASE_URL,
    path: "/dashboard/platform-admin/audit",
    name: "platform-audit",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: PLATFORM_BASE_URL,
    path: "/dashboard/platform-admin/system",
    name: "platform-system",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: PLATFORM_BASE_URL,
    path: "/dashboard/billing-revenue",
    name: "platform-billing",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: PLATFORM_BASE_URL,
    path: "/dashboard/analytics",
    name: "platform-analytics",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: PLATFORM_BASE_URL,
    path: "/dashboard/crm",
    name: "platform-crm",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: PLATFORM_BASE_URL,
    path: "/dashboard/partners",
    name: "platform-partners",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: PLATFORM_BASE_URL,
    path: "/dashboard/security-access",
    name: "platform-security",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: PLATFORM_BASE_URL,
    path: "/dashboard/settings",
    name: "platform-settings",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: PLATFORM_BASE_URL,
    path: "/dashboard/integrations",
    name: "platform-integrations",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: PLATFORM_BASE_URL,
    path: "/dashboard/feature-flags",
    name: "platform-feature-flags",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: PLATFORM_BASE_URL,
    path: "/dashboard/jobs",
    name: "platform-jobs",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: PLATFORM_BASE_URL,
    path: "/dashboard/plugins",
    name: "platform-plugins",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: PLATFORM_BASE_URL,
    path: "/dashboard/workflows",
    name: "platform-workflows",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: PLATFORM_BASE_URL,
    path: "/dashboard/communications",
    name: "platform-communications",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: PLATFORM_BASE_URL,
    path: "/dashboard/notifications",
    name: "platform-notifications",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: PLATFORM_BASE_URL,
    path: "/dashboard/data-transfer",
    name: "platform-data-transfer",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: PLATFORM_BASE_URL,
    path: "/dashboard/orchestration",
    name: "platform-orchestration",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: PLATFORM_BASE_URL,
    path: "/dashboard/banking",
    name: "platform-banking",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: PLATFORM_BASE_URL,
    path: "/dashboard/diagnostics",
    name: "platform-diagnostics",
    selector: 'main, [role="main"]',
  },
  {
    baseUrl: PLATFORM_BASE_URL,
    path: "/dashboard/webhooks",
    name: "platform-webhooks",
    selector: 'main, [role="main"]',
  },
];

const platformAdminUnauthenticatedPages = [
  { baseUrl: PLATFORM_BASE_URL, path: "/", name: "platform-homepage", selector: "body" },
  {
    baseUrl: PLATFORM_BASE_URL,
    path: "/login",
    name: "platform-login",
    selector: 'input[name="email"], input[type="email"]',
  },
];

// Combine all pages
const authenticatedPages = [...ispOpsAuthenticatedPages, ...platformAdminAuthenticatedPages];
const unauthenticatedPages = [...ispOpsUnauthenticatedPages, ...platformAdminUnauthenticatedPages];

test.describe("Authenticated Screenshot Capture", () => {
  test.beforeEach(async ({ context, page, browserName }) => {
    // Set auth cookies for SSR (FastAPI JWT auth uses access_token cookie)
    await context.addCookies([
      {
        name: "access_token",
        value: "dev-token",
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      },
    ]);

    // Set localStorage for client-side auth
    // Navigate to the domain first (can't set localStorage on about:blank)
    await page.goto("http://localhost:3001");
    await page.evaluate((session) => {
      localStorage.setItem("auth_token", "dev-token");
      localStorage.setItem("tenant_id", "default-tenant");
      localStorage.setItem("user", JSON.stringify(session.user));
    }, MOCK_SESSION);

    // Intercept auth session requests
    await context.route("**/api/auth/**/session", async (route) => {
      console.log("Intercepting session request");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SESSION),
      });
    });

    await context.route("**/api/auth/get-session", async (route) => {
      console.log("Intercepting get-session request");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SESSION),
      });
    });
  });

  for (const pageInfo of authenticatedPages) {
    test(`capture ${pageInfo.name}`, async ({ page, browserName }) => {
      try {
        // Navigate to page using baseUrl from config
        const url = `${pageInfo.baseUrl}${pageInfo.path}`;
        console.log(`Navigating to: ${url}`);

        await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 120000, // 2min for Next.js compilation on first access
        });

        // Wait for page-specific content to be visible
        await page
          .locator(pageInfo.selector)
          .first()
          .waitFor({
            state: "visible",
            timeout: 10000,
          })
          .catch(() => {
            console.log(`Selector ${pageInfo.selector} not found, continuing anyway`);
          });

        // Wait for page to stabilize
        await waitForPageStable(page);

        // Verify we're not redirected to login
        const currentUrl = page.url();
        if (currentUrl.includes("/login")) {
          console.warn(`⚠️  Page ${pageInfo.name} redirected to login - auth may not be working`);
        }

        // Generate unique filename including browser name
        const filename = `${pageInfo.name}-${browserName}.png`;
        const screenshotPath = path.join(OUTPUT_DIR, filename);

        // Take screenshot with increased timeout for font loading
        await page.screenshot({
          path: screenshotPath,
          fullPage: true,
          timeout: 30000, // 30s timeout for font loading
        });

        console.log(`✓ Captured ${filename}`);
      } catch (error) {
        console.error(`✗ Failed to capture ${pageInfo.name}:`, error);
        // Take error screenshot
        await page.screenshot({
          path: path.join(OUTPUT_DIR, `${pageInfo.name}-${browserName}-ERROR.png`),
          fullPage: true,
          timeout: 30000, // 30s timeout for font loading
        });
        throw error;
      }
    });
  }
});

test.describe("Unauthenticated Screenshot Capture", () => {
  // No auth setup for these pages

  for (const pageInfo of unauthenticatedPages) {
    test(`capture ${pageInfo.name}`, async ({ page, browserName }) => {
      try {
        // Navigate to page using baseUrl from config
        const url = `${pageInfo.baseUrl}${pageInfo.path}`;
        console.log(`Navigating to: ${url}`);

        await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 120000, // 2min for Next.js compilation on first access
        });

        // Wait for page-specific content
        await page
          .locator(pageInfo.selector)
          .first()
          .waitFor({
            state: "visible",
            timeout: 10000,
          })
          .catch(() => {
            console.log(`Selector ${pageInfo.selector} not found, continuing anyway`);
          });

        // Wait for page to stabilize
        await waitForPageStable(page);

        // Generate unique filename including browser name
        const filename = `${pageInfo.name}-${browserName}.png`;
        const screenshotPath = path.join(OUTPUT_DIR, filename);

        // Take screenshot with increased timeout for font loading
        await page.screenshot({
          path: screenshotPath,
          fullPage: true,
          timeout: 30000, // 30s timeout for font loading
        });

        console.log(`✓ Captured ${filename}`);
      } catch (error) {
        console.error(`✗ Failed to capture ${pageInfo.name}:`, error);
        // Take error screenshot
        await page.screenshot({
          path: path.join(OUTPUT_DIR, `${pageInfo.name}-${browserName}-ERROR.png`),
          fullPage: true,
          timeout: 30000, // 30s timeout for font loading
        });
        throw error;
      }
    });
  }
});
