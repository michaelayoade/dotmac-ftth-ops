"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import { Users, Wifi, RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import { useWebSocket, useWebSocketSubscription } from "@/lib/websocket/WebSocketProvider";
import { formatDistanceToNow } from "date-fns";

interface ActiveSession {
  session_id: string;
  username: string;
  ip_address: string;
  nas_ip_address: string;
  upload_bytes: number;
  download_bytes: number;
  session_time_seconds: number;
  last_update: string;
}

interface SessionUpdate {
  action: "new" | "update" | "terminate";
  session: ActiveSession;
}

export function LiveSessionMonitor() {
  const { isConnected } = useWebSocket();
  const [sessionUpdate] = useWebSocketSubscription<SessionUpdate>("session_update");
  const [activeSessions, setActiveSessions] = useState<Map<string, ActiveSession>>(new Map());
  const [recentChange, setRecentChange] = useState<"increase" | "decrease" | null>(null);

  // Handle session updates
  useEffect(() => {
    if (sessionUpdate) {
      setActiveSessions((prev) => {
        const newSessions = new Map(prev);

        if (sessionUpdate.action === "new" || sessionUpdate.action === "update") {
          newSessions.set(sessionUpdate.session.session_id, sessionUpdate.session);
          setRecentChange("increase");
        } else if (sessionUpdate.action === "terminate") {
          newSessions.delete(sessionUpdate.session.session_id);
          setRecentChange("decrease");
        }

        return newSessions;
      });

      // Clear change indicator after 2 seconds
      setTimeout(() => setRecentChange(null), 2000);
    }
  }, [sessionUpdate]);

  const sessionsArray = Array.from(activeSessions.values()).sort(
    (a, b) => b.session_time_seconds - a.session_time_seconds,
  );

  const totalUpload = sessionsArray.reduce((sum, s) => sum + s.upload_bytes, 0);
  const totalDownload = sessionsArray.reduce((sum, s) => sum + s.download_bytes, 0);

  const formatBytes = (bytes: number): string => {
    const gb = bytes / (1024 * 1024 * 1024);
    const mb = bytes / (1024 * 1024);

    if (gb >= 1) {
      return `${gb.toFixed(2)} GB`;
    }
    return `${mb.toFixed(2)} MB`;
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };

  if (!isConnected && sessionsArray.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Live Session Monitor
          </CardTitle>
          <CardDescription>Waiting for a live session stream…</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            WebSocket connection is offline. Once telemetry resumes, active sessions will appear
            here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Active Sessions
              {recentChange && (
                <span className="inline-flex items-center gap-1">
                  {recentChange === "increase" ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  )}
                </span>
              )}
            </CardTitle>
            <CardDescription>Real-time monitoring of active user sessions</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={isConnected ? "default" : "secondary"}
              className="flex items-center gap-1"
              data-testid="connection-status-badge"
            >
              <Wifi className="h-3 w-3" aria-hidden="true" />
              <span data-testid="connection-status-label">
                {isConnected ? "Live" : "Simulated"}
              </span>
            </Badge>
            <Badge variant="outline" data-testid="session-count-badge">
              {activeSessions.size} {activeSessions.size === 1 ? "session" : "sessions"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Active Users</p>
            <p className="text-2xl font-bold" data-testid="active-users-count">
              {activeSessions.size}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total Upload</p>
            <p className="text-2xl font-bold text-green-500" data-testid="total-upload">
              {formatBytes(totalUpload)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total Download</p>
            <p className="text-2xl font-bold text-blue-500" data-testid="total-download">
              {formatBytes(totalDownload)}
            </p>
          </div>
        </div>

        {/* Sessions Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead className="text-right">Upload</TableHead>
                <TableHead className="text-right">Download</TableHead>
                <TableHead className="text-right">Duration</TableHead>
                <TableHead className="text-right">Last Update</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessionsArray.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No active sessions
                  </TableCell>
                </TableRow>
              ) : (
                sessionsArray.map((session) => (
                  <TableRow key={session.session_id}>
                    <TableCell className="font-medium">{session.username}</TableCell>
                    <TableCell className="font-mono text-xs">{session.ip_address}</TableCell>
                    <TableCell className="text-right text-green-600">
                      <span data-testid={`session-upload-${session.session_id}`}>
                        {formatBytes(session.upload_bytes)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-blue-600">
                      <span data-testid={`session-download-${session.session_id}`}>
                        {formatBytes(session.download_bytes)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span data-testid={`session-duration-${session.session_id}`}>
                        {formatDuration(session.session_time_seconds)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(session.last_update), {
                        addSuffix: true,
                      })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {!isConnected && (
          <p className="text-xs text-muted-foreground text-center mt-4">
            Showing simulated data. Connect to WebSocket for live updates.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
