"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw } from "lucide-react";
import { useCustomerDashboardGraphQL } from "@/hooks/useCustomersGraphQL";
import { CustomersList } from "@/components/customers/CustomersList";
import { CustomersMetrics } from "@/components/customers/CustomersMetrics";
import { CreateCustomerModal } from "@/components/customers/CreateCustomerModal";
import { CustomerStatusEnum } from "@/lib/graphql/generated";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Alert, AlertDescription } from "@dotmac/ui";
import { AlertCircle } from "lucide-react";

export default function ISPCustomersView() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<CustomerStatusEnum | undefined>(undefined);

  // Fetch customers and metrics using GraphQL hook
  const customerQueryOptions: Parameters<typeof useCustomerDashboardGraphQL>[0] = {
    limit: 100,
    offset: 0,
    pollInterval: 30000,
  };
  if (selectedStatus) {
    customerQueryOptions.status = selectedStatus;
  }
  if (searchQuery.trim()) {
    customerQueryOptions.search = searchQuery.trim();
  }

  const { customers, metrics, total, isLoading, isFetching, error, refetch } =
    useCustomerDashboardGraphQL(customerQueryOptions);

  const handleCreateCustomer = () => {
    setShowCreateModal(true);
  };

  const handleCustomerCreated = () => {
    setShowCreateModal(false);
    refetch();
  };

  const handleViewCustomer = (customer: any) => {
    // Navigate to Customer 360° detail page
    router.push(`/dashboard/operations/customers/${customer.id}`);
  };

  const handleRefresh = () => {
    refetch();
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Customer Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage your internet subscribers, track service health, and handle support requests.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={handleRefresh} disabled={isLoading || isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={handleCreateCustomer}>
            <Plus className="h-4 w-4 mr-2" />
            New Customer
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <CustomersMetrics
        metrics={{
          total_customers: metrics.totalCustomers,
          active_customers: metrics.activeCustomers,
          new_customers_this_month: metrics.newCustomers,
          churned_this_month: metrics.churnedCustomers,
          total_revenue: metrics.totalCustomerValue,
          average_lifetime_value: metrics.averageCustomerValue,
        }}
        loading={isLoading}
      />

      {/* Filters & Search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search customers by name, email, or account number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-md"
              />
            </div>
            <select
              value={selectedStatus || ""}
              onChange={(e) =>
                setSelectedStatus(
                  e.target.value ? (e.target.value as CustomerStatusEnum) : undefined,
                )
              }
              className="px-3 py-2 border rounded-md bg-background"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="CANCELED">Canceled</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Customer List */}
      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Failed to load customers: {error}</AlertDescription>
        </Alert>
      ) : (
        <CustomersList
          customers={customers as any}
          loading={isLoading}
          onCustomerSelect={handleViewCustomer}
        />
      )}

      {/* Create Customer Modal */}
      {showCreateModal && (
        <CreateCustomerModal
          onClose={() => setShowCreateModal(false)}
          onCustomerCreated={handleCustomerCreated as any}
          createCustomer={async () => ({}) as any}
          updateCustomer={async () => ({}) as any}
        />
      )}
    </div>
  );
}
