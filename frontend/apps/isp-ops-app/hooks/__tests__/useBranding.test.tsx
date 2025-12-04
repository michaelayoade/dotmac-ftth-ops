/**
 * Unit Tests for useBranding hook
 * Tests the useBranding hook with Jest mocks for fast, reliable unit testing
 */

// Mock the BrandingProvider context
jest.mock("@/providers/BrandingProvider", () => ({
  useBrandingContext: jest.fn(),
  BrandingProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import { renderHook } from "@testing-library/react";
import { useBranding } from "../useBranding";
import { useBrandingContext } from "@/providers/BrandingProvider";
import React from "react";

describe("useBranding", () => {
  const mockBrandingContext = {
    branding: {
      productName: "Test Product",
      productTagline: "Test Tagline",
      companyName: "Test Company",
      supportEmail: "support@test.com",
      successEmail: "success@test.com",
      partnerSupportEmail: "partners@test.com",
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
      docsUrl: "https://docs.test.com",
      supportPortalUrl: "https://support.test.com",
      statusPageUrl: "https://status.test.com",
      termsUrl: "https://test.com/terms",
      privacyUrl: "https://test.com/privacy",
    },
    isLoading: false,
  };

  beforeEach(() => {
    (useBrandingContext as jest.Mock).mockReturnValue(mockBrandingContext);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Basic Functionality", () => {
    it("should return branding context from provider", () => {
      const { result } = renderHook(() => useBranding());

      expect(result.current).toEqual(mockBrandingContext);
      expect(result.current.branding.productName).toBe("Test Product");
      expect(result.current.isLoading).toBe(false);
    });

    it("should throw error when used outside BrandingProvider", () => {
      (useBrandingContext as jest.Mock).mockImplementation(() => {
        throw new Error("useBrandingContext must be used within BrandingProvider");
      });

      expect(() => {
        renderHook(() => useBranding());
      }).toThrow("useBrandingContext must be used within BrandingProvider");
    });

    it("should return loading state when branding is loading", () => {
      (useBrandingContext as jest.Mock).mockReturnValue({
        ...mockBrandingContext,
        isLoading: true,
      });

      const { result } = renderHook(() => useBranding());

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe("Branding Data", () => {
    it("should return all branding properties", () => {
      const { result } = renderHook(() => useBranding());

      expect(result.current.branding).toHaveProperty("productName");
      expect(result.current.branding).toHaveProperty("companyName");
      expect(result.current.branding).toHaveProperty("supportEmail");
      expect(result.current.branding).toHaveProperty("colors");
      expect(result.current.branding).toHaveProperty("logo");
      expect(result.current.branding).toHaveProperty("faviconUrl");
    });

    it("should return custom branding values", () => {
      (useBrandingContext as jest.Mock).mockReturnValue({
        branding: {
          ...mockBrandingContext.branding,
          productName: "Custom Product",
          companyName: "Custom Company",
          colors: {
            ...mockBrandingContext.branding.colors,
            primary: "#ff0000",
          },
        },
        isLoading: false,
      });

      const { result } = renderHook(() => useBranding());

      expect(result.current.branding.productName).toBe("Custom Product");
      expect(result.current.branding.companyName).toBe("Custom Company");
      expect(result.current.branding.colors?.primary).toBe("#ff0000");
    });

    it("should handle null/undefined values gracefully", () => {
      (useBrandingContext as jest.Mock).mockReturnValue({
        branding: {
          ...mockBrandingContext.branding,
          productTagline: null,
          successEmail: undefined,
        },
        isLoading: false,
      });

      const { result } = renderHook(() => useBranding());

      expect(result.current.branding.productTagline).toBeNull();
      expect(result.current.branding.successEmail).toBeUndefined();
    });
  });

  describe("Color Configuration", () => {
    it("should return color configuration", () => {
      const { result } = renderHook(() => useBranding());

      expect(result.current.branding.colors).toBeDefined();
      expect(result.current.branding.colors?.primary).toBe("#0066cc");
      expect(result.current.branding.colors?.secondary).toBe("#6c757d");
      expect(result.current.branding.colors?.accent).toBe("#28a745");
    });

    it("should return hover colors", () => {
      const { result } = renderHook(() => useBranding());

      expect(result.current.branding.colors?.primaryHover).toBe("#0052a3");
      expect(result.current.branding.colors?.secondaryHover).toBe("#5a6268");
    });

    it("should return foreground colors", () => {
      const { result } = renderHook(() => useBranding());

      expect(result.current.branding.colors?.primaryForeground).toBe("#ffffff");
      expect(result.current.branding.colors?.secondaryForeground).toBe("#ffffff");
    });
  });

  describe("Logo Configuration", () => {
    it("should return logo URLs", () => {
      const { result } = renderHook(() => useBranding());

      expect(result.current.branding.logo?.light).toBe("/logo-light.png");
      expect(result.current.branding.logo?.dark).toBe("/logo-dark.png");
    });

    it("should handle custom logo URLs", () => {
      (useBrandingContext as jest.Mock).mockReturnValue({
        ...mockBrandingContext,
        branding: {
          ...mockBrandingContext.branding,
          logo: {
            light: "https://cdn.example.com/logo-light.png",
            dark: "https://cdn.example.com/logo-dark.png",
          },
        },
      });

      const { result } = renderHook(() => useBranding());

      expect(result.current.branding.logo?.light).toContain("cdn.example.com");
      expect(result.current.branding.logo?.dark).toContain("cdn.example.com");
    });
  });

  describe("Contact Information", () => {
    it("should return email addresses", () => {
      const { result } = renderHook(() => useBranding());

      expect(result.current.branding.supportEmail).toBe("support@test.com");
      expect(result.current.branding.successEmail).toBe("success@test.com");
      expect(result.current.branding.partnerSupportEmail).toBe("partners@test.com");
    });

    it("should return URL configuration", () => {
      const { result } = renderHook(() => useBranding());

      expect(result.current.branding.docsUrl).toBe("https://docs.test.com");
      expect(result.current.branding.supportPortalUrl).toBe("https://support.test.com");
      expect(result.current.branding.statusPageUrl).toBe("https://status.test.com");
      expect(result.current.branding.termsUrl).toBe("https://test.com/terms");
      expect(result.current.branding.privacyUrl).toBe("https://test.com/privacy");
    });
  });

  describe("Real-world Scenarios", () => {
    it("should handle white-label partner branding", () => {
      (useBrandingContext as jest.Mock).mockReturnValue({
        branding: {
          productName: "Partner ISP Manager",
          companyName: "Partner ISP Inc.",
          supportEmail: "support@partnerisp.com",
          colors: {
            primary: "#1a73e8",
            secondary: "#34a853",
            accent: "#fbbc04",
            primaryHover: "#1557b0",
            secondaryHover: "#2d8e47",
            primaryForeground: "#ffffff",
            secondaryForeground: "#ffffff",
            background: "#ffffff",
            foreground: "#000000",
          },
          logo: {
            light: "https://cdn.partnerisp.com/logo-light.png",
            dark: "https://cdn.partnerisp.com/logo-dark.png",
          },
          faviconUrl: "https://cdn.partnerisp.com/favicon.ico",
          docsUrl: "https://help.partnerisp.com",
          supportPortalUrl: "https://support.partnerisp.com",
        },
        isLoading: false,
      });

      const { result } = renderHook(() => useBranding());

      expect(result.current.branding.productName).toBe("Partner ISP Manager");
      expect(result.current.branding.companyName).toBe("Partner ISP Inc.");
      expect(result.current.branding.colors?.primary).toBe("#1a73e8");
      expect(result.current.branding.logo?.light).toContain("partnerisp.com");
    });

    it("should handle minimal branding customization", () => {
      (useBrandingContext as jest.Mock).mockReturnValue({
        branding: {
          ...mockBrandingContext.branding,
          companyName: "ACME Corp",
          colors: {
            ...mockBrandingContext.branding.colors,
            primary: "#ff6600",
          },
        },
        isLoading: false,
      });

      const { result } = renderHook(() => useBranding());

      expect(result.current.branding.companyName).toBe("ACME Corp");
      expect(result.current.branding.colors?.primary).toBe("#ff6600");
      // Other values should remain from defaults
      expect(result.current.branding.productName).toBe("Test Product");
    });
  });
});
