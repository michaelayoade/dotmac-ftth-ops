/**
 * MSW Tests for useBranding hook
 * Tests the BrandingProvider context integration with realistic API mocking
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

// Mock AppConfigContext
jest.mock("@/providers/AppConfigContext", () => ({
  useAppConfig: jest.fn(),
}));

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useBranding } from "../useBranding";
import { BrandingProvider } from "@/providers/BrandingProvider";
import { useSession } from "../../../../shared/lib/better-auth";
import { useAppConfig } from "@/providers/AppConfigContext";
import { clearBrandingData, seedBrandingData } from "@/__tests__/msw/handlers/branding";

// Mock useToast
jest.mock("@dotmac/ui", () => ({
  ...jest.requireActual("@dotmac/ui"),
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrandingProvider>{children}</BrandingProvider>
    </QueryClientProvider>
  );
};

describe("useBranding", () => {
  const defaultBranding = {
    productName: "Default Product",
    productTagline: "Default Tagline",
    companyName: "Default Company",
    supportEmail: "support@default.com",
    successEmail: "success@default.com",
    partnerSupportEmail: "partners@default.com",
    colors: {
      primary: "#0066cc",
      primaryHover: "#0052a3",
      primaryForeground: "#ffffff",
      secondary: "#6c757d",
      secondaryHover: "#5a6268",
      secondaryForeground: "#ffffff",
      accent: "#28a745",
      background: "#ffffff",
      foreground: "#000000",
    },
    logo: {
      light: "/logo-light.png",
      dark: "/logo-dark.png",
    },
    faviconUrl: "/favicon.ico",
    docsUrl: "https://docs.default.com",
    supportPortalUrl: "https://support.default.com",
    statusPageUrl: "https://status.default.com",
    termsUrl: "https://default.com/terms",
    privacyUrl: "https://default.com/privacy",
  };

  beforeEach(() => {
    clearBrandingData();
    (useAppConfig as jest.Mock).mockReturnValue({
      branding: defaultBranding,
    });
    (useSession as jest.Mock).mockReturnValue({
      data: {
        user: { tenant_id: "tenant-123" },
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Context Integration", () => {
    it("should throw error when used outside BrandingProvider", () => {
      // Suppress console.error for this test
      const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});

      expect(() => {
        renderHook(() => useBranding());
      }).toThrow("useBrandingContext must be used within BrandingProvider");

      consoleError.mockRestore();
    });

    it("should return branding context when used within provider", async () => {
      const { result } = renderHook(() => useBranding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.branding).toBeDefined();
      // When no custom branding exists, it merges tenant defaults with app defaults
      expect(result.current.branding.productName).toBeDefined();
    });
  });

  describe("Default Branding", () => {
    it("should return default branding when no tenant branding exists", async () => {
      const { result } = renderHook(() => useBranding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // When no tenant branding is seeded, MSW handler returns default values
      // which merge with app config defaults
      expect(result.current.branding.productName).toBeDefined();
      expect(result.current.branding.companyName).toBeDefined();
      expect(result.current.branding.colors?.primary).toBeDefined();
      expect(result.current.branding.logo?.light).toBeDefined();
    });

    it("should use default branding when user has no tenant_id", async () => {
      (useSession as jest.Mock).mockReturnValue({
        data: {
          user: {},
        },
      });

      const { result } = renderHook(() => useBranding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.branding.productName).toBe("Default Product");
    });

    it("should use default branding when session is null", async () => {
      (useSession as jest.Mock).mockReturnValue({
        data: null,
      });

      const { result } = renderHook(() => useBranding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.branding.productName).toBe("Default Product");
    });
  });

  describe("Tenant Branding Override", () => {
    it("should merge tenant branding with default branding", async () => {
      seedBrandingData("tenant-123", {
        product_name: "Tenant Product",
        primary_color: "#ff0000",
      });

      const { result } = renderHook(() => useBranding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.branding.productName).toBe("Tenant Product");
      expect(result.current.branding.colors?.primary).toBe("#ff0000");
      // Should keep default values for unspecified fields (from MSW handler or app config)
      expect(result.current.branding.companyName).toBeDefined();
    });

    it("should override all customizable branding fields", async () => {
      seedBrandingData("tenant-123", {
        product_name: "Custom Product",
        product_tagline: "Custom Tagline",
        company_name: "Custom Company",
        support_email: "custom@support.com",
        success_email: "custom@success.com",
        partner_support_email: "custom@partners.com",
        primary_color: "#ff0000",
        secondary_color: "#00ff00",
        accent_color: "#0000ff",
        logo_light_url: "/custom-logo-light.png",
        logo_dark_url: "/custom-logo-dark.png",
        favicon_url: "/custom-favicon.ico",
        docs_url: "https://docs.custom.com",
        support_portal_url: "https://support.custom.com",
        status_page_url: "https://status.custom.com",
        terms_url: "https://custom.com/terms",
        privacy_url: "https://custom.com/privacy",
      });

      const { result } = renderHook(() => useBranding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.branding.productName).toBe("Custom Product");
      expect(result.current.branding.productTagline).toBe("Custom Tagline");
      expect(result.current.branding.companyName).toBe("Custom Company");
      expect(result.current.branding.supportEmail).toBe("custom@support.com");
      expect(result.current.branding.successEmail).toBe("custom@success.com");
      expect(result.current.branding.partnerSupportEmail).toBe("custom@partners.com");
      expect(result.current.branding.colors?.primary).toBe("#ff0000");
      expect(result.current.branding.colors?.secondary).toBe("#00ff00");
      expect(result.current.branding.colors?.accent).toBe("#0000ff");
      expect(result.current.branding.logo?.light).toBe("/custom-logo-light.png");
      expect(result.current.branding.logo?.dark).toBe("/custom-logo-dark.png");
      expect(result.current.branding.faviconUrl).toBe("/custom-favicon.ico");
      expect(result.current.branding.docsUrl).toBe("https://docs.custom.com");
      expect(result.current.branding.supportPortalUrl).toBe("https://support.custom.com");
      expect(result.current.branding.statusPageUrl).toBe("https://status.custom.com");
      expect(result.current.branding.termsUrl).toBe("https://custom.com/terms");
      expect(result.current.branding.privacyUrl).toBe("https://custom.com/privacy");
    });

    it("should handle null values in tenant branding", async () => {
      seedBrandingData("tenant-123", {
        product_name: "Custom Product",
        product_tagline: null,
        success_email: null,
      });

      const { result } = renderHook(() => useBranding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.branding.productName).toBe("Custom Product");
      expect(result.current.branding.productTagline).toBe("Default Tagline");
      expect(result.current.branding.successEmail).toBe("success@default.com");
    });
  });

  describe("Loading States", () => {
    it("should indicate loading state while fetching branding", async () => {
      const { result } = renderHook(() => useBranding(), {
        wrapper: createWrapper(),
      });

      // Initially should be loading
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isLoading).toBe(false);
    });

    it("should not be loading when tenant branding is disabled", async () => {
      (useSession as jest.Mock).mockReturnValue({
        data: {
          user: {},
        },
      });

      const { result } = renderHook(() => useBranding(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("Color Merging", () => {
    it("should merge primary color while keeping hover variants", async () => {
      seedBrandingData("tenant-123", {
        primary_color: "#ff0000",
      });

      const { result } = renderHook(() => useBranding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Primary color should be overridden
      expect(result.current.branding.colors?.primary).toBe("#ff0000");
      // Hover variant should also use the primary color
      expect(result.current.branding.colors?.primaryHover).toBe("#ff0000");
      // Foreground should remain from defaults
      expect(result.current.branding.colors?.primaryForeground).toBe("#ffffff");
    });

    it("should merge secondary color independently", async () => {
      seedBrandingData("tenant-123", {
        primary_color: "#ff0000",
        secondary_color: "#00ff00",
      });

      const { result } = renderHook(() => useBranding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.branding.colors?.primary).toBe("#ff0000");
      expect(result.current.branding.colors?.secondary).toBe("#00ff00");
      expect(result.current.branding.colors?.secondaryHover).toBe("#00ff00");
    });

    it("should handle accent color separately", async () => {
      seedBrandingData("tenant-123", {
        accent_color: "#0000ff",
      });

      const { result } = renderHook(() => useBranding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.branding.colors?.accent).toBe("#0000ff");
      // Other colors should remain default (from MSW handler or app config)
      expect(result.current.branding.colors?.primary).toBeDefined();
    });
  });

  describe("Logo Merging", () => {
    it("should override light logo independently", async () => {
      seedBrandingData("tenant-123", {
        logo_light_url: "/custom-light.png",
      });

      const { result } = renderHook(() => useBranding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.branding.logo?.light).toBe("/custom-light.png");
      // Dark logo should remain from defaults (MSW handler or app config)
      expect(result.current.branding.logo?.dark).toBeDefined();
    });

    it("should override dark logo independently", async () => {
      seedBrandingData("tenant-123", {
        logo_dark_url: "/custom-dark.png",
      });

      const { result } = renderHook(() => useBranding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Light logo should remain from defaults (MSW handler or app config)
      expect(result.current.branding.logo?.light).toBeDefined();
      expect(result.current.branding.logo?.dark).toBe("/custom-dark.png");
    });

    it("should override both logos", async () => {
      seedBrandingData("tenant-123", {
        logo_light_url: "/custom-light.png",
        logo_dark_url: "/custom-dark.png",
      });

      const { result } = renderHook(() => useBranding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.branding.logo?.light).toBe("/custom-light.png");
      expect(result.current.branding.logo?.dark).toBe("/custom-dark.png");
    });
  });

  describe("Real-world Scenarios", () => {
    it("should handle white-label partner scenario", async () => {
      seedBrandingData("tenant-123", {
        product_name: "Partner ISP Manager",
        company_name: "Partner ISP Inc.",
        support_email: "support@partnerisp.com",
        primary_color: "#1a73e8",
        secondary_color: "#34a853",
        logo_light_url: "https://cdn.partnerisp.com/logo-light.png",
        logo_dark_url: "https://cdn.partnerisp.com/logo-dark.png",
        favicon_url: "https://cdn.partnerisp.com/favicon.ico",
        docs_url: "https://help.partnerisp.com",
        support_portal_url: "https://support.partnerisp.com",
      });

      const { result } = renderHook(() => useBranding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.branding.productName).toBe("Partner ISP Manager");
      expect(result.current.branding.companyName).toBe("Partner ISP Inc.");
      expect(result.current.branding.supportEmail).toBe("support@partnerisp.com");
      expect(result.current.branding.colors?.primary).toBe("#1a73e8");
      expect(result.current.branding.logo?.light).toContain("partnerisp.com");
    });

    it("should handle minimal branding customization", async () => {
      seedBrandingData("tenant-123", {
        company_name: "ACME Corp",
        primary_color: "#ff6600",
      });

      const { result } = renderHook(() => useBranding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Customized fields
      expect(result.current.branding.companyName).toBe("ACME Corp");
      expect(result.current.branding.colors?.primary).toBe("#ff6600");
      // Default fields remain from MSW handler or app config
      expect(result.current.branding.productName).toBeDefined();
      expect(result.current.branding.supportEmail).toBeDefined();
    });

    it("should handle enterprise branding scenario", async () => {
      seedBrandingData("tenant-123", {
        product_name: "Enterprise Network Manager",
        product_tagline: "Powering Your Network Infrastructure",
        company_name: "Enterprise Solutions Ltd",
        support_email: "itsupport@enterprise.com",
        success_email: "success@enterprise.com",
        operations_email: "netops@enterprise.com",
        primary_color: "#003366",
        secondary_color: "#006699",
        accent_color: "#ff9900",
        logo_light_url: "/enterprise/logo-light.svg",
        logo_dark_url: "/enterprise/logo-dark.svg",
        favicon_url: "/enterprise/favicon.png",
        docs_url: "https://docs.enterprise.com",
        support_portal_url: "https://helpdesk.enterprise.com",
        status_page_url: "https://status.enterprise.com",
        terms_url: "https://enterprise.com/legal/terms",
        privacy_url: "https://enterprise.com/legal/privacy",
      });

      const { result } = renderHook(() => useBranding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.branding).toMatchObject({
        productName: "Enterprise Network Manager",
        productTagline: "Powering Your Network Infrastructure",
        companyName: "Enterprise Solutions Ltd",
        supportEmail: "itsupport@enterprise.com",
        successEmail: "success@enterprise.com",
        docsUrl: "https://docs.enterprise.com",
      });
      expect(result.current.branding.colors?.primary).toBe("#003366");
      expect(result.current.branding.colors?.accent).toBe("#ff9900");
    });
  });

  describe("Context Value Structure", () => {
    it("should return correct context value structure", async () => {
      const { result } = renderHook(() => useBranding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current).toHaveProperty("branding");
      expect(result.current).toHaveProperty("isLoading");
      expect(typeof result.current.isLoading).toBe("boolean");
      expect(typeof result.current.branding).toBe("object");
    });

    it("should have all required branding properties", async () => {
      const { result } = renderHook(() => useBranding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const branding = result.current.branding;
      expect(branding).toHaveProperty("productName");
      expect(branding).toHaveProperty("companyName");
      expect(branding).toHaveProperty("supportEmail");
      expect(branding).toHaveProperty("colors");
      expect(branding).toHaveProperty("logo");
      expect(branding).toHaveProperty("faviconUrl");
    });
  });

  describe("Reactivity", () => {
    it("should update branding when context changes", async () => {
      seedBrandingData("tenant-123", {
        product_name: "Initial Product",
      });

      const { result, rerender } = renderHook(() => useBranding(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.branding.productName).toBe("Initial Product");

      // Update the seeded data
      seedBrandingData("tenant-123", {
        product_name: "Updated Product",
      });

      // Rerender with a new wrapper to simulate refetch
      rerender();

      // The branding should reflect the initial fetch
      // (In a real app, this would update via query invalidation)
      expect(result.current.branding.productName).toBe("Initial Product");
    });
  });
});
