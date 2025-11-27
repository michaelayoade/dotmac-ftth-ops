"use client";

import React from "react";
import { useLicensing } from "@/hooks/useLicensing";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Alert, AlertDescription } from "@dotmac/ui";
import { Progress } from "@dotmac/ui";
import { Skeleton } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import {
  AlertCircle,
  Crown,
  Eye,
  Info,
  Package,
  ShieldCheck,
  TrendingUp,
  UserCog,
  Users,
} from "lucide-react";
import { SubscriptionStatus, BillingCycle } from "@/types/licensing";

// Type-safe license seat breakdown
interface SeatAllocation {
  role: string;
  icon: React.ElementType;
  allocated: number;
  used: number;
  color: string;
}

// Type-safe feature module summary
interface FeatureSummary {
  category: string;
  count: number;
  modules: string[];
}

export default function LicensesPage(): React.ReactElement {
  const {
    currentSubscription,
    subscriptionLoading,
    subscriptionError,
    modules,
    modulesLoading,
    quotas,
    quotasLoading,
  } = useLicensing();

  // Calculate seat allocations (example - would come from real API)
  const seatAllocations: SeatAllocation[] = React.useMemo(() => {
    const userQuota = quotas.find((q) => q.quota_code === "ACTIVE_USERS");
    const total = userQuota?.extra_metadata?.["limit"] || 50;
    const used = userQuota?.extra_metadata?.["current"] || 0;

    return [
      {
        role: "Admin",
        icon: Crown,
        allocated: Math.floor(total * 0.1),
        used: Math.floor(used * 0.11),
        color: "text-amber-500",
      },
      {
        role: "Operator",
        icon: UserCog,
        allocated: Math.floor(total * 0.6),
        used: Math.floor(used * 0.67),
        color: "text-blue-500",
      },
      {
        role: "Read-only",
        icon: Eye,
        allocated: Math.floor(total * 0.3),
        used: Math.floor(used * 0.22),
        color: "text-green-500",
      },
    ];
  }, [quotas]);

  // Calculate feature module summary by category
  const featureSummary: FeatureSummary[] = React.useMemo(() => {
    const categoryMap = new Map<string, string[]>();

    modules
      .filter((m) => m.is_active)
      .forEach((module) => {
        const category = module.category ?? "uncategorized";
        if (!categoryMap.has(category)) {
          categoryMap.set(category, []);
        }
        categoryMap.get(category)?.push(module.module_name);
      });

    return Array.from(categoryMap.entries())
      .map(([category, moduleNames]) => ({
        category,
        count: moduleNames.length,
        modules: moduleNames,
      }))
      .sort((a, b) => b.count - a.count);
  }, [modules]);

  // Calculate total seats
  const totalSeats: number = seatAllocations.reduce((sum, seat) => sum + seat.allocated, 0);
  const usedSeats: number = seatAllocations.reduce((sum, seat) => sum + seat.used, 0);
  const availableSeats: number = totalSeats - usedSeats;
  const utilizationPercent: number = totalSeats > 0 ? (usedSeats / totalSeats) * 100 : 0;

  // Get subscription status badge
  const getStatusBadge = (status?: SubscriptionStatus): React.ReactElement => {
    const statusConfig: Record<
      SubscriptionStatus,
      { variant: "default" | "secondary" | "destructive" | "outline"; label: string }
    > = {
      [SubscriptionStatus.ACTIVE]: { variant: "default", label: "Active" },
      [SubscriptionStatus.TRIAL]: { variant: "secondary", label: "Trial" },
      [SubscriptionStatus.PAST_DUE]: { variant: "destructive", label: "Past Due" },
      [SubscriptionStatus.CANCELED]: { variant: "outline", label: "Canceled" },
      [SubscriptionStatus.EXPIRED]: { variant: "destructive", label: "Expired" },
      [SubscriptionStatus.SUSPENDED]: { variant: "destructive", label: "Suspended" },
    };

    const config = status
      ? statusConfig[status]
      : { variant: "outline" as const, label: "Unknown" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // Loading state
  if (subscriptionLoading || modulesLoading || quotasLoading) {
    return (
      <div className="container mx-auto py-8 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  // Error state
  if (subscriptionError) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {subscriptionError instanceof Error
              ? subscriptionError.message
              : "Failed to load license information"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">License Management</h1>
            <p className="text-muted-foreground mt-1">
              Manage your DotMac subscription licenses and seat allocation
            </p>
          </div>
          {currentSubscription && getStatusBadge(currentSubscription.status)}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Seats */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Seats</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSeats}</div>
            <p className="text-xs text-muted-foreground mt-1">Licensed user seats</p>
          </CardContent>
        </Card>

        {/* Used Seats */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Used Seats</CardTitle>
            <UserCog className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usedSeats}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {utilizationPercent.toFixed(0)}% utilization
            </p>
          </CardContent>
        </Card>

        {/* Available Seats */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Seats</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{availableSeats}</div>
            <p className="text-xs text-muted-foreground mt-1">Ready to assign</p>
          </CardContent>
        </Card>

        {/* Active Modules */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Modules</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{modules.filter((m) => m.is_active).length}</div>
            <p className="text-xs text-muted-foreground mt-1">Feature modules enabled</p>
          </CardContent>
        </Card>
      </div>

      {/* Seat Allocation Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Seat Allocation by Role</CardTitle>
          <CardDescription>
            License allocation across different user roles in your organization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Overall Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Overall Utilization</span>
              <span className="text-muted-foreground">
                {usedSeats} of {totalSeats} seats
              </span>
            </div>
            <Progress value={utilizationPercent} className="h-2" />
          </div>

          {/* Per-Role Breakdown */}
          <div className="space-y-4">
            {seatAllocations.map((seat) => {
              const Icon = seat.icon;
              const roleUtilization = seat.allocated > 0 ? (seat.used / seat.allocated) * 100 : 0;

              return (
                <div key={seat.role} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${seat.color}`} />
                      <span className="font-medium text-sm">{seat.role}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {seat.used} / {seat.allocated}
                    </span>
                  </div>
                  <Progress value={roleUtilization} className="h-1.5" />
                </div>
              );
            })}
          </div>
        </CardContent>
        <CardFooter className="border-t pt-6">
          <Button variant="outline" className="w-full" disabled={availableSeats > 10}>
            <TrendingUp className="mr-2 h-4 w-4" />
            Purchase Additional Seats
          </Button>
        </CardFooter>
      </Card>

      {/* Subscription Details */}
      {currentSubscription && (
        <Card>
          <CardHeader>
            <CardTitle>Current Subscription</CardTitle>
            <CardDescription>Your DotMac platform subscription details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Plan</p>
                <p className="text-lg font-semibold">
                  {currentSubscription.plan?.plan_name || "Custom Plan"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Billing Cycle</p>
                <p className="text-lg font-semibold">
                  {currentSubscription.billing_cycle === BillingCycle.ANNUAL ? "Annual" : "Monthly"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Monthly Cost</p>
                <p className="text-lg font-semibold">
                  ${currentSubscription.monthly_price.toFixed(2)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Current Period</p>
                <p className="text-sm">
                  {new Date(currentSubscription.current_period_start).toLocaleDateString()} -{" "}
                  {new Date(currentSubscription.current_period_end).toLocaleDateString()}
                </p>
              </div>
            </div>

            {currentSubscription.status === SubscriptionStatus.TRIAL &&
              currentSubscription.trial_end && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Your trial period ends on{" "}
                    {new Date(currentSubscription.trial_end).toLocaleDateString()}. Add a payment
                    method to continue after the trial.
                  </AlertDescription>
                </Alert>
              )}
          </CardContent>
        </Card>
      )}

      {/* Feature Modules */}
      <Card>
        <CardHeader>
          <CardTitle>Enabled Feature Modules</CardTitle>
          <CardDescription>Feature modules included in your subscription plan</CardDescription>
        </CardHeader>
        <CardContent>
          {featureSummary.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {featureSummary.map((summary) => (
                <Card key={summary.category} className="border-muted">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">
                        {summary.category.replace(/_/g, " ")}
                      </CardTitle>
                      <Badge variant="secondary">{summary.count}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    <ul className="space-y-1 list-disc list-inside">
                      {summary.modules.slice(0, 3).map((module) => (
                        <li key={module}>{module}</li>
                      ))}
                      {summary.modules.length > 3 && (
                        <li className="font-medium">+{summary.modules.length - 3} more</li>
                      )}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No feature modules enabled</p>
              <p className="text-sm mt-1">Upgrade your plan to unlock features</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Licenses are used to manage access to the DotMac platform for your organization&apos;s
          staff. To manage your internet service customers, use the{" "}
          <strong>ISP Operations Dashboard</strong>.
        </AlertDescription>
      </Alert>
    </div>
  );
}
