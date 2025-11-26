"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Skeleton } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import {
  Wallet,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  DollarSign,
  Calendar,
  Receipt,
} from "lucide-react";
import { usePayouts } from "@/hooks/usePartnerRevenue";
import type { PayoutStatus } from "@/lib/services/partner-revenue-service";

export function PayoutsTab() {
  const [statusFilter, setStatusFilter] = useState<PayoutStatus | "all">("all");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data: payouts, isLoading } = usePayouts({
    status: statusFilter !== "all" ? statusFilter : undefined,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  const getStatusBadge = (status: PayoutStatus) => {
    const config = {
      pending: {
        variant: "secondary" as const,
        icon: Clock,
        color: "text-yellow-600",
      },
      ready: {
        variant: "default" as const,
        icon: CheckCircle2,
        color: "text-blue-600",
      },
      processing: {
        variant: "default" as const,
        icon: AlertCircle,
        color: "text-purple-600",
      },
      completed: {
        variant: "default" as const,
        icon: CheckCircle2,
        color: "text-green-600",
      },
      failed: {
        variant: "destructive" as const,
        icon: XCircle,
        color: "text-red-600",
      },
      cancelled: {
        variant: "outline" as const,
        icon: XCircle,
        color: "text-gray-600",
      },
    };

    const { variant, icon: Icon, color } = config[status];

    return (
      <Badge variant={variant} className="gap-1">
        <Icon className={`h-3 w-3 ${color}`} />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const formatCurrency = (amount: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // Calculate totals
  const totalAmount = payouts?.reduce((sum, p) => sum + p.total_amount, 0) || 0;
  const completedAmount =
    payouts?.filter((p) => p.status === "completed").reduce((sum, p) => sum + p.total_amount, 0) ||
    0;
  const pendingAmount =
    payouts
      ?.filter((p) => p.status === "pending" || p.status === "ready")
      .reduce((sum, p) => sum + p.total_amount, 0) || 0;
  const processingAmount =
    payouts?.filter((p) => p.status === "processing").reduce((sum, p) => sum + p.total_amount, 0) ||
    0;

  const completedCount = payouts?.filter((p) => p.status === "completed").length || 0;
  const failedCount = payouts?.filter((p) => p.status === "failed").length || 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Payouts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-purple-500" />
              <span className="text-2xl font-bold">{formatCurrency(totalAmount)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">{payouts?.length || 0} payouts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-2xl font-bold">{formatCurrency(completedAmount)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">{completedCount} payouts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              <span className="text-2xl font-bold">{formatCurrency(pendingAmount)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Awaiting processing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Processing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-blue-500" />
              <span className="text-2xl font-bold">{formatCurrency(processingAmount)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">In progress</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value as PayoutStatus | "all");
                  setPage(1);
                }}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="ready">Ready</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payouts Table */}
      {!payouts || payouts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Payouts Found</h3>
            <p className="text-sm text-muted-foreground text-center">
              {statusFilter !== "all"
                ? "No payouts match your filters. Try adjusting your criteria."
                : "You don&apos;t have any payouts yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payout History</CardTitle>
            <CardDescription>All payouts processed for your partnership</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payout Date</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Commissions</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.map((payout) => (
                    <TableRow key={payout.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {new Date(payout.payout_date).toLocaleDateString()}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{new Date(payout.period_start).toLocaleDateString()}</p>
                          <p className="text-xs text-muted-foreground">
                            to {new Date(payout.period_end).toLocaleDateString()}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Receipt className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">{payout.commission_count}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3 text-muted-foreground" />
                          <span className="font-semibold">
                            {formatCurrency(payout.total_amount, payout.currency)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {payout.payment_method}
                        </Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(payout.status)}</TableCell>
                      <TableCell>
                        {payout.payment_reference ? (
                          <span className="text-sm font-mono">{payout.payment_reference}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Failed Payouts Warning */}
      {failedCount > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              Failed Payouts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              You have {failedCount} failed payout{failedCount > 1 ? "s" : ""}. Please contact
              support to resolve payment issues.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {payouts && payouts.length >= pageSize && (
        <div className="flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, payouts.length)}{" "}
            payouts
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPage(page - 1)} disabled={page === 1}>
              Previous
            </Button>
            <Button
              variant="outline"
              onClick={() => setPage(page + 1)}
              disabled={payouts.length < pageSize}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
