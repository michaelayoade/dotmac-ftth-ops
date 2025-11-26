/**
 * Service Defaults Settings Component
 *
 * Configures default service plan settings including trial periods,
 * data caps, credit limits, and suspension policies.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Package, DollarSign, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ServiceDefaultsSettingsProps {
  settings: {
    default_trial_days: number;
    trial_requires_payment_method: boolean;
    trial_auto_convert: boolean;
    default_data_cap_gb: number | null;
    data_cap_warning_threshold_percent: number;
    throttle_policy: string;
    throttled_download_speed: string | null;
    throttled_upload_speed: string | null;
    default_credit_limit: number;
    credit_limit_currency: string;
    auto_suspend_on_limit: boolean;
    grace_period_days: number;
    auto_reconnection_fee: number;
    require_manual_reconnection: boolean;
  };
  onChange: (settings: any) => void;
}

const THROTTLE_POLICIES = [
  { value: "none", label: "No Throttle", description: "Full service until cap exceeded" },
  { value: "warn_only", label: "Warn Only", description: "Send notifications but don't throttle" },
  { value: "soft_throttle", label: "Soft Throttle", description: "Reduce speed when nearing cap" },
  { value: "hard_throttle", label: "Hard Throttle", description: "Heavily throttle after cap" },
  { value: "suspend", label: "Suspend Service", description: "Stop service when cap exceeded" },
];

export function ServiceDefaultsSettings({ settings, onChange }: ServiceDefaultsSettingsProps) {
  const updateSetting = (key: string, value: any) => {
    onChange({
      ...settings,
      [key]: value,
    });
  };

  const formatDataSize = (gb: number | null): string => {
    if (gb === null || gb === 0) return "Unlimited";
    if (gb < 1) return `${(gb * 1024).toFixed(0)} MB`;
    if (gb < 1024) return `${gb} GB`;
    return `${(gb / 1024).toFixed(2)} TB`;
  };

  const formatCurrency = (
    amount: number,
    currency: string = settings.credit_limit_currency,
  ): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(amount);
  };

  const selectedThrottlePolicy = THROTTLE_POLICIES.find(
    (p) => p.value === settings.throttle_policy,
  );
  const requiresThrottleSpeed =
    settings.throttle_policy === "soft_throttle" || settings.throttle_policy === "hard_throttle";

  return (
    <div className="space-y-6">
      <Alert>
        <Package className="h-4 w-4" />
        <AlertDescription>
          Service defaults apply to <strong>new subscribers only</strong>. Existing subscribers
          retain their current settings unless manually updated.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Trial Period Settings</CardTitle>
          <CardDescription>Configure free trial period for new subscribers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="trial_days">Default Trial Period</Label>
            <div className="flex items-center gap-2">
              <Input
                id="trial_days"
                type="number"
                min="0"
                max="90"
                value={settings.default_trial_days}
                onChange={(e) => updateSetting("default_trial_days", parseInt(e.target.value))}
                className="w-32"
              />
              <span className="text-sm text-muted-foreground">days</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {settings.default_trial_days === 0
                ? "No trial period - subscribers billed immediately"
                : `${settings.default_trial_days} day${settings.default_trial_days > 1 ? "s" : ""} free trial for new subscribers`}
            </p>
          </div>

          {settings.default_trial_days > 0 && (
            <>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="trial_payment">Require Payment Method for Trial</Label>
                  <p className="text-sm text-muted-foreground">
                    Subscribers must add payment method to start trial
                  </p>
                </div>
                <Switch
                  id="trial_payment"
                  checked={settings.trial_requires_payment_method}
                  onCheckedChange={(checked) =>
                    updateSetting("trial_requires_payment_method", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="trial_convert">Auto-Convert After Trial</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically convert to paid subscription after trial ends
                  </p>
                </div>
                <Switch
                  id="trial_convert"
                  checked={settings.trial_auto_convert}
                  onCheckedChange={(checked) => updateSetting("trial_auto_convert", checked)}
                />
              </div>

              {settings.trial_auto_convert && !settings.trial_requires_payment_method && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Auto-convert is enabled but payment method is not required. Subscribers may not
                    be able to pay after trial ends.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Cap Settings</CardTitle>
          <CardDescription>Configure default bandwidth usage limits</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="data_cap">Default Data Cap</Label>
            <div className="flex items-center gap-2">
              <Input
                id="data_cap"
                type="number"
                min="0"
                max="10000"
                step="10"
                value={settings.default_data_cap_gb || 0}
                onChange={(e) =>
                  updateSetting("default_data_cap_gb", parseInt(e.target.value) || null)
                }
                className="w-40"
              />
              <span className="text-sm text-muted-foreground">GB (0 = unlimited)</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Monthly data allowance: {formatDataSize(settings.default_data_cap_gb)}
            </p>
          </div>

          {settings.default_data_cap_gb && settings.default_data_cap_gb > 0 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="warning_threshold">Warning Threshold</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="warning_threshold"
                    type="number"
                    min="50"
                    max="95"
                    step="5"
                    value={settings.data_cap_warning_threshold_percent}
                    onChange={(e) =>
                      updateSetting("data_cap_warning_threshold_percent", parseInt(e.target.value))
                    }
                    className="w-32"
                  />
                  <span className="text-sm text-muted-foreground">% of cap</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Send warning at{" "}
                  {formatDataSize(
                    (settings.default_data_cap_gb * settings.data_cap_warning_threshold_percent) /
                      100,
                  )}{" "}
                  ({settings.data_cap_warning_threshold_percent}% of cap)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="throttle_policy">Throttle Policy</Label>
                <Select
                  value={settings.throttle_policy}
                  onValueChange={(value) => updateSetting("throttle_policy", value)}
                >
                  <SelectTrigger id="throttle_policy">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {THROTTLE_POLICIES.map((policy) => (
                      <SelectItem key={policy.value} value={policy.value}>
                        {policy.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {selectedThrottlePolicy?.description}
                </p>
              </div>

              {requiresThrottleSpeed && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="throttled_download">Throttled Download Speed</Label>
                    <Input
                      id="throttled_download"
                      value={settings.throttled_download_speed || ""}
                      onChange={(e) =>
                        updateSetting("throttled_download_speed", e.target.value || null)
                      }
                      placeholder="e.g., 5M, 1G"
                    />
                    <p className="text-sm text-muted-foreground">Speed after cap exceeded</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="throttled_upload">Throttled Upload Speed</Label>
                    <Input
                      id="throttled_upload"
                      value={settings.throttled_upload_speed || ""}
                      onChange={(e) =>
                        updateSetting("throttled_upload_speed", e.target.value || null)
                      }
                      placeholder="e.g., 1M, 500K"
                    />
                    <p className="text-sm text-muted-foreground">Speed after cap exceeded</p>
                  </div>
                </div>
              )}

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Data usage is tracked via RADIUS accounting. Policy:{" "}
                  <strong>{selectedThrottlePolicy?.label}</strong>
                </AlertDescription>
              </Alert>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Credit & Billing Limits</CardTitle>
          <CardDescription>Configure default credit limits and billing thresholds</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="credit_limit">Default Credit Limit</Label>
            <div className="flex items-center gap-2">
              <Input
                id="credit_limit"
                type="number"
                min="0"
                max="10000"
                step="10"
                value={settings.default_credit_limit}
                onChange={(e) => updateSetting("default_credit_limit", parseFloat(e.target.value))}
                className="w-40"
              />
              <span className="text-sm text-muted-foreground">
                {settings.credit_limit_currency || "USD"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Maximum outstanding balance: {formatCurrency(settings.default_credit_limit)}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto_suspend">Auto-Suspend on Credit Limit</Label>
              <p className="text-sm text-muted-foreground">
                Automatically suspend service when credit limit is reached
              </p>
            </div>
            <Switch
              id="auto_suspend"
              checked={settings.auto_suspend_on_limit}
              onCheckedChange={(checked) => updateSetting("auto_suspend_on_limit", checked)}
            />
          </div>

          {!settings.auto_suspend_on_limit && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Auto-suspend disabled: Subscribers can exceed credit limit. Manual intervention
                required to suspend delinquent accounts.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="grace_period">Grace Period</Label>
            <div className="flex items-center gap-2">
              <Input
                id="grace_period"
                type="number"
                min="0"
                max="30"
                value={settings.grace_period_days}
                onChange={(e) => updateSetting("grace_period_days", parseInt(e.target.value))}
                className="w-32"
              />
              <span className="text-sm text-muted-foreground">days</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {settings.grace_period_days === 0
                ? "No grace period - immediate suspension after credit limit"
                : `${settings.grace_period_days} day${settings.grace_period_days > 1 ? "s" : ""} to pay before suspension`}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reconnection Settings</CardTitle>
          <CardDescription>
            Configure reconnection fees and policies after suspension
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="reconnection_fee">Auto-Reconnection Fee</Label>
            <div className="flex items-center gap-2">
              <Input
                id="reconnection_fee"
                type="number"
                min="0"
                max="1000"
                step="5"
                value={settings.auto_reconnection_fee}
                onChange={(e) => updateSetting("auto_reconnection_fee", parseFloat(e.target.value))}
                className="w-40"
              />
              <span className="text-sm text-muted-foreground">
                {settings.credit_limit_currency || "USD"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Fee charged for reconnection: {formatCurrency(settings.auto_reconnection_fee)}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="manual_reconnect">Require Manual Reconnection</Label>
              <p className="text-sm text-muted-foreground">
                Admin must manually approve reconnection after suspension
              </p>
            </div>
            <Switch
              id="manual_reconnect"
              checked={settings.require_manual_reconnection}
              onCheckedChange={(checked) => updateSetting("require_manual_reconnection", checked)}
            />
          </div>

          {settings.require_manual_reconnection ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Manual reconnection enabled: Subscribers must contact support to reconnect. Payment
                alone will not restore service.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Auto-reconnection enabled: Service automatically restores after payment (plus{" "}
                {formatCurrency(settings.auto_reconnection_fee)} reconnection fee).
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Service Defaults Summary</CardTitle>
          <CardDescription>Overview of default service configuration</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Trial Period:</h4>
              {settings.default_trial_days > 0 ? (
                <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                  <li>{settings.default_trial_days} days free trial</li>
                  <li>
                    Payment method:{" "}
                    {settings.trial_requires_payment_method ? "Required" : "Not required"}
                  </li>
                  <li>Auto-convert: {settings.trial_auto_convert ? "Yes" : "No"}</li>
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No trial period configured</p>
              )}
            </div>

            <div>
              <h4 className="font-medium mb-2">Data Cap:</h4>
              {settings.default_data_cap_gb && settings.default_data_cap_gb > 0 ? (
                <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                  <li>Monthly cap: {formatDataSize(settings.default_data_cap_gb)}</li>
                  <li>
                    Warning at: {settings.data_cap_warning_threshold_percent}% (
                    {formatDataSize(
                      (settings.default_data_cap_gb * settings.data_cap_warning_threshold_percent) /
                        100,
                    )}
                    )
                  </li>
                  <li>Policy: {selectedThrottlePolicy?.label}</li>
                  {requiresThrottleSpeed && settings.throttled_download_speed && (
                    <li>
                      Throttled speed: {settings.throttled_download_speed} /{" "}
                      {settings.throttled_upload_speed}
                    </li>
                  )}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Unlimited data</p>
              )}
            </div>

            <div>
              <h4 className="font-medium mb-2">Credit & Billing:</h4>
              <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                <li>Credit limit: {formatCurrency(settings.default_credit_limit)}</li>
                <li>Auto-suspend: {settings.auto_suspend_on_limit ? "Enabled" : "Disabled"}</li>
                <li>Grace period: {settings.grace_period_days} days</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium mb-2">Reconnection:</h4>
              <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                <li>Fee: {formatCurrency(settings.auto_reconnection_fee)}</li>
                <li>Approval: {settings.require_manual_reconnection ? "Manual" : "Automatic"}</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
