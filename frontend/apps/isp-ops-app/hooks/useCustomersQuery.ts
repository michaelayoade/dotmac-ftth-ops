/**
 * Customer hooks using TanStack Query
 * Example implementation with optimistic updates
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Customer, CustomerCreateInput, CustomerUpdateInput } from "@/types";
import { apiClient } from "@/lib/api/client";
import { queryKeys, optimisticHelpers, invalidateHelpers } from "@/lib/query-client";
import { logger } from "@/lib/logger";
import { handleError } from "@/lib/utils/error-handler";
import { useToast } from "@dotmac/ui";

// Migrated from sonner to useToast hook
// Note: toast options have changed:
// - sonner: toast.success('msg') -> useToast: toast({ title: 'Success', description: 'msg' })
// - sonner: toast.error('msg') -> useToast: toast({ title: 'Error', description: 'msg', variant: 'destructive' })
// - For complex options, refer to useToast documentation

/**
 * API functions
 */
const customerApi = {
  // Fetch all customers
  fetchCustomers: async (filters?: {
    query?: string;
    status?: string;
    tier?: string;
    page?: number;
    limit?: number;
  }): Promise<Customer[]> => {
    const params = new URLSearchParams();
    if (filters?.query) params.append("q", filters.query);
    if (filters?.status && filters.status !== "all") params.append("status", filters.status);
    if (filters?.tier && filters.tier !== "all") params.append("tier", filters.tier);
    if (filters?.page) params.append("page", filters.page.toString());
    if (filters?.limit) params.append("limit", filters.limit.toString());

    const response = await apiClient.get(`/customers?${params.toString()}`);
    return response.data as Customer[];
  },

  // Fetch single customer
  fetchCustomer: async (id: string): Promise<Customer> => {
    const response = await apiClient.get(`/customers/${id}`);
    return response.data as Customer;
  },

  // Create customer
  createCustomer: async (data: CustomerCreateInput): Promise<Customer> => {
    const response = await apiClient.post("/customers", data);
    return response.data as Customer;
  },

  // Update customer
  updateCustomer: async ({
    id,
    ...data
  }: CustomerUpdateInput & { id: string }): Promise<Customer> => {
    const response = await apiClient.put(`/customers/${id}`, data);
    return response.data as Customer;
  },

  // Delete customer
  deleteCustomer: async (id: string): Promise<void> => {
    await apiClient.delete(`/customers/${id}`);
  },

  // Fetch customer activities
  fetchCustomerActivities: async (id: string) => {
    const response = await apiClient.get(`/customers/${id}/activities`);
    return response.data;
  },

  // Fetch customer notes
  fetchCustomerNotes: async (id: string) => {
    const response = await apiClient.get(`/customers/${id}/notes`);
    return response.data;
  },

  // Add customer note
  addCustomerNote: async (customerId: string, note: string) => {
    const response = await apiClient.post(`/customers/${customerId}/notes`, {
      note,
    });
    return response.data;
  },
};

/**
 * Hook to fetch customers list
 */
export function useCustomersList(filters?: {
  query?: string;
  status?: string;
  tier?: string;
  page?: number;
  limit?: number;
}) {
  const { toast } = useToast();

  return useQuery({
    queryKey: queryKeys.customers.list(filters),
    queryFn: () => customerApi.fetchCustomers(filters),
    staleTime: 2 * 60 * 1000, // 2 minutes
    meta: {
      showErrorToast: true,
    },
  });
}

/**
 * Hook to fetch single customer
 */
export function useCustomer(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.customers.detail(id),
    queryFn: () => customerApi.fetchCustomer(id),
    enabled: enabled && !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to create customer with optimistic update
 */
export function useCreateCustomer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: customerApi.createCustomer,
    onMutate: async (newCustomer) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.customers.lists(),
      });

      // Snapshot previous value
      const previousCustomers = queryClient.getQueryData(queryKeys.customers.lists());

      // Optimistically update the list
      const optimisticCustomer = {
        id: `temp-${Date.now()}`,
        ...newCustomer,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: "active",
        lifetime_value: 0,
        last_interaction: undefined,
      } as unknown as Customer;

      optimisticHelpers.addToList(queryClient, queryKeys.customers.lists(), optimisticCustomer, {
        position: "start",
      });

      logger.info("Creating customer optimistically", {
        customer: optimisticCustomer,
      });

      // Return context with snapshot
      return { previousCustomers, optimisticCustomer };
    },
    onError: (error, newCustomer, context) => {
      // Roll back on error
      if (context?.previousCustomers) {
        queryClient.setQueryData(queryKeys.customers.lists(), context.previousCustomers);
      }
      handleError(error, "Failed to create customer", true);
    },
    onSuccess: (data, variables, context) => {
      // Replace optimistic customer with real one
      if (context?.optimisticCustomer) {
        optimisticHelpers.updateInList(
          queryClient,
          queryKeys.customers.lists(),
          context.optimisticCustomer.id,
          data,
        );
      }
      toast({ title: "Success", description: "Customer created successfully" });
      logger.info("Customer created", { customer: data });
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.lists() });
    },
    meta: {
      successMessage: "Customer created successfully",
    },
  });
}

/**
 * Hook to update customer with optimistic update
 */
export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: customerApi.updateCustomer,
    onMutate: async ({ id, ...updates }) => {
      // Cancel queries
      await queryClient.cancelQueries({
        queryKey: queryKeys.customers.detail(id),
      });
      await queryClient.cancelQueries({
        queryKey: queryKeys.customers.lists(),
      });

      // Snapshot previous values
      const previousCustomer = queryClient.getQueryData(queryKeys.customers.detail(id));
      const previousCustomers = queryClient.getQueryData(queryKeys.customers.lists());

      // Optimistically update
      optimisticHelpers.updateItem(queryClient, queryKeys.customers.detail(id), updates);

      optimisticHelpers.updateInList(queryClient, queryKeys.customers.lists(), id, updates);

      logger.info("Updating customer optimistically", { id, updates });

      return { previousCustomer, previousCustomers, id };
    },
    onError: (error, variables, context) => {
      // Roll back on error
      if (context) {
        if (context.previousCustomer) {
          queryClient.setQueryData(
            queryKeys.customers.detail(context.id),
            context.previousCustomer,
          );
        }
        if (context.previousCustomers) {
          queryClient.setQueryData(queryKeys.customers.lists(), context.previousCustomers);
        }
      }
      handleError(error, "Failed to update customer", true);
    },
    onSuccess: (data) => {
      toast({ title: "Success", description: "Customer updated successfully" });
      logger.info("Customer updated", { customer: data });
    },
    onSettled: (data, error, variables) => {
      // Refetch to ensure consistency
      invalidateHelpers.invalidateRelated(queryClient, [
        queryKeys.customers.detail(variables.id),
        queryKeys.customers.lists(),
      ]);
    },
  });
}

/**
 * Hook to delete customer with optimistic update
 */
export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: customerApi.deleteCustomer,
    onMutate: async (customerId) => {
      // Cancel queries
      await queryClient.cancelQueries({
        queryKey: queryKeys.customers.lists(),
      });

      // Snapshot previous value
      const previousCustomers = queryClient.getQueryData(queryKeys.customers.lists());

      // Optimistically remove from list
      optimisticHelpers.removeFromList(queryClient, queryKeys.customers.lists(), customerId);

      logger.info("Deleting customer optimistically", { customerId });

      return { previousCustomers };
    },
    onError: (error, customerId, context) => {
      // Roll back on error
      if (context?.previousCustomers) {
        queryClient.setQueryData(queryKeys.customers.lists(), context.previousCustomers);
      }
      handleError(error, "Failed to delete customer", true);
    },
    onSuccess: (data, customerId) => {
      // Remove from cache
      queryClient.removeQueries({
        queryKey: queryKeys.customers.detail(customerId),
      });
      toast({ title: "Success", description: "Customer deleted successfully" });
      logger.info("Customer deleted", { customerId });
    },
    onSettled: () => {
      // Refetch list to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.lists() });
    },
  });
}

/**
 * Hook to fetch customer activities
 */
export function useCustomerActivities(customerId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.customers.activities(customerId),
    queryFn: () => customerApi.fetchCustomerActivities(customerId),
    enabled: enabled && !!customerId,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

/**
 * Hook to fetch customer notes
 */
export function useCustomerNotes(customerId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.customers.notes(customerId),
    queryFn: () => customerApi.fetchCustomerNotes(customerId),
    enabled: enabled && !!customerId,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

/**
 * Hook to add customer note with optimistic update
 */
export function useAddCustomerNote(customerId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (note: string) => customerApi.addCustomerNote(customerId, note),
    onMutate: async (note) => {
      // Cancel queries
      await queryClient.cancelQueries({
        queryKey: queryKeys.customers.notes(customerId),
      });

      // Snapshot previous value
      const previousNotes = queryClient.getQueryData(queryKeys.customers.notes(customerId));

      // Optimistically add note
      const optimisticNote = {
        id: `temp-${Date.now()}`,
        note,
        created_at: new Date().toISOString(),
        created_by: "Current User", // This would come from auth context
      };

      optimisticHelpers.addToList(
        queryClient,
        queryKeys.customers.notes(customerId),
        optimisticNote,
        { position: "start" },
      );

      return { previousNotes, optimisticNote };
    },
    onError: (error, note, context) => {
      // Roll back on error
      if (context?.previousNotes) {
        queryClient.setQueryData(queryKeys.customers.notes(customerId), context.previousNotes);
      }
      handleError(error, "Failed to add note", true);
    },
    onSuccess: (data, note, context) => {
      // Replace optimistic note with real one
      if (context?.optimisticNote) {
        optimisticHelpers.updateInList(
          queryClient,
          queryKeys.customers.notes(customerId),
          context.optimisticNote.id,
          data as Partial<unknown>,
        );
      }
      toast({ title: "Success", description: "Note added successfully" });
    },
    onSettled: () => {
      // Refetch notes and activities
      invalidateHelpers.invalidateRelated(queryClient, [
        queryKeys.customers.notes(customerId),
        queryKeys.customers.activities(customerId),
      ]);
    },
  });
}

/**
 * Combined hook for customer management
 * Provides all customer-related operations
 */
export function useCustomersQuery(filters?: { query?: string; status?: string; tier?: string }) {
  const customersQuery = useCustomersList(filters);
  const createMutation = useCreateCustomer();
  const updateMutation = useUpdateCustomer();
  const deleteMutation = useDeleteCustomer();
  const queryClient = useQueryClient();

  return {
    // Data
    customers: customersQuery.data || [],
    loading: customersQuery.isLoading,
    error: customersQuery.error,

    // Mutations
    createCustomer: createMutation.mutate,
    updateCustomer: updateMutation.mutate,
    deleteCustomer: deleteMutation.mutate,

    // Loading states
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,

    // Refetch
    refreshCustomers: () => customersQuery.refetch(),

    // Prefetch a customer detail
    prefetchCustomer: (id: string) => {
      return queryClient.prefetchQuery({
        queryKey: queryKeys.customers.detail(id),
        queryFn: () => customerApi.fetchCustomer(id),
      });
    },

    // Metrics (computed from data)
    metrics: {
      totalCustomers: customersQuery.data?.length || 0,
      activeCustomers: customersQuery.data?.filter((c) => c.status === "active").length || 0,
      newThisMonth:
        customersQuery.data?.filter((c) => {
          const created = new Date(c.created_at);
          const now = new Date();
          return (
            created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear()
          );
        }).length || 0,
      totalRevenue: customersQuery.data?.reduce((sum, c) => sum + (c.lifetime_value || 0), 0) || 0,
    },
  };
}
