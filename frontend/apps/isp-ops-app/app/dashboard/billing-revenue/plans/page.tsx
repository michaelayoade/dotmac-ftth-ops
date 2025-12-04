"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Switch } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { useToast } from "@dotmac/ui";
import {
  Plus,
  Edit2,
  Package,
  Check,
  X,
  DollarSign,
  Users,
  Zap,
  Star,
  Archive,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useBillingPlans as useBillingPlansGraphQL } from "@/hooks/useBillingGraphQL";
import { apiClient } from "@/lib/api/client";
import { handleApiError } from "@/lib/error-handler";
import { logger } from "@/lib/logger";
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

interface PlanFeature {
  id: string;
  name: string;
  description?: string;
  included: boolean;
  limit?: number | string;
}

interface Plan {
  id: string;
  name: string;
  description: string;
  price_monthly: number;
  price_annual: number;
  currency: string;
  status: "active" | "inactive" | "archived";
  tier: "starter" | "professional" | "enterprise" | "custom";
  features: PlanFeature[];
  popular: boolean;
  trial_days: number;
  max_users?: number;
  storage_gb?: number;
  api_calls?: number;
  created_at: string;
  updated_at: string;
  subscriber_count: number;
  mrr: number;
}

const defaultFeatures: PlanFeature[] = [
  { id: "users", name: "Team Members", included: true, limit: "5" },
  { id: "storage", name: "Storage", included: true, limit: "10 GB" },
  { id: "api", name: "API Calls", included: true, limit: "10,000/mo" },
  { id: "support", name: "Email Support", included: true },
  { id: "analytics", name: "Advanced Analytics", included: false },
  { id: "sso", name: "SSO Integration", included: false },
  { id: "audit", name: "Audit Logs", included: false },
  { id: "custom", name: "Custom Integrations", included: false },
];

export default function PlansPage() {
  const { toast } = useToast();

  // Fetch plans using GraphQL with real-time updates
  const {
    data: plansData,
    isLoading: plansLoading,
    error: plansError,
    refetch: refetchPlans,
  } = useBillingPlansGraphQL(
    {
      pageSize: 100, // Get all plans
    },
    true,
  );

  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("monthly");
  const [showNewPlanDialog, setShowNewPlanDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newPlan, setNewPlan] = useState<Partial<Plan>>({
    name: "",
    description: "",
    price_monthly: 0,
    price_annual: 0,
    currency: "USD",
    tier: "custom",
    features: defaultFeatures,
    trial_days: 14,
    max_users: 5,
    storage_gb: 10,
    api_calls: 10000,
  });
  const [editPlan, setEditPlan] = useState<Partial<Plan>>({
    name: "",
    description: "",
    price_monthly: 0,
    price_annual: 0,
    currency: "USD",
    status: "active",
  });

  // Transform GraphQL plans data to component format
  const plans: Plan[] = (plansData?.plans || []).map((plan) => ({
    id: plan.id,
    name: plan.name,
    description: plan.description || "",
    price_monthly: plan.billingCycle === "monthly" ? plan.price : 0,
    price_annual: plan.billingCycle === "annual" ? plan.price : 0,
    currency: plan.currency,
    status: plan.isActive ? "active" : ("inactive" as "active" | "inactive" | "archived"),
    tier:
      (plan["name"]?.toLowerCase() as "starter" | "professional" | "enterprise" | "custom") ||
      "custom",
    features: [],
    popular: false,
    trial_days: plan.trialDays || 0,
    max_users: 0,
    storage_gb: 0,
    api_calls: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    subscriber_count: 0,
    mrr: 0,
  }));

  const handleCreatePlan = async () => {
    if (!newPlan.name || !newPlan.description || (newPlan.price_monthly ?? 0) <= 0) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Create plan via API
      await apiClient.post("/billing/plans", {
        name: newPlan.name,
        description: newPlan.description,
        price_monthly: newPlan.price_monthly,
        price_annual: newPlan.price_annual,
        currency: newPlan.currency || "USD",
        tier: newPlan.tier,
        trial_days: newPlan.trial_days,
        max_users: newPlan.max_users,
        storage_gb: newPlan.storage_gb,
        api_calls: newPlan.api_calls,
        features: newPlan.features,
        status: "active",
      });

      logger.info("Billing plan created", { planName: newPlan.name });

      toast({
        title: "Success",
        description: "Pricing plan created successfully",
      });

      setShowNewPlanDialog(false);
      // Reset form
      setNewPlan({
        name: "",
        description: "",
        price_monthly: 0,
        price_annual: 0,
        currency: "USD",
        tier: "custom",
        features: defaultFeatures,
        trial_days: 14,
        max_users: 5,
        storage_gb: 10,
        api_calls: 10000,
      });

      // Refresh plans list
      await refetchPlans();
    } catch (error) {
      logger.error("Failed to create billing plan", error);
      handleApiError(error, {
        userMessage: "Failed to create pricing plan. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdatePlan = async () => {
    if (!selectedPlan) return;

    setIsSubmitting(true);
    try {
      // Update plan via API
      await apiClient.put(`/billing/plans/${selectedPlan.id}`, {
        name: editPlan.name,
        description: editPlan.description,
        price_monthly: editPlan.price_monthly,
        price_annual: editPlan.price_annual,
        status: editPlan.status,
      });

      logger.info("Billing plan updated", { planId: selectedPlan.id, planName: editPlan.name });

      toast({
        title: "Success",
        description: "Pricing plan updated successfully",
      });

      setShowEditDialog(false);
      setSelectedPlan(null);

      // Refresh plans list
      await refetchPlans();
    } catch (error) {
      logger.error("Failed to update billing plan", error);
      handleApiError(error, {
        userMessage: "Failed to update pricing plan. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchivePlan = async () => {
    if (!selectedPlan) return;

    setIsSubmitting(true);
    try {
      // Archive plan via API (DELETE or PATCH to archived status)
      await apiClient.delete(`/billing/plans/${selectedPlan.id}`);

      logger.info("Billing plan archived", {
        planId: selectedPlan.id,
        planName: selectedPlan.name,
      });

      toast({
        title: "Success",
        description: `${selectedPlan.name} plan has been archived`,
      });

      setShowArchiveDialog(false);
      setSelectedPlan(null);

      // Refresh plans list
      await refetchPlans();
    } catch (error) {
      logger.error("Failed to archive billing plan", error);
      handleApiError(error, {
        userMessage: "Failed to archive plan. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "starter":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "professional":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
      case "enterprise":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const totalMRR = plans.reduce((sum, plan) => sum + plan.mrr, 0);
  const totalSubscribers = plans.reduce((sum, plan) => sum + plan.subscriber_count, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Pricing Plans</h1>
          <p className="text-muted-foreground">Manage your subscription tiers and pricing</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetchPlans()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => setShowNewPlanDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Plan
          </Button>
        </div>
      </div>

      {/* Error State */}
      {plansError && (
        <Card className="border-red-500">
          <CardHeader>
            <CardTitle className="text-red-600">Error Loading Plans</CardTitle>
            <CardDescription>
              {plansError.message || "Failed to load billing plans"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => refetchPlans()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Plans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {plans.filter((p) => p.status === "active").length}
            </div>
            <p className="text-xs text-muted-foreground">Available for subscription</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Subscribers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSubscribers}</div>
            <p className="text-xs text-muted-foreground">Across all plans</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total MRR</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalMRR, "USD")}</div>
            <p className="text-xs text-muted-foreground">Monthly recurring revenue</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Revenue/User</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalSubscribers > 0 ? formatCurrency(totalMRR / totalSubscribers, "USD") : "$0"}
            </div>
            <p className="text-xs text-muted-foreground">ARPU</p>
          </CardContent>
        </Card>
      </div>

      {/* Billing Period Toggle */}
      <div className="flex justify-center">
        <div className="inline-flex items-center space-x-2 p-1 bg-muted rounded-lg">
          <Button
            variant={billingPeriod === "monthly" ? "default" : "ghost"}
            size="sm"
            onClick={() => setBillingPeriod("monthly")}
          >
            Monthly Billing
          </Button>
          <Button
            variant={billingPeriod === "annual" ? "default" : "ghost"}
            size="sm"
            onClick={() => setBillingPeriod("annual")}
          >
            Annual Billing
            <Badge variant="secondary" className="ml-2">
              Save 20%
            </Badge>
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {plansLoading && (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Loading pricing plans...</p>
        </div>
      )}

      {/* Pricing Cards */}
      {!plansLoading && !plansError && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.length === 0 ? (
            <div className="col-span-3 text-center py-12">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No pricing plans found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first pricing plan to get started
              </p>
              <Button onClick={() => setShowNewPlanDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Plan
              </Button>
            </div>
          ) : (
            plans.map((plan) => (
              <Card
                key={plan.id}
                className={`relative ${plan.popular ? "border-purple-500 dark:border-purple-400 border-2" : ""}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-purple-500 text-white dark:bg-purple-600 dark:text-white">
                      <Star className="h-3 w-3 mr-1" />
                      Most Popular
                    </Badge>
                  </div>
                )}
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                      <CardDescription className="mt-1">{plan.description}</CardDescription>
                    </div>
                    <Badge className={getTierColor(plan.tier)} variant="secondary">
                      {plan.tier}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="text-3xl font-bold">
                      {formatCurrency(
                        billingPeriod === "monthly" ? plan.price_monthly : plan.price_annual,
                        plan.currency,
                      )}
                      <span className="text-lg font-normal text-muted-foreground">
                        /{billingPeriod === "monthly" ? "month" : "year"}
                      </span>
                    </div>
                    {billingPeriod === "annual" && (
                      <p className="text-sm text-green-600 dark:text-green-400">
                        Save{" "}
                        {formatCurrency(plan.price_monthly * 12 - plan.price_annual, plan.currency)}{" "}
                        per year
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Users className="h-4 w-4 mr-2" />
                      {plan.subscriber_count} active subscribers
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <DollarSign className="h-4 w-4 mr-2" />
                      {formatCurrency(plan.mrr, plan.currency)} MRR
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Zap className="h-4 w-4 mr-2" />
                      {plan.trial_days} day free trial
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <p className="text-sm font-medium mb-3">Features</p>
                    <ul className="space-y-2">
                      {plan.features.slice(0, 5).map((feature) => (
                        <li key={feature.id} className="flex items-start text-sm">
                          {feature.included ? (
                            <Check className="h-4 w-4 text-green-500 dark:text-green-400 mr-2 mt-0.5" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground mr-2 mt-0.5" />
                          )}
                          <span className={feature.included ? "" : "text-muted-foreground"}>
                            {feature.name}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {plan.features.length > 5 && (
                      <Button variant="link" size="sm" className="mt-2 p-0">
                        View all features ({plan.features.length})
                      </Button>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setSelectedPlan(plan);
                      setEditPlan({
                        name: plan.name,
                        description: plan.description,
                        price_monthly: plan.price_monthly,
                        price_annual: plan.price_annual,
                        currency: plan.currency,
                        status: plan.status,
                      });
                      setShowEditDialog(true);
                    }}
                  >
                    <Edit2 className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  {plan.status === "active" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedPlan(plan);
                        setShowArchiveDialog(true);
                      }}
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" disabled title="Plan is not active">
                      <Archive className="h-4 w-4" />
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))
          )}
        </div>
      )}

      {/* New Plan Dialog */}
      <Dialog open={showNewPlanDialog} onOpenChange={setShowNewPlanDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Pricing Plan</DialogTitle>
            <DialogDescription>Set up a new subscription tier for your customers</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="general">
            <TabsList>
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="features">Features</TabsTrigger>
              <TabsTrigger value="limits">Limits</TabsTrigger>
            </TabsList>
            <TabsContent value="general" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Plan Name</Label>
                  <Input
                    value={newPlan.name}
                    onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                    placeholder="e.g., Professional"
                  />
                </div>
                <div>
                  <Label>Tier</Label>
                  <select
                    value={newPlan.tier}
                    onChange={(e) =>
                      setNewPlan({
                        ...newPlan,
                        tier: e.target.value as
                          | "starter"
                          | "professional"
                          | "enterprise"
                          | "custom",
                      })
                    }
                    className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
                  >
                    <option value="starter">Starter</option>
                    <option value="professional">Professional</option>
                    <option value="enterprise">Enterprise</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={newPlan.description}
                  onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
                  placeholder="Brief description of the plan"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Monthly Price (USD)</Label>
                  <Input
                    type="number"
                    value={newPlan.price_monthly}
                    onChange={(e) =>
                      setNewPlan({
                        ...newPlan,
                        price_monthly: parseFloat(e.target.value),
                      })
                    }
                    placeholder="99"
                  />
                </div>
                <div>
                  <Label>Annual Price (USD)</Label>
                  <Input
                    type="number"
                    value={newPlan.price_annual}
                    onChange={(e) =>
                      setNewPlan({
                        ...newPlan,
                        price_annual: parseFloat(e.target.value),
                      })
                    }
                    placeholder="990"
                  />
                </div>
              </div>
              <div>
                <Label>Trial Period (days)</Label>
                <Input
                  type="number"
                  value={newPlan.trial_days}
                  onChange={(e) =>
                    setNewPlan({
                      ...newPlan,
                      trial_days: parseInt(e.target.value),
                    })
                  }
                  placeholder="14"
                />
              </div>
            </TabsContent>
            <TabsContent value="features" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Select which features are included in this plan
              </p>
              <div className="space-y-3">
                {(newPlan.features ?? []).map((feature, index) => (
                  <div key={feature.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={feature.included}
                        onCheckedChange={(checked) => {
                          const updated = [...(newPlan.features ?? [])];
                          const updatedFeature = updated[index];
                          if (updatedFeature) {
                            updatedFeature.included = checked;
                            setNewPlan({ ...newPlan, features: updated });
                          }
                        }}
                      />
                      <Label className="font-normal">{feature.name}</Label>
                    </div>
                    {feature.limit && (
                      <Input
                        className="w-32"
                        value={feature.limit}
                        onChange={(e) => {
                          const updated = [...(newPlan.features ?? [])];
                          const updatedFeature = updated[index];
                          if (updatedFeature) {
                            updatedFeature.limit = e.target.value;
                            setNewPlan({ ...newPlan, features: updated });
                          }
                        }}
                        placeholder="Limit"
                      />
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="limits" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Max Users</Label>
                  <Input
                    type="number"
                    value={newPlan.max_users}
                    onChange={(e) =>
                      setNewPlan({
                        ...newPlan,
                        max_users: parseInt(e.target.value) || 0,
                      })
                    }
                    placeholder="20"
                  />
                </div>
                <div>
                  <Label>Storage (GB)</Label>
                  <Input
                    type="number"
                    value={newPlan.storage_gb}
                    onChange={(e) =>
                      setNewPlan({
                        ...newPlan,
                        storage_gb: parseInt(e.target.value) || 0,
                      })
                    }
                    placeholder="100"
                  />
                </div>
                <div>
                  <Label>API Calls/Month</Label>
                  <Input
                    type="number"
                    value={newPlan.api_calls}
                    onChange={(e) =>
                      setNewPlan({
                        ...newPlan,
                        api_calls: parseInt(e.target.value) || 0,
                      })
                    }
                    placeholder="100000"
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNewPlanDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleCreatePlan} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Plan"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Plan Dialog */}
      {selectedPlan && (
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit {selectedPlan.name} Plan</DialogTitle>
              <DialogDescription>Update pricing and features for this plan</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Plan Name</Label>
                <Input
                  value={editPlan.name}
                  onChange={(e) => setEditPlan({ ...editPlan, name: e.target.value })}
                  placeholder="Plan name"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={editPlan.description}
                  onChange={(e) => setEditPlan({ ...editPlan, description: e.target.value })}
                  placeholder="Plan description"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Monthly Price (USD)</Label>
                  <Input
                    type="number"
                    value={editPlan.price_monthly}
                    onChange={(e) =>
                      setEditPlan({
                        ...editPlan,
                        price_monthly: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="Monthly price"
                  />
                </div>
                <div>
                  <Label>Annual Price (USD)</Label>
                  <Input
                    type="number"
                    value={editPlan.price_annual}
                    onChange={(e) =>
                      setEditPlan({
                        ...editPlan,
                        price_annual: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="Annual price"
                  />
                </div>
              </div>
              <div>
                <Label>Status</Label>
                <select
                  value={editPlan.status}
                  onChange={(e) =>
                    setEditPlan({
                      ...editPlan,
                      status: e.target.value as "active" | "inactive" | "archived",
                    })
                  }
                  className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowEditDialog(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button onClick={handleUpdatePlan} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Pricing Plan</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive the{" "}
              <span className="font-semibold">{selectedPlan?.name}</span> plan?
              <br />
              <br />
              Existing subscribers will not be affected, but new customers won&apos;t be able to
              select this plan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchivePlan}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Archiving...
                </>
              ) : (
                "Archive Plan"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
