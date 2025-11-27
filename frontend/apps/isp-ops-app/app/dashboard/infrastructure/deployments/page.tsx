"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, RefreshCw, Server, Play, Pause, Trash2 } from "lucide-react";
import { Button } from "@dotmac/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import { Skeleton } from "@dotmac/ui";
import { apiClient } from "@/lib/api/client";

interface DeploymentInstance {
  id: number;
  tenant_id: string;
  template_id: number;
  environment: string;
  region: string;
  state: "provisioning" | "running" | "suspended" | "failed" | "destroying";
  health_status: string;
  version: string;
  created_at: string;
}

export default function DeploymentsPage() {
  // Fetch deployment instances
  const {
    data: instances,
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["deployment-instances"],
    queryFn: async () => {
      const response = await apiClient.get("/deployment/instances");
      return response.data.instances as DeploymentInstance[];
    },
    refetchInterval: 30000,
  });

  const getStateBadge = (state: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      running: "default",
      provisioning: "secondary",
      suspended: "outline",
      failed: "destructive",
      destroying: "destructive",
    };

    return <Badge variant={variants[state] || "outline"}>{state.toUpperCase()}</Badge>;
  };

  const getHealthBadge = (status: string) => {
    if (status === "healthy") return <Badge variant="default">Healthy</Badge>;
    if (status === "degraded") return <Badge variant="secondary">Degraded</Badge>;
    return <Badge variant="destructive">Unhealthy</Badge>;
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Deployment Orchestration</h1>
          <p className="text-sm text-muted-foreground">
            Manage infrastructure deployments, upgrades, and scaling operations
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading || isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Deployment
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Deployments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{instances?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Running</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {instances?.filter((i) => i.state === "running").length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Provisioning
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {instances?.filter((i) => i.state === "provisioning").length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Suspended</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">
              {instances?.filter((i) => i.state === "suspended").length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {instances?.filter((i) => i.state === "failed").length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deployments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Active Deployments</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : instances && instances.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Environment</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Health</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instances.map((instance) => (
                  <TableRow key={instance.id}>
                    <TableCell className="font-mono">#{instance.id}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{instance.environment}</Badge>
                    </TableCell>
                    <TableCell>{instance.region}</TableCell>
                    <TableCell className="font-mono text-sm">{instance.version}</TableCell>
                    <TableCell>{getStateBadge(instance.state)}</TableCell>
                    <TableCell>{getHealthBadge(instance.health_status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(instance.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {instance.state === "running" ? (
                          <Button variant="outline" size="sm">
                            <Pause className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm">
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Server className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No deployments found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first deployment to get started
              </p>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Deployment
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
