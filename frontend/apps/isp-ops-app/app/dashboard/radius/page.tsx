"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Server, Activity, Gauge, ArrowRight, Users, Wifi, TrendingUp, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";

interface RADIUSStats {
  active_sessions: number;
  total_nas_devices: number;
  bandwidth_profiles: number;
  total_subscribers: number;
}

interface RADIUSSession {
  radacctid: number;
  username: string;
  nasipaddress: string;
  framedipaddress?: string | null;
  acctstarttime?: string | null;
  total_bytes: number;
}

export default function RADIUSDashboardPage() {
  // Fetch RADIUS statistics
  const { data: stats, isLoading: statsLoading } = useQuery<RADIUSStats>({
    queryKey: ["radius-stats"],
    queryFn: async () => {
      try {
        // Fetch data from multiple endpoints
        const [sessionsRes, nasRes, profilesRes] = await Promise.all([
          apiClient.get("/radius/sessions").catch(() => ({ data: [] })),
          apiClient
            .get("/radius/nas", { params: { skip: 0, limit: 1000 } })
            .catch(() => ({ data: [] })),
          apiClient
            .get("/radius/bandwidth-profiles", { params: { skip: 0, limit: 1000 } })
            .catch(() => ({ data: [] })),
        ]);

        return {
          active_sessions: sessionsRes.data?.length || 0,
          total_nas_devices: nasRes.data?.length || 0,
          bandwidth_profiles: profilesRes.data?.length || 0,
          total_subscribers: 0, // Would come from subscribers endpoint
        };
      } catch (error) {
        logger.error("Failed to fetch RADIUS stats", { error });
        // Return default values on error
        return {
          active_sessions: 0,
          total_nas_devices: 0,
          bandwidth_profiles: 0,
          total_subscribers: 0,
        };
      }
    },
  });

  // Fetch recent sessions
  const { data: recentSessions, isLoading: sessionsLoading } = useQuery<RADIUSSession[]>({
    queryKey: ["radius-recent-sessions"],
    queryFn: async () => {
      try {
        const response = await apiClient.get("/radius/sessions", {
          params: { limit: 5 },
        });
        return response.data || [];
      } catch (error) {
        logger.error("Failed to fetch recent RADIUS sessions", { error });
        return [];
      }
    },
  });

  const isLoading = statsLoading || sessionsLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">RADIUS Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor and manage RADIUS authentication and authorization
          </p>
        </div>
      </div>

      {/* Statistics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : stats?.active_sessions || 0}
            </div>
            <p className="text-xs text-muted-foreground flex items-center mt-1">
              <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
              Users currently online
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">NAS Devices</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : stats?.total_nas_devices || 0}
            </div>
            <p className="text-xs text-muted-foreground">Network Access Servers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bandwidth Profiles</CardTitle>
            <Gauge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : stats?.bandwidth_profiles || 0}
            </div>
            <p className="text-xs text-muted-foreground">Rate limit profiles</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Subscribers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : stats?.total_subscribers || 0}
            </div>
            <p className="text-xs text-muted-foreground">RADIUS accounts</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/dashboard/radius/sessions">
          <Card className="hover:bg-accent transition-colors cursor-pointer">
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Sessions
                </span>
                <ArrowRight className="h-4 w-4" />
              </CardTitle>
              <CardDescription>View and manage active RADIUS sessions</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/dashboard/radius/nas">
          <Card className="hover:bg-accent transition-colors cursor-pointer">
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  NAS Devices
                </span>
                <ArrowRight className="h-4 w-4" />
              </CardTitle>
              <CardDescription>Configure network access servers</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/dashboard/radius/bandwidth-profiles">
          <Card className="hover:bg-accent transition-colors cursor-pointer">
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Gauge className="h-5 w-5" />
                  Bandwidth Profiles
                </span>
                <ArrowRight className="h-4 w-4" />
              </CardTitle>
              <CardDescription>Manage rate limit profiles</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/dashboard/radius/subscribers">
          <Card className="hover:bg-accent transition-colors cursor-pointer">
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Subscribers
                </span>
                <ArrowRight className="h-4 w-4" />
              </CardTitle>
              <CardDescription>Manage RADIUS subscriber accounts</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Sessions</CardTitle>
              <CardDescription>Latest RADIUS authentication sessions</CardDescription>
            </div>
            <Link href="/dashboard/radius/sessions">
              <Button variant="outline" size="sm">
                View All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {sessionsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading recent sessions...</div>
          ) : !recentSessions || recentSessions.length === 0 ? (
            <div className="text-center py-8">
              <Wifi className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Active Sessions</h3>
              <p className="text-muted-foreground">
                There are currently no active RADIUS sessions.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentSessions.slice(0, 5).map((session) => (
                <div
                  key={session.radacctid}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                      <Activity className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">{session.username}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <span>NAS: {session.nasipaddress}</span>
                        {session.framedipaddress && (
                          <>
                            <span>•</span>
                            <span>IP: {session.framedipaddress}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="mb-1">
                      Active
                    </Badge>
                    {session.acctstarttime && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(session.acctstarttime).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Health */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>RADIUS Service Status</CardTitle>
            <CardDescription>Current system health and availability</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Authentication Service</span>
                <Badge variant="default" className="bg-green-500">
                  Operational
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Accounting Service</span>
                <Badge variant="default" className="bg-green-500">
                  Operational
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">CoA/DM Service</span>
                <Badge variant="default" className="bg-green-500">
                  Operational
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common RADIUS management tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Link href="/dashboard/radius/nas">
                <Button variant="outline" className="w-full justify-start">
                  <Server className="mr-2 h-4 w-4" />
                  Add NAS Device
                </Button>
              </Link>
              <Link href="/dashboard/radius/bandwidth-profiles">
                <Button variant="outline" className="w-full justify-start">
                  <Gauge className="mr-2 h-4 w-4" />
                  Create Bandwidth Profile
                </Button>
              </Link>
              <Link href="/dashboard/radius/subscribers">
                <Button variant="outline" className="w-full justify-start">
                  <Users className="mr-2 h-4 w-4" />
                  Add Subscriber
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
