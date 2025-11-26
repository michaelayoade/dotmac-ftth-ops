"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import {
  GitBranch,
  Search,
  RefreshCw,
  Eye,
  Play,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  Loader,
  BarChart3,
  Zap,
  FileCode,
} from "lucide-react";
import { useAppConfig } from "@/providers/AppConfigContext";
import { useToast } from "@dotmac/ui";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import { useConfirmDialog } from "@dotmac/ui";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

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
  execution_count?: number;
  success_rate?: number;
}

interface WorkflowStats {
  total_workflows: number;
  active_workflows: number;
  total_executions: number;
  running_executions: number;
  success_rate: number;
}

function WorkflowsPageContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const confirmDialog = useConfirmDialog();
  const { api } = useAppConfig();
  const apiBaseUrl = api.baseUrl || "";

  // Fetch workflows
  const {
    data: workflows = [],
    isLoading,
    refetch,
  } = useQuery<Workflow[]>({
    queryKey: ["workflows", activeFilter, apiBaseUrl],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeFilter === "active") params.append("is_active", "true");
      if (activeFilter === "inactive") params.append("is_active", "false");

      const response = await fetch(`${apiBaseUrl}/api/v1/workflows?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch workflows");
      const data = await response.json();
      return data.workflows || [];
    },
  });

  // Fetch statistics
  const { data: stats } = useQuery<WorkflowStats>({
    queryKey: ["workflow-stats", apiBaseUrl],
    queryFn: async () => {
      const response = await fetch(`${apiBaseUrl}/api/v1/workflows/stats`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
  });

  // Delete workflow mutation
  const deleteMutation = useMutation({
    mutationFn: async (workflowId: number) => {
      const response = await fetch(`${apiBaseUrl}/api/v1/workflows/${workflowId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete workflow");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      queryClient.invalidateQueries({ queryKey: ["workflow-stats"] });
      toast({ title: "Workflow deleted successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete workflow",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredWorkflows = workflows.filter((workflow) => {
    const matchesSearch =
      !searchQuery ||
      workflow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (workflow.description &&
        workflow.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (workflow.tags &&
        workflow.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase())));

    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Workflows</h1>
          <p className="text-sm text-muted-foreground">
            Manage automation workflows and executions
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Workflows</CardTitle>
              <GitBranch className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_workflows}</div>
              <p className="text-xs text-muted-foreground">All templates</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.active_workflows}</div>
              <p className="text-xs text-muted-foreground">Enabled</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Executions</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_executions}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Running</CardTitle>
              <Loader className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.running_executions}</div>
              <p className="text-xs text-muted-foreground">In progress</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <Zap className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.success_rate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">Completion</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search workflows..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={activeFilter} onValueChange={setActiveFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Workflows" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Workflows</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="inactive">Inactive Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Workflows Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <Card className="col-span-full">
            <CardContent className="py-8 text-center text-muted-foreground">
              Loading workflows...
            </CardContent>
          </Card>
        ) : filteredWorkflows.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-8 text-center text-muted-foreground">
              {searchQuery ? "No workflows match your search" : "No workflows found"}
            </CardContent>
          </Card>
        ) : (
          filteredWorkflows.map((workflow) => (
            <Card key={workflow.id} className="hover:border-primary transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <GitBranch className="h-8 w-8 text-primary" />
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
                  </div>
                </div>
                <CardTitle className="mt-2">
                  <Link href={`/dashboard/workflows/${workflow.id}`} className="hover:underline">
                    {workflow.name}
                  </Link>
                </CardTitle>
                <CardDescription className="line-clamp-2">
                  {workflow.description || "No description"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Version:</span>
                    <span className="font-medium">{workflow.version}</span>
                  </div>
                  {workflow.execution_count !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Executions:</span>
                      <span className="font-medium">
                        {workflow.execution_count.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {workflow.success_rate !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Success Rate:</span>
                      <span className="font-medium">{workflow.success_rate.toFixed(1)}%</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Updated:</span>
                    <span className="font-medium">
                      {formatDistanceToNow(new Date(workflow.updated_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>

                {workflow.tags && workflow.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {workflow.tags.map((tag, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="pt-3 border-t flex gap-2">
                  <Button variant="outline" size="sm" asChild className="flex-1">
                    <Link href={`/dashboard/workflows/${workflow.id}`}>
                      <Eye className="h-3 w-3 mr-1" />
                      View
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild className="flex-1">
                    <Link href={`/dashboard/workflows/${workflow.id}/executions`}>
                      <FileCode className="h-3 w-3 mr-1" />
                      Executions
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const confirmed = await confirmDialog({
                        title: "Delete workflow",
                        description: `Delete workflow "${workflow.name}"?`,
                        confirmText: "Delete",
                        variant: "destructive",
                      });
                      if (confirmed) {
                        deleteMutation.mutate(workflow.id);
                      }
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

export default function WorkflowsPage() {
  return (
    <RouteGuard permission="workflows:read">
      <WorkflowsPageContent />
    </RouteGuard>
  );
}
