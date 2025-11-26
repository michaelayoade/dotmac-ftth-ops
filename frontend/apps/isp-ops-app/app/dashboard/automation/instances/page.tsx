"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import {
  Server,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Pause,
  Play,
  ArrowUpCircle,
  Maximize2,
  Trash2,
  Activity,
  TrendingUp,
} from "lucide-react";
import { platformConfig } from "@/lib/config";
import { useToast } from "@dotmac/ui";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import Link from "next/link";
import { useConfirmDialog } from "@dotmac/ui";

interface DeploymentInstance {
  id: number;
  name: string;
  template_id: number;
  template_name: string;
  state: string;
  environment: string;
  region: string;
  health_status: string;
  backend: string;
  configuration: Record<string, any>;
  resources: {
    cpu_usage?: number;
    memory_usage?: number;
    disk_usage?: number;
  };
  created_at: string;
  updated_at: string;
  last_deployed_at?: string;
}

function InstancesPageContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [healthFilter, setHealthFilter] = useState<string>("all");
  const [envFilter, setEnvFilter] = useState<string>("all");

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const confirmDialog = useConfirmDialog();

  // Fetch instances
  const {
    data: instances = [],
    isLoading,
    refetch,
  } = useQuery<DeploymentInstance[]>({
    queryKey: ["deployment-instances"],
    queryFn: async () => {
      const response = await fetch(`${platformConfig.api.baseUrl}/api/v1/deployment/instances`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch instances");
      return response.json();
    },
    refetchInterval: 30000, // Auto-refresh every 30s
  });

  // Suspend instance
  const suspendMutation = useMutation({
    mutationFn: async (instanceId: number) => {
      const response = await fetch(`${platformConfig.api.baseUrl}/api/v1/deployment/suspend`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instance_id: instanceId }),
      });
      if (!response.ok) throw new Error("Failed to suspend instance");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deployment-instances"] });
      toast({ title: "Instance suspended successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to suspend instance",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Resume instance
  const resumeMutation = useMutation({
    mutationFn: async (instanceId: number) => {
      const response = await fetch(`${platformConfig.api.baseUrl}/api/v1/deployment/resume`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instance_id: instanceId }),
      });
      if (!response.ok) throw new Error("Failed to resume instance");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deployment-instances"] });
      toast({ title: "Instance resumed successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to resume instance",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete instance
  const deleteMutation = useMutation({
    mutationFn: async (instanceId: number) => {
      const response = await fetch(`${platformConfig.api.baseUrl}/api/v1/deployment/destroy`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instance_id: instanceId }),
      });
      if (!response.ok) throw new Error("Failed to destroy instance");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deployment-instances"] });
      toast({ title: "Instance destroyed successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to destroy instance",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Filter instances
  const filteredInstances = instances.filter((instance) => {
    const matchesSearch =
      !searchQuery ||
      instance.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      instance.template_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      instance.environment.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesState = stateFilter === "all" || instance.state === stateFilter;

    const matchesHealth = healthFilter === "all" || instance.health_status === healthFilter;

    const matchesEnv = envFilter === "all" || instance.environment === envFilter;

    return matchesSearch && matchesState && matchesHealth && matchesEnv;
  });

  const stats = {
    total: instances.length,
    running: instances.filter((i) => i.state === "RUNNING").length,
    stopped: instances.filter((i) => i.state === "STOPPED").length,
    failed: instances.filter((i) => i.health_status === "UNHEALTHY").length,
    byEnv: instances.reduce(
      (acc, i) => {
        acc[i.environment] = (acc[i.environment] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ),
  };

  const getStateBadge = (state: string) => {
    const badges = {
      RUNNING: { icon: CheckCircle, color: "bg-green-100 text-green-800", label: "Running" },
      STOPPED: { icon: XCircle, color: "bg-gray-100 text-gray-800", label: "Stopped" },
      DEPLOYING: { icon: Clock, color: "bg-blue-100 text-blue-800", label: "Deploying" },
      FAILED: { icon: AlertTriangle, color: "bg-red-100 text-red-800", label: "Failed" },
      SUSPENDED: { icon: Pause, color: "bg-amber-100 text-amber-800", label: "Suspended" },
    };
    const config = badges[state as keyof typeof badges] || {
      icon: XCircle,
      color: "bg-gray-100 text-gray-800",
      label: state,
    };
    const Icon = config.icon;
    return (
      <Badge className={config.color}>
        <Icon className={`h-3 w-3 mr-1 ${state === "DEPLOYING" ? "animate-spin" : ""}`} />
        {config.label}
      </Badge>
    );
  };

  const getHealthBadge = (health: string) => {
    const badges = {
      HEALTHY: { color: "bg-green-100 text-green-800", label: "Healthy" },
      DEGRADED: { color: "bg-amber-100 text-amber-800", label: "Degraded" },
      UNHEALTHY: { color: "bg-red-100 text-red-800", label: "Unhealthy" },
      UNKNOWN: { color: "bg-gray-100 text-gray-800", label: "Unknown" },
    };
    const config = badges[health as keyof typeof badges] || badges.UNKNOWN;
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const getBackendBadge = (backend: string) => {
    const badges = {
      AWX_ANSIBLE: { label: "Ansible", color: "bg-red-100 text-red-800" },
      KUBERNETES: { label: "Kubernetes", color: "bg-blue-100 text-blue-800" },
      DOCKER_COMPOSE: { label: "Docker", color: "bg-cyan-100 text-cyan-800" },
    };
    const config = badges[backend as keyof typeof badges] || {
      label: backend,
      color: "bg-gray-100 text-gray-800",
    };
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const getEnvBadge = (env: string) => {
    const badges = {
      production: { color: "bg-purple-100 text-purple-800" },
      staging: { color: "bg-blue-100 text-blue-800" },
      development: { color: "bg-green-100 text-green-800" },
      testing: { color: "bg-amber-100 text-amber-800" },
    };
    const config = badges[env.toLowerCase() as keyof typeof badges] || {
      color: "bg-gray-100 text-gray-800",
    };
    return <Badge className={config.color}>{env}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Deployment Instances</h1>
          <p className="text-sm text-muted-foreground">
            Monitor and manage active deployment instances
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button asChild>
            <Link href="/dashboard/automation/deploy">Deploy New Instance</Link>
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Instances</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All deployments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Running</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.running}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? Math.round((stats.running / stats.total) * 100) : 0}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Stopped</CardTitle>
            <XCircle className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.stopped}</div>
            <p className="text-xs text-muted-foreground">Not running</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Failed/Unhealthy</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.failed}</div>
            <p className="text-xs text-muted-foreground">Needs attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search instances..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All States" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                <SelectItem value="RUNNING">Running</SelectItem>
                <SelectItem value="STOPPED">Stopped</SelectItem>
                <SelectItem value="DEPLOYING">Deploying</SelectItem>
                <SelectItem value="SUSPENDED">Suspended</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={healthFilter} onValueChange={setHealthFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Health" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Health</SelectItem>
                <SelectItem value="HEALTHY">Healthy</SelectItem>
                <SelectItem value="DEGRADED">Degraded</SelectItem>
                <SelectItem value="UNHEALTHY">Unhealthy</SelectItem>
              </SelectContent>
            </Select>

            <Select value={envFilter} onValueChange={setEnvFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Environments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Environments</SelectItem>
                <SelectItem value="production">Production</SelectItem>
                <SelectItem value="staging">Staging</SelectItem>
                <SelectItem value="development">Development</SelectItem>
                <SelectItem value="testing">Testing</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Instances Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <Card className="col-span-full">
            <CardContent className="py-8 text-center text-muted-foreground">
              Loading instances...
            </CardContent>
          </Card>
        ) : filteredInstances.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-8 text-center text-muted-foreground">
              {searchQuery ? "No instances match your search" : "No deployment instances found"}
            </CardContent>
          </Card>
        ) : (
          filteredInstances.map((instance) => (
            <Card key={instance.id} className="hover:border-primary transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <Server className="h-8 w-8 text-primary" />
                  <div className="flex flex-col gap-1 items-end">
                    {getStateBadge(instance.state)}
                    {getHealthBadge(instance.health_status)}
                  </div>
                </div>
                <CardTitle className="mt-2">
                  <Link
                    href={`/dashboard/automation/instances/${instance.id}`}
                    className="hover:underline"
                  >
                    {instance.name}
                  </Link>
                </CardTitle>
                <CardDescription className="line-clamp-1">
                  Template: {instance.template_name}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2 flex-wrap">
                  {getBackendBadge(instance.backend)}
                  {getEnvBadge(instance.environment)}
                  <Badge variant="outline">{instance.region}</Badge>
                </div>

                <div className="space-y-1 text-sm">
                  {instance.resources.cpu_usage !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">CPU:</span>
                      <span className="font-medium">{instance.resources.cpu_usage}%</span>
                    </div>
                  )}
                  {instance.resources.memory_usage !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Memory:</span>
                      <span className="font-medium">{instance.resources.memory_usage}%</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Deployed:</span>
                    <span className="text-xs">
                      {instance.last_deployed_at
                        ? new Date(instance.last_deployed_at).toLocaleDateString()
                        : "N/A"}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t flex gap-2">
                  {instance.state === "SUSPENDED" || instance.state === "STOPPED" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => resumeMutation.mutate(instance.id)}
                      disabled={resumeMutation.isPending}
                      className="flex-1"
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Resume
                    </Button>
                  ) : instance.state === "RUNNING" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => suspendMutation.mutate(instance.id)}
                      disabled={suspendMutation.isPending}
                      className="flex-1"
                    >
                      <Pause className="h-3 w-3 mr-1" />
                      Suspend
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" disabled className="flex-1">
                      <Clock className="h-3 w-3 mr-1" />
                      Busy
                    </Button>
                  )}
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/automation/instances/${instance.id}`}>
                      <Activity className="h-3 w-3" />
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const confirmed = await confirmDialog({
                        title: "Destroy instance",
                        description: `Destroy instance "${instance.name}"? This cannot be undone.`,
                        confirmText: "Destroy",
                        variant: "destructive",
                      });
                      if (!confirmed) {
                        return;
                      }
                      deleteMutation.mutate(instance.id);
                    }}
                    disabled={deleteMutation.isPending}
                    className="text-destructive hover:text-destructive"
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

export default function InstancesPage() {
  return (
    <RouteGuard permission="deployment.instance.read">
      <InstancesPageContent />
    </RouteGuard>
  );
}
