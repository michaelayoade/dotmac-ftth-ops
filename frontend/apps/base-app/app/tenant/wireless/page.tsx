"use client";

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

import { useState, useMemo, useCallback } from "react";
import {
  Wifi,
  WifiOff,
  Radio,
  Users,
  Activity,
  TrendingUp,
  Filter,
  RefreshCw,
  Plus,
  Settings,
  Signal,
  Layers,
  Eye,
  EyeOff,
  MapPin,
  Search,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UniversalMap } from "@dotmac/primitives";

// Define Map types locally
interface MapMarker {
  id: string;
  position: { lat: number; lng: number };
  title?: string;
  type?: string;
}

interface MapPath {
  id: string;
  path: Array<{ lat: number; lng: number }>;
  strokeColor?: string;
  strokeWeight?: number;
}

interface MapPolygon {
  id: string;
  paths: Array<{ lat: number; lng: number }>;
  fillColor?: string;
  strokeColor?: string;
}
import {
  useAccessPoints,
  useWirelessClients,
  useCoverageZones,
  useRFAnalytics,
  useWirelessInfrastructureStats,
  useWirelessMapView,
} from "@/hooks/useWireless";
import type {
  AccessPoint,
  WirelessClient,
  CoverageZone,
  AccessPointStatus,
} from "@/types/wireless";

// Helper functions for badges and formatting
const getStatusBadge = (status: AccessPointStatus) => {
  switch (status) {
    case "online":
      return (
        <Badge className="bg-green-500">
          <Signal className="w-3 h-3 mr-1" />
          Online
        </Badge>
      );
    case "offline":
      return (
        <Badge variant="destructive">
          <WifiOff className="w-3 h-3 mr-1" />
          Offline
        </Badge>
      );
    case "degraded":
      return (
        <Badge variant="secondary">
          <Activity className="w-3 h-3 mr-1" />
          Degraded
        </Badge>
      );
    case "maintenance":
      return (
        <Badge variant="outline">
          <Settings className="w-3 h-3 mr-1" />
          Maintenance
        </Badge>
      );
    default:
      return (
        <Badge variant="outline">
          <WifiOff className="w-3 h-3 mr-1" />
          Unknown
        </Badge>
      );
  }
};

const getCoverageColor = (level: string) => {
  switch (level) {
    case "excellent":
      return "#10b981"; // green-500
    case "good":
      return "#3b82f6"; // blue-500
    case "fair":
      return "#f59e0b"; // amber-500
    case "poor":
      return "#ef4444"; // red-500
    default:
      return "#6b7280"; // gray-500
  }
};

const getSignalQualityBadge = (rssi: number) => {
  if (rssi >= -50) {
    return <Badge className="bg-green-500">Excellent</Badge>;
  } else if (rssi >= -60) {
    return <Badge className="bg-blue-500">Good</Badge>;
  } else if (rssi >= -70) {
    return <Badge className="bg-amber-500">Fair</Badge>;
  } else {
    return <Badge variant="destructive">Poor</Badge>;
  }
};

const formatBandwidth = (mbps: number) => {
  if (mbps >= 1000) {
    return `${(mbps / 1000).toFixed(2)} Gbps`;
  }
  return `${mbps.toFixed(2)} Mbps`;
};

export default function WirelessInfrastructurePage() {
  // Data hooks
  const { accessPoints, isLoading: loadingAPs, refetch: refetchAPs } = useAccessPoints({});
  const { clients, isLoading: loadingClients, refetch: refetchClients } = useWirelessClients({});
  const { coverageZones, isLoading: loadingZones, refetch: refetchZones } = useCoverageZones({});
  const { stats, isLoading: loadingStats, refetch: refetchStats } = useWirelessInfrastructureStats();
  const { viewState, toggleLayer, selectFeature, clearSelection } = useWirelessMapView();

  // Local state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedAP, setSelectedAP] = useState<AccessPoint | null>(null);

  // Refresh all data
  const handleRefreshAll = useCallback(() => {
    refetchAPs();
    refetchClients();
    refetchZones();
    refetchStats();
  }, [refetchAPs, refetchClients, refetchZones, refetchStats]);

  // Filter access points
  const filteredAPs = useMemo(() => {
    return accessPoints.filter((ap) => {
      const matchesSearch =
        searchQuery === "" ||
        ap.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ap.site_name?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === "all" || ap.status === statusFilter;
      const matchesType = typeFilter === "all" || ap.type === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [accessPoints, searchQuery, statusFilter, typeFilter]);

  // Convert access points to map markers
  const apMarkers: MapMarker[] = useMemo(() => {
    if (!viewState.layers.find((l) => l.id === "access_points")?.visible) {
      return [];
    }

    return filteredAPs.map((ap) => ({
      id: ap.id,
      position: ap.coordinates,
      type: "network",
      status: ap.status === "online" ? "active" : ap.status === "offline" ? "error" : "warning",
      title: ap.name,
      subtitle: `${ap.connected_clients}/${ap.max_clients} clients`,
      onClick: () => {
        setSelectedAP(ap);
        selectFeature("access_point", ap.id);
      },
    }));
  }, [filteredAPs, viewState.layers, selectFeature]);

  // Convert coverage zones to map polygons
  const coveragePolygons: MapPolygon[] = useMemo(() => {
    if (!viewState.layers.find((l) => l.id === "coverage_zones")?.visible) {
      return [];
    }

    return coverageZones.map((zone) => ({
      id: zone.id,
      path: zone.boundary.coordinates,
      fillColor: getCoverageColor(zone.coverage_level),
      fillOpacity: 0.3,
      strokeColor: getCoverageColor(zone.coverage_level),
      strokeOpacity: 0.8,
      strokeWidth: 2,
      onClick: () => {
        selectFeature("coverage_zone", zone.id);
      },
    })) as unknown as MapPolygon[];
  }, [coverageZones, viewState.layers, selectFeature]);

  // Convert clients to map markers (if visible)
  const clientMarkers: MapMarker[] = useMemo(() => {
    if (!viewState.layers.find((l) => l.id === "clients")?.visible) {
      return [];
    }

    return clients.slice(0, 100).map((client) => {
      const ap = accessPoints.find((a) => a.id === client.access_point_id);
      if (!ap) return null;

      return {
        id: client.id,
        position: ap.coordinates,
        type: "person",
        status: client.signal_quality_percent > 70 ? "active" : "warning",
        title: client.hostname || client.mac_address,
        subtitle: `RSSI: ${client.rssi_dbm} dBm`,
      };
    }).filter(Boolean) as MapMarker[];
  }, [clients, accessPoints, viewState.layers]);

  // Combine all markers
  const allMarkers = useMemo(() => {
    return [...apMarkers, ...clientMarkers];
  }, [apMarkers, clientMarkers]);

  const isLoading = loadingAPs || loadingClients || loadingZones || loadingStats;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Radio className="w-8 h-8" />
            Wireless Infrastructure
          </h1>
          <p className="text-gray-600 mt-1">
            Monitor and manage wireless access points, coverage, and client connections
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleRefreshAll} variant="outline" disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Access Point
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Access Points */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Access Points</CardTitle>
            <Wifi className="w-4 h-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_access_points || 0}</div>
            <div className="text-xs text-gray-600 mt-1 space-x-2">
              <span className="text-green-600">{stats?.online_aps || 0} online</span>
              <span className="text-red-600">{stats?.offline_aps || 0} offline</span>
            </div>
          </CardContent>
        </Card>

        {/* Connected Clients */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Connected Clients</CardTitle>
            <Users className="w-4 h-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_connected_clients || 0}</div>
            <div className="text-xs text-gray-600 mt-1">
              Across {stats?.active_ssids || 0} SSIDs
            </div>
          </CardContent>
        </Card>

        {/* Bandwidth Capacity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Capacity</CardTitle>
            <TrendingUp className="w-4 h-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatBandwidth(stats?.total_bandwidth_capacity_mbps || 0)}
            </div>
            <div className="text-xs text-gray-600 mt-1">
              {stats?.bandwidth_utilization_percent?.toFixed(1)}% utilized
            </div>
          </CardContent>
        </Card>

        {/* Coverage Area */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Coverage Area</CardTitle>
            <MapPin className="w-4 h-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.coverage_area_square_km?.toFixed(2) || 0} km²
            </div>
            <div className="text-xs text-gray-600 mt-1">
              {stats?.coverage_percentage?.toFixed(1)}% covered
            </div>
          </CardContent>
        </Card>

        {/* Signal Quality */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Signal</CardTitle>
            <Signal className="w-4 h-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.avg_signal_strength_dbm?.toFixed(0) || 0} dBm
            </div>
            <div className="text-xs text-gray-600 mt-1">
              Interference: {stats?.avg_interference_level?.toFixed(0) || 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar - Layer Controls & Filters */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5" />
              Map Layers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Layer Toggles */}
            <div className="space-y-2">
              {viewState.layers.map((layer) => (
                <div
                  key={layer.id}
                  className="flex items-center justify-between p-2 rounded hover:bg-gray-50 cursor-pointer"
                  onClick={() => toggleLayer(layer.id)}
                >
                  <div className="flex items-center gap-2">
                    {layer.visible ? (
                      <Eye className="w-4 h-4 text-blue-500" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="text-sm font-medium">{layer.name}</span>
                  </div>
                  {layer.color && (
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: layer.color, opacity: layer.opacity }}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="border-t pt-4 space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Filters
                </label>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search APs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>

                {/* Status Filter */}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                    <SelectItem value="degraded">Degraded</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>

                {/* Type Filter */}
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="indoor">Indoor</SelectItem>
                    <SelectItem value="outdoor">Outdoor</SelectItem>
                    <SelectItem value="mesh">Mesh</SelectItem>
                    <SelectItem value="sector">Sector</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Legend */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-2">Coverage Legend</h4>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: "#10b981" }} />
                  <span>Excellent</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: "#3b82f6" }} />
                  <span>Good</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: "#f59e0b" }} />
                  <span>Fair</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: "#ef4444" }} />
                  <span>Poor</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Map */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Network Coverage Map</CardTitle>
            <CardDescription>
              Interactive visualization of wireless infrastructure and coverage
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[600px] rounded-lg overflow-hidden border">
              <UniversalMap
                {...{
                  center: viewState.center,
                  zoom: viewState.zoom,
                  markers: allMarkers as any,
                  polygons: coveragePolygons,
                  onMarkerClick: (marker: any) => {
                    const ap = accessPoints.find((a) => a.id === marker.id);
                    if (ap) setSelectedAP(ap);
                  },
                } as any}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Details Tabs */}
      <Card>
        <Tabs defaultValue="overview" className="w-full">
          <CardHeader>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="access-points">Access Points ({filteredAPs.length})</TabsTrigger>
              <TabsTrigger value="clients">Clients ({clients.length})</TabsTrigger>
              <TabsTrigger value="coverage">Coverage ({coverageZones.length})</TabsTrigger>
            </TabsList>
          </CardHeader>

          <CardContent>
            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">APs by Type</h4>
                  <div className="space-y-1 text-sm">
                    {stats?.aps_by_type &&
                      Object.entries(stats.aps_by_type).map(([type, count]) => (
                        <div key={type} className="flex justify-between">
                          <span className="capitalize">{type.replace("_", " ")}</span>
                          <span className="font-medium">{count}</span>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Frequency Bands</h4>
                  <div className="space-y-1 text-sm">
                    {stats?.aps_by_band &&
                      Object.entries(stats.aps_by_band).map(([band, count]) => (
                        <div key={band} className="flex justify-between">
                          <span className="uppercase">{band}</span>
                          <span className="font-medium">{count}</span>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Health Summary</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Online</span>
                      <span className="text-green-600 font-medium">{stats?.online_aps || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Offline</span>
                      <span className="text-red-600 font-medium">{stats?.offline_aps || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Degraded</span>
                      <span className="text-amber-600 font-medium">{stats?.degraded_aps || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Access Points Tab */}
            <TabsContent value="access-points">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Clients</TableHead>
                    <TableHead>Band</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Signal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAPs.map((ap) => (
                    <TableRow
                      key={ap.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => setSelectedAP(ap)}
                    >
                      <TableCell className="font-medium">{ap.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{ap.type.toUpperCase()}</Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(ap.status)}</TableCell>
                      <TableCell>
                        {ap.connected_clients}/{ap.max_clients}
                      </TableCell>
                      <TableCell className="uppercase">{ap.frequency_band}</TableCell>
                      <TableCell>{ap.channel}</TableCell>
                      <TableCell>{ap.tx_power_dbm} dBm</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            {/* Clients Tab */}
            <TabsContent value="clients">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hostname/MAC</TableHead>
                    <TableHead>Access Point</TableHead>
                    <TableHead>SSID</TableHead>
                    <TableHead>RSSI</TableHead>
                    <TableHead>Signal Quality</TableHead>
                    <TableHead>Connected</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.slice(0, 50).map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">
                        {client.hostname || client.mac_address}
                      </TableCell>
                      <TableCell>{client.access_point_name}</TableCell>
                      <TableCell>{client.ssid_name}</TableCell>
                      <TableCell>{client.rssi_dbm} dBm</TableCell>
                      <TableCell>{getSignalQualityBadge(client.rssi_dbm)}</TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {new Date(client.connected_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            {/* Coverage Tab */}
            <TabsContent value="coverage">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zone Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Coverage Level</TableHead>
                    <TableHead>Signal Range</TableHead>
                    <TableHead>Access Points</TableHead>
                    <TableHead>Clients</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coverageZones.map((zone) => (
                    <TableRow key={zone.id}>
                      <TableCell className="font-medium">{zone.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{zone.type.toUpperCase()}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          style={{
                            backgroundColor: getCoverageColor(zone.coverage_level),
                            color: "white",
                          }}
                        >
                          {zone.coverage_level}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {zone.min_signal_dbm} to {zone.max_signal_dbm} dBm
                      </TableCell>
                      <TableCell>{zone.access_points.length}</TableCell>
                      <TableCell>{zone.active_clients || 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}
