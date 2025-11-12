/**
 * Notification Center Component
 *
 * Wrapper that connects the shared NotificationCenter to app-specific dependencies.
 */

"use client";

import {
  NotificationCenter as SharedNotificationCenter,
  NotificationBadge as SharedNotificationBadge,
} from "@dotmac/features/notifications";
import { useNotifications as useNotificationQuery } from "@/hooks/useNotifications";
import { useConfirmDialog } from "@dotmac/ui";
import { cn } from "@/lib/utils";

interface NotificationCenterProps {
  maxNotifications?: number;
  refreshInterval?: number;
  showViewAll?: boolean;
  viewAllUrl?: string;
}

export function NotificationCenter(props: NotificationCenterProps) {
  const useSharedNotifications: Parameters<typeof SharedNotificationCenter>[0]["useNotifications"] = ({
    autoRefresh,
    refreshInterval,
  }) => {
    const hook = useNotificationQuery({
      autoRefresh,
      refreshInterval,
    });

    return {
      notifications: hook.notifications,
      unreadCount: hook.unreadCount,
      isLoading: hook.isLoading,
      error: hook.error ? String(hook.error) : "",
      markAsRead: async (notificationId: string) => {
        await hook.markAsRead(notificationId);
      },
      markAllAsRead: async () => {
        await hook.markAllAsRead();
      },
      archiveNotification: async (notificationId: string) => {
        await hook.archiveNotification(notificationId);
      },
      deleteNotification: async (notificationId: string) => {
        await hook.deleteNotification(notificationId);
      },
    };
  };

  return (
    <SharedNotificationCenter
      {...props}
      useNotifications={useSharedNotifications}
      useConfirmDialog={useConfirmDialog}
      cn={cn}
    />
  );
}

export function NotificationBadge() {
  const useSharedNotifications: Parameters<
    typeof SharedNotificationBadge
  >[0]["useNotifications"] = ({ autoRefresh, refreshInterval }) => {
    const hook = useNotificationQuery({
      autoRefresh,
      refreshInterval,
    });

    return {
      notifications: hook.notifications,
      unreadCount: hook.unreadCount,
      isLoading: hook.isLoading,
      error: hook.error ? String(hook.error) : "",
      markAsRead: async (notificationId: string) => {
        await hook.markAsRead(notificationId);
      },
      markAllAsRead: async () => {
        await hook.markAllAsRead();
      },
      archiveNotification: async (notificationId: string) => {
        await hook.archiveNotification(notificationId);
      },
      deleteNotification: async (notificationId: string) => {
        await hook.deleteNotification(notificationId);
      },
    };
  };

  return <SharedNotificationBadge useNotifications={useSharedNotifications} />;
}
