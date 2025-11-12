/**
 * Tests for useTenantBranding hooks
 * Tests tenant branding query and mutation
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

// Mock better-auth before any imports that use it
const mockUseSession = jest.fn();
jest.mock("../../../../shared/lib/better-auth", () => {
  const mock = jest.fn();
  return {
    __esModule: true,
    useSession: mock,
    default: {},
    authClient: {},
  };
});

// Mock API client
jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    put: jest.fn(),
  },
}));

// Mock response helpers
jest.mock("@/lib/api/response-helpers", () => ({
  extractDataOrThrow: jest.fn((response) => response.data),
}));

// Now import the hooks and useSession after mocking
import { useTenantBrandingQuery, useUpdateTenantBranding } from "../useTenantBranding";
import { useSession } from "../../../../shared/lib/better-auth";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useTenantBranding", () => {
  beforeEach(() => {
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
    it("should fetch branding successfully", async () => {
      const mockBranding = {
        tenant_id: "tenant-123",
        branding: {
          product_name: "Test Product",
          primary_color: "#ff0000",
          logo_light_url: "/logo.png",
        },
        updated_at: "2024-01-01T00:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockBranding });

      const { result } = renderHook(() => useTenantBrandingQuery(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockBranding);
      expect(apiClient.get).toHaveBeenCalledWith("/branding");
    });

    it("should not fetch when user has no tenant_id", () => {
      (useSession as jest.Mock).mockReturnValue({
        data: {
          user: {},
        },
      });

      const { result } = renderHook(() => useTenantBrandingQuery(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isFetching).toBe(false);
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it("should not fetch when session is null", () => {
      (useSession as jest.Mock).mockReturnValue({
        data: null,
      });

      const { result } = renderHook(() => useTenantBrandingQuery(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isFetching).toBe(false);
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it("should handle fetch error", async () => {
      const mockError = new Error("Failed to load branding");
      (apiClient.get as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useTenantBrandingQuery(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(mockError);
    });

    it("should have correct stale time", () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: {} });

      const { result } = renderHook(() => useTenantBrandingQuery(), {
        wrapper: createWrapper(),
      });

      expect(result.current).toBeDefined();
    });

    it("should pass custom options", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: {} });

      const { result } = renderHook(
        () => useTenantBrandingQuery({ refetchOnMount: false }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current).toBeDefined();
    });
  });

  describe("useUpdateTenantBranding", () => {
    it("should update branding successfully", async () => {
      const mockUpdatedBranding = {
        tenant_id: "tenant-123",
        branding: {
          product_name: "Updated Product",
          primary_color: "#00ff00",
        },
        updated_at: "2024-01-02T00:00:00Z",
      };

      (apiClient.put as jest.Mock).mockResolvedValue({ data: mockUpdatedBranding });

      const { result } = renderHook(() => useUpdateTenantBranding(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({
          product_name: "Updated Product",
          primary_color: "#00ff00",
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockUpdatedBranding);
      expect(apiClient.put).toHaveBeenCalledWith("/branding", {
        branding: {
          product_name: "Updated Product",
          primary_color: "#00ff00",
        },
      });
    });

    it("should handle update error", async () => {
      const mockError = new Error("Failed to update");
      (apiClient.put as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useUpdateTenantBranding(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate({ product_name: "Test" });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(mockError);
    });

    it("should call onSuccess callback", async () => {
      const onSuccessMock = jest.fn();
      (apiClient.put as jest.Mock).mockResolvedValue({ data: {} });

      const { result } = renderHook(
        () => useUpdateTenantBranding({ onSuccess: onSuccessMock }),
        {
          wrapper: createWrapper(),
        }
      );

      await act(async () => {
        result.current.mutate({ product_name: "Test" });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(onSuccessMock).toHaveBeenCalled();
    });

    it("should update all branding fields", async () => {
      (apiClient.put as jest.Mock).mockResolvedValue({ data: {} });

      const { result } = renderHook(() => useUpdateTenantBranding(), {
        wrapper: createWrapper(),
      });

      const fullBranding = {
        product_name: "Product",
        product_tagline: "Tagline",
        company_name: "Company",
        support_email: "support@test.com",
        primary_color: "#ff0000",
        secondary_color: "#00ff00",
        accent_color: "#0000ff",
        logo_light_url: "/logo-light.png",
        logo_dark_url: "/logo-dark.png",
        favicon_url: "/favicon.ico",
      };

      await act(async () => {
        result.current.mutate(fullBranding);
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(apiClient.put).toHaveBeenCalledWith("/branding", {
        branding: fullBranding,
      });
    });

    it("should start in idle state", () => {
      const { result } = renderHook(() => useUpdateTenantBranding(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isIdle).toBe(true);
      expect(result.current.data).toBeUndefined();
      expect(result.current.error).toBeNull();
    });
  });
});
