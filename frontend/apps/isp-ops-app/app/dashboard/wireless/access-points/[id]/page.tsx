"use client";

// Force dynamic rendering to avoid SSR issues with React Query hooks
export const dynamic = "force-dynamic";

import { use } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import { useRBAC } from "@/contexts/RBACContext";
import {
  useAccessPointDetailGraphQL,
  useWirelessClientsByAccessPointGraphQL,
  getSignalQualityLabel,
  getFrequencyBandLabel,
} from "@/hooks/useWirelessGraphQL";
import { useAppConfig } from "@/providers/AppConfigContext";
import {
  Wifi,
  MapPin,
  Activity,
  Radio,
  Users,
  ArrowLeft,
  RefreshCw,
  Signal,
  Zap,
} from "lucide-react";
import Link from "next/link";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function AccessPointDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const { hasPermission } = useRBAC();
  const { features } = useAppConfig();
  const hasWirelessAccess = features.enableNetwork && hasPermission("isp.ipam.read");

  // Fetch access point details
  const {
    accessPoint,
    loading: apLoading,
    error: apError,
    refetch: refetchAp,
  } = useAccessPointDetailGraphQL({
    id,
    pollInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch clients connected to this AP
  const {
    clients,
    loading: clientsLoading,
    refetch: refetchClients,
  } = useWirelessClientsByAccessPointGraphQL({
    accessPointId: id,
    limit: 100,
    pollInterval: 30000,
  });

  if (!hasWirelessAccess) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-12 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Access Point Details</CardTitle>
            <CardDescription>
              Access requires <code>isp.ipam.read</code> permission.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (apError) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-12 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Error Loading Access Point</CardTitle>
            <CardDescription>{apError}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => refetchAp()} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (apLoading || !accessPoint) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-12 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Loading Access Point...</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  const formatStatus = (status: string) => {
    return status
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "ONLINE":
        return "default";
      case "OFFLINE":
        return "destructive";
      case "DEGRADED":
        return "secondary";
      case "MAINTENANCE":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ONLINE":
        return "text-green-600";
      case "OFFLINE":
        return "text-red-600";
      case "DEGRADED":
        return "text-amber-600";
      case "MAINTENANCE":
        return "text-blue-600";
      default:
        return "text-gray-600";
    }
  };

  const refetchAll = () => {
    refetchAp();
    refetchClients();
  };

  return (
    <main className="max-w-7xl mx-auto px-6 py-12 space-y-8">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/wireless/access-points">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">{accessPoint.name}</h1>
              <p className="text-sm text-muted-foreground">
                {accessPoint.siteName || "Unknown Site"} • {accessPoint.ipAddress}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refetchAll}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Badge variant={getStatusBadgeVariant(accessPoint.status) as any}>
            {formatStatus(accessPoint.status)}
          </Badge>
        </div>
      </header>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connected Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {accessPoint.performance?.connectedClients ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">Active connections</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Radios</CardTitle>
            <Radio className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{2}</div>
            <p className="text-xs text-muted-foreground">Radio interfaces</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uptime</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {accessPoint.lastRebootAt
                ? Math.floor(
                    (Date.now() - new Date(accessPoint.lastRebootAt).getTime()) / (1000 * 86400),
                  )
                : 0}
              d
            </div>
            <p className="text-xs text-muted-foreground">
              {accessPoint.lastRebootAt
                ? `${Math.floor((((Date.now() - new Date(accessPoint.lastRebootAt).getTime()) / 1000) % 86400) / 3600)}h uptime`
                : "No data"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Signal className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getStatusColor(accessPoint.status)}`}>
              {formatStatus(accessPoint.status)}
            </div>
            <p className="text-xs text-muted-foreground">Operational state</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="radios">Radios</TabsTrigger>
          <TabsTrigger value="clients">Clients ({clients.length})</TabsTrigger>
          <TabsTrigger value="location">Location</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Name:</span>
                  <span className="font-medium">{accessPoint.name}</span>

                  <span className="text-muted-foreground">Status:</span>
                  <Badge
                    variant={getStatusBadgeVariant(accessPoint.status) as any}
                    className="w-fit"
                  >
                    {formatStatus(accessPoint.status)}
                  </Badge>

                  <span className="text-muted-foreground">Site:</span>
                  <span>{accessPoint.siteName || "-"}</span>

                  <span className="text-muted-foreground">IP Address:</span>
                  <span className="font-mono text-xs">{accessPoint.ipAddress || "-"}</span>

                  <span className="text-muted-foreground">MAC Address:</span>
                  <span className="font-mono text-xs">{accessPoint.macAddress || "-"}</span>

                  {accessPoint.model && (
                    <>
                      <span className="text-muted-foreground">Model:</span>
                      <span>{accessPoint.model}</span>
                    </>
                  )}

                  {accessPoint.firmwareVersion && (
                    <>
                      <span className="text-muted-foreground">Firmware:</span>
                      <span className="font-mono text-xs">{accessPoint.firmwareVersion}</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Performance Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground mb-1">Connected Clients</div>
                    <div className="text-2xl font-bold">
                      {accessPoint.performance?.connectedClients ?? 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Radio Count</div>
                    <div className="text-2xl font-bold">{2}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Uptime</div>
                    <div className="font-medium">
                      {accessPoint.lastRebootAt
                        ? `${Math.floor((Date.now() - new Date(accessPoint.lastRebootAt).getTime()) / (1000 * 86400))}d ${Math.floor((((Date.now() - new Date(accessPoint.lastRebootAt).getTime()) / 1000) % 86400) / 3600)}h`
                        : "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Last Seen</div>
                    <div className="font-medium">
                      {accessPoint.lastSeenAt
                        ? new Date(accessPoint.lastSeenAt).toLocaleString()
                        : "-"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Hardware Info */}
          {(accessPoint.model || accessPoint.firmwareVersion || accessPoint.serialNumber) && (
            <Card>
              <CardHeader>
                <CardTitle>Hardware Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  {accessPoint.model && (
                    <div>
                      <div className="text-muted-foreground mb-1">Model</div>
                      <div className="font-medium">{accessPoint.model}</div>
                    </div>
                  )}
                  {accessPoint.firmwareVersion && (
                    <div>
                      <div className="text-muted-foreground mb-1">Firmware Version</div>
                      <div className="font-mono text-xs">{accessPoint.firmwareVersion}</div>
                    </div>
                  )}
                  {accessPoint.serialNumber && (
                    <div>
                      <div className="text-muted-foreground mb-1">Serial Number</div>
                      <div className="font-mono text-xs">{accessPoint.serialNumber}</div>
                    </div>
                  )}
                  {accessPoint.hardwareRevision && (
                    <div>
                      <div className="text-muted-foreground mb-1">Hardware Revision</div>
                      <div className="font-medium">{accessPoint.hardwareRevision}</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Radios Tab */}
        <TabsContent value="radios" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Radio Interfaces ({2})</CardTitle>
              <CardDescription>Radio configuration and performance</CardDescription>
            </CardHeader>
            <CardContent>
              {false ? (
                <div className="space-y-4">
                  {[].map((radio: any, index: number) => (
                    <div key={index} className="p-4 rounded-lg border">
                      <div className="flex items-center justify-between mb-3">
                        <div className="font-medium">{radio.radioName || `Radio ${index + 1}`}</div>
                        <Badge variant={radio.enabled ? "default" : "secondary"}>
                          {radio.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground mb-1">Frequency</div>
                          <div className="font-medium">
                            {radio.frequencyBand ? getFrequencyBandLabel(radio.frequencyBand) : "-"}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground mb-1">Channel</div>
                          <div className="font-medium">
                            {radio.channel ? `${radio.channel} (${radio.channelWidthMhz}MHz)` : "-"}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground mb-1">TX Power</div>
                          <div className="font-medium">
                            {radio.transmitPowerDbm ? `${radio.transmitPowerDbm} dBm` : "-"}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground mb-1">Clients</div>
                          <div className="font-medium">{radio.connectedClients || 0}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No radio information available
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Clients Tab */}
        <TabsContent value="clients" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Connected Clients ({clients.length})</CardTitle>
              <CardDescription>Devices currently connected to this access point</CardDescription>
            </CardHeader>
            <CardContent>
              {clientsLoading ? (
                <p className="text-sm text-muted-foreground text-center py-8">Loading clients...</p>
              ) : clients.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No clients connected
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>MAC Address</TableHead>
                        <TableHead>IP Address</TableHead>
                        <TableHead>Hostname</TableHead>
                        <TableHead>SSID</TableHead>
                        <TableHead>Signal</TableHead>
                        <TableHead>Duration</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clients.map((client) => {
                        const duration = 0 ? Math.floor(0 / 60) : 0;
                        const signalQuality = getSignalQualityLabel(client.signalStrengthDbm);

                        return (
                          <TableRow key={client.id}>
                            <TableCell className="font-mono text-xs">{client.macAddress}</TableCell>
                            <TableCell className="font-mono text-xs">
                              {client.ipAddress || "-"}
                            </TableCell>
                            <TableCell>{client.hostname || "-"}</TableCell>
                            <TableCell>{client.ssid || "-"}</TableCell>
                            <TableCell>
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
                            </TableCell>
                            <TableCell>{duration}m</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Location Tab */}
        <TabsContent value="location" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Location Information</CardTitle>
              <CardDescription>Physical location and site details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground mb-1">Site Name</div>
                  <div className="font-medium">{accessPoint.siteName || "-"}</div>
                </div>
                {accessPoint.location && (
                  <>
                    <div>
                      <div className="text-muted-foreground mb-1">Latitude</div>
                      <div className="font-mono text-xs">
                        {accessPoint.location.coordinates?.latitude?.toFixed(6) || "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground mb-1">Longitude</div>
                      <div className="font-mono text-xs">
                        {accessPoint.location.coordinates?.longitude?.toFixed(6) || "-"}
                      </div>
                    </div>
                    {accessPoint.location.coordinates?.altitude && (
                      <div>
                        <div className="text-muted-foreground mb-1">Altitude</div>
                        <div className="font-medium">
                          {accessPoint.location.coordinates?.altitude}m
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Map placeholder */}
              {accessPoint.location && (
                <div className="h-96 rounded-lg border bg-muted flex items-center justify-center">
                  <div className="text-center space-y-2">
                    <MapPin className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Map view will be displayed here</p>
                    <p className="text-xs text-muted-foreground">
                      {accessPoint.location.coordinates?.latitude?.toFixed(6)},{" "}
                      {accessPoint.location.coordinates?.longitude?.toFixed(6)}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
}
