"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import {
  ArrowLeft,
  Server,
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
  FileText,
  Settings,
  BarChart3,
} from "lucide-react";
import { platformConfig } from "@/lib/config";
import { useToast } from "@dotmac/ui";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
    network_in?: number;
    network_out?: number;
  };
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  last_deployed_at?: string;
  deployment_logs?: string[];
}

interface InstanceStatus {
  state: string;
  health_status: string;
  resources: {
    cpu_usage?: number;
    memory_usage?: number;
    disk_usage?: number;
    network_in?: number;
    network_out?: number;
  };
  services?: Array<{
    name: string;
    status: string;
    health: string;
  }>;
  last_check: string;
}

function InstanceDetailsPageContent() {
  const params = useParams();
  const router = useRouter();
  const instanceId = params["instanceId"] as string;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const confirmDialog = useConfirmDialog();

  const {
    data: instance,
    isLoading,
    refetch,
  } = useQuery<DeploymentInstance>({
    queryKey: ["deployment-instance", instanceId],
    queryFn: async () => {
      const response = await fetch(
        `${platformConfig.api.baseUrl}/api/v1/deployment/instances/${instanceId}`,
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("Failed to fetch instance");
      return response.json();
    },
    refetchInterval: 30000,
  });

  const { data: status } = useQuery<InstanceStatus>({
    queryKey: ["deployment-instance-status", instanceId],
    queryFn: async () => {
      const response = await fetch(
        `${platformConfig.api.baseUrl}/api/v1/deployment/instances/${instanceId}/status`,
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("Failed to fetch status");
      return response.json();
    },
    refetchInterval: 10000,
  });

  const suspendMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${platformConfig.api.baseUrl}/api/v1/deployment/suspend`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instance_id: parseInt(instanceId) }),
      });
      if (!response.ok) throw new Error("Failed to suspend");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deployment-instance", instanceId] });
      toast({ title: "Instance suspended" });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${platformConfig.api.baseUrl}/api/v1/deployment/resume`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instance_id: parseInt(instanceId) }),
      });
      if (!response.ok) throw new Error("Failed to resume");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deployment-instance", instanceId] });
      toast({ title: "Instance resumed" });
    },
  });

  const upgradeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${platformConfig.api.baseUrl}/api/v1/deployment/upgrade`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instance_id: parseInt(instanceId) }),
      });
      if (!response.ok) throw new Error("Failed to upgrade");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deployment-instance", instanceId] });
      toast({ title: "Upgrade initiated" });
    },
  });

  const scaleMutation = useMutation({
    mutationFn: async (replicas: number) => {
      const response = await fetch(`${platformConfig.api.baseUrl}/api/v1/deployment/scale`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instance_id: parseInt(instanceId), replicas }),
      });
      if (!response.ok) throw new Error("Failed to scale");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deployment-instance", instanceId] });
      toast({ title: "Scaling initiated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${platformConfig.api.baseUrl}/api/v1/deployment/destroy`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instance_id: parseInt(instanceId) }),
      });
      if (!response.ok) throw new Error("Failed to destroy");
    },
    onSuccess: () => {
      toast({ title: "Instance destroyed" });
      router.push("/dashboard/automation/instances");
    },
  });

  if (isLoading || !instance) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const getStateBadge = (state: string) => {
    const badges = {
      RUNNING: { icon: CheckCircle, color: "bg-green-100 text-green-800" },
      STOPPED: { icon: XCircle, color: "bg-gray-100 text-gray-800" },
      DEPLOYING: { icon: Clock, color: "bg-blue-100 text-blue-800" },
      FAILED: { icon: AlertTriangle, color: "bg-red-100 text-red-800" },
      SUSPENDED: { icon: Pause, color: "bg-amber-100 text-amber-800" },
    };
    const config = badges[state as keyof typeof badges] || {
      icon: XCircle,
      color: "bg-gray-100 text-gray-800",
    };
    const Icon = config.icon;
    return (
      <Badge className={config.color}>
        <Icon className={`h-3 w-3 mr-1 ${state === "DEPLOYING" ? "animate-spin" : ""}`} />
        {state}
      </Badge>
    );
  };

  const getHealthBadge = (health: string) => {
    const badges = {
      HEALTHY: { color: "bg-green-100 text-green-800" },
      DEGRADED: { color: "bg-amber-100 text-amber-800" },
      UNHEALTHY: { color: "bg-red-100 text-red-800" },
      UNKNOWN: { color: "bg-gray-100 text-gray-800" },
    };
    const config = badges[health as keyof typeof badges] || badges.UNKNOWN;
    return <Badge className={config.color}>{health}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/automation/instances">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{instance.name}</h1>
            <p className="text-sm text-muted-foreground">Template: {instance.template_name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {instance.state === "SUSPENDED" || instance.state === "STOPPED" ? (
            <Button onClick={() => resumeMutation.mutate()}>
              <Play className="h-4 w-4 mr-2" />
              Resume
            </Button>
          ) : instance.state === "RUNNING" ? (
            <Button variant="outline" onClick={() => suspendMutation.mutate()}>
              <Pause className="h-4 w-4 mr-2" />
              Suspend
            </Button>
          ) : null}
          <Button
            variant="outline"
            onClick={() => upgradeMutation.mutate()}
            disabled={instance.state !== "RUNNING"}
          >
            <ArrowUpCircle className="h-4 w-4 mr-2" />
            Upgrade
          </Button>
          <Button
            variant="destructive"
            onClick={async () => {
              const confirmed = await confirmDialog({
                title: "Destroy instance",
                description: `Destroy instance "${instance.name}"?`,
                confirmText: "Destroy",
                variant: "destructive",
              });
              if (!confirmed) {
                return;
              }
              deleteMutation.mutate();
            }}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Destroy
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">State</CardTitle>
          </CardHeader>
          <CardContent>{getStateBadge(instance.state)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Health</CardTitle>
          </CardHeader>
          <CardContent>{getHealthBadge(instance.health_status)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Environment</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge>{instance.environment}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Region</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline">{instance.region}</Badge>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">
            <Server className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="resources">
            <BarChart3 className="h-4 w-4 mr-2" />
            Resources
          </TabsTrigger>
          <TabsTrigger value="configuration">
            <Settings className="h-4 w-4 mr-2" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="logs">
            <FileText className="h-4 w-4 mr-2" />
            Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Instance Information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Instance ID</p>
                <p className="font-mono text-sm">{instance.id}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Template</p>
                <p className="font-medium">{instance.template_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Backend</p>
                <p className="font-medium">{instance.backend}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="text-sm">{new Date(instance.created_at).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Updated</p>
                <p className="text-sm">{new Date(instance.updated_at).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Deployed</p>
                <p className="text-sm">
                  {instance.last_deployed_at
                    ? new Date(instance.last_deployed_at).toLocaleString()
                    : "N/A"}
                </p>
              </div>
            </CardContent>
          </Card>

          {status?.services && status.services.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Services</CardTitle>
                <CardDescription>Running services in this deployment</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {status.services.map((service, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Activity className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{service.name}</span>
                      </div>
                      <div className="flex gap-2">
                        <Badge
                          className={
                            service.status === "running"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }
                        >
                          {service.status}
                        </Badge>
                        {getHealthBadge(service.health)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="resources" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Resource Usage</CardTitle>
              <CardDescription>
                Last updated: {status ? new Date(status.last_check).toLocaleString() : "N/A"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {instance.resources.cpu_usage !== undefined && (
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">CPU</span>
                    <span className="text-sm text-muted-foreground">
                      {instance.resources.cpu_usage}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${instance.resources.cpu_usage}%` }}
                    />
                  </div>
                </div>
              )}
              {instance.resources.memory_usage !== undefined && (
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Memory</span>
                    <span className="text-sm text-muted-foreground">
                      {instance.resources.memory_usage}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full"
                      style={{ width: `${instance.resources.memory_usage}%` }}
                    />
                  </div>
                </div>
              )}
              {instance.resources.disk_usage !== undefined && (
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Disk</span>
                    <span className="text-sm text-muted-foreground">
                      {instance.resources.disk_usage}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-amber-600 h-2 rounded-full"
                      style={{ width: `${instance.resources.disk_usage}%` }}
                    />
                  </div>
                </div>
              )}
              {(instance.resources.network_in !== undefined ||
                instance.resources.network_out !== undefined) && (
                <div className="grid gap-3 md:grid-cols-2 pt-4 border-t">
                  {instance.resources.network_in !== undefined && (
                    <div>
                      <p className="text-sm text-muted-foreground">Network In</p>
                      <p className="text-lg font-bold">
                        {(instance.resources.network_in / 1024 / 1024).toFixed(2)} MB/s
                      </p>
                    </div>
                  )}
                  {instance.resources.network_out !== undefined && (
                    <div>
                      <p className="text-sm text-muted-foreground">Network Out</p>
                      <p className="text-lg font-bold">
                        {(instance.resources.network_out / 1024 / 1024).toFixed(2)} MB/s
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configuration" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-96">
                {JSON.stringify(instance.configuration, null, 2)}
              </pre>
            </CardContent>
          </Card>

          {instance.metadata && Object.keys(instance.metadata).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Metadata</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-96">
                  {JSON.stringify(instance.metadata, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Deployment Logs</CardTitle>
              <CardDescription>Recent deployment activity</CardDescription>
            </CardHeader>
            <CardContent>
              {instance.deployment_logs && instance.deployment_logs.length > 0 ? (
                <pre className="text-xs font-mono bg-black text-green-400 p-4 rounded-lg overflow-auto max-h-96">
                  {instance.deployment_logs.join("\n")}
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No logs available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function InstanceDetailsPage() {
  return (
    <RouteGuard permission="deployment.instance.read">
      <InstanceDetailsPageContent />
    </RouteGuard>
  );
}
