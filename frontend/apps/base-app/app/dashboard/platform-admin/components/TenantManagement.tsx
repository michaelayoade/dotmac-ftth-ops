"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { platformAdminTenantService } from "@/lib/services/platform-admin-tenant-service";
import { usePlatformTenants } from "@/hooks/usePlatformTenants";
import { tenantService, Tenant } from "@/lib/services/tenant-service";
import { Building2, ChevronLeft, ChevronRight, Eye, Key, Plus, Search, Users } from "lucide-react";
import { TenantOnboardingWizard } from "@/components/tenant/TenantOnboardingWizard";

interface PaginationState {
  page: number;
  pageSize: number;
}

interface FiltersState {
  search: string;
  status: string;
  plan: string;
}

const STATUS_FILTERS = [
  { label: "All statuses", value: "" },
  { label: "Active", value: "active" },
  { label: "Trial", value: "trial" },
  { label: "Suspended", value: "suspended" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Expired", value: "expired" },
];

const PLAN_FILTERS = [
  { label: "All plans", value: "" },
  { label: "Free", value: "free" },
  { label: "Starter", value: "starter" },
  { label: "Professional", value: "professional" },
  { label: "Enterprise", value: "enterprise" },
  { label: "Custom", value: "custom" },
];

export function TenantManagement() {
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    pageSize: 10,
  });
  const [filters, setFilters] = useState<FiltersState>({
    search: "",
    status: "",
    plan: "",
  });
  const [impersonateTenantId, setImpersonateTenantId] = useState<string | null>(null);
  const [impersonationDuration, setImpersonationDuration] = useState(60);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailTenant, setDetailTenant] = useState<Tenant | null>(null);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  const { toast } = useToast();
  const queryParams = useMemo(
    () => ({
      page: pagination.page,
      pageSize: pagination.pageSize,
      search: filters.search.trim() || undefined,
      status: filters.status || undefined,
      plan: filters.plan || undefined,
    }),
    [pagination.page, pagination.pageSize, filters.search, filters.status, filters.plan],
  );

  const { data, isLoading, isFetching } = usePlatformTenants(queryParams);

  const impersonateMutation = useMutation({
    mutationFn: (tenantId: string) =>
      platformAdminTenantService.impersonateTenant(tenantId, impersonationDuration),
    onSuccess: (response, tenantId) => {
      if (response.access_token) {
        sessionStorage.setItem("impersonation_token", response.access_token);
      }
      if (response.refresh_token) {
        sessionStorage.setItem("impersonation_refresh_token", response.refresh_token);
      }
      sessionStorage.setItem("impersonating_tenant", tenantId);

      toast({
        title: "Impersonation Active",
        description: `Now operating as tenant ${tenantId}.`,
      });
      setImpersonateTenantId(null);
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Could not create impersonation token";
      toast({
        title: "Impersonation Failed",
        description: message,
        variant: "destructive",
      });
    },
  });

  const openDetail = async (tenantId: string) => {
    try {
      setIsDetailOpen(true);
      setDetailTenant(null);
      const tenant = await platformAdminTenantService.getTenantDetails(tenantId);
      setDetailTenant(tenant);
    } catch (error) {
      setIsDetailOpen(false);
      toast({
        title: "Failed to load tenant",
        description: error instanceof Error ? error.message : "Unable to load tenant details",
        variant: "destructive",
      });
    }
  };

  const tenants = data?.tenants ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.ceil(total / pagination.pageSize);

  const handlePageChange = (direction: "next" | "prev") => {
    setPagination((prev) => {
      const nextPage = direction === "next" ? prev.page + 1 : prev.page - 1;
      return {
        ...prev,
        page: Math.min(Math.max(nextPage, 1), pageCount || 1),
      };
    });
  };

  const onSearchChange = (value: string) => {
    setFilters((prev) => ({ ...prev, search: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const onStatusChange = (value: string) => {
    setFilters((prev) => ({ ...prev, status: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const onPlanChange = (value: string) => {
    setFilters((prev) => ({ ...prev, plan: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Tenant Management</CardTitle>
              <CardDescription>
                Search, filter, and act on tenants across the platform.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{total} tenants</Badge>
              <Button onClick={() => setIsOnboardingOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Tenant
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or tenant ID"
                value={filters.search}
                onChange={(event) => onSearchChange(event.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                className="w-full sm:w-40 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                value={filters.status}
                onChange={(event) => onStatusChange(event.target.value)}
              >
                {STATUS_FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                className="w-full sm:w-40 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                value={filters.plan}
                onChange={(event) => onPlanChange(event.target.value)}
              >
                {PLAN_FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden xl:table-cell">Tenant ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Plan</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Users className="h-4 w-4" />
                      Users
                    </div>
                  </TableHead>
                  <TableHead className="hidden md:table-cell text-right">Resources</TableHead>
                  <TableHead className="hidden md:table-cell">Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: pagination.pageSize }).map((_, index) => (
                    <TableRow key={`skeleton-${index}`}>
                      <TableCell colSpan={8}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : tenants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                      No tenants found with the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  tenants.map((tenant) => (
                    <TableRow key={tenant.id}>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{tenant.name}</span>
                          {tenant.slug && (
                            <span className="text-xs text-muted-foreground">@{tenant.slug}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden font-mono text-xs xl:table-cell">
                        {tenant.id}
                      </TableCell>
                      <TableCell>
                        <Badge variant={tenant.status === "active" ? "default" : "outline"}>
                          {tenant.status ?? "unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden capitalize lg:table-cell">
                        {tenant.subscription?.plan ?? "—"}
                      </TableCell>
                      <TableCell className="hidden text-right sm:table-cell">
                        <Badge variant="secondary">{tenant.usage?.users ?? 0}</Badge>
                      </TableCell>
                      <TableCell className="hidden text-right md:table-cell">
                        <Badge variant="secondary">{tenant.usage?.storage_gb ?? 0}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {tenant.created_at ? new Date(tenant.created_at).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openDetail(tenant.id)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setImpersonateTenantId(tenant.id)}
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {total > pagination.pageSize && (
            <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Showing{" "}
                {`${(pagination.page - 1) * pagination.pageSize + 1}-${Math.min(
                  pagination.page * pagination.pageSize,
                  total,
                )}`}{" "}
                of {total}
              </p>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange("prev")}
                  disabled={pagination.page <= 1 || isFetching}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {pagination.page} of {pageCount || 1}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange("next")}
                  disabled={pagination.page >= pageCount || tenants.length === 0 || isFetching}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={impersonateTenantId !== null} onOpenChange={() => setImpersonateTenantId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Impersonate Tenant</DialogTitle>
            <DialogDescription>
              Generate a scoped access token to inspect tenant-specific issues. The token will be
              stored locally for manual workflows.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Target tenant</p>
              <Badge variant="outline" className="mt-1 font-mono">
                {impersonateTenantId}
              </Badge>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">Duration (minutes)</p>
              <Input
                type="number"
                min={5}
                max={480}
                value={impersonationDuration}
                onChange={(event) => setImpersonationDuration(Number(event.target.value))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Maximum duration is 480 minutes (8 hours).
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setImpersonateTenantId(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => impersonateTenantId && impersonateMutation.mutate(impersonateTenantId)}
              disabled={impersonateMutation.isPending}
            >
              {impersonateMutation.isPending ? "Creating…" : "Create token"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              Tenant details
            </DialogTitle>
            <DialogDescription>
              Review high-level tenant information, plan, and quotas.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-6">
            {!detailTenant ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-5/6" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : (
              <>
                <div>
                  <p className="text-sm text-muted-foreground">Tenant name</p>
                  <p className="mt-1 text-lg font-semibold">{detailTenant.name}</p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Tenant ID</p>
                    <p className="mt-1 font-mono text-xs">{detailTenant.id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge
                      variant={detailTenant.status === "active" ? "default" : "outline"}
                      className="mt-1"
                    >
                      {tenantService.getStatusDisplayName(detailTenant.status)}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Plan</p>
                    <Badge variant="secondary" className="mt-1">
                      {tenantService.getPlanDisplayName(detailTenant.plan ?? "free")}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Billing cycle</p>
                    <p className="mt-1 capitalize">{detailTenant.billing_cycle ?? "monthly"}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Contact</p>
                  <div className="mt-2 space-y-2">
                    <p className="text-sm">
                      <span className="font-medium">Email:</span>{" "}
                      {detailTenant.contact_email ?? "—"}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Billing email:</span>{" "}
                      {detailTenant.billing_email ?? "—"}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Phone:</span>{" "}
                      {detailTenant.contact_phone ?? "—"}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="mt-1">
                    {detailTenant.created_at
                      ? new Date(detailTenant.created_at).toLocaleString()
                      : "—"}
                  </p>
                </div>

                {detailTenant.description && (
                  <div>
                    <p className="text-sm text-muted-foreground">Description</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                      {detailTenant.description}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Tenant Onboarding Wizard */}
      <TenantOnboardingWizard
        open={isOnboardingOpen}
        onOpenChange={setIsOnboardingOpen}
        onSuccess={() => {
          toast({
            title: "Success",
            description: "Tenant has been onboarded successfully",
          });
        }}
      />
    </div>
  );
}
