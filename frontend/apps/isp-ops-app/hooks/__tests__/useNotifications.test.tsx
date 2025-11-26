/**
 * Unit Tests for useNotifications hooks
 * Tests all 5 notification-related hooks with Jest mocks for fast, reliable unit testing
 */

// Mock dependencies
jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("axios", () => ({
  ...jest.requireActual("axios"),
  isAxiosError: jest.fn(),
}));

import { renderHook, waitFor, act } from "@testing-library/react";
import {
  useNotifications,
  useNotificationTemplates,
  useCommunicationLogs,
  useBulkNotifications,
  useUnreadCount,
  type Notification,
  type CommunicationTemplate,
  type CommunicationLog,
  type NotificationListResponse,
  type BulkNotificationResponse,
} from "../useNotifications";
import { apiClient } from "@/lib/api/client";
import axios from "axios";
import React from "react";

// ============================================
// Test Utilities
// ============================================

// Mock timers helper
const advanceTimersByTime = async (ms: number) => {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
  await Promise.resolve();
};

// ============================================
// Mock Data Factories
// ============================================

function createMockNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: "notif-123",
    user_id: "user-456",
    tenant_id: "tenant-789",
    type: "invoice_generated",
    priority: "medium",
    title: "Test Notification",
    message: "This is a test notification",
    action_url: "/invoices/123",
    action_label: "View Invoice",
    related_entity_type: "invoice",
    related_entity_id: "inv-123",
    is_read: false,
    read_at: undefined,
    is_archived: false,
    archived_at: undefined,
    channels: ["in_app", "email"],
    email_sent: true,
    email_sent_at: "2025-01-15T10:00:00Z",
    sms_sent: false,
    sms_sent_at: undefined,
    push_sent: false,
    push_sent_at: undefined,
    notification_metadata: {},
    created_at: "2025-01-15T09:00:00Z",
    updated_at: "2025-01-15T09:00:00Z",
    ...overrides,
  };
}

function createMockTemplate(overrides: Partial<CommunicationTemplate> = {}): CommunicationTemplate {
  return {
    id: "tpl-123",
    tenant_id: "tenant-789",
    name: "Test Template",
    description: "A test email template",
    type: "email",
    subject_template: "Hello {{name}}",
    text_template: "Welcome {{name}}",
    html_template: "<p>Welcome {{name}}</p>",
    variables: ["name"],
    required_variables: ["name"],
    is_active: true,
    is_default: false,
    usage_count: 0,
    created_at: "2025-01-15T09:00:00Z",
    updated_at: "2025-01-15T09:00:00Z",
    ...overrides,
  };
}

function createMockLog(overrides: Partial<CommunicationLog> = {}): CommunicationLog {
  return {
    id: "log-123",
    tenant_id: "tenant-789",
    type: "email",
    recipient: "test@example.com",
    sender: "noreply@example.com",
    subject: "Test Email",
    text_body: "Test email body",
    html_body: "<p>Test email body</p>",
    status: "sent",
    sent_at: "2025-01-15T10:00:00Z",
    delivered_at: "2025-01-15T10:01:00Z",
    failed_at: undefined,
    error_message: undefined,
    retry_count: 0,
    provider: "sendgrid",
    provider_message_id: "msg-123",
    template_id: "tpl-123",
    template_name: "Test Template",
    user_id: "user-456",
    job_id: undefined,
    metadata: {},
    created_at: "2025-01-15T10:00:00Z",
    ...overrides,
  };
}

// ============================================
// Tests: useNotifications
// ============================================

describe("useNotifications", () => {
  const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
  const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    (axios.isAxiosError as jest.Mock).mockReturnValue(false);
  });

  describe("Basic Functionality", () => {
    it("should fetch notifications successfully", async () => {
      const mockResponse: NotificationListResponse = {
        notifications: [
          createMockNotification({ id: "notif-1" }),
          createMockNotification({ id: "notif-2", is_read: true }),
        ],
        total: 2,
        unread_count: 1,
      };

      (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: mockResponse });

      const { result } = renderHook(() => useNotifications());

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.notifications).toHaveLength(2);
      expect(result.current.unreadCount).toBe(1);
      expect(result.current.error).toBeNull();
    });

    it("should call correct endpoint without filters", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: { notifications: [], total: 0, unread_count: 0 },
      });

      renderHook(() => useNotifications());

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith("/notifications");
      });
    });

    it("should refetch notifications", async () => {
      const mockResponse: NotificationListResponse = {
        notifications: [createMockNotification()],
        total: 1,
        unread_count: 1,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(apiClient.get).toHaveBeenCalledTimes(1);

      // Refetch
      await act(async () => {
        await result.current.refetch();
      });

      expect(apiClient.get).toHaveBeenCalledTimes(2);
    });
  });

  describe("Filtering Options", () => {
    it("should filter by unreadOnly", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: { notifications: [], total: 0, unread_count: 0 },
      });

      renderHook(() => useNotifications({ unreadOnly: true }));

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith("/notifications?unread_only=true");
      });
    });

    it("should filter by priority", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: { notifications: [], total: 0, unread_count: 0 },
      });

      renderHook(() => useNotifications({ priority: "high" }));

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith("/notifications?priority=high");
      });
    });

    it("should filter by notificationType", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: { notifications: [], total: 0, unread_count: 0 },
      });

      renderHook(() => useNotifications({ notificationType: "invoice_generated" }));

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith(
          "/notifications?notification_type=invoice_generated",
        );
      });
    });

    it("should combine multiple filters", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: { notifications: [], total: 0, unread_count: 0 },
      });

      renderHook(() =>
        useNotifications({
          unreadOnly: true,
          priority: "urgent",
          notificationType: "payment_failed",
        }),
      );

      await waitFor(() => {
        const callUrl = (apiClient.get as jest.Mock).mock.calls[0][0];
        expect(callUrl).toContain("unread_only=true");
        expect(callUrl).toContain("priority=urgent");
        expect(callUrl).toContain("notification_type=payment_failed");
      });
    });
  });

  describe("Auto-refresh", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should auto-refresh when enabled with default interval", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { notifications: [], total: 0, unread_count: 0 },
      });

      renderHook(() => useNotifications({ autoRefresh: true }));

      await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(1));

      // Advance by 30 seconds (default interval)
      await advanceTimersByTime(30000);

      expect(apiClient.get).toHaveBeenCalledTimes(2);
    });

    it("should auto-refresh with custom interval", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { notifications: [], total: 0, unread_count: 0 },
      });

      renderHook(() => useNotifications({ autoRefresh: true, refreshInterval: 10000 }));

      await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(1));

      // Advance by 10 seconds (custom interval)
      await advanceTimersByTime(10000);

      expect(apiClient.get).toHaveBeenCalledTimes(2);
    });

    it("should not auto-refresh when disabled", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { notifications: [], total: 0, unread_count: 0 },
      });

      renderHook(() => useNotifications({ autoRefresh: false }));

      await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(1));

      await advanceTimersByTime(60000);

      expect(apiClient.get).toHaveBeenCalledTimes(1);
    });

    it("should cleanup interval on unmount", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { notifications: [], total: 0, unread_count: 0 },
      });

      const { unmount } = renderHook(() => useNotifications({ autoRefresh: true }));

      await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(1));

      unmount();

      await advanceTimersByTime(60000);

      expect(apiClient.get).toHaveBeenCalledTimes(1);
    });
  });

  describe("Actions - markAsRead", () => {
    it("should mark notification as read successfully", async () => {
      const notification = createMockNotification({ id: "notif-1", is_read: false });
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: { notifications: [notification], total: 1, unread_count: 1 },
      });
      (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: {} });

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.notifications[0].is_read).toBe(false);
      expect(result.current.unreadCount).toBe(1);

      let success: boolean = false;
      await act(async () => {
        success = await result.current.markAsRead("notif-1");
      });

      expect(success).toBe(true);
      expect(apiClient.post).toHaveBeenCalledWith("/notifications/notif-1/read", {});
      expect(result.current.notifications[0].is_read).toBe(true);
      expect(result.current.notifications[0].read_at).toBeDefined();
      expect(result.current.unreadCount).toBe(0);
    });

    it("should handle markAsRead API failure", async () => {
      const notification = createMockNotification({ id: "notif-1", is_read: false });
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: { notifications: [notification], total: 1, unread_count: 1 },
      });
      (apiClient.post as jest.Mock).mockRejectedValueOnce(new Error("API Error"));

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let success: boolean = true;
      await act(async () => {
        success = await result.current.markAsRead("notif-1");
      });

      expect(success).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(result.current.notifications[0].is_read).toBe(false);
    });

    it("should clamp unreadCount to 0 when marking as read", async () => {
      const notification = createMockNotification({ id: "notif-1", is_read: false });
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: { notifications: [notification], total: 1, unread_count: 0 }, // Already 0
      });
      (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: {} });

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.markAsRead("notif-1");
      });

      expect(result.current.unreadCount).toBe(0); // Should not go negative
    });
  });

  describe("Actions - markAsUnread", () => {
    it("should mark notification as unread successfully", async () => {
      const notification = createMockNotification({
        id: "notif-1",
        is_read: true,
        read_at: "2025-01-15T10:00:00Z",
      });
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: { notifications: [notification], total: 1, unread_count: 0 },
      });
      (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: {} });

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let success: boolean = false;
      await act(async () => {
        success = await result.current.markAsUnread("notif-1");
      });

      expect(success).toBe(true);
      expect(apiClient.post).toHaveBeenCalledWith("/notifications/notif-1/unread", {});
      expect(result.current.notifications[0].is_read).toBe(false);
      expect(result.current.notifications[0].read_at).toBeUndefined();
      expect(result.current.unreadCount).toBe(1);
    });

    it("should handle markAsUnread API failure", async () => {
      const notification = createMockNotification({ id: "notif-1", is_read: true });
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: { notifications: [notification], total: 1, unread_count: 0 },
      });
      (apiClient.post as jest.Mock).mockRejectedValueOnce(new Error("API Error"));

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let success: boolean = true;
      await act(async () => {
        success = await result.current.markAsUnread("notif-1");
      });

      expect(success).toBe(false);
      expect(result.current.notifications[0].is_read).toBe(true);
    });
  });

  describe("Actions - markAllAsRead", () => {
    it("should mark all notifications as read successfully", async () => {
      const notifications = [
        createMockNotification({ id: "notif-1", is_read: false }),
        createMockNotification({ id: "notif-2", is_read: false }),
      ];
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: { notifications, total: 2, unread_count: 2 },
      });
      (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: {} });

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let success: boolean = false;
      await act(async () => {
        success = await result.current.markAllAsRead();
      });

      expect(success).toBe(true);
      expect(apiClient.post).toHaveBeenCalledWith("/notifications/mark-all-read");
      expect(result.current.notifications.every((n) => n.is_read)).toBe(true);
      expect(result.current.unreadCount).toBe(0);
    });

    it("should handle markAllAsRead API failure", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: { notifications: [], total: 0, unread_count: 0 },
      });
      (apiClient.post as jest.Mock).mockRejectedValueOnce(new Error("API Error"));

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let success: boolean = true;
      await act(async () => {
        success = await result.current.markAllAsRead();
      });

      expect(success).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe("Actions - archiveNotification", () => {
    it("should archive notification successfully", async () => {
      const notifications = [
        createMockNotification({ id: "notif-1" }),
        createMockNotification({ id: "notif-2" }),
      ];
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: { notifications, total: 2, unread_count: 0 },
      });
      (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: {} });

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let success: boolean = false;
      await act(async () => {
        success = await result.current.archiveNotification("notif-1");
      });

      expect(success).toBe(true);
      expect(apiClient.post).toHaveBeenCalledWith("/notifications/notif-1/archive", {});
      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.notifications[0].id).toBe("notif-2");
    });

    it("should handle archiveNotification API failure", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: { notifications: [createMockNotification()], total: 1, unread_count: 0 },
      });
      (apiClient.post as jest.Mock).mockRejectedValueOnce(new Error("API Error"));

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let success: boolean = true;
      await act(async () => {
        success = await result.current.archiveNotification("notif-1");
      });

      expect(success).toBe(false);
      expect(result.current.notifications).toHaveLength(1);
    });
  });

  describe("Actions - deleteNotification", () => {
    it("should delete notification successfully", async () => {
      const notifications = [
        createMockNotification({ id: "notif-1" }),
        createMockNotification({ id: "notif-2" }),
      ];
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: { notifications, total: 2, unread_count: 0 },
      });
      (apiClient.delete as jest.Mock).mockResolvedValueOnce({ data: {} });

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let success: boolean = false;
      await act(async () => {
        success = await result.current.deleteNotification("notif-1");
      });

      expect(success).toBe(true);
      expect(apiClient.delete).toHaveBeenCalledWith("/notifications/notif-1");
      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.notifications[0].id).toBe("notif-2");
    });

    it("should handle deleteNotification API failure", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: { notifications: [createMockNotification()], total: 1, unread_count: 0 },
      });
      (apiClient.delete as jest.Mock).mockRejectedValueOnce(new Error("API Error"));

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let success: boolean = true;
      await act(async () => {
        success = await result.current.deleteNotification("notif-1");
      });

      expect(success).toBe(false);
      expect(result.current.notifications).toHaveLength(1);
    });
  });

  describe("Error Handling", () => {
    it("should handle network errors", async () => {
      const networkError = new Error("Network Error");
      (apiClient.get as jest.Mock).mockRejectedValueOnce(networkError);

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.notifications).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should handle 403 errors gracefully", async () => {
      const error = {
        response: { status: 403 },
      };
      (axios.isAxiosError as jest.Mock).mockReturnValue(true);
      (apiClient.get as jest.Mock).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.notifications).toEqual([]);
      expect(result.current.unreadCount).toBe(0);
      expect(result.current.error).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("403"));
    });

    it("should handle non-Error exceptions", async () => {
      (apiClient.get as jest.Mock).mockRejectedValueOnce("String error");

      const { result } = renderHook(() => useNotifications());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.message).toBe("Failed to fetch notifications");
    });
  });
});

// ============================================
// Tests: useNotificationTemplates
// ============================================

describe("useNotificationTemplates", () => {
  const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
  const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

  beforeEach(() => {
    jest.clearAllMocks();
    (axios.isAxiosError as jest.Mock).mockReturnValue(false);
  });

  describe("Basic Functionality", () => {
    it("should fetch templates successfully", async () => {
      const templates = [createMockTemplate({ id: "tpl-1" }), createMockTemplate({ id: "tpl-2" })];
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: { templates, total: 2, page: 1, page_size: 10, has_more: false },
      });

      const { result } = renderHook(() => useNotificationTemplates());

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.templates).toHaveLength(2);
      expect(result.current.error).toBeNull();
    });

    it("should handle array response format", async () => {
      const templates = [createMockTemplate()];
      (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: templates });

      const { result } = renderHook(() => useNotificationTemplates());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.templates).toHaveLength(1);
    });

    it("should handle empty templates response", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: { templates: [] } });

      const { result } = renderHook(() => useNotificationTemplates());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.templates).toEqual([]);
    });

    it("should handle null/undefined response", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: null });

      const { result } = renderHook(() => useNotificationTemplates());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.templates).toEqual([]);
    });
  });

  describe("Filtering Options", () => {
    it("should filter by type", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: { templates: [] } });

      renderHook(() => useNotificationTemplates({ type: "email" }));

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith("/communications/templates?type=email");
      });
    });

    it("should filter by activeOnly", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: { templates: [] } });

      renderHook(() => useNotificationTemplates({ activeOnly: true }));

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith("/communications/templates?active_only=true");
      });
    });

    it("should combine filters", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: { templates: [] } });

      renderHook(() => useNotificationTemplates({ type: "sms", activeOnly: true }));

      await waitFor(() => {
        const callUrl = (apiClient.get as jest.Mock).mock.calls[0][0];
        expect(callUrl).toContain("type=sms");
        expect(callUrl).toContain("active_only=true");
      });
    });
  });

  describe("Actions - createTemplate", () => {
    it("should create template successfully", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: { templates: [] } });

      const newTemplate = createMockTemplate({ id: "tpl-new", name: "New Template" });
      (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: newTemplate });

      const { result } = renderHook(() => useNotificationTemplates());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let created: CommunicationTemplate | null = null;
      await act(async () => {
        created = await result.current.createTemplate({
          name: "New Template",
          type: "email",
          subject_template: "Test",
          text_template: "Test body",
        });
      });

      expect(created).toEqual(newTemplate);
      expect(apiClient.post).toHaveBeenCalledWith("/communications/templates", {
        name: "New Template",
        type: "email",
        subject_template: "Test",
        text_template: "Test body",
      });
      expect(result.current.templates).toHaveLength(1);
    });

    it("should throw error on createTemplate failure", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: { templates: [] } });
      (apiClient.post as jest.Mock).mockRejectedValueOnce(new Error("API Error"));

      const { result } = renderHook(() => useNotificationTemplates());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await expect(async () => {
        await act(async () => {
          await result.current.createTemplate({
            name: "Test",
            type: "email",
          });
        });
      }).rejects.toThrow();
    });
  });

  describe("Actions - updateTemplate", () => {
    it("should update template successfully", async () => {
      const originalTemplate = createMockTemplate({ id: "tpl-1", name: "Original" });
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: { templates: [originalTemplate] },
      });

      const updatedTemplate = { ...originalTemplate, name: "Updated" };
      (apiClient.patch as jest.Mock).mockResolvedValueOnce({ data: updatedTemplate });

      const { result } = renderHook(() => useNotificationTemplates());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let updated: CommunicationTemplate | null = null;
      await act(async () => {
        updated = await result.current.updateTemplate("tpl-1", { name: "Updated" });
      });

      expect(updated?.name).toBe("Updated");
      expect(apiClient.patch).toHaveBeenCalledWith("/communications/templates/tpl-1", {
        name: "Updated",
      });
      expect(result.current.templates[0].name).toBe("Updated");
    });

    it("should throw error on updateTemplate failure", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: { templates: [] } });
      (apiClient.patch as jest.Mock).mockRejectedValueOnce(new Error("API Error"));

      const { result } = renderHook(() => useNotificationTemplates());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await expect(async () => {
        await act(async () => {
          await result.current.updateTemplate("tpl-1", { name: "Test" });
        });
      }).rejects.toThrow();
    });
  });

  describe("Actions - deleteTemplate", () => {
    it("should delete template successfully", async () => {
      const templates = [createMockTemplate({ id: "tpl-1" }), createMockTemplate({ id: "tpl-2" })];
      (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: { templates } });
      (apiClient.delete as jest.Mock).mockResolvedValueOnce({ data: {} });

      const { result } = renderHook(() => useNotificationTemplates());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let success: boolean = false;
      await act(async () => {
        success = await result.current.deleteTemplate("tpl-1");
      });

      expect(success).toBe(true);
      expect(apiClient.delete).toHaveBeenCalledWith("/communications/templates/tpl-1");
      expect(result.current.templates).toHaveLength(1);
      expect(result.current.templates[0].id).toBe("tpl-2");
    });

    it("should handle deleteTemplate failure", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: { templates: [createMockTemplate()] },
      });
      (apiClient.delete as jest.Mock).mockRejectedValueOnce(new Error("API Error"));

      const { result } = renderHook(() => useNotificationTemplates());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let success: boolean = true;
      await act(async () => {
        success = await result.current.deleteTemplate("tpl-1");
      });

      expect(success).toBe(false);
      expect(result.current.templates).toHaveLength(1);
    });
  });

  describe("Actions - renderTemplatePreview", () => {
    it("should render template preview successfully", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: { templates: [] } });
      (apiClient.post as jest.Mock).mockResolvedValueOnce({
        data: {
          subject: "Hello John",
          text: "Welcome John",
          html: "<p>Welcome John</p>",
        },
      });

      const { result } = renderHook(() => useNotificationTemplates());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let preview: { subject?: string; text?: string; html?: string } | null = null;
      await act(async () => {
        preview = await result.current.renderTemplatePreview("tpl-1", { name: "John" });
      });

      expect(preview).toEqual({
        subject: "Hello John",
        text: "Welcome John",
        html: "<p>Welcome John</p>",
      });
      expect(apiClient.post).toHaveBeenCalledWith("/communications/templates/tpl-1/render", {
        data: { name: "John" },
      });
    });

    it("should return null on renderTemplatePreview failure", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: { templates: [] } });
      (apiClient.post as jest.Mock).mockRejectedValueOnce(new Error("API Error"));

      const { result } = renderHook(() => useNotificationTemplates());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let preview: { subject?: string; text?: string; html?: string } | null = { subject: "test" };
      await act(async () => {
        preview = await result.current.renderTemplatePreview("tpl-1", {});
      });

      expect(preview).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should handle 403 errors gracefully", async () => {
      const error = { response: { status: 403 } };
      (axios.isAxiosError as jest.Mock).mockReturnValue(true);
      (apiClient.get as jest.Mock).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useNotificationTemplates());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.templates).toEqual([]);
      expect(result.current.error).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it("should handle network errors", async () => {
      (apiClient.get as jest.Mock).mockRejectedValueOnce(new Error("Network Error"));

      const { result } = renderHook(() => useNotificationTemplates());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });
});

// ============================================
// Tests: useCommunicationLogs
// ============================================

describe("useCommunicationLogs", () => {
  const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
  const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

  beforeEach(() => {
    jest.clearAllMocks();
    (axios.isAxiosError as jest.Mock).mockReturnValue(false);
  });

  describe("Basic Functionality", () => {
    it("should fetch logs successfully", async () => {
      const logs = [createMockLog({ id: "log-1" }), createMockLog({ id: "log-2" })];
      (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: { logs, total: 2 } });

      const { result } = renderHook(() => useCommunicationLogs());

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.logs).toHaveLength(2);
      expect(result.current.total).toBe(2);
      expect(result.current.error).toBeNull();
    });

    it("should call correct endpoint without filters", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: { logs: [], total: 0 } });

      renderHook(() => useCommunicationLogs());

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith("/communications/logs");
      });
    });
  });

  describe("Filtering Options", () => {
    it("should filter by type", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: { logs: [], total: 0 } });

      renderHook(() => useCommunicationLogs({ type: "email" }));

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith("/communications/logs?type=email");
      });
    });

    it("should filter by status", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: { logs: [], total: 0 } });

      renderHook(() => useCommunicationLogs({ status: "sent" }));

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith("/communications/logs?status=sent");
      });
    });

    it("should filter by recipient", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: { logs: [], total: 0 } });

      renderHook(() => useCommunicationLogs({ recipient: "test@example.com" }));

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith(
          "/communications/logs?recipient=test%40example.com",
        );
      });
    });

    it("should filter by date range", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: { logs: [], total: 0 } });

      renderHook(() =>
        useCommunicationLogs({
          startDate: "2025-01-01",
          endDate: "2025-01-31",
        }),
      );

      await waitFor(() => {
        const callUrl = (apiClient.get as jest.Mock).mock.calls[0][0];
        expect(callUrl).toContain("start_date=2025-01-01");
        expect(callUrl).toContain("end_date=2025-01-31");
      });
    });

    it("should handle pagination", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: { logs: [], total: 0 } });

      renderHook(() => useCommunicationLogs({ page: 2, pageSize: 20 }));

      await waitFor(() => {
        const callUrl = (apiClient.get as jest.Mock).mock.calls[0][0];
        expect(callUrl).toContain("page=2");
        expect(callUrl).toContain("page_size=20");
      });
    });

    it("should combine all filters", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: { logs: [], total: 0 } });

      renderHook(() =>
        useCommunicationLogs({
          type: "email",
          status: "failed",
          recipient: "test@example.com",
          startDate: "2025-01-01",
          endDate: "2025-01-31",
          page: 1,
          pageSize: 50,
        }),
      );

      await waitFor(() => {
        const callUrl = (apiClient.get as jest.Mock).mock.calls[0][0];
        expect(callUrl).toContain("type=email");
        expect(callUrl).toContain("status=failed");
        expect(callUrl).toContain("recipient=test%40example.com");
        expect(callUrl).toContain("start_date=2025-01-01");
        expect(callUrl).toContain("end_date=2025-01-31");
        expect(callUrl).toContain("page=1");
        expect(callUrl).toContain("page_size=50");
      });
    });
  });

  describe("Actions - retryFailedCommunication", () => {
    it("should retry failed communication successfully", async () => {
      const logs = [createMockLog({ id: "log-1", status: "failed" })];
      (apiClient.get as jest.Mock).mockResolvedValue({ data: { logs, total: 1 } });
      (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: {} });

      const { result } = renderHook(() => useCommunicationLogs());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let success: boolean = false;
      await act(async () => {
        success = await result.current.retryFailedCommunication("log-1");
      });

      expect(success).toBe(true);
      expect(apiClient.post).toHaveBeenCalledWith("/communications/logs/log-1/retry");
      // Should refetch logs
      expect(apiClient.get).toHaveBeenCalledTimes(2);
    });

    it("should handle retry failure", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: { logs: [], total: 0 } });
      (apiClient.post as jest.Mock).mockRejectedValueOnce(new Error("API Error"));

      const { result } = renderHook(() => useCommunicationLogs());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let success: boolean = true;
      await act(async () => {
        success = await result.current.retryFailedCommunication("log-1");
      });

      expect(success).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should handle 403 errors gracefully", async () => {
      const error = { response: { status: 403 } };
      (axios.isAxiosError as jest.Mock).mockReturnValue(true);
      (apiClient.get as jest.Mock).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useCommunicationLogs());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.logs).toEqual([]);
      expect(result.current.total).toBe(0);
      expect(result.current.error).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it("should handle network errors", async () => {
      (apiClient.get as jest.Mock).mockRejectedValueOnce(new Error("Network Error"));

      const { result } = renderHook(() => useCommunicationLogs());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });
});

// ============================================
// Tests: useBulkNotifications (PREVIOUSLY UNTESTED!)
// ============================================

describe("useBulkNotifications", () => {
  const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("sendBulkNotification", () => {
    it("should send bulk notification successfully", async () => {
      const mockResponse: BulkNotificationResponse = {
        job_id: "job-123",
        total_recipients: 100,
        status: "queued",
      };

      (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: mockResponse });

      const { result } = renderHook(() => useBulkNotifications());

      expect(result.current.isLoading).toBe(false);

      let response: BulkNotificationResponse | null = null;
      await act(async () => {
        response = await result.current.sendBulkNotification({
          channels: ["email", "in_app"],
          recipient_filter: {
            subscriber_ids: ["sub-1", "sub-2"],
          },
        });
      });

      expect(response).toEqual(mockResponse);
      expect(apiClient.post).toHaveBeenCalledWith("/notifications/bulk", {
        channels: ["email", "in_app"],
        recipient_filter: {
          subscriber_ids: ["sub-1", "sub-2"],
        },
      });
      expect(result.current.isLoading).toBe(false);
    });

    it("should handle loading state during send", async () => {
      let resolvePromise: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      (apiClient.post as jest.Mock).mockReturnValue(promise);

      const { result } = renderHook(() => useBulkNotifications());

      expect(result.current.isLoading).toBe(false);

      act(() => {
        result.current.sendBulkNotification({
          channels: ["email"],
        });
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      await act(async () => {
        resolvePromise!({ data: { job_id: "job-123", total_recipients: 10, status: "queued" } });
        await promise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    it("should throw error on sendBulkNotification failure", async () => {
      (apiClient.post as jest.Mock).mockRejectedValueOnce(new Error("API Error"));

      const { result } = renderHook(() => useBulkNotifications());

      await expect(async () => {
        await act(async () => {
          await result.current.sendBulkNotification({
            channels: ["email"],
          });
        });
      }).rejects.toThrow("API Error");

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
    });

    it("should send bulk notification with template", async () => {
      (apiClient.post as jest.Mock).mockResolvedValueOnce({
        data: { job_id: "job-456", total_recipients: 50, status: "queued" },
      });

      const { result } = renderHook(() => useBulkNotifications());

      await act(async () => {
        await result.current.sendBulkNotification({
          template_id: "tpl-123",
          channels: ["email", "sms"],
          recipient_filter: {
            status: ["active"],
          },
        });
      });

      expect(apiClient.post).toHaveBeenCalledWith("/notifications/bulk", {
        template_id: "tpl-123",
        channels: ["email", "sms"],
        recipient_filter: {
          status: ["active"],
        },
      });
    });

    it("should send scheduled bulk notification", async () => {
      (apiClient.post as jest.Mock).mockResolvedValueOnce({
        data: {
          job_id: "job-789",
          total_recipients: 200,
          status: "queued",
          scheduled_at: "2025-01-20T10:00:00Z",
        },
      });

      const { result } = renderHook(() => useBulkNotifications());

      await act(async () => {
        await result.current.sendBulkNotification({
          channels: ["email"],
          schedule_at: "2025-01-20T10:00:00Z",
        });
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        "/notifications/bulk",
        expect.objectContaining({
          schedule_at: "2025-01-20T10:00:00Z",
        }),
      );
    });
  });

  describe("getBulkJobStatus", () => {
    it("should get bulk job status successfully", async () => {
      const mockResponse: BulkNotificationResponse = {
        job_id: "job-123",
        total_recipients: 100,
        status: "completed",
      };

      (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: mockResponse });

      const { result } = renderHook(() => useBulkNotifications());

      let response: BulkNotificationResponse | null = null;
      await act(async () => {
        response = await result.current.getBulkJobStatus("job-123");
      });

      expect(response).toEqual(mockResponse);
      expect(apiClient.get).toHaveBeenCalledWith("/notifications/bulk/job-123");
    });

    it("should return null on getBulkJobStatus failure", async () => {
      (apiClient.get as jest.Mock).mockRejectedValueOnce(new Error("API Error"));

      const { result } = renderHook(() => useBulkNotifications());

      let response: BulkNotificationResponse | null = {
        job_id: "test",
        total_recipients: 1,
        status: "queued",
      };
      await act(async () => {
        response = await result.current.getBulkJobStatus("job-123");
      });

      expect(response).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should handle different job statuses", async () => {
      const statuses: Array<BulkNotificationResponse["status"]> = [
        "queued",
        "processing",
        "completed",
        "failed",
      ];

      const { result } = renderHook(() => useBulkNotifications());

      for (const status of statuses) {
        (apiClient.get as jest.Mock).mockResolvedValueOnce({
          data: { job_id: `job-${status}`, total_recipients: 10, status },
        });

        let response: BulkNotificationResponse | null = null;
        await act(async () => {
          response = await result.current.getBulkJobStatus(`job-${status}`);
        });

        expect(response?.status).toBe(status);
      }
    });
  });
});

// ============================================
// Tests: useUnreadCount (PREVIOUSLY UNTESTED!)
// ============================================

describe("useUnreadCount", () => {
  const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
  const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

  beforeEach(() => {
    jest.clearAllMocks();
    (axios.isAxiosError as jest.Mock).mockReturnValue(false);
  });

  describe("Basic Functionality", () => {
    it("should fetch unread count successfully", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: { unread_count: 5 },
      });

      const { result } = renderHook(() => useUnreadCount());

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.unreadCount).toBe(5);
      expect(apiClient.get).toHaveBeenCalledWith("/notifications/unread-count");
    });

    it("should handle zero unread count", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: { unread_count: 0 },
      });

      const { result } = renderHook(() => useUnreadCount());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.unreadCount).toBe(0);
    });

    it("should refetch unread count", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { unread_count: 3 },
      });

      const { result } = renderHook(() => useUnreadCount());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(apiClient.get).toHaveBeenCalledTimes(1);

      await act(async () => {
        await result.current.refetch();
      });

      expect(apiClient.get).toHaveBeenCalledTimes(2);
    });
  });

  describe("Auto-refresh", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should auto-refresh with default interval (30s)", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { unread_count: 2 },
      });

      renderHook(() => useUnreadCount({ autoRefresh: true }));

      await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(1));

      await advanceTimersByTime(30000);

      expect(apiClient.get).toHaveBeenCalledTimes(2);
    });

    it("should auto-refresh with custom interval", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { unread_count: 1 },
      });

      renderHook(() => useUnreadCount({ autoRefresh: true, refreshInterval: 5000 }));

      await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(1));

      await advanceTimersByTime(5000);

      expect(apiClient.get).toHaveBeenCalledTimes(2);
    });

    it("should not auto-refresh when disabled", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { unread_count: 0 },
      });

      renderHook(() => useUnreadCount({ autoRefresh: false }));

      await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(1));

      await advanceTimersByTime(60000);

      expect(apiClient.get).toHaveBeenCalledTimes(1);
    });

    it("should cleanup interval on unmount", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { unread_count: 0 },
      });

      const { unmount } = renderHook(() => useUnreadCount({ autoRefresh: true }));

      await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(1));

      unmount();

      await advanceTimersByTime(60000);

      expect(apiClient.get).toHaveBeenCalledTimes(1);
    });
  });

  describe("Error Handling", () => {
    it("should handle 403 errors gracefully", async () => {
      const error = { response: { status: 403 } };
      (axios.isAxiosError as jest.Mock).mockReturnValue(true);
      (apiClient.get as jest.Mock).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useUnreadCount());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.unreadCount).toBe(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("403"));
    });

    it("should handle network errors", async () => {
      (apiClient.get as jest.Mock).mockRejectedValueOnce(new Error("Network Error"));

      const { result } = renderHook(() => useUnreadCount());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should handle missing data in response", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: null });

      const { result } = renderHook(() => useUnreadCount());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Should not crash, just not update count
      expect(result.current.unreadCount).toBe(0);
    });
  });
});
