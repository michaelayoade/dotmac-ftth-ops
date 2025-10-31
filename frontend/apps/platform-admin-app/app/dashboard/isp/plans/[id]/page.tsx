"use client";

/**
 * ISP Internet Service Plan Details Page
 *
 * Displays comprehensive details about a specific internet service plan.
 */

import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Edit,
  Trash2,
  PlayCircle,
  GitCompare,
  TrendingUp,
  TrendingDown,
  Clock,
  Shield,
  Wifi,
  DollarSign,
  Users,
  Calendar,
  CheckCircle,
  XCircle,
} from "lucide-react";
import {
  useInternetPlan,
  usePlanStatistics,
  useDeleteInternetPlan,
} from "../../../../../hooks/useInternetPlans";
import Link from "next/link";
import type { InternetServicePlan } from "../../../../../types/internet-plans";

export default function PlanDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const planId = params.id as string;

  const { data: plan, isLoading } = useInternetPlan(planId);
  const { data: stats } = usePlanStatistics(planId);
  const { mutate: deletePlan, isPending: deleting } = useDeleteInternetPlan();

  const handleDelete = () => {
    if (!confirm("Are you sure you want to archive this plan? This action cannot be undone.")) {
      return;
    }

    deletePlan(planId, {
      onSuccess: () => {
        router.push("/dashboard/isp/plans");
      },
    });
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Loading plan details...</p>
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{plan.name}</h1>
            <p className="text-muted-foreground mt-1">{plan.plan_code}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/dashboard/isp/plans/${planId}/validate`}>
            <Button variant="secondary">
              <PlayCircle className="mr-2 h-4 w-4" />
              Validate & Test
            </Button>
          </Link>
          <Link href={`/dashboard/isp/plans/${planId}/edit`}>
            <Button variant="outline">
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </Link>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting || (stats?.active_subscriptions ?? 0) > 0}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Archive
          </Button>
        </div>
      </div>

      {/* Status and Type Badges */}
      <div className="flex items-center gap-2">
        <Badge className="bg-blue-500">{plan.status}</Badge>
        <Badge className="bg-purple-500">{plan.plan_type}</Badge>
        {plan.is_promotional && <Badge className="bg-pink-500">Promotional</Badge>}
        {plan.is_public ? (
          <Badge className="bg-green-500">Public</Badge>
        ) : (
          <Badge className="bg-gray-500">Private</Badge>
        )}
      </div>

      {/* Description */}
      {plan.description && (
        <Card className="p-6">
          <p className="text-lg">{plan.description}</p>
        </Card>
      )}

      {/* Statistics */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Subscriptions</p>
                <p className="text-3xl font-bold">{stats.active_subscriptions}</p>
              </div>
              <Users className="h-10 w-10 text-blue-500" />
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Monthly Recurring Revenue</p>
                <p className="text-3xl font-bold">
                  {plan.currency} {stats.monthly_recurring_revenue.toFixed(2)}
                </p>
              </div>
              <DollarSign className="h-10 w-10 text-green-500" />
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Validation Status</p>
                <p className="text-lg font-bold">{plan.validation_status || "Not Validated"}</p>
              </div>
              {plan.validation_status === "passed" ? (
                <CheckCircle className="h-10 w-10 text-green-500" />
              ) : plan.validation_status === "failed" ? (
                <XCircle className="h-10 w-10 text-red-500" />
              ) : (
                <Clock className="h-10 w-10 text-gray-400" />
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Speed Configuration */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Wifi className="h-6 w-6" />
          Speed Configuration
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-blue-500" />
                <span className="font-medium">Download Speed</span>
              </div>
              <span className="text-xl font-bold">
                {plan.download_speed} {plan.speed_unit}
              </span>
            </div>
            {plan.burst_download_speed && (
              <div className="flex items-center justify-between p-4 bg-blue-100 rounded">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  <span className="font-medium">Burst Download</span>
                </div>
                <span className="text-lg font-semibold">
                  {plan.burst_download_speed} {plan.speed_unit}
                  {plan.burst_duration_seconds && (
                    <span className="text-sm ml-1">({plan.burst_duration_seconds}s)</span>
                  )}
                </span>
              </div>
            )}
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-50 rounded">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                <span className="font-medium">Upload Speed</span>
              </div>
              <span className="text-xl font-bold">
                {plan.upload_speed} {plan.speed_unit}
              </span>
            </div>
            {plan.burst_upload_speed && (
              <div className="flex items-center justify-between p-4 bg-green-100 rounded">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <span className="font-medium">Burst Upload</span>
                </div>
                <span className="text-lg font-semibold">
                  {plan.burst_upload_speed} {plan.speed_unit}
                  {plan.burst_duration_seconds && (
                    <span className="text-sm ml-1">({plan.burst_duration_seconds}s)</span>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Data Cap & Throttling */}
      {plan.has_data_cap && (
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Data Cap & Throttling</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 bg-gray-50 rounded">
              <p className="text-sm text-muted-foreground mb-1">Data Cap</p>
              <p className="text-xl font-bold">
                {plan.data_cap_amount} {plan.data_cap_unit}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded">
              <p className="text-sm text-muted-foreground mb-1">Throttle Policy</p>
              <p className="text-lg font-semibold capitalize">
                {plan.throttle_policy.replace(/_/g, " ")}
              </p>
            </div>
            {plan.throttled_download_speed && (
              <div className="p-4 bg-gray-50 rounded">
                <p className="text-sm text-muted-foreground mb-1">Throttled Speed</p>
                <p className="text-lg font-semibold">
                  {plan.throttled_download_speed} {plan.speed_unit}
                </p>
              </div>
            )}
          </div>
          {plan.overage_price_per_unit && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
              <p className="font-medium">Overage Charges</p>
              <p className="text-sm">
                {plan.currency} {plan.overage_price_per_unit.toFixed(2)} per {plan.overage_unit}
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Fair Usage Policy */}
      {plan.has_fup && (
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Fair Usage Policy (FUP)
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 bg-gray-50 rounded">
              <p className="text-sm text-muted-foreground mb-1">FUP Threshold</p>
              <p className="text-xl font-bold">
                {plan.fup_threshold} {plan.fup_threshold_unit}
              </p>
            </div>
            {plan.fup_throttle_speed && (
              <div className="p-4 bg-gray-50 rounded">
                <p className="text-sm text-muted-foreground mb-1">Post-FUP Speed</p>
                <p className="text-lg font-semibold">
                  {plan.fup_throttle_speed} {plan.speed_unit}
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Time-Based Restrictions */}
      {plan.has_time_restrictions && (
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Clock className="h-6 w-6" />
            Time-Based Restrictions
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded">
              <span className="font-medium">Unrestricted Period</span>
              <span className="text-lg font-semibold">
                {plan.unrestricted_start_time} - {plan.unrestricted_end_time}
              </span>
            </div>
            {plan.unrestricted_data_unlimited && (
              <div className="p-4 bg-green-50 border border-green-200 rounded">
                <p className="font-medium text-green-700">
                  Unlimited data during unrestricted period
                </p>
              </div>
            )}
            {plan.unrestricted_speed_multiplier && (
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded">
                <span className="font-medium">Speed Multiplier</span>
                <span className="text-lg font-semibold">{plan.unrestricted_speed_multiplier}x</span>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Pricing & Contract */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <DollarSign className="h-6 w-6" />
          Pricing & Contract Terms
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="p-4 bg-gray-50 rounded">
            <p className="text-sm text-muted-foreground mb-1">Monthly Price</p>
            <p className="text-2xl font-bold">
              {plan.currency} {plan.monthly_price.toFixed(2)}
            </p>
          </div>
          <div className="p-4 bg-gray-50 rounded">
            <p className="text-sm text-muted-foreground mb-1">Setup Fee</p>
            <p className="text-xl font-semibold">
              {plan.currency} {plan.setup_fee.toFixed(2)}
            </p>
          </div>
          <div className="p-4 bg-gray-50 rounded">
            <p className="text-sm text-muted-foreground mb-1">Billing Cycle</p>
            <p className="text-lg font-semibold capitalize">{plan.billing_cycle}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded">
            <p className="text-sm text-muted-foreground mb-1">QoS Priority</p>
            <p className="text-xl font-bold">{plan.qos_priority} / 100</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 mt-4">
          <div className="p-4 bg-gray-50 rounded">
            <p className="text-sm text-muted-foreground mb-1">Minimum Contract</p>
            <p className="text-lg font-semibold">{plan.minimum_contract_months} months</p>
          </div>
          <div className="p-4 bg-gray-50 rounded">
            <p className="text-sm text-muted-foreground mb-1">Early Termination Fee</p>
            <p className="text-lg font-semibold">
              {plan.currency} {plan.early_termination_fee.toFixed(2)}
            </p>
          </div>
        </div>
      </Card>

      {/* Technical Specifications */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4">Technical Specifications</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <SpecItem label="IPv4 Included" value={plan.ipv4_included} type="boolean" />
          <SpecItem label="IPv6 Included" value={plan.ipv6_included} type="boolean" />
          <SpecItem label="Static IP" value={plan.static_ip_included} type="boolean" />
          {plan.static_ip_included && (
            <SpecItem label="Static IP Count" value={plan.static_ip_count} />
          )}
          <SpecItem label="Router Included" value={plan.router_included} type="boolean" />
          <SpecItem
            label="Installation Included"
            value={plan.installation_included}
            type="boolean"
          />
          {plan.contention_ratio && (
            <SpecItem label="Contention Ratio" value={plan.contention_ratio} />
          )}
          {plan.technical_support_level && (
            <SpecItem label="Support Level" value={plan.technical_support_level} />
          )}
          <SpecItem label="Traffic Shaping" value={plan.traffic_shaping_enabled} type="boolean" />
        </div>
      </Card>

      {/* Features & Restrictions */}
      {(plan.features.length > 0 || plan.restrictions.length > 0) && (
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Features & Restrictions</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {plan.features.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Features
                </h3>
                <ul className="space-y-2">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 bg-green-500 rounded-full" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {plan.restrictions.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-500" />
                  Restrictions
                </h3>
                <ul className="space-y-2">
                  {plan.restrictions.map((restriction, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 bg-red-500 rounded-full" />
                      <span>{restriction}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Metadata */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Calendar className="h-6 w-6" />
          Metadata
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">Created</p>
            <p className="font-medium">{new Date(plan.created_at).toLocaleString()}</p>
          </div>
          {plan.updated_at && (
            <div>
              <p className="text-sm text-muted-foreground">Last Updated</p>
              <p className="font-medium">{new Date(plan.updated_at).toLocaleString()}</p>
            </div>
          )}
          {plan.last_validated_at && (
            <div>
              <p className="text-sm text-muted-foreground">Last Validated</p>
              <p className="font-medium">{new Date(plan.last_validated_at).toLocaleString()}</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function SpecItem({
  label,
  value,
  type = "text",
}: {
  label: string;
  value: unknown;
  type?: "text" | "boolean";
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
      <span className="text-sm font-medium">{label}</span>
      {type === "boolean" ? (
        value ? (
          <CheckCircle className="h-5 w-5 text-green-500" />
        ) : (
          <XCircle className="h-5 w-5 text-gray-400" />
        )
      ) : (
        <span className="text-sm font-semibold">{String(value)}</span>
      )}
    </div>
  );
}
