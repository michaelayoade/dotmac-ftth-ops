# Frontend Code Standards & Best Practices

This document outlines code quality standards and best practices for the DotMac Platform frontend applications.

## Table of Contents

1. [Shared Types & Constants](#shared-types--constants)
2. [Error Handling](#error-handling)
3. [Internationalization (Future)](#internationalization)
4. [Accessibility](#accessibility)
5. [Code Quality](#code-quality)

---

## Shared Types & Constants

### Overview

All backend enums and constants have been centralized in `@dotmac/types` package to eliminate magic strings and ensure type safety.

### Location

```
frontend/shared/packages/types/src/
├── constants.ts    # Generated from backend Python enums
├── errors.ts       # Error types and utilities
└── index.ts        # Package exports
```

### Usage

#### ✅ DO: Use Shared Constants

```typescript
import { JobStatus, JobStatusLabels, JobStatusVariants } from '@dotmac/types';

// Type-safe status checks
if (job.status === JobStatus.RUNNING) {
  console.log('Job is running');
}

// Display human-readable labels
<span>{JobStatusLabels[job.status]}</span>

// Use correct badge variant
<Badge variant={JobStatusVariants[job.status]}>
  {JobStatusLabels[job.status]}
</Badge>
```

#### ❌ DON'T: Use Magic Strings

```typescript
// WRONG - prone to typos, no autocomplete, breaks refactoring
if (job.status === 'running') {
  console.log('Job is running');
}

// WRONG - hardcoded labels
<span>{job.status === 'running' ? 'Running' : 'Unknown'}</span>
```

### Available Enums

All enums are documented with their Python source location:

- **Jobs & Workflows**: `JobStatus`, `JobType`, `JobPriority`, `WorkflowStatus`, etc.
- **Tickets**: `TicketStatus`, `TicketPriority`, `TicketType`
- **Billing**: `InvoiceStatus`, `PaymentStatus`, `BillingCycle`, `PaymentMethodType`
- **Customers**: `CustomerStatus`, `CustomerType`, `CustomerTier`
- **Services**: `ServiceStatus`, `ServiceType`, `SubscriberStatus`
- **CRM**: `LeadStatus`, `LeadSource`, `QuoteStatus`
- **Communications**: `CommunicationType`, `CommunicationStatus`
- **And many more...**

### Helper Functions

```typescript
import { isEnumValue, getEnumValues, getEnumKeys } from "@dotmac/types";

// Validate enum value
if (isEnumValue(JobStatus, value)) {
  // TypeScript knows `value` is JobStatus
}

// Get all values for dropdown
const statuses = getEnumValues(JobStatus);
// ['pending', 'running', 'completed', ...]

// Get all keys
const keys = getEnumKeys(JobStatus);
// ['PENDING', 'RUNNING', 'COMPLETED', ...]
```

---

## Error Handling

### Overview

Standardized error handling utilities and components ensure consistent user experience across all error scenarios.

### Error Handling Utilities

Location: `frontend/shared/packages/types/src/errors.ts`

```typescript
import {
  createAppError,
  extractErrorMessage,
  isAuthError,
  isValidationError,
  extractFieldErrors,
  categorizeError,
  isRetryableError,
} from "@dotmac/types";

// Convert any error to standardized AppError
const appError = createAppError(error, {
  component: "MyComponent",
  action: "fetchData",
});

// Extract message from various error formats
const message = extractErrorMessage(error);

// Check error type
if (isAuthError(error)) {
  // Redirect to login
}

if (isValidationError(error)) {
  const fieldErrors = extractFieldErrors(error);
  // Show field-specific errors
}
```

### Error Handling Hooks

Location: `frontend/shared/packages/hooks/src/useErrorHandler.ts`

#### Basic Error Handler

```typescript
import { useErrorHandler } from '@dotmac/hooks';

function MyComponent() {
  const { error, handleError, clearError, retry, setRetry } = useErrorHandler({
    showToast: true,
    redirectOnAuthError: true,
  });

  const fetchData = async () => {
    try {
      const data = await api.getData();
      setData(data);
    } catch (err) {
      handleError(err, { component: 'MyComponent', action: 'fetchData' });
    }
  };

  return (
    <div>
      {error && (
        <ErrorAlert
          error={error}
          onClose={clearError}
          onRetry={retry}
        />
      )}
      <button onClick={fetchData}>Fetch Data</button>
    </div>
  );
}
```

#### API Error Handler with Auto-Retry

```typescript
import { useApiError } from '@dotmac/hooks';

function MyComponent() {
  const {
    error,
    handleError,
    isRetrying,
    retryCount,
    resetRetry,
  } = useApiError({
    autoRetry: true,
    maxRetries: 3,
    retryDelay: 1000,
  });

  const fetchData = async () => {
    try {
      const data = await api.getData();
      resetRetry(); // Reset retry count on success
      return data;
    } catch (err) {
      handleError(err);
    }
  };

  return (
    <div>
      {isRetrying && <p>Retrying... (Attempt {retryCount}/3)</p>}
    </div>
  );
}
```

#### Error Boundary Integration

```typescript
import { useAsyncError } from '@dotmac/hooks';

function MyComponent() {
  const throwError = useAsyncError();

  const handleClick = async () => {
    try {
      await doSomething();
    } catch (err) {
      // This will be caught by Error Boundary
      throwError(err);
    }
  };

  return <button onClick={handleClick}>Do Something</button>;
}
```

### Error UI Components

Location: `frontend/shared/packages/ui/src/ErrorAlert.tsx`

#### ErrorAlert

Full-featured error display with retry and dismiss:

```typescript
import { ErrorAlert } from '@dotmac/ui';

<ErrorAlert
  error={error}
  onClose={clearError}
  onRetry={retry}
  showRetry
  showClose
/>
```

#### FieldError

Validation error for form fields:

```typescript
import { FieldError } from '@dotmac/ui';

<div>
  <Input {...register('email')} />
  <FieldError error={errors.email?.message} />
</div>
```

#### InlineError

Compact inline error display:

```typescript
import { InlineError } from '@dotmac/ui';

<InlineError message="Something went wrong" />
```

### Best Practices

#### ✅ DO: Use Standardized Error Handling

```typescript
// In React Query
const { data, error } = useQuery({
  queryKey: ["customers"],
  queryFn: fetchCustomers,
  onError: (error) => {
    handleError(error, { query: "customers" });
  },
});

// In form submission
const onSubmit = async (data) => {
  try {
    await api.createCustomer(data);
    toast({ title: "Customer created successfully" });
  } catch (error) {
    handleError(error);
    // Field errors will be automatically extracted and can be used
    const fieldErrors = extractFieldErrors(error);
    if (fieldErrors) {
      Object.keys(fieldErrors).forEach((field) => {
        setError(field, { message: fieldErrors[field][0] });
      });
    }
  }
};
```

#### ❌ DON'T: Inconsistent Error Handling

```typescript
// WRONG - inconsistent, no context, poor UX
try {
  await api.getData();
} catch (error) {
  alert("Error!");
  console.log(error);
}
```

### Error Reporting Integration

Errors are automatically reported to the DotMac observability stack:

**Stack Components:**

- **OpenTelemetry Collector** - Receives logs, metrics, and traces
- **Prometheus** - Stores error metrics
- **Grafana Loki** - Stores error logs
- **Grafana Tempo** - Stores error traces

**Configuration:**

```bash
# .env.local
NEXT_PUBLIC_OTEL_ENDPOINT=http://localhost:4318
OBSERVABILITY__OTEL_ENDPOINT=http://localhost:4318
```

**Error Data Sent:**

```typescript
// Automatically captured by useErrorHandler
{
  timestamp: "2025-11-25T14:00:00Z",
  severity: "error",
  category: "network",
  message: "Failed to fetch data",
  statusCode: 500,
  context: {
    component: "MyComponent",
    action: "fetchData",
    userAgent: "...",
    url: "...",
    sessionId: "..."
  },
  attributes: {
    "error.id": "uuid",
    "error.category": "network",
    "error.severity": "error",
    "http.status_code": 500
  }
}
```

**Metrics Tracked:**

- `frontend.errors.total` - Total error count by category/severity
- `frontend.operation.duration` - Operation performance
- Custom metrics via `recordMetric()`

**Viewing Errors:**

1. **Grafana Dashboard** - Real-time error monitoring
2. **Prometheus Queries** - Error rate/count metrics
3. **Loki Logs** - Detailed error logs with context
4. **Tempo Traces** - Error correlation across services

---

## Internationalization (Future)

### Planned Implementation

We will implement i18n using `next-intl` for Next.js applications.

### DO's and DON'Ts

#### ✅ DO: Prepare for i18n

```typescript
// Keep strings in constants or future i18n files
const MESSAGES = {
  SUCCESS_TITLE: 'Success',
  ERROR_OCCURRED: 'An error occurred',
  CONFIRM_DELETE: 'Are you sure you want to delete this item?',
};

<Alert title={MESSAGES.SUCCESS_TITLE} />
```

#### ❌ DON'T: Hardcode User-Facing Text

```typescript
// WRONG - will be difficult to internationalize
<Button>Click Here</Button>
<Alert title="Error">An error occurred</Alert>
```

### Future i18n Usage

```typescript
// Future implementation with next-intl
import { useTranslations } from 'next-intl';

function MyComponent() {
  const t = useTranslations('MyComponent');

  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('description', { count: 5 })}</p>
    </div>
  );
}
```

---

## Accessibility

### Requirements

All interactive components must:

1. Have accessible labels
2. Support keyboard navigation
3. Provide proper ARIA attributes
4. Have sufficient color contrast

### Best Practices

#### ✅ DO: Provide Accessible Labels

```typescript
// Button with visible label
<Button>Save Changes</Button>

// Icon button with sr-only label
<Button variant="ghost" size="icon">
  <X className="h-4 w-4" />
  <span className="sr-only">Close dialog</span>
</Button>

// Input with label
<div>
  <Label htmlFor="email">Email Address</Label>
  <Input id="email" type="email" aria-required="true" />
</div>

// Image with alt text
<img src="/logo.png" alt="Company Logo" />

// Decorative image
<img src="/pattern.png" alt="" role="presentation" />
```

#### ❌ DON'T: Missing Accessibility

```typescript
// WRONG - no accessible label
<Button variant="ghost" size="icon">
  <X className="h-4 w-4" />
</Button>

// WRONG - missing label association
<Label>Email</Label>
<Input type="email" />

// WRONG - missing alt text
<img src="/important.png" />
```

### Dev Warnings

The `Button` component includes dev-time warnings for missing labels:

```typescript
// Development warning will appear in console
<Button variant="ghost" size="icon">
  <XIcon />
</Button>
// ⚠️ Warning: Icon-only button missing accessible label
```

### Testing Accessibility

```bash
# Run accessibility linters
pnpm lint:a11y

# Manual testing checklist:
# - Tab through all interactive elements
# - Use screen reader (NVDA, JAWS, VoiceOver)
# - Check color contrast (WCAG AA minimum)
# - Test with keyboard only (no mouse)
```

---

## Code Quality

### Type Safety

#### ✅ DO: Use Strong Types

```typescript
import { Customer, CustomerStatus } from "@dotmac/types";

// Fully typed
interface UpdateCustomerParams {
  id: string;
  status: CustomerStatus;
  metadata?: Record<string, unknown>;
}

async function updateCustomer(params: UpdateCustomerParams): Promise<Customer> {
  const response = await api.patch<Customer>(`/customers/${params.id}`, params);
  return response.data;
}
```

#### ❌ DON'T: Use `any` or Weak Types

```typescript
// WRONG - loses type safety
async function updateCustomer(id: any, data: any): Promise<any> {
  return api.patch(`/customers/${id}`, data);
}
```

### Component Organization

```typescript
// Good component structure
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CustomerStatus } from '@dotmac/types';
import { useErrorHandler } from '@dotmac/hooks';
import { Button, Badge } from '@dotmac/ui';
import type { Customer } from '@/types';

interface CustomerListProps {
  status?: CustomerStatus;
  limit?: number;
}

export function CustomerList({ status, limit = 10 }: CustomerListProps) {
  const { handleError } = useErrorHandler();

  const { data, isLoading } = useQuery({
    queryKey: ['customers', status, limit],
    queryFn: () => fetchCustomers({ status, limit }),
    onError: handleError,
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      {data?.customers.map((customer) => (
        <CustomerCard key={customer.id} customer={customer} />
      ))}
    </div>
  );
}
```

### Linting & Formatting

```bash
# Run type checking
pnpm type-check

# Run linter
pnpm lint

# Fix lint issues
pnpm lint:fix

# Format code
pnpm format
```

---

## Migration Guide

### Replacing Magic Strings

1. **Find all magic strings**:

   ```bash
   grep -r "status === 'running'" --include="*.tsx"
   ```

2. **Replace with enum**:

   ```typescript
   // Before
   job.status === "running";

   // After
   import { JobStatus } from "@dotmac/types";
   job.status === JobStatus.RUNNING;
   ```

3. **Update labels**:

   ```typescript
   // Before
   {
     job.status === "running" ? "Running" : "Unknown";
   }

   // After
   import { JobStatusLabels } from "@dotmac/types";
   {
     JobStatusLabels[job.status];
   }
   ```

### Standardizing Error Handling

1. **Replace ad-hoc error handling**:

   ```typescript
   // Before
   try {
     await api.getData();
   } catch (error) {
     console.error(error);
     toast({ title: "Error", description: "Something went wrong" });
   }

   // After
   const { handleError } = useErrorHandler({ showToast: true });
   try {
     await api.getData();
   } catch (error) {
     handleError(error, { component: "MyComponent", action: "getData" });
   }
   ```

2. **Replace error displays**:

   ```typescript
   // Before
   {error && <div className="error">{error.message}</div>}

   // After
   import { ErrorAlert } from '@dotmac/ui';
   {error && <ErrorAlert error={error} onClose={clearError} />}
   ```

---

## Summary

### Key Takeaways

1. **Use shared constants** from `@dotmac/types` - no magic strings
2. **Standardize error handling** with `useErrorHandler` and `ErrorAlert`
3. **Prepare for i18n** by avoiding hardcoded strings
4. **Prioritize accessibility** - labels, keyboard nav, ARIA
5. **Maintain type safety** - avoid `any`, use proper types

### Quick Reference

```typescript
// Shared constants
import { JobStatus, JobStatusLabels } from "@dotmac/types";

// Error handling
import { useErrorHandler, useApiError } from "@dotmac/hooks";
import { ErrorAlert, FieldError } from "@dotmac/ui";

// Error utilities
import { createAppError, isAuthError, extractFieldErrors } from "@dotmac/types";
```

---

## Questions or Issues?

- Open an issue in the repo
- Check existing documentation in `/docs`
- Ask in team Slack channel
