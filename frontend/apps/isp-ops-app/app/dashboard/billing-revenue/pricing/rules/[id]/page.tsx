"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { useToast } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
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
  ArrowLeft,
  Edit,
  Power,
  PowerOff,
  Trash2,
  Tag,
  Calendar,
  TrendingUp,
  Users,
  Package,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { apiClient } from "@/lib/api/client";
import { useRouter } from "next/navigation";
import { useAppConfig } from "@/providers/AppConfigContext";

type DiscountType = "percentage" | "fixed_amount" | "fixed_price";

interface PricingRule {
  rule_id: string;
  tenant_id: string;
  name: string;
  description?: string;
  applies_to_product_ids: string[];
  applies_to_categories: string[];
  applies_to_all: boolean;
  min_quantity?: number;
  customer_segments: string[];
  discount_type: DiscountType;
  discount_value: number;
  starts_at?: string;
  ends_at?: string;
  max_uses?: number;
  current_uses: number;
  priority: number;
  is_active: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

interface PricingRuleDetailsProps {
  params: {
    id: string;
  };
}

export default function PricingRuleDetailsPage({ params }: PricingRuleDetailsProps) {
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { api } = useAppConfig();
  const apiBaseUrl = api.baseUrl;
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch rule details
  const {
    data: rule,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["pricing-rule", apiBaseUrl, params["id"]],
    queryFn: async () => {
      const response = await apiClient.get<PricingRule>(
        `${apiBaseUrl}/api/v1/billing/pricing/rules/${params["id"]}`,
      );
      return response.data;
    },
  });

  // Toggle active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async (activate: boolean) => {
      const endpoint = activate ? "activate" : "deactivate";
      const response = await apiClient.post(
        `${apiBaseUrl}/api/v1/billing/pricing/rules/${params["id"]}/${endpoint}`,
      );
      return response.data;
    },
    onSuccess: (_, activate) => {
      toast({
        title: "Success",
        description: `Pricing rule ${activate ? "activated" : "deactivated"} successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ["pricing-rule", apiBaseUrl, params["id"]] });
      queryClient.invalidateQueries({ queryKey: ["pricing-rules"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to update pricing rule status",
        variant: "destructive",
      });
    },
  });

  // Delete rule mutation
  const deleteRuleMutation = useMutation({
    mutationFn: async () => {
      await apiClient.delete(`${apiBaseUrl}/api/v1/billing/pricing/rules/${params["id"]}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Pricing rule deleted successfully",
      });
      router.push("/dashboard/billing-revenue/pricing");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to delete pricing rule",
        variant: "destructive",
      });
    },
  });

  const getDiscountTypeBadge = (type: DiscountType) => {
    const config = {
      percentage: { label: "Percentage", className: "bg-blue-500" },
      fixed_amount: { label: "Fixed Amount", className: "bg-green-500" },
      fixed_price: { label: "Fixed Price", className: "bg-purple-500" },
    };
    const { label, className } = config[type];
    return <Badge className={className}>{label}</Badge>;
  };

  const getPriorityBadge = (priority: number) => {
    if (priority >= 500) return <Badge className="bg-red-500">Critical ({priority})</Badge>;
    if (priority >= 300) return <Badge className="bg-orange-500">High ({priority})</Badge>;
    if (priority >= 100) return <Badge className="bg-yellow-500">Medium ({priority})</Badge>;
    return <Badge className="bg-gray-500">Low ({priority})</Badge>;
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !rule) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-destructive">
              Failed to load pricing rule. The rule may not exist or you may not have permission to
              view it.
            </div>
            <div className="text-center mt-4">
              <Button onClick={() => router.push("/dashboard/billing-revenue/pricing")}>
                Return to Pricing
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const usagePercentage = rule.max_uses ? (rule.current_uses / rule.max_uses) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold">{rule.name}</h1>
              <Badge variant={rule.is_active ? "default" : "secondary"}>
                {rule.is_active ? "Active" : "Inactive"}
              </Badge>
              {getPriorityBadge(rule.priority)}
            </div>
            {rule.description && <p className="text-muted-foreground mt-1">{rule.description}</p>}
          </div>
        </div>
      </div>

      {/* Quick Actions Card */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => router.push(`/dashboard/billing-revenue/pricing?edit=${params["id"]}`)}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit Rule
            </Button>
            <Button
              variant="outline"
              onClick={() => toggleActiveMutation.mutate(!rule.is_active)}
              disabled={toggleActiveMutation.isPending}
            >
              {toggleActiveMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : rule.is_active ? (
                <PowerOff className="mr-2 h-4 w-4" />
              ) : (
                <Power className="mr-2 h-4 w-4" />
              )}
              {rule.is_active ? "Deactivate" : "Activate"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(true)}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Rule
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="application">Application</TabsTrigger>
          <TabsTrigger value="usage">Usage History</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Rule Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5" />
                  Rule Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="text-sm text-muted-foreground">Rule ID</div>
                  <div className="font-mono text-sm">{rule.rule_id}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Name</div>
                  <div className="font-medium">{rule.name}</div>
                </div>
                {rule.description && (
                  <div>
                    <div className="text-sm text-muted-foreground">Description</div>
                    <div>{rule.description}</div>
                  </div>
                )}
                <div>
                  <div className="text-sm text-muted-foreground">Priority</div>
                  <div className="mt-1">{getPriorityBadge(rule.priority)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Status</div>
                  <div className="mt-1">
                    <Badge variant={rule.is_active ? "default" : "secondary"}>
                      {rule.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Created</div>
                  <div>{format(new Date(rule.created_at), "MMM d, yyyy h:mm a")}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Last Updated</div>
                  <div>{format(new Date(rule.updated_at), "MMM d, yyyy h:mm a")}</div>
                </div>
              </CardContent>
            </Card>

            {/* Discount Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Discount Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="text-sm text-muted-foreground">Discount Type</div>
                  <div className="mt-1">{getDiscountTypeBadge(rule.discount_type)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Discount Value</div>
                  <div className="text-2xl font-bold mt-1">
                    {rule.discount_type === "percentage"
                      ? `${rule.discount_value}%`
                      : formatMoney(rule.discount_value)}
                  </div>
                </div>
                {rule.discount_type === "percentage" && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-md">
                    <div className="text-sm font-medium">Example</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      $100.00 product → ${(100 * (1 - rule.discount_value / 100)).toFixed(2)} after
                      discount
                    </div>
                  </div>
                )}
                {rule.discount_type === "fixed_amount" && (
                  <div className="p-3 bg-green-50 dark:bg-green-950 rounded-md">
                    <div className="text-sm font-medium">Example</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      $100.00 product → ${(100 - rule.discount_value).toFixed(2)} after discount
                    </div>
                  </div>
                )}
                {rule.discount_type === "fixed_price" && (
                  <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-md">
                    <div className="text-sm font-medium">Fixed Price</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Any applicable product will be priced at {formatMoney(rule.discount_value)}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Application Scope */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Application Scope
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="text-sm text-muted-foreground">Applies To</div>
                  {rule.applies_to_all ? (
                    <Badge variant="outline" className="mt-1">
                      All Products
                    </Badge>
                  ) : (
                    <div className="mt-1 space-y-1">
                      {rule.applies_to_product_ids.length > 0 && (
                        <div className="text-sm">
                          <span className="font-medium">{rule.applies_to_product_ids.length}</span>{" "}
                          specific products
                        </div>
                      )}
                      {rule.applies_to_categories.length > 0 && (
                        <div className="text-sm">
                          <span className="font-medium">{rule.applies_to_categories.length}</span>{" "}
                          categories
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {!rule.applies_to_all && rule.applies_to_product_ids.length > 0 && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Product IDs</div>
                    <div className="flex flex-wrap gap-1">
                      {rule.applies_to_product_ids.slice(0, 5).map((id) => (
                        <Badge key={id} variant="secondary">
                          {id}
                        </Badge>
                      ))}
                      {rule.applies_to_product_ids.length > 5 && (
                        <Badge variant="secondary">
                          +{rule.applies_to_product_ids.length - 5} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
                {!rule.applies_to_all && rule.applies_to_categories.length > 0 && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Categories</div>
                    <div className="flex flex-wrap gap-1">
                      {rule.applies_to_categories.slice(0, 5).map((cat) => (
                        <Badge key={cat} variant="secondary">
                          {cat}
                        </Badge>
                      ))}
                      {rule.applies_to_categories.length > 5 && (
                        <Badge variant="secondary">
                          +{rule.applies_to_categories.length - 5} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Conditions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Conditions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="text-sm text-muted-foreground">Minimum Quantity</div>
                  <div className="font-medium">
                    {rule.min_quantity ? rule.min_quantity : "No minimum"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Customer Segments</div>
                  {rule.customer_segments.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {rule.customer_segments.map((segment) => (
                        <Badge key={segment} variant="outline">
                          {segment}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm">All customer segments</div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Time Constraints */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Time Constraints
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="text-sm text-muted-foreground">Start Date</div>
                  <div>
                    {rule.starts_at
                      ? format(new Date(rule.starts_at), "MMM d, yyyy h:mm a")
                      : "No start date (always active)"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">End Date</div>
                  <div>
                    {rule.ends_at
                      ? format(new Date(rule.ends_at), "MMM d, yyyy h:mm a")
                      : "No end date (never expires)"}
                  </div>
                </div>
                {rule.starts_at && rule.ends_at && (
                  <div className="p-3 bg-accent rounded-md">
                    <div className="text-sm">
                      Valid for{" "}
                      {Math.ceil(
                        (new Date(rule.ends_at).getTime() - new Date(rule.starts_at).getTime()) /
                          (1000 * 60 * 60 * 24),
                      )}{" "}
                      days
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Usage Limits */}
            <Card>
              <CardHeader>
                <CardTitle>Usage Limits</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="text-sm text-muted-foreground">Maximum Uses</div>
                  <div className="font-medium">
                    {rule.max_uses ? rule.max_uses.toLocaleString() : "Unlimited"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Current Uses</div>
                  <div className="text-2xl font-bold">{rule.current_uses.toLocaleString()}</div>
                </div>
                {rule.max_uses && (
                  <>
                    <div>
                      <div className="text-sm text-muted-foreground mb-2">Usage Progress</div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                        <div
                          className="bg-blue-600 h-2.5 rounded-full"
                          style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                        ></div>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {usagePercentage.toFixed(1)}% used
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Remaining Uses</div>
                      <div className="font-medium">
                        {(rule.max_uses - rule.current_uses).toLocaleString()}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Application Tab */}
        <TabsContent value="application" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>What Products Does This Rule Apply To?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {rule.applies_to_all ? (
                <div className="p-4 bg-accent rounded-lg">
                  <div className="font-medium mb-2">All Products</div>
                  <p className="text-sm text-muted-foreground">
                    This rule applies to all products in your catalog without exception.
                  </p>
                </div>
              ) : (
                <>
                  {rule.applies_to_product_ids.length > 0 && (
                    <div>
                      <h3 className="font-medium mb-2">Specific Products</h3>
                      <div className="flex flex-wrap gap-2">
                        {rule.applies_to_product_ids.map((id) => (
                          <Badge key={id} variant="secondary">
                            {id}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        {rule.applies_to_product_ids.length} product(s) selected
                      </p>
                    </div>
                  )}
                  {rule.applies_to_categories.length > 0 && (
                    <div>
                      <h3 className="font-medium mb-2">Product Categories</h3>
                      <div className="flex flex-wrap gap-2">
                        {rule.applies_to_categories.map((cat) => (
                          <Badge key={cat} variant="secondary">
                            {cat}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        All products in these {rule.applies_to_categories.length} categor
                        {rule.applies_to_categories.length === 1 ? "y" : "ies"}
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Customer Eligibility</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {rule.customer_segments.length > 0 ? (
                <div>
                  <h3 className="font-medium mb-2">Required Customer Segments</h3>
                  <div className="flex flex-wrap gap-2">
                    {rule.customer_segments.map((segment) => (
                      <Badge key={segment} variant="outline">
                        {segment}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Only customers in these segments can use this pricing rule
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-accent rounded-lg">
                  <div className="font-medium mb-2">All Customers</div>
                  <p className="text-sm text-muted-foreground">
                    This rule is available to all customers regardless of segment.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quantity Requirements</CardTitle>
            </CardHeader>
            <CardContent>
              {rule.min_quantity ? (
                <div className="p-4 bg-accent rounded-lg">
                  <div className="font-medium mb-2">Minimum Quantity: {rule.min_quantity}</div>
                  <p className="text-sm text-muted-foreground">
                    Customers must purchase at least {rule.min_quantity} unit(s) to qualify for this
                    discount.
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-accent rounded-lg">
                  <div className="font-medium mb-2">No Minimum Quantity</div>
                  <p className="text-sm text-muted-foreground">
                    This rule applies regardless of quantity purchased.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Usage History Tab */}
        <TabsContent value="usage" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Usage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{rule.current_uses.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">Times applied</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Usage Limit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {rule.max_uses ? rule.max_uses.toLocaleString() : "∞"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Maximum applications</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Remaining</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {rule.max_uses ? (rule.max_uses - rule.current_uses).toLocaleString() : "∞"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Applications left</p>
              </CardContent>
            </Card>
          </div>

          {rule.max_uses && (
            <Card>
              <CardHeader>
                <CardTitle>Usage Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>
                        {rule.current_uses.toLocaleString()} / {rule.max_uses.toLocaleString()} uses
                      </span>
                      <span className="font-medium">{usagePercentage.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-4 dark:bg-gray-700">
                      <div
                        className={`h-4 rounded-full ${
                          usagePercentage >= 90
                            ? "bg-red-600"
                            : usagePercentage >= 75
                              ? "bg-orange-600"
                              : "bg-blue-600"
                        }`}
                        style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                  {usagePercentage >= 90 && (
                    <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md">
                      <div className="text-sm font-medium text-red-900 dark:text-red-100">
                        High Usage Warning
                      </div>
                      <div className="text-sm text-red-700 dark:text-red-300 mt-1">
                        This rule has been used {usagePercentage.toFixed(0)}% of its maximum limit.
                        Consider increasing the limit or creating a new rule.
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Usage Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-8 bg-accent rounded-lg text-center">
                <p className="text-muted-foreground">
                  Usage history chart would appear here. This feature requires additional data
                  tracking and visualization implementation.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Pricing Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the rule &quot;{rule.name}&quot;? This action cannot
              be undone and will remove the rule permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteRuleMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteRuleMutation.mutate()}
              disabled={deleteRuleMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteRuleMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Rule"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
