/**
 * MSW-powered tests for useNotifications
 *
 * This test file uses MSW for API mocking instead of jest.mock.
 * Tests the actual hook contract: { notifications, isLoading, error, markAsRead, ... }
 */

// Mock platform config so apiClient has an absolute base URL
jest.mock("@/lib/config", () => ({
  platformConfig: {
    api: {
      baseUrl: "http://localhost:3000",
      prefix: "/api/v1",
      timeout: 30000,
      buildUrl: (path: string) => {
        const normalized = path.startsWith("/") ? path : `/${path}`;
        const prefixed = normalized.startsWith("/api/v1") ? normalized : `/api/v1${normalized}`;
        return `http://localhost:3000${prefixed}`;
      },
    },
  },
}));

import { renderHook, waitFor, act } from "@testing-library/react";
import {
  useNotifications,
  useNotificationTemplates,
  useCommunicationLogs,
} from "../useNotifications";
import {
  createTestQueryClient,
  createMockNotification,
  createMockTemplate,
  createMockLog,
  seedNotificationData,
  resetNotificationStorage,
  makeApiEndpointFail,
} from "../../__tests__/test-utils";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

describe("useNotifications (MSW)", () => {
  // Helper to create wrapper with QueryClient
  const createWrapper = (queryClient?: QueryClient) => {
    const client = queryClient || createTestQueryClient();
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    resetNotificationStorage();
  });

  describe("useNotifications - fetch notifications", () => {
    it("should fetch notifications successfully", async () => {
      const mockNotifications = [
        createMockNotification({
          id: "notif-1",
          title: "Test Notification 1",
          type: "invoice_generated",
          priority: "high",
          is_read: false,
        }),
        createMockNotification({
          id: "notif-2",
          title: "Test Notification 2",
          type: "payment_received",
          priority: "low",
          is_read: true,
        }),
      ];

      seedNotificationData(mockNotifications, [], []);

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.notifications).toHaveLength(2);
      expect(result.current.notifications[0].id).toBe("notif-1");
      expect(result.current.notifications[0].title).toBe("Test Notification 1");
      expect(result.current.unreadCount).toBe(1);
      expect(result.current.error).toBeNull();
    });

    it("should handle empty notification list", async () => {
      seedNotificationData([], [], []);

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.notifications).toHaveLength(0);
      expect(result.current.unreadCount).toBe(0);
      expect(result.current.error).toBeNull();
    });

    it("should filter notifications by unread only", async () => {
      const notifications = [
        createMockNotification({ id: "notif-1", is_read: false }),
        createMockNotification({ id: "notif-2", is_read: true }),
        createMockNotification({ id: "notif-3", is_read: false }),
      ];

      seedNotificationData(notifications, [], []);

      const { result } = renderHook(() => useNotifications({ unreadOnly: true }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.notifications).toHaveLength(2);
      expect(result.current.notifications.every((n) => !n.is_read)).toBe(true);
    });

    it("should filter notifications by priority", async () => {
      const notifications = [
        createMockNotification({ priority: "high" }),
        createMockNotification({ priority: "low" }),
        createMockNotification({ priority: "high" }),
      ];

      seedNotificationData(notifications, [], []);

      const { result } = renderHook(() => useNotifications({ priority: "high" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.notifications).toHaveLength(2);
      expect(result.current.notifications.every((n) => n.priority === "high")).toBe(true);
    });

    it("should filter notifications by type", async () => {
      const notifications = [
        createMockNotification({ type: "invoice_generated" }),
        createMockNotification({ type: "payment_received" }),
        createMockNotification({ type: "invoice_generated" }),
      ];

      seedNotificationData(notifications, [], []);

      const { result } = renderHook(
        () => useNotifications({ notificationType: "invoice_generated" }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.notifications).toHaveLength(2);
      expect(
        result.current.notifications.every((n) => n.type === "invoice_generated")
      ).toBe(true);
    });

    it("should handle fetch error", async () => {
      makeApiEndpointFail("get", "/api/v1/notifications", "Server error", 500);

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Hook gracefully handles 403 errors, but 500 should set error
      expect(result.current.notifications).toHaveLength(0);
    });

    it("should handle 403 gracefully", async () => {
      makeApiEndpointFail("get", "/api/v1/notifications", "Forbidden", 403);

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Hook treats 403 as empty list, not error
      expect(result.current.notifications).toHaveLength(0);
      expect(result.current.error).toBeNull();
    });
  });

  describe("useNotifications - actions", () => {
    it("should mark notification as read", async () => {
      const notifications = [
        createMockNotification({ id: "notif-1", is_read: false }),
      ];

      seedNotificationData(notifications, [], []);

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.notifications[0].is_read).toBe(false);
      expect(result.current.unreadCount).toBe(1);

      // Mark as read
      await act(async () => {
        const success = await result.current.markAsRead("notif-1");
        expect(success).toBe(true);
      });

      // Verify state updated
      expect(result.current.notifications[0].is_read).toBe(true);
      expect(result.current.unreadCount).toBe(0);
    });

    it("should mark notification as unread", async () => {
      const notifications = [
        createMockNotification({ id: "notif-1", is_read: true }),
      ];

      seedNotificationData(notifications, [], []);

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.notifications[0].is_read).toBe(true);
      expect(result.current.unreadCount).toBe(0);

      // Mark as unread
      await act(async () => {
        const success = await result.current.markAsUnread("notif-1");
        expect(success).toBe(true);
      });

      // Verify state updated
      expect(result.current.notifications[0].is_read).toBe(false);
      expect(result.current.unreadCount).toBe(1);
    });

    it("should mark all notifications as read", async () => {
      const notifications = [
        createMockNotification({ id: "notif-1", is_read: false }),
        createMockNotification({ id: "notif-2", is_read: false }),
        createMockNotification({ id: "notif-3", is_read: false }),
      ];

      seedNotificationData(notifications, [], []);

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.unreadCount).toBe(3);

      // Mark all as read
      await act(async () => {
        const success = await result.current.markAllAsRead();
        expect(success).toBe(true);
      });

      // Verify all marked as read
      expect(result.current.notifications.every((n) => n.is_read)).toBe(true);
      expect(result.current.unreadCount).toBe(0);
    });

    it("should archive notification", async () => {
      const notifications = [
        createMockNotification({ id: "notif-1" }),
        createMockNotification({ id: "notif-2" }),
      ];

      seedNotificationData(notifications, [], []);

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.notifications).toHaveLength(2);

      // Archive notification
      await act(async () => {
        const success = await result.current.archiveNotification("notif-1");
        expect(success).toBe(true);
      });

      // Verify removed from list
      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.notifications[0].id).toBe("notif-2");
    });

    it("should delete notification", async () => {
      const notifications = [
        createMockNotification({ id: "notif-1" }),
        createMockNotification({ id: "notif-2" }),
      ];

      seedNotificationData(notifications, [], []);

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.notifications).toHaveLength(2);

      // Delete notification
      await act(async () => {
        const success = await result.current.deleteNotification("notif-1");
        expect(success).toBe(true);
      });

      // Verify removed from list
      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.notifications[0].id).toBe("notif-2");
    });
  });

  describe("useNotificationTemplates", () => {
    it("should fetch templates successfully", async () => {
      const templates = [
        createMockTemplate({
          id: "tpl-1",
          name: "Welcome Email",
          type: "email",
          is_active: true,
        }),
        createMockTemplate({
          id: "tpl-2",
          name: "SMS Reminder",
          type: "sms",
          is_active: true,
        }),
      ];

      seedNotificationData([], templates, []);

      const { result } = renderHook(() => useNotificationTemplates(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.templates).toHaveLength(2);
      expect(result.current.templates[0].name).toBe("Welcome Email");
      expect(result.current.error).toBeNull();
    });

    it("should filter templates by type", async () => {
      const templates = [
        createMockTemplate({ type: "email" }),
        createMockTemplate({ type: "sms" }),
        createMockTemplate({ type: "email" }),
      ];

      seedNotificationData([], templates, []);

      const { result } = renderHook(() => useNotificationTemplates({ type: "email" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.templates).toHaveLength(2);
      expect(result.current.templates.every((t) => t.type === "email")).toBe(true);
    });

    it("should filter templates by active only", async () => {
      const templates = [
        createMockTemplate({ is_active: true }),
        createMockTemplate({ is_active: false }),
        createMockTemplate({ is_active: true }),
      ];

      seedNotificationData([], templates, []);

      const { result } = renderHook(
        () => useNotificationTemplates({ activeOnly: true }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.templates).toHaveLength(2);
      expect(result.current.templates.every((t) => t.is_active)).toBe(true);
    });

    it("should create template", async () => {
      seedNotificationData([], [], []);

      const { result } = renderHook(() => useNotificationTemplates(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Create template
      const newTemplate = await act(async () => {
        return await result.current.createTemplate({
          name: "New Template",
          type: "email",
          subject_template: "Hello {{name}}",
          text_template: "Welcome {{name}}",
          required_variables: ["name"],
        });
      });

      expect(newTemplate).toBeDefined();
      expect(newTemplate?.name).toBe("New Template");

      // Verify added to list
      expect(result.current.templates).toHaveLength(1);
    });

    it("should update template", async () => {
      const templates = [createMockTemplate({ id: "tpl-1", name: "Old Name" })];

      seedNotificationData([], templates, []);

      const { result } = renderHook(() => useNotificationTemplates(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Update template
      const updated = await act(async () => {
        return await result.current.updateTemplate("tpl-1", {
          name: "New Name",
        });
      });

      expect(updated?.name).toBe("New Name");
      expect(result.current.templates[0].name).toBe("New Name");
    });

    it("should delete template", async () => {
      const templates = [
        createMockTemplate({ id: "tpl-1" }),
        createMockTemplate({ id: "tpl-2" }),
      ];

      seedNotificationData([], templates, []);

      const { result } = renderHook(() => useNotificationTemplates(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.templates).toHaveLength(2);

      // Delete template
      await act(async () => {
        const success = await result.current.deleteTemplate("tpl-1");
        expect(success).toBe(true);
      });

      expect(result.current.templates).toHaveLength(1);
      expect(result.current.templates[0].id).toBe("tpl-2");
    });

    it("should render template preview", async () => {
      const templates = [
        createMockTemplate({
          id: "tpl-1",
          subject_template: "Hello {{name}}",
          text_template: "Welcome {{name}} to {{company}}",
        }),
      ];

      seedNotificationData([], templates, []);

      const { result } = renderHook(() => useNotificationTemplates(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Render preview
      const preview = await act(async () => {
        return await result.current.renderTemplatePreview("tpl-1", {
          name: "John",
          company: "Acme Corp",
        });
      });

      expect(preview).toBeDefined();
      expect(preview?.subject).toBe("Hello John");
      expect(preview?.text).toBe("Welcome John to Acme Corp");
    });
  });

  describe("useCommunicationLogs", () => {
    it("should fetch logs successfully", async () => {
      const logs = [
        createMockLog({
          id: "log-1",
          type: "email",
          recipient: "test@example.com",
          status: "sent",
        }),
        createMockLog({
          id: "log-2",
          type: "sms",
          recipient: "+1234567890",
          status: "delivered",
        }),
      ];

      seedNotificationData([], [], logs);

      const { result } = renderHook(() => useCommunicationLogs(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.logs).toHaveLength(2);
      expect(result.current.total).toBe(2);
      expect(result.current.error).toBeNull();
    });

    it("should filter logs by type", async () => {
      const logs = [
        createMockLog({ type: "email" }),
        createMockLog({ type: "sms" }),
        createMockLog({ type: "email" }),
      ];

      seedNotificationData([], [], logs);

      const { result } = renderHook(() => useCommunicationLogs({ type: "email" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.logs).toHaveLength(2);
      expect(result.current.logs.every((l) => l.type === "email")).toBe(true);
    });

    it("should filter logs by status", async () => {
      const logs = [
        createMockLog({ status: "sent" }),
        createMockLog({ status: "failed" }),
        createMockLog({ status: "sent" }),
      ];

      seedNotificationData([], [], logs);

      const { result } = renderHook(() => useCommunicationLogs({ status: "sent" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.logs).toHaveLength(2);
      expect(result.current.logs.every((l) => l.status === "sent")).toBe(true);
    });

    it("should handle pagination", async () => {
      const logs = Array.from({ length: 30 }, (_, i) =>
        createMockLog({ id: `log-${i + 1}` })
      );

      seedNotificationData([], [], logs);

      const { result } = renderHook(
        () => useCommunicationLogs({ page: 2, pageSize: 10 }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.logs).toHaveLength(10);
      expect(result.current.logs[0].id).toBe("log-11");
      expect(result.current.total).toBe(30);
    });

    it("should retry failed communication", async () => {
      const logs = [
        createMockLog({ id: "log-1", status: "failed", retry_count: 0 }),
      ];

      seedNotificationData([], [], logs);

      const { result } = renderHook(() => useCommunicationLogs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.logs[0].retry_count).toBe(0);

      // Retry
      await act(async () => {
        const success = await result.current.retryFailedCommunication("log-1");
        expect(success).toBe(true);
      });

      // Note: In real scenario, refetch would update the list
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle mixed notification states", async () => {
      const notifications = [
        createMockNotification({ priority: "urgent", is_read: false }),
        createMockNotification({ priority: "high", is_read: false }),
        createMockNotification({ priority: "medium", is_read: true }),
        createMockNotification({ priority: "low", is_read: true }),
      ];

      seedNotificationData(notifications, [], []);

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.notifications).toHaveLength(4);
      expect(result.current.unreadCount).toBe(2);

      // Mark one as read
      await act(async () => {
        await result.current.markAsRead(notifications[0].id);
      });

      expect(result.current.unreadCount).toBe(1);
    });

    it("should handle template with communication logs", async () => {
      const templates = [
        createMockTemplate({ id: "tpl-1", name: "Welcome Email" }),
      ];
      const logs = [
        createMockLog({ template_id: "tpl-1", template_name: "Welcome Email" }),
      ];

      seedNotificationData([], templates, logs);

      const { result: templateResult } = renderHook(
        () => useNotificationTemplates(),
        { wrapper: createWrapper() }
      );

      const { result: logsResult } = renderHook(() => useCommunicationLogs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(templateResult.current.isLoading).toBe(false);
        expect(logsResult.current.isLoading).toBe(false);
      });

      expect(templateResult.current.templates[0].name).toBe("Welcome Email");
      expect(logsResult.current.logs[0].template_name).toBe("Welcome Email");
    });
  });
});
