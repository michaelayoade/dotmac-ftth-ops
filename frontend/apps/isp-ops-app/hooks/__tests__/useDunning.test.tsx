/**
 * Jest Mock Tests for useDunning
 *
 * Uses direct jest mocks for dunningService instead of MSW for reliable testing
 * of React Query hooks with both queries and mutations.
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
  dunningKeys,
  type DunningCampaign,
  type DunningExecution,
  type DunningStatistics,
  type DunningCampaignStats,
  type DunningRecoveryChartData,
} from "../useDunning";
import type {
  DunningCampaignCreate,
  DunningCampaignUpdate,
  DunningExecutionStart,
} from "@/lib/services/dunning-service";

// Mock dunning service
jest.mock("@/lib/services/dunning-service", () => ({
  dunningService: {
    listCampaigns: jest.fn(),
    getCampaign: jest.fn(),
    createCampaign: jest.fn(),
    updateCampaign: jest.fn(),
    deleteCampaign: jest.fn(),
    pauseCampaign: jest.fn(),
    resumeCampaign: jest.fn(),
    listExecutions: jest.fn(),
    getExecution: jest.fn(),
    startExecution: jest.fn(),
    cancelExecution: jest.fn(),
    getStatistics: jest.fn(),
    getCampaignStatistics: jest.fn(),
    getRecoveryChartData: jest.fn(),
  },
}));

// Mock toast
jest.mock("@dotmac/ui", () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

import { dunningService } from "@/lib/services/dunning-service";

const mockDunningService = dunningService as jest.Mocked<typeof dunningService>;

// Test wrapper
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

// Mock data helpers
const createMockCampaign = (overrides?: Partial<DunningCampaign>): DunningCampaign => ({
  id: "camp-1",
  tenant_id: "tenant-1",
  name: "Test Campaign",
  description: "Test dunning campaign",
  status: "active",
  trigger_after_days: 30,
  max_retries: 3,
  retry_interval_days: 7,
  actions: [],
  priority: 1,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  ...overrides,
});

const createMockExecution = (overrides?: Partial<DunningExecution>): DunningExecution => ({
  id: "exec-1",
  tenant_id: "tenant-1",
  campaign_id: "camp-1",
  subscription_id: "sub-1",
  customer_id: "cust-1",
  status: "active",
  current_step: 1,
  total_steps: 3,
  retry_count: 0,
  started_at: "2024-01-01T00:00:00Z",
  outstanding_amount: 100.0,
  recovered_amount: 0.0,
  execution_log: [],
  metadata: {},
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  ...overrides,
});

const createMockStatistics = (overrides?: Partial<DunningStatistics>): DunningStatistics => ({
  total_campaigns: 10,
  active_campaigns: 7,
  total_executions: 100,
  active_executions: 25,
  completed_executions: 60,
  failed_executions: 10,
  canceled_executions: 5,
  total_recovered_amount: 50000.0,
  average_recovery_rate: 75.5,
  average_completion_time_hours: 48,
  ...overrides,
});

const createMockCampaignStats = (
  overrides?: Partial<DunningCampaignStats>,
): DunningCampaignStats => ({
  campaign_id: "camp-1",
  total_executions: 50,
  active_executions: 10,
  completed_executions: 35,
  failed_executions: 3,
  canceled_executions: 2,
  total_recovered_amount: 25000.0,
  average_recovery_rate: 80.0,
  success_rate: 87.5,
  average_completion_time_hours: 36,
  ...overrides,
});

const createMockRecoveryChart = (
  overrides?: Partial<DunningRecoveryChartData>,
): DunningRecoveryChartData => ({
  days: 30,
  data_points: [
    { date: "2024-01-01", recovered_amount: 1000, execution_count: 5 },
    { date: "2024-01-02", recovered_amount: 1500, execution_count: 7 },
  ],
  ...overrides,
});

describe("useDunning - Unit Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Query Key Factory", () => {
    it("should generate correct query keys", () => {
      expect(dunningKeys.all).toEqual(["dunning"]);
      expect(dunningKeys.campaigns()).toEqual(["dunning", "campaigns"]);
      expect(dunningKeys.campaign({ status: "active" })).toEqual([
        "dunning",
        "campaigns",
        { status: "active" },
      ]);
      expect(dunningKeys.campaignDetail("camp-1")).toEqual(["dunning", "campaigns", "camp-1"]);
      expect(dunningKeys.executions()).toEqual(["dunning", "executions"]);
      expect(dunningKeys.execution({ status: "active" })).toEqual([
        "dunning",
        "executions",
        { status: "active" },
      ]);
      expect(dunningKeys.executionDetail("exec-1")).toEqual(["dunning", "executions", "exec-1"]);
      expect(dunningKeys.statistics()).toEqual(["dunning", "statistics"]);
      expect(dunningKeys.campaignStats("camp-1")).toEqual([
        "dunning",
        "statistics",
        "campaign",
        "camp-1",
      ]);
      expect(dunningKeys.recoveryChart(30)).toEqual(["dunning", "recovery-chart", 30]);
    });
  });

  describe("useDunningCampaigns", () => {
    it("should fetch campaigns successfully", async () => {
      const mockCampaigns = [
        createMockCampaign({ id: "camp-1" }),
        createMockCampaign({ id: "camp-2" }),
      ];

      mockDunningService.listCampaigns.mockResolvedValue(mockCampaigns);

      const { result } = renderHook(() => useDunningCampaigns(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].id).toBe("camp-1");
      expect(result.current.error).toBeNull();
    });

    it("should handle empty campaign list", async () => {
      mockDunningService.listCampaigns.mockResolvedValue([]);

      const { result } = renderHook(() => useDunningCampaigns(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(0);
    });

    it("should filter campaigns by status", async () => {
      const mockCampaigns = [createMockCampaign({ status: "active" })];

      mockDunningService.listCampaigns.mockResolvedValue(mockCampaigns);

      const { result } = renderHook(() => useDunningCampaigns({ status: "active" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockDunningService.listCampaigns).toHaveBeenCalledWith({ status: "active" });
      expect(result.current.data).toHaveLength(1);
    });

    it("should handle fetch error", async () => {
      mockDunningService.listCampaigns.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useDunningCampaigns(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });
  });

  describe("useDunningCampaign", () => {
    it("should fetch single campaign successfully", async () => {
      const mockCampaign = createMockCampaign({ id: "camp-1" });

      mockDunningService.getCampaign.mockResolvedValue(mockCampaign);

      const { result } = renderHook(() => useDunningCampaign("camp-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockDunningService.getCampaign).toHaveBeenCalledWith("camp-1");
      expect(result.current.data?.id).toBe("camp-1");
      expect(result.current.error).toBeNull();
    });

    it("should not fetch when campaignId is null", async () => {
      const { result } = renderHook(() => useDunningCampaign(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));

      expect(mockDunningService.getCampaign).not.toHaveBeenCalled();
      expect(result.current.data).toBeUndefined();
    });

    it("should handle not found error", async () => {
      mockDunningService.getCampaign.mockRejectedValue(new Error("Campaign not found"));

      const { result } = renderHook(() => useDunningCampaign("camp-999"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });
  });

  describe("useCreateDunningCampaign", () => {
    it("should create campaign successfully", async () => {
      const newCampaign: DunningCampaignCreate = {
        name: "New Campaign",
        trigger_after_days: 30,
        max_retries: 3,
        retry_interval_days: 7,
        actions: [],
      };

      const createdCampaign = createMockCampaign({
        id: "camp-new",
        name: "New Campaign",
      });

      mockDunningService.createCampaign.mockResolvedValue(createdCampaign);

      const onSuccess = jest.fn();
      const { result } = renderHook(() => useCreateDunningCampaign({ onSuccess }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync(newCampaign);
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockDunningService.createCampaign).toHaveBeenCalledWith(newCampaign);
      expect(onSuccess).toHaveBeenCalledWith(createdCampaign);
      expect(result.current.isError).toBe(false);
    });

    it("should handle create error", async () => {
      const newCampaign: DunningCampaignCreate = {
        name: "Invalid Campaign",
        trigger_after_days: 30,
        max_retries: 3,
        retry_interval_days: 7,
        actions: [],
      };

      mockDunningService.createCampaign.mockRejectedValue(new Error("Invalid data"));

      const onError = jest.fn();
      const { result } = renderHook(() => useCreateDunningCampaign({ onError }), {
        wrapper: createWrapper(),
      });

      await expect(result.current.mutateAsync(newCampaign)).rejects.toThrow();

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(onError).toHaveBeenCalled();
    });
  });

  describe("useUpdateDunningCampaign", () => {
    it("should update campaign successfully", async () => {
      const updateData: DunningCampaignUpdate = {
        name: "Updated Campaign",
      };

      const updatedCampaign = createMockCampaign({
        id: "camp-1",
        name: "Updated Campaign",
      });

      mockDunningService.updateCampaign.mockResolvedValue(updatedCampaign);

      const onSuccess = jest.fn();
      const { result } = renderHook(() => useUpdateDunningCampaign({ onSuccess }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({ campaignId: "camp-1", data: updateData });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockDunningService.updateCampaign).toHaveBeenCalledWith("camp-1", updateData);
      expect(onSuccess).toHaveBeenCalledWith(updatedCampaign);
    });

    it("should handle update error", async () => {
      mockDunningService.updateCampaign.mockRejectedValue(new Error("Update failed"));

      const onError = jest.fn();
      const { result } = renderHook(() => useUpdateDunningCampaign({ onError }), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({ campaignId: "camp-1", data: {} }),
      ).rejects.toThrow();

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(onError).toHaveBeenCalled();
    });
  });

  describe("useDeleteDunningCampaign", () => {
    it("should delete campaign successfully", async () => {
      mockDunningService.deleteCampaign.mockResolvedValue();

      const onSuccess = jest.fn();
      const { result } = renderHook(() => useDeleteDunningCampaign({ onSuccess }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync("camp-1");
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockDunningService.deleteCampaign).toHaveBeenCalledWith("camp-1");
      expect(onSuccess).toHaveBeenCalled();
    });

    it("should handle delete error", async () => {
      mockDunningService.deleteCampaign.mockRejectedValue(
        new Error("Campaign has active executions"),
      );

      const onError = jest.fn();
      const { result } = renderHook(() => useDeleteDunningCampaign({ onError }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await expect(result.current.mutateAsync("camp-1")).rejects.toThrow();
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(onError).toHaveBeenCalled();
    });
  });

  describe("usePauseDunningCampaign", () => {
    it("should pause campaign successfully", async () => {
      const pausedCampaign = createMockCampaign({
        id: "camp-1",
        status: "paused",
      });

      mockDunningService.pauseCampaign.mockResolvedValue(pausedCampaign);

      const onSuccess = jest.fn();
      const { result } = renderHook(() => usePauseDunningCampaign({ onSuccess }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync("camp-1");
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockDunningService.pauseCampaign).toHaveBeenCalledWith("camp-1");
      expect(onSuccess).toHaveBeenCalledWith(pausedCampaign);
    });

    it("should handle pause error", async () => {
      mockDunningService.pauseCampaign.mockRejectedValue(new Error("Already paused"));

      const onError = jest.fn();
      const { result } = renderHook(() => usePauseDunningCampaign({ onError }), {
        wrapper: createWrapper(),
      });

      await expect(result.current.mutateAsync("camp-1")).rejects.toThrow();

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(onError).toHaveBeenCalled();
    });
  });

  describe("useResumeDunningCampaign", () => {
    it("should resume campaign successfully", async () => {
      const resumedCampaign = createMockCampaign({
        id: "camp-1",
        status: "active",
      });

      mockDunningService.resumeCampaign.mockResolvedValue(resumedCampaign);

      const onSuccess = jest.fn();
      const { result } = renderHook(() => useResumeDunningCampaign({ onSuccess }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync("camp-1");
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockDunningService.resumeCampaign).toHaveBeenCalledWith("camp-1");
      expect(onSuccess).toHaveBeenCalledWith(resumedCampaign);
    });

    it("should handle resume error", async () => {
      mockDunningService.resumeCampaign.mockRejectedValue(new Error("Already active"));

      const onError = jest.fn();
      const { result } = renderHook(() => useResumeDunningCampaign({ onError }), {
        wrapper: createWrapper(),
      });

      await expect(result.current.mutateAsync("camp-1")).rejects.toThrow();

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(onError).toHaveBeenCalled();
    });
  });

  describe("useDunningExecutions", () => {
    it("should fetch executions successfully", async () => {
      const mockExecutions = [
        createMockExecution({ id: "exec-1" }),
        createMockExecution({ id: "exec-2" }),
      ];

      mockDunningService.listExecutions.mockResolvedValue(mockExecutions);

      const { result } = renderHook(() => useDunningExecutions(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].id).toBe("exec-1");
    });

    it("should filter executions by campaign_id", async () => {
      const mockExecutions = [createMockExecution({ campaign_id: "camp-1" })];

      mockDunningService.listExecutions.mockResolvedValue(mockExecutions);

      const { result } = renderHook(() => useDunningExecutions({ campaign_id: "camp-1" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockDunningService.listExecutions).toHaveBeenCalledWith({
        campaign_id: "camp-1",
      });
      expect(result.current.data).toHaveLength(1);
    });

    it("should filter executions by status", async () => {
      const mockExecutions = [createMockExecution({ status: "completed" })];

      mockDunningService.listExecutions.mockResolvedValue(mockExecutions);

      const { result } = renderHook(() => useDunningExecutions({ status: "completed" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockDunningService.listExecutions).toHaveBeenCalledWith({
        status: "completed",
      });
    });

    it("should handle fetch error", async () => {
      mockDunningService.listExecutions.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useDunningExecutions(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });
  });

  describe("useDunningExecution", () => {
    it("should fetch single execution successfully", async () => {
      const mockExecution = createMockExecution({ id: "exec-1" });

      mockDunningService.getExecution.mockResolvedValue(mockExecution);

      const { result } = renderHook(() => useDunningExecution("exec-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockDunningService.getExecution).toHaveBeenCalledWith("exec-1");
      expect(result.current.data?.id).toBe("exec-1");
    });

    it("should not fetch when executionId is null", async () => {
      const { result } = renderHook(() => useDunningExecution(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));

      expect(mockDunningService.getExecution).not.toHaveBeenCalled();
    });

    it("should handle not found error", async () => {
      mockDunningService.getExecution.mockRejectedValue(new Error("Execution not found"));

      const { result } = renderHook(() => useDunningExecution("exec-999"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });
  });

  describe("useStartDunningExecution", () => {
    it("should start execution successfully", async () => {
      const startData: DunningExecutionStart = {
        subscription_id: "sub-1",
        campaign_id: "camp-1",
      };

      const startedExecution = createMockExecution({
        id: "exec-new",
        subscription_id: "sub-1",
        campaign_id: "camp-1",
      });

      mockDunningService.startExecution.mockResolvedValue(startedExecution);

      const onSuccess = jest.fn();
      const { result } = renderHook(() => useStartDunningExecution({ onSuccess }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync(startData);
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockDunningService.startExecution).toHaveBeenCalledWith(startData);
      expect(onSuccess).toHaveBeenCalledWith(startedExecution);
    });

    it("should handle start error", async () => {
      mockDunningService.startExecution.mockRejectedValue(new Error("Execution already active"));

      const onError = jest.fn();
      const { result } = renderHook(() => useStartDunningExecution({ onError }), {
        wrapper: createWrapper(),
      });

      await expect(result.current.mutateAsync({ subscription_id: "sub-1" })).rejects.toThrow();

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(onError).toHaveBeenCalled();
    });
  });

  describe("useCancelDunningExecution", () => {
    it("should cancel execution successfully", async () => {
      const canceledExecution = createMockExecution({
        id: "exec-1",
        status: "canceled",
      });

      mockDunningService.cancelExecution.mockResolvedValue(canceledExecution);

      const onSuccess = jest.fn();
      const { result } = renderHook(() => useCancelDunningExecution({ onSuccess }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          executionId: "exec-1",
          reason: "Customer request",
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockDunningService.cancelExecution).toHaveBeenCalledWith("exec-1", "Customer request");
      expect(onSuccess).toHaveBeenCalledWith(canceledExecution);
    });

    it("should handle cancel error", async () => {
      mockDunningService.cancelExecution.mockRejectedValue(new Error("Already completed"));

      const onError = jest.fn();
      const { result } = renderHook(() => useCancelDunningExecution({ onError }), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({ executionId: "exec-1", reason: "Test" }),
      ).rejects.toThrow();

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(onError).toHaveBeenCalled();
    });
  });

  describe("useDunningStatistics", () => {
    it("should fetch statistics successfully", async () => {
      const mockStats = createMockStatistics();

      mockDunningService.getStatistics.mockResolvedValue(mockStats);

      const { result } = renderHook(() => useDunningStatistics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockDunningService.getStatistics).toHaveBeenCalled();
      expect(result.current.data?.total_campaigns).toBe(10);
      expect(result.current.data?.total_executions).toBe(100);
    });

    it("should handle fetch error", async () => {
      mockDunningService.getStatistics.mockRejectedValue(new Error("Stats unavailable"));

      const { result } = renderHook(() => useDunningStatistics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });
  });

  describe("useDunningCampaignStatistics", () => {
    it("should fetch campaign statistics successfully", async () => {
      const mockStats = createMockCampaignStats();

      mockDunningService.getCampaignStatistics.mockResolvedValue(mockStats);

      const { result } = renderHook(() => useDunningCampaignStatistics("camp-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockDunningService.getCampaignStatistics).toHaveBeenCalledWith("camp-1");
      expect(result.current.data?.campaign_id).toBe("camp-1");
      expect(result.current.data?.total_executions).toBe(50);
    });

    it("should not fetch when campaignId is null", async () => {
      const { result } = renderHook(() => useDunningCampaignStatistics(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));

      expect(mockDunningService.getCampaignStatistics).not.toHaveBeenCalled();
    });

    it("should handle fetch error", async () => {
      mockDunningService.getCampaignStatistics.mockRejectedValue(new Error("Campaign not found"));

      const { result } = renderHook(() => useDunningCampaignStatistics("camp-999"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });
  });

  describe("useDunningRecoveryChart", () => {
    it("should fetch recovery chart data successfully", async () => {
      const mockChart = [createMockRecoveryChart()];

      mockDunningService.getRecoveryChartData.mockResolvedValue(mockChart);

      const { result } = renderHook(() => useDunningRecoveryChart(30), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockDunningService.getRecoveryChartData).toHaveBeenCalledWith(30);
      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].days).toBe(30);
    });

    it("should default to 30 days", async () => {
      const mockChart = [createMockRecoveryChart()];

      mockDunningService.getRecoveryChartData.mockResolvedValue(mockChart);

      const { result } = renderHook(() => useDunningRecoveryChart(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockDunningService.getRecoveryChartData).toHaveBeenCalledWith(30);
    });

    it("should handle fetch error", async () => {
      mockDunningService.getRecoveryChartData.mockRejectedValue(new Error("Chart unavailable"));

      const { result } = renderHook(() => useDunningRecoveryChart(30), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });
  });

  describe("Real-world Scenarios", () => {
    it("should handle campaign lifecycle", async () => {
      // 1. Create campaign
      const newCampaign: DunningCampaignCreate = {
        name: "Test Campaign",
        trigger_after_days: 30,
        max_retries: 3,
        retry_interval_days: 7,
        actions: [],
      };

      mockDunningService.createCampaign.mockResolvedValue(createMockCampaign({ id: "camp-new" }));

      const { result: createResult } = renderHook(() => useCreateDunningCampaign(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await createResult.current.mutateAsync(newCampaign);
      });

      expect(mockDunningService.createCampaign).toHaveBeenCalledWith(newCampaign);

      // 2. Pause campaign
      mockDunningService.pauseCampaign.mockResolvedValue(
        createMockCampaign({ id: "camp-new", status: "paused" }),
      );

      const { result: pauseResult } = renderHook(() => usePauseDunningCampaign(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await pauseResult.current.mutateAsync("camp-new");
      });

      expect(mockDunningService.pauseCampaign).toHaveBeenCalledWith("camp-new");

      // 3. Resume campaign
      mockDunningService.resumeCampaign.mockResolvedValue(
        createMockCampaign({ id: "camp-new", status: "active" }),
      );

      const { result: resumeResult } = renderHook(() => useResumeDunningCampaign(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await resumeResult.current.mutateAsync("camp-new");
      });

      expect(mockDunningService.resumeCampaign).toHaveBeenCalledWith("camp-new");

      // 4. Delete campaign
      mockDunningService.deleteCampaign.mockResolvedValue();

      const { result: deleteResult } = renderHook(() => useDeleteDunningCampaign(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await deleteResult.current.mutateAsync("camp-new");
      });

      expect(mockDunningService.deleteCampaign).toHaveBeenCalledWith("camp-new");
    });

    it("should handle execution lifecycle", async () => {
      // 1. Start execution
      mockDunningService.startExecution.mockResolvedValue(createMockExecution({ id: "exec-new" }));

      const { result: startResult } = renderHook(() => useStartDunningExecution(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await startResult.current.mutateAsync({
          subscription_id: "sub-1",
          campaign_id: "camp-1",
        });
      });

      expect(mockDunningService.startExecution).toHaveBeenCalled();

      // 2. Cancel execution
      mockDunningService.cancelExecution.mockResolvedValue(
        createMockExecution({ id: "exec-new", status: "canceled" }),
      );

      const { result: cancelResult } = renderHook(() => useCancelDunningExecution(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await cancelResult.current.mutateAsync({
          executionId: "exec-new",
          reason: "Test",
        });
      });

      expect(mockDunningService.cancelExecution).toHaveBeenCalledWith("exec-new", "Test");
    });

    it("should handle concurrent fetches", async () => {
      const mockCampaigns = [createMockCampaign()];
      const mockExecutions = [createMockExecution()];
      const mockStats = createMockStatistics();

      mockDunningService.listCampaigns.mockResolvedValue(mockCampaigns);
      mockDunningService.listExecutions.mockResolvedValue(mockExecutions);
      mockDunningService.getStatistics.mockResolvedValue(mockStats);

      const { result: campaignsResult } = renderHook(() => useDunningCampaigns(), {
        wrapper: createWrapper(),
      });
      const { result: executionsResult } = renderHook(() => useDunningExecutions(), {
        wrapper: createWrapper(),
      });
      const { result: statsResult } = renderHook(() => useDunningStatistics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(campaignsResult.current.isLoading).toBe(false);
        expect(executionsResult.current.isLoading).toBe(false);
        expect(statsResult.current.isLoading).toBe(false);
      });

      expect(campaignsResult.current.data).toHaveLength(1);
      expect(executionsResult.current.data).toHaveLength(1);
      expect(statsResult.current.data?.total_campaigns).toBe(10);
    });
  });
});
