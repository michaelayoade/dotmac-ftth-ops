/**
 * LiveRadiusSessions Component Tests
 *
 * Tests real-time RADIUS session monitoring with WebSocket integration
 */

import React from "react";
import { renderQuick, screen, fireEvent, waitFor, act } from "@dotmac/testing";
import { LiveRadiusSessions } from "../LiveRadiusSessions";
import type { RADIUSSessionEvent } from "@/types/realtime";

// Mock hooks and components
const mockUseSessionsWebSocket = jest.fn();
const mockDisconnectSession = { mutateAsync: jest.fn() };
const mockUseNetworkDiagnostics = jest.fn(() => ({
  disconnectSession: mockDisconnectSession,
  isDisconnecting: false,
}));
const mockUseConfirmDialog = jest.fn();
const mockCompactConnectionStatus = jest.fn(() => (
  <div data-testid="compact-connection-status">Connection Status</div>
));

jest.mock("@/hooks/useRealtime", () => ({
  useSessionsWebSocket: (callback: (event: RADIUSSessionEvent) => void, enabled?: boolean) =>
    mockUseSessionsWebSocket(callback, enabled),
}));

jest.mock("@/hooks/useNetworkDiagnostics", () => ({
  useNetworkDiagnostics: () => mockUseNetworkDiagnostics(),
}));

jest.mock("@dotmac/ui", () => ({
  Card: ({ children, className }: any) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  Badge: ({ children, variant, className }: any) => (
    <div data-testid="badge" data-variant={variant} className={className}>
      {children}
    </div>
  ),
  Button: ({ children, onClick, disabled, variant, size, className }: any) => (
    <button
      data-testid="button"
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      data-size={size}
      className={className}
    >
      {children}
    </button>
  ),
  useConfirmDialog: () => mockUseConfirmDialog,
}));

jest.mock("../ConnectionStatusIndicator", () => ({
  CompactConnectionStatus: () => mockCompactConnectionStatus(),
}));

// Mock lucide icons
jest.mock("lucide-react", () => ({
  Activity: () => <div data-testid="icon-activity">Activity</div>,
  RefreshCw: () => <div data-testid="icon-refresh">Refresh</div>,
  TrendingDown: () => <div data-testid="icon-trending-down">TrendingDown</div>,
  TrendingUp: () => <div data-testid="icon-trending-up">TrendingUp</div>,
  Users: () => <div data-testid="icon-users">Users</div>,
  Wifi: () => <div data-testid="icon-wifi">Wifi</div>,
  Clock: () => <div data-testid="icon-clock">Clock</div>,
  XCircle: () => <div data-testid="icon-x-circle">XCircle</div>,
}));

describe("LiveRadiusSessions", () => {
  let sessionCallback: ((event: RADIUSSessionEvent) => void) | null = null;

  beforeEach(() => {
    jest.clearAllMocks();

    // Capture the callback passed to useSessionsWebSocket
    mockUseSessionsWebSocket.mockImplementation((cb: (event: RADIUSSessionEvent) => void) => {
      sessionCallback = (event: RADIUSSessionEvent) => {
        act(() => {
          cb(event);
        });
      };
      return {
        status: "connected",
        isConnected: true,
      };
    });

    // Default confirm dialog returns true
    mockUseConfirmDialog.mockResolvedValue(true);
  });

  describe("Session Event Handling", () => {
    it("adds new session when session.started event is received", () => {
      renderQuick(<LiveRadiusSessions />);

      const startedEvent: RADIUSSessionEvent = {
        session_id: "session-1",
        event_type: "session.started",
        username: "john.doe",
        nas_ip_address: "192.168.1.1",
        framed_ip_address: "10.0.0.1",
        bytes_in: 0,
        bytes_out: 0,
        session_time: 0,
        timestamp: new Date().toISOString(),
      };

      sessionCallback!(startedEvent);

      expect(screen.getByText("john.doe")).toBeInTheDocument();
      expect(screen.getByText("192.168.1.1")).toBeInTheDocument();
      expect(screen.getByText("10.0.0.1")).toBeInTheDocument();
    });

    it("updates existing session when session.updated event is received", () => {
      renderQuick(<LiveRadiusSessions />);

      // Start session
      sessionCallback!({
        session_id: "session-2",
        event_type: "session.started",
        username: "jane.smith",
        nas_ip_address: "192.168.1.2",
        framed_ip_address: "10.0.0.2",
        bytes_in: 1024,
        bytes_out: 2048,
        session_time: 60,
        timestamp: new Date().toISOString(),
      });

      expect(screen.getByTestId("session-rx-session-2")).toHaveTextContent("1.00 KB");

      // Update session
      sessionCallback!({
        session_id: "session-2",
        event_type: "session.updated",
        username: "jane.smith",
        nas_ip_address: "192.168.1.2",
        framed_ip_address: "10.0.0.2",
        bytes_in: 1048576, // 1 MB
        bytes_out: 2097152, // 2 MB
        session_time: 120,
        timestamp: new Date().toISOString(),
      });

      expect(screen.getByTestId("session-rx-session-2")).toHaveTextContent("1.00 MB");
      expect(screen.getByTestId("session-tx-session-2")).toHaveTextContent("2.00 MB");
    });

    it("removes session when session.stopped event is received", () => {
      renderQuick(<LiveRadiusSessions />);

      // Start session
      sessionCallback!({
        session_id: "session-3",
        event_type: "session.started",
        username: "bob.jones",
        nas_ip_address: "192.168.1.3",
        framed_ip_address: "10.0.0.3",
        bytes_in: 0,
        bytes_out: 0,
        session_time: 0,
        timestamp: new Date().toISOString(),
      });

      expect(screen.getByText("bob.jones")).toBeInTheDocument();

      // Stop session
      sessionCallback!({
        session_id: "session-3",
        event_type: "session.stopped",
        username: "bob.jones",
        nas_ip_address: "192.168.1.3",
        framed_ip_address: "10.0.0.3",
        bytes_in: 0,
        bytes_out: 0,
        session_time: 0,
        timestamp: new Date().toISOString(),
      });

      expect(screen.queryByText("bob.jones")).not.toBeInTheDocument();
    });

    it("does not update non-existent sessions", () => {
      renderQuick(<LiveRadiusSessions />);

      // Try to update a session that doesn't exist
      sessionCallback!({
        session_id: "non-existent",
        event_type: "session.updated",
        username: "ghost",
        nas_ip_address: "192.168.1.99",
        framed_ip_address: "10.0.0.99",
        bytes_in: 1024,
        bytes_out: 2048,
        session_time: 60,
        timestamp: new Date().toISOString(),
      });

      expect(screen.queryByText("ghost")).not.toBeInTheDocument();
    });
  });

  describe("Max Sessions Limit", () => {
    it("limits sessions to maxSessions count", () => {
      renderQuick(<LiveRadiusSessions maxSessions={2} />);

      // Add 3 sessions
      for (let i = 1; i <= 3; i++) {
        sessionCallback!({
          session_id: `session-${i}`,
          event_type: "session.started",
          username: `user-${i}`,
          nas_ip_address: `192.168.1.${i}`,
          framed_ip_address: `10.0.0.${i}`,
          bytes_in: 0,
          bytes_out: 0,
          session_time: 0,
          timestamp: new Date().toISOString(),
        });
      }

      // Only 2 sessions should be shown (user-2 and user-3)
      expect(screen.queryByText("user-1")).not.toBeInTheDocument();
      expect(screen.getByText("user-2")).toBeInTheDocument();
      expect(screen.getByText("user-3")).toBeInTheDocument();
    });

    it("shows warning when at max sessions limit", () => {
      renderQuick(<LiveRadiusSessions maxSessions={2} />);

      // Add 2 sessions
      for (let i = 1; i <= 2; i++) {
        sessionCallback!({
          session_id: `session-${i}`,
          event_type: "session.started",
          username: `user-${i}`,
          nas_ip_address: `192.168.1.${i}`,
          framed_ip_address: `10.0.0.${i}`,
          bytes_in: 0,
          bytes_out: 0,
          session_time: 0,
          timestamp: new Date().toISOString(),
        });
      }

      expect(screen.getByText(/Showing most recent 2 sessions/i)).toBeInTheDocument();
    });
  });

  describe("Compact View", () => {
    it("renders compact view when compact prop is true", () => {
      renderQuick(<LiveRadiusSessions compact={true} />);

      expect(screen.getByText("Active Sessions")).toBeInTheDocument();
      expect(screen.queryByText("Live RADIUS Sessions")).not.toBeInTheDocument();
    });

    it("shows summary stats in compact view", () => {
      renderQuick(<LiveRadiusSessions compact={true} />);

      sessionCallback!({
        session_id: "session-1",
        event_type: "session.started",
        username: "user-1",
        nas_ip_address: "192.168.1.1",
        framed_ip_address: "10.0.0.1",
        bytes_in: 1048576, // 1 MB
        bytes_out: 2097152, // 2 MB
        session_time: 60,
        timestamp: new Date().toISOString(),
      });

      expect(screen.getByTestId("compact-active-users")).toHaveTextContent("1");
      expect(screen.getByTestId("compact-total-rx")).toHaveTextContent("1.00 MB");
      expect(screen.getByTestId("compact-total-tx")).toHaveTextContent("2.00 MB");
    });
  });

  describe("Full View", () => {
    it("renders full view by default", () => {
      renderQuick(<LiveRadiusSessions />);

      expect(screen.getByText("Live RADIUS Sessions")).toBeInTheDocument();
      expect(screen.getByText("Real-time authentication session monitoring")).toBeInTheDocument();
    });

    it("shows connection status badge", () => {
      mockUseSessionsWebSocket.mockImplementation((cb) => {
        sessionCallback = cb;
        return {
          status: "connected",
          isConnected: true,
        };
      });

      renderQuick(<LiveRadiusSessions />);

      expect(screen.getByTestId("connection-status-label")).toHaveTextContent("Live");
    });

    it("shows disconnected badge when not connected", () => {
      mockUseSessionsWebSocket.mockImplementation((cb) => {
        sessionCallback = cb;
        return {
          status: "disconnected",
          isConnected: false,
        };
      });

      renderQuick(<LiveRadiusSessions />);

      expect(screen.getByTestId("connection-status-label")).toHaveTextContent("Disconnected");
    });

    it("shows statistics summary cards", () => {
      renderQuick(<LiveRadiusSessions />);

      expect(screen.getByText("Active Sessions")).toBeInTheDocument();
      expect(screen.getByText("Total RX")).toBeInTheDocument();
      expect(screen.getByText("Total TX")).toBeInTheDocument();
      expect(screen.getByText("Total Traffic")).toBeInTheDocument();
    });
  });

  describe("Empty State", () => {
    it("shows empty state when no sessions and connected", () => {
      mockUseSessionsWebSocket.mockImplementation((cb) => {
        sessionCallback = cb;
        return {
          status: "connected",
          isConnected: true,
        };
      });

      renderQuick(<LiveRadiusSessions />);

      expect(
        screen.getByText("No active sessions. Waiting for connections..."),
      ).toBeInTheDocument();
    });

    it("shows connect prompt when not connected and no sessions", () => {
      mockUseSessionsWebSocket.mockImplementation((cb) => {
        sessionCallback = cb;
        return {
          status: "disconnected",
          isConnected: false,
        };
      });

      renderQuick(<LiveRadiusSessions />);

      expect(screen.getByText("Connect to view live sessions")).toBeInTheDocument();
    });
  });

  describe("Session Disconnect", () => {
    it("shows disconnect button for each session", () => {
      renderQuick(<LiveRadiusSessions />);

      sessionCallback!({
        session_id: "session-1",
        event_type: "session.started",
        username: "user-1",
        nas_ip_address: "192.168.1.1",
        framed_ip_address: "10.0.0.1",
        bytes_in: 0,
        bytes_out: 0,
        session_time: 0,
        timestamp: new Date().toISOString(),
      });

      const disconnectButtons = screen.getAllByText("Disconnect");
      expect(disconnectButtons.length).toBeGreaterThan(0);
    });

    it("prompts for confirmation before disconnecting", async () => {
      renderQuick(<LiveRadiusSessions />);

      sessionCallback!({
        session_id: "session-1",
        event_type: "session.started",
        username: "user-1",
        nas_ip_address: "192.168.1.1",
        framed_ip_address: "10.0.0.1",
        bytes_in: 0,
        bytes_out: 0,
        session_time: 0,
        timestamp: new Date().toISOString(),
      });

      const disconnectButton = screen.getAllByText("Disconnect")[0];
      fireEvent.click(disconnectButton);

      await waitFor(() => {
        expect(mockUseConfirmDialog).toHaveBeenCalledWith({
          title: "Disconnect session",
          description: expect.stringContaining("user-1"),
          confirmText: "Disconnect",
          variant: "destructive",
        });
      });
    });

    it("disconnects session when confirmed", async () => {
      mockUseConfirmDialog.mockResolvedValue(true);
      mockDisconnectSession.mutateAsync.mockResolvedValue({});

      renderQuick(<LiveRadiusSessions />);

      sessionCallback!({
        session_id: "session-1",
        event_type: "session.started",
        username: "user-1",
        nas_ip_address: "192.168.1.1",
        framed_ip_address: "10.0.0.1",
        bytes_in: 0,
        bytes_out: 0,
        session_time: 0,
        timestamp: new Date().toISOString(),
      });

      const disconnectButton = screen.getAllByText("Disconnect")[0];
      fireEvent.click(disconnectButton);

      await waitFor(() => {
        expect(mockDisconnectSession.mutateAsync).toHaveBeenCalledWith({
          username: "user-1",
          acctsessionid: "session-1",
          nasipaddress: "192.168.1.1",
        });
      });
    });

    it("does not disconnect when cancelled", async () => {
      mockUseConfirmDialog.mockResolvedValue(false);

      renderQuick(<LiveRadiusSessions />);

      sessionCallback!({
        session_id: "session-1",
        event_type: "session.started",
        username: "user-1",
        nas_ip_address: "192.168.1.1",
        framed_ip_address: "10.0.0.1",
        bytes_in: 0,
        bytes_out: 0,
        session_time: 0,
        timestamp: new Date().toISOString(),
      });

      const disconnectButton = screen.getAllByText("Disconnect")[0];
      fireEvent.click(disconnectButton);

      await waitFor(() => {
        expect(mockUseConfirmDialog).toHaveBeenCalled();
      });

      expect(mockDisconnectSession.mutateAsync).not.toHaveBeenCalled();
    });

    it("disables disconnect button when disconnecting", () => {
      mockUseNetworkDiagnostics.mockReturnValue({
        disconnectSession: mockDisconnectSession,
        isDisconnecting: true,
      });

      renderQuick(<LiveRadiusSessions />);

      sessionCallback!({
        session_id: "session-1",
        event_type: "session.started",
        username: "user-1",
        nas_ip_address: "192.168.1.1",
        framed_ip_address: "10.0.0.1",
        bytes_in: 0,
        bytes_out: 0,
        session_time: 0,
        timestamp: new Date().toISOString(),
      });

      const disconnectButtons = screen.getAllByText("Disconnect");
      expect(disconnectButtons[0].closest("button")).toBeDisabled();
    });
  });

  describe("Statistics Calculations", () => {
    it("calculates total bytes correctly", () => {
      renderQuick(<LiveRadiusSessions />);

      sessionCallback!({
        session_id: "session-1",
        event_type: "session.started",
        username: "user-1",
        nas_ip_address: "192.168.1.1",
        framed_ip_address: "10.0.0.1",
        bytes_in: 1048576, // 1 MB
        bytes_out: 2097152, // 2 MB
        session_time: 0,
        timestamp: new Date().toISOString(),
      });

      sessionCallback!({
        session_id: "session-2",
        event_type: "session.started",
        username: "user-2",
        nas_ip_address: "192.168.1.2",
        framed_ip_address: "10.0.0.2",
        bytes_in: 1048576, // 1 MB
        bytes_out: 1048576, // 1 MB
        session_time: 0,
        timestamp: new Date().toISOString(),
      });

      expect(screen.getByTestId("summary-total-rx")).toHaveTextContent("2.00 MB");
      expect(screen.getByTestId("summary-total-tx")).toHaveTextContent("3.00 MB");
    });
  });

  describe("Enabled State", () => {
    it("passes enabled prop to useSessionsWebSocket", () => {
      renderQuick(<LiveRadiusSessions enabled={true} />);

      expect(mockUseSessionsWebSocket).toHaveBeenCalledWith(expect.any(Function), true);
    });

    it("passes disabled state to useSessionsWebSocket", () => {
      renderQuick(<LiveRadiusSessions enabled={false} />);

      expect(mockUseSessionsWebSocket).toHaveBeenCalledWith(expect.any(Function), false);
    });

    it("defaults to enabled when not specified", () => {
      renderQuick(<LiveRadiusSessions />);

      expect(mockUseSessionsWebSocket).toHaveBeenCalledWith(expect.any(Function), true);
    });
  });

  describe("Session Table", () => {
    it("displays session details in table", () => {
      renderQuick(<LiveRadiusSessions />);

      sessionCallback!({
        session_id: "session-1",
        event_type: "session.started",
        username: "john.doe",
        nas_ip_address: "192.168.1.100",
        framed_ip_address: "10.0.0.50",
        bytes_in: 1048576, // 1 MB
        bytes_out: 2097152, // 2 MB
        session_time: 3600, // 1 hour
        timestamp: new Date().toISOString(),
      });

      expect(screen.getByTestId("session-username-session-1")).toHaveTextContent("john.doe");
      expect(screen.getByTestId("session-nas-session-1")).toHaveTextContent("192.168.1.100");
      expect(screen.getByTestId("session-framed-session-1")).toHaveTextContent("10.0.0.50");
      expect(screen.getByTestId("session-rx-session-1")).toHaveTextContent("1.00 MB");
      expect(screen.getByTestId("session-tx-session-1")).toHaveTextContent("2.00 MB");
      expect(screen.getByTestId("session-duration-session-1")).toHaveTextContent("1h 0m");
    });

    it("shows N/A for missing framed IP address", () => {
      renderQuick(<LiveRadiusSessions />);

      sessionCallback!({
        session_id: "session-1",
        event_type: "session.started",
        username: "user-1",
        nas_ip_address: "192.168.1.1",
        framed_ip_address: "",
        bytes_in: 0,
        bytes_out: 0,
        session_time: 0,
        timestamp: new Date().toISOString(),
      });

      expect(screen.getByText("N/A")).toBeInTheDocument();
    });
  });

  describe("Default Props", () => {
    it("uses 100 as default max sessions", () => {
      renderQuick(<LiveRadiusSessions />);

      // Add 101 sessions and verify warning doesn't show
      for (let i = 1; i <= 101; i++) {
        sessionCallback!({
          session_id: `session-${i}`,
          event_type: "session.started",
          username: `user-${i}`,
          nas_ip_address: `192.168.1.${i}`,
          framed_ip_address: `10.0.0.${i}`,
          bytes_in: 0,
          bytes_out: 0,
          session_time: 0,
          timestamp: new Date().toISOString(),
        });
      }

      expect(screen.getByText(/Showing most recent 100 sessions/i)).toBeInTheDocument();
    });

    it("uses compact=false by default", () => {
      renderQuick(<LiveRadiusSessions />);

      expect(screen.getByText("Live RADIUS Sessions")).toBeInTheDocument();
    });
  });
});
