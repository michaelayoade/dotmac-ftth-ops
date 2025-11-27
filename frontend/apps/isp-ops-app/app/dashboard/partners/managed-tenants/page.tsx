"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Badge,
} from "@dotmac/ui";
import {
  Building2,
  Users,
  DollarSign,
  AlertCircle,
  Ticket,
  TrendingUp,
  Search,
  Filter,
  ExternalLink,
} from "lucide-react";
import { useManagedTenants, ManagedTenant } from "@/hooks/useManagedTenants";
import { usePartnerTenant } from "@/contexts/PartnerTenantContext";
import Link from "next/link";

export default function ManagedTenantsPage() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const { isPartnerUser } = usePartnerTenant();
  const managedTenantParams = statusFilter ? { status: statusFilter } : {};
  const { data, isLoading, error } = useManagedTenants(managedTenantParams);

  // Filter tenants by search query
  const filteredTenants = data?.tenants.filter(
    (tenant) =>
      tenant.tenant_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.tenant_slug.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (!isPartnerUser) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              This page is only accessible to partner users with multi-tenant access.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Managed Tenants</h1>
            <p className="text-muted-foreground mt-1">
              View and manage all tenant accounts under your partnership
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/dashboard/partners">
              <Building2 className="h-4 w-4 mr-2" />
              Partner Dashboard
            </Link>
          </Button>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search tenants..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={statusFilter === undefined ? "default" : "outline"}
              onClick={() => setStatusFilter(undefined)}
              size="sm"
            >
              All
            </Button>
            <Button
              variant={statusFilter === "active" ? "default" : "outline"}
              onClick={() => setStatusFilter("active")}
              size="sm"
            >
              Active
            </Button>
            <Button
              variant={statusFilter === "inactive" ? "default" : "outline"}
              onClick={() => setStatusFilter("inactive")}
              size="sm"
            >
              Inactive
            </Button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="h-4 bg-muted rounded" />
                  <div className="h-4 bg-muted rounded" />
                  <div className="h-4 bg-muted rounded w-2/3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Error Loading Tenants
            </CardTitle>
            <CardDescription>{error.message}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredTenants?.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>No Tenants Found</CardTitle>
            <CardDescription>
              {searchQuery
                ? "No tenants match your search criteria."
                : "You don't have any managed tenants yet."}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Tenants Grid */}
      {!isLoading && !error && filteredTenants && filteredTenants.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {filteredTenants.length} of {data?.total} tenants
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredTenants.map((tenant) => (
              <TenantCard key={tenant.tenant_id} tenant={tenant} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

interface TenantCardProps {
  tenant: ManagedTenant;
}

function TenantCard({ tenant }: TenantCardProps) {
  const { setActiveTenant, activeTenantId } = usePartnerTenant();
  const isActive = activeTenantId === tenant.tenant_id;

  const getStatusBadge = () => {
    if (tenant.is_expired) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    if (!tenant.is_active) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    return <Badge variant="default">Active</Badge>;
  };

  const getAccessRoleBadge = () => {
    const roleColors: Record<string, string> = {
      msp_full: "bg-purple-500/10 text-purple-500",
      msp_billing: "bg-blue-500/10 text-blue-500",
      msp_support: "bg-green-500/10 text-green-500",
      enterprise_hq: "bg-orange-500/10 text-orange-500",
      auditor: "bg-gray-500/10 text-gray-500",
    };

    const color = roleColors[tenant.access_role] || "bg-gray-500/10 text-gray-500";

    return (
      <Badge variant="outline" className={color}>
        {tenant.access_role.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
      </Badge>
    );
  };

  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(parseFloat(value));
  };

  return (
    <Card className={isActive ? "border-primary shadow-md" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <CardTitle className="text-lg line-clamp-1">{tenant.tenant_name}</CardTitle>
            <CardDescription className="text-xs">{tenant.tenant_slug}</CardDescription>
          </div>
          <div className="flex flex-col gap-1 items-end">{getStatusBadge()}</div>
        </div>
        <div className="pt-2">{getAccessRoleBadge()}</div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Metrics */}
        {tenant.metrics && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                <span className="text-xs">Subscribers</span>
              </div>
              <p className="text-lg font-semibold">
                {tenant.metrics.total_subscribers.toLocaleString()}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <DollarSign className="h-3.5 w-3.5" />
                <span className="text-xs">Revenue MTD</span>
              </div>
              <p className="text-lg font-semibold">
                {formatCurrency(tenant.metrics.total_revenue_mtd)}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <AlertCircle className="h-3.5 w-3.5" />
                <span className="text-xs">Overdue</span>
              </div>
              <p className="text-lg font-semibold">{tenant.metrics.overdue_invoices_count}</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Ticket className="h-3.5 w-3.5" />
                <span className="text-xs">Open Tickets</span>
              </div>
              <p className="text-lg font-semibold">{tenant.metrics.open_tickets_count}</p>
            </div>
          </div>
        )}

        {/* SLA Compliance */}
        {tenant.metrics?.sla_compliance_pct && (
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">SLA Compliance</span>
            </div>
            <span className="text-sm font-bold">
              {parseFloat(tenant.metrics.sla_compliance_pct).toFixed(2)}%
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            variant={isActive ? "default" : "outline"}
            size="sm"
            className="flex-1"
            onClick={() => setActiveTenant(tenant.tenant_id)}
          >
            {isActive ? "Active Context" : "Switch Context"}
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/dashboard/partners/managed-tenants/${tenant.tenant_id}`}>
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
