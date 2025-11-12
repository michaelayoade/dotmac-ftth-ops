"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@dotmac/ui";
import {
  Download,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  Zap,
} from "lucide-react";
import { WorkflowsList } from "@/components/orchestration/WorkflowsList";
import { WorkflowDetailModal } from "@/components/orchestration/WorkflowDetailModal";
import { useOrchestrationWorkflows, type Workflow, type WorkflowStatus, type WorkflowType } from "@/hooks/useOrchestrationWorkflows";

export default function OrchestrationPage() {
  const { useWorkflowStats, exportWorkflows } = useOrchestrationWorkflows();
  const { data: stats, isLoading: statsLoading } = useWorkflowStats();
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<WorkflowStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<WorkflowType | "all">("all");

  const handleViewDetails = (workflow: Workflow) => {
    setSelectedWorkflow(workflow);
    setDetailModalOpen(true);
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      {/* Page Header */}
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Workflow Orchestration</h2>
          <p className="text-muted-foreground">
            Monitor and manage distributed workflows across systems
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => exportWorkflows("csv")}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={() => exportWorkflows("json")}>
            <Download className="mr-2 h-4 w-4" />
            Export JSON
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Workflows</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? "-" : stats?.total_workflows.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">All time executions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? "-" : `${(stats?.success_rate || 0).toFixed(1)}%`}
            </div>
            <p className="text-xs text-muted-foreground">Successfully completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Workflows</CardTitle>
            <Zap className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? "-" : stats?.active_workflows || 0}
            </div>
            <p className="text-xs text-muted-foreground">Currently running</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading
                ? "-"
                : stats?.average_duration_seconds
                ? `${stats.average_duration_seconds.toFixed(1)}s`
                : "-"}
            </div>
            <p className="text-xs text-muted-foreground">Per workflow</p>
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown */}
      {!statsLoading && stats && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Status Breakdown</CardTitle>
              <CardDescription>Workflows by current status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(stats.by_status || {}).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <span className="text-sm capitalize">{status.replace("_", " ")}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{count}</span>
                      <div className="w-32 bg-muted rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            status === "completed"
                              ? "bg-green-500"
                              : status === "failed"
                              ? "bg-destructive"
                              : "bg-blue-500"
                          }`}
                          style={{
                            width: `${((count as number) / stats.total_workflows) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Workflow Types</CardTitle>
              <CardDescription>Distribution by workflow type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(stats.by_type || {}).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-sm capitalize">{type.replace("_", " ")}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{count}</span>
                      <div className="w-32 bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full"
                          style={{
                            width: `${((count as number) / stats.total_workflows) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="workflows" className="space-y-4">
        <TabsList>
          <TabsTrigger value="workflows">Workflows</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
        </TabsList>

        {/* All Workflows Tab */}
        <TabsContent value="workflows" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
              <CardDescription>Filter workflows by status or type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select
                    value={statusFilter}
                    onValueChange={(value) => setStatusFilter(value as WorkflowStatus | "all")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="running">Running</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="partially_completed">Partially Completed</SelectItem>
                      <SelectItem value="rolling_back">Rolling Back</SelectItem>
                      <SelectItem value="rolled_back">Rolled Back</SelectItem>
                      <SelectItem value="rollback_failed">Rollback Failed</SelectItem>
                      <SelectItem value="timeout">Timeout</SelectItem>
                      <SelectItem value="compensated">Compensated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Type</label>
                  <Select
                    value={typeFilter}
                    onValueChange={(value) => setTypeFilter(value as WorkflowType | "all")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="provision_subscriber">Provision Subscriber</SelectItem>
                      <SelectItem value="deprovision_subscriber">Deprovision Subscriber</SelectItem>
                      <SelectItem value="activate_service">Activate Service</SelectItem>
                      <SelectItem value="suspend_service">Suspend Service</SelectItem>
                      <SelectItem value="terminate_service">Terminate Service</SelectItem>
                      <SelectItem value="change_service_plan">Change Service Plan</SelectItem>
                      <SelectItem value="update_network_config">Update Network Config</SelectItem>
                      <SelectItem value="migrate_subscriber">Migrate Subscriber</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Workflows List */}
          <Card>
            <CardHeader>
              <CardTitle>All Workflows</CardTitle>
              <CardDescription>View and manage workflow executions</CardDescription>
            </CardHeader>
            <CardContent>
              <WorkflowsList onViewDetails={handleViewDetails} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Active Workflows Tab */}
        <TabsContent value="active" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Workflows</CardTitle>
              <CardDescription>Currently running or pending workflows</CardDescription>
            </CardHeader>
            <CardContent>
              <WorkflowsList onViewDetails={handleViewDetails} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Workflow Detail Modal */}
      <WorkflowDetailModal
        workflowId={selectedWorkflow?.workflow_id || null}
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
      />
    </div>
  );
}
