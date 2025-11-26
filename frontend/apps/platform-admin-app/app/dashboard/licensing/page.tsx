"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import {
  AlertTriangle,
  Ban,
  CheckCircle,
  Clock,
  Eye,
  Key,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import { useAppConfig } from "@/providers/AppConfigContext";
import { useToast } from "@dotmac/ui";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";

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
  metadata?: unknown;
  created_at: string;
  updated_at: string;
}

interface LicenseStats {
  total_licenses: number;
  active_licenses: number;
  expired_licenses: number;
  suspended_licenses: number;
  trial_licenses: number;
}

function LicensingPageContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { api } = useAppConfig();
  const apiBaseUrl = api.baseUrl;

  // Fetch licenses
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["licenses", statusFilter, typeFilter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (typeFilter !== "all") params.append("license_type", typeFilter);
      if (searchQuery) params.append("search", searchQuery);

      const response = await fetch(`${apiBaseUrl}/api/licensing/licenses?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch licenses");
      return response.json();
    },
  });

  const licenses: License[] = data?.data || [];
  const _total = data?.total || 0;

  // Suspend license mutation
  const suspendMutation = useMutation({
    mutationFn: async ({ licenseId, reason }: { licenseId: string; reason: string }) => {
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
      queryClient.invalidateQueries({ queryKey: ["licenses"] });
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

  const filteredLicenses = licenses.filter((license) => {
    const matchesSearch =
      !searchQuery ||
      license.license_key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      license.customer_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      license.product_id.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  const stats: LicenseStats = {
    total_licenses: licenses.length,
    active_licenses: licenses.filter((l) => l.status === "ACTIVE").length,
    expired_licenses: licenses.filter((l) => l.status === "EXPIRED").length,
    suspended_licenses: licenses.filter((l) => l.status === "SUSPENDED").length,
    trial_licenses: licenses.filter((l) => l.status === "TRIAL").length,
  };

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">License Management</h1>
          <p className="text-sm text-muted-foreground">Manage software licenses and activations</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Licenses</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_licenses}</div>
            <p className="text-xs text-muted-foreground">All licenses</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active_licenses}</div>
            <p className="text-xs text-muted-foreground">In use</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Expired</CardTitle>
            <Clock className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.expired_licenses}</div>
            <p className="text-xs text-muted-foreground">Need renewal</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Suspended</CardTitle>
            <Ban className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.suspended_licenses}</div>
            <p className="text-xs text-muted-foreground">On hold</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Trial</CardTitle>
            <AlertTriangle className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.trial_licenses}</div>
            <p className="text-xs text-muted-foreground">Evaluation</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search licenses..."
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
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="EXPIRED">Expired</SelectItem>
                <SelectItem value="SUSPENDED">Suspended</SelectItem>
                <SelectItem value="REVOKED">Revoked</SelectItem>
                <SelectItem value="TRIAL">Trial</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="PERPETUAL">Perpetual</SelectItem>
                <SelectItem value="SUBSCRIPTION">Subscription</SelectItem>
                <SelectItem value="TRIAL">Trial</SelectItem>
                <SelectItem value="NFR">NFR</SelectItem>
                <SelectItem value="FLOATING">Floating</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Licenses Grid */}
      <div className="grid gap-4">
        {isLoading ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Loading licenses...
            </CardContent>
          </Card>
        ) : filteredLicenses.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {searchQuery ? "No licenses match your search" : "No licenses found"}
            </CardContent>
          </Card>
        ) : (
          filteredLicenses.map((license) => (
            <Card key={license.id} className="hover:border-primary transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Key className="h-8 w-8 text-primary" />
                    <div>
                      <CardTitle className="text-lg">
                        <Link
                          href={`/dashboard/licensing/${license.id}`}
                          className="hover:underline font-mono"
                        >
                          {license.license_key}
                        </Link>
                      </CardTitle>
                      <CardDescription>Product: {license.product_id}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(license.status)}
                    {getTypeBadge(license.license_type)}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Customer</p>
                    <p className="font-medium truncate">{license.customer_id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Activations</p>
                    <p className="font-medium">
                      {license.activation_count} / {license.max_activations}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Issued</p>
                    <p className="font-medium">
                      {formatDistanceToNow(new Date(license.issued_at), { addSuffix: true })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Expires</p>
                    <p className="font-medium">
                      {license.expires_at ? format(new Date(license.expires_at), "PP") : "Never"}
                    </p>
                  </div>
                </div>

                {license.suspended_reason && (
                  <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="text-sm text-orange-800">
                      <strong>Suspended:</strong> {license.suspended_reason}
                    </p>
                  </div>
                )}

                <div className="flex gap-2 mt-4 pt-4 border-t">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/licensing/${license.id}`}>
                      <Eye className="h-3 w-3 mr-1" />
                      View Details
                    </Link>
                  </Button>

                  {license.status === "ACTIVE" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // eslint-disable-next-line no-alert
                        const reason = prompt("Reason for suspension:");
                        if (reason) {
                          suspendMutation.mutate({ licenseId: license.id, reason });
                        }
                      }}
                      disabled={suspendMutation.isPending}
                      className="text-orange-600 hover:text-orange-600"
                    >
                      <Ban className="h-3 w-3 mr-1" />
                      Suspend
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

export default function LicensingPage() {
  return (
    <RouteGuard permission="admin">
      <LicensingPageContent />
    </RouteGuard>
  );
}
