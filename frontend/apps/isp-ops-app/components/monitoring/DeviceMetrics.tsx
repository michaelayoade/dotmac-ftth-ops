"use client";

/**
 * Device Metrics Component with Dual-Stack Monitoring
 *
 * Displays device performance metrics for both IPv4 and IPv6 connectivity
 */

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { IPAddressDisplay } from "@/components/forms/IPAddressDisplay";
import { Activity, Wifi, WifiOff, TrendingUp, TrendingDown, Minus } from "lucide-react";

export interface ConnectivityMetrics {
  ipv4?: {
    reachable: boolean;
    latency_ms?: number;
    packet_loss_percent?: number;
    last_check?: string;
  };
  ipv6?: {
    reachable: boolean;
    latency_ms?: number;
    packet_loss_percent?: number;
    last_check?: string;
  };
}

export interface DeviceMetrics {
  device_id: string;
  device_name: string;
  ipv4_address?: string | null;
  ipv6_address?: string | null;
  status: "online" | "offline" | "degraded";
  connectivity: ConnectivityMetrics;
  cpu_usage_percent?: number;
  memory_usage_percent?: number;
  bandwidth_in_mbps?: number;
  bandwidth_out_mbps?: number;
  uptime_seconds?: number;
  interface_count?: number;
  active_interfaces?: number;
  last_updated: string;
}

export interface DeviceMetricsProps {
  metrics: DeviceMetrics;
}

export function DeviceMetricsPanel({ metrics }: DeviceMetricsProps) {
  const hasIPv4 = metrics.ipv4_address && metrics.ipv4_address.trim() !== "";
  const hasIPv6 = metrics.ipv6_address && metrics.ipv6_address.trim() !== "";

  return (
    <div className="space-y-6">
      {/* Device Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{metrics.device_name}</CardTitle>
              <CardDescription>Device ID: {metrics.device_id}</CardDescription>
            </div>
            <StatusBadge status={metrics.status} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>IP Addresses</Label>
              <IPAddressDisplay
                ipv4={metrics.ipv4_address ?? undefined}
                ipv6={metrics.ipv6_address ?? undefined}
                layout="card"
                showBadges={true}
              />
            </div>
            <div className="space-y-2">
              <Label>Uptime</Label>
              {metrics.uptime_seconds !== undefined ? (
                <div className="text-2xl font-bold">{formatUptime(metrics.uptime_seconds)}</div>
              ) : (
                <div className="text-muted-foreground">N/A</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connectivity Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Connectivity Status</CardTitle>
          <CardDescription>IPv4 and IPv6 reachability</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={hasIPv4 ? "ipv4" : "ipv6"}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="ipv4" disabled={!hasIPv4}>
                IPv4{" "}
                {hasIPv4 && (
                  <ConnectivityIndicator
                    connected={metrics.connectivity.ipv4?.reachable ?? undefined}
                  />
                )}
              </TabsTrigger>
              <TabsTrigger value="ipv6" disabled={!hasIPv6}>
                IPv6{" "}
                {hasIPv6 && (
                  <ConnectivityIndicator
                    connected={metrics.connectivity.ipv6?.reachable ?? undefined}
                  />
                )}
              </TabsTrigger>
            </TabsList>

            {hasIPv4 && (
              <TabsContent value="ipv4" className="space-y-4">
                <ConnectivityCard
                  family="IPv4"
                  address={metrics.ipv4_address!}
                  connectivity={metrics.connectivity.ipv4}
                />
              </TabsContent>
            )}

            {hasIPv6 && (
              <TabsContent value="ipv6" className="space-y-4">
                <ConnectivityCard
                  family="IPv6"
                  address={metrics.ipv6_address!}
                  connectivity={metrics.connectivity.ipv6}
                />
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="CPU Usage"
          value={metrics.cpu_usage_percent ?? undefined}
          unit="%"
          threshold={{ warning: 70, critical: 90 }}
        />
        <MetricCard
          title="Memory Usage"
          value={metrics.memory_usage_percent ?? undefined}
          unit="%"
          threshold={{ warning: 80, critical: 95 }}
        />
        <MetricCard
          title="Bandwidth In"
          value={metrics.bandwidth_in_mbps ?? undefined}
          unit="Mbps"
        />
        <MetricCard
          title="Bandwidth Out"
          value={metrics.bandwidth_out_mbps ?? undefined}
          unit="Mbps"
        />
      </div>

      {/* Interface Status */}
      {metrics.interface_count !== undefined && (
        <Card>
          <CardHeader>
            <CardTitle>Network Interfaces</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div>
                <div className="text-2xl font-bold">{metrics.active_interfaces || 0}</div>
                <div className="text-sm text-muted-foreground">Active</div>
              </div>
              <div className="text-muted-foreground">/</div>
              <div>
                <div className="text-2xl font-bold">{metrics.interface_count}</div>
                <div className="text-sm text-muted-foreground">Total</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-sm font-medium text-muted-foreground">{children}</div>;
}

function StatusBadge({ status }: { status: DeviceMetrics["status"] }) {
  const variants = {
    online: { variant: "default" as const, icon: Wifi, label: "Online" },
    offline: {
      variant: "destructive" as const,
      icon: WifiOff,
      label: "Offline",
    },
    degraded: {
      variant: "secondary" as const,
      icon: Activity,
      label: "Degraded",
    },
  };

  const { variant, icon: Icon, label } = variants[status];

  return (
    <Badge variant={variant}>
      <Icon className="mr-1 h-3 w-3" />
      {label}
    </Badge>
  );
}

function ConnectivityIndicator({ connected }: { connected?: boolean | undefined }) {
  if (connected === undefined) return null;

  return (
    <span
      className={`ml-2 inline-block h-2 w-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`}
    />
  );
}

interface ConnectivityCardProps {
  family: "IPv4" | "IPv6";
  address: string;
  connectivity?: ConnectivityMetrics["ipv4"] | ConnectivityMetrics["ipv6"];
}

function ConnectivityCard({ family, address, connectivity }: ConnectivityCardProps) {
  if (!connectivity) {
    return (
      <div className="text-center text-muted-foreground py-8">No connectivity data available</div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {connectivity.reachable ? (
              <>
                <Wifi className="h-4 w-4 text-green-500" />
                <span className="font-medium text-green-500">Reachable</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-red-500" />
                <span className="font-medium text-red-500">Unreachable</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Latency</CardTitle>
        </CardHeader>
        <CardContent>
          {connectivity.latency_ms !== undefined ? (
            <div className="text-2xl font-bold">{connectivity.latency_ms.toFixed(1)} ms</div>
          ) : (
            <div className="text-muted-foreground">N/A</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Packet Loss</CardTitle>
        </CardHeader>
        <CardContent>
          {connectivity.packet_loss_percent !== undefined ? (
            <div
              className={`text-2xl font-bold ${connectivity.packet_loss_percent > 0 ? "text-red-500" : ""}`}
            >
              {connectivity.packet_loss_percent.toFixed(1)}%
            </div>
          ) : (
            <div className="text-muted-foreground">N/A</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value?: number | undefined;
  unit?: string;
  threshold?: { warning: number; critical: number } | undefined;
}

function MetricCard({ title, value, unit = "", threshold }: MetricCardProps) {
  const getColor = () => {
    if (!threshold || value === undefined) return "text-foreground";
    if (value >= threshold.critical) return "text-red-500";
    if (value >= threshold.warning) return "text-yellow-500";
    return "text-green-500";
  };

  const getTrendIcon = () => {
    if (!threshold || value === undefined) return Minus;
    if (value >= threshold.critical) return TrendingUp;
    if (value >= threshold.warning) return TrendingUp;
    return TrendingDown;
  };

  const Icon = getTrendIcon();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {value !== undefined ? (
          <div className="flex items-baseline gap-2">
            <div className={`text-2xl font-bold ${getColor()}`}>
              {value.toFixed(1)}
              {unit}
            </div>
            <Icon className={`h-4 w-4 ${getColor()}`} />
          </div>
        ) : (
          <div className="text-muted-foreground">N/A</div>
        )}
      </CardContent>
    </Card>
  );
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}
