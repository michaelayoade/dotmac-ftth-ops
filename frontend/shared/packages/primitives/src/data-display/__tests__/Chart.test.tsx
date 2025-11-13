/**
 * Chart component tests
 * Testing chart rendering, data visualization, and interactive features
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import type React from "react";

import {
  AreaChart,
  BarChart,
  ChartContainer,
  chartUtils,
  LineChart,
  MetricCard,
  PieChart,
} from "../Chart";

// Mock Recharts to avoid canvas dependencies in tests
jest.mock("recharts", () => {
  const mockModule = {
    __esModule: true,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
    LineChart: ({ children, data }: { children: React.ReactNode; data: unknown[] }) => (
      <div data-testid="line-chart" data-chart-items={data.length}>
        {children}
      </div>
    ),
    BarChart: ({ children, data }: { children: React.ReactNode; data: unknown[] }) => (
      <div data-testid="bar-chart" data-chart-items={data.length}>
        {children}
      </div>
    ),
    AreaChart: ({ children, data }: { children: React.ReactNode; data: unknown[] }) => (
      <div data-testid="area-chart" data-chart-items={data.length}>
        {children}
      </div>
    ),
    PieChart: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="pie-chart">{children}</div>
    ),
    CartesianGrid: () => <div data-testid="cartesian-grid" />,
    XAxis: ({ dataKey }: { dataKey: string }) => <div data-testid="x-axis" data-key={dataKey} />,
    YAxis: ({ domain }: { domain?: unknown }) => <div data-testid="y-axis" data-domain={domain} />,
    Tooltip: () => <div data-testid="tooltip" />,
    Legend: () => <div data-testid="legend" />,
    Line: ({ dataKey, stroke }: { dataKey: string; stroke?: string }) => (
      <div data-testid={`line-${dataKey}`} data-stroke={stroke} />
    ),
    Bar: ({ dataKey, fill }: { dataKey: string; fill?: string }) => (
      <div data-testid={`bar-${dataKey}`} data-fill={fill} />
    ),
    Area: ({ dataKey, fill }: { dataKey: string; fill?: string }) => (
      <div data-testid={`area-${dataKey}`} data-fill={fill} />
    ),
    Pie: ({ data, dataKey }: { data: unknown[]; dataKey: string }) => (
      <div data-testid="pie" data-key={dataKey} data-items={data.length} />
    ),
    Cell: ({ fill }: { fill: string }) => <div data-testid="pie-cell" data-fill={fill} />,
  };

  return { ...mockModule, default: mockModule };
});

// Sample test data
const sampleData = [
  { name: "Jan", value: 400, revenue: 2400, customers: 240 },
  { name: "Feb", value: 300, revenue: 1398, customers: 221 },
  { name: "Mar", value: 200, revenue: 9800, customers: 229 },
  { name: "Apr", value: 278, revenue: 3908, customers: 200 },
  { name: "May", value: 189, revenue: 4800, customers: 278 },
];

const pieData = [
  { name: "Desktop", value: 400 },
  { name: "Mobile", value: 300 },
  { name: "Tablet", value: 200 },
];

describe("Chart Components", () => {
  describe("LineChart", () => {
    it("renders line chart with data", () => {
      render(
        <LineChart
          data={sampleData}
          lines={[{ key: "value", stroke: "#8884d8" }]}
          title="Revenue Chart"
        />,
      );

      expect(screen.getByTestId("line-chart")).toBeInTheDocument();
      expect(screen.getByTestId("line-value")).toBeInTheDocument();
      expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
      expect(screen.getByText("Revenue Chart")).toBeInTheDocument();
    });

    it("renders multiple lines", () => {
      render(
        <LineChart
          data={sampleData}
          lines={[
            { key: "revenue", stroke: "#8884d8" },
            { key: "customers", stroke: "#82ca9d" },
          ]}
        />,
      );

      expect(screen.getByTestId("line-revenue")).toBeInTheDocument();
      expect(screen.getByTestId("line-customers")).toBeInTheDocument();
    });

    it("shows loading state", () => {
      render(<LineChart data={[]} lines={[]} loading title="Loading Chart" />);

      expect(screen.getByText("Loading chart data...")).toBeInTheDocument();
      expect(screen.queryByTestId("line-chart")).not.toBeInTheDocument();
    });

    it("shows error state", () => {
      render(<LineChart data={[]} lines={[]} error="Failed to load data" />);

      expect(screen.getByText("Error loading chart: Failed to load data")).toBeInTheDocument();
      expect(screen.queryByTestId("line-chart")).not.toBeInTheDocument();
    });

    it("shows empty state", () => {
      render(<LineChart data={[]} lines={[]} emptyText="No data to display" />);

      expect(screen.getByText("No data to display")).toBeInTheDocument();
      expect(screen.queryByTestId("line-chart")).not.toBeInTheDocument();
    });

    it("configures chart options correctly", () => {
      render(
        <LineChart
          data={sampleData}
          lines={[{ key: "value" }]}
          showGrid={true}
          showTooltip={true}
          showLegend={true}
          xAxisKey="name"
          yAxisDomain={[0, 1000]}
        />,
      );

      expect(screen.getByTestId("cartesian-grid")).toBeInTheDocument();
      expect(screen.getByTestId("tooltip")).toBeInTheDocument();
      expect(screen.getByTestId("legend")).toBeInTheDocument();
      expect(screen.getByTestId("x-axis")).toHaveAttribute("data-key", "name");
    });

    it("applies size and variant classes", () => {
      const { container } = render(
        <LineChart
          data={sampleData}
          lines={[{ key: "value" }]}
          size="lg"
          variant="minimal"
          className="custom-chart"
        />,
      );

      const chartContainer = container.querySelector(".chart-container");
      expect(chartContainer).toHaveClass("custom-chart");
    });
  });

  describe("BarChart", () => {
    it("renders bar chart with data", () => {
      render(
        <BarChart
          data={sampleData}
          bars={[{ key: "value", fill: "#8884d8" }]}
          title="Sales Chart"
        />,
      );

      expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
      expect(screen.getByTestId("bar-value")).toBeInTheDocument();
      expect(screen.getByText("Sales Chart")).toBeInTheDocument();
    });

    it("renders multiple bars with stacking", () => {
      render(
        <BarChart
          data={sampleData}
          bars={[
            { key: "revenue", fill: "#8884d8", stackId: "stack1" },
            { key: "customers", fill: "#82ca9d", stackId: "stack1" },
          ]}
        />,
      );

      expect(screen.getByTestId("bar-revenue")).toBeInTheDocument();
      expect(screen.getByTestId("bar-customers")).toBeInTheDocument();
    });

    it("supports horizontal layout", () => {
      render(<BarChart data={sampleData} bars={[{ key: "value" }]} layout="horizontal" />);

      expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
    });
  });

  describe("AreaChart", () => {
    it("renders area chart with data", () => {
      render(
        <AreaChart
          data={sampleData}
          areas={[{ key: "value", stroke: "#8884d8", fill: "#8884d8" }]}
          title="Growth Chart"
        />,
      );

      expect(screen.getByTestId("area-chart")).toBeInTheDocument();
      expect(screen.getByTestId("area-value")).toBeInTheDocument();
      expect(screen.getByText("Growth Chart")).toBeInTheDocument();
    });

    it("renders stacked areas", () => {
      render(
        <AreaChart
          data={sampleData}
          areas={[
            { key: "revenue", stackId: "stack1" },
            { key: "customers", stackId: "stack1" },
          ]}
        />,
      );

      expect(screen.getByTestId("area-revenue")).toBeInTheDocument();
      expect(screen.getByTestId("area-customers")).toBeInTheDocument();
    });
  });

  describe("PieChart", () => {
    it("renders pie chart with data", () => {
      render(<PieChart data={pieData} dataKey="value" nameKey="name" title="Distribution Chart" />);

      expect(screen.getByTestId("pie-chart")).toBeInTheDocument();
      expect(screen.getByTestId("pie")).toBeInTheDocument();
      expect(screen.getByText("Distribution Chart")).toBeInTheDocument();
    });

    it("configures pie chart options", () => {
      render(
        <PieChart
          data={pieData}
          dataKey="value"
          innerRadius={40}
          outerRadius={120}
          showTooltip={false}
          showLegend={false}
          showLabels={false}
        />,
      );

      expect(screen.getByTestId("pie")).toBeInTheDocument();
      expect(screen.queryByTestId("tooltip")).not.toBeInTheDocument();
      expect(screen.queryByTestId("legend")).not.toBeInTheDocument();
    });

    it("uses custom colors", () => {
      const customColors = ["#ff0000", "#00ff00", "#0000ff"];

      render(<PieChart data={pieData} dataKey="value" colors={customColors} />);

      expect(screen.getByTestId("pie")).toBeInTheDocument();
    });
  });

  describe("MetricCard", () => {
    it("renders basic metric card", () => {
      render(<MetricCard title="Total Revenue" value="$24,500" data-testid="metric-card" />);

      expect(screen.getByTestId("metric-card")).toBeInTheDocument();
      expect(screen.getByText("Total Revenue")).toBeInTheDocument();
      expect(screen.getByText("$24,500")).toBeInTheDocument();
    });

    it("renders metric card with trend", () => {
      render(
        <MetricCard
          title="Monthly Sales"
          value="1,234"
          trend={{ value: 12.5, direction: "up" }}
          data-testid="metric-card"
        />,
      );

      expect(screen.getByText("Monthly Sales")).toBeInTheDocument();
      expect(screen.getByText("1,234")).toBeInTheDocument();
      expect(screen.getByText("↗")).toBeInTheDocument();
      expect(screen.getByText("12.5%")).toBeInTheDocument();
    });

    it("renders metric card with subtitle and icon", () => {
      const TestIcon = () => <span data-testid="test-icon">📊</span>;

      render(
        <MetricCard
          title="Active Users"
          value="5,678"
          subtitle="Last 30 days"
          icon={<TestIcon />}
          data-testid="metric-card"
        />,
      );

      expect(screen.getByText("Active Users")).toBeInTheDocument();
      expect(screen.getByText("5,678")).toBeInTheDocument();
      expect(screen.getByText("Last 30 days")).toBeInTheDocument();
      expect(screen.getByTestId("test-icon")).toBeInTheDocument();
    });

    it("shows loading state", () => {
      render(<MetricCard title="Loading Metric" value="" loading data-testid="metric-card" />);

      expect(screen.getByText("Loading Metric")).toBeInTheDocument();
      expect(
        screen.getByTestId("metric-card").querySelector(".metric-loading"),
      ).toBeInTheDocument();
    });

    it("supports different sizes", () => {
      const { rerender } = render(
        <MetricCard title="Test Metric" value="123" size="sm" data-testid="metric-card" />,
      );

      expect(screen.getByTestId("metric-card")).toHaveClass("size-sm");

      rerender(<MetricCard title="Test Metric" value="123" size="lg" data-testid="metric-card" />);

      expect(screen.getByTestId("metric-card")).toHaveClass("size-lg");
    });

    it("handles different trend directions", () => {
      const { rerender } = render(
        <MetricCard title="Test" value="100" trend={{ value: 5, direction: "down" }} />,
      );

      expect(screen.getByText("↘")).toBeInTheDocument();

      rerender(<MetricCard title="Test" value="100" trend={{ value: 0, direction: "neutral" }} />);

      expect(screen.getByText("→")).toBeInTheDocument();
    });
  });

  describe("ChartContainer", () => {
    it("renders chart container with content", () => {
      render(
        <ChartContainer title="Test Chart" description="Chart description" data-testid="container">
          <div data-testid="chart-content">Chart goes here</div>
        </ChartContainer>,
      );

      expect(screen.getByTestId("container")).toBeInTheDocument();
      expect(screen.getByText("Test Chart")).toBeInTheDocument();
      expect(screen.getByText("Chart description")).toBeInTheDocument();
      expect(screen.getByTestId("chart-content")).toBeInTheDocument();
    });

    it("renders actions in header", () => {
      const actions = (
        <button type="button" data-testid="export-btn">
          Export
        </button>
      );

      render(
        <ChartContainer title="Test Chart" actions={actions}>
          <div>Chart content</div>
        </ChartContainer>,
      );

      expect(screen.getByTestId("export-btn")).toBeInTheDocument();
    });

    it("handles loading state", () => {
      render(
        <ChartContainer loading>
          <div>This should not render</div>
        </ChartContainer>,
      );

      expect(screen.getByText("Loading chart data...")).toBeInTheDocument();
      expect(screen.queryByText("This should not render")).not.toBeInTheDocument();
    });

    it("handles error state", () => {
      render(
        <ChartContainer error="Network error">
          <div>This should not render</div>
        </ChartContainer>,
      );

      expect(screen.getByText("Error loading chart: Network error")).toBeInTheDocument();
    });

    it("handles empty state", () => {
      render(<ChartContainer emptyText="No data available">{null}</ChartContainer>);

      expect(screen.getByText("No data available")).toBeInTheDocument();
    });
  });

  describe("Chart Utils", () => {
    describe("formatNumber", () => {
      it("formats numbers with compact notation", () => {
        expect(chartUtils.formatNumber(1234)).toBe("1.2K");
        expect(chartUtils.formatNumber(1234567)).toBe("1.2M");
        expect(chartUtils.formatNumber(123)).toBe("123");
      });

      it("accepts custom options", () => {
        expect(chartUtils.formatNumber(1234.567, { maximumFractionDigits: 2 })).toBe("1.23K");
      });
    });

    describe("formatCurrency", () => {
      it("formats currency with compact notation", () => {
        expect(chartUtils.formatCurrency(1234)).toBe("$1.2K");
        expect(chartUtils.formatCurrency(1234567)).toBe("$1.2M");
      });

      it("supports different currencies", () => {
        expect(chartUtils.formatCurrency(1234, "EUR")).toBe("€1.2K");
      });
    });

    describe("formatPercentage", () => {
      it("formats percentages correctly", () => {
        expect(chartUtils.formatPercentage(25)).toBe("25.0%");
        expect(chartUtils.formatPercentage(12.5)).toBe("12.5%");
      });
    });

    describe("generateColors", () => {
      it("generates array of colors", () => {
        const colors = chartUtils.generateColors(3);
        expect(colors).toHaveLength(3);
        expect(colors[0]).toMatch(/hsl\(\d+, \d+%, \d+%\)/);
      });

      it("accepts custom hue and saturation", () => {
        const colors = chartUtils.generateColors(2, 120, 80);
        expect(colors).toHaveLength(2);
        colors.forEach((color) => {
          expect(color).toContain("120");
          expect(color).toContain("80%");
        });
      });
    });
  });

  describe("Accessibility", () => {
    it("LineChart should be accessible", async () => {
      const { container } = render(
        <LineChart data={sampleData} lines={[{ key: "value" }]} title="Accessible Chart" />,
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("BarChart should be accessible", async () => {
      const { container } = render(
        <BarChart data={sampleData} bars={[{ key: "value" }]} title="Accessible Bar Chart" />,
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("PieChart should be accessible", async () => {
      const { container } = render(
        <PieChart data={pieData} dataKey="value" title="Accessible Pie Chart" />,
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("MetricCard should be accessible", async () => {
      const { container } = render(
        <MetricCard
          title="Accessible Metric"
          value="1,234"
          trend={{ value: 10, direction: "up" }}
        />,
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("Interactive Features", () => {
    it("charts respond to data updates", () => {
      const { rerender } = render(<LineChart data={sampleData} lines={[{ key: "value" }]} />);

      expect(screen.getByTestId("line-chart")).toHaveAttribute("data-chart-items", "5");

      const newData = sampleData.slice(0, 3);
      rerender(<LineChart data={newData} lines={[{ key: "value" }]} />);

      expect(screen.getByTestId("line-chart")).toHaveAttribute("data-chart-items", "3");
    });

    it("MetricCard forwards event handlers", () => {
      const handleClick = jest.fn();

      render(
        <MetricCard
          title="Clickable Metric"
          value="123"
          onClick={handleClick}
          onKeyDown={(e) => e.key === "Enter" && handleClick}
          data-testid="clickable-metric"
        />,
      );

      fireEvent.click(screen.getByTestId("clickable-metric"));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("ChartContainer forwards props correctly", () => {
      render(
        <ChartContainer data-custom="custom-value" role="region" aria-label="Chart region">
          <div>Content</div>
        </ChartContainer>,
      );

      const container = screen.getByRole("region");
      expect(container).toHaveAttribute("data-custom", "custom-value");
      expect(container).toHaveAttribute("aria-label", "Chart region");
    });
  });

  describe("Data Validation", () => {
    it("handles invalid data gracefully", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {
        // Implementation pending
      });

      render(<LineChart data={[]} lines={[{ key: "nonexistent" }]} />);

      expect(screen.getByText("No data available")).toBeInTheDocument();

      consoleSpy.mockRestore();
    });

    it("handles missing keys gracefully", () => {
      render(<BarChart data={[{ name: "Test" }]} bars={[{ key: "missing" }]} />);

      expect(screen.getByTestId("bar-missing")).toBeInTheDocument();
    });
  });

  describe("Performance", () => {
    it("renders large datasets efficiently", () => {
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        name: `Item ${i}`,
        value: Math.random() * 100,
      }));

      const startTime = performance.now();

      render(<LineChart data={largeData} lines={[{ key: "value" }]} />);

      const endTime = performance.now();

      // Should render within reasonable time (less than 100ms)
      expect(endTime - startTime).toBeLessThan(100);
      expect(screen.getByTestId("line-chart")).toBeInTheDocument();
    });
  });
});
