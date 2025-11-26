/**
 * Platform Admin App - useNotifications comprehensive tests
 * Tests all notification management hooks with TanStack Query
 *
 * Covers:
 * - useNotifications: Main notification list with mutations
 * - useNotificationTemplates: Communication template management
 * - useCommunicationLogs: Communication history and logs
 * - useBulkNotifications: Bulk notification sending
 * - useUnreadCount: Lightweight unread count for badges
 */
import {
  useNotifications,
  useNotificationTemplates,
  useCommunicationLogs,
  useBulkNotifications,
  useUnreadCount,
  type Notification,
  type NotificationListResponse,
  type CommunicationTemplate,
  type CommunicationLog,
  type BulkNotificationResponse,
} from "../useNotifications";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { ReactNode } from "react";

// Ensure TanStack Query uses the real implementation even when automock is enabled
jest.mock("@tanstack/react-query", () => jest.requireActual("@tanstack/react-query"));

const buildUrl = (path: string) => {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const prefixed = normalized.startsWith("/api/v1") ? normalized : `/api/v1${normalized}`;
  return `${prefixed}`;
};

jest.mock("@/providers/AppConfigContext", () => ({
  useAppConfig: () => ({
    api: {
      baseUrl: "",
      prefix: "/api/v1",
      buildUrl,
    },
    features: {},
    branding: {},
    tenant: {},
  }),
}));

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
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const { apiClient } = jest.requireMock("@/lib/api/client");
const { logger } = jest.requireMock("@/lib/logger");

// Test data
const mockNotification: Notification = {
  id: "notif-1",
  user_id: "user-1",
  tenant_id: "tenant-1",
  type: "invoice_generated",
  priority: "medium",
  title: "Invoice Generated",
  message: "Your invoice for January has been generated",
  is_read: false,
  is_archived: false,
  channels: ["in_app", "email"],
  email_sent: true,
  sms_sent: false,
  push_sent: false,
  created_at: "2025-01-10T10:00:00Z",
  updated_at: "2025-01-10T10:00:00Z",
};

const mockTemplate: CommunicationTemplate = {
  id: "template-1",
  tenant_id: "tenant-1",
  name: "Welcome Email",
  description: "Welcome email for new users",
  type: "email",
  subject_template: "Welcome to {{company_name}}!",
  text_template: "Hello {{user_name}}, welcome to our platform!",
  html_template: "<h1>Welcome {{user_name}}</h1>",
  variables: ["company_name", "user_name"],
  required_variables: ["user_name"],
  is_active: true,
  is_default: false,
  usage_count: 42,
  created_at: "2025-01-01T10:00:00Z",
  updated_at: "2025-01-01T10:00:00Z",
};

const mockCommunicationLog: CommunicationLog = {
  id: "log-1",
  tenant_id: "tenant-1",
  type: "email",
  recipient: "user@example.com",
  sender: "noreply@platform.com",
  subject: "Welcome Email",
  text_body: "Welcome to our platform",
  status: "delivered",
  sent_at: "2025-01-10T10:00:00Z",
  delivered_at: "2025-01-10T10:01:00Z",
  retry_count: 0,
  provider: "sendgrid",
  template_id: "template-1",
  template_name: "Welcome Email",
  created_at: "2025-01-10T10:00:00Z",
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

describe("useNotifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const waitForNotificationsReady = async (result: ReturnType<typeof renderHook>["result"]) => {
    await waitFor(() => {
      expect(result.current).toBeDefined();
      expect(result.current?.isLoading).toBe(false);
    });
  };

  describe("Query - Fetch Notifications", () => {
    it("should fetch notifications successfully", async () => {
      const mockResponse: NotificationListResponse = {
        notifications: [mockNotification],
        total: 1,
        unread_count: 1,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(),
      });

      await waitForNotificationsReady(result);

      expect(result.current.notifications).toEqual([mockNotification]);
      expect(result.current.unreadCount).toBe(1);
      expect(result.current.error).toBeNull();
      expect(apiClient.get).toHaveBeenCalledWith("/notifications");
    });

    it("should fetch notifications with filters", async () => {
      const mockResponse: NotificationListResponse = {
        notifications: [],
        total: 0,
        unread_count: 0,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(
        () =>
          useNotifications({
            unreadOnly: true,
            priority: "high",
            notificationType: "invoice_overdue",
          }),
        { wrapper: createWrapper() }
      );

      await waitForNotificationsReady(result);

      expect(apiClient.get).toHaveBeenCalledWith(
        "/notifications?unread_only=true&priority=high&notification_type=invoice_overdue"
      );
    });

    it("should handle 403 errors gracefully", async () => {
      const mockError = {
        response: { status: 403 },
      };

      (apiClient.get as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(),
      });

      await waitForNotificationsReady(result);

      expect(result.current.notifications).toEqual([]);
      expect(result.current.unreadCount).toBe(0);
      expect(result.current.error).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        "Notifications endpoint returned 403. Using empty fallback data."
      );
    });

    it("should handle network errors", async () => {
      const mockError = new Error("Network error");
      (apiClient.get as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(),
      });

      await waitForNotificationsReady(result);

      expect(result.current.error).toEqual(mockError);
      expect(result.current.notifications).toEqual([]);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("Mutation - Mark as Read", () => {
    it("should mark notification as read with optimistic update", async () => {
      const mockResponse: NotificationListResponse = {
        notifications: [mockNotification],
        total: 1,
        unread_count: 1,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });
      (apiClient.post as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(),
      });

      await waitForNotificationsReady(result);

      expect(result.current.notifications[0].is_read).toBe(false);
      expect(result.current.unreadCount).toBe(1);

      let success: boolean = false;
      await act(async () => {
        success = await result.current.markAsRead("notif-1");
      });

      expect(success).toBe(true);
      await waitFor(() => expect(result.current.notifications[0].is_read).toBe(true));
      await waitFor(() => expect(result.current.unreadCount).toBe(0));
      expect(apiClient.post).toHaveBeenCalledWith("/notifications/notif-1/read", {});
    });

    it("should rollback on error", async () => {
      const mockResponse: NotificationListResponse = {
        notifications: [mockNotification],
        total: 1,
        unread_count: 1,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });
      (apiClient.post as jest.Mock).mockRejectedValue(new Error("Failed"));

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(),
      });

      await waitForNotificationsReady(result);

      let success: boolean = true;
      await act(async () => {
        success = await result.current.markAsRead("notif-1");
      });

      expect(success).toBe(false);
      // Should rollback to original state
      expect(result.current.notifications[0].is_read).toBe(false);
      expect(result.current.unreadCount).toBe(1);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("Mutation - Mark as Unread", () => {
    it("should mark notification as unread with optimistic update", async () => {
      const readNotification = { ...mockNotification, is_read: true };
      const mockResponse: NotificationListResponse = {
        notifications: [readNotification],
        total: 1,
        unread_count: 0,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });
      (apiClient.post as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(),
      });

      await waitForNotificationsReady(result);

      expect(result.current.unreadCount).toBe(0);

      let success: boolean = false;
      await act(async () => {
        success = await result.current.markAsUnread("notif-1");
      });

      expect(success).toBe(true);
      await waitFor(() => expect(result.current.notifications[0].is_read).toBe(false));
      await waitFor(() => expect(result.current.unreadCount).toBe(1));
      expect(apiClient.post).toHaveBeenCalledWith("/notifications/notif-1/unread", {});
    });

    it("should rollback on error", async () => {
      const readNotification = { ...mockNotification, is_read: true };
      const mockResponse: NotificationListResponse = {
        notifications: [readNotification],
        total: 1,
        unread_count: 0,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });
      (apiClient.post as jest.Mock).mockRejectedValue(new Error("Failed"));

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(),
      });

      await waitForNotificationsReady(result);

      let success: boolean = true;
      await act(async () => {
        success = await result.current.markAsUnread("notif-1");
      });

      expect(success).toBe(false);
      expect(result.current.notifications[0].is_read).toBe(true);
      expect(result.current.unreadCount).toBe(0);
    });
  });

  describe("Mutation - Mark All as Read", () => {
    it("should mark all notifications as read with optimistic update", async () => {
      const mockResponse: NotificationListResponse = {
        notifications: [
          mockNotification,
          { ...mockNotification, id: "notif-2" },
        ],
        total: 2,
        unread_count: 2,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });
      (apiClient.post as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.unreadCount).toBe(2);

      let success: boolean = false;
      await act(async () => {
        success = await result.current.markAllAsRead();
      });

      expect(success).toBe(true);
      await waitFor(() => expect(result.current.notifications.every((n) => n.is_read)).toBe(true));
      await waitFor(() => expect(result.current.unreadCount).toBe(0));
      expect(apiClient.post).toHaveBeenCalledWith("/notifications/mark-all-read");
    });

    it("should rollback on error", async () => {
      const mockResponse: NotificationListResponse = {
        notifications: [mockNotification],
        total: 1,
        unread_count: 1,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });
      (apiClient.post as jest.Mock).mockRejectedValue(new Error("Failed"));

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let success: boolean = true;
      await act(async () => {
        success = await result.current.markAllAsRead();
      });

      expect(success).toBe(false);
      expect(result.current.notifications[0].is_read).toBe(false);
      expect(result.current.unreadCount).toBe(1);
    });
  });

  describe("Mutation - Archive Notification", () => {
    it("should archive notification successfully", async () => {
      const mockResponse: NotificationListResponse = {
        notifications: [mockNotification, { ...mockNotification, id: "notif-2" }],
        total: 2,
        unread_count: 2,
      };

      // First call for initial fetch, second for refetch after archive
      (apiClient.get as jest.Mock)
        .mockResolvedValueOnce({ data: mockResponse })
        .mockResolvedValueOnce({
          data: {
            notifications: [{ ...mockNotification, id: "notif-2" }],
            total: 1,
            unread_count: 1,
          },
        });
      (apiClient.post as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.notifications).toHaveLength(2);

      let success: boolean = false;
      await act(async () => {
        success = await result.current.archiveNotification("notif-1");
      });

      expect(success).toBe(true);
      expect(apiClient.post).toHaveBeenCalledWith("/notifications/notif-1/archive", {});
    });

    it("should handle archive errors", async () => {
      const mockResponse: NotificationListResponse = {
        notifications: [mockNotification],
        total: 1,
        unread_count: 1,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });
      (apiClient.post as jest.Mock).mockRejectedValue(new Error("Failed"));

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let success: boolean = true;
      await act(async () => {
        success = await result.current.archiveNotification("notif-1");
      });

      expect(success).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("Mutation - Delete Notification", () => {
    it("should delete notification successfully", async () => {
      const mockResponse: NotificationListResponse = {
        notifications: [mockNotification],
        total: 1,
        unread_count: 1,
      };

      (apiClient.get as jest.Mock)
        .mockResolvedValueOnce({ data: mockResponse })
        .mockResolvedValueOnce({
          data: { notifications: [], total: 0, unread_count: 0 },
        });
      (apiClient.delete as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let success: boolean = false;
      await act(async () => {
        success = await result.current.deleteNotification("notif-1");
      });

      expect(success).toBe(true);
      expect(apiClient.delete).toHaveBeenCalledWith("/notifications/notif-1");
    });

    it("should handle delete errors", async () => {
      const mockResponse: NotificationListResponse = {
        notifications: [mockNotification],
        total: 1,
        unread_count: 1,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });
      (apiClient.delete as jest.Mock).mockRejectedValue(new Error("Failed"));

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let success: boolean = true;
      await act(async () => {
        success = await result.current.deleteNotification("notif-1");
      });

      expect(success).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("Refetch", () => {
    it("should refetch notifications manually", async () => {
      const mockResponse: NotificationListResponse = {
        notifications: [mockNotification],
        total: 1,
        unread_count: 1,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      (apiClient.get as jest.Mock).mockClear();

      await act(async () => {
        await result.current.refetch();
      });

      expect(apiClient.get).toHaveBeenCalledWith("/notifications");
    });
  });
});

describe("useNotificationTemplates", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Query - Fetch Templates", () => {
    it("should fetch templates successfully", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [mockTemplate] });

      const { result } = renderHook(() => useNotificationTemplates(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.templates).toEqual([mockTemplate]);
      expect(result.current.error).toBeNull();
      expect(apiClient.get).toHaveBeenCalledWith("/communications/templates");
    });

    it("should fetch templates with filters", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      const { result } = renderHook(
        () => useNotificationTemplates({ type: "email", activeOnly: true }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(apiClient.get).toHaveBeenCalledWith(
        "/communications/templates?type=email&active_only=true"
      );
    });

    it("should handle 403 errors gracefully", async () => {
      const mockError = {
        response: { status: 403 },
      };

      (apiClient.get as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useNotificationTemplates(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.templates).toEqual([]);
      expect(result.current.error).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        "Templates endpoint returned 403. Falling back to empty template list."
      );
    });

    it("should handle network errors", async () => {
      const mockError = new Error("Network error");
      (apiClient.get as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useNotificationTemplates(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toEqual(mockError);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("Mutation - Create Template", () => {
    it("should create template successfully", async () => {
      const newTemplate = {
        name: "Password Reset",
        type: "email" as const,
        subject_template: "Reset your password",
        text_template: "Click here to reset: {{reset_link}}",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockTemplate });

      const { result } = renderHook(() => useNotificationTemplates(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let createdTemplate: CommunicationTemplate | null = null;
      await act(async () => {
        createdTemplate = await result.current.createTemplate(newTemplate);
      });

      expect(createdTemplate).toEqual(mockTemplate);
      expect(apiClient.post).toHaveBeenCalledWith("/communications/templates", newTemplate);
    });

    it("should handle create errors", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
      (apiClient.post as jest.Mock).mockRejectedValue(new Error("Failed"));

      const { result } = renderHook(() => useNotificationTemplates(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let createdTemplate: CommunicationTemplate | null | undefined;
      await act(async () => {
        createdTemplate = await result.current.createTemplate({
          name: "Test",
          type: "email",
          text_template: "test",
        });
      });

      expect(createdTemplate).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("Mutation - Update Template", () => {
    it("should update template successfully", async () => {
      const updateData = {
        name: "Updated Template",
        is_active: false,
      };
      const updatedTemplate = { ...mockTemplate, ...updateData };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: [mockTemplate] });
      (apiClient.patch as jest.Mock).mockResolvedValue({ data: updatedTemplate });

      const { result } = renderHook(() => useNotificationTemplates(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let updated: CommunicationTemplate | null = null;
      await act(async () => {
        updated = await result.current.updateTemplate("template-1", updateData);
      });

      expect(updated).toEqual(updatedTemplate);
      expect(apiClient.patch).toHaveBeenCalledWith(
        "/communications/templates/template-1",
        updateData
      );
    });

    it("should handle update errors", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [mockTemplate] });
      (apiClient.patch as jest.Mock).mockRejectedValue(new Error("Failed"));

      const { result } = renderHook(() => useNotificationTemplates(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let updated: CommunicationTemplate | null | undefined;
      await act(async () => {
        updated = await result.current.updateTemplate("template-1", { name: "Updated" });
      });

      expect(updated).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("Mutation - Delete Template", () => {
    it("should delete template successfully", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [mockTemplate] });
      (apiClient.delete as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useNotificationTemplates(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let success: boolean = false;
      await act(async () => {
        success = await result.current.deleteTemplate("template-1");
      });

      expect(success).toBe(true);
      expect(apiClient.delete).toHaveBeenCalledWith("/communications/templates/template-1");
    });

    it("should handle delete errors", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [mockTemplate] });
      (apiClient.delete as jest.Mock).mockRejectedValue(new Error("Failed"));

      const { result } = renderHook(() => useNotificationTemplates(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let success: boolean = true;
      await act(async () => {
        success = await result.current.deleteTemplate("template-1");
      });

      expect(success).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("Helper - Render Template Preview", () => {
    it("should render template preview successfully", async () => {
      const mockPreview = {
        subject: "Welcome to Acme Corp!",
        text: "Hello John, welcome to our platform!",
        html: "<h1>Welcome John</h1>",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockPreview });

      const { result } = renderHook(() => useNotificationTemplates(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let preview: unknown;
      await act(async () => {
        preview = await result.current.renderTemplatePreview("template-1", {
          company_name: "Acme Corp",
          user_name: "John",
        });
      });

      expect(preview).toEqual(mockPreview);
      expect(apiClient.post).toHaveBeenCalledWith(
        "/communications/templates/template-1/render",
        { data: { company_name: "Acme Corp", user_name: "John" } }
      );
    });

    it("should handle render errors", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
      (apiClient.post as jest.Mock).mockRejectedValue(new Error("Failed"));

      const { result } = renderHook(() => useNotificationTemplates(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let preview: unknown;
      await act(async () => {
        preview = await result.current.renderTemplatePreview("template-1", {});
      });

      expect(preview).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });
  });
});

describe("useCommunicationLogs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Query - Fetch Logs", () => {
    it("should fetch communication logs successfully", async () => {
      const mockResponse = {
        logs: [mockCommunicationLog],
        total: 1,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useCommunicationLogs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.logs).toEqual([mockCommunicationLog]);
      expect(result.current.total).toBe(1);
      expect(result.current.error).toBeNull();
      expect(apiClient.get).toHaveBeenCalledWith("/communications/logs");
    });

    it("should fetch logs with filters", async () => {
      const mockResponse = { logs: [], total: 0 };
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(
        () =>
          useCommunicationLogs({
            type: "email",
            status: "delivered",
            recipient: "user@example.com",
            startDate: "2025-01-01",
            endDate: "2025-01-31",
            page: 1,
            pageSize: 20,
          }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(apiClient.get).toHaveBeenCalledWith(
        "/communications/logs?type=email&status=delivered&recipient=user%40example.com&start_date=2025-01-01&end_date=2025-01-31&page=1&page_size=20"
      );
    });

    it("should handle 403 errors gracefully", async () => {
      const mockError = {
        response: { status: 403 },
      };

      (apiClient.get as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useCommunicationLogs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.logs).toEqual([]);
      expect(result.current.total).toBe(0);
      expect(result.current.error).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        "Communications logs endpoint returned 403. Falling back to empty log set."
      );
    });

    it("should handle network errors", async () => {
      const mockError = new Error("Network error");
      (apiClient.get as jest.Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useCommunicationLogs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toEqual(mockError);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("Mutation - Retry Failed Communication", () => {
    it("should retry failed communication successfully", async () => {
      const mockResponse = { logs: [mockCommunicationLog], total: 1 };
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });
      (apiClient.post as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useCommunicationLogs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let success: boolean = false;
      await act(async () => {
        success = await result.current.retryFailedCommunication("log-1");
      });

      expect(success).toBe(true);
      expect(apiClient.post).toHaveBeenCalledWith("/communications/logs/log-1/retry");
    });

    it("should handle retry errors", async () => {
      const mockResponse = { logs: [mockCommunicationLog], total: 1 };
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });
      (apiClient.post as jest.Mock).mockRejectedValue(new Error("Failed"));

      const { result } = renderHook(() => useCommunicationLogs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let success: boolean = true;
      await act(async () => {
        success = await result.current.retryFailedCommunication("log-1");
      });

      expect(success).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("Refetch", () => {
    it("should refetch logs manually", async () => {
      const mockResponse = { logs: [mockCommunicationLog], total: 1 };
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useCommunicationLogs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      (apiClient.get as jest.Mock).mockClear();

      await act(async () => {
        await result.current.refetch();
      });

      expect(apiClient.get).toHaveBeenCalledWith("/communications/logs");
    });
  });
});

describe("useBulkNotifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Mutation - Send Bulk Notification", () => {
    it("should send bulk notification successfully", async () => {
      const bulkRequest = {
        recipient_filter: {
          subscriber_ids: ["sub-1", "sub-2"],
        },
        template_id: "template-1",
        channels: ["email", "in_app"] as const,
      };

      const mockResponse: BulkNotificationResponse = {
        job_id: "job-123",
        total_recipients: 2,
        status: "queued",
      };

      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useBulkNotifications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current).toBeDefined());

      let response: BulkNotificationResponse | null = null;
      await act(async () => {
        response = await result.current.sendBulkNotification(bulkRequest);
      });

      expect(response).toEqual(mockResponse);
      expect(apiClient.post).toHaveBeenCalledWith("/notifications/bulk", bulkRequest);
    });

    it("should handle send errors", async () => {
      const bulkRequest = {
        channels: ["email"] as const,
      };

      (apiClient.post as jest.Mock).mockRejectedValue(new Error("Failed"));

      const { result } = renderHook(() => useBulkNotifications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current).toBeDefined());

      let response: BulkNotificationResponse | null | undefined;
      await act(async () => {
        response = await result.current.sendBulkNotification(bulkRequest);
      });

      expect(response).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });

    it("should track loading state", async () => {
      const bulkRequest = {
        channels: ["email"] as const,
      };

      const mockResponse: BulkNotificationResponse = {
        job_id: "job-123",
        total_recipients: 10,
        status: "queued",
      };

      (apiClient.post as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ data: mockResponse }), 100);
          })
      );

      const { result } = renderHook(() => useBulkNotifications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current).toBeDefined());

      expect(result.current.isLoading).toBe(false);

      await act(async () => {
        const sendPromise = result.current!.sendBulkNotification(bulkRequest);
        await Promise.resolve();
        expect(result.current!.isLoading).toBe(true);
        await sendPromise;
      });

      // Should not be loading after completion
      expect(result.current!.isLoading).toBe(false);
    });
  });

  describe("Helper - Get Bulk Job Status", () => {
    it("should get job status successfully", async () => {
      const mockJobStatus: BulkNotificationResponse = {
        job_id: "job-123",
        total_recipients: 100,
        status: "completed",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockJobStatus });

      const { result } = renderHook(() => useBulkNotifications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current).toBeDefined());

      await waitFor(() => expect(result.current).toBeDefined());

      const { getBulkJobStatus } = result.current!;
      let status: BulkNotificationResponse | null = null;
      await act(async () => {
        status = await getBulkJobStatus("job-123");
      });

      expect(status).toEqual(mockJobStatus);
      expect(apiClient.get).toHaveBeenCalledWith("/notifications/bulk/job-123");
    });

    it("should handle status fetch errors", async () => {
      (apiClient.get as jest.Mock).mockRejectedValue(new Error("Failed"));

      const { result } = renderHook(() => useBulkNotifications(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current).toBeDefined());

      await waitFor(() => expect(result.current).toBeDefined());

      const { getBulkJobStatus } = result.current!;
      let status: BulkNotificationResponse | null = null;
      await act(async () => {
        status = await getBulkJobStatus("job-123");
      });

      expect(status).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });
  });
});

describe("useUnreadCount", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const waitForUnreadReady = async (result: ReturnType<typeof renderHook>["result"]) => {
    await waitFor(() => {
      expect(result.current).toBeDefined();
    });
    await waitFor(() => {
      expect(result.current?.isLoading).toBe(false);
    });
  };

  describe("Query - Fetch Unread Count", () => {
    it("should fetch unread count successfully", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: { unread_count: 5 } });

      const { result, unmount } = renderHook(() => useUnreadCount(), {
        wrapper: createWrapper(),
      });

      await waitForUnreadReady(result);

      expect(result.current!.unreadCount).toBe(5);
      expect(apiClient.get).toHaveBeenCalledWith("/notifications/unread-count");

      unmount();
    });

    it("should default to 0 when count is missing", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: {} });

      const { result, unmount } = renderHook(() => useUnreadCount(), {
        wrapper: createWrapper(),
      });

      await waitForUnreadReady(result);

      expect(result.current!.unreadCount).toBe(0);
      unmount();
    });

    it("should handle 403 errors gracefully", async () => {
      const mockError = {
        response: { status: 403 },
      };

      (apiClient.get as jest.Mock).mockRejectedValue(mockError);

      const { result, unmount } = renderHook(() => useUnreadCount(), {
        wrapper: createWrapper(),
      });

      await waitForUnreadReady(result);

      expect(result.current!.unreadCount).toBe(0);
      expect(logger.warn).toHaveBeenCalledWith(
        "Unread count endpoint returned 403. Defaulting to zero unread notifications."
      );
      unmount();
    });

    it("should handle network errors", async () => {
      const mockError = new Error("Network error");
      (apiClient.get as jest.Mock).mockRejectedValue(mockError);

      const { result, unmount } = renderHook(() => useUnreadCount(), {
        wrapper: createWrapper(),
      });

      await waitForUnreadReady(result);

      expect(result.current!.unreadCount).toBe(0);
      expect(logger.error).toHaveBeenCalled();
      unmount();
    });
  });

  describe("Auto-refresh", () => {
    it("should support auto-refresh when enabled", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: { unread_count: 3 } });

      const { result, unmount } = renderHook(
        () => useUnreadCount({ autoRefresh: true, refreshInterval: 5000 }),
        { wrapper: createWrapper() }
      );

      await waitForUnreadReady(result);

      expect(result.current!.unreadCount).toBe(3);
      expect(apiClient.get).toHaveBeenCalledWith("/notifications/unread-count");

      unmount();
    });

    it("should support default refresh interval", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: { unread_count: 3 } });

      const { result, unmount } = renderHook(() => useUnreadCount({ autoRefresh: true }), {
        wrapper: createWrapper(),
      });

      await waitForUnreadReady(result);

      expect(result.current!.unreadCount).toBe(3);
      expect(apiClient.get).toHaveBeenCalledWith("/notifications/unread-count");

      unmount();
    });
  });

  describe("Refetch", () => {
    it("should refetch count manually", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: { unread_count: 3 } });

      const { result, unmount } = renderHook(() => useUnreadCount(), {
        wrapper: createWrapper(),
      });

      await waitForUnreadReady(result);

      (apiClient.get as jest.Mock).mockClear();

      await act(async () => {
        await result.current!.refetch();
      });

      expect(apiClient.get).toHaveBeenCalledWith("/notifications/unread-count");

      unmount();
    });
  });
});
