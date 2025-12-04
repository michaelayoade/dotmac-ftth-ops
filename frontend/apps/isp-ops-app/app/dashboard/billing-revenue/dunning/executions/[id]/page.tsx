"use client";

import { useState, useEffect } from "react";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import { useToast } from "@dotmac/ui";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import { useAppConfig } from "@/providers/AppConfigContext";
import {
  ArrowLeft,
  RefreshCw,
  Ban,
  Activity,
  CheckCircle,
  XCircle,
  DollarSign,
  Clock,
  AlertCircle,
  User,
  FileText,
  CreditCard,
  Mail,
  MessageSquare,
  Webhook,
  Settings,
  Zap,
  Calendar,
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

interface DunningActionLog {
  id: string;
  execution_id: string;
  action_type: DunningActionType;
  action_config: Record<string, any>;
  step_number: number;
  executed_at: string;
  status: string;
  result: Record<string, any>;
  error_message?: string;
  external_id?: string;
}

interface DunningCampaign {
  id: string;
  name: string;
  description?: string;
}

// Form schema
const cancelFormSchema = z.object({
  reason: z.string().min(1, "Reason is required"),
});

type CancelFormValues = z.infer<typeof cancelFormSchema>;

const formatMoney = (amountInCents: number): string => {
  return `$${(amountInCents / 100).toFixed(2)}`;
};

const getStatusBadgeVariant = (
  status: DunningExecutionStatus | string,
): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case "pending":
      return "secondary";
    case "in_progress":
      return "default";
    case "completed":
    case "success":
      return "outline";
    case "failed":
    case "error":
      return "destructive";
    case "canceled":
      return "secondary";
    default:
      return "default";
  }
};

const getStatusColor = (status: DunningExecutionStatus | string): string => {
  switch (status) {
    case "pending":
      return "text-yellow-600";
    case "in_progress":
      return "text-blue-600";
    case "completed":
    case "success":
      return "text-green-600";
    case "failed":
    case "error":
      return "text-red-600";
    case "canceled":
      return "text-gray-600";
    default:
      return "text-gray-600";
  }
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

function ExecutionDetailsContent() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const executionId = params["id"] as string;
  const { api } = useAppConfig();
  const apiBaseUrl = api.baseUrl || "";

  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);

  const form = useForm<CancelFormValues>({
    resolver: zodResolver(cancelFormSchema),
    defaultValues: {
      reason: "",
    },
  });

  // Fetch execution details
  const { data: execution, isLoading: executionLoading } = useQuery<DunningExecution>({
    queryKey: ["dunning", "executions", executionId, apiBaseUrl],
    queryFn: async () => {
      const response = await fetch(
        `${apiBaseUrl}/api/v1/billing/dunning/executions/${executionId}`,
        {
          credentials: "include",
        },
      );
      if (!response.ok) {
        throw new Error("Failed to fetch execution");
      }
      return response.json();
    },
    // Refetch every 10 seconds if status is pending or in_progress
    refetchInterval: (query) => {
      if (!query?.state?.data) return false;
      return query.state.data.status === "pending" || query.state.data.status === "in_progress"
        ? 10000
        : false;
    },
  });

  // Fetch campaign details
  const { data: campaign } = useQuery<DunningCampaign>({
    queryKey: ["dunning", "campaigns", execution?.campaign_id, apiBaseUrl],
    queryFn: async () => {
      const response = await fetch(
        `${apiBaseUrl}/api/v1/billing/dunning/campaigns/${execution?.campaign_id}`,
        {
          credentials: "include",
        },
      );
      if (!response.ok) {
        throw new Error("Failed to fetch campaign");
      }
      return response.json();
    },
    enabled: !!execution?.campaign_id,
  });

  // Fetch action logs
  const { data: actionLogs = [], isLoading: logsLoading } = useQuery<DunningActionLog[]>({
    queryKey: ["dunning", "executions", executionId, "logs", apiBaseUrl],
    queryFn: async () => {
      const response = await fetch(
        `${apiBaseUrl}/api/v1/billing/dunning/executions/${executionId}/logs`,
        {
          credentials: "include",
        },
      );
      if (!response.ok) {
        throw new Error("Failed to fetch action logs");
      }
      return response.json();
    },
    refetchInterval: (query) => {
      if (!execution) return false;
      return execution.status === "pending" || execution.status === "in_progress" ? 10000 : false;
    },
  });

  // Cancel execution mutation
  const cancelExecutionMutation = useMutation({
    mutationFn: async (data: CancelFormValues) => {
      const response = await fetch(
        `${apiBaseUrl}/api/v1/billing/dunning/executions/${executionId}/cancel`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        },
      );
      if (!response.ok) {
        throw new Error("Failed to cancel execution");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dunning", "executions", executionId] });
      setIsCancelDialogOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Execution canceled successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to cancel execution",
        variant: "destructive",
      });
    },
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["dunning", "executions", executionId] });
    toast({
      title: "Refreshed",
      description: "Execution data has been refreshed",
    });
  };

  const onSubmit = (data: CancelFormValues) => {
    cancelExecutionMutation.mutate(data);
  };

  const canCancel = execution?.status === "pending" || execution?.status === "in_progress";

  if (executionLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Execution not found</p>
      </div>
    );
  }

  const progressPercentage = (execution.current_step / execution.total_steps) * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/billing-revenue/dunning">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">
                Execution {execution.id.substring(0, 8)}
              </h1>
              <Badge
                variant={getStatusBadgeVariant(execution.status)}
                className={getStatusColor(execution.status)}
              >
                {execution.status}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Campaign: {campaign?.name ?? execution.campaign_id}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Quick Info Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{execution.status}</div>
            <p className="text-xs text-muted-foreground">Retry {execution.retry_count}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Progress</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {execution.current_step} / {execution.total_steps}
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mt-2">
              <div
                className="h-full bg-blue-600 transition-all"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
            <DollarSign className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(execution.outstanding_amount)}</div>
            <p className="text-xs text-muted-foreground">Remaining balance</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recovered</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(execution.recovered_amount)}</div>
            <p className="text-xs text-muted-foreground">Payment received</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      {canCancel && (
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={() => setIsCancelDialogOpen(true)}>
              <Ban className="h-4 w-4 mr-2" />
              Cancel Execution
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="logs">Action Logs</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Execution Details */}
            <Card>
              <CardHeader>
                <CardTitle>Execution Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground">Execution ID</div>
                  <div className="font-mono font-medium">{execution.id}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Campaign</div>
                  <div className="font-medium">
                    <Link
                      href={`/dashboard/billing-revenue/dunning/campaigns/${execution.campaign_id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {campaign?.name ?? execution.campaign_id}
                    </Link>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Status</div>
                  <Badge
                    variant={getStatusBadgeVariant(execution.status)}
                    className={getStatusColor(execution.status)}
                  >
                    {execution.status}
                  </Badge>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">
                    Progress ({progressPercentage.toFixed(0)}%)
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {execution.current_step} / {execution.total_steps}
                    </span>
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 transition-all"
                        style={{ width: `${progressPercentage}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Retry Count</div>
                  <div className="font-medium">{execution.retry_count}</div>
                </div>
              </CardContent>
            </Card>

            {/* Customer & Subscription Info */}
            <Card>
              <CardHeader>
                <CardTitle>Customer & Subscription</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Customer ID
                  </div>
                  <div className="font-mono font-medium">{execution.customer_id}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Subscription ID
                  </div>
                  <div className="font-mono font-medium">{execution.subscription_id}</div>
                </div>
                {execution.invoice_id && (
                  <div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Invoice ID
                    </div>
                    <div className="font-mono font-medium">{execution.invoice_id}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Amounts & Dates */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Payment Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground">Outstanding Amount</div>
                  <div className="text-2xl font-bold text-orange-600">
                    {formatMoney(execution.outstanding_amount)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Recovered Amount</div>
                  <div className="text-2xl font-bold text-green-600">
                    {formatMoney(execution.recovered_amount)}
                  </div>
                </div>
                {execution.outstanding_amount > 0 && (
                  <div>
                    <div className="text-sm text-muted-foreground">Recovery Rate</div>
                    <div className="text-2xl font-bold">
                      {(
                        (execution.recovered_amount /
                          (execution.outstanding_amount + execution.recovered_amount)) *
                        100
                      ).toFixed(1)}
                      %
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Started
                  </div>
                  <div className="font-medium">{format(new Date(execution.started_at), "PPp")}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(execution.started_at), {
                      addSuffix: true,
                    })}
                  </div>
                </div>
                {execution.next_action_at && (
                  <div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Next Action
                    </div>
                    <div className="font-medium">
                      {format(new Date(execution.next_action_at), "PPp")}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(execution.next_action_at), {
                        addSuffix: true,
                      })}
                    </div>
                  </div>
                )}
                {execution.completed_at && (
                  <div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Completed
                    </div>
                    <div className="font-medium">
                      {format(new Date(execution.completed_at), "PPp")}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(execution.completed_at), {
                        addSuffix: true,
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Cancellation Info */}
          {execution.status === "canceled" && execution.canceled_reason && (
            <Card>
              <CardHeader>
                <CardTitle>Cancellation Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground">Reason</div>
                  <div className="font-medium">{execution.canceled_reason}</div>
                </div>
                {execution.canceled_by_user_id && (
                  <div>
                    <div className="text-sm text-muted-foreground">Canceled By</div>
                    <div className="font-mono font-medium">{execution.canceled_by_user_id}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Action Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Action Logs</CardTitle>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : actionLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No action logs recorded yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Step</TableHead>
                      <TableHead>Action Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Executed At</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead>External ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {actionLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <Badge variant="outline">{log.step_number}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getActionIcon(log.action_type)}
                            <span className="capitalize">{log.action_type.replace(/_/g, " ")}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={getStatusBadgeVariant(log.status)}
                            className={getStatusColor(log.status)}
                          >
                            {log.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{format(new Date(log.executed_at), "PPp")}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(log.executed_at), {
                              addSuffix: true,
                            })}
                          </div>
                        </TableCell>
                        <TableCell>
                          {log.error_message ? (
                            <div className="text-sm text-red-600">{log.error_message}</div>
                          ) : (
                            <div className="text-sm text-muted-foreground">
                              {Object.keys(log.result).length > 0
                                ? JSON.stringify(log.result).substring(0, 50) + "..."
                                : "Success"}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {log.external_id && (
                            <div className="font-mono text-sm">{log.external_id}</div>
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

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Execution Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : actionLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No timeline events yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Execution Started */}
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <Activity className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="w-0.5 h-full bg-gray-200 mt-2" />
                    </div>
                    <div className="flex-1 pb-8">
                      <div className="font-medium">Execution Started</div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(execution.started_at), "PPp")}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Campaign: {campaign?.name ?? execution.campaign_id}
                      </div>
                    </div>
                  </div>

                  {/* Action Logs */}
                  {actionLogs.map((log, index) => (
                    <div key={log.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            log.status === "success"
                              ? "bg-green-100"
                              : log.status === "error" || log.status === "failed"
                                ? "bg-red-100"
                                : "bg-gray-100"
                          }`}
                        >
                          {getActionIcon(log.action_type)}
                        </div>
                        {index < actionLogs.length - 1 && (
                          <div className="w-0.5 h-full bg-gray-200 mt-2" />
                        )}
                      </div>
                      <div className="flex-1 pb-8">
                        <div className="font-medium capitalize">
                          {log.action_type.replace(/_/g, " ")} - Step {log.step_number}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(log.executed_at), "PPp")}
                        </div>
                        <Badge
                          variant={getStatusBadgeVariant(log.status)}
                          className={`mt-1 ${getStatusColor(log.status)}`}
                        >
                          {log.status}
                        </Badge>
                        {log.error_message && (
                          <div className="text-sm text-red-600 mt-2">{log.error_message}</div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Execution Completed/Failed/Canceled */}
                  {(execution.completed_at ||
                    execution.status === "failed" ||
                    execution.status === "canceled") && (
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            execution.status === "completed"
                              ? "bg-green-100"
                              : execution.status === "failed"
                                ? "bg-red-100"
                                : "bg-gray-100"
                          }`}
                        >
                          {execution.status === "completed" ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : execution.status === "failed" ? (
                            <XCircle className="h-4 w-4 text-red-600" />
                          ) : (
                            <Ban className="h-4 w-4 text-gray-600" />
                          )}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="font-medium capitalize">Execution {execution.status}</div>
                        {execution.completed_at && (
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(execution.completed_at), "PPp")}
                          </div>
                        )}
                        {execution.status === "canceled" && execution.canceled_reason && (
                          <div className="text-sm text-muted-foreground mt-1">
                            Reason: {execution.canceled_reason}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Cancel Dialog */}
      <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Execution</DialogTitle>
            <DialogDescription>
              Please provide a reason for canceling this dunning execution.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cancellation Reason</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Enter reason for cancellation..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCancelDialogOpen(false)}
                >
                  Close
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={cancelExecutionMutation.isPending}
                >
                  {cancelExecutionMutation.isPending ? "Canceling..." : "Cancel Execution"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ExecutionDetailsPage() {
  return (
    <RouteGuard permission="billing:write">
      <ExecutionDetailsContent />
    </RouteGuard>
  );
}
