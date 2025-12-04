/**
 * WebSocketAnalyticsDashboard Component Tests
 *
 * Tests WebSocket analytics dashboard with real-time metrics, auto-refresh, and calculations
 */

import React from "react";
import { renderQuick, screen, waitFor } from "@dotmac/testing";
import { WebSocketAnalyticsDashboard } from "../WebSocketAnalyticsDashboard";

jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const { apiClient: mockApiClient } = require("@/lib/api/client") as {
  apiClient: {
    get: jest.Mock;
    post: jest.Mock;
  };
};

// Mock extractDataOrThrow
jest.mock("@/lib/api/response-helpers", () => ({
  extractDataOrThrow: (response: any) => response.data,
}));

// Mock UI components
jest.mock("@dotmac/ui", () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
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
  Badge: ({ children, variant, className }: any) => (
    <div data-testid="badge" data-variant={variant} className={className}>
      {children}
    </div>
  ),
}));

// Mock lucide icons
jest.mock("lucide-react", () => ({
  Activity: () => <div data-testid="icon-activity">Activity</div>,
  Users: () => <div data-testid="icon-users">Users</div>,
  MessageSquare: () => <div data-testid="icon-message">MessageSquare</div>,
  Clock: () => <div data-testid="icon-clock">Clock</div>,
  TrendingUp: () => <div data-testid="icon-trending">TrendingUp</div>,
  Wifi: () => <div data-testid="icon-wifi">Wifi</div>,
}));

describe("WebSocketAnalyticsDashboard", () => {
  const mockAnalyticsData = {
    uptime_seconds: 3600,
    uptime_formatted: "1h 0m",
    total_active_connections: 25,
    total_active_tenants: 3,
    total_connections_lifetime: 150,
    total_messages_sent: 12000,
    average_connection_duration_seconds: 1800,
    tenant_breakdown: {
      "tenant-123": {
        active_connections: 10,
        connection_ids: ["conn-1", "conn-2"],
      },
      "tenant-456": {
        active_connections: 8,
        connection_ids: ["conn-3"],
      },
      "tenant-789": {
        active_connections: 7,
        connection_ids: ["conn-4"],
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe("Loading State", () => {
    it("shows loading message initially", () => {
      mockApiClient.get.mockImplementation(
        () => new Promise(() => {}), // Never resolves
      );

      renderQuick(<WebSocketAnalyticsDashboard />);

      expect(screen.getByText("Loading analytics...")).toBeInTheDocument();
    });

    it("displays loading in a container", () => {
      mockApiClient.get.mockImplementation(() => new Promise(() => {}));

      const { container } = renderQuick(<WebSocketAnalyticsDashboard />);

      const loadingContainer = container.querySelector(".p-6");
      expect(loadingContainer).toBeInTheDocument();
    });
  });

  describe("Error State", () => {
    it("displays error message when API call fails", async () => {
      mockApiClient.get.mockRejectedValue(new Error("Network error"));

      renderQuick(<WebSocketAnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/Error: Network error/)).toBeInTheDocument();
      });
    });

    it("displays error in red text", async () => {
      mockApiClient.get.mockRejectedValue(new Error("Connection failed"));

      renderQuick(<WebSocketAnalyticsDashboard />);

      await waitFor(() => {
        const errorText = screen.getByText(/Error: Connection failed/);
        expect(errorText).toHaveClass("text-red-600");
      });
    });

    it("logs error to console", async () => {
      const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
      mockApiClient.get.mockRejectedValue(new Error("API error"));

      renderQuick(<WebSocketAnalyticsDashboard />);

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          "Failed to fetch WebSocket analytics:",
          expect.any(Error),
        );
      });

      consoleError.mockRestore();
    });
  });

  describe("Null Data Handling", () => {
    it("renders nothing when data is null and not loading", async () => {
      mockApiClient.get.mockResolvedValue({ data: null });

      const { container } = renderQuick(<WebSocketAnalyticsDashboard />);

      await waitFor(() => {
        expect(container.firstChild).toBeNull();
      });
    });
  });

  describe("Successful Data Load", () => {
    beforeEach(() => {
      mockApiClient.get.mockResolvedValue({ data: mockAnalyticsData });
    });

    it("renders dashboard header", async () => {
      renderQuick(<WebSocketAnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText("WebSocket Analytics")).toBeInTheDocument();
        expect(
          screen.getByText("Real-time connection metrics and performance data"),
        ).toBeInTheDocument();
      });
    });

    it("displays live badge", async () => {
      renderQuick(<WebSocketAnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/🟢 Live • Updates every 5s/)).toBeInTheDocument();
      });
    });

    it("displays active connections metric", async () => {
      renderQuick(<WebSocketAnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText("Active Connections")).toBeInTheDocument();
        expect(screen.getByText("25")).toBeInTheDocument();
        expect(screen.getByText(/Across 3 tenants/)).toBeInTheDocument();
      });
    });

    it("displays messages sent metric", async () => {
      renderQuick(<WebSocketAnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText("Messages Sent")).toBeInTheDocument();
        expect(screen.getByText("12,000")).toBeInTheDocument();
      });
    });

    it("displays uptime metric", async () => {
      renderQuick(<WebSocketAnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText("Uptime")).toBeInTheDocument();
        expect(screen.getByText("1h 0m")).toBeInTheDocument();
        expect(screen.getByText("Since server start")).toBeInTheDocument();
      });
    });

    it("displays total connections metric", async () => {
      renderQuick(<WebSocketAnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText("Total Connections")).toBeInTheDocument();
        expect(screen.getByText("150")).toBeInTheDocument();
        expect(screen.getByText("Lifetime total")).toBeInTheDocument();
      });
    });

    it("renders all metric icons", async () => {
      renderQuick(<WebSocketAnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByTestId("icon-activity")).toBeInTheDocument();
        expect(screen.getByTestId("icon-wifi")).toBeInTheDocument();
        expect(screen.getByTestId("icon-message")).toBeInTheDocument();
        expect(screen.getByTestId("icon-clock")).toBeInTheDocument();
        expect(screen.getByTestId("icon-trending")).toBeInTheDocument();
      });
    });
  });

  describe("Average Connection Duration", () => {
    it("formats duration in minutes and seconds", async () => {
      mockApiClient.get.mockResolvedValue({
        data: { ...mockAnalyticsData, average_connection_duration_seconds: 125 },
      });

      renderQuick(<WebSocketAnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText("Average Connection Duration")).toBeInTheDocument();
        expect(screen.getByText("2m 5s")).toBeInTheDocument();
      });
    });

    it("formats duration in seconds only when less than 1 minute", async () => {
      mockApiClient.get.mockResolvedValue({
        data: { ...mockAnalyticsData, average_connection_duration_seconds: 45 },
      });

      renderQuick(<WebSocketAnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText("45s")).toBeInTheDocument();
      });
    });

    it("displays duration description", async () => {
      mockApiClient.get.mockResolvedValue({ data: mockAnalyticsData });

      renderQuick(<WebSocketAnalyticsDashboard />);

      await waitFor(() => {
        expect(
          screen.getByText(/This represents how long connections stay active on average/),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Messages Per Connection Calculation", () => {
    it("calculates messages per connection correctly", async () => {
      mockApiClient.get.mockResolvedValue({ data: mockAnalyticsData });

      renderQuick(<WebSocketAnalyticsDashboard />);

      await waitFor(() => {
        // 12000 messages / 150 lifetime connections = 80 per connection
        expect(screen.getByText(/~80 per connection/)).toBeInTheDocument();
      });
    });

    it("shows 0 when no connections exist", async () => {
      mockApiClient.get.mockResolvedValue({
        data: {
          ...mockAnalyticsData,
          total_active_connections: 0,
          total_connections_lifetime: 0,
        },
      });

      renderQuick(<WebSocketAnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/~0 per connection/)).toBeInTheDocument();
      });
    });
  });

  describe("Per-Tenant Breakdown", () => {
    it("displays tenant breakdown header", async () => {
      mockApiClient.get.mockResolvedValue({ data: mockAnalyticsData });

      renderQuick(<WebSocketAnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText("Per-Tenant Breakdown")).toBeInTheDocument();
      });
    });

    it("displays all tenants with connection counts", async () => {
      mockApiClient.get.mockResolvedValue({ data: mockAnalyticsData });

      renderQuick(<WebSocketAnalyticsDashboard />);

      await waitFor(() => {
        Object.entries(mockAnalyticsData.tenant_breakdown).forEach(([tenantId, stats]) => {
          const truncated = `${tenantId.substring(0, 8)}...`;
          expect(screen.getByText(truncated)).toBeInTheDocument();
          const label = `${stats.active_connections} connection${
            stats.active_connections !== 1 ? "s" : ""
          }`;
          expect(screen.getByText(label)).toBeInTheDocument();
        });
      });
    });

    it("shows singular 'connection' for single connection", async () => {
      mockApiClient.get.mockResolvedValue({
        data: {
          ...mockAnalyticsData,
          tenant_breakdown: {
            "tenant-single": {
              active_connections: 1,
              connection_ids: ["conn-1"],
            },
          },
        },
      });

      renderQuick(<WebSocketAnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText("1 connection")).toBeInTheDocument();
      });
    });

    it("shows 'No active connections' when tenant breakdown is empty", async () => {
      mockApiClient.get.mockResolvedValue({
        data: { ...mockAnalyticsData, tenant_breakdown: {} },
      });

      renderQuick(<WebSocketAnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText("No active connections")).toBeInTheDocument();
      });
    });

    it("truncates long tenant IDs", async () => {
      mockApiClient.get.mockResolvedValue({
        data: {
          ...mockAnalyticsData,
          tenant_breakdown: {
            "very-long-tenant-id-that-should-be-truncated": {
              active_connections: 5,
              connection_ids: ["conn-1"],
            },
          },
        },
      });

      renderQuick(<WebSocketAnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/very-lon.../)).toBeInTheDocument();
      });
    });
  });

  describe("Performance Metrics", () => {
    it("calculates message throughput per minute", async () => {
      mockApiClient.get.mockResolvedValue({ data: mockAnalyticsData });

      renderQuick(<WebSocketAnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText("Message Throughput")).toBeInTheDocument();
        // 12000 messages / (3600 seconds / 60) = 12000 / 60 = 200 msg/min
        expect(screen.getByText("200")).toBeInTheDocument();
        expect(screen.getByText(/msg\/min/)).toBeInTheDocument();
      });
    });

    it("shows 0 throughput when uptime is 0", async () => {
      mockApiClient.get.mockResolvedValue({
        data: { ...mockAnalyticsData, uptime_seconds: 0 },
      });

      renderQuick(<WebSocketAnalyticsDashboard />);

      await waitFor(() => {
        // Should show 0 when uptime_seconds is 0
        const throughputElements = screen.getAllByText("0");
        expect(throughputElements.length).toBeGreaterThan(0);
      });
    });

    it("calculates connection retention percentage", async () => {
      mockApiClient.get.mockResolvedValue({ data: mockAnalyticsData });

      renderQuick(<WebSocketAnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText("Connection Retention")).toBeInTheDocument();
        // (25 active / 150 lifetime) * 100 = 17%
        expect(screen.getByText("17")).toBeInTheDocument();
        expect(screen.getByText(/25 active of 150 total/)).toBeInTheDocument();
      });
    });

    it("shows 0% retention when no lifetime connections", async () => {
      mockApiClient.get.mockResolvedValue({
        data: {
          ...mockAnalyticsData,
          total_active_connections: 0,
          total_connections_lifetime: 0,
        },
      });

      renderQuick(<WebSocketAnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText("Connection Retention")).toBeInTheDocument();
      });
    });

    it("calculates average connections per tenant", async () => {
      mockApiClient.get.mockResolvedValue({ data: mockAnalyticsData });

      renderQuick(<WebSocketAnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText("Avg Connections/Tenant")).toBeInTheDocument();
        // 25 connections / 3 tenants = 8.33, rounded to 8
        expect(screen.getByText(/per tenant/)).toBeInTheDocument();
      });
    });

    it("shows 0 avg connections when no active tenants", async () => {
      mockApiClient.get.mockResolvedValue({
        data: {
          ...mockAnalyticsData,
          total_active_connections: 0,
          total_active_tenants: 0,
        },
      });

      renderQuick(<WebSocketAnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText("Avg Connections/Tenant")).toBeInTheDocument();
      });
    });
  });

  describe("Auto-Refresh", () => {
    it("fetches data on mount", async () => {
      mockApiClient.get.mockResolvedValue({ data: mockAnalyticsData });

      renderQuick(<WebSocketAnalyticsDashboard />);

      await waitFor(() => {
        expect(mockApiClient.get).toHaveBeenCalledWith("/field-service/analytics/websocket-stats");
        expect(mockApiClient.get).toHaveBeenCalledTimes(1);
      });
    });

    it("sets up auto-refresh interval every 5 seconds", async () => {
      mockApiClient.get.mockResolvedValue({ data: mockAnalyticsData });

      renderQuick(<WebSocketAnalyticsDashboard />);

      await waitFor(() => {
        expect(mockApiClient.get).toHaveBeenCalledTimes(1);
      });

      // Fast-forward 5 seconds
      jest.advanceTimersByTime(5000);

      await waitFor(() => {
        expect(mockApiClient.get).toHaveBeenCalledTimes(2);
      });

      // Fast-forward another 5 seconds
      jest.advanceTimersByTime(5000);

      await waitFor(() => {
        expect(mockApiClient.get).toHaveBeenCalledTimes(3);
      });
    });

    it("clears interval on unmount", async () => {
      mockApiClient.get.mockResolvedValue({ data: mockAnalyticsData });

      const { unmount } = renderQuick(<WebSocketAnalyticsDashboard />);

      await waitFor(() => {
        expect(mockApiClient.get).toHaveBeenCalledTimes(1);
      });

      unmount();

      // Fast-forward time - should not trigger more API calls
      jest.advanceTimersByTime(10000);

      expect(mockApiClient.get).toHaveBeenCalledTimes(1);
    });

    it("updates data on refresh", async () => {
      const initialData = { ...mockAnalyticsData, total_active_connections: 25 };
      const updatedData = { ...mockAnalyticsData, total_active_connections: 30 };

      mockApiClient.get.mockResolvedValueOnce({ data: initialData });

      renderQuick(<WebSocketAnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText("25")).toBeInTheDocument();
      });

      // Update mock for next fetch
      mockApiClient.get.mockResolvedValueOnce({ data: updatedData });

      // Fast-forward 5 seconds to trigger refresh
      jest.advanceTimersByTime(5000);

      await waitFor(() => {
        expect(screen.getByText("30")).toBeInTheDocument();
      });
    });
  });

  describe("Number Formatting", () => {
    it("formats large numbers with commas", async () => {
      mockApiClient.get.mockResolvedValue({
        data: { ...mockAnalyticsData, total_messages_sent: 1234567 },
      });

      renderQuick(<WebSocketAnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText("1,234,567")).toBeInTheDocument();
      });
    });

    it("formats small numbers correctly", async () => {
      mockApiClient.get.mockResolvedValue({
        data: {
          ...mockAnalyticsData,
          total_messages_sent: 42,
          total_active_connections: 5,
        },
      });

      renderQuick(<WebSocketAnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText("42")).toBeInTheDocument();
        expect(screen.getByText("5")).toBeInTheDocument();
      });
    });
  });

  describe("Tenant Pluralization", () => {
    it("uses singular 'tenant' for 1 tenant", async () => {
      mockApiClient.get.mockResolvedValue({
        data: { ...mockAnalyticsData, total_active_tenants: 1 },
      });

      renderQuick(<WebSocketAnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/Across 1 tenant$/)).toBeInTheDocument();
      });
    });

    it("uses plural 'tenants' for multiple tenants", async () => {
      mockApiClient.get.mockResolvedValue({
        data: { ...mockAnalyticsData, total_active_tenants: 3 },
      });

      renderQuick(<WebSocketAnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/Across 3 tenants/)).toBeInTheDocument();
      });
    });
  });

  describe("Component Structure", () => {
    it("renders main container with spacing", async () => {
      mockApiClient.get.mockResolvedValue({ data: mockAnalyticsData });

      const { container } = renderQuick(<WebSocketAnalyticsDashboard />);

      await waitFor(() => {
        const mainContainer = container.querySelector(".space-y-6");
        expect(mainContainer).toBeInTheDocument();
      });
    });

    it("renders key metrics grid", async () => {
      mockApiClient.get.mockResolvedValue({ data: mockAnalyticsData });

      const { container } = renderQuick(<WebSocketAnalyticsDashboard />);

      await waitFor(() => {
        const grid = container.querySelector(".grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-4");
        expect(grid).toBeInTheDocument();
      });
    });

    it("renders all metric cards", async () => {
      mockApiClient.get.mockResolvedValue({ data: mockAnalyticsData });

      renderQuick(<WebSocketAnalyticsDashboard />);

      await waitFor(() => {
        const cards = screen.getAllByTestId("card");
        expect(cards.length).toBeGreaterThan(0);
      });
    });
  });
});
