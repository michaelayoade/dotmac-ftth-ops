"use client";

import { useState } from "react";
import { Plus, Search, Filter, Download, AlertCircle, RefreshCw } from "lucide-react";
import { CustomersList } from "@/components/customers/CustomersList";
import { CustomersMetrics } from "@/components/customers/CustomersMetrics";
import { CreateCustomerModal } from "@/components/customers/CreateCustomerModal";
import { CustomerViewModal } from "@/components/customers/CustomerViewModal";
import { CustomerEditModal } from "@/components/customers/CustomerEditModal";
import { useCustomerListGraphQL, useCustomerMetricsGraphQL } from "@/hooks/useCustomersGraphQL";
import { CustomerStatusEnum } from "@/lib/graphql/generated";
import { apiClient } from "@/lib/api/client";
import { Customer } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { toast } from "@dotmac/ui";

export default function TenantCustomersView() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<CustomerStatusEnum | undefined>(undefined);
  const [selectedTier, setSelectedTier] = useState<string>("all");

  // Fetch customers using GraphQL
  const {
    customers: graphqlCustomers,
    total: totalCustomers,
    isLoading: customersLoading,
    error: customersError,
    refetch: refetchCustomers,
  } = useCustomerListGraphQL({
    limit: 100,
    offset: 0,
    status: selectedStatus,
    search: searchQuery || undefined,
    pollInterval: 30000, // Auto-refresh every 30 seconds
  });

  // Fetch customer metrics
  const {
    metrics: graphqlMetrics,
    isLoading: metricsLoading,
    refetch: refetchMetrics,
  } = useCustomerMetricsGraphQL({
    pollInterval: 60000, // Refresh metrics every minute
  });

  // Transform GraphQL customers to match expected Customer type
  const customers: Customer[] = graphqlCustomers.map(
    (c: any) =>
      ({
        id: c.id,
        name: c.displayName || `${c.firstName} ${c.lastName}`,
        display_name: c.displayName || `${c.firstName} ${c.lastName}`,
        email: c.email,
        status: c.status.toLowerCase() as Customer["status"],
        created_at: c.createdAt,
        updated_at: c.updatedAt || c.createdAt,
      }) as unknown as Customer,
  );

  // Transform GraphQL metrics to match expected format
  const metrics = {
    total_customers: graphqlMetrics?.totalCustomers || 0,
    active_customers: graphqlMetrics?.activeCustomers || 0,
    new_customers_this_month: graphqlMetrics?.newCustomers || 0,
    average_lifetime_value: 0,
    total_revenue: 0,
  };

  const loading = customersLoading || metricsLoading;

  const handleCreateCustomer = () => {
    setShowCreateModal(true);
  };

  const handleCustomerCreated = () => {
    setShowCreateModal(false);
    refetchCustomers();
    refetchMetrics();
  };

  const handleRefresh = () => {
    refetchCustomers();
    refetchMetrics();
  };

  const handleEditCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowEditModal(true);
  };

  const handleViewCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowViewModal(true);
  };

  const handleDeleteCustomer = (customer: Customer) => {
    setCustomerToDelete(customer);
    setShowDeleteDialog(true);
  };

  const confirmDeleteCustomer = async () => {
    if (!customerToDelete) return;

    setIsDeleting(true);
    try {
      // Execute REST API call for delete
      await apiClient.delete(`/customers/${customerToDelete.id}`);

      refetchCustomers();
      refetchMetrics();
      setShowDeleteDialog(false);
      setCustomerToDelete(null);
      toast.success(
        `Customer "${customerToDelete.display_name || customerToDelete.email}" deleted successfully`,
      );
    } catch (error) {
      console.error("Failed to delete customer:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete customer. Please try again.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteDialog(false);
    setCustomerToDelete(null);
  };

  const handleCustomerUpdated = () => {
    setShowEditModal(false);
    setSelectedCustomer(null);
    refetchCustomers();
    refetchMetrics();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Customer Management</h1>
          <p className="text-sm text-muted-foreground">
            Track relationships, segment accounts, and take action on high-impact customers.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={handleCreateCustomer}>
            <Plus className="h-4 w-4 mr-2" />
            Create Customer
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <CustomersMetrics metrics={metrics} loading={loading} />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="relative">
          <span className="sr-only" id="customers-search-label">
            Search customers
          </span>
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden />
          <input
            type="search"
            aria-labelledby="customers-search-label"
            placeholder="Search customers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" aria-hidden />
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as CustomerStatusEnum | undefined)}
            className="w-full rounded-md border border-border bg-background py-2 px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="trialing">Trialing</option>
            <option value="past_due">Past Due</option>
            <option value="churned">Churned</option>
          </select>
        </div>
        <div>
          <select
            value={selectedTier}
            onChange={(e) => setSelectedTier(e.target.value)}
            className="w-full rounded-md border border-border bg-background py-2 px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">All plans</option>
            <option value="starter">Starter</option>
            <option value="professional">Professional</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
      </div>

      <CustomersList
        customers={customers as any}
        loading={loading}
        onCustomerSelect={handleViewCustomer as any}
        onEditCustomer={handleEditCustomer as any}
        onDeleteCustomer={handleDeleteCustomer as any}
      />

      {showCreateModal && (
        <CreateCustomerModal
          onClose={() => setShowCreateModal(false)}
          onCustomerCreated={handleCustomerCreated}
          createCustomer={async () =>
            ({
              id: "",
              email: "",
              status: "active",
              created_at: "",
              updated_at: "",
            }) as Customer
          }
          updateCustomer={async () =>
            ({
              id: "",
              email: "",
              status: "active",
              created_at: "",
              updated_at: "",
            }) as Customer
          }
        />
      )}

      {showEditModal && selectedCustomer && (
        <CustomerEditModal
          customer={selectedCustomer}
          onClose={() => setShowEditModal(false)}
          onCustomerUpdated={handleCustomerUpdated}
        />
      )}

      {showViewModal && selectedCustomer && (
        <CustomerViewModal customer={selectedCustomer} onClose={() => setShowViewModal(false)} />
      )}

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete customer</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold">
                {customerToDelete?.display_name || customerToDelete?.email}
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4" aria-hidden />
            <p>
              Removing a customer deletes their profile, notes, and tracked metrics. Historical
              revenue is preserved.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={cancelDelete}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteCustomer} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
