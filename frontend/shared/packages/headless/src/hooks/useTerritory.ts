/**
 * Territory Management Hook
 *
 * Comprehensive territory management with geographic data,
 * customer assignments, and performance analytics.
 *
 * Features:
 * - Territory CRUD operations
 * - Customer assignment and tracking
 * - Lead management within territories
 * - Performance analytics
 * - Geographic optimization
 * - Route planning
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseQueryOptions } from "@tanstack/react-query";

// Types
export interface Territory {
  id: string;
  name: string;
  description?: string;
  boundaries: number[][];
  color: string;
  resellerId: string;
  isActive: boolean;
  priority: "high" | "medium" | "low";
  serviceTypes: string[];
  customerCount: number;
  revenue: number;
  potentialCustomers: number;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, any>;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  coordinates: [number, number];
  services: string[];
  revenue: number;
  status: "active" | "inactive" | "prospect";
  territoryId?: string;
  assignedTo?: string;
  lastActivity: string;
  contractStart?: string;
  contractEnd?: string;
  metadata: Record<string, any>;
}

export interface Lead {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address: string;
  coordinates: [number, number];
  score: number;
  source: string;
  status: "new" | "contacted" | "qualified" | "converted" | "lost";
  assignedTo?: string;
  territoryId?: string;
  estimatedValue: number;
  expectedCloseDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, any>;
}

export interface ServiceCoverage {
  id: string;
  serviceType: string;
  coverageArea: number[][];
  quality: "excellent" | "good" | "fair" | "poor";
  availability: number;
  maxSpeed?: number;
  reliability: number;
  lastUpdated: string;
  metadata: Record<string, any>;
}

export interface TerritoryAnalytics {
  territoryId: string;
  period: string;
  customerCount: number;
  newCustomers: number;
  churnedCustomers: number;
  revenue: number;
  revenueGrowth: number;
  avgRevenuePerCustomer: number;
  leadCount: number;
  conversionRate: number;
  marketPenetration: number;
  efficiency: number;
  competitorActivity: number;
}

export interface TerritoryFilters {
  resellerId?: string;
  isActive?: boolean;
  priority?: string[];
  serviceTypes?: string[];
  minRevenue?: number;
  maxRevenue?: number;
  dateRange?: {
    start: string;
    end: string;
  };
}

export interface UseTerritoryOptions {
  resellerId: string;
  filters?: TerritoryFilters;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

// API functions
const fetchTerritories = async (
  resellerId: string,
  filters?: TerritoryFilters,
): Promise<Territory[]> => {
  const params = new URLSearchParams({ resellerId });

  if (filters) {
    if (filters.isActive !== undefined) {
      params.append("isActive", filters.isActive.toString());
    }
    if (filters.priority?.length) {
      params.append("priority", filters.priority.join(","));
    }
    if (filters.serviceTypes?.length) {
      params.append("serviceTypes", filters.serviceTypes.join(","));
    }
    if (filters.minRevenue) {
      params.append("minRevenue", filters.minRevenue.toString());
    }
    if (filters.maxRevenue) {
      params.append("maxRevenue", filters.maxRevenue.toString());
    }
  }

  const response = await fetch(`/api/territories?${params}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch territories: ${response.statusText}`);
  }
  return response.json();
};

const fetchTerritoryCustomers = async (territoryId: string): Promise<Customer[]> => {
  const response = await fetch(`/api/territories/${territoryId}/customers`);
  if (!response.ok) {
    throw new Error(`Failed to fetch territory customers: ${response.statusText}`);
  }
  return response.json();
};

const fetchTerritoryLeads = async (territoryId: string): Promise<Lead[]> => {
  const response = await fetch(`/api/territories/${territoryId}/leads`);
  if (!response.ok) {
    throw new Error(`Failed to fetch territory leads: ${response.statusText}`);
  }
  return response.json();
};

const fetchServiceCoverage = async (resellerId: string): Promise<ServiceCoverage[]> => {
  const response = await fetch(`/api/territories/coverage?resellerId=${resellerId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch service coverage: ${response.statusText}`);
  }
  return response.json();
};

const fetchTerritoryAnalytics = async (
  territoryId: string,
  period: string = "30d",
): Promise<TerritoryAnalytics> => {
  const response = await fetch(`/api/territories/${territoryId}/analytics?period=${period}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch territory analytics: ${response.statusText}`);
  }
  return response.json();
};

const createTerritory = async (
  territory: Omit<Territory, "id" | "createdAt" | "updatedAt">,
): Promise<Territory> => {
  const response = await fetch("/api/territories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(territory),
  });

  if (!response.ok) {
    throw new Error(`Failed to create territory: ${response.statusText}`);
  }
  return response.json();
};

const updateTerritory = async (
  territoryId: string,
  updates: Partial<Territory>,
): Promise<Territory> => {
  const response = await fetch(`/api/territories/${territoryId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    throw new Error(`Failed to update territory: ${response.statusText}`);
  }
  return response.json();
};

const deleteTerritory = async (territoryId: string): Promise<void> => {
  const response = await fetch(`/api/territories/${territoryId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(`Failed to delete territory: ${response.statusText}`);
  }
};

const assignCustomerToTerritory = async (
  customerId: string,
  territoryId: string,
): Promise<Customer> => {
  const response = await fetch(`/api/customers/${customerId}/assign-territory`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ territoryId }),
  });

  if (!response.ok) {
    throw new Error(`Failed to assign customer to territory: ${response.statusText}`);
  }
  return response.json();
};

const optimizeTerritory = async (
  territoryId: string,
  criteria: {
    maxCustomersPerTerritory?: number;
    balanceRevenue?: boolean;
    minimizeTravel?: boolean;
    respectServiceAreas?: boolean;
  },
): Promise<{ optimizedBoundaries: number[][]; recommendations: string[] }> => {
  const response = await fetch(`/api/territories/${territoryId}/optimize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(criteria),
  });

  if (!response.ok) {
    throw new Error(`Failed to optimize territory: ${response.statusText}`);
  }
  return response.json();
};

// Utility functions
const calculateTerritoryCenter = (boundaries: number[][]): [number, number] => {
  const lats = boundaries.map((coord) => coord[1]);
  const lons = boundaries.map((coord) => coord[0]);

  return [
    lons.reduce((sum, lon) => sum + lon, 0) / lons.length,
    lats.reduce((sum, lat) => sum + lat, 0) / lats.length,
  ];
};

const calculateDistance = (coord1: [number, number], coord2: [number, number]): number => {
  const R = 6371; // Earth's radius in km
  const dLat = ((coord2[1] - coord1[1]) * Math.PI) / 180;
  const dLon = ((coord2[0] - coord1[0]) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((coord1[1] * Math.PI) / 180) *
      Math.cos((coord2[1] * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const isPointInTerritory = (point: [number, number], boundaries: number[][]): boolean => {
  let inside = false;
  for (let i = 0, j = boundaries.length - 1; i < boundaries.length; j = i++) {
    if (
      boundaries[i][1] > point[1] !== boundaries[j][1] > point[1] &&
      point[0] <
        ((boundaries[j][0] - boundaries[i][0]) * (point[1] - boundaries[i][1])) /
          (boundaries[j][1] - boundaries[i][1]) +
          boundaries[i][0]
    ) {
      inside = !inside;
    }
  }
  return inside;
};

// Main hook
export const useTerritory = (options: UseTerritoryOptions) => {
  const {
    resellerId,
    filters,
    autoRefresh = false,
    refreshInterval = 300000, // 5 minutes
  } = options;

  const queryClient = useQueryClient();
  const [selectedTerritoryId, setSelectedTerritoryId] = useState<string | null>(null);

  // Query configuration
  type SharedQueryConfig = Pick<
    UseQueryOptions<unknown, Error, unknown, any>,
    "staleTime" | "cacheTime" | "refetchInterval" | "retry" | "enabled"
  >;
  const queryConfig: SharedQueryConfig = {
    staleTime: 60000, // 1 minute
    cacheTime: 300000, // 5 minutes
    refetchInterval: autoRefresh ? refreshInterval : false,
    retry: 3,
    enabled: !!resellerId,
  };

  // Fetch territories
  const territoriesQuery = useQuery({
    queryKey: ["territories", resellerId, filters],
    queryFn: () => fetchTerritories(resellerId, filters),
    ...queryConfig,
  });

  // Fetch service coverage
  const coverageQuery = useQuery({
    queryKey: ["service-coverage", resellerId],
    queryFn: () => fetchServiceCoverage(resellerId),
    ...queryConfig,
  });

  // Fetch customers and leads for selected territory
  const customersQuery = useQuery({
    queryKey: ["territory-customers", selectedTerritoryId],
    queryFn: () => fetchTerritoryCustomers(selectedTerritoryId!),
    enabled: !!selectedTerritoryId,
    ...queryConfig,
  });

  const leadsQuery = useQuery({
    queryKey: ["territory-leads", selectedTerritoryId],
    queryFn: () => fetchTerritoryLeads(selectedTerritoryId!),
    enabled: !!selectedTerritoryId,
    ...queryConfig,
  });

  const analyticsQuery = useQuery({
    queryKey: ["territory-analytics", selectedTerritoryId],
    queryFn: () => fetchTerritoryAnalytics(selectedTerritoryId!, "30d"),
    enabled: !!selectedTerritoryId,
    ...queryConfig,
  });

  // Mutations
  const createTerritoryMutation = useMutation({
    mutationFn: createTerritory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["territories"] });
    },
  });

  const updateTerritoryMutation = useMutation({
    mutationFn: ({ territoryId, updates }: { territoryId: string; updates: Partial<Territory> }) =>
      updateTerritory(territoryId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["territories"] });
    },
  });

  const deleteTerritoryMutation = useMutation({
    mutationFn: deleteTerritory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["territories"] });
      setSelectedTerritoryId(null);
    },
  });

  const assignCustomerMutation = useMutation({
    mutationFn: ({ customerId, territoryId }: { customerId: string; territoryId: string }) =>
      assignCustomerToTerritory(customerId, territoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["territory-customers"] });
      queryClient.invalidateQueries({ queryKey: ["territories"] });
    },
  });

  const optimizeTerritoryMutation = useMutation({
    mutationFn: ({
      territoryId,
      criteria,
    }: {
      territoryId: string;
      criteria: Parameters<typeof optimizeTerritory>[1];
    }) => optimizeTerritory(territoryId, criteria),
  });

  // Computed values
  const territories = territoriesQuery.data || [];
  const customers = customersQuery.data || [];
  const leads = leadsQuery.data || [];
  const coverage = coverageQuery.data || [];
  const analytics = analyticsQuery.data;

  const selectedTerritory = useMemo(() => {
    return territories.find((t) => t.id === selectedTerritoryId) || null;
  }, [territories, selectedTerritoryId]);

  // Territory statistics
  const territoryStats = useMemo(() => {
    const totalRevenue = territories.reduce((sum, t) => sum + t.revenue, 0);
    const totalCustomers = territories.reduce((sum, t) => sum + t.customerCount, 0);
    const avgRevenue = totalRevenue / (territories.length || 1);
    const avgCustomers = totalCustomers / (territories.length || 1);

    const priorityDistribution = territories.reduce(
      (acc, t) => {
        acc[t.priority] = (acc[t.priority] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      totalTerritories: territories.length,
      totalRevenue,
      totalCustomers,
      avgRevenue,
      avgCustomers,
      priorityDistribution,
      activeTerritories: territories.filter((t) => t.isActive).length,
    };
  }, [territories]);

  // Customer assignment helper
  const assignCustomersToTerritories = useCallback(
    async (customerList: Customer[]) => {
      const assignments = [];

      for (const customer of customerList) {
        const territory = territories.find((t) =>
          isPointInTerritory(customer.coordinates, t.boundaries),
        );

        if (territory && customer.territoryId !== territory.id) {
          assignments.push(
            assignCustomerMutation.mutateAsync({
              customerId: customer.id,
              territoryId: territory.id,
            }),
          );
        }
      }

      await Promise.all(assignments);
    },
    [territories, assignCustomerMutation],
  );

  // Territory optimization
  const optimizeSelectedTerritory = useCallback(
    async (criteria: Parameters<typeof optimizeTerritory>[1]) => {
      if (!selectedTerritoryId) return;

      return optimizeTerritoryMutation.mutateAsync({
        territoryId: selectedTerritoryId,
        criteria,
      });
    },
    [selectedTerritoryId, optimizeTerritoryMutation],
  );

  // Export territory data
  const exportTerritoryData = useCallback(
    async (format: "csv" | "excel" | "kml", territoryIds?: string[]) => {
      const params = new URLSearchParams({
        resellerId,
        format,
      });

      if (territoryIds?.length) {
        params.append("territories", territoryIds.join(","));
      }

      const response = await fetch(`/api/territories/export?${params}`);
      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `territories-${resellerId}-${new Date().toISOString().split("T")[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    [resellerId],
  );

  // Refresh data
  const refreshData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["territories"] });
    queryClient.invalidateQueries({ queryKey: ["service-coverage"] });
    queryClient.invalidateQueries({ queryKey: ["territory-customers"] });
    queryClient.invalidateQueries({ queryKey: ["territory-leads"] });
    queryClient.invalidateQueries({ queryKey: ["territory-analytics"] });
  }, [queryClient]);

  return {
    // Data
    territories,
    customers,
    leads,
    coverage,
    analytics,
    selectedTerritory,
    territoryStats,

    // Selected territory
    selectedTerritoryId,
    selectTerritory: setSelectedTerritoryId,

    // Loading states
    isLoading: territoriesQuery.isLoading,
    isLoadingCustomers: customersQuery.isLoading,
    isLoadingLeads: leadsQuery.isLoading,
    isLoadingAnalytics: analyticsQuery.isLoading,

    // Error states
    isError: territoriesQuery.isError || coverageQuery.isError,
    error: territoriesQuery.error || coverageQuery.error,

    // Actions
    createTerritory: createTerritoryMutation.mutateAsync,
    updateTerritory: updateTerritoryMutation.mutateAsync,
    deleteTerritory: deleteTerritoryMutation.mutateAsync,
    assignCustomersToTerritories,
    optimizeSelectedTerritory,
    exportTerritoryData,
    refreshData,

    // Mutation states
    isCreating: createTerritoryMutation.isPending,
    isUpdating: updateTerritoryMutation.isPending,
    isDeleting: deleteTerritoryMutation.isPending,
    isOptimizing: optimizeTerritoryMutation.isPending,
    isAssigning: assignCustomerMutation.isPending,

    // Utility functions
    calculateTerritoryCenter,
    calculateDistance,
    isPointInTerritory,

    // Query instances
    queries: {
      territories: territoriesQuery,
      customers: customersQuery,
      leads: leadsQuery,
      coverage: coverageQuery,
      analytics: analyticsQuery,
    },
  };
};

export default useTerritory;
