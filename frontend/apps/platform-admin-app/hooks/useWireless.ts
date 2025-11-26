/**
 * Wireless Infrastructure Custom Hooks
 *
 * React hooks for managing wireless network data, access points, coverage, and RF analytics
 * Migrated to TanStack Query for improved caching and state management
 */

"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";
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
// Query Keys Factory
// ============================================================================

export const wirelessKeys = {
  all: ["wireless"] as const,
  accessPoints: (filters?: {
    status?: string;
    type?: string;
    frequency_band?: string;
    limit?: number;
  }) => [...wirelessKeys.all, "accessPoints", filters] as const,
  clients: (filters?: {
    access_point_id?: string;
    ssid_id?: string;
    customer_id?: string;
    limit?: number;
  }) => [...wirelessKeys.all, "clients", filters] as const,
  coverageZones: (filters?: { coverage_level?: string; type?: string; limit?: number }) =>
    [...wirelessKeys.all, "coverageZones", filters] as const,
  rfAnalytics: (filters?: { access_point_id?: string; frequency_band?: string; limit?: number }) =>
    [...wirelessKeys.all, "rfAnalytics", filters] as const,
  siteSurveys: (filters?: { status?: string; limit?: number }) =>
    [...wirelessKeys.all, "siteSurveys", filters] as const,
  ssids: (filters?: { access_point_id?: string; enabled?: boolean; limit?: number }) =>
    [...wirelessKeys.all, "ssids", filters] as const,
  stats: () => [...wirelessKeys.all, "stats"] as const,
};

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
  const queryClient = useQueryClient();
  const { autoFetch = true, ...filters } = options;

  const query = useQuery({
    queryKey: wirelessKeys.accessPoints(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status) params.append("status", filters.status);
      if (filters.type) params.append("device_type", filters.type);
      if (filters.frequency_band) params.append("frequency", filters.frequency_band);
      if (filters.limit) params.append("limit", filters.limit.toString());

      logger.debug("Fetching access points", { filters });
      const response = await apiClient.get<AccessPoint[]>(
        `/wireless/devices?${params.toString()}`,
      );
      logger.info("Access points fetched successfully", { count: response.data.length });
      return response.data;
    },
    enabled: autoFetch,
    staleTime: 30000, // 30 seconds - wireless data changes frequently
    retry: 2,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateAccessPointRequest) => {
      const response = await apiClient.post<AccessPoint>("/wireless/access-points", data);
      return response.data;
    },
    onMutate: async (data) => {
      logger.info("Creating access point", { data });
      await queryClient.cancelQueries({ queryKey: wirelessKeys.accessPoints(filters) });
    },
    onError: (error: unknown) => {
      logger.error("Failed to create access point", error);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = error as any;
      toast({
        title: "Error",
        description: err.response?.data?.detail || "Failed to create access point",
        variant: "destructive",
      });
    },
    onSuccess: (data) => {
      logger.info("Access point created successfully", { id: data.id, name: data.name });
      toast({
        title: "Access Point Created",
        description: `Access point ${data.name} has been created successfully`,
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: wirelessKeys.accessPoints() });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateAccessPointRequest }) => {
      const response = await apiClient.patch<AccessPoint>(`/wireless/access-points/${id}`, data);
      return response.data;
    },
    onMutate: async ({ id, data }) => {
      logger.info("Updating access point", { id, data });
      await queryClient.cancelQueries({ queryKey: wirelessKeys.accessPoints(filters) });

      const previousData = queryClient.getQueryData<AccessPoint[]>(
        wirelessKeys.accessPoints(filters),
      );

      if (previousData) {
        queryClient.setQueryData<AccessPoint[]>(
          wirelessKeys.accessPoints(filters),
          previousData.map((ap) => (ap.id === id ? { ...ap, ...data } : ap)),
        );
      }

      return { previousData };
    },
    onError: (error: unknown, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(wirelessKeys.accessPoints(filters), context.previousData);
      }
      logger.error("Failed to update access point", error);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = error as any;
      toast({
        title: "Error",
        description: err.response?.data?.detail || "Failed to update access point",
        variant: "destructive",
      });
    },
    onSuccess: (data) => {
      logger.info("Access point updated successfully", { id: data.id });
      toast({
        title: "Access Point Updated",
        description: "Access point has been updated successfully",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: wirelessKeys.accessPoints() });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/wireless/access-points/${id}`);
      return id;
    },
    onMutate: async (id) => {
      logger.info("Deleting access point", { id });
      await queryClient.cancelQueries({ queryKey: wirelessKeys.accessPoints(filters) });

      const previousData = queryClient.getQueryData<AccessPoint[]>(
        wirelessKeys.accessPoints(filters),
      );

      if (previousData) {
        queryClient.setQueryData<AccessPoint[]>(
          wirelessKeys.accessPoints(filters),
          previousData.filter((ap) => ap.id !== id),
        );
      }

      return { previousData };
    },
    onError: (error: unknown, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(wirelessKeys.accessPoints(filters), context.previousData);
      }
      logger.error("Failed to delete access point", error);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = error as any;
      toast({
        title: "Error",
        description: err.response?.data?.detail || "Failed to delete access point",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      logger.info("Access point deleted successfully");
      toast({
        title: "Access Point Deleted",
        description: "Access point has been deleted successfully",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: wirelessKeys.accessPoints() });
    },
  });

  const rebootMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.post(`/wireless/access-points/${id}/reboot`);
      return id;
    },
    onMutate: (id) => {
      logger.info("Rebooting access point", { id });
    },
    onError: (error: unknown) => {
      logger.error("Failed to reboot access point", error);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = error as any;
      toast({
        title: "Error",
        description: err.response?.data?.detail || "Failed to reboot access point",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      logger.info("Access point reboot initiated");
      toast({
        title: "Reboot Initiated",
        description: "Access point reboot has been initiated",
      });
    },
  });

  return {
    accessPoints: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createAccessPoint: createMutation.mutateAsync,
    updateAccessPoint: (id: string, data: UpdateAccessPointRequest) =>
      updateMutation.mutateAsync({ id, data }),
    deleteAccessPoint: deleteMutation.mutateAsync,
    rebootAccessPoint: rebootMutation.mutateAsync,
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
  const queryClient = useQueryClient();
  const { autoFetch = true, ...filters } = options;

  const query = useQuery({
    queryKey: wirelessKeys.clients(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.access_point_id) params.append("access_point_id", filters.access_point_id);
      if (filters.ssid_id) params.append("ssid_id", filters.ssid_id);
      if (filters.customer_id) params.append("customer_id", filters.customer_id);
      if (filters.limit) params.append("limit", filters.limit.toString());

      logger.debug("Fetching wireless clients", { filters });
      const response = await apiClient.get<WirelessClientsResponse>(
        `/wireless/clients?${params.toString()}`,
      );
      logger.info("Wireless clients fetched successfully", { count: response.data.clients.length });
      return response.data.clients;
    },
    enabled: autoFetch,
    staleTime: 30000, // 30 seconds - client connections change frequently
    retry: 2,
  });

  const disconnectMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.post(`/wireless/clients/${id}/disconnect`);
      return id;
    },
    onMutate: async (id) => {
      logger.info("Disconnecting wireless client", { id });
      await queryClient.cancelQueries({ queryKey: wirelessKeys.clients(filters) });

      const previousData = queryClient.getQueryData<WirelessClient[]>(wirelessKeys.clients(filters));

      if (previousData) {
        queryClient.setQueryData<WirelessClient[]>(
          wirelessKeys.clients(filters),
          previousData.filter((client) => client.id !== id),
        );
      }

      return { previousData };
    },
    onError: (error: unknown, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(wirelessKeys.clients(filters), context.previousData);
      }
      logger.error("Failed to disconnect client", error);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = error as any;
      toast({
        title: "Error",
        description: err.response?.data?.detail || "Failed to disconnect client",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      logger.info("Client disconnected successfully");
      toast({
        title: "Client Disconnected",
        description: "Client has been disconnected successfully",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: wirelessKeys.clients() });
    },
  });

  return {
    clients: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    disconnectClient: disconnectMutation.mutateAsync,
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
  const queryClient = useQueryClient();
  const { autoFetch = true, ...filters } = options;

  const query = useQuery({
    queryKey: wirelessKeys.coverageZones(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.coverage_level) params.append("coverage_level", filters.coverage_level);
      if (filters.type) params.append("type", filters.type);
      if (filters.limit) params.append("limit", filters.limit.toString());

      logger.debug("Fetching coverage zones", { filters });
      const response = await apiClient.get<CoverageZonesResponse>(
        `/wireless/coverage-zones?${params.toString()}`,
      );
      logger.info("Coverage zones fetched successfully", {
        count: response.data.coverage_zones.length,
      });
      return response.data.coverage_zones;
    },
    enabled: autoFetch,
    staleTime: 30000, // 30 seconds
    retry: 2,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateCoverageZoneRequest) => {
      const response = await apiClient.post<CoverageZone>("/wireless/coverage-zones", data);
      return response.data;
    },
    onMutate: async (data) => {
      logger.info("Creating coverage zone", { data });
      await queryClient.cancelQueries({ queryKey: wirelessKeys.coverageZones(filters) });
    },
    onError: (error: unknown) => {
      logger.error("Failed to create coverage zone", error);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = error as any;
      toast({
        title: "Error",
        description: err.response?.data?.detail || "Failed to create coverage zone",
        variant: "destructive",
      });
    },
    onSuccess: (data) => {
      logger.info("Coverage zone created successfully", { id: data.id, name: data.name });
      toast({
        title: "Coverage Zone Created",
        description: `Coverage zone ${data.name} has been created successfully`,
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: wirelessKeys.coverageZones() });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CoverageZone> }) => {
      const response = await apiClient.patch<CoverageZone>(`/wireless/coverage-zones/${id}`, data);
      return response.data;
    },
    onMutate: async ({ id, data }) => {
      logger.info("Updating coverage zone", { id, data });
      await queryClient.cancelQueries({ queryKey: wirelessKeys.coverageZones(filters) });

      const previousData = queryClient.getQueryData<CoverageZone[]>(
        wirelessKeys.coverageZones(filters),
      );

      if (previousData) {
        queryClient.setQueryData<CoverageZone[]>(
          wirelessKeys.coverageZones(filters),
          previousData.map((zone) => (zone.id === id ? { ...zone, ...data } : zone)),
        );
      }

      return { previousData };
    },
    onError: (error: unknown, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(wirelessKeys.coverageZones(filters), context.previousData);
      }
      logger.error("Failed to update coverage zone", error);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = error as any;
      toast({
        title: "Error",
        description: err.response?.data?.detail || "Failed to update coverage zone",
        variant: "destructive",
      });
    },
    onSuccess: (data) => {
      logger.info("Coverage zone updated successfully", { id: data.id });
      toast({
        title: "Coverage Zone Updated",
        description: "Coverage zone has been updated successfully",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: wirelessKeys.coverageZones() });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/wireless/coverage-zones/${id}`);
      return id;
    },
    onMutate: async (id) => {
      logger.info("Deleting coverage zone", { id });
      await queryClient.cancelQueries({ queryKey: wirelessKeys.coverageZones(filters) });

      const previousData = queryClient.getQueryData<CoverageZone[]>(
        wirelessKeys.coverageZones(filters),
      );

      if (previousData) {
        queryClient.setQueryData<CoverageZone[]>(
          wirelessKeys.coverageZones(filters),
          previousData.filter((zone) => zone.id !== id),
        );
      }

      return { previousData };
    },
    onError: (error: unknown, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(wirelessKeys.coverageZones(filters), context.previousData);
      }
      logger.error("Failed to delete coverage zone", error);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = error as any;
      toast({
        title: "Error",
        description: err.response?.data?.detail || "Failed to delete coverage zone",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      logger.info("Coverage zone deleted successfully");
      toast({
        title: "Coverage Zone Deleted",
        description: "Coverage zone has been deleted successfully",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: wirelessKeys.coverageZones() });
    },
  });

  return {
    coverageZones: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createCoverageZone: createMutation.mutateAsync,
    updateCoverageZone: (id: string, data: Partial<CoverageZone>) =>
      updateMutation.mutateAsync({ id, data }),
    deleteCoverageZone: deleteMutation.mutateAsync,
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
  const queryClient = useQueryClient();
  const { autoFetch = true, ...filters } = options;

  const query = useQuery({
    queryKey: wirelessKeys.rfAnalytics(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.access_point_id) params.append("access_point_id", filters.access_point_id);
      if (filters.frequency_band) params.append("frequency_band", filters.frequency_band);
      if (filters.limit) params.append("limit", filters.limit.toString());

      logger.debug("Fetching RF analytics", { filters });
      const response = await apiClient.get<RFAnalyticsResponse>(
        `/wireless/rf-analytics?${params.toString()}`,
      );
      logger.info("RF analytics fetched successfully", { count: response.data.analytics.length });
      return response.data.analytics;
    },
    enabled: autoFetch,
    staleTime: 30000, // 30 seconds - RF data changes frequently
    retry: 2,
  });

  const runAnalysisMutation = useMutation({
    mutationFn: async (accessPointId: string) => {
      const response = await apiClient.post<RFAnalytics>(
        `/wireless/access-points/${accessPointId}/spectrum-analysis`,
      );
      return response.data;
    },
    onMutate: (accessPointId) => {
      logger.info("Running spectrum analysis", { accessPointId });
    },
    onError: (error: unknown) => {
      logger.error("Failed to run spectrum analysis", error);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = error as any;
      toast({
        title: "Error",
        description: err.response?.data?.detail || "Failed to run spectrum analysis",
        variant: "destructive",
      });
    },
    onSuccess: (data) => {
      logger.info("Spectrum analysis completed", { id: data.id });
      toast({
        title: "Spectrum Analysis Complete",
        description: "RF spectrum analysis has been completed",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: wirelessKeys.rfAnalytics() });
    },
  });

  return {
    analytics: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    runSpectrumAnalysis: runAnalysisMutation.mutateAsync,
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
  const queryClient = useQueryClient();
  const { autoFetch = true, ...filters } = options;

  const query = useQuery({
    queryKey: wirelessKeys.siteSurveys(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status) params.append("status", filters.status);
      if (filters.limit) params.append("limit", filters.limit.toString());

      logger.debug("Fetching site surveys", { filters });
      const response = await apiClient.get<SiteSurveysResponse>(
        `/wireless/site-surveys?${params.toString()}`,
      );
      logger.info("Site surveys fetched successfully", {
        count: response.data.site_surveys.length,
      });
      return response.data.site_surveys;
    },
    enabled: autoFetch,
    staleTime: 30000, // 30 seconds
    retry: 2,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateSiteSurveyRequest) => {
      const response = await apiClient.post<SiteSurvey>("/wireless/site-surveys", data);
      return response.data;
    },
    onMutate: async (data) => {
      logger.info("Creating site survey", { data });
      await queryClient.cancelQueries({ queryKey: wirelessKeys.siteSurveys(filters) });
    },
    onError: (error: unknown) => {
      logger.error("Failed to create site survey", error);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = error as any;
      toast({
        title: "Error",
        description: err.response?.data?.detail || "Failed to create site survey",
        variant: "destructive",
      });
    },
    onSuccess: (data) => {
      logger.info("Site survey created successfully", { id: data.id, name: data.name });
      toast({
        title: "Site Survey Created",
        description: `Site survey ${data.name} has been created successfully`,
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: wirelessKeys.siteSurveys() });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SiteSurvey> }) => {
      const response = await apiClient.patch<SiteSurvey>(`/wireless/site-surveys/${id}`, data);
      return response.data;
    },
    onMutate: async ({ id, data }) => {
      logger.info("Updating site survey", { id, data });
      await queryClient.cancelQueries({ queryKey: wirelessKeys.siteSurveys(filters) });

      const previousData = queryClient.getQueryData<SiteSurvey[]>(
        wirelessKeys.siteSurveys(filters),
      );

      if (previousData) {
        queryClient.setQueryData<SiteSurvey[]>(
          wirelessKeys.siteSurveys(filters),
          previousData.map((survey) => (survey.id === id ? { ...survey, ...data } : survey)),
        );
      }

      return { previousData };
    },
    onError: (error: unknown, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(wirelessKeys.siteSurveys(filters), context.previousData);
      }
      logger.error("Failed to update site survey", error);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = error as any;
      toast({
        title: "Error",
        description: err.response?.data?.detail || "Failed to update site survey",
        variant: "destructive",
      });
    },
    onSuccess: (data) => {
      logger.info("Site survey updated successfully", { id: data.id });
      toast({
        title: "Site Survey Updated",
        description: "Site survey has been updated successfully",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: wirelessKeys.siteSurveys() });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/wireless/site-surveys/${id}`);
      return id;
    },
    onMutate: async (id) => {
      logger.info("Deleting site survey", { id });
      await queryClient.cancelQueries({ queryKey: wirelessKeys.siteSurveys(filters) });

      const previousData = queryClient.getQueryData<SiteSurvey[]>(
        wirelessKeys.siteSurveys(filters),
      );

      if (previousData) {
        queryClient.setQueryData<SiteSurvey[]>(
          wirelessKeys.siteSurveys(filters),
          previousData.filter((survey) => survey.id !== id),
        );
      }

      return { previousData };
    },
    onError: (error: unknown, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(wirelessKeys.siteSurveys(filters), context.previousData);
      }
      logger.error("Failed to delete site survey", error);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = error as any;
      toast({
        title: "Error",
        description: err.response?.data?.detail || "Failed to delete site survey",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      logger.info("Site survey deleted successfully");
      toast({
        title: "Site Survey Deleted",
        description: "Site survey has been deleted successfully",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: wirelessKeys.siteSurveys() });
    },
  });

  return {
    siteSurveys: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createSiteSurvey: createMutation.mutateAsync,
    updateSiteSurvey: (id: string, data: Partial<SiteSurvey>) =>
      updateMutation.mutateAsync({ id, data }),
    deleteSiteSurvey: deleteMutation.mutateAsync,
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
  const queryClient = useQueryClient();
  const { autoFetch = true, ...filters } = options;

  const query = useQuery({
    queryKey: wirelessKeys.ssids(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.access_point_id) params.append("access_point_id", filters.access_point_id);
      if (filters.enabled !== undefined) params.append("enabled", filters.enabled.toString());
      if (filters.limit) params.append("limit", filters.limit.toString());

      logger.debug("Fetching SSIDs", { filters });
      const response = await apiClient.get<{ ssids: SSID[]; total: number }>(
        `/wireless/ssids?${params.toString()}`,
      );
      logger.info("SSIDs fetched successfully", { count: response.data.ssids.length });
      return response.data.ssids;
    },
    enabled: autoFetch,
    staleTime: 30000, // 30 seconds
    retry: 2,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateSSIDRequest) => {
      const response = await apiClient.post<SSID>("/wireless/ssids", data);
      return response.data;
    },
    onMutate: async (data) => {
      logger.info("Creating SSID", { data });
      await queryClient.cancelQueries({ queryKey: wirelessKeys.ssids(filters) });
    },
    onError: (error: unknown) => {
      logger.error("Failed to create SSID", error);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = error as any;
      toast({
        title: "Error",
        description: err.response?.data?.detail || "Failed to create SSID",
        variant: "destructive",
      });
    },
    onSuccess: (data) => {
      logger.info("SSID created successfully", { id: data.id, name: data.ssid_name });
      toast({
        title: "SSID Created",
        description: `SSID ${data.ssid_name} has been created successfully`,
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: wirelessKeys.ssids() });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SSID> }) => {
      const response = await apiClient.patch<SSID>(`/wireless/ssids/${id}`, data);
      return response.data;
    },
    onMutate: async ({ id, data }) => {
      logger.info("Updating SSID", { id, data });
      await queryClient.cancelQueries({ queryKey: wirelessKeys.ssids(filters) });

      const previousData = queryClient.getQueryData<SSID[]>(wirelessKeys.ssids(filters));

      if (previousData) {
        queryClient.setQueryData<SSID[]>(
          wirelessKeys.ssids(filters),
          previousData.map((ssid) => (ssid.id === id ? { ...ssid, ...data } : ssid)),
        );
      }

      return { previousData };
    },
    onError: (error: unknown, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(wirelessKeys.ssids(filters), context.previousData);
      }
      logger.error("Failed to update SSID", error);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = error as any;
      toast({
        title: "Error",
        description: err.response?.data?.detail || "Failed to update SSID",
        variant: "destructive",
      });
    },
    onSuccess: (data) => {
      logger.info("SSID updated successfully", { id: data.id });
      toast({
        title: "SSID Updated",
        description: "SSID has been updated successfully",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: wirelessKeys.ssids() });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/wireless/ssids/${id}`);
      return id;
    },
    onMutate: async (id) => {
      logger.info("Deleting SSID", { id });
      await queryClient.cancelQueries({ queryKey: wirelessKeys.ssids(filters) });

      const previousData = queryClient.getQueryData<SSID[]>(wirelessKeys.ssids(filters));

      if (previousData) {
        queryClient.setQueryData<SSID[]>(
          wirelessKeys.ssids(filters),
          previousData.filter((ssid) => ssid.id !== id),
        );
      }

      return { previousData };
    },
    onError: (error: unknown, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(wirelessKeys.ssids(filters), context.previousData);
      }
      logger.error("Failed to delete SSID", error);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = error as any;
      toast({
        title: "Error",
        description: err.response?.data?.detail || "Failed to delete SSID",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      logger.info("SSID deleted successfully");
      toast({
        title: "SSID Deleted",
        description: "SSID has been deleted successfully",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: wirelessKeys.ssids() });
    },
  });

  return {
    ssids: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createSSID: createMutation.mutateAsync,
    updateSSID: (id: string, data: Partial<SSID>) => updateMutation.mutateAsync({ id, data }),
    deleteSSID: deleteMutation.mutateAsync,
  };
}

// ============================================================================
// Wireless Infrastructure Statistics Hook
// ============================================================================

export function useWirelessInfrastructureStats() {
  const { toast } = useToast();

  const query = useQuery({
    queryKey: wirelessKeys.stats(),
    queryFn: async () => {
      logger.debug("Fetching wireless infrastructure statistics");
      const response = await apiClient.get<WirelessInfrastructureStats>("/wireless/statistics");
      logger.info("Wireless statistics fetched successfully");
      return response.data;
    },
    staleTime: 30000, // 30 seconds - stats change frequently
    retry: 2,
    meta: {
      onError: (error: unknown) => {
        logger.error("Failed to fetch wireless statistics", error);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = error as any;
        toast({
          title: "Error",
          description: err.response?.data?.detail || "Failed to fetch wireless statistics",
          variant: "destructive",
        });
      },
    },
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
