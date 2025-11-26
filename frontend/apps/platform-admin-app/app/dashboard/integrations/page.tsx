"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@dotmac/ui";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Eye,
  Key,
  Link as LinkIcon,
  Package,
  Plug,
  RefreshCw,
  Search,
  Settings,
  XCircle,
} from "lucide-react";
import { useToast } from "@dotmac/ui";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { useAppConfig } from "@/providers/AppConfigContext";

type IntegrationStatus = "healthy" | "degraded" | "error" | "unknown";
type IntegrationType = "payment" | "sms" | "email" | "storage" | "monitoring" | "crm" | "other";

interface Integration {
  name: string;
  type: IntegrationType;
  provider: string;
  enabled: boolean;
  status: IntegrationStatus;
  message?: string;
  last_check?: string;
  settings_count: number;
  has_secrets: boolean;
  required_packages: string[];
  metadata?: unknown;
}

interface IntegrationStats {
  total_integrations: number;
  healthy_integrations: number;
  degraded_integrations: number;
  error_integrations: number;
  enabled_integrations: number;
  disabled_integrations: number;
}

function IntegrationsPageContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const { toast: _toast } = useToast();
  const { api } = useAppConfig();
  const apiBaseUrl = api.baseUrl;

  // Fetch integrations
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["integrations"],
    queryFn: async () => {
      const response = await fetch(`${apiBaseUrl}/api/v1/integrations`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch integrations");
      return response.json();
    },
  });

  const integrations: Integration[] = data?.integrations || [];
  const _total = data?.total || 0;

  // Calculate statistics
  const stats: IntegrationStats = {
    total_integrations: integrations.length,
    healthy_integrations: integrations.filter(i => i.status === "healthy").length,
    degraded_integrations: integrations.filter(i => i.status === "degraded").length,
    error_integrations: integrations.filter(i => i.status === "error" || i.status === "unknown").length,
    enabled_integrations: integrations.filter(i => i.enabled).length,
    disabled_integrations: integrations.filter(i => !i.enabled).length,
  };

  const filteredIntegrations = integrations.filter((integration) => {
    const matchesSearch =
      !searchQuery ||
      integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      integration.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
      integration.type.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || integration.status === statusFilter;

    const matchesType =
      typeFilter === "all" || integration.type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  const getStatusBadge = (status: IntegrationStatus) => {
    const statusConfig: Record<IntegrationStatus, { icon: React.ElementType; color: string; label: string }> = {
      healthy: { icon: CheckCircle, color: "bg-green-100 text-green-800", label: "Healthy" },
      degraded: { icon: AlertCircle, color: "bg-yellow-100 text-yellow-800", label: "Degraded" },
      error: { icon: XCircle, color: "bg-red-100 text-red-800", label: "Error" },
      unknown: { icon: Clock, color: "bg-gray-100 text-gray-800", label: "Unknown" },
    };

    const config = statusConfig[status] || statusConfig.unknown;
    const Icon = config.icon;

    return (
      <Badge className={config.color}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const getTypeIcon = (type: IntegrationType) => {
    const icons: Record<IntegrationType, LucideIcon> = {
      payment: Package,
      sms: LinkIcon,
      email: LinkIcon,
      storage: Package,
      monitoring: CheckCircle,
      crm: LinkIcon,
      other: Plug,
    };
    return icons[type] || Plug;
  };

  const getTypeLabel = (type: IntegrationType) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Integrations</h1>
          <p className="text-sm text-muted-foreground">
            Manage third-party integrations and connectors
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Plug className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_integrations}</div>
            <p className="text-xs text-muted-foreground">Integrations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Healthy</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.healthy_integrations}</div>
            <p className="text-xs text-muted-foreground">Working well</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Degraded</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.degraded_integrations}</div>
            <p className="text-xs text-muted-foreground">Issues</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Error</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.error_integrations}</div>
            <p className="text-xs text-muted-foreground">Failed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Enabled</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.enabled_integrations}</div>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Disabled</CardTitle>
            <XCircle className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.disabled_integrations}</div>
            <p className="text-xs text-muted-foreground">Inactive</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search integrations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="healthy">Healthy</SelectItem>
                <SelectItem value="degraded">Degraded</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="payment">Payment</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="storage">Storage</SelectItem>
                <SelectItem value="monitoring">Monitoring</SelectItem>
                <SelectItem value="crm">CRM</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Integrations Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <Card className="col-span-full">
            <CardContent className="py-8 text-center text-muted-foreground">
              Loading integrations...
            </CardContent>
          </Card>
        ) : filteredIntegrations.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-8 text-center text-muted-foreground">
              {searchQuery ? "No integrations match your search" : "No integrations found"}
            </CardContent>
          </Card>
        ) : (
          filteredIntegrations.map((integration) => {
            const TypeIcon = getTypeIcon(integration.type);
            return (
              <Card key={integration.name} className="hover:border-primary transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <TypeIcon className="h-8 w-8 text-primary" />
                      <div>
                        <CardTitle className="text-lg">
                          <Link
                            href={`/dashboard/integrations/${encodeURIComponent(integration.name)}`}
                            className="hover:underline"
                          >
                            {integration.name}
                          </Link>
                        </CardTitle>
                        <CardDescription>
                          {integration.provider}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {getStatusBadge(integration.status)}
                      <Badge variant={integration.enabled ? "default" : "outline"} className="text-xs">
                        {integration.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Type</p>
                    <p className="font-medium">{getTypeLabel(integration.type)}</p>
                  </div>

                  {integration.message && (
                    <div className={`p-3 rounded-lg text-sm ${
                      integration.status === "healthy"
                        ? "bg-green-50 border border-green-200 text-green-800"
                        : integration.status === "degraded"
                        ? "bg-yellow-50 border border-yellow-200 text-yellow-800"
                        : "bg-red-50 border border-red-200 text-red-800"
                    }`}>
                      {integration.message}
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Settings className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{integration.settings_count} settings</span>
                    </div>
                    {integration.has_secrets && (
                      <div className="flex items-center gap-1">
                        <Key className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Secrets</span>
                      </div>
                    )}
                  </div>

                  {integration.required_packages && integration.required_packages.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Required Packages</p>
                      <div className="flex flex-wrap gap-1">
                        {integration.required_packages.map((pkg, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {pkg}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {integration.last_check && (
                    <div className="pt-3 border-t">
                      <p className="text-xs text-muted-foreground">
                        Last checked {formatDistanceToNow(new Date(integration.last_check), { addSuffix: true })}
                      </p>
                    </div>
                  )}

                  <div className="pt-3 border-t">
                    <Button variant="outline" size="sm" asChild className="w-full">
                      <Link href={`/dashboard/integrations/${encodeURIComponent(integration.name)}`}>
                        <Eye className="h-3 w-3 mr-1" />
                        View Details
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <RouteGuard permission="admin">
      <IntegrationsPageContent />
    </RouteGuard>
  );
}
