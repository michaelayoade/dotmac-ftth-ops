"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { useRBAC } from "@/contexts/RBACContext";
import { useNetboxHealth, useNetboxSites } from "@/hooks/useNetworkInventory";
import { useAppConfig } from "@/providers/AppConfigContext";
import { NetworkTopologyMap } from "@dotmac/primitives";
import type { NetworkTopologyNode as NetworkNode } from "@dotmac/primitives";
import { logger } from "@/lib/logger";
import { NetworkProfileStats } from "@/components/network/NetworkProfileStats";

export default function NetworkOverviewPage() {
  const { hasPermission } = useRBAC();
  const { features } = useAppConfig();
  const hasNetworkAccess = features.enableNetwork && hasPermission("isp.ipam.read");

  const { data: netboxHealth, isLoading: healthLoading } = useNetboxHealth({
    enabled: hasNetworkAccess,
  });
  const { data: netboxSites, isLoading: sitesLoading } = useNetboxSites({
    limit: 50,
    enabled: hasNetworkAccess,
  });

  if (!hasNetworkAccess) {
    return (
      <main className="max-w-5xl mx-auto px-6 py-12 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Network inventory</CardTitle>
            <CardDescription>
              Access requires <code>isp.ipam.read</code> and the NetBox integration to be configured
              for this tenant.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Operators can enable the NetBox connector via the OSS configuration screen or update
              <code>NEXT_PUBLIC_ENABLE_NETWORK</code> to share development data.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  const topologyNodes: NetworkNode[] = (netboxSites ?? [])
    .filter((site) => site.latitude != null && site.longitude != null)
    .map((site) => ({
      id: `site-${site.id}`,
      name: site.name,
      type: "fiber_node" as NetworkNode["type"],
      coordinates: {
        lat: site.latitude as number,
        lng: site.longitude as number,
      },
      status: (netboxHealth?.healthy ? "online" : "maintenance") as NetworkNode["status"],
    }));

  const mapCenter =
    topologyNodes.length > 0 && topologyNodes[0]
      ? topologyNodes[0].coordinates
      : { lat: 0, lng: 0 };

  return (
    <main className="max-w-5xl mx-auto px-6 py-12 space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Network inventory</h1>
        <p className="text-sm text-muted-foreground">
          Visualize sites, devices, and cabling imported from NetBox for the current tenant.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>NetBox health</CardTitle>
          <CardDescription>Connectivity status for the tenant-scoped NetBox API.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {healthLoading ? (
            <p className="text-sm text-muted-foreground">Checking NetBox…</p>
          ) : netboxHealth ? (
            <>
              <Badge
                variant={netboxHealth.healthy ? "outline" : "destructive"}
                className="w-fit uppercase tracking-wide"
              >
                {netboxHealth.healthy ? "Healthy" : "Degraded"}
              </Badge>
              <p className="text-sm text-muted-foreground">{netboxHealth.message}</p>
              {netboxHealth.version && (
                <p className="text-xs text-muted-foreground">
                  Reported version: {netboxHealth.version}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No health data available.</p>
          )}
        </CardContent>
      </Card>

      <NetworkProfileStats />

      <Card>
        <CardHeader>
          <CardTitle>Sites</CardTitle>
          <CardDescription>Primary network locations defined in NetBox.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Facility</TableHead>
                <TableHead>Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sitesLoading && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Loading sites…
                  </TableCell>
                </TableRow>
              )}
              {!sitesLoading && (netboxSites?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No sites returned from NetBox.
                  </TableCell>
                </TableRow>
              )}
              {netboxSites?.map((site) => (
                <TableRow key={site.id}>
                  <TableCell className="font-medium text-foreground">{site.name}</TableCell>
                  <TableCell className="text-xs uppercase tracking-wide text-muted-foreground">
                    {site.slug}
                  </TableCell>
                  <TableCell>{site.facility ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {site.physical_address || site.description || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Topology view</CardTitle>
          <CardDescription>
            Interactive map rendering NetBox site coordinates. Enhance with device-level nodes once
            available.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {topologyNodes.length ? (
            <NetworkTopologyMap
              center={mapCenter}
              zoom={6}
              networkNodes={topologyNodes}
              height={360}
              variant="admin"
              showLegend
              onNodeSelect={(node: any) =>
                logger.info("network-topology.node-selected", {
                  nodeId: node.id,
                  nodeType: node.type,
                })
              }
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              No geographic coordinates detected for NetBox sites. Populate latitude/longitude
              fields to enable the topology map.
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
