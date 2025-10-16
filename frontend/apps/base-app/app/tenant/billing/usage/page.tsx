'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EnhancedDataTable, BulkAction } from '@/components/ui/EnhancedDataTable';
import { createSortableHeader } from '@/components/ui/data-table';
import { UniversalChart } from '@dotmac/primitives';
import {
  Activity,
  Download,
  RefreshCw,
  Receipt,
  TrendingUp,
  Database,
  DollarSign,
} from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { useRBAC } from '@/contexts/RBACContext';
import {
  useUsageRecords,
  useUsageStatistics,
  useUsageOperations,
  useUsageChartData,
  type UsageRecord,
} from '@/hooks/useUsageBilling';

// ============================================================================
// Types (imported from useUsageBilling)
// ============================================================================

import type { UsageType, BilledStatus } from '@/hooks/useUsageBilling';

interface UsageChartData {
  date: string;
  data_transfer: number;
  voice_minutes: number;
  bandwidth_gb: number;
  overage_gb: number;
}

// ============================================================================
// Mock Data
// ============================================================================

const mockUsageRecords: UsageRecord[] = [
  {
    id: 'usage-001',
    subscription_id: 'sub-001',
    customer_id: 'cust-001',
    customer_name: 'John Doe',
    usage_type: 'data_transfer',
    quantity: 150.5,
    unit: 'GB',
    unit_price: 10, // $0.10/GB
    total_amount: 1505, // $15.05
    currency: 'USD',
    period_start: new Date(Date.now() - 86400000).toISOString(),
    period_end: new Date().toISOString(),
    billed_status: 'pending',
    source_system: 'radius',
    description: 'Internet data usage',
    created_at: new Date().toISOString(),
  },
  {
    id: 'usage-002',
    subscription_id: 'sub-002',
    customer_id: 'cust-002',
    customer_name: 'Jane Smith',
    usage_type: 'voice_minutes',
    quantity: 120,
    unit: 'minutes',
    unit_price: 5, // $0.05/min
    total_amount: 600, // $6.00
    currency: 'USD',
    period_start: new Date(Date.now() - 172800000).toISOString(),
    period_end: new Date(Date.now() - 86400000).toISOString(),
    billed_status: 'billed',
    invoice_id: 'inv-001',
    billed_at: new Date(Date.now() - 43200000).toISOString(),
    source_system: 'api',
    description: 'VoIP call minutes',
    created_at: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: 'usage-003',
    subscription_id: 'sub-003',
    customer_id: 'cust-003',
    customer_name: 'Bob Johnson',
    usage_type: 'overage_gb',
    quantity: 50,
    unit: 'GB',
    unit_price: 20, // $0.20/GB overage
    total_amount: 1000, // $10.00
    currency: 'USD',
    period_start: new Date(Date.now() - 259200000).toISOString(),
    period_end: new Date(Date.now() - 172800000).toISOString(),
    billed_status: 'pending',
    source_system: 'radius',
    description: 'Data overage charges',
    service_location: '123 Main St, City, ST 12345',
    created_at: new Date(Date.now() - 259200000).toISOString(),
  },
  {
    id: 'usage-004',
    subscription_id: 'sub-001',
    customer_id: 'cust-001',
    customer_name: 'John Doe',
    usage_type: 'equipment_rental',
    quantity: 1,
    unit: 'month',
    unit_price: 500, // $5.00/month
    total_amount: 500, // $5.00
    currency: 'USD',
    period_start: new Date(Date.now() - 86400000 * 30).toISOString(),
    period_end: new Date().toISOString(),
    billed_status: 'billed',
    invoice_id: 'inv-002',
    billed_at: new Date(Date.now() - 86400000).toISOString(),
    source_system: 'api',
    description: 'ONT equipment rental',
    device_id: 'ONT-12345',
    created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
  },
];

const mockUsageStats: UsageStats = {
  total_records: 4,
  total_amount: 3605, // $36.05
  pending_amount: 2505, // $25.05
  billed_amount: 1100, // $11.00
};

// Last 7 days of usage
const mockUsageChartData: UsageChartData[] = Array.from({ length: 7 }, (_, i) => {
  const date = new Date(Date.now() - (6 - i) * 86400000);
  return {
    date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    data_transfer: Math.floor(Math.random() * 200) + 100,
    voice_minutes: Math.floor(Math.random() * 150) + 50,
    bandwidth_gb: Math.floor(Math.random() * 100) + 50,
    overage_gb: Math.floor(Math.random() * 30),
  };
});

// ============================================================================
// Component
// ============================================================================

export default function UsageBillingPage() {
  const { hasPermission } = useRBAC();
  const hasBillingAccess = hasPermission('billing.read');

  // API Hooks
  const { data: apiRecords = [], isLoading: recordsLoading, error: recordsError, refetch } = useUsageRecords({
    limit: 100,
  });
  const { data: apiStatistics, isLoading: statsLoading } = useUsageStatistics();
  const { data: apiChartData = [], isLoading: chartLoading } = useUsageChartData({
    period_type: 'daily',
    days: 7,
  });
  const { markAsBilled, excludeFromBilling, isLoading: operationsLoading } = useUsageOperations();

  // Use API data with fallback to mock data for development
  const usageRecords = apiRecords.length > 0 ? apiRecords : mockUsageRecords;
  const isLoading = recordsLoading || operationsLoading;

  // Calculate statistics from API or local data
  const statistics = useMemo(() => {
    if (apiStatistics) {
      return {
        totalRecords: apiStatistics.total_records,
        totalAmount: apiStatistics.total_amount / 100,
        pendingAmount: apiStatistics.pending_amount / 100,
        billedAmount: apiStatistics.billed_amount / 100,
      };
    }

    // Fallback to local calculation
    return {
      totalRecords: usageRecords.length,
      totalAmount: usageRecords.reduce((sum, r) => sum + r.total_amount, 0) / 100,
      pendingAmount: usageRecords
        .filter(r => r.billed_status === 'pending')
        .reduce((sum, r) => sum + r.total_amount, 0) / 100,
      billedAmount: usageRecords
        .filter(r => r.billed_status === 'billed')
        .reduce((sum, r) => sum + r.total_amount, 0) / 100,
    };
  }, [apiStatistics, usageRecords]);

  // ============================================================================
  // Table Configuration
  // ============================================================================

  const columns: ColumnDef<UsageRecord>[] = [
    {
      accessorKey: 'customer_name',
      header: createSortableHeader('Customer'),
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.getValue('customer_name') || row.original.customer_id}</div>
          <div className="text-xs text-muted-foreground">{row.original.subscription_id}</div>
        </div>
      ),
    },
    {
      accessorKey: 'usage_type',
      header: 'Usage Type',
      cell: ({ row }) => {
        const usageType = row.getValue('usage_type') as UsageType;
        const usageTypeLabels: Record<UsageType, string> = {
          data_transfer: 'Data Transfer',
          voice_minutes: 'Voice Minutes',
          sms_count: 'SMS',
          bandwidth_gb: 'Bandwidth',
          overage_gb: 'Data Overage',
          static_ip: 'Static IP',
          equipment_rental: 'Equipment Rental',
          installation_fee: 'Installation',
          custom: 'Custom',
        };
        return (
          <Badge variant="outline">{usageTypeLabels[usageType]}</Badge>
        );
      },
    },
    {
      accessorKey: 'quantity',
      header: createSortableHeader('Quantity'),
      cell: ({ row }) => {
        const quantity = row.getValue('quantity') as number;
        const unit = row.original.unit;
        return (
          <div className="text-sm">
            {quantity.toFixed(2)} {unit}
          </div>
        );
      },
    },
    {
      accessorKey: 'total_amount',
      header: createSortableHeader('Amount'),
      cell: ({ row }) => {
        const amount = row.getValue('total_amount') as number;
        const currency = row.original.currency;
        const displayAmount = amount / 100;
        return (
          <div className="font-medium">
            {currency} ${displayAmount.toFixed(2)}
          </div>
        );
      },
    },
    {
      accessorKey: 'period_start',
      header: createSortableHeader('Period'),
      cell: ({ row }) => {
        const start = new Date(row.getValue('period_start'));
        const end = new Date(row.original.period_end);
        return (
          <div className="text-sm">
            <div>{start.toLocaleDateString()}</div>
            <div className="text-xs text-muted-foreground">
              to {end.toLocaleDateString()}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'billed_status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.getValue('billed_status') as BilledStatus;
        const statusConfig = {
          pending: { color: 'bg-yellow-500 text-black', label: 'Pending' },
          billed: { color: 'bg-green-500 text-white', label: 'Billed' },
          error: { color: 'bg-red-500 text-white', label: 'Error' },
          excluded: { color: 'bg-gray-500 text-white', label: 'Excluded' },
        };
        const { color, label } = statusConfig[status];
        return <Badge className={color}>{label}</Badge>;
      },
    },
    {
      accessorKey: 'invoice_id',
      header: 'Invoice',
      cell: ({ row }) => {
        const invoiceId = row.getValue('invoice_id') as string | undefined;
        return (
          <div className="text-sm text-muted-foreground">
            {invoiceId || '—'}
          </div>
        );
      },
    },
    {
      accessorKey: 'source_system',
      header: 'Source',
      cell: ({ row }) => {
        const source = row.getValue('source_system') as string;
        return (
          <Badge variant="outline" className="text-xs">
            {source.toUpperCase()}
          </Badge>
        );
      },
    },
  ];

  // ============================================================================
  // Bulk Actions
  // ============================================================================

  const bulkActions: BulkAction<UsageRecord>[] = [
    {
      label: 'Mark as Billed',
      icon: Receipt,
      action: async (selected) => {
        const usageIds = selected.map(r => r.id);
        // TODO: Replace 'manual-invoice' with actual invoice ID from invoice creation flow
        const success = await markAsBilled(usageIds, 'manual-invoice');

        if (success) {
          // Refetch data to show updated records
          await refetch();
        } else {
          alert('Failed to mark usage records as billed. Please try again.');
        }
      },
      disabled: (selected) => selected.every(r => r.billed_status !== 'pending'),
    },
    {
      label: 'Exclude from Billing',
      icon: Database,
      action: async (selected) => {
        const usageIds = selected.map(r => r.id);
        const success = await excludeFromBilling(usageIds);

        if (success) {
          // Refetch data to show updated records
          await refetch();
        } else {
          alert('Failed to exclude usage records from billing. Please try again.');
        }
      },
    },
    {
      label: 'Download CSV',
      icon: Download,
      action: async (selected) => {
        console.log('Downloading usage records:', selected.map(r => r.id));
        // TODO: Implement CSV download via API
        alert(`Downloading ${selected.length} usage record(s)`);
      },
    },
  ];

  if (!hasBillingAccess) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Usage Billing</CardTitle>
            <CardDescription>
              Access requires <code>billing.read</code> permission.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  // Show error state if API fails
  if (recordsError) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Usage Billing</CardTitle>
            <CardDescription className="text-red-600">
              Failed to load usage records. Please try again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Error: {recordsError.message}
            </p>
            <Button onClick={refetch}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Usage Billing</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track metered services and pay-as-you-go charges
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={refetch} variant="outline" disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button>
            <Activity className="h-4 w-4 mr-2" />
            Record Usage
          </Button>
        </div>
      </header>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Records</CardDescription>
            <CardTitle className="text-3xl">{statistics.totalRecords}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              All usage records
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Usage</CardDescription>
            <CardTitle className="text-3xl text-blue-600">
              ${statistics.totalAmount.toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              All usage charges
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Pending</CardDescription>
            <CardTitle className="text-3xl text-yellow-600">
              ${statistics.pendingAmount.toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              Awaiting invoicing
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Billed</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              ${statistics.billedAmount.toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              Invoiced charges
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage Trend Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Usage Trends (Last 7 Days)</CardTitle>
              <CardDescription>
                Metered usage by type over time
              </CardDescription>
            </div>
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            {chartLoading ? (
              <div className="flex items-center justify-center h-full">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <UniversalChart
                type="line"
                data={apiChartData.length > 0 ? apiChartData : mockUsageChartData}
                series={[
                  { key: 'data_transfer', name: 'Data Transfer (GB)', color: '#3b82f6' },
                  { key: 'voice_minutes', name: 'Voice Minutes', color: '#10b981' },
                  { key: 'bandwidth_gb', name: 'Bandwidth (GB)', color: '#f59e0b' },
                  { key: 'overage_gb', name: 'Overage (GB)', color: '#ef4444' },
                ]}
                xAxisLabel="Date"
                yAxisLabel="Usage"
                showLegend
                showGrid
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Usage Records Table */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Records</CardTitle>
          <CardDescription>
            View and manage usage records with filtering and bulk actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EnhancedDataTable
            data={usageRecords}
            columns={columns}
            searchColumn="customer_name"
            searchPlaceholder="Search by customer name..."
            isLoading={isLoading}
            selectable
            bulkActions={bulkActions}
            exportable
            exportFilename="usage-records"
            exportColumns={['customer_name', 'usage_type', 'quantity', 'unit', 'total_amount', 'period_start', 'period_end', 'billed_status', 'invoice_id']}
            filterable
            filters={[
              {
                column: 'usage_type',
                label: 'Usage Type',
                type: 'select',
                options: [
                  { label: 'Data Transfer', value: 'data_transfer' },
                  { label: 'Voice Minutes', value: 'voice_minutes' },
                  { label: 'SMS', value: 'sms_count' },
                  { label: 'Bandwidth', value: 'bandwidth_gb' },
                  { label: 'Data Overage', value: 'overage_gb' },
                  { label: 'Static IP', value: 'static_ip' },
                  { label: 'Equipment Rental', value: 'equipment_rental' },
                  { label: 'Installation', value: 'installation_fee' },
                  { label: 'Custom', value: 'custom' },
                ],
              },
              {
                column: 'billed_status',
                label: 'Status',
                type: 'select',
                options: [
                  { label: 'Pending', value: 'pending' },
                  { label: 'Billed', value: 'billed' },
                  { label: 'Error', value: 'error' },
                  { label: 'Excluded', value: 'excluded' },
                ],
              },
            ]}
            onRowClick={(record) => {
              console.log('View usage record details:', record);
              // TODO: Open usage record detail modal
            }}
          />
        </CardContent>
      </Card>
    </main>
  );
}
