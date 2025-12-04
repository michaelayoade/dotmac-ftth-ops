"use client";

/**
 * PWA Provider
 * Initializes service worker, manages offline status, and handles push notifications
 */

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  registerServiceWorker,
  subscribeToPushNotifications,
  requestNotificationPermission,
  onOnlineStatusChange,
  isOnline as checkIsOnline,
  saveOfflineTimeEntry,
  saveOfflineLocation,
  getPendingTimeEntries,
  getPendingLocations,
  registerPeriodicSync,
} from "@/lib/pwa";

interface PWAContextType {
  isOnline: boolean;
  isInstalled: boolean;
  notificationPermission: NotificationPermission;
  serviceWorkerRegistration: ServiceWorkerRegistration | null;
  requestNotifications: () => Promise<NotificationPermission>;
  subscribeToPush: () => Promise<boolean>;
  saveOfflineData: {
    timeEntry: (data: any) => Promise<void>;
    location: (data: any) => Promise<void>;
  };
  getPendingData: {
    timeEntries: () => Promise<any[]>;
    locations: () => Promise<any[]>;
  };
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

  useEffect(() => {
    // Initialize PWA features
    initializePWA();

    // Setup online/offline listeners
    const cleanup = onOnlineStatusChange(setIsOnline);

    // Check if installed
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    setIsInstalled(isStandalone);

    return cleanup;
  }, []);

  const initializePWA = async () => {
    // Set initial online status
    setIsOnline(checkIsOnline());

    // Register service worker
    const registration = await registerServiceWorker();

    if (registration) {
      setServiceWorkerRegistration(registration);
      console.log("Service worker ready");

      // Check notification permission
      if ("Notification" in window) {
        setNotificationPermission(Notification.permission);
      }

      // Setup periodic background sync for location updates (every 15 minutes)
      await registerPeriodicSync("update-technician-location", 15 * 60 * 1000);
    }
  };

  const requestNotifications = async (): Promise<NotificationPermission> => {
    const permission = await requestNotificationPermission();
    setNotificationPermission(permission);
    return permission;
  };

  const subscribeToPush = async (): Promise<boolean> => {
    if (!serviceWorkerRegistration) {
      console.error("Service worker not registered");
      return false;
    }

    const subscription = await subscribeToPushNotifications(serviceWorkerRegistration);
    return subscription !== null;
  };

  const value: PWAContextType = {
    isOnline,
    isInstalled,
    notificationPermission,
    serviceWorkerRegistration,
    requestNotifications,
    subscribeToPush,
    saveOfflineData: {
      timeEntry: saveOfflineTimeEntry,
      location: saveOfflineLocation,
    },
    getPendingData: {
      timeEntries: getPendingTimeEntries,
      locations: getPendingLocations,
    },
  };

  return (
    <PWAContext.Provider value={value}>
      {children}
      {/* Offline indicator */}
      {!isOnline && (
        <div className="fixed bottom-0 left-0 right-0 bg-yellow-500 text-white px-4 py-2 text-center text-sm font-medium z-50">
          <div className="flex items-center justify-center gap-2">
            <div className="h-2 w-2 bg-white rounded-full animate-pulse"></div>
            You&apos;re offline. Changes will sync when you reconnect.
          </div>
        </div>
      )}
    </PWAContext.Provider>
  );
}
