# @dotmac/features - Architecture Documentation

## Table of Contents

1. [Overview](#overview)
2. [Package Structure](#package-structure)
3. [Module Catalog](#module-catalog)
4. [Component Organization](#component-organization)
5. [Dependency Injection Pattern](#dependency-injection-pattern)
6. [Type Safety](#type-safety)
7. [Export Strategy](#export-strategy)
8. [Usage Examples](#usage-examples)
9. [Statistics](#statistics)

## Overview

The `@dotmac/features` package is a centralized repository of shared UI components and business logic for the DotMac FTTH Operations Platform. It provides reusable feature components that are shared across multiple applications in the platform:

- **Platform Admin App**: Multi-tenant management portal
- **ISP Ops App**: ISP operations and network management

### Benefits

1. **Code Reusability**: Eliminates duplication of complex components across applications
2. **Consistency**: Ensures uniform UI/UX patterns across all portals
3. **Maintainability**: Single source of truth for shared features
4. **Type Safety**: Comprehensive TypeScript types ensure compile-time safety
5. **Dependency Injection**: Flexible architecture supporting multi-deployment scenarios
6. **Efficiency**: Reduced bundle size and faster development cycles

### Impact

- **27,704 lines of code** in the shared package
- **21,393 lines eliminated** from duplication across apps
- **43.6% code reduction** in feature components
- **108 TypeScript files** organized into 21 modules
- **50+ shared components** covering major platform features

## Package Structure

```
@dotmac/features/
├── src/
│   ├── analytics/           # Reporting and analytics components
│   ├── api-keys/           # API key management
│   ├── billing/            # Billing, invoicing, payments
│   ├── campaigns/          # Marketing campaigns
│   ├── cpe/                # CPE/GenieACS device management
│   ├── crm/                # CRM features (leads, quotes, metrics)
│   ├── customers/          # Customer management
│   ├── diagnostics/        # Network diagnostics dashboard
│   ├── error-handling/     # Error boundaries and handling
│   ├── faults/             # Fault/alarm management
│   ├── forms/              # Shared form components
│   ├── ipam/               # IP address management
│   ├── monitoring/         # Network monitoring dashboards
│   ├── network/            # ONU/OLT management (VOLTHA)
│   ├── notifications/      # Communication templates
│   ├── provisioning/       # Subscriber provisioning
│   ├── radius/             # RADIUS/bandwidth management
│   ├── rbac/               # Role-based access control
│   ├── remediation/        # Network remediation
│   ├── subscribers/        # Subscriber management
│   └── utils/              # Shared utilities
├── package.json
├── tsconfig.json
├── ARCHITECTURE.md         # This file
├── DEPENDENCY_INJECTION.md # DI pattern guide
├── COMPONENTS.md           # Component catalog
└── QUICK_START.md          # Getting started guide
```

## Module Catalog

### 1. Analytics Module (`@dotmac/features/analytics`)

**Purpose**: Business intelligence and custom reporting

**Components**:

- `CustomReportBuilder` - Build custom reports with filters and aggregations
- `ReportingDashboard` - View and manage reports

**Use Cases**: Revenue analysis, customer insights, operational metrics

---

### 2. API Keys Module (`@dotmac/features/api-keys`)

**Purpose**: API key lifecycle management

**Components**:

- `CreateApiKeyModal` - Create and configure API keys with permissions

**Use Cases**: Developer portal, external integrations, webhook management

---

### 3. Billing Module (`@dotmac/features/billing`)

**Purpose**: Comprehensive billing and payment management

**Components**:

- `CustomerBilling` - Complete billing overview with invoices and payments
- `InvoiceList` - Tabular invoice display with filtering
- `InvoiceDetailModal` - Detailed invoice view with line items
- `InvoiceStatusBadge` - Visual invoice status indicators
- `ReceiptList` - Payment receipts table
- `ReceiptDetailModal` - Detailed receipt view
- `AddPaymentMethodModal` - Add credit cards, bank accounts
- `RecordPaymentModal` - Manual payment recording
- `CreateCreditNoteModal` - Issue refunds and credits
- `PaymentStatusBadge` - Payment status indicators
- `SkeletonLoaders` - Loading states for billing components

**Types**:

```typescript
(Invoice, Payment, BillingSummary, PaymentMethod, CreditNote);
```

**Use Cases**: Customer billing portal, payment processing, revenue operations

---

### 4. Campaigns Module (`@dotmac/features/campaigns`)

**Purpose**: Marketing campaign management

**Components**:

- `CampaignControlDialog` - Start, pause, resume campaigns

**Use Cases**: Email campaigns, promotional activities, customer communications

---

### 5. CPE Module (`@dotmac/features/cpe`)

**Purpose**: Customer Premises Equipment management via GenieACS (TR-069/CWMP)

**Components**:

- `DeviceManagement` - Device discovery, provisioning, configuration
- `CPEConfigTemplates` - Mass configuration templates

**Types**:

```typescript
(DeviceInfo,
  DeviceResponse,
  WiFiConfig,
  LANConfig,
  WANConfig,
  MassConfigRequest,
  MassConfigJob,
  ConfigTemplate);
```

**Use Cases**: ONT/Router management, WiFi provisioning, firmware updates

---

### 6. CRM Module (`@dotmac/features/crm`)

**Purpose**: Customer relationship management

**Components**:

- `CustomersMetrics` - Customer KPIs and distribution charts
- `CustomerSubscriptions` - Subscription overview and management
- `CustomerActivities` - Activity timeline
- `CustomerViewModal` - Comprehensive customer details
- `CreateLeadModal` - Lead capture form
- `LeadDetailModal` - Lead details and conversion
- `CreateQuoteModal` - Generate sales quotes
- `QuoteDetailModal` - Quote review and approval
- `CompleteSurveyModal` - Site survey completion
- `Badges` - Status badges for CRM entities

**Types**:

```typescript
(CustomerMetrics, Subscription, Lead, Quote, Survey, Activity);
```

**Use Cases**: Sales pipeline, lead management, customer analytics

---

### 7. Customers Module (`@dotmac/features/customers`)

**Purpose**: Core customer management

**Components**:

- `CustomersList` - Searchable, filterable customer table
- `CreateCustomerModal` - New customer onboarding
- `CustomerDetailModal` - Comprehensive customer view
- `CustomerEditModal` - Update customer information
- `CustomerNotes` - Notes and communication history
- `CustomerNetwork` - Network service details

**Use Cases**: Customer onboarding, account management, support

---

### 8. Diagnostics Module (`@dotmac/features/diagnostics`)

**Purpose**: Network diagnostics and troubleshooting

**Components**:

- `DiagnosticsDashboard` - Ping, traceroute, speed tests, port scanning

**Use Cases**: Network troubleshooting, service verification, support escalation

---

### 9. Error Handling Module (`@dotmac/features/error-handling`)

**Purpose**: Application error boundaries

**Components**:

- `ErrorBoundary` - React error boundary with fallback UI

**Use Cases**: Graceful error handling, error reporting

---

### 10. Faults Module (`@dotmac/features/faults`)

**Purpose**: Fault and alarm management

**Components**:

- `AlarmDetailModal` - Alarm details, assignment, resolution

**Use Cases**: Network operations center, SLA tracking, incident management

---

### 11. Forms Module (`@dotmac/features/forms`)

**Purpose**: Reusable form components

**Components**:

- `AddressAutocomplete` - Google Places address autocomplete

**Use Cases**: Customer registration, service provisioning

---

### 12. IPAM Module (`@dotmac/features/ipam`)

**Purpose**: IP address management

**Components**:

- `IPAddressList` - IP pool management and assignment

**Use Cases**: Static IP allocation, IPv4/IPv6 management

---

### 13. Monitoring Module (`@dotmac/features/monitoring`)

**Purpose**: Real-time network monitoring

**Components**:

- `NetworkMonitoringDashboard` - Network-wide metrics and alerts
- `DualStackMetricsDashboard` - IPv4/IPv6 monitoring

**Use Cases**: NOC dashboard, capacity planning, performance monitoring

---

### 14. Network Module (`@dotmac/features/network`)

**Purpose**: VOLTHA-based PON network management

**Components**:

- `ONUListView` - ONU inventory and status
- `ONUDetailView` - Detailed ONU information and controls
- `OLTManagement` - OLT configuration and monitoring

**Types**:

```typescript
(VOLTHATypes.ONU, VOLTHATypes.OLT, VOLTHATypes.Port);
```

**Use Cases**: PON network operations, ONU provisioning, troubleshooting

---

### 15. Notifications Module (`@dotmac/features/notifications`)

**Purpose**: Communication template management

**Components**:

- `NotificationCenter` - Notification inbox
- `CommunicationDetailModal` - View sent communications
- `PreviewTemplateModal` - Preview email/SMS templates

**Use Cases**: Customer communications, email campaigns, alerts

---

### 16. Provisioning Module (`@dotmac/features/provisioning`)

**Purpose**: Subscriber service provisioning

**Components**:

- `SubscriberProvisionForm` - Complete provisioning workflow

**Use Cases**: New subscriber activation, service changes

---

### 17. RADIUS Module (`@dotmac/features/radius`)

**Purpose**: RADIUS/AAA management

**Components**:

- `RadiusSessionMonitor` - Active session monitoring
- `BandwidthProfileDialog` - Create/edit bandwidth profiles
- `NASDeviceDialog` - Manage NAS devices

**Use Cases**: Session management, bandwidth control, AAA operations

---

### 18. RBAC Module (`@dotmac/features/rbac`)

**Purpose**: Role-based access control

**Components**:

- `CreateRoleModal` - Define roles with permissions
- `RoleDetailsModal` - View role details
- `AssignRoleModal` - Assign roles to users
- `createPermissionGuard` - Higher-order component for permission checks

**Types**:

```typescript
(Role, Permission, PermissionCategory, PermissionAction);
```

**Use Cases**: User management, access control, multi-tenant security

---

### 19. Remediation Module (`@dotmac/features/remediation`)

**Purpose**: Automated network remediation

**Components**: (To be documented based on implementation)

**Use Cases**: Self-healing networks, automated troubleshooting

---

### 20. Subscribers Module (`@dotmac/features/subscribers`)

**Purpose**: Subscriber lifecycle management

**Components**:

- `AddSubscriberModal` - New subscriber creation
- `SubscriberDetailModal` - Comprehensive subscriber view

**Use Cases**: Subscriber onboarding, service management, support

---

### 21. Utils Module (`@dotmac/features/utils`)

**Purpose**: Shared utility functions

**Exports**: Common helpers, formatters, validators

## Component Organization

### Directory Structure

Each module follows a consistent structure:

```
module-name/
├── components/
│   ├── ComponentA.tsx       # Component implementation
│   ├── ComponentB.tsx
│   └── index.ts             # Component exports
├── types/
│   ├── module.types.ts      # TypeScript types
│   └── index.ts             # Type exports
├── utils/
│   ├── helpers.ts           # Module-specific utilities
│   └── index.ts             # Utility exports
└── index.ts                 # Module barrel export
```

### Naming Conventions

1. **Components**: PascalCase (e.g., `CustomerBilling`)
2. **Props Interfaces**: ComponentName + Props (e.g., `CustomerBillingProps`)
3. **API Client Interfaces**: ComponentName + ApiClient (e.g., `CustomerBillingApiClient`)
4. **Types**: PascalCase for interfaces/types (e.g., `Invoice`, `Payment`)
5. **Utils**: camelCase for functions (e.g., `formatCurrency`)

### File Organization

- **Single Responsibility**: Each component file contains one primary component
- **Colocation**: Component-specific types and helpers are in the same file
- **Barrel Exports**: Each module uses index.ts for clean exports
- **Type Exports**: Always export types alongside components

## Dependency Injection Pattern

The package uses **Pattern 2: Wrapper Component with Dependency Injection** to support multiple deployment architectures.

### Why Dependency Injection?

The DotMac platform has a unique multi-deployment architecture:

```
Backend (Python FastAPI)
    ├── Platform Admin App (Next.js)
    │   └── Uses /api/isp/v1/admin/* endpoints
    └── ISP Ops App (Next.js)
        └── Uses /api/isp/v1/admin/* endpoints with different auth
```

Each app needs:

- Different API clients (different auth tokens, error handling)
- Different toast notification implementations
- Different routing configurations
- Different logging strategies

### How It Works

**Step 1: Shared Component (in @dotmac/features)**

```typescript
// src/billing/components/CustomerBilling.tsx
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

  // Component implementation uses injected dependencies
  const fetchData = async () => {
    const response = await apiClient.get(`/api/isp/v1/admin/customers/${customerId}/invoices`);
    // ...
  };
}
```

**Step 2: App Wrapper (in isp-ops-app or platform-admin-app)**

```typescript
// apps/isp-ops-app/components/customers/CustomerBilling.tsx
import { CustomerBilling as CustomerBillingComponent } from "@dotmac/features/billing";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@dotmac/ui";

interface CustomerBillingWrapperProps {
  customerId: string;
}

export function CustomerBilling({ customerId }: CustomerBillingWrapperProps) {
  return (
    <CustomerBillingComponent
      customerId={customerId}
      apiClient={apiClient}
      useToast={useToast}
      invoiceViewUrlPrefix="/dashboard/billing/invoices"
    />
  );
}
```

### Benefits

1. **Testability**: Easy to mock dependencies in tests
2. **Flexibility**: Apps can provide custom implementations
3. **Isolation**: Shared components have no direct dependencies on app-specific code
4. **Reusability**: Same component works across different architectures

For more details, see [DEPENDENCY_INJECTION.md](./DEPENDENCY_INJECTION.md).

## Type Safety

### TypeScript Configuration

The package uses strict TypeScript settings:

```json
{
  "compilerOptions": {
    "strict": true,
    "noEmit": true,
    "declaration": true,
    "declarationMap": true,
    "isolatedModules": true
  }
}
```

### Type Export Strategy

All types are co-exported with components:

```typescript
// Export component and types together
export { default as CustomerBilling } from "./CustomerBilling";
export type { CustomerBillingProps, Invoice, Payment } from "./CustomerBilling";
```

### Optional Properties

**Important**: The main workspace uses `exactOptionalPropertyTypes: true`, but this package does not. This means:

1. Shared components use `property?: Type` for optional props
2. Apps with exactOptionalPropertyTypes handle undefined explicitly
3. Type interfaces are compatible across both modes

### Avoiding Type Conflicts

When types might conflict between modules, use namespaced exports:

```typescript
// network/index.ts
export * as VOLTHATypes from "./types/voltha";

// Usage in apps
import { VOLTHATypes } from "@dotmac/features/network";
const onu: VOLTHATypes.ONU = { ... };
```

## Export Strategy

### Module Exports

Each module has a barrel export (index.ts):

```typescript
// src/billing/index.ts
export * from "./components";
export * from "./types";
export * from "./utils";
```

### Package Exports

The package.json defines granular exports:

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./billing": "./src/billing/index.ts",
    "./crm": "./src/crm/index.ts",
    "./network": "./src/network/index.ts"
    // ... other modules
  }
}
```

### Import Styles

**Recommended**: Module-specific imports for better tree-shaking

```typescript
// Good - only imports billing module
import { CustomerBilling, InvoiceList } from "@dotmac/features/billing";

// Also acceptable - imports from root
import { CustomerBilling, InvoiceList } from "@dotmac/features";

// Avoid - imports everything
import * as Features from "@dotmac/features";
```

## Usage Examples

### Example 1: Using a Billing Component

**In Platform Admin App:**

```typescript
// apps/platform-admin-app/app/customers/[id]/page.tsx
import { CustomerBilling } from "@/components/customers/CustomerBilling";

export default function CustomerPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <h1>Customer Details</h1>
      <CustomerBilling customerId={params.id} />
    </div>
  );
}
```

**Wrapper Component:**

```typescript
// apps/platform-admin-app/components/customers/CustomerBilling.tsx
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

### Example 2: Using CRM Components

```typescript
// apps/isp-ops-app/app/dashboard/page.tsx
import { CustomersMetrics } from "@/components/crm/CustomersMetrics";
import { useCustomerMetrics } from "@/hooks/useCustomerMetrics";

export default function Dashboard() {
  const { metrics, loading } = useCustomerMetrics();

  return (
    <div>
      <h1>Dashboard</h1>
      <CustomersMetrics metrics={metrics} loading={loading} />
    </div>
  );
}
```

### Example 3: Using Network Components

```typescript
// apps/isp-ops-app/app/network/onus/page.tsx
import { ONUListView } from "@/components/network/ONUListView";

export default function ONUsPage() {
  return (
    <div>
      <h1>ONU Management</h1>
      <ONUListView />
    </div>
  );
}
```

### Example 4: Using RBAC Components

```typescript
// apps/platform-admin-app/app/settings/roles/page.tsx
import { CreateRoleModal } from "@/components/rbac/CreateRoleModal";
import { useState } from "react";

export default function RolesPage() {
  const [showModal, setShowModal] = useState(false);

  return (
    <div>
      <Button onClick={() => setShowModal(true)}>Create Role</Button>
      <CreateRoleModal
        open={showModal}
        onClose={() => setShowModal(false)}
      />
    </div>
  );
}
```

## Statistics

### Code Metrics

- **Total Files**: 108 TypeScript files (.ts/.tsx)
- **Total Lines of Code**: 27,704 lines
- **Code Reduction**: 21,393 lines eliminated from duplication
- **Efficiency Gain**: 43.6% reduction in feature code across apps
- **Total Modules**: 21 feature modules
- **Total Components**: 50+ shared components

### Module Breakdown

| Module        | Components | LOC    | Primary Use Case              |
| ------------- | ---------- | ------ | ----------------------------- |
| Billing       | 11         | 3,500+ | Payment processing, invoicing |
| CRM           | 9          | 2,800+ | Lead management, analytics    |
| Customers     | 6          | 2,400+ | Customer lifecycle            |
| Network       | 3          | 2,200+ | PON network operations        |
| CPE           | 2          | 1,800+ | Device management             |
| Notifications | 3          | 1,500+ | Communications                |
| RADIUS        | 3          | 1,400+ | AAA operations                |
| RBAC          | 4          | 1,200+ | Access control                |
| Subscribers   | 2          | 1,100+ | Subscriber management         |
| Diagnostics   | 1          | 900+   | Network diagnostics           |
| Analytics     | 2          | 800+   | Business intelligence         |
| Monitoring    | 2          | 700+   | Real-time monitoring          |
| Others        | 10+        | 6,600+ | Various features              |

### Dependency Summary

**Runtime Dependencies**:

- `@dotmac/ui`: Shared UI component library
- `@tanstack/react-query`: Data fetching (v5.56.2)
- `lucide-react`: Icon library
- `react`, `react-dom`: UI framework

**Peer Dependencies**:

- `react ^18.3.1`
- `react-dom ^18.3.1`

### Bundle Impact

- **Modular Exports**: Tree-shaking friendly
- **No Runtime**: Pure UI components, no backend logic
- **Type-Only**: Types don't add to bundle size
- **Lazy Loading**: Components can be dynamically imported

## Related Documentation

- [DEPENDENCY_INJECTION.md](./DEPENDENCY_INJECTION.md) - Deep dive into DI pattern
- [COMPONENTS.md](./COMPONENTS.md) - Complete component catalog
- [QUICK_START.md](./QUICK_START.md) - Getting started guide
- [Module READMEs](./src/) - Module-specific documentation

## Contributing

When adding new components to this package:

1. Follow the established directory structure
2. Use the dependency injection pattern for external dependencies
3. Export both components and types
4. Add comprehensive JSDoc comments
5. Update module README.md
6. Update this architecture document
7. Test in both Platform Admin and ISP Ops apps

## Support

For questions or issues with shared features:

1. Check module-specific README files
2. Review QUICK_START.md for common patterns
3. Consult DEPENDENCY_INJECTION.md for DI questions
4. Review existing component implementations as examples
