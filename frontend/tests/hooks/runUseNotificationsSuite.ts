/**
 * Shared test suite for useNotifications hook
 * Tests notification management functionality (fetch, read/unread, archive, delete)
 */
import { renderHook, waitFor, act } from "@testing-library/react";
import type {
  Notification,
  NotificationListResponse,
  NotificationPriority,
  NotificationType,
} from "../../apps/platform-admin-app/hooks/useNotifications";

type UseNotificationsHook = (options?: {
  unreadOnly?: boolean;
  priority?: NotificationPriority;
  notificationType?: NotificationType;
  autoRefresh?: boolean;
  refreshInterval?: number;
}) => {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<boolean>;
  markAsUnread: (notificationId: string) => Promise<boolean>;
  markAllAsRead: () => Promise<boolean>;
  archiveNotification: (notificationId: string) => Promise<boolean>;
  deleteNotification: (notificationId: string) => Promise<boolean>;
};

export function runUseNotificationsSuite(
  useNotifications: UseNotificationsHook,
  apiClient: any,
) {
  describe("useNotifications", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.restoreAllMocks();
      jest.useRealTimers();
    });

    describe("Happy Path", () => {
      it("should fetch notifications on mount", async () => {
        const mockNotifications: Notification[] = [
          {
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
          },
        ];

        const mockResponse: NotificationListResponse = {
          notifications: mockNotifications,
          total: 1,
          unread_count: 1,
        };

        apiClient.get.mockResolvedValueOnce({ data: mockResponse });

        const { result } = renderHook(() => useNotifications());

        expect(result.current.isLoading).toBe(true);

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.notifications).toEqual(mockNotifications);
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

        apiClient.get.mockResolvedValueOnce({ data: mockResponse });

        const { result } = renderHook(() =>
          useNotifications({
            unreadOnly: true,
            priority: "high",
            notificationType: "invoice_overdue",
          }),
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(apiClient.get).toHaveBeenCalledWith(
          "/notifications?unread_only=true&priority=high&notification_type=invoice_overdue",
        );
      });

      it("should mark notification as read", async () => {
        const mockNotifications: Notification[] = [
          {
            id: "notif-1",
            user_id: "user-1",
            tenant_id: "tenant-1",
            type: "payment_received",
            priority: "low",
            title: "Payment Received",
            message: "Your payment has been processed",
            is_read: false,
            is_archived: false,
            channels: ["in_app"],
            email_sent: false,
            sms_sent: false,
            push_sent: false,
            created_at: "2025-01-10T10:00:00Z",
            updated_at: "2025-01-10T10:00:00Z",
          },
        ];

        const mockResponse: NotificationListResponse = {
          notifications: mockNotifications,
          total: 1,
          unread_count: 1,
        };

        apiClient.get.mockResolvedValueOnce({ data: mockResponse });
        apiClient.post.mockResolvedValueOnce({});

        const { result } = renderHook(() => useNotifications());

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.unreadCount).toBe(1);

        let success: boolean = false;
        await act(async () => {
          success = await result.current.markAsRead("notif-1");
        });

        expect(success).toBe(true);
        expect(result.current.notifications[0].is_read).toBe(true);
        expect(result.current.unreadCount).toBe(0);
        expect(apiClient.post).toHaveBeenCalledWith("/notifications/notif-1/read", {});
      });

      it("should mark notification as unread", async () => {
        const mockNotifications: Notification[] = [
          {
            id: "notif-1",
            user_id: "user-1",
            tenant_id: "tenant-1",
            type: "ticket_created",
            priority: "high",
            title: "New Ticket",
            message: "A new support ticket has been created",
            is_read: true,
            read_at: "2025-01-10T11:00:00Z",
            is_archived: false,
            channels: ["in_app"],
            email_sent: false,
            sms_sent: false,
            push_sent: false,
            created_at: "2025-01-10T10:00:00Z",
            updated_at: "2025-01-10T11:00:00Z",
          },
        ];

        const mockResponse: NotificationListResponse = {
          notifications: mockNotifications,
          total: 1,
          unread_count: 0,
        };

        apiClient.get.mockResolvedValueOnce({ data: mockResponse });
        apiClient.post.mockResolvedValueOnce({});

        const { result } = renderHook(() => useNotifications());

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.unreadCount).toBe(0);

        let success: boolean = false;
        await act(async () => {
          success = await result.current.markAsUnread("notif-1");
        });

        expect(success).toBe(true);
        expect(result.current.notifications[0].is_read).toBe(false);
        expect(result.current.unreadCount).toBe(1);
        expect(apiClient.post).toHaveBeenCalledWith("/notifications/notif-1/unread", {});
      });

      it("should mark all notifications as read", async () => {
        const mockNotifications: Notification[] = [
          {
            id: "notif-1",
            user_id: "user-1",
            tenant_id: "tenant-1",
            type: "system_announcement",
            priority: "low",
            title: "System Maintenance",
            message: "Scheduled maintenance tonight",
            is_read: false,
            is_archived: false,
            channels: ["in_app"],
            email_sent: false,
            sms_sent: false,
            push_sent: false,
            created_at: "2025-01-10T10:00:00Z",
            updated_at: "2025-01-10T10:00:00Z",
          },
          {
            id: "notif-2",
            user_id: "user-1",
            tenant_id: "tenant-1",
            type: "password_reset",
            priority: "high",
            title: "Password Reset",
            message: "Your password was reset",
            is_read: false,
            is_archived: false,
            channels: ["in_app", "email"],
            email_sent: true,
            sms_sent: false,
            push_sent: false,
            created_at: "2025-01-10T09:00:00Z",
            updated_at: "2025-01-10T09:00:00Z",
          },
        ];

        const mockResponse: NotificationListResponse = {
          notifications: mockNotifications,
          total: 2,
          unread_count: 2,
        };

        apiClient.get.mockResolvedValueOnce({ data: mockResponse });
        apiClient.post.mockResolvedValueOnce({});

        const { result } = renderHook(() => useNotifications());

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.unreadCount).toBe(2);

        let success: boolean = false;
        await act(async () => {
          success = await result.current.markAllAsRead();
        });

        expect(success).toBe(true);
        expect(result.current.notifications.every((n) => n.is_read)).toBe(true);
        expect(result.current.unreadCount).toBe(0);
        expect(apiClient.post).toHaveBeenCalledWith("/notifications/mark-all-read");
      });

      it("should archive a notification", async () => {
        const mockNotifications: Notification[] = [
          {
            id: "notif-1",
            user_id: "user-1",
            tenant_id: "tenant-1",
            type: "service_outage",
            priority: "urgent",
            title: "Service Outage",
            message: "Network outage detected",
            is_read: true,
            is_archived: false,
            channels: ["in_app", "sms"],
            email_sent: false,
            sms_sent: true,
            push_sent: false,
            created_at: "2025-01-10T10:00:00Z",
            updated_at: "2025-01-10T10:00:00Z",
          },
          {
            id: "notif-2",
            user_id: "user-1",
            tenant_id: "tenant-1",
            type: "service_restored",
            priority: "medium",
            title: "Service Restored",
            message: "Network service has been restored",
            is_read: false,
            is_archived: false,
            channels: ["in_app"],
            email_sent: false,
            sms_sent: false,
            push_sent: false,
            created_at: "2025-01-10T11:00:00Z",
            updated_at: "2025-01-10T11:00:00Z",
          },
        ];

        const mockResponse: NotificationListResponse = {
          notifications: mockNotifications,
          total: 2,
          unread_count: 1,
        };

        apiClient.get.mockResolvedValueOnce({ data: mockResponse });
        apiClient.post.mockResolvedValueOnce({});

        const { result } = renderHook(() => useNotifications());

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.notifications).toHaveLength(2);

        let success: boolean = false;
        await act(async () => {
          success = await result.current.archiveNotification("notif-1");
        });

        expect(success).toBe(true);
        expect(result.current.notifications).toHaveLength(1);
        expect(result.current.notifications[0].id).toBe("notif-2");
        expect(apiClient.post).toHaveBeenCalledWith("/notifications/notif-1/archive", {});
      });

      it("should delete a notification", async () => {
        const mockNotifications: Notification[] = [
          {
            id: "notif-1",
            user_id: "user-1",
            tenant_id: "tenant-1",
            type: "custom",
            priority: "low",
            title: "Test Notification",
            message: "This is a test",
            is_read: true,
            is_archived: false,
            channels: ["in_app"],
            email_sent: false,
            sms_sent: false,
            push_sent: false,
            created_at: "2025-01-10T10:00:00Z",
            updated_at: "2025-01-10T10:00:00Z",
          },
        ];

        const mockResponse: NotificationListResponse = {
          notifications: mockNotifications,
          total: 1,
          unread_count: 0,
        };

        apiClient.get.mockResolvedValueOnce({ data: mockResponse });
        apiClient.delete.mockResolvedValueOnce({});

        const { result } = renderHook(() => useNotifications());

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.notifications).toHaveLength(1);

        let success: boolean = false;
        await act(async () => {
          success = await result.current.deleteNotification("notif-1");
        });

        expect(success).toBe(true);
        expect(result.current.notifications).toHaveLength(0);
        expect(apiClient.delete).toHaveBeenCalledWith("/notifications/notif-1");
      });

      it("should refetch notifications manually", async () => {
        const mockResponse: NotificationListResponse = {
          notifications: [],
          total: 0,
          unread_count: 0,
        };

        apiClient.get.mockResolvedValue({ data: mockResponse });

        const { result } = renderHook(() => useNotifications());

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        apiClient.get.mockClear();

        await act(async () => {
          await result.current.refetch();
        });

        expect(apiClient.get).toHaveBeenCalledWith("/notifications");
      });
    });

    describe("Error Handling", () => {
      it("should handle fetch errors", async () => {
        const mockError = new Error("Network error");
        apiClient.get.mockRejectedValueOnce(mockError);

        const { result } = renderHook(() => useNotifications());

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.error).toEqual(mockError);
        expect(result.current.notifications).toEqual([]);
      });

      it("should handle 403 errors gracefully", async () => {
        const mockError = {
          isAxiosError: true,
          response: { status: 403 },
        };
        apiClient.get.mockRejectedValueOnce(mockError);

        const { result } = renderHook(() => useNotifications());

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.error).toBeNull();
        expect(result.current.notifications).toEqual([]);
        expect(result.current.unreadCount).toBe(0);
      });

      it("should handle markAsRead errors", async () => {
        const mockNotifications: Notification[] = [
          {
            id: "notif-1",
            user_id: "user-1",
            tenant_id: "tenant-1",
            type: "invoice_due",
            priority: "high",
            title: "Invoice Due",
            message: "Your invoice is due soon",
            is_read: false,
            is_archived: false,
            channels: ["in_app"],
            email_sent: false,
            sms_sent: false,
            push_sent: false,
            created_at: "2025-01-10T10:00:00Z",
            updated_at: "2025-01-10T10:00:00Z",
          },
        ];

        const mockResponse: NotificationListResponse = {
          notifications: mockNotifications,
          total: 1,
          unread_count: 1,
        };

        apiClient.get.mockResolvedValueOnce({ data: mockResponse });
        apiClient.post.mockRejectedValueOnce(new Error("Failed to mark as read"));

        const { result } = renderHook(() => useNotifications());

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        let success: boolean = true;
        await act(async () => {
          success = await result.current.markAsRead("notif-1");
        });

        expect(success).toBe(false);
        // State should not change on error
        expect(result.current.notifications[0].is_read).toBe(false);
        expect(result.current.unreadCount).toBe(1);
      });

      it("should handle markAsUnread errors", async () => {
        const mockNotifications: Notification[] = [
          {
            id: "notif-1",
            user_id: "user-1",
            tenant_id: "tenant-1",
            type: "lead_assigned",
            priority: "medium",
            title: "Lead Assigned",
            message: "A new lead has been assigned to you",
            is_read: true,
            is_archived: false,
            channels: ["in_app"],
            email_sent: false,
            sms_sent: false,
            push_sent: false,
            created_at: "2025-01-10T10:00:00Z",
            updated_at: "2025-01-10T10:00:00Z",
          },
        ];

        const mockResponse: NotificationListResponse = {
          notifications: mockNotifications,
          total: 1,
          unread_count: 0,
        };

        apiClient.get.mockResolvedValueOnce({ data: mockResponse });
        apiClient.post.mockRejectedValueOnce(new Error("Failed to mark as unread"));

        const { result } = renderHook(() => useNotifications());

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        let success: boolean = true;
        await act(async () => {
          success = await result.current.markAsUnread("notif-1");
        });

        expect(success).toBe(false);
        expect(result.current.notifications[0].is_read).toBe(true);
        expect(result.current.unreadCount).toBe(0);
      });

      it("should handle markAllAsRead errors", async () => {
        const mockResponse: NotificationListResponse = {
          notifications: [],
          total: 0,
          unread_count: 0,
        };

        apiClient.get.mockResolvedValueOnce({ data: mockResponse });
        apiClient.post.mockRejectedValueOnce(new Error("Failed to mark all as read"));

        const { result } = renderHook(() => useNotifications());

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        let success: boolean = true;
        await act(async () => {
          success = await result.current.markAllAsRead();
        });

        expect(success).toBe(false);
      });

      it("should handle archive errors", async () => {
        const mockResponse: NotificationListResponse = {
          notifications: [],
          total: 0,
          unread_count: 0,
        };

        apiClient.get.mockResolvedValueOnce({ data: mockResponse });
        apiClient.post.mockRejectedValueOnce(new Error("Failed to archive"));

        const { result } = renderHook(() => useNotifications());

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        let success: boolean = true;
        await act(async () => {
          success = await result.current.archiveNotification("notif-1");
        });

        expect(success).toBe(false);
      });

      it("should handle delete errors", async () => {
        const mockResponse: NotificationListResponse = {
          notifications: [],
          total: 0,
          unread_count: 0,
        };

        apiClient.get.mockResolvedValueOnce({ data: mockResponse });
        apiClient.delete.mockRejectedValueOnce(new Error("Failed to delete"));

        const { result } = renderHook(() => useNotifications());

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        let success: boolean = true;
        await act(async () => {
          success = await result.current.deleteNotification("notif-1");
        });

        expect(success).toBe(false);
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty notifications list", async () => {
        const mockResponse: NotificationListResponse = {
          notifications: [],
          total: 0,
          unread_count: 0,
        };

        apiClient.get.mockResolvedValueOnce({ data: mockResponse });

        const { result } = renderHook(() => useNotifications());

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.notifications).toEqual([]);
        expect(result.current.unreadCount).toBe(0);
        expect(result.current.error).toBeNull();
      });

      it("should handle notifications with all optional fields", async () => {
        const mockNotifications: Notification[] = [
          {
            id: "notif-1",
            user_id: "user-1",
            tenant_id: "tenant-1",
            type: "quote_sent",
            priority: "high",
            title: "Quote Sent",
            message: "Your quote has been sent to the customer",
            action_url: "/crm/quotes/123",
            action_label: "View Quote",
            related_entity_type: "quote",
            related_entity_id: "quote-123",
            is_read: false,
            read_at: undefined,
            is_archived: false,
            archived_at: undefined,
            channels: ["in_app", "email", "push"],
            email_sent: true,
            email_sent_at: "2025-01-10T10:05:00Z",
            sms_sent: false,
            sms_sent_at: undefined,
            push_sent: true,
            push_sent_at: "2025-01-10T10:05:00Z",
            notification_metadata: { quote_id: "123", customer_name: "Acme Corp" },
            created_at: "2025-01-10T10:00:00Z",
            updated_at: "2025-01-10T10:05:00Z",
          },
        ];

        const mockResponse: NotificationListResponse = {
          notifications: mockNotifications,
          total: 1,
          unread_count: 1,
        };

        apiClient.get.mockResolvedValueOnce({ data: mockResponse });

        const { result } = renderHook(() => useNotifications());

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.notifications[0]).toHaveProperty("action_url");
        expect(result.current.notifications[0]).toHaveProperty("action_label");
        expect(result.current.notifications[0]).toHaveProperty("notification_metadata");
        expect(result.current.notifications[0].notification_metadata).toEqual({
          quote_id: "123",
          customer_name: "Acme Corp",
        });
      });

      it("should handle auto-refresh correctly", async () => {
        const mockResponse: NotificationListResponse = {
          notifications: [],
          total: 0,
          unread_count: 0,
        };

        apiClient.get.mockResolvedValue({ data: mockResponse });

        const { result } = renderHook(() =>
          useNotifications({ autoRefresh: true, refreshInterval: 5000 }),
        );

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        // Initial fetch
        expect(apiClient.get).toHaveBeenCalledTimes(1);

        // Fast-forward 5 seconds
        jest.advanceTimersByTime(5000);

        await waitFor(() => {
          expect(apiClient.get).toHaveBeenCalledTimes(2);
        });

        // Fast-forward another 5 seconds
        jest.advanceTimersByTime(5000);

        await waitFor(() => {
          expect(apiClient.get).toHaveBeenCalledTimes(3);
        });
      });

      it("should handle unread count correctly when marking as read", async () => {
        const mockNotifications: Notification[] = [
          {
            id: "notif-1",
            user_id: "user-1",
            tenant_id: "tenant-1",
            type: "bandwidth_limit_reached",
            priority: "urgent",
            title: "Bandwidth Limit",
            message: "Bandwidth limit has been reached",
            is_read: false,
            is_archived: false,
            channels: ["in_app"],
            email_sent: false,
            sms_sent: false,
            push_sent: false,
            created_at: "2025-01-10T10:00:00Z",
            updated_at: "2025-01-10T10:00:00Z",
          },
        ];

        const mockResponse: NotificationListResponse = {
          notifications: mockNotifications,
          total: 1,
          unread_count: 1,
        };

        apiClient.get.mockResolvedValueOnce({ data: mockResponse });
        apiClient.post.mockResolvedValueOnce({});

        const { result } = renderHook(() => useNotifications());

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.unreadCount).toBe(1);

        await act(async () => {
          await result.current.markAsRead("notif-1");
        });

        // Unread count should not go below 0
        expect(result.current.unreadCount).toBe(0);

        await act(async () => {
          await result.current.markAsRead("notif-1");
        });

        expect(result.current.unreadCount).toBe(0);
      });
    });
  });
}
