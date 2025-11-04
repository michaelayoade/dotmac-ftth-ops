"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Activity,
  Server,
  Wifi,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";

interface RADIUSHealth {
  timestamp: number;
  status: string;
  checks: {
    radius_connectivity?: {
      status: string;
      message: string;
    };
    database?: {
      status: string;
      message: string;
      active_sessions: number;
    };
    nas_devices?: {
      status: string;
      count: number;
    };
    authentication?: {
      status: string;
      recent_failures: number;
      window_minutes: number;
    };
  };
}

interface RADIUSSubscriber {
  id: number;
  username: string;
  enabled: boolean;
  bandwidth_profile_id?: string | null;
  created_at: string;
  framed_ipv4_address?: string | null;
}

interface RADIUSSession {
  radacctid: number;
  username: string;
  acctsessionid: string;
  nasipaddress: string;
  framedipaddress?: string | null;
  acctstarttime?: string | null;
  acctinputoctets?: number | null;
  acctoutputoctets?: number | null;
}

export default function RADIUSPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch RADIUS health
  const { data: health, isLoading: healthLoading } = useQuery<RADIUSHealth>({
    queryKey: ["radius-health", refreshKey],
    queryFn: async () => {
      try {
        const response = await apiClient.get("/radius/health");
        return response.data;
      } catch (error) {
        logger.error("Failed to fetch RADIUS health", { error });
        throw error;
      }
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch subscribers summary
  const { data: subscribers } = useQuery<RADIUSSubscriber[]>({
    queryKey: ["radius-subscribers", refreshKey],
    queryFn: async () => {
      try {
        const response = await apiClient.get("/radius/subscribers", {
          params: { skip: 0, limit: 1000 },
        });
        return response.data;
      } catch (error) {
        logger.error("Failed to fetch RADIUS subscribers", { error });
        return [];
      }
    },
  });

  // Fetch active sessions
  const { data: sessions } = useQuery<RADIUSSession[]>({
    queryKey: ["radius-sessions", refreshKey],
    queryFn: async () => {
      try {
        const response = await apiClient.get("/radius/sessions");
        return response.data;
      } catch (error) {
        logger.error("Failed to fetch RADIUS sessions", { error });
        return [];
      }
    },
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  const totalSubscribers = subscribers?.length ?? 0;
  const activeSubscribers = subscribers?.filter((s) => s.enabled).length ?? 0;
  const disabledSubscribers = totalSubscribers - activeSubscribers;
  const activeSessions = sessions?.length ?? 0;

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const getStatusIcon = (status?: string) => {
    if (status === "healthy") {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
    return <AlertCircle className="h-5 w-5 text-yellow-500" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">RADIUS Management</h1>
          <p className="text-muted-foreground">
            Manage RADIUS subscribers, sessions, and authentication
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleRefresh} variant="outline">
            Refresh
          </Button>
          <Link href="/dashboard/radius/subscribers/new">
            <Button>Add Subscriber</Button>
          </Link>
        </div>
      </div>

      {/* Health Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>RADIUS Server Health</span>
            {health && getStatusIcon(health.status)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {healthLoading ? (
            <div className="text-muted-foreground">Loading health status...</div>
          ) : health ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* RADIUS Connectivity */}
              {health.checks.radius_connectivity && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(health.checks.radius_connectivity.status)}
                    <span className="font-medium">RADIUS Server</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {health.checks.radius_connectivity.message}
                  </p>
                </div>
              )}

              {/* Database */}
              {health.checks.database && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(health.checks.database.status)}
                    <span className="font-medium">Database</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {health.checks.database.message}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Active Sessions: {health.checks.database.active_sessions}
                  </p>
                </div>
              )}

              {/* NAS Devices */}
              {health.checks.nas_devices && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(health.checks.nas_devices.status)}
                    <span className="font-medium">NAS Devices</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {health.checks.nas_devices.count} devices registered
                  </p>
                </div>
              )}

              {/* Authentication */}
              {health.checks.authentication && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(health.checks.authentication.status)}
                    <span className="font-medium">Authentication</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {health.checks.authentication.recent_failures} failures (last{" "}
                    {health.checks.authentication.window_minutes}m)
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-destructive">Failed to load health status</div>
          )}
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Subscribers */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Subscribers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSubscribers}</div>
            <p className="text-xs text-muted-foreground">
              {activeSubscribers} active, {disabledSubscribers} disabled
            </p>
          </CardContent>
        </Card>

        {/* Active Sessions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSessions}</div>
            <p className="text-xs text-muted-foreground">
              {totalSubscribers > 0
                ? `${Math.round((activeSessions / totalSubscribers) * 100)}% of subscribers`
                : "No subscribers"}
            </p>
          </CardContent>
        </Card>

        {/* NAS Devices */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">NAS Devices</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {health?.checks.nas_devices?.count ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Routers, OLTs, and APs
            </p>
          </CardContent>
        </Card>

        {/* Bandwidth Usage */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bandwidth Usage</CardTitle>
            <Wifi className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sessions
                ? formatBytes(
                    sessions.reduce(
                      (sum, s) =>
                        sum + (s.acctinputoctets ?? 0) + (s.acctoutputoctets ?? 0),
                      0
                    )
                  )
                : "0 B"}
            </div>
            <p className="text-xs text-muted-foreground">
              Total data transferred
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/dashboard/radius/subscribers">
          <Card className="hover:bg-accent cursor-pointer transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Subscribers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Manage RADIUS authentication credentials and bandwidth profiles
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/radius/sessions">
          <Card className="hover:bg-accent cursor-pointer transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Active Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                View and manage active RADIUS sessions
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/radius/nas">
          <Card className="hover:bg-accent cursor-pointer transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                NAS Devices
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Configure Network Access Servers (routers, OLTs, APs)
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
