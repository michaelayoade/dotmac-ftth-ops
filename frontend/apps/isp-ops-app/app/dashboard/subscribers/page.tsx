/**
 * Subscriber Dashboard - GraphQL Version
 *
 * GraphQL-first subscriber management view with consolidated queries.
 * Replaces the legacy REST implementation for improved load performance.
 */

"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { useRBAC } from "@/contexts/RBACContext";
import { platformConfig } from "@/lib/config";
import { useAppConfig } from "@/providers/AppConfigContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { useToast } from "@dotmac/ui";
import { logger } from "@/lib/logger";
import {
  useSubscriberDashboardGraphQL,
  getSubscriberSessions,
} from "@/hooks/useSubscriberDashboardGraphQL";
import { ApolloProvider } from "@/lib/graphql/ApolloProvider";
import { NetworkProfileCard } from "@/components/subscribers/NetworkProfileCard";
import { SubscriberAlertsBanner } from "@/components/subscribers/SubscriberAlertsBanner";
import { useQuery } from "@tanstack/react-query";

function SubscribersDashboardContent() {
  const { hasPermission } = useRBAC();
  const { features } = useAppConfig();
  const [search, setSearch] = useState("");
  const radiusEnabled = platformConfig.features.enableRadius && hasPermission("isp.radius.read");
  const [selectedSubscriberId, setSelectedSubscriberId] = useState<number | null>(null);
  const [subscriberDialogOpen, setSubscriberDialogOpen] = useState(false);

  const { toast } = useToast();

  const hasLifecycleAccess = features.enableAutomation && hasPermission("isp.automation.read");

  // Single GraphQL query replaces multiple REST calls
  const trimmedSearch = search.trim();
  const { subscribers, sessions, metrics, loading, error, refetch } = useSubscriberDashboardGraphQL(
    {
      limit: 50,
      ...(trimmedSearch ? { search: trimmedSearch } : {}),
      enabled: radiusEnabled,
      lifecycleMetricsEnabled: hasLifecycleAccess,
    },
  );

  const filteredSubscribers = subscribers.filter((subscriber) =>
    subscriber.username.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const selectedSubscriber = subscribers.find((s) => s.id === selectedSubscriberId) ?? null;
  const selectedSessions = selectedSubscriber
    ? getSubscriberSessions(subscribers, selectedSubscriber.username)
    : [];

  // Fetch network profile for selected subscriber
  const { data: networkProfile, refetch: refetchProfile } = useQuery({
    queryKey: ["networkProfile", selectedSubscriber?.subscriberId],
    queryFn: async () => {
      if (!selectedSubscriber?.subscriberId) return null;
      const response = await fetch(
        `/api/v1/network/subscribers/${selectedSubscriber.subscriberId}/profile`,
      );
      if (response.status === 404) return null;
      if (!response.ok) throw new Error("Failed to fetch network profile");
      return response.json();
    },
    enabled: !!selectedSubscriber?.subscriberId && subscriberDialogOpen,
  });

  // Fetch subscriber alerts (Option 82, auth failures, etc.)
  const { data: subscriberAlerts } = useQuery({
    queryKey: ["subscriberAlerts", selectedSubscriber?.subscriberId],
    queryFn: async () => {
      if (!selectedSubscriber?.subscriberId) return [];
      const response = await fetch(
        `/api/v1/radius/subscribers/${selectedSubscriber.subscriberId}/alerts`,
        {
          credentials: "include",
        },
      );
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!selectedSubscriber?.subscriberId && subscriberDialogOpen,
  });

  if (!radiusEnabled) {
    return (
      <main className="max-w-6xl mx-auto px-6 py-12 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Subscribers</CardTitle>
            <CardDescription>
              Access to RADIUS subscriber records requires the <code>isp.radius.read</code>{" "}
              permission.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Contact a platform administrator to grant ISP operator privileges, or enable the
              feature flag <code>NEXT_PUBLIC_ENABLE_RADIUS</code>.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (error) {
    logger.error("Failed to load subscriber dashboard via GraphQL", new Error(error));
    return (
      <main className="max-w-6xl mx-auto px-6 py-12 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Error Loading Subscribers</CardTitle>
            <CardDescription>Failed to load subscriber data from GraphQL API</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive mb-4">{error}</p>
            <Button onClick={() => refetch()}>Retry</Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-12 space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Subscriber directory</h1>
        <p className="text-sm text-muted-foreground">
          Manage broadband subscriber credentials, service assignments, and active RADIUS sessions.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tracked subscribers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">
              {loading ? "..." : metrics.totalSubscribers}
            </div>
            <p className="text-xs text-muted-foreground mt-1">In FreeRADIUS for this tenant</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">
              {loading ? "..." : metrics.activeSessions}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              PPP sessions currently authenticated
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active services
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">
              {loading ? "..." : metrics.activeServices}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Service instances in ACTIVE status</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>RADIUS subscribers</CardTitle>
          <CardDescription>
            Search and review subscriber credentials and profile settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by username"
            className="max-w-sm"
          />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Framed IP</TableHead>
                  <TableHead>Bandwidth Profile</TableHead>
                  <TableHead>Active Sessions</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Loading subscribers…
                    </TableCell>
                  </TableRow>
                )}
                {!loading && filteredSubscribers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No subscribers match your search.
                    </TableCell>
                  </TableRow>
                )}
                {filteredSubscribers.map((subscriber) => (
                  <TableRow
                    key={subscriber.id}
                    className="cursor-pointer hover:bg-accent/30"
                    onClick={() => {
                      setSelectedSubscriberId(subscriber.id);
                      setSubscriberDialogOpen(true);
                    }}
                  >
                    <TableCell className="font-medium text-foreground">
                      {subscriber.username}
                    </TableCell>
                    <TableCell>
                      <Badge variant={subscriber.enabled ? "outline" : "secondary"}>
                        {subscriber.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell>{subscriber.framedIpAddress ?? "—"}</TableCell>
                    <TableCell>{subscriber.bandwidthProfileId ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{subscriber.sessions.length}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(subscriber.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active RADIUS sessions</CardTitle>
          <CardDescription>Latest PPP sessions authenticated via FreeRADIUS.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>NAS IP</TableHead>
                <TableHead>Session ID</TableHead>
                <TableHead>Duration (s)</TableHead>
                <TableHead>Data transfer (MB)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.slice(0, 20).map((session) => (
                <TableRow key={session.radacctid}>
                  <TableCell className="font-medium text-foreground">{session.username}</TableCell>
                  <TableCell>{session.nasipaddress}</TableCell>
                  <TableCell className="font-mono text-xs">{session.acctsessionid}</TableCell>
                  <TableCell>{session.acctsessiontime ?? 0}</TableCell>
                  <TableCell>
                    {((session.acctinputoctets ?? 0) / (1024 * 1024)).toFixed(2)}/
                    {((session.acctoutputoctets ?? 0) / (1024 * 1024)).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
              {sessions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No active sessions at the moment.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={subscriberDialogOpen} onOpenChange={setSubscriberDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Subscriber details</DialogTitle>
            <DialogDescription>
              Detailed information for <code>{selectedSubscriber?.username ?? "—"}</code>
            </DialogDescription>
          </DialogHeader>
          {selectedSubscriber ? (
            <div className="space-y-6">
              {/* Subscriber Alerts */}
              {subscriberAlerts && subscriberAlerts.length > 0 && (
                <SubscriberAlertsBanner alerts={subscriberAlerts} />
              )}

              {/* Basic Subscriber Information */}
              <div className="space-y-4 text-sm">
                <h3 className="text-sm font-semibold">Basic Information</h3>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Subscriber ID</span>
                    <span className="font-medium text-foreground">
                      {selectedSubscriber.subscriberId}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant={selectedSubscriber.enabled ? "outline" : "secondary"}>
                      {selectedSubscriber.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Bandwidth profile</span>
                    <span className="font-medium text-foreground">
                      {selectedSubscriber.bandwidthProfileId ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Framed IP address</span>
                    <span className="font-medium text-foreground">
                      {selectedSubscriber.framedIpAddress ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span>{new Date(selectedSubscriber.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Updated</span>
                    <span>{new Date(selectedSubscriber.updatedAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Network Profile */}
              <NetworkProfileCard
                profile={networkProfile ?? null}
                subscriberId={selectedSubscriber.subscriberId}
                onUpdate={() => {
                  refetchProfile();
                }}
              />

              {/* Active Sessions */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Active sessions ({selectedSessions.length})
                </p>
                {selectedSessions.length ? (
                  <div className="max-h-48 overflow-y-auto rounded border border-border/60">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">NAS</TableHead>
                          <TableHead className="text-xs">Session ID</TableHead>
                          <TableHead className="text-xs">Start</TableHead>
                          <TableHead className="text-xs">Duration (s)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedSessions.map((session) => (
                          <TableRow key={session.radacctid}>
                            <TableCell className="text-xs">{session.nasipaddress}</TableCell>
                            <TableCell className="text-xs font-mono">
                              {session.acctsessionid}
                            </TableCell>
                            <TableCell className="text-xs">
                              {session.acctstarttime
                                ? new Date(session.acctstarttime).toLocaleString()
                                : "—"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {session.acctsessiontime ?? 0}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No active sessions for this subscriber.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Select a subscriber to view details.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubscriberDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

export default function SubscribersPage() {
  return (
    <ApolloProvider>
      <SubscribersDashboardContent />
    </ApolloProvider>
  );
}
