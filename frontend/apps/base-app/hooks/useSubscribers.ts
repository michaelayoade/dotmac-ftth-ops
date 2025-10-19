/**
 * Subscriber Management Hooks
 *
 * Custom hooks for managing subscribers, their services, and related operations
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api/client';

// ============================================================================
// Types
// ============================================================================

export type SubscriberStatus = 'active' | 'suspended' | 'pending' | 'inactive' | 'terminated';
export type ServiceStatus = 'active' | 'suspended' | 'pending_activation' | 'terminated';
export type ConnectionType = 'ftth' | 'fttb' | 'wireless' | 'hybrid';

export interface Subscriber {
  id: string;
  tenant_id: string;
  subscriber_id: string;
  customer_id?: string;

  // Personal Information
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  secondary_phone?: string;

  // Service Address
  service_address: string;
  service_city: string;
  service_state: string;
  service_postal_code: string;
  service_country: string;

  // Billing Address
  billing_address?: string;
  billing_city?: string;
  billing_state?: string;
  billing_postal_code?: string;
  billing_country?: string;

  // Status and Service
  status: SubscriberStatus;
  connection_type: ConnectionType;
  service_plan?: string;
  bandwidth_mbps?: number;

  // Installation Details
  installation_date?: string;
  installation_technician?: string;
  installation_status?: string;
  installation_notes?: string;

  // Network Details
  ont_serial_number?: string;
  ont_mac_address?: string;
  router_serial_number?: string;
  vlan_id?: number;
  ipv4_address?: string;
  ipv6_address?: string;

  // Service Quality
  signal_strength?: number;
  last_online?: string;
  uptime_percentage?: number;

  // Business Details
  subscription_start_date?: string;
  subscription_end_date?: string;
  billing_cycle?: string;
  payment_method?: string;

  // Metadata
  tags?: Record<string, any>;
  metadata?: Record<string, any>;
  notes?: string;

  created_at: string;
  updated_at: string;
}

export interface SubscriberService {
  id: string;
  subscriber_id: string;
  service_type: string;
  service_name: string;
  status: ServiceStatus;
  bandwidth_mbps?: number;
  monthly_fee: number;
  activation_date?: string;
  termination_date?: string;

  // Service specific details
  static_ip?: boolean;
  ipv4_addresses?: string[];
  ipv6_prefix?: string;

  // Equipment
  equipment_ids?: string[];

  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface SubscriberStatistics {
  total_subscribers: number;
  active_subscribers: number;
  suspended_subscribers: number;
  pending_subscribers: number;
  new_this_month: number;
  churn_this_month: number;
  average_uptime: number;
  total_bandwidth_gbps: number;
  by_connection_type: Record<ConnectionType, number>;
  by_status: Record<SubscriberStatus, number>;
}

export interface SubscriberQueryParams {
  status?: SubscriberStatus[];
  connection_type?: ConnectionType[];
  service_plan?: string;
  city?: string;
  search?: string;
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface CreateSubscriberRequest {
  // Personal Information
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  secondary_phone?: string;

  // Service Address
  service_address: string;
  service_city: string;
  service_state: string;
  service_postal_code: string;
  service_country?: string;

  // Billing Address (optional, defaults to service address)
  billing_address?: string;
  billing_city?: string;
  billing_state?: string;
  billing_postal_code?: string;
  billing_country?: string;

  // Service Details
  connection_type: ConnectionType;
  service_plan?: string;
  bandwidth_mbps?: number;

  // Installation
  installation_date?: string;
  installation_notes?: string;

  // Network
  ont_serial_number?: string;
  ont_mac_address?: string;

  // Metadata
  notes?: string;
  tags?: Record<string, any>;
}

export interface UpdateSubscriberRequest {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  secondary_phone?: string;
  service_address?: string;
  service_city?: string;
  service_state?: string;
  service_postal_code?: string;
  status?: SubscriberStatus;
  service_plan?: string;
  bandwidth_mbps?: number;
  notes?: string;
  tags?: Record<string, any>;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to fetch and manage subscribers
 */
export function useSubscribers(params?: SubscriberQueryParams) {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSubscribers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Build query string
      const queryParams = new URLSearchParams();
      if (params?.status) params.status.forEach(s => queryParams.append('status', s));
      if (params?.connection_type) params.connection_type.forEach(t => queryParams.append('connection_type', t));
      if (params?.service_plan) queryParams.set('service_plan', params.service_plan);
      if (params?.city) queryParams.set('city', params.city);
      if (params?.search) queryParams.set('search', params.search);
      if (params?.from_date) queryParams.set('from_date', params.from_date);
      if (params?.to_date) queryParams.set('to_date', params.to_date);
      if (params?.limit) queryParams.set('limit', String(params.limit));
      if (params?.offset) queryParams.set('offset', String(params.offset));
      if (params?.sort_by) queryParams.set('sort_by', params.sort_by);
      if (params?.sort_order) queryParams.set('sort_order', params.sort_order);

      const endpoint = `/subscribers${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await apiClient.get(endpoint);

      if (response.data) {
        setSubscribers(Array.isArray(response.data) ? response.data : response.data.items || []);
        setTotal(response.data.total || response.data.length || 0);
      }
    } catch (err) {
      setError(err as Error);
      console.error('Failed to fetch subscribers:', err);
    } finally {
      setIsLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchSubscribers();
  }, [fetchSubscribers]);

  return {
    subscribers,
    total,
    isLoading,
    error,
    refetch: fetchSubscribers,
  };
}

/**
 * Hook to fetch a single subscriber
 */
export function useSubscriber(subscriberId: string | null) {
  const [subscriber, setSubscriber] = useState<Subscriber | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchSubscriber = useCallback(async () => {
    if (!subscriberId) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await apiClient.get(`/subscribers/${subscriberId}`);
      setSubscriber(response.data);
    } catch (err) {
      setError(err as Error);
      console.error('Failed to fetch subscriber:', err);
    } finally {
      setIsLoading(false);
    }
  }, [subscriberId]);

  useEffect(() => {
    fetchSubscriber();
  }, [fetchSubscriber]);

  return {
    subscriber,
    isLoading,
    error,
    refetch: fetchSubscriber,
  };
}

/**
 * Hook to fetch subscriber statistics
 */
export function useSubscriberStatistics() {
  const [statistics, setStatistics] = useState<SubscriberStatistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStatistics = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await apiClient.get('/subscribers/statistics');
      setStatistics(response.data);
    } catch (err) {
      setError(err as Error);
      console.error('Failed to fetch subscriber statistics:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);

  return {
    statistics,
    isLoading,
    error,
    refetch: fetchStatistics,
  };
}

/**
 * Hook for subscriber operations
 */
export function useSubscriberOperations() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createSubscriber = useCallback(async (data: CreateSubscriberRequest) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await apiClient.post('/subscribers', data);
      return response.data as Subscriber;
    } catch (err) {
      setError(err as Error);
      console.error('Failed to create subscriber:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateSubscriber = useCallback(async (subscriberId: string, data: UpdateSubscriberRequest) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await apiClient.patch(`/subscribers/${subscriberId}`, data);
      return response.data as Subscriber;
    } catch (err) {
      setError(err as Error);
      console.error('Failed to update subscriber:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteSubscriber = useCallback(async (subscriberId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      await apiClient.delete(`/subscribers/${subscriberId}`);
      return true;
    } catch (err) {
      setError(err as Error);
      console.error('Failed to delete subscriber:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const suspendSubscriber = useCallback(async (subscriberId: string, reason?: string) => {
    try {
      setIsLoading(true);
      setError(null);

      await apiClient.post(`/subscribers/${subscriberId}/suspend`, { reason });
      return true;
    } catch (err) {
      setError(err as Error);
      console.error('Failed to suspend subscriber:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const activateSubscriber = useCallback(async (subscriberId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      await apiClient.post(`/subscribers/${subscriberId}/activate`, {});
      return true;
    } catch (err) {
      setError(err as Error);
      console.error('Failed to activate subscriber:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const terminateSubscriber = useCallback(async (subscriberId: string, reason?: string) => {
    try {
      setIsLoading(true);
      setError(null);

      await apiClient.post(`/subscribers/${subscriberId}/terminate`, { reason });
      return true;
    } catch (err) {
      setError(err as Error);
      console.error('Failed to terminate subscriber:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    createSubscriber,
    updateSubscriber,
    deleteSubscriber,
    suspendSubscriber,
    activateSubscriber,
    terminateSubscriber,
    isLoading,
    error,
  };
}

/**
 * Hook to fetch subscriber services
 */
export function useSubscriberServices(subscriberId: string | null) {
  const [services, setServices] = useState<SubscriberService[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchServices = useCallback(async () => {
    if (!subscriberId) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await apiClient.get(`/subscribers/${subscriberId}/services`);
      setServices(response.data || []);
    } catch (err) {
      setError(err as Error);
      console.error('Failed to fetch subscriber services:', err);
    } finally {
      setIsLoading(false);
    }
  }, [subscriberId]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  return {
    services,
    isLoading,
    error,
    refetch: fetchServices,
  };
}
