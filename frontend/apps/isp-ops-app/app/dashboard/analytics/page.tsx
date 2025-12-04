"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { BillingMetricsCard } from "./components/BillingMetricsCard";
import { CustomerMetricsCard } from "./components/CustomerMetricsCard";
import { MonitoringMetricsCard } from "./components/MonitoringMetricsCard";
import { useDashboardOverview } from "@/lib/graphql/hooks";
import { BarChart3, DollarSign, Users, Activity, RefreshCw } from "lucide-react";

export default function AnalyticsPage() {
  const [period, setPeriod] = useState("30d");
  const { data, isLoading, refetch } = useDashboardOverview(period);

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h2>
          <p className="text-muted-foreground">Real-time metrics powered by GraphQL</p>
        </div>
        <div className="flex items-center space-x-2">
          {/* Period Selector */}
          <div className="flex items-center space-x-2">
            <Button
              variant={period === "7d" ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod("7d")}
            >
              7 Days
            </Button>
            <Button
              variant={period === "30d" ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod("30d")}
            >
              30 Days
            </Button>
            <Button
              variant={period === "90d" ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod("90d")}
            >
              90 Days
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Quick Overview Cards (from GraphQL single query) */}
      {data && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">MRR</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${data.billing?.mrr?.toLocaleString() || "0"}
              </div>
              <p className="text-xs text-muted-foreground">
                {data.billing?.activeSubscriptions || 0} subscriptions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.customer?.totalCustomers?.toLocaleString() || "0"}
              </div>
              <p className="text-xs text-muted-foreground">
                {data.customer?.newCustomers || 0} new this period
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Requests</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.monitoring?.totalRequests?.toLocaleString() || "0"}
              </div>
              <p className="text-xs text-muted-foreground">
                {((data.monitoring?.errorRate || 0) * 100).toFixed(2)}% error rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Response</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.monitoring?.avgResponseTimeMs?.toFixed(0) || "0"}ms
              </div>
              <p className="text-xs text-muted-foreground">
                P95: {data.monitoring?.p95ResponseTimeMs?.toFixed(0) || "0"}ms
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detailed Metrics Tabs */}
      <Tabs defaultValue="billing" className="space-y-4">
        <TabsList>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
        </TabsList>

        <TabsContent value="billing" className="space-y-4">
          <BillingMetricsCard period={period} />
        </TabsContent>

        <TabsContent value="customers" className="space-y-4">
          <CustomerMetricsCard period={period} />
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          <MonitoringMetricsCard period={period === "30d" ? "24h" : "7d"} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
