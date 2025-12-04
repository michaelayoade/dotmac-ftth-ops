/**
 * RealtimeAlerts Component Tests
 *
 * Tests background alert notification system with severity filtering
 */

import React from "react";
import { renderQuick, screen, waitFor, act } from "@dotmac/testing";
import { RealtimeAlerts, useAlertCount } from "../RealtimeAlerts";
import type { AlertEvent } from "@/types/realtime";

// Mock the hooks
const mockUseAlertEvents = jest.fn();
const mockToast = jest.fn();

jest.mock("@/hooks/useRealtime", () => ({
  useAlertEvents: (callback: (event: AlertEvent) => void, enabled?: boolean) =>
    mockUseAlertEvents(callback, enabled),
}));

jest.mock("@dotmac/ui", () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe("RealtimeAlerts", () => {
  let alertCallback: ((event: AlertEvent) => void) | null = null;

  beforeEach(() => {
    jest.clearAllMocks();

    // Capture the callback passed to useAlertEvents
    mockUseAlertEvents.mockImplementation((cb: (event: AlertEvent) => void) => {
      alertCallback = (event: AlertEvent) => {
        act(() => {
          cb(event);
        });
      };
    });
  });

  describe("Alert Filtering by Severity", () => {
    it("shows alerts at or above the minimum severity level", () => {
      const onAlert = jest.fn();

      renderQuick(<RealtimeAlerts minSeverity="warning" onAlert={onAlert} />);

      // Critical alert should be shown (above warning)
      const criticalAlert: AlertEvent = {
        alert_id: "alert-1",
        event_type: "alert.raised",
        severity: "critical",
        message: "System critical",
        source: "server-1",
        timestamp: new Date().toISOString(),
      };

      alertCallback!(criticalAlert);

      expect(onAlert).toHaveBeenCalledWith(criticalAlert);
      expect(mockToast).toHaveBeenCalled();
    });

    it("filters out alerts below minimum severity level", () => {
      const onAlert = jest.fn();

      renderQuick(<RealtimeAlerts minSeverity="error" onAlert={onAlert} />);

      // Warning alert should be filtered out
      const warningAlert: AlertEvent = {
        alert_id: "alert-2",
        event_type: "alert.raised",
        severity: "warning",
        message: "System warning",
        source: "server-2",
        timestamp: new Date().toISOString(),
      };

      alertCallback!(warningAlert);

      expect(onAlert).not.toHaveBeenCalled();
      expect(mockToast).not.toHaveBeenCalled();
    });

    it("filters info alerts when minSeverity is warning", () => {
      const onAlert = jest.fn();

      renderQuick(<RealtimeAlerts minSeverity="warning" onAlert={onAlert} />);

      const infoAlert: AlertEvent = {
        alert_id: "alert-3",
        event_type: "alert.raised",
        severity: "info",
        message: "Info message",
        source: "server-3",
        timestamp: new Date().toISOString(),
      };

      alertCallback!(infoAlert);

      expect(onAlert).not.toHaveBeenCalled();
      expect(mockToast).not.toHaveBeenCalled();
    });

    it("shows all alerts when minSeverity is info", () => {
      const onAlert = jest.fn();

      renderQuick(<RealtimeAlerts minSeverity="info" onAlert={onAlert} />);

      const infoAlert: AlertEvent = {
        alert_id: "alert-4",
        event_type: "alert.raised",
        severity: "info",
        message: "Info message",
        source: "server-4",
        timestamp: new Date().toISOString(),
      };

      alertCallback!(infoAlert);

      expect(onAlert).toHaveBeenCalledWith(infoAlert);
      expect(mockToast).toHaveBeenCalled();
    });
  });

  describe("Toast Notifications", () => {
    it("shows destructive toast for critical alerts", () => {
      renderQuick(<RealtimeAlerts />);

      const criticalAlert: AlertEvent = {
        alert_id: "alert-5",
        event_type: "alert.raised",
        severity: "critical",
        message: "Critical system failure",
        source: "database",
        timestamp: new Date().toISOString(),
      };

      alertCallback!(criticalAlert);

      expect(mockToast).toHaveBeenCalledWith({
        title: "Critical system failure",
        description: "Source: database",
        variant: "destructive",
      });
    });

    it("shows destructive toast for error alerts", () => {
      renderQuick(<RealtimeAlerts />);

      const errorAlert: AlertEvent = {
        alert_id: "alert-6",
        event_type: "alert.raised",
        severity: "error",
        message: "Database connection failed",
        source: "api-server",
        timestamp: new Date().toISOString(),
      };

      alertCallback!(errorAlert);

      expect(mockToast).toHaveBeenCalledWith({
        title: "Database connection failed",
        description: "Source: api-server",
        variant: "destructive",
      });
    });

    it("shows default toast for warning alerts", () => {
      renderQuick(<RealtimeAlerts />);

      const warningAlert: AlertEvent = {
        alert_id: "alert-7",
        event_type: "alert.raised",
        severity: "warning",
        message: "High memory usage",
        source: "app-server",
        timestamp: new Date().toISOString(),
      };

      alertCallback!(warningAlert);

      expect(mockToast).toHaveBeenCalledWith({
        title: "High memory usage",
        description: "Source: app-server",
        variant: "default",
      });
    });

    it("shows default toast for info alerts", () => {
      renderQuick(<RealtimeAlerts minSeverity="info" />);

      const infoAlert: AlertEvent = {
        alert_id: "alert-8",
        event_type: "alert.raised",
        severity: "info",
        message: "System update available",
        source: "update-service",
        timestamp: new Date().toISOString(),
      };

      alertCallback!(infoAlert);

      expect(mockToast).toHaveBeenCalledWith({
        title: "System update available",
        description: "Source: update-service",
        variant: "default",
      });
    });

    it("shows cleared toast when alert is cleared", () => {
      renderQuick(<RealtimeAlerts />);

      const clearedAlert: AlertEvent = {
        alert_id: "alert-9",
        event_type: "alert.cleared",
        severity: "warning",
        message: "High memory usage",
        source: "app-server",
        timestamp: new Date().toISOString(),
      };

      alertCallback!(clearedAlert);

      expect(mockToast).toHaveBeenCalledWith({
        title: "Alert Cleared",
        description: "High memory usage (Source: app-server)",
        variant: "default",
      });
    });
  });

  describe("Custom Alert Handler", () => {
    it("calls onAlert callback when provided", () => {
      const onAlert = jest.fn();

      renderQuick(<RealtimeAlerts onAlert={onAlert} />);

      const alert: AlertEvent = {
        alert_id: "alert-10",
        event_type: "alert.raised",
        severity: "error",
        message: "Test alert",
        source: "test",
        timestamp: new Date().toISOString(),
      };

      alertCallback!(alert);

      expect(onAlert).toHaveBeenCalledWith(alert);
    });

    it("works without onAlert callback", () => {
      renderQuick(<RealtimeAlerts />);

      const alert: AlertEvent = {
        alert_id: "alert-11",
        event_type: "alert.raised",
        severity: "error",
        message: "Test alert",
        source: "test",
        timestamp: new Date().toISOString(),
      };

      expect(() => {
        alertCallback!(alert);
      }).not.toThrow();

      expect(mockToast).toHaveBeenCalled();
    });
  });

  describe("Enabled State", () => {
    it("passes enabled prop to useAlertEvents hook", () => {
      renderQuick(<RealtimeAlerts enabled={true} />);

      expect(mockUseAlertEvents).toHaveBeenCalledWith(expect.any(Function), true);
    });

    it("passes disabled state to useAlertEvents hook", () => {
      renderQuick(<RealtimeAlerts enabled={false} />);

      expect(mockUseAlertEvents).toHaveBeenCalledWith(expect.any(Function), false);
    });

    it("defaults to enabled when not specified", () => {
      renderQuick(<RealtimeAlerts />);

      expect(mockUseAlertEvents).toHaveBeenCalledWith(expect.any(Function), true);
    });
  });

  describe("Component Rendering", () => {
    it("renders nothing (background component)", () => {
      const { container } = renderQuick(<RealtimeAlerts />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe("Default Props", () => {
    it("uses warning as default minimum severity", () => {
      const onAlert = jest.fn();

      renderQuick(<RealtimeAlerts onAlert={onAlert} />);

      // Info alert should be filtered out with default minSeverity
      const infoAlert: AlertEvent = {
        alert_id: "alert-12",
        event_type: "alert.raised",
        severity: "info",
        message: "Info",
        source: "test",
        timestamp: new Date().toISOString(),
      };

      alertCallback!(infoAlert);
      expect(onAlert).not.toHaveBeenCalled();

      // Warning alert should pass
      const warningAlert: AlertEvent = {
        alert_id: "alert-13",
        event_type: "alert.raised",
        severity: "warning",
        message: "Warning",
        source: "test",
        timestamp: new Date().toISOString(),
      };

      alertCallback!(warningAlert);
      expect(onAlert).toHaveBeenCalledWith(warningAlert);
    });
  });
});

describe("useAlertCount Hook", () => {
  let alertCallback: ((event: AlertEvent) => void) | null = null;

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseAlertEvents.mockImplementation((cb: (event: AlertEvent) => void) => {
      alertCallback = (event: AlertEvent) => {
        act(() => {
          cb(event);
        });
      };
    });
  });

  it("tracks active alerts count", () => {
    const TestComponent = () => {
      const { count, alerts } = useAlertCount();
      return (
        <div>
          <div data-testid="count">{count}</div>
          <div data-testid="alerts">{JSON.stringify(alerts)}</div>
        </div>
      );
    };

    renderQuick(<TestComponent />);

    expect(screen.getByTestId("count")).toHaveTextContent("0");

    // Add an alert
    const alert1: AlertEvent = {
      alert_id: "alert-1",
      event_type: "alert.raised",
      severity: "critical",
      message: "Alert 1",
      source: "test",
      timestamp: new Date().toISOString(),
    };

    alertCallback!(alert1);

    expect(screen.getByTestId("count")).toHaveTextContent("1");
  });

  it("removes alerts when cleared", () => {
    const TestComponent = () => {
      const { count } = useAlertCount();
      return <div data-testid="count">{count}</div>;
    };

    renderQuick(<TestComponent />);

    // Raise an alert
    const alert: AlertEvent = {
      alert_id: "alert-2",
      event_type: "alert.raised",
      severity: "error",
      message: "Alert 2",
      source: "test",
      timestamp: new Date().toISOString(),
    };

    alertCallback!(alert);
    expect(screen.getByTestId("count")).toHaveTextContent("1");

    // Clear the alert
    const clearedAlert: AlertEvent = {
      ...alert,
      event_type: "alert.cleared",
    };

    alertCallback!(clearedAlert);
    expect(screen.getByTestId("count")).toHaveTextContent("0");
  });

  it("tracks critical count correctly", () => {
    const TestComponent = () => {
      const { criticalCount } = useAlertCount();
      return <div data-testid="critical-count">{criticalCount}</div>;
    };

    renderQuick(<TestComponent />);

    expect(screen.getByTestId("critical-count")).toHaveTextContent("0");

    // Add critical alert
    alertCallback!({
      alert_id: "alert-3",
      event_type: "alert.raised",
      severity: "critical",
      message: "Critical",
      source: "test",
      timestamp: new Date().toISOString(),
    });

    expect(screen.getByTestId("critical-count")).toHaveTextContent("1");

    // Add error alert (should not increase critical count)
    alertCallback!({
      alert_id: "alert-4",
      event_type: "alert.raised",
      severity: "error",
      message: "Error",
      source: "test",
      timestamp: new Date().toISOString(),
    });

    expect(screen.getByTestId("critical-count")).toHaveTextContent("1");
  });

  it("tracks error count correctly", () => {
    const TestComponent = () => {
      const { errorCount } = useAlertCount();
      return <div data-testid="error-count">{errorCount}</div>;
    };

    renderQuick(<TestComponent />);

    expect(screen.getByTestId("error-count")).toHaveTextContent("0");

    // Add error alert
    alertCallback!({
      alert_id: "alert-5",
      event_type: "alert.raised",
      severity: "error",
      message: "Error",
      source: "test",
      timestamp: new Date().toISOString(),
    });

    expect(screen.getByTestId("error-count")).toHaveTextContent("1");

    // Add another error alert
    alertCallback!({
      alert_id: "alert-6",
      event_type: "alert.raised",
      severity: "error",
      message: "Error 2",
      source: "test",
      timestamp: new Date().toISOString(),
    });

    expect(screen.getByTestId("error-count")).toHaveTextContent("2");
  });

  it("returns alerts array with all active alerts", () => {
    const TestComponent = () => {
      const { alerts } = useAlertCount();
      return (
        <div>
          <div data-testid="alerts-length">{alerts.length}</div>
          {alerts.map((alert) => (
            <div key={alert.alert_id} data-testid={`alert-${alert.alert_id}`}>
              {alert.message}
            </div>
          ))}
        </div>
      );
    };

    renderQuick(<TestComponent />);

    // Add multiple alerts
    alertCallback!({
      alert_id: "alert-7",
      event_type: "alert.raised",
      severity: "critical",
      message: "Critical alert",
      source: "test",
      timestamp: new Date().toISOString(),
    });

    alertCallback!({
      alert_id: "alert-8",
      event_type: "alert.raised",
      severity: "warning",
      message: "Warning alert",
      source: "test",
      timestamp: new Date().toISOString(),
    });

    expect(screen.getByTestId("alerts-length")).toHaveTextContent("2");
    expect(screen.getByTestId("alert-alert-7")).toHaveTextContent("Critical alert");
    expect(screen.getByTestId("alert-alert-8")).toHaveTextContent("Warning alert");
  });

  it("handles duplicate alert IDs by replacing the previous alert", () => {
    const TestComponent = () => {
      const { count, alerts } = useAlertCount();
      return (
        <div>
          <div data-testid="count">{count}</div>
          <div data-testid="message">{alerts[0]?.message || "none"}</div>
        </div>
      );
    };

    renderQuick(<TestComponent />);

    // Add alert
    alertCallback!({
      alert_id: "alert-9",
      event_type: "alert.raised",
      severity: "error",
      message: "First message",
      source: "test",
      timestamp: new Date().toISOString(),
    });

    expect(screen.getByTestId("count")).toHaveTextContent("1");
    expect(screen.getByTestId("message")).toHaveTextContent("First message");

    // Add same alert ID with different message
    alertCallback!({
      alert_id: "alert-9",
      event_type: "alert.raised",
      severity: "error",
      message: "Updated message",
      source: "test",
      timestamp: new Date().toISOString(),
    });

    expect(screen.getByTestId("count")).toHaveTextContent("1");
    expect(screen.getByTestId("message")).toHaveTextContent("Updated message");
  });
});
