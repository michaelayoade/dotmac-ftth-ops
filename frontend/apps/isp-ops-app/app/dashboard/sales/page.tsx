"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import {
  ShoppingCart,
  Search,
  RefreshCw,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Loader,
  Package,
  DollarSign,
  TrendingUp,
  Users,
} from "lucide-react";
import { useAppConfig } from "@/providers/AppConfigContext";
import { useToast } from "@dotmac/ui";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import { useConfirmDialog } from "@dotmac/ui";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

type OrderStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "VALIDATING"
  | "APPROVED"
  | "PROVISIONING"
  | "ACTIVATING"
  | "ACTIVE"
  | "FAILED"
  | "CANCELLED";

interface Order {
  id: number;
  order_number: string;
  customer_email: string;
  customer_name: string;
  company_name?: string;
  organization_slug?: string;
  status: OrderStatus;
  status_message?: string;
  total_amount?: number;
  billing_cycle?: string;
  deployment_region?: string;
  source?: string;
  created_at: string;
  updated_at: string;
}

interface OrderStats {
  total_orders: number;
  active_orders: number;
  pending_orders: number;
  failed_orders: number;
  total_revenue: number;
  success_rate: number;
}

function SalesOrdersPageContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const confirmDialog = useConfirmDialog();
  const { api } = useAppConfig();
  const apiBaseUrl = api.baseUrl || "";

  // Fetch orders
  const {
    data: orders = [],
    isLoading,
    refetch,
  } = useQuery<Order[]>({
    queryKey: ["sales-orders", statusFilter, searchQuery, apiBaseUrl],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (searchQuery) params.append("customer_email", searchQuery);

      const response = await fetch(`${apiBaseUrl}/api/v1/orders?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch orders");
      return response.json();
    },
  });

  // Fetch statistics
  const { data: stats } = useQuery<OrderStats>({
    queryKey: ["sales-stats", apiBaseUrl],
    queryFn: async () => {
      const response = await fetch(`${apiBaseUrl}/api/v1/orders/stats/summary`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
  });

  // Process order mutation
  const processMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const response = await fetch(`${apiBaseUrl}/api/v1/orders/${orderId}/process`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to process order");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      queryClient.invalidateQueries({ queryKey: ["sales-stats"] });
      toast({ title: "Order processing started" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to process order",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Cancel order mutation
  const cancelMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const response = await fetch(`${apiBaseUrl}/api/v1/orders/${orderId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to cancel order");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      queryClient.invalidateQueries({ queryKey: ["sales-stats"] });
      toast({ title: "Order cancelled successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to cancel order",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      !searchQuery ||
      order.customer_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.company_name && order.company_name.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesSearch;
  });

  const getStatusBadge = (status: OrderStatus) => {
    const statusConfig: Record<OrderStatus, { icon: any; color: string; label: string }> = {
      DRAFT: { icon: Clock, color: "bg-gray-100 text-gray-800", label: "Draft" },
      SUBMITTED: { icon: Clock, color: "bg-blue-100 text-blue-800", label: "Submitted" },
      VALIDATING: { icon: Loader, color: "bg-yellow-100 text-yellow-800", label: "Validating" },
      APPROVED: { icon: CheckCircle, color: "bg-green-100 text-green-800", label: "Approved" },
      PROVISIONING: { icon: Loader, color: "bg-purple-100 text-purple-800", label: "Provisioning" },
      ACTIVATING: { icon: Loader, color: "bg-indigo-100 text-indigo-800", label: "Activating" },
      ACTIVE: { icon: CheckCircle, color: "bg-green-100 text-green-800", label: "Active" },
      FAILED: { icon: XCircle, color: "bg-red-100 text-red-800", label: "Failed" },
      CANCELLED: { icon: AlertCircle, color: "bg-gray-100 text-gray-800", label: "Cancelled" },
    };

    const config = statusConfig[status] || statusConfig.DRAFT;
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sales Orders</h1>
          <p className="text-sm text-muted-foreground">
            Manage customer orders and service provisioning
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_orders}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.active_orders}</div>
              <p className="text-xs text-muted-foreground">Completed orders</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending_orders}</div>
              <p className="text-xs text-muted-foreground">In progress</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Failed</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.failed_orders}</div>
              <p className="text-xs text-muted-foreground">Need attention</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${(stats.total_revenue / 1000).toFixed(1)}k</div>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.success_rate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">Completion</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email, name, or order number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="SUBMITTED">Submitted</SelectItem>
                <SelectItem value="VALIDATING">Validating</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="PROVISIONING">Provisioning</SelectItem>
                <SelectItem value="ACTIVATING">Activating</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      <div className="grid gap-4">
        {isLoading ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Loading orders...
            </CardContent>
          </Card>
        ) : filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {searchQuery ? "No orders match your search" : "No orders found"}
            </CardContent>
          </Card>
        ) : (
          filteredOrders.map((order) => (
            <Card key={order.id} className="hover:border-primary transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Package className="h-8 w-8 text-primary" />
                    <div>
                      <CardTitle className="text-lg">
                        <Link href={`/dashboard/sales/${order.id}`} className="hover:underline">
                          {order.order_number}
                        </Link>
                      </CardTitle>
                      <CardDescription>
                        {order.customer_name} ({order.customer_email})
                      </CardDescription>
                      {order.company_name && (
                        <p className="text-sm text-muted-foreground">{order.company_name}</p>
                      )}
                    </div>
                  </div>
                  {getStatusBadge(order.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Region</p>
                    <p className="font-medium">{order.deployment_region || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Billing Cycle</p>
                    <p className="font-medium capitalize">{order.billing_cycle || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Source</p>
                    <p className="font-medium capitalize">{order.source || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Created</p>
                    <p className="font-medium">
                      {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>

                {order.status_message && (
                  <div className="mt-3 p-3 bg-accent rounded-lg">
                    <p className="text-sm">{order.status_message}</p>
                  </div>
                )}

                <div className="flex gap-2 mt-4 pt-4 border-t">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/sales/${order.id}`}>
                      <Eye className="h-3 w-3 mr-1" />
                      View Details
                    </Link>
                  </Button>

                  {(order.status === "APPROVED" || order.status === "FAILED") && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const confirmed = await confirmDialog({
                          title: "Process order",
                          description: `Process order ${order.order_number}?`,
                          confirmText: "Process",
                        });
                        if (confirmed) {
                          processMutation.mutate(order.id);
                        }
                      }}
                      disabled={processMutation.isPending}
                    >
                      <Loader className="h-3 w-3 mr-1" />
                      Process
                    </Button>
                  )}

                  {(order.status === "DRAFT" || order.status === "SUBMITTED") && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const confirmed = await confirmDialog({
                          title: "Cancel order",
                          description: `Cancel order ${order.order_number}?`,
                          confirmText: "Cancel order",
                          variant: "destructive",
                        });
                        if (confirmed) {
                          cancelMutation.mutate(order.id);
                        }
                      }}
                      disabled={cancelMutation.isPending}
                      className="text-destructive hover:text-destructive"
                    >
                      <XCircle className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

export default function SalesOrdersPage() {
  return (
    <RouteGuard permission="order.read">
      <SalesOrdersPageContent />
    </RouteGuard>
  );
}
