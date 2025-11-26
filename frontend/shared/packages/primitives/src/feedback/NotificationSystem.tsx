import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";

export type NotificationType = "success" | "error" | "warning" | "info" | "system";
export type NotificationPriority = "low" | "medium" | "high" | "critical";
export type NotificationChannel = "browser" | "websocket" | "email" | "sms" | "push";

export interface Notification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  channel: NotificationChannel[];
  timestamp: Date;
  read: boolean;
  persistent: boolean;
  actions?: NotificationAction[];
  metadata?: Record<string, any>;
  expiresAt?: Date;
  userId?: string;
  tenantId?: string;
}

export interface NotificationAction {
  id: string;
  label: string;
  type: "primary" | "secondary" | "danger";
  handler: (notification: Notification) => void | Promise<void>;
}

export interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isConnected: boolean;
  settings: NotificationSettings;
}

export interface NotificationSettings {
  enableBrowser: boolean;
  enableWebSocket: boolean;
  enableEmail: boolean;
  enableSMS: boolean;
  enablePush: boolean;
  soundEnabled: boolean;
  maxNotifications: number;
  autoHideDelay: number;
  priorities: Record<NotificationPriority, boolean>;
  channels: Record<NotificationChannel, boolean>;
}

type NotificationAction_Type =
  | { type: "ADD_NOTIFICATION"; payload: Notification }
  | { type: "REMOVE_NOTIFICATION"; payload: string }
  | { type: "MARK_READ"; payload: string }
  | { type: "MARK_ALL_READ" }
  | { type: "CLEAR_ALL" }
  | { type: "UPDATE_SETTINGS"; payload: Partial<NotificationSettings> }
  | { type: "SET_CONNECTION_STATUS"; payload: boolean }
  | { type: "CLEANUP_EXPIRED" };

interface NotificationContextType {
  state: NotificationState;
  addNotification: (notification: Omit<Notification, "id" | "timestamp" | "read">) => void;
  removeNotification: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  clearNotifications: () => void;
  updateSettings: (settings: Partial<NotificationSettings>) => void;
  connect: () => void;
  disconnect: () => void;
}

const defaultSettings: NotificationSettings = {
  enableBrowser: true,
  enableWebSocket: true,
  enableEmail: false,
  enableSMS: false,
  enablePush: false,
  soundEnabled: true,
  maxNotifications: 100,
  autoHideDelay: 5000,
  priorities: {
    low: true,
    medium: true,
    high: true,
    critical: true,
  },
  channels: {
    browser: true,
    websocket: true,
    email: false,
    sms: false,
    push: false,
  },
};

const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
  isConnected: false,
  settings: defaultSettings,
};

function notificationReducer(
  state: NotificationState,
  action: NotificationAction_Type,
): NotificationState {
  switch (action.type) {
    case "ADD_NOTIFICATION": {
      const notification = action.payload;
      const notifications = [notification, ...state.notifications].slice(
        0,
        state.settings.maxNotifications,
      );

      return {
        ...state,
        notifications,
        unreadCount: state.unreadCount + (notification.read ? 0 : 1),
      };
    }

    case "REMOVE_NOTIFICATION": {
      const notifications = state.notifications.filter((n) => n.id !== action.payload);
      const removedNotification = state.notifications.find((n) => n.id === action.payload);
      const unreadCount =
        removedNotification && !removedNotification.read
          ? state.unreadCount - 1
          : state.unreadCount;

      return {
        ...state,
        notifications,
        unreadCount: Math.max(0, unreadCount),
      };
    }

    case "MARK_READ": {
      const notifications = state.notifications.map((n) =>
        n.id === action.payload ? { ...n, read: true } : n,
      );
      const notification = state.notifications.find((n) => n.id === action.payload);
      const unreadCount =
        notification && !notification.read ? state.unreadCount - 1 : state.unreadCount;

      return {
        ...state,
        notifications,
        unreadCount: Math.max(0, unreadCount),
      };
    }

    case "MARK_ALL_READ": {
      return {
        ...state,
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
        unreadCount: 0,
      };
    }

    case "CLEAR_ALL": {
      return {
        ...state,
        notifications: [],
        unreadCount: 0,
      };
    }

    case "UPDATE_SETTINGS": {
      return {
        ...state,
        settings: { ...state.settings, ...action.payload },
      };
    }

    case "SET_CONNECTION_STATUS": {
      return {
        ...state,
        isConnected: action.payload,
      };
    }

    case "CLEANUP_EXPIRED": {
      const now = new Date();
      const notifications = state.notifications.filter((n) => !n.expiresAt || n.expiresAt > now);
      const expiredCount = state.notifications.length - notifications.length;
      const expiredUnread = state.notifications.filter(
        (n) => n.expiresAt && n.expiresAt <= now && !n.read,
      ).length;

      return {
        ...state,
        notifications,
        unreadCount: Math.max(0, state.unreadCount - expiredUnread),
      };
    }

    default:
      return state;
  }
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export interface NotificationProviderProps {
  children: React.ReactNode;
  websocketUrl?: string;
  apiKey?: string;
  userId?: string;
  tenantId?: string;
  onError?: (error: Error) => void;
  maxNotifications?: number;
  defaultDuration?: number;
}

export function NotificationProvider({
  children,
  websocketUrl,
  apiKey,
  userId,
  tenantId,
  onError,
  maxNotifications,
  defaultDuration,
}: NotificationProviderProps) {
  const [state, dispatch] = useReducer(notificationReducer, initialState);
  const websocketRef = useRef<WebSocket | null>(null);
  const cleanupIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const soundRef = useRef<HTMLAudioElement | null>(null);

  // Generate unique notification ID
  const generateId = useCallback(() => {
    return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Play notification sound
  const playNotificationSound = useCallback(
    (type: NotificationType) => {
      if (!state.settings.soundEnabled) return;

      try {
        // Create audio element if not exists
        if (!soundRef.current) {
          soundRef.current = new Audio();
          soundRef.current.preload = "auto";
        }

        // Different sounds for different types
        const soundMap: Record<NotificationType, string> = {
          success: "/sounds/notification-success.wav",
          error: "/sounds/notification-error.wav",
          warning: "/sounds/notification-warning.wav",
          info: "/sounds/notification-info.wav",
          system: "/sounds/notification-system.wav",
        };

        soundRef.current.src = soundMap[type] || soundMap.info;
        soundRef.current.volume = 0.6;
        soundRef.current.play().catch(() => {
          // Ignore audio play errors (user interaction required)
        });
      } catch (error) {
        console.warn("Failed to play notification sound:", error);
      }
    },
    [state.settings.soundEnabled],
  );

  // Show browser notification
  const showBrowserNotification = useCallback(
    async (notification: Notification) => {
      if (!state.settings.enableBrowser || !("Notification" in window)) return;

      try {
        let permission = Notification.permission;

        if (permission === "default") {
          permission = await Notification.requestPermission();
        }

        if (permission === "granted") {
          const browserNotification = new Notification(notification.title, {
            body: notification.message,
            icon: `/icons/notification-${notification.type}.png`,
            badge: "/icons/badge.png",
            tag: notification.id,
            requireInteraction: notification.priority === "critical",
          });

          browserNotification.onclick = () => {
            window.focus();
            dispatch({ type: "MARK_READ", payload: notification.id });
            browserNotification.close();
          };

          // Auto-close after delay (except for critical notifications)
          if (notification.priority !== "critical" && state.settings.autoHideDelay > 0) {
            setTimeout(() => {
              browserNotification.close();
            }, state.settings.autoHideDelay);
          }
        }
      } catch (error) {
        console.warn("Failed to show browser notification:", error);
      }
    },
    [state.settings],
  );

  // WebSocket connection management
  const connect = useCallback(() => {
    if (!websocketUrl || !state.settings.enableWebSocket) return;

    try {
      if (websocketRef.current?.readyState === WebSocket.OPEN) return;

      const ws = new WebSocket(websocketUrl);
      websocketRef.current = ws;

      ws.onopen = () => {
        dispatch({ type: "SET_CONNECTION_STATUS", payload: true });

        // Send authentication if provided
        if (apiKey || userId) {
          ws.send(
            JSON.stringify({
              type: "auth",
              apiKey,
              userId,
              tenantId,
            }),
          );
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "notification") {
            const notification: Notification = {
              ...data.notification,
              id: generateId(),
              timestamp: new Date(data.notification.timestamp || Date.now()),
              read: false,
            };

            dispatch({ type: "ADD_NOTIFICATION", payload: notification });
          }
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      ws.onclose = () => {
        dispatch({ type: "SET_CONNECTION_STATUS", payload: false });

        // Reconnect after delay
        setTimeout(() => {
          if (state.settings.enableWebSocket) {
            connect();
          }
        }, 5000);
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        onError?.(new Error("WebSocket connection failed"));
        dispatch({ type: "SET_CONNECTION_STATUS", payload: false });
      };
    } catch (error) {
      console.error("Failed to establish WebSocket connection:", error);
      onError?.(error as Error);
    }
  }, [websocketUrl, state.settings.enableWebSocket, apiKey, userId, tenantId, onError, generateId]);

  const disconnect = useCallback(() => {
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }
    dispatch({ type: "SET_CONNECTION_STATUS", payload: false });
  }, []);

  // Add notification
  const addNotification = useCallback(
    (notificationData: Omit<Notification, "id" | "timestamp" | "read">) => {
      const notification: Notification = {
        ...notificationData,
        id: generateId(),
        timestamp: new Date(),
        read: false,
      };

      // Check if notification should be shown based on settings
      const shouldShow =
        state.settings.priorities[notification.priority] &&
        notification.channel.some((ch) => state.settings.channels[ch]);

      if (!shouldShow) return;

      dispatch({ type: "ADD_NOTIFICATION", payload: notification });

      // Handle different notification channels
      if (notification.channel.includes("browser")) {
        showBrowserNotification(notification);
      }

      // Play sound for high priority notifications
      if (["high", "critical"].includes(notification.priority)) {
        playNotificationSound(notification.type);
      }
    },
    [generateId, state.settings, showBrowserNotification, playNotificationSound],
  );

  // Other actions
  const removeNotification = useCallback((id: string) => {
    dispatch({ type: "REMOVE_NOTIFICATION", payload: id });
  }, []);

  const markAsRead = useCallback((id: string) => {
    dispatch({ type: "MARK_READ", payload: id });
  }, []);

  const markAllAsRead = useCallback(() => {
    dispatch({ type: "MARK_ALL_READ" });
  }, []);

  const clearAll = useCallback(() => {
    dispatch({ type: "CLEAR_ALL" });
  }, []);

  const updateSettings = useCallback((settings: Partial<NotificationSettings>) => {
    dispatch({ type: "UPDATE_SETTINGS", payload: settings });
  }, []);

  // Setup cleanup interval for expired notifications
  useEffect(() => {
    cleanupIntervalRef.current = setInterval(() => {
      dispatch({ type: "CLEANUP_EXPIRED" });
    }, 60000); // Check every minute

    return () => {
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
      }
    };
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (websocketUrl && state.settings.enableWebSocket) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [websocketUrl, state.settings.enableWebSocket, connect, disconnect]);

  useEffect(() => {
    if (typeof maxNotifications === "number" && maxNotifications > 0) {
      dispatch({ type: "UPDATE_SETTINGS", payload: { maxNotifications } });
    }
  }, [maxNotifications]);

  useEffect(() => {
    if (typeof defaultDuration === "number" && defaultDuration > 0) {
      dispatch({ type: "UPDATE_SETTINGS", payload: { autoHideDelay: defaultDuration } });
    }
  }, [defaultDuration]);

  const contextValue = useMemo<NotificationContextType>(
    () => ({
      state,
      addNotification,
      removeNotification,
      markAsRead,
      markAllAsRead,
      clearAll,
      clearNotifications: clearAll,
      updateSettings,
      connect,
      disconnect,
    }),
    [
      state,
      addNotification,
      removeNotification,
      markAsRead,
      markAllAsRead,
      clearAll,
      updateSettings,
      connect,
      disconnect,
    ],
  );

  return (
    <NotificationContext.Provider value={contextValue}>{children}</NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}

// Notification display components
export interface NotificationListProps {
  className?: string;
  maxVisible?: number;
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  showActions?: boolean;
  onNotificationClick?: (notification: Notification) => void;
}

export function NotificationList({
  className = "",
  maxVisible = 5,
  position = "top-right",
  showActions = true,
  onNotificationClick,
}: NotificationListProps) {
  const { state, removeNotification, markAsRead } = useNotifications();

  const visibleNotifications = useMemo(() => {
    return state.notifications.filter((n) => !n.persistent || !n.read).slice(0, maxVisible);
  }, [state.notifications, maxVisible]);

  const positionClasses = {
    "top-right": "fixed top-4 right-4 z-50",
    "top-left": "fixed top-4 left-4 z-50",
    "bottom-right": "fixed bottom-4 right-4 z-50",
    "bottom-left": "fixed bottom-4 left-4 z-50",
  };

  return (
    <div className={`${positionClasses[position]} space-y-2 ${className}`}>
      {visibleNotifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          showActions={showActions}
          onClose={() => removeNotification(notification.id)}
          onRead={() => markAsRead(notification.id)}
          onClick={() => onNotificationClick?.(notification)}
        />
      ))}
    </div>
  );
}

interface NotificationItemProps {
  notification: Notification;
  showActions: boolean;
  onClose: () => void;
  onRead: () => void;
  onClick: () => void;
}

function NotificationItem({
  notification,
  showActions,
  onClose,
  onRead,
  onClick,
}: NotificationItemProps) {
  const typeStyles = {
    success: "bg-green-50 border-green-200 text-green-800",
    error: "bg-red-50 border-red-200 text-red-800",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
    info: "bg-blue-50 border-blue-200 text-blue-800",
    system: "bg-gray-50 border-gray-200 text-gray-800",
  };

  const priorityIcons = {
    low: "📢",
    medium: "⚠️",
    high: "🔔",
    critical: "🚨",
  };

  return (
    <div
      className={`
        max-w-sm p-4 border rounded-lg shadow-lg cursor-pointer transition-all duration-300
        ${typeStyles[notification.type]}
        ${!notification.read ? "ring-2 ring-blue-500 ring-opacity-30" : ""}
      `}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-2 flex-1">
          <span className="text-lg">{priorityIcons[notification.priority]}</span>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm truncate">{notification.title}</h4>
            <p className="text-sm mt-1 break-words">{notification.message}</p>
            <p className="text-xs mt-2 opacity-70">{notification.timestamp.toLocaleTimeString()}</p>
          </div>
        </div>

        <div className="flex items-center space-x-1 ml-2">
          {!notification.read && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRead();
              }}
              className="text-xs bg-white bg-opacity-50 hover:bg-opacity-75 px-2 py-1 rounded"
              title="Mark as read"
            >
              ✓
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="text-xs bg-white bg-opacity-50 hover:bg-opacity-75 px-2 py-1 rounded"
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>

      {showActions && notification.actions && notification.actions.length > 0 && (
        <div className="flex space-x-2 mt-3 pt-3 border-t border-current border-opacity-20">
          {notification.actions.map((action) => (
            <button
              key={action.id}
              onClick={(e) => {
                e.stopPropagation();
                action.handler(notification);
              }}
              className={`
                text-xs px-3 py-1 rounded transition-colors
                ${action.type === "primary" ? "bg-blue-600 text-white hover:bg-blue-700" : ""}
                ${action.type === "secondary" ? "bg-gray-300 text-gray-700 hover:bg-gray-400" : ""}
                ${action.type === "danger" ? "bg-red-600 text-white hover:bg-red-700" : ""}
              `}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Notification badge component
export interface NotificationBadgeProps {
  className?: string;
  showCount?: boolean;
  maxCount?: number;
}

export function NotificationBadge({
  className = "",
  showCount = true,
  maxCount = 99,
}: NotificationBadgeProps) {
  const { state } = useNotifications();

  if (state.unreadCount === 0) {
    return null;
  }

  const displayCount = state.unreadCount > maxCount ? `${maxCount}+` : state.unreadCount;

  return (
    <span
      className={`
        inline-flex items-center justify-center px-2 py-1 text-xs font-bold 
        leading-none text-white bg-red-600 rounded-full ${className}
      `}
    >
      {showCount ? displayCount : ""}
    </span>
  );
}

// Main NotificationSystem component that combines provider and list
export interface NotificationSystemProps {
  children: React.ReactNode;
  maxNotifications?: number;
  defaultDuration?: number;
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
}

function NotificationSystem({
  children,
  maxNotifications = 10,
  defaultDuration = 5000,
  position = "top-right",
}: NotificationSystemProps) {
  return (
    <NotificationProvider maxNotifications={maxNotifications} defaultDuration={defaultDuration}>
      {children}
      <NotificationList position={position} />
    </NotificationProvider>
  );
}

// Convenience hook that aliases useNotifications for compatibility
export function useToast() {
  const { addNotification, removeNotification, clearNotifications } = useNotifications();

  const toast = useCallback(
    (message: string, options?: Partial<Omit<Notification, "id" | "timestamp" | "read">>) => {
      const notificationPayload: Omit<Notification, "id" | "timestamp" | "read"> = {
        title: options?.title || "Notification",
        message,
        type: options?.type || "info",
        priority: options?.priority || "medium",
        channel: options?.channel || ["browser"],
        persistent: options?.persistent || false,
        ...(options?.actions ? { actions: options.actions } : {}),
        ...(options?.metadata ? { metadata: options.metadata } : {}),
        ...(options?.expiresAt ? { expiresAt: options.expiresAt } : {}),
        ...(options?.userId ? { userId: options.userId } : {}),
        ...(options?.tenantId ? { tenantId: options.tenantId } : {}),
      };

      return addNotification(notificationPayload);
    },
    [addNotification],
  );

  const success = useCallback(
    (message: string, title?: string) => {
      return toast(message, { type: "success", title: title || "Success" });
    },
    [toast],
  );

  const error = useCallback(
    (message: string, title?: string) => {
      return toast(message, { type: "error", title: title || "Error" });
    },
    [toast],
  );

  const warning = useCallback(
    (message: string, title?: string) => {
      return toast(message, { type: "warning", title: title || "Warning" });
    },
    [toast],
  );

  const info = useCallback(
    (message: string, title?: string) => {
      return toast(message, { type: "info", title: title || "Info" });
    },
    [toast],
  );

  return {
    toast,
    success,
    error,
    warning,
    info,
    dismiss: removeNotification,
    clear: clearNotifications,
  };
}

export default NotificationSystem;
