"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  Users,
  Calendar,
  Activity,
  CheckCircle,
  XCircle,
  Mail,
  Phone,
  Globe,
  TrendingUp,
  Database,
  Shield,
  Settings,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { platformConfig } from "@/lib/config";

const API_BASE = platformConfig.api.baseUrl;

interface TenantDetails {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
  updated_at: string;
  subscription_tier?: string;
  user_count?: number;
  is_active: boolean;
  domain?: string;
  primary_email?: string;
  phone?: string;
  settings?: {
    max_users?: number;
    storage_quota_gb?: number;
    bandwidth_limit_gb?: number;
    custom_domain_enabled?: boolean;
    api_access_enabled?: boolean;
  };
  stats?: {
    total_customers?: number;
    active_subscriptions?: number;
    monthly_revenue?: number;
    storage_used_gb?: number;
  };
}

async function fetchTenantDetails(tenantId: string): Promise<TenantDetails> {
  const response = await fetch(`${API_BASE}/api/v1/tenants/${tenantId}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Tenant not found");
    }
    throw new Error("Failed to fetch tenant details");
  }

  return response.json();
}

export default function TenantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.id as string;

  const { data: tenant, isLoading, error } = useQuery({
    queryKey: ["tenant-details", tenantId],
    queryFn: () => fetchTenantDetails(tenantId),
    enabled: !!tenantId,
  });

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return "text-green-600 bg-green-100 dark:bg-green-950/20";
      case "suspended":
        return "text-yellow-600 bg-yellow-100 dark:bg-yellow-950/20";
      case "inactive":
      case "deleted":
        return "text-red-600 bg-red-100 dark:bg-red-950/20";
      default:
        return "text-gray-600 bg-gray-100 dark:bg-gray-950/20";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return <CheckCircle className="w-4 h-4" />;
      case "suspended":
      case "inactive":
      case "deleted":
        return <XCircle className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
        <div className="text-center py-12">
          <div className="text-muted-foreground">Loading tenant details...</div>
        </div>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <div className="text-red-400 font-semibold">Failed to load tenant</div>
          <div className="text-sm text-muted-foreground mt-2">
            {error instanceof Error ? error.message : "Please try again"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold text-foreground">{tenant.name}</h1>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium ${getStatusColor(tenant.status)}`}
                >
                  {getStatusIcon(tenant.status)}
                  {tenant.status}
                </span>
              </div>
              <p className="text-sm text-muted-foreground font-mono mt-1">@{tenant.slug}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tenant.user_count || 0}</div>
            {tenant.settings?.max_users && (
              <p className="text-xs text-muted-foreground">
                of {tenant.settings.max_users} max
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tenant.stats?.total_customers || 0}</div>
            <p className="text-xs text-muted-foreground">
              {tenant.stats?.active_subscriptions || 0} active subscriptions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(tenant.stats?.monthly_revenue || 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Current month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Storage</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tenant.stats?.storage_used_gb?.toFixed(1) || 0} GB
            </div>
            {tenant.settings?.storage_quota_gb && (
              <p className="text-xs text-muted-foreground">
                of {tenant.settings.storage_quota_gb} GB quota
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Tenant Information */}
        <Card>
          <CardHeader>
            <CardTitle>Tenant Information</CardTitle>
            <CardDescription>Basic details and contact information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Building2 className="w-4 h-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-muted-foreground">Tenant Name</div>
                  <div className="text-sm text-foreground">{tenant.name}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Activity className="w-4 h-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-muted-foreground">Tenant Slug</div>
                  <div className="text-sm text-foreground font-mono">{tenant.slug}</div>
                </div>
              </div>

              {tenant.domain && (
                <div className="flex items-start gap-3">
                  <Globe className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-muted-foreground">Domain</div>
                    <div className="text-sm text-foreground">{tenant.domain}</div>
                  </div>
                </div>
              )}

              {tenant.primary_email && (
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-muted-foreground">Primary Email</div>
                    <div className="text-sm text-foreground">{tenant.primary_email}</div>
                  </div>
                </div>
              )}

              {tenant.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-muted-foreground">Phone</div>
                    <div className="text-sm text-foreground">{tenant.phone}</div>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <Calendar className="w-4 h-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-muted-foreground">Created</div>
                  <div className="text-sm text-foreground">
                    {new Date(tenant.created_at).toLocaleString()}
                  </div>
                </div>
              </div>

              {tenant.subscription_tier && (
                <div className="flex items-start gap-3">
                  <TrendingUp className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-muted-foreground">Subscription Tier</div>
                    <div className="text-sm text-foreground">{tenant.subscription_tier}</div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Settings & Features */}
        <Card>
          <CardHeader>
            <CardTitle>Settings & Features</CardTitle>
            <CardDescription>Tenant configuration and enabled features</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {tenant.settings?.max_users !== undefined && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Max Users</span>
                  </div>
                  <span className="text-sm font-medium">{tenant.settings.max_users}</span>
                </div>
              )}

              {tenant.settings?.storage_quota_gb !== undefined && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Storage Quota</span>
                  </div>
                  <span className="text-sm font-medium">{tenant.settings.storage_quota_gb} GB</span>
                </div>
              )}

              {tenant.settings?.bandwidth_limit_gb !== undefined && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Bandwidth Limit</span>
                  </div>
                  <span className="text-sm font-medium">{tenant.settings.bandwidth_limit_gb} GB</span>
                </div>
              )}

              {tenant.settings?.custom_domain_enabled !== undefined && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Custom Domain</span>
                  </div>
                  <span className={`text-sm font-medium ${tenant.settings.custom_domain_enabled ? "text-green-600" : "text-muted-foreground"}`}>
                    {tenant.settings.custom_domain_enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
              )}

              {tenant.settings?.api_access_enabled !== undefined && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">API Access</span>
                  </div>
                  <span className={`text-sm font-medium ${tenant.settings.api_access_enabled ? "text-green-600" : "text-muted-foreground"}`}>
                    {tenant.settings.api_access_enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
              )}

              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Status</span>
                  </div>
                  <span className={`text-sm font-medium ${tenant.is_active ? "text-green-600" : "text-red-600"}`}>
                    {tenant.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Tenant Actions</CardTitle>
          <CardDescription>Manage and configure this tenant account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm">
              <Users className="w-4 h-4 mr-2" />
              View Users
            </Button>
            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4 mr-2" />
              Configure Settings
            </Button>
            <Button variant="outline" size="sm">
              <Activity className="w-4 h-4 mr-2" />
              View Activity Log
            </Button>
            <Button variant="outline" size="sm">
              <TrendingUp className="w-4 h-4 mr-2" />
              View Analytics
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
