# CRM Module

Customer Relationship Management components for lead management, sales pipeline, and customer analytics.

## Overview

The CRM module provides components for managing the sales pipeline, from lead capture through quote generation and customer conversion. It includes analytics components for tracking customer metrics and activities.

## Components

### CustomersMetrics

**Purpose**: Display customer KPIs and distribution analytics

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
  customers_by_type?: Record<string, number>;
  top_segments?: Array<{
    id?: number | string;
    name?: string;
    count?: number;
  }>;
}
```

**Features**:

- Primary metric cards (total, active, revenue, LTV)
- Churn rate tracking
- Customer status distribution
- Customer tier distribution
- Customer type distribution
- Top segments display
- Loading skeletons
- Responsive grid layout

**Dependencies**: None (display-only component)

**Usage**:

```typescript
import { CustomersMetrics } from "@dotmac/features/crm";
import { useCustomerMetrics } from "@/hooks/useCustomerMetrics";

function DashboardPage() {
  const { metrics, loading } = useCustomerMetrics();

  return <CustomersMetrics metrics={metrics} loading={loading} />;
}
```

---

### CustomerSubscriptions

**Purpose**: Display customer's active subscriptions

**Props**:

```typescript
interface CustomerSubscriptionsProps {
  subscriptions: Subscription[];
  loading: boolean;
}

interface Subscription {
  id: string;
  plan_name: string;
  status: "active" | "inactive" | "suspended";
  start_date: string;
  renewal_date?: string;
  amount: number;
}
```

**Features**:

- Subscription list
- Status badges
- Renewal dates
- Plan details
- Amount formatting
- Empty state

**Dependencies**: None (display-only)

---

### CustomerActivities

**Purpose**: Activity timeline for customer interactions

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
- Pagination
- Real-time updates

**Dependencies**: apiClient, useToast

**Usage**:

```typescript
import { CustomerActivities } from "@/components/crm/CustomerActivities";

<CustomerActivities customerId="cust_123" />
```

---

### CreateLeadModal

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

- Contact information form
- Source tracking (referral, web, cold call, etc.)
- Priority assignment (high, medium, low)
- Owner assignment
- Notes field
- Form validation

**Dependencies**: apiClient, useToast

**Workflow**:

1. User fills in lead information
2. Selects source and priority
3. Assigns to owner
4. Submits form
5. Lead created in backend
6. Callback triggered with new lead

---

### LeadDetailModal

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
- Status updates (new, contacted, qualified, lost)
- Convert to customer action
- Activity log
- Note taking
- Schedule follow-up
- Edit lead details

**Dependencies**: apiClient, useToast

**Workflow**:

1. View lead details
2. Update status as lead progresses
3. Add notes and activities
4. Convert to customer when qualified
5. Triggers customer creation

---

### CreateQuoteModal

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

- Line item builder with add/remove
- Product/service selection
- Quantity and unit price entry
- Discount application (% or fixed)
- Tax calculation
- Subtotal/total display
- Valid until date picker
- Terms and conditions editor
- Notes field

**Dependencies**: apiClient, useToast

**Workflow**:

1. Select customer or lead
2. Add line items (products/services)
3. Apply discounts if needed
4. Set expiration date
5. Add terms and conditions
6. Generate quote
7. Send to customer

---

### QuoteDetailModal

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

- Quote header (number, date, status, expiry)
- Line items table
- Pricing breakdown
- Status management (draft, sent, accepted, rejected)
- Approve/reject actions
- Convert to order
- Send to customer via email
- Download PDF
- Edit draft quotes

**Dependencies**: apiClient, useToast

---

### CompleteSurveyModal

**Purpose**: Complete site surveys for installations

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

- Dynamic form with multiple field types
- Photo upload for site pictures
- GPS coordinates capture
- Feasibility assessment (yes/no/conditional)
- Equipment requirements checklist
- Distance measurements
- Cost estimate entry
- Installation notes
- Technician signature

**Dependencies**: apiClient, useToast

**Workflow**:

1. Load survey template
2. Complete all fields
3. Upload site photos
4. Mark feasibility
5. Estimate costs
6. Submit survey
7. Triggers provisioning workflow if feasible

---

### CustomerViewModal

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

- Customer details section
- Active subscriptions list
- Billing summary
- Activity timeline
- Quick actions (edit, suspend, terminate)
- Notes section
- Network information

**Dependencies**: apiClient, useToast

---

### Badges

**Purpose**: Status and type badges for CRM entities

**Exports**:

```typescript
export function LeadStatusBadge({ status }: { status: string }): JSX.Element;
export function QuoteStatusBadge({ status }: { status: string }): JSX.Element;
export function SurveyStatusBadge({ status }: { status: string }): JSX.Element;
```

**Features**:

- Color-coded status badges
- Icon indicators
- Consistent styling

**Dependencies**: None

**Usage**:

```typescript
import { LeadStatusBadge, QuoteStatusBadge } from "@dotmac/features/crm";

<LeadStatusBadge status="qualified" />
<QuoteStatusBadge status="accepted" />
```

## Types

### Lead

```typescript
interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  source: "referral" | "web" | "cold_call" | "partner" | "other";
  priority: "high" | "medium" | "low";
  status: "new" | "contacted" | "qualified" | "lost";
  owner_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}
```

### Quote

```typescript
interface Quote {
  id: string;
  quote_number: string;
  customer_id?: string;
  lead_id?: string;
  status: "draft" | "sent" | "accepted" | "rejected" | "expired";
  valid_until: string;
  line_items: QuoteLineItem[];
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  terms?: string;
  notes?: string;
  created_at: string;
}

interface QuoteLineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}
```

### Survey

```typescript
interface Survey {
  id: string;
  lead_id: string;
  technician_id: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  feasibility: "yes" | "no" | "conditional";
  estimated_cost?: number;
  photos?: string[];
  gps_coordinates?: {
    latitude: number;
    longitude: number;
  };
  notes?: string;
  completed_at?: string;
}
```

### Activity

```typescript
interface Activity {
  id: string;
  customer_id: string;
  type: "note" | "email" | "call" | "meeting" | "status_change";
  description: string;
  user_id: string;
  user_name: string;
  created_at: string;
}
```

## API Endpoints

### Leads

- `GET /api/isp/v1/admin/leads` - List leads
- `POST /api/isp/v1/admin/leads` - Create lead
- `GET /api/isp/v1/admin/leads/{id}` - Get lead details
- `PUT /api/isp/v1/admin/leads/{id}` - Update lead
- `POST /api/isp/v1/admin/leads/{id}/convert` - Convert to customer

### Quotes

- `GET /api/isp/v1/admin/quotes` - List quotes
- `POST /api/isp/v1/admin/quotes` - Create quote
- `GET /api/isp/v1/admin/quotes/{id}` - Get quote details
- `PUT /api/isp/v1/admin/quotes/{id}` - Update quote
- `POST /api/isp/v1/admin/quotes/{id}/send` - Send to customer
- `POST /api/isp/v1/admin/quotes/{id}/accept` - Accept quote
- `POST /api/isp/v1/admin/quotes/{id}/reject` - Reject quote
- `GET /api/isp/v1/admin/quotes/{id}/download` - Download PDF

### Surveys

- `GET /api/isp/v1/admin/surveys` - List surveys
- `POST /api/isp/v1/admin/surveys` - Create survey
- `GET /api/isp/v1/admin/surveys/{id}` - Get survey details
- `PUT /api/isp/v1/admin/surveys/{id}` - Update survey
- `POST /api/isp/v1/admin/surveys/{id}/complete` - Complete survey

### Activities

- `GET /api/v1/customers/{id}/activities` - Get customer activities
- `POST /api/v1/customers/{id}/activities` - Add activity

### Metrics

- `GET /api/v1/metrics/customers` - Get customer metrics

## Common Workflows

### Lead to Customer Conversion

```typescript
// 1. Create lead
<CreateLeadModal
  open={showCreateLead}
  onClose={() => setShowCreateLead(false)}
  onLeadCreated={(lead) => {
    setShowCreateLead(false);
    // Open lead detail
    setSelectedLeadId(lead.id);
  }}
/>

// 2. Manage lead
<LeadDetailModal
  open={!!selectedLeadId}
  leadId={selectedLeadId}
  onClose={() => setSelectedLeadId(null)}
  onLeadConverted={(customerId) => {
    setSelectedLeadId(null);
    // Navigate to customer
    router.push(`/customers/${customerId}`);
  }}
/>
```

### Quote Generation

```typescript
// 1. Create quote
<CreateQuoteModal
  open={showCreateQuote}
  leadId={leadId}
  onClose={() => setShowCreateQuote(false)}
  onQuoteCreated={(quote) => {
    setShowCreateQuote(false);
    setSelectedQuoteId(quote.id);
  }}
/>

// 2. Manage quote
<QuoteDetailModal
  open={!!selectedQuoteId}
  quoteId={selectedQuoteId}
  onClose={() => setSelectedQuoteId(null)}
/>
```

### Site Survey

```typescript
<CompleteSurveyModal
  open={showSurvey}
  surveyId={surveyId}
  onClose={() => setShowSurvey(false)}
  onSurveyCompleted={() => {
    setShowSurvey(false);
    refetchSurveys();
    toast({
      title: "Success",
      description: "Survey completed successfully",
    });
  }}
/>
```

## Testing

### Testing Display Components

```typescript
import { render, screen } from "@testing-library/react";
import { CustomersMetrics } from "@dotmac/features/crm";

test("renders customer metrics", () => {
  const metrics = {
    total_customers: 100,
    active_customers: 85,
    new_customers_this_month: 10,
    total_revenue: 50000,
  };

  render(<CustomersMetrics metrics={metrics} loading={false} />);

  expect(screen.getByText("100")).toBeInTheDocument();
  expect(screen.getByText("$50,000")).toBeInTheDocument();
});
```

### Testing Interactive Components

```typescript
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CreateLeadModal from "./CreateLeadModal";

const mockApiClient = {
  post: jest.fn().mockResolvedValue({
    data: { id: "lead_123", name: "Test Lead" },
  }),
};

test("creates lead", async () => {
  const onLeadCreated = jest.fn();

  render(
    <CreateLeadModal
      open={true}
      onClose={() => {}}
      onLeadCreated={onLeadCreated}
      apiClient={mockApiClient}
      useToast={() => ({ toast: jest.fn() })}
    />
  );

  fireEvent.change(screen.getByLabelText("First Name"), {
    target: { value: "John" },
  });

  fireEvent.click(screen.getByText("Create Lead"));

  await waitFor(() => {
    expect(mockApiClient.post).toHaveBeenCalledWith("/api/isp/v1/admin/leads", expect.any(Object));
    expect(onLeadCreated).toHaveBeenCalled();
  });
});
```

## Related Modules

- **customers**: Customer management after conversion
- **billing**: Billing and invoicing for converted customers
- **subscribers**: Service provisioning after customer creation

## Contributing

When adding new CRM components:

1. Consider the sales pipeline stage
2. Use consistent status values
3. Follow the DI pattern for API components
4. Include form validation
5. Handle loading and error states
6. Add activity logging for important actions
7. Test conversion workflows
