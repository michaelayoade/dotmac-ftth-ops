"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Skeleton } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import {
  Plus,
  Receipt,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  FileText,
  Download,
  DollarSign,
  Calendar,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import { useManualPayments, useVerifyPayment } from "@/hooks/useBankAccounts";
import type {
  ManualPaymentResponse,
  PaymentMethodType,
  PaymentSearchFilters,
} from "@/lib/services/bank-accounts-service";
import { PaymentRecordDialog } from "./PaymentRecordDialog";
import { format } from "date-fns";

export function ManualPaymentsTab() {
  const [showRecordDialog, setShowRecordDialog] = useState(false);
  const [filters, setFilters] = useState({
    status: "all",
    method: "all",
    search: "",
    startDate: "",
    endDate: "",
  });

  const manualPaymentFilters: PaymentSearchFilters = {
    ...(filters.status !== "all" && { status: filters.status }),
    ...(filters.method !== "all" && {
      payment_method: filters.method as PaymentMethodType,
    }),
    ...(filters.search && { search: filters.search }),
    ...(filters.startDate && { date_from: filters.startDate }),
    ...(filters.endDate && { date_to: filters.endDate }),
  };

  const { data: payments, isLoading } = useManualPayments(manualPaymentFilters);

  const verifyPayment = useVerifyPayment();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "cancelled":
        return <XCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      completed: "default",
      pending: "secondary",
      failed: "destructive",
      cancelled: "outline",
      processing: "secondary",
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || "outline"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getMethodBadge = (method: string) => {
    const labels: Record<string, string> = {
      bank_transfer: "Bank Transfer",
      wire_transfer: "Wire Transfer",
      ach: "ACH",
      cash: "Cash",
      check: "Check",
      money_order: "Money Order",
      mobile_money: "Mobile Money",
      crypto: "Crypto",
      other: "Other",
    };

    return <Badge variant="outline">{labels[method] || method}</Badge>;
  };

  const handleVerify = async (paymentId: number) => {
    await verifyPayment.mutateAsync({
      paymentId,
      verificationNotes: "Verified via banking dashboard",
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Manual Payments</h2>
          <p className="text-sm text-muted-foreground">
            Record and manage manual payments received outside of automated systems
          </p>
        </div>
        <Button onClick={() => setShowRecordDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Record Payment
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Reference, customer..."
                  className="pl-8"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={filters.status}
                onValueChange={(value) => setFilters({ ...filters, status: value })}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="method">Payment Method</Label>
              <Select
                value={filters.method}
                onValueChange={(value) => setFilters({ ...filters, method: value })}
              >
                <SelectTrigger id="method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="mobile_money">Mobile Money</SelectItem>
                  <SelectItem value="wire_transfer">Wire Transfer</SelectItem>
                  <SelectItem value="ach">ACH</SelectItem>
                  <SelectItem value="money_order">Money Order</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              />
            </div>
          </div>

          {(filters.search ||
            filters.status !== "all" ||
            filters.method !== "all" ||
            filters.startDate ||
            filters.endDate) && (
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setFilters({
                    status: "all",
                    method: "all",
                    search: "",
                    startDate: "",
                    endDate: "",
                  })
                }
              >
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payments Table */}
      {!payments || payments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Payments Found</h3>
            <p className="text-sm text-muted-foreground text-center mb-4">
              {filters.search || filters.status !== "all" || filters.method !== "all"
                ? "No payments match your filters. Try adjusting your search criteria."
                : "Record your first manual payment to get started."}
            </p>
            <Button onClick={() => setShowRecordDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Record Payment
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payments ({payments.length})</CardTitle>
            <CardDescription>All manual payments recorded in the system</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reconciled</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {format(new Date(payment.payment_date), "MMM d, yyyy")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(payment.status)}
                          <span className="font-mono text-sm">{payment.payment_reference}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{payment.customer_id || "N/A"}</p>
                          <p className="text-xs text-muted-foreground">
                            {payment.external_reference || ""}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{getMethodBadge(payment.payment_method)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3 text-muted-foreground" />
                          <span className="font-semibold">
                            {payment.currency} {payment.amount.toFixed(2)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(payment.status)}</TableCell>
                      <TableCell>
                        {payment.reconciled ? (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Reconciled
                          </Badge>
                        ) : (
                          <Badge variant="outline">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {payment.status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleVerify(payment.id)}
                              disabled={verifyPayment.isPending}
                            >
                              Verify
                            </Button>
                          )}
                          {payment.receipt_url && (
                            <Button size="sm" variant="ghost" asChild>
                              <a
                                href={payment.receipt_url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <FileText className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <PaymentRecordDialog
        open={showRecordDialog}
        onOpenChange={setShowRecordDialog}
        onSuccess={() => setShowRecordDialog(false)}
      />
    </div>
  );
}
