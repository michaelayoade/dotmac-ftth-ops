"use client";

import { useState, useMemo, useEffect } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  Bell,
  BellOff,
  Filter,
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  BarChart3,
} from "lucide-react";
import { useToast } from "@dotmac/ui";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { Progress } from "@dotmac/ui";
import { VOLTHAAlarm, AlarmSeverity } from "@/types/voltha";
import {
  useVOLTHAHealth,
  useVOLTHAAlarms,
  useAcknowledgeAlarm,
  useClearAlarm,
} from "@/hooks/useVOLTHA";

interface AlarmPerformanceMonitoringProps {
  deviceId?: string;
}

type PerformanceMetrics = {
  overviewHealth: number;
  availability: number;
  optical: {
    rxPower: number;
    txPower: number;
    onuSignal: number;
  };
  traffic: {
    downstream: number;
    upstream: number;
    latencyMs: number;
  };
  errors: {
    crc: number;
    flaps: number;
  };
};

export function AlarmPerformanceMonitoring({ deviceId }: AlarmPerformanceMonitoringProps) {
  const { toast } = useToast();
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    overviewHealth: 98.5,
    availability: 99.2,
    optical: { rxPower: -19.5, txPower: -2.4, onuSignal: -27.5 },
    traffic: { downstream: 820, upstream: 310, latencyMs: 5.2 },
    errors: { crc: 12, flaps: 3 },
  });
  const [metricsLoading, setMetricsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchMetrics = async () => {
      setMetricsLoading(true);
      try {
        const url = deviceId
          ? `/api/v1/voltha/performance-metrics?device_id=${encodeURIComponent(deviceId)}`
          : "/api/v1/voltha/performance-metrics";
        const response = await fetch(url, { credentials: "include" });
        if (!response.ok) {
          throw new Error(`Metrics fetch failed: ${response.status}`);
        }
        const data = (await response.json()) as Partial<PerformanceMetrics>;
        if (cancelled) return;
        setPerformanceMetrics((prev) => ({
          overviewHealth: data.overviewHealth ?? prev.overviewHealth,
          availability: data.availability ?? prev.availability,
          optical: {
            rxPower: data.optical?.rxPower ?? prev.optical.rxPower,
            txPower: data.optical?.txPower ?? prev.optical.txPower,
            onuSignal: data.optical?.onuSignal ?? prev.optical.onuSignal,
          },
          traffic: {
            downstream: data.traffic?.downstream ?? prev.traffic.downstream,
            upstream: data.traffic?.upstream ?? prev.traffic.upstream,
            latencyMs: data.traffic?.latencyMs ?? prev.traffic.latencyMs,
          },
          errors: {
            crc: data.errors?.crc ?? prev.errors.crc,
            flaps: data.errors?.flaps ?? prev.errors.flaps,
          },
        }));
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load performance metrics", error);
          toast({
            title: "Metrics unavailable",
            description: "Using cached demo metrics until live data is available.",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) {
          setMetricsLoading(false);
        }
      }
    };

    fetchMetrics();
    return () => {
      cancelled = true;
    };
  }, [deviceId, toast]);

  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [acknowledgedAlarms, setAcknowledgedAlarms] = useState<Set<string>>(new Set());
  const [severitySelectOpen, setSeveritySelectOpen] = useState(false);
  const [stateSelectOpen, setStateSelectOpen] = useState(false);
  const [alarmActionsDisabled, setAlarmActionsDisabled] = useState(false);
  const [alarmActionNotice, setAlarmActionNotice] = useState<string | null>(null);

  const handleAlarmActionError = (message: string) => {
    const normalized = message.toLowerCase();
    if (
      normalized.includes("not supported") ||
      normalized.includes("disabled") ||
      normalized.includes("feature") ||
      normalized.includes("driver")
    ) {
      setAlarmActionsDisabled(true);
      setAlarmActionNotice(message);
    }
  };

  // Use React Query hooks
  const { data: alarms = [], isLoading: loading, refetch: loadAlarms } = useVOLTHAAlarms(deviceId);
  const { data: volthaHealth } = useVOLTHAHealth();

  const acknowledgeMutation = useAcknowledgeAlarm({
    onSuccess: (alarmId: string) => {
      setAlarmActionsDisabled(false);
      setAlarmActionNotice(null);
      setAcknowledgedAlarms((prev) => new Set(prev).add(alarmId));
      toast({
        title: "Alarm Acknowledged",
        description: "Alarm has been acknowledged",
      });
    },
    onError: (error: Error) => {
      const message = error.message || "Could not acknowledge alarm";
      handleAlarmActionError(message);
      toast({
        title: "Failed to acknowledge alarm",
        description: message,
        variant: "destructive",
      });
    },
  });

  const clearMutation = useClearAlarm({
    onSuccess: () => {
      setAlarmActionsDisabled(false);
      setAlarmActionNotice(null);
      toast({
        title: "Alarm Cleared",
        description: "Alarm has been cleared",
      });
    },
    onError: (error: Error) => {
      const message = error.message || "Could not clear alarm";
      handleAlarmActionError(message);
      toast({
        title: "Failed to clear alarm",
        description: message,
        variant: "destructive",
      });
    },
  });

  const handleAcknowledgeAlarm = (alarmId: string) => {
    if (alarmActionsDisabled) return;
    acknowledgeMutation.mutate(alarmId);
  };

  const handleClearAlarm = (alarmId: string) => {
    if (alarmActionsDisabled) return;
    clearMutation.mutate(alarmId);
  };

  useEffect(() => {
    if (!volthaHealth) return;
    if (volthaHealth.alarm_actions_enabled === false) {
      setAlarmActionsDisabled(true);
      setAlarmActionNotice("Alarm acknowledge/clear is disabled for this tenant or driver.");
    } else if (volthaHealth.alarm_actions_enabled === true) {
      setAlarmActionsDisabled(false);
      setAlarmActionNotice(null);
    }
  }, [volthaHealth]);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case "MAJOR":
        return <AlertTriangle className="w-4 h-4 text-orange-600" />;
      case "MINOR":
        return <Info className="w-4 h-4 text-yellow-600" />;
      case "WARNING":
        return <AlertTriangle className="w-4 h-4 text-blue-600" />;
      default:
        return <Info className="w-4 h-4 text-gray-600" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const classes: Record<string, string> = {
      CRITICAL: "bg-red-100 text-red-700 border-red-300",
      MAJOR: "bg-orange-100 text-orange-700 border-orange-300",
      MINOR: "bg-yellow-100 text-yellow-700 border-yellow-300",
      WARNING: "bg-blue-100 text-blue-700 border-blue-300",
      INDETERMINATE: "bg-gray-100 text-gray-700 border-gray-300",
    };

    return (
      <Badge variant="outline" className={classes[severity] || classes["INDETERMINATE"]}>
        {severity}
      </Badge>
    );
  };

  // Memoize filtered alarms for performance
  const filteredAlarms = useMemo(
    () =>
      alarms.filter((alarm) => {
        if (severityFilter !== "all" && alarm.severity !== severityFilter) return false;
        if (stateFilter !== "all" && alarm.state !== stateFilter) return false;
        return true;
      }),
    [alarms, severityFilter, stateFilter],
  );

  // Memoize alarm statistics
  const alarmStats = useMemo(
    () => ({
      total: alarms.length,
      active: alarms.filter((a) => a.state === "RAISED").length,
      critical: alarms.filter((a) => a.severity === "CRITICAL" && a.state === "RAISED").length,
      major: alarms.filter((a) => a.severity === "MAJOR" && a.state === "RAISED").length,
      minor: alarms.filter((a) => a.severity === "MINOR" && a.state === "RAISED").length,
    }),
    [alarms],
  );

  return (
    <div className="space-y-6">
      {/* Alarm Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Alarms
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{alarmStats.total}</div>
            <p className="text-xs text-muted-foreground">{alarmStats.active} active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Critical</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{alarmStats.critical}</div>
            <p className="text-xs text-muted-foreground">Requires immediate attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Major</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{alarmStats.major}</div>
            <p className="text-xs text-muted-foreground">Service affecting</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Minor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">{alarmStats.minor}</div>
            <p className="text-xs text-muted-foreground">Non-service affecting</p>
          </CardContent>
        </Card>
      </div>

      {/* Alarms List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Active Alarms</CardTitle>
              <CardDescription>Real-time alarm monitoring and management</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={severityFilter}
                onValueChange={setSeverityFilter}
                open={severitySelectOpen}
                onOpenChange={setSeveritySelectOpen}
              >
                <SelectTrigger className="w-40" aria-label="Filter alarms by severity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                  <SelectItem value="MAJOR">Major</SelectItem>
                  <SelectItem value="MINOR">Minor</SelectItem>
                  <SelectItem value="WARNING">Warning</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={stateFilter}
                onValueChange={setStateFilter}
                open={stateSelectOpen}
                onOpenChange={setStateSelectOpen}
              >
                <SelectTrigger className="w-32" aria-label="Filter alarms by state">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  <SelectItem value="RAISED">Raised</SelectItem>
                  <SelectItem value="CLEARED">Cleared</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => loadAlarms()}
                aria-label="Refresh alarms"
              >
                <Activity className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {alarmActionsDisabled && (
            <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              Alarm acknowledge/clear is disabled by the VOLTHA driver or tenant configuration.
              {alarmActionNotice && (
                <span className="block text-xs text-amber-800">{alarmActionNotice}</span>
              )}
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">Loading alarms...</div>
            </div>
          ) : filteredAlarms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
              <div className="text-lg font-medium">No Active Alarms</div>
              <p className="text-sm text-muted-foreground">All systems are operating normally</p>
            </div>
          ) : (
            <div className="space-y-2" role="list" aria-label="VOLTHA alarms list">
              {filteredAlarms.map((alarm) => (
                <div
                  key={alarm.id}
                  className={`p-4 rounded-lg border ${
                    alarm.state === "RAISED"
                      ? "border-red-200 bg-red-50"
                      : "border-gray-200 bg-gray-50"
                  } ${acknowledgedAlarms.has(alarm.id) ? "opacity-60" : ""}`}
                  role="listitem"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      {getSeverityIcon(alarm.severity)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="font-medium">{alarm.type}</div>
                          {getSeverityBadge(alarm.severity)}
                          {alarm.state === "CLEARED" && (
                            <Badge variant="outline" className="bg-green-100 text-green-700">
                              Cleared
                            </Badge>
                          )}
                          {acknowledgedAlarms.has(alarm.id) && (
                            <Badge variant="outline" className="bg-blue-100 text-blue-700">
                              Acknowledged
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground mb-2">
                          {alarm.description || alarm.category}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">Device:</span>{" "}
                            <span className="font-medium">{alarm.device_id}</span>
                          </div>
                          {alarm.resource_id && (
                            <div>
                              <span className="text-muted-foreground">Resource:</span>{" "}
                              <span className="font-medium">{alarm.resource_id}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-muted-foreground">Raised:</span>{" "}
                            <span className="font-medium">
                              {new Date(alarm.raised_ts).toLocaleString()}
                            </span>
                          </div>
                          {alarm.cleared_ts && (
                            <div>
                              <span className="text-muted-foreground">Cleared:</span>{" "}
                              <span className="font-medium">
                                {new Date(alarm.cleared_ts).toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {alarm.state === "RAISED" && !acknowledgedAlarms.has(alarm.id) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={alarmActionsDisabled || acknowledgeMutation.isPending}
                          onClick={() => handleAcknowledgeAlarm(alarm.id)}
                          aria-label={`Acknowledge alarm ${alarm.type}`}
                        >
                          <Bell className="w-4 h-4 mr-1" />
                          Acknowledge
                        </Button>
                      )}
                      {alarm.state === "RAISED" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={alarmActionsDisabled || clearMutation.isPending}
                          onClick={() => handleClearAlarm(alarm.id)}
                          aria-label={`Clear alarm ${alarm.type}`}
                        >
                          <BellOff className="w-4 h-4 mr-1" />
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Metrics</CardTitle>
          <CardDescription>Network health and performance indicators</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="optical">Optical Power</TabsTrigger>
              <TabsTrigger value="traffic">Traffic</TabsTrigger>
              <TabsTrigger value="errors">Errors</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-muted-foreground">Network Health</div>
                    <Activity className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="text-2xl font-bold text-green-600">
                    {performanceMetrics.overviewHealth.toFixed(1)}%
                  </div>
                  <Progress value={performanceMetrics.overviewHealth} className="h-2 mt-2" />
                  {metricsLoading && (
                    <div className="text-xs text-muted-foreground mt-1">Updating…</div>
                  )}
                </div>

                <div className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-muted-foreground">Avg Availability</div>
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="text-2xl font-bold text-blue-600">
                    {performanceMetrics.availability.toFixed(1)}%
                  </div>
                  <Progress value={performanceMetrics.availability} className="h-2 mt-2" />
                </div>

                <div className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-muted-foreground">Error Rate</div>
                    <TrendingDown className="w-4 h-4 text-yellow-600" />
                  </div>
                  <div className="text-2xl font-bold text-yellow-600">
                    {performanceMetrics.errors.crc.toFixed(2)}%
                  </div>
                  <Progress
                    value={Math.min(100, performanceMetrics.errors.crc)}
                    className="h-2 mt-2"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="optical" className="space-y-4 mt-4">
              <div className="text-sm text-muted-foreground">
                Average optical power levels across all PON ports
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-muted-foreground">Avg RX Power</div>
                    <Zap className="w-4 h-4" />
                  </div>
                  <div className="text-2xl font-bold">-22.5 dBm</div>
                  <div className="text-xs text-green-600 mt-1">Good signal quality</div>
                </div>

                <div className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-muted-foreground">Avg TX Power</div>
                    <Zap className="w-4 h-4" />
                  </div>
                  <div className="text-2xl font-bold">2.3 dBm</div>
                  <div className="text-xs text-green-600 mt-1">Within normal range</div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="traffic" className="space-y-4 mt-4">
              <div className="text-sm text-muted-foreground">Aggregate traffic statistics</div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-muted-foreground">Total RX</div>
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <div className="text-2xl font-bold">1.2 TB</div>
                  <div className="text-xs text-muted-foreground mt-1">Last 24 hours</div>
                </div>

                <div className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-muted-foreground">Total TX</div>
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <div className="text-2xl font-bold">856 GB</div>
                  <div className="text-xs text-muted-foreground mt-1">Last 24 hours</div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="errors" className="space-y-4 mt-4">
              <div className="text-sm text-muted-foreground">
                Error statistics and FEC performance
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 rounded-lg border bg-card">
                  <div className="text-sm text-muted-foreground mb-2">RX Errors</div>
                  <div className="text-2xl font-bold text-green-600">0</div>
                </div>

                <div className="p-4 rounded-lg border bg-card">
                  <div className="text-sm text-muted-foreground mb-2">TX Errors</div>
                  <div className="text-2xl font-bold text-green-600">0</div>
                </div>

                <div className="p-4 rounded-lg border bg-card">
                  <div className="text-sm text-muted-foreground mb-2">FEC Uncorrectable</div>
                  <div className="text-2xl font-bold text-green-600">0</div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
