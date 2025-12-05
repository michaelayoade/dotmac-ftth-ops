"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Clock,
  Info,
  Key,
  Package,
  Plug,
  RefreshCw,
  Settings,
  XCircle,
} from "lucide-react";
import { useToast } from "@dotmac/ui";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { useAppConfig } from "@/providers/AppConfigContext";

type IntegrationStatus = "healthy" | "degraded" | "error" | "unknown";

interface Integration {
  name: string;
  type: string;
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

function IntegrationDetailsPageContent() {
  const params = useParams();
  const integrationName = decodeURIComponent(params?.["integrationName"] as string);
  const { toast: _toast } = useToast();
  const { api } = useAppConfig();
  const apiBaseUrl = api.baseUrl;

  // Fetch integration details
  const {
    data: integration,
    isLoading,
    refetch,
  } = useQuery<Integration>({
    queryKey: ["integration", integrationName],
    queryFn: async () => {
      const response = await fetch(
        `${apiBaseUrl}/api/platform/v1/integrations/${encodeURIComponent(integrationName)}`,
        { credentials: "include" },
      );
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Integration not found");
        }
        throw new Error("Failed to fetch integration details");
      }
      return response.json();
    },
    enabled: !!integrationName,
  });

  const getStatusBadge = (status: IntegrationStatus) => {
    const statusConfig: Record<
      IntegrationStatus,
      { icon: React.ElementType; color: string; label: string }
    > = {
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Activity className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!integration) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Integration Not Found</h2>
        <p className="text-muted-foreground mb-4">
          The integration you&apos;re looking for doesn&apos;t exist.
        </p>
        <Button asChild>
          <Link href="/dashboard/integrations">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Integrations
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/dashboard/integrations">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{integration.name}</h1>
            <p className="text-sm text-muted-foreground">{integration.provider}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(integration.status)}
          <Badge variant={integration.enabled ? "default" : "outline"}>
            {integration.enabled ? "Enabled" : "Disabled"}
          </Badge>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Status Message */}
      {!!integration.message && (
        <Card
          className={
            integration.status === "healthy"
              ? "border-green-200 bg-green-50"
              : integration.status === "degraded"
                ? "border-yellow-200 bg-yellow-50"
                : "border-red-200 bg-red-50"
          }
        >
          <CardHeader>
            <CardTitle
              className={`text-lg ${
                integration.status === "healthy"
                  ? "text-green-800"
                  : integration.status === "degraded"
                    ? "text-yellow-800"
                    : "text-red-800"
              }`}
            >
              Status Message
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={
                integration.status === "healthy"
                  ? "text-green-700"
                  : integration.status === "degraded"
                    ? "text-yellow-700"
                    : "text-red-700"
              }
            >
              {integration.message}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Quick Info Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Type</CardTitle>
            <Plug className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{integration.type}</div>
            <p className="text-xs text-muted-foreground">Integration type</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Settings</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{integration.settings_count}</div>
            <p className="text-xs text-muted-foreground">Configuration items</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Secrets</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{integration.has_secrets ? "Yes" : "No"}</div>
            <p className="text-xs text-muted-foreground">
              {integration.has_secrets ? "Configured" : "Not configured"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Packages</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{integration.required_packages.length}</div>
            <p className="text-xs text-muted-foreground">Dependencies</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="packages">Required Packages</TabsTrigger>
          {!!integration.metadata && <TabsTrigger value="metadata">Metadata</TabsTrigger>}
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Integration Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Name</p>
                  </div>
                  <p className="font-medium">{integration.name}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Plug className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Provider</p>
                  </div>
                  <p className="font-medium">{integration.provider}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Type</p>
                  </div>
                  <p className="font-medium capitalize">{integration.type}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Status</p>
                  </div>
                  <p className="font-medium capitalize">{integration.status}</p>
                </div>
              </div>

              {!!integration.last_check && (
                <div className="pt-4 border-t">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Last Health Check</p>
                  </div>
                  <p className="font-medium">
                    {format(new Date(integration.last_check as string), "PPpp")}
                  </p>
                </div>
              )}

              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 mb-2">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Configuration</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-accent rounded-lg">
                    <span className="text-sm">Total Settings</span>
                    <Badge variant="outline">{integration.settings_count}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-accent rounded-lg">
                    <span className="text-sm">Secrets Configured</span>
                    <Badge variant={integration.has_secrets ? "default" : "outline"}>
                      {integration.has_secrets ? "Yes" : "No"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-accent rounded-lg">
                    <span className="text-sm">Integration Enabled</span>
                    <Badge variant={integration.enabled ? "default" : "outline"}>
                      {integration.enabled ? "Yes" : "No"}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Packages Tab */}
        <TabsContent value="packages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Required Packages</CardTitle>
              <CardDescription>Python packages required for this integration</CardDescription>
            </CardHeader>
            <CardContent>
              {integration.required_packages.length === 0 ? (
                <p className="text-muted-foreground">No required packages</p>
              ) : (
                <div className="space-y-2">
                  {integration.required_packages.map((pkg, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-accent rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-sm">{pkg}</span>
                      </div>
                      <Badge variant="outline">Required</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Metadata Tab */}
        {!!integration.metadata && (
          <TabsContent value="metadata" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Integration Metadata</CardTitle>
                <CardDescription>Additional information about this integration</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="p-4 bg-accent rounded-lg overflow-x-auto text-sm">
                  {JSON.stringify(integration.metadata, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

export default function IntegrationDetailsPage() {
  return (
    <RouteGuard permission="admin">
      <IntegrationDetailsPageContent />
    </RouteGuard>
  );
}
