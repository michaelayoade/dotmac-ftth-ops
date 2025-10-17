'use client';

import React, { useState, useMemo } from 'react';
import { useTenantAddons, Addon, CancelAddonRequest } from '@/hooks/useTenantAddons';
import { AddonCard } from '@/components/tenant/billing/AddonCard';
import { ActiveAddonCard } from '@/components/tenant/billing/ActiveAddonCard';
import { AddonsPageSkeleton } from '@/components/tenant/billing/SkeletonLoaders';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertCircle, Search, Package, TrendingUp, Zap } from 'lucide-react';

export default function AddonsPage() {
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

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterBillingType, setFilterBillingType] = useState<string>('all');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [addonToCancel, setAddonToCancel] = useState<string | null>(null);
  const [cancelImmediately, setCancelImmediately] = useState(false);

  // Fetch available add-ons on mount
  React.useEffect(() => {
    if (availableAddons.length === 0) {
      fetchAvailableAddons();
    }
  }, []);

  // Filter and search add-ons
  const filteredAddons = useMemo(() => {
    let filtered = availableAddons;

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter((addon) => addon.addon_type === filterType);
    }

    // Filter by billing type
    if (filterBillingType !== 'all') {
      filtered = filtered.filter((addon) => addon.billing_type === filterBillingType);
    }

    // Search by name or description
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (addon) =>
          addon.name.toLowerCase().includes(query) ||
          addon.description.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [availableAddons, filterType, filterBillingType, searchQuery]);

  const handlePurchaseAddon = async (addonId: string, quantity: number) => {
    setIsPurchasing(true);
    try {
      await purchaseAddon(addonId, { quantity });
    } catch (err: any) {
      console.error('Failed to purchase add-on:', err);
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleUpdateQuantity = async (tenantAddonId: string, quantity: number) => {
    setIsUpdating(true);
    try {
      await updateAddonQuantity(tenantAddonId, { quantity });
    } catch (err: any) {
      console.error('Failed to update add-on quantity:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelAddon = (tenantAddonId: string) => {
    setAddonToCancel(tenantAddonId);
    setCancelImmediately(false);
    setCancelModalOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!addonToCancel) return;

    setIsUpdating(true);
    try {
      const request: CancelAddonRequest = {
        cancel_immediately: cancelImmediately,
      };
      await cancelAddon(addonToCancel, request);
      setCancelModalOpen(false);
      setAddonToCancel(null);
    } catch (err: any) {
      console.error('Failed to cancel add-on:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReactivateAddon = async (tenantAddonId: string) => {
    setIsUpdating(true);
    try {
      await reactivateAddon(tenantAddonId);
    } catch (err: any) {
      console.error('Failed to reactivate add-on:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading && availableAddons.length === 0) {
    return <AddonsPageSkeleton />;
  }

  if (error && availableAddons.length === 0) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Add-ons Marketplace</h1>
        <p className="text-muted-foreground">Enhance your subscription with additional features and resources.</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Package className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeAddons.length}</p>
              <p className="text-sm text-muted-foreground">Active Add-ons</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{availableAddons.length}</p>
              <p className="text-sm text-muted-foreground">Available Add-ons</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Zap className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{availableAddons.filter(a => a.is_featured).length}</p>
              <p className="text-sm text-muted-foreground">Featured Add-ons</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Add-ons Section */}
      {activeAddons.length > 0 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold">Your Active Add-ons</h2>
            <p className="text-muted-foreground mt-1">Manage your purchased add-ons and subscriptions</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeAddons.map((addon) => (
              <ActiveAddonCard
                key={addon.tenant_addon_id}
                addon={addon}
                onUpdateQuantity={handleUpdateQuantity}
                onCancel={handleCancelAddon}
                onReactivate={handleReactivateAddon}
                isUpdating={isUpdating}
              />
            ))}
          </div>
        </div>
      )}

      {/* Browse Add-ons Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold">Browse Add-ons</h2>
          <p className="text-muted-foreground mt-1">Discover add-ons to extend your platform capabilities</p>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search add-ons..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="feature">Feature</SelectItem>
              <SelectItem value="resource">Resource</SelectItem>
              <SelectItem value="service">Service</SelectItem>
              <SelectItem value="user_seats">User Seats</SelectItem>
              <SelectItem value="integration">Integration</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterBillingType} onValueChange={setFilterBillingType}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="Filter by billing" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Billing Types</SelectItem>
              <SelectItem value="recurring">Recurring</SelectItem>
              <SelectItem value="one_time">One-time</SelectItem>
              <SelectItem value="metered">Pay-as-you-go</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Add-ons Grid */}
        {filteredAddons.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAddons.map((addon) => (
              <AddonCard
                key={addon.addon_id}
                addon={addon}
                onPurchase={handlePurchaseAddon}
                isPurchasing={isPurchasing}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-50 text-muted-foreground" />
              <p className="text-muted-foreground">No add-ons found matching your filters</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setSearchQuery('');
                  setFilterType('all');
                  setFilterBillingType('all');
                }}
              >
                Clear Filters
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Cancel Confirmation Modal */}
      <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Add-on</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this add-on?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="cancelImmediately"
                checked={cancelImmediately}
                onChange={(e) => setCancelImmediately(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="cancelImmediately" className="text-sm">
                Cancel immediately (otherwise cancels at end of billing period)
              </label>
            </div>

            {cancelImmediately && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Immediate cancellation will end your access right away and may result in a prorated refund.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCancelModalOpen(false);
                setAddonToCancel(null);
              }}
              disabled={isUpdating}
            >
              Keep Add-on
            </Button>
            <Button variant="destructive" onClick={handleConfirmCancel} disabled={isUpdating}>
              {isUpdating ? 'Canceling...' : 'Confirm Cancellation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
