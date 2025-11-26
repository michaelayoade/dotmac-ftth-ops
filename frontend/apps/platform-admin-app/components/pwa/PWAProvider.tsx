"use client";

/**
 * PWA Provider for Platform Admin
 * Initializes service worker, manages offline status, and handles push notifications
 */

import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo } from "react";
import {
  registerServiceWorker,
  subscribeToPushNotifications,
  requestNotificationPermission,
  onOnlineStatusChange,
  isOnline as checkIsOnline,
} from "@/lib/pwa";

interface PWAContextType {
  isOnline: boolean;
  isInstalled: boolean;
  notificationPermission: NotificationPermission;
  serviceWorkerRegistration: ServiceWorkerRegistration | null;
  requestNotifications: () => Promise<NotificationPermission>;
  subscribeToPush: () => Promise<boolean>;
}

const PWAContext = createContext<PWAContextType | undefined>(undefined);

export function usePWA() {
  const context = useContext(PWAContext);

  if (!context) {
    throw new Error("usePWA must be used within PWAProvider");
  }

  return context;
}

interface PWAProviderProps {
  children: ReactNode;
}

export default function PWAProvider({ children }: PWAProviderProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [isInstalled, setIsInstalled] = useState(false);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission>("default");
  const [serviceWorkerRegistration, setServiceWorkerRegistration] =
    useState<ServiceWorkerRegistration | null>(null);

  const initializePWA = useCallback(async () => {
    // Set initial online status
    setIsOnline(checkIsOnline());

    // Register service worker
    const registration = await registerServiceWorker();

    if (registration) {
      setServiceWorkerRegistration(registration);
      // Check notification permission
      if ("Notification" in window) {
        setNotificationPermission(Notification.permission);
      }
    }
  }, []);

  useEffect(() => {
    initializePWA();

    const cleanup = onOnlineStatusChange(setIsOnline);
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    setIsInstalled(isStandalone);

    return cleanup;
  }, [initializePWA]);

  const requestNotifications = useCallback(async (): Promise<NotificationPermission> => {
    const permission = await requestNotificationPermission();
    setNotificationPermission(permission);
    return permission;
  }, []);

  const subscribeToPush = useCallback(async (): Promise<boolean> => {
    if (!serviceWorkerRegistration) {
      return false;
    }

    const subscription = await subscribeToPushNotifications(serviceWorkerRegistration);
    return subscription !== null;
  }, [serviceWorkerRegistration]);

  const value: PWAContextType = useMemo(
    () => ({
      isOnline,
      isInstalled,
      notificationPermission,
      serviceWorkerRegistration,
      requestNotifications,
      subscribeToPush,
    }),
    [isInstalled, isOnline, notificationPermission, requestNotifications, serviceWorkerRegistration, subscribeToPush],
  );

  return (
    <PWAContext.Provider value={value}>
      {children}
      {/* Offline indicator */}
      {!isOnline && (
        <div className="fixed bottom-0 left-0 right-0 bg-yellow-500 text-white px-4 py-2 text-center text-sm font-medium z-50">
          <div className="flex items-center justify-center gap-2">
            <div className="h-2 w-2 bg-white rounded-full animate-pulse" />
            You&apos;re offline. Some features may be unavailable.
          </div>
        </div>
      )}
    </PWAContext.Provider>
  );
}
