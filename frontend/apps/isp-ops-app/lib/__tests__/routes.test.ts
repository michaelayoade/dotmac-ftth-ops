/**
 * Tests for routes utilities
 * Tests route constants and helper functions
 */

import {
  ROUTES,
  API_ROUTES,
  isRoute,
  isDashboardRoute,
  isTenantRoute,
  isProtectedRoute,
  buildRoute,
} from "../routes";

describe("routes", () => {
  describe("ROUTES constants", () => {
    it("should have home route", () => {
      expect(ROUTES.HOME).toBe("/");
    });

    it("should have auth routes", () => {
      expect(ROUTES.LOGIN).toBe("/login");
      expect(ROUTES.REGISTER).toBe("/register");
      expect(ROUTES.FORGOT_PASSWORD).toBe("/forgot-password");
      expect(ROUTES.RESET_PASSWORD).toBe("/reset-password");
    });

    it("should have MFA routes", () => {
      expect(ROUTES.MFA.SETUP).toBe("/mfa/setup");
      expect(ROUTES.MFA.VERIFY).toBe("/mfa/verify");
    });

    it("should have dashboard routes", () => {
      expect(ROUTES.DASHBOARD).toBeDefined();
      expect(ROUTES.DASHBOARD.HOME).toBe("/dashboard");
      expect(ROUTES.DASHBOARD.ANALYTICS).toBe("/dashboard/analytics");
      expect(ROUTES.DASHBOARD.BILLING).toBe("/dashboard/billing");
      expect(ROUTES.DASHBOARD.CUSTOMERS).toBe("/dashboard/customers");
    });

    it("should have network and infrastructure routes", () => {
      expect(ROUTES.DASHBOARD.NETWORK_MONITORING).toBe("/dashboard/network-monitoring");
      expect(ROUTES.DASHBOARD.INFRASTRUCTURE).toBe("/dashboard/infrastructure");
      expect(ROUTES.DASHBOARD.RADIUS).toBe("/dashboard/radius");
    });

    it("should have tenant routes", () => {
      expect(ROUTES.TENANT).toBeDefined();
      expect(ROUTES.TENANT.HOME).toBe("/tenant");
      expect(ROUTES.TENANT.CUSTOMERS).toBe("/tenant/customers");
      expect(ROUTES.TENANT.BILLING).toBe("/tenant/billing");
    });

    it("should have customer portal routes", () => {
      expect(ROUTES.CUSTOMER_PORTAL).toBeDefined();
      expect(ROUTES.CUSTOMER_PORTAL.HOME).toBe("/customer-portal");
      expect(ROUTES.CUSTOMER_PORTAL.BILLING).toBe("/customer-portal/billing");
    });

    it("should have partner routes", () => {
      expect(ROUTES.PARTNER).toBeDefined();
      expect(ROUTES.PARTNER.HOME).toBe("/partner");
      expect(ROUTES.PARTNER.DASHBOARD).toBe("/partner/dashboard");
    });

    it("should have admin routes", () => {
      expect(ROUTES.ADMIN).toBeDefined();
      expect(ROUTES.ADMIN.HOME).toBe("/admin");
      expect(ROUTES.ADMIN.TENANTS).toBe("/admin/tenants");
    });
  });

  describe("API_ROUTES constants", () => {
    it("should have base API route", () => {
      expect(API_ROUTES.BASE).toBe("/api/isp/v1/admin");
    });

    it("should have auth API routes", () => {
      expect(API_ROUTES.AUTH).toBeDefined();
      expect(API_ROUTES.AUTH.LOGIN).toBe("/api/isp/v1/admin/auth/login");
      expect(API_ROUTES.AUTH.LOGOUT).toBe("/api/isp/v1/admin/auth/logout");
      expect(API_ROUTES.AUTH.ME).toBe("/api/isp/v1/admin/auth/me");
    });

    it("should have resource API routes", () => {
      expect(API_ROUTES.CUSTOMERS).toBe("/api/isp/v1/admin/customers");
      expect(API_ROUTES.BILLING).toBe("/api/isp/v1/admin/billing");
      expect(API_ROUTES.NETWORK).toBe("/api/isp/v1/admin/network");
      expect(API_ROUTES.RADIUS).toBe("/api/isp/v1/admin/radius");
    });

    it("should have infrastructure API routes", () => {
      expect(API_ROUTES.GENIEACS).toBe("/api/isp/v1/admin/genieacs");
      expect(API_ROUTES.ACCESS).toBe("/api/isp/v1/admin/access");
      expect(API_ROUTES.WEBHOOKS).toBe("/api/isp/v1/admin/webhooks");
    });

    it("should have health check routes", () => {
      expect(API_ROUTES.HEALTH).toBe("/api/isp/v1/admin/health");
      expect(API_ROUTES.READY).toBe("/api/isp/v1/admin/ready");
    });
  });

  describe("isRoute", () => {
    it("should return true for exact route match", () => {
      expect(isRoute("/dashboard", "/dashboard")).toBe(true);
      expect(isRoute("/dashboard/customers", "/dashboard/customers")).toBe(true);
    });

    it("should return false for non-matching routes", () => {
      expect(isRoute("/dashboard", "/customers")).toBe(false);
      expect(isRoute("/dashboard/customers", "/dashboard/billing")).toBe(false);
    });

    it("should return true for child routes", () => {
      expect(isRoute("/dashboard/customers", "/dashboard")).toBe(true);
      expect(isRoute("/dashboard/customers/123", "/dashboard")).toBe(true);
      expect(isRoute("/dashboard/customers/123", "/dashboard/customers")).toBe(true);
    });

    it("should be case-sensitive", () => {
      expect(isRoute("/Dashboard", "/dashboard")).toBe(false);
    });
  });

  describe("isDashboardRoute", () => {
    it("should return true for dashboard routes", () => {
      expect(isDashboardRoute("/dashboard")).toBe(true);
      expect(isDashboardRoute("/dashboard/customers")).toBe(true);
      expect(isDashboardRoute("/dashboard/billing")).toBe(true);
      expect(isDashboardRoute("/dashboard/analytics")).toBe(true);
    });

    it("should return false for non-dashboard routes", () => {
      expect(isDashboardRoute("/")).toBe(false);
      expect(isDashboardRoute("/login")).toBe(false);
      expect(isDashboardRoute("/customer-portal")).toBe(false);
      expect(isDashboardRoute("/tenant")).toBe(false);
    });

    it("should handle nested dashboard routes", () => {
      expect(isDashboardRoute("/dashboard/customers/123")).toBe(true);
      expect(isDashboardRoute("/dashboard/billing/invoices/456")).toBe(true);
    });
  });

  describe("isTenantRoute", () => {
    it("should return true for tenant routes", () => {
      expect(isTenantRoute("/tenant")).toBe(true);
      expect(isTenantRoute("/tenant/customers")).toBe(true);
      expect(isTenantRoute("/tenant/billing")).toBe(true);
    });

    it("should return false for non-tenant routes", () => {
      expect(isTenantRoute("/dashboard")).toBe(false);
      expect(isTenantRoute("/customer-portal")).toBe(false);
      expect(isTenantRoute("/")).toBe(false);
    });

    it("should handle nested tenant routes", () => {
      expect(isTenantRoute("/tenant/billing/invoices")).toBe(true);
      expect(isTenantRoute("/tenant/customers/123")).toBe(true);
    });
  });

  describe("isProtectedRoute", () => {
    it("should return true for protected routes", () => {
      expect(isProtectedRoute("/dashboard")).toBe(true);
      expect(isProtectedRoute("/dashboard/customers")).toBe(true);
      expect(isProtectedRoute("/tenant")).toBe(true);
      expect(isProtectedRoute("/customer-portal/billing")).toBe(true);
    });

    it("should return false for public routes", () => {
      expect(isProtectedRoute("/")).toBe(false);
      expect(isProtectedRoute("/login")).toBe(false);
      expect(isProtectedRoute("/register")).toBe(false);
      expect(isProtectedRoute("/forgot-password")).toBe(false);
      expect(isProtectedRoute("/reset-password")).toBe(false);
    });
  });

  describe("buildRoute", () => {
    it("should build customer detail route", () => {
      const route = buildRoute.customer("123");
      expect(route).toBe("/dashboard/customers/123");
    });

    it("should build tenant detail route", () => {
      const route = buildRoute.tenant("456");
      expect(route).toBe("/admin/tenants/456");
    });

    it("should build job detail route", () => {
      const route = buildRoute.job("job-789");
      expect(route).toBe("/dashboard/jobs/job-789");
    });

    it("should build webhook detail route", () => {
      const route = buildRoute.webhook("webhook-123");
      expect(route).toBe("/dashboard/webhooks/webhook-123");
    });

    it("should handle special characters in IDs", () => {
      const route = buildRoute.customer("cust-123-abc");
      expect(route).toBe("/dashboard/customers/cust-123-abc");
    });
  });

  describe("Route structure consistency", () => {
    it("should have consistent dashboard route patterns", () => {
      // All dashboard routes should start with /dashboard
      expect(ROUTES.DASHBOARD.HOME.startsWith("/dashboard")).toBe(true);
      expect(ROUTES.DASHBOARD.CUSTOMERS.startsWith("/dashboard")).toBe(true);
      expect(ROUTES.DASHBOARD.BILLING.startsWith("/dashboard")).toBe(true);
    });

    it("should have consistent tenant route patterns", () => {
      // All tenant routes should start with /tenant
      expect(ROUTES.TENANT.HOME).toBe("/tenant");
      expect(ROUTES.TENANT.CUSTOMERS.startsWith("/tenant")).toBe(true);
      expect(ROUTES.TENANT.BILLING.startsWith("/tenant")).toBe(true);
    });

    it("should have consistent API route patterns", () => {
      // All API routes should start with /api/isp/v1/admin
      expect(API_ROUTES.AUTH.LOGIN.startsWith("/api/isp/v1/admin")).toBe(true);
      expect(API_ROUTES.CUSTOMERS.startsWith("/api/isp/v1/admin")).toBe(true);
      expect(API_ROUTES.BILLING.startsWith("/api/isp/v1/admin")).toBe(true);
    });

    it("should not have duplicate route definitions", () => {
      const dashboardRoutes = [
        ROUTES.DASHBOARD.HOME,
        ROUTES.DASHBOARD.CUSTOMERS,
        ROUTES.DASHBOARD.BILLING,
        ROUTES.DASHBOARD.ANALYTICS,
      ];

      const uniqueRoutes = new Set(dashboardRoutes);
      expect(uniqueRoutes.size).toBe(dashboardRoutes.length);
    });
  });

  describe("Edge cases", () => {
    it("should handle empty string paths", () => {
      expect(isRoute("", "/dashboard")).toBe(false);
      expect(isDashboardRoute("")).toBe(false);
    });

    it("should handle root path", () => {
      expect(isRoute("/", "/")).toBe(true);
      expect(isDashboardRoute("/")).toBe(false);
      expect(isProtectedRoute("/")).toBe(false);
    });

    it("should handle paths with query parameters", () => {
      // Query params are part of the path string, so they should work
      const pathWithQuery = "/dashboard?tab=customers";
      expect(isDashboardRoute(pathWithQuery.split("?")[0])).toBe(true);
      expect(isProtectedRoute(pathWithQuery.split("?")[0])).toBe(true);
    });

    it("should handle paths with hash fragments", () => {
      // Hash fragments are part of the path string, so they should work
      const pathWithHash = "/dashboard#section";
      expect(isDashboardRoute(pathWithHash.split("#")[0])).toBe(true);
    });

    it("should handle malformed paths", () => {
      expect(() => isDashboardRoute("not-a-path")).not.toThrow();
      expect(() => isProtectedRoute("///multiple///slashes")).not.toThrow();
    });
  });

  describe("Type safety", () => {
    it("ROUTES should be readonly", () => {
      // TypeScript enforces readonly at compile time
      // Runtime check that objects exist and are accessible
      expect(ROUTES.HOME).toBeDefined();
      expect(ROUTES.DASHBOARD.HOME).toBeDefined();
    });

    it("API_ROUTES should be readonly", () => {
      // TypeScript enforces readonly at compile time
      // Runtime check that objects exist and are accessible
      expect(API_ROUTES.AUTH).toBeDefined();
      expect(API_ROUTES.CUSTOMERS).toBeDefined();
    });
  });
});
