/**
 * EnhancedDataTable Usage Examples
 *
 * This file demonstrates common patterns for using EnhancedDataTable
 * across different features in the application.
 */

import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, CheckCircle, Clock, Download, Edit, Send, Trash2, X } from "lucide-react";
import * as React from "react";

import { Badge } from "./badge";
import { Button } from "./button";
import { createSortableHeader } from "./data-table";
import { EnhancedDataTable, type BulkAction } from "./EnhancedDataTable";

// ============================================================================
// Example 1: Invoice List with Bulk Actions
// ============================================================================

interface Invoice {
  invoice_id: string;
  invoice_number: string;
  customer_name: string;
  amount: number;
  status: "draft" | "open" | "paid" | "void" | "overdue";
  due_date: string;
  created_at: string;
}

const invoiceColumns: ColumnDef<Invoice>[] = [
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
      const statusColors = {
        draft: "bg-gray-500",
        open: "bg-blue-500",
        paid: "bg-green-500",
        void: "bg-red-500",
        overdue: "bg-orange-500",
      };
      return <Badge className={statusColors[status as keyof typeof statusColors]}>{status}</Badge>;
    },
  },
  {
    accessorKey: "due_date",
    header: createSortableHeader("Due Date"),
    cell: ({ row }) => new Date(row.getValue("due_date")).toLocaleDateString(),
  },
];

const invoiceBulkActions: BulkAction<Invoice>[] = [
  {
    label: "Send Invoices",
    icon: Send,
    action: async (invoices) => {
      console.log("Sending invoices:", invoices);
      // API call to send invoices
    },
    disabled: (invoices) => invoices.some((inv) => inv.status === "void"),
  },
  {
    label: "Mark as Paid",
    icon: CheckCircle,
    action: async (invoices) => {
      console.log("Marking as paid:", invoices);
    },
    disabled: (invoices) => invoices.some((inv) => inv.status === "paid"),
  },
  {
    label: "Void Invoices",
    icon: X,
    variant: "destructive",
    action: async (invoices) => {
      console.log("Voiding invoices:", invoices);
    },
    confirmMessage: "Are you sure you want to void these invoices?",
  },
  {
    label: "Download PDFs",
    icon: Download,
    action: async (invoices) => {
      console.log("Downloading PDFs for:", invoices);
    },
  },
];

export function InvoiceListExample({ invoices }: { invoices: Invoice[] }) {
  return (
    <EnhancedDataTable
      data={invoices}
      columns={invoiceColumns}
      searchColumn="invoice_number"
      searchPlaceholder="Search invoices..."
      selectable
      bulkActions={invoiceBulkActions}
      exportable
      exportFilename="invoices"
      exportColumns={["invoice_number", "customer_name", "amount", "status", "due_date"]}
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
      filterable
      onRowClick={(invoice) => console.log("View invoice:", invoice)}
    />
  );
}

// ============================================================================
// Example 2: Alarm/Ticket List with Severity Filtering
// ============================================================================

interface Alarm {
  alarm_id: string;
  severity: "critical" | "major" | "minor" | "warning" | "info";
  resource_name: string;
  alarm_type: string;
  description: string;
  timestamp: string;
  status: "active" | "acknowledged" | "cleared";
}

const alarmColumns: ColumnDef<Alarm>[] = [
  {
    accessorKey: "severity",
    header: "Severity",
    cell: ({ row }) => {
      const severity = row.getValue("severity") as string;
      const severityConfig = {
        critical: { color: "bg-red-600", icon: AlertTriangle },
        major: { color: "bg-orange-500", icon: AlertTriangle },
        minor: { color: "bg-yellow-500", icon: Clock },
        warning: { color: "bg-yellow-400", icon: AlertTriangle },
        info: { color: "bg-blue-500", icon: CheckCircle },
      };
      const config = severityConfig[severity as keyof typeof severityConfig];
      const Icon = config.icon;
      return (
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <Badge className={config.color}>{severity}</Badge>
        </div>
      );
    },
  },
  {
    accessorKey: "resource_name",
    header: createSortableHeader("Resource"),
  },
  {
    accessorKey: "alarm_type",
    header: "Type",
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => <div className="max-w-md truncate">{row.getValue("description")}</div>,
  },
  {
    accessorKey: "timestamp",
    header: createSortableHeader("Time"),
    cell: ({ row }) => new Date(row.getValue("timestamp")).toLocaleString(),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      const statusColors = {
        active: "bg-red-500",
        acknowledged: "bg-yellow-500",
        cleared: "bg-green-500",
      };
      return <Badge className={statusColors[status as keyof typeof statusColors]}>{status}</Badge>;
    },
  },
];

const alarmBulkActions: BulkAction<Alarm>[] = [
  {
    label: "Acknowledge",
    icon: CheckCircle,
    action: async (alarms) => {
      console.log("Acknowledging alarms:", alarms);
    },
    disabled: (alarms) => alarms.every((a) => a.status !== "active"),
  },
  {
    label: "Clear Alarms",
    icon: X,
    action: async (alarms) => {
      console.log("Clearing alarms:", alarms);
    },
  },
  {
    label: "Create Ticket",
    icon: AlertTriangle,
    action: async (alarms) => {
      console.log("Creating ticket for alarms:", alarms);
    },
  },
];

export function AlarmListExample({ alarms }: { alarms: Alarm[] }) {
  return (
    <EnhancedDataTable
      data={alarms}
      columns={alarmColumns}
      searchColumn="resource_name"
      searchPlaceholder="Search by resource..."
      selectable
      bulkActions={alarmBulkActions}
      exportable
      exportFilename="alarms"
      filters={[
        {
          column: "severity",
          label: "Severity",
          type: "select",
          options: [
            { label: "Critical", value: "critical" },
            { label: "Major", value: "major" },
            { label: "Minor", value: "minor" },
            { label: "Warning", value: "warning" },
            { label: "Info", value: "info" },
          ],
        },
        {
          column: "status",
          label: "Status",
          type: "select",
          options: [
            { label: "Active", value: "active" },
            { label: "Acknowledged", value: "acknowledged" },
            { label: "Cleared", value: "cleared" },
          ],
        },
      ]}
      filterable
      onRowClick={(alarm) => console.log("View alarm details:", alarm)}
    />
  );
}

// ============================================================================
// Example 3: Customer List with Custom Toolbar
// ============================================================================

interface Customer {
  customer_id: string;
  name: string;
  email: string;
  phone: string;
  plan: string;
  status: "active" | "suspended" | "inactive";
  created_at: string;
}

const customerColumns: ColumnDef<Customer>[] = [
  {
    accessorKey: "name",
    header: createSortableHeader("Name"),
  },
  {
    accessorKey: "email",
    header: "Email",
  },
  {
    accessorKey: "phone",
    header: "Phone",
  },
  {
    accessorKey: "plan",
    header: "Plan",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      const statusColors = {
        active: "bg-green-500",
        suspended: "bg-yellow-500",
        inactive: "bg-gray-500",
      };
      return <Badge className={statusColors[status as keyof typeof statusColors]}>{status}</Badge>;
    },
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            console.log("Edit customer:", row.original);
          }}
        >
          <Edit className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            console.log("Delete customer:", row.original);
          }}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    ),
  },
];

const customerBulkActions: BulkAction<Customer>[] = [
  {
    label: "Suspend Customers",
    icon: Clock,
    action: async (customers) => {
      console.log("Suspending customers:", customers);
    },
    variant: "destructive",
    confirmMessage: "Are you sure you want to suspend these customers?",
  },
  {
    label: "Activate Customers",
    icon: CheckCircle,
    action: async (customers) => {
      console.log("Activating customers:", customers);
    },
  },
  {
    label: "Send Email",
    icon: Send,
    action: async (customers) => {
      console.log("Sending email to:", customers);
    },
  },
];

export function CustomerListExample({
  customers,
  onAddCustomer,
}: {
  customers: Customer[];
  onAddCustomer: () => void;
}) {
  return (
    <EnhancedDataTable
      data={customers}
      columns={customerColumns}
      searchColumn="name"
      searchPlaceholder="Search customers..."
      selectable
      bulkActions={customerBulkActions}
      exportable
      exportFilename="customers"
      filters={[
        {
          column: "status",
          label: "Status",
          type: "select",
          options: [
            { label: "Active", value: "active" },
            { label: "Suspended", value: "suspended" },
            { label: "Inactive", value: "inactive" },
          ],
        },
        {
          column: "plan",
          label: "Plan",
          type: "select",
          options: [
            { label: "Basic", value: "basic" },
            { label: "Pro", value: "pro" },
            { label: "Enterprise", value: "enterprise" },
          ],
        },
      ]}
      filterable
      toolbarActions={
        <Button onClick={onAddCustomer} size="sm">
          Add Customer
        </Button>
      }
      onRowClick={(customer) => console.log("View customer:", customer)}
    />
  );
}

// ============================================================================
// Example 4: Device List (GenieACS/VOLTHA)
// ============================================================================

interface Device {
  device_id: string;
  serial_number: string;
  model: string;
  firmware_version: string;
  ip_address: string;
  status: "online" | "offline" | "fault";
  last_contact: string;
  customer_name: string;
}

const deviceColumns: ColumnDef<Device>[] = [
  {
    accessorKey: "serial_number",
    header: createSortableHeader("Serial Number"),
  },
  {
    accessorKey: "model",
    header: "Model",
  },
  {
    accessorKey: "firmware_version",
    header: "Firmware",
  },
  {
    accessorKey: "ip_address",
    header: "IP Address",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      const statusColors = {
        online: "bg-green-500",
        offline: "bg-gray-500",
        fault: "bg-red-500",
      };
      return <Badge className={statusColors[status as keyof typeof statusColors]}>{status}</Badge>;
    },
  },
  {
    accessorKey: "customer_name",
    header: "Customer",
  },
  {
    accessorKey: "last_contact",
    header: createSortableHeader("Last Contact"),
    cell: ({ row }) => new Date(row.getValue("last_contact")).toLocaleString(),
  },
];

const deviceBulkActions: BulkAction<Device>[] = [
  {
    label: "Reboot Devices",
    icon: AlertTriangle,
    action: async (devices) => {
      console.log("Rebooting devices:", devices);
    },
    variant: "destructive",
    confirmMessage: "Are you sure you want to reboot these devices?",
  },
  {
    label: "Upgrade Firmware",
    icon: Download,
    action: async (devices) => {
      console.log("Upgrading firmware for:", devices);
    },
  },
  {
    label: "Run Diagnostics",
    icon: CheckCircle,
    action: async (devices) => {
      console.log("Running diagnostics on:", devices);
    },
  },
];

export function DeviceListExample({ devices }: { devices: Device[] }) {
  return (
    <EnhancedDataTable
      data={devices}
      columns={deviceColumns}
      searchColumn="serial_number"
      searchPlaceholder="Search by serial number..."
      selectable
      bulkActions={deviceBulkActions}
      exportable
      exportFilename="devices"
      filters={[
        {
          column: "status",
          label: "Status",
          type: "select",
          options: [
            { label: "Online", value: "online" },
            { label: "Offline", value: "offline" },
            { label: "Fault", value: "fault" },
          ],
        },
        {
          column: "model",
          label: "Model",
          type: "text",
        },
      ]}
      filterable
      onRowClick={(device) => console.log("View device details:", device)}
    />
  );
}

// ============================================================================
// Example 5: Server-Side Pagination Pattern (10k+ rows)
// ============================================================================

export function ServerSidePaginationExample() {
  const [pageIndex, setPageIndex] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(20);
  const [rows, setRows] = React.useState<Invoice[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    setLoading(true);
    const timeout = setTimeout(() => {
      // Simulate a backend with 10,000 rows
      const simulatedTotal = 10000;
      const start = pageIndex * pageSize;
      const generated: Invoice[] = Array.from({ length: pageSize }, (_v, idx) => {
        const id = start + idx + 1;
        return {
          invoice_id: `inv-${id}`,
          invoice_number: `INV-${id.toString().padStart(5, "0")}`,
          customer_name: `Customer ${id}`,
          amount: 100 + (id % 50),
          status: id % 3 === 0 ? "paid" : "open",
          due_date: new Date().toISOString(),
          created_at: new Date().toISOString(),
        };
      });
      setRows(generated);
      setTotal(simulatedTotal);
      setLoading(false);
    }, 300);

    return () => clearTimeout(timeout);
  }, [pageIndex, pageSize]);

  const pageCount = Math.ceil(total / pageSize);

  return (
    <div className="space-y-3">
      <EnhancedDataTable
        data={rows}
        columns={invoiceColumns}
        pagination={false}
        searchable={false}
        isLoading={loading}
        emptyMessage="No invoices"
        enableResponsiveCards
        renderMobileCard={(row) => (
          <div className="space-y-1">
            <div className="text-sm font-semibold">{row.original.invoice_number}</div>
            <div className="text-sm text-muted-foreground">{row.original.customer_name}</div>
            <div className="text-sm">${row.original.amount.toFixed(2)}</div>
            <Badge>{row.original.status}</Badge>
          </div>
        )}
      />
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Page {pageIndex + 1} of {pageCount}
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPageIndex((idx) => Math.max(idx - 1, 0))}
            disabled={pageIndex === 0 || loading}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPageIndex((idx) => Math.min(idx + 1, pageCount - 1))}
            disabled={pageIndex >= pageCount - 1 || loading}
          >
            Next
          </Button>
          <select
            className="h-8 rounded-md border border-input bg-card px-2 text-sm"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPageIndex(0);
            }}
          >
            {[10, 20, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
