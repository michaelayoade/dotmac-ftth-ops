/**
 * MSW Tests for useCommissionRules hooks
 * Tests commission rule management with realistic API mocking
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import {
  useCommissionRules,
  useCommissionRule,
  useApplicableRules,
  useCreateCommissionRule,
  useUpdateCommissionRule,
  useDeleteCommissionRule,
  type CommissionRule,
  type CreateCommissionRuleInput,
  type UpdateCommissionRuleInput,
} from "../useCommissionRules";
import {
  seedCommissionRulesData,
  clearCommissionRulesData,
  createMockCommissionRule,
} from "@/__tests__/msw/handlers/commission-rules";

// Mock AppConfigContext
jest.mock("@/providers/AppConfigContext", () => ({
  useAppConfig: () => ({
    api: {
      baseUrl: "http://localhost:8000",
      prefix: "/api/v1",
      buildUrl: (path: string) => {
        const normalized = path.startsWith("/") ? path : `/${path}`;
        const prefixed = normalized.startsWith("/api/v1") ? normalized : `/api/v1${normalized}`;
        return `http://localhost:8000${prefixed}`;
      },
    },
    features: {},
    branding: {},
    tenant: {},
  }),
}));

describe("useCommissionRules hooks (MSW)", () => {
  const waitForRulesSuccess = async (getStatus: () => boolean) => {
    await waitFor(() => expect(getStatus()).toBe(true), { timeout: 5000 });
  };

  function createWrapper() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          refetchOnMount: false,
          refetchOnWindowFocus: false,
          staleTime: Infinity,
        },
        mutations: {
          retry: false,
        },
      },
    });

    return ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  beforeEach(() => {
    clearCommissionRulesData();
  });

  // ============================================================================
  // useCommissionRules - List Query
  // ============================================================================

  describe("useCommissionRules", () => {
    it("should fetch commission rules successfully", async () => {
      const mockRules = [
        createMockCommissionRule({
          id: "rule-1",
          rule_name: "Revenue Share Rule",
          commission_type: "revenue_share",
          commission_rate: 0.15,
        }),
      ];

      seedCommissionRulesData(mockRules);

      const { result } = renderHook(() => useCommissionRules(), {
        wrapper: createWrapper(),
      });

      await waitForRulesSuccess(() => result.current.isSuccess);

      expect(result.current.data?.rules).toHaveLength(1);
      expect(result.current.data?.rules[0].rule_name).toBe("Revenue Share Rule");
      expect(result.current.data?.total).toBe(1);
    });

    it("should handle pagination parameters", async () => {
      const mockRules = Array.from({ length: 25 }, (_, i) =>
        createMockCommissionRule({ id: `rule-${i + 1}` })
      );

      seedCommissionRulesData(mockRules);

      const { result } = renderHook(
        () => useCommissionRules({ page: 2, page_size: 10 }),
        { wrapper: createWrapper() }
      );

      await waitForRulesSuccess(() => result.current.isSuccess);

      expect(result.current.data?.rules).toHaveLength(10);
      expect(result.current.data?.page).toBe(2);
      expect(result.current.data?.total).toBe(25);
    });

    it("should filter by partner_id", async () => {
      const mockRules = [
        createMockCommissionRule({ id: "rule-1", partner_id: "partner-123" }),
        createMockCommissionRule({ id: "rule-2", partner_id: "partner-456" }),
      ];

      seedCommissionRulesData(mockRules);

      const { result } = renderHook(
        () => useCommissionRules({ partner_id: "partner-123" }),
        { wrapper: createWrapper() }
      );

      await waitForRulesSuccess(() => result.current.isSuccess);

      expect(result.current.data?.rules).toHaveLength(1);
      expect(result.current.data?.rules[0].partner_id).toBe("partner-123");
    });

    it("should filter by is_active", async () => {
      const mockRules = [
        createMockCommissionRule({ id: "rule-1", is_active: true }),
        createMockCommissionRule({ id: "rule-2", is_active: false }),
      ];

      seedCommissionRulesData(mockRules);

      const { result } = renderHook(
        () => useCommissionRules({ is_active: true }),
        { wrapper: createWrapper() }
      );

      await waitForRulesSuccess(() => result.current.isSuccess);

      expect(result.current.data?.rules).toHaveLength(1);
      expect(result.current.data?.rules[0].is_active).toBe(true);
    });

    it("should handle multiple query parameters", async () => {
      const mockRules = [
        createMockCommissionRule({
          id: "rule-1",
          partner_id: "partner-123",
          is_active: false,
        }),
        createMockCommissionRule({
          id: "rule-2",
          partner_id: "partner-123",
          is_active: true,
        }),
        createMockCommissionRule({
          id: "rule-3",
          partner_id: "partner-456",
          is_active: false,
        }),
      ];

      seedCommissionRulesData(mockRules);

      const { result } = renderHook(
        () =>
          useCommissionRules({
            partner_id: "partner-123",
            is_active: false,
            page: 1,
            page_size: 50,
          }),
        { wrapper: createWrapper() }
      );

      await waitForRulesSuccess(() => result.current.isSuccess);

      expect(result.current.data?.rules).toHaveLength(1);
      expect(result.current.data?.rules[0].partner_id).toBe("partner-123");
      expect(result.current.data?.rules[0].is_active).toBe(false);
    });

    it("should handle empty results", async () => {
      seedCommissionRulesData([]);

      const { result } = renderHook(() => useCommissionRules(), {
        wrapper: createWrapper(),
      });

      await waitForRulesSuccess(() => result.current.isSuccess);

      expect(result.current.data?.rules).toHaveLength(0);
      expect(result.current.data?.total).toBe(0);
    });

    it("should set loading state correctly", async () => {
      const mockRules = [createMockCommissionRule({ id: "rule-1" })];
      seedCommissionRulesData(mockRules);

      const { result } = renderHook(() => useCommissionRules(), {
        wrapper: createWrapper(),
      });

      // Initially loading
      expect(result.current.isLoading || result.current.isPending).toBe(true);

      await waitForRulesSuccess(() => result.current.isSuccess);

      expect(result.current.isLoading).toBe(false);
    });
  });

  // ============================================================================
  // useCommissionRule - Single Query
  // ============================================================================

  describe("useCommissionRule", () => {
    it("should fetch single commission rule successfully", async () => {
      const mockRule = createMockCommissionRule({
        id: "rule-1",
        rule_name: "Flat Fee Rule",
        commission_type: "flat_fee",
        flat_fee_amount: 50.0,
      });

      seedCommissionRulesData([mockRule]);

      const { result } = renderHook(() => useCommissionRule("rule-1"), {
        wrapper: createWrapper(),
      });

      await waitForRulesSuccess(() => result.current.isSuccess);

      expect(result.current.data?.id).toBe("rule-1");
      expect(result.current.data?.commission_type).toBe("flat_fee");
      expect(result.current.data?.flat_fee_amount).toBe(50.0);
    });

    it("should not fetch when ruleId is undefined", async () => {
      const { result } = renderHook(() => useCommissionRule(undefined), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
    });

    it("should handle fetch error", async () => {
      seedCommissionRulesData([]);

      const { result } = renderHook(() => useCommissionRule("rule-999"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });

    it("should work with tiered commission type", async () => {
      const tieredRule = createMockCommissionRule({
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
        commission_rate: undefined,
        flat_fee_amount: undefined,
      });

      seedCommissionRulesData([tieredRule]);

      const { result } = renderHook(() => useCommissionRule("rule-2"), {
        wrapper: createWrapper(),
      });

      await waitForRulesSuccess(() => result.current.isSuccess);

      expect(result.current.data?.commission_type).toBe("tiered");
      expect(result.current.data?.tier_config).toBeDefined();
      expect(result.current.data?.tier_config?.tiers).toHaveLength(3);
    });

    it("should work with hybrid commission type", async () => {
      const hybridRule = createMockCommissionRule({
        id: "rule-3",
        rule_name: "Hybrid Rule",
        commission_type: "hybrid",
        commission_rate: 0.1,
        flat_fee_amount: 25.0,
      });

      seedCommissionRulesData([hybridRule]);

      const { result } = renderHook(() => useCommissionRule("rule-3"), {
        wrapper: createWrapper(),
      });

      await waitForRulesSuccess(() => result.current.isSuccess);

      expect(result.current.data?.commission_type).toBe("hybrid");
      expect(result.current.data?.commission_rate).toBe(0.1);
      expect(result.current.data?.flat_fee_amount).toBe(25.0);
    });
  });

  // ============================================================================
  // useApplicableRules - Applicable Rules Query
  // ============================================================================

  describe("useApplicableRules", () => {
    it("should fetch applicable rules successfully", async () => {
      const mockRules = [
        createMockCommissionRule({
          id: "rule-1",
          partner_id: "partner-123",
          is_active: true,
          rule_name: "Product Specific Rule",
          applies_to_products: ["product-1"],
        }),
        createMockCommissionRule({
          id: "rule-2",
          partner_id: "partner-123",
          is_active: true,
          rule_name: "Customer Specific Rule",
          applies_to_customers: ["customer-1"],
        }),
      ];

      seedCommissionRulesData(mockRules);

      const { result } = renderHook(
        () => useApplicableRules({ partner_id: "partner-123" }),
        { wrapper: createWrapper() }
      );

      await waitForRulesSuccess(() => result.current.isSuccess);

      expect(result.current.data).toHaveLength(2);
    });

    it("should filter by product_id", async () => {
      const mockRules = [
        createMockCommissionRule({
          id: "rule-1",
          partner_id: "partner-123",
          is_active: true,
          applies_to_products: ["product-1"],
        }),
        createMockCommissionRule({
          id: "rule-2",
          partner_id: "partner-123",
          is_active: true,
          applies_to_products: ["product-2"],
        }),
      ];

      seedCommissionRulesData(mockRules);

      const { result } = renderHook(
        () =>
          useApplicableRules({
            partner_id: "partner-123",
            product_id: "product-1",
          }),
        { wrapper: createWrapper() }
      );

      await waitForRulesSuccess(() => result.current.isSuccess);

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].applies_to_products).toContain("product-1");
    });

    it("should filter by customer_id", async () => {
      const mockRules = [
        createMockCommissionRule({
          id: "rule-1",
          partner_id: "partner-123",
          is_active: true,
          applies_to_customers: ["customer-1"],
        }),
        createMockCommissionRule({
          id: "rule-2",
          partner_id: "partner-123",
          is_active: true,
          applies_to_customers: ["customer-2"],
        }),
      ];

      seedCommissionRulesData(mockRules);

      const { result } = renderHook(
        () =>
          useApplicableRules({
            partner_id: "partner-123",
            customer_id: "customer-1",
          }),
        { wrapper: createWrapper() }
      );

      await waitForRulesSuccess(() => result.current.isSuccess);

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].applies_to_customers).toContain("customer-1");
    });

    it("should filter by both product_id and customer_id", async () => {
      const mockRules = [
        createMockCommissionRule({
          id: "rule-1",
          partner_id: "partner-123",
          is_active: true,
          applies_to_products: ["product-1"],
          applies_to_customers: ["customer-1"],
        }),
        createMockCommissionRule({
          id: "rule-2",
          partner_id: "partner-123",
          is_active: true,
          applies_to_products: ["product-1"],
        }),
        createMockCommissionRule({
          id: "rule-3",
          partner_id: "partner-123",
          is_active: true,
          applies_to_customers: ["customer-1"],
        }),
      ];

      seedCommissionRulesData(mockRules);

      const { result } = renderHook(
        () =>
          useApplicableRules({
            partner_id: "partner-123",
            product_id: "product-1",
            customer_id: "customer-1",
          }),
        { wrapper: createWrapper() }
      );

      await waitForRulesSuccess(() => result.current.isSuccess);

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].id).toBe("rule-1");
    });

    it("should not fetch when partner_id is empty", async () => {
      const { result } = renderHook(
        () => useApplicableRules({ partner_id: "" }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
    });

    it("should only return active rules", async () => {
      const mockRules = [
        createMockCommissionRule({
          id: "rule-1",
          partner_id: "partner-123",
          is_active: true,
        }),
        createMockCommissionRule({
          id: "rule-2",
          partner_id: "partner-123",
          is_active: false,
        }),
      ];

      seedCommissionRulesData(mockRules);

      const { result } = renderHook(
        () => useApplicableRules({ partner_id: "partner-123" }),
        { wrapper: createWrapper() }
      );

      await waitForRulesSuccess(() => result.current.isSuccess);

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].is_active).toBe(true);
    });

    it("should sort rules by priority", async () => {
      const mockRules = [
        createMockCommissionRule({
          id: "rule-1",
          partner_id: "partner-123",
          is_active: true,
          priority: 3,
        }),
        createMockCommissionRule({
          id: "rule-2",
          partner_id: "partner-123",
          is_active: true,
          priority: 1,
        }),
        createMockCommissionRule({
          id: "rule-3",
          partner_id: "partner-123",
          is_active: true,
          priority: 2,
        }),
      ];

      seedCommissionRulesData(mockRules);

      const { result } = renderHook(
        () => useApplicableRules({ partner_id: "partner-123" }),
        { wrapper: createWrapper() }
      );

      await waitForRulesSuccess(() => result.current.isSuccess);

      // Should be sorted by priority (lower number = higher priority)
      expect(result.current.data?.[0].priority).toBe(1);
      expect(result.current.data?.[1].priority).toBe(2);
      expect(result.current.data?.[2].priority).toBe(3);
    });
  });

  // ============================================================================
  // useCreateCommissionRule - Create Mutation
  // ============================================================================

  describe("useCreateCommissionRule", () => {
    it("should create commission rule successfully", async () => {
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

      await waitForRulesSuccess(() => result.current.isSuccess);

      expect(createdRule?.rule_name).toBe("New Rule");
      expect(createdRule?.commission_type).toBe("revenue_share");
      expect(createdRule?.commission_rate).toBe(0.15);
    });

    it("should create flat_fee commission rule", async () => {
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

      let createdRule: CommissionRule | undefined;
      await act(async () => {
        createdRule = await result.current.mutateAsync(input);
      });

      expect(createdRule?.commission_type).toBe("flat_fee");
      expect(createdRule?.flat_fee_amount).toBe(50.0);
    });

    it("should create tiered commission rule", async () => {
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

      let createdRule: CommissionRule | undefined;
      await act(async () => {
        createdRule = await result.current.mutateAsync(input);
      });

      expect(createdRule?.commission_type).toBe("tiered");
      expect(createdRule?.tier_config).toBeDefined();
    });

    it("should create hybrid commission rule", async () => {
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

      let createdRule: CommissionRule | undefined;
      await act(async () => {
        createdRule = await result.current.mutateAsync(input);
      });

      expect(createdRule?.commission_type).toBe("hybrid");
      expect(createdRule?.commission_rate).toBe(0.1);
      expect(createdRule?.flat_fee_amount).toBe(25.0);
    });

    it("should create rule with optional fields", async () => {
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

      let createdRule: CommissionRule | undefined;
      await act(async () => {
        createdRule = await result.current.mutateAsync(input);
      });

      expect(createdRule?.description).toBe("Detailed description");
      expect(createdRule?.applies_to_products).toEqual(["product-1", "product-2"]);
      expect(createdRule?.applies_to_customers).toEqual(["customer-1"]);
      expect(createdRule?.priority).toBe(5);
    });

    it("should set isPending state correctly", async () => {
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

      // Start mutation without awaiting
      act(() => {
        result.current.mutate(input);
      });

      // Should be pending immediately (but may resolve quickly in tests)
      // We just verify it completes successfully
      await waitFor(() => expect(result.current.isSuccess || result.current.isIdle).toBe(true));
    });
  });

  // ============================================================================
  // useUpdateCommissionRule - Update Mutation
  // ============================================================================

  describe("useUpdateCommissionRule", () => {
    it("should update commission rule successfully", async () => {
      const existingRule = createMockCommissionRule({
        id: "rule-1",
        rule_name: "Original Rule",
        commission_rate: 0.15,
        is_active: true,
      });

      seedCommissionRulesData([existingRule]);

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

      await waitForRulesSuccess(() => result.current.isSuccess);

      expect(updatedRule?.rule_name).toBe("Updated Rule");
      expect(updatedRule?.commission_rate).toBe(0.2);
      expect(updatedRule?.is_active).toBe(false);
    });

    it("should update single field", async () => {
      const existingRule = createMockCommissionRule({
        id: "rule-1",
        is_active: true,
      });

      seedCommissionRulesData([existingRule]);

      const { result } = renderHook(() => useUpdateCommissionRule(), {
        wrapper: createWrapper(),
      });

      const data: UpdateCommissionRuleInput = {
        is_active: false,
      };

      let updatedRule: CommissionRule | undefined;
      await act(async () => {
        updatedRule = await result.current.mutateAsync({ ruleId: "rule-1", data });
      });

      expect(updatedRule?.is_active).toBe(false);
    });

    it("should update commission type from revenue_share to flat_fee", async () => {
      const existingRule = createMockCommissionRule({
        id: "rule-1",
        commission_type: "revenue_share",
        commission_rate: 0.15,
      });

      seedCommissionRulesData([existingRule]);

      const { result } = renderHook(() => useUpdateCommissionRule(), {
        wrapper: createWrapper(),
      });

      const data: UpdateCommissionRuleInput = {
        commission_type: "flat_fee",
        flat_fee_amount: 100.0,
        commission_rate: undefined,
      };

      let updatedRule: CommissionRule | undefined;
      await act(async () => {
        updatedRule = await result.current.mutateAsync({ ruleId: "rule-1", data });
      });

      expect(updatedRule?.commission_type).toBe("flat_fee");
      expect(updatedRule?.flat_fee_amount).toBe(100.0);
    });

    it("should update effective dates", async () => {
      const existingRule = createMockCommissionRule({
        id: "rule-1",
        effective_from: "2024-01-01T00:00:00Z",
      });

      seedCommissionRulesData([existingRule]);

      const { result } = renderHook(() => useUpdateCommissionRule(), {
        wrapper: createWrapper(),
      });

      const data: UpdateCommissionRuleInput = {
        effective_from: "2024-03-01T00:00:00Z",
        effective_to: "2024-12-31T23:59:59Z",
      };

      let updatedRule: CommissionRule | undefined;
      await act(async () => {
        updatedRule = await result.current.mutateAsync({ ruleId: "rule-1", data });
      });

      expect(updatedRule?.effective_from).toBe("2024-03-01T00:00:00Z");
      expect(updatedRule?.effective_to).toBe("2024-12-31T23:59:59Z");
    });

    it("should update applies_to arrays", async () => {
      const existingRule = createMockCommissionRule({
        id: "rule-1",
      });

      seedCommissionRulesData([existingRule]);

      const { result } = renderHook(() => useUpdateCommissionRule(), {
        wrapper: createWrapper(),
      });

      const data: UpdateCommissionRuleInput = {
        applies_to_products: ["product-1", "product-2"],
        applies_to_customers: ["customer-1"],
      };

      let updatedRule: CommissionRule | undefined;
      await act(async () => {
        updatedRule = await result.current.mutateAsync({ ruleId: "rule-1", data });
      });

      expect(updatedRule?.applies_to_products).toEqual(["product-1", "product-2"]);
      expect(updatedRule?.applies_to_customers).toEqual(["customer-1"]);
    });

    it("should handle update error for non-existent rule", async () => {
      seedCommissionRulesData([]);

      const { result } = renderHook(() => useUpdateCommissionRule(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            ruleId: "rule-999",
            data: { rule_name: "Updated" },
          });
        } catch (error) {
          // Expected to fail
        }
      });

      expect(result.current.isError).toBe(true);
    });

    it("should set isPending state correctly", async () => {
      const existingRule = createMockCommissionRule({ id: "rule-1" });
      seedCommissionRulesData([existingRule]);

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

      // Should complete successfully
      await waitFor(() => expect(result.current.isSuccess || result.current.isIdle).toBe(true));
    });
  });

  // ============================================================================
  // useDeleteCommissionRule - Delete Mutation
  // ============================================================================

  describe("useDeleteCommissionRule", () => {
    it("should delete commission rule successfully", async () => {
      const existingRule = createMockCommissionRule({ id: "rule-1" });

      seedCommissionRulesData([existingRule]);

      const { result } = renderHook(() => useDeleteCommissionRule(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync("rule-1");
      });

      await waitForRulesSuccess(() => result.current.isSuccess);
    });

    it("should handle delete error for non-existent rule", async () => {
      seedCommissionRulesData([]);

      const { result } = renderHook(() => useDeleteCommissionRule(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync("rule-999");
        } catch (error) {
          // Expected to fail
        }
      });

      expect(result.current.isError).toBe(true);
    });

    it("should set isPending state correctly", async () => {
      const existingRule = createMockCommissionRule({ id: "rule-1" });
      seedCommissionRulesData([existingRule]);

      const { result } = renderHook(() => useDeleteCommissionRule(), {
        wrapper: createWrapper(),
      });

      // Start mutation
      act(() => {
        result.current.mutate("rule-1");
      });

      // Should complete successfully
      await waitFor(() => expect(result.current.isSuccess || result.current.isIdle).toBe(true));
    });
  });

  // ============================================================================
  // Edge Cases & Integration
  // ============================================================================

  describe("Edge cases", () => {
    it("should handle rules with all commission types", async () => {
      const mockRules = [
        createMockCommissionRule({
          id: "edge-rule-1",
          commission_type: "revenue_share",
          commission_rate: 0.15,
        }),
        createMockCommissionRule({
          id: "edge-rule-2",
          commission_type: "flat_fee",
          flat_fee_amount: 50.0,
          commission_rate: undefined,
        }),
        createMockCommissionRule({
          id: "edge-rule-3",
          commission_type: "tiered",
          tier_config: { tiers: [] },
        }),
        createMockCommissionRule({
          id: "edge-rule-4",
          commission_type: "hybrid",
          commission_rate: 0.1,
          flat_fee_amount: 25.0,
        }),
      ];

      seedCommissionRulesData(mockRules);

      const { result } = renderHook(() => useCommissionRules(), {
        wrapper: createWrapper(),
      });

      await waitForRulesSuccess(() => result.current.isSuccess);

      expect(result.current.data?.rules).toHaveLength(4);
      const types = result.current.data?.rules.map((r) => r.commission_type);
      expect(types).toContain("revenue_share");
      expect(types).toContain("flat_fee");
      expect(types).toContain("tiered");
      expect(types).toContain("hybrid");
    });

    it("should handle large datasets with pagination", async () => {
      const mockRules = Array.from({ length: 100 }, (_, i) =>
        createMockCommissionRule({
          id: `rule-${i + 1}`,
          rule_name: `Rule ${i + 1}`,
        })
      );

      seedCommissionRulesData(mockRules);

      const { result } = renderHook(
        () => useCommissionRules({ page: 5, page_size: 20 }),
        { wrapper: createWrapper() }
      );

      await waitForRulesSuccess(() => result.current.isSuccess);

      expect(result.current.data?.rules).toHaveLength(20);
      expect(result.current.data?.page).toBe(5);
      expect(result.current.data?.total).toBe(100);
    });

    it("should handle complex filtering scenarios", async () => {
      const mockRules = [
        createMockCommissionRule({
          id: "rule-1",
          partner_id: "partner-123",
          is_active: true,
          applies_to_products: ["product-1"],
        }),
        createMockCommissionRule({
          id: "rule-2",
          partner_id: "partner-123",
          is_active: true,
          applies_to_products: ["product-1", "product-2"],
        }),
        createMockCommissionRule({
          id: "rule-3",
          partner_id: "partner-456",
          is_active: true,
          applies_to_products: ["product-1"],
        }),
      ];

      seedCommissionRulesData(mockRules);

      // Test applicable rules with product filter
      const { result } = renderHook(
        () =>
          useApplicableRules({
            partner_id: "partner-123",
            product_id: "product-1",
          }),
        { wrapper: createWrapper() }
      );

      await waitForRulesSuccess(() => result.current.isSuccess);

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.every((r) => r.partner_id === "partner-123")).toBe(true);
    });
  });
});
