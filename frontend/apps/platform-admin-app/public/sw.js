/**
 * Service Worker for Platform Admin PWA
 * Implements caching strategies and background sync for admin operations
 */

const CACHE_NAME = "dotmac-admin-v1";
const RUNTIME_CACHE = "dotmac-admin-runtime-v1";
const DATA_CACHE = "dotmac-admin-data-v1";

// Assets to cache on install
const PRECACHE_ASSETS = [
  "/",
  "/dashboard",
  "/dashboard/platform-admin",
  "/dashboard/admin/roles",
  "/dashboard/infrastructure/logs",
  "/offline",
  "/manifest.json",
];

// Cache API responses for these patterns
const API_CACHE_PATTERNS = [
  /\/api\/v1\/auth\/rbac/,
  /\/api\/v1\/tenants/,
  /\/api\/v1\/admin/,
  /\/api\/v1\/infrastructure/,
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
      url: data.url || "/dashboard",
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

  event.waitUntil(
    self.registration.showNotification(data.title || "dotmac Platform Admin", options),
  );
});

self.addEventListener("notificationclick", (event) => {
  console.log("[ServiceWorker] Notification clicked:", event.action);

  event.notification.close();

  if (event.action === "dismiss") {
    return;
  }

  const urlToOpen = event.notification.data?.url || "/dashboard";

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

console.log("[ServiceWorker] Loaded");
