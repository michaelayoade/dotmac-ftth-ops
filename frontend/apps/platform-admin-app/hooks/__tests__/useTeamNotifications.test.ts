/**
 * Platform Admin App - useTeamNotifications tests
 * Tests for team notification management with TanStack Query
 */
import { useTeamNotifications, getRoleLabel, AVAILABLE_ROLES } from "../useTeamNotifications";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { ReactNode } from "react";

// Mock dependencies
jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

const { apiClient } = jest.requireMock("@/lib/api/client");
const { logger } = jest.requireMock("@/lib/logger");

// Test data
const mockTeamNotificationResponse = {
  notifications_created: 5,
  target_count: 5,
  team_members: ["user-uuid-1", "user-uuid-2", "user-uuid-3", "user-uuid-4", "user-uuid-5"],
  notification_type: "system_announcement",
  priority: "high",
};

const mockRoleFilterResponse = {
  notifications_created: 10,
  target_count: 10,
  role_filter: "admin",
  notification_type: "system_announcement",
  priority: "medium",
};

// Create wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe("useTeamNotifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("sendTeamNotification with team_members", () => {
    it("should send notification to specific team members successfully", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockTeamNotificationResponse });

      const { result } = renderHook(() => useTeamNotifications(), {
        wrapper: createWrapper(),
      });

      const request = {
        team_members: ["user-uuid-1", "user-uuid-2", "user-uuid-3", "user-uuid-4", "user-uuid-5"],
        title: "System Maintenance",
        message: "Scheduled maintenance will occur tonight at 10 PM",
        priority: "high" as const,
        notification_type: "system_announcement" as const,
        action_url: "/maintenance",
        action_label: "View Details",
      };

      const response = await result.current.sendTeamNotification(request);

      expect(apiClient.post).toHaveBeenCalledWith("/notifications/team", {
        team_members: request.team_members,
        role_filter: undefined,
        notification_type: "system_announcement",
        title: request.title,
        message: request.message,
        priority: "high",
        action_url: request.action_url,
        action_label: request.action_label,
        related_entity_type: undefined,
        related_entity_id: undefined,
        metadata: {},
        auto_send: true,
      });

      expect(response).toEqual(mockTeamNotificationResponse);
      expect(logger.info).toHaveBeenCalledWith("Team notification sent", {
        target_count: 5,
        notifications_created: 5,
      });
    });

    it("should use default values for optional fields", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockTeamNotificationResponse });

      const { result } = renderHook(() => useTeamNotifications(), {
        wrapper: createWrapper(),
      });

      const request = {
        team_members: ["user-uuid-1"],
        title: "Test Notification",
        message: "Test message",
      };

      await result.current.sendTeamNotification(request);

      expect(apiClient.post).toHaveBeenCalledWith("/notifications/team", {
        team_members: ["user-uuid-1"],
        role_filter: undefined,
        notification_type: "system_announcement",
        title: "Test Notification",
        message: "Test message",
        priority: "medium",
        action_url: undefined,
        action_label: undefined,
        related_entity_type: undefined,
        related_entity_id: undefined,
        metadata: {},
        auto_send: true,
      });
    });

    it("should include metadata and related entity info when provided", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockTeamNotificationResponse });

      const { result } = renderHook(() => useTeamNotifications(), {
        wrapper: createWrapper(),
      });

      const request = {
        team_members: ["user-uuid-1", "user-uuid-2"],
        title: "Ticket Assigned",
        message: "A new ticket has been assigned to you",
        priority: "high" as const,
        notification_type: "alert" as const,
        related_entity_type: "ticket",
        related_entity_id: "ticket-123",
        metadata: {
          ticket_priority: "urgent",
          customer_id: "customer-456",
        },
      };

      await result.current.sendTeamNotification(request);

      expect(apiClient.post).toHaveBeenCalledWith("/notifications/team", {
        team_members: request.team_members,
        role_filter: undefined,
        notification_type: "alert",
        title: request.title,
        message: request.message,
        priority: "high",
        action_url: undefined,
        action_label: undefined,
        related_entity_type: "ticket",
        related_entity_id: "ticket-123",
        metadata: {
          ticket_priority: "urgent",
          customer_id: "customer-456",
        },
        auto_send: true,
      });
    });

    it("should respect auto_send: false", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockTeamNotificationResponse });

      const { result } = renderHook(() => useTeamNotifications(), {
        wrapper: createWrapper(),
      });

      const request = {
        team_members: ["user-uuid-1"],
        title: "Draft Notification",
        message: "This is a draft",
        auto_send: false,
      };

      await result.current.sendTeamNotification(request);

      expect(apiClient.post).toHaveBeenCalledWith(
        "/notifications/team",
        expect.objectContaining({
          auto_send: false,
        }),
      );
    });
  });

  describe("sendTeamNotification with role_filter", () => {
    it("should send notification to users by role successfully", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockRoleFilterResponse });

      const { result } = renderHook(() => useTeamNotifications(), {
        wrapper: createWrapper(),
      });

      const request = {
        role_filter: "admin",
        title: "Admin Notice",
        message: "Important update for administrators",
        priority: "medium" as const,
        notification_type: "system_announcement" as const,
      };

      const response = await result.current.sendTeamNotification(request);

      expect(apiClient.post).toHaveBeenCalledWith("/notifications/team", {
        team_members: undefined,
        role_filter: "admin",
        notification_type: "system_announcement",
        title: request.title,
        message: request.message,
        priority: "medium",
        action_url: undefined,
        action_label: undefined,
        related_entity_type: undefined,
        related_entity_id: undefined,
        metadata: {},
        auto_send: true,
      });

      expect(response).toEqual(mockRoleFilterResponse);
      expect(logger.info).toHaveBeenCalledWith("Team notification sent", {
        target_count: 10,
        notifications_created: 10,
      });
    });

    it("should send notification to support_agent role", async () => {
      const supportResponse = {
        notifications_created: 7,
        target_count: 7,
        role_filter: "support_agent",
        notification_type: "task_assignment",
        priority: "high",
      };

      (apiClient.post as jest.Mock).mockResolvedValue({ data: supportResponse });

      const { result } = renderHook(() => useTeamNotifications(), {
        wrapper: createWrapper(),
      });

      const request = {
        role_filter: "support_agent",
        title: "New Tickets Available",
        message: "5 new tickets need attention",
        priority: "high" as const,
        notification_type: "task_assignment" as const,
      };

      await result.current.sendTeamNotification(request);

      expect(apiClient.post).toHaveBeenCalledWith(
        "/notifications/team",
        expect.objectContaining({
          role_filter: "support_agent",
          notification_type: "task_assignment",
        }),
      );
    });

    it("should send notification to noc role with action url", async () => {
      const nocResponse = {
        notifications_created: 3,
        target_count: 3,
        role_filter: "noc",
        notification_type: "alert",
        priority: "critical",
      };

      (apiClient.post as jest.Mock).mockResolvedValue({ data: nocResponse });

      const { result } = renderHook(() => useTeamNotifications(), {
        wrapper: createWrapper(),
      });

      const request = {
        role_filter: "noc",
        title: "Network Alert",
        message: "High latency detected in region A",
        priority: "critical" as const,
        notification_type: "alert" as const,
        action_url: "/dashboard/network/alerts",
        action_label: "View Alert",
      };

      await result.current.sendTeamNotification(request);

      expect(apiClient.post).toHaveBeenCalledWith(
        "/notifications/team",
        expect.objectContaining({
          role_filter: "noc",
          action_url: "/dashboard/network/alerts",
          action_label: "View Alert",
        }),
      );
    });
  });

  describe("validation", () => {
    it("should throw error when neither team_members nor role_filter is provided", async () => {
      const { result } = renderHook(() => useTeamNotifications(), {
        wrapper: createWrapper(),
      });

      const request = {
        title: "Invalid Request",
        message: "Missing targeting criteria",
      };

      await expect(result.current.sendTeamNotification(request)).rejects.toThrow(
        "Either team_members or role_filter must be provided",
      );

      expect(apiClient.post).not.toHaveBeenCalled();
    });

    it("should allow both team_members and role_filter (backend will handle)", async () => {
      const combinedResponse = {
        notifications_created: 15,
        target_count: 15,
        team_members: ["user-uuid-1", "user-uuid-2"],
        role_filter: "admin",
        notification_type: "system_announcement",
        priority: "medium",
      };

      (apiClient.post as jest.Mock).mockResolvedValue({ data: combinedResponse });

      const { result } = renderHook(() => useTeamNotifications(), {
        wrapper: createWrapper(),
      });

      const request = {
        team_members: ["user-uuid-1", "user-uuid-2"],
        role_filter: "admin",
        title: "Combined Targeting",
        message: "Message with both targeting methods",
      };

      await result.current.sendTeamNotification(request);

      expect(apiClient.post).toHaveBeenCalledWith(
        "/notifications/team",
        expect.objectContaining({
          team_members: ["user-uuid-1", "user-uuid-2"],
          role_filter: "admin",
        }),
      );
    });

    it("should validate required title field", async () => {
      const { result } = renderHook(() => useTeamNotifications(), {
        wrapper: createWrapper(),
      });

      const request = {
        team_members: ["user-uuid-1"],
        message: "Message without title",
      } as any; // Bypass TypeScript validation to test runtime

      // This should still execute but backend may reject
      (apiClient.post as jest.Mock).mockRejectedValue(new Error("Title is required"));

      await expect(result.current.sendTeamNotification(request)).rejects.toThrow();
    });

    it("should validate required message field", async () => {
      const { result } = renderHook(() => useTeamNotifications(), {
        wrapper: createWrapper(),
      });

      const request = {
        team_members: ["user-uuid-1"],
        title: "Title without message",
      } as any; // Bypass TypeScript validation to test runtime

      // This should still execute but backend may reject
      (apiClient.post as jest.Mock).mockRejectedValue(new Error("Message is required"));

      await expect(result.current.sendTeamNotification(request)).rejects.toThrow();
    });
  });

  describe("error handling", () => {
    it("should handle API errors and log them", async () => {
      const apiError = new Error("Failed to send notifications");
      (apiClient.post as jest.Mock).mockRejectedValue(apiError);

      const { result } = renderHook(() => useTeamNotifications(), {
        wrapper: createWrapper(),
      });

      const request = {
        team_members: ["user-uuid-1"],
        title: "Test",
        message: "Test message",
      };

      await expect(result.current.sendTeamNotification(request)).rejects.toThrow(
        "Failed to send notifications",
      );

      expect(logger.error).toHaveBeenCalledWith("Failed to send team notification", apiError);
      expect(logger.error).toHaveBeenCalledWith("Team notification mutation failed", apiError);
    });

    it("should handle network errors", async () => {
      const networkError = new Error("Network connection failed");
      (apiClient.post as jest.Mock).mockRejectedValue(networkError);

      const { result } = renderHook(() => useTeamNotifications(), {
        wrapper: createWrapper(),
      });

      const request = {
        role_filter: "admin",
        title: "Network Test",
        message: "Testing network error",
      };

      await expect(result.current.sendTeamNotification(request)).rejects.toThrow(
        "Network connection failed",
      );
    });

    it("should handle non-Error objects", async () => {
      const stringError = "String error message";
      (apiClient.post as jest.Mock).mockRejectedValue(stringError);

      const { result } = renderHook(() => useTeamNotifications(), {
        wrapper: createWrapper(),
      });

      const request = {
        team_members: ["user-uuid-1"],
        title: "Test",
        message: "Test message",
      };

      await expect(result.current.sendTeamNotification(request)).rejects.toEqual(stringError);

      expect(logger.error).toHaveBeenCalledWith(
        "Failed to send team notification",
        expect.any(Error),
      );
    });

    it("should set error state in mutation", async () => {
      const apiError = new Error("API Error");
      (apiClient.post as jest.Mock).mockRejectedValue(apiError);

      const { result } = renderHook(() => useTeamNotifications(), {
        wrapper: createWrapper(),
      });

      const request = {
        team_members: ["user-uuid-1"],
        title: "Test",
        message: "Test",
      };

      try {
        await result.current.sendTeamNotification(request);
      } catch {
        // Expected to throw
      }

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });
    });
  });

  describe("loading states", () => {
    it("should set isLoading to true during request", async () => {
      let resolvePromise: (value: unknown) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      (apiClient.post as jest.Mock).mockReturnValue(promise);

      const { result } = renderHook(() => useTeamNotifications(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);

      const request = {
        team_members: ["user-uuid-1"],
        title: "Test",
        message: "Test message",
      };

      const mutationPromise = result.current.sendTeamNotification(request);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      resolvePromise!({ data: mockTeamNotificationResponse });

      await mutationPromise;

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe("notification types", () => {
    it("should handle alert notification type", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockTeamNotificationResponse });

      const { result } = renderHook(() => useTeamNotifications(), {
        wrapper: createWrapper(),
      });

      const request = {
        team_members: ["user-uuid-1"],
        title: "Alert",
        message: "Alert message",
        notification_type: "alert" as const,
      };

      await result.current.sendTeamNotification(request);

      expect(apiClient.post).toHaveBeenCalledWith(
        "/notifications/team",
        expect.objectContaining({
          notification_type: "alert",
        }),
      );
    });

    it("should handle task_assignment notification type", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockTeamNotificationResponse });

      const { result } = renderHook(() => useTeamNotifications(), {
        wrapper: createWrapper(),
      });

      const request = {
        role_filter: "support_agent",
        title: "New Task",
        message: "Task assigned",
        notification_type: "task_assignment" as const,
      };

      await result.current.sendTeamNotification(request);

      expect(apiClient.post).toHaveBeenCalledWith(
        "/notifications/team",
        expect.objectContaining({
          notification_type: "task_assignment",
        }),
      );
    });
  });

  describe("priority levels", () => {
    it("should handle low priority", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockTeamNotificationResponse });

      const { result } = renderHook(() => useTeamNotifications(), {
        wrapper: createWrapper(),
      });

      const request = {
        team_members: ["user-uuid-1"],
        title: "Info",
        message: "Low priority info",
        priority: "low" as const,
      };

      await result.current.sendTeamNotification(request);

      expect(apiClient.post).toHaveBeenCalledWith(
        "/notifications/team",
        expect.objectContaining({
          priority: "low",
        }),
      );
    });

    it("should handle critical priority", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockTeamNotificationResponse });

      const { result } = renderHook(() => useTeamNotifications(), {
        wrapper: createWrapper(),
      });

      const request = {
        role_filter: "admin",
        title: "Critical Alert",
        message: "System critical",
        priority: "critical" as const,
      };

      await result.current.sendTeamNotification(request);

      expect(apiClient.post).toHaveBeenCalledWith(
        "/notifications/team",
        expect.objectContaining({
          priority: "critical",
        }),
      );
    });
  });
});

describe("Utility Functions", () => {
  describe("getRoleLabel", () => {
    it("should return correct label for admin", () => {
      expect(getRoleLabel("admin")).toBe("Administrators");
    });

    it("should return correct label for support_agent", () => {
      expect(getRoleLabel("support_agent")).toBe("Support Agents");
    });

    it("should return correct label for sales", () => {
      expect(getRoleLabel("sales")).toBe("Sales Team");
    });

    it("should return correct label for technician", () => {
      expect(getRoleLabel("technician")).toBe("Technicians");
    });

    it("should return correct label for manager", () => {
      expect(getRoleLabel("manager")).toBe("Managers");
    });

    it("should return correct label for billing", () => {
      expect(getRoleLabel("billing")).toBe("Billing Team");
    });

    it("should return correct label for noc", () => {
      expect(getRoleLabel("noc")).toBe("Network Operations Center");
    });

    it("should return the role value itself for unknown roles", () => {
      expect(getRoleLabel("unknown_role")).toBe("unknown_role");
    });

    it("should handle empty string", () => {
      expect(getRoleLabel("")).toBe("");
    });
  });

  describe("AVAILABLE_ROLES", () => {
    it("should have correct structure", () => {
      expect(AVAILABLE_ROLES).toHaveLength(7);
      expect(AVAILABLE_ROLES[0]).toEqual({ value: "admin", label: "Administrators" });
    });

    it("should contain all expected roles", () => {
      const roleValues = AVAILABLE_ROLES.map((r) => r.value);
      expect(roleValues).toContain("admin");
      expect(roleValues).toContain("support_agent");
      expect(roleValues).toContain("sales");
      expect(roleValues).toContain("technician");
      expect(roleValues).toContain("manager");
      expect(roleValues).toContain("billing");
      expect(roleValues).toContain("noc");
    });
  });
});
