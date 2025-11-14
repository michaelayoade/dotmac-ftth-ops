/**
 * MSW-powered tests for useDunning
 *
 * This test file uses MSW for API mocking instead of jest.mock.
 * MSW provides more realistic network mocking and better test isolation.
 */

import { renderHook, waitFor, act } from "@testing-library/react";
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
} from "../useDunning";
import {
  createTestQueryClient,
  createQueryWrapper,
  resetDunningStorage,
  createMockDunningCampaign,
  createMockDunningExecution,
  seedDunningData,
  makeApiEndpointFail,
} from "../../__tests__/test-utils";

describe("useDunning (MSW)", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    resetDunningStorage();
  });

  afterEach(() => {
    queryClient.clear();
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
      expect(dunningKeys.execution({ status: "active" })).toEqual([
        "dunning",
        "executions",
        { status: "active" },
      ]);
      expect(dunningKeys.executionDetail("exec-1")).toEqual([
        "dunning",
        "executions",
        "exec-1",
      ]);
      expect(dunningKeys.statistics()).toEqual(["dunning", "statistics"]);
      expect(dunningKeys.campaignStats("campaign-1")).toEqual([
        "dunning",
        "statistics",
        "campaign",
        "campaign-1",
      ]);
      expect(dunningKeys.recoveryChart(30)).toEqual([
        "dunning",
        "recovery-chart",
        30,
      ]);
    });
  });

  describe("useDunningCampaigns - fetch campaigns", () => {
    it("should fetch campaigns successfully", async () => {
      const campaigns = [
        createMockDunningCampaign({ name: "Campaign 1" }),
        createMockDunningCampaign({ name: "Campaign 2" }),
      ];
      seedDunningData(campaigns, []);

      const { result } = renderHook(() => useDunningCampaigns(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].name).toBe("Campaign 1");
      expect(result.current.error).toBeNull();
    });

    it("should handle empty campaign list", async () => {
      seedDunningData([], []);

      const { result } = renderHook(() => useDunningCampaigns(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(0);
    });

    it("should filter campaigns by status", async () => {
      const campaigns = [
        createMockDunningCampaign({ status: "active" }),
        createMockDunningCampaign({ status: "paused" }),
        createMockDunningCampaign({ status: "active" }),
      ];
      seedDunningData(campaigns, []);

      const { result } = renderHook(
        () => useDunningCampaigns({ status: "active" }),
        {
          wrapper: createQueryWrapper(queryClient),
        }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.every((c) => c.status === "active")).toBe(
        true
      );
    });

    it("should search campaigns by name", async () => {
      const campaigns = [
        createMockDunningCampaign({ name: "Premium Campaign" }),
        createMockDunningCampaign({ name: "Basic Campaign" }),
        createMockDunningCampaign({ name: "Premium Plus" }),
      ];
      seedDunningData(campaigns, []);

      const { result } = renderHook(
        () => useDunningCampaigns({ search: "premium" }),
        {
          wrapper: createQueryWrapper(queryClient),
        }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(2);
    });

    it("should handle fetch error", async () => {
      makeApiEndpointFail("get", "/dunning/campaigns", "Server error");

      const { result } = renderHook(() => useDunningCampaigns(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });
  });

  describe("useDunningCampaign - fetch single campaign", () => {
    it("should fetch single campaign successfully", async () => {
      const campaign = createMockDunningCampaign({
        id: "campaign-1",
        name: "Test Campaign",
      });
      seedDunningData([campaign], []);

      const { result } = renderHook(() => useDunningCampaign("campaign-1"), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.name).toBe("Test Campaign");
      expect(result.current.error).toBeNull();
    });

    it("should not fetch when campaignId is null", () => {
      const { result } = renderHook(() => useDunningCampaign(null), {
        wrapper: createQueryWrapper(queryClient),
      });

      expect(result.current.data).toBeUndefined();
      expect(result.current.isLoading).toBe(false);
    });

    it("should handle not found error", async () => {
      seedDunningData([], []);

      const { result } = renderHook(
        () => useDunningCampaign("non-existent"),
        {
          wrapper: createQueryWrapper(queryClient),
        }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });
  });

  describe("useCreateDunningCampaign", () => {
    it("should create campaign successfully", async () => {
      const { result } = renderHook(() => useCreateDunningCampaign(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync({
          name: "New Campaign",
          description: "A new test campaign",
          stages: [],
        });
      });

      expect(result.current.data?.name).toBe("New Campaign");
      expect(result.current.error).toBeNull();
    });

    it("should call onSuccess callback", async () => {
      const onSuccess = jest.fn();

      const { result } = renderHook(
        () => useCreateDunningCampaign({ onSuccess }),
        {
          wrapper: createQueryWrapper(queryClient),
        }
      );

      await act(async () => {
        await result.current.mutateAsync({
          name: "New Campaign",
          stages: [],
        });
      });

      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ name: "New Campaign" })
      );
    });

    it("should handle create error", async () => {
      makeApiEndpointFail("post", "/dunning/campaigns", "Validation error", 400);

      const { result } = renderHook(() => useCreateDunningCampaign(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            name: "Invalid",
            stages: [],
          });
        } catch (e) {
          // Expected error
        }
      });

      expect(result.current.error).toBeTruthy();
    });
  });

  describe("useUpdateDunningCampaign", () => {
    it("should update campaign successfully", async () => {
      const campaign = createMockDunningCampaign({
        id: "campaign-1",
        name: "Old Name",
      });
      seedDunningData([campaign], []);

      const { result } = renderHook(() => useUpdateDunningCampaign(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync({
          campaignId: "campaign-1",
          data: { name: "Updated Name" },
        });
      });

      expect(result.current.data?.name).toBe("Updated Name");
    });
  });

  describe("useDeleteDunningCampaign", () => {
    it("should delete campaign successfully", async () => {
      const campaign = createMockDunningCampaign({ id: "campaign-1" });
      seedDunningData([campaign], []);

      const { result } = renderHook(() => useDeleteDunningCampaign(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync("campaign-1");
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe("usePauseDunningCampaign", () => {
    it("should pause campaign successfully", async () => {
      const campaign = createMockDunningCampaign({
        id: "campaign-1",
        status: "active",
      });
      seedDunningData([campaign], []);

      const { result } = renderHook(() => usePauseDunningCampaign(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync("campaign-1");
      });

      expect(result.current.data?.status).toBe("paused");
    });
  });

  describe("useResumeDunningCampaign", () => {
    it("should resume campaign successfully", async () => {
      const campaign = createMockDunningCampaign({
        id: "campaign-1",
        status: "paused",
      });
      seedDunningData([campaign], []);

      const { result } = renderHook(() => useResumeDunningCampaign(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync("campaign-1");
      });

      expect(result.current.data?.status).toBe("active");
    });
  });

  describe("useDunningExecutions - fetch executions", () => {
    it("should fetch executions successfully", async () => {
      const executions = [
        createMockDunningExecution(),
        createMockDunningExecution(),
      ];
      seedDunningData([], executions);

      const { result } = renderHook(() => useDunningExecutions(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(2);
    });

    it("should filter executions by campaign_id", async () => {
      const executions = [
        createMockDunningExecution({ campaign_id: "campaign-1" }),
        createMockDunningExecution({ campaign_id: "campaign-2" }),
        createMockDunningExecution({ campaign_id: "campaign-1" }),
      ];
      seedDunningData([], executions);

      const { result } = renderHook(
        () => useDunningExecutions({ campaign_id: "campaign-1" }),
        {
          wrapper: createQueryWrapper(queryClient),
        }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(2);
    });

    it("should filter executions by status", async () => {
      const executions = [
        createMockDunningExecution({ status: "active" }),
        createMockDunningExecution({ status: "completed" }),
        createMockDunningExecution({ status: "active" }),
      ];
      seedDunningData([], executions);

      const { result } = renderHook(
        () => useDunningExecutions({ status: "active" }),
        {
          wrapper: createQueryWrapper(queryClient),
        }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(2);
    });
  });

  describe("useDunningExecution - fetch single execution", () => {
    it("should fetch single execution successfully", async () => {
      const execution = createMockDunningExecution({ id: "exec-1" });
      seedDunningData([], [execution]);

      const { result } = renderHook(() => useDunningExecution("exec-1"), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.id).toBe("exec-1");
    });

    it("should not fetch when executionId is null", () => {
      const { result } = renderHook(() => useDunningExecution(null), {
        wrapper: createQueryWrapper(queryClient),
      });

      expect(result.current.data).toBeUndefined();
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("useStartDunningExecution", () => {
    it("should start execution successfully", async () => {
      const { result } = renderHook(() => useStartDunningExecution(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync({
          campaign_id: "campaign-1",
          subscription_id: "sub-123",
        });
      });

      expect(result.current.data?.campaign_id).toBe("campaign-1");
      expect(result.current.error).toBeNull();
    });
  });

  describe("useCancelDunningExecution", () => {
    it("should cancel execution successfully", async () => {
      const execution = createMockDunningExecution({
        id: "exec-1",
        status: "active",
      });
      seedDunningData([], [execution]);

      const { result } = renderHook(() => useCancelDunningExecution(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await act(async () => {
        await result.current.mutateAsync({
          executionId: "exec-1",
          reason: "Customer paid",
        });
      });

      expect(result.current.data?.status).toBe("cancelled");
      expect(result.current.data?.cancellation_reason).toBe("Customer paid");
    });
  });

  describe("useDunningStatistics", () => {
    it("should fetch statistics successfully", async () => {
      const campaigns = [
        createMockDunningCampaign({ status: "active" }),
        createMockDunningCampaign({ status: "paused" }),
      ];
      const executions = [
        createMockDunningExecution({ status: "active" }),
        createMockDunningExecution({ status: "completed" }),
      ];
      seedDunningData(campaigns, executions);

      const { result } = renderHook(() => useDunningStatistics(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.total_campaigns).toBe(2);
      expect(result.current.data?.active_campaigns).toBe(1);
      expect(result.current.data?.total_executions).toBe(2);
    });
  });

  describe("useDunningCampaignStatistics", () => {
    it("should fetch campaign statistics successfully", async () => {
      const campaign = createMockDunningCampaign({ id: "campaign-1" });
      const executions = [
        createMockDunningExecution({
          campaign_id: "campaign-1",
          status: "active",
        }),
        createMockDunningExecution({
          campaign_id: "campaign-1",
          status: "completed",
        }),
      ];
      seedDunningData([campaign], executions);

      const { result } = renderHook(
        () => useDunningCampaignStatistics("campaign-1"),
        {
          wrapper: createQueryWrapper(queryClient),
        }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.campaign_id).toBe("campaign-1");
      expect(result.current.data?.total_executions).toBe(2);
    });

    it("should not fetch when campaignId is null", () => {
      const { result } = renderHook(
        () => useDunningCampaignStatistics(null),
        {
          wrapper: createQueryWrapper(queryClient),
        }
      );

      expect(result.current.data).toBeUndefined();
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("useDunningRecoveryChart", () => {
    it("should fetch recovery chart data successfully", async () => {
      seedDunningData([], []);

      const { result } = renderHook(() => useDunningRecoveryChart(30), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
      expect(Array.isArray(result.current.data)).toBe(true);
      expect(result.current.data?.length).toBe(30);
    });

    it("should default to 30 days", async () => {
      seedDunningData([], []);

      const { result } = renderHook(() => useDunningRecoveryChart(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.length).toBe(30);
    });
  });

  describe("useDunningOperations - combined operations", () => {
    it("should provide all operation functions", () => {
      const { result } = renderHook(() => useDunningOperations(), {
        wrapper: createQueryWrapper(queryClient),
      });

      expect(result.current.pauseCampaign).toBeDefined();
      expect(result.current.resumeCampaign).toBeDefined();
      expect(result.current.cancelExecution).toBeDefined();
      expect(typeof result.current.pauseCampaign).toBe("function");
    });

    it("should track loading state across operations", async () => {
      const campaign = createMockDunningCampaign({
        id: "campaign-1",
        status: "active",
      });
      seedDunningData([campaign], []);

      const { result } = renderHook(() => useDunningOperations(), {
        wrapper: createQueryWrapper(queryClient),
      });

      expect(result.current.isLoading).toBe(false);

      await act(async () => {
        await result.current.pauseCampaign("campaign-1");
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle campaign lifecycle (create, pause, resume, delete)", async () => {
      const createHook = renderHook(() => useCreateDunningCampaign(), {
        wrapper: createQueryWrapper(queryClient),
      });
      const pauseHook = renderHook(() => usePauseDunningCampaign(), {
        wrapper: createQueryWrapper(queryClient),
      });
      const resumeHook = renderHook(() => useResumeDunningCampaign(), {
        wrapper: createQueryWrapper(queryClient),
      });
      const deleteHook = renderHook(() => useDeleteDunningCampaign(), {
        wrapper: createQueryWrapper(queryClient),
      });

      // Create
      let campaignId: string;
      await act(async () => {
        const result = await createHook.result.current.mutateAsync({
          name: "Lifecycle Test",
          stages: [],
        });
        campaignId = result.id;
      });

      expect(createHook.result.current.data?.status).toBe("active");

      // Pause
      await act(async () => {
        await pauseHook.result.current.mutateAsync(campaignId);
      });

      expect(pauseHook.result.current.data?.status).toBe("paused");

      // Resume
      await act(async () => {
        await resumeHook.result.current.mutateAsync(campaignId);
      });

      expect(resumeHook.result.current.data?.status).toBe("active");

      // Delete
      await act(async () => {
        await deleteHook.result.current.mutateAsync(campaignId);
      });

      expect(deleteHook.result.current.error).toBeNull();
    });
  });
});
