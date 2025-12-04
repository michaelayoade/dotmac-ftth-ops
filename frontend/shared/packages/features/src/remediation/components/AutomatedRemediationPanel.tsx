/**
 * Automated Remediation Panel Component
 *
 * Panel for configuring and executing automated remediation actions for common service issues.
 * Shared between ISP Ops and Platform Admin applications.
 */

"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Switch } from "@dotmac/ui";
import { Alert, AlertDescription, AlertTitle } from "@dotmac/ui";
import {
  Wrench,
  Zap,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Play,
  Settings,
  History,
} from "lucide-react";
import { useState } from "react";

export interface RemediationAction {
  id: string;
  name: string;
  description: string;
  icon: string;
  severity: "low" | "medium" | "high";
  autoEnabled: boolean;
  conditions: string[];
  actions: string[];
}

export interface RemediationHistory {
  id: string;
  action_name: string;
  subscriber_id: string;
  triggered_at: string;
  completed_at?: string;
  success: boolean;
  error_message?: string;
  auto_triggered: boolean;
}

const REMEDIATION_ACTIONS: RemediationAction[] = [
  {
    id: "cpe_restart",
    name: "CPE Auto-Restart",
    description: "Automatically restart CPE when it's offline for more than 10 minutes",
    icon: "Zap",
    severity: "medium",
    autoEnabled: false,
    conditions: [
      "CPE offline > 10 minutes",
      "No recent manual restart",
      "Subscriber has active service",
    ],
    actions: [
      "Send CPE reboot command via TR-069",
      "Wait for CPE to come online",
      "Verify connectivity",
      "Log action in audit trail",
    ],
  },
  {
    id: "radius_session_cleanup",
    name: "RADIUS Session Cleanup",
    description: "Clear stale RADIUS sessions preventing new logins",
    icon: "Wrench",
    severity: "low",
    autoEnabled: false,
    conditions: [
      "Active session count exceeds limit",
      "Session age > 24 hours",
      "Subscriber attempting new login",
    ],
    actions: [
      "Identify stale sessions",
      "Send disconnect request to NAS",
      "Clear session from RADIUS",
      "Allow new login attempt",
    ],
  },
  {
    id: "bandwidth_profile_sync",
    name: "Bandwidth Profile Sync",
    description: "Re-apply bandwidth profiles when mismatched",
    icon: "Settings",
    severity: "high",
    autoEnabled: false,
    conditions: [
      "Detected bandwidth mismatch",
      "Subscriber plan change",
      "ONU/CPE configuration drift",
    ],
    actions: [
      "Fetch current subscriber plan",
      "Update ONU bandwidth profile via VOLTHA",
      "Update CPE QoS via TR-069",
      "Verify new settings applied",
    ],
  },
  {
    id: "ip_address_renewal",
    name: "IP Address Renewal",
    description: "Force IP renewal when conflicts detected",
    icon: "Zap",
    severity: "medium",
    autoEnabled: false,
    conditions: ["IP conflict detected", "Duplicate IP in NetBox", "CPE has wrong IP"],
    actions: [
      "Release current IP from NetBox",
      "Trigger DHCP renewal on CPE",
      "Allocate new IP from pool",
      "Update NetBox records",
    ],
  },
];

interface ApiClient {
  post: (url: string, data?: any) => Promise<{ status: number; data?: any }>;
}

interface Toast {
  title: string;
  description: string;
  variant?: "default" | "destructive";
}

interface ToastHook {
  toast: (options: Toast) => void;
}

export interface AutomatedRemediationPanelProps {
  subscriberId?: string;
  apiClient: ApiClient;
  useToast: () => ToastHook;
}

export function AutomatedRemediationPanel({
  subscriberId,
  apiClient,
  useToast,
}: AutomatedRemediationPanelProps) {
  const { toast } = useToast();

  const [remediationSettings, setRemediationSettings] = useState<Map<string, boolean>>(
    new Map(REMEDIATION_ACTIONS.map((action) => [action.id, action.autoEnabled])),
  );
  const [executingAction, setExecutingAction] = useState<string | null>(null);
  const [history, setHistory] = useState<RemediationHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const toggleAutoRemediation = async (actionId: string, enabled: boolean) => {
    setRemediationSettings((prev) => new Map(prev).set(actionId, enabled));

    try {
      await apiClient.post(`/api/platform/v1/admin/remediation/settings`, {
        action_id: actionId,
        auto_enabled: enabled,
        subscriber_id: subscriberId,
      });

      toast({
        title: enabled ? "Auto-remediation enabled" : "Auto-remediation disabled",
        description: `${REMEDIATION_ACTIONS.find((a) => a.id === actionId)?.name} ${enabled ? "will run automatically" : "requires manual trigger"}`,
      });
    } catch (err: any) {
      // Revert on error
      setRemediationSettings((prev) => new Map(prev).set(actionId, !enabled));
      toast({
        title: "Failed to update settings",
        description: err?.response?.data?.detail || "Could not save auto-remediation settings",
        variant: "destructive",
      });
    }
  };

  const executeRemediationAction = async (actionId: string) => {
    if (!subscriberId) {
      toast({
        title: "No subscriber selected",
        description: "Please select a subscriber to run remediation actions",
        variant: "destructive",
      });
      return;
    }

    setExecutingAction(actionId);

    try {
      const response = await apiClient.post(`/api/platform/v1/admin/remediation/execute`, {
        action_id: actionId,
        subscriber_id: subscriberId,
        manual_trigger: true,
      });

      const action = REMEDIATION_ACTIONS.find((a) => a.id === actionId);

      toast({
        title: "Remediation successful",
        description: `${action?.name} completed successfully`,
      });

      // Add to history
      setHistory((prev) => [
        {
          id: response.data.remediation_id,
          action_name: action?.name || actionId,
          subscriber_id: subscriberId,
          triggered_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          success: true,
          auto_triggered: false,
        },
        ...prev,
      ]);
    } catch (err: any) {
      const action = REMEDIATION_ACTIONS.find((a) => a.id === actionId);

      toast({
        title: "Remediation failed",
        description: err?.response?.data?.detail || `${action?.name} failed to complete`,
        variant: "destructive",
      });

      // Add failed attempt to history
      setHistory((prev) => [
        {
          id: `failed-${Date.now()}`,
          action_name: action?.name || actionId,
          subscriber_id: subscriberId || "unknown",
          triggered_at: new Date().toISOString(),
          success: false,
          error_message: err?.response?.data?.detail || "Unknown error",
          auto_triggered: false,
        },
        ...prev,
      ]);
    } finally {
      setExecutingAction(null);
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "high":
        return <Badge variant="destructive">High Impact</Badge>;
      case "medium":
        return <Badge variant="secondary">Medium Impact</Badge>;
      case "low":
        return <Badge variant="outline">Low Impact</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {!subscriberId && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Select a subscriber</AlertTitle>
          <AlertDescription>
            Choose a subscriber to configure and execute remediation actions
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Automated Remediation</h2>
          <p className="text-sm text-muted-foreground">
            Configure automatic fixes for common service issues
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)}>
          <History className="w-4 h-4 mr-2" />
          {showHistory ? "Hide" : "Show"} History
        </Button>
      </div>

      {/* Remediation Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        {REMEDIATION_ACTIONS.map((action) => (
          <Card key={action.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Wrench className="w-4 h-4" />
                    <CardTitle className="text-base">{action.name}</CardTitle>
                  </div>
                  <CardDescription className="text-sm">{action.description}</CardDescription>
                </div>
                {getSeverityBadge(action.severity)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Conditions */}
              <div>
                <h4 className="text-sm font-medium mb-2">Triggers when:</h4>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {action.conditions.map((condition, idx) => (
                    <li key={idx} className="flex items-start gap-1">
                      <span className="text-primary">•</span>
                      <span>{condition}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Actions */}
              <div>
                <h4 className="text-sm font-medium mb-2">Will perform:</h4>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {action.actions.map((actionStep, idx) => (
                    <li key={idx} className="flex items-start gap-1">
                      <span>{idx + 1}.</span>
                      <span>{actionStep}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Controls */}
              <div className="pt-3 border-t space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">Auto-execute</div>
                    <div className="text-xs text-muted-foreground">
                      Run automatically when conditions met
                    </div>
                  </div>
                  <Switch
                    checked={remediationSettings.get(action.id) || false}
                    onCheckedChange={(checked) => toggleAutoRemediation(action.id, checked)}
                  />
                </div>

                <Button
                  onClick={() => executeRemediationAction(action.id)}
                  disabled={!subscriberId || executingAction === action.id}
                  size="sm"
                  className="w-full"
                >
                  {executingAction === action.id ? (
                    <>
                      <Clock className="w-4 h-4 mr-2 animate-spin" />
                      Executing...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Run Now
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* History */}
      {showHistory && (
        <Card>
          <CardHeader>
            <CardTitle>Remediation History</CardTitle>
            <CardDescription>Recent automatic and manual remediation executions</CardDescription>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No remediation actions have been executed yet
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-card/40"
                  >
                    <div className="flex items-center gap-3">
                      {item.success ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                      <div>
                        <div className="font-medium text-sm">{item.action_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.auto_triggered ? "Auto-triggered" : "Manual"} •{" "}
                          {new Date(item.triggered_at).toLocaleString()}
                        </div>
                        {item.error_message && (
                          <div className="text-xs text-red-600 mt-1">{item.error_message}</div>
                        )}
                      </div>
                    </div>
                    <Badge variant={item.success ? "outline" : "destructive"}>
                      {item.success ? "Success" : "Failed"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
