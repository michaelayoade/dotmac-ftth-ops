"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Skeleton } from "@dotmac/ui";
import { DollarSign, TrendingUp, Clock, CheckCircle2, Calendar, RefreshCw } from "lucide-react";
import { useRevenueMetrics, useRevenueStatistics } from "@/hooks/usePartnerRevenue";

export function RevenueMetricsTab() {
  const [period, setPeriod] = useState({
    start: new Date(new Date().setDate(1)).toISOString().split("T")[0], // First day of month
    end: new Date().toISOString().split("T")[0], // Today
  });

  const {
    data: metrics,
    isLoading,
    error,
    refetch,
  } = useRevenueMetrics({
    period_start: `${period.start}T00:00:00Z`,
    period_end: `${period.end}T23:59:59Z`,
  });

  const { statistics, isLoading: isLoadingStats } = useRevenueStatistics({
    period_start: `${period.start}T00:00:00Z`,
    period_end: `${period.end}T23:59:59Z`,
  });

  const handleRefresh = () => {
    refetch();
  };

  if (isLoading || isLoadingStats) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-destructive mb-4">Failed to load revenue metrics</p>
          <Button onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: metrics?.currency || "USD",
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select Period</CardTitle>
          <CardDescription>Choose the date range for revenue metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="period_start">Start Date</Label>
              <Input
                id="period_start"
                type="date"
                value={period.start}
                onChange={(e) => setPeriod({ ...period, start: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="period_end">End Date</Label>
              <Input
                id="period_end"
                type="date"
                value={period.end}
                onChange={(e) => setPeriod({ ...period, end: e.target.value })}
              />
            </div>

            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Primary Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Commissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-500" />
              <span className="text-2xl font-bold">
                {formatCurrency(metrics?.total_commissions || 0)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {metrics?.total_commission_count || 0} events
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Payouts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-blue-500" />
              <span className="text-2xl font-bold">
                {formatCurrency(metrics?.total_payouts || 0)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {statistics.completedPayoutsCount} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Amount
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" />
              <span className="text-2xl font-bold">
                {formatCurrency(metrics?.pending_amount || 0)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Awaiting payout</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Payout Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-purple-500" />
              <span className="text-2xl font-bold">
                {metrics?.total_commissions
                  ? ((metrics.total_payouts / metrics.total_commissions) * 100).toFixed(1)
                  : 0}
                %
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Commissions paid out</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Commission Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Approved</span>
              <span className="font-semibold">
                {formatCurrency(statistics.approvedCommissions)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Pending</span>
              <span className="font-semibold">{formatCurrency(statistics.pendingCommissions)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Paid</span>
              <span className="font-semibold">{formatCurrency(statistics.paidCommissions)}</span>
            </div>
            <div className="border-t pt-4 flex justify-between items-center">
              <span className="font-medium">Total</span>
              <span className="text-lg font-bold">
                {formatCurrency(
                  statistics.approvedCommissions +
                    statistics.pendingCommissions +
                    statistics.paidCommissions,
                )}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payout Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Completed</span>
              <span className="font-semibold">
                {formatCurrency(statistics.completedPayouts)} ({statistics.completedPayoutsCount})
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Pending</span>
              <span className="font-semibold">{formatCurrency(statistics.pendingPayouts)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Processing</span>
              <span className="font-semibold">{formatCurrency(statistics.processingPayouts)}</span>
            </div>
            <div className="border-t pt-4 flex justify-between items-center">
              <span className="font-medium">Failed</span>
              <span className="text-lg font-semibold text-destructive">
                {statistics.failedPayoutsCount} payouts
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Period Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Period Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Period:</span>
              <p className="font-medium mt-1">
                {period.start && new Date(period.start).toLocaleDateString()} -{" "}
                {period.end && new Date(period.end).toLocaleDateString()}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Commission Events:</span>
              <p className="font-medium mt-1">{metrics?.total_commission_count || 0}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Average Commission:</span>
              <p className="font-medium mt-1">
                {metrics?.total_commission_count
                  ? formatCurrency(metrics.total_commissions / metrics.total_commission_count)
                  : formatCurrency(0)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
