/**
 * Platform Admin App - useTenantSubscription tests
 * Tests for tenant subscription management with TanStack Query
 */
import {
  useTenantSubscriptionQuery,
  useAvailablePlans,
  useSubscriptionOperations,
  useTenantSubscription,
} from "../useTenantSubscription";
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
const mockSubscription = {
  subscription_id: "sub_1",
  tenant_id: "tenant_1",
  plan_id: "plan_pro",
  plan_name: "Professional",
  status: "active",
  current_period_start: "2024-01-01T00:00:00Z",
  current_period_end: "2024-02-01T00:00:00Z",
  cancel_at_period_end: false,
  billing_cycle: "monthly",
  price_amount: 99,
  currency: "USD",
  usage: {
    users: { current: 5, limit: 10 },
    storage: { current: 50, limit: 100 },
    api_calls: { current: 1000, limit: 10000 },
  },
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

const mockAvailablePlans = [
  {
    plan_id: "plan_starter",
    name: "Starter",
    display_name: "Starter Plan",
    description: "Perfect for small teams",
    billing_cycle: "monthly",
    price_amount: 49,
    currency: "USD",
    trial_days: 14,
    features: { users: 5, storage: 50 },
    is_featured: false,
  },
  {
    plan_id: "plan_pro",
    name: "Professional",
    display_name: "Professional Plan",
    description: "For growing businesses",
    billing_cycle: "monthly",
    price_amount: 99,
    currency: "USD",
    trial_days: 14,
    features: { users: 10, storage: 100 },
    is_featured: true,
  },
];

const mockProrationPreview = {
  current_plan: {
    plan_id: "plan_starter",
    name: "Starter",
    price: 49,
    billing_cycle: "monthly",
  },
  new_plan: {
    plan_id: "plan_pro",
    name: "Professional",
    price: 99,
    billing_cycle: "monthly",
  },
  proration: {
    proration_amount: 25,
    proration_description: "Prorated charge for upgrade",
    old_plan_unused_amount: 24.50,
    new_plan_prorated_amount: 49.50,
    days_remaining: 15,
  },
  estimated_invoice_amount: 25,
  effective_date: "2024-01-15T00:00:00Z",
  next_billing_date: "2024-02-01T00:00:00Z",
};

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

describe("useTenantSubscription", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("useTenantSubscriptionQuery", () => {
    it("should fetch subscription successfully", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockSubscription });

      const { result } = renderHook(() => useTenantSubscriptionQuery(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockSubscription);
      expect(apiClient.get).toHaveBeenCalledWith("/billing/tenant/subscription/current");
    });

    it("should handle fetch errors", async () => {
      (apiClient.get as jest.Mock).mockRejectedValue(new Error("Not found"));

      const { result } = renderHook(() => useTenantSubscriptionQuery(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBeTruthy();
    });
  });

  describe("useAvailablePlans", () => {
    it("should fetch available plans successfully", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockAvailablePlans });

      const { result } = renderHook(() => useAvailablePlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockAvailablePlans);
      expect(apiClient.get).toHaveBeenCalledWith("/billing/tenant/subscription/available-plans");
    });
  });

  describe("useSubscriptionOperations", () => {
    it("should preview plan change successfully", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockProrationPreview });
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockSubscription });

      const { result } = renderHook(() => useSubscriptionOperations(), {
        wrapper: createWrapper(),
      });

      const request = {
        new_plan_id: "plan_pro",
        proration_behavior: "prorate" as const,
      };

      await result.current.previewPlanChange(request);

      expect(apiClient.post).toHaveBeenCalledWith("/billing/tenant/subscription/preview-change", request);

      // Wait for state update
      await waitFor(() => {
        expect(result.current.prorationPreview).toEqual(mockProrationPreview);
      });
    });

    it("should change plan successfully", async () => {
      const updatedSubscription = { ...mockSubscription, plan_id: "plan_pro" };
      (apiClient.post as jest.Mock).mockResolvedValue({ data: updatedSubscription });
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockSubscription });

      const { result } = renderHook(() => useSubscriptionOperations(), {
        wrapper: createWrapper(),
      });

      const request = {
        new_plan_id: "plan_pro",
        proration_behavior: "prorate" as const,
      };

      await result.current.changePlan(request);

      expect(apiClient.post).toHaveBeenCalledWith("/billing/tenant/subscription/change-plan", request);
    });

    it("should cancel subscription successfully", async () => {
      const canceledSubscription = { ...mockSubscription, cancel_at_period_end: true };
      (apiClient.post as jest.Mock).mockResolvedValue({ data: canceledSubscription });
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockSubscription });

      const { result } = renderHook(() => useSubscriptionOperations(), {
        wrapper: createWrapper(),
      });

      const request = {
        cancel_at_period_end: true,
        reason: "Too expensive",
      };

      await result.current.cancelSubscription(request);

      expect(apiClient.post).toHaveBeenCalledWith("/billing/tenant/subscription/cancel", request);
    });

    it("should reactivate subscription successfully", async () => {
      const reactivatedSubscription = { ...mockSubscription, cancel_at_period_end: false };
      (apiClient.post as jest.Mock).mockResolvedValue({ data: reactivatedSubscription });
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockSubscription });

      const { result } = renderHook(() => useSubscriptionOperations(), {
        wrapper: createWrapper(),
      });

      await result.current.reactivateSubscription();

      expect(apiClient.post).toHaveBeenCalledWith("/billing/tenant/subscription/reactivate");
    });
  });

  describe("useTenantSubscription (main hook)", () => {
    it("should return subscription and available plans", async () => {
      (apiClient.get as jest.Mock)
        .mockResolvedValueOnce({ data: mockSubscription })
        .mockResolvedValueOnce({ data: mockAvailablePlans });

      const { result } = renderHook(() => useTenantSubscription(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.subscription).toEqual(mockSubscription);
      expect(result.current.availablePlans).toEqual(mockAvailablePlans);
    });

    it("should handle no subscription (null)", async () => {
      (apiClient.get as jest.Mock)
        .mockRejectedValueOnce(new Error("Not found"))
        .mockResolvedValueOnce({ data: mockAvailablePlans });

      const { result } = renderHook(() => useTenantSubscription(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.subscription).toBeNull();
        expect(result.current.availablePlans).toEqual(mockAvailablePlans);
      });
    });
  });
});
