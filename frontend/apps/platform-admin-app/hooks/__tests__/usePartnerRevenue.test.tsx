/**
 * Platform Admin App - usePartnerRevenue tests
 *
 * Ensures revenue/commission/payout hooks call the service layer and
 * aggregated statistics + calculator helpers behave as expected.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  useRevenueMetrics,
  useCommissionEvents,
  useCommissionEvent,
  usePayouts,
  usePayout,
  useCommissionCalculator,
  useRevenueStatistics,
} from "../usePartnerRevenue";
import { partnerRevenueService } from "@/lib/services/partner-revenue-service";

jest.unmock("@tanstack/react-query");

jest.mock("@/lib/services/partner-revenue-service", () => {
  const service = {
    getRevenueMetrics: jest.fn(),
    listCommissionEvents: jest.fn(),
    getCommissionEvent: jest.fn(),
    listPayouts: jest.fn(),
    getPayout: jest.fn(),
    calculateCommission: jest.fn((base: number, rate: number) => base * rate),
    formatCurrency: jest.fn((amount: number, currency = "USD") => `${currency} ${amount}`),
    calculateConversionRate: jest.fn((earned: number, potential: number) =>
      potential === 0 ? 0 : earned / potential,
    ),
  };
  return { partnerRevenueService: service };
});

const mockedService = partnerRevenueService as jest.Mocked<typeof partnerRevenueService>;

describe("Platform Admin usePartnerRevenue hooks", () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    return { wrapper };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fetches revenue metrics with filters", async () => {
    mockedService.getRevenueMetrics.mockResolvedValue({
      total_commissions: 1000,
    } as any);

    const { wrapper } = createWrapper();
    const filters = { period_start: "2024-01-01" };
    const { result } = renderHook(() => useRevenueMetrics(filters), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedService.getRevenueMetrics).toHaveBeenCalledWith(filters);
    expect(result.current.data?.total_commissions).toBe(1000);
  });

  it("fetches commission events and single event", async () => {
    mockedService.listCommissionEvents.mockResolvedValue([{ id: "comm-1" }] as any);
    mockedService.getCommissionEvent.mockResolvedValue({ id: "comm-1" } as any);

    const { wrapper } = createWrapper();
    const { result: listResult } = renderHook(() => useCommissionEvents({ status: "pending" }), {
      wrapper,
    });

    await waitFor(() => expect(listResult.current.isSuccess).toBe(true));
    expect(mockedService.listCommissionEvents).toHaveBeenCalledWith({ status: "pending" });

    const { result: detailResult } = renderHook(() => useCommissionEvent("comm-1"), { wrapper });
    await waitFor(() => expect(detailResult.current.isSuccess).toBe(true));
    expect(mockedService.getCommissionEvent).toHaveBeenCalledWith("comm-1");
  });

  it("fetches payouts and payout detail respecting enabled flag", async () => {
    mockedService.listPayouts.mockResolvedValue([{ id: "payout-1", status: "completed" }] as any);
    mockedService.getPayout.mockResolvedValue({ id: "payout-1" } as any);

    const { wrapper } = createWrapper();
    const { result: payoutsResult } = renderHook(() => usePayouts({ status: "completed" }), {
      wrapper,
    });

    await waitFor(() => expect(payoutsResult.current.isSuccess).toBe(true));
    expect(mockedService.listPayouts).toHaveBeenCalledWith({ status: "completed" });

    renderHook(() => usePayout(null), { wrapper });
    expect(mockedService.getPayout).not.toHaveBeenCalled();

    const { result: payoutDetail } = renderHook(() => usePayout("payout-1"), { wrapper });
    await waitFor(() => expect(payoutDetail.current.isSuccess).toBe(true));
    expect(mockedService.getPayout).toHaveBeenCalledWith("payout-1");
  });

  it("delegates commission calculator helpers", () => {
    const { result } = renderHook(() => useCommissionCalculator());

    expect(result.current.calculateCommission(100, 0.1)).toBe(10);
    expect(result.current.formatCurrency(1000, "USD")).toBe("USD 1000");
    expect(result.current.calculateConversionRate(50, 100)).toBe(0.5);
  });

  it("computes revenue statistics from underlying hooks", async () => {
    mockedService.getRevenueMetrics.mockResolvedValue({
      total_commissions: 1200,
      total_payouts: 800,
      pending_amount: 200,
      total_commission_count: 6,
    } as any);
    mockedService.listCommissionEvents.mockResolvedValue([
      { id: "comm1", status: "approved", commission_amount: 300 },
      { id: "comm2", status: "pending", commission_amount: 200 },
      { id: "comm3", status: "paid", commission_amount: 400 },
    ] as any);
    mockedService.listPayouts.mockResolvedValue([
      { id: "payout1", status: "completed", total_amount: 500 },
      { id: "payout2", status: "pending", total_amount: 150 },
      { id: "payout3", status: "processing", total_amount: 200 },
    ] as any);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useRevenueStatistics({ period_start: "2024-01-01" }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.statistics.totalCommissions).toBe(1200));
    expect(result.current.statistics.approvedCommissions).toBe(300);
    expect(result.current.statistics.pendingCommissions).toBe(200);
    expect(result.current.statistics.paidCommissions).toBe(400);
    expect(result.current.statistics.completedPayouts).toBe(500);
    expect(result.current.statistics.pendingPayouts).toBe(150);
    expect(result.current.statistics.processingPayouts).toBe(200);
    expect(result.current.statistics.totalPayoutsCount).toBe(3);
  });
});
