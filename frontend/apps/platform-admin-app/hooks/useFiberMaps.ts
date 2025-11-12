/**
 * FiberMaps Custom Hooks
 *
 * React hooks for managing fiber infrastructure data, maps, and analytics
 * Migrated to TanStack Query for improved caching and state management
 */

"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@dotmac/ui";
import { logger } from "@/lib/logger";
import type {
  FiberCable,
  FiberCablesResponse,
  SplicePoint,
  SplicePointsResponse,
  DistributionPoint,
  DistributionPointsResponse,
  ServiceArea,
  ServiceAreasResponse,
  FiberInfrastructureStats,
  CreateFiberCableRequest,
  CreateSplicePointRequest,
  CreateDistributionPointRequest,
  Coordinates,
  MapViewState,
  MapLayer,
} from "@/types/fibermaps";

// ============================================================================
// Utility Functions
// ============================================================================

const toError = (error: unknown) =>
  error instanceof Error ? error : new Error(typeof error === "string" ? error : String(error));

const toMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

// ============================================================================
// Query Keys Factory
// ============================================================================

export const fiberMapsKeys = {
  all: ["fiberMaps"] as const,
  cables: (filters?: { status?: string; cable_type?: string; limit?: number }) =>
    [...fiberMapsKeys.all, "cables", filters] as const,
  splicePoints: (filters?: { cable_id?: string; limit?: number }) =>
    [...fiberMapsKeys.all, "splicePoints", filters] as const,
  distributionPoints: (filters?: { type?: string; limit?: number }) =>
    [...fiberMapsKeys.all, "distributionPoints", filters] as const,
  serviceAreas: (filters?: { coverage_status?: string; limit?: number }) =>
    [...fiberMapsKeys.all, "serviceAreas", filters] as const,
  stats: () => [...fiberMapsKeys.all, "stats"] as const,
};

// ============================================================================
// API Functions
// ============================================================================

const fiberMapsApi = {
  fetchCables: async (options: { status?: string; cable_type?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (options.status) params.append("status", options.status);
    if (options.cable_type) params.append("cable_type", options.cable_type);
    if (options.limit) params.append("limit", options.limit.toString());

    const response = await apiClient.get<FiberCablesResponse>(
      `/fibermaps/cables?${params.toString()}`,
    );
    return response.data.cables;
  },

  createCable: async (data: CreateFiberCableRequest): Promise<FiberCable> => {
    const response = await apiClient.post<FiberCable>("/fibermaps/cables", data);
    return response.data;
  },

  updateCable: async (id: string, data: Partial<FiberCable>): Promise<FiberCable> => {
    const response = await apiClient.patch<FiberCable>(`/fibermaps/cables/${id}`, data);
    return response.data;
  },

  deleteCable: async (id: string): Promise<void> => {
    await apiClient.delete(`/fibermaps/cables/${id}`);
  },

  fetchSplicePoints: async (options: { cable_id?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (options.cable_id) params.append("cable_id", options.cable_id);
    if (options.limit) params.append("limit", options.limit.toString());

    const response = await apiClient.get<SplicePointsResponse>(
      `/fibermaps/splice-points?${params.toString()}`,
    );
    return response.data.splice_points;
  },

  createSplicePoint: async (data: CreateSplicePointRequest): Promise<SplicePoint> => {
    const response = await apiClient.post<SplicePoint>("/fibermaps/splice-points", data);
    return response.data;
  },

  updateSplicePoint: async (id: string, data: Partial<SplicePoint>): Promise<SplicePoint> => {
    const response = await apiClient.patch<SplicePoint>(`/fibermaps/splice-points/${id}`, data);
    return response.data;
  },

  deleteSplicePoint: async (id: string): Promise<void> => {
    await apiClient.delete(`/fibermaps/splice-points/${id}`);
  },

  fetchDistributionPoints: async (options: { type?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (options.type) params.append("type", options.type);
    if (options.limit) params.append("limit", options.limit.toString());

    const response = await apiClient.get<DistributionPointsResponse>(
      `/fibermaps/distribution-points?${params.toString()}`,
    );
    return response.data.distribution_points;
  },

  createDistributionPoint: async (
    data: CreateDistributionPointRequest,
  ): Promise<DistributionPoint> => {
    const response = await apiClient.post<DistributionPoint>(
      "/fibermaps/distribution-points",
      data,
    );
    return response.data;
  },

  updateDistributionPoint: async (
    id: string,
    data: Partial<DistributionPoint>,
  ): Promise<DistributionPoint> => {
    const response = await apiClient.patch<DistributionPoint>(
      `/fibermaps/distribution-points/${id}`,
      data,
    );
    return response.data;
  },

  deleteDistributionPoint: async (id: string): Promise<void> => {
    await apiClient.delete(`/fibermaps/distribution-points/${id}`);
  },

  fetchServiceAreas: async (options: { coverage_status?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (options.coverage_status) params.append("coverage_status", options.coverage_status);
    if (options.limit) params.append("limit", options.limit.toString());

    const response = await apiClient.get<ServiceAreasResponse>(
      `/fibermaps/service-areas?${params.toString()}`,
    );
    return response.data.service_areas;
  },

  fetchStats: async (): Promise<FiberInfrastructureStats> => {
    const response = await apiClient.get<FiberInfrastructureStats>("/fibermaps/statistics");
    return response.data;
  },
};

// ============================================================================
// Fiber Cables Hook
// ============================================================================

interface UseFiberCablesOptions {
  status?: string;
  cable_type?: string;
  limit?: number;
  autoFetch?: boolean;
}

export function useFiberCables(options: UseFiberCablesOptions = {}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { autoFetch = true, ...filters } = options;

  const query = useQuery({
    queryKey: fiberMapsKeys.cables(filters),
    queryFn: () => fiberMapsApi.fetchCables(filters),
    staleTime: 2 * 60 * 1000, // 2 minutes - map data changes moderately
    enabled: autoFetch,
    retry: 1,
  });

  const createMutation = useMutation({
    mutationFn: fiberMapsApi.createCable,
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: fiberMapsKeys.cables(filters) });
      logger.info("Creating fiber cable", { data });
    },
    onError: (error) => {
      const message = toMessage(error, "Failed to create fiber cable");
      logger.error("Error creating fiber cable", toError(error));
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
    onSuccess: (data) => {
      logger.info("Fiber cable created successfully", { cable: data });
      toast({
        title: "Cable Created",
        description: `Fiber cable ${data.cable_name} has been created successfully`,
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: fiberMapsKeys.cables(filters) });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<FiberCable> }) =>
      fiberMapsApi.updateCable(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: fiberMapsKeys.cables(filters) });
      logger.info("Updating fiber cable", { id, data });
    },
    onError: (error) => {
      const message = toMessage(error, "Failed to update fiber cable");
      logger.error("Error updating fiber cable", toError(error));
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
    onSuccess: (data) => {
      logger.info("Fiber cable updated successfully", { cable: data });
      toast({
        title: "Cable Updated",
        description: "Fiber cable has been updated successfully",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: fiberMapsKeys.cables(filters) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: fiberMapsApi.deleteCable,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: fiberMapsKeys.cables(filters) });
      logger.info("Deleting fiber cable", { id });
    },
    onError: (error) => {
      const message = toMessage(error, "Failed to delete fiber cable");
      logger.error("Error deleting fiber cable", toError(error));
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
    onSuccess: () => {
      logger.info("Fiber cable deleted successfully");
      toast({
        title: "Cable Deleted",
        description: "Fiber cable has been deleted successfully",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: fiberMapsKeys.cables(filters) });
    },
  });

  return {
    cables: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error ? toError(query.error) : null,
    refetch: query.refetch,
    createCable: async (data: CreateFiberCableRequest) => {
      const result = await createMutation.mutateAsync(data);
      return result;
    },
    updateCable: async (id: string, data: Partial<FiberCable>) => {
      const result = await updateMutation.mutateAsync({ id, data });
      return result;
    },
    deleteCable: async (id: string) => {
      await deleteMutation.mutateAsync(id);
      return true;
    },
  };
}

// ============================================================================
// Splice Points Hook
// ============================================================================

interface UseSplicePointsOptions {
  cable_id?: string;
  limit?: number;
  autoFetch?: boolean;
}

export function useSplicePoints(options: UseSplicePointsOptions = {}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { autoFetch = true, ...filters } = options;

  const query = useQuery({
    queryKey: fiberMapsKeys.splicePoints(filters),
    queryFn: () => fiberMapsApi.fetchSplicePoints(filters),
    staleTime: 2 * 60 * 1000, // 2 minutes - map data changes moderately
    enabled: autoFetch,
    retry: 1,
  });

  const createMutation = useMutation({
    mutationFn: fiberMapsApi.createSplicePoint,
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: fiberMapsKeys.splicePoints(filters) });
      logger.info("Creating splice point", { data });
    },
    onError: (error) => {
      const message = toMessage(error, "Failed to create splice point");
      logger.error("Error creating splice point", toError(error));
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
    onSuccess: (data) => {
      logger.info("Splice point created successfully", { splicePoint: data });
      toast({
        title: "Splice Point Created",
        description: `Splice point ${data.name} has been created successfully`,
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: fiberMapsKeys.splicePoints(filters) });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SplicePoint> }) =>
      fiberMapsApi.updateSplicePoint(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: fiberMapsKeys.splicePoints(filters) });
      logger.info("Updating splice point", { id, data });
    },
    onError: (error) => {
      const message = toMessage(error, "Failed to update splice point");
      logger.error("Error updating splice point", toError(error));
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
    onSuccess: (data) => {
      logger.info("Splice point updated successfully", { splicePoint: data });
      toast({
        title: "Splice Point Updated",
        description: "Splice point has been updated successfully",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: fiberMapsKeys.splicePoints(filters) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: fiberMapsApi.deleteSplicePoint,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: fiberMapsKeys.splicePoints(filters) });
      logger.info("Deleting splice point", { id });
    },
    onError: (error) => {
      const message = toMessage(error, "Failed to delete splice point");
      logger.error("Error deleting splice point", toError(error));
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
    onSuccess: () => {
      logger.info("Splice point deleted successfully");
      toast({
        title: "Splice Point Deleted",
        description: "Splice point has been deleted successfully",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: fiberMapsKeys.splicePoints(filters) });
    },
  });

  return {
    splicePoints: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error ? toError(query.error) : null,
    refetch: query.refetch,
    createSplicePoint: async (data: CreateSplicePointRequest) => {
      const result = await createMutation.mutateAsync(data);
      return result;
    },
    updateSplicePoint: async (id: string, data: Partial<SplicePoint>) => {
      const result = await updateMutation.mutateAsync({ id, data });
      return result;
    },
    deleteSplicePoint: async (id: string) => {
      await deleteMutation.mutateAsync(id);
      return true;
    },
  };
}

// ============================================================================
// Distribution Points Hook
// ============================================================================

interface UseDistributionPointsOptions {
  type?: string;
  limit?: number;
  autoFetch?: boolean;
}

export function useDistributionPoints(options: UseDistributionPointsOptions = {}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { autoFetch = true, ...filters } = options;

  const query = useQuery({
    queryKey: fiberMapsKeys.distributionPoints(filters),
    queryFn: () => fiberMapsApi.fetchDistributionPoints(filters),
    staleTime: 2 * 60 * 1000, // 2 minutes - map data changes moderately
    enabled: autoFetch,
    retry: 1,
  });

  const createMutation = useMutation({
    mutationFn: fiberMapsApi.createDistributionPoint,
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: fiberMapsKeys.distributionPoints(filters) });
      logger.info("Creating distribution point", { data });
    },
    onError: (error) => {
      const message = toMessage(error, "Failed to create distribution point");
      logger.error("Error creating distribution point", toError(error));
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
    onSuccess: (data) => {
      logger.info("Distribution point created successfully", { distributionPoint: data });
      toast({
        title: "Distribution Point Created",
        description: `Distribution point ${data.name} has been created successfully`,
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: fiberMapsKeys.distributionPoints(filters) });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<DistributionPoint> }) =>
      fiberMapsApi.updateDistributionPoint(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: fiberMapsKeys.distributionPoints(filters) });
      logger.info("Updating distribution point", { id, data });
    },
    onError: (error) => {
      const message = toMessage(error, "Failed to update distribution point");
      logger.error("Error updating distribution point", toError(error));
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
    onSuccess: (data) => {
      logger.info("Distribution point updated successfully", { distributionPoint: data });
      toast({
        title: "Distribution Point Updated",
        description: "Distribution point has been updated successfully",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: fiberMapsKeys.distributionPoints(filters) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: fiberMapsApi.deleteDistributionPoint,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: fiberMapsKeys.distributionPoints(filters) });
      logger.info("Deleting distribution point", { id });
    },
    onError: (error) => {
      const message = toMessage(error, "Failed to delete distribution point");
      logger.error("Error deleting distribution point", toError(error));
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
    onSuccess: () => {
      logger.info("Distribution point deleted successfully");
      toast({
        title: "Distribution Point Deleted",
        description: "Distribution point has been deleted successfully",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: fiberMapsKeys.distributionPoints(filters) });
    },
  });

  return {
    distributionPoints: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error ? toError(query.error) : null,
    refetch: query.refetch,
    createDistributionPoint: async (data: CreateDistributionPointRequest) => {
      const result = await createMutation.mutateAsync(data);
      return result;
    },
    updateDistributionPoint: async (id: string, data: Partial<DistributionPoint>) => {
      const result = await updateMutation.mutateAsync({ id, data });
      return result;
    },
    deleteDistributionPoint: async (id: string) => {
      await deleteMutation.mutateAsync(id);
      return true;
    },
  };
}

// ============================================================================
// Service Areas Hook
// ============================================================================

interface UseServiceAreasOptions {
  coverage_status?: string;
  limit?: number;
  autoFetch?: boolean;
}

export function useServiceAreas(options: UseServiceAreasOptions = {}) {
  const { autoFetch = true, ...filters } = options;

  const query = useQuery({
    queryKey: fiberMapsKeys.serviceAreas(filters),
    queryFn: () => fiberMapsApi.fetchServiceAreas(filters),
    staleTime: 2 * 60 * 1000, // 2 minutes - map data changes moderately
    enabled: autoFetch,
    retry: 1,
  });

  return {
    serviceAreas: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error ? toError(query.error) : null,
    refetch: query.refetch,
  };
}

// ============================================================================
// Infrastructure Statistics Hook
// ============================================================================

export function useFiberInfrastructureStats() {
  const query = useQuery({
    queryKey: fiberMapsKeys.stats(),
    queryFn: fiberMapsApi.fetchStats,
    staleTime: 2 * 60 * 1000, // 2 minutes - stats change moderately
    retry: 1,
  });

  return {
    stats: query.data ?? null,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

// ============================================================================
// Map View State Hook
// ============================================================================

const DEFAULT_MAP_LAYERS: MapLayer[] = [
  {
    id: "cables",
    name: "Fiber Cables",
    type: "cables",
    visible: true,
    color: "#3b82f6",
    opacity: 0.8,
  },
  {
    id: "splice_points",
    name: "Splice Points",
    type: "splice_points",
    visible: true,
    color: "#f59e0b",
    opacity: 1,
  },
  {
    id: "distribution_points",
    name: "Distribution Points",
    type: "distribution_points",
    visible: true,
    color: "#10b981",
    opacity: 1,
  },
  {
    id: "service_areas",
    name: "Service Areas",
    type: "service_areas",
    visible: false,
    color: "#8b5cf6",
    opacity: 0.3,
  },
  {
    id: "network_elements",
    name: "Network Elements",
    type: "network_elements",
    visible: true,
    color: "#ef4444",
    opacity: 1,
  },
];

export function useMapView() {
  const [viewState, setViewState] = useState<MapViewState>({
    center: { lat: 0, lng: 0 },
    zoom: 12,
    layers: DEFAULT_MAP_LAYERS,
    selectedFeatures: [],
  });

  const updateCenter = useCallback((center: Coordinates) => {
    setViewState((prev) => ({ ...prev, center }));
  }, []);

  const updateZoom = useCallback((zoom: number) => {
    setViewState((prev) => ({ ...prev, zoom }));
  }, []);

  const toggleLayer = useCallback((layerId: string) => {
    setViewState((prev) => ({
      ...prev,
      layers: prev.layers.map((layer) =>
        layer.id === layerId ? { ...layer, visible: !layer.visible } : layer,
      ),
    }));
  }, []);

  const selectFeature = useCallback(
    (type: MapViewState["selectedFeatures"][0]["type"], id: string) => {
      setViewState((prev) => ({
        ...prev,
        selectedFeatures: [{ type, id }],
      }));
    },
    [],
  );

  const clearSelection = useCallback(() => {
    setViewState((prev) => ({
      ...prev,
      selectedFeatures: [],
    }));
  }, []);

  return {
    viewState,
    updateCenter,
    updateZoom,
    toggleLayer,
    selectFeature,
    clearSelection,
  };
}
