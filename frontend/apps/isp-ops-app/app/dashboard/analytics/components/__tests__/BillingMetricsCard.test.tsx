/**
 * BillingMetricsCard Component Tests
 *
 * Tests billing/revenue metrics dashboard with KPIs, charts, and data formatting
 */

import React from "react";
import { renderQuick, screen } from "@dotmac/testing";
import { BillingMetricsCard } from "../BillingMetricsCard";

// Mock hooks and components
const mockUseBillingMetrics = jest.fn();

jest.mock("@/lib/graphql/hooks", () => ({
  useBillingMetrics: (period: string) => mockUseBillingMetrics(period),
}));

jest.mock("@/components/charts/BarChart", () => ({
  BarChart: ({ data, height, showValues, colorScheme }: any) => (
    <div data-testid="bar-chart">
      <div data-testid="chart-data">{JSON.stringify(data)}</div>
      <div data-testid="chart-color">{colorScheme}</div>
    </div>
  ),
}));

jest.mock("@/components/charts/LineChart", () => ({
  LineChart: ({ data, height, showGrid, showValues, gradient }: any) => (
    <div data-testid="line-chart">
      <div data-testid="chart-data">{JSON.stringify(data)}</div>
    </div>
  ),
}));

jest.mock("@dotmac/ui", () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  CardContent: ({ children, className }: any) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
  CardDescription: ({ children }: any) => <div data-testid="card-description">{children}</div>,
  CardHeader: ({ children, className }: any) => (
    <div data-testid="card-header" className={className}>
      {children}
    </div>
  ),
  CardTitle: ({ children, className }: any) => (
    <div data-testid="card-title" className={className}>
      {children}
    </div>
  ),
  Skeleton: ({ className }: any) => <div data-testid="skeleton" className={className} />,
}));

jest.mock("lucide-react", () => ({
  DollarSign: () => <div data-testid="icon-dollar-sign">DollarSign</div>,
  TrendingUp: () => <div data-testid="icon-trending-up">TrendingUp</div>,
  FileText: () => <div data-testid="icon-file-text">FileText</div>,
  AlertCircle: () => <div data-testid="icon-alert-circle">AlertCircle</div>,
}));

describe("BillingMetricsCard", () => {
  const mockBillingData = {
    mrr: 125000,
    arr: 1500000,
    activeSubscriptions: 1180,
    totalRevenue: 450000,
    totalInvoices: 1250,
    paidInvoices: 1180,
    overdueInvoices: 25,
    outstandingBalance: 45000,
    revenueTimeSeries: [
      { label: "Jan", value: 110000 },
      { label: "Feb", value: 115000 },
      { label: "Mar", value: 120000 },
      { label: "Apr", value: 125000 },
    ],
    subscriptionsTimeSeries: [
      { label: "Jan", value: 1100 },
      { label: "Feb", value: 1150 },
      { label: "Mar", value: 1165 },
      { label: "Apr", value: 1180 },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Loading State", () => {
    it("shows skeleton loaders when loading", () => {
      mockUseBillingMetrics.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      renderQuick(<BillingMetricsCard />);

      const skeletons = screen.getAllByTestId("skeleton");
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("renders 4 skeleton cards during loading", () => {
      mockUseBillingMetrics.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      renderQuick(<BillingMetricsCard />);

      const cards = screen.getAllByTestId("card");
      expect(cards.length).toBe(4);
    });
  });

  describe("Error State", () => {
    it("displays error message when fetch fails", () => {
      mockUseBillingMetrics.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error("API connection failed"),
      });

      renderQuick(<BillingMetricsCard />);

      expect(screen.getByTestId("icon-alert-circle")).toBeInTheDocument();
      expect(
        screen.getByText(/Failed to load billing metrics: API connection failed/),
      ).toBeInTheDocument();
    });
  });

  describe("Null Data Handling", () => {
    it("renders nothing when data is null and not loading", () => {
      mockUseBillingMetrics.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      });

      const { container } = renderQuick(<BillingMetricsCard />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe("Metric Cards Display", () => {
    beforeEach(() => {
      mockUseBillingMetrics.mockReturnValue({
        data: mockBillingData,
        isLoading: false,
        error: null,
      });
    });

    it("displays MRR and ARR metrics", () => {
      renderQuick(<BillingMetricsCard />);

      expect(screen.getByText("Monthly Recurring Revenue")).toBeInTheDocument();
      expect(screen.getByText("$125,000")).toBeInTheDocument();
      expect(screen.getByText(/ARR: \$1,500,000/)).toBeInTheDocument();
    });

    it("displays active subscriptions metric", () => {
      renderQuick(<BillingMetricsCard />);

      expect(screen.getByText("Active Subscriptions")).toBeInTheDocument();
      expect(screen.getByText("1180")).toBeInTheDocument();
      expect(screen.getByText(/Total revenue: \$450,000/)).toBeInTheDocument();
    });

    it("displays invoices metric", () => {
      renderQuick(<BillingMetricsCard />);

      expect(screen.getByText("Invoices")).toBeInTheDocument();
      expect(screen.getByText("1250")).toBeInTheDocument();
      expect(screen.getByText("1180 paid, 25 overdue")).toBeInTheDocument();
    });

    it("displays outstanding balance metric", () => {
      renderQuick(<BillingMetricsCard />);

      expect(screen.getByText("Outstanding Balance")).toBeInTheDocument();
      expect(screen.getByText("$45,000")).toBeInTheDocument();
      expect(screen.getByText("Awaiting payment")).toBeInTheDocument();
    });

    it("renders all metric icons", () => {
      renderQuick(<BillingMetricsCard />);

      expect(screen.getByTestId("icon-dollar-sign")).toBeInTheDocument();
      expect(screen.getByTestId("icon-trending-up")).toBeInTheDocument();
      expect(screen.getByTestId("icon-file-text")).toBeInTheDocument();
      expect(screen.getAllByTestId("icon-alert-circle").length).toBeGreaterThan(0);
    });
  });

  describe("Revenue Chart", () => {
    it("renders line chart when revenueTimeSeries data is available", () => {
      mockUseBillingMetrics.mockReturnValue({
        data: mockBillingData,
        isLoading: false,
        error: null,
      });

      renderQuick(<BillingMetricsCard />);

      expect(screen.getByText("Revenue Over Time")).toBeInTheDocument();
      expect(screen.getByText("Daily revenue for the selected period")).toBeInTheDocument();
      expect(screen.getByTestId("line-chart")).toBeInTheDocument();
    });

    it("passes correct data to revenue line chart", () => {
      mockUseBillingMetrics.mockReturnValue({
        data: mockBillingData,
        isLoading: false,
        error: null,
      });

      renderQuick(<BillingMetricsCard />);

      const chartData = screen
        .getByTestId("line-chart")
        .querySelector('[data-testid="chart-data"]');
      const parsedData = JSON.parse(chartData?.textContent || "[]");

      expect(parsedData).toHaveLength(4);
      expect(parsedData[0]).toEqual({ label: "Jan", value: 110000 });
      expect(parsedData[3]).toEqual({ label: "Apr", value: 125000 });
    });

    it("does not render chart when revenueTimeSeries is empty", () => {
      mockUseBillingMetrics.mockReturnValue({
        data: { ...mockBillingData, revenueTimeSeries: [] },
        isLoading: false,
        error: null,
      });

      renderQuick(<BillingMetricsCard />);

      expect(screen.queryByText("Revenue Over Time")).not.toBeInTheDocument();
    });
  });

  describe("Subscriptions Chart", () => {
    it("renders bar chart when subscriptionsTimeSeries data is available", () => {
      mockUseBillingMetrics.mockReturnValue({
        data: mockBillingData,
        isLoading: false,
        error: null,
      });

      renderQuick(<BillingMetricsCard />);

      expect(screen.getByText("Subscription Growth")).toBeInTheDocument();
      expect(screen.getByText("Active subscriptions over time")).toBeInTheDocument();
      expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
    });

    it("passes correct data to subscriptions bar chart", () => {
      mockUseBillingMetrics.mockReturnValue({
        data: mockBillingData,
        isLoading: false,
        error: null,
      });

      renderQuick(<BillingMetricsCard />);

      const barChart = screen.getByTestId("bar-chart");
      const chartData = barChart.querySelector('[data-testid="chart-data"]');
      const parsedData = JSON.parse(chartData?.textContent || "[]");

      expect(parsedData).toHaveLength(4);
      expect(parsedData[0]).toEqual({ label: "Jan", value: 1100 });
    });

    it("configures bar chart with green color scheme", () => {
      mockUseBillingMetrics.mockReturnValue({
        data: mockBillingData,
        isLoading: false,
        error: null,
      });

      renderQuick(<BillingMetricsCard />);

      const barChart = screen.getByTestId("bar-chart");
      expect(barChart.querySelector('[data-testid="chart-color"]')).toHaveTextContent("green");
    });

    it("does not render chart when subscriptionsTimeSeries is empty", () => {
      mockUseBillingMetrics.mockReturnValue({
        data: { ...mockBillingData, subscriptionsTimeSeries: [] },
        isLoading: false,
        error: null,
      });

      renderQuick(<BillingMetricsCard />);

      expect(screen.queryByText("Subscription Growth")).not.toBeInTheDocument();
    });
  });

  describe("Period Parameter", () => {
    it("uses default period of 30d when not specified", () => {
      mockUseBillingMetrics.mockReturnValue({
        data: mockBillingData,
        isLoading: false,
        error: null,
      });

      renderQuick(<BillingMetricsCard />);

      expect(mockUseBillingMetrics).toHaveBeenCalledWith("30d");
    });

    it("uses custom period when specified", () => {
      mockUseBillingMetrics.mockReturnValue({
        data: mockBillingData,
        isLoading: false,
        error: null,
      });

      renderQuick(<BillingMetricsCard period="90d" />);

      expect(mockUseBillingMetrics).toHaveBeenCalledWith("90d");
    });
  });

  describe("Currency Formatting", () => {
    it("formats large currency values correctly", () => {
      mockUseBillingMetrics.mockReturnValue({
        data: mockBillingData,
        isLoading: false,
        error: null,
      });

      renderQuick(<BillingMetricsCard />);

      expect(screen.getByText("$125,000")).toBeInTheDocument();
      expect(screen.getByText(/\$1,500,000/)).toBeInTheDocument();
      expect(screen.getByText(/\$450,000/)).toBeInTheDocument();
      expect(screen.getByText("$45,000")).toBeInTheDocument();
    });

    it("formats currency without decimals", () => {
      mockUseBillingMetrics.mockReturnValue({
        data: { ...mockBillingData, mrr: 125750.99 },
        isLoading: false,
        error: null,
      });

      renderQuick(<BillingMetricsCard />);

      // Should round to $125,751 (no decimals)
      expect(screen.getByText("$125,751")).toBeInTheDocument();
    });
  });

  describe("Component Structure", () => {
    it("renders all sections in correct order", () => {
      mockUseBillingMetrics.mockReturnValue({
        data: mockBillingData,
        isLoading: false,
        error: null,
      });

      renderQuick(<BillingMetricsCard />);

      const titles = screen.getAllByTestId("card-title");
      const titleTexts = titles.map((t) => t.textContent);

      expect(titleTexts).toContain("Monthly Recurring Revenue");
      expect(titleTexts).toContain("Active Subscriptions");
      expect(titleTexts).toContain("Invoices");
      expect(titleTexts).toContain("Outstanding Balance");
      expect(titleTexts).toContain("Revenue Over Time");
      expect(titleTexts).toContain("Subscription Growth");
    });
  });
});
