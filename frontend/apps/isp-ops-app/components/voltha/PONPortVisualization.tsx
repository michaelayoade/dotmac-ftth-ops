"use client";

import { useState } from "react";
import {
  Radio,
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  AlertCircle,
  Info,
  Server,
} from "lucide-react";
import { useToast } from "@dotmac/ui";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Progress } from "@dotmac/ui";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@dotmac/ui";
import { PONPortMetrics } from "@/types/voltha";
import { usePONPortStatistics } from "@/hooks/useVOLTHA";
import {
  UTILIZATION_THRESHOLDS,
  OPTICAL_POWER_THRESHOLDS,
  HEALTH_SCORE_DEDUCTIONS,
  HEALTH_SCORE_THRESHOLDS,
  ONLINE_RATIO_THRESHOLDS,
} from "@/lib/constants/voltha";

interface PONPortVisualizationProps {
  oltId: string;
  ponPorts: PONPortMetrics[];
}

export function PONPortVisualization({ oltId, ponPorts }: PONPortVisualizationProps) {
  const { toast } = useToast();
  const [selectedPort, setSelectedPort] = useState<number | null>(null);

  // Use React Query hook for port statistics
  const {
    data: portStatistics,
    isLoading: loading,
    isError,
  } = usePONPortStatistics(oltId, selectedPort ?? 0);

  const getUtilizationColor = (utilization?: number) => {
    if (!utilization) return "bg-gray-200";
    if (utilization > UTILIZATION_THRESHOLDS.CRITICAL) return "bg-red-500";
    if (utilization > UTILIZATION_THRESHOLDS.WARNING) return "bg-yellow-500";
    if (utilization > UTILIZATION_THRESHOLDS.NORMAL) return "bg-blue-500";
    return "bg-green-500";
  };

  const getOpticalPowerStatus = (rxPower?: number) => {
    if (!rxPower) return null;
    if (rxPower > OPTICAL_POWER_THRESHOLDS.EXCELLENT)
      return { label: "Excellent", color: "text-green-600", icon: TrendingUp };
    if (rxPower > OPTICAL_POWER_THRESHOLDS.GOOD)
      return { label: "Good", color: "text-blue-600", icon: TrendingUp };
    if (rxPower > OPTICAL_POWER_THRESHOLDS.FAIR)
      return { label: "Fair", color: "text-yellow-600", icon: Activity };
    return { label: "Poor", color: "text-red-600", icon: TrendingDown };
  };

  const getHealthScore = (port: PONPortMetrics) => {
    let score = HEALTH_SCORE_DEDUCTIONS.BASE_SCORE;

    // Deduct for utilization
    if (port.utilization_percent !== undefined) {
      if (port.utilization_percent > UTILIZATION_THRESHOLDS.CRITICAL)
        score -= HEALTH_SCORE_DEDUCTIONS.HIGH_UTILIZATION;
      else if (port.utilization_percent > UTILIZATION_THRESHOLDS.WARNING)
        score -= HEALTH_SCORE_DEDUCTIONS.MEDIUM_UTILIZATION;
    }

    // Deduct for offline ONUs
    const onlineRatio = port.total_onus > 0 ? port.online_onus / port.total_onus : 1;
    if (onlineRatio < ONLINE_RATIO_THRESHOLDS.ACCEPTABLE)
      score -= HEALTH_SCORE_DEDUCTIONS.LOW_ONLINE_RATIO;
    else if (onlineRatio < ONLINE_RATIO_THRESHOLDS.GOOD)
      score -= HEALTH_SCORE_DEDUCTIONS.MEDIUM_ONLINE_RATIO;

    // Deduct for optical power
    if (port.avg_rx_power !== undefined) {
      if (port.avg_rx_power < OPTICAL_POWER_THRESHOLDS.FAIR)
        score -= HEALTH_SCORE_DEDUCTIONS.POOR_OPTICAL_POWER;
      else if (port.avg_rx_power < OPTICAL_POWER_THRESHOLDS.GOOD)
        score -= HEALTH_SCORE_DEDUCTIONS.FAIR_OPTICAL_POWER;
    }

    return Math.max(0, score);
  };

  const getHealthBadge = (score: number) => {
    if (score >= HEALTH_SCORE_THRESHOLDS.HEALTHY)
      return (
        <Badge variant="outline" className="bg-green-500">
          Healthy
        </Badge>
      );
    if (score >= HEALTH_SCORE_THRESHOLDS.FAIR)
      return (
        <Badge variant="outline" className="bg-yellow-500">
          Fair
        </Badge>
      );
    if (score >= HEALTH_SCORE_THRESHOLDS.DEGRADED)
      return (
        <Badge variant="outline" className="bg-orange-500">
          Degraded
        </Badge>
      );
    return (
      <Badge variant="destructive" className="">
        Critical
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* PON Port Grid */}
      <div
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
        role="list"
        aria-label="PON ports list"
      >
        {ponPorts.map((port) => {
          const healthScore = getHealthScore(port);
          const opticalStatus = port.avg_rx_power ? getOpticalPowerStatus(port.avg_rx_power) : null;
          const isSelected = selectedPort === port.port_no;

          return (
            <Card
              key={port.port_no}
              className={`cursor-pointer transition-all hover:shadow-lg ${
                isSelected ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => setSelectedPort(port.port_no)}
              role="button"
              tabIndex={0}
              aria-label={`Select ${port.label} - Health score ${healthScore}`}
              aria-pressed={isSelected}
              onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedPort(port.port_no);
                }
              }}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio className="w-5 h-5" />
                    <CardTitle className="text-base">{port.label}</CardTitle>
                  </div>
                  {getHealthBadge(healthScore)}
                </div>
                <CardDescription>Port {port.port_no}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* ONU Status */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">ONUs</span>
                    <span className="font-medium">
                      {port.online_onus}/{port.total_onus}
                    </span>
                  </div>
                  <Progress
                    value={port.total_onus > 0 ? (port.online_onus / port.total_onus) * 100 : 0}
                    className="h-2"
                  />
                </div>

                {/* Utilization */}
                {port.utilization_percent !== undefined && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Utilization</span>
                      <span className="font-medium">{port.utilization_percent.toFixed(1)}%</span>
                    </div>
                    <Progress
                      value={port.utilization_percent}
                      className={`h-2 ${getUtilizationColor(port.utilization_percent)}`}
                    />
                  </div>
                )}

                {/* Optical Power */}
                {port.avg_rx_power !== undefined && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Avg RX Power</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <span className={`font-medium ${opticalStatus?.color}`}>
                              {port.avg_rx_power.toFixed(2)} dBm
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Signal quality: {opticalStatus?.label}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    {opticalStatus && (
                      <div className="flex items-center gap-1 text-xs">
                        {opticalStatus.icon === TrendingUp && <TrendingUp className="w-3 h-3" />}
                        {opticalStatus.icon === TrendingDown && (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {opticalStatus.icon === Activity && <Activity className="w-3 h-3" />}
                        <span className={opticalStatus.color}>{opticalStatus.label}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Status Badge */}
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Operational Status</span>
                    <Badge
                      variant={port.oper_status === "ACTIVE" ? "outline" : "secondary"}
                      className=""
                    >
                      {port.oper_status}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Detailed Port Statistics */}
      {selectedPort !== null && (
        <Card>
          <CardHeader>
            <CardTitle>Port {selectedPort} - Detailed Statistics</CardTitle>
            <CardDescription>Real-time optical and traffic metrics</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-muted-foreground">Loading statistics...</div>
              </div>
            ) : portStatistics ? (
              <div className="space-y-6">
                {/* Optical Metrics */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Optical Metrics
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {portStatistics.rx_power !== undefined && (
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">RX Power</div>
                        <div className="text-2xl font-bold">
                          {portStatistics.rx_power.toFixed(2)}
                        </div>
                        <div className="text-xs text-muted-foreground">dBm</div>
                      </div>
                    )}
                    {portStatistics.tx_power !== undefined && (
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">TX Power</div>
                        <div className="text-2xl font-bold">
                          {portStatistics.tx_power.toFixed(2)}
                        </div>
                        <div className="text-xs text-muted-foreground">dBm</div>
                      </div>
                    )}
                    {portStatistics.temperature !== undefined && (
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">Temperature</div>
                        <div className="text-2xl font-bold">
                          {portStatistics.temperature.toFixed(1)}
                        </div>
                        <div className="text-xs text-muted-foreground">°C</div>
                      </div>
                    )}
                    {portStatistics.voltage !== undefined && (
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">Voltage</div>
                        <div className="text-2xl font-bold">
                          {portStatistics.voltage.toFixed(2)}
                        </div>
                        <div className="text-xs text-muted-foreground">V</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Traffic Metrics */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Traffic Statistics
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {portStatistics.rx_bytes !== undefined && (
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">RX Bytes</div>
                        <div className="text-xl font-bold">
                          {(portStatistics.rx_bytes / 1024 / 1024 / 1024).toFixed(2)}
                        </div>
                        <div className="text-xs text-muted-foreground">GB</div>
                      </div>
                    )}
                    {portStatistics.tx_bytes !== undefined && (
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">TX Bytes</div>
                        <div className="text-xl font-bold">
                          {(portStatistics.tx_bytes / 1024 / 1024 / 1024).toFixed(2)}
                        </div>
                        <div className="text-xs text-muted-foreground">GB</div>
                      </div>
                    )}
                    {portStatistics.rx_packets !== undefined && (
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">RX Packets</div>
                        <div className="text-xl font-bold">
                          {(portStatistics.rx_packets / 1000000).toFixed(2)}
                        </div>
                        <div className="text-xs text-muted-foreground">M</div>
                      </div>
                    )}
                    {portStatistics.tx_packets !== undefined && (
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">TX Packets</div>
                        <div className="text-xl font-bold">
                          {(portStatistics.tx_packets / 1000000).toFixed(2)}
                        </div>
                        <div className="text-xs text-muted-foreground">M</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Error Metrics */}
                {(portStatistics.rx_errors !== undefined ||
                  portStatistics.tx_errors !== undefined) && (
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Error Statistics
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {portStatistics.rx_errors !== undefined && (
                        <div className="space-y-1">
                          <div className="text-sm text-muted-foreground">RX Errors</div>
                          <div
                            className={`text-xl font-bold ${portStatistics.rx_errors > 0 ? "text-red-600" : "text-green-600"}`}
                          >
                            {portStatistics.rx_errors}
                          </div>
                        </div>
                      )}
                      {portStatistics.tx_errors !== undefined && (
                        <div className="space-y-1">
                          <div className="text-sm text-muted-foreground">TX Errors</div>
                          <div
                            className={`text-xl font-bold ${portStatistics.tx_errors > 0 ? "text-red-600" : "text-green-600"}`}
                          >
                            {portStatistics.tx_errors}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* FEC Metrics */}
                {(portStatistics.fec_corrected !== undefined ||
                  portStatistics.fec_uncorrectable !== undefined) && (
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Info className="w-4 h-4" />
                      FEC (Forward Error Correction)
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {portStatistics.fec_corrected !== undefined && (
                        <div className="space-y-1">
                          <div className="text-sm text-muted-foreground">Corrected Errors</div>
                          <div className="text-xl font-bold">{portStatistics.fec_corrected}</div>
                        </div>
                      )}
                      {portStatistics.fec_uncorrectable !== undefined && (
                        <div className="space-y-1">
                          <div className="text-sm text-muted-foreground">Uncorrectable Errors</div>
                          <div
                            className={`text-xl font-bold ${portStatistics.fec_uncorrectable > 0 ? "text-red-600" : "text-green-600"}`}
                          >
                            {portStatistics.fec_uncorrectable}
                          </div>
                        </div>
                      )}
                      {portStatistics.ber !== undefined && (
                        <div className="space-y-1">
                          <div className="text-sm text-muted-foreground">BER</div>
                          <div className="text-xl font-bold">
                            {portStatistics.ber.toExponential(2)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                No statistics available for this port
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Port Health Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Port Health Summary</CardTitle>
          <CardDescription>Overview of all PON ports health status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="p-4 rounded-lg border bg-green-50 border-green-200">
              <div className="text-sm text-green-700 mb-1">Healthy Ports</div>
              <div className="text-2xl font-bold text-green-900">
                {
                  ponPorts.filter((p) => getHealthScore(p) >= HEALTH_SCORE_THRESHOLDS.HEALTHY)
                    .length
                }
              </div>
            </div>
            <div className="p-4 rounded-lg border bg-yellow-50 border-yellow-200">
              <div className="text-sm text-yellow-700 mb-1">Fair Ports</div>
              <div className="text-2xl font-bold text-yellow-900">
                {
                  ponPorts.filter(
                    (p) =>
                      getHealthScore(p) >= HEALTH_SCORE_THRESHOLDS.FAIR &&
                      getHealthScore(p) < HEALTH_SCORE_THRESHOLDS.HEALTHY,
                  ).length
                }
              </div>
            </div>
            <div className="p-4 rounded-lg border bg-orange-50 border-orange-200">
              <div className="text-sm text-orange-700 mb-1">Degraded Ports</div>
              <div className="text-2xl font-bold text-orange-900">
                {
                  ponPorts.filter(
                    (p) =>
                      getHealthScore(p) >= HEALTH_SCORE_THRESHOLDS.DEGRADED &&
                      getHealthScore(p) < HEALTH_SCORE_THRESHOLDS.FAIR,
                  ).length
                }
              </div>
            </div>
            <div className="p-4 rounded-lg border bg-red-50 border-red-200">
              <div className="text-sm text-red-700 mb-1">Critical Ports</div>
              <div className="text-2xl font-bold text-red-900">
                {
                  ponPorts.filter((p) => getHealthScore(p) < HEALTH_SCORE_THRESHOLDS.DEGRADED)
                    .length
                }
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
