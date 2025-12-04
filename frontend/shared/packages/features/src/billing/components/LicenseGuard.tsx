/**
 * LicenseGuard Component
 *
 * Conditionally renders children based on module/feature licensing.
 * Shows upgrade prompt or blocked message when feature is not available.
 *
 * @example
 * <LicenseGuard module="ADVANCED_ANALYTICS" fallback={<UpgradePrompt />}>
 *   <AnalyticsDashboard />
 * </LicenseGuard>
 */

import { Alert, AlertDescription, AlertTitle, Button, Card } from "@dotmac/ui";
import { Lock, TrendingUp } from "lucide-react";
import React, { type ReactNode } from "react";

export interface LicenseGuardProps {
  /**
   * Module code to check for access (e.g., "ADVANCED_ANALYTICS")
   */
  module?: string;

  /**
   * Feature flag to check (e.g., "api_access")
   */
  feature?: string;

  /**
   * Content to render when access is granted
   */
  children: ReactNode;

  /**
   * Custom fallback content when access is denied
   */
  fallback?: ReactNode;

  /**
   * Whether to show a default upgrade prompt (default: true)
   */
  showUpgradePrompt?: boolean;

  /**
   * Custom message for the access denied state
   */
  accessDeniedMessage?: string;

  /**
   * Callback when upgrade button is clicked
   */
  onUpgradeClick?: () => void;

  /**
   * Override access check (for testing or admin impersonation)
   */
  hasAccess?: boolean;
}

/**
 * Hook to check if tenant has access to a module/feature using backend licensing API
 */
export function useLicenseCheck(module?: string, feature?: string) {
  const [hasAccess, setHasAccess] = React.useState<boolean>(true);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [subscription, setSubscription] = React.useState<any>(null);

  React.useEffect(() => {
    let cancelled = false;
    const checkAccess = async () => {
      setIsLoading(true);

      try {
        const response = await fetch("/api/platform/v1/admin/licensing/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ module, feature }),
        });

        if (!response.ok) {
          throw new Error(`Licensing check failed: ${response.status}`);
        }

        const data = await response.json();
        if (cancelled) return;

        const subscriptionInfo = data.subscription ?? data;
        setSubscription(subscriptionInfo);

        const modules: string[] = subscriptionInfo.modules ?? [];
        const features: string[] = subscriptionInfo.features ?? [];

        let access = true;
        if (module) {
          access = modules.includes(module);
        } else if (feature) {
          access = features.includes(feature);
        }

        setHasAccess(access);
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to check license:", error);
          setHasAccess(false);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    checkAccess();

    return () => {
      cancelled = true;
    };
  }, [module, feature]);

  return { hasAccess, isLoading, subscription };
}

/**
 * Default fallback component shown when access is denied
 */
function DefaultAccessDenied({
  module,
  feature,
  message,
  onUpgradeClick,
}: {
  module?: string;
  feature?: string;
  message?: string;
  onUpgradeClick?: () => void;
}) {
  const featureName = module || feature || "this feature";

  return (
    <Card className="p-6">
      <div className="flex flex-col items-center justify-center space-y-4 text-center">
        <div className="rounded-full bg-yellow-100 p-3 dark:bg-yellow-900">
          <Lock className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Feature Not Available</h3>
          <p className="text-sm text-muted-foreground">
            {message ||
              `Access to ${featureName} is not included in your current subscription plan.`}
          </p>
        </div>

        {onUpgradeClick && (
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
 * LicenseGuard Component
 *
 * Guards feature access based on subscription licensing
 */
export function LicenseGuard({
  module,
  feature,
  children,
  fallback,
  showUpgradePrompt = true,
  accessDeniedMessage,
  onUpgradeClick,
  hasAccess: overrideAccess,
}: LicenseGuardProps) {
  const { hasAccess: licenseHasAccess, isLoading } = useLicenseCheck(module, feature);

  // Use override if provided (for testing or admin bypass)
  const hasAccess = overrideAccess !== undefined ? overrideAccess : licenseHasAccess;

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Grant access
  if (hasAccess) {
    return <>{children}</>;
  }

  // Access denied - show fallback or default message
  if (fallback) {
    return <>{fallback}</>;
  }

  if (showUpgradePrompt) {
    return (
      <DefaultAccessDenied
        {...(module !== undefined && { module })}
        {...(feature !== undefined && { feature })}
        {...(accessDeniedMessage !== undefined && { message: accessDeniedMessage })}
        {...(onUpgradeClick !== undefined && { onUpgradeClick })}
      />
    );
  }

  // No access and no fallback - return null
  return null;
}

/**
 * Inline license check for conditional rendering
 *
 * @example
 * {hasLicense("ADVANCED_ANALYTICS") && <AnalyticsButton />}
 */
export function hasLicense(moduleOrFeature: string): boolean {
  // This is a simplified sync version for inline checks
  const mockModules = ["CORE_BILLING", "ADVANCED_ANALYTICS", "NETWORK_MONITORING"];
  return mockModules.includes(moduleOrFeature);
}

/**
 * Higher-order component to wrap a component with license guard
 *
 * @example
 * const ProtectedAnalytics = withLicenseGuard(AnalyticsDashboard, {
 *   module: "ADVANCED_ANALYTICS"
 * });
 */
export function withLicenseGuard<P extends object>(
  Component: React.ComponentType<P>,
  guardProps: Omit<LicenseGuardProps, "children">,
) {
  return function LicenseGuardedComponent(props: P) {
    return (
      <LicenseGuard {...guardProps}>
        <Component {...props} />
      </LicenseGuard>
    );
  };
}
