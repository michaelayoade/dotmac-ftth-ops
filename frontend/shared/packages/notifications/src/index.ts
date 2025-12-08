/**
 * Universal Notifications Package
 * Temporary stub implementation for dashboard package compatibility
 */

import React, { useCallback, useMemo } from "react";

// Simple hooks for dashboard compatibility
export const useNotifications = () => {
  const showToast = useCallback(
    (message: string | { type?: string; title?: string; message?: string; duration?: number }) => {
      if (!message) {
        return;
      }

      if (typeof message === "string") {
        console.log("Toast:", message);
        return;
      }

      const { title = "Notification", message: body = "" } = message;
      console.log("Toast:", title, body);
    },
    [],
  );

  const addNotification = useCallback((notification: any) => {
    console.log("Notification:", notification);
  }, []);

  const removeNotification = useCallback((id: string) => {
    console.log("Remove notification:", id);
  }, []);

  const clearAll = useCallback(() => {
    console.log("Clear all notifications");
  }, []);

  return useMemo(
    () => ({
      showToast,
      addNotification,
      removeNotification,
      clearAll,
    }),
    [showToast, addNotification, removeNotification, clearAll],
  );
};

// Simple provider component
export const NotificationProvider = ({ children }: { children: React.ReactNode }) => children;

// Basic type exports
export type NotificationConfig = {
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
  duration?: number;
};

export type PortalVariant = "admin" | "customer" | "reseller" | "technician" | "management";
export type NotificationType = "toast" | "alert" | "inline";
export type NotificationPriority = "low" | "medium" | "high" | "critical";

// Stub exports for missing components
export const NotificationCenter = () => React.createElement("div", null, "Notification Center");
export const SystemAlertBanner = () => React.createElement("div", null, "System Alert Banner");
export const ToastContainer = () => React.createElement("div", null, "Toast Container");
export const RealtimeIndicator = () => React.createElement("div", null, "Realtime Indicator");
