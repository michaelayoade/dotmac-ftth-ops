/**
 * Customer Network Component
 *
 * Displays customer network information, statistics, and installation details.
 * Shared between ISP Ops and Platform Admin applications.
 */

import { useToast } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import {
  Wifi,
  WifiOff,
  Signal,
  Globe,
  MapPin,
  Calendar,
  Activity,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";

export interface NetworkInfo {
  connection_status: "online" | "offline" | "degraded";
  ip_address?: string;
  ipv6_address?: string;
  mac_address?: string;
  vlan_id?: number;
  service_location: {
    address_line_1: string;
    address_line_2?: string;
    city: string;
    state: string;
    postal_code: string;
  };
  installation_date?: string;
  installation_technician?: string;
  installation_status: "pending" | "scheduled" | "completed" | "failed";
  last_online?: string;
  uptime_hours?: number;
  signal_quality?: number;
  olt_info?: {
    olt_name: string;
    pon_port: string;
    ont_serial: string;
    distance_meters?: number;
  };
}

export interface NetworkStats {
  bandwidth_usage_gb: number;
  peak_download_mbps: number;
  peak_upload_mbps: number;
  avg_download_mbps: number;
  avg_upload_mbps: number;
  packet_loss_percent: number;
  latency_ms: number;
}

export interface CustomerNetworkProps {
  customerId: string;
  apiClient: {
    get: <T = any>(url: string, config?: any) => Promise<{ data: T }>;
  };
}

const getConnectionStatusBadge = (status: NetworkInfo["connection_status"]) => {
  switch (status) {
    case "online":
      return (
        <Badge className="bg-green-500">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Online
        </Badge>
      );
    case "offline":
      return (
        <Badge variant="destructive">
          <XCircle className="w-3 h-3 mr-1" />
          Offline
        </Badge>
      );
    case "degraded":
      return (
        <Badge variant="secondary">
          <AlertCircle className="w-3 h-3 mr-1" />
          Degraded
        </Badge>
      );
  }
};

const getInstallationStatusBadge = (status: NetworkInfo["installation_status"]) => {
  switch (status) {
    case "completed":
      return <Badge className="bg-green-500">Completed</Badge>;
    case "scheduled":
      return <Badge className="bg-blue-500">Scheduled</Badge>;
    case "pending":
      return <Badge variant="outline">Pending</Badge>;
    case "failed":
      return <Badge variant="destructive">Failed</Badge>;
  }
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatUptime = (hours: number) => {
  const days = Math.floor(hours / 24);
  const remainingHours = Math.floor(hours % 24);
  return `${days}d ${remainingHours}h`;
};

export function CustomerNetwork({ customerId, apiClient }: CustomerNetworkProps) {
  const { toast } = useToast();
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [networkStats, setNetworkStats] = useState<NetworkStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNetworkInfo = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<NetworkInfo>(
        `/api/isp/v1/admin/customers/${customerId}/network-info`,
      );
      setNetworkInfo(response.data);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to load network information",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [customerId, toast, apiClient]);

  const fetchNetworkStats = useCallback(async () => {
    try {
      const response = await apiClient.get<NetworkStats>(
        `/api/isp/v1/admin/customers/${customerId}/network-stats`,
      );
      setNetworkStats(response.data);
    } catch (error: any) {
      // Stats are optional, don't show error
      console.error("Failed to load network stats:", error);
    }
  }, [customerId, apiClient]);

  useEffect(() => {
    fetchNetworkInfo();
    fetchNetworkStats();
  }, [fetchNetworkInfo, fetchNetworkStats]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchNetworkInfo(), fetchNetworkStats()]);
    setRefreshing(false);
  };

  const handleViewNetworkMonitoring = () => {
    window.open("/dashboard/network", "_blank");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading network information...</div>
      </div>
    );
  }

  if (!networkInfo) {
    return (
      <div className="text-center py-12">
        <WifiOff className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-300 mb-2">No Network Information</h3>
        <p className="text-slate-500 mb-4">
          Network information is not available for this customer.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Status Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center ${
              networkInfo.connection_status === "online"
                ? "bg-green-500/20"
                : networkInfo.connection_status === "offline"
                  ? "bg-red-500/20"
                  : "bg-yellow-500/20"
            }`}
          >
            {networkInfo.connection_status === "online" ? (
              <Wifi className="w-6 h-6 text-green-400" />
            ) : (
              <WifiOff className="w-6 h-6 text-red-400" />
            )}
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white">Network Status</h3>
            <div className="flex items-center gap-2 mt-1">
              {getConnectionStatusBadge(networkInfo.connection_status)}
              {networkInfo.last_online && (
                <span className="text-sm text-slate-500">
                  Last online: {formatDate(networkInfo.last_online)}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleViewNetworkMonitoring}>
            <ExternalLink className="w-4 h-4 mr-2" />
            Network Monitor
          </Button>
        </div>
      </div>

      {/* Network Details Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">IP Address</p>
                <p className="text-lg font-semibold text-white">
                  {networkInfo.ip_address || "Not assigned"}
                </p>
                {networkInfo.ipv6_address && (
                  <p className="text-xs text-slate-500 mt-1">{networkInfo.ipv6_address}</p>
                )}
              </div>
              <Globe className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        {networkInfo.signal_quality !== undefined && (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Signal Quality</p>
                  <p className="text-lg font-semibold text-white">{networkInfo.signal_quality}%</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {networkInfo.signal_quality >= 80
                      ? "Excellent"
                      : networkInfo.signal_quality >= 60
                        ? "Good"
                        : "Poor"}
                  </p>
                </div>
                <Signal className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>
        )}

        {networkInfo.uptime_hours !== undefined && (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Uptime</p>
                  <p className="text-lg font-semibold text-white">
                    {formatUptime(networkInfo.uptime_hours)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Current session</p>
                </div>
                <Activity className="w-8 h-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>
        )}

        {networkInfo.vlan_id !== undefined && (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">VLAN ID</p>
                  <p className="text-lg font-semibold text-white">{networkInfo.vlan_id}</p>
                  <p className="text-xs text-slate-500 mt-1">Network segment</p>
                </div>
                <Globe className="w-8 h-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Network Statistics */}
      {networkStats && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Network Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-slate-400">Avg Download</span>
                </div>
                <p className="text-lg font-semibold text-white">
                  {networkStats.avg_download_mbps.toFixed(1)} Mbps
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-slate-400">Avg Upload</span>
                </div>
                <p className="text-lg font-semibold text-white">
                  {networkStats.avg_upload_mbps.toFixed(1)} Mbps
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-purple-400" />
                  <span className="text-sm text-slate-400">Peak Download</span>
                </div>
                <p className="text-lg font-semibold text-white">
                  {networkStats.peak_download_mbps.toFixed(1)} Mbps
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm text-slate-400">Data Usage</span>
                </div>
                <p className="text-lg font-semibold text-white">
                  {networkStats.bandwidth_usage_gb.toFixed(2)} GB
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-red-400" />
                  <span className="text-sm text-slate-400">Packet Loss</span>
                </div>
                <p className="text-lg font-semibold text-white">
                  {networkStats.packet_loss_percent.toFixed(2)}%
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm text-slate-400">Latency</span>
                </div>
                <p className="text-lg font-semibold text-white">{networkStats.latency_ms} ms</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Service Location & Installation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Service Location
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-slate-300">
              <p>{networkInfo.service_location.address_line_1}</p>
              {networkInfo.service_location.address_line_2 && (
                <p>{networkInfo.service_location.address_line_2}</p>
              )}
              <p>
                {networkInfo.service_location.city}, {networkInfo.service_location.state}{" "}
                {networkInfo.service_location.postal_code}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Installation Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-slate-400">Status</label>
                <div className="mt-1">
                  {getInstallationStatusBadge(networkInfo.installation_status)}
                </div>
              </div>
              {networkInfo.installation_date && (
                <div>
                  <label className="text-sm text-slate-400">Installation Date</label>
                  <p className="text-white">{formatDate(networkInfo.installation_date)}</p>
                </div>
              )}
              {networkInfo.installation_technician && (
                <div>
                  <label className="text-sm text-slate-400">Technician</label>
                  <p className="text-white">{networkInfo.installation_technician}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* OLT/PON Information */}
      {networkInfo.olt_info && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">OLT/PON Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <label className="text-sm text-slate-400">OLT Device</label>
                <p className="text-white font-medium">{networkInfo.olt_info.olt_name}</p>
              </div>
              <div>
                <label className="text-sm text-slate-400">PON Port</label>
                <p className="text-white font-medium">{networkInfo.olt_info.pon_port}</p>
              </div>
              <div>
                <label className="text-sm text-slate-400">ONT Serial</label>
                <p className="text-white font-medium font-mono">
                  {networkInfo.olt_info.ont_serial}
                </p>
              </div>
              {networkInfo.olt_info.distance_meters !== undefined && (
                <div>
                  <label className="text-sm text-slate-400">Distance</label>
                  <p className="text-white font-medium">
                    {(networkInfo.olt_info.distance_meters / 1000).toFixed(2)} km
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
