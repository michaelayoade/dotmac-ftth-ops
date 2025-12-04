/**
 * WebSocket Analytics Dashboard
 *
 * Displays real-time metrics for WebSocket connections including:
 * - Active connections
 * - Total messages sent
 * - Connection duration
 * - Per-tenant breakdown
 */

"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Activity, Users, MessageSquare, Clock, TrendingUp, Wifi } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { extractDataOrThrow } from "@/lib/api/response-helpers";

interface WebSocketAnalytics {
  uptime_seconds: number;
  uptime_formatted: string;
  total_active_connections: number;
  total_active_tenants: number;
  total_connections_lifetime: number;
  total_messages_sent: number;
  average_connection_duration_seconds: number;
  tenant_breakdown: Record<
    string,
    {
      active_connections: number;
      connection_ids: string[];
    }
  >;
}

export function WebSocketAnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<WebSocketAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch analytics
  const fetchAnalytics = async () => {
    try {
      const response = await apiClient.get<WebSocketAnalytics>(
        "/field-service/analytics/websocket-stats",
      );
      const data = extractDataOrThrow(response);
      setAnalytics(data);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch WebSocket analytics:", err);
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-refresh every 5 seconds
  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 5000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="p-6">
        <p className="text-gray-600">Loading analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-red-600">Error: {error}</p>
      </div>
    );
  }

  if (!analytics) {
    return null;
  }

  // Format average duration
  const avgDurationMinutes = Math.floor(analytics.average_connection_duration_seconds / 60);
  const avgDurationSeconds = Math.floor(analytics.average_connection_duration_seconds % 60);
  const avgDurationFormatted =
    avgDurationMinutes > 0
      ? `${avgDurationMinutes}m ${avgDurationSeconds}s`
      : `${avgDurationSeconds}s`;

  // Calculate messages per connection using lifetime totals to avoid zeroing out after quiet periods
  const hasLifetimeConnections = analytics.total_connections_lifetime > 0;
  const messagesPerConnection = hasLifetimeConnections
    ? Math.round(analytics.total_messages_sent / analytics.total_connections_lifetime)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Activity className="h-6 w-6 text-blue-600" />
            WebSocket Analytics
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Real-time connection metrics and performance data
          </p>
        </div>
        <Badge variant="default" className="text-sm">
          🟢 Live • Updates every 5s
        </Badge>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Connections */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
              <Wifi className="h-4 w-4" />
              Active Connections
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {analytics.total_active_connections}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Across {analytics.total_active_tenants} tenant
              {analytics.total_active_tenants !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        {/* Total Messages */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Messages Sent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {analytics.total_messages_sent.toLocaleString()}
            </div>
            <p className="text-xs text-gray-500 mt-1">~{messagesPerConnection} per connection</p>
          </CardContent>
        </Card>

        {/* Uptime */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Uptime
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">{analytics.uptime_formatted}</div>
            <p className="text-xs text-gray-500 mt-1">Since server start</p>
          </CardContent>
        </Card>

        {/* Lifetime Connections */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Total Connections
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">
              {analytics.total_connections_lifetime}
            </div>
            <p className="text-xs text-gray-500 mt-1">Lifetime total</p>
          </CardContent>
        </Card>
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Connection Duration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Average Connection Duration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-indigo-600">{avgDurationFormatted}</span>
              <span className="text-sm text-gray-500">per connection</span>
            </div>
            <div className="mt-4 pt-4 border-t">
              <div className="text-sm text-gray-600">
                This represents how long connections stay active on average. Longer durations
                indicate stable connections and engaged users.
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Per-Tenant Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Per-Tenant Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(analytics.tenant_breakdown).length === 0 ? (
              <p className="text-sm text-gray-500">No active connections</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(analytics.tenant_breakdown).map(([tenantId, stats]) => (
                  <div key={tenantId} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate max-w-[200px]">
                        {tenantId.substring(0, 8)}...
                      </span>
                    </div>
                    <Badge variant="secondary">
                      {stats.active_connections} connection
                      {stats.active_connections !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Performance Indicators */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Message Throughput */}
            <div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                Message Throughput
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {analytics.uptime_seconds > 0
                  ? Math.round(analytics.total_messages_sent / (analytics.uptime_seconds / 60))
                  : 0}
                <span className="text-sm font-normal text-gray-500 ml-1">msg/min</span>
              </div>
            </div>

            {/* Connection Success Rate */}
            <div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                Connection Retention
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {analytics.total_connections_lifetime > 0
                  ? Math.round(
                      (analytics.total_active_connections / analytics.total_connections_lifetime) *
                        100,
                    )
                  : 0}
                <span className="text-sm font-normal text-gray-500 ml-1">%</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {analytics.total_active_connections} active of{" "}
                {analytics.total_connections_lifetime} total
              </p>
            </div>

            {/* Connections per Tenant */}
            <div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                Avg Connections/Tenant
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {analytics.total_active_tenants > 0
                  ? Math.round(analytics.total_active_connections / analytics.total_active_tenants)
                  : 0}
                <span className="text-sm font-normal text-gray-500 ml-1">per tenant</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
