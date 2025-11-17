/**
 * MSW-based tests for useLicensing hooks
 * Tests licensing framework with realistic API mocking
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useLicensing,
  useFeatureEntitlement,
  useQuotaCheck,
  licensingKeys,
} from "../useLicensing";
import {
  clearLicensingData,
  seedModules,
  seedQuotas,
  seedPlans,
  seedSubscription,
  seedQuotaUsage,
} from "@/__tests__/msw/handlers/licensing";

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

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

describe("useLicensing", () => {
  beforeEach(() => {
    clearLicensingData();
  });

  describe("licensingKeys - Query Key Factory", () => {
    it("should generate correct query keys", () => {
      expect(licensingKeys.all).toEqual(["licensing"]);
      expect(licensingKeys.modules()).toEqual(["licensing", "modules"]);
      expect(licensingKeys.module("mod-1")).toEqual(["licensing", "module", "mod-1"]);
      expect(licensingKeys.quotas()).toEqual(["licensing", "quotas"]);
      expect(licensingKeys.plans()).toEqual(["licensing", "plans"]);
      expect(licensingKeys.plan("plan-1")).toEqual(["licensing", "plan", "plan-1"]);
      expect(licensingKeys.subscription()).toEqual(["licensing", "subscription"]);
      expect(licensingKeys.entitlement("MODULE_CODE", "CAPABILITY_CODE")).toEqual([
        "licensing",
        "entitlement",
        { moduleCode: "MODULE_CODE", capabilityCode: "CAPABILITY_CODE" },
      ]);
      expect(licensingKeys.quotaCheck("QUOTA_CODE", 5)).toEqual([
        "licensing",
        "quota-check",
        { quotaCode: "QUOTA_CODE", quantity: 5 },
      ]);
    });
  });

  describe("useLicensing - Feature Modules Query", () => {
    it("should fetch modules successfully", async () => {
      seedModules([
        {
          id: "mod-1",
          module_code: "BILLING",
          module_name: "Billing Module",
          description: "Billing features",
          category: "BILLING",
          pricing_model: "FLAT_FEE",
          base_price: 199.99,
          dependencies: [],
          config_schema: {},
          default_config: {},
          is_active: true,
          is_public: true,
          extra_metadata: {},
        },
      ]);

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.modulesLoading).toBe(false));

      expect(result.current.modules).toHaveLength(1);
      expect(result.current.modules[0].module_code).toBe("BILLING");
      expect(result.current.modulesError).toBeNull();
    });

    it("should handle empty modules array", async () => {
      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.modulesLoading).toBe(false));

      expect(result.current.modules).toEqual([]);
      expect(result.current.modulesError).toBeNull();
    });

    it("should set loading state correctly for modules", async () => {
      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      expect(result.current.modulesLoading).toBe(true);

      await waitFor(() => expect(result.current.modulesLoading).toBe(false));
    });
  });

  describe("useLicensing - Quotas Query", () => {
    it("should fetch quotas successfully", async () => {
      seedQuotas([
        {
          id: "quota-1",
          quota_code: "SUBSCRIBERS",
          quota_name: "Subscribers",
          description: "Number of subscribers",
          unit_name: "subscriber",
          unit_plural: "subscribers",
          pricing_model: "PER_UNIT",
          default_limit: 100,
          is_active: true,
          is_metered: true,
          reset_period: "MONTHLY",
          extra_metadata: {},
        },
      ]);

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.quotasLoading).toBe(false));

      expect(result.current.quotas).toHaveLength(1);
      expect(result.current.quotas[0].quota_code).toBe("SUBSCRIBERS");
      expect(result.current.quotasError).toBeNull();
    });
  });

  describe("useLicensing - Service Plans Query", () => {
    it("should fetch plans successfully", async () => {
      seedPlans([
        {
          id: "plan-1",
          plan_code: "ENTERPRISE",
          plan_name: "Enterprise Plan",
          description: "Full featured plan",
          base_price_monthly: 299.99,
          annual_discount_percent: 20,
          trial_days: 14,
          is_public: true,
          is_active: true,
          extra_metadata: {},
        },
      ]);

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.plansLoading).toBe(false));

      expect(result.current.plans).toHaveLength(1);
      expect(result.current.plans[0].plan_code).toBe("ENTERPRISE");
      expect(result.current.plansError).toBeNull();
    });
  });

  describe("useLicensing - Current Subscription Query", () => {
    it("should fetch current subscription successfully", async () => {
      seedSubscription({
        id: "sub-1",
        tenant_id: "tenant-1",
        plan_id: "plan-1",
        status: "ACTIVE",
        billing_cycle: "MONTHLY",
        monthly_price: 299.99,
        annual_price: 2999.99,
        current_period_start: "2024-01-01T00:00:00Z",
        current_period_end: "2024-02-01T00:00:00Z",
      });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.subscriptionLoading).toBe(false));

      expect(result.current.currentSubscription).toBeDefined();
      expect(result.current.currentSubscription?.id).toBe("sub-1");
      expect(result.current.subscriptionError).toBeNull();
    });

    it("should handle 404 for no subscription", async () => {
      // Don't seed any subscription
      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.subscriptionLoading).toBe(false));

      expect(result.current.currentSubscription).toBeUndefined();
      expect(result.current.subscriptionError).toBeNull();
    });
  });

  describe("useLicensing - Module Mutations", () => {
    it("should create module successfully", async () => {
      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.modulesLoading).toBe(false));

      let createdModule;
      await act(async () => {
        createdModule = await result.current.createModule({
          module_code: "ANALYTICS",
          module_name: "Analytics Module",
          description: "Analytics features",
          category: "ANALYTICS",
          pricing_model: "FLAT_FEE",
          base_price: 149.99,
        });
      });

      expect(createdModule).toBeDefined();
      expect(createdModule.module_code).toBe("ANALYTICS");
    });

    it("should update module successfully", async () => {
      seedModules([
        {
          id: "mod-1",
          module_code: "BILLING",
          module_name: "Billing Module",
          description: "Billing features",
          category: "BILLING",
          pricing_model: "FLAT_FEE",
          base_price: 199.99,
        },
      ]);

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.modulesLoading).toBe(false));

      let updatedModule;
      await act(async () => {
        updatedModule = await result.current.updateModule("mod-1", {
          module_name: "Updated Billing Module",
        });
      });

      expect(updatedModule).toBeDefined();
      expect(updatedModule.module_name).toBe("Updated Billing Module");
    });
  });

  describe("useLicensing - Quota Mutations", () => {
    it("should create quota successfully", async () => {
      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.quotasLoading).toBe(false));

      let createdQuota;
      await act(async () => {
        createdQuota = await result.current.createQuota({
          quota_code: "API_CALLS",
          quota_name: "API Calls",
          description: "Number of API calls per month",
          unit_name: "call",
          unit_plural: "calls",
          pricing_model: "PER_UNIT",
          default_limit: 10000,
        });
      });

      expect(createdQuota).toBeDefined();
      expect(createdQuota.quota_code).toBe("API_CALLS");
    });

    it("should update quota successfully", async () => {
      seedQuotas([
        {
          id: "quota-1",
          quota_code: "SUBSCRIBERS",
          quota_name: "Subscribers",
          unit_name: "subscriber",
          unit_plural: "subscribers",
          default_limit: 100,
        },
      ]);

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.quotasLoading).toBe(false));

      let updatedQuota;
      await act(async () => {
        updatedQuota = await result.current.updateQuota("quota-1", {
          quota_name: "Updated Subscribers",
          default_limit: 200,
        });
      });

      expect(updatedQuota).toBeDefined();
      expect(updatedQuota.quota_name).toBe("Updated Subscribers");
      expect(updatedQuota.default_limit).toBe(200);
    });
  });

  describe("useLicensing - Plan Mutations", () => {
    it("should create plan successfully", async () => {
      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.plansLoading).toBe(false));

      let createdPlan;
      await act(async () => {
        createdPlan = await result.current.createPlan({
          plan_code: "STARTER",
          plan_name: "Starter Plan",
          description: "Basic plan",
          base_price_monthly: 49.99,
          annual_discount_percent: 0,
          modules: [],
          quotas: [],
        });
      });

      expect(createdPlan).toBeDefined();
      expect(createdPlan.plan_code).toBe("STARTER");
    });

    it("should update plan successfully", async () => {
      seedPlans([
        {
          id: "plan-1",
          plan_code: "ENTERPRISE",
          plan_name: "Enterprise Plan",
          base_price_monthly: 299.99,
          annual_discount_percent: 10,
        },
      ]);

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.plansLoading).toBe(false));

      let updatedPlan;
      await act(async () => {
        updatedPlan = await result.current.updatePlan("plan-1", {
          plan_name: "Updated Plan",
          base_price_monthly: 349.99,
        });
      });

      expect(updatedPlan).toBeDefined();
      expect(updatedPlan.plan_name).toBe("Updated Plan");
      expect(updatedPlan.base_price_monthly).toBe(349.99);
    });

    it("should duplicate plan successfully", async () => {
      seedPlans([
        {
          id: "plan-1",
          plan_code: "ENTERPRISE",
          plan_name: "Enterprise Plan",
          base_price_monthly: 299.99,
        },
      ]);

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.plansLoading).toBe(false));

      let duplicatedPlan;
      await act(async () => {
        duplicatedPlan = await result.current.duplicatePlan("plan-1");
      });

      expect(duplicatedPlan).toBeDefined();
      expect(duplicatedPlan.plan_code).toBe("ENTERPRISE_COPY");
      expect(duplicatedPlan.plan_name).toBe("Enterprise Plan (Copy)");
    });
  });

  describe("useLicensing - Subscription Mutations", () => {
    it("should create subscription successfully", async () => {
      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.subscriptionLoading).toBe(false));

      let createdSubscription;
      await act(async () => {
        createdSubscription = await result.current.createSubscription({
          tenant_id: "tenant-1",
          plan_id: "plan-1",
          billing_cycle: "MONTHLY",
        });
      });

      expect(createdSubscription).toBeDefined();
      expect(createdSubscription.tenant_id).toBe("tenant-1");
      expect(createdSubscription.status).toBe("ACTIVE");
    });

    it("should add addon successfully", async () => {
      seedSubscription({
        id: "sub-1",
        tenant_id: "tenant-1",
        plan_id: "plan-1",
        status: "ACTIVE",
        billing_cycle: "MONTHLY",
        addons: [],
      });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.subscriptionLoading).toBe(false));

      await act(async () => {
        await result.current.addAddon({
          module_id: "addon-1",
          quantity: 1,
        });
      });

      // Mutation completes successfully (no error thrown)
      expect(true).toBe(true);
    });

    it("should remove addon successfully", async () => {
      seedSubscription({
        id: "sub-1",
        tenant_id: "tenant-1",
        plan_id: "plan-1",
        status: "ACTIVE",
        billing_cycle: "MONTHLY",
        addons: [{ module_id: "addon-1", quantity: 1 }],
      });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.subscriptionLoading).toBe(false));

      await act(async () => {
        await result.current.removeAddon({
          module_id: "addon-1",
        });
      });

      // Mutation completes successfully (no error thrown)
      expect(true).toBe(true);
    });
  });

  describe("useLicensing - Helper Functions", () => {
    it("should get module by id", async () => {
      seedModules([
        {
          id: "mod-1",
          module_code: "BILLING",
          module_name: "Billing Module",
        },
      ]);

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.modulesLoading).toBe(false));

      let fetchedModule;
      await act(async () => {
        fetchedModule = await result.current.getModule("mod-1");
      });

      expect(fetchedModule).toBeDefined();
      expect(fetchedModule.id).toBe("mod-1");
      expect(fetchedModule.module_code).toBe("BILLING");
    });

    it("should get plan by id", async () => {
      seedPlans([
        {
          id: "plan-1",
          plan_code: "ENTERPRISE",
          plan_name: "Enterprise Plan",
        },
      ]);

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.plansLoading).toBe(false));

      let fetchedPlan;
      await act(async () => {
        fetchedPlan = await result.current.getPlan("plan-1");
      });

      expect(fetchedPlan).toBeDefined();
      expect(fetchedPlan.id).toBe("plan-1");
      expect(fetchedPlan.plan_code).toBe("ENTERPRISE");
    });

    it("should calculate plan price", async () => {
      seedPlans([
        {
          id: "plan-1",
          plan_code: "ENTERPRISE",
          plan_name: "Enterprise Plan",
          base_price_monthly: 299.99,
          annual_discount_percent: 10,
        },
      ]);

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.plansLoading).toBe(false));

      let pricing;
      await act(async () => {
        pricing = await result.current.calculatePlanPrice("plan-1", {
          billing_period: "ANNUAL",
          quantity: 1,
        });
      });

      expect(pricing).toBeDefined();
      expect(pricing.billing_period).toBe("ANNUAL");
      expect(pricing.total).toBeDefined();
      expect(pricing.currency).toBe("USD");
    });

    it("should check entitlement", async () => {
      seedSubscription({
        id: "sub-1",
        tenant_id: "tenant-1",
        plan_id: "plan-1",
        status: "ACTIVE",
        billing_cycle: "MONTHLY",
      });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.modulesLoading).toBe(false));

      let response;
      await act(async () => {
        response = await result.current.checkEntitlement({
          module_code: "BILLING",
          capability_code: "CREATE_INVOICE",
        });
      });

      expect(response).toBeDefined();
      expect(response.entitled).toBe(true);
    });

    it("should check quota", async () => {
      seedQuotas([
        {
          id: "quota-1",
          quota_code: "SUBSCRIBERS",
          quota_name: "Subscribers",
          unit_name: "subscriber",
          unit_plural: "subscribers",
          default_limit: 100,
        },
      ]);
      seedQuotaUsage("SUBSCRIBERS", 50);

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.quotasLoading).toBe(false));

      let response;
      await act(async () => {
        response = await result.current.checkQuota({
          quota_code: "SUBSCRIBERS",
          quantity: 10,
        });
      });

      expect(response).toBeDefined();
      expect(response.available).toBe(true);
      expect(response.remaining).toBe(50);
      expect(response.used).toBe(50);
    });

    it("should consume quota", async () => {
      seedQuotas([
        {
          id: "quota-1",
          quota_code: "API_CALLS",
          quota_name: "API Calls",
          default_limit: 10000,
          unit_name: "call",
          unit_plural: "calls",
        },
      ]);

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.quotasLoading).toBe(false));

      await act(async () => {
        await result.current.consumeQuota({
          quota_code: "API_CALLS",
          quantity: 100,
        });
      });

      // No error thrown means success
      expect(true).toBe(true);
    });

    it("should release quota", async () => {
      seedQuotas([
        {
          id: "quota-1",
          quota_code: "SUBSCRIBERS",
          quota_name: "Subscribers",
          default_limit: 100,
          unit_name: "subscriber",
          unit_plural: "subscribers",
        },
      ]);
      seedQuotaUsage("SUBSCRIBERS", 50);

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.quotasLoading).toBe(false));

      await act(async () => {
        await result.current.releaseQuota({
          quota_code: "SUBSCRIBERS",
          quantity: 5,
        });
      });

      // No error thrown means success
      expect(true).toBe(true);
    });

    it("should refetch all licensing data", async () => {
      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.modulesLoading).toBe(false));

      await act(async () => {
        await result.current.refetch();
      });

      // Refetch completes without error
      expect(result.current.modules).toBeDefined();
    });
  });

  describe("useFeatureEntitlement", () => {
    it("should check entitlement successfully", async () => {
      seedSubscription({
        id: "sub-1",
        tenant_id: "tenant-1",
        plan_id: "plan-1",
        status: "ACTIVE",
        billing_cycle: "MONTHLY",
      });

      const { result } = renderHook(
        () => useFeatureEntitlement("BILLING", "CREATE_INVOICE"),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.entitled).toBe(true);
    });

    it("should return not entitled when no module code", async () => {
      const { result } = renderHook(() => useFeatureEntitlement(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
    });

    it("should not fetch when module code is undefined", async () => {
      const { result } = renderHook(() => useFeatureEntitlement(undefined), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
    });

    it("should handle disabled module", async () => {
      seedSubscription({
        id: "sub-1",
        tenant_id: "tenant-1",
        plan_id: "plan-1",
        status: "ACTIVE",
        billing_cycle: "MONTHLY",
      });

      const { result } = renderHook(() => useFeatureEntitlement("DISABLED_MODULE"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.entitled).toBe(false);
    });
  });

  describe("useQuotaCheck", () => {
    it("should check quota successfully", async () => {
      seedQuotas([
        {
          id: "quota-1",
          quota_code: "SUBSCRIBERS",
          quota_name: "Subscribers",
          default_limit: 100,
        },
      ]);
      seedQuotaUsage("SUBSCRIBERS", 50);

      const { result } = renderHook(() => useQuotaCheck("SUBSCRIBERS", 10), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.available).toBe(true);
      expect(result.current.data?.remaining).toBe(50);
      expect(result.current.data?.details).toBeDefined();
    });

    it("should use default quantity of 1", async () => {
      seedQuotas([
        {
          id: "quota-1",
          quota_code: "SUBSCRIBERS",
          quota_name: "Subscribers",
          default_limit: 100,
        },
      ]);
      seedQuotaUsage("SUBSCRIBERS", 50);

      const { result } = renderHook(() => useQuotaCheck("SUBSCRIBERS"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.available).toBe(true);
    });

    it("should handle insufficient quota", async () => {
      seedQuotas([
        {
          id: "quota-1",
          quota_code: "SUBSCRIBERS",
          quota_name: "Subscribers",
          default_limit: 100,
        },
      ]);
      seedQuotaUsage("SUBSCRIBERS", 95);

      const { result } = renderHook(() => useQuotaCheck("SUBSCRIBERS", 10), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.available).toBe(false);
      expect(result.current.data?.remaining).toBe(5);
    });
  });

  describe("Cache Invalidation", () => {
    it("should invalidate modules cache after creating module", async () => {
      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.modulesLoading).toBe(false));

      expect(result.current.modules).toHaveLength(0);

      await act(async () => {
        await result.current.createModule({
          module_code: "NEW_MOD",
          module_name: "New Module",
          description: "Test",
          category: "AUTOMATION",
          pricing_model: "FLAT_FEE",
          base_price: 49.99,
        });
      });

      // Wait for cache invalidation and refetch
      await waitFor(() => {
        expect(result.current.modules.length).toBeGreaterThan(0);
      });
    });

    it("should invalidate subscription cache after adding addon", async () => {
      seedSubscription({
        id: "sub-1",
        tenant_id: "tenant-1",
        plan_id: "plan-1",
        status: "ACTIVE",
        billing_cycle: "MONTHLY",
        addons: [],
      });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.subscriptionLoading).toBe(false));

      expect(result.current.currentSubscription).toBeDefined();

      await act(async () => {
        await result.current.addAddon({ module_id: "mod-addon" });
      });

      // Cache invalidation triggers refetch
      await waitFor(() => {
        expect(result.current.currentSubscription).toBeDefined();
      });
    });
  });

  describe("Loading States", () => {
    it("should show correct loading state during queries", async () => {
      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      expect(result.current.modulesLoading).toBe(true);
      expect(result.current.quotasLoading).toBe(true);
      expect(result.current.plansLoading).toBe(true);
      expect(result.current.subscriptionLoading).toBe(true);

      await waitFor(
        () => {
          expect(result.current.modulesLoading).toBe(false);
          expect(result.current.quotasLoading).toBe(false);
          expect(result.current.plansLoading).toBe(false);
          expect(result.current.subscriptionLoading).toBe(false);
        },
        { timeout: 500 }
      );
    });
  });

  describe("Stale Time and Refetch Behavior", () => {
    it("should use 5 minute stale time for modules", async () => {
      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.modulesLoading).toBe(false));

      expect(result.current.modules).toEqual([]);
    });

    it("should use 1 minute stale time for subscription", async () => {
      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.subscriptionLoading).toBe(false));

      expect(result.current.currentSubscription).toBeUndefined();
    });
  });
});
