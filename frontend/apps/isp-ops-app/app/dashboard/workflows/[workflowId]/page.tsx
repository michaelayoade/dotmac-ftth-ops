"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import {
  ArrowLeft,
  GitBranch,
  CheckCircle,
  XCircle,
  Clock,
  Loader,
  Play,
  FileCode,
  BarChart3,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { useAppConfig } from "@/providers/AppConfigContext";
import { useToast } from "@dotmac/ui";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns";

type WorkflowStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";

interface Workflow {
  id: number;
  name: string;
  description?: string;
  version: string;
  is_active: boolean;
  tags?: string[];
  definition: any;
  created_at: string;
  updated_at: string;
}

interface WorkflowExecution {
  id: number;
  workflow_id: number;
  status: WorkflowStatus;
  trigger_type?: string;
  trigger_source?: string;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

function WorkflowDetailsPageContent() {
  const params = useParams();
  const workflowId = params?.["workflowId"] as string;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { api } = useAppConfig();
  const apiBaseUrl = api.baseUrl || "";

  // Fetch workflow details
  const { data: workflow, isLoading } = useQuery<Workflow>({
    queryKey: ["workflow", workflowId, apiBaseUrl],
    queryFn: async () => {
      const response = await fetch(`${apiBaseUrl}/api/v1/workflows/${workflowId}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch workflow");
      return response.json();
    },
    enabled: !!workflowId,
  });

  // Fetch recent executions
  const { data: executions = [] } = useQuery<WorkflowExecution[]>({
    queryKey: ["workflow-executions", workflowId, apiBaseUrl],
    queryFn: async () => {
      const response = await fetch(
        `${apiBaseUrl}/api/v1/workflows/executions?workflow_id=${workflowId}&limit=20`,
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("Failed to fetch executions");
      const data = await response.json();
      return data.executions || [];
    },
    enabled: !!workflowId,
    refetchInterval: (query) => {
      // Auto-refresh if there are running executions
      if (
        query?.state?.data &&
        query.state.data.some(
          (e: WorkflowExecution) => e.status === "RUNNING" || e.status === "PENDING",
        )
      ) {
        return 5000; // Refresh every 5 seconds
      }
      return false;
    },
  });

  // Execute workflow mutation
  const executeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${apiBaseUrl}/api/v1/workflows/${workflowId}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          context: {},
          trigger_type: "manual",
          trigger_source: "ui",
        }),
      });
      if (!response.ok) throw new Error("Failed to execute workflow");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow-executions", workflowId] });
      toast({ title: "Workflow execution started" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to execute workflow",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Toggle active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async (isActive: boolean) => {
      const response = await fetch(`${apiBaseUrl}/api/v1/workflows/${workflowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ is_active: isActive }),
      });
      if (!response.ok) throw new Error("Failed to update workflow");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow", workflowId] });
      toast({ title: "Workflow status updated" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update workflow",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: WorkflowStatus) => {
    const statusConfig: Record<WorkflowStatus, { icon: any; color: string; label: string }> = {
      PENDING: { icon: Clock, color: "bg-gray-100 text-gray-800", label: "Pending" },
      RUNNING: { icon: Loader, color: "bg-blue-100 text-blue-800", label: "Running" },
      COMPLETED: { icon: CheckCircle, color: "bg-green-100 text-green-800", label: "Completed" },
      FAILED: { icon: XCircle, color: "bg-red-100 text-red-800", label: "Failed" },
      CANCELLED: { icon: AlertCircle, color: "bg-gray-100 text-gray-800", label: "Cancelled" },
    };

    const config = statusConfig[status] || statusConfig.PENDING;
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
        <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Workflow Not Found</h2>
        <p className="text-muted-foreground mb-4">
          The workflow you&apos;re looking for doesn&apos;t exist.
        </p>
        <Button asChild>
          <Link href="/dashboard/workflows">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Workflows
          </Link>
        </Button>
      </div>
    );
  }

  const executionStats = {
    total: executions.length,
    completed: executions.filter((e) => e.status === "COMPLETED").length,
    failed: executions.filter((e) => e.status === "FAILED").length,
    running: executions.filter((e) => e.status === "RUNNING" || e.status === "PENDING").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/dashboard/workflows">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{workflow.name}</h1>
            <p className="text-sm text-muted-foreground">Version {workflow.version}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {workflow.is_active ? (
            <Badge className="bg-green-100 text-green-800">
              <CheckCircle className="h-3 w-3 mr-1" />
              Active
            </Badge>
          ) : (
            <Badge className="bg-gray-100 text-gray-800">
              <XCircle className="h-3 w-3 mr-1" />
              Inactive
            </Badge>
          )}
          <Button
            variant="outline"
            onClick={() => toggleActiveMutation.mutate(!workflow.is_active)}
            disabled={toggleActiveMutation.isPending}
          >
            {workflow.is_active ? "Deactivate" : "Activate"}
          </Button>
          <Button
            onClick={() => executeMutation.mutate()}
            disabled={executeMutation.isPending || !workflow.is_active}
          >
            <Play className="h-4 w-4 mr-2" />
            Execute
          </Button>
        </div>
      </div>

      {/* Execution Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Executions</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{executionStats.total}</div>
            <p className="text-xs text-muted-foreground">Recent runs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{executionStats.completed}</div>
            <p className="text-xs text-muted-foreground">Successful</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{executionStats.failed}</div>
            <p className="text-xs text-muted-foreground">Errors</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Running</CardTitle>
            <Loader className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{executionStats.running}</div>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="definition">Definition</TabsTrigger>
          <TabsTrigger value="executions">Recent Executions</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Workflow Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Description</p>
                <p className="font-medium">{workflow.description || "No description provided"}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Created At</p>
                  </div>
                  <p className="font-medium">{format(new Date(workflow.created_at), "PPpp")}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Last Updated</p>
                  </div>
                  <p className="font-medium">{format(new Date(workflow.updated_at), "PPpp")}</p>
                </div>
              </div>

              {workflow.tags && workflow.tags.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {workflow.tags.map((tag, index) => (
                      <Badge key={index} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Definition Tab */}
        <TabsContent value="definition" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Workflow Definition</CardTitle>
              <CardDescription>Workflow configuration and steps</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="p-4 bg-accent rounded-lg overflow-x-auto text-sm">
                {JSON.stringify(workflow.definition, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Executions Tab */}
        <TabsContent value="executions" className="space-y-4">
          {executions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No executions yet
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {executions.map((execution) => (
                <Card key={execution.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">Execution #{execution.id}</CardTitle>
                        <CardDescription>
                          {execution.trigger_type && `Triggered by ${execution.trigger_type}`}
                          {execution.trigger_source && ` (${execution.trigger_source})`}
                        </CardDescription>
                      </div>
                      {getStatusBadge(execution.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {execution.error_message && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-3">
                        <p className="text-sm text-red-800">{execution.error_message}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Created</p>
                        <p className="font-medium">
                          {format(new Date(execution.created_at), "PPpp")}
                        </p>
                      </div>
                      {execution.started_at && (
                        <div>
                          <p className="text-muted-foreground">Started</p>
                          <p className="font-medium">
                            {format(new Date(execution.started_at), "PPpp")}
                          </p>
                        </div>
                      )}
                      {execution.completed_at && (
                        <div>
                          <p className="text-muted-foreground">Completed</p>
                          <p className="font-medium">
                            {format(new Date(execution.completed_at), "PPpp")}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function WorkflowDetailsPage() {
  return (
    <RouteGuard permission="workflows:read">
      <WorkflowDetailsPageContent />
    </RouteGuard>
  );
}
