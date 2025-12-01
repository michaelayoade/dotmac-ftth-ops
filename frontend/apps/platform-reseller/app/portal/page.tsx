"use client";

import { usePartnerDashboard, usePartnerProfile } from "@/hooks/usePlatformPartner";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";

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
  const { data: dashboard, isLoading: dashboardLoading } = usePartnerDashboard();
  const { data: profile, isLoading: profileLoading } = usePartnerProfile();

  const isLoading = dashboardLoading || profileLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          Welcome back, {profile?.company_name}
        </h2>
        <p className="text-gray-600 mt-1">
          {profile?.tier} Partner | {profile?.commission_model} Commission Model
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Tenants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{dashboard?.total_tenants ?? 0}</div>
            <p className="text-sm text-gray-500 mt-1">
              {dashboard?.active_tenants ?? 0} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Revenue Generated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {formatCurrency(dashboard?.total_revenue_generated ?? 0)}
            </div>
            <p className="text-sm text-gray-500 mt-1">Lifetime</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Commissions Earned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {formatCurrency(dashboard?.total_commissions_earned ?? 0)}
            </div>
            <p className="text-sm text-green-600 mt-1">
              {formatCurrency(dashboard?.pending_commissions ?? 0)} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Conversion Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {formatPercent(dashboard?.conversion_rate ?? 0)}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {dashboard?.converted_referrals ?? 0} of {dashboard?.total_referrals ?? 0} referrals
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Commission Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">Total Earned</span>
                <span className="font-medium">
                  {formatCurrency(dashboard?.total_commissions_earned ?? 0)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">Paid Out</span>
                <span className="font-medium">
                  {formatCurrency(dashboard?.total_commissions_paid ?? 0)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-600">Pending</span>
                <span className="font-medium text-green-600">
                  {formatCurrency(dashboard?.pending_commissions ?? 0)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Referral Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">Total Referrals</span>
                <span className="font-medium">{dashboard?.total_referrals ?? 0}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">Converted</span>
                <span className="font-medium text-green-600">
                  {dashboard?.converted_referrals ?? 0}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-600">Pending</span>
                <span className="font-medium text-yellow-600">
                  {dashboard?.pending_referrals ?? 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Partner Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-500">Partner Number</p>
              <p className="font-medium">{profile?.partner_number}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Current Tier</p>
              <p className="font-medium capitalize">{profile?.tier}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Commission Rate</p>
              <p className="font-medium">
                {formatPercent(profile?.default_commission_rate ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Primary Email</p>
              <p className="font-medium">{profile?.primary_email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <p className="font-medium capitalize">{profile?.status}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Member Since</p>
              <p className="font-medium">
                {profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString()
                  : "N/A"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
