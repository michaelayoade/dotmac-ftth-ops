/**
 * FiberMaps Custom Hooks
 *
 * React hooks for managing fiber infrastructure data, maps, and analytics
 */

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@dotmac/ui";
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
  const [cables, setCables] = useState<FiberCable[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchCables = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (options.status) params.append("status", options.status);
      if (options.cable_type) params.append("cable_type", options.cable_type);
      if (options.limit) params.append("limit", options.limit.toString());

      const response = await apiClient.get<FiberCablesResponse>(
        `/fibermaps/cables?${params.toString()}`,
      );

      setCables(response.data.cables);
      return response.data.cables;
    } catch (err: any) {
      const error = new Error(err.response?.data?.detail || "Failed to fetch fiber cables");
      setError(error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [options.status, options.cable_type, options.limit, toast]);

  const createCable = useCallback(
    async (data: CreateFiberCableRequest) => {
      try {
        const response = await apiClient.post<FiberCable>("/fibermaps/cables", data);

        toast({
          title: "Cable Created",
          description: `Fiber cable ${response.data.cable_name} has been created successfully`,
        });

        await fetchCables();
        return response.data;
      } catch (err: any) {
        toast({
          title: "Error",
          description: err.response?.data?.detail || "Failed to create fiber cable",
          variant: "destructive",
        });
        return null;
      }
    },
    [fetchCables, toast],
  );

  const updateCable = useCallback(
    async (id: string, data: Partial<FiberCable>) => {
      try {
        const response = await apiClient.patch<FiberCable>(`/fibermaps/cables/${id}`, data);

        toast({
          title: "Cable Updated",
          description: "Fiber cable has been updated successfully",
        });

        await fetchCables();
        return response.data;
      } catch (err: any) {
        toast({
          title: "Error",
          description: err.response?.data?.detail || "Failed to update fiber cable",
          variant: "destructive",
        });
        return null;
      }
    },
    [fetchCables, toast],
  );

  const deleteCable = useCallback(
    async (id: string) => {
      try {
        await apiClient.delete(`/fibermaps/cables/${id}`);

        toast({
          title: "Cable Deleted",
          description: "Fiber cable has been deleted successfully",
        });

        await fetchCables();
        return true;
      } catch (err: any) {
        toast({
          title: "Error",
          description: err.response?.data?.detail || "Failed to delete fiber cable",
          variant: "destructive",
        });
        return false;
      }
    },
    [fetchCables, toast],
  );

  useEffect(() => {
    if (options.autoFetch !== false) {
      fetchCables();
    }
  }, [fetchCables, options.autoFetch]);

  return {
    cables,
    isLoading,
    error,
    refetch: fetchCables,
    createCable,
    updateCable,
    deleteCable,
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
  const [splicePoints, setSplicePoints] = useState<SplicePoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchSplicePoints = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (options.cable_id) params.append("cable_id", options.cable_id);
      if (options.limit) params.append("limit", options.limit.toString());

      const response = await apiClient.get<SplicePointsResponse>(
        `/fibermaps/splice-points?${params.toString()}`,
      );

      setSplicePoints(response.data.splice_points);
      return response.data.splice_points;
    } catch (err: any) {
      const error = new Error(err.response?.data?.detail || "Failed to fetch splice points");
      setError(error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [options.cable_id, options.limit, toast]);

  const createSplicePoint = useCallback(
    async (data: CreateSplicePointRequest) => {
      try {
        const response = await apiClient.post<SplicePoint>("/fibermaps/splice-points", data);

        toast({
          title: "Splice Point Created",
          description: `Splice point ${response.data.name} has been created successfully`,
        });

        await fetchSplicePoints();
        return response.data;
      } catch (err: any) {
        toast({
          title: "Error",
          description: err.response?.data?.detail || "Failed to create splice point",
          variant: "destructive",
        });
        return null;
      }
    },
    [fetchSplicePoints, toast],
  );

  const updateSplicePoint = useCallback(
    async (id: string, data: Partial<SplicePoint>) => {
      try {
        const response = await apiClient.patch<SplicePoint>(`/fibermaps/splice-points/${id}`, data);

        toast({
          title: "Splice Point Updated",
          description: "Splice point has been updated successfully",
        });

        await fetchSplicePoints();
        return response.data;
      } catch (err: any) {
        toast({
          title: "Error",
          description: err.response?.data?.detail || "Failed to update splice point",
          variant: "destructive",
        });
        return null;
      }
    },
    [fetchSplicePoints, toast],
  );

  const deleteSplicePoint = useCallback(
    async (id: string) => {
      try {
        await apiClient.delete(`/fibermaps/splice-points/${id}`);

        toast({
          title: "Splice Point Deleted",
          description: "Splice point has been deleted successfully",
        });

        await fetchSplicePoints();
        return true;
      } catch (err: any) {
        toast({
          title: "Error",
          description: err.response?.data?.detail || "Failed to delete splice point",
          variant: "destructive",
        });
        return false;
      }
    },
    [fetchSplicePoints, toast],
  );

  useEffect(() => {
    if (options.autoFetch !== false) {
      fetchSplicePoints();
    }
  }, [fetchSplicePoints, options.autoFetch]);

  return {
    splicePoints,
    isLoading,
    error,
    refetch: fetchSplicePoints,
    createSplicePoint,
    updateSplicePoint,
    deleteSplicePoint,
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
  const [distributionPoints, setDistributionPoints] = useState<DistributionPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchDistributionPoints = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (options.type) params.append("type", options.type);
      if (options.limit) params.append("limit", options.limit.toString());

      const response = await apiClient.get<DistributionPointsResponse>(
        `/fibermaps/distribution-points?${params.toString()}`,
      );

      setDistributionPoints(response.data.distribution_points);
      return response.data.distribution_points;
    } catch (err: any) {
      const error = new Error(err.response?.data?.detail || "Failed to fetch distribution points");
      setError(error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [options.type, options.limit, toast]);

  const createDistributionPoint = useCallback(
    async (data: CreateDistributionPointRequest) => {
      try {
        const response = await apiClient.post<DistributionPoint>(
          "/fibermaps/distribution-points",
          data,
        );

        toast({
          title: "Distribution Point Created",
          description: `Distribution point ${response.data.name} has been created successfully`,
        });

        await fetchDistributionPoints();
        return response.data;
      } catch (err: any) {
        toast({
          title: "Error",
          description: err.response?.data?.detail || "Failed to create distribution point",
          variant: "destructive",
        });
        return null;
      }
    },
    [fetchDistributionPoints, toast],
  );

  const updateDistributionPoint = useCallback(
    async (id: string, data: Partial<DistributionPoint>) => {
      try {
        const response = await apiClient.patch<DistributionPoint>(
          `/fibermaps/distribution-points/${id}`,
          data,
        );

        toast({
          title: "Distribution Point Updated",
          description: "Distribution point has been updated successfully",
        });

        await fetchDistributionPoints();
        return response.data;
      } catch (err: any) {
        toast({
          title: "Error",
          description: err.response?.data?.detail || "Failed to update distribution point",
          variant: "destructive",
        });
        return null;
      }
    },
    [fetchDistributionPoints, toast],
  );

  const deleteDistributionPoint = useCallback(
    async (id: string) => {
      try {
        await apiClient.delete(`/fibermaps/distribution-points/${id}`);

        toast({
          title: "Distribution Point Deleted",
          description: "Distribution point has been deleted successfully",
        });

        await fetchDistributionPoints();
        return true;
      } catch (err: any) {
        toast({
          title: "Error",
          description: err.response?.data?.detail || "Failed to delete distribution point",
          variant: "destructive",
        });
        return false;
      }
    },
    [fetchDistributionPoints, toast],
  );

  useEffect(() => {
    if (options.autoFetch !== false) {
      fetchDistributionPoints();
    }
  }, [fetchDistributionPoints, options.autoFetch]);

  return {
    distributionPoints,
    isLoading,
    error,
    refetch: fetchDistributionPoints,
    createDistributionPoint,
    updateDistributionPoint,
    deleteDistributionPoint,
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
  const { toast } = useToast();
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchServiceAreas = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (options.coverage_status) params.append("coverage_status", options.coverage_status);
      if (options.limit) params.append("limit", options.limit.toString());

      const response = await apiClient.get<ServiceAreasResponse>(
        `/fibermaps/service-areas?${params.toString()}`,
      );

      setServiceAreas(response.data.service_areas);
      return response.data.service_areas;
    } catch (err: any) {
      const error = new Error(err.response?.data?.detail || "Failed to fetch service areas");
      setError(error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [options.coverage_status, options.limit, toast]);

  useEffect(() => {
    if (options.autoFetch !== false) {
      fetchServiceAreas();
    }
  }, [fetchServiceAreas, options.autoFetch]);

  return {
    serviceAreas,
    isLoading,
    error,
    refetch: fetchServiceAreas,
  };
}

// ============================================================================
// Infrastructure Statistics Hook
// ============================================================================

export function useFiberInfrastructureStats() {
  const { toast } = useToast();
  const [stats, setStats] = useState<FiberInfrastructureStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await apiClient.get<FiberInfrastructureStats>("/fibermaps/statistics");

      setStats(response.data);
      return response.data;
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.detail || "Failed to fetch infrastructure statistics",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    isLoading,
    refetch: fetchStats,
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
