/**
 * Jest Mock Tests for useCommissionRules hooks
 * Tests commission rule management with Jest mocks
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

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Import MSW server
const { server } = require("../../__tests__/msw/server");

describe("useCommissionRules hooks (Jest Mocks)", () => {
  let queryClient: QueryClient;

  function createWrapper() {
    queryClient = new QueryClient({
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

  beforeAll(() => {
    // Stop MSW server for this test suite since we're using Jest mocks
    server.close();
  });

  afterAll(() => {
    // Restart MSW server after this test suite
    server.listen({ onUnhandledRequest: "warn" });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  afterEach(() => {
    queryClient?.clear();
  });

  // Helper to create mock commission rule
  const createMockCommissionRule = (overrides?: Partial<CommissionRule>): CommissionRule => ({
    id: "rule-1",
    partner_id: "partner-1",
    tenant_id: "tenant-1",
    rule_name: "Test Rule",
    description: "Test Description",
    commission_type: "revenue_share",
    commission_rate: 0.15,
    applies_to_products: [],
    applies_to_customers: [],
    effective_from: "2024-01-01T00:00:00Z",
    is_active: true,
    priority: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  });

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

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          rules: mockRules,
          total: 1,
          page: 1,
          page_size: 20,
        }),
      } as unknown as Response);

      const { result } = renderHook(() => useCommissionRules(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.rules).toHaveLength(1);
      expect(result.current.data?.rules[0].rule_name).toBe("Revenue Share Rule");
      expect(result.current.data?.total).toBe(1);
    });

    it("should handle pagination parameters", async () => {
      const mockRules = Array.from({ length: 10 }, (_, i) =>
        createMockCommissionRule({ id: `rule-${i + 11}` }),
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          rules: mockRules,
          total: 25,
          page: 2,
          page_size: 10,
        }),
      } as unknown as Response);

      const { result } = renderHook(() => useCommissionRules({ page: 2, page_size: 10 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.rules).toHaveLength(10);
      expect(result.current.data?.page).toBe(2);
      expect(result.current.data?.total).toBe(25);
    });

    it("should filter by partner_id", async () => {
      const mockRules = [createMockCommissionRule({ id: "rule-1", partner_id: "partner-123" })];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          rules: mockRules,
          total: 1,
          page: 1,
          page_size: 20,
        }),
      } as unknown as Response);

      const { result } = renderHook(() => useCommissionRules({ partner_id: "partner-123" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.rules).toHaveLength(1);
      expect(result.current.data?.rules[0].partner_id).toBe("partner-123");
    });

    it("should filter by is_active", async () => {
      const mockRules = [createMockCommissionRule({ id: "rule-1", is_active: true })];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          rules: mockRules,
          total: 1,
          page: 1,
          page_size: 20,
        }),
      } as unknown as Response);

      const { result } = renderHook(() => useCommissionRules({ is_active: true }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.rules).toHaveLength(1);
      expect(result.current.data?.rules[0].is_active).toBe(true);
    });

    it("should handle empty results", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          rules: [],
          total: 0,
          page: 1,
          page_size: 20,
        }),
      } as unknown as Response);

      const { result } = renderHook(() => useCommissionRules(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.rules).toHaveLength(0);
      expect(result.current.data?.total).toBe(0);
    });

    it("should handle fetch error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ detail: "Server error" }),
      } as unknown as Response);

      const { result } = renderHook(() => useCommissionRules(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBeTruthy();
    });
  });

  describe("useCommissionRule", () => {
    it("should fetch single commission rule successfully", async () => {
      const mockRule = createMockCommissionRule({
        id: "rule-1",
        rule_name: "Flat Fee Rule",
        commission_type: "flat_fee",
        flat_fee_amount: 50.0,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRule,
      } as unknown as Response);

      const { result } = renderHook(() => useCommissionRule("rule-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

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
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should handle fetch error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ detail: "Not found" }),
      } as unknown as Response);

      const { result } = renderHook(() => useCommissionRule("rule-999"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBeTruthy();
    });
  });

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
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRules,
      } as unknown as Response);

      const { result } = renderHook(() => useApplicableRules({ partner_id: "partner-123" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].partner_id).toBe("partner-123");
    });

    it("should not fetch when partner_id is empty", async () => {
      const { result } = renderHook(() => useApplicableRules({ partner_id: "" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("useCreateCommissionRule", () => {
    it("should create commission rule successfully", async () => {
      const input: CreateCommissionRuleInput = {
        partner_id: "partner-123",
        rule_name: "New Rule",
        commission_type: "revenue_share",
        commission_rate: 0.15,
        effective_from: "2024-02-01T00:00:00Z",
      };

      const createdRule = createMockCommissionRule({
        id: "rule-new",
        ...input,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createdRule,
      } as unknown as Response);

      const { result } = renderHook(() => useCreateCommissionRule(), {
        wrapper: createWrapper(),
      });

      let newRule: CommissionRule | undefined;
      await act(async () => {
        newRule = await result.current.mutateAsync(input);
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(newRule?.rule_name).toBe("New Rule");
      expect(newRule?.commission_type).toBe("revenue_share");
      expect(newRule?.commission_rate).toBe(0.15);
    });

    it("should create flat_fee commission rule", async () => {
      const input: CreateCommissionRuleInput = {
        partner_id: "partner-123",
        rule_name: "Flat Fee Rule",
        commission_type: "flat_fee",
        flat_fee_amount: 50.0,
        effective_from: "2024-02-01T00:00:00Z",
      };

      const createdRule = createMockCommissionRule({
        ...input,
        commission_rate: undefined,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createdRule,
      } as unknown as Response);

      const { result } = renderHook(() => useCreateCommissionRule(), {
        wrapper: createWrapper(),
      });

      let newRule: CommissionRule | undefined;
      await act(async () => {
        newRule = await result.current.mutateAsync(input);
      });

      expect(newRule?.commission_type).toBe("flat_fee");
      expect(newRule?.flat_fee_amount).toBe(50.0);
    });

    it("should handle create error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ detail: "Invalid data" }),
      } as unknown as Response);

      const { result } = renderHook(() => useCreateCommissionRule(), {
        wrapper: createWrapper(),
      });

      let errorCaught = false;
      let errorMessage = "";
      await act(async () => {
        try {
          await result.current.mutateAsync({
            partner_id: "partner-123",
            rule_name: "Invalid Rule",
            commission_type: "revenue_share",
            effective_from: "2024-01-01T00:00:00Z",
          });
        } catch (error) {
          errorCaught = true;
          errorMessage = error instanceof Error ? error.message : String(error);
        }
      });

      expect(errorCaught).toBe(true);
      expect(errorMessage).toContain("Invalid data");
    });
  });

  describe("useUpdateCommissionRule", () => {
    it("should update commission rule successfully", async () => {
      const data: UpdateCommissionRuleInput = {
        rule_name: "Updated Rule",
        commission_rate: 0.2,
        is_active: false,
      };

      const updatedRule = createMockCommissionRule({
        id: "rule-1",
        ...data,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => updatedRule,
      } as unknown as Response);

      const { result } = renderHook(() => useUpdateCommissionRule(), {
        wrapper: createWrapper(),
      });

      let updated: CommissionRule | undefined;
      await act(async () => {
        updated = await result.current.mutateAsync({
          ruleId: "rule-1",
          data,
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(updated?.rule_name).toBe("Updated Rule");
      expect(updated?.commission_rate).toBe(0.2);
      expect(updated?.is_active).toBe(false);
    });

    it("should update single field", async () => {
      const data: UpdateCommissionRuleInput = {
        is_active: false,
      };

      const updatedRule = createMockCommissionRule({
        id: "rule-1",
        is_active: false,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => updatedRule,
      } as unknown as Response);

      const { result } = renderHook(() => useUpdateCommissionRule(), {
        wrapper: createWrapper(),
      });

      let updated: CommissionRule | undefined;
      await act(async () => {
        updated = await result.current.mutateAsync({ ruleId: "rule-1", data });
      });

      expect(updated?.is_active).toBe(false);
    });

    it("should handle update error for non-existent rule", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ detail: "Not found" }),
      } as unknown as Response);

      const { result } = renderHook(() => useUpdateCommissionRule(), {
        wrapper: createWrapper(),
      });

      let errorCaught = false;
      let errorMessage = "";
      await act(async () => {
        try {
          await result.current.mutateAsync({
            ruleId: "rule-999",
            data: { rule_name: "Updated" },
          });
        } catch (error) {
          errorCaught = true;
          errorMessage = error instanceof Error ? error.message : String(error);
        }
      });

      expect(errorCaught).toBe(true);
      expect(errorMessage).toContain("Not found");
    });
  });

  describe("useDeleteCommissionRule", () => {
    it("should delete commission rule successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as unknown as Response);

      const { result } = renderHook(() => useDeleteCommissionRule(), {
        wrapper: createWrapper(),
      });

      let deleteCompleted = false;
      await act(async () => {
        await result.current.mutateAsync("rule-1");
        deleteCompleted = true;
      });

      expect(deleteCompleted).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/partners/commission-rules/rule-1"),
        expect.objectContaining({ method: "DELETE" }),
      );
    });

    it("should handle delete error for non-existent rule", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ detail: "Not found" }),
      } as unknown as Response);

      const { result } = renderHook(() => useDeleteCommissionRule(), {
        wrapper: createWrapper(),
      });

      let errorCaught = false;
      let errorMessage = "";
      await act(async () => {
        try {
          await result.current.mutateAsync("rule-999");
        } catch (error) {
          errorCaught = true;
          errorMessage = error instanceof Error ? error.message : String(error);
        }
      });

      expect(errorCaught).toBe(true);
      expect(errorMessage).toContain("Not found");
    });
  });

  describe("Edge cases", () => {
    it("should handle rules with all commission types", async () => {
      const mockRules = [
        createMockCommissionRule({
          id: "rule-1",
          commission_type: "revenue_share",
          commission_rate: 0.15,
        }),
        createMockCommissionRule({
          id: "rule-2",
          commission_type: "flat_fee",
          flat_fee_amount: 50.0,
          commission_rate: undefined,
        }),
        createMockCommissionRule({
          id: "rule-3",
          commission_type: "tiered",
          tier_config: { tiers: [] },
        }),
        createMockCommissionRule({
          id: "rule-4",
          commission_type: "hybrid",
          commission_rate: 0.1,
          flat_fee_amount: 25.0,
        }),
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          rules: mockRules,
          total: 4,
          page: 1,
          page_size: 20,
        }),
      } as unknown as Response);

      const { result } = renderHook(() => useCommissionRules(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.rules).toHaveLength(4);
      const types = result.current.data?.rules.map((r) => r.commission_type);
      expect(types).toContain("revenue_share");
      expect(types).toContain("flat_fee");
      expect(types).toContain("tiered");
      expect(types).toContain("hybrid");
    });
  });
});
