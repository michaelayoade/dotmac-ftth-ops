# Quick Start Guide

Get started with `@dotmac/features` in 5 minutes.

## Table of Contents

1. [Installation](#installation)
2. [First Component Usage](#first-component-usage)
3. [Creating a New Shared Component](#creating-a-new-shared-component)
4. [Testing Shared Components](#testing-shared-components)
5. [Common Pitfalls](#common-pitfalls)
6. [FAQ](#faq)

## Installation

The `@dotmac/features` package is already installed in your workspace.

**Verify Installation**:

```bash
# From workspace root
cd frontend
pnpm install

# Package should be linked via workspace protocol
```

**Check package.json** in your app:

```json
{
  "dependencies": {
    "@dotmac/features": "workspace:*",
    "@dotmac/ui": "workspace:*"
  }
}
```

## First Component Usage

### Scenario: Display Customer Billing

**Step 1: Check if component needs DI**

Look at [COMPONENTS.md](./COMPONENTS.md) - `CustomerBilling` has "DI Required: Yes"

**Step 2: Create app wrapper**

```typescript
// apps/isp-ops-app/components/customers/CustomerBilling.tsx
"use client";

import { CustomerBilling as SharedCustomerBilling } from "@dotmac/features/billing";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@dotmac/ui";

interface Props {
  customerId: string;
}

export function CustomerBilling({ customerId }: Props) {
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

**Step 3: Use in your page**

```typescript
// apps/isp-ops-app/app/dashboard/customers/[id]/page.tsx
import { CustomerBilling } from "@/components/customers/CustomerBilling";

export default function CustomerPage({ params }: { params: { id: string } }) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Customer Details</h1>
      <CustomerBilling customerId={params.id} />
    </div>
  );
}
```

**Done!** The component will fetch and display billing data.

---

### Scenario: Display Customer Metrics

**Step 1: Check if component needs DI**

`CustomersMetrics` has "DI Required: No" - it only displays data!

**Step 2: Fetch data in your page**

```typescript
// apps/isp-ops-app/app/dashboard/page.tsx
"use client";

import { CustomersMetrics } from "@dotmac/features/crm";
import { useCustomerMetrics } from "@/hooks/useCustomerMetrics";

export default function DashboardPage() {
  const { metrics, loading } = useCustomerMetrics();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <CustomersMetrics metrics={metrics} loading={loading} />
    </div>
  );
}
```

**Done!** No wrapper needed for display-only components.

---

## Creating a New Shared Component

### Example: Create a "ServicePlans" component

**Goal**: Show a list of service plans that both apps can use.

**Step 1: Choose the module**

Since this is related to subscriptions, we'll put it in the `subscribers` module:

```
shared/packages/features/src/subscribers/components/ServicePlansList.tsx
```

**Step 2: Create the component**

```typescript
// src/subscribers/components/ServicePlansList.tsx
"use client";

import { useState, useEffect } from "react";
import { Card, Button, Badge } from "@dotmac/ui";

// ============================================================================
// Types
// ============================================================================

export interface ServicePlan {
  id: string;
  name: string;
  description: string;
  price: number;
  bandwidth_down: number;
  bandwidth_up: number;
  status: "active" | "inactive";
}

export interface ServicePlansListApiClient {
  get: <T = any>(url: string, config?: any) => Promise<{ data: T }>;
}

export interface ServicePlansListProps {
  apiClient: ServicePlansListApiClient;
  useToast: () => { toast: (options: any) => void };
  onPlanSelect?: (plan: ServicePlan) => void;
}

// ============================================================================
// Component
// ============================================================================

export default function ServicePlansList({
  apiClient,
  useToast,
  onPlanSelect,
}: ServicePlansListProps) {
  const { toast } = useToast();
  const [plans, setPlans] = useState<ServicePlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await apiClient.get<{ plans: ServicePlan[] }>(
          "/api/isp/v1/admin/service-plans"
        );
        setPlans(response.data.plans);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load service plans",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, [apiClient, toast]);

  if (loading) {
    return <div className="p-6 text-center">Loading plans...</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {plans.map((plan) => (
        <Card key={plan.id} className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-semibold">{plan.name}</h3>
            <Badge variant={plan.status === "active" ? "default" : "secondary"}>
              {plan.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span>Download:</span>
              <span className="font-medium">{plan.bandwidth_down} Mbps</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Upload:</span>
              <span className="font-medium">{plan.bandwidth_up} Mbps</span>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span>Price:</span>
              <span>${plan.price}/mo</span>
            </div>
          </div>
          {onPlanSelect && (
            <Button onClick={() => onPlanSelect(plan)} className="w-full">
              Select Plan
            </Button>
          )}
        </Card>
      ))}
    </div>
  );
}
```

**Step 3: Export from module**

```typescript
// src/subscribers/components/index.ts
export * from "./SubscriberDetailModal";
export { AddSubscriberModal } from "./AddSubscriberModal";
export type { AddSubscriberModalProps, CreateSubscriberRequest } from "./AddSubscriberModal";

// Add new component
export { default as ServicePlansList } from "./ServicePlansList";
export type {
  ServicePlansListProps,
  ServicePlan,
  ServicePlansListApiClient,
} from "./ServicePlansList";
```

**Step 4: Verify module index exports it**

```typescript
// src/subscribers/index.ts
export * from "./components";
```

**Step 5: Create wrapper in your app**

```typescript
// apps/isp-ops-app/components/subscribers/ServicePlansList.tsx
"use client";

import { ServicePlansList as SharedServicePlansList } from "@dotmac/features/subscribers";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@dotmac/ui";
import { useRouter } from "next/navigation";

interface Props {
  onPlanSelect?: (planId: string) => void;
}

export function ServicePlansList({ onPlanSelect }: Props) {
  const router = useRouter();

  const handlePlanSelect = (plan: any) => {
    if (onPlanSelect) {
      onPlanSelect(plan.id);
    } else {
      router.push(`/dashboard/plans/${plan.id}`);
    }
  };

  return (
    <SharedServicePlansList
      apiClient={apiClient}
      useToast={useToast}
      onPlanSelect={handlePlanSelect}
    />
  );
}
```

**Step 6: Use in your page**

```typescript
// apps/isp-ops-app/app/dashboard/plans/page.tsx
import { ServicePlansList } from "@/components/subscribers/ServicePlansList";

export default function PlansPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Service Plans</h1>
      <ServicePlansList />
    </div>
  );
}
```

**Step 7: Do the same for platform-admin-app**

Create the wrapper with platform-admin-specific URLs:

```typescript
// apps/platform-admin-app/components/subscribers/ServicePlansList.tsx
"use client";

import { ServicePlansList as SharedServicePlansList } from "@dotmac/features/subscribers";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@dotmac/ui";
import { useRouter } from "next/navigation";

interface Props {
  onPlanSelect?: (planId: string) => void;
}

export function ServicePlansList({ onPlanSelect }: Props) {
  const router = useRouter();

  const handlePlanSelect = (plan: any) => {
    if (onPlanSelect) {
      onPlanSelect(plan.id);
    } else {
      router.push(`/admin/plans/${plan.id}`); // Different URL!
    }
  };

  return (
    <SharedServicePlansList
      apiClient={apiClient}
      useToast={useToast}
      onPlanSelect={handlePlanSelect}
    />
  );
}
```

**Done!** You've created a shared component that works in both apps.

---

## Testing Shared Components

### Unit Testing

**Test the shared component** with mocked dependencies:

```typescript
// src/subscribers/components/ServicePlansList.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import ServicePlansList from "./ServicePlansList";

const mockApiClient = {
  get: jest.fn(),
};

const mockUseToast = () => ({
  toast: jest.fn(),
});

describe("ServicePlansList", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders loading state initially", () => {
    mockApiClient.get.mockReturnValue(new Promise(() => {})); // Never resolves

    render(
      <ServicePlansList
        apiClient={mockApiClient}
        useToast={mockUseToast}
      />
    );

    expect(screen.getByText("Loading plans...")).toBeInTheDocument();
  });

  it("renders plans after loading", async () => {
    mockApiClient.get.mockResolvedValue({
      data: {
        plans: [
          {
            id: "1",
            name: "Basic Plan",
            description: "Entry level",
            price: 29.99,
            bandwidth_down: 50,
            bandwidth_up: 10,
            status: "active",
          },
        ],
      },
    });

    render(
      <ServicePlansList
        apiClient={mockApiClient}
        useToast={mockUseToast}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Basic Plan")).toBeInTheDocument();
    });

    expect(screen.getByText("$29.99/mo")).toBeInTheDocument();
  });

  it("shows error toast on API failure", async () => {
    const mockToast = jest.fn();
    const mockUseToastWithSpy = () => ({ toast: mockToast });

    mockApiClient.get.mockRejectedValue(new Error("API Error"));

    render(
      <ServicePlansList
        apiClient={mockApiClient}
        useToast={mockUseToastWithSpy}
      />
    );

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "Error",
        description: "Failed to load service plans",
        variant: "destructive",
      });
    });
  });

  it("calls onPlanSelect when plan is clicked", async () => {
    const mockOnPlanSelect = jest.fn();

    mockApiClient.get.mockResolvedValue({
      data: {
        plans: [
          {
            id: "1",
            name: "Basic Plan",
            description: "Entry level",
            price: 29.99,
            bandwidth_down: 50,
            bandwidth_up: 10,
            status: "active",
          },
        ],
      },
    });

    render(
      <ServicePlansList
        apiClient={mockApiClient}
        useToast={mockUseToast}
        onPlanSelect={mockOnPlanSelect}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Basic Plan")).toBeInTheDocument();
    });

    const selectButton = screen.getByText("Select Plan");
    selectButton.click();

    expect(mockOnPlanSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "1", name: "Basic Plan" })
    );
  });
});
```

### Integration Testing (in app)

**Test the wrapper** to ensure dependencies are wired correctly:

```typescript
// apps/isp-ops-app/components/subscribers/ServicePlansList.test.tsx
import { render } from "@testing-library/react";
import { ServicePlansList } from "./ServicePlansList";

// Mock the shared component
jest.mock("@dotmac/features/subscribers", () => ({
  ServicePlansList: jest.fn(() => <div>Mocked ServicePlansList</div>),
}));

// Mock dependencies
jest.mock("@/lib/api/client", () => ({
  apiClient: { get: jest.fn() },
}));

jest.mock("@dotmac/ui", () => ({
  useToast: jest.fn(() => ({ toast: jest.fn() })),
}));

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({ push: jest.fn() })),
}));

import { ServicePlansList as SharedServicePlansList } from "@dotmac/features/subscribers";

describe("ServicePlansList Wrapper", () => {
  it("passes correct dependencies to shared component", () => {
    render(<ServicePlansList />);

    expect(SharedServicePlansList).toHaveBeenCalledWith(
      expect.objectContaining({
        apiClient: expect.any(Object),
        useToast: expect.any(Function),
        onPlanSelect: expect.any(Function),
      }),
      expect.anything()
    );
  });
});
```

### Storybook Stories

**Create stories** for visual testing:

```typescript
// src/subscribers/components/ServicePlansList.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import ServicePlansList from "./ServicePlansList";

const meta: Meta<typeof ServicePlansList> = {
  title: "Subscribers/ServicePlansList",
  component: ServicePlansList,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof ServicePlansList>;

const mockApiClient = {
  get: async () => ({
    data: {
      plans: [
        {
          id: "1",
          name: "Basic Plan",
          description: "Perfect for light usage",
          price: 29.99,
          bandwidth_down: 50,
          bandwidth_up: 10,
          status: "active",
        },
        {
          id: "2",
          name: "Standard Plan",
          description: "For regular households",
          price: 49.99,
          bandwidth_down: 100,
          bandwidth_up: 20,
          status: "active",
        },
        {
          id: "3",
          name: "Premium Plan",
          description: "Maximum speed",
          price: 79.99,
          bandwidth_down: 500,
          bandwidth_up: 100,
          status: "active",
        },
      ],
    },
  }),
};

const mockUseToast = () => ({
  toast: (options: any) => console.log("Toast:", options),
});

export const Default: Story = {
  args: {
    apiClient: mockApiClient,
    useToast: mockUseToast,
  },
};

export const WithSelection: Story = {
  args: {
    apiClient: mockApiClient,
    useToast: mockUseToast,
    onPlanSelect: (plan) => console.log("Selected:", plan),
  },
};

export const Loading: Story = {
  args: {
    apiClient: {
      get: () => new Promise(() => {}), // Never resolves
    },
    useToast: mockUseToast,
  },
};

export const Error: Story = {
  args: {
    apiClient: {
      get: () => Promise.reject(new Error("API Error")),
    },
    useToast: mockUseToast,
  },
};
```

---

## Common Pitfalls

### Pitfall 1: Importing app-specific code in shared components

**Wrong:**

```typescript
// ❌ BAD - shared component importing from app
import { apiClient } from "@/lib/api/client";

export default function MyComponent() {
  // Can't share this across apps!
}
```

**Right:**

```typescript
// ✅ GOOD - inject as prop
export interface MyComponentProps {
  apiClient: MyComponentApiClient;
}

export default function MyComponent({ apiClient }: MyComponentProps) {
  // Works in any app!
}
```

---

### Pitfall 2: Not exporting types

**Wrong:**

```typescript
// ❌ BAD - types not exported
export { default as MyComponent } from "./MyComponent";
```

**Right:**

```typescript
// ✅ GOOD - export both component and types
export { default as MyComponent } from "./MyComponent";
export type { MyComponentProps, MyDataType } from "./MyComponent";
```

---

### Pitfall 3: Overly complex wrapper

**Wrong:**

```typescript
// ❌ BAD - wrapper has too much logic
export function MyComponent({ id }: Props) {
  const [data, setData] = useState();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 50 lines of data fetching logic
  }, []);

  // More complex logic

  return <SharedMyComponent data={data} />;
}
```

**Right:**

```typescript
// ✅ GOOD - wrapper is thin, logic in shared component or hook
export function MyComponent({ id }: Props) {
  return (
    <SharedMyComponent
      id={id}
      apiClient={apiClient}
      useToast={useToast}
    />
  );
}
```

---

### Pitfall 4: Using process.env in shared components

**Wrong:**

```typescript
// ❌ BAD - environment variables in shared component
export default function MyComponent() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  // ...
}
```

**Right:**

```typescript
// ✅ GOOD - inject as prop
export interface MyComponentProps {
  apiUrl: string;
}

export default function MyComponent({ apiUrl }: MyComponentProps) {
  // ...
}

// Wrapper provides env var
<SharedMyComponent apiUrl={process.env.NEXT_PUBLIC_API_URL!} />
```

---

### Pitfall 5: Not following module structure

**Wrong:**

```typescript
// ❌ BAD - wrong location
shared / packages / features / src / MyComponent.tsx;
```

**Right:**

```typescript
// ✅ GOOD - proper module structure
shared / packages / features / src / [module] / components / MyComponent.tsx;
shared / packages / features / src / [module] / components / index.ts;
shared / packages / features / src / [module] / index.ts;
```

---

## FAQ

### Q: Which module should I put my component in?

**A**: Choose based on functional area:

- Customer data/CRUD → `customers`
- Billing/payments → `billing`
- CRM/sales → `crm`
- Network equipment → `network` or `cpe`
- AAA/sessions → `radius`
- Access control → `rbac`
- Monitoring → `monitoring`
- Create new module if none fit

### Q: Do I always need to use dependency injection?

**A**: No. Only if your component:

- Makes API calls
- Shows notifications (toasts)
- Navigates to other pages
- Logs events
- Uses environment variables

Display-only components can skip DI.

### Q: Can I use React Query in shared components?

**A**: Yes! Either:

1. Use it directly if both apps use React Query
2. Inject a custom hook that wraps React Query

Example:

```typescript
export interface MyComponentProps {
  useData: () => {
    data: DataType[];
    loading: boolean;
    error: Error | null;
  };
}
```

### Q: How do I handle app-specific styling?

**A**: Use props:

```typescript
export interface MyComponentProps {
  className?: string;
  variant?: "compact" | "full";
}

// Wrapper
<SharedMyComponent className="custom-app-styles" variant="compact" />
```

### Q: Can I use Next.js-specific features?

**A**: Only via injection:

- `useRouter` → Inject router object
- `Image` component → Use HTML `<img>` or inject Image component
- `Link` → Inject navigation function

### Q: How do I update documentation?

**A**: When adding/modifying components:

1. Update [COMPONENTS.md](./COMPONENTS.md)
2. Update module README if exists
3. Update [ARCHITECTURE.md](./ARCHITECTURE.md) if adding a module
4. Add JSDoc comments to component

### Q: Should I create a new module?

**A**: Create a new module if:

- You have 3+ related components
- It's a distinct functional area
- It doesn't fit existing modules

Steps:

1. Create `src/new-module/components/`
2. Create `src/new-module/components/index.ts`
3. Create `src/new-module/index.ts`
4. Add to `src/index.ts`
5. Add to `package.json` exports
6. Create `src/new-module/README.md`

## Next Steps

1. **Explore Components**: Browse [COMPONENTS.md](./COMPONENTS.md) for available components
2. **Learn DI Pattern**: Read [DEPENDENCY_INJECTION.md](./DEPENDENCY_INJECTION.md)
3. **Understand Architecture**: Read [ARCHITECTURE.md](./ARCHITECTURE.md)
4. **Check Examples**: Look at existing components in `src/`

## Getting Help

- **Documentation Issues**: Check this guide and related docs
- **Component Not Working**: Verify dependencies are injected correctly
- **Type Errors**: Ensure types are exported from module
- **Import Errors**: Check `package.json` exports and module structure
- **Need New Feature**: Follow "Creating a New Shared Component" section

## Cheat Sheet

```bash
# Import component with DI
import { Component } from "@dotmac/features/module";
# Create wrapper in apps/[app]/components/[module]/Component.tsx
# Inject dependencies (apiClient, useToast, etc.)

# Import display-only component
import { Component } from "@dotmac/features/module";
# Use directly, pass data as props

# Create new shared component
# 1. src/[module]/components/NewComponent.tsx
# 2. Export from src/[module]/components/index.ts
# 3. Use DI pattern if needed
# 4. Create wrappers in both apps
# 5. Test in both apps

# Run type check
pnpm --filter @dotmac/features type-check

# Run tests
pnpm --filter @dotmac/features test
```

Happy coding! 🚀
