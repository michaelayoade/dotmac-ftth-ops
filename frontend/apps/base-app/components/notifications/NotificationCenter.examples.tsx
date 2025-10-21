/**
 * NotificationCenter Examples
 *
 * Demonstrates how to integrate the NotificationCenter component.
 */

"use client";

import { NotificationCenter, NotificationBadge } from "./NotificationCenter";

// ============================================================================
// Example 1: Basic Usage in Header
// ============================================================================

export function HeaderWithNotifications() {
  return (
    <header className="flex items-center justify-between border-b px-6 py-4">
      <h1 className="text-xl font-bold">My Application</h1>

      <div className="flex items-center gap-4">
        {/* User menu, settings, etc */}
        <button>Settings</button>

        {/* Notification Center */}
        <NotificationCenter />

        <button>Profile</button>
      </div>
    </header>
  );
}

// ============================================================================
// Example 2: Custom Configuration
// ============================================================================

export function CustomNotificationCenter() {
  return (
    <NotificationCenter
      maxNotifications={10} // Show up to 10 notifications
      refreshInterval={15000} // Refresh every 15 seconds
      showViewAll={true}
      viewAllUrl="/dashboard/notifications/history"
    />
  );
}

// ============================================================================
// Example 3: Badge Only (Minimal Mode)
// ============================================================================

export function MinimalNotificationIndicator() {
  return (
    <div className="relative">
      <button className="rounded-full p-2">
        <span>Notifications</span>
      </button>
      {/* Badge appears when there are unread notifications */}
      <div className="absolute right-0 top-0">
        <NotificationBadge />
      </div>
    </div>
  );
}

// ============================================================================
// Example 4: Integration with App Layout
// ============================================================================

export function AppLayoutExample() {
  return (
    <div className="flex h-screen flex-col">
      {/* Top Navigation */}
      <nav className="flex items-center justify-between border-b bg-background px-6 py-3">
        <div className="flex items-center gap-8">
          <h1 className="text-lg font-semibold">ISP Platform</h1>

          <div className="flex items-center gap-4">
            <a href="/dashboard">Dashboard</a>
            <a href="/subscribers">Subscribers</a>
            <a href="/billing">Billing</a>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <input type="search" placeholder="Search..." className="rounded-md border px-3 py-1" />

          {/* Notification Center with Badge */}
          <NotificationCenter
            maxNotifications={5}
            refreshInterval={30000}
            viewAllUrl="/dashboard/notifications"
          />

          {/* User Menu */}
          <button className="flex items-center gap-2">
            <span>John Doe</span>
            <div className="h-8 w-8 rounded-full bg-gray-200" />
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-6">{/* Your app content */}</main>
    </div>
  );
}

// ============================================================================
// Example 5: Mobile Responsive Layout
// ============================================================================

export function MobileResponsiveHeader() {
  return (
    <header className="flex items-center justify-between border-b px-4 py-3">
      {/* Mobile: Show only icon */}
      <div className="md:hidden">
        <button className="p-2">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
      </div>

      {/* Desktop: Show logo */}
      <div className="hidden md:block">
        <h1 className="text-xl font-bold">ISP Platform</h1>
      </div>

      {/* Notification Center (works on both mobile and desktop) */}
      <NotificationCenter maxNotifications={5} refreshInterval={30000} />
    </header>
  );
}

// ============================================================================
// Example 6: With Custom Styling
// ============================================================================

export function StyledNotificationCenter() {
  return (
    <div className="flex items-center gap-4 rounded-lg bg-slate-100 p-4 dark:bg-slate-900">
      <span className="text-sm font-medium">Stay Updated</span>

      {/* Notification Center with custom trigger styling */}
      <NotificationCenter
        maxNotifications={8}
        refreshInterval={20000}
        showViewAll={true}
        viewAllUrl="/notifications"
      />
    </div>
  );
}

// ============================================================================
// Example 7: Testing with Mock Data
// ============================================================================

export function NotificationCenterWithMockData() {
  // In development, you can use mock data to test the UI
  // The actual component will fetch real data from the API

  return (
    <div className="space-y-4 p-8">
      <h2 className="text-2xl font-bold">Notification Center Examples</h2>

      <div className="space-y-2">
        <h3 className="font-semibold">Default Configuration</h3>
        <NotificationCenter />
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">More Notifications Shown</h3>
        <NotificationCenter maxNotifications={10} />
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">Fast Refresh (5 seconds)</h3>
        <NotificationCenter refreshInterval={5000} />
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">Badge Only</h3>
        <NotificationBadge />
      </div>
    </div>
  );
}
