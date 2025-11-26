"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@dotmac/ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import { useToast } from "@dotmac/ui";
import {
  CreditCard,
  DollarSign,
  Download,
  RefreshCw,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  Send,
  Loader2,
  FileText,
} from "lucide-react";
import { format } from "date-fns";
import {
  usePayments,
  usePaymentMetrics,
  type PaymentStatus,
  type PaymentFilters,
} from "@/hooks/usePaymentsGraphQL";
import { apiClient } from "@/lib/api/client";
import { handleApiError } from "@/lib/error-handler";
import { logger } from "@/lib/logger";

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: "succeeded" | "pending" | "failed" | "refunded" | "cancelled";
  customer_name: string;
  customer_email: string;
  payment_method: string;
  payment_method_type: "card" | "bank" | "wallet" | "other";
  description: string;
  invoice_id?: string | null;
  subscription_id?: string | null;
  created_at: string;
  processed_at?: string | null;
  failure_reason?: string | null;
  refund_amount?: number | null;
  fee_amount?: number | null;
  net_amount?: number | null;
  metadata?: Record<string, any> | null;
}

export default function PaymentsPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | undefined>(undefined);
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("last_30_days");
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [showRetryDialog, setShowRetryDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Calculate date filters
  const getDateFilters = () => {
    const now = new Date();
    if (dateRange === "last_7_days") {
      return {
        dateFrom: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      };
    } else if (dateRange === "last_30_days") {
      return {
        dateFrom: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      };
    } else if (dateRange === "last_90_days") {
      return {
        dateFrom: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      };
    }
    return {};
  };

  const dateFilters = getDateFilters();

  // Fetch payments using GraphQL with pagination
  const paymentFilters: PaymentFilters = {
    limit: pageSize,
    offset: (currentPage - 1) * pageSize,
    includeCustomer: true,
    includeInvoice: false,
    ...dateFilters,
    ...(statusFilter ? { status: statusFilter } : {}),
  };

  const {
    data: paymentsData,
    isLoading: paymentsLoading,
    error: paymentsError,
    refetch: refetchPayments,
  } = usePayments(paymentFilters, true);

  // Fetch payment metrics
  const { data: metricsData } = usePaymentMetrics({
    ...dateFilters,
    enabled: true,
  });

  // Transform payments data (filtering now happens on backend)
  const payments = (paymentsData?.payments || []).map((p) => ({
    id: p.id,
    amount: p.amount,
    currency: p.currency,
    status: p.status as Payment["status"],
    customer_name: p.customer?.name || "Unknown Customer",
    customer_email: p.customer?.email || "",
    payment_method: p.provider,
    payment_method_type: p.paymentMethodType as Payment["payment_method_type"],
    description: p.description || `Payment via ${p.provider}`,
    invoice_id: p.invoiceId || null,
    subscription_id: p.subscriptionId || null,
    created_at: p.createdAt,
    processed_at: p.processedAt || null,
    failure_reason: p.failureReason || null,
    refund_amount: p.refundAmount || null,
    fee_amount: p.feeAmount || null,
    net_amount: p.netAmount || null,
    metadata: p.metadata || null,
  }));

  // Calculate total pages
  const totalPayments = paymentsData?.totalCount || 0;
  const totalPages = Math.ceil(totalPayments / pageSize);

  // Metrics from GraphQL
  const metrics = {
    totalRevenue: metricsData?.totalRevenue || 0,
    totalPayments: metricsData?.totalPayments || 0,
    successRate: metricsData?.successRate || 0,
    avgPaymentSize: metricsData?.averagePaymentSize || 0,
    pendingAmount: metricsData?.pendingAmount || 0,
    failedAmount: metricsData?.failedAmount || 0,
  };

  const handleRefund = async () => {
    if (!selectedPayment || !refundAmount) {
      toast({
        title: "Error",
        description: "Please enter a refund amount",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(refundAmount);
    if (isNaN(amount) || amount <= 0 || amount > selectedPayment.amount) {
      toast({
        title: "Error",
        description: "Please enter a valid refund amount",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.post(`/billing/payments/${selectedPayment.id}/refund`, {
        amount,
        reason: refundReason,
      });

      logger.info("Payment refunded", {
        paymentId: selectedPayment.id,
        amount,
        reason: refundReason,
      });

      toast({
        title: "Success",
        description: `Refund of ${formatCurrency(amount, selectedPayment.currency)} processed successfully`,
      });

      setShowRefundDialog(false);
      setRefundAmount("");
      setRefundReason("");
      await refetchPayments();
    } catch (error) {
      logger.error("Failed to process refund", error);
      handleApiError(error, {
        userMessage: "Failed to process refund. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetryPayment = async () => {
    if (!selectedPayment) return;

    setIsSubmitting(true);
    try {
      await apiClient.post(`/billing/payments/${selectedPayment.id}/retry`);

      logger.info("Payment retry initiated", { paymentId: selectedPayment.id });

      toast({
        title: "Success",
        description: "Payment retry initiated successfully",
      });

      setShowRetryDialog(false);
      setSelectedPayment(null);
      await refetchPayments();
    } catch (error) {
      logger.error("Failed to retry payment", error);
      handleApiError(error, {
        userMessage: "Failed to retry payment. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportPayments = async (exportFormat: "csv" | "pdf") => {
    setIsExporting(true);
    try {
      const response = await apiClient.get(`/billing/payments/export`, {
        params: {
          format: exportFormat,
          status: statusFilter,
          payment_method: paymentMethodFilter !== "all" ? paymentMethodFilter : undefined,
          ...dateFilters,
        },
        responseType: "blob",
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      const dateStr = format(new Date(), "yyyy-MM-dd");
      link.setAttribute("download", `payments-${exportFormat}-${dateStr}.${exportFormat}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      logger.info("Payments exported", { format: exportFormat });

      toast({
        title: "Success",
        description: `Payments exported to ${exportFormat.toUpperCase()} successfully`,
      });
    } catch (error) {
      logger.error("Failed to export payments", error);
      handleApiError(error, {
        userMessage: "Failed to export payments. Please try again.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleSendReceipt = async () => {
    if (!selectedPayment) return;

    setIsSubmitting(true);
    try {
      await apiClient.post(`/billing/payments/${selectedPayment.id}/send-receipt`, {
        email: selectedPayment.customer_email,
      });

      logger.info("Receipt sent", {
        paymentId: selectedPayment.id,
        email: selectedPayment.customer_email,
      });

      toast({
        title: "Success",
        description: `Receipt sent to ${selectedPayment.customer_email}`,
      });
    } catch (error) {
      logger.error("Failed to send receipt", error);
      handleApiError(error, {
        userMessage: "Failed to send receipt. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      succeeded: {
        label: "Succeeded",
        variant: "default" as const,
        icon: CheckCircle,
      },
      pending: { label: "Pending", variant: "outline" as const, icon: Clock },
      failed: {
        label: "Failed",
        variant: "destructive" as const,
        icon: XCircle,
      },
      refunded: {
        label: "Refunded",
        variant: "secondary" as const,
        icon: ArrowDownRight,
      },
      cancelled: {
        label: "Cancelled",
        variant: "secondary" as const,
        icon: XCircle,
      },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getPaymentMethodIcon = (type: string) => {
    switch (type) {
      case "card":
        return <CreditCard className="h-4 w-4 text-muted-foreground" />;
      case "bank":
        return <DollarSign className="h-4 w-4 text-muted-foreground" />;
      case "wallet":
        return <CreditCard className="h-4 w-4 text-muted-foreground" />;
      default:
        return <DollarSign className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Payments</h1>
          <p className="text-muted-foreground">Track and manage payment transactions</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleExportPayments("csv")}
            disabled={isExporting}
          >
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => handleExportPayments("pdf")}
            disabled={isExporting}
          >
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Export PDF
              </>
            )}
          </Button>
          <Button onClick={() => refetchPayments()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.totalRevenue, "USD")}</div>
            <p className="text-xs text-muted-foreground flex items-center mt-1">
              <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
              From successful payments
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalPayments}</div>
            <p className="text-xs text-muted-foreground">All transactions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {metrics.successRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">Payment completion</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Payment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(metrics.avgPaymentSize, "USD")}
            </div>
            <p className="text-xs text-muted-foreground">Per transaction</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {formatCurrency(metrics.pendingAmount, "USD")}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting processing</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(metrics.failedAmount, "USD")}
            </div>
            <p className="text-xs text-muted-foreground">Requires attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Payment Transactions</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search payments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-[250px]"
                />
              </div>
              <select
                value={statusFilter || "all"}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value === "all" ? undefined : (e.target.value as PaymentStatus),
                  )
                }
                className="h-10 w-[150px] rounded-md border border-border bg-accent px-3 text-sm text-white"
              >
                <option value="all">All Status</option>
                <option value="SUCCEEDED">Succeeded</option>
                <option value="PENDING">Pending</option>
                <option value="FAILED">Failed</option>
                <option value="REFUNDED">Refunded</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              <select
                value={paymentMethodFilter}
                onChange={(e) => setPaymentMethodFilter(e.target.value)}
                className="h-10 w-[150px] rounded-md border border-border bg-accent px-3 text-sm text-white"
              >
                <option value="all">All Methods</option>
                <option value="card">Card</option>
                <option value="bank">Bank Transfer</option>
                <option value="wallet">Wallet</option>
                <option value="other">Other</option>
              </select>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="h-10 w-[150px] rounded-md border border-border bg-accent px-3 text-sm text-white"
              >
                <option value="last_7_days">Last 7 days</option>
                <option value="last_30_days">Last 30 days</option>
                <option value="last_90_days">Last 90 days</option>
                <option value="all_time">All time</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {paymentsLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 p-4 border rounded-lg animate-pulse"
                >
                  <div className="h-10 w-10 bg-muted rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-1/4" />
                    <div className="h-3 bg-muted rounded w-1/3" />
                  </div>
                  <div className="h-6 w-20 bg-muted rounded" />
                </div>
              ))}
            </div>
          ) : paymentsError ? (
            <div className="text-center py-8 text-destructive">
              Failed to load payments. Please try again.
              <Button variant="outline" className="mt-4" onClick={() => refetchPayments()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No payments found for the selected filters.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment Method</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <div className="font-mono text-sm">{payment.id}</div>
                      {payment.invoice_id && (
                        <div className="text-xs text-muted-foreground">
                          Invoice: {payment.invoice_id}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{payment.customer_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {payment.customer_email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {formatCurrency(payment.amount, payment.currency)}
                      </div>
                      {payment.net_amount != null && (
                        <div className="text-xs text-muted-foreground">
                          Net: {formatCurrency(payment.net_amount, payment.currency)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(payment.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {getPaymentMethodIcon(payment.payment_method_type)}
                        <span className="text-sm">{payment.payment_method}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm max-w-[200px] truncate" title={payment.description}>
                        {payment.description}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {format(new Date(payment.created_at), "MMM d, yyyy")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(payment.created_at), "h:mm a")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedPayment(payment);
                            setShowDetailDialog(true);
                          }}
                        >
                          View
                        </Button>
                        {payment.status === "succeeded" && !payment.refund_amount && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedPayment(payment);
                              setShowRefundDialog(true);
                            }}
                          >
                            Refund
                          </Button>
                        )}
                        {payment.status === "failed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedPayment(payment);
                              setShowRetryDialog(true);
                            }}
                          >
                            Retry
                          </Button>
                        )}
                        {payment.invoice_id && (
                          <Button size="sm" variant="outline" title="View Invoice">
                            <Receipt className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination Controls */}
      {!paymentsLoading && payments.length > 0 && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * pageSize + 1} to{" "}
            {Math.min(currentPage * pageSize, totalPayments)} of {totalPayments} payments
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <div className="text-sm">
              Page {currentPage} of {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Payment Detail Dialog */}
      {selectedPayment && (
        <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Payment Details</DialogTitle>
              <DialogDescription>
                {selectedPayment.id} •{" "}
                {format(new Date(selectedPayment.created_at), "MMM d, yyyy h:mm a")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedPayment.status)}</div>
                </div>
                <div>
                  <Label>Amount</Label>
                  <div className="mt-1 font-medium">
                    {formatCurrency(selectedPayment.amount, selectedPayment.currency)}
                  </div>
                </div>
                <div>
                  <Label>Customer</Label>
                  <div className="mt-1">
                    <div>{selectedPayment.customer_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {selectedPayment.customer_email}
                    </div>
                  </div>
                </div>
                <div>
                  <Label>Payment Method</Label>
                  <div className="mt-1 flex items-center gap-1">
                    {getPaymentMethodIcon(selectedPayment.payment_method_type)}
                    {selectedPayment.payment_method}
                  </div>
                </div>
                <div className="col-span-2">
                  <Label>Description</Label>
                  <div className="mt-1 text-sm">{selectedPayment.description}</div>
                </div>
                {selectedPayment.failure_reason && (
                  <div className="col-span-2">
                    <Label>Failure Reason</Label>
                    <div className="mt-1 text-sm text-red-600">
                      {selectedPayment.failure_reason}
                    </div>
                  </div>
                )}
                {(selectedPayment.fee_amount != null || selectedPayment.net_amount != null) && (
                  <>
                    {selectedPayment.fee_amount != null && (
                      <div>
                        <Label>Processing Fee</Label>
                        <div className="mt-1">
                          {formatCurrency(selectedPayment.fee_amount, selectedPayment.currency)}
                        </div>
                      </div>
                    )}
                    {selectedPayment.net_amount != null && (
                      <div>
                        <Label>Net Amount</Label>
                        <div className="mt-1 font-medium">
                          {formatCurrency(selectedPayment.net_amount, selectedPayment.currency)}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {selectedPayment.invoice_id && (
                <div className="p-3 bg-accent rounded-md">
                  <div className="text-sm">
                    <strong>Related Invoice:</strong> {selectedPayment.invoice_id}
                  </div>
                  {selectedPayment.subscription_id && (
                    <div className="text-sm mt-1">
                      <strong>Subscription:</strong> {selectedPayment.subscription_id}
                    </div>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowDetailDialog(false)}
                disabled={isSubmitting}
              >
                Close
              </Button>
              <Button onClick={handleSendReceipt} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Receipt
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Refund Dialog */}
      {selectedPayment && (
        <Dialog open={showRefundDialog} onOpenChange={setShowRefundDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Process Refund</DialogTitle>
              <DialogDescription>Refund payment {selectedPayment.id}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Original Amount</Label>
                <div className="mt-1 font-medium">
                  {formatCurrency(selectedPayment.amount, selectedPayment.currency)}
                </div>
              </div>
              <div>
                <Label>Refund Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  max={selectedPayment.amount}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  placeholder={selectedPayment.amount.toString()}
                />
              </div>
              <div>
                <Label>Reason for Refund</Label>
                <Textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Optional: Provide a reason for the refund"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowRefundDialog(false);
                  setRefundAmount("");
                  setRefundReason("");
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button onClick={handleRefund} variant="destructive" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Process Refund"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Retry Payment Dialog */}
      {selectedPayment && (
        <AlertDialog open={showRetryDialog} onOpenChange={setShowRetryDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Retry Failed Payment</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to retry payment{" "}
                <span className="font-semibold">{selectedPayment.id}</span>?
                <br />
                <br />
                This will attempt to process the payment again using the same payment method.
                {selectedPayment.failure_reason && (
                  <>
                    <br />
                    <br />
                    <strong>Previous failure reason:</strong> {selectedPayment.failure_reason}
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleRetryPayment} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  "Retry Payment"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
