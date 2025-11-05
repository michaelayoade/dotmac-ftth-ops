"use client";

import { useDashboardData } from "@/lib/graphql/graphql-hooks";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Alert, AlertDescription, AlertTitle } from "@dotmac/ui";
import {
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Activity,
  Server,
  CreditCard,
  UserCheck,
} from "lucide-react";

export function UnifiedAdminDashboard() {
  const { data, loading, error } = useDashboardData();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading dashboard data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error loading dashboard</AlertTitle>
        <AlertDescription>{error.message || "Failed to fetch dashboard data"}</AlertDescription>
      </Alert>
    );
  }

  const tenantMetrics = data?.tenantMetrics;
  const paymentMetrics = data?.paymentMetrics;
  const customerMetrics = data?.customerMetrics;

  return (
    <div className="space-y-6">
      {/* Top-level metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* MRR */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Monthly Recurring Revenue
              </CardTitle>
              <DollarSign className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${tenantMetrics?.monthlyRecurringRevenue?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {tenantMetrics?.growthRate !== undefined && (
                <span className="flex items-center gap-1">
                  {tenantMetrics.growthRate >= 0 ? (
                    <>
                      <TrendingUp className="w-3 h-3 text-green-600" />
                      <span className="text-green-600">
                        +{tenantMetrics.growthRate.toFixed(1)}%
                      </span>
                    </>
                  ) : (
                    <>
                      <TrendingDown className="w-3 h-3 text-red-600" />
                      <span className="text-red-600">{tenantMetrics.growthRate.toFixed(1)}%</span>
                    </>
                  )}
                  <span className="ml-1">from last period</span>
                </span>
              )}
            </p>
          </CardContent>
        </Card>

        {/* Active Tenants */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Tenants
              </CardTitle>
              <Server className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tenantMetrics?.activeTenants || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              of {tenantMetrics?.totalTenants || 0} total tenants
            </p>
          </CardContent>
        </Card>

        {/* Active Customers */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Customers
              </CardTitle>
              <UserCheck className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {customerMetrics?.activeCustomers?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {customerMetrics?.newCustomersThisMonth || 0} new this month
            </p>
          </CardContent>
        </Card>

        {/* Payment Success Rate */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Payment Success Rate
              </CardTitle>
              <CreditCard className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {paymentMetrics?.successRate?.toFixed(1) || 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {paymentMetrics?.successfulPayments || 0} of {paymentMetrics?.totalPayments || 0}{" "}
              succeeded
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue & Tenant Health */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Revenue Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Overview</CardTitle>
            <CardDescription>Breakdown of payment activity and totals</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total Amount</span>
                <span className="text-lg font-bold">
                  ${paymentMetrics?.totalAmount?.toLocaleString() || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Average per payment</span>
                <span className="text-sm">
                  ${paymentMetrics?.averagePaymentAmount?.toFixed(2) || 0}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Successful</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-green-600">
                    {paymentMetrics?.successfulPayments || 0}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Failed</span>
                <div className="flex items-center gap-2">
                  <Badge variant="destructive">{paymentMetrics?.failedPayments || 0}</Badge>
                </div>
              </div>
            </div>

            {paymentMetrics?.topPaymentMethods && paymentMetrics.topPaymentMethods.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <h4 className="text-sm font-medium">Top Payment Methods</h4>
                {paymentMetrics.topPaymentMethods.slice(0, 3).map((method: any) => (
                  <div key={method.method} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{method.method}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{method.count}</span>
                      <span className="text-muted-foreground">
                        (${method.totalAmount.toLocaleString()})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tenant Health */}
        <Card>
          <CardHeader>
            <CardTitle>Tenant Status</CardTitle>
            <CardDescription>Distribution of tenant account statuses</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-sm font-medium">Active</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">{tenantMetrics?.activeTenants || 0}</span>
                  <span className="text-sm text-muted-foreground">
                    (
                    {tenantMetrics?.totalTenants
                      ? ((tenantMetrics.activeTenants / tenantMetrics.totalTenants) * 100).toFixed(
                          0,
                        )
                      : 0}
                    %)
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-sm font-medium">Trial</span>
                </div>
                <span className="text-lg font-semibold">{tenantMetrics?.trialTenants || 0}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span className="text-sm font-medium">Suspended</span>
                </div>
                <span className="text-lg font-semibold">
                  {tenantMetrics?.suspendedTenants || 0}
                </span>
              </div>
            </div>

            <div className="pt-4 border-t space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Avg Revenue per Tenant</span>
                <span className="text-sm font-medium">
                  ${tenantMetrics?.averageRevenuePerTenant?.toFixed(2) || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Churn Rate</span>
                <span className="text-sm font-medium">
                  {tenantMetrics?.churnRate?.toFixed(2) || 0}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Customer Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Insights</CardTitle>
          <CardDescription>Key metrics about customer base and retention</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Total Customers</span>
              </div>
              <div className="text-3xl font-bold">
                {customerMetrics?.totalCustomers?.toLocaleString() || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {customerMetrics?.newCustomersThisMonth || 0} new this month
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Retention Rate</span>
              </div>
              <div className="text-3xl font-bold">
                {customerMetrics?.retentionRate?.toFixed(1) || 0}%
              </div>
              <p className="text-xs text-muted-foreground">
                {customerMetrics?.churnedCustomers || 0} churned
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">
                  Avg Lifetime Value
                </span>
              </div>
              <div className="text-3xl font-bold">
                ${customerMetrics?.averageLifetimeValue?.toFixed(2) || 0}
              </div>
              <p className="text-xs text-muted-foreground">Per customer</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
