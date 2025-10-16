"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

  // Simulate session updates if WebSocket not connected
  useEffect(() => {
    if (!isConnected) {
      // Initialize with some mock sessions
      const mockSessions: ActiveSession[] = [
        {
          session_id: "sess_1",
          username: "john.doe@example.com",
          ip_address: "10.0.0.101",
          nas_ip_address: "10.1.1.1",
          upload_bytes: 1024 * 1024 * 50,
          download_bytes: 1024 * 1024 * 200,
          session_time_seconds: 3600,
          last_update: new Date().toISOString(),
        },
        {
          session_id: "sess_2",
          username: "jane.smith@example.com",
          ip_address: "10.0.0.102",
          nas_ip_address: "10.1.1.2",
          upload_bytes: 1024 * 1024 * 30,
          download_bytes: 1024 * 1024 * 150,
          session_time_seconds: 1800,
          last_update: new Date().toISOString(),
        },
        {
          session_id: "sess_3",
          username: "bob.johnson@example.com",
          ip_address: "10.0.0.103",
          nas_ip_address: "10.1.1.1",
          upload_bytes: 1024 * 1024 * 100,
          download_bytes: 1024 * 1024 * 500,
          session_time_seconds: 7200,
          last_update: new Date().toISOString(),
        },
      ];

      const initialSessions = new Map(
        mockSessions.map((s) => [s.session_id, s])
      );
      setActiveSessions(initialSessions);

      // Simulate random updates
      const interval = setInterval(() => {
        setActiveSessions((prev) => {
          const newSessions = new Map(prev);
          const sessions = Array.from(newSessions.values());

          if (sessions.length > 0) {
            // Update a random session
            const randomSession = sessions[Math.floor(Math.random() * sessions.length)];
            randomSession.upload_bytes += Math.random() * 1024 * 1024 * 5;
            randomSession.download_bytes += Math.random() * 1024 * 1024 * 10;
            randomSession.session_time_seconds += 5;
            randomSession.last_update = new Date().toISOString();
            newSessions.set(randomSession.session_id, randomSession);
          }

          return newSessions;
        });
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [isConnected]);

  const sessionsArray = Array.from(activeSessions.values()).sort(
    (a, b) => b.session_time_seconds - a.session_time_seconds
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
            <CardDescription>
              Real-time monitoring of active user sessions
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={isConnected ? "default" : "secondary"}
              className="flex items-center gap-1"
            >
              <Wifi className="h-3 w-3" />
              {isConnected ? "Live" : "Simulated"}
            </Badge>
            <Badge variant="outline">
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
            <p className="text-2xl font-bold">
              {activeSessions.size}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total Upload</p>
            <p className="text-2xl font-bold text-green-500">
              {formatBytes(totalUpload)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total Download</p>
            <p className="text-2xl font-bold text-blue-500">
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
                    <TableCell className="font-medium">
                      {session.username}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {session.ip_address}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      {formatBytes(session.upload_bytes)}
                    </TableCell>
                    <TableCell className="text-right text-blue-600">
                      {formatBytes(session.download_bytes)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatDuration(session.session_time_seconds)}
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
