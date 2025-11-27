"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw, Network, AlertCircle, Check, X } from "lucide-react";
import { Button } from "@dotmac/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Alert, AlertDescription } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import { Skeleton } from "@dotmac/ui";
import { CreateIPPoolModal } from "@/components/ipam/CreateIPPoolModal";
import { EditIPPoolModal } from "@/components/ipam/EditIPPoolModal";
import { apiClient } from "@/lib/api/client";

interface IPPool {
  id: string;
  pool_name: string;
  pool_type: "ipv4" | "ipv6" | "dual_stack";
  network_cidr: string;
  gateway: string | null;
  dns_servers: string[] | null;
  vlan_id: number | null;
  status: "active" | "depleted" | "reserved" | "inactive";
  total_addresses: number;
  reserved_count: number;
  assigned_count: number;
  auto_assign_enabled: boolean;
  description: string | null;
  created_at: string;
}

export default function IPPoolManagementPage() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPool, setSelectedPool] = useState<IPPool | null>(null);
  const [poolTypeFilter, setPoolTypeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  // Fetch IP pools
  const {
    data: pools,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["ip-pools", poolTypeFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (poolTypeFilter) params.append("pool_type", poolTypeFilter);
      if (statusFilter) params.append("status", statusFilter);

      const response = await apiClient.get(`/ip-management/pools?${params}`);
      return response.data as IPPool[];
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  const handleCreateSuccess = () => {
    setShowCreateModal(false);
    refetch();
  };

  const handleEditSuccess = () => {
    setSelectedPool(null);
    refetch();
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      depleted: "destructive",
      reserved: "secondary",
      inactive: "outline",
    };

    return (
      <Badge variant={variants[status] || "outline"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getUtilization = (pool: IPPool) => {
    const used = pool.reserved_count + pool.assigned_count;
    const percentage = (used / pool.total_addresses) * 100;
    return { used, percentage };
  };

  const getUtilizationColor = (percentage: number) => {
    if (percentage >= 90) return "text-red-600";
    if (percentage >= 70) return "text-yellow-600";
    return "text-green-600";
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">IP Address Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage IPv4 and IPv6 address pools, reservations, and allocations
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading || isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Pool
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Pools</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pools?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Pools
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pools?.filter((p) => p.status === "active").length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Addresses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pools?.reduce((sum, p) => sum + p.total_addresses, 0).toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Assigned IPs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pools?.reduce((sum, p) => sum + p.assigned_count, 0).toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <select
              value={poolTypeFilter}
              onChange={(e) => setPoolTypeFilter(e.target.value)}
              className="px-3 py-2 border rounded-md bg-background"
            >
              <option value="">All Types</option>
              <option value="ipv4">IPv4</option>
              <option value="ipv6">IPv6</option>
              <option value="dual_stack">Dual Stack</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border rounded-md bg-background"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="depleted">Depleted</option>
              <option value="reserved">Reserved</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Pools Table */}
      <Card>
        <CardHeader>
          <CardTitle>IP Address Pools</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Failed to load IP pools: {error instanceof Error ? error.message : "Unknown error"}
              </AlertDescription>
            </Alert>
          ) : isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : pools && pools.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pool Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Network CIDR</TableHead>
                  <TableHead>Gateway</TableHead>
                  <TableHead>VLAN</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Utilization</TableHead>
                  <TableHead>Auto-Assign</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pools.map((pool) => {
                  const { used, percentage } = getUtilization(pool);
                  return (
                    <TableRow key={pool.id}>
                      <TableCell className="font-medium">{pool.pool_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{pool.pool_type.toUpperCase()}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{pool.network_cidr}</TableCell>
                      <TableCell className="font-mono text-sm">{pool.gateway || "-"}</TableCell>
                      <TableCell>{pool.vlan_id || "-"}</TableCell>
                      <TableCell>{getStatusBadge(pool.status)}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className={`text-sm font-medium ${getUtilizationColor(percentage)}`}>
                            {percentage.toFixed(1)}%
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {used.toLocaleString()} / {pool.total_addresses.toLocaleString()}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {pool.auto_assign_enabled ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => setSelectedPool(pool)}>
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Network className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No IP pools found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Get started by creating your first IP address pool
              </p>
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Pool
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      {showCreateModal && (
        <CreateIPPoolModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateSuccess}
        />
      )}

      {selectedPool && (
        <EditIPPoolModal
          isOpen={!!selectedPool}
          pool={selectedPool}
          onClose={() => setSelectedPool(null)}
          onSuccess={handleEditSuccess}
        />
      )}
    </div>
  );
}
