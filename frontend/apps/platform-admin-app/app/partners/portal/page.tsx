"use client";

/**
 * Partner Portal Dashboard
 * Demonstrates integration of headless partner portal hooks
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  UniversalDashboard,
  UniversalKPISection,
  type KPIItem,
} from "@dotmac/primitives";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import type { LucideIcon } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@dotmac/ui";
import {
  Calendar,
  DollarSign,
  Download,
  Eye,
  Plus,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type PartnerCustomerStatus = "active" | "pending" | "inactive";

interface PartnerCustomer {
  id: string;
  name: string;
  email: string;
  status: PartnerCustomerStatus;
  createdAt?: string;
}

interface PartnerCustomersResponse {
  data: PartnerCustomer[];
}

interface PartnerPayout {
  id: string;
  amount: number;
  scheduledDate: string;
  status: "approved" | "pending" | "processing";
}

interface PartnerCommissionSummary {
  pending: number;
  pendingCount: number;
  totalEarned: number;
  recurring: number;
  oneTime: number;
  bonus: number;
  upcomingPayouts: PartnerPayout[];
}

interface PartnerDashboardMetrics {
  totalCustomers: number;
}

interface PartnerAnalyticsSnapshot {
  customerGrowth: number;
  conversionRate: number;
}

const MOCK_PARTNER_DASHBOARD: PartnerDashboardMetrics = {
  totalCustomers: 248,
};

const MOCK_PARTNER_CUSTOMERS: PartnerCustomer[] = [
  {
    id: "cust-01",
    name: "HarborNet Solutions",
    email: "ops@harbornet.io",
    status: "active",
    createdAt: "2024-11-30T10:00:00Z",
  },
  {
    id: "cust-02",
    name: "MetroFiber Co.",
    email: "team@metrofiber.co",
    status: "pending",
    createdAt: "2024-12-05T14:30:00Z",
  },
  {
    id: "cust-03",
    name: "CityLink Telecom",
    email: "hello@citylinktel.com",
    status: "inactive",
    createdAt: "2024-10-18T09:15:00Z",
  },
  {
    id: "cust-04",
    name: "Northwind Broadband",
    email: "support@northwindbb.com",
    status: "active",
    createdAt: "2024-12-10T08:45:00Z",
  },
];

const MOCK_PARTNER_COMMISSIONS: PartnerCommissionSummary = {
  pending: 4200,
  pendingCount: 8,
  totalEarned: 48500,
  recurring: 32000,
  oneTime: 11000,
  bonus: 5500,
  upcomingPayouts: [
    {
      id: "payout-01",
      amount: 1800,
      scheduledDate: "2024-12-28T00:00:00Z",
      status: "pending",
    },
    {
      id: "payout-02",
      amount: 2400,
      scheduledDate: "2025-01-15T00:00:00Z",
      status: "approved",
    },
    {
      id: "payout-03",
      amount: 1250,
      scheduledDate: "2025-01-30T00:00:00Z",
      status: "processing",
    },
  ],
};

const MOCK_PARTNER_ANALYTICS: PartnerAnalyticsSnapshot = {
  customerGrowth: 12.5,
  conversionRate: 58.3,
};

const simulateNetworkDelay = (ms = 350) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export default function PartnerPortalPage() {
  const [dashboard, setDashboard] = useState<PartnerDashboardMetrics | null>(null);
  const [customers, setCustomers] = useState<PartnerCustomersResponse>({ data: [] });
  const [commissions, setCommissions] = useState<PartnerCommissionSummary | null>(null);
  const [analytics, setAnalytics] = useState<PartnerAnalyticsSnapshot | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [commissionsLoading, setCommissionsLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  const loadMockData = useCallback(async () => {
    setDashboardLoading(true);
    setCustomersLoading(true);
    setCommissionsLoading(true);
    setAnalyticsLoading(true);

    await simulateNetworkDelay();

    setDashboard(MOCK_PARTNER_DASHBOARD);
    setCustomers({ data: MOCK_PARTNER_CUSTOMERS });
    setCommissions(MOCK_PARTNER_COMMISSIONS);
    setAnalytics(MOCK_PARTNER_ANALYTICS);

    setDashboardLoading(false);
    setCustomersLoading(false);
    setCommissionsLoading(false);
    setAnalyticsLoading(false);
  }, []);

  useEffect(() => {
    loadMockData().catch(() => {});
  }, [loadMockData]);

  const handleRefresh = useCallback(async () => {
    await loadMockData();
  }, [loadMockData]);

  // KPI Data
  const kpis: KPIItem[] = useMemo(
    () => [
      {
        id: "total-customers",
        title: "Total Customers",
        value: dashboard?.totalCustomers ?? 0,
        icon: Users as LucideIcon,
        format: "number",
        trend: {
          direction: "up",
          percentage: analytics?.customerGrowth ?? 0,
          label: "vs last month",
        },
        status: {
          type: "success",
        },
      },
      {
        id: "pending-commissions",
        title: "Pending Commissions",
        value: commissions?.pending ?? 0,
        icon: DollarSign as LucideIcon,
        format: "currency",
        currency: "USD",
        subtitle: `${commissions?.pendingCount ?? 0} transactions`,
        status: {
          type: "info",
        },
      },
      {
        id: "total-earned",
        title: "Total Earned",
        value: commissions?.totalEarned ?? 0,
        icon: TrendingUp as LucideIcon,
        format: "currency",
        currency: "USD",
        trend: {
          direction: "up",
          percentage: 15.3,
          label: "vs last month",
        },
        status: {
          type: "success",
        },
      },
      {
        id: "conversion-rate",
        title: "Conversion Rate",
        value: `${analytics?.conversionRate ?? 0}%`,
        icon: Target as LucideIcon,
        progress: {
          current: analytics?.conversionRate ?? 0,
          target: 100,
          showPercentage: true,
        },
        status: {
          type: (analytics?.conversionRate ?? 0) > 50 ? "success" : "warning",
        },
      },
    ],
    [dashboard, analytics, commissions],
  );

  const isLoading = dashboardLoading || customersLoading || commissionsLoading || analyticsLoading;

  return (
    <UniversalDashboard
      variant="reseller"
      title="Partner Portal"
      subtitle="Manage your customers and track commissions"
      actions={[
        {
          id: "add-customer",
          label: "Add Customer",
          icon: Plus as LucideIcon,
          onClick: () => handleRefresh(),
          variant: "primary",
        },
        {
          id: "export",
          label: "Export Report",
          icon: Download as LucideIcon,
          onClick: () => handleRefresh(),
          variant: "outline",
        },
      ]}
      isLoading={isLoading}
      onRefresh={handleRefresh}
      maxWidth="7xl"
      padding="md"
      spacing="normal"
      showGradientHeader={true}
    >
      <div className="space-y-8">
        {/* KPI Section */}
        <UniversalKPISection
          title="Performance Overview"
          subtitle="Your key metrics and achievements"
          kpis={kpis}
          columns={4}
          responsiveColumns={{ sm: 1, md: 2, lg: 4 }}
          gap="normal"
          cardSize="md"
          cardVariant="default"
          loading={isLoading}
          staggerChildren={true}
        />

        {/* Recent Customers */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Customers</CardTitle>
                <CardDescription>
                  Latest customers you&apos;ve onboarded
                </CardDescription>
              </div>
              <Button variant="outline" size="sm">
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {customersLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading customers...
              </div>
            ) : customers && customers.data.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.data.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">
                        {customer.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {customer.email}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            customer.status === "active"
                              ? "default"
                              : customer.status === "pending"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {customer.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {customer.createdAt
                          ? formatDistanceToNow(new Date(customer.createdAt), {
                              addSuffix: true,
                            })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No customers yet</p>
                <Button className="mt-4" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Customer
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Commission Summary */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Commission Breakdown</CardTitle>
              <CardDescription>By commission type</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {commissionsLoading ? (
                <div className="text-center py-4 text-muted-foreground">
                  Loading...
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Recurring Revenue
                      </p>
                      <p className="text-2xl font-bold">
                        ${commissions?.recurring?.toLocaleString() ?? 0}
                      </p>
                    </div>
                    <Badge variant="default">Monthly</Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        One-Time Commissions
                      </p>
                      <p className="text-2xl font-bold">
                        ${commissions?.oneTime?.toLocaleString() ?? 0}
                      </p>
                    </div>
                    <Badge variant="secondary">One-time</Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Bonus Commissions
                      </p>
                      <p className="text-2xl font-bold">
                        ${commissions?.bonus?.toLocaleString() ?? 0}
                      </p>
                    </div>
                    <Badge variant="outline">Bonus</Badge>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upcoming Payouts</CardTitle>
              <CardDescription>Scheduled commission payments</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {commissionsLoading ? (
                <div className="text-center py-4 text-muted-foreground">
                  Loading...
                </div>
              ) : commissions?.upcomingPayouts && commissions.upcomingPayouts.length > 0 ? (
                commissions.upcomingPayouts.map((payout) => (
                  <div key={payout.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Calendar className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">${payout.amount.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(payout.scheduledDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={
                        payout.status === "approved"
                          ? "default"
                          : payout.status === "pending"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {payout.status}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No upcoming payouts
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </UniversalDashboard>
  );
}
