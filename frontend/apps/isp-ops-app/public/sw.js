/**
 * Service Worker for PWA Offline Support
 * Implements caching strategies and background sync for field service app
 */

const CACHE_NAME = "dotmac-ops-v1";
const RUNTIME_CACHE = "dotmac-runtime-v1";
const DATA_CACHE = "dotmac-data-v1";

// Assets to cache on install
const PRECACHE_ASSETS = [
  "/",
  "/dashboard/technician",
  "/dashboard/time-tracking",
  "/dashboard/scheduling",
  "/dashboard/map",
  "/dashboard/resources",
  "/offline",
  "/manifest.json",
];

// Cache API responses for these patterns
const API_CACHE_PATTERNS = [
  /\/api\/v1\/field-service\/technicians/,
  /\/api\/v1\/scheduling\/assignments/,
  /\/api\/v1\/time\/entries/,
  /\/api\/v1\/resources/,
];

// ============================================================================
// Installation
// ============================================================================

self.addEventListener("install", (event) => {
  console.log("[ServiceWorker] Installing...");

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[ServiceWorker] Precaching app shell");
      return cache.addAll(PRECACHE_ASSETS);
    }),
  );

  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// ============================================================================
// Activation
// ============================================================================

self.addEventListener("activate", (event) => {
  console.log("[ServiceWorker] Activating...");

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            return (
              cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE && cacheName !== DATA_CACHE
            );
          })
          .map((cacheName) => {
            console.log("[ServiceWorker] Removing old cache:", cacheName);
            return caches.delete(cacheName);
          }),
      );
    }),
  );

  // Take control of all pages immediately
  return self.clients.claim();
});

// ============================================================================
// Fetch Strategy
// ============================================================================

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // API requests - Network first, falling back to cache
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // GraphQL requests - Network first
  if (url.pathname.includes("/graphql")) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Static assets - Cache first, falling back to network
  event.respondWith(cacheFirstStrategy(request));
});

// ============================================================================
// Caching Strategies
// ============================================================================

/**
 * Network First Strategy
 * Try network first, fall back to cache if offline
 */
async function networkFirstStrategy(request) {
  const cache = await caches.open(DATA_CACHE);

  try {
    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log("[ServiceWorker] Network request failed, trying cache:", error);

    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      console.log("[ServiceWorker] Serving from cache");
      return cachedResponse;
    }

    // Return offline page for navigation requests
    if (request.mode === "navigate") {
      const offlinePage = await caches.match("/offline");
      if (offlinePage) {
        return offlinePage;
      }
    }

    // Return generic offline response
    return new Response(
      JSON.stringify({
        error: "Offline",
        message: "You are currently offline. Please try again when connected.",
      }),
      {
        status: 503,
        statusText: "Service Unavailable",
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

/**
 * Cache First Strategy
 * Serve from cache if available, otherwise fetch from network
 */
async function cacheFirstStrategy(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log("[ServiceWorker] Fetch failed for:", request.url);

    // Return offline page for navigation requests
    if (request.mode === "navigate") {
      const offlinePage = await caches.match("/offline");
      if (offlinePage) {
        return offlinePage;
      }
    }

    throw error;
  }
}

// ============================================================================
// Background Sync
// ============================================================================

self.addEventListener("sync", (event) => {
  console.log("[ServiceWorker] Background sync:", event.tag);

  if (event.tag === "sync-time-entries") {
    event.waitUntil(syncTimeEntries());
  } else if (event.tag === "sync-location") {
    event.waitUntil(syncTechnicianLocation());
  }
});

async function syncTimeEntries() {
  console.log("[ServiceWorker] Syncing time entries...");

  try {
    // Get pending time entries from IndexedDB
    const db = await openDB("dotmac-offline");
    const tx = db.transaction("pending-time-entries", "readonly");
    const store = tx.objectStore("pending-time-entries");
    const entries = await store.getAll();

    // Sync each entry
    for (const entry of entries) {
      try {
        const response = await fetch("/api/isp/v1/admin/time/entries", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(entry.data),
        });

        if (response.ok) {
          // Remove from pending queue
          const deleteTx = db.transaction("pending-time-entries", "readwrite");
          const deleteStore = deleteTx.objectStore("pending-time-entries");
          await deleteStore.delete(entry.id);

          console.log("[ServiceWorker] Synced time entry:", entry.id);
        }
      } catch (error) {
        console.error("[ServiceWorker] Failed to sync time entry:", error);
      }
    }
  } catch (error) {
    console.error("[ServiceWorker] Sync failed:", error);
  }
}

async function syncTechnicianLocation() {
  console.log("[ServiceWorker] Syncing technician location...");

  try {
    const db = await openDB("dotmac-offline");
    const tx = db.transaction("pending-locations", "readonly");
    const store = tx.objectStore("pending-locations");
    const locations = await store.getAll();

    for (const location of locations) {
      try {
        const response = await fetch("/api/isp/v1/admin/field-service/technicians/location", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(location.data),
        });

        if (response.ok) {
          const deleteTx = db.transaction("pending-locations", "readwrite");
          const deleteStore = deleteTx.objectStore("pending-locations");
          await deleteStore.delete(location.id);

          console.log("[ServiceWorker] Synced location:", location.id);
        }
      } catch (error) {
        console.error("[ServiceWorker] Failed to sync location:", error);
      }
    }
  } catch (error) {
    console.error("[ServiceWorker] Location sync failed:", error);
  }
}

// ============================================================================
// Push Notifications
// ============================================================================

self.addEventListener("push", (event) => {
  console.log("[ServiceWorker] Push notification received");

  const data = event.data ? event.data.json() : {};

  const options = {
    body: data.body || "You have a new notification",
    icon: "/assets/icon-192x192.png",
    badge: "/assets/badge-72x72.png",
    vibrate: [200, 100, 200],
    data: {
      url: data.url || "/dashboard/technician",
      ...data,
    },
    actions: [
      {
        action: "view",
        title: "View",
      },
      {
        action: "dismiss",
        title: "Dismiss",
      },
    ],
    tag: data.tag || "general",
    requireInteraction: data.requireInteraction || false,
  };

  event.waitUntil(self.registration.showNotification(data.title || "dotmac Operations", options));
});

self.addEventListener("notificationclick", (event) => {
  console.log("[ServiceWorker] Notification clicked:", event.action);

  event.notification.close();

  if (event.action === "dismiss") {
    return;
  }

  const urlToOpen = event.notification.data?.url || "/dashboard/technician";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Check if a window is already open
      for (const client of clientList) {
        if (client.url.includes(urlToOpen) && "focus" in client) {
          return client.focus();
        }
      }

      // Open new window if none exists
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    }),
  );
});

// ============================================================================
// Helper Functions
// ============================================================================

function openDB(dbName) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains("pending-time-entries")) {
        db.createObjectStore("pending-time-entries", {
          keyPath: "id",
          autoIncrement: true,
        });
      }

      if (!db.objectStoreNames.contains("pending-locations")) {
        db.createObjectStore("pending-locations", {
          keyPath: "id",
          autoIncrement: true,
        });
      }
    };
  });
}

// ============================================================================
// Periodic Background Sync (if supported)
// ============================================================================

self.addEventListener("periodicsync", (event) => {
  console.log("[ServiceWorker] Periodic sync:", event.tag);

  if (event.tag === "update-technician-location") {
    event.waitUntil(updateTechnicianLocation());
  }
});

async function updateTechnicianLocation() {
  try {
    // Request location permission and update
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject);
    });

    const { latitude, longitude } = position.coords;

    await fetch("/api/isp/v1/admin/field-service/technicians/location", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        latitude,
        longitude,
        timestamp: new Date().toISOString(),
      }),
    });

    console.log("[ServiceWorker] Location updated");
  } catch (error) {
    console.error("[ServiceWorker] Failed to update location:", error);
  }
}

console.log("[ServiceWorker] Loaded");
