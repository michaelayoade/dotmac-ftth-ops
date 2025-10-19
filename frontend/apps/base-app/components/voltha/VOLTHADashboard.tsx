"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Server,
  Radio,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Activity,
  Zap,
  Search,
  Plus,
  RefreshCw,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@/components/ui/use-toast";
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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Device,
  DeviceListResponse,
  LogicalDevice,
  LogicalDeviceListResponse,
  OLTOverview,
  VOLTHAAlarm,
  VOLTHAHealthResponse,
  DeviceOperStatus,
  DeviceAdminState,
} from "@/types/voltha";

export function VOLTHADashboard() {
  const { toast } = useToast();

  const [health, setHealth] = useState<VOLTHAHealthResponse | null>(null);
  const [olts, setOLTs] = useState<LogicalDevice[]>([]);
  const [onus, setONUs] = useState<Device[]>([]);
  const [selectedOLT, setSelectedOLT] = useState<string | null>(null);
  const [oltOverview, setOLTOverview] = useState<OLTOverview | null>(null);
  const [alarms, setAlarms] = useState<VOLTHAAlarm[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [healthRes, oltsRes, onusRes, alarmsRes] = await Promise.all([
        apiClient.get<VOLTHAHealthResponse>("/api/v1/voltha/health"),
        apiClient.get<LogicalDeviceListResponse>("/api/v1/voltha/logical-devices"),
        apiClient.get<DeviceListResponse>("/api/v1/voltha/devices"),
        apiClient.get<{ alarms: VOLTHAAlarm[] }>("/api/v1/voltha/alarms"),
      ]);

      setHealth(healthRes.data);
      setOLTs(oltsRes.data.logical_devices);
      setONUs(onusRes.data.devices.filter(d => !d.root));
      setAlarms(alarmsRes.data.alarms || []);

      if (oltsRes.data.logical_devices.length > 0 && !selectedOLT) {
        setSelectedOLT(oltsRes.data.logical_devices[0].id);
      }
    } catch (err: any) {
      toast({
        title: "Failed to load VOLTHA data",
        description: err?.response?.data?.detail || "Could not connect to VOLTHA",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [selectedOLT, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (selectedOLT) {
      loadOLTOverview(selectedOLT);
    }
  }, [selectedOLT]);

  const loadOLTOverview = async (oltId: string) => {
    try {
      const response = await apiClient.get<OLTOverview>(`/api/v1/voltha/olts/${oltId}/overview`);
      setOLTOverview(response.data);
    } catch (err) {
      console.error("Failed to load OLT overview", err);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
    toast({
      title: "Data refreshed",
      description: "VOLTHA data has been updated",
    });
  };

  const handleDeviceOperation = async (deviceId: string, operation: "enable" | "disable" | "reboot" | "delete") => {
    try {
      await apiClient.post(`/api/v1/voltha/devices/${deviceId}/${operation}`);
      toast({
        title: "Operation successful",
        description: `Device ${operation} completed`,
      });
      loadData();
    } catch (err: any) {
      toast({
        title: "Operation failed",
        description: err?.response?.data?.detail || `Could not ${operation} device`,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusLower = status?.toLowerCase() || "";
    if (statusLower.includes("active") || statusLower.includes("enabled") || statusLower.includes("reachable")) {
      return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Active</Badge>;
    } else if (statusLower.includes("activating") || statusLower.includes("discovering")) {
      return <Badge variant="secondary"><Activity className="w-3 h-3 mr-1 animate-spin" />Activating</Badge>;
    } else if (statusLower.includes("failed") || statusLower.includes("unreachable")) {
      return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
    } else {
      return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSignalQuality = (rxPower?: number) => {
    if (!rxPower) return null;
    if (rxPower > -20) return { label: "Excellent", color: "text-green-600", icon: TrendingUp };
    if (rxPower > -25) return { label: "Good", color: "text-blue-600", icon: TrendingUp };
    if (rxPower > -28) return { label: "Fair", color: "text-yellow-600", icon: Activity };
    return { label: "Poor", color: "text-red-600", icon: TrendingDown };
  };

  const filteredONUs = onus.filter(onu =>
    searchQuery === "" ||
    onu.serial_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    onu.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const onlineONUs = onus.filter(onu => onu.oper_status === "ACTIVE" || onu.connect_status === "REACHABLE");
  const criticalAlarms = alarms.filter(a => a.severity === "CRITICAL" && a.state === "RAISED");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading VOLTHA data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">VOLTHA PON Management</h2>
          <p className="text-sm text-muted-foreground">
            OLT/ONU monitoring and provisioning
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* System Health & Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              VOLTHA Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {health?.healthy ? (
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              ) : (
                <XCircle className="w-6 h-6 text-red-500" />
              )}
              <div>
                <div className="text-2xl font-bold">{health?.state}</div>
                <p className="text-xs text-muted-foreground">{health?.message}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              OLTs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{olts.length}</div>
            <p className="text-xs text-muted-foreground">
              {olts.filter(o => o.root_device_id).length} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              ONUs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{onus.length}</div>
            <p className="text-xs text-muted-foreground">
              {onlineONUs.length} online ({((onlineONUs.length / onus.length) * 100).toFixed(0)}%)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Critical Alarms
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{criticalAlarms.length}</div>
            <p className="text-xs text-muted-foreground">
              {alarms.length} total alarms
            </p>
          </CardContent>
        </Card>
      </div>

      {/* OLT Selection & Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>OLT Overview</CardTitle>
              <CardDescription>Select an OLT to view details</CardDescription>
            </div>
            <Select value={selectedOLT || ""} onValueChange={setSelectedOLT}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select OLT" />
              </SelectTrigger>
              <SelectContent>
                {olts.map(olt => (
                  <SelectItem key={olt.id} value={olt.id}>
                    {olt.id} ({olt.desc?.serial_num || "N/A"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        {oltOverview && (
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3 mb-4">
              <div>
                <div className="text-sm text-muted-foreground">Model</div>
                <div className="font-medium">{oltOverview.model}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Firmware</div>
                <div className="font-medium">{oltOverview.firmware_version}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Status</div>
                {getStatusBadge(oltOverview.oper_status)}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">PON Ports ({oltOverview.pon_ports.length})</h4>
              {oltOverview.pon_ports.map(port => (
                <div key={port.port_no} className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-card/40">
                  <div className="flex items-center gap-3">
                    <Radio className="w-5 h-5" />
                    <div>
                      <div className="font-medium">{port.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {port.online_onus}/{port.total_onus} ONUs online
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {port.utilization_percent !== undefined && (
                      <div className="w-32">
                        <div className="text-xs text-muted-foreground mb-1">
                          Utilization: {port.utilization_percent.toFixed(0)}%
                        </div>
                        <Progress value={port.utilization_percent} className="h-2" />
                      </div>
                    )}
                    {getStatusBadge(port.oper_status)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* ONUs List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>ONUs ({filteredONUs.length})</CardTitle>
              <CardDescription>Manage optical network units</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search ONUs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-64"
                />
              </div>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Provision ONU
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredONUs.slice(0, 20).map(onu => (
              <div key={onu.id} className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-card/40 hover:bg-card/60 transition-colors">
                <div className="flex items-center gap-3">
                  <Server className="w-5 h-5" />
                  <div>
                    <div className="font-medium">{onu.serial_number || onu.id}</div>
                    <div className="text-xs text-muted-foreground">
                      {onu.vendor} {onu.model} • FW: {onu.firmware_version}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusBadge(onu.oper_status || "UNKNOWN")}
                  <Button variant="ghost" size="sm">Details</Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Active Alarms */}
      {criticalAlarms.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              Critical Alarms ({criticalAlarms.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {criticalAlarms.slice(0, 5).map(alarm => (
                <div key={alarm.id} className="flex items-center justify-between p-3 rounded-lg border border-red-200 bg-red-50">
                  <div>
                    <div className="font-medium">{alarm.type}</div>
                    <div className="text-xs text-muted-foreground">
                      Device: {alarm.device_id} • {alarm.description}
                    </div>
                  </div>
                  <Badge variant="destructive">{alarm.severity}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
