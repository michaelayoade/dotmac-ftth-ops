# InvoiceDetailModal Extraction - Complexity Analysis

**Component Size:** 623 lines × 2 apps = 1,246 lines
**Status:** Complex extraction requiring careful planning

## Complexity Factors

### Dependencies Identified:
1. **App-Specific Hooks:**
   - `useInvoiceActions` (send email, void, reminders, credit notes)
   - `useToast`

2. **App-Specific Utilities:**
   - `InvoicePDFGenerator` - PDF generation class
   - `apiClient` - for fetching company/customer info
   - `logger` - error logging

3. **Other Components:**
   - `RecordPaymentModal`
   - `CreateCreditNoteModal` (now shared)

4. **Local State:**
   - PDF processing state
   - Modal visibility states (payment, credit note)
   - Fetched data (company info, customer info)

5. **Business Logic:**
   - Overdue calculation
   - Days until due calculation
   - PDF generation with fallback data
   - Email/void/reminder actions

## Extraction Options

### Option A: Full Extraction (High Effort, High Value)
**Approach:** Extract entire component with comprehensive callback pattern
**Pros:** Maximum code reuse, single source of truth
**Cons:** Many props, complex refactoring, 2-3 hours effort
**Estimated Lines Saved:** ~1,100 lines

### Option B: Defer to Later (Current Recommendation)
**Approach:** Skip for now, do simpler extractions first
**Pros:** Faster wins, build expertise with simpler components
**Cons:** Leaves largest duplication untouched
**Estimated Lines Saved:** 0 lines now, tackle in Week 2

### Option C: Partial Extraction
**Approach:** Extract only the pure UI rendering sections
**Pros:** Some value, moderate effort
**Cons:** Less impactful, complex to determine boundaries
**Estimated Lines Saved:** ~400-500 lines

## Recommendation

Given that Week 1 goals are already exceeded (1,026 / 760 lines = 135%), I recommend:

**Defer InvoiceDetailModal to Week 2** when we can:
1. Allocate proper time (2-3 hours)
2. Create comprehensive callback interface
3. Properly test all action flows
4. Document the complex extraction pattern

**Immediate Alternative:**
Continue with smaller wins:
- Remaining formatCurrency migrations (4 files, ~60 lines)
- Remaining status color maps (13 files, ~200 lines)
- Simpler component extractions

This approach maintains momentum while being pragmatic about complexity.

## If Proceeding with Extraction

### Required Callback Props:
```typescript
interface InvoiceDetailModalProps {
  // Display
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;

  // Data
  companyInfo: CompanyInfo | null;
  customerInfo: CustomerInfo | null;

  // Actions (callbacks)
  onSendEmail: (invoice: Invoice) => Promise<void>;
  onVoid: (invoice: Invoice, reason: string) => Promise<void>;
  onSendReminder: (invoice: Invoice) => Promise<void>;
  onDownloadPDF: (invoice: Invoice, company: CompanyInfo, customerName: string) => Promise<void>;
  onRecordPayment?: (invoice: Invoice) => void;
  onUpdate?: () => void;

  // Loading states
  isProcessing: boolean;
  isActionLoading: boolean;
}
```

### App Wrapper Responsibilities:
- Fetch company info via API
- Fetch customer info via API
- Connect to `useInvoiceActions` hook
- Handle PDF generation
- Manage processing states
- Provide toast notifications

**Estimated Wrapper Size:** ~150 lines per app
**Estimated Shared Component:** ~450 lines
**Net Savings:** ~900 lines (1,246 - 300 - 46 for wrappers)

