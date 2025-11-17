/**
 * CustomerMetricsCard Component Tests
 *
 * Tests customer KPI dashboard with metrics, charts, and data formatting
 */

import React from "react";
import { renderQuick, screen } from "@dotmac/testing";
import { CustomerMetricsCard } from "../CustomerMetricsCard";

// Mock hooks and components
const mockUseCustomerMetrics = jest.fn();

jest.mock("@/lib/graphql/hooks", () => ({
  useCustomerMetrics: (period: string) => mockUseCustomerMetrics(period),
}));

jest.mock("@/components/charts/BarChart", () => ({
  BarChart: ({ data, height, showValues, colorScheme }: any) => (
    <div data-testid="bar-chart">
      <div data-testid="chart-data">{JSON.stringify(data)}</div>
      <div data-testid="chart-height">{height}</div>
      <div data-testid="chart-show-values">{showValues ? "yes" : "no"}</div>
      <div data-testid="chart-color">{colorScheme}</div>
    </div>
  ),
}));

jest.mock("@/components/charts/LineChart", () => ({
  LineChart: ({ data, height, showGrid, showValues, gradient }: any) => (
    <div data-testid="line-chart">
      <div data-testid="chart-data">{JSON.stringify(data)}</div>
      <div data-testid="chart-height">{height}</div>
      <div data-testid="chart-show-grid">{showGrid ? "yes" : "no"}</div>
      <div data-testid="chart-show-values">{showValues ? "yes" : "no"}</div>
      <div data-testid="chart-gradient">{gradient ? "yes" : "no"}</div>
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
  Users: () => <div data-testid="icon-users">Users</div>,
  UserPlus: () => <div data-testid="icon-user-plus">UserPlus</div>,
  UserMinus: () => <div data-testid="icon-user-minus">UserMinus</div>,
  TrendingUp: () => <div data-testid="icon-trending-up">TrendingUp</div>,
}));

describe("CustomerMetricsCard", () => {
  const mockMetricsData = {
    totalCustomers: 1250,
    activeCustomers: 1180,
    newCustomers: 45,
    customerGrowthRate: 0.037,
    churnRate: 0.025,
    churnedCustomers: 31,
    averageLifetimeValue: 2400,
    retentionRate: 0.945,
    customerTimeSeries: [
      { label: "Jan", value: 1100 },
      { label: "Feb", value: 1150 },
      { label: "Mar", value: 1200 },
      { label: "Apr", value: 1250 },
    ],
    churnTimeSeries: [
      { label: "Jan", value: 25 },
      { label: "Feb", value: 28 },
      { label: "Mar", value: 30 },
      { label: "Apr", value: 31 },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Loading State", () => {
    it("shows skeleton loaders when loading", () => {
      mockUseCustomerMetrics.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      renderQuick(<CustomerMetricsCard />);

      const skeletons = screen.getAllByTestId("skeleton");
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("renders 4 skeleton cards during loading", () => {
      mockUseCustomerMetrics.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      renderQuick(<CustomerMetricsCard />);

      const cards = screen.getAllByTestId("card");
      expect(cards.length).toBe(4);
    });
  });

  describe("Error State", () => {
    it("displays error message when fetch fails", () => {
      mockUseCustomerMetrics.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error("Failed to fetch metrics"),
      });

      renderQuick(<CustomerMetricsCard />);

      expect(
        screen.getByText(/Failed to load customer metrics: Failed to fetch metrics/),
      ).toBeInTheDocument();
    });

    it("shows error in a card", () => {
      mockUseCustomerMetrics.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error("Network error"),
      });

      renderQuick(<CustomerMetricsCard />);

      expect(screen.getByTestId("card")).toBeInTheDocument();
    });
  });

  describe("Null Data Handling", () => {
    it("renders nothing when data is null and not loading", () => {
      mockUseCustomerMetrics.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      });

      const { container } = renderQuick(<CustomerMetricsCard />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe("Metric Cards Display", () => {
    beforeEach(() => {
      mockUseCustomerMetrics.mockReturnValue({
        data: mockMetricsData,
        isLoading: false,
        error: null,
      });
    });

    it("displays total customers metric", () => {
      renderQuick(<CustomerMetricsCard />);

      expect(screen.getByText("Total Customers")).toBeInTheDocument();
      expect(screen.getByText("1250")).toBeInTheDocument();
      expect(screen.getByText("1180 active")).toBeInTheDocument();
    });

    it("displays new customers metric", () => {
      renderQuick(<CustomerMetricsCard />);

      expect(screen.getByText("New Customers")).toBeInTheDocument();
      expect(screen.getByText("45")).toBeInTheDocument();
      expect(screen.getByText(/Growth: 3.7%/)).toBeInTheDocument();
    });

    it("displays churn rate metric", () => {
      renderQuick(<CustomerMetricsCard />);

      expect(screen.getByText("Churn Rate")).toBeInTheDocument();
      expect(screen.getByText("2.5%")).toBeInTheDocument();
      expect(screen.getByText("31 churned")).toBeInTheDocument();
    });

    it("displays lifetime value metric", () => {
      renderQuick(<CustomerMetricsCard />);

      expect(screen.getByText("Lifetime Value")).toBeInTheDocument();
      expect(screen.getByText("$2,400")).toBeInTheDocument();
      expect(screen.getByText(/Retention: 94.5%/)).toBeInTheDocument();
    });

    it("renders all metric icons", () => {
      renderQuick(<CustomerMetricsCard />);

      expect(screen.getByTestId("icon-users")).toBeInTheDocument();
      expect(screen.getByTestId("icon-user-plus")).toBeInTheDocument();
      expect(screen.getByTestId("icon-user-minus")).toBeInTheDocument();
      expect(screen.getByTestId("icon-trending-up")).toBeInTheDocument();
    });
  });

  describe("Customer Growth Chart", () => {
    it("renders line chart when customerTimeSeries data is available", () => {
      mockUseCustomerMetrics.mockReturnValue({
        data: mockMetricsData,
        isLoading: false,
        error: null,
      });

      renderQuick(<CustomerMetricsCard />);

      expect(screen.getByText("Customer Growth")).toBeInTheDocument();
      expect(screen.getByText("Total customers over time")).toBeInTheDocument();
      expect(screen.getByTestId("line-chart")).toBeInTheDocument();
    });

    it("passes correct data to line chart", () => {
      mockUseCustomerMetrics.mockReturnValue({
        data: mockMetricsData,
        isLoading: false,
        error: null,
      });

      renderQuick(<CustomerMetricsCard />);

      const lineChart = screen.getByTestId("line-chart");
      const chartData = lineChart.querySelector('[data-testid="chart-data"]');
      const parsedData = JSON.parse(chartData?.textContent || "[]");

      expect(parsedData).toHaveLength(4);
      expect(parsedData[0]).toEqual({ label: "Jan", value: 1100 });
    });

    it("configures line chart with correct props", () => {
      mockUseCustomerMetrics.mockReturnValue({
        data: mockMetricsData,
        isLoading: false,
        error: null,
      });

      renderQuick(<CustomerMetricsCard />);

      const lineChart = screen.getByTestId("line-chart");
      expect(lineChart.querySelector('[data-testid="chart-height"]')).toHaveTextContent("250");
      expect(lineChart.querySelector('[data-testid="chart-show-grid"]')).toHaveTextContent("yes");
      expect(lineChart.querySelector('[data-testid="chart-show-values"]')).toHaveTextContent("yes");
      expect(lineChart.querySelector('[data-testid="chart-gradient"]')).toHaveTextContent("yes");
    });

    it("does not render chart when customerTimeSeries is empty", () => {
      mockUseCustomerMetrics.mockReturnValue({
        data: { ...mockMetricsData, customerTimeSeries: [] },
        isLoading: false,
        error: null,
      });

      renderQuick(<CustomerMetricsCard />);

      expect(screen.queryByText("Customer Growth")).not.toBeInTheDocument();
      expect(screen.queryByTestId("line-chart")).not.toBeInTheDocument();
    });

    it("does not render chart when customerTimeSeries is null", () => {
      mockUseCustomerMetrics.mockReturnValue({
        data: { ...mockMetricsData, customerTimeSeries: null },
        isLoading: false,
        error: null,
      });

      renderQuick(<CustomerMetricsCard />);

      expect(screen.queryByTestId("line-chart")).not.toBeInTheDocument();
    });
  });

  describe("Churn Chart", () => {
    it("renders bar chart when churnTimeSeries data is available", () => {
      mockUseCustomerMetrics.mockReturnValue({
        data: mockMetricsData,
        isLoading: false,
        error: null,
      });

      renderQuick(<CustomerMetricsCard />);

      expect(screen.getByText("Customer Churn")).toBeInTheDocument();
      expect(screen.getByText("Churned customers over time")).toBeInTheDocument();
      expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
    });

    it("passes correct data to bar chart", () => {
      mockUseCustomerMetrics.mockReturnValue({
        data: mockMetricsData,
        isLoading: false,
        error: null,
      });

      renderQuick(<CustomerMetricsCard />);

      const barChart = screen.getByTestId("bar-chart");
      const chartData = barChart.querySelector('[data-testid="chart-data"]');
      const parsedData = JSON.parse(chartData?.textContent || "[]");

      expect(parsedData).toHaveLength(4);
      expect(parsedData[3]).toEqual({ label: "Apr", value: 31 });
    });

    it("configures bar chart with correct props", () => {
      mockUseCustomerMetrics.mockReturnValue({
        data: mockMetricsData,
        isLoading: false,
        error: null,
      });

      renderQuick(<CustomerMetricsCard />);

      const barChart = screen.getByTestId("bar-chart");
      expect(barChart.querySelector('[data-testid="chart-height"]')).toHaveTextContent("250");
      expect(barChart.querySelector('[data-testid="chart-show-values"]')).toHaveTextContent("yes");
      expect(barChart.querySelector('[data-testid="chart-color"]')).toHaveTextContent("purple");
    });

    it("does not render chart when churnTimeSeries is empty", () => {
      mockUseCustomerMetrics.mockReturnValue({
        data: { ...mockMetricsData, churnTimeSeries: [] },
        isLoading: false,
        error: null,
      });

      renderQuick(<CustomerMetricsCard />);

      expect(screen.queryByText("Customer Churn")).not.toBeInTheDocument();
      expect(screen.queryByTestId("bar-chart")).not.toBeInTheDocument();
    });
  });

  describe("Period Parameter", () => {
    it("uses default period of 30d when not specified", () => {
      mockUseCustomerMetrics.mockReturnValue({
        data: mockMetricsData,
        isLoading: false,
        error: null,
      });

      renderQuick(<CustomerMetricsCard />);

      expect(mockUseCustomerMetrics).toHaveBeenCalledWith("30d");
    });

    it("uses custom period when specified", () => {
      mockUseCustomerMetrics.mockReturnValue({
        data: mockMetricsData,
        isLoading: false,
        error: null,
      });

      renderQuick(<CustomerMetricsCard period="7d" />);

      expect(mockUseCustomerMetrics).toHaveBeenCalledWith("7d");
    });
  });

  describe("Data Formatting", () => {
    it("formats percentage values correctly", () => {
      mockUseCustomerMetrics.mockReturnValue({
        data: mockMetricsData,
        isLoading: false,
        error: null,
      });

      renderQuick(<CustomerMetricsCard />);

      // Growth rate: 0.037 -> 3.7%
      expect(screen.getByText(/3.7%/)).toBeInTheDocument();

      // Churn rate: 0.025 -> 2.5%
      expect(screen.getByText("2.5%")).toBeInTheDocument();

      // Retention rate: 0.945 -> 94.5%
      expect(screen.getByText(/94.5%/)).toBeInTheDocument();
    });

    it("formats currency values correctly", () => {
      mockUseCustomerMetrics.mockReturnValue({
        data: mockMetricsData,
        isLoading: false,
        error: null,
      });

      renderQuick(<CustomerMetricsCard />);

      // Average lifetime value: 2400 -> $2,400
      expect(screen.getByText("$2,400")).toBeInTheDocument();
    });

    it("formats large currency values without decimals", () => {
      mockUseCustomerMetrics.mockReturnValue({
        data: { ...mockMetricsData, averageLifetimeValue: 12500.75 },
        isLoading: false,
        error: null,
      });

      renderQuick(<CustomerMetricsCard />);

      // Should round to $12,501 (no decimals)
      expect(screen.getByText("$12,501")).toBeInTheDocument();
    });
  });

  describe("Component Structure", () => {
    it("renders metric cards in a grid", () => {
      mockUseCustomerMetrics.mockReturnValue({
        data: mockMetricsData,
        isLoading: false,
        error: null,
      });

      const { container } = renderQuick(<CustomerMetricsCard />);

      const grids = container.querySelectorAll(".grid");
      expect(grids.length).toBeGreaterThan(0);
    });

    it("renders all sections in correct order", () => {
      mockUseCustomerMetrics.mockReturnValue({
        data: mockMetricsData,
        isLoading: false,
        error: null,
      });

      renderQuick(<CustomerMetricsCard />);

      const titles = screen.getAllByTestId("card-title");
      const titleTexts = titles.map((t) => t.textContent);

      expect(titleTexts).toContain("Total Customers");
      expect(titleTexts).toContain("New Customers");
      expect(titleTexts).toContain("Churn Rate");
      expect(titleTexts).toContain("Lifetime Value");
      expect(titleTexts).toContain("Customer Growth");
      expect(titleTexts).toContain("Customer Churn");
    });
  });
});
