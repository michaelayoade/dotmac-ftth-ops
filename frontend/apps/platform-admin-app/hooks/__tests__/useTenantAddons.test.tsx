/**
 * Platform Admin App - useTenantAddons tests
 * Tests for tenant addon management with TanStack Query
 */
import {useAvailableAddons, useActiveAddons, useAddonOperations, useTenantAddons} from "../useTenantAddons";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";

// Mock dependencies
jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

const { apiClient } = jest.requireMock("@/lib/api/client");

// Test data
const mockAvailableAddons = [
  {
    addon_id: "addon_1",
    name: "Extra Storage",
    description: "Additional storage space",
    addon_type: "resource",
    billing_type: "recurring",
    price: 10,
    currency: "USD",
    is_quantity_based: true,
    min_quantity: 1,
    is_featured: true,
    features: ["100GB extra storage"],
  },
];

const mockActiveAddons = [
  {
    tenant_addon_id: "ta_1",
    addon_id: "addon_1",
    addon_name: "Extra Storage",
    status: "active",
    quantity: 2,
    started_at: "2024-01-01T00:00:00Z",
    current_usage: 50,
    price: 10,
    currency: "USD",
  },
];

// Create wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useTenantAddons", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("useAvailableAddons", () => {
    it("should fetch available addons successfully", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockAvailableAddons });

      const { result } = renderHook(() => useAvailableAddons(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockAvailableAddons);
      expect(apiClient.get).toHaveBeenCalledWith("/billing/tenant/addons/available");
    });

    it("should handle fetch errors", async () => {
      (apiClient.get as jest.Mock).mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAvailableAddons(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBeTruthy();
    });
  });

  describe("useActiveAddons", () => {
    it("should fetch active addons successfully", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockActiveAddons });

      const { result } = renderHook(() => useActiveAddons(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockActiveAddons);
      expect(apiClient.get).toHaveBeenCalledWith("/billing/tenant/addons/active");
    });
  });

  describe("useAddonOperations", () => {
    it("should purchase addon successfully", async () => {
      const mockPurchasedAddon = { ...mockActiveAddons[0] };
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockPurchasedAddon });
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockActiveAddons });

      const { result } = renderHook(() => useAddonOperations(), {
        wrapper: createWrapper(),
      });

      const request = { quantity: 1 };
      await result.current.purchaseAddon("addon_1", request);

      expect(apiClient.post).toHaveBeenCalledWith("/billing/tenant/addons/addon_1/purchase", request);
    });

    it("should update addon quantity successfully", async () => {
      (apiClient.patch as jest.Mock).mockResolvedValue({ data: mockActiveAddons[0] });
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockActiveAddons });

      const { result } = renderHook(() => useAddonOperations(), {
        wrapper: createWrapper(),
      });

      const request = { quantity: 3 };
      await result.current.updateAddonQuantity("ta_1", request);

      expect(apiClient.patch).toHaveBeenCalledWith("/billing/tenant/addons/ta_1/quantity", request);
    });

    it("should cancel addon successfully", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockActiveAddons });

      const { result } = renderHook(() => useAddonOperations(), {
        wrapper: createWrapper(),
      });

      const request = { cancel_at_period_end: true, reason: "No longer needed" };
      await result.current.cancelAddon("ta_1", request);

      expect(apiClient.post).toHaveBeenCalledWith("/billing/tenant/addons/ta_1/cancel", request);
    });

    it("should reactivate addon successfully", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockActiveAddons[0] });
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockActiveAddons });

      const { result } = renderHook(() => useAddonOperations(), {
        wrapper: createWrapper(),
      });

      await result.current.reactivateAddon("ta_1");

      expect(apiClient.post).toHaveBeenCalledWith("/billing/tenant/addons/ta_1/reactivate");
    });
  });

  describe("useTenantAddons (main hook)", () => {
    it("should return both available and active addons", async () => {
      (apiClient.get as jest.Mock)
        .mockResolvedValueOnce({ data: mockAvailableAddons }) // First call for available
        .mockResolvedValueOnce({ data: mockActiveAddons }); // Second call for active

      const { result } = renderHook(() => useTenantAddons(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.activeAddons).toEqual(mockActiveAddons);
      expect(result.current.availableAddons).toEqual(mockAvailableAddons);
    });
  });
});
