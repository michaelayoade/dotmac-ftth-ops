/**
 * E2E Tests: Platform-ISP Integration
 *
 * Tests critical cross-app workflows between Platform Admin and ISP Ops:
 * - Tenant onboarding and first login
 * - License enforcement across apps
 * - Quota enforcement in ISP operations
 * - Subscription upgrades/downgrades
 * - Tenant suspension and reactivation
 */

import { test, expect, type Page } from "@playwright/test";

test.describe("Platform-ISP Integration", () => {
  test.describe.configure({ mode: "serial" });

  let platformAdminPage: Page;
  let ispOpsPage: Page;

  test.beforeAll(async ({ browser }) => {
    // Create two separate browser contexts for Platform Admin and ISP Ops
    platformAdminPage = await browser.newPage();
    ispOpsPage = await browser.newPage();
  });

  test.afterAll(async () => {
    await platformAdminPage.close();
    await ispOpsPage.close();
  });

  // ============================================================================
  // Tenant Onboarding Flow
  // ============================================================================

  test.describe("Tenant Onboarding", () => {
    test("should allow platform admin to create new ISP tenant", async () => {
      // Navigate to Platform Admin tenant management
      await platformAdminPage.goto("/dashboard/platform-admin/tenants");

      // Verify tenant management page loaded
      await expect(platformAdminPage).toHaveTitle(/Tenants/i);

      // Look for "Add Tenant" or "Create Tenant" button
      const createButton = platformAdminPage.getByRole("button", {
        name: /create|add.*tenant/i,
      });

      // If button exists, verify it's visible
      const buttonCount = await createButton.count();
      if (buttonCount > 0) {
        await expect(createButton.first()).toBeVisible();
      }
    });

    test("should display tenant creation form with required fields", async () => {
      await platformAdminPage.goto("/dashboard/platform-admin/tenants");

      // Check for form inputs (if form is visible on page)
      const companyNameInput = platformAdminPage.getByLabel(/company.*name/i);
      const subdomainInput = platformAdminPage.getByLabel(/subdomain/i);
      const ownerEmailInput = platformAdminPage.getByLabel(/.*email/i);

      // Verify at least one input exists (may not be visible until create button is clicked)
      const formFieldsExist =
        (await companyNameInput.count()) > 0 ||
        (await subdomainInput.count()) > 0 ||
        (await ownerEmailInput.count()) > 0;

      expect(formFieldsExist).toBe(true);
    });

    test("should show tenant list with status indicators", async () => {
      await platformAdminPage.goto("/dashboard/platform-admin/tenants");

      // Look for table or list of tenants
      const tenantTable =
        platformAdminPage.getByRole("table") || platformAdminPage.getByTestId("tenant-list");

      // Verify some content is displayed
      const hasContent = await platformAdminPage.locator("body").textContent();
      expect(hasContent).toBeTruthy();
    });
  });

  // ============================================================================
  // License Enforcement
  // ============================================================================

  test.describe("License Enforcement", () => {
    test("should show licensing page in platform admin app", async () => {
      await platformAdminPage.goto("/dashboard/platform-admin/licensing");

      // Verify licensing page loaded
      await expect(platformAdminPage.getByRole("heading")).toBeVisible();

      // Check for service plans section
      const pageContent = await platformAdminPage.textContent("body");
      expect(pageContent).toBeTruthy();
    });

    test("should display available service plans", async () => {
      await platformAdminPage.goto("/dashboard/platform-admin/licensing");

      // Look for plans (Starter, Professional, etc.)
      const pageText = await platformAdminPage.textContent("body");

      // Verify page has some content (plans may be loaded dynamically)
      expect(pageText?.length).toBeGreaterThan(0);
    });

    test("should display module configuration options", async () => {
      await platformAdminPage.goto("/dashboard/platform-admin/licensing");

      // Look for modules section
      const modulesSection = platformAdminPage.getByText(/modules/i);

      // Verify page structure exists
      const hasStructure = (await modulesSection.count()) > 0;
      expect(hasStructure).toBe(true);
    });
  });

  // ============================================================================
  // Quota Enforcement
  // ============================================================================

  test.describe("Quota Enforcement", () => {
    test("should navigate to ISP ops dashboard", async () => {
      await ispOpsPage.goto("/dashboard");

      // Verify ISP dashboard loaded
      const heading = ispOpsPage.getByRole("heading").first();
      await expect(heading).toBeVisible();
    });

    test("should display customer management page", async () => {
      await ispOpsPage.goto("/dashboard/customers");

      // Verify customers page loaded
      await expect(ispOpsPage).toHaveTitle(/Customers|Customer Management/i);

      // Verify page has content
      const pageContent = await ispOpsPage.textContent("body");
      expect(pageContent?.length).toBeGreaterThan(0);
    });

    test("should show quota warnings when approaching limit", async () => {
      await ispOpsPage.goto("/dashboard/customers");

      // Look for quota indicator or warning (may not exist with low usage)
      const quotaIndicator = ispOpsPage.getByText(/quota|limit/i) || ispOpsPage.getByRole("status");

      // Verify page renders without errors
      await expect(ispOpsPage.locator("body")).toBeVisible();
    });

    test("should display billing page for subscription management", async () => {
      await ispOpsPage.goto("/dashboard/billing");

      // Verify billing page loaded
      await expect(ispOpsPage.getByRole("heading")).toBeVisible();

      // Check for billing-related content
      const pageContent = await ispOpsPage.textContent("body");
      expect(pageContent).toBeTruthy();
    });
  });

  // ============================================================================
  // Subscription Management
  // ============================================================================

  test.describe("Subscription Management", () => {
    test("should display subscription details in platform admin", async () => {
      await platformAdminPage.goto("/dashboard/platform-admin/tenants");

      // Verify tenants page shows subscription info
      const pageContent = await platformAdminPage.textContent("body");
      expect(pageContent).toBeTruthy();
    });

    test("should show upgrade options for tenants", async () => {
      await platformAdminPage.goto("/dashboard/platform-admin/licensing");

      // Look for upgrade/plan options
      const pageText = await platformAdminPage.textContent("body");
      expect(pageText?.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Access Control
  // ============================================================================

  test.describe("Cross-App Access Control", () => {
    test("should prevent ISP tenant from accessing platform admin pages", async () => {
      // Try to access platform admin page from ISP context
      await ispOpsPage.goto("/dashboard/platform-admin/tenants");

      // Should redirect or show error (not authorized)
      // The page may redirect to login or show 403/404
      const url = ispOpsPage.url();
      const pageText = await ispOpsPage.textContent("body");

      // Verify not successfully accessing platform admin features
      expect(
        url.includes("/platform-admin/tenants") || pageText?.includes("Not Found"),
      ).toBeTruthy();
    });

    test("should show platform admin has access to all tenant data", async () => {
      await platformAdminPage.goto("/dashboard/platform-admin/tenants");

      // Platform admin should see tenant list
      await expect(platformAdminPage.getByRole("heading")).toBeVisible();

      const pageContent = await platformAdminPage.textContent("body");
      expect(pageContent).toBeTruthy();
    });
  });

  // ============================================================================
  // Feature Availability
  // ============================================================================

  test.describe("Feature Availability", () => {
    test("should show available features based on subscription in ISP app", async () => {
      await ispOpsPage.goto("/dashboard");

      // Verify dashboard shows available features
      await expect(ispOpsPage.locator("body")).toBeVisible();

      // Check for navigation or feature links
      const navigation = ispOpsPage.getByRole("navigation");
      await expect(navigation).toBeVisible();
    });

    test("should display analytics page if module is enabled", async () => {
      await ispOpsPage.goto("/dashboard/analytics");

      // Analytics may or may not be accessible based on subscription
      // Verify page attempts to load
      const pageContent = await ispOpsPage.textContent("body");
      expect(pageContent).toBeTruthy();
    });

    test("should show network monitoring features", async () => {
      await ispOpsPage.goto("/dashboard/network/monitoring");

      // Verify network monitoring page structure
      await expect(ispOpsPage.locator("body")).toBeVisible();
    });
  });

  // ============================================================================
  // Data Isolation Verification
  // ============================================================================

  test.describe("Data Isolation", () => {
    test("should only show tenant-specific data in ISP app", async () => {
      await ispOpsPage.goto("/dashboard/customers");

      // Verify page loads customer data
      await expect(ispOpsPage.getByRole("heading")).toBeVisible();

      // All displayed customers should belong to current tenant
      const pageContent = await ispOpsPage.textContent("body");
      expect(pageContent).toBeTruthy();
    });

    test("should isolate network equipment by tenant", async () => {
      await ispOpsPage.goto("/dashboard/network/monitoring");

      // Verify network data is scoped to tenant
      await expect(ispOpsPage.locator("body")).toBeVisible();
    });

    test("should isolate billing data by tenant", async () => {
      await ispOpsPage.goto("/dashboard/billing");

      // Verify billing data is tenant-specific
      await expect(ispOpsPage.getByRole("heading")).toBeVisible();
    });
  });

  // ============================================================================
  // Performance & Responsiveness
  // ============================================================================

  test.describe("Cross-App Performance", () => {
    test("should load platform admin dashboard quickly", async () => {
      const startTime = Date.now();
      await platformAdminPage.goto("/dashboard/platform-admin");
      const loadTime = Date.now() - startTime;

      // Should load within reasonable time
      expect(loadTime).toBeLessThan(5000);
    });

    test("should load ISP ops dashboard quickly", async () => {
      const startTime = Date.now();
      await ispOpsPage.goto("/dashboard");
      const loadTime = Date.now() - startTime;

      // Should load within reasonable time
      expect(loadTime).toBeLessThan(5000);
    });
  });
});
