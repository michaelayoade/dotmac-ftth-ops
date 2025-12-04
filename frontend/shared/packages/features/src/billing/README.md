# Billing Module

Comprehensive billing and payment management components for DotMac platform.

## Overview

The billing module provides a complete set of components for managing customer billing, invoices, payments, and credit notes. All components follow the dependency injection pattern for cross-app compatibility.

## Components

### CustomerBilling

**Purpose**: Complete billing overview for a customer

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

- Billing summary metrics (total revenue, outstanding, overdue, last payment)
- Invoice list with status badges
- Payment history table
- Download invoice PDFs
- View invoice details in new tab

**Dependencies**: apiClient, useToast, invoiceViewUrlPrefix

**Usage**:

```typescript
import { CustomerBilling } from "@/components/customers/CustomerBilling";

<CustomerBilling customerId="cust_123" />
```

---

### InvoiceList

**Purpose**: Tabular display of invoices

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
- Status badges
- Quick actions (view, download)
- Responsive design
- Empty state handling

**Dependencies**: None (data passed as props)

**Usage**:

```typescript
import { InvoiceList } from "@dotmac/features/billing";
import { useInvoices } from "@/hooks/useInvoices";

function InvoicesPage() {
  const { invoices, loading } = useInvoices();

  return (
    <InvoiceList
      invoices={invoices}
      loading={loading}
      onInvoiceSelect={(invoice) => setSelectedInvoice(invoice)}
    />
  );
}
```

---

### InvoiceDetailModal

**Purpose**: Detailed invoice view

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

- Invoice header (number, dates, status)
- Line items table with descriptions and amounts
- Subtotal, tax, and total breakdown
- Payment history for invoice
- Download PDF action
- Email invoice action

**Dependencies**: apiClient, useToast

---

### ReceiptList

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
- Status badges
- Amount formatting
- Date sorting
- Associated invoice link

**Dependencies**: None (data passed as props)

---

### ReceiptDetailModal

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
- Payment method details
- Associated invoice
- Transaction ID
- Download PDF

**Dependencies**: apiClient, useToast

---

### AddPaymentMethodModal

**Purpose**: Add credit card or bank account

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

- Credit card entry (Stripe Elements)
- Bank account (ACH) setup
- Set as default payment method
- Secure tokenization
- Validation (Luhn algorithm for cards)

**Dependencies**: apiClient, useToast

---

### RecordPaymentModal

**Purpose**: Manually record payments

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

- Payment method selection (cash, check, wire, etc.)
- Amount entry with validation
- Invoice association (optional)
- Reference number
- Payment date picker
- Notes field

**Dependencies**: apiClient, useToast

---

### CreateCreditNoteModal

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
- Reason selection
- Item-level credit selection
- Auto-refund to original payment method
- Notes field

**Dependencies**: apiClient, useToast

---

### InvoiceStatusBadge

**Purpose**: Visual status indicator

**Props**:

```typescript
interface InvoiceStatusBadgeProps {
  status: "paid" | "pending" | "overdue" | "cancelled";
}
```

**Features**:

- Color-coded badges
- Icon indicators
- Accessible labels

**Dependencies**: None

**Usage**:

```typescript
import { InvoiceStatusBadge } from "@dotmac/features/billing";

<InvoiceStatusBadge status="paid" />
```

---

### PaymentStatusBadge

**Purpose**: Visual payment status indicator

**Props**:

```typescript
interface PaymentStatusBadgeProps {
  status: "succeeded" | "failed" | "pending";
}
```

**Features**:

- Color-coded badges
- Status labels

**Dependencies**: None

---

### SkeletonLoaders

**Purpose**: Loading states for billing components

**Exports**:

- `InvoiceListSkeleton`
- `ReceiptListSkeleton`
- `BillingSummarySkeleton`

**Usage**:

```typescript
import { InvoiceListSkeleton } from "@dotmac/features/billing";

{loading ? <InvoiceListSkeleton /> : <InvoiceList invoices={invoices} />}
```

## Types

### Invoice

```typescript
interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  status: "paid" | "pending" | "overdue" | "cancelled";
  due_date: string;
  paid_date?: string;
  created_at: string;
}
```

### Payment

```typescript
interface Payment {
  id: string;
  payment_method: string;
  amount: number;
  status: "succeeded" | "failed" | "pending";
  created_at: string;
  invoice_id?: string;
}
```

### Receipt

```typescript
interface Receipt {
  id: string;
  receipt_number: string;
  amount: number;
  payment_method: string;
  status: "succeeded" | "failed" | "pending";
  created_at: string;
  invoice_id?: string;
}
```

### BillingSummary

```typescript
interface BillingSummary {
  total_revenue: number;
  outstanding_balance: number;
  overdue_amount: number;
  last_payment_date?: string;
  last_payment_amount?: number;
  payment_method?: string;
}
```

### PaymentMethod

```typescript
interface PaymentMethod {
  id: string;
  type: "card" | "bank_account";
  last4: string;
  brand?: string; // For cards
  is_default: boolean;
}
```

### CreditNote

```typescript
interface CreditNote {
  id: string;
  credit_note_number: string;
  amount: number;
  reason: string;
  created_at: string;
  invoice_id: string;
}
```

## API Client Interfaces

All billing components that make API calls require an `apiClient` prop. The interface is minimal:

```typescript
interface BillingApiClient {
  get: <T = any>(url: string, config?: any) => Promise<{ data: T }>;
  post?: <T = any>(url: string, data?: any, config?: any) => Promise<{ data: T }>;
  put?: <T = any>(url: string, data?: any, config?: any) => Promise<{ data: T }>;
}
```

Each component defines its own interface (e.g., `CustomerBillingApiClient`) to keep dependencies minimal.

## Common Patterns

### Pattern 1: Fetch and Display

For components that fetch their own data:

```typescript
// Create wrapper
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

// Use in page
<CustomerBilling customerId="cust_123" />
```

### Pattern 2: Pass Data

For display-only components:

```typescript
// Fetch data in page
const { invoices, loading } = useInvoices();

// Pass to component
<InvoiceList
  invoices={invoices}
  loading={loading}
  onInvoiceSelect={(invoice) => setSelected(invoice)}
/>
```

### Pattern 3: Modal Workflow

For modals that perform actions:

```typescript
// State management
const [showPaymentModal, setShowPaymentModal] = useState(false);

// Modal component
<RecordPaymentModal
  open={showPaymentModal}
  customerId={customerId}
  invoiceId={selectedInvoiceId}
  onClose={() => setShowPaymentModal(false)}
  onPaymentRecorded={() => {
    setShowPaymentModal(false);
    refetchInvoices();
  }}
/>

// Trigger
<Button onClick={() => setShowPaymentModal(true)}>
  Record Payment
</Button>
```

## API Endpoints

The billing module expects these backend endpoints:

### Customer Billing

- `GET /api/isp/v1/admin/customers/{id}/invoices` - List invoices
- `GET /api/isp/v1/admin/customers/{id}/payments` - List payments
- `GET /api/isp/v1/admin/customers/{id}/billing-summary` - Get summary

### Invoices

- `GET /api/isp/v1/admin/invoices` - List all invoices
- `GET /api/isp/v1/admin/invoices/{id}` - Get invoice details
- `GET /api/isp/v1/admin/invoices/{id}/download` - Download PDF
- `POST /api/isp/v1/admin/invoices/{id}/email` - Email invoice

### Payments

- `GET /api/isp/v1/admin/payments` - List all payments
- `GET /api/isp/v1/admin/payments/{id}` - Get payment details
- `POST /api/isp/v1/admin/payments` - Record payment

### Payment Methods

- `GET /api/isp/v1/admin/customers/{id}/payment-methods` - List payment methods
- `POST /api/isp/v1/admin/customers/{id}/payment-methods` - Add payment method
- `DELETE /api/isp/v1/admin/customers/{id}/payment-methods/{id}` - Remove payment method

### Receipts

- `GET /api/isp/v1/admin/receipts` - List receipts
- `GET /api/isp/v1/admin/receipts/{id}` - Get receipt details
- `GET /api/isp/v1/admin/receipts/{id}/download` - Download PDF

### Credit Notes

- `POST /api/isp/v1/admin/invoices/{id}/credit-notes` - Create credit note

## Styling

All components use `@dotmac/ui` components for consistent styling:

- Cards: `Card`, `CardHeader`, `CardContent`
- Tables: `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell`
- Badges: `Badge`
- Buttons: `Button`
- Modals: `Dialog`, `DialogContent`, `DialogHeader`

Components are styled with Tailwind classes and support dark mode via the `@dotmac/ui` theme system.

## Testing

### Unit Tests

Test shared components with mocked dependencies:

```typescript
import { render, screen } from "@testing-library/react";
import CustomerBilling from "./CustomerBilling";

const mockApiClient = {
  get: jest.fn().mockResolvedValue({
    data: { invoices: [], payments: [] },
  }),
};

const mockUseToast = () => ({ toast: jest.fn() });

test("renders customer billing", () => {
  render(
    <CustomerBilling
      customerId="123"
      apiClient={mockApiClient}
      useToast={mockUseToast}
      invoiceViewUrlPrefix="/invoices"
    />
  );

  expect(screen.getByText("Loading...")).toBeInTheDocument();
});
```

### Integration Tests

Test wrappers to ensure dependencies are wired correctly:

```typescript
import { render } from "@testing-library/react";
import { CustomerBilling } from "./CustomerBilling";

jest.mock("@dotmac/features/billing");
jest.mock("@/lib/api/client");

test("wrapper provides correct dependencies", () => {
  render(<CustomerBilling customerId="123" />);
  // Verify SharedCustomerBilling was called with correct props
});
```

## Troubleshooting

### Issue: API calls failing

**Check**:

1. API client is properly configured with auth
2. Base URL is correct
3. Endpoints match backend routes
4. Response format matches expected types

### Issue: Toast notifications not showing

**Check**:

1. `useToast` is properly imported from `@dotmac/ui`
2. Toast provider is set up in app layout
3. Toast function is being called with correct options

### Issue: Type errors

**Check**:

1. Types are imported: `import type { Invoice } from "@dotmac/features/billing"`
2. Data structure matches interface
3. Optional fields are handled with `?` or default values

## Related Modules

- **customers**: Customer management components that use billing data
- **crm**: CRM components that display revenue metrics
- **analytics**: Reporting components that aggregate billing data

## Contributing

When adding new billing components:

1. Follow the existing pattern (DI for API components)
2. Define minimal API client interface
3. Export component and types
4. Add to `components/index.ts`
5. Update this README
6. Add tests
7. Test in both apps (Platform Admin and ISP Ops)

## Examples

See the [QUICK_START.md](../../QUICK_START.md) guide for complete examples of using billing components.
