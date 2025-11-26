"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@dotmac/ui";
import {
  ArrowLeft,
  Building2,
  Users,
  DollarSign,
  AlertCircle,
  Ticket,
  TrendingUp,
  Settings,
  Bell,
  Calendar,
  FileText,
} from "lucide-react";
import { useManagedTenantDetail } from "@/hooks/useManagedTenants";
import { usePartnerTenant } from "@/contexts/PartnerTenantContext";

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default function ManagedTenantDetailPage({ params }: PageProps) {
  const { tenantId } = use(params);
  const router = useRouter();
  const { data: tenant, isLoading, error } = useManagedTenantDetail(tenantId);
  const { setActiveTenant, activeTenantId } = usePartnerTenant();

  const isActiveContext = activeTenantId === tenantId;

  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(parseFloat(value));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="h-4 bg-muted rounded w-1/4 mt-2" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="h-4 bg-muted rounded" />
              <div className="h-4 bg-muted rounded" />
              <div className="h-4 bg-muted rounded w-2/3" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="container mx-auto py-8">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Error Loading Tenant
            </CardTitle>
            <CardDescription>{error?.message || "Failed to load tenant details"}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{tenant.tenant_name}</h1>
              <p className="text-muted-foreground">{tenant.tenant_slug}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={tenant.is_active ? "default" : "secondary"}>
            {tenant.is_active ? "Active" : "Inactive"}
          </Badge>
          <Button
            variant={isActiveContext ? "default" : "outline"}
            onClick={() => setActiveTenant(tenantId)}
          >
            {isActiveContext ? "Active Context" : "Switch to This Tenant"}
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      {tenant.metrics && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Subscribers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {tenant.metrics.total_subscribers.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Revenue MTD</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(tenant.metrics.total_revenue_mtd)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Accounts Receivable</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(tenant.metrics.accounts_receivable)}
              </div>
              {tenant.metrics.overdue_invoices_count > 0 && (
                <p className="text-xs text-destructive mt-1">
                  {tenant.metrics.overdue_invoices_count} overdue invoices
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">SLA Compliance</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {tenant.metrics.sla_compliance_pct
                  ? `${parseFloat(tenant.metrics.sla_compliance_pct).toFixed(2)}%`
                  : "N/A"}
              </div>
              {tenant.metrics.open_tickets_count > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {tenant.metrics.open_tickets_count} open tickets
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detailed Information Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="access">Access & Permissions</TabsTrigger>
          <TabsTrigger value="sla">SLA Configuration</TabsTrigger>
          <TabsTrigger value="alerts">Alert Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Relationship Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Access Role</label>
                  <p className="text-sm">
                    {tenant.access_role.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Relationship Type
                  </label>
                  <p className="text-sm">
                    {tenant.relationship_type
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (l) => l.toUpperCase())}
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Start Date</label>
                  <p className="text-sm flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {formatDate(tenant.start_date)}
                  </p>
                </div>
                {tenant.end_date && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">End Date</label>
                    <p className="text-sm flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {formatDate(tenant.end_date)}
                    </p>
                  </div>
                )}
              </div>

              {tenant.notes && (
                <div className="space-y-2 pt-4 border-t">
                  <label className="text-sm font-medium text-muted-foreground">Notes</label>
                  <p className="text-sm">{tenant.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="access" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Access Permissions</CardTitle>
              <CardDescription>Custom permissions for this tenant relationship</CardDescription>
            </CardHeader>
            <CardContent>
              {Object.keys(tenant.custom_permissions).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(tenant.custom_permissions).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between py-2">
                      <span className="text-sm font-medium">
                        {key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                      </span>
                      <Badge variant={value ? "default" : "secondary"}>
                        {value ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No custom permissions configured. Using default role permissions.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sla" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>SLA Configuration</CardTitle>
              <CardDescription>Service level agreement targets and monitoring</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Response Time Target
                  </label>
                  <p className="text-sm">
                    {tenant.sla_response_hours ? `${tenant.sla_response_hours} hours` : "Not set"}
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Uptime Target</label>
                  <p className="text-sm">
                    {tenant.sla_uptime_target
                      ? `${parseFloat(tenant.sla_uptime_target).toFixed(2)}%`
                      : "Not set"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Alert Configuration</CardTitle>
              <CardDescription>Notification settings for this tenant relationship</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b">
                <div className="flex items-center gap-3">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">SLA Breach Notifications</p>
                    <p className="text-xs text-muted-foreground">
                      Get notified when SLA targets are breached
                    </p>
                  </div>
                </div>
                <Badge variant={tenant.notify_on_sla_breach ? "default" : "secondary"}>
                  {tenant.notify_on_sla_breach ? "Enabled" : "Disabled"}
                </Badge>
              </div>

              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Billing Threshold Alerts</p>
                    <p className="text-xs text-muted-foreground">
                      Get notified when billing thresholds are exceeded
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={tenant.notify_on_billing_threshold ? "default" : "secondary"}>
                    {tenant.notify_on_billing_threshold ? "Enabled" : "Disabled"}
                  </Badge>
                  {tenant.billing_alert_threshold && (
                    <span className="text-sm text-muted-foreground">
                      ({formatCurrency(tenant.billing_alert_threshold)})
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
