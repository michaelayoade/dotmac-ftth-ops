/**
 * Jest tests for useScheduler
 *
 * Tests the actual hook contracts: useScheduledJobs, useJobChains, useExecuteJobChain, etc.
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import {
  useScheduledJobs,
  useJobChains,
  useScheduledJob,
  useCreateScheduledJob,
  useUpdateScheduledJob,
  useToggleScheduledJob,
  useDeleteScheduledJob,
  useJobChain,
  useCreateJobChain,
  useExecuteJobChain,
} from "../useScheduler";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { apiClient } from "@/lib/api/client";
import type { ScheduledJob, JobChain } from "@/types";

// Mock apiClient
jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe("useScheduler (Jest)", () => {
  // Helper to create wrapper with QueryClient
  const createWrapper = (queryClient?: QueryClient) => {
    const client =
      queryClient ||
      new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe("useScheduledJobs", () => {
    it("should fetch scheduled jobs successfully", async () => {
      const mockJobs: ScheduledJob[] = [
        {
          id: "job-1",
          name: "Daily Backup",
          job_type: "backup",
          cron_expression: "0 0 * * *",
          interval_seconds: null,
          is_active: true,
          priority: "normal",
          total_runs: 0,
          successful_runs: 0,
          failed_runs: 0,
          next_run_at: null,
          last_run_at: null,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
        {
          id: "job-2",
          name: "Hourly Sync",
          job_type: "sync",
          cron_expression: "0 * * * *",
          interval_seconds: null,
          is_active: true,
          priority: "normal",
          total_runs: 0,
          successful_runs: 0,
          failed_runs: 0,
          next_run_at: null,
          last_run_at: null,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      mockApiClient.get.mockResolvedValue({ data: mockJobs, status: 200 });

      const { result } = renderHook(() => useScheduledJobs(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].id).toBe("job-1");
      expect(result.current.data?.[0].name).toBe("Daily Backup");
      expect(result.current.error).toBeNull();
    });

    it("should handle empty scheduled jobs list", async () => {
      mockApiClient.get.mockResolvedValue({ data: [], status: 200 });

      const { result } = renderHook(() => useScheduledJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(0);
      expect(result.current.error).toBeNull();
    });

    it("should include scheduling details", async () => {
      const nextRun = new Date(Date.now() + 86400000).toISOString();
      const mockJobs: ScheduledJob[] = [
        {
          id: "job-1",
          name: "Daily Job",
          job_type: "backup",
          cron_expression: "0 0 * * *",
          interval_seconds: null,
          next_run_at: nextRun,
          is_active: true,
          priority: "normal",
          total_runs: 0,
          successful_runs: 0,
          failed_runs: 0,
          last_run_at: null,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      mockApiClient.get.mockResolvedValue({ data: mockJobs, status: 200 });

      const { result } = renderHook(() => useScheduledJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.[0].cron_expression).toBe("0 0 * * *");
      expect(result.current.data?.[0].next_run_at).toBe(nextRun);
    });

    it("should include run statistics", async () => {
      const mockJobs: ScheduledJob[] = [
        {
          id: "job-1",
          name: "Test Job",
          job_type: "test",
          cron_expression: "* * * * *",
          interval_seconds: null,
          total_runs: 100,
          successful_runs: 95,
          failed_runs: 5,
          is_active: true,
          priority: "normal",
          next_run_at: null,
          last_run_at: null,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      mockApiClient.get.mockResolvedValue({ data: mockJobs, status: 200 });

      const { result } = renderHook(() => useScheduledJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.[0].total_runs).toBe(100);
      expect(result.current.data?.[0].successful_runs).toBe(95);
      expect(result.current.data?.[0].failed_runs).toBe(5);
    });

    it("should handle fetch error", async () => {
      mockApiClient.get.mockRejectedValue(new Error("Server error"));

      const { result } = renderHook(() => useScheduledJobs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });
  });

  describe("useScheduledJob", () => {
    it("should fetch single scheduled job", async () => {
      const mockJob: ScheduledJob = {
        id: "job-1",
        name: "Test Job",
        job_type: "test",
        cron_expression: "0 0 * * *",
        interval_seconds: null,
        is_active: true,
        priority: "normal",
        total_runs: 0,
        successful_runs: 0,
        failed_runs: 0,
        next_run_at: null,
        last_run_at: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      mockApiClient.get.mockResolvedValue({ data: mockJob, status: 200 });

      const { result } = renderHook(() => useScheduledJob("job-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.id).toBe("job-1");
      expect(result.current.data?.name).toBe("Test Job");
    });

    it("should not fetch when jobId is null", async () => {
      const { result } = renderHook(() => useScheduledJob(null), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });

    it("should handle job not found", async () => {
      mockApiClient.get.mockRejectedValue(new Error("Not found"));

      const { result } = renderHook(() => useScheduledJob("non-existent"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });
  });

  describe("useCreateScheduledJob", () => {
    it("should create scheduled job successfully", async () => {
      const mockJob: ScheduledJob = {
        id: "job-new",
        name: "New Job",
        job_type: "backup",
        cron_expression: "0 0 * * *",
        interval_seconds: null,
        priority: "normal",
        is_active: true,
        total_runs: 0,
        successful_runs: 0,
        failed_runs: 0,
        next_run_at: null,
        last_run_at: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      mockApiClient.post.mockResolvedValue({ data: mockJob, status: 201 });

      const { result } = renderHook(() => useCreateScheduledJob(), {
        wrapper: createWrapper(),
      });

      let createdJob;
      await act(async () => {
        createdJob = await result.current.mutateAsync({
          name: "New Job",
          job_type: "backup",
          cron_expression: "0 0 * * *",
          priority: "normal",
        });
      });

      expect(createdJob).toBeDefined();
      expect((createdJob as any).name).toBe("New Job");
      expect((createdJob as any).job_type).toBe("backup");
    });

    it("should create job with interval instead of cron", async () => {
      const mockJob: ScheduledJob = {
        id: "job-interval",
        name: "Interval Job",
        job_type: "sync",
        cron_expression: null,
        interval_seconds: 3600,
        priority: "high",
        is_active: true,
        total_runs: 0,
        successful_runs: 0,
        failed_runs: 0,
        next_run_at: null,
        last_run_at: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      mockApiClient.post.mockResolvedValue({ data: mockJob, status: 201 });

      const { result } = renderHook(() => useCreateScheduledJob(), {
        wrapper: createWrapper(),
      });

      let createdJob;
      await act(async () => {
        createdJob = await result.current.mutateAsync({
          name: "Interval Job",
          job_type: "sync",
          interval_seconds: 3600,
          priority: "high",
        });
      });

      expect((createdJob as any).interval_seconds).toBe(3600);
    });
  });

  describe("useUpdateScheduledJob", () => {
    it("should update scheduled job successfully", async () => {
      const mockJob: ScheduledJob = {
        id: "job-1",
        name: "New Name",
        job_type: "backup",
        cron_expression: "0 0 * * *",
        interval_seconds: null,
        priority: "normal",
        is_active: true,
        total_runs: 0,
        successful_runs: 0,
        failed_runs: 0,
        next_run_at: null,
        last_run_at: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      mockApiClient.patch.mockResolvedValue({ data: mockJob, status: 200 });

      const { result } = renderHook(() => useUpdateScheduledJob(), {
        wrapper: createWrapper(),
      });

      let updatedJob;
      await act(async () => {
        updatedJob = await result.current.mutateAsync({
          jobId: "job-1",
          payload: { name: "New Name" },
        });
      });

      expect((updatedJob as any).name).toBe("New Name");
    });

    it("should handle job not found", async () => {
      mockApiClient.patch.mockRejectedValue(new Error("Not found"));

      const { result } = renderHook(() => useUpdateScheduledJob(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            jobId: "non-existent",
            payload: { name: "New Name" },
          });
        } catch (error) {
          expect(error).toBeDefined();
        }
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useToggleScheduledJob", () => {
    it("should toggle job from active to inactive", async () => {
      const mockJob: ScheduledJob = {
        id: "job-1",
        name: "Test Job",
        job_type: "test",
        cron_expression: "0 0 * * *",
        interval_seconds: null,
        is_active: false,
        priority: "normal",
        total_runs: 0,
        successful_runs: 0,
        failed_runs: 0,
        next_run_at: null,
        last_run_at: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      mockApiClient.post.mockResolvedValue({ data: mockJob, status: 200 });

      const { result } = renderHook(() => useToggleScheduledJob(), {
        wrapper: createWrapper(),
      });

      let toggledJob;
      await act(async () => {
        toggledJob = await result.current.mutateAsync("job-1");
      });

      expect((toggledJob as any).is_active).toBe(false);
    });

    it("should toggle job from inactive to active", async () => {
      const mockJob: ScheduledJob = {
        id: "job-1",
        name: "Test Job",
        job_type: "test",
        cron_expression: "0 0 * * *",
        interval_seconds: null,
        is_active: true,
        priority: "normal",
        total_runs: 0,
        successful_runs: 0,
        failed_runs: 0,
        next_run_at: null,
        last_run_at: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      mockApiClient.post.mockResolvedValue({ data: mockJob, status: 200 });

      const { result } = renderHook(() => useToggleScheduledJob(), {
        wrapper: createWrapper(),
      });

      let toggledJob;
      await act(async () => {
        toggledJob = await result.current.mutateAsync("job-1");
      });

      expect((toggledJob as any).is_active).toBe(true);
    });
  });

  describe("useDeleteScheduledJob", () => {
    it("should delete scheduled job successfully", async () => {
      mockApiClient.delete.mockResolvedValue({ data: null, status: 204 });

      const { result } = renderHook(() => useDeleteScheduledJob(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync("job-1");
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it("should handle job not found", async () => {
      mockApiClient.delete.mockRejectedValue(new Error("Not found"));

      const { result } = renderHook(() => useDeleteScheduledJob(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync("non-existent");
        } catch (error) {
          expect(error).toBeDefined();
        }
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useJobChains", () => {
    it("should fetch job chains successfully", async () => {
      const mockChains: JobChain[] = [
        {
          id: "chain-1",
          name: "Test Chain 1",
          chain_definition: [],
          total_steps: 0,
          execution_mode: "sequential",
          status: "idle",
          current_step: 0,
          stop_on_failure: true,
          timeout_seconds: null,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
        {
          id: "chain-2",
          name: "Test Chain 2",
          chain_definition: [],
          total_steps: 0,
          execution_mode: "sequential",
          status: "idle",
          current_step: 0,
          stop_on_failure: true,
          timeout_seconds: null,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      mockApiClient.get.mockResolvedValue({ data: mockChains, status: 200 });

      const { result } = renderHook(() => useJobChains(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].id).toBe("chain-1");
      expect(result.current.data?.[0].name).toBe("Test Chain 1");
      expect(result.current.error).toBeNull();
    });

    it("should handle empty job chains list", async () => {
      mockApiClient.get.mockResolvedValue({ data: [], status: 200 });

      const { result } = renderHook(() => useJobChains(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(0);
      expect(result.current.error).toBeNull();
    });

    it("should handle 404 as empty array", async () => {
      mockApiClient.get.mockRejectedValue({
        response: { status: 404 },
      });

      const { result } = renderHook(() => useJobChains(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it("should include chain definition", async () => {
      const mockChains: JobChain[] = [
        {
          id: "chain-1",
          name: "Complex Chain",
          chain_definition: [
            { job_type: "step1", parameters: { key: "value1" } },
            { job_type: "step2", parameters: { key: "value2" } },
          ],
          total_steps: 2,
          execution_mode: "sequential",
          status: "idle",
          current_step: 0,
          stop_on_failure: true,
          timeout_seconds: null,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      mockApiClient.get.mockResolvedValue({ data: mockChains, status: 200 });

      const { result } = renderHook(() => useJobChains(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.[0].chain_definition).toHaveLength(2);
      expect(result.current.data?.[0].total_steps).toBe(2);
    });

    it("should include execution mode", async () => {
      const mockChains: JobChain[] = [
        {
          id: "chain-1",
          name: "Sequential Chain",
          chain_definition: [],
          total_steps: 0,
          execution_mode: "sequential",
          status: "idle",
          current_step: 0,
          stop_on_failure: true,
          timeout_seconds: null,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
        {
          id: "chain-2",
          name: "Parallel Chain",
          chain_definition: [],
          total_steps: 0,
          execution_mode: "parallel",
          status: "idle",
          current_step: 0,
          stop_on_failure: true,
          timeout_seconds: null,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      mockApiClient.get.mockResolvedValue({ data: mockChains, status: 200 });

      const { result } = renderHook(() => useJobChains(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.[0].execution_mode).toBe("sequential");
      expect(result.current.data?.[1].execution_mode).toBe("parallel");
    });
  });

  describe("useJobChain", () => {
    it("should fetch single job chain", async () => {
      const mockChain: JobChain = {
        id: "chain-1",
        name: "Test Chain",
        chain_definition: [],
        total_steps: 0,
        execution_mode: "sequential",
        status: "idle",
        current_step: 0,
        stop_on_failure: true,
        timeout_seconds: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      mockApiClient.get.mockResolvedValue({ data: mockChain, status: 200 });

      const { result } = renderHook(() => useJobChain("chain-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.id).toBe("chain-1");
      expect(result.current.data?.name).toBe("Test Chain");
    });

    it("should not fetch when chainId is null", async () => {
      const { result } = renderHook(() => useJobChain(null), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });
  });

  describe("useCreateJobChain", () => {
    it("should create job chain successfully", async () => {
      const mockChain: JobChain = {
        id: "chain-new",
        name: "New Chain",
        chain_definition: [
          { job_type: "step1", parameters: {} },
          { job_type: "step2", parameters: {} },
        ],
        total_steps: 2,
        execution_mode: "sequential",
        status: "idle",
        current_step: 0,
        stop_on_failure: true,
        timeout_seconds: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      mockApiClient.post.mockResolvedValue({ data: mockChain, status: 201 });

      const { result } = renderHook(() => useCreateJobChain(), {
        wrapper: createWrapper(),
      });

      let createdChain;
      await act(async () => {
        createdChain = await result.current.mutateAsync({
          name: "New Chain",
          chain_definition: [
            { job_type: "step1", parameters: {} },
            { job_type: "step2", parameters: {} },
          ],
          execution_mode: "sequential",
          stop_on_failure: true,
        });
      });

      expect(createdChain).toBeDefined();
      expect((createdChain as any).name).toBe("New Chain");
      expect((createdChain as any).total_steps).toBe(2);
    });

    it("should create chain with parallel execution", async () => {
      const mockChain: JobChain = {
        id: "chain-parallel",
        name: "Parallel Chain",
        chain_definition: [
          { job_type: "step1", parameters: {} },
          { job_type: "step2", parameters: {} },
        ],
        total_steps: 2,
        execution_mode: "parallel",
        status: "idle",
        current_step: 0,
        stop_on_failure: true,
        timeout_seconds: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      mockApiClient.post.mockResolvedValue({ data: mockChain, status: 201 });

      const { result } = renderHook(() => useCreateJobChain(), {
        wrapper: createWrapper(),
      });

      let createdChain;
      await act(async () => {
        createdChain = await result.current.mutateAsync({
          name: "Parallel Chain",
          chain_definition: [
            { job_type: "step1", parameters: {} },
            { job_type: "step2", parameters: {} },
          ],
          execution_mode: "parallel",
        });
      });

      expect((createdChain as any).execution_mode).toBe("parallel");
    });
  });

  describe("useExecuteJobChain", () => {
    it("should execute job chain successfully", async () => {
      const mockChain: JobChain = {
        id: "chain-1",
        name: "Test Chain",
        chain_definition: [],
        total_steps: 3,
        execution_mode: "sequential",
        status: "running",
        current_step: 1,
        stop_on_failure: true,
        timeout_seconds: null,
        started_at: "2024-01-01T00:00:00Z",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      mockApiClient.post.mockResolvedValue({ data: mockChain, status: 200 });

      const { result } = renderHook(() => useExecuteJobChain(), {
        wrapper: createWrapper(),
      });

      let executedChain;
      await act(async () => {
        executedChain = await result.current.mutateAsync({ chainId: "chain-1" });
      });

      expect(executedChain).toBeDefined();
      expect((executedChain as any).status).toBe("running");
      expect((executedChain as any).started_at).toBeDefined();
    });

    it("should handle chain not found", async () => {
      mockApiClient.post.mockRejectedValue(new Error("Not found"));

      const { result } = renderHook(() => useExecuteJobChain(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({ chainId: "non-existent" });
        } catch (error) {
          expect(error).toBeDefined();
        }
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle mixed scheduled jobs and chains", async () => {
      const mockJobs: ScheduledJob[] = [
        {
          id: "job-1",
          name: "Daily Backup",
          job_type: "backup",
          cron_expression: "0 0 * * *",
          interval_seconds: null,
          is_active: true,
          priority: "normal",
          total_runs: 0,
          successful_runs: 0,
          failed_runs: 0,
          next_run_at: null,
          last_run_at: null,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
        {
          id: "job-2",
          name: "Hourly Sync",
          job_type: "sync",
          cron_expression: "0 * * * *",
          interval_seconds: null,
          is_active: true,
          priority: "normal",
          total_runs: 0,
          successful_runs: 0,
          failed_runs: 0,
          next_run_at: null,
          last_run_at: null,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      const mockChains: JobChain[] = [
        {
          id: "chain-1",
          name: "ETL Pipeline",
          chain_definition: [],
          total_steps: 0,
          execution_mode: "sequential",
          status: "idle",
          current_step: 0,
          stop_on_failure: true,
          timeout_seconds: null,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
        {
          id: "chain-2",
          name: "Report Generation",
          chain_definition: [],
          total_steps: 0,
          execution_mode: "sequential",
          status: "idle",
          current_step: 0,
          stop_on_failure: true,
          timeout_seconds: null,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      mockApiClient.get
        .mockResolvedValueOnce({ data: mockJobs, status: 200 })
        .mockResolvedValueOnce({ data: mockChains, status: 200 });

      const { result: jobsResult } = renderHook(() => useScheduledJobs(), {
        wrapper: createWrapper(),
      });

      const { result: chainsResult } = renderHook(() => useJobChains(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(jobsResult.current.isLoading).toBe(false);
        expect(chainsResult.current.isLoading).toBe(false);
      });

      expect(jobsResult.current.data).toHaveLength(2);
      expect(chainsResult.current.data).toHaveLength(2);
    });

    it("should handle scheduled job lifecycle", async () => {
      const inactiveJob: ScheduledJob = {
        id: "job-1",
        name: "Test Job",
        job_type: "test",
        cron_expression: "0 0 * * *",
        interval_seconds: null,
        is_active: false,
        priority: "normal",
        total_runs: 0,
        successful_runs: 0,
        failed_runs: 0,
        next_run_at: null,
        last_run_at: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      const activeJob: ScheduledJob = {
        ...inactiveJob,
        is_active: true,
      };

      mockApiClient.post
        .mockResolvedValueOnce({ data: inactiveJob, status: 200 })
        .mockResolvedValueOnce({ data: activeJob, status: 200 });

      // Toggle off
      const { result: toggleResult1 } = renderHook(() => useToggleScheduledJob(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await toggleResult1.current.mutateAsync("job-1");
      });

      // Toggle back on
      const { result: toggleResult2 } = renderHook(() => useToggleScheduledJob(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await toggleResult2.current.mutateAsync("job-1");
      });

      await waitFor(() => expect(toggleResult2.current.isSuccess).toBe(true));
    });

    it("should handle job chain execution flow", async () => {
      const runningChain: JobChain = {
        id: "chain-1",
        name: "Test Chain",
        chain_definition: [],
        total_steps: 3,
        execution_mode: "sequential",
        status: "running",
        current_step: 1,
        stop_on_failure: true,
        timeout_seconds: null,
        started_at: "2024-01-01T00:00:00Z",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      mockApiClient.post.mockResolvedValue({ data: runningChain, status: 200 });

      const { result: executeResult } = renderHook(() => useExecuteJobChain(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const chain = await executeResult.current.mutateAsync({ chainId: "chain-1" });
        expect(chain.status).toBe("running");
        expect(chain.current_step).toBe(1);
      });
    });

    it("should handle complex chain definition", async () => {
      const complexChain: JobChain = {
        id: "chain-complex",
        name: "Complex ETL",
        chain_definition: [
          { job_type: "data_extraction", parameters: { source: "database" } },
          { job_type: "data_transformation", parameters: { rules: ["normalize", "dedupe"] } },
          { job_type: "data_loading", parameters: { destination: "warehouse" } },
          { job_type: "notification", parameters: { recipients: ["admin@example.com"] } },
        ],
        total_steps: 4,
        execution_mode: "sequential",
        status: "idle",
        current_step: 0,
        stop_on_failure: true,
        timeout_seconds: 7200,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      mockApiClient.get.mockResolvedValue({ data: [complexChain], status: 200 });

      const { result } = renderHook(() => useJobChains(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const chain = result.current.data?.[0];
      expect(chain?.chain_definition).toHaveLength(4);
      expect(chain?.execution_mode).toBe("sequential");
      expect(chain?.stop_on_failure).toBe(true);
      expect(chain?.timeout_seconds).toBe(7200);
    });
  });
});
