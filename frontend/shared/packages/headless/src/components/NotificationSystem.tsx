"use client";

import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from "lucide-react";
import { useEffect, useState } from "react";

// Removed unused imports: when, LayoutComposers
import {
  type Notification,
  type NotificationType,
  useNotifications,
} from "../hooks/useNotifications";

interface NotificationComponentProps {
  notification: Notification;
  onDismiss: (id: string) => void;
}

// Helper functions to reduce complexity
const notificationIcons: Record<NotificationType, JSX.Element> = {
  success: <CheckCircle className="h-5 w-5 text-green-600" />,
  error: <AlertCircle className="h-5 w-5 text-red-600" />,
  warning: <AlertTriangle className="h-5 w-5 text-yellow-600" />,
  info: <Info className="h-5 w-5 text-blue-600" />,
  system: <Info className="h-5 w-5 text-slate-600" />,
};

const notificationColors: Record<NotificationType, string> = {
  success: "bg-green-50 border-green-200 text-green-800",
  error: "bg-red-50 border-red-200 text-red-800",
  warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
  info: "bg-blue-50 border-blue-200 text-blue-800",
  system: "bg-slate-50 border-slate-200 text-slate-800",
};

// Composition helpers for notification rendering
const NotificationRenderers = {
  icon: ({ type }: { type: NotificationType }) => notificationIcons[type] as JSX.Element,
  title: ({ title }: { title: string }) => <p className="font-medium text-sm">{title}</p>,
  message: ({ message }: { message?: string }) =>
    message ? <p className="mt-1 text-sm opacity-90">{message}</p> : null,
  closeButton: ({
    onDismiss,
    id,
    persistent,
  }: {
    onDismiss: (id: string) => void;
    id: string;
    persistent?: boolean;
  }) =>
    persistent ? null : (
      <button
        type="button"
        onClick={() => onDismiss(id)}
        className="ml-4 inline-flex flex-shrink-0 rounded-md text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        <X className="h-4 w-4" />
      </button>
    ),
  actions: ({
    actions,
    onDismiss,
  }: {
    actions?: Array<{ label: string; action: () => void; primary?: boolean }>;
    onDismiss: () => void;
  }) =>
    actions && actions.length > 0 ? (
      <div className="mt-3 flex space-x-2">
        {actions.map((action, index) => {
          const handleActionClick = () => {
            action.action();
            if (!action.primary) {
              onDismiss();
            }
          };

          return (
            <button
              type="button"
              key={`action-${index}-${action.label}`}
              onClick={handleActionClick}
              onKeyDown={(event) => event.key === "Enter" && handleActionClick()}
              className={`rounded-md px-3 py-1 font-medium text-xs transition-colors ${
                action.primary
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {action.label}
            </button>
          );
        })}
      </div>
    ) : null,
  persistentDismiss: ({
    onDismiss,
    persistent,
  }: {
    onDismiss: () => void;
    persistent?: boolean;
  }) =>
    persistent ? (
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={onDismiss}
          onKeyDown={(e) => e.key === "Enter" && onDismiss}
          className="text-gray-500 text-xs hover:text-gray-700"
        >
          Dismiss
        </button>
      </div>
    ) : null,
  progressBar: ({ duration, persistent }: { duration?: number; persistent?: boolean }) =>
    duration && duration > 0 && !persistent ? (
      <div className="h-1 bg-gray-200">
        <div
          className="h-full bg-current opacity-30 transition-all ease-linear"
          style={{
            animationDuration: `${duration}ms`,
            animationName: "shrinkWidth",
            animationTimingFunction: "linear",
            animationFillMode: "forwards",
          }}
        />
      </div>
    ) : null,
};

function NotificationComponent({ notification, onDismiss }: NotificationComponentProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Animate in
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(notification.id);
    }, 300);
  };

  // Render notification header with icon, title and close button
  const renderHeader = () => (
    <>
      <div className="flex-shrink-0">{NotificationRenderers.icon({ type: notification.type })}</div>
      <div className="ml-3 w-0 flex-1">
        <div className="flex justify-between">
          {NotificationRenderers.title({ title: notification.title })}
          {NotificationRenderers.closeButton({
            onDismiss,
            id: notification.id,
            persistent: notification.persistent ?? false,
          })}
        </div>
      </div>
    </>
  );

  // Render notification content body
  const renderBody = () => (
    <>
      {notification.message && NotificationRenderers.message({ message: notification.message })}
      {notification.actions &&
        NotificationRenderers.actions({ actions: notification.actions, onDismiss: handleDismiss })}
    </>
  );

  return (
    <div
      className={`transform transition-all duration-300 ease-in-out ${isVisible && !isExiting ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}
        ${isExiting ? "scale-95" : "scale-100"}max-w-sm pointer-events-auto w-full rounded-lg border bg-white shadow-lg ${notificationColors[notification.type]}
      `}
    >
      <div className="p-4">
        <div className="flex items-start">{renderHeader()}</div>
        {renderBody()}
        {NotificationRenderers.persistentDismiss({
          onDismiss: handleDismiss,
          persistent: notification.persistent ?? false,
        })}
      </div>
      {NotificationRenderers.progressBar({
        duration: notification.duration ?? 5000,
        persistent: notification.persistent ?? false,
      })}
    </div>
  );
}

export function NotificationContainer() {
  const { notifications, remove } = useNotifications();

  if (notifications.length === 0) {
    return null;
  }

  return (
    <>
      <style>{`
        @keyframes shrinkWidth {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>

      <div
        aria-live="assertive"
        className="pointer-events-none fixed inset-0 z-50 flex items-end justify-end px-4 py-6 sm:p-6"
      >
        <div className="flex w-full flex-col items-center space-y-4 sm:items-end">
          {notifications.slice(0, 5).map((notification) => (
            <NotificationComponent
              key={notification.id}
              notification={notification}
              onDismiss={remove}
            />
          ))}

          {/* Overflow indicator */}
          {notifications.length > 5 && (
            <div className="w-full max-w-sm rounded-lg bg-gray-800 px-4 py-2 text-center text-white shadow-lg">
              <p className="text-xs">+{notifications.length - 5} more notifications</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// Notification provider component
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <NotificationContainer />
    </>
  );
}

// Toast notification hook for quick notifications
export function useToast() {
  const { notify } = useNotifications();

  return {
    success: (message: string) => notify.success("Success", message),
    error: (message: string) => notify.error("Error", message),
    warning: (message: string) => notify.warning("Warning", message),
    info: (message: string) => notify.info("Info", message),
  };
}
