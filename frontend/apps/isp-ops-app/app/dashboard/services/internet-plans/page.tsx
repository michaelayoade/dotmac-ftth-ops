"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import {
  Wifi,
  Search,
  RefreshCw,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Users,
  DollarSign,
  Zap,
} from "lucide-react";
import { platformConfig } from "@/lib/config";
import { useToast } from "@dotmac/ui";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import Link from "next/link";
import { useConfirmDialog } from "@dotmac/ui";

interface InternetPlan {
  id: string;
  plan_code: string;
  name: string;
  description: string;
  plan_type: "RESIDENTIAL" | "BUSINESS" | "ENTERPRISE";
  status: "ACTIVE" | "INACTIVE" | "DEPRECATED";
  download_speed_mbps: number;
  upload_speed_mbps: number;
  data_cap_gb: number | null;
  monthly_price: number;
  setup_fee: number;
  is_public: boolean;
  is_promotional: boolean;
  subscriber_count?: number;
  mrr?: number;
  created_at: string;
  updated_at: string;
}

function InternetPlansPageContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [planTypeFilter, setPlanTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [publicFilter, setPublicFilter] = useState<string>("all");

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const confirmDialog = useConfirmDialog();

  // Fetch plans
  const {
    data: plans = [],
    isLoading,
    refetch,
  } = useQuery<InternetPlan[]>({
    queryKey: ["internet-plans", planTypeFilter, statusFilter, publicFilter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (planTypeFilter !== "all") params.append("plan_type", planTypeFilter);
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (publicFilter !== "all") params.append("is_public", publicFilter);
      if (searchQuery) params.append("search", searchQuery);

      const response = await fetch(
        `${platformConfig.api.baseUrl}/api/v1/services/internet-plans?${params.toString()}`,
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("Failed to fetch plans");
      return response.json();
    },
  });

  // Delete plan
  const deleteMutation = useMutation({
    mutationFn: async (planId: string) => {
      const response = await fetch(
        `${platformConfig.api.baseUrl}/api/v1/services/internet-plans/${planId}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      if (!response.ok) throw new Error("Failed to delete plan");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["internet-plans"] });
      toast({ title: "Plan archived successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to archive plan",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Filter plans
  const filteredPlans = plans.filter((plan) => {
    const matchesSearch =
      !searchQuery ||
      plan.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plan.plan_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plan.description.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  const stats = {
    total: plans.length,
    active: plans.filter((p) => p.status === "ACTIVE").length,
    residential: plans.filter((p) => p.plan_type === "RESIDENTIAL").length,
    business: plans.filter((p) => p.plan_type === "BUSINESS").length,
    totalSubscribers: plans.reduce((sum, p) => sum + (p.subscriber_count || 0), 0),
    totalMRR: plans.reduce((sum, p) => sum + (p.mrr || 0), 0),
  };

  const getPlanTypeBadge = (type: string) => {
    const badges = {
      RESIDENTIAL: { color: "bg-blue-100 text-blue-800", label: "Residential" },
      BUSINESS: { color: "bg-purple-100 text-purple-800", label: "Business" },
      ENTERPRISE: { color: "bg-orange-100 text-orange-800", label: "Enterprise" },
    };
    const config = badges[type as keyof typeof badges] || {
      color: "bg-gray-100 text-gray-800",
      label: type,
    };
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      ACTIVE: { icon: CheckCircle, color: "bg-green-100 text-green-800", label: "Active" },
      INACTIVE: { icon: Clock, color: "bg-gray-100 text-gray-800", label: "Inactive" },
      DEPRECATED: { icon: XCircle, color: "bg-red-100 text-red-800", label: "Deprecated" },
    };
    const config = badges[status as keyof typeof badges] || badges.INACTIVE;
    const Icon = config.icon;
    return (
      <Badge className={config.color}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const formatSpeed = (mbps: number) => {
    if (mbps >= 1000) {
      return `${(mbps / 1000).toFixed(1)} Gbps`;
    }
    return `${mbps} Mbps`;
  };

  const formatDataCap = (gb: number | null) => {
    if (gb === null) return "Unlimited";
    if (gb >= 1000) {
      return `${(gb / 1000).toFixed(1)} TB`;
    }
    return `${gb} GB`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Internet Service Plans</h1>
          <p className="text-sm text-muted-foreground">
            Manage internet service plans and packages
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button asChild>
            <Link href="/dashboard/services/internet-plans/new">
              <Plus className="h-4 w-4 mr-2" />
              Create Plan
            </Link>
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Plans</CardTitle>
            <Wifi className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All plans</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
            <p className="text-xs text-muted-foreground">Currently offered</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Residential</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.residential}</div>
            <p className="text-xs text-muted-foreground">Home plans</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Business</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.business}</div>
            <p className="text-xs text-muted-foreground">Business plans</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Subscribers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSubscribers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">MRR</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(stats.totalMRR / 1000).toFixed(1)}k</div>
            <p className="text-xs text-muted-foreground">Monthly revenue</p>
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
                placeholder="Search plans..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={planTypeFilter} onValueChange={setPlanTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="RESIDENTIAL">Residential</SelectItem>
                <SelectItem value="BUSINESS">Business</SelectItem>
                <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
                <SelectItem value="DEPRECATED">Deprecated</SelectItem>
              </SelectContent>
            </Select>

            <Select value={publicFilter} onValueChange={setPublicFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Visibility" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Visibility</SelectItem>
                <SelectItem value="true">Public</SelectItem>
                <SelectItem value="false">Private</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Plans Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <Card className="col-span-full">
            <CardContent className="py-8 text-center text-muted-foreground">
              Loading plans...
            </CardContent>
          </Card>
        ) : filteredPlans.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-8 text-center text-muted-foreground">
              {searchQuery ? "No plans match your search" : "No plans found"}
            </CardContent>
          </Card>
        ) : (
          filteredPlans.map((plan) => (
            <Card key={plan.id} className="hover:border-primary transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <Wifi className="h-8 w-8 text-primary" />
                  <div className="flex flex-col gap-1 items-end">
                    {getPlanTypeBadge(plan.plan_type)}
                    {getStatusBadge(plan.status)}
                  </div>
                </div>
                <CardTitle className="mt-2">
                  <Link
                    href={`/dashboard/services/internet-plans/${plan.id}`}
                    className="hover:underline"
                  >
                    {plan.name}
                  </Link>
                </CardTitle>
                <CardDescription className="line-clamp-2">
                  {plan.description || "No description"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-accent rounded-lg">
                  <div className="text-center flex-1">
                    <Zap className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <div className="text-lg font-bold">{formatSpeed(plan.download_speed_mbps)}</div>
                    <div className="text-xs text-muted-foreground">Download</div>
                  </div>
                  <div className="text-center flex-1 border-l">
                    <Zap className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <div className="text-lg font-bold">{formatSpeed(plan.upload_speed_mbps)}</div>
                    <div className="text-xs text-muted-foreground">Upload</div>
                  </div>
                </div>

                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Data Cap:</span>
                    <span className="font-medium">{formatDataCap(plan.data_cap_gb)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Monthly:</span>
                    <span className="font-bold text-green-600">
                      ${plan.monthly_price.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Setup Fee:</span>
                    <span className="font-medium">${plan.setup_fee.toFixed(2)}</span>
                  </div>
                  {plan.subscriber_count !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subscribers:</span>
                      <span className="font-medium">{plan.subscriber_count.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t flex gap-2 flex-wrap">
                  {plan.is_public && (
                    <Badge variant="outline" className="text-xs">
                      Public
                    </Badge>
                  )}
                  {plan.is_promotional && (
                    <Badge
                      variant="outline"
                      className="bg-amber-50 text-amber-700 border-amber-200 text-xs"
                    >
                      Promo
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {plan.plan_code}
                  </Badge>
                </div>

                <div className="pt-3 border-t flex gap-2">
                  <Button variant="outline" size="sm" asChild className="flex-1">
                    <Link href={`/dashboard/services/internet-plans/${plan.id}`}>
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const confirmed = await confirmDialog({
                        title: "Archive plan",
                        description: `Archive plan "${plan.name}"?`,
                        confirmText: "Archive plan",
                        variant: "destructive",
                      });
                      if (confirmed) {
                        deleteMutation.mutate(plan.id);
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

export default function InternetPlansPage() {
  return (
    <RouteGuard permission="isp.plans.read">
      <InternetPlansPageContent />
    </RouteGuard>
  );
}
