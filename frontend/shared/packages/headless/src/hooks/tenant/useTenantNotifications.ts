/**
 * Tenant Notifications Management Hook
 * Handles tenant-level notifications and alerts
 */

import { useState, useCallback, useEffect } from "react";
import type { TenantNotification, TenantSession } from "../../types/tenant";
import { getISPApiClient } from "../../api/isp-client";

export interface UseTenantNotificationsReturn {
  notifications: TenantNotification[];
  unreadCount: number;
  isLoading: boolean;
  loadNotifications: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  dismissNotification: (notificationId: string) => Promise<void>;
  addNotification: (notification: Omit<TenantNotification, "id" | "created_at">) => void;
}

export function useTenantNotifications(
  session: TenantSession | null,
): UseTenantNotificationsReturn {
  const [notifications, setNotifications] = useState<TenantNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const loadNotifications = useCallback(async () => {
    if (!session?.tenant?.id) return;

    setIsLoading(true);

    try {
      const apiClient = getISPApiClient();
      const response = await apiClient.getTenantNotifications(session.tenant.id, {
        limit: 50,
        include_read: true,
      });

      setNotifications(response.data);
    } catch (error) {
      console.error("Failed to load notifications:", error);
      // Don't throw - notifications are non-critical
    } finally {
      setIsLoading(false);
    }
  }, [session?.tenant?.id]);

  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!session?.tenant?.id) return;

      try {
        const apiClient = getISPApiClient();
        await apiClient.markNotificationRead(notificationId);

        setNotifications((prev) =>
          prev.map((notification) =>
            notification.id === notificationId
              ? {
                  ...notification,
                  read: true,
                  read_at: new Date().toISOString(),
                }
              : notification,
          ),
        );
      } catch (error) {
        console.error("Failed to mark notification as read:", error);
      }
    },
    [session?.tenant?.id],
  );

  const markAllAsRead = useCallback(async () => {
    if (!session?.tenant?.id) return;

    try {
      const apiClient = getISPApiClient();
      await apiClient.markAllNotificationsRead(session.tenant.id);

      const now = new Date().toISOString();
      setNotifications((prev) =>
        prev.map((notification) => ({
          ...notification,
          read: true,
          read_at: notification.read_at || now,
        })),
      );
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  }, [session?.tenant?.id]);

  const dismissNotification = useCallback(
    async (notificationId: string) => {
      if (!session?.tenant?.id) return;

      try {
        const apiClient = getISPApiClient();
        await apiClient.dismissNotification(notificationId);

        setNotifications((prev) =>
          prev.filter((notification) => notification.id !== notificationId),
        );
      } catch (error) {
        console.error("Failed to dismiss notification:", error);
      }
    },
    [session?.tenant?.id],
  );

  const addNotification = useCallback(
    (notification: Omit<TenantNotification, "id" | "created_at">) => {
      const newNotification: TenantNotification = {
        ...notification,
        id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        created_at: new Date().toISOString(),
      };

      setNotifications((prev) => [newNotification, ...prev]);
    },
    [],
  );

  // Load notifications when session changes
  useEffect(() => {
    if (session?.tenant?.id) {
      loadNotifications();
    } else {
      setNotifications([]);
    }
  }, [session?.tenant?.id, loadNotifications]);

  return {
    notifications,
    unreadCount,
    isLoading,
    loadNotifications,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    addNotification,
  };
}
