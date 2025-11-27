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
  Receipt,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  DollarSign,
  Calendar,
} from "lucide-react";
import { useCommissionEvents } from "@/hooks/usePartnerRevenue";
import type { CommissionStatus } from "@/lib/services/partner-revenue-service";

export function CommissionsTab() {
  const [statusFilter, setStatusFilter] = useState<CommissionStatus | "all">("all");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data: commissions, isLoading } = useCommissionEvents({
    status: statusFilter !== "all" ? statusFilter : undefined,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  const getStatusBadge = (status: CommissionStatus) => {
    const config = {
      pending: {
        variant: "secondary" as const,
        icon: Clock,
        color: "text-yellow-600",
      },
      approved: {
        variant: "default" as const,
        icon: CheckCircle2,
        color: "text-blue-600",
      },
      paid: {
        variant: "default" as const,
        icon: CheckCircle2,
        color: "text-green-600",
      },
      rejected: {
        variant: "destructive" as const,
        icon: XCircle,
        color: "text-red-600",
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
  const totalAmount = commissions?.reduce((sum, c) => sum + c.commission_amount, 0) || 0;
  const pendingAmount =
    commissions
      ?.filter((c) => c.status === "pending")
      .reduce((sum, c) => sum + c.commission_amount, 0) || 0;
  const approvedAmount =
    commissions
      ?.filter((c) => c.status === "approved")
      .reduce((sum, c) => sum + c.commission_amount, 0) || 0;
  const paidAmount =
    commissions
      ?.filter((c) => c.status === "paid")
      .reduce((sum, c) => sum + c.commission_amount, 0) || 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Commissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-purple-500" />
              <span className="text-2xl font-bold">{formatCurrency(totalAmount)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">{commissions?.length || 0} events</p>
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
            <p className="text-xs text-muted-foreground mt-2">Awaiting approval</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-blue-500" />
              <span className="text-2xl font-bold">{formatCurrency(approvedAmount)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Ready for payout</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-2xl font-bold">{formatCurrency(paidAmount)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Paid out</p>
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
                  setStatusFilter(value as CommissionStatus | "all");
                  setPage(1);
                }}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Commissions Table */}
      {!commissions || commissions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Commissions Found</h3>
            <p className="text-sm text-muted-foreground text-center">
              {statusFilter !== "all"
                ? "No commissions match your filters. Try adjusting your criteria."
                : "You don&apos;t have any commission events yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Commission Events</CardTitle>
            <CardDescription>All commission events for your partnership</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Base Amount</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payout</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commissions.map((commission) => (
                    <TableRow key={commission.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {new Date(commission.event_date).toLocaleDateString()}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {commission.event_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {commission.base_amount
                          ? formatCurrency(commission.base_amount, commission.currency)
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {commission.commission_rate
                          ? `${(commission.commission_rate * 100).toFixed(2)}%`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3 text-muted-foreground" />
                          <span className="font-semibold">
                            {formatCurrency(commission.commission_amount, commission.currency)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(commission.status)}</TableCell>
                      <TableCell>
                        {commission.payout_id ? (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Included
                          </Badge>
                        ) : (
                          <Badge variant="outline">Pending</Badge>
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

      {/* Pagination */}
      {commissions && commissions.length >= pageSize && (
        <div className="flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, commissions.length)}{" "}
            commissions
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPage(page - 1)} disabled={page === 1}>
              Previous
            </Button>
            <Button
              variant="outline"
              onClick={() => setPage(page + 1)}
              disabled={commissions.length < pageSize}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
