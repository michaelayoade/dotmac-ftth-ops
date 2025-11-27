"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
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
import { Label } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import { useToast } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import {
  Plus,
  Search,
  RefreshCw,
  Edit,
  Trash2,
  Power,
  PowerOff,
  Calculator,
  TrendingUp,
  Tag,
  Percent,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { apiClient } from "@/lib/api/client";
import { useToast as useToastHook } from "@dotmac/ui";
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

interface RuleFormData {
  name: string;
  description: string;
  applies_to_product_ids: string;
  applies_to_categories: string;
  applies_to_all: boolean;
  min_quantity: string;
  customer_segments: string;
  discount_type: DiscountType;
  discount_value: string;
  starts_at: string;
  ends_at: string;
  max_uses: string;
  priority: string;
}

export default function PricingPage() {
  const { toast } = useToastHook();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [discountTypeFilter, setDiscountTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [appliesToFilter, setAppliesToFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("active");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedRule, setSelectedRule] = useState<PricingRule | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { api } = useAppConfig();
  const apiBaseUrl = api.baseUrl;

  const [formData, setFormData] = useState<RuleFormData>({
    name: "",
    description: "",
    applies_to_product_ids: "",
    applies_to_categories: "",
    applies_to_all: false,
    min_quantity: "",
    customer_segments: "",
    discount_type: "percentage",
    discount_value: "",
    starts_at: "",
    ends_at: "",
    max_uses: "",
    priority: "100",
  });

  // Fetch pricing rules
  const {
    data: rulesData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["pricing-rules", apiBaseUrl, discountTypeFilter, statusFilter, appliesToFilter],
    queryFn: async () => {
      const params: any = {};
      if (statusFilter === "active") params.active_only = true;
      if (appliesToFilter !== "all") params.category = appliesToFilter;

      const response = await apiClient.get<PricingRule[]>(
        `${apiBaseUrl}/api/v1/billing/pricing/rules`,
        { params },
      );
      return response.data;
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  const rules = rulesData || [];

  // Filter rules based on search and filters
  const filteredRules = rules.filter((rule) => {
    // Search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      if (
        !rule.name.toLowerCase().includes(searchLower) &&
        !rule["description"]?.toLowerCase().includes(searchLower)
      ) {
        return false;
      }
    }

    // Discount type filter
    if (discountTypeFilter !== "all" && rule.discount_type !== discountTypeFilter) {
      return false;
    }

    // Status filter for tabs
    if (activeTab === "active" && !rule.is_active) return false;

    return true;
  });

  // Calculate statistics
  const statistics = {
    totalRules: rules.length,
    activeRules: rules.filter((r) => r.is_active).length,
    totalDiscountsApplied: rules.reduce((sum, r) => sum + r.current_uses, 0),
    avgDiscountPercent:
      rules.length > 0
        ? rules.reduce((sum, r) => {
            if (r.discount_type === "percentage") return sum + r.discount_value;
            return sum;
          }, 0) / rules.filter((r) => r.discount_type === "percentage").length
        : 0,
  };

  // Create rule mutation
  const createRuleMutation = useMutation({
    mutationFn: async (data: Partial<PricingRule>) => {
      const response = await apiClient.post(`${apiBaseUrl}/api/v1/billing/pricing/rules`, data);
      return response.data;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Pricing rule created successfully",
      });
      setShowCreateDialog(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["pricing-rules"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to create pricing rule",
        variant: "destructive",
      });
    },
  });

  // Update rule mutation
  const updateRuleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PricingRule> }) => {
      const response = await apiClient.patch(
        `${apiBaseUrl}/api/v1/billing/pricing/rules/${id}`,
        data,
      );
      return response.data;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Pricing rule updated successfully",
      });
      setShowEditDialog(false);
      setSelectedRule(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["pricing-rules"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to update pricing rule",
        variant: "destructive",
      });
    },
  });

  // Delete rule mutation
  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`${apiBaseUrl}/api/v1/billing/pricing/rules/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Pricing rule deactivated successfully",
      });
      setShowDeleteDialog(false);
      setSelectedRule(null);
      queryClient.invalidateQueries({ queryKey: ["pricing-rules"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to deactivate pricing rule",
        variant: "destructive",
      });
    },
  });

  // Toggle active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, activate }: { id: string; activate: boolean }) => {
      const endpoint = activate ? "activate" : "deactivate";
      const response = await apiClient.post(
        `${apiBaseUrl}/api/v1/billing/pricing/rules/${id}/${endpoint}`,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Success",
        description: `Pricing rule ${variables.activate ? "activated" : "deactivated"} successfully`,
      });
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

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      applies_to_product_ids: "",
      applies_to_categories: "",
      applies_to_all: false,
      min_quantity: "",
      customer_segments: "",
      discount_type: "percentage",
      discount_value: "",
      starts_at: "",
      ends_at: "",
      max_uses: "",
      priority: "100",
    });
  };

  const handleCreateRule = () => {
    const ruleData: Partial<PricingRule> = {
      name: formData["name"],
      ...(formData["description"] && { description: formData["description"] }),
      applies_to_product_ids: formData.applies_to_product_ids
        ? formData.applies_to_product_ids.split(",").map((s) => s.trim())
        : [],
      applies_to_categories: formData.applies_to_categories
        ? formData.applies_to_categories.split(",").map((s) => s.trim())
        : [],
      applies_to_all: formData.applies_to_all,
      ...(formData.min_quantity && { min_quantity: parseInt(formData.min_quantity) }),
      customer_segments: formData.customer_segments
        ? formData.customer_segments.split(",").map((s) => s.trim())
        : [],
      discount_type: formData.discount_type,
      discount_value: parseFloat(formData.discount_value),
      ...(formData.starts_at && { starts_at: formData.starts_at }),
      ...(formData.ends_at && { ends_at: formData.ends_at }),
      ...(formData.max_uses && { max_uses: parseInt(formData.max_uses) }),
      priority: parseInt(formData.priority),
    };

    createRuleMutation.mutate(ruleData);
  };

  const handleEditRule = () => {
    if (!selectedRule) return;

    const ruleData: Partial<PricingRule> = {
      name: formData["name"],
      ...(formData["description"] && { description: formData["description"] }),
      applies_to_product_ids: formData.applies_to_product_ids
        ? formData.applies_to_product_ids.split(",").map((s) => s.trim())
        : [],
      applies_to_categories: formData.applies_to_categories
        ? formData.applies_to_categories.split(",").map((s) => s.trim())
        : [],
      applies_to_all: formData.applies_to_all,
      ...(formData.min_quantity && { min_quantity: parseInt(formData.min_quantity) }),
      customer_segments: formData.customer_segments
        ? formData.customer_segments.split(",").map((s) => s.trim())
        : [],
      discount_type: formData.discount_type,
      discount_value: parseFloat(formData.discount_value),
      ...(formData.starts_at && { starts_at: formData.starts_at }),
      ...(formData.ends_at && { ends_at: formData.ends_at }),
      ...(formData.max_uses && { max_uses: parseInt(formData.max_uses) }),
      priority: parseInt(formData.priority),
    };

    updateRuleMutation.mutate({ id: selectedRule.rule_id, data: ruleData });
  };

  const openEditDialog = (rule: PricingRule) => {
    setSelectedRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || "",
      applies_to_product_ids: rule.applies_to_product_ids.join(", "),
      applies_to_categories: rule.applies_to_categories.join(", "),
      applies_to_all: rule.applies_to_all,
      min_quantity: rule.min_quantity?.toString() || "",
      customer_segments: rule.customer_segments.join(", "),
      discount_type: rule.discount_type,
      discount_value: rule.discount_value.toString(),
      starts_at: rule.starts_at || "",
      ends_at: rule.ends_at || "",
      max_uses: rule.max_uses?.toString() || "",
      priority: rule.priority.toString(),
    });
    setShowEditDialog(true);
  };

  const getDiscountTypeBadge = (type: DiscountType) => {
    const config = {
      percentage: { label: "Percentage", variant: "default" as const, className: "bg-blue-500" },
      fixed_amount: {
        label: "Fixed Amount",
        variant: "default" as const,
        className: "bg-green-500",
      },
      fixed_price: {
        label: "Fixed Price",
        variant: "default" as const,
        className: "bg-purple-500",
      },
    };
    const { label, variant, className } = config[type];
    return (
      <Badge variant={variant} className={className}>
        {label}
      </Badge>
    );
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Pricing Management</h1>
          <p className="text-muted-foreground">Manage pricing rules and discounts</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/billing-revenue/pricing/simulator")}
          >
            <Calculator className="mr-2 h-4 w-4" />
            Price Simulator
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Rule
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.totalRules}</div>
            <p className="text-xs text-muted-foreground">All pricing rules</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{statistics.activeRules}</div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Discounts Applied</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.totalDiscountsApplied}</div>
            <p className="text-xs text-muted-foreground">Lifetime usage</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Discount %</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {statistics.avgDiscountPercent.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">For percentage discounts</p>
          </CardContent>
        </Card>
      </div>

      {/* Rules Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Pricing Rules</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search rules..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-[200px]"
                />
              </div>
              <Select value={discountTypeFilter} onValueChange={setDiscountTypeFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Discount Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="percentage">Percentage</SelectItem>
                  <SelectItem value="fixed_amount">Fixed Amount</SelectItem>
                  <SelectItem value="fixed_price">Fixed Price</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="active">Active Rules</TabsTrigger>
              <TabsTrigger value="all">All Rules</TabsTrigger>
            </TabsList>
            <TabsContent value="active" className="mt-4">
              {isLoading ? (
                <div className="text-center py-8">Loading pricing rules...</div>
              ) : error ? (
                <div className="text-center py-8 text-destructive">
                  Failed to load pricing rules. Please try again.
                </div>
              ) : filteredRules.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No active pricing rules found.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rule Name</TableHead>
                      <TableHead>Discount</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Applies To</TableHead>
                      <TableHead>Conditions</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead>Usage</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRules.map((rule) => (
                      <TableRow key={rule.rule_id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{rule.name}</div>
                            {rule.description && (
                              <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                                {rule.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {getDiscountTypeBadge(rule.discount_type)}
                            <div className="text-sm font-medium">
                              {rule.discount_type === "percentage"
                                ? `${rule.discount_value}%`
                                : formatMoney(rule.discount_value)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getPriorityBadge(rule.priority)}</TableCell>
                        <TableCell>
                          {rule.applies_to_all ? (
                            <Badge variant="outline">All Products</Badge>
                          ) : (
                            <div className="text-sm">
                              {rule.applies_to_product_ids.length > 0 && (
                                <div>{rule.applies_to_product_ids.length} Products</div>
                              )}
                              {rule.applies_to_categories.length > 0 && (
                                <div>{rule.applies_to_categories.length} Categories</div>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {rule.min_quantity && <div>Min qty: {rule.min_quantity}</div>}
                            {rule.customer_segments.length > 0 && (
                              <div>{rule.customer_segments.length} Segments</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={rule.is_active ? "default" : "secondary"}>
                            {rule.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {rule.starts_at && (
                              <div>From: {format(new Date(rule.starts_at), "MMM d, yyyy")}</div>
                            )}
                            {rule.ends_at && (
                              <div>To: {format(new Date(rule.ends_at), "MMM d, yyyy")}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {rule.current_uses}
                            {rule.max_uses ? ` / ${rule.max_uses}` : " / ∞"}
                          </div>
                          {rule.max_uses && (
                            <div className="text-xs text-muted-foreground">
                              {((rule.current_uses / rule.max_uses) * 100).toFixed(0)}% used
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                router.push(
                                  `/dashboard/billing-revenue/pricing/rules/${rule.rule_id}`,
                                )
                              }
                            >
                              View
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => openEditDialog(rule)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                toggleActiveMutation.mutate({
                                  id: rule.rule_id,
                                  activate: !rule.is_active,
                                })
                              }
                            >
                              {rule.is_active ? (
                                <PowerOff className="h-4 w-4" />
                              ) : (
                                <Power className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedRule(rule);
                                setShowDeleteDialog(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
            <TabsContent value="all" className="mt-4">
              {isLoading ? (
                <div className="text-center py-8">Loading pricing rules...</div>
              ) : error ? (
                <div className="text-center py-8 text-destructive">
                  Failed to load pricing rules. Please try again.
                </div>
              ) : rules.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No pricing rules found.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rule Name</TableHead>
                      <TableHead>Discount</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Applies To</TableHead>
                      <TableHead>Conditions</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead>Usage</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((rule) => (
                      <TableRow key={rule.rule_id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{rule.name}</div>
                            {rule.description && (
                              <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                                {rule.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {getDiscountTypeBadge(rule.discount_type)}
                            <div className="text-sm font-medium">
                              {rule.discount_type === "percentage"
                                ? `${rule.discount_value}%`
                                : formatMoney(rule.discount_value)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getPriorityBadge(rule.priority)}</TableCell>
                        <TableCell>
                          {rule.applies_to_all ? (
                            <Badge variant="outline">All Products</Badge>
                          ) : (
                            <div className="text-sm">
                              {rule.applies_to_product_ids.length > 0 && (
                                <div>{rule.applies_to_product_ids.length} Products</div>
                              )}
                              {rule.applies_to_categories.length > 0 && (
                                <div>{rule.applies_to_categories.length} Categories</div>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {rule.min_quantity && <div>Min qty: {rule.min_quantity}</div>}
                            {rule.customer_segments.length > 0 && (
                              <div>{rule.customer_segments.length} Segments</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={rule.is_active ? "default" : "secondary"}>
                            {rule.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {rule.starts_at && (
                              <div>From: {format(new Date(rule.starts_at), "MMM d, yyyy")}</div>
                            )}
                            {rule.ends_at && (
                              <div>To: {format(new Date(rule.ends_at), "MMM d, yyyy")}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {rule.current_uses}
                            {rule.max_uses ? ` / ${rule.max_uses}` : " / ∞"}
                          </div>
                          {rule.max_uses && (
                            <div className="text-xs text-muted-foreground">
                              {((rule.current_uses / rule.max_uses) * 100).toFixed(0)}% used
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                router.push(
                                  `/dashboard/billing-revenue/pricing/rules/${rule.rule_id}`,
                                )
                              }
                            >
                              View
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => openEditDialog(rule)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                toggleActiveMutation.mutate({
                                  id: rule.rule_id,
                                  activate: !rule.is_active,
                                })
                              }
                            >
                              {rule.is_active ? (
                                <PowerOff className="h-4 w-4" />
                              ) : (
                                <Power className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedRule(rule);
                                setShowDeleteDialog(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Create Rule Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Pricing Rule</DialogTitle>
            <DialogDescription>
              Define a new pricing rule with discounts and conditions
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Rule Name*</Label>
              <Input
                value={formData["name"]}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Summer Sale 2024"
              />
            </div>
            <div className="col-span-2">
              <Label>Description</Label>
              <Textarea
                value={formData["description"]}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description of the rule"
                rows={2}
              />
            </div>
            <div>
              <Label>Discount Type*</Label>
              <Select
                value={formData.discount_type}
                onValueChange={(value: DiscountType) =>
                  setFormData({ ...formData, discount_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage</SelectItem>
                  <SelectItem value="fixed_amount">Fixed Amount</SelectItem>
                  <SelectItem value="fixed_price">Fixed Price</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Discount Value*</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.discount_value}
                onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                placeholder={formData.discount_type === "percentage" ? "e.g., 10" : "e.g., 5.00"}
              />
            </div>
            <div>
              <Label>Priority*</Label>
              <Input
                type="number"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                placeholder="100"
              />
            </div>
            <div>
              <Label>Min Quantity</Label>
              <Input
                type="number"
                value={formData.min_quantity}
                onChange={(e) => setFormData({ ...formData, min_quantity: e.target.value })}
                placeholder="Optional minimum quantity"
              />
            </div>
            <div className="col-span-2">
              <Label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.applies_to_all}
                  onChange={(e) => setFormData({ ...formData, applies_to_all: e.target.checked })}
                />
                Apply to all products
              </Label>
            </div>
            {!formData.applies_to_all && (
              <>
                <div>
                  <Label>Product IDs (comma-separated)</Label>
                  <Input
                    value={formData.applies_to_product_ids}
                    onChange={(e) =>
                      setFormData({ ...formData, applies_to_product_ids: e.target.value })
                    }
                    placeholder="prod_1, prod_2"
                  />
                </div>
                <div>
                  <Label>Categories (comma-separated)</Label>
                  <Input
                    value={formData.applies_to_categories}
                    onChange={(e) =>
                      setFormData({ ...formData, applies_to_categories: e.target.value })
                    }
                    placeholder="category1, category2"
                  />
                </div>
              </>
            )}
            <div>
              <Label>Customer Segments (comma-separated)</Label>
              <Input
                value={formData.customer_segments}
                onChange={(e) => setFormData({ ...formData, customer_segments: e.target.value })}
                placeholder="vip, enterprise"
              />
            </div>
            <div>
              <Label>Max Uses</Label>
              <Input
                type="number"
                value={formData.max_uses}
                onChange={(e) => setFormData({ ...formData, max_uses: e.target.value })}
                placeholder="Unlimited if empty"
              />
            </div>
            <div>
              <Label>Start Date</Label>
              <Input
                type="datetime-local"
                value={formData.starts_at}
                onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
              />
            </div>
            <div>
              <Label>End Date</Label>
              <Input
                type="datetime-local"
                value={formData.ends_at}
                onChange={(e) => setFormData({ ...formData, ends_at: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                resetForm();
              }}
              disabled={createRuleMutation.isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateRule} disabled={createRuleMutation.isPending}>
              {createRuleMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Rule"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Rule Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Pricing Rule</DialogTitle>
            <DialogDescription>Update pricing rule settings</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Rule Name*</Label>
              <Input
                value={formData["name"]}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Summer Sale 2024"
              />
            </div>
            <div className="col-span-2">
              <Label>Description</Label>
              <Textarea
                value={formData["description"]}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description of the rule"
                rows={2}
              />
            </div>
            <div>
              <Label>Discount Type*</Label>
              <Select
                value={formData.discount_type}
                onValueChange={(value: DiscountType) =>
                  setFormData({ ...formData, discount_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage</SelectItem>
                  <SelectItem value="fixed_amount">Fixed Amount</SelectItem>
                  <SelectItem value="fixed_price">Fixed Price</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Discount Value*</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.discount_value}
                onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                placeholder={formData.discount_type === "percentage" ? "e.g., 10" : "e.g., 5.00"}
              />
            </div>
            <div>
              <Label>Priority*</Label>
              <Input
                type="number"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                placeholder="100"
              />
            </div>
            <div>
              <Label>Min Quantity</Label>
              <Input
                type="number"
                value={formData.min_quantity}
                onChange={(e) => setFormData({ ...formData, min_quantity: e.target.value })}
                placeholder="Optional minimum quantity"
              />
            </div>
            <div className="col-span-2">
              <Label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.applies_to_all}
                  onChange={(e) => setFormData({ ...formData, applies_to_all: e.target.checked })}
                />
                Apply to all products
              </Label>
            </div>
            {!formData.applies_to_all && (
              <>
                <div>
                  <Label>Product IDs (comma-separated)</Label>
                  <Input
                    value={formData.applies_to_product_ids}
                    onChange={(e) =>
                      setFormData({ ...formData, applies_to_product_ids: e.target.value })
                    }
                    placeholder="prod_1, prod_2"
                  />
                </div>
                <div>
                  <Label>Categories (comma-separated)</Label>
                  <Input
                    value={formData.applies_to_categories}
                    onChange={(e) =>
                      setFormData({ ...formData, applies_to_categories: e.target.value })
                    }
                    placeholder="category1, category2"
                  />
                </div>
              </>
            )}
            <div>
              <Label>Customer Segments (comma-separated)</Label>
              <Input
                value={formData.customer_segments}
                onChange={(e) => setFormData({ ...formData, customer_segments: e.target.value })}
                placeholder="vip, enterprise"
              />
            </div>
            <div>
              <Label>Max Uses</Label>
              <Input
                type="number"
                value={formData.max_uses}
                onChange={(e) => setFormData({ ...formData, max_uses: e.target.value })}
                placeholder="Unlimited if empty"
              />
            </div>
            <div>
              <Label>Start Date</Label>
              <Input
                type="datetime-local"
                value={formData.starts_at}
                onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
              />
            </div>
            <div>
              <Label>End Date</Label>
              <Input
                type="datetime-local"
                value={formData.ends_at}
                onChange={(e) => setFormData({ ...formData, ends_at: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowEditDialog(false);
                setSelectedRule(null);
                resetForm();
              }}
              disabled={updateRuleMutation.isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleEditRule} disabled={updateRuleMutation.isPending}>
              {updateRuleMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Rule"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Pricing Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate the rule &quot;{selectedRule?.name}&quot;? This
              will remove it from active pricing calculations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteRuleMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedRule) {
                  deleteRuleMutation.mutate(selectedRule.rule_id);
                }
              }}
              disabled={deleteRuleMutation.isPending}
            >
              {deleteRuleMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deactivating...
                </>
              ) : (
                "Deactivate"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
