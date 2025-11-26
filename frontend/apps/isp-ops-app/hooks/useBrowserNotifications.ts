/**
 * Browser Notifications Hook
 *
 * Manages browser notifications for real-time events like geofence alerts,
 * job updates, and technician arrivals.
 */

import { useEffect, useState, useCallback } from "react";

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  requireInteraction?: boolean;
  silent?: boolean;
  data?: any;
  onClick?: () => void;
}

export interface UseBrowserNotificationsReturn {
  isSupported: boolean;
  permission: NotificationPermission;
  requestPermission: () => Promise<NotificationPermission>;
  showNotification: (options: NotificationOptions) => Promise<void>;
  isEnabled: boolean;
  setIsEnabled: (enabled: boolean) => void;
}

/**
 * Hook for managing browser notifications
 *
 * @example
 * ```tsx
 * const { showNotification, requestPermission, permission } = useBrowserNotifications();
 *
 * // Request permission
 * await requestPermission();
 *
 * // Show notification
 * await showNotification({
 *   title: "Technician Arrived",
 *   body: "John Doe has arrived at job site #1234",
 *   icon: "/technician-icon.png",
 *   onClick: () => navigate('/jobs/1234'),
 * });
 * ```
 */
export function useBrowserNotifications(): UseBrowserNotificationsReturn {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isEnabled, setIsEnabled] = useState(() => {
    // Load from localStorage
    const stored = localStorage.getItem("browser_notifications_enabled");
    return stored !== null ? stored === "true" : true; // Default: enabled
  });

  // Check if notifications are supported
  const isSupported = "Notification" in window;

  // Update permission state
  useEffect(() => {
    if (isSupported) {
      setPermission(Notification.permission);
    }
  }, [isSupported]);

  // Update localStorage when enabled changes
  useEffect(() => {
    localStorage.setItem("browser_notifications_enabled", String(isEnabled));
  }, [isEnabled]);

  /**
   * Request notification permission from user
   */
  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!isSupported) {
      return "denied";
    }

    if (permission === "granted") {
      return "granted";
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    } catch (error) {
      console.error("Failed to request notification permission:", error);
      return "denied";
    }
  }, [isSupported, permission]);

  /**
   * Show a browser notification
   */
  const showNotification = useCallback(
    async (options: NotificationOptions): Promise<void> => {
      // Check if enabled
      if (!isEnabled) {
        console.log("[Notifications] Disabled by user");
        return;
      }

      // Check support
      if (!isSupported) {
        console.warn("[Notifications] Not supported in this browser");
        return;
      }

      // Check permission
      if (permission !== "granted") {
        console.warn("[Notifications] Permission not granted");
        return;
      }

      try {
        const notificationOptions: globalThis.NotificationOptions = {
          body: options.body,
          icon: options.icon || "/favicon.ico",
          requireInteraction: options.requireInteraction || false,
          silent: options.silent || false,
          data: options.data,
        };
        if (options.tag) {
          notificationOptions.tag = options.tag;
        }

        const notification = new Notification(options.title, notificationOptions);

        // Handle click
        if (options.onClick) {
          notification.onclick = () => {
            window.focus();
            options.onClick?.();
            notification.close();
          };
        }

        // Auto-close after 10 seconds if not requiring interaction
        if (!options.requireInteraction) {
          setTimeout(() => {
            notification.close();
          }, 10000);
        }

        console.log("[Notifications] Shown:", options.title);
      } catch (error) {
        console.error("[Notifications] Failed to show:", error);
      }
    },
    [isSupported, permission, isEnabled],
  );

  return {
    isSupported,
    permission,
    requestPermission,
    showNotification,
    isEnabled,
    setIsEnabled,
  };
}

/**
 * Hook for handling geofence event notifications
 *
 * Automatically shows notifications when technicians arrive/depart from job sites.
 */
export function useGeofenceNotifications(enabled: boolean = true) {
  const notifications = useBrowserNotifications();

  const handleGeofenceEvent = useCallback(
    async (event: {
      technician_name: string;
      job_id: string;
      event_type: "enter" | "exit";
      message: string;
    }) => {
      if (!enabled) return;

      const isArrival = event.event_type === "enter";
      const title = isArrival ? "🚀 Technician Arrived" : "✅ Technician Departed";

      const body = `${event.technician_name} ${isArrival ? "arrived at" : "left"} job site\n${event.message}`;

      await notifications.showNotification({
        title,
        body,
        tag: `geofence-${event.job_id}`,
        requireInteraction: isArrival, // Arrival requires acknowledgment
        data: { jobId: event.job_id, type: "geofence" },
      });
    },
    [enabled, notifications],
  );

  return {
    ...notifications,
    handleGeofenceEvent,
  };
}

/**
 * Hook for handling job status notifications
 */
export function useJobNotifications(enabled: boolean = true) {
  const notifications = useBrowserNotifications();

  const handleJobStatusChange = useCallback(
    async (event: {
      job_id: string;
      job_title: string;
      old_status: string;
      new_status: string;
    }) => {
      if (!enabled) return;

      const statusEmojis: Record<string, string> = {
        pending: "⏳",
        assigned: "👤",
        running: "🔧",
        completed: "✅",
        failed: "❌",
        cancelled: "🚫",
      };

      const emoji = statusEmojis[event.new_status] || "📋";
      const title = `${emoji} Job ${event.new_status.toUpperCase()}`;
      const body = `${event.job_title}\n${event.old_status} → ${event.new_status}`;

      await notifications.showNotification({
        title,
        body,
        tag: `job-${event.job_id}`,
        requireInteraction: event.new_status === "failed",
        data: { jobId: event.job_id, type: "job_status" },
      });
    },
    [enabled, notifications],
  );

  return {
    ...notifications,
    handleJobStatusChange,
  };
}

/**
 * Hook for handling technician status notifications
 */
export function useTechnicianNotifications(enabled: boolean = true) {
  const notifications = useBrowserNotifications();

  const handleTechnicianStatusChange = useCallback(
    async (event: {
      technician_id: string;
      technician_name: string;
      old_status: string;
      new_status: string;
    }) => {
      if (!enabled) return;

      const statusEmojis: Record<string, string> = {
        available: "✅",
        on_job: "🔧",
        on_break: "☕",
        off_duty: "🏠",
        unavailable: "❌",
      };

      const emoji = statusEmojis[event.new_status] || "👤";
      const title = `${emoji} ${event.technician_name}`;
      const body = `Status changed: ${event.old_status} → ${event.new_status}`;

      await notifications.showNotification({
        title,
        body,
        tag: `technician-${event.technician_id}`,
        requireInteraction: false,
        data: { technicianId: event.technician_id, type: "technician_status" },
      });
    },
    [enabled, notifications],
  );

  return {
    ...notifications,
    handleTechnicianStatusChange,
  };
}
