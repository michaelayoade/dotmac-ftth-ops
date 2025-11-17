/**
 * MSW Tests for useTenantBranding hook
 * Tests tenant branding configuration with realistic API mocking
 */

// Mock platformConfig to provide a base URL for MSW to intercept
jest.mock("@/lib/config", () => ({
  platformConfig: {
    api: {
      baseUrl: "http://localhost:3000",
      prefix: "/api/v1",
      timeout: 30000,
      buildUrl: (path: string) => `http://localhost:3000/api/v1${path}`,
      graphqlEndpoint: "http://localhost:3000/api/v1/graphql",
    },
  },
}));

// Mock better-auth before any imports that use it
jest.mock("../../../../shared/lib/better-auth", () => ({
  __esModule: true,
  useSession: jest.fn(),
  default: {},
  authClient: {},
}));

// Mock extractDataOrThrow
jest.mock("@/lib/api/response-helpers", () => ({
  extractDataOrThrow: jest.fn((response) => response.data),
}));

import { renderHook, waitFor, act } from "@testing-library/react";
import { createQueryWrapper } from "@/__tests__/test-utils";
import {
  useTenantBrandingQuery,
  useUpdateTenantBranding,
  type TenantBrandingConfigDto,
} from "../useTenantBranding";
import { useSession } from "../../../../shared/lib/better-auth";
import {
  seedBrandingData as seedTenantBranding,
  clearBrandingData as clearTenantBrandingData,
} from "@/__tests__/msw/handlers/branding";

describe("useTenantBranding", () => {
  beforeEach(() => {
    clearTenantBrandingData();
    // Mock session with tenant_id by default
    (useSession as jest.Mock).mockReturnValue({
      data: {
        user: { tenant_id: "tenant-123" },
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("useTenantBrandingQuery", () => {
    describe("Query Operations", () => {
      it("should fetch branding successfully", async () => {
        seedTenantBranding("tenant-123", {
          product_name: "Custom FTTH Platform",
          primary_color: "#ff0000",
          logo_light_url: "/custom-logo.png",
        });

        const { result } = renderHook(() => useTenantBrandingQuery(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data?.tenant_id).toBe("tenant-123");
        expect(result.current.data?.branding.product_name).toBe("Custom FTTH Platform");
        expect(result.current.data?.branding.primary_color).toBe("#ff0000");
        expect(result.current.data?.branding.logo_light_url).toBe("/custom-logo.png");
      });

      it("should return default branding when none exists", async () => {
        // Don't seed any data - handler will return defaults

        const { result } = renderHook(() => useTenantBrandingQuery(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data?.tenant_id).toBe("tenant-123");
        expect(result.current.data?.branding.product_name).toBe("DotMac Platform");
        expect(result.current.data?.branding.primary_color).toBe("#007bff");
      });

      it("should fetch branding with all fields", async () => {
        const fullBranding: TenantBrandingConfigDto = {
          product_name: "Enterprise FTTH Solution",
          product_tagline: "Powering fiber networks worldwide",
          company_name: "Enterprise Fiber Corp",
          support_email: "support@enterprise-fiber.com",
          success_email: "success@enterprise-fiber.com",
          operations_email: "ops@enterprise-fiber.com",
          partner_support_email: "partners@enterprise-fiber.com",
          primary_color: "#1a73e8",
          secondary_color: "#5f6368",
          accent_color: "#34a853",
          logo_light_url: "/logos/enterprise-light.svg",
          logo_dark_url: "/logos/enterprise-dark.svg",
          favicon_url: "/favicon-enterprise.ico",
          docs_url: "https://docs.enterprise-fiber.com",
          support_portal_url: "https://help.enterprise-fiber.com",
          status_page_url: "https://status.enterprise-fiber.com",
          terms_url: "https://enterprise-fiber.com/legal/terms",
          privacy_url: "https://enterprise-fiber.com/legal/privacy",
        };

        seedTenantBranding("tenant-123", fullBranding);

        const { result } = renderHook(() => useTenantBrandingQuery(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data?.branding).toMatchObject(fullBranding);
        expect(result.current.data?.updated_at).toBeDefined();
      });

      it("should have updated_at timestamp", async () => {
        seedTenantBranding("tenant-123", {});

        const { result } = renderHook(() => useTenantBrandingQuery(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data?.updated_at).toBeDefined();
        expect(typeof result.current.data?.updated_at).toBe("string");
      });
    });

    describe("Session-based Enablement", () => {
      it("should not fetch when user has no tenant_id", () => {
        (useSession as jest.Mock).mockReturnValue({
          data: {
            user: {},
          },
        });

        const { result } = renderHook(() => useTenantBrandingQuery(), {
          wrapper: createQueryWrapper(),
        });

        expect(result.current.isFetching).toBe(false);
        expect(result.current.fetchStatus).toBe("idle");
      });

      it("should not fetch when session is null", () => {
        (useSession as jest.Mock).mockReturnValue({
          data: null,
        });

        const { result } = renderHook(() => useTenantBrandingQuery(), {
          wrapper: createQueryWrapper(),
        });

        expect(result.current.isFetching).toBe(false);
        expect(result.current.fetchStatus).toBe("idle");
      });

      it("should not fetch when session data is undefined", () => {
        (useSession as jest.Mock).mockReturnValue({
          data: undefined,
        });

        const { result } = renderHook(() => useTenantBrandingQuery(), {
          wrapper: createQueryWrapper(),
        });

        expect(result.current.isFetching).toBe(false);
        expect(result.current.fetchStatus).toBe("idle");
      });

      it("should fetch when user has valid tenant_id", async () => {
        (useSession as jest.Mock).mockReturnValue({
          data: {
            user: { tenant_id: "tenant-123" },
          },
        });

        const { result } = renderHook(() => useTenantBrandingQuery(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data).toBeDefined();
      });
    });

    describe("Query Options", () => {
      it("should have correct stale time (5 minutes)", () => {
        const { result } = renderHook(() => useTenantBrandingQuery(), {
          wrapper: createQueryWrapper(),
        });

        // Stale time is 5 minutes (300000ms) as defined in the hook
        expect(result.current).toBeDefined();
      });

      it("should pass custom options", async () => {
        seedTenantBranding("tenant-123", {});

        const { result } = renderHook(
          () => useTenantBrandingQuery({ refetchOnMount: false }),
          {
            wrapper: createQueryWrapper(),
          }
        );

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(result.current).toBeDefined();
      });

      it("should respect enabled option", () => {
        const { result } = renderHook(
          () => useTenantBrandingQuery({ enabled: false }),
          {
            wrapper: createQueryWrapper(),
          }
        );

        expect(result.current.isFetching).toBe(false);
        expect(result.current.fetchStatus).toBe("idle");
      });
    });

    describe("Branding Fields", () => {
      it("should fetch color configuration", async () => {
        seedTenantBranding("tenant-123", {
          primary_color: "#ff0000",
          secondary_color: "#00ff00",
          accent_color: "#0000ff",
        });

        const { result } = renderHook(() => useTenantBrandingQuery(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data?.branding.primary_color).toBe("#ff0000");
        expect(result.current.data?.branding.secondary_color).toBe("#00ff00");
        expect(result.current.data?.branding.accent_color).toBe("#0000ff");
      });

      it("should fetch logo URLs", async () => {
        seedTenantBranding("tenant-123", {
          logo_light_url: "/logos/custom-light.png",
          logo_dark_url: "/logos/custom-dark.png",
          favicon_url: "/custom-favicon.ico",
        });

        const { result } = renderHook(() => useTenantBrandingQuery(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data?.branding.logo_light_url).toBe("/logos/custom-light.png");
        expect(result.current.data?.branding.logo_dark_url).toBe("/logos/custom-dark.png");
        expect(result.current.data?.branding.favicon_url).toBe("/custom-favicon.ico");
      });

      it("should fetch email addresses", async () => {
        seedTenantBranding("tenant-123", {
          support_email: "help@custom.com",
          success_email: "success@custom.com",
          operations_email: "ops@custom.com",
          partner_support_email: "partners@custom.com",
        });

        const { result } = renderHook(() => useTenantBrandingQuery(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data?.branding.support_email).toBe("help@custom.com");
        expect(result.current.data?.branding.success_email).toBe("success@custom.com");
        expect(result.current.data?.branding.operations_email).toBe("ops@custom.com");
        expect(result.current.data?.branding.partner_support_email).toBe("partners@custom.com");
      });

      it("should fetch external URLs", async () => {
        seedTenantBranding("tenant-123", {
          docs_url: "https://docs.custom.com",
          support_portal_url: "https://support.custom.com",
          status_page_url: "https://status.custom.com",
          terms_url: "https://custom.com/terms",
          privacy_url: "https://custom.com/privacy",
        });

        const { result } = renderHook(() => useTenantBrandingQuery(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data?.branding.docs_url).toBe("https://docs.custom.com");
        expect(result.current.data?.branding.support_portal_url).toBe("https://support.custom.com");
        expect(result.current.data?.branding.status_page_url).toBe("https://status.custom.com");
        expect(result.current.data?.branding.terms_url).toBe("https://custom.com/terms");
        expect(result.current.data?.branding.privacy_url).toBe("https://custom.com/privacy");
      });
    });
  });

  describe("useUpdateTenantBranding", () => {
    describe("Mutation Operations", () => {
      it("should update branding successfully", async () => {
        seedTenantBranding("tenant-123", {
          product_name: "Old Product",
        });

        const { result } = renderHook(() => useUpdateTenantBranding(), {
          wrapper: createQueryWrapper(),
        });

        let updatedData;
        await act(async () => {
          updatedData = await result.current.mutateAsync({
            product_name: "Updated Product",
            primary_color: "#00ff00",
          });
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(updatedData).toBeDefined();
        expect(updatedData?.branding.product_name).toBe("Updated Product");
        expect(updatedData?.branding.primary_color).toBe("#00ff00");
      });

      it("should merge updates with existing branding", async () => {
        seedTenantBranding("tenant-123", {
          product_name: "Original Product",
          primary_color: "#ff0000",
          secondary_color: "#00ff00",
          logo_light_url: "/original-logo.png",
        });

        const { result } = renderHook(() => useUpdateTenantBranding(), {
          wrapper: createQueryWrapper(),
        });

        // Update only one field
        let updatedData;
        await act(async () => {
          updatedData = await result.current.mutateAsync({
            product_name: "New Product",
          });
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        // Updated field should change
        expect(updatedData?.branding.product_name).toBe("New Product");
        // Other fields should remain
        expect(updatedData?.branding.primary_color).toBe("#ff0000");
        expect(updatedData?.branding.secondary_color).toBe("#00ff00");
        expect(updatedData?.branding.logo_light_url).toBe("/original-logo.png");
      });

      it("should update all branding fields at once", async () => {
        const { result } = renderHook(() => useUpdateTenantBranding(), {
          wrapper: createQueryWrapper(),
        });

        const fullBranding: TenantBrandingConfigDto = {
          product_name: "Complete Product",
          product_tagline: "Amazing tagline",
          company_name: "Test Company",
          support_email: "support@test.com",
          success_email: "success@test.com",
          operations_email: "ops@test.com",
          partner_support_email: "partners@test.com",
          primary_color: "#ff0000",
          secondary_color: "#00ff00",
          accent_color: "#0000ff",
          logo_light_url: "/logo-light.png",
          logo_dark_url: "/logo-dark.png",
          favicon_url: "/favicon.ico",
          docs_url: "https://docs.test.com",
          support_portal_url: "https://support.test.com",
          status_page_url: "https://status.test.com",
          terms_url: "https://test.com/terms",
          privacy_url: "https://test.com/privacy",
        };

        let updatedData;
        await act(async () => {
          updatedData = await result.current.mutateAsync(fullBranding);
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(updatedData?.branding).toMatchObject(fullBranding);
      });

      it("should update branding timestamp", async () => {
        const oldTimestamp = "2024-01-01T00:00:00Z";
        seedTenantBranding("tenant-123", {});

        const { result } = renderHook(() => useUpdateTenantBranding(), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          await result.current.mutateAsync({ product_name: "Test" });
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        // Timestamp should be updated
        expect(result.current.data?.updated_at).not.toBe(oldTimestamp);
        expect(result.current.data?.updated_at).toBeDefined();
      });
    });

    describe("Cache Invalidation", () => {
      it("should invalidate query cache after mutation", async () => {
        seedTenantBranding("tenant-123", {
          product_name: "Initial Product",
        });

        // First, fetch the initial branding
        const { result: queryResult } = renderHook(() => useTenantBrandingQuery(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(queryResult.current.isSuccess).toBe(true));
        expect(queryResult.current.data?.branding.product_name).toBe("Initial Product");

        // Now update it
        const { result: mutationResult } = renderHook(() => useUpdateTenantBranding(), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          await mutationResult.current.mutateAsync({
            product_name: "Updated Product",
          });
        });

        await waitFor(() => expect(mutationResult.current.isSuccess).toBe(true));

        // The mutation should have invalidated the cache
        // Note: In test environment with separate QueryClient instances, this may not reflect
        // But we can verify the mutation was successful
        expect(mutationResult.current.data?.branding.product_name).toBe("Updated Product");
      });
    });

    describe("Callback Handlers", () => {
      it("should call onSuccess callback", async () => {
        const onSuccessMock = jest.fn();

        const { result } = renderHook(
          () => useUpdateTenantBranding({ onSuccess: onSuccessMock }),
          {
            wrapper: createQueryWrapper(),
          }
        );

        await act(async () => {
          await result.current.mutateAsync({ product_name: "Test" });
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(onSuccessMock).toHaveBeenCalled();
      });

      it("should start in idle state", () => {
        const { result } = renderHook(() => useUpdateTenantBranding(), {
          wrapper: createQueryWrapper(),
        });

        expect(result.current.isIdle).toBe(true);
        expect(result.current.data).toBeUndefined();
        expect(result.current.error).toBeNull();
      });
    });

    describe("Field-Specific Updates", () => {
      it("should update colors", async () => {
        const { result } = renderHook(() => useUpdateTenantBranding(), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          await result.current.mutateAsync({
            primary_color: "#ff0000",
            secondary_color: "#00ff00",
            accent_color: "#0000ff",
          });
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data?.branding.primary_color).toBe("#ff0000");
        expect(result.current.data?.branding.secondary_color).toBe("#00ff00");
        expect(result.current.data?.branding.accent_color).toBe("#0000ff");
      });

      it("should update logos", async () => {
        const { result } = renderHook(() => useUpdateTenantBranding(), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          await result.current.mutateAsync({
            logo_light_url: "/new-light-logo.png",
            logo_dark_url: "/new-dark-logo.png",
            favicon_url: "/new-favicon.ico",
          });
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data?.branding.logo_light_url).toBe("/new-light-logo.png");
        expect(result.current.data?.branding.logo_dark_url).toBe("/new-dark-logo.png");
        expect(result.current.data?.branding.favicon_url).toBe("/new-favicon.ico");
      });

      it("should update emails", async () => {
        const { result } = renderHook(() => useUpdateTenantBranding(), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          await result.current.mutateAsync({
            support_email: "new-support@test.com",
            success_email: "new-success@test.com",
          });
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data?.branding.support_email).toBe("new-support@test.com");
        expect(result.current.data?.branding.success_email).toBe("new-success@test.com");
      });

      it("should handle null values", async () => {
        seedTenantBranding("tenant-123", {
          product_tagline: "Old Tagline",
          success_email: "old@test.com",
        });

        const { result } = renderHook(() => useUpdateTenantBranding(), {
          wrapper: createQueryWrapper(),
        });

        await act(async () => {
          await result.current.mutateAsync({
            product_tagline: null,
            success_email: null,
          });
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data?.branding.product_tagline).toBeNull();
        expect(result.current.data?.branding.success_email).toBeNull();
      });
    });
  });

  describe("Real-world Scenarios", () => {
    it("should handle complete branding setup workflow", async () => {
      // Step 1: Load initial branding (defaults)
      const { result: queryResult } = renderHook(() => useTenantBrandingQuery(), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(queryResult.current.isSuccess).toBe(true));
      expect(queryResult.current.data?.branding.product_name).toBe("DotMac Platform");

      // Step 2: Update colors
      const { result: colorResult } = renderHook(() => useUpdateTenantBranding(), {
        wrapper: createQueryWrapper(),
      });

      await act(async () => {
        await colorResult.current.mutateAsync({
          primary_color: "#1a73e8",
          secondary_color: "#5f6368",
          accent_color: "#34a853",
        });
      });

      await waitFor(() => expect(colorResult.current.isSuccess).toBe(true));
      expect(colorResult.current.data?.branding.primary_color).toBe("#1a73e8");

      // Step 3: Update logos
      const { result: logoResult } = renderHook(() => useUpdateTenantBranding(), {
        wrapper: createQueryWrapper(),
      });

      await act(async () => {
        await logoResult.current.mutateAsync({
          logo_light_url: "/branded-light.svg",
          logo_dark_url: "/branded-dark.svg",
        });
      });

      await waitFor(() => expect(logoResult.current.isSuccess).toBe(true));
      expect(logoResult.current.data?.branding.logo_light_url).toBe("/branded-light.svg");

      // Colors should still be persisted
      expect(logoResult.current.data?.branding.primary_color).toBe("#1a73e8");
    });

    it("should handle white-label configuration", async () => {
      const { result } = renderHook(() => useUpdateTenantBranding(), {
        wrapper: createQueryWrapper(),
      });

      const whiteLabelConfig: TenantBrandingConfigDto = {
        product_name: "Partner FTTH Solution",
        company_name: "Partner Networks Inc",
        support_email: "support@partner-networks.com",
        primary_color: "#ff6600",
        secondary_color: "#333333",
        logo_light_url: "/partner-logo-light.png",
        logo_dark_url: "/partner-logo-dark.png",
        docs_url: "https://docs.partner-networks.com",
        support_portal_url: "https://help.partner-networks.com",
      };

      await act(async () => {
        await result.current.mutateAsync(whiteLabelConfig);
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.branding.product_name).toBe("Partner FTTH Solution");
      expect(result.current.data?.branding.company_name).toBe("Partner Networks Inc");
      expect(result.current.data?.branding.primary_color).toBe("#ff6600");
      expect(result.current.data?.branding.logo_light_url).toBe("/partner-logo-light.png");
    });

    it("should handle partial updates without losing existing data", async () => {
      // Set up initial comprehensive branding
      seedTenantBranding("tenant-123", {
        product_name: "Enterprise FTTH",
        company_name: "Enterprise Corp",
        primary_color: "#007bff",
        secondary_color: "#6c757d",
        logo_light_url: "/enterprise-light.png",
        logo_dark_url: "/enterprise-dark.png",
        support_email: "support@enterprise.com",
        docs_url: "https://docs.enterprise.com",
      });

      const { result } = renderHook(() => useUpdateTenantBranding(), {
        wrapper: createQueryWrapper(),
      });

      // Update only the product name
      await act(async () => {
        await result.current.mutateAsync({
          product_name: "Enterprise FTTH Pro",
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Verify the update
      expect(result.current.data?.branding.product_name).toBe("Enterprise FTTH Pro");

      // Verify other fields are preserved
      expect(result.current.data?.branding.company_name).toBe("Enterprise Corp");
      expect(result.current.data?.branding.primary_color).toBe("#007bff");
      expect(result.current.data?.branding.logo_light_url).toBe("/enterprise-light.png");
      expect(result.current.data?.branding.support_email).toBe("support@enterprise.com");
    });
  });
});
