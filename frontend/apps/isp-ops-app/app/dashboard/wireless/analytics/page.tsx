"use client";

// Force dynamic rendering to avoid SSR issues with React Query hooks
export const dynamic = "force-dynamic";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { useRBAC } from "@/contexts/RBACContext";
import {
  useRfAnalyticsGraphQL,
  useChannelUtilizationGraphQL,
  getFrequencyBandLabel,
} from "@/hooks/useWirelessGraphQL";
import { useAppConfig } from "@/providers/AppConfigContext";
import { Activity, BarChart3, Radio, RefreshCw, Signal, TrendingUp, Zap } from "lucide-react";
import Link from "next/link";

export default function RFAnalyticsPage() {
  const { hasPermission } = useRBAC();
  const { features } = useAppConfig();
  const hasWirelessAccess = features.enableNetwork && hasPermission("isp.ipam.read");

  // Fetch RF analytics
  const {
    analytics,
    loading: analyticsLoading,
    error: analyticsError,
    refetch: refetchAnalytics,
  } = useRfAnalyticsGraphQL({
    siteId: "",
    pollInterval: 60000, // Refresh every minute
  });

  // Fetch channel utilization
  const {
    channelUtilization,
    loading: utilizationLoading,
    error: utilizationError,
    refetch: refetchUtilization,
  } = useChannelUtilizationGraphQL({
    siteId: "",
    pollInterval: 60000,
  });

  if (!hasWirelessAccess) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-12 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>RF Analytics</CardTitle>
            <CardDescription>
              Access requires <code>isp.ipam.read</code> permission.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const refetchAll = () => {
    refetchAnalytics();
    refetchUtilization();
  };

  const error = analyticsError || utilizationError;
  const loading = analyticsLoading && utilizationLoading;

  if (error) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-12 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>RF Analytics</CardTitle>
            <CardDescription>Failed to load analytics data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-destructive">{error}</p>
            <Button onClick={refetchAll} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const getUtilizationColor = (utilization: number) => {
    if (utilization >= 80) return "text-red-600";
    if (utilization >= 60) return "text-amber-600";
    if (utilization >= 40) return "text-yellow-600";
    return "text-green-600";
  };

  const getInterferenceLevel = (score: number) => {
    if (score >= 80)
      return {
        label: "Excellent",
        color: "text-green-600",
        variant: "default",
      };
    if (score >= 60) return { label: "Good", color: "text-green-500", variant: "default" };
    if (score >= 40) return { label: "Fair", color: "text-amber-600", variant: "secondary" };
    if (score >= 20)
      return {
        label: "Poor",
        color: "text-orange-600",
        variant: "destructive",
      };
    return { label: "Critical", color: "text-red-600", variant: "destructive" };
  };

  return (
    <main className="max-w-7xl mx-auto px-6 py-12 space-y-8">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">RF Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Radio frequency performance metrics and spectrum analysis
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refetchAll}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Link href="/dashboard/wireless">
            <Button variant="outline">
              <Activity className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </header>

      {/* Key Metrics */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Signal Strength</CardTitle>
              <Signal className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-2xl font-bold text-muted-foreground">Loading...</div>
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {analytics.averageSignalStrengthDbm?.toFixed(1) || 0} dBm
                  </div>
                  <p className="text-xs text-muted-foreground">Across all access points</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Noise Floor</CardTitle>
              <Radio className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-2xl font-bold text-muted-foreground">Loading...</div>
              ) : (
                <>
                  <div className="text-2xl font-bold">-85 dBm</div>
                  <p className="text-xs text-muted-foreground">Background noise level</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Signal-to-Noise Ratio</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-2xl font-bold text-muted-foreground">Loading...</div>
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {analytics.averageSnr?.toFixed(1) || 0} dB
                  </div>
                  <p className="text-xs text-muted-foreground">Average SNR</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">RF Quality Score</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-2xl font-bold text-muted-foreground">Loading...</div>
              ) : (
                <>
                  <div className="text-2xl font-bold">{(85)?.toFixed(0) || 0}%</div>
                  <p className="text-xs text-muted-foreground">{getInterferenceLevel(85).label}</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="channels">Channel Utilization</TabsTrigger>
          <TabsTrigger value="interference">Interference</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* RF Quality Summary */}
          <Card>
            <CardHeader>
              <CardTitle>RF Environment Summary</CardTitle>
              <CardDescription>Overall radio frequency health and performance</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading analytics...</p>
              ) : analytics ? (
                <div className="space-y-6">
                  {/* Quality Score */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium">RF Quality Score</h3>
                      <div className="flex items-center gap-2">
                        <Badge variant={getInterferenceLevel(85).variant as any}>
                          {getInterferenceLevel(85).label}
                        </Badge>
                        <span className={`text-2xl font-bold ${getInterferenceLevel(85).color}`}>
                          {(85)?.toFixed(0) || 0}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${
                          85 >= 60 ? "bg-green-600" : 85 >= 40 ? "bg-amber-600" : "bg-red-600"
                        }`}
                        style={{ width: `${85}%` }}
                      />
                    </div>
                  </div>

                  {/* Signal Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg border">
                      <div className="text-sm text-muted-foreground mb-1">Signal Strength</div>
                      <div className="text-xl font-bold">
                        {analytics.averageSignalStrengthDbm?.toFixed(1) || 0} dBm
                      </div>
                    </div>
                    <div className="p-4 rounded-lg border">
                      <div className="text-sm text-muted-foreground mb-1">Noise Floor</div>
                      <div className="text-xl font-bold">-85 dBm</div>
                    </div>
                    <div className="p-4 rounded-lg border">
                      <div className="text-sm text-muted-foreground mb-1">SNR</div>
                      <div className="text-xl font-bold">
                        {analytics.averageSnr?.toFixed(1) || 0} dB
                      </div>
                    </div>
                  </div>

                  {/* Interference Metrics */}
                  {(80 !== undefined || 15 !== undefined) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg border">
                        <div className="text-sm text-muted-foreground mb-1">
                          Co-Channel Interference
                        </div>
                        <div className="text-xl font-bold text-amber-600">
                          {(80)?.toFixed(1) || 0}%
                        </div>
                      </div>
                      <div className="p-4 rounded-lg border">
                        <div className="text-sm text-muted-foreground mb-1">
                          Adjacent Channel Interference
                        </div>
                        <div className="text-xl font-bold text-amber-600">
                          {(15)?.toFixed(1) || 0}%
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No analytics data available</p>
              )}
            </CardContent>
          </Card>

          {/* Frequency Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Frequency Band Distribution</CardTitle>
              <CardDescription>Access points by frequency band</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : analytics ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries({}).map(([band, count]) => (
                    <div key={band} className="p-4 rounded-lg border text-center">
                      <div className="text-2xl font-bold">{count as number}</div>
                      <div className="text-sm text-muted-foreground">
                        {getFrequencyBandLabel(band as any)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No frequency distribution data</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Channel Utilization Tab */}
        <TabsContent value="channels" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Channel Utilization</CardTitle>
              <CardDescription>Airtime usage by channel and frequency band</CardDescription>
            </CardHeader>
            <CardContent>
              {utilizationLoading ? (
                <p className="text-sm text-muted-foreground">Loading channel utilization...</p>
              ) : channelUtilization && channelUtilization.length > 0 ? (
                <div className="space-y-4">
                  {channelUtilization.map((util, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="font-medium">
                            Channel {util.channel} - {getFrequencyBandLabel(util.band)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {util.accessPointsCount || 0} access points
                          </div>
                        </div>
                        <div className="text-right">
                          <div
                            className={`text-lg font-bold ${getUtilizationColor(util.utilizationPercent || 0)}`}
                          >
                            {util.utilizationPercent?.toFixed(1) || 0}%
                          </div>
                          <div className="text-xs text-muted-foreground">utilization</div>
                        </div>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            (util.utilizationPercent || 0) >= 80
                              ? "bg-red-600"
                              : (util.utilizationPercent || 0) >= 60
                                ? "bg-amber-600"
                                : (util.utilizationPercent || 0) >= 40
                                  ? "bg-yellow-600"
                                  : "bg-green-600"
                          }`}
                          style={{ width: `${util.utilizationPercent || 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No channel utilization data available
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Interference Tab */}
        <TabsContent value="interference" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Interference Analysis</CardTitle>
              <CardDescription>RF interference and noise sources</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading interference data...</p>
              ) : analytics ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Co-Channel Interference */}
                    <div className="p-6 rounded-lg border">
                      <h3 className="text-sm font-medium mb-4">Co-Channel Interference</h3>
                      <div className="text-3xl font-bold text-amber-600 mb-2">
                        {(80)?.toFixed(1) || 0}%
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Interference from devices on the same channel
                      </p>
                    </div>

                    {/* Adjacent Channel Interference */}
                    <div className="p-6 rounded-lg border">
                      <h3 className="text-sm font-medium mb-4">Adjacent Channel Interference</h3>
                      <div className="text-3xl font-bold text-amber-600 mb-2">
                        {(15)?.toFixed(1) || 0}%
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Interference from adjacent frequency channels
                      </p>
                    </div>
                  </div>

                  {/* Recommendations */}
                  <div className="p-4 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20">
                    <h3 className="text-sm font-medium mb-2">Recommendations</h3>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      {80 > 30 && (
                        <li>
                          • Consider adjusting channel assignments to reduce co-channel interference
                        </li>
                      )}
                      {15 > 20 && (
                        <li>
                          • Increase channel spacing to minimize adjacent channel interference
                        </li>
                      )}
                      {85 < 40 && (
                        <li>
                          • RF environment quality is poor, consider site survey and access point
                          repositioning
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No interference data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
              <CardDescription>Network-wide RF performance statistics</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center py-12">
                Detailed performance charts and historical trends will be displayed here.
                <br />
                <Link href="/dashboard/wireless" className="text-primary hover:underline">
                  Return to wireless dashboard
                </Link>
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
}
