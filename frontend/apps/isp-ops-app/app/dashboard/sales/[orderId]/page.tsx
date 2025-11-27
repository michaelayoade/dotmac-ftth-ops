"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { Progress } from "@dotmac/ui";
import {
  ArrowLeft,
  Package,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Loader,
  RefreshCw,
  Play,
  RotateCcw,
  User,
  Mail,
  Building2,
  MapPin,
  Calendar,
  DollarSign,
} from "lucide-react";
import { useAppConfig } from "@/providers/AppConfigContext";
import { useToast } from "@dotmac/ui";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns";

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

type ActivationStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

interface Order {
  id: number;
  order_number: string;
  customer_email: string;
  customer_name: string;
  customer_phone?: string;
  company_name?: string;
  organization_slug?: string;
  status: OrderStatus;
  status_message?: string;
  total_amount?: number;
  billing_cycle?: string;
  deployment_region?: string;
  source?: string;
  utm_source?: string;
  utm_campaign?: string;
  service_configuration?: any;
  created_at: string;
  updated_at: string;
}

interface ServiceActivation {
  id: number;
  service_code: string;
  service_name: string;
  status: ActivationStatus;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
}

interface ActivationProgress {
  order_id: number;
  order_number: string;
  total_services: number;
  completed: number;
  failed: number;
  in_progress: number;
  pending: number;
  overall_status: string;
  progress_percent: number;
  activations: ServiceActivation[];
}

function OrderDetailsPageContent() {
  const params = useParams();
  const orderId = params?.["orderId"] as string;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { api } = useAppConfig();
  const apiBaseUrl = api.baseUrl || "";

  // Fetch order details
  const { data: order, isLoading } = useQuery<Order>({
    queryKey: ["sales-order", orderId, apiBaseUrl],
    queryFn: async () => {
      const response = await fetch(`${apiBaseUrl}/api/v1/orders/${orderId}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch order");
      return response.json();
    },
    enabled: !!orderId,
  });

  // Fetch activation progress
  const { data: progress } = useQuery<ActivationProgress>({
    queryKey: ["sales-order-progress", orderId, apiBaseUrl],
    queryFn: async () => {
      const response = await fetch(`${apiBaseUrl}/api/v1/orders/${orderId}/activations/progress`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch progress");
      return response.json();
    },
    enabled: !!orderId,
    refetchInterval: (query) => {
      // Auto-refresh while in progress
      if (
        query?.state?.data &&
        (query.state.data.in_progress > 0 || query.state.data.pending > 0)
      ) {
        return 5000; // Refresh every 5 seconds
      }
      return false;
    },
  });

  // Process order mutation
  const processMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${apiBaseUrl}/api/v1/orders/${orderId}/process`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to process order");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["sales-order-progress", orderId] });
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

  // Retry failed activations mutation
  const retryMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${apiBaseUrl}/api/v1/orders/${orderId}/activations/retry`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to retry activations");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-order-progress", orderId] });
      toast({ title: "Retrying failed activations" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to retry",
        description: error.message,
        variant: "destructive",
      });
    },
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

  const getActivationStatusBadge = (status: ActivationStatus) => {
    const statusConfig: Record<ActivationStatus, { icon: any; color: string; label: string }> = {
      PENDING: { icon: Clock, color: "bg-gray-100 text-gray-800", label: "Pending" },
      IN_PROGRESS: { icon: Loader, color: "bg-blue-100 text-blue-800", label: "In Progress" },
      COMPLETED: { icon: CheckCircle, color: "bg-green-100 text-green-800", label: "Completed" },
      FAILED: { icon: XCircle, color: "bg-red-100 text-red-800", label: "Failed" },
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    return (
      <Badge className={config.color}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Order Not Found</h2>
        <p className="text-muted-foreground mb-4">
          The order you&apos;re looking for doesn&apos;t exist.
        </p>
        <Button asChild>
          <Link href="/dashboard/sales">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Orders
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/dashboard/sales">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{order.order_number}</h1>
            <p className="text-sm text-muted-foreground">Order Details</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(order.status)}
          {(order.status === "APPROVED" || order.status === "FAILED") && (
            <Button onClick={() => processMutation.mutate()} disabled={processMutation.isPending}>
              <Play className="h-4 w-4 mr-2" />
              Process Order
            </Button>
          )}
        </div>
      </div>

      {/* Status Message */}
      {order.status_message && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <p className="text-sm">{order.status_message}</p>
          </CardContent>
        </Card>
      )}

      {/* Activation Progress */}
      {progress && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Activation Progress</CardTitle>
              {progress.failed > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => retryMutation.mutate()}
                  disabled={retryMutation.isPending}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Retry Failed
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Overall Progress</span>
                <span className="text-sm text-muted-foreground">
                  {progress.completed} / {progress.total_services} completed
                </span>
              </div>
              <Progress value={progress.progress_percent} className="h-2" />
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{progress.completed}</div>
                <div className="text-xs text-muted-foreground">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{progress.in_progress}</div>
                <div className="text-xs text-muted-foreground">In Progress</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{progress.pending}</div>
                <div className="text-xs text-muted-foreground">Pending</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{progress.failed}</div>
                <div className="text-xs text-muted-foreground">Failed</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="services">Service Activations</TabsTrigger>
          <TabsTrigger value="customer">Customer Info</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Order Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Order Number</p>
                    <p className="font-medium">{order.order_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <div className="mt-1">{getStatusBadge(order.status)}</div>
                  </div>
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
                    <p className="text-sm text-muted-foreground">Subdomain</p>
                    <p className="font-medium">{order.organization_slug || "N/A"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Timestamps</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Created At</p>
                  </div>
                  <p className="font-medium">{format(new Date(order.created_at), "PPpp")}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Last Updated</p>
                  </div>
                  <p className="font-medium">{format(new Date(order.updated_at), "PPpp")}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Marketing Info */}
          {(order.utm_source || order.utm_campaign) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Marketing Attribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {order.utm_source && (
                    <div>
                      <p className="text-sm text-muted-foreground">UTM Source</p>
                      <p className="font-medium">{order.utm_source}</p>
                    </div>
                  )}
                  {order.utm_campaign && (
                    <div>
                      <p className="text-sm text-muted-foreground">UTM Campaign</p>
                      <p className="font-medium">{order.utm_campaign}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Service Activations Tab */}
        <TabsContent value="services" className="space-y-4">
          {progress && progress.activations.length > 0 ? (
            <div className="grid gap-4">
              {progress.activations.map((activation) => (
                <Card key={activation.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{activation.service_name}</CardTitle>
                        <CardDescription>{activation.service_code}</CardDescription>
                      </div>
                      {getActivationStatusBadge(activation.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {activation.error_message && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-3">
                        <p className="text-sm text-red-800">{activation.error_message}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {activation.started_at && (
                        <div>
                          <p className="text-muted-foreground">Started At</p>
                          <p className="font-medium">
                            {format(new Date(activation.started_at), "PPpp")}
                          </p>
                        </div>
                      )}
                      {activation.completed_at && (
                        <div>
                          <p className="text-muted-foreground">Completed At</p>
                          <p className="font-medium">
                            {format(new Date(activation.completed_at), "PPpp")}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No service activations yet
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Customer Info Tab */}
        <TabsContent value="customer" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Name</p>
                  </div>
                  <p className="font-medium">{order.customer_name}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Email</p>
                  </div>
                  <p className="font-medium">{order.customer_email}</p>
                </div>
                {order.customer_phone && (
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{order.customer_phone}</p>
                  </div>
                )}
                {order.company_name && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Company</p>
                    </div>
                    <p className="font-medium">{order.company_name}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function OrderDetailsPage() {
  return (
    <RouteGuard permission="order.read">
      <OrderDetailsPageContent />
    </RouteGuard>
  );
}
