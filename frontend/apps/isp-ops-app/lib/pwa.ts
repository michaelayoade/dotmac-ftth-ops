/**
 * PWA Utilities
 * Service worker registration, push notifications, and offline sync
 */

// ============================================================================
// Service Worker Registration
// ============================================================================

const isDev = process.env["NODE_ENV"] !== "production";

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    if (isDev) console.log("Service workers not supported");
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });

    if (isDev) console.log("Service worker registered:", registration.scope);

    // Check for updates every hour
    setInterval(
      () => {
        registration.update();
      },
      60 * 60 * 1000,
    );

    // Listen for update found
    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;

      if (newWorker) {
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            // New service worker available, show update notification
            notifyUpdate();
          }
        });
      }
    });

    return registration;
  } catch (error) {
    console.error("Service worker registration failed:", error);
    return null;
  }
}

function notifyUpdate() {
  if (confirm("A new version is available. Reload to update?")) {
    window.location.reload();
  }
}

// ============================================================================
// Push Notifications
// ============================================================================

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) {
    if (isDev) console.log("Notifications not supported");
    return "denied";
  }

  if (Notification.permission === "granted") {
    return "granted";
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission;
  }

  return Notification.permission;
}

export async function subscribeToPushNotifications(
  registration: ServiceWorkerRegistration,
): Promise<PushSubscription | null> {
  try {
    const permission = await requestNotificationPermission();

    if (permission !== "granted") {
      if (isDev) console.log("Notification permission denied");
      return null;
    }

    // Get VAPID public key from environment or server
    const vapidPublicKey = process["env"]["NEXT_PUBLIC_VAPID_PUBLIC_KEY"] || "";

    if (!vapidPublicKey) {
      console.error("VAPID public key not configured");
      return null;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    });

    if (isDev) console.log("Push subscription:", subscription);

    // Send subscription to server
    await fetch("/api/isp/v1/admin/push/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(subscription),
    });

    return subscription;
  } catch (error) {
    console.error("Failed to subscribe to push notifications:", error);
    return null;
  }
}

export async function unsubscribeFromPushNotifications(
  registration: ServiceWorkerRegistration,
): Promise<boolean> {
  try {
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();

      // Notify server
      await fetch("/api/isp/v1/admin/push/unsubscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(subscription),
      });

      return true;
    }

    return false;
  } catch (error) {
    console.error("Failed to unsubscribe from push notifications:", error);
    return false;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

// ============================================================================
// Local Notifications (Fallback)
// ============================================================================

export function showLocalNotification(title: string, options?: NotificationOptions): void {
  if (!("Notification" in window)) {
    if (isDev) console.log("Notifications not supported");
    return;
  }

  if (Notification.permission === "granted") {
    new Notification(title, {
      icon: "/assets/icon-192x192.png",
      badge: "/assets/badge-72x72.png",
      ...options,
    });
  }
}

// ============================================================================
// Offline Data Sync
// ============================================================================

interface PendingTimeEntry {
  id?: number;
  data: {
    technicianId: string;
    clockIn?: string;
    clockOut?: string;
    entryType: string;
    breakDurationMinutes?: number;
    latitude?: number;
    longitude?: number;
    description?: string;
  };
  timestamp: string;
}

interface PendingLocation {
  id?: number;
  data: {
    technicianId: string;
    latitude: number;
    longitude: number;
    timestamp: string;
  };
}

export async function saveOfflineTimeEntry(entry: PendingTimeEntry["data"]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction("pending-time-entries", "readwrite");
  const store = tx.objectStore("pending-time-entries");

  await store.add({
    data: entry,
    timestamp: new Date().toISOString(),
  });

  if (isDev) console.log("Time entry saved offline");

  // Request background sync
  if ("serviceWorker" in navigator && "sync" in ServiceWorkerRegistration.prototype) {
    const registration = await navigator.serviceWorker.ready;
    await (registration as any).sync.register("sync-time-entries");
  }
}

export async function saveOfflineLocation(location: PendingLocation["data"]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction("pending-locations", "readwrite");
  const store = tx.objectStore("pending-locations");

  await store.add({
    data: location,
  });

  if (isDev) console.log("Location saved offline");

  // Request background sync
  if ("serviceWorker" in navigator && "sync" in ServiceWorkerRegistration.prototype) {
    const registration = await navigator.serviceWorker.ready;
    await (registration as any).sync.register("sync-location");
  }
}

export async function getPendingTimeEntries(): Promise<PendingTimeEntry[]> {
  const db = await openDB();
  const tx = db.transaction("pending-time-entries", "readonly");
  const store = tx.objectStore("pending-time-entries");

  return (await store.getAll()) as unknown as PendingTimeEntry[];
}

export async function getPendingLocations(): Promise<PendingLocation[]> {
  const db = await openDB();
  const tx = db.transaction("pending-locations", "readonly");
  const store = tx.objectStore("pending-locations");

  return (await store.getAll()) as unknown as PendingLocation[];
}

export async function clearPendingData(): Promise<void> {
  const db = await openDB();

  const tx1 = db.transaction("pending-time-entries", "readwrite");
  await tx1.objectStore("pending-time-entries").clear();

  const tx2 = db.transaction("pending-locations", "readwrite");
  await tx2.objectStore("pending-locations").clear();

  if (isDev) console.log("Pending data cleared");
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("dotmac-offline", 1);

    request.onerror = () => reject(request["error"]);
    request.onsuccess = () => resolve(request["result"]);

    request.onupgradeneeded = (event) => {
      const db = (event["target"] as IDBOpenDBRequest).result;

      if (!db["objectStoreNames"].contains("pending-time-entries")) {
        db.createObjectStore("pending-time-entries", {
          keyPath: "id",
          autoIncrement: true,
        });
      }

      if (!db["objectStoreNames"].contains("pending-locations")) {
        db.createObjectStore("pending-locations", {
          keyPath: "id",
          autoIncrement: true,
        });
      }
    };
  });
}

// ============================================================================
// Network Status
// ============================================================================

export function isOnline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine;
}

export function onOnlineStatusChange(callback: (online: boolean) => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
}

// ============================================================================
// Installation Prompt
// ============================================================================

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

export function setupInstallPrompt(callback: (prompt: BeforeInstallPromptEvent) => void): void {
  if (typeof window === "undefined") return;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    callback(deferredPrompt);
  });

  window.addEventListener("appinstalled", () => {
    if (isDev) console.log("PWA installed");
    deferredPrompt = null;
  });
}

export async function showInstallPrompt(): Promise<boolean> {
  if (!deferredPrompt) {
    return false;
  }

  await deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;

  if (isDev) console.log("Install prompt outcome:", outcome);

  deferredPrompt = null;
  return outcome === "accepted";
}

export function canShowInstallPrompt(): boolean {
  return deferredPrompt !== null;
}

// ============================================================================
// Periodic Background Sync (Experimental)
// ============================================================================

export async function registerPeriodicSync(tag: string, minInterval: number): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("periodicSync" in ServiceWorkerRegistration.prototype)) {
    if (isDev) console.log("Periodic background sync not supported");
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const status = await (navigator as any).permissions.query({
      name: "periodic-background-sync",
    });

    if (status.state === "granted") {
      await (registration as any).periodicSync.register(tag, {
        minInterval,
      });
      if (isDev) console.log(`Periodic sync registered: ${tag}`);
      return true;
    } else {
      if (isDev) console.log("Periodic background sync permission not granted");
      return false;
    }
  } catch (error) {
    console.error("Failed to register periodic sync:", error);
    return false;
  }
}

export async function unregisterPeriodicSync(tag: string): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("periodicSync" in ServiceWorkerRegistration.prototype)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    await (registration as any).periodicSync.unregister(tag);
    if (isDev) console.log(`Periodic sync unregistered: ${tag}`);
    return true;
  } catch (error) {
    console.error("Failed to unregister periodic sync:", error);
    return false;
  }
}
