"use client";

// Force dynamic rendering to avoid SSR issues with React Query hooks
export const dynamic = "force-dynamic";
export const dynamicParams = true;

/**
 * WireGuard VPN Management Dashboard
 *
 * Main dashboard with overview statistics and quick actions.
 */

import { useState } from "react";
import Link from "next/link";
import { Button } from "@dotmac/ui";
import { Card } from "@dotmac/ui";
import {
  Server,
  Users,
  Activity,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Plus,
  Shield,
  Globe,
} from "lucide-react";
import { useDashboardStats } from "../../../../hooks/useWireGuard";
import {
  formatBytes,
  WireGuardServerStatus,
  WireGuardPeerStatus,
} from "../../../../types/wireguard";

export default function WireGuardDashboardPage() {
  const { data: stats, isLoading, refetch, isFetching } = useDashboardStats();

  const handleRefresh = () => {
    refetch();
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-blue-500" />
            WireGuard VPN Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage VPN servers, peers, and monitor network traffic
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Link href="/dashboard/network/wireguard/servers">
            <Button>
              <Server className="mr-2 h-4 w-4" />
              Manage Servers
            </Button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      ) : !stats ? (
        <Card className="p-6">
          <p className="text-red-500">Error loading dashboard statistics</p>
        </Card>
      ) : (
        <>
          {/* Server Statistics */}
          <div>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Server className="h-5 w-5" />
              VPN Servers
            </h2>
            <div className="grid gap-4 md:grid-cols-5">
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Servers</p>
                    <p className="text-3xl font-bold">{stats.servers.total}</p>
                  </div>
                  <Server className="h-10 w-10 text-blue-500" />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Active</p>
                    <p className="text-3xl font-bold text-green-600">
                      {stats.servers.by_status[WireGuardServerStatus.ACTIVE] || 0}
                    </p>
                  </div>
                  <Activity className="h-10 w-10 text-green-500" />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Inactive</p>
                    <p className="text-3xl font-bold text-gray-600">
                      {stats.servers.by_status[WireGuardServerStatus.INACTIVE] || 0}
                    </p>
                  </div>
                  <Server className="h-10 w-10 text-gray-400" />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Degraded</p>
                    <p className="text-3xl font-bold text-yellow-600">
                      {stats.servers.by_status[WireGuardServerStatus.DEGRADED] || 0}
                    </p>
                  </div>
                  <Activity className="h-10 w-10 text-yellow-500" />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Maintenance</p>
                    <p className="text-3xl font-bold text-blue-600">
                      {stats.servers.by_status[WireGuardServerStatus.MAINTENANCE] || 0}
                    </p>
                  </div>
                  <Server className="h-10 w-10 text-blue-500" />
                </div>
              </Card>
            </div>
          </div>

          {/* Peer Statistics */}
          <div>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Users className="h-5 w-5" />
              VPN Peers (Clients)
            </h2>
            <div className="grid gap-4 md:grid-cols-6">
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Peers</p>
                    <p className="text-3xl font-bold">{stats.peers.total}</p>
                  </div>
                  <Users className="h-10 w-10 text-purple-500" />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Active</p>
                    <p className="text-3xl font-bold text-green-600">
                      {stats.peers.by_status[WireGuardPeerStatus.ACTIVE] || 0}
                    </p>
                  </div>
                  <Activity className="h-10 w-10 text-green-500" />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Online Now</p>
                    <p className="text-3xl font-bold text-blue-600">{stats.peers.online || 0}</p>
                  </div>
                  <Globe className="h-10 w-10 text-blue-500" />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Inactive</p>
                    <p className="text-3xl font-bold text-gray-600">
                      {stats.peers.by_status[WireGuardPeerStatus.INACTIVE] || 0}
                    </p>
                  </div>
                  <Users className="h-10 w-10 text-gray-400" />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Disabled</p>
                    <p className="text-3xl font-bold text-red-600">
                      {stats.peers.by_status[WireGuardPeerStatus.DISABLED] || 0}
                    </p>
                  </div>
                  <Users className="h-10 w-10 text-red-500" />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Expired</p>
                    <p className="text-3xl font-bold text-orange-600">
                      {stats.peers.by_status[WireGuardPeerStatus.EXPIRED] || 0}
                    </p>
                  </div>
                  <Users className="h-10 w-10 text-orange-500" />
                </div>
              </Card>
            </div>
          </div>

          {/* Traffic Statistics */}
          <div>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Network Traffic
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <TrendingDown className="h-4 w-4" />
                      Total Received
                    </p>
                    <p className="text-2xl font-bold">
                      {formatBytes(stats.traffic.total_rx_bytes)}
                    </p>
                  </div>
                  <TrendingDown className="h-10 w-10 text-green-500" />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="h-4 w-4" />
                      Total Transmitted
                    </p>
                    <p className="text-2xl font-bold">
                      {formatBytes(stats.traffic.total_tx_bytes)}
                    </p>
                  </div>
                  <TrendingUp className="h-10 w-10 text-blue-500" />
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Activity className="h-4 w-4" />
                      Total Traffic
                    </p>
                    <p className="text-2xl font-bold">{formatBytes(stats.traffic.total_bytes)}</p>
                  </div>
                  <Activity className="h-10 w-10 text-purple-500" />
                </div>
              </Card>
            </div>
          </div>

          {/* Quick Actions */}
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <Link href="/dashboard/network/wireguard/servers/new">
                <Button className="w-full" size="lg">
                  <Server className="mr-2 h-5 w-5" />
                  Create Server
                </Button>
              </Link>
              <Link href="/dashboard/network/wireguard/peers/new">
                <Button className="w-full" size="lg" variant="secondary">
                  <Users className="mr-2 h-5 w-5" />
                  Create Peer
                </Button>
              </Link>
              <Link href="/dashboard/network/wireguard/provision">
                <Button className="w-full" size="lg" variant="outline">
                  <Plus className="mr-2 h-5 w-5" />
                  Provision VPN Service
                </Button>
              </Link>
            </div>
          </Card>

          {/* Last Updated */}
          <div className="text-center text-sm text-muted-foreground">
            Last updated: {new Date(stats.timestamp).toLocaleString()}
          </div>
        </>
      )}
    </div>
  );
}
