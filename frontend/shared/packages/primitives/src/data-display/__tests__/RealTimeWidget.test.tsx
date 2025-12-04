/**
 * Comprehensive Tests for RealTimeWidget Components
 *
 * Tests real-time updates, auto-refresh, status indicators, metrics,
 * accessibility, security, and performance
 */

import React from "react";
import {
  render,
  renderA11y,
  renderSecurity,
  renderPerformance,
  renderComprehensive,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@dotmac/testing";
import {
  BaseRealTimeWidget,
  StatusIndicator,
  NetworkDeviceWidget,
  ServiceHealthWidget,
  RealTimeMetricsWidget,
  type NetworkDeviceWidgetProps,
  type ServiceHealthWidgetProps,
  type RealTimeMetricsWidgetProps,
} from "../RealTimeWidget";

// Sample test data
const mockNetworkDevice: NetworkDeviceWidgetProps["device"] = {
  id: "device-1",
  name: "Core Router 01",
  type: "Router",
  status: "online",
  ipAddress: "192.168.1.1",
  uptime: 86400 * 7 + 3600 * 5, // 7 days, 5 hours
  lastSeen: new Date("2024-11-14T10:00:00Z"),
  metrics: {
    cpuUsage: 45,
    memoryUsage: 62,
    networkUtilization: 78,
    temperature: 55,
  },
};

const mockService: ServiceHealthWidgetProps["service"] = {
  name: "API Gateway",
  status: "healthy",
  responseTime: 120,
  uptime: 0.9995,
  version: "2.1.0",
  endpoints: [
    { name: "/api/platform/v1/admin/health", status: "up", responseTime: 50 },
    { name: "/api/platform/v1/admin/users", status: "up", responseTime: 150 },
    { name: "/api/platform/v1/admin/products", status: "degraded", responseTime: 350 },
  ],
};

const mockMetrics: RealTimeMetricsWidgetProps["metrics"] = [
  {
    label: "Active Connections",
    value: 1234,
    trend: { direction: "up", percentage: 12.5 },
    threshold: { warning: 1500, critical: 2000 },
  },
  {
    label: "Request Rate",
    value: 567,
    unit: "req/s",
    trend: { direction: "down", percentage: 5.2 },
    threshold: { warning: 800, critical: 1000 },
  },
  {
    label: "Error Rate",
    value: 2,
    unit: "%",
    trend: { direction: "stable", percentage: 0 },
    threshold: { warning: 5, critical: 10 },
  },
];

// JSDOM performance is slower than real browsers; use budgets that catch regressions without flaking.
const REALTIME_PERFORMANCE_BUDGET_MS = 120;
const REALTIME_HEAVY_BUDGET_MS = 650;
const REALTIME_RERENDER_BUDGET_MS = 250;
const REALTIME_COMPREHENSIVE_BUDGET_MS = 150;

describe("StatusIndicator Component", () => {
  describe("Basic Functionality", () => {
    it("renders with online status", () => {
      render(<StatusIndicator status="online" />);
      const indicator = screen.getByTitle("Online");
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveClass("status-online");
    });

    it("renders with offline status", () => {
      render(<StatusIndicator status="offline" />);
      const indicator = screen.getByTitle("Offline");
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveClass("status-offline");
    });

    it("renders with warning status", () => {
      render(<StatusIndicator status="warning" />);
      const indicator = screen.getByTitle("Warning");
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveClass("status-warning");
    });

    it("renders with critical status", () => {
      render(<StatusIndicator status="critical" />);
      const indicator = screen.getByTitle("Critical");
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveClass("status-critical");
    });
  });

  describe("Visual States", () => {
    it("applies pulse animation when pulse is true", () => {
      render(<StatusIndicator status="online" pulse />);
      const indicator = screen.getByTitle("Online");
      expect(indicator).toHaveClass("pulse");
    });

    it("applies size classes correctly", () => {
      const { rerender } = render(<StatusIndicator status="online" size="sm" />);
      let indicator = screen.getByTitle("Online");
      expect(indicator).toHaveClass("size-sm");

      rerender(<StatusIndicator status="online" size="md" />);
      indicator = screen.getByTitle("Online");
      expect(indicator).toHaveClass("size-md");

      rerender(<StatusIndicator status="online" size="lg" />);
      indicator = screen.getByTitle("Online");
      expect(indicator).toHaveClass("size-lg");
    });
  });
});

describe("BaseRealTimeWidget Component", () => {
  describe("Basic Functionality", () => {
    it("renders title and subtitle", () => {
      render(
        <BaseRealTimeWidget title="Test Widget" subtitle="Test subtitle">
          Widget content
        </BaseRealTimeWidget>,
      );

      expect(screen.getByText("Test Widget")).toBeInTheDocument();
      expect(screen.getByText("Test subtitle")).toBeInTheDocument();
      expect(screen.getByText("Widget content")).toBeInTheDocument();
    });

    it("renders children content", () => {
      render(
        <BaseRealTimeWidget title="Test">
          <div data-testid="child-content">Child content</div>
        </BaseRealTimeWidget>,
      );

      expect(screen.getByTestId("child-content")).toBeInTheDocument();
    });

    it("renders actions when provided", () => {
      const actions = <button type="button">Action Button</button>;

      render(
        <BaseRealTimeWidget title="Test" actions={actions}>
          Content
        </BaseRealTimeWidget>,
      );

      expect(screen.getByText("Action Button")).toBeInTheDocument();
    });
  });

  describe("Auto-Refresh Functionality", () => {
    beforeAll(() => {
      jest.useFakeTimers();
    });

    afterAll(() => {
      jest.useRealTimers();
    });

    it("shows refresh controls when onRefresh is provided", () => {
      const onRefresh = jest.fn();

      render(
        <BaseRealTimeWidget title="Test" refreshInterval={30} onRefresh={onRefresh}>
          Content
        </BaseRealTimeWidget>,
      );

      expect(screen.getByTitle("Refresh now")).toBeInTheDocument();
      expect(screen.getByText("30s")).toBeInTheDocument();
    });

    it("calls onRefresh on manual button click", () => {
      const onRefresh = jest.fn();

      render(
        <BaseRealTimeWidget title="Test" refreshInterval={30} onRefresh={onRefresh}>
          Content
        </BaseRealTimeWidget>,
      );

      const refreshButton = screen.getByTitle("Refresh now");
      fireEvent.click(refreshButton);

      expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it("auto-refreshes after interval", () => {
      const onRefresh = jest.fn();

      render(
        <BaseRealTimeWidget title="Test" refreshInterval={30} onRefresh={onRefresh}>
          Content
        </BaseRealTimeWidget>,
      );

      act(() => {
        jest.advanceTimersByTime(30000); // 30 seconds
      });

      expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it("counts down timer correctly", () => {
      const onRefresh = jest.fn();

      render(
        <BaseRealTimeWidget title="Test" refreshInterval={30} onRefresh={onRefresh}>
          Content
        </BaseRealTimeWidget>,
      );

      expect(screen.getByText("30s")).toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(5000); // 5 seconds
      });

      expect(screen.getByText("25s")).toBeInTheDocument();
    });

    it("resets timer on manual refresh", () => {
      const onRefresh = jest.fn();

      render(
        <BaseRealTimeWidget title="Test" refreshInterval={30} onRefresh={onRefresh}>
          Content
        </BaseRealTimeWidget>,
      );

      act(() => {
        jest.advanceTimersByTime(20000); // 20 seconds
      });

      expect(screen.getByText("10s")).toBeInTheDocument();

      const refreshButton = screen.getByTitle("Refresh now");
      fireEvent.click(refreshButton);

      expect(screen.getByText("30s")).toBeInTheDocument();
    });

    it("cleans up interval on unmount", () => {
      const onRefresh = jest.fn();
      const { unmount } = render(
        <BaseRealTimeWidget title="Test" refreshInterval={30} onRefresh={onRefresh}>
          Content
        </BaseRealTimeWidget>,
      );

      unmount();

      act(() => {
        jest.advanceTimersByTime(30000);
      });

      expect(onRefresh).not.toHaveBeenCalled();
    });
  });

  describe("Loading State", () => {
    it("shows loading indicator when loading is true", () => {
      render(
        <BaseRealTimeWidget title="Test" loading>
          <div>Content</div>
        </BaseRealTimeWidget>,
      );

      expect(screen.getByText("Updating...")).toBeInTheDocument();
      expect(screen.queryByText("Content")).not.toBeInTheDocument();
    });

    it("disables refresh button when loading", () => {
      const onRefresh = jest.fn();

      render(
        <BaseRealTimeWidget title="Test" onRefresh={onRefresh} loading>
          Content
        </BaseRealTimeWidget>,
      );

      const refreshButton = screen.getByTitle("Refresh now");
      expect(refreshButton).toBeDisabled();
    });
  });

  describe("Error State", () => {
    it("shows error message when error is provided", () => {
      render(
        <BaseRealTimeWidget title="Test" error="Failed to fetch data">
          <div>Content</div>
        </BaseRealTimeWidget>,
      );

      expect(screen.getByText("Failed to fetch data")).toBeInTheDocument();
      expect(screen.queryByText("Content")).not.toBeInTheDocument();
    });

    it("shows retry button in error state", () => {
      const onRefresh = jest.fn();

      render(
        <BaseRealTimeWidget title="Test" error="Error occurred" onRefresh={onRefresh}>
          Content
        </BaseRealTimeWidget>,
      );

      const retryButton = screen.getByText("Retry");
      expect(retryButton).toBeInTheDocument();

      fireEvent.click(retryButton);
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });
  });

  describe("Last Updated", () => {
    it("shows last updated timestamp", () => {
      const lastUpdated = new Date("2024-11-14T10:00:00Z");

      render(
        <BaseRealTimeWidget title="Test" lastUpdated={lastUpdated}>
          Content
        </BaseRealTimeWidget>,
      );

      expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
    });
  });

  describe("Variants and Status", () => {
    it("applies size variants correctly", () => {
      const { container, rerender } = render(
        <BaseRealTimeWidget title="Test" size="sm">
          Content
        </BaseRealTimeWidget>,
      );

      expect(container.firstChild).toHaveClass("widget-sm");

      rerender(
        <BaseRealTimeWidget title="Test" size="lg">
          Content
        </BaseRealTimeWidget>,
      );

      expect(container.firstChild).toHaveClass("widget-lg");
    });

    it("applies status classes correctly", () => {
      const { container, rerender } = render(
        <BaseRealTimeWidget title="Test" status="normal">
          Content
        </BaseRealTimeWidget>,
      );

      expect(container.firstChild).toHaveClass("status-normal");

      rerender(
        <BaseRealTimeWidget title="Test" status="warning">
          Content
        </BaseRealTimeWidget>,
      );

      expect(container.firstChild).toHaveClass("status-warning");

      rerender(
        <BaseRealTimeWidget title="Test" status="critical">
          Content
        </BaseRealTimeWidget>,
      );

      expect(container.firstChild).toHaveClass("status-critical");
    });
  });
});

describe("NetworkDeviceWidget Component", () => {
  describe("Basic Functionality", () => {
    it("renders device information", () => {
      render(<NetworkDeviceWidget device={mockNetworkDevice} />);

      expect(screen.getByText("Core Router 01")).toBeInTheDocument();
      expect(screen.getByText(/Router • 192\.168\.1\.1/)).toBeInTheDocument();
      expect(screen.getByText("ONLINE")).toBeInTheDocument();
    });

    it("displays uptime correctly", () => {
      render(<NetworkDeviceWidget device={mockNetworkDevice} />);

      expect(screen.getByText(/Uptime: 7d 5h/)).toBeInTheDocument();
    });

    it("shows all metrics", () => {
      render(<NetworkDeviceWidget device={mockNetworkDevice} />);

      expect(screen.getByText("CPU Usage")).toBeInTheDocument();
      expect(screen.getByText("45%")).toBeInTheDocument();
      expect(screen.getByText("Memory Usage")).toBeInTheDocument();
      expect(screen.getByText("62%")).toBeInTheDocument();
      expect(screen.getByText("Network Utilization")).toBeInTheDocument();
      expect(screen.getByText("78%")).toBeInTheDocument();
    });

    it("shows temperature when available", () => {
      render(<NetworkDeviceWidget device={mockNetworkDevice} />);

      expect(screen.getByText("Temperature")).toBeInTheDocument();
      expect(screen.getByText("55°C")).toBeInTheDocument();
    });

    it("displays last seen timestamp", () => {
      render(<NetworkDeviceWidget device={mockNetworkDevice} />);

      expect(screen.getByText(/Last seen:/)).toBeInTheDocument();
    });
  });

  describe("Status Colors", () => {
    it("applies correct color for warning metrics", () => {
      const warningDevice = {
        ...mockNetworkDevice,
        metrics: { ...mockNetworkDevice.metrics, cpuUsage: 75 },
      };

      const { container } = render(<NetworkDeviceWidget device={warningDevice} />);

      const warningBar = container.querySelector(".metric-warning");
      expect(warningBar).toBeInTheDocument();
    });

    it("applies correct color for critical metrics", () => {
      const criticalDevice = {
        ...mockNetworkDevice,
        metrics: { ...mockNetworkDevice.metrics, cpuUsage: 95 },
      };

      const { container } = render(<NetworkDeviceWidget device={criticalDevice} />);

      const criticalBar = container.querySelector(".metric-critical");
      expect(criticalBar).toBeInTheDocument();
    });
  });

  describe("Uptime Formatting", () => {
    it("formats uptime in days and hours", () => {
      render(<NetworkDeviceWidget device={mockNetworkDevice} />);
      expect(screen.getByText(/7d 5h/)).toBeInTheDocument();
    });

    it("formats uptime in hours and minutes when less than a day", () => {
      const device = {
        ...mockNetworkDevice,
        uptime: 3600 * 3 + 60 * 45, // 3h 45m
      };

      render(<NetworkDeviceWidget device={device} />);
      expect(screen.getByText(/3h 45m/)).toBeInTheDocument();
    });

    it("formats uptime in minutes when less than an hour", () => {
      const device = {
        ...mockNetworkDevice,
        uptime: 60 * 25, // 25 minutes
      };

      render(<NetworkDeviceWidget device={device} />);
      expect(screen.getByText(/25m/)).toBeInTheDocument();
    });
  });
});

describe("ServiceHealthWidget Component", () => {
  describe("Basic Functionality", () => {
    it("renders service information", () => {
      render(<ServiceHealthWidget service={mockService} />);

      expect(screen.getByText("API Gateway")).toBeInTheDocument();
      expect(screen.getByText(/v2\.1\.0/)).toBeInTheDocument();
      expect(screen.getByText("HEALTHY")).toBeInTheDocument();
    });

    it("displays response time", () => {
      render(<ServiceHealthWidget service={mockService} />);

      expect(screen.getByText("Response Time")).toBeInTheDocument();
      expect(screen.getByText("120ms")).toBeInTheDocument();
    });

    it("shows all endpoints", () => {
      render(<ServiceHealthWidget service={mockService} />);

      expect(screen.getByText("/api/platform/v1/admin/health")).toBeInTheDocument();
      expect(screen.getByText("/api/platform/v1/admin/users")).toBeInTheDocument();
      expect(screen.getByText("/api/platform/v1/admin/products")).toBeInTheDocument();
    });

    it("displays endpoint response times", () => {
      render(<ServiceHealthWidget service={mockService} />);

      expect(screen.getByText("50ms")).toBeInTheDocument();
      expect(screen.getByText("150ms")).toBeInTheDocument();
      expect(screen.getByText("350ms")).toBeInTheDocument();
    });
  });

  describe("Status Mapping", () => {
    it("maps healthy status to online indicator", () => {
      render(<ServiceHealthWidget service={mockService} />);

      const indicators = screen.getAllByTitle("Online");
      expect(indicators.length).toBeGreaterThan(0);
    });

    it("maps degraded status to warning indicator", () => {
      const degradedService = {
        ...mockService,
        status: "degraded" as const,
      };

      render(<ServiceHealthWidget service={degradedService} />);

      const indicators = screen.getAllByTitle("Warning");
      expect(indicators.length).toBeGreaterThan(0);
    });

    it("maps unhealthy status to critical indicator", () => {
      const unhealthyService = {
        ...mockService,
        status: "unhealthy" as const,
      };

      render(<ServiceHealthWidget service={unhealthyService} />);

      const indicator = screen.getByTitle("Critical");
      expect(indicator).toBeInTheDocument();
    });
  });
});

describe("RealTimeMetricsWidget Component", () => {
  describe("Basic Functionality", () => {
    it("renders widget title", () => {
      render(<RealTimeMetricsWidget title="System Metrics" metrics={mockMetrics} />);

      expect(screen.getByText("System Metrics")).toBeInTheDocument();
    });

    it("displays all metrics", () => {
      render(<RealTimeMetricsWidget title="Metrics" metrics={mockMetrics} />);

      expect(screen.getByText("Active Connections")).toBeInTheDocument();
      expect(screen.getByText("1,234")).toBeInTheDocument();
      expect(screen.getByText("Request Rate")).toBeInTheDocument();
      expect(screen.getByText("567")).toBeInTheDocument();
      expect(screen.getByText("Error Rate")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
    });

    it("shows metric units", () => {
      render(<RealTimeMetricsWidget title="Metrics" metrics={mockMetrics} />);

      expect(screen.getByText("req/s")).toBeInTheDocument();
      expect(screen.getByText("%")).toBeInTheDocument();
    });
  });

  describe("Trend Indicators", () => {
    it("shows up trend with correct icon", () => {
      render(<RealTimeMetricsWidget title="Metrics" metrics={mockMetrics} />);

      expect(screen.getByText("↗️")).toBeInTheDocument();
      expect(screen.getByText("12.5%")).toBeInTheDocument();
    });

    it("shows down trend with correct icon", () => {
      render(<RealTimeMetricsWidget title="Metrics" metrics={mockMetrics} />);

      expect(screen.getByText("↘️")).toBeInTheDocument();
      expect(screen.getByText("5.2%")).toBeInTheDocument();
    });

    it("shows stable trend with correct icon", () => {
      render(<RealTimeMetricsWidget title="Metrics" metrics={mockMetrics} />);

      expect(screen.getByText("→")).toBeInTheDocument();
    });
  });

  describe("Threshold Visualization", () => {
    it("renders threshold bars when thresholds are provided", () => {
      const { container } = render(<RealTimeMetricsWidget title="Metrics" metrics={mockMetrics} />);

      const thresholdBars = container.querySelectorAll(".metric-threshold-bar");
      expect(thresholdBars.length).toBeGreaterThan(0);
    });

    it("applies correct status colors based on thresholds", () => {
      const { container } = render(<RealTimeMetricsWidget title="Metrics" metrics={mockMetrics} />);

      const normalStatus = container.querySelector(".status-normal");
      expect(normalStatus).toBeInTheDocument();
    });
  });
});

// Security tests
describe("RealTimeWidget Security", () => {
  it("BaseRealTimeWidget passes security validation", async () => {
    const result = await renderSecurity(
      <BaseRealTimeWidget title="Secure Widget">Secure content</BaseRealTimeWidget>,
    );

    expect(result.container).toHaveNoSecurityViolations();
  });

  it("NetworkDeviceWidget passes security validation", async () => {
    const result = await renderSecurity(<NetworkDeviceWidget device={mockNetworkDevice} />);

    expect(result.container).toHaveNoSecurityViolations();
  });

  it("prevents XSS in device names", async () => {
    const xssDevice = {
      ...mockNetworkDevice,
      name: '<script>alert("xss")</script>',
    };

    const result = await renderSecurity(<NetworkDeviceWidget device={xssDevice} />);

    expect(result.container).toHaveNoSecurityViolations();
  });

  it("ServiceHealthWidget passes security validation", async () => {
    const result = await renderSecurity(<ServiceHealthWidget service={mockService} />);

    expect(result.container).toHaveNoSecurityViolations();
  });

  it("RealTimeMetricsWidget passes security validation", async () => {
    const result = await renderSecurity(
      <RealTimeMetricsWidget title="Metrics" metrics={mockMetrics} />,
    );

    expect(result.container).toHaveNoSecurityViolations();
  });
});

// Accessibility tests
describe("RealTimeWidget Accessibility", () => {
  beforeAll(() => {
    jest.useRealTimers();
  });

  it("BaseRealTimeWidget is accessible", async () => {
    await renderA11y(<BaseRealTimeWidget title="Accessible Widget">Content</BaseRealTimeWidget>);
  }, 30000);

  it("NetworkDeviceWidget is accessible", async () => {
    await renderA11y(<NetworkDeviceWidget device={mockNetworkDevice} />);
  }, 30000);

  it("ServiceHealthWidget is accessible", async () => {
    await renderA11y(<ServiceHealthWidget service={mockService} />);
  }, 30000);

  it("RealTimeMetricsWidget is accessible", async () => {
    await renderA11y(<RealTimeMetricsWidget title="Metrics" metrics={mockMetrics} />);
  }, 30000);

  it("refresh button has proper accessibility attributes", () => {
    const onRefresh = jest.fn();

    render(
      <BaseRealTimeWidget title="Test" onRefresh={onRefresh}>
        Content
      </BaseRealTimeWidget>,
    );

    const refreshButton = screen.getByTitle("Refresh now");
    expect(refreshButton).toHaveAttribute("type", "button");
    expect(refreshButton).toHaveAttribute("title", "Refresh now");
  });

  it("status indicators have descriptive titles", () => {
    render(<StatusIndicator status="online" />);

    const indicator = screen.getByTitle("Online");
    expect(indicator).toBeInTheDocument();
  });
});

// Performance tests
describe("RealTimeWidget Performance", () => {
  it("BaseRealTimeWidget renders within performance threshold", () => {
    const result = renderPerformance(
      <BaseRealTimeWidget title="Performance Test">Content</BaseRealTimeWidget>,
    );

    const metrics = result.measurePerformance();
    expect(metrics).toBePerformant(REALTIME_PERFORMANCE_BUDGET_MS);
  });

  it("NetworkDeviceWidget renders efficiently", () => {
    const result = renderPerformance(<NetworkDeviceWidget device={mockNetworkDevice} />);

    const metrics = result.measurePerformance();
    expect(metrics).toBePerformant(REALTIME_PERFORMANCE_BUDGET_MS);
  });

  it("handles frequent updates efficiently", () => {
    const { rerender } = render(<NetworkDeviceWidget device={mockNetworkDevice} />);

    const startTime = performance.now();

    // Simulate 10 rapid updates
    for (let i = 0; i < 10; i++) {
      rerender(
        <NetworkDeviceWidget
          device={{
            ...mockNetworkDevice,
            metrics: {
              ...mockNetworkDevice.metrics,
              cpuUsage: 45 + i,
            },
          }}
        />,
      );
    }

    const endTime = performance.now();
    expect(endTime - startTime).toBeLessThan(REALTIME_RERENDER_BUDGET_MS); // Should complete quickly even with rapid updates
  });

  it("RealTimeMetricsWidget handles many metrics efficiently", () => {
    const manyMetrics = Array.from({ length: 50 }, (_, i) => ({
      label: `Metric ${i}`,
      value: Math.random() * 100,
      trend: { direction: "up" as const, percentage: Math.random() * 10 },
      threshold: { warning: 70, critical: 90 },
    }));

    const result = renderPerformance(
      <RealTimeMetricsWidget title="Many Metrics" metrics={manyMetrics} />,
    );

    const metrics = result.measurePerformance();
    expect(metrics).toBePerformant(REALTIME_HEAVY_BUDGET_MS);
  });
});

// Comprehensive test
describe("RealTimeWidget Comprehensive Testing", () => {
  beforeAll(() => {
    jest.useRealTimers();
  });

  it("BaseRealTimeWidget passes all comprehensive tests", async () => {
    const onRefresh = jest.fn();
    const { result, metrics } = await renderComprehensive(
      <BaseRealTimeWidget
        title="Comprehensive Widget"
        subtitle="All features enabled"
        refreshInterval={30}
        onRefresh={onRefresh}
        lastUpdated={new Date()}
      >
        Complete widget content
      </BaseRealTimeWidget>,
    );

    await expect(result.container).toBeAccessible();
    expect(result.container).toHaveNoSecurityViolations();
    expect(metrics).toBePerformant(REALTIME_COMPREHENSIVE_BUDGET_MS);
    expect(result.container).toHaveValidMarkup();
  }, 30000);

  it("NetworkDeviceWidget passes all comprehensive tests", async () => {
    const { result, metrics } = await renderComprehensive(
      <NetworkDeviceWidget device={mockNetworkDevice} onRefresh={jest.fn()} />,
    );

    await expect(result.container).toBeAccessible();
    expect(result.container).toHaveNoSecurityViolations();
    expect(metrics).toBePerformant(REALTIME_COMPREHENSIVE_BUDGET_MS);
    expect(result.container).toHaveValidMarkup();
  }, 30000);

  it("ServiceHealthWidget passes all comprehensive tests", async () => {
    const { result, metrics } = await renderComprehensive(
      <ServiceHealthWidget service={mockService} onRefresh={jest.fn()} />,
    );

    await expect(result.container).toBeAccessible();
    expect(result.container).toHaveNoSecurityViolations();
    expect(metrics).toBePerformant(REALTIME_COMPREHENSIVE_BUDGET_MS);
    expect(result.container).toHaveValidMarkup();
  }, 30000);

  it("RealTimeMetricsWidget passes all comprehensive tests", async () => {
    const { result, metrics } = await renderComprehensive(
      <RealTimeMetricsWidget
        title="Complete Metrics"
        metrics={mockMetrics}
        onRefresh={jest.fn()}
      />,
    );

    await expect(result.container).toBeAccessible();
    expect(result.container).toHaveNoSecurityViolations();
    expect(metrics).toBePerformant(REALTIME_HEAVY_BUDGET_MS);
    expect(result.container).toHaveValidMarkup();
  }, 30000);
});
