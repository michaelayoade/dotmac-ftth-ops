'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  ChevronRight,
  DollarSign,
  Download,
  FileText,
  Filter,
  RefreshCw
} from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { Invoice, InvoiceLineItem, InvoiceStatuses } from '@/types';

interface InvoiceListProps {
  tenantId: string;
  onInvoiceSelect?: (invoice: Invoice) => void;
}

const statusColors = {
  draft: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
  finalized: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  paid: 'bg-green-500/10 text-green-600 dark:text-green-400',
  void: 'bg-red-500/10 text-red-600 dark:text-red-400',
  uncollectible: 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
};

const paymentStatusColors: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  processing: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  paid: 'bg-green-500/10 text-green-600 dark:text-green-400',
  failed: 'bg-red-500/10 text-red-600 dark:text-red-400',
  refunded: 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
};

export default function InvoiceList({ tenantId, onInvoiceSelect }: InvoiceListProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams();
      if (tenantId) {
        queryParams.set('tenant_id', tenantId);
      }
      if (statusFilter !== 'all') {
        queryParams.set('status', statusFilter);
      }
      if (searchQuery) {
        queryParams.set('search', searchQuery);
      }

      const endpoint = `/api/v1/billing/invoices${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await apiClient.get(endpoint);
      if (response.data) {
        const data = response.data as { invoices?: Invoice[] };
        setInvoices(data.invoices || []);
      } else {
        throw new Error('Failed to fetch invoices');
      }
    } catch (err) {
      console.error('Failed to fetch invoices:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch invoices';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter, tenantId]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount / 100); // Convert from cents
  };

  const filteredInvoices = invoices.filter(invoice => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        invoice.invoice_number.toLowerCase().includes(query) ||
        invoice.billing_email?.toLowerCase().includes(query) ||
        invoice.customer_id.toLowerCase().includes(query)
      );
    }
    return true;
  });

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-8">
        <div className="flex items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading invoices...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-900/20 bg-red-950/20 p-4">
        <div className="text-red-600 dark:text-red-400">{error}</div>
        <button
          onClick={fetchInvoices}
          className="mt-2 text-sm text-red-700 hover:text-red-600 dark:text-red-300 dark:hover:text-red-200"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="invoice-table">
      {/* Filters and Search */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-sky-500 focus:outline-none"
            data-testid="invoice-status-filter"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="finalized">Finalized</option>
            <option value="paid">Paid</option>
            <option value="void">Void</option>
            <option value="uncollectible">Uncollectible</option>
          </select>
        </div>

        <input
          type="text"
          placeholder="Search invoices..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-sky-500 focus:outline-none"
          data-testid="invoice-search"
        />
      </div>

      {/* Invoice List */}
      <div className="rounded-lg border border-border bg-card">
        <div className="grid grid-cols-7 gap-4 border-b border-border px-6 py-3 text-xs font-medium text-muted-foreground">
          <div>Invoice #</div>
          <div>Customer</div>
          <div>Amount</div>
          <div>Due Date</div>
          <div>Status</div>
          <div>Payment</div>
          <div></div>
        </div>

        {filteredInvoices.length === 0 ? (
          <div className="px-6 py-12 text-center text-muted-foreground">
            No invoices found
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredInvoices.map((invoice) => (
              <div
                key={invoice.invoice_id}
                className="grid grid-cols-7 gap-4 px-6 py-4 hover:bg-muted cursor-pointer transition-colors"
                data-testid="invoice-row"
                onClick={() => onInvoiceSelect?.(invoice)}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground" data-testid="invoice-number">
                      {invoice.invoice_number}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-sm text-foreground">{invoice.billing_email}</div>
                  <div className="text-xs text-muted-foreground">{invoice.customer_id.slice(0, 8)}...</div>
                </div>

                <div>
                  <div className="text-sm font-medium text-foreground" data-testid="invoice-amount">
                    {formatCurrency(invoice.total_amount, invoice.currency)}
                  </div>
                  {invoice.amount_due > 0 && (
                    <div className="text-xs text-muted-foreground">
                      Due: {formatCurrency(invoice.amount_due, invoice.currency)}
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-1 text-sm text-foreground">
                    <Calendar className="h-3 w-3" />
                    {new Date(invoice.due_date).toLocaleDateString()}
                  </div>
                </div>

                <div>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${statusColors[invoice.status]}`}
                    data-testid="invoice-status"
                  >
                    {invoice.status}
                  </span>
                </div>

                <div>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${invoice.payment_status ? paymentStatusColors[invoice.payment_status] ?? '' : ''}`}
                    data-testid="invoice-payment-status"
                  >
                    {invoice.payment_status || 'pending'}
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log('Download invoice:', invoice.invoice_id);
                    }}
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground mb-1">Total Invoices</div>
          <div className="text-2xl font-bold text-foreground">{invoices.length}</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground mb-1">Total Outstanding</div>
          <div className="text-2xl font-bold text-foreground">
            {formatCurrency(
              invoices.reduce((sum, inv) => sum + inv.amount_due, 0),
              'USD'
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground mb-1">Paid This Month</div>
          <div className="text-2xl font-bold text-foreground">
            {formatCurrency(
              invoices
                .filter(inv => inv.payment_status === 'paid')
                .reduce((sum, inv) => sum + inv.amount_paid, 0),
              'USD'
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
