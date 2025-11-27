"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
  Puzzle,
  RefreshCw,
  Settings,
  TestTube,
  XCircle,
} from "lucide-react";
import { useAppConfig } from "@/providers/AppConfigContext";
import { useToast } from "@dotmac/ui";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns";

type PluginStatus = "active" | "inactive" | "error" | "unknown";

interface PluginInstance {
  id: string;
  plugin_name: string;
  instance_name: string;
  status: PluginStatus;
  enabled: boolean;
  config_schema: unknown;
  last_health_check?: string;
  created_at: string;
  updated_at: string;
}

interface PluginConfiguration {
  plugin_instance_id: string;
  configuration: Record<string, unknown>;
  schema: unknown;
  status: string;
  last_updated?: string;
}

interface PluginHealthCheck {
  plugin_instance_id: string;
  status: string;
  healthy: boolean;
  message?: string;
  details?: unknown;
  checked_at: string;
}

function PluginDetailsPageContent() {
  const params = useParams();
  const pluginId = params?.["pluginId"] as string;
  const { toast } = useToast();
  const [_isTestingConnection, _setIsTestingConnection] = useState(false);
  const { api } = useAppConfig();
  const apiBaseUrl = api.baseUrl || "";

  // Fetch plugin instance details
  const {
    data: plugin,
    isLoading,
    refetch,
  } = useQuery<PluginInstance>({
    queryKey: ["plugin-instance", pluginId, apiBaseUrl],
    queryFn: async () => {
      const response = await fetch(`${apiBaseUrl}/api/v1/plugins/instances/${pluginId}`, {
        credentials: "include",
      });
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Plugin instance not found");
        }
        throw new Error("Failed to fetch plugin instance");
      }
      return response.json();
    },
    enabled: !!pluginId,
  });

  // Fetch plugin configuration
  const { data: config } = useQuery<PluginConfiguration>({
    queryKey: ["plugin-configuration", pluginId, apiBaseUrl],
    queryFn: async () => {
      const response = await fetch(
        `${apiBaseUrl}/api/v1/plugins/instances/${pluginId}/configuration`,
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("Failed to fetch plugin configuration");
      return response.json();
    },
    enabled: !!pluginId,
  });

  // Health check mutation
  const healthCheckMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${apiBaseUrl}/api/v1/plugins/instances/${pluginId}/health`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to perform health check");
      return response.json();
    },
    onSuccess: (data: PluginHealthCheck) => {
      toast({
        title: data.healthy ? "Healthy" : "Unhealthy",
        description: data.message || `Plugin is ${data.status}`,
        variant: data.healthy ? "default" : "destructive",
      });
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Test connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${apiBaseUrl}/api/v1/plugins/instances/${pluginId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ configuration: null }),
      });
      if (!response.ok) throw new Error("Failed to test connection");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.success ? "Success" : "Failed",
        description: data.message || "Connection test completed",
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: PluginStatus) => {
    const statusConfig: Record<
      PluginStatus,
      { icon: React.ElementType; color: string; label: string }
    > = {
      active: { icon: CheckCircle, color: "bg-green-100 text-green-800", label: "Active" },
      inactive: { icon: AlertCircle, color: "bg-yellow-100 text-yellow-800", label: "Inactive" },
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

  if (!plugin) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Plugin Instance Not Found</h2>
        <p className="text-muted-foreground mb-4">
          The plugin instance you&apos;re looking for doesn&apos;t exist.
        </p>
        <Button asChild>
          <Link href="/dashboard/plugins">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Plugins
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
            <Link href="/dashboard/plugins">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{plugin.instance_name}</h1>
            <p className="text-sm text-muted-foreground">{plugin.plugin_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(plugin.status)}
          <Badge variant={plugin.enabled ? "default" : "outline"}>
            {plugin.enabled ? "Enabled" : "Disabled"}
          </Badge>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Quick Info Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Plugin Type</CardTitle>
            <Puzzle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{plugin.plugin_name}</div>
            <p className="text-xs text-muted-foreground">Plugin name</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{plugin.status}</div>
            <p className="text-xs text-muted-foreground">Current status</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Last Check</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {plugin.last_health_check
                ? format(new Date(plugin.last_health_check), "PPp")
                : "Never"}
            </div>
            <p className="text-xs text-muted-foreground">Health check</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Actions</CardTitle>
          <CardDescription>Manage and test this plugin instance</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => healthCheckMutation.mutate()}
            disabled={healthCheckMutation.isPending}
          >
            <Activity className="h-4 w-4 mr-2" />
            {healthCheckMutation.isPending ? "Checking..." : "Run Health Check"}
          </Button>
          <Button
            variant="outline"
            onClick={() => testConnectionMutation.mutate()}
            disabled={testConnectionMutation.isPending}
          >
            <TestTube className="h-4 w-4 mr-2" />
            {testConnectionMutation.isPending ? "Testing..." : "Test Connection"}
          </Button>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          {!!plugin.config_schema && <TabsTrigger value="schema">Schema</TabsTrigger>}
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Plugin Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Instance Name</p>
                  </div>
                  <p className="font-medium">{plugin.instance_name}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Puzzle className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Plugin Type</p>
                  </div>
                  <p className="font-medium">{plugin.plugin_name}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Status</p>
                  </div>
                  <p className="font-medium capitalize">{plugin.status}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Enabled</p>
                  </div>
                  <p className="font-medium">{plugin.enabled ? "Yes" : "No"}</p>
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Timestamps</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-accent rounded-lg">
                    <span className="text-sm">Created At</span>
                    <span className="font-mono text-xs">
                      {format(new Date(plugin.created_at), "PPpp")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-accent rounded-lg">
                    <span className="text-sm">Updated At</span>
                    <span className="font-mono text-xs">
                      {format(new Date(plugin.updated_at), "PPpp")}
                    </span>
                  </div>
                  {!!plugin.last_health_check && (
                    <div className="flex items-center justify-between p-3 bg-accent rounded-lg">
                      <span className="text-sm">Last Health Check</span>
                      <span className="font-mono text-xs">
                        {format(new Date(plugin.last_health_check as string), "PPpp")}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value="configuration" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Plugin Configuration</CardTitle>
              <CardDescription>Current configuration values (secrets are masked)</CardDescription>
            </CardHeader>
            <CardContent>
              {config ? (
                <pre className="p-4 bg-accent rounded-lg overflow-x-auto text-sm">
                  {JSON.stringify(config.configuration, null, 2)}
                </pre>
              ) : (
                <p className="text-muted-foreground">Loading configuration...</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Schema Tab */}
        {!!plugin.config_schema && (
          <TabsContent value="schema" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Configuration Schema</CardTitle>
                <CardDescription>Expected configuration structure for this plugin</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="p-4 bg-accent rounded-lg overflow-x-auto text-sm">
                  {JSON.stringify(plugin.config_schema, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

export default function PluginDetailsPage() {
  return (
    <RouteGuard permission="admin">
      <PluginDetailsPageContent />
    </RouteGuard>
  );
}
