/**
 * Wireless Infrastructure Custom Hooks
 *
 * React hooks for managing wireless network data, access points, coverage, and RF analytics
 */

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@dotmac/ui";
import type {
  AccessPoint,
  AccessPointsResponse,
  WirelessClient,
  WirelessClientsResponse,
  CoverageZone,
  CoverageZonesResponse,
  RFAnalytics,
  RFAnalyticsResponse,
  SiteSurvey,
  SiteSurveysResponse,
  SSID,
  WirelessInfrastructureStats,
  CreateAccessPointRequest,
  UpdateAccessPointRequest,
  CreateSSIDRequest,
  CreateCoverageZoneRequest,
  CreateSiteSurveyRequest,
  Coordinates,
  MapViewState,
  MapLayer,
} from "@/types/wireless";

// ============================================================================
// Access Points Hook
// ============================================================================

interface UseAccessPointsOptions {
  status?: string;
  type?: string;
  frequency_band?: string;
  limit?: number;
  autoFetch?: boolean;
}

export function useAccessPoints(options: UseAccessPointsOptions = {}) {
  const { toast } = useToast();
  const [accessPoints, setAccessPoints] = useState<AccessPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchAccessPoints = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (options.status) params.append("status", options.status);
      if (options.type) params.append("device_type", options.type); // Backend uses device_type
      if (options.frequency_band) params.append("frequency", options.frequency_band); // Backend uses frequency
      if (options.limit) params.append("limit", options.limit.toString());

      // Backend endpoint is /devices
      const response = await apiClient.get<AccessPoint[]>(`/wireless/devices?${params.toString()}`);

      // Backend already returns AccessPoint format
      setAccessPoints(response.data);
      return response.data;
    } catch (err: any) {
      const error = new Error(err.response?.data?.detail || "Failed to fetch access points");
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
  }, [options.status, options.type, options.frequency_band, options.limit, toast]);

  const createAccessPoint = useCallback(
    async (data: CreateAccessPointRequest) => {
      try {
        const response = await apiClient.post<AccessPoint>("/wireless/access-points", data);

        toast({
          title: "Access Point Created",
          description: `Access point ${response.data.name} has been created successfully`,
        });

        await fetchAccessPoints();
        return response.data;
      } catch (err: any) {
        toast({
          title: "Error",
          description: err.response?.data?.detail || "Failed to create access point",
          variant: "destructive",
        });
        return null;
      }
    },
    [fetchAccessPoints, toast],
  );

  const updateAccessPoint = useCallback(
    async (id: string, data: UpdateAccessPointRequest) => {
      try {
        const response = await apiClient.patch<AccessPoint>(`/wireless/access-points/${id}`, data);

        toast({
          title: "Access Point Updated",
          description: "Access point has been updated successfully",
        });

        await fetchAccessPoints();
        return response.data;
      } catch (err: any) {
        toast({
          title: "Error",
          description: err.response?.data?.detail || "Failed to update access point",
          variant: "destructive",
        });
        return null;
      }
    },
    [fetchAccessPoints, toast],
  );

  const deleteAccessPoint = useCallback(
    async (id: string) => {
      try {
        await apiClient.delete(`/wireless/access-points/${id}`);

        toast({
          title: "Access Point Deleted",
          description: "Access point has been deleted successfully",
        });

        await fetchAccessPoints();
        return true;
      } catch (err: any) {
        toast({
          title: "Error",
          description: err.response?.data?.detail || "Failed to delete access point",
          variant: "destructive",
        });
        return false;
      }
    },
    [fetchAccessPoints, toast],
  );

  const rebootAccessPoint = useCallback(
    async (id: string) => {
      try {
        await apiClient.post(`/wireless/access-points/${id}/reboot`);

        toast({
          title: "Reboot Initiated",
          description: "Access point reboot has been initiated",
        });

        return true;
      } catch (err: any) {
        toast({
          title: "Error",
          description: err.response?.data?.detail || "Failed to reboot access point",
          variant: "destructive",
        });
        return false;
      }
    },
    [toast],
  );

  useEffect(() => {
    if (options.autoFetch !== false) {
      fetchAccessPoints();
    }
  }, [fetchAccessPoints, options.autoFetch]);

  return {
    accessPoints,
    isLoading,
    error,
    refetch: fetchAccessPoints,
    createAccessPoint,
    updateAccessPoint,
    deleteAccessPoint,
    rebootAccessPoint,
  };
}

// ============================================================================
// Wireless Clients Hook
// ============================================================================

interface UseWirelessClientsOptions {
  access_point_id?: string;
  ssid_id?: string;
  customer_id?: string;
  limit?: number;
  autoFetch?: boolean;
}

export function useWirelessClients(options: UseWirelessClientsOptions = {}) {
  const { toast } = useToast();
  const [clients, setClients] = useState<WirelessClient[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchClients = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (options.access_point_id) params.append("access_point_id", options.access_point_id);
      if (options.ssid_id) params.append("ssid_id", options.ssid_id);
      if (options.customer_id) params.append("customer_id", options.customer_id);
      if (options.limit) params.append("limit", options.limit.toString());

      const response = await apiClient.get<WirelessClientsResponse>(
        `/wireless/clients?${params.toString()}`,
      );

      setClients(response.data.clients);
      return response.data.clients;
    } catch (err: any) {
      const error = new Error(err.response?.data?.detail || "Failed to fetch wireless clients");
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
  }, [options.access_point_id, options.ssid_id, options.customer_id, options.limit, toast]);

  const disconnectClient = useCallback(
    async (id: string) => {
      try {
        await apiClient.post(`/wireless/clients/${id}/disconnect`);

        toast({
          title: "Client Disconnected",
          description: "Client has been disconnected successfully",
        });

        await fetchClients();
        return true;
      } catch (err: any) {
        toast({
          title: "Error",
          description: err.response?.data?.detail || "Failed to disconnect client",
          variant: "destructive",
        });
        return false;
      }
    },
    [fetchClients, toast],
  );

  useEffect(() => {
    if (options.autoFetch !== false) {
      fetchClients();
    }
  }, [fetchClients, options.autoFetch]);

  return {
    clients,
    isLoading,
    error,
    refetch: fetchClients,
    disconnectClient,
  };
}

// ============================================================================
// Coverage Zones Hook
// ============================================================================

interface UseCoverageZonesOptions {
  coverage_level?: string;
  type?: string;
  limit?: number;
  autoFetch?: boolean;
}

export function useCoverageZones(options: UseCoverageZonesOptions = {}) {
  const { toast } = useToast();
  const [coverageZones, setCoverageZones] = useState<CoverageZone[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchCoverageZones = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (options.coverage_level) params.append("coverage_level", options.coverage_level);
      if (options.type) params.append("type", options.type);
      if (options.limit) params.append("limit", options.limit.toString());

      const response = await apiClient.get<CoverageZonesResponse>(
        `/wireless/coverage-zones?${params.toString()}`,
      );

      setCoverageZones(response.data.coverage_zones);
      return response.data.coverage_zones;
    } catch (err: any) {
      const error = new Error(err.response?.data?.detail || "Failed to fetch coverage zones");
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
  }, [options.coverage_level, options.type, options.limit, toast]);

  const createCoverageZone = useCallback(
    async (data: CreateCoverageZoneRequest) => {
      try {
        const response = await apiClient.post<CoverageZone>("/wireless/coverage-zones", data);

        toast({
          title: "Coverage Zone Created",
          description: `Coverage zone ${response.data.name} has been created successfully`,
        });

        await fetchCoverageZones();
        return response.data;
      } catch (err: any) {
        toast({
          title: "Error",
          description: err.response?.data?.detail || "Failed to create coverage zone",
          variant: "destructive",
        });
        return null;
      }
    },
    [fetchCoverageZones, toast],
  );

  const updateCoverageZone = useCallback(
    async (id: string, data: Partial<CoverageZone>) => {
      try {
        const response = await apiClient.patch<CoverageZone>(
          `/wireless/coverage-zones/${id}`,
          data,
        );

        toast({
          title: "Coverage Zone Updated",
          description: "Coverage zone has been updated successfully",
        });

        await fetchCoverageZones();
        return response.data;
      } catch (err: any) {
        toast({
          title: "Error",
          description: err.response?.data?.detail || "Failed to update coverage zone",
          variant: "destructive",
        });
        return null;
      }
    },
    [fetchCoverageZones, toast],
  );

  const deleteCoverageZone = useCallback(
    async (id: string) => {
      try {
        await apiClient.delete(`/wireless/coverage-zones/${id}`);

        toast({
          title: "Coverage Zone Deleted",
          description: "Coverage zone has been deleted successfully",
        });

        await fetchCoverageZones();
        return true;
      } catch (err: any) {
        toast({
          title: "Error",
          description: err.response?.data?.detail || "Failed to delete coverage zone",
          variant: "destructive",
        });
        return false;
      }
    },
    [fetchCoverageZones, toast],
  );

  useEffect(() => {
    if (options.autoFetch !== false) {
      fetchCoverageZones();
    }
  }, [fetchCoverageZones, options.autoFetch]);

  return {
    coverageZones,
    isLoading,
    error,
    refetch: fetchCoverageZones,
    createCoverageZone,
    updateCoverageZone,
    deleteCoverageZone,
  };
}

// ============================================================================
// RF Analytics Hook
// ============================================================================

interface UseRFAnalyticsOptions {
  access_point_id?: string;
  frequency_band?: string;
  limit?: number;
  autoFetch?: boolean;
}

export function useRFAnalytics(options: UseRFAnalyticsOptions = {}) {
  const { toast } = useToast();
  const [analytics, setAnalytics] = useState<RFAnalytics[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (options.access_point_id) params.append("access_point_id", options.access_point_id);
      if (options.frequency_band) params.append("frequency_band", options.frequency_band);
      if (options.limit) params.append("limit", options.limit.toString());

      const response = await apiClient.get<RFAnalyticsResponse>(
        `/wireless/rf-analytics?${params.toString()}`,
      );

      setAnalytics(response.data.analytics);
      return response.data.analytics;
    } catch (err: any) {
      const error = new Error(err.response?.data?.detail || "Failed to fetch RF analytics");
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
  }, [options.access_point_id, options.frequency_band, options.limit, toast]);

  const runSpectrumAnalysis = useCallback(
    async (accessPointId: string) => {
      try {
        const response = await apiClient.post<RFAnalytics>(
          `/wireless/access-points/${accessPointId}/spectrum-analysis`,
        );

        toast({
          title: "Spectrum Analysis Complete",
          description: "RF spectrum analysis has been completed",
        });

        await fetchAnalytics();
        return response.data;
      } catch (err: any) {
        toast({
          title: "Error",
          description: err.response?.data?.detail || "Failed to run spectrum analysis",
          variant: "destructive",
        });
        return null;
      }
    },
    [fetchAnalytics, toast],
  );

  useEffect(() => {
    if (options.autoFetch !== false) {
      fetchAnalytics();
    }
  }, [fetchAnalytics, options.autoFetch]);

  return {
    analytics,
    isLoading,
    error,
    refetch: fetchAnalytics,
    runSpectrumAnalysis,
  };
}

// ============================================================================
// Site Surveys Hook
// ============================================================================

interface UseSiteSurveysOptions {
  status?: string;
  limit?: number;
  autoFetch?: boolean;
}

export function useSiteSurveys(options: UseSiteSurveysOptions = {}) {
  const { toast } = useToast();
  const [siteSurveys, setSiteSurveys] = useState<SiteSurvey[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchSiteSurveys = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (options.status) params.append("status", options.status);
      if (options.limit) params.append("limit", options.limit.toString());

      const response = await apiClient.get<SiteSurveysResponse>(
        `/wireless/site-surveys?${params.toString()}`,
      );

      setSiteSurveys(response.data.site_surveys);
      return response.data.site_surveys;
    } catch (err: any) {
      const error = new Error(err.response?.data?.detail || "Failed to fetch site surveys");
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
  }, [options.status, options.limit, toast]);

  const createSiteSurvey = useCallback(
    async (data: CreateSiteSurveyRequest) => {
      try {
        const response = await apiClient.post<SiteSurvey>("/wireless/site-surveys", data);

        toast({
          title: "Site Survey Created",
          description: `Site survey ${response.data.name} has been created successfully`,
        });

        await fetchSiteSurveys();
        return response.data;
      } catch (err: any) {
        toast({
          title: "Error",
          description: err.response?.data?.detail || "Failed to create site survey",
          variant: "destructive",
        });
        return null;
      }
    },
    [fetchSiteSurveys, toast],
  );

  const updateSiteSurvey = useCallback(
    async (id: string, data: Partial<SiteSurvey>) => {
      try {
        const response = await apiClient.patch<SiteSurvey>(`/wireless/site-surveys/${id}`, data);

        toast({
          title: "Site Survey Updated",
          description: "Site survey has been updated successfully",
        });

        await fetchSiteSurveys();
        return response.data;
      } catch (err: any) {
        toast({
          title: "Error",
          description: err.response?.data?.detail || "Failed to update site survey",
          variant: "destructive",
        });
        return null;
      }
    },
    [fetchSiteSurveys, toast],
  );

  const deleteSiteSurvey = useCallback(
    async (id: string) => {
      try {
        await apiClient.delete(`/wireless/site-surveys/${id}`);

        toast({
          title: "Site Survey Deleted",
          description: "Site survey has been deleted successfully",
        });

        await fetchSiteSurveys();
        return true;
      } catch (err: any) {
        toast({
          title: "Error",
          description: err.response?.data?.detail || "Failed to delete site survey",
          variant: "destructive",
        });
        return false;
      }
    },
    [fetchSiteSurveys, toast],
  );

  useEffect(() => {
    if (options.autoFetch !== false) {
      fetchSiteSurveys();
    }
  }, [fetchSiteSurveys, options.autoFetch]);

  return {
    siteSurveys,
    isLoading,
    error,
    refetch: fetchSiteSurveys,
    createSiteSurvey,
    updateSiteSurvey,
    deleteSiteSurvey,
  };
}

// ============================================================================
// SSIDs Hook
// ============================================================================

interface UseSSIDsOptions {
  access_point_id?: string;
  enabled?: boolean;
  limit?: number;
  autoFetch?: boolean;
}

export function useSSIDs(options: UseSSIDsOptions = {}) {
  const { toast } = useToast();
  const [ssids, setSSIDs] = useState<SSID[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchSSIDs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (options.access_point_id) params.append("access_point_id", options.access_point_id);
      if (options.enabled !== undefined) params.append("enabled", options.enabled.toString());
      if (options.limit) params.append("limit", options.limit.toString());

      const response = await apiClient.get<{ ssids: SSID[]; total: number }>(
        `/wireless/ssids?${params.toString()}`,
      );

      setSSIDs(response.data.ssids);
      return response.data.ssids;
    } catch (err: any) {
      const error = new Error(err.response?.data?.detail || "Failed to fetch SSIDs");
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
  }, [options.access_point_id, options.enabled, options.limit, toast]);

  const createSSID = useCallback(
    async (data: CreateSSIDRequest) => {
      try {
        const response = await apiClient.post<SSID>("/wireless/ssids", data);

        toast({
          title: "SSID Created",
          description: `SSID ${response.data.ssid_name} has been created successfully`,
        });

        await fetchSSIDs();
        return response.data;
      } catch (err: any) {
        toast({
          title: "Error",
          description: err.response?.data?.detail || "Failed to create SSID",
          variant: "destructive",
        });
        return null;
      }
    },
    [fetchSSIDs, toast],
  );

  const updateSSID = useCallback(
    async (id: string, data: Partial<SSID>) => {
      try {
        const response = await apiClient.patch<SSID>(`/wireless/ssids/${id}`, data);

        toast({
          title: "SSID Updated",
          description: "SSID has been updated successfully",
        });

        await fetchSSIDs();
        return response.data;
      } catch (err: any) {
        toast({
          title: "Error",
          description: err.response?.data?.detail || "Failed to update SSID",
          variant: "destructive",
        });
        return null;
      }
    },
    [fetchSSIDs, toast],
  );

  const deleteSSID = useCallback(
    async (id: string) => {
      try {
        await apiClient.delete(`/wireless/ssids/${id}`);

        toast({
          title: "SSID Deleted",
          description: "SSID has been deleted successfully",
        });

        await fetchSSIDs();
        return true;
      } catch (err: any) {
        toast({
          title: "Error",
          description: err.response?.data?.detail || "Failed to delete SSID",
          variant: "destructive",
        });
        return false;
      }
    },
    [fetchSSIDs, toast],
  );

  useEffect(() => {
    if (options.autoFetch !== false) {
      fetchSSIDs();
    }
  }, [fetchSSIDs, options.autoFetch]);

  return {
    ssids,
    isLoading,
    error,
    refetch: fetchSSIDs,
    createSSID,
    updateSSID,
    deleteSSID,
  };
}

// ============================================================================
// Wireless Infrastructure Statistics Hook
// ============================================================================

export function useWirelessInfrastructureStats() {
  const { toast } = useToast();
  const [stats, setStats] = useState<WirelessInfrastructureStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await apiClient.get<WirelessInfrastructureStats>("/wireless/statistics");

      setStats(response.data);
      return response.data;
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.detail || "Failed to fetch wireless statistics",
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
    id: "access_points",
    name: "Access Points",
    type: "access_points",
    visible: true,
    color: "#3b82f6",
    opacity: 1,
  },
  {
    id: "coverage_zones",
    name: "Coverage Zones",
    type: "coverage_zones",
    visible: true,
    color: "#10b981",
    opacity: 0.3,
  },
  {
    id: "signal_heat_map",
    name: "Signal Heat Map",
    type: "signal_heat_map",
    visible: false,
    color: "#f59e0b",
    opacity: 0.5,
  },
  {
    id: "clients",
    name: "Connected Clients",
    type: "clients",
    visible: true,
    color: "#8b5cf6",
    opacity: 1,
  },
  {
    id: "interference",
    name: "Interference",
    type: "interference",
    visible: false,
    color: "#ef4444",
    opacity: 0.7,
  },
  {
    id: "site_survey",
    name: "Site Survey",
    type: "site_survey",
    visible: false,
    color: "#06b6d4",
    opacity: 0.8,
  },
];

export function useWirelessMapView() {
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
