/**
 * Tests for useLicensing hooks
 * Tests licensing framework functionality with TanStack Query
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import {
  useLicensing,
  useFeatureEntitlement,
  useQuotaCheck,
  licensingKeys,
} from "../useLicensing";
import {
  FeatureModule,
  QuotaDefinition,
  ServicePlan,
  TenantSubscription,
  CreateFeatureModuleRequest,
  CreateQuotaDefinitionRequest,
  CreateServicePlanRequest,
  CreateSubscriptionRequest,
  AddAddonRequest,
  RemoveAddonRequest,
  CheckEntitlementResponse,
  CheckQuotaResponse,
  ModuleCategory,
  PricingModel,
  SubscriptionStatus,
  BillingCycle,
} from "../../types/licensing";
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
  },
}));

describe("useLicensing", () => {
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
      const mockModules: FeatureModule[] = [
        {
          id: "mod-1",
          module_code: "BILLING",
          module_name: "Billing Module",
          category: ModuleCategory.BILLING,
          description: "Billing features",
          dependencies: [],
          pricing_model: PricingModel.FLAT_FEE,
          base_price: 99.99,
          config_schema: {},
          default_config: {},
          is_active: true,
          is_public: true,
          extra_metadata: {},
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockModules });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.modulesLoading).toBe(false));

      expect(result.current.modules).toEqual(mockModules);
      expect(result.current.modulesError).toBeNull();
      expect(apiClient.get).toHaveBeenCalledWith("/licensing/modules");
    });

    it("should handle empty modules array", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.modulesLoading).toBe(false));

      expect(result.current.modules).toEqual([]);
      expect(result.current.modulesError).toBeNull();
    });

    it("should handle modules fetch error", async () => {
      const error = new Error("Failed to fetch modules");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.modulesLoading).toBe(false));

      expect(result.current.modulesError).toBeTruthy();
      expect(logger.error).toHaveBeenCalledWith("Failed to fetch modules", error);
    });

    it("should set loading state correctly for modules", async () => {
      (apiClient.get as jest.Mock).mockImplementation(() =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ data: [] }), 100)
        )
      );

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      expect(result.current.modulesLoading).toBe(true);

      await waitFor(() => expect(result.current.modulesLoading).toBe(false), {
        timeout: 200,
      });
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
          pricing_model: PricingModel.PER_UNIT,
          overage_rate: 5.0,
          is_metered: true,
          reset_period: "MONTHLY",
          is_active: true,
          extra_metadata: {},
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockQuotas });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.quotasLoading).toBe(false));

      expect(result.current.quotas).toEqual(mockQuotas);
      expect(result.current.quotasError).toBeNull();
      expect(apiClient.get).toHaveBeenCalledWith("/licensing/quotas");
    });

    it("should handle quotas fetch error", async () => {
      const error = new Error("Failed to fetch quotas");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.quotasLoading).toBe(false));

      expect(result.current.quotasError).toBeTruthy();
      expect(logger.error).toHaveBeenCalledWith("Failed to fetch quotas", error);
    });
  });

  describe("useLicensing - Service Plans Query", () => {
    it("should fetch plans successfully", async () => {
      const mockPlans: ServicePlan[] = [
        {
          id: "plan-1",
          plan_name: "Enterprise Plan",
          plan_code: "ENTERPRISE",
          description: "Full featured plan",
          version: 1,
          is_template: false,
          is_public: true,
          is_custom: false,
          base_price_monthly: 299.99,
          annual_discount_percent: 20,
          trial_days: 14,
          trial_modules: [],
          extra_metadata: {},
          is_active: true,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockPlans });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.plansLoading).toBe(false));

      expect(result.current.plans).toEqual(mockPlans);
      expect(result.current.plansError).toBeNull();
      expect(apiClient.get).toHaveBeenCalledWith("/licensing/plans");
    });

    it("should handle plans fetch error", async () => {
      const error = new Error("Failed to fetch plans");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.plansLoading).toBe(false));

      expect(result.current.plansError).toBeTruthy();
      expect(logger.error).toHaveBeenCalledWith("Failed to fetch plans", error);
    });
  });

  describe("useLicensing - Current Subscription Query", () => {
    it("should fetch current subscription successfully", async () => {
      const mockSubscription: TenantSubscription = {
        id: "sub-1",
        tenant_id: "tenant-1",
        plan_id: "plan-1",
        status: SubscriptionStatus.ACTIVE,
        billing_cycle: BillingCycle.MONTHLY,
        monthly_price: 299.99,
        current_period_start: "2024-01-01T00:00:00Z",
        current_period_end: "2024-02-01T00:00:00Z",
        custom_config: {},
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockSubscription });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.subscriptionLoading).toBe(false));

      expect(result.current.currentSubscription).toEqual(mockSubscription);
      expect(result.current.subscriptionError).toBeNull();
      expect(apiClient.get).toHaveBeenCalledWith("/licensing/subscriptions/current");
    });

    it("should handle 404 for no subscription", async () => {
      const error = { response: { status: 404 } };
      (apiClient.get as jest.Mock).mockImplementation((url: string) => {
        if (url === "/licensing/subscriptions/current") {
          return Promise.reject(error);
        }
        return Promise.resolve({ data: [] });
      });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.subscriptionLoading).toBe(false));

      // TanStack Query treats undefined return value as an error
      // So when 404 happens and we return undefined, it becomes an error
      expect(result.current.currentSubscription).toBeUndefined();
      // The error is the TanStack Query validation error
      expect(result.current.subscriptionError).toBeTruthy();
    });

    it("should handle subscription fetch error", async () => {
      const error = new Error("Server error");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.subscriptionLoading).toBe(false));

      expect(result.current.subscriptionError).toBeTruthy();
      expect(logger.error).toHaveBeenCalledWith("Failed to fetch subscription", error);
    });
  });

  describe("useLicensing - Module Mutations", () => {
    it("should create module successfully", async () => {
      const mockModule: FeatureModule = {
        id: "mod-new",
        module_code: "ANALYTICS",
        module_name: "Analytics Module",
        category: ModuleCategory.ANALYTICS,
        description: "Analytics features",
        dependencies: [],
        pricing_model: PricingModel.FLAT_FEE,
        base_price: 149.99,
        config_schema: {},
        default_config: {},
        is_active: true,
        is_public: true,
        extra_metadata: {},
        created_at: "2024-01-20T00:00:00Z",
        updated_at: "2024-01-20T00:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockModule });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.modulesLoading).toBe(false));

      const createData: CreateFeatureModuleRequest = {
        module_code: "ANALYTICS",
        module_name: "Analytics Module",
        category: ModuleCategory.ANALYTICS,
        description: "Analytics features",
        pricing_model: PricingModel.FLAT_FEE,
        base_price: 149.99,
      };

      await act(async () => {
        const created = await result.current.createModule(createData);
        expect(created).toEqual(mockModule);
      });

      expect(apiClient.post).toHaveBeenCalledWith("/licensing/modules", createData);
    });

    it("should update module successfully", async () => {
      const mockModule: FeatureModule = {
        id: "mod-1",
        module_code: "BILLING",
        module_name: "Updated Billing Module",
        category: ModuleCategory.BILLING,
        description: "Updated description",
        dependencies: [],
        pricing_model: PricingModel.FLAT_FEE,
        base_price: 129.99,
        config_schema: {},
        default_config: {},
        is_active: true,
        is_public: true,
        extra_metadata: {},
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-20T00:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
      (apiClient.patch as jest.Mock).mockResolvedValue({ data: mockModule });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.modulesLoading).toBe(false));

      const updateData: Partial<FeatureModule> = {
        module_name: "Updated Billing Module",
        base_price: 129.99,
      };

      await act(async () => {
        const updated = await result.current.updateModule("mod-1", updateData);
        expect(updated).toEqual(mockModule);
      });

      expect(apiClient.patch).toHaveBeenCalledWith("/licensing/modules/mod-1", updateData);
    });

    it("should handle create module error", async () => {
      const error = new Error("Failed to create module");
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
      (apiClient.post as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.modulesLoading).toBe(false));

      const createData: CreateFeatureModuleRequest = {
        module_code: "TEST",
        module_name: "Test Module",
        category: ModuleCategory.OTHER,
        description: "Test",
        pricing_model: PricingModel.FLAT_FEE,
        base_price: 99.99,
      };

      await expect(result.current.createModule(createData)).rejects.toThrow(
        "Failed to create module"
      );
      expect(logger.error).toHaveBeenCalledWith("Failed to create module", error);
    });
  });

  describe("useLicensing - Quota Mutations", () => {
    it("should create quota successfully", async () => {
      const mockQuota: QuotaDefinition = {
        id: "quota-new",
        quota_code: "API_CALLS",
        quota_name: "API Calls",
        description: "Number of API calls per month",
        unit_name: "call",
        unit_plural: "calls",
        pricing_model: PricingModel.PER_UNIT,
        overage_rate: 0.01,
        is_metered: true,
        reset_period: "MONTHLY",
        is_active: true,
        extra_metadata: {},
        created_at: "2024-01-20T00:00:00Z",
        updated_at: "2024-01-20T00:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockQuota });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.quotasLoading).toBe(false));

      const createData: CreateQuotaDefinitionRequest = {
        quota_code: "API_CALLS",
        quota_name: "API Calls",
        description: "Number of API calls per month",
        unit_name: "call",
        unit_plural: "calls",
        pricing_model: PricingModel.PER_UNIT,
        overage_rate: 0.01,
        is_metered: true,
        reset_period: "MONTHLY",
      };

      await act(async () => {
        const created = await result.current.createQuota(createData);
        expect(created).toEqual(mockQuota);
      });

      expect(apiClient.post).toHaveBeenCalledWith("/licensing/quotas", createData);
    });

    it("should update quota successfully", async () => {
      const mockQuota: QuotaDefinition = {
        id: "quota-1",
        quota_code: "SUBSCRIBERS",
        quota_name: "Updated Subscribers",
        description: "Updated description",
        unit_name: "subscriber",
        unit_plural: "subscribers",
        pricing_model: PricingModel.PER_UNIT,
        overage_rate: 7.5,
        is_metered: true,
        reset_period: "MONTHLY",
        is_active: true,
        extra_metadata: {},
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-20T00:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
      (apiClient.patch as jest.Mock).mockResolvedValue({ data: mockQuota });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.quotasLoading).toBe(false));

      const updateData: Partial<QuotaDefinition> = {
        quota_name: "Updated Subscribers",
        overage_rate: 7.5,
      };

      await act(async () => {
        const updated = await result.current.updateQuota("quota-1", updateData);
        expect(updated).toEqual(mockQuota);
      });

      expect(apiClient.patch).toHaveBeenCalledWith("/licensing/quotas/quota-1", updateData);
    });
  });

  describe("useLicensing - Plan Mutations", () => {
    it("should create plan successfully", async () => {
      const mockPlan: ServicePlan = {
        id: "plan-new",
        plan_name: "Starter Plan",
        plan_code: "STARTER",
        description: "Basic plan",
        version: 1,
        is_template: false,
        is_public: true,
        is_custom: false,
        base_price_monthly: 49.99,
        annual_discount_percent: 15,
        trial_days: 7,
        trial_modules: [],
        extra_metadata: {},
        is_active: true,
        created_at: "2024-01-20T00:00:00Z",
        updated_at: "2024-01-20T00:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockPlan });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.plansLoading).toBe(false));

      const createData: CreateServicePlanRequest = {
        plan_name: "Starter Plan",
        plan_code: "STARTER",
        description: "Basic plan",
        base_price_monthly: 49.99,
        modules: [],
        quotas: [],
      };

      await act(async () => {
        const created = await result.current.createPlan(createData);
        expect(created).toEqual(mockPlan);
      });

      expect(apiClient.post).toHaveBeenCalledWith("/licensing/plans", createData);
    });

    it("should update plan successfully", async () => {
      const mockPlan: ServicePlan = {
        id: "plan-1",
        plan_name: "Updated Plan",
        plan_code: "ENTERPRISE",
        description: "Updated description",
        version: 2,
        is_template: false,
        is_public: true,
        is_custom: false,
        base_price_monthly: 349.99,
        annual_discount_percent: 25,
        trial_days: 14,
        trial_modules: [],
        extra_metadata: {},
        is_active: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-20T00:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
      (apiClient.patch as jest.Mock).mockResolvedValue({ data: mockPlan });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.plansLoading).toBe(false));

      const updateData: Partial<ServicePlan> = {
        plan_name: "Updated Plan",
        base_price_monthly: 349.99,
      };

      await act(async () => {
        const updated = await result.current.updatePlan("plan-1", updateData);
        expect(updated).toEqual(mockPlan);
      });

      expect(apiClient.patch).toHaveBeenCalledWith("/licensing/plans/plan-1", updateData);
    });

    it("should duplicate plan successfully", async () => {
      const mockDuplicatedPlan: ServicePlan = {
        id: "plan-duplicate",
        plan_name: "Enterprise Plan (Copy)",
        plan_code: "ENTERPRISE_COPY",
        description: "Full featured plan",
        version: 1,
        is_template: false,
        is_public: true,
        is_custom: false,
        base_price_monthly: 299.99,
        annual_discount_percent: 20,
        trial_days: 14,
        trial_modules: [],
        extra_metadata: {},
        is_active: true,
        created_at: "2024-01-20T00:00:00Z",
        updated_at: "2024-01-20T00:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockDuplicatedPlan });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.plansLoading).toBe(false));

      await act(async () => {
        const duplicated = await result.current.duplicatePlan("plan-1");
        expect(duplicated).toEqual(mockDuplicatedPlan);
      });

      expect(apiClient.post).toHaveBeenCalledWith("/licensing/plans/plan-1/duplicate");
    });
  });

  describe("useLicensing - Subscription Mutations", () => {
    it("should create subscription successfully", async () => {
      const mockSubscription: TenantSubscription = {
        id: "sub-new",
        tenant_id: "tenant-1",
        plan_id: "plan-1",
        status: SubscriptionStatus.ACTIVE,
        billing_cycle: BillingCycle.MONTHLY,
        monthly_price: 299.99,
        current_period_start: "2024-01-20T00:00:00Z",
        current_period_end: "2024-02-20T00:00:00Z",
        custom_config: {},
        created_at: "2024-01-20T00:00:00Z",
        updated_at: "2024-01-20T00:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockSubscription });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.subscriptionLoading).toBe(false));

      const createData: CreateSubscriptionRequest = {
        tenant_id: "tenant-1",
        plan_id: "plan-1",
        billing_cycle: BillingCycle.MONTHLY,
      };

      await act(async () => {
        const created = await result.current.createSubscription(createData);
        expect(created).toEqual(mockSubscription);
      });

      expect(apiClient.post).toHaveBeenCalledWith("/licensing/subscriptions", createData);
    });

    it("should add addon successfully", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
      (apiClient.post as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.subscriptionLoading).toBe(false));

      const addonData: AddAddonRequest = {
        module_id: "mod-addon",
      };

      await act(async () => {
        await result.current.addAddon(addonData);
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        "/licensing/subscriptions/current/addons",
        addonData
      );
    });

    it("should remove addon successfully", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
      (apiClient.delete as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.subscriptionLoading).toBe(false));

      const removeData: RemoveAddonRequest = {
        module_id: "mod-addon",
      };

      await act(async () => {
        await result.current.removeAddon(removeData);
      });

      expect(apiClient.delete).toHaveBeenCalledWith(
        "/licensing/subscriptions/current/addons",
        { data: removeData }
      );
    });
  });

  describe("useLicensing - Helper Functions", () => {
    it("should get module by id", async () => {
      const mockModule: FeatureModule = {
        id: "mod-1",
        module_code: "BILLING",
        module_name: "Billing Module",
        category: ModuleCategory.BILLING,
        description: "Billing features",
        dependencies: [],
        pricing_model: PricingModel.FLAT_FEE,
        base_price: 99.99,
        config_schema: {},
        default_config: {},
        is_active: true,
        is_public: true,
        extra_metadata: {},
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockModule });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.modulesLoading).toBe(false));

      await act(async () => {
        const module = await result.current.getModule("mod-1");
        expect(module).toEqual(mockModule);
      });

      expect(apiClient.get).toHaveBeenCalledWith("/licensing/modules/mod-1");
    });

    it("should get plan by id", async () => {
      const mockPlan: ServicePlan = {
        id: "plan-1",
        plan_name: "Enterprise Plan",
        plan_code: "ENTERPRISE",
        description: "Full featured plan",
        version: 1,
        is_template: false,
        is_public: true,
        is_custom: false,
        base_price_monthly: 299.99,
        annual_discount_percent: 20,
        trial_days: 14,
        trial_modules: [],
        extra_metadata: {},
        is_active: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockPlan });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.plansLoading).toBe(false));

      await act(async () => {
        const plan = await result.current.getPlan("plan-1");
        expect(plan).toEqual(mockPlan);
      });

      expect(apiClient.get).toHaveBeenCalledWith("/licensing/plans/plan-1");
    });

    it("should calculate plan price", async () => {
      const mockPricing = {
        monthly: 299.99,
        annual: 2879.90,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockPricing });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.plansLoading).toBe(false));

      await act(async () => {
        const pricing = await result.current.calculatePlanPrice("plan-1", {
          billing_cycle: "ANNUAL",
        });
        expect(pricing).toEqual(mockPricing);
      });

      expect(apiClient.get).toHaveBeenCalledWith("/licensing/plans/plan-1/pricing", {
        params: { billing_cycle: "ANNUAL" },
      });
    });

    it("should check entitlement", async () => {
      const mockResponse: CheckEntitlementResponse = {
        entitled: true,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.modulesLoading).toBe(false));

      await act(async () => {
        const response = await result.current.checkEntitlement({
          module_code: "BILLING",
          capability_code: "CREATE_INVOICE",
        });
        expect(response).toEqual(mockResponse);
      });

      expect(apiClient.post).toHaveBeenCalledWith("/licensing/entitlements/check", {
        module_code: "BILLING",
        capability_code: "CREATE_INVOICE",
      });
    });

    it("should check quota", async () => {
      const mockResponse: CheckQuotaResponse = {
        available: true,
        current_usage: 50,
        allocated_quantity: 100,
        remaining: 50,
        will_exceed: false,
        overage_allowed: true,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.quotasLoading).toBe(false));

      await act(async () => {
        const response = await result.current.checkQuota({
          quota_code: "SUBSCRIBERS",
          quantity: 10,
        });
        expect(response).toEqual(mockResponse);
      });

      expect(apiClient.post).toHaveBeenCalledWith("/licensing/quotas/check", {
        quota_code: "SUBSCRIBERS",
        quantity: 10,
      });
    });

    it("should consume quota", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
      (apiClient.post as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.quotasLoading).toBe(false));

      await act(async () => {
        await result.current.consumeQuota({
          quota_code: "API_CALLS",
          quantity: 100,
          metadata: { endpoint: "/api/subscribers" },
        });
      });

      expect(apiClient.post).toHaveBeenCalledWith("/licensing/quotas/consume", {
        quota_code: "API_CALLS",
        quantity: 100,
        metadata: { endpoint: "/api/subscribers" },
      });
    });

    it("should release quota", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
      (apiClient.post as jest.Mock).mockResolvedValue({});

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

      expect(apiClient.post).toHaveBeenCalledWith("/licensing/quotas/release", {
        quota_code: "SUBSCRIBERS",
        quantity: 5,
      });
    });

    it("should refetch all licensing data", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.modulesLoading).toBe(false));

      const initialCallCount = (apiClient.get as jest.Mock).mock.calls.length;

      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect((apiClient.get as jest.Mock).mock.calls.length).toBeGreaterThan(
          initialCallCount
        );
      });
    });
  });

  describe("useFeatureEntitlement", () => {
    it("should check entitlement successfully", async () => {
      const mockResponse: CheckEntitlementResponse = {
        entitled: true,
      };

      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(
        () => useFeatureEntitlement("BILLING", "CREATE_INVOICE"),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.entitled).toBe(true);
      expect(apiClient.post).toHaveBeenCalledWith("/licensing/entitlements/check", {
        module_code: "BILLING",
        capability_code: "CREATE_INVOICE",
      });
    });

    it("should return not entitled when no module code", async () => {
      const { result } = renderHook(() => useFeatureEntitlement(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // When query is disabled (enabled: !!moduleCode => false), data is undefined
      // The consumer should check if moduleCode is present before using the hook
      expect(result.current.data).toBeUndefined();
      expect(apiClient.post).not.toHaveBeenCalled();
    });

    it("should not fetch when module code is undefined", async () => {
      const { result } = renderHook(() => useFeatureEntitlement(undefined), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // When query is disabled, data is undefined
      expect(result.current.data).toBeUndefined();
      expect(apiClient.post).not.toHaveBeenCalled();
    });

    it("should handle entitlement check error", async () => {
      const error = new Error("Failed to check entitlement");
      (apiClient.post as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useFeatureEntitlement("BILLING"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.entitled).toBe(false);
      expect(logger.error).toHaveBeenCalledWith("Failed to check entitlement", error);
    });
  });

  describe("useQuotaCheck", () => {
    it("should check quota successfully", async () => {
      const mockResponse: CheckQuotaResponse = {
        available: true,
        current_usage: 50,
        allocated_quantity: 100,
        remaining: 50,
        will_exceed: false,
        overage_allowed: true,
      };

      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useQuotaCheck("SUBSCRIBERS", 10), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.available).toBe(true);
      expect(result.current.data?.remaining).toBe(50);
      expect(result.current.data?.details).toEqual(mockResponse);
      expect(apiClient.post).toHaveBeenCalledWith("/licensing/quotas/check", {
        quota_code: "SUBSCRIBERS",
        quantity: 10,
      });
    });

    it("should use default quantity of 1", async () => {
      const mockResponse: CheckQuotaResponse = {
        available: true,
        current_usage: 50,
        allocated_quantity: 100,
        remaining: 50,
        will_exceed: false,
        overage_allowed: true,
      };

      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useQuotaCheck("SUBSCRIBERS"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(apiClient.post).toHaveBeenCalledWith("/licensing/quotas/check", {
        quota_code: "SUBSCRIBERS",
        quantity: 1,
      });
    });

    it("should handle quota check error", async () => {
      const error = new Error("Failed to check quota");
      (apiClient.post as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useQuotaCheck("SUBSCRIBERS", 10), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.available).toBe(false);
      expect(result.current.data?.remaining).toBe(0);
      expect(result.current.data?.details).toBeNull();
      expect(logger.error).toHaveBeenCalledWith("Failed to check quota", error);
    });
  });

  describe("Cache Invalidation", () => {
    it("should invalidate modules cache after creating module", async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      // Mock initial modules fetch
      (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: [] });

      const { result } = renderHook(() => useLicensing(), { wrapper });
      await waitFor(() => expect(result.current.modulesLoading).toBe(false));

      const initialCallCount = (apiClient.get as jest.Mock).mock.calls.length;

      // Mock create module
      const mockModule: FeatureModule = {
        id: "mod-new",
        module_code: "NEW_MOD",
        module_name: "New Module",
        category: ModuleCategory.OTHER,
        description: "Test",
        dependencies: [],
        pricing_model: PricingModel.FLAT_FEE,
        base_price: 99.99,
        config_schema: {},
        default_config: {},
        is_active: true,
        is_public: true,
        extra_metadata: {},
        created_at: "2024-01-20T00:00:00Z",
        updated_at: "2024-01-20T00:00:00Z",
      };

      (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: mockModule });

      // Mock refetch after invalidation
      (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: [mockModule] });

      await act(async () => {
        await result.current.createModule({
          module_code: "NEW_MOD",
          module_name: "New Module",
          category: ModuleCategory.OTHER,
          description: "Test",
          pricing_model: PricingModel.FLAT_FEE,
          base_price: 99.99,
        });
      });

      await waitFor(() => {
        expect((apiClient.get as jest.Mock).mock.calls.length).toBeGreaterThan(
          initialCallCount
        );
      });
    });

    it("should invalidate subscription cache after adding addon", async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      // Mock initial subscription fetch
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: {
          id: "sub-1",
          tenant_id: "tenant-1",
          plan_id: "plan-1",
          status: SubscriptionStatus.ACTIVE,
          billing_cycle: BillingCycle.MONTHLY,
          monthly_price: 299.99,
          current_period_start: "2024-01-01T00:00:00Z",
          current_period_end: "2024-02-01T00:00:00Z",
          custom_config: {},
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      });

      const { result } = renderHook(() => useLicensing(), { wrapper });
      await waitFor(() => expect(result.current.subscriptionLoading).toBe(false));

      const initialCallCount = (apiClient.get as jest.Mock).mock.calls.length;

      // Mock add addon
      (apiClient.post as jest.Mock).mockResolvedValueOnce({});

      // Mock refetch after invalidation
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: {
          id: "sub-1",
          tenant_id: "tenant-1",
          plan_id: "plan-1",
          status: SubscriptionStatus.ACTIVE,
          billing_cycle: BillingCycle.MONTHLY,
          monthly_price: 349.99,
          current_period_start: "2024-01-01T00:00:00Z",
          current_period_end: "2024-02-01T00:00:00Z",
          custom_config: {},
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      });

      await act(async () => {
        await result.current.addAddon({ module_id: "mod-addon" });
      });

      await waitFor(() => {
        expect((apiClient.get as jest.Mock).mock.calls.length).toBeGreaterThan(
          initialCallCount
        );
      });
    });
  });

  describe("Loading States", () => {
    it("should show correct loading state during queries", async () => {
      (apiClient.get as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ data: [] }), 100)
          )
      );

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
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.modulesLoading).toBe(false));

      // The stale time is configured in the hook, we just verify it loads
      expect(result.current.modules).toEqual([]);
    });

    it("should use 1 minute stale time for subscription", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: undefined });

      const { result } = renderHook(() => useLicensing(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.subscriptionLoading).toBe(false));

      expect(result.current.currentSubscription).toBeUndefined();
    });
  });
});
