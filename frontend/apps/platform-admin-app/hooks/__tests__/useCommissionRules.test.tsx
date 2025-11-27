/**
 * Tests for useCommissionRules hook
 * Tests commission rule management with TanStack Query (queries and mutations)
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import {
  useCommissionRules,
  useCommissionRule,
  useApplicableRules,
  useCreateCommissionRule,
  useUpdateCommissionRule,
  useDeleteCommissionRule,
  CommissionRule,
  CreateCommissionRuleInput,
  UpdateCommissionRuleInput,
} from "../useCommissionRules";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Mock dependencies
const buildUrl = (path: string) => {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const prefixed = normalized.startsWith("/api/v1") ? normalized : `/api/v1${normalized}`;
  return `http://localhost:8000${prefixed}`;
};

jest.mock("@/providers/AppConfigContext", () => ({
  useAppConfig: () => ({
    api: {
      baseUrl: "http://localhost:8000",
      prefix: "/api/v1",
      buildUrl,
    },
    features: {},
    branding: {},
    tenant: {},
  }),
}));

describe("useCommissionRules", () => {
  const originalFetch = global.fetch;
  const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;

  beforeAll(() => {
    global.fetch = fetchMock;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

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
    fetchMock.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("useCommissionRules", () => {
    const mockRulesResponse = {
      rules: [
        {
          id: "rule-1",
          partner_id: "partner-123",
          tenant_id: "tenant-456",
          rule_name: "Revenue Share Rule",
          description: "Standard revenue sharing",
          commission_type: "revenue_share" as const,
          commission_rate: 0.15,
          effective_from: "2024-01-01T00:00:00Z",
          is_active: true,
          priority: 1,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ],
      total: 1,
      page: 1,
      page_size: 10,
    };

    it("should fetch commission rules successfully", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockRulesResponse,
      });

      const { result } = renderHook(() => useCommissionRules(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.rules).toHaveLength(1);
      expect(result.current.data?.rules[0].rule_name).toBe("Revenue Share Rule");
      expect(result.current.data?.total).toBe(1);
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8000/api/v1/partners/commission-rules/?",
        {
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        },
      );
    });

    it("should handle pagination parameters", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ ...mockRulesResponse, page: 2, page_size: 25 }),
      });

      const { result } = renderHook(() => useCommissionRules({ page: 2, page_size: 25 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8000/api/v1/partners/commission-rules/?page=2&page_size=25",
        expect.objectContaining({
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        }),
      );
    });

    it("should filter by partner_id", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockRulesResponse,
      });

      const { result } = renderHook(() => useCommissionRules({ partner_id: "partner-123" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8000/api/v1/partners/commission-rules/?partner_id=partner-123",
        expect.any(Object),
      );
    });

    it("should filter by is_active", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockRulesResponse,
      });

      const { result } = renderHook(() => useCommissionRules({ is_active: true }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8000/api/v1/partners/commission-rules/?is_active=true",
        expect.any(Object),
      );
    });

    it("should handle multiple query parameters", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockRulesResponse,
      });

      const { result } = renderHook(
        () =>
          useCommissionRules({
            partner_id: "partner-123",
            is_active: false,
            page: 3,
            page_size: 50,
          }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(url).toContain("partner_id=partner-123");
      expect(url).toContain("is_active=false");
      expect(url).toContain("page=3");
      expect(url).toContain("page_size=50");
    });

    it("should handle fetch error with detail message", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ detail: "Invalid request" }),
      });

      const { result } = renderHook(() => useCommissionRules(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error?.message).toBe("Invalid request");
    });

    it("should handle fetch error with HTTP status", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error("Invalid JSON");
        },
      });

      const { result } = renderHook(() => useCommissionRules(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      // When json() fails, it returns the default error message
      expect(result.current.error?.message).toBe("Failed to fetch commission rules");
    });

    it("should set loading state correctly", async () => {
      (global.fetch as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => mockRulesResponse,
                }),
              100,
            ),
          ),
      );

      const { result } = renderHook(() => useCommissionRules(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false), {
        timeout: 200,
      });
    });

    it("should use correct query key", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockRulesResponse,
      });

      const params = { partner_id: "partner-123", page: 2 };
      const { result } = renderHook(() => useCommissionRules(params), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Query key should be ["commission-rules", params]
      expect(result.current.data).toBeDefined();
    });
  });

  describe("useCommissionRule", () => {
    const mockRule: CommissionRule = {
      id: "rule-1",
      partner_id: "partner-123",
      tenant_id: "tenant-456",
      rule_name: "Flat Fee Rule",
      description: "Monthly flat fee",
      commission_type: "flat_fee",
      flat_fee_amount: 50.0,
      effective_from: "2024-01-01T00:00:00Z",
      is_active: true,
      priority: 1,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    };

    it("should fetch single commission rule successfully", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockRule,
      });

      const { result } = renderHook(() => useCommissionRule("rule-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockRule);
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8000/api/v1/partners/commission-rules/rule-1",
        {
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        },
      );
    });

    it("should not fetch when ruleId is undefined", async () => {
      const { result } = renderHook(() => useCommissionRule(undefined), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(global.fetch).not.toHaveBeenCalled();
      expect(result.current.data).toBeUndefined();
    });

    it("should handle fetch error", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ detail: "Rule not found" }),
      });

      const { result } = renderHook(() => useCommissionRule("rule-999"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error?.message).toBe("Rule not found");
    });

    it("should work with tiered commission type", async () => {
      const tieredRule: CommissionRule = {
        ...mockRule,
        id: "rule-2",
        rule_name: "Tiered Rule",
        commission_type: "tiered",
        tier_config: {
          tiers: [
            { min: 0, max: 1000, rate: 0.1 },
            { min: 1000, max: 5000, rate: 0.15 },
            { min: 5000, max: null, rate: 0.2 },
          ],
        },
        flat_fee_amount: undefined,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => tieredRule,
      });

      const { result } = renderHook(() => useCommissionRule("rule-2"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.commission_type).toBe("tiered");
      expect(result.current.data?.tier_config).toBeDefined();
    });

    it("should work with hybrid commission type", async () => {
      const hybridRule: CommissionRule = {
        ...mockRule,
        id: "rule-3",
        rule_name: "Hybrid Rule",
        commission_type: "hybrid",
        commission_rate: 0.1,
        flat_fee_amount: 25.0,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => hybridRule,
      });

      const { result } = renderHook(() => useCommissionRule("rule-3"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.commission_type).toBe("hybrid");
      expect(result.current.data?.commission_rate).toBe(0.1);
      expect(result.current.data?.flat_fee_amount).toBe(25.0);
    });
  });

  describe("useApplicableRules", () => {
    const mockApplicableRules: CommissionRule[] = [
      {
        id: "rule-1",
        partner_id: "partner-123",
        tenant_id: "tenant-456",
        rule_name: "Product Specific Rule",
        commission_type: "revenue_share",
        commission_rate: 0.2,
        applies_to_products: ["product-1"],
        effective_from: "2024-01-01T00:00:00Z",
        is_active: true,
        priority: 1,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      },
      {
        id: "rule-2",
        partner_id: "partner-123",
        tenant_id: "tenant-456",
        rule_name: "Customer Specific Rule",
        commission_type: "flat_fee",
        flat_fee_amount: 100.0,
        applies_to_customers: ["customer-1"],
        effective_from: "2024-01-01T00:00:00Z",
        is_active: true,
        priority: 2,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      },
    ];

    it("should fetch applicable rules successfully", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockApplicableRules,
      });

      const { result } = renderHook(() => useApplicableRules({ partner_id: "partner-123" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(2);
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8000/api/v1/partners/commission-rules/partners/partner-123/applicable?",
        {
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        },
      );
    });

    it("should filter by product_id", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => [mockApplicableRules[0]],
      });

      const { result } = renderHook(
        () =>
          useApplicableRules({
            partner_id: "partner-123",
            product_id: "product-1",
          }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8000/api/v1/partners/commission-rules/partners/partner-123/applicable?product_id=product-1",
        expect.any(Object),
      );
    });

    it("should filter by customer_id", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => [mockApplicableRules[1]],
      });

      const { result } = renderHook(
        () =>
          useApplicableRules({
            partner_id: "partner-123",
            customer_id: "customer-1",
          }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8000/api/v1/partners/commission-rules/partners/partner-123/applicable?customer_id=customer-1",
        expect.any(Object),
      );
    });

    it("should filter by both product_id and customer_id", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockApplicableRules,
      });

      const { result } = renderHook(
        () =>
          useApplicableRules({
            partner_id: "partner-123",
            product_id: "product-1",
            customer_id: "customer-1",
          }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(url).toContain("product_id=product-1");
      expect(url).toContain("customer_id=customer-1");
    });

    it("should not fetch when partner_id is empty", async () => {
      const { result } = renderHook(() => useApplicableRules({ partner_id: "" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(global.fetch).not.toHaveBeenCalled();
      expect(result.current.data).toBeUndefined();
    });

    it("should handle fetch error", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ detail: "Access denied" }),
      });

      const { result } = renderHook(() => useApplicableRules({ partner_id: "partner-123" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error?.message).toBe("Access denied");
    });
  });

  describe("useCreateCommissionRule", () => {
    const mockNewRule: CommissionRule = {
      id: "rule-new",
      partner_id: "partner-123",
      tenant_id: "tenant-456",
      rule_name: "New Rule",
      commission_type: "revenue_share",
      commission_rate: 0.15,
      effective_from: "2024-02-01T00:00:00Z",
      is_active: true,
      priority: 1,
      created_at: "2024-02-01T00:00:00Z",
      updated_at: "2024-02-01T00:00:00Z",
    };

    it("should create commission rule successfully", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockNewRule,
      });

      const { result } = renderHook(() => useCreateCommissionRule(), {
        wrapper: createWrapper(),
      });

      const input: CreateCommissionRuleInput = {
        partner_id: "partner-123",
        rule_name: "New Rule",
        commission_type: "revenue_share",
        commission_rate: 0.15,
        effective_from: "2024-02-01T00:00:00Z",
      };

      let createdRule: CommissionRule | undefined;
      await act(async () => {
        createdRule = await result.current.mutateAsync(input);
      });

      expect(createdRule).toEqual(mockNewRule);
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8000/api/v1/partners/commission-rules/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(input),
        },
      );
    });

    it("should create flat_fee commission rule", async () => {
      const flatFeeRule = {
        ...mockNewRule,
        commission_type: "flat_fee" as const,
        flat_fee_amount: 50.0,
        commission_rate: undefined,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => flatFeeRule,
      });

      const { result } = renderHook(() => useCreateCommissionRule(), {
        wrapper: createWrapper(),
      });

      const input: CreateCommissionRuleInput = {
        partner_id: "partner-123",
        rule_name: "Flat Fee Rule",
        commission_type: "flat_fee",
        flat_fee_amount: 50.0,
        effective_from: "2024-02-01T00:00:00Z",
      };

      await act(async () => {
        await result.current.mutateAsync(input);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify(input),
        }),
      );
    });

    it("should create tiered commission rule", async () => {
      const tieredRule = {
        ...mockNewRule,
        commission_type: "tiered" as const,
        tier_config: {
          tiers: [
            { min: 0, max: 1000, rate: 0.1 },
            { min: 1000, max: null, rate: 0.15 },
          ],
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => tieredRule,
      });

      const { result } = renderHook(() => useCreateCommissionRule(), {
        wrapper: createWrapper(),
      });

      const input: CreateCommissionRuleInput = {
        partner_id: "partner-123",
        rule_name: "Tiered Rule",
        commission_type: "tiered",
        tier_config: {
          tiers: [
            { min: 0, max: 1000, rate: 0.1 },
            { min: 1000, max: null, rate: 0.15 },
          ],
        },
        effective_from: "2024-02-01T00:00:00Z",
      };

      await act(async () => {
        await result.current.mutateAsync(input);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify(input),
        }),
      );
    });

    it("should create hybrid commission rule", async () => {
      const hybridRule = {
        ...mockNewRule,
        commission_type: "hybrid" as const,
        commission_rate: 0.1,
        flat_fee_amount: 25.0,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => hybridRule,
      });

      const { result } = renderHook(() => useCreateCommissionRule(), {
        wrapper: createWrapper(),
      });

      const input: CreateCommissionRuleInput = {
        partner_id: "partner-123",
        rule_name: "Hybrid Rule",
        commission_type: "hybrid",
        commission_rate: 0.1,
        flat_fee_amount: 25.0,
        effective_from: "2024-02-01T00:00:00Z",
      };

      await act(async () => {
        await result.current.mutateAsync(input);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify(input),
        }),
      );
    });

    it("should invalidate queries after successful creation", async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockNewRule,
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useCreateCommissionRule(), {
        wrapper,
      });

      const input: CreateCommissionRuleInput = {
        partner_id: "partner-123",
        rule_name: "New Rule",
        commission_type: "revenue_share",
        commission_rate: 0.15,
        effective_from: "2024-02-01T00:00:00Z",
      };

      await act(async () => {
        await result.current.mutateAsync(input);
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["commission-rules"],
      });
    });

    it("should handle create error", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ detail: "Invalid commission rate" }),
      });

      const { result } = renderHook(() => useCreateCommissionRule(), {
        wrapper: createWrapper(),
      });

      const input: CreateCommissionRuleInput = {
        partner_id: "partner-123",
        rule_name: "Invalid Rule",
        commission_type: "revenue_share",
        commission_rate: -0.5,
        effective_from: "2024-02-01T00:00:00Z",
      };

      await expect(
        act(async () => {
          await result.current.mutateAsync(input);
        }),
      ).rejects.toThrow("Invalid commission rate");
    });

    it("should set isPending state correctly", async () => {
      let resolveFetch: (value: any) => void;
      const fetchPromise = new Promise((resolve) => {
        resolveFetch = resolve;
      });

      (global.fetch as jest.Mock).mockImplementation(() => fetchPromise);

      const { result } = renderHook(() => useCreateCommissionRule(), {
        wrapper: createWrapper(),
      });

      const input: CreateCommissionRuleInput = {
        partner_id: "partner-123",
        rule_name: "New Rule",
        commission_type: "revenue_share",
        commission_rate: 0.15,
        effective_from: "2024-02-01T00:00:00Z",
      };

      // Start mutation and check pending state
      act(() => {
        result.current.mutate(input);
      });

      // Wait for pending state to be set
      await waitFor(() => expect(result.current.isPending).toBe(true));

      // Resolve the fetch
      act(() => {
        resolveFetch!({
          ok: true,
          json: async () => mockNewRule,
        });
      });

      // Should not be pending after completion
      await waitFor(() => expect(result.current.isPending).toBe(false));
    });

    it("should create rule with optional fields", async () => {
      const fullRule = {
        ...mockNewRule,
        description: "Detailed description",
        applies_to_products: ["product-1", "product-2"],
        applies_to_customers: ["customer-1"],
        effective_to: "2024-12-31T23:59:59Z",
        priority: 5,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => fullRule,
      });

      const { result } = renderHook(() => useCreateCommissionRule(), {
        wrapper: createWrapper(),
      });

      const input: CreateCommissionRuleInput = {
        partner_id: "partner-123",
        rule_name: "Full Rule",
        description: "Detailed description",
        commission_type: "revenue_share",
        commission_rate: 0.15,
        applies_to_products: ["product-1", "product-2"],
        applies_to_customers: ["customer-1"],
        effective_from: "2024-02-01T00:00:00Z",
        effective_to: "2024-12-31T23:59:59Z",
        is_active: true,
        priority: 5,
      };

      await act(async () => {
        await result.current.mutateAsync(input);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify(input),
        }),
      );
    });
  });

  describe("useUpdateCommissionRule", () => {
    const mockUpdatedRule: CommissionRule = {
      id: "rule-1",
      partner_id: "partner-123",
      tenant_id: "tenant-456",
      rule_name: "Updated Rule",
      commission_type: "revenue_share",
      commission_rate: 0.2,
      effective_from: "2024-01-01T00:00:00Z",
      is_active: false,
      priority: 1,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-02-01T00:00:00Z",
    };

    it("should update commission rule successfully", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockUpdatedRule,
      });

      const { result } = renderHook(() => useUpdateCommissionRule(), {
        wrapper: createWrapper(),
      });

      const data: UpdateCommissionRuleInput = {
        rule_name: "Updated Rule",
        commission_rate: 0.2,
        is_active: false,
      };

      let updatedRule: CommissionRule | undefined;
      await act(async () => {
        updatedRule = await result.current.mutateAsync({
          ruleId: "rule-1",
          data,
        });
      });

      expect(updatedRule).toEqual(mockUpdatedRule);
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8000/api/v1/partners/commission-rules/rule-1",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(data),
        },
      );
    });

    it("should update single field", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ ...mockUpdatedRule, is_active: false }),
      });

      const { result } = renderHook(() => useUpdateCommissionRule(), {
        wrapper: createWrapper(),
      });

      const data: UpdateCommissionRuleInput = {
        is_active: false,
      };

      await act(async () => {
        await result.current.mutateAsync({ ruleId: "rule-1", data });
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify(data),
        }),
      );
    });

    it("should update commission type from revenue_share to flat_fee", async () => {
      const updatedRule = {
        ...mockUpdatedRule,
        commission_type: "flat_fee" as const,
        flat_fee_amount: 100.0,
        commission_rate: undefined,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => updatedRule,
      });

      const { result } = renderHook(() => useUpdateCommissionRule(), {
        wrapper: createWrapper(),
      });

      const data: UpdateCommissionRuleInput = {
        commission_type: "flat_fee",
        flat_fee_amount: 100.0,
        commission_rate: undefined,
      };

      await act(async () => {
        await result.current.mutateAsync({ ruleId: "rule-1", data });
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify(data),
        }),
      );
    });

    it("should invalidate queries after successful update", async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockUpdatedRule,
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useUpdateCommissionRule(), {
        wrapper,
      });

      await act(async () => {
        await result.current.mutateAsync({
          ruleId: "rule-1",
          data: { rule_name: "Updated" },
        });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["commission-rules"],
      });
    });

    it("should handle update error", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ detail: "Rule not found" }),
      });

      const { result } = renderHook(() => useUpdateCommissionRule(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            ruleId: "rule-999",
            data: { rule_name: "Updated" },
          });
        }),
      ).rejects.toThrow("Rule not found");
    });

    it("should set isPending state correctly", async () => {
      let resolveFetch: (value: any) => void;
      const fetchPromise = new Promise((resolve) => {
        resolveFetch = resolve;
      });

      (global.fetch as jest.Mock).mockImplementation(() => fetchPromise);

      const { result } = renderHook(() => useUpdateCommissionRule(), {
        wrapper: createWrapper(),
      });

      // Start mutation
      act(() => {
        result.current.mutate({
          ruleId: "rule-1",
          data: { rule_name: "Updated" },
        });
      });

      // Wait for pending state to be set
      await waitFor(() => expect(result.current.isPending).toBe(true));

      // Resolve the fetch
      act(() => {
        resolveFetch!({
          ok: true,
          json: async () => mockUpdatedRule,
        });
      });

      // Should not be pending after completion
      await waitFor(() => expect(result.current.isPending).toBe(false));
    });

    it("should update effective dates", async () => {
      const updatedRule = {
        ...mockUpdatedRule,
        effective_from: "2024-03-01T00:00:00Z",
        effective_to: "2024-12-31T23:59:59Z",
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => updatedRule,
      });

      const { result } = renderHook(() => useUpdateCommissionRule(), {
        wrapper: createWrapper(),
      });

      const data: UpdateCommissionRuleInput = {
        effective_from: "2024-03-01T00:00:00Z",
        effective_to: "2024-12-31T23:59:59Z",
      };

      await act(async () => {
        await result.current.mutateAsync({ ruleId: "rule-1", data });
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify(data),
        }),
      );
    });

    it("should update applies_to arrays", async () => {
      const updatedRule = {
        ...mockUpdatedRule,
        applies_to_products: ["product-1", "product-2"],
        applies_to_customers: ["customer-1"],
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => updatedRule,
      });

      const { result } = renderHook(() => useUpdateCommissionRule(), {
        wrapper: createWrapper(),
      });

      const data: UpdateCommissionRuleInput = {
        applies_to_products: ["product-1", "product-2"],
        applies_to_customers: ["customer-1"],
      };

      await act(async () => {
        await result.current.mutateAsync({ ruleId: "rule-1", data });
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify(data),
        }),
      );
    });
  });

  describe("useDeleteCommissionRule", () => {
    it("should delete commission rule successfully", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
      });

      const { result } = renderHook(() => useDeleteCommissionRule(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync("rule-1");
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8000/api/v1/partners/commission-rules/rule-1",
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        },
      );
    });

    it("should invalidate queries after successful deletion", async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useDeleteCommissionRule(), {
        wrapper,
      });

      await act(async () => {
        await result.current.mutateAsync("rule-1");
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["commission-rules"],
      });
    });

    it("should handle delete error", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ detail: "Rule not found" }),
      });

      const { result } = renderHook(() => useDeleteCommissionRule(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync("rule-999");
        }),
      ).rejects.toThrow("Rule not found");
    });

    it("should handle 403 forbidden error", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ detail: "Permission denied" }),
      });

      const { result } = renderHook(() => useDeleteCommissionRule(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync("rule-1");
        }),
      ).rejects.toThrow("Permission denied");
    });

    it("should set isPending state correctly", async () => {
      let resolveFetch: (value: any) => void;
      const fetchPromise = new Promise((resolve) => {
        resolveFetch = resolve;
      });

      (global.fetch as jest.Mock).mockImplementation(() => fetchPromise);

      const { result } = renderHook(() => useDeleteCommissionRule(), {
        wrapper: createWrapper(),
      });

      // Start mutation
      act(() => {
        result.current.mutate("rule-1");
      });

      // Wait for pending state to be set
      await waitFor(() => expect(result.current.isPending).toBe(true));

      // Resolve the fetch
      act(() => {
        resolveFetch!({
          ok: true,
        });
      });

      // Should not be pending after completion
      await waitFor(() => expect(result.current.isPending).toBe(false));
    });

    it("should handle JSON parse error on delete", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error("Invalid JSON");
        },
      });

      const { result } = renderHook(() => useDeleteCommissionRule(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync("rule-1");
        }),
      ).rejects.toThrow("Failed to delete commission rule");
    });
  });

  // Authentication header tests removed (client no longer sets Authorization)

  describe("Credentials", () => {
    it("should always include credentials: include", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ rules: [], total: 0, page: 1, page_size: 10 }),
      });

      renderHook(() => useCommissionRules(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            credentials: "include",
          }),
        );
      });
    });
  });
});
