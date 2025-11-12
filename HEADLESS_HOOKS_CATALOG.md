# Headless Package Hooks Catalog

Complete catalog of all available hooks in the headless package at:
`/frontend/shared/packages/headless/src/hooks`

---

## 1. BILLING & PAYMENTS HOOKS

### 1.1 useBilling.ts
**File**: `/frontend/shared/packages/headless/src/hooks/useBilling.ts`

**Main Hook**: `useBilling(options)`

**Purpose**: Comprehensive billing account and invoice management with real-time updates via WebSocket

**Parameters**:
- `apiEndpoint?: string` - Billing API endpoint (default: "/api/billing")
- `websocketEndpoint?: string` - WebSocket endpoint for real-time updates
- `apiKey?: string` - API authentication key
- `tenantId?: string` - Tenant identifier
- `resellerId?: string` - Reseller identifier
- `stripePk?: string` - Stripe public key
- `paypalClientId?: string` - PayPal client ID
- `pollInterval?: number` - Poll interval in ms (default: 60000)
- `enableRealtime?: boolean` - Enable WebSocket (default: true)
- `maxRetries?: number` - Max reconnection retries (default: 3)

**Returned Methods**:
- `loadAccounts(filters)` - Load billing accounts with optional filters
- `loadInvoices(filters)` - Load invoices with date range, customer, status filters
- `loadPayments(filters)` - Load payment records
- `loadStats(timeRange)` - Load billing statistics for time range
- `processPayment(paymentData)` - Process a payment transaction
- `createInvoice(invoiceData)` - Create new invoice
- `updateInvoiceStatus(invoiceId, status, notes)` - Update invoice status
- `sendInvoice(invoiceId, email)` - Send invoice to customer
- `addPaymentMethod(customerId, paymentMethodData)` - Add payment method
- `refundPayment(paymentId, amount, reason)` - Refund a payment
- `retryPayment(paymentId)` - Retry failed payment
- `connect/disconnect` - WebSocket connection management
- `clearError()` - Clear error state
- `selectAccount(account)` - Select active billing account

**Computed Values**:
- `overdueInvoices` - Filtered list of overdue invoices
- `unpaidInvoices` - Filtered list of unpaid invoices
- `failedPayments` - Filtered list of failed payments
- `pendingPayments` - Filtered list of pending payments
- `recentPayments` - Last 10 payments
- `totalOutstanding` - Total outstanding amount

**State**:
- `accounts: BillingAccount[]`
- `invoices: Invoice[]`
- `payments: Payment[]`
- `plans: BillingPlan[]`
- `subscriptions: Subscription[]`
- `stats: BillingStats | null`
- `selectedAccount: BillingAccount | null`
- `isLoading: boolean`
- `error: string | null`
- `isConnected: boolean`
- `paymentProcessing: boolean`

**WebSocket Events Handled**:
- `payment_completed` - Update invoice status to paid
- `payment_failed` - Update payment status with failure reason
- `invoice_created` - Add new invoice to list
- `invoice_overdue` - Update invoice status to overdue
- `subscription_renewed` - Update subscription data
- `stats_update` - Update billing statistics

---

### 1.2 usePaymentProcessor.ts
**File**: `/frontend/shared/packages/headless/src/hooks/usePaymentProcessor.ts`

**Main Hook**: `usePaymentProcessor(config)`

**Purpose**: Unified interface for multiple payment processors with caching and validation

**Parameters**:
- `autoLoadProcessors?: boolean` - Auto-load processors on mount
- `enableWebhooks?: boolean` - Enable webhook handling
- `retryFailedPayments?: boolean` - Auto-retry failed payments
- `cacheDuration?: number` - Cache duration in ms

**Returned Methods**:
- `loadProcessors()` - Load available payment processors
- `selectProcessor(processorId)` - Select active processor
- `loadPaymentMethods(customerId)` - Load customer payment methods
- `createPaymentIntent(amount, currency, customerId)` - Create payment intent
- `loadTransactions(filters)` - Load payment transactions
- `formatAmount(amount, currency)` - Format amount as currency string

**State**:
- `processors: PaymentProcessor[]`
- `selectedProcessor: PaymentProcessor | null`
- `paymentMethods: PaymentMethod[]`
- `recentTransactions: Transaction[]`
- `analytics: BillingAnalytics | null`
- `webhookEvents: WebhookEvent[]`
- `isLoading: boolean`
- `error: string | null`

**Sub-hooks Used**:
- `usePaymentCache()` - Data caching
- `usePaymentValidation()` - Input validation
- `usePaymentSecurity()` - Security & tokenization
- `useStandardErrorHandler()` - Error handling

---

### 1.3 Payment Sub-hooks

#### usePaymentCache.ts
**File**: `/frontend/shared/packages/headless/src/hooks/payment/usePaymentCache.ts`

**Purpose**: Payment data caching with TTL support

**Methods**:
- `getCachedData(key)` - Get cached data if not expired
- `setCachedData(key, data, duration?)` - Set cache entry
- `clearCache(key?)` - Clear single or all cache
- `isCacheExpired(key)` - Check if cache expired

**Config**:
- `defaultDuration?: number` - Default cache TTL (default: 300000)

---

#### usePaymentValidation.ts
**File**: `/frontend/shared/packages/headless/src/hooks/payment/usePaymentValidation.ts`

**Purpose**: Payment data validation (amounts, currencies, cards)

**Methods**:
- `validatePaymentData(data)` - Validate complete payment data
- `validateAmount(amount)` - Validate payment amount
- `validateCurrency(currency)` - Validate currency code
- `validateCustomerId(customerId)` - Validate customer ID
- `validateCardData(cardData)` - Validate credit card data

**Returns**: `ValidationResult` with `isValid: boolean` and `errors: string[]`

**Supported Currencies**: USD, EUR, GBP, CAD, AUD, JPY

---

#### usePaymentSecurity.ts
**File**: `/frontend/shared/packages/headless/src/hooks/payment/usePaymentSecurity.ts`

**Purpose**: Payment security operations (tokenization, encryption)

**Methods**:
- `tokenizeCard(cardData, processorId)` - Tokenize card securely
- `encryptSensitiveData(data)` - Encrypt payment data
- `validateProcessorAccess(processorId)` - Check processor access
- `sanitizePaymentData(data)` - Remove sensitive fields from data

**Sensitive Fields Removed**:
- card_number, cvv, cvc, secret_key, api_key, password, ssn, account_number

---

## 2. COMMUNICATION & MESSAGING HOOKS

### 2.1 useCommunication.ts
**File**: `/frontend/shared/packages/headless/src/hooks/useCommunication.ts`

**Main Hook**: `useCommunication(options)`

**Purpose**: Unified communication channel management (email, SMS, push, webhooks)

**Parameters**:
- `apiEndpoint?: string` - Communication API endpoint (default: "/api/communication")
- `websocketEndpoint?: string` - WebSocket for real-time updates
- `apiKey?: string` - API key
- `tenantId?: string` - Tenant ID
- `pollInterval?: number` - Poll interval (default: 30000)
- `enableRealtime?: boolean` - Enable WebSocket (default: true)
- `maxRetries?: number` - Max retries (default: 3)

**Returned Methods**:
- `loadChannels()` - Load communication channels
- `loadTemplates()` - Load message templates
- `loadMessages(filters)` - Load messages with filtering
- `loadStats(timeRange)` - Load communication statistics
- `sendMessage(messageData)` - Send single message
- `sendBulkMessages(messages)` - Send multiple messages
- `createTemplate(templateData)` - Create message template
- `updateTemplate(id, templateData)` - Update template
- `deleteTemplate(id)` - Delete template
- `testChannel(channelId, testData)` - Test channel connectivity
- `cancelMessage(messageId)` - Cancel pending message
- `retryMessage(messageId)` - Retry failed message

**State**:
- `channels: CommunicationChannel[]`
- `templates: CommunicationTemplate[]`
- `messages: CommunicationMessage[]`
- `stats: CommunicationStats | null`
- `isLoading: boolean`
- `error: string | null`
- `isConnected: boolean`

**Computed Values**:
- `activeChannels` - Filter by status === "active"
- `failedMessages` - Filter by status === "failed"
- `pendingMessages` - Filter by status === "pending"
- `recentMessages` - Last 10 messages

**WebSocket Events**:
- `message_status_update` - Update message delivery status
- `new_message` - New message received
- `channel_status_update` - Channel status changed
- `stats_update` - Statistics updated

---

## 3. NOTIFICATION HOOKS

### 3.1 useNotifications.ts
**File**: `/frontend/shared/packages/headless/src/hooks/useNotifications.ts`

**Main Hook**: `useNotifications()`

**Purpose**: Application-level notification management with Zustand store

**Returned Object**:
- `notifications: Notification[]` - All notifications
- `notify: { success, error, warning, info }` - Convenience methods
- `remove(id)` - Remove notification
- `clear()` - Clear all notifications
- `markAsRead(id)` - Mark as read
- `update(id, updates)` - Update notification

**Notification Interface**:
```typescript
{
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message?: string;
  duration?: number;
  persistent?: boolean;
  actions?: { label, action, primary? }[];
  metadata?: Record<string, unknown>;
  timestamp: Date;
}
```

---

### 3.2 useApiErrorNotifications()
**Purpose**: Handle API-related errors with appropriate notifications

**Methods**:
- `notifyApiError(error, context?)` - Notify API error with context
- `notifyApiSuccess(message, context?)` - Notify success message

**Error Handling**:
- Network errors: Connection problem messages
- Server errors (5xx): Server error messages
- Auth errors (401/403): Authentication required messages

---

### 3.3 useErrorNotifications()
**Purpose**: Handle specific error types with specialized notifications

**Methods**:
- `notifyNetworkError()` - Network connectivity error
- `notifyValidationError(errors)` - Validation error summary
- `notifyPermissionError()` - Permission denied error
- `notifyMaintenanceMode(estimatedTime?)` - Maintenance notification

---

### 3.4 useGlobalErrorListener()
**Purpose**: Listen for unhandled errors globally

**Features**:
- Listens to unhandledrejection events
- Listens to error events
- Automatically notifies via notifications

---

### 3.5 useTenantNotifications.ts
**File**: `/frontend/shared/packages/headless/src/hooks/tenant/useTenantNotifications.ts`

**Main Hook**: `useTenantNotifications(session)`

**Purpose**: Tenant-level notification management

**Returned Methods**:
- `loadNotifications()` - Load tenant notifications
- `markAsRead(notificationId)` - Mark single as read
- `markAllAsRead()` - Mark all as read
- `dismissNotification(notificationId)` - Delete notification
- `addNotification(notification)` - Add local notification

**State**:
- `notifications: TenantNotification[]`
- `unreadCount: number`
- `isLoading: boolean`

---

## 4. ANALYTICS HOOKS

### 4.1 useAnalytics.ts
**File**: `/frontend/shared/packages/headless/src/hooks/useAnalytics.ts`

**Main Hook**: `useAnalytics(options)`

**Purpose**: Comprehensive analytics with real-time updates, caching, and BI calculations

**Parameters**:
```typescript
{
  filters: {
    dateRange: { start: string; end: string };
    segments?: string[];
    regions?: string[];
    services?: string[];
    granularity: "hourly" | "daily" | "weekly" | "monthly";
  };
  refreshInterval?: number; // default: 30000
  enableRealTime?: boolean;
  cacheTime?: number; // default: 300000
  staleTime?: number; // default: 60000
}
```

**Returned Data**:
- `data: AnalyticsData | null`
- `metrics: AnalyticsMetric[]`
- `timeSeriesData: TimeSeriesData[]`
- `customerSegments: CustomerSegment[]`
- `geographicData: GeographicData[]`
- `serviceMetrics: ServiceMetrics[]`
- `summary: { totalRevenue, totalCustomers, avgChurn, avgARPU, profitMargin, growthRate }`

**Returned Methods**:
- `toggleRealTime()` - Toggle real-time updates
- `refreshData()` - Manually refresh all data
- `exportData(format)` - Export as CSV/Excel/PDF

**State**:
- `isLoading: boolean`
- `isError: boolean`
- `error: any`
- `isRealTimeActive: boolean`
- `lastUpdated: number`

**Queries**: Individual query objects for metrics, timeSeries, customerSegments, geographic, services

---

### 4.2 useRevenueAnalytics(filters)
**Purpose**: Specialized hook for revenue-focused analytics

**Returns**:
- `revenueMetrics: { total, average, trend, profitMargin, growthRate }`
- `timeSeriesData: TimeSeriesData[]`
- `isLoading: boolean`
- `isError: boolean`

---

### 4.3 useCustomerAnalytics(filters)
**Purpose**: Specialized hook for customer analytics

**Returns**:
- `customerMetrics: { total, churnRate, retentionRate, arpu, clv, segments }`
- `segments: CustomerSegment[]`
- `isLoading: boolean`
- `isError: boolean`

---

## 5. AUDIT & LOGGING HOOKS

### 5.1 useAuditLogger.ts
**File**: `/frontend/shared/packages/headless/src/hooks/useAuditLogger.ts`

**Main Hook**: `useAuditLogger(config)`

**Purpose**: Integrated audit logging with batch processing and offline support

**Parameters**:
```typescript
{
  serviceName: string;
  batchSize?: number; // default: 10
  batchTimeout?: number; // default: 5000
  enableLocalStorage?: boolean; // default: true
  enableConsoleLogging?: boolean;
}
```

**Core Logging Methods**:
- `logEvent(event)` - Log single audit event
- `logBatch(events)` - Log multiple events
- `flushBatch()` - Manually flush batch queue

**Convenience Methods**:
- `logAuthEvent(type, outcome, message, metadata?)` - Auth events
- `logDataAccess(operation, resourceType, resourceId, outcome, metadata?)` - Data access
- `logUIEvent(type, element, metadata?)` - UI interactions
- `logError(error, context, metadata?)` - Error logging
- `logBusinessEvent(type, workflow, outcome, metadata?)` - Business events

**State**:
- `isHealthy: boolean` - System health status
- `getQueueSize()` - Return pending event count

**Features**:
- Automatic batch flushing on timeout or size
- Local storage fallback for offline support
- Console logging for development
- Automatic context enrichment (user, tenant, session)

---

## 6. REAL-TIME & WEBSOCKET HOOKS

### 6.1 useRealTimeSync.ts
**File**: `/frontend/shared/packages/headless/src/hooks/useRealTimeSync.ts`

**Main Hook**: `useRealTimeSync(options)`

**Purpose**: Socket.io-based real-time synchronization with optimistic updates

**Parameters**:
```typescript
{
  url?: string; // default: env NEXT_PUBLIC_WEBSOCKET_URL
  autoConnect?: boolean;
  reconnect?: boolean;
  reconnectAttempts?: number; // default: 5
  reconnectDelay?: number; // default: 1000
  debug?: boolean;
}
```

**Methods**:
- `connect()` - Establish connection
- `disconnect()` - Close connection
- `reconnect()` - Force reconnection
- `subscribe(eventType, handler, options)` - Subscribe to events
- `emit(eventType, data, options)` - Emit event to server

**State**:
- `connected: boolean`
- `connecting: boolean`
- `error: string | null`
- `lastEvent: RealTimeEvent | null`
- `connectionAttempts: number`
- `isConnected: boolean`
- `socket: Socket | null`

**ISP-Specific Events**:
- Network: DEVICE_STATUS_CHANGED, DEVICE_METRICS_UPDATED, NETWORK_OUTAGE, NETWORK_MAINTENANCE
- Customer: CUSTOMER_CREATED, CUSTOMER_UPDATED, CUSTOMER_SERVICE_CHANGED
- Billing: INVOICE_GENERATED, PAYMENT_RECEIVED, PAYMENT_FAILED
- Support: TICKET_CREATED, TICKET_UPDATED, CHAT_MESSAGE
- System: USER_LOGIN, USER_LOGOUT, TENANT_UPDATED
- Alerts: CRITICAL_ALERT, WARNING_ALERT, INFO_ALERT

---

### 6.2 useRealTimeEvent(eventType, handler, options, syncOptions)
**Purpose**: Subscribe to specific real-time events

**Returns**: Automatic cleanup on unmount

---

### 6.3 useRealTimeData<T>(initialData, eventType, options)
**Purpose**: Real-time data synchronization with optimistic updates

**Methods**:
- `updateOptimistic(updateId, updater)` - Optimistic update
- `rollbackOptimistic(updateId)` - Rollback failed update

**State**:
- `data: T`
- `isStale: boolean`
- `setData(data)` - Manual data update

---

### 6.4 useWebSocket.ts
**File**: `/frontend/shared/packages/headless/src/hooks/useWebSocket.ts`

**Main Hook**: `useWebSocket(config)`

**Purpose**: Native WebSocket for real-time ISP framework updates

**Parameters**:
```typescript
{
  url?: string; // default: env NEXT_PUBLIC_WS_URL
  reconnectInterval?: number; // default: 3000
  maxReconnectAttempts?: number; // default: 10
  heartbeatInterval?: number; // default: 30000
  protocols?: string[]; // default: ["isp-protocol-v1"]
}
```

**Methods**:
- `connect()` - Establish connection
- `disconnect()` - Close connection
- `reconnect()` - Force reconnection
- `sendMessage(message)` - Send message
- `subscribe(eventType, callback)` - Subscribe to events
- `unsubscribe(eventType)` - Unsubscribe

**State**:
- `isConnected: boolean`
- `isConnecting: boolean`
- `error: string | null`
- `lastMessage: WebSocketMessage | null`
- `connectionQuality: "excellent" | "good" | "poor" | "offline"`

**Features**:
- Automatic heartbeat with latency detection
- Exponential backoff reconnection
- Tenant-aware authentication
- Multi-protocol support

---

### 6.5 Specialized WebSocket Hooks

#### useNetworkMonitoring()
**Purpose**: Monitor device status and network alerts in real-time

**Returns**:
- All useWebSocket properties
- `deviceUpdates: any[]` - Last 50 device updates
- `networkAlerts: any[]` - Last 20 network alerts
- `clearDeviceUpdates()` - Clear cache
- `clearNetworkAlerts()` - Clear cache

---

#### useCustomerActivity()
**Purpose**: Real-time customer activity monitoring

**Returns**:
- All useWebSocket properties
- `customerEvents: any[]` - Last 30 customer events
- `clearCustomerEvents()` - Clear cache

---

#### useFieldOperations()
**Purpose**: Track work orders and technician locations

**Returns**:
- All useWebSocket properties
- `workOrderUpdates: any[]` - Last 20 work orders
- `technicianLocations: Map<string, any>`
- `clearWorkOrderUpdates()`, `clearTechnicianLocations()`

---

## 7. COMMISSION & PARTNER HOOKS

### 7.1 useCommissions.ts
**File**: `/frontend/shared/packages/headless/src/hooks/useCommissions.ts`

**Main Hook**: `useCommissions(options)`

**Purpose**: Multi-tier commission tracking with real-time calculations

**Parameters**:
```typescript
{
  resellerId: string;
  filters?: {
    dateRange: { start, end };
    status?: string[];
    serviceTypes?: string[];
    transactionTypes?: string[];
  };
  autoRefresh?: boolean;
  refreshInterval?: number; // default: 300000
}
```

**Returned Data**:
- `rules: CommissionRule[]` - Commission rules
- `transactions: CommissionTransaction[]` - Commission transactions
- `payouts: CommissionPayout[]` - Payout history
- `summary: CommissionSummary` - Summary statistics
- `metrics: Extended metrics with calculated values`

**Calculated Metrics**:
- `currentMonthTransactions: number`
- `growthRate: number`
- `topService: { id, count, amount }`
- `pendingAmount: number`
- `isPayoutReady: boolean`
- `minPayoutAmount: number`
- `servicePerformance: { serviceId, count, amount }[]`

**Methods**:
- `calculateCommissionPreview(amount, serviceType, transactionType)` - Calculate preview
- `requestCommissionPayout(amount?)` - Request payout
- `exportCommissionData(format, dateRange?)` - Export CSV/Excel/PDF
- `refreshData()` - Manual refresh

**State**:
- `isLoading: boolean`
- `isError: boolean`
- `error: any`
- `isCalculating: boolean`
- `isRequestingPayout: boolean`

---

### 7.2 useCommissionCalculator(resellerId)
**Purpose**: Calculate commissions with tier-based logic

**Methods**:
- `getApplicableRule(serviceType)` - Get active rule for service
- `estimateCommission(amount, serviceType, monthlyRevenue)` - Estimate commission
- `calculateCommissionPreview()` - Preview calculation

---

### 7.3 usePayoutHistory(resellerId)
**Purpose**: Analyze payout history and trends

**Returns**:
- `payouts: CommissionPayout[]`
- `payoutStats: { totalPaid, averagePayout, lastPayout, payoutsByMonth, payoutCount }`
- `isLoading: boolean`
- `refreshData()` - Refresh

---

## 8. TENANT MANAGEMENT HOOKS

### 8.1 useISPTenant.ts
**File**: `/frontend/shared/packages/headless/src/hooks/useISPTenant.ts`

**Main Hook**: `useISPTenant()`

**Purpose**: Multi-tenant context management using composition pattern

**Returned Interface**:

**Session Management**:
- `session: TenantSession | null`
- `tenant: Tenant | null`
- `isLoading: boolean`
- `error: string | null`
- `loadTenant(tenantId)` - Load tenant
- `switchTenant(tenantId)` - Switch active tenant
- `refreshTenant()` - Refresh tenant data
- `clearTenant()` - Clear tenant

**Permission Methods**:
- `hasPermission(permission)` - Single permission check
- `hasAnyPermission(permissions)` - At least one permission
- `hasAllPermissions(permissions)` - All permissions required
- `hasFeature(feature)` - Feature enabled
- `hasModule(module)` - Module accessible

**Limits & Usage**:
- `getLimitsUsage()` - Get current usage
- `isLimitReached(limit)` - Check if at limit
- `getUsagePercentage(limit)` - Percentage of limit used
- `isTrialExpiring()` - Trial expiring soon
- `getTrialDaysLeft()` - Days remaining in trial
- `isTenantActive()` - Tenant is active

**Settings & Branding**:
- `getTenantSetting<T>(key, defaultValue?)` - Get setting
- `updateTenantSetting(key, value)` - Update setting
- `getBranding()` - Get branding config
- `applyBranding()` - Apply branding

**Notifications**:
- `notifications: TenantNotification[]`
- `unreadCount: number`
- `markNotificationRead(notificationId)`
- `markAllAsRead()`
- `dismissNotification(notificationId)`
- `addNotification(notification)`

**Composed Sub-hooks**:
- `useTenantSession()` - Session management
- `useTenantPermissions()` - Permission management
- `useTenantLimits()` - Usage limits
- `useTenantSettings()` - Settings management
- `useTenantNotifications()` - Notifications

---

### 8.2 useTenantSession.ts
**File**: `/frontend/shared/packages/headless/src/hooks/tenant/useTenantSession.ts`

**Purpose**: Tenant session lifecycle management

**Methods**:
- `loadTenant(tenantId)` - Load tenant session
- `switchTenant(tenantId)` - Switch tenant
- `refreshTenant()` - Refresh session
- `clearTenant()` - Clear session

---

### 8.3 useTenantPermissions.ts
**File**: `/frontend/shared/packages/headless/src/hooks/tenant/useTenantPermissions.ts`

**Purpose**: RBAC permission checking

**Methods**:
- `hasPermission(permission)` - Check single
- `hasAnyPermission(permissions)` - OR check
- `hasAllPermissions(permissions)` - AND check
- `hasFeature(feature)` - Feature check
- `hasModule(module)` - Module check

---

### 8.4 useTenantLimits.ts
**File**: `/frontend/shared/packages/headless/src/hooks/tenant/useTenantLimits.ts`

**Purpose**: Usage limit tracking and enforcement

**Methods**:
- `getLimitsUsage()` - Get usage data
- `isLimitReached(limit)` - Check limit
- `getUsagePercentage(limit)` - Usage %
- `isTrialExpiring()` - Trial expiring
- `getTrialDaysLeft()` - Days left
- `isTenantActive()` - Active status

---

### 8.5 useTenantSettings.ts
**File**: `/frontend/shared/packages/headless/src/hooks/tenant/useTenantSettings.ts`

**Purpose**: Tenant configuration and branding

**Methods**:
- `getTenantSetting<T>(key, defaultValue?)` - Get setting
- `updateTenantSetting(key, value)` - Update setting
- `getBranding()` - Get branding
- `applyBranding()` - Apply branding

---

## 9. PERFORMANCE MONITORING HOOKS

### 9.1 usePerformanceMonitoring.ts
**File**: `/frontend/shared/packages/headless/src/hooks/performance/usePerformanceMonitoring.ts`

**Main Hook**: `usePerformanceMonitoring(config)`

**Purpose**: Performance monitoring orchestration for Core Web Vitals and custom metrics

**Parameters**:
```typescript
{
  enableCoreWebVitals?: boolean;
  enableResourceTiming?: boolean;
  enableNavigationTiming?: boolean;
  enableCustomMetrics?: boolean;
  reportingInterval?: number; // default: 30000
  enableConsoleLogging?: boolean;
}
```

**Composed Sub-hooks**:
- `usePerformanceObservers()` - Observe performance events
- `useMetricTracking()` - Track metrics
- `usePerformanceReporting()` - Report metrics

---

### 9.2 usePerformanceObservers.ts
**Purpose**: Set up performance observers for various metrics

**Observes**:
- Core Web Vitals (LCP, FID, CLS)
- Resource timing
- Navigation timing
- Custom metrics

---

### 9.3 useMetricTracking.ts
**Purpose**: Track application metrics

**Returns**:
- Custom metric recording interface
- Metric aggregation

---

### 9.4 usePerformanceReporting.ts
**Purpose**: Report metrics to analytics backend

**Features**:
- Periodic reporting
- Batch submissions
- Error handling

---

### 9.5 useApiPerformanceTracking.ts
**Purpose**: Track API call performance

**Returns**:
- API call duration tracking
- Performance metrics

---

## INTEGRATION PATTERNS

### Authentication Integration
- Hooks check `useAuth()` for current user context
- Use `useISPTenant()` for tenant-aware operations
- Leverage `usePermissions()` for access control

### State Management
- Zustand for notifications (`useNotifications`)
- React Query for server state (analytics, commissions)
- Component state for UI interactions

### Real-time Integration
- WebSocket for live updates (`useWebSocket`)
- Socket.io for bi-directional communication (`useRealTimeSync`)
- Automatic reconnection with exponential backoff

### Error Handling
- Standardized error notifications
- Automatic retry logic
- Fallback to offline storage
- Comprehensive error logging

### Performance
- Query caching with configurable TTL
- Request batching
- Optimistic updates
- Performance monitoring

---

## USAGE RECOMMENDATIONS

### For Billing/Payments
- Use `useBilling()` for invoice management
- Use `usePaymentProcessor()` for multi-provider support
- Use payment sub-hooks for specific validation/security needs

### For Communications
- Use `useCommunication()` for multi-channel messaging
- Leverage templates for consistency
- Monitor delivery stats

### For Analytics
- Use specialized hooks (`useRevenueAnalytics`, `useCustomerAnalytics`)
- Enable real-time for dashboards
- Use filters for targeted analysis

### For Tenant Operations
- Always use `useISPTenant()` for tenant context
- Check permissions before sensitive operations
- Monitor usage limits

### For Real-time Features
- Use `useWebSocket()` for simple subscriptions
- Use `useRealTimeSync()` for complex bi-directional communication
- Implement optimistic updates for better UX

### For Auditing
- Use `useAuditLogger()` for all sensitive operations
- Batch events for efficiency
- Include rich metadata

---

## NOT YET INTEGRATED (Potential Areas)

1. **Customer Management Hooks** - May be in development
2. **Inventory Management** - Not found in current scan
3. **Advanced Scheduling** - Beyond basic scheduling
4. **Workflow Orchestration** - Complex workflow management
5. **Advanced Reporting** - Custom report building (exists but may need enhancement)
6. **Mobile-specific Hooks** - Mobile optimization patterns
7. **Offline Sync** - Advanced offline capabilities
8. **Cache Management** - Centralized cache control
9. **State Synchronization** - Cross-tab communication
10. **Advanced Search** - Full-text search integration

