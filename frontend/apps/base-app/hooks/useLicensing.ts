/**
 * Licensing Framework Hook
 *
 * React hook for interacting with the composable licensing API.
 */

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  FeatureModule,
  QuotaDefinition,
  ServicePlan,
  TenantSubscription,
  CreateFeatureModuleRequest,
  CreateQuotaDefinitionRequest,
  CreateServicePlanRequest,
  CreateSubscriptionRequest,
  AddAddonRequest,
  RemoveAddonRequest,
  CheckEntitlementRequest,
  CheckEntitlementResponse,
  CheckQuotaRequest,
  CheckQuotaResponse,
  ConsumeQuotaRequest,
  ReleaseQuotaRequest,
  UseLicensingReturn,
} from '../types/licensing';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const LICENSING_API = `${API_BASE_URL}/api/v1/licensing`;

/**
 * Main hook for licensing framework operations
 */
export function useLicensing(): UseLicensingReturn {
  // State for feature modules
  const [modules, setModules] = useState<FeatureModule[]>([]);
  const [modulesLoading, setModulesLoading] = useState(false);
  const [modulesError, setModulesError] = useState<Error | null>(null);

  // State for quotas
  const [quotas, setQuotas] = useState<QuotaDefinition[]>([]);
  const [quotasLoading, setQuotasLoading] = useState(false);
  const [quotasError, setQuotasError] = useState<Error | null>(null);

  // State for plans
  const [plans, setPlans] = useState<ServicePlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState<Error | null>(null);

  // State for subscription
  const [currentSubscription, setCurrentSubscription] = useState<TenantSubscription | undefined>();
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState<Error | null>(null);

  // ==========================================================================
  // Feature Modules
  // ==========================================================================

  const fetchModules = useCallback(async () => {
    setModulesLoading(true);
    setModulesError(null);
    try {
      const response = await axios.get<FeatureModule[]>(`${LICENSING_API}/modules`);
      setModules(response.data);
    } catch (error) {
      setModulesError(error as Error);
    } finally {
      setModulesLoading(false);
    }
  }, []);

  const createModule = useCallback(async (data: CreateFeatureModuleRequest): Promise<FeatureModule> => {
    const response = await axios.post<FeatureModule>(`${LICENSING_API}/modules`, data);
    await fetchModules(); // Refresh list
    return response.data;
  }, [fetchModules]);

  const updateModule = useCallback(async (id: string, data: Partial<FeatureModule>): Promise<FeatureModule> => {
    const response = await axios.patch<FeatureModule>(`${LICENSING_API}/modules/${id}`, data);
    await fetchModules(); // Refresh list
    return response.data;
  }, [fetchModules]);

  const getModule = useCallback(async (id: string): Promise<FeatureModule> => {
    const response = await axios.get<FeatureModule>(`${LICENSING_API}/modules/${id}`);
    return response.data;
  }, []);

  // ==========================================================================
  // Quotas
  // ==========================================================================

  const fetchQuotas = useCallback(async () => {
    setQuotasLoading(true);
    setQuotasError(null);
    try {
      const response = await axios.get<QuotaDefinition[]>(`${LICENSING_API}/quotas`);
      setQuotas(response.data);
    } catch (error) {
      setQuotasError(error as Error);
    } finally {
      setQuotasLoading(false);
    }
  }, []);

  const createQuota = useCallback(async (data: CreateQuotaDefinitionRequest): Promise<QuotaDefinition> => {
    const response = await axios.post<QuotaDefinition>(`${LICENSING_API}/quotas`, data);
    await fetchQuotas(); // Refresh list
    return response.data;
  }, [fetchQuotas]);

  const updateQuota = useCallback(async (id: string, data: Partial<QuotaDefinition>): Promise<QuotaDefinition> => {
    const response = await axios.patch<QuotaDefinition>(`${LICENSING_API}/quotas/${id}`, data);
    await fetchQuotas(); // Refresh list
    return response.data;
  }, [fetchQuotas]);

  // ==========================================================================
  // Service Plans
  // ==========================================================================

  const fetchPlans = useCallback(async () => {
    setPlansLoading(true);
    setPlansError(null);
    try {
      const response = await axios.get<ServicePlan[]>(`${LICENSING_API}/plans`);
      setPlans(response.data);
    } catch (error) {
      setPlansError(error as Error);
    } finally {
      setPlansLoading(false);
    }
  }, []);

  const createPlan = useCallback(async (data: CreateServicePlanRequest): Promise<ServicePlan> => {
    const response = await axios.post<ServicePlan>(`${LICENSING_API}/plans`, data);
    await fetchPlans(); // Refresh list
    return response.data;
  }, [fetchPlans]);

  const updatePlan = useCallback(async (id: string, data: Partial<ServicePlan>): Promise<ServicePlan> => {
    const response = await axios.patch<ServicePlan>(`${LICENSING_API}/plans/${id}`, data);
    await fetchPlans(); // Refresh list
    return response.data;
  }, [fetchPlans]);

  const getPlan = useCallback(async (id: string): Promise<ServicePlan> => {
    const response = await axios.get<ServicePlan>(`${LICENSING_API}/plans/${id}`);
    return response.data;
  }, []);

  const duplicatePlan = useCallback(async (id: string): Promise<ServicePlan> => {
    const response = await axios.post<ServicePlan>(`${LICENSING_API}/plans/${id}/duplicate`);
    await fetchPlans(); // Refresh list
    return response.data;
  }, [fetchPlans]);

  const calculatePlanPrice = useCallback(async (id: string, params: any) => {
    const response = await axios.get(`${LICENSING_API}/plans/${id}/pricing`, { params });
    return response.data;
  }, []);

  // ==========================================================================
  // Subscriptions
  // ==========================================================================

  const fetchCurrentSubscription = useCallback(async () => {
    setSubscriptionLoading(true);
    setSubscriptionError(null);
    try {
      const response = await axios.get<TenantSubscription>(`${LICENSING_API}/subscriptions/current`);
      setCurrentSubscription(response.data);
    } catch (error: any) {
      if (error.response?.status !== 404) {
        setSubscriptionError(error as Error);
      }
    } finally {
      setSubscriptionLoading(false);
    }
  }, []);

  const createSubscription = useCallback(async (data: CreateSubscriptionRequest): Promise<TenantSubscription> => {
    const response = await axios.post<TenantSubscription>(`${LICENSING_API}/subscriptions`, data);
    await fetchCurrentSubscription(); // Refresh
    return response.data;
  }, [fetchCurrentSubscription]);

  const addAddon = useCallback(async (data: AddAddonRequest): Promise<void> => {
    await axios.post(`${LICENSING_API}/subscriptions/current/addons`, data);
    await fetchCurrentSubscription(); // Refresh
  }, [fetchCurrentSubscription]);

  const removeAddon = useCallback(async (data: RemoveAddonRequest): Promise<void> => {
    await axios.delete(`${LICENSING_API}/subscriptions/current/addons`, { data });
    await fetchCurrentSubscription(); // Refresh
  }, [fetchCurrentSubscription]);

  // ==========================================================================
  // Entitlements & Quotas
  // ==========================================================================

  const checkEntitlement = useCallback(async (data: CheckEntitlementRequest): Promise<CheckEntitlementResponse> => {
    const response = await axios.post<CheckEntitlementResponse>(`${LICENSING_API}/entitlements/check`, data);
    return response.data;
  }, []);

  const checkQuota = useCallback(async (data: CheckQuotaRequest): Promise<CheckQuotaResponse> => {
    const response = await axios.post<CheckQuotaResponse>(`${LICENSING_API}/quotas/check`, data);
    return response.data;
  }, []);

  const consumeQuota = useCallback(async (data: ConsumeQuotaRequest): Promise<void> => {
    await axios.post(`${LICENSING_API}/quotas/consume`, data);
  }, []);

  const releaseQuota = useCallback(async (data: ReleaseQuotaRequest): Promise<void> => {
    await axios.post(`${LICENSING_API}/quotas/release`, data);
  }, []);

  // ==========================================================================
  // Effects
  // ==========================================================================

  // Initial load
  useEffect(() => {
    fetchModules();
    fetchQuotas();
    fetchPlans();
    fetchCurrentSubscription();
  }, [fetchModules, fetchQuotas, fetchPlans, fetchCurrentSubscription]);

  // ==========================================================================
  // Refetch All
  // ==========================================================================

  const refetch = useCallback(async () => {
    await Promise.all([
      fetchModules(),
      fetchQuotas(),
      fetchPlans(),
      fetchCurrentSubscription(),
    ]);
  }, [fetchModules, fetchQuotas, fetchPlans, fetchCurrentSubscription]);

  return {
    // Feature Modules
    modules,
    modulesLoading,
    modulesError,
    createModule,
    updateModule,
    getModule,

    // Quotas
    quotas,
    quotasLoading,
    quotasError,
    createQuota,
    updateQuota,

    // Service Plans
    plans,
    plansLoading,
    plansError,
    createPlan,
    updatePlan,
    getPlan,
    duplicatePlan,
    calculatePlanPrice,

    // Subscriptions
    currentSubscription,
    subscriptionLoading,
    subscriptionError,
    createSubscription,
    addAddon,
    removeAddon,

    // Entitlements & Quotas
    checkEntitlement,
    checkQuota,
    consumeQuota,
    releaseQuota,

    // Utilities
    refetch,
  };
}

/**
 * Hook for checking if a feature is entitled
 */
export function useFeatureEntitlement(moduleCode?: string, capabilityCode?: string) {
  const [entitled, setEntitled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!moduleCode) {
      setLoading(false);
      return;
    }

    const checkAccess = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.post<CheckEntitlementResponse>(
          `${LICENSING_API}/entitlements/check`,
          { module_code: moduleCode, capability_code: capabilityCode }
        );
        setEntitled(response.data.entitled);
      } catch (err) {
        setError(err as Error);
        setEntitled(false);
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, [moduleCode, capabilityCode]);

  return { entitled, loading, error };
}

/**
 * Hook for checking quota availability
 */
export function useQuotaCheck(quotaCode: string, quantity = 1) {
  const [available, setAvailable] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [details, setDetails] = useState<CheckQuotaResponse | null>(null);

  const checkQuota = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post<CheckQuotaResponse>(
        `${LICENSING_API}/quotas/check`,
        { quota_code: quotaCode, quantity }
      );
      setAvailable(response.data.available);
      setRemaining(response.data.remaining);
      setDetails(response.data);
    } catch (err) {
      setError(err as Error);
      setAvailable(false);
    } finally {
      setLoading(false);
    }
  }, [quotaCode, quantity]);

  useEffect(() => {
    checkQuota();
  }, [checkQuota]);

  return { available, remaining, loading, error, details, refetch: checkQuota };
}

export default useLicensing;
