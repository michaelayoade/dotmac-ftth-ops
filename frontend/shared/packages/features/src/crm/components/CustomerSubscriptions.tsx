"use client";

import { useToast } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import {
  Wifi,
  TrendingUp,
  Calendar,
  DollarSign,
  Settings,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  ExternalLink,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";

// ============================================================================
// Types
// ============================================================================

export interface Subscription {
  id: string;
  plan_name: string;
  status: "active" | "suspended" | "cancelled" | "pending";
  bandwidth_download_mbps: number;
  bandwidth_upload_mbps: number;
  monthly_fee: number;
  start_date: string;
  end_date?: string;
  billing_cycle: "monthly" | "quarterly" | "annually";
  auto_renew: boolean;
  service_type: string;
}

export interface CustomerSubscriptionsApiClient {
  get: <T = any>(url: string, config?: any) => Promise<{ data: T }>;
}

export interface CustomerSubscriptionsProps {
  customerId: string;
  apiClient: CustomerSubscriptionsApiClient;
  useToast: () => { toast: (options: any) => void };
  subscriptionUrlPrefix: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

const getStatusBadge = (status: Subscription["status"]) => {
  switch (status) {
    case "active":
      return (
        <Badge className="bg-green-500">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Active
        </Badge>
      );
    case "suspended":
      return (
        <Badge variant="secondary">
          <AlertCircle className="w-3 h-3 mr-1" />
          Suspended
        </Badge>
      );
    case "cancelled":
      return (
        <Badge variant="destructive">
          <XCircle className="w-3 h-3 mr-1" />
          Cancelled
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="outline">
          <AlertCircle className="w-3 h-3 mr-1" />
          Pending
        </Badge>
      );
  }
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

// ============================================================================
// Component
// ============================================================================

export default function CustomerSubscriptions({
  customerId,
  apiClient,
  useToast,
  subscriptionUrlPrefix,
}: CustomerSubscriptionsProps) {
  const { toast } = useToast();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSubscriptions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<{ subscriptions: Subscription[] }>(
        `/api/isp/v1/admin/customers/${customerId}/subscriptions`,
      );
      setSubscriptions(response.data.subscriptions);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to load subscriptions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [customerId, toast, apiClient]);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const handleManageSubscription = (subscriptionId: string) => {
    // Navigate to subscription management page
    window.open(`${subscriptionUrlPrefix}/${subscriptionId}`, "_blank");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading subscriptions...</div>
      </div>
    );
  }

  if (subscriptions.length === 0) {
    return (
      <div className="text-center py-12">
        <Wifi className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-300 mb-2">No Active Subscriptions</h3>
        <p className="text-slate-500 mb-4">
          This customer doesn&apos;t have any subscriptions yet.
        </p>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add Subscription
        </Button>
      </div>
    );
  }

  const activeSubscription = subscriptions.find((s) => s.status === "active");

  return (
    <div className="space-y-6">
      {/* Active Subscription Summary */}
      {activeSubscription && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Current Service Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Wifi className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-slate-400">Plan</span>
                </div>
                <p className="text-lg font-semibold text-white">{activeSubscription.plan_name}</p>
                <p className="text-sm text-slate-500">{activeSubscription.service_type}</p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-slate-400">Bandwidth</span>
                </div>
                <p className="text-lg font-semibold text-white">
                  {activeSubscription.bandwidth_download_mbps} Mbps
                </p>
                <p className="text-sm text-slate-500">
                  ↑ {activeSubscription.bandwidth_upload_mbps} Mbps upload
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm text-slate-400">Monthly Fee</span>
                </div>
                <p className="text-lg font-semibold text-white">
                  {formatCurrency(activeSubscription.monthly_fee)}
                </p>
                <p className="text-sm text-slate-500 capitalize">
                  {activeSubscription.billing_cycle} billing
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-purple-400" />
                  <span className="text-sm text-slate-400">Started</span>
                </div>
                <p className="text-lg font-semibold text-white">
                  {formatDate(activeSubscription.start_date)}
                </p>
                <p className="text-sm text-slate-500">
                  {activeSubscription.auto_renew ? "Auto-renew enabled" : "Manual renewal"}
                </p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-700 flex justify-end">
              <Button
                variant="outline"
                onClick={() => handleManageSubscription(activeSubscription.id)}
              >
                <Settings className="w-4 h-4 mr-2" />
                Manage Subscription
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Subscriptions Table */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h4 className="text-lg font-semibold text-white mb-4">Subscription History</h4>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-slate-400">Plan Name</TableHead>
              <TableHead className="text-slate-400">Status</TableHead>
              <TableHead className="text-slate-400">Bandwidth</TableHead>
              <TableHead className="text-slate-400">Monthly Fee</TableHead>
              <TableHead className="text-slate-400">Start Date</TableHead>
              <TableHead className="text-slate-400">End Date</TableHead>
              <TableHead className="text-slate-400">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subscriptions.map((subscription) => (
              <TableRow key={subscription.id} className="border-slate-700">
                <TableCell className="font-medium text-white">
                  {subscription.plan_name}
                  <div className="text-xs text-slate-500">{subscription.service_type}</div>
                </TableCell>
                <TableCell>{getStatusBadge(subscription.status)}</TableCell>
                <TableCell className="text-slate-300">
                  {subscription.bandwidth_download_mbps} / {subscription.bandwidth_upload_mbps} Mbps
                </TableCell>
                <TableCell className="text-slate-300">
                  {formatCurrency(subscription.monthly_fee)}
                </TableCell>
                <TableCell className="text-slate-300">
                  {formatDate(subscription.start_date)}
                </TableCell>
                <TableCell className="text-slate-300">
                  {subscription.end_date ? formatDate(subscription.end_date) : "-"}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleManageSubscription(subscription.id)}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
