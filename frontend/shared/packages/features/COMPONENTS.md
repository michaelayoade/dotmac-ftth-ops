# Component Catalog

Complete reference of all components in the `@dotmac/features` package.

## Table of Contents

1. [Overview](#overview)
2. [Component Summary Table](#component-summary-table)
3. [Components by Module](#components-by-module)
4. [Usage Patterns](#usage-patterns)

## Overview

This catalog provides a comprehensive reference of all 57 shared components in the `@dotmac/features` package, organized by functional module. Each component is documented with its purpose, props, dependencies, and usage examples.

**Quick Stats**:

- **Total Components**: 57
- **Total LOC**: 27,704
- **Modules**: 21
- **Apps Using**: Platform Admin App, ISP Ops App

## Component Summary Table

| Component                  | Module         | LOC | Purpose                      | DI Required | Apps Using     |
| -------------------------- | -------------- | --- | ---------------------------- | ----------- | -------------- |
| AddPaymentMethodModal      | billing        | 460 | Add credit card/bank account | ✅ Yes      | Both           |
| AddSubscriberModal         | subscribers    | 436 | Create new subscriber        | ✅ Yes      | Both           |
| AlarmDetailModal           | faults         | 732 | View/manage network alarms   | ✅ Yes      | ISP Ops        |
| AssignRoleModal            | rbac           | 392 | Assign roles to users        | ✅ Yes      | Platform Admin |
| AutomatedRemediationPanel  | remediation    | 418 | Automated network fixes      | ✅ Yes      | ISP Ops        |
| Badges                     | crm            | 157 | CRM status badges            | ❌ No       | Both           |
| BandwidthProfileDialog     | radius         | 381 | Create bandwidth profiles    | ✅ Yes      | ISP Ops        |
| CampaignControlDialog      | campaigns      | 237 | Start/pause campaigns        | ✅ Yes      | Both           |
| CompleteSurveyModal        | crm            | 671 | Complete site surveys        | ✅ Yes      | ISP Ops        |
| CPEConfigTemplates         | cpe            | 833 | Mass device configuration    | ✅ Yes      | ISP Ops        |
| CreateApiKeyModal          | api-keys       | 469 | Generate API keys            | ✅ Yes      | Platform Admin |
| CreateCreditNoteModal      | billing        | 232 | Issue refunds                | ✅ Yes      | Both           |
| CreateCustomerModal        | customers      | 604 | Onboard new customers        | ✅ Yes      | Both           |
| CreateLeadModal            | crm            | 533 | Capture new leads            | ✅ Yes      | ISP Ops        |
| CreateQuoteModal           | crm            | 859 | Generate sales quotes        | ✅ Yes      | ISP Ops        |
| CreateRoleModal            | rbac           | 420 | Create RBAC roles            | ✅ Yes      | Platform Admin |
| CustomReportBuilder        | analytics      | 410 | Build custom reports         | ✅ Yes      | Platform Admin |
| CustomerActivities         | crm            | 411 | Activity timeline            | ✅ Yes      | Both           |
| CustomerBilling            | billing        | 386 | Billing overview             | ✅ Yes      | Both           |
| CustomerDetailModal        | customers      | 524 | Customer details view        | ✅ Yes      | Both           |
| CustomerEditModal          | customers      | 480 | Edit customer info           | ✅ Yes      | Both           |
| CustomerNetwork            | customers      | 479 | Network service details      | ✅ Yes      | ISP Ops        |
| CustomerNotes              | customers      | 537 | Notes and history            | ✅ Yes      | Both           |
| CustomersList              | customers      | 727 | Customer table               | ✅ Yes      | Both           |
| CustomerSubscriptions      | crm            | 300 | Subscription overview        | ❌ No       | Both           |
| CustomersMetrics           | crm            | 287 | Customer KPIs                | ❌ No       | Both           |
| CustomerViewModal          | crm            | 317 | Comprehensive customer view  | ✅ Yes      | ISP Ops        |
| DeviceManagement           | cpe            | 462 | CPE device management        | ✅ Yes      | ISP Ops        |
| DiagnosticsDashboard       | diagnostics    | 412 | Network diagnostics          | ✅ Yes      | ISP Ops        |
| DualStackMetricsDashboard  | monitoring     | 550 | IPv4/IPv6 monitoring         | ✅ Yes      | ISP Ops        |
| ErrorBoundary              | error-handling | 295 | Error handling               | ❌ No       | Both           |
| InvoiceDetailModal         | billing        | 550 | Invoice details              | ✅ Yes      | Both           |
| InvoiceList                | billing        | 527 | Invoice table                | ✅ Yes      | Both           |
| InvoiceStatusBadge         | billing        | 25  | Invoice status badge         | ❌ No       | Both           |
| IPAddressList              | ipam           | 454 | IP address management        | ✅ Yes      | ISP Ops        |
| LeadDetailModal            | crm            | 845 | Lead details/conversion      | ✅ Yes      | ISP Ops        |
| NASDeviceDialog            | radius         | 392 | Manage NAS devices           | ✅ Yes      | ISP Ops        |
| NetworkMonitoringDashboard | monitoring     | 552 | Network metrics              | ✅ Yes      | ISP Ops        |
| NotificationCenter         | notifications  | 421 | Notification inbox           | ✅ Yes      | Both           |
| OLTManagement              | network        | 322 | OLT management               | ✅ Yes      | ISP Ops        |
| ONUDetailView              | network        | 385 | ONU details                  | ✅ Yes      | ISP Ops        |
| ONUListView                | network        | 447 | ONU inventory                | ✅ Yes      | ISP Ops        |
| PaymentStatusBadge         | billing        | 25  | Payment status badge         | ❌ No       | Both           |
| PermissionGuard            | rbac           | 407 | Permission checks            | ✅ Yes      | Both           |
| PreviewTemplateModal       | notifications  | 375 | Preview email templates      | ✅ Yes      | Both           |
| QuoteDetailModal           | crm            | 596 | Quote review                 | ✅ Yes      | ISP Ops        |
| RadiusSessionMonitor       | radius         | 283 | Active sessions              | ✅ Yes      | ISP Ops        |
| ReceiptDetailModal         | billing        | 254 | Receipt details              | ✅ Yes      | Both           |
| ReceiptList                | billing        | 543 | Receipt table                | ✅ Yes      | Both           |
| RecordPaymentModal         | billing        | 564 | Manual payment entry         | ✅ Yes      | Both           |
| ReportingDashboard         | analytics      | 446 | Report viewer                | ✅ Yes      | Platform Admin |
| RoleDetailsModal           | rbac           | 391 | View role details            | ✅ Yes      | Platform Admin |
| SkeletonLoaders            | billing        | 373 | Billing loading states       | ❌ No       | Both           |
| SubscriberDetailModal      | subscribers    | 570 | Subscriber details           | ✅ Yes      | Both           |
| SubscriberProvisionForm    | provisioning   | 390 | Provision subscribers        | ✅ Yes      | ISP Ops        |
| AddressAutocomplete        | forms          | 384 | Address autocomplete         | ✅ Yes      | Both           |
| CommunicationDetailModal   | notifications  | 487 | View communications          | ✅ Yes      | Both           |

## Components by Module

### Analytics Module

#### CustomReportBuilder

**Purpose**: Build custom reports with filters, grouping, and aggregations

**Props**:

```typescript
interface CustomReportBuilderProps {
  apiClient: CustomReportBuilderApiClient;
  useToast: () => { toast: (options: any) => void };
  onReportCreated?: (reportId: string) => void;
}
```

**Features**:

- Multiple data sources (customers, invoices, subscribers)
- Filter builder with AND/OR logic
- Column selection and ordering
- Aggregation functions (SUM, AVG, COUNT, etc.)
- Schedule recurring reports
- Export to CSV/PDF

**Dependencies**: apiClient, useToast

**Example**:

```typescript
import { CustomReportBuilder } from "@/components/analytics/CustomReportBuilder";

<CustomReportBuilder
  onReportCreated={(reportId) => router.push(`/reports/${reportId}`)}
/>
```

---

#### ReportingDashboard

**Purpose**: View, manage, and run saved reports

**Props**:

```typescript
interface ReportingDashboardProps {
  apiClient: ReportingDashboardApiClient;
  useToast: () => { toast: (options: any) => void };
}
```

**Features**:

- List all saved reports
- Run reports on-demand
- View report results
- Download exports
- Manage report schedules

**Dependencies**: apiClient, useToast

---

### API Keys Module

#### CreateApiKeyModal

**Purpose**: Generate API keys with scoped permissions

**Props**:

```typescript
interface CreateApiKeyModalProps {
  open: boolean;
  onClose: () => void;
  onKeyCreated?: (key: ApiKey) => void;
  apiClient: CreateApiKeyModalApiClient;
  useToast: () => { toast: (options: any) => void };
}
```

**Features**:

- Set key name and description
- Configure permissions (read, write, admin)
- Set expiration date
- IP whitelist/blacklist
- Copy key to clipboard (shown once)

**Dependencies**: apiClient, useToast

**Example**:

```typescript
import { CreateApiKeyModal } from "@/components/api-keys/CreateApiKeyModal";

<CreateApiKeyModal
  open={showModal}
  onClose={() => setShowModal(false)}
  onKeyCreated={(key) => {
    console.log("New key created:", key.id);
  }}
/>
```

---

### Billing Module

#### CustomerBilling

**Purpose**: Comprehensive billing overview for a customer

**Props**:

```typescript
interface CustomerBillingProps {
  customerId: string;
  apiClient: CustomerBillingApiClient;
  useToast: () => { toast: (options: any) => void };
  invoiceViewUrlPrefix: string;
}
```

**Features**:

- Billing summary metrics (revenue, outstanding, overdue)
- Invoice list with status
- Payment history
- Download invoice PDFs
- View invoice details

**Dependencies**: apiClient, useToast, invoiceViewUrlPrefix

**Example**:

```typescript
import { CustomerBilling } from "@/components/customers/CustomerBilling";

<CustomerBilling customerId="cust_123" />
```

---

#### InvoiceList

**Purpose**: Tabular display of invoices with filtering and sorting

**Props**:

```typescript
interface InvoiceListProps {
  invoices: Invoice[];
  loading: boolean;
  onInvoiceSelect?: (invoice: Invoice) => void;
  onInvoiceDownload?: (invoiceId: string) => void;
  onRefresh?: () => void;
}
```

**Features**:

- Sortable columns
- Status filtering
- Date range filtering
- Quick actions (view, download)
- Pagination

**Dependencies**: None (data passed as props)

---

#### InvoiceDetailModal

**Purpose**: Detailed invoice view with line items

**Props**:

```typescript
interface InvoiceDetailModalProps {
  open: boolean;
  invoiceId: string | null;
  onClose: () => void;
  apiClient: InvoiceDetailModalApiClient;
  useToast: () => { toast: (options: any) => void };
}
```

**Features**:

- Invoice header (number, date, status)
- Line items table
- Subtotal/tax/total breakdown
- Payment history
- Download PDF
- Email invoice

**Dependencies**: apiClient, useToast

---

#### AddPaymentMethodModal

**Purpose**: Add credit card or bank account for payments

**Props**:

```typescript
interface AddPaymentMethodModalProps {
  open: boolean;
  customerId: string;
  onClose: () => void;
  onPaymentMethodAdded?: (method: PaymentMethod) => void;
  apiClient: AddPaymentMethodModalApiClient;
  useToast: () => { toast: (options: any) => void };
}
```

**Features**:

- Credit card entry (Stripe integration)
- Bank account (ACH) setup
- Set as default payment method
- Secure tokenization
- Validation

**Dependencies**: apiClient, useToast

---

#### RecordPaymentModal

**Purpose**: Manually record payments (cash, check, wire transfer)

**Props**:

```typescript
interface RecordPaymentModalProps {
  open: boolean;
  onClose: () => void;
  invoiceId?: string;
  customerId: string;
  apiClient: RecordPaymentModalApiClient;
  useToast: () => { toast: (options: any) => void };
  onPaymentRecorded?: () => void;
}
```

**Features**:

- Payment method selection
- Amount entry
- Invoice association
- Reference number
- Payment date
- Notes

**Dependencies**: apiClient, useToast

---

#### CreateCreditNoteModal

**Purpose**: Issue refunds and credits

**Props**:

```typescript
interface CreateCreditNoteModalProps {
  open: boolean;
  invoiceId: string;
  onClose: () => void;
  apiClient: CreateCreditNoteModalApiClient;
  useToast: () => { toast: (options: any) => void };
  onCreditNoteCreated?: () => void;
}
```

**Features**:

- Partial or full refund
- Reason for credit
- Item-level credits
- Auto-refund to original payment method

**Dependencies**: apiClient, useToast

---

#### ReceiptList

**Purpose**: Display payment receipts

**Props**:

```typescript
interface ReceiptListProps {
  receipts: Receipt[];
  loading: boolean;
  onReceiptSelect?: (receipt: Receipt) => void;
  onRefresh?: () => void;
}
```

**Features**:

- Payment method display
- Status indicators
- Amount formatting
- Date sorting

**Dependencies**: None (data passed as props)

---

#### ReceiptDetailModal

**Purpose**: Detailed receipt view

**Props**:

```typescript
interface ReceiptDetailModalProps {
  open: boolean;
  receiptId: string | null;
  onClose: () => void;
  apiClient: ReceiptDetailModalApiClient;
  useToast: () => { toast: (options: any) => void };
}
```

**Features**:

- Receipt information
- Associated invoice
- Payment method
- Download PDF

**Dependencies**: apiClient, useToast

---

#### InvoiceStatusBadge

**Purpose**: Visual status indicator for invoices

**Props**:

```typescript
interface InvoiceStatusBadgeProps {
  status: "paid" | "pending" | "overdue" | "cancelled";
}
```

**Features**: Color-coded badges with icons

**Dependencies**: None

---

#### PaymentStatusBadge

**Purpose**: Visual status indicator for payments

**Props**:

```typescript
interface PaymentStatusBadgeProps {
  status: "succeeded" | "failed" | "pending";
}
```

**Features**: Color-coded badges

**Dependencies**: None

---

#### SkeletonLoaders

**Purpose**: Loading states for billing components

**Exports**: `InvoiceListSkeleton`, `ReceiptListSkeleton`, `BillingSummarySkeleton`

**Dependencies**: None

---

### CRM Module

#### CustomersMetrics

**Purpose**: Customer KPIs and analytics

**Props**:

```typescript
interface CustomersMetricsProps {
  metrics: CustomerMetrics | null;
  loading: boolean;
}

interface CustomerMetrics {
  total_customers: number;
  active_customers: number;
  new_customers_this_month: number;
  total_revenue: number;
  average_lifetime_value?: number;
  churn_rate?: number;
  customers_by_status?: Record<string, number>;
  customers_by_tier?: Record<string, number>;
}
```

**Features**:

- Metric cards (total, active, revenue, LTV)
- Distribution charts (status, tier, type)
- Top segments
- Trend indicators

**Dependencies**: None (data passed as props)

---

#### CustomerSubscriptions

**Purpose**: Display customer's active subscriptions

**Props**:

```typescript
interface CustomerSubscriptionsProps {
  subscriptions: Subscription[];
  loading: boolean;
}
```

**Features**:

- Subscription list
- Status badges
- Renewal dates
- Plan details

**Dependencies**: None (data passed as props)

---

#### CustomerActivities

**Purpose**: Activity timeline for customer

**Props**:

```typescript
interface CustomerActivitiesProps {
  customerId: string;
  apiClient: CustomerActivitiesApiClient;
  useToast: () => { toast: (options: any) => void };
}
```

**Features**:

- Chronological activity feed
- Activity type icons
- User attribution
- Timestamps

**Dependencies**: apiClient, useToast

---

#### CreateLeadModal

**Purpose**: Capture new sales leads

**Props**:

```typescript
interface CreateLeadModalProps {
  open: boolean;
  onClose: () => void;
  onLeadCreated?: (lead: Lead) => void;
  apiClient: CreateLeadModalApiClient;
  useToast: () => { toast: (options: any) => void };
}
```

**Features**:

- Lead information form
- Source tracking
- Priority assignment
- Owner assignment

**Dependencies**: apiClient, useToast

---

#### LeadDetailModal

**Purpose**: View and manage lead details

**Props**:

```typescript
interface LeadDetailModalProps {
  open: boolean;
  leadId: string | null;
  onClose: () => void;
  apiClient: LeadDetailModalApiClient;
  useToast: () => { toast: (options: any) => void };
  onLeadConverted?: (customerId: string) => void;
}
```

**Features**:

- Lead information display
- Status updates
- Convert to customer
- Activity log
- Note taking

**Dependencies**: apiClient, useToast

---

#### CreateQuoteModal

**Purpose**: Generate sales quotes

**Props**:

```typescript
interface CreateQuoteModalProps {
  open: boolean;
  leadId?: string;
  customerId?: string;
  onClose: () => void;
  onQuoteCreated?: (quote: Quote) => void;
  apiClient: CreateQuoteModalApiClient;
  useToast: () => { toast: (options: any) => void };
}
```

**Features**:

- Line item builder
- Discount application
- Tax calculation
- Valid until date
- Terms and conditions

**Dependencies**: apiClient, useToast

---

#### QuoteDetailModal

**Purpose**: View and manage quotes

**Props**:

```typescript
interface QuoteDetailModalProps {
  open: boolean;
  quoteId: string | null;
  onClose: () => void;
  apiClient: QuoteDetailModalApiClient;
  useToast: () => { toast: (options: any) => void };
}
```

**Features**:

- Quote details
- Approve/reject
- Convert to order
- Send to customer
- Download PDF

**Dependencies**: apiClient, useToast

---

#### CompleteSurveyModal

**Purpose**: Complete site surveys

**Props**:

```typescript
interface CompleteSurveyModalProps {
  open: boolean;
  surveyId: string;
  onClose: () => void;
  apiClient: CompleteSurveyModalApiClient;
  useToast: () => { toast: (options: any) => void };
  onSurveyCompleted?: () => void;
}
```

**Features**:

- Survey form with multiple field types
- Photo upload
- GPS coordinates
- Feasibility assessment
- Cost estimate

**Dependencies**: apiClient, useToast

---

#### CustomerViewModal

**Purpose**: Comprehensive customer overview

**Props**:

```typescript
interface CustomerViewModalProps {
  open: boolean;
  customerId: string | null;
  onClose: () => void;
  apiClient: CustomerViewModalApiClient;
  useToast: () => { toast: (options: any) => void };
}
```

**Features**:

- Customer details
- Subscriptions
- Billing summary
- Activity timeline
- Quick actions

**Dependencies**: apiClient, useToast

---

#### Badges

**Purpose**: Status and type badges for CRM entities

**Exports**: `LeadStatusBadge`, `QuoteStatusBadge`, `SurveyStatusBadge`

**Dependencies**: None

---

### Customers Module

#### CustomersList

**Purpose**: Searchable, filterable customer table

**Props**:

```typescript
interface CustomersListProps {
  apiClient: CustomersListApiClient;
  useToast: () => { toast: (options: any) => void };
  onCustomerSelect?: (customer: Customer) => void;
}
```

**Features**:

- Search by name/email
- Filter by status/tier
- Sortable columns
- Pagination
- Bulk actions

**Dependencies**: apiClient, useToast

---

#### CreateCustomerModal

**Purpose**: Onboard new customers

**Props**:

```typescript
interface CreateCustomerModalProps {
  open: boolean;
  onClose: () => void;
  onCustomerCreated?: (customer: Customer) => void;
  apiClient: CreateCustomerModalApiClient;
  useToast: () => { toast: (options: any) => void };
}
```

**Features**:

- Customer information form
- Address autocomplete
- Contact details
- Account type selection
- Custom fields

**Dependencies**: apiClient, useToast

---

#### CustomerDetailModal

**Purpose**: View customer details

**Props**:

```typescript
interface CustomerDetailModalProps {
  open: boolean;
  customerId: string | null;
  onClose: () => void;
  apiClient: CustomerDetailModalApiClient;
  useToast: () => { toast: (options: any) => void };
}
```

**Features**:

- Customer information
- Contact details
- Service address
- Account status
- Quick edit

**Dependencies**: apiClient, useToast

---

#### CustomerEditModal

**Purpose**: Edit customer information

**Props**:

```typescript
interface CustomerEditModalProps {
  open: boolean;
  customerId: string;
  onClose: () => void;
  onCustomerUpdated?: (customer: Customer) => void;
  apiClient: CustomerEditModalApiClient;
  useToast: () => { toast: (options: any) => void };
}
```

**Features**:

- Edit form with validation
- Update contact details
- Change account status
- Modify custom fields

**Dependencies**: apiClient, useToast

---

#### CustomerNotes

**Purpose**: Notes and communication history

**Props**:

```typescript
interface CustomerNotesProps {
  customerId: string;
  apiClient: CustomerNotesApiClient;
  useToast: () => { toast: (options: any) => void };
}
```

**Features**:

- Add new notes
- View note history
- Filter by type
- User attribution
- Timestamps

**Dependencies**: apiClient, useToast

---

#### CustomerNetwork

**Purpose**: Network service details for customer

**Props**:

```typescript
interface CustomerNetworkProps {
  customerId: string;
  apiClient: CustomerNetworkApiClient;
  useToast: () => { toast: (options: any) => void };
}
```

**Features**:

- Service plan details
- Bandwidth usage
- IP addresses
- Equipment list
- Network status

**Dependencies**: apiClient, useToast

---

### Network Module (VOLTHA)

#### ONUListView

**Purpose**: ONU inventory and status

**Props**:

```typescript
interface ONUListViewProps {
  apiClient: ONUListViewApiClient;
  useToast: () => { toast: (options: any) => void };
  onONUSelect?: (onu: VOLTHATypes.ONU) => void;
}
```

**Features**:

- ONU list with status
- Filter by OLT/PON
- Search by serial number
- Quick actions (reboot, delete)
- Real-time status updates

**Dependencies**: apiClient, useToast

---

#### ONUDetailView

**Purpose**: Detailed ONU information

**Props**:

```typescript
interface ONUDetailViewProps {
  onuId: string;
  apiClient: ONUDetailViewApiClient;
  useToast: () => { toast: (options: any) => void };
}
```

**Features**:

- ONU details
- Signal levels
- Port status
- OMCI diagnostics
- Configuration

**Dependencies**: apiClient, useToast

---

#### OLTManagement

**Purpose**: OLT configuration and monitoring

**Props**:

```typescript
interface OLTManagementProps {
  apiClient: OLTManagementApiClient;
  useToast: () => { toast: (options: any) => void };
}
```

**Features**:

- OLT list
- PON port status
- ONU count per PON
- Configuration
- Alarms

**Dependencies**: apiClient, useToast

---

### RADIUS Module

#### RadiusSessionMonitor

**Purpose**: Monitor active RADIUS sessions

**Props**:

```typescript
interface RadiusSessionMonitorProps {
  apiClient: RadiusSessionMonitorApiClient;
  useToast: () => { toast: (options: any) => void };
  refreshInterval?: number;
}
```

**Features**:

- Active sessions list
- Real-time updates
- Bandwidth usage
- Session duration
- Disconnect action

**Dependencies**: apiClient, useToast

---

#### BandwidthProfileDialog

**Purpose**: Create/edit bandwidth profiles

**Props**:

```typescript
interface BandwidthProfileDialogProps {
  open: boolean;
  profileId?: string;
  onClose: () => void;
  onProfileSaved?: (profile: BandwidthProfile) => void;
  apiClient: BandwidthProfileDialogApiClient;
  useToast: () => { toast: (options: any) => void };
}
```

**Features**:

- Upload/download limits
- Burst settings
- Priority/QoS
- Schedule-based profiles

**Dependencies**: apiClient, useToast

---

#### NASDeviceDialog

**Purpose**: Manage NAS devices

**Props**:

```typescript
interface NASDeviceDialogProps {
  open: boolean;
  deviceId?: string;
  onClose: () => void;
  onDeviceSaved?: (device: NASDevice) => void;
  apiClient: NASDeviceDialogApiClient;
  useToast: () => { toast: (options: any) => void };
}
```

**Features**:

- NAS configuration
- Shared secret
- IP address
- Ports
- CoA support

**Dependencies**: apiClient, useToast

---

### RBAC Module

#### CreateRoleModal

**Purpose**: Create RBAC roles with permissions

**Props**:

```typescript
interface CreateRoleModalProps {
  open: boolean;
  onClose: () => void;
  onRoleCreated?: (role: Role) => void;
  apiClient: CreateRoleModalApiClient;
  useToast: () => { toast: (options: any) => void };
}
```

**Features**:

- Role name and description
- Permission selection (hierarchical)
- Permission categories
- Role preview

**Dependencies**: apiClient, useToast

---

#### RoleDetailsModal

**Purpose**: View role details and permissions

**Props**:

```typescript
interface RoleDetailsModalProps {
  open: boolean;
  roleId: string | null;
  onClose: () => void;
  apiClient: RoleDetailsModalApiClient;
  useToast: () => { toast: (options: any) => void };
}
```

**Features**:

- Role information
- Permission list
- User count
- Edit role
- Delete role

**Dependencies**: apiClient, useToast

---

#### AssignRoleModal

**Purpose**: Assign roles to users

**Props**:

```typescript
interface AssignRoleModalProps {
  open: boolean;
  userId: string;
  onClose: () => void;
  onRolesAssigned?: () => void;
  apiClient: AssignRoleModalApiClient;
  useToast: () => { toast: (options: any) => void };
}
```

**Features**:

- User selection
- Role selection (multi-select)
- Tenant scope
- Expiration date

**Dependencies**: apiClient, useToast

---

#### PermissionGuard

**Purpose**: HOC for permission-based rendering

**Usage**:

```typescript
import { createPermissionGuard } from "@dotmac/features/rbac";

const PermissionGuard = createPermissionGuard({
  usePermissions,
  useAuth,
  fallback: <div>Access Denied</div>,
});

<PermissionGuard permission="customers:write">
  <Button>Create Customer</Button>
</PermissionGuard>
```

**Dependencies**: usePermissions hook, useAuth hook

---

### Other Modules

See [ARCHITECTURE.md](./ARCHITECTURE.md) for complete documentation of remaining modules:

- CPE (Device Management, Config Templates)
- Diagnostics (Diagnostics Dashboard)
- Monitoring (Network Monitoring, Dual Stack Metrics)
- Notifications (Notification Center, Templates)
- Provisioning (Subscriber Provision Form)
- Subscribers (Add/Detail Modals)
- Forms (Address Autocomplete)
- Error Handling (Error Boundary)
- Faults (Alarm Detail Modal)
- IPAM (IP Address List)
- Campaigns (Campaign Control)
- Remediation (Automated Remediation Panel)

## Usage Patterns

### Pattern 1: Direct Import (No DI)

For components that only display data:

```typescript
import { CustomersMetrics } from "@dotmac/features/crm";

<CustomersMetrics metrics={metrics} loading={loading} />
```

### Pattern 2: With Wrapper (DI)

For components with external dependencies:

```typescript
// Wrapper
import { CustomerBilling as SharedCustomerBilling } from "@dotmac/features/billing";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@dotmac/ui";

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

// Usage
import { CustomerBilling } from "@/components/customers/CustomerBilling";

<CustomerBilling customerId="cust_123" />
```

### Pattern 3: With Hooks

For components that need data fetching:

```typescript
import { InvoiceList } from "@dotmac/features/billing";
import { useInvoices } from "@/hooks/useInvoices";

function InvoicesPage() {
  const { invoices, loading, refetch } = useInvoices();

  return (
    <InvoiceList
      invoices={invoices}
      loading={loading}
      onRefresh={refetch}
      onInvoiceSelect={(invoice) => router.push(`/invoices/${invoice.id}`)}
    />
  );
}
```

### Pattern 4: Factory Pattern

For components needing initialization:

```typescript
import { createPermissionGuard } from "@dotmac/features/rbac";
import { usePermissions, useAuth } from "@/hooks";

export const PermissionGuard = createPermissionGuard({
  usePermissions,
  useAuth,
  fallback: <div>Access Denied</div>,
});

// Usage everywhere
<PermissionGuard permission="customers:write">
  <CreateCustomerButton />
</PermissionGuard>
```

## Finding Components

**By Feature**:

- Billing/Payments → `@dotmac/features/billing`
- Customer Management → `@dotmac/features/customers`
- CRM/Sales → `@dotmac/features/crm`
- Network Management → `@dotmac/features/network`
- RADIUS/AAA → `@dotmac/features/radius`
- Access Control → `@dotmac/features/rbac`

**By Import**:

```typescript
// Module-specific (recommended)
import { Component } from "@dotmac/features/module-name";

// Root import (also works)
import { Component } from "@dotmac/features";
```

## Contributing

When adding new components:

1. Place in appropriate module directory
2. Follow dependency injection pattern if needed
3. Export component and types
4. Update module's index.ts
5. Add documentation here
6. Add tests
7. Test in both apps

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Full architecture documentation
- [DEPENDENCY_INJECTION.md](./DEPENDENCY_INJECTION.md) - DI pattern guide
- [QUICK_START.md](./QUICK_START.md) - Getting started
- Module READMEs - Module-specific guides
