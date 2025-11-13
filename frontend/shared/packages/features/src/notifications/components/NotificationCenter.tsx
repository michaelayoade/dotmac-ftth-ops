/**
 * Notification Center Component
 *
 * Bell icon dropdown in header showing recent notifications with actions.
 * Displays unread count badge and provides quick actions.
 */

"use client";

import { Badge } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@dotmac/ui";
import { ScrollArea } from "@dotmac/ui";
import { Skeleton } from "@dotmac/ui";
import { formatDistanceToNow } from "date-fns";
import { Bell, Check, CheckCheck, Archive, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { useState } from "react";

// ============================================================================
// Types
// ============================================================================

export type NotificationPriority = "low" | "medium" | "high" | "urgent";

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: NotificationPriority;
  is_read: boolean;
  created_at: string;
  action_url?: string;
  action_label?: string;
}

export interface NotificationsHook {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error?: string;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  archiveNotification: (notificationId: string) => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
}

export interface NotificationConfirmDialogFn {
  (options: {
    title: string;
    description: string;
    confirmText: string;
    variant: "destructive" | "default";
  }): Promise<boolean>;
}

export interface NotificationCenterProps {
  /** Maximum notifications to show in dropdown */
  maxNotifications?: number;
  /** Auto-refresh interval in milliseconds */
  refreshInterval?: number;
  /** Show "View All" link at bottom */
  showViewAll?: boolean;
  /** URL for "View All" link */
  viewAllUrl?: string;
  /** Hook for fetching notifications */
  useNotifications: (options: {
    autoRefresh: boolean;
    refreshInterval: number;
  }) => NotificationsHook;
  /** Confirm dialog function */
  useConfirmDialog: () => NotificationConfirmDialogFn;
  /** Utility function for class names */
  cn: (...classes: any[]) => string;
}

// ============================================================================
// Main Component
// ============================================================================

export function NotificationCenter({
  maxNotifications = 5,
  refreshInterval = 30000,
  showViewAll = true,
  viewAllUrl = "/dashboard/notifications",
  useNotifications,
  useConfirmDialog,
  cn,
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const confirmDialog = useConfirmDialog();

  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    markAsRead,
    markAllAsRead,
    archiveNotification,
    deleteNotification,
  } = useNotifications({
    autoRefresh: true,
    refreshInterval,
  });

  // Show only recent unread notifications in dropdown
  const recentNotifications = notifications.slice(0, maxNotifications);

  const handleMarkAsRead = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await markAsRead(notificationId);
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };

  const handleArchive = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await archiveNotification(notificationId);
  };

  const handleDelete = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = await confirmDialog({
      title: "Delete notification",
      description: "Are you sure you want to delete this notification?",
      confirmText: "Delete",
      variant: "destructive",
    });
    if (!confirmed) {
      return;
    }
    await deleteNotification(notificationId);
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }

    // Navigate to action URL if provided
    if (notification.action_url) {
      window.location.href = notification.action_url;
    }

    setIsOpen(false);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 h-5 min-w-[20px] rounded-full px-1 py-0 text-xs"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[400px] p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              className="h-auto px-2 py-1 text-xs"
            >
              <CheckCheck className="mr-1 h-3 w-3" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Notifications List */}
        <ScrollArea className="h-[400px]">
          {isLoading && (
            <div className="space-y-2 p-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              <p>Failed to load notifications</p>
              <Button variant="link" size="sm" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </div>
          )}

          {!isLoading && !error && recentNotifications.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="mb-2 h-12 w-12 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No notifications</p>
              <p className="text-xs text-muted-foreground">You&apos;re all caught up!</p>
            </div>
          )}

          {!isLoading && !error && recentNotifications.length > 0 && (
            <div className="divide-y">
              {recentNotifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onClick={() => handleNotificationClick(notification)}
                  onMarkAsRead={(e) => handleMarkAsRead(notification.id, e)}
                  onArchive={(e) => handleArchive(notification.id, e)}
                  onDelete={(e) => handleDelete(notification.id, e)}
                  cn={cn}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {showViewAll && !isLoading && recentNotifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => {
                  window.location.href = viewAllUrl;
                  setIsOpen(false);
                }}
              >
                View all notifications
                <ExternalLink className="ml-2 h-3 w-3" />
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============================================================================
// NotificationItem Component
// ============================================================================

interface NotificationItemProps {
  notification: Notification;
  onClick: () => void;
  onMarkAsRead: (e: React.MouseEvent) => void;
  onArchive: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  cn: (...classes: any[]) => string;
}

function NotificationItem({
  notification,
  onClick,
  onMarkAsRead,
  onArchive,
  onDelete,
  cn,
}: NotificationItemProps) {
  const priorityColors: Record<NotificationPriority, string> = {
    low: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
    urgent: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  };

  const notificationTypeLabels: Record<string, string> = {
    subscriber_provisioned: "Subscriber",
    subscriber_suspended: "Subscriber",
    service_activated: "Service",
    service_outage: "Network",
    invoice_generated: "Billing",
    invoice_overdue: "Billing",
    payment_received: "Payment",
    payment_failed: "Payment",
    ticket_created: "Ticket",
    ticket_updated: "Ticket",
    system_announcement: "Announcement",
  };

  return (
    <div
      className={cn(
        "group relative flex cursor-pointer items-start gap-3 p-4 transition-colors hover:bg-accent",
        !notification.is_read && "bg-blue-50/50 dark:bg-blue-950/20",
      )}
      onClick={onClick}
    >
      {/* Unread indicator */}
      {!notification.is_read && (
        <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-600" />
      )}

      {/* Content */}
      <div className="flex-1 space-y-1">
        {/* Title with priority badge */}
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-tight">{notification.title}</p>
          {notification.priority !== "medium" && (
            <Badge
              variant="outline"
              className={cn("flex-shrink-0 text-xs", priorityColors[notification.priority])}
            >
              {notification.priority}
            </Badge>
          )}
        </div>

        {/* Message */}
        <p className="line-clamp-2 text-xs text-muted-foreground">{notification.message}</p>

        {/* Metadata */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            {formatDistanceToNow(new Date(notification.created_at), {
              addSuffix: true,
            })}
          </span>
          {notificationTypeLabels[notification.type] && (
            <>
              <span>•</span>
              <span>{notificationTypeLabels[notification.type]}</span>
            </>
          )}
        </div>

        {/* Action button */}
        {notification.action_label && notification.action_url && (
          <Button variant="link" size="sm" className="h-auto p-0 text-xs">
            {notification.action_label}
            <ExternalLink className="ml-1 h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Quick actions (shown on hover) */}
      <div className="flex flex-shrink-0 items-start gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {!notification.is_read && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onMarkAsRead}
            title="Mark as read"
          >
            <Check className="h-3 w-3" />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onArchive} title="Archive">
          <Archive className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-destructive"
          onClick={onDelete}
          title="Delete"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Lightweight Badge-Only Version (for minimal layouts)
// ============================================================================

export interface NotificationBadgeProps {
  useNotifications: (options: {
    autoRefresh: boolean;
    refreshInterval: number;
  }) => NotificationsHook;
}

export function NotificationBadge({ useNotifications }: NotificationBadgeProps) {
  const { unreadCount, isLoading } = useNotifications({
    autoRefresh: true,
    refreshInterval: 60000, // 1 minute
  });

  if (isLoading || unreadCount === 0) {
    return null;
  }

  return (
    <Badge variant="destructive" className="h-5 min-w-[20px] rounded-full px-1 py-0 text-xs">
      {unreadCount > 99 ? "99+" : unreadCount}
    </Badge>
  );
}
