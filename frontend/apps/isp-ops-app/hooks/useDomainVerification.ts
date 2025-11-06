/**
 * React hooks for domain verification operations
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  domainVerificationService,
  InitiateVerificationRequest,
  CheckVerificationRequest,
  DomainVerificationResponse,
  DomainVerificationStatusResponse,
  DomainRemovalResponse,
} from "@/lib/services/domain-verification-service";

export function useDomainVerification(tenantId: string) {
  const queryClient = useQueryClient();

  const initiateMutation = useMutation<
    DomainVerificationResponse,
    Error,
    InitiateVerificationRequest
  >({
    mutationFn: (request) => domainVerificationService.initiateVerification(tenantId, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["domain-status", tenantId] });
    },
  });

  const checkMutation = useMutation<DomainVerificationResponse, Error, CheckVerificationRequest>({
    mutationFn: (request) => domainVerificationService.checkVerification(tenantId, request),
    onSuccess: (data) => {
      if (data.status === "verified") {
        queryClient.invalidateQueries({
          queryKey: ["domain-status", tenantId],
        });
      }
    },
  });

  const removeMutation = useMutation<DomainRemovalResponse, Error, void>({
    mutationFn: () => domainVerificationService.removeDomain(tenantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["domain-status", tenantId] });
    },
  });

  return {
    initiate: initiateMutation.mutate,
    initiateAsync: initiateMutation.mutateAsync,
    isInitiating: initiateMutation.isPending,
    initiateError: initiateMutation.error,
    initiateResult: initiateMutation.data,

    check: checkMutation.mutate,
    checkAsync: checkMutation.mutateAsync,
    isChecking: checkMutation.isPending,
    checkError: checkMutation.error,
    checkResult: checkMutation.data,

    remove: removeMutation.mutate,
    removeAsync: removeMutation.mutateAsync,
    isRemoving: removeMutation.isPending,
    removeError: removeMutation.error,
    removeResult: removeMutation.data,

    reset: () => {
      initiateMutation.reset();
      checkMutation.reset();
      removeMutation.reset();
    },
  };
}

export function useDomainStatus(tenantId?: string) {
  return useQuery<DomainVerificationStatusResponse, Error, DomainVerificationStatusResponse, any>({
    queryKey: ["domain-status", tenantId],
    queryFn: () => domainVerificationService.getStatus(tenantId!),
    enabled: !!tenantId,
    staleTime: 30000, // 30 seconds
    refetchInterval: false,
  });
}

export function useDomainValidation() {
  return {
    validateDomain: domainVerificationService.validateDomain,
  };
}
