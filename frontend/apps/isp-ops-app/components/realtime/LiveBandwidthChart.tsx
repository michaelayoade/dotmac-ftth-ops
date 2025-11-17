"use client";

import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Activity, Wifi, WifiOff } from "lucide-react";
import { useWebSocket, useWebSocketSubscription } from "@/lib/websocket/WebSocketProvider";
import { format } from "date-fns";

interface BandwidthData {
  timestamp: string;
  upload_mbps: number;
  download_mbps: number;
  latency_ms: number;
}

export function LiveBandwidthChart() {
  const { isConnected } = useWebSocket();
  const [bandwidthData] = useWebSocketSubscription<BandwidthData>("bandwidth_update");
  const [history, setHistory] = useState<BandwidthData[]>([]);

  // Add new data point to history (keep last 50 points)
  useEffect(() => {
    if (bandwidthData) {
      setHistory((prev) => {
        const newHistory = [...prev, bandwidthData];
        return newHistory.slice(-50); // Keep last 50 points
      });
    }
  }, [bandwidthData]);

  const chartData = history.map((point) => ({
    time: format(new Date(point.timestamp), "HH:mm:ss"),
    upload: Math.round(point.upload_mbps),
    download: Math.round(point.download_mbps),
    latency: Math.round(point.latency_ms),
  }));

  const latestData = history[history.length - 1];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Live Bandwidth Monitoring
            </CardTitle>
            <CardDescription>Real-time network bandwidth and latency</CardDescription>
          </div>
          <Badge
            variant={isConnected ? "default" : "secondary"}
            className="flex items-center gap-1"
            data-testid="connection-status-badge"
          >
            {isConnected ? (
              <>
                <Wifi className="h-3 w-3" aria-hidden="true" />
                <span data-testid="connection-status-label">Live</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3" aria-hidden="true" />
                <span data-testid="connection-status-label">Simulated</span>
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Current Stats */}
        {latestData && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Upload</p>
              <p className="text-2xl font-bold text-green-500" data-testid="upload-rate">
                {latestData.upload_mbps.toFixed(1)} Mbps
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Download</p>
              <p className="text-2xl font-bold text-blue-500" data-testid="download-rate">
                {latestData.download_mbps.toFixed(1)} Mbps
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Latency</p>
              <p className="text-2xl font-bold" data-testid="latency-value">
                {latestData.latency_ms.toFixed(0)} ms
              </p>
            </div>
          </div>
        )}

        {/* Chart */}
        <div className="h-[300px]">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              {isConnected
                ? "Awaiting telemetry…"
                : "WebSocket connection offline. Bandwidth metrics will appear once the stream resumes."}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="time" className="text-xs" tick={{ fontSize: 10 }} />
                <YAxis className="text-xs" tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="upload"
                  stroke="hsl(142, 76%, 36%)"
                  strokeWidth={2}
                  dot={false}
                  name="Upload (Mbps)"
                />
                <Line
                  type="monotone"
                  dataKey="download"
                  stroke="hsl(217, 91%, 60%)"
                  strokeWidth={2}
                  dot={false}
                  name="Download (Mbps)"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
