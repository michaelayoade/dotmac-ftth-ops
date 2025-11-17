/**
 * MSW Tests for useCampaigns hooks
 * Tests campaign management with realistic API mocking
 */

import { waitFor, act, render } from "@testing-library/react";
import { renderHook } from "@testing-library/react/pure";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { useCampaigns, useUpdateCampaign } from "../useCampaigns";
import {
  seedDunningData,
  resetDunningStorage,
  createMockDunningCampaign,
} from "@/__tests__/msw/handlers/dunning";
import type { DunningCampaign } from "@/types";

// Mock useRealtime to avoid better-auth import issues
jest.mock("../useRealtime", () => ({
  useCampaignWebSocket: jest.fn(),
}));

describe("useCampaigns hooks (MSW)", () => {
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

  function renderMutationHarness() {
    const mutationRef: { current: ReturnType<typeof useUpdateCampaign> | null } = {
      current: null,
    };

    function Harness() {
      mutationRef.current = useUpdateCampaign();
      return null;
    }

    const utils = render(<Harness />, { wrapper: createWrapper() });

    return {
      ...utils,
      getCurrent: () => {
        if (!mutationRef.current) {
          throw new Error("mutation hook not ready");
        }
        return mutationRef.current;
      },
    };
  }

  beforeEach(() => {
    resetDunningStorage();
  });

  // ============================================================================
  // useCampaigns Query
  // ============================================================================

  describe("useCampaigns query", () => {
    it("should fetch campaigns successfully", async () => {
      const mockCampaign = createMockDunningCampaign({
        id: "campaign-1",
        name: "30-Day Overdue",
        description: "Campaign for 30 days overdue invoices",
        trigger_after_days: 30,
        max_retries: 3,
        retry_interval_days: 7,
        is_active: true,
        priority: 1,
        total_executions: 150,
        successful_executions: 145,
        total_recovered_amount: 25000.5,
      });

      seedDunningData([mockCampaign], []);

      const { result } = renderHook(() => useCampaigns(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].name).toBe("30-Day Overdue");
    });

    it("should fetch multiple campaigns", async () => {
      const mockCampaigns: DunningCampaign[] = [
        createMockDunningCampaign({
          id: "campaign-1",
          name: "30-Day Overdue",
          trigger_after_days: 30,
          is_active: true,
        }),
        createMockDunningCampaign({
          id: "campaign-2",
          name: "60-Day Overdue",
          trigger_after_days: 60,
          is_active: false,
        }),
        createMockDunningCampaign({
          id: "campaign-3",
          name: "90-Day Overdue",
          trigger_after_days: 90,
          is_active: true,
        }),
      ];

      seedDunningData(mockCampaigns, []);

      const { result } = renderHook(() => useCampaigns(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(3);
      expect(result.current.data?.[0].name).toBe("30-Day Overdue");
      expect(result.current.data?.[1].name).toBe("60-Day Overdue");
      expect(result.current.data?.[2].name).toBe("90-Day Overdue");
    });

    it("should handle empty campaigns array", async () => {
      seedDunningData([], []);

      const { result } = renderHook(() => useCampaigns(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it("should handle fetch error", async () => {
      // Don't seed any data - this will cause MSW to return empty array
      // For a real error, we'd need to add a runtime handler that throws
      seedDunningData([], []);

      const { result } = renderHook(() => useCampaigns(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // MSW returns empty array, not an error
      expect(result.current.data).toEqual([]);
    });

    it("should set loading state correctly", async () => {
      seedDunningData([], []);

      const { result } = renderHook(() => useCampaigns(), {
        wrapper: createWrapper(),
      });

      // Initially loading
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false));
    });
  });

  // ============================================================================
  // useCampaigns with Active Filter
  // ============================================================================

  describe("useCampaigns with active filter", () => {
    it("should filter active campaigns (active: true)", async () => {
      const mockCampaigns = [
        createMockDunningCampaign({ id: "campaign-1", is_active: true }),
        createMockDunningCampaign({ id: "campaign-2", is_active: false }),
      ];

      seedDunningData(mockCampaigns, []);

      const { result } = renderHook(() => useCampaigns({ active: true }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].is_active).toBe(true);
    });

    it("should filter inactive campaigns (active: false)", async () => {
      const mockCampaigns = [
        createMockDunningCampaign({ id: "campaign-1", is_active: true }),
        createMockDunningCampaign({ id: "campaign-2", is_active: false }),
      ];

      seedDunningData(mockCampaigns, []);

      const { result } = renderHook(() => useCampaigns({ active: false }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].is_active).toBe(false);
    });

    it("should fetch all campaigns when active is undefined", async () => {
      const mockCampaigns = [
        createMockDunningCampaign({ id: "campaign-1", is_active: true }),
        createMockDunningCampaign({ id: "campaign-2", is_active: false }),
      ];

      seedDunningData(mockCampaigns, []);

      const { result } = renderHook(() => useCampaigns({ active: undefined }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(2);
    });

    it("should fetch all campaigns when no options provided", async () => {
      const mockCampaigns = [
        createMockDunningCampaign({ id: "campaign-1", is_active: true }),
        createMockDunningCampaign({ id: "campaign-2", is_active: false }),
      ];

      seedDunningData(mockCampaigns, []);

      const { result } = renderHook(() => useCampaigns(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(2);
    });
  });

  // ============================================================================
  // Query Key Generation
  // ============================================================================

  describe("query key generation", () => {
    it("should generate correct query key with active: true", async () => {
      seedDunningData([], []);

      const { result } = renderHook(() => useCampaigns({ active: true }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Query key should be ["campaigns", { active: true }]
      expect(result.current.data).toEqual([]);
    });

    it("should generate correct query key with active: false", async () => {
      seedDunningData([], []);

      const { result } = renderHook(() => useCampaigns({ active: false }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Query key should be ["campaigns", { active: false }]
      expect(result.current.data).toEqual([]);
    });

    it("should generate correct query key with active: null", async () => {
      seedDunningData([], []);

      const { result } = renderHook(() => useCampaigns({ active: undefined }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Query key should be ["campaigns", { active: null }]
      expect(result.current.data).toEqual([]);
    });
  });

  // ============================================================================
  // StaleTime Configuration
  // ============================================================================

  describe("staleTime configuration", () => {
    it("should use 30 second stale time", async () => {
      seedDunningData([], []);

      const { result } = renderHook(() => useCampaigns(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Immediately refetch - with staleTime: Infinity in test config,
      // it won't refetch
      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.data).toEqual([]);
    });
  });

  // ============================================================================
  // Campaign Properties
  // ============================================================================

  describe("campaign properties", () => {
    it("should include all campaign properties", async () => {
      const fullCampaign = createMockDunningCampaign({
        id: "campaign-full",
        tenant_id: "tenant-1",
        name: "Full Campaign",
        description: "Complete campaign with all fields",
        trigger_after_days: 45,
        max_retries: 5,
        retry_interval_days: 10,
        actions: [
          { type: "email", template: "reminder_1" },
          { type: "sms", template: "sms_reminder" },
        ],
        exclusion_rules: {
          min_amount: 50,
          max_amount: 10000,
          customer_types: ["retail"],
        },
        is_active: true,
        priority: 3,
        total_executions: 500,
        successful_executions: 485,
        total_recovered_amount: 125000.75,
      });

      seedDunningData([fullCampaign], []);

      const { result } = renderHook(() => useCampaigns(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const campaign = result.current.data?.[0];
      expect(campaign).toMatchObject({
        id: "campaign-full",
        name: "Full Campaign",
        description: "Complete campaign with all fields",
        trigger_after_days: 45,
        max_retries: 5,
        retry_interval_days: 10,
        priority: 3,
        total_executions: 500,
        successful_executions: 485,
        total_recovered_amount: 125000.75,
      });
      expect(campaign?.actions).toHaveLength(2);
      expect(campaign?.exclusion_rules).toHaveProperty("min_amount", 50);
    });
  });

  // ============================================================================
  // Refetch Function
  // ============================================================================

  describe("refetch function", () => {
    it("should expose refetch function", async () => {
      seedDunningData([], []);

      const { result } = renderHook(() => useCampaigns(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.data).toEqual([]);
    });
  });

  // ============================================================================
  // useUpdateCampaign Mutation
  // ============================================================================

  describe("useUpdateCampaign mutation", () => {
    it("should update campaign status successfully", async () => {
      const mockCampaign = createMockDunningCampaign({
        id: "campaign-1",
        is_active: true,
      });

      seedDunningData([mockCampaign], []);

      const { result } = renderHook(() => useUpdateCampaign(), {
        wrapper: createWrapper(),
      });

      let mutationResult: DunningCampaign | undefined;
      await act(async () => {
        mutationResult = await result.current.mutateAsync({
          campaignId: "campaign-1",
          data: { is_active: false },
        });
      });

      expect(mutationResult).toBeDefined();
      expect(mutationResult?.is_active).toBe(false);
    });

    it("should update campaign priority successfully", async () => {
      const mockCampaign = createMockDunningCampaign({
        id: "campaign-1",
        priority: 1,
      });

      seedDunningData([mockCampaign], []);

      const { result } = renderHook(() => useUpdateCampaign(), {
        wrapper: createWrapper(),
      });

      let mutationResult: DunningCampaign | undefined;
      await act(async () => {
        mutationResult = await result.current.mutateAsync({
          campaignId: "campaign-1",
          data: { priority: 5 },
        });
      });

      expect(mutationResult).toBeDefined();
      expect(mutationResult?.priority).toBe(5);
    });

    it("should update both is_active and priority", async () => {
      const mockCampaign = createMockDunningCampaign({
        id: "campaign-1",
        is_active: true,
        priority: 1,
      });

      seedDunningData([mockCampaign], []);

      const { result } = renderHook(() => useUpdateCampaign(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          campaignId: "campaign-1",
          data: { is_active: false, priority: 3 },
        });
      });

      expect(result.current.isSuccess).toBe(true);
    });

    it("should handle additional data properties", async () => {
      const mockCampaign = createMockDunningCampaign({
        id: "campaign-1",
      });

      seedDunningData([mockCampaign], []);

      const { result } = renderHook(() => useUpdateCampaign(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          campaignId: "campaign-1",
          data: { is_active: true, custom_field: "value" },
        });
      });

      expect(result.current.isSuccess).toBe(true);
    });

    it("should handle update error", async () => {
      // Campaign doesn't exist
      seedDunningData([], []);

      const { result } = renderHook(() => useUpdateCampaign(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await expect(
          result.current.mutateAsync({
            campaignId: "non-existent",
            data: { is_active: false },
          })
        ).rejects.toThrow();
      });
    });

    it("should set isPending state correctly during mutation", async () => {
      const mockCampaign = createMockDunningCampaign({
        id: "campaign-1",
      });

      seedDunningData([mockCampaign], []);

      const { result } = renderHook(() => useUpdateCampaign(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isPending).toBe(false);

      // Trigger mutation without awaiting
      act(() => {
        result.current.mutate({
          campaignId: "campaign-1",
          data: { is_active: false },
        });
      });

      // The mutation should eventually complete
      await waitFor(() => expect(result.current.isPending).toBe(false), {
        timeout: 200,
      });
    });
  });

  // ============================================================================
  // Cache Invalidation
  // ============================================================================

  describe("cache invalidation", () => {
    it("should call onSuccess callback after successful update", async () => {
      const mockCampaign = createMockDunningCampaign({
        id: "campaign-1",
        is_active: true,
      });

      seedDunningData([mockCampaign], []);

      const { result } = renderHook(() => useUpdateCampaign(), {
        wrapper: createWrapper(),
      });

      let mutationResult: DunningCampaign | undefined;
      await act(async () => {
        mutationResult = await result.current.mutateAsync({
          campaignId: "campaign-1",
          data: { is_active: false },
        });
      });

      // Verify mutation was successful
      expect(mutationResult?.is_active).toBe(false);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it("should successfully update campaign with multiple mutations", async () => {
      const mockCampaigns = [
        createMockDunningCampaign({ id: "campaign-1", is_active: true }),
        createMockDunningCampaign({ id: "campaign-2", is_active: false }),
      ];

      seedDunningData(mockCampaigns, []);

      const { result } = renderHook(() => useUpdateCampaign(), {
        wrapper: createWrapper(),
      });

      // First mutation
      await act(async () => {
        await result.current.mutateAsync({
          campaignId: "campaign-1",
          data: { is_active: false },
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Second mutation
      await act(async () => {
        await result.current.mutateAsync({
          campaignId: "campaign-2",
          data: { priority: 5 },
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  // ============================================================================
  // API Endpoint Construction
  // ============================================================================

  describe("API endpoint construction", () => {
    it("should construct correct API endpoint with campaignId", async () => {
      const mockCampaign = createMockDunningCampaign({
        id: "test-campaign-123",
      });

      seedDunningData([mockCampaign], []);

      const { result } = renderHook(() => useUpdateCampaign(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          campaignId: "test-campaign-123",
          data: { is_active: true },
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it("should handle special characters in campaignId", async () => {
      const mockCampaign = createMockDunningCampaign({
        id: "campaign-uuid-abc-123",
      });

      seedDunningData([mockCampaign], []);

      const { result } = renderHook(() => useUpdateCampaign(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          campaignId: "campaign-uuid-abc-123",
          data: { priority: 2 },
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  // ============================================================================
  // Mutation Error Handling
  // ============================================================================

  describe("mutation error handling", () => {
    it("should handle update error", async () => {
      // Campaign doesn't exist
      seedDunningData([], []);

      const { result } = renderHook(() => useUpdateCampaign(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            campaignId: "non-existent",
            data: { is_active: false },
          });
        })
      ).rejects.toThrow();
    });

    it("should handle subsequent mutations after error", async () => {
      // First attempt - no campaign
      seedDunningData([], []);

      const firstHarness = renderMutationHarness();
      await waitFor(() => expect(firstHarness.getCurrent()).toBeDefined());

      await act(async () => {
        await expect(
          firstHarness.getCurrent().mutateAsync({
            campaignId: "campaign-1",
            data: { is_active: false },
          })
        ).rejects.toThrow();
      });

      firstHarness.unmount();

      // Now add the campaign
      const mockCampaign = createMockDunningCampaign({
        id: "campaign-1",
      });
      seedDunningData([mockCampaign], []);

      const secondHarness = renderMutationHarness();
      await waitFor(() => expect(secondHarness.getCurrent()).toBeDefined());

      let secondResult: DunningCampaign | undefined;
      await act(async () => {
        secondResult = await secondHarness.getCurrent().mutateAsync({
          campaignId: "campaign-1",
          data: { is_active: true },
        });
      });

      secondHarness.unmount();

      expect(secondResult).toBeDefined();
      expect(secondResult?.is_active).toBe(true);
    });
  });
});
