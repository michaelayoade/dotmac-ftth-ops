"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@dotmac/ui";
import {
  Users,
  DollarSign,
  UserPlus,
  TrendingUp,
  Loader2,
  Award,
} from "lucide-react";
import { usePartnerDashboard, usePartnerProfile } from "@/hooks/useResellerPortal";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = usePartnerDashboard();
  const { data: profile, isLoading: profileLoading } = usePartnerProfile();

  const isLoading = statsLoading || profileLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {profile?.company_name || "Partner"}
        </p>
      </div>

      {/* Tier & Status */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-full">
              <Award className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Partner Tier</p>
              <p className="text-xl font-semibold capitalize">
                {stats?.current_tier || profile?.tier || "Standard"}
              </p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-sm text-muted-foreground">Commission Rate</p>
              <p className="text-xl font-semibold">
                {formatPercent(stats?.default_commission_rate || 0)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_customers || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.active_customers || 0} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats?.total_revenue_generated || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Generated through referrals</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Commissions Earned</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats?.total_commissions_earned || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(stats?.pending_commissions || 0)} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Referrals</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_referrals || 0}</div>
            <p className="text-xs text-muted-foreground">
              {formatPercent(stats?.conversion_rate || 0)} conversion rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Commission Summary</CardTitle>
            <CardDescription>Your earnings breakdown</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Earned</span>
              <span className="font-medium">
                {formatCurrency(stats?.total_commissions_earned || 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Paid Out</span>
              <span className="font-medium">
                {formatCurrency(stats?.total_commissions_paid || 0)}
              </span>
            </div>
            <div className="flex justify-between border-t pt-4">
              <span className="text-muted-foreground">Pending Payout</span>
              <span className="font-semibold text-primary">
                {formatCurrency(stats?.pending_commissions || 0)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Referral Performance</CardTitle>
            <CardDescription>Your referral statistics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Referrals</span>
              <span className="font-medium">{stats?.total_referrals || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Converted</span>
              <span className="font-medium text-green-600">
                {stats?.converted_referrals || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pending</span>
              <span className="font-medium text-amber-600">
                {stats?.pending_referrals || 0}
              </span>
            </div>
            <div className="flex justify-between border-t pt-4">
              <span className="text-muted-foreground">Conversion Rate</span>
              <span className="font-semibold">
                {formatPercent(stats?.conversion_rate || 0)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
