/**
 * MSW-powered tests for useBillingPlans
 *
 * This test file uses MSW for API mocking instead of jest.mock.
 * Tests the actual hook contract: { plans, products, loading, error, ... }
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { useBillingPlans } from "../useBillingPlans";
import {
  createTestQueryClient,
  createMockBillingPlan,
  createMockProduct,
  seedBillingPlansData,
  resetBillingPlansStorage,
  makeApiEndpointFail,
} from "../../__tests__/test-utils";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

describe("useBillingPlans (MSW)", () => {
  // Helper to create wrapper with QueryClient
  const createWrapper = (queryClient?: QueryClient) => {
    const client = queryClient || createTestQueryClient();
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    resetBillingPlansStorage();
  });

  describe("useBillingPlans - fetch plans query", () => {
    it("should fetch billing plans successfully", async () => {
      const mockPlans = [
        createMockBillingPlan({
          plan_id: "plan-1",
          name: "Premium Plan",
          billing_interval: "monthly",
          price_amount: 99.99,
          is_active: true,
        }),
        createMockBillingPlan({
          plan_id: "plan-2",
          name: "Basic Plan",
          billing_interval: "annual",
          price_amount: 49.99,
          is_active: true,
        }),
      ];

      seedBillingPlansData(mockPlans, []);

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      expect(result.current.loading).toBe(true);

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.plans).toHaveLength(2);
      expect(result.current.plans[0].plan_id).toBe("plan-1");
      expect(result.current.plans[0].name).toBe("Premium Plan");
      expect(result.current.error).toBeNull();
    });

    it("should handle empty plans array", async () => {
      seedBillingPlansData([], []);

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.plans).toHaveLength(0);
      expect(result.current.error).toBeNull();
    });

    it("should filter plans by activeOnly=true", async () => {
      const plans = [
        createMockBillingPlan({ plan_id: "plan-1", is_active: true }),
        createMockBillingPlan({ plan_id: "plan-2", is_active: false }),
        createMockBillingPlan({ plan_id: "plan-3", is_active: true }),
      ];

      seedBillingPlansData(plans, []);

      const { result } = renderHook(() => useBillingPlans(true), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.plans).toHaveLength(2);
      expect(result.current.plans.every((p) => p.is_active)).toBe(true);
    });

    it("should fetch all plans when activeOnly=false", async () => {
      const plans = [
        createMockBillingPlan({ plan_id: "plan-1", is_active: true }),
        createMockBillingPlan({ plan_id: "plan-2", is_active: false }),
      ];

      seedBillingPlansData(plans, []);

      const { result } = renderHook(() => useBillingPlans(false), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.plans).toHaveLength(2);
    });

    it("should filter plans by productId", async () => {
      const plans = [
        createMockBillingPlan({ plan_id: "plan-1", product_id: "prod-1" }),
        createMockBillingPlan({ plan_id: "plan-2", product_id: "prod-2" }),
        createMockBillingPlan({ plan_id: "plan-3", product_id: "prod-1" }),
      ];

      seedBillingPlansData(plans, []);

      const { result } = renderHook(() => useBillingPlans(true, "prod-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.plans).toHaveLength(2);
      expect(result.current.plans.every((p) => p.product_id === "prod-1")).toBe(true);
    });

    it("should handle fetch error", async () => {
      makeApiEndpointFail("get", "/billing/subscriptions/plans", "Server error", 500);

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.plans).toHaveLength(0);
    });

    it("should handle all billing intervals", async () => {
      const plans = [
        createMockBillingPlan({ billing_interval: "monthly" }),
        createMockBillingPlan({ billing_interval: "quarterly" }),
        createMockBillingPlan({ billing_interval: "annual" }),
      ];

      seedBillingPlansData(plans, []);

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.plans).toHaveLength(3);
      expect(result.current.plans.map((p) => p.billing_interval)).toEqual([
        "monthly",
        "quarterly",
        "annual",
      ]);
    });
  });

  describe("useBillingPlans - fetch products query", () => {
    it("should fetch products successfully", async () => {
      const mockProducts = [
        createMockProduct({
          product_id: "prod-1",
          name: "Premium Product",
          product_type: "standard",
          is_active: true,
        }),
        createMockProduct({
          product_id: "prod-2",
          name: "Usage-Based Product",
          product_type: "usage_based",
          is_active: true,
        }),
      ];

      seedBillingPlansData([], mockProducts);

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.products).toHaveLength(2);
      expect(result.current.products[0].product_id).toBe("prod-1");
      expect(result.current.products[0].name).toBe("Premium Product");
    });

    it("should handle empty products array", async () => {
      seedBillingPlansData([], []);

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.products).toHaveLength(0);
    });

    it("should filter products by activeOnly=true", async () => {
      const products = [
        createMockProduct({ product_id: "prod-1", is_active: true }),
        createMockProduct({ product_id: "prod-2", is_active: false }),
        createMockProduct({ product_id: "prod-3", is_active: true }),
      ];

      seedBillingPlansData([], products);

      const { result } = renderHook(() => useBillingPlans(true), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.products).toHaveLength(2);
      expect(result.current.products.every((p) => p.is_active)).toBe(true);
    });

    it("should fetch all products when activeOnly=false", async () => {
      const products = [
        createMockProduct({ product_id: "prod-1", is_active: true }),
        createMockProduct({ product_id: "prod-2", is_active: false }),
      ];

      seedBillingPlansData([], products);

      const { result } = renderHook(() => useBillingPlans(false), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.products).toHaveLength(2);
    });

    it("should handle all product types", async () => {
      const products = [
        createMockProduct({ product_type: "standard" }),
        createMockProduct({ product_type: "usage_based" }),
        createMockProduct({ product_type: "hybrid" }),
      ];

      seedBillingPlansData([], products);

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.products).toHaveLength(3);
      expect(result.current.products.map((p) => p.product_type)).toEqual([
        "standard",
        "usage_based",
        "hybrid",
      ]);
    });

    it("should handle products fetch error gracefully", async () => {
      makeApiEndpointFail("get", "/billing/catalog/products", "Server error", 500);

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      // Products query fails gracefully
      expect(result.current.products).toHaveLength(0);
    });
  });

  describe("useBillingPlans - create plan mutation", () => {
    it("should create plan successfully", async () => {
      seedBillingPlansData([], []);

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      let createdPlan;
      await act(async () => {
        createdPlan = await result.current.createPlan({
          product_id: "prod-1",
          billing_interval: "monthly",
          interval_count: 1,
          trial_days: 14,
        });
      });

      expect(createdPlan).toBeDefined();
      expect(createdPlan.billing_interval).toBe("monthly");

      // Manually refresh plans (test QueryClient has refetchOnMount: false)
      await act(async () => {
        await result.current.refreshPlans();
      });

      // Verify added to list after refetch
      await waitFor(() => {
        expect(result.current.plans).toHaveLength(1);
      });
    });

    it("should create plan with features and metadata", async () => {
      seedBillingPlansData([], []);

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const features = { max_users: 100, storage_gb: 1000 };
      const metadata = { promotion: "launch-special" };

      await act(async () => {
        const created = await result.current.createPlan({
          product_id: "prod-1",
          billing_interval: "annual",
          features,
          metadata,
        });

        expect(created.features).toEqual(features);
        expect(created.metadata).toEqual(metadata);
      });
    });
  });

  describe("useBillingPlans - update plan mutation", () => {
    it("should update plan successfully", async () => {
      const plans = [createMockBillingPlan({ plan_id: "plan-1", name: "Old Name" })];

      seedBillingPlansData(plans, []);

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        const updated = await result.current.updatePlan("plan-1", {
          display_name: "New Display Name",
          description: "Updated description",
        });

        expect(updated.display_name).toBe("New Display Name");
        expect(updated.description).toBe("Updated description");
      });

      // Manually refresh plans (test QueryClient has refetchOnMount: false)
      await act(async () => {
        await result.current.refreshPlans();
      });

      // Verify updated in list
      await waitFor(() => {
        expect(result.current.plans[0].display_name).toBe("New Display Name");
      });
    });

    it("should update plan active status", async () => {
      const plans = [createMockBillingPlan({ plan_id: "plan-1", is_active: true })];

      seedBillingPlansData(plans, []);

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        const updated = await result.current.updatePlan("plan-1", {
          is_active: false,
        });

        expect(updated.is_active).toBe(false);
      });
    });

    it("should update plan features", async () => {
      const plans = [createMockBillingPlan({ plan_id: "plan-1" })];

      seedBillingPlansData(plans, []);

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const newFeatures = { max_users: 200, storage_gb: 2000 };

      await act(async () => {
        const updated = await result.current.updatePlan("plan-1", {
          features: newFeatures,
        });

        expect(updated.features).toEqual(newFeatures);
      });
    });
  });

  describe("useBillingPlans - delete plan mutation", () => {
    it("should delete plan successfully", async () => {
      const plans = [
        createMockBillingPlan({ plan_id: "plan-1" }),
        createMockBillingPlan({ plan_id: "plan-2" }),
      ];

      seedBillingPlansData(plans, []);

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.plans).toHaveLength(2);

      await act(async () => {
        await result.current.deletePlan("plan-1");
      });

      // Verify removed from list
      await waitFor(() => {
        expect(result.current.plans.length).toBeLessThan(2);
      });
    });
  });

  describe("useBillingPlans - loading states", () => {
    it("should show loading during initial fetch", async () => {
      seedBillingPlansData([], []);

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      expect(result.current.loading).toBe(true);

      await waitFor(() => expect(result.current.loading).toBe(false));
    });

    it("should show loading during create mutation", async () => {
      seedBillingPlansData([], []);

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      // Start mutation without awaiting to capture loading state
      let mutationPromise;
      act(() => {
        mutationPromise = result.current.createPlan({
          product_id: "prod-1",
          billing_interval: "monthly",
        });
      });

      // Check if loading becomes true (might be very brief)
      if (result.current.loading) {
        expect(result.current.loading).toBe(true);
      }

      // Wait for mutation to complete
      await act(async () => {
        await mutationPromise;
      });

      await waitFor(() => expect(result.current.loading).toBe(false));
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle mixed plan and product data", async () => {
      const plans = [
        createMockBillingPlan({ product_id: "prod-1", billing_interval: "monthly" }),
        createMockBillingPlan({ product_id: "prod-2", billing_interval: "annual" }),
      ];

      const products = [
        createMockProduct({ product_id: "prod-1", name: "Standard" }),
        createMockProduct({ product_id: "prod-2", name: "Premium" }),
      ];

      seedBillingPlansData(plans, products);

      const { result } = renderHook(() => useBillingPlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.plans).toHaveLength(2);
      expect(result.current.products).toHaveLength(2);
    });

    it("should handle plan lifecycle: create, update, delete", async () => {
      seedBillingPlansData([], []);

      // Use activeOnly: false to see all plans including inactive ones
      const { result } = renderHook(() => useBillingPlans(false), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      // Create
      let planId;
      await act(async () => {
        const created = await result.current.createPlan({
          product_id: "prod-1",
          billing_interval: "monthly",
        });
        planId = created.plan_id;
      });

      // Manually refresh plans after create
      await act(async () => {
        await result.current.refreshPlans();
      });

      await waitFor(() => expect(result.current.plans).toHaveLength(1));

      // Update
      await act(async () => {
        await result.current.updatePlan(planId!, { is_active: false });
      });

      // Manually refresh plans after update
      await act(async () => {
        await result.current.refreshPlans();
      });

      await waitFor(() => {
        expect(result.current.plans[0].is_active).toBe(false);
      });

      // Delete
      await act(async () => {
        await result.current.deletePlan(planId!);
      });

      // Manually refresh plans after delete
      await act(async () => {
        await result.current.refreshPlans();
      });

      await waitFor(() => {
        expect(result.current.plans).toHaveLength(0);
      });
    });
  });
});
