"use client";

// Force dynamic rendering to avoid SSR issues with React Query hooks
export const dynamic = "force-dynamic";
export const dynamicParams = true;

/**
 * Wireless Infrastructure Dashboard
 *
 * Main dashboard for wireless network infrastructure monitoring and management
 * Now powered by GraphQL for improved performance and real-time updates
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import {
  useWirelessDashboardGraphQL,
  useAccessPointListGraphQL,
  useWirelessClientListGraphQL,
  useCoverageZoneListGraphQL,
  getSignalQualityLabel,
  getFrequencyBandLabel,
} from "@/hooks/useWirelessGraphQL";
import type { AccessPointStatus, FrequencyBand } from "@/lib/graphql/generated";
import {
  Wifi,
  Radio,
  MapPin,
  Users,
  Activity,
  TrendingUp,
  AlertCircle,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Cable,
} from "lucide-react";
import Link from "next/link";

export default function WirelessDashboardPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<AccessPointStatus | "all">("all");
  const [frequencyFilter, setFrequencyFilter] = useState<FrequencyBand | "all">("all");

  // Fetch dashboard data with GraphQL
  const {
    dashboard,
    loading: dashboardLoading,
    error: dashboardError,
    refetch: refetchDashboard,
  } = useWirelessDashboardGraphQL({
    pollInterval: 30000, // Auto-refresh every 30 seconds
  });

  // Fetch access points with filters
  const {
    accessPoints,
    total: totalAccessPoints,
    loading: accessPointsLoading,
  } = useAccessPointListGraphQL({
    limit: 100,
    offset: 0,
    status: statusFilter !== "all" ? statusFilter : undefined,
    pollInterval: 60000,
  });

  // Fetch active clients
  const {
    clients,
    total: totalClients,
    loading: clientsLoading,
  } = useWirelessClientListGraphQL({
    limit: 100,
    offset: 0,
    pollInterval: 30000,
  });

  // Fetch coverage zones
  const {
    zones,
    total: totalZones,
    loading: zonesLoading,
  } = useCoverageZoneListGraphQL({
    limit: 100,
    offset: 0,
    pollInterval: 60000,
  });

  // Compute derived data
  const accessPointsNeedingAttention = accessPoints.filter(
    (ap: any) => ap.status === "OFFLINE" || ap.status === "DEGRADED",
  );

  const topCoverageZones = zones
    .slice()
    .sort((a: any, b: any) => (b.areaSqkm || 0) - (a.areaSqkm || 0))
    .slice(0, 5);

  // Filter access points by search term
  const filteredAccessPoints = accessPoints.filter(
    (ap: any) =>
      ap.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ap.siteName ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ap.ipAddress ?? "").toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Calculate status colors
  const getStatusColor = (status: AccessPointStatus) => {
    switch (status) {
      case "ONLINE":
        return "bg-green-500";
      case "DEGRADED":
        return "bg-yellow-500";
      case "OFFLINE":
        return "bg-red-500";
      case "MAINTENANCE":
        return "bg-blue-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusBadgeVariant = (status: AccessPointStatus) => {
    switch (status) {
      case "ONLINE":
        return "default";
      case "DEGRADED":
        return "secondary";
      case "OFFLINE":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const formatStatus = (status: string) => {
    return status
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  if (dashboardError) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Wireless Infrastructure</CardTitle>
            <CardDescription>Failed to load wireless data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-destructive">{dashboardError}</p>
            <Button onClick={() => refetchDashboard()} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Wireless Infrastructure</h1>
          <p className="text-muted-foreground">
            Monitor and manage your wireless network devices, radios, and coverage
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetchDashboard()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Link href="/dashboard/wireless/access-points">
            <Button>
              <Wifi className="mr-2 h-4 w-4" />
              Manage Access Points
            </Button>
          </Link>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Access Points</CardTitle>
            <Wifi className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {dashboardLoading ? (
              <div className="text-2xl font-bold text-muted-foreground">Loading...</div>
            ) : (
              <>
                <div className="text-2xl font-bold">{dashboard?.totalAccessPoints || 0}</div>
                <p className="text-xs text-muted-foreground">
                  <span className="text-green-600">{dashboard?.onlineAps || 0} online</span>
                  {" • "}
                  <span className="text-red-600">{dashboard?.offlineAps || 0} offline</span>
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Radios</CardTitle>
            <Radio className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {dashboardLoading ? (
              <div className="text-2xl font-bold text-muted-foreground">Loading...</div>
            ) : (
              <>
                <div className="text-2xl font-bold">{(dashboard?.onlineAps || 0) * 2 || 0}</div>
                <p className="text-xs text-muted-foreground">
                  of {(dashboard?.onlineAps || 0) * 2 || 0} total radios
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connected Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {clientsLoading ? (
              <div className="text-2xl font-bold text-muted-foreground">Loading...</div>
            ) : (
              <>
                <div className="text-2xl font-bold">{totalClients}</div>
                <p className="text-xs text-muted-foreground">
                  {((dashboard?.totalClients || 0) / (dashboard?.totalAccessPoints || 1))?.toFixed(
                    1,
                  ) ?? 0}{" "}
                  avg per AP
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Coverage Zones</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {zonesLoading ? (
              <div className="text-2xl font-bold text-muted-foreground">Loading...</div>
            ) : (
              <>
                <div className="text-2xl font-bold">{totalZones}</div>
                <p className="text-xs text-muted-foreground">{(0)?.toFixed(2) || 0} km² coverage</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Access Points Needing Attention */}
      {accessPointsNeedingAttention.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-900">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <CardTitle>Access Points Needing Attention</CardTitle>
              </div>
              <Link href="/dashboard/wireless/access-points">
                <Button variant="outline" size="sm">
                  View All
                </Button>
              </Link>
            </div>
            <CardDescription>Access points with issues or maintenance needs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {accessPointsNeedingAttention.slice(0, 5).map((ap: any) => (
                <div
                  key={ap.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="space-y-1">
                    <div className="font-medium">{ap.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {ap.siteName} • {ap.ipAddress}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={getStatusBadgeVariant(ap.status)}>
                      {formatStatus(ap.status)}
                    </Badge>
                    {ap?.performance?.connectedClients ??
                      (0 !== undefined && ap?.performance?.connectedClients) ??
                      (0 > 50 && (
                        <Badge variant="outline" className="text-amber-600 border-amber-600">
                          High Load
                        </Badge>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="access-points">Access Points</TabsTrigger>
          <TabsTrigger value="clients">Clients</TabsTrigger>
          <TabsTrigger value="coverage">Coverage</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Access Points by Client Count */}
            <Card>
              <CardHeader>
                <CardTitle>Top Access Points by Client Load</CardTitle>
                <CardDescription>Access points with most connected clients</CardDescription>
              </CardHeader>
              <CardContent>
                {dashboardLoading ? (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                ) : accessPoints.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No access points found.</p>
                ) : (
                  <div className="space-y-3">
                    {accessPoints.map((ap: any) => (
                      <div
                        key={ap.id}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div className="space-y-1 flex-1">
                          <div className="font-medium">{ap.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {ap.siteName || "Unknown Site"}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold">
                            {ap?.performance?.connectedClients ?? 0}
                          </div>
                          <div className="text-xs text-muted-foreground">clients</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Coverage Zones */}
            <Card>
              <CardHeader>
                <CardTitle>Coverage Zones</CardTitle>
                <CardDescription>Wireless coverage area distribution</CardDescription>
              </CardHeader>
              <CardContent>
                {zonesLoading ? (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                ) : topCoverageZones.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No coverage zones defined.</p>
                ) : (
                  <div className="space-y-3">
                    {topCoverageZones.map((zone: any) => (
                      <div
                        key={zone.id}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div className="space-y-1 flex-1">
                          <div className="font-medium">{zone.zoneName}</div>
                          <div className="text-xs text-muted-foreground">
                            {zone.coverageType ? formatStatus(zone.coverageType) : "Unknown"}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            {zone.signalStrengthDbm ? `${zone.signalStrengthDbm} dBm` : "N/A"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {zone.radiusMeters ? `${zone.radiusMeters.toFixed(0)}m` : "N/A"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Manage wireless infrastructure components</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link href="/dashboard/wireless/access-points">
                  <Button variant="outline" className="w-full justify-start">
                    <Wifi className="mr-2 h-4 w-4" />
                    Manage Access Points
                  </Button>
                </Link>
                <Link href="/dashboard/wireless/coverage">
                  <Button variant="outline" className="w-full justify-start">
                    <MapPin className="mr-2 h-4 w-4" />
                    Coverage Zones
                  </Button>
                </Link>
                <Link href="/dashboard/wireless/analytics">
                  <Button variant="outline" className="w-full justify-start">
                    <TrendingUp className="mr-2 h-4 w-4" />
                    RF Analytics
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Access Points Tab */}
        <TabsContent value="access-points" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Access Points ({totalAccessPoints})</CardTitle>
              <CardDescription>Manage wireless infrastructure devices</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search access points..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="ONLINE">Online</SelectItem>
                    <SelectItem value="OFFLINE">Offline</SelectItem>
                    <SelectItem value="DEGRADED">Degraded</SelectItem>
                    <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Access Points Table */}
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-12 px-4 text-left align-middle font-medium">Status</th>
                      <th className="h-12 px-4 text-left align-middle font-medium">Name</th>
                      <th className="h-12 px-4 text-left align-middle font-medium">Site</th>
                      <th className="h-12 px-4 text-left align-middle font-medium">IP Address</th>
                      <th className="h-12 px-4 text-left align-middle font-medium">Radios</th>
                      <th className="h-12 px-4 text-left align-middle font-medium">Clients</th>
                      <th className="h-12 px-4 text-left align-middle font-medium">Uptime</th>
                      <th className="h-12 px-4 text-left align-middle font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accessPointsLoading ? (
                      <tr>
                        <td colSpan={8} className="h-24 text-center">
                          Loading access points...
                        </td>
                      </tr>
                    ) : filteredAccessPoints.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="h-24 text-center">
                          No access points found
                        </td>
                      </tr>
                    ) : (
                      filteredAccessPoints.map((ap: any) => (
                        <tr key={ap.id} className="border-b">
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <div
                                className={`h-2 w-2 rounded-full ${getStatusColor(ap.status)}`}
                              />
                              <Badge variant={getStatusBadgeVariant(ap.status) as any}>
                                {formatStatus(ap.status)}
                              </Badge>
                            </div>
                          </td>
                          <td className="p-4 font-medium">{ap.name}</td>
                          <td className="p-4">{ap.siteName || "-"}</td>
                          <td className="p-4 font-mono text-xs">{ap.ipAddress || "-"}</td>
                          <td className="p-4">{ap?.performance?.connectedClients ?? 0}</td>
                          <td className="p-4">{ap?.performance?.connectedClients ?? 0}</td>
                          <td className="p-4">
                            {(
                              ap.lastRebootAt
                                ? (Date.now() - new Date(ap.lastRebootAt).getTime()) / 1000
                                : 0
                            )
                              ? `${Math.floor((ap.lastRebootAt ? (Date.now() - new Date(ap.lastRebootAt).getTime()) / 1000 : 0) / 3600)}h`
                              : "-"}
                          </td>
                          <td className="p-4">
                            <Link href={`/dashboard/wireless/access-points/${ap.id}`}>
                              <Button variant="ghost" size="sm">
                                Details
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Clients Tab */}
        <TabsContent value="clients" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Connected Clients ({totalClients})</CardTitle>
              <CardDescription>Active wireless client connections</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-12 px-4 text-left align-middle font-medium">MAC Address</th>
                      <th className="h-12 px-4 text-left align-middle font-medium">IP Address</th>
                      <th className="h-12 px-4 text-left align-middle font-medium">Hostname</th>
                      <th className="h-12 px-4 text-left align-middle font-medium">Access Point</th>
                      <th className="h-12 px-4 text-left align-middle font-medium">SSID</th>
                      <th className="h-12 px-4 text-left align-middle font-medium">Signal</th>
                      <th className="h-12 px-4 text-left align-middle font-medium">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientsLoading ? (
                      <tr>
                        <td colSpan={7} className="h-24 text-center">
                          Loading clients...
                        </td>
                      </tr>
                    ) : clients.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="h-24 text-center">
                          No connected clients
                        </td>
                      </tr>
                    ) : (
                      clients.map((client) => {
                        const duration = 0 ? Math.floor(0 / 60) : 0;
                        const signalQuality = getSignalQualityLabel(client.signalStrengthDbm);

                        return (
                          <tr key={client.id} className="border-b">
                            <td className="p-4 font-mono text-xs">{client.macAddress}</td>
                            <td className="p-4 font-mono text-xs">{client.ipAddress || "-"}</td>
                            <td className="p-4">{client.hostname || "-"}</td>
                            <td className="p-4">{client.accessPointName || "Unknown"}</td>
                            <td className="p-4">{client.ssid || "-"}</td>
                            <td className="p-4">
                              <div className="space-y-1">
                                <div className="text-xs">
                                  {client.signalStrengthDbm
                                    ? `${client.signalStrengthDbm} dBm`
                                    : "-"}
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  {signalQuality}
                                </Badge>
                              </div>
                            </td>
                            <td className="p-4">{duration}m</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Coverage Tab */}
        <TabsContent value="coverage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Coverage Zones ({totalZones})</CardTitle>
              <CardDescription>Wireless coverage area definitions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-12 px-4 text-left align-middle font-medium">Zone Name</th>
                      <th className="h-12 px-4 text-left align-middle font-medium">Type</th>
                      <th className="h-12 px-4 text-left align-middle font-medium">Access Point</th>
                      <th className="h-12 px-4 text-left align-middle font-medium">Center</th>
                      <th className="h-12 px-4 text-left align-middle font-medium">Radius</th>
                      <th className="h-12 px-4 text-left align-middle font-medium">Signal</th>
                      <th className="h-12 px-4 text-left align-middle font-medium">Frequency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {zonesLoading ? (
                      <tr>
                        <td colSpan={7} className="h-24 text-center">
                          Loading coverage zones...
                        </td>
                      </tr>
                    ) : zones.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="h-24 text-center">
                          No coverage zones defined
                        </td>
                      </tr>
                    ) : (
                      zones.map((zone: any) => (
                        <tr key={zone.id} className="border-b">
                          <td className="p-4 font-medium">{zone.zoneName}</td>
                          <td className="p-4 capitalize">
                            {zone.coverageType ? formatStatus(zone.coverageType) : "-"}
                          </td>
                          <td className="p-4">{zone.accessPointName || "-"}</td>
                          <td className="p-4 font-mono text-xs">
                            {zone.centerLatitude && zone.centerLongitude
                              ? `${zone.centerLatitude.toFixed(6)}, ${zone.centerLongitude.toFixed(6)}`
                              : "-"}
                          </td>
                          <td className="p-4">
                            {zone.radiusMeters ? `${zone.radiusMeters.toFixed(0)}m` : "-"}
                          </td>
                          <td className="p-4">
                            {zone.signalStrengthDbm ? `${zone.signalStrengthDbm} dBm` : "-"}
                          </td>
                          <td className="p-4">
                            {zone.frequencyBand ? getFrequencyBandLabel(zone.frequencyBand) : "-"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Network Analytics</CardTitle>
              <CardDescription>Wireless infrastructure statistics and trends</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Network Summary */}
                {dashboard && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold">
                          {dashboard.averageSignalStrengthDbm?.toFixed(1) || 0} dBm
                        </div>
                        <p className="text-xs text-muted-foreground">Avg Signal Strength</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold">
                          {(
                            (dashboard.totalClients || 0) / (dashboard.totalAccessPoints || 1)
                          )?.toFixed(1) || 0}
                        </div>
                        <p className="text-xs text-muted-foreground">Avg Clients per AP</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold">
                          {(dashboard.onlineAps || 0) * 2 || 0}
                        </div>
                        <p className="text-xs text-muted-foreground">Total Radios</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{(0)?.toFixed(2) || 0} km²</div>
                        <p className="text-xs text-muted-foreground">Coverage Area</p>
                      </CardContent>
                    </Card>
                  </div>
                )}

                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Detailed RF analytics charts and trends will be displayed here.
                      <br />
                      <Link
                        href="/dashboard/wireless/analytics"
                        className="text-primary hover:underline"
                      >
                        View detailed analytics
                      </Link>
                    </p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
