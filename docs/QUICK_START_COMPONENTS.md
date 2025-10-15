# Quick Start: Using Existing Components

**Purpose**: Get started with charts and tables in 5 minutes

---

## 📊 Charts (from @dotmac/primitives)

### Import
```typescript
import {
  UniversalChart,
  RevenueChart,
  NetworkUsageChart,
  CustomerGrowthChart
} from '@dotmac/primitives';
```

### Quick Examples

#### Bar Chart
```typescript
<UniversalChart
  type="bar"
  data={[
    { name: 'Jan', value: 100 },
    { name: 'Feb', value: 150 }
  ]}
  series={[{ key: 'value', name: 'Sales' }]}
  title="Monthly Sales"
/>
```

#### Line Chart with Multiple Series
```typescript
<UniversalChart
  type="line"
  data={monthlyData}
  series={[
    { key: 'revenue', name: 'Revenue', type: 'area' },
    { key: 'cost', name: 'Cost', type: 'line' }
  ]}
  title="Revenue vs Cost"
  smooth
/>
```

#### Revenue Chart (Pre-configured)
```typescript
<RevenueChart
  data={revenueData}
  showTarget={true}
  currency="USD"
  title="Revenue Trends"
/>
```

#### Network Usage Chart
```typescript
<NetworkUsageChart
  data={usageData}
  showTotal={true}
  unit="GB"
  title="Network Usage"
/>
```

---

## 📋 Tables (EnhancedDataTable)

### Import
```typescript
import { EnhancedDataTable } from '@/components/ui/EnhancedDataTable';
import { createSortableHeader } from '@/components/ui/data-table';
```

### Quick Examples

#### Basic Table with Search
```typescript
const columns = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'status', header: 'Status' }
];

<EnhancedDataTable
  data={users}
  columns={columns}
  searchColumn="name"
  searchPlaceholder="Search users..."
/>
```

#### Table with Bulk Actions
```typescript
import { Send, Trash2 } from 'lucide-react';

const bulkActions = [
  {
    label: 'Send Email',
    icon: Send,
    action: async (selected) => {
      await sendEmails(selected);
    }
  },
  {
    label: 'Delete',
    icon: Trash2,
    variant: 'destructive',
    action: async (selected) => {
      await deleteUsers(selected);
    },
    confirmMessage: 'Delete these users?'
  }
];

<EnhancedDataTable
  data={users}
  columns={columns}
  selectable
  bulkActions={bulkActions}
/>
```

#### Table with Filters & Export
```typescript
<EnhancedDataTable
  data={invoices}
  columns={columns}
  searchColumn="invoice_number"
  selectable
  bulkActions={bulkActions}
  exportable
  exportFilename="invoices"
  filterable
  filters={[
    {
      column: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Open', value: 'open' },
        { label: 'Paid', value: 'paid' }
      ]
    }
  ]}
/>
```

#### Sortable Columns
```typescript
import { createSortableHeader } from '@/components/ui/data-table';

const columns = [
  {
    accessorKey: 'name',
    header: createSortableHeader('Name')
  },
  {
    accessorKey: 'created_at',
    header: createSortableHeader('Created')
  }
];
```

---

## 🎨 Status Badges

```typescript
import { Badge } from '@/components/ui/badge';

// Status badge with colors
<Badge className="bg-green-500">Active</Badge>
<Badge className="bg-red-500">Inactive</Badge>
<Badge className="bg-yellow-500">Pending</Badge>
```

---

## 🔄 Common Patterns

### Alarm List
```typescript
<EnhancedDataTable
  data={alarms}
  columns={alarmColumns}
  searchColumn="resource_name"
  selectable
  bulkActions={[
    { label: 'Acknowledge', icon: CheckCircle, action: acknowledge },
    { label: 'Clear', icon: X, action: clear }
  ]}
  exportable
  filterable
  filters={[
    {
      column: 'severity',
      label: 'Severity',
      type: 'select',
      options: [
        { label: 'Critical', value: 'critical' },
        { label: 'Major', value: 'major' }
      ]
    }
  ]}
/>
```

### Invoice List
```typescript
<EnhancedDataTable
  data={invoices}
  columns={invoiceColumns}
  searchColumn="invoice_number"
  selectable
  bulkActions={[
    { label: 'Send', icon: Send, action: send },
    { label: 'Void', icon: X, action: void, variant: 'destructive' }
  ]}
  exportable
/>
```

### Device List
```typescript
<EnhancedDataTable
  data={devices}
  columns={deviceColumns}
  searchColumn="serial_number"
  selectable
  bulkActions={[
    {
      label: 'Reboot',
      icon: AlertTriangle,
      variant: 'destructive',
      action: reboot,
      confirmMessage: 'Reboot these devices?'
    }
  ]}
  exportable
/>
```

---

## 📖 Full Documentation

- **Charts**: See `/docs/COMPONENT_CONSOLIDATION_GUIDE.md`
- **Tables**: See `EnhancedDataTable.md`
- **Examples**: See `EnhancedDataTable.examples.tsx`

---

## ⚡ Quick Tips

1. **Always use `searchColumn`** - Enables search functionality
2. **Add `selectable` for bulk actions** - Users love batch operations
3. **Use `confirmMessage` for destructive actions** - Prevents accidents
4. **Enable `exportable`** - Everyone wants CSV export
5. **Use `createSortableHeader`** - Makes columns sortable
6. **Check examples first** - Likely has what you need

---

**Need Help?** Check the full documentation or examples!
