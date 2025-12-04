# Error Handling Standards - ISP Framework

This guide outlines the standardized error handling patterns used throughout the ISP Framework frontend applications.

## Overview

The ISP Framework uses a unified error handling system that provides:

- **Consistent error classification and messaging**
- **Automatic retry logic for transient failures**
- **User-friendly error messages with technical details**
- **Comprehensive error logging and telemetry**
- **Graceful fallbacks and error boundaries**

## Core Components

### 1. ISPError Class

The `ISPError` class is the foundation of our error handling system:

```typescript
import { ISPError, ErrorFactory } from "@dotmac/headless/utils/errorUtils";

// Create specific error types
const networkError = ErrorFactory.network("Connection failed", "API Call");
const validationError = ErrorFactory.validation("Invalid email format", "User Registration");
const authError = ErrorFactory.authentication("Login Required");
```

### 2. Standard Error Handler Hook

Use `useStandardErrorHandler` for consistent error handling in components:

```typescript
import { useStandardErrorHandler } from '@dotmac/headless/hooks/useStandardErrorHandler';

function MyComponent() {
  const errorHandler = useStandardErrorHandler({
    context: 'My Component',
    enableRetry: true,
    maxRetries: 3,
    fallbackData: null,
  });

  const handleApiCall = async () => {
    const result = await errorHandler.withErrorHandling(async () => {
      return await apiCall();
    });

    if (result) {
      // Handle success
    } else if (errorHandler.error) {
      // Handle error state
    }
  };

  return (
    <div>
      {errorHandler.error && (
        <div className="error">
          {errorHandler.error.userMessage}
          {errorHandler.error.retryable && (
            <button onClick={errorHandler.retry}>Retry</button>
          )}
        </div>
      )}
    </div>
  );
}
```

### 3. Error Boundaries

Wrap components with standardized error boundaries:

```typescript
import { StandardErrorBoundary, withErrorBoundary } from '@dotmac/headless/components/StandardErrorBoundary';

// Option 1: HOC Pattern
export default withErrorBoundary(MyComponent, {
  level: 'component',
  enableRetry: true,
  context: 'My Component',
});

// Option 2: Wrapper Component
function App() {
  return (
    <StandardErrorBoundary level="application" enableRetry={true}>
      <MyComponent />
    </StandardErrorBoundary>
  );
}
```

### 4. Global Error Handling

Configure global error handling with the provider:

```typescript
import { ErrorHandlingProvider } from '@dotmac/headless/providers/ErrorHandlingProvider';

function App() {
  return (
    <ErrorHandlingProvider
      enableTelemetry={true}
      telemetryEndpoint="/api/telemetry/errors"
      initialConfig={{
        enableLogging: true,
        enableUserNotifications: true,
        maxRetries: 3,
      }}
    >
      <YourApp />
    </ErrorHandlingProvider>
  );
}
```

## Error Categories and Handling

### Network Errors

```typescript
// Automatic retry with exponential backoff
const errorHandler = useApiErrorHandler("Customer API", {
  enableRetry: true,
  maxRetries: 3,
  fallbackData: [],
});
```

### Validation Errors

```typescript
// No retry, immediate user feedback
const errorHandler = useFormErrorHandler("Registration Form", {
  enableRetry: false,
  enableNotifications: true,
});
```

### Authentication Errors

```typescript
// Redirect to login, no retry
const errorHandler = useStandardErrorHandler({
  context: "Protected Resource",
  enableRetry: false,
  onError: (error) => {
    if (error.category === "authentication") {
      router.push("/login");
    }
  },
});
```

### System Errors

```typescript
// Retry with fallback data
const errorHandler = useDataLoadingErrorHandler("Dashboard Data", {
  enableRetry: true,
  maxRetries: 2,
  fallbackData: getEmptyDashboardData(),
});
```

## Best Practices

### 1. Use Appropriate Error Types

```typescript
// ✅ Good - Specific error types
throw ErrorFactory.validation("Email is required", "User Registration");
throw ErrorFactory.authentication("Session expired");
throw ErrorFactory.authorization("Insufficient permissions", "Billing Access");

// ❌ Bad - Generic errors
throw new Error("Something went wrong");
```

### 2. Provide Context

```typescript
// ✅ Good - Clear context
const errorHandler = useStandardErrorHandler({
  context: "Customer Payment Processing",
  // ...
});

// ❌ Bad - Vague context
const errorHandler = useStandardErrorHandler({
  context: "API",
  // ...
});
```

### 3. Handle Different Severities

```typescript
// Critical errors - Immediate user notification + logging
if (error.severity === "critical") {
  showError(error.userMessage, { persistent: true });
  reportToSupport(error);
}

// Medium errors - User notification
if (error.severity === "medium") {
  showWarning(error.userMessage);
}

// Low errors - Silent logging only
if (error.severity === "low") {
  logError(error);
}
```

### 4. Implement Graceful Fallbacks

```typescript
const errorHandler = useStandardErrorHandler({
  context: "Dashboard Widget",
  fallbackData: getEmptyWidgetData(),
  onFallback: (fallbackData) => {
    setWidgetData(fallbackData);
    showInfo("Using cached data due to connectivity issues");
  },
});
```

## API Client Integration

Update your API clients to use standardized error handling:

```typescript
import { BaseApiClient } from "@dotmac/headless/api/clients/BaseApiClient";

export class CustomApiClient extends BaseApiClient {
  constructor() {
    super("/api/custom", {}, "Custom Service");
  }

  async getCustomers(): Promise<Customer[]> {
    // BaseApiClient automatically handles errors and converts to ISPError
    return this.get("/customers");
  }
}
```

## Component Error Boundaries

Use different error boundary levels:

```typescript
// Application-level - Full page error handling
<StandardErrorBoundary level="application" enableRetry={true}>
  <App />
</StandardErrorBoundary>

// Component-level - Section error handling
<StandardErrorBoundary level="component" enableRetry={true}>
  <DashboardWidget />
</StandardErrorBoundary>

// Widget-level - Minimal error display
<StandardErrorBoundary level="widget" enableRetry={false}>
  <StatCard />
</StandardErrorBoundary>
```

## Error Logging and Telemetry

### Automatic Logging

All errors are automatically logged with:

- User context (tenant, session)
- Error classification and severity
- Stack traces and technical details
- Deduplication to prevent spam

### Custom Error Reporting

```typescript
import { useErrorReporting } from "@dotmac/headless/providers/ErrorHandlingProvider";

function MyComponent() {
  const { reportError, reportBusinessError } = useErrorReporting();

  const handleBusinessLogic = () => {
    if (invalidState) {
      reportBusinessError("Invalid customer state for payment processing", "Payment Flow", {
        customerId: customer.id,
        state: customer.state,
      });
    }
  };
}
```

## Testing Error Handling

### Unit Tests

```typescript
import { classifyError, ISPError } from "@dotmac/headless/utils/errorUtils";

describe("Error Classification", () => {
  it("should classify network errors correctly", () => {
    const networkError = new TypeError("fetch failed");
    const classified = classifyError(networkError, "Test Context");

    expect(classified).toBeInstanceOf(ISPError);
    expect(classified.category).toBe("network");
    expect(classified.retryable).toBe(true);
  });
});
```

### Integration Tests

```typescript
import { useStandardErrorHandler } from "@dotmac/headless/hooks/useStandardErrorHandler";

describe("Error Handler Integration", () => {
  it("should retry failed operations", async () => {
    const mockOperation = jest
      .fn()
      .mockRejectedValueOnce(new Error("Temporary failure"))
      .mockResolvedValueOnce("Success");

    const { result } = renderHook(() =>
      useStandardErrorHandler({ context: "Test", enableRetry: true }),
    );

    const operationResult = await result.current.withErrorHandling(mockOperation);

    expect(mockOperation).toHaveBeenCalledTimes(2);
    expect(operationResult).toBe("Success");
  });
});
```

## Development Tools

### Error Dev Overlay

In development mode, use the error overlay to monitor errors:

```typescript
import { ErrorDevOverlay } from '@dotmac/headless/providers/ErrorHandlingProvider';

function App() {
  return (
    <>
      <YourApp />
      <ErrorDevOverlay />
    </>
  );
}
```

### Error Statistics

Monitor error patterns in your components:

```typescript
import { useErrorHandling } from '@dotmac/headless/providers/ErrorHandlingProvider';

function ErrorDashboard() {
  const { errorStats, globalErrors } = useErrorHandling();

  return (
    <div>
      <p>Total Errors: {errorStats.totalErrors}</p>
      <p>Critical Errors: {errorStats.criticalErrors}</p>
      <p>Network Errors: {errorStats.networkErrors}</p>
    </div>
  );
}
```

## Migration Guide

### Updating Existing Code

1. **Replace generic try/catch blocks:**

```typescript
// Before
try {
  await apiCall();
} catch (error) {
  console.error(error);
  setError(error.message);
}

// After
const errorHandler = useApiErrorHandler("My API", {
  fallbackData: null,
});

const result = await errorHandler.withErrorHandling(async () => {
  return await apiCall();
});
```

2. **Update API clients:**

```typescript
// Before
export class MyApiClient {
  async getData() {
    const response = await fetch("/api/data");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
  }
}

// After
export class MyApiClient extends BaseApiClient {
  constructor() {
    super("/api", {}, "My Service");
  }

  async getData() {
    return this.get("/data");
  }
}
```

3. **Add error boundaries:**

```typescript
// Before
function MyComponent() {
  return <ComplexWidget />;
}

// After
export default withErrorBoundary(MyComponent, {
  level: 'component',
  context: 'My Component',
});
```

## Configuration Options

### Global Configuration

```typescript
const errorConfig = {
  enableLogging: true, // Log errors to console/telemetry
  enableTelemetry: true, // Send errors to monitoring service
  enableUserNotifications: true, // Show user-friendly notifications
  maxRetries: 3, // Maximum retry attempts
  retryDelayMs: 1000, // Base retry delay
  fallbackEnabled: true, // Enable fallback data
};
```

### Component-Specific Configuration

```typescript
const componentErrorHandler = useStandardErrorHandler({
  context: "Component Name",
  enableRetry: true,
  enableNotifications: false,
  maxRetries: 2,
  retryDelay: 2000,
  fallbackData: getEmptyState(),
  onError: (error) => trackErrorEvent(error),
  onRetry: (attempt) => trackRetryEvent(attempt),
  onFallback: (data) => trackFallbackEvent(data),
});
```

This standardized approach ensures consistent error handling across the entire ISP Framework, improving user experience and system reliability.
