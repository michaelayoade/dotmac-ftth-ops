"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Ban,
  Calendar,
  CheckCircle,
  Clock,
  Key,
  Loader,
  Package,
  RefreshCw,
  User,
  XCircle,
} from "lucide-react";
import { useAppConfig } from "@/providers/AppConfigContext";
import { useToast } from "@dotmac/ui";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns";

type LicenseStatus = "ACTIVE" | "EXPIRED" | "SUSPENDED" | "REVOKED" | "TRIAL";
type LicenseType = "PERPETUAL" | "SUBSCRIPTION" | "TRIAL" | "NFR" | "FLOATING";

interface License {
  id: string;
  license_key: string;
  customer_id: string;
  product_id: string;
  license_type: LicenseType;
  status: LicenseStatus;
  issued_at: string;
  expires_at?: string;
  activation_count: number;
  max_activations: number;
  suspended_reason?: string;
  revoked_reason?: string;
  metadata?: unknown;
  features?: unknown[];
  restrictions?: unknown[];
  created_at: string;
  updated_at: string;
}

interface Activation {
  id: string;
  license_id: string;
  device_id: string;
  device_fingerprint: string;
  device_name?: string;
  ip_address?: string;
  activated_at: string;
  last_heartbeat?: string;
  deactivated_at?: string;
  status: string;
}

function LicenseDetailsPageContent() {
  const params = useParams();
  const licenseId = params?.["licenseId"] as string;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { api } = useAppConfig();
  const apiBaseUrl = api.baseUrl;

  // Fetch license details
  const { data: licenseData, isLoading } = useQuery({
    queryKey: ["license", apiBaseUrl, licenseId],
    queryFn: async () => {
      const response = await fetch(`${apiBaseUrl}/api/licensing/licenses/${licenseId}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch license");
      return response.json();
    },
    enabled: !!licenseId,
  });

  const license: License | undefined = licenseData?.data;

  // Fetch activations
  const { data: activationsData } = useQuery({
    queryKey: ["license-activations", apiBaseUrl, licenseId],
    queryFn: async () => {
      const response = await fetch(
        `${apiBaseUrl}/api/licensing/licenses/${licenseId}/activations`,
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("Failed to fetch activations");
      return response.json();
    },
    enabled: !!licenseId,
  });

  const activations: Activation[] = activationsData?.data || [];

  // Suspend license mutation
  const suspendMutation = useMutation({
    mutationFn: async (reason: string) => {
      const response = await fetch(`${apiBaseUrl}/api/licensing/licenses/${licenseId}/suspend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) throw new Error("Failed to suspend license");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["license", apiBaseUrl, licenseId] });
      toast({ title: "License suspended successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to suspend license",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Renew license mutation
  const renewMutation = useMutation({
    mutationFn: async (duration: number) => {
      const response = await fetch(`${apiBaseUrl}/api/licensing/licenses/${licenseId}/renew`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ duration_days: duration }),
      });
      if (!response.ok) throw new Error("Failed to renew license");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["license", apiBaseUrl, licenseId] });
      toast({ title: "License renewed successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to renew license",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: LicenseStatus) => {
    const statusConfig: Record<
      LicenseStatus,
      { icon: React.ElementType; color: string; label: string }
    > = {
      ACTIVE: { icon: CheckCircle, color: "bg-green-100 text-green-800", label: "Active" },
      EXPIRED: { icon: Clock, color: "bg-gray-100 text-gray-800", label: "Expired" },
      SUSPENDED: { icon: Ban, color: "bg-orange-100 text-orange-800", label: "Suspended" },
      REVOKED: { icon: XCircle, color: "bg-red-100 text-red-800", label: "Revoked" },
      TRIAL: { icon: AlertTriangle, color: "bg-blue-100 text-blue-800", label: "Trial" },
    };

    const config = statusConfig[status] || statusConfig.ACTIVE;
    const Icon = config.icon;

    return (
      <Badge className={config.color}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const getTypeBadge = (type: LicenseType) => {
    const typeColors: Record<LicenseType, string> = {
      PERPETUAL: "bg-purple-100 text-purple-800",
      SUBSCRIPTION: "bg-blue-100 text-blue-800",
      TRIAL: "bg-yellow-100 text-yellow-800",
      NFR: "bg-pink-100 text-pink-800",
      FLOATING: "bg-indigo-100 text-indigo-800",
    };

    return <Badge className={typeColors[type] || "bg-gray-100 text-gray-800"}>{type}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!license) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">License Not Found</h2>
        <p className="text-muted-foreground mb-4">
          The license you&apos;re looking for doesn&apos;t exist.
        </p>
        <Button asChild>
          <Link href="/dashboard/licensing">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Licenses
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
            <Link href="/dashboard/licensing">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold font-mono">{license.license_key}</h1>
            <p className="text-sm text-muted-foreground">License Details</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(license.status)}
          {getTypeBadge(license.license_type)}
          {license.status === "ACTIVE" && (
            <Button
              variant="outline"
              onClick={() => {
                // eslint-disable-next-line no-alert
                const reason = prompt("Reason for suspension:");
                if (reason) {
                  suspendMutation.mutate(reason);
                }
              }}
              disabled={suspendMutation.isPending}
            >
              <Ban className="h-4 w-4 mr-2" />
              Suspend
            </Button>
          )}
          {(license.status === "EXPIRED" || license.status === "SUSPENDED") && (
            <Button
              onClick={() => {
                // eslint-disable-next-line no-alert
                const days = prompt("Renewal duration (days):", "365");
                if (days) {
                  renewMutation.mutate(parseInt(days));
                }
              }}
              disabled={renewMutation.isPending}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Renew
            </Button>
          )}
        </div>
      </div>

      {/* Alert Messages */}
      {license.suspended_reason && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <p className="text-sm text-orange-800">
              <strong>Suspended:</strong> {license.suspended_reason}
            </p>
          </CardContent>
        </Card>
      )}

      {license.revoked_reason && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-sm text-red-800">
              <strong>Revoked:</strong> {license.revoked_reason}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Activations</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {license.activation_count} / {license.max_activations}
            </div>
            <p className="text-xs text-muted-foreground">Current / Maximum</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Devices</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activations.filter((a) => !a.deactivated_at).length}
            </div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Issued</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{format(new Date(license.issued_at), "PP")}</div>
            <p className="text-xs text-muted-foreground">Issue date</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Expires</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {license.expires_at ? format(new Date(license.expires_at), "PP") : "Never"}
            </div>
            <p className="text-xs text-muted-foreground">Expiration date</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activations">Activations ({activations.length})</TabsTrigger>
          <TabsTrigger value="features">Features & Restrictions</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">License Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Customer ID</p>
                  </div>
                  <p className="font-medium font-mono">{license.customer_id}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Product ID</p>
                  </div>
                  <p className="font-medium font-mono">{license.product_id}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Created At</p>
                  </div>
                  <p className="font-medium">{format(new Date(license.created_at), "PPpp")}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Last Updated</p>
                  </div>
                  <p className="font-medium">{format(new Date(license.updated_at), "PPpp")}</p>
                </div>
              </div>

              {!!license.metadata &&
                Object.keys(license.metadata as Record<string, unknown>).length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Metadata</p>
                    <pre className="p-3 bg-accent rounded-lg overflow-x-auto text-xs">
                      {JSON.stringify(license.metadata, null, 2)}
                    </pre>
                  </div>
                )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activations Tab */}
        <TabsContent value="activations" className="space-y-4">
          {activations.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No activations yet
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {activations.map((activation) => (
                <Card key={activation.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          {activation.device_name || activation.device_id}
                        </CardTitle>
                        <CardDescription className="font-mono text-xs">
                          {activation.device_fingerprint}
                        </CardDescription>
                      </div>
                      {activation.deactivated_at ? (
                        <Badge className="bg-gray-100 text-gray-800">
                          <XCircle className="h-3 w-3 mr-1" />
                          Deactivated
                        </Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">IP Address</p>
                        <p className="font-medium font-mono">{activation.ip_address || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Activated</p>
                        <p className="font-medium">
                          {format(new Date(activation.activated_at), "PPpp")}
                        </p>
                      </div>
                      {activation.last_heartbeat && (
                        <div>
                          <p className="text-muted-foreground">Last Heartbeat</p>
                          <p className="font-medium">
                            {format(new Date(activation.last_heartbeat), "PPpp")}
                          </p>
                        </div>
                      )}
                      {activation.deactivated_at && (
                        <div>
                          <p className="text-muted-foreground">Deactivated</p>
                          <p className="font-medium">
                            {format(new Date(activation.deactivated_at), "PPpp")}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Features Tab */}
        <TabsContent value="features" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Features</CardTitle>
                <CardDescription>Enabled features for this license</CardDescription>
              </CardHeader>
              <CardContent>
                {license.features && license.features.length > 0 ? (
                  <ul className="space-y-2">
                    {license.features.map((feature: unknown, index: number) => (
                      <li key={index} className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                        <span className="text-sm">{JSON.stringify(feature)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No features configured</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Restrictions</CardTitle>
                <CardDescription>Usage restrictions for this license</CardDescription>
              </CardHeader>
              <CardContent>
                {license.restrictions && license.restrictions.length > 0 ? (
                  <ul className="space-y-2">
                    {license.restrictions.map((restriction: unknown, index: number) => (
                      <li key={index} className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-orange-600 mt-0.5" />
                        <span className="text-sm">{JSON.stringify(restriction)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No restrictions configured</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function LicenseDetailsPage() {
  return (
    <RouteGuard permission="admin">
      <LicenseDetailsPageContent />
    </RouteGuard>
  );
}
