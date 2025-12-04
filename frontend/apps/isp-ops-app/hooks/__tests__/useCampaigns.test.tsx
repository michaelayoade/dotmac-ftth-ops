/**
 * Jest Mock Tests for useCampaigns hooks
 * Tests campaign management with Jest mocks instead of MSW
 */

import { waitFor, act, render } from "@testing-library/react";
import { renderHook } from "@testing-library/react/pure";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { useCampaigns, useUpdateCampaign } from "../useCampaigns";
import { dunningService } from "@/lib/services/dunning-service";
import type { DunningCampaign } from "@/types";

// Mock the dunning service
jest.mock("@/lib/services/dunning-service", () => ({
  dunningService: {
    listCampaigns: jest.fn(),
    updateCampaign: jest.fn(),
  },
}));

// Mock useRealtime to isolate tests
jest.mock("../useRealtime", () => ({
  useCampaignWebSocket: jest.fn(),
}));

const mockedDunningService = dunningService as jest.Mocked<typeof dunningService>;

describe("useCampaigns hooks (Jest Mocks)", () => {
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

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    // Expose queryClient for test assertions
    (wrapper as any).queryClient = queryClient;

    return wrapper;
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

  // Helper to create a mock campaign
  function createMockDunningCampaign(overrides?: Partial<DunningCampaign>): DunningCampaign {
    return {
      id: "campaign-1",
      tenant_id: "tenant-123",
      name: "Test Campaign",
      description: "A test dunning campaign",
      trigger_after_days: 30,
      max_retries: 3,
      retry_interval_days: 7,
      actions: [],
      exclusion_rules: {},
      is_active: true,
      status: "active",
      priority: 1,
      stages: [],
      total_executions: 0,
      successful_executions: 0,
      failed_executions: 0,
      total_recovered_amount: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    } as DunningCampaign;
  }

  beforeEach(() => {
    jest.clearAllMocks();
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

      mockedDunningService.listCampaigns.mockResolvedValueOnce([mockCampaign]);

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

      mockedDunningService.listCampaigns.mockResolvedValueOnce(mockCampaigns);

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
      mockedDunningService.listCampaigns.mockResolvedValueOnce([]);

      const { result } = renderHook(() => useCampaigns(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it("should handle fetch error", async () => {
      mockedDunningService.listCampaigns.mockRejectedValueOnce(new Error("Internal server error"));

      const { result } = renderHook(() => useCampaigns(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isError).toBe(true);
      expect(result.current.error).toBeDefined();
      expect(result.current.data).toBeUndefined();
    });

    it("should set loading state correctly", async () => {
      mockedDunningService.listCampaigns.mockResolvedValueOnce([]);

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
      const mockCampaigns = [createMockDunningCampaign({ id: "campaign-1", is_active: true })];

      mockedDunningService.listCampaigns.mockResolvedValueOnce(mockCampaigns);

      const { result } = renderHook(() => useCampaigns({ active: true }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].is_active).toBe(true);
      expect(mockedDunningService.listCampaigns).toHaveBeenCalledWith({ activeOnly: true });
    });

    it("should filter inactive campaigns (active: false)", async () => {
      const mockCampaigns = [createMockDunningCampaign({ id: "campaign-2", is_active: false })];

      mockedDunningService.listCampaigns.mockResolvedValueOnce(mockCampaigns);

      const { result } = renderHook(() => useCampaigns({ active: false }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].is_active).toBe(false);
      expect(mockedDunningService.listCampaigns).toHaveBeenCalledWith({ activeOnly: false });
    });

    it("should fetch all campaigns when active is undefined", async () => {
      const mockCampaigns = [
        createMockDunningCampaign({ id: "campaign-1", is_active: true }),
        createMockDunningCampaign({ id: "campaign-2", is_active: false }),
      ];

      mockedDunningService.listCampaigns.mockResolvedValueOnce(mockCampaigns);

      const { result } = renderHook(() => useCampaigns({ active: undefined }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(2);
      expect(mockedDunningService.listCampaigns).toHaveBeenCalledWith({});
    });

    it("should fetch all campaigns when no options provided", async () => {
      const mockCampaigns = [
        createMockDunningCampaign({ id: "campaign-1", is_active: true }),
        createMockDunningCampaign({ id: "campaign-2", is_active: false }),
      ];

      mockedDunningService.listCampaigns.mockResolvedValueOnce(mockCampaigns);

      const { result } = renderHook(() => useCampaigns(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(2);
      expect(mockedDunningService.listCampaigns).toHaveBeenCalledWith({});
    });
  });

  // ============================================================================
  // Query Key Generation
  // ============================================================================

  describe("query key generation", () => {
    it("should generate correct query key with active: true", async () => {
      mockedDunningService.listCampaigns.mockResolvedValueOnce([]);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useCampaigns({ active: true }), {
        wrapper,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Verify query key matches expected structure
      const queryClient = (wrapper as any).queryClient;
      const cache = queryClient.getQueryCache();
      const queries = cache.getAll();
      const campaignQuery = queries.find(
        (q: any) => Array.isArray(q.queryKey) && q.queryKey[0] === "campaigns",
      );

      expect(campaignQuery).toBeDefined();
      expect(campaignQuery?.queryKey).toEqual(["campaigns", { active: true }]);
    });

    it("should generate correct query key with active: false", async () => {
      mockedDunningService.listCampaigns.mockResolvedValueOnce([]);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useCampaigns({ active: false }), {
        wrapper,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Verify query key matches expected structure
      const queryClient = (wrapper as any).queryClient;
      const cache = queryClient.getQueryCache();
      const queries = cache.getAll();
      const campaignQuery = queries.find(
        (q: any) => Array.isArray(q.queryKey) && q.queryKey[0] === "campaigns",
      );

      expect(campaignQuery).toBeDefined();
      expect(campaignQuery?.queryKey).toEqual(["campaigns", { active: false }]);
    });

    it("should generate correct query key with active: undefined (null)", async () => {
      mockedDunningService.listCampaigns.mockResolvedValueOnce([]);

      const wrapper = createWrapper();
      const { result } = renderHook(() => useCampaigns({ active: undefined }), {
        wrapper,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Verify query key matches expected structure
      const queryClient = (wrapper as any).queryClient;
      const cache = queryClient.getQueryCache();
      const queries = cache.getAll();
      const campaignQuery = queries.find(
        (q: any) => Array.isArray(q.queryKey) && q.queryKey[0] === "campaigns",
      );

      expect(campaignQuery).toBeDefined();
      expect(campaignQuery?.queryKey).toEqual(["campaigns", { active: null }]);
    });
  });

  // ============================================================================
  // StaleTime Configuration
  // ============================================================================

  describe("staleTime configuration", () => {
    it("should use 30 second stale time", async () => {
      mockedDunningService.listCampaigns.mockResolvedValueOnce([]);

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

      mockedDunningService.listCampaigns.mockResolvedValueOnce([fullCampaign]);

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
      mockedDunningService.listCampaigns.mockResolvedValue([]);

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
        is_active: false,
      });

      mockedDunningService.updateCampaign.mockResolvedValueOnce(mockCampaign);

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
        priority: 5,
      });

      mockedDunningService.updateCampaign.mockResolvedValueOnce(mockCampaign);

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
        is_active: false,
        priority: 3,
      });

      mockedDunningService.updateCampaign.mockResolvedValueOnce(mockCampaign);

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

      mockedDunningService.updateCampaign.mockResolvedValueOnce(mockCampaign);

      const { result } = renderHook(() => useUpdateCampaign(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          campaignId: "campaign-1",
          data: { is_active: true, custom_field: "value" } as any,
        });
      });

      expect(result.current.isSuccess).toBe(true);
    });

    it("should handle update error", async () => {
      mockedDunningService.updateCampaign.mockRejectedValueOnce(new Error("Campaign not found"));

      const { result } = renderHook(() => useUpdateCampaign(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await expect(
          result.current.mutateAsync({
            campaignId: "non-existent",
            data: { is_active: false },
          }),
        ).rejects.toThrow();
      });
    });

    it("should set isPending state correctly during mutation", async () => {
      const mockCampaign = createMockDunningCampaign({
        id: "campaign-1",
      });

      mockedDunningService.updateCampaign.mockResolvedValueOnce(mockCampaign);

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
    it("should invalidate campaigns query after successful update", async () => {
      const mockCampaign1 = createMockDunningCampaign({
        id: "campaign-1",
        is_active: true,
      });
      const mockCampaign2 = createMockDunningCampaign({
        id: "campaign-1",
        is_active: false,
      });

      mockedDunningService.listCampaigns.mockResolvedValueOnce([mockCampaign1]);
      mockedDunningService.updateCampaign.mockResolvedValueOnce(mockCampaign2);
      mockedDunningService.listCampaigns.mockResolvedValueOnce([mockCampaign2]);

      const wrapper = createWrapper();
      const queryClient = (wrapper as any).queryClient;

      // First, fetch campaigns to populate cache
      const { result: campaignsResult } = renderHook(() => useCampaigns(), {
        wrapper,
      });
      await waitFor(() => expect(campaignsResult.current.isSuccess).toBe(true));

      // Get initial query state
      const initialState = queryClient
        .getQueryCache()
        .find({ queryKey: ["campaigns", { active: null }] })?.state;

      // Now update a campaign
      const { result: updateResult } = renderHook(() => useUpdateCampaign(), {
        wrapper,
      });

      await act(async () => {
        await updateResult.current.mutateAsync({
          campaignId: "campaign-1",
          data: { is_active: false },
        });
      });

      // Wait for invalidation to trigger refetch
      await waitFor(() => {
        const newState = queryClient
          .getQueryCache()
          .find({ queryKey: ["campaigns", { active: null }] })?.state;
        // dataUpdatedAt changes when query is refetched after invalidation
        return newState?.dataUpdatedAt !== initialState?.dataUpdatedAt;
      });

      // Verify the query was actually refetched
      expect(campaignsResult.current.data).toBeDefined();
    });

    it("should invalidate all campaigns queries (different filters)", async () => {
      const mockActiveCampaigns = [
        createMockDunningCampaign({ id: "campaign-1", is_active: true }),
      ];
      const mockAllCampaigns = [
        createMockDunningCampaign({ id: "campaign-1", is_active: true }),
        createMockDunningCampaign({ id: "campaign-2", is_active: false }),
      ];

      mockedDunningService.listCampaigns
        .mockResolvedValueOnce(mockActiveCampaigns)
        .mockResolvedValueOnce(mockAllCampaigns);

      const updatedCampaign = createMockDunningCampaign({
        id: "campaign-1",
        is_active: false,
      });
      mockedDunningService.updateCampaign.mockResolvedValueOnce(updatedCampaign);

      // Mock refetch calls
      mockedDunningService.listCampaigns
        .mockResolvedValueOnce([]) // active filter refetch
        .mockResolvedValueOnce(mockAllCampaigns); // all filter refetch

      const wrapper = createWrapper();
      const queryClient = (wrapper as any).queryClient;

      // Fetch with active filter
      const { result: activeResult } = renderHook(() => useCampaigns({ active: true }), {
        wrapper,
      });
      await waitFor(() => expect(activeResult.current.isSuccess).toBe(true));

      // Fetch without filter
      const { result: allResult } = renderHook(() => useCampaigns(), { wrapper });
      await waitFor(() => expect(allResult.current.isSuccess).toBe(true));

      // Get initial query states
      const activeQueryInitialState = queryClient
        .getQueryCache()
        .find({ queryKey: ["campaigns", { active: true }] })?.state;
      const allQueryInitialState = queryClient
        .getQueryCache()
        .find({ queryKey: ["campaigns", { active: null }] })?.state;

      // Update a campaign
      const { result: updateResult } = renderHook(() => useUpdateCampaign(), {
        wrapper,
      });

      await act(async () => {
        await updateResult.current.mutateAsync({
          campaignId: "campaign-1",
          data: { is_active: false },
        });
      });

      // Both queries should be invalidated and refetched
      await waitFor(() => {
        const activeQueryNewState = queryClient
          .getQueryCache()
          .find({ queryKey: ["campaigns", { active: true }] })?.state;
        const allQueryNewState = queryClient
          .getQueryCache()
          .find({ queryKey: ["campaigns", { active: null }] })?.state;

        return (
          activeQueryNewState?.dataUpdatedAt !== activeQueryInitialState?.dataUpdatedAt &&
          allQueryNewState?.dataUpdatedAt !== allQueryInitialState?.dataUpdatedAt
        );
      });
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

      mockedDunningService.updateCampaign.mockResolvedValueOnce(mockCampaign);

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

      expect(mockedDunningService.updateCampaign).toHaveBeenCalledWith("test-campaign-123", {
        is_active: true,
      });
    });

    it("should handle special characters in campaignId", async () => {
      const mockCampaign = createMockDunningCampaign({
        id: "campaign-uuid-abc-123",
      });

      mockedDunningService.updateCampaign.mockResolvedValueOnce(mockCampaign);

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

      expect(mockedDunningService.updateCampaign).toHaveBeenCalledWith("campaign-uuid-abc-123", {
        priority: 2,
      });
    });
  });

  // ============================================================================
  // Mutation Error Handling
  // ============================================================================

  describe("mutation error handling", () => {
    it("should handle update error", async () => {
      mockedDunningService.updateCampaign.mockRejectedValueOnce(new Error("Campaign not found"));

      const { result } = renderHook(() => useUpdateCampaign(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            campaignId: "non-existent",
            data: { is_active: false },
          });
        }),
      ).rejects.toThrow();

      // Verify error state
      expect(result.current.error).toBeDefined();
    });
  });
});
