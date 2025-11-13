"use client";

// Force dynamic rendering to avoid SSR issues with React Query hooks
export const dynamic = "force-dynamic";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { useRBAC } from "@/contexts/RBACContext";
import { useFiberDashboardGraphQL } from "@/hooks/useFiberGraphQL";
import { useAppConfig } from "@/providers/AppConfigContext";
import { Activity, AlertTriangle, Cable, MapPin, TrendingUp } from "lucide-react";
import Link from "next/link";

export default function FiberInfrastructurePage() {
  const { hasPermission } = useRBAC();
  const { features } = useAppConfig();
  const hasFiberAccess = features.enableNetwork && hasPermission("isp.ipam.read");

  const {
    dashboard,
    analytics,
    topCables,
    topDistributionPoints,
    topServiceAreas,
    cablesRequiringAttention,
    distributionPointsNearCapacity,
    loading,
    error,
    refetch,
  } = useFiberDashboardGraphQL({
    pollInterval: 30000, // Auto-refresh every 30 seconds
  });

  if (!hasFiberAccess) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-12 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Fiber Infrastructure</CardTitle>
            <CardDescription>
              Access requires <code>isp.ipam.read</code> permission and network features enabled.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Contact your administrator to enable fiber infrastructure management.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-12 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Fiber Infrastructure</CardTitle>
            <CardDescription>Failed to load fiber infrastructure data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-destructive">{error}</p>
            <Button onClick={() => refetch()} variant="outline">
              Retry
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-6 py-12 space-y-8">
      {/* Header */}
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Fiber Infrastructure</h1>
        <p className="text-sm text-muted-foreground">
          Monitor fiber optic network health, capacity, and coverage across your infrastructure.
        </p>
      </header>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Fiber</CardTitle>
            <Cable className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading && !analytics ? (
              <div className="text-2xl font-bold text-muted-foreground">Loading...</div>
            ) : (
              <>
                <div className="text-2xl font-bold">{analytics?.totalFiberKm.toFixed(1)} km</div>
                <p className="text-xs text-muted-foreground">
                  {analytics?.totalCables || 0} cables, {analytics?.totalStrands || 0} strands
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Network Health</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading && !analytics ? (
              <div className="text-2xl font-bold text-muted-foreground">Loading...</div>
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {analytics?.networkHealthScore.toFixed(0)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {cablesRequiringAttention.length} cables need attention
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Capacity Utilization</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading && !analytics ? (
              <div className="text-2xl font-bold text-muted-foreground">Loading...</div>
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {analytics?.capacityUtilizationPercent.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {0} / {100} used
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Coverage</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading && !analytics ? (
              <div className="text-2xl font-bold text-muted-foreground">Loading...</div>
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {analytics?.penetrationRatePercent.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {analytics?.homesConnected || 0} / {analytics?.homesPassed || 0} homes
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alerts and Issues */}
      {cablesRequiringAttention.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-900">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <CardTitle>Cables Requiring Attention</CardTitle>
              </div>
              <Link href="/dashboard/network/fiber/cables">
                <Button variant="outline" size="sm">
                  View All
                </Button>
              </Link>
            </div>
            <CardDescription>Fiber cables with health issues or maintenance needs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {cablesRequiringAttention.slice(0, 5).map((cable) => (
                <div
                  key={cable.cableId}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="space-y-1">
                    <div className="font-medium">{cable.cableName}</div>
                    <div className="text-xs text-muted-foreground">ID: {cable.cableId}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-medium">Health: {cable.healthScore}%</div>
                      <Badge
                        variant={
                          cable.healthStatus === "CRITICAL"
                            ? "destructive"
                            : cable.healthStatus === "POOR"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {cable.healthStatus}
                      </Badge>
                    </div>
                    {cable.requiresMaintenance && (
                      <Badge variant="outline" className="text-amber-600 border-amber-600">
                        Maintenance
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Performing Cables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Top Cables by Utilization</CardTitle>
              <Link href="/dashboard/network/fiber/cables">
                <Button variant="ghost" size="sm">
                  View All
                </Button>
              </Link>
            </div>
            <CardDescription>Highest capacity utilization in the network</CardDescription>
          </CardHeader>
          <CardContent>
            {loading && topCables.length === 0 ? (
              <p className="text-sm text-muted-foreground">Loading cables...</p>
            ) : topCables.length === 0 ? (
              <p className="text-sm text-muted-foreground">No fiber cables found.</p>
            ) : (
              <div className="space-y-3">
                {topCables.map((cable) => (
                  <div
                    key={cable.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="font-medium">{cable.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {cable.usedStrands} / {cable.totalStrands} strands used
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">
                        {cable.capacityUtilizationPercent.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Distribution Points Near Capacity</CardTitle>
              <Link href="/dashboard/network/fiber/distribution-points">
                <Button variant="ghost" size="sm">
                  View All
                </Button>
              </Link>
            </div>
            <CardDescription>Points approaching maximum capacity</CardDescription>
          </CardHeader>
          <CardContent>
            {loading && distributionPointsNearCapacity.length === 0 ? (
              <p className="text-sm text-muted-foreground">Loading distribution points...</p>
            ) : distributionPointsNearCapacity.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                All distribution points have adequate capacity.
              </p>
            ) : (
              <div className="space-y-3">
                {distributionPointsNearCapacity.slice(0, 5).map((point) => (
                  <div
                    key={point.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="font-medium">{point.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {0} / {100} ports used
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-amber-600">
                        {point.capacityUtilizationPercent.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Service Areas Performance */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Top Service Areas by Penetration</CardTitle>
            <Link href="/dashboard/network/fiber/service-areas">
              <Button variant="ghost" size="sm">
                View All
              </Button>
            </Link>
          </div>
          <CardDescription>Service areas with highest customer penetration rates</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && topServiceAreas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading service areas...</p>
          ) : topServiceAreas.length === 0 ? (
            <p className="text-sm text-muted-foreground">No service areas found.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {topServiceAreas.map((area) => (
                <div key={area.id} className="p-4 rounded-lg border space-y-2">
                  <div className="font-medium">{area.name}</div>
                  <div className="text-xs text-muted-foreground">{area.city}</div>
                  <div className="flex items-center justify-between pt-2">
                    <div className="text-sm text-muted-foreground">
                      {area.homesConnected} / {area.homesPassed} homes
                    </div>
                    <div className="text-lg font-bold text-green-600">
                      {area.penetrationRatePercent?.toFixed(1) || 0}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Manage fiber infrastructure components</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/dashboard/network/fiber/cables">
              <Button variant="outline" className="w-full justify-start">
                <Cable className="mr-2 h-4 w-4" />
                Manage Fiber Cables
              </Button>
            </Link>
            <Link href="/dashboard/network/fiber/distribution-points">
              <Button variant="outline" className="w-full justify-start">
                <MapPin className="mr-2 h-4 w-4" />
                Distribution Points
              </Button>
            </Link>
            <Link href="/dashboard/network/fiber/service-areas">
              <Button variant="outline" className="w-full justify-start">
                <TrendingUp className="mr-2 h-4 w-4" />
                Service Areas
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
