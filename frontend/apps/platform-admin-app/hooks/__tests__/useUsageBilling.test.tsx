/**
 * Platform Admin App - useUsageBilling tests
 *
 * Ensures queries/mutations for usage billing hook into the service layer and manage cache properly.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  useUsageRecords,
  useUsageRecord,
  useUsageAggregates,
  useUsageStatistics,
  useUsageChartData,
  useCreateUsageRecord,
  useCreateUsageRecordsBulk,
  useUpdateUsageRecord,
  useDeleteUsageRecord,
  useMarkUsageRecordsAsBilled,
  useExcludeUsageRecordsFromBilling,
  useUsageOperations,
  usageKeys,
} from "../useUsageBilling";
import { usageBillingService } from "@/lib/services/usage-billing-service";
import { logger } from "@/lib/logger";

jest.unmock("@tanstack/react-query");

jest.mock("@/lib/services/usage-billing-service", () => {
  const service = {
    listUsageRecords: jest.fn(),
    getUsageRecord: jest.fn(),
    createUsageRecord: jest.fn(),
    createUsageRecordsBulk: jest.fn(),
    updateUsageRecord: jest.fn(),
    deleteUsageRecord: jest.fn(),
    markUsageRecordsAsBilled: jest.fn(),
    excludeUsageRecordsFromBilling: jest.fn(),
    listUsageAggregates: jest.fn(),
    getUsageStatistics: jest.fn(),
    getUsageChartData: jest.fn(),
  };
  return { usageBillingService: service };
});

jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
  },
}));

const mockedService = usageBillingService as jest.Mocked<typeof usageBillingService>;
const mockedLogger = logger as jest.Mocked<typeof logger>;

describe("Platform Admin useUsageBilling hooks", () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    return { wrapper, queryClient };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("query hooks", () => {
    it("fetches usage records with filters", async () => {
      mockedService.listUsageRecords.mockResolvedValue([{ id: "rec-1" }] as any);

      const { wrapper } = createWrapper();
      const filters = { customer_id: "cust-1" };

      const { result } = renderHook(() => useUsageRecords(filters), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockedService.listUsageRecords).toHaveBeenCalledWith(filters);
      expect(result.current.data?.[0].id).toBe("rec-1");
    });

    it("fetches single usage record when id is provided", async () => {
      mockedService.getUsageRecord.mockResolvedValue({ id: "rec-99" } as any);

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUsageRecord("rec-99"), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockedService.getUsageRecord).toHaveBeenCalledWith("rec-99");
      expect(result.current.data?.id).toBe("rec-99");
    });

    it("fetches aggregates, statistics, and chart data", async () => {
      mockedService.listUsageAggregates.mockResolvedValue([{ id: "agg-1" }] as any);
      mockedService.getUsageStatistics.mockResolvedValue({ total_records: 5 } as any);
      mockedService.getUsageChartData.mockResolvedValue([{ date: "2024-01-01" }] as any);

      const { wrapper } = createWrapper();

      const aggregates = renderHook(() => useUsageAggregates({ usage_type: "data_transfer" }), {
        wrapper,
      });
      await waitFor(() => expect(aggregates.result.current.isSuccess).toBe(true));
      expect(mockedService.listUsageAggregates).toHaveBeenCalledWith({
        usage_type: "data_transfer",
      });

      const stats = renderHook(() => useUsageStatistics("2024-01-01", "2024-01-31"), { wrapper });
      await waitFor(() => expect(stats.result.current.isSuccess).toBe(true));
      expect(mockedService.getUsageStatistics).toHaveBeenCalledWith("2024-01-01", "2024-01-31");

      const chart = renderHook(() => useUsageChartData({ period_type: "daily", days: 7 } as any), {
        wrapper,
      });
      await waitFor(() => expect(chart.result.current.isSuccess).toBe(true));
      expect(mockedService.getUsageChartData).toHaveBeenCalledWith({
        period_type: "daily",
        days: 7,
      });
    });
  });

  describe("mutation hooks", () => {
    it("creates usage records and invalidates caches", async () => {
      mockedService.createUsageRecord.mockResolvedValue({ id: "rec-1" } as any);
      const onSuccess = jest.fn();

      const { wrapper, queryClient } = createWrapper();
      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(
        () =>
          useCreateUsageRecord({
            onSuccess,
          }),
        { wrapper },
      );

      await act(async () => {
        await result.current.mutateAsync({
          subscription_id: "sub-1",
          usage_type: "data_transfer",
        } as any);
      });

      expect(mockedService.createUsageRecord).toHaveBeenCalled();
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: usageKeys.records() });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: usageKeys.statistics() });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: usageKeys.aggregates() });
      expect(onSuccess).toHaveBeenCalledWith({ id: "rec-1" });
    });

    it("creates usage records in bulk and invalidates caches", async () => {
      mockedService.createUsageRecordsBulk.mockResolvedValue([{ id: "rec-1" }] as any);

      const { wrapper, queryClient } = createWrapper();
      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useCreateUsageRecordsBulk(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync([
          { subscription_id: "sub-1", usage_type: "data_transfer" } as any,
        ]);
      });

      expect(mockedService.createUsageRecordsBulk).toHaveBeenCalled();
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: usageKeys.records() });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: usageKeys.statistics() });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: usageKeys.aggregates() });
    });

    it("updates usage record and invalidates detail queries", async () => {
      mockedService.updateUsageRecord.mockResolvedValue({ id: "rec-10" } as any);
      const { wrapper, queryClient } = createWrapper();
      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useUpdateUsageRecord(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          recordId: "rec-10",
          data: { quantity: 5 },
        });
      });

      expect(mockedService.updateUsageRecord).toHaveBeenCalledWith("rec-10", { quantity: 5 });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: usageKeys.records() });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: usageKeys.recordDetail("rec-10"),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: usageKeys.statistics() });
    });

    it("deletes usage record and invalidates caches", async () => {
      const { wrapper, queryClient } = createWrapper();
      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");
      const onSuccess = jest.fn();

      const { result } = renderHook(() => useDeleteUsageRecord({ onSuccess }), { wrapper });

      await act(async () => {
        await result.current.mutateAsync("rec-2");
      });

      expect(mockedService.deleteUsageRecord).toHaveBeenCalledWith("rec-2");
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: usageKeys.records() });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: usageKeys.statistics() });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: usageKeys.aggregates() });
      expect(onSuccess).toHaveBeenCalled();
    });

    it("marks usage records as billed and invalidates caches", async () => {
      const { wrapper, queryClient } = createWrapper();
      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useMarkUsageRecordsAsBilled(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({ recordIds: ["rec-1"], invoiceId: "inv-1" });
      });

      expect(mockedService.markUsageRecordsAsBilled).toHaveBeenCalledWith(["rec-1"], "inv-1");
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: usageKeys.records() });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: usageKeys.statistics() });
    });

    it("excludes usage records from billing and invalidates caches", async () => {
      const { wrapper, queryClient } = createWrapper();
      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useExcludeUsageRecordsFromBilling(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync(["rec-1", "rec-2"]);
      });

      expect(mockedService.excludeUsageRecordsFromBilling).toHaveBeenCalledWith(["rec-1", "rec-2"]);
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: usageKeys.records() });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: usageKeys.statistics() });
    });
  });

  describe("useUsageOperations", () => {
    it("wraps billing operations and returns success on happy path", async () => {
      mockedService.markUsageRecordsAsBilled.mockResolvedValue(undefined as any);
      mockedService.excludeUsageRecordsFromBilling.mockResolvedValue(undefined as any);

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUsageOperations(), { wrapper });

      await expect(result.current.markAsBilled(["rec-1"], "inv-1")).resolves.toBe(true);
      await expect(result.current.excludeFromBilling(["rec-2"])).resolves.toBe(true);
      expect(result.current.isLoading).toBe(false);
    });

    it("logs errors when billing operations fail", async () => {
      const error = new Error("fail");
      mockedService.markUsageRecordsAsBilled.mockRejectedValue(error);

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useUsageOperations(), { wrapper });

      await expect(result.current.markAsBilled(["rec-1"], "inv-1")).resolves.toBe(false);
      expect(mockedLogger.error).toHaveBeenCalledWith(
        "Failed to mark usage records as billed",
        error,
        { invoiceId: "inv-1", recordCount: 1 },
      );
    });
  });
});
