"use client";

import React, { useEffect, useState } from "react";
import { User, RefreshCw, Shield } from "lucide-react";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import { apiClient } from "@/lib/api/client";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@dotmac/ui";
import { formatDistanceToNow } from "date-fns";

type Session = {
  session_id: string;
  created_at?: string;
  ip_address?: string;
  user_agent?: string;
  current?: boolean;
  last_accessed?: string;
  is_current?: boolean;
};

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get("/auth/me/sessions");
      setSessions(res.data?.sessions || res.data || []);
    } catch (err: any) {
      setError("Failed to load sessions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSessions();
  }, []);

  const revokeSession = async (id: string) => {
    await apiClient.delete(`/auth/me/sessions/${id}`);
    void loadSessions();
  };

  const revokeAll = async () => {
    await apiClient.delete("/auth/me/sessions");
    void loadSessions();
  };

  return (
    <RouteGuard permission="security.manage">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="h-6 w-6 text-blue-500" />
            <div>
              <h1 className="text-2xl font-semibold">Active Sessions</h1>
              <p className="text-sm text-muted-foreground">Review devices and revoke access.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={revokeAll}>
            <Shield className="h-4 w-4 mr-2" />
            Revoke All
          </Button>
        </div>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Sessions</CardTitle>
            <Button variant="ghost" size="sm" onClick={loadSessions} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-muted-foreground">Loading sessions...</div>
            ) : error ? (
              <div className="text-destructive">{error}</div>
            ) : sessions.length === 0 ? (
              <div className="text-muted-foreground">No active sessions.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.session_id}>
                      <TableCell className="font-medium">
                        {session.user_agent || "Unknown"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {session.ip_address || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {session.last_accessed
                          ? `${formatDistanceToNow(new Date(session.last_accessed))} ago`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={session.is_current ? "default" : "outline"}>
                          {session.is_current ? "Current" : "Active"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {!session.is_current && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => revokeSession(session.session_id)}
                          >
                            Revoke
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </RouteGuard>
  );
}
