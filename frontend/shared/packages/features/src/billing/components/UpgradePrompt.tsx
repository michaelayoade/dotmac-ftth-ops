/**
 * UpgradePrompt Components
 *
 * Reusable components for prompting users to upgrade their subscription.
 * Used by LicenseGuard and QuotaLimitGuard when limits are reached.
 *
 * @example
 * <UpgradePrompt
 *   reason="quota_exceeded"
 *   quotaType="customers"
 *   currentPlan="STARTER"
 *   suggestedPlan="PROFESSIONAL"
 * />
 */

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
} from "@dotmac/ui";
import {
  AlertCircle,
  CheckCircle,
  Lock,
  TrendingUp,
  Zap,
  Users,
  BarChart3,
  Shield,
} from "lucide-react";
import React from "react";

export type UpgradeReason =
  | "quota_exceeded"
  | "feature_locked"
  | "trial_expiring"
  | "trial_expired"
  | "plan_limitation"
  | "better_value";

export interface UpgradePromptProps {
  /**
   * Reason for showing upgrade prompt
   */
  reason: UpgradeReason;

  /**
   * Current subscription plan code
   */
  currentPlan?: string;

  /**
   * Suggested plan to upgrade to
   */
  suggestedPlan?: string;

  /**
   * Specific feature that requires upgrade
   */
  feature?: string;

  /**
   * Quota type if reason is quota_exceeded
   */
  quotaType?: string;

  /**
   * Custom title override
   */
  title?: string;

  /**
   * Custom message override
   */
  message?: string;

  /**
   * Callback when upgrade button is clicked
   */
  onUpgrade?: () => void;

  /**
   * Callback when dismiss button is clicked
   */
  onDismiss?: () => void;

  /**
   * Show dismiss button (default: true for non-blocking prompts)
   */
  showDismiss?: boolean;

  /**
   * Variant style
   */
  variant?: "card" | "alert" | "inline";

  /**
   * Size variant
   */
  size?: "sm" | "md" | "lg";
}

/**
 * Get icon for upgrade reason
 */
function getReasonIcon(reason: UpgradeReason) {
  switch (reason) {
    case "quota_exceeded":
      return Users;
    case "feature_locked":
      return Lock;
    case "trial_expiring":
    case "trial_expired":
      return AlertCircle;
    case "plan_limitation":
      return Shield;
    case "better_value":
      return TrendingUp;
    default:
      return Zap;
  }
}

/**
 * Get default content for upgrade reason
 */
function getReasonContent(
  reason: UpgradeReason,
  quotaType?: string,
  feature?: string,
  currentPlan?: string,
) {
  switch (reason) {
    case "quota_exceeded":
      return {
        title: `${quotaType || "Resource"} Limit Reached`,
        message: `You've reached your ${quotaType || "resource"} limit on the ${currentPlan || "current"} plan. Upgrade to continue adding more.`,
      };
    case "feature_locked":
      return {
        title: "Premium Feature",
        message: `${feature || "This feature"} is only available on higher-tier plans. Upgrade to unlock advanced capabilities.`,
      };
    case "trial_expiring":
      return {
        title: "Trial Ending Soon",
        message:
          "Your trial period is ending soon. Upgrade now to continue using all features without interruption.",
      };
    case "trial_expired":
      return {
        title: "Trial Expired",
        message:
          "Your trial period has ended. Upgrade to a paid plan to restore access to your account.",
      };
    case "plan_limitation":
      return {
        title: "Plan Limitation",
        message: `This capability is limited on the ${currentPlan || "current"} plan. Upgrade for increased limits and better performance.`,
      };
    case "better_value":
      return {
        title: "Get More Value",
        message:
          "Based on your usage, upgrading to a higher plan would provide better value and more features.",
      };
    default:
      return {
        title: "Upgrade Your Plan",
        message: "Unlock more features and higher limits with an upgraded subscription.",
      };
  }
}

/**
 * Plan comparison features
 */
const PLAN_FEATURES: Record<string, string[]> = {
  STARTER: ["100 customers", "5 staff users", "Basic billing", "Email support"],
  PROFESSIONAL: [
    "1,000 customers",
    "20 staff users",
    "Advanced analytics",
    "Priority support",
    "API access",
    "Custom branding",
  ],
  ENTERPRISE: [
    "Unlimited customers",
    "Unlimited users",
    "Full feature access",
    "24/7 phone support",
    "Dedicated account manager",
    "Custom integrations",
  ],
};

/**
 * Alert variant of upgrade prompt
 */
function UpgradePromptAlert({ title, message, onUpgrade, onDismiss, showDismiss, reason }: any) {
  const Icon = getReasonIcon(reason);
  const isBlocking = reason === "trial_expired" || reason === "quota_exceeded";

  return (
    <Alert variant={isBlocking ? "destructive" : "default"} className="mb-4">
      <Icon className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <div className="mt-2 space-y-2">
          <p>{message}</p>
          <div className="flex gap-2 mt-3">
            {onUpgrade && (
              <Button size="sm" onClick={onUpgrade}>
                <TrendingUp className="mr-2 h-3 w-3" />
                Upgrade Now
              </Button>
            )}
            {showDismiss && onDismiss && (
              <Button size="sm" variant="outline" onClick={onDismiss}>
                Dismiss
              </Button>
            )}
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Card variant of upgrade prompt with plan comparison
 */
function UpgradePromptCard({
  title,
  message,
  onUpgrade,
  onDismiss,
  showDismiss,
  currentPlan,
  suggestedPlan,
  reason,
}: any) {
  const Icon = getReasonIcon(reason);
  const suggestedFeatures = PLAN_FEATURES[suggestedPlan || "PROFESSIONAL"] || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>{title}</CardTitle>
              <CardDescription className="mt-1">{message}</CardDescription>
            </div>
          </div>
          {currentPlan && <Badge variant="outline">Current: {currentPlan}</Badge>}
        </div>
      </CardHeader>

      {suggestedPlan && (
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Upgrade to {suggestedPlan}
              </h4>
              <ul className="space-y-2">
                {suggestedFeatures.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex gap-2 pt-2">
              {onUpgrade && (
                <Button onClick={onUpgrade} className="flex-1">
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Upgrade to {suggestedPlan}
                </Button>
              )}
              {showDismiss && onDismiss && (
                <Button variant="outline" onClick={onDismiss}>
                  Maybe Later
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

/**
 * Inline variant of upgrade prompt
 */
function UpgradePromptInline({ title, message, onUpgrade, reason }: any) {
  const Icon = getReasonIcon(reason);

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-950">
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
        <div>
          <p className="font-medium text-sm">{title}</p>
          <p className="text-xs text-muted-foreground">{message}</p>
        </div>
      </div>
      {onUpgrade && (
        <Button size="sm" onClick={onUpgrade}>
          Upgrade
        </Button>
      )}
    </div>
  );
}

/**
 * Main UpgradePrompt Component
 */
export function UpgradePrompt({
  reason,
  currentPlan,
  suggestedPlan,
  feature,
  quotaType,
  title: customTitle,
  message: customMessage,
  onUpgrade,
  onDismiss,
  showDismiss = true,
  variant = "card",
  size = "md",
}: UpgradePromptProps) {
  const defaultContent = getReasonContent(reason, quotaType, feature, currentPlan);

  const title = customTitle || defaultContent.title;
  const message = customMessage || defaultContent.message;

  const props = {
    title,
    message,
    onUpgrade,
    onDismiss,
    showDismiss,
    currentPlan,
    suggestedPlan,
    reason,
  };

  switch (variant) {
    case "alert":
      return <UpgradePromptAlert {...props} />;
    case "inline":
      return <UpgradePromptInline {...props} />;
    case "card":
    default:
      return <UpgradePromptCard {...props} />;
  }
}

/**
 * Trial expiration banner
 */
export function TrialExpirationBanner({
  daysRemaining,
  onUpgrade,
}: {
  daysRemaining: number;
  onUpgrade?: () => void;
}) {
  const upgradeHandlers = onUpgrade ? { onUpgrade } : {};

  if (daysRemaining <= 0) {
    return (
      <UpgradePrompt
        reason="trial_expired"
        variant="alert"
        {...upgradeHandlers}
        showDismiss={false}
      />
    );
  }

  if (daysRemaining <= 7) {
    return (
      <UpgradePrompt
        reason="trial_expiring"
        variant="inline"
        message={`Your trial expires in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}. Upgrade now to continue using all features.`}
        {...upgradeHandlers}
      />
    );
  }

  return null;
}

/**
 * Quota warning component
 */
export function QuotaWarning({
  quotaType,
  used,
  limit,
  utilization,
  onUpgrade,
}: {
  quotaType: string;
  used: number;
  limit: number;
  utilization: number;
  onUpgrade?: () => void;
}) {
  const upgradeHandlers = onUpgrade ? { onUpgrade } : {};

  if (utilization >= 100) {
    return (
      <UpgradePrompt
        reason="quota_exceeded"
        quotaType={quotaType}
        variant="alert"
        message={`You've used ${used} of ${limit} ${quotaType}. Upgrade to increase your limit.`}
        {...upgradeHandlers}
        showDismiss={false}
      />
    );
  }

  if (utilization >= 80) {
    return (
      <UpgradePrompt
        reason="plan_limitation"
        quotaType={quotaType}
        variant="inline"
        message={`You've used ${Math.round(utilization)}% of your ${quotaType} quota (${used}/${limit}). Consider upgrading.`}
        {...upgradeHandlers}
      />
    );
  }

  return null;
}
