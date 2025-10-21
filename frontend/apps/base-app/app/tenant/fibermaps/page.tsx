"use client";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

import { useState, useMemo } from "react";
import {
  Map,
  Cable,
  Layers,
  TrendingUp,
  Plus,
  Search,
  Filter,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Navigation,
  Grid3x3,
} from "lucide-react";
import {
  useFiberCables,
  useSplicePoints,
  useDistributionPoints,
  useServiceAreas,
  useFiberInfrastructureStats,
  useMapView,
} from "@/hooks/useFiberMaps";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UniversalMap } from "@dotmac/primitives";

// Define MapMarker type locally
interface MapMarker {
  id: string;
  position: { lat: number; lng: number };
  title?: string;
  type?: string;
  status?: string;
  subtitle?: string;
  metadata?: {
    type?: string;
    data?: any;
  };
}

export default function FiberMapsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState("overview");

  // Data hooks
  const { cables, isLoading: cablesLoading, refetch: refetchCables } = useFiberCables({});
  const { splicePoints, isLoading: splicesLoading } = useSplicePoints({});
  const { distributionPoints, isLoading: dpLoading } = useDistributionPoints({});
  const { serviceAreas, isLoading: areasLoading } = useServiceAreas({});
  const { stats, isLoading: statsLoading } = useFiberInfrastructureStats();
  const { viewState, updateCenter, updateZoom, toggleLayer, selectFeature, clearSelection } =
    useMapView();

  const isLoading = cablesLoading || splicesLoading || dpLoading || areasLoading;

  // Convert infrastructure data to map markers
  const mapMarkers: MapMarker[] = useMemo(() => {
    const markers: MapMarker[] = [];

    // Add splice points
    if (viewState.layers.find((l) => l.id === "splice_points")?.visible) {
      splicePoints.forEach((sp) => {
        markers.push({
          id: sp.id,
          position: sp.coordinates,
          type: "fiber",
          status:
            sp.status === "operational"
              ? "active"
              : sp.status === "fault"
                ? "error"
                : "maintenance",
          title: sp.name,
          subtitle: `${sp.type} - ${sp.splice_count}/${sp.capacity} splices`,
          metadata: {
            type: "splice_point",
            data: sp,
          },
        });
      });
    }

    // Add distribution points
    if (viewState.layers.find((l) => l.id === "distribution_points")?.visible) {
      distributionPoints.forEach((dp) => {
        markers.push({
          id: dp.id,
          position: dp.coordinates,
          type: "tower",
          status: dp.status,
          title: dp.name,
          subtitle: `${dp.type.toUpperCase()} - ${dp.ports_used}/${dp.capacity} ports`,
          metadata: {
            type: "distribution_point",
            data: dp,
          },
        });
      });
    }

    return markers;
  }, [splicePoints, distributionPoints, viewState.layers]);

  // Convert cables to map paths
  const mapPaths = useMemo(() => {
    if (!viewState.layers.find((l) => l.id === "cables")?.visible) return [];

    return cables.map((cable) => ({
      id: cable.id,
      coordinates: cable.path.coordinates,
      color:
        cable.status === "active"
          ? "#3b82f6"
          : cable.status === "planned"
            ? "#f59e0b"
            : cable.status === "damaged"
              ? "#ef4444"
              : "#6b7280",
      width: 3,
      label: cable.cable_name,
      metadata: {
        type: "cable",
        data: cable,
      },
    }));
  }, [cables, viewState.layers]);

  // Convert service areas to map polygons
  const mapPolygons = useMemo(() => {
    if (!viewState.layers.find((l) => l.id === "service_areas")?.visible) return [];

    return serviceAreas.map((area) => ({
      id: area.id,
      coordinates: area.boundary.coordinates,
      color:
        area.coverage_status === "covered"
          ? "#10b981"
          : area.coverage_status === "partial"
            ? "#f59e0b"
            : area.coverage_status === "planned"
              ? "#3b82f6"
              : "#6b7280",
      opacity: 0.2,
      label: area.name,
      metadata: {
        type: "service_area",
        data: area,
      },
    }));
  }, [serviceAreas, viewState.layers]);

  const handleMarkerClick = (marker: MapMarker) => {
    const { type, data } = marker.metadata || {};
    if (type && data) {
      selectFeature(
        type as "cable" | "splice_point" | "distribution_point" | "service_area",
        data.id,
      );
    }
  };

  const handleRefresh = async () => {
    await refetchCables();
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Map className="w-8 h-8 text-blue-600" />
            Fiber Infrastructure Maps
          </h1>
          <p className="text-muted-foreground mt-1">
            Interactive visualization and management of fiber network assets
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Cable
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Fiber</CardDescription>
              <CardTitle className="text-3xl">{stats.total_fiber_km.toFixed(1)} km</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                {stats.active_fiber_km.toFixed(1)} km active
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Splice Points</CardDescription>
              <CardTitle className="text-3xl">{stats.total_splice_points}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">Network connection points</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Distribution Points</CardDescription>
              <CardTitle className="text-3xl">{stats.total_distribution_points}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">FDT/FDH hubs</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Coverage</CardDescription>
              <CardTitle className="text-3xl text-green-600">
                {stats.coverage_percentage.toFixed(1)}%
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                {stats.total_service_areas} service areas
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Utilization</CardDescription>
              <CardTitle className="text-3xl text-blue-600">
                {stats.fiber_utilization_percentage.toFixed(1)}%
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">Fiber capacity used</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-12 gap-6">
        {/* Sidebar - Layers & Filters */}
        <div className="col-span-3 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="w-4 h-4" />
                Map Layers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {viewState.layers.map((layer) => (
                <div key={layer.id} className="flex items-center justify-between">
                  <Label
                    htmlFor={layer.id}
                    className="text-sm cursor-pointer flex items-center gap-2"
                  >
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: layer.color }} />
                    {layer.name}
                  </Label>
                  <Switch
                    id={layer.id}
                    checked={layer.visible}
                    onCheckedChange={() => toggleLayer(layer.id)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="cable-status">Cable Status</Label>
                <Select>
                  <SelectTrigger id="cable-status">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="planned">Planned</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="damaged">Damaged</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cable-type">Cable Type</Label>
                <Select>
                  <SelectTrigger id="cable-type">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="single_mode">Single Mode</SelectItem>
                    <SelectItem value="multi_mode">Multi Mode</SelectItem>
                    <SelectItem value="aerial">Aerial</SelectItem>
                    <SelectItem value="underground">Underground</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search assets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Legend</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-4 h-0.5 bg-blue-500" />
                <span>Active Cable</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-4 h-0.5 bg-orange-500" />
                <span>Planned Cable</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-4 h-0.5 bg-red-500" />
                <span>Damaged Cable</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Cable className="w-4 h-4 text-orange-500" />
                <span>Splice Point</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Grid3x3 className="w-4 h-4 text-green-500" />
                <span>Distribution Point</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-4 h-4 bg-green-500/20 border border-green-500 rounded" />
                <span>Covered Area</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Map View */}
        <div className="col-span-9 space-y-4">
          <Card className="overflow-hidden">
            <div className="relative" style={{ height: "600px" }}>
              <UniversalMap
                {...({
                  markers: mapMarkers as any,
                  paths: mapPaths,
                  polygons: mapPolygons,
                  center: viewState.center,
                  zoom: viewState.zoom,
                  onMarkerClick: handleMarkerClick,
                  onCenterChange: updateCenter,
                  onZoomChange: updateZoom,
                  mapType: "network_topology",
                } as any)}
              />

              {/* Map Controls Overlay */}
              <div className="absolute top-4 right-4 flex flex-col gap-2">
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={() => updateZoom(viewState.zoom + 1)}
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={() => updateZoom(viewState.zoom - 1)}
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="secondary">
                  <Navigation className="w-4 h-4" />
                </Button>
              </div>

              {/* Loading Overlay */}
              {isLoading && (
                <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
                  <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          </Card>

          {/* Details Tabs */}
          <Card>
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
              <CardHeader>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="cables">Cables ({cables.length})</TabsTrigger>
                  <TabsTrigger value="splices">Splice Points ({splicePoints.length})</TabsTrigger>
                  <TabsTrigger value="coverage">Coverage ({serviceAreas.length})</TabsTrigger>
                </TabsList>
              </CardHeader>
              <CardContent>
                <TabsContent value="overview" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-semibold mb-2">Cable Types</h3>
                      <div className="space-y-1">
                        {stats &&
                          Object.entries(stats.cables_by_type).map(([type, count]) => (
                            <div key={type} className="flex justify-between text-sm">
                              <span className="capitalize">{type.replace("_", " ")}</span>
                              <Badge variant="secondary">{count}</Badge>
                            </div>
                          ))}
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">Cable Status</h3>
                      <div className="space-y-1">
                        {stats &&
                          Object.entries(stats.cables_by_status).map(([status, count]) => (
                            <div key={status} className="flex justify-between text-sm">
                              <span className="capitalize">{status.replace("_", " ")}</span>
                              <Badge variant="secondary">{count}</Badge>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="cables" className="space-y-2">
                  {cables.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Cable className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No fiber cables found</p>
                      <Button className="mt-4" size="sm">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Your First Cable
                      </Button>
                    </div>
                  ) : (
                    cables.slice(0, 10).map((cable) => (
                      <div
                        key={cable.id}
                        className="border rounded-lg p-3 hover:bg-accent cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{cable.cable_name}</h4>
                            <p className="text-xs text-muted-foreground">
                              {cable.fiber_count} fibers • {cable.length_meters.toFixed(0)}m •{" "}
                              {cable.cable_type}
                            </p>
                          </div>
                          <Badge variant={cable.status === "active" ? "default" : "secondary"}>
                            {cable.status}
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="splices" className="space-y-2">
                  {splicePoints.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Cable className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No splice points found</p>
                    </div>
                  ) : (
                    splicePoints.slice(0, 10).map((sp) => (
                      <div
                        key={sp.id}
                        className="border rounded-lg p-3 hover:bg-accent cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{sp.name}</h4>
                            <p className="text-xs text-muted-foreground">
                              {sp.type} • {sp.splice_count}/{sp.capacity} splices
                            </p>
                          </div>
                          <Badge variant={sp.status === "operational" ? "default" : "destructive"}>
                            {sp.status}
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="coverage" className="space-y-2">
                  {serviceAreas.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Map className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No service areas defined</p>
                    </div>
                  ) : (
                    serviceAreas.slice(0, 10).map((area) => (
                      <div
                        key={area.id}
                        className="border rounded-lg p-3 hover:bg-accent cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{area.name}</h4>
                            <p className="text-xs text-muted-foreground">
                              {area.type} • {area.premises_count || 0} premises •{" "}
                              {area.active_customers || 0} customers
                            </p>
                          </div>
                          <Badge
                            variant={area.coverage_status === "covered" ? "default" : "secondary"}
                          >
                            {area.coverage_status}
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
}
