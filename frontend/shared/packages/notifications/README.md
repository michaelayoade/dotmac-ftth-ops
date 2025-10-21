# @dotmac/notifications

Universal Notification & Alert System for DotMac Framework - Production-ready notification components providing consistent cross-portal messaging with real-time updates and portal-specific theming.

## 🎯 Features

- **Universal Notification System**: Consistent notifications across all 7 portals
- **Multiple Notification Types**: Toast, system alerts, in-app notifications, real-time updates
- **Portal-Aware Theming**: Automatic styling based on portal variant
- **Real-Time Updates**: WebSocket-based live notifications
- **Notification Center**: Persistent notification management with read/unread states
- **User Preferences**: Granular notification settings per portal and category
- **Production-Ready**: Built-in retry logic, connection management, and error handling
- **Analytics**: Notification statistics and activity tracking
- **Accessibility**: Screen reader compatible with ARIA labels

## 📦 Installation

```bash
# Install the package
pnpm add @dotmac/notifications

# Peer dependencies (usually already installed)
pnpm add react react-dom framer-motion sonner
```

## 🚀 Quick Start

### Basic Setup

```tsx
import { NotificationProvider } from "@dotmac/notifications";

function App() {
  return (
    <NotificationProvider portalVariant="admin" userId="user-123" tenantId="tenant-456">
      <YourAppContent />
    </NotificationProvider>
  );
}
```

### Using Notifications

```tsx
import { useNotifications } from "@dotmac/notifications";

function SomeComponent() {
  const { showToast, notifications, markAsRead } = useNotifications();

  // Show toast notification
  const handleSave = async () => {
    try {
      await saveCustomer(customerData);

      showToast("Customer Saved", "Customer information has been successfully updated", "success", {
        actions: [
          {
            label: "View Profile",
            action: () => navigate(`/customers/${customer.id}`),
            variant: "primary",
          },
          {
            label: "Send Welcome Email",
            action: () => sendWelcomeEmail(customer.id),
            variant: "secondary",
          },
        ],
        duration: 7000,
        category: "customer",
        priority: "medium",
      });
    } catch (error) {
      showToast("Save Failed", "Unable to save customer information. Please try again.", "error", {
        persistent: true,
      });
    }
  };

  // Mark notification as read
  const handleNotificationClick = (notification) => {
    markAsRead(notification.id);
    // Handle notification action
  };

  return (
    <div>
      <button onClick={handleSave}>Save Customer</button>

      {/* Display unread count */}
      <div>Unread notifications: {notifications.filter((n) => !n.read).length}</div>
    </div>
  );
}
```

## 🔔 Notification Types

### 1. Toast Notifications

Temporary notifications for immediate feedback:

```tsx
const { showToast } = useNotifications();

// Success toast
showToast("Operation Successful", "Your changes have been saved", "success");

// Error toast with persistence
showToast("Error Occurred", "Please try again later", "error", {
  persistent: true,
  actions: [
    { label: "Retry", action: () => retryOperation() },
    { label: "Report Issue", action: () => openSupportTicket() },
  ],
});

// Loading toast that can be updated
const toastId = showToast("Processing", "Please wait...", "loading");
// Later update the same toast
showToast("Complete", "Process finished successfully", "success", {
  id: toastId,
});
```

### 2. System Alerts

Important system-wide announcements:

```tsx
import { useNotifications } from "@dotmac/notifications";

function SystemAlerts() {
  const { alerts, acknowledgeAlert } = useNotifications();

  return (
    <div>
      {alerts.map((alert) => (
        <div key={alert.id} className={`alert alert-${alert.type}`}>
          <h3>{alert.title}</h3>
          <p>{alert.message}</p>

          {alert.actionRequired && (
            <button onClick={() => acknowledgeAlert(alert.id)}>Acknowledge</button>
          )}

          {alert.actionUrl && <a href={alert.actionUrl}>{alert.actionLabel || "Learn More"}</a>}
        </div>
      ))}
    </div>
  );
}
```

### 3. In-App Notifications

Persistent notifications with rich content:

```tsx
import { NotificationCenter } from "@dotmac/notifications";

function Header() {
  const { stats } = useNotifications();

  return (
    <header>
      <NotificationCenter
        trigger={
          <button className="notification-button">
            <BellIcon />
            {stats.unread > 0 && <span className="badge">{stats.unread}</span>}
          </button>
        }
      />
    </header>
  );
}
```

### 4. Real-Time Updates

Live updates via WebSocket:

```tsx
import { useNotifications } from "@dotmac/notifications";

function OrderTracking() {
  const { subscribeToTopic, isConnected } = useNotifications();

  useEffect(() => {
    const unsubscribe = subscribeToTopic("work-orders", (update) => {
      console.log("Work order update:", update);

      // Handle different types of updates
      switch (update.event) {
        case "status_changed":
          showToast(`Order ${update.data.orderId}`, `Status: ${update.data.newStatus}`);
          break;
        case "assigned":
          showToast("New Assignment", `Order ${update.data.orderId} assigned to you`);
          break;
      }
    });

    return unsubscribe; // Cleanup subscription
  }, []);

  return (
    <div>
      <div className={`connection-status ${isConnected ? "connected" : "disconnected"}`}>
        {isConnected ? "Live" : "Offline"}
      </div>
      {/* Your component content */}
    </div>
  );
}
```

## 🎨 Portal Variants

Each portal gets its own notification styling:

```tsx
// Management Admin - Professional indigo theme
<NotificationProvider portalVariant="management-admin" userId="admin-123">

// Customer Portal - Friendly emerald theme
<NotificationProvider portalVariant="customer" userId="customer-456">

// Technician Mobile - High-contrast cyan theme
<NotificationProvider portalVariant="technician" userId="tech-789">
```

## 📂 Notification Categories

Organize notifications by category:

```tsx
const categories = [
  "system", // System updates, maintenance
  "billing", // Payment, invoicing
  "customer", // Customer-related activities
  "service", // Service changes, outages
  "security", // Security alerts, breaches
  "maintenance", // Scheduled maintenance
  "workflow", // Workflow, approvals
  "user", // User actions, profile
  "api", // API events, integrations
];

// Show categorized notification
showToast("Payment Received", "Invoice #1234 has been paid", "success", {
  category: "billing",
  priority: "medium",
});
```

## ⚙️ User Preferences

Granular notification preferences:

```tsx
import { useNotifications } from "@dotmac/notifications";

function NotificationSettings() {
  const { preferences, updatePreferences } = useNotifications();

  const handleUpdatePreferences = async (updates) => {
    await updatePreferences({
      ...preferences,
      categories: {
        ...preferences.categories,
        billing: {
          ...preferences.categories.billing,
          enabled: true,
          channels: ["inApp", "email"],
          priority: "high",
        },
      },
      quietHours: {
        enabled: true,
        start: "22:00",
        end: "08:00",
        timezone: "America/New_York",
      },
    });
  };

  return (
    <div>
      <h2>Notification Preferences</h2>

      {/* Channel preferences */}
      <div>
        <label>
          <input
            type="checkbox"
            checked={preferences?.channels.inApp}
            onChange={(e) =>
              handleUpdatePreferences({
                channels: { ...preferences.channels, inApp: e.target.checked },
              })
            }
          />
          In-App Notifications
        </label>
      </div>

      {/* Category preferences */}
      {Object.entries(preferences?.categories || {}).map(([category, settings]) => (
        <div key={category}>
          <h3>{category}</h3>
          <label>
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) =>
                handleUpdatePreferences({
                  categories: {
                    ...preferences.categories,
                    [category]: { ...settings, enabled: e.target.checked },
                  },
                })
              }
            />
            Enable {category} notifications
          </label>
        </div>
      ))}
    </div>
  );
}
```

## 📊 Analytics & Statistics

Track notification metrics:

```tsx
import { useNotificationStats } from "@dotmac/notifications";

function NotificationAnalytics() {
  const { stats } = useNotificationStats("user-123", "admin", 30); // Last 30 days

  return (
    <div className="stats-dashboard">
      <div className="stat-card">
        <h3>Total Notifications</h3>
        <p>{stats.total}</p>
      </div>

      <div className="stat-card">
        <h3>Unread</h3>
        <p>{stats.unread}</p>
      </div>

      <div className="category-breakdown">
        <h3>By Category</h3>
        {Object.entries(stats.byCategory).map(([category, count]) => (
          <div key={category}>
            {category}: {count}
          </div>
        ))}
      </div>

      <div className="recent-activity">
        <h3>Recent Activity</h3>
        {stats.recentActivity.map(({ date, count }) => (
          <div key={date}>
            {date}: {count} notifications
          </div>
        ))}
      </div>
    </div>
  );
}
```

## 🔧 Advanced Configuration

### Custom Portal Configuration

```tsx
import { getPortalNotificationConfig } from "@dotmac/notifications";

// Get portal-specific configuration
const portalConfig = getPortalNotificationConfig("technician");

console.log(portalConfig.theme.colors.primary); // '#0891B2'
console.log(portalConfig.limits.maxToasts); // 3 (mobile-optimized)
console.log(portalConfig.realtime.topics); // ['work-orders', 'inventory']
```

### Custom Notification API

```tsx
import { createNotificationAPI } from "@dotmac/notifications";

const api = createNotificationAPI({
  baseUrl: "https://api.dotmac.app",
  timeout: 5000,
  retryAttempts: 3,
  authToken: "your-auth-token",
});

// Send custom notification
await api.sendNotification({
  userId: "user-123",
  tenantId: "tenant-456",
  title: "Custom Notification",
  message: "This is a custom notification",
  type: "info",
  category: "system",
  priority: "medium",
  portalVariant: "admin",
});
```

### Real-Time Connection Management

```tsx
import { useRealtimeConnection } from "@dotmac/notifications";

function RealtimeStatus() {
  const { isConnected, connectionState, reconnectAttempts } = useRealtimeConnection(
    "user-123",
    "admin",
  );

  return (
    <div className={`realtime-indicator ${isConnected ? "connected" : "disconnected"}`}>
      <span className="status-dot" />
      {isConnected ? "Live" : `Connecting... (${reconnectAttempts}/3)`}
    </div>
  );
}
```

## 📱 Mobile Optimization

### Touch-Friendly Notifications

```tsx
// Automatically optimized for technician portal (mobile)
<NotificationProvider portalVariant="technician" userId="tech-123">
  {/*
    - Larger touch targets (44px minimum)
    - Bottom positioning for easier thumb access
    - Swipe gestures for dismissal
    - Reduced maximum toast count (3 vs 5)
    - High contrast colors for outdoor visibility
  */}
</NotificationProvider>
```

### Offline Support

```tsx
const { isConnected, pendingNotifications } = useNotifications();

// Notifications are queued when offline and sent when reconnected
if (!isConnected && pendingNotifications.length > 0) {
  showToast("Offline Mode", `${pendingNotifications.length} notifications pending sync`);
}
```

## 🧪 Testing

### Component Testing

```tsx
import { render, screen } from "@testing-library/react";
import { NotificationProvider, useNotifications } from "@dotmac/notifications";

function TestComponent() {
  const { showToast } = useNotifications();
  return <button onClick={() => showToast("Test", "Test message")}>Show Toast</button>;
}

test("shows toast notification", async () => {
  render(
    <NotificationProvider portalVariant="admin" userId="test-user">
      <TestComponent />
    </NotificationProvider>,
  );

  fireEvent.click(screen.getByText("Show Toast"));

  await waitFor(() => {
    expect(screen.getByText("Test")).toBeInTheDocument();
    expect(screen.getByText("Test message")).toBeInTheDocument();
  });
});
```

### Mock API for Testing

```tsx
import { createNotificationAPI } from "@dotmac/notifications";

// Mock API for testing
const mockAPI = createNotificationAPI({
  baseUrl: "http://localhost:3000",
  mock: true, // Enable mock mode
});

test("notification API calls", async () => {
  const notification = await mockAPI.sendNotification({
    userId: "test-user",
    title: "Test Notification",
    message: "Test message",
    type: "info",
    category: "system",
    priority: "medium",
    portalVariant: "admin",
  });

  expect(notification.id).toBeDefined();
  expect(notification.title).toBe("Test Notification");
});
```

## 🔒 Security Considerations

### Permission-Based Notifications

```tsx
// Notifications respect user permissions
const notification = {
  title: "Admin Action Required",
  message: "Review pending approvals",
  targetRoles: ["admin", "manager"], // Only visible to these roles
  targetPortals: ["admin", "management-admin"], // Only in admin portals
  permissions: ["approvals.view"], // Requires specific permission
};
```

### Secure WebSocket Connections

```tsx
// Automatic secure connections with authentication
const { isConnected } = useRealtimeConnection("user-123", "admin", {
  secure: true, // Force WSS in production
  authToken: "jwt-token",
  heartbeatInterval: 30000, // Keep connection alive
  maxReconnectAttempts: 5,
});
```

## 📚 API Reference

### NotificationProvider Props

| Prop            | Type            | Required | Description                          |
| --------------- | --------------- | -------- | ------------------------------------ |
| `portalVariant` | `PortalVariant` | ✅       | Portal type for theming and behavior |
| `userId`        | `string`        | ✅       | Current user ID                      |
| `tenantId`      | `string`        | ❌       | Tenant ID for multi-tenant setups    |
| `children`      | `ReactNode`     | ✅       | App content                          |

### useNotifications Hook

Returns a `NotificationContext` with:

| Property            | Type                      | Description                    |
| ------------------- | ------------------------- | ------------------------------ |
| `toasts`            | `Toast[]`                 | Active toast notifications     |
| `showToast`         | `Function`                | Show new toast notification    |
| `dismissToast`      | `Function`                | Dismiss specific toast         |
| `clearAllToasts`    | `Function`                | Clear all toasts               |
| `alerts`            | `SystemAlert[]`           | Active system alerts           |
| `acknowledgeAlert`  | `Function`                | Acknowledge system alert       |
| `notifications`     | `InAppNotification[]`     | In-app notifications           |
| `stats`             | `NotificationStats`       | Notification statistics        |
| `markAsRead`        | `Function`                | Mark notification as read      |
| `markAllAsRead`     | `Function`                | Mark all notifications as read |
| `isConnected`       | `boolean`                 | Real-time connection status    |
| `subscribeToTopic`  | `Function`                | Subscribe to real-time updates |
| `preferences`       | `NotificationPreferences` | User preferences               |
| `updatePreferences` | `Function`                | Update user preferences        |

## 🔧 Troubleshooting

### Common Issues

1. **Notifications not appearing**: Check `NotificationProvider` is properly set up
2. **Real-time not working**: Verify WebSocket connection and network settings
3. **Portal styling not applied**: Ensure correct `portalVariant` prop
4. **Permissions not working**: Check user permissions and role configuration

### Debug Mode

```tsx
// Enable debug logging in development
<NotificationProvider
  portalVariant="admin"
  userId="user-123"
  debug={process.env.NODE_ENV === 'development'}
>
```

## 🤝 Contributing

1. **Development Setup**:

   ```bash
   cd frontend/packages/notifications
   pnpm install
   pnpm dev
   ```

2. **Testing**:

   ```bash
   pnpm test
   pnpm test:coverage
   ```

3. **Build**:

   ```bash
   pnpm build
   pnpm type-check
   ```

## 📄 License

MIT License - see LICENSE file for details.

---

Built with ❤️ by the DotMac Framework Team
