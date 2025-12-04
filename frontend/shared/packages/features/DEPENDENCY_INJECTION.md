# Dependency Injection Pattern Guide

## Table of Contents

1. [Overview](#overview)
2. [Why Dependency Injection](#why-dependency-injection)
3. [The Pattern](#the-pattern)
4. [Common Dependencies](#common-dependencies)
5. [Creating Shared Components](#creating-shared-components)
6. [Creating App Wrappers](#creating-app-wrappers)
7. [Type Naming Conventions](#type-naming-conventions)
8. [Pattern Variants](#pattern-variants)
9. [Testing Strategy](#testing-strategy)
10. [Best Practices](#best-practices)

## Overview

The `@dotmac/features` package uses **Pattern 2: Wrapper Component with Dependency Injection** to create shared components that work across multiple applications with different runtime dependencies.

### The Problem

```
DotMac Platform Architecture:
    Backend (Python FastAPI)
        ├── Platform Admin App (Next.js)
        │   ├── Different auth strategy
        │   ├── Different API base URL
        │   └── Different error handling
        └── ISP Ops App (Next.js)
            ├── Different auth strategy
            ├── Different API base URL
            └── Different error handling
```

**Challenge**: How do we share UI components across apps with different:

- API clients (auth, error handling, base URLs)
- Toast notification systems
- Routing strategies
- Logging implementations
- State management approaches

**Solution**: Dependency Injection

## Why Dependency Injection

### Without DI (Problematic)

```typescript
// ❌ BAD: Hard-coded dependencies
import { apiClient } from "@/lib/api/client"; // App-specific import!
import { useToast } from "@/hooks/useToast"; // App-specific import!

export function CustomerBilling({ customerId }: Props) {
  const { toast } = useToast();

  const fetchData = async () => {
    const response = await apiClient.get(`/api/isp/v1/admin/customers/${customerId}`);
    // ...
  };

  // ...
}
```

**Problems**:

1. Can't share across apps (imports are app-specific)
2. Hard to test (can't mock dependencies)
3. Tight coupling to specific implementations
4. Can't reuse in Storybook or isolated environments

### With DI (Correct)

```typescript
// ✅ GOOD: Dependencies injected as props
export interface CustomerBillingProps {
  customerId: string;
  apiClient: CustomerBillingApiClient;
  useToast: () => { toast: (options: any) => void };
  invoiceViewUrlPrefix: string;
}

export default function CustomerBilling({
  customerId,
  apiClient,
  useToast,
  invoiceViewUrlPrefix,
}: CustomerBillingProps) {
  const { toast } = useToast();

  const fetchData = async () => {
    const response = await apiClient.get(`/api/isp/v1/admin/customers/${customerId}`);
    // ...
  };

  // ...
}
```

**Benefits**:

1. ✅ Works in any app (no app-specific imports)
2. ✅ Easy to test (mock dependencies)
3. ✅ Loose coupling
4. ✅ Works in Storybook, tests, multiple apps

## The Pattern

### Two-Layer Architecture

```
┌─────────────────────────────────────────┐
│ App Layer (ISP Ops or Platform Admin)  │
│  - Imports shared component             │
│  - Provides app-specific dependencies   │
│  - Thin wrapper (5-10 lines)            │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ Shared Component (@dotmac/features)     │
│  - Pure UI logic                        │
│  - Accepts dependencies as props        │
│  - No app-specific imports              │
│  - Fully testable                       │
└─────────────────────────────────────────┘
```

### Layer 1: Shared Component (in @dotmac/features)

**Location**: `shared/packages/features/src/[module]/components/ComponentName.tsx`

**Responsibilities**:

- Implement UI logic
- Accept dependencies as props
- Define prop interfaces
- Export component and types

**Example**:

```typescript
// shared/packages/features/src/billing/components/CustomerBilling.tsx
"use client";

import { useState, useEffect } from "react";
import { Card, Button } from "@dotmac/ui";

// ============================================================================
// Types
// ============================================================================

export interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  status: "paid" | "pending" | "overdue";
}

export interface CustomerBillingApiClient {
  get: <T = any>(url: string, config?: any) => Promise<{ data: T }>;
}

export interface CustomerBillingProps {
  customerId: string;
  apiClient: CustomerBillingApiClient;
  useToast: () => { toast: (options: any) => void };
  invoiceViewUrlPrefix: string;
}

// ============================================================================
// Component
// ============================================================================

export default function CustomerBilling({
  customerId,
  apiClient,
  useToast,
  invoiceViewUrlPrefix,
}: CustomerBillingProps) {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        const response = await apiClient.get<{ invoices: Invoice[] }>(
          `/api/isp/v1/admin/customers/${customerId}/invoices`
        );
        setInvoices(response.data.invoices);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load invoices",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchInvoices();
  }, [customerId, apiClient, toast]);

  const handleViewInvoice = (invoiceId: string) => {
    window.open(`${invoiceViewUrlPrefix}/${invoiceId}`, "_blank");
  };

  return (
    <Card>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div>
          {invoices.map(invoice => (
            <div key={invoice.id}>
              <span>{invoice.invoice_number}</span>
              <Button onClick={() => handleViewInvoice(invoice.id)}>
                View
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
```

### Layer 2: App Wrapper (in each app)

**Location**: `apps/[app-name]/components/[module]/ComponentName.tsx`

**Responsibilities**:

- Import shared component
- Import app-specific dependencies
- Provide dependencies to shared component
- Simplify props for app usage

**Example for ISP Ops App**:

```typescript
// apps/isp-ops-app/components/customers/CustomerBilling.tsx
"use client";

import { CustomerBilling as SharedCustomerBilling } from "@dotmac/features/billing";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@dotmac/ui";

interface CustomerBillingWrapperProps {
  customerId: string;
}

export function CustomerBilling({ customerId }: CustomerBillingWrapperProps) {
  return (
    <SharedCustomerBilling
      customerId={customerId}
      apiClient={apiClient}
      useToast={useToast}
      invoiceViewUrlPrefix="/dashboard/billing/invoices"
    />
  );
}
```

**Example for Platform Admin App**:

```typescript
// apps/platform-admin-app/components/customers/CustomerBilling.tsx
"use client";

import { CustomerBilling as SharedCustomerBilling } from "@dotmac/features/billing";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@dotmac/ui";

interface CustomerBillingWrapperProps {
  customerId: string;
}

export function CustomerBilling({ customerId }: CustomerBillingWrapperProps) {
  return (
    <SharedCustomerBilling
      customerId={customerId}
      apiClient={apiClient}
      useToast={useToast}
      invoiceViewUrlPrefix="/admin/billing/invoices" // Different URL!
    />
  );
}
```

## Common Dependencies

### 1. API Client

**Purpose**: Make HTTP requests to backend

**Interface Pattern**:

```typescript
export interface [ComponentName]ApiClient {
  get: <T = any>(url: string, config?: any) => Promise<{ data: T }>;
  post?: <T = any>(url: string, data?: any, config?: any) => Promise<{ data: T }>;
  put?: <T = any>(url: string, data?: any, config?: any) => Promise<{ data: T }>;
  delete?: <T = any>(url: string, config?: any) => Promise<{ data: T }>;
}
```

**Why**: Different apps have different:

- Authentication strategies (JWT tokens, session cookies)
- Base URLs
- Error handling
- Request interceptors
- Response transformations

**Example**:

```typescript
// Shared component
export interface InvoiceListApiClient {
  get: <T = any>(url: string, config?: any) => Promise<{ data: T }>;
}

export interface InvoiceListProps {
  apiClient: InvoiceListApiClient;
  // ... other props
}

// ISP Ops wrapper
import { apiClient } from "@/lib/api/client"; // ISP-specific client
return <InvoiceList apiClient={apiClient} />;

// Platform Admin wrapper
import { apiClient } from "@/lib/api/client"; // Admin-specific client
return <InvoiceList apiClient={apiClient} />;
```

### 2. Toast Notifications

**Purpose**: Display user feedback messages

**Interface Pattern**:

```typescript
export interface [ComponentName]Props {
  useToast: () => {
    toast: (options: {
      title?: string;
      description?: string;
      variant?: "default" | "destructive" | "success";
      duration?: number;
    }) => void;
  };
}
```

**Why**: Different apps might use:

- Different toast libraries (sonner, react-hot-toast, shadcn)
- Different styling
- Different positioning
- Different durations

**Example**:

```typescript
// Shared component
export default function CreateCustomerModal({
  useToast,
  // ...
}: CreateCustomerModalProps) {
  const { toast } = useToast();

  const handleSubmit = async () => {
    try {
      // ...
      toast({
        title: "Success",
        description: "Customer created successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create customer",
        variant: "destructive",
      });
    }
  };
}

// App wrapper
import { useToast } from "@dotmac/ui"; // App-specific toast
return <CreateCustomerModal useToast={useToast} />;
```

### 3. Logger

**Purpose**: Structured logging

**Interface Pattern**:

```typescript
export interface [ComponentName]Logger {
  info: (message: string, context?: any) => void;
  error: (message: string, error?: Error, context?: any) => void;
  warn?: (message: string, context?: any) => void;
  debug?: (message: string, context?: any) => void;
}
```

**Why**: Different apps have:

- Different logging services (Sentry, LogRocket, DataDog)
- Different log levels
- Different context enrichment

**Example**:

```typescript
// Shared component
export interface DiagnosticsDashboardLogger {
  info: (message: string, context?: any) => void;
  error: (message: string, error?: Error, context?: any) => void;
}

export default function DiagnosticsDashboard({
  logger,
  // ...
}: DiagnosticsDashboardProps) {
  const handleDiagnostic = async () => {
    logger.info("Starting diagnostic", { type: "ping" });
    try {
      // ...
    } catch (error) {
      logger.error("Diagnostic failed", error as Error, { type: "ping" });
    }
  };
}

// App wrapper
import { logger } from "@/lib/logger";
return <DiagnosticsDashboard logger={logger} />;
```

### 4. Router/Navigation

**Purpose**: Navigate between pages

**Interface Pattern**:

```typescript
export interface [ComponentName]Router {
  push: (path: string) => void;
  replace?: (path: string) => void;
  back?: () => void;
}
```

**Why**: Different apps have:

- Different routing strategies (Next.js App Router, Pages Router)
- Different base paths
- Different URL structures

**Example**:

```typescript
// Shared component
export interface CustomerDetailModalRouter {
  push: (path: string) => void;
}

export default function CustomerDetailModal({
  router,
  // ...
}: CustomerDetailModalProps) {
  const handleEditCustomer = () => {
    router.push(`/customers/${customerId}/edit`);
  };
}

// ISP Ops wrapper
import { useRouter } from "next/navigation";
const router = useRouter();
return <CustomerDetailModal router={router} />;
```

### 5. Configuration/URLs

**Purpose**: App-specific configuration values

**Pattern**: Pass as simple props

```typescript
export interface [ComponentName]Props {
  baseUrl?: string;
  redirectUrl?: string;
  featureFlags?: { [key: string]: boolean };
}
```

**Why**: Different apps have:

- Different URL structures
- Different feature flags
- Different branding

**Example**:

```typescript
// Shared component
export default function InvoiceDetailModal({
  invoiceViewUrlPrefix,
  downloadEnabled = true,
  // ...
}: InvoiceDetailModalProps) {
  const handleView = () => {
    window.open(`${invoiceViewUrlPrefix}/${invoiceId}`);
  };
}

// ISP Ops wrapper
return (
  <InvoiceDetailModal
    invoiceViewUrlPrefix="/dashboard/billing/invoices"
    downloadEnabled={true}
  />
);

// Platform Admin wrapper
return (
  <InvoiceDetailModal
    invoiceViewUrlPrefix="/admin/billing/invoices"
    downloadEnabled={false} // Disabled for platform admin
  />
);
```

## Creating Shared Components

### Step-by-Step Guide

**Step 1: Identify Dependencies**

Before creating a shared component, identify what external dependencies it needs:

```
Questions to ask:
- Does it make API calls? → Need apiClient
- Does it show notifications? → Need useToast
- Does it navigate? → Need router
- Does it log events? → Need logger
- Does it need URLs? → Need URL props
```

**Step 2: Define Interfaces**

Create TypeScript interfaces for all dependencies:

```typescript
// Define minimal API client interface
export interface CustomerListApiClient {
  get: <T = any>(url: string, config?: any) => Promise<{ data: T }>;
  post: <T = any>(url: string, data?: any, config?: any) => Promise<{ data: T }>;
}

// Define data types
export interface Customer {
  id: string;
  name: string;
  email: string;
  status: string;
}

// Define component props
export interface CustomerListProps {
  apiClient: CustomerListApiClient;
  useToast: () => { toast: (options: any) => void };
  onCustomerSelect?: (customer: Customer) => void;
}
```

**Step 3: Implement Component**

```typescript
// shared/packages/features/src/customers/components/CustomerList.tsx
"use client";

import { useState, useEffect } from "react";
import { Table } from "@dotmac/ui";

// ============================================================================
// Types
// ============================================================================

export interface Customer {
  id: string;
  name: string;
  email: string;
  status: string;
}

export interface CustomerListApiClient {
  get: <T = any>(url: string, config?: any) => Promise<{ data: T }>;
}

export interface CustomerListProps {
  apiClient: CustomerListApiClient;
  useToast: () => { toast: (options: any) => void };
  onCustomerSelect?: (customer: Customer) => void;
}

// ============================================================================
// Component
// ============================================================================

export default function CustomerList({
  apiClient,
  useToast,
  onCustomerSelect,
}: CustomerListProps) {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const response = await apiClient.get<{ customers: Customer[] }>(
          "/api/isp/v1/admin/customers"
        );
        setCustomers(response.data.customers);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load customers",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, [apiClient, toast]);

  return (
    <Table>
      {/* Table implementation */}
    </Table>
  );
}
```

**Step 4: Export from Module**

```typescript
// shared/packages/features/src/customers/components/index.ts
export { default as CustomerList } from "./CustomerList";
export type { CustomerListProps, Customer, CustomerListApiClient } from "./CustomerList";
```

**Step 5: Update Module Index**

```typescript
// shared/packages/features/src/customers/index.ts
export * from "./components";
```

## Creating App Wrappers

### Step-by-Step Guide

**Step 1: Create Wrapper File**

```typescript
// apps/isp-ops-app/components/customers/CustomerList.tsx
"use client";

import { CustomerList as SharedCustomerList } from "@dotmac/features/customers";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@dotmac/ui";
import { useRouter } from "next/navigation";

interface CustomerListWrapperProps {
  onCustomerSelect?: (customerId: string) => void;
}

export function CustomerList({ onCustomerSelect }: CustomerListWrapperProps) {
  const router = useRouter();

  const handleCustomerSelect = (customer: any) => {
    if (onCustomerSelect) {
      onCustomerSelect(customer.id);
    } else {
      // Default behavior: navigate to customer detail
      router.push(`/dashboard/customers/${customer.id}`);
    }
  };

  return (
    <SharedCustomerList
      apiClient={apiClient}
      useToast={useToast}
      onCustomerSelect={handleCustomerSelect}
    />
  );
}
```

**Step 2: Use in Pages**

```typescript
// apps/isp-ops-app/app/dashboard/customers/page.tsx
import { CustomerList } from "@/components/customers/CustomerList";

export default function CustomersPage() {
  return (
    <div>
      <h1>Customers</h1>
      <CustomerList />
    </div>
  );
}
```

## Type Naming Conventions

### To Avoid Conflicts

When creating types that might conflict with app-level types, use these conventions:

**1. Component-Specific Types**

Prefix with component name:

```typescript
// ✅ GOOD
export interface CustomerListApiClient {}
export interface CustomerListProps {}

// ❌ BAD (too generic, might conflict)
export interface ApiClient {}
export interface Props {}
```

**2. Data Types**

Use descriptive, specific names:

```typescript
// ✅ GOOD
export interface Invoice {}
export interface Customer {}
export interface BandwidthProfile {}

// ⚠️ OK but be careful
export interface User {} // Might conflict with auth User type
```

**3. Namespaced Exports**

For modules with many types, use namespaces:

```typescript
// network/index.ts
export * as VOLTHATypes from "./types/voltha";

// Usage
import { VOLTHATypes } from "@dotmac/features/network";
const onu: VOLTHATypes.ONU = { ... };
```

## Pattern Variants

### Variant 1: Simple Props Only

For components with no external dependencies:

```typescript
// Shared component
export interface CustomersMetricsProps {
  metrics: CustomerMetrics | null;
  loading: boolean;
}

export default function CustomersMetrics({ metrics, loading }: CustomersMetricsProps) {
  // Pure UI, no API calls or side effects
  return <div>{/* Render metrics */}</div>;
}

// App usage - direct import, no wrapper needed
import { CustomersMetrics } from "@dotmac/features/crm";

<CustomersMetrics metrics={metrics} loading={loading} />
```

**When to use**: Components that:

- Only display data (no fetching)
- Have no side effects
- Need no app-specific dependencies

### Variant 2: Full Dependency Injection

For components with multiple dependencies:

```typescript
// Shared component
export interface DiagnosticsDashboardProps {
  apiClient: DiagnosticsApiClient;
  useToast: () => { toast: (options: any) => void };
  logger: DiagnosticsLogger;
  router: DiagnosticsRouter;
  wsEndpoint: string;
}

// App wrapper
<DiagnosticsDashboard
  apiClient={apiClient}
  useToast={useToast}
  logger={logger}
  router={router}
  wsEndpoint={process.env.NEXT_PUBLIC_WS_URL}
/>
```

**When to use**: Components that:

- Make API calls
- Show notifications
- Navigate
- Log events
- Use WebSockets or other services

### Variant 3: Hooks Injection

For components that need React hooks:

```typescript
// Shared component
export interface ONUListViewProps {
  useONUs: () => {
    onus: ONU[];
    loading: boolean;
    error: Error | null;
    refetch: () => void;
  };
}

// App wrapper
import { useONUs } from "@/hooks/useONUs";

<ONUListView useONUs={useONUs} />
```

**When to use**: Components that:

- Need complex data fetching logic
- Use TanStack Query or SWR
- Have polling or real-time updates

### Variant 4: Factory Pattern

For components that need to be created with dependencies:

```typescript
// Shared component
export function createPermissionGuard(dependencies: PermissionGuardDependencies) {
  return function PermissionGuard({ children, permission }: PermissionGuardProps) {
    // Use dependencies
    return <>{children}</>;
  };
}

// App wrapper
import { createPermissionGuard } from "@dotmac/features/rbac";
import { usePermissions } from "@/hooks/usePermissions";

export const PermissionGuard = createPermissionGuard({
  usePermissions,
  useAuth,
  useRouter,
});
```

**When to use**: Components that:

- Need complex initialization
- Are used in many places
- Have circular dependencies

## Testing Strategy

### Testing Shared Components

**Advantage**: Easy to test because dependencies are injected!

```typescript
// CustomerBilling.test.tsx
import { render, screen } from "@testing-library/react";
import CustomerBilling from "./CustomerBilling";

const mockApiClient = {
  get: jest.fn().mockResolvedValue({
    data: { invoices: [] },
  }),
};

const mockUseToast = () => ({
  toast: jest.fn(),
});

test("renders customer billing", async () => {
  render(
    <CustomerBilling
      customerId="123"
      apiClient={mockApiClient}
      useToast={mockUseToast}
      invoiceViewUrlPrefix="/invoices"
    />
  );

  expect(screen.getByText("Loading...")).toBeInTheDocument();
  // ... more assertions
});
```

### Testing App Wrappers

```typescript
// CustomerBilling.wrapper.test.tsx
import { render } from "@testing-library/react";
import { CustomerBilling } from "./CustomerBilling";

// Mock the shared component
jest.mock("@dotmac/features/billing", () => ({
  CustomerBilling: jest.fn(() => <div>Mocked</div>),
}));

test("passes correct dependencies to shared component", () => {
  render(<CustomerBilling customerId="123" />);

  expect(SharedCustomerBilling).toHaveBeenCalledWith(
    expect.objectContaining({
      customerId: "123",
      apiClient: expect.any(Object),
      useToast: expect.any(Function),
      invoiceViewUrlPrefix: "/dashboard/billing/invoices",
    }),
    expect.anything()
  );
});
```

## Best Practices

### Do's ✅

1. **Always inject external dependencies**

   ```typescript
   // ✅ GOOD
   function Component({ apiClient, useToast }: Props) {}
   ```

2. **Define minimal interfaces**

   ```typescript
   // ✅ GOOD - only what's needed
   export interface ComponentApiClient {
     get: <T>(url: string) => Promise<{ data: T }>;
   }
   ```

3. **Export types with components**

   ```typescript
   // ✅ GOOD
   export { default as Component } from "./Component";
   export type { ComponentProps, DataType } from "./Component";
   ```

4. **Keep wrappers thin**

   ```typescript
   // ✅ GOOD - wrapper is just 5-10 lines
   export function Component({ id }: WrapperProps) {
     return <SharedComponent id={id} apiClient={apiClient} />;
   }
   ```

5. **Document injected dependencies**
   ```typescript
   // ✅ GOOD
   /**
    * @param apiClient - HTTP client for making API requests
    * @param useToast - Hook for displaying toast notifications
    */
   export interface ComponentProps {
     apiClient: ComponentApiClient;
     useToast: () => { toast: (options: any) => void };
   }
   ```

### Don'ts ❌

1. **Don't import app-specific code in shared components**

   ```typescript
   // ❌ BAD
   import { apiClient } from "@/lib/api/client";
   ```

2. **Don't use process.env in shared components**

   ```typescript
   // ❌ BAD
   const url = process.env.NEXT_PUBLIC_API_URL;

   // ✅ GOOD - inject as prop
   function Component({ apiUrl }: Props) {}
   ```

3. **Don't create overly complex interfaces**

   ```typescript
   // ❌ BAD - too complex
   export interface ComponentApiClient extends AxiosInstance {
     // 20 methods...
   }

   // ✅ GOOD - minimal
   export interface ComponentApiClient {
     get: <T>(url: string) => Promise<{ data: T }>;
   }
   ```

4. **Don't skip type exports**

   ```typescript
   // ❌ BAD
   export { default as Component } from "./Component";
   // Types not exported!

   // ✅ GOOD
   export { default as Component } from "./Component";
   export type { ComponentProps } from "./Component";
   ```

5. **Don't put business logic in wrappers**

   ```typescript
   // ❌ BAD - wrapper has too much logic
   export function Component({ id }: Props) {
     const [data, setData] = useState();
     useEffect(() => { /* complex logic */ }, []);
     return <SharedComponent data={data} />;
   }

   // ✅ GOOD - wrapper is thin, logic in shared component
   export function Component({ id }: Props) {
     return <SharedComponent id={id} apiClient={apiClient} />;
   }
   ```

## Troubleshooting

### Problem: Type conflicts

**Symptom**: `Type 'User' is not assignable to type 'User'`

**Solution**: Use component-specific type names or namespaces

```typescript
// Instead of
export interface User {}

// Use
export interface CustomerListUser {}
// or
export namespace CustomerList {
  export interface User {}
}
```

### Problem: Circular dependencies

**Symptom**: Import errors or undefined exports

**Solution**: Use factory pattern or move shared types to a types-only file

```typescript
// types.ts
export interface User {}

// ComponentA.tsx
import type { User } from "./types";

// ComponentB.tsx
import type { User } from "./types";
```

### Problem: Wrapper getting too complex

**Symptom**: Wrapper has 50+ lines, lots of logic

**Solution**: Move logic to shared component or create a custom hook

```typescript
// Instead of complex wrapper
export function Component({ id }: Props) {
  // 50 lines of logic...
  return <SharedComponent {...props} />;
}

// Create a hook
export function useComponentData(id: string) {
  // Logic here
}

// Inject hook
<SharedComponent id={id} useData={useComponentData} />
```

## Summary

The Dependency Injection pattern enables:

1. **Code Reuse**: Share components across multiple apps
2. **Testability**: Easy to mock dependencies
3. **Flexibility**: Apps control their own implementations
4. **Isolation**: Shared components have no app-specific dependencies
5. **Maintainability**: Changes to one app don't affect others

**Key Principle**: "Depend on abstractions, not concretions"

The shared component depends on the `apiClient` interface, not a specific API client implementation. This allows each app to provide its own implementation while sharing the same UI logic.
