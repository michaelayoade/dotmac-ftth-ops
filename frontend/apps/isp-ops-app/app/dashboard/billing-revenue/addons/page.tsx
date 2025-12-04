"use client";

import React, { useMemo, useState } from "react";
import { useTenantAddons, Addon } from "@/hooks/useTenantAddons";
import { AddonCard } from "@/components/tenant/billing/AddonCard";
import { ActiveAddonCard } from "@/components/tenant/billing/ActiveAddonCard";
import { AddonsPageSkeleton } from "@/components/tenant/billing/SkeletonLoaders";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Alert,
  AlertDescription,
  AlertTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@dotmac/ui";
import { AlertCircle, Search, Zap, RefreshCw } from "lucide-react";
import { toast } from "@dotmac/ui";
import { RouteGuard } from "@/components/auth/PermissionGuard";

export default function BillingAddonsPage() {
  const {
    availableAddons,
    activeAddons,
    loading,
    error,
    fetchAvailableAddons,
    purchaseAddon,
    updateAddonQuantity,
    cancelAddon,
    reactivateAddon,
  } = useTenantAddons();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterBillingType, setFilterBillingType] = useState<string>("all");
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  React.useEffect(() => {
    const loadAddons = async () => {
      try {
        if (availableAddons.length === 0) {
          await fetchAvailableAddons();
        }
      } catch (err: any) {
        const errorMsg = err?.response?.data?.detail || "Failed to load add-ons marketplace";
        toast.error(errorMsg);
      }
    };
    loadAddons();
  }, [availableAddons.length, fetchAvailableAddons]);

  const filteredAddons = useMemo(() => {
    let filtered = availableAddons;

    if (filterType !== "all") {
      filtered = filtered.filter((addon) => addon.addon_type === filterType);
    }

    if (filterBillingType !== "all") {
      filtered = filtered.filter((addon) => addon.billing_type === filterBillingType);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (addon) =>
          addon.name.toLowerCase().includes(query) ||
          (addon["description"]?.toLowerCase() ?? "").includes(query),
      );
    }

    return filtered;
  }, [availableAddons, filterType, filterBillingType, searchQuery]);

  const handlePurchaseAddon = async (addonId: string, quantity: number) => {
    setIsPurchasing(true);
    try {
      await purchaseAddon(addonId, { quantity });
      toast.success("Add-on purchased successfully!");
    } catch (err: any) {
      const errorMsg = err?.response?.data?.detail || "Failed to purchase add-on";
      toast.error(errorMsg);
      console.error("Failed to purchase add-on:", err);
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleUpdateQuantity = async (tenantAddonId: string, quantity: number) => {
    setIsUpdating(true);
    try {
      await updateAddonQuantity(tenantAddonId, { quantity });
      toast.success("Add-on quantity updated successfully!");
    } catch (err: any) {
      const errorMsg = err?.response?.data?.detail || "Failed to update add-on quantity";
      toast.error(errorMsg);
      console.error("Failed to update add-on quantity:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelAddon = async (tenantAddonId: string, cancelImmediately: boolean = false) => {
    try {
      await cancelAddon(tenantAddonId, {
        cancel_at_period_end: !cancelImmediately,
        cancel_immediately: cancelImmediately,
      });
      toast.success("Add-on cancelled");
    } catch (err: any) {
      const errorMsg = err?.response?.data?.detail || "Failed to cancel add-on";
      toast.error(errorMsg);
      console.error("Failed to cancel add-on:", err);
    }
  };

  const handleReactivateAddon = async (tenantAddonId: string) => {
    try {
      await reactivateAddon(tenantAddonId);
      toast.success("Add-on reactivated");
    } catch (err: any) {
      const errorMsg = err?.response?.data?.detail || "Failed to reactivate add-on";
      toast.error(errorMsg);
      console.error("Failed to reactivate add-on:", err);
    }
  };

  return (
    <RouteGuard permission="billing.read">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-500" />
            <h1 className="text-2xl font-semibold">Add-ons Marketplace</h1>
          </div>
          <p className="text-muted-foreground">
            Discover optional services and capacity boosts you can attach to your ISP tenant.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Failed to load add-ons</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <AddonsPageSkeleton />
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Active Add-ons</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {activeAddons.length === 0 ? (
                  <div className="text-muted-foreground">No active add-ons yet.</div>
                ) : (
                  activeAddons.map((addon) => (
                    <ActiveAddonCard
                      key={addon.tenant_addon_id || addon.addon_id}
                      addon={addon}
                      onUpdateQuantity={handleUpdateQuantity}
                      onCancel={(id) => handleCancelAddon(id, false)}
                      onReactivate={handleReactivateAddon}
                      isUpdating={isUpdating}
                    />
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <CardTitle>Browse Add-ons</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Capacity, automation, and premium support options.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative w-64">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search add-ons..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                    <Button variant="outline" onClick={fetchAvailableAddons}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh
                    </Button>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      <SelectItem value="performance">Performance</SelectItem>
                      <SelectItem value="security">Security</SelectItem>
                      <SelectItem value="support">Support</SelectItem>
                      <SelectItem value="storage">Storage</SelectItem>
                      <SelectItem value="network">Network</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterBillingType} onValueChange={setFilterBillingType}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Filter by billing" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All billing types</SelectItem>
                      <SelectItem value="recurring">Recurring</SelectItem>
                      <SelectItem value="one_time">One-time</SelectItem>
                      <SelectItem value="usage_based">Usage-based</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {filteredAddons.length === 0 ? (
                  <div className="text-muted-foreground">No add-ons match your filters.</div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredAddons.map((addon: Addon) => (
                      <AddonCard
                        key={addon.addon_id}
                        addon={addon}
                        onPurchase={handlePurchaseAddon}
                        isPurchasing={isPurchasing}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </RouteGuard>
  );
}
