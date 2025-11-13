"use client";

import { Card, CardHeader, CardContent, CardFooter } from "@dotmac/ui";
import { Skeleton } from "@dotmac/ui";
import React from "react";

/**
 * Skeleton loader for subscription card
 */
export const SubscriptionCardSkeleton: React.FC = () => {
  return (
    <Card variant="elevated">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-6 w-20" />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Billing Period */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-full" />
        </div>

        {/* Usage Metrics */}
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </div>
      </CardContent>

      <CardFooter className="flex gap-2">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 flex-1" />
      </CardFooter>
    </Card>
  );
};

/**
 * Skeleton loader for plan comparison cards
 */
export const PlanCardSkeleton: React.FC = () => {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-32 mb-2" />
        <Skeleton className="h-4 w-full" />
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Price */}
        <div className="space-y-1">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>

        {/* Features */}
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-start gap-2">
              <Skeleton className="w-4 h-4 rounded-full mt-0.5" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </CardContent>

      <CardFooter>
        <Skeleton className="h-10 w-full" />
      </CardFooter>
    </Card>
  );
};

/**
 * Skeleton loader for addon cards
 */
export const AddonCardSkeleton: React.FC = () => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 space-y-2">
            <Skeleton className="w-12 h-12 rounded-lg" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-full" />
          </div>
          <Skeleton className="h-6 w-20" />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Price */}
        <div className="flex items-baseline gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>

        {/* Features */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-24 mb-2" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-2">
              <Skeleton className="w-4 h-4 rounded-full mt-0.5" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </CardContent>

      <CardFooter>
        <Skeleton className="h-10 w-full" />
      </CardFooter>
    </Card>
  );
};

/**
 * Skeleton loader for payment method cards
 */
export const PaymentMethodCardSkeleton: React.FC = () => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="w-12 h-12 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <Skeleton className="h-6 w-20" />
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </CardContent>

      <CardFooter className="flex gap-2">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 flex-1" />
      </CardFooter>
    </Card>
  );
};

/**
 * Skeleton loader for active addon cards
 */
export const ActiveAddonCardSkeleton: React.FC = () => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-6 w-20" />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Price */}
        <div>
          <Skeleton className="h-6 w-32 mb-1" />
          <Skeleton className="h-4 w-48" />
        </div>

        {/* Period */}
        <div className="space-y-1">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-full" />
        </div>

        {/* Quantity */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-4 w-12" />
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex gap-2">
        <Skeleton className="h-9 flex-1" />
      </CardFooter>
    </Card>
  );
};

/**
 * Skeleton loader for stats cards
 */
export const StatsCardSkeleton: React.FC = () => {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-6">
        <Skeleton className="w-12 h-12 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-4 w-32" />
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Skeleton loader for invoice list
 */
export const InvoiceListSkeleton: React.FC = () => {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center justify-between p-4 rounded-lg border">
          <div className="flex items-center gap-4 flex-1">
            <Skeleton className="w-10 h-10 rounded-lg" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right space-y-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Full page skeleton for subscription page
 */
export const SubscriptionPageSkeleton: React.FC = () => {
  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-96" />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <StatsCardSkeleton key={i} />
        ))}
      </div>

      {/* Current Subscription */}
      <div className="space-y-4">
        <Skeleton className="h-7 w-48" />
        <SubscriptionCardSkeleton />
      </div>

      {/* Available Plans */}
      <div className="space-y-4">
        <Skeleton className="h-7 w-40" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <PlanCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Full page skeleton for addons page
 */
export const AddonsPageSkeleton: React.FC = () => {
  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-96" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <StatsCardSkeleton key={i} />
        ))}
      </div>

      {/* Active Addons */}
      <div className="space-y-4">
        <Skeleton className="h-7 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2].map((i) => (
            <ActiveAddonCardSkeleton key={i} />
          ))}
        </div>
      </div>

      {/* Browse Addons */}
      <div className="space-y-4">
        <Skeleton className="h-7 w-40" />
        {/* Filters */}
        <div className="flex gap-4">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-48" />
        </div>
        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <AddonCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Full page skeleton for payment methods page
 */
export const PaymentMethodsPageSkeleton: React.FC = () => {
  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-5 w-96" />
        </div>
        <Skeleton className="h-10 w-48" />
      </div>

      {/* Security Notice */}
      <Skeleton className="h-16 w-full rounded-lg" />

      {/* Payment Methods */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3].map((i) => (
            <PaymentMethodCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
};
