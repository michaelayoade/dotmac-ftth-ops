"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { useToast } from "@dotmac/ui";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import { useAppConfig } from "@/providers/AppConfigContext";
import {
  RefreshCw,
  Plus,
  TrendingUp,
  DollarSign,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { Switch } from "@dotmac/ui";

interface DunningStats {
  total_campaigns: number;
  active_campaigns: number;
  total_executions: number;
  active_executions: number;
  completed_executions: number;
  failed_executions: number;
  canceled_executions: number;
  total_recovered_amount: number;
  average_recovery_rate: number;
  average_completion_time_hours: number;
}

interface DunningCampaign {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  trigger_after_days: number;
  max_retries: number;
  retry_interval_days: number;
  actions: Array<any>;
  exclusion_rules: any;
  is_active: boolean;
  priority: number;
  total_executions: number;
  successful_executions: number;
  total_recovered_amount: number;
  created_at: string;
  updated_at: string;
}

interface DunningExecution {
  id: string;
  tenant_id: string;
  campaign_id: string;
  subscription_id: string;
  customer_id: string;
  invoice_id?: string;
  status: "pending" | "in_progress" | "completed" | "failed" | "canceled";
  current_step: number;
  total_steps: number;
  retry_count: number;
  started_at: string;
  next_action_at?: string;
  completed_at?: string;
  outstanding_amount: number;
  recovered_amount: number;
  execution_log: Array<any>;
  canceled_reason?: string;
  canceled_by_user_id?: string;
  metadata: any;
  created_at: string;
  updated_at: string;
}

const formatMoney = (amountInCents: number): string => {
  return `$${(amountInCents / 100).toFixed(2)}`;
};

const getStatusBadgeVariant = (
  status: DunningExecution["status"],
): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case "pending":
      return "secondary";
    case "in_progress":
      return "default";
    case "completed":
      return "outline";
    case "failed":
      return "destructive";
    case "canceled":
      return "secondary";
    default:
      return "default";
  }
};

const getStatusColor = (status: DunningExecution["status"]): string => {
  switch (status) {
    case "pending":
      return "text-yellow-600";
    case "in_progress":
      return "text-blue-600";
    case "completed":
      return "text-green-600";
    case "failed":
      return "text-red-600";
    case "canceled":
      return "text-gray-600";
    default:
      return "text-gray-600";
  }
};

function DunningManagementContent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { api } = useAppConfig();
  const apiBaseUrl = api.baseUrl || "";

  const { data: stats, isLoading: statsLoading } = useQuery<DunningStats>({
    queryKey: ["dunning", "stats", apiBaseUrl],
    queryFn: async () => {
      const response = await fetch(`${apiBaseUrl}/api/v1/billing/dunning/stats`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch dunning stats");
      }
      return response.json();
    },
    refetchInterval: 30000,
  });

  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery<DunningCampaign[]>({
    queryKey: ["dunning", "campaigns", apiBaseUrl],
    queryFn: async () => {
      const response = await fetch(`${apiBaseUrl}/api/v1/billing/dunning/campaigns`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch dunning campaigns");
      }
      return response.json();
    },
    refetchInterval: 30000,
  });

  const { data: executions = [], isLoading: executionsLoading } = useQuery<DunningExecution[]>({
    queryKey: ["dunning", "executions", apiBaseUrl],
    queryFn: async () => {
      const response = await fetch(`${apiBaseUrl}/api/v1/billing/dunning/executions`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch dunning executions");
      }
      return response.json();
    },
    refetchInterval: 30000,
  });

  const toggleCampaignMutation = useMutation({
    mutationFn: async ({ campaignId, isActive }: { campaignId: string; isActive: boolean }) => {
      const response = await fetch(`${apiBaseUrl}/api/v1/billing/dunning/campaigns/${campaignId}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ is_active: isActive }),
      });
      if (!response.ok) {
        throw new Error("Failed to update campaign");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dunning", "campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["dunning", "stats"] });
      toast({
        title: "Success",
        description: "Campaign status updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update campaign status",
        variant: "destructive",
      });
    },
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["dunning"] });
    toast({
      title: "Refreshed",
      description: "Dunning data has been refreshed",
    });
  };

  const activeCampaigns = campaigns.filter((c) => c.is_active);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dunning Management</h1>
          <p className="text-muted-foreground">
            Manage dunning campaigns and track payment recovery
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={statsLoading}>
            <RefreshCw className={`h-4 w-4 ${statsLoading ? "animate-spin" : ""}`} />
          </Button>
          <Button asChild>
            <Link href="/dashboard/billing-revenue/dunning/campaigns/new">
              <Plus className="h-4 w-4 mr-2" />
              Create Campaign
            </Link>
          </Button>
        </div>
      </div>

      {/* Statistics Cards - Row 1 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_campaigns ?? 0}</div>
            <p className="text-xs text-muted-foreground">{stats?.active_campaigns ?? 0} active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.active_campaigns ?? 0}</div>
            <p className="text-xs text-muted-foreground">Currently running</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Recovered</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMoney(stats?.total_recovered_amount ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground">All time recovery</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Recovery Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.average_recovery_rate?.toFixed(1) ?? 0}%
            </div>
            <p className="text-xs text-muted-foreground">Success rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Statistics Cards - Row 2 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Executions</CardTitle>
            <Activity className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.active_executions ?? 0}</div>
            <p className="text-xs text-muted-foreground">In progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Executions</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.completed_executions ?? 0}</div>
            <p className="text-xs text-muted-foreground">Successfully completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Executions</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.failed_executions ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.canceled_executions ?? 0} canceled
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Completion Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.average_completion_time_hours?.toFixed(1) ?? 0}h
            </div>
            <p className="text-xs text-muted-foreground">Average duration</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="campaigns" className="space-y-4">
        <TabsList>
          <TabsTrigger value="campaigns">Active Campaigns</TabsTrigger>
          <TabsTrigger value="executions">Recent Executions</TabsTrigger>
        </TabsList>

        {/* Active Campaigns Tab */}
        <TabsContent value="campaigns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Campaigns</CardTitle>
            </CardHeader>
            <CardContent>
              {campaignsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : activeCampaigns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No active campaigns found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Trigger After</TableHead>
                      <TableHead>Total Executions</TableHead>
                      <TableHead>Success Rate</TableHead>
                      <TableHead>Recovered</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeCampaigns.map((campaign) => {
                      const successRate =
                        campaign.total_executions > 0
                          ? (
                              (campaign.successful_executions / campaign.total_executions) *
                              100
                            ).toFixed(1)
                          : "0.0";
                      return (
                        <TableRow key={campaign.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{campaign.name}</div>
                              {campaign.description && (
                                <div className="text-sm text-muted-foreground">
                                  {campaign.description}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">P{campaign.priority}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={campaign.is_active ? "default" : "secondary"}>
                              {campaign.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>{campaign.trigger_after_days} days</TableCell>
                          <TableCell>{campaign.total_executions}</TableCell>
                          <TableCell>{successRate}%</TableCell>
                          <TableCell>{formatMoney(campaign.total_recovered_amount)}</TableCell>
                          <TableCell>
                            <Switch
                              checked={campaign.is_active}
                              onCheckedChange={(checked) => {
                                toggleCampaignMutation.mutate({
                                  campaignId: campaign.id,
                                  isActive: checked,
                                });
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" asChild>
                              <Link
                                href={`/dashboard/billing-revenue/dunning/campaigns/${campaign.id}`}
                              >
                                View
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recent Executions Tab */}
        <TabsContent value="executions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Executions</CardTitle>
            </CardHeader>
            <CardContent>
              {executionsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : executions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No executions found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Execution ID</TableHead>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Outstanding</TableHead>
                      <TableHead>Recovered</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Next Action</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {executions.map((execution) => {
                      const campaign = campaigns.find((c) => c.id === execution.campaign_id);
                      return (
                        <TableRow key={execution.id}>
                          <TableCell className="font-mono text-sm">
                            {execution.id.substring(0, 8)}
                          </TableCell>
                          <TableCell>{campaign?.name ?? execution.campaign_id}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {execution.customer_id.substring(0, 8)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={getStatusBadgeVariant(execution.status)}
                              className={getStatusColor(execution.status)}
                            >
                              {execution.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="text-sm">
                                {execution.current_step} / {execution.total_steps}
                              </span>
                              <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-600"
                                  style={{
                                    width: `${
                                      (execution.current_step / execution.total_steps) * 100
                                    }%`,
                                  }}
                                />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{formatMoney(execution.outstanding_amount)}</TableCell>
                          <TableCell>{formatMoney(execution.recovered_amount)}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {formatDistanceToNow(new Date(execution.started_at), {
                                addSuffix: true,
                              })}
                            </div>
                          </TableCell>
                          <TableCell>
                            {execution.next_action_at ? (
                              <div className="text-sm">
                                {formatDistanceToNow(new Date(execution.next_action_at), {
                                  addSuffix: true,
                                })}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" asChild>
                              <Link
                                href={`/dashboard/billing-revenue/dunning/executions/${execution.id}`}
                              >
                                View
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function DunningManagementPage() {
  return (
    <RouteGuard permission="billing:write">
      <DunningManagementContent />
    </RouteGuard>
  );
}
