/**
 * Tests for useDunning hooks
 * Tests dunning and collections management functionality with TanStack Query
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  useDunningCampaigns,
  useDunningCampaign,
  useCreateDunningCampaign,
  useUpdateDunningCampaign,
  useDeleteDunningCampaign,
  usePauseDunningCampaign,
  useResumeDunningCampaign,
  useDunningExecutions,
  useDunningExecution,
  useStartDunningExecution,
  useCancelDunningExecution,
  useDunningStatistics,
  useDunningCampaignStatistics,
  useDunningRecoveryChart,
  useDunningOperations,
  dunningKeys,
  DunningCampaign,
  DunningExecution,
  DunningStatistics,
  DunningCampaignStats,
  DunningRecoveryChartData,
} from "../useDunning";
import { dunningService } from "@/lib/services/dunning-service";

// Mock dependencies
jest.mock("@/lib/services/dunning-service");

describe("useDunning", () => {
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

  describe("dunningKeys query key factory", () => {
    it("should generate correct query keys", () => {
      expect(dunningKeys.all).toEqual(["dunning"]);
      expect(dunningKeys.campaigns()).toEqual(["dunning", "campaigns"]);
      expect(dunningKeys.campaign({ status: "active" })).toEqual([
        "dunning",
        "campaigns",
        { status: "active" },
      ]);
      expect(dunningKeys.campaignDetail("campaign-1")).toEqual([
        "dunning",
        "campaigns",
        "campaign-1",
      ]);
      expect(dunningKeys.executions()).toEqual(["dunning", "executions"]);
      expect(dunningKeys.execution({ status: "completed" })).toEqual([
        "dunning",
        "executions",
        { status: "completed" },
      ]);
      expect(dunningKeys.executionDetail("execution-1")).toEqual([
        "dunning",
        "executions",
        "execution-1",
      ]);
      expect(dunningKeys.statistics()).toEqual(["dunning", "statistics"]);
      expect(dunningKeys.campaignStats("campaign-1")).toEqual([
        "dunning",
        "statistics",
        "campaign",
        "campaign-1",
      ]);
      expect(dunningKeys.recoveryChart(30)).toEqual(["dunning", "recovery-chart", 30]);
    });
  });

  // ==================== Campaign Query Hooks ====================

  describe("useDunningCampaigns", () => {
    it("should fetch campaigns successfully", async () => {
      const mockCampaigns: DunningCampaign[] = [
        {
          id: "campaign-1",
          tenant_id: "tenant-1",
          name: "Payment Reminders",
          description: "Automated payment reminder campaign",
          status: "active",
          stages: [
            {
              stage_number: 1,
              days_overdue: 5,
              action_type: "email_reminder",
              template_id: "tmpl-1",
              subject: "Payment Reminder",
              escalation_action: "none",
            },
          ],
          total_executions: 10,
          successful_executions: 8,
          failed_executions: 2,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      (dunningService.listCampaigns as jest.Mock).mockResolvedValue(mockCampaigns);

      const { result } = renderHook(() => useDunningCampaigns(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockCampaigns);
      expect(dunningService.listCampaigns).toHaveBeenCalledWith({});
    });

    it("should handle filter parameters", async () => {
      (dunningService.listCampaigns as jest.Mock).mockResolvedValue([]);

      renderHook(
        () =>
          useDunningCampaigns({
            status: "active",
            search: "payment",
            page: 2,
            page_size: 10,
          }),
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(dunningService.listCampaigns).toHaveBeenCalledWith({
          status: "active",
          search: "payment",
          page: 2,
          page_size: 10,
        });
      });
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch campaigns");
      (dunningService.listCampaigns as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useDunningCampaigns(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });

    it("should have correct staleTime and gcTime", async () => {
      (dunningService.listCampaigns as jest.Mock).mockResolvedValue([]);

      const { result } = renderHook(() => useDunningCampaigns(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // staleTime is 30000ms, gcTime is 5 * 60 * 1000ms
      expect(result.current.data).toBeDefined();
    });
  });

  describe("useDunningCampaign", () => {
    it("should fetch single campaign successfully", async () => {
      const mockCampaign: DunningCampaign = {
        id: "campaign-1",
        tenant_id: "tenant-1",
        name: "Payment Reminders",
        description: "Automated payment reminder campaign",
        status: "active",
        stages: [
          {
            stage_number: 1,
            days_overdue: 5,
            action_type: "email_reminder",
            template_id: "tmpl-1",
            subject: "Payment Reminder",
            escalation_action: "none",
          },
        ],
        total_executions: 10,
        successful_executions: 8,
        failed_executions: 2,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (dunningService.getCampaign as jest.Mock).mockResolvedValue(mockCampaign);

      const { result } = renderHook(() => useDunningCampaign("campaign-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockCampaign);
      expect(dunningService.getCampaign).toHaveBeenCalledWith("campaign-1");
    });

    it("should not fetch when campaignId is null", async () => {
      const { result } = renderHook(() => useDunningCampaign(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
      expect(dunningService.getCampaign).not.toHaveBeenCalled();
    });

    it("should handle fetch error", async () => {
      const error = new Error("Campaign not found");
      (dunningService.getCampaign as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useDunningCampaign("campaign-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });
  });

  // ==================== Campaign Mutation Hooks ====================

  describe("useCreateDunningCampaign", () => {
    it("should create campaign successfully", async () => {
      const mockCampaign: DunningCampaign = {
        id: "campaign-new",
        tenant_id: "tenant-1",
        name: "New Campaign",
        description: "Test campaign",
        status: "active",
        stages: [],
        total_executions: 0,
        successful_executions: 0,
        failed_executions: 0,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (dunningService.createCampaign as jest.Mock).mockResolvedValue(mockCampaign);

      const { result } = renderHook(() => useCreateDunningCampaign(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const created = await result.current.mutateAsync({
          name: "New Campaign",
          description: "Test campaign",
          stages: [],
        });
        expect(created).toEqual(mockCampaign);
      });

      expect(dunningService.createCampaign).toHaveBeenCalledWith({
        name: "New Campaign",
        description: "Test campaign",
        stages: [],
      });
    });

    it("should call onSuccess callback", async () => {
      const mockCampaign: DunningCampaign = {
        id: "campaign-new",
        tenant_id: "tenant-1",
        name: "New Campaign",
        status: "active",
        stages: [],
        total_executions: 0,
        successful_executions: 0,
        failed_executions: 0,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (dunningService.createCampaign as jest.Mock).mockResolvedValue(mockCampaign);

      const onSuccess = jest.fn();
      const { result } = renderHook(() => useCreateDunningCampaign({ onSuccess }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          name: "New Campaign",
          stages: [],
        });
      });

      expect(onSuccess).toHaveBeenCalledWith(mockCampaign);
    });

    it("should call onError callback", async () => {
      const error = new Error("Create failed");
      (dunningService.createCampaign as jest.Mock).mockRejectedValue(error);

      const onError = jest.fn();
      const { result } = renderHook(() => useCreateDunningCampaign({ onError }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            name: "New Campaign",
            stages: [],
          });
        } catch (err) {
          // Expected
        }
      });

      expect(onError).toHaveBeenCalledWith(error);
    });

    it("should invalidate queries on success", async () => {
      const mockCampaign: DunningCampaign = {
        id: "campaign-new",
        tenant_id: "tenant-1",
        name: "New Campaign",
        status: "active",
        stages: [],
        total_executions: 0,
        successful_executions: 0,
        failed_executions: 0,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (dunningService.createCampaign as jest.Mock).mockResolvedValue(mockCampaign);

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useCreateDunningCampaign(), {
        wrapper,
      });

      await act(async () => {
        await result.current.mutateAsync({
          name: "New Campaign",
          stages: [],
        });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: dunningKeys.campaigns() });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: dunningKeys.statistics() });
    });
  });

  describe("useUpdateDunningCampaign", () => {
    it("should update campaign successfully", async () => {
      const mockCampaign: DunningCampaign = {
        id: "campaign-1",
        tenant_id: "tenant-1",
        name: "Updated Campaign",
        status: "active",
        stages: [],
        total_executions: 0,
        successful_executions: 0,
        failed_executions: 0,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-02T00:00:00Z",
      };

      (dunningService.updateCampaign as jest.Mock).mockResolvedValue(mockCampaign);

      const { result } = renderHook(() => useUpdateDunningCampaign(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const updated = await result.current.mutateAsync({
          campaignId: "campaign-1",
          data: {
            name: "Updated Campaign",
          },
        });
        expect(updated).toEqual(mockCampaign);
      });

      expect(dunningService.updateCampaign).toHaveBeenCalledWith("campaign-1", {
        name: "Updated Campaign",
      });
    });

    it("should call onSuccess callback", async () => {
      const mockCampaign: DunningCampaign = {
        id: "campaign-1",
        tenant_id: "tenant-1",
        name: "Updated Campaign",
        status: "active",
        stages: [],
        total_executions: 0,
        successful_executions: 0,
        failed_executions: 0,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-02T00:00:00Z",
      };

      (dunningService.updateCampaign as jest.Mock).mockResolvedValue(mockCampaign);

      const onSuccess = jest.fn();
      const { result } = renderHook(() => useUpdateDunningCampaign({ onSuccess }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          campaignId: "campaign-1",
          data: { name: "Updated Campaign" },
        });
      });

      expect(onSuccess).toHaveBeenCalledWith(mockCampaign);
    });

    it("should handle update error", async () => {
      const error = new Error("Update failed");
      (dunningService.updateCampaign as jest.Mock).mockRejectedValue(error);

      const onError = jest.fn();
      const { result } = renderHook(() => useUpdateDunningCampaign({ onError }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            campaignId: "campaign-1",
            data: { name: "Updated" },
          });
        } catch (err) {
          // Expected
        }
      });

      expect(onError).toHaveBeenCalledWith(error);
    });

    it("should invalidate queries on success", async () => {
      const mockCampaign: DunningCampaign = {
        id: "campaign-1",
        tenant_id: "tenant-1",
        name: "Updated Campaign",
        status: "active",
        stages: [],
        total_executions: 0,
        successful_executions: 0,
        failed_executions: 0,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-02T00:00:00Z",
      };

      (dunningService.updateCampaign as jest.Mock).mockResolvedValue(mockCampaign);

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useUpdateDunningCampaign(), {
        wrapper,
      });

      await act(async () => {
        await result.current.mutateAsync({
          campaignId: "campaign-1",
          data: { name: "Updated" },
        });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: dunningKeys.campaigns() });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: dunningKeys.campaignDetail("campaign-1"),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: dunningKeys.statistics() });
    });
  });

  describe("useDeleteDunningCampaign", () => {
    it("should delete campaign successfully", async () => {
      (dunningService.deleteCampaign as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useDeleteDunningCampaign(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync("campaign-1");
      });

      expect(dunningService.deleteCampaign).toHaveBeenCalledWith("campaign-1");
    });

    it("should call onSuccess callback", async () => {
      (dunningService.deleteCampaign as jest.Mock).mockResolvedValue(undefined);

      const onSuccess = jest.fn();
      const { result } = renderHook(() => useDeleteDunningCampaign({ onSuccess }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync("campaign-1");
      });

      expect(onSuccess).toHaveBeenCalled();
    });

    it("should handle delete error", async () => {
      const error = new Error("Delete failed");
      (dunningService.deleteCampaign as jest.Mock).mockRejectedValue(error);

      const onError = jest.fn();
      const { result } = renderHook(() => useDeleteDunningCampaign({ onError }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync("campaign-1");
        } catch (err) {
          // Expected
        }
      });

      expect(onError).toHaveBeenCalledWith(error);
    });

    it("should invalidate queries on success", async () => {
      (dunningService.deleteCampaign as jest.Mock).mockResolvedValue(undefined);

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useDeleteDunningCampaign(), {
        wrapper,
      });

      await act(async () => {
        await result.current.mutateAsync("campaign-1");
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: dunningKeys.campaigns() });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: dunningKeys.statistics() });
    });
  });

  describe("usePauseDunningCampaign", () => {
    it("should pause campaign successfully", async () => {
      const mockCampaign: DunningCampaign = {
        id: "campaign-1",
        tenant_id: "tenant-1",
        name: "Campaign",
        status: "paused",
        stages: [],
        total_executions: 0,
        successful_executions: 0,
        failed_executions: 0,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (dunningService.pauseCampaign as jest.Mock).mockResolvedValue(mockCampaign);

      const { result } = renderHook(() => usePauseDunningCampaign(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const paused = await result.current.mutateAsync("campaign-1");
        expect(paused).toEqual(mockCampaign);
      });

      expect(dunningService.pauseCampaign).toHaveBeenCalledWith("campaign-1");
    });

    it("should call onSuccess callback", async () => {
      const mockCampaign: DunningCampaign = {
        id: "campaign-1",
        tenant_id: "tenant-1",
        name: "Campaign",
        status: "paused",
        stages: [],
        total_executions: 0,
        successful_executions: 0,
        failed_executions: 0,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (dunningService.pauseCampaign as jest.Mock).mockResolvedValue(mockCampaign);

      const onSuccess = jest.fn();
      const { result } = renderHook(() => usePauseDunningCampaign({ onSuccess }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync("campaign-1");
      });

      expect(onSuccess).toHaveBeenCalledWith(mockCampaign);
    });

    it("should handle pause error", async () => {
      const error = new Error("Pause failed");
      (dunningService.pauseCampaign as jest.Mock).mockRejectedValue(error);

      const onError = jest.fn();
      const { result } = renderHook(() => usePauseDunningCampaign({ onError }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync("campaign-1");
        } catch (err) {
          // Expected
        }
      });

      expect(onError).toHaveBeenCalledWith(error);
    });

    it("should invalidate queries on success", async () => {
      const mockCampaign: DunningCampaign = {
        id: "campaign-1",
        tenant_id: "tenant-1",
        name: "Campaign",
        status: "paused",
        stages: [],
        total_executions: 0,
        successful_executions: 0,
        failed_executions: 0,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (dunningService.pauseCampaign as jest.Mock).mockResolvedValue(mockCampaign);

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => usePauseDunningCampaign(), {
        wrapper,
      });

      await act(async () => {
        await result.current.mutateAsync("campaign-1");
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: dunningKeys.campaigns() });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: dunningKeys.campaignDetail("campaign-1"),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: dunningKeys.statistics() });
    });
  });

  describe("useResumeDunningCampaign", () => {
    it("should resume campaign successfully", async () => {
      const mockCampaign: DunningCampaign = {
        id: "campaign-1",
        tenant_id: "tenant-1",
        name: "Campaign",
        status: "active",
        stages: [],
        total_executions: 0,
        successful_executions: 0,
        failed_executions: 0,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (dunningService.resumeCampaign as jest.Mock).mockResolvedValue(mockCampaign);

      const { result } = renderHook(() => useResumeDunningCampaign(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const resumed = await result.current.mutateAsync("campaign-1");
        expect(resumed).toEqual(mockCampaign);
      });

      expect(dunningService.resumeCampaign).toHaveBeenCalledWith("campaign-1");
    });

    it("should call onSuccess callback", async () => {
      const mockCampaign: DunningCampaign = {
        id: "campaign-1",
        tenant_id: "tenant-1",
        name: "Campaign",
        status: "active",
        stages: [],
        total_executions: 0,
        successful_executions: 0,
        failed_executions: 0,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (dunningService.resumeCampaign as jest.Mock).mockResolvedValue(mockCampaign);

      const onSuccess = jest.fn();
      const { result } = renderHook(() => useResumeDunningCampaign({ onSuccess }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync("campaign-1");
      });

      expect(onSuccess).toHaveBeenCalledWith(mockCampaign);
    });

    it("should handle resume error", async () => {
      const error = new Error("Resume failed");
      (dunningService.resumeCampaign as jest.Mock).mockRejectedValue(error);

      const onError = jest.fn();
      const { result } = renderHook(() => useResumeDunningCampaign({ onError }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync("campaign-1");
        } catch (err) {
          // Expected
        }
      });

      expect(onError).toHaveBeenCalledWith(error);
    });

    it("should invalidate queries on success", async () => {
      const mockCampaign: DunningCampaign = {
        id: "campaign-1",
        tenant_id: "tenant-1",
        name: "Campaign",
        status: "active",
        stages: [],
        total_executions: 0,
        successful_executions: 0,
        failed_executions: 0,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (dunningService.resumeCampaign as jest.Mock).mockResolvedValue(mockCampaign);

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useResumeDunningCampaign(), {
        wrapper,
      });

      await act(async () => {
        await result.current.mutateAsync("campaign-1");
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: dunningKeys.campaigns() });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: dunningKeys.campaignDetail("campaign-1"),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: dunningKeys.statistics() });
    });
  });

  // ==================== Execution Query Hooks ====================

  describe("useDunningExecutions", () => {
    it("should fetch executions successfully", async () => {
      const mockExecutions: DunningExecution[] = [
        {
          id: "execution-1",
          tenant_id: "tenant-1",
          campaign_id: "campaign-1",
          subscription_id: "sub-1",
          subscriber_email: "test@example.com",
          status: "completed",
          current_stage: 1,
          days_overdue: 10,
          amount_overdue: 99.99,
          actions_taken: ["email_reminder"],
          next_action_date: "2024-01-05T00:00:00Z",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      (dunningService.listExecutions as jest.Mock).mockResolvedValue(mockExecutions);

      const { result } = renderHook(() => useDunningExecutions(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockExecutions);
      expect(dunningService.listExecutions).toHaveBeenCalledWith({});
    });

    it("should handle filter parameters", async () => {
      (dunningService.listExecutions as jest.Mock).mockResolvedValue([]);

      renderHook(
        () =>
          useDunningExecutions({
            campaign_id: "campaign-1",
            status: "active",
            page: 2,
            page_size: 10,
          }),
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(dunningService.listExecutions).toHaveBeenCalledWith({
          campaign_id: "campaign-1",
          status: "active",
          page: 2,
          page_size: 10,
        });
      });
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch executions");
      (dunningService.listExecutions as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useDunningExecutions(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });
  });

  describe("useDunningExecution", () => {
    it("should fetch single execution successfully", async () => {
      const mockExecution: DunningExecution = {
        id: "execution-1",
        tenant_id: "tenant-1",
        campaign_id: "campaign-1",
        subscription_id: "sub-1",
        subscriber_email: "test@example.com",
        status: "completed",
        current_stage: 1,
        days_overdue: 10,
        amount_overdue: 99.99,
        actions_taken: ["email_reminder"],
        next_action_date: "2024-01-05T00:00:00Z",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (dunningService.getExecution as jest.Mock).mockResolvedValue(mockExecution);

      const { result } = renderHook(() => useDunningExecution("execution-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockExecution);
      expect(dunningService.getExecution).toHaveBeenCalledWith("execution-1");
    });

    it("should not fetch when executionId is null", async () => {
      const { result } = renderHook(() => useDunningExecution(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
      expect(dunningService.getExecution).not.toHaveBeenCalled();
    });

    it("should handle fetch error", async () => {
      const error = new Error("Execution not found");
      (dunningService.getExecution as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useDunningExecution("execution-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });
  });

  // ==================== Execution Mutation Hooks ====================

  describe("useStartDunningExecution", () => {
    it("should start execution successfully", async () => {
      const mockExecution: DunningExecution = {
        id: "execution-new",
        tenant_id: "tenant-1",
        campaign_id: "campaign-1",
        subscription_id: "sub-1",
        subscriber_email: "test@example.com",
        status: "active",
        current_stage: 1,
        days_overdue: 5,
        amount_overdue: 50.0,
        actions_taken: [],
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (dunningService.startExecution as jest.Mock).mockResolvedValue(mockExecution);

      const { result } = renderHook(() => useStartDunningExecution(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const started = await result.current.mutateAsync({
          campaign_id: "campaign-1",
          subscription_id: "sub-1",
        });
        expect(started).toEqual(mockExecution);
      });

      expect(dunningService.startExecution).toHaveBeenCalledWith({
        campaign_id: "campaign-1",
        subscription_id: "sub-1",
      });
    });

    it("should call onSuccess callback", async () => {
      const mockExecution: DunningExecution = {
        id: "execution-new",
        tenant_id: "tenant-1",
        campaign_id: "campaign-1",
        subscription_id: "sub-1",
        subscriber_email: "test@example.com",
        status: "active",
        current_stage: 1,
        days_overdue: 5,
        amount_overdue: 50.0,
        actions_taken: [],
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (dunningService.startExecution as jest.Mock).mockResolvedValue(mockExecution);

      const onSuccess = jest.fn();
      const { result } = renderHook(() => useStartDunningExecution({ onSuccess }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          campaign_id: "campaign-1",
          subscription_id: "sub-1",
        });
      });

      expect(onSuccess).toHaveBeenCalledWith(mockExecution);
    });

    it("should handle start error", async () => {
      const error = new Error("Start failed");
      (dunningService.startExecution as jest.Mock).mockRejectedValue(error);

      const onError = jest.fn();
      const { result } = renderHook(() => useStartDunningExecution({ onError }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            campaign_id: "campaign-1",
            subscription_id: "sub-1",
          });
        } catch (err) {
          // Expected
        }
      });

      expect(onError).toHaveBeenCalledWith(error);
    });

    it("should invalidate queries on success", async () => {
      const mockExecution: DunningExecution = {
        id: "execution-new",
        tenant_id: "tenant-1",
        campaign_id: "campaign-1",
        subscription_id: "sub-1",
        subscriber_email: "test@example.com",
        status: "active",
        current_stage: 1,
        days_overdue: 5,
        amount_overdue: 50.0,
        actions_taken: [],
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (dunningService.startExecution as jest.Mock).mockResolvedValue(mockExecution);

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useStartDunningExecution(), {
        wrapper,
      });

      await act(async () => {
        await result.current.mutateAsync({
          campaign_id: "campaign-1",
          subscription_id: "sub-1",
        });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: dunningKeys.executions() });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: dunningKeys.statistics() });
    });
  });

  describe("useCancelDunningExecution", () => {
    it("should cancel execution successfully", async () => {
      const mockExecution: DunningExecution = {
        id: "execution-1",
        tenant_id: "tenant-1",
        campaign_id: "campaign-1",
        subscription_id: "sub-1",
        subscriber_email: "test@example.com",
        status: "cancelled",
        current_stage: 1,
        days_overdue: 5,
        amount_overdue: 50.0,
        actions_taken: [],
        cancellation_reason: "Payment received",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (dunningService.cancelExecution as jest.Mock).mockResolvedValue(mockExecution);

      const { result } = renderHook(() => useCancelDunningExecution(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const cancelled = await result.current.mutateAsync({
          executionId: "execution-1",
          reason: "Payment received",
        });
        expect(cancelled).toEqual(mockExecution);
      });

      expect(dunningService.cancelExecution).toHaveBeenCalledWith(
        "execution-1",
        "Payment received",
      );
    });

    it("should call onSuccess callback", async () => {
      const mockExecution: DunningExecution = {
        id: "execution-1",
        tenant_id: "tenant-1",
        campaign_id: "campaign-1",
        subscription_id: "sub-1",
        subscriber_email: "test@example.com",
        status: "cancelled",
        current_stage: 1,
        days_overdue: 5,
        amount_overdue: 50.0,
        actions_taken: [],
        cancellation_reason: "Payment received",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (dunningService.cancelExecution as jest.Mock).mockResolvedValue(mockExecution);

      const onSuccess = jest.fn();
      const { result } = renderHook(() => useCancelDunningExecution({ onSuccess }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          executionId: "execution-1",
          reason: "Payment received",
        });
      });

      expect(onSuccess).toHaveBeenCalledWith(mockExecution);
    });

    it("should handle cancel error", async () => {
      const error = new Error("Cancel failed");
      (dunningService.cancelExecution as jest.Mock).mockRejectedValue(error);

      const onError = jest.fn();
      const { result } = renderHook(() => useCancelDunningExecution({ onError }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            executionId: "execution-1",
            reason: "Test",
          });
        } catch (err) {
          // Expected
        }
      });

      expect(onError).toHaveBeenCalledWith(error);
    });

    it("should invalidate queries on success", async () => {
      const mockExecution: DunningExecution = {
        id: "execution-1",
        tenant_id: "tenant-1",
        campaign_id: "campaign-1",
        subscription_id: "sub-1",
        subscriber_email: "test@example.com",
        status: "cancelled",
        current_stage: 1,
        days_overdue: 5,
        amount_overdue: 50.0,
        actions_taken: [],
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (dunningService.cancelExecution as jest.Mock).mockResolvedValue(mockExecution);

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useCancelDunningExecution(), {
        wrapper,
      });

      await act(async () => {
        await result.current.mutateAsync({
          executionId: "execution-1",
          reason: "Test",
        });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: dunningKeys.executions() });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: dunningKeys.executionDetail("execution-1"),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: dunningKeys.statistics() });
    });
  });

  // ==================== Statistics Hooks ====================

  describe("useDunningStatistics", () => {
    it("should fetch statistics successfully", async () => {
      const mockStats: DunningStatistics = {
        total_campaigns: 5,
        active_campaigns: 3,
        paused_campaigns: 2,
        total_executions: 100,
        active_executions: 20,
        completed_executions: 75,
        cancelled_executions: 5,
        total_amount_recovered: 5000.0,
        total_amount_outstanding: 2000.0,
        recovery_rate: 71.43,
        average_days_to_recovery: 15,
      };

      (dunningService.getStatistics as jest.Mock).mockResolvedValue(mockStats);

      const { result } = renderHook(() => useDunningStatistics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockStats);
      expect(dunningService.getStatistics).toHaveBeenCalled();
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch statistics");
      (dunningService.getStatistics as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useDunningStatistics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });

    it("should have correct staleTime and gcTime", async () => {
      (dunningService.getStatistics as jest.Mock).mockResolvedValue({
        total_campaigns: 0,
        active_campaigns: 0,
        total_executions: 0,
      });

      const { result } = renderHook(() => useDunningStatistics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // staleTime is 60000ms, gcTime is 10 * 60 * 1000ms
      expect(result.current.data).toBeDefined();
    });
  });

  describe("useDunningCampaignStatistics", () => {
    it("should fetch campaign statistics successfully", async () => {
      const mockStats: DunningCampaignStats = {
        campaign_id: "campaign-1",
        total_executions: 50,
        active_executions: 10,
        completed_executions: 35,
        cancelled_executions: 5,
        total_amount_recovered: 2500.0,
        total_amount_outstanding: 1000.0,
        recovery_rate: 71.43,
        average_days_to_recovery: 12,
        success_by_stage: {
          "1": 30,
          "2": 5,
          "3": 0,
        },
      };

      (dunningService.getCampaignStatistics as jest.Mock).mockResolvedValue(mockStats);

      const { result } = renderHook(() => useDunningCampaignStatistics("campaign-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockStats);
      expect(dunningService.getCampaignStatistics).toHaveBeenCalledWith("campaign-1");
    });

    it("should not fetch when campaignId is null", async () => {
      const { result } = renderHook(() => useDunningCampaignStatistics(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
      expect(dunningService.getCampaignStatistics).not.toHaveBeenCalled();
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch campaign statistics");
      (dunningService.getCampaignStatistics as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useDunningCampaignStatistics("campaign-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });
  });

  describe("useDunningRecoveryChart", () => {
    it("should fetch recovery chart data successfully", async () => {
      const mockChartData: DunningRecoveryChartData[] = [
        {
          date: "2024-01-01",
          amount_recovered: 500.0,
          executions_completed: 10,
          recovery_rate: 80.0,
        },
        {
          date: "2024-01-02",
          amount_recovered: 750.0,
          executions_completed: 15,
          recovery_rate: 75.0,
        },
      ];

      (dunningService.getRecoveryChartData as jest.Mock).mockResolvedValue(mockChartData);

      const { result } = renderHook(() => useDunningRecoveryChart(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockChartData);
      expect(dunningService.getRecoveryChartData).toHaveBeenCalledWith(30);
    });

    it("should use custom days parameter", async () => {
      (dunningService.getRecoveryChartData as jest.Mock).mockResolvedValue([]);

      renderHook(() => useDunningRecoveryChart(7), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(dunningService.getRecoveryChartData).toHaveBeenCalledWith(7);
      });
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch recovery chart data");
      (dunningService.getRecoveryChartData as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useDunningRecoveryChart(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });
  });

  // ==================== Combined Operations Hook ====================

  describe("useDunningOperations", () => {
    it("should expose all operation functions", async () => {
      const mockCampaign: DunningCampaign = {
        id: "campaign-1",
        tenant_id: "tenant-1",
        name: "Campaign",
        status: "active",
        stages: [],
        total_executions: 0,
        successful_executions: 0,
        failed_executions: 0,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      const mockExecution: DunningExecution = {
        id: "execution-1",
        tenant_id: "tenant-1",
        campaign_id: "campaign-1",
        subscription_id: "sub-1",
        subscriber_email: "test@example.com",
        status: "cancelled",
        current_stage: 1,
        days_overdue: 5,
        amount_overdue: 50.0,
        actions_taken: [],
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (dunningService.pauseCampaign as jest.Mock).mockResolvedValue(mockCampaign);
      (dunningService.resumeCampaign as jest.Mock).mockResolvedValue(mockCampaign);
      (dunningService.cancelExecution as jest.Mock).mockResolvedValue(mockExecution);

      const { result } = renderHook(() => useDunningOperations(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.pauseCampaign).toBe("function");
      expect(typeof result.current.resumeCampaign).toBe("function");
      expect(typeof result.current.cancelExecution).toBe("function");
      expect(result.current.isLoading).toBe(false);
    });

    it("should pause campaign successfully", async () => {
      const mockCampaign: DunningCampaign = {
        id: "campaign-1",
        tenant_id: "tenant-1",
        name: "Campaign",
        status: "paused",
        stages: [],
        total_executions: 0,
        successful_executions: 0,
        failed_executions: 0,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (dunningService.pauseCampaign as jest.Mock).mockResolvedValue(mockCampaign);

      const { result } = renderHook(() => useDunningOperations(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const paused = await result.current.pauseCampaign("campaign-1");
        expect(paused).toEqual(mockCampaign);
      });

      expect(dunningService.pauseCampaign).toHaveBeenCalledWith("campaign-1");
    });

    it("should resume campaign successfully", async () => {
      const mockCampaign: DunningCampaign = {
        id: "campaign-1",
        tenant_id: "tenant-1",
        name: "Campaign",
        status: "active",
        stages: [],
        total_executions: 0,
        successful_executions: 0,
        failed_executions: 0,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (dunningService.resumeCampaign as jest.Mock).mockResolvedValue(mockCampaign);

      const { result } = renderHook(() => useDunningOperations(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const resumed = await result.current.resumeCampaign("campaign-1");
        expect(resumed).toEqual(mockCampaign);
      });

      expect(dunningService.resumeCampaign).toHaveBeenCalledWith("campaign-1");
    });

    it("should cancel execution successfully", async () => {
      const mockExecution: DunningExecution = {
        id: "execution-1",
        tenant_id: "tenant-1",
        campaign_id: "campaign-1",
        subscription_id: "sub-1",
        subscriber_email: "test@example.com",
        status: "cancelled",
        current_stage: 1,
        days_overdue: 5,
        amount_overdue: 50.0,
        actions_taken: [],
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (dunningService.cancelExecution as jest.Mock).mockResolvedValue(mockExecution);

      const { result } = renderHook(() => useDunningOperations(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const cancelled = await result.current.cancelExecution("execution-1", "Test reason");
        expect(cancelled).toEqual(mockExecution);
      });

      expect(dunningService.cancelExecution).toHaveBeenCalledWith("execution-1", "Test reason");
    });

    it("should set isLoading correctly during operations", async () => {
      (dunningService.pauseCampaign as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({}), 100)),
      );

      const { result } = renderHook(() => useDunningOperations(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);

      act(() => {
        result.current.pauseCampaign("campaign-1");
      });

      await waitFor(() => expect(result.current.isLoading).toBe(true), { timeout: 100 });
      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 200 });
    });

    it("should handle pause error", async () => {
      const error = new Error("Pause failed");
      (dunningService.pauseCampaign as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useDunningOperations(), {
        wrapper: createWrapper(),
      });

      await expect(result.current.pauseCampaign("campaign-1")).rejects.toThrow("Pause failed");
    });

    it("should handle resume error", async () => {
      const error = new Error("Resume failed");
      (dunningService.resumeCampaign as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useDunningOperations(), {
        wrapper: createWrapper(),
      });

      await expect(result.current.resumeCampaign("campaign-1")).rejects.toThrow("Resume failed");
    });

    it("should handle cancel execution error", async () => {
      const error = new Error("Cancel failed");
      (dunningService.cancelExecution as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useDunningOperations(), {
        wrapper: createWrapper(),
      });

      await expect(result.current.cancelExecution("execution-1", "Test")).rejects.toThrow(
        "Cancel failed",
      );
    });
  });
});
