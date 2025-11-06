/**
 * React hook for tenant onboarding operations
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  tenantOnboardingService,
  TenantOnboardingRequest,
  TenantOnboardingResponse,
  OnboardingStatusResponse,
} from "@/lib/services/tenant-onboarding-service";

export function useTenantOnboarding() {
  const queryClient = useQueryClient();

  const onboardMutation = useMutation<TenantOnboardingResponse, Error, TenantOnboardingRequest>({
    mutationFn: (request) => tenantOnboardingService.onboardTenant(request),
    onSuccess: () => {
      // Invalidate tenant list to refresh after onboarding
      queryClient.invalidateQueries({ queryKey: ["platform-tenants"] });
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
    },
  });

  return {
    onboard: onboardMutation.mutate,
    onboardAsync: onboardMutation.mutateAsync,
    isOnboarding: onboardMutation.isPending,
    onboardingError: onboardMutation.error,
    onboardingResult: onboardMutation.data,
    reset: onboardMutation.reset,
  };
}

export function useOnboardingStatus(tenantId?: string) {
  return useQuery<OnboardingStatusResponse, Error, OnboardingStatusResponse, any>({
    queryKey: ["tenant-onboarding-status", tenantId],
    queryFn: () => tenantOnboardingService.getOnboardingStatus(tenantId!),
    enabled: !!tenantId,
    staleTime: 30000, // 30 seconds
  });
}

export function useSlugGeneration() {
  return {
    generateSlug: tenantOnboardingService.generateSlug,
  };
}

export function usePasswordGeneration() {
  return {
    generatePassword: tenantOnboardingService.generatePassword,
  };
}
