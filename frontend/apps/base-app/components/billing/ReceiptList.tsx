'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar,
  CreditCard,
  Download,
  Eye,
  FileText,
  Mail,
  Printer,
  RefreshCw,
} from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { Receipt } from '@/types/billing';
import { EnhancedDataTable, type ColumnDef, type BulkAction, type QuickFilter, type Row } from '@/components/ui/EnhancedDataTable';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils/currency';

interface ReceiptListProps {
  tenantId: string;
  customerId?: string;
  onReceiptSelect?: (receipt: Receipt) => void;
}

const paymentStatusColors: Record<string, string> = {
  completed: 'bg-green-500/10 text-green-600 dark:text-green-400',
  succeeded: 'bg-green-500/10 text-green-600 dark:text-green-400',
  pending: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  processing: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  failed: 'bg-red-500/10 text-red-600 dark:text-red-400',
  refunded: 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
};

const paymentMethodIcons: Record<string, typeof CreditCard> = {
  card: CreditCard,
  credit_card: CreditCard,
  bank_transfer: FileText,
  paypal: CreditCard,
  stripe: CreditCard,
  cash: CreditCard,
  check: FileText,
};

export default function ReceiptList({ tenantId, customerId, onReceiptSelect }: ReceiptListProps) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const fetchReceipts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams();
      if (tenantId) {
        queryParams.set('tenant_id', tenantId);
      }
      if (customerId) {
        queryParams.set('customer_id', customerId);
      }

      const endpoint = `/billing/receipts${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await apiClient.get(endpoint);
      if (response.data) {
        const data = response.data as { receipts?: Receipt[] };
        setReceipts(data.receipts || []);
      } else {
        throw new Error('Failed to fetch receipts');
      }
    } catch (err) {
      console.error('Failed to fetch receipts:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch receipts';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [tenantId, customerId]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  // Download single receipt PDF
  const handleDownloadPDF = async (receipt: Receipt) => {
    try {
      const response = await apiClient.get(
        `/billing/receipts/${receipt.receipt_id}/pdf`,
        { responseType: 'blob' }
      );

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `receipt_${receipt.receipt_number}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download receipt:', err);
      alert('Failed to download receipt. Please try again.');
    }
  };

  // View receipt HTML
  const handleViewReceipt = (receipt: Receipt) => {
    window.open(`/billing/receipts/${receipt.receipt_id}/html`, '_blank');
  };

  // Print receipt
  const handlePrintReceipt = (receipt: Receipt) => {
    const printWindow = window.open(`/billing/receipts/${receipt.receipt_id}/html`, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  // Email receipt
  const handleEmailReceipt = async (receipt: Receipt) => {
    try {
      await apiClient.post(`/billing/receipts/${receipt.receipt_id}/email`);
      alert(`Receipt ${receipt.receipt_number} sent to ${receipt.customer_email}`);
    } catch (err) {
      console.error('Failed to email receipt:', err);
      alert('Failed to email receipt. Please try again.');
    }
  };

  // Bulk operations
  const handleBulkDownload = async (selected: Receipt[]) => {
    setBulkLoading(true);
    try {
      const receiptIds = selected.map(r => r.receipt_id);
      const response = await apiClient.post('/billing/receipts/bulk-download',
        { receipt_ids: receiptIds },
        { responseType: 'blob' }
      );

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `receipts-${new Date().toISOString().split('T')[0]}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download receipts:', err);
      alert('Failed to download receipts. Please try again.');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkEmail = async (selected: Receipt[]) => {
    setBulkLoading(true);
    try {
      const receiptIds = selected.map(r => r.receipt_id);
      await apiClient.post('/billing/receipts/bulk-email', { receipt_ids: receiptIds });
      alert(`Successfully sent ${receiptIds.length} receipt(s)`);
    } catch (err) {
      console.error('Failed to email receipts:', err);
      alert('Failed to email receipts. Please try again.');
    } finally {
      setBulkLoading(false);
    }
  };

  // Column definitions
  const columns: ColumnDef<Receipt>[] = useMemo(() => [
    {
      id: 'receipt_number',
      header: 'Receipt #',
      accessorKey: 'receipt_number',
      cell: ({ row }: { row: Row<Receipt> }) => (
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{row.original.receipt_number}</span>
        </div>
      ),
    },
    {
      id: 'customer',
      header: 'Customer',
      cell: ({ row }: { row: Row<Receipt> }) => (
        <div>
          <div className="text-sm font-medium">{row.original.customer_name}</div>
          <div className="text-xs text-muted-foreground">{row.original.customer_email}</div>
        </div>
      ),
    },
    {
      id: 'amount',
      header: 'Amount',
      cell: ({ row }: { row: Row<Receipt> }) => (
        <div>
          <div className="font-medium">{formatCurrency(row.original.total_amount, row.original.currency)}</div>
          {row.original.tax_amount > 0 && (
            <div className="text-xs text-muted-foreground">
              Tax: {formatCurrency(row.original.tax_amount, row.original.currency)}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'payment_method',
      header: 'Payment Method',
      cell: ({ row }: { row: Row<Receipt> }) => {
        const Icon = paymentMethodIcons[row.original.payment_method.toLowerCase()] || CreditCard;
        return (
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm capitalize">{row.original.payment_method.replace('_', ' ')}</span>
          </div>
        );
      },
    },
    {
      id: 'issue_date',
      header: 'Issue Date',
      accessorKey: 'issue_date',
      cell: ({ row }: { row: Row<Receipt> }) => {
        const issueDate = new Date(row.original.issue_date);
        return (
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            {issueDate.toLocaleDateString()}
          </div>
        );
      },
    },
    {
      id: 'payment_status',
      header: 'Status',
      accessorKey: 'payment_status',
      cell: ({ row }: { row: Row<Receipt> }) => (
        <Badge variant={
          row.original.payment_status === 'completed' || row.original.payment_status === 'succeeded' ? 'success' :
          row.original.payment_status === 'failed' ? 'destructive' :
          row.original.payment_status === 'processing' ? 'default' :
          'secondary'
        }>
          {row.original.payment_status}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }: { row: Row<Receipt> }) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleViewReceipt(row.original);
            }}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            title="View receipt"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDownloadPDF(row.original);
            }}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            title="Download PDF"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePrintReceipt(row.original);
            }}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            title="Print receipt"
          >
            <Printer className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleEmailReceipt(row.original);
            }}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            title="Email receipt"
          >
            <Mail className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ], []);

  // Bulk actions
  const bulkActions: BulkAction<Receipt>[] = useMemo(() => [
    {
      label: 'Download Selected',
      icon: Download,
      action: handleBulkDownload,
    },
    {
      label: 'Email Selected',
      icon: Mail,
      action: handleBulkEmail,
    },
  ], []);

  // Quick filters
  const quickFilters: QuickFilter<Receipt>[] = useMemo(() => [
    {
      label: 'This Month',
      filter: (receipt: Receipt) => {
        const issueDate = new Date(receipt.issue_date);
        const now = new Date();
        return issueDate.getMonth() === now.getMonth() && issueDate.getFullYear() === now.getFullYear();
      },
    },
    {
      label: 'Last 7 Days',
      filter: (receipt: Receipt) => {
        const issueDate = new Date(receipt.issue_date);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return issueDate >= sevenDaysAgo;
      },
    },
    {
      label: 'Card Payments',
      filter: (receipt: Receipt) => receipt.payment_method.toLowerCase().includes('card') || receipt.payment_method === 'stripe',
    },
    {
      label: 'Completed',
      filter: (receipt: Receipt) => receipt.payment_status === 'completed' || receipt.payment_status === 'succeeded',
    },
  ], []);

  // Search configuration
  const searchConfig = {
    placeholder: 'Search receipts by number, customer name, or email...',
    searchableFields: ['receipt_number', 'customer_name', 'customer_email'] as (keyof Receipt)[],
  };

  // Calculate statistics
  const statistics = useMemo(() => {
    const totalReceipts = receipts.length;
    const totalAmount = receipts.reduce((sum, r) => sum + r.total_amount, 0);
    const thisMonthReceipts = receipts
      .filter(r => {
        const issueDate = new Date(r.issue_date);
        const now = new Date();
        return issueDate.getMonth() === now.getMonth() && issueDate.getFullYear() === now.getFullYear();
      });
    const thisMonthAmount = thisMonthReceipts.reduce((sum, r) => sum + r.total_amount, 0);

    return { totalReceipts, totalAmount, thisMonthAmount, currency: receipts[0]?.currency || 'USD' };
  }, [receipts]);

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-8">
        <div className="flex items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading receipts...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-900/20 bg-red-950/20 p-4">
        <div className="text-red-600 dark:text-red-400">{error}</div>
        <button
          onClick={fetchReceipts}
          className="mt-2 text-sm text-red-700 hover:text-red-600 dark:text-red-300 dark:hover:text-red-200"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="receipt-table">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground mb-1">Total Receipts</div>
          <div className="text-2xl font-bold text-foreground">{statistics.totalReceipts}</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground mb-1">Total Amount</div>
          <div className="text-2xl font-bold text-foreground">
            {formatCurrency(statistics.totalAmount, statistics.currency)}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground mb-1">This Month</div>
          <div className="text-2xl font-bold text-foreground">
            {formatCurrency(statistics.thisMonthAmount, statistics.currency)}
          </div>
        </div>
      </div>

      {/* Enhanced Receipt Table */}
      <EnhancedDataTable
        data={receipts}
        columns={columns}
        bulkActions={bulkActions}
        quickFilters={quickFilters}
        searchConfig={searchConfig}
        onRowClick={onReceiptSelect}
        isLoading={bulkLoading}
        emptyMessage="No receipts found"
        getRowId={(receipt: Receipt) => receipt.receipt_id}
      />
    </div>
  );
}
