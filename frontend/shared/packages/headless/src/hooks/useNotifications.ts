import { useEffect, useMemo, useCallback } from "react";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export type NotificationType = "success" | "error" | "warning" | "info" | "system";

const applyNotificationOptions = (
  base: Omit<Notification, "id" | "timestamp">,
  options?: Partial<Notification>,
) => {
  if (!options) {
    return base;
  }

  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined) {
      (base as Record<string, unknown>)[key] = value;
    }
  }

  return base;
};

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
  persistent?: boolean;
  channel?: string[];
  actions?: {
    label: string;
    action: () => void;
    primary?: boolean;
  }[];
  priority?: "low" | "medium" | "high" | "critical";
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

interface NotificationStore {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, "id" | "timestamp">) => string;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  markAsRead: (id: string) => void;
  updateNotification: (id: string, updates: Partial<Notification>) => void;
}

const useNotificationStore = create<NotificationStore>()(
  subscribeWithSelector((set, get) => ({
    notifications: [],

    addNotification: (notificationData) => {
      const id = Math.random().toString(36).substring(7);
      const notification: Notification = {
        ...notificationData,
        id,
        timestamp: new Date(),
        duration: notificationData.duration ?? (notificationData.type === "error" ? 0 : 5000),
      };

      set((state) => ({
        notifications: [notification, ...state.notifications],
      }));

      // Auto-remove non-persistent notifications
      if (notification.duration && notification.duration > 0) {
        setTimeout(() => {
          get().removeNotification(id);
        }, notification.duration);
      }

      return id;
    },

    removeNotification: (id) => {
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
      }));
    },

    clearNotifications: () => {
      set({ notifications: [] });
    },

    markAsRead: (id) => {
      set((state) => ({
        notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
      }));
    },

    updateNotification: (id, updates) => {
      set((state) => ({
        notifications: state.notifications.map((n) => (n.id === id ? { ...n, ...updates } : n)),
      }));
    },
  })),
);

export function useNotifications() {
  const store = useNotificationStore();

  const notify = useMemo(
    () => ({
      success: (title: string, message?: string, options?: Partial<Notification>) => {
        const payload: Omit<Notification, "id" | "timestamp"> = {
          type: "success",
          title,
        };

        applyNotificationOptions(payload, options);

        if (message !== undefined) {
          payload.message = message;
        }

        return store.addNotification(payload);
      },

      error: (title: string, message?: string, options?: Partial<Notification>) => {
        const payload: Omit<Notification, "id" | "timestamp"> = {
          type: "error",
          title,
        };

        applyNotificationOptions(payload, options);

        if (payload.persistent === undefined) {
          payload.persistent = true;
        }

        if (message !== undefined) {
          payload.message = message;
        }

        return store.addNotification(payload);
      },

      warning: (title: string, message?: string, options?: Partial<Notification>) => {
        const payload: Omit<Notification, "id" | "timestamp"> = {
          type: "warning",
          title,
        };

        applyNotificationOptions(payload, options);

        if (message !== undefined) {
          payload.message = message;
        }

        return store.addNotification(payload);
      },

      info: (title: string, message?: string, options?: Partial<Notification>) => {
        const payload: Omit<Notification, "id" | "timestamp"> = {
          type: "info",
          title,
        };

        applyNotificationOptions(payload, options);

        if (message !== undefined) {
          payload.message = message;
        }

        return store.addNotification(payload);
      },
    }),
    [store],
  );

  return {
    notifications: store.notifications,
    notify,
    addNotification: store.addNotification,
    remove: store.removeNotification,
    clear: store.clearNotifications,
    markAsRead: store.markAsRead,
    update: store.updateNotification,
  };
}

// Hook for API error notifications
export function useApiErrorNotifications() {
  const { notify } = useNotifications();
  const parseApiError = (error: unknown): { status?: number; message?: string } => {
    if (typeof error === "object" && error !== null) {
      const candidate = error as { status?: number; message?: string };
      return {
        status: typeof candidate.status === "number" ? candidate.status : undefined,
        message: typeof candidate.message === "string" ? candidate.message : undefined,
      };
    }
    return {};
  };

  const notifyApiError = useCallback(
    (error: unknown, context?: string) => {
      const parsed = parseApiError(error);
      const status = parsed.status;
      const isNetworkError = status === 0 || !navigator.onLine;
      const isServerError = typeof status === "number" && status >= 500;
      const isAuthError = status === 401 || status === 403;

      let title = "Something went wrong";
      let message = parsed.message || "An unexpected error occurred";

      if (isNetworkError) {
        title = "Connection Problem";
        message = "Unable to connect to our servers. Please check your internet connection.";
      } else if (isServerError) {
        title = "Server Error";
        message = "Our servers are experiencing issues. Please try again later.";
      } else if (isAuthError) {
        title = "Authentication Required";
        message = "Please log in to continue.";
      }

      const contextMessage = context ? ` while ${context.toLowerCase()}` : "";

      return notify.error(title, message + contextMessage, {
        actions: [
          {
            label: "Retry",
            action: () => window.location.reload(),
          },
          ...(isAuthError
            ? [
                {
                  label: "Log In",
                  action: () => {
                    window.location.href = "/auth/login";
                  },
                  primary: true,
                },
              ]
            : []),
        ],
        metadata: {
          error,
          context,
          status,
          isNetworkError,
          isServerError,
          isAuthError,
        },
      });
    },
    [notify],
  );

  const notifyApiSuccess = useCallback(
    (message: string, context?: string) => {
      const contextMessage = context ? ` ${context}` : "";

      return notify.success("Success", message + contextMessage);
    },
    [notify],
  );

  return {
    notifyApiError,
    notifyApiSuccess,
  };
}

// Hook for handling specific error types
export function useErrorNotifications() {
  const { notify } = useNotifications();

  const notifyNetworkError = useCallback(() => {
    return notify.error("Network Error", "Please check your internet connection and try again.", {
      actions: [
        {
          label: "Retry",
          action: () => window.location.reload(),
          primary: true,
        },
      ],
    });
  }, [notify]);

  const notifyValidationError = useCallback(
    (errors: Record<string, string[]>) => {
      const errorMessages = Object.values(errors).flat();

      return notify.warning(
        "Validation Error",
        errorMessages.length === 1
          ? errorMessages[0]
          : `${errorMessages.length} validation errors occurred`,
        {
          metadata: { errors },
        },
      );
    },
    [notify],
  );

  const notifyPermissionError = useCallback(() => {
    return notify.error("Permission Denied", "You do not have permission to perform this action.", {
      actions: [
        {
          label: "Contact Support",
          action: () => {
            // Navigate to support page
            window.location.href = "/support";
          },
        },
      ],
    });
  }, [notify]);

  const notifyMaintenanceMode = useCallback(
    (estimatedTime?: string) => {
      return notify.warning(
        "Maintenance Mode",
        estimatedTime
          ? `Service will resume at ${estimatedTime}`
          : "The service is temporarily unavailable for maintenance.",
        {
          persistent: true,
          actions: [
            {
              label: "Check Status",
              action: () => {
                window.open("https://status.dotmac.com", "_blank");
              },
            },
          ],
        },
      );
    },
    [notify],
  );

  return {
    notifyNetworkError,
    notifyValidationError,
    notifyPermissionError,
    notifyMaintenanceMode,
  };
}

// Global error listener hook
export function useGlobalErrorListener() {
  const { notifyApiError } = useApiErrorNotifications();

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // Check if it's an API error
      if (event.reason?.status || event.reason?.message) {
        notifyApiError(event.reason, "processing request");
      }
    };

    const handleError = (event: ErrorEvent) => {
      // Only notify for unexpected errors, not development/console errors
      if (event.error && !event.error.message?.includes("ResizeObserver")) {
        notifyApiError(
          {
            message: event.error.message || "An unexpected error occurred",
          },
          "loading page",
        );
      }
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("error", handleError);

    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      window.removeEventListener("error", handleError);
    };
  }, [notifyApiError]);
}

export { useNotificationStore };
