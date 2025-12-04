/**
 * Scheduled Deployment Page
 *
 * Schedule deployment operations for future execution (one-time or recurring)
 */

"use client";

import { useState, useEffect } from "react";
import { Calendar, AlertCircle, CheckCircle2, Loader2, Info } from "lucide-react";
import {
  useScheduledDeployments,
  getOperationDescription,
  CRON_EXAMPLES,
  isValidCronExpression,
  type DeploymentOperation,
  type ScheduledDeploymentRequest,
  type DeploymentTemplate,
  type DeploymentInstance,
} from "@/hooks/useScheduledDeployments";
import { Button } from "@dotmac/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import { RadioGroup, RadioGroupItem } from "@dotmac/ui";
import { Alert, AlertDescription, AlertTitle } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { useRBAC } from "@/contexts/RBACContext";
import { useToast } from "@dotmac/ui";
import { logger } from "@/lib/logger";

type ScheduleType = "one_time" | "recurring";

export default function ScheduledDeploymentPage() {
  const { toast } = useToast();
  const { hasPermission } = useRBAC();
  const canSchedule = hasPermission("deployment.schedule.create") || hasPermission("admin");

  const { scheduleDeployment, fetchTemplates, fetchInstances, isLoading, error } =
    useScheduledDeployments();

  // Form state
  const [operation, setOperation] = useState<DeploymentOperation>("upgrade");
  const [scheduleType, setScheduleType] = useState<ScheduleType>("one_time");
  const [scheduledAt, setScheduledAt] = useState("");
  const [cronExpression, setCronExpression] = useState("");
  const [intervalSeconds, setIntervalSeconds] = useState("");

  // Operation-specific state
  const [selectedInstance, setSelectedInstance] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [upgradeVersion, setUpgradeVersion] = useState("");
  const [rollbackOnFailure, setRollbackOnFailure] = useState(true);
  const [cpuCores, setCpuCores] = useState("");
  const [memoryGb, setMemoryGb] = useState("");
  const [storageGb, setStorageGb] = useState("");

  // Data
  const [templates, setTemplates] = useState<DeploymentTemplate[]>([]);
  const [instances, setInstances] = useState<DeploymentInstance[]>([]);

  // Success state
  const [successResponse, setSuccessResponse] = useState<any>(null);

  // Load templates and instances
  useEffect(() => {
    const loadData = async () => {
      try {
        const [templatesData, instancesData] = await Promise.all([
          fetchTemplates(),
          fetchInstances(),
        ]);
        setTemplates(templatesData);
        setInstances(instancesData);
        logger.info("Templates and instances loaded successfully", {
          templatesCount: templatesData.length,
          instancesCount: instancesData.length,
        });
      } catch (err) {
        logger.error("Failed to load templates and instances", err);
        toast({
          title: "Error",
          description: "Failed to load templates and instances. Please refresh the page.",
          variant: "destructive",
        });
      }
    };
    loadData();
  }, [fetchTemplates, fetchInstances, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSchedule) {
      return;
    }

    try {
      setSuccessResponse(null);

      const request: ScheduledDeploymentRequest = {
        operation,
        scheduled_at: scheduledAt,
      };

      // Add schedule-specific parameters
      if (scheduleType === "recurring") {
        if (cronExpression) {
          request.cron_expression = cronExpression;
        } else if (intervalSeconds) {
          request.interval_seconds = parseInt(intervalSeconds);
        }
      }

      // Add operation-specific parameters
      if (operation !== "provision") {
        request.instance_id = parseInt(selectedInstance);
      }

      if (operation === "provision") {
        request.provision_request = {
          template_id: parseInt(selectedTemplate),
          environment: "production",
        };
      }

      if (operation === "upgrade") {
        request.upgrade_request = {
          to_version: upgradeVersion,
          rollback_on_failure: rollbackOnFailure,
        };
      }

      if (operation === "scale") {
        request.scale_request = {};
        if (cpuCores) request.scale_request.cpu_cores = parseInt(cpuCores);
        if (memoryGb) request.scale_request.memory_gb = parseInt(memoryGb);
        if (storageGb) request.scale_request.storage_gb = parseInt(storageGb);
      }

      const response = await scheduleDeployment(request);
      setSuccessResponse(response);

      logger.info("Deployment scheduled successfully", {
        scheduleId: response.schedule_id,
        operation,
        scheduleType,
        nextRunAt: response.next_run_at,
      });

      toast({
        title: "Success",
        description: `Deployment scheduled successfully (ID: ${response.schedule_id})`,
      });

      // Reset form
      setScheduledAt("");
      setCronExpression("");
      setIntervalSeconds("");
      setUpgradeVersion("");
      setCpuCores("");
      setMemoryGb("");
      setStorageGb("");
    } catch (err) {
      logger.error("Failed to schedule deployment", err);
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to schedule deployment. Please try again.",
        variant: "destructive",
      });
    }
  };

  const isFormValid = () => {
    if (!scheduledAt) return false;

    if (scheduleType === "recurring") {
      if (!cronExpression && !intervalSeconds) return false;
      if (cronExpression && !isValidCronExpression(cronExpression)) return false;
    }

    if (operation === "provision" && !selectedTemplate) return false;
    if (operation !== "provision" && !selectedInstance) return false;
    if (operation === "upgrade" && !upgradeVersion) return false;
    if (operation === "scale" && !cpuCores && !memoryGb && !storageGb) return false;

    return true;
  };

  if (!canSchedule) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You don&apos;t have permission to schedule deployments.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <Calendar className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          Schedule Deployment
        </h1>
        <p className="mt-2 text-muted-foreground">
          Schedule deployment operations for future execution (one-time or recurring)
        </p>
      </div>

      {/* Success Alert */}
      {successResponse && (
        <Alert className="border-green-500 bg-green-50 dark:bg-green-950/20">
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertTitle className="text-green-600 dark:text-green-400">
            Deployment Scheduled Successfully
          </AlertTitle>
          <AlertDescription className="text-green-600 dark:text-green-400">
            Schedule ID: {successResponse.schedule_id} | Type: {successResponse.schedule_type}
            {successResponse.next_run_at && (
              <div>Next execution: {new Date(successResponse.next_run_at).toLocaleString()}</div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Schedule Details</CardTitle>
          <CardDescription>Configure deployment operation and schedule</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Operation Selection */}
            <div className="space-y-2">
              <Label htmlFor="operation">Operation *</Label>
              <Select
                value={operation}
                onValueChange={(v) => setOperation(v as DeploymentOperation)}
              >
                <SelectTrigger id="operation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="provision">Provision New Deployment</SelectItem>
                  <SelectItem value="upgrade">Upgrade Deployment</SelectItem>
                  <SelectItem value="scale">Scale Resources</SelectItem>
                  <SelectItem value="suspend">Suspend Deployment</SelectItem>
                  <SelectItem value="resume">Resume Deployment</SelectItem>
                  <SelectItem value="destroy">Destroy Deployment</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">{getOperationDescription(operation)}</p>
            </div>

            {/* Schedule Type */}
            <div className="space-y-3">
              <Label>Schedule Type *</Label>
              <RadioGroup
                value={scheduleType}
                onValueChange={(v: string) => setScheduleType(v as ScheduleType)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="one_time" id="one_time" />
                  <Label htmlFor="one_time" className="font-normal cursor-pointer">
                    One-Time (Execute once at specified time)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="recurring" id="recurring" />
                  <Label htmlFor="recurring" className="font-normal cursor-pointer">
                    Recurring (Execute on schedule)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Scheduled At */}
            <div className="space-y-2">
              <Label htmlFor="scheduled-at">
                {scheduleType === "one_time" ? "Execute At" : "First Execution At"} *
              </Label>
              <Input
                id="scheduled-at"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                required
              />
            </div>

            {/* Recurring Schedule Options */}
            {scheduleType === "recurring" && (
              <Tabs defaultValue="cron" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="cron">Cron Expression</TabsTrigger>
                  <TabsTrigger value="interval">Interval</TabsTrigger>
                </TabsList>

                <TabsContent value="cron" className="space-y-2 mt-4">
                  <Label htmlFor="cron">Cron Expression</Label>
                  <Input
                    id="cron"
                    value={cronExpression}
                    onChange={(e) => {
                      setCronExpression(e.target.value);
                      setIntervalSeconds("");
                    }}
                    placeholder="0 2 * * 0"
                  />
                  <p className="text-sm text-muted-foreground">
                    Format: minute hour day month weekday
                  </p>
                  <div className="mt-3 space-y-2">
                    <p className="text-sm font-medium">Examples:</p>
                    {CRON_EXAMPLES.map((example) => (
                      <Button
                        key={example.value}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCronExpression(example.value);
                          setIntervalSeconds("");
                        }}
                        className="mr-2 mb-2"
                      >
                        {example.label}: {example.value}
                      </Button>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="interval" className="space-y-2 mt-4">
                  <Label htmlFor="interval">Interval (seconds)</Label>
                  <Input
                    id="interval"
                    type="number"
                    value={intervalSeconds}
                    onChange={(e) => {
                      setIntervalSeconds(e.target.value);
                      setCronExpression("");
                    }}
                    placeholder="3600"
                    min="60"
                    max="2592000"
                  />
                  <p className="text-sm text-muted-foreground">
                    Min: 60 (1 minute), Max: 2,592,000 (30 days)
                  </p>
                </TabsContent>
              </Tabs>
            )}

            {/* Instance/Template Selection */}
            {operation === "provision" ? (
              <div className="space-y-2">
                <Label htmlFor="template">Deployment Template *</Label>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger id="template">
                    <SelectValue placeholder="Choose a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id.toString()}>
                        {template.display_name} (v{template.version})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="instance">Deployment Instance *</Label>
                <Select value={selectedInstance} onValueChange={setSelectedInstance}>
                  <SelectTrigger id="instance">
                    <SelectValue placeholder="Choose an instance..." />
                  </SelectTrigger>
                  <SelectContent>
                    {instances.map((instance) => (
                      <SelectItem key={instance.id} value={instance.id.toString()}>
                        Instance #{instance.id} - {instance.environment} ({instance.state})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Operation-Specific Fields */}
            {operation === "upgrade" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="version">Target Version *</Label>
                  <Input
                    id="version"
                    value={upgradeVersion}
                    onChange={(e) => setUpgradeVersion(e.target.value)}
                    placeholder="2.0.0"
                    pattern="\\d+\\.\\d+\\.\\d+"
                    required
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="rollback"
                    checked={rollbackOnFailure}
                    onChange={(e) => setRollbackOnFailure(e.target.checked)}
                  />
                  <Label htmlFor="rollback" className="font-normal cursor-pointer">
                    Rollback on failure
                  </Label>
                </div>
              </div>
            )}

            {operation === "scale" && (
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cpu">CPU Cores</Label>
                  <Input
                    id="cpu"
                    type="number"
                    value={cpuCores}
                    onChange={(e) => setCpuCores(e.target.value)}
                    placeholder="8"
                    min="1"
                    max="128"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="memory">Memory (GB)</Label>
                  <Input
                    id="memory"
                    type="number"
                    value={memoryGb}
                    onChange={(e) => setMemoryGb(e.target.value)}
                    placeholder="32"
                    min="1"
                    max="512"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="storage">Storage (GB)</Label>
                  <Input
                    id="storage"
                    type="number"
                    value={storageGb}
                    onChange={(e) => setStorageGb(e.target.value)}
                    placeholder="500"
                    min="10"
                    max="10000"
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end gap-3 pt-4">
              <Button type="submit" disabled={!isFormValid() || isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Scheduling...
                  </>
                ) : (
                  <>
                    <Calendar className="mr-2 h-4 w-4" />
                    Schedule Deployment
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="text-blue-900 dark:text-blue-100 flex items-center gap-2">
            <Info className="h-5 w-5" />
            Scheduling Information
          </CardTitle>
        </CardHeader>
        <CardContent className="text-blue-800 dark:text-blue-200 space-y-2">
          <p>
            <strong>One-Time:</strong> Deployment executes once at the specified time
          </p>
          <p>
            <strong>Recurring:</strong> Deployment executes on schedule (cron or interval)
          </p>
          <p>
            <strong>Retry Policy:</strong> Failed deployments retry up to 2 times with 5-minute
            delays
          </p>
          <p>
            <strong>Timeout:</strong> Operations timeout after 1 hour
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
