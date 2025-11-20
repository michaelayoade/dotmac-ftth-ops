/**
 * Platform Admin App - useTenantPaymentMethods tests
 * Tests for tenant payment method management with TanStack Query
 */
import { usePaymentMethods, usePaymentMethodOperations, useTenantPaymentMethods } from "../useTenantPaymentMethods";
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
const mockPaymentMethods = [
  {
    payment_method_id: "pm_1",
    method_type: "card",
    status: "active",
    is_default: true,
    card_brand: "visa",
    card_last4: "4242",
    card_exp_month: 12,
    card_exp_year: 2025,
    billing_name: "John Doe",
    billing_country: "US",
    is_verified: true,
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    payment_method_id: "pm_2",
    method_type: "bank_account",
    status: "pending_verification",
    is_default: false,
    bank_name: "Chase",
    bank_account_last4: "1234",
    billing_name: "John Doe",
    billing_country: "US",
    is_verified: false,
    created_at: "2024-01-02T00:00:00Z",
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

describe("useTenantPaymentMethods", () => {
  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe("usePaymentMethods", () => {
    it("should fetch payment methods successfully", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockPaymentMethods });

      const { result } = renderHook(() => usePaymentMethods(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockPaymentMethods);
      expect(apiClient.get).toHaveBeenCalledWith("/billing/tenant/payment-methods");
    });

    it("should handle fetch errors", async () => {
      (apiClient.get as jest.Mock).mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => usePaymentMethods(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBeTruthy();
    });
  });

  describe("usePaymentMethodOperations", () => {
    it("should add payment method successfully", async () => {
      const newMethod = mockPaymentMethods[0];
      (apiClient.post as jest.Mock).mockResolvedValue({ data: newMethod });
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockPaymentMethods });

      const { result } = renderHook(() => usePaymentMethodOperations(), {
        wrapper: createWrapper(),
      });

      const request = {
        method_type: "card" as const,
        card_token: "tok_visa",
        billing_name: "John Doe",
        billing_country: "US",
        set_as_default: true,
      };

      await result.current.addPaymentMethod(request);

      expect(apiClient.post).toHaveBeenCalledWith("/billing/tenant/payment-methods", request);
    });

    it("should update payment method successfully", async () => {
      (apiClient.patch as jest.Mock).mockResolvedValue({ data: mockPaymentMethods[0] });
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockPaymentMethods });

      const { result } = renderHook(() => usePaymentMethodOperations(), {
        wrapper: createWrapper(),
      });

      const request = {
        billing_name: "Jane Doe",
        billing_city: "New York",
      };

      await result.current.updatePaymentMethod("pm_1", request);

      expect(apiClient.patch).toHaveBeenCalledWith("/billing/tenant/payment-methods/pm_1", request);
    });

    it("should set default payment method successfully", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: {} });
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockPaymentMethods });

      const { result } = renderHook(() => usePaymentMethodOperations(), {
        wrapper: createWrapper(),
      });

      await result.current.setDefaultPaymentMethod("pm_2");

      expect(apiClient.post).toHaveBeenCalledWith("/billing/tenant/payment-methods/pm_2/set-default");
    });

    it("should remove payment method successfully", async () => {
      (apiClient.delete as jest.Mock).mockResolvedValue({});
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [mockPaymentMethods[0]] });

      const { result } = renderHook(() => usePaymentMethodOperations(), {
        wrapper: createWrapper(),
      });

      await result.current.removePaymentMethod("pm_2");

      expect(apiClient.delete).toHaveBeenCalledWith("/billing/tenant/payment-methods/pm_2");
    });

    it("should verify payment method successfully", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: { verified: true } });
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockPaymentMethods });

      const { result } = renderHook(() => usePaymentMethodOperations(), {
        wrapper: createWrapper(),
      });

      const request = {
        verification_code1: "32",
        verification_code2: "45",
      };

      await result.current.verifyPaymentMethod("pm_2", request);

      expect(apiClient.post).toHaveBeenCalledWith("/billing/tenant/payment-methods/pm_2/verify", request);
    });
  });

  describe("useTenantPaymentMethods (main hook)", () => {
    it("should return payment methods with default identified", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockPaymentMethods });

      const { result } = renderHook(() => useTenantPaymentMethods(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.paymentMethods).toEqual(mockPaymentMethods);
      expect(result.current.defaultPaymentMethod).toEqual(mockPaymentMethods[0]);
    });

    it("should handle no default payment method", async () => {
      const methodsWithoutDefault = mockPaymentMethods.map((m) => ({ ...m, is_default: false }));
      (apiClient.get as jest.Mock).mockResolvedValue({ data: methodsWithoutDefault });

      const { result } = renderHook(() => useTenantPaymentMethods(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.defaultPaymentMethod).toBeUndefined();
    });
  });
});
