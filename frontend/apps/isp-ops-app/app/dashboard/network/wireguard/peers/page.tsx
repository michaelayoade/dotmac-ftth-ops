"use client";

// Force dynamic rendering to avoid SSR issues with React Query hooks
export const dynamic = "force-dynamic";
export const dynamicParams = true;

/**
 * WireGuard Peer Management Page
 *
 * List and manage VPN peers (clients) with filtering and search.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@dotmac/ui";
import { Card } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { useConfirmDialog } from "@dotmac/ui";
import {
  Users,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Download,
  RefreshCw,
  Network,
  Clock,
  Activity,
  Globe,
  Server,
} from "lucide-react";
import {
  useWireGuardPeers,
  useWireGuardServers,
  useDeleteWireGuardPeer,
  useDownloadPeerConfig,
} from "@/hooks/useWireGuard";
import type { ListPeersParams, WireGuardPeer, WireGuardPeerStatus } from "@/types/wireguard";
import { PEER_STATUS_COLORS, formatBytes, getTimeAgo } from "@/types/wireguard";

export default function WireGuardPeersPage() {
  const searchParams = useSearchParams();
  const serverIdFromQuery = searchParams.get("server_id") ?? undefined;

  const [filters, setFilters] = useState<ListPeersParams>({
    limit: 50,
    offset: 0,
    ...(serverIdFromQuery ? { server_id: serverIdFromQuery } : {}),
  });
  const [searchTerm, setSearchTerm] = useState("");

  const { data: peers = [], isLoading, error } = useWireGuardPeers(filters);
  const { data: servers = [] } = useWireGuardServers({ limit: 1000 });
  const { mutate: deletePeer } = useDeleteWireGuardPeer();
  const { mutate: downloadConfig } = useDownloadPeerConfig();
  const confirmDialog = useConfirmDialog();

  // Update filters when URL query param changes
  useEffect(() => {
    setFilters((prev) => {
      const next = { ...prev };
      if (serverIdFromQuery) {
        next.server_id = serverIdFromQuery;
      } else {
        delete next.server_id;
      }
      return next;
    });
  }, [serverIdFromQuery]);

  const handleSearch = () => {
    // Backend doesn't support search yet, client-side filtering
  };

  const handleFilterChange = (key: keyof ListPeersParams, value: unknown) => {
    setFilters((prev) => {
      const next = { ...prev, offset: 0 };
      if (value === undefined || value === null || value === "") {
        delete next[key];
      } else {
        next[key] = value as never;
      }
      return next;
    });
  };

  const clearFilters = () => {
    setFilters({ limit: 50, offset: 0 });
    setSearchTerm("");
  };

  const handleDelete = async (peerId: string, peerName: string) => {
    const confirmed = await confirmDialog({
      title: "Delete peer",
      description: `Are you sure you want to delete peer "${peerName}"?`,
      confirmText: "Delete peer",
      variant: "destructive",
    });
    if (!confirmed) {
      return;
    }
    deletePeer(peerId);
  };

  const handleDownload = (peerId: string) => {
    downloadConfig(peerId);
  };

  // Client-side search filter
  const filteredPeers = peers.filter((peer: WireGuardPeer) =>
    searchTerm
      ? peer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        peer.peer_ipv4.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (peer["customer_id"] ?? "").toLowerCase().includes(searchTerm.toLowerCase())
      : true,
  );

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8" />
            VPN Peers
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage WireGuard VPN peer connections and configurations
          </p>
        </div>
        <Link href="/dashboard/network/wireguard/peers/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Peer
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
                placeholder="Search by name, IP, or customer ID..."
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
              value={filters.server_id || ""}
              onChange={(e) => handleFilterChange("server_id", e.target.value || undefined)}
              className="border rounded-md px-3 py-2"
            >
              <option value="">All Servers</option>
              {servers.map((server) => (
                <option key={server.id} value={server.id}>
                  {server.name}
                </option>
              ))}
            </select>

            <select
              value={filters.status || ""}
              onChange={(e) => handleFilterChange("status", e.target.value || undefined)}
              className="border rounded-md px-3 py-2"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="disabled">Disabled</option>
              <option value="expired">Expired</option>
            </select>

            <Button onClick={clearFilters} variant="ghost" size="sm">
              Clear
            </Button>
          </div>
        </div>
      </Card>

      {/* Peer List */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading peers...</p>
        </div>
      ) : error ? (
        <Card className="p-6">
          <p className="text-red-500">Error loading peers: {String(error)}</p>
        </Card>
      ) : filteredPeers.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">
            No VPN peers found.{" "}
            {filters.server_id
              ? "This server has no peers yet."
              : "Create your first peer to get started."}
          </p>
          <Link href="/dashboard/network/wireguard/peers/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create First Peer
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredPeers.map((peer: WireGuardPeer) => (
            <PeerCard
              key={peer.id}
              peer={peer}
              onDelete={handleDelete}
              onDownload={handleDownload}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Peer Card Component
// ============================================================================

function PeerCard({
  peer,
  onDelete,
  onDownload,
}: {
  peer: WireGuardPeer;
  onDelete: (id: string, name: string) => void | Promise<void>;
  onDownload: (id: string) => void;
}) {
  const getStatusColor = (status: WireGuardPeerStatus): string => {
    return PEER_STATUS_COLORS[status] || "bg-gray-500";
  };

  return (
    <Card className="p-6 hover:shadow-lg transition-shadow">
      <Link href={`/dashboard/network/wireguard/peers/${peer.id}`}>
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                {peer.name}
              </h3>
              {peer.description && (
                <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                  {peer.description}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1 items-end">
              <Badge className={getStatusColor(peer.status)}>{peer.status}</Badge>
              {peer.is_online && (
                <Badge variant="outline" className="bg-green-50">
                  <Globe className="mr-1 h-3 w-3" />
                  Online
                </Badge>
              )}
            </div>
          </div>

          {/* Network Info */}
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <span className="text-sm font-medium flex items-center gap-1">
                <Network className="h-3 w-3" />
                IP Address
              </span>
              <span className="text-sm font-mono">{peer.peer_ipv4}</span>
            </div>

            {peer.endpoint && (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-sm font-medium">Endpoint</span>
                <span className="text-sm font-mono text-muted-foreground">{peer.endpoint}</span>
              </div>
            )}
          </div>

          {/* Connection Status */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <Activity className="h-4 w-4" />
                Last Handshake
              </span>
              <span className="font-semibold">
                {peer.last_handshake ? getTimeAgo(peer.last_handshake) : "Never"}
              </span>
            </div>

            {peer.enabled ? (
              <div className="flex items-center gap-1 text-sm text-green-600">
                <Activity className="h-3 w-3" />
                Enabled
              </div>
            ) : (
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <Activity className="h-3 w-3" />
                Disabled
              </div>
            )}
          </div>

          {/* Traffic Stats */}
          <div className="border-t pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Received</p>
                <p className="font-semibold text-sm">{formatBytes(peer.rx_bytes)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Sent</p>
                <p className="font-semibold text-sm">{formatBytes(peer.tx_bytes)}</p>
              </div>
            </div>
            <div className="mt-2">
              <p className="text-xs text-muted-foreground">Total Traffic</p>
              <p className="font-semibold text-sm">{formatBytes(peer.total_bytes)}</p>
            </div>
          </div>

          {/* Expiration */}
          {peer.expires_at && (
            <div className="border-t pt-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Expires</p>
                  <p
                    className={`text-sm font-semibold ${
                      peer.is_expired
                        ? "text-red-600"
                        : new Date(peer.expires_at).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000
                          ? "text-yellow-600"
                          : "text-green-600"
                    }`}
                  >
                    {new Date(peer.expires_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Last Updated */}
          {peer.last_stats_update && (
            <p className="text-xs text-muted-foreground">
              Updated {getTimeAgo(peer.last_stats_update)}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDownload(peer.id);
              }}
            >
              <Download className="mr-1 h-3 w-3" />
              Config
            </Button>
            <Link
              href={`/dashboard/network/wireguard/peers/${peer.id}/edit`}
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
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void onDelete(peer.id, peer.name);
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </Link>
    </Card>
  );
}
