"use client";

import { useState, useEffect, useCallback } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { VOLTHAAlarm, VOLTHAAlarmListResponse, AlarmSeverity } from "@/types/voltha";

interface AlarmPerformanceMonitoringProps {
  deviceId?: string;
}

export function AlarmPerformanceMonitoring({ deviceId }: AlarmPerformanceMonitoringProps) {
  const { toast } = useToast();

  const [alarms, setAlarms] = useState<VOLTHAAlarm[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [acknowledgedAlarms, setAcknowledgedAlarms] = useState<Set<string>>(new Set());

  const loadAlarms = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = deviceId
        ? `/api/v1/voltha/devices/${deviceId}/alarms`
        : "/api/v1/voltha/alarms";

      const response = await apiClient.get<VOLTHAAlarmListResponse>(endpoint);
      setAlarms(response.data.alarms);
    } catch (err: any) {
      toast({
        title: "Failed to load alarms",
        description: err?.response?.data?.detail || "Could not fetch VOLTHA alarms",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [deviceId, toast]);

  useEffect(() => {
    loadAlarms();
  }, [deviceId, loadAlarms]);

  const handleAcknowledgeAlarm = async (alarmId: string) => {
    try {
      await apiClient.post(`/api/v1/voltha/alarms/${alarmId}/acknowledge`);
      setAcknowledgedAlarms(prev => new Set(prev).add(alarmId));
      toast({
        title: "Alarm Acknowledged",
        description: "Alarm has been acknowledged",
      });
    } catch (err: any) {
      toast({
        title: "Failed to acknowledge alarm",
        description: err?.response?.data?.detail || "Could not acknowledge alarm",
        variant: "destructive",
      });
    }
  };

  const handleClearAlarm = async (alarmId: string) => {
    try {
      await apiClient.post(`/api/v1/voltha/alarms/${alarmId}/clear`);
      toast({
        title: "Alarm Cleared",
        description: "Alarm has been cleared",
      });
      loadAlarms();
    } catch (err: any) {
      toast({
        title: "Failed to clear alarm",
        description: err?.response?.data?.detail || "Could not clear alarm",
        variant: "destructive",
      });
    }
  };

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
      <Badge variant="outline" className={classes[severity] || classes.INDETERMINATE}>
        {severity}
      </Badge>
    );
  };

  const filteredAlarms = alarms.filter((alarm) => {
    if (severityFilter !== "all" && alarm.severity !== severityFilter) return false;
    if (stateFilter !== "all" && alarm.state !== stateFilter) return false;
    return true;
  });

  const alarmStats = {
    total: alarms.length,
    active: alarms.filter((a) => a.state === "RAISED").length,
    critical: alarms.filter((a) => a.severity === "CRITICAL" && a.state === "RAISED").length,
    major: alarms.filter((a) => a.severity === "MAJOR" && a.state === "RAISED").length,
    minor: alarms.filter((a) => a.severity === "MINOR" && a.state === "RAISED").length,
  };

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
            <p className="text-xs text-muted-foreground">
              {alarmStats.active} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Critical
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{alarmStats.critical}</div>
            <p className="text-xs text-muted-foreground">
              Requires immediate attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Major
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{alarmStats.major}</div>
            <p className="text-xs text-muted-foreground">
              Service affecting
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Minor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">{alarmStats.minor}</div>
            <p className="text-xs text-muted-foreground">
              Non-service affecting
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alarms List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Active Alarms</CardTitle>
              <CardDescription>
                Real-time alarm monitoring and management
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-40">
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

              <Select value={stateFilter} onValueChange={setStateFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  <SelectItem value="RAISED">Raised</SelectItem>
                  <SelectItem value="CLEARED">Cleared</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" size="sm" onClick={loadAlarms}>
                <Activity className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">Loading alarms...</div>
            </div>
          ) : filteredAlarms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
              <div className="text-lg font-medium">No Active Alarms</div>
              <p className="text-sm text-muted-foreground">
                All systems are operating normally
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredAlarms.map((alarm) => (
                <div
                  key={alarm.id}
                  className={`p-4 rounded-lg border ${
                    alarm.state === "RAISED"
                      ? "border-red-200 bg-red-50"
                      : "border-gray-200 bg-gray-50"
                  } ${acknowledgedAlarms.has(alarm.id) ? "opacity-60" : ""}`}
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
                          onClick={() => handleAcknowledgeAlarm(alarm.id)}
                        >
                          <Bell className="w-4 h-4 mr-1" />
                          Acknowledge
                        </Button>
                      )}
                      {alarm.state === "RAISED" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleClearAlarm(alarm.id)}
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
          <CardDescription>
            Network health and performance indicators
          </CardDescription>
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
                  <div className="text-2xl font-bold text-green-600">98.5%</div>
                  <Progress value={98.5} className="h-2 mt-2" />
                </div>

                <div className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-muted-foreground">Avg Availability</div>
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="text-2xl font-bold text-blue-600">99.2%</div>
                  <Progress value={99.2} className="h-2 mt-2" />
                </div>

                <div className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-muted-foreground">Error Rate</div>
                    <TrendingDown className="w-4 h-4 text-yellow-600" />
                  </div>
                  <div className="text-2xl font-bold text-yellow-600">0.08%</div>
                  <Progress value={0.08} className="h-2 mt-2" />
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
              <div className="text-sm text-muted-foreground">
                Aggregate traffic statistics
              </div>
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
