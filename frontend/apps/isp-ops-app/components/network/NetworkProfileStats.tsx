"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Network, Wifi, Shield, Globe } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 8000,
): Promise<Response> {
  if (init.signal || typeof AbortController === "undefined") {
    return fetch(input, init);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(input, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timeoutId);
  });
}

interface NetworkProfileStats {
  totalProfiles: number;
  profilesWithStaticIpv4: number;
  profilesWithStaticIpv6: number;
  profilesWithVlans: number;
  profilesWithQinq: number;
  profilesWithOption82: number;
  option82EnforceCount: number;
  option82LogCount: number;
  option82IgnoreCount: number;
  // New metrics
  dualStackProfiles: number;
  netboxTrackedProfiles: number;
  ipv6Allocated: number;
  ipv6Active: number;
  ipv6Suspended: number;
  ipv6Revoked: number;
}

interface IPv6LifecycleStats {
  stateCounts: Record<string, number>;
  utilization: {
    totalProfiles: number;
    totalWithIpv6: number;
    activePrefixes: number;
    allocatedNotActive: number;
    revokedPrefixes: number;
    utilizationRate: number;
  };
  netboxIntegration: {
    prefixesWithNetboxId: number;
    prefixesWithoutNetboxId: number;
    netboxIntegrationRate: number;
  };
}

export function NetworkProfileStats() {
  const {
    data: stats,
    isLoading: isProfileStatsLoading,
    error: profileError,
  } = useQuery<NetworkProfileStats>({
    queryKey: ["networkProfileStats"],
    queryFn: async () => {
      const response = await fetchWithTimeout(
        "/api/v1/network/profiles/stats",
        {
          credentials: "include",
        },
        8000,
      );

      if (!response["ok"]) {
        throw new Error("Failed to fetch network profile stats");
      }

      return response.json();
    },
    retry: 1, // Only retry once
    staleTime: 60000, // Cache for 1 minute
  });

  const {
    data: ipv6Stats,
    isLoading: isIpv6StatsLoading,
    error: ipv6Error,
  } = useQuery<IPv6LifecycleStats>({
    queryKey: ["ipv6LifecycleStats"],
    queryFn: async () => {
      const response = await fetchWithTimeout(
        "/api/v1/network/ipv6/stats",
        {
          credentials: "include",
        },
        8000,
      );

      if (!response["ok"]) {
        throw new Error("Failed to fetch IPv6 lifecycle stats");
      }

      const payload = await response.json();
      const utilization = payload["utilization"] ?? {};
      const netboxIntegration = payload["netboxIntegration"] ?? payload["netbox_integration"] ?? {};

      return {
        stateCounts: payload["stateCounts"] ?? payload["state_counts"] ?? {},
        utilization: {
          totalProfiles: utilization.totalProfiles ?? utilization.total_profiles ?? 0,
          totalWithIpv6: utilization.totalWithIpv6 ?? utilization.total_with_ipv6 ?? 0,
          activePrefixes: utilization.activePrefixes ?? utilization.active_prefixes ?? 0,
          allocatedNotActive:
            utilization.allocatedNotActive ?? utilization.allocated_not_active ?? 0,
          revokedPrefixes: utilization.revokedPrefixes ?? utilization.revoked_prefixes ?? 0,
          utilizationRate: utilization.utilizationRate ?? utilization.utilization_rate ?? 0,
        },
        netboxIntegration: {
          prefixesWithNetboxId:
            netboxIntegration.prefixesWithNetboxId ??
            netboxIntegration.prefixes_with_netbox_id ??
            0,
          prefixesWithoutNetboxId:
            netboxIntegration.prefixesWithoutNetboxId ??
            netboxIntegration.prefixes_without_netbox_id ??
            0,
          netboxIntegrationRate:
            netboxIntegration.netboxIntegrationRate ??
            netboxIntegration.netbox_integration_rate ??
            0,
        },
      } satisfies IPv6LifecycleStats;
    },
    retry: 1, // Only retry once
    staleTime: 60000, // Cache for 1 minute
  });

  const isLoading = isProfileStatsLoading || isIpv6StatsLoading;
  const stateCounts = ipv6Stats?.stateCounts ?? {};
  const lifecycleCardStates = {
    allocated: stateCounts["allocated"] ?? stateCounts["ALLOCATED"] ?? 0,
    active: stateCounts["active"] ?? stateCounts["ACTIVE"] ?? 0,
    suspended: stateCounts["suspended"] ?? stateCounts["SUSPENDED"] ?? 0,
    revoked: stateCounts["revoked"] ?? stateCounts["REVOKED"] ?? 0,
  };

  const utilizationRate = ipv6Stats?.utilization?.utilizationRate ?? 0;
  const totalWithIpv6 = ipv6Stats?.utilization?.totalWithIpv6 ?? 0;
  const activePrefixes = ipv6Stats?.utilization?.activePrefixes ?? 0;
  const activationRate =
    totalWithIpv6 > 0 ? Math.round((activePrefixes / totalWithIpv6) * 1000) / 10 : 0;
  const netboxIntegrationRate = ipv6Stats?.netboxIntegration?.netboxIntegrationRate ?? 0;

  const statCards = [
    {
      title: "Total Profiles",
      value: stats?.["totalProfiles"] ?? 0,
      icon: Network,
      description: "Configured network profiles",
    },
    {
      title: "With Static IPv4",
      value: stats?.["profilesWithStaticIpv4"] ?? 0,
      icon: Globe,
      description: "Subscribers with static IPv4 addresses",
    },
    {
      title: "With Static IPv6",
      value: stats?.["profilesWithStaticIpv6"] ?? 0,
      icon: Globe,
      description: "Subscribers with IPv6 configuration",
    },
    {
      title: "Dual Stack",
      value: stats?.["dualStackProfiles"] ?? 0,
      icon: Globe,
      description: "Profiles with both IPv4 and IPv6",
    },
    {
      title: "With VLANs",
      value: stats?.["profilesWithVlans"] ?? 0,
      icon: Wifi,
      description: "Profiles with VLAN configuration",
    },
    {
      title: "QinQ Enabled",
      value: stats?.["profilesWithQinq"] ?? 0,
      icon: Wifi,
      description: "Profiles using 802.1ad QinQ",
    },
    {
      title: "Option 82 Bindings",
      value: stats?.["profilesWithOption82"] ?? 0,
      icon: Shield,
      description: "Profiles with DHCP Option 82",
    },
    {
      title: "NetBox Tracked",
      value: stats?.["netboxTrackedProfiles"] ?? 0,
      icon: Network,
      description: "Profiles tracked in NetBox IPAM",
    },
  ];

  // Show error message if API calls failed
  if (profileError || ipv6Error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Network Profile Statistics</CardTitle>
          <CardDescription>Unable to load network statistics</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {profileError ? "Failed to load profile stats. " : ""}
            {ipv6Error ? "Failed to load IPv6 stats. " : ""}
            The statistics API may be unavailable or taking too long to respond.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            You can still access other network management features.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isLoading ? "..." : stat.value.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Option 82 Policy Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Option 82 Enforcement Policies</CardTitle>
          <CardDescription>
            Distribution of DHCP Option 82 enforcement policies across profiles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-muted-foreground">Enforce</span>
              <span className="text-2xl font-bold">
                {isLoading ? "..." : (stats?.["option82EnforceCount"] ?? 0)}
              </span>
              <span className="text-xs text-muted-foreground">Block on mismatch</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-muted-foreground">Log</span>
              <span className="text-2xl font-bold">
                {isLoading ? "..." : (stats?.["option82LogCount"] ?? 0)}
              </span>
              <span className="text-xs text-muted-foreground">Log but allow</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-muted-foreground">Ignore</span>
              <span className="text-2xl font-bold">
                {isLoading ? "..." : (stats?.["option82IgnoreCount"] ?? 0)}
              </span>
              <span className="text-xs text-muted-foreground">No validation</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* IPv6 Lifecycle States */}
      <Card>
        <CardHeader>
          <CardTitle>IPv6 Lifecycle Utilization</CardTitle>
          <CardDescription>
            Distribution of IPv6 prefixes across lifecycle states with activation and NetBox metrics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-muted-foreground">Allocated</span>
              <span className="text-2xl font-bold">
                {isLoading ? "..." : lifecycleCardStates.allocated}
              </span>
              <span className="text-xs text-muted-foreground">Ready to activate</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-muted-foreground">Active</span>
              <span className="text-2xl font-bold">
                {isLoading ? "..." : lifecycleCardStates.active}
              </span>
              <span className="text-xs text-muted-foreground">Currently in use</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-muted-foreground">Suspended</span>
              <span className="text-2xl font-bold">
                {isLoading ? "..." : lifecycleCardStates.suspended}
              </span>
              <span className="text-xs text-muted-foreground">Service paused</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-muted-foreground">Revoked</span>
              <span className="text-2xl font-bold">
                {isLoading ? "..." : lifecycleCardStates.revoked}
              </span>
              <span className="text-xs text-muted-foreground">Returned to pool</span>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-muted-foreground">Activation Rate</span>
              <span className="text-2xl font-bold">
                {isLoading ? "..." : `${activationRate.toFixed(1)}%`}
              </span>
              <span className="text-xs text-muted-foreground">
                Active prefixes divided by IPv6-capable profiles
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-muted-foreground">Utilization Rate</span>
              <span className="text-2xl font-bold">
                {isLoading ? "..." : `${utilizationRate.toFixed(1)}%`}
              </span>
              <span className="text-xs text-muted-foreground">
                Active prefixes compared to all network profiles
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-muted-foreground">NetBox Integration</span>
              <span className="text-2xl font-bold">
                {isLoading ? "..." : `${netboxIntegrationRate.toFixed(1)}%`}
              </span>
              <span className="text-xs text-muted-foreground">Prefixes tracked in NetBox</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
