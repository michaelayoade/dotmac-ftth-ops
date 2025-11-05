"use client";

// Force dynamic rendering to avoid SSR issues with React Query hooks
export const dynamic = "force-dynamic";
export const dynamicParams = true;

/**
 * WireGuard Server Management Page
 *
 * List and manage VPN servers with filtering and search.
 */

import { useState } from "react";
import Link from "next/link";
import { Button } from "@dotmac/ui";
import { Card } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { useConfirmDialog } from "@dotmac/ui";
import {
  Server,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Activity,
  Users,
  TrendingUp,
  Globe,
  RefreshCw,
} from "lucide-react";
import {
  useWireGuardServers,
  useDeleteWireGuardServer,
  useServerHealth,
} from "../../../../../hooks/useWireGuard";
import type {
  ListServersParams,
  WireGuardServer,
  WireGuardServerStatus,
} from "../../../../../types/wireguard";
import { SERVER_STATUS_COLORS, formatBytes, getTimeAgo } from "../../../../../types/wireguard";

export default function WireGuardServersPage() {
  const [filters, setFilters] = useState<ListServersParams>({
    limit: 50,
    offset: 0,
  });
  const [searchTerm, setSearchTerm] = useState("");

  const { data: servers = [], isLoading, error } = useWireGuardServers(filters);
  const { mutate: deleteServer } = useDeleteWireGuardServer();
  const confirmDialog = useConfirmDialog();

  const handleSearch = () => {
    // Note: Backend doesn't support search yet, would need to add to API
    // For now, filter client-side
  };

  const handleFilterChange = (key: keyof ListServersParams, value: unknown) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      offset: 0,
    }));
  };

  const clearFilters = () => {
    setFilters({ limit: 50, offset: 0 });
    setSearchTerm("");
  };

  const handleDelete = async (serverId: string, serverName: string) => {
    const confirmed = await confirmDialog({
      title: "Delete server",
      description: `Are you sure you want to delete server "${serverName}"?`,
      confirmText: "Delete server",
      variant: "destructive",
    });
    if (!confirmed) {
      return;
    }
    deleteServer(serverId);
  };

  // Client-side search filter
  const filteredServers = servers.filter((server) =>
    searchTerm
      ? server.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (server.location ?? "").toLowerCase().includes(searchTerm.toLowerCase())
      : true,
  );

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Server className="h-8 w-8" />
            VPN Servers
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage WireGuard VPN servers and monitor their status
          </p>
        </div>
        <Link href="/dashboard/network/wireguard/servers/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Server
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10 pr-4 py-2 w-full border rounded-md"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={filters.status || ""}
              onChange={(e) => handleFilterChange("status", e.target.value || undefined)}
              className="border rounded-md px-3 py-2"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="degraded">Degraded</option>
              <option value="maintenance">Maintenance</option>
            </select>

            <Button onClick={clearFilters} variant="ghost" size="sm">
              Clear
            </Button>
          </div>
        </div>
      </Card>

      {/* Server List */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading servers...</p>
        </div>
      ) : error ? (
        <Card className="p-6">
          <p className="text-red-500">Error loading servers: {String(error)}</p>
        </Card>
      ) : filteredServers.length === 0 ? (
        <Card className="p-12 text-center">
          <Server className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">
            No VPN servers found. Create your first server to get started.
          </p>
          <Link href="/dashboard/network/wireguard/servers/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create First Server
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredServers.map((server) => (
            <ServerCard key={server.id} server={server} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Server Card Component
// ============================================================================

function ServerCard({
  server,
  onDelete,
}: {
  server: WireGuardServer;
  onDelete: (id: string, name: string) => void | Promise<void>;
}) {
  const { data: health } = useServerHealth(server.id);

  const getStatusColor = (status: WireGuardServerStatus): string => {
    return SERVER_STATUS_COLORS[status] || "bg-gray-500";
  };

  const getCapacityColor = (utilization: number): string => {
    if (utilization >= 90) return "bg-red-500";
    if (utilization >= 75) return "bg-yellow-500";
    return "bg-green-500";
  };

  return (
    <Card className="p-6 hover:shadow-lg transition-shadow">
      <Link href={`/dashboard/network/wireguard/servers/${server.id}`}>
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Server className="h-5 w-5" />
                {server.name}
              </h3>
              {server.location && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                  {server.location}
                </p>
              )}
            </div>
            <Badge className={getStatusColor(server.status)}>{server.status}</Badge>
          </div>

          {/* Description */}
          {server.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{server.description}</p>
          )}

          {/* Endpoint */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <span className="text-sm font-medium">Endpoint</span>
            <span className="text-sm font-mono">{server.public_endpoint}</span>
          </div>

          {/* Capacity */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <Users className="h-4 w-4" />
                Peers
              </span>
              <span className="font-semibold">
                {server.current_peers} / {server.max_peers}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${getCapacityColor(
                  server.utilization_percent,
                )}`}
                style={{
                  width: `${Math.min(server.utilization_percent, 100)}%`,
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-right">
              {server.utilization_percent.toFixed(1)}% utilized
            </p>
          </div>

          {/* Traffic Stats */}
          <div className="border-t pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Total Received</p>
                <p className="font-semibold text-sm">{formatBytes(server.total_rx_bytes)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Sent</p>
                <p className="font-semibold text-sm">{formatBytes(server.total_tx_bytes)}</p>
              </div>
            </div>
          </div>

          {/* Health Status */}
          {health && (
            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Activity className="h-4 w-4" />
                  Health
                </span>
                <Badge
                  className={
                    health.status === "healthy"
                      ? "bg-green-500"
                      : health.status === "degraded"
                        ? "bg-yellow-500"
                        : "bg-red-500"
                  }
                >
                  {health.status}
                </Badge>
              </div>
              {health.issues.length > 0 && (
                <div className="mt-2 text-xs text-red-600">
                  {health.issues.map((issue: string, idx: number) => (
                    <p key={idx}>• {issue}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Last Updated */}
          {server.last_stats_update && (
            <p className="text-xs text-muted-foreground">
              Updated {getTimeAgo(server.last_stats_update)}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t">
            <Link
              href={`/dashboard/network/wireguard/servers/${server.id}/edit`}
              className="flex-1"
              onClick={(e) => e.stopPropagation()}
            >
              <Button variant="outline" size="sm" className="w-full">
                <Edit className="mr-1 h-3 w-3" />
                Edit
              </Button>
            </Link>
            <Button
              variant="destructive"
              size="sm"
              className="flex-1"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void onDelete(server.id, server.name);
              }}
            >
              <Trash2 className="mr-1 h-3 w-3" />
              Delete
            </Button>
          </div>
        </div>
      </Link>
    </Card>
  );
}
