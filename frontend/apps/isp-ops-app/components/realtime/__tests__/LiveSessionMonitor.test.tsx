/**
 * LiveSessionMonitor Component Tests
 *
 * Tests real-time session monitoring with WebSocket subscription
 */

import React from "react";
import { renderWithTimers, screen, waitFor, act } from "@dotmac/testing";
import { LiveSessionMonitor } from "../LiveSessionMonitor";

interface SessionUpdate {
  action: "new" | "update" | "terminate";
  session: {
    session_id: string;
    username: string;
    ip_address: string;
    nas_ip_address: string;
    upload_bytes: number;
    download_bytes: number;
    session_time_seconds: number;
    last_update: string;
  };
}

// Mock hooks
const mockUseWebSocket = jest.fn(() => ({ isConnected: true }));
const mockUseWebSocketSubscription = jest.fn(() => [null]);

jest.mock("@/lib/websocket/WebSocketProvider", () => ({
  useWebSocket: () => mockUseWebSocket(),
  useWebSocketSubscription: <T,>(channel: string) => mockUseWebSocketSubscription(channel),
}));

// Mock UI components
jest.mock("@dotmac/ui", () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
  CardDescription: ({ children }: any) => <div data-testid="card-description">{children}</div>,
  CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
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
  Button: ({ children, onClick }: any) => (
    <button data-testid="button" onClick={onClick}>
      {children}
    </button>
  ),
  Table: ({ children }: any) => <table data-testid="table">{children}</table>,
  TableBody: ({ children }: any) => <tbody data-testid="table-body">{children}</tbody>,
  TableCell: ({ children, colSpan, className }: any) => (
    <td data-testid="table-cell" colSpan={colSpan} className={className}>
      {children}
    </td>
  ),
  TableHead: ({ children, className }: any) => (
    <th data-testid="table-head" className={className}>
      {children}
    </th>
  ),
  TableHeader: ({ children }: any) => <thead data-testid="table-header">{children}</thead>,
  TableRow: ({ children }: any) => <tr data-testid="table-row">{children}</tr>,
}));

// Mock lucide icons
jest.mock("lucide-react", () => ({
  Users: () => <div data-testid="icon-users">Users</div>,
  Wifi: () => <div data-testid="icon-wifi">Wifi</div>,
  RefreshCw: () => <div data-testid="icon-refresh">Refresh</div>,
  TrendingUp: () => <div data-testid="icon-trending-up">TrendingUp</div>,
  TrendingDown: () => <div data-testid="icon-trending-down">TrendingDown</div>,
}));

// Mock date-fns
jest.mock("date-fns", () => ({
  formatDistanceToNow: (date: Date) => "2 minutes ago",
}));

describe("LiveSessionMonitor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWebSocket.mockReturnValue({ isConnected: true });
    mockUseWebSocketSubscription.mockReturnValue([null]);
  });

  describe("Initial State", () => {
    it("renders with no sessions", () => {
      renderWithTimers(<LiveSessionMonitor />);

      expect(screen.getByText("Active Sessions")).toBeInTheDocument();
      expect(screen.getByText("No active sessions")).toBeInTheDocument();
    });

    it("shows WebSocket connection status badge", () => {
      mockUseWebSocket.mockReturnValue({ isConnected: true });

      renderWithTimers(<LiveSessionMonitor />);

      expect(screen.getByTestId("connection-status-label")).toHaveTextContent("Live");
    });

    it("shows simulated badge when not connected", () => {
      mockUseWebSocket.mockReturnValue({ isConnected: false });
      const sessionUpdate: SessionUpdate = {
        action: "new",
        session: {
          session_id: "session-1",
          username: "user-1",
          ip_address: "10.0.0.1",
          nas_ip_address: "192.168.1.1",
          upload_bytes: 0,
          download_bytes: 0,
          session_time_seconds: 0,
          last_update: new Date().toISOString(),
        },
      };
      mockUseWebSocketSubscription.mockReturnValue([sessionUpdate]);

      renderWithTimers(<LiveSessionMonitor />);

      expect(screen.getByTestId("connection-status-label")).toHaveTextContent("Simulated");
    });
  });

  describe("Disconnected State", () => {
    it("shows waiting message when disconnected with no sessions", () => {
      mockUseWebSocket.mockReturnValue({ isConnected: false });
      mockUseWebSocketSubscription.mockReturnValue([null]);

      renderWithTimers(<LiveSessionMonitor />);

      expect(screen.getByText("Live Session Monitor")).toBeInTheDocument();
      expect(screen.getByText("Waiting for a live session stream…")).toBeInTheDocument();
      expect(
        screen.getByText(
          /WebSocket connection is offline\. Once telemetry resumes, active sessions will appear here\./,
        ),
      ).toBeInTheDocument();
    });

    it("shows simulated data message when disconnected with sessions", () => {
      mockUseWebSocket.mockReturnValue({ isConnected: false });

      const sessionUpdate: SessionUpdate = {
        action: "new",
        session: {
          session_id: "session-1",
          username: "john.doe",
          ip_address: "10.0.0.1",
          nas_ip_address: "192.168.1.1",
          upload_bytes: 0,
          download_bytes: 0,
          session_time_seconds: 0,
          last_update: new Date().toISOString(),
        },
      };

      mockUseWebSocketSubscription.mockReturnValue([sessionUpdate]);

      renderWithTimers(<LiveSessionMonitor />);

      expect(
        screen.getByText(/Showing simulated data\. Connect to WebSocket for live updates\./),
      ).toBeInTheDocument();
    });
  });

  describe("Session Updates", () => {
    it("adds new session when action is 'new'", () => {
      const sessionUpdate: SessionUpdate = {
        action: "new",
        session: {
          session_id: "session-1",
          username: "john.doe",
          ip_address: "10.0.0.1",
          nas_ip_address: "192.168.1.1",
          upload_bytes: 1048576, // 1 MB
          download_bytes: 2097152, // 2 MB
          session_time_seconds: 60,
          last_update: new Date().toISOString(),
        },
      };

      mockUseWebSocketSubscription.mockReturnValue([sessionUpdate]);

      renderWithTimers(<LiveSessionMonitor />);

      expect(screen.getByText("john.doe")).toBeInTheDocument();
      expect(screen.getByText("10.0.0.1")).toBeInTheDocument();
      expect(screen.getByTestId("session-upload-session-1")).toHaveTextContent("1.00 MB");
      expect(screen.getByTestId("session-download-session-1")).toHaveTextContent("2.00 MB");
    });

    it("updates existing session when action is 'update'", () => {
      const initialSession: SessionUpdate = {
        action: "new",
        session: {
          session_id: "session-1",
          username: "jane.smith",
          ip_address: "10.0.0.2",
          nas_ip_address: "192.168.1.2",
          upload_bytes: 1024,
          download_bytes: 2048,
          session_time_seconds: 30,
          last_update: new Date().toISOString(),
        },
      };

      mockUseWebSocketSubscription.mockReturnValue([initialSession]);

      const { rerender } = renderWithTimers(<LiveSessionMonitor />);

      expect(screen.getByText("jane.smith")).toBeInTheDocument();

      // Update the session
      const updatedSession: SessionUpdate = {
        action: "update",
        session: {
          session_id: "session-1",
          username: "jane.smith",
          ip_address: "10.0.0.2",
          nas_ip_address: "192.168.1.2",
          upload_bytes: 1048576, // 1 MB
          download_bytes: 2097152, // 2 MB
          session_time_seconds: 120,
          last_update: new Date().toISOString(),
        },
      };

      mockUseWebSocketSubscription.mockReturnValue([updatedSession]);

      rerender(<LiveSessionMonitor />);

      expect(screen.getByTestId("session-upload-session-1")).toHaveTextContent("1.00 MB");
      expect(screen.getByTestId("session-download-session-1")).toHaveTextContent("2.00 MB");
    });

    it("removes session when action is 'terminate'", () => {
      const newSession: SessionUpdate = {
        action: "new",
        session: {
          session_id: "session-1",
          username: "bob.jones",
          ip_address: "10.0.0.3",
          nas_ip_address: "192.168.1.3",
          upload_bytes: 0,
          download_bytes: 0,
          session_time_seconds: 0,
          last_update: new Date().toISOString(),
        },
      };

      mockUseWebSocketSubscription.mockReturnValue([newSession]);

      const { rerender } = renderWithTimers(<LiveSessionMonitor />);

      expect(screen.getByText("bob.jones")).toBeInTheDocument();

      // Terminate the session
      const terminateSession: SessionUpdate = {
        action: "terminate",
        session: {
          session_id: "session-1",
          username: "bob.jones",
          ip_address: "10.0.0.3",
          nas_ip_address: "192.168.1.3",
          upload_bytes: 0,
          download_bytes: 0,
          session_time_seconds: 0,
          last_update: new Date().toISOString(),
        },
      };

      mockUseWebSocketSubscription.mockReturnValue([terminateSession]);

      rerender(<LiveSessionMonitor />);

      expect(screen.queryByText("bob.jones")).not.toBeInTheDocument();
    });
  });

  describe("Recent Change Indicator", () => {
    it("shows increase indicator for new sessions", () => {
      const sessionUpdate: SessionUpdate = {
        action: "new",
        session: {
          session_id: "session-1",
          username: "user-1",
          ip_address: "10.0.0.1",
          nas_ip_address: "192.168.1.1",
          upload_bytes: 0,
          download_bytes: 0,
          session_time_seconds: 0,
          last_update: new Date().toISOString(),
        },
      };

      mockUseWebSocketSubscription.mockReturnValue([sessionUpdate]);

      renderWithTimers(<LiveSessionMonitor />);

      expect(screen.getByTestId("icon-trending-up")).toBeInTheDocument();
    });

    it("shows decrease indicator for terminated sessions", () => {
      const terminateSession: SessionUpdate = {
        action: "terminate",
        session: {
          session_id: "session-1",
          username: "user-1",
          ip_address: "10.0.0.1",
          nas_ip_address: "192.168.1.1",
          upload_bytes: 0,
          download_bytes: 0,
          session_time_seconds: 0,
          last_update: new Date().toISOString(),
        },
      };

      mockUseWebSocketSubscription.mockReturnValue([terminateSession]);

      renderWithTimers(<LiveSessionMonitor />);

      expect(screen.getByTestId("icon-trending-down")).toBeInTheDocument();
    });

    it("clears change indicator after 2 seconds", async () => {
      const sessionUpdate: SessionUpdate = {
        action: "new",
        session: {
          session_id: "session-1",
          username: "user-1",
          ip_address: "10.0.0.1",
          nas_ip_address: "192.168.1.1",
          upload_bytes: 0,
          download_bytes: 0,
          session_time_seconds: 0,
          last_update: new Date().toISOString(),
        },
      };

      mockUseWebSocketSubscription.mockReturnValue([sessionUpdate]);

      const { advanceTimers } = renderWithTimers(<LiveSessionMonitor />);

      expect(screen.getByTestId("icon-trending-up")).toBeInTheDocument();

      // Fast-forward 2 seconds
      act(() => {
        advanceTimers(2000);
      });

      await waitFor(() => {
        expect(screen.queryByTestId("icon-trending-up")).not.toBeInTheDocument();
      });
    });
  });

  describe("Statistics Calculations", () => {
    it("calculates active users count correctly", () => {
      const session1: SessionUpdate = {
        action: "new",
        session: {
          session_id: "session-1",
          username: "user-1",
          ip_address: "10.0.0.1",
          nas_ip_address: "192.168.1.1",
          upload_bytes: 0,
          download_bytes: 0,
          session_time_seconds: 0,
          last_update: new Date().toISOString(),
        },
      };

      mockUseWebSocketSubscription.mockReturnValue([session1]);

      const { rerender } = renderWithTimers(<LiveSessionMonitor />);

      expect(screen.getByText("Active Users")).toBeInTheDocument();
      // Count appears multiple times - in badge and stats
      expect(screen.getByTestId("active-users-count")).toHaveTextContent("1");

      // Add another session
      const session2: SessionUpdate = {
        action: "new",
        session: {
          session_id: "session-2",
          username: "user-2",
          ip_address: "10.0.0.2",
          nas_ip_address: "192.168.1.2",
          upload_bytes: 0,
          download_bytes: 0,
          session_time_seconds: 0,
          last_update: new Date().toISOString(),
        },
      };

      mockUseWebSocketSubscription.mockReturnValue([session2]);
      rerender(<LiveSessionMonitor />);

      expect(screen.getByTestId("active-users-count")).toHaveTextContent("2");
    });

    it("calculates total upload correctly", () => {
      const session1: SessionUpdate = {
        action: "new",
        session: {
          session_id: "session-1",
          username: "user-1",
          ip_address: "10.0.0.1",
          nas_ip_address: "192.168.1.1",
          upload_bytes: 1073741824, // 1 GB
          download_bytes: 0,
          session_time_seconds: 0,
          last_update: new Date().toISOString(),
        },
      };

      mockUseWebSocketSubscription.mockReturnValue([session1]);

      const { rerender } = renderWithTimers(<LiveSessionMonitor />);

      expect(screen.getByText("Total Upload")).toBeInTheDocument();
      expect(screen.getByTestId("total-upload")).toHaveTextContent("1.00 GB");

      // Add another session
      const session2: SessionUpdate = {
        action: "new",
        session: {
          session_id: "session-2",
          username: "user-2",
          ip_address: "10.0.0.2",
          nas_ip_address: "192.168.1.2",
          upload_bytes: 1073741824, // 1 GB
          download_bytes: 0,
          session_time_seconds: 0,
          last_update: new Date().toISOString(),
        },
      };

      mockUseWebSocketSubscription.mockReturnValue([session2]);
      rerender(<LiveSessionMonitor />);

      expect(screen.getByTestId("total-upload")).toHaveTextContent("2.00 GB");
    });

    it("calculates total download correctly", () => {
      const session: SessionUpdate = {
        action: "new",
        session: {
          session_id: "session-1",
          username: "user-1",
          ip_address: "10.0.0.1",
          nas_ip_address: "192.168.1.1",
          upload_bytes: 0,
          download_bytes: 2097152, // 2 MB
          session_time_seconds: 0,
          last_update: new Date().toISOString(),
        },
      };

      mockUseWebSocketSubscription.mockReturnValue([session]);

      renderWithTimers(<LiveSessionMonitor />);

      expect(screen.getByText("Total Download")).toBeInTheDocument();
      expect(screen.getByTestId("total-download")).toHaveTextContent("2.00 MB");
    });
  });

  describe("Session Sorting", () => {
    it("sorts sessions by session_time_seconds in descending order", () => {
      const session1: SessionUpdate = {
        action: "new",
        session: {
          session_id: "session-1",
          username: "user-1",
          ip_address: "10.0.0.1",
          nas_ip_address: "192.168.1.1",
          upload_bytes: 0,
          download_bytes: 0,
          session_time_seconds: 60,
          last_update: new Date().toISOString(),
        },
      };

      const session2: SessionUpdate = {
        action: "new",
        session: {
          session_id: "session-2",
          username: "user-2",
          ip_address: "10.0.0.2",
          nas_ip_address: "192.168.1.2",
          upload_bytes: 0,
          download_bytes: 0,
          session_time_seconds: 120,
          last_update: new Date().toISOString(),
        },
      };

      mockUseWebSocketSubscription.mockReturnValue([session1]);

      const { rerender } = renderWithTimers(<LiveSessionMonitor />);

      mockUseWebSocketSubscription.mockReturnValue([session2]);
      rerender(<LiveSessionMonitor />);

      const tableCells = screen.getAllByTestId("table-cell");
      const usernames = tableCells.filter((cell) =>
        ["user-1", "user-2"].includes(cell.textContent || ""),
      );

      // user-2 (120s) should appear before user-1 (60s)
      expect(usernames[0]).toHaveTextContent("user-2");
      expect(usernames[1]).toHaveTextContent("user-1");
    });
  });

  describe("Duration Formatting", () => {
    it("formats duration in hours and minutes for long sessions", () => {
      const session: SessionUpdate = {
        action: "new",
        session: {
          session_id: "session-1",
          username: "user-1",
          ip_address: "10.0.0.1",
          nas_ip_address: "192.168.1.1",
          upload_bytes: 0,
          download_bytes: 0,
          session_time_seconds: 3660, // 1h 1m
          last_update: new Date().toISOString(),
        },
      };

      mockUseWebSocketSubscription.mockReturnValue([session]);

      renderWithTimers(<LiveSessionMonitor />);

      expect(screen.getByText("1h 1m")).toBeInTheDocument();
    });

    it("formats duration in minutes and seconds for medium sessions", () => {
      const session: SessionUpdate = {
        action: "new",
        session: {
          session_id: "session-1",
          username: "user-1",
          ip_address: "10.0.0.1",
          nas_ip_address: "192.168.1.1",
          upload_bytes: 0,
          download_bytes: 0,
          session_time_seconds: 90, // 1m 30s
          last_update: new Date().toISOString(),
        },
      };

      mockUseWebSocketSubscription.mockReturnValue([session]);

      renderWithTimers(<LiveSessionMonitor />);

      expect(screen.getByText("1m 30s")).toBeInTheDocument();
    });

    it("formats duration in seconds for short sessions", () => {
      const session: SessionUpdate = {
        action: "new",
        session: {
          session_id: "session-1",
          username: "user-1",
          ip_address: "10.0.0.1",
          nas_ip_address: "192.168.1.1",
          upload_bytes: 0,
          download_bytes: 0,
          session_time_seconds: 45,
          last_update: new Date().toISOString(),
        },
      };

      mockUseWebSocketSubscription.mockReturnValue([session]);

      renderWithTimers(<LiveSessionMonitor />);

      expect(screen.getByText("45s")).toBeInTheDocument();
    });
  });

  describe("Bytes Formatting", () => {
    it("formats bytes as GB for large values", () => {
      const session: SessionUpdate = {
        action: "new",
        session: {
          session_id: "session-1",
          username: "user-1",
          ip_address: "10.0.0.1",
          nas_ip_address: "192.168.1.1",
          upload_bytes: 1073741824, // 1 GB
          download_bytes: 2147483648, // 2 GB
          session_time_seconds: 0,
          last_update: new Date().toISOString(),
        },
      };

      mockUseWebSocketSubscription.mockReturnValue([session]);

      renderWithTimers(<LiveSessionMonitor />);

      expect(screen.getByTestId("session-upload-session-1")).toHaveTextContent("1.00 GB");
      expect(screen.getByTestId("session-download-session-1")).toHaveTextContent("2.00 GB");
    });

    it("formats bytes as MB for medium values", () => {
      const session: SessionUpdate = {
        action: "new",
        session: {
          session_id: "session-1",
          username: "user-1",
          ip_address: "10.0.0.1",
          nas_ip_address: "192.168.1.1",
          upload_bytes: 1048576, // 1 MB
          download_bytes: 5242880, // 5 MB
          session_time_seconds: 0,
          last_update: new Date().toISOString(),
        },
      };

      mockUseWebSocketSubscription.mockReturnValue([session]);

      renderWithTimers(<LiveSessionMonitor />);

      expect(screen.getByTestId("session-upload-session-1")).toHaveTextContent("1.00 MB");
      expect(screen.getByTestId("session-download-session-1")).toHaveTextContent("5.00 MB");
    });
  });

  describe("Session Badge Count", () => {
    it("shows session count badge with correct singular form", () => {
      const session: SessionUpdate = {
        action: "new",
        session: {
          session_id: "session-1",
          username: "user-1",
          ip_address: "10.0.0.1",
          nas_ip_address: "192.168.1.1",
          upload_bytes: 0,
          download_bytes: 0,
          session_time_seconds: 0,
          last_update: new Date().toISOString(),
        },
      };

      mockUseWebSocketSubscription.mockReturnValue([session]);

      renderWithTimers(<LiveSessionMonitor />);

      const badges = screen.getAllByTestId("badge");
      const sessionBadge = badges.find((badge) => badge.textContent?.includes("session"));
      expect(sessionBadge).toHaveTextContent("1 session");
    });

    it("shows session count badge with correct plural form", () => {
      const session1: SessionUpdate = {
        action: "new",
        session: {
          session_id: "session-1",
          username: "user-1",
          ip_address: "10.0.0.1",
          nas_ip_address: "192.168.1.1",
          upload_bytes: 0,
          download_bytes: 0,
          session_time_seconds: 0,
          last_update: new Date().toISOString(),
        },
      };

      mockUseWebSocketSubscription.mockReturnValue([session1]);

      const { rerender } = renderWithTimers(<LiveSessionMonitor />);

      const session2: SessionUpdate = {
        action: "new",
        session: {
          session_id: "session-2",
          username: "user-2",
          ip_address: "10.0.0.2",
          nas_ip_address: "192.168.1.2",
          upload_bytes: 0,
          download_bytes: 0,
          session_time_seconds: 0,
          last_update: new Date().toISOString(),
        },
      };

      mockUseWebSocketSubscription.mockReturnValue([session2]);
      rerender(<LiveSessionMonitor />);

      const badges = screen.getAllByTestId("badge");
      const sessionBadge = badges.find((badge) => badge.textContent?.includes("sessions"));
      expect(sessionBadge).toHaveTextContent("2 sessions");
    });
  });
});
