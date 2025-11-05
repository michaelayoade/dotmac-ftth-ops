"use client";

// Force dynamic rendering to avoid SSR issues with React Query hooks
export const dynamic = "force-dynamic";
export const dynamicParams = true;

/**
 * WireGuard Peer Details Page
 *
 * Display comprehensive peer information including:
 * - Configuration details
 * - Connection status
 * - Traffic statistics
 * - Download config option
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@dotmac/ui";
import { Card } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { useConfirmDialog } from "@dotmac/ui";
import {
  Users,
  Edit,
  Trash2,
  ArrowLeft,
  Network,
  Key,
  Clock,
  Download,
  RefreshCw,
  Activity,
  Globe,
  Server,
  Copy,
  CheckCircle,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import {
  useWireGuardPeer,
  useDeleteWireGuardPeer,
  useDownloadPeerConfig,
  useRegeneratePeerConfig,
} from "@/hooks/useWireGuard";
import { PEER_STATUS_COLORS, formatBytes, getTimeAgo } from "@/types/wireguard";

interface PeerDetailsPageProps {
  params: {
    id: string;
  };
}

export default function PeerDetailsPage({ params }: PeerDetailsPageProps) {
  const { id } = params;
  const router = useRouter();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const { data: peer, isLoading, error, refetch } = useWireGuardPeer(id);
  const { mutate: deletePeer, isPending: isDeleting } = useDeleteWireGuardPeer();
  const { mutate: downloadConfig } = useDownloadPeerConfig();
  const { mutate: regenerateConfig, isPending: isRegenerating } = useRegeneratePeerConfig();
  const confirmDialog = useConfirmDialog();

  const handleDelete = async () => {
    if (!peer) return;
    const confirmed = await confirmDialog({
      title: "Delete peer",
      description: `Are you sure you want to delete peer "${peer.name}"? This action cannot be undone.`,
      confirmText: "Delete peer",
      variant: "destructive",
    });
    if (!confirmed) {
      return;
    }
    deletePeer(id, {
      onSuccess: () => {
        router.push("/dashboard/network/wireguard/peers");
      },
    });
  };

  const handleDownload = () => {
    downloadConfig(id);
  };

  const handleRegenerate = async () => {
    const confirmed = await confirmDialog({
      title: "Regenerate configuration",
      description:
        "Regenerating the configuration will create new keys. The old configuration will no longer work. Continue?",
      confirmText: "Regenerate",
      variant: "warning",
    });
    if (!confirmed) {
      return;
    }
    regenerateConfig(id, {
      onSuccess: () => {
        refetch();
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
          <p className="text-muted-foreground">Loading peer details...</p>
        </div>
      </div>
    );
  }

  if (error || !peer) {
    return (
      <div className="space-y-6 p-6">
        <Card className="p-6">
          <p className="text-red-500">Error loading peer: {String(error) || "Peer not found"}</p>
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
              <Users className="h-8 w-8" />
              {peer.name}
            </h1>
            {peer.description && <p className="text-muted-foreground mt-1">{peer.description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" />
            Download Config
          </Button>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Link href={`/dashboard/network/wireguard/peers/${id}/edit`}>
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
              <Badge className={`mt-2 ${PEER_STATUS_COLORS[peer.status]}`}>{peer.status}</Badge>
            </div>
            <Activity className="h-10 w-10 text-blue-500" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Connection</p>
              <Badge className={`mt-2 ${peer.is_online ? "bg-green-500" : "bg-gray-500"}`}>
                {peer.is_online ? "Online" : "Offline"}
              </Badge>
            </div>
            <Globe className="h-10 w-10 text-green-500" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Enabled</p>
              <Badge className={`mt-2 ${peer.enabled ? "bg-blue-500" : "bg-gray-500"}`}>
                {peer.enabled ? "Yes" : "No"}
              </Badge>
            </div>
            <Activity className="h-10 w-10 text-blue-500" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Traffic</p>
              <p className="text-2xl font-bold">{formatBytes(peer.total_bytes)}</p>
            </div>
            <Network className="h-10 w-10 text-purple-500" />
          </div>
        </Card>
      </div>

      {/* Peer Configuration */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Users className="h-5 w-5" />
          Peer Configuration
        </h2>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 bg-gray-50 rounded">
              <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                <Network className="h-4 w-4" />
                Peer IPv4
              </p>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono flex-1">{peer.peer_ipv4}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(peer.peer_ipv4, "ipv4")}
                >
                  {copiedField === "ipv4" ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {peer.peer_ipv6 && (
              <div className="p-4 bg-gray-50 rounded">
                <p className="text-sm text-muted-foreground mb-2">Peer IPv6</p>
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono flex-1 break-all">{peer.peer_ipv6}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(peer.peer_ipv6 || "", "ipv6")}
                  >
                    {copiedField === "ipv6" ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}

            <div className="p-4 bg-gray-50 rounded col-span-2">
              <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                <Key className="h-4 w-4" />
                Public Key
              </p>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono flex-1 break-all">{peer.public_key}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(peer.public_key, "public_key")}
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

          <div>
            <p className="text-sm text-muted-foreground mb-2">Allowed IPs</p>
            <div className="flex flex-wrap gap-2">
              {peer.allowed_ips.map((ip: string, idx: number) => (
                <Badge key={idx} variant="outline">
                  {ip}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Connection Status */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Connection Status
        </h2>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 bg-gray-50 rounded">
              <p className="text-sm text-muted-foreground">Last Handshake</p>
              <p className="font-semibold">
                {peer.last_handshake ? getTimeAgo(peer.last_handshake) : "Never"}
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded">
              <p className="text-sm text-muted-foreground">Endpoint</p>
              <p className="font-semibold font-mono text-sm">{peer.endpoint || "N/A"}</p>
            </div>

            <div className="p-4 bg-gray-50 rounded">
              <p className="text-sm text-muted-foreground">Online Status</p>
              <p className="font-semibold">{peer.is_online ? "🟢 Online" : "⚫ Offline"}</p>
            </div>
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
              <p className="text-sm text-green-900 font-medium">Received</p>
              <TrendingDown className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-green-900">{formatBytes(peer.rx_bytes)}</p>
          </div>

          <div className="p-6 bg-blue-50 border border-blue-200 rounded">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-blue-900 font-medium">Transmitted</p>
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-blue-900">{formatBytes(peer.tx_bytes)}</p>
          </div>

          <div className="p-6 bg-purple-50 border border-purple-200 rounded">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-purple-900 font-medium">Total Traffic</p>
              <Activity className="h-5 w-5 text-purple-600" />
            </div>
            <p className="text-3xl font-bold text-purple-900">{formatBytes(peer.total_bytes)}</p>
          </div>
        </div>

        {peer.last_stats_update && (
          <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Last updated: {getTimeAgo(peer.last_stats_update)}
          </p>
        )}
      </Card>

      {/* Server Information */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Server className="h-5 w-5" />
          Server Information
        </h2>
        <div className="p-4 bg-gray-50 rounded">
          <p className="text-sm text-muted-foreground">Connected to Server</p>
          <Link
            href={`/dashboard/network/wireguard/servers/${peer.server_id}`}
            className="text-blue-600 hover:underline font-semibold"
          >
            View Server Details →
          </Link>
        </div>
      </Card>

      {/* Expiration */}
      {peer.expires_at && (
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Expiration
          </h2>
          <div
            className={`p-4 rounded ${
              peer.is_expired
                ? "bg-red-50 border border-red-200"
                : new Date(peer.expires_at).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000
                  ? "bg-yellow-50 border border-yellow-200"
                  : "bg-green-50 border border-green-200"
            }`}
          >
            <p className="text-sm text-muted-foreground">Expires On</p>
            <p
              className={`text-lg font-bold ${
                peer.is_expired
                  ? "text-red-900"
                  : new Date(peer.expires_at).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000
                    ? "text-yellow-900"
                    : "text-green-900"
              }`}
            >
              {new Date(peer.expires_at).toLocaleString()}
              {peer.is_expired && " (EXPIRED)"}
            </p>
          </div>
        </Card>
      )}

      {/* Notes */}
      {peer.notes && (
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Notes</h2>
          <div className="p-4 bg-gray-50 rounded">
            <p className="whitespace-pre-wrap">{peer.notes}</p>
          </div>
        </Card>
      )}

      {/* Configuration Management */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4">Configuration Management</h2>
        <div className="flex gap-4">
          <Button onClick={handleDownload} size="lg">
            <Download className="mr-2 h-5 w-5" />
            Download Configuration File
          </Button>
          <Button
            onClick={() => {
              void handleRegenerate();
            }}
            variant="outline"
            size="lg"
            disabled={isRegenerating}
          >
            <RefreshCw className={`mr-2 h-5 w-5 ${isRegenerating ? "animate-spin" : ""}`} />
            {isRegenerating ? "Regenerating..." : "Regenerate Keys"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Regenerating keys will invalidate the current configuration. You&apos;ll need to
          redistribute the new config file.
        </p>
      </Card>

      {/* Metadata */}
      {peer.metadata_ && Object.keys(peer.metadata_).length > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Additional Metadata</h2>
          <div className="p-4 bg-gray-50 rounded">
            <pre className="text-sm overflow-x-auto">{JSON.stringify(peer.metadata_, null, 2)}</pre>
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
            <p className="font-semibold">{new Date(peer.created_at).toLocaleString()}</p>
          </div>
          {peer.updated_at && (
            <div>
              <p className="text-sm text-muted-foreground">Last Updated</p>
              <p className="font-semibold">{new Date(peer.updated_at).toLocaleString()}</p>
            </div>
          )}
          {peer.last_stats_update && (
            <div>
              <p className="text-sm text-muted-foreground">Last Stats Update</p>
              <p className="font-semibold">{new Date(peer.last_stats_update).toLocaleString()}</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
