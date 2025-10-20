'use client';

/**
 * ISP Internet Service Plan Validation and Testing Page
 *
 * KEY FEATURE: Validates plan configuration and simulates usage scenarios
 * to show if plans work as designed before activation.
 */

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  Play,
  TrendingUp,
  TrendingDown,
  Activity,
  DollarSign,
  Gauge,
  Clock,
} from 'lucide-react';
import {
  useInternetPlan,
  useValidatePlan,
} from '../../../../../../hooks/useInternetPlans';
import type {
  PlanValidationRequest,
  PlanValidationResponse,
  ValidationResult,
  ValidationSeverity,
  ValidationSimulationConfig,
} from '../../../../../../types/internet-plans';

export default function PlanValidationPage() {
  const params = useParams();
  const router = useRouter();
  const planId = params.id as string;

  const { data: plan, isLoading: planLoading } = useInternetPlan(planId);
  const { mutate: validatePlan, isPending: validating } = useValidatePlan();

  const [validationResult, setValidationResult] = useState<PlanValidationResponse | null>(
    null
  );
  const [simulationConfig, setSimulationConfig] =
    useState<ValidationSimulationConfig>({
      usageScenario: 'moderate',
      downloadGB: 300,
      uploadGB: 50,
      durationHours: 720, // 30 days
      concurrentUsers: 3,
    });

  // Preset usage scenarios
  const usageScenarios = {
    light: {
      downloadGB: 100,
      uploadGB: 10,
      concurrentUsers: 1,
      description: 'Light usage: Email, browsing, social media',
    },
    moderate: {
      downloadGB: 300,
      uploadGB: 50,
      concurrentUsers: 3,
      description: 'Moderate usage: Streaming HD, video calls, gaming',
    },
    heavy: {
      downloadGB: 800,
      uploadGB: 150,
      concurrentUsers: 5,
      description: 'Heavy usage: 4K streaming, large downloads, multiple devices',
    },
    custom: {
      downloadGB: 2000,
      uploadGB: 500,
      concurrentUsers: 10,
      description: 'Extreme usage: Multiple 4K streams, gaming, work from home',
    },
  };

  const handleScenarioChange = (scenario: keyof typeof usageScenarios) => {
    const preset = usageScenarios[scenario];
    setSimulationConfig({
      usageScenario: scenario,
      downloadGB: preset.downloadGB,
      uploadGB: preset.uploadGB,
      durationHours: 720,
      concurrentUsers: preset.concurrentUsers,
    });
  };

  const handleValidate = () => {
    const request: PlanValidationRequest = {
      test_download_usage_gb: simulationConfig.downloadGB,
      test_upload_usage_gb: simulationConfig.uploadGB,
      test_duration_hours: simulationConfig.durationHours,
      test_concurrent_users: simulationConfig.concurrentUsers,
      validate_speeds: true,
      validate_data_caps: true,
      validate_pricing: true,
      validate_time_restrictions: true,
      validate_qos: true,
    };

    validatePlan(
      { planId, request },
      {
        onSuccess: (data) => {
          setValidationResult(data);
        },
      }
    );
  };

  if (planLoading) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Loading plan...</p>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="p-6">
        <Card className="p-6">
          <p className="text-red-500">Plan not found</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Plan Validation & Testing</h1>
          <p className="text-muted-foreground mt-1">
            Test {plan.name} configuration and simulate usage scenarios
          </p>
        </div>
      </div>

      {/* Plan Summary */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4">Plan Overview</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <p className="text-sm text-muted-foreground">Plan Code</p>
            <p className="font-semibold">{plan.plan_code}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Download Speed</p>
            <p className="font-semibold">
              {plan.download_speed} {plan.speed_unit}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Upload Speed</p>
            <p className="font-semibold">
              {plan.upload_speed} {plan.speed_unit}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Monthly Price</p>
            <p className="font-semibold">
              {plan.currency} {plan.monthly_price.toFixed(2)}
            </p>
          </div>
        </div>
      </Card>

      {/* Simulation Configuration */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4">Usage Simulation Configuration</h2>

        {/* Preset Scenarios */}
        <div className="mb-6">
          <label className="text-sm font-medium mb-2 block">Usage Scenario</label>
          <div className="grid gap-3 md:grid-cols-4">
            {(Object.keys(usageScenarios) as Array<keyof typeof usageScenarios>).map(
              (key) => (
                <button
                  key={key}
                  onClick={() => handleScenarioChange(key)}
                  className={`p-4 border rounded-lg text-left transition-colors ${
                    simulationConfig.usageScenario === key
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-blue-300'
                  }`}
                >
                  <p className="font-semibold capitalize">{key}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {usageScenarios[key].description}
                  </p>
                  <div className="mt-2 text-xs">
                    <p>↓ {usageScenarios[key].downloadGB} GB</p>
                    <p>↑ {usageScenarios[key].uploadGB} GB</p>
                    <p>👥 {usageScenarios[key].concurrentUsers} users</p>
                  </div>
                </button>
              )
            )}
          </div>
        </div>

        {/* Custom Configuration */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Download Usage (GB)</label>
            <input
              type="number"
              value={simulationConfig.downloadGB}
              onChange={(e) =>
                setSimulationConfig((prev) => ({
                  ...prev,
                  usageScenario: 'custom',
                  downloadGB: Number(e.target.value),
                }))
              }
              className="w-full border rounded-md px-3 py-2"
              min="0"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Upload Usage (GB)</label>
            <input
              type="number"
              value={simulationConfig.uploadGB}
              onChange={(e) =>
                setSimulationConfig((prev) => ({
                  ...prev,
                  usageScenario: 'custom',
                  uploadGB: Number(e.target.value),
                }))
              }
              className="w-full border rounded-md px-3 py-2"
              min="0"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Duration (Hours)</label>
            <input
              type="number"
              value={simulationConfig.durationHours}
              onChange={(e) =>
                setSimulationConfig((prev) => ({
                  ...prev,
                  durationHours: Number(e.target.value),
                }))
              }
              className="w-full border rounded-md px-3 py-2"
              min="1"
              max="720"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {(simulationConfig.durationHours / 24).toFixed(1)} days
            </p>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Concurrent Users</label>
            <input
              type="number"
              value={simulationConfig.concurrentUsers}
              onChange={(e) =>
                setSimulationConfig((prev) => ({
                  ...prev,
                  concurrentUsers: Number(e.target.value),
                }))
              }
              className="w-full border rounded-md px-3 py-2"
              min="1"
              max="100"
            />
          </div>
        </div>

        <div className="mt-6">
          <Button onClick={handleValidate} disabled={validating} className="w-full">
            <Play className="mr-2 h-4 w-4" />
            {validating ? 'Running Validation...' : 'Run Validation Tests'}
          </Button>
        </div>
      </Card>

      {/* Validation Results */}
      {validationResult && (
        <>
          {/* Overall Status */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold mb-2">Validation Results</h2>
                <p className="text-sm text-muted-foreground">
                  Validated at {new Date(validationResult.validated_at).toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <ValidationStatusBadge status={validationResult.overall_status} />
                <p className="text-sm text-muted-foreground mt-2">
                  {validationResult.passed_checks} / {validationResult.total_checks}{' '}
                  checks passed
                </p>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-4 mt-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">
                    {validationResult.passed_checks}
                  </p>
                  <p className="text-sm text-muted-foreground">Passed</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <AlertCircle className="h-8 w-8 text-red-500" />
                <div>
                  <p className="text-2xl font-bold">
                    {validationResult.failed_checks}
                  </p>
                  <p className="text-sm text-muted-foreground">Failed</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold">
                    {validationResult.warning_checks}
                  </p>
                  <p className="text-sm text-muted-foreground">Warnings</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Activity className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{validationResult.total_checks}</p>
                  <p className="text-sm text-muted-foreground">Total</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Simulation Results */}
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">Usage Simulation Results</h2>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Cost Estimates */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Cost Estimates
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <span className="text-sm">Monthly Price</span>
                    <span className="font-bold">
                      {plan.currency}{' '}
                      {validationResult.estimated_monthly_cost.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <span className="text-sm">Overage Charges</span>
                    <span
                      className={`font-bold ${validationResult.estimated_overage_cost > 0 ? 'text-red-500' : ''}`}
                    >
                      {plan.currency}{' '}
                      {validationResult.estimated_overage_cost.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded border-2 border-blue-200">
                    <span className="font-semibold">Total Estimated Cost</span>
                    <span className="font-bold text-lg">
                      {plan.currency}{' '}
                      {(
                        validationResult.estimated_monthly_cost +
                        validationResult.estimated_overage_cost
                      ).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Gauge className="h-5 w-5" />
                  Performance Metrics
                </h3>
                <div className="space-y-3">
                  <div className="p-3 bg-gray-50 rounded">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm flex items-center gap-1">
                        <TrendingUp className="h-4 w-4" />
                        Peak Download Speed
                      </span>
                      <span className="font-bold">
                        {validationResult.peak_download_speed_mbps.toFixed(2)} Mbps
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm flex items-center gap-1">
                        <TrendingDown className="h-4 w-4" />
                        Average Download Speed
                      </span>
                      <span className="font-semibold">
                        {validationResult.average_download_speed_mbps.toFixed(2)} Mbps
                      </span>
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm flex items-center gap-1">
                        <TrendingUp className="h-4 w-4" />
                        Peak Upload Speed
                      </span>
                      <span className="font-bold">
                        {validationResult.peak_upload_speed_mbps.toFixed(2)} Mbps
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm flex items-center gap-1">
                        <TrendingDown className="h-4 w-4" />
                        Average Upload Speed
                      </span>
                      <span className="font-semibold">
                        {validationResult.average_upload_speed_mbps.toFixed(2)} Mbps
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Alerts */}
            <div className="mt-6 space-y-2">
              {validationResult.data_cap_exceeded && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  <span className="text-sm font-medium text-red-700">
                    Data cap would be exceeded under this usage scenario
                  </span>
                </div>
              )}
              {validationResult.throttling_triggered && (
                <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  <span className="text-sm font-medium text-yellow-700">
                    Throttling would be triggered under this usage scenario
                  </span>
                </div>
              )}
              {!validationResult.data_cap_exceeded &&
                !validationResult.throttling_triggered && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="text-sm font-medium text-green-700">
                      Plan performs well under this usage scenario
                    </span>
                  </div>
                )}
            </div>
          </Card>

          {/* Detailed Validation Results */}
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">Detailed Validation Checks</h2>
            <div className="space-y-2">
              {validationResult.results.map((result, index) => (
                <ValidationResultItem key={index} result={result} />
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function ValidationStatusBadge({ status }: { status: string }) {
  const colors = {
    passed: 'bg-green-100 text-green-800 border-green-300',
    failed: 'bg-red-100 text-red-800 border-red-300',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  };

  const icons = {
    passed: CheckCircle,
    failed: AlertCircle,
    warning: AlertTriangle,
  };

  const Icon = icons[status as keyof typeof icons] || Activity;
  const colorClass = colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';

  return (
    <Badge className={`${colorClass} border px-4 py-2 text-lg font-semibold`}>
      <Icon className="mr-2 h-5 w-5" />
      {status.toUpperCase()}
    </Badge>
  );
}

function ValidationResultItem({ result }: { result: ValidationResult }) {
  const getSeverityIcon = (severity: ValidationSeverity) => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'info':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getSeverityColor = (severity: ValidationSeverity) => {
    switch (severity) {
      case 'error':
        return 'border-red-200 bg-red-50';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50';
      case 'info':
        return 'border-green-200 bg-green-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  return (
    <div
      className={`flex items-start gap-3 p-3 border rounded ${getSeverityColor(result.severity)}`}
    >
      <div className="mt-0.5">{getSeverityIcon(result.severity)}</div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <span className="font-medium">{result.check_name.replace(/_/g, ' ')}</span>
          <Badge
            variant={result.passed ? 'default' : 'destructive'}
            className="text-xs"
          >
            {result.passed ? 'PASS' : 'FAIL'}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{result.message}</p>
        {Object.keys(result.details).length > 0 && (
          <div className="mt-2 text-xs font-mono bg-white p-2 rounded border">
            {JSON.stringify(result.details, null, 2)}
          </div>
        )}
      </div>
    </div>
  );
}
