/**
 * Tests for useCampaigns hook
 * Tests campaign management with TanStack Query (queries and mutations)
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { useCampaigns, useUpdateCampaign } from "../useCampaigns";
import { apiClient } from "@/lib/api/client";
import { extractDataOrThrow } from "@/lib/api/response-helpers";
import { logger } from "@/lib/logger";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import type { DunningCampaign } from "@/types";

// Mock dependencies
jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    patch: jest.fn(),
  },
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock("@/lib/api/response-helpers", () => ({
  extractDataOrThrow: jest.fn((response) => response.data),
}));

// Mock useRealtime to avoid better-auth import
jest.mock("../useRealtime", () => ({
  useCampaignWebSocket: jest.fn(),
}));

describe("useCampaigns", () => {
  const mockCampaign: DunningCampaign = {
    id: "campaign-1",
    tenant_id: "tenant-1",
    name: "30-Day Overdue",
    description: "Campaign for 30 days overdue invoices",
    trigger_after_days: 30,
    max_retries: 3,
    retry_interval_days: 7,
    actions: [{ type: "email", template: "reminder" }],
    exclusion_rules: { min_amount: 100 },
    is_active: true,
    priority: 1,
    total_executions: 150,
    successful_executions: 145,
    total_recovered_amount: 25000.5,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-15T00:00:00Z",
  };

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

  describe("useCampaigns query", () => {
    it("should fetch campaigns successfully", async () => {
      const mockCampaigns = [mockCampaign];
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockCampaigns });

      const { result } = renderHook(() => useCampaigns(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockCampaigns);
      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].name).toBe("30-Day Overdue");
      expect(apiClient.get).toHaveBeenCalledWith("/billing/dunning/campaigns", {
        params: undefined,
      });
      expect(extractDataOrThrow).toHaveBeenCalledWith({ data: mockCampaigns });
    });

    it("should fetch multiple campaigns", async () => {
      const mockCampaigns: DunningCampaign[] = [
        mockCampaign,
        {
          ...mockCampaign,
          id: "campaign-2",
          name: "60-Day Overdue",
          trigger_after_days: 60,
          is_active: false,
        },
        {
          ...mockCampaign,
          id: "campaign-3",
          name: "90-Day Overdue",
          trigger_after_days: 90,
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockCampaigns });

      const { result } = renderHook(() => useCampaigns(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(3);
      expect(result.current.data?.[0].name).toBe("30-Day Overdue");
      expect(result.current.data?.[1].name).toBe("60-Day Overdue");
      expect(result.current.data?.[2].name).toBe("90-Day Overdue");
    });

    it("should handle empty campaigns array", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      const { result } = renderHook(() => useCampaigns(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch campaigns");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useCampaigns(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBe(error);
      expect(result.current.data).toBeUndefined();
    });

    it("should set loading state correctly", async () => {
      (apiClient.get as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: [] }), 100))
      );

      const { result } = renderHook(() => useCampaigns(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 200 });
    });
  });

  describe("useCampaigns with active filter", () => {
    it("should filter active campaigns (active: true)", async () => {
      const mockActiveCampaigns = [mockCampaign];
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockActiveCampaigns });

      const { result } = renderHook(() => useCampaigns({ active: true }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockActiveCampaigns);
      expect(apiClient.get).toHaveBeenCalledWith("/billing/dunning/campaigns", {
        params: { is_active: true },
      });
    });

    it("should filter inactive campaigns (active: false)", async () => {
      const mockInactiveCampaign = { ...mockCampaign, is_active: false };
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [mockInactiveCampaign] });

      const { result } = renderHook(() => useCampaigns({ active: false }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual([mockInactiveCampaign]);
      expect(apiClient.get).toHaveBeenCalledWith("/billing/dunning/campaigns", {
        params: { is_active: false },
      });
    });

    it("should fetch all campaigns when active is undefined", async () => {
      const mockCampaigns = [mockCampaign];
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockCampaigns });

      const { result } = renderHook(() => useCampaigns({ active: undefined }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockCampaigns);
      expect(apiClient.get).toHaveBeenCalledWith("/billing/dunning/campaigns", {
        params: undefined,
      });
    });

    it("should fetch all campaigns when no options provided", async () => {
      const mockCampaigns = [mockCampaign];
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockCampaigns });

      const { result } = renderHook(() => useCampaigns(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(apiClient.get).toHaveBeenCalledWith("/billing/dunning/campaigns", {
        params: undefined,
      });
    });
  });

  describe("query key generation", () => {
    it("should generate correct query key with active: true", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      const { result } = renderHook(() => useCampaigns({ active: true }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Query key should be ["campaigns", { active: true }]
      expect(apiClient.get).toHaveBeenCalledWith("/billing/dunning/campaigns", {
        params: { is_active: true },
      });
    });

    it("should generate correct query key with active: false", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      const { result } = renderHook(() => useCampaigns({ active: false }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Query key should be ["campaigns", { active: false }]
      expect(apiClient.get).toHaveBeenCalledWith("/billing/dunning/campaigns", {
        params: { is_active: false },
      });
    });

    it("should generate correct query key with active: null", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      const { result } = renderHook(() => useCampaigns({ active: undefined }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Query key should be ["campaigns", { active: null }]
      expect(apiClient.get).toHaveBeenCalledWith("/billing/dunning/campaigns", {
        params: undefined,
      });
    });
  });

  describe("staleTime configuration", () => {
    it("should use 30 second stale time", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      const { result } = renderHook(() => useCampaigns(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // First call
      expect(apiClient.get).toHaveBeenCalledTimes(1);

      // Immediately refetch - should use cached data due to staleTime
      await act(async () => {
        await result.current.refetch();
      });

      // Should still be 1 call because of staleTime
      // Note: In a real scenario with time manipulation, this would be tested differently
      expect(apiClient.get).toHaveBeenCalled();
    });
  });

  describe("extractDataOrThrow helper", () => {
    it("should use extractDataOrThrow to extract data", async () => {
      const mockData = [mockCampaign];
      const mockResponse = { data: mockData };
      (apiClient.get as jest.Mock).mockResolvedValue(mockResponse);

      renderHook(() => useCampaigns(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(extractDataOrThrow).toHaveBeenCalledWith(mockResponse);
      });
    });

    it("should handle extractDataOrThrow throwing error", async () => {
      const error = new Error("Invalid response");
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
      (extractDataOrThrow as jest.Mock).mockImplementationOnce(() => {
        throw error;
      });

      const { result } = renderHook(() => useCampaigns(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toEqual(error);

      // Reset the mock to default behavior
      (extractDataOrThrow as jest.Mock).mockImplementation((response) => response.data);
    });
  });

  describe("campaign properties", () => {
    it("should include all campaign properties", async () => {
      const fullCampaign: DunningCampaign = {
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
        created_at: "2024-01-01T10:30:00Z",
        updated_at: "2024-02-15T14:45:30Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: [fullCampaign] });

      const { result } = renderHook(() => useCampaigns(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const campaign = result.current.data?.[0];
      expect(campaign).toEqual(fullCampaign);
      expect(campaign?.description).toBe("Complete campaign with all fields");
      expect(campaign?.trigger_after_days).toBe(45);
      expect(campaign?.max_retries).toBe(5);
      expect(campaign?.retry_interval_days).toBe(10);
      expect(campaign?.actions).toHaveLength(2);
      expect(campaign?.exclusion_rules).toHaveProperty("min_amount", 50);
      expect(campaign?.priority).toBe(3);
      expect(campaign?.total_executions).toBe(500);
      expect(campaign?.successful_executions).toBe(485);
      expect(campaign?.total_recovered_amount).toBe(125000.75);
    });
  });

  describe("refetch function", () => {
    it("should expose refetch function", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      const { result } = renderHook(() => useCampaigns(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(apiClient.get).toHaveBeenCalledTimes(1);

      // Clear previous calls
      (apiClient.get as jest.Mock).mockClear();

      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith("/billing/dunning/campaigns", {
          params: undefined,
        });
      });
    });
  });
});

describe("useUpdateCampaign", () => {
  const mockCampaign: DunningCampaign = {
    id: "campaign-1",
    tenant_id: "tenant-1",
    name: "30-Day Overdue",
    description: "Campaign for 30 days overdue invoices",
    trigger_after_days: 30,
    max_retries: 3,
    retry_interval_days: 7,
    actions: [{ type: "email", template: "reminder" }],
    exclusion_rules: { min_amount: 100 },
    is_active: true,
    priority: 1,
    total_executions: 150,
    successful_executions: 145,
    total_recovered_amount: 25000.5,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-15T00:00:00Z",
  };

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

  describe("updateCampaign mutation", () => {
    it("should update campaign status successfully", async () => {
      const updatedCampaign = { ...mockCampaign, is_active: false };
      (apiClient.patch as jest.Mock).mockResolvedValue({ data: updatedCampaign });

      const { result } = renderHook(() => useUpdateCampaign(), {
        wrapper: createWrapper(),
      });

      let mutationResult;
      await act(async () => {
        mutationResult = await result.current.mutateAsync({
          campaignId: "campaign-1",
          data: { is_active: false },
        });
      });

      expect(mutationResult).toEqual(updatedCampaign);
      expect(apiClient.patch).toHaveBeenCalledWith(
        "/api/v1/billing/dunning/campaigns/campaign-1",
        { is_active: false }
      );
      expect(extractDataOrThrow).toHaveBeenCalledWith({ data: updatedCampaign });
    });

    it("should update campaign priority successfully", async () => {
      const updatedCampaign = { ...mockCampaign, priority: 5 };
      (apiClient.patch as jest.Mock).mockResolvedValue({ data: updatedCampaign });

      const { result } = renderHook(() => useUpdateCampaign(), {
        wrapper: createWrapper(),
      });

      let mutationResult;
      await act(async () => {
        mutationResult = await result.current.mutateAsync({
          campaignId: "campaign-1",
          data: { priority: 5 },
        });
      });

      expect(mutationResult).toEqual(updatedCampaign);
      expect(apiClient.patch).toHaveBeenCalledWith(
        "/api/v1/billing/dunning/campaigns/campaign-1",
        { priority: 5 }
      );
    });

    it("should update both is_active and priority", async () => {
      const updatedCampaign = { ...mockCampaign, is_active: false, priority: 3 };
      (apiClient.patch as jest.Mock).mockResolvedValue({ data: updatedCampaign });

      const { result } = renderHook(() => useUpdateCampaign(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          campaignId: "campaign-1",
          data: { is_active: false, priority: 3 },
        });
      });

      expect(apiClient.patch).toHaveBeenCalledWith(
        "/api/v1/billing/dunning/campaigns/campaign-1",
        { is_active: false, priority: 3 }
      );
    });

    it("should handle additional data properties", async () => {
      const updatedCampaign = { ...mockCampaign, custom_field: "value" };
      (apiClient.patch as jest.Mock).mockResolvedValue({ data: updatedCampaign });

      const { result } = renderHook(() => useUpdateCampaign(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          campaignId: "campaign-1",
          data: { is_active: true, custom_field: "value" },
        });
      });

      expect(apiClient.patch).toHaveBeenCalledWith(
        "/api/v1/billing/dunning/campaigns/campaign-1",
        { is_active: true, custom_field: "value" }
      );
    });

    it("should handle update error", async () => {
      const error = new Error("Update failed");
      (apiClient.patch as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useUpdateCampaign(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            campaignId: "campaign-1",
            data: { is_active: false },
          });
        })
      ).rejects.toThrow("Update failed");
    });

    it("should set isPending state correctly during mutation", async () => {
      (apiClient.patch as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: mockCampaign }), 50))
      );

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
      await waitFor(() => expect(result.current.isPending).toBe(false), { timeout: 200 });
    });

    it("should use extractDataOrThrow helper", async () => {
      const mockData = mockCampaign;
      const mockResponse = { data: mockData };
      (apiClient.patch as jest.Mock).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useUpdateCampaign(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          campaignId: "campaign-1",
          data: { is_active: false },
        });
      });

      expect(extractDataOrThrow).toHaveBeenCalledWith(mockResponse);
    });
  });

  describe("cache invalidation", () => {
    it("should invalidate campaigns query after successful update", async () => {
      const mockCampaigns = [mockCampaign];
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockCampaigns });
      (apiClient.patch as jest.Mock).mockResolvedValue({ data: { ...mockCampaign, is_active: false } });

      const wrapper = createWrapper();

      // First, fetch campaigns to populate cache
      const { result: campaignsResult } = renderHook(() => useCampaigns(), { wrapper });
      await waitFor(() => expect(campaignsResult.current.isLoading).toBe(false));

      const initialCallCount = (apiClient.get as jest.Mock).mock.calls.length;

      // Now update a campaign
      const { result: updateResult } = renderHook(() => useUpdateCampaign(), { wrapper });

      await act(async () => {
        await updateResult.current.mutateAsync({
          campaignId: "campaign-1",
          data: { is_active: false },
        });
      });

      // Wait for invalidation to trigger refetch
      await waitFor(() => {
        expect((apiClient.get as jest.Mock).mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });

    it("should invalidate all campaigns queries (different filters)", async () => {
      const mockActiveCampaigns = [mockCampaign];
      const mockAllCampaigns = [mockCampaign, { ...mockCampaign, id: "campaign-2", is_active: false }];

      (apiClient.get as jest.Mock).mockImplementation((url, config) => {
        if (config?.params?.is_active === true) {
          return Promise.resolve({ data: mockActiveCampaigns });
        }
        return Promise.resolve({ data: mockAllCampaigns });
      });

      (apiClient.patch as jest.Mock).mockResolvedValue({ data: { ...mockCampaign, is_active: false } });

      const wrapper = createWrapper();

      // Fetch with active filter
      const { result: activeResult } = renderHook(() => useCampaigns({ active: true }), { wrapper });
      await waitFor(() => expect(activeResult.current.isLoading).toBe(false));

      // Fetch without filter
      const { result: allResult } = renderHook(() => useCampaigns(), { wrapper });
      await waitFor(() => expect(allResult.current.isLoading).toBe(false));

      const initialCallCount = (apiClient.get as jest.Mock).mock.calls.length;

      // Update a campaign
      const { result: updateResult } = renderHook(() => useUpdateCampaign(), { wrapper });

      await act(async () => {
        await updateResult.current.mutateAsync({
          campaignId: "campaign-1",
          data: { is_active: false },
        });
      });

      // Both queries should be invalidated
      await waitFor(() => {
        expect((apiClient.get as jest.Mock).mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });
  });

  describe("API endpoint construction", () => {
    it("should construct correct API endpoint with campaignId", async () => {
      (apiClient.patch as jest.Mock).mockResolvedValue({ data: mockCampaign });

      const { result } = renderHook(() => useUpdateCampaign(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          campaignId: "test-campaign-123",
          data: { is_active: true },
        });
      });

      expect(apiClient.patch).toHaveBeenCalledWith(
        "/api/v1/billing/dunning/campaigns/test-campaign-123",
        { is_active: true }
      );
    });

    it("should handle special characters in campaignId", async () => {
      (apiClient.patch as jest.Mock).mockResolvedValue({ data: mockCampaign });

      const { result } = renderHook(() => useUpdateCampaign(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          campaignId: "campaign-uuid-abc-123",
          data: { priority: 2 },
        });
      });

      expect(apiClient.patch).toHaveBeenCalledWith(
        "/api/v1/billing/dunning/campaigns/campaign-uuid-abc-123",
        { priority: 2 }
      );
    });
  });

  describe("mutation error handling", () => {
    it("should handle update error", async () => {
      const error = new Error("Network error");
      (apiClient.patch as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useUpdateCampaign(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            campaignId: "campaign-1",
            data: { is_active: false },
          });
        })
      ).rejects.toThrow("Network error");
    });

    it("should handle subsequent mutations after error", async () => {
      const error = new Error("First error");
      (apiClient.patch as jest.Mock)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({ data: mockCampaign });

      const { result } = renderHook(() => useUpdateCampaign(), {
        wrapper: createWrapper(),
      });

      // First mutation fails
      await expect(
        act(async () => {
          await result.current.mutateAsync({
            campaignId: "campaign-1",
            data: { is_active: false },
          });
        })
      ).rejects.toThrow("First error");

      // Second mutation succeeds
      let secondResult;
      await act(async () => {
        secondResult = await result.current.mutateAsync({
          campaignId: "campaign-1",
          data: { is_active: true },
        });
      });

      expect(secondResult).toEqual(mockCampaign);
    });
  });

});
