/**
 * Customer Network Monitoring Example Component
 *
 * Demonstrates real-time GraphQL subscriptions for network status monitoring.
 * Shows instant updates when network status, signal strength, or performance changes.
 *
 * Features:
 * - Real-time network status updates via WebSocket
 * - Toast notifications for critical events
 * - Connection status indicator
 * - Live metrics display
 *
 * Created: 2025-10-16
 */

"use client";

import { useEffect, useState } from "react";
import { useCustomerNetworkStatusUpdatedSubscription } from "@/lib/graphql/generated";
import { useToast } from "@dotmac/ui";

interface Props {
  customerId: string;
}

export function CustomerNetworkMonitoring({ customerId }: Props) {
  const { toast } = useToast();
  const [connectionQuality, setConnectionQuality] = useState<
    "excellent" | "good" | "fair" | "poor"
  >("good");

  // Subscribe to real-time network status updates
  const { data, loading, error } = useCustomerNetworkStatusUpdatedSubscription({
    variables: { customerId },
    onSubscriptionData: ({ subscriptionData }) => {
      const update = subscriptionData.data?.customerNetworkStatusUpdated;

      if (!update) return;

      // Show toast notification for status changes
      if (update.connectionStatus === "offline") {
        toast({
          title: "Connection Lost",
          description: "Customer connection has gone offline",
          variant: "destructive",
        });
      } else if (update.connectionStatus === "online") {
        toast({
          title: "Connection Restored",
          description: "Customer connection is back online",
        });
      }

      // Show toast for poor signal quality
      if (update.signalStrength && update.signalStrength < 50) {
        toast({
          title: "Poor Signal Quality",
          description: `Signal strength dropped to ${update.signalStrength}%`,
          variant: "destructive",
        });
      }

      // Update connection quality indicator
      if (update.signalStrength) {
        if (update.signalStrength >= 80) setConnectionQuality("excellent");
        else if (update.signalStrength >= 60) setConnectionQuality("good");
        else if (update.signalStrength >= 40) setConnectionQuality("fair");
        else setConnectionQuality("poor");
      }
    },
  });

  const networkStatus = data?.customerNetworkStatusUpdated;

  if (loading) {
    return (
      <div className="p-4 border rounded-lg bg-muted">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-gray-400 animate-pulse" />
          <span className="text-sm text-muted-foreground">Connecting to real-time updates...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border rounded-lg bg-destructive/10 border-destructive">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-destructive" />
          <span className="text-sm text-destructive">Connection error: {error.message}</span>
        </div>
      </div>
    );
  }

  if (!networkStatus) {
    return (
      <div className="p-4 border rounded-lg bg-muted">
        <span className="text-sm text-muted-foreground">Waiting for network data...</span>
      </div>
    );
  }

  const statusColor =
    networkStatus.connectionStatus === "online"
      ? "bg-green-500"
      : networkStatus.connectionStatus === "degraded"
        ? "bg-yellow-500"
        : "bg-red-500";

  const qualityColor =
    connectionQuality === "excellent"
      ? "text-green-600"
      : connectionQuality === "good"
        ? "text-blue-600"
        : connectionQuality === "fair"
          ? "text-yellow-600"
          : "text-red-600";

  return (
    <div className="space-y-4">
      {/* Connection Status Header */}
      <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
        <div className="flex items-center gap-3">
          <div className={`h-3 w-3 rounded-full ${statusColor} animate-pulse`} />
          <div>
            <h3 className="font-semibold">Network Status</h3>
            <p className="text-sm text-muted-foreground capitalize">
              {networkStatus.connectionStatus}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Live Updates</div>
          <div className="flex items-center gap-1 text-xs text-green-600">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            Connected
          </div>
        </div>
      </div>

      {/* Network Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Signal Strength */}
        <div className="p-4 border rounded-lg bg-card">
          <div className="text-xs text-muted-foreground mb-1">Signal Strength</div>
          <div className={`text-2xl font-bold ${qualityColor}`}>
            {networkStatus.signalStrength ?? "N/A"}%
          </div>
          <div className="text-xs mt-1 capitalize">{connectionQuality}</div>
        </div>

        {/* Download Speed */}
        <div className="p-4 border rounded-lg bg-card">
          <div className="text-xs text-muted-foreground mb-1">Download</div>
          <div className="text-2xl font-bold">
            {networkStatus.downloadSpeedMbps?.toFixed(1) ?? "N/A"}
          </div>
          <div className="text-xs mt-1">Mbps</div>
        </div>

        {/* Upload Speed */}
        <div className="p-4 border rounded-lg bg-card">
          <div className="text-xs text-muted-foreground mb-1">Upload</div>
          <div className="text-2xl font-bold">
            {networkStatus.uploadSpeedMbps?.toFixed(1) ?? "N/A"}
          </div>
          <div className="text-xs mt-1">Mbps</div>
        </div>

        {/* Latency */}
        <div className="p-4 border rounded-lg bg-card">
          <div className="text-xs text-muted-foreground mb-1">Latency</div>
          <div className="text-2xl font-bold">{networkStatus.latencyMs ?? "N/A"}</div>
          <div className="text-xs mt-1">ms</div>
        </div>
      </div>

      {/* Connection Details */}
      <div className="p-4 border rounded-lg bg-card">
        <h4 className="font-semibold mb-3">Connection Details</h4>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">IPv4 Address:</span>
            <div className="font-mono">{networkStatus.ipv4Address ?? "N/A"}</div>
          </div>
          <div>
            <span className="text-muted-foreground">MAC Address:</span>
            <div className="font-mono">{networkStatus.macAddress ?? "N/A"}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Uptime:</span>
            <div>
              {networkStatus.uptimeSeconds
                ? `${Math.floor(networkStatus.uptimeSeconds / 3600)}h ${Math.floor((networkStatus.uptimeSeconds % 3600) / 60)}m`
                : "N/A"}
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">Packet Loss:</span>
            <div>
              {networkStatus.packetLoss !== null && networkStatus.packetLoss !== undefined
                ? `${(networkStatus.packetLoss * 100).toFixed(2)}%`
                : "N/A"}
            </div>
          </div>
        </div>
      </div>

      {/* Last Update Timestamp */}
      <div className="text-xs text-center text-muted-foreground">
        Last updated:{" "}
        {networkStatus.updatedAt ? new Date(networkStatus.updatedAt).toLocaleTimeString() : "N/A"}
      </div>
    </div>
  );
}
