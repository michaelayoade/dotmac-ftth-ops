/**
 * Platform Admin App - useScheduler tests
 *
 * Focuses on the highest-risk TanStack hooks by validating:
 * - Successful fetches and mutation flows
 * - Error handling shortcuts (404 fallbacks, disabled queries)
 * - Cache invalidation side effects
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  useScheduledJobs,
  useJobChains,
  useExecuteJobChain,
  useScheduledJob,
  useCreateScheduledJob,
  useUpdateScheduledJob,
  useToggleScheduledJob,
  useDeleteScheduledJob,
  useJobChain,
  useCreateJobChain,
} from "../useScheduler";
import { apiClient } from "@/lib/api/client";
import { extractDataOrThrow } from "@/lib/api/response-helpers";

jest.unmock("@tanstack/react-query");

jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("@/lib/api/response-helpers", () => ({
  extractDataOrThrow: jest.fn((response) => response.data),
}));

const mockedExtractDataOrThrow = extractDataOrThrow as jest.Mock;

describe("Platform Admin useScheduler hooks", () => {
  const createWrapper = (client?: QueryClient) => {
    const queryClient =
      client ??
      new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("useScheduledJobs", () => {
    it("fetches scheduled jobs successfully", async () => {
      const mockJobs = [
        {
          id: "sched-1",
          job_name: "Daily backup",
          cron_expression: "0 2 * * *",
        },
      ];
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockJobs });

      const { result } = renderHook(() => useScheduledJobs(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockJobs);
      expect(apiClient.get).toHaveBeenCalledWith("/jobs/scheduler/scheduled-jobs");
      expect(mockedExtractDataOrThrow).toHaveBeenCalled();
    });
  });

  describe("useJobChains", () => {
    it("returns job chains", async () => {
      const mockChains = [{ id: "chain-1", name: "Customer Provisioning" }];
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockChains });

      const { result } = renderHook(() => useJobChains(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockChains);
      expect(apiClient.get).toHaveBeenCalledWith("/jobs/scheduler/chains");
    });

    it("falls back to empty list on 404", async () => {
      (apiClient.get as jest.Mock).mockRejectedValue({ response: { status: 404 } });

      const { result } = renderHook(() => useJobChains(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual([]);
      expect(mockedExtractDataOrThrow).not.toHaveBeenCalled();
    });
  });

  describe("useExecuteJobChain", () => {
    it("executes and invalidates relevant queries", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: { id: "chain-1" } });
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      const wrapper = createWrapper(queryClient);
      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useExecuteJobChain(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({ chainId: "chain-1" });
      });

      expect(apiClient.post).toHaveBeenCalledWith("/jobs/scheduler/chains/chain-1/execute");
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["scheduler", "job-chains"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["services", "instances"] });
    });
  });

  describe("useScheduledJob", () => {
    it("fetches a job by id", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: { id: "sched-99" } });
      const { result } = renderHook(() => useScheduledJob("sched-99"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual({ id: "sched-99" });
      expect(apiClient.get).toHaveBeenCalledWith("/jobs/scheduler/scheduled-jobs/sched-99");
    });

    it("does not fetch when id is missing", async () => {
      renderHook(() => useScheduledJob(null), { wrapper: createWrapper() });

      expect(apiClient.get).not.toHaveBeenCalled();
    });
  });

  describe("mutations", () => {
    it("creates scheduled jobs and invalidates cache", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: { id: "sched-2" } });
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      const wrapper = createWrapper(queryClient);
      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useCreateScheduledJob(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({ job_name: "Daily", schedule_type: "cron" } as any);
      });

      expect(apiClient.post).toHaveBeenCalledWith("/jobs/scheduler/scheduled-jobs", {
        job_name: "Daily",
        schedule_type: "cron",
      });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["scheduler", "scheduled-jobs"] });
    });

    it("updates scheduled jobs and invalidates job level caches", async () => {
      (apiClient.patch as jest.Mock).mockResolvedValue({ data: { id: "sched-1" } });
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      const wrapper = createWrapper(queryClient);
      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useUpdateScheduledJob(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          jobId: "sched-1",
          payload: { job_name: "Updated" } as any,
        });
      });

      expect(apiClient.patch).toHaveBeenCalledWith("/jobs/scheduler/scheduled-jobs/sched-1", {
        job_name: "Updated",
      });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["scheduler", "scheduled-jobs"] });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["scheduler", "scheduled-job", "sched-1"],
      });
    });

    it("toggles scheduled jobs and invalidates caches", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: { id: "sched-1" } });
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      const wrapper = createWrapper(queryClient);
      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useToggleScheduledJob(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync("sched-1");
      });

      expect(apiClient.post).toHaveBeenCalledWith("/jobs/scheduler/scheduled-jobs/sched-1/toggle");
      expect(invalidateSpy).toHaveBeenNthCalledWith(1, { queryKey: ["scheduler", "scheduled-jobs"] });
      expect(invalidateSpy).toHaveBeenNthCalledWith(2, {
        queryKey: ["scheduler", "scheduled-job", "sched-1"],
      });
    });

    it("deletes scheduled jobs and invalidates list", async () => {
      (apiClient.delete as jest.Mock).mockResolvedValue({});
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      const wrapper = createWrapper(queryClient);
      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useDeleteScheduledJob(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync("sched-1");
      });

      expect(apiClient.delete).toHaveBeenCalledWith("/jobs/scheduler/scheduled-jobs/sched-1");
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["scheduler", "scheduled-jobs"] });
    });
  });

  describe("Job chain queries/mutations", () => {
    it("fetches job chain by id", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: { id: "chain-22" } });

      const { result } = renderHook(() => useJobChain("chain-22"), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(apiClient.get).toHaveBeenCalledWith("/jobs/scheduler/chains/chain-22");
      expect(result.current.data).toEqual({ id: "chain-22" });
    });

    it("skips fetch when no chain id", () => {
      renderHook(() => useJobChain(null), { wrapper: createWrapper() });
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it("creates job chains and invalidates chain list", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: { id: "chain-5" } });
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      const wrapper = createWrapper(queryClient);
      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useCreateJobChain(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({ name: "Provisioning" } as any);
      });

      expect(apiClient.post).toHaveBeenCalledWith("/jobs/scheduler/chains", {
        name: "Provisioning",
      });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["scheduler", "job-chains"] });
    });
  });
});
