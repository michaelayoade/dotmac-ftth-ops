"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { useRBAC } from "@/contexts/RBACContext";
import { useSystemHealth } from "@/hooks/useOperations";
import { useServiceInstances, useServiceStatistics } from "@/hooks/useServiceLifecycle";
import { useRADIUSSessions, useRADIUSSubscribers } from "@/hooks/useRADIUS";
import { useNetboxHealth, useNetboxSites } from "@/hooks/useNetworkInventory";
import { useAppConfig } from "@/providers/AppConfigContext";
import { useFeatureFlag } from "@/lib/feature-flags";
import { ROUTES } from "@/lib/routes";
import { isAuthBypassEnabled, useSession } from "@shared/lib/auth";
import type { UserInfo } from "@shared/lib/auth";
import { useSubscriberDashboardGraphQL } from "@/hooks/useSubscriberDashboardGraphQL";

type DisplayUser = Pick<UserInfo, "email" | "roles">;

function formatDate(value?: string | null): string {
  if (!value) {
    return "—";
  }
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const { hasPermission } = useRBAC();
  const { user: sessionUser, isLoading: authLoading, isAuthenticated } = useSession();
  const user = sessionUser as DisplayUser | undefined;
  const authBypassEnabled = isAuthBypassEnabled();

  // Feature flags
  const { enabled: radiusSessionsEnabled } = useFeatureFlag("radius-sessions");
  const { enabled: radiusSubscribersEnabled } = useFeatureFlag("radius-subscribers");

  const { features } = useAppConfig();
  const allowNetworkCalls = !authBypassEnabled;
  const hasRadiusAccess =
    allowNetworkCalls && features.enableRadius && hasPermission("isp.radius.read");
  const hasNetworkAccess =
    allowNetworkCalls && features.enableNetwork && hasPermission("isp.ipam.read");
  const hasLifecycleAccess =
    allowNetworkCalls && features.enableAutomation && hasPermission("isp.automation.read");

  const { data: serviceStats, isLoading: serviceStatsLoading } = useServiceStatistics({
    enabled: hasLifecycleAccess,
  });
  const { data: provisioningServices, isLoading: provisioningLoading } = useServiceInstances({
    status: "provisioning",
    limit: 5,
    enabled: hasLifecycleAccess,
  });

  // RADIUS data - controlled by feature flags
  const { data: radiusSubscribers, isLoading: subscribersLoading } = useRADIUSSubscribers(0, 5, {
    enabled: hasRadiusAccess && radiusSubscribersEnabled,
  });
  const { data: activeSessions, isLoading: sessionsLoading } = useRADIUSSessions(0, 100, {
    enabled: hasRadiusAccess && radiusSessionsEnabled,
  });

  const { metrics: subscriberMetrics } = useSubscriberDashboardGraphQL({
    limit: 5,
    enabled: hasRadiusAccess && radiusSubscribersEnabled,
    pollingEnabled: false,
  });

  const { data: netboxHealth } = useNetboxHealth({
    enabled: hasNetworkAccess,
  });
  const { data: netboxSites } = useNetboxSites({
    limit: 5,
    enabled: hasNetworkAccess,
  });

  const { data: systemHealth } = useSystemHealth({ enabled: allowNetworkCalls });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace(ROUTES.LOGIN);
    }
  }, [authLoading, isAuthenticated, router]);

  const numberFormatter = useMemo(() => new Intl.NumberFormat("en-US"), []);

  const totalSubscribers =
    subscriberMetrics.totalSubscribers ??
    radiusSubscribers?.total ??
    radiusSubscribers?.data?.length ??
    0;
  const activeSubscribers =
    subscriberMetrics.enabledSubscribers ??
    radiusSubscribers?.data?.filter((subscriber) => subscriber.enabled).length ??
    0;
  const activeSessionsCount =
    subscriberMetrics.activeSessions ?? activeSessions?.total ?? activeSessions?.data?.length ?? 0;

  const summaryCards = [
    {
      title: "Active Subscribers",
      value: hasRadiusAccess ? numberFormatter.format(activeSubscribers) : "—",
      subtitle: hasRadiusAccess
        ? `of ${numberFormatter.format(totalSubscribers)} subscribers tracked`
        : "Access requires isp.radius.read",
    },
    {
      title: "Active Services",
      value: serviceStats ? numberFormatter.format(serviceStats.active_count) : "—",
      subtitle: serviceStats
        ? `${numberFormatter.format(serviceStats.provisioning_count)} provisioning`
        : "Lifecycle stats unavailable",
    },
    {
      title: "Active Sessions",
      value: hasRadiusAccess ? numberFormatter.format(activeSessionsCount) : "—",
      subtitle: hasRadiusAccess ? "Live PPPoE / RADIUS sessions" : "RADIUS feature disabled",
    },
    {
      title: "Network Health",
      value: netboxHealth ? (netboxHealth.healthy ? "Healthy" : "Degraded") : "—",
      subtitle: netboxHealth?.message ?? "NetBox connectivity",
    },
  ];

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading network operations center…</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="bg-card/50 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col gap-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Network Operations Center</h1>
              <p className="text-sm text-muted-foreground">
                Real-time visibility into subscribers, network health, and provisioning pipelines.
              </p>
            </div>
            {user && (
              <div className="text-sm text-muted-foreground hidden sm:block">
                <div className="font-medium text-foreground">{user.email}</div>
                <div>{user.roles?.join(", ") || "Operator"}</div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/subscribers"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              Subscribers
            </Link>
            <Link
              href="/dashboard/network"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              Network
            </Link>
            <Link
              href="/dashboard/automation"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              Automation
            </Link>
            <Link
              href="/dashboard/billing-revenue"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              Business Ops
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-12 space-y-10">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <Card key={card.title} className="border-border/60 bg-card/60 backdrop-blur">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold text-foreground">{card.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-8 lg:grid-cols-2">
          <Card className="border-border/60 bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle>Recent subscribers</CardTitle>
              <CardDescription>Latest access accounts synced from FreeRADIUS.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {hasRadiusAccess ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Bandwidth Profile</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subscribersLoading && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          Loading subscribers…
                        </TableCell>
                      </TableRow>
                    )}
                    {!subscribersLoading && (radiusSubscribers?.data?.length ?? 0) === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          No subscribers found.
                        </TableCell>
                      </TableRow>
                    )}
                    {radiusSubscribers?.data?.map((subscriber) => (
                      <TableRow key={subscriber.id}>
                        <TableCell className="font-medium">{subscriber.username}</TableCell>
                        <TableCell>
                          <Badge variant={subscriber.enabled ? "outline" : "secondary"}>
                            {subscriber.enabled ? "Enabled" : "Disabled"}
                          </Badge>
                        </TableCell>
                        <TableCell>{subscriber.bandwidth_profile_id ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(subscriber.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Radius access is disabled for your role. Contact an administrator to request{" "}
                  <code>isp.radius.read</code>.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle>Provisioning pipeline</CardTitle>
              <CardDescription>
                Live service activation jobs by lifecycle orchestration.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {hasLifecycleAccess ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {provisioningLoading && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          Loading provisioning queue…
                        </TableCell>
                      </TableRow>
                    )}
                    {!provisioningLoading && (provisioningServices?.length ?? 0) === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          No provisioning workflows in progress.
                        </TableCell>
                      </TableRow>
                    )}
                    {provisioningServices?.map((service) => (
                      <TableRow key={service.id}>
                        <TableCell className="font-medium">{service.service_name}</TableCell>
                        <TableCell className="uppercase text-xs tracking-wide text-muted-foreground">
                          {service.service_type.replace(/_/g, " ")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {service.provisioning_status ?? service.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(service.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Service lifecycle automation is currently disabled for this tenant.
                </p>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-8 lg:grid-cols-2">
          <Card className="border-border/60 bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle>Network inventory</CardTitle>
              <CardDescription>
                Snapshot of NetBox sites and health for the active tenant.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {hasNetworkAccess ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={netboxHealth?.healthy ? "outline" : "destructive"}
                      className="uppercase tracking-wide"
                    >
                      {netboxHealth?.healthy ? "Healthy" : "Degraded"}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {netboxHealth?.message ?? "Awaiting health signal"}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Sites</p>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {netboxSites?.slice(0, 5).map((site) => (
                        <li key={site.id} className="flex items-center justify-between">
                          <span className="font-medium text-foreground">{site.name}</span>
                          <span>
                            {site.physical_address || site.facility || "No address on file"}
                          </span>
                        </li>
                      ))}
                      {!netboxSites?.length && <li>No sites returned from NetBox.</li>}
                    </ul>
                    <Link
                      className="text-sm text-primary hover:underline"
                      href="/dashboard/network"
                    >
                      View network overview →
                    </Link>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Network inventory requires <code>isp.ipam.read</code>. Contact your administrator
                  to enable NetBox access.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle>Platform health</CardTitle>
              <CardDescription>Aggregated health status across core services.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Overall status</p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="outline">{systemHealth?.status ?? "unknown"}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {systemHealth?.status
                      ? systemHealth.status === "healthy"
                        ? "All core services responding"
                        : "Investigate degraded checks"
                      : "No health data available"}
                  </span>
                </div>
              </div>
              {systemHealth?.checks && (
                <div className="space-y-2">
                  {Object.values(systemHealth.checks).map((check) => (
                    <div
                      key={check.name}
                      className="flex items-center justify-between rounded-md border border-border/60 bg-card/40 px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-foreground">{check.name}</span>
                      <Badge variant={check.status === "healthy" ? "outline" : "destructive"}>
                        {check.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
