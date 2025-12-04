"use client";

import { useState } from "react";
import {
  Activity,
  Zap,
  TrendingUp,
  TrendingDown,
  Gauge,
  PlayCircle,
  StopCircle,
  Loader2,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@dotmac/ui";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { DiagnosticType } from "@/types/diagnostics";
import { AnimatedProgressBar, AnimatedCounter } from "@dotmac/primitives";

interface PerformanceTestingPanelProps {
  subscriberId: string;
}

interface BandwidthTestResult {
  download_mbps: number;
  upload_mbps: number;
  expected_download_mbps?: number;
  expected_upload_mbps?: number;
  test_duration_seconds: number;
  test_server?: string;
}

interface LatencyTestResult {
  avg_latency_ms: number;
  min_latency_ms: number;
  max_latency_ms: number;
  jitter_ms: number;
  packet_loss_percent: number;
  packets_sent: number;
  packets_received: number;
  test_target?: string;
}

export function PerformanceTestingPanel({ subscriberId }: PerformanceTestingPanelProps) {
  const { toast } = useToast();

  const [bandwidthTest, setBandwidthTest] = useState<{
    running: boolean;
    progress: number;
    result: BandwidthTestResult | null;
  }>({ running: false, progress: 0, result: null });

  const [latencyTest, setLatencyTest] = useState<{
    running: boolean;
    progress: number;
    result: LatencyTestResult | null;
  }>({ running: false, progress: 0, result: null });

  const runBandwidthTest = async () => {
    setBandwidthTest({ running: true, progress: 0, result: null });

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setBandwidthTest((prev) => ({
          ...prev,
          progress: Math.min(prev.progress + 10, 90),
        }));
      }, 1000);

      const response = await apiClient.post(
        `/api/v1/diagnostics/subscribers/${subscriberId}/bandwidth-test`,
      );

      clearInterval(progressInterval);

      const result = response.data.results as BandwidthTestResult;
      setBandwidthTest({ running: false, progress: 100, result });

      toast({
        title: "Bandwidth test completed",
        description: `Download: ${result.download_mbps.toFixed(2)} Mbps, Upload: ${result.upload_mbps.toFixed(2)} Mbps`,
      });
    } catch (err: any) {
      setBandwidthTest({ running: false, progress: 0, result: null });
      toast({
        title: "Bandwidth test failed",
        description: err?.response?.data?.detail || "Test failed to complete",
        variant: "destructive",
      });
    }
  };

  const runLatencyTest = async () => {
    setLatencyTest({ running: true, progress: 0, result: null });

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setLatencyTest((prev) => ({
          ...prev,
          progress: Math.min(prev.progress + 15, 90),
        }));
      }, 500);

      const response = await apiClient.post(
        `/api/v1/diagnostics/subscribers/${subscriberId}/latency-test`,
      );

      clearInterval(progressInterval);

      const result = response.data.results as LatencyTestResult;
      setLatencyTest({ running: false, progress: 100, result });

      toast({
        title: "Latency test completed",
        description: `Avg: ${result.avg_latency_ms.toFixed(1)}ms, Jitter: ${result.jitter_ms.toFixed(1)}ms, Loss: ${result.packet_loss_percent.toFixed(1)}%`,
      });
    } catch (err: any) {
      setLatencyTest({ running: false, progress: 0, result: null });
      toast({
        title: "Latency test failed",
        description: err?.response?.data?.detail || "Test failed to complete",
        variant: "destructive",
      });
    }
  };

  const getBandwidthStatus = (result: BandwidthTestResult) => {
    if (!result.expected_download_mbps) return null;

    const downloadPercent = (result.download_mbps / result.expected_download_mbps) * 100;
    const uploadPercent = result.expected_upload_mbps
      ? (result.upload_mbps / result.expected_upload_mbps) * 100
      : 100;

    if (downloadPercent >= 90 && uploadPercent >= 90) {
      return { status: "excellent", color: "text-green-600", icon: TrendingUp };
    } else if (downloadPercent >= 70 && uploadPercent >= 70) {
      return { status: "good", color: "text-blue-600", icon: Activity };
    } else if (downloadPercent >= 50 && uploadPercent >= 50) {
      return { status: "fair", color: "text-yellow-600", icon: TrendingDown };
    } else {
      return { status: "poor", color: "text-red-600", icon: TrendingDown };
    }
  };

  const getLatencyStatus = (result: LatencyTestResult) => {
    if (result.packet_loss_percent > 5) {
      return {
        status: "poor",
        color: "text-red-600",
        severity: "High packet loss",
      };
    } else if (result.avg_latency_ms > 100) {
      return {
        status: "fair",
        color: "text-yellow-600",
        severity: "High latency",
      };
    } else if (result.jitter_ms > 30) {
      return {
        status: "fair",
        color: "text-yellow-600",
        severity: "High jitter",
      };
    } else if (result.avg_latency_ms < 50 && result.jitter_ms < 10) {
      return {
        status: "excellent",
        color: "text-green-600",
        severity: "Excellent",
      };
    } else {
      return { status: "good", color: "text-blue-600", severity: "Good" };
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Bandwidth Test */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                <CardTitle>Bandwidth Test</CardTitle>
              </div>
              {bandwidthTest.result && getBandwidthStatus(bandwidthTest.result) && (
                <Badge
                  variant="outline"
                  className={getBandwidthStatus(bandwidthTest.result)!.color}
                >
                  {getBandwidthStatus(bandwidthTest.result)!.status.toUpperCase()}
                </Badge>
              )}
            </div>
            <CardDescription>Measure download and upload speeds</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {bandwidthTest.running && (
              <AnimatedProgressBar
                progress={bandwidthTest.progress}
                showLabel
                label="Testing..."
                color="bg-sky-500"
                backgroundColor="bg-gray-200 dark:bg-gray-800"
                height="h-2"
              />
            )}

            {bandwidthTest.result && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Download</div>
                    <div className="text-2xl font-bold flex items-baseline gap-1">
                      <AnimatedCounter value={bandwidthTest.result.download_mbps} duration={1.2} />
                      <span className="text-xs text-muted-foreground">Mbps</span>
                    </div>
                    {bandwidthTest.result.expected_download_mbps && (
                      <div className="text-xs text-muted-foreground">
                        Expected: {bandwidthTest.result.expected_download_mbps} Mbps
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Upload</div>
                    <div className="text-2xl font-bold flex items-baseline gap-1">
                      <AnimatedCounter value={bandwidthTest.result.upload_mbps} duration={1.2} />
                      <span className="text-xs text-muted-foreground">Mbps</span>
                    </div>
                    {bandwidthTest.result.expected_upload_mbps && (
                      <div className="text-xs text-muted-foreground">
                        Expected: {bandwidthTest.result.expected_upload_mbps} Mbps
                      </div>
                    )}
                  </div>
                </div>

                {bandwidthTest.result.test_server && (
                  <div className="text-xs text-muted-foreground">
                    Test server: {bandwidthTest.result.test_server}
                  </div>
                )}

                <div className="text-xs text-muted-foreground">
                  Test duration: {bandwidthTest.result.test_duration_seconds}s
                </div>
              </div>
            )}

            <Button onClick={runBandwidthTest} disabled={bandwidthTest.running} className="w-full">
              {bandwidthTest.running ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Running Test...
                </>
              ) : (
                <>
                  <PlayCircle className="w-4 h-4 mr-2" />
                  Run Bandwidth Test
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Latency Test */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gauge className="w-5 h-5" />
                <CardTitle>Latency & Jitter Test</CardTitle>
              </div>
              {latencyTest.result && (
                <Badge variant="outline" className={getLatencyStatus(latencyTest.result).color}>
                  {getLatencyStatus(latencyTest.result).severity}
                </Badge>
              )}
            </div>
            <CardDescription>Measure latency, jitter, and packet loss</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {latencyTest.running && (
              <AnimatedProgressBar
                progress={latencyTest.progress}
                showLabel
                label="Testing..."
                color="bg-purple-500"
                backgroundColor="bg-gray-200 dark:bg-gray-800"
                height="h-2"
              />
            )}

            {latencyTest.result && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Avg Latency</div>
                    <div className="text-2xl font-bold">
                      {latencyTest.result.avg_latency_ms.toFixed(1)}
                    </div>
                    <div className="text-xs text-muted-foreground">ms</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Jitter</div>
                    <div className="text-2xl font-bold">
                      {latencyTest.result.jitter_ms.toFixed(1)}
                    </div>
                    <div className="text-xs text-muted-foreground">ms</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Min / Max Latency</span>
                    <span className="font-medium">
                      {latencyTest.result.min_latency_ms.toFixed(1)}ms /{" "}
                      {latencyTest.result.max_latency_ms.toFixed(1)}ms
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Packet Loss</span>
                    <span
                      className={`font-medium ${latencyTest.result.packet_loss_percent > 1 ? "text-red-600" : "text-green-600"}`}
                    >
                      {latencyTest.result.packet_loss_percent.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Packets</span>
                    <span className="font-medium">
                      {latencyTest.result.packets_received} / {latencyTest.result.packets_sent}
                    </span>
                  </div>
                </div>

                {latencyTest.result.test_target && (
                  <div className="text-xs text-muted-foreground">
                    Test target: {latencyTest.result.test_target}
                  </div>
                )}
              </div>
            )}

            <Button onClick={runLatencyTest} disabled={latencyTest.running} className="w-full">
              {latencyTest.running ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Running Test...
                </>
              ) : (
                <>
                  <PlayCircle className="w-4 h-4 mr-2" />
                  Run Latency Test
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Performance Insights */}
      {(bandwidthTest.result || latencyTest.result) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Performance Insights</CardTitle>
            <CardDescription>Analysis and recommendations based on test results</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {bandwidthTest.result && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Bandwidth Analysis</h4>
                {bandwidthTest.result.expected_download_mbps && (
                  <div className="text-sm text-muted-foreground">
                    {(
                      (bandwidthTest.result.download_mbps /
                        bandwidthTest.result.expected_download_mbps) *
                      100
                    ).toFixed(0)}
                    % of expected download speed achieved
                  </div>
                )}
                {bandwidthTest.result.download_mbps <
                  (bandwidthTest.result.expected_download_mbps || 0) * 0.7 && (
                  <div className="text-sm text-yellow-600">
                    ⚠️ Download speed is below 70% of expected. Check for network congestion or CPE
                    issues.
                  </div>
                )}
              </div>
            )}

            {latencyTest.result && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Latency Analysis</h4>
                {latencyTest.result.packet_loss_percent > 1 && (
                  <div className="text-sm text-red-600">
                    ⚠️ High packet loss detected (
                    {latencyTest.result.packet_loss_percent.toFixed(2)}%). Check network path and
                    device health.
                  </div>
                )}
                {latencyTest.result.jitter_ms > 30 && (
                  <div className="text-sm text-yellow-600">
                    ⚠️ High jitter detected. This may affect real-time applications like VoIP and
                    gaming.
                  </div>
                )}
                {latencyTest.result.avg_latency_ms < 50 &&
                  latencyTest.result.jitter_ms < 10 &&
                  latencyTest.result.packet_loss_percent < 0.1 && (
                    <div className="text-sm text-green-600">
                      ✓ Excellent network quality. Suitable for all applications including real-time
                      services.
                    </div>
                  )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
