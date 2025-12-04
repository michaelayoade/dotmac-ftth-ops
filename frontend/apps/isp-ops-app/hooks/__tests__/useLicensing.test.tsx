/**
 * Unit tests for useLicensing hooks
 * Uses Jest mocks for fast, isolated testing
 *
 * Note: For integration tests with real API mocking, see useLicensing.msw.test.tsx
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLicensing, useFeatureEntitlement, useQuotaCheck, licensingKeys } from "../useLicensing";
import { apiClient } from "../../lib/api/client";
import type {
  FeatureModule,
  QuotaDefinition,
  ServicePlan,
  TenantSubscription,
  CheckEntitlementResponse,
  CheckQuotaResponse,
} from "../../types/licensing";

// Mock the API client
jest.mock("../../lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

// Mock logger
jest.mock("../../lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

// Helper to mock all GET requests that useLicensing makes on mount
const mockAllQueries = (
  overrides: {
    modules?: any;
    quotas?: any;
    plans?: any;
    subscription?: any;
  } = {},
) => {
  mockApiClient.get.mockImplementation((url: string) => {
    if (url.includes("/licensing/modules")) {
      return Promise.resolve({ data: overrides.modules ?? [] });
    }
    if (url.includes("/licensing/quotas")) {
      return Promise.resolve({ data: overrides.quotas ?? [] });
    }
    if (url.includes("/licensing/plans")) {
      return Promise.resolve({ data: overrides.plans ?? [] });
    }
    if (url === "/licensing/subscriptions/current") {
      if (overrides.subscription === "404") {
        return Promise.reject({ response: { status: 404 } });
      }
      if (overrides.subscription === null) {
        return Promise.resolve({ data: null });
      }
      return Promise.resolve({ data: overrides.subscription });
    }
    return Promise.resolve({ data: [] });
  });
};

// Test wrapper with QueryClient
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

describe("useLicensing - Unit Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: mock all queries to return empty arrays
    mockAllQueries();
  });

  describe("Query Key Factory", () => {
    it("should generate correct base key", () => {
      expect(licensingKeys.all).toEqual(["licensing"]);
    });

    it("should generate correct modules key", () => {
      expect(licensingKeys.modules()).toEqual(["licensing", "modules", 0, 100]);
      expect(licensingKeys.modules(10, 50)).toEqual(["licensing", "modules", 10, 50]);
    });

    it("should generate correct module detail key", () => {
      expect(licensingKeys.module("mod-123")).toEqual(["licensing", "module", "mod-123"]);
    });

    it("should generate correct quotas key", () => {
      expect(licensingKeys.quotas()).toEqual(["licensing", "quotas", 0, 100]);
      expect(licensingKeys.quotas(20, 50)).toEqual(["licensing", "quotas", 20, 50]);
    });

    it("should generate correct plans key", () => {
      expect(licensingKeys.plans()).toEqual(["licensing", "plans", 0, 100]);
      expect(licensingKeys.plans(0, 50)).toEqual(["licensing", "plans", 0, 50]);
    });

    it("should generate correct plan detail key", () => {
      expect(licensingKeys.plan("plan-456")).toEqual(["licensing", "plan", "plan-456"]);
    });

    it("should generate correct subscription key", () => {
      expect(licensingKeys.subscription()).toEqual(["licensing", "subscription"]);
    });

    it("should generate correct entitlement key", () => {
      expect(licensingKeys.entitlement("MODULE", "CAPABILITY")).toEqual([
        "licensing",
        "entitlement",
        { moduleCode: "MODULE", capabilityCode: "CAPABILITY" },
      ]);
    });

    it("should generate correct quota check key", () => {
      expect(licensingKeys.quotaCheck("QUOTA", 10)).toEqual([
        "licensing",
        "quota-check",
        { quotaCode: "QUOTA", quantity: 10 },
      ]);
    });
  });

  describe("useLicensing - Modules Query", () => {
    it("should fetch modules successfully", async () => {
      const mockModules: FeatureModule[] = [
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
      ];

      mockAllQueries({ modules: mockModules });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.modulesLoading).toBe(false));

      expect(result.current.modules).toEqual(mockModules);
      expect(result.current.modulesError).toBeNull();
      expect(mockApiClient.get).toHaveBeenCalledWith("/licensing/modules?offset=0&limit=100");
    });

    it("should handle empty modules array", async () => {
      mockAllQueries({ modules: [] });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.modulesLoading).toBe(false));

      expect(result.current.modules).toEqual([]);
      expect(result.current.modulesError).toBeNull();
    });

    it("should handle modules fetch error", async () => {
      const error = new Error("Network error");
      mockApiClient.get.mockImplementation((url: string) => {
        if (url.includes("/licensing/modules")) {
          return Promise.reject(error);
        }
        return Promise.resolve({ data: [] });
      });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.modulesLoading).toBe(false));

      expect(result.current.modulesError).toBeTruthy();
      expect(result.current.modules).toEqual([]);
    });

    it("should show loading state during fetch", async () => {
      mockApiClient.get.mockImplementation((url: string) => {
        return new Promise((resolve) => setTimeout(() => resolve({ data: [] }), 100));
      });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      expect(result.current.modulesLoading).toBe(true);

      await waitFor(() => expect(result.current.modulesLoading).toBe(false));
    });
  });

  describe("useLicensing - Quotas Query", () => {
    it("should fetch quotas successfully", async () => {
      const mockQuotas: QuotaDefinition[] = [
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
      ];

      mockAllQueries({ quotas: mockQuotas });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.quotasLoading).toBe(false));

      expect(result.current.quotas).toEqual(mockQuotas);
      expect(mockApiClient.get).toHaveBeenCalledWith("/licensing/quotas?offset=0&limit=100");
    });

    it("should handle quotas fetch error", async () => {
      mockApiClient.get.mockImplementation((url: string) => {
        if (url.includes("/licensing/quotas")) {
          return Promise.reject(new Error("Server error"));
        }
        return Promise.resolve({ data: [] });
      });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.quotasLoading).toBe(false));

      expect(result.current.quotasError).toBeTruthy();
      expect(result.current.quotas).toEqual([]);
    });
  });

  describe("useLicensing - Plans Query", () => {
    it("should fetch plans successfully", async () => {
      const mockPlans: ServicePlan[] = [
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
      ];

      mockAllQueries({ plans: mockPlans });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.plansLoading).toBe(false));

      expect(result.current.plans).toEqual(mockPlans);
      expect(mockApiClient.get).toHaveBeenCalledWith("/licensing/plans?offset=0&limit=100");
    });

    it("should handle plans fetch error", async () => {
      mockApiClient.get.mockImplementation((url: string) => {
        if (url.includes("/licensing/plans")) {
          return Promise.reject(new Error("Server error"));
        }
        return Promise.resolve({ data: [] });
      });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.plansLoading).toBe(false));

      expect(result.current.plansError).toBeTruthy();
      expect(result.current.plans).toEqual([]);
    });
  });

  describe("useLicensing - Subscription Query", () => {
    it("should fetch current subscription successfully", async () => {
      const mockSubscription: TenantSubscription = {
        id: "sub-1",
        tenant_id: "tenant-1",
        plan_id: "plan-1",
        status: "ACTIVE",
        billing_cycle: "MONTHLY",
        monthly_price: 299.99,
        annual_price: 2999.99,
        current_period_start: "2024-01-01T00:00:00Z",
        current_period_end: "2024-02-01T00:00:00Z",
      };

      mockAllQueries({ subscription: mockSubscription });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.subscriptionLoading).toBe(false));

      expect(result.current.currentSubscription).toEqual(mockSubscription);
      expect(mockApiClient.get).toHaveBeenCalledWith("/licensing/subscriptions/current");
    });

    it("should handle 404 for no subscription", async () => {
      // Mock all GET requests to return empty initially
      mockApiClient.get.mockImplementation((url) => {
        if (url === "/licensing/subscriptions/current") {
          return Promise.reject({ response: { status: 404 } });
        }
        return Promise.resolve({ data: [] });
      });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.subscriptionLoading).toBe(false));

      // 404 should return undefined (subscription not added to return object), and no error
      expect(result.current.currentSubscription).toBeUndefined();
      expect(result.current.subscriptionError).toBeNull();
    });

    it("should handle non-404 subscription errors", async () => {
      // Mock all GET requests
      mockApiClient.get.mockImplementation((url) => {
        if (url === "/licensing/subscriptions/current") {
          return Promise.reject({ response: { status: 500 } });
        }
        return Promise.resolve({ data: [] });
      });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.subscriptionLoading).toBe(false));

      // Non-404 errors should be captured
      expect(result.current.subscriptionError).toBeTruthy();
    });
  });

  describe("useLicensing - Module Mutations", () => {
    it("should create module successfully", async () => {
      const newModule: FeatureModule = {
        id: "mod-new",
        module_code: "ANALYTICS",
        module_name: "Analytics Module",
        description: "Analytics features",
        category: "ANALYTICS",
        pricing_model: "FLAT_FEE",
        base_price: 149.99,
      };

      mockApiClient.get.mockResolvedValue({ data: [] }); // Initial fetch
      mockApiClient.post.mockResolvedValueOnce({ data: newModule });

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

      expect(createdModule).toEqual(newModule);
      expect(mockApiClient.post).toHaveBeenCalledWith("/licensing/modules", expect.any(Object));
    });

    it("should update module successfully", async () => {
      const updatedModule: FeatureModule = {
        id: "mod-1",
        module_code: "BILLING",
        module_name: "Updated Billing Module",
        description: "Updated description",
        category: "BILLING",
        pricing_model: "FLAT_FEE",
        base_price: 249.99,
      };

      mockApiClient.get.mockResolvedValue({ data: [] });
      mockApiClient.patch.mockResolvedValueOnce({ data: updatedModule });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.modulesLoading).toBe(false));

      let updated;
      await act(async () => {
        updated = await result.current.updateModule("mod-1", {
          module_name: "Updated Billing Module",
          base_price: 249.99,
        });
      });

      expect(updated).toEqual(updatedModule);
      expect(mockApiClient.patch).toHaveBeenCalledWith(
        "/licensing/modules/mod-1",
        expect.any(Object),
      );
    });

    it("should handle create module error", async () => {
      mockApiClient.get.mockResolvedValue({ data: [] });
      mockApiClient.post.mockRejectedValueOnce(new Error("Validation error"));

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.modulesLoading).toBe(false));

      await expect(
        result.current.createModule({
          module_code: "INVALID",
          module_name: "Invalid",
          description: "Test",
          category: "BILLING",
          pricing_model: "FLAT_FEE",
          base_price: -100,
        }),
      ).rejects.toThrow();
    });
  });

  describe("useLicensing - Quota Mutations", () => {
    it("should create quota successfully", async () => {
      const newQuota: QuotaDefinition = {
        id: "quota-new",
        quota_code: "API_CALLS",
        quota_name: "API Calls",
        description: "API calls per month",
        unit_name: "call",
        unit_plural: "calls",
        pricing_model: "PER_UNIT",
        default_limit: 10000,
      };

      mockApiClient.get.mockResolvedValue({ data: [] });
      mockApiClient.post.mockResolvedValueOnce({ data: newQuota });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.quotasLoading).toBe(false));

      let created;
      await act(async () => {
        created = await result.current.createQuota({
          quota_code: "API_CALLS",
          quota_name: "API Calls",
          description: "API calls per month",
          unit_name: "call",
          unit_plural: "calls",
          pricing_model: "PER_UNIT",
          default_limit: 10000,
        });
      });

      expect(created).toEqual(newQuota);
      expect(mockApiClient.post).toHaveBeenCalledWith("/licensing/quotas", expect.any(Object));
    });

    it("should update quota successfully", async () => {
      const updatedQuota: QuotaDefinition = {
        id: "quota-1",
        quota_code: "SUBSCRIBERS",
        quota_name: "Updated Subscribers",
        default_limit: 200,
      };

      mockApiClient.get.mockResolvedValue({ data: [] });
      mockApiClient.patch.mockResolvedValueOnce({ data: updatedQuota });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.quotasLoading).toBe(false));

      let updated;
      await act(async () => {
        updated = await result.current.updateQuota("quota-1", {
          quota_name: "Updated Subscribers",
          default_limit: 200,
        });
      });

      expect(updated).toEqual(updatedQuota);
      expect(mockApiClient.patch).toHaveBeenCalledWith(
        "/licensing/quotas/quota-1",
        expect.any(Object),
      );
    });
  });

  describe("useLicensing - Plan Mutations", () => {
    it("should create plan successfully", async () => {
      const newPlan: ServicePlan = {
        id: "plan-new",
        plan_code: "STARTER",
        plan_name: "Starter Plan",
        description: "Basic plan",
        base_price_monthly: 49.99,
        annual_discount_percent: 0,
      };

      mockApiClient.get.mockResolvedValue({ data: [] });
      mockApiClient.post.mockResolvedValueOnce({ data: newPlan });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.plansLoading).toBe(false));

      let created;
      await act(async () => {
        created = await result.current.createPlan({
          plan_code: "STARTER",
          plan_name: "Starter Plan",
          description: "Basic plan",
          base_price_monthly: 49.99,
          annual_discount_percent: 0,
          modules: [],
          quotas: [],
        });
      });

      expect(created).toEqual(newPlan);
      expect(mockApiClient.post).toHaveBeenCalledWith("/licensing/plans", expect.any(Object));
    });

    it("should update plan successfully", async () => {
      const updatedPlan: ServicePlan = {
        id: "plan-1",
        plan_code: "ENTERPRISE",
        plan_name: "Updated Enterprise Plan",
        base_price_monthly: 349.99,
      };

      mockApiClient.get.mockResolvedValue({ data: [] });
      mockApiClient.patch.mockResolvedValueOnce({ data: updatedPlan });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.plansLoading).toBe(false));

      let updated;
      await act(async () => {
        updated = await result.current.updatePlan("plan-1", {
          plan_name: "Updated Enterprise Plan",
          base_price_monthly: 349.99,
        });
      });

      expect(updated).toEqual(updatedPlan);
      expect(mockApiClient.patch).toHaveBeenCalledWith(
        "/licensing/plans/plan-1",
        expect.any(Object),
      );
    });

    it("should duplicate plan successfully", async () => {
      const duplicatedPlan: ServicePlan = {
        id: "plan-copy",
        plan_code: "ENTERPRISE_COPY",
        plan_name: "Enterprise Plan (Copy)",
        base_price_monthly: 299.99,
      };

      mockApiClient.get.mockResolvedValue({ data: [] });
      mockApiClient.post.mockResolvedValueOnce({ data: duplicatedPlan });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.plansLoading).toBe(false));

      let duplicated;
      await act(async () => {
        duplicated = await result.current.duplicatePlan("plan-1");
      });

      expect(duplicated).toEqual(duplicatedPlan);
      expect(mockApiClient.post).toHaveBeenCalledWith("/licensing/plans/plan-1/duplicate");
    });
  });

  describe("useLicensing - Subscription Mutations", () => {
    it("should create subscription successfully", async () => {
      const newSubscription: TenantSubscription = {
        id: "sub-new",
        tenant_id: "tenant-1",
        plan_id: "plan-1",
        status: "ACTIVE",
        billing_cycle: "MONTHLY",
      };

      mockApiClient.get.mockResolvedValue({ data: [] });
      mockApiClient.post.mockResolvedValueOnce({ data: newSubscription });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.subscriptionLoading).toBe(false));

      let created;
      await act(async () => {
        created = await result.current.createSubscription({
          tenant_id: "tenant-1",
          plan_id: "plan-1",
          billing_cycle: "MONTHLY",
        });
      });

      expect(created).toEqual(newSubscription);
      expect(mockApiClient.post).toHaveBeenCalledWith(
        "/licensing/subscriptions",
        expect.any(Object),
      );
    });

    it("should add addon successfully", async () => {
      mockApiClient.get.mockResolvedValue({ data: [] });
      mockApiClient.post.mockResolvedValueOnce({ data: {} });

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

      expect(mockApiClient.post).toHaveBeenCalledWith(
        "/licensing/subscriptions/current/addons",
        expect.any(Object),
      );
    });

    it("should remove addon successfully", async () => {
      mockApiClient.get.mockResolvedValue({ data: [] });
      mockApiClient.delete.mockResolvedValueOnce({ data: {} });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.subscriptionLoading).toBe(false));

      await act(async () => {
        await result.current.removeAddon({
          module_id: "addon-1",
        });
      });

      expect(mockApiClient.delete).toHaveBeenCalledWith(
        "/licensing/subscriptions/current/addons",
        expect.objectContaining({ data: expect.any(Object) }),
      );
    });
  });

  describe("useLicensing - Helper Functions", () => {
    it("should get module by id", async () => {
      const mockModule: FeatureModule = {
        id: "mod-1",
        module_code: "BILLING",
        module_name: "Billing Module",
      };

      mockApiClient.get.mockImplementation((url) => {
        if (url === "/licensing/modules/mod-1") {
          return Promise.resolve({ data: mockModule });
        }
        return Promise.resolve({ data: [] });
      });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.modulesLoading).toBe(false));

      let fetched;
      await act(async () => {
        fetched = await result.current.getModule("mod-1");
      });

      expect(fetched).toEqual(mockModule);
      expect(mockApiClient.get).toHaveBeenCalledWith("/licensing/modules/mod-1");
    });

    it("should get plan by id", async () => {
      const mockPlan: ServicePlan = {
        id: "plan-1",
        plan_code: "ENTERPRISE",
        plan_name: "Enterprise Plan",
      };

      mockApiClient.get.mockImplementation((url) => {
        if (url === "/licensing/plans/plan-1") {
          return Promise.resolve({ data: mockPlan });
        }
        return Promise.resolve({ data: [] });
      });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.plansLoading).toBe(false));

      let fetched;
      await act(async () => {
        fetched = await result.current.getPlan("plan-1");
      });

      expect(fetched).toEqual(mockPlan);
      expect(mockApiClient.get).toHaveBeenCalledWith("/licensing/plans/plan-1");
    });

    it("should calculate plan price", async () => {
      const mockPricing = {
        billing_period: "ANNUAL",
        total: 2879.99,
        currency: "USD",
      };

      mockApiClient.get.mockImplementation((url) => {
        if (url.includes("/pricing")) {
          return Promise.resolve({ data: mockPricing });
        }
        return Promise.resolve({ data: [] });
      });

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

      expect(pricing).toEqual(mockPricing);
      expect(mockApiClient.get).toHaveBeenCalledWith(
        "/licensing/plans/plan-1/pricing",
        expect.any(Object),
      );
    });

    it("should check entitlement", async () => {
      const mockResponse: CheckEntitlementResponse = {
        entitled: true,
      };

      mockApiClient.get.mockResolvedValue({ data: [] });
      mockApiClient.post.mockResolvedValueOnce({ data: mockResponse });

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

      expect(response).toEqual(mockResponse);
      expect(mockApiClient.post).toHaveBeenCalledWith(
        "/licensing/entitlements/check",
        expect.any(Object),
      );
    });

    it("should check quota", async () => {
      const mockResponse: CheckQuotaResponse = {
        available: true,
        remaining: 50,
        used: 50,
      };

      mockApiClient.get.mockResolvedValue({ data: [] });
      mockApiClient.post.mockResolvedValueOnce({ data: mockResponse });

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

      expect(response).toEqual(mockResponse);
      expect(mockApiClient.post).toHaveBeenCalledWith(
        "/licensing/quotas/check",
        expect.any(Object),
      );
    });

    it("should consume quota", async () => {
      mockApiClient.get.mockResolvedValue({ data: [] });
      mockApiClient.post.mockResolvedValueOnce({ data: {} });

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

      expect(mockApiClient.post).toHaveBeenCalledWith(
        "/licensing/quotas/consume",
        expect.any(Object),
      );
    });

    it("should release quota", async () => {
      mockApiClient.get.mockResolvedValue({ data: [] });
      mockApiClient.post.mockResolvedValueOnce({ data: {} });

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

      expect(mockApiClient.post).toHaveBeenCalledWith(
        "/licensing/quotas/release",
        expect.any(Object),
      );
    });
  });

  describe("useFeatureEntitlement", () => {
    it("should check entitlement successfully", async () => {
      const mockResponse: CheckEntitlementResponse = {
        entitled: true,
      };

      mockApiClient.post.mockResolvedValueOnce({ data: mockResponse });

      const { result } = renderHook(() => useFeatureEntitlement("BILLING", "CREATE_INVOICE"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.entitled).toBe(true);
      expect(mockApiClient.post).toHaveBeenCalledWith("/licensing/entitlements/check", {
        module_code: "BILLING",
        capability_code: "CREATE_INVOICE",
      });
    });

    it("should return not entitled when no module code", async () => {
      const { result } = renderHook(() => useFeatureEntitlement(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
      expect(mockApiClient.post).not.toHaveBeenCalled();
    });

    it("should handle entitlement check error", async () => {
      mockApiClient.post.mockRejectedValueOnce(new Error("Server error"));

      const { result } = renderHook(() => useFeatureEntitlement("BILLING"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.entitled).toBe(false);
    });
  });

  describe("useQuotaCheck", () => {
    it("should check quota successfully", async () => {
      const mockResponse: CheckQuotaResponse = {
        available: true,
        remaining: 50,
        used: 50,
      };

      mockApiClient.post.mockResolvedValueOnce({ data: mockResponse });

      const { result } = renderHook(() => useQuotaCheck("SUBSCRIBERS", 10), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.available).toBe(true);
      expect(result.current.data?.remaining).toBe(50);
      expect(mockApiClient.post).toHaveBeenCalledWith("/licensing/quotas/check", {
        quota_code: "SUBSCRIBERS",
        quantity: 10,
      });
    });

    it("should use default quantity of 1", async () => {
      const mockResponse: CheckQuotaResponse = {
        available: true,
        remaining: 50,
        used: 50,
      };

      mockApiClient.post.mockResolvedValueOnce({ data: mockResponse });

      const { result } = renderHook(() => useQuotaCheck("SUBSCRIBERS"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockApiClient.post).toHaveBeenCalledWith("/licensing/quotas/check", {
        quota_code: "SUBSCRIBERS",
        quantity: 1,
      });
    });

    it("should handle quota check error", async () => {
      mockApiClient.post.mockRejectedValueOnce(new Error("Server error"));

      const { result } = renderHook(() => useQuotaCheck("SUBSCRIBERS", 10), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.available).toBe(false);
      expect(result.current.data?.remaining).toBe(0);
    });
  });

  describe("Cache Behavior", () => {
    it("should invalidate modules cache after create", async () => {
      const newModule: FeatureModule = {
        id: "mod-new",
        module_code: "NEW",
        module_name: "New Module",
      };

      mockApiClient.get.mockResolvedValue({ data: [] });
      mockApiClient.post.mockResolvedValueOnce({ data: newModule });

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useLicensing(), { wrapper });

      await waitFor(() => expect(result.current.modulesLoading).toBe(false));

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      await act(async () => {
        await result.current.createModule({
          module_code: "NEW",
          module_name: "New Module",
          description: "Test",
          category: "AUTOMATION",
          pricing_model: "FLAT_FEE",
          base_price: 99.99,
        });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: licensingKeys.all });
    });
  });
});
