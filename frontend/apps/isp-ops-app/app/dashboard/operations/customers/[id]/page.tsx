"use client";

import { useCustomer360ViewGraphQL } from "@/hooks/useCustomersGraphQL";
import { CustomerHeader } from "@/components/customers/detail/CustomerHeader";
import { CustomerOverviewCard } from "@/components/customers/detail/CustomerOverviewCard";
import { QuickActionsCard } from "@/components/customers/detail/QuickActionsCard";
import { SubscriptionCard } from "@/components/customers/detail/SubscriptionCard";
import { NetworkStatusCard } from "@/components/customers/detail/NetworkStatusCard";
import { DevicesSummaryCard } from "@/components/customers/detail/DevicesSummaryCard";
import { TicketsSummaryCard } from "@/components/customers/detail/TicketsSummaryCard";
import { BillingSummaryCard } from "@/components/customers/detail/BillingSummaryCard";
import { CustomerDetailSkeleton } from "@/components/customers/detail/CustomerDetailSkeleton";
import { Alert, AlertDescription } from "@dotmac/ui";
import { AlertCircle } from "lucide-react";

export default function CustomerDetailPage({ params }: { params: { id: string } }) {
  const { customer, subscriptions, network, devices, tickets, billing, isLoading, error, refetch } =
    useCustomer360ViewGraphQL({
      customerId: params["id"],
      enabled: true,
    });

  if (isLoading) {
    return <CustomerDetailSkeleton />;
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Failed to load customer details: {error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Customer not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  const displayName = customer.displayName ?? customer.companyName;
  const headerCustomer = {
    id: customer.id,
    ...(displayName ? { display_name: displayName } : {}),
    email: customer.email,
    status: customer.status,
  };

  const overviewCustomer = {
    id: customer.id,
    ...(displayName ? { display_name: displayName } : {}),
    email: customer.email,
    ...(customer.phone !== undefined && customer.phone !== null ? { phone: customer.phone } : {}),
    ...(customer.createdAt ? { createdAt: customer.createdAt } : {}),
    ...(customer.tier ? { tier: customer.tier } : {}),
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header: Customer name, status badge, health score */}
      <CustomerHeader customer={headerCustomer} onRefresh={refetch} />

      {/* Quick Actions Bar */}
      <QuickActionsCard
        customerId={params["id"]}
        customerStatus={customer.status}
        onActionComplete={refetch}
      />

      {/* 360° Dashboard Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <CustomerOverviewCard customer={overviewCustomer} />

        <SubscriptionCard
          subscription={subscriptions.current}
          totalSubscriptions={subscriptions.total}
        />

        <NetworkStatusCard network={network} customerId={params["id"]} />

        <DevicesSummaryCard devices={devices} customerId={params["id"]} />

        <TicketsSummaryCard tickets={tickets} customerId={params["id"]} />

        <BillingSummaryCard billing={billing} customerId={params["id"]} />
      </div>
    </div>
  );
}
