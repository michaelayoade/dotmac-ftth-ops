"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import {
  ArrowLeft,
  Wifi,
  RefreshCw,
  Edit,
  Users,
  DollarSign,
  TrendingUp,
  BarChart3,
  CheckCircle,
  XCircle,
  Zap,
  Database,
  Calendar,
} from "lucide-react";
import { platformConfig } from "@/lib/config";
import { useToast } from "@dotmac/ui";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import Link from "next/link";
import { useParams } from "next/navigation";

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
  overage_rate_per_gb: number;
  monthly_price: number;
  setup_fee: number;
  contract_term_months: number;
  early_termination_fee: number;
  is_public: boolean;
  is_promotional: boolean;
  promotional_price: number | null;
  promotional_period_months: number | null;
  features: string[];
  created_at: string;
  updated_at: string;
}

interface PlanStatistics {
  total_subscriptions: number;
  active_subscriptions: number;
  inactive_subscriptions: number;
  mrr: number;
  arr: number;
  average_usage_gb: number;
  churn_rate: number;
}

interface Subscription {
  id: string;
  customer_id: string;
  customer_name: string;
  start_date: string;
  end_date: string | null;
  status: string;
  current_download_usage_gb: number;
  current_upload_usage_gb: number;
  is_active: boolean;
}

function PlanDetailsPageContent() {
  const params = useParams();
  const planId = params["planId"] as string;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const {
    data: plan,
    isLoading,
    refetch,
  } = useQuery<InternetPlan>({
    queryKey: ["internet-plan", planId],
    queryFn: async () => {
      const response = await fetch(
        `${platformConfig.api.baseUrl}/api/v1/services/internet-plans/${planId}`,
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("Failed to fetch plan");
      return response.json();
    },
  });

  const { data: statistics } = useQuery<PlanStatistics>({
    queryKey: ["internet-plan-stats", planId],
    queryFn: async () => {
      const response = await fetch(
        `${platformConfig.api.baseUrl}/api/v1/services/internet-plans/${planId}/statistics`,
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("Failed to fetch statistics");
      return response.json();
    },
  });

  const { data: subscriptions = [] } = useQuery<Subscription[]>({
    queryKey: ["internet-plan-subscriptions", planId],
    queryFn: async () => {
      const response = await fetch(
        `${platformConfig.api.baseUrl}/api/v1/services/internet-plans/${planId}/subscriptions`,
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("Failed to fetch subscriptions");
      return response.json();
    },
  });

  if (isLoading || !plan) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
      INACTIVE: { icon: XCircle, color: "bg-gray-100 text-gray-800", label: "Inactive" },
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/services/internet-plans">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{plan.name}</h1>
            <p className="text-sm text-muted-foreground">{plan.plan_code}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button asChild>
            <Link href={`/dashboard/services/internet-plans/${planId}/edit`}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Plan
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Type</CardTitle>
          </CardHeader>
          <CardContent>{getPlanTypeBadge(plan.plan_type)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Status</CardTitle>
          </CardHeader>
          <CardContent>{getStatusBadge(plan.status)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Monthly Price</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${plan.monthly_price.toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Subscribers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statistics?.active_subscriptions.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">
            <Wifi className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="subscriptions">
            <Users className="h-4 w-4 mr-2" />
            Subscriptions ({subscriptions.length})
          </TabsTrigger>
          <TabsTrigger value="statistics">
            <BarChart3 className="h-4 w-4 mr-2" />
            Statistics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Plan Details</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <h3 className="font-semibold">Speed Configuration</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-accent rounded-lg">
                      <span className="text-sm text-muted-foreground">Download Speed</span>
                      <span className="font-bold text-lg">
                        {formatSpeed(plan.download_speed_mbps)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-accent rounded-lg">
                      <span className="text-sm text-muted-foreground">Upload Speed</span>
                      <span className="font-bold text-lg">
                        {formatSpeed(plan.upload_speed_mbps)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-accent rounded-lg">
                      <span className="text-sm text-muted-foreground">Data Cap</span>
                      <span className="font-bold text-lg">{formatDataCap(plan.data_cap_gb)}</span>
                    </div>
                    {plan.data_cap_gb && (
                      <div className="flex items-center justify-between p-3 bg-accent rounded-lg">
                        <span className="text-sm text-muted-foreground">Overage Rate</span>
                        <span className="font-bold">${plan.overage_rate_per_gb.toFixed(2)}/GB</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold">Pricing & Contract</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Monthly Price</span>
                      <span className="font-bold text-green-600">
                        ${plan.monthly_price.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Setup Fee</span>
                      <span className="font-medium">${plan.setup_fee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Contract Term</span>
                      <span className="font-medium">{plan.contract_term_months} months</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Early Termination Fee</span>
                      <span className="font-medium">${plan.early_termination_fee.toFixed(2)}</span>
                    </div>
                  </div>

                  {plan.is_promotional && plan.promotional_price && (
                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-amber-100 text-amber-800">Promotional</Badge>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Promo Price</span>
                          <span className="font-bold text-amber-700">
                            ${plan.promotional_price.toFixed(2)}/mo
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Promo Period</span>
                          <span>{plan.promotional_period_months} months</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {plan.features && plan.features.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">Features</h3>
                  <div className="grid gap-2 md:grid-cols-2">
                    {plan.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 flex-wrap pt-4 border-t">
                {plan.is_public && <Badge variant="outline">Public Plan</Badge>}
                {!plan.is_public && <Badge variant="outline">Private Plan</Badge>}
                <Badge variant="outline">
                  Created {new Date(plan.created_at).toLocaleDateString()}
                </Badge>
                <Badge variant="outline">
                  Updated {new Date(plan.updated_at).toLocaleDateString()}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscriptions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Subscriptions</CardTitle>
              <CardDescription>Customers subscribed to this plan</CardDescription>
            </CardHeader>
            <CardContent>
              {subscriptions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No subscriptions found for this plan
                </div>
              ) : (
                <div className="space-y-2">
                  {subscriptions.map((sub) => (
                    <div
                      key={sub.id}
                      className="border rounded-lg p-4 hover:bg-accent transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-medium">{sub.customer_name}</div>
                          <div className="text-xs text-muted-foreground">ID: {sub.customer_id}</div>
                        </div>
                        <Badge
                          className={
                            sub.is_active
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }
                        >
                          {sub.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Start Date</p>
                          <p className="font-medium">
                            {new Date(sub.start_date).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Download Usage</p>
                          <p className="font-medium">
                            {sub.current_download_usage_gb.toFixed(2)} GB
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Upload Usage</p>
                          <p className="font-medium">{sub.current_upload_usage_gb.toFixed(2)} GB</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statistics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Subscriptions</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {statistics?.total_subscriptions.toLocaleString() || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  {statistics?.active_subscriptions || 0} active,{" "}
                  {statistics?.inactive_subscriptions || 0} inactive
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Monthly Recurring Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  ${(statistics?.mrr || 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  ARR: ${(statistics?.arr || 0).toLocaleString()}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Average Usage</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(statistics?.average_usage_gb || 0).toFixed(1)} GB
                </div>
                <p className="text-xs text-muted-foreground">
                  Churn Rate: {((statistics?.churn_rate || 0) * 100).toFixed(1)}%
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Revenue Breakdown</CardTitle>
              <CardDescription>Financial metrics for this plan</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex justify-between p-3 bg-accent rounded-lg">
                  <span className="text-muted-foreground">Monthly Recurring Revenue</span>
                  <span className="font-bold text-green-600">
                    ${(statistics?.mrr || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between p-3 bg-accent rounded-lg">
                  <span className="text-muted-foreground">Annual Recurring Revenue</span>
                  <span className="font-bold text-green-600">
                    ${(statistics?.arr || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between p-3 bg-accent rounded-lg">
                  <span className="text-muted-foreground">Active Subscribers</span>
                  <span className="font-bold">
                    {statistics?.active_subscriptions.toLocaleString() || 0}
                  </span>
                </div>
                <div className="flex justify-between p-3 bg-accent rounded-lg">
                  <span className="text-muted-foreground">Churn Rate</span>
                  <span className="font-bold">
                    {((statistics?.churn_rate || 0) * 100).toFixed(2)}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function PlanDetailsPage() {
  return (
    <RouteGuard permission="isp.plans.read">
      <PlanDetailsPageContent />
    </RouteGuard>
  );
}
