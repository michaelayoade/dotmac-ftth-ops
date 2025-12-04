"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@dotmac/ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@dotmac/ui";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import { Switch } from "@dotmac/ui";
import { useToast } from "@dotmac/ui";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import { useAppConfig } from "@/providers/AppConfigContext";
import {
  ArrowLeft,
  Edit,
  Trash2,
  RefreshCw,
  Power,
  PowerOff,
  Activity,
  CheckCircle,
  XCircle,
  DollarSign,
  TrendingUp,
  Clock,
  AlertCircle,
  Mail,
  MessageSquare,
  Webhook,
  Settings,
  Ban,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, formatDistanceToNow } from "date-fns";

// Types
type DunningActionType =
  | "email"
  | "sms"
  | "suspend_service"
  | "terminate_service"
  | "webhook"
  | "custom";

type DunningExecutionStatus = "pending" | "in_progress" | "completed" | "failed" | "canceled";

interface DunningActionConfig {
  type: DunningActionType;
  delay_days: number;
  template?: string;
  webhook_url?: string;
  custom_config?: Record<string, any>;
}

interface DunningExclusionRules {
  min_lifetime_value?: number;
  customer_tiers?: string[];
  customer_tags?: string[];
}

interface DunningCampaign {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  trigger_after_days: number;
  max_retries: number;
  retry_interval_days: number;
  actions: DunningActionConfig[];
  exclusion_rules?: DunningExclusionRules;
  priority: number;
  is_active: boolean;
  total_executions: number;
  successful_executions: number;
  total_recovered_amount: number;
  created_at: string;
  updated_at: string;
}

interface DunningCampaignStats {
  campaign_id: string;
  campaign_name: string;
  total_executions: number;
  active_executions: number;
  completed_executions: number;
  failed_executions: number;
  canceled_executions: number;
  total_recovered_amount: number;
  total_outstanding_amount: number;
  success_rate: number;
  recovery_rate: number;
  average_completion_time_hours: number;
}

interface DunningExecution {
  id: string;
  tenant_id: string;
  campaign_id: string;
  subscription_id: string;
  customer_id: string;
  invoice_id?: string;
  status: DunningExecutionStatus;
  current_step: number;
  total_steps: number;
  retry_count: number;
  started_at: string;
  next_action_at?: string;
  completed_at?: string;
  outstanding_amount: number;
  recovered_amount: number;
  execution_log: any[];
  canceled_reason?: string;
  canceled_by_user_id?: string;
  metadata: any;
  created_at: string;
  updated_at: string;
}

// Form schema
const campaignFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  trigger_after_days: z.coerce.number().min(1, "Must be at least 1 day"),
  max_retries: z.coerce.number().min(1, "Must be at least 1"),
  retry_interval_days: z.coerce.number().min(1, "Must be at least 1 day"),
  priority: z.coerce.number().min(1).max(100),
  is_active: z.boolean().default(true),
});

type CampaignFormValues = z.infer<typeof campaignFormSchema>;

const formatMoney = (amountInCents: number): string => {
  return `$${(amountInCents / 100).toFixed(2)}`;
};

const getActionIcon = (type: DunningActionType) => {
  switch (type) {
    case "email":
      return <Mail className="h-4 w-4" />;
    case "sms":
      return <MessageSquare className="h-4 w-4" />;
    case "suspend_service":
      return <Ban className="h-4 w-4" />;
    case "terminate_service":
      return <XCircle className="h-4 w-4" />;
    case "webhook":
      return <Webhook className="h-4 w-4" />;
    case "custom":
      return <Settings className="h-4 w-4" />;
    default:
      return <Zap className="h-4 w-4" />;
  }
};

const getStatusBadgeVariant = (
  status: DunningExecutionStatus,
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

const getStatusColor = (status: DunningExecutionStatus): string => {
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

function CampaignDetailsContent() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const campaignId = params["id"] as string;
  const { api } = useAppConfig();
  const apiBaseUrl = api.baseUrl || "";

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Fetch campaign details
  const { data: campaign, isLoading: campaignLoading } = useQuery<DunningCampaign>({
    queryKey: ["dunning", "campaigns", campaignId, apiBaseUrl],
    queryFn: async () => {
      const response = await fetch(`${apiBaseUrl}/api/v1/billing/dunning/campaigns/${campaignId}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch campaign");
      }
      return response.json();
    },
    refetchInterval: 30000,
  });

  // Fetch campaign statistics
  const { data: stats, isLoading: statsLoading } = useQuery<DunningCampaignStats>({
    queryKey: ["dunning", "campaigns", campaignId, "stats", apiBaseUrl],
    queryFn: async () => {
      const response = await fetch(
        `${apiBaseUrl}/api/v1/billing/dunning/campaigns/${campaignId}/stats`,
        {
          credentials: "include",
        },
      );
      if (!response.ok) {
        throw new Error("Failed to fetch campaign stats");
      }
      return response.json();
    },
    refetchInterval: 30000,
  });

  // Fetch campaign executions
  const { data: executions = [], isLoading: executionsLoading } = useQuery<DunningExecution[]>({
    queryKey: ["dunning", "campaigns", campaignId, "executions", apiBaseUrl],
    queryFn: async () => {
      const response = await fetch(
        `${apiBaseUrl}/api/v1/billing/dunning/executions?campaign_id=${campaignId}`,
        {
          credentials: "include",
        },
      );
      if (!response.ok) {
        throw new Error("Failed to fetch executions");
      }
      return response.json();
    },
    refetchInterval: 30000,
  });

  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignFormSchema),
    ...(campaign && {
      values: {
        name: campaign.name,
        description: campaign.description || "",
        trigger_after_days: campaign.trigger_after_days,
        max_retries: campaign.max_retries,
        retry_interval_days: campaign.retry_interval_days,
        priority: campaign.priority,
        is_active: campaign.is_active,
      },
    }),
  });

  // Update campaign mutation
  const updateCampaignMutation = useMutation({
    mutationFn: async (data: CampaignFormValues) => {
      const response = await fetch(`${apiBaseUrl}/api/v1/billing/dunning/campaigns/${campaignId}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error("Failed to update campaign");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dunning", "campaigns", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["dunning", "campaigns"] });
      setIsEditDialogOpen(false);
      toast({
        title: "Success",
        description: "Campaign updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update campaign",
        variant: "destructive",
      });
    },
  });

  // Delete campaign mutation
  const deleteCampaignMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${apiBaseUrl}/api/v1/billing/dunning/campaigns/${campaignId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to delete campaign");
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Campaign deleted successfully",
      });
      router.push("/dashboard/billing-revenue/dunning/campaigns");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete campaign",
        variant: "destructive",
      });
    },
  });

  // Toggle active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async (isActive: boolean) => {
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
      queryClient.invalidateQueries({ queryKey: ["dunning", "campaigns", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["dunning", "campaigns"] });
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
    queryClient.invalidateQueries({ queryKey: ["dunning", "campaigns", campaignId] });
    toast({
      title: "Refreshed",
      description: "Campaign data has been refreshed",
    });
  };

  const onSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    form.handleSubmit((data: CampaignFormValues) => {
      updateCampaignMutation.mutate(data);
    })(e);
  };

  const handleDeleteConfirm = () => {
    deleteCampaignMutation.mutate();
  };

  if (campaignLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Campaign not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/billing-revenue/dunning/campaigns">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">{campaign.name}</h1>
              <Badge variant={campaign.is_active ? "default" : "secondary"}>
                {campaign.is_active ? "Active" : "Inactive"}
              </Badge>
              <Badge variant="outline">P{campaign.priority}</Badge>
            </div>
            {campaign.description && (
              <p className="text-muted-foreground">{campaign.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Button onClick={() => setIsEditDialogOpen(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Campaign
            </Button>
            <Button
              variant={campaign.is_active ? "destructive" : "default"}
              onClick={() => toggleActiveMutation.mutate(!campaign.is_active)}
            >
              {campaign.is_active ? (
                <>
                  <PowerOff className="h-4 w-4 mr-2" />
                  Deactivate
                </>
              ) : (
                <>
                  <Power className="h-4 w-4 mr-2" />
                  Activate
                </>
              )}
            </Button>
            <Button variant="destructive" onClick={() => setIsDeleteDialogOpen(true)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
          <TabsTrigger value="statistics">Statistics</TabsTrigger>
          <TabsTrigger value="executions">Executions</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Campaign Information */}
            <Card>
              <CardHeader>
                <CardTitle>Campaign Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground">Name</div>
                  <div className="font-medium">{campaign.name}</div>
                </div>
                {campaign.description && (
                  <div>
                    <div className="text-sm text-muted-foreground">Description</div>
                    <div className="font-medium">{campaign.description}</div>
                  </div>
                )}
                <div>
                  <div className="text-sm text-muted-foreground">Priority</div>
                  <Badge variant="outline">P{campaign.priority}</Badge>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Status</div>
                  <Badge variant={campaign.is_active ? "default" : "secondary"}>
                    {campaign.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Created</div>
                  <div className="font-medium">{format(new Date(campaign.created_at), "PPP")}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Last Updated</div>
                  <div className="font-medium">
                    {formatDistanceToNow(new Date(campaign.updated_at), {
                      addSuffix: true,
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Trigger & Retry Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Trigger & Retry Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground">Trigger After Payment Failure</div>
                  <div className="font-medium">{campaign.trigger_after_days} days</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Maximum Retries</div>
                  <div className="font-medium">{campaign.max_retries}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Retry Interval</div>
                  <div className="font-medium">{campaign.retry_interval_days} days</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Total Actions Configured</div>
                  <div className="font-medium">{campaign.actions.length}</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Exclusion Rules */}
          {campaign.exclusion_rules && Object.keys(campaign.exclusion_rules).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Exclusion Rules</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {campaign.exclusion_rules.min_lifetime_value && (
                  <div>
                    <div className="text-sm text-muted-foreground">Minimum Lifetime Value</div>
                    <div className="font-medium">
                      {formatMoney(campaign.exclusion_rules.min_lifetime_value)}
                    </div>
                  </div>
                )}
                {campaign.exclusion_rules.customer_tiers &&
                  campaign.exclusion_rules.customer_tiers.length > 0 && (
                    <div>
                      <div className="text-sm text-muted-foreground">Excluded Customer Tiers</div>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {campaign.exclusion_rules.customer_tiers.map((tier) => (
                          <Badge key={tier} variant="outline">
                            {tier}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                {campaign.exclusion_rules.customer_tags &&
                  campaign.exclusion_rules.customer_tags.length > 0 && (
                    <div>
                      <div className="text-sm text-muted-foreground">Excluded Customer Tags</div>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {campaign.exclusion_rules.customer_tags.map((tag) => (
                          <Badge key={tag} variant="outline">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Actions Tab */}
        <TabsContent value="actions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dunning Actions</CardTitle>
            </CardHeader>
            <CardContent>
              {campaign.actions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No actions configured for this campaign</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Step</TableHead>
                      <TableHead>Action Type</TableHead>
                      <TableHead>Delay</TableHead>
                      <TableHead>Configuration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaign.actions.map((action, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Badge variant="outline">{index + 1}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getActionIcon(action.type)}
                            <span className="capitalize">{action.type.replace(/_/g, " ")}</span>
                          </div>
                        </TableCell>
                        <TableCell>{action.delay_days} days</TableCell>
                        <TableCell>
                          {action.template && (
                            <div className="text-sm">
                              <span className="text-muted-foreground">Template: </span>
                              {action.template}
                            </div>
                          )}
                          {action.webhook_url && (
                            <div className="text-sm font-mono">{action.webhook_url}</div>
                          )}
                          {action.custom_config && Object.keys(action.custom_config).length > 0 && (
                            <div className="text-sm text-muted-foreground">
                              Custom configuration
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Statistics Tab */}
        <TabsContent value="statistics" className="space-y-4">
          {/* Statistics Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Executions</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.total_executions ?? 0}</div>
                <p className="text-xs text-muted-foreground">
                  {stats?.active_executions ?? 0} active
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.success_rate?.toFixed(1) ?? 0}%</div>
                <p className="text-xs text-muted-foreground">
                  {stats?.completed_executions ?? 0} completed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Recovered</CardTitle>
                <DollarSign className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatMoney(stats?.total_recovered_amount ?? 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats?.recovery_rate?.toFixed(1) ?? 0}% recovery rate
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

          {/* Additional Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Failed Executions</CardTitle>
                <XCircle className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.failed_executions ?? 0}</div>
                <p className="text-xs text-muted-foreground">Failed to complete</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Canceled Executions</CardTitle>
                <Ban className="h-4 w-4 text-gray-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.canceled_executions ?? 0}</div>
                <p className="text-xs text-muted-foreground">Manually canceled</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Outstanding Amount</CardTitle>
                <DollarSign className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatMoney(stats?.total_outstanding_amount ?? 0)}
                </div>
                <p className="text-xs text-muted-foreground">Still outstanding</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Executions Tab */}
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
                      <TableHead>Customer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Outstanding</TableHead>
                      <TableHead>Recovered</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {executions.map((execution) => (
                      <TableRow key={execution.id}>
                        <TableCell className="font-mono text-sm">
                          {execution.id.substring(0, 8)}
                        </TableCell>
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
                          <Button variant="ghost" size="sm" asChild>
                            <Link
                              href={`/dashboard/billing-revenue/dunning/executions/${execution.id}`}
                            >
                              View
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Campaign</DialogTitle>
            <DialogDescription>Update campaign settings</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={onSubmit} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Campaign Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="trigger_after_days"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Trigger After (Days)</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="max_retries"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Retries</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="retry_interval_days"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Retry Interval (Days)</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" max="100" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active</FormLabel>
                      <FormDescription>Enable or disable this campaign</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateCampaignMutation.isPending}>
                  {updateCampaignMutation.isPending ? "Updating..." : "Update Campaign"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this campaign? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function CampaignDetailsPage() {
  return (
    <RouteGuard permission="billing:write">
      <CampaignDetailsContent />
    </RouteGuard>
  );
}
