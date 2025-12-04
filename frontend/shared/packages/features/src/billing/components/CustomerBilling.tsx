"use client";

import { useToast } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import {
  DollarSign,
  FileText,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";

// ============================================================================
// Types
// ============================================================================

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  status: "paid" | "pending" | "overdue" | "cancelled";
  due_date: string;
  paid_date?: string;
  created_at: string;
}

interface Payment {
  id: string;
  payment_method: string;
  amount: number;
  status: "succeeded" | "failed" | "pending";
  created_at: string;
  invoice_id?: string;
}

export interface BillingSummary {
  total_revenue: number;
  outstanding_balance: number;
  overdue_amount: number;
  last_payment_date?: string;
  last_payment_amount?: number;
  payment_method?: string;
}

export interface CustomerBillingApiClient {
  get: <T = any>(url: string, config?: any) => Promise<{ data: T }>;
}

export interface CustomerBillingProps {
  customerId: string;
  apiClient: CustomerBillingApiClient;
  useToast: () => { toast: (options: any) => void };
  invoiceViewUrlPrefix: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

const getInvoiceStatusBadge = (status: Invoice["status"]) => {
  switch (status) {
    case "paid":
      return (
        <Badge className="bg-green-500">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Paid
        </Badge>
      );
    case "pending":
      return (
        <Badge className="bg-blue-500">
          <Clock className="w-3 h-3 mr-1" />
          Pending
        </Badge>
      );
    case "overdue":
      return (
        <Badge variant="destructive">
          <AlertCircle className="w-3 h-3 mr-1" />
          Overdue
        </Badge>
      );
    case "cancelled":
      return <Badge variant="secondary">Cancelled</Badge>;
  }
};

const getPaymentStatusBadge = (status: Payment["status"]) => {
  switch (status) {
    case "succeeded":
      return <Badge className="bg-green-500">Succeeded</Badge>;
    case "failed":
      return <Badge variant="destructive">Failed</Badge>;
    case "pending":
      return <Badge className="bg-blue-500">Pending</Badge>;
  }
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

// ============================================================================
// Component
// ============================================================================

export default function CustomerBilling({
  customerId,
  apiClient,
  useToast,
  invoiceViewUrlPrefix,
}: CustomerBillingProps) {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBillingData = useCallback(async () => {
    try {
      setLoading(true);
      const [invoicesRes, paymentsRes, summaryRes] = await Promise.all([
        apiClient.get<{ invoices: Invoice[] }>(`/api/isp/v1/admin/customers/${customerId}/invoices`),
        apiClient.get<{ payments: Payment[] }>(`/api/isp/v1/admin/customers/${customerId}/payments`),
        apiClient.get<BillingSummary>(`/api/isp/v1/admin/customers/${customerId}/billing-summary`),
      ]);

      setInvoices(invoicesRes.data.invoices);
      setPayments(paymentsRes.data.payments);
      setSummary(summaryRes.data);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to load billing information",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [customerId, toast, apiClient]);

  useEffect(() => {
    fetchBillingData();
  }, [fetchBillingData]);

  const handleDownloadInvoice = async (invoiceId: string) => {
    try {
      const response = await apiClient.get(`/api/isp/v1/admin/invoices/${invoiceId}/download`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `invoice-${invoiceId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to download invoice",
        variant: "destructive",
      });
    }
  };

  const handleViewInvoice = (invoiceId: string) => {
    window.open(`${invoiceViewUrlPrefix}/${invoiceId}`, "_blank");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading billing information...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Billing Summary */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Total Revenue</p>
                  <p className="text-2xl font-bold text-white">
                    {formatCurrency(summary.total_revenue)}
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Outstanding</p>
                  <p className="text-2xl font-bold text-white">
                    {formatCurrency(summary.outstanding_balance)}
                  </p>
                </div>
                <FileText className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Overdue</p>
                  <p className="text-2xl font-bold text-white">
                    {formatCurrency(summary.overdue_amount)}
                  </p>
                </div>
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Last Payment</p>
                  <p className="text-lg font-bold text-white">
                    {summary.last_payment_amount
                      ? formatCurrency(summary.last_payment_amount)
                      : "N/A"}
                  </p>
                  {summary.last_payment_date && (
                    <p className="text-xs text-slate-500">
                      {formatDate(summary.last_payment_date)}
                    </p>
                  )}
                </div>
                <CreditCard className="w-8 h-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Invoices */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h4 className="text-lg font-semibold text-white mb-4">Invoices</h4>
        {invoices.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">No invoices found</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-slate-400">Invoice #</TableHead>
                <TableHead className="text-slate-400">Amount</TableHead>
                <TableHead className="text-slate-400">Status</TableHead>
                <TableHead className="text-slate-400">Due Date</TableHead>
                <TableHead className="text-slate-400">Paid Date</TableHead>
                <TableHead className="text-slate-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id} className="border-slate-700">
                  <TableCell className="font-medium text-white font-mono">
                    {invoice.invoice_number}
                  </TableCell>
                  <TableCell className="text-white font-semibold">
                    {formatCurrency(invoice.amount)}
                  </TableCell>
                  <TableCell>{getInvoiceStatusBadge(invoice.status)}</TableCell>
                  <TableCell className="text-slate-300">{formatDate(invoice.due_date)}</TableCell>
                  <TableCell className="text-slate-300">
                    {invoice.paid_date ? formatDate(invoice.paid_date) : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewInvoice(invoice.id)}
                        title="View Invoice"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownloadInvoice(invoice.id)}
                        title="Download PDF"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Payment History */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h4 className="text-lg font-semibold text-white mb-4">Payment History</h4>
        {payments.length === 0 ? (
          <div className="text-center py-8">
            <CreditCard className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">No payments found</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-slate-400">Date</TableHead>
                <TableHead className="text-slate-400">Amount</TableHead>
                <TableHead className="text-slate-400">Method</TableHead>
                <TableHead className="text-slate-400">Status</TableHead>
                <TableHead className="text-slate-400">Invoice</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id} className="border-slate-700">
                  <TableCell className="text-slate-300">{formatDate(payment.created_at)}</TableCell>
                  <TableCell className="text-white font-semibold">
                    {formatCurrency(payment.amount)}
                  </TableCell>
                  <TableCell className="text-slate-300 capitalize">
                    {payment.payment_method}
                  </TableCell>
                  <TableCell>{getPaymentStatusBadge(payment.status)}</TableCell>
                  <TableCell className="text-slate-300">
                    {payment.invoice_id ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewInvoice(payment.invoice_id!)}
                      >
                        View Invoice
                      </Button>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
