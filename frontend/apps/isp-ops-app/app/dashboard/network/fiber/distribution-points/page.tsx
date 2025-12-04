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
import { useDistributionPointListGraphQL } from "@/hooks/useFiberGraphQL";
import { DistributionPointType, FiberCableStatus } from "@/lib/graphql/generated";
import { useAppConfig } from "@/providers/AppConfigContext";
import { MapPin, Search, Filter, ChevronLeft, ChevronRight, Cable } from "lucide-react";
import Link from "next/link";

const DISTRIBUTION_POINT_TYPES: DistributionPointType[] = [
  DistributionPointType.Cabinet,
  DistributionPointType.Closure,
  DistributionPointType.Pole,
  DistributionPointType.Manhole,
  DistributionPointType.Handhole,
  DistributionPointType.BuildingEntry,
  DistributionPointType.Pedestal,
];

const POINT_STATUSES: FiberCableStatus[] = [
  FiberCableStatus.Active,
  FiberCableStatus.Inactive,
  FiberCableStatus.UnderConstruction,
  FiberCableStatus.Maintenance,
  FiberCableStatus.Damaged,
  FiberCableStatus.Decommissioned,
];

export default function DistributionPointsPage() {
  const { hasPermission } = useRBAC();
  const { features } = useAppConfig();
  const hasFiberAccess = features.enableNetwork && hasPermission("isp.ipam.read");

  // Filter state
  const [search, setSearch] = useState("");
  const [pointType, setPointType] = useState<DistributionPointType | undefined>(undefined);
  const [status, setStatus] = useState<FiberCableStatus | undefined>(undefined);
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);

  // Fetch distribution points with filters
  const distributionListOptions: Parameters<typeof useDistributionPointListGraphQL>[0] = {
    limit,
    offset,
    pollInterval: 60000,
  };
  if (pointType) {
    distributionListOptions.pointType = pointType;
  }
  if (status) {
    distributionListOptions.status = status;
  }
  const trimmedSearch = search.trim();
  if (trimmedSearch) {
    distributionListOptions.search = trimmedSearch;
  }

  const { distributionPoints, totalCount, hasNextPage, loading, error, refetch } =
    useDistributionPointListGraphQL(distributionListOptions);

  if (!hasFiberAccess) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-12 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Distribution Points</CardTitle>
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
      const newOffset = offset + limit;
      setOffset(newOffset);
    }
  };

  const handlePreviousPage = () => {
    if (offset > 0) {
      const newOffset = Math.max(0, offset - limit);
      setOffset(newOffset);
    }
  };

  const handleClearFilters = () => {
    setSearch("");
    setPointType(undefined);
    setStatus(undefined);
    setOffset(0);
  };

  const formatType = (type: string) => {
    return type
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "default";
      case "INACTIVE":
        return "secondary";
      case "UNDER_CONSTRUCTION":
        return "outline";
      case "MAINTENANCE":
        return "secondary";
      case "DAMAGED":
        return "destructive";
      case "DECOMMISSIONED":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getCapacityColor = (percent: number) => {
    if (percent >= 90) return "text-red-600";
    if (percent >= 75) return "text-amber-600";
    if (percent >= 50) return "text-yellow-600";
    return "text-green-600";
  };

  return (
    <main className="max-w-7xl mx-auto px-6 py-12 space-y-8">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Distribution Points</h1>
          <p className="text-sm text-muted-foreground">
            Fiber distribution infrastructure (cabinets, closures, poles)
          </p>
        </div>
        <Link href="/dashboard/network/fiber">
          <Button variant="outline">
            <Cable className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
      </header>

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
                  placeholder="Search points..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setOffset(0);
                  }}
                  className="pl-8"
                />
              </div>
            </div>

            {/* Point Type Filter */}
            <div className="space-y-2">
              <Label htmlFor="pointType">Point Type</Label>
              <Select
                value={pointType || "all"}
                onValueChange={(value) => {
                  setPointType(value === "all" ? undefined : (value as DistributionPointType));
                  setOffset(0);
                }}
              >
                <SelectTrigger id="pointType">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {DISTRIBUTION_POINT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {formatType(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={status || "all"}
                onValueChange={(value) => {
                  setStatus(value === "all" ? undefined : (value as FiberCableStatus));
                  setOffset(0);
                }}
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {POINT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {formatType(s)}
                    </SelectItem>
                  ))}
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
              Distribution Points{" "}
              {totalCount > 0 && <span className="text-muted-foreground">({totalCount})</span>}
            </CardTitle>
            {loading && <Badge variant="outline">Loading...</Badge>}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardHeader>
        <CardContent>
          {distributionPoints.length === 0 && !loading ? (
            <div className="text-center py-12">
              <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No distribution points found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {search || pointType || status
                  ? "Try adjusting your filters"
                  : "No distribution points have been added to the system yet"}
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
                      <TableHead>Name</TableHead>
                      <TableHead>Site ID</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Capacity</TableHead>
                      <TableHead className="text-right">Utilization</TableHead>
                      <TableHead className="text-right">Cables</TableHead>
                      <TableHead className="text-right">Customers</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {distributionPoints.map((point) => (
                      <TableRow key={point.id}>
                        <TableCell className="font-medium">{point.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {point.siteId}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{formatType(point.pointType)}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(point.status)}>
                            {formatType(point.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {point.usedCapacity} / {point.totalCapacity}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={`font-medium ${getCapacityColor(point.capacityUtilizationPercent)}`}
                          >
                            {point.capacityUtilizationPercent.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {point.totalCablesConnected}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {point.servesCustomerCount}
                        </TableCell>
                        <TableCell>
                          <Link href={`/dashboard/network/fiber/distribution-points/${point.id}`}>
                            <Button variant="ghost" size="sm">
                              View
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
                    points
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
