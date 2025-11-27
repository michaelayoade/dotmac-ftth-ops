"use client";

// Force dynamic rendering to avoid SSR issues with React Query hooks
export const dynamic = "force-dynamic";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import { useRBAC } from "@/contexts/RBACContext";
import { useAccessPointListGraphQL, getSignalQualityLabel } from "@/hooks/useWirelessGraphQL";
import { AccessPointStatus, type FrequencyBand } from "@/lib/graphql/generated";
import { useAppConfig } from "@/providers/AppConfigContext";
import { Wifi, Search, Filter, ChevronLeft, ChevronRight, RefreshCw, Activity } from "lucide-react";
import Link from "next/link";

const ACCESS_POINT_STATUSES: AccessPointStatus[] = [
  AccessPointStatus.Online,
  AccessPointStatus.Offline,
  AccessPointStatus.Degraded,
  AccessPointStatus.Maintenance,
];

export default function AccessPointsPage() {
  const { hasPermission } = useRBAC();
  const { features } = useAppConfig();
  const hasWirelessAccess = features.enableNetwork && hasPermission("isp.ipam.read");

  // Filter state
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AccessPointStatus | undefined>(undefined);
  const [siteId, setSiteId] = useState<string | undefined>(undefined);
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);

  // Fetch access points with filters
  const {
    accessPoints,
    total: totalCount,
    hasNextPage,
    loading,
    error,
    refetch,
  } = useAccessPointListGraphQL({
    limit,
    offset,
    status,
    siteId,
    search,
    pollInterval: 60000, // Refresh every minute
  });

  if (!hasWirelessAccess) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-12 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Access Points</CardTitle>
            <CardDescription>
              Access requires <code>isp.ipam.read</code> permission.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const handleNextPage = () => {
    if (hasNextPage) {
      setOffset(offset + limit);
    }
  };

  const handlePreviousPage = () => {
    if (offset > 0) {
      setOffset(Math.max(0, offset - limit));
    }
  };

  const handleClearFilters = () => {
    setSearch("");
    setStatus(undefined);
    setSiteId(undefined);
    setOffset(0);
  };

  const formatStatus = (status: string) => {
    return status
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const getStatusBadgeVariant = (status: AccessPointStatus) => {
    switch (status) {
      case "ONLINE":
        return "default";
      case "OFFLINE":
        return "destructive";
      case "DEGRADED":
        return "secondary";
      case "MAINTENANCE":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getStatusColor = (status: AccessPointStatus) => {
    switch (status) {
      case "ONLINE":
        return "bg-green-500";
      case "OFFLINE":
        return "bg-red-500";
      case "DEGRADED":
        return "bg-yellow-500";
      case "MAINTENANCE":
        return "bg-blue-500";
      default:
        return "bg-gray-500";
    }
  };

  const getClientLoadColor = (count: number) => {
    if (count > 50) return "text-red-600 font-semibold";
    if (count > 30) return "text-amber-600";
    return "text-green-600";
  };

  return (
    <main className="max-w-7xl mx-auto px-6 py-12 space-y-8">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Access Points</h1>
          <p className="text-sm text-muted-foreground">
            Manage and monitor wireless access point infrastructure
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
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

      {/* Summary Cards */}
      {!loading && accessPoints.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Access Points</CardTitle>
              <Wifi className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Online</CardTitle>
              <div className="h-2 w-2 rounded-full bg-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {accessPoints.filter((ap) => ap.status === "ONLINE").length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Offline</CardTitle>
              <div className="h-2 w-2 rounded-full bg-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {accessPoints.filter((ap) => ap.status === "OFFLINE").length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
              <Wifi className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {accessPoints.reduce((sum, ap) => sum + (ap.performance?.connectedClients || 0), 0)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              <CardTitle>Filters</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={handleClearFilters}>
              Clear Filters
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by name, IP, or site..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setOffset(0);
                  }}
                  className="pl-8"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={status || "all"}
                onValueChange={(value) => {
                  setStatus(value === "all" ? undefined : (value as AccessPointStatus));
                  setOffset(0);
                }}
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {ACCESS_POINT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {formatStatus(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Site Filter (placeholder) */}
            <div className="space-y-2">
              <Label htmlFor="site">Site</Label>
              <Select
                value="all"
                onValueChange={(value) => setSiteId(value === "all" ? undefined : value)}
              >
                <SelectTrigger id="site">
                  <SelectValue placeholder="All sites" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sites</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              Access Points{" "}
              {totalCount > 0 && <span className="text-muted-foreground">({totalCount})</span>}
            </CardTitle>
            {loading && <Badge variant="outline">Loading...</Badge>}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardHeader>
        <CardContent>
          {accessPoints.length === 0 && !loading ? (
            <div className="text-center py-12">
              <Wifi className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No access points found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {search || status
                  ? "Try adjusting your filters"
                  : "No access points have been added to the system yet"}
              </p>
              <Button variant="outline" onClick={() => refetch()}>
                Refresh
              </Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Site</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>MAC Address</TableHead>
                      <TableHead className="text-right">Radios</TableHead>
                      <TableHead className="text-right">Clients</TableHead>
                      <TableHead className="text-right">Uptime</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accessPoints.map((ap) => (
                      <TableRow key={ap.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={`h-2 w-2 rounded-full ${getStatusColor(ap.status)}`} />
                            <Badge variant={getStatusBadgeVariant(ap.status)}>
                              {formatStatus(ap.status)}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{ap.name}</TableCell>
                        <TableCell className="text-sm">{ap.siteName || "-"}</TableCell>
                        <TableCell className="font-mono text-xs">{ap.ipAddress || "-"}</TableCell>
                        <TableCell className="font-mono text-xs">{ap.macAddress || "-"}</TableCell>
                        <TableCell className="text-right">{2}</TableCell>
                        <TableCell className="text-right">
                          <span
                            className={getClientLoadColor(ap.performance?.connectedClients || 0)}
                          >
                            {ap.performance?.connectedClients || 0}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {(
                            ap.lastRebootAt
                              ? Math.floor(
                                  (Date.now() - new Date(ap.lastRebootAt).getTime()) / 1000,
                                )
                              : 0
                          )
                            ? `${Math.floor((ap.lastRebootAt ? Math.floor((Date.now() - new Date(ap.lastRebootAt).getTime()) / 1000) : 0) / 3600)}h`
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Link href={`/dashboard/wireless/access-points/${ap.id}`}>
                            <Button variant="ghost" size="sm">
                              Details
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalCount > limit && (
                <div className="flex items-center justify-between pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Showing {offset + 1} to {Math.min(offset + limit, totalCount)} of {totalCount}{" "}
                    access points
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePreviousPage}
                      disabled={offset === 0 || loading}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNextPage}
                      disabled={!hasNextPage || loading}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
