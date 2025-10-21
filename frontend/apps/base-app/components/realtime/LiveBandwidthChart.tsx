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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

  // Simulate data if WebSocket not connected (for demo purposes)
  useEffect(() => {
    if (!isConnected) {
      const interval = setInterval(() => {
        const mockData: BandwidthData = {
          timestamp: new Date().toISOString(),
          upload_mbps: 50 + Math.random() * 50,
          download_mbps: 100 + Math.random() * 100,
          latency_ms: 10 + Math.random() * 20,
        };

        setHistory((prev) => {
          const newHistory = [...prev, mockData];
          return newHistory.slice(-50);
        });
      }, 2000);

      return () => clearInterval(interval);
    }
    return undefined;
  }, [isConnected]);

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
          >
            {isConnected ? (
              <>
                <Wifi className="h-3 w-3" />
                Live
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3" />
                Simulated
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
              <p className="text-2xl font-bold text-green-500">
                {latestData.upload_mbps.toFixed(1)} Mbps
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Download</p>
              <p className="text-2xl font-bold text-blue-500">
                {latestData.download_mbps.toFixed(1)} Mbps
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Latency</p>
              <p className="text-2xl font-bold">{latestData.latency_ms.toFixed(0)} ms</p>
            </div>
          </div>
        )}

        {/* Chart */}
        <div className="h-[300px]">
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
        </div>

        {!isConnected && (
          <p className="text-xs text-muted-foreground text-center mt-4">
            Showing simulated data. WebSocket connection not available.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
