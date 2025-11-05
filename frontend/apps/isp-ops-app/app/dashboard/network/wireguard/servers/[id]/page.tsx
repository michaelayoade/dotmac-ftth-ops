"use client";

// Force dynamic rendering to avoid SSR issues with React Query hooks
export const dynamic = "force-dynamic";
export const dynamicParams = true;

/**
 * WireGuard Server Details Page
 *
 * Display comprehensive server information including:
 * - Overview and configuration
 * - Health and capacity monitoring
 * - Network settings
 * - Traffic statistics
 * - Associated peers
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@dotmac/ui";
import { Card } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { useConfirmDialog } from "@dotmac/ui";
import {
  Server,
  Edit,
  Trash2,
  Activity,
  Users,
  Globe,
  RefreshCw,
  ArrowLeft,
  Network,
  Key,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Copy,
  ExternalLink,
} from "lucide-react";
import {
  useWireGuardServer,
  useServerHealth,
  useWireGuardPeers,
  useDeleteWireGuardServer,
} from "@/hooks/useWireGuard";
import type { WireGuardPeer } from "@/types/wireguard";
import { SERVER_STATUS_COLORS, formatBytes, getTimeAgo } from "@/types/wireguard";

interface ServerDetailsPageProps {
  params: {
    id: string;
  };
}

export default function ServerDetailsPage({ params }: ServerDetailsPageProps) {
  const { id } = params;
  const router = useRouter();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const { data: server, isLoading, error, refetch: refetchServer } = useWireGuardServer(id);
  const { data: health, refetch: refetchHealth } = useServerHealth(id);
  const { data: peers = [] } = useWireGuardPeers({
    server_id: id,
    limit: 10,
  });
  const { mutate: deleteServer, isPending: isDeleting } = useDeleteWireGuardServer();
  const confirmDialog = useConfirmDialog();

  const handleRefresh = () => {
    refetchServer();
    refetchHealth();
  };

  const handleDelete = async () => {
    if (!server) return;
    const confirmed = await confirmDialog({
      title: "Delete server",
      description: `Are you sure you want to delete server "${server.name}"? This will also remove all associated peers.`,
      confirmText: "Delete server",
      variant: "destructive",
    });
    if (!confirmed) {
      return;
    }
    deleteServer(id, {
      onSuccess: () => {
        router.push("/dashboard/network/wireguard/servers");
      },
    });
  };

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading server details...</p>
        </div>
      </div>
    );
  }

  if (error || !server) {
    return (
      <div className="space-y-6 p-6">
        <Card className="p-6">
          <p className="text-red-500">
            Error loading server: {String(error) || "Server not found"}
          </p>
          <Button className="mt-4" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Server className="h-8 w-8" />
              {server.name}
            </h1>
            {server.location && (
              <p className="text-muted-foreground flex items-center gap-1 mt-1">
                <Globe className="h-4 w-4" />
                {server.location}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Link href={`/dashboard/network/wireguard/servers/${id}/edit`}>
            <Button variant="outline">
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </Link>
          <Button
            variant="destructive"
            onClick={() => {
              void handleDelete();
            }}
            disabled={isDeleting}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Status Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge className={`mt-2 ${SERVER_STATUS_COLORS[server.status]}`}>
                {server.status}
              </Badge>
            </div>
            <Activity className="h-10 w-10 text-blue-500" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Peers</p>
              <p className="text-3xl font-bold">
                {server.current_peers} / {server.max_peers}
              </p>
            </div>
            <Users className="h-10 w-10 text-purple-500" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Utilization</p>
              <p className="text-3xl font-bold">{server.utilization_percent.toFixed(1)}%</p>
            </div>
            <TrendingUp
              className={`h-10 w-10 ${
                server.utilization_percent >= 90
                  ? "text-red-500"
                  : server.utilization_percent >= 75
                    ? "text-yellow-500"
                    : "text-green-500"
              }`}
            />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Traffic</p>
              <p className="text-2xl font-bold">
                {formatBytes(server.total_rx_bytes + server.total_tx_bytes)}
              </p>
            </div>
            <Network className="h-10 w-10 text-green-500" />
          </div>
        </Card>
      </div>

      {/* Health Status */}
      {health && (
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Health Status
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {health.status === "healthy" ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertCircle
                    className={`h-5 w-5 ${
                      health.status === "degraded" ? "text-yellow-500" : "text-red-500"
                    }`}
                  />
                )}
                <span className="font-semibold">{health.status.toUpperCase()}</span>
              </div>
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

            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 bg-gray-50 rounded">
                <p className="text-sm text-muted-foreground">Interface Status</p>
                <p className="font-semibold">{health.interface_status}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded">
                <p className="text-sm text-muted-foreground">Active Peers</p>
                <p className="font-semibold">{health.active_peers}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded">
                <p className="text-sm text-muted-foreground">Capacity Utilization</p>
                <p className="font-semibold">{health.capacity_utilization.toFixed(1)}%</p>
              </div>
            </div>

            {health.issues.length > 0 && (
              <div className="p-4 bg-red-50 border border-red-200 rounded">
                <p className="font-semibold text-red-900 mb-2">Issues:</p>
                <ul className="space-y-1">
                  {health.issues.map((issue: string, idx: number) => (
                    <li key={idx} className="text-sm text-red-800">
                      • {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Last checked: {new Date(health.timestamp).toLocaleString()}
            </p>
          </div>
        </Card>
      )}

      {/* Server Configuration */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Server className="h-5 w-5" />
          Server Configuration
        </h2>
        <div className="space-y-4">
          {server.description && (
            <div>
              <p className="text-sm text-muted-foreground">Description</p>
              <p className="mt-1">{server.description}</p>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 bg-gray-50 rounded">
              <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                <Globe className="h-4 w-4" />
                Public Endpoint
              </p>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono flex-1">{server.public_endpoint}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(server.public_endpoint, "endpoint")}
                >
                  {copiedField === "endpoint" ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded">
              <p className="text-sm text-muted-foreground mb-2">Listen Port</p>
              <code className="text-sm font-mono">{server.listen_port}</code>
            </div>

            <div className="p-4 bg-gray-50 rounded">
              <p className="text-sm text-muted-foreground mb-2">Server IPv4</p>
              <code className="text-sm font-mono">{server.server_ipv4}</code>
            </div>

            {server.server_ipv6 && (
              <div className="p-4 bg-gray-50 rounded">
                <p className="text-sm text-muted-foreground mb-2">Server IPv6</p>
                <code className="text-sm font-mono">{server.server_ipv6}</code>
              </div>
            )}

            <div className="p-4 bg-gray-50 rounded col-span-2">
              <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                <Key className="h-4 w-4" />
                Public Key
              </p>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono flex-1 break-all">{server.public_key}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(server.public_key, "public_key")}
                >
                  {copiedField === "public_key" ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Network Configuration */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Network className="h-5 w-5" />
          Network Configuration
        </h2>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">DNS Servers</p>
            <div className="flex flex-wrap gap-2">
              {server.dns_servers.map((dns, idx) => (
                <Badge key={idx} variant="outline">
                  {dns}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-2">Allowed IPs</p>
            <div className="flex flex-wrap gap-2">
              {server.allowed_ips.map((ip, idx) => (
                <Badge key={idx} variant="outline">
                  {ip}
                </Badge>
              ))}
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded">
            <p className="text-sm text-muted-foreground">Persistent Keepalive</p>
            <p className="font-semibold">{server.persistent_keepalive} seconds</p>
          </div>
        </div>
      </Card>

      {/* Traffic Statistics */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Traffic Statistics
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="p-6 bg-green-50 border border-green-200 rounded">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-green-900 font-medium">Total Received</p>
              <TrendingDown className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-green-900">
              {formatBytes(server.total_rx_bytes)}
            </p>
          </div>

          <div className="p-6 bg-blue-50 border border-blue-200 rounded">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-blue-900 font-medium">Total Transmitted</p>
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-blue-900">{formatBytes(server.total_tx_bytes)}</p>
          </div>

          <div className="p-6 bg-purple-50 border border-purple-200 rounded">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-purple-900 font-medium">Total Traffic</p>
              <Activity className="h-5 w-5 text-purple-600" />
            </div>
            <p className="text-3xl font-bold text-purple-900">
              {formatBytes(server.total_rx_bytes + server.total_tx_bytes)}
            </p>
          </div>
        </div>

        {server.last_stats_update && (
          <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Last updated: {getTimeAgo(server.last_stats_update)}
          </p>
        )}
      </Card>

      {/* Associated Peers */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Users className="h-5 w-5" />
            Associated Peers ({server.current_peers})
          </h2>
          <div className="flex items-center gap-2">
            <Link href={`/dashboard/network/wireguard/peers?server_id=${id}`}>
              <Button variant="outline" size="sm">
                <ExternalLink className="mr-1 h-3 w-3" />
                View All
              </Button>
            </Link>
            <Link href={`/dashboard/network/wireguard/peers/new?server_id=${id}`}>
              <Button size="sm">
                <Users className="mr-1 h-3 w-3" />
                Add Peer
              </Button>
            </Link>
          </div>
        </div>

        {peers.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No peers configured on this server yet.</p>
            <Link href={`/dashboard/network/wireguard/peers/new?server_id=${id}`}>
              <Button className="mt-4" size="sm">
                <Users className="mr-2 h-4 w-4" />
                Add First Peer
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {peers.slice(0, 10).map((peer: any) => (
              <PeerListItem key={peer.id} peer={peer} />
            ))}
            {server.current_peers > 10 && (
              <Link
                href={`/dashboard/network/wireguard/peers?server_id=${id}`}
                className="block text-center"
              >
                <Button variant="outline" size="sm" className="w-full">
                  View All {server.current_peers} Peers
                </Button>
              </Link>
            )}
          </div>
        )}
      </Card>

      {/* Metadata */}
      {server.metadata_ && Object.keys(server.metadata_).length > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Additional Metadata</h2>
          <div className="p-4 bg-gray-50 rounded">
            <pre className="text-sm overflow-x-auto">
              {JSON.stringify(server.metadata_, null, 2)}
            </pre>
          </div>
        </Card>
      )}

      {/* Timestamps */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Timestamps
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-sm text-muted-foreground">Created</p>
            <p className="font-semibold">{new Date(server.created_at).toLocaleString()}</p>
          </div>
          {server.updated_at && (
            <div>
              <p className="text-sm text-muted-foreground">Last Updated</p>
              <p className="font-semibold">{new Date(server.updated_at).toLocaleString()}</p>
            </div>
          )}
          {server.last_stats_update && (
            <div>
              <p className="text-sm text-muted-foreground">Last Stats Update</p>
              <p className="font-semibold">{new Date(server.last_stats_update).toLocaleString()}</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// Peer List Item Component
// ============================================================================

function PeerListItem({ peer }: { peer: WireGuardPeer }) {
  const getPeerStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500";
      case "inactive":
        return "bg-gray-500";
      case "disabled":
        return "bg-red-500";
      case "expired":
        return "bg-orange-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <Link href={`/dashboard/network/wireguard/peers/${peer.id}`}>
      <div className="p-4 border rounded hover:bg-gray-50 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold">{peer.name}</h4>
              <Badge className={getPeerStatusColor(peer.status)}>{peer.status}</Badge>
              {peer.is_online && (
                <Badge variant="outline" className="bg-green-50">
                  Online
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Network className="h-3 w-3" />
                {peer.peer_ipv4}
              </span>
              {peer.last_handshake && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {getTimeAgo(peer.last_handshake)}
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Traffic</p>
            <p className="font-semibold text-sm">{formatBytes(peer.total_bytes)}</p>
          </div>
        </div>
      </div>
    </Link>
  );
}
