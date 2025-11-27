"use client";

import { useState, useEffect } from "react";
import {
  Package,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  DollarSign,
  Calendar,
  Users,
  TrendingUp,
  Pause,
  Play,
  X,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useTenant } from "@/lib/contexts/tenant-context";

interface SubscriptionPlan {
  plan_id: string;
  product_id: string;
  name: string;
  description?: string;
  billing_cycle: "monthly" | "quarterly" | "yearly" | "one_time";
  price: number;
  currency: string;
  trial_period_days?: number;
  is_active: boolean;
  feature_limits?: Record<string, any>;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

interface Subscription {
  subscription_id: string;
  customer_id: string;
  plan_id: string;
  status: "active" | "trialing" | "past_due" | "canceled" | "incomplete";
  current_period_start: string;
  current_period_end: string;
  trial_end?: string;
  cancel_at_period_end: boolean;
  is_in_trial: boolean;
  days_until_renewal: number;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export default function SubscriptionManagementPage() {
  const { tenantId } = useTenant();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"plans" | "subscriptions">("plans");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  useEffect(() => {
    if (tenantId) {
      loadSubscriptionData();
    }
  }, [tenantId]);

  const loadSubscriptionData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load both plans and subscriptions
      const [plansResponse, subscriptionsResponse] = await Promise.all([
        apiClient.get<SubscriptionPlan[]>("/billing/subscriptions/plans"),
        apiClient.get<Subscription[]>("/billing/subscriptions"),
      ]);

      if (plansResponse.data) {
        setPlans(plansResponse.data || []);
      }

      if (subscriptionsResponse.data) {
        setSubscriptions(subscriptionsResponse.data || []);
      }
    } catch (error) {
      console.error("Failed to load subscription data:", error);
      setError("Failed to load subscription data");
    } finally {
      setLoading(false);
    }
  };

  const filteredPlans = plans.filter((plan) => {
    const matchesSearch =
      !searchQuery ||
      plan.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (plan["description"] ?? "").toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  const filteredSubscriptions = subscriptions.filter((subscription) => {
    const matchesSearch =
      !searchQuery ||
      subscription.subscription_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      subscription.customer_id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = selectedStatus === "all" || subscription.status === selectedStatus;

    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (amount: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(amount / 100);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 dark:bg-green-950/20 text-green-800 dark:text-green-400";
      case "trialing":
        return "bg-blue-100 dark:bg-blue-950/20 text-blue-800 dark:text-blue-400";
      case "past_due":
        return "bg-yellow-100 dark:bg-yellow-950/20 text-yellow-800 dark:text-yellow-400";
      case "canceled":
        return "bg-red-100 dark:bg-red-950/20 text-red-800 dark:text-red-400";
      case "incomplete":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getBillingCycleColor = (cycle: string) => {
    switch (cycle) {
      case "monthly":
        return "bg-blue-100 dark:bg-blue-950/20 text-blue-800 dark:text-blue-400";
      case "quarterly":
        return "bg-purple-100 dark:bg-purple-950/20 text-purple-800 dark:text-purple-400";
      case "yearly":
        return "bg-green-100 dark:bg-green-950/20 text-green-800 dark:text-green-400";
      case "one_time":
        return "bg-orange-100 dark:bg-orange-950/20 text-orange-800 dark:text-orange-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-accent rounded w-1/3"></div>
          <div className="h-32 bg-accent rounded"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-accent rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground mb-2">
            Error Loading Subscriptions
          </h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            onClick={loadSubscriptionData}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Subscription Management</h1>
          <p className="text-muted-foreground">
            Manage subscription plans and customer subscriptions.
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
          <Plus className="h-4 w-4" />
          Create Plan
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-border">
        <div className="flex space-x-8">
          <button
            onClick={() => setActiveTab("plans")}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "plans"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-muted-foreground hover:text-muted-foreground hover:border-border"
            }`}
          >
            Subscription Plans ({plans.length})
          </button>
          <button
            onClick={() => setActiveTab("subscriptions")}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "subscriptions"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-muted-foreground hover:text-muted-foreground hover:border-border"
            }`}
          >
            Active Subscriptions ({subscriptions.length})
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={activeTab === "plans" ? "Search plans..." : "Search subscriptions..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>
        {activeTab === "subscriptions" && (
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 bg-card border border-border rounded-lg text-foreground focus:border-indigo-500 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="trialing">Trialing</option>
            <option value="past_due">Past Due</option>
            <option value="canceled">Canceled</option>
            <option value="incomplete">Incomplete</option>
          </select>
        )}
      </div>

      {/* Content */}
      {activeTab === "plans" ? (
        // Subscription Plans
        filteredPlans.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-lg border border-border">
            <Package className="h-12 w-12 text-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">No Plans Found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery
                ? "No plans match your search criteria."
                : "Get started by creating your first subscription plan."}
            </p>
            {!searchQuery && (
              <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                Create Your First Plan
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPlans.map((plan) => (
              <div
                key={plan.plan_id}
                className="bg-card border border-border rounded-lg p-6 hover:border-border transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-foreground mb-1">{plan.name}</h3>
                    {plan.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {plan.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-1 text-muted-foreground hover:text-muted-foreground transition-colors">
                      <Edit className="h-4 w-4" />
                    </button>
                    <button className="p-1 text-muted-foreground hover:text-red-400 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground font-medium">
                      {formatCurrency(plan.price, plan.currency)}
                    </span>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getBillingCycleColor(plan.billing_cycle)}`}
                    >
                      {plan.billing_cycle.replace("_", " ")}
                    </span>
                  </div>

                  {plan.trial_period_days && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {plan.trial_period_days} day trial
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        plan.is_active
                          ? "bg-green-100 dark:bg-green-950/20 text-green-800 dark:text-green-400"
                          : "bg-red-100 dark:bg-red-950/20 text-red-800 dark:text-red-400"
                      }`}
                    >
                      {plan.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : // Active Subscriptions
      filteredSubscriptions.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg border border-border">
          <Users className="h-12 w-12 text-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground mb-2">No Subscriptions Found</h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery || selectedStatus !== "all"
              ? "No subscriptions match your current filters."
              : "No active subscriptions yet."}
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Subscription
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Current Period
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Renewal
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {filteredSubscriptions.map((subscription) => (
                  <tr key={subscription.subscription_id} className="hover:bg-muted">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-medium text-foreground">
                            {subscription.subscription_id}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Plan: {subscription.plan_id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-foreground">{subscription.customer_id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(subscription.status)}`}
                        >
                          {subscription.status}
                        </span>
                        {subscription.is_in_trial && (
                          <span className="text-xs text-blue-600 dark:text-blue-400">In Trial</span>
                        )}
                        {subscription.cancel_at_period_end && (
                          <span className="text-xs text-yellow-600 dark:text-yellow-400">
                            Canceling
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      <div>
                        {new Date(subscription.current_period_start).toLocaleDateString()} -
                        {new Date(subscription.current_period_end).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {subscription.days_until_renewal} days
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center gap-2 justify-end">
                        <button className="text-muted-foreground hover:text-foreground">
                          <Edit className="h-4 w-4" />
                        </button>
                        {subscription.status === "active" ? (
                          <button className="text-muted-foreground hover:text-yellow-600 dark:hover:text-yellow-400">
                            <Pause className="h-4 w-4" />
                          </button>
                        ) : (
                          <button className="text-muted-foreground hover:text-green-600 dark:hover:text-green-400">
                            <Play className="h-4 w-4" />
                          </button>
                        )}
                        <button className="text-muted-foreground hover:text-red-600 dark:hover:text-red-400">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
