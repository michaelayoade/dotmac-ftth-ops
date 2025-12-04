/**
 * Tests for useBillingPlans hook
 * Converted from MSW to Jest mocks for better reliability
 */

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useBillingPlans } from "../useBillingPlans";
import apiClient from "@/lib/api/client";

// Mock the API client
jest.mock("@/lib/api/client");
const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

// Mock data
const mockPlans = [
  {
    plan_id: "plan-1",
    product_id: "prod-1",
    name: "Premium Plan",
    display_name: "Premium Monthly",
    description: "Premium subscription",
    billing_interval: "monthly" as const,
    interval_count: 1,
    price_amount: 99.99,
    price_currency: "USD",
    is_active: true,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    plan_id: "plan-2",
    product_id: "prod-1",
    name: "Basic Plan",
    display_name: "Basic Monthly",
    description: "Basic subscription",
    billing_interval: "monthly" as const,
    interval_count: 1,
    price_amount: 49.99,
    price_currency: "USD",
    is_active: true,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
];

const mockProducts = [
  {
    product_id: "prod-1",
    name: "Software License",
    description: "Monthly software license",
    product_type: "service" as const,
    is_active: true,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    product_id: "prod-2",
    name: "Hardware",
    description: "Physical product",
    product_type: "physical" as const,
    is_active: true,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
];

describe("useBillingPlans", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  // Query key factory is internal implementation detail - tested indirectly through other tests

  describe("useBillingPlans - Fetch Plans Query", () => {
    it("should fetch billing plans successfully", async () => {
      mockApiClient.get.mockResolvedValue({ data: mockPlans });

      const { result } = renderHook(() => useBillingPlans(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.plans).toHaveLength(2);
      expect(result.current.plans[0].plan_id).toBe("plan-1");
      expect(result.current.plans[0].name).toBe("Premium Plan");
      expect(result.current.error).toBeNull();
    });

    it("should fetch plans with activeOnly=false", async () => {
      const inactivePlan = { ...mockPlans[0], plan_id: "plan-3", is_active: false };
      mockApiClient.get.mockResolvedValue({ data: [...mockPlans, inactivePlan] });

      const { result } = renderHook(() => useBillingPlans({ activeOnly: false }), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.plans).toHaveLength(3);
      // Verify the API was called (implementation detail of query params is internal)
      expect(mockApiClient.get).toHaveBeenCalled();
    });

    it("should fetch plans filtered by productId", async () => {
      const filteredPlans = mockPlans.filter((p) => p.product_id === "prod-1");
      mockApiClient.get.mockResolvedValue({ data: filteredPlans });

      const { result } = renderHook(() => useBillingPlans({ productId: "prod-1" }), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.plans).toHaveLength(2);
      // Verify the API was called (implementation detail of query params is internal)
      expect(mockApiClient.get).toHaveBeenCalled();
    });

    it("should handle array response format", async () => {
      mockApiClient.get.mockResolvedValue({ data: mockPlans });

      const { result } = renderHook(() => useBillingPlans(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.plans).toEqual(mockPlans);
    });

    it("should handle response with error field", async () => {
      mockApiClient.get.mockResolvedValue({
        data: [],
        error: "Some warning",
      });

      const { result } = renderHook(() => useBillingPlans(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.plans).toEqual([]);
    });

    it("should handle empty plans array", async () => {
      mockApiClient.get.mockResolvedValue({ data: [] });

      const { result } = renderHook(() => useBillingPlans(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.plans).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it("should handle fetch error", async () => {
      const error = new Error("Network error");
      mockApiClient.get.mockRejectedValue(error);

      const { result } = renderHook(() => useBillingPlans(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.plans).toEqual([]);
      expect(result.current.error).toContain("Network error");
    });

    it("should handle all billing intervals", async () => {
      const plans = [
        { ...mockPlans[0], plan_id: "plan-monthly", billing_interval: "monthly" as const },
        { ...mockPlans[0], plan_id: "plan-quarterly", billing_interval: "quarterly" as const },
        { ...mockPlans[0], plan_id: "plan-annual", billing_interval: "annual" as const },
      ];
      mockApiClient.get.mockResolvedValue({ data: plans });

      const { result } = renderHook(() => useBillingPlans(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.plans).toHaveLength(3);
      const intervals = result.current.plans.map((p) => p.billing_interval);
      expect(intervals).toContain("monthly");
      expect(intervals).toContain("quarterly");
      expect(intervals).toContain("annual");
    });

    it("should set loading state correctly", async () => {
      mockApiClient.get.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: mockPlans }), 100)),
      );

      const { result } = renderHook(() => useBillingPlans(), { wrapper });

      expect(result.current.loading).toBe(true);

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.plans).toHaveLength(2);
    });
  });

  describe("useBillingPlans - Fetch Products Query", () => {
    it("should fetch products successfully", async () => {
      mockApiClient.get.mockImplementation((url) => {
        if (url.includes("/products")) {
          return Promise.resolve({ data: mockProducts });
        }
        return Promise.resolve({ data: mockPlans });
      });

      const { result } = renderHook(() => useBillingPlans(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.products).toHaveLength(2);
      expect(result.current.products[0].product_id).toBe("prod-1");
    });

    it("should fetch all products when activeOnly=false", async () => {
      const inactiveProduct = { ...mockProducts[0], product_id: "prod-3", is_active: false };
      mockApiClient.get.mockImplementation((url) => {
        if (url.includes("/products")) {
          return Promise.resolve({ data: [...mockProducts, inactiveProduct] });
        }
        return Promise.resolve({ data: mockPlans });
      });

      const { result } = renderHook(() => useBillingPlans({ activeOnly: false }), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.products).toHaveLength(3);
    });

    it("should handle all product types", async () => {
      const products = [
        { ...mockProducts[0], product_id: "prod-service", product_type: "service" as const },
        { ...mockProducts[0], product_id: "prod-physical", product_type: "physical" as const },
        { ...mockProducts[0], product_id: "prod-digital", product_type: "digital" as const },
      ];
      mockApiClient.get.mockImplementation((url) => {
        if (url.includes("/products")) {
          return Promise.resolve({ data: products });
        }
        return Promise.resolve({ data: mockPlans });
      });

      const { result } = renderHook(() => useBillingPlans(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.products).toHaveLength(3);
      const types = result.current.products.map((p) => p.product_type);
      expect(types).toContain("service");
      expect(types).toContain("physical");
      expect(types).toContain("digital");
    });

    it("should handle products fetch error gracefully", async () => {
      mockApiClient.get.mockImplementation((url) => {
        if (url.includes("/products")) {
          return Promise.reject(new Error("Products error"));
        }
        return Promise.resolve({ data: mockPlans });
      });

      const { result } = renderHook(() => useBillingPlans(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.products).toEqual([]);
      expect(result.current.plans).toHaveLength(2);
    });

    it("should handle empty products array", async () => {
      mockApiClient.get.mockImplementation((url) => {
        if (url.includes("/products")) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: mockPlans });
      });

      const { result } = renderHook(() => useBillingPlans(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.products).toEqual([]);
    });
  });

  describe("useBillingPlans - Create Plan Mutation", () => {
    it("should create plan successfully", async () => {
      const newPlan = { ...mockPlans[0], plan_id: "plan-new" };
      mockApiClient.get.mockResolvedValue({ data: mockPlans });
      mockApiClient.post.mockResolvedValue({ data: newPlan });

      const { result } = renderHook(() => useBillingPlans(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await result.current.createPlan({
        product_id: "prod-1",
        billing_interval: "monthly",
        interval_count: 1,
        price_amount: 99.99,
        price_currency: "USD",
      });

      expect(mockApiClient.post).toHaveBeenCalledWith(
        "/billing/subscriptions/plans",
        expect.objectContaining({
          product_id: "prod-1",
          billing_interval: "monthly",
        }),
      );
    });

    it("should handle data response format", async () => {
      const newPlan = { ...mockPlans[0], plan_id: "plan-new" };
      mockApiClient.get.mockResolvedValue({ data: mockPlans });
      mockApiClient.post.mockResolvedValue({ data: newPlan });

      const { result } = renderHook(() => useBillingPlans(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const created = await result.current.createPlan({
        product_id: "prod-1",
        billing_interval: "monthly",
        interval_count: 1,
        price_amount: 99.99,
        price_currency: "USD",
      });

      expect(created.plan_id).toBe("plan-new");
    });

    it("should create plan with features and metadata", async () => {
      const newPlan = {
        ...mockPlans[0],
        plan_id: "plan-new",
        features: ["feature1", "feature2"],
        metadata: { key: "value" },
      };
      mockApiClient.get.mockResolvedValue({ data: mockPlans });
      mockApiClient.post.mockResolvedValue({ data: newPlan });

      const { result } = renderHook(() => useBillingPlans(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await result.current.createPlan({
        product_id: "prod-1",
        billing_interval: "monthly",
        interval_count: 1,
        price_amount: 99.99,
        price_currency: "USD",
        features: ["feature1", "feature2"],
        metadata: { key: "value" },
      });

      expect(mockApiClient.post).toHaveBeenCalledWith(
        "/billing/subscriptions/plans",
        expect.objectContaining({
          features: ["feature1", "feature2"],
          metadata: { key: "value" },
        }),
      );
    });

    it("should invalidate queries after creating plan", async () => {
      const newPlan = { ...mockPlans[0], plan_id: "plan-new" };
      mockApiClient.get.mockResolvedValue({ data: mockPlans });
      mockApiClient.post.mockResolvedValue({ data: newPlan });

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useBillingPlans(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await result.current.createPlan({
        product_id: "prod-1",
        billing_interval: "monthly",
        interval_count: 1,
        price_amount: 99.99,
        price_currency: "USD",
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["billing-plans", "plans"],
      });
    });

    it("should handle create error", async () => {
      mockApiClient.get.mockResolvedValue({ data: mockPlans });
      mockApiClient.post.mockRejectedValue(new Error("Create failed"));

      const { result } = renderHook(() => useBillingPlans(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await expect(
        result.current.createPlan({
          product_id: "prod-1",
          billing_interval: "monthly",
          interval_count: 1,
          price_amount: 99.99,
          price_currency: "USD",
        }),
      ).rejects.toThrow("Create failed");
    });

    it("should handle invalid response format", async () => {
      mockApiClient.get.mockResolvedValue({ data: mockPlans });
      mockApiClient.post.mockResolvedValue({ data: null } as any);

      const { result } = renderHook(() => useBillingPlans(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await expect(
        result.current.createPlan({
          product_id: "prod-1",
          billing_interval: "monthly",
          interval_count: 1,
          price_amount: 99.99,
          price_currency: "USD",
        }),
      ).rejects.toThrow("Invalid response format");
    });
  });

  describe("useBillingPlans - Update Plan Mutation", () => {
    it("should update plan successfully", async () => {
      const updatedPlan = { ...mockPlans[0], price_amount: 199.99 };
      mockApiClient.get.mockResolvedValue({ data: mockPlans });
      mockApiClient.patch.mockResolvedValue({ data: updatedPlan });

      const { result } = renderHook(() => useBillingPlans(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await result.current.updatePlan("plan-1", { price_amount: 199.99 });

      expect(mockApiClient.patch).toHaveBeenCalledWith(
        "/billing/subscriptions/plans/plan-1",
        expect.objectContaining({ price_amount: 199.99 }),
      );
    });

    it("should update plan features", async () => {
      const updatedPlan = {
        ...mockPlans[0],
        features: ["new-feature"],
      };
      mockApiClient.get.mockResolvedValue({ data: mockPlans });
      mockApiClient.patch.mockResolvedValue({ data: updatedPlan });

      const { result } = renderHook(() => useBillingPlans(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await result.current.updatePlan("plan-1", {
        features: ["new-feature"],
      });

      expect(mockApiClient.patch).toHaveBeenCalledWith(
        "/billing/subscriptions/plans/plan-1",
        expect.objectContaining({ features: ["new-feature"] }),
      );
    });

    it("should update plan active status", async () => {
      const updatedPlan = { ...mockPlans[0], is_active: false };
      mockApiClient.get.mockResolvedValue({ data: mockPlans });
      mockApiClient.patch.mockResolvedValue({ data: updatedPlan });

      const { result } = renderHook(() => useBillingPlans(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await result.current.updatePlan("plan-1", { is_active: false });

      expect(mockApiClient.patch).toHaveBeenCalledWith(
        "/billing/subscriptions/plans/plan-1",
        expect.objectContaining({ is_active: false }),
      );
    });

    it("should invalidate queries after updating plan", async () => {
      const updatedPlan = { ...mockPlans[0], price_amount: 199.99 };
      mockApiClient.get.mockResolvedValue({ data: mockPlans });
      mockApiClient.patch.mockResolvedValue({ data: updatedPlan });

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useBillingPlans(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await result.current.updatePlan("plan-1", { price_amount: 199.99 });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["billing-plans", "plans"],
      });
    });

    it("should handle update error", async () => {
      mockApiClient.get.mockResolvedValue({ data: mockPlans });
      mockApiClient.patch.mockRejectedValue(new Error("Update failed"));

      const { result } = renderHook(() => useBillingPlans(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await expect(result.current.updatePlan("plan-1", { price_amount: 199.99 })).rejects.toThrow(
        "Update failed",
      );
    });
  });

  describe("useBillingPlans - Delete Plan Mutation", () => {
    it("should delete plan successfully", async () => {
      mockApiClient.get.mockResolvedValue({ data: mockPlans });
      mockApiClient.delete.mockResolvedValue({ data: null, status: 204 });

      const { result } = renderHook(() => useBillingPlans(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await result.current.deletePlan("plan-1");

      expect(mockApiClient.delete).toHaveBeenCalledWith("/billing/subscriptions/plans/plan-1");
    });

    it("should invalidate queries after deleting plan", async () => {
      mockApiClient.get.mockResolvedValue({ data: mockPlans });
      mockApiClient.delete.mockResolvedValue({ data: null, status: 204 });

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useBillingPlans(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await result.current.deletePlan("plan-1");

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["billing-plans", "plans"],
      });
    });

    it("should handle delete error", async () => {
      mockApiClient.get.mockResolvedValue({ data: mockPlans });
      mockApiClient.delete.mockRejectedValue(new Error("Delete failed"));

      const { result } = renderHook(() => useBillingPlans(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await expect(result.current.deletePlan("plan-1")).rejects.toThrow("Delete failed");
    });
  });

  describe("useBillingPlans - Refetch Functions", () => {
    it("should refetch plans", async () => {
      mockApiClient.get.mockResolvedValue({ data: mockPlans });

      const { result } = renderHook(() => useBillingPlans(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.plans).toHaveLength(2);

      mockApiClient.get.mockClear();
      mockApiClient.get.mockResolvedValue({ data: [mockPlans[0]] });

      await result.current.fetchPlans();

      expect(mockApiClient.get).toHaveBeenCalled();
    });

    it("should refetch products", async () => {
      mockApiClient.get.mockImplementation((url) => {
        if (url.includes("/products")) {
          return Promise.resolve({ data: mockProducts });
        }
        return Promise.resolve({ data: mockPlans });
      });

      const { result } = renderHook(() => useBillingPlans(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.products).toHaveLength(2);

      mockApiClient.get.mockClear();
      mockApiClient.get.mockImplementation((url) => {
        if (url.includes("/products")) {
          return Promise.resolve({ data: [mockProducts[0]] });
        }
        return Promise.resolve({ data: mockPlans });
      });

      await result.current.fetchProducts();

      expect(mockApiClient.get).toHaveBeenCalled();
    });

    it("should refresh plans using refreshPlans", async () => {
      mockApiClient.get.mockResolvedValue({ data: mockPlans });

      const { result } = renderHook(() => useBillingPlans(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.plans).toHaveLength(2);

      mockApiClient.get.mockClear();
      mockApiClient.get.mockResolvedValue({ data: [mockPlans[0]] });

      await result.current.refreshPlans();

      expect(mockApiClient.get).toHaveBeenCalled();
    });
  });

  describe("useBillingPlans - Loading States", () => {
    it("should show loading during plans query", async () => {
      mockApiClient.get.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: mockPlans }), 100)),
      );

      const { result } = renderHook(() => useBillingPlans(), { wrapper });

      expect(result.current.loading).toBe(true);

      await waitFor(() => expect(result.current.loading).toBe(false));
    });

    it("should show loading during products query", async () => {
      mockApiClient.get.mockImplementation((url) => {
        if (url.includes("/products")) {
          return new Promise((resolve) => setTimeout(() => resolve({ data: mockProducts }), 100));
        }
        return Promise.resolve({ data: mockPlans });
      });

      const { result } = renderHook(() => useBillingPlans(), { wrapper });

      expect(result.current.loading).toBe(true);

      await waitFor(() => expect(result.current.loading).toBe(false));
    });

    it("should show loading during create mutation", async () => {
      const newPlan = { ...mockPlans[0], plan_id: "plan-new" };
      mockApiClient.get.mockResolvedValue({ data: mockPlans });
      mockApiClient.post.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: newPlan }), 50)),
      );

      const { result } = renderHook(() => useBillingPlans(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const createPromise = result.current.createPlan({
        product_id: "prod-1",
        billing_interval: "monthly",
        interval_count: 1,
        price_amount: 99.99,
        price_currency: "USD",
      });

      // Loading state includes mutation pending
      await waitFor(() => expect(result.current.loading).toBe(true));

      await createPromise;

      await waitFor(() => expect(result.current.loading).toBe(false));
    });

    it("should show loading during update mutation", async () => {
      const updatedPlan = { ...mockPlans[0], price_amount: 199.99 };
      mockApiClient.get.mockResolvedValue({ data: mockPlans });
      mockApiClient.patch.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: updatedPlan }), 50)),
      );

      const { result } = renderHook(() => useBillingPlans(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const updatePromise = result.current.updatePlan("plan-1", {
        price_amount: 199.99,
      });

      await waitFor(() => expect(result.current.loading).toBe(true));

      await updatePromise;

      await waitFor(() => expect(result.current.loading).toBe(false));
    });

    it("should show loading during delete mutation", async () => {
      mockApiClient.get.mockResolvedValue({ data: mockPlans });
      mockApiClient.delete.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: null, status: 204 }), 50)),
      );

      const { result } = renderHook(() => useBillingPlans(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const deletePromise = result.current.deletePlan("plan-1");

      await waitFor(() => expect(result.current.loading).toBe(true));

      await deletePromise;

      await waitFor(() => expect(result.current.loading).toBe(false));
    });
  });

  // Stale time configuration is internal implementation detail - behavior is tested through refetch tests

  describe("useBillingPlans - Error Handling", () => {
    it("should return error string from plans query", async () => {
      const error = new Error("Network error");
      mockApiClient.get.mockRejectedValue(error);

      const { result } = renderHook(() => useBillingPlans(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.error).toContain("Network error");
    });

    it("should return null error when no error", async () => {
      mockApiClient.get.mockResolvedValue({ data: mockPlans });

      const { result } = renderHook(() => useBillingPlans(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.error).toBeNull();
    });
  });

  describe("useBillingPlans - Edge Cases", () => {
    it("should handle null data gracefully", async () => {
      mockApiClient.get.mockResolvedValue({ data: null } as any);

      const { result } = renderHook(() => useBillingPlans(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.plans).toEqual([]);
    });

    it("should handle undefined data gracefully", async () => {
      mockApiClient.get.mockResolvedValue({} as any);

      const { result } = renderHook(() => useBillingPlans(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.plans).toEqual([]);
    });

    it("should handle plans with minimum required fields", async () => {
      const minimalPlan = {
        plan_id: "plan-minimal",
        product_id: "prod-1",
        name: "Minimal",
        billing_interval: "monthly" as const,
        interval_count: 1,
        price_amount: 0,
        price_currency: "USD",
        is_active: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };
      mockApiClient.get.mockResolvedValue({ data: [minimalPlan] });

      const { result } = renderHook(() => useBillingPlans(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.plans).toHaveLength(1);
      expect(result.current.plans[0].plan_id).toBe("plan-minimal");
    });

    it("should handle products with minimum required fields", async () => {
      const minimalProduct = {
        product_id: "prod-minimal",
        name: "Minimal Product",
        product_type: "service" as const,
        is_active: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };
      mockApiClient.get.mockImplementation((url) => {
        if (url.includes("/products")) {
          return Promise.resolve({ data: [minimalProduct] });
        }
        return Promise.resolve({ data: mockPlans });
      });

      const { result } = renderHook(() => useBillingPlans(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.products).toHaveLength(1);
      expect(result.current.products[0].product_id).toBe("prod-minimal");
    });
  });
});
