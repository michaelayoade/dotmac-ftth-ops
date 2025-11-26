/**
 * ConnectionStatusIndicator Component Tests
 *
 * Tests real-time connection health monitoring with multiple endpoints
 */

import React from "react";
import { renderQuick, screen, fireEvent } from "@dotmac/testing";
import { ConnectionStatusIndicator, CompactConnectionStatus } from "../ConnectionStatusIndicator";
import type { ConnectionStatus } from "@/types/realtime";

// Mock hooks and components
const mockUseRealtimeHealth = jest.fn();

// Shared mock data for all tests
const mockHealthData = {
  overallStatus: "connected" as ConnectionStatus,
  statuses: {
    onu: "connected" as ConnectionStatus,
    alerts: "connected" as ConnectionStatus,
    tickets: "connected" as ConnectionStatus,
    subscribers: "connected" as ConnectionStatus,
    sessions: "connected" as ConnectionStatus,
  },
  allConnected: true,
  anyError: false,
};

jest.mock("@/hooks/useRealtime", () => ({
  useRealtimeHealth: () => mockUseRealtimeHealth(),
}));

jest.mock("@dotmac/primitives", () => ({
  PulseIndicator: function PulseIndicator({ children, active }: any) {
    return React.createElement(
      "div",
      { "data-testid": "pulse-indicator", "data-active": String(active) },
      children,
    );
  },
}));

jest.mock("@dotmac/ui", () => ({
  Badge: ({ children, className }: any) => (
    <div data-testid="badge" className={className}>
      {children}
    </div>
  ),
  Button: ({ children, onClick, variant, size }: any) => (
    <button data-testid="button" onClick={onClick} data-variant={variant} data-size={size}>
      {children}
    </button>
  ),
  Card: ({ children, className }: any) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
}));

// Mock lucide icons
jest.mock("lucide-react", () => ({
  Activity: () => <div data-testid="icon-activity">Activity</div>,
  AlertCircle: () => <div data-testid="icon-alert-circle">AlertCircle</div>,
  CheckCircle: () => <div data-testid="icon-check-circle">CheckCircle</div>,
  RefreshCw: () => <div data-testid="icon-refresh">RefreshCw</div>,
  Wifi: () => <div data-testid="icon-wifi">Wifi</div>,
  WifiOff: () => <div data-testid="icon-wifi-off">WifiOff</div>,
  X: () => <div data-testid="icon-x">X</div>,
}));

describe("ConnectionStatusIndicator", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRealtimeHealth.mockReturnValue(mockHealthData);
  });

  describe("Compact Status Badge", () => {
    it("shows overall connection status by default", () => {
      renderQuick(<ConnectionStatusIndicator />);

      expect(screen.getByTestId("icon-check-circle")).toBeInTheDocument();
      expect(screen.getByText("Connected")).toBeInTheDocument();
    });

    it("shows different status icons based on overall status", () => {
      const statuses: ConnectionStatus[] = [
        "connected",
        "connecting",
        "reconnecting",
        "disconnected",
        "error",
      ];

      statuses.forEach((status) => {
        mockUseRealtimeHealth.mockReturnValue({
          ...mockHealthData,
          overallStatus: status,
        });

        const { unmount } = renderQuick(<ConnectionStatusIndicator />);

        if (status === "connected") {
          expect(screen.getByTestId("icon-check-circle")).toBeInTheDocument();
        } else if (status === "connecting" || status === "reconnecting") {
          expect(screen.getByTestId("icon-refresh")).toBeInTheDocument();
        } else if (status === "disconnected") {
          expect(screen.getByTestId("icon-wifi-off")).toBeInTheDocument();
        } else if (status === "error") {
          expect(screen.getByTestId("icon-alert-circle")).toBeInTheDocument();
        }

        unmount();
      });
    });
  });

  describe("Show/Hide Details", () => {
    it("hides details by default", () => {
      renderQuick(<ConnectionStatusIndicator />);

      expect(screen.queryByText("Real-Time Connections")).not.toBeInTheDocument();
    });

    it("shows details when compact badge is clicked", () => {
      renderQuick(<ConnectionStatusIndicator />);

      const badge = screen.getByTestId("badge");
      fireEvent.click(badge);

      expect(screen.getByText("Real-Time Connections")).toBeInTheDocument();
    });

    it("shows details initially when showDetails is true", () => {
      renderQuick(<ConnectionStatusIndicator showDetails={true} />);

      expect(screen.getByText("Real-Time Connections")).toBeInTheDocument();
    });

    it("hides details when close button is clicked", () => {
      renderQuick(<ConnectionStatusIndicator showDetails={true} />);

      expect(screen.getByText("Real-Time Connections")).toBeInTheDocument();

      const closeButton = screen.getByTestId("icon-x").parentElement;
      fireEvent.click(closeButton!);

      expect(screen.queryByText("Real-Time Connections")).not.toBeInTheDocument();
    });
  });

  describe("Detailed Connection Status", () => {
    it("displays all connection endpoints", () => {
      renderQuick(<ConnectionStatusIndicator showDetails={true} />);

      expect(screen.getByText("ONU Status")).toBeInTheDocument();
      expect(screen.getByText("Alerts")).toBeInTheDocument();
      expect(screen.getByText("Tickets")).toBeInTheDocument();
      expect(screen.getByText("Subscribers")).toBeInTheDocument();
      expect(screen.getByText("RADIUS Sessions")).toBeInTheDocument();
    });

    it("displays connection descriptions", () => {
      renderQuick(<ConnectionStatusIndicator showDetails={true} />);

      expect(screen.getByText("Device status updates")).toBeInTheDocument();
      expect(screen.getByText("System and network alerts")).toBeInTheDocument();
      expect(screen.getByText("Support ticket updates")).toBeInTheDocument();
      expect(screen.getByText("Subscriber lifecycle events")).toBeInTheDocument();
      expect(screen.getByText("Authentication sessions")).toBeInTheDocument();
    });

    it("shows overall status in details footer", () => {
      renderQuick(<ConnectionStatusIndicator showDetails={true} />);

      expect(screen.getByText("Overall Status")).toBeInTheDocument();
    });
  });

  describe("Connection Status Icons", () => {
    it("shows connected icon for connected endpoints", () => {
      mockUseRealtimeHealth.mockReturnValue({
        ...mockHealthData,
        statuses: {
          ...mockHealthData.statuses,
          onu: "connected",
        },
      });

      renderQuick(<ConnectionStatusIndicator showDetails={true} />);

      const wifiIcons = screen.getAllByTestId("icon-wifi");
      expect(wifiIcons.length).toBeGreaterThan(0);
    });

    it("shows error icon for error endpoints", () => {
      mockUseRealtimeHealth.mockReturnValue({
        ...mockHealthData,
        statuses: {
          ...mockHealthData.statuses,
          alerts: "error",
        },
      });

      renderQuick(<ConnectionStatusIndicator showDetails={true} />);

      const alertIcons = screen.getAllByTestId("icon-alert-circle");
      expect(alertIcons.length).toBeGreaterThan(0);
    });

    it("shows refresh icon for connecting endpoints", () => {
      mockUseRealtimeHealth.mockReturnValue({
        ...mockHealthData,
        statuses: {
          ...mockHealthData.statuses,
          tickets: "connecting",
        },
      });

      renderQuick(<ConnectionStatusIndicator showDetails={true} />);

      const refreshIcons = screen.getAllByTestId("icon-refresh");
      expect(refreshIcons.length).toBeGreaterThan(0);
    });

    it("shows wifi-off icon for disconnected endpoints", () => {
      mockUseRealtimeHealth.mockReturnValue({
        ...mockHealthData,
        statuses: {
          ...mockHealthData.statuses,
          subscribers: "disconnected",
        },
      });

      renderQuick(<ConnectionStatusIndicator showDetails={true} />);

      const wifiOffIcons = screen.getAllByTestId("icon-wifi-off");
      expect(wifiOffIcons.length).toBeGreaterThan(0);
    });
  });

  describe("Error Warning", () => {
    it("shows error warning when anyError is true", () => {
      mockUseRealtimeHealth.mockReturnValue({
        ...mockHealthData,
        anyError: true,
      });

      renderQuick(<ConnectionStatusIndicator showDetails={true} />);

      expect(screen.getByText("Connection Issue")).toBeInTheDocument();
      expect(
        screen.getByText(
          /Some real-time features may not be available\. Check your network connection\./,
        ),
      ).toBeInTheDocument();
    });

    it("hides error warning when anyError is false", () => {
      mockUseRealtimeHealth.mockReturnValue({
        ...mockHealthData,
        anyError: false,
      });

      renderQuick(<ConnectionStatusIndicator showDetails={true} />);

      expect(screen.queryByText("Connection Issue")).not.toBeInTheDocument();
    });
  });

  describe("Position Variants", () => {
    it("uses bottom-right position by default", () => {
      const { container } = renderQuick(<ConnectionStatusIndicator />);

      const wrapper = container.querySelector(".bottom-4.right-4");
      expect(wrapper).toBeInTheDocument();
    });

    it("applies top-right position", () => {
      const { container } = renderQuick(<ConnectionStatusIndicator position="top-right" />);

      const wrapper = container.querySelector(".top-4.right-4");
      expect(wrapper).toBeInTheDocument();
    });

    it("applies top-left position", () => {
      const { container } = renderQuick(<ConnectionStatusIndicator position="top-left" />);

      const wrapper = container.querySelector(".top-4.left-4");
      expect(wrapper).toBeInTheDocument();
    });

    it("applies bottom-left position", () => {
      const { container } = renderQuick(<ConnectionStatusIndicator position="bottom-left" />);

      const wrapper = container.querySelector(".bottom-4.left-4");
      expect(wrapper).toBeInTheDocument();
    });
  });

  describe("Inline Variant", () => {
    it("removes fixed positioning when inline is true", () => {
      const { container } = renderQuick(<ConnectionStatusIndicator inline={true} />);

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.classList.contains("fixed")).toBe(false);
    });

    it("applies fixed positioning when inline is false", () => {
      const { container } = renderQuick(<ConnectionStatusIndicator inline={false} />);

      const wrapper = container.querySelector(".fixed");
      expect(wrapper).toBeInTheDocument();
    });
  });

  describe("PulseIndicator Integration", () => {
    it("activates pulse for connected status", () => {
      mockUseRealtimeHealth.mockReturnValue({
        ...mockHealthData,
        overallStatus: "connected",
      });

      renderQuick(<ConnectionStatusIndicator />);

      const pulseIndicators = screen.getAllByTestId("pulse-indicator");
      const activePulse = pulseIndicators.find(
        (indicator) => indicator.getAttribute("data-active") === "true",
      );
      expect(activePulse).toBeDefined();
    });

    it("deactivates pulse for non-connected status", () => {
      mockUseRealtimeHealth.mockReturnValue({
        ...mockHealthData,
        overallStatus: "disconnected",
      });

      renderQuick(<ConnectionStatusIndicator />);

      const pulseIndicators = screen.getAllByTestId("pulse-indicator");
      const inactivePulse = pulseIndicators.find(
        (indicator) => indicator.getAttribute("data-active") === "false",
      );
      expect(inactivePulse).toBeDefined();
    });
  });

  describe("Keyboard Accessibility", () => {
    it("makes compact badge keyboard accessible", () => {
      renderQuick(<ConnectionStatusIndicator />);

      const badge = screen.getByTestId("badge");
      const wrapper = badge.closest("[role='button']");
      expect(wrapper).toHaveAttribute("role", "button");
      expect(wrapper).toHaveAttribute("tabIndex", "0");
    });
  });

  describe("Multiple Connection States", () => {
    it("handles mixed connection states correctly", () => {
      mockUseRealtimeHealth.mockReturnValue({
        overallStatus: "connecting" as ConnectionStatus,
        statuses: {
          onu: "connected" as ConnectionStatus,
          alerts: "connecting" as ConnectionStatus,
          tickets: "error" as ConnectionStatus,
          subscribers: "disconnected" as ConnectionStatus,
          sessions: "reconnecting" as ConnectionStatus,
        },
        allConnected: false,
        anyError: true,
      });

      renderQuick(<ConnectionStatusIndicator showDetails={true} />);

      // Check overall status is connecting
      const badges = screen.getAllByTestId("badge");
      const connectingBadge = badges.find((badge) => badge.textContent?.includes("Connecting"));
      expect(connectingBadge).toBeInTheDocument();

      // Check error warning is shown
      expect(screen.getByText("Connection Issue")).toBeInTheDocument();

      // Check individual statuses are displayed
      expect(screen.getByText("ONU Status")).toBeInTheDocument();
      expect(screen.getByText("Alerts")).toBeInTheDocument();
      expect(screen.getByText("Tickets")).toBeInTheDocument();
    });
  });
});

describe("CompactConnectionStatus", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows Live status when all connected", () => {
    mockUseRealtimeHealth.mockReturnValue({
      overallStatus: "connected" as ConnectionStatus,
      statuses: {
        onu: "connected" as ConnectionStatus,
        alerts: "connected" as ConnectionStatus,
        tickets: "connected" as ConnectionStatus,
        subscribers: "connected" as ConnectionStatus,
        sessions: "connected" as ConnectionStatus,
      },
      allConnected: true,
      anyError: false,
    });

    renderQuick(<CompactConnectionStatus />);

    expect(screen.getByTestId("icon-check-circle")).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("shows Connecting status when not all connected", () => {
    mockUseRealtimeHealth.mockReturnValue({
      overallStatus: "connecting" as ConnectionStatus,
      statuses: {
        onu: "connected" as ConnectionStatus,
        alerts: "connecting" as ConnectionStatus,
        tickets: "connected" as ConnectionStatus,
        subscribers: "connected" as ConnectionStatus,
        sessions: "connected" as ConnectionStatus,
      },
      allConnected: false,
      anyError: false,
    });

    renderQuick(<CompactConnectionStatus />);

    expect(screen.getByTestId("icon-alert-circle")).toBeInTheDocument();
    expect(screen.getByText("Connecting")).toBeInTheDocument();
  });

  it("uses CheckCircle icon when all connected", () => {
    mockUseRealtimeHealth.mockReturnValue({
      overallStatus: "connected" as ConnectionStatus,
      statuses: {
        onu: "connected" as ConnectionStatus,
        alerts: "connected" as ConnectionStatus,
        tickets: "connected" as ConnectionStatus,
        subscribers: "connected" as ConnectionStatus,
        sessions: "connected" as ConnectionStatus,
      },
      allConnected: true,
      anyError: false,
    });

    renderQuick(<CompactConnectionStatus />);

    expect(screen.getByTestId("icon-check-circle")).toBeInTheDocument();
  });

  it("uses AlertCircle icon when not all connected", () => {
    mockUseRealtimeHealth.mockReturnValue({
      overallStatus: "error" as ConnectionStatus,
      statuses: {
        onu: "connected" as ConnectionStatus,
        alerts: "error" as ConnectionStatus,
        tickets: "connected" as ConnectionStatus,
        subscribers: "connected" as ConnectionStatus,
        sessions: "connected" as ConnectionStatus,
      },
      allConnected: false,
      anyError: true,
    });

    renderQuick(<CompactConnectionStatus />);

    expect(screen.getByTestId("icon-alert-circle")).toBeInTheDocument();
  });
});

describe("StatusBadge Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows correct label for each status", () => {
    const statuses: { status: ConnectionStatus; label: string }[] = [
      { status: "connected", label: "Connected" },
      { status: "connecting", label: "Connecting" },
      { status: "reconnecting", label: "Reconnecting" },
      { status: "disconnected", label: "Disconnected" },
      { status: "error", label: "Error" },
    ];

    statuses.forEach(({ status, label }) => {
      mockUseRealtimeHealth.mockReturnValue({
        overallStatus: status,
        statuses: {
          onu: "connected" as ConnectionStatus,
          alerts: "connected" as ConnectionStatus,
          tickets: "connected" as ConnectionStatus,
          subscribers: "connected" as ConnectionStatus,
          sessions: "connected" as ConnectionStatus,
        },
        allConnected: true,
        anyError: false,
      });

      const { unmount } = renderQuick(<ConnectionStatusIndicator />);

      expect(screen.getByText(label)).toBeInTheDocument();

      unmount();
    });
  });

  it("applies animation to connecting and reconnecting states", () => {
    mockUseRealtimeHealth.mockReturnValue({
      overallStatus: "connecting" as ConnectionStatus,
      statuses: {
        onu: "connected" as ConnectionStatus,
        alerts: "connected" as ConnectionStatus,
        tickets: "connected" as ConnectionStatus,
        subscribers: "connected" as ConnectionStatus,
        sessions: "connected" as ConnectionStatus,
      },
      allConnected: false,
      anyError: false,
    });

    renderQuick(<ConnectionStatusIndicator />);

    const refreshIcon = screen.getByTestId("icon-refresh");
    expect(refreshIcon).toBeInTheDocument();
  });
});

describe("ConnectionRow Component", () => {
  it("shows pulse indicator for connected state", () => {
    mockUseRealtimeHealth.mockReturnValue({
      ...mockHealthData,
      statuses: {
        ...mockHealthData.statuses,
        onu: "connected",
      },
    });

    renderQuick(<ConnectionStatusIndicator showDetails={true} />);

    const pulseIndicators = screen.getAllByTestId("pulse-indicator");
    const activePulses = pulseIndicators.filter(
      (indicator) => indicator.getAttribute("data-active") === "true",
    );
    expect(activePulses.length).toBeGreaterThan(0);
  });

  it("displays correct icon for each connection state", () => {
    mockUseRealtimeHealth.mockReturnValue({
      overallStatus: "connecting" as ConnectionStatus,
      statuses: {
        onu: "connected" as ConnectionStatus,
        alerts: "error" as ConnectionStatus,
        tickets: "connecting" as ConnectionStatus,
        subscribers: "disconnected" as ConnectionStatus,
        sessions: "reconnecting" as ConnectionStatus,
      },
      allConnected: false,
      anyError: true,
    });

    renderQuick(<ConnectionStatusIndicator showDetails={true} />);

    // Should have wifi (connected), alert-circle (error), refresh (connecting/reconnecting), wifi-off (disconnected)
    expect(screen.getAllByTestId("icon-wifi").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("icon-alert-circle").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("icon-refresh").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("icon-wifi-off").length).toBeGreaterThan(0);
  });
});
