# EnhancedDataTable Component

Production-ready table component with advanced features for enterprise applications.

## Features

✅ **Selection & Bulk Actions** - Multi-select rows with custom bulk operations
✅ **Advanced Filtering** - Text, select, date, and number filters
✅ **Export to CSV** - Export selected or all data
✅ **Search** - Global or column-specific search
✅ **Sorting** - Column sorting with visual indicators
✅ **Pagination** - Configurable page sizes
✅ **Column Visibility** - Show/hide columns
✅ **Loading States** - Built-in loading indicators
✅ **Row Actions** - Click handlers and inline actions
✅ **Custom Toolbar** - Add custom toolbar buttons
✅ **Type Safe** - Full TypeScript support

## Installation

The component is already available in your UI components:

```tsx
import { EnhancedDataTable } from "./EnhancedDataTable";
```

## Basic Usage

```tsx
import { EnhancedDataTable } from "./EnhancedDataTable";
import { ColumnDef } from "@tanstack/react-table";

interface Invoice {
  id: string;
  invoice_number: string;
  customer: string;
  amount: number;
  status: string;
}

const columns: ColumnDef<Invoice>[] = [
  {
    accessorKey: "invoice_number",
    header: "Invoice #",
  },
  {
    accessorKey: "customer",
    header: "Customer",
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => `$${row.getValue("amount")}`,
  },
  {
    accessorKey: "status",
    header: "Status",
  },
];

export function InvoiceList({ invoices }: { invoices: Invoice[] }) {
  return (
    <EnhancedDataTable
      data={invoices}
      columns={columns}
      searchColumn="invoice_number"
      searchPlaceholder="Search invoices..."
    />
  );
}
```

## Advanced Features

### 1. Bulk Actions

Add bulk operations for selected rows:

```tsx
import { Send, X, Download } from "lucide-react";

const bulkActions = [
  {
    label: "Send Invoices",
    icon: Send,
    action: async (invoices) => {
      await api.sendInvoices(invoices.map((i) => i.id));
    },
    disabled: (invoices) => invoices.some((i) => i.status === "void"),
  },
  {
    label: "Void Invoices",
    icon: X,
    variant: "destructive" as const,
    action: async (invoices) => {
      await api.voidInvoices(invoices.map((i) => i.id));
    },
    confirmMessage: "Are you sure you want to void these invoices?",
  },
  {
    label: "Download PDFs",
    icon: Download,
    action: async (invoices) => {
      await api.downloadInvoicePDFs(invoices.map((i) => i.id));
    },
  },
];

<EnhancedDataTable data={invoices} columns={columns} selectable bulkActions={bulkActions} />;
```

### 2. Advanced Filtering

Add filter bar with different field types:

```tsx
const filters = [
  {
    column: "status",
    label: "Status",
    type: "select" as const,
    options: [
      { label: "Draft", value: "draft" },
      { label: "Open", value: "open" },
      { label: "Paid", value: "paid" },
    ],
  },
  {
    column: "amount",
    label: "Amount",
    type: "number" as const,
  },
  {
    column: "created_at",
    label: "Created Date",
    type: "date" as const,
  },
];

<EnhancedDataTable data={invoices} columns={columns} filterable filters={filters} />;
```

### 3. Export Functionality

Enable CSV export with custom columns:

```tsx
<EnhancedDataTable
  data={invoices}
  columns={columns}
  exportable
  exportFilename="invoices"
  exportColumns={["invoice_number", "customer", "amount", "status"]}
/>
```

### 4. Custom Toolbar Actions

Add custom buttons to the toolbar:

```tsx
<EnhancedDataTable
  data={customers}
  columns={columns}
  toolbarActions={
    <>
      <Button onClick={handleAddCustomer}>Add Customer</Button>
      <Button variant="outline" onClick={handleImport}>
        Import
      </Button>
    </>
  }
/>
```

### 5. Row Click Handlers

Handle row clicks for navigation:

```tsx
<EnhancedDataTable
  data={invoices}
  columns={columns}
  onRowClick={(invoice) => {
    router.push(`/invoices/${invoice.id}`);
  }}
/>
```

## Complete Example

Here's a full-featured invoice list:

```tsx
"use client";

import { useState } from "react";
import { EnhancedDataTable, BulkAction } from "./EnhancedDataTable";
import { createSortableHeader } from "./data-table";
import { Badge } from "./badge";
import { Button } from "./button";
import { Send, X, Download } from "lucide-react";
import { useRouter } from "next/navigation";

interface Invoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  amount: number;
  status: "draft" | "open" | "paid" | "void" | "overdue";
  due_date: string;
}

const columns: ColumnDef<Invoice>[] = [
  {
    accessorKey: "invoice_number",
    header: createSortableHeader("Invoice #"),
    cell: ({ row }) => <div className="font-medium">{row.getValue("invoice_number")}</div>,
  },
  {
    accessorKey: "customer_name",
    header: createSortableHeader("Customer"),
  },
  {
    accessorKey: "amount",
    header: createSortableHeader("Amount"),
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("amount"));
      return <div className="font-medium">${amount.toFixed(2)}</div>;
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      const colors = {
        draft: "bg-gray-500",
        open: "bg-blue-500",
        paid: "bg-green-500",
        void: "bg-red-500",
        overdue: "bg-orange-500",
      };
      return <Badge className={colors[status]}>{status}</Badge>;
    },
  },
  {
    accessorKey: "due_date",
    header: createSortableHeader("Due Date"),
    cell: ({ row }) => new Date(row.getValue("due_date")).toLocaleDateString(),
  },
];

export function InvoiceListPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const bulkActions: BulkAction<Invoice>[] = [
    {
      label: "Send Invoices",
      icon: Send,
      action: async (selected) => {
        await sendInvoices(selected.map((i) => i.id));
        // Refresh data
      },
      disabled: (selected) => selected.some((i) => i.status === "void"),
    },
    {
      label: "Void Invoices",
      icon: X,
      variant: "destructive",
      action: async (selected) => {
        await voidInvoices(selected.map((i) => i.id));
      },
      confirmMessage: "Are you sure you want to void these invoices?",
    },
    {
      label: "Download PDFs",
      icon: Download,
      action: async (selected) => {
        await downloadPDFs(selected.map((i) => i.id));
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Invoices</h1>
        <Button onClick={() => router.push("/invoices/new")}>Create Invoice</Button>
      </div>

      <EnhancedDataTable
        data={invoices}
        columns={columns}
        searchColumn="invoice_number"
        searchPlaceholder="Search invoices..."
        isLoading={isLoading}
        selectable
        bulkActions={bulkActions}
        exportable
        exportFilename="invoices"
        exportColumns={["invoice_number", "customer_name", "amount", "status", "due_date"]}
        filterable
        filters={[
          {
            column: "status",
            label: "Status",
            type: "select",
            options: [
              { label: "Draft", value: "draft" },
              { label: "Open", value: "open" },
              { label: "Paid", value: "paid" },
              { label: "Overdue", value: "overdue" },
            ],
          },
        ]}
        onRowClick={(invoice) => {
          router.push(`/invoices/${invoice.id}`);
        }}
      />
    </div>
  );
}
```

## Props Reference

| Prop                       | Type                                     | Default                 | Description                 |
| -------------------------- | ---------------------------------------- | ----------------------- | --------------------------- |
| `data`                     | `TData[]`                                | Required                | Table data                  |
| `columns`                  | `ColumnDef<TData, TValue>[]`             | Required                | Column definitions          |
| `searchable`               | `boolean`                                | `true`                  | Enable search               |
| `searchPlaceholder`        | `string`                                 | `"Search..."`           | Search input placeholder    |
| `searchColumn`             | `string`                                 | `undefined`             | Column to search on         |
| `paginated`                | `boolean`                                | `true`                  | Enable pagination           |
| `pageSizeOptions`          | `number[]`                               | `[10, 20, 30, 50, 100]` | Page size options           |
| `defaultPageSize`          | `number`                                 | `10`                    | Default page size           |
| `selectable`               | `boolean`                                | `false`                 | Enable row selection        |
| `bulkActions`              | `BulkAction<TData>[]`                    | `[]`                    | Bulk action definitions     |
| `filterable`               | `boolean`                                | `false`                 | Enable filter bar           |
| `filters`                  | `FilterConfig[]`                         | `[]`                    | Filter definitions          |
| `exportable`               | `boolean`                                | `false`                 | Enable CSV export           |
| `exportFilename`           | `string`                                 | `"data"`                | Export filename             |
| `exportColumns`            | `(keyof TData)[]`                        | All columns             | Columns to export           |
| `columnVisibility`         | `boolean`                                | `true`                  | Enable column toggle        |
| `emptyMessage`             | `string`                                 | `"No results."`         | Empty state message         |
| `className`                | `string`                                 | `undefined`             | Additional CSS classes      |
| `isLoading`                | `boolean`                                | `false`                 | Loading state               |
| `onRowClick`               | `(row: TData) => void`                   | `undefined`             | Row click handler           |
| `toolbarActions`           | `React.ReactNode`                        | `undefined`             | Custom toolbar buttons      |
| `translations`             | `Partial<EnhancedDataTableTranslations>` | Defaults (EN)           | Override UI labels for i18n |
| `enableResponsiveCards`    | `boolean`                                | `false`                 | Show card layout on mobile  |
| `renderMobileCard`         | `(row: Row<TData>) => React.ReactNode`   | `undefined`             | Renderer for mobile cards   |
| `responsiveCardBreakpoint` | `number`                                 | `768`                   | Max width for card view     |

## BulkAction Type

```typescript
interface BulkAction<TData> {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  action: (selectedRows: TData[]) => void | Promise<void>;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  disabled?: (selectedRows: TData[]) => boolean;
  confirmMessage?: string;
}
```

## FilterConfig Type

```typescript
interface FilterConfig {
  column: string;
  label: string;
  type: "text" | "select" | "date" | "number";
  options?: { label: string; value: string }[];
}
```

## Migration from DataTable

If you're using the basic `DataTable`, switching over is simple:

**Before:**

```tsx
<DataTable data={invoices} columns={columns} searchable searchColumn="invoice_number" paginated />
```

**After:**

```tsx
<EnhancedDataTable
  data={invoices}
  columns={columns}
  searchColumn="invoice_number"
  // Now add advanced features:
  selectable
  bulkActions={bulkActions}
  exportable
  filterable
/>
```

All existing props are compatible! Just add new features as needed.

## Performance Tips

1. **Memoize columns**: Use `React.useMemo` for column definitions
2. **Memoize bulk actions**: Define actions outside component or use `useCallback`
3. **Virtualization**: For 1000+ rows, consider using `@tanstack/react-virtual`
4. **Server-side pagination**: For large datasets, implement server-side pagination

### Internationalization

All labels support override via `translations`:

```tsx
<EnhancedDataTable
  data={data}
  columns={columns}
  translations={{
    searchPlaceholder: t("tables.search"),
    filtersLabel: t("tables.filters"),
    exportLabel: t("tables.export"),
    rowsPerPage: t("tables.rowsPerPage"),
    pageOf: (page, count) => t("tables.pageOf", { page, count }),
  }}
/>
```

Defaults are provided for English; pass your i18n strings to localize controls and aria-labels.

### Responsive Card View (Mobile)

Render a mobile-friendly card layout below a breakpoint:

```tsx
<EnhancedDataTable
  data={data}
  columns={columns}
  enableResponsiveCards
  responsiveCardBreakpoint={768}
  renderMobileCard={(row) => (
    <div className="space-y-1">
      <div className="font-semibold">{row.original.invoice_number}</div>
      <div className="text-muted-foreground">{row.original.customer_name}</div>
      <div>${row.original.amount.toFixed(2)}</div>
    </div>
  )}
/>
```

### Server-Side Pagination Pattern

For 10k+ rows, disable built-in pagination and manage it externally:

```tsx
const [pageIndex, setPageIndex] = useState(0);
const [pageSize, setPageSize] = useState(50);
const { rows, total, isLoading } = useInvoices({ pageIndex, pageSize });
const pageCount = Math.ceil(total / pageSize);

return (
  <>
    <EnhancedDataTable
      data={rows}
      columns={columns}
      pagination={false}
      searchable={false}
      isLoading={isLoading}
    />
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      <span>
        Page {pageIndex + 1} of {pageCount}
      </span>
      <button onClick={() => setPageIndex((p) => Math.max(p - 1, 0))} disabled={pageIndex === 0}>
        Prev
      </button>
      <button
        onClick={() => setPageIndex((p) => Math.min(p + 1, pageCount - 1))}
        disabled={pageIndex >= pageCount - 1}
      >
        Next
      </button>
      <select
        value={pageSize}
        onChange={(e) => {
          setPageSize(Number(e.target.value));
          setPageIndex(0);
        }}
      >
        {[20, 50, 100].map((size) => (
          <option key={size} value={size}>
            {size} / page
          </option>
        ))}
      </select>
    </div>
  </>
);
```

See `EnhancedDataTable.examples.tsx` for a working mock of this pattern.

## Use Cases

- **Invoice Lists** - Send, void, download PDFs
- **Alarm Lists** - Acknowledge, clear, create tickets
- **Customer Lists** - Suspend, activate, send emails
- **Device Lists** - Reboot, upgrade firmware, run diagnostics
- **Ticket Lists** - Assign, close, escalate
- **Credit Note Lists** - Apply, void, download

## Related Components

- `DataTable` - Base table component (still available for simple use cases)
- `TablePagination` - Standalone pagination component
- `createSortableHeader` - Helper for sortable column headers

## Support

For issues or questions, see:

- Example implementations in `EnhancedDataTable.examples.tsx`
- Component Consolidation Guide in `/docs/COMPONENT_CONSOLIDATION_GUIDE.md`
