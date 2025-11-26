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
import { useFiberCableListGraphQL } from "@/hooks/useFiberGraphQL";
import { FiberCableStatus, FiberType, CableInstallationType } from "@/lib/graphql/generated";
import { useAppConfig } from "@/providers/AppConfigContext";
import { Cable, Search, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

const FIBER_CABLE_STATUSES: FiberCableStatus[] = [
  FiberCableStatus.Active,
  FiberCableStatus.Inactive,
  FiberCableStatus.UnderConstruction,
  FiberCableStatus.Maintenance,
  FiberCableStatus.Damaged,
  FiberCableStatus.Decommissioned,
];

const FIBER_TYPES: FiberType[] = [FiberType.SingleMode, FiberType.MultiMode, FiberType.Hybrid];

const INSTALLATION_TYPES: CableInstallationType[] = [
  CableInstallationType.Aerial,
  CableInstallationType.Underground,
  CableInstallationType.Buried,
  CableInstallationType.Duct,
  CableInstallationType.Building,
  CableInstallationType.Submarine,
];

export default function FiberCablesPage() {
  const { hasPermission } = useRBAC();
  const { features } = useAppConfig();
  const hasFiberAccess = features.enableNetwork && hasPermission("isp.ipam.read");

  // Filter state
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<FiberCableStatus | undefined>(undefined);
  const [fiberType, setFiberType] = useState<FiberType | undefined>(undefined);
  const [installationType, setInstallationType] = useState<CableInstallationType | undefined>(
    undefined,
  );
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);

  // Fetch cables with filters
  const cableListOptions: Parameters<typeof useFiberCableListGraphQL>[0] = {
    limit,
    offset,
    pollInterval: 60000, // Refresh every minute
  };
  if (status) {
    cableListOptions.status = status;
  }
  if (fiberType) {
    cableListOptions.fiberType = fiberType;
  }
  if (installationType) {
    cableListOptions.installationType = installationType;
  }

  const { cables, totalCount, hasNextPage, loading, error, refetch, fetchMore } =
    useFiberCableListGraphQL(cableListOptions);

  const searchLower = search.trim().toLowerCase();
  const filteredCables = searchLower
    ? cables.filter((cable) =>
        [cable.name, cable.cableId]
          .filter(Boolean)
          .some((field) => field!.toString().toLowerCase().includes(searchLower)),
      )
    : cables;

  const displayCables = filteredCables;
  const displayTotalCount = searchLower ? filteredCables.length : totalCount;

  if (!hasFiberAccess) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-12 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Fiber Cables</CardTitle>
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
      fetchMore(newOffset);
    }
  };

  const handlePreviousPage = () => {
    if (offset > 0) {
      const newOffset = Math.max(0, offset - limit);
      setOffset(newOffset);
      fetchMore(newOffset);
    }
  };

  const handleClearFilters = () => {
    setSearch("");
    setStatus(undefined);
    setFiberType(undefined);
    setInstallationType(undefined);
    setOffset(0);
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

  const formatFiberType = (type: string) => {
    return type
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <main className="max-w-7xl mx-auto px-6 py-12 space-y-8">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Fiber Cables</h1>
          <p className="text-sm text-muted-foreground">
            Manage and monitor fiber optic cable infrastructure
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search cables..."
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
                  setStatus(value === "all" ? undefined : (value as FiberCableStatus));
                  setOffset(0);
                }}
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {FIBER_CABLE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {formatFiberType(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Fiber Type Filter */}
            <div className="space-y-2">
              <Label htmlFor="fiberType">Fiber Type</Label>
              <Select
                value={fiberType || "all"}
                onValueChange={(value) => {
                  setFiberType(value === "all" ? undefined : (value as FiberType));
                  setOffset(0);
                }}
              >
                <SelectTrigger id="fiberType">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {FIBER_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {formatFiberType(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Installation Type Filter */}
            <div className="space-y-2">
              <Label htmlFor="installationType">Installation</Label>
              <Select
                value={installationType || "all"}
                onValueChange={(value) => {
                  setInstallationType(
                    value === "all" ? undefined : (value as CableInstallationType),
                  );
                  setOffset(0);
                }}
              >
                <SelectTrigger id="installationType">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {INSTALLATION_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {formatFiberType(type)}
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
              Cables{" "}
              {totalCount > 0 && <span className="text-muted-foreground">({totalCount})</span>}
            </CardTitle>
            {loading && <Badge variant="outline">Loading...</Badge>}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardHeader>
        <CardContent>
          {displayCables.length === 0 && !loading ? (
            <div className="text-center py-12">
              <Cable className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No fiber cables found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {search || status || fiberType || installationType
                  ? "Try adjusting your filters"
                  : "No fiber cables have been added to the system yet"}
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
                      <TableHead>Cable ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Installation</TableHead>
                      <TableHead className="text-right">Length</TableHead>
                      <TableHead className="text-right">Utilization</TableHead>
                      <TableHead className="text-right">Strands</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayCables.map((cable) => (
                      <TableRow key={cable.id}>
                        <TableCell className="font-medium">{cable.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {cable.cableId}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(cable.status)}>
                            {formatFiberType(cable.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatFiberType(cable.fiberType)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatFiberType(cable.installationType)}
                        </TableCell>
                        <TableCell className="text-right">
                          {(cable.lengthMeters / 1000).toFixed(2)} km
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={
                              cable.capacityUtilizationPercent > 80
                                ? "text-amber-600 font-medium"
                                : ""
                            }
                          >
                            {cable.capacityUtilizationPercent.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {cable.usedStrands} / {cable.totalStrands}
                        </TableCell>
                        <TableCell>
                          <Link href={`/dashboard/network/fiber/cables/${cable.id}`}>
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
                    cables
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
