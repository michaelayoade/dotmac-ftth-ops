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
import { useFiberCableDetailsAggregated } from "@/hooks/useFiberGraphQL";
import { useAppConfig } from "@/providers/AppConfigContext";
import {
  Cable,
  MapPin,
  Activity,
  AlertCircle,
  Link as LinkIcon,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function FiberCableDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const { hasPermission } = useRBAC();
  const { features } = useAppConfig();
  const hasFiberAccess = features.enableNetwork && hasPermission("isp.ipam.read");

  const { cable, healthMetrics, splicePoints, isLoading, error, refetch } =
    useFiberCableDetailsAggregated(id);

  if (!hasFiberAccess) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-12 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Fiber Cable Details</CardTitle>
            <CardDescription>
              Access requires <code>isp.ipam.read</code> permission.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-12 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Error Loading Cable</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => refetch()} variant="outline">
              Retry
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (isLoading || !cable) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-12 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Loading Cable Details...</CardTitle>
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

  const formatFiberType = (type: string) => {
    return type
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "default";
      case "INACTIVE":
        return "secondary";
      case "UNDER_CONSTRUCTION":
        return "outline";
      case "MAINTENANCE":
        return "secondary";
      case "DAMAGED":
        return "destructive";
      case "DECOMMISSIONED":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case "EXCELLENT":
        return "text-green-600";
      case "GOOD":
        return "text-green-500";
      case "FAIR":
        return "text-amber-500";
      case "POOR":
        return "text-orange-600";
      case "CRITICAL":
        return "text-red-600";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-6 py-12 space-y-8">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/network/fiber/cables">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">{cable.name}</h1>
              <p className="text-sm text-muted-foreground">Cable ID: {cable.cableId}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Badge variant={getStatusBadgeVariant(cable.status)}>
            {formatFiberType(cable.status)}
          </Badge>
        </div>
      </header>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cable Length</CardTitle>
            <Cable className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(cable.lengthMeters / 1000).toFixed(2)} km</div>
            <p className="text-xs text-muted-foreground">{cable.lengthMeters.toFixed(0)} meters</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Capacity Utilization</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cable.capacityUtilizationPercent.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {cable.usedStrands} / {cable.totalStrands} strands used
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Strands</CardTitle>
            <LinkIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cable.availableStrands}</div>
            <p className="text-xs text-muted-foreground">
              {((cable.availableStrands / cable.totalStrands) * 100).toFixed(0)}% available
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Splice Points</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cable.spliceCount}</div>
            <p className="text-xs text-muted-foreground">Along cable route</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="health">Health Metrics</TabsTrigger>
          <TabsTrigger value="strands">Fiber Strands</TabsTrigger>
          <TabsTrigger value="splices">Splice Points</TabsTrigger>
          <TabsTrigger value="route">Route Details</TabsTrigger>
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
                  <span className="text-muted-foreground">Cable ID:</span>
                  <span className="font-medium">{cable.cableId}</span>

                  <span className="text-muted-foreground">Name:</span>
                  <span className="font-medium">{cable.name}</span>

                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant={getStatusBadgeVariant(cable.status)} className="w-fit">
                    {formatFiberType(cable.status)}
                  </Badge>

                  <span className="text-muted-foreground">Fiber Type:</span>
                  <span>{formatFiberType(cable.fiberType)}</span>

                  <span className="text-muted-foreground">Installation:</span>
                  <span>{formatFiberType(cable.installationType)}</span>

                  {cable.manufacturer && (
                    <>
                      <span className="text-muted-foreground">Manufacturer:</span>
                      <span>{cable.manufacturer}</span>
                    </>
                  )}

                  {cable.model && (
                    <>
                      <span className="text-muted-foreground">Model:</span>
                      <span>{cable.model}</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Connection Points */}
            <Card>
              <CardHeader>
                <CardTitle>Connection Points</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Start Point</div>
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <div className="font-medium">
                        {cable.startPointName || "Unknown Location"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ID: {cable.startDistributionPointId}
                      </div>
                    </div>
                    <Link
                      href={`/dashboard/network/fiber/distribution-points/${cable.startDistributionPointId}`}
                    >
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </Link>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">End Point</div>
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <div className="font-medium">{cable.endPointName || "Unknown Location"}</div>
                      <div className="text-xs text-muted-foreground">
                        ID: {cable.endDistributionPointId}
                      </div>
                    </div>
                    <Link
                      href={`/dashboard/network/fiber/distribution-points/${cable.endDistributionPointId}`}
                    >
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Physical Characteristics */}
          <Card>
            <CardHeader>
              <CardTitle>Physical Characteristics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground mb-1">Length</div>
                  <div className="font-medium">{(cable.lengthMeters / 1000).toFixed(2)} km</div>
                </div>

                <div>
                  <div className="text-muted-foreground mb-1">Total Strands</div>
                  <div className="font-medium">{cable.totalStrands}</div>
                </div>

                <div>
                  <div className="text-muted-foreground mb-1">Armored</div>
                  <div className="font-medium">{cable.armored ? "Yes" : "No"}</div>
                </div>

                <div>
                  <div className="text-muted-foreground mb-1">Fire Rated</div>
                  <div className="font-medium">{cable.fireRated ? "Yes" : "No"}</div>
                </div>

                {cable.conduitId && (
                  <div>
                    <div className="text-muted-foreground mb-1">Conduit ID</div>
                    <div className="font-medium">{cable.conduitId}</div>
                  </div>
                )}

                {cable.ductNumber && (
                  <div>
                    <div className="text-muted-foreground mb-1">Duct Number</div>
                    <div className="font-medium">{cable.ductNumber}</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Health Metrics Tab */}
        <TabsContent value="health" className="space-y-6">
          {healthMetrics.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Health Metrics Available</h3>
                <p className="text-sm text-muted-foreground">
                  Health metrics will appear here once testing data is available.
                </p>
              </CardContent>
            </Card>
          ) : (
            healthMetrics.map((metric) => (
              <Card key={metric.cableId}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Health Status</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          metric.healthStatus === "CRITICAL" || metric.healthStatus === "POOR"
                            ? "destructive"
                            : "outline"
                        }
                      >
                        {formatFiberType(metric.healthStatus)}
                      </Badge>
                      <div
                        className={`text-2xl font-bold ${getHealthStatusColor(metric.healthStatus)}`}
                      >
                        {metric.healthScore.toFixed(0)}%
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Optical Metrics */}
                  <div>
                    <h3 className="text-sm font-medium mb-3">Optical Metrics</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground mb-1">Total Loss</div>
                        <div className="font-medium">{metric.totalLossDb.toFixed(2)} dB</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground mb-1">Avg Loss/km</div>
                        <div className="font-medium">
                          {metric.averageLossPerKmDb.toFixed(2)} dB/km
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground mb-1">Max Loss/km</div>
                        <div className="font-medium">{metric.maxLossPerKmDb.toFixed(2)} dB/km</div>
                      </div>
                      {metric.reflectanceDb && (
                        <div>
                          <div className="text-muted-foreground mb-1">Reflectance</div>
                          <div className="font-medium">{metric.reflectanceDb.toFixed(2)} dB</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Strand Status */}
                  <div>
                    <h3 className="text-sm font-medium mb-3">Strand Status</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground mb-1">Active Strands</div>
                        <div className="font-medium text-green-600">{metric.activeStrands}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground mb-1">Degraded Strands</div>
                        <div className="font-medium text-amber-600">{metric.degradedStrands}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground mb-1">Failed Strands</div>
                        <div className="font-medium text-red-600">{metric.failedStrands}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground mb-1">Total Strands</div>
                        <div className="font-medium">{metric.totalStrands}</div>
                      </div>
                    </div>
                  </div>

                  {/* Issues */}
                  {(metric.activeAlarms > 0 ||
                    metric.warningCount > 0 ||
                    metric.requiresMaintenance) && (
                    <div className="p-4 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                        <div className="flex-1 space-y-2">
                          <div className="font-medium">Issues Detected</div>
                          <div className="text-sm space-y-1">
                            {metric.activeAlarms > 0 && (
                              <div>Active Alarms: {metric.activeAlarms}</div>
                            )}
                            {metric.warningCount > 0 && <div>Warnings: {metric.warningCount}</div>}
                            {metric.requiresMaintenance && (
                              <div className="text-amber-600 font-medium">Maintenance Required</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Fiber Strands Tab */}
        <TabsContent value="strands" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Fiber Strands ({cable.totalStrands})</CardTitle>
              <CardDescription>Individual fiber strand allocation and status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Strand #</TableHead>
                      <TableHead>Color Code</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Service ID</TableHead>
                      <TableHead className="text-right">Attenuation</TableHead>
                      <TableHead className="text-right">Loss</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cable.strands.map((strand) => (
                      <TableRow key={strand.strandId}>
                        <TableCell className="font-medium">{strand.strandId}</TableCell>
                        <TableCell>
                          {strand.colorCode && <Badge variant="outline">{strand.colorCode}</Badge>}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {strand.isActive && (
                              <Badge variant="default" className="text-xs">
                                Active
                              </Badge>
                            )}
                            {strand.isAvailable && (
                              <Badge variant="secondary" className="text-xs">
                                Available
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{strand.customerName || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {strand.serviceId || "—"}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {strand.attenuationDb ? `${strand.attenuationDb.toFixed(2)} dB` : "—"}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {strand.lossDb ? `${strand.lossDb.toFixed(2)} dB` : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Splice Points Tab */}
        <TabsContent value="splices" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Splice Points ({splicePoints.length})</CardTitle>
              <CardDescription>
                Splice closures and connection points along the cable
              </CardDescription>
            </CardHeader>
            <CardContent>
              {splicePoints.length === 0 ? (
                <div className="text-center py-12">
                  <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Splice Points</h3>
                  <p className="text-sm text-muted-foreground">
                    This cable has no recorded splice points.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {splicePoints.map((splice) => (
                    <div key={splice.id} className="p-4 rounded-lg border">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="font-medium">{splice.name}</div>
                          <div className="text-xs text-muted-foreground">ID: {splice.spliceId}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={splice.status === "ACTIVE" ? "default" : "secondary"}>
                            {formatFiberType(splice.status)}
                          </Badge>
                          <Link href={`/dashboard/network/fiber/splices/${splice.id}`}>
                            <Button variant="ghost" size="sm">
                              View
                            </Button>
                          </Link>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground mb-1">Total Splices</div>
                          <div className="font-medium">{splice.totalSplices}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground mb-1">Active</div>
                          <div className="font-medium text-green-600">{splice.activeSplices}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground mb-1">Avg Loss</div>
                          <div className="font-medium">
                            {splice.averageSpliceLossDb
                              ? `${splice.averageSpliceLossDb.toFixed(2)} dB`
                              : "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground mb-1">Cables Connected</div>
                          <div className="font-medium">{splice.totalSplices}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Route Details Tab */}
        <TabsContent value="route" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Cable Route</CardTitle>
              <CardDescription>Geographic path and waypoints</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground mb-1">Total Distance</div>
                  <div className="font-medium">{cable.route.totalDistanceMeters.toFixed(0)} m</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Intermediate Points</div>
                  <div className="font-medium">{cable.route.intermediatePoints.length}</div>
                </div>
                {cable.route.elevationChangeMeters && (
                  <div>
                    <div className="text-muted-foreground mb-1">Elevation Change</div>
                    <div className="font-medium">
                      {cable.route.elevationChangeMeters.toFixed(1)} m
                    </div>
                  </div>
                )}
                {cable.route.undergroundDistanceMeters && (
                  <div>
                    <div className="text-muted-foreground mb-1">Underground</div>
                    <div className="font-medium">
                      {cable.route.undergroundDistanceMeters.toFixed(0)} m
                    </div>
                  </div>
                )}
              </div>

              {/* Fiber Cable Map */}
              <div className="h-96 rounded-lg border bg-muted flex items-center justify-center">
                <div className="text-center space-y-2">
                  <MapPin className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Interactive fiber map visualization
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Visit the{" "}
                    <a href="/dashboard/network/fiber/map" className="text-primary hover:underline">
                      Fiber Map page
                    </a>{" "}
                    for full network visualization
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
}
