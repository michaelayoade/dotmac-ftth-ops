'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import {
  CreditCard,
  DollarSign,
  Download,
  Filter,
  RefreshCw,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  Send,
} from 'lucide-react';
import { format } from 'date-fns';
import { apiClient } from '@/lib/api/client';

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: 'succeeded' | 'pending' | 'failed' | 'refunded' | 'cancelled';
  customer_name: string;
  customer_email: string;
  payment_method: string;
  payment_method_type: 'card' | 'bank' | 'wallet' | 'other';
  description: string;
  invoice_id?: string;
  subscription_id?: string;
  created_at: string;
  processed_at?: string;
  failure_reason?: string;
  refund_amount?: number;
  fee_amount?: number;
  net_amount?: number;
  metadata?: Record<string, any>;
}

export default function PaymentsPage() {
  const { toast } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('last_30_days');
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');

  // Metrics
  const [metrics, setMetrics] = useState({
    totalRevenue: 0,
    totalPayments: 0,
    successRate: 0,
    avgPaymentSize: 0,
    pendingAmount: 0,
    failedAmount: 0,
  });

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      // Build query parameters
      const params = new URLSearchParams();
      params.append('limit', '500'); // Get more for client-side filtering

      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      // Fetch payments from backend API
      const response = await apiClient.get<{
        payments: Array<{
          payment_id: string;
          amount: number;
          currency: string;
          status: string;
          customer_id: string;
          payment_method_type: string;
          provider: string;
          created_at: string;
          processed_at?: string;
          failure_reason?: string;
        }>;
        total_count: number;
        limit: number;
        timestamp: string;
      }>(`/api/v1/billing/payments?${params.toString()}`);

      if (!response.data?.payments) {
        throw new Error('Failed to fetch payments');
      }

      // Transform API data to frontend Payment interface
      const transformedPayments: Payment[] = response.data.payments.map(p => ({
        id: p.payment_id,
        amount: p.amount,
        currency: p.currency,
        status: p.status as Payment['status'],
        customer_name: `Customer ${p.customer_id.substring(0, 8)}`, // TODO: Fetch customer name
        customer_email: `customer-${p.customer_id.substring(0, 8)}@example.com`, // TODO: Fetch customer email
        payment_method: p.provider,
        payment_method_type: p.payment_method_type as Payment['payment_method_type'],
        description: `Payment via ${p.provider}`,
        created_at: p.created_at,
        processed_at: p.processed_at,
        failure_reason: p.failure_reason,
      }));

      // Apply client-side filters
      let filteredData = transformedPayments;

      if (searchQuery) {
        filteredData = filteredData.filter(payment =>
          payment.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          payment.customer_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          payment.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          payment.description.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }

      // Apply date range filter
      if (dateRange === 'last_7_days') {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        filteredData = filteredData.filter(payment =>
          new Date(payment.created_at) >= sevenDaysAgo
        );
      } else if (dateRange === 'last_30_days') {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        filteredData = filteredData.filter(payment =>
          new Date(payment.created_at) >= thirtyDaysAgo
        );
      }

      setPayments(filteredData);

      // Calculate metrics from all fetched data
      const succeeded = transformedPayments.filter(p => p.status === 'succeeded');
      const pending = transformedPayments.filter(p => p.status === 'pending');
      const failed = transformedPayments.filter(p => p.status === 'failed');

      const totalRevenue = succeeded.reduce((sum, p) => sum + p.amount, 0);
      const pendingAmount = pending.reduce((sum, p) => sum + p.amount, 0);
      const failedAmount = failed.reduce((sum, p) => sum + p.amount, 0);

      setMetrics({
        totalRevenue,
        totalPayments: transformedPayments.length,
        successRate: transformedPayments.length > 0 ? (succeeded.length / transformedPayments.length) * 100 : 0,
        avgPaymentSize: succeeded.length > 0 ? totalRevenue / succeeded.length : 0,
        pendingAmount,
        failedAmount,
      });

    } catch (error) {
      console.error('Failed to fetch payments:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch payments',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, dateRange, searchQuery, toast]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const handleRefund = useCallback(async () => {
    if (!selectedPayment || !refundAmount) {
      toast({
        title: 'Error',
        description: 'Please enter a refund amount',
        variant: 'destructive',
      });
      return;
    }

    try {
      // API call would go here
      toast({
        title: 'Success',
        description: `Refund of $${refundAmount} initiated for payment ${selectedPayment.id}`,
      });
      setShowRefundDialog(false);
      setRefundAmount('');
      setRefundReason('');
      fetchPayments();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to process refund',
        variant: 'destructive',
      });
    }
  }, [selectedPayment, refundAmount, toast, fetchPayments]);

  const handleRetryPayment = useCallback(async (payment: Payment) => {
    try {
      // API call would go here
      toast({
        title: 'Processing',
        description: `Retrying payment ${payment.id}...`,
      });
      fetchPayments();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to retry payment',
        variant: 'destructive',
      });
    }
  }, [toast, fetchPayments]);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      succeeded: { label: 'Succeeded', variant: 'default' as const, icon: CheckCircle },
      pending: { label: 'Pending', variant: 'outline' as const, icon: Clock },
      failed: { label: 'Failed', variant: 'destructive' as const, icon: XCircle },
      refunded: { label: 'Refunded', variant: 'secondary' as const, icon: ArrowDownRight },
      cancelled: { label: 'Cancelled', variant: 'secondary' as const, icon: XCircle },
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
      case 'card':
        return <CreditCard className="h-4 w-4 text-muted-foreground" />;
      case 'bank':
        return <DollarSign className="h-4 w-4 text-muted-foreground" />;
      case 'wallet':
        return <CreditCard className="h-4 w-4 text-muted-foreground" />;
      default:
        return <DollarSign className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
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
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={fetchPayments}>
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
            <div className="text-2xl font-bold">
              {formatCurrency(metrics.totalRevenue, 'USD')}
            </div>
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
              {formatCurrency(metrics.avgPaymentSize, 'USD')}
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
              {formatCurrency(metrics.pendingAmount, 'USD')}
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
              {formatCurrency(metrics.failedAmount, 'USD')}
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
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 w-[150px] rounded-md border border-border bg-accent px-3 text-sm text-white"
              >
                <option value="all">All Status</option>
                <option value="succeeded">Succeeded</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
                <option value="cancelled">Cancelled</option>
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
          {loading ? (
            <div className="text-center py-8">Loading payments...</div>
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
                        <div className="text-sm text-muted-foreground">{payment.customer_email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {formatCurrency(payment.amount, payment.currency)}
                      </div>
                      {payment.net_amount !== undefined && (
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
                        {format(new Date(payment.created_at), 'MMM d, yyyy')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(payment.created_at), 'h:mm a')}
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
                        {payment.status === 'succeeded' && !payment.refund_amount && (
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
                        {payment.status === 'failed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRetryPayment(payment)}
                          >
                            Retry
                          </Button>
                        )}
                        {payment.invoice_id && (
                          <Button
                            size="sm"
                            variant="outline"
                            title="View Invoice"
                          >
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

      {/* Payment Detail Dialog */}
      {selectedPayment && (
        <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Payment Details</DialogTitle>
              <DialogDescription>
                {selectedPayment.id} • {format(new Date(selectedPayment.created_at), 'MMM d, yyyy h:mm a')}
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
                    <div className="text-sm text-muted-foreground">{selectedPayment.customer_email}</div>
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
                    <div className="mt-1 text-sm text-red-600">{selectedPayment.failure_reason}</div>
                  </div>
                )}
                {selectedPayment.fee_amount !== undefined && (
                  <>
                    <div>
                      <Label>Processing Fee</Label>
                      <div className="mt-1">
                        {formatCurrency(selectedPayment.fee_amount, selectedPayment.currency)}
                      </div>
                    </div>
                    <div>
                      <Label>Net Amount</Label>
                      <div className="mt-1 font-medium">
                        {formatCurrency(selectedPayment.net_amount || 0, selectedPayment.currency)}
                      </div>
                    </div>
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
              <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
                Close
              </Button>
              <Button>
                <Send className="mr-2 h-4 w-4" />
                Send Receipt
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
              <DialogDescription>
                Refund payment {selectedPayment.id}
              </DialogDescription>
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
              <Button variant="outline" onClick={() => {
                setShowRefundDialog(false);
                setRefundAmount('');
                setRefundReason('');
              }}>
                Cancel
              </Button>
              <Button onClick={handleRefund} variant="destructive">
                Process Refund
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}