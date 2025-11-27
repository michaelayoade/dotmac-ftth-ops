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
import { useRBAC } from "@/contexts/RBACContext";
import { useServiceAreaListGraphQL } from "@/hooks/useFiberGraphQL";
import { ServiceAreaType } from "@/lib/graphql/generated";
import { useAppConfig } from "@/providers/AppConfigContext";
import {
  MapPin,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Cable,
  TrendingUp,
  Home,
} from "lucide-react";
import Link from "next/link";

const SERVICE_AREA_TYPES: ServiceAreaType[] = [
  ServiceAreaType.Residential,
  ServiceAreaType.Commercial,
  ServiceAreaType.Industrial,
  ServiceAreaType.Mixed,
];

export default function ServiceAreasPage() {
  const { hasPermission } = useRBAC();
  const { features } = useAppConfig();
  const hasFiberAccess = features.enableNetwork && hasPermission("isp.ipam.read");

  // Filter state
  const [search, setSearch] = useState("");
  const [areaType, setAreaType] = useState<ServiceAreaType | undefined>(undefined);
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);

  // Fetch service areas with filters
  const serviceAreaOptions: Parameters<typeof useServiceAreaListGraphQL>[0] = {
    limit,
    offset,
    pollInterval: 60000,
  };
  if (areaType) {
    serviceAreaOptions.areaType = areaType;
  }
  const trimmedSearch = search.trim();
  if (trimmedSearch) {
    serviceAreaOptions.search = trimmedSearch;
  }

  const { serviceAreas, totalCount, hasNextPage, loading, error, refetch } =
    useServiceAreaListGraphQL(serviceAreaOptions);

  if (!hasFiberAccess) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-12 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Service Areas</CardTitle>
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
    setAreaType(undefined);
    setOffset(0);
  };

  const formatType = (type: string) => {
    return type
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const getAreaTypeBadgeVariant = (type: string) => {
    switch (type) {
      case "RESIDENTIAL":
        return "default";
      case "COMMERCIAL":
        return "secondary";
      case "INDUSTRIAL":
        return "outline";
      case "MIXED":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getPenetrationColor = (percent: number) => {
    if (percent >= 75) return "text-green-600";
    if (percent >= 50) return "text-green-500";
    if (percent >= 25) return "text-amber-500";
    return "text-red-600";
  };

  const getServiceableStatus = (isServiceable: boolean, isActive: boolean) => {
    if (!isActive) return { label: "Inactive", variant: "secondary" as const };
    if (isServiceable) return { label: "Serviceable", variant: "default" as const };
    return { label: "Not Serviceable", variant: "destructive" as const };
  };

  return (
    <main className="max-w-7xl mx-auto px-6 py-12 space-y-8">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Service Areas</h1>
          <p className="text-sm text-muted-foreground">
            Fiber coverage areas and customer penetration metrics
          </p>
        </div>
        <Link href="/dashboard/network/fiber">
          <Button variant="outline">
            <Cable className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
      </header>

      {/* Summary Cards */}
      {!loading && serviceAreas.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Areas</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCount}</div>
              <p className="text-xs text-muted-foreground">Service coverage zones</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Homes Passed</CardTitle>
              <Home className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {serviceAreas.reduce((sum, area) => sum + area.homesPassed, 0).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                {serviceAreas.reduce((sum, area) => sum + area.homesConnected, 0).toLocaleString()}{" "}
                connected
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Penetration</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(
                  serviceAreas.reduce((sum, area) => sum + (area.penetrationRatePercent || 0), 0) /
                  serviceAreas.length
                ).toFixed(1)}
                %
              </div>
              <p className="text-xs text-muted-foreground">Across all areas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Coverage</CardTitle>
              <Cable className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {serviceAreas.reduce((sum, area) => sum + area.areaSqkm, 0).toFixed(1)} km²
              </div>
              <p className="text-xs text-muted-foreground">Total area coverage</p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search */}
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by name, city, or postal code..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setOffset(0);
                  }}
                  className="pl-8"
                />
              </div>
            </div>

            {/* Area Type Filter */}
            <div className="space-y-2">
              <Label htmlFor="areaType">Area Type</Label>
              <Select
                value={areaType || "all"}
                onValueChange={(value) => {
                  setAreaType(value === "all" ? undefined : (value as ServiceAreaType));
                  setOffset(0);
                }}
              >
                <SelectTrigger id="areaType">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {SERVICE_AREA_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {formatType(type)}
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
              Service Areas{" "}
              {totalCount > 0 && <span className="text-muted-foreground">({totalCount})</span>}
            </CardTitle>
            {loading && <Badge variant="outline">Loading...</Badge>}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardHeader>
        <CardContent>
          {serviceAreas.length === 0 && !loading ? (
            <div className="text-center py-12">
              <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No service areas found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {search || areaType
                  ? "Try adjusting your filters"
                  : "No service areas have been added to the system yet"}
              </p>
              <Button variant="outline" onClick={() => refetch()}>
                Refresh
              </Button>
            </div>
          ) : (
            <>
              {/* Grid View */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {serviceAreas.map((area) => {
                  const serviceableStatus = getServiceableStatus(area.isServiceable, area.isActive);
                  return (
                    <Card key={area.id} className="hover:border-primary/50 transition-colors">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 flex-1">
                            <CardTitle className="text-lg">{area.name}</CardTitle>
                            <CardDescription>
                              {area.city}, {area.stateProvince}
                            </CardDescription>
                          </div>
                          <Badge variant={getAreaTypeBadgeVariant(area.areaType)}>
                            {formatType(area.areaType)}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Status */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Status</span>
                          <Badge variant={serviceableStatus.variant}>
                            {serviceableStatus.label}
                          </Badge>
                        </div>

                        {/* Penetration Rate */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Penetration Rate</span>
                            <span
                              className={`text-lg font-bold ${getPenetrationColor(area.penetrationRatePercent || 0)}`}
                            >
                              {area.penetrationRatePercent?.toFixed(1) || 0}%
                            </span>
                          </div>
                          <div className="w-full bg-secondary rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                (area.penetrationRatePercent || 0) >= 75
                                  ? "bg-green-600"
                                  : (area.penetrationRatePercent || 0) >= 50
                                    ? "bg-green-500"
                                    : (area.penetrationRatePercent || 0) >= 25
                                      ? "bg-amber-500"
                                      : "bg-red-600"
                              }`}
                              style={{
                                width: `${area.penetrationRatePercent || 0}%`,
                              }}
                            />
                          </div>
                        </div>

                        {/* Homes */}
                        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Homes Passed</div>
                            <div className="text-lg font-semibold">
                              {area.homesPassed.toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Connected</div>
                            <div className="text-lg font-semibold text-green-600">
                              {area.homesConnected.toLocaleString()}
                            </div>
                          </div>
                        </div>

                        {/* Businesses */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">
                              Businesses Passed
                            </div>
                            <div className="text-sm font-medium">
                              {area.businessesPassed.toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Connected</div>
                            <div className="text-sm font-medium text-green-600">
                              {area.businessesConnected.toLocaleString()}
                            </div>
                          </div>
                        </div>

                        {/* Infrastructure */}
                        <div className="grid grid-cols-2 gap-4 pt-2 border-t text-xs">
                          <div>
                            <div className="text-muted-foreground mb-1">Area</div>
                            <div className="font-medium">{area.areaSqkm.toFixed(2)} km²</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground mb-1">Fiber</div>
                            <div className="font-medium">{area.totalFiberKm.toFixed(1)} km</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground mb-1">Dist. Points</div>
                            <div className="font-medium">{area.distributionPointCount}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground mb-1">Capacity</div>
                            <div className="font-medium">
                              {area.capacityUtilizationPercent.toFixed(0)}%
                            </div>
                          </div>
                        </div>

                        {/* Postal Codes */}
                        {area.postalCodes.length > 0 && (
                          <div className="pt-2 border-t">
                            <div className="text-xs text-muted-foreground mb-2">Postal Codes</div>
                            <div className="flex flex-wrap gap-1">
                              {area.postalCodes.slice(0, 3).map((code) => (
                                <Badge key={code} variant="outline" className="text-xs">
                                  {code}
                                </Badge>
                              ))}
                              {area.postalCodes.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{area.postalCodes.length - 3} more
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}

                        {/* View Details Button */}
                        <Link
                          href={`/dashboard/network/fiber/service-areas/${area.id}`}
                          className="block"
                        >
                          <Button variant="outline" className="w-full mt-2">
                            View Details
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalCount > limit && (
                <div className="flex items-center justify-between pt-6 border-t mt-6">
                  <p className="text-sm text-muted-foreground">
                    Showing {offset + 1} to {Math.min(offset + limit, totalCount)} of {totalCount}{" "}
                    areas
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
