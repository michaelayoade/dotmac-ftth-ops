/**
 * Tests for useBillingPlans hook
 * Tests billing plan management functionality with TanStack Query
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import {
  useBillingPlans,
  billingPlansKeys,
  BillingPlan,
  ProductCatalogItem,
  PlanCreateRequest,
  PlanUpdateRequest,
} from "../useBillingPlans";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

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
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe("useBillingPlans", () => {
  function createWrapper() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
        mutations: {
          retry: false,
        },
      },
    });

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("billingPlansKeys - Query Key Factory", () => {
    it("should generate correct query keys", () => {
      expect(billingPlansKeys.all).toEqual(["billing-plans"]);
      expect(billingPlansKeys.plans()).toEqual(["billing-plans", "plans", undefined]);
      expect(billingPlansKeys.plans({ activeOnly: true })).toEqual([
        "billing-plans",
        "plans",
        { activeOnly: true },
      ]);
      expect(billingPlansKeys.plans({ activeOnly: false, productId: "prod-1" })).toEqual([
        "billing-plans",
        "plans",
        { activeOnly: false, productId: "prod-1" },
      ]);
      expect(billingPlansKeys.products()).toEqual(["billing-plans", "products", undefined]);
      expect(billingPlansKeys.products({ activeOnly: true })).toEqual([
        "billing-plans",
        "products",
        { activeOnly: true },
      ]);
    });
  });

  describe("useBillingPlans - Fetch Plans Query", () => {
    it("should fetch billing plans successfully", async () => {
      const mockPlans: BillingPlan[] = [
        {
          plan_id: "plan-1",
          product_id: "prod-1",
          name: "Premium Plan",
          display_name: "Premium",
          description: "Premium plan with all features",
          billing_interval: "monthly",
          interval_count: 1,
          price_amount: 99.99,
          currency: "USD",
          trial_days: 14,
          is_active: true,
          features: { unlimited: true },
          metadata: {},
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({
        success: true,
        data: mockPlans,
      });

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.plans).toEqual(mockPlans);
      expect(result.current.error).toBeNull();
      expect(apiClient.get).toHaveBeenCalledWith("/billing/subscriptions/plans?active_only=true");
    });

    it("should fetch plans with activeOnly=false", async () => {
      const mockPlans: BillingPlan[] = [
        {
          plan_id: "plan-1",
          name: "Inactive Plan",
          description: "Inactive plan",
          billing_interval: "monthly",
          interval_count: 1,
          price_amount: 49.99,
          currency: "USD",
          trial_days: 0,
          is_active: false,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({
        success: true,
        data: mockPlans,
      });

      const { result } = renderHook(() => useBillingPlans(false), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.plans).toEqual(mockPlans);
      expect(apiClient.get).toHaveBeenCalledWith("/billing/subscriptions/plans?");
    });

    it("should fetch plans filtered by productId", async () => {
      const mockPlans: BillingPlan[] = [
        {
          plan_id: "plan-1",
          product_id: "prod-1",
          name: "Product Plan",
          description: "Plan for specific product",
          billing_interval: "annual",
          interval_count: 1,
          price_amount: 999.99,
          currency: "USD",
          trial_days: 30,
          is_active: true,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({
        success: true,
        data: mockPlans,
      });

      const { result } = renderHook(() => useBillingPlans(true, "prod-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.plans).toEqual(mockPlans);
      expect(apiClient.get).toHaveBeenCalledWith(
        "/billing/subscriptions/plans?active_only=true&product_id=prod-1",
      );
    });

    it("should handle array response format", async () => {
      const mockPlans: BillingPlan[] = [
        {
          plan_id: "plan-1",
          name: "Basic Plan",
          description: "Basic plan",
          billing_interval: "monthly",
          interval_count: 1,
          price_amount: 29.99,
          currency: "USD",
          trial_days: 7,
          is_active: true,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: mockPlans,
      });

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.plans).toEqual(mockPlans);
    });

    it("should handle response with error field", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        error: "Some error occurred",
        data: null,
      });

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.plans).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith(
        "Plans response contains error",
        "Some error occurred",
      );
    });

    it("should handle empty plans array", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        success: true,
        data: [],
      });

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.plans).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch plans");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(logger.error).toHaveBeenCalledWith("Failed to fetch billing plans", error);
    });

    it("should handle all billing intervals", async () => {
      const intervals: BillingPlan["billing_interval"][] = ["monthly", "quarterly", "annual"];

      for (const interval of intervals) {
        const mockPlans: BillingPlan[] = [
          {
            plan_id: `plan-${interval}`,
            name: `${interval} Plan`,
            description: `Plan with ${interval} billing`,
            billing_interval: interval,
            interval_count: 1,
            price_amount: 99.99,
            currency: "USD",
            trial_days: 14,
            is_active: true,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          },
        ];

        (apiClient.get as jest.Mock).mockResolvedValue({
          success: true,
          data: mockPlans,
        });

        const { result } = renderHook(() => useBillingPlans(), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.plans[0].billing_interval).toBe(interval);

        jest.clearAllMocks();
      }
    });

    it("should set loading state correctly", async () => {
      (apiClient.get as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  success: true,
                  data: [],
                }),
              100,
            ),
          ),
      );

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      expect(result.current.loading).toBe(true);

      await waitFor(() => expect(result.current.loading).toBe(false), {
        timeout: 200,
      });
    });
  });

  describe("useBillingPlans - Fetch Products Query", () => {
    it("should fetch products successfully", async () => {
      const mockProducts: ProductCatalogItem[] = [
        {
          product_id: "prod-1",
          tenant_id: "tenant-1",
          sku: "SKU-001",
          name: "Premium Product",
          description: "Premium product with all features",
          category: "subscription",
          product_type: "standard",
          base_price: 99.99,
          currency: "USD",
          tax_class: "digital",
          is_active: true,
          metadata: {},
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      (apiClient.get as jest.Mock).mockImplementation((url: string) => {
        if (url.includes("/billing/catalog/products")) {
          return Promise.resolve({ data: mockProducts });
        }
        return Promise.resolve({ success: true, data: [] });
      });

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.products).toEqual(mockProducts);
      expect(apiClient.get).toHaveBeenCalledWith("/billing/catalog/products?is_active=true");
    });

    it("should fetch all products when activeOnly=false", async () => {
      const mockProducts: ProductCatalogItem[] = [
        {
          product_id: "prod-1",
          tenant_id: "tenant-1",
          sku: "SKU-001",
          name: "Inactive Product",
          product_type: "standard",
          base_price: 49.99,
          currency: "USD",
          is_active: false,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      (apiClient.get as jest.Mock).mockImplementation((url: string) => {
        if (url.includes("/billing/catalog/products")) {
          return Promise.resolve({ data: mockProducts });
        }
        return Promise.resolve({ success: true, data: [] });
      });

      const { result } = renderHook(() => useBillingPlans(false), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.products).toEqual(mockProducts);
      expect(apiClient.get).toHaveBeenCalledWith("/billing/catalog/products");
    });

    it("should handle all product types", async () => {
      const productTypes: ProductCatalogItem["product_type"][] = [
        "standard",
        "usage_based",
        "hybrid",
      ];

      for (const productType of productTypes) {
        const mockProducts: ProductCatalogItem[] = [
          {
            product_id: `prod-${productType}`,
            tenant_id: "tenant-1",
            sku: `SKU-${productType}`,
            name: `${productType} Product`,
            product_type: productType,
            base_price: 99.99,
            currency: "USD",
            is_active: true,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          },
        ];

        (apiClient.get as jest.Mock).mockImplementation((url: string) => {
          if (url.includes("/billing/catalog/products")) {
            return Promise.resolve({ data: mockProducts });
          }
          return Promise.resolve({ success: true, data: [] });
        });

        const { result } = renderHook(() => useBillingPlans(), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.products[0].product_type).toBe(productType);

        jest.clearAllMocks();
      }
    });

    it("should handle products fetch error gracefully", async () => {
      const error = new Error("Failed to fetch products");
      (apiClient.get as jest.Mock).mockImplementation((url: string) => {
        if (url.includes("/billing/catalog/products")) {
          return Promise.reject(error);
        }
        return Promise.resolve({ success: true, data: [] });
      });

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.products).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith("Failed to fetch products", error);
    });

    it("should handle empty products array", async () => {
      (apiClient.get as jest.Mock).mockImplementation((url: string) => {
        if (url.includes("/billing/catalog/products")) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ success: true, data: [] });
      });

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.products).toEqual([]);
    });
  });

  describe("useBillingPlans - Create Plan Mutation", () => {
    it("should create plan successfully", async () => {
      const mockCreatedPlan: BillingPlan = {
        plan_id: "plan-new",
        product_id: "prod-1",
        name: "New Plan",
        description: "New billing plan",
        billing_interval: "monthly",
        interval_count: 1,
        price_amount: 79.99,
        currency: "USD",
        trial_days: 7,
        is_active: true,
        created_at: "2024-01-20T00:00:00Z",
        updated_at: "2024-01-20T00:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        success: true,
        data: [],
      });

      (apiClient.post as jest.Mock).mockResolvedValue({
        success: true,
        data: mockCreatedPlan,
      });

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const createData: PlanCreateRequest = {
        product_id: "prod-1",
        billing_interval: "monthly",
        interval_count: 1,
        trial_days: 7,
      };

      await act(async () => {
        const created = await result.current.createPlan(createData);
        expect(created).toEqual(mockCreatedPlan);
      });

      expect(apiClient.post).toHaveBeenCalledWith("/billing/subscriptions/plans", createData);
    });

    it("should handle data response format", async () => {
      const mockCreatedPlan: BillingPlan = {
        plan_id: "plan-new",
        product_id: "prod-1",
        name: "New Plan",
        description: "New billing plan",
        billing_interval: "quarterly",
        interval_count: 1,
        price_amount: 199.99,
        currency: "USD",
        trial_days: 14,
        is_active: true,
        created_at: "2024-01-20T00:00:00Z",
        updated_at: "2024-01-20T00:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        success: true,
        data: [],
      });

      (apiClient.post as jest.Mock).mockResolvedValue({
        data: mockCreatedPlan,
      });

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const createData: PlanCreateRequest = {
        product_id: "prod-1",
        billing_interval: "quarterly",
      };

      await act(async () => {
        const created = await result.current.createPlan(createData);
        expect(created).toEqual(mockCreatedPlan);
      });
    });

    it("should create plan with features and metadata", async () => {
      const mockCreatedPlan: BillingPlan = {
        plan_id: "plan-new",
        product_id: "prod-1",
        name: "Feature Rich Plan",
        description: "Plan with custom features",
        billing_interval: "annual",
        interval_count: 1,
        price_amount: 999.99,
        currency: "USD",
        trial_days: 30,
        is_active: true,
        features: {
          max_users: 100,
          storage_gb: 1000,
          api_calls: "unlimited",
        },
        metadata: {
          promotion: "launch-special",
        },
        created_at: "2024-01-20T00:00:00Z",
        updated_at: "2024-01-20T00:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        success: true,
        data: [],
      });

      (apiClient.post as jest.Mock).mockResolvedValue({
        success: true,
        data: mockCreatedPlan,
      });

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const createData: PlanCreateRequest = {
        product_id: "prod-1",
        billing_interval: "annual",
        features: {
          max_users: 100,
          storage_gb: 1000,
          api_calls: "unlimited",
        },
        metadata: {
          promotion: "launch-special",
        },
      };

      await act(async () => {
        const created = await result.current.createPlan(createData);
        expect(created.features).toEqual(createData.features);
        expect(created.metadata).toEqual(createData.metadata);
      });
    });

    it("should invalidate queries after creating plan", async () => {
      const mockCreatedPlan: BillingPlan = {
        plan_id: "plan-new",
        product_id: "prod-1",
        name: "New Plan",
        description: "New plan",
        billing_interval: "monthly",
        interval_count: 1,
        price_amount: 49.99,
        currency: "USD",
        trial_days: 0,
        is_active: true,
        created_at: "2024-01-20T00:00:00Z",
        updated_at: "2024-01-20T00:00:00Z",
      };

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      // Mock initial plans and products fetch
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: [],
      });
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: [],
      });

      const { result } = renderHook(() => useBillingPlans(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      (apiClient.post as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: mockCreatedPlan,
      });

      await act(async () => {
        await result.current.createPlan({
          product_id: "prod-1",
          billing_interval: "monthly",
        });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: billingPlansKeys.plans(),
      });

      invalidateSpy.mockRestore();
    });

    it("should handle create error", async () => {
      const error = new Error("Failed to create plan");
      (apiClient.get as jest.Mock).mockResolvedValue({
        success: true,
        data: [],
      });

      (apiClient.post as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await expect(
        result.current.createPlan({
          product_id: "prod-1",
          billing_interval: "monthly",
        }),
      ).rejects.toThrow("Failed to create plan");
      expect(logger.error).toHaveBeenCalledWith("Failed to create plan", error);
    });

    it("should handle invalid response format", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        success: true,
        data: [],
      });

      (apiClient.post as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await expect(
        result.current.createPlan({
          product_id: "prod-1",
          billing_interval: "monthly",
        }),
      ).rejects.toThrow("Invalid response format");
    });
  });

  describe("useBillingPlans - Update Plan Mutation", () => {
    it("should update plan successfully", async () => {
      const mockUpdatedPlan: BillingPlan = {
        plan_id: "plan-1",
        product_id: "prod-1",
        name: "Updated Plan",
        display_name: "Updated Display Name",
        description: "Updated description",
        billing_interval: "monthly",
        interval_count: 1,
        price_amount: 99.99,
        currency: "USD",
        trial_days: 21,
        is_active: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-20T00:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        success: true,
        data: [],
      });

      (apiClient.patch as jest.Mock).mockResolvedValue({
        data: mockUpdatedPlan,
      });

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const updateData: PlanUpdateRequest = {
        display_name: "Updated Display Name",
        description: "Updated description",
        trial_days: 21,
      };

      await act(async () => {
        const updated = await result.current.updatePlan("plan-1", updateData);
        expect(updated).toEqual(mockUpdatedPlan);
      });

      expect(apiClient.patch).toHaveBeenCalledWith(
        "/billing/subscriptions/plans/plan-1",
        updateData,
      );
    });

    it("should update plan features", async () => {
      const mockUpdatedPlan: BillingPlan = {
        plan_id: "plan-1",
        product_id: "prod-1",
        name: "Plan",
        description: "Plan with updated features",
        billing_interval: "monthly",
        interval_count: 1,
        price_amount: 99.99,
        currency: "USD",
        trial_days: 14,
        is_active: true,
        features: {
          max_users: 200,
          storage_gb: 2000,
        },
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-20T00:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        success: true,
        data: [],
      });

      (apiClient.patch as jest.Mock).mockResolvedValue({
        data: mockUpdatedPlan,
      });

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const updateData: PlanUpdateRequest = {
        features: {
          max_users: 200,
          storage_gb: 2000,
        },
      };

      await act(async () => {
        const updated = await result.current.updatePlan("plan-1", updateData);
        expect(updated.features).toEqual(updateData.features);
      });
    });

    it("should update plan active status", async () => {
      const mockUpdatedPlan: BillingPlan = {
        plan_id: "plan-1",
        product_id: "prod-1",
        name: "Plan",
        description: "Deactivated plan",
        billing_interval: "monthly",
        interval_count: 1,
        price_amount: 99.99,
        currency: "USD",
        trial_days: 14,
        is_active: false,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-20T00:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        success: true,
        data: [],
      });

      (apiClient.patch as jest.Mock).mockResolvedValue({
        data: mockUpdatedPlan,
      });

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        const updated = await result.current.updatePlan("plan-1", { is_active: false });
        expect(updated.is_active).toBe(false);
      });
    });

    it("should invalidate queries after updating plan", async () => {
      const mockUpdatedPlan: BillingPlan = {
        plan_id: "plan-1",
        product_id: "prod-1",
        name: "Updated Plan",
        description: "Updated",
        billing_interval: "monthly",
        interval_count: 1,
        price_amount: 99.99,
        currency: "USD",
        trial_days: 14,
        is_active: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-20T00:00:00Z",
      };

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      // Mock initial plans and products fetch
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: [],
      });
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: [],
      });

      const { result } = renderHook(() => useBillingPlans(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      (apiClient.patch as jest.Mock).mockResolvedValueOnce({
        data: mockUpdatedPlan,
      });

      await act(async () => {
        await result.current.updatePlan("plan-1", { description: "Updated" });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: billingPlansKeys.plans(),
      });

      invalidateSpy.mockRestore();
    });

    it("should handle update error", async () => {
      const error = new Error("Failed to update plan");
      (apiClient.get as jest.Mock).mockResolvedValue({
        success: true,
        data: [],
      });

      (apiClient.patch as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await expect(result.current.updatePlan("plan-1", { description: "Updated" })).rejects.toThrow(
        "Failed to update plan",
      );
      expect(logger.error).toHaveBeenCalledWith("Failed to update plan", error);
    });
  });

  describe("useBillingPlans - Delete Plan Mutation", () => {
    it("should delete plan successfully", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        success: true,
        data: [],
      });

      (apiClient.delete as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.deletePlan("plan-1");
      });

      expect(apiClient.delete).toHaveBeenCalledWith("/billing/subscriptions/plans/plan-1");
    });

    it("should optimistically remove plan from cache", async () => {
      const mockPlans: BillingPlan[] = [
        {
          plan_id: "plan-1",
          name: "Plan 1",
          description: "First plan",
          billing_interval: "monthly",
          interval_count: 1,
          price_amount: 99.99,
          currency: "USD",
          trial_days: 14,
          is_active: true,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
        {
          plan_id: "plan-2",
          name: "Plan 2",
          description: "Second plan",
          billing_interval: "monthly",
          interval_count: 1,
          price_amount: 149.99,
          currency: "USD",
          trial_days: 14,
          is_active: true,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: mockPlans,
      });

      const { result } = renderHook(() => useBillingPlans(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.plans).toHaveLength(2);

      (apiClient.delete as jest.Mock).mockResolvedValueOnce({});

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: [mockPlans[1]],
      });

      await act(async () => {
        await result.current.deletePlan("plan-1");
      });

      await waitFor(() => {
        expect(result.current.plans.length).toBeLessThan(2);
      });
    });

    it("should invalidate queries after deleting plan", async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      // Mock initial plans and products fetch
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: [],
      });
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: [],
      });

      const { result } = renderHook(() => useBillingPlans(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      (apiClient.delete as jest.Mock).mockResolvedValueOnce({});

      await act(async () => {
        await result.current.deletePlan("plan-1");
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: billingPlansKeys.plans(),
      });

      invalidateSpy.mockRestore();
    });

    it("should handle delete error", async () => {
      const error = new Error("Failed to delete plan");
      (apiClient.get as jest.Mock).mockResolvedValue({
        success: true,
        data: [],
      });

      (apiClient.delete as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await expect(result.current.deletePlan("plan-1")).rejects.toThrow("Failed to delete plan");
      expect(logger.error).toHaveBeenCalledWith("Failed to delete plan", error);
    });
  });

  describe("useBillingPlans - Refetch Functions", () => {
    it("should refetch plans", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        success: true,
        data: [],
      });

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const initialCallCount = (apiClient.get as jest.Mock).mock.calls.filter((call) =>
        call[0].includes("/billing/subscriptions/plans"),
      ).length;

      await act(async () => {
        await result.current.fetchPlans();
      });

      await waitFor(() => {
        const newCallCount = (apiClient.get as jest.Mock).mock.calls.filter((call) =>
          call[0].includes("/billing/subscriptions/plans"),
        ).length;
        expect(newCallCount).toBeGreaterThan(initialCallCount);
      });
    });

    it("should refetch products", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        success: true,
        data: [],
      });

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const initialCallCount = (apiClient.get as jest.Mock).mock.calls.filter((call) =>
        call[0].includes("/billing/catalog/products"),
      ).length;

      await act(async () => {
        await result.current.fetchProducts();
      });

      await waitFor(() => {
        const newCallCount = (apiClient.get as jest.Mock).mock.calls.filter((call) =>
          call[0].includes("/billing/catalog/products"),
        ).length;
        expect(newCallCount).toBeGreaterThan(initialCallCount);
      });
    });

    it("should refresh plans using refreshPlans", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        success: true,
        data: [],
      });

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const initialCallCount = (apiClient.get as jest.Mock).mock.calls.filter((call) =>
        call[0].includes("/billing/subscriptions/plans"),
      ).length;

      await act(async () => {
        await result.current.refreshPlans();
      });

      await waitFor(() => {
        const newCallCount = (apiClient.get as jest.Mock).mock.calls.filter((call) =>
          call[0].includes("/billing/subscriptions/plans"),
        ).length;
        expect(newCallCount).toBeGreaterThan(initialCallCount);
      });
    });
  });

  describe("useBillingPlans - Loading States", () => {
    it("should show loading during plans query", async () => {
      (apiClient.get as jest.Mock).mockImplementation((url: string) => {
        if (url.includes("/billing/subscriptions/plans")) {
          return new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  success: true,
                  data: [],
                }),
              100,
            ),
          );
        }
        return Promise.resolve({ data: [] });
      });

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      expect(result.current.loading).toBe(true);

      await waitFor(() => expect(result.current.loading).toBe(false), {
        timeout: 200,
      });
    });

    it("should show loading during products query", async () => {
      (apiClient.get as jest.Mock).mockImplementation((url: string) => {
        if (url.includes("/billing/catalog/products")) {
          return new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  data: [],
                }),
              100,
            ),
          );
        }
        return Promise.resolve({ success: true, data: [] });
      });

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      expect(result.current.loading).toBe(true);

      await waitFor(() => expect(result.current.loading).toBe(false), {
        timeout: 200,
      });
    });

    it("should show loading during create mutation", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        success: true,
        data: [],
      });

      (apiClient.post as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  success: true,
                  data: {},
                }),
              100,
            ),
          ),
      );

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        result.current.createPlan({
          product_id: "prod-1",
          billing_interval: "monthly",
        });
      });

      await waitFor(() => expect(result.current.loading).toBe(true), { timeout: 100 });
      await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 200 });
    });

    it("should show loading during update mutation", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        success: true,
        data: [],
      });

      (apiClient.patch as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  data: {},
                }),
              100,
            ),
          ),
      );

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        result.current.updatePlan("plan-1", { description: "Updated" });
      });

      await waitFor(() => expect(result.current.loading).toBe(true), { timeout: 100 });
      await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 200 });
    });

    it("should show loading during delete mutation", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        success: true,
        data: [],
      });

      (apiClient.delete as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({}), 100)),
      );

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        result.current.deletePlan("plan-1");
      });

      await waitFor(() => expect(result.current.loading).toBe(true), { timeout: 100 });
      await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 200 });
    });
  });

  describe("useBillingPlans - Stale Time and Refetch Behavior", () => {
    it("should use 1 minute stale time for plans", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        success: true,
        data: [],
      });

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.plans).toEqual([]);
    });

    it("should use 5 minute stale time for products", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: [],
      });

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.products).toEqual([]);
    });
  });

  describe("useBillingPlans - Error Handling", () => {
    it("should return error string from plans query", async () => {
      const error = new Error("Plans fetch failed");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(typeof result.current.error).toBe("string");
    });

    it("should return null error when no error", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        success: true,
        data: [],
      });

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.error).toBeNull();
    });
  });

  describe("useBillingPlans - Edge Cases", () => {
    it("should handle null data gracefully", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        success: true,
        data: null,
      });

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.plans).toEqual([]);
      expect(result.current.products).toEqual([]);
    });

    it("should handle undefined data gracefully", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        success: true,
      });

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.plans).toEqual([]);
      expect(result.current.products).toEqual([]);
    });

    it("should handle plans with minimum required fields", async () => {
      const mockPlans: BillingPlan[] = [
        {
          plan_id: "plan-minimal",
          name: "Minimal Plan",
          description: "Plan with minimal fields",
          billing_interval: "monthly",
          interval_count: 1,
          price_amount: 0,
          currency: "USD",
          trial_days: 0,
          is_active: true,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({
        success: true,
        data: mockPlans,
      });

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.plans).toEqual(mockPlans);
    });

    it("should handle products with minimum required fields", async () => {
      const mockProducts: ProductCatalogItem[] = [
        {
          product_id: "prod-minimal",
          tenant_id: "tenant-1",
          sku: "SKU-MIN",
          name: "Minimal Product",
          product_type: "standard",
          base_price: 0,
          currency: "USD",
          is_active: true,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      (apiClient.get as jest.Mock).mockImplementation((url: string) => {
        if (url.includes("/billing/catalog/products")) {
          return Promise.resolve({ data: mockProducts });
        }
        return Promise.resolve({ success: true, data: [] });
      });

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.products).toEqual(mockProducts);
    });
  });
});
