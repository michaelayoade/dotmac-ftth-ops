/**
 * Tests for useBranding hook
 * Tests branding context access
 */

import { renderHook } from "@testing-library/react";
import { useBranding } from "../useBranding";
import * as BrandingProvider from "@/providers/BrandingProvider";

// Mock the branding provider
jest.mock("@/providers/BrandingProvider", () => ({
  useBrandingContext: jest.fn(),
}));

describe("useBranding", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return branding context", () => {
    const mockBranding = {
      primaryColor: "#ff0000",
      secondaryColor: "#00ff00",
      logo: "/logo.png",
      companyName: "Test Company",
    };

    (BrandingProvider.useBrandingContext as jest.Mock).mockReturnValue(mockBranding);

    const { result } = renderHook(() => useBranding());

    expect(result.current).toEqual(mockBranding);
    expect(BrandingProvider.useBrandingContext).toHaveBeenCalledTimes(1);
  });

  it("should handle undefined branding", () => {
    (BrandingProvider.useBrandingContext as jest.Mock).mockReturnValue(undefined);

    const { result } = renderHook(() => useBranding());

    expect(result.current).toBeUndefined();
  });

  it("should handle null branding", () => {
    (BrandingProvider.useBrandingContext as jest.Mock).mockReturnValue(null);

    const { result } = renderHook(() => useBranding());

    expect(result.current).toBeNull();
  });

  it("should pass through all branding properties", () => {
    const fullBranding = {
      primaryColor: "#ff0000",
      secondaryColor: "#00ff00",
      accentColor: "#0000ff",
      logo: {
        light: "/logo-light.png",
        dark: "/logo-dark.png",
      },
      companyName: "Test Company",
      productName: "Test Product",
      supportEmail: "support@test.com",
      customCss: {
        "--custom-var": "value",
      },
    };

    (BrandingProvider.useBrandingContext as jest.Mock).mockReturnValue(fullBranding);

    const { result } = renderHook(() => useBranding());

    expect(result.current).toEqual(fullBranding);
    expect(result.current).toHaveProperty("primaryColor", "#ff0000");
    expect(result.current).toHaveProperty("logo.light", "/logo-light.png");
    expect(result.current).toHaveProperty("customCss");
  });

  it("should update when branding context changes", () => {
    const initialBranding = {
      primaryColor: "#ff0000",
      companyName: "Initial Company",
    };

    const updatedBranding = {
      primaryColor: "#00ff00",
      companyName: "Updated Company",
    };

    (BrandingProvider.useBrandingContext as jest.Mock).mockReturnValue(initialBranding);

    const { result, rerender } = renderHook(() => useBranding());

    expect(result.current).toEqual(initialBranding);

    (BrandingProvider.useBrandingContext as jest.Mock).mockReturnValue(updatedBranding);
    rerender();

    expect(result.current).toEqual(updatedBranding);
  });

  it("should be a simple passthrough of useBrandingContext", () => {
    const mockReturnValue = { test: "value" };
    (BrandingProvider.useBrandingContext as jest.Mock).mockReturnValue(mockReturnValue);

    const { result } = renderHook(() => useBranding());

    expect(result.current).toBe(mockReturnValue);
  });
});
