"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Progress } from "@dotmac/ui";
import {
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Clock,
  Zap,
  Loader2,
} from "lucide-react";
import { useHealth } from "@/hooks/useHealth";

export default function HealthPage() {
  const { health, loading, error, refreshHealth } = useHealth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshHealth();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Map backend service names to friendly names with default uptime
  const mapServiceName = (name: string) => {
    const serviceMap: Record<string, string> = {
      Database: "Database",
      Redis: "Redis Cache",
      "Celery broker": "Background Jobs",
      "Celery result backend": "Task Results",
      Vault: "Secrets Vault",
    };
    return serviceMap[name] || name;
  };

  const services =
    health?.services.map((service) => ({
      name: mapServiceName(service.name),
      status: service.status,
      uptime: service.uptime || 0,
      responseTime: service.responseTime || 0,
      lastCheck: service.lastCheck || "just now",
      message: service.message,
    })) || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "text-green-600 dark:text-green-400";
      case "degraded":
        return "text-yellow-600 dark:text-yellow-400";
      case "unhealthy":
        return "text-red-600 dark:text-red-400";
      default:
        return "text-muted-foreground";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />;
      case "degraded":
        return <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />;
      case "unhealthy":
        return <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />;
      default:
        return <AlertCircle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const healthyServices = services.filter((s) => s.status === "healthy").length;
  const degradedServices = services.filter((s) => s.status === "degraded").length;
  const unhealthyServices = services.filter((s) => s.status === "unhealthy").length;

  // Show loading state on initial load
  if (loading && !health) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-sky-500" />
          <p className="text-muted-foreground">Loading health data...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error && !health) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Failed to Load Health Data</h3>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">System Health</h1>
          <p className="text-muted-foreground mt-2">
            Monitor service status and system metrics (Live Data)
          </p>
          {health?.timestamp && (
            <p className="text-xs text-muted-foreground mt-1">
              Last updated: {new Date(health.timestamp).toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={handleRefresh} disabled={isRefreshing || loading} size="sm">
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isRefreshing || loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overall Health Status */}
      <Card>
        <CardHeader>
          <CardTitle>Overall System Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {health?.healthy ? (
                <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
              ) : unhealthyServices > 0 ? (
                <XCircle className="h-12 w-12 text-red-600 dark:text-red-400" />
              ) : (
                <AlertCircle className="h-12 w-12 text-yellow-600 dark:text-yellow-400" />
              )}
              <div>
                <div className="text-2xl font-bold">
                  {health?.healthy
                    ? "All Systems Operational"
                    : unhealthyServices > 0
                      ? "Critical Issues"
                      : "Degraded Performance"}
                </div>
                <div className="text-sm text-muted-foreground">
                  {healthyServices} healthy, {degradedServices} degraded, {unhealthyServices}{" "}
                  unhealthy
                </div>
                {health?.failed_services && health.failed_services.length > 0 && (
                  <div className="text-sm text-red-600 dark:text-red-400 mt-1">
                    Failed: {health.failed_services.join(", ")}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-8">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {healthyServices}
                </div>
                <div className="text-sm text-muted-foreground">Healthy</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {degradedServices}
                </div>
                <div className="text-sm text-muted-foreground">Degraded</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {unhealthyServices}
                </div>
                <div className="text-sm text-muted-foreground">Unhealthy</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {services.map((service) => (
          <Card key={service.name}>
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="flex items-start gap-3">
                  {getStatusIcon(service.status)}
                  <div>
                    <h3 className="font-semibold">{service.name}</h3>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {service.lastCheck}
                      </span>
                      {service.uptime > 0 && (
                        <span className="flex items-center gap-1">
                          <Activity className="h-3 w-3" />
                          {service.uptime}% uptime
                        </span>
                      )}
                      {service.responseTime > 0 && (
                        <span className="flex items-center gap-1">
                          <Zap className="h-3 w-3" />
                          {service.responseTime}ms
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Badge
                  variant={
                    service.status === "healthy"
                      ? "default"
                      : service.status === "degraded"
                        ? "secondary"
                        : "destructive"
                  }
                >
                  {service.status}
                </Badge>
              </div>
              {service.uptime > 0 && (
                <div className="mt-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Uptime</span>
                    <span>{service.uptime}%</span>
                  </div>
                  <Progress value={service.uptime} className="h-2" />
                </div>
              )}
              {service.message && (
                <div className="mt-2 text-sm text-muted-foreground">{service.message}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
