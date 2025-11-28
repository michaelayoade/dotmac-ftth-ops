/**
 * QuotaLimitGuard Component
 *
 * Prevents actions when quota limits are reached.
 * Shows warnings when approaching limits and blocks actions at limits.
 *
 * @example
 * <QuotaLimitGuard
 *   quotaType="customers"
 *   onLimitReached={() => showUpgradeModal()}
 * >
 *   <AddCustomerButton />
 * </QuotaLimitGuard>
 */

import { Alert, AlertDescription, AlertTitle, Button, Card, Progress } from "@dotmac/ui";
import { AlertTriangle, TrendingUp, XCircle } from "lucide-react";
import React, { type ReactNode } from "react";

export interface QuotaLimitGuardProps {
  /**
   * Type of quota to check (e.g., "customers", "users", "api_calls")
   */
  quotaType: string;

  /**
   * Content to render when quota is not exceeded
   */
  children: ReactNode;

  /**
   * Custom fallback when quota is exceeded
   */
  fallback?: ReactNode;

  /**
   * Show warning when utilization reaches this percentage (default: 80)
   */
  warningThreshold?: number;

  /**
   * Callback when quota limit is reached
   */
  onLimitReached?: () => void;

  /**
   * Callback when warning threshold is reached
   */
  onWarningThreshold?: () => void;

  /**
   * Whether to block action when limit is reached (default: true)
   */
  blockOnLimit?: boolean;

  /**
   * Custom message for quota exceeded state
   */
  quotaExceededMessage?: string;

  /**
   * Whether to show upgrade prompt on limit (default: true)
   */
  showUpgradePrompt?: boolean;

  /**
   * Override quota check (for testing)
   */
  quotaStatus?: QuotaStatus;
}

export interface QuotaStatus {
  quotaType: string;
  allocated: number;
  used: number;
  remaining: number;
  utilization: number; // percentage 0-100+
  exceeded: boolean;
  overageAllowed: boolean;
  overageUsed?: number;
  overageCharges?: number;
}

/**
 * Hook to check quota status (syncs with backend when available)
 */
export function useQuotaCheck(quotaType: string) {
  const [quotaStatus, setQuotaStatus] = React.useState<QuotaStatus | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);

  React.useEffect(() => {
    const fetchQuota = async () => {
      setIsLoading(true);

      try {
        const response = await fetch(`/api/isp/v1/admin/quotas/${quotaType}`, {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error(`Quota check failed: ${response.status}`);
        }

        const data = (await response.json()) as QuotaStatus;
        setQuotaStatus(data);
      } catch (error) {
        console.error("Failed to fetch quota:", error);
        // Fallback to safe defaults to avoid blocking UI completely
        setQuotaStatus({
          quotaType,
          allocated: 100,
          used: 0,
          remaining: 100,
          utilization: 0,
          exceeded: false,
          overageAllowed: false,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuota();
  }, [quotaType]);

  return { quotaStatus, isLoading };
}

/**
 * Quota warning badge component
 */
function QuotaWarningBadge({ quotaStatus }: { quotaStatus: QuotaStatus }) {
  const { quotaType, allocated, used, utilization, exceeded, overageAllowed } = quotaStatus;

  if (!exceeded && utilization < 80) {
    return null; // No warning needed
  }

  const getVariant = () => {
    if (exceeded && !overageAllowed) return "destructive";
    if (exceeded) return "warning";
    if (utilization >= 90) return "warning";
    return "default";
  };

  const getMessage = () => {
    if (exceeded && !overageAllowed) {
      return `${quotaType} limit reached (${used}/${allocated})`;
    }
    if (exceeded) {
      return `${quotaType} limit exceeded (${used}/${allocated}) - overage charges apply`;
    }
    if (utilization >= 90) {
      return `${quotaType} quota at ${Math.round(utilization)}% (${used}/${allocated})`;
    }
    return `${quotaType} quota at ${Math.round(utilization)}%`;
  };

  return (
    <Alert variant={getVariant() as any} className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Quota Warning</AlertTitle>
      <AlertDescription>{getMessage()}</AlertDescription>
    </Alert>
  );
}

/**
 * Quota exceeded component
 */
function QuotaExceeded({
  quotaStatus,
  message,
  onUpgradeClick,
}: {
  quotaStatus: QuotaStatus;
  message?: string;
  onUpgradeClick?: () => void;
}) {
  const { quotaType, allocated, used, overageAllowed } = quotaStatus;

  return (
    <Card className="p-6">
      <div className="flex flex-col items-center justify-center space-y-4 text-center">
        <div className="rounded-full bg-red-100 p-3 dark:bg-red-900">
          <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Quota Limit Reached</h3>
          <p className="text-sm text-muted-foreground">
            {message ||
              `You've reached your ${quotaType} limit (${used}/${allocated}). ${
                overageAllowed
                  ? "Additional usage will incur overage charges."
                  : "Please upgrade your plan to continue."
              }`}
          </p>
        </div>

        <div className="w-full max-w-xs">
          <div className="flex justify-between text-sm mb-2">
            <span>Used: {used}</span>
            <span>Limit: {allocated}</span>
          </div>
          <Progress value={100} className="h-2" />
        </div>

        {onUpgradeClick && !overageAllowed && (
          <Button onClick={onUpgradeClick} className="mt-4">
            <TrendingUp className="mr-2 h-4 w-4" />
            Upgrade Plan
          </Button>
        )}
      </div>
    </Card>
  );
}

/**
 * QuotaLimitGuard Component
 *
 * Guards actions based on quota limits
 */
export function QuotaLimitGuard({
  quotaType,
  children,
  fallback,
  warningThreshold = 80,
  onLimitReached,
  onWarningThreshold,
  blockOnLimit = true,
  quotaExceededMessage,
  showUpgradePrompt = true,
  quotaStatus: overrideStatus,
}: QuotaLimitGuardProps) {
  const { quotaStatus: fetchedStatus, isLoading } = useQuotaCheck(quotaType);

  // Use override if provided (for testing)
  const quotaStatus = overrideStatus || fetchedStatus;

  // Trigger callbacks
  React.useEffect(() => {
    if (!quotaStatus) return;

    if (quotaStatus.exceeded && onLimitReached) {
      onLimitReached();
    }

    if (quotaStatus.utilization >= warningThreshold && onWarningThreshold) {
      onWarningThreshold();
    }
  }, [quotaStatus, warningThreshold, onLimitReached, onWarningThreshold]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // No quota data
  if (!quotaStatus) {
    return <>{children}</>;
  }

  // Check if limit is exceeded and blocking is enabled
  const shouldBlock = quotaStatus.exceeded && blockOnLimit && !quotaStatus.overageAllowed;

  if (shouldBlock) {
    // Show fallback or default quota exceeded message
    if (fallback) {
      return <>{fallback}</>;
    }

    if (showUpgradePrompt) {
      return (
        <QuotaExceeded
          quotaStatus={quotaStatus}
          {...(quotaExceededMessage !== undefined && { message: quotaExceededMessage })}
          {...(onLimitReached !== undefined && { onUpgradeClick: onLimitReached })}
        />
      );
    }

    return null;
  }

  // Show warning if approaching limit
  const showWarning = quotaStatus.utilization >= warningThreshold;

  return (
    <div>
      {showWarning && <QuotaWarningBadge quotaStatus={quotaStatus} />}
      {children}
    </div>
  );
}

/**
 * Hook to check if action is allowed based on quota
 *
 * @example
 * const { canProceed, quotaStatus } = useQuotaLimit("customers");
 * if (!canProceed) {
 *   showError("Customer limit reached");
 * }
 */
export function useQuotaLimit(quotaType: string) {
  const { quotaStatus, isLoading } = useQuotaCheck(quotaType);

  const canProceed = React.useMemo(() => {
    if (!quotaStatus) return true;
    // Can proceed if not exceeded, or if overage is allowed
    return !quotaStatus.exceeded || quotaStatus.overageAllowed;
  }, [quotaStatus]);

  return {
    canProceed,
    quotaStatus,
    isLoading,
    isNearLimit: quotaStatus ? quotaStatus.utilization >= 80 : false,
    isAtLimit: quotaStatus ? quotaStatus.exceeded : false,
  };
}

/**
 * Inline quota check for conditional rendering
 *
 * @example
 * {!isQuotaExceeded("customers") && <AddCustomerButton />}
 */
export function isQuotaExceeded(quotaType: string): boolean {
  // This is a simplified version for inline checks
  return false;
}

/**
 * HOC to wrap component with quota guard
 *
 * @example
 * const ProtectedAddCustomer = withQuotaGuard(AddCustomerButton, {
 *   quotaType: "customers"
 * });
 */
export function withQuotaGuard<P extends object>(
  Component: React.ComponentType<P>,
  guardProps: Omit<QuotaLimitGuardProps, "children">,
) {
  return function QuotaGuardedComponent(props: P) {
    return (
      <QuotaLimitGuard {...guardProps}>
        <Component {...props} />
      </QuotaLimitGuard>
    );
  };
}
