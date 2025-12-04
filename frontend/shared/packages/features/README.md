# @dotmac/features

Shared feature components, types, and utilities for DotMac platform applications.

## Purpose

This package contains business logic, components, and utilities that are shared between:

- Platform Admin App
- ISP Ops App

By centralizing these features, we:

- ✅ Eliminate code duplication (~77,000 lines)
- ✅ Ensure consistent behavior across apps
- ✅ Simplify maintenance (one fix applies to both apps)
- ✅ Enable easier testing

## Modules

### Billing

Shared billing components, types, and utilities.

**Types:**

```typescript
import {
  Invoice,
  InvoiceStatus,
  Payment,
  PaymentStatus,
  BillingMetrics,
} from "@dotmac/features/billing";
```

**Utilities:**

```typescript
import {
  formatCurrency,
  getInvoiceStatusColor,
  isInvoiceOverdue,
  calculateInvoiceTotals,
} from "@dotmac/features/billing";

// Format currency (amount in minor units)
formatCurrency(50000, "USD"); // "$500.00"

// Get status color classes
getInvoiceStatusColor(InvoiceStatus.PAID);
// "bg-green-500/10 text-green-600 dark:text-green-400"

// Check if overdue
isInvoiceOverdue(invoice); // true/false
```

**Components:**

```typescript
import { InvoiceStatusBadge } from "@dotmac/features/billing";

<InvoiceStatusBadge status={InvoiceStatus.PAID} />
```

## Usage

### In Platform Admin App

```typescript
// app/dashboard/billing-revenue/invoices/page.tsx
import { formatCurrency, InvoiceStatusBadge } from "@dotmac/features/billing";

export default function InvoicesPage() {
  return (
    <div>
      <InvoiceStatusBadge status={invoice.status} />
      <span>{formatCurrency(invoice.amount_due, invoice.currency)}</span>
    </div>
  );
}
```

### In ISP Ops App

```typescript
// Same imports, same usage - consistent across apps
import { formatCurrency, InvoiceStatusBadge } from "@dotmac/features/billing";
```

## Migration Strategy

### Phase 1: Foundation (COMPLETE)

- ✅ Create package structure
- ✅ Extract types
- ✅ Extract utilities
- ✅ Create example components

### Phase 2: Progressive Migration (In Progress)

Gradually migrate components from app-specific to shared:

1. **Start with simple components** (badges, status indicators)
2. **Move to display components** (cards, lists)
3. **Finish with complex components** (modals, forms)

**Example Migration:**

```typescript
// BEFORE - Duplicated in both apps
// apps/platform-admin-app/components/billing/InvoiceStatusBadge.tsx
// apps/isp-ops-app/components/billing/InvoiceStatusBadge.tsx

// AFTER - Shared
// shared/packages/features/src/billing/components/InvoiceStatusBadge.tsx

// Apps import from shared
import { InvoiceStatusBadge } from "@dotmac/features/billing";
```

### Phase 3: Complete Extraction (Future)

Target components to migrate:

- [ ] InvoiceList
- [ ] InvoiceDetailModal
- [ ] RecordPaymentModal
- [ ] ReceiptList
- [ ] CreateCreditNoteModal
- [ ] BillingDashboard

Estimated effort: 2-4 weeks

## Design Principles

### 1. App-Agnostic

Components should not depend on app-specific:

- API clients (pass as props or context)
- Routing (use callbacks for navigation)
- Auth (use props for user data)

**Good:**

```typescript
interface InvoiceListProps {
  invoices: Invoice[];
  onInvoiceClick: (invoice: Invoice) => void;
}
```

**Bad:**

```typescript
// ❌ App-specific dependency
import { apiClient } from "@/lib/api/client";
import { useRouter } from "next/navigation";
```

### 2. Composition over Configuration

Prefer composition patterns that allow apps to customize behavior.

**Good:**

```typescript
<InvoiceList
  invoices={invoices}
  onInvoiceClick={(invoice) => router.push(`/invoices/${invoice.id}`)}
  renderActions={(invoice) => <CustomActions invoice={invoice} />}
/>
```

### 3. Type Safety

All exports should be fully typed with TypeScript.

### 4. Minimal Dependencies

Only depend on:

- ✅ `@dotmac/ui` (shared component library)
- ✅ React
- ✅ TypeScript
- ❌ NOT app-specific packages

## Development

### Running Type Checks

```bash
cd frontend/shared/packages/features
pnpm type-check
```

### Linting

```bash
pnpm lint
```

## Testing

Components should be tested in isolation:

```typescript
import { render, screen } from "@testing-library/react";
import { InvoiceStatusBadge } from "../InvoiceStatusBadge";
import { InvoiceStatus } from "../../types";

describe("InvoiceStatusBadge", () => {
  it("renders paid status correctly", () => {
    render(<InvoiceStatusBadge status={InvoiceStatus.PAID} />);
    expect(screen.getByText("Paid")).toBeInTheDocument();
  });
});
```

## Future Modules

Planned feature modules to extract:

- [ ] **Analytics** - Shared analytics components and utilities
- [ ] **CRM** - Customer relationship management
- [ ] **Communications** - Email/SMS templates and sending
- [ ] **Ticketing** - Support ticket management
- [ ] **Workflows** - Automation workflows

## Contributing

When adding shared features:

1. **Check for duplication** - Is this code duplicated in both apps?
2. **Extract types first** - Start with type definitions
3. **Add utilities** - Pure functions are easiest to share
4. **Create components** - Make them app-agnostic
5. **Update apps** - Replace duplicated code with shared imports
6. **Test** - Verify in both apps

## Questions?

See main architecture documentation:

- `PHASE1_API_SEPARATION_COMPLETE.md`
- `PHASE2A_SHARED_FEATURES_STARTED.md`
- `APP_SEPARATION_ARCHITECTURE_REVIEW.md`
