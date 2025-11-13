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
import { useNotifications } from "@/hooks/useNotifications";
import { useConfirmDialog } from "@dotmac/ui";
import { cn } from "@/lib/utils";

interface NotificationCenterProps {
  maxNotifications?: number;
  refreshInterval?: number;
  showViewAll?: boolean;
  viewAllUrl?: string;
}

export function NotificationCenter(props: NotificationCenterProps) {
  return (
    <SharedNotificationCenter
      {...props}
      useNotifications={useNotifications as any}
      useConfirmDialog={useConfirmDialog}
      cn={cn}
    />
  );
}

export function NotificationBadge() {
  return <SharedNotificationBadge useNotifications={useNotifications as any} />;
}
