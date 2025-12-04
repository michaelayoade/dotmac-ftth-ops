/**
 * MonitoringMetricsCard Component Tests
 *
 * Testing skeleton loading, error fallbacks, calculated summaries,
 * chart transform logic, and all rendering branches
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MonitoringMetricsCard } from "../MonitoringMetricsCard";

// Mock the GraphQL hook
const mockUseMonitoringMetrics = jest.fn();
jest.mock("@/lib/graphql/hooks", () => ({
  useMonitoringMetrics: () => mockUseMonitoringMetrics(),
}));

// Mock the LineChart component
jest.mock("@/components/charts/LineChart", () => ({
  LineChart: jest.fn(({ data, height, showGrid, showValues, gradient }) => (
    <div data-testid="line-chart">
      <div data-testid="chart-height">{height}</div>
      <div data-testid="chart-data">{JSON.stringify(data)}</div>
      <div data-testid="chart-grid">{showGrid ? "yes" : "no"}</div>
      <div data-testid="chart-values">{showValues ? "yes" : "no"}</div>
      <div data-testid="chart-gradient">{gradient ? "yes" : "no"}</div>
    </div>
  )),
}));

// Mock UI components
jest.mock("@dotmac/ui", () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardContent: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardDescription: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardTitle: ({ children, className }: any) => <div className={className}>{children}</div>,
  Skeleton: ({ className }: any) => (
    <div className={className} data-testid="skeleton">
      Loading...
    </div>
  ),
}));

// Mock Lucide icons
jest.mock("lucide-react", () => ({
  Activity: () => <div data-testid="activity-icon">Activity</div>,
  AlertTriangle: () => <div data-testid="alert-icon">Alert</div>,
  Clock: () => <div data-testid="clock-icon">Clock</div>,
  Users: () => <div data-testid="users-icon">Users</div>,
}));

describe("MonitoringMetricsCard", () => {
  const mockMetricsData = {
    totalRequests: 1234567,
    errorRate: 0.0234, // 2.34%
    avgResponseTimeMs: 123.456,
    p95ResponseTimeMs: 456.789,
    activeUsers: 8901,
    systemUptime: 0.9999, // 99.99%
    criticalErrors: 5,
    warningCount: 23,
    requestsTimeSeries: [
      { label: "00:00", value: 100 },
      { label: "01:00", value: 150 },
      { label: "02:00", value: 200 },
    ],
    responseTimeTimeSeries: [
      { label: "00:00", value: 120 },
      { label: "01:00", value: 135 },
      { label: "02:00", value: 110 },
    ],
    errorRateTimeSeries: [
      { label: "00:00", value: 0.02 },
      { label: "01:00", value: 0.025 },
      { label: "02:00", value: 0.018 },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Loading State", () => {
    it("renders skeleton loading state", () => {
      mockUseMonitoringMetrics.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      render(<MonitoringMetricsCard />);

      const skeletons = screen.getAllByTestId("skeleton");
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("renders 4 skeleton cards for metric placeholders", () => {
      mockUseMonitoringMetrics.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      const { container } = render(<MonitoringMetricsCard />);

      // Should render 4 skeleton cards in grid
      const skeletons = screen.getAllByTestId("skeleton");
      expect(skeletons.length).toBeGreaterThanOrEqual(8); // 2 skeletons per card × 4 cards
    });

    it("does not render charts during loading", () => {
      mockUseMonitoringMetrics.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      render(<MonitoringMetricsCard />);

      expect(screen.queryByTestId("line-chart")).not.toBeInTheDocument();
    });
  });

  describe("Error State", () => {
    it("renders error message when fetch fails", () => {
      mockUseMonitoringMetrics.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error("Network error"),
      });

      render(<MonitoringMetricsCard />);

      expect(
        screen.getByText(/Failed to load monitoring metrics: Network error/i),
      ).toBeInTheDocument();
    });

    it("applies destructive styling to error message", () => {
      mockUseMonitoringMetrics.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error("API error"),
      });

      const { container } = render(<MonitoringMetricsCard />);

      const errorText = screen.getByText(/Failed to load monitoring metrics/i);
      expect(errorText).toHaveClass("text-destructive");
    });

    it("does not render metrics or charts on error", () => {
      mockUseMonitoringMetrics.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error("Error"),
      });

      render(<MonitoringMetricsCard />);

      expect(screen.queryByText("Total Requests")).not.toBeInTheDocument();
      expect(screen.queryByTestId("line-chart")).not.toBeInTheDocument();
    });
  });

  describe("Empty/No Data State", () => {
    it("renders nothing when data is null and not loading", () => {
      mockUseMonitoringMetrics.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      });

      const { container } = render(<MonitoringMetricsCard />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe("Success State - Metric Cards", () => {
    beforeEach(() => {
      mockUseMonitoringMetrics.mockReturnValue({
        data: mockMetricsData,
        isLoading: false,
        error: null,
      });
    });

    it("renders all 4 metric cards", () => {
      render(<MonitoringMetricsCard />);

      expect(screen.getByText("Total Requests")).toBeInTheDocument();
      expect(screen.getByText("Avg Response Time")).toBeInTheDocument();
      expect(screen.getByText("Active Users")).toBeInTheDocument();
      expect(screen.getByText("Critical Errors")).toBeInTheDocument();
    });

    it("renders icons for each metric card", () => {
      render(<MonitoringMetricsCard />);

      expect(screen.getByTestId("activity-icon")).toBeInTheDocument();
      expect(screen.getByTestId("clock-icon")).toBeInTheDocument();
      expect(screen.getByTestId("users-icon")).toBeInTheDocument();
      expect(screen.getByTestId("alert-icon")).toBeInTheDocument();
    });

    describe("Total Requests Card", () => {
      it("formats total requests with locale string", () => {
        render(<MonitoringMetricsCard />);

        expect(screen.getByText("1,234,567")).toBeInTheDocument();
      });

      it("displays error rate as percentage", () => {
        render(<MonitoringMetricsCard />);

        expect(screen.getByText(/Error rate: 2\.34%/i)).toBeInTheDocument();
      });

      it("formats error rate correctly (formatPercent utility)", () => {
        mockUseMonitoringMetrics.mockReturnValue({
          data: { ...mockMetricsData, errorRate: 0.123456 },
          isLoading: false,
          error: null,
        });

        render(<MonitoringMetricsCard />);

        expect(screen.getByText(/Error rate: 12\.35%/i)).toBeInTheDocument();
      });
    });

    describe("Response Time Card", () => {
      it("displays average response time rounded to integer", () => {
        render(<MonitoringMetricsCard />);

        expect(screen.getByText("123ms")).toBeInTheDocument();
      });

      it("displays P95 response time", () => {
        render(<MonitoringMetricsCard />);

        expect(screen.getByText(/P95: 457ms/i)).toBeInTheDocument();
      });

      it("rounds response times correctly", () => {
        mockUseMonitoringMetrics.mockReturnValue({
          data: {
            ...mockMetricsData,
            avgResponseTimeMs: 99.4,
            p95ResponseTimeMs: 199.6,
          },
          isLoading: false,
          error: null,
        });

        render(<MonitoringMetricsCard />);

        expect(screen.getByText("99ms")).toBeInTheDocument();
        expect(screen.getByText(/P95: 200ms/i)).toBeInTheDocument();
      });
    });

    describe("Active Users Card", () => {
      it("displays active users count", () => {
        render(<MonitoringMetricsCard />);

        expect(screen.getByText("8901")).toBeInTheDocument();
      });

      it("displays system uptime as percentage", () => {
        render(<MonitoringMetricsCard />);

        expect(screen.getByText(/Uptime: 99\.99%/i)).toBeInTheDocument();
      });
    });

    describe("Critical Errors Card", () => {
      it("displays critical errors count", () => {
        render(<MonitoringMetricsCard />);

        expect(screen.getByText("5")).toBeInTheDocument();
      });

      it("displays warning count", () => {
        render(<MonitoringMetricsCard />);

        expect(screen.getByText("23 warnings")).toBeInTheDocument();
      });
    });
  });

  describe("Chart Rendering", () => {
    beforeEach(() => {
      mockUseMonitoringMetrics.mockReturnValue({
        data: mockMetricsData,
        isLoading: false,
        error: null,
      });
    });

    it("renders Request Volume chart when data is available", () => {
      render(<MonitoringMetricsCard />);

      expect(screen.getByText("Request Volume")).toBeInTheDocument();
      expect(screen.getByText("API requests over time")).toBeInTheDocument();
    });

    it("transforms requestsTimeSeries data correctly for chart", () => {
      render(<MonitoringMetricsCard />);

      const charts = screen.getAllByTestId("chart-data");
      const data = JSON.parse(charts[0].textContent!);

      expect(data).toEqual([
        { label: "00:00", value: 100 },
        { label: "01:00", value: 150 },
        { label: "02:00", value: 200 },
      ]);
    });

    it("renders Response Time chart when data is available", () => {
      render(<MonitoringMetricsCard />);

      expect(screen.getByText("Response Time Trend")).toBeInTheDocument();
      expect(screen.getByText("Average response time in milliseconds")).toBeInTheDocument();
    });

    it("renders Error Rate chart when data is available", () => {
      render(<MonitoringMetricsCard />);

      expect(screen.getByText("Error Rate")).toBeInTheDocument();
      expect(screen.getByText("Percentage of failed requests")).toBeInTheDocument();
    });

    it("converts error rate to percentage for chart (multiply by 100)", () => {
      render(<MonitoringMetricsCard />);

      const charts = screen.getAllByTestId("chart-data");
      const errorRateChartData = JSON.parse(charts[2].textContent!);

      expect(errorRateChartData[0]).toEqual({ label: "00:00", value: 2 });
      expect(errorRateChartData[1]).toEqual({ label: "01:00", value: 2.5 });
      expect(errorRateChartData[2].label).toBe("02:00");
      expect(errorRateChartData[2].value).toBeCloseTo(1.8, 1); // Handle floating point precision
    });

    it("passes correct props to LineChart components", () => {
      render(<MonitoringMetricsCard />);

      const chartHeights = screen.getAllByTestId("chart-height");
      chartHeights.forEach((height) => {
        expect(height).toHaveTextContent("250");
      });

      const chartGrids = screen.getAllByTestId("chart-grid");
      chartGrids.forEach((grid) => {
        expect(grid).toHaveTextContent("yes");
      });

      const chartValues = screen.getAllByTestId("chart-values");
      chartValues.forEach((values) => {
        expect(values).toHaveTextContent("yes");
      });
    });

    it("applies gradient to Request Volume chart", () => {
      render(<MonitoringMetricsCard />);

      const gradients = screen.getAllByTestId("chart-gradient");
      expect(gradients[0]).toHaveTextContent("yes"); // First chart has gradient
    });

    it("does not render chart when time series data is empty", () => {
      mockUseMonitoringMetrics.mockReturnValue({
        data: {
          ...mockMetricsData,
          requestsTimeSeries: [],
        },
        isLoading: false,
        error: null,
      });

      render(<MonitoringMetricsCard />);

      expect(screen.queryByText("Request Volume")).not.toBeInTheDocument();
    });

    it("does not render chart when time series is null", () => {
      mockUseMonitoringMetrics.mockReturnValue({
        data: {
          ...mockMetricsData,
          responseTimeTimeSeries: null,
        },
        isLoading: false,
        error: null,
      });

      render(<MonitoringMetricsCard />);

      // Request Volume should still render
      expect(screen.getByText("Request Volume")).toBeInTheDocument();
      // Response Time should not render
      expect(screen.queryByText("Response Time Trend")).not.toBeInTheDocument();
    });
  });

  describe("Period Parameter", () => {
    it("accepts period parameter (for future use)", () => {
      mockUseMonitoringMetrics.mockReturnValue({
        data: mockMetricsData,
        isLoading: false,
        error: null,
      });

      render(<MonitoringMetricsCard period="7d" />);

      // Period is currently unused but accepted
      expect(screen.getByText("Total Requests")).toBeInTheDocument();
    });

    it("uses default period of 24h", () => {
      mockUseMonitoringMetrics.mockReturnValue({
        data: mockMetricsData,
        isLoading: false,
        error: null,
      });

      render(<MonitoringMetricsCard />);

      expect(screen.getByText("Total Requests")).toBeInTheDocument();
    });
  });

  describe("Grid Layout", () => {
    it("uses responsive grid for metric cards", () => {
      mockUseMonitoringMetrics.mockReturnValue({
        data: mockMetricsData,
        isLoading: false,
        error: null,
      });

      const { container } = render(<MonitoringMetricsCard />);

      const grid = container.querySelector(".grid");
      expect(grid).toHaveClass("md:grid-cols-2", "lg:grid-cols-4");
    });
  });

  describe("Integration Scenarios", () => {
    it("handles transition from loading to success", async () => {
      mockUseMonitoringMetrics.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      const { rerender } = render(<MonitoringMetricsCard />);

      expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);

      // Simulate data loading
      mockUseMonitoringMetrics.mockReturnValue({
        data: mockMetricsData,
        isLoading: false,
        error: null,
      });

      rerender(<MonitoringMetricsCard />);

      await waitFor(() => {
        expect(screen.queryByTestId("skeleton")).not.toBeInTheDocument();
        expect(screen.getByText("Total Requests")).toBeInTheDocument();
      });
    });

    it("handles transition from loading to error", async () => {
      mockUseMonitoringMetrics.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      const { rerender } = render(<MonitoringMetricsCard />);

      expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);

      // Simulate error
      mockUseMonitoringMetrics.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error("Failed to fetch"),
      });

      rerender(<MonitoringMetricsCard />);

      await waitFor(() => {
        expect(screen.queryByTestId("skeleton")).not.toBeInTheDocument();
        expect(screen.getByText(/Failed to load monitoring metrics/i)).toBeInTheDocument();
      });
    });
  });
});
