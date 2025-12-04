"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Server,
  Radio,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Activity,
  Search,
  Plus,
  RefreshCw,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { useToast } from "@dotmac/ui";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import { useVOLTHADashboard, useOLTOverview, useDeviceOperation } from "@/hooks/useVOLTHA";
import { DISPLAY_LIMITS, OPTICAL_POWER_THRESHOLDS } from "@/lib/constants/voltha";
import { useDebouncedValue } from "@/hooks/useDebounce";
import { Device } from "@/types/voltha";

export function VOLTHADashboard() {
  const { toast } = useToast();
  const [selectedOLT, setSelectedOLT] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [oltSelectOpen, setOltSelectOpen] = useState(false);

  // Use custom React Query hooks
  const { health, olts, onus, alarms, isLoading, isError, error, refetch } = useVOLTHADashboard();
  const { data: oltOverview } = useOLTOverview(selectedOLT);
  const deviceOperation = useDeviceOperation({
    onSuccess: () => {
      toast({
        title: "Operation successful",
        description: "Device operation completed",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Operation failed",
        description: error.message || "Could not perform device operation",
        variant: "destructive",
      });
    },
  });

  // Debounce search query for performance
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  // Handle errors from data fetching
  useEffect(() => {
    if (isError && error) {
      const errorMessage =
        (error as any)?.response?.data?.detail || error.message || "Could not connect to VOLTHA";

      toast({
        title: "Failed to load VOLTHA data",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [isError, error, toast]);

  // Set default OLT selection
  if (olts.length > 0 && !selectedOLT && olts[0]) {
    setSelectedOLT(olts[0].id);
  }

  const handleRefresh = () => {
    refetch();
    toast({
      title: "Data refreshed",
      description: "VOLTHA data has been updated",
    });
  };

  const handleDeviceOperation = (
    deviceId: string,
    operation: "enable" | "disable" | "reboot" | "delete",
  ) => {
    const device = onus.find((d) => d.id === deviceId);
    const oltId = device?.metadata?.["olt_id"] || device?.parent_id;
    deviceOperation.mutate({ deviceId, operation, oltId });
  };

  const getStatusBadge = (status: string) => {
    const statusLower = status?.toLowerCase() || "";
    if (
      statusLower.includes("active") ||
      statusLower.includes("enabled") ||
      statusLower.includes("reachable")
    ) {
      return (
        <Badge variant="default" className="bg-green-500">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Active
        </Badge>
      );
    } else if (statusLower.includes("activating") || statusLower.includes("discovering")) {
      return (
        <Badge variant="secondary" className="">
          <Activity className="w-3 h-3 mr-1 animate-spin" />
          Activating
        </Badge>
      );
    } else if (statusLower.includes("failed") || statusLower.includes("unreachable")) {
      return (
        <Badge variant="destructive" className="">
          <XCircle className="w-3 h-3 mr-1" />
          Failed
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="">
          {status}
        </Badge>
      );
    }
  };

  const getSignalQuality = (rxPower?: number) => {
    if (!rxPower) return null;
    if (rxPower > OPTICAL_POWER_THRESHOLDS.EXCELLENT)
      return { label: "Excellent", color: "text-green-600", icon: TrendingUp };
    if (rxPower > OPTICAL_POWER_THRESHOLDS.GOOD)
      return { label: "Good", color: "text-blue-600", icon: TrendingUp };
    if (rxPower > OPTICAL_POWER_THRESHOLDS.FAIR)
      return { label: "Fair", color: "text-yellow-600", icon: Activity };
    return { label: "Poor", color: "text-red-600", icon: TrendingDown };
  };

  // Memoize expensive calculations
  const filteredONUs = useMemo(
    () =>
      onus.filter(
        (onu) =>
          debouncedSearch === "" ||
          onu.serial_number?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          onu.id.toLowerCase().includes(debouncedSearch.toLowerCase()),
      ),
    [onus, debouncedSearch],
  );

  const onlineONUs = useMemo(
    () => onus.filter((onu) => onu.oper_status === "ACTIVE" || onu.connect_status === "REACHABLE"),
    [onus],
  );

  const criticalAlarms = useMemo(
    () => alarms.filter((a) => a.severity === "CRITICAL" && a.state === "RAISED"),
    [alarms],
  );

  if (isLoading) {
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
          <p className="text-sm text-muted-foreground">OLT/ONU monitoring and provisioning</p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={deviceOperation.isPending}
          variant="outline"
          aria-label="Refresh VOLTHA data"
        >
          <RefreshCw
            className={`w-4 h-4 mr-2 ${deviceOperation.isPending ? "animate-spin" : ""}`}
          />
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
                <CheckCircle2 className="w-6 h-6 text-green-500" aria-label="System healthy" />
              ) : (
                <XCircle className="w-6 h-6 text-red-500" aria-label="System unhealthy" />
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
            <CardTitle className="text-sm font-medium text-muted-foreground">OLTs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="olt-count">
              {olts.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {olts.filter((o) => o.root_device_id).length} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">ONUs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="onu-count">
              {onus.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {onlineONUs.length} online (
              {onus.length > 0 ? ((onlineONUs.length / onus.length) * 100).toFixed(0) : 0}%)
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
            <div className="text-3xl font-bold text-red-600" data-testid="alarm-count">
              {criticalAlarms.length}
            </div>
            <p className="text-xs text-muted-foreground">{alarms.length} total alarms</p>
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
            <Select
              value={selectedOLT || ""}
              onValueChange={setSelectedOLT}
              open={oltSelectOpen}
              onOpenChange={setOltSelectOpen}
            >
              <SelectTrigger className="w-64" aria-label="Select OLT device">
                <SelectValue placeholder="Select OLT" />
              </SelectTrigger>
              <SelectContent>
                {olts.map((olt) => (
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
              {oltOverview.pon_ports.map((port) => (
                <div
                  key={port.port_no}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-card/40"
                >
                  <div className="flex items-center gap-3">
                    <Radio className="w-5 h-5" aria-hidden="true" />
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
                        <div
                          role="progressbar"
                          aria-valuenow={port.utilization_percent}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`Port ${port.label} utilization`}
                          className="h-2 w-full bg-gray-200 rounded-full overflow-hidden"
                        >
                          <div
                            className="h-full bg-blue-500 transition-all"
                            style={{ width: `${port.utilization_percent}%` }}
                          />
                        </div>
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
                <Search
                  className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  placeholder="Search ONUs..."
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setSearchQuery(e.target.value)
                  }
                  className="pl-8 w-64"
                  aria-label="Search ONUs by serial number or ID"
                />
              </div>
              <Button size="sm" aria-label="Provision new ONU">
                <Plus className="w-4 h-4 mr-2" />
                Provision ONU
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2" role="list" aria-label="ONU devices list">
            {filteredONUs.slice(0, DISPLAY_LIMITS.ONUS_PER_PAGE).map((onu) => (
              <div
                key={onu.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-card/40 hover:bg-card/60 transition-colors"
                role="listitem"
              >
                <div className="flex items-center gap-3">
                  <Server className="w-5 h-5" aria-hidden="true" />
                  <div>
                    <div className="font-medium">{onu.serial_number || onu.id}</div>
                    <div className="text-xs text-muted-foreground">
                      {onu.vendor} {onu.model} • FW: {onu.firmware_version}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusBadge(onu.oper_status || "UNKNOWN")}
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`View details for ${onu.serial_number || onu.id}`}
                  >
                    Details
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {filteredONUs.length > DISPLAY_LIMITS.ONUS_PER_PAGE && (
            <div className="mt-4 text-center text-sm text-muted-foreground">
              Showing {DISPLAY_LIMITS.ONUS_PER_PAGE} of {filteredONUs.length} ONUs
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Alarms */}
      {criticalAlarms.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" aria-hidden="true" />
              Critical Alarms ({criticalAlarms.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2" role="list" aria-label="Critical alarms list">
              {criticalAlarms.slice(0, DISPLAY_LIMITS.CRITICAL_ALARMS).map((alarm) => (
                <div
                  key={alarm.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-red-200 bg-red-50"
                  role="listitem"
                >
                  <div>
                    <div className="font-medium">{alarm.type}</div>
                    <div className="text-xs text-muted-foreground">
                      Device: {alarm.device_id} • {alarm.description}
                    </div>
                  </div>
                  <Badge variant="destructive" className="">
                    {alarm.severity}
                  </Badge>
                </div>
              ))}
            </div>
            {criticalAlarms.length > DISPLAY_LIMITS.CRITICAL_ALARMS && (
              <div className="mt-4 text-center text-sm text-muted-foreground">
                Showing {DISPLAY_LIMITS.CRITICAL_ALARMS} of {criticalAlarms.length} critical alarms
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
