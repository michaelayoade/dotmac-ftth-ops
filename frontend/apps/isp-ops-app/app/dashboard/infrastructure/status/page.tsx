"use client";

import { useMemo } from "react";
import { RefreshCw, AlertTriangle, CheckCircle, ShieldAlert, Activity } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Badge,
} from "@dotmac/ui";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import { useHealth } from "@/hooks/useHealth";
import { useSystemHealth } from "@/hooks/useOperations";
import { useNetboxHealth } from "@/hooks/useNetworkInventory";
import { useRBAC } from "@/contexts/RBACContext";
import { useAppConfig } from "@/providers/AppConfigContext";

type NormalizedStatus = "healthy" | "degraded" | "unhealthy" | "unknown";

interface ServiceStatusRow {
  id: string;
  name: string;
  status: NormalizedStatus;
  message?: string;
  required?: boolean;
  source: "core" | "system" | "network";
}

function statusColor(status: NormalizedStatus): string {
  switch (status) {
    case "healthy":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    case "degraded":
      return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
    case "unhealthy":
      return "bg-red-500/10 text-red-400 border-red-500/20";
    default:
      return "bg-muted text-muted-foreground border-border/60";
  }
}

function statusIcon(status: NormalizedStatus) {
  switch (status) {
    case "healthy":
      return CheckCircle;
    case "degraded":
      return AlertTriangle;
    case "unhealthy":
      return ShieldAlert;
    default:
      return Activity;
  }
}

export default function InfrastructureStatusPage() {
  const { hasPermission } = useRBAC();
  const { health, loading: healthLoading, error: healthError, refreshHealth } = useHealth();
  const {
    data: systemHealth,
    isLoading: systemLoading,
    refetch: refetchSystemHealth,
  } = useSystemHealth();

  const { features } = useAppConfig();
  const shouldQueryNetbox = features.enableNetwork && hasPermission("isp.ipam.read");

  const {
    data: netboxHealth,
    isLoading: netboxLoading,
    refetch: refetchNetbox,
  } = useNetboxHealth({
    enabled: shouldQueryNetbox,
  });

  const overallStatus: NormalizedStatus = useMemo(() => {
    if (health?.status) {
      const normalized = health.status.toLowerCase();
      if (normalized === "healthy" || normalized === "degraded" || normalized === "unhealthy") {
        return normalized as NormalizedStatus;
      }
    }
    if (systemHealth?.status) {
      return systemHealth.status;
    }
    return "unknown";
  }, [health?.status, systemHealth?.status]);

  const lastUpdated = useMemo(() => {
    const timestamps = [
      health?.timestamp ? new Date(health.timestamp) : null,
      systemHealth?.timestamp ? new Date(systemHealth.timestamp) : null,
    ].filter(Boolean) as Date[];
    if (timestamps.length === 0) {
      return null;
    }
    timestamps.sort((a, b) => b.getTime() - a.getTime());
    return timestamps[0];
  }, [health?.timestamp, systemHealth?.timestamp]);

  const services: ServiceStatusRow[] = useMemo(() => {
    const rows: ServiceStatusRow[] = [];

    if (health?.services?.length) {
      rows.push(
        ...health.services.map((service, index) => {
          const normalized =
            service.status === "healthy" ||
            service.status === "degraded" ||
            service.status === "unhealthy"
              ? service.status
              : "unknown";
          return {
            id: `core-${service.name}-${index}`,
            name: service.name,
            status: normalized as NormalizedStatus,
            message: service.message,
            required: service.required,
            source: "core" as const,
          };
        }),
      );
    }

    if (systemHealth?.checks) {
      rows.push(
        ...Object.entries(systemHealth.checks).map(([key, check]) => ({
          id: `system-${key}`,
          name: check?.name ?? key,
          status: check?.status ?? "unknown",
          message: check?.message,
          required: check?.required,
          source: "system" as const,
        })),
      );
    }

    if (shouldQueryNetbox) {
      rows.push({
        id: "network-netbox",
        name: "NetBox",
        status: netboxHealth ? (netboxHealth.healthy ? "healthy" : "unhealthy") : "unknown",
        message: netboxHealth?.message ?? "NetBox connectivity for this tenant",
        required: false,
        source: "network",
      });
    }

    return rows;
  }, [health?.services, netboxHealth, shouldQueryNetbox, systemHealth?.checks]);

  const isLoading = healthLoading || systemLoading || (shouldQueryNetbox && netboxLoading);

  const handleRefresh = async () => {
    refreshHealth();
    refetchSystemHealth();
    if (shouldQueryNetbox) {
      refetchNetbox();
    }
  };

  return (
    <RouteGuard permission="infrastructure.read">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Infrastructure Status</h1>
            <p className="text-sm text-muted-foreground">
              Live view of platform and Docker-backed service health.
            </p>
            {lastUpdated && (
              <p className="mt-2 text-xs text-muted-foreground">
                Last updated {lastUpdated.toLocaleString()}
              </p>
            )}
          </div>
          <Button onClick={handleRefresh} variant="outline" size="sm" disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : "hidden"}`} />
            {isLoading ? "Refreshing…" : "Refresh"}
          </Button>
        </div>

        {healthError && (
          <div className="rounded-lg border border-border bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {healthError}
          </div>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Overall Status</CardTitle>
              <CardDescription>
                Aggregated health across core infrastructure services.
              </CardDescription>
            </div>
            <Badge className={`border ${statusColor(overallStatus)}`} variant="outline">
              {overallStatus.toUpperCase()}
            </Badge>
          </CardHeader>
          <CardContent>
            {services.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No service information available. Try refreshing or verify your permissions.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {services.map((service) => {
                  const Icon = statusIcon(service.status);
                  return (
                    <div
                      key={service.id}
                      className="rounded-lg border border-border bg-card/60 p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={`rounded-md border px-2 py-1 text-xs font-medium ${statusColor(service.status)}`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{service.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {service.source}
                            </p>
                          </div>
                        </div>
                        <Badge
                          className={`border ${statusColor(service.status)}`}
                          variant="outline"
                        >
                          {service.status.toUpperCase()}
                        </Badge>
                      </div>
                      {service.message && (
                        <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                          {service.message}
                        </p>
                      )}
                      {service.required === false && (
                        <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                          optional service
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Core Service Detail</CardTitle>
              <CardDescription>
                Status reported by the backend `/ready` and `/health` endpoints.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {services.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Service data unavailable. Ensure the platform backend is reachable.
                </p>
              ) : (
                <div className="space-y-3">
                  {services.map((service) => (
                    <div
                      key={`detail-${service.id}`}
                      className="flex items-start justify-between gap-3 rounded-md border border-border/80 bg-card/70 p-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">{service.name}</p>
                        <p className="text-xs text-muted-foreground">Source: {service.source}</p>
                        {service.message && (
                          <p className="mt-1 text-xs text-muted-foreground">{service.message}</p>
                        )}
                      </div>
                      <Badge className={`border ${statusColor(service.status)}`} variant="outline">
                        {service.status.toUpperCase()}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Troubleshooting</CardTitle>
              <CardDescription>Quick steps if a service is down or degraded.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div>
                <p className="font-medium text-foreground">1. Check Docker containers</p>
                <p className="text-xs">
                  Run <code className="rounded bg-muted px-1 py-0.5 text-xs">docker ps</code> to
                  confirm containers are running and healthy.
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground">2. Inspect logs</p>
                <p className="text-xs">
                  Use{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">
                    docker logs &lt;container&gt;
                  </code>{" "}
                  or the built-in infrastructure logs dashboard.
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground">3. Verify tenant OSS config</p>
                <p className="text-xs">
                  Ensure each tenant has the required OSS entries (e.g., NetBox credentials) in{" "}
                  <code>tenant_settings</code>.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </RouteGuard>
  );
}
