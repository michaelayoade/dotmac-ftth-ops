"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import { Switch } from "@dotmac/ui";
import { useToast } from "@dotmac/ui";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import { useAppConfig } from "@/providers/AppConfigContext";
import {
  Plus,
  RefreshCw,
  Activity,
  CheckCircle,
  DollarSign,
  TrendingUp,
  Edit,
  Trash2,
  Eye,
  Search,
  Filter,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

// Types
type DunningActionType =
  | "email"
  | "sms"
  | "suspend_service"
  | "terminate_service"
  | "webhook"
  | "custom";

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
  total_campaigns: number;
  active_campaigns: number;
  total_executions: number;
  total_recovered_amount: number;
  average_success_rate: number;
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

function CampaignManagementContent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<DunningCampaign | null>(null);
  const { api } = useAppConfig();
  const apiBaseUrl = api.baseUrl || "";

  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      name: "",
      description: "",
      trigger_after_days: 7,
      max_retries: 3,
      retry_interval_days: 7,
      priority: 50,
      is_active: true,
    },
  });

  // Fetch campaign statistics
  const { data: stats, isLoading: statsLoading } = useQuery<DunningCampaignStats>({
    queryKey: ["dunning", "campaigns", "stats", apiBaseUrl],
    queryFn: async () => {
      const response = await fetch(`${apiBaseUrl}/api/v1/billing/dunning/campaigns`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch campaigns");
      }
      const campaigns: DunningCampaign[] = await response.json();

      // Calculate stats from campaigns
      const totalCampaigns = campaigns.length;
      const activeCampaigns = campaigns.filter((c) => c.is_active).length;
      const totalExecutions = campaigns.reduce((sum, c) => sum + c.total_executions, 0);
      const totalRecovered = campaigns.reduce((sum, c) => sum + c.total_recovered_amount, 0);
      const averageSuccessRate =
        totalExecutions > 0
          ? campaigns.reduce((sum, c) => {
              const rate =
                c.total_executions > 0 ? (c.successful_executions / c.total_executions) * 100 : 0;
              return sum + rate;
            }, 0) / campaigns.length
          : 0;

      return {
        total_campaigns: totalCampaigns,
        active_campaigns: activeCampaigns,
        total_executions: totalExecutions,
        total_recovered_amount: totalRecovered,
        average_success_rate: averageSuccessRate,
      };
    },
    refetchInterval: 30000,
  });

  // Fetch campaigns
  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery<DunningCampaign[]>({
    queryKey: ["dunning", "campaigns", apiBaseUrl],
    queryFn: async () => {
      const response = await fetch(`${apiBaseUrl}/api/v1/billing/dunning/campaigns`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch campaigns");
      }
      return response.json();
    },
    refetchInterval: 30000,
  });

  // Create campaign mutation
  const createCampaignMutation = useMutation({
    mutationFn: async (data: CampaignFormValues) => {
      const response = await fetch(`${apiBaseUrl}/api/v1/billing/dunning/campaigns`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          actions: [],
          exclusion_rules: {},
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to create campaign");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dunning", "campaigns"] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Campaign created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create campaign",
        variant: "destructive",
      });
    },
  });

  // Delete campaign mutation
  const deleteCampaignMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const response = await fetch(`${apiBaseUrl}/api/v1/billing/dunning/campaigns/${campaignId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to delete campaign");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dunning", "campaigns"] });
      setIsDeleteDialogOpen(false);
      setSelectedCampaign(null);
      toast({
        title: "Success",
        description: "Campaign deleted successfully",
      });
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
    queryClient.invalidateQueries({ queryKey: ["dunning", "campaigns"] });
    toast({
      title: "Refreshed",
      description: "Campaign data has been refreshed",
    });
  };

  const onSubmit = (data: CampaignFormValues) => {
    createCampaignMutation.mutate(data);
  };

  const handleDeleteClick = (campaign: DunningCampaign) => {
    setSelectedCampaign(campaign);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (selectedCampaign) {
      deleteCampaignMutation.mutate(selectedCampaign.id);
    }
  };

  // Filter campaigns
  const filteredCampaigns = campaigns.filter((campaign) => {
    const matchesSearch =
      campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      campaign["description"]?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && campaign.is_active) ||
      (statusFilter === "inactive" && !campaign.is_active);
    return matchesSearch && matchesStatus;
  });

  // Sort by priority
  const sortedCampaigns = [...filteredCampaigns].sort((a, b) => b.priority - a.priority);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dunning Campaigns</h1>
          <p className="text-muted-foreground">Manage automated payment recovery campaigns</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={campaignsLoading}>
            <RefreshCw className={`h-4 w-4 ${campaignsLoading ? "animate-spin" : ""}`} />
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Campaign
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Dunning Campaign</DialogTitle>
                <DialogDescription>
                  Create a new automated payment recovery campaign
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Campaign Name</FormLabel>
                        <FormControl>
                          <Input placeholder="7-Day Payment Recovery" {...field} />
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
                          <Textarea placeholder="Campaign description..." {...field} />
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
                          <FormDescription>Days after payment failure to trigger</FormDescription>
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
                          <FormDescription>Maximum retry attempts</FormDescription>
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
                          <FormDescription>Days between retries</FormDescription>
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
                          <FormDescription>1-100 (higher = priority)</FormDescription>
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
                          <FormDescription>Enable this campaign immediately</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCreateDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createCampaignMutation.isPending}>
                      {createCampaignMutation.isPending ? "Creating..." : "Create Campaign"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statistics Cards */}
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
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.active_campaigns ?? 0}</div>
            <p className="text-xs text-muted-foreground">Currently running</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.average_success_rate?.toFixed(1) ?? 0}%
            </div>
            <p className="text-xs text-muted-foreground">Average across all</p>
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
            <p className="text-xs text-muted-foreground">All campaigns</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search campaigns..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Campaigns</SelectItem>
            <SelectItem value="active">Active Only</SelectItem>
            <SelectItem value="inactive">Inactive Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Campaigns Table */}
      <Card>
        <CardHeader>
          <CardTitle>Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          {campaignsLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : sortedCampaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchTerm || statusFilter !== "all"
                  ? "No campaigns match your filters"
                  : "No campaigns found. Create your first campaign to get started."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Trigger After</TableHead>
                  <TableHead>Max Retries</TableHead>
                  <TableHead>Retry Interval</TableHead>
                  <TableHead>Total Executions</TableHead>
                  <TableHead>Success Rate</TableHead>
                  <TableHead>Recovered</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCampaigns.map((campaign) => {
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
                      <TableCell>{campaign.max_retries}</TableCell>
                      <TableCell>{campaign.retry_interval_days} days</TableCell>
                      <TableCell>{campaign.total_executions}</TableCell>
                      <TableCell>{successRate}%</TableCell>
                      <TableCell>{formatMoney(campaign.total_recovered_amount)}</TableCell>
                      <TableCell>
                        <Switch
                          checked={campaign.is_active}
                          onCheckedChange={(checked) => {
                            toggleActiveMutation.mutate({
                              campaignId: campaign.id,
                              isActive: checked,
                            });
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" asChild>
                            <Link
                              href={`/dashboard/billing-revenue/dunning/campaigns/${campaign.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(campaign)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the campaign &quot;{selectedCampaign?.name}&quot;?
              This action cannot be undone.
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

export default function CampaignManagementPage() {
  return (
    <RouteGuard permission="billing:write">
      <CampaignManagementContent />
    </RouteGuard>
  );
}
