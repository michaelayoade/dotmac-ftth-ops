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
import {
  Puzzle,
  Search,
  RefreshCw,
  Eye,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Settings,
  Activity,
  Plus,
  Trash2,
} from "lucide-react";
import { platformConfig } from "@/lib/config";
import { useToast } from "@dotmac/ui";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import { useConfirmDialog } from "@dotmac/ui";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

type PluginStatus = "active" | "inactive" | "error" | "unknown";

interface PluginInstance {
  id: string;
  plugin_name: string;
  instance_name: string;
  status: PluginStatus;
  enabled: boolean;
  config_schema: any;
  last_health_check?: string;
  created_at: string;
  updated_at: string;
}

interface PluginStats {
  total_plugins: number;
  active_plugins: number;
  inactive_plugins: number;
  error_plugins: number;
  enabled_plugins: number;
  disabled_plugins: number;
}

function PluginsPageContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();
  const confirmDialog = useConfirmDialog();

  // Fetch plugin instances
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["plugin-instances"],
    queryFn: async () => {
      const response = await fetch(
        `${platformConfig.api.baseUrl}/api/v1/plugins/instances`,
        { credentials: "include" }
      );
      if (!response.ok) throw new Error("Failed to fetch plugin instances");
      return response.json();
    },
  });

  const plugins: PluginInstance[] = data?.plugins || [];
  const total = data?.total || 0;

  // Calculate statistics
  const stats: PluginStats = {
    total_plugins: plugins.length,
    active_plugins: plugins.filter(p => p.status === "active").length,
    inactive_plugins: plugins.filter(p => p.status === "inactive").length,
    error_plugins: plugins.filter(p => p.status === "error" || p.status === "unknown").length,
    enabled_plugins: plugins.filter(p => p.enabled).length,
    disabled_plugins: plugins.filter(p => !p.enabled).length,
  };

  const filteredPlugins = plugins.filter((plugin) => {
    const matchesSearch =
      !searchQuery ||
      plugin.plugin_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plugin.instance_name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || plugin.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: PluginStatus) => {
    const statusConfig: Record<PluginStatus, { icon: any; color: string; label: string }> = {
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

  const handleDelete = async (pluginId: string) => {
    const confirmed = await confirmDialog({
      title: "Delete plugin instance",
      description: "Are you sure you want to delete this plugin instance?",
      confirmText: "Delete",
      variant: "destructive",
    });
    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        `${platformConfig.api.baseUrl}/api/v1/plugins/instances/${pluginId}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete plugin instance");
      }

      toast({
        title: "Success",
        description: "Plugin instance deleted successfully",
      });

      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete plugin instance",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Plugin Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage and configure plugin instances
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Plugin
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Puzzle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_plugins}</div>
            <p className="text-xs text-muted-foreground">Plugin instances</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active_plugins}</div>
            <p className="text-xs text-muted-foreground">Running well</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Inactive</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inactive_plugins}</div>
            <p className="text-xs text-muted-foreground">Not running</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Error</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.error_plugins}</div>
            <p className="text-xs text-muted-foreground">Failed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Enabled</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.enabled_plugins}</div>
            <p className="text-xs text-muted-foreground">Configured</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Disabled</CardTitle>
            <XCircle className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.disabled_plugins}</div>
            <p className="text-xs text-muted-foreground">Inactive</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search plugins..."
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
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Plugins Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <Card className="col-span-full">
            <CardContent className="py-8 text-center text-muted-foreground">
              Loading plugin instances...
            </CardContent>
          </Card>
        ) : filteredPlugins.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-8 text-center text-muted-foreground">
              {searchQuery ? "No plugins match your search" : "No plugin instances found"}
            </CardContent>
          </Card>
        ) : (
          filteredPlugins.map((plugin) => (
            <Card key={plugin.id} className="hover:border-primary transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Puzzle className="h-8 w-8 text-primary" />
                    <div>
                      <CardTitle className="text-lg">
                        <Link
                          href={`/dashboard/plugins/${plugin.id}`}
                          className="hover:underline"
                        >
                          {plugin.instance_name}
                        </Link>
                      </CardTitle>
                      <CardDescription>
                        {plugin.plugin_name}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {getStatusBadge(plugin.status)}
                    <Badge variant={plugin.enabled ? "default" : "outline"} className="text-xs">
                      {plugin.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Plugin Type</p>
                  <p className="font-medium">{plugin.plugin_name}</p>
                </div>

                {plugin.last_health_check && (
                  <div className="pt-3 border-t">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Activity className="h-3 w-3" />
                      Last checked {formatDistanceToNow(new Date(plugin.last_health_check), { addSuffix: true })}
                    </p>
                  </div>
                )}

                <div className="pt-3 border-t flex items-center gap-2">
                  <Button variant="outline" size="sm" asChild className="flex-1">
                    <Link href={`/dashboard/plugins/${plugin.id}`}>
                      <Eye className="h-3 w-3 mr-1" />
                      View Details
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleDelete(plugin.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

export default function PluginsPage() {
  return (
    <RouteGuard permission="admin">
      <PluginsPageContent />
    </RouteGuard>
  );
}
