"use client";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Progress } from "@dotmac/ui";
import Link from "next/link";
import {
  Wifi,
  CreditCard,
  Download,
  Upload,
  CheckCircle,
  Clock,
  DollarSign,
  Zap,
  TrendingUp,
  Headphones,
  Loader2,
} from "lucide-react";
import { formatCurrency } from "@dotmac/features/billing";
import {
  useCustomerProfile,
  useCustomerService,
  useCustomerUsage,
  useCustomerInvoices,
  useCustomerTickets,
} from "@/hooks/useCustomerPortal";

export default function CustomerDashboard() {
  const { profile: rawProfile, loading: profileLoading } = useCustomerProfile();
  const { service: rawService, loading: serviceLoading } = useCustomerService();
  const { usage, loading: usageLoading } = useCustomerUsage();
  const { invoices, loading: invoicesLoading } = useCustomerInvoices();
  const { tickets, loading: ticketsLoading } = useCustomerTickets();

  // Type assertions to work around inference issues
  const profile = rawProfile as any;
  const service = rawService as any;

  const loading =
    profileLoading || serviceLoading || usageLoading || invoicesLoading || ticketsLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const totalUsage = usage ? usage.upload_gb + usage.download_gb : 0;
  const usageLimit = usage?.limit_gb ?? 0;
  const usagePercentage = usageLimit > 0 ? (totalUsage / usageLimit) * 100 : 0;

  // Get current balance from most recent unpaid invoice
  const currentBalance =
    invoices
      ?.filter((inv) => inv.status !== "paid")
      .reduce((sum, inv) => sum + inv.amount_due, 0) || 0;

  const daysUntilBilling = service?.next_billing_date
    ? Math.ceil(
        (new Date(service.next_billing_date).getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24),
      )
    : 0;

  // Get recent tickets (last 3)
  const recentTickets = tickets?.slice(0, 3) || [];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome back!</h1>
        <p className="text-muted-foreground">Here&apos;s an overview of your internet service</p>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Service Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Service Status</CardTitle>
            <Wifi className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle
                className={`h-5 w-5 ${profile?.status === "active" ? "text-green-500" : "text-yellow-500"}`}
              />
              <span className="text-2xl font-bold capitalize">{profile?.status || "Unknown"}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{service?.plan_name || "No plan"}</p>
          </CardContent>
        </Card>

        {/* Current Bill */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Bill</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(currentBalance)}</div>
            <p className="text-xs text-muted-foreground">
              {daysUntilBilling > 0 ? `Due in ${daysUntilBilling} days` : "No upcoming bill"}
            </p>
          </CardContent>
        </Card>

        {/* Download Speed */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Download Speed</CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{service?.speed_down || "N/A"}</div>
            <p className="text-xs text-muted-foreground">Upload: {service?.speed_up || "N/A"}</p>
          </CardContent>
        </Card>

        {/* Data Usage */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Used</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsage.toFixed(1)} GB</div>
            <p className="text-xs text-muted-foreground">
              {usagePercentage.toFixed(1)}% of {usageLimit} GB
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Account Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5" />
              Service Overview
            </CardTitle>
            <CardDescription>Your internet service details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium">Plan</p>
                  <p className="text-2xl font-bold">{service?.plan_name || "No plan"}</p>
                </div>
                <Badge
                  variant="outline"
                  className={`${
                    service?.status === "active"
                      ? "bg-green-500/10 text-green-500 border-green-500/30"
                      : "bg-yellow-500/10 text-yellow-500 border-yellow-500/30"
                  }`}
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {service?.status || "Unknown"}
                </Badge>
              </div>

              <div className="pt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Speed:</span>
                  <span className="font-medium">{service?.speed_down || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monthly Price:</span>
                  <span className="font-medium">{formatCurrency(service?.monthly_price || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service Address:</span>
                  <span className="font-medium text-right">
                    {profile?.service_address || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Installation Date:</span>
                  <span className="font-medium">
                    {service?.installation_date
                      ? new Date(service.installation_date).toLocaleDateString()
                      : "N/A"}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 flex gap-2">
              <Button asChild className="flex-1">
                <Link href="/customer-portal/service">
                  <Zap className="h-4 w-4 mr-2" />
                  Upgrade Plan
                </Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link href="/customer-portal/support">
                  <Headphones className="h-4 w-4 mr-2" />
                  Get Help
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Billing Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Billing Summary
            </CardTitle>
            <CardDescription>Your current billing information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current Balance */}
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-muted-foreground">Amount Due</span>
                {daysUntilBilling > 0 && (
                  <Badge variant="outline" className="text-xs">
                    <Clock className="h-3 w-3 mr-1" />
                    Due in {daysUntilBilling} days
                  </Badge>
                )}
              </div>
              <p className="text-3xl font-bold">{formatCurrency(currentBalance)}</p>
              {service?.next_billing_date && (
                <p className="text-xs text-muted-foreground mt-1">
                  Due on {new Date(service.next_billing_date).toLocaleDateString()}
                </p>
              )}
            </div>

            {/* Last Payment */}
            {invoices && invoices.length > 0 && invoices[0] && (
              <div className="space-y-2 text-sm">
                <p className="font-medium">Recent Invoice</p>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span
                    className={`font-medium ${
                      invoices[0]?.status === "paid" ? "text-green-500" : "text-yellow-500"
                    }`}
                  >
                    {formatCurrency(invoices[0]?.amount ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="font-medium capitalize">{invoices[0]?.status ?? "unknown"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date:</span>
                  <span className="font-medium">
                    {invoices[0]?.created_at
                      ? new Date(invoices[0].created_at).toLocaleDateString()
                      : "N/A"}
                  </span>
                </div>
              </div>
            )}

            <div className="pt-4 flex gap-2">
              <Button asChild className="flex-1">
                <Link href="/customer-portal/billing">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Pay Now
                </Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link href="/customer-portal/billing">View Invoices</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage This Month */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Data Usage This Month
          </CardTitle>
          <CardDescription>Your internet usage for the current billing period</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">
                {totalUsage.toFixed(1)} GB used
                {usage && usage.limit_gb ? ` of ${usage.limit_gb} GB` : ""}
              </span>
              <span className="text-muted-foreground">{usagePercentage.toFixed(1)}%</span>
            </div>
            <Progress value={usagePercentage} className="h-2" />
          </div>

          {usage && (
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Download className="h-4 w-4 text-blue-500" />
                  Download
                </p>
                <p className="text-2xl font-bold text-blue-500">
                  {usage.download_gb.toFixed(1)} GB
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Upload className="h-4 w-4 text-green-500" />
                  Upload
                </p>
                <p className="text-2xl font-bold text-green-500">{usage.upload_gb.toFixed(1)} GB</p>
              </div>
            </div>
          )}

          <Button asChild variant="outline" className="w-full">
            <Link href="/customer-portal/usage">View Detailed Usage Report</Link>
          </Button>
        </CardContent>
      </Card>

      {/* Recent Support Tickets */}
      {recentTickets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Headphones className="h-5 w-5" />
              Recent Support Tickets
            </CardTitle>
            <CardDescription>Your latest support requests</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <span className="font-medium">{ticket.subject}</span>
                      <span className="text-sm text-muted-foreground">
                        {ticket.ticket_number} • Submitted{" "}
                        {new Date(ticket.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      ticket.status === "resolved" || ticket.status === "closed"
                        ? "bg-green-500/10 text-green-500 border-green-500/30"
                        : ticket.status === "in_progress"
                          ? "bg-blue-500/10 text-blue-500 border-blue-500/30"
                          : "bg-yellow-500/10 text-yellow-500 border-yellow-500/30"
                    }
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {ticket.status.replace("_", " ")}
                  </Badge>
                </div>
              ))}
            </div>

            <Button asChild variant="outline" className="w-full mt-4">
              <Link href="/customer-portal/support">View All Tickets</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
